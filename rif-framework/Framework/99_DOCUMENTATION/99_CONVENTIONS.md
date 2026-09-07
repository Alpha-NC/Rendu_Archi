# 99_CONVENTIONS.md

ID : DOC-001  
Type : DOC  
Version : V1.4  
Statut : Review  
Niveau : L5  
Dossier : Framework/99_DOCUMENTATION

---

# Gouvernance du Framework

## Principes

Responsabilité unique, source unique de vérité, indépendance technologique, absence de duplication, traçabilité, tests de non-régression et versions publiées.

## Nommage

Format : `NN[_LETTRE]_NOM_DU_MODULE.md`. Les suffixes de copie tels que `(1)` sont interdits dans une publication.

## Métadonnées

Chaque module indique ID, Type, Version, Statut, Niveau et Dossier. Types : `ARCH`, `REF`, `ENGINE`, `LIB`, `DOC`. Statuts : `Draft`, `Review`, `Stable`, `Archived`.

## Cycle

1. Retour d'expérience ou idée dans `Backlog/`.
2. Décision structurante dans une ADR.
3. Rédaction d'une version `Review`.
4. Audit documentaire et tests.
5. Validation humaine.
6. Publication `Stable`.

## Séparation

- Les règles universelles restent dans `Framework/`.
- Les adaptations client, lexiques personnels et contraintes produit restent dans `Implementations/`.
- Les exemples de projet vont dans `Exemples/`.
- Les résultats de tests vont dans `Tests/`.
- Une préférence client peut alimenter une suggestion, jamais modifier silencieusement le référentiel.

## Publication

Une version Stable exige des métadonnées cohérentes, des références valides, un changelog, des ADR à jour, les tests applicables exécutés et un numéro de version uniforme. La V1.4 reste Review jusqu'à validation des tests listés dans `Tests/PLAN_VALIDATION_V1.4.md`.

