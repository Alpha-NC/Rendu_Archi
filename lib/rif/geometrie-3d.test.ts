import { describe, expect, it } from 'vitest'
import {
  creerExtracteurNonConfigure,
  creerGeometryPackVide,
  creerSourceModele3D,
  estCategorieCorrectionValide,
  evaluerAlignement,
  EXTRACTION_PROVIDER_NOT_CONFIGURED,
  GEOMETRY_PACK_SCHEMA_VERSION,
  obtenirAutoriteSource,
} from './geometrie-3d'

describe('obtenirAutoriteSource', () => {
  it('donne la bonne autorité pour chaque rôle connu', () => {
    expect(obtenirAutoriteSource('model_3d')).toBe('GEOMETRIE')
    expect(obtenirAutoriteSource('revit_view')).toBe('CADRAGE_INTENTIONNEL')
    expect(obtenirAutoriteSource('site_photo')).toBe('ENVIRONNEMENT')
    expect(obtenirAutoriteSource('axonometry')).toBe('CONTROLE_SPATIAL_SECONDAIRE')
  })

  it("ne devine jamais une autorité pour un rôle inconnu (jamais implicite)", () => {
    expect(obtenirAutoriteSource('material_reference')).toBeUndefined()
    expect(obtenirAutoriteSource('')).toBeUndefined()
  })
})

describe('creerSourceModele3D', () => {
  it('démarre toujours au statut UPLOADED, sans artefact', () => {
    const source = creerSourceModele3D('file-1', 'rvt', 'application/octet-stream')
    expect(source).toEqual({
      fileId: 'file-1',
      format: 'rvt',
      mimeType: 'application/octet-stream',
      extractionStatus: 'UPLOADED',
      artifactFileIds: [],
    })
  })

  it("accepte n'importe quel format (chaîne ouverte, jamais figée sur rvt)", () => {
    expect(creerSourceModele3D('f', 'ifc').format).toBe('ifc')
    expect(creerSourceModele3D('f', 'un-format-futur-inconnu').format).toBe('un-format-futur-inconnu')
  })
})

describe('creerGeometryPackVide', () => {
  it('porte le schemaVersion courant et aucune donnée inventée', () => {
    const pack = creerGeometryPackVide('file-1')
    expect(pack).toEqual({ schemaVersion: GEOMETRY_PACK_SCHEMA_VERSION, sourceFileId: 'file-1' })
  })
})

describe('evaluerAlignement', () => {
  it('exige une revue humaine sous le seuil de confiance', () => {
    expect(evaluerAlignement(0.5)).toBe('REVIEW_REQUIRED')
  })

  it('accepte un alignement au-dessus du seuil', () => {
    expect(evaluerAlignement(0.9)).toBe('ALIGNED')
  })

  it("reste en traitement tant qu'aucune confiance n'est disponible (jamais une conclusion inventée)", () => {
    expect(evaluerAlignement(undefined)).toBe('PROCESSING')
  })
})

describe('creerExtracteurNonConfigure — aucun faux résultat géométrique', () => {
  it('refuse la validation honnêtement', async () => {
    const extracteur = creerExtracteurNonConfigure()
    await expect(extracteur.validate({ fileId: 'f', format: 'rvt' })).resolves.toEqual({
      valide: false,
      raison: EXTRACTION_PROVIDER_NOT_CONFIGURED,
    })
  })

  it("ne prétend jamais supporter un format, quel qu'il soit", () => {
    const extracteur = creerExtracteurNonConfigure()
    expect(extracteur.supports('rvt')).toBe(false)
    expect(extracteur.supports('ifc')).toBe(false)
  })

  it("lève une erreur explicite plutôt qu'un job fantôme", async () => {
    const extracteur = creerExtracteurNonConfigure()
    await expect(extracteur.extract({ fileId: 'f', format: 'rvt' })).rejects.toThrow(EXTRACTION_PROVIDER_NOT_CONFIGURED)
  })

  it('retourne un échec explicite, jamais un pack géométrique inventé', async () => {
    const extracteur = creerExtracteurNonConfigure()
    const resultat = await extracteur.retrieveArtifacts({ id: 'job-1', sourceFileId: 'f', statut: 'EXTRACTING' })
    expect(resultat.statut).toBe('FAILED')
    expect(resultat.geometryPack).toBeUndefined()
  })
})

describe('estCategorieCorrectionValide', () => {
  it('accepte les 6 catégories documentées', () => {
    expect(estCategorieCorrectionValide('MATERIAL')).toBe(true)
    expect(estCategorieCorrectionValide('ARTIFACT_REMOVAL')).toBe(true)
  })

  it("rejette une catégorie qui laisserait deviner une modification géométrique", () => {
    expect(estCategorieCorrectionValide('GEOMETRY')).toBe(false)
    expect(estCategorieCorrectionValide('')).toBe(false)
  })
})
