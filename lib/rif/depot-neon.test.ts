import { describe, expect, it, vi } from 'vitest'
import type { NeonQueryFunction } from '@neondatabase/serverless'
import { resolverUrlSignee } from '../storage/vercel-blob'
import { creerDepotNeon } from './depot-neon'

vi.mock('../storage/vercel-blob', () => ({
  televerserFichier: vi.fn(),
  resolverUrlSignee: vi.fn(async (storageKey: string) => `https://signe/${storageKey}`),
}))

/**
 * Seule la résolution d'URLs signées est testée ici : c'est le seul endroit
 * de ce fichier où une erreur est invisible en relecture. `any(...)` ne
 * garantit aucun ordre de retour, comme le `.in()` de Supabase, et les
 * appelants apparient par index — un désordre étiquetterait la vue Revit
 * comme photo de site (inversion de la hiérarchie d'autorité du Framework).
 * Même contrat, même risque, même test que depot-supabase.test.ts.
 */
function sqlQuiRenvoieDansLeDesordre(): NeonQueryFunction<false, false> {
  const sql = (async (_strings: TemplateStringsArray, ...ids: unknown[]) => {
    const idsDemandes = ids[0] as string[]
    // Ordre volontairement inverse de la demande, comme Postgres a le
    // droit de le faire sur un `= any(...)`.
    return [...idsDemandes].reverse().map((id) => ({ id, storage_key: `cle/${id}` }))
  }) as unknown as NeonQueryFunction<false, false>
  return sql
}

describe('resolverUrlsSignees', () => {
  it("respecte l'ordre demandé même si la base renvoie les lignes dans le désordre", async () => {
    const depot = creerDepotNeon(sqlQuiRenvoieDansLeDesordre())
    const urls = await depot.resolverUrlsSignees(['revit-1', 'photo-2', 'axono-3'])
    expect(urls).toEqual([
      'https://signe/cle/revit-1',
      'https://signe/cle/photo-2',
      'https://signe/cle/axono-3',
    ])
  })

  it('échoue franchement si un fichier demandé est absent, sans décaler les autres', async () => {
    const sql = (async () => [{ id: 'revit-1', storage_key: 'cle/revit-1' }]) as unknown as NeonQueryFunction<
      false,
      false
    >
    const depot = creerDepotNeon(sql)
    await expect(depot.resolverUrlsSignees(['revit-1', 'disparu-2'])).rejects.toThrow(/disparu-2/)
  })

  it('ne fait aucun appel pour une liste vide', async () => {
    const depot = creerDepotNeon({} as NeonQueryFunction<false, false>)
    expect(await depot.resolverUrlsSignees([])).toEqual([])
    expect(resolverUrlSignee).not.toHaveBeenCalled()
  })
})
