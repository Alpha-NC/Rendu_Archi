# 04B_MODES_DE_PRODUCTION.md

ID : LIB-006
Type : LIB
Version : V1.4
Statut : Review
Niveau : L4
Dossier : Framework/03_REFERENCES

---

# Modes de production

## 1. Objet

Ce document constitue la référence officielle des méthodes de fabrication d'un rendu dans le RIF.

Le mode de production est distinct du style de rendu.

## 2. Retexturation Revit

### Finalité

Améliorer une vue Revit sans modifier sa construction visuelle.

### Canevas principal

Vue Revit.

### Prérequis

- vue exploitable ;
- cadrage validé ;
- géométrie lisible ;
- éléments à préserver identifiés.

### Modifications autorisées

- matériaux ;
- textures ;
- eau ;
- lumière ;
- ombres ;
- effets de surface.

### Zones verrouillées

- contours architecturaux ;
- volumes ;
- ouvertures ;
- toiture ;
- implantation ;
- caméra ;
- cadrage.

### Styles compatibles

**Présentation client et Commercial uniquement.** Photomontage administratif est exclu de ce mode (ADR-013) : son objectif (LIB-005 §1) est défini autour de l'intégration à une photographie réelle du site, qui n'existe pas dans ce mode par construction. À défaut de choix exprimé, Présentation client sert de valeur par défaut. Voir ENG-004 pour le détail du parcours de collecte adapté à ce mode.

### Usages adaptés

- étude interne ;
- présentation client ;
- rendu d'intention ;
- illustration administrative sans insertion réelle.

## 3. Photomontage contrôlé

### Finalité

Insérer un projet dans une photographie réelle en conservant l'identité documentaire du site.

### Canevas principal

Photographie réelle.

### Prérequis

- photographie exploitable ;
- source géométrique correspondante ;
- caméra Compatible ou correctement calibrée ;
- zone d'intervention identifiable ;
- masque, détourage ou méthode de compositing disponible.

### Modifications autorisées

- insertion des éléments projetés ;
- suppression d'éléments explicitement validée ;
- raccords locaux ;
- ombres de contact ;
- transitions entre projet et terrain ;
- harmonisation locale de l'exposition et de la colorimétrie.

### Zones verrouillées

Hors intervention :

- ciel ;
- terrain ;
- végétation ;
- clôtures ;
- murs ;
- bâtiments voisins ;
- horizon ;
- éléments existants conservés.

### Styles compatibles

Les trois styles sont compatibles avec ce mode : Photomontage administratif (par défaut), Présentation client, Commercial.

### Interdiction principale

La scène entière ne doit pas être régénérée.

### Usages adaptés

- déclaration préalable ;
- permis de construire ;
- insertion paysagère ;
- autorisation d'urbanisme.

## 4. Présentation générative

### Finalité

Produire une image réaliste et valorisante du projet avec une liberté visuelle contrôlée.

### Canevas principal

Vue Revit, rendu intermédiaire ou source explicitement désignée.

### Prérequis

- géométrie de référence identifiable ;
- niveau de liberté validé ;
- usage non documentaire compris.

### Modifications autorisées

- harmonisation de l'environnement ;
- amélioration globale de l'ambiance ;
- ajout d'éléments secondaires validés ;
- recomposition visuelle limitée.

### Styles compatibles

Les trois styles sont compatibles avec ce mode : Photomontage administratif (rare dans ce mode car son objectif documentaire s'accorde mal avec la liberté visuelle du mode, mais pas structurellement exclu comme en Retexturation Revit — une photographie peut exister sans être le canevas fixe), Présentation client, Commercial.

### Limite

Le résultat ne constitue pas une insertion documentaire fidèle du site.

### Usages adaptés

- présentation client ;
- communication ;
- concours ;
- exploration esthétique.

## 5. Matrice de choix

| Situation | Mode recommandé |
|---|---|
| Vue Revit seule, caméra à conserver | Retexturation Revit |
| Photo réelle + vue compatible + usage administratif | Photomontage contrôlé |
| Photo réelle + vue incompatible + usage administratif | Suspendre et demander une nouvelle vue ou calibration |
| Présentation client avec liberté d'ambiance | Présentation générative |
| Modification locale d'un photomontage conforme | Photomontage contrôlé, correction locale |

## 6. Règle de décision

Quel que soit le mode, les annotations ne font jamais partie du canevas final : elles sont converties en directives localisées. Les références matériau conservent une autorité limitée à l'apparence de l'élément ciblé.

Lorsque plusieurs modes semblent possibles, l'usage le plus exigeant en fidélité prévaut.

## Documents liés

- REF-001 — 01_REFERENTIEL_GENERAL.md
- REF-002 — 01A_FICHE_PROJET.md
- ENG-001 — 02_PROMPT_GENERATION.md
- ENG-004 — 02B_COLLECTE_CONDITIONNELLE.md
- LIB-005 — 04A_STYLES_DE_RENDU.md
- LIB-004 — 07_GUIDE_DECISION.md

## Historique

V1.4 — Intégration des annotations comme directives et limitation de l'autorité des références matériau.

V1.3 — Ajout d'une sous-section « Styles compatibles » pour chacun des trois modes, formalisant notamment l'exclusion de Photomontage administratif hors Retexturation Revit (ADR-013), en réponse à une incohérence relevée lors de la conception du parcours de collecte conditionnelle (ENG-004).
