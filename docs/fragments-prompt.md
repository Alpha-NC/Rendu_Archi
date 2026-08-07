# Fragments de prompt à calibrer

Contenu textuel des valeurs introduites par le formulaire et absentes du workflow V1.
Destiné à être collé dans `materiaux.fragment_prompt` (Supabase) pour les matériaux,
et dans un node Set de n8n pour l'environnement.

---

## 1. Règles de rédaction appliquées

Ces fragments suivent les contraintes déjà établies par le projet. Les rappeler évite
qu'une réécriture ultérieure les perde.

- **Aucune occurrence des mots « 3D » ni « rendu »** dans le texte transmis au moteur.
  Ces termes orientent la génération vers une esthétique de synthèse, y compris
  lorsqu'ils apparaissent dans une tournure négative.
- **Formulation positive.** On décrit l'imperfection photographique recherchée plutôt
  que d'énumérer ce qu'il faut éviter : les instructions négatives ne sont pas
  traitées de façon fiable.
- **Aucun vocabulaire de vieillissement, patine ou usure sur les surfaces peintes**
  — volets, menuiseries, enduits. Ces termes provoquent une dégradation excessive
  quel que soit le qualificatif employé. Ils restent acceptables pour la pierre, où
  ils décrivent une réalité matérielle.
- **Variation de couleur de la végétation systématiquement bornée.** Sans borne, le
  résultat prend un aspect irrégulier et maladif.
- **Marqueurs photographiques positifs** : grain naturel, relief perceptible en
  lumière rasante, variations de teinte d'un élément à l'autre, ombres de contact.

Les fragments de matériaux reprennent la convention des dictionnaires existants :
groupe nominal en minuscule, segments séparés par des virgules, sans point final.
Ils sont concaténés sous un intitulé de section. Les fragments d'environnement sont
rédigés en phrases complètes, ils constituent leur propre section.

---

## 2. Assemblage et précédence — à traiter avant de coller les fragments

Le point le plus délicat n'est pas le contenu des fragments, c'est leur cohabitation.

**Le fragment de ciel et le bloc de style parlent tous deux de lumière.** Le style
`photomontage_administratif` impose une lumière neutre reprise de la photographie ;
le fragment `crepuscule` impose une heure bleue. Les deux dans le même appel
produisent des ambiances incohérentes d'une génération à l'autre — c'est le défaut
documenté qui a motivé la règle « un seul bloc de style par appel ».

**Règle d'assemblage recommandée**, à implémenter dans le node de construction du prompt :

| `ciel` reçu | Traitement |
|---|---|
| `reprendre_photo` | Insérer le fragment de ciel. Retirer du bloc de style son paragraphe consacré à la lumière — le fragment fait autorité. |
| toute autre valeur | Insérer le fragment de ciel **à la place** du paragraphe lumière du bloc de style. Le reste du bloc de style — matériaux, profondeur, finition — est conservé tel quel. |

Autrement dit : le bloc de style garde la main sur la matière et la présentation, le
fragment de ciel garde la main sur la lumière. Jamais les deux sur le même sujet.

**Les éclairages** ne sont envoyés par le front que si `ciel` vaut `fin_de_journee`
ou `crepuscule` ; sinon le champ vaut `null` et aucun fragment n'est inséré. Un objet
de quatre `false` signifie « l'utilisateur a explicitement tout laissé éteint » et se
traite comme l'absence de fragment.

---

## 3. Ciel et lumière

Six valeurs. Section du prompt : **LUMIÈRE ET AMBIANCE**.

### `reprendre_photo`

> La lumière, la direction du soleil, la douceur des ombres et la température de couleur sont reprises exactement de la photographie du site. Les ombres portées des éléments projetés tombent dans la même direction, avec la même longueur et la même densité que celles déjà visibles sur la photographie. Le ciel est celui de la photographie, avec sa texture nuageuse et sa profondeur atmosphérique propres. L'image entière doit paraître capturée en une seule prise de vue : même grain, même contraste, même dominante colorée du premier plan jusqu'à l'horizon.

### `degage`

> Ciel bleu franc et dégagé, plus soutenu au zénith et s'éclaircissant progressivement vers l'horizon, avec une profondeur atmosphérique perceptible. Soleil haut, lumière directe : ombres portées nettes, aux bords légèrement adoucis à mesure qu'elles s'éloignent de l'objet qui les projette, densité soutenue conservant du détail dans les zones sombres. Les surfaces claires gardent leur texture et leur gradation tonale sur toute leur étendue. Température de couleur neutre de plein jour.

### `legerement_voile`

