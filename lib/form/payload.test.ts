import { describe, expect, it } from 'vitest'
import { construirePayloadGenerate } from './payload'
import { etatInitial } from './etat-initial'
import type { EtatFormulaire, ImageChargee } from './types'

function img(nom: string): ImageChargee {
  return {
    dataUri: `data:image/jpeg;base64,${nom}`,
    nomOrigine: `${nom}.jpg`,
    largeur: 2048,
    hauteur: 1536,
    poidsOctets: 1000,
  }
}

const base: EtatFormulaire = {
  ...etatInitial,
  reference: '  2026-042  ',
  typeProjet: 'extension',
  usage: 'permis_de_construire',
  typeCadrage: 'perspective',
  images: { cadrage: img('cadrage'), complementaire: null, site: img('site') },
  elementsAPreserver: 'garde-corps du balcon nord',
  style: 'photomontage_administratif',
  ciel: 'reprendre_photo',
}

describe('construirePayloadGenerate', () => {
  it('produit le corps attendu pour un cas nominal', () => {
    const payload = construirePayloadGenerate(base)
    expect(payload.action).toBe('generate')
    expect(payload.reference).toBe('2026-042')
    expect(payload.projet).toEqual({ type: 'extension', usage: 'permis_de_construire' })
    expect(payload.cadrage).toEqual({ type: 'perspective' })
    expect(payload.mode_production).toBe('photomontage_controle')
    expect(payload.images.cadrage).toBe('data:image/jpeg;base64,cadrage')
    expect(payload.images.site).toBe('data:image/jpeg;base64,site')
    expect(payload.images.complementaire).toBeNull()
    expect(payload.elements_a_preserver).toBe('garde-corps du balcon nord')
  })

  it('presente les six categories, les non applicables a null', () => {
    const payload = construirePayloadGenerate(base)
    expect(Object.keys(payload.materiaux).sort()).toEqual([
      'facade',
      'margelles',
      'menuiseries',
      'plage',
      'toiture',
      'volets',
    ])
    expect(payload.materiaux.margelles).toBeNull()
    expect(payload.materiaux.plage).toBeNull()
  })

  it('transporte le discriminant origine des selections', () => {
    const etat: EtatFormulaire = {
      ...base,
      materiaux: {
        ...base.materiaux,
        toiture: { origine: 'catalogue', id: 'uuid-1', terme: 'Tuiles plates' },
        facade: { origine: 'existant' },
      },
    }
    const payload = construirePayloadGenerate(etat)
    expect(payload.materiaux.toiture).toEqual({
      origine: 'catalogue',
      id: 'uuid-1',
      terme: 'Tuiles plates',
    })
    expect(payload.materiaux.facade).toEqual({ origine: 'existant' })
  })

  it('sort les saisies libres de materiaux vers materiaux_libres', () => {
    const etat: EtatFormulaire = {
      ...base,
      materiaux: {
        ...base.materiaux,
        volets: { origine: 'libre', terme: 'bois peint vert olive' },
      },
    }
    const payload = construirePayloadGenerate(etat)
    expect(payload.materiaux.volets).toBeNull()
    expect(payload.materiaux_libres).toEqual([
      { categorie: 'volets', terme: 'bois peint vert olive' },
    ])
  })

  it('met les eclairages a null hors ambiance crepusculaire', () => {
    const payload = construirePayloadGenerate(base)
    expect(payload.environnement.ciel).toBe('reprendre_photo')
    expect(payload.environnement.eclairages).toBeNull()
  })

  // Deux motifs complementaires : avec quatre booleens, un seul motif laisse
  // toujours une paire de cles indiscernable, donc une inversion de mapping
  // passerait inapercue.
  it('transporte les eclairages en fin de journee', () => {
    const etat: EtatFormulaire = {
      ...base,
      ciel: 'fin_de_journee',
      eclairages: {
        margelles: true,
        sousMarin: false,
        appliquesFacade: false,
        interieurVisible: true,
      },
    }
    const payload = construirePayloadGenerate(etat)
    expect(payload.environnement.eclairages).toEqual({
      margelles: true,
      sous_marin: false,
      appliques_facade: false,
      interieur_visible: true,
    })
  })

  it('transporte les eclairages au crepuscule sans confondre deux cles', () => {
    const etat: EtatFormulaire = {
      ...base,
      ciel: 'crepuscule',
      eclairages: {
        margelles: true,
        sousMarin: true,
        appliquesFacade: false,
        interieurVisible: false,
      },
    }
    const payload = construirePayloadGenerate(etat)
    expect(payload.environnement.eclairages).toEqual({
      margelles: true,
      sous_marin: true,
      appliques_facade: false,
      interieur_visible: false,
    })
  })

  it('ignore une saisie libre restee vide', () => {
    for (const terme of ['', '   ']) {
      const etat: EtatFormulaire = {
        ...base,
        materiaux: { ...base.materiaux, volets: { origine: 'libre', terme } },
      }
      const payload = construirePayloadGenerate(etat)
      expect(payload.materiaux.volets).toBeNull()
      expect(payload.materiaux_libres).toEqual([])
    }
  })

  it('refuse de construire un payload amputé d un champ obligatoire', () => {
    const amputations: Partial<EtatFormulaire>[] = [
      { images: { ...base.images, cadrage: null } },
      { typeProjet: null },
      { typeCadrage: null },
      { style: null },
    ]
    for (const amputation of amputations) {
      expect(() =>
        construirePayloadGenerate({ ...base, ...amputation }),
      ).toThrow()
    }
  })
})
