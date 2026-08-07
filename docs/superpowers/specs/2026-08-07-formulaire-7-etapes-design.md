# Design — Formulaire 7 étapes

Date : 2026-08-07
Statut : validé, à planifier
Sources : `docs/prd-generateur-rendu-v2.md` (PRD V2), documentation RIF (voir §16), workflow n8n `rendu-formulaire-n8n-v1`

---

## 1. Objet du lot

Construire le formulaire progressif en 7 étapes décrit au §5 du PRD, jusqu'à l'envoi de l'action `generate` au webhook n8n et l'affichage d'un état d'attente.

Le lot s'arrête à la réception de la réponse. L'écran post-génération, le mode annotation, les actions `correct` / `regenerate` / `validate`, la protection par mot de passe, Supabase et Google Drive sont hors lot.

### 1.1 État de l'existant

Le dépôt contient le scaffold Next.js par défaut : `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, aucune dépendance au-delà de Next 16 / React 19 / Tailwind 4, aucun test, pas de `.env.example`.

Côté n8n, le workflow `rendu-formulaire-n8n-v1` existe et fonctionne, mais avec une architecture V1 : déclencheur Form Trigger natif, matériaux codés en dur dans un node Code, sortie par email, aucune persistance. Il n'expose aucun webhook routé par `action`. Le front est donc développé contre un adaptateur mocké, et ce document fige le contrat que le webhook devra respecter.

### 1.2 Rapport au PRD et au RIF

Le PRD reste la spécification du produit. La documentation RIF cadre le concept et apporte des règles éprouvées ; elle ne fait pas loi. Sur trois points elle comble une lacune du PRD et ce document la suit :

| Point | PRD | RIF | Retenu |
|---|---|---|---|
| Styles de rendu | cinq | trois (LIB-005 V1.2) | trois |
| Mode de production | absent | structurant, précède le style (ARCH-001 §6, LIB-006) | déduit automatiquement |
| Matériau existant conservé | absent | LIB-001 §2, ENG-004 ④ | option dédiée |

La documentation RIF est également muette sur des points que le PRD tranche — les six catégories de matériaux, la référence de dossier, la persistance.

**Principe d'arbitrage.** Le framework est retenu quand il apporte une règle de cohérence ou un savoir de terrain : ce qui empêche de produire un rendu faux, ou ce qui traduit un comportement observé du moteur. Il est écarté quand il restreint un choix de création. Le formulaire n'interdit ni ne corrige une intention esthétique de l'utilisateur, et ne commente pas ses choix d'ambiance. Les préférences documentées dans le framework — notamment les interdictions de `LIB-005 §5` sur les styles administratifs — restent consignées ici à titre d'information, sans traduction en comportement.

Aucune terminologie interne du RIF n'apparaît dans l'interface : ni le sigle, ni les identifiants de modules, ni les codes ADR ou TEST (PRD §9). Le mode de production n'est jamais affiché.

---

## 2. Décisions

| Sujet | Décision |
|---|---|
| Architecture | État central `useReducer` + logique métier extraite en modules purs |
| Dépendances ajoutées | Vitest uniquement (dev) — aucune dépendance de production |
| Transport des images | JSON, data URI base64, redimensionnées à 2048 px côté front |
| Référence de dossier | Champ texte obligatoire saisi à l'étape 1 |
| Styles | Les trois styles actifs du RIF |
| Mode de production | Déduit des réponses, jamais affiché, transmis à n8n |
| Tests | Vitest sur la logique pure, pas de test de composant ni de parcours |
| Interface | Sobre et fonctionnelle, Tailwind, une colonne centrée |
| Nommage | Vocabulaire métier en français dans le code |
| Développement sans n8n | Adaptateur mocké activé par absence de variable d'environnement |

### 2.1 Nommage

Le domaine est français et le restera : `materiaux`, `cadrage`, `margelles`, `plage`, `volets`. Traduire ce vocabulaire créerait un décalage permanent entre le code, le PRD, la documentation RIF et la table Supabase. Les identifiants du domaine sont donc en français ; les API React et les conventions du framework restent en anglais.

Le vocabulaire architectural suit `01B_VOCABULAIRE_ARCHITECTURAL.md` : margelle, plage de piscine, volet, pool house.

---

## 3. Structure des fichiers

Une seule route. La navigation entre étapes est un état, pas une URL : le formulaire est un flux linéaire dont aucune étape n'a de sens en entrée directe, et une URL par étape rendrait la restauration d'état plus fragile qu'elle ne l'est déjà.

```
app/page.tsx                              monte <FormulaireRendu />

