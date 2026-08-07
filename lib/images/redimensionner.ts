import type { ImageChargee } from '@/lib/form/types'

export const LARGEUR_MAX = 2048
export const QUALITE_JPEG = 0.92

/**
 * Dimensions de sortie : largeur plafonnee, rapport d'aspect conserve,
 * jamais de montee en resolution. La sortie du moteur etant en 2K,
 * 2048 px de large ne retirent aucune information exploitable.
 */
export function dimensionsCibles(
  largeur: number,
  hauteur: number,
): { largeur: number; hauteur: number } {
  if (largeur <= LARGEUR_MAX) {
    return { largeur: Math.round(largeur), hauteur: Math.round(hauteur) }
  }
  const facteur = LARGEUR_MAX / largeur
  return { largeur: LARGEUR_MAX, hauteur: Math.round(hauteur * facteur) }
}

/**
 * Convertit un fichier choisi par l'utilisateur en data URI JPEG redimensionne.
 * Effectue a la selection du fichier, pas a l'envoi : l'apercu affiche est
 * donc exactement l'image qui partira, et son poids est connu tout de suite.
 */
export async function chargerImage(fichier: File): Promise<ImageChargee> {
  const bitmap = await createImageBitmap(fichier)
  const { largeur, hauteur } = dimensionsCibles(bitmap.width, bitmap.height)

  const canvas = document.createElement('canvas')
  canvas.width = largeur
  canvas.height = hauteur
  const contexte = canvas.getContext('2d')
  if (!contexte) {
    bitmap.close()
    throw new Error("Impossible de preparer l'image : contexte canvas indisponible.")
  }
  contexte.drawImage(bitmap, 0, 0, largeur, hauteur)
  bitmap.close()

  const dataUri = canvas.toDataURL('image/jpeg', QUALITE_JPEG)

  return {
    dataUri,
    nomOrigine: fichier.name,
    largeur,
    hauteur,
    poidsOctets: Math.round((dataUri.length - dataUri.indexOf(',') - 1) * 0.75),
  }
}
