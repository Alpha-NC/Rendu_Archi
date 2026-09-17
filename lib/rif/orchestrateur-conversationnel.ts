import {
  analyserReponseModele,
  autoriserAvancementParcours,
  autoriserOperation,
  ETATS_COLLECTE_OUVERTE,
  type BlocContenu,
} from './appel-outil'
import { determinerModeParDefaut, determinerStyleParDefaut } from './modes-styles'
import { determinerParcoursCollecte } from './collecte-conditionnelle'
import { construireSystemPrompt, OUTILS_CONVERSATIONNELS } from './prompt-conversationnel'
import { construirePromptCorrection, construirePromptGeneration } from './prompt-technique'
import { appliquerMiseAJourFicheProjet, type MiseAJourFicheProjet } from './extraction-project-state'
import { executerGenerationOuCorrection, executerReprise, type ResultatOperation } from './orchestrateur'
import type { DepotDossiers, DossierActuel } from './depot'
import { ETATS_DOSSIER, type EtatDossier } from './etat-machine'
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
 * Boucle tool_use → tool_result (Chantier H, backend-completion) : quand un
 * `tool_use` réel est exécuté, `finaliser` renvoie le résultat au modèle
 * sous forme de `tool_result` et récupère sa réponse en langage naturel
 * pour clore le tour — bornée à `MAX_APPELS_MODELE_PAR_TOUR` (2) appels
 * modèle : l'appel initial, puis au plus un aller-retour de clôture, jamais
 * une chaîne d'opérations. Si le modèle tente d'enchaîner un second
 * `tool_use` réel au lieu de clore en texte, il n'est JAMAIS exécuté — seul
 * un texte est accepté à ce second tour, l'incident est journalisé. Comme
 * partout ailleurs, l'historique persisté (lib/rif/depot.ts::MessageConversation)
 * ne porte que du texte, jamais les blocs tool_use/tool_result bruts de
 * l'API Anthropic — le texte de clôture (modèle si disponible, sinon le
 * résumé templated `resumerTour`) est ce qui est persisté et affiché.
 *
 * Ce que ce module NE fait PAS encore :
 * - il ne gère pas les variantes multiples (D-10 encore ouverte).
 */

/** Chantier H : jamais plus de 2 appels modèle par tour (initial + une clôture) — aucune chaîne d'opérations. */
const MAX_APPELS_MODELE_PAR_TOUR = 2

export interface MessageAppelModele {
  role: 'user' | 'assistant'
  content: string | BlocContenu[]
}

export interface AppelModeleParametres {
  system: string
  tools: typeof OUTILS_CONVERSATIONNELS
  messages: MessageAppelModele[]
}

export interface ReponseModele {
  content: BlocContenu[]
}

export type AppelModele = (params: AppelModeleParametres) => Promise<ReponseModele>

export interface ContexteConversation {
  dossier: DossierActuel
  nouveauMessage: string
  actorId: string
}

export type ResultatTour =
  | { type: 'message'; texte: string }
  | { type: 'operation'; operation: string; resultat: ResultatOperation }
  | { type: 'incident'; message: string }
  | { type: 'fiche_mise_a_jour'; champsModifies: string[]; ignores: Array<{ champ: string; raison: string }> }
  | { type: 'parcours_avance'; versEtat: EtatDossier }

/**
 * Résumé texte d'un tour — c'est CE texte qui est persisté comme message
 * assistant (PRD §13.5) et affiché côté client (ConversationRif.tsx), pour
 * qu'ils restent toujours identiques.
 */
