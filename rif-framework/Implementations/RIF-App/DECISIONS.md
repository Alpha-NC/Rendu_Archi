# Décisions d'implémentation — RIF-App

**Statut :** Phase 0A en cours.
**Portée :** décisions structurantes propres à l'implémentation RIF-App. Ce registre ne modifie pas et ne remplace pas le registre ADR du Framework (`Framework/99_DOCUMENTATION/99_DECISIONS_ARCHITECTURE.md`) — voir non-objectif §25 du PRD.
**Réfère à :** `docs/prd-generateur-rendu-v2.md` (V1.3), §23 Phase 0A, §26 Décisions à formaliser.

---

## D-01 — RIF-App est une implémentation du Framework, pas un remplacement

**Statut :** Accepted.
Le Framework RIF (`rif-framework/Framework/`) reste la source unique des règles universelles (matériaux, styles, modes, checklist, cas de test). RIF-App consomme ce Framework via son package d'implémentation versionné (`Implementations/RIF-App/`) et ne modifie jamais les fichiers `Framework/` depuis le code applicatif.

## D-02 — Hébergement et stack technique

**Statut :** Accepted (direction déjà validée avant ce document).
- Frontend + backend applicatif : Next.js 16 (App Router), hébergé sur Vercel.
- Base de données, authentification, stockage : Supabase (Postgres + Auth + Storage).
- Aucun n8n dans le chemin de production de RIF-App — le webhook n8n V2 (`keALNdFoFMNT1Sxk`) est abandonné avec le formulaire V2.

## D-03 — Authentification et RLS

**Statut :** Accepted (principe) — implémentation restant à écrire en Phase 0B.
- Authentification individuelle via Supabase Auth (email + mot de passe pour V1 ; un seul compte réel, Évariste, plus un compte de supervision Alpha_no_code).
- Row Level Security activée sur `dossiers`, `files`, `generations`, `quality_audits`, `events` dès leur création — jamais ajoutée après coup.
- Politique RLS de référence : un utilisateur ne voit que les lignes dont il est `owner_id` (ou rattachées à un dossier dont il est propriétaire) ; un rôle de supervision (Alpha_no_code) a un accès en lecture large via une policy dédiée, jamais via la clé `service_role` exposée côté client.
- Toute clé (`service_role`, fal.ai, LLM) reste côté serveur (Route Handlers / Server Actions Next.js), jamais dans un composant client ni dans ce dépôt.

## D-04 — Stockage et transport des fichiers

**Statut :** Accepted.
- Bucket Supabase Storage privé pour les sources et les rendus.
- La base relationnelle ne stocke que `storage_key` + métadonnées (voir PRD §13.2).
- URLs signées temporaires uniquement, jamais d'URL publique permanente.
- Pas de copie Google Drive dans le chemin critique ; une éventuelle copie intervient après enregistrement du rendu canonique (PRD §12).

## D-05 — Appel fal.ai : direct, sans service intermédiaire séparé

**Statut :** Accepted.
Le PRD (§21) exclut déjà toute dépendance à un compte ChatGPT personnel et impose des appels API directs. Le « service contrôlé par Alpha_no_code » évoqué au §26 point 7 est le **backend applicatif Next.js lui-même** (Route Handlers/Server Actions) : il appelle fal.ai directement avec la clé serveur, sans microservice ou proxy additionnel. Pas de nouvelle brique d'infrastructure à maintenir.
Endpoint retenu (confirmé par inspection du workflow n8n V1 encore en production) : `fal-ai/nano-banana-pro/edit`.

## D-06 — Choix du LLM multimodal

**Statut :** Accepted — 07.09.2026.
**Décision :** Claude Sonnet 5 (`claude-sonnet-5`) pour les trois rôles (dialogue, extraction structurée du ProjectState, analyse assistée des sources). Analyse comparative et chiffrage : `docs/decision-llm-multimodal.md`.
**Conséquences :** secret serveur `ANTHROPIC_API_KEY` ; le coût réel par dossier reste à mesurer en Phase 0B (§20 du PRD) et peut motiver une bascule ponctuelle vers Opus 5 sur l'extraction, ou un modèle moins cher sur le dialogue simple — sans nouvelle décision structurante, tant que la fiabilité aux points critiques est préservée.
**Rappel de gouvernance (PRD §21) :** une mise à jour du modèle déclenche les tests applicables avant mise en production, et chaque génération enregistre la version exacte du modèle utilisé.

## D-14 — Clôture formelle du plan V2 déterministe

**Statut :** Accepted — 07.09.2026.
**Contexte :** le prémortem du 02.09.2026 identifie comme risque #7 le fait que le plan V2 (formulaire 7 étapes, prototype React, schéma Supabase, webhook n8n unique) soit « abandonné de fait sans décision formalisée » — laissant deux projets à moitié faits et aucun plan B lisible.
**Décision :** le plan V2 déterministe est **arrêté**, pas gelé. Le code du formulaire a été retiré du dépôt (commit `d7fbf20`), le webhook n8n V2 (`keALNdFoFMNT1Sxk`) est abandonné, et l'ancien `supabase/schema.sql` est conservé en lecture seule à titre historique.
**Motif, en une phrase :** le client a explicitement rejeté l'expérience formulaire comme « trop contraignante » ; poursuivre les deux voies en parallèle coûterait plus que la valeur d'un plan B dont l'ergonomie est déjà refusée.
**Plan B réel :** ce n'est pas la V2, c'est **GPT RIF (V1), maintenu en production comme filet de sécurité** jusqu'au critère de sortie de la Phase 1 (PRD §23).
**Éléments réutilisables :** le catalogue matériaux Supabase et les prompts de LIB-001 restent exploitables ; leur devenir est à documenter en Phase 0B (case déjà prévue au §23).

