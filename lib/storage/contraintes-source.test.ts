import { describe, expect, it } from 'vitest'
import { construireContrainteUploadSource, validerPathnameSource } from './contraintes-source'

describe('validerPathnameSource', () => {
  it('accepte un pathname dans le bon dossier', () => {
    expect(() => validerPathnameSource('d-1/sources/revit_view-123.jpg', 'd-1')).not.toThrow()
  })

  it("rejette un pathname visant un autre dossier (isolation entre dossiers)", () => {
    expect(() => validerPathnameSource('autre-dossier/sources/x.jpg', 'd-1')).toThrow(/invalide/)
  })

  it('rejette un pathname hors du sous-dossier sources', () => {
    expect(() => validerPathnameSource('d-1/generations/x.jpg', 'd-1')).toThrow(/invalide/)
  })
})

describe('construireContrainteUploadSource', () => {
  it('contraint type, taille et expiration du jeton', () => {
    const contrainte = construireContrainteUploadSource(() => 1_000_000)

    expect(contrainte).toEqual({
      allowedContentTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      maximumSizeInBytes: 25 * 1024 * 1024,
      addRandomSuffix: false,
      validUntil: 1_000_000 + 5 * 60 * 1000,
    })
  })
})
