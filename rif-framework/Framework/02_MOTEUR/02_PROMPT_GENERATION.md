# 02_PROMPT_GENERATION.md

ID : ENG-001  
Type : ENGINE  
Version : V1.4  
Statut : Review  
Niveau : L3  
Dossier : Framework/02_MOTEUR

---

# Moteur de préparation du contexte

## 1. Objet

Transformer l'état projet confirmé en contexte de génération exploitable, sans modifier les données ni les règles métier.

## 2. Préparation

1. Charger exclusivement la révision immuable du dossier courant.
2. Inventorier les sources et leurs rôles confirmés.
3. Appliquer l'autorité par domaine et par élément.
4. Vérifier qualité, compatibilité caméra, confidentialité et contradictions.
5. Extraire la géométrie et nommer chaque détail critique visible.
6. Convertir les annotations en directives localisées ; exclure leurs marques du résultat.
7. Pré-analyser les matériaux et conserver pour chacun la source et le niveau de confiance.
8. Limiter toute référence matériau à l'élément désigné.
9. Charger les zones modifiables, verrouillées, les interdictions et les validations.
10. Vérifier la cohérence entre orientation, moment de la journée et lumière.

## 3. Questions résiduelles

Le moteur transmet à ENG-004 uniquement les informations indispensables qui restent inconnues, ambiguës, rares ou contradictoires. Les données évidentes peuvent être proposées à la confirmation au lieu d'être redemandées.

## 4. Sortie

Le contexte contient : objectif et usage, mode, style, canevas, autorité des sources, géométrie, environnement, matériaux, références limitées, directives localisées, lumière, zones verrouillées, opérations autorisées, éléments secondaires, format et contrôles prioritaires.

Chaque champ conserve sa provenance et son statut de validation. Le contexte est transmis à ENG-002 ; il ne constitue pas encore le prompt final.

## 5. Variantes

Plusieurs variantes peuvent être demandées depuis la même révision. Elles partagent le contexte autoritaire mais reçoivent chacune un identifiant et, si nécessaire, une variation esthétique explicitement bornée. Aucune variante ne devient canonique sans sélection humaine.

