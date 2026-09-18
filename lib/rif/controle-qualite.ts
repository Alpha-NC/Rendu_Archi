/**
 * Contrôle qualité — étape distincte de la génération (PRD §15, §9.6).
 *
 * Reprend la checklist officielle LIB-002
 * (rif-framework/Framework/03_REFERENCES/05_CHECKLIST_CONTROLE.md) : la
 * grille de critères, les états possibles, les défauts éliminatoires et la
 * liste des verdicts. N'invente aucun critère hors de ce document.
 *
 * Répond au risque #3 du prémortem du 02.09.2026 — désigné comme l'échec le
 * plus dangereux : « le contrôle qualité visuel n'a jamais tourné en
 * conditions réelles hors ChatGPT [...] classe Conforme par excès de
 * confiance ». Deux garanties structurelles contre ce risque précis :
 *
 * 1. Ce module ne calcule qu'un VERDICT PROPOSÉ. Aucune fonction ici ne
 *    produit de verdict autoritaire — PRD §15.1 : « aucun verdict
 *    automatique ne remplace la validation d'Évariste pour un usage
 *    administratif. » Le verdict humain est un champ distinct, jamais
 *    dérivé ou écrasé par le verdict proposé.
 * 2. `autoriserExportAdministratif` est le garde-fou d'export (PRD §15.3) :
 *    seul un verdict HUMAIN de 'validation' l'autorise pour un usage
 *    administratif. Un rendu non contrôlé, Non conforme ou Suspendu ne peut
 *    jamais être exporté comme rendu administratif — quel que soit le
 *    verdict proposé.
 */

import type { ElementEnvironnement } from './project-state'
import { etatEffectifEnvironnement } from './contraintes-libertes'
import type { GeometryConstraintPack } from './geometrie-3d'

/** Version de la checklist appliquée (PRD §13.4 : `checklist_version`). */
export const LIB_002_VERSION = 'LIB-002 V1.9'

/**
 * Grille commune LIB-002 V1.9 §3 — 18 critères. `elements_inventes` et
 * `photorealisme` ajoutés au Lot 1 RenderTarget (correction d'une
 * contradiction découverte en construisant les `QualityProfile` par
 * `OutputType` — `elements_inventes` était déjà un défaut éliminatoire §5,
 * jamais un critère noté ; `isolation` ne l'a jamais couvert, contrairement
 * à ce qu'une note antérieure affirmait à tort). Aucun autre ajout non
 * documenté.
 */
export const CRITERES_CONTROLE = [
  'cadrage',
  'perspective',
  'silhouette',
  'volumes',
  'toiture',
  'ouvertures',
  'implantation',
  'terrain',
  'environnement',
  'materiaux',
  'lumiere',
  'elements_secondaires',
  'confidentialite',
  'annotations',
  'references_materiau',
  'isolation',
  'elements_inventes',
  'photorealisme',
] as const

export type CritereControle = (typeof CRITERES_CONTROLE)[number]

/**
 * Critères dont une non-conformité signale une dérive structurelle
 * (géométrie, caméra, environnement verrouillé, contamination) — le type de
 * défaut qui, selon le PRD (§14.3, ADR-016) et non une simple correction
 * locale, appelle une reprise depuis les sources plutôt qu'une correction
 * ciblée.
 */
const CRITERES_STRUCTURELS = new Set<CritereControle>([
  'cadrage',
  'perspective',
  'silhouette',
  'volumes',
  'toiture',
  'ouvertures',
  'implantation',
  'terrain',
  'environnement',
  'isolation',
  // Un élément inventé (mur, ouverture, volume absent des sources) est par
  // nature une dérive géométrique structurelle, jamais une simple retouche
  // locale — LIB-002 §5 le classe déjà parmi les défauts éliminatoires.
  'elements_inventes',
])

/**
 * LIB-002 §2 V1.9 — cinq états possibles pour un critère. `non_evalue`
 * ajouté au Lot 1 RenderTarget : un critère non mesurable avec les moyens
 * actuels (image insuffisante, méthode non branchée) ne doit jamais devenir
 * `conforme` par défaut — c'est précisément le risque que cet état honnête
 * évite (prémortem #3, voir l'en-tête de ce fichier).
 */
