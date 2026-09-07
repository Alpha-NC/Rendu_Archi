import type { ProjectState } from './project-state'
import type { EtatDossier } from './etat-machine'
import { verifierPrecondition } from './etat-machine'

/**
 * Garde d'appel d'outil.
 *
 * Répond au risque #1 du prémortem du 02.09.2026, désigné comme l'échec le
 * plus probable : le modèle décrit en texte l'appel qu'il « voudrait » faire
 * (souvent un bloc de code JSON `genererRendu({...})`) sans jamais
 * émettre de vrai `tool_use`. L'utilisateur croit une génération lancée qui
 * ne l'a jamais été, et ne le découvre qu'en cherchant un lien absent.
 *
 * Deux règles, non négociables :
 *
 * 1. Une opération ne part JAMAIS d'un texte parsé. Seul un bloc `tool_use`
 *    réel de l'API peut déclencher une opération.
 * 2. Un texte qui *ressemble* à un appel d'outil est un incident à
 *    journaliser, pas un appel à exécuter ni un détail à ignorer
 *    silencieusement — c'est le seul signal observable de la panne décrite
 *    par le prémortem.
 */

export const OPERATIONS_RIF = [
  'genererRendu',
  'corrigerRendu',
  'reprendreDepuisSources',
  // Quatrième outil, absent du PRD §14 (qui n'en définit que trois) —
  // ajouté pour résoudre l'extraction structurée du ProjectState,
  // documenté en D-15 (DECISIONS.md). Soumis à la même garde : un texte
  // qui prétend avoir mis à jour la fiche projet sans tool_use réel est
  // tout aussi dangereux qu'un faux appel de génération.
  'mettreAJourFicheProjet',
] as const

export type OperationRif = (typeof OPERATIONS_RIF)[number]

/** Bloc de contenu tel que renvoyé par l'API Anthropic (forme minimale utile). */
export interface BlocContenu {
  type: string
  name?: string
  input?: unknown
  text?: string
}

export type ResultatAppelOutil =
  | { genre: 'aucun_appel' }
  | { genre: 'appel_reel'; operation: OperationRif; entree: unknown }
  | {
      /**
       * Le modèle a produit du texte imitant un appel d'outil sans émettre de
       * `tool_use`. Aucune opération ne doit partir ; l'appelant journalise
       * l'incident (table `events`) et signale l'échec à l'utilisateur plutôt
       * que de laisser croire à une génération lancée.
       */
      genre: 'appel_simule_detecte'
      operationEvoquee: OperationRif
      extrait: string
    }
  | { genre: 'operation_inconnue'; nom: string }

/**
 * Motifs de texte imitant un appel d'outil. Volontairement larges : un faux
 * positif coûte un incident journalisé à tort, un faux négatif coûte une
 * génération fantôme non détectée.
 */
function detecterAppelSimule(texte: string): OperationRif | null {
  for (const operation of OPERATIONS_RIF) {
    // `genererRendu(`, `"name": "genererRendu"`, `genererRendu({`…
    const motif = new RegExp(`${operation}\\s*[({"']|["']${operation}["']`, 'i')
    if (motif.test(texte)) return operation
  }
  return null
}

function estOperationRif(nom: string): nom is OperationRif {
  return (OPERATIONS_RIF as readonly string[]).includes(nom)
}

/**
 * Analyse les blocs de contenu d'une réponse du modèle et détermine si une
 * opération RIF a réellement été demandée.
 *
 * Le `tool_use` réel a toujours priorité : si le modèle émet à la fois du
 * texte bavard et un vrai bloc `tool_use`, c'est un appel réel.
 */
export function analyserReponseModele(blocs: BlocContenu[]): ResultatAppelOutil {
  for (const bloc of blocs) {
    if (bloc.type !== 'tool_use' || !bloc.name) continue
    if (estOperationRif(bloc.name)) {
      return { genre: 'appel_reel', operation: bloc.name, entree: bloc.input }
    }
    return { genre: 'operation_inconnue', nom: bloc.name }
  }

  for (const bloc of blocs) {
    if (bloc.type !== 'text' || !bloc.text) continue
    const operationEvoquee = detecterAppelSimule(bloc.text)
    if (operationEvoquee) {
      return {
        genre: 'appel_simule_detecte',
        operationEvoquee,
        extrait: bloc.text.slice(0, 500),
      }
    }
  }

  return { genre: 'aucun_appel' }
}

export interface DecisionOperation {
  autorisee: boolean
  raison?: string
}

/**
 * Deuxième barrière : même un `tool_use` réel ne suffit pas. Le backend
 * revérifie que l'opération demandée est licite dans l'état courant du
 * dossier (PRD §11 : « Les préconditions sont revérifiées côté backend à
 * chaque appel ; masquer un outil au modèle ne constitue pas à lui seul une
 * protection suffisante »).
 */
export function autoriserOperation(
  operation: OperationRif,
  etatCourant: EtatDossier,
  projectState: ProjectState,
  contexte: Parameters<typeof verifierPrecondition>[3] = {},
): DecisionOperation {
  // PRD §14.1 : genererRendu est refusée hors de PRÊT_À_GÉNÉRER.
  if (operation === 'genererRendu') {
    if (etatCourant !== 'PRET_A_GENERER') {
      return {
        autorisee: false,
        raison: `Génération impossible depuis l'état ${etatCourant}.`,
      }
    }
    const precondition = verifierPrecondition(
      etatCourant,
      'GENERATION_EN_COURS',
      projectState,
      contexte,
    )
    return { autorisee: precondition.autorisee, raison: precondition.raison }
  }

  // PRD §14.2 : correction locale, réservée à un rendu existant fiable.
  if (operation === 'corrigerRendu') {
    if (etatCourant !== 'A_CORRIGER') {
      return {
        autorisee: false,
        raison: `Correction impossible depuis l'état ${etatCourant}.`,
      }
    }
    return { autorisee: true }
  }

  // PRD §14.3 : reprise depuis les sources — opération distincte, jamais
  // présentée ni traitée comme une correction locale (D-09).
  if (operation === 'reprendreDepuisSources') {
    if (etatCourant !== 'A_REPRENDRE') {
      return {
        autorisee: false,
        raison: `Reprise depuis les sources impossible depuis l'état ${etatCourant}.`,
      }
    }
    return { autorisee: true }
  }

  // D-15 : mettreAJourFicheProjet — autorisée tant que la fiche n'est pas
  // encore confirmée. Une fois PRÊT_À_GÉNÉRER ou au-delà, le ProjectState
  // est la révision immuable qui a servi ou va servir de base à une
  // génération (PRD §10) ; le modifier silencieusement à ce stade romprait
  // la traçabilité que la révision est censée garantir.
  const ETATS_COLLECTE_OUVERTE: EtatDossier[] = [
    'BROUILLON',
    'SOURCES_RECUES',
    'SOURCES_CONTROLEES',
    'COLLECTE_EN_COURS',
    'FICHE_A_CONFIRMER',
  ]
  if (!ETATS_COLLECTE_OUVERTE.includes(etatCourant)) {
    return {
      autorisee: false,
      raison: `Mise à jour de la fiche projet impossible depuis l'état ${etatCourant} — la révision est déjà engagée ou confirmée.`,
    }
  }
  return { autorisee: true }
}
