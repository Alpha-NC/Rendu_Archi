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

## 2. Identifiants — un seul nœud à éditer

Sur cette instance n8n, l'onglet **Variables** est verrouillé (fonctionnalité
payante non incluse dans le plan actuel) et poser des variables
d'environnement demanderait de modifier le `docker-compose.yml` sur le VPS et
de redécompacter le conteneur — donc une coupure, même courte, de tous les
workflows déjà en production sur cette instance. Pour éviter ça, les 4
identifiants vivent **dans le workflow lui-même**, dans un unique nœud
**Configuration**, juste après le nœud Webhook :

| Champ | Valeur |
|---|---|
| `supabaseUrl` | URL du projet Supabase, ex. `https://xxxx.supabase.co` |
| `supabaseServiceKey` | Clé service Supabase (bypass RLS) — jamais la clé anon |
| `falKey` | Clé API fal.ai |
| `falModelEndpoint` | Slug exact du modèle Nano Banana Pro (voir §4) |

Après import, ouvre **Configuration**, remplace les quatre `A_COMPLETER` par
les vraies valeurs, enregistre le workflow. Tous les autres nœuds y font
référence (`$('Configuration').item.json.config...`) — c'est le seul endroit
à toucher, aucune autre manipulation, aucun redémarrage de conteneur.

Ces valeurs sont posées comme headers directement dans chaque nœud
`HTTP Request`, jamais via une credential « Header Auth » partagée — c'est la
contrainte du PRD §3.5 (bug 403 documenté avec le nœud Supabase natif et la
contamination de credentials partagées entre workflows dupliqués).

**Point de vigilance : ne jamais réexporter ce workflow avec les vraies
valeurs collées dedans vers un endroit versionné (Git, partage, etc.).** Le
fichier de ce dépôt reste volontairement avec `A_COMPLETER` partout ; les
vraies valeurs ne doivent exister que dans la base de données de ton
instance n8n, jamais dans ce dépôt.

*Si un jour l'offre n8n change et que Variables devient disponible, la
bascule est simple : remplacer le contenu du nœud Configuration par
`return [{ json: { body: $json.body, config: { supabaseUrl: $vars.SUPABASE_URL, ... } } }];`
sans toucher au reste du workflow.*

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
V1, inchangé. Le nœud **Construire le prompt** est maintenant **partiellement
calibré** avec le contenu du workflow V1 (« Générateur de Rendu Archi -
Evariste », n8n) :

- le prompt système fixe : repris **tel quel, en anglais**, de
  `system_prompt_fixe_v2` (V1, workflow « rif-simple-render ») — c'est la
  version à double référence (render 3D + photo réelle), la plus proche de
  l'architecture V2 (`images.cadrage` + `images.site` optionnelle). Non
  traduit intentionnellement, pour ne pas risquer d'altérer un texte déjà
  calibré en production. V1 avait une seconde version plus courte
  (`system_prompt_fixe`, associée à l'origine aux 3 blocs de style dans le
  workflow « rif-render ») ; c'est la version longue qui a été retenue ici.
- les 3 blocs `style` (`photomontage_administratif`, `presentation_client`,
  `commercial`) : repris tels quels, en anglais, de V1
  (`style_block_administratif`, `style_block_client`, `style_block_commercial`).

Reste en **brouillon**, sans équivalent en V1 :

- les 3 clauses `mode_production` (`photomontage_controle`,
  `presentation_generative`, `retexturation_revit`) — ce découpage est un
  concept propre à V2. À calibrer sur un dossier réel avant mise en
  production, comme le prescrit `docs/fragments-prompt.md` pour le ciel, la
  pelouse et les éclairages (déjà repris mot pour mot dans le nœud, eux, pas
  des brouillons).

**Point de vigilance mélange de langues** : le prompt final envoyé à fal.ai
mélange donc de l'anglais (SYSTÈME, STYLE) et du français (MODE DE
PRODUCTION, LUMIÈRE, ÉCLAIRAGES, MATÉRIAUX, ENVIRONNEMENT...). C'est un choix
assumé (risque de mal traduire un texte déjà calibré jugé plus grand que le
risque d'un prompt multilingue), mais à surveiller sur les premiers rendus
réels — si la qualité s'en ressent, envisager de traduire section par
section plutôt que de revenir au brouillon.

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

- **Corrigé le 2026-08-09, reproduit en test réel** : la ligne `dossiers`
  créée en fin de `generate` remontait avec un objet vide côté front
  (« La réponse du service n'est pas exploitable. », alors que fal.ai avait
  bien produit une image). Cause : le nœud **Supabase - créer ligne
  dossiers** impose `Accept: application/vnd.pgrst.object+json` pour obtenir
  un objet PostgREST plutôt qu'un tableau, mais ce content-type n'est pas
  reconnu par l'autodétection de n8n (`options.response.response.responseFormat:
  autodetect`), qui traite alors le corps comme du texte brut et l'enveloppe
  en `{ data: '...' }` — **Construire la réponse** lit ensuite `ligne.id`,
  `ligne.image_url` etc. sur cet objet, tous `undefined`. Fix :
  `responseFormat` forcé à `json` sur ce nœud.
- **Observé, non bloquant** : deux échecs `401 — "JWT issued at future"`
  (PGRST303) sur **Supabase - lire matériaux valides**, entourés d'appels
  réussis avec la même clé au même moment. Signature typique d'un décalage
  d'horloge juste après la création/rotation d'une clé `service_role` — les
  appels suivants sont repassés au vert sans intervention. À surveiller si
  ça redevient fréquent, mais pas une erreur de configuration du workflow.
- **Corrigé le 2026-08-09, reproduit en test réel** : quand aucun matériau
  catalogue n'est sélectionné (cas fréquent — ex. un projet « piscine » dont
  les seules catégories proposées, margelles/plage, n'ont pas encore de
  ligne `statut = valide` en base), **Supabase - lire fragments matériaux**
  renvoie 0 ligne. C'est un `GET` normal et réussi, mais n8n interprète 0
  item en sortie comme « rien à traiter » et n'exécute **aucun** nœud en
  aval — ni **Construire le prompt**, ni les deux nœuds **Répondre**. Le
  front reçoit alors une réponse qui ne correspond à aucune forme attendue
  (`estReponseGenerate` et `estErreur` échouent tous les deux) et affiche
  « La réponse du service n'est pas exploitable. ». Fix : `alwaysOutputData`
  activé sur ce nœud et sur son équivalent côté `get_materiaux` (**Supabase
  - lire matériaux valides**), pour que le pipeline continue même sans ligne
  trouvée.
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
