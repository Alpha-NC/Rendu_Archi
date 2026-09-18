# 05_CHECKLIST_CONTROLE.md

ID : LIB-002  
Type : LIB  
Version : V1.7  
Statut : Review  
Niveau : L4  
Dossier : Framework/03_REFERENCES

---

# Checklist de contrôle qualité

## 1. Objet

Ce document définit la méthode officielle d’évaluation d’un rendu architectural.

Le contrôle est effectué selon l’usage et le mode de production déclarés.

**Note — type de sortie (ADR-022, RDV Évariste 18.09.2026) :** quand la génération contrôlée porte un type de sortie `PHOTOREALISTIC_AXONOMETRY` (docs/PRD_RIF_V2_GEOMETRY_FIRST.md §14) plutôt que `PHOTOREALISTIC_PERSPECTIVE`, les critères prioritaires de la grille commune (§3) changent de sous-ensemble, sans qu'aucun critère nouveau soit ajouté : priorité à `toiture` (faîtages, pans), `volumes`, `terrain`/`environnement` (cohérence spatiale, relations entre bâtiments) et `isolation` (absence d'éléments inventés) ; `cadrage`/`perspective` au sens photographique du terme perdent leur priorité (une axonométrie n'a pas de point de vue caméra réel à comparer). Pour une perspective, la priorité §13.1 du PRD reste inchangée (implantation, cadrage, perspective, volumes, ouvertures, toiture).

## 2. États

Chaque critère reçoit un état :

- Conforme ;
- Réserve ;
- Non conforme ;
- Non applicable.

**Note geometry-first (ADR-021) :** pour les critères dont la « Source de contrôle » est « Source géométrique », quand une source `model_3d` a été réellement extraite (pack de contraintes géométriques disponible), ce pack devient la référence de comparaison prioritaire — plus précise qu'une vue 2D dérivée. En son absence, ces critères restent contrôlés depuis la source géométrique 2D désignée comme aujourd'hui (aucune dégradation, mode legacy explicite). Le contrôle multimodal (Claude) reste la méthode d'évaluation, jamais la seule autorité future sur la conformité géométrique quand des données structurées existent pour trancher.

## 3. Grille commune

| Critère | Source de contrôle | Points à vérifier |
|---|---|---|
| Cadrage | Source désignée | limites, hauteur de caméra, champ visible |
| Perspective | Source désignée | lignes de fuite, échelle, point de vue |
| Silhouette | Source géométrique | contour extérieur du bâti tel que vu depuis la caméra, sans reconstruction |
| Volumes | Source géométrique | proportions, niveaux |
| Toiture | Source géométrique | pans, faîtages, rives, débords, noues |
| Ouvertures | Source géométrique | nombre, position, dimensions visibles |
| Implantation | Source géométrique | bâtiment, piscine, terrasses, annexes |
| Terrain | Photo ou source terrain | relief, niveaux, raccords |
| Environnement | Photographie | respect de l'état déclaré (`locked`/`editable`/`harmonizable`, ARCH-002) pour chaque élément — végétation, murs, clôtures, voisinage, horizon |
| Matériaux | État du projet | nature, teinte, texture, joints, échelle |
| Lumière | Photo ou paramètres | direction, intensité, ombres, exposition |
| Éléments secondaires | État du projet | présence, position, autorisation |
| Confidentialité | Sources et rendu | noms, adresses, cartouches, références sensibles |
| Annotations | Sources annotées | marque absente du rendu, directive correctement appliquée |
| Références matériau | Référence ciblée | apparence correcte, aucune dérive de géométrie ou composition |
| Isolation | État et journal | aucune source ou consigne issue d'un autre dossier ou essai |

## 4. Contrôle par mode

### 4.1 Retexturation Revit

Contrôler en priorité :

- superposition du cadrage ;
- conservation des contours ;
- absence de déplacement des ouvertures ;
- conservation stricte de la toiture ;
- absence de nouveaux volumes.

### 4.2 Photomontage contrôlé

Contrôler en priorité :

- conservation du cadrage photographique ;
- conservation de l’horizon ;
- identité des arbres, haies et bâtiments voisins ;
- conservation du terrain hors intervention ;
- absence de reconstruction globale du ciel ;
- précision du masque et des raccords ;
- cohérence des ombres de contact ;
- implantation du projet selon Revit.

Toute transformation importante de l’environnement verrouillé est **Non conforme** pour un usage administratif.

### 4.3 Retexturation contextualisée

Contrôler en priorité :

- fidélité de la vue Revit (cadrage, perspective, silhouette, volumes, toiture, ouvertures, implantation) ;
- reconnaissabilité du contexte du site (identité générale, pas conformité pixel par pixel) ;
- respect de l'état déclaré de chaque élément d'environnement — un `locked` non conservé ou un `editable`/`harmonizable` modifié sans décision validée sont tous deux des écarts, dans un sens comme dans l'autre ;
- absence de reconstruction intégrale du site ;
- absence de présentation trompeuse comme insertion administrative.

### 4.4 Retexturation Revit et Retexturation contextualisée — correction ciblée

Une correction ne doit jamais réouvrir un élément d'environnement déjà validé à un état différent de celui confirmé, ni transformer un élément `locked` sous couvert de corriger un élément `editable` ou `harmonizable` voisin.

## 5. Défauts éliminatoires

- volume inventé ou supprimé ;
- toiture transformée ;
- ouverture déplacée ;
- piscine ou terrasse mal implantée ;
- caméra changée sans autorisation ;
- environnement réel remplacé dans un photomontage contrôlé, ou reconstruit dans son intégralité en retexturation contextualisée ;
- élément d'environnement `locked` modifié, ou élément `editable`/`harmonizable` transformé sans décision validée ;
- bâtiment voisin significatif supprimé ;
- relief réinventé ;
- donnée confidentielle visible ;
- usage administratif revendiqué malgré un mode non documentaire (Retexturation Revit ou Retexturation contextualisée).
- mur, ouverture, volet, marche ou équipement inventé ;
- annotation, flèche, cercle ou texte de correction visible ;
- pool house ou annexe dont l'échelle ne correspond pas à la source ;
- direction solaire incompatible avec l'orientation validée ;
- contamination par une source ou consigne d'un autre dossier.

## 6. Verdict

Le contrôle aboutit à une décision par usage :

- Validation pour l’usage déclaré ;
- Acceptable pour un autre usage précisé ;
- Correction ciblée ;
- Nouvelle génération depuis les sources ;
- Production suspendue.

## 7. Format de rapport

```text
Élément | Source de contrôle | État | Écart observé | Action recommandée
```

Le verdict doit toujours préciser l’usage évalué.

Pour un écart mineur, le rapport peut conclure `Acceptable avec réserve` pour une présentation et `Non conforme` pour un usage administratif. Cette distinction ne modifie jamais les critères de fidélité du Framework.

## Documents liés

- REF-001 — 01_REFERENTIEL_GENERAL.md
- ARCH-002 — 00_VOCABULAIRE_SYSTEME.md
- ENG-003 — 03_PROMPTS_CORRECTIONS.md
- LIB-006 — 04B_MODES_DE_PRODUCTION.md

## Historique

V1.7 — Ajout d'une note (§1, ADR-022) : le type de sortie (perspective/axonométrie) réoriente les critères prioritaires de la grille commune vers un sous-ensemble différent, sans ajouter de nouveau critère.

V1.6 — Ajout d'une note geometry-first (§1, ADR-021) : quand un pack de contraintes géométriques existe (source `model_3d` réellement extraite), il devient la référence de comparaison prioritaire pour les critères géométriques ; sans lui, contrôle inchangé depuis la source 2D désignée. Rappelle que le contrôle multimodal ne doit pas rester la seule autorité géométrique quand des données structurées existent.

V1.5 — Ajout du critère « Silhouette » (§3, distingué des Volumes, PRD V2.1 §13.1). §4.3 : remplace les priorités de contrôle « Présentation générative » par « Retexturation contextualisée », fondées sur le respect de l'état déclaré (`locked`/`editable`/`harmonizable`, ARCH-002) plutôt que sur des « limites de liberté » non qualifiées. §5 : défauts éliminatoires généralisés aux deux modes utilisant un environnement réel. Recalibrage produit V2.1, voir ADR-019.