lib/form/types.ts                         types de l'état et du domaine
lib/form/etat-initial.ts
lib/form/reducer.ts                       transitions pures
lib/form/regles.ts                        logique conditionnelle
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
  elementsAPreserver: string

  materiaux: Record<Categorie, SelectionMateriau | null>

  conserverVegetation: boolean    // vrai par défaut
  aspectPelouse: AspectPelouse
  elementsARetirer: string
  ciel: Ciel
  eclairages: Eclairages          // sans objet hors fin de journée et crépuscule

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
  | { origine: 'existant' }

type TypeProjet   = 'piscine' | 'extension' | 'restructuration' | 'terrasse' | 'pool_house'
type Usage        = 'permis_de_construire' | 'presentation_client' | 'les_deux'
type TypeCadrage  = 'perspective' | 'axonometrie'
type Ciel         = 'reprendre_photo' | 'degage' | 'legerement_voile' | 'neutre_diffus'
                  | 'fin_de_journee' | 'crepuscule'
type AspectPelouse = 'telle_quelle' | 'tondue_soignee' | 'fleurie'
type Eclairages   = {
  margelles: boolean
  sousMarin: boolean
  appliquesFacade: boolean
  interieurVisible: boolean
}
type Categorie    = 'toiture' | 'facade' | 'volets' | 'menuiseries' | 'margelles' | 'plage'
type Style        = 'photomontage_administratif' | 'presentation_client' | 'commercial'
type ModeProduction = 'photomontage_controle' | 'presentation_generative' | 'retexturation_revit'
```

`ModeProduction` n'est pas un champ de l'état : c'est une valeur dérivée, recalculée à la demande par `regles.ts`. La stocker créerait une seconde source de vérité à synchroniser.

Deux champs existent uniquement pour satisfaire une règle :

- `etapeMax` : le PRD exige que les étapes déjà atteintes restent accessibles en arrière. Sans mémoire de la progression, l'indicateur d'étapes ne peut pas distinguer une étape franchie d'une étape à venir.
- `styleChoisiManuellement` : la pré-sélection automatique du style doit être écrasée dès que l'utilisateur choisit à la main. La règle est inexprimable sans mémoriser l'origine de la valeur courante.

---

## 5. Règles métier

Toutes dans `lib/form/regles.ts`, toutes pures.

### 5.1 Mode de production déduit

`modeProduction(etat): ModeProduction`, transcription de la matrice `LIB-006 §5` :

| Photo du site | Cadrage | Mode |
|---|---|---|
| fournie | perspective | `photomontage_controle` |
| fournie | axonometrie | `presentation_generative` |
| absente | quel qu'il soit | `retexturation_revit` |

Le mode n'est jamais affiché ni proposé au choix. Il commande deux choses, et rien d'autre : les styles disponibles à l'étape 5, et la clause que n8n ajoutera au prompt (`ENG-002 §3`). Il n'a aucun effet sur l'étape 4 (voir §5.8).

Justification du deuxième cas : un photomontage exige une correspondance de point de vue entre la photographie et la vue géométrique, impossible avec une axonométrie. La photo reste utile comme référence d'ambiance et de matériaux, ce qui correspond exactement à la présentation générative.

### 5.2 Styles disponibles

`stylesDisponibles(mode): Style[]`, transcription de `LIB-006` section « Styles compatibles » :

| Mode | Styles proposables |
|---|---|
| `photomontage_controle` | photomontage administratif, présentation client, commercial |
| `presentation_generative` | présentation client, commercial |
| `retexturation_revit` | présentation client, commercial |

En pratique : **le style photomontage administratif exige une photo du site et un cadrage en perspective.**

Les deux exclusions ont des fondements distincts, et les deux sources convergent :

- En retexturation Revit, `ADR-013` exclut structurellement le style : son objet est l'intégration à une photographie réelle, absente de ce mode par construction.
- En présentation générative, le PRD §5 étape 5 l'exclut parce qu'aucun alignement de point de vue n'est possible avec une axonométrie — revendiquer un photomontage y serait faux. `LIB-006` ne l'exclut pas formellement dans ce mode mais le qualifie de rare et mal accordé à sa liberté visuelle. Le PRD étant le plus restrictif des deux et son critère d'acceptation §9 étant explicite, c'est lui qui s'applique.

### 5.3 Correction automatique du style

Traitée dans le reducer, sur toute action modifiant la photo du site ou le type de cadrage : si le style courant ne figure plus dans `stylesDisponibles(mode)`, il bascule sur le résultat de `stylePreselectionne`. La règle s'applique quel que soit l'ordre des saisies, y compris après un retour en arrière et y compris si le style avait été choisi manuellement.

Ce basculement est signalé visiblement à l'étape 5 : un style change sous les yeux de l'utilisateur seulement s'il comprend pourquoi.

### 5.4 Pré-sélection du style

`stylePreselectionne(mode, usage): Style`, transcription de la section « Sélection automatique » de `LIB-005` :

| Mode | Usage | Style |
|---|---|---|
| `photomontage_controle` | `permis_de_construire` | photomontage administratif |
| `photomontage_controle` | `les_deux` | photomontage administratif |
| `photomontage_controle` | `presentation_client` | présentation client |
| autres modes | quel qu'il soit | présentation client |

`commercial` n'est jamais pré-sélectionné : `LIB-005 §3` le réserve à une demande explicite et l'exclut de la sélection automatique en toute circonstance.

Le cas `les_deux` suit `LIB-006 §6` : quand plusieurs usages coexistent, le plus exigeant en fidélité prévaut.

La pré-sélection se recalcule à chaque changement de mode ou d'usage tant que `styleChoisiManuellement` est faux. Tout choix de style par l'utilisateur pose ce drapeau à vrai, définitivement pour la session.

### 5.5 Champs matériaux affichés

`champsMateriauxPour(typeProjet): Categorie[]`, transcription de la table du PRD §5 étape 3 :

| Type de projet | Catégories affichées |
|---|---|
| Piscine | margelles, plage |
| Extension | toiture, facade, volets, menuiseries |
| Restructuration | toiture, facade, volets, menuiseries |
| Terrasse | aucune |
| Pool house | toiture, facade, volets, menuiseries, margelles, plage |

Margelles et plage restent deux champs distincts, jamais fusionnés — ce sont deux ouvrages différents (`01B` §6).

### 5.6 Option « conserver l'existant »

`conservationExistantProposee(typeProjet, images): boolean` — vraie pour `extension` et `restructuration` lorsqu'une photo du site est fournie.

Quand elle est vraie, chaque champ matériau affiché propose en tête une option « conserver l'existant visible sur la photo », produisant une `SelectionMateriau` d'origine `existant`.

Fondement : `LIB-001 §2`. Lorsque la photographie montre un bâtiment existant, son aspect matériel réel fait référence pour tout élément visible à la fois sur la photo et sur la vue géométrique. Le matériau n'est alors ni deviné ni choisi dans un catalogue : il est repris tel qu'il apparaît. Sans cette option, le formulaire force un choix de catalogue sur une façade que l'utilisateur veut précisément laisser intacte, et le prompt reçoit une instruction qui contredit la photo.

### 5.7 Matériau en saisie libre

Chaque champ matériau propose, en plus des termes du catalogue, une entrée « Autre texture ». La sélectionner révèle un champ texte. La valeur produit une `SelectionMateriau` d'origine `libre`, affichée avec une mention visible « non calibré ».

Une valeur libre :

- est envoyée dans `materiaux_libres`, jamais dans `materiaux` ;
- est récapitulée à l'étape 6 et à l'étape 7 ;
- n'apparaît jamais dans une liste déroulante.

La séparation des deux tableaux dans le payload est le mécanisme qui garantit le critère « une saisie libre n'entre jamais dans un prompt » : n8n construit le prompt à partir de `materiaux` seul, et crée les lignes `statut = 'a_calibrer'` à partir de `materiaux_libres` seul.

### 5.8 Environnement — toujours paramétrable

**Tous les champs de l'étape 4 sont affichés en permanence, quel que soit le mode de production.** Le mode n'a aucun effet sur cette étape.

`REF-001 §9` et `ENG-004 ⑥` font de la lumière de la photographie la référence quand celle-ci est le canevas, et `ENG-004 ⑤` retire la question de l'environnement en l'absence de photo. Ces règles décrivent des valeurs par défaut raisonnables, pas des interdictions : `REF-001 §3` prévoit explicitement que les informations validées par l'utilisateur complètent les sources. Une demande d'ambiance de fin de journée ou de pelouse fleurie est une intention de création, et le formulaire ne la refuse pas.

Ces règles se traduisent donc en pré-sélections, jamais en masquages.

#### Ciel et lumière

| Valeur | Note |
|---|---|
| Reprendre la lumière de la photo | pré-sélectionnée quand une photo du site est fournie |
| Dégagé | |
| Légèrement voilé | |
| Neutre diffus | pré-sélectionnée en l'absence de photo (`REF-001 §9`) |
| Fin de journée, lumière chaude | |
| Crépuscule | |

`cielProposeParDefaut(images): Ciel` porte la pré-sélection. Elle est écrasée dès que l'utilisateur choisit une valeur, selon le même mécanisme que le style (§5.4).

#### Éclairages

Une question complémentaire apparaît lorsque le ciel vaut `fin_de_journee` ou `crepuscule`, et seulement dans ce cas : quels éclairages activer, parmi margelles, éclairage sous-marin de la piscine, appliques de façade, intérieur visible par les baies. Quatre interrupteurs, tous à faux par défaut.

Fondement : `ENG-004 §4.3`. Sans cette question, une ambiance crépusculaire produit une maison éteinte, ce qui est rarement l'effet recherché. Les valeurs de piscine — margelles et sous-marin — ne sont proposées que pour les types de projet comportant un bassin, soit Piscine et Pool house.

#### Végétation

| Champ | Valeurs |
|---|---|
| Conserver la végétation existante | interrupteur, vrai par défaut |
| Aspect de la pelouse | telle quelle · tondue et soignée · fleurie, type prairie avec marguerites |
| Éléments à retirer | texte court |

L'interrupteur de conservation reste affiché même sans photo du site. Il est alors sans effet pratique, mais le masquer obligerait l'utilisateur à comprendre une règle implicite pour retrouver un champ disparu.

Note de calibration, sans effet sur le front : le PRD §6.1 impose que toute mention de variation naturelle de couleur pour la végétation soit bornée, faute de quoi le résultat prend un aspect irrégulier et maladif. Les trois fragments d'aspect de pelouse sont à rédiger côté n8n en tenant compte de cette contrainte.

### 5.9 Éléments à préserver

Champ texte libre à l'étape 2, sous les images, invitant à nommer un par un les éléments secondaires à ne pas perdre : garde-corps, murets, escaliers, panneaux, différences de matériau sur un même ouvrage.

Fondement : `ENG-001 §4.2`. Un élément secondaire non nommé individuellement risque de ne pas être reconstruit fidèlement, même sous une consigne générale de préservation de la géométrie — le moteur tient les grandes masses et improvise sur les détails ambigus qui ne lui ont pas été signalés un par un. Une consigne générique de type « respecter tous les éléments » ne produit pas cet effet.

Le champ est facultatif et alimente une section dédiée du prompt, distincte des précisions générales de l'étape 6.

### 5.10 Franchissabilité des étapes

`etapeFranchissable(etat, etape): boolean` dans `lib/form/validation.ts`.

| Étape | Condition pour passer à la suivante |
|---|---|
| 1 | `reference` non vide après trim, `typeProjet` renseigné |
| 2 | `typeCadrage` renseigné, image de cadrage chargée |
| 3 | aucune |
| 4 | aucune |
| 5 | `style` renseigné et présent dans `stylesDisponibles(mode)` |
| 6 | aucune |
| 7 | toutes les conditions ci-dessus réunies pour autoriser l'envoi |

Aucun matériau n'est obligatoire (voir §12, arbitrage 2). Le retour en arrière n'est jamais conditionné.

### 5.11 Message conditionnel sur la photo de site

Quand le cadrage vaut `axonometrie` et qu'une photo est fournie, l'étape 2 indique que la photo servira de référence d'ambiance et de matériaux seulement, aucun alignement n'étant possible avec une vue axonométrique (PRD §5 étape 2).

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
  "projet":  { "type": "extension", "usage": "permis_de_construire" },
  "cadrage": { "type": "perspective" },
  "mode_production": "photomontage_controle",
  "images": {
    "cadrage":        "data:image/jpeg;base64,...",
    "complementaire": null,
    "site":           "data:image/jpeg;base64,..."
  },
  "elements_a_preserver": "garde-corps métallique du balcon nord, muret en pierre le long de l'accès",
  "materiaux": {
    "toiture":     { "origine": "catalogue", "id": "uuid", "terme": "Tuiles canal terre cuite" },
    "facade":      { "origine": "existant" },
    "volets":      null,
    "menuiseries": { "origine": "catalogue", "id": "uuid", "terme": "Aluminium gris anthracite" },
    "margelles":   null,
    "plage":       null
  },
  "materiaux_libres": [ { "categorie": "volets", "terme": "bois peint vert olive" } ],
  "environnement": {
    "conserver_vegetation": true,
    "aspect_pelouse": "tondue_soignee",
    "elements_a_retirer": "",
    "ciel": "fin_de_journee",
    "eclairages": {
      "margelles": true,
      "sous_marin": true,
      "appliques_facade": false,
      "interieur_visible": true
    }
  },
  "style": "photomontage_administratif",
  "precisions": ""
}

// réponse
{ "cycle_id": "uuid", "reference": "2026-042", "image_url": "https://...", "prompt": "..." }

// erreur métier
{ "erreur": { "code": "materiau_inconnu", "message": "..." } }
```

