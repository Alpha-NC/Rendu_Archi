/**
 * Moteur de collecte conditionnelle — ENG-004
 * (rif-framework/Framework/02_MOTEUR/02B_COLLECTE_CONDITIONNELLE.md).
 *
 * Ce module ne redéfinit AUCUNE règle de mode (LIB-006), de style (LIB-005)
 * ou d'autorité (REF-001) — voir ENG-004 §5. Il traduit uniquement la table
 * de branchement §4 en code : une fois le mode et le style pressentis,
 * comment chacune des huit questions du tronc commun doit être posée.
 *
 * PRD §9.3 : « Les règles de branchement sont appliquées par l'orchestrateur
 * et non laissées à la seule initiative du LLM. » — ce module EST cet
 * orchestrateur de branchement ; le LLM ne décide jamais seul de réduire ou
 * de retirer une question.
 */

import type { ModeProduction, StyleRendu } from './project-state'

/** ENG-004 §3 — tronc commun de référence, huit questions, cet ordre. */
export const QUESTIONS_TRONC_COMMUN = [
  'type_phase_usage', // ①
  'mode_implantation', // ②
  'elements_intouchables', // ③
  'materiaux', // ④
  'environnement', // ⑤
  'lumiere', // ⑥
  'style', // ⑦
  'elements_secondaires', // ⑧
] as const

export type QuestionTroncCommun = (typeof QUESTIONS_TRONC_COMMUN)[number]

/**
 * ENG-004 §2 définit formellement quatre états. §4.3 introduit en plus
 * « Inversée » pour un cas précis (⑧ en Commercial), et §4.5 (V1.6)
 * introduit « Reformulée » pour la question environnement en Retexturation
 * contextualisée (classification par élément, pas une réduction de
 * périmètre ni une conversion en simple confirmation) — ni l'un ni l'autre
 * n'est ajouté à la liste formelle du §2, conservés ici tels quels plutôt
 * que forcés dans les états d'origine, pour ne pas trahir le document.
 */
export type EtatQuestion = 'inchangee' | 'reduite' | 'convertie_confirmation' | 'retiree' | 'inversee' | 'reformulee'

export interface TraitementQuestion {
  question: QuestionTroncCommun
  etat: EtatQuestion
  /** Périmètre ou formulation imposés par la règle, quand ENG-004 en donne un. */
  precision: string
}

export interface QuestionAdditionnelle {
  id: string
  intitule: string
  /** Condition d'apparition en langage naturel, quand la question est conditionnelle. */
  condition?: string
}

export interface ParcoursCollecte {
  /**
   * false pour toute combinaison mode × style qu'ENG-004 §4 ne documente
   * pas explicitement. Dans ce cas, aucune réduction n'est appliquée — chaque
   * question reste 'inchangee' plutôt que de deviner un raccourci non
   * spécifié (ENG-004 §5 : « toute contradiction apparente [...] doit être
   * résolue en faveur » des documents qu'il ne redéfinit pas — l'absence de
   * documentation n'autorise pas à inventer une règle).
   */
  combinaisonDocumentee: boolean
  traitements: TraitementQuestion[]
  questionsAdditionnelles: QuestionAdditionnelle[]
}

function toutesInchangees(): TraitementQuestion[] {
  return QUESTIONS_TRONC_COMMUN.map((question) => ({
    question,
    etat: 'inchangee',
    precision: 'Aucune règle de branchement documentée (ENG-004 §4) — posée comme question ouverte.',
  }))
}

/** ENG-004 §4.1 — Photomontage contrôlé + Administratif sobre (cas par défaut). */
function branchementPhotomontageAdministratifSobre(): ParcoursCollecte {
  return {
    combinaisonDocumentee: true,
    traitements: [
      { question: 'type_phase_usage', etat: 'inchangee', precision: 'Question ouverte, sans réduction.' },
      {
        question: 'mode_implantation',
        etat: 'convertie_confirmation',
        precision:
          "Le mode est déjà fixé par défaut dès qu'une photographie existe pour un usage administratif (LIB-006 §5). Seule l'implantation précise du projet dans la photo reste une vraie question.",
      },
      { question: 'elements_intouchables', etat: 'inchangee', precision: 'Question ouverte, sans réduction.' },
      { question: 'materiaux', etat: 'inchangee', precision: 'Question ouverte, sans réduction.' },
      {
        question: 'environnement',
        etat: 'reduite',
        precision:
          "La conservation est déjà la règle par défaut (zones verrouillées, ADR-009) ; ne demander que ce qu'il faut supprimer.",
      },
      {
        question: 'lumiere',
        etat: 'retiree',
        precision:
          "Remplacée par une phrase annonçant que la lumière suit la photographie (REF-001 §6 : « la lumière suit la photographie lorsqu'elle constitue le canevas »).",
      },
      {
        question: 'style',
        etat: 'convertie_confirmation',
        precision: "Style par défaut dès qu'une photographie existe pour un usage administratif (LIB-005).",
      },
      {
        question: 'elements_secondaires',
        etat: 'convertie_confirmation',
        precision: "Confirmation négative : absence d'ajout par défaut (LIB-005 §5), sauf demande explicite.",
      },
    ],
    questionsAdditionnelles: [],
  }
}

