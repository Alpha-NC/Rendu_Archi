import type { NeonQueryFunction } from '@neondatabase/serverless'
import { decouperInstructions, type ExecuteurMigration, type Migration } from './migrations.ts'

/**
 * Traduction SQL de `ExecuteurMigration` — non testée contre une base
 * réelle dans cette suite, comme `depot-neon.ts` : la logique qui compte
 * (ordre, non-répétition, arrêt sur échec) est testée dans
 * `migrations.test.ts` via un exécuteur en mémoire.
 */

type Sql = NeonQueryFunction<false, false>

export function creerExecuteurMigration(sql: Sql): ExecuteurMigration {
  return {
    async appliquerUne(migration: Migration) {
      const instructions = decouperInstructions(migration.sql)
      // Une seule transaction HTTP (sql.transaction) : la migration ET son
      // enregistrement dans schema_migrations passent ou échouent ensemble
      // — jamais une migration à moitié appliquée ni marquée à tort.
      await sql.transaction((tx) => [
        ...instructions.map((instruction) => tx.query(instruction)),
        tx.query('insert into schema_migrations (version) values ($1)', [migration.version]),
      ])
    },
  }
}

export async function creerTableSuivi(sql: Sql): Promise<void> {
  await sql`
    create table if not exists schema_migrations (
      version text primary key,
      applied_at timestamptz not null default now()
    )
  `
}

export async function obtenirMigrationsAppliquees(sql: Sql): Promise<Set<string>> {
  const lignes = await sql`select version from schema_migrations`
  return new Set(lignes.map((ligne) => ligne.version as string))
}
