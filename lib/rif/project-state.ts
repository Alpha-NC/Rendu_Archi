/**
 * ProjectState — état projet structuré, source de vérité opérationnelle.
 *
 * Reprend docs/prd-generateur-rendu-v2.md §10 et
 * rif-framework/Exemples/PROJECT_STATE_EXEMPLE.json.
 *
 * Une révision de ProjectState est immuable une fois confirmée : toute
 * modification ultérieure crée une nouvelle révision (jamais une mutation en
 * place de la révision confirmée). Le champ `revision` sur Dossier
 * (colonne `project_state_revision`) est ce qui fait autorité pour savoir
 * quelle révision a servi de base à une génération donnée.
 */

export type StatutValeur = 'provisional' | 'validated' | 'rejected' | 'unknown'

/** Domaine d'autorité applicable à une donnée du ProjectState (PRD §10). */
export type DomaineAutorite =
  | 'source_document'
  | 'utilisateur'
  | 'regle_framework'
  | 'suggestion_profil'
  | 'systeme'

/**
 * Enveloppe commune à toute donnée significative du ProjectState.
 * Voir PRD §10 : « Chaque donnée significative contient, selon son type :
 * value, status, source_id, authority, editable, locked, validated_by,
 * validated_at, notes. »
 */
export interface ValeurTracee<T> {
  value: T
  status: StatutValeur
  source_id?: string
  authority?: DomaineAutorite
  editable: boolean
  locked: boolean
  validated_by?: string
  validated_at?: string
  notes?: string
  /** Confiance de l'extraction automatique, si applicable (0 à 1). */
  confidence?: number
}

/**
 * PRD §9.1 : « Les rôles pris en charge sont au minimum : revit_view,
 * site_photo, axonometry, annotated_source, material_reference,
 * existing_building_photo, render et annotated_render. » Liste complète —
 * ne pas réduire à un sous-ensemble arbitraire.
 */
export type RoleSource =
  | 'revit_view'
  | 'site_photo'
  | 'axonometry'
  | 'annotated_source'
  | 'material_reference'
  | 'existing_building_photo'
  | 'render'
  | 'annotated_render'

export interface SourceDossier {
  id: string
  role_detected: RoleSource
  role_confirmed?: RoleSource
  status: 'valid' | 'invalid' | 'pending'
  /** Élément ciblé si role_confirmed = 'material_reference' (ADR-014 : une
   * référence matériau ne fait autorité que sur l'apparence de l'élément
   * ciblé, jamais sur la géométrie, la caméra ou l'environnement). */
  target?: string
}

/** LIB-006 §2-4 — les trois modes de production, aucun autre n'existe. */
export type ModeProduction = 'retexturation_revit' | 'photomontage_controle' | 'presentation_generative'

/** LIB-005 — les trois styles de rendu actifs (V1.2 en a retiré deux). */
export type StyleRendu = 'photomontage_administratif' | 'presentation_client' | 'commercial'

/**
 * Niveaux de la matrice Contraintes & Libertés (PRD §9.4A, §24A).
 * Ordonnés du plus restrictif au plus permissif — cet ordre est la règle
 * d'arbitrage du §24A.4 : « la propriété la plus restrictive prévaut ».
 */
export const NIVEAUX_POLITIQUE = ['locked', 'strict', 'controlled', 'creative'] as const
export type NiveauPolitique = (typeof NIVEAUX_POLITIQUE)[number]

/** PRD §9.4A : conservation, suppression ou ajout autorisé. */
export type PolitiquePresence = 'conserve' | 'remove_authorized' | 'add_authorized'

/**
 * Politique d'un élément, propriété par propriété (PRD §4 principe 14 :
 * « Une propriété est gouvernée indépendamment de l'objet qui la porte »).
 * Exemple du §9.4A : une piscine peut avoir sa géométrie `locked`, son eau
 * `creative` et son éclairage `controlled`.
 */
export interface PolitiqueElement {
  geometry_policy?: NiveauPolitique
  material_policy?: NiveauPolitique
  lighting_policy?: NiveauPolitique
  appearance_policy?: NiveauPolitique
  presence_policy?: PolitiquePresence
  /** Source faisant autorité pour la propriété concernée. */
  source_authority?: string
  freedom_level?: NiveauPolitique
  /** Zone ou sous-partie concernée. */
  scope?: string
  authorized_by?: string
  authorized_at?: string
}

/** Propriétés gouvernables par la matrice. */
export const PROPRIETES_POLITIQUE = [
  'geometry_policy',
  'material_policy',
  'lighting_policy',
  'appearance_policy',
] as const
export type ProprietePolitique = (typeof PROPRIETES_POLITIQUE)[number]

export type ActionDirective = 'preserve' | 'modify' | 'remove' | 'clarify'

/**
 * Directive localisée — conversion obligatoire de toute annotation en
 * directive structurée (ADR-015). Une annotation brute n'est jamais transmise
 * telle quelle au moteur d'image.
 */
export interface DirectiveLocalisee {
  source_id: string
  action: ActionDirective
  target: string
  status: StatutValeur
  /** Une marque d'annotation ne doit jamais apparaître dans le rendu. */
  remove_annotation_from_output: true
  consigne?: string
  zone_ou_masque?: string
}

export interface ProjectState {
  project_id: string
  /** Révision immuable — incrémentée à chaque nouvelle confirmation. */
  revision: number
  usage: Array<'presentation_client' | 'insertion_administrative' | string>
  sources: SourceDossier[]
  // PRD §9.2 : quatre valeurs, pas trois — corrigé ici (la valeur
  // 'A verifier' initiale ne couvrait pas la distinction Approximative.
  camera_compatibility: 'Compatible' | 'Approximative' | 'Incompatible' | 'Non evaluee'
  mode?: ModeProduction
  style?: StyleRendu
  /** Géométrie décrite et implantation — texte libre structuré en Phase 0B. */
  geometrie?: ValeurTracee<string>
  implantation?: ValeurTracee<string>
  zone_intervention?: ValeurTracee<string>
  /** Matériaux par élément, avec provenance et confiance (PRD §10). */
  materials: Record<string, ValeurTracee<string>>
  localized_directives: DirectiveLocalisee[]
  /** Environnement à conserver, en plus des zones verrouillées. */
  environnement_a_conserver?: string[]
  /**
   * Matrice Contraintes & Libertés par élément (PRD §9.4A, §10).
   * Absente = aucune liberté accordée : le défaut est la fidélité stricte
   * (§7.3 : « La liberté créative n'est jamais implicite »).
   */
  contraintes_libertes?: Record<string, PolitiqueElement>
  /** Opérations autorisées dans l'état courant (préconditions backend). */
  operations_autorisees?: Array<'genererRendu' | 'corrigerRendu' | 'reprendreDepuisSources'>
  lumiere?: ValeurTracee<string>
  locked: string[]
  interdictions?: string[]
  reserves?: string[]
  variant_count: number
  canonical_result_id: string | null
}

/** ProjectState vide, point de départ d'un dossier en BROUILLON. */
export function creerProjectStateVide(projectId: string): ProjectState {
  return {
    project_id: projectId,
    revision: 0,
    usage: [],
    sources: [],
    camera_compatibility: 'Non evaluee',
    materials: {},
    localized_directives: [],
    locked: [],
    variant_count: 0,
    canonical_result_id: null,
  }
}
