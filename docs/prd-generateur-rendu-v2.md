# PRD — Générateur de rendu V2

Version : 1.0
Date : 2026-08-07
Auteur : Alpha No_Code
Statut : à implémenter

---

## 1. Objet

Application web permettant de produire un rendu photoréaliste à partir d'exports Revit et d'une photo de site, puis de le corriger par cycles successifs jusqu'à validation.

Elle remplace l'interface Custom GPT de la V1. Le pipeline de génération (n8n → fal.ai / Nano Banana Pro) reste inchangé : seule la couche interface et la persistance sont nouvelles.

### 1.1 Utilisateur

Utilisateur unique, non technique. Il fournit des fichiers, renseigne des choix dans un formulaire, juge le résultat et demande des corrections. Il ne rédige pas de prompt et n'accède à aucune configuration technique.

### 1.2 Contrainte fondamentale

**La géométrie de la vue de cadrage fait autorité et ne doit jamais être modifiée** : formes, volumes, proportions, niveaux, ouvertures, toiture, implantation, cadrage, perspective.

Un rendu esthétiquement réussi mais géométriquement faux est un échec. Cette contrainte prime sur toute recherche de réalisme ou de qualité visuelle.

Elle doit être présente à trois endroits distincts :

1. dans le prompt système fixe de génération ;
2. répétée explicitement dans chaque prompt de correction — jamais supposée héritée du cycle précédent ;
3. dans le contrôle après correction, qui est obligatoire et non contournable.

### 1.3 Seconde exigence permanente

Le rendu attendu est **réaliste**. Aucun style illustratif, pictural ou stylisé, quel que soit le style de rendu sélectionné. Le style agit sur la lumière et la présentation, jamais sur l'architecture.

---

## 2. Périmètre

### 2.1 Dans le périmètre

- Formulaire web progressif en 7 étapes avec logique conditionnelle
- Upload et transmission des fichiers image
- Génération d'un rendu via le pipeline n8n existant
- Boucle post-génération : validation, correction ciblée par annotation, nouvelle génération
- Persistance Supabase : table `materiaux`, table `dossiers`
- Archivage des fichiers sur Google Drive par référence de dossier
- Point d'entrée unique côté n8n (webhook avec routage par `action`)
- Protection d'accès par mot de passe unique

### 2.2 Hors périmètre

Ne pas implémenter, ne pas anticiper, ne pas préparer de structure pour :

- La collecte automatisée de données cadastrales ou PLU
- Le calcul de surfaces et la vérification de conformité PLU
- Le contrôle de poids et format des PDF de dépôt
- Une table `profils` (presets de matériaux réutilisables)
- Un agent IA de rédaction ou de vérification de prompt
- Le masquage par inpainting (FLUX Fill) — reste au stade d'évaluation
- Le renommage ou l'anonymisation automatique des fichiers — traité manuellement en amont
- La gestion de comptes multi-utilisateurs, rôles ou permissions

Toute demande relevant de ces sujets doit être signalée, pas implémentée.

---

## 3. Architecture

### 3.1 Vue d'ensemble

```
Front React (SPA statique)
        │
        │  HTTPS, un seul webhook, champ "action"
        ▼
n8n (self-hosted)
        ├──► fal.ai / Nano Banana Pro   (génération et correction)
        ├──► Supabase REST              (materiaux, dossiers)
        └──► Google Drive               (archivage fichiers)
```

### 3.2 Principe d'isolation des secrets

Le front ne contient aucune clé d'API. Les identifiants fal.ai, Supabase et Google Drive restent exclusivement côté n8n.

Le navigateur ne communique qu'avec le webhook n8n. Aucun appel direct du front vers fal.ai, Supabase ou Drive n'est autorisé, y compris en développement.

### 3.3 Hébergement

- Front : hébergement statique (Vercel, Netlify ou Cloudflare Pages), déploiement depuis le dépôt Git
- Aucun serveur applicatif propre à maintenir
- HTTPS obligatoire

### 3.4 Point d'entrée n8n

Un webhook unique. Le corps de la requête contient toujours un champ `action` routé en interne par un node Switch.

| `action` | Rôle |
|---|---|
| `get_materiaux` | Retourne les matériaux de statut `valide`, groupés par catégorie |
| `generate` | Génère un rendu initial |
| `correct` | Applique une correction ciblée sur un rendu existant |
| `regenerate` | Relance une génération complète avec un seed différent |
| `validate` | Passe un cycle au statut `valide` |
| `get_dossier` | Retourne l'historique des cycles d'une référence |

