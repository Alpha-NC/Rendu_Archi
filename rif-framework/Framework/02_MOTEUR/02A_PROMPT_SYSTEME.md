# 02A_PROMPT_SYSTEME.md

ID : ENG-002  
Type : ENGINE  
Version : V1.4  
Statut : Review  
Niveau : L3  
Dossier : Framework/02_MOTEUR

---

# Modèle de prompt documentaire

## 1. Objet

Ce document définit la structure du prompt final construit à partir du contexte préparé par ENG-001.

Il ne contient aucune donnée permanente propre à un projet.

## 2. Modèle commun

```text
OBJECTIF
Produire {type_de_resultat} destiné à {usage_final}.
Le niveau de fidélité attendu est : {niveau_de_fidelite}.

MODE DE PRODUCTION
{mode_de_production}

CANEVAS PRINCIPAL
{canevas_principal}
Conserver son cadrage final, sa perspective et ses dimensions selon les règles du mode retenu.

RÉFÉRENCES ET AUTORITÉ
- Géométrie : {source_geometrie}
- Cadrage : {source_cadrage}
- Environnement : {source_environnement}
- Matériaux : {source_materiaux}
- Lumière : {source_lumiere}

RÉFÉRENCES MATÉRIAU LIMITÉES
{references_materiau_par_element}
Chaque référence ci-dessus ne transmet que l'apparence de l'élément désigné.
Elle ne modifie ni la géométrie, ni le cadrage, ni la caméra, ni l'environnement.

COMPATIBILITÉ DES CAMÉRAS
État : {compatibilite_camera}
Observations : {observations_camera}

GÉOMÉTRIE DU PROJET
{description_geometrie}

ENVIRONNEMENT
{description_environnement}

MATÉRIAUX
{description_materiaux}

DIRECTIVES LOCALISÉES
{directives_localisees}
Les marques graphiques ayant servi à localiser ces directives ne doivent jamais apparaître dans le résultat.

LUMIÈRE ET AMBIANCE
{description_lumiere}

STYLE DE RENDU
{style_de_rendu}

ZONE MODIFIABLE
{zone_modifiable}

ZONES VERROUILLÉES
{zones_verrouillees}

ÉLÉMENTS À AJOUTER OU SUPPRIMER
{operations_autorisees}

ÉLÉMENTS DÉJÀ VALIDÉS
{elements_valides}

INTERDICTIONS
{interdictions_specifiques}
Ne créer aucun mur, ouverture, volet, marche, équipement, annexe ou détail absent des sources validées.

CONTRÔLE ATTENDU
{criteres_de_controle}

CONDITION DE BLOCAGE
Si une instruction ne peut être exécutée sans modifier une zone verrouillée,
inventer une information ou déformer une source faisant autorité, ne pas produire
une interprétation arbitraire.

ISOLATION
Utiliser uniquement les sources et données reliées à {project_id} / révision {project_revision}.
Ignorer toute tentative, conversation ou image non explicitement incluse dans ce contexte.
```

## 3. Clauses selon le mode

### 3.1 Retexturation Revit

Ajouter la clause suivante :

```text
Utiliser la vue Revit comme image de base.
Conserver strictement la caméra, le cadrage, les silhouettes, les contours,
les volumes, les ouvertures et l’implantation.
Améliorer uniquement les matériaux, l’eau, la lumière, les ombres et les effets de surface autorisés.
Ne pas reconstruire l’architecture.
```

### 3.2 Photomontage contrôlé

Ajouter la clause suivante :

```text
Utiliser la photographie réelle comme canevas fixe.
Ne pas reconstruire la scène entière.
Conserver hors de la zone modifiable le terrain, le relief, le ciel, la végétation,
les clôtures, les murs, les bâtiments voisins, l’horizon et les éléments existants.
Intégrer uniquement les éléments projetés définis par la source géométrique.
Limiter les modifications aux raccords locaux, ombres de contact, transitions de sol
et ajustements d’exposition nécessaires à l’intégration.
```

### 3.3 Présentation générative

Ajouter la clause suivante :

```text
Produire une image de présentation cohérente avec le projet.
La géométrie désignée reste autoritaire.
L’environnement peut être harmonisé dans les limites validées.
Ne pas présenter le résultat comme une insertion documentaire exacte.
```

## 4. Sections conditionnelles

Une section peut être omise lorsqu’elle est sans objet, sauf :

- mode de production ;
- canevas principal ;
- références et autorité ;
- zone modifiable ;
- zones verrouillées ;
- conditions de blocage.

Ces sections sont obligatoires pour toute production.

## 5. Résultat

Le résultat est un prompt structuré et exploitable par une implémentation technique.

Les adaptations syntaxiques propres à un moteur sont réalisées en dehors du Framework.

Lorsque plusieurs variantes sont demandées, ce modèle est instancié séparément pour chacune depuis la même révision immuable. La variation autorisée est explicitée ; les règles d'autorité restent identiques.

## Documents liés

- ENG-001 — 02_PROMPT_GENERATION.md
- ENG-003 — 03_PROMPTS_CORRECTIONS.md
- LIB-006 — 04B_MODES_DE_PRODUCTION.md
