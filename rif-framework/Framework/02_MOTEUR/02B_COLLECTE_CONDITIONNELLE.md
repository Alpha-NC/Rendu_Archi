# 02B_COLLECTE_CONDITIONNELLE.md

ID : ENG-004
Type : ENGINE
Version : V1.6
Statut : Review
Niveau : L3
Dossier : Framework/02_MOTEUR

---

# Moteur de collecte conditionnelle

## 1. Objet

Ce document définit comment le parcours de collecte conversationnelle (Étape 3 côté implémentation) doit s'adapter une fois le mode de production et/ou le style de rendu pressentis, plutôt que de poser une séquence de questions identique quel que soit le contexte du projet.

Il ne redéfinit ni le modèle de données du projet (REF-002), ni les modes (LIB-006), ni les styles (LIB-005) : il décrit uniquement comment la conversation doit se brancher en fonction de ce qui est déjà déterminé par ces modules.

---

## 2. Principe général

Une fois le mode et/ou le style pressentis — souvent dès les premiers échanges de l'Étape 3 — chacune des questions génériques du tronc commun tombe dans l'un de ces quatre états :

* **Inchangée** : reste une question ouverte à part entière, aucune règle du Framework ne permet de la réduire.
* **Réduite** : la question reste posée, mais sur un périmètre plus étroit que sa formulation générique.
* **Convertie en confirmation** : la réponse est déjà déterminée par une règle du Framework (mode, style, ou principe du Référentiel) — l'implémentation l'annonce et demande une confirmation d'une ligne plutôt que de la poser comme un choix ouvert.
* **Retirée** : sans objet dans ce contexte précis, ne doit pas être posée.

Une combinaison mode × style peut également nécessiter une question absente des huit questions génériques du tronc commun — dans ce cas, elle s'ajoute.

Ce mécanisme ne modifie jamais les données elles-mêmes ni leur autorité — REF-001 reste en toutes circonstances la source unique de vérité sur ce point. Il modifie uniquement la manière dont les données sont demandées.

### 2.1 Pré-analyse avant question

Avant de questionner l'utilisateur, l'implémentation analyse les sources du dossier et prépare des propositions avec provenance et niveau de confiance. Elle regroupe la confirmation des rôles de fichiers, puis pré-remplit les matériaux, éléments intouchables et contraintes visibles.

Une donnée évidente devient une confirmation courte. Une donnée rare, inconnue, ambiguë ou contradictoire reste une question ouverte. Une préférence issue d'un profil client est présentée comme suggestion et ne devient jamais une réponse implicite.

L'expérience nominale vise : dépôt des sources, deux ou trois lignes de contexte libre, puis confirmations ciblées. La complétude de l'état projet demeure obligatoire même si la conversation visible est courte.

### 2.2 Nommage des fichiers

Le nom d'un fichier est un indice de détection, pas une convention obligatoire. L'implémentation doit accepter un dépôt groupé, détecter les rôles puis faire confirmer toute ambiguïté. Elle nettoie les noms techniques côté serveur sans demander à l'utilisateur de renommer ses fichiers.

---

## 3. Tronc commun de référence

Les huit questions génériques de l'Étape 3, numérotées pour y référer dans le reste du document :

① type de projet, phase et usage du rendu
② mode de production et implantation attendue
③ éléments architecturaux intouchables
④ matériaux — existant conservé ou modifié par le projet
⑤ environnement à conserver, supprimer ou améliorer
⑥ orientation ou ambiance lumineuse
⑦ style de rendu
⑧ personnages, véhicules, mobilier

---

## 4. Branchement par combinaison

### 4.1 Photomontage contrôlé + Administratif sobre (cas par défaut)

① Inchangée.
② Convertie en confirmation — LIB-006 §5 fixe déjà ce mode par défaut dès qu'une photographie existe pour un usage administratif. Seule l'implantation précise du projet dans la photo reste une vraie question.
③④ Inchangées.
⑤ Réduite — la conservation est déjà la règle par défaut (zones verrouillées, ADR-009) ; ne reste ouverte que la question de ce qu'il faut supprimer.
⑥ Retirée — remplacée par une phrase annonçant que la lumière suit la photographie (REF-001 §9).
⑦ Convertie en confirmation — style par défaut dès qu'une photographie existe (LIB-005, Sélection automatique).
⑧ Convertie en confirmation négative — absence d'ajout par défaut (LIB-005 §5), sauf demande explicite.

### 4.2 Photomontage contrôlé + Présentation naturelle

