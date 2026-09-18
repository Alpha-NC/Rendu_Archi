/**
 * Historique projet / audit trail — RIF V2, Lot 3 (DECISIONS.md D-24).
 *
 * La table `events` (PRD §13.5/§18, 0001) reste la source de vérité,
 * append-only — ce module ne fait qu'y ajouter des références structurées
 * (render_target_id/generation_id/source_id, migration 0004) et une couche
 * d'affichage humain, jamais une réécriture de l'historique existant.
 *
 * Principe legacy (mission Lot 3 §17) : un événement déjà journalisé sans
 * ces références reste tel quel (`null`) — jamais reconstruit
 * artificiellement. Un dossier sans aucun événement affiche un état vide
 * honnête, jamais une activité inventée.
 */

/** Références optionnelles d'un événement — jamais dupliquées dans `payload` (mission §4/§6). */
export interface ReferencesEvenement {
  renderTargetId?: string
  generationId?: string
  sourceId?: string
}

export interface EvenementProjet {
  id: string
  dossierId: string
  eventType: string
  payload: Record<string, unknown>
  actorId: string | null
  renderTargetId: string | null
  generationId: string | null
  sourceId: string | null
  createdAt: string
}

export interface ParametresListeEvenements {
  /** Curseur = id du dernier événement de la page précédente (tri stable par created_at puis id). */
  curseur?: string
  /** 20-50 par défaut (mission §8) — jamais une pagination illimitée. */
  limite?: number
  eventType?: string
  renderTargetId?: string
  generationId?: string
}

export interface PageEvenements {
  events: EvenementProjet[]
  nextCursor: string | null
}

export const LIMITE_EVENEMENTS_DEFAUT = 30
export const LIMITE_EVENEMENTS_MAX = 50

/**
 * Découpe une page de résultats (mission Lot 3 §8 : cursor-based, jamais un
 * offset). Convention : l'appelant SQL demande toujours `limite + 1` lignes
 * — cette fonction ne fait que détecter la ligne en trop et en déduire le
 * curseur suivant, sans jamais retourner cette ligne supplémentaire dans la
 * page elle-même.
 */
export function paginerResultats<T>(lignes: T[], limite: number, obtenirId: (item: T) => string): { page: T[]; nextCursor: string | null } {
  const aUnePageSuivante = lignes.length > limite
  const page = aUnePageSuivante ? lignes.slice(0, limite) : lignes
  const nextCursor = aUnePageSuivante ? obtenirId(page[page.length - 1]!) : null
  return { page, nextCursor }
}

/**
 * Libellés humains (mission §10) — l'API garde toujours `eventType` brut ;
 * cette table ne fait que proposer une phrase pour l'affichage. Un type
 * inconnu (événement futur non encore mappé) retombe sur le code brut
 * plutôt que de planter ou d'afficher un texte inventé.
 */
const LIBELLES_EVENEMENT: Record<string, string> = {
  projet_cree: 'Projet créé',
  source_deposee: 'Source ajoutée',
  source_remplacee: 'Source remplacée',
  modele_3d_depose: 'Modèle 3D ajouté',
  modele_3d_remplace: 'Modèle 3D remplacé',
  temporary_asset_depose: 'Photo terrain ajoutée',
  temporary_asset_supprime: 'Photo terrain supprimée',
  role_source_confirme: 'Rôle de source confirmé',
  directive_confirmee: 'Directive confirmée',
  cible_rendu_creee: 'Cible de rendu créée',
  cible_rendu_activee: 'Cible de rendu activée',
  fiche_projet_mise_a_jour: 'Fiche projet mise à jour',
  fiche_projet_confirmee: 'Fiche projet confirmée',
  parcours_avance: 'Parcours avancé',
  reprise_depuis_sources: 'Reprise depuis les sources',
  generation_reussie: 'Génération réussie',
  generation_echouee: 'Génération échouée',
  controle_qualite_multimodal: 'Contrôle qualité automatique effectué',
  controle_qualite_multimodal_echec: 'Contrôle qualité automatique indisponible',
  audit_qualite_enregistre: 'Verdict qualité enregistré',
  version_canonique_definie: 'Version définie comme référence',
  operation_refusee: 'Action refusée',
}

/**
 * Libellé humain d'un événement — distingue génération initiale/correction
 * (mission §10 : « generation_creee » / « generation_corrigee ») à partir
 * du `type` déjà présent dans le payload de `generation_reussie`/
 * `generation_echouee`, plutôt que d'introduire deux nouveaux `event_type`
 * redondants avec ceux-ci (voir DECISIONS.md D-24 point 1 — décision
 * documentée, pas un oubli).
 */
export function libelleEvenement(evenement: Pick<EvenementProjet, 'eventType' | 'payload'>): string {
  if (evenement.eventType === 'generation_reussie' || evenement.eventType === 'generation_echouee') {
    const type = evenement.payload?.type
    const estCorrection = type === 'correction'
    const estReprise = type === 'restart_from_sources'
    if (evenement.eventType === 'generation_reussie') {
      return estCorrection ? 'Correction générée' : estReprise ? 'Reprise générée' : 'Nouvelle génération créée'
    }
    return estCorrection ? 'Échec de la correction' : estReprise ? 'Échec de la reprise' : 'Échec de la génération'
  }
  if (evenement.eventType === 'audit_qualite_enregistre') {
    const verdict = evenement.payload?.verdictHuman
    if (verdict === 'validation' || verdict === 'acceptable_avec_reserve') return 'Version validée'
    if (verdict === 'production_suspendue') return 'Production suspendue'
    return 'Correction ou reprise demandée'
  }
  return LIBELLES_EVENEMENT[evenement.eventType] ?? evenement.eventType
}
