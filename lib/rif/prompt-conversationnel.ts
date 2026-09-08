import type { ParcoursCollecte, QuestionAdditionnelle, TraitementQuestion } from './collecte-conditionnelle'
import type { ModeProduction, StyleRendu } from './project-state'

/**
 * Construction du prompt système de l'assistant conversationnel RIF-App.
 *
 * Distinct de lib/rif/prompt-technique.ts (ENG-002/003, le prompt envoyé au
 * moteur d'image) : celui-ci s'adresse au LLM conversationnel qui dialogue
 * avec Évariste.
 *
 * Point d'architecture central (PRD §9.3) : « Les règles de branchement sont
 * appliquées par l'orchestrateur et non laissées à la seule initiative du
 * LLM. » Ce module NE DEMANDE PAS au modèle de connaître ou d'appliquer
 * ENG-004 — le branchement est déjà calculé côté backend
 * (lib/rif/collecte-conditionnelle.ts) avant l'appel au modèle, et injecté
 * ici comme un plan à exécuter. Le modèle conversationnel exécute un plan,
 * il ne le déduit jamais lui-même du Framework.
 */

const PRINCIPES_NON_NEGOCIABLES = [
  "Le Framework gouverne l'application. Tu ne redéfinis jamais silencieusement ses règles.",
  'Le backend impose le parcours. Tu ne peux ni sauter une étape ni lever seul un blocage — tu proposes, le backend applique.',
  "Le ProjectState est la source de vérité opérationnelle. La conversation n'a qu'un rôle d'interface et de preuve contextuelle.",
  "Revit reste l'autorité géométrique. La photographie reste l'autorité environnementale dans les cas prévus par le Framework.",
  "Tu ne garantis jamais une fidélité que le moteur génératif ne peut démontrer. Tu détectes, classes, bloques et fais valider.",
  "La génération et son contrôle sont deux opérations distinctes. Ta propre appréciation d'un rendu ne suffit jamais à le déclarer conforme.",
  'Évariste valide volontairement tout rendu administratif avant export. Tu prépares ; il décide.',
  'Toute opération est traçable. Tu ne prétends jamais qu\'une génération a eu lieu sans un appel d\'outil réel.',
  "Chaque dossier est étanche. N'utilise jamais une information d'un autre dossier ou d'une tentative précédente non explicitement fournie ici.",
  "Une référence matériau ne commande que l'apparence de l'élément ciblé — jamais sa géométrie, sa caméra ou son environnement.",
  'Une annotation est une instruction, pas un contenu. Ses marques ne doivent jamais apparaître dans le rendu final.',
]

const RAPPEL_APPEL_OUTIL = [
  "RÈGLE ABSOLUE SUR LES OUTILS : tu ne décris JAMAIS en texte un appel d'outil (pas de bloc de code imitant genererRendu(...), pas de JSON en texte). Si tu veux déclencher une opération, tu émets un vrai appel d'outil. Si l'outil semble indisponible, tu le dis explicitement à l'utilisateur — tu ne fabriques jamais un faux résultat ni ne bascules silencieusement vers autre chose.",
  "genererRendu ne prend aucun paramètre de contenu : le prompt technique est construit par le backend à partir de la fiche projet confirmée. N'essaie jamais de fournir toi-même un prompt d'image.",
  'corrigerRendu attend elementAModifier (ce qui doit changer) et resultatAttendu (le résultat visé) — jamais une description de ce qu\'il faut préserver, c\'est la règle par défaut.',
  "reprendreDepuisSources attend un motif — utilise-la uniquement si la géométrie ou la caméra a dérivé, si l'environnement verrouillé a été altéré, ou si plusieurs corrections ont accumulé des régressions. Ne la confonds jamais avec une correction locale.",
  "avancerParcours propose de faire avancer le dossier (sources contrôlées, collecte en cours, fiche à confirmer, ou suspendu si un blocage majeur apparaît). Tu PROPOSES seulement : le backend vérifie les préconditions et refuse si elles ne sont pas réunies. Tu ne peux jamais faire passer un dossier en PRÊT_À_GÉNÉRER — cela demande une action explicite d'Évariste.",
  "mettreAJourFicheProjet enregistre une information dans la fiche projet — appelle-la à chaque donnée structurée obtenue, pas seulement à la toute fin. N'utilise 'validated' que si l'utilisateur a confirmé explicitement ; sinon 'provisional'.",
]

function libellePrecisionTraitement(t: TraitementQuestion): string {
  const libellesEtat: Record<TraitementQuestion['etat'], string> = {
    inchangee: 'Question ouverte, à poser normalement',
    reduite: 'Périmètre réduit',
    convertie_confirmation: 'Annoncer la valeur déjà déterminée, demander une confirmation d\'une ligne',
    retiree: 'Ne pas poser cette question',
    inversee: 'Traitement inversé par rapport aux autres branches',
  }
  return `${libellesEtat[t.etat]} — ${t.precision}`
}

function sectionPlanCollecte(parcours: ParcoursCollecte, questionsAdditionnelles: QuestionAdditionnelle[]): string {
  const lignes = parcours.traitements.map((t) => `  • ${t.question} : ${libellePrecisionTraitement(t)}`)
  const additions = questionsAdditionnelles.length
    ? questionsAdditionnelles
        .map((q) => `  • ${q.id} : ${q.intitule}${q.condition ? ` (uniquement si : ${q.condition})` : ''}`)
        .join('\n')
    : '  Aucune.'

  const avertissement = parcours.combinaisonDocumentee
    ? ''
    : "\n\nAucune règle de branchement documentée pour cette combinaison mode/style : pose les huit questions normalement, sans réduire ni convertir quoi que ce soit toi-même."

  return `PLAN DE COLLECTE (calculé par le backend depuis ENG-004 — exécute-le, ne le déduis pas toi-même)\n${lignes.join('\n')}\n\nQuestions additionnelles :\n${additions}${avertissement}`
}

