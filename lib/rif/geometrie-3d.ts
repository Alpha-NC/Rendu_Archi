/**
 * Domaine géométrie-first (RIF V2 — voir DECISIONS.md, ADR-021 dans le
 * Framework). Nouvelle logique produit : une source géométrique 3D fait
 * autorité sur l'architecture, le moteur d'image la photoréalise sans la
 * redessiner (« RIF fournit l'architecture, l'IA la photoréalise »).
 *
 * IMPORTANT — format non figé : le candidat principal est RVT, mais rien
 * ici ne doit supposer ce format précis. Le concept porté est
 * SOURCE_MODELE_3D, `format` reste une chaîne ouverte (RVT/IFC/OBJ/FBX/
 * autre) — jamais une union fermée sur `.rvt` (décision reportée au
 * rendez-vous Évariste, ADR-021).
 */

// =========================================================================
// Autorité des sources (§3 de la mission geometry-first)
// =========================================================================

/**
 * Autorité de chaque type de source — jamais implicite, jamais devinée.
 * Un rôle absent de cette table n'a AUCUNE autorité géométrique/environnement
 * particulière (comportement conservateur par défaut, cohérent avec
 * `contraintes-libertes.ts` : absent = locked).
 */
export const AUTORITE_PAR_ROLE_SOURCE: Record<string, string> = {
  model_3d: 'GEOMETRIE',
  revit_view: 'CADRAGE_INTENTIONNEL',
  site_photo: 'ENVIRONNEMENT',
  axonometry: 'CONTROLE_SPATIAL_SECONDAIRE',
}

export function obtenirAutoriteSource(role: string): string | undefined {
  return AUTORITE_PAR_ROLE_SOURCE[role]
}

// =========================================================================
// Source modèle 3D (§5)
// =========================================================================

/** Format ouvert — jamais une union fermée figée sur un format précis (§1). */
export type FormatModele3D = string

export const STATUTS_EXTRACTION = [
  'UPLOADED',
  'VALIDATING',
  'READY_FOR_EXTRACTION',
  'EXTRACTING',
  'EXTRACTED',
  'FAILED',
  'UNSUPPORTED',
] as const
export type StatutExtraction = (typeof STATUTS_EXTRACTION)[number]

export interface SourceModele3D {
  /** Référence à la ligne `files` correspondante — aucun binaire ici. */
  fileId: string
  format: FormatModele3D
  mimeType?: string
  extractionStatus: StatutExtraction
  extractionProvider?: string
  version?: string
  metadata?: Record<string, unknown>
  /** Ids de fichiers dérivés produits par l'extraction (geometry.json, camera.json, masques...) — jamais supposés présents avant EXTRACTED. */
  artifactFileIds: string[]
  erreur?: string
}

export function creerSourceModele3D(fileId: string, format: FormatModele3D, mimeType?: string): SourceModele3D {
  return { fileId, format, mimeType, extractionStatus: 'UPLOADED', artifactFileIds: [] }
}

// =========================================================================
// GeometryConstraintPack (§7) — versionné, extensible, rien d'inventé
// =========================================================================

export const GEOMETRY_PACK_SCHEMA_VERSION = 1

/**
 * Aucune de ces propriétés n'est obligatoire — le pack est rempli
 * progressivement par l'extracteur réel, jamais halluciné ici. Un champ
 * absent signifie « pas encore extrait », jamais « vide de contenu ».
 */
export interface GeometryConstraintPack {
  schemaVersion: number
  sourceFileId: string
  coordinateSystem?: string
  modelBounds?: Record<string, number>
  levels?: unknown[]
  volumes?: unknown[]
  roofs?: unknown[]
  openings?: unknown[]
  slabs?: unknown[]
  pools?: unknown[]
  annexes?: unknown[]
  sitePlacement?: unknown
  cameraData?: unknown
  /** Id de fichier (silhouette projetée) — un artefact dérivé, jamais un binaire inline. */
  projectedSilhouetteFileId?: string
  maskFileIds?: string[]
  depthMapFileId?: string
  semanticSegmentationFileId?: string
  lockedZones?: string[]
  editableZones?: string[]
}

