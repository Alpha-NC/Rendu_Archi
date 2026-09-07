import { analyserReponseModele, type BlocContenu } from './appel-outil'
import { determinerModeParDefaut, determinerStyleParDefaut } from './modes-styles'
import { determinerParcoursCollecte } from './collecte-conditionnelle'
import { construireSystemPrompt, OUTILS_CONVERSATIONNELS } from './prompt-conversationnel'
import { construirePromptCorrection, construirePromptGeneration } from './prompt-technique'
import { executerGenerationOuCorrection, executerReprise, type ResultatOperation } from './orchestrateur'
import type { DepotDossiers, DossierActuel } from './depot'
import type { genererEtAttendre } from '../fal/client'

/**
 * Orchestrateur conversationnel — relie en un seul tour :
 *
 * 1. le calcul déterministe du plan de collecte (modes-styles.ts +
 *    collecte-conditionnelle.ts), injecté dans le prompt système ;
 * 2. l'appel au modèle (Claude Sonnet 5, D-06) ;
 * 3. la garde d'appel d'outil déjà construite (appel-outil.ts) — aucune
 *    opération ne part d'un texte parsé ;
 * 4. la construction du prompt technique réel (prompt-technique.ts, ENG-002/
 *    003) — jamais fourni par le modèle lui-même (PRD §9.5) ;
 * 5. l'exécution transactionnelle déjà construite (orchestrateur.ts).
 *
 * Ce que ce module NE fait PAS (délibérément, pour rester honnête sur le
 * périmètre réellement couvert) :
 * - il ne boucle pas automatiquement pour renvoyer le tool_result au modèle
 *   et obtenir un message de clôture en langage naturel — cela suppose une
 *   persistance de conversation (PRD §13.5 : « peut être stockée
 *   séparément ») qui n'est pas encore conçue. L'appelant reçoit le
 *   ResultatOperation et peut afficher un message templated, ou effectuer
 *   un second appel avec le tool_result s'il gère lui-même l'historique ;
 * - il ne gère pas encore les variantes multiples (D-10 encore ouverte).
 */

export interface MessageConversation {
  role: 'user' | 'assistant'
  content: string | BlocContenu[]
}

export interface AppelModeleParametres {
  system: string
  tools: typeof OUTILS_CONVERSATIONNELS
  messages: MessageConversation[]
}

export interface ReponseModele {
  content: BlocContenu[]
}

export type AppelModele = (params: AppelModeleParametres) => Promise<ReponseModele>

export interface ContexteConversation {
  dossier: DossierActuel
  historique: MessageConversation[]
  nouveauMessage: string
  actorId: string
}

export type ResultatTour =
  | { type: 'message'; texte: string }
  | { type: 'operation'; operation: string; resultat: ResultatOperation }
  | { type: 'incident'; message: string }

/**
 * Calcule le contexte de branchement (mode/style résolus + plan de
 * collecte) pour un dossier donné — exposé séparément pour rester testable
 * indépendamment de l'appel au modèle.
 */
export function calculerContexteBranchement(dossier: DossierActuel) {
  const modeResolu =
    dossier.projectState.mode ??
    determinerModeParDefaut({
      vueRevitExploitable: dossier.projectState.sources.some(
        (s) => (s.role_confirmed ?? s.role_detected) === 'revit_view' && s.status === 'valid',
      ),
      photographieReelleFournie: dossier.projectState.sources.some(
        (s) => (s.role_confirmed ?? s.role_detected) === 'site_photo' && s.status === 'valid',
      ),
      cameraCompatible: dossier.projectState.camera_compatibility,
      usageAdministratif: dossier.usageAdministratif,
    }).mode

  const styleResolu =
    dossier.projectState.style ??
    determinerStyleParDefaut({
      photographieReelleFournie: dossier.projectState.sources.some(
        (s) => (s.role_confirmed ?? s.role_detected) === 'site_photo',
      ),
      usageAdministratif: dossier.usageAdministratif,
    }).style

  const modePourParcours = modeResolu === 'a_confirmer' || modeResolu === 'suspendre' ? null : modeResolu
  const stylePourParcours = styleResolu === 'a_confirmer' ? null : styleResolu

  const parcours = determinerParcoursCollecte(modePourParcours, stylePourParcours)

  return { modeResolu, styleResolu, parcours }
}

