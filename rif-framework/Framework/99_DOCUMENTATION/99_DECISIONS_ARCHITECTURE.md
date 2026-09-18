# 99_DECISIONS_ARCHITECTURE.md

ID : DOC-002  
Type : DOC  
Version : V1.6  
Statut : Review  
Niveau : L5  
Dossier : Framework/99_DOCUMENTATION

---

# Registre des décisions d'architecture

## Décisions V1.1 à V1.3 conservées

ADR-001 Indépendance des moteurs ; ADR-002 Responsabilité unique ; ADR-003 Source unique de vérité ; ADR-004 Architecture en cinq niveaux ; ADR-005 Cycle de vie commun ; ADR-006 Évolutions par Backlog ; ADR-007 Une question par module ; ADR-008 Séparation mode/style ; ADR-009 Photographie comme canevas fixe ; ADR-010 Compatibilité caméra ; ADR-011 Conformité selon l'usage ; ADR-012 Priorité des données matériau validées ; ADR-013 Compatibilité mode/style et ENG-004. Statut : Accepted.

## ADR-014 — Autorité limitée des références matériau

**Statut :** Accepted  
**Date :** 6 septembre 2026

**Contexte :** une photographie de matériau peut entraîner une reconstruction indue de la composition ou de la géométrie.

**Décision :** une référence matériau ne fait autorité que sur l'apparence de l'élément ciblé. Elle ne transmet ni géométrie, ni caméra, ni environnement.

**Conséquences :** mise à jour de REF-001, REF-002, ENG-001, ENG-002, LIB-001, LIB-002 et LIB-003.

## ADR-015 — Annotation comme directive, jamais comme contenu

**Statut :** Accepted  
**Date :** 6 septembre 2026

**Contexte :** les annotations sont utiles pour localiser une correction mais peuvent être reproduites dans le rendu ou interprétées de façon ambiguë.

**Décision :** toute annotation est convertie en directive localisée structurée. Son sens ambigu doit être confirmé et ses marques sont interdites dans la sortie.

**Conséquences :** ajout du modèle de directive localisée et de tests dédiés.

## ADR-016 — Isolation des dossiers et générations reproductibles

**Statut :** Accepted  
**Date :** 6 septembre 2026

**Contexte :** une tentative ratée dans une même session a été soupçonnée d'influencer une génération ultérieure.

**Décision :** chaque génération est reconstruite depuis une révision immuable de l'état projet et les seules sources du dossier. Aucun contexte implicite n'est autorisé.

**Conséquences :** exigences d'isolation, historique de variantes et test de contamination croisée.

## ADR-017 — Profil client séparé du Framework

**Statut :** Accepted  
**Date :** 6 septembre 2026

**Contexte :** certains matériaux, mots et habitudes sont propres à Évariste ou à sa région.

**Décision :** ces éléments sont stockés dans un profil d'implémentation. Ils servent de suggestions confirmables et ne deviennent pas des règles universelles.

## ADR-018 — Pré-analyse puis collecte ciblée

**Statut :** Accepted  
**Date :** 6 septembre 2026

**Contexte :** une collecte exhaustive dégrade l'expérience alors que les sources permettent souvent d'identifier les matériaux et contraintes usuels.

**Décision :** pré-analyser, pré-remplir avec provenance et confiance, puis demander uniquement les inconnues, ambiguïtés, contradictions et validations obligatoires.

## ADR-019 — Recalibrage produit V2.1 : Retexturation contextualisée et modèle d'environnement à trois états

**Statut :** Accepted  
**Date :** 12 septembre 2026

**Contexte :** le PRD produit passe en V2.1 (`PRD_RIF_V2.1_Neon_Vercel.md`). Le cas réel le plus fréquent d'Évariste — vue Revit + axonométrie + photo réelle, sans usage documentaire strict — n'était couvert par aucune règle explicite du Framework V1.4 : ni LIB-006 (aucun mode ne correspond), ni ENG-004 (aucune branche de collecte), ni LIB-004 (aucune ligne de décision), ni LIB-005 (la sélection automatique orientait ce cas vers le style Photomontage administratif par la seule présence d'une photo, indépendamment de l'usage). Le mode « Présentation générative » existant s'en rapprochait par l'esprit (liberté visuelle contrôlée) mais sans modèle d'environnement qualifié : son « harmonisation dans les limites validées » n'était définie nulle part avec la précision qu'exige désormais le PRD.