Trois conventions de forme, choisies pour que le traitement côté n8n soit déterministe :

- Les catégories non applicables au type de projet sont présentes à `null` plutôt qu'absentes. La forme du payload ne dépend jamais des choix de l'utilisateur.
- `materiaux` porte toujours un discriminant `origine`. La valeur `existant` signifie « reprendre le matériau tel qu'il apparaît sur la photo, ne pas l'interpréter » : n8n n'ajoute alors aucun `fragment_prompt` pour cette catégorie, mais une instruction de conservation.
- `eclairages` vaut `null` dès que le ciel n'est ni `fin_de_journee` ni `crepuscule` : la question n'a alors pas été posée, et un objet de quatre `false` serait indiscernable d'un choix explicite de tout éteindre. Un `ciel` à `reprendre_photo` indique à n8n de suivre la lumière de la photographie.

`mode_production` détermine la clause que n8n ajoute au prompt (`ENG-002 §3`). Le front le calcule parce qu'il détient déjà toutes les données de la matrice ; le recalculer côté n8n créerait deux implémentations de la même règle, avec le risque qu'elles divergent.

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

## 11. Parcours résultant

Récapitulatif des sept étapes après application des règles ci-dessus.

| Étape | Contenu |
|---|---|
| 1 — Identification | Référence de dossier, type de projet, usage du rendu |
| 2 — Documents | Type de cadrage, vue de cadrage, vue complémentaire, photo du site, éléments à préserver |
| 3 — Matériaux | Catégories selon le type de projet, option « conserver l'existant » en extension et restructuration, saisie libre partout |
| 4 — Environnement | Conservation de la végétation, aspect de la pelouse, éléments à retirer, ciel et lumière, éclairages si l'ambiance est crépusculaire |
| 5 — Style | Deux ou trois styles selon le mode déduit, un pré-sélectionné |
| 6 — Précisions | Texte libre, récapitulatif des matériaux non calibrés |
| 7 — Fiche projet | Synthèse de tous les choix, accès direct à chaque étape, lancement |

