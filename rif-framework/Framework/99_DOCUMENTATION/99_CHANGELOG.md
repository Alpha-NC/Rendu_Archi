# 99_CHANGELOG.md

ID : DOC-003  
Type : DOC  
Version : V1.4  
Statut : Review  
Niveau : L5  
Dossier : Framework/99_DOCUMENTATION

---

# Journal des versions

## V1.4 — Review — 6 septembre 2026

Consolidation des réunions des 17 juillet, 4 août et 12 août 2026 et des défauts observés en production réelle.

### Ajouts

- rôles de sources étendus et confirmation groupée ;
- annotation convertie en directive localisée ;
- autorité limitée des références matériau ;
- pré-analyse des matériaux avec provenance et confiance ;
- isolation stricte des dossiers et reconstruction depuis un état immuable ;
- variantes multiples, comparaison et sélection d'un résultat canonique ;
- profil d'implémentation séparé pour le lexique et les matériaux usuels ;
- vocabulaire : planche de rive, sous-face, boiseries/menuiseries, coursive, banquette, marches et volets ;
- tests issus des échecs réels : mur inventé, ouvertures déplacées, pool house surdimensionné, soffite blanc, bord de terrasse blanc, calepinage décalé, margelles erronées, annotation conservée, équipement inventé, soleil impossible et contamination inter-dossiers.

### Modifications

- collecte orientée vers les ambiguïtés au lieu d'un interrogatoire exhaustif ;
- contrôle de la lumière renforcé ;
- verdict distinct selon l'usage maintenu pour les écarts mineurs ;
- noms de fichiers considérés comme indices et non comme contrat d'entrée.

### Décisions

ADR-014 à ADR-018.

### Condition de stabilité

La V1.4 devient Stable après exécution du plan de validation, correction des non-conformités bloquantes et approbation du responsable RIF.

## Versions antérieures

- V1.3 Stable — 28 juillet 2026 : collecte conditionnelle ENG-004, priorités matériau et compatibilité mode/style.
- V1.2 Stable — 20 juillet 2026 : modes, canevas fixe, compatibilité caméra et conformité par usage.
- V1.1 Stable — 13 juillet 2026 : première architecture documentaire à cinq niveaux.

