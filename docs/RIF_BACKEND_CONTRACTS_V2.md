# RIF-App — Contrats backend V2 (geometry-first)

**Statut :** Draft — 18 septembre 2026. Décrit le backend réellement en place sur `feat/rif-backend-completion`, y compris le workflow geometry-first (ADR-021, D-20). Objectif explicite : permettre à Codex de construire/adapter le frontend sans deviner un contrat.

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
- **Lecture des réponses côté front :** utiliser `lib/rif/reponse-client.ts::lireReponseApi` partout où c'est déjà câblé (`DepotSources.tsx`) — **pas encore branché** sur `BoutonNouveauDossier.tsx`, `BoutonConfirmerFiche.tsx`, `ConversationRif.tsx`, `VerdictQualite.tsx` (dette connue, voir §20). Un front qui appelle `reponse.json()` nu sur ces derniers peut encore afficher une erreur de parsing brute sur un 413/corps vide.

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

## 10. Génération — lifecycle, historique, canonique, comparaison

### 10.1 Lancer une génération/correction

- `POST /api/dossiers/[dossierId]/generer` — première génération, dossier doit être `PRET_A_GENERER`. Aucun paramètre de corps.
- `POST /api/dossiers/[dossierId]/corriger` — correction, dossier doit être `A_CORRIGER`. Corps : voir §9.
- `POST /api/dossiers/[dossierId]/reprendre` — reprise depuis les sources, dossier doit être `A_REPRENDRE`.
- Toutes renvoient `ResultatOperation` via `repondreOperation` :
  - Succès : `200 { success:true, generationId, imageUrl, ... }`.
  - Échec métier (fal.ai, stockage, timeout) : statut HTTP dérivé du code d'erreur (`fal_ai_echec`→502, `timeout`→504, `generation_echouee`→422, `transition_refusee`→409), corps `{ success:false, error:{code,message}, requestId }`.
- **Une seule variante par appel** (D-10 non tranchée — pas de limite ni de génération multiple).

### 10.2 Historique (`GET .../generations`)

`GET /api/dossiers/[dossierId]/generations` → `{ success:true, generations: GenerationDetail[] }`, chacune enrichie d'`imageUrl` (URL signée, 5 min, résolue à la demande — jamais stockée). Trié du plus récent au plus ancien.

```ts
GenerationDetail {
  id, dossierId, type: 'initial' | 'correction',
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'timed_out',
  promptText, sourceFileIds, resultFileId, isCanonical: boolean,
  startedAt, completedAt, ...
}
```

**Gap connu (§20) :** aucun composant frontend n'appelle cette route aujourd'hui — `ConversationRif`/`VerdictQualite` ne connaissent une génération que via l'état React du tour qui vient de l'exécuter. Après un rechargement de page avec une génération en attente de verdict, l'image et le contrôle qualité disparaissent (seul le texte de conversation revient). Codex doit brancher cette route au montage de la page dossier pour restaurer l'état.

### 10.3 Détail / lifecycle d'une génération (`GET .../generations/[generationId]`)

`{ success:true, generation: GenerationDetail & { imageUrl }, audit: QualityAuditDetail | null }`. C'est la route à utiliser pour reconstruire l'état d'une génération après refresh sans dépendre du texte de conversation.

### 10.4 Génération canonique

