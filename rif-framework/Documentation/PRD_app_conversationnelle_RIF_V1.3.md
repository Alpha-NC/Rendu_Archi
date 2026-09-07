# PRD — Application conversationnelle RIF (hors ChatGPT)

**Auteur :** Alpha_no_code  
**Client pilote :** Évariste Blasco — dessinateur, Biarritz  
**Version du PRD :** V1.3  
**Statut :** Draft révisé post-audit et retours terrain — en attente de validation de la Phase 0  
**Date de révision :** 07.09.2026

> Cette version intègre les conclusions du prémortem du 02.09.2026, de l'audit architectural du 06.09.2026 et des réunions de travail des 17.07, 04.08 et 12.08.2026. Elle sépare clairement le Framework RIF, son package d'implémentation, l'orchestration déterministe, l'interface conversationnelle et le profil propre à Évariste.

---

## 1. Résumé

Créer une application conversationnelle propriétaire permettant à Évariste de produire, contrôler, corriger et valider des rendus architecturaux selon les règles du Rendering Intelligence Framework.

L'application ne remplace pas le Framework RIF. Elle constitue une nouvelle implémentation du Framework, indépendante de ChatGPT. Le Custom GPT actuel reste une implémentation historique et un filet de sécurité temporaire pendant la phase de coexistence.

L'application combine :

- une interface de chat en langage naturel ;
- un état de projet structuré et persistant ;
- un backend imposant les étapes, autorisations et blocages ;
- un LLM multimodal pour dialoguer, analyser les sources et préparer les données ;
- une génération via Nano Banana Pro sur fal.ai, sous réserve de validation de l'endpoint exact en Phase 0 ;
- un contrôle qualité distinct de la génération ;
- une validation humaine obligatoire avant tout export destiné à un usage administratif.

L'utilisateur n'a besoin ni d'un compte ChatGPT ni d'un abonnement ChatGPT. Il accède au service avec le compte propre à RIF-App.

L'objectif est d'éliminer les limites observées avec le Custom GPT — déclenchement d'Action non fiable, timeout, concurrence avec la génération native et identifiants partagés — sans perdre l'expérience conversationnelle demandée par Évariste.

## 2. Positionnement dans l'architecture RIF

La séparation suivante est obligatoire :

```text
Framework RIF
  → règles métier et sources de vérité
    → package d'implémentation RIF versionné
      → orchestrateur applicatif déterministe
        → interface conversationnelle et services techniques
```

### 2.1 Framework RIF

Le Framework reste l'autorité sur la hiérarchie des sources, les modes de production, les styles de rendu, la collecte conditionnelle, les interdictions, la préparation des prompts, les corrections et la checklist de contrôle qualité.

Le PRD ne modifie aucune règle stable du Framework. Toute évolution structurelle du Framework suit le processus **Backlog → ADR → nouvelle version**.

### 2.2 Package d'implémentation RIF

L'application consomme un package figé et identifiable contenant les versions compatibles des modules RIF nécessaires à son fonctionnement. Elle ne doit pas dépendre d'un « prompt patché » non traçable.

Chaque génération enregistre au minimum la version du Framework, du package d'implémentation, du prompt système, du modèle conversationnel et du moteur d'image.

### 2.3 Contrainte propre à RIF-App V1

Une vue Revit exploitable est obligatoire dans cette application V1. Cette obligation constitue une contrainte du produit destiné à Évariste, et non une nouvelle règle universelle du Framework.

## 3. Contexte et problème

Évariste produit actuellement ses rendus via GPT RIF, un Custom GPT relié à n8n et fal.ai. Cette implémentation souffre de pannes récurrentes ou difficilement observables : non-déclenchement de l'Action, timeout de la plateforme, concurrence avec le générateur d'images natif et gestion imparfaite des identifiants techniques.

Évariste a testé et rejeté une alternative fondée sur un formulaire déterministe visible. Il attend une expérience conversationnelle simple, et non une succession de champs techniques.

Le besoin n'est donc pas de supprimer le déterminisme, mais de le déplacer dans le backend :

- l'utilisateur conserve une conversation naturelle ;
- le système conserve un parcours strict, vérifiable et impossible à contourner ;
- le chat n'est jamais la source de vérité du dossier.

La logique de collecte conditionnelle ENG-004 doit être appliquée dès la V1 afin de réduire les questions inutiles tout en maintenant les validations indispensables.

## 4. Principes non négociables

