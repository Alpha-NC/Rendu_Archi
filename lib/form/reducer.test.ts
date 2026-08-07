import { describe, expect, it } from 'vitest'
import { etapeVoisine, reduire } from './reducer'
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

describe('preselection du style', () => {
  it('suit l usage tant que le style n a pas ete choisi a la main', () => {
    let e = reduire(etat(), { type: 'image', role: 'site', valeur: image })
    e = reduire(e, { type: 'typeCadrage', valeur: 'perspective' })
    e = reduire(e, { type: 'usage', valeur: 'permis_de_construire' })
    expect(e.style).toBe('photomontage_administratif')

    e = reduire(e, { type: 'usage', valeur: 'presentation_client' })
    expect(e.style).toBe('presentation_client')
  })

  it('cesse de suivre l usage des qu un style est choisi a la main', () => {
    let e = reduire(etat(), { type: 'image', role: 'site', valeur: image })
    e = reduire(e, { type: 'typeCadrage', valeur: 'perspective' })
    e = reduire(e, { type: 'style', valeur: 'commercial' })
    e = reduire(e, { type: 'usage', valeur: 'permis_de_construire' })
    expect(e.style).toBe('commercial')
  })
})

describe('correction automatique du style', () => {
  it('abandonne le photomontage quand la photo du site est retiree', () => {
    let e = reduire(etat(), { type: 'image', role: 'site', valeur: image })
    e = reduire(e, { type: 'typeCadrage', valeur: 'perspective' })
    e = reduire(e, { type: 'style', valeur: 'photomontage_administratif' })
    expect(e.style).toBe('photomontage_administratif')

    e = reduire(e, { type: 'image', role: 'site', valeur: null })
    expect(e.style).toBe('presentation_client')
  })

  it('abandonne le photomontage au passage en axonometrie', () => {
    let e = reduire(etat(), { type: 'image', role: 'site', valeur: image })
    e = reduire(e, { type: 'typeCadrage', valeur: 'perspective' })
    e = reduire(e, { type: 'style', valeur: 'photomontage_administratif' })

    e = reduire(e, { type: 'typeCadrage', valeur: 'axonometrie' })
    expect(e.style).toBe('presentation_client')
  })
})

describe('preselection du ciel', () => {
  it('bascule sur la lumiere de la photo des qu une photo est fournie', () => {
    expect(etatInitial.ciel).toBe('neutre_diffus')
    const e = reduire(etat(), { type: 'image', role: 'site', valeur: image })
    expect(e.ciel).toBe('reprendre_photo')
  })

  it('respecte un choix manuel', () => {
    let e = reduire(etat(), { type: 'ciel', valeur: 'crepuscule' })
    e = reduire(e, { type: 'image', role: 'site', valeur: image })
    expect(e.ciel).toBe('crepuscule')
  })
})

describe('materiaux', () => {
  it('efface les materiaux des categories retirees par un changement de projet', () => {
    let e = reduire(etat(), { type: 'typeProjet', valeur: 'extension' })
    e = reduire(e, {
      type: 'materiau',
      categorie: 'toiture',
      valeur: { origine: 'catalogue', id: 'a', terme: 'Tuiles plates' },
    })
    expect(e.materiaux.toiture).not.toBeNull()

    e = reduire(e, { type: 'typeProjet', valeur: 'piscine' })
    expect(e.materiaux.toiture).toBeNull()
  })

  it('eteint un eclairage de bassin quand le projet n en a plus', () => {
    let e = reduire(etat(), { type: 'typeProjet', valeur: 'piscine' })
    e = reduire(e, { type: 'ciel', valeur: 'crepuscule' })
    e = reduire(e, { type: 'eclairage', cle: 'sousMarin', valeur: true })
    e = reduire(e, { type: 'eclairage', cle: 'appliquesFacade', valeur: true })
    expect(e.eclairages.sousMarin).toBe(true)

    e = reduire(e, { type: 'typeProjet', valeur: 'extension' })
    expect(e.eclairages.sousMarin).toBe(false)
    expect(e.eclairages.margelles).toBe(false)
    expect(e.eclairages.appliquesFacade).toBe(true)
  })

  it('efface une conservation de l existant devenue impossible', () => {
    let e = reduire(etat(), { type: 'image', role: 'site', valeur: image })
    e = reduire(e, { type: 'typeProjet', valeur: 'extension' })
    e = reduire(e, { type: 'materiau', categorie: 'facade', valeur: { origine: 'existant' } })
    expect(e.materiaux.facade).toEqual({ origine: 'existant' })

    e = reduire(e, { type: 'image', role: 'site', valeur: null })
    expect(e.materiaux.facade).toBeNull()
  })
})

describe('navigation', () => {
  it('memorise la plus haute etape atteinte', () => {
    let e = reduire(etat(), { type: 'allerEtape', etape: 3 })
    expect(e.etapeMax).toBe(3)
    e = reduire(e, { type: 'allerEtape', etape: 2 })
    expect(e.etape).toBe(2)
    expect(e.etapeMax).toBe(3)
  })

  it('borne l etape voisine aux extremites', () => {
    expect(etapeVoisine(1, -1)).toBe(1)
    expect(etapeVoisine(7, 1)).toBe(7)
    expect(etapeVoisine(3, 1)).toBe(4)
    expect(etapeVoisine(3, -1)).toBe(2)
  })

  it('ne perd aucune donnee lors d un retour en arriere', () => {
    let e = reduire(etat(), { type: 'reference', valeur: '2026-042' })
    e = reduire(e, { type: 'allerEtape', etape: 4 })
    e = reduire(e, { type: 'elementsARetirer', valeur: 'abri de jardin' })
    e = reduire(e, { type: 'allerEtape', etape: 1 })
    expect(e.reference).toBe('2026-042')
    expect(e.elementsARetirer).toBe('abri de jardin')
  })
})
