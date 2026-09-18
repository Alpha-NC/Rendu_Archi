# PRD — RIF V2, workflow geometry-first

**Statut :** Draft — mis à jour le 18 septembre 2026 après le rendez-vous Évariste du même jour (direction confirmée, besoins précisés — voir DECISIONS.md D-21). Complète `RIF APP/PRD_RIF_V2.1_Neon_Vercel.md` (V2.1, 11.09.2026, non modifié, lu comme référence) plutôt que le remplacer : toute section non reprise ici reste celle de la V2.1. Suivi Git — `RIF APP/` reste un dossier non suivi et n'est jamais l'objet de ce document.
**Décision Framework associée :** ADR-021 (`rif-framework/Framework/99_DOCUMENTATION/99_DECISIONS_ARCHITECTURE.md`) — ce PRD applique côté produit ce que l'ADR tranche côté Framework ; il ne le recopie pas intégralement. ADR-022 documente le calibrage post-RDV Évariste (§14-16 ci-dessous).
**Format 3D final : À CONFIRMER.** Formats disponibles chez Évariste, tous candidats à tester, aucun sélectionné : RVT, FBX, DWG, DXF, DGN, OBJ, STL, IFC. RVT reste le candidat principal (environ 40-60 Mo pour un projet type), OBJ et IFC sont à tester sérieusement. Rien dans ce document ni dans le code ne doit présumer `.rvt` exclusivement ni écarter les autres formats avant le prochain cycle de test (§14).
**Formulation officielle de fidélité (à utiliser partout, produit comme technique) :** « Maximiser la fidélité architecturale et réduire fortement les dérives géométriques. » **Aucune garantie de 100 %, de fidélité parfaite ou d'absence totale de dérive géométrique à ce stade** — toute formulation antérieure impliquant une telle garantie est erronée et doit être corrigée partout où elle apparaît dans les documents actifs de ce périmètre (voir DECISIONS.md D-21 pour l'audit des documents legacy hors périmètre, non modifiés).

---

## 0. Principe

RIF V1–V2.1 encadre un moteur d'image qui reconstruit lui-même la géométrie du projet à partir de vues 2D (vue Revit, axonométrie). RIF V2 geometry-first ajoute une source strictement plus précise, quand elle existe : une maquette numérique 3D du projet.

> **RIF fournit l'architecture. L'IA la photoréalise.**

Le moteur d'image ne doit plus être responsable de deviner des volumes, une toiture, une implantation ou des ouvertures quand une source 3D existe et a pu être exploitée. Ce principe **s'ajoute** aux trois modes de production existants (§8 V2.1) et à la hiérarchie des sources existante (§7 V2.1) — il ne les remplace pas.