1. **Le Framework gouverne l'application.** L'implémentation ne redéfinit pas silencieusement ses règles.
2. **Le backend impose le parcours.** Le LLM ne peut ni sauter une étape ni lever seul un blocage.
3. **Le ProjectState est la source de vérité opérationnelle.** Le fil de conversation n'a qu'un rôle d'interface et de preuve contextuelle.
4. **Revit reste l'autorité géométrique.** La photographie reste l'autorité environnementale dans les cas prévus par le Framework.
5. **L'application ne prétend pas garantir une fidélité que le moteur génératif ne peut démontrer.** Elle détecte, classe, bloque et fait valider.
6. **La génération et son contrôle sont deux opérations distinctes.** L'auto-évaluation du modèle producteur ne suffit jamais à déclarer un rendu conforme.
7. **Évariste valide volontairement tout rendu administratif avant export.** L'IA prépare ; le professionnel décide.
8. **Toute opération est traçable.** Aucun rendu ne doit exister sans dossier, état, sources et versions techniques associés.
9. **Chaque dossier est étanche.** Une tentative ratée, un autre projet ou une conversation antérieure ne peut influencer implicitement une génération.
10. **Une référence matériau ne commande que l'apparence de l'élément ciblé.** Elle ne transmet jamais sa composition, sa géométrie, sa caméra ou son environnement.
11. **Une annotation est une instruction, pas un contenu.** Ses marques servent à localiser une action et sont toujours absentes du rendu final.

## 5. Objectifs et métriques de succès

| Objectif | Métrique V1 |
|---|---|
| Fiabilité d'orchestration | 0 échec silencieux sur 20 opérations consécutives ; chaque opération possède un statut terminal ou une erreur explicite |
| Respect du parcours | 0 génération possible avant validation de la fiche projet et levée des blocages obligatoires |
| Détection des défauts critiques | 100 % des défauts éliminatoires introduits dans le jeu de test de référence sont signalés avant export administratif |
| Traçabilité | 100 % des générations reliées à leurs sources, ProjectState, versions, coûts et résultats de contrôle |
| Parité d'usage perçue | Évariste juge la conversation aussi fluide ou plus fluide que GPT RIF lors d'un test comparatif |
| Collecte conditionnelle | Réduction mesurée du nombre de questions sur au moins 5 dossiers représentatifs, sans perte d'information obligatoire |
| Reprise de session | 100 % des dossiers de test reprennent sur le dernier état validé après fermeture ou rafraîchissement |
| Isolation | 0 donnée, source ou instruction issue d'un autre dossier ou d'une tentative antérieure sur le jeu de tests croisés |
| Fluidité | Sur un dossier standard, les sources et 2 à 3 lignes de contexte suffisent avant des confirmations ciblées |
| Variantes | 100 % des variantes restent comparables, historisées et rattachées à la même révision d'état |
| Viabilité économique | Coût complet par dossier mesuré : LLM, 2 à 3 variantes usuelles, corrections, stockage et support, confronté au tarif de 60 €/mois |

Le critère de détection qualité est évalué sur un jeu de tests annoté manuellement. Il ne constitue pas une promesse d'absence absolue d'erreur sur tout futur projet.

## 6. Utilisateurs et responsabilités

- **Utilisateur opérationnel : Évariste Blasco.** Dépose les sources, répond aux questions, confirme la fiche projet, examine le contrôle et valide ou refuse le rendu.
- **Opérateur technique : Alpha_no_code.** Maintient l'application, les versions d'implémentation, la supervision, les tests et le support avec le SLA contractuel de 24 h.
- **Administration instructrice.** Destinataire indirect du résultat ; elle n'interagit jamais avec l'application.

Évariste reste responsable de la conformité réglementaire finale et de l'usage du document produit. L'application ne réalise aucun contrôle PLU ou réglementaire.

## 7. Périmètre V1

### 7.1 Inclus

- création et reprise d'un dossier ;
- dépôt d'une vue Revit obligatoire ;
- dépôt conditionnel d'une photographie du site ;
- dépôt facultatif d'une axonométrie utilisée uniquement comme contrôle secondaire des volumes ;
- dépôt groupé de plusieurs fichiers, détection assistée de leurs rôles et confirmation utilisateur ;
- dépôt de sources annotées, photographies de matériaux et photographies du bâti existant ;
- analyse initiale des sources et détection de données confidentielles visibles ;
- pré-analyse des matériaux et contraintes avec provenance et niveau de confiance ;
- qualification de la compatibilité des caméras ;
- collecte conversationnelle avec ENG-004 ;
- sélection du mode et du style selon le Framework, dont exclusion structurelle prévue par ADR-013 ;
- construction et confirmation de la fiche projet ;
- génération asynchrone via fal.ai ;
- production de plusieurs variantes d'une même vue, comparaison et sélection d'un résultat canonique ;
- contrôle qualité assisté et rapport par critère ;
- correction ciblée ;
- redémarrage depuis les sources originales lorsque la base n'est plus fiable ;
- validation humaine avant export administratif ;
- stockage privé, historique, journalisation et mesure des coûts ;
- livraison par lien de téléchargement contrôlé et, si retenu, copie vers Drive.

### 7.2 Hors périmètre

- gestion de plusieurs organisations ou équipes ;
- calcul de surfaces et conformité PLU ;
- collecte cadastrale automatisée ;
- compression ou contrôle de poids des PDF ;
- traitement groupé de plusieurs vues en une seule génération ;
- garantie automatisée de conformité réglementaire ;
- bascule silencieuse vers un autre LLM ou moteur d'image.
- fonctionnement hors connexion ; l'application est un service connecté avec reprise propre après perte réseau.