> Ciel couvert d'un voile de nuages hauts et fins, laissant deviner la position du soleil sans disque nettement dessiné. Lumière directionnelle mais adoucie : les ombres portées restent lisibles, avec des bords diffus et une densité modérée. Contraste doux, gradation fine sur les surfaces courbes et sur le grain des enduits. Température de couleur neutre, très légèrement froide.

### `neutre_diffus`

> Lumière naturelle neutre et diffuse de ciel uniformément couvert. Aucune direction dominante : les ombres sont courtes et très douces, essentiellement des ombres de contact au pied des volumes, sous les débords de toiture et dans les feuillures des ouvertures. Ciel clair et uniformément lumineux, conservant une légère texture nuageuse. Contraste faible mais tonalité pleine, chaque matériau restant lisible dans son relief et sa texture propre.

### `fin_de_journee`

> Fin d'après-midi, soleil bas sur l'horizon. Lumière rasante et chaude, ambrée sans excès, qui révèle le relief des enduits, des tuiles et des pierres et allonge les ombres portées dans une direction unique et cohérente. Les façades exposées reçoivent une lumière dorée ; les façades opposées basculent dans une ombre légèrement bleutée, éclairée par la seule lumière du ciel. Ciel en dégradé, du bleu profond au zénith vers des tons chauds près de l'horizon, avec une texture nuageuse réelle. Contraste marqué, conservant du détail dans les hautes lumières comme dans les ombres.

### `crepuscule`

> Crépuscule, peu après le coucher du soleil. Le ciel conserve une luminosité résiduelle et se dégrade du bleu profond au zénith vers des tons orangés puis violacés près de l'horizon, avec une texture nuageuse réelle. Plus aucune lumière solaire directe : l'éclairage extérieur provient uniquement de la voûte céleste, doux et enveloppant, et des sources artificielles allumées. Les façades prennent une tonalité bleutée froide qui contraste avec la chaleur des éclairages. Équilibre d'exposition d'une photographie d'architecture à l'heure bleue : le ciel reste lisible, les zones éclairées ne sont pas brûlées, les zones sombres conservent leur détail.

---

## 4. Éclairages

Quatre valeurs booléennes, insérées uniquement en ambiance de fin de journée ou de
crépuscule. Section du prompt : **ÉCLAIRAGES ALLUMÉS**, à placer immédiatement après
la section lumière.

### `margelles`

> Éclairage linéaire encastré en périphérie du bassin, sous le nez des margelles : lumière chaude et rasante qui souligne le tracé de la piscine et révèle la texture de la pierre en lumière frisante. Intensité discrète, sans halo débordant ni source visible.

### `sous_marin`

> Projecteurs immergés dans le bassin, lumière blanche légèrement froide diffusée dans la masse d'eau. L'eau devient translucide et lumineuse de l'intérieur, laissant voir le fond et les parois du bassin. Reflets ondulants portés sur les margelles et sur les surfaces claires les plus proches.

### `appliques_facade`

> Appliques murales allumées en façade, lumière chaude dirigée vers le haut et vers le bas, dessinant des cônes lumineux doux sur l'enduit et révélant son grain en lumière rasante. Halos contenus, dégradé progressif jusqu'à l'ombre, sans surexposition autour des sources.

### `interieur_visible`

> Éclairage intérieur allumé, visible à travers les baies et les fenêtres : lumière chaude, plus dense que l'ambiance extérieure, laissant deviner la profondeur des pièces sans en détailler le contenu. Les vitrages passent d'un aspect sombre et réfléchissant à une transparence lumineuse.

---

## 5. Aspect de la pelouse

Trois valeurs. Section du prompt : **ENVIRONNEMENT**, en complément du bloc de
conservation de la végétation existante.

### `telle_quelle`

> La pelouse et la végétation basse sont reprises fidèlement de la photographie du site : même hauteur d'herbe, même densité, mêmes nuances d'une zone à l'autre, y compris les irrégularités présentes.

### `tondue_soignee`

> Pelouse récemment tondue et régulièrement entretenue. Les brins d'herbe sont individuellement visibles, dressés avec une orientation naturellement variée, de hauteur régulière, avec de petites ombres douces entre eux à courte distance. Vert sain et homogène, dont les variations de ton d'une zone à l'autre restent légères et contenues. Couverture continue et dense jusqu'aux bordures.

### `fleurie`

> Pelouse d'agrément légèrement fleurie, dans le registre de la prairie entretenue. Les brins d'herbe restent individuellement visibles, de hauteur régulière, dans un vert sain dont les variations de ton restent contenues. Quelques marguerites et petites fleurs blanches et jaunes émergent au-dessus de l'herbe, dispersées en petits groupes irréguliers plutôt qu'en semis uniforme. L'ensemble reste manifestement entretenu.

