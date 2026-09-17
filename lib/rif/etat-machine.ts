import type { ProjectState } from './project-state'

/**
 * Machine à états déterministe du dossier (PRD V2.1 §17, D-19).
 *
 * Le LLM peut PROPOSER une transition ; seul ce module, appelé côté
 * backend (Route Handler / Server Action), l'applique. Aucune vérification
 * de précondition ne doit être dupliquée ou contournée côté client — voir
 * PRD §11 : « masquer un outil au modèle ne constitue pas à lui seul une
 * protection suffisante. »
 *
 * D-19 : le PRD V2.1 fusionne SOURCES_CONTRÔLÉES et COLLECTE_EN_COURS (deux
 * états du PRD V1.3) en un seul état SOURCES_ANALYSÉES, et renomme
 * FICHE_À_CONFIRMER en CONTEXTE_À_CONFIRMER — 12 états au lieu de 13. Les
 * deux préconditions qui portaient auparavant sur des états distincts
 * (vue Revit exploitable, données confidentielles traitées) portent
 * désormais toutes deux sur l'entrée dans SOURCES_ANALYSÉES.
 *
 * Voir rif-framework/Implementations/RIF-App/DECISIONS.md — D-08, D-19.
 */

export const ETATS_DOSSIER = [
  'BROUILLON',
  'SOURCES_RECUES',
  'SOURCES_ANALYSEES',
  'CONTEXTE_A_CONFIRMER',
  'PRET_A_GENERER',
  'GENERATION_EN_COURS',
  'CONTROLE_A_EXAMINER',
  'VALIDE',
  'A_CORRIGER',
  'A_REPRENDRE',
  'SUSPENDU',
  'ECHEC',
] as const

export type EtatDossier = (typeof ETATS_DOSSIER)[number]

/**
 * Graphe des transitions autorisées.
 *
 * Le tronc nominal (BROUILLON → ... → CONTRÔLE_À_EXAMINER → un des cinq
 * états terminaux) reprend le PRD V2.1 §17 à l'identique. Les transitions de
 * reprise depuis A_CORRIGER / A_REPRENDRE / SUSPENDU / ÉCHEC ne sont PAS
 * explicitement câblées dans le PRD au niveau transition-par-transition :
 * elles sont déduites des contrats d'opérations (§14) et marquées
 * `// inféré` — à confirmer explicitement en Phase 0B, pas à traiter comme
 * acquis au même titre que le tronc nominal.
 */
const TRANSITIONS_AUTORISEES: Record<EtatDossier, EtatDossier[]> = {
  BROUILLON: ['SOURCES_RECUES'],
  SOURCES_RECUES: ['SOURCES_ANALYSEES', 'SUSPENDU'],
  SOURCES_ANALYSEES: ['CONTEXTE_A_CONFIRMER', 'SUSPENDU'],
  CONTEXTE_A_CONFIRMER: ['PRET_A_GENERER', 'SOURCES_ANALYSEES'],
  PRET_A_GENERER: ['GENERATION_EN_COURS'],
  GENERATION_EN_COURS: ['CONTROLE_A_EXAMINER', 'ECHEC'],
  CONTROLE_A_EXAMINER: ['VALIDE', 'A_CORRIGER', 'A_REPRENDRE', 'SUSPENDU'],
  VALIDE: [],
  A_CORRIGER: ['GENERATION_EN_COURS'], // inféré : via corrigerRendu (§14.2)
  A_REPRENDRE: ['SOURCES_ANALYSEES'], // inféré : via reprendreDepuisSources (§14.3)
  SUSPENDU: ['SOURCES_ANALYSEES'], // inféré : reprise après levée du blocage
  ECHEC: ['PRET_A_GENERER'], // inféré : nouvelle tentative traçable (§18.2)
}

export function transitionsPossiblesDepuis(etat: EtatDossier): EtatDossier[] {
  return TRANSITIONS_AUTORISEES[etat]
}

