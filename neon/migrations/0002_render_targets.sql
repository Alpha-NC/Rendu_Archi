-- RIF-App — Lot 1 RenderTarget (DECISIONS.md D-22, ADR-022)
--
-- Project → RenderTarget → Generations. Une cible de rendu regroupe les
-- générations qui visent le même résultat (« Perspective entrée »,
-- « Axonométrie générale »...) ; chaque cible a au plus une génération
-- canonique. Compatibilité legacy explicite : `generations.render_target_id`
-- reste nullable — une génération sans cible se comporte exactement comme
-- avant cette migration (canonique dossier-large, jamais mélangée avec les
-- canoniques par cible — voir l'index d'unicité ci-dessous).
--
-- Aucun format 3D, aucun fournisseur d'extraction : hors sujet de cette
-- migration, qui ne porte que sur l'organisation des générations.

-- =========================================================================
-- 1. render_targets
-- =========================================================================

create table if not exists render_targets (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references dossiers (id) on delete cascade,
  name text not null,
  -- OutputType (lib/rif/render-targets.ts) — exactement deux valeurs
  -- confirmées RDV Évariste du 18.09.2026, aucune autre n'existe.
  output_type text not null check (
    output_type in ('PHOTOREALISTIC_PERSPECTIVE', 'PHOTOREALISTIC_AXONOMETRY')
  ),
  -- Référence la génération canonique de CETTE cible — nullable tant
  -- qu'aucun verdict humain validant n'a désigné de canonique (même garde
  -- que l'ancien mécanisme dossier-large, jamais un calcul automatique).
  -- Pas de contrainte de clé étrangère immédiate ici : `generations` est
  -- créée après `render_targets` dans ce même fichier ; la contrainte est
  -- ajoutée en étape 3, une fois les deux tables définies.
  canonical_generation_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists render_targets_dossier_idx on render_targets (dossier_id, created_at desc);

-- =========================================================================
-- 2. generations — rattachement à une cible (nullable, legacy)
-- =========================================================================

alter table generations add column if not exists render_target_id uuid references render_targets (id);

-- Lignage explicite : quelle génération une correction/reprise prolonge.
-- Sert à dériver `render_target_id` d'une correction SERVEUR-SIDE (jamais
-- fourni par le client) — une correction hérite toujours de la cible de sa
-- génération parente, jamais d'une valeur transmise séparément (mission
-- Lot 1 §17 : « ne jamais changer silencieusement de target »).
alter table generations add column if not exists parent_generation_id uuid references generations (id);

create index if not exists generations_render_target_idx on generations (render_target_id);

-- =========================================================================
-- 3. Contrainte différée : render_targets.canonical_generation_id
-- =========================================================================

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'render_targets_canonical_generation_fkey'
  ) then
    alter table render_targets
      add constraint render_targets_canonical_generation_fkey
      foreign key (canonical_generation_id) references generations (id);
  end if;
end $$;

-- =========================================================================
-- 4. Une seule génération canonique par groupe — cible OU pool legacy
--
-- `coalesce(render_target_id, <sentinelle>)` normalise NULL pour que
-- Postgres traite bien toutes les générations sans cible d'un même dossier
-- comme UN SEUL groupe (par défaut, un index unique traite chaque NULL
-- comme distinct des autres — sans cette normalisation, plusieurs
-- générations legacy pourraient être canoniques simultanément, ce qui
-- romprait l'arbitrage D-19 déjà en vigueur : « au plus une canonique par
-- dossier » pour le pool legacy).
-- =========================================================================

create unique index if not exists generations_une_canonique_par_cible
  on generations (dossier_id, coalesce(render_target_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where is_canonical = true;
