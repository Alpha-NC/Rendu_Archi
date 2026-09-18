# PRD RIF V2 — Geometry-First UX/UI Desktop v2.1

> Document de référence UX/UI pour guider Codex.
> Source de vérité fonctionnelle : `docs/RIF_BACKEND_CONTRACTS_V2.md`.
> Source produit Geometry-First : `docs/PRD_RIF_V2_GEOMETRY_FIRST.md`.
> Référence visuelle principale : planche détaillée présente dans `docs/ux/`.

## 1. Principes
- Le rendu est le produit.
- La conversation est un outil de pilotage.
- RIF fournit l’architecture ; l’IA la photoréalise.
- Aucun fake progress, fake geometry, fake quality ou fake data.
- Desktop uniquement : 1440–1920 px.
- **Fidélité — formulation officielle (RDV Évariste 18.09.2026) :** « Maximiser la fidélité architecturale et réduire fortement les dérives géométriques. » Aucune UI ne doit afficher ou impliquer une garantie de 100 %, une fidélité parfaite, une absence totale de dérive, ni RVT comme format obligatoire.

## 2. Workflow
SOURCES → ANALYSE 3D → ALIGNEMENT → CONTRAINTES → GÉNÉRATION → CONTRÔLE → VALIDATION

## 3. Hiérarchie des sources
1. Modèle 3D : autorité géométrique.
2. Vue projet : autorité de cadrage.
3. Photo réelle : autorité environnementale.
4. Axonométrie : contrôle spatial secondaire.

Le format 3D final reste à confirmer. Candidats à tester (aucun choisi) : RVT, FBX, DWG, DXF, DGN, OBJ, STL, IFC — RVT principal, OBJ/IFC à tester sérieusement (voir `docs/PRD_RIF_V2_GEOMETRY_FIRST.md` §16).

## 4. Navigation globale
- Projets
- Nouveau projet
- Matériaux
- Bibliothèque
- Paramètres

## 5. Écrans
### Connexion
Deux colonnes, Neon Auth réel, erreurs propres.

### Dashboard
Grille de projets, recherche, filtres utiles, empty/error/loading states.

### Nouveau projet
3 étapes : Projet → Sources → Récapitulatif.
4 sources structurantes : Modèle 3D, Vue projet, Photo réelle, Axonométrie.
Concept `TEMPORARY_PROJECT_ASSETS` (RDV Évariste, PRD Geometry-First §15) : un lot de photos terrain (40-50 attendues, 8-10 Mo chacune) en complément, non autoritaire, pour aider la compréhension multimodale — **non implémenté** dans ce cycle, ne pas construire d'écran de dépôt en masse tant que le concept n'est pas spécifié techniquement.

### Cockpit projet
Rendu dominant au centre, projet/sources à gauche, conversation à droite, historique en bas.

### Analyse 3D
Afficher les vrais statuts d’extraction et le Geometry Pack uniquement si réel.
Sans provider : `Extracteur non configuré`.

### Alignement
Statuts : NOT_STARTED, PROCESSING, ALIGNED, REVIEW_REQUIRED, FAILED.
Si review : `Validation humaine nécessaire`.

### Contraintes
VERROUILLÉ / MODIFIABLE / CONDITIONNEL.
Ne jamais déduire un verrouillage d’une absence de donnée.

### Générations
Historique persistant, sélection, canonical si disponible, processing sans pourcentage inventé.
Deux types de sortie non interchangeables (RDV Évariste 18.09.2026, `docs/PRD_RIF_V2_GEOMETRY_FIRST.md` §14) : `PHOTOREALISTIC_PERSPECTIVE` et `PHOTOREALISTIC_AXONOMETRY`. Ne pas les afficher comme un seul et même type de rendu — libellé/icône distincts si le contrat expose un jour ce champ ; en son absence aujourd'hui, ne pas l'inventer côté UI.

### Comparaison
Deux versions réelles, slider principal, côte à côte secondaire. Comparer deux rendus du même `OutputType` par défaut — comparer perspective et axonométrie l'une contre l'autre n'a pas de sens produit.

### Contrôle qualité
Sections : Géométrie, Environnement, Matériaux, Présentation.
États : CONFORME, RESERVE, NON_CONFORME, NON_APPLICABLE, NON_EVALUE.
Sans audit : `Contrôle qualité non encore exécuté`.
Les critères prioritaires diffèrent selon l'`OutputType` de la génération contrôlée (perspective : implantation/cadrage/perspective/volumes/ouvertures/toiture ; axonométrie : toiture/faîtages/pans/volumes/cohérence spatiale) — voir PRD Geometry-First §14. Ne pas présenter la même grille comme équivalente pour les deux.

### Validation
CTA `Valider cette version`, modal de confirmation, canonical uniquement selon contrat réel.

### Matériaux
Données ProjectState uniquement. Ne pas recréer l’ancien modèle Supabase.

### Détails
Informations, Sources, Événements, Générations, Workflow, Geometry-First.

### Bibliothèque
Si aucun contrat : empty state premium, aucune fake gallery.

### Paramètres
Compte, email, déconnexion, préférences réellement supportées.

## 6. Design system
Palette recommandée :
- Navy `#082C3A`
- Teal `#1597A8`
- Coral `#F06B5D`
- Ivory `#F7F4ED`
- Success `#2E9E6F`
- Warning `#D99614`

Composants :
AppShell, Sidebar, PageHeader, ProjectCard, StatusBadge, SourceCard, GeometryStatus,
ConstraintRow, MaterialCard, RenderViewer, GenerationStrip, ChatPanel, StructuredMessage,
ComparisonViewer, QualitySection, QualityCriterion, Modal, Drawer, EmptyState, ErrorState,
Skeleton, ConfirmDialog.

## 7. États obligatoires
- aucun projet
- source manquante
- modèle 3D absent
- provider non configuré
- extraction non lancée
- extraction failed
- alignement review required
- aucune génération
- génération processing
- génération failed
- aucun quality audit
- signed URL failed
- network error

## 8. Contrats
Toujours respecter `docs/RIF_BACKEND_CONTRACTS_V2.md`.
Ne pas inventer un comportement présent dans la maquette mais absent des contrats.

## 9. QA
Après chaque grande passe :
- `npm test`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- inspection visuelle réelle des écrans

## 10bis. Historique
- 18.09.2026 (soir, post-RDV Évariste) — Formulation de fidélité calibrée ajoutée en principe (§1) ; liste de formats 3D élargie (§3) ; deux `OutputType` non interchangeables documentés pour Générations/Comparaison/Contrôle qualité (§5) ; concept `TEMPORARY_PROJECT_ASSETS` ajouté à Nouveau projet (§5, non implémenté). Voir ADR-022 et D-21.

## 10. Critères de sortie
- Login premium
- Dashboard premium
- Création projet 4 sources
- Cockpit image-dominant
- Analyse 3D
- Alignement
- Contraintes
- Générations
- Conversation
- Comparaison
- Qualité
- Validation
- Matériaux
- Détails
- Bibliothèque
- Paramètres
- Loading/error/empty states
- Accessibilité
- Aucun fake geometry/progress/quality
- Contrats backend respectés
- QA visuelle effectuée
