import { describe, expect, it, vi } from 'vitest'
import {
  appliquerMigrationsEnAttente,
  decouperInstructions,
  migrationsEnAttente,
  type ExecuteurMigration,
  type Migration,
} from './migrations'

function migration(version: string, sql = 'select 1'): Migration {
  return { version, nom: `${version}_test.sql`, sql }
}

describe('decouperInstructions', () => {
  it('découpe plusieurs instructions et retire les lignes de commentaire', () => {
    const instructions = decouperInstructions(`
      -- commentaire à ignorer
      create table if not exists a (id uuid);
      create index if not exists a_idx on a (id);
    `)
    expect(instructions).toEqual([
      'create table if not exists a (id uuid)',
      'create index if not exists a_idx on a (id)',
    ])
  })

  it('ignore les lignes vides et ne renvoie rien pour un fichier vide', () => {
    expect(decouperInstructions('\n  \n-- rien que des commentaires\n')).toEqual([])
  })
})

describe('migrationsEnAttente', () => {
  it("base vide : toutes les migrations sont en attente, triées par version", () => {
    const migrations = [migration('0002'), migration('0001')]
    expect(migrationsEnAttente(migrations, new Set())).toEqual([migration('0001'), migration('0002')])
  })

  it('base déjà à jour : aucune migration en attente', () => {
    const migrations = [migration('0001'), migration('0002')]
    expect(migrationsEnAttente(migrations, new Set(['0001', '0002']))).toEqual([])
  })

  it('ne renvoie que les migrations non encore appliquées', () => {
    const migrations = [migration('0001'), migration('0002'), migration('0003')]
    expect(migrationsEnAttente(migrations, new Set(['0001']))).toEqual([migration('0002'), migration('0003')])
  })
})

describe('appliquerMigrationsEnAttente', () => {
  it('applique les migrations en attente dans l\'ordre, une seule fois chacune', async () => {
    const appliquees: string[] = []
    const executeur: ExecuteurMigration = { appliquerUne: vi.fn(async (m) => { appliquees.push(m.version) }) }

    const resultat = await appliquerMigrationsEnAttente(executeur, [migration('0002'), migration('0001')], new Set())

    expect(appliquees).toEqual(['0001', '0002'])
    expect(resultat).toEqual({ appliquees: ['0001', '0002'] })
  })

  it('ne rejoue jamais une migration déjà appliquée', async () => {
    const executeur: ExecuteurMigration = { appliquerUne: vi.fn(async () => {}) }

    await appliquerMigrationsEnAttente(executeur, [migration('0001'), migration('0002')], new Set(['0001']))

    expect(executeur.appliquerUne).toHaveBeenCalledTimes(1)
    expect(executeur.appliquerUne).toHaveBeenCalledWith(migration('0002'))
  })

  it("s'arrête à la première migration invalide sans tenter les suivantes", async () => {
    const appelee: string[] = []
    const executeur: ExecuteurMigration = {
      appliquerUne: vi.fn(async (m) => {
        appelee.push(m.version)
        if (m.version === '0002') throw new Error('colonne inexistante')
      }),
    }

    const resultat = await appliquerMigrationsEnAttente(
      executeur,
      [migration('0001'), migration('0002'), migration('0003')],
      new Set(),
    )

    expect(appelee).toEqual(['0001', '0002']) // jamais 0003
    expect(resultat).toEqual({ appliquees: ['0001'], echec: { version: '0002', message: 'colonne inexistante' } })
  })

  it('ne fait rien sur une base déjà à jour', async () => {
    const executeur: ExecuteurMigration = { appliquerUne: vi.fn(async () => {}) }

    const resultat = await appliquerMigrationsEnAttente(executeur, [migration('0001')], new Set(['0001']))

    expect(executeur.appliquerUne).not.toHaveBeenCalled()
    expect(resultat).toEqual({ appliquees: [] })
  })
})