Le front n'a jamais connaissance de plusieurs URL. Une seule est configurée, via variable d'environnement.

### 3.5 Contraintes techniques n8n

Ces points correspondent à des problèmes déjà rencontrés et résolus. Ils ne sont pas négociables.

- **Supabase** : utiliser le node HTTP Request vers l'API REST (PostgREST). Ne pas utiliser le node Supabase natif de n8n — bug 403 documenté et non résolu.
- **Authentification Supabase** : headers `apikey` et `Authorization: Bearer` posés directement dans le node HTTP Request. Ne pas utiliser une credential Header Auth partagée — ces objets sont partagés entre workflows dupliqués et se contaminent mutuellement.
- **Appels fal.ai** : le pattern asynchrone est obligatoire — POST, puis polling de `status_url` jusqu'à `COMPLETED`, puis récupération de `response_url`. Sans polling, la réponse ne contient qu'un accusé de soumission, pas d'image.
- **Transmission des images** : encodage base64 en data URI dans le tableau `image_urls`. Ne pas utiliser les URL de stockage fal.ai, qui se sont révélées inaccessibles.
- **Le polling est entièrement géré côté n8n**, dans une seule exécution de workflow. Le front envoie une requête et attend une réponse finale unique. Aucune logique de polling n'est implémentée côté client.

### 3.6 Paramètres API fixes

Ces valeurs sont définies au niveau du corps de la requête HTTP, pas dans le texte du prompt. Les paramètres API priment sur toute instruction textuelle.

| Paramètre | Valeur | Raison |
|---|---|---|
| `aspect_ratio` | `4:3` | Préserve le cadrage des exports Revit |
| `resolution` | `2K` | Le 1K par défaut est insuffisant pour le détail des tuiles, façades et volets |
| `seed` | `42` en génération | Stabilité pendant la phase de calibration |
| `seed` | aléatoire en régénération | Sans quoi deux « nouvelles générations » produiraient une image identique |

### 3.7 Point de vigilance à valider

Le bundle de correction transporte jusqu'à 4 images en base64, contre 2 aujourd'hui en génération. Le fonctionnement à 2 images est validé ; le comportement à 4 (taille de payload, limites n8n et fal.ai) doit être vérifié concrètement lors de l'implémentation, et non supposé.

---

## 4. Modèle de données

Projet Supabase unique, deux tables.

### 4.1 Table `materiaux`

Liste de valeurs alimentant les menus déroulants du formulaire, et file d'attente de calibration.