① Inchangée.
② Inchangée, reformulée en langage naturel — LIB-004 fait de cet arbitrage (fidélité documentaire vs liberté d'ambiance) un vrai choix, pas une évidence.
③④ Inchangées.
⑤ Réduite mais reste ouverte — porte sur ce qui doit être valorisé plutôt que sur une liste exhaustive.
⑥ Convertie en confirmation — le style Présentation naturelle définit déjà la direction (plus chaud que la photo, LIB-005 §2) ; seule la validation est demandée.
⑦ Convertie en confirmation.
⑧ Réduite — reste ouverte mais cadrée par l'exigence de discrétion (LIB-005 §2).

### 4.3 Photomontage contrôlé + Commercial

①③④⑦ Même traitement qu'en 4.2.
② Même nuance qu'en 4.2.
⑤ Réduite comme en 4.1 — l'amélioration paysagère n'est pas le sujet de ce style.
⑥ **Ajoutée** — le tronc commun ne couvre pas le moment de la journée, pourtant la donnée la plus structurante du style (LIB-005 §3) : plein jour, fin de journée ou crépuscule. Si fin de journée ou crépuscule est choisi, une sous-question s'ajoute sur les éclairages à activer (margelles, sous-marin de la piscine, façade).
⑧ Inversée — encouragée plutôt que tolérée : ce style autorise explicitement ce que les deux autres interdisent par défaut (LIB-005 §3).

### 4.4 Retexturation Revit (aucune photographie)

① Inchangée.
② Réduite à néant — l'implantation dans une photo n'a pas de sens sans photo ; retirée.
③ Réduite — moins critique en l'absence de tout conflit possible entre photo et Revit, reste utile si le modèle contient des éléments hors périmètre du projet.
④ Réduite — la distinction existant conservé / modifié (ADR-012) répond à un conflit entre photo et Revit qui ne peut pas exister ici ; redevient une simple question de matériaux.
⑤ Quasi retirée — sans photographie, il n'y a pas d'environnement réel à conserver ou supprimer.
⑥ Inchangée, redevient une vraie question ouverte — aucune photographie n'impose de référence lumineuse ; REF-001 §9 sert de filet (lumière neutre par défaut si non précisée).
⑦ Réduite à deux choix. **Administratif sobre est exclu de ce mode** (ADR-013) : son objectif (LIB-005 §1) suppose une intégration à une photographie réelle, absente ici. Seuls Présentation naturelle et Commercial restent proposables. À défaut de choix exprimé, Présentation naturelle sert de valeur par défaut.
⑧ Inchangée, dépend du style retenu comme dans les autres branches.

---

### 4.5 Retexturation contextualisée + Présentation naturelle (cas standard, par défaut)

① Inchangée.
② Convertie en confirmation — LIB-006 §5 fixe déjà ce mode par défaut dès qu'une photographie existe sans exigence administrative stricte. Seule l'implantation précise du projet reste une vraie question si elle n'est pas déjà lisible sur la vue Revit.
③④ Inchangées.
⑤ **Reformulée** — devient une classification par élément d'environnement plutôt qu'une question globale de conservation. La pré-analyse (§2.1) propose un état `locked`, `editable` ou `harmonizable` (ARCH-002) pour chaque élément identifié sur la photo, avec confiance et provenance ; l'implémentation ne demande confirmation individuelle que pour les éléments ambigus, rares ou contradictoires — jamais une reclassification exhaustive élément par élément.
⑥ Retirée — remplacée par une phrase annonçant que la lumière suit la photographie comme référence de contexte (REF-001 §6), sauf demande explicite d'ambiance différente.
⑦ Convertie en confirmation — Présentation naturelle est le style par défaut de ce mode (LIB-005).
⑧ Convertie en confirmation négative — absence d'ajout par défaut, sauf demande explicite.

### 4.6 Retexturation contextualisée + Administratif sobre

① Inchangée.
② Convertie en confirmation — un usage administratif déclaré avec une photo compatible oriente plutôt vers Photomontage contrôlé (LIB-006 §6) ; ce cas ne subsiste que si l'utilisateur maintient explicitement Retexturation contextualisée malgré l'usage administratif — l'implémentation le signale avant de poursuivre.
③④ Inchangées.
⑤ Réduite — comme en 4.1, la conservation prévaut par défaut ; ne reste ouverte que la question de ce qui doit rester `editable`.
⑥ Retirée — la lumière suit la photographie (REF-001 §6).
⑦⑧ Convertie en confirmation, comme en 4.1.

### 4.7 Retexturation contextualisée + Commercial

①③④⑦ Même traitement qu'en 4.5.
② Même nuance qu'en 4.5.
⑤ Traitée comme en 4.5 — la classification par élément prime, avec une tolérance `harmonizable` plus large pour l'ambiance.
⑥ **Ajoutée**, comme en 4.3 — moment de la journée explicite ; sous-question sur les éclairages à activer si fin de journée ou crépuscule.
⑧ Inversée, comme en 4.3.

## 5. Ce que ce module ne fait pas

Il ne redéfinit aucune règle d'autorité, aucune caractéristique de style, aucun mode de production. Il réordonne et filtre uniquement la manière dont les questions du tronc commun sont posées. Toute contradiction apparente entre ce document et REF-001, LIB-005 ou LIB-006 doit être résolue en faveur de ces derniers.

---

## Documents liés

- REF-001 — 01_REFERENTIEL_GENERAL.md
- REF-002 — 01A_FICHE_PROJET.md
- ENG-001 — 02_PROMPT_GENERATION.md
- LIB-004 — 07_GUIDE_DECISION.md
- LIB-005 — 04A_STYLES_DE_RENDU.md
- LIB-006 — 04B_MODES_DE_PRODUCTION.md
- DOC-002 — 99_DECISIONS_ARCHITECTURE.md (ADR-013, ADR-019)

---

## Évolution

Toute nouvelle combinaison mode × style doit être documentée ici selon la même structure : état de chacune des huit questions du tronc commun, plus toute question additionnelle propre à la combinaison.

## Historique

V1.6 — Harmonisation de la nomenclature des styles sur le PRD V2.1 (ADR-020) dans les en-têtes de branchement (§4.1, 4.2, 4.5, 4.6) et le corps du texte : « Photomontage administratif » → **Administratif sobre**, « Présentation client » → **Présentation naturelle**.

V1.5 — Ajout des branches §4.5 à §4.7 (Retexturation contextualisée × Présentation client/Photomontage administratif/Commercial), remplaçant l'absence de branche pour l'ancien mode « Présentation générative » — qui, faute de règle documentée, ne bénéficiait d'aucune réduction (§2, comportement de repli). Recalibrage produit V2.1, voir ADR-019 et LIB-006 V1.5.