---

## 12. Arbitrages sur les ambiguïtés du PRD

1. **Un projet Terrasse n'a aucun matériau à renseigner.** L'application littérale de la table §5 laisse l'étape 3 vide pour ce type de projet. L'étape affiche « aucun matériau à renseigner pour ce type de projet » et reste franchissable. Si une terrasse doit porter un matériau de sol, c'est une catégorie manquante dans la table `materiaux`, à traiter côté données et non côté front.
2. **Aucun matériau n'est obligatoire.** Le PRD ne l'exige nulle part, contrairement au formulaire n8n V1 où toutes les listes étaient `requiredField`. Les champs restent facultatifs et la fiche projet de l'étape 7 signale visiblement ceux qui sont vides.
3. **La photo du site reste facultative**, conformément au PRD §5 étape 2, alors que le formulaire n8n V1 l'exigeait. Son absence bascule le mode en retexturation Revit et retire le style photomontage administratif, ce qui rend la conséquence visible à l'utilisateur sans le bloquer.
4. **Les éléments secondaires — personnages, véhicules, mobilier — n'ont pas de champ dédié.** `REF-001 §10` les interdit par défaut sauf demande explicite, et le prompt système porte déjà cette interdiction. Une demande explicite passe par les précisions libres de l'étape 6. Ajouter un champ dédié pour une réponse qui est « non » dans l'immense majorité des cas n'est pas justifié.
5. **La compatibilité des caméras n'est pas évaluée par le formulaire.** `REF-001 §5` et `LIB-004 §5` en font un préalable à toute production administrative, mais c'est un jugement visuel qui relève du contrôle après génération, hors lot. À reprendre lors de la conception de l'écran post-génération.
6. **Aucun avertissement de cohérence entre l'ambiance et le style.** `LIB-005 §5` proscrit les couchers de soleil et les scènes nocturnes pour les styles administratifs, et réserve le crépuscule au style Commercial. Le formulaire ne le signale pas, ne bascule pas le style et ne bloque pas l'envoi : ces règles relèvent de la préférence esthétique, pas de la cohérence technique, et le choix appartient à l'utilisateur. Voir le principe d'arbitrage du §1.2.

