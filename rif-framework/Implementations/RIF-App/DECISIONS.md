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

**Statut :** En cours — voir `docs/decision-llm-multimodal.md`.
Recommandation provisoire : Claude Sonnet 5 (avec bascule Opus 5 pour l'extraction ProjectState si nécessaire), à confirmer par mesure réelle en Phase 0B.

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

## Historique

- 07.09.2026 — Création du registre, D-01 à D-09 formalisées, D-06 en cours d'arbitrage (voir `docs/decision-llm-multimodal.md`).