/**
 * Exécute un tour de conversation. Ne gère qu'UN appel au modèle et, le cas
 * échéant, UNE opération — pas de boucle multi-tour (voir note en tête de
 * fichier).
 */
export async function executerTourConversationnel(
  depot: DepotDossiers,
  appelerModele: AppelModele,
  appelerFal: typeof genererEtAttendre,
  contexte: ContexteConversation,
): Promise<ResultatTour> {
  const { dossier } = contexte
  const branchement = calculerContexteBranchement(dossier)

  const system = construireSystemPrompt({
    modeResolu: branchement.modeResolu,
    styleResolu: branchement.styleResolu,
    usageAdministratif: dossier.usageAdministratif,
    parcours: branchement.parcours,
  })

  const reponse = await appelerModele({
    system,
    tools: OUTILS_CONVERSATIONNELS,
    messages: [...contexte.historique, { role: 'user', content: contexte.nouveauMessage }],
  })

  const analyse = analyserReponseModele(reponse.content)

  if (analyse.genre === 'aucun_appel') {
    const texte = reponse.content
      .filter((b): b is BlocContenu & { text: string } => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text)
      .join('\n\n')
    return { type: 'message', texte }
  }

  if (analyse.genre === 'appel_simule_detecte') {
    await depot.journaliserEvenement(
      dossier.id,
      'appel_outil_simule_detecte',
      { operationEvoquee: analyse.operationEvoquee, extrait: analyse.extrait },
      contexte.actorId,
    )
    return {
      type: 'incident',
      message:
        "Une réponse anormale du modèle a été détectée et bloquée avant toute exécution — aucune génération n'a été lancée. Réessaie ta demande.",
    }
  }

  if (analyse.genre === 'operation_inconnue') {
    await depot.journaliserEvenement(dossier.id, 'operation_inconnue', { nom: analyse.nom }, contexte.actorId)
    return { type: 'incident', message: "Le modèle a tenté d'appeler un outil qui n'existe pas dans RIF-App." }
  }

  // analyse.genre === 'appel_reel' — construction du prompt technique
  // réel (ENG-002/003), jamais fourni par le modèle (PRD §9.5).
  const sourceFileIds = dossier.projectState.sources.map((s) => s.id)

  if (analyse.operation === 'genererRendu') {
    const promptText = construirePromptGeneration(dossier.projectState)
    const resultat = await executerGenerationOuCorrection(depot, appelerFal, {
      dossierId: dossier.id,
      type: 'initial',
      promptText,
      sourceFileIds,
      actorId: contexte.actorId,
      contexte: { usageAdministratif: dossier.usageAdministratif },
    })
    return { type: 'operation', operation: 'genererRendu', resultat }
  }

  if (analyse.operation === 'corrigerRendu') {
    const entree = analyse.entree as { elementAModifier?: unknown; resultatAttendu?: unknown } | undefined
    if (typeof entree?.elementAModifier !== 'string' || typeof entree?.resultatAttendu !== 'string') {
      await depot.journaliserEvenement(
        dossier.id,
        'operation_refusee',
        { operation: 'corrigerRendu', raison: 'Paramètres manquants ou invalides.' },
        contexte.actorId,
      )
      return { type: 'incident', message: 'La demande de correction est incomplète — précise ce qui doit changer et le résultat attendu.' }
    }
    const promptText = construirePromptCorrection(dossier.projectState, {
      elementAModifier: entree.elementAModifier,
      resultatAttendu: entree.resultatAttendu,
    })
    const resultat = await executerGenerationOuCorrection(depot, appelerFal, {
      dossierId: dossier.id,
      type: 'correction',
      promptText,
      sourceFileIds,
      actorId: contexte.actorId,
      contexte: { usageAdministratif: dossier.usageAdministratif },
    })
    return { type: 'operation', operation: 'corrigerRendu', resultat }
  }

  // reprendreDepuisSources
  const entreeReprise = analyse.entree as { motif?: unknown } | undefined
  const motif = typeof entreeReprise?.motif === 'string' ? entreeReprise.motif : 'Motif non précisé par le modèle.'
  const resultat = await executerReprise(depot, { dossierId: dossier.id, actorId: contexte.actorId, motif })
  return { type: 'operation', operation: 'reprendreDepuisSources', resultat }
}
