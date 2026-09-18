# Version du Framework

- Version : V1.8
- Statut : Review
- Date : 18 septembre 2026 (soir, post-RDV Évariste)
- Base : V1.7 Review du 18 septembre 2026
- Objet : calibrage post-RDV Évariste — deux types de sortie (perspective/axonométrie), liste de formats 3D candidats élargie, formulation de fidélité calibrée (04B_MODES_DE_PRODUCTION, 05_CHECKLIST_CONTROLE)
- Décisions : ADR-022

## Compatibilité

La V1.8 est additive : elle ajoute un troisième axe (type de sortie, `OutputType`) indépendant du mode et du style, sans ajouter, renommer ni retirer aucun mode de production ni aucun critère de contrôle qualité — seule la priorité entre critères déjà documentés change selon le type de sortie. Aucune règle de fidélité n'est assouplie ; au contraire, la V1.8 rend explicite qu'aucune garantie de 100 % ou de fidélité parfaite n'existe, formulation désormais officielle.

Le format 3D final reste non figé — la liste de candidats à tester s'élargit (RVT, FBX, DWG, DXF, DGN, OBJ, STL, IFC) mais aucun n'est sélectionné. Aucun fournisseur d'extraction géométrique n'est choisi à ce jour.

## Passage Stable

Conditionné à la validation du responsable RIF, au choix effectif d'un format 3D et d'un fournisseur d'extraction (après le prochain cycle de test, PRD Geometry-First §16), et à la réussite du plan de validation applicable au workflow geometry-first (à écrire), en plus des conditions déjà posées pour la V1.6 (Retexturation contextualisée) et la V1.7 (geometry-first).