## 8. Parcours déterministe du dossier

Chaque dossier possède un état contrôlé par le backend :

```text
BROUILLON
  → SOURCES_REÇUES
  → SOURCES_CONTRÔLÉES
  → COLLECTE_EN_COURS
  → FICHE_À_CONFIRMER
  → PRÊT_À_GÉNÉRER
  → GÉNÉRATION_EN_COURS
  → CONTRÔLE_À_EXAMINER
  → VALIDÉ | À_CORRIGER | À_REPRENDRE | SUSPENDU | ÉCHEC
```

Une transition n'est autorisée que si ses préconditions sont satisfaites. Le LLM peut proposer une transition ; seul le backend l'applique.

Les principales conditions bloquantes sont : vue Revit absente ou inexploitable, données confidentielles non traitées, incompatibilité majeure des caméras pour un usage administratif, information indispensable inconnue, contradiction avec une source autoritaire, fiche projet non confirmée et contrôle Non conforme pour un export administratif.

## 9. Exigences fonctionnelles

### 9.1 Étape 1 — Réception des documents

- La vue Revit est obligatoire pour RIF-App V1.
- La photographie du site est obligatoire pour un Photomontage contrôlé et pour tout usage administratif nécessitant une insertion réelle.
- L'axonométrie est facultative et ne devient jamais une autorité de cadrage ou de perspective.
- L'utilisateur peut déposer toutes les sources d'un dossier en une seule opération logique.
- Les rôles pris en charge sont au minimum : `revit_view`, `site_photo`, `axonometry`, `annotated_source`, `material_reference`, `existing_building_photo`, `render` et `annotated_render`.
- Le système propose automatiquement le rôle de chaque fichier puis demande une confirmation groupée ; seuls les cas ambigus sont traités individuellement.
- La convention historique `image1_revit.jpg`, `image2_site.jpg`, etc. est acceptée mais n'est plus obligatoire. Le nom de fichier est un indice, jamais une autorité.
- Le format, la taille, l'intégrité, la résolution et la lisibilité minimale sont contrôlés avant la collecte. La vue doit montrer suffisamment le bâtiment, notamment sa toiture et ses ouvertures.
- Les fichiers sont stockés en privé et identifiés par des IDs internes.
- Les noms techniques sont nettoyés côté serveur et les informations sensibles sont signalées sans imposer un renommage manuel à l'utilisateur.

### 9.2 Étape 2 — Contrôle initial

L'application établit et enregistre le rôle de chaque source, la source autoritaire par domaine et par élément, la présence éventuelle d'informations confidentielles, la compatibilité caméra (`Compatible`, `Approximative`, `Incompatible` ou `Non évaluée`), les ambiguïtés et blocages ainsi que les zones initialement modifiables et verrouillées.

Elle pré-analyse les matériaux et les détails visibles. Chaque proposition comporte sa provenance et un niveau de confiance. Les matériaux rares, inconnus, peu lisibles ou contradictoires restent explicitement à confirmer.

Une photographie de matériau est reliée à l'élément qu'elle documente. Son autorité est limitée à la nature, la teinte, la texture, la finition, le relief et le calepinage visible de cet élément.

Une source annotée est convertie en directives localisées de type `conserver`, `supprimer`, `remplacer`, `corriger` ou `verrouiller`. Si la cible ou l'action n'est pas certaine, l'utilisateur confirme avant la suite. Les marques graphiques ne sont jamais intégrées au résultat.

Une incompatibilité majeure en usage administratif suspend le parcours et demande une nouvelle vue ou une calibration.

### 9.3 Étape 3 — Collecte progressive

La collecte couvre les huit groupes du tronc commun :

1. type de projet, phase et usage ;
2. mode de production et implantation ;
3. éléments architecturaux intouchables ;
4. matériaux existants conservés ou modifiés ;
5. environnement à conserver, supprimer ou améliorer ;
6. orientation ou ambiance lumineuse ;
7. style de rendu ;
8. personnages, véhicules et mobilier.

ENG-004 détermine si chaque question est inchangée, réduite, convertie en confirmation, retirée ou complétée. Les règles de branchement sont appliquées par l'orchestrateur et non laissées à la seule initiative du LLM.

Le parcours nominal commence par les sources et une description libre courte de deux ou trois lignes. L'application récapitule ce qu'elle a compris, propose les rôles et matériaux détectés, puis ne questionne que les informations indispensables inconnues, ambiguës, contradictoires ou soumises à validation obligatoire.

Le type de projet est un champ ouvert avec suggestions ; il ne peut être limité à une liste fermée. La référence du dossier est générée automatiquement et peut être renommée sans bloquer le parcours.

### 9.4 Étape 4 — Fiche projet

