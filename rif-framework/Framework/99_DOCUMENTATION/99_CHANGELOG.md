# 99_CHANGELOG.md

ID : DOC-003  
Type : DOC  
Version : V1.9  
Statut : Review  
Niveau : L5  
Dossier : Framework/99_DOCUMENTATION

---

# Journal des versions

## V1.9 — Review — 18 septembre 2026 (Lot 1 RenderTarget)

Correction découverte en implémentant le modèle RenderTarget/OutputType/QualityProfile (ADR-022) — 05_CHECKLIST_CONTROLE.md uniquement.

### Modifications

- correction : la note V1.8 sur les types de sortie citait à tort `isolation` pour « absence d'éléments inventés » ; `isolation` ne désigne que la contamination inter-dossiers ;
- ajout du critère **Éléments inventés** à la grille commune §3 (promu du défaut éliminatoire §5) ;
- ajout du critère **Photoréalisme** à la grille commune §3 ;
- ajout de l'état **Non évalué** (§2, 5ᵉ état — une absence de mesure ne devient jamais Conforme).

### Décisions

Aucune nouvelle ADR — correction documentaire d'ADR-022.

## V1.8 — Review — 18 septembre 2026 (soir, post-RDV Évariste)

Calibrage post-RDV Évariste (ADR-022) : la direction geometry-first (ADR-021) est confirmée, plusieurs besoins produit précisés.

### Modifications

- introduction de l'axe `OutputType` (`PHOTOREALISTIC_PERSPECTIVE` / `PHOTOREALISTIC_AXONOMETRY`), indépendant du mode et du style — 04B_MODES_DE_PRODUCTION.md §1 ;
- 05_CHECKLIST_CONTROLE.md §1 : les critères prioritaires de la grille LIB-002 diffèrent selon le type de sortie contrôlé, aucun critère nouveau ajouté ;
- liste de formats 3D candidats élargie à ceux réellement disponibles chez Évariste (RVT, FBX, DWG, DXF, DGN, OBJ, STL, IFC) — aucun sélectionné ;
- formulation de fidélité officiellement calibrée : « Maximiser la fidélité architecturale et réduire fortement les dérives géométriques » — aucune garantie de 100 % ou de fidélité parfaite ;
- concept `TEMPORARY_PROJECT_ASSETS` introduit au niveau produit (`docs/PRD_RIF_V2_GEOMETRY_FIRST.md` §15) pour le volume de photos terrain — non implémenté ;
- Phase 1 confirmée comme « rendus fiables » ; reconstruction 3D depuis photos classée BACKLOG/R&D (confirmation, pas un nouveau non-objectif) ;
- protocole du prochain cycle de test documenté (comparaison de formats 3D réels, PASS 1-8, gate de sortie).

### Décisions

ADR-022.

## V1.7 — Review — 18 septembre 2026

Introduction du workflow geometry-first (ADR-021) : « RIF fournit l'architecture, l'IA la photoréalise. »

### Modifications

- nouveau rôle de source `model_3d` (maquette numérique 3D du projet, format non figé — RVT candidat principal, IFC/OBJ/FBX recevables) — ARCH-002, REF-001 §2 ;
- hiérarchie d'autorité des sources précisée : `model_3d` → géométrie (en priorité, si réellement extraite) ; vue projet → cadrage intentionnel ; photo réelle → environnement ; axonométrie → contrôle spatial secondaire (REF-001 §2) ;
- nouveaux termes de vocabulaire : extraction géométrique, pack de contraintes géométriques, alignement caméra/photo (ARCH-002) — un fournisseur d'extraction absent doit rester honnêtement non disponible, jamais un résultat simulé ;
- LIB-006 : note geometry-first signalant, sans les résoudre, la tension terminologique entre les trois usages du workflow geometry-first et les trois modes de production existants — aucun mode ajouté, renommé ou réintroduit (question ouverte pour le rendez-vous Évariste) ;
- LIB-002 : quand un pack de contraintes géométriques existe, il devient la référence de comparaison prioritaire pour les critères géométriques ; sans lui, contrôle inchangé depuis la source 2D désignée ;
- aucune règle métier existante retirée ; aucun format 3D ni fournisseur d'extraction choisi officiellement à ce stade.

### Décisions

ADR-021.

## V1.6 — Review — 12 septembre 2026

Harmonisation finale de la nomenclature des styles sur le PRD V2.1 §9 (ADR-020), en préparation de l'implémentation TypeScript.

### Modifications

- style « Photomontage administratif » renommé **Administratif sobre** (`administratif_sobre`) ;
- style « Présentation client » renommé **Présentation naturelle** (`presentation_naturelle`) ;
- Commercial (`commercial`) inchangé ;
- renommage seul, aucune règle de sélection ou de caractéristique modifiée (déjà corrigées en V1.5) ;
- tables de nomenclature officielle ajoutées dans LIB-005 (styles) et LIB-006 (modes), avec rappel explicite de la distinction mode/style ;
- `Exemples/PROJECT_STATE_EXEMPLE.json` refondu sur le cas d'usage Évariste réel (mode `retexturation_contextualisee`, style `presentation_naturelle`, environnement à trois états) ;
- `SHA256SUMS.txt` régénéré.

