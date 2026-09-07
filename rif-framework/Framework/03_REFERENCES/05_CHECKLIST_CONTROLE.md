# 05_CHECKLIST_CONTROLE.md

ID : LIB-002  
Type : LIB  
Version : V1.4  
Statut : Review  
Niveau : L4  
Dossier : Framework/03_REFERENCES

---

# Checklist de contrôle qualité

## 1. Objet

Ce document définit la méthode officielle d’évaluation d’un rendu architectural.

Le contrôle est effectué selon l’usage et le mode de production déclarés.

## 2. États

Chaque critère reçoit un état :

- Conforme ;
- Réserve ;
- Non conforme ;
- Non applicable.

## 3. Grille commune

| Critère | Source de contrôle | Points à vérifier |
|---|---|---|
| Cadrage | Source désignée | limites, hauteur de caméra, champ visible |
| Perspective | Source désignée | lignes de fuite, échelle, point de vue |
| Volumes | Source géométrique | proportions, niveaux, silhouettes |
| Toiture | Source géométrique | pans, faîtages, rives, débords, noues |
| Ouvertures | Source géométrique | nombre, position, dimensions visibles |
| Implantation | Source géométrique | bâtiment, piscine, terrasses, annexes |
| Terrain | Photo ou source terrain | relief, niveaux, raccords |
| Environnement | Photographie | végétation, murs, clôtures, voisinage, horizon |
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

### 4.3 Présentation générative

Contrôler en priorité :

- géométrie du projet ;
- cohérence visuelle ;
- limites de liberté validées ;
- absence de présentation trompeuse comme insertion administrative.

## 5. Défauts éliminatoires

- volume inventé ou supprimé ;
- toiture transformée ;
- ouverture déplacée ;
- piscine ou terrasse mal implantée ;
- caméra changée sans autorisation ;
- environnement réel remplacé dans un photomontage contrôlé ;
- bâtiment voisin significatif supprimé ;
- relief réinventé ;
- donnée confidentielle visible ;
- usage administratif revendiqué malgré une présentation générative.
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
- ENG-003 — 03_PROMPTS_CORRECTIONS.md
- LIB-006 — 04B_MODES_DE_PRODUCTION.md
