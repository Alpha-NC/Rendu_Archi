# 07_GUIDE_DECISION.md

ID : LIB-004  
Type : LIB  
Version : V1.6  
Statut : Review  
Niveau : L4  
Dossier : Framework/03_REFERENCES

---

# Guide de décision

## Sources et mode

- Vue Revit seule, cadrage conservé : Retexturation Revit.
- Vue Revit + photo réelle, sans usage administratif strict (cas standard) : Retexturation contextualisée.
- Photo réelle et usage administratif, caméras compatibles : Photomontage contrôlé.
- Caméras approximatives : présentation possible avec réserve ; administratif suspendu jusqu'à calibration ou nouvelle vue.
- Caméras incompatibles ou non évaluées : aucune bascule automatique vers Photomontage contrôlé en style Administratif sobre ; Retexturation contextualisée reste possible si l'écart ne compromet pas le résultat attendu (LIB-006 §4).
- Liberté d'ambiance explicitement acceptée en Retexturation contextualisée : autoriser les éléments `harmonizable` plus largement, jamais au-delà (ARCH-002).

## Rôles de fichiers

- Rôle détecté avec confiance élevée : demander une confirmation groupée.
- Rôle ambigu ou contradictoire : demander à l'utilisateur.
- Le nom du fichier ne suffit jamais à décider.
- Les fichiers de dossiers différents restent isolés, même si leurs noms sont identiques.

## Annotations

- Action et cible claires : créer une directive localisée.
- Flèche ou cercle sans consigne claire : demander confirmation.
- Une marque d'annotation visible dans le résultat : Non conforme.

## Référence matériau

- Élément ciblé explicite : appliquer seulement son apparence.
- Référence susceptible de modifier composition ou géométrie : borner la consigne ou suspendre.
- Plusieurs références contradictoires : demander laquelle fait foi.

## Pré-analyse

- Matériau évident et courant : pré-remplir avec niveau de confiance puis faire confirmer.
- Matériau rare, inconnu ou contradictoire : question ouverte.
- Profil client : suggestion uniquement, jamais décision silencieuse.

## Résultat

- Architecture fidèle, environnement recréé : présentation éventuellement acceptable avec réserve ; administratif non conforme.
- Environnement fidèle, géométrie incorrecte : non conforme pour tout usage exigeant la fidélité.
- Petite dérive sans conséquence de lecture : verdict distinct selon l'usage, sans affaiblir la règle de fidélité.
- Plusieurs corrections ont dégradé la base : reprendre depuis les sources.

## Priorité

1. préserver les sources faisant autorité ;
2. respecter l'usage déclaré ;
3. ne pas inventer ;
4. demander une clarification ciblée ;
5. suspendre plutôt que produire une fausse conformité.

## Documents liés

- LIB-006 — 04B_MODES_DE_PRODUCTION.md
- ARCH-002 — 00_VOCABULAIRE_SYSTEME.md

## Historique

V1.6 — Précision « aucun photomontage administratif » → « aucune bascule automatique vers Photomontage contrôlé en style Administratif sobre » : l'ancienne formulation nommait, sans le dire explicitement, un couple mode+style avec l'ancien nom du style (PRD V2.1, ADR-020).

V1.5 — Ajout de la ligne « Vue Revit + photo réelle, sans usage administratif strict » (Retexturation contextualisée), absente de ce guide alors qu'elle correspond au cas standard du PRD V2.1. Remplacement de la référence à « Présentation générative ». Recalibrage produit V2.1, voir ADR-019.

