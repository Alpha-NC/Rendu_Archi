/**
 * Contraintes de dépôt de la source géométrique 3D (RIF V2, geometry-first
 * — voir DECISIONS.md ADR-021). Séparées de `contraintes-source.ts`
 * (images) : un modèle 3D n'est pas une image, pas de type MIME standard
 * fiable, taille potentiellement bien plus grande qu'une photo.
 *
 * Format non figé (§1) : aucune validation par type MIME/extension figée
 * sur `.rvt` — la validation réelle du format appartient à l'extracteur
 * (lib/rif/geometrie-3d.ts::GeometryExtractor.validate), pas ici.
 */

/** 500 Mo — export Revit volumineux ; à ajuster après le rendez-vous Évariste. */
export const TAILLE_MODELE_3D_MAX_OCTETS = 500 * 1024 * 1024

export function validerPathnameModele3D(pathname: string, dossierId: string): void {
  if (!pathname.startsWith(`${dossierId}/modele-3d/`)) {
    throw new Error('Chemin de fichier invalide pour ce dossier.')
  }
}

export interface ContrainteUploadModele3D {
  maximumSizeInBytes: number
  addRandomSuffix: false
  validUntil: number
}

/** Jeton valable 5 minutes — un fichier volumineux peut prendre plus de temps à téléverser qu'une image, laissé large. */
export function construireContrainteUploadModele3D(maintenant: () => number = Date.now): ContrainteUploadModele3D {
  return {
    maximumSizeInBytes: TAILLE_MODELE_3D_MAX_OCTETS,
    addRandomSuffix: false,
    validUntil: maintenant() + 5 * 60 * 1000,
  }
}
