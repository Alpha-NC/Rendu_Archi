import { describe, expect, it } from 'vitest'
import { etapeFranchissable, peutEnvoyer } from './validation'
import { etatInitial } from './etat-initial'
import type { EtatFormulaire, ImageChargee } from './types'

const image: ImageChargee = {
  dataUri: 'data:image/jpeg;base64,AAAA',
  nomOrigine: 'vue.jpg',
  largeur: 2048,
  hauteur: 1536,
  poidsOctets: 1000,
}

function etat(partiel: Partial<EtatFormulaire> = {}): EtatFormulaire {
  return { ...etatInitial, ...partiel }
}

const etatComplet = etat({
  reference: '2026-042',
  typeProjet: 'extension',
  usage: 'permis_de_construire',
  typeCadrage: 'perspective',
  images: { cadrage: image, complementaire: null, site: image },
  style: 'photomontage_administratif',
})

describe('etapeFranchissable — etape 1', () => {
  it('exige une reference et un type de projet', () => {
    expect(etapeFranchissable(etat(), 1)).toBe(false)
    expect(etapeFranchissable(etat({ reference: '2026-042' }), 1)).toBe(false)
    expect(etapeFranchissable(etat({ typeProjet: 'piscine' }), 1)).toBe(false)
    expect(
      etapeFranchissable(etat({ reference: '2026-042', typeProjet: 'piscine' }), 1),
    ).toBe(true)
  })

  it('refuse une reference faite d espaces', () => {
    expect(
      etapeFranchissable(etat({ reference: '   ', typeProjet: 'piscine' }), 1),
    ).toBe(false)
  })
})

describe('etapeFranchissable — etape 2', () => {
  it('exige un type de cadrage et une vue de cadrage', () => {
    const base = { reference: '2026-042', typeProjet: 'piscine' as const }
    expect(etapeFranchissable(etat(base), 2)).toBe(false)
    expect(etapeFranchissable(etat({ ...base, typeCadrage: 'perspective' }), 2)).toBe(false)
    expect(
      etapeFranchissable(
        etat({
          ...base,
          typeCadrage: 'perspective',
          images: { cadrage: image, complementaire: null, site: null },
        }),
        2,
      ),
    ).toBe(true)
  })
})

describe('etapeFranchissable — etapes libres', () => {
  it('laisse passer les etapes 3, 4 et 6 sans condition propre', () => {
    for (const etapeLibre of [3, 4, 6] as const) {
      expect(etapeFranchissable(etatComplet, etapeLibre)).toBe(true)
    }
  })
})

describe('etapeFranchissable — etape 5', () => {
  it('exige un style disponible dans le mode courant', () => {
    expect(etapeFranchissable(etatComplet, 5)).toBe(true)
  })

  it('refuse un style indisponible dans le mode courant', () => {
    const sansPhoto = etat({
      ...etatComplet,
      images: { cadrage: image, complementaire: null, site: null },
    })
    expect(etapeFranchissable(sansPhoto, 5)).toBe(false)
  })

  it('refuse un style non renseigne', () => {
    expect(etapeFranchissable(etat({ ...etatComplet, style: null }), 5)).toBe(false)
  })
})

describe('peutEnvoyer', () => {
  it('autorise l envoi quand toutes les conditions sont reunies', () => {
    expect(peutEnvoyer(etatComplet)).toBe(true)
  })

  it('refuse l envoi sans vue de cadrage', () => {
    const sansCadrage = etat({
      ...etatComplet,
      images: { cadrage: null, complementaire: null, site: image },
    })
    expect(peutEnvoyer(sansCadrage)).toBe(false)
  })

  it('refuse l envoi sans reference', () => {
    expect(peutEnvoyer(etat({ ...etatComplet, reference: '' }))).toBe(false)
  })
})
