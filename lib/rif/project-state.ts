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

import type { AlignementCameraPhoto, GeometryConstraintPack, SourceModele3D } from './geometrie-3d'

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
 *
 * `model_3d` ajouté pour RIF V2 (workflow geometry-first, DECISIONS.md
 * ADR-021) : la source géométrique 3D fait autorité sur l'architecture —
 * voir lib/rif/geometrie-3d.ts. Format non figé (RVT candidat principal,
 * IFC/OBJ/FBX possibles) — ce rôle ne présume aucun format précis.
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
  | 'model_3d'

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

/**
 * LIB-006 V1.6 §1 — les trois modes de production, aucun autre n'existe.
 * `presentation_generative` a disparu (D-19/ADR-019, PRD V2.1 §8 : « RIF V2
 * distingue trois modes ») : `retexturation_contextualisee` prend sa place
 * comme mode principal du cas standard, avec un modèle d'environnement
 * qualifié (`ElementEnvironnement` ci-dessous) là où l'ancien mode ne
 * définissait qu'une « harmonisation dans les limites validées » non
 * qualifiée. Aucune compatibilité legacy conservée : ce mode n'a jamais eu
 * de dossier réel en production (D-19, audit du 12.09.2026).
 */
export type ModeProduction = 'retexturation_revit' | 'retexturation_contextualisee' | 'photomontage_controle'

/**
 * LIB-005 V1.6 — les trois styles de rendu actifs (V1.2 en a retiré deux).
 * Nomenclature harmonisée sur le PRD V2.1 §9 (D-19/ADR-020) :
 * `photomontage_administratif` → `administratif_sobre`, `presentation_client`
 * → `presentation_naturelle`. Renommage seul, aucune caractéristique de
 * style modifiée. Ne pas confondre avec `ProjectState.usage`, qui porte
 * une valeur `presentation_client` distincte (axe usage, pas style) —
 * ADR-020 le documente explicitement pour éviter un renommage par réflexe.
 */
export type StyleRendu = 'presentation_naturelle' | 'administratif_sobre' | 'commercial'

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

/** PRD §9.2, ADR-015 : les cinq types de directive issues d'une annotation — aucun autre n'existe. */
export const ACTIONS_DIRECTIVE = ['conserver', 'supprimer', 'remplacer', 'corriger', 'verrouiller'] as const
export type ActionDirective = (typeof ACTIONS_DIRECTIVE)[number]

/**
 * Directive localisée — conversion obligatoire de toute annotation en
 * directive structurée (ADR-015). Une annotation brute n'est jamais transmise
 * telle quelle au moteur d'image.
 */
export interface DirectiveLocalisee {
  /** Identifiant stable (source + rang d'extraction) — nécessaire pour confirmer une directive individuellement. */
  id: string
  source_id: string
  action: ActionDirective
  target: string
  status: StatutValeur
  /** Une marque d'annotation ne doit jamais apparaître dans le rendu. */
  remove_annotation_from_output: true
  consigne?: string
  zone_ou_masque?: string
}

/**
 * Modèle d'environnement — ARCH-002, REF-002 §7 (V1.6), PRD V2.1 §4.4/§10.4.
 *
 * Distinct de `contraintes_libertes` (D-19, décision documentée) : ce
 * modèle gouverne exclusivement les éléments de CONTEXTE (terrain,
 * végétation, clôtures, voisinage, horizon...), jamais les éléments
 * architecturaux du projet — ceux-ci restent régis par `contraintes_libertes`
 * (propriétés geometry/material/lighting/appearance) et par le mode de
 * production. Les deux modèles coexistent sans se substituer l'un à
 * l'autre ; voir le commentaire d'en-tête de contraintes-libertes.ts.
 */
export const ETATS_ELEMENT_ENVIRONNEMENT = ['locked', 'editable', 'harmonizable'] as const
export type EtatElementEnvironnement = (typeof ETATS_ELEMENT_ENVIRONNEMENT)[number]

/**
 * Élément d'environnement identifié (typiquement sur la photographie
 * réelle en Retexturation contextualisée). Sémantique obligatoire
 * (ARCH-002) :
 * - `locked` : conserver l'identité, la position et l'aspect pertinent ;
 * - `editable` : suppression, remplacement ou transformation autorisés,
 *   mais seulement sur décision explicite (`action_attendue` renseignée
 *   ET `validation: 'validated'`) — une absence de décision ne vaut
 *   jamais autorisation ;
 * - `harmonizable` : amélioration visuelle locale autorisée sans changer
 *   l'identité générale du site, jamais une suppression ou un remplacement.
 */
export interface ElementEnvironnement {
  id: string
  /** Nature de l'élément, ex. 'cloture', 'vegetation', 'batiment_voisin'. */
  type: string
  etat: EtatElementEnvironnement
  /** Action décidée par l'utilisateur pour un élément editable/harmonizable. */
  action_attendue?: string
  /** Source ayant permis d'identifier cet élément (ex. id de la photo réelle). */
  source?: string
  /** Confiance de la détection automatique, entre 0 et 1, si applicable. */
  confiance?: number
  /**
   * Statut de validation humaine de CETTE classification — distinct de
   * `etat` : un élément peut être classé `editable` par proposition du
   * modèle tout en restant `validation: 'provisional'` tant qu'Évariste ne
   * l'a pas confirmé (même doctrine que §24A.3 pour `contraintes_libertes` :
   * une classification proposée reste sans effet sur la génération tant
   * qu'elle n'est pas validée — voir contraintes-libertes.ts::etatEffectifEnvironnement).
   */
  validation?: StatutValeur
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
  /** Éléments de contexte classés locked/editable/harmonizable (ARCH-002). */
  environnement: ElementEnvironnement[]
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
  /**
   * RIF V2, workflow geometry-first (DECISIONS.md ADR-021) — voir
   * lib/rif/geometrie-3d.ts pour le domaine complet. Absents tant que le
   * dossier n'a pas encore de source géométrique 3D ou que l'extraction
   * n'a pas encore tourné — jamais une valeur inventée par défaut.
   */
  modele3D?: SourceModele3D
  geometryPack?: GeometryConstraintPack
  alignment?: AlignementCameraPhoto
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
    environnement: [],
    locked: [],
    variant_count: 0,
    canonical_result_id: null,
  }
}