La fiche affiche les données validées et provisoires, la hiérarchie des sources, le mode et le style, les zones modifiables et verrouillées, les matériaux et leurs références limitées, les directives issues d'annotations, les éléments intouchables, les suppressions et ajouts autorisés, les interdictions et les éventuelles réserves.

Une action explicite d'Évariste est obligatoire pour passer à `PRÊT_À_GÉNÉRER`.

### 9.5 Étape 5 — Génération

- Une seule opération technique peut être active par dossier, mais une opération peut demander plusieurs variantes bornées d'une même vue.
- Le backend construit la requête à partir du ProjectState confirmé et du package RIF versionné.
- Le LLM ne peut pas appeler librement le moteur avec un prompt non validé par le backend.
- Le polling se poursuit jusqu'à un état terminal : succès, échec ou timeout.
- Le résultat est enregistré avant d'être présenté comme disponible.
- Chaque variante reçoit son propre identifiant, coût, audit et lien vers la même révision immuable. Aucun essai précédent n'est injecté implicitement dans la requête.

### 9.6 Après génération

Le rendu entre obligatoirement dans l'état `CONTRÔLE_À_EXAMINER`. Il n'est jamais déclaré conforme sur la seule base de la réponse du moteur d'image.

Le rapport compare le rendu aux sources sur le cadrage, la perspective, les volumes, les ouvertures, la toiture, l'implantation, le terrain, l'environnement, les matériaux, la lumière, les éléments secondaires et la confidentialité.

Chaque critère reçoit l'état `Conforme`, `Réserve`, `Non conforme` ou `Non applicable`, conformément à LIB-002.

Lorsque plusieurs variantes existent, l'interface permet de les comparer, de consulter leurs réserves et d'en sélectionner explicitement une comme résultat canonique. Une sélection ultérieure ne supprime pas l'historique.

## 10. ProjectState — source de vérité opérationnelle

Le ProjectState est un objet structuré distinct de la conversation. Chaque donnée significative contient, selon son type :

- `value` : valeur courante ;
- `status` : `provisional`, `validated`, `rejected` ou `unknown` ;
- `source_id` : document, utilisateur ou règle à l'origine de la valeur ;
- `authority` : domaine d'autorité applicable ;
- `editable` et `locked` ;
- `validated_by` et `validated_at` ;
- `notes` : ambiguïté ou réserve éventuelle.

Le ProjectState contient au minimum l'identité et l'usage du dossier, les sources et leurs rôles détectés et confirmés, la compatibilité caméra, le mode et le style, la géométrie décrite, l'implantation, la zone d'intervention, les matériaux par élément avec provenance et confiance, les références matériau limitées, les directives localisées, l'environnement à conserver, les opérations autorisées, la lumière, les zones verrouillées, les interdictions, les validations, les réserves et le résultat canonique éventuel.

Le prompt final est toujours généré depuis une version immuable du ProjectState confirmé. Une modification ultérieure crée une nouvelle révision.

## 11. Architecture technique cible

```text
Frontend
  chat + dépôt de sources + fiche projet + écran de contrôle

Backend applicatif
  authentification + sessions + machine à états + règles de transition

RIF Core / package d'implémentation versionné
  collecte ENG-004 + modes + styles + prompt + corrections + contrôle

LLM multimodal
  dialogue + extraction structurée + analyse assistée des sources

Services de production
  génération fal.ai + stockage privé + contrôle + export

Supabase
  ProjectState + événements + générations + audits + coûts
```

Le LLM reçoit uniquement les outils autorisés pour l'état courant. Les préconditions sont revérifiées côté backend à chaque appel ; masquer un outil au modèle ne constitue pas à lui seul une protection suffisante.

## 12. Stockage et transport des fichiers

- Les sources et rendus sont stockés dans un bucket privé.
- La base relationnelle ne contient que leurs identifiants et métadonnées.
- Le backend résout les IDs internes en contenu ou en URL signée temporaire selon les contraintes du fournisseur.
- Aucune URL publique permanente n'est utilisée.
- Le base64 n'est utilisé que lorsqu'il est nécessaire et compatible avec les limites de taille ; il n'est pas une obligation générale.
- Les liens de téléchargement sont temporaires ou soumis à authentification.
- La perte de connexion n'autorise aucune génération locale ou implicite ; l'interface conserve l'état connu, signale le mode hors ligne et réconcilie l'opération au retour du réseau.
- Une éventuelle copie Drive intervient après enregistrement du rendu canonique et ne constitue pas la source de vérité.

## 13. Modèle de données minimal

### 13.1 Table `dossiers`

| Champ | Type | Description |
|---|---|---|
| `id` | uuid | Identifiant interne |
| `owner_id` | uuid | Utilisateur autorisé |
| `dossier_ref` | text | Référence générée automatiquement, modifiable et non bloquante |
| `workflow_state` | text | État déterministe courant |
| `project_state` | jsonb | État projet structuré courant |
| `project_state_revision` | integer | Révision de l'état |
| `framework_version` | text | Version du Framework utilisée |
| `implementation_version` | text | Version du package RIF-App |
| `created_at`, `updated_at` | timestamp | Horodatage |

