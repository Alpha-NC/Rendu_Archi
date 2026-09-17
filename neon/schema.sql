-- Schéma Neon PostgreSQL — RIF-App (PRD V2.1 §16, D-19)
--
-- Port de supabase/schema-rif-app.sql vers la cible Neon. Différences
-- délibérées, pas un oubli :
--
-- 1. Aucune RLS, aucune policy. PRD V2.1 §16.3 : « Le navigateur ne se
--    connecte jamais directement à Neon [...] la V2.1 ne dépend donc pas
--    d'un accès anonyme direct à la base ni d'un système RLS exposé au
--    navigateur. » La RLS était la défense de Supabase contre un accès
--    client direct ; ce risque n'existe plus dans cette architecture — la
--    défense en profondeur reste `verifierProprietaire` côté Route Handler
--    (app/api/dossiers/_lib/reponse.ts), inchangée.
-- 2. `auth.users` (fourni par Supabase Auth) remplacé par une table `users`
--    minimale — Neon n'a pas d'équivalent intégré. Aucune ligne semée ici :
--    peupler cette table est le lot « authentification mono-utilisateur »
--    (PRD V2.1 §16.5), pas celui-ci.
-- 3. `profiles` (rôle client/supervisor) supprimé, pas porté. PRD V2.1
--    §16.5 : « aucune gestion d'organisation, aucun système de rôles
--    complexe. » Autrefois D-03 gardait un compte de supervision
--    Alpha_no_code — le PRD V2.1 le retire explicitement du périmètre.
-- 4. Aucune section stockage : les fichiers vont dans Vercel Blob
--    (lib/storage/vercel-blob.ts), jamais dans Postgres.
--
-- Non exécuté depuis cet environnement — action utilisateur, comme pour
-- supabase/schema-rif-app.sql (docs/provisioning-supabase.md). Aucune
-- donnée réelle à migrer : le projet Supabase actuel n'a jamais reçu de
-- dossier réel (D-19, audit du 12.09.2026).

-- =========================================================================
-- 1. Utilisateurs — remplace auth.users (Supabase Auth n'existe plus ici)
-- =========================================================================

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- 2. Dossiers — source de vérité du ProjectState (PRD §10, §13.1)
-- =========================================================================

create table if not exists dossiers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users (id),
  dossier_ref text not null,
  -- D-19 : 12 états (PRD V2.1 §17) — voir lib/rif/etat-machine.ts.
  workflow_state text not null default 'BROUILLON' check (
    workflow_state in (
      'BROUILLON', 'SOURCES_RECUES', 'SOURCES_ANALYSEES',
      'CONTEXTE_A_CONFIRMER', 'PRET_A_GENERER',
      'GENERATION_EN_COURS', 'CONTROLE_A_EXAMINER',
      'VALIDE', 'A_CORRIGER', 'A_REPRENDRE', 'SUSPENDU', 'ECHEC'
    )
  ),
  project_state jsonb not null default '{}'::jsonb,
  project_state_revision integer not null default 0,
  framework_version text not null,
  implementation_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dossiers_owner_idx on dossiers (owner_id, created_at desc);

-- =========================================================================
-- 3. Files — métadonnées des sources et rendus (PRD §12, §13.2, §16.4)
--
-- Le fichier lui-même vit dans Vercel Blob ; `storage_key` porte le
-- pathname du blob (même rôle que storage_key pour Supabase Storage).
-- =========================================================================

create table if not exists files (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references dossiers (id) on delete cascade,
  role_detected text,
  role_confirmed text,
  original_name text not null,
  safe_name text not null,
  storage_key text not null,
  mime_type text,
  size_bytes bigint,
  checksum text,
  created_at timestamptz not null default now()
);

create index if not exists files_dossier_idx on files (dossier_id);

-- =========================================================================
-- 4. Generations — journal transactionnel des appels au moteur (PRD §13.3, §18.1)
-- =========================================================================

create table if not exists generations (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references dossiers (id) on delete cascade,
  type text not null check (type in ('initial', 'correction', 'restart_from_sources')),
  batch_id uuid not null default gen_random_uuid(),
  variant_index integer not null default 0,
  status text not null default 'queued' check (
    status in ('queued', 'running', 'succeeded', 'failed', 'timed_out')
  ),
  project_state_revision integer not null,
  prompt_text text not null,
  source_file_ids jsonb not null default '[]'::jsonb,
  result_file_id uuid references files (id),
  is_canonical boolean not null default false,
  provider_request_id text,
  cost_actual numeric,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists generations_dossier_idx on generations (dossier_id, started_at desc);
create index if not exists generations_batch_idx on generations (batch_id);

-- =========================================================================
-- 5. Quality audits — contrôle qualité distinct de la génération (PRD §13.4, §15)
-- =========================================================================

-- Vocabulaire de verdict aligné sur LIB-002 §6 et lib/rif/controle-qualite.ts
-- — pas un vocabulaire inventé indépendamment.
create table if not exists quality_audits (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references generations (id) on delete cascade,
  checklist_version text not null,
  report jsonb not null default '[]'::jsonb,
  verdict_proposed text check (
    verdict_proposed in (
      'validation', 'acceptable_avec_reserve', 'correction_ciblee',
      'nouvelle_generation', 'production_suspendue'
    )
  ),
  -- verdict_human est le SEUL champ consulté par le garde-fou d'export
  -- (PRD §15.3) : voir autoriserExportAdministratif. verdict_proposed
  -- n'autorise jamais rien.
  verdict_human text check (
    verdict_human in (
      'validation', 'acceptable_avec_reserve', 'correction_ciblee',
      'nouvelle_generation', 'production_suspendue'
    )
  ),
  reserves text,
  validated_by uuid references users (id),
  validated_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists quality_audits_generation_idx on quality_audits (generation_id);

-- =========================================================================
-- 6. Events — journal append-only (PRD §13.5, §18)
--
-- Append-only par convention applicative (le backend n'expose aucune
-- opération update/delete sur cette table) — sans RLS pour l'imposer côté
-- base, la garantie se déplace entièrement dans lib/rif/depot-neon.ts, qui
-- n'expose que journaliserEvenement (insert), jamais de mise à jour.
-- =========================================================================

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references dossiers (id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  actor_id uuid references users (id),
  created_at timestamptz not null default now()
);

create index if not exists events_dossier_idx on events (dossier_id, created_at desc);
