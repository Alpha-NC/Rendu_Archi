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

