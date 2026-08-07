# Design — Formulaire 7 étapes

Date : 2026-08-07
Statut : validé, à planifier
Référence : `docs/prd-generateur-rendu-v2.md` (PRD V2)

---

## 1. Objet du lot

Construire le formulaire progressif en 7 étapes décrit au §5 du PRD, jusqu'à l'envoi de l'action `generate` au webhook n8n et l'affichage d'un état d'attente.

Le lot s'arrête à la réception de la réponse. L'écran post-génération, le mode annotation, les actions `correct` / `regenerate` / `validate`, la protection par mot de passe, Supabase et Google Drive sont hors lot.

### 1.1 État de l'existant

Le dépôt contient le scaffold Next.js par défaut : `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, aucune dépendance au-delà de Next 16 / React 19 / Tailwind 4, aucun test, pas de `.env.example`.

Côté n8n, le workflow `rendu-formulaire-n8n-v1` existe et fonctionne, mais avec une architecture V1 : déclencheur Form Trigger natif, matériaux codés en dur dans un node Code, sortie par email, aucune persistance. Il n'expose aucun webhook routé par `action`. Le front est donc développé contre un adaptateur mocké, et ce document fige le contrat que le webhook devra respecter.

---

## 2. Décisions

| Sujet | Décision |
|---|---|
| Architecture | État central `useReducer` + logique métier extraite en modules purs |
| Dépendances ajoutées | Vitest uniquement (dev) — aucune dépendance de production |
| Transport des images | JSON, data URI base64, redimensionnées à 2048 px côté front |
| Référence de dossier | Champ texte obligatoire saisi à l'étape 1 |
| Tests | Vitest sur la logique pure, pas de test de composant ni de parcours |
| Interface | Sobre et fonctionnelle, Tailwind, une colonne centrée |
| Nommage | Vocabulaire métier en français dans le code |
| Développement sans n8n | Adaptateur mocké activé par absence de variable d'environnement |

### 2.1 Nommage

Le domaine est français et le restera : `materiaux`, `cadrage`, `margelles`, `plage`, `volets`. Traduire ce vocabulaire créerait un décalage permanent entre le code, le PRD et la table Supabase. Les identifiants du domaine sont donc en français ; les API React et les conventions du framework restent en anglais.

---

## 3. Structure des fichiers

Une seule route. La navigation entre étapes est un état, pas une URL : le formulaire est un flux linéaire dont aucune étape n'a de sens en entrée directe, et une URL par étape rendrait la restauration d'état plus fragile qu'elle ne l'est déjà.

```
app/page.tsx                              monte <FormulaireRendu />

lib/form/types.ts                         types de l'état et du domaine
lib/form/etat-initial.ts
lib/form/reducer.ts                       transitions pures
lib/form/regles.ts                        logique conditionnelle du PRD
lib/form/validation.ts                    franchissabilité des étapes
lib/form/payload.ts                       construction du corps de `generate`
lib/form/persistance.ts                   sauvegarde et restauration de session

lib/images/redimensionner.ts              File -> data URI JPEG 2048 px

lib/n8n/contrat.ts                        types de requête et de réponse
lib/n8n/client.ts                         appel du webhook, une fonction par action
lib/n8n/mock.ts                           adaptateur mocké

components/formulaire/FormulaireRendu.tsx  orchestrateur, contexte, navigation
components/formulaire/IndicateurEtapes.tsx
components/formulaire/etapes/Etape1Identification.tsx
components/formulaire/etapes/Etape2Documents.tsx
components/formulaire/etapes/Etape3Materiaux.tsx
components/formulaire/etapes/Etape4Environnement.tsx
components/formulaire/etapes/Etape5Style.tsx
components/formulaire/etapes/Etape6Precisions.tsx
components/formulaire/etapes/Etape7FicheProjet.tsx
components/formulaire/champs/ChampChoixUnique.tsx
components/formulaire/champs/ChampFichierImage.tsx
components/formulaire/champs/ChampMateriau.tsx
components/formulaire/champs/ChampInterrupteur.tsx
```

Règle de séparation : `lib/form` ne connaît ni React ni le DOM. Les composants d'étape ne contiennent aucune règle métier — ils interrogent `regles.ts` et affichent le résultat. Un composant d'étape doit pouvoir être réécrit sans qu'aucun test ne change.

---

## 4. État du formulaire

```ts
type EtatFormulaire = {
  etape: Etape                    // 1..7, étape affichée
  etapeMax: Etape                 // plus haute étape atteinte, autorise le retour arrière

  reference: string
  typeProjet: TypeProjet | null
  usage: Usage | null

  typeCadrage: TypeCadrage | null
  images: {
    cadrage: ImageChargee | null
    complementaire: ImageChargee | null
    site: ImageChargee | null
  }

  materiaux: Record<Categorie, SelectionMateriau | null>

  conserverVegetation: boolean    // vrai par défaut
  elementsARetirer: string
  ciel: Ciel

  style: Style | null
  styleChoisiManuellement: boolean

  precisions: string
}

