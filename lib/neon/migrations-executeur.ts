import { Client, type NeonQueryFunction } from '@neondatabase/serverless'
import type { ExecuteurMigration, Migration } from './migrations.ts'

/**
 * Traduction SQL de `ExecuteurMigration`.
 *
 * `appliquerUne` utilise le `Client` WebSocket (protocole Postgres complet,
 * connexion avec état) — jamais le driver HTTP `neon()` utilisé ailleurs
 * dans l'app pour les requêtes par requête. Le driver HTTP n'exécute qu'une
 * instruction paramétrée par appel (protocole « extended query » de
 * Postgres) ; découper un fichier de migration sur `;` pour s'y plier
 * cassait sur tout ce qui n'est pas du DDL trivial (DO $$...$$, CREATE
 * FUNCTION/TRIGGER, chaîne contenant un `;`). Le `Client` WebSocket ouvre
 * une vraie session : BEGIN/COMMIT/ROLLBACK réels, et
 * `client.query(texteBrut)` sans paramètres passe par le protocole
 * « simple query » de Postgres, qui accepte plusieurs instructions et fait
 * sa propre analyse syntaxique — le fichier de migration est exécuté TEL
 * QUEL, sans le découper nous-mêmes.
 *
 * Non testée contre une base réelle dans cette suite (comme
 * depot-neon.ts) — la logique d'enchaînement (BEGIN/query/insert/COMMIT,
 * ROLLBACK + non-écriture de schema_migrations en cas d'échec) est testée
 * dans migrations-executeur.test.ts avec un Client mocké. Vérifié
 * manuellement contre Neon réel le 17.09.2026 : DO block, CREATE FUNCTION,
 * CREATE TRIGGER, chaîne contenant `;`, commentaire, ROLLBACK complet sans
 * laisser de trace — voir DECISIONS.md.
 */
export function creerExecuteurMigration(connectionString: string): ExecuteurMigration {
  return {
    async appliquerUne(migration: Migration) {
      const client = new Client(connectionString)
      await client.connect()
      try {
        await client.query('BEGIN')
        await client.query(migration.sql)
        await client.query('insert into schema_migrations (version) values ($1)', [migration.version])
        await client.query('COMMIT')
      } catch (erreur) {
        await client.query('ROLLBACK').catch(() => {})
        throw erreur
      } finally {
        await client.end()
      }
    },
  }
}

type Sql = NeonQueryFunction<false, false>

/**
 * Instructions uniques et non paramétrées : le driver HTTP léger suffit,
 * pas besoin d'ouvrir une session WebSocket pour ça.
 */
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