export type EtatCritere = 'conforme' | 'reserve' | 'non_conforme' | 'non_applicable' | 'non_evalue'

/** LIB-002 §7 — format de rapport, une ligne par critère évalué. */
export interface LigneRapport {
  critere: CritereControle
  /** Colonne « Source de contrôle » de la grille LIB-002 §3. */
  sourceControle: string
  etat: EtatCritere
  ecartObserve?: string
  actionRecommandee?: string
  /**
   * Marque explicitement une ligne comme défaut éliminatoire (LIB-002 §5).
   * Jamais déduit automatiquement d'un texte libre — c'est à l'auteur du
   * rapport (contrôle multimodal ou humain) de le qualifier, pas à ce
   * module de le deviner.
   */
  defautEliminatoire?: boolean
}

/** LIB-002 §6 — les cinq verdicts possibles. */
export type VerdictControle =
  | 'validation'
  | 'acceptable_avec_reserve'
  | 'correction_ciblee'
  | 'nouvelle_generation'
  | 'production_suspendue'

export interface RapportControle {
  generationId: string
  /** Version figée de la checklist utilisée (PRD §13.4). */
  checklistVersion: string
  usageEvalue: string
  usageAdministratif: boolean
  lignes: LigneRapport[]
}

export interface VerdictPropose {
  verdict: VerdictControle
  motif: string
}

/**
 * Calcule un verdict PROPOSÉ à partir du rapport — jamais un verdict
 * définitif. Toujours accompagné d'un motif explicite, pour que la
 * validation humaine (§15.1) porte sur un raisonnement visible et non sur
 * une boîte noire.
 *
 * Règles, dérivées de LIB-002 :
 * - une confidentialité Non conforme suspend la production (§5 : donnée
 *   confidentielle visible est un défaut éliminatoire, et le PRD §8 fait
 *   des données confidentielles non traitées une condition bloquante) ;
 * - tout autre défaut éliminatoire sur un critère structurel impose une
 *   reprise depuis les sources, jamais une correction locale (§14.3) ;
 * - un défaut éliminatoire sur un critère non structurel appelle une
 *   correction ciblée ;
 * - en usage administratif, une simple Réserve n'est jamais acceptée telle
 *   quelle (§7 : « Acceptable avec réserve pour une présentation et Non
 *   conforme pour un usage administratif ») — elle est traitée comme une
 *   non-conformité à corriger ;
 * - hors usage administratif, une Réserve sans défaut éliminatoire donne
 *   Acceptable avec réserve ;
 * - sans écart, Validation.
 */
export function calculerVerdictPropose(rapport: RapportControle): VerdictPropose {
  const { lignes, usageAdministratif } = rapport

  const confidentialiteNonConforme = lignes.find(
    (l) => l.critere === 'confidentialite' && l.etat === 'non_conforme',
  )
  if (confidentialiteNonConforme) {
    return {
      verdict: 'production_suspendue',
      motif: 'Information confidentielle visible dans le rendu — suspension obligatoire.',
    }
  }

  const eliminatoiresStructurels = lignes.filter(
    (l) => l.etat === 'non_conforme' && l.defautEliminatoire && CRITERES_STRUCTURELS.has(l.critere),
  )
  if (eliminatoiresStructurels.length > 0) {
    return {
      verdict: 'nouvelle_generation',
      motif: `Défaut éliminatoire structurel sur : ${eliminatoiresStructurels
        .map((l) => l.critere)
        .join(', ')}. Reprise depuis les sources requise (PRD §14.3).`,
    }
  }

  const eliminatoiresLocaux = lignes.filter(
    (l) => l.etat === 'non_conforme' && l.defautEliminatoire,
  )
  if (eliminatoiresLocaux.length > 0) {
    return {
      verdict: 'correction_ciblee',
      motif: `Défaut éliminatoire localisé sur : ${eliminatoiresLocaux
        .map((l) => l.critere)
        .join(', ')}.`,
    }
  }

  const nonConformesSimples = lignes.filter((l) => l.etat === 'non_conforme')
  if (nonConformesSimples.length > 0) {
    return {
      verdict: 'correction_ciblee',
      motif: `Non-conformité sur : ${nonConformesSimples.map((l) => l.critere).join(', ')}.`,
    }
  }

  const reserves = lignes.filter((l) => l.etat === 'reserve')
  if (reserves.length > 0) {
    if (usageAdministratif) {
      return {
        verdict: 'correction_ciblee',
        motif: `Réserve(s) sur : ${reserves
          .map((l) => l.critere)
          .join(', ')} — non acceptable telle quelle en usage administratif (LIB-002 §7).`,
      }
    }
    return {
      verdict: 'acceptable_avec_reserve',
      motif: `Réserve(s) sur : ${reserves.map((l) => l.critere).join(', ')}, acceptable hors usage administratif.`,
    }
  }

  return { verdict: 'validation', motif: 'Aucun écart relevé sur les critères applicables.' }
}

