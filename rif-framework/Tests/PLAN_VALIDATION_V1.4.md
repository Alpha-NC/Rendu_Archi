# Plan de validation V1.4

## Conditions

- utiliser au moins cinq dossiers représentatifs ;
- comparer les sorties aux sources annotées par un humain ;
- exécuter au minimum deux fois les tests d'isolation ;
- conserver prompt, état projet, sources, résultat, audit et coût.

## Bloc A — Régression V1.3

Exécuter TEST-001 à TEST-008 et TEST-101 à TEST-109 applicables. Aucun défaut éliminatoire n'est accepté.

## Bloc B — Nouvelles capacités

Exécuter TEST-009 à TEST-013 : dépôt groupé, référence ciblée, annotation, variantes et pré-analyse.

## Bloc C — Défauts réels

Exécuter TEST-110 à TEST-122. Sont bloquants : invention géométrique, ouverture déplacée, annotation conservée, contamination inter-dossiers, référence matériau modifiant la composition et soleil physiquement impossible pour un usage administratif.

## Mesures

- taux de détection des défauts critiques ;
- faux verdicts `Conforme` ;
- nombre moyen de questions ;
- taux de correction sans régression ;
- coût moyen avec 1, 2 et 3 variantes ;
- temps de reprise après perte réseau.

## Décision

Le passage à Stable exige 100 % de détection sur le jeu critique annoté, zéro contamination croisée, aucune marque d'annotation en sortie et validation humaine du responsable RIF.
