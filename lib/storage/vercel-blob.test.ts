import { afterEach, describe, expect, it, vi } from 'vitest'
import { del, get, issueSignedToken, presignUrl, put } from '@vercel/blob'
import { lireFichier, resolverUrlSignee, supprimerFichier, televerserFichier, verifierBlobConfigure } from './vercel-blob'

vi.mock('@vercel/blob', () => ({
  put: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
  issueSignedToken: vi.fn(),
  presignUrl: vi.fn(),
}))

describe('televerserFichier', () => {
  it('téléverse en accès privé, sans suffixe aléatoire ni écrasement silencieux', async () => {
    vi.mocked(put).mockResolvedValue({
      pathname: 'user-1/dossier-1/sources/revit_view-123.jpg',
      url: 'https://exemple.public.blob.vercel-storage.com/user-1/dossier-1/sources/revit_view-123.jpg',
      contentType: 'image/jpeg',
    } as never)

    const resultat = await televerserFichier(
      'user-1/dossier-1/sources/revit_view-123.jpg',
      new ArrayBuffer(8),
      'image/jpeg',
    )

    expect(put).toHaveBeenCalledWith(
      'user-1/dossier-1/sources/revit_view-123.jpg',
      expect.any(ArrayBuffer),
      { access: 'private', contentType: 'image/jpeg', addRandomSuffix: false, allowOverwrite: false },
    )
    expect(resultat).toEqual({
      pathname: 'user-1/dossier-1/sources/revit_view-123.jpg',
      url: 'https://exemple.public.blob.vercel-storage.com/user-1/dossier-1/sources/revit_view-123.jpg',
      contentType: 'image/jpeg',
    })
  })
})

describe('lireFichier', () => {
  it('lit un fichier privé et renvoie son contenu et son type', async () => {
    const octets = new TextEncoder().encode('contenu-test')
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(octets)
        controller.close()
      },
    })
    vi.mocked(get).mockResolvedValue({
      statusCode: 200,
      stream,
      headers: new Headers(),
      blob: { contentType: 'image/png', size: octets.byteLength } as never,
    } as never)

    const resultat = await lireFichier('user-1/dossier-1/sources/x.png')

    expect(get).toHaveBeenCalledWith('user-1/dossier-1/sources/x.png', { access: 'private' })
    expect(resultat.contentType).toBe('image/png')
    expect(Array.from(new Uint8Array(resultat.contenu))).toEqual(Array.from(octets))
  })

  it('lève une erreur explicite si le fichier est introuvable, jamais un résultat vide silencieux', async () => {
    vi.mocked(get).mockResolvedValue(null)
    await expect(lireFichier('inexistant')).rejects.toThrow(/introuvable/)
  })

  it('lève une erreur explicite sur un statut inattendu (ex. 304)', async () => {
    vi.mocked(get).mockResolvedValue({ statusCode: 304, stream: null, headers: new Headers(), blob: {} } as never)
    await expect(lireFichier('x')).rejects.toThrow(/introuvable/)
  })
})

describe('resolverUrlSignee', () => {
  it('compose issueSignedToken puis presignUrl pour produire une URL de lecture temporaire', async () => {
    vi.mocked(issueSignedToken).mockResolvedValue({
      delegationToken: 'delegation-abc',
      clientSigningToken: 'signing-abc',
      validUntil: 0,
    } as never)
    vi.mocked(presignUrl).mockResolvedValue({
      presignedUrl: 'https://exemple.public.blob.vercel-storage.com/user-1/dossier-1/sources/x.png?vercel-blob-delegation=...',
    } as never)

    const url = await resolverUrlSignee('user-1/dossier-1/sources/x.png', 300)

    expect(issueSignedToken).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: 'user-1/dossier-1/sources/x.png', operations: ['get'] }),
    )
    expect(presignUrl).toHaveBeenCalledWith(
      { clientSigningToken: 'signing-abc', delegationToken: 'delegation-abc' },
      expect.objectContaining({ operation: 'get', pathname: 'user-1/dossier-1/sources/x.png', access: 'private' }),
    )
    expect(url).toBe('https://exemple.public.blob.vercel-storage.com/user-1/dossier-1/sources/x.png?vercel-blob-delegation=...')
  })
})

describe('supprimerFichier', () => {
  it('délègue au SDK avec le pathname fourni', async () => {
    vi.mocked(del).mockResolvedValue(undefined)
    await supprimerFichier('user-1/dossier-1/sources/x.png')
    expect(del).toHaveBeenCalledWith('user-1/dossier-1/sources/x.png')
  })
})

describe('verifierBlobConfigure — Lot 2 Source Lifecycle (D-23)', () => {
  const original = process.env.BLOB_READ_WRITE_TOKEN

  afterEach(() => {
    if (original === undefined) delete process.env.BLOB_READ_WRITE_TOKEN
    else process.env.BLOB_READ_WRITE_TOKEN = original
  })

  it('lève une erreur explicite si la variable est absente', () => {
    delete process.env.BLOB_READ_WRITE_TOKEN
    expect(() => verifierBlobConfigure()).toThrow(/BLOB_READ_WRITE_TOKEN/)
  })

  it('lève une erreur explicite si la variable est une chaîne vide (le bug diagnostiqué)', () => {
    process.env.BLOB_READ_WRITE_TOKEN = ''
    expect(() => verifierBlobConfigure()).toThrow(/BLOB_READ_WRITE_TOKEN/)
  })

  it('lève une erreur explicite si la variable ne contient que des espaces', () => {
    process.env.BLOB_READ_WRITE_TOKEN = '   '
    expect(() => verifierBlobConfigure()).toThrow(/BLOB_READ_WRITE_TOKEN/)
  })

  it('ne lève rien si la variable est réellement configurée', () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test_token'
    expect(() => verifierBlobConfigure()).not.toThrow()
  })
})