Ce document ne prétend résoudre aucune inconnue technique (format, fournisseur d'extraction, coût, latence) : il pose le domaine produit et les garde-fous, sur des interfaces d'abstraction, en attendant l'arbitrage avec Évariste (§9).

## 1. Nouvelle entrée utilisateur : source modèle 3D

En complément de la vue Revit perspective, de l'axonométrie et de la photo réelle (§6 V2.1), un quatrième type d'entrée est reconnu : la **source modèle 3D** (`model_3d`).

- **Format :** non figé (RVT candidat principal). Le système accepte tout format déclaré par l'utilisateur au dépôt (extension du fichier) sans validation de contenu métier — la case « format » existe pour que rien ne soit exploité plus tard sans savoir de quoi il s'agit, pas pour restreindre les formats recevables.
- **Volume :** un modèle 3D peut être volumineux (jusqu'à 500 Mo) — dépôt direct navigateur → stockage privé, jamais via une fonction serveur à corps limité (même contrainte que pour les autres sources, §16.1 V2.1).
- **Rôle non ambigu par construction :** contrairement aux images (vue Revit, axonométrie, photo), une source modèle 3D n'a pas besoin de classification automatique de rôle — l'utilisateur la dépose explicitement dans un emplacement dédié.
- **Dépôt ≠ extraction :** le dépôt d'un fichier modèle 3D place le dossier en statut « déposé, extraction non encore lancée ». Il ne déclenche jamais une extraction simulée ou supposée réussie.

## 2. Hiérarchie des sources — évolution de §7 V2.1

§7.1 V2.1 (« Autorité principale : vue Revit perspective ») et §7.2 (« Autorité secondaire : vue axonométrique ») restent valables **en l'absence de source modèle 3D exploitée**. Quand une source modèle 3D existe et a été réellement extraite, la hiérarchie devient :

| Domaine d'autorité | Source faisant foi |
|---|---|
| GÉOMÉTRIE (volumes, niveaux, toiture, ouvertures, implantation, terrasses, piscine, annexes, dimensions, relations spatiales) | Source modèle 3D extraite. À défaut, vue Revit perspective + axonométrie (règle V2.1 inchangée). |
| CADRAGE INTENTIONNEL (caméra, perspective visée) | Vue Revit perspective (vue projet) |
| ENVIRONNEMENT (site, contexte, lumière réelle) | Photographie réelle (§7.3, §7.5 V2.1, inchangé) |
| CONTRÔLE SPATIAL SECONDAIRE | Axonométrie — garde-fou de vérification, jamais canevas principal, avec ou sans source 3D |
| MATÉRIAUX | Inchangé, §7.4 V2.1 |

Une source ne fait autorité que sur son domaine déclaré. La présence d'un fichier modèle 3D non extrait ne change rien à la hiérarchie ci-dessus tant qu'aucune extraction réelle n'a produit de données exploitables (§4).

## 3. Workflow — audit de la machine à états existante

La machine à états de §17 V2.1 (12 états : `BROUILLON → SOURCES_REÇUES → SOURCES_ANALYSÉES → CONTEXTE_À_CONFIRMER → PRÊT_À_GÉNÉRER → GÉNÉRATION_EN_COURS → CONTRÔLE_À_EXAMINER → VALIDÉ | À_CORRIGER | À_REPRENDRE | SUSPENDU | ÉCHEC`) **n'est pas remplacée**. Audit des 10 étapes conceptuelles du workflow geometry-first face à cette machine :

| Étape conceptuelle | État dossier correspondant | Nouveauté |
|---|---|---|
| Collecte sources | `SOURCES_REÇUES` | Source `model_3d` acceptée comme les autres |
| Validation sources | `SOURCES_ANALYSÉES` | Inchangé |
| Extraction géométrique | reste `SOURCES_ANALYSÉES` ou `CONTEXTE_À_CONFIRMER` | Suivie par `ProjectState.modele3D.extractionStatus`, **pas** un nouvel état dossier |
| Alignement/calibration caméra-photo | idem | Suivie par `ProjectState.alignment.status`, **pas** un nouvel état dossier |
| Génération du pack de contraintes | idem | Suivie par `ProjectState.geometryPack`, **pas** un nouvel état dossier |
| Prêt pour génération | `PRÊT_À_GÉNÉRER` | Inchangé — reste une action humaine (bouton de confirmation de fiche), jamais une transition automatique |
| Génération | `GÉNÉRATION_EN_COURS` | Le prompt technique devient geometry-pack-aware quand le pack existe (§6) |
| Contrôle qualité | `CONTRÔLE_À_EXAMINER` | Grille et priorités étendues (§7) |
| Correction ou reprise | `À_CORRIGER` / `À_REPRENDRE` | Catégories de correction geometry-safe (§8) |
| Validation humaine | `VALIDÉ` | Inchangé |

**Conclusion de l'audit :** aucun nouvel état dossier n'est nécessaire. L'extraction géométrique, l'alignement et la constitution du pack de contraintes sont des sous-processus qui progressent *à l'intérieur* des états existants, exposés par des champs dédiés du `ProjectState` (§5) — pas par une machine à états parallèle. Une machine à états séparée serait une duplication non justifiée (cf. non-objectif §25 V2.1 assimilé : ne pas complexifier ce qu'une extension de champ peut exprimer).

## 4. Extraction géométrique — abstraction agnostique du fournisseur

Aucun fournisseur d'extraction géométrique n'est choisi à ce stade (Autodesk Model Derivative, Revit Automation, un parseur IFC, ou une autre solution — tous restent des candidats non tranchés). Le système expose une abstraction (`GeometryExtractor`) indépendante de ce choix :

- **Statuts honnêtes** : `UPLOADED`, `VALIDATING`, `READY_FOR_EXTRACTION`, `EXTRACTING`, `EXTRACTED`, `FAILED`, `UNSUPPORTED`. Un dossier ne peut jamais afficher `EXTRACTED` sans qu'un fournisseur réel ait produit le résultat.
- **Sans fournisseur configuré** : le système répond explicitement « extraction non disponible » (`EXTRACTION_PROVIDER_NOT_CONFIGURED`) — jamais un résultat géométrique deviné ou approximé à sa place, jamais une fausse progression affichée à l'utilisateur.
- **Échec réel d'extraction** (`FAILED`) : le dossier continue à fonctionner en mode dégradé (§6) — un modèle 3D non extractible ne bloque pas le dossier, il prive seulement le pipeline de son autorité géométrique renforcée.

## 5. Pack de contraintes géométriques

Schéma versionné (`schemaVersion`), rattaché à la source modèle 3D dont il est extrait. Rempli **progressivement** : un champ absent reste absent tant que l'extraction ne l'a pas produit — jamais une valeur inventée par défaut.

Champs prévus (liste ouverte, à affiner avec un fournisseur réel) : métadonnées de la source, système de coordonnées, limites du modèle, niveaux, volumes, toitures, ouvertures, dalles/terrasses, piscines, annexes, implantation site, données caméra, silhouette projetée, masques, carte de profondeur, segmentation sémantique, zones verrouillées/éditables.

Les artefacts dérivés (`geometry.json`, `camera.json`, masques et cartes image) sont des fichiers privés rattachés au dossier, comme les sources et les rendus (§16.4 V2.1) — jamais supposés exister avant qu'un extracteur réel les ait produits.

## 6. Alignement caméra/photo

Quand une photographie réelle et une source géométrique 3D coexistent, une tentative de mise en correspondance caméra peut réussir, échouer, ou rester incertaine :

- `NOT_STARTED`, `PROCESSING`, `ALIGNED`, `REVIEW_REQUIRED`, `FAILED`.
- Sous un seuil de confiance, l'état est `REVIEW_REQUIRED` — une validation humaine est demandée explicitement, jamais une calibration mathématique présentée comme fiable sans base réelle. Ce principe prolonge celui déjà appliqué à `camera_compatibility` (§10.3/§17 V2.1).

## 7. Génération — pipeline geometry-aware

Le pipeline de génération (§11.5 V2.1) reçoit, en plus des éléments déjà listés, le pack de contraintes géométriques et le statut d'alignement quand ils existent. Formalisation attendue du prompt technique :

- l'architecture (volumes, toiture, ouvertures, implantation) vient du pack de contraintes quand il existe ;
- l'environnement vient de la photo réelle (inchangé, §7.3/§7.5 V2.1) ;
- l'axonométrie résout les ambiguïtés spatiales résiduelles (inchangé) ;
- la vue projet fournit le cadrage intentionnel visé ;
- le moteur d'image photoréalise, il ne re-conçoit jamais l'architecture.

**Sans pack de contraintes** (aucune source 3D, ou extraction non disponible/échouée) : le pipeline continue de fonctionner selon les règles V2.1 existantes (vue Revit + axonométrie comme autorité géométrique, §7.1-7.2 V2.1) — jamais présenté à l'utilisateur comme « verrouillé géométriquement » par erreur. Ce mode reste le mode par défaut tant qu'aucune extraction n'a réussi ; ce n'est pas un mode dégradé honteux, c'est le mode V2.1 normal.

## 8. Modes de production — tension terminologique non tranchée

Le workflow geometry-first distingue conceptuellement trois usages (retexturation fidèle à la vue projet, insertion dans un site réel, présentation à liberté visuelle assumée) proches des trois modes de production existants (§8 V2.1 : Retexturation Revit, Retexturation contextualisée — mode principal —, Photomontage contrôlé) sans leur être identiques.

**Ce document ne renomme, n'ajoute ni ne réintroduit aucun mode.** En particulier, l'usage « présentation à liberté visuelle assumée » évoque le mode « Présentation générative », retiré du Framework par ADR-019 avec un motif documenté et récent (aucun dossier réel en production, absence de modèle d'environnement qualifié). Le réintroduire sur la seule base de ce document romprait une décision produit délibérée sans validation d'Évariste. **Cette correspondance reste une question ouverte (§9).**

Une source `model_3d` extraite renforce l'autorité géométrique des trois modes existants sans changer leur périmètre respectif ni leurs zones verrouillées/modifiables/harmonisables (§8, §12 V2.1).

## 9. Contrôle qualité — priorité géométrique quand un pack existe

§13.1 V2.1 (objectifs absolus : caméra, cadrage, perspective, silhouette, volumes, toiture, ouvertures, implantation) reste la grille de référence. Évolution : **quand un pack de contraintes géométriques existe**, il devient la référence de comparaison prioritaire pour ces critères — plus précis qu'une comparaison visuelle contre une vue 2D. En son absence, le contrôle reste inchangé (comparaison contre la vue Revit et l'axonométrie, comme en V2.1).

Le contrôle multimodal (Claude, cf. `docs/decision-llm-multimodal.md`) reste la méthode d'évaluation practicable aujourd'hui — il ne doit pas devenir la seule autorité future sur la conformité géométrique quand des données structurées existent pour trancher plus précisément.

Catégorisation par domaine (GÉOMÉTRIE / ENVIRONNEMENT / MATÉRIAUX / PRÉSENTATION), pour un rapport plus lisible qu'une liste plate de critères : reste une évolution du **rapport** de contrôle (§13.4/§15 V2.1), pas des critères eux-mêmes.

## 10. Corrections — préserver la géométrie verrouillée

Une correction localisée (§11.7 V2.1) ne doit jamais relancer automatiquement tout le pipeline ni rouvrir la géométrie déjà verrouillée. Catégories de correction reconnues, toutes conservant les contraintes géométriques en vigueur : matériau, lumière, végétation, environnement local, retrait d'artefact, présentation mineure. Une modification architecturale réelle (volume, toiture, ouverture, implantation) exige une nouvelle source géométrique ou une directive explicitement autorisée par l'utilisateur — jamais une correction silencieuse.

## 11. Compatibilité avec le hors périmètre V2 (§19 V2.1)

Le workflow geometry-first ne contredit aucun des non-objectifs déjà posés : il ne s'agit ni de reconstruction 3D automatique du site (§19 V2.1, toujours hors périmètre — le modèle 3D est **fourni par l'architecte**, jamais déduit automatiquement d'une photo), ni de modification de la géométrie Revit par IA (toujours hors périmètre — l'extraction *lit* la géométrie, elle ne la modifie jamais), ni d'une garantie métrologique ou BIM du rendu généré (toujours hors périmètre — un rendu photoréaliste reste une image, pas un livrable BIM).

