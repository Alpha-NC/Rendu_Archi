# RIF-App — Contrats backend V2 (geometry-first)

**Statut :** Draft — créé le 18 septembre 2026, mis à jour le 18 septembre 2026 (soir, post-RDV Évariste, §17-19) puis le 18 septembre 2026 (Lot 1 RenderTarget, §9bis, §10, §11, §16-18). Décrit le backend réellement en place, y compris le workflow geometry-first (ADR-021/022, D-20/D-21/D-22) et le modèle `Project → RenderTarget → Generations` (D-22). Objectif explicite : permettre à Codex de construire/adapter le frontend sans deviner un contrat. **Constat Lot 1 : `RenderTarget`/`OutputType`/`QualityProfile` sont désormais réellement implémentés côté backend (§9bis) ; aucune UI ne les exploite encore (chantier `feat/rif-ux-ui-desktop`, non touché par ce lot, §17 point 7).**

**Format 3D final : À CONFIRMER.** RVT est le candidat principal, IFC une alternative possible. Aucun fournisseur d'extraction géométrique n'est choisi. Rien dans ce contrat ne doit être lu comme un engagement sur l'un ou l'autre.

Complète (ne remplace pas) `docs/PRD_RIF_V2_GEOMETRY_FIRST.md` (produit) et `rif-framework/Implementations/RIF-App/DECISIONS.md` (arbitrages). Toute route non listée ici n'existe pas.

---

## 0. Conventions générales

- **Auth :** toute route sous `/api/dossiers` exige une session Neon Auth valide (cookie). Sans session → `401 { success:false, error:{code:'non_authentifie', message}, requestId }`.
- **Ownership :** chaque route avec un `dossierId` vérifie `dossier.ownerId === session.user.id`. Sinon → `403 { success:false, error:{code:'acces_refuse', message}, requestId }`.
- **Ownership d'un `generationId` :** un id de génération est un identifiant global. Chaque route qui en reçoit un vérifie qu'il appartient bien au `dossierId` de l'URL. Sinon → `404 { success:false, error:{code:'generation_introuvable', message}, requestId }` (même code que "génération inexistante" — ne révèle jamais qu'un id existe dans un autre dossier).
- **Format d'erreur uniforme :** `{ success: false, error: { code: string, message: string }, requestId: string }`. `requestId` est un UUID généré à chaque réponse d'erreur — à afficher/logger côté front pour le support, jamais à parser.
- **Codes HTTP :** `400` corps/paramètres invalides, `401` non authentifié, `403` accès refusé, `404` dossier/génération introuvable, `409` transition ou précondition refusée, `422` génération échouée proprement, `500` erreur serveur/config manquante, `502` échec d'un service externe (fal.ai, stockage, modèle), `504` timeout.
- **Succès :** toujours `{ success: true, ... }`, jamais de `200` avec `success:false` à l'intérieur (sauf `repondreOperation` sur un résultat métier explicite — voir §11).
- **Lecture des réponses côté front :** utiliser `lib/rif/reponse-client.ts::lireReponseApi` partout — confirmé branché sur les 7 composants qui appellent l'API (§17). Un front qui appellerait `reponse.json()` nu risquerait d'afficher une erreur de parsing brute sur un 413/corps vide — plus le cas aujourd'hui, à préserver sur tout nouveau composant.

---

## 1. États du dossier (workflow)

12 états (`lib/rif/etat-machine.ts`), inchangés par geometry-first :

```
BROUILLON → SOURCES_RECUES → SOURCES_ANALYSEES → CONTEXTE_A_CONFIRMER → PRET_A_GENERER
  → GENERATION_EN_COURS → CONTROLE_A_EXAMINER → VALIDE | A_CORRIGER | A_REPRENDRE | SUSPENDU | ECHEC
```

- `BROUILLON → SOURCES_RECUES` : mécanique, déclenché par le premier dépôt de source.
- `SOURCES_RECUES → SOURCES_ANALYSEES`, `→ CONTEXTE_A_CONFIRMER`, `→ SUSPENDU` : proposées par le modèle conversationnel (`avancerParcours`), décidées par le backend.
- `CONTEXTE_A_CONFIRMER → PRET_A_GENERER` : **action humaine uniquement** (`POST .../confirmer`), jamais le modèle.
- Les états de production (`GENERATION_EN_COURS`, `CONTROLE_A_EXAMINER`, `VALIDE`, `A_CORRIGER`, `A_REPRENDRE`) découlent des opérations (`genererRendu`/`corrigerRendu`) et du verdict humain (`.../audit`), jamais d'une proposition conversationnelle.
- **Geometry-first n'ajoute aucun état.** L'avancement de l'extraction 3D/alignement/pack de contraintes se lit sur des champs du `ProjectState` (§4-6), pas sur l'état dossier — voir `docs/PRD_RIF_V2_GEOMETRY_FIRST.md` §3 (audit explicite).

Le dossier expose `etat: EtatDossier` (GET dossier, page serveur) — c'est le seul état affiché aujourd'hui en tête de page (`app/dossiers/[dossierId]/page.tsx`).

---

## 1bis. Création de dossier