type ImageChargee = {
  dataUri: string                 // data:image/jpeg;base64,...
  nomOrigine: string
  largeur: number
  hauteur: number
  poidsOctets: number
}

type SelectionMateriau =
  | { origine: 'catalogue'; id: string; terme: string }
  | { origine: 'libre'; terme: string }

type TypeProjet   = 'piscine' | 'extension' | 'restructuration' | 'terrasse' | 'pool_house'
type Usage        = 'permis_de_construire' | 'presentation_client' | 'les_deux'
type TypeCadrage  = 'perspective' | 'axonometrie'
type Ciel         = 'degage' | 'legerement_voile' | 'neutre'
type Categorie    = 'toiture' | 'facade' | 'volets' | 'menuiseries' | 'margelles' | 'plage'
type Style        = 'administratif_simple' | 'administratif_soigne' | 'presentation_client'
                  | 'concours_communication' | 'photomontage_administratif'
```

Deux champs existent uniquement pour satisfaire une règle du PRD :

- `etapeMax` : le PRD exige que les étapes déjà atteintes restent accessibles en arrière. Sans mémoire de la progression, l'indicateur d'étapes ne peut pas distinguer une étape franchie d'une étape à venir.
- `styleChoisiManuellement` : le PRD veut que l'usage pré-sélectionne un style, et que cette pré-sélection soit écrasée dès que l'utilisateur choisit un style à la main. La règle est inexprimable sans mémoriser l'origine de la valeur courante.

---

## 5. Règles métier

Toutes dans `lib/form/regles.ts`, toutes pures.

### 5.1 Champs matériaux affichés

`champsMateriauxPour(typeProjet): Categorie[]`, transcription directe de la table du PRD §5 étape 3 :

| Type de projet | Catégories affichées |
|---|---|
| Piscine | margelles, plage |
| Extension | toiture, facade, volets, menuiseries |
| Restructuration | toiture, facade, volets, menuiseries |
| Terrasse | aucune |
| Pool house | toiture, facade, volets, menuiseries, margelles, plage |

Margelles et plage restent deux champs distincts, jamais fusionnés.

### 5.2 Styles disponibles

`stylesDisponibles(typeCadrage): Style[]` — `photomontage_administratif` est retiré dès que le cadrage vaut `axonometrie`.

### 5.3 Correction automatique du style

Traité dans le reducer, sur l'action de changement de cadrage : si le cadrage passe à `axonometrie` alors que le style courant est `photomontage_administratif`, le style bascule sur `administratif_soigne`. La règle s'applique quel que soit l'ordre des saisies, y compris si le style avait été choisi manuellement avant le retour en arrière.

### 5.4 Pré-sélection du style

Sur changement d'usage, si `styleChoisiManuellement` est faux :

- usage `presentation_client` → style `presentation_client`
- tout autre usage → style `administratif_soigne`

Tout choix de style par l'utilisateur pose `styleChoisiManuellement` à vrai, définitivement pour la session.

### 5.5 Matériau en saisie libre

Chaque champ matériau propose, en plus des termes du catalogue, une entrée « Autre texture ». La sélectionner révèle un champ texte. La valeur produit une `SelectionMateriau` d'origine `libre`, affichée avec une mention visible « non calibré ».

Une valeur libre :

- est envoyée dans `materiaux_libres`, jamais dans `materiaux` ;
- est récapitulée à l'étape 6 et à l'étape 7 ;
- n'apparaît jamais dans une liste déroulante.

La séparation des deux tableaux dans le payload est le mécanisme qui garantit le critère « une saisie libre n'entre jamais dans un prompt » : n8n construit le prompt à partir de `materiaux` seul, et crée les lignes `statut = 'a_calibrer'` à partir de `materiaux_libres` seul.

### 5.6 Franchissabilité des étapes

`etapeFranchissable(etat, etape): boolean` dans `lib/form/validation.ts`.

| Étape | Condition pour passer à la suivante |
|---|---|
| 1 | `reference` non vide après trim, `typeProjet` renseigné |
| 2 | `typeCadrage` renseigné, image de cadrage chargée |
| 3 | aucune |
| 4 | aucune |
| 5 | `style` renseigné |
| 6 | aucune |
| 7 | toutes les conditions ci-dessus réunies pour autoriser l'envoi |

Aucun matériau n'est obligatoire (voir §11, arbitrage 2). Le retour en arrière n'est jamais conditionné.

### 5.7 Message conditionnel sur la photo de site

Quand le cadrage vaut `axonometrie`, l'étape 2 indique que la photo du site servira de référence d'ambiance et de matériaux seulement, aucun alignement n'étant possible avec une vue axonométrique (PRD §5 étape 2).

---

## 6. Persistance de session

Le PRD exige qu'une erreur ou un rechargement ne fasse rien reperdre.

- **Champs et choix** → `sessionStorage`, une clé unique, écriture à chaque changement d'état.
- **Images** → **IndexedDB**. Trois images redimensionnées pèsent environ 4 Mo en base64, au-dessus du plafond pratique de 5 Mo de `sessionStorage`, qui lève `QuotaExceededError` et fait perdre l'écriture entière. Un wrapper maison d'une cinquantaine de lignes suffit, sans dépendance.

Au montage, `FormulaireRendu` restaure les deux sources et reprend à `etape`. Un échec de restauration n'est jamais bloquant : on repart d'un état vierge.

---

## 7. Traitement des images

`lib/images/redimensionner.ts` : `File` → `createImageBitmap` → `canvas` → JPEG qualité 0.92 → data URI, largeur plafonnée à 2048 px, rapport d'aspect conservé, aucune montée en résolution si l'image est plus petite.

Le traitement a lieu à la sélection du fichier, pas à l'envoi. L'aperçu affiché est donc exactement l'image qui partira, et le poids final est connu et affichable immédiatement.

La sortie fal.ai étant en 2K, 2048 px de large ne retire aucune information exploitable. Cette conversion rend inutile le node `Upload Images` du workflow n8n actuel, qui faisait le même travail sur le binaire du Form Trigger.

---

## 8. Contrat du webhook n8n

Un seul endpoint, `NEXT_PUBLIC_N8N_WEBHOOK_URL`, routé par le champ `action`. Le front n'utilise que deux actions dans ce lot. Le contrat complet des six actions est écrit dans `docs/contrat-webhook-n8n.md`, livrable de ce lot, les quatre autres marquées hors périmètre.

### 8.1 `get_materiaux`

```jsonc
// requête
{ "action": "get_materiaux" }

