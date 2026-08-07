import { beforeEach, describe, expect, it } from 'vitest'
import {
  chargerEtat,
  effacerEtat,
  sauvegarderEtat,
} from './persistance'
import { etatInitial } from './etat-initial'
import type { EtatFormulaire, ImageChargee } from './types'

const image: ImageChargee = {
  dataUri: 'data:image/jpeg;base64,AAAA',
  nomOrigine: 'vue.jpg',
  largeur: 2048,
  hauteur: 1536,
  poidsOctets: 1000,
}

const etat: EtatFormulaire = {
  ...etatInitial,
  etape: 4,
  etapeMax: 5,
  reference: '2026-042',
  typeProjet: 'pool_house',
  usage: 'les_deux',
  typeCadrage: 'perspective',
  images: { cadrage: image, complementaire: null, site: image },
  elementsAPreserver: 'muret en pierre',
  ciel: 'crepuscule',
  cielChoisiManuellement: true,
  style: 'commercial',
  styleChoisiManuellement: true,
}

beforeEach(async () => {
  sessionStorage.clear()
  await effacerEtat()
})

describe('persistance', () => {
  it('restitue un etat complet, images comprises', async () => {
    await sauvegarderEtat(etat)
    const restaure = await chargerEtat()
    expect(restaure).toEqual(etat)
  })

  it('rend null quand rien n a ete sauvegarde', async () => {
    expect(await chargerEtat()).toBeNull()
  })

  it('rend null quand les champs sont illisibles', async () => {
    sessionStorage.setItem('rendu-architectural:formulaire', 'ceci-n-est-pas-du-json')
    expect(await chargerEtat()).toBeNull()
  })

  it('restitue un etat sans image en ramenant l etape a 2', async () => {
    const sansImage: EtatFormulaire = {
      ...etat,
      images: { cadrage: null, complementaire: null, site: null },
    }
    await sauvegarderEtat(sansImage)
    expect(await chargerEtat()).toEqual({ ...sansImage, etape: 2, etapeMax: 2 })
  })

  it('n ecrit pas les images quand seul un champ change', async () => {
    await sauvegarderEtat(etat)
    // Meme reference d'images, champ modifie : l'ecriture lourde est evitee
    // mais la restitution reste complete.
    await sauvegarderEtat({ ...etat, precisions: 'ajout tardif' })
    const restaure = await chargerEtat()
    expect(restaure?.precisions).toBe('ajout tardif')
    expect(restaure?.images).toEqual(etat.images)
  })

  it('efface les images orphelines quand les champs ont disparu', async () => {
    await sauvegarderEtat(etat)
    const champs = sessionStorage.getItem('rendu-architectural:formulaire')
    sessionStorage.clear()

    expect(await chargerEtat()).toBeNull()

    // On remet les champs tels quels : les images doivent avoir ete nettoyees
    // par le chargement precedent, qui a constate leur orphelinage.
    sessionStorage.setItem('rendu-architectural:formulaire', champs as string)
    const restaure = await chargerEtat()
    expect(restaure?.images).toEqual({
      cadrage: null,
      complementaire: null,
      site: null,
    })
  })
})