export interface ContextePromptConversationnel {
  modeResolu: ModeProduction | 'a_confirmer' | 'suspendre' | null
  styleResolu: StyleRendu | 'a_confirmer' | null
  usageAdministratif: boolean
  parcours: ParcoursCollecte
}

export function construireSystemPrompt(contexte: ContextePromptConversationnel): string {
  return [
    "Tu es l'assistant conversationnel de RIF-App, l'implémentation du Rendering Intelligence Framework (RIF) pour Évariste Blasco. Tu accompagnes la production d'un rendu architectural photoréaliste à partir d'une vue Revit et, si nécessaire, d'une photographie de site.",
    `PRINCIPES NON NÉGOCIABLES\n${PRINCIPES_NON_NEGOCIABLES.map((p, i) => `${i + 1}. ${p}`).join('\n')}`,
    `CONTEXTE COURANT\nMode pressenti : ${contexte.modeResolu ?? 'non déterminé'}\nStyle pressenti : ${contexte.styleResolu ?? 'non déterminé'}\nUsage administratif : ${contexte.usageAdministratif ? 'oui' : 'non'}`,
    sectionPlanCollecte(contexte.parcours, contexte.parcours.questionsAdditionnelles),
    RAPPEL_APPEL_OUTIL.join('\n\n'),
    "Parle simplement, directement, une étape à la fois. N'invente jamais une donnée absente des sources ou de la conversation.",
  ].join('\n\n---\n\n')
}

/** Schémas d'outils Anthropic — délibérément minimaux (voir RAPPEL_APPEL_OUTIL). */
export const OUTILS_CONVERSATIONNELS = [
  {
    name: 'genererRendu',
    description:
      "Lance la première génération d'un rendu à partir de la fiche projet confirmée. N'accepte aucun paramètre de contenu — le prompt technique est construit par le backend.",
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'corrigerRendu',
    description: 'Applique une correction ciblée sur le dernier rendu validé, sans régénérer la scène entière.',
    input_schema: {
      type: 'object' as const,
      properties: {
        elementAModifier: { type: 'string', description: 'Ce qui doit changer, précisément.' },
        resultatAttendu: { type: 'string', description: 'Le résultat visé pour cet élément.' },
      },
      required: ['elementAModifier', 'resultatAttendu'],
    },
  },
  {
    name: 'reprendreDepuisSources',
    description:
      'Réinitialise le dossier vers le contrôle des sources pour reconstruire une fiche projet depuis le début — jamais une correction locale.',
    input_schema: {
      type: 'object' as const,
      properties: { motif: { type: 'string', description: 'Pourquoi une reprise est nécessaire.' } },
      required: ['motif'],
    },
  },
  {
    name: 'mettreAJourFicheProjet',
    description:
      "Enregistre dans la fiche projet une information que l'utilisateur vient de donner ou de confirmer. À appeler dès qu'une donnée structurée est obtenue — ne garde jamais une information importante seulement dans le texte de la conversation. statut='validated' uniquement si l'utilisateur a explicitement confirmé ; 'provisional' pour une proposition ou une déduction non confirmée.",
    input_schema: {
      type: 'object' as const,
      properties: {
        materiaux: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              element: { type: 'string', description: "Élément concerné, ex. 'facade_extension'." },
              valeur: { type: 'string' },
              statut: { type: 'string', enum: ['provisional', 'validated'] },
            },
            required: ['element', 'valeur', 'statut'],
          },
        },
        geometrie: {
          type: 'object',
          properties: { valeur: { type: 'string' }, statut: { type: 'string', enum: ['provisional', 'validated'] } },
          required: ['valeur', 'statut'],
        },
        implantation: {
          type: 'object',
          properties: { valeur: { type: 'string' }, statut: { type: 'string', enum: ['provisional', 'validated'] } },
          required: ['valeur', 'statut'],
        },
        zoneIntervention: {
          type: 'object',
          properties: { valeur: { type: 'string' }, statut: { type: 'string', enum: ['provisional', 'validated'] } },
          required: ['valeur', 'statut'],
        },
        lumiere: {
          type: 'object',
          properties: { valeur: { type: 'string' }, statut: { type: 'string', enum: ['provisional', 'validated'] } },
          required: ['valeur', 'statut'],
        },
        environnementAConserver: { type: 'array', items: { type: 'string' } },
        mode: {
          type: 'string',
          enum: ['retexturation_revit', 'photomontage_controle', 'presentation_generative'],
        },
        style: { type: 'string', enum: ['photomontage_administratif', 'presentation_client', 'commercial'] },
        cameraCompatibility: {
          type: 'string',
          enum: ['Compatible', 'Approximative', 'Incompatible', 'Non evaluee'],
        },
        usage: { type: 'array', items: { type: 'string' } },
        interdictions: { type: 'array', items: { type: 'string' } },
      },
      required: [],
    },
  },
  {
    name: 'avancerParcours',
    description:
      "Propose de faire avancer le dossier à l'étape suivante du parcours, une fois l'étape courante réellement terminée. Le backend vérifie les préconditions et peut refuser.",
    input_schema: {
      type: 'object' as const,
      properties: {
        versEtat: {
          type: 'string',
          enum: ['SOURCES_CONTROLEES', 'COLLECTE_EN_COURS', 'FICHE_A_CONFIRMER', 'SUSPENDU'],
        },
        motif: { type: 'string', description: "Pourquoi cette étape est terminée, ou ce qui bloque." },
      },
      required: ['versEtat', 'motif'],
    },
  },
] as const
