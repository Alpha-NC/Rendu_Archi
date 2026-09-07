# 04_MATERIAUX.md

ID : LIB-001
Type : LIB
Version : V1.4
Statut : Review
Niveau : L4
Dossier : Framework/03_REFERENCES

---

# Bibliothèque des matériaux

## 1. Objet

Le présent document constitue la bibliothèque de référence des principes d'interprétation des matériaux du Framework.

Il décrit les critères permettant de représenter les principaux matériaux architecturaux de manière fidèle, crédible et cohérente.

Il ne constitue ni un catalogue de produits ni une bibliothèque de textures.

---

## 2. Principes

La représentation d'un matériau doit respecter :

* sa nature ;
* son aspect réel ;
* son relief ;
* ses variations naturelles ;
* son vieillissement éventuel.

Lorsqu'un matériau est inconnu, aucune interprétation arbitraire ne doit être réalisée.

Lorsque la photographie réelle montre un bâtiment existant — cas fréquent en extension, rénovation ou restructuration — son aspect matériel réel (texture, usure, teinte exacte) fait référence pour tout élément visible à la fois sur la photographie et sur la vue Revit. Le matériau n'est alors ni deviné ni interprété : il est repris tel qu'il apparaît réellement. L'estimation à partir des données du projet ne s'applique qu'aux éléments absents de la photographie.