`POST /api/dossiers` — corps optionnel `{ name: string, type?: string, location?: string, description?: string }` (texte brut, pas de JSON = dossier sans `projectInfo`, pour compatibilité avec les dossiers créés avant l'ajout de ce champ). `name` doit être non vide si un corps est fourni. Réponse `201 { success:true, id, dossierRef }`. `GET /api/dossiers` liste les dossiers du propriétaire courant (`DossierResume[]`, §12).

## 2. Sources (4 types)

| Rôle (`RoleSource`) | Autorité (ADR-021) | Dépôt | Classification |
|---|---|---|---|
| `revit_view` | CADRAGE_INTENTIONNEL (ou GÉOMÉTRIE si pas de `model_3d` extrait) | `POST .../sources` | Automatique (Claude), ambiguë si confiance faible ou désaccord avec le slot |
| `axonometry` | CONTRÔLE_SPATIAL_SECONDAIRE | `POST .../sources` | idem |
| `site_photo` | ENVIRONNEMENT | `POST .../sources` | idem |
| `annotated_source` / `annotated_render` | — (convertie en directives) | `POST .../sources` | idem + extraction de directives (ADR-015) |
| `material_reference`, `existing_building_photo`, `render` | apparence limitée | `POST .../sources` | idem |
| `model_3d` | **GÉOMÉTRIE** (en priorité, si extrait) | `POST .../modele-3d` (pipeline dédié, §4) | **Aucune** — rôle certain par construction |

### 2.1 Dépôt d'une source image (`revit_view`/`axonometry`/`site_photo`/...)

1. `POST /api/dossiers/[dossierId]/sources/token` → jeton Vercel Blob (upload direct navigateur, ≤ 25 Mo, MIME contraints).
2. Upload direct vers Blob (`@vercel/blob/client`).
3. `POST /api/dossiers/[dossierId]/sources` — corps `{ pathname, originalName, role?: RoleSource }` :
   - `role` est un **indice**, jamais une autorité — la classification réelle vient de `detection-role.ts`.
   - Réponse `201 { success:true, fileId, role: RoleSource, ambigu: boolean }`.
   - Si `ambigu:true`, une confirmation humaine est requise via `PATCH .../sources/[fileId]` (corps `{ role_confirmed: RoleSource }`).
   - Si le rôle est `annotated_source`/`annotated_render`, des `localized_directives` peuvent être extraites automatiquement — visibles dans la fiche projet (§9), confirmables via `PATCH .../directives/[directiveId]` (corps `{ status: 'validated' | 'rejected' }`) si leur statut est `unknown`.
4. Le dossier passe mécaniquement `BROUILLON → SOURCES_RECUES` au premier dépôt.

### 2.2 Dépôt de la source modèle 3D (`model_3d`) — geometry-first

Pipeline **distinct**, jamais fusionné avec `.../sources` (pas d'image, pas de classification) :

1. `POST /api/dossiers/[dossierId]/modele-3d/token` → jeton Vercel Blob, **500 Mo max, aucune restriction de type** (format non figé).
2. Upload direct vers Blob.
3. `POST /api/dossiers/[dossierId]/modele-3d` — corps `{ pathname, originalName, format: string, sizeBytes?: number }` :
   - `format` est une chaîne libre déclarée par le client (ex. `"rvt"`, `"ifc"`) — **jamais validée contre une liste fermée**.
   - Réponse `201 { success:true, fileId, source: SourceModele3D }`.
   - Écrit `ProjectState.modele3D` avec `extractionStatus: 'UPLOADED'` — **ne lance aucune extraction**.

**Il n'existe aujourd'hui aucune route qui fait progresser `extractionStatus` au-delà de `UPLOADED`** : aucun fournisseur d'extraction n'est branché (§4). Le frontend doit afficher cet état sans prétendre qu'un traitement est en cours.

---

## 3. Source authorities (ADR-021)

`obtenirAutoriteSource(role)` (`lib/rif/geometrie-3d.ts`) :

| Rôle | Autorité |
|---|---|
| `model_3d` | `GEOMETRIE` |
| `revit_view` | `CADRAGE_INTENTIONNEL` |
| `site_photo` | `ENVIRONNEMENT` |
| `axonometry` | `CONTROLE_SPATIAL_SECONDAIRE` |

Un rôle absent de cette table n'a aucune autorité géométrique/environnement particulière (comportement conservateur par défaut). **Cette hiérarchie n'est pas exposée par une route dédiée** — elle est implicite dans la construction du prompt technique (`lib/rif/prompt-technique.ts`) et dans `ProjectState.sources[].role_confirmed`. Le frontend peut la recalculer statiquement (table ci-dessus) pour annoter l'affichage des sources, sans appel réseau supplémentaire.

---

## 4. Extraction géométrique

**Aucune route HTTP n'existe pour déclencher une extraction.** L'abstraction `GeometryExtractor` (`lib/rif/geometrie-3d.ts`) existe côté domaine, mais la seule implémentation branchée est `creerExtracteurNonConfigure()`, qui refuse honnêtement toute opération (`EXTRACTION_PROVIDER_NOT_CONFIGURED`).

Statuts possibles de `ProjectState.modele3D.extractionStatus` :

| Statut | Signification | Atteint aujourd'hui ? |
|---|---|---|
| `UPLOADED` | Fichier déposé, rien de plus | Oui — seul statut réellement atteignable |
| `VALIDATING`, `READY_FOR_EXTRACTION`, `EXTRACTING`, `EXTRACTED`, `FAILED`, `UNSUPPORTED` | Étapes d'un pipeline d'extraction réel | Non — aucun code ne produit ces statuts |

**Le frontend ne doit jamais afficher de barre de progression ou d'étape intermédiaire pour l'extraction** : tant qu'aucune route d'extraction n'existe, le seul message honnête est « Extraction non disponible — aucun fournisseur configuré » (déjà affiché par `DepotSources.tsx` et `FicheProjet.tsx`).

---

## 5. Geometry pack (`ProjectState.geometryPack`)

Pas de route dédiée — le pack, s'il existe, vit entièrement dans `ProjectState` (colonne JSONB `dossiers.project_state`), lu via `GET /api/dossiers/[dossierId]` (page serveur) ou tout endpoint qui renvoie le `ProjectState`.

Schéma (`GeometryConstraintPack`, `schemaVersion: 1`) :

```ts
{
  schemaVersion: number
  sourceFileId: string
  coordinateSystem?, modelBounds?, levels?, volumes?, roofs?, openings?,
  slabs?, pools?, annexes?, sitePlacement?, cameraData?,
  projectedSilhouetteFileId?, maskFileIds?, depthMapFileId?,
  semanticSegmentationFileId?, lockedZones?, editableZones?
}
```

Tous les champs sauf `schemaVersion`/`sourceFileId` sont optionnels et **absents tant qu'aucune extraction réelle ne les a produits**. Le frontend affiche le nombre de champs remplis (voir `FicheProjet.tsx`), jamais une valeur par défaut inventée pour un champ absent.

Effet sur la génération : quand `geometryPack` existe avec au moins un champ rempli, `lib/rif/prompt-technique.ts::construirePromptGeneration`/`construirePromptCorrection` l'utilisent comme référence prioritaire pour la géométrie (volumes, toiture, ouvertures, implantation) — la vue Revit ne fait plus alors autorité que sur le cadrage. Sans pack exploitable, comportement V2.1 standard inchangé.

---

## 6. Alignement caméra/photo (`ProjectState.alignment`)

Même remarque que §5 : pas de route dédiée, lu depuis le `ProjectState`.

```ts
{
  sourceCameraFileId: string
  targetPhotoFileId: string
  status: 'NOT_STARTED' | 'PROCESSING' | 'ALIGNED' | 'REVIEW_REQUIRED' | 'FAILED'
  confidence?: number
  transformation?, observations?, raisonEchec?
}
```

Sous le seuil `SEUIL_CONFIANCE_ALIGNEMENT = 0.7`, le statut est `REVIEW_REQUIRED` — le frontend doit alors afficher explicitement « validation humaine requise », jamais présenter l'alignement comme fiable. Aucun code ne produit aujourd'hui de valeur autre que ce que l'appelant construit manuellement (pas de service d'alignement réel branché).

---

## 7. Contraintes (zones verrouillées/modifiables)

Deux mécanismes distincts, **ne pas les confondre** :

1. **Environnement (ARCH-002)** — `ProjectState.environnement: ElementEnvironnement[]`, états `locked`/`editable`/`harmonizable`. Concerne le contexte réel (terrain, végétation, clôtures...), jamais l'architecture du projet.
2. **Contraintes & Libertés (§24A)** — `ProjectState.contraintes_libertes: Record<string, PolitiqueElement>`, niveaux `locked`/`strict`/`controlled`/`creative` par propriété (`geometry_policy`/`material_policy`/`lighting_policy`/`appearance_policy`). Une propriété absente vaut `locked`. Une liberté proposée par le modèle (`controlled`/`creative`) reste sans effet tant qu'elle n'a pas d'`authorized_by` — voir `libertesEnAttente`/`autoriserLibertesEnAttente`, effectif uniquement via `POST .../confirmer`.
3. **Geometry-first (§5)** — `geometryPack.lockedZones`/`editableZones`, quand le pack existe : zones dérivées de l'extraction, pas encore consommées par un mécanisme de confirmation dédié (pas de route de confirmation séparée — la géométrie du pack est verrouillée par défaut, ADR-021 point 6).

Le frontend actuel (`FicheProjet.tsx`) affiche 1, 2 (libertés proposées uniquement) et un résumé de 3 (nombre de champs du pack). Il n'existe pas d'éditeur de zones dédié — l'édition passe par la conversation (`mettreAJourFicheProjet`).

---

## 8. Modes de production

`ProjectState.mode: 'retexturation_revit' | 'retexturation_contextualisee' | 'photomontage_controle'` — **inchangé par geometry-first**. Voir `docs/PRD_RIF_V2_GEOMETRY_FIRST.md` §8 : la correspondance entre ces 3 modes et les 3 usages conceptuels geometry-first (fidèle/inséré/liberté visuelle) reste une **question ouverte**, à ne pas trancher côté frontend (ne pas afficher un 4e mode, ne pas renommer les 3 existants).

Une source `model_3d` extraite renforce l'autorité géométrique des 3 modes sans changer leur périmètre, leurs zones verrouillées ni leurs styles compatibles.

---

## 9. Correction categories (ADR-021)

`POST .../corriger` (HTTP direct) et l'outil conversationnel `corrigerRendu` exigent désormais un champ **`categorie`**, une des 6 valeurs :

```
MATERIAL | LIGHTING | VEGETATION | LOCAL_ENVIRONMENT | ARTIFACT_REMOVAL | MINOR_PRESENTATION
```

- Toute autre valeur (y compris une catégorie évoquant un changement architectural) est **refusée** : `400 { error: { code: 'corps_invalide', ... } }` sur la route HTTP, incident journalisé + message explicite sur le chemin conversationnel (« ressemble à une modification architecturale... utilise reprendreDepuisSources »).
- **Il n'existe pas de 7e catégorie `ARCHITECTURAL_CHANGE`** : une modification architecturale (volume, toiture, ouverture, implantation) n'est jamais une correction — elle exige `reprendreDepuisSources` ou une nouvelle source géométrique. Le refus explicite de toute catégorie hors des 6 listées EST le mécanisme qui empêche ce cas.
- Le prompt technique généré inscrit toujours la catégorie et rappelle que la géométrie verrouillée reste inchangée quelle que soit la demande.

Corps `POST .../corriger` : `{ elementAModifier: string, resultatAttendu: string, categorie: CategorieCorrection }` (les 3 champs requis).

---

## 9bis. RenderTarget / OutputType / QualityProfile (D-22, Lot 1 — implémenté)

**`Project → RenderTarget → Generations`.** Une cible de rendu (`RenderTarget`) regroupe les générations qui visent le même résultat (« Perspective entrée », « Perspective jardin », « Axonométrie générale »...). Chaque cible a au plus une génération canonique (§10.4). Contrairement à ce qu'un contrat antérieur de ce document décrivait, **ce n'est plus un concept seulement projeté — il est implémenté** (`lib/rif/render-targets.ts`, `neon/migrations/0002_render_targets.sql`).

### 9bis.1 OutputType

Exactement deux valeurs, aucune autre n'existe :

```
PHOTOREALISTIC_PERSPECTIVE | PHOTOREALISTIC_AXONOMETRY
```

### 9bis.2 Routes

- `GET /api/dossiers/[dossierId]/render-targets` → `{ success:true, renderTargets: RenderTarget[] }`.
- `POST /api/dossiers/[dossierId]/render-targets` — corps `{ name: string, outputType: OutputType }` (les deux requis) → `201 { success:true, renderTarget }`.
- `GET /api/dossiers/[dossierId]/render-targets/[renderTargetId]` → `{ success:true, renderTarget, generations: GenerationDetail[] }` (générations de cette cible uniquement, les plus récentes d'abord).
- `POST /api/dossiers/[dossierId]/render-targets/[renderTargetId]/activer` — pointe `ProjectState.active_render_target_id` vers cette cible (`repondreOperation`, `{success:true}`). Action **distincte** de la création : créer une cible ne l'active pas automatiquement.
- Pas de `DELETE` — les implications sur les générations déjà rattachées à une cible supprimée n'ont pas été auditées, volontairement hors périmètre.

```ts
RenderTarget {
  id, dossierId, name: string, outputType: OutputType,
  canonicalGenerationId: string | null,
  createdAt, updatedAt,
}
```

### 9bis.3 Rattachement d'une génération à une cible

- **Génération initiale** (`POST .../generer` ou outil `genererRendu`) : corps/paramètre optionnel `{ renderTargetId?: string }`. Résolution serveur : `renderTargetId` explicite > `ProjectState.active_render_target_id` > `null` (legacy). Une cible explicite invalide (introuvable ou d'un autre dossier) est refusée : `400 { error: { code: 'cible_invalide' } }`, **aucune génération créée**.
- **Correction** (`POST .../corriger` ou outil `corrigerRendu`) : **aucun paramètre de cible accepté**. La cible est toujours celle de la génération la plus récente du dossier (résolution automatique, `lib/rif/orchestrateur.ts`) — une correction ne change jamais silencieusement de cible, par construction plutôt que par validation.
- **Génération legacy** (dossier n'ayant jamais créé de cible) : `render_target_id: null` sur toutes ses générations, comportement strictement inchangé par rapport à avant le Lot 1.

`GenerationDetail` (§10.2) porte désormais `renderTargetId: string | null` et `parentGenerationId: string | null` (la génération dont celle-ci est la correction/reprise — `null` pour une génération initiale).

### 9bis.4 QualityProfile

Sous-ensemble ordonné et prioritaire de la grille LIB-002 (§11), dérivé de l'`OutputType` de la cible — **jamais transmis par le frontend**, toujours calculé côté backend (`lib/rif/render-targets.ts::criteresApplicables`).

| OutputType | Critères prioritaires (ordre) |
|---|---|
| `PHOTOREALISTIC_PERSPECTIVE` | implantation, cadrage, perspective, volumes, ouvertures, toiture, environnement, elements_inventes, photorealisme |
| `PHOTOREALISTIC_AXONOMETRY` | toiture, volumes, implantation, environnement, elements_inventes, silhouette, photorealisme |
| *(aucune cible — legacy)* | grille LIB-002 complète (18 critères) |

`elements_inventes` et `photorealisme` sont deux critères ajoutés à la grille LIB-002 elle-même (V1.9, correction d'une contradiction découverte en construisant ces profils — voir DECISIONS.md D-22 point 8), pas seulement à ces profils.

---

## 10. Génération — lifecycle, historique, canonique, comparaison

### 10.1 Lancer une génération/correction

- `POST /api/dossiers/[dossierId]/generer` — première génération, dossier doit être `PRET_A_GENERER`. Corps optionnel `{ renderTargetId?: string }` (§9bis.3) — un corps vide reste un appel legacy valide.
- `POST /api/dossiers/[dossierId]/corriger` — correction, dossier doit être `A_CORRIGER`. Corps : voir §9 (aucun paramètre de cible — résolution automatique, §9bis.3).
- `POST /api/dossiers/[dossierId]/reprendre` — reprise depuis les sources, dossier doit être `A_REPRENDRE`.
- Toutes renvoient `ResultatOperation` via `repondreOperation` :
  - Succès : `200 { success:true, generationId, imageUrl, ... }`.
  - Échec métier (fal.ai, stockage, timeout) : statut HTTP dérivé du code d'erreur (`fal_ai_echec`→502, `timeout`→504, `generation_echouee`→422, `transition_refusee`→409), corps `{ success:false, error:{code,message}, requestId }`.
- **Une seule variante par appel** (D-10 non tranchée — pas de limite ni de génération multiple).

### 10.2 Historique (`GET .../generations`)

`GET /api/dossiers/[dossierId]/generations` → `{ success:true, generations: GenerationDetail[] }`, chacune enrichie d'`imageUrl` (URL signée, 5 min, résolue à la demande — jamais stockée). Trié du plus récent au plus ancien.

```ts
GenerationDetail {
  id, dossierId, type: 'initial' | 'correction' | 'restart_from_sources',
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'timed_out',
  promptText, sourceFileIds, resultFileId, isCanonical: boolean,
  startedAt, completedAt,
  renderTargetId: string | null,      // Lot 1, D-22 — null = legacy
  parentGenerationId: string | null,  // génération corrigée/reprise, si applicable
  ...
}
```

`ProjectCockpit.tsx` appelle cette route au montage (§17) et resélectionne la génération canonique ou la plus récente réussie — l'état survit à un rechargement de page.

### 10.3 Détail / lifecycle d'une génération (`GET .../generations/[generationId]`)

`{ success:true, generation: GenerationDetail & { imageUrl }, audit: QualityAuditDetail | null }`. C'est la route à utiliser pour reconstruire l'état d'une génération après refresh sans dépendre du texte de conversation.

### 10.4 Génération canonique — désormais par cible (Lot 1, D-22)

- Backend : `POST .../generations/[generationId]/audit` (§11) appelle `definirGenerationCanonique` (signature inchangée) quand le verdict humain est `validation` ou `acceptable_avec_reserve` — **seul un verdict humain validant déclenche ceci, aucune route de canonicalisation directe n'existe**.
- **Scope de la canonique** : au plus une par groupe, où un groupe = une cible de rendu réelle, OU le pool des générations legacy (`render_target_id null`) d'un dossier — jamais mélangées. Une génération d'une cible A ne retire jamais la canonique d'une cible B du même dossier. Garanti au niveau base par un index unique partiel (`neon/migrations/0002_render_targets.sql`), pas seulement en application.
- **Exposition** : une génération avec cible → `render_targets.canonical_generation_id` (lu via `GET .../render-targets/[id]`) ; une génération legacy → `ProjectState.canonical_result_id` (axe distinct, inchangé depuis D-19) et `DossierResume.generationCanoniqueId` (§12 — reste le canonique legacy dossier-large, ne reflète pas les canoniques par cible). `GenerationDetail.isCanonical` reste vrai pour la canonique de son propre groupe, quel qu'il soit.
- Affiché comme « Référence » dans l'historique des générations et le sélecteur de rendu (`ProjectCockpit.tsx`) et dans la carte projet du dashboard (`ProjectDashboard.tsx`, §12) — ces écrans datent d'avant le Lot 1 et n'affichent donc aujourd'hui que la sémantique legacy ; un écran par cible reste à construire côté frontend pour exploiter `render_targets.canonical_generation_id`.

### 10.5 Comparaison — restreinte à la même cible (Lot 1, D-22)

`GET /api/dossiers/[dossierId]/generations/comparer?a=ID&b=ID` → `{ success:true, generationA: {...GenerationDetail, imageUrl}, generationB: {...}, outputType: OutputType | null }`. Les deux ids doivent appartenir au dossier (sinon 404) **et partager la même cible de rendu** (ou être toutes deux legacy, sans cible) — sinon `409 { error: { code: 'cible_differente' } }`. Comparer une cible à une autre, ou une cible à du legacy, n'est pas pris en charge dans ce lot (mode R&D cross-target explicitement non construit). L'écran de comparaison du frontend desktop compose aujourd'hui sa vue à partir des générations déjà chargées par `.../generations` plutôt que d'appeler cette route séparément — le contrat reste valide et disponible pour un usage direct (ex. lien profond) si un futur écran en a besoin.

---

## 11. Contrôle qualité (V2)

Deux routes distinctes, à ne jamais confondre :

### 11.1 Audit multimodal proposé (`POST .../generations/[generationId]/controle-qualite`)

Déclenche un vrai appel Claude Sonnet 5 (`lib/rif/controle-multimodal.ts`) sur le rendu + les sources, calcule un rapport LIB-002 et un `verdictProposed` — **jamais autoritaire**. Réponse :

```ts
{ success:true, auditId, report: LigneRapport[], verdictProposed, motif,
  renderTargetId: string | null,        // Lot 1, D-22
  outputType: OutputType | null,        // null si pas de cible (legacy)
  criteresApplicables: CritereControle[] // sous-ensemble du QualityProfile, ou grille complète si legacy
}
```

Nécessite `generation.status === 'succeeded'`, sinon `409`. **Non vérifié en conditions réelles** (`NOT_VERIFIED_LIVE`, dépend d'`ANTHROPIC_API_KEY`) — le bouton « Lancer le contrôle qualité » de l'onglet Qualité l'appelle désormais, et affiche honnêtement l'indisponibilité si la configuration serveur manque.

**QualityProfile dérivé côté backend (Lot 1, D-22, §9bis.4)** : si la génération a une cible, seuls les critères de son `QualityProfile` sont soumis au modèle (`ContexteControleMultimodal.criteresApplicables`) — jamais transmis par le frontend. Sans cible (legacy), la grille complète LIB-002 s'applique, comportement inchangé.

Priorité géométrique (ADR-021, LIB-002 §1) : `lib/rif/controle-qualite.ts::sourceControlePourCritere(critere, geometryPack)` retourne la source de contrôle à citer — le pack de contraintes géométriques si exploitable (désormais y compris pour `elements_inventes`), sinon la source 2D désignée comme en V2.1. Cette fonction est un helper pur, pas encore appelée par `controle-multimodal.ts` (le classifieur construit encore ses propres lignes de rapport sans consulter le pack — gap inchangé par ce lot).

### 11.2 Verdict humain (`POST .../generations/[generationId]/audit`)

Seule route qui compte pour l'export administratif (`autoriserExportAdministratif`). Corps `{ verdictHuman: VerdictControle, reserves?: string }`, un des 5 verdicts (`validation`, `acceptable_avec_reserve`, `correction_ciblee`, `nouvelle_generation`, `production_suspendue`) → transitionne le dossier vers `VALIDE`/`A_CORRIGER`/`A_REPRENDRE`/`SUSPENDU`. Si un audit multimodal existe déjà sans verdict humain, cette route le complète (même ligne) plutôt que d'en créer une seconde. Depuis le Lot 1 (D-22), la canonicalisation qu'elle déclenche est scopée par cible (§10.4) — le comportement HTTP de cette route elle-même est inchangé.

`RapportControle`/critères géométriques concernés par la priorité pack (`sourceControlePourCritere`) : `silhouette`, `volumes`, `toiture`, `ouvertures`, `implantation`, `elements_inventes`. Les autres critères (`cadrage`/`perspective` → vue Revit ; le reste → source désignée) sont inchangés.

**Grille LIB-002 V1.9 (Lot 1)** : 18 critères (`elements_inventes`, `photorealisme` ajoutés), 5 états (`conforme`/`reserve`/`non_conforme`/`non_applicable`/**`non_evalue`** — un critère non mesurable ne devient jamais `conforme`).

---

## 12. Dashboard (liste des dossiers)

`app/dossiers/page.tsx` (page serveur, pas une route API dédiée) appelle `depot.listerDossiers(ownerId)` → `DossierResume[]`, rendu par `ProjectDashboard.tsx` (client) :

```ts
DossierResume {
  id, dossierRef, etat: EtatDossier, createdAt, updatedAt,
  nombreGenerations: number,
  derniereGeneration: { id, status, startedAt } | null,
  generationCanoniqueId: string | null,
  projectInfo?: { name: string, type?: string, location?: string, description?: string },
}
```

Affichés aujourd'hui (`ProjectDashboard.tsx`) : `projectInfo.name`/`type`/`location` (repli sur `dossierRef` si absent — dossiers créés avant l'ajout de `projectInfo`), `etat`, `nombreGenerations`, présence d'une génération canonique (« Référence »), date de dernière activité (`updatedAt`, pas `derniereGeneration` littéralement mais un signal équivalent). `derniereGeneration.status` n'est pas affiché littéralement — écart mineur, non bloquant.

---

## 13. Conversation

- `GET /api/dossiers/[dossierId]/message` → `{ success:true, historique: MessageConversation[] }` (texte seul, jamais de blocs `tool_use`/`tool_result` bruts).
- `POST /api/dossiers/[dossierId]/message` — corps `{ message: string }` → `{ success:true, tour: ResultatTour }`. Boucle interne bornée (`MAX_APPELS_MODELE_PAR_TOUR = 2`) : si le modèle appelle un outil réel, le backend exécute l'opération, renvoie un `tool_result` au modèle et récupère un message de clôture en langage naturel avant de répondre au client — un seul aller-retour HTTP côté frontend.
- `ResultatTour` est soit `{ type: 'message', message }`, soit `{ type: 'operation', operation, resultat }`, soit `{ type: 'incident', message }` (appel d'outil simulé détecté, catégorie de correction invalide, etc.) — le frontend affiche `message` dans tous les cas, et peut réagir spécifiquement sur `type === 'operation'` pour rafraîchir l'état (ex. recharger `.../generations`, §10.2).

---

## 14. Ownership — récapitulatif

Toutes les routes sous `/api/dossiers/[dossierId]/**` vérifient `verifierProprietaire`. Les routes avec un `generationId`/`directiveId`/`fileId`/`renderTargetId` supplémentaire vérifient en plus son appartenance au dossier (`verifierGenerationDuDossier`/`verifierRenderTargetDuDossier` ou équivalent) — y compris quand un `renderTargetId` est fourni en corps de requête (`.../generer`, résolu et revalidé dans `orchestrateur.ts`, jamais fait confiance tel quel). `POST /api/dossiers` (création) et `GET /api/dossiers` (liste) n'ont pas de `dossierId` à ce stade — seule l'authentification s'applique, filtrée par `ownerId`.

---

## 15. Erreurs — table de référence

| Code | HTTP | Route(s) typique(s) | Signification |
|---|---|---|---|
| `non_authentifie` | 401 | toutes | Pas de session valide |
| `acces_refuse` | 403 | toutes avec `dossierId` | `ownerId` ≠ utilisateur courant |
| `dossier_introuvable` | 404 | toutes avec `dossierId` | Dossier inexistant |
| `generation_introuvable` | 404 | routes avec `generationId` | Génération inexistante ou hors de ce dossier |
| `corps_invalide` | 400 | POST/PATCH | Champ requis manquant/mal typé (inclut `categorie` invalide, §9) |
| `parametres_invalides` | 400 | `.../comparer` | `a`/`b` manquants |
| `transition_refusee` | 409 | `.../confirmer`, `.../audit` | Précondition de machine à états non remplie |
| `generation_non_terminee` | 409 | `.../controle-qualite` | Génération pas encore `succeeded` |
| `generation_echouee` | 422 | `.../generer`, `.../corriger` | fal.ai a répondu un échec propre |
| `configuration_manquante` | 500 | routes appelant Claude/fal.ai | Clé API absente côté serveur |
| `creation_impossible`, `persistance_echec` | 500 | `POST /api/dossiers`, `.../sources` | Échec d'écriture |
| `fal_ai_echec`, `reponse_inexploitable`, `stockage_echec`, `detection_role_echec`, `controle_qualite_echec` | 502 | selon route | Échec d'un service externe |
| `timeout` | 504 | `.../generer`, `.../corriger` | fal.ai n'a jamais atteint un état terminal |
| `jeton_upload_refuse` | 400 | `.../sources/token`, `.../modele-3d/token` | Contrainte d'upload violée |
| `cible_invalide` | 400 | `.../generer` | `renderTargetId` fourni introuvable ou hors de ce dossier (Lot 1, D-22) |
| `cible_introuvable` | 404 | `.../render-targets/[id]`, `.../activer` | Cible de rendu inexistante ou hors de ce dossier |
| `cible_differente` | 409 | `.../generations/comparer` | Les deux générations ne partagent pas la même cible de rendu |

---

## 16. États frontend exploitables — résumé pour Codex

Ce que le frontend peut/doit brancher sans appel supplémentaire, une fois le `ProjectState` et la liste de générations chargés :

- **Dossier :** `etat` (badge de statut, contrôle l'affichage du bouton de confirmation et des actions possibles).
- **Sources :** 4 blocs (Modèle 3D, Vue projet, Photo réelle, Axonométrie) + rôles ambigus/directives en attente (`role_confirmed` absent / `status: 'unknown'`).
- **Analyse 3D :** `modele3D.extractionStatus` — afficher tel quel, jamais de barre de progression fictive ; si `UPLOADED` (seul cas atteignable aujourd'hui), afficher « extraction non disponible ».
- **Alignement :** `alignment?.status` — si `REVIEW_REQUIRED`, badge d'alerte explicite.
- **Contraintes :** nombre de champs extraits du `geometryPack` (ou « aucun — mode standard ») + libertés proposées en attente de confirmation (`contraintes_libertes` sans `authorized_by`).
- **Mode de production :** `mode` — afficher tel quel (3 valeurs), jamais un 4e mode inventé.
- **Readiness de génération :** `etat === 'PRET_A_GENERER'` (le bouton `genererRendu`/route `.../generer` n'est actionnable que dans cet état — revérifié côté backend de toute façon).
- **Absence de provider configuré :** message statique tant qu'aucune route d'extraction n'existe (§4) — pas un état à interroger dynamiquement.
- **Erreurs :** toujours `error.code`/`error.message`/`requestId` (§0, §15) — jamais parser un message brut.
- **Cibles de rendu (Lot 1, D-22) :** `GET .../render-targets` pour lister ; une génération sans cible (`renderTargetId: null`) est un dossier legacy, jamais une erreur. Une action « Nouvelle cible » minimale (nom + `OutputType`) et un sélecteur de cible active suffisent pour le premier passage frontend (§9bis) — pas de refonte du cockpit existant.

---

## 17. Gaps connus — mis à jour le 18.09.2026 (Lot 1 RenderTarget)

**Résolu depuis la version précédente de ce document** par le chantier frontend desktop (`ProjectCockpit.tsx`, `ProjectDashboard.tsx` et les composants associés) — ne plus présumer ces gaps ouverts :

- ~~Aucune UI ne recharge `.../generations` après refresh~~ → `ProjectCockpit.tsx` recharge l'historique au montage (`load()`) et resélectionne la génération canonique ou la plus récente réussie.
- ~~Aucun badge « génération canonique »~~ → affiché comme « Référence » dans l'historique, le sélecteur de rendu et la carte projet du dashboard.
- ~~Aucune UI de comparaison~~ → onglet « Comparaison » avec slider, à partir des générations déjà chargées (pas d'appel supplémentaire à `.../comparer`, qui reste néanmoins un contrat valide si un écran en a besoin séparément un jour).
- ~~Aucun déclenchement frontend de l'audit multimodal~~ → bouton « Lancer le contrôle qualité » dans l'onglet Qualité, affiche honnêtement l'indisponibilité si la configuration serveur manque.
- ~~`lireReponseApi` non branché partout~~ → confirmé branché sur les 7 composants qui appellent l'API (`BoutonNouveauDossier`, `BoutonConfirmerFiche`, `ConversationRif`, `DepotSources`, `NewProjectWizard`, `ProjectCockpit`, `VerdictQualite`).
- ~~`derniereGeneration`/agrégats non affichés~~ → le dashboard affiche `nombreGenerations`, la présence d'une génération canonique et la date de dernière activité par carte projet.
- ~~`OutputType` inexistant dans le schéma~~ (Lot 1, D-22) → implémenté : `render_targets.output_type`, exposé sur `RenderTarget` et dérivé pour `GenerationDetail`/le rapport qualité via `render_target_id`. Voir §9bis.

**Gaps réellement encore ouverts :**

1. **Aucune route d'extraction géométrique** — normal tant qu'aucun fournisseur n'est choisi (§4) ; le prochain cycle de test (§19) précède ce choix.
2. **Une seule variante par génération** (D-10 non tranchée).
3. **`sourceControlePourCritere` pas encore consommée par `controle-multimodal.ts`** — le pack de contraintes n'influence pas encore réellement le rapport multimodal, seulement le prompt de génération (§5, §11.1).
4. **Aucune route de remplacement/suppression d'une source déjà déposée** — seule `PATCH .../sources/[fileId]` (confirmation de rôle) existe. Besoin confirmé par Évariste (`docs/PRD_RIF_V2_GEOMETRY_FIRST.md` §18), non construit.
5. **`TEMPORARY_PROJECT_ASSETS` (photos terrain en volume) non implémenté** — concept produit seulement (§18).
6. **Aucun système de quota/crédits** — besoin confirmé par Évariste, aucune implémentation ni schéma.
7. **Aucune UI pour les cibles de rendu** (Lot 1, D-22) — le contrat existe (§9bis) mais `ProjectCockpit.tsx`/`ProjectDashboard.tsx` (chantier `feat/rif-ux-ui-desktop`, non touché par ce lot) n'affichent pas encore de sélecteur de cible, de création de cible, ni de vue « canonique par cible » — ils continuent d'afficher la sémantique legacy dossier-large (§10.4).
8. **`neon/migrations/0002_render_targets.sql` non appliquée en production** — testée en lecture seule (`db:migrate:status`, détectée en attente), volontairement pas appliquée sans validation explicite.

Ces points sont soit hors du contrôle du frontend (fournisseur d'extraction, D-10, priorisation du rapport multimodal, migration), soit des besoins produit confirmés et volontairement non construits dans leur lot respectif (remplacement de source, assets temporaires, quotas, UI render-targets) — voir DECISIONS.md D-21/D-22 pour les arbitrages explicites.

## 18. Stockage temporaire des photos terrain — concept confirmé, non implémenté

Voir `docs/PRD_RIF_V2_GEOMETRY_FIRST.md` §15 pour le détail produit. Aucun schéma, route ou champ n'existe pour `TEMPORARY_PROJECT_ASSETS` — aucun rôle de source, route ou table. Ce contrat le documente pour que Codex sache qu'il est **acté côté produit mais pas encore contractuel** — ne pas le construire par anticipation sans un contrat backend réel qui l'expose.

(`OutputType`/`RenderTarget`, documentés ici sous le même intitulé jusqu'au Lot 1, sont désormais implémentés — voir §9bis. Ne plus les citer comme non implémentés.)

## 19. Prochain cycle de test — rappel

Le prochain cycle (comparaison de formats 3D réels, `docs/PRD_RIF_V2_GEOMETRY_FIRST.md` §16) précède tout choix de fournisseur d'extraction. Ce contrat n'anticipe aucune route d'extraction tant que ce cycle n'a pas produit de recommandation.
