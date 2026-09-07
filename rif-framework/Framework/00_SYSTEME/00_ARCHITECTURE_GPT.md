# 00_ARCHITECTURE_GPT.md

ID : ARCH-001  
Type : ARCH  
Version : V1.4  
Statut : Review  
Niveau : L1  
Dossier : Framework/00_SYSTEME

---

# Architecture du Rendering Intelligence Framework

## 1. Objet

Le RIF organise les règles, données, processus, références et contrôles nécessaires à la production de rendus architecturaux fidèles. Il reste indépendant des moteurs d'IA, logiciels et interfaces.

## 2. Principes

- responsabilité unique par module ;
- source unique de vérité ;
- dépendances explicites et non circulaires ;
- séparation entre Framework universel, profil d'implémentation et données projet ;
- état projet structuré, versionné et reproductible ;
- fidélité architecturale prioritaire sur l'esthétique ;
- validation selon l'usage ;
- traçabilité de toute génération et correction.

## 3. Niveaux et modules

```text
L1 — Système
├── ARCH-001  00_ARCHITECTURE_GPT.md
└── ARCH-002  00_VOCABULAIRE_SYSTEME.md

L2 — Référentiel
├── REF-001   01_REFERENTIEL_GENERAL.md
├── REF-002   01A_FICHE_PROJET.md
└── REF-003   01B_VOCABULAIRE_ARCHITECTURAL.md

L3 — Moteur
├── ENG-001   02_PROMPT_GENERATION.md
├── ENG-002   02A_PROMPT_SYSTEME.md
├── ENG-003   03_PROMPTS_CORRECTIONS.md
└── ENG-004   02B_COLLECTE_CONDITIONNELLE.md

L4 — Références
├── LIB-001   04_MATERIAUX.md
├── LIB-002   05_CHECKLIST_CONTROLE.md
├── LIB-003   06_CAS_DE_TEST.md
├── LIB-004   07_GUIDE_DECISION.md
├── LIB-005   04A_STYLES_DE_RENDU.md
└── LIB-006   04B_MODES_DE_PRODUCTION.md

L5 — Documentation
├── DOC-001   99_CONVENTIONS.md
├── DOC-002   99_DECISIONS_ARCHITECTURE.md
├── DOC-003   99_CHANGELOG.md
├── DOC-004   99_ROADMAP.md
└── DOC-005   00_PASSAGE_PRODUCTION.md
```

## 4. Flux fonctionnel

1. Créer ou reprendre un dossier isolé.
2. Recevoir toutes les sources en un groupe logique.
3. Détecter leur rôle puis faire confirmer les ambiguïtés.
4. Vérifier qualité, confidentialité, cohérence et compatibilité caméra.
5. Pré-analyser géométrie, matériaux, annotations et contraintes.
6. Constituer l'état projet et appliquer la collecte conditionnelle.
7. Déterminer le mode, puis le style.
8. Faire confirmer la fiche projet.
9. Construire une requête depuis une révision immuable.
10. Produire une ou plusieurs variantes traçables.
11. Contrôler chaque résultat selon l'usage.
12. Corriger localement ou reprendre depuis les sources.
13. Faire sélectionner et valider le résultat canonique par un humain.

## 5. Isolation

Chaque dossier est un espace de travail étanche. Une tentative antérieure, un autre dossier ou une conversation précédente ne peut contribuer implicitement à une génération. Toute donnée utilisée doit être reliée à la révision courante de l'état projet.

## 6. Évolution

Toute modification structurante suit le cycle Backlog → ADR → version Review → tests → Stable.

