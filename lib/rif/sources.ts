import type { RoleSource } from './project-state'

/**
 * Cycle de vie des sources — RIF V2, Lot 2 (DECISIONS.md D-23).
 *
 * Quatre rôles PRINCIPAUX ont une identité unique par dossier : au plus une
 * version ACTIVE à la fois, un dépôt ultérieur du même rôle est un
 * remplacement (versionné, historisé), jamais un doublon silencieux. Les
 * autres rôles (`material_reference`, `annotated_source`,
 * `existing_building_photo`, `render`, `annotated_render`) restent
 * multi-valués par nature — jamais soumis à cette contrainte.
 *
 * Réutilise `RoleSource` (project-state.ts) tel quel — aucun renommage,
 * aucun synonyme parallèle introduit (mission Lot 2 §3 : « ne multiplie pas
 * les synonymes entre frontend, backend et DB »).
 */
export const ROLES_PRINCIPAUX: RoleSource[] = ['model_3d', 'revit_view', 'site_photo', 'axonometry']

export function estRolePrincipal(role: RoleSource): boolean {
  return ROLES_PRINCIPAUX.includes(role)
}

/**
 * Statuts de CYCLE DE STOCKAGE d'un fichier — volontairement distincts du
 * cycle de vie geometry-first (`SourceModele3D.extractionStatus`,
 * `UPLOADED`/`EXTRACTING`/`EXTRACTED`/...). Un fichier peut être `active`
 * (version courante), `replaced` (remplacé par une version plus récente,
 * conservé pour l'historique) ou `deleted` (suppression logique — jamais
 * appliqué aux sources principales dans ce lot, voir DECISIONS.md D-23).
 *
 * Pas d'état `uploading`/`failed` ici : une ligne `files` n'existe qu'une
 * fois l'upload Blob terminé avec succès (architecture actuelle,
 * inchangée) — ajouter ces états inventerait un suivi que le système ne
 * produit pas réellement.
 */
export const STATUTS_SOURCE = ['active', 'replaced', 'deleted'] as const
export type StatutSource = (typeof STATUTS_SOURCE)[number]

export interface FichierSourceDetail {
  id: string
  dossierId: string
  roleDetected: RoleSource
  roleConfirmed: RoleSource | null
  originalName: string
  storageKey: string
  mimeType: string | null
  sizeBytes: number | null
  version: number
  sourceStatus: StatutSource
  replacedAt: string | null
  replacedByFileId: string | null
  createdAt: string
}

export interface ParametresRemplacementSource {
  dossierId: string
  ancienFileId: string
  roleDetecte: RoleSource
  originalName: string
  storageKey: string
  mimeType: string
  sizeBytes: number
}

/**
 * Assets temporaires (photos terrain, PRD Geometry-First §15) — domaine
 * séparé de `FichierSourceDetail` : pas de rôle, pas de version, pas de
 * remplacement. `expiresAt` reste informatif — aucune purge automatique
 * n'est implémentée (mission Lot 2 §11).
 */
export interface TemporaryAssetDetail {
  id: string
  dossierId: string
  originalName: string
  storageKey: string
  mimeType: string | null
  sizeBytes: number | null
  createdAt: string
  expiresAt: string | null
}

export interface ParametresNouvelAssetTemporaire {
  dossierId: string
  originalName: string
  storageKey: string
  mimeType: string
  sizeBytes: number
}