---

## 13. Tests

Vitest, sur la logique pure uniquement. Chaque fichier de test est posé à côté du module qu'il couvre (`lib/form/regles.test.ts` et ainsi de suite), pas dans un répertoire `__tests__` séparé.

| Fichier | Couverture |
|---|---|
| `regles.test.ts` | les trois cas de la matrice de mode, les styles disponibles par mode, la pré-sélection de style pour chaque couple mode × usage, les cinq tables de champs matériaux, la condition d'affichage de l'option « conserver l'existant », la pré-sélection du ciel selon la présence d'une photo, l'apparition des éclairages sur les deux seules valeurs de ciel concernées, le retrait des éclairages de piscine hors projets à bassin |
| `validation.test.ts` | franchissabilité de chaque étape, référence vide ou blanche, cadrage sans image, style devenu indisponible |
| `payload.test.ts` | payload complet, catégories non applicables à `null`, discriminant `origine` sur chaque sélection, `eclairages` à `null` hors ambiance crépusculaire, matériaux libres présents dans `materiaux_libres` et absents de `materiaux` |
| `reducer.test.ts` | correction automatique du style au retrait de la photo et au passage en axonométrie, progression de `etapeMax`, retour arrière sans perte |
| `persistance.test.ts` | aller-retour sessionStorage et IndexedDB, restauration après échec partiel |
| `redimensionner.test.ts` | plafond 2048 px, rapport d'aspect conservé, pas de montée en résolution |