```sql
create table materiaux (
  id uuid primary key default gen_random_uuid(),
  terme text not null,
  categorie text not null check (categorie in ('toiture','facade','volets','menuiseries','margelles','plage')),
  fragment_prompt text,
  statut text not null default 'a_calibrer' check (statut in ('a_calibrer','valide','archive')),
  dossier_origine text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Règles :

- Seules les lignes `statut = 'valide'` alimentent les menus déroulants et la construction du prompt.
- `fragment_prompt` reste `null` tant que le statut est `a_calibrer`. Il est rédigé manuellement lors de la revue de calibration.
- Une saisie libre de l'utilisateur crée une ligne `a_calibrer`. Elle n'est jamais utilisée telle quelle pour construire un prompt, et n'apparaît jamais dans un menu déroulant.
- L'application n'écrit jamais `statut = 'valide'`. Ce passage est manuel.

### 4.2 Table `dossiers`

Historique des cycles. **Une ligne par cycle**, pas une ligne par dossier.

```sql
create table dossiers (
  id uuid primary key default gen_random_uuid(),
  reference text not null,
  statut text not null default 'en_cours' check (statut in ('en_cours','valide')),
  cycle_type text check (cycle_type in ('generation','correction','regeneration')),
  note text,
  image_url text,
  prompt text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
```

Règles :

- Une ligne est écrite par n8n **à chaque cycle**, immédiatement après réception de l'image générée — pas au moment de la validation. Les cycles non validés doivent rester tracés.
- `prompt` contient le texte du prompt envoyé, lisible directement.
- `payload` contient l'intégralité du corps envoyé à fal.ai : prompt système, seed, aspect_ratio, resolution, références d'images. Objectif : pouvoir reconstituer exactement ce qui a produit une image donnée.
- `note` contient l'annotation utilisateur pour les cycles de type `correction`.
- L'historique d'un dossier se lit en filtrant sur `reference`, trié par `created_at`.
- L'action `validate` met `statut = 'valide'` sur la ligne du cycle concerné.

### 4.3 Archivage Google Drive

Un dossier par référence. Y sont déposés :

- les fichiers d'origine (vue de cadrage, vue complémentaire, photo du site) ;
- chaque image produite, à chaque cycle.

`image_url` dans `dossiers` pointe vers le fichier Drive correspondant.

---

## 5. Formulaire — parcours en 7 étapes

Progressif : une étape à la fois. Les étapes déjà atteintes restent accessibles en arrière. L'état du formulaire persiste tant que la session est ouverte — une erreur ou un rechargement ne doit pas obliger à tout ressaisir.

### Étape 1 — Identification

| Champ | Type | Valeurs |
|---|---|---|
| Type de projet | choix unique, obligatoire | Piscine, Extension, Restructuration, Terrasse, Pool house |
| Usage du rendu | choix unique | Permis de construire, Présentation client, Les deux |

Le type de projet conditionne l'affichage des champs des étapes suivantes. Il est obligatoire pour passer à l'étape 2.

### Étape 2 — Documents

| Champ | Type | Obligatoire |
|---|---|---|
| Type de cadrage | Perspective / Axonométrie | oui |
| Vue de cadrage | fichier image | oui |
| Vue complémentaire | fichier image | non |
| Photo réelle du site | fichier image | non |

Règles :

- La **vue de cadrage** est la référence géométrique principale. Sans elle, la génération est impossible.
- La **vue complémentaire** est l'autre type de vue (axonométrie si le cadrage est une perspective, et inversement). Elle sert de référence de volume additionnelle.
- La **photo du site** est la référence de l'environnement réel : terrain, relief, accès, voisinage, végétation.
- Si le cadrage est une **perspective**, la photo peut servir de calque d'intégration aligné.
- Si le cadrage est une **axonométrie**, la photo ne sert que de référence d'ambiance et de matériaux : aucun alignement n'est possible avec une vue axonométrique. L'interface doit l'indiquer.

### Étape 3 — Matériaux

Menus déroulants alimentés par `get_materiaux` (statut `valide` uniquement), affichés selon le type de projet.

| Champ | Affiché pour |
|---|---|
| Toiture | tous sauf Piscine seule et Terrasse |
| Façade | tous sauf Piscine seule et Terrasse |
| Volets | tous sauf Piscine seule et Terrasse |
| Menuiseries | tous sauf Piscine seule et Terrasse |
| Margelles | Piscine, Pool house |
| Plage de piscine | Piscine, Pool house |

**Margelles et plage sont deux champs distincts.** Ce sont deux matériaux différents dans la pratique, ils ne doivent pas être fusionnés.

Chaque champ propose en complément une saisie libre « Autre texture ». Comportement obligatoire :

- La valeur saisie est envoyée en création de ligne `materiaux` avec `statut = 'a_calibrer'` et `dossier_origine` renseigné.
- Elle est affichée distinctement dans l'interface comme non calibrée.
- Elle n'apparaît jamais dans le menu déroulant tant qu'elle n'est pas passée à `valide` manuellement.

### Étape 4 — Environnement

| Champ | Type |
|---|---|
| Conserver la végétation existante | interrupteur, activé par défaut |
| Éléments à retirer | texte court |
| Ciel | Dégagé / Légèrement voilé / Neutre |

### Étape 5 — Style de rendu

Choix unique parmi cinq valeurs. Le style agit sur la lumière et la présentation, jamais sur l'architecture.

| Style | Usage |
|---|---|
| Administratif simple | Déclaration préalable, étude interne |
| Administratif soigné | Permis de construire — valeur par défaut |
| Présentation client | Réunion, avant-projet |
| Concours ou communication | Communication institutionnelle |
| Photomontage administratif | Insertion sur photo réelle |

Règles conditionnelles :

- **Photomontage administratif est indisponible dès que le cadrage est une axonométrie**, quel que soit le moment où ce choix est fait. Si l'utilisateur sélectionne ce style puis revient changer le cadrage, le style doit basculer automatiquement sur Administratif soigné.
- Usage « Présentation client » pré-sélectionne le style Présentation client ; les autres usages pré-sélectionnent Administratif soigné. Cette pré-sélection est écrasée dès que l'utilisateur choisit un style manuellement.

### Étape 6 — Précisions libres

Champ texte libre. Récapitulatif des matériaux non calibrés introduits à l'étape 3, s'il y en a.

### Étape 7 — Fiche projet

Récapitulatif de tous les choix, chacun avec un accès direct à l'étape correspondante pour modification. Bouton de lancement de la génération.

---

## 6. Construction du prompt

**Assemblage déterministe.** Aucun modèle de langage n'intervient dans la rédaction du prompt. Il s'agit d'une concaténation par gabarit, pas d'une décision.

Composition :

1. Le prompt système fixe, stocké côté n8n (node Set). Il porte notamment la contrainte de non-modification de la géométrie et le mandat de photoréalisme.
2. Les fragments `fragment_prompt` des matériaux sélectionnés, tirés de `materiaux`.
3. Les valeurs d'environnement, de ciel et de style.
4. Le texte libre de l'étape 6.

### 6.1 Règles de rédaction héritées de la calibration

Ces règles proviennent de comportements observés et corrigés. Elles doivent être respectées.

- **Ne jamais employer de vocabulaire de vieillissement ou de patine** pour les façades et les surfaces peintes : ces termes provoquent une dégradation excessive quel que soit le qualificatif employé. Ce vocabulaire reste acceptable pour la pierre.
- **Toute mention de variation naturelle de couleur pour la végétation doit être bornée**, sans quoi le résultat produit un aspect irrégulier et maladif.
- **Un seul bloc de style par appel.** Deux blocs de style contradictoires dans le même appel produisent des ambiances incohérentes d'une génération à l'autre.
- **Les zones vides des vues Revit** doivent être comblées par le contenu réel issu de la photo du site. Ni laissées vides, ni remplies par du contenu inventé. Un ciel seul est acceptable quand aucun contexte environnant n'est visible.
- **Aucune invention.** Un matériau inconnu n'est pas interprété : il est signalé ou laissé non spéculatif. Aucune ouverture, aucun volume, aucun élément secondaire n'est ajouté, supprimé ou déplacé.
- La tension entre l'exigence de photoréalisme et l'interdiction d'inventer est un point de défaillance connu : elle doit être traitée explicitement dans le prompt, pas laissée implicite.

### 6.2 Rôles des images en génération

Deux rôles distincts, identifiés par le contenu visuel et non par l'ordre d'envoi :

- **Vue de cadrage** : gouverne la géométrie.
- **Photo du site** : gouverne l'environnement.

Interdiction explicite de tirer les matériaux de la photo du site : les matériaux validés du projet priment sur ce que montre la photo.

---

## 7. Boucle post-génération

Après affichage du rendu, **trois issues possibles**, pas deux.

### 7.1 Valider

Acte explicite, pas une simple fermeture d'écran. Passe `statut = 'valide'` sur la ligne du cycle courant.

L'enregistrement conservé doit permettre de retrouver : la version validée, la vue de cadrage de référence, la photo utilisée, les informations du projet, la date, le prompt et le payload complet.

### 7.2 Corriger

Active le mode annotation sur l'image affichée.

L'utilisateur entoure une zone et saisit une note courte. Une correction ne peut pas être envoyée sans **au moins une zone annotée et une note**. Une demande de correction sans cible précise doit être refusée par l'interface.

La note doit couvrir : l'élément concerné, le défaut constaté, le résultat attendu.

**Bundle envoyé au moteur** — jusqu'à 4 images, chacune avec un rôle distinct explicitement assigné dans le prompt :

| Image | Rôle |
|---|---|
| Rendu à corriger | Base à éditer |
| Photo du site | Référence environnement et lumière |
| Vue complémentaire (axonométrie) | Référence de volume |
| Extrait de la zone annotée | Localisation précise du défaut |

Si la vue complémentaire n'a pas été fournie, le bundle tombe à 3 images.

**Point de vigilance obligatoire.** Le système à 2 images fonctionne parce qu'il n'y a que 2 rôles à distinguer. À 4 images, l'attribution des rôles devient plus fragile : le risque est que le moteur interprète l'extrait annoté comme une nouvelle géométrie à suivre plutôt que comme une zone à examiner. Les 4 rôles doivent être assignés explicitement dans le prompt, et ce comportement doit être testé sur un cas réel avant d'être considéré comme fiable.

Le prompt de correction doit également :

- rappeler explicitement la contrainte de non-modification de la géométrie ;
- lister les éléments à préserver ;
- ne modifier que ce qui est explicitement demandé.

### 7.3 Nouvelle génération

Relance le cycle complet depuis les données du formulaire, **avec un seed différent**. Ne repasse pas par la saisie du formulaire.

À recommander lorsque le cadrage est faux, que plusieurs volumes sont incorrects, que la perspective est déformée, ou que les corrections successives ont dégradé l'image.

### 7.4 Contrôle après correction

Le moteur ne garantit pas que la modification reste confinée à la zone annotée. Le contrôle après correction est donc le mécanisme qui tient la promesse de non-modification de la géométrie. Il est **obligatoire et non contournable**.

L'interface doit afficher **le nouveau résultat à côté de la dernière version validée**, pour permettre la comparaison. Le contrôle porte sur :

1. la zone modifiée ;
2. les éléments qui devaient être préservés ;
3. la comparaison avec la version précédente ;
4. la comparaison avec les références d'origine.

La décision finale reste humaine dans tous les cas. Aucun rendu n'est déclaré final sans validation explicite.

---

## 8. Sécurité et accès

- Accès protégé par un mot de passe unique partagé. Pas de comptes, pas de rôles, pas d'inscription.
- Implémentation au choix : protection native de la plateforme d'hébergement, ou vérification légère côté n8n posant un cookie.
- Aucune clé d'API dans le code front, dans le dépôt, ou dans les variables exposées au navigateur.
- L'URL du webhook n8n est fournie par variable d'environnement.

---

## 9. Critères d'acceptation

### Formulaire

- [ ] Le type de projet est obligatoire avant l'étape 2.
- [ ] Les champs Margelles et Plage n'apparaissent que pour Piscine et Pool house, et restent deux champs distincts.
- [ ] Les menus déroulants ne contiennent que des matériaux de statut `valide`.
- [ ] Une saisie libre crée une ligne `a_calibrer`, est visuellement distinguée, et n'entre jamais dans un menu déroulant ni dans un prompt.
- [ ] Le style Photomontage administratif devient indisponible dès que le cadrage passe en axonométrie, y compris si le style avait été choisi avant.
- [ ] Un retour en arrière ne perd aucune donnée saisie.

### Génération

- [ ] Aucune génération n'est possible sans vue de cadrage.
- [ ] `aspect_ratio: 4:3` et `resolution: 2K` sont présents dans le corps de la requête fal.ai, pas dans le texte du prompt.
- [ ] Le polling est effectué côté n8n ; le front reçoit une réponse unique contenant l'image.
- [ ] Une ligne `dossiers` est créée à chaque cycle, y compris non validé, avec `prompt` et `payload` renseignés.

### Boucle post-génération

- [ ] Les trois actions Valider, Corriger et Nouvelle génération sont proposées après chaque génération.
- [ ] Une correction sans zone annotée ou sans note est refusée.
- [ ] Une nouvelle génération utilise un seed différent du cycle précédent.
- [ ] Le résultat d'une correction est affiché à côté de la version précédente.
- [ ] La validation passe la ligne du cycle concerné à `statut = 'valide'`.

### Sécurité

- [ ] Aucune clé fal.ai, Supabase ou Drive n'est présente côté front.
- [ ] Le front n'appelle aucun service externe autre que le webhook n8n.
- [ ] L'application est inaccessible sans le mot de passe.

### Conformité au cadre

- [ ] Aucune terminologie interne (RIF, codes ADR/TEST/BLG, noms de modules documentaires) n'apparaît dans l'interface ni dans un texte visible par l'utilisateur.
- [ ] L'application n'écrit jamais `statut = 'valide'` dans `materiaux`.

---

## 10. Ordre d'implémentation

1. Schéma Supabase, deux tables, données de départ dans `materiaux`
2. Webhook n8n unique avec routage `action`, et `get_materiaux`
3. Formulaire 7 étapes, alimenté par `get_materiaux`
4. `generate` : construction du prompt, appel fal.ai, écriture `dossiers`, dépôt Drive
5. Écran post-génération avec les trois issues
6. Mode annotation et `correct` — avec vérification du comportement à 4 images
7. `regenerate` et `validate`
8. Protection d'accès et déploiement

Chaque étape doit être vérifiée sur un dossier réel avant de passer à la suivante.

---

## 11. Points ouverts

Ne pas traiter dans cette version. Consignés pour mémoire.

- Comportement du moteur avec un bundle de 4 images en correction — à tester lors de l'étape 6.
- Taille du payload base64 à 4 images — à mesurer.
- Évaluation de l'inpainting par masque (FLUX Fill) comme alternative à la correction par annotation. Change de moteur, donc risque de rupture de cohérence visuelle avec le rendu d'origine : à ne pas intégrer sans comparaison côte à côte sur un cas réel.
- Retrait de végétation existante : non résolu de façon fiable par le prompt seul.
