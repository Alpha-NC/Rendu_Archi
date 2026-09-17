/**
 * Migrations SQL versionnées pour Neon (dette identifiée le 17.09.2026 :
 * `neon/schema.sql` était appliqué à la main, sans trace de ce qui l'avait
 * été ni quand). Logique pure et injectable ici — aucune dépendance à
 * `@neondatabase/serverless` — pour rester testable sans base réelle,
 * comme le reste du dépôt (`orchestrateur.ts`, `lib/fal/client.ts`).
 *
 * Chaque migration doit être un DDL idempotent (`create table if not
 * exists`, `create index if not exists`…) : la 0001 initiale correspond
 * exactement au schéma déjà en production, et sa réapplication ne doit
 * jamais rien casser.
 */

export interface Migration {
  /** Préfixe numérique du nom de fichier (ex. "0001") — clé de suivi. */
  version: string
  nom: string
  sql: string
}

/**
 * Découpe un fichier de migration en instructions individuelles pour les
 * exécuter une par une dans une transaction (le driver HTTP Neon ne prend
 * qu'une instruction par appel).
 *
 * ponytail : découpage naïf sur `;` après retrait des lignes de commentaire
 * `--` — casserait sur un point-virgule dans une chaîne ou un corps de
 * fonction. Accepté tant que les migrations ne contiennent que du DDL
 * simple (comme neon/schema.sql aujourd'hui) ; à revoir avec un vrai
 * parseur SQL si une migration a besoin de fonctions/triggers.
 */
export function decouperInstructions(sqlBrut: string): string[] {
  return sqlBrut
    .split('\n')
    .filter((ligne) => !ligne.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((instruction) => instruction.trim())
    .filter(Boolean)
}

/** Migrations non encore appliquées, triées par version croissante. */
export function migrationsEnAttente(migrations: Migration[], appliquees: ReadonlySet<string>): Migration[] {
  return [...migrations]
    .sort((a, b) => a.version.localeCompare(b.version))
    .filter((migration) => !appliquees.has(migration.version))
}

export interface ExecuteurMigration {
  /**
   * Exécute la migration ET enregistre son passage dans `schema_migrations`
   * en une seule transaction atomique (jamais l'un sans l'autre) — un
   * échec ne doit jamais laisser une migration à moitié appliquée ni
   * marquée appliquée à tort.
   */
  appliquerUne(migration: Migration): Promise<void>
}

export interface ResultatMigration {
  appliquees: string[]
  echec?: { version: string; message: string }
}

/**
 * Applique dans l'ordre les migrations en attente. S'arrête à la première
 * en échec — jamais de tentative sur les suivantes (une migration peut
 * dépendre de la précédente). Ne rejoue jamais une migration déjà listée
 * dans `appliquees`.
 */
export async function appliquerMigrationsEnAttente(
  executeur: ExecuteurMigration,
  migrations: Migration[],
  appliquees: ReadonlySet<string>,
): Promise<ResultatMigration> {
  const aAppliquer = migrationsEnAttente(migrations, appliquees)
  const appliqueesMaintenant: string[] = []

  for (const migration of aAppliquer) {
    try {
      await executeur.appliquerUne(migration)
      appliqueesMaintenant.push(migration.version)
    } catch (erreur) {
      return {
        appliquees: appliqueesMaintenant,
        echec: { version: migration.version, message: erreur instanceof Error ? erreur.message : String(erreur) },
      }
    }
  }

  return { appliquees: appliqueesMaintenant }
}