Ces tests couvrent les critères d'acceptation « Formulaire » du PRD §9 ainsi que les règles RIF transcrites au §5.

---

## 14. Livrables

- Le formulaire complet, sept étapes, règles conditionnelles, persistance de session
- La suite de tests Vitest et sa configuration
- `docs/contrat-webhook-n8n.md` — contrat des six actions, quatre marquées hors lot
- `.env.example` — `NEXT_PUBLIC_N8N_WEBHOOK_URL`, absente par défaut pour activer le mock

---

## 15. Dépendances externes et suites

Hors périmètre de ce lot, mais nécessaires avant un premier essai réel :

- Webhook n8n exposant `get_materiaux` et `generate` selon le contrat du §8, avec un node *Respond to Webhook* — le workflow actuel se termine par un envoi d'email et ne renvoie rien.
- Table `materiaux` alimentée. Les dictionnaires `toitureDesc`, `facadeDesc` et `menuiseriesDesc` du node `Construction Prompt` fournissent vingt entrées avec leurs `fragment_prompt` déjà calibrés. Les catégories volets, margelles et plage n'existent nulle part et sont entièrement à rédiger.
- Traitement de l'origine `existant` côté n8n : n'ajouter aucun fragment de matériau pour la catégorie concernée, mais une instruction de conservation de l'aspect visible sur la photographie.
- Fragments de prompt à rédiger pour les nouvelles valeurs d'environnement : six ambiances de ciel, trois aspects de pelouse, quatre éclairages. Le workflow actuel ne couvre aucune de ces valeurs. Les trois fragments de pelouse doivent respecter la contrainte du PRD §6.1 sur la variation de couleur bornée.
- Clause de mode dans le prompt selon `ENG-002 §3`, choisie d'après `mode_production` reçu du front.
- **Rotation de la clé fal.ai**, exposée en clair dans les deux nodes HTTP Request du workflow exporté. La nouvelle clé doit vivre dans une credential, jamais dans le champ `value` d'un node, faute de quoi elle repart dans chaque export.
- Vérifier si le n8n est derrière Cloudflare en mode proxy — détermine si la coupure à cent secondes s'applique.
- Nettoyage du workflow : il contient deux branches jumelles complètes, dupliquées à l'identique.