**Cette règle ne s'applique pas à un élément déclaré intouchable ou dont la teinte, la finition ou la nature ont été explicitement validées dans la fiche projet.** Dans ce cas, la donnée validée prévaut sur l'apparence visible de la photographie pour cet élément précis — qu'il s'agisse d'un élément que le projet modifie (par exemple une teinte de menuiserie repeinte) ou d'un élément existant dont la validation corrige une divergence entre la photo et la vue Revit (éclairage, angle de prise de vue, qualité de l'image). La photographie conserve dans tous les cas son rôle de repère de position, d'implantation et d'environnement réel autour de l'élément concerné ; elle ne redevient jamais la référence de son aspect matériel une fois cet élément validé.

En pratique, la collecte du projet (ENG-001) doit permettre de distinguer, pour chaque élément visible à la fois sur la photo et sur Revit, s'il est existant conservé (la photo fait référence) ou modifié/validé par le projet (la donnée validée fait référence). Une absence de précision sur ce point n'autorise pas à trancher arbitrairement en faveur de l'une ou l'autre source : la question doit être posée.

### 2.1 Référence matériau externe

Une photographie de matériau fournie comme référence transmet uniquement, pour l'élément explicitement ciblé : nature, teinte, texture, finition, relief, variations et calepinage visible. Elle ne transmet pas la forme de l'objet photographié, sa disposition, son environnement, sa caméra ou sa composition.

Si la cible n'est pas certaine, l'utilisateur doit la confirmer avant génération. Plusieurs références contradictoires ne sont jamais fusionnées arbitrairement.

### 2.2 Pré-analyse et profil

L'analyse des sources peut proposer automatiquement un matériau et un niveau de confiance. Les cas courants à confiance élevée sont confirmés en groupe ; les cas rares ou ambigus sont demandés individuellement. Une palette propre à un client ou à une région reste dans son profil d'implémentation et sert uniquement à améliorer les suggestions.

---

## 3. Principes d'interprétation

Pour chaque matériau, le Framework évalue notamment :

* la texture ;
* le relief ;
* la couleur ;
* la brillance ;
* les variations naturelles ;
* les défauts visuels fréquents.

L'objectif est de produire une représentation réaliste sans modifier la nature du matériau.

---

## 4. Toitures

### Tuiles

Points d'attention :

* éviter les répétitions visibles ;
* conserver les variations de teinte ;
* respecter le relief ;
* éviter l'aspect plastique ;
* conserver les joints.

---

### Ardoises

Points d'attention :

* conserver les différences de nuance ;
* éviter une surface uniforme ;
* respecter l'épaisseur visible.

---

## 5. Façades

### Enduits

Points d'attention :

* conserver un grain réaliste ;
* éviter les surfaces trop lisses ;
* respecter les irrégularités légères.

---

### Bardages bois

Points d'attention :

* conserver le veinage ;
* éviter les répétitions ;
* respecter les variations naturelles.

---

### Bardages métalliques

Points d'attention :

* respecter les reflets ;
* éviter les effets miroir ;
* conserver les joints et les fixations lorsqu'ils sont visibles.

---

## 6. Menuiseries

### Bois

Points d'attention :

* conserver le veinage ;
* éviter un rendu uniforme ;
* respecter la finition.

---

### Aluminium

Points d'attention :

* conserver une réflexion réaliste ;
* éviter un aspect chromé ;
* respecter les profils.

---

## 7. Sols

### Béton

Points d'attention :

* conserver les nuances ;
* éviter les aplats uniformes ;
* respecter les joints éventuels.

---

### Pierre

Points d'attention :

* conserver les variations naturelles ;
* éviter les répétitions ;
* respecter les joints.

---

## 8. Défauts fréquents

Les défauts suivants doivent être évités :

* textures répétitives ;
* surfaces plastiques ;
* relief excessif ;
* reflets incohérents ;
* couleurs artificielles ;
* matériaux uniformes.
* sous-faces ou détails mineurs laissés sans texture ;
* bords de terrasse blancs ou non raccordés ;
* joints, lames ou tuiles décalés par rapport à la géométrie ;
* margelles ou plages de piscine uniformisées malgré des largeurs différentes.

---

## 8A. Formulation pour contrer ces défauts

Cette liste identifie les défauts sans indiquer comment les éviter dans le texte transmis au moteur. Les règles suivantes s'appliquent à toute implémentation, quel que soit le moteur utilisé :

* Décrire positivement l'imperfection photographique recherchée plutôt qu'énumérer ce qu'il faut éviter. Les moteurs d'image ne traitent pas tous de façon fiable les instructions négatives ; certains ne les interprètent pas du tout.
* Ne jamais employer les mots « 3D » ou « rendu » dans le texte transmis au moteur. Ces termes orientent la génération vers une esthétique de synthèse plutôt que photographique, y compris lorsqu'ils apparaissent dans un contexte négatif ou prohibitif.
* Mentionner explicitement les marqueurs suivants, propres à une vraie photographie : grain photographique naturel, léger bruit de capteur, profondeur de champ cohérente avec un objectif réel, variations naturelles de teinte et de relief plutôt qu'une surface uniforme.
* Pour la végétation basse (pelouse, gazon) : demander des brins individuels visibles et des variations naturelles de couleur, jamais une surface d'un vert uniforme.
* L'ensemble de l'image — bâti et environnement réel confondus — doit paraître capturé en une seule prise de vue : même direction de lumière, mêmes ombres, même température de couleur, même niveau de grain sur toute l'image. Aucune zone ne doit paraître plus lisse, plus nette ou plus « propre » que le reste : c'est précisément ce qui trahit un photomontage plutôt qu'une photographie unique.

---

## Documents liés

REF-001 — 01_REFERENTIEL_GENERAL.md

REF-002 — 01A_FICHE_PROJET.md

REF-003 — 01B_VOCABULAIRE_ARCHITECTURAL.md

ENG-001 — 02_PROMPT_GENERATION.md

LIB-002 — 05_CHECKLIST_CONTROLE.md

DOC-001 — 99_CONVENTIONS.md

---

## Évolution

Tout nouveau matériau partagé par plusieurs modules documentaires doit être documenté dans la présente bibliothèque avant son utilisation.

Chaque matériau est décrit selon les mêmes principes :

* nature ;
* critères d'interprétation ;
* points de vigilance ;
* défauts fréquents.

## Historique

V1.3 — Ajout de la règle de priorité des éléments intouchables ou validés sur l'aspect matériel visible en photographie (§2), en réponse à une dérive observée sur un élément de menuiserie dont la teinte photographiée différait de la teinte validée dans la fiche projet. Voir ADR-012.

V1.4 — Autorité limitée des références matériau, pré-analyse confirmable et défauts de finition issus des tests réels. Voir ADR-014 et ADR-018.