/** ENG-004 §4.2 — Photomontage contrôlé + Présentation naturelle. */
function branchementPhotomontageNaturelle(): ParcoursCollecte {
  return {
    combinaisonDocumentee: true,
    traitements: [
      { question: 'type_phase_usage', etat: 'inchangee', precision: 'Question ouverte, sans réduction.' },
      {
        question: 'mode_implantation',
        etat: 'inchangee',
        precision: "Reformulée en langage naturel — LIB-004 fait de cet arbitrage un vrai choix, pas une évidence.",
      },
      { question: 'elements_intouchables', etat: 'inchangee', precision: 'Question ouverte, sans réduction.' },
      { question: 'materiaux', etat: 'inchangee', precision: 'Question ouverte, sans réduction.' },
      {
        question: 'environnement',
        etat: 'reduite',
        precision: 'Reste ouverte mais porte sur ce qui doit être valorisé plutôt que sur une liste exhaustive.',
      },
      {
        question: 'lumiere',
        etat: 'convertie_confirmation',
        precision: "Le style Présentation naturelle définit déjà la direction (plus chaud que la photo, LIB-005 §2) ; seule la validation est demandée.",
      },
      { question: 'style', etat: 'convertie_confirmation', precision: 'Style déjà pressenti — confirmation demandée.' },
      {
        question: 'elements_secondaires',
        etat: 'reduite',
        precision: "Reste ouverte mais cadrée par l'exigence de discrétion (LIB-005 §2).",
      },
    ],
    questionsAdditionnelles: [],
  }
}

/** ENG-004 §4.3 — Photomontage contrôlé + Commercial. */
function branchementCommercial(): ParcoursCollecte {
  return {
    combinaisonDocumentee: true,
    traitements: [
      { question: 'type_phase_usage', etat: 'inchangee', precision: 'Même traitement qu\'en Présentation naturelle (§4.2).' },
      {
        question: 'mode_implantation',
        etat: 'inchangee',
        precision: 'Même nuance qu\'en Présentation naturelle (§4.2) : reformulée en langage naturel.',
      },
      { question: 'elements_intouchables', etat: 'inchangee', precision: 'Même traitement qu\'en Présentation naturelle (§4.2).' },
      { question: 'materiaux', etat: 'inchangee', precision: 'Même traitement qu\'en Présentation naturelle (§4.2).' },
      {
        question: 'environnement',
        etat: 'reduite',
        precision: "Réduite comme en Administratif sobre (§4.1) — l'amélioration paysagère n'est pas le sujet de ce style.",
      },
      {
        question: 'lumiere',
        etat: 'inchangee',
        precision:
          "Le tronc commun ne couvre pas le moment de la journée, pourtant la donnée la plus structurante du style (LIB-005 §3) — voir questionsAdditionnelles.",
      },
      { question: 'style', etat: 'convertie_confirmation', precision: 'Même traitement qu\'en Présentation naturelle (§4.2).' },
      {
        question: 'elements_secondaires',
        etat: 'inversee',
        precision:
          "Encouragée plutôt que tolérée : ce style autorise explicitement ce que les deux autres interdisent par défaut (LIB-005 §3).",
      },
    ],
    questionsAdditionnelles: [
      {
        id: 'moment_journee',
        intitule: 'Moment de la journée : plein jour, fin de journée ou crépuscule (LIB-005 §3).',
      },
      {
        id: 'eclairages_ponctuels',
        intitule: 'Éclairages ponctuels à activer (margelles, éclairage sous-marin de la piscine, façade).',
        condition: 'Si fin de journée ou crépuscule est choisi comme moment de la journée.',
      },
    ],
  }
}

