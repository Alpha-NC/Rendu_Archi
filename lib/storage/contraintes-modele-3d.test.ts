import { describe, expect, it } from 'vitest'
import { construireContrainteUploadModele3D, validerPathnameModele3D } from './contraintes-modele-3d'

describe('validerPathnameModele3D', () => {
  it('accepte un pathname dans le bon dossier', () => {
    expect(() => validerPathnameModele3D('d-1/modele-3d/projet.rvt', 'd-1')).not.toThrow()
  })

  it('rejette un pathname visant un autre dossier', () => {
    expect(() => validerPathnameModele3D('autre-dossier/modele-3d/x.rvt', 'd-1')).toThrow(/invalide/)
  })

  it('rejette un pathname hors du sous-dossier modele-3d (ex. sources images)', () => {
    expect(() => validerPathnameModele3D('d-1/sources/x.jpg', 'd-1')).toThrow(/invalide/)
  })
})

describe('construireContrainteUploadModele3D', () => {
  it('contraint la taille (500 Mo) et expiration du jeton, sans restreindre le format', () => {
    const contrainte = construireContrainteUploadModele3D(() => 1_000_000)
    expect(contrainte).toEqual({
      maximumSizeInBytes: 500 * 1024 * 1024,
      addRandomSuffix: false,
      validUntil: 1_000_000 + 5 * 60 * 1000,
    })
  })
})