---

## 6. Matériaux — volets

Table `materiaux`, catégorie `volets`. Surfaces peintes : aucun vocabulaire de
vieillissement.

| `terme` | `fragment_prompt` |
|---|---|
| Volets battants bois peint | volets battants en bois peint à lames verticales assemblées, peinture opaque à finition satinée laissant transparaître le fil du bois sous la couche, pentures et ferrures visibles, gonds scellés en tableau |
| Volets roulants aluminium blanc | volets roulants en aluminium laqué blanc, lames horizontales fines et régulières, jeu constant entre les lames, coffre intégré discret en linteau, surface mate et propre |
| Volets roulants aluminium anthracite | volets roulants en aluminium laqué gris anthracite RAL 7016, lames horizontales fines et régulières, coffre intégré discret en linteau, finition mate absorbant la lumière sans reflet spéculaire |
| Volets coulissants bois naturel | volets coulissants en bois naturel à claire-voie, lames verticales régulières laissant filtrer la lumière, teinte bois clair au veinage apparent, rail de guidage fin visible en partie haute |

---

## 7. Matériaux — margelles

Table `materiaux`, catégorie `margelles`. Pierre : le vocabulaire de vieillissement est
ici légitime, il décrit une réalité matérielle.

| `terme` | `fragment_prompt` |
|---|---|
| Pierre reconstituée beige | margelles en pierre reconstituée beige, bord droit à arête légèrement adoucie, surface finement grenue, joints fins et réguliers entre les éléments, teinte homogène avec de discrètes variations d'un élément à l'autre |
| Travertin | margelles en travertin, surface naturellement poreuse aux cavités caractéristiques, veinage horizontal du beige à l'ivoire, arêtes adoucies par le temps, joints fins, la pierre s'assombrissant légèrement là où l'eau la mouille |
| Pierre naturelle bouchardée | margelles en pierre naturelle à finition bouchardée, surface régulièrement piquetée offrant un relief mat et antidérapant, teinte gris-beige aux variations naturelles marquées d'une pierre à l'autre, arêtes chanfreinées |
| Béton lissé gris clair | margelles en béton lissé gris clair, surface mate et régulière aux très légères variations de teinte, arête vive légèrement chanfreinée, joints de fractionnement rectilignes |

---

## 8. Matériaux — plage de piscine

Table `materiaux`, catégorie `plage`.

| `terme` | `fragment_prompt` |
|---|---|
| Dalles en pierre reconstituée | plage de piscine en dalles de pierre reconstituée grand format, pose à joints alignés, surface légèrement structurée antidérapante, teinte claire et homogène, joints fins et réguliers |
| Lames bois exotique | plage de piscine en lames de bois exotique, pose parallèle à lames régulières, veinage apparent, teinte du miel au brun clair variant légèrement d'une lame à l'autre, espacement constant laissant voir l'ombre entre les lames |
| Lames composite gris | plage de piscine en lames composite gris, surface rainurée mate et régulière, teinte uniforme aux très légères nuances, espacement constant entre les lames, aspect net et contemporain |
| Béton désactivé | plage de piscine en béton désactivé, granulats apparents de calibre régulier affleurant en surface, teinte du gris clair au beige selon les granulats, joints de fractionnement rectilignes, surface mate et rugueuse au toucher |

---

## 9. À valider avant mise en base

- **Les termes des trois catégories de matériaux sont des propositions.** Ils ont été
  choisis pour couvrir les cas courants, pas relevés sur des dossiers réels. Remplace,
  retire ou complète selon ce que tu rencontres effectivement. Les fragments suivent le
  terme : changer l'un demande de reprendre l'autre.
- **`statut` reste `a_calibrer`** jusqu'à ce que chaque fragment ait produit un résultat
  jugé conforme sur un dossier réel. Le formulaire ne propose que les lignes `valide`,
  donc une catégorie entièrement `a_calibrer` apparaîtra vide côté interface — c'est le
  comportement attendu, pas une panne.
- **L'ordre de calibration qui coûte le moins :** les six ambiances de ciel d'abord,
  puisqu'elles conditionnent la règle de précédence avec le bloc de style et que
  l'erreur y est la plus visible. Les éclairages ensuite, qui ne se testent qu'avec une
  ambiance crépusculaire. Les matériaux en dernier, indépendants les uns des autres.
- **Le fragment `reprendre_photo` n'a de sens qu'avec une photographie du site.** Le
  formulaire garantit déjà qu'il n'est pas envoyé sans elle.
