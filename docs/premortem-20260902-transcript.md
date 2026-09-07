# Premortem — App conversationnelle RIF (hors ChatGPT)

**Date :** 02.09.2026
**Méthode :** Gary Klein — cadre prospectif ("this already failed, tell me why")

> Archivé dans ce dépôt le 07.09.2026 (annexe référencée au §27 du PRD).
> Encodage réparé à l'archivage ; contenu inchangé.

---

## Contexte rassemblé

**Quoi.** Application conversationnelle standalone (chat + LLM avec appel d'outils + Nano Banana Pro via fal.ai) destinée à remplacer GPT RIF (Custom GPT ChatGPT) comme outil de production pour la génération de rendus photoréalistes architecturaux.

**Pour qui.** Evariste Blasco, dessinateur indépendant à Biarritz, utilisateur opérationnel unique — prudent vis-à-vis de l'IA, a explicitement rejeté une version formulaire, attend une expérience conversationnelle équivalente ou supérieure à GPT RIF. En arrière-plan : Alpha No_Code (modèle économique 1 500 € setup + 60 €/mois récurrent), et l'administration qui reçoit in fine les dossiers de permis de construire produits avec ces rendus.

**Succès.** Une app qui reproduit fidèlement le comportement de GPT RIF — collecte conversationnelle correcte (y compris la logique conditionnelle ENG-004 récemment patchée), génération fiable, contrôle qualité visuel fiable — sans les bugs de plateforme ChatGPT (Action non appelée, toggle, timeout), adoptée durablement par Evariste sans régression perçue, et économiquement viable pour Alpha.

**Déclencheur immédiat.** Un test en session venait de produire un résultat ambigu : un appel d'outil apparent (JSON `genererRenduFlux(...)` affiché en bloc de code texte) suivi d'un message expliquant que l'outil n'était « pas accessible dans cette interface » — comportement incohérent avec un vrai `tool_use` contraint par le schéma déclaré. Ce point n'a pas été élucidé avant la décision de lancer la production.

---

## Cadre posé

Il est mars 2027. Le lancement en production de cette app a échoué. On reconstruit, en remontant le temps, les raisons de cet échec.

---

## Raisons d'échec brutes (8)

1. La fiabilité de l'appel d'outil n'a jamais été confirmée — le dernier test a produit un cas ambigu jamais élucidé avant de lancer la production.
2. Le polling asynchrone fal.ai (POST → status_url → response_url) n'a jamais été validé de bout en bout — signalé « à confirmer » depuis le début du projet.
3. Le contrôle qualité visuel post-génération n'a jamais tourné en conditions réelles hors ChatGPT — c'est la fonction qui protège Evariste d'un rendu géométriquement faux déposé en mairie.
4. Evariste attend une parité comportementale stricte avec GPT RIF, pas une réinvention — toute divergence perçue peut le renvoyer vers Photoshop.
5. Aucune infrastructure de production réelle n'existe (auth, logs persistants, gestion d'erreur, clé fal.ai en clair).
6. Le modèle économique à 60 €/mois a été calibré sur la maintenance d'un GPT Custom, pas sur l'exploitation d'une app hébergée avec coûts API à l'usage.
7. Le plan V2 déterministe précédemment acté (PRD, prototype React, schéma Supabase) est abandonné de fait sans décision formalisée.
8. Aucun filet de sécurité ni critère de bascule n'est défini entre GPT RIF et la nouvelle app.

---

## Analyses détaillées

### 1. La fiabilité de l'appel d'outil n'a jamais été confirmée

**Histoire.** Sur un vrai dossier — une villa à Biarritz — la génération échoue silencieusement deux fois sur cinq essais : le modèle décrit ce qu'il « voudrait » appeler en texte plutôt que d'émettre un vrai `tool_use`. Evariste, fiche projet validée, se retrouve avec une réponse qui ressemble à un rendu lancé mais ne l'est pas, et ne le découvre qu'en cherchant un lien absent. Même symptôme que le bug qu'on fuyait en quittant ChatGPT (Action non appelée) — sans les outils de diagnostic de n8n ou GPT Builder pour l'identifier.

**Hypothèse sous-jacente.** Que quitter la plateforme ChatGPT élimine la classe de bug « outil pas appelé », alors qu'elle en déplace seulement la cause possible.

**Signaux d'alerte.** Réponses API sans bloc `tool_use` alors qu'une génération était attendue ; taux d'échec silencieux supérieur à 1 sur 10 sur des dossiers réels.

### 2. Le polling fal.ai n'a jamais été validé de bout en bout

**Histoire.** Jour d'un dépôt urgent, Evariste envoie ses trois images. L'app affiche « génération en cours » puis retourne un ID de soumission fal.ai au lieu de l'image, faute de boucle sur `status_url`. Il perd une heure à comprendre que « ça n'a jamais vraiment généré » — le blocage administratif que le projet devait éliminer.

**Hypothèse sous-jacente.** Que le webhook n8n existant « doit déjà gérer ça » puisqu'il tourne depuis des mois, sans avoir relu le node HTTP Request correspondant.

**Signaux d'alerte.** Réponse contenant `status: "IN_QUEUE"` ou un `request_id` sans `image_url`.

### 3. Le contrôle qualité visuel n'a jamais tourné en conditions réelles

**Histoire.** La géométrie de la toiture d'un rendu dérive subtilement de la vue Revit. Le contrôle post-génération, jamais testé sur ce type d'écart hors ChatGPT, classe « Conforme » par excès de confiance. Evariste, qui fait confiance à l'automatisme après plusieurs semaines sans incident, transmet le rendu tel quel dans son dossier de permis. La crédibilité professionnelle engagée n'est plus seulement technique.