### 13.2 Table `files`

| Champ | Type | Description |
|---|---|---|
| `id` | uuid | Identifiant interne |
| `dossier_id` | uuid | Dossier propriétaire |
| `role_detected`, `role_confirmed` | text | Rôle proposé puis rôle validé parmi les rôles pris en charge |
| `original_name`, `safe_name` | text | Nom reçu et nom technique nettoyé |
| `storage_key` | text | Référence privée de stockage |
| `mime_type`, `size_bytes`, `checksum` | divers | Contrôle d'intégrité |
| `created_at` | timestamp | Horodatage |

### 13.3 Table `generations`

| Champ | Type | Description |
|---|---|---|
| `id` | uuid | Identifiant de l'opération |
| `dossier_id` | uuid | Dossier concerné |
| `type` | text | `initial`, `correction`, `restart_from_sources` |
| `batch_id`, `variant_index` | divers | Groupe de variantes et position dans ce groupe |
| `status` | text | `queued`, `running`, `succeeded`, `failed`, `timed_out` |
| `project_state_revision` | integer | Révision immuable utilisée |
| `prompt_text` | text | Prompt technique effectivement envoyé |
| `source_file_ids` | jsonb | Sources effectivement utilisées |
| `result_file_id` | uuid | Rendu canonique produit |
| `is_canonical` | boolean | Sélection humaine comme résultat courant |
| `provider_request_id` | text | Référence technique fournisseur |
| `cost_actual` | numeric | Coût réel de l'opération |
| `started_at`, `completed_at` | timestamp | Horodatage |

### 13.4 Table `quality_audits`

Elle conserve le rapport par critère, le verdict proposé, la validation humaine, les réserves et la version de la checklist utilisée.

### 13.5 Table `events`

Journal append-only des transitions importantes, erreurs, confirmations et actions humaines. L'historique de conversation peut être stocké séparément, mais il ne remplace pas ce journal.

### 13.6 Directives localisées et références matériau

Elles peuvent être conservées dans le `project_state` ou dans des tables dédiées si la Phase 0 l'exige. Dans les deux cas, elles stockent la source, la cible, la zone ou le masque, l'action, la consigne, le statut de confirmation et le périmètre d'autorité.

## 14. Contrats des opérations techniques

### 14.1 `genererRenduFlux`

Entrées minimales : `dossierId`, révision confirmée du ProjectState, IDs des sources autorisées, prompt construit par RIF Core, mode, style, nombre de variantes borné et version du package d'implémentation.

L'opération est refusée si le dossier n'est pas dans l'état `PRÊT_À_GÉNÉRER`.

### 14.2 `corrigerRenduFlux`

Entrées minimales : rendu de base, sources nécessaires, correction ciblée, zones modifiables et verrouillées, éléments déjà validés et critères de non-régression.

L'opération est réservée aux corrections localisées pour lesquelles le rendu existant reste une base fiable.

### 14.3 `reprendreDepuisSources`

Cette opération distincte est utilisée lorsque la géométrie ou la caméra a dérivé, l'environnement verrouillé a été altéré, plusieurs corrections ont accumulé des régressions ou le dernier rendu n'est plus une base fiable.

Elle repart des sources originales et d'une nouvelle révision confirmée du ProjectState. Elle ne doit pas être présentée comme une correction locale.

Les schémas techniques définitifs seront validés en Phase 0. L'ancien schéma OpenAPI de l'Action ChatGPT constitue une référence historique, pas une dépendance.

## 15. Contrôle qualité et validation humaine

### 15.1 Séparation des responsabilités

Le contrôle qualité est exécuté dans une étape, un contexte et un enregistrement distincts de la génération. Il peut utiliser un modèle multimodal, des comparaisons assistées ou des contrôles déterministes, mais aucun verdict automatique ne remplace la validation d'Évariste pour un usage administratif.

### 15.2 Jeu de tests de référence

Le jeu de tests contient les cas LIB-003 applicables, des rendus conformes annotés, des rendus volontairement altérés, des défauts éliminatoires connus et le verdict humain attendu pour chaque critère.

La Phase 0 mesure séparément la détection des défauts critiques, les faux verdicts `Conforme`, les réserves correctement remontées et la cohérence entre exécutions répétées.

### 15.3 Garde-fou d'export

Avant tout export administratif, l'interface affiche le rapport complet et exige une action volontaire d'Évariste. Un rendu `Non conforme`, `SUSPENDU` ou non contrôlé ne peut pas être exporté comme rendu administratif.

Aucun rendu n'est marqué `utilisé`, `validé` ou `conforme` automatiquement.

## 16. Corrections et non-régression

