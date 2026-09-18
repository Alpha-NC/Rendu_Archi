# Version du Framework

- Version : V1.7
- Statut : Review
- Date : 18 septembre 2026
- Base : V1.6 Review du 12 septembre 2026
- Objet : introduction du workflow geometry-first — source modèle 3D, extraction géométrique, pack de contraintes, alignement caméra/photo, hiérarchie d'autorité des sources étendue (REF-001, ARCH-002, LIB-006, LIB-002)
- Décisions : ADR-021

## Compatibilité

La V1.7 est additive : elle ajoute un rôle de source (`model_3d`), un domaine de vocabulaire (extraction, pack de contraintes, alignement) et une précision de la hiérarchie d'autorité des sources (REF-001 §2). Aucune règle existante n'est retirée, aucun mode de production n'est ajouté, renommé ou réintroduit. La correspondance entre les trois usages du workflow geometry-first et les trois modes de production existants reste une question produit ouverte (LIB-006 §1, ADR-021 point 7), non tranchée par cette version.

Le format 3D final n'est pas figé (RVT candidat principal) et aucun fournisseur d'extraction géométrique n'est choisi à ce jour — ADR-021 documente explicitement ces éléments comme en attente du rendez-vous avec Évariste.

## Passage Stable

Conditionné à la validation du responsable RIF, au choix effectif d'un format 3D et d'un fournisseur d'extraction, et à la réussite du plan de validation applicable au workflow geometry-first (à écrire), en plus des conditions déjà posées pour la V1.6 (Retexturation contextualisée).
