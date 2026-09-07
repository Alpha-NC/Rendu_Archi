# 04A_STYLES_DE_RENDU.md

ID : LIB-005  
Type : LIB  
Version : V1.4  
Statut : Review  
Niveau : L4  
Dossier : Framework/03_REFERENCES

---

# Styles de rendu

Objet

Cette bibliothèque décrit les styles de rendu qu'une implémentation du RIF peut appliquer selon le contexte du projet.

Le choix du style influence uniquement l'apparence visuelle de l'image.

La géométrie et les caractéristiques du projet restent inchangées, pour les trois styles sans exception, y compris le style Commercial défini en section 3.

Principe général

Le style est sélectionné selon la demande explicite de l'utilisateur, ou à défaut selon le type de projet.

Si une photographie réelle est fournie pour un usage administratif, l'implémentation propose le style Photomontage administratif. Sans photographie, ce style est exclu.

Le style Commercial (section 3) fait exception à ce principe : il n'est jamais sélectionné par défaut ni par la règle de sélection automatique. Il ne peut être choisi que sur demande explicite de l'utilisateur.

Styles disponibles
1. Photomontage administratif
Utilisation
Insertion sur photographie réelle
Permis de construire
Déclaration préalable
Autorisations d'urbanisme
Objectif

Intégrer le projet dans la photographie avec le maximum de crédibilité.

Caractéristiques
respect de la lumière existante ;
respect des ombres présentes ;
respect du relief ;
conservation de la végétation existante ;
intégration discrète.
netteté uniforme sur toute la profondeur utile de l'image.

Aucun effet artistique.

Ce style constitue le style par défaut.

2. Présentation client
Utilisation
Réunion client
Avant-projet
Objectif

Valoriser le projet sans le transformer.

Caractéristiques
photoréalisme élevé ;
lumière chaleureuse mais réaliste ;
textures plus détaillées ;
ciel agréable ;
environnement légèrement valorisé.
homogénéité du niveau de détail sur toute l'image ;
matières lisibles comme dans une prise de vue rapprochée ;
légère réduction de profondeur de champ limitée à l'arrière-plan ;
lumière et ciel plus présents que dans le style administratif, sans incohérence physique.

Les éléments ajoutés doivent rester discrets.

3. Commercial
Utilisation
Communication résidentielle
Book professionnel, portfolio
Support commercial

Jamais un dossier administratif ou réglementaire — ce style ne remplace jamais Photomontage administratif dans cet usage.

Objectif

Produire une image valorisante au registre visuel établi de la photographie d'architecture résidentielle professionnelle (« dusk shot »), tout en conservant la fidélité géométrique du projet.

Caractéristiques
moment de la journée explicitement choisi : plein jour, fin de journée ou crépuscule ;
éclairage intérieur visible à travers les baies, suggérant une ambiance de vie sans nécessiter de détail précis à l'intérieur ;
éclairage extérieur ponctuel autorisé lorsque le moment choisi le justifie : margelles, éclairage sous-marin de la piscine, appliques en façade ;
contraste marqué ;
couleurs riches et profondes ;
matières à fort relief, grain et profondeur de champ travaillés.
Règles propres à ce style

Ce style n'est pas soumis à la section 5 (Interdictions communes aux styles administratifs) : coucher de soleil, éclairage nocturne et contraste marqué y sont explicitement autorisés, par exception documentée.

Il reste soumis, sans aucune exception, aux Règles communes de la section 4 : géométrie, ouvertures, toiture, cadrage, matériaux connus et environnement réel demeurent inchangés. Ce style porte uniquement sur l'ambiance et la lumière, jamais sur l'architecture.

Le nom du style utilisé doit apparaître systématiquement dans la fiche projet et dans tout export produit avec ce style, afin d'éviter toute confusion avec un rendu à vocation administrative.

La grille de contrôle qualité (LIB-002) s'applique différemment à ce style : la géométrie et l'implantation restent contrôlées à l'identique des deux autres styles, mais l'appréciation de la lumière et de l'ambiance devient qualitative plutôt que conforme/non conforme.

4. Règles communes

Quel que soit le style choisi, y compris Commercial :

conserver la géométrie ;
conserver les ouvertures ;
conserver la toiture ;
conserver le cadrage ;
respecter les matériaux connus ;
respecter l'environnement réel.

Le style ne doit jamais modifier l'architecture.

5. Interdictions communes aux styles administratifs

Applicables à Photomontage administratif et Présentation client. Le style Commercial (section 3) y fait exception, selon ses règles propres définies dans sa propre section.

Éviter systématiquement :

HDR excessif ;
couleurs saturées ;
couchers de soleil dramatiques ;
scènes nocturnes ;
personnages mis en avant ;
végétation luxuriante non demandée ;
effets cinématographiques ;
publicité immobilière.
Sélection automatique

Photographie réelle fournie (cas standard)

→ Photomontage administratif

Réunion client, avant-projet

→ Présentation client

Si plusieurs styles sont possibles, l'implémentation demande confirmation à l'utilisateur.

Le style Commercial n'entre jamais dans cette sélection automatique, quelle que soit la situation. Il ne peut être choisi que sur demande explicite.

Évolution

De nouveaux styles pourront être ajoutés selon les besoins des projets, chacun devant respecter les principes du référentiel général, à l'exception d'un style explicitement documenté comme dérogatoire, comme Commercial l'est vis-à-vis de la section 5.

Historique

V1.2 — Réduction de cinq à trois styles actifs (Administratif simple et Concours ou communication retirés de l'usage courant à la demande d'Alpha No_Code) ; ajout du style Commercial.

V1.4 — Clarification : aucun style, y compris Commercial, n'autorise l'invention d'un élément architectural ou technique ni la reprise de la composition d'une référence matériau.