**Décision :**
1. Un nouveau mode, **Retexturation contextualisée**, devient le mode principal du cas standard : vue Revit perspective = canevas (caméra, cadrage, perspective, silhouette, volumes, ouvertures, toiture, implantation) ; axonométrie = garde-fou structurel ; photographie réelle = référence de contexte, jamais canevas dans ce mode.
2. Le mode **Présentation générative est retiré**, remplacé par Retexturation contextualisée — conformément au PRD V2.1 §8 (« RIF V2 distingue trois modes »). Retexturation Revit et Photomontage contrôlé restent inchangés dans leur périmètre respectif.
3. Chaque élément d'environnement identifié reçoit exactement un des trois états définis dans ARCH-002 : `locked` (doit rester cohérent avec le réel), `editable` (remplaçable/supprimable/transformable sur décision explicite), `harmonizable` (amélioration visuelle sans changer l'identité générale du site). Ce modèle ne s'applique jamais aux éléments architecturaux du projet, régis par ailleurs (REF-001, LIB-006).
4. ADR-009 (Photographie comme canevas fixe) est **restreinte à son périmètre d'origine** : elle continue de s'appliquer intégralement à Photomontage contrôlé ; elle ne s'applique plus à Retexturation contextualisée, où la vue Revit est le canevas et la photographie une référence de contexte.

**Conséquences documentaires :** ARCH-002, REF-001, REF-002, LIB-006, ENG-004, ENG-001, ENG-002, ENG-003, LIB-002, LIB-003, LIB-004, LIB-005 mis à jour (voir Historique de chacun). FRAMEWORK_VERSION.md et 99_CHANGELOG.md portés en V1.5.

**Conséquences prévisibles côté implémentation (hors périmètre de cette décision documentaire, à traiter séparément) :** `lib/rif/project-state.ts` (`ModeProduction`, matrice `contraintes_libertes`), `lib/rif/modes-styles.ts`, `lib/rif/collecte-conditionnelle.ts`, `lib/rif/prompt-technique.ts`, `lib/rif/contraintes-libertes.ts`, `lib/rif/controle-qualite.ts` (critère Silhouette). Voir `Implementations/RIF-App/DECISIONS.md` pour le suivi de cette adaptation côté code, non entamée à la date de cet ADR.

## ADR-020 — Harmonisation de la nomenclature des styles sur le PRD V2.1

**Statut :** Accepted  
**Date :** 12 septembre 2026

**Contexte :** ADR-019 a introduit le mode Retexturation contextualisée sans toucher au nom des styles (LIB-005), qui restaient « Photomontage administratif » et « Présentation client ». Le PRD V2.1 §9 nomme ces mêmes styles différemment : « Administratif sobre » et « Présentation naturelle ». Le PRD étant désormais la source de vérité produit, ce décalage de vocabulaire devient une incohérence à trancher, pas une simple variante acceptable.

**Décision :** les trois styles officiels du Framework deviennent :

| Style | Identifiant |
|---|---|
| Présentation naturelle | `presentation_naturelle` |
| Administratif sobre | `administratif_sobre` |
| Commercial | `commercial` |

Renommage seul — aucune règle, caractéristique ou condition de sélection des styles n'est modifiée par cette décision (voir ADR-019 pour la correction de la règle de sélection automatique elle-même). Les modes de production ne sont pas concernés : `retexturation_revit`, `retexturation_contextualisee`, `photomontage_controle` restent des modes, jamais des styles — en particulier, Photomontage contrôlé (mode) et Administratif sobre (style) restent deux notions distinctes fréquemment combinées, jamais interchangeables (ADR-008).

**Conséquences documentaires :** LIB-005, LIB-006, ENG-004, LIB-004, LIB-003 mis à jour (voir Historique de chacun). Les entrées d'Historique antérieures à cette décision, dans tous les documents, conservent sciemment les anciens noms : elles décrivent un état passé et ne sont jamais réécrites rétroactivement (traçabilité, 99_CONVENTIONS.md).