/**
 * Critères géométriques concernés par la priorité geometry-first (ADR-021,
 * LIB-002 §1 note geometry-first) : quand un pack de contraintes existe, il
 * devient la « Source de contrôle » prioritaire pour ces critères — plus
 * précis qu'une comparaison contre une vue 2D. N'affecte jamais les critères
 * hors géométrie (environnement, matériaux, lumière...).
 */
const CRITERES_GEOMETRIQUES = new Set<CritereControle>([
  'silhouette',
  'volumes',
  'toiture',
  'ouvertures',
  'implantation',
  'elements_inventes',
])

/**
 * Détermine la « Source de contrôle » (LIB-002 §3) à utiliser pour un
 * critère donné. Ne devine jamais qu'un pack est exploitable : un pack sans
 * `sourceFileId` valide n'existe pas ici (le type l'exige déjà), mais un
 * pack vide (aucun champ extrait au-delà de `schemaVersion`/`sourceFileId`)
 * n'apporte aucune donnée réelle — dans ce cas, retombe sur la source 2D
 * désignée comme en V2.1 standard, jamais une fausse priorité géométrique.
 */
export function sourceControlePourCritere(
  critere: CritereControle,
  geometryPack: GeometryConstraintPack | undefined,
): string {
  const packExploitable =
    geometryPack &&
    Object.keys(geometryPack).some((cle) => cle !== 'schemaVersion' && cle !== 'sourceFileId')

  if (CRITERES_GEOMETRIQUES.has(critere) && packExploitable) {
    return `Pack de contraintes géométriques (source modèle 3D ${geometryPack!.sourceFileId})`
  }
  return critere === 'cadrage' || critere === 'perspective' ? 'Vue Revit (cadrage intentionnel)' : 'Source désignée'
}

/* =========================================================================
 * Contrôle de l'environnement (ARCH-002, D-19) — règles déterministes.
 *
 * N'implémente PAS l'audit multimodal (qui reste à construire) : ce module
 * ne fait que qualifier un CONSTAT déjà établi (par un humain ou un futur
 * audit) sur ce qu'un rendu montre réellement pour un élément donné, au
 * regard de sa classification dans le ProjectState. Distingue les trois
 * défauts que la classification locked/editable/harmonizable rend possibles
 * (D-19, section 9 du lot d'implémentation) :
 * - un élément `locked` modifié = régression, jamais légitime ;
 * - un élément `editable` avec une décision explicite mais non traité =
 *   absence de la modification demandée ;
 * - un élément `harmonizable` supprimé ou remplacé = transformation
 *   excessive (seule une amélioration visuelle est autorisée).
 * ========================================================================= */

/** Ce qu'un rendu montre réellement pour un élément d'environnement donné. */
export type ConstatElement = 'conserve' | 'modifie' | 'supprime' | 'ameliore'

