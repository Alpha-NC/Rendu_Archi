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
 * Poids du JPEG decode, deduit de la longueur base64.
 * Surestime de 0 a 2 octets a cause du remplissage, negligeable pour un
 * affichage. Attention : c'est le poids de l'image, pas celui transmis —
 * le corps de la requete transporte la forme base64, environ 1,33 fois plus
 * lourde. Ne pas s'en servir pour un garde-fou de taille de requete.
 */
export function poidsDataUri(dataUri: string): number {
  const debut = dataUri.indexOf(',')
  if (debut === -1) return 0
  return Math.round((dataUri.length - debut - 1) * 0.75)
}

/**
 * Convertit un fichier choisi par l'utilisateur en data URI JPEG redimensionne.
 * Effectue a la selection du fichier, pas a l'envoi : l'apercu affiche est
 * donc exactement l'image qui partira, et son poids est connu tout de suite.
 */
export async function chargerImage(fichier: File): Promise<ImageChargee> {
  const bitmap = await createImageBitmap(fichier)
  const { largeur, hauteur } = dimensionsCibles(bitmap.width, bitmap.height)

  let dataUri: string
  try {
    const canvas = document.createElement('canvas')
    canvas.width = largeur
    canvas.height = hauteur
    const contexte = canvas.getContext('2d')
    if (!contexte) {
      throw new Error("Impossible de preparer l'image : contexte canvas indisponible.")
    }
    contexte.drawImage(bitmap, 0, 0, largeur, hauteur)
    dataUri = canvas.toDataURL('image/jpeg', QUALITE_JPEG)
  } finally {
    bitmap.close()
  }

  // Un canvas trop grand fait rendre « data:, » sans lever : sans ce garde,
  // une image vide partirait vers le moteur de generation.
  if (!dataUri.startsWith('data:image/jpeg')) {
    throw new Error("Cette image est trop grande pour etre preparee.")
  }

  return {
    dataUri,
    nomOrigine: fichier.name,
    largeur,
    hauteur,
    poidsOctets: poidsDataUri(dataUri),
  }
}
