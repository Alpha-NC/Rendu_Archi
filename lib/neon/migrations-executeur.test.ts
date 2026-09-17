import { describe, expect, it, vi } from 'vitest'
import { creerExecuteurMigration } from './migrations-executeur'

const connect = vi.fn()
const query = vi.fn()
const end = vi.fn()

vi.mock('@neondatabase/serverless', () => ({
  // Fonction classique, pas une flèche : `new Client(...)` exige un
  // constructeur, une arrow function n'en est jamais un.
  Client: vi.fn().mockImplementation(function () {
    return { connect, query, end }
  }),
}))

const migration = { version: '0001', nom: '0001_test.sql', sql: "select 'a;b'; DO $$ BEGIN NULL; END $$; -- commentaire" }

describe('creerExecuteurMigration', () => {
  it('exécute le fichier de migration TEL QUEL, sans le découper sur les points-virgules', async () => {
    query.mockResolvedValue({ rows: [] })
    const executeur = creerExecuteurMigration('postgres://test')

    await executeur.appliquerUne(migration)

    // Un seul appel avec le texte brut complet — jamais splitté, jamais réécrit.
    expect(query).toHaveBeenCalledWith(migration.sql)
  })

  it('enchaîne BEGIN, la migration, l\'enregistrement et COMMIT, dans cet ordre', async () => {
    query.mockClear()
    query.mockResolvedValue({ rows: [] })
    const executeur = creerExecuteurMigration('postgres://test')

    await executeur.appliquerUne(migration)

    expect(query.mock.calls.map((appel) => appel[0])).toEqual([
      'BEGIN',
      migration.sql,
      'insert into schema_migrations (version) values ($1)',
      'COMMIT',
    ])
    expect(query.mock.calls[2][1]).toEqual(['0001'])
  })

  it('ferme toujours la connexion, même en cas de succès', async () => {
    end.mockClear()
    query.mockResolvedValue({ rows: [] })
    const executeur = creerExecuteurMigration('postgres://test')

    await executeur.appliquerUne(migration)

    expect(end).toHaveBeenCalledTimes(1)
  })

  it("échec au milieu d'une migration : ROLLBACK, jamais l'enregistrement dans schema_migrations, erreur propagée", async () => {
    query.mockClear()
    end.mockClear()
    query.mockImplementation(async (texte: string) => {
      if (texte === migration.sql) throw new Error('colonne inexistante')
      return { rows: [] }
    })
    const executeur = creerExecuteurMigration('postgres://test')

    await expect(executeur.appliquerUne(migration)).rejects.toThrow('colonne inexistante')

    const appels = query.mock.calls.map((appel) => appel[0])
    expect(appels).toContain('ROLLBACK')
    expect(appels).not.toContain('insert into schema_migrations (version) values ($1)')
    expect(end).toHaveBeenCalledTimes(1) // la connexion est fermée même après l'échec
  })

  it('ferme la connexion même si le ROLLBACK lui-même échoue', async () => {
    query.mockClear()
    end.mockClear()
    query.mockImplementation(async (texte: string) => {
      if (texte === migration.sql) throw new Error('échec migration')
      if (texte === 'ROLLBACK') throw new Error('connexion déjà perdue')
      return { rows: [] }
    })
    const executeur = creerExecuteurMigration('postgres://test')

    await expect(executeur.appliquerUne(migration)).rejects.toThrow('échec migration')
    expect(end).toHaveBeenCalledTimes(1)
  })
})
