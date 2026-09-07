-- Schéma Supabase — RIF-App
-- Reprend docs/prd-generateur-rendu-v2.md §13 (Modèle de données minimal) et
-- rif-framework/Implementations/RIF-App/DECISIONS.md (D-03, D-04, D-07, D-08, D-09).
--
-- N'ADDITIONNE PAS le schéma V2 abandonné (materiaux/dossiers de schema.sql) :
-- ce fichier décrit l'implémentation RIF-App et n'a jamais été exécuté. Si le
-- workflow V1 (GPT RIF, encore en production) utilise le même projet Supabase
-- que le schéma V2, NE PAS DROP les tables existantes avant d'avoir confirmé
-- ce qui est réellement en dépendance côté V1.
--
-- Ce script est fourni pour revue et exécution manuelle dans l'éditeur SQL
-- Supabase (ou via `supabase db push` côté utilisateur) — aucune exécution
-- automatique depuis cet environnement, conformément à la politique de
-- non-manipulation des identifiants/infrastructure du client.

-- =========================================================================
-- 1. Rôles applicatifs (profils) — nécessaire pour la policy de supervision
-- =========================================================================

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'client' check (role in ('client', 'supervisor')),
  display_name text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profils_lecture_soi_meme"
  on profiles for select
  using (auth.uid() = id);

-- =========================================================================
-- 2. Dossiers — source de vérité du ProjectState (PRD §10, §13.1)
-- =========================================================================

create table if not exists dossiers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id),
  dossier_ref text not null,
  workflow_state text not null default 'BROUILLON' check (
    workflow_state in (
      'BROUILLON', 'SOURCES_RECUES', 'SOURCES_CONTROLEES',
      'COLLECTE_EN_COURS', 'FICHE_A_CONFIRMER', 'PRET_A_GENERER',
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

alter table dossiers enable row level security;

create policy "dossiers_proprietaire"
  on dossiers for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "dossiers_supervision_lecture"
  on dossiers for select
  using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'supervisor'
  ));

-- =========================================================================
-- 3. Files — sources et rendus (PRD §12, §13.2)
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

alter table files enable row level security;

create policy "files_proprietaire"
  on files for all
  using (exists (
    select 1 from dossiers d where d.id = dossier_id and d.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from dossiers d where d.id = dossier_id and d.owner_id = auth.uid()
  ));

create policy "files_supervision_lecture"
  on files for select
  using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'supervisor'
  ));

-- =========================================================================
-- 4. Generations — journal transactionnel des appels fal.ai (PRD §13.3, §18.1)
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

alter table generations enable row level security;

create policy "generations_proprietaire"
  on generations for all
  using (exists (
    select 1 from dossiers d where d.id = dossier_id and d.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from dossiers d where d.id = dossier_id and d.owner_id = auth.uid()
  ));

create policy "generations_supervision_lecture"
  on generations for select
  using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'supervisor'
  ));

-- =========================================================================
-- 5. Quality audits — contrôle qualité distinct de la génération (PRD §13.4, §15)
-- =========================================================================

-- Vocabulaire de verdict aligné sur LIB-002 §6 (checklist officielle) et
-- lib/rif/controle-qualite.ts — PAS un vocabulaire inventé indépendamment.
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
  -- (PRD §15.3) : voir autoriserExportAdministratif dans
  -- lib/rif/controle-qualite.ts. verdict_proposed n'autorise jamais rien.
  verdict_human text check (
    verdict_human in (
      'validation', 'acceptable_avec_reserve', 'correction_ciblee',
      'nouvelle_generation', 'production_suspendue'
    )
  ),
  reserves text,
  validated_by uuid references auth.users (id),
  validated_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists quality_audits_generation_idx on quality_audits (generation_id);

alter table quality_audits enable row level security;

create policy "quality_audits_proprietaire"
  on quality_audits for all
  using (exists (
    select 1 from generations g
    join dossiers d on d.id = g.dossier_id
    where g.id = generation_id and d.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from generations g
    join dossiers d on d.id = g.dossier_id
    where g.id = generation_id and d.owner_id = auth.uid()
  ));

create policy "quality_audits_supervision_lecture"
  on quality_audits for select
  using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'supervisor'
  ));

-- =========================================================================
-- 6. Events — journal append-only (PRD §13.5, §18)
-- =========================================================================

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references dossiers (id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists events_dossier_idx on events (dossier_id, created_at desc);

alter table events enable row level security;

-- Append-only : select + insert seulement, jamais update/delete, y compris
-- pour le propriétaire (PRD §13.5 : le journal ne doit pas pouvoir être
-- réécrit après coup).
create policy "events_proprietaire_lecture"
  on events for select
  using (exists (
    select 1 from dossiers d where d.id = dossier_id and d.owner_id = auth.uid()
  ));

create policy "events_proprietaire_ecriture"
  on events for insert
  with check (exists (
    select 1 from dossiers d where d.id = dossier_id and d.owner_id = auth.uid()
  ));

create policy "events_supervision_lecture"
  on events for select
  using (exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'supervisor'
  ));

-- =========================================================================
-- 7. Bucket de stockage privé (PRD §12) — à créer manuellement dans
--    Supabase Storage (aucune API SQL standard portable pour les buckets) :
--    nom suggéré "rif-app-sources", accès privé, policies alignées sur
--    dossiers.owner_id via le chemin de stockage (ex. {owner_id}/{dossier_id}/...).
-- =========================================================================
