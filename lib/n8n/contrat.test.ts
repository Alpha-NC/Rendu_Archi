import { describe, expect, it } from 'vitest'
import { estErreur } from './contrat'

describe('estErreur', () => {
  it('reconnait une erreur metier bien formee', () => {
    expect(estErreur({ erreur: { code: 'materiau_inconnu', message: 'Détail.' } })).toBe(
      true,
    )
  })

  it('refuse une reponse de succes', () => {
    expect(
      estErreur({ cycle_id: 'a', reference: 'b', image_url: 'c', prompt: 'd' }),
    ).toBe(false)
  })

  it('refuse une cle erreur mal formee', () => {
    expect(estErreur({ erreur: null })).toBe(false)
    expect(estErreur({ erreur: 'quelque chose' })).toBe(false)
    expect(estErreur({ erreur: { code: 'a' } })).toBe(false)
    expect(estErreur({ erreur: { message: 'a' } })).toBe(false)
    expect(estErreur({ erreur: { code: 1, message: 'a' } })).toBe(false)
  })

  it('refuse ce qui n est pas un objet', () => {
    for (const valeur of [null, undefined, 'erreur', 42, []]) {
      expect(estErreur(valeur)).toBe(false)
    }
  })
})
