import { describe, expect, it } from 'vitest'
import {
  champsMateriauxPour,
  cielProposeParDefaut,
  conservationExistantProposee,
  eclairagesDemandes,
  eclairagesProposes,
  modeProduction,
  stylesDisponibles,
  stylePreselectionne,
} from './regles'
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

describe('stylesDisponibles', () => {
  it('propose les trois styles en photomontage controle', () => {
    expect(stylesDisponibles('photomontage_controle')).toEqual([
      'photomontage_administratif',
      'presentation_client',
      'commercial',
    ])
  })

  it('exclut le photomontage administratif en presentation generative', () => {
    expect(stylesDisponibles('presentation_generative')).toEqual([
      'presentation_client',
      'commercial',
    ])
  })

  it('exclut le photomontage administratif en retexturation Revit', () => {
    expect(stylesDisponibles('retexturation_revit')).toEqual([
      'presentation_client',
      'commercial',
    ])
  })
})

describe('stylePreselectionne', () => {
  it('choisit le photomontage administratif pour un permis de construire', () => {
    expect(stylePreselectionne('photomontage_controle', 'permis_de_construire')).toBe(
      'photomontage_administratif',
    )
  })

  it('choisit le photomontage administratif pour un usage mixte', () => {
    expect(stylePreselectionne('photomontage_controle', 'les_deux')).toBe(
      'photomontage_administratif',
    )
  })

  it('choisit la presentation client pour une reunion client', () => {
    expect(stylePreselectionne('photomontage_controle', 'presentation_client')).toBe(
      'presentation_client',
    )
  })

  it('choisit la presentation client quand le photomontage est indisponible', () => {
    expect(stylePreselectionne('retexturation_revit', 'permis_de_construire')).toBe(
      'presentation_client',
    )
    expect(stylePreselectionne('presentation_generative', 'les_deux')).toBe(
      'presentation_client',
    )
  })

  it('choisit la presentation client quand l usage n est pas encore renseigne', () => {
    expect(stylePreselectionne('photomontage_controle', null)).toBe('presentation_client')
  })

  it('ne preselectionne jamais le style commercial', () => {
    const modes = [
      'photomontage_controle',
      'presentation_generative',
      'retexturation_revit',
    ] as const
    const usages = ['permis_de_construire', 'presentation_client', 'les_deux', null] as const
    for (const mode of modes) {
      for (const usage of usages) {
        expect(stylePreselectionne(mode, usage)).not.toBe('commercial')
      }
    }
  })

  it('preselectionne toujours un style disponible dans le mode', () => {
    const modes = [
      'photomontage_controle',
      'presentation_generative',
      'retexturation_revit',
    ] as const
    const usages = ['permis_de_construire', 'presentation_client', 'les_deux', null] as const
    for (const mode of modes) {
      for (const usage of usages) {
        expect(stylesDisponibles(mode)).toContain(stylePreselectionne(mode, usage))
      }
    }
  })
})

describe('champsMateriauxPour', () => {
  it('propose margelles et plage pour une piscine', () => {
    expect(champsMateriauxPour('piscine')).toEqual(['margelles', 'plage'])
  })

  it('propose le bati pour une extension', () => {
    expect(champsMateriauxPour('extension')).toEqual([
      'toiture',
      'facade',
      'volets',
      'menuiseries',
    ])
  })

  it('propose le bati pour une restructuration', () => {
    expect(champsMateriauxPour('restructuration')).toEqual([
      'toiture',
      'facade',
      'volets',
      'menuiseries',
    ])
  })

  it('ne propose aucun materiau pour une terrasse', () => {
    expect(champsMateriauxPour('terrasse')).toEqual([])
  })

  it('propose les six categories pour un pool house', () => {
    expect(champsMateriauxPour('pool_house')).toEqual([
      'toiture',
      'facade',
      'volets',
      'menuiseries',
      'margelles',
      'plage',
    ])
  })

  it('ne propose rien tant que le type de projet est inconnu', () => {
    expect(champsMateriauxPour(null)).toEqual([])
  })
})

describe('conservationExistantProposee', () => {
  it('est proposee en extension avec une photo du site', () => {
    expect(conservationExistantProposee('extension', images({ site: image }))).toBe(true)
  })

  it('est proposee en restructuration avec une photo du site', () => {
    expect(conservationExistantProposee('restructuration', images({ site: image }))).toBe(
      true,
    )
  })

  it('n est pas proposee sans photo du site', () => {
    expect(conservationExistantProposee('extension', images())).toBe(false)
  })

  it('n est pas proposee sur un projet neuf', () => {
    expect(conservationExistantProposee('piscine', images({ site: image }))).toBe(false)
    expect(conservationExistantProposee('pool_house', images({ site: image }))).toBe(false)
  })
})

describe('cielProposeParDefaut', () => {
  it('propose de reprendre la lumiere de la photo quand elle existe', () => {
    expect(cielProposeParDefaut(images({ site: image }))).toBe('reprendre_photo')
  })

  it('propose une lumiere neutre sans photo', () => {
    expect(cielProposeParDefaut(images({ cadrage: image }))).toBe('neutre_diffus')
  })
})

describe('eclairagesDemandes', () => {
  it('demande les eclairages en fin de journee', () => {
    expect(eclairagesDemandes('fin_de_journee')).toBe(true)
  })

  it('demande les eclairages au crepuscule', () => {
    expect(eclairagesDemandes('crepuscule')).toBe(true)
  })

  it('ne demande rien pour les autres ambiances', () => {
    for (const ciel of ['reprendre_photo', 'degage', 'legerement_voile', 'neutre_diffus'] as const) {
      expect(eclairagesDemandes(ciel)).toBe(false)
    }
  })
})

describe('eclairagesProposes', () => {
  it('propose les eclairages de bassin sur les projets avec piscine', () => {
    expect(eclairagesProposes('piscine')).toEqual([
      'margelles',
      'sousMarin',
      'appliquesFacade',
      'interieurVisible',
    ])
    expect(eclairagesProposes('pool_house')).toEqual([
      'margelles',
      'sousMarin',
      'appliquesFacade',
      'interieurVisible',
    ])
  })

  it('ne propose que les eclairages du bati ailleurs', () => {
    for (const typeProjet of ['extension', 'restructuration', 'terrasse', null] as const) {
      expect(eclairagesProposes(typeProjet)).toEqual([
        'appliquesFacade',
        'interieurVisible',
      ])
    }
  })
})
