import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { extraireImageUrl, genererEtAttendre } from './client'

/** Faux fetch piloté par une file de réponses successives. */
function fauxFetch(reponses: Array<{ ok?: boolean; status?: number; corps: unknown }>) {
  let appel = 0
  const impl = vi.fn(async () => {
    const reponse = reponses[Math.min(appel, reponses.length - 1)]
    appel += 1
    return {
      ok: reponse.ok ?? true,
      status: reponse.status ?? 200,
      json: async () => reponse.corps,
    } as unknown as Response
  })
  return impl as unknown as typeof fetch
}

const sansAttente = async () => {}

beforeEach(() => {
  process.env.FAL_KEY = 'cle-de-test'
})

afterEach(() => {
  delete process.env.FAL_KEY
})

describe('extraireImageUrl — un request_id n\'est pas un résultat (prémortem #2)', () => {
  it('extrait une URL valide', () => {
    expect(extraireImageUrl({ images: [{ url: 'https://fal.media/rendu.png' }] })).toBe(
      'https://fal.media/rendu.png',
    )
  })

  it('refuse une réponse de mise en file, même avec request_id', () => {
    expect(extraireImageUrl({ status: 'IN_QUEUE', request_id: 'req-1' })).toBeNull()
  })

  it('refuse une liste d\'images vide ou malformée', () => {
    expect(extraireImageUrl({ images: [] })).toBeNull()
    expect(extraireImageUrl({ images: [{}] })).toBeNull()
    expect(extraireImageUrl(null)).toBeNull()
  })
})

describe('genererEtAttendre — polling jusqu\'à un état terminal', () => {
  it('poursuit le polling tant que le statut est IN_QUEUE puis IN_PROGRESS', async () => {
    const resultat = await genererEtAttendre(
      { prompt: 'p', imageUrls: ['https://exemple/1.png'] },
      {
        fetchImpl: fauxFetch([
          { corps: { request_id: 'req-1' } },
          { corps: { status: 'IN_QUEUE' } },
          { corps: { status: 'IN_PROGRESS' } },
          { corps: { status: 'COMPLETED' } },
          { corps: { images: [{ url: 'https://fal.media/ok.png' }] } },
        ]),
        attendre: sansAttente,
      },
    )

    expect(resultat).toEqual({
      statut: 'succes',
      imageUrl: 'https://fal.media/ok.png',
      requestId: 'req-1',
    })
  })

  it('ne présente jamais un IN_QUEUE comme un succès, même au timeout', async () => {
    let horloge = 0
    const resultat = await genererEtAttendre(
      { prompt: 'p', imageUrls: [] },
      {
        fetchImpl: fauxFetch([
          { corps: { request_id: 'req-2' } },
          { corps: { status: 'IN_QUEUE' } },
        ]),
        attendre: sansAttente,
        timeoutMs: 5_000,
        // L'horloge avance à chaque lecture : le timeout finit par tomber.
        maintenant: () => (horloge += 1_000),
      },
    )

    expect(resultat.statut).toBe('echec')
    if (resultat.statut === 'echec') {
      expect(resultat.code).toBe('timeout')
      expect(resultat.requestId).toBe('req-2')
    }
  })

  it('échoue explicitement si le statut terminal n\'est pas COMPLETED', async () => {
    const resultat = await genererEtAttendre(
      { prompt: 'p', imageUrls: [] },
      {
        fetchImpl: fauxFetch([
          { corps: { request_id: 'req-3' } },
          { corps: { status: 'FAILED' } },
        ]),
        attendre: sansAttente,
      },
    )
    expect(resultat.statut).toBe('echec')
    if (resultat.statut === 'echec') expect(resultat.code).toBe('generation_echouee')
  })

  it('échoue si COMPLETED ne contient pas d\'image exploitable', async () => {
    const resultat = await genererEtAttendre(
      { prompt: 'p', imageUrls: [] },
      {
        fetchImpl: fauxFetch([
          { corps: { request_id: 'req-4' } },
          { corps: { status: 'COMPLETED' } },
          { corps: { detail: 'rien ici' } },
        ]),
        attendre: sansAttente,
      },
    )
    expect(resultat.statut).toBe('echec')
    if (resultat.statut === 'echec') expect(resultat.code).toBe('reponse_inexploitable')
  })

  it('échoue proprement si la soumission est refusée', async () => {
    const resultat = await genererEtAttendre(
      { prompt: 'p', imageUrls: [] },
      {
        fetchImpl: fauxFetch([{ ok: false, status: 401, corps: {} }]),
        attendre: sansAttente,
      },
    )
    expect(resultat.statut).toBe('echec')
    if (resultat.statut === 'echec') expect(resultat.code).toBe('fal_ai_echec')
  })

  it('échoue si la soumission ne renvoie pas de request_id', async () => {
    const resultat = await genererEtAttendre(
      { prompt: 'p', imageUrls: [] },
      { fetchImpl: fauxFetch([{ corps: {} }]), attendre: sansAttente },
    )
    expect(resultat.statut).toBe('echec')
    if (resultat.statut === 'echec') expect(resultat.code).toBe('reponse_inexploitable')
  })
})
