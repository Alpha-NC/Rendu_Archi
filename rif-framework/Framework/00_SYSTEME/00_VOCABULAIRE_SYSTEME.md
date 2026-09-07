# 00_VOCABULAIRE_SYSTEME.md

ID : ARCH-002  
Type : ARCH  
Version : V1.4  
Statut : Review  
Niveau : L1  
Dossier : Framework/00_SYSTEME

---

# Vocabulaire du Framework

## Définitions

**Framework** — Ensemble universel de règles, modules, processus et contrôles constituant le RIF.

**Implémentation** — Système technique appliquant le Framework : application, GPT, API ou chaîne de compositing.

**Profil d'implémentation** — Préférences, lexique, contraintes produit et valeurs usuelles propres à un client ou à une implémentation. Il ne modifie pas les règles universelles.

**Projet / dossier** — Espace isolé regroupant l'état projet, ses sources, ses productions et son historique.

**État projet** — Ensemble structuré, versionné et validé des informations courantes d'un projet.

**Source** — Document utilisé pour décrire, orienter ou contrôler un projet.

**Rôle de source** — Fonction déclarée d'un fichier : géométrie, site, matériau, annotation, contrôle ou rendu.

**Autorité d'une source** — Domaine précis pour lequel une source fait foi. L'autorité n'est jamais globale par défaut.

**Référence matériau** — Image dont l'autorité est limitée à l'apparence de l'élément désigné : nature, teinte, texture, finition, relief et calepinage visible.

**Source annotée** — Source comportant des marques servant à localiser une consigne. Les marques ne font pas partie du résultat attendu.

**Directive localisée** — Instruction structurée associant une zone, une action (`conserver`, `supprimer`, `remplacer`, `corriger`, `verrouiller`) et une description.

**Pré-analyse** — Extraction assistée de données probables depuis les sources avant les questions à l'utilisateur. Toute donnée pré-remplie reste confirmable.

**Génération** — Nouvelle production construite depuis une révision immuable de l'état projet.

**Variante** — Résultat alternatif partageant la même révision d'état et le même objectif.

**Résultat canonique** — Variante ou correction explicitement sélectionnée comme base courante.

**Correction** — Modification ciblée d'un résultat existant conservant les éléments validés.

**Reprise depuis les sources** — Nouvelle génération lorsque le résultat courant n'est plus une base fiable.

**Mode de production** — Méthode de fabrication de l'image.

**Style de rendu** — Apparence visuelle, sans autorité sur la géométrie ni sur le mode.

**Compatibilité caméra** — État `Compatible`, `Approximative`, `Incompatible` ou `Non évaluée`.

**Verdict par usage** — Évaluation attachée à une destination déclarée. Un même rendu peut être acceptable en présentation et non conforme en administratif.

## Règles

- Un terme transversal est défini ici avant usage général.
- Les synonymes sont admis dans l'interface, mais un terme officiel est conservé dans les données.
- Le vocabulaire architectural détaillé relève de REF-003.

