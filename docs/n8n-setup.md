# Mise en place du workflow n8n

Ce document accompagne [`n8n/workflow-rendu-architectural.json`](../n8n/workflow-rendu-architectural.json).
Il couvre le périmètre marqué « dans le lot » par `docs/contrat-webhook-n8n.md` :
`get_materiaux` et `generate`. Les quatre autres actions (`correct`,
`regenerate`, `validate`, `get_dossier`) répondent une erreur métier
`action_indisponible` — elles ne sont pas implémentées, volontairement.

## 1. Import

Dans n8n : **Workflows → Import from File**, sélectionner le JSON. Le
workflow arrive désactivé (`active: false`). Vérifie node par node que
l'import n'a rien tronqué — les nœuds `HTTP Request` et `IF` ont parfois un
schéma de paramètres légèrement différent selon la version de n8n ; si un
champ semble vide après import, le champ `notes` du nœud concerné contient
l'expression attendue à recoller.

## 2. Variables d'environnement (côté n8n, pas côté front)

À définir sur l'instance n8n elle-même (fichier d'environnement du service,
pas `.env` du dépôt front — aucune clé ne doit jamais entrer dans ce dépôt) :

| Variable | Rôle |
|---|---|
| `SUPABASE_URL` | URL du projet Supabase, ex. `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Clé service Supabase (bypass RLS) — jamais la clé anon |
| `FAL_KEY` | Clé API fal.ai |
| `FAL_MODEL_ENDPOINT` | Slug exact du modèle Nano Banana Pro (voir §4) |

Ces headers sont posés directement dans chaque nœud `HTTP Request`, jamais
via une credential « Header Auth » partagée — c'est la contrainte du PRD
§3.5 (bug 403 documenté avec le nœud Supabase natif et la contamination de
credentials partagées entre workflows dupliqués).

## 3. Ce que le workflow fait déjà

- **`get_materiaux`** : lit `materiaux` filtré sur `statut = valide`, groupe
  les six catégories (toujours présentes, vides ou non), répond
  `{ materiaux: {...} }`.
- **`generate`** :
  1. valide la requête (référence, vue de cadrage, style présents) ;
  2. va chercher les `fragment_prompt` des matériaux catalogue sélectionnés ;
  3. assemble le prompt (nœud **Construire le prompt**) selon les règles de
     `docs/contrat-webhook-n8n.md` et la précédence ciel/style de
     `docs/fragments-prompt.md` §2 ;
  4. crée les lignes `materiaux` à calibrer pour les saisies libres
     (`statut = a_calibrer`, jamais utilisées dans le prompt) ;
  5. soumet à fal.ai en asynchrone (`queue.fal.run`), **polle** `status_url`
     toutes les 5 s jusqu'à `COMPLETED` (plafond 40 tentatives ≈ 3 min 20,
     au-delà : erreur métier `delai_depasse`) ;
  6. récupère `response_url`, écrit la ligne `dossiers` (`prompt` et
     `payload` complets), répond `{ cycle_id, reference, image_url, prompt }`.

Le nœud **Répondre - génération** répond un objet JSON unique, pas un
tableau — point explicitement documenté comme piège dans
`lib/n8n/contrat.ts` (`estReponseGenerate`) : un `Respond to Webhook`
recevant un seul item en entrée répond bien un objet, à condition de ne pas
le faire passer par un nœud qui le re-fragmente en amont.

## 4. Contenu à compléter avant un test réel

Le PRD indique que le pipeline de génération (n8n → fal.ai) est repris de la
V1, inchangé. Ce dépôt n'a pas accès à ce contenu existant : le nœud
**Construire le prompt** contient donc un **brouillon**, pas le texte
calibré, pour :

- le prompt système fixe (contrainte géométrie + mandat de photoréalisme) ;
- les 3 clauses `mode_production` (`photomontage_controle`,
  `presentation_generative`, `retexturation_revit`) ;
- les 3 blocs `style` (`photomontage_administratif`, `presentation_client`,
  `commercial`).

**Si tu as ce texte côté V1** (workflow n8n existant, ou prompt du Custom
GPT), colle-le tel quel dans le nœud — il remplace le brouillon.
**Sinon**, calibre ce brouillon sur un dossier réel avant mise en
production, exactement comme le prescrit `docs/fragments-prompt.md` pour le
ciel, la pelouse et les éclairages (déjà repris mot pour mot dans le nœud,
eux, pas des brouillons).

Il manque aussi `FAL_MODEL_ENDPOINT` : le slug exact du modèle fal.ai
(`fal-ai/...`) déjà utilisé en V1 pour Nano Banana Pro. Sans lui, le nœud
**Soumettre à fal.ai** appelle une URL invalide.

Enfin, les catégories `toiture`, `facade`, `menuiseries` doivent déjà avoir
des lignes `materiaux` en base avec `statut = 'valide'` (elles existaient en
V1, selon `docs/fragments-prompt.md` §0) — sinon `get_materiaux` renverra ces
catégories vides côté formulaire. `volets`, `margelles`, `plage` sont, eux,
prévus à `a_calibrer` : c'est le comportement attendu tant qu'ils ne sont
pas validés manuellement.

## 5. Non inclus dans cette livraison

- **Archivage Google Drive** (PRD §4.3). `dossiers.image_url` pointe
  aujourd'hui directement vers l'URL renvoyée par fal.ai, pas vers un
  fichier Drive archivé. Cette URL fal.ai reste utilisable par le front
  (contrairement aux URL de stockage fal.ai côté *entrée*, documentées
  inaccessibles au PRD §3.5 — cette restriction concerne les images
  envoyées à fal.ai, pas celles qu'il renvoie).
  Pour ajouter l'archivage : un nœud `HTTP Request` (authentification
  `Google Drive OAuth2 API` prédéfinie) pour chercher/créer le dossier par
  référence, puis le nœud natif **Google Drive** (opération *Upload*) pour
  déposer le fichier — le nœud natif gère l'encodage multipart attendu par
  l'API Drive, plus fiable ici qu'un `HTTP Request` manuel.
- **`correct`, `regenerate`, `validate`, `get_dossier`** — hors lot par
  contrat, stubés en erreur `action_indisponible`.
- **Protection d'accès par mot de passe** (PRD §8) — sujet distinct, pas
  câblé dans ce workflow.

## 6. Hypothèses à vérifier sur un cas réel (PRD §10 : rien ne se valide sur plan)

- `POST /rest/v1/materiaux` avec un tableau vide (`[]`, cas où
  `materiaux_libres` est vide) : PostgREST est censé accepter et ne rien
  insérer. À confirmer sur ta version. Si elle rejette, entourer le nœud
  **Supabase - créer matériaux à calibrer** d'un `IF` sur la longueur du
  tableau.
- Forme exacte de la réponse fal.ai une fois `COMPLETED` (`images[0].url` où
  la valeur est censée être un tableau d'objets `{url, ...}` — l'enum de
  statut `IN_QUEUE` / `IN_PROGRESS` / `COMPLETED` provient de l'API queue
  fal.ai standard, à confirmer avec le modèle réellement configuré).
- Comportement du bundle à 4 images en correction (hors lot ici, mais point
  de vigilance déjà signalé au PRD §3.7 pour le jour où `correct` sera
  implémenté).

## 7. Test de bout en bout

1. Charger `supabase/schema.sql`, ajouter quelques lignes `materiaux`
   `statut = 'valide'` pour tester `get_materiaux`.
2. Envoyer `{ "action": "get_materiaux" }` au webhook, vérifier les six clés.
3. Compléter le contenu du §4, envoyer un `generate` réel avec une vraie vue
   de cadrage, vérifier la ligne créée dans `dossiers` et l'image retournée.
4. Basculer `NEXT_PUBLIC_N8N_WEBHOOK_URL` du front vers l'URL du webhook et
   rejouer le parcours complet du formulaire.