// réponse
{
  "materiaux": {
    "toiture":     [ { "id": "uuid", "terme": "Tuiles canal terre cuite" } ],
    "facade":      [ ... ],
    "volets":      [ ... ],
    "menuiseries": [ ... ],
    "margelles":   [ ... ],
    "plage":       [ ... ]
  }
}
```

Seules les lignes `statut = 'valide'` sont retournées. `fragment_prompt` n'est jamais exposé au front : il ne sert qu'à n8n pour construire le prompt.

### 8.2 `generate`

```jsonc
// requête
{
  "action": "generate",
  "reference": "2026-042",
  "projet":  { "type": "piscine", "usage": "permis_de_construire" },
  "cadrage": { "type": "perspective" },
  "images": {
    "cadrage":        "data:image/jpeg;base64,...",
    "complementaire": null,
    "site":           "data:image/jpeg;base64,..."
  },
  "materiaux": {
    "toiture":     null,
    "facade":      null,
    "volets":      null,
    "menuiseries": null,
    "margelles":   { "id": "uuid", "terme": "Pierre reconstituée" },
    "plage":       { "id": "uuid", "terme": "Travertin" }
  },
  "materiaux_libres": [ { "categorie": "facade", "terme": "enduit chaux teinté" } ],
  "environnement": {
    "conserver_vegetation": true,
    "elements_a_retirer": "",
    "ciel": "degage"
  },
  "style": "administratif_soigne",
  "precisions": ""
}

// réponse
{ "cycle_id": "uuid", "reference": "2026-042", "image_url": "https://...", "prompt": "..." }

