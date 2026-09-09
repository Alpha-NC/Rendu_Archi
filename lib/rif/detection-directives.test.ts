import { describe, expect, it } from 'vitest'
import { interpreterDirectives, SEUIL_CONFIANCE_DIRECTIVE } from './detection-directives'

describe('interpreterDirectives — PRD §9.2, ADR-015', () => {
  it('produit une directive provisoire pour une détection confiante', () => {
    const [directive] = interpreterDirectives(
      [{ action: 'remplacer', target: 'crépi façade extension', confidence: 0.9 }],
      'src-1',
    )
    expect(directive).toEqual({
      id: 'src-1-d0',
      source_id: 'src-1',
      action: 'remplacer',
      target: 'crépi façade extension',
      status: 'provisional',
      remove_annotation_from_output: true,
    })
  })

  it('produit une directive au statut unknown pour une détection sous le seuil de confiance', () => {
    const [directive] = interpreterDirectives(
      [{ action: 'corriger', target: 'zone imprécise', confidence: SEUIL_CONFIANCE_DIRECTIVE - 0.01 }],
      'src-2',
    )
    expect(directive.status).toBe('unknown')
  })

  it("n'invente jamais de marque : un tableau vide en entrée donne un tableau vide en sortie", () => {
    expect(interpreterDirectives([], 'src-3')).toEqual([])
  })

  it('génère des identifiants stables et distincts pour plusieurs directives de la même source', () => {
    const directives = interpreterDirectives(
      [
        { action: 'conserver', target: 'toiture', confidence: 0.95 },
        { action: 'verrouiller', target: 'ouvertures', confidence: 0.95 },
      ],
      'src-4',
    )
    expect(directives.map((d) => d.id)).toEqual(['src-4-d0', 'src-4-d1'])
  })

  it('porte consigne et zone_ou_masque seulement quand fournis', () => {
    const [directive] = interpreterDirectives(
      [{ action: 'supprimer', target: 'auvent', consigne: 'trop imposant', confidence: 0.9 }],
      'src-5',
    )
    expect(directive.consigne).toBe('trop imposant')
    expect(directive.zone_ou_masque).toBeUndefined()
  })
})
