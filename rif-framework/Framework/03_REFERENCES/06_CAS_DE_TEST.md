# 06_CAS_DE_TEST.md

ID : LIB-003  
Type : LIB  
Version : V1.6  
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

### TEST-007 — Retexturation contextualisée standard

Contexte : vue Revit perspective, axonométrie, photographie réelle proche, usage présentation client (non administratif).

Mode attendu : Retexturation contextualisée.

Réussite : architecture Revit conservée à l'identique (cadrage, perspective, silhouette, volumes, toiture, ouvertures, implantation) ; contexte du site reconnaissable sans conformité pixel par pixel ; aucun élément `locked` modifié.

### TEST-007A — Élément harmonisé

Objectif : améliorer un élément d'environnement classé `harmonizable` (ex. pelouse médiocre) sans modifier l'identité générale du site.

Contexte : Retexturation contextualisée, photographie avec un élément visuellement dégradé, instruction d'amélioration.

Réussite : élément plus crédible et entretenu ; terrain, cadrage et architecture inchangés ; aucun élément voisin non désigné n'est affecté.

### TEST-007B — Élément remplacé ou supprimé

Objectif : transformer un élément d'environnement classé `editable` (ex. clôture à remplacer, arbre à supprimer) sur décision explicite.

Contexte : Retexturation contextualisée, instruction ciblée sur un élément nommé.

Réussite : seul l'élément désigné évolue ; voisinage, horizon, terrain et projet restent cohérents ; suppression ou remplacement propre, sans reconstruction arbitraire du reste du site.

### TEST-007C — Photo et Revit partiellement incompatibles

Contexte : Retexturation contextualisée, correspondance approximative (non stricte) entre l'angle de la photo et la vue Revit.

Réussite : l'implémentation estime si le mode reste possible malgré l'écart et ne bloque que si l'écart compromet réellement le résultat attendu — contrairement à Photomontage contrôlé (LIB-006 §3), une correspondance de caméra parfaite n'est pas requise dans ce mode.

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

Résultat attendu : aucune bascule automatique vers Photomontage contrôlé en style Administratif sobre ; nouvelle vue ou calibration demandée.

### TEST-108 — Mauvais mode sélectionné

Contexte : usage administratif traité en Retexturation contextualisée.

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

### TEST-123 — Élément verrouillé modifié en retexturation contextualisée

Contexte : élément d'environnement classé `locked` (ex. bâtiment voisin, horizon) transformé sans instruction explicite exceptionnelle.

Résultat attendu : Non conforme ; reprise depuis les sources.

### TEST-124 — Élément modifiable ou harmonisable transformé sans décision validée

Contexte : élément classé `editable` ou `harmonizable` modifié en l'absence de toute décision explicite de l'utilisateur sur cet élément.

Résultat attendu : Non conforme — l'absence de décision équivaut à une conservation par défaut (ARCH-002), jamais à une autorisation implicite.

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
- ARCH-002 — 00_VOCABULAIRE_SYSTEME.md

## Historique

V1.6 — TEST-107 : « aucun photomontage administratif automatique » précisé en « aucune bascule automatique vers Photomontage contrôlé en style Administratif sobre », pour ne jamais confondre mode et style (PRD V2.1, ADR-020).

V1.5 — TEST-007 reclassé sur Retexturation contextualisée (remplace Présentation générative) ; ajout de TEST-007A à 007C (harmonisation, remplacement/suppression `editable`, correspondance photo/Revit non stricte) reprenant les cas de test prioritaires du PRD V2.1 §15. TEST-108 mis à jour. Ajout de TEST-123 et TEST-124 (élément `locked` modifié ; élément `editable`/`harmonizable` transformé sans décision validée). Recalibrage produit V2.1, voir ADR-019.
