import { describe, expect, it } from 'vitest'
import { CRITERES_CONTROLE } from './controle-qualite'
import {
  criteresApplicables,
  estOutputTypeValide,
  obtenirQualityProfile,
  OUTPUT_TYPES,
  QUALITY_PROFILES,
} from './render-targets'

describe('OutputType (D-22, mission Lot 1)', () => {
  it("n'a exactement que deux valeurs — confirmé RDV Évariste 18.09.2026", () => {
    expect(OUTPUT_TYPES).toEqual(['PHOTOREALISTIC_PERSPECTIVE', 'PHOTOREALISTIC_AXONOMETRY'])
  })

  it('estOutputTypeValide refuse toute valeur hors des deux confirmées', () => {
    expect(estOutputTypeValide('PHOTOREALISTIC_PERSPECTIVE')).toBe(true)
    expect(estOutputTypeValide('PHOTOREALISTIC_AXONOMETRY')).toBe(true)
    expect(estOutputTypeValide('ARCHITECTURAL_PLAN')).toBe(false)
    expect(estOutputTypeValide('')).toBe(false)
  })
})

describe('QUALITY_PROFILES (D-22)', () => {
  it("chaque profil ne cite que des critères réellement présents dans la grille LIB-002", () => {
    for (const profile of Object.values(QUALITY_PROFILES)) {
      for (const critere of profile.criteresPrioritaires) {
        expect(CRITERES_CONTROLE).toContain(critere)
      }
    }
  })

  it('le profil perspective priorise implantation/cadrage/perspective avant le reste (Évariste §3)', () => {
    const { criteresPrioritaires } = obtenirQualityProfile('PHOTOREALISTIC_PERSPECTIVE')
    expect(criteresPrioritaires.slice(0, 3)).toEqual(['implantation', 'cadrage', 'perspective'])
  })

  it('le profil axonométrie priorise toiture/volumes avant le reste, jamais cadrage/perspective', () => {
    const { criteresPrioritaires } = obtenirQualityProfile('PHOTOREALISTIC_AXONOMETRY')
    expect(criteresPrioritaires.slice(0, 2)).toEqual(['toiture', 'volumes'])
    expect(criteresPrioritaires).not.toContain('cadrage')
    expect(criteresPrioritaires).not.toContain('perspective')
  })

  it('les deux profils incluent elements_inventes — jamais un rendu jugé sans vérifier les inventions', () => {
    expect(QUALITY_PROFILES.PHOTOREALISTIC_PERSPECTIVE.criteresPrioritaires).toContain('elements_inventes')
    expect(QUALITY_PROFILES.PHOTOREALISTIC_AXONOMETRY.criteresPrioritaires).toContain('elements_inventes')
  })
})

describe('criteresApplicables — compatibilité legacy (mission Lot 1 §6)', () => {
  it('sans OutputType (génération legacy), retombe sur la grille LIB-002 complète', () => {
    expect(criteresApplicables(undefined)).toEqual([...CRITERES_CONTROLE])
  })

  it('avec un OutputType, retourne le sous-ensemble prioritaire du profil, jamais la grille complète', () => {
    const resultat = criteresApplicables('PHOTOREALISTIC_AXONOMETRY')
    expect(resultat).toEqual(QUALITY_PROFILES.PHOTOREALISTIC_AXONOMETRY.criteresPrioritaires)
    expect(resultat.length).toBeLessThan(CRITERES_CONTROLE.length)
  })
})
