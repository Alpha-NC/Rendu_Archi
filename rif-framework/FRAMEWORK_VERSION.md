# Version du Framework

- Version : V1.6
- Statut : Review
- Date : 12 septembre 2026
- Base : V1.5 Review du 12 septembre 2026
- Objet : harmonisation finale de la nomenclature des styles sur le PRD V2.1 §9 (`presentation_naturelle`, `administratif_sobre`, `commercial`) — préparation de l'implémentation TypeScript
- Décisions : ADR-020

## Compatibilité

La V1.6 ne change aucune règle métier par rapport à la V1.5 : renommage de deux styles sur trois (Photomontage administratif → Administratif sobre, Présentation client → Présentation naturelle), Commercial inchangé. Les trois modes (Retexturation Revit, Retexturation contextualisée, Photomontage contrôlé) restent inchangés et ne sont jamais confondus avec les styles.

## Passage Stable

Conditionné à la validation du responsable RIF et à la réussite du plan de validation applicable à Retexturation contextualisée (à écrire, sur le modèle de `Tests/PLAN_VALIDATION_V1.4.md`, dont la validation reste elle-même en attente).