**Conséquences prévisibles côté implémentation (hors périmètre, à traiter séparément) :** `lib/rif/project-state.ts` (`StyleRendu`), `lib/rif/modes-styles.ts`, `lib/rif/prompt-technique.ts`, `lib/rif/collecte-conditionnelle.ts`, `lib/rif/controle-qualite.ts` si des libellés de style y sont cités. Le champ `ProjectState.usage` (`presentation_client` | `insertion_administrative`) n'est pas concerné : c'est un axe distinct (usage déclaré), qui partage aujourd'hui par coïncidence une valeur textuelle avec l'ancien nom de style — à ne pas renommer par réflexe lors de l'implémentation.

## ADR-021 — Workflow Geometry-First : la source géométrique 3D fait autorité sur l'architecture

**Statut :** Accepted  
**Date :** 18 septembre 2026

**Contexte :** jusqu'ici, le moteur d'image reconstruit lui-même la géométrie du projet à partir de vues 2D (vue Revit, axonométrie) et de texte — le Framework encadre cette reconstruction (canevas, contraintes, garde-fous) mais ne l'élimine jamais. Évariste dispose par ailleurs, pour la plupart de ses dossiers, d'une maquette numérique 3D du projet (Revit ou équivalent) — une source strictement plus précise que toute vue 2D dérivée. Le principe produit se retourne : **RIF fournit l'architecture, l'IA la photoréalise.** Le moteur d'image ne doit plus être responsable de deviner des volumes, une toiture, une implantation ou des ouvertures quand une source géométrique 3D existe et a pu être exploitée.

Cette décision ne remplace aucun des trois modes de production (ADR-019) ni leur périmètre respectif : elle ajoute une source d'autorité géométrique, disponible en amont, quand le dossier en fournit une.

