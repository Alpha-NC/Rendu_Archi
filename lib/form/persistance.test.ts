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

  it('restitue un etat sans image', async () => {
    const sansImage: EtatFormulaire = {
      ...etat,
      images: { cadrage: null, complementaire: null, site: null },
    }
    await sauvegarderEtat(sansImage)
    expect(await chargerEtat()).toEqual(sansImage)
  })
})
