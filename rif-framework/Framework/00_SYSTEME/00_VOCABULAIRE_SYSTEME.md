# 00_VOCABULAIRE_SYSTEME.md

ID : ARCH-002  
Type : ARCH  
Version : V1.6  
Statut : Review  
Niveau : L1  
Dossier : Framework/00_SYSTEME

---

# Vocabulaire du Framework

## Définitions

**Framework** — Ensemble universel de règles, modules, processus et contrôles constituant le RIF.

**Implémentation** — Système technique appliquant le Framework : application, GPT, API ou chaîne de compositing.

**Profil d'implémentation** — Préférences, lexique, contraintes produit et valeurs usuelles propres à un client ou à une implémentation. Il ne modifie pas les règles universelles.

**Projet / dossier** — Espace isolé regroupant l'état projet, ses sources, ses productions et son historique.

**État projet** — Ensemble structuré, versionné et validé des informations courantes d'un projet.

**Source** — Document utilisé pour décrire, orienter ou contrôler un projet.

**Rôle de source** — Fonction déclarée d'un fichier : géométrie, site, matériau, annotation, contrôle ou rendu.

**Autorité d'une source** — Domaine précis pour lequel une source fait foi. L'autorité n'est jamais globale par défaut.

**Élément d'environnement** — Composant du contexte réel (végétation, clôture, terrain, voisinage, ciel, mobilier, etc.), distinct des éléments architecturaux du projet. Chaque élément d'environnement identifié reçoit exactement un des trois états ci-dessous — jamais un quatrième état concurrent, jamais une absence d'état.

**Élément verrouillé (`locked`)** — Doit rester cohérent avec le réel. Modification uniquement sur instruction explicite exceptionnelle (ex. bâtiment voisin, horizon, structure générale du terrain).

**Élément modifiable (`editable`)** — Peut être remplacé, supprimé ou transformé après décision explicite de l'utilisateur (ex. clôture à remplacer, arbre à supprimer). La modification ne doit jamais être appliquée sans cette décision.

**Élément harmonisable (`harmonizable`)** — Peut être amélioré visuellement sans changer l'identité générale du site, avec une liberté du moteur limitée à cet effet (ex. pelouse médiocre, petite végétation, propreté du terrain).

Ces trois états gouvernent l'environnement ; ils ne s'appliquent pas aux éléments architecturaux du projet (géométrie, volumes, toiture, ouvertures, implantation), qui restent régis par l'autorité de la source géométrique (REF-001 §2) et par le mode de production (LIB-006), pas par cette classification.

**Référence matériau** — Image dont l'autorité est limitée à l'apparence de l'élément désigné : nature, teinte, texture, finition, relief et calepinage visible.

**Source modèle 3D (`model_3d`)** — Maquette numérique 3D du projet (format non figé — ADR-021). Fait foi en priorité sur la géométrie (volumes, niveaux, toiture, ouvertures, implantation, terrasses, piscine, annexes, dimensions, relations spatiales) quand une extraction réelle en a été tirée — jamais par la seule présence du fichier.

**Extraction géométrique** — Traitement d'une source modèle 3D par un fournisseur dédié, produisant un pack de contraintes géométriques. Sans fournisseur configuré, l'extraction reste explicitement non disponible ; aucun résultat n'est simulé à sa place.

**Pack de contraintes géométriques** — Ensemble structuré et versionné des données extraites d'une source modèle 3D (limites, niveaux, volumes, toitures, ouvertures, caméra, silhouette, masques, zones verrouillées/éditables). Se remplit progressivement ; un champ absent n'est jamais complété par une valeur inventée.

**Alignement caméra/photo** — Mise en correspondance d'une source modèle 3D avec une photographie réelle. Une calibration incertaine appelle une validation humaine plutôt qu'un résultat présenté comme fiable sans base réelle.

**Source annotée** — Source comportant des marques servant à localiser une consigne. Les marques ne font pas partie du résultat attendu.

**Directive localisée** — Instruction structurée associant une zone, une action (`conserver`, `supprimer`, `remplacer`, `corriger`, `verrouiller`) et une description.

**Pré-analyse** — Extraction assistée de données probables depuis les sources avant les questions à l'utilisateur. Toute donnée pré-remplie reste confirmable.

**Génération** — Nouvelle production construite depuis une révision immuable de l'état projet.

**Variante** — Résultat alternatif partageant la même révision d'état et le même objectif.

**Résultat canonique** — Variante ou correction explicitement sélectionnée comme base courante.

**Correction** — Modification ciblée d'un résultat existant conservant les éléments validés.

**Reprise depuis les sources** — Nouvelle génération lorsque le résultat courant n'est plus une base fiable.

**Mode de production** — Méthode de fabrication de l'image.

**Style de rendu** — Apparence visuelle, sans autorité sur la géométrie ni sur le mode.

**Compatibilité caméra** — État `Compatible`, `Approximative`, `Incompatible` ou `Non évaluée`.

**Verdict par usage** — Évaluation attachée à une destination déclarée. Un même rendu peut être acceptable en présentation et non conforme en administratif.

## Règles

- Un terme transversal est défini ici avant usage général.
- Les synonymes sont admis dans l'interface, mais un terme officiel est conservé dans les données.
- Le vocabulaire architectural détaillé relève de REF-003.

## Documents liés

- REF-001 — 01_REFERENTIEL_GENERAL.md
- REF-002 — 01A_FICHE_PROJET.md
- LIB-006 — 04B_MODES_DE_PRODUCTION.md

## Historique

V1.6 — Ajout des termes du workflow geometry-first : source modèle 3D, extraction géométrique, pack de contraintes géométriques, alignement caméra/photo. Voir ADR-021.

V1.5 — Ajout des trois états d'élément d'environnement (`locked`/`editable`/`harmonizable`), issus du recalibrage produit V2.1 (Mode B — Retexturation contextualisée). Remplace l'usage antérieur, non défini ici, de `locked`/`editable`/`unknown` dans REF-002 §7.

