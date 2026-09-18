-- RIF-App — Lot 3 Project History / Audit Trail (DECISIONS.md D-24)
--
-- La table `events` (0001) reste la source de vérité de l'historique —
-- append-only, jamais réécrite. Ce lot ajoute des colonnes de RÉFÉRENCE
-- optionnelles pour permettre un filtrage réel (render_target_id,
-- generation_id, source_id) sans scanner le payload JSONB, et pour éviter
-- de dupliquer la donnée métier qui vit déjà dans render_targets/
-- generations/files (mission Lot 3 §4 : « ne duplique pas toute la donnée
-- métier dans metadata »).
--
-- Additive et rétrocompatible : toutes les colonnes sont nullables, tous
-- les événements déjà journalisés restent valides tels quels (NULL sur ces
-- trois colonnes — historique absent, jamais reconstruit artificiellement,
-- mission §17).

alter table events add column if not exists render_target_id uuid references render_targets (id);
alter table events add column if not exists generation_id uuid references generations (id);
alter table events add column if not exists source_id uuid references files (id);

-- Index partiels : seules les lignes qui portent réellement la référence
-- sont indexées (la plupart des événements n'en portent aucune) — moins
-- coûteux qu'un index plein sur des colonnes majoritairement NULL.
create index if not exists events_render_target_idx on events (render_target_id) where render_target_id is not null;
create index if not exists events_generation_idx on events (generation_id) where generation_id is not null;
