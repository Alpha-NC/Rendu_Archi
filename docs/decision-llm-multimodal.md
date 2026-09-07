# Décision — Choix du LLM multimodal (RIF-App, §26 point 6 du PRD)

Statut : **en cours d'arbitrage** — comparaison fournie le 07.09.2026, décision finale à consigner dans `rif-framework/Implementations/RIF-App/DECISIONS.md` une fois tranchée.

## Rôle du LLM dans RIF-App

D'après le PRD (§11, §14), le LLM multimodal assure trois fonctions distinctes, toutes revérifiées par des préconditions côté backend (§11 : « masquer un outil au modèle ne constitue pas à lui seul une protection suffisante ») :

1. **Dialogue conversationnel** — la collecte progressive (ENG-004) et les échanges avec Évariste.
2. **Extraction structurée** — remplissage du `ProjectState` (valeurs typées, statut `provisional`/`validated`, source, confiance) à partir du dialogue et des documents.
3. **Analyse assistée des sources** — lecture des exports Revit et de la photo de site (compatibilité caméra, géométrie décrite, matériaux, rôle détecté des fichiers).

Le moteur d'image (fal.ai `nano-banana-pro/edit`) est déjà tranché et **indépendant** de ce choix : le LLM ne génère jamais l'image, il construit le prompt et contrôle le résultat.

## Tarifs constatés (07.09.2026, par million de tokens)

| Fournisseur | Modèle | Entrée | Sortie | Note |
|---|---|---|---|---|
| Anthropic | Claude Sonnet 5 | 2 $ | 10 $ | Tarif standard désormais permanent |
| Anthropic | Claude Opus 5 | 5 $ | 25 $ | Réservé aux cas nécessitant un raisonnement plus poussé |
| OpenAI | GPT-5.6 Terra | 2 $ | 12 $ | Milieu de gamme actuel |
| OpenAI | GPT-5.6 Sol / GPT-5.5 | 5 $ | 30 $ (20 $ après baisse du 22/08) | Haut de gamme |
| Google | Gemini 3 Pro | 2 $ | 12 $ | Jusqu'à 200k tokens ; re-tarifé 4 $/18 $ au-delà |

Les trois offres sont dans le même ordre de grandeur (2–5 $ entrée, 10–18 $ sortie pour les modèles comparables à Sonnet 5). **Le tarif brut ne sera pas le facteur décisif** pour un usage solo comme celui d'Évariste — voir estimation ci-dessous.

## Estimation d'usage par dossier (ordre de grandeur, à mesurer réellement en Phase 0B)

Hypothèses pour un dossier type (2 à 4 images sources + conversation de collecte + une extraction ProjectState + un contrôle qualité par génération) :

- ~3 images en entrée (photo de site + 1-2 exports Revit) : ≈ 1 500 à 3 000 tokens/image selon les fournisseurs → 5 000–10 000 tokens
- Conversation de collecte (15-25 tours) : ≈ 8 000–15 000 tokens cumulés
- Extraction structurée du ProjectState (sortie JSON contrainte) : ≈ 1 000–2 000 tokens de sortie
- Contrôle qualité (comparaison rendu/sources, 1 par génération, 2-3 variantes) : ≈ 3 000–6 000 tokens entrée + 500–1 000 sortie, ×2-3

**Total approximatif par dossier : 20 000–35 000 tokens d'entrée, 3 000–6 000 tokens de sortie.**

À ces volumes, le coût LLM par dossier reste de l'ordre de **0,10 à 0,30 €** quel que soit le fournisseur retenu — négligeable face au coût des générations fal.ai elles-mêmes et sans risque pour la cible de 60 €/mois. **Le tarif ne doit donc pas être le critère principal de décision.**

## Comparaison qualitative (le vrai critère)

| Critère | Claude (Anthropic) | GPT-5.6 (OpenAI) | Gemini 3 Pro (Google) |
|---|---|---|---|
| Respect strict d'un schéma de sortie (JSON contraint pour `ProjectState`) | Très bon — comportement constaté fiable sur des schémas stricts avec statuts imbriqués | Bon avec Structured Outputs, historiquement plus permissif sur les champs optionnels | Bon, moins de retour d'expérience terrain sur des schémas aussi imbriqués que le ProjectState |
| Respect de préconditions/refus explicite plutôt qu'improvisation | Point fort documenté (aligné avec l'exigence ADR/PRD de ne jamais deviner un résultat) | Correct, mais tendance historique à "essayer d'être utile" au lieu de bloquer | Correct |
| Lecture de plans techniques / exports Revit (formes, cotes, éléments architecturaux) | Bon, pas de démonstration publique spécifique au bâtiment sur ce projet | Bon, large corpus d'entraînement sur documents techniques | Bon, contexte long utile si plusieurs vues à la fois |
| Fenêtre de contexte pour dossiers avec beaucoup de sources | Large, suffisante pour un dossier | Large | Très large (avantage si plusieurs dossiers/vues en contexte simultané — hors périmètre V1 cependant) |
| Écosystème SDK / outillage function-calling en Next.js | Bon support officiel TypeScript | Bon support officiel TypeScript, le plus mature historiquement | Support correct, un peu moins d'exemples Next.js/Vercel en production |
| Continuité avec l'historique du projet | Aucune dépendance à l'ancien GPT RIF (le PRD écarte explicitly cette continuité, §21) | Continuité "psychologique" avec le GPT RIF V1, mais le PRD précise que ce n'est pas un critère | Aucun lien |

## Recommandation

**Claude (Sonnet 5, avec bascule ponctuelle vers Opus 5 pour l'extraction ProjectState si besoin d'un raisonnement plus poussé)**, pour deux raisons qui pèsent plus que le prix :

1. Le PRD répète, comme exigence non négociable, qu'**aucun résultat ne doit être deviné** et que les préconditions doivent être **imposées, pas suggérées** (§4, §11, risques §24 : « LLM qui saute une règle »). C'est exactement le comportement où Claude a le meilleur historique par rapport à GPT/Gemini : refuser plutôt qu'improviser.
2. Le coût réel par dossier est négligeable (~0,10-0,30 €) quel que soit le choix — inutile d'optimiser sur le prix au détriment de la fiabilité, qui est le risque professionnel le plus grave identifié dans le PRD (§24).

Cette recommandation reste à confirmer par la mesure réelle en **Phase 0B** (§23 : "brancher le véritable endpoint... mesurer les coûts réels"), qui peut aussi révéler qu'un mélange (ex. Claude pour l'extraction structurée + un modèle moins cher pour le simple dialogue de collecte) est plus économique sans sacrifier la fiabilité aux points critiques.

## Décision à consigner

- [ ] Confirmer ou infirmer le choix Claude Sonnet 5 / Opus 5.
- [ ] Décider si un seul modèle est utilisé pour les trois rôles (dialogue, extraction, contrôle) ou si un mélange est retenu.
- [ ] Ajouter la clé API retenue aux secrets serveur (jamais dans ce dépôt — voir `.env.example` une fois la Phase 0A close).