- Une correction modifie uniquement l'élément explicitement demandé.
- Les éléments déjà validés restent verrouillés.
- Un audit de non-régression est exécuté après chaque correction.
- Une annotation de correction est convertie en directive localisée ; cercle, flèche, surlignage et texte ne doivent jamais subsister dans la sortie.
- Une correction locale échoue proprement si elle exige de modifier une source autoritaire ou une zone verrouillée.
- Lorsque la base n'est plus fiable, le système propose `reprendreDepuisSources`.
- L'historique conserve le lien entre rendu initial, corrections successives et éventuel redémarrage.

Cette distinction résout l'apparente contradiction entre « ne jamais régénérer globalement lors d'une correction » et « repartir des sources lorsque le rendu a dérivé ».

## 17. Sécurité et confidentialité

- Authentification individuelle obligatoire avant tout dossier réel, même avec un seul utilisateur.
- Sessions sécurisées et révocables.
- Row Level Security activée et testée sur toutes les tables exposées côté client.
- Autorisations vérifiées côté backend pour chaque dossier et fichier.
- Clés LLM, fal.ai, stockage et Drive conservées exclusivement côté serveur dans des secrets d'environnement.
- Aucun secret dans le frontend, le prompt, les logs accessibles à l'utilisateur ou le dépôt Git.
- Buckets privés et liens temporaires.
- Détection des noms, adresses, cartouches et références sensibles avant envoi à un fournisseur externe.
- Politique de rétention et procédure de suppression documentées avant la Phase 1.
- Conditions des fournisseurs concernant conservation, sous-traitance et entraînement vérifiées avant tout dossier réel.

## 18. Journalisation, erreurs et reprise

### 18.1 Journalisation transactionnelle

Une ligne `generations` est créée avant l'appel fournisseur avec le statut `queued`, puis passe à `running` et à un état terminal. Ainsi, une panne après l'appel ne crée jamais de rendu orphelin ou d'opération invisible.

Les écritures secondaires non critiques peuvent être différées, mais l'identité de l'opération et son statut ne le sont jamais.

### 18.2 Messages d'erreur

- L'erreur technique brute est conservée dans les logs internes avec un identifiant de corrélation.
- Évariste reçoit un message clair et exploitable, sans secret, trace interne ou détail fournisseur sensible.
- Le système ne devine jamais un résultat lorsque le fournisseur échoue.
- Une relance crée une nouvelle tentative traçable et ne réutilise pas aveuglément une requête dont l'état est inconnu.

### 18.3 Cas limites

- Message d'attente visible après 15 secondes.
- Timeout explicite après 3 minutes, sous réserve d'ajustement mesuré en Phase 0.
- Reprise du polling si la page est rafraîchie pendant une génération.
- Réconciliation avec le statut fournisseur avant toute relance après perte de connexion.
- Upload invalide refusé avant la collecte.
- Caméra incompatible affichée comme état bloquant dans l'interface.
- Panne LLM affichée sans bascule silencieuse vers un autre modèle.

## 19. Exigences non fonctionnelles

- **Performance conversationnelle :** première réponse utile visée sous 5 secondes hors analyse lourde des images.
- **Génération :** objectif sous 90 secondes en fonctionnement normal, mesure réelle en Phase 0.
- **Résilience :** rafraîchir ou fermer le navigateur ne perd ni le dossier ni une génération en cours.
- **Compatibilité :** Chrome, Edge et Safari récents sur ordinateur ; mobile hors exigence V1.
- **Accessibilité minimale :** états, erreurs et actions compréhensibles sans dépendre uniquement d'une couleur.
- **Observabilité :** erreurs d'API, timeouts, transitions refusées et coûts consultables par Alpha_no_code.
- **Disponibilité :** aucun SLA 24/7 en V1 ; supervision active pendant les heures d'usage convenues.
- **Connectivité :** service connecté uniquement ; perte réseau explicite, reprise et réconciliation obligatoires.

## 20. Coûts et viabilité économique

Les mesures sont réalisées par opération et agrégées par dossier : tokens et analyse multimodale du LLM, deux à trois variantes usuelles par perspective, corrections, reprises depuis les sources, stockage, transfert, services annexes et temps moyen de contrôle et de support Alpha_no_code.

Le modèle commercial évoqué en réunion comprend 1 500 € de frais d'installation, payés à 50 % au démarrage et 50 % à l'approbation finale, puis 60 €/mois après une période de calibration de deux mois incluse, sans engagement fixe. Le contrat signé reste l'autorité en cas d'écart avec ce PRD.

La décision économique ne repose pas uniquement sur le coût d'un appel d'image. Le coût complet observé est confronté au tarif de 60 €/mois avant la bascule complète.

## 21. Supervision et gouvernance

