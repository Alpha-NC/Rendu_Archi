import { describe, expect, it } from 'vitest'
import { LARGEUR_MAX, dimensionsCibles } from './redimensionner'

describe('dimensionsCibles', () => {
  it('plafonne la largeur a 2048 px', () => {
    expect(LARGEUR_MAX).toBe(2048)
    expect(dimensionsCibles(4096, 3072)).toEqual({ largeur: 2048, hauteur: 1536 })
  })

  it('conserve le rapport d aspect a un demi pixel pres', () => {
    // Un arrondi au pixel entier ne peut pas faire mieux qu'un demi-pixel :
    // c'est la borne exacte, pas une tolerance choisie au jugé.
    for (const [largeurSource, hauteurSource] of [
      [3000, 1000],
      [4096, 3072],
      [5000, 2813],
    ] as const) {
      const { largeur, hauteur } = dimensionsCibles(largeurSource, hauteurSource)
      const attendue = (largeur * hauteurSource) / largeurSource
      expect(Math.abs(hauteur - attendue)).toBeLessThanOrEqual(0.5)
    }
  })

  it('ne monte jamais en resolution', () => {
    expect(dimensionsCibles(800, 600)).toEqual({ largeur: 800, hauteur: 600 })
  })

  it('laisse intacte une image exactement a la limite', () => {
    expect(dimensionsCibles(2048, 1536)).toEqual({ largeur: 2048, hauteur: 1536 })
  })

  it('arrondit a l entier', () => {
    const { largeur, hauteur } = dimensionsCibles(4097, 3000)
    expect(Number.isInteger(largeur)).toBe(true)
    expect(Number.isInteger(hauteur)).toBe(true)
  })

  it('plafonne aussi une image en portrait par sa largeur', () => {
    expect(dimensionsCibles(3000, 4000)).toEqual({ largeur: 2048, hauteur: 2731 })
  })
})
