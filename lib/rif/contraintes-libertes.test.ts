import { describe, expect, it } from 'vitest'
import { creerProjectStateVide, type ProjectState } from './project-state'
import {
  autoriserLibertesEnAttente,
  contraintesStructurelles,
  elargitLaLiberte,
  libertesEnAttente,
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
      piscine: { geometry_policy: 'locked', material_policy: 'strict', freedom_level: 'creative', authorized_by: 'evariste' },
      eau: { appearance_policy: 'creative', freedom_level: 'creative', authorized_by: 'evariste' },
      pelouse: { appearance_policy: 'controlled', freedom_level: 'creative', authorized_by: 'evariste' },
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
      contraintes_libertes: { mobilier: { appearance_policy: 'creative', freedom_level: 'controlled', authorized_by: 'evariste' } },
    }
    expect(politiqueEffective(etat, 'mobilier', 'appearance_policy')).toBe('controlled')
  })
})

describe('§24A.1 — les propriétés structurelles ne s\'assouplissent jamais', () => {
  it("refuse une géométrie creative sur un élément structurel, même déclarée dans la matrice", () => {
    const etat: ProjectState = {
      ...creerProjectStateVide('P-1'),
      contraintes_libertes: { toiture: { geometry_policy: 'creative', freedom_level: 'creative', authorized_by: 'evariste' } },
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

describe('§24A.3 — une liberté proposée ne prend effet qu\'une fois confirmée', () => {
  const etatPropose: ProjectState = {
    ...creerProjectStateVide('P-1'),
    contraintes_libertes: {
      // Proposée par le modèle, pas encore confirmée par Évariste.
      pelouse: { appearance_policy: 'controlled' },
      arbres: { presence_policy: 'remove_authorized' },
      // Un durcissement n'a jamais besoin d'autorisation.
      haie_fond: { appearance_policy: 'strict' },
    },
  }

  it("n'accorde aucune liberté tant qu'authorized_by est absent", () => {
    expect(politiqueEffective(etatPropose, 'pelouse', 'appearance_policy')).toBe('locked')
    expect(verifierLiberte(etatPropose, 'pelouse', 'appearance_policy', 'controlled').autorisee).toBe(false)
  })

  it('applique immédiatement un durcissement, sans autorisation', () => {
    expect(politiqueEffective(etatPropose, 'haie_fond', 'appearance_policy')).toBe('strict')
  })

  it('expose les libertés en attente pour qu\'Évariste les voie avant de confirmer', () => {
    const attente = libertesEnAttente(etatPropose)
    expect(attente).toEqual([
      { element: 'pelouse', propriete: 'appearance_policy', niveauPropose: 'controlled' },
    ])
  })

  it("n'inscrit pas une liberté non confirmée dans les libertés accordées", () => {
    expect(libertesAccordees(etatPropose)).toEqual([])
  })

  it('rend la liberté effective après autorisation explicite', () => {
    const autorise = autoriserLibertesEnAttente(etatPropose, 'evariste', '2026-09-08T10:00:00.000Z')
    expect(politiqueEffective(autorise, 'pelouse', 'appearance_policy')).toBe('controlled')
    expect(libertesEnAttente(autorise)).toEqual([])
    expect(autorise.contraintes_libertes?.pelouse.authorized_at).toBe('2026-09-08T10:00:00.000Z')
  })

  it('ne mute pas le ProjectState reçu et préserve une autorisation antérieure', () => {
    const dejaAutorise: ProjectState = {
      ...creerProjectStateVide('P-1'),
      contraintes_libertes: {
        eau: { appearance_policy: 'creative', authorized_by: 'evariste', authorized_at: '2026-09-01T09:00:00.000Z' },
        pelouse: { appearance_policy: 'controlled' },
      },
    }
    const copie = JSON.parse(JSON.stringify(dejaAutorise))
    const autorise = autoriserLibertesEnAttente(dejaAutorise, 'evariste', '2026-09-08T10:00:00.000Z')
    expect(dejaAutorise).toEqual(copie)
    expect(autorise.contraintes_libertes?.eau.authorized_at).toBe('2026-09-01T09:00:00.000Z')
    expect(autorise.contraintes_libertes?.pelouse.authorized_at).toBe('2026-09-08T10:00:00.000Z')
  })
})

describe('elargitLaLiberte — détecte un assouplissement par rapport à une politique en vigueur', () => {
  it("n'élargit rien quand aucun champ proposé ne dépasse le niveau existant", () => {
    const existante = { appearance_policy: 'controlled' as const, authorized_by: 'evariste' }
    expect(elargitLaLiberte(existante, { appearance_policy: 'controlled' })).toBe(false)
    expect(elargitLaLiberte(existante, { appearance_policy: 'strict' })).toBe(false)
  })

  it('élargit quand une propriété proposée dépasse le niveau existant', () => {
    const existante = { appearance_policy: 'controlled' as const, authorized_by: 'evariste' }
    expect(elargitLaLiberte(existante, { appearance_policy: 'creative' })).toBe(true)
  })

  it('un champ omis dans la proposition ne compte jamais comme un élargissement', () => {
    const existante = { appearance_policy: 'creative' as const, material_policy: 'strict' as const, authorized_by: 'evariste' }
    expect(elargitLaLiberte(existante, { appearance_policy: 'creative' })).toBe(false)
  })

  it('une propriété absente auparavant (défaut locked) élargit dès que proposée au-delà de locked', () => {
    expect(elargitLaLiberte({}, { appearance_policy: 'strict' })).toBe(true)
  })

  it('passer de conserve à add_authorized/remove_authorized élargit ; l\'inverse non', () => {
    expect(elargitLaLiberte({ presence_policy: 'conserve' }, { presence_policy: 'add_authorized' })).toBe(true)
    expect(elargitLaLiberte({ presence_policy: 'add_authorized' }, { presence_policy: 'conserve' })).toBe(false)
  })
})
