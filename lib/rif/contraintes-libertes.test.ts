import { describe, expect, it } from 'vitest'
import { creerProjectStateVide, type ProjectState } from './project-state'
import {
  contraintesStructurelles,
  libertesAccordees,
  politiqueEffective,
  plusRestrictif,
  presencesAutorisees,
  verifierLiberte,
} from './contraintes-libertes'

/** Exemple littéral du PRD §9.4A : piscine géométrie locked, eau creative. */
function etatAvecPiscine(): ProjectState {
  return {
    ...creerProjectStateVide('P-1'),
    contraintes_libertes: {
      piscine: { geometry_policy: 'locked', material_policy: 'strict', freedom_level: 'creative' },
      eau: { appearance_policy: 'creative', freedom_level: 'creative' },
      pelouse: { appearance_policy: 'controlled', freedom_level: 'creative' },
      haie_fond: { appearance_policy: 'strict', freedom_level: 'strict' },
    },
  }
}

describe('§7.3 — la liberté créative n\'est jamais implicite', () => {
  it('traite comme locked toute propriété absente de la matrice', () => {
    const etat = creerProjectStateVide('P-1')
    expect(politiqueEffective(etat, 'facade', 'appearance_policy')).toBe('locked')
  })

  it('refuse une liberté sur un élément totalement absent de la matrice', () => {
    const etat = creerProjectStateVide('P-1')
    const decision = verifierLiberte(etat, 'ciel', 'appearance_policy', 'creative')
    expect(decision.autorisee).toBe(false)
    expect(decision.raison).toMatch(/n'a pas été accordée/)
  })
})

describe('§24A.4 — la propriété la plus restrictive prévaut', () => {
  it('compare correctement deux niveaux', () => {
    expect(plusRestrictif('creative', 'locked')).toBe('locked')
    expect(plusRestrictif('controlled', 'strict')).toBe('strict')
    expect(plusRestrictif('creative', 'controlled')).toBe('controlled')
  })

  it('un freedom_level permissif ne desserre jamais une propriété verrouillée', () => {
    const etat = etatAvecPiscine() // piscine: geometry locked, freedom_level creative
    expect(politiqueEffective(etat, 'piscine', 'geometry_policy')).toBe('locked')
  })

  it('un freedom_level restrictif plafonne une propriété plus permissive', () => {
    const etat: ProjectState = {
      ...creerProjectStateVide('P-1'),
      contraintes_libertes: { mobilier: { appearance_policy: 'creative', freedom_level: 'controlled' } },
    }
    expect(politiqueEffective(etat, 'mobilier', 'appearance_policy')).toBe('controlled')
  })
})

describe('§24A.1 — les propriétés structurelles ne s\'assouplissent jamais', () => {
  it("refuse une géométrie creative sur un élément structurel, même déclarée dans la matrice", () => {
    const etat: ProjectState = {
      ...creerProjectStateVide('P-1'),
      contraintes_libertes: { toiture: { geometry_policy: 'creative', freedom_level: 'creative' } },
    }
    expect(politiqueEffective(etat, 'toiture', 'geometry_policy')).toBe('strict')
    expect(verifierLiberte(etat, 'toiture', 'geometry_policy', 'creative').autorisee).toBe(false)
  })

  it("laisse une propriété visuelle d'un élément structurel suivre la matrice (principe 14)", () => {
    const etat = etatAvecPiscine()
    // La piscine a une géométrie verrouillée mais son matériau reste gouverné
    // indépendamment — ici strict, pas locked.
    expect(politiqueEffective(etat, 'piscine', 'material_policy')).toBe('strict')
  })
})

describe('§9.4A — accord et refus de liberté', () => {
  it('accorde une liberté effectivement présente dans la matrice', () => {
    const etat = etatAvecPiscine()
    expect(verifierLiberte(etat, 'eau', 'appearance_policy', 'creative').autorisee).toBe(true)
    expect(verifierLiberte(etat, 'pelouse', 'appearance_policy', 'controlled').autorisee).toBe(true)
  })

  it('refuse une liberté plus large que celle accordée', () => {
    const etat = etatAvecPiscine()
    const decision = verifierLiberte(etat, 'pelouse', 'appearance_policy', 'creative')
    expect(decision.autorisee).toBe(false)
    expect(decision.niveauEffectif).toBe('controlled')
  })
})

describe('inventaires pour le Generation Package (§9.5) et la traçabilité (§22)', () => {
  it('liste les libertés réellement accordées', () => {
    const accordees = libertesAccordees(etatAvecPiscine())
    expect(accordees).toContainEqual(
      expect.objectContaining({ element: 'eau', propriete: 'appearance_policy', niveau: 'creative' }),
    )
    expect(accordees).toContainEqual(
      expect.objectContaining({ element: 'pelouse', propriete: 'appearance_policy', niveau: 'controlled' }),
    )
    // La haie est strict : ce n'est pas une liberté.
    expect(accordees.some((a) => a.element === 'haie_fond')).toBe(false)
  })

  it('liste les contraintes structurelles déclarées', () => {
    const contraintes = contraintesStructurelles(etatAvecPiscine())
    expect(contraintes).toContainEqual({ element: 'piscine', propriete: 'geometry_policy', niveau: 'locked' })
    expect(contraintes).toContainEqual({ element: 'haie_fond', propriete: 'appearance_policy', niveau: 'strict' })
  })

  it('liste les présences autorisées, sans les simples conservations', () => {
    const etat: ProjectState = {
      ...creerProjectStateVide('P-1'),
      contraintes_libertes: {
        arbres_avant: { presence_policy: 'remove_authorized' },
        transats: { presence_policy: 'add_authorized', scope: 'zone piscine' },
        haie_fond: { presence_policy: 'conserve' },
      },
    }
    const presences = presencesAutorisees(etat)
    expect(presences).toHaveLength(2)
    expect(presences).toContainEqual({ element: 'transats', politique: 'add_authorized', scope: 'zone piscine' })
  })
})
