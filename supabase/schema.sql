-- Schéma Supabase — rendu-architectural
-- Reprend docs/prd-generateur-rendu-v2.md §4 à l'identique.
-- Projet Supabase unique, deux tables. Exécuter dans l'éditeur SQL Supabase.

create table if not exists materiaux (
  id uuid primary key default gen_random_uuid(),
  terme text not null,
  categorie text not null check (categorie in ('toiture','facade','volets','menuiseries','margelles','plage')),
  fragment_prompt text,
  statut text not null default 'a_calibrer' check (statut in ('a_calibrer','valide','archive')),
  dossier_origine text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists dossiers (
  id uuid primary key default gen_random_uuid(),
  reference text not null,
  statut text not null default 'en_cours' check (statut in ('en_cours','valide')),
  cycle_type text check (cycle_type in ('generation','correction','regeneration')),
  note text,
  image_url text,
  prompt text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

-- Index utiles au filtrage utilisé par le workflow n8n.
create index if not exists materiaux_categorie_statut_idx on materiaux (categorie, statut);
create index if not exists dossiers_reference_idx on dossiers (reference, created_at);

-- Rappels de règles (PRD §4.1 / §4.2), non enforceables en SQL pur :
-- - fragment_prompt reste null tant que statut = 'a_calibrer' ; rédigé
--   manuellement lors de la revue de calibration.
-- - L'application (front + n8n) n'écrit jamais statut = 'valide' sur
--   materiaux : ce passage est manuel, fait dans Supabase directement.
-- - Une ligne dossiers est écrite à CHAQUE cycle, y compris non validé.
