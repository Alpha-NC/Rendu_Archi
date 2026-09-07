# 03_PROMPTS_CORRECTIONS.md

ID : ENG-003  
Type : ENGINE  
Version : V1.4  
Statut : Review  
Niveau : L3  
Dossier : Framework/02_MOTEUR

---

# Moteur de préparation des corrections

## 1. Objet

Ce document décrit le processus de préparation d’une correction ciblée appliquée à un rendu existant.

## 2. Principe

Une correction modifie uniquement l’élément explicitement demandé et conserve les éléments déjà validés.

Le mode de production initial reste applicable, sauf décision explicite de régénération.

## 3. Entrées

- État du projet ;
- rendu à corriger ;
- sources de référence ;
- demande de correction ;
- mode de production ;
- zones modifiables et verrouillées ;
- éléments déjà validés ;
- dernier audit disponible.
- directive localisée ou annotation source éventuelle ;
- révision immuable ayant produit le rendu de base.

## 4. Qualification de la demande

La demande est classée comme :

- correction locale ;
- correction matérielle ;
- correction lumineuse ;
- correction environnementale autorisée ;
- correction géométrique explicitement validée ;
- régénération nécessaire.

## 5. Vérification préalable

Avant de préparer la correction, vérifier :

- que l’élément est clairement identifié ;
- que sa zone est modifiable ;
- que la correction ne contredit pas une source autoritaire ;
- que les éléments validés peuvent être préservés ;
- que la correction ne nécessite pas un changement de caméra ;
- que le dernier rendu est encore une base fiable.
- que toute annotation a été traduite en action, cible et zone confirmées ;
- que les marques d'annotation seront exclues du résultat.

## 6. Règles par mode

### Retexturation Revit

La correction ne doit pas modifier la silhouette ou les contours géométriques.

### Photomontage contrôlé

La photographie originale reste la référence des zones verrouillées.

Si le rendu précédent a déjà altéré le site réel, la correction doit repartir de la photographie originale et du masque, et non de l’image dégradée.

### Présentation générative

La correction peut s’appuyer sur le dernier rendu validé tant que la géométrie et les validations ne régressent pas.

## 7. Contexte de correction

```text
MODE DE PRODUCTION
{mode_de_production}

RENDU DE BASE
{rendu_de_base}

SOURCE À RÉUTILISER SI NÉCESSAIRE
{source_originale}

ÉLÉMENT À MODIFIER
{element_a_modifier}

ZONE MODIFIABLE
{zone_modifiable}

ÉLÉMENTS À CONSERVER
{elements_a_conserver}

ZONES VERROUILLÉES
{zones_verrouillees}

RÉSULTAT ATTENDU
{resultat_attendu}

CONTRÔLE DE NON-RÉGRESSION
{criteres_non_regression}

MARQUES À EXCLURE
{annotations_a_ne_pas_reproduire}
```

## 8. Régénération obligatoire

Repartir des sources lorsque :

- la géométrie a dérivé ;
- la caméra a changé ;
- l’environnement réel a été recréé dans un photomontage contrôlé ;
- plusieurs corrections ont accumulé des régressions ;
- la zone verrouillée n’est plus fiable ;
- la qualité générale ne permet plus une correction locale.
- la correction exige en réalité une recomposition globale ou une modification de l'autorité des sources.

## 9. Sortie

Le moteur produit un contexte de correction transmis au modèle de prompt ENG-002.

Le résultat corrigé constitue une nouvelle variante traçable. Il ne remplace le résultat canonique qu'après sélection humaine.

## Documents liés

- REF-002 — 01A_FICHE_PROJET.md
- ENG-002 — 02A_PROMPT_SYSTEME.md
- LIB-002 — 05_CHECKLIST_CONTROLE.md
- LIB-004 — 07_GUIDE_DECISION.md
