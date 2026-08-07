import type { EtatFormulaire, ImagesFormulaire } from './types'

const CLE_SESSION = 'rendu-architectural:formulaire'
const BASE_IDB = 'rendu-architectural'
const MAGASIN = 'images'
const CLE_IMAGES = 'formulaire'

const IMAGES_VIDES: ImagesFormulaire = {
  cadrage: null,
  complementaire: null,
  site: null,
}

/**
 * Champs persistes, enumeres explicitement plutot que derives par
 * `Omit<EtatFormulaire, 'images'>`. Un futur champ lourd — l'image generee,
 * un calque d'annotation — atterrirait sinon en silence dans sessionStorage,
 * depasserait le plafond, et `setItem` echouerait en perdant l'ecriture
 * entiere. Ici, tout nouveau champ est exclu par defaut : l'inclure est une
 * decision.
 */
const CHAMPS_PERSISTES = [
  'etape',
  'etapeMax',
  'reference',
  'typeProjet',
  'usage',
  'typeCadrage',
  'elementsAPreserver',
  'materiaux',
  'conserverVegetation',
  'aspectPelouse',
  'elementsARetirer',
  'ciel',
  'cielChoisiManuellement',
  'eclairages',
  'style',
  'styleChoisiManuellement',
  'precisions',
] as const

type ChampPersiste = (typeof CHAMPS_PERSISTES)[number]
type EtatSansImages = Pick<EtatFormulaire, ChampPersiste>

/** Derniere reference d'images ecrite, pour ne pas les reecrire pour rien. */
let dernieresImages: ImagesFormulaire | null = null

/**
 * Les champs tiennent largement dans sessionStorage. Les images non :
 * trois vues redimensionnees pesent environ 4 Mo en base64, au-dessus du
 * plafond pratique de 5 Mo, qui echoue en perdant l'ecriture entiere.
 * D'ou le partage entre les deux stockages.
 *
 * Les images sont ecrites en premier, et seulement si leur reference a
 * change. L'ordre importe : sessionStorage commite des l'appel alors que
 * l'ecriture IndexedDB dure. Une interruption dans cette fenetre laisserait
 * sinon des champs en avance sur les images — un etat qui pretend etre a
 * l'etape 5 sans vue de cadrage, que `normaliser` « reparerait » en changeant
 * silencieusement le style de l'utilisateur. Un etat en retard est inoffensif,
 * un etat incoherent ne l'est pas.
 *
 * `normaliser` preserve l'identite de `etat.images` pour toute action autre
 * qu'un changement d'image : la comparaison par reference evite donc de
 * reecrire 3 Mo a chaque frappe dans un champ texte.
 */
export async function sauvegarderEtat(etat: EtatFormulaire): Promise<void> {
  const { images } = etat
  if (images !== dernieresImages) {
    await ecrireImages(images)
    dernieresImages = images
  }
  const champs = {} as Record<string, unknown>
  for (const champ of CHAMPS_PERSISTES) champs[champ] = etat[champ]
  sessionStorage.setItem(CLE_SESSION, JSON.stringify(champs))
}

/**
 * Un echec de restauration n'est jamais bloquant : on repart d'un etat
 * vierge. Le stockage peut etre indisponible — navigation privee, politique
 * d'entreprise, quota sature — et l'application doit demarrer quand meme.
 */
export async function chargerEtat(): Promise<EtatFormulaire | null> {
  let brut: string | null
  try {
    brut = sessionStorage.getItem(CLE_SESSION)
  } catch {
    return null
  }
  if (!brut) {
    // Les images survivent a la fermeture de l'onglet, pas les champs.
    // Sans ce nettoyage, jusqu'a 3 Mo de photos du site resteraient sur le
    // poste indefiniment, sans aucun ecran pour les effacer.
    await effacerEtat().catch(() => undefined)
    return null
  }

  let champs: EtatSansImages
  try {
    champs = JSON.parse(brut) as EtatSansImages
  } catch {
    return null
  }

  let images: ImagesFormulaire
  try {
    images = await lireImages()
  } catch {
    images = { ...IMAGES_VIDES }
  }

  // Garde-fou contre un etat malgre tout dechire : pretendre avoir depasse
  // l'etape 2 sans vue de cadrage n'est pas atteignable normalement.
  const sansCadrage = images.cadrage === null
  return {
    ...champs,
    images,
    etape: sansCadrage && champs.etape > 2 ? 2 : champs.etape,
    etapeMax: sansCadrage && champs.etapeMax > 2 ? 2 : champs.etapeMax,
  }
}

export async function effacerEtat(): Promise<void> {
  sessionStorage.removeItem(CLE_SESSION)
  await ecrireImages({ ...IMAGES_VIDES })
  dernieresImages = null
}

function ouvrirBase(): Promise<IDBDatabase> {
  return new Promise((resoudre, rejeter) => {
    const requete = indexedDB.open(BASE_IDB, 1)
    requete.onupgradeneeded = () => {
      requete.result.createObjectStore(MAGASIN)
    }
    requete.onsuccess = () => resoudre(requete.result)
    requete.onerror = () => rejeter(requete.error)
    // Sans ce gestionnaire, un futur changement de version bloque par une
    // connexion restee ouverte ne resoudrait ni ne rejetterait jamais :
    // l'application se figerait au montage, sans erreur.
    requete.onblocked = () =>
      rejeter(new Error('Le stockage local est occupé par un autre onglet.'))
  })
}

async function ecrireImages(images: ImagesFormulaire): Promise<void> {
  const base = await ouvrirBase()
  try {
    await new Promise<void>((resoudre, rejeter) => {
      const transaction = base.transaction(MAGASIN, 'readwrite')
      transaction.objectStore(MAGASIN).put(images, CLE_IMAGES)
      transaction.oncomplete = () => resoudre()
      transaction.onerror = () => rejeter(transaction.error)
    })
  } finally {
    base.close()
  }
}

async function lireImages(): Promise<ImagesFormulaire> {
  const base = await ouvrirBase()
  try {
    return await new Promise<ImagesFormulaire>((resoudre) => {
      const transaction = base.transaction(MAGASIN, 'readonly')
      const requete = transaction.objectStore(MAGASIN).get(CLE_IMAGES)
      requete.onsuccess = () =>
        resoudre((requete.result as ImagesFormulaire) ?? { ...IMAGES_VIDES })
      requete.onerror = () => resoudre({ ...IMAGES_VIDES })
    })
  } finally {
    base.close()
  }
}
