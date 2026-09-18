# 04B_MODES_DE_PRODUCTION.md

ID : LIB-006
Type : LIB
Version : V1.7
Statut : Review
Niveau : L4
Dossier : Framework/03_REFERENCES

---

# Modes de production

## 1. Objet

Ce document constitue la référence officielle des méthodes de fabrication d'un rendu dans le RIF.

Le mode de production est distinct du style de rendu (ADR-008) : le mode détermine le canevas, l'autorité des sources et ce qui peut être transformé ; le style (LIB-005) ne détermine que l'apparence visuelle, jamais l'architecture. Un mode n'est jamais un style, et réciproquement — en particulier, Photomontage contrôlé (mode) ne doit jamais être confondu avec Administratif sobre (style, LIB-005) : le premier fixe le canevas et l'autorité des sources, le second ne fixe que l'ambiance visuelle. Les deux se combinent fréquemment (§3) mais restent deux axes indépendants.

Nomenclature officielle des modes (PRD V2.1 §8, source de vérité) :

| Mode | Identifiant |
|---|---|
| Retexturation Revit | `retexturation_revit` |
| Retexturation contextualisée | `retexturation_contextualisee` |
| Photomontage contrôlé | `photomontage_controle` |

Pour la nomenclature des styles, voir LIB-005.

**Note geometry-first (ADR-021) :** le workflow geometry-first distingue conceptuellement trois usages (retexturation fidèle à la vue projet, insertion dans un site réel, présentation à liberté visuelle assumée) qui se rapprochent de ces trois modes sans leur être identiques — en particulier, l'usage « liberté visuelle assumée » évoque le mode « Présentation générative » retiré par ADR-019. Aucun mode n'est ajouté, renommé ou réintroduit par cette note : la correspondance exacte reste une question produit ouverte, à trancher avec Évariste. Une source `model_3d`, quand elle existe et a été extraite, renforce l'autorité géométrique de ces trois modes sans en changer le périmètre (REF-001 §2).

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

**Présentation naturelle et Commercial uniquement.** Administratif sobre est exclu de ce mode (ADR-013) : son objectif (LIB-005 §1) est défini autour de l'intégration à une photographie réelle du site, qui n'existe pas dans ce mode par construction. À défaut de choix exprimé, Présentation naturelle sert de valeur par défaut. Voir ENG-004 pour le détail du parcours de collecte adapté à ce mode.

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

Les trois styles sont compatibles avec ce mode : Administratif sobre (par défaut), Présentation naturelle, Commercial.

### Interdiction principale

La scène entière ne doit pas être régénérée.

### Usages adaptés

- déclaration préalable ;
- permis de construire ;
- insertion paysagère ;
- autorisation d'urbanisme.

## 4. Retexturation contextualisée — MODE PRINCIPAL

### Finalité

Photoréaliser la vue Revit tout en recréant, à partir de la photographie réelle du site, un contexte crédible et reconnaissable — sans imposer la conservation absolue de chaque détail de cette photographie.

C'est le mode attendu du cas standard : vue Revit perspective + axonométrie + photographie réelle, sans exigence documentaire stricte.

### Canevas principal

Vue Revit perspective. La photographie réelle n'est jamais le canevas dans ce mode — elle est une référence de contexte (REF-001 §2).

### Sources

- vue Revit perspective (obligatoire) ;
- axonométrie (garde-fou structurel, REF-001 §2) ;
- photographie réelle du site (recommandée ; en son absence, se rabattre sur Retexturation Revit).

### Prérequis

- vue Revit exploitable, cadrage validé ;
- axonométrie disponible ou volumes suffisamment lisibles sans elle ;
- éléments d'environnement de la photographie classés `locked`, `editable` ou `harmonizable` (ARCH-002, REF-002 §7).

### Modifications autorisées

- tout ce qu'autorise la Retexturation Revit (matériaux, textures, eau, lumière, ombres, effets de surface) ;
- transformation, remplacement ou suppression des éléments d'environnement classés `editable`, après décision explicite ;
- amélioration visuelle des éléments d'environnement classés `harmonizable`, dans la limite de la cohérence générale du lieu.

### Éléments verrouillés (`locked`)

Comme en Retexturation Revit : caméra, cadrage, perspective, silhouette, volumes, ouvertures, toiture, implantation.

Dans l'environnement (REF-002 §7) : bâtiment voisin, horizon, structure générale du terrain, et tout élément explicitement désigné comme conservé — sauf instruction explicite exceptionnelle (ARCH-002).

### Éléments modifiables (`editable`)

Exemples : clôture ou portail à remplacer, arbre ou haie à supprimer, revêtement extérieur, mobilier ou véhicule non pertinent — uniquement sur décision explicite validée.