// erreur métier
{ "erreur": { "code": "materiau_inconnu", "message": "..." } }
```

Les catégories non applicables au type de projet sont présentes à `null` plutôt qu'absentes : la forme du payload ne dépend pas des choix de l'utilisateur, ce qui simplifie le traitement côté n8n et rend les tests de `payload.ts` déterministes.

---

## 9. Mode mock

`lib/n8n/client.ts` bascule sur `lib/n8n/mock.ts` quand `NEXT_PUBLIC_N8N_WEBHOOK_URL` est absente ou vide.

- `get_materiaux` renvoie les termes extraits du node `Construction Prompt` du workflow existant — 7 toitures, 7 façades, 6 menuiseries — complétés par des termes plausibles pour volets, margelles et plage.
- `generate` attend trois secondes et renvoie une image de test avec un `cycle_id` factice.

Le mock permet de développer et de vérifier l'intégralité du lot sans n8n. Le passage en réel se fait en posant une seule variable d'environnement, sans modification de code.

---

## 10. Envoi, attente et erreurs

Le webhook appelle fal.ai de façon synchrone : la requête reste ouverte le temps de la génération, de trente à quatre-vingt-dix secondes en 2K.

Trois issues, jamais confondues :

1. **Succès** — réponse contenant `image_url`. Le lot s'arrête là : l'image est affichée, l'écran post-génération est hors périmètre.
2. **Erreur métier** — réponse contenant `erreur`. Le message de n8n est affiché tel quel, l'état du formulaire est conservé.
3. **Échec réseau ou HTTP** — coupure, timeout de proxy, statut non-2xx. Le message indique explicitement que la génération a pu aboutir côté serveur malgré la coupure, l'état est conservé, et le bouton propose de réessayer sans ressaisie.

Le troisième cas n'est pas théorique : derrière Cloudflare en mode proxy, la coupure tombe à cent secondes et le front reçoit une 524 alors que la génération a réussi. Le point est à mesurer au premier essai réel ; s'il se confirme, la correction est côté n8n (bascule sur `queue.fal.run` avec polling interne, conformément au PRD §3.5).

Pas de timeout court côté client. Compteur d'attente visible, message explicatif au-delà de soixante secondes, garde empêchant tout second envoi tant qu'une requête est en vol.

---

## 11. Arbitrages sur les ambiguïtés du PRD

1. **Un projet Terrasse n'a aucun matériau à renseigner.** L'application littérale de la table §5 laisse l'étape 3 vide pour ce type de projet. L'étape affiche « aucun matériau à renseigner pour ce type de projet » et reste franchissable. Si une terrasse doit porter un matériau de sol, c'est une catégorie manquante dans la table `materiaux`, à traiter côté données et non côté front.
2. **Aucun matériau n'est obligatoire.** Le PRD ne l'exige nulle part, contrairement au formulaire n8n V1 où toutes les listes étaient `requiredField`. Les champs restent facultatifs et la fiche projet de l'étape 7 signale visiblement ceux qui sont vides.
3. **La photo du site reste facultative**, conformément au PRD §5 étape 2, alors que le formulaire n8n V1 l'exigeait. En son absence, le prompt d'environnement se limite au ciel neutre — comportement déjà couvert par le system prompt existant.

---

## 12. Tests

Vitest, sur la logique pure uniquement. Chaque fichier de test est posé à côté du module qu'il couvre (`lib/form/regles.test.ts` et ainsi de suite), pas dans un répertoire `__tests__` séparé.

| Fichier | Couverture |
|---|---|
| `regles.test.ts` | les cinq tables de champs matériaux, retrait du photomontage en axonométrie dans les deux sens de saisie, pré-sélection de style et son écrasement |
| `validation.test.ts` | franchissabilité de chaque étape, référence vide ou blanche, cadrage sans image |
| `payload.test.ts` | payload complet, catégories non applicables à `null`, matériaux libres présents dans `materiaux_libres` et absents de `materiaux` |
| `reducer.test.ts` | correction automatique du style, progression de `etapeMax`, retour arrière sans perte |
| `persistance.test.ts` | aller-retour sessionStorage et IndexedDB, restauration après échec partiel |
| `redimensionner.test.ts` | plafond 2048 px, rapport d'aspect conservé, pas de montée en résolution |

Ces tests couvrent directement les critères d'acceptation « Formulaire » du PRD §9.

---

## 13. Livrables

- Le formulaire complet, sept étapes, règles conditionnelles, persistance de session
- La suite de tests Vitest et sa configuration
- `docs/contrat-webhook-n8n.md` — contrat des six actions, quatre marquées hors lot
- `.env.example` — `NEXT_PUBLIC_N8N_WEBHOOK_URL`, absente par défaut pour activer le mock

---

## 14. Dépendances externes et suites

Hors périmètre de ce lot, mais nécessaires avant un premier essai réel :

- Webhook n8n exposant `get_materiaux` et `generate` selon le contrat du §8, avec un node *Respond to Webhook* — le workflow actuel se termine par un envoi d'email et ne renvoie rien.
- Table `materiaux` alimentée. Les dictionnaires `toitureDesc`, `facadeDesc` et `menuiseriesDesc` du node `Construction Prompt` fournissent vingt entrées avec leurs `fragment_prompt` déjà calibrés. Les catégories volets, margelles et plage n'existent nulle part et sont entièrement à rédiger.
- Blocs de style : le workflow en contient trois, le PRD en exige cinq. Manquent `administratif_simple` et `administratif_soigne`.
- **Rotation de la clé fal.ai**, exposée en clair dans les deux nodes HTTP Request du workflow exporté. La nouvelle clé doit vivre dans une credential, jamais dans le champ `value` d'un node, faute de quoi elle repart dans chaque export.
- Vérifier si le n8n est derrière Cloudflare en mode proxy — détermine si la coupure à cent secondes s'applique.