**Hypothèse sous-jacente.** Qu'un prompt bien écrit produit un jugement fiable simplement parce qu'il est bien formulé, sans mesure du taux de faux négatifs réel.

**Signaux d'alerte.** Un écart injecté volontairement dans un test n'est pas détecté ; aucun audit humain systématique sur les 5-10 premiers rendus réels.

### 4. Evariste attend une parité stricte, pas une réinvention

**Histoire.** L'ordre des questions diverge légèrement de GPT RIF parce que le patch ENG-004 n'a pas été testé sur assez de cas réels. Evariste juge l'outil sur sa fluidité, trouve la conversation « moins naturelle », et recommence à passer par Photoshop « pour les dossiers urgents » — une exception qui devient la norme, le même schéma que celui vécu par son père avec le passage à la 3D.

**Hypothèse sous-jacente.** Que porter le prompt système presque verbatim suffit à préserver l'expérience perçue, indépendamment du modèle utilisé, de la latence, ou de détails d'interaction jamais testés avec Evariste lui-même.

**Signaux d'alerte.** Evariste questionne l'ordre ou la formulation des questions ; des rendus faits sous Photoshop réapparaissent en parallèle de l'app.

### 5. Aucune infrastructure de production réelle

**Histoire.** Pas de log persistant, pas d'authentification, clé fal.ai copiée en clair depuis n8n. Un incident réseau plante une génération sans trace exploitable ; Alpha découvre plus tard une facture fal.ai anormale, révélant un usage non authentifié.

**Hypothèse sous-jacente.** Que « ça marche en test » équivaut à « c'est prêt pour un usage réel exposé à internet ».

**Signaux d'alerte.** Aucune variable d'environnement pour les clés ; aucun log consultable après coup pour un dossier donné.

### 6. Le modèle économique à 60 €/mois n'a jamais été recalculé

**Histoire.** Six mois après le lancement, Alpha additionne les coûts réels : appels API LLM par conversation, appels fal.ai par génération et par correction, hébergement. Le coût variable dépasse largement les 60 €/mois facturés, sans qu'aucun ajustement de prix n'ait été anticipé.

**Hypothèse sous-jacente.** Que le prix calibré pour maintenir des Instructions ChatGPT reste valable pour opérer une application hébergée avec des coûts d'inférence à l'usage — deux structures de coûts fondamentalement différentes.

**Signaux d'alerte.** Le coût par dossier généré n'a jamais été calculé avant le lancement.

### 7. Le plan V2 déterministe abandonné sans décision formalisée

**Histoire.** Le PRD, le prototype React et le schéma Supabase du plan déterministe restent dans un coin, ni fermés ni repris. Si le conversationnel rencontre un blocage sérieux, il n'y a pas de plan B clair — juste deux projets à moitié faits.

**Hypothèse sous-jacente.** Que la préférence exprimée par Evariste pour le conversationnel règle définitivement la question architecturale, sans qu'aucune des deux voies n'ait encore prouvé sa fiabilité en production.

**Signaux d'alerte.** Personne ne peut dire en une phrase pourquoi le plan formulaire est arrêté, ou s'il reste une option de repli.

### 8. Aucun filet de sécurité ni critère de bascule

**Histoire.** Sur l'élan de l'enthousiasme, Evariste bascule directement sur la nouvelle app pour son prochain dossier réel, échéance de dépôt serrée. Un des sept problèmes précédents survient, sans retour arrière rapide possible parce que GPT RIF n'est plus le réflexe.

**Hypothèse sous-jacente.** Que « prometteur en test » équivaut à « prêt à remplacer l'outil de production actuel ».

**Signaux d'alerte.** Aucune date ni nombre de dossiers fixés comme seuil avant de désactiver GPT RIF.

---

## Synthèse

**Échec le plus probable.** La fiabilité de l'appel d'outil (#1), couplée au polling fal.ai non validé (#2) — deux points de plomberie de base jamais confirmés, et le premier montre déjà un symptôme non résolu dans la session même où la décision de production a été prise.

**Échec le plus dangereux.** Le contrôle qualité visuel (#3) — c'est la fonction qui protège Evariste d'un rendu erroné déposé en mairie ; une sous-performance silencieuse a un impact professionnel et réglementaire, pas seulement technique.

**Hypothèse cachée.** « Sortir de ChatGPT résout la fiabilité. » En réalité, la nouvelle pile introduit sa propre classe de points de défaillance non testés (polling, contrôle visuel, hébergement) — rien ne prouve qu'elle est plus fiable que ce qu'elle remplace tant que ce n'est pas mesuré.

**Plan révisé.**
1. Confirmer via le Network tab si le dernier appel d'outil était réel ou halluciné — bloquant.
2. Brancher le vrai polling fal.ai et générer 5 rendus réels de bout en bout, vérifiés manuellement.
3. Auditer à l'œil le contrôle qualité automatique sur ces mêmes 5 dossiers.
4. Sortir la clé fal.ai en variable d'environnement, ajouter une authentification minimale.
5. Chiffrer le coût réel par dossier et le comparer aux 60 €/mois avant lancement.
6. Documenter explicitement la décision sur le plan V2 déterministe.
7. Faire tourner GPT RIF et la nouvelle app en parallèle pendant la validation, avec un critère de bascule explicite.

**Checklist avant lancement.**
- [ ] Nature réelle du dernier appel d'outil confirmée (Network tab)
- [ ] 5 rendus réels générés et vérifiés de bout en bout, polling inclus
- [ ] Clé fal.ai hors du code, authentification minimale en place
- [ ] Coût réel par dossier calculé et confronté aux 60 €/mois
- [ ] Décision explicite sur le plan V2 déterministe (clôture ou pause documentée)