### Éléments harmonisables (`harmonizable`)

Exemples : pelouse médiocre, petite végétation, propreté visuelle du terrain, ciel, exposition, raccords entre projet et terrain.

### Styles compatibles

Les trois styles sont compatibles avec ce mode : Présentation naturelle (par défaut de ce mode, LIB-005), Administratif sobre (si un dossier administratif l'exige malgré l'absence d'insertion documentaire stricte — rare, à confirmer), Commercial.

### Interdiction principale

Le site ne doit jamais être reconstruit dans son intégralité : les éléments non explicitement classés `editable` restent gouvernés par leur état `locked` ou `harmonizable`, jamais recomposés librement.

### Usages adaptés

- cas standard d'Évariste (vue Revit + axonométrie + photo réelle, usage non strictement documentaire) ;
- présentation client avec ancrage réel du site ;
- avant-projet contextualisé.

## 5. Matrice de choix

| Situation | Mode recommandé |
|---|---|
| Vue Revit seule, caméra à conserver | Retexturation Revit |
| Vue Revit + photo réelle, sans exigence administrative stricte (cas standard) | Retexturation contextualisée |
| Photo réelle + vue compatible + usage administratif | Photomontage contrôlé |
| Photo réelle + vue incompatible + usage administratif | Suspendre et demander une nouvelle vue ou calibration |
| Modification locale d'un photomontage conforme | Photomontage contrôlé, correction locale |
| Modification locale d'une retexturation contextualisée conforme | Retexturation contextualisée, correction locale sur l'élément `editable` ou `harmonizable` concerné |

## 6. Règle de décision

Quel que soit le mode, les annotations ne font jamais partie du canevas final : elles sont converties en directives localisées. Les références matériau conservent une autorité limitée à l'apparence de l'élément ciblé.

Lorsque plusieurs modes semblent possibles, l'usage le plus exigeant en fidélité prévaut. En particulier, entre Retexturation contextualisée et Photomontage contrôlé (les deux seuls modes utilisant une photographie réelle), Photomontage contrôlé prévaut dès qu'un usage documentaire strict est déclaré (§5) ; Retexturation contextualisée reste le choix par défaut dans tous les autres cas où une photographie est disponible.

## Documents liés

- REF-001 — 01_REFERENTIEL_GENERAL.md
- REF-002 — 01A_FICHE_PROJET.md
- ARCH-002 — 00_VOCABULAIRE_SYSTEME.md
- ENG-001 — 02_PROMPT_GENERATION.md
- ENG-002 — 02A_PROMPT_SYSTEME.md
- ENG-004 — 02B_COLLECTE_CONDITIONNELLE.md
- LIB-005 — 04A_STYLES_DE_RENDU.md
- LIB-004 — 07_GUIDE_DECISION.md

## Historique

V1.7 — Ajout d'une note geometry-first (§1, ADR-021) signalant la tension terminologique entre les trois usages du workflow geometry-first et les trois modes existants, sans ajouter, renommer ni réintroduire aucun mode — question ouverte pour le rendez-vous Évariste. Précise qu'une source `model_3d` extraite renforce l'autorité géométrique des modes existants sans changer leur périmètre.

V1.6 — Harmonisation de la nomenclature des styles sur le PRD V2.1 §9 (ADR-020) dans les sections « Styles compatibles » : « Photomontage administratif » → **Administratif sobre**, « Présentation client » → **Présentation naturelle**. Ajout des tables de nomenclature officielle des modes (§1) et rappel explicite de la distinction mode/style, notamment entre Photomontage contrôlé (mode) et Administratif sobre (style) — jamais interchangeables.

V1.5 — Recalibrage produit V2.1 (ADR-019) : le mode « Présentation générative » est retiré et remplacé par « Retexturation contextualisée », qui en reprend l'esprit (liberté visuelle contrôlée, vue Revit comme géométrie de référence) tout en le rendant beaucoup plus précis — sources fixées (Revit + axonométrie + photo réelle), environnement classé selon les trois états `locked`/`editable`/`harmonizable` (ARCH-002) au lieu d'une « harmonisation » non qualifiée. Devient le mode principal du cas standard (§5), Retexturation Revit et Photomontage contrôlé restant inchangés dans leur périmètre respectif. Conforme au PRD V2.1 §8 : « RIF V2 distingue trois modes. »

V1.4 — Intégration des annotations comme directives et limitation de l'autorité des références matériau.

V1.3 — Ajout d'une sous-section « Styles compatibles » pour chacun des trois modes, formalisant notamment l'exclusion de Photomontage administratif hors Retexturation Revit (ADR-013), en réponse à une incohérence relevée lors de la conception du parcours de collecte conditionnelle (ENG-004).