### Décisions

ADR-020.

### Condition de stabilité

Inchangée par rapport à la V1.5 : validation des cas de test applicables sur des dossiers réels d'Évariste, en particulier Retexturation contextualisée, et approbation du responsable RIF.

## V1.5 — Review — 12 septembre 2026

Recalibrage documentaire complet sur le PRD produit V2.1 (`PRD_RIF_V2.1_Neon_Vercel.md`) — recentrage sur la photoréalisation contrôlée de vues Revit et introduction d'un modèle d'environnement à trois états. Ne couvre que le Framework documentaire ; la stack technique cible du PRD V2.1 (Neon, Vercel Blob) n'est pas traitée par cette version, qui reste un sujet d'implémentation.

### Ajouts

- mode **Retexturation contextualisée**, mode principal du cas standard (vue Revit + axonométrie + photo réelle, sans usage administratif strict) ;
- modèle d'environnement à trois états `locked`/`editable`/`harmonizable`, défini une seule fois dans ARCH-002 et référencé partout ailleurs ;
- critère de contrôle « Silhouette », distinct des Volumes (LIB-002) ;
- branches de collecte conditionnelle §4.5 à §4.7 pour Retexturation contextualisée (ENG-004) ;
- clause de prompt et section ZONES HARMONISABLES pour Retexturation contextualisée (ENG-002) ;
- cas de test TEST-007A à 007C, TEST-123, TEST-124 (LIB-003).

### Modifications

- le mode **Présentation générative est retiré**, remplacé par Retexturation contextualisée (ADR-019) ;
- REF-002 §7 : `locked`/`editable`/`unknown` (non défini) remplacé par `locked`/`editable`/`harmonizable` (ARCH-002) ;
- REF-001 §2 et §6 : la photographie du site n'est plus présumée être systématiquement un canevas figé — elle peut être canevas (Photomontage contrôlé) ou référence de contexte (Retexturation contextualisée) ;
- LIB-005 : correction de la sélection automatique de style, qui orientait tout dépôt de photo vers Photomontage administratif indépendamment de l'usage déclaré ;
- LIB-004 : ajout de la ligne de décision manquante pour le cas standard ;
- ADR-009 restreinte à son périmètre d'origine (Photomontage contrôlé) par ADR-019.

### Décisions

ADR-019.

### Condition de stabilité

La V1.5 devient Stable après exécution des cas de test applicables (LIB-003) sur des dossiers réels d'Évariste couvrant Retexturation contextualisée, et approbation du responsable RIF. Elle hérite de la condition de stabilité non encore levée de la V1.4 (`Tests/PLAN_VALIDATION_V1.4.md`).

## V1.4 — Review — 6 septembre 2026

Consolidation des réunions des 17 juillet, 4 août et 12 août 2026 et des défauts observés en production réelle.

### Ajouts

- rôles de sources étendus et confirmation groupée ;
- annotation convertie en directive localisée ;
- autorité limitée des références matériau ;
- pré-analyse des matériaux avec provenance et confiance ;
- isolation stricte des dossiers et reconstruction depuis un état immuable ;
- variantes multiples, comparaison et sélection d'un résultat canonique ;
- profil d'implémentation séparé pour le lexique et les matériaux usuels ;
- vocabulaire : planche de rive, sous-face, boiseries/menuiseries, coursive, banquette, marches et volets ;
- tests issus des échecs réels : mur inventé, ouvertures déplacées, pool house surdimensionné, soffite blanc, bord de terrasse blanc, calepinage décalé, margelles erronées, annotation conservée, équipement inventé, soleil impossible et contamination inter-dossiers.

### Modifications

- collecte orientée vers les ambiguïtés au lieu d'un interrogatoire exhaustif ;
- contrôle de la lumière renforcé ;
- verdict distinct selon l'usage maintenu pour les écarts mineurs ;
- noms de fichiers considérés comme indices et non comme contrat d'entrée.

### Décisions

ADR-014 à ADR-018.

### Condition de stabilité

La V1.4 devient Stable après exécution du plan de validation, correction des non-conformités bloquantes et approbation du responsable RIF.

## Versions antérieures

- V1.3 Stable — 28 juillet 2026 : collecte conditionnelle ENG-004, priorités matériau et compatibilité mode/style.
- V1.2 Stable — 20 juillet 2026 : modes, canevas fixe, compatibilité caméra et conformité par usage.
- V1.1 Stable — 13 juillet 2026 : première architecture documentaire à cinq niveaux.