Signalé sans action requise dans ce lot : le prompt système actuel du workflow emploie abondamment les termes « 3D » et « render », que `LIB-001 §8A` proscrit dans tout texte transmis au moteur au motif qu'ils orientent la génération vers une esthétique de synthèse, y compris en formulation négative. À arbitrer côté n8n, le prompt donnant par ailleurs des résultats jugés satisfaisants.

---

## 16. Sources RIF utilisées

| Module | Apport à ce document |
|---|---|
| `ARCH-001` §6 | Séparation mode de production / style, ordre de sélection |
| `REF-001` §3 | Les informations validées par l'utilisateur complètent les sources |
| `REF-001` §9 | Lumière de la photographie et lumière neutre à défaut — retenues comme pré-sélections |
| `REF-001` §10 | Éléments secondaires interdits par défaut |
| `REF-003` | Vocabulaire architectural : margelle, plage, volet, pool house |
| `ENG-001` §4.2 | Nécessité de nommer individuellement les éléments à préserver |
| `ENG-002` §3 | Clauses de prompt par mode, consommées côté n8n |
| `ENG-004` ⑤⑥ | Valeurs par défaut de l'environnement et de la lumière selon la présence d'une photo |
| `ENG-004` §4.3 | Question complémentaire sur les éclairages en ambiance de fin de journée ou de crépuscule |
| `LIB-001` §2 | Matériau existant repris tel quel, jamais interprété |
| `LIB-001` §8A | Règles de rédaction du texte transmis au moteur (côté n8n) |
| `LIB-005` | Les trois styles actifs, leurs usages, la sélection automatique |
| `LIB-006` | Matrice de déduction du mode, styles compatibles par mode |
| `LIB-002`, `LIB-004` | Contrôle et décisions — pour l'écran post-génération, hors lot |