/** ENG-004 §4.4 — Retexturation Revit (aucune photographie), style variable. */
function branchementRetexturationRevit(style: StyleRendu | null): ParcoursCollecte {
  return {
    combinaisonDocumentee: true,
    traitements: [
      { question: 'type_phase_usage', etat: 'inchangee', precision: 'Question ouverte, sans réduction.' },
      {
        question: 'mode_implantation',
        etat: 'retiree',
        precision: "Réduite à néant — l'implantation dans une photo n'a pas de sens sans photo.",
      },
      {
        question: 'elements_intouchables',
        etat: 'reduite',
        precision:
          'Moins critique en l\'absence de tout conflit possible entre photo et Revit ; reste utile si le modèle contient des éléments hors périmètre du projet.',
      },
      {
        question: 'materiaux',
        etat: 'reduite',
        precision:
          "La distinction existant conservé / modifié (ADR-012) répond à un conflit entre photo et Revit qui ne peut pas exister ici ; redevient une simple question de matériaux.",
      },
      {
        question: 'environnement',
        etat: 'retiree',
        precision: "Quasi retirée — sans photographie, il n'y a pas d'environnement réel à conserver ou supprimer.",
      },
      {
        question: 'lumiere',
        etat: 'inchangee',
        precision:
          "Redevient une vraie question ouverte — aucune photographie n'impose de référence lumineuse (REF-001 §6 : lumière neutre par défaut si non précisée).",
      },
      {
        question: 'style',
        etat: 'reduite',
        precision:
          style === 'administratif_sobre'
            ? "Incohérent : Administratif sobre est exclu de ce mode (ADR-013) — ce style ne devrait pas être atteint ici."
            : "Réduite à deux choix : Présentation naturelle (défaut) ou Commercial. Administratif sobre est exclu de ce mode (ADR-013).",
      },
      {
        question: 'elements_secondaires',
        etat: 'inchangee',
        precision: 'Dépend du style retenu comme dans les autres branches.',
      },
    ],
    questionsAdditionnelles: [],
  }
}

/**
 * ENG-004 §4.5 — Retexturation contextualisée + Présentation naturelle
 * (cas standard, par défaut).
 */
function branchementContextualiseeNaturelle(): ParcoursCollecte {
  return {
    combinaisonDocumentee: true,
    traitements: [
      { question: 'type_phase_usage', etat: 'inchangee', precision: 'Question ouverte, sans réduction.' },
      {
        question: 'mode_implantation',
        etat: 'convertie_confirmation',
        precision:
          "Le mode est déjà fixé par défaut dès qu'une photo existe sans exigence administrative stricte (LIB-006 §5). Seule l'implantation précise reste une vraie question si elle n'est pas déjà lisible sur la vue Revit.",
      },
      { question: 'elements_intouchables', etat: 'inchangee', precision: 'Question ouverte, sans réduction.' },
      { question: 'materiaux', etat: 'inchangee', precision: 'Question ouverte, sans réduction.' },
      {
        question: 'environnement',
        etat: 'reformulee',
        precision:
          "Devient une classification par élément d'environnement (locked/editable/harmonizable, ARCH-002) plutôt qu'une question globale de conservation. La pré-analyse propose un état par élément identifié sur la photo, avec confiance et provenance ; seuls les éléments ambigus, rares ou contradictoires font l'objet d'une confirmation individuelle — jamais une reclassification exhaustive élément par élément.",
      },
      {
        question: 'lumiere',
        etat: 'retiree',
        precision:
          "Remplacée par une phrase annonçant que la lumière suit la photographie comme référence de contexte (REF-001 §6), sauf demande explicite d'ambiance différente.",
      },
      {
        question: 'style',
        etat: 'convertie_confirmation',
        precision: 'Présentation naturelle est le style par défaut de ce mode (LIB-005).',
      },
      {
        question: 'elements_secondaires',
        etat: 'convertie_confirmation',
        precision: "Confirmation négative : absence d'ajout par défaut (LIB-005 §5), sauf demande explicite.",
      },
    ],
    questionsAdditionnelles: [],
  }
}