export function resumerTour(resultat: ResultatTour): string {
  switch (resultat.type) {
    case 'message':
      return resultat.texte
    case 'incident':
      return `⚠️ ${resultat.message}`
    case 'operation': {
      if (resultat.resultat.success) {
        // PRD §9.6 : après une génération/correction, le rendu doit entrer
        // en contrôle qualité — jamais déclaré conforme automatiquement.
        const enControle = resultat.operation === 'genererRendu' || resultat.operation === 'corrigerRendu'
        return `✅ ${resultat.operation} exécutée.${enControle ? ' Contrôle qualité requis ci-dessous.' : ''}`
      }
      return `❌ ${resultat.operation} a échoué : ${resultat.resultat.error?.message ?? 'raison inconnue'}.`
    }
    case 'parcours_avance':
      return `➡️ Dossier passé en ${resultat.versEtat.replace(/_/g, ' ')}.`
    case 'fiche_mise_a_jour':
      return `📋 Fiche projet mise à jour (${resultat.champsModifies.join(', ') || 'aucun champ'}).`
  }
}

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
  const historique = await depot.obtenirHistoriqueConversation(dossier.id)
  const branchement = calculerContexteBranchement(dossier)

  const system = construireSystemPrompt({
    modeResolu: branchement.modeResolu,
    styleResolu: branchement.styleResolu,
    usageAdministratif: dossier.usageAdministratif,
    parcours: branchement.parcours,
  })

  // D-06 a choisi un modèle MULTIMODAL pour « l'analyse assistée des
  // sources » (PRD §9.2 : rôles, compatibilité caméra, pré-analyse des
  // matériaux). Sans les images jointes, cette étape est impossible et le
  // modèle ne peut que deviner — exactement ce que le Framework interdit.
  //
  // ponytail: les images sont renvoyées à chaque tour de la phase de
  // collecte (l'historique persisté ne porte que du texte, cf. note en
  // tête). Coût ~1,5k tokens par image et par tour ; passer par le cache de
  // prompt si la facture le justifie.
  const contenuUtilisateur: BlocContenu[] = []
  if (ETATS_COLLECTE_OUVERTE.includes(dossier.etat) && dossier.projectState.sources.length > 0) {
    const sources = dossier.projectState.sources
    // Échec franc si le stockage ne répond pas : analyser sans voir les
    // sources produirait une pré-analyse inventée.
    const urls = await depot.resolverUrlsSignees(sources.map((s) => s.id))
    sources.forEach((s, i) => {
      const url = urls[i]
      if (!url) return
      contenuUtilisateur.push({
        type: 'text',
        text: `Source ${s.id} — rôle ${s.role_confirmed ?? s.role_detected}${s.role_confirmed ? '' : ' (non confirmé)'}${s.target ? `, cible : ${s.target}` : ''}`,
      })
      contenuUtilisateur.push({ type: 'image', source: { type: 'url', url } })
    })
  }
  contenuUtilisateur.push({ type: 'text', text: contexte.nouveauMessage })

  const reponse = await appelerModele({
    system,
    tools: OUTILS_CONVERSATIONNELS,
    messages: [...historique, { role: 'user', content: contenuUtilisateur }],
  })
  let appelsModele = 1

  /**
   * Persiste le tour (PRD §13.5) puis renvoie le résultat — point de sortie
   * unique. Quand `toolUseId` est fourni (un `tool_use` réel a été exécuté),
   * renvoie le résultat au modèle en `tool_result` pour une clôture en
   * langage naturel (Chantier H) — bornée par MAX_APPELS_MODELE_PAR_TOUR ;
   * si la clôture échoue ou n'est pas disponible, le résumé templated
   * (`resumerTour`) reste le texte affiché/persisté, le tour n'échoue jamais
   * pour autant.
   */
  async function finaliser(resultat: ResultatTour, toolUseId?: string): Promise<ResultatTour> {
    await depot.ajouterMessageConversation(dossier.id, { role: 'user', content: contexte.nouveauMessage })
    let texteAffiche = resumerTour(resultat)

    if (toolUseId && appelsModele < MAX_APPELS_MODELE_PAR_TOUR) {
      appelsModele += 1
      try {
        const estIncident = resultat.type === 'incident' || (resultat.type === 'operation' && !resultat.resultat.success)
        const reponseCloture = await appelerModele({
          system,
          tools: OUTILS_CONVERSATIONNELS,
          messages: [
            ...historique,
            { role: 'user', content: contenuUtilisateur },
            { role: 'assistant', content: reponse.content },
            {
              role: 'user',
              content: [{ type: 'tool_result', tool_use_id: toolUseId, content: texteAffiche, is_error: estIncident }],
            },
          ],
        })

        const analyseCloture = analyserReponseModele(reponseCloture.content)
        if (analyseCloture.genre === 'aucun_appel') {
          const texteModele = reponseCloture.content
            .filter((b): b is BlocContenu & { text: string } => b.type === 'text' && typeof b.text === 'string')
            .map((b) => b.text)
            .join('\n\n')
          if (texteModele.trim()) texteAffiche = texteModele
        } else {
          // Le modèle a tenté d'enchaîner une seconde opération dans le
          // même tour au lieu de clore en texte — jamais exécutée (aucune
          // chaîne d'opérations non revue, PRD §11). Le résumé templated
          // reste le texte affiché.
          await depot.journaliserEvenement(
            dossier.id,
            'boucle_outil_limite_atteinte',
            { genre: analyseCloture.genre },
            contexte.actorId,
          )
        }
      } catch (erreur) {
        // La clôture est un enrichissement, jamais une condition de succès
        // du tour : l'opération elle-même est déjà acquise et journalisée.
        await depot.journaliserEvenement(
          dossier.id,
          'boucle_outil_cloture_echec',
          { message: erreur instanceof Error ? erreur.message : 'erreur inconnue' },
          contexte.actorId,
        )
      }
    }

    await depot.ajouterMessageConversation(dossier.id, { role: 'assistant', content: texteAffiche })
    return resultat
  }

  const analyse = analyserReponseModele(reponse.content)

  if (analyse.genre === 'aucun_appel') {
    const texte = reponse.content
      .filter((b): b is BlocContenu & { text: string } => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text)
      .join('\n\n')
    return finaliser({ type: 'message', texte })
  }

  if (analyse.genre === 'appel_simule_detecte') {
    await depot.journaliserEvenement(
      dossier.id,
      'appel_outil_simule_detecte',
      { operationEvoquee: analyse.operationEvoquee, extrait: analyse.extrait },
      contexte.actorId,
    )
    return finaliser({
      type: 'incident',
      message:
        "Une réponse anormale du modèle a été détectée et bloquée avant toute exécution — aucune génération n'a été lancée. Réessaie ta demande.",
    })
  }

  if (analyse.genre === 'operation_inconnue') {
    await depot.journaliserEvenement(dossier.id, 'operation_inconnue', { nom: analyse.nom }, contexte.actorId)
    return finaliser({ type: 'incident', message: "Le modèle a tenté d'appeler un outil qui n'existe pas dans RIF-App." })
  }

  // analyse.genre === 'appel_reel' — construction du prompt technique
  // réel (ENG-002/003), jamais fourni par le modèle (PRD §9.5).
  const sourceFileIds = dossier.projectState.sources.map((s) => s.id)
  // Chantier H : id du tool_use réel, pour pairer le tool_result de clôture.
  const toolUseId = reponse.content.find((b) => b.type === 'tool_use')?.id

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
    return finaliser({ type: 'operation', operation: 'genererRendu', resultat }, toolUseId)
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
      return finaliser({ type: 'incident', message: 'La demande de correction est incomplète — précise ce qui doit changer et le résultat attendu.' }, toolUseId)
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
    return finaliser({ type: 'operation', operation: 'corrigerRendu', resultat }, toolUseId)
  }

  if (analyse.operation === 'reprendreDepuisSources') {
    const entreeReprise = analyse.entree as { motif?: unknown } | undefined
    const motif = typeof entreeReprise?.motif === 'string' ? entreeReprise.motif : 'Motif non précisé par le modèle.'
    const resultat = await executerReprise(depot, { dossierId: dossier.id, actorId: contexte.actorId, motif })
    return finaliser({ type: 'operation', operation: 'reprendreDepuisSources', resultat }, toolUseId)
  }

  if (analyse.operation === 'avancerParcours') {
    const entree = analyse.entree as { versEtat?: unknown; motif?: unknown } | undefined
    const versEtat = entree?.versEtat
    if (typeof versEtat !== 'string' || !(ETATS_DOSSIER as readonly string[]).includes(versEtat)) {
      return finaliser({ type: 'incident', message: "État cible invalide proposé par le modèle." }, toolUseId)
    }

    const decision = autoriserAvancementParcours(dossier.etat, versEtat as EtatDossier, dossier.projectState, {
      usageAdministratif: dossier.usageAdministratif,
      vueRevitExploitable: dossier.projectState.sources.some(
        (s) => (s.role_confirmed ?? s.role_detected) === 'revit_view' && s.status === 'valid',
      ),
      photoSiteFournie: dossier.projectState.sources.some(
        (s) => (s.role_confirmed ?? s.role_detected) === 'site_photo' && s.status === 'valid',
      ),
    })
    if (!decision.autorisee) {
      await depot.journaliserEvenement(
        dossier.id,
        'operation_refusee',
        { operation: 'avancerParcours', versEtat, raison: decision.raison },
        contexte.actorId,
      )
      return finaliser({ type: 'incident', message: decision.raison ?? 'Avancement refusé.' }, toolUseId)
    }

    await depot.transitionnerDossier(dossier.id, versEtat as EtatDossier)
    await depot.journaliserEvenement(
      dossier.id,
      'parcours_avance',
      { versEtat, motif: typeof entree?.motif === 'string' ? entree.motif : null },
      contexte.actorId,
    )
    return finaliser({ type: 'parcours_avance', versEtat: versEtat as EtatDossier }, toolUseId)
  }

  // mettreAJourFicheProjet (D-15) — la seule opération qui ne passe pas par
  // orchestrateur.ts : elle ne touche ni fal.ai ni la machine à états
  // GÉNÉRATION_EN_COURS, seulement le ProjectState lui-même.
  const decisionExtraction = autoriserOperation('mettreAJourFicheProjet', dossier.etat, dossier.projectState)
  if (!decisionExtraction.autorisee) {
    await depot.journaliserEvenement(
      dossier.id,
      'operation_refusee',
      { operation: 'mettreAJourFicheProjet', raison: decisionExtraction.raison },
      contexte.actorId,
    )
    return finaliser({
      type: 'incident',
      message: decisionExtraction.raison ?? 'Mise à jour de la fiche projet non autorisée dans cet état.',
    }, toolUseId)
  }

  const miseAJour = (analyse.entree ?? {}) as MiseAJourFicheProjet
  const { suivant, ignores } = appliquerMiseAJourFicheProjet(dossier.projectState, miseAJour, {
    sourceId: `conversation:${dossier.id}`,
  })
  await depot.mettreAJourProjectState(dossier.id, suivant)
  await depot.journaliserEvenement(
    dossier.id,
    'fiche_projet_mise_a_jour',
    { champs: Object.keys(miseAJour), ignores },
    contexte.actorId,
  )
  return finaliser({ type: 'fiche_mise_a_jour', champsModifies: Object.keys(miseAJour), ignores }, toolUseId)
}