## 12. Limitations actuelles, à dire honnêtement dans l'interface

- Sans fournisseur d'extraction configuré, tout dossier avec une source modèle 3D reste en mode V2.1 standard (§7) — l'interface doit l'indiquer clairement, jamais une fausse promesse de verrouillage géométrique.
- Aucune extraction réelle n'a été testée contre un fournisseur réel à la date de ce document.
- Le format 3D définitif n'est pas choisi (RVT candidat principal).

## 13. Éléments à confirmer avec Évariste (ne pas trancher depuis le code)

- Format 3D final (RVT vs IFC/OBJ/FBX).
- Fournisseur d'extraction géométrique (Autodesk Model Derivative, Revit Automation, parseur IFC, autre).
- Modèle de coût et de latence réels de l'extraction.
- Version de Revit requise, le cas échéant.
- Correspondance exacte entre les trois usages geometry-first et les trois `ModeProduction` existants (§8).

## 14. Deux types de sortie (`OutputType`) — confirmé RDV Évariste 18.09.2026

Le prototype GPT V1 s'est avéré insuffisant en particulier sur : toitures, faîtages, pans de toiture, volumes, ouvertures, escaliers/éléments inventés, piscine/terrasse, implantation, perspective. Le calibrage post-RDV introduit un axe **indépendant** du mode de production (§8) et du style (LIB-005) : le type de sortie visé.

