# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**rendu-architectural** — **RIF-App** : application conversationnelle qui génère des rendus architecturaux photoréalistes à partir d'exports Revit et d'une photo de site, avec boucle de correction par annotation, pour Évariste Blasco (architecte, Biarritz). Implémentation du **Framework RIF** (`rif-framework/`), pas un remplacement de celui-ci.

Remplace le formulaire V2 (7 étapes, rejeté par le client comme « trop contraignant ») et prépare la bascule progressive depuis le Custom GPT V1 (« GPT RIF »), qui reste le filet de sécurité jusqu'en Phase 1.

Voir `docs/prd-generateur-rendu-v2.md` (V1.3) pour la spec complète et `rif-framework/Implementations/RIF-App/DECISIONS.md` pour les décisions d'architecture déjà tranchées (Phase 0A).

Stack : Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (Postgres + Auth + Storage), hébergé sur Vercel.

## Architecture — points critiques

- **Backend applicatif propre**, contrairement à la V2 : ce dépôt contient l'authentification, la machine à états et les appels serveur (Route Handlers/Server Actions). Il n'y a **plus de n8n** dans le chemin de production de RIF-App — le webhook V2 (`keALNdFoFMNT1Sxk`) est abandonné.
- **Authentification individuelle obligatoire** (Supabase Auth) + **Row Level Security** sur toutes les tables — plus de mot de passe unique partagé. Voir `middleware.ts`… en réalité `proxy.ts` (convention Next.js 16, migré depuis `middleware.ts`).
- **fal.ai est appelé directement depuis ce backend** (`fal-ai/nano-banana-pro/edit`), sans service intermédiaire séparé — voir DECISIONS.md D-05.
- **Le LLM ne pilote jamais directement une transition d'état ni un appel au moteur d'image.** Il propose ; seul le backend (`lib/rif/etat-machine.ts`) vérifie les préconditions et applique. Ne jamais dupliquer ces vérifications côté client ou les considérer suffisantes côté prompt seul.
- **ProjectState** (`lib/rif/project-state.ts`) est la source de vérité opérationnelle, distincte de la conversation. Une révision confirmée est immuable ; toute modification crée une nouvelle révision. Une génération est impossible sans révision confirmée (critère d'acceptation §22 du PRD, testé dans `lib/rif/etat-machine.test.ts`).
- **Aucune clé d'API dans ce dépôt** — Supabase (`service_role`), Anthropic/LLM et fal.ai restent des secrets serveur uniquement (`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `FAL_KEY` — jamais préfixés `NEXT_PUBLIC_`).
- **LLM multimodal : Claude Sonnet 5** (`claude-sonnet-5`) pour le dialogue, l'extraction du ProjectState et l'analyse des sources — décision D-06, voir `docs/decision-llm-multimodal.md`. Chaque génération doit enregistrer la version exacte du modèle utilisé (PRD §21).
- **Un appel d'outil n'existe que sous forme de `tool_use` réel.** Le prémortem du 02.09.2026 identifie comme échec le plus probable un modèle qui *décrit en texte* l'appel qu'il voudrait faire (bloc de code JSON) sans jamais l'émettre — l'utilisateur croit alors une génération lancée qui ne l'est pas. Ne jamais déclencher une action à partir de texte parsé : voir `lib/rif/appel-outil.ts`.
- Le Framework (`rif-framework/Framework/`) n'est **jamais modifié depuis le code applicatif** — c'est un non-objectif explicite du PRD (§25).

## Commands

```bash
npm run dev       # dev server (localhost:3000)
npm run build     # production build
npm run lint      # ESLint
npm run test      # vitest run
npm run test:watch
```

## Ce qui existe déjà

- `lib/rif/project-state.ts` — types TypeScript du ProjectState.
- `lib/rif/etat-machine.ts` (+ `.test.ts`) — machine à états déterministe et préconditions de transition (PRD §8, §22).
- `lib/supabase/{client,server}.ts` — clients Supabase (navigateur, serveur avec RLS, serveur `service_role`).
- `app/connexion/page.tsx` — authentification individuelle (email + mot de passe Supabase Auth).
- `proxy.ts` — rafraîchissement de session + garde d'accès sur toutes les routes hors `/connexion`.
- `supabase/schema-rif-app.sql` — schéma complet (`dossiers`, `files`, `generations`, `quality_audits`, `events`, `profiles`) avec policies RLS, non encore exécuté sur un vrai projet Supabase.

## Ce qui reste à construire

- Créer le projet Supabase réel et exécuter `supabase/schema-rif-app.sql` + créer le bucket de stockage privé (voir commentaire en fin de fichier SQL).
- Trancher D-06 (LLM multimodal) et brancher l'orchestrateur conversationnel.
- Étapes 1 à 5 du parcours (PRD §9) : dépôt des sources, contrôle initial, collecte progressive (ENG-004), fiche projet, génération.
- Contrats `genererRenduFlux` / `corrigerRenduFlux` / `reprendreDepuisSources` (PRD §14).
- Contrôle qualité et validation humaine distincts de la génération (PRD §15).
- Voir `rif-framework/Implementations/RIF-App/DECISIONS.md` pour les décisions encore ouvertes (D-10 à D-13) et `docs/prd-generateur-rendu-v2.md` §23 pour le plan de déploiement (Phase 0B à venir).

## Env vars

Voir `.env.example`.
