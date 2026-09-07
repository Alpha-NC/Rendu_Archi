# 99_DECISIONS_ARCHITECTURE.md

ID : DOC-002  
Type : DOC  
Version : V1.4  
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