```
OutputType = PHOTOREALISTIC_PERSPECTIVE | PHOTOREALISTIC_AXONOMETRY
```

Les deux partagent le même `GeometryConstraintPack` (§5) — ce n'est pas un second pipeline d'extraction, seulement un second **usage** du même pack, avec un cadrage et une grille de contrôle qualité différents. **Ne pas les traiter comme le même cas d'usage.**

| | `PHOTOREALISTIC_PERSPECTIVE` | `PHOTOREALISTIC_AXONOMETRY` |
|---|---|---|
| Canevas | Vue projet (cadrage intentionnel, §2) | Axonométrie (devient un canevas principal pour ce type de sortie — pas seulement un contrôle spatial secondaire, §2) |
| Critères prioritaires (grille LIB-002 existante, §3 du document LIB-002 — aucun critère nouveau inventé) | `implantation`, `cadrage`, `perspective`, `volumes`, `ouvertures`, `toiture`, `environnement` (conservation de l'existant), `isolation` (absence d'éléments inventés) | `toiture` (faîtages, pans), `volumes`, `terrain`/`environnement` (cohérence spatiale, relations entre bâtiments), `isolation` (absence d'éléments inventés), lisibilité générale |
| Environnement réel | Attendu (photo réelle, insertion site) | Non pertinent la plupart du temps — l'axonométrie n'insère pas dans un site photographié |
| Photoréalisme | Objectif plein | Objectif secondaire — « qualité visuelle suffisante », pas un photomontage |

Ce document ne fige pas le détail d'implémentation (pas de nouveau champ `ProjectState` ni de nouvelle route décrits ici) — seulement le concept produit et son rattachement à la grille LIB-002 existante, pour que le prochain cycle de test (§16) sache quoi comparer. Voir `rif-framework/Framework/03_REFERENCES/05_CHECKLIST_CONTROLE.md` (note geometry-first) pour le rattachement Framework.

## 15. Stockage temporaire de photos terrain (`TEMPORARY_PROJECT_ASSETS`)

Confirmé RDV Évariste : un projet peut inclure 40 à 50 photos de terrain, 8 à 10 Mo chacune — un volume que le modèle de source actuel (un rôle `site_photo` unique faisant autorité environnementale, §2) ne couvre pas conceptuellement. Ces photos servent à la **compréhension** des façades, volumes et environnement par le modèle multimodal — elles ne sont pas individuellement une source faisant autorité au sens de §2/§3.

Concept introduit, **non implémenté dans ce document** : `TEMPORARY_PROJECT_ASSETS`, un ensemble de fichiers rattachés à un dossier actif, distinct des 4 sources structurantes (modèle 3D, vue projet, photo réelle, axonométrie). Caractéristiques envisagées :
- rétention 3 à 6 mois envisagée — **aucune suppression automatique n'est implémentée** ; toute politique de rétention réelle exige une décision explicite ultérieure (ne pas coder de purge automatique sans validation).
- usage : aide à la compréhension multimodale du projet actif, jamais une autorité géométrique ou environnementale de premier plan (celle-ci reste sur `site_photo`/`model_3d` selon §3).
- ne remplace pas le rôle `existing_building_photo`/`site_photo` déjà défini dans `RoleSource` — vient en complément, à un statut d'autorité plus faible, pour un volume de fichiers que les rôles structurants ne sont pas conçus pour absorber.

## 16. Protocole du prochain cycle de test (formats 3D réels)

Confirmé RDV Évariste — préparation du protocole uniquement, **aucun test lancé, aucun format ni fournisseur choisi par ce document**.

**Jeu de test attendu d'Évariste :** un modèle 3D, une vue projet, une photo réelle, une axonométrie — idéalement plusieurs exports du même modèle dans des formats différents (parmi RVT/FBX/DWG/DXF/DGN/OBJ/STL/IFC), pour permettre une comparaison à géométrie constante.

**Axes de comparaison entre formats :** fidélité géométrique, données conservées, facilité d'export, poids du fichier, facilité d'extraction, stabilité, coût potentiel, latence potentielle.

**PASS 1** — Ingestion du jeu de test.
**PASS 2** — Comparaison des formats 3D sur les axes ci-dessus.
**PASS 3** — Sélection d'un candidat **expérimental** (pas une décision définitive de format).
**PASS 4** — Construction d'un `GeometryConstraintPack` réel à partir de ce candidat.
**PASS 5** — Test `PHOTOREALISTIC_PERSPECTIVE` (§14).
**PASS 6** — Test `PHOTOREALISTIC_AXONOMETRY` (§14).
**PASS 7** — Comparaison avec les anciens résultats du prototype GPT V1 (§0).
**PASS 8** — Restitution : fidélité, limites, poids, temps, coûts, recommandation — **jamais une conclusion positive présentée sans les limites qui l'accompagnent**.

**Gate de sortie du cycle** (seul critère de succès reconnu) : *« la géométrie est nettement plus stable que le prototype GPT sur la perspective ET l'axonométrie, sans perdre une qualité photoréaliste suffisante. »* Un résultat qui n'améliore qu'un seul des deux types de sortie ne satisfait pas ce critère.

## 17. Phase 1 — périmètre confirmé

**Phase 1 = rendus fiables.** Hors Phase 1 (backlog, non planifié) : calculateur de surfaces, faisabilité réglementaire/PLU, notice paysagère. La **reconstruction 3D automatique depuis des photos** (déduire une géométrie 3D sans maquette fournie) est explicitement classée **BACKLOG / R&D** — elle ne contredit pas le non-objectif déjà posé au §19 V2.1 (« reconstruction 3D automatique complète du site »), elle le confirme et le documente comme intentionnellement écarté de Phase 1, pas oublié.

## 18. Besoins produit confirmés (RDV Évariste) — état réel

| Besoin | État réel à ce jour |
|---|---|
| Fiche projet persistante | Fait — `ProjectState` en base, révisions immuables |
| Sources persistantes | Fait |
| Rendus, variantes, historique | Fait — `GET .../generations`, une variante par appel (D-10 toujours ouverte sur une limite/pluralité) |
| Corrections ciblées | Fait, catégories geometry-safe (ADR-021) |
| Comparaison | Backend fait (`GET .../generations/comparer`), UI non branchée (gap connu, `RIF_BACKEND_CONTRACTS_V2.md` §17) |
| Validation finale | Fait — verdict humain, garde-fou d'export |
| Bibliothèque matériaux progressive | UI d'accueil existe (état vide honnête), pas de backend de bibliothèque progressive |
| Remplacement des sources | **Non implémenté** — seule `PATCH .../sources/[fileId]` (confirmation de rôle) existe, aucune route de suppression/remplacement d'une source déjà déposée |
| Quota de crédits souple | **Non implémenté**, aucun système de facturation/quota dans ce dépôt |

## Historique

- 18.09.2026 (soir, post-RDV Évariste) — Ajout §14-18 : deux `OutputType` (perspective/axonométrie, critères LIB-002 existants répartis, aucun critère inventé), `TEMPORARY_PROJECT_ASSETS` (concept, non implémenté), liste de formats élargie (RVT/FBX/DWG/DXF/DGN/OBJ/STL/IFC), protocole du prochain cycle de test (PASS 1-8 + gate de sortie), périmètre Phase 1 confirmé (reconstruction 3D depuis photos = BACKLOG/R&D), état réel des besoins produit confirmés. Formulation de fidélité officiellement calibrée. Voir ADR-022 et D-21.
- 18.09.2026 — Création. Complète la V2.1 (`RIF APP/PRD_RIF_V2.1_Neon_Vercel.md`, non modifiée) pour le workflow geometry-first. Voir ADR-021 (Framework) et D-20 (`Implementations/RIF-App/DECISIONS.md`) pour les décisions associées.
