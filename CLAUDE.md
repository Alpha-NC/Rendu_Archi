# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**rendu-architectural** — Générateur de rendus architecturaux photoréalistes à partir d'exports Revit et d'une photo de site, avec boucle de correction par annotation. Remplace une interface Custom GPT (V1). Voir `docs/prd-generateur-rendu-v2.md` pour la spec complète.

Stack : Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 — **front seul**, aucun backend applicatif propre.

## Architecture — point critique

Le front ne parle **qu'à un unique webhook n8n** (self-hosted, externe à ce dépôt). Toute la logique métier, le stockage (Supabase, tables `materiaux`/`dossiers`), l'appel fal.ai/Nano Banana Pro et l'archivage Google Drive vivent côté n8n, pas dans ce dépôt.

- **Aucune clé d'API dans ce projet** — ni Supabase, ni fal.ai, ni Drive. Le front n'a même pas de client Supabase : il ne l'appelle jamais directement.
- Un seul endpoint configuré via variable d'environnement (`NEXT_PUBLIC_N8N_WEBHOOK_URL`), routé côté n8n par un champ `action` dans le corps de la requête (`get_materiaux`, `generate`, `correct`, `regenerate`, `validate`, `get_dossier`).
- Le polling fal.ai est géré entièrement côté n8n dans une seule exécution de workflow — le front envoie une requête et attend une réponse finale unique. Ne jamais implémenter de logique de polling côté client.
- Accès protégé par un mot de passe unique partagé (pas de comptes, pas de rôles) — donc **pas de skill nextjs-supabase-auth ici**, c'est hors sujet pour ce projet.

## Commands

```bash
npm run dev     # dev server (localhost:3000)
npm run build   # production build
npm run lint    # ESLint
```

## Ce qui reste à construire

Rien n'est encore implémenté au-delà du scaffold Next.js par défaut. Voir `docs/prd-generateur-rendu-v2.md` §10 pour l'ordre d'implémentation recommandé (schéma Supabase et webhook n8n en premier, côté n8n — hors de ce dépôt — puis le formulaire 7 étapes ici).

## Env vars

Voir `.env.example`.