**Décision :**
1. **Hiérarchie d'autorité par rôle de source** (formalise et étend REF-001) : la source modèle 3D fait autorité sur la GÉOMÉTRIE (volumes, niveaux, toiture, ouvertures, implantation, terrasses, piscine, annexes, dimensions, relations spatiales) ; la vue projet/vue Revit fait autorité sur le CADRAGE INTENTIONNEL (caméra, perspective visée) ; la photographie réelle fait autorité sur l'ENVIRONNEMENT (site, contexte, lumière réelle) ; l'axonométrie reste un CONTRÔLE SPATIAL SECONDAIRE (garde-fou de vérification, jamais canevas principal). Une source ne fait autorité que sur son domaine déclaré — elle n'en acquiert aucun autre par défaut.
2. **Nouveau rôle de source, `model_3d`** : un fichier de maquette numérique 3D, de format volontairement non figé. Le RVT (Revit) est le candidat principal envisagé, mais le Framework ne prescrit aucun format fermé — IFC, OBJ, FBX ou un autre format restent recevables. Aucune règle documentaire ni aucune implémentation ne doit coder en dur une dépendance exclusive au `.rvt`.
3. **Extraction géométrique, traitement explicite en attente d'un fournisseur** : la présence d'une source `model_3d` ne vaut jamais extraction réussie. Tant qu'aucun fournisseur d'extraction n'est choisi et configuré, le dossier reste honnêtement dans un état « extraction non disponible » — jamais un résultat géométrique simulé ou deviné à sa place. Le choix du fournisseur (Autodesk Model Derivative, Revit Automation, un parseur IFC, ou une autre solution), son coût et sa latence réels restent **non tranchés à ce jour** et attendent le rendez-vous avec Évariste.
4. **Pack de contraintes géométriques, schéma versionné** : les données extraites (limites du modèle, niveaux, volumes, toitures, ouvertures, dalles/terrasses, piscines, annexes, implantation site, données caméra, silhouette projetée, masques, carte de profondeur, segmentation sémantique, zones verrouillées/éditables) se remplissent progressivement, jamais par anticipation — un champ absent reste absent, il n'est jamais complété par une valeur inventée.
5. **Alignement caméra/photo** : quand une photographie réelle et une source géométrique coexistent, une tentative de calibration automatique peut échouer ou rester incertaine ; dans ce cas, une validation humaine est demandée explicitement — jamais une calibration mathématique présentée comme fiable sans base réelle.
6. **Géométrie verrouillée par défaut** : dans le prolongement du principe déjà posé pour `contraintes_libertes` (§24A, « la liberté créative n'est jamais implicite »), la géométrie issue d'une source `model_3d` reste verrouillée par défaut ; seule une instruction explicite de l'utilisateur, et seulement quand le mode de production le permet, peut en libérer une partie.
7. **Tension terminologique ouverte, non tranchée par cet ADR** : le principe geometry-first distingue conceptuellement trois usages (retexturation fidèle à la vue projet, photomontage inséré dans un site réel, présentation à liberté visuelle assumée), une distinction proche mais pas identique aux trois `ModeProduction` actuels (`retexturation_revit`, `retexturation_contextualisee`, `photomontage_controle` — ADR-019). En particulier, le troisième usage se rapproche du mode « Présentation générative » retiré par ADR-019 §2 pour absence de dossier réel et de modèle d'environnement qualifié. Cet ADR **ne réintroduit pas** ce mode et **ne renomme aucun** des trois `ModeProduction` existants : la correspondance exacte entre les usages geometry-first et les modes de production reste une question produit ouverte, à trancher avec Évariste avant toute évolution du type `ModeProduction`.

**Conséquences documentaires :** REF-001 (hiérarchie des sources), 00_VOCABULAIRE_SYSTEME.md (rôle `model_3d`, pack de contraintes géométriques), 04B_MODES_DE_PRODUCTION.md (renvoi vers cet ADR pour la tension terminologique du point 7, aucun mode ajouté ni renommé), 05_CHECKLIST_CONTROLE.md (priorité de contrôle géométrique quand un pack de contraintes existe) mis à jour (voir Historique de chacun).

**Conséquences prévisibles côté implémentation (hors périmètre, à traiter séparément) :** `lib/rif/geometrie-3d.ts` (nouveau — domaine complet : autorités, `SourceModele3D`, `GeometryConstraintPack`, `AlignementCameraPhoto`, abstraction `GeometryExtractor`), `lib/rif/project-state.ts` (rôle `model_3d`, champs optionnels `modele3D`/`geometryPack`/`alignment`), `lib/storage/contraintes-modele-3d.ts`, routes `app/api/dossiers/[dossierId]/modele-3d/*`. Voir `Implementations/RIF-App/DECISIONS.md` pour le détail de cette implémentation et les décisions d'architecture associées (aucune migration de base de données requise : ces champs vivent dans la colonne JSONB `project_state` existante).

**Éléments encore inconnus, à confirmer avec Évariste avant tout engagement fournisseur :** format 3D définitif (RVT vs IFC/OBJ/FBX — RVT candidat principal, non figé) ; fournisseur d'extraction géométrique (aucun choisi, aucun présumé) ; modèle de coût et de latence réels de l'extraction ; version de Revit requise le cas échéant ; correspondance exacte entre les usages geometry-first et les `ModeProduction` existants (point 7 ci-dessus).

## ADR-022 — Calibrage post-RDV Évariste : deux types de sortie, formats candidats élargis, formulation de fidélité

**Statut :** Accepted  
**Date :** 18 septembre 2026

**Contexte :** la visio Évariste du 18 septembre 2026 confirme la direction geometry-first (ADR-021) et précise plusieurs points restés ouverts ou implicites : le prototype GPT V1 est explicitement jugé insuffisant sur toitures/faîtages/pans/volumes/ouvertures/escaliers-éléments inventés/piscine-terrasse/implantation/perspective ; deux usages de rendu, jusqu'ici non distingués, appellent des critères de contrôle différents ; le volume réel de photos terrain (40 à 50, 8 à 10 Mo chacune) dépasse ce que le modèle de source actuel absorbe proprement ; la liste de formats 3D réellement disponibles chez Évariste est plus large que les seuls candidats cités jusqu'ici ; certaines formulations de fidélité, si elles apparaissaient, seraient trompeuses et doivent être évitées explicitement. Cette décision ne revient sur aucun choix d'ADR-021 — elle le précise et le calibre.

**Décision :**
1. **Deux types de sortie (`OutputType`), axe indépendant du mode et du style** : `PHOTOREALISTIC_PERSPECTIVE` et `PHOTOREALISTIC_AXONOMETRY`. Les deux partagent le même pack de contraintes géométriques (ADR-021) mais ne sont jamais traités comme un seul et même cas d'usage : la grille LIB-002 existante s'applique aux deux, avec un sous-ensemble de critères prioritaires différent (05_CHECKLIST_CONTROLE.md, note geometry-first) — aucun critère nouveau n'est créé, aucun mode de production n'est ajouté ou renommé (04B_MODES_DE_PRODUCTION.md, note type de sortie).
2. **Liste de formats 3D candidats élargie**, aucun sélectionné : RVT, FBX, DWG, DXF, DGN, OBJ, STL, IFC (formats réellement disponibles chez Évariste). RVT reste le candidat principal ; OBJ et IFC sont désignés à tester sérieusement. Le critère de sélection est fonctionnel, pas arbitraire : préserver suffisamment de géométrie tout en restant simple à exporter et raisonnablement léger à téléverser et traiter.
3. **Concept `TEMPORARY_PROJECT_ASSETS`** introduit pour le volume de photos terrain (40-50 fichiers, 8-10 Mo chacun) : un ensemble de fichiers d'aide à la compréhension multimodale, rattaché au projet actif, **sans autorité géométrique ou environnementale de premier plan** — ne se substitue pas au rôle `site_photo`/`model_3d` (REF-001 §2). Rétention envisagée 3 à 6 mois ; **aucune suppression automatique n'est décidée ici** — une politique de purge réelle exige une décision explicite séparée.
4. **Formulation de fidélité calibrée, à usage systématique** : « Maximiser la fidélité architecturale et réduire fortement les dérives géométriques. » Toute formulation impliquant une garantie de 100 %, une fidélité parfaite, une absence totale de dérive géométrique, RVT comme format définitif, ou un temps de génération fixe non mesuré, est erronée et ne doit plus être introduite dans un document actif de ce périmètre.
5. **Phase 1 confirmée comme « rendus fiables »** : calculateur de surfaces, faisabilité réglementaire/PLU et notice paysagère restent hors Phase 1 (déjà exclus, §19 PRD V2.1). La reconstruction 3D automatique depuis des photos (sans maquette fournie) est explicitement classée BACKLOG/R&D — confirmation et documentation du non-objectif déjà posé, pas un nouveau périmètre.
6. **Protocole du prochain cycle de test** (comparaison de formats 3D réels, PASS 1 à 8, gate de sortie : « la géométrie est nettement plus stable que le prototype GPT sur la perspective ET l'axonométrie, sans perdre une qualité photoréaliste suffisante ») est documenté dans `docs/PRD_RIF_V2_GEOMETRY_FIRST.md` §16 — décision de méthode, pas un résultat : aucun test n'est lancé par cette décision.

**Conséquences documentaires :** 04B_MODES_DE_PRODUCTION.md (note type de sortie), 05_CHECKLIST_CONTROLE.md (note critères par type de sortie), `docs/PRD_RIF_V2_GEOMETRY_FIRST.md` (§14-18 ajoutées), `docs/PRD_RIF_V2_Geometry_First_UX_UI_Desktop_v2.1.md` (formulation de fidélité, formats élargis, deux types de sortie, `TEMPORARY_PROJECT_ASSETS`) mis à jour (voir Historique de chacun).

**Conséquences prévisibles côté implémentation (hors périmètre, à traiter séparément) :** aucun champ `OutputType` n'existe encore dans `ProjectState`/`GenerationDetail` — ce document ne prescrit pas encore son schéma exact, volontairement, tant que le prochain cycle de test n'a pas produit un premier rendu axonométrique réel à comparer. `TEMPORARY_PROJECT_ASSETS` n'a aucune implémentation (pas de rôle, pas de route, pas de table) — concept produit seulement à ce stade. Voir `Implementations/RIF-App/DECISIONS.md` D-21.

**Éléments encore inconnus, inchangés par cette décision :** format 3D définitif, fournisseur d'extraction, coût/latence réels, version de Revit requise, correspondance exacte usages geometry-first ↔ `ModeProduction` (ADR-021, point 7) — tous en attente des fichiers réels d'Évariste et du prochain cycle de test.

