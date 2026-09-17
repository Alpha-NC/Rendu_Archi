import { describe, expect, it } from 'vitest'
import { interpreterReponseControle } from './controle-multimodal'

describe('interpreterReponseControle', () => {
  it('normalise une réponse valide, avec et sans champs optionnels', () => {
    const lignes = interpreterReponseControle({
      lignes: [
        { critere: 'cadrage', etat: 'conforme' },
        { critere: 'materiaux', etat: 'non_conforme', ecartObserve: 'teinte différente', defautEliminatoire: true },
      ],
    })

    expect(lignes).toEqual([
      { critere: 'cadrage', sourceControle: 'Analyse multimodale (Claude Sonnet 5, D-06)', etat: 'conforme', ecartObserve: undefined, actionRecommandee: undefined, defautEliminatoire: undefined },
      { critere: 'materiaux', sourceControle: 'Analyse multimodale (Claude Sonnet 5, D-06)', etat: 'non_conforme', ecartObserve: 'teinte différente', actionRecommandee: undefined, defautEliminatoire: true },
    ])
  })

  it('rejette une réponse sans le tableau lignes (tool_use absent ou malformé)', () => {
    expect(() => interpreterReponseControle(undefined)).toThrow(/invalide ou absente/)
    expect(() => interpreterReponseControle({})).toThrow(/invalide ou absente/)
    expect(() => interpreterReponseControle({ lignes: 'pas un tableau' })).toThrow(/invalide ou absente/)
  })

  it('accepte un tableau vide (aucun écart) sans planter', () => {
    expect(interpreterReponseControle({ lignes: [] })).toEqual([])
  })
})
