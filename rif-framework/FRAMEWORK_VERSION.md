# Version du Framework

- Version : V1.9
- Statut : Review
- Date : 18 septembre 2026 (Lot 1 RenderTarget)
- Base : V1.8 Review du 18 septembre 2026
- Objet : correction d'une contradiction découverte en implémentant le modèle RenderTarget/OutputType/QualityProfile décidé par ADR-022 — 05_CHECKLIST_CONTROLE.md uniquement
- Décisions : aucune nouvelle ADR (correction documentaire d'ADR-022, pas une nouvelle décision d'architecture)

## Compatibilité

La V1.9 corrige une erreur de la V1.8 : la note sur les types de sortie citait à tort le critère `isolation` pour « absence d'éléments inventés », alors qu'`isolation` désigne exclusivement la contamination inter-dossiers (inchangé depuis V1.0). Deux critères sont ajoutés à la grille commune LIB-002 §3 pour porter correctement ce que les `QualityProfile` par `OutputType` doivent évaluer : **Éléments inventés** (promu du défaut éliminatoire §5, jamais un critère distinct auparavant) et **Photoréalisme** (nouveau). Un cinquième état de critère, **Non évalué**, est ajouté (§2) — une absence de mesure ne doit jamais devenir Conforme. Aucun mode de production, aucun format 3D, aucun fournisseur n'est ajouté ou choisi par cette version.

## Passage Stable

Conditions inchangées depuis la V1.8 : validation du responsable RIF, choix effectif d'un format 3D et d'un fournisseur d'extraction (après le prochain cycle de test), réussite du plan de validation geometry-first (à écrire).