export function transitionEstDansLeGraphe(depuis: EtatDossier, vers: EtatDossier): boolean {
  return TRANSITIONS_AUTORISEES[depuis].includes(vers)
}

export interface ResultatPrecondition {
  autorisee: boolean
  /** Raison de blocage, formulée pour être montrée telle quelle à Évariste
   * (PRD §18.2 : message clair et exploitable, sans détail interne). */
  raison?: string
}

/**
 * Vérifie les préconditions de transition. Combine :
 * - la validité structurelle (la transition existe dans le graphe) ;
 * - les conditions bloquantes listées au PRD §8 : vue Revit absente ou
 *   inexploitable, données confidentielles non traitées, incompatibilité
 *   majeure des caméras pour un usage administratif, information
 *   indispensable inconnue, contradiction avec une source autoritaire,
 *   fiche projet non confirmée, contrôle Non conforme pour un export
 *   administratif.
 *
 * L'accès aux données réelles du dossier (fichiers en base, statut de
 * confirmation explicite d'Évariste, etc.) est injecté par l'appelant via
 * `contexte` plutôt que chargé ici, pour garder cette fonction pure et
 * testable sans dépendance à une base réelle.
 */
export function verifierPrecondition(
  depuis: EtatDossier,
  vers: EtatDossier,
  projectState: ProjectState,
  contexte: {
    vueRevitExploitable?: boolean
    photoSiteFournie?: boolean
    donneesConfidentiellesTraitees?: boolean
    ficheProjetConfirmeeParEvariste?: boolean
    dernierControleQualite?: 'conforme' | 'reserve' | 'non_conforme' | null
    usageAdministratif?: boolean
  } = {},
): ResultatPrecondition {
  if (!transitionEstDansLeGraphe(depuis, vers)) {
    return { autorisee: false, raison: `Transition ${depuis} → ${vers} non prévue.` }
  }

  // PRD §9.1 : la vue Revit est obligatoire pour RIF-App V1.
  if (vers === 'SOURCES_ANALYSEES' && contexte.vueRevitExploitable === false) {
    return { autorisee: false, raison: 'Vue Revit absente ou inexploitable.' }
  }

  // PRD §9.1 : photo de site obligatoire pour un usage administratif.
  if (
    vers === 'SOURCES_ANALYSEES' &&
    contexte.usageAdministratif &&
    contexte.photoSiteFournie === false
  ) {
    return {
      autorisee: false,
      raison: 'Photographie du site requise pour un usage administratif.',
    }
  }

  // D-19 : contrôlée séparément dans le PRD V1.3 (état COLLECTE_EN_COURS
  // distinct) — porte désormais sur SOURCES_ANALYSÉES, l'état fusionné.
  if (vers === 'SOURCES_ANALYSEES' && contexte.donneesConfidentiellesTraitees === false) {
    return { autorisee: false, raison: 'Données confidentielles détectées non traitées.' }
  }

  // PRD §9.4 : action explicite d'Évariste obligatoire pour PRÊT_À_GÉNÉRER.
  if (vers === 'PRET_A_GENERER' && contexte.ficheProjetConfirmeeParEvariste !== true) {
    return { autorisee: false, raison: 'La fiche projet doit être confirmée explicitement.' }
  }

  // Critère d'acceptation §22 : « Une génération est impossible sans
  // ProjectState confirmé. » — la révision doit être non nulle et cohérente.
  if (vers === 'GENERATION_EN_COURS' && (!projectState.revision || projectState.revision < 1)) {
    return { autorisee: false, raison: 'Aucune révision confirmée du ProjectState.' }
  }

  // PRD §15.3 : un rendu Non conforme ne peut pas être exporté comme
  // administratif — ici transposé en blocage de la transition vers VALIDÉ.
  if (
    vers === 'VALIDE' &&
    contexte.usageAdministratif &&
    contexte.dernierControleQualite !== 'conforme'
  ) {
    return {
      autorisee: false,
      raison: 'Contrôle qualité non conforme pour un usage administratif.',
    }
  }

  return { autorisee: true }
}
