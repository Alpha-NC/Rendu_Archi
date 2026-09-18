/**
 * Contraintes de dépôt des TEMPORARY_PROJECT_ASSETS (photos terrain en
 * volume — PRD Geometry-First §15, DECISIONS.md D-23). Mêmes principes que
 * `contraintes-source.ts` : pures, sans import de `@vercel/blob`,
 * partagées par le jeton d'upload et la relecture après upload.
 *
 * Évariste peut fournir 40 à 50 photos, 8 à 10 Mo chacune — la limite par
 * fichier reste généreuse au-delà de ce besoin confirmé (mission Lot 2
 * §14 : « ne mets pas une limite arbitraire inférieure aux besoins
 * confirmés »). Aucune limite de NOMBRE de fichiers imposée côté serveur —
 * le multi-upload raisonnable (concurrence limitée) est une responsabilité
 * du client (DepotSources.tsx), pas une validation métier.
 */

export const MIME_TEMPORARY_ASSETS_ACCEPTES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const

export const TAILLE_TEMPORARY_ASSET_MAX_OCTETS = 20 * 1024 * 1024

export function validerPathnameTemporaryAsset(pathname: string, dossierId: string): void {
  if (!pathname.startsWith(`${dossierId}/temporary-assets/`)) {
    throw new Error('Chemin de fichier invalide pour ce dossier.')
  }
}

export interface ContrainteUploadTemporaryAsset {
  allowedContentTypes: string[]
  maximumSizeInBytes: number
  addRandomSuffix: false
  validUntil: number
}

export function construireContrainteUploadTemporaryAsset(
  maintenant: () => number = Date.now,
): ContrainteUploadTemporaryAsset {
  return {
    allowedContentTypes: [...MIME_TEMPORARY_ASSETS_ACCEPTES],
    maximumSizeInBytes: TAILLE_TEMPORARY_ASSET_MAX_OCTETS,
    addRandomSuffix: false,
    validUntil: maintenant() + 5 * 60 * 1000,
  }
}
