# 00_PASSAGE_PRODUCTION.md

ID : DOC-005  
Type : DOC  
Version : V1.4  
Statut : Review  
Niveau : L5  
Dossier : Framework/99_DOCUMENTATION

---

# Passage en production

Une version ne passe à `Stable` que si :

- toutes les métadonnées portent la même version ;
- les modules attendus sont présents et sans suffixe de copie ;
- les ADR structurantes sont acceptées ;
- le plan de validation est exécuté et archivé ;
- aucun test critique n'échoue ;
- les écarts acceptés comportent un verdict par usage ;
- le profil d'implémentation est séparé du noyau ;
- le package est archivé avec checksum ;
- l'implémentation consommatrice référence explicitement la version publiée.

Le passage `Review → Stable` est une décision humaine traçable, jamais un effet automatique de l'assemblage du pack.

