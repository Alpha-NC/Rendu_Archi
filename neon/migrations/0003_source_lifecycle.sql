-- RIF-App — Lot 2 Source Lifecycle (DECISIONS.md D-23)
--
-- Objectif : ne plus écraser silencieusement une source principale
-- (modèle 3D, vue projet, photo réelle, axonométrie) quand elle est
-- redéposée — versionner et remplacer proprement, historique préservé.
-- Introduit aussi TEMPORARY_PROJECT_ASSETS (photos terrain en volume),
-- domaine séparé de `files` — jamais une autorité géométrique/environnement,
-- jamais dans `project_state.sources` (PRD Geometry-First §15).
--
-- Dépend de 0002 dans l'ordre d'application (numérotation), sans dépendance
-- structurelle réelle (aucune clé étrangère vers render_targets ici).

-- =========================================================================
-- 1. files — colonnes de cycle de vie (storage lifecycle, distinct du
--    cycle de vie geometry-first de SourceModele3D.extractionStatus)
-- =========================================================================

alter table files add column if not exists version integer not null default 1;

alter table files add column if not exists source_status text not null default 'active' check (
  source_status in ('active', 'replaced', 'deleted')
);

alter table files add column if not exists replaced_at timestamptz;

alter table files add column if not exists replaced_by uuid references files (id);

-- Une seule version ACTIVE par rôle principal et par dossier — modèle 3D,
-- vue projet, photo réelle, axonométrie (lib/rif/sources.ts::ROLES_PRINCIPAUX).
-- `coalesce(role_confirmed, role_detected)` : le rôle peut encore être en
-- attente de confirmation humaine au moment du remplacement, la contrainte
-- doit porter sur le rôle effectif, pas seulement confirmé. Les autres
-- rôles (référence matériau, source annotée...) restent multi-valués par
-- nature, jamais contraints ici.
create unique index if not exists files_une_active_par_role_principal
  on files (dossier_id, coalesce(role_confirmed, role_detected))
  where source_status = 'active'
    and coalesce(role_confirmed, role_detected) in ('model_3d', 'revit_view', 'site_photo', 'axonometry');

create index if not exists files_role_versions_idx on files (dossier_id, coalesce(role_confirmed, role_detected), version desc);

-- =========================================================================
-- 2. temporary_assets — photos terrain en volume (PRD Geometry-First §15)
--
-- Table séparée, volontairement : pas de rôle, pas de version, pas de
-- remplacement, pas d'entrée project_state.sources — une aide à la
-- compréhension multimodale, jamais une autorité de premier plan.
-- `expires_at` informatif uniquement (aucune purge automatique, mission
-- Lot 2 §11 : rétention envisagée 3-6 mois, jamais implémentée ici).
-- =========================================================================

create table if not exists temporary_assets (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references dossiers (id) on delete cascade,
  original_name text not null,
  storage_key text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists temporary_assets_dossier_idx on temporary_assets (dossier_id, created_at desc);
