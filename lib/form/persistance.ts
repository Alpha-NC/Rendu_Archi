import type { EtatFormulaire, ImagesFormulaire } from './types'

const CLE_SESSION = 'rendu-architectural:formulaire'
const BASE_IDB = 'rendu-architectural'
const MAGASIN = 'images'
const CLE_IMAGES = 'formulaire'

type EtatSansImages = Omit<EtatFormulaire, 'images'>

/**
 * Les champs tiennent largement dans sessionStorage. Les images non :
 * trois vues redimensionnees pesent environ 4 Mo en base64, au-dessus du
 * plafond pratique de 5 Mo, qui echoue en perdant l'ecriture entiere.
 * D'ou le partage entre les deux stockages.
 */
export async function sauvegarderEtat(etat: EtatFormulaire): Promise<void> {
  const { images, ...champs } = etat
  sessionStorage.setItem(CLE_SESSION, JSON.stringify(champs))
  await ecrireImages(images)
}

export async function chargerEtat(): Promise<EtatFormulaire | null> {
  const brut = sessionStorage.getItem(CLE_SESSION)
  if (!brut) return null

  let champs: EtatSansImages
  try {
    champs = JSON.parse(brut) as EtatSansImages
  } catch {
    return null
  }

  const images = await lireImages()
  return { ...champs, images }
}

export async function effacerEtat(): Promise<void> {
  sessionStorage.removeItem(CLE_SESSION)
  await ecrireImages({ cadrage: null, complementaire: null, site: null })
}

function ouvrirBase(): Promise<IDBDatabase> {
  return new Promise((resoudre, rejeter) => {
    const requete = indexedDB.open(BASE_IDB, 1)
    requete.onupgradeneeded = () => {
      requete.result.createObjectStore(MAGASIN)
    }
    requete.onsuccess = () => resoudre(requete.result)
    requete.onerror = () => rejeter(requete.error)
  })
}

async function ecrireImages(images: ImagesFormulaire): Promise<void> {
  const base = await ouvrirBase()
  await new Promise<void>((resoudre, rejeter) => {
    const transaction = base.transaction(MAGASIN, 'readwrite')
    transaction.objectStore(MAGASIN).put(images, CLE_IMAGES)
    transaction.oncomplete = () => resoudre()
    transaction.onerror = () => rejeter(transaction.error)
  })
  base.close()
}

async function lireImages(): Promise<ImagesFormulaire> {
  const vide: ImagesFormulaire = { cadrage: null, complementaire: null, site: null }
  const base = await ouvrirBase()
  const images = await new Promise<ImagesFormulaire>((resoudre) => {
    const transaction = base.transaction(MAGASIN, 'readonly')
    const requete = transaction.objectStore(MAGASIN).get(CLE_IMAGES)
    requete.onsuccess = () => resoudre((requete.result as ImagesFormulaire) ?? vide)
    requete.onerror = () => resoudre(vide)
  })
  base.close()
  return images
}