- Chaque erreur critique produit une alerte exploitable par Alpha_no_code.
- Le solde de crédits fal.ai fait l'objet d'une alerte automatique sous un seuil défini ; il n'est plus vérifié uniquement par une recharge manuelle mensuelle sans supervision.
- Chaque génération est rattachée aux versions exactes du Framework, du package, du prompt et des modèles.
- Une mise à jour du Framework n'est jamais appliquée automatiquement à des dossiers en cours.
- Toute version de l'application possède un changelog et un jeu de tests de non-régression.
- Une mise à jour du LLM ou du moteur d'image déclenche les tests applicables avant mise en production.
- Les décisions structurantes de cette application sont documentées sans modifier rétroactivement les règles gelées du Framework.
- Le statut d'abonnement ChatGPT d'Évariste (gratuit ou payant) n'est pas une dépendance de ce PRD : ni RIF-App, ni son filet de sécurité de Phase 1 ne reposent sur une Action de Custom GPT. L'accès au modèle conversationnel et à la génération d'image passe uniquement par des appels API directs, hors du compte personnel ChatGPT d'Évariste. La limitation constatée le 04.08.2026 (comptes gratuits sans accès aux Actions) reste une cause racine historique documentée pour GPT RIF, sans effet sur l'architecture cible.

## 22. Critères d'acceptation V1

- [ ] 20 opérations consécutives sans échec silencieux.
- [ ] Toutes les transitions interdites du parcours sont effectivement bloquées côté backend.
- [ ] Une génération est impossible sans ProjectState confirmé.
- [ ] 100 % des défauts éliminatoires du jeu de test annoté sont détectés avant export administratif.
- [ ] Aucun rendu non contrôlé ou Non conforme ne peut être exporté comme administratif.
- [ ] Correction locale et reprise depuis les sources sont deux opérations distinctes et testées.
- [ ] Reprise de session et reprise du polling fonctionnelles après rafraîchissement.
- [ ] Dépôt groupé, détection des rôles et confirmation des ambiguïtés fonctionnels sans convention de nommage obligatoire.
- [ ] Pré-analyse des matériaux traçable et confirmable ; aucune valeur à faible confiance n'est imposée.
- [ ] Les directives annotées sont correctement appliquées et aucune marque n'apparaît dans le rendu.
- [ ] Une référence matériau ne modifie ni géométrie, ni caméra, ni environnement.
- [ ] Trois variantes peuvent être comparées et une seule sélectionnée comme canonique sans perte d'historique.
- [ ] Les tests croisés démontrent l'isolation entre dossiers et tentatives.
- [ ] Toutes les générations sont traçables de bout en bout.
- [ ] RLS et contrôles d'accès passent des tests positifs et négatifs.
- [ ] Coût complet par dossier mesuré et documenté.
- [ ] Évariste juge l'expérience au moins équivalente à GPT RIF.

## 23. Plan de déploiement

### Phase 0A — Décisions et socle architectural

- [ ] Formaliser l'application comme implémentation du RIF, et non comme remplacement du Framework.
- [ ] Définir et valider le schéma du ProjectState.
- [ ] Définir la machine à états et ses préconditions.
- [ ] Constituer le package d'implémentation RIF versionné.
- [ ] Définir les contrats de génération, correction, reprise et contrôle.
- [ ] Choisir l'hébergement, le stockage privé, l'authentification et la stratégie RLS.
- [ ] Décider si fal.ai est appelé directement ou derrière un service contrôlé par Alpha_no_code.

**Critère de sortie :** architecture approuvée, décisions enregistrées, aucun point de sécurité bloquant laissé implicite.

### Phase 0B — Validation technique

- [ ] Brancher le véritable endpoint fal.ai avec polling complet.
- [ ] Réaliser au moins 5 dossiers techniques de bout en bout.
- [ ] Exécuter les cas de défauts réels : mur inventé, ouverture déplacée, annexe surdimensionnée, sous-face non texturée, bord de terrasse blanc, calepinage décalé, margelles erronées, équipement inventé, annotation conservée et soleil impossible.
- [ ] Vérifier la reprise après rafraîchissement et perte de connexion.
- [ ] Valider le stockage privé et les liens temporaires.
- [ ] Tester l'authentification, les autorisations et la RLS.
- [ ] Mesurer les coûts réels.
- [ ] Auditer manuellement les rendus contre les sources.
- [ ] Exécuter le jeu de défauts connus.
- [ ] Vérifier qu'aucun secret n'est exposé.
- [ ] Documenter le devenir des éléments réutilisables du prototype déterministe antérieur.

**Critère de sortie :** aucun échec silencieux, opérations traçables, blocages actifs, défauts critiques du jeu de test détectés et coût connu.

### Phase 1 — Coexistence encadrée

- Évariste utilise RIF-App sur des dossiers réels pendant une calibration pouvant aller jusqu'à deux mois, avec un premier jalon à 3 semaines ou 10 dossiers, au premier seuil atteint.
- GPT RIF reste disponible comme filet de sécurité.
- Alpha_no_code vérifie chaque rendu avant livraison à Évariste.
- Les écarts, coûts, corrections et retours d'usage sont consignés.

**Critère de sortie :** 10 dossiers consécutifs sans défaut éliminatoire non détecté, aucune régression majeure d'usage et viabilité économique confirmée.

### Phase 2 — Bascule opérationnelle

