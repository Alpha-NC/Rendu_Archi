# 06_CAS_DE_TEST.md

ID : LIB-003  
Type : LIB  
Version : V1.4  
Statut : Review  
Niveau : L4  
Dossier : Framework/03_REFERENCES

---

# Bibliothèque des cas de test

## 1. Objet

Ce document définit les tests fonctionnels et de non-régression du Framework.

## 2. Structure obligatoire

Chaque test contient :

- Identifiant ;
- Objectif ;
- Contexte ;
- Données d’entrée ;
- Mode attendu ;
- Résultat attendu ;
- Critères de réussite.

## 3. Cas nominaux

### TEST-001 — Retexturation simple

Objectif : améliorer les matériaux d’une vue Revit sans modifier sa géométrie.

Mode attendu : Retexturation Revit.

Réussite : cadrage, volumes, toiture et ouvertures superposables à la source.

### TEST-002 — Piscine et plages

Objectif : conserver l’implantation, la forme, les margelles et les largeurs différenciées des plages.

Réussite : aucune simplification ou uniformisation géométrique.

### TEST-003 — Terrain en pente

Objectif : préserver le relief, les accès et les murs de soutènement.

### TEST-004 — Correction ciblée

Objectif : modifier un seul matériau sans régression géométrique.

### TEST-005 — Corrections successives

Objectif : vérifier la stabilité après plusieurs corrections.

Réussite : aucune régression ; sinon recommandation de repartir des sources.

### TEST-006 — Photomontage contrôlé

Contexte : photographie réelle, vue Revit compatible, usage administratif.

Mode attendu : Photomontage contrôlé.

Réussite : photographie conservée hors masque ; projet correctement implanté ; voisinage et végétation identiques.

### TEST-007 — Présentation générative

Contexte : vue Revit, photographie indicative, usage présentation client.

Mode attendu : Présentation générative.

Réussite : géométrie fidèle, image valorisante, résultat explicitement non documentaire.

### TEST-008 — Double verdict d’usage

Objectif : vérifier qu’une image peut être acceptée pour présentation client et refusée pour insertion administrative.

### TEST-009 — Dépôt groupé et rôles détectés

Objectif : accepter plusieurs noms quelconques, proposer leurs rôles et demander uniquement les confirmations ambiguës.

### TEST-010 — Référence matériau ciblée

Objectif : appliquer l'apparence d'une référence au seul élément désigné sans reprendre sa forme ni modifier la composition.

### TEST-011 — Annotation de suppression

Objectif : convertir une zone entourée en directive de suppression et ne reproduire aucune marque.

### TEST-012 — Variantes comparables

Objectif : produire trois variantes depuis la même révision, conserver leur historique et sélectionner explicitement la variante canonique.

### TEST-013 — Pré-analyse matériau

Objectif : pré-remplir les cas évidents avec confiance et provenance, tout en demandant les cas rares ou contradictoires.

## 4. Cas d’échec

### TEST-101 — Documents incompatibles

Résultat attendu : suspension et demande de clarification.

### TEST-102 — Informations insuffisantes

Résultat attendu : demande limitée aux informations indispensables.

### TEST-103 — Matériau inconnu

Résultat attendu : aucune invention.

### TEST-104 — Orientation inconnue

Résultat attendu : lumière neutre lorsque aucune photographie ne fait autorité.

### TEST-105 — Demande contradictoire

Résultat attendu : suspension avant génération.

### TEST-106 — Régénération globale d’un site réel

Contexte : photographie utilisée mais paysage, végétation et voisinage recréés.

Résultat attendu : Non conforme pour usage administratif ; nouvelle génération depuis la photographie originale.

### TEST-107 — Caméras incompatibles

Contexte : photographie et vue Revit avec perspectives incompatibles.

Résultat attendu : aucun photomontage administratif automatique ; nouvelle vue ou calibration demandée.

### TEST-108 — Mauvais mode sélectionné

Contexte : usage administratif traité en Présentation générative.

Résultat attendu : échec du test et reclassement en Photomontage contrôlé.

### TEST-109 — Correction sur environnement déjà altéré

Résultat attendu : repartir de la photographie originale plutôt que corriger l’image dégradée.

### TEST-110 — Mur inventé

Résultat attendu : Non conforme ; reprise depuis les sources.

### TEST-111 — Ouverture créée ou déplacée

Résultat attendu : Non conforme pour tout usage exigeant la fidélité.

### TEST-112 — Pool house surdimensionné

Résultat attendu : détection de l'écart de proportion, verdict selon l'usage et correction depuis la source géométrique.

### TEST-113 — Sous-face non texturée

Résultat attendu : réserve ou correction matérielle ciblée selon sa visibilité et l'usage.

### TEST-114 — Bord de terrasse blanc

Résultat attendu : défaut matériel détecté et correction locale sans modifier la terrasse.

### TEST-115 — Calepinage décalé

Résultat attendu : joints, lames ou tuiles réalignés sans changer la géométrie.

### TEST-116 — Margelles ou plages uniformisées

Résultat attendu : conservation des largeurs distinctes visibles sur la source.

### TEST-117 — Annotation conservée

Résultat attendu : Non conforme ; aucune marque graphique ou légende ne subsiste.

### TEST-118 — Équipement inventé

Contexte : volet de piscine, marches ou mobilier plausibles mais absents des sources.

Résultat attendu : Non conforme et suppression ciblée.

### TEST-119 — Soleil impossible

Résultat attendu : incohérence signalée lorsque direction solaire, façade et orientation sont incompatibles.

### TEST-120 — Référence matériau contaminant la composition

Résultat attendu : rejet de toute modification de caméra, forme ou environnement provenant de la référence.

### TEST-121 — Contamination inter-dossiers

Résultat attendu : aucune source, instruction ou défaut d'une tentative antérieure ne figure dans la requête courante.

### TEST-122 — Régression après correction

Résultat attendu : détection de toute altération d'un élément déjà validé ; résultat non promu au rang canonique.

## 5. Validation d’une version

Une version est validée lorsque :

- tous les tests applicables sont exécutés ;
- aucun défaut éliminatoire n’est présent ;
- les échecs sont documentés ;
- les tests de non-régression précédents restent réussis.

## Documents liés

- ENG-001 — 02_PROMPT_GENERATION.md
- ENG-003 — 03_PROMPTS_CORRECTIONS.md
- LIB-002 — 05_CHECKLIST_CONTROLE.md
- LIB-006 — 04B_MODES_DE_PRODUCTION.md
