import { describe, expect, it } from 'vitest'
import { modeProduction } from './regles'
import type { ImageChargee, ImagesFormulaire } from './types'

const image: ImageChargee = {
  dataUri: 'data:image/jpeg;base64,AAAA',
  nomOrigine: 'vue.jpg',
  largeur: 2048,
  hauteur: 1536,
  poidsOctets: 1000,
}

function images(partiel: Partial<ImagesFormulaire> = {}): ImagesFormulaire {
  return { cadrage: null, complementaire: null, site: null, ...partiel }
}

describe('modeProduction', () => {
  it('photo du site et perspective donnent un photomontage controle', () => {
    expect(modeProduction(images({ cadrage: image, site: image }), 'perspective')).toBe(
      'photomontage_controle',
    )
  })

  it('photo du site et axonometrie donnent une presentation generative', () => {
    expect(modeProduction(images({ cadrage: image, site: image }), 'axonometrie')).toBe(
      'presentation_generative',
    )
  })

  it('absence de photo du site donne une retexturation Revit', () => {
    expect(modeProduction(images({ cadrage: image }), 'perspective')).toBe(
      'retexturation_revit',
    )
  })

  it('cadrage non encore choisi avec photo ne revendique pas un photomontage', () => {
    expect(modeProduction(images({ site: image }), null)).toBe('presentation_generative')
  })
})