- RIF-App devient l'implémentation principale.
- GPT RIF est conservé temporairement comme secours passif ou archivé selon la décision de fin de Phase 1.
- Le support SLA 24 h est maintenu selon les conditions contractuelles validées.

## 24. Risques principaux

| Risque | Réponse produit |
|---|---|
| Sortir de ChatGPT sans améliorer la fiabilité réelle | Mesures de Phase 0, machine à états et journalisation transactionnelle |
| LLM qui saute une règle | Préconditions imposées par le backend |
| Conversation et fiche projet divergentes | ProjectState autoritaire et révisions immuables |
| Contrôle qualité trop confiant | Étape distincte, jeu annoté et validation humaine |
| Dérive après corrections successives | Audit de non-régression et reprise depuis les sources |
| Fuite de données ou de secrets | Auth, RLS, buckets privés, secrets serveur et messages nettoyés |
| Coût incompatible avec 60 €/mois | Mesure du coût complet, variantes incluses, avant Phase 1 |
| Contamination entre essais ou dossiers | Contexte reconstruit depuis une révision immuable et tests croisés d'isolation |
| Référence matériau qui déforme le projet | Autorité limitée à l'apparence de l'élément explicitement ciblé |
| Annotation reproduite dans le rendu | Conversion en directive structurée et contrôle éliminatoire |
| Dépendance à un fournisseur | Versions enregistrées et aucune bascule silencieuse |

Le risque professionnel le plus grave reste un écart géométrique ou environnemental non détecté dans un rendu destiné à une procédure administrative. Aucun choix d'interface ou de modèle ne supprime ce risque ; les blocages, le contrôle et la validation humaine doivent le réduire et le rendre visible.

## 25. Non-objectifs

- Remplacer le jugement professionnel d'Évariste.
- Certifier automatiquement la conformité architecturale ou réglementaire.
- Modifier le Framework directement depuis l'application.
- Masquer une erreur technique derrière un résultat approximatif.
- Transformer l'expérience en formulaire visible et rigide.
- Traiter plusieurs dossiers ou plusieurs vues en lot dans la V1.

## 26. Décisions à formaliser avant la Phase 0B

Les identifiants définitifs sont attribués dans le registre officiel des ADR. Les décisions candidates sont :

1. création de RIF-App comme nouvelle implémentation officielle du Framework ;
2. adoption d'un orchestrateur déterministe et du ProjectState comme source de vérité opérationnelle ;
3. séparation entre génération, contrôle qualité et validation humaine ;
4. distinction entre correction locale et reprise depuis les sources ;
5. choix du stockage, du transport sécurisé des images et de la rétention ;
6. choix du LLM multimodal et de l'endpoint exact du moteur d'image ;
7. appel direct à fal.ai ou passage par un service intermédiaire Alpha_no_code ;
8. stratégie économique si le coût complet observé est incompatible avec 60 €/mois ;
9. limite maximale de variantes incluses par dossier ou par perspective ;
10. format technique des masques et directives localisées ;
11. modalités contractuelles finales, le contrat signé restant autoritaire.

## 27. Annexes et dépendances

- `rif_chat_prototype.jsx` — prototype conversationnel de référence ;
- `premortem-report-20260902-1403.html` — rapport prémortem ;
- `premortem-transcript-20260902-1403.md` — transcription du prémortem ;
- ENG-004 — `02B_COLLECTE_CONDITIONNELLE.md` ;
- ENG-002 — `02A_PROMPT_SYSTEME.md` ;
- ENG-003 — `03_PROMPTS_CORRECTIONS.md` ;
- LIB-001 — `04_MATERIAUX.md` ;
- LIB-002 — `05_CHECKLIST_CONTROLE.md` ;
- LIB-003 — `06_CAS_DE_TEST.md` ;
- LIB-005 — `04A_STYLES_DE_RENDU.md` ;
- LIB-006 — `04B_MODES_DE_PRODUCTION.md` ;
- registre officiel des ADR du Framework.
- comptes rendus et transcriptions des réunions des 17.07, 04.08 et 12.08.2026.

---

## Historique

- **V1.0 — 02.09.2026 :** draft initial post-prémortem.
- **V1.1 — 06.09.2026 :** clarification Framework/implémentation, ajout du ProjectState, orchestration déterministe, séparation du contrôle qualité, reprise depuis les sources, sécurité RLS, journalisation transactionnelle, transport privé des fichiers et critères d'acceptation renforcés.
- **V1.2 — 06.09.2026 :** intégration des retours terrain : dépôt groupé, rôles étendus, pré-analyse matériau, annotations structurées, références matériau limitées, variantes comparables, isolation stricte, fonctionnement connecté explicite, tests de défauts réels et modèle commercial à 60 €/mois.
- **V1.3 — 07.09.2026 :** ajout d'une alerte automatique de solde fal.ai en §21 ; clôture de la question du statut d'abonnement ChatGPT d'Évariste, sans effet sur l'architecture cible puisque ni RIF-App ni son filet de sécurité de Phase 1 ne dépendent d'une Action de Custom GPT.
