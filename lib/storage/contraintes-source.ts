/**
 * Contraintes de dépôt d'une source (PRD V2.1 §16.1, D-19) — pures, sans
 * import de `@vercel/blob` : ce module est importable depuis le navigateur
 * (`DepotSources.tsx`) sans embarquer le SDK serveur dans le bundle client.
 *
 * Utilisé par les deux bouts de l'upload direct navigateur → Vercel Blob :
 * `.../sources/token/route.ts` (contraint le jeton avant de l'émettre) et
 * `.../sources/route.ts` (revérifie après lecture du blob, défense en
 * profondeur — jamais la déclaration du client).
 */

export const MIME_SOURCES_ACCEPTEES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const

export const TAILLE_SOURCE_MAX_OCTETS = 25 * 1024 * 1024

/**
 * Un pathname doit rester dans le dossier pour lequel le jeton a été
 * demandé (noms/pathnames contrôlés) — sinon un utilisateur authentifié
 * pourrait écrire dans le dossier d'un autre en falsifiant le pathname.
 */
export function validerPathnameSource(pathname: string, dossierId: string): void {
  if (!pathname.startsWith(`${dossierId}/sources/`)) {
    throw new Error('Chemin de fichier invalide pour ce dossier.')
  }
}

export interface ContrainteUploadSource {
  allowedContentTypes: string[]
  maximumSizeInBytes: number
  addRandomSuffix: false
  validUntil: number
}

/** Jeton valable 5 minutes — largement suffisant pour un dépôt immédiat. */
export function construireContrainteUploadSource(maintenant: () => number = Date.now): ContrainteUploadSource {
  return {
    allowedContentTypes: [...MIME_SOURCES_ACCEPTEES],
    maximumSizeInBytes: TAILLE_SOURCE_MAX_OCTETS,
    addRandomSuffix: false,
    validUntil: maintenant() + 5 * 60 * 1000,
  }
}
