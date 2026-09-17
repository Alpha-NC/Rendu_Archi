/**
 * CLI de migrations Neon (D-19, dette « pas de système de migrations
 * versionnées » identifiée le 17.09.2026). Exécuté directement via Node
 * (support TypeScript natif, Node 24) — jamais connecté au build Vercel
 * tant que le mécanisme n'a pas été validé manuellement.
 *
 * Usage :
 *   npm run db:migrate           — applique les migrations en attente
 *   npm run db:migrate:status    — liste l'état de chaque migration
 */
import { neon } from '@neondatabase/serverless'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { appliquerMigrationsEnAttente, migrationsEnAttente, type Migration } from '../lib/neon/migrations.ts'
import { creerExecuteurMigration, creerTableSuivi, obtenirMigrationsAppliquees } from '../lib/neon/migrations-executeur.ts'

const DOSSIER_MIGRATIONS = join(import.meta.dirname, '..', 'neon', 'migrations')

function chargerMigrations(): Migration[] {
  return readdirSync(DOSSIER_MIGRATIONS)
    .filter((nom) => nom.endsWith('.sql'))
    .map((nom) => ({
      version: nom.split('_')[0],
      nom,
      sql: readFileSync(join(DOSSIER_MIGRATIONS, nom), 'utf8'),
    }))
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL absente de l\'environnement — voir .env.local ou `neon checkout <branche>`.')
    process.exit(1)
  }

  const sql = neon(databaseUrl)
  await creerTableSuivi(sql)
  const appliquees = await obtenirMigrationsAppliquees(sql)
  const migrations = chargerMigrations()

  if (process.argv.includes('--status')) {
    for (const migration of [...migrations].sort((a, b) => a.version.localeCompare(b.version))) {
      console.log(`${appliquees.has(migration.version) ? '[appliquée]' : '[en attente]'} ${migration.nom}`)
    }
    return
  }

  const enAttente = migrationsEnAttente(migrations, appliquees)
  if (enAttente.length === 0) {
    console.log('Base à jour — aucune migration en attente.')
    return
  }

  console.log(`${enAttente.length} migration(s) à appliquer : ${enAttente.map((m) => m.nom).join(', ')}`)
  const resultat = await appliquerMigrationsEnAttente(creerExecuteurMigration(databaseUrl), migrations, appliquees)

  for (const version of resultat.appliquees) {
    console.log(`  OK  ${version}`)
  }

  if (resultat.echec) {
    console.error(`  ÉCHEC ${resultat.echec.version} : ${resultat.echec.message}`)
    console.error('Arrêt — les migrations suivantes ne sont pas tentées.')
    process.exit(1)
  }

  console.log(`${resultat.appliquees.length} migration(s) appliquée(s) avec succès.`)
}

main().catch((erreur) => {
  console.error(erreur instanceof Error ? erreur.message : erreur)
  process.exit(1)
})