- Backend : `POST .../generations/[generationId]/audit` (§11) appelle `definirGenerationCanonique` quand le verdict humain est `validation` ou `acceptable_avec_reserve` — au plus une canonique par dossier, synchronisée à la fois sur `generations.is_canonical` et `ProjectState.canonical_result_id`.
- Exposition : `GenerationDetail.isCanonical`, `DossierResume.generationCanoniqueId` (§13).
- **Gap connu :** aucun badge/filtre frontend ne l'affiche aujourd'hui sur la page dossier (seul `app/dossiers/page.tsx`, la liste, l'affiche désormais — voir §13).

### 10.5 Comparaison

`GET /api/dossiers/[dossierId]/generations/comparer?a=ID&b=ID` → `{ success:true, generationA: {...GenerationDetail, imageUrl}, generationB: {...} }`. Les deux ids doivent appartenir au dossier (sinon 404). **Aucune UI ne consomme cette route aujourd'hui** (gap connu, §20) — le contrat est prêt, l'écran de comparaison reste à construire.

---

## 11. Contrôle qualité (V2)

Deux routes distinctes, à ne jamais confondre :

### 11.1 Audit multimodal proposé (`POST .../generations/[generationId]/controle-qualite`)

Déclenche un vrai appel Claude Sonnet 5 (`lib/rif/controle-multimodal.ts`) sur le rendu + les sources, calcule un rapport LIB-002 et un `verdictProposed` — **jamais autoritaire**. Réponse : `{ success:true, auditId, report: LigneRapport[], verdictProposed, motif }`. Nécessite `generation.status === 'succeeded'`, sinon `409`. **Non vérifié en conditions réelles** (`NOT_VERIFIED_LIVE`, dépend d'`ANTHROPIC_API_KEY`) et **aucune UI ne l'appelle** (gap connu, §20).

Priorité géométrique (ADR-021, LIB-002 §1) : `lib/rif/controle-qualite.ts::sourceControlePourCritere(critere, geometryPack)` retourne la source de contrôle à citer — le pack de contraintes géométriques si exploitable, sinon la source 2D désignée comme en V2.1. Cette fonction est un helper pur, pas encore appelée par `controle-multimodal.ts` (le classifieur construit encore ses propres lignes de rapport sans consulter le pack).

### 11.2 Verdict humain (`POST .../generations/[generationId]/audit`)

Seule route qui compte pour l'export administratif (`autoriserExportAdministratif`). Corps `{ verdictHuman: VerdictControle, reserves?: string }`, un des 5 verdicts (`validation`, `acceptable_avec_reserve`, `correction_ciblee`, `nouvelle_generation`, `production_suspendue`) → transitionne le dossier vers `VALIDE`/`A_CORRIGER`/`A_REPRENDRE`/`SUSPENDU`. Si un audit multimodal existe déjà sans verdict humain, cette route le complète (même ligne) plutôt que d'en créer une seconde.

`RapportControle`/critères géométriques concernés par la priorité pack (`sourceControlePourCritere`) : `silhouette`, `volumes`, `toiture`, `ouvertures`, `implantation`. Les autres critères (`cadrage`/`perspective` → vue Revit ; le reste → source désignée) sont inchangés.

---

## 12. Dashboard (liste des dossiers)

`app/dossiers/page.tsx` (page serveur, pas une route API dédiée) appelle `depot.listerDossiers(ownerId)` → `DossierResume[]` :

```ts
DossierResume {
  id, dossierRef, etat: EtatDossier, createdAt, updatedAt,
  nombreGenerations: number,
  derniereGeneration: { id, status, startedAt } | null,
  generationCanoniqueId: string | null,
}
```

Affichés aujourd'hui : `dossierRef`, `etat`, `nombreGenerations`, présence d'une génération canonique. **Pas encore affichés :** `derniereGeneration` (statut/date de la dernière génération) — gap mineur, données déjà disponibles côté serveur.

---

## 13. Conversation

- `GET /api/dossiers/[dossierId]/message` → `{ success:true, historique: MessageConversation[] }` (texte seul, jamais de blocs `tool_use`/`tool_result` bruts).
- `POST /api/dossiers/[dossierId]/message` — corps `{ message: string }` → `{ success:true, tour: ResultatTour }`. Boucle interne bornée (`MAX_APPELS_MODELE_PAR_TOUR = 2`) : si le modèle appelle un outil réel, le backend exécute l'opération, renvoie un `tool_result` au modèle et récupère un message de clôture en langage naturel avant de répondre au client — un seul aller-retour HTTP côté frontend.
- `ResultatTour` est soit `{ type: 'message', message }`, soit `{ type: 'operation', operation, resultat }`, soit `{ type: 'incident', message }` (appel d'outil simulé détecté, catégorie de correction invalide, etc.) — le frontend affiche `message` dans tous les cas, et peut réagir spécifiquement sur `type === 'operation'` pour rafraîchir l'état (ex. recharger `.../generations`, §10.2).

---

## 14. Ownership — récapitulatif

Toutes les routes sous `/api/dossiers/[dossierId]/**` vérifient `verifierProprietaire`. Les routes avec un `generationId`/`directiveId`/`fileId` supplémentaire vérifient en plus son appartenance au dossier (`verifierGenerationDuDossier` ou équivalent). `POST /api/dossiers` (création) et `GET /api/dossiers` (liste) n'ont pas de `dossierId` à ce stade — seule l'authentification s'applique, filtrée par `ownerId`.

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

---

## 17. Gaps connus (backend loop précédent + geometry-first) — non silencieux

Ce contrat documente explicitement ce qui n'est PAS encore construit, pour que Codex ne suppose pas qu'un flux existe :

1. **Aucune UI ne recharge `.../generations` après refresh** — état perdu au F5 pendant une revue de rendu (§10.2).
2. **Aucun badge « génération canonique » sur la page dossier** (seule la liste des dossiers l'indique désormais, §12).
3. **Aucune UI de comparaison** entre deux générations (route prête, §10.5).
4. **Aucun déclenchement frontend de l'audit multimodal** (`.../controle-qualite`) — le flux actuel ne fait que le verdict humain direct (§11.1).
5. **`lireReponseApi` non branché** sur `BoutonNouveauDossier.tsx`, `BoutonConfirmerFiche.tsx`, `ConversationRif.tsx`, `VerdictQualite.tsx` (§0).
6. **Aucune route d'extraction géométrique** — normal tant qu'aucun fournisseur n'est choisi (§4), mais Codex ne doit pas construire d'écran qui suppose son existence.
7. **`derniereGeneration` non affichée** dans la liste des dossiers (§12).
8. **Une seule variante par génération** (D-10 non tranchée).
9. **`sourceControlePourCritere` pas encore consommée par `controle-multimodal.ts`** — le pack de contraintes n'influence pas encore réellement le rapport multimodal, seulement le prompt de génération (§5, §11.1).

Aucun de ces points n'est bloquant pour un premier passage frontend geometry-first (dépôt de source 3D, affichage honnête des statuts) — ils concernent des écrans/flux non couverts par le périmètre « frontend minimal » de cette mission.