---

## Traçabilité du prémortem du 02.09.2026

Le prémortem (`docs/premortem-20260902-transcript.md`, rapport : `docs/premortem-20260902-rapport.html`) est antérieur au PRD V1.3 et l'a largement nourri. État de couverture au 07.09.2026 :

| # | Risque prémortem | Couverture |
|---|---|---|
| 1 | Fiabilité de l'appel d'outil jamais confirmée | **Ouvert** — à traiter dans l'orchestrateur (aucune action ne doit partir d'un texte imitant un appel d'outil) puis mesurer en Phase 0B |
| 2 | Polling fal.ai jamais validé de bout en bout | **Ouvert** — Phase 0B, première case du §23 |
| 3 | Contrôle qualité visuel jamais éprouvé en réel | Cadré et outillé — `lib/rif/controle-qualite.ts` implémente la grille LIB-002 et le garde-fou d'export (§15.3) ; **reste ouvert** : la mesure réelle du taux de faux négatifs (Phase 0B) n'a pas encore de données |
| 4 | Attente de parité stricte avec GPT RIF | Cadré — PRD §22, dernier critère d'acceptation ; profil client `PROFIL_EVARISTE.md` |
| 5 | Aucune infrastructure de production réelle | **Traité** — auth individuelle + RLS (D-03), secrets serveur, journalisation transactionnelle (PRD §18.1) |
| 6 | 60 €/mois jamais recalculé | Cadré — PRD §20 ; chiffrage LLM fait (`docs/decision-llm-multimodal.md`), coût fal.ai à mesurer en Phase 0B |
| 7 | Plan V2 abandonné sans décision | **Traité** — D-14 ci-dessus |
| 8 | Aucun filet de sécurité ni critère de bascule | **Traité** — PRD §23 Phases 1 et 2 (GPT RIF maintenu, seuil de 10 dossiers consécutifs) |

Les trois risques encore ouverts (#1, #2, #3) sont exactement ceux qui exigent une mesure réelle, pas une décision. Ils constituent le cœur de la Phase 0B.

## D-07 — ProjectState : structure de base

**Statut :** Accepted (structure), champs détaillés à compléter au fil de la Phase 0B.
Le schéma suit le PRD §10 et l'exemple `Exemples/PROJECT_STATE_EXEMPLE.json` : chaque donnée significative porte `value`, `status` (`provisional`/`validated`/`rejected`/`unknown`), `source_id`, `authority`, `editable`, `locked`, `validated_by`, `validated_at`, `notes`. Le prompt final est toujours généré depuis une révision immuable et confirmée.

## D-08 — Machine à états : liste et préconditions

**Statut :** Accepted (liste des états, PRD §8) — préconditions détaillées de transition à écrire en Phase 0B dans le code du backend, jamais côté frontend seul.
États : `BROUILLON → SOURCES_REÇUES → SOURCES_CONTRÔLÉES → COLLECTE_EN_COURS → FICHE_À_CONFIRMER → PRÊT_À_GÉNÉRER → GÉNÉRATION_EN_COURS → CONTRÔLE_À_EXAMINER → VALIDÉ | À_CORRIGER | À_REPRENDRE | SUSPENDU | ÉCHEC`.

## D-09 — Trois opérations distinctes, jamais confondues

**Statut :** Accepted.
`genererRenduFlux`, `corrigerRenduFlux` et `reprendreDepuisSources` (PRD §14) sont trois contrats d'API distincts avec des préconditions différentes. Aucune route ne doit permettre de déguiser une reprise en correction locale ou l'inverse.

## Décisions encore ouvertes (issues du PRD §26, non couvertes ci-dessus)

- [ ] D-10 — limite maximale de variantes incluses par dossier ou par perspective.
- [ ] D-11 — format technique définitif des directives localisées (table dédiée vs. `project_state` seul) — PRD §13.6 laisse les deux options ouvertes pour la Phase 0.
- [ ] D-12 — stratégie économique de repli si le coût complet observé dépasse 60 €/mois (PRD §20).
- [ ] D-13 — modalités contractuelles finales (hors périmètre technique, le contrat signé fait autorité).

---

## Note — dérive documentaire relevée (Framework, pas RIF-App)

En implémentant ENG-004 (`lib/rif/collecte-conditionnelle.ts`), ENG-004 lui-même référence « REF-001 §9 » pour la règle de lumière suivant la photographie. Dans la version actuelle de REF-001 (01_REFERENTIEL_GENERAL.md), cette règle est en réalité au §6 (« Environnement et lumière ») ; le §9 actuel est « Confidentialité ». Numérotation vraisemblablement décalée par une révision antérieure de REF-001 sans mise à jour de la référence croisée dans ENG-004. Le code s'appuie sur le contenu réel (§6), pas sur le numéro cité. Signalé ici pour information — correction du Framework lui-même hors périmètre de RIF-App (non-objectif PRD §25).

## Historique

- 07.09.2026 — Création du registre, D-01 à D-09 formalisées, D-06 en cours d'arbitrage (voir `docs/decision-llm-multimodal.md`).
- 07.09.2026 — D-06 tranchée (Claude Sonnet 5), D-14 ajoutée (clôture du plan V2), module de contrôle qualité et Route Handlers livrés, module de collecte conditionnelle (ENG-004) livré.
