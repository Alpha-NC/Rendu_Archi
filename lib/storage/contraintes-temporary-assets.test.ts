import { describe, expect, it } from 'vitest'
import {
  construireContrainteUploadTemporaryAsset,
  MIME_TEMPORARY_ASSETS_ACCEPTES,
  TAILLE_TEMPORARY_ASSET_MAX_OCTETS,
  validerPathnameTemporaryAsset,
} from './contraintes-temporary-assets'

describe('validerPathnameTemporaryAsset', () => {
  it('accepte un pathname dans le bon dossier', () => {
    expect(() => validerPathnameTemporaryAsset('d-1/temporary-assets/photo-1.jpg', 'd-1')).not.toThrow()
  })

  it('rejette un pathname visant un autre dossier', () => {
    expect(() => validerPathnameTemporaryAsset('autre-dossier/temporary-assets/x.jpg', 'd-1')).toThrow(/invalide/)
  })

  it('rejette un pathname hors du sous-dossier temporary-assets (ex. sources principales)', () => {
    expect(() => validerPathnameTemporaryAsset('d-1/sources/x.jpg', 'd-1')).toThrow(/invalide/)
  })
})

describe('construireContrainteUploadTemporaryAsset', () => {
  it('contraint type, taille (20 Mo, généreux au-delà des 8-10 Mo confirmés) et expiration', () => {
    const contrainte = construireContrainteUploadTemporaryAsset(() => 1_000_000)
    expect(contrainte).toEqual({
      allowedContentTypes: [...MIME_TEMPORARY_ASSETS_ACCEPTES],
      maximumSizeInBytes: TAILLE_TEMPORARY_ASSET_MAX_OCTETS,
      addRandomSuffix: false,
      validUntil: 1_000_000 + 5 * 60 * 1000,
    })
  })
})
