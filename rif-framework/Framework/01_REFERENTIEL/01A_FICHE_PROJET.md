# 01A_FICHE_PROJET.md

ID : REF-002  
Type : REF  
Version : V1.5  
Statut : Review  
Niveau : L2  
Dossier : Framework/01_REFERENTIEL

---

# Modèle de données de l'état projet

## 1. Principes

Chaque donnée possède un emplacement unique, peut rester inconnue, indique sa provenance et son niveau de validation, et conserve son historique.

## 2. Métadonnées

- identifiant interne généré automatiquement ;
- nom anonymisé et type de projet libre ;
- phase, usage principal et usages secondaires ;
- révision, dates et responsable de validation ;
- versions du Framework et de l'implémentation.

## 3. Sources

Pour chaque source : identifiant, nom original, nom sécurisé, checksum, version, rôle détecté, rôle confirmé, autorité par domaine, qualité, confidentialité, statut et dossier propriétaire.

Rôles recommandés :

- `revit_view` ;
- `site_photo` ;
- `axonometry` ;
- `annotated_source` ;
- `material_reference` ;
- `existing_building_photo` ;
- `render` ;
- `annotated_render`.

Le nom de fichier aide la détection mais ne constitue jamais une preuve du rôle.

## 4. Qualité et cohérence

- intégrité, définition et lisibilité ;
- bâtiment suffisamment visible, notamment toiture et ouvertures ;
- compatibilité des versions et du projet ;
- compatibilité caméra ;
- contradictions, informations manquantes et niveau de risque.

## 5. Autorité par domaine

Matrice pour géométrie, cadrage, perspective, environnement, matériaux, lumière, végétation, suppressions, ajouts et contrôle secondaire.

## 6. Directives localisées

Pour chaque annotation : source, zone ou masque, action, élément ciblé, consigne, niveau de confiance, confirmation, zones impactées et interdiction de reproduire la marque.

## 7. Géométrie et environnement

Deux familles de données, gouvernées différemment (ARCH-002) :

- **Éléments architecturaux du projet** : volumes, niveaux, toitures, ouvertures, terrasses, bassin, margelles, plages, annexes, implantation, détails critiques. Régis par l'autorité de la source géométrique (REF-001 §2) et par le mode de production (LIB-006) — pas par les trois états ci-dessous.
- **Éléments d'environnement** : terrain, végétation, clôtures, voisinage, accès, horizon, et tout autre composant du contexte réel identifié. Chaque élément d'environnement reçoit exactement un des trois états `locked`, `editable` ou `harmonizable` (ARCH-002).

## 8. Matériaux

Pour chaque élément : nature, finition, teinte, calepinage, source, référence matériau éventuelle, état existant/projeté, niveau de confiance et validation.

## 9. Production

Mode, style, canevas, zones verrouillées, modifiables et harmonisables (ARCH-002), orientation, lumière, format de sortie, nombre de variantes demandé et contraintes spécifiques.

## 10. Historique et sélection

Générations, variantes, corrections, reprises, audits, coûts, décisions, régressions et sélection du résultat canonique. Une nouvelle variante n'écrase jamais les précédentes.

## 11. Validation

Éléments validés, réserves, non-conformités, contrôles en attente et verdict par usage.

## Documents liés

- REF-001 — 01_REFERENTIEL_GENERAL.md
- ARCH-002 — 00_VOCABULAIRE_SYSTEME.md
- LIB-006 — 04B_MODES_DE_PRODUCTION.md

## Historique

V1.5 — §7 : remplace `locked`/`editable`/`unknown` (non défini, jamais harmonisé avec le reste du Framework) par les trois états d'environnement officiels `locked`/`editable`/`harmonizable` (ARCH-002), et distingue explicitement les éléments architecturaux (régis par REF-001/LIB-006) des éléments d'environnement (régis par ces trois états). Recalibrage produit V2.1 — voir ADR-019.