export function creerGeometryPackVide(sourceFileId: string): GeometryConstraintPack {
  return { schemaVersion: GEOMETRY_PACK_SCHEMA_VERSION, sourceFileId }
}

// =========================================================================
// Alignement caméra / photo (§9)
// =========================================================================

export const STATUTS_ALIGNEMENT = ['NOT_STARTED', 'PROCESSING', 'ALIGNED', 'REVIEW_REQUIRED', 'FAILED'] as const
export type StatutAlignement = (typeof STATUTS_ALIGNEMENT)[number]

export interface AlignementCameraPhoto {
  sourceCameraFileId: string
  targetPhotoFileId: string
  status: StatutAlignement
  confidence?: number
  transformation?: unknown
  observations?: string
  raisonEchec?: string
}

/** Sous ce seuil, l'alignement exige une revue humaine — jamais accepté silencieusement. */
export const SEUIL_CONFIANCE_ALIGNEMENT = 0.7

export function evaluerAlignement(confidence: number | undefined): StatutAlignement {
  if (confidence === undefined) return 'PROCESSING'
  return confidence >= SEUIL_CONFIANCE_ALIGNEMENT ? 'ALIGNED' : 'REVIEW_REQUIRED'
}

// =========================================================================
// Abstraction extracteur géométrique (§6) — aucun provider choisi ici
// =========================================================================

export const EXTRACTION_PROVIDER_NOT_CONFIGURED = 'EXTRACTION_PROVIDER_NOT_CONFIGURED'

export interface JobExtraction {
  id: string
  sourceFileId: string
  statut: StatutExtraction
}

export interface ResultatExtraction {
  statut: 'EXTRACTED' | 'FAILED' | 'UNSUPPORTED'
  geometryPack?: GeometryConstraintPack
  artifactFileIds?: string[]
  message?: string
}

/**
 * Contrat provider-agnostique — ne présuppose ni Autodesk Model Derivative,
 * ni Revit Automation, ni un parseur IFC (décision reportée, ADR-021).
 * Brancher un vrai provider = implémenter cette interface, rien d'autre.
 */
export interface GeometryExtractor {
  supports(format: FormatModele3D): boolean
  validate(source: { fileId: string; format: FormatModele3D }): Promise<{ valide: boolean; raison?: string }>
  extract(source: { fileId: string; format: FormatModele3D }): Promise<JobExtraction>
  getStatus(job: JobExtraction): Promise<StatutExtraction>
  retrieveArtifacts(job: JobExtraction): Promise<ResultatExtraction>
}

/**
 * Implémentation par défaut tant qu'aucun fournisseur réel n'est choisi.
 * Ne simule JAMAIS un résultat géométrique — répond honnêtement
 * EXTRACTION_PROVIDER_NOT_CONFIGURED à chaque opération, y compris
 * `validate` (jamais un `valide: true` de complaisance).
 */
export function creerExtracteurNonConfigure(): GeometryExtractor {
  return {
    supports() {
      return false
    },
    async validate() {
      return { valide: false, raison: EXTRACTION_PROVIDER_NOT_CONFIGURED }
    },
    async extract() {
      throw new Error(EXTRACTION_PROVIDER_NOT_CONFIGURED)
    },
    async getStatus() {
      throw new Error(EXTRACTION_PROVIDER_NOT_CONFIGURED)
    },
    async retrieveArtifacts() {
      return { statut: 'FAILED', message: EXTRACTION_PROVIDER_NOT_CONFIGURED }
    },
  }
}

// =========================================================================
// Catégories de correction (§15) — préservent la géométrie par construction
// =========================================================================

export const CATEGORIES_CORRECTION = [
  'MATERIAL',
  'LIGHTING',
  'VEGETATION',
  'LOCAL_ENVIRONMENT',
  'ARTIFACT_REMOVAL',
  'MINOR_PRESENTATION',
] as const
export type CategorieCorrection = (typeof CATEGORIES_CORRECTION)[number]

export function estCategorieCorrectionValide(categorie: string): categorie is CategorieCorrection {
  return (CATEGORIES_CORRECTION as readonly string[]).includes(categorie)
}