export interface ConstatEnvironnement {
  element: ElementEnvironnement
  constat: ConstatElement
}

export type DefautEnvironnement =
  | { type: 'locked_modifie'; element: string; details: string }
  | { type: 'editable_non_traite'; element: string; details: string }
  | { type: 'harmonizable_excessif'; element: string; details: string }

/**
 * Évalue une liste de constats face à la classification de chaque élément.
 * Pure et déterministe — ne devine jamais le constat lui-même (fourni par
 * l'appelant), ne tranche que la conformité entre ce constat et l'état
 * effectif de l'élément (etatEffectifEnvironnement : une classification
 * proposée mais non validée est déjà traitée comme `locked` en amont).
 */
export function evaluerEnvironnement(constats: ConstatEnvironnement[]): DefautEnvironnement[] {
  const defauts: DefautEnvironnement[] = []

  for (const { element, constat } of constats) {
    const etat = etatEffectifEnvironnement(element)

    if (etat === 'locked' && constat !== 'conserve') {
      defauts.push({
        type: 'locked_modifie',
        element: element.id,
        details: `« ${element.id} » est verrouillé mais le rendu le montre ${constat}.`,
      })
      continue
    }

    if (etat === 'editable' && element.action_attendue && constat === 'conserve') {
      defauts.push({
        type: 'editable_non_traite',
        element: element.id,
        details: `« ${element.id} » a une décision explicite (« ${element.action_attendue} ») mais le rendu le conserve tel quel.`,
      })
      continue
    }

    if (etat === 'harmonizable' && (constat === 'supprime' || constat === 'modifie')) {
      defauts.push({
        type: 'harmonizable_excessif',
        element: element.id,
        details: `« ${element.id} » n'autorise qu'une amélioration visuelle mais le rendu le montre ${constat}.`,
      })
    }
  }

  return defauts
}

/**
 * Convertit des défauts d'environnement en lignes de rapport LIB-002,
 * pour les fondre dans un `RapportControle` avant `calculerVerdictPropose`
 * — ce dernier n'est jamais modifié : c'est ici, en amont, que le constat
 * environnement devient un écart éliminatoire structurel comme un autre.
 */
export function defautsEnvironnementVersLignes(defauts: DefautEnvironnement[]): LigneRapport[] {
  return defauts.map((d) => ({
    critere: 'environnement',
    sourceControle: 'Photographie réelle / classification ProjectState',
    etat: 'non_conforme',
    ecartObserve: d.details,
    defautEliminatoire: true,
  }))
}

export interface DecisionExport {
  autorise: boolean
  raison?: string
}

/**
 * Garde-fou d'export (PRD §15.3) — la barrière réelle contre le risque #3
 * du prémortem. Ne dépend JAMAIS du verdict proposé, uniquement du verdict
 * humain explicitement enregistré.
 *
 * « Un rendu Non conforme, SUSPENDU ou non contrôlé ne peut pas être
 * exporté comme rendu administratif. Aucun rendu n'est marqué utilisé,
 * validé ou conforme automatiquement. »
 */
export function autoriserExportAdministratif(
  verdictHumain: VerdictControle | null | undefined,
  usageAdministratif: boolean,
): DecisionExport {
  if (!verdictHumain) {
    return { autorise: false, raison: 'Rendu non contrôlé — aucun verdict humain enregistré.' }
  }

  if (verdictHumain === 'production_suspendue') {
    return { autorise: false, raison: 'Production suspendue — export impossible.' }
  }

  if (verdictHumain === 'correction_ciblee' || verdictHumain === 'nouvelle_generation') {
    return { autorise: false, raison: 'Rendu non validé — correction ou reprise requise avant export.' }
  }

  if (usageAdministratif && verdictHumain !== 'validation') {
    // Couvre notamment 'acceptable_avec_reserve' : suffisant pour une
    // présentation, jamais pour un usage administratif (LIB-002 §7).
    return {
      autorise: false,
      raison: 'Un usage administratif exige une Validation sans réserve.',
    }
  }

  return { autorise: true }
}
