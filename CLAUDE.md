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
- **Le contrôle qualité ne produit qu'un verdict PROPOSÉ, jamais autoritaire.** `lib/rif/controle-qualite.ts` implémente la grille officielle LIB-002 (15 critères) et le garde-fou d'export (PRD §15.3) : seul `verdict_human` (jamais `verdict_proposed`) autorise un export administratif, et uniquement sur `'validation'` sans réserve. Le prémortem désigne ce point comme l'échec le plus dangereux (#3) — ne jamais faire raccourcir ce chemin par une génération de code future.
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
- `lib/rif/appel-outil.ts` (+ `.test.ts`) — garde d'appel d'outil : aucune opération ne part d'un texte parsé, seul un `tool_use` réel déclenche une action ; revérifie l'état du dossier côté backend.
- `lib/fal/client.ts` (+ `.test.ts`) — client fal.ai (soumission + polling jusqu'à un état terminal, jamais un `IN_QUEUE` présenté comme un succès).
- `lib/rif/controle-qualite.ts` (+ `.test.ts`) — grille LIB-002, verdict proposé (jamais autoritaire) et garde-fou d'export administratif (PRD §15.3).
- `lib/rif/modes-styles.ts` (+ `.test.ts`) — sélection du mode (LIB-006 §5) et du style (LIB-005) par défaut ; ne devine jamais hors des cas documentés, retourne `'a_confirmer'`/`'suspendre'` sinon.
- `lib/rif/collecte-conditionnelle.ts` (+ `.test.ts`) — moteur ENG-004 : une fois mode/style pressentis, détermine l'état (inchangée/réduite/convertie/retirée/inversée) de chacune des 8 questions du tronc commun. Combinaison non documentée par ENG-004 (Présentation générative) → aucune réduction, jamais d'invention de règle.
- `lib/rif/prompt-technique.ts` (+ `.test.ts`) — construit le prompt technique réel envoyé à fal.ai (ENG-002 pour une génération, ENG-003 pour une correction). Le LLM conversationnel ne fournit jamais ce texte lui-même (PRD §9.5).
- `lib/rif/prompt-conversationnel.ts` — prompt système de l'assistant conversationnel : les 11 principes non négociables (PRD §4) + le plan de collecte déjà calculé par `collecte-conditionnelle.ts` (le modèle exécute ce plan, il ne déduit jamais lui-même les règles ENG-004) + les schémas d'outils, délibérément minimaux (`genererRendu` n'accepte aucun prompt du modèle).
- `lib/rif/extraction-project-state.ts` (+ `.test.ts`) — D-15 : fusionne dans le ProjectState une mise à jour minimale proposée par le modèle (valeur + statut), en complétant seul les métadonnées de traçabilité (source_id, authority, validated_at). Une valeur déjà `validated` n'est jamais dégradée par une mise à jour `provisional` — jamais silencieusement, toujours journalisée.
- `lib/rif/orchestrateur-conversationnel.ts` (+ `.test.ts`) — relie un tour de conversation : calcule le branchement, appelle le modèle, passe la réponse dans `appel-outil.ts::analyserReponseModele`, construit le prompt technique réel ou applique une mise à jour de fiche projet si un outil est réellement appelé, exécute via `orchestrateur.ts`. Les sources du dossier sont jointes au message comme blocs image (URL signée) tant que le dossier est en phase de collecte — sans quoi l'analyse des sources exigée au §9.2 serait impossible et le modèle devinerait. Cinq outils au total (`genererRendu`, `corrigerRendu`, `reprendreDepuisSources`, `mettreAJourFicheProjet` — D-15, `avancerParcours` — D-16), tous soumis à la même garde anti-hallucination. Ne boucle pas encore automatiquement pour renvoyer un `tool_result` et obtenir un message de clôture — l'historique de conversation n'est pas encore persisté (PRD §13.5).
- `lib/rif/claude-client.ts` — adaptateur SDK Anthropic (Claude Sonnet 5, D-06), non testé contre l'API réelle.
- `app/api/dossiers/[dossierId]/message/route.ts` — Route Handler du tour de conversation ; le client transmet l'historique à chaque appel tant que la persistance n'est pas conçue.
- `lib/rif/depot.ts` — interface d'accès aux données (dossiers/generations/files/events), indépendante de Supabase pour rester testable.
- `lib/rif/orchestrateur.ts` (+ `.test.ts`) — exécute les trois opérations techniques (PRD §14) : journalisation transactionnelle (§18.1), appel fal.ai, rapatriement du rendu dans le stockage privé (§12), transition d'état. Logique pure, testée avec un dépôt en mémoire.
- `lib/rif/depot-supabase.ts` — implémentation Supabase de `DepotDossiers` (non testée contre un vrai projet, aucun n'existe encore).
- `app/api/dossiers/[dossierId]/{generer,corriger,reprendre}/route.ts` — Route Handlers HTTP, fins adaptateurs autour de l'orchestrateur : authentification, vérification de propriété (défense en profondeur au-delà de la RLS), validation du corps, appel de la logique métier.
- `lib/supabase/{client,server}.ts` — clients Supabase (navigateur, serveur avec RLS, serveur `service_role`).
- `app/connexion/page.tsx` (+ `lib/securite/redirection-sure.ts`) — authentification individuelle (email + mot de passe Supabase Auth), redirection post-connexion validée contre l'open redirect.
- `proxy.ts` — rafraîchissement de session + garde d'accès. Les routes `/api/*` reçoivent un 401 JSON si non authentifiées, jamais une redirection HTML — seules les pages redirigent vers `/connexion`.
- `supabase/schema-rif-app.sql` — schéma complet (`dossiers`, `files`, `generations`, `quality_audits`, `events`, `profiles`) avec policies RLS, non encore exécuté sur un vrai projet Supabase.
- `app/api/dossiers/route.ts` (GET liste, POST création) et `app/api/dossiers/[dossierId]/sources/route.ts` (dépôt d'une source, PRD §9.1) — le rôle est choisi explicitement par l'utilisateur au dépôt (slot dans l'UI), pas détecté automatiquement depuis le contenu du fichier.
- `app/dossiers/page.tsx` + `BoutonNouveauDossier.tsx` — liste des dossiers, création.
- `app/dossiers/[dossierId]/page.tsx` + `DepotSources.tsx` + `ConversationRif.tsx` — page de dossier : dépôt de sources (3 slots repris du prototype de référence archivé) et chat. `ConversationRif` ne renvoie au serveur que du texte à chaque tour (jamais les blocs `tool_use`/`tool_result` bruts) — le ProjectState, recalculé et injecté dans le prompt système à chaque tour, porte la mémoire structurée réelle.
- `app/page.tsx` redirige vers `/dossiers`.
- `app/dossiers/[dossierId]/FicheProjet.tsx` — fiche projet (PRD §9.4), affichage seul : données validées vs provisoires, sources et rôles, matériaux, références matériau limitées (ADR-014), directives, zones verrouillées, interdictions, réserves. Sans elle, la confirmation exigée au §9.4 se ferait à l'aveugle. L'édition passe par la conversation (`mettreAJourFicheProjet`), jamais par un formulaire.
- `app/api/dossiers/[dossierId]/generations/[generationId]/audit/route.ts` + `VerdictQualite.tsx` — enregistre le verdict HUMAIN (PRD §15.1) après une génération/correction et transitionne le dossier (`VALIDE`/`A_CORRIGER`/`A_REPRENDRE`/`SUSPENDU`). C'est le seul champ que lit `autoriserExportAdministratif` — jamais un verdict calculé.
- **Avancement du parcours (D-16)** : `avancerParcours` laisse le modèle PROPOSER une transition (SOURCES_CONTRÔLÉES, COLLECTE_EN_COURS, FICHE_À_CONFIRMER, SUSPENDU) que `autoriserAvancementParcours` valide côté backend. PRÊT_À_GÉNÉRER en est exclu (action humaine, §9.4, bouton `BoutonConfirmerFiche`), comme les états de production, qui découlent des opérations et de l'audit. Le passage BROUILLON → SOURCES_REÇUES est mécanique, fait au dépôt de la première source.
- `executerGenerationOuCorrection` (`lib/rif/orchestrateur.ts`) renvoie maintenant `imageUrl` (URL signée du rendu) sur succès — nécessaire pour l'afficher avant de voter.

## Ce qui reste à construire

- Créer le projet Supabase réel et exécuter `supabase/schema-rif-app.sql` + créer le bucket de stockage privé (voir commentaire en fin de fichier SQL) + définir `SUPABASE_STORAGE_BUCKET` si différent du nom par défaut (`rif-app-sources`).
- Le rapport détaillé par critère (grille LIB-002 des 15 critères) n'est pas rempli — `POST .../generations/[id]/audit` n'enregistre que le verdict global humain, pas de `report` ligne par ligne. `lib/rif/controle-qualite.ts::calculerVerdictPropose` reste inutilisé côté serveur (aucun appel multimodal ne remplit encore un rapport).
- Détection automatique du rôle d'un fichier déposé (PRD §9.1) — pour l'instant, l'utilisateur choisit lui-même le slot.
- Persistance de l'historique de conversation (PRD §13.5) — la route `/message` est aujourd'hui sans état côté serveur, le client renvoie l'historique à chaque appel.
- Boucle multi-tour complète : `orchestrateur-conversationnel.ts` exécute un tour et une opération, mais ne renvoie pas encore automatiquement le `tool_result` au modèle pour obtenir un message de clôture en langage naturel.
- `localized_directives` (annotations converties en directives, ADR-015) n'est pas encore alimenté par l'extraction — seuls `materials`/`geometrie`/`implantation`/`zone_intervention`/`lumiere`/`mode`/`style`/etc. le sont (D-15).
- Contrôle qualité multimodal proprement dit (LIB-002 appliqué à un rendu réel) — `lib/rif/controle-qualite.ts` calcule un verdict à partir d'un rapport déjà rempli ; rien ne remplit ce rapport depuis une image aujourd'hui.
- D-10 (limite de variantes) : `executerGenerationOuCorrection` ne produit qu'une seule variante par appel.
- `depot-supabase.ts` et `claude-client.ts` ne sont testés contre aucun service réel — à valider en Phase 0B dès qu'un projet Supabase et une clé Anthropic existent.
- Voir `rif-framework/Implementations/RIF-App/DECISIONS.md` pour les décisions encore ouvertes (D-10 à D-13) et `docs/prd-generateur-rendu-v2.md` §23 pour le plan de déploiement (Phase 0B à venir).

## Env vars

Voir `.env.example`.