/** ENG-004 §4.6 — Retexturation contextualisée + Administratif sobre. */
function branchementContextualiseeAdministratifSobre(): ParcoursCollecte {
  return {
    combinaisonDocumentee: true,
    traitements: [
      { question: 'type_phase_usage', etat: 'inchangee', precision: 'Question ouverte, sans réduction.' },
      {
        question: 'mode_implantation',
        etat: 'convertie_confirmation',
        precision:
          "Un usage administratif déclaré avec une photo compatible oriente plutôt vers Photomontage contrôlé (LIB-006 §6) ; ce cas ne subsiste que si l'utilisateur maintient explicitement Retexturation contextualisée malgré l'usage administratif — à signaler avant de poursuivre.",
      },
      { question: 'elements_intouchables', etat: 'inchangee', precision: 'Question ouverte, sans réduction.' },
      { question: 'materiaux', etat: 'inchangee', precision: 'Question ouverte, sans réduction.' },
      {
        question: 'environnement',
        etat: 'reduite',
        precision:
          'Comme en Photomontage contrôlé + Administratif sobre (§4.1) : la conservation prévaut par défaut ; ne reste ouvert que ce qui doit rester editable.',
      },
      {
        question: 'lumiere',
        etat: 'retiree',
        precision: 'La lumière suit la photographie (REF-001 §6).',
      },
      {
        question: 'style',
        etat: 'convertie_confirmation',
        precision: 'Style maintenu explicitement par l\'utilisateur malgré l\'usage administratif — confirmation demandée.',
      },
      {
        question: 'elements_secondaires',
        etat: 'convertie_confirmation',
        precision: "Confirmation négative : absence d'ajout par défaut (LIB-005 §5), sauf demande explicite.",
      },
    ],
    questionsAdditionnelles: [],
  }
}

/** ENG-004 §4.7 — Retexturation contextualisée + Commercial. */
function branchementContextualiseeCommercial(): ParcoursCollecte {
  return {
    combinaisonDocumentee: true,
    traitements: [
      { question: 'type_phase_usage', etat: 'inchangee', precision: 'Même traitement qu\'en §4.5.' },
      {
        question: 'mode_implantation',
        etat: 'convertie_confirmation',
        precision: 'Même nuance qu\'en §4.5.',
      },
      { question: 'elements_intouchables', etat: 'inchangee', precision: 'Même traitement qu\'en §4.5.' },
      { question: 'materiaux', etat: 'inchangee', precision: 'Même traitement qu\'en §4.5.' },
      {
        question: 'environnement',
        etat: 'reformulee',
        precision:
          'Traitée comme en §4.5 (classification par élément locked/editable/harmonizable), avec une tolérance harmonizable plus large pour l\'ambiance.',
      },
      {
        question: 'lumiere',
        etat: 'inchangee',
        precision:
          "Le tronc commun ne couvre pas le moment de la journée, pourtant la donnée la plus structurante du style (LIB-005 §3) — voir questionsAdditionnelles.",
      },
      { question: 'style', etat: 'convertie_confirmation', precision: 'Même traitement qu\'en §4.5.' },
      {
        question: 'elements_secondaires',
        etat: 'inversee',
        precision:
          "Encouragée plutôt que tolérée : ce style autorise explicitement ce que les deux autres interdisent par défaut (LIB-005 §3).",
      },
    ],
    questionsAdditionnelles: [
      {
        id: 'moment_journee',
        intitule: 'Moment de la journée : plein jour, fin de journée ou crépuscule (LIB-005 §3).',
      },
      {
        id: 'eclairages_ponctuels',
        intitule: 'Éclairages ponctuels à activer (margelles, éclairage sous-marin de la piscine, façade).',
        condition: 'Si fin de journée ou crépuscule est choisi comme moment de la journée.',
      },
    ],
  }
}

/**
 * Détermine le parcours de collecte adapté (ENG-004 §4). Le mode doit être
 * connu pour qu'une réduction s'applique — sans mode pressenti, aucune
 * question n'est réduite.
 */
export function determinerParcoursCollecte(
  mode: ModeProduction | null,
  style: StyleRendu | null,
): ParcoursCollecte {
  if (mode === 'retexturation_revit') {
    return branchementRetexturationRevit(style)
  }

  if (mode === 'photomontage_controle') {
    if (style === 'administratif_sobre' || style === null) {
      // LIB-005 : Administratif sobre est le style par défaut dès qu'une
      // photo existe pour un usage administratif — style non encore
      // confirmé traité comme ce défaut le temps de la confirmation
      // (§4.1 reste applicable).
      return branchementPhotomontageAdministratifSobre()
    }
    if (style === 'presentation_naturelle') return branchementPhotomontageNaturelle()
    if (style === 'commercial') return branchementCommercial()
  }

  if (mode === 'retexturation_contextualisee') {
    if (style === 'presentation_naturelle' || style === null) {
      // LIB-005 : Présentation naturelle est le style par défaut de ce
      // mode (cas standard) — style non encore confirmé traité comme ce
      // défaut le temps de la confirmation (§4.5 reste applicable).
      return branchementContextualiseeNaturelle()
    }
    if (style === 'administratif_sobre') return branchementContextualiseeAdministratifSobre()
    if (style === 'commercial') return branchementContextualiseeCommercial()
  }

  // Mode non pressenti : aucune branche §4 ne peut s'appliquer.
  return { combinaisonDocumentee: false, traitements: toutesInchangees(), questionsAdditionnelles: [] }
}
