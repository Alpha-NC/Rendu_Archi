# Archive des décisions V1.1 à V1.3

Ce document conserve le sens des décisions antérieures reprises par la V1.4.

## Socle V1.1

- ADR-001 : le Framework est indépendant de tout moteur ou plateforme.
- ADR-002 : chaque module possède une responsabilité unique.
- ADR-003 : chaque information permanente dispose d'une source unique de vérité.
- ADR-004 : architecture en cinq niveaux.
- ADR-005 : cycle Draft → Review → Stable → Archived.
- ADR-006 : les idées non publiées restent dans le Backlog.
- ADR-007 : chaque module répond à une question documentaire identifiable.

## V1.2

### ADR-008 — Séparation mode/style

Le mode décrit comment l'image est fabriquée ; le style décrit son apparence. Le mode est choisi avant le style.

### ADR-009 — Photographie comme canevas fixe

En Photomontage contrôlé, la photographie réelle demeure le canevas. Les modifications sont limitées aux zones d'intervention et raccords locaux ; le paysage et le voisinage ne sont pas régénérés globalement.

### ADR-010 — Compatibilité caméra

Un photomontage administratif exige une caméra compatible. Un état Approximatif appelle calibration ou nouvelle vue ; Incompatible ou Non évalué bloque l'administratif.

### ADR-011 — Conformité selon l'usage

Tout verdict précise l'usage évalué. Un rendu peut être acceptable en présentation et insuffisant en administratif.

## V1.3

### ADR-012 — Donnée matériau validée

Pour un élément existant conservé, la photographie fait référence sur l'aspect. Pour un élément modifié ou explicitement validé, la donnée projet validée prévaut. L'absence de qualification doit être clarifiée.

### ADR-013 — Compatibilité mode/style et collecte conditionnelle

Le style Photomontage administratif suppose une photographie réelle et ne s'applique pas à la Retexturation Revit seule. ENG-004 adapte les questions à la combinaison mode × style.

