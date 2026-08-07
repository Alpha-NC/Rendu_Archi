import { describe, expect, it } from 'vitest'
import { ErreurMetier, ErreurReseau, interpreter } from './client'
import { estReponseGenerate } from './contrat'

const succes = {
  cycle_id: 'c1',
  reference: '2026-042',
  image_url: 'https://exemple/rendu.jpg',
  prompt: 'texte',
}

describe('interpreter', () => {
  it('rend la charge quand elle a la forme attendue', () => {
    expect(interpreter(200, succes, estReponseGenerate)).toEqual(succes)
  })

  it('leve une erreur metier sur une reponse d erreur', () => {
    const charge = { erreur: { code: 'materiau_inconnu', message: 'Détail.' } }
    try {
      interpreter(200, charge, estReponseGenerate)
      throw new Error('aurait du lever')
    } catch (erreur) {
      expect(erreur).toBeInstanceOf(ErreurMetier)
      expect((erreur as ErreurMetier).code).toBe('materiau_inconnu')
      expect((erreur as ErreurMetier).message).toBe('Détail.')
    }
  })

  it('leve une erreur reseau sur un statut non-2xx', () => {
    expect(() => interpreter(524, succes, estReponseGenerate)).toThrow(ErreurReseau)
    expect(() => interpreter(500, null, estReponseGenerate)).toThrow(ErreurReseau)
  })

  it('prefere l erreur reseau au contenu quand le statut est mauvais', () => {
    const charge = { erreur: { code: 'x', message: 'y' } }
    expect(() => interpreter(500, charge, estReponseGenerate)).toThrow(ErreurReseau)
  })

  it('leve une erreur reseau sur une reponse inexploitable', () => {
    for (const charge of [null, undefined, 'texte', 42, {}, { image_url: '' }]) {
      expect(() => interpreter(200, charge, estReponseGenerate)).toThrow(ErreurReseau)
    }
  })

  it('refuse un tableau, forme par defaut du node Respond to Webhook', () => {
    expect(() => interpreter(200, [succes], estReponseGenerate)).toThrow(ErreurReseau)
  })

  it('ne confond jamais les deux familles d erreur', () => {
    const metier = { erreur: { code: 'a', message: 'b' } }
    expect(() => interpreter(200, metier, estReponseGenerate)).not.toThrow(ErreurReseau)
    expect(() => interpreter(200, {}, estReponseGenerate)).not.toThrow(ErreurMetier)
  })
})
