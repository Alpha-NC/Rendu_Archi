import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { creerDepotSupabase } from './depot-supabase'

/**
 * Seule la résolution d'URLs signées est testée ici : c'est le seul endroit
 * de ce fichier où une erreur est invisible en relecture. `.in()` ne
 * garantit aucun ordre de retour, et les appelants apparient par index —
 * un désordre étiquetterait la vue Revit comme photo de site (inversion de
 * la hiérarchie d'autorité du Framework).
 */
function clientQuiRenvoieDansLeDesordre(): SupabaseClient {
  return {
    from: () => ({
      select: () => ({
        // Ordre volontairement inverse de la demande, comme Postgres a le
        // droit de le faire sur un `IN`.
        in: async (_col: string, ids: string[]) => ({
          data: [...ids].reverse().map((id) => ({ id, storage_key: `cle/${id}` })),
          error: null,
        }),
      }),
    }),
    storage: {
      from: () => ({
        createSignedUrl: async (cle: string) => ({
          data: { signedUrl: `https://signe/${cle}` },
          error: null,
        }),
      }),
    },
  } as unknown as SupabaseClient
}

describe('resolverUrlsSignees', () => {
  it("respecte l'ordre demandé même si la base renvoie les lignes dans le désordre", async () => {
    const depot = creerDepotSupabase(clientQuiRenvoieDansLeDesordre())
    const urls = await depot.resolverUrlsSignees(['revit-1', 'photo-2', 'axono-3'])
    expect(urls).toEqual([
      'https://signe/cle/revit-1',
      'https://signe/cle/photo-2',
      'https://signe/cle/axono-3',
    ])
  })

  it('échoue franchement si un fichier demandé est absent, sans décaler les autres', async () => {
    const client = {
      from: () => ({
        select: () => ({
          in: async () => ({ data: [{ id: 'revit-1', storage_key: 'cle/revit-1' }], error: null }),
        }),
      }),
      storage: {
        from: () => ({
          createSignedUrl: async (cle: string) => ({ data: { signedUrl: `https://signe/${cle}` }, error: null }),
        }),
      },
    } as unknown as SupabaseClient

    const depot = creerDepotSupabase(client)
    await expect(depot.resolverUrlsSignees(['revit-1', 'disparu-2'])).rejects.toThrow(/disparu-2/)
  })

  it('ne fait aucun appel pour une liste vide', async () => {
    const depot = creerDepotSupabase({} as SupabaseClient)
    expect(await depot.resolverUrlsSignees([])).toEqual([])
  })
})
