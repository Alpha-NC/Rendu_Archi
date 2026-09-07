/**
 * Sélection du mode de production et du style de rendu — grounded dans
 * LIB-006 (04B_MODES_DE_PRODUCTION.md, §5 Matrice de choix) et LIB-005
 * (04A_STYLES_DE_RENDU.md, section « Sélection automatique »).
 *
 * Distinct du branchement des questions (ENG-004, collecte-conditionnelle.ts) :
 * ce module répond à « quel mode/style » ; ENG-004 répond à « comment
 * demander le reste une fois le mode/style connu ».
 *
 * Principe strict repris de LIB-004/LIB-005/LIB-006 : quand la situation
 * n'est pas explicitement couverte, on ne devine jamais un défaut — on
 * retourne 'a_confirmer' ou 'suspendre' et on laisse l'utilisateur trancher.
 */

import type { ModeProduction, StyleRendu } from './project-state'

export interface ContexteChoixMode {
  vueRevitExploitable: boolean
  photographieReelleFournie: boolean
  cameraCompatible: 'Compatible' | 'Approximative' | 'Incompatible' | 'Non evaluee'
  usageAdministratif: boolean
  /** Correction locale d'un photomontage déjà conforme (LIB-006 §5, dernière ligne). */
  correctionLocalePhotomontageConforme?: boolean
  /** Présentation client avec liberté d'ambiance explicitement demandée. */
  libertyAmbianceDemandee?: boolean
}

export type ResultatChoixMode =
  | { mode: ModeProduction; motif: string }
  | { mode: 'suspendre'; motif: string }
  | { mode: 'a_confirmer'; motif: string }

/** LIB-006 §5 — Matrice de choix, transcrite sans y ajouter de cas. */
export function determinerModeParDefaut(contexte: ContexteChoixMode): ResultatChoixMode {
  if (contexte.correctionLocalePhotomontageConforme) {
    return { mode: 'photomontage_controle', motif: 'Modification locale d\'un photomontage conforme (LIB-006 §5).' }
  }

  if (
    contexte.photographieReelleFournie &&
    contexte.usageAdministratif &&
    contexte.cameraCompatible === 'Incompatible'
  ) {
    return {
      mode: 'suspendre',
      motif: 'Photo réelle + vue incompatible + usage administratif : suspendre et demander une nouvelle vue ou calibration (LIB-006 §5).',
    }
  }

  if (
    contexte.photographieReelleFournie &&
    contexte.usageAdministratif &&
    (contexte.cameraCompatible === 'Compatible' || contexte.cameraCompatible === 'Approximative')
  ) {
    return {
      mode: 'photomontage_controle',
      motif: 'Photo réelle + vue compatible + usage administratif (LIB-006 §5).',
    }
  }

  if (contexte.libertyAmbianceDemandee) {
    return {
      mode: 'presentation_generative',
      motif: 'Présentation client avec liberté d\'ambiance (LIB-006 §5).',
    }
  }

  if (contexte.vueRevitExploitable && !contexte.photographieReelleFournie) {
    return { mode: 'retexturation_revit', motif: 'Vue Revit seule, caméra à conserver (LIB-006 §5).' }
  }

  return {
    mode: 'a_confirmer',
    motif: 'Situation non couverte explicitement par la matrice LIB-006 §5 — à trancher avec Évariste plutôt que deviner.',
  }
}

export interface ContexteChoixStyle {
  photographieReelleFournie: boolean
  usageAdministratif: boolean
  contexteReunionClientOuAvantProjet?: boolean
  /** LIB-005 : Commercial n'entre jamais dans la sélection automatique. */
  demandeExpliciteCommercial?: boolean
}

export type ResultatChoixStyle =
  | { style: StyleRendu; motif: string }
  | { style: 'a_confirmer'; motif: string }

/** LIB-005 — section « Sélection automatique », transcrite sans y ajouter de cas. */
export function determinerStyleParDefaut(contexte: ContexteChoixStyle): ResultatChoixStyle {
  // LIB-005 : Commercial n'est jamais choisi par défaut ni par sélection
  // automatique — seule une demande explicite le permet, quelle que soit
  // la situation par ailleurs.
  if (contexte.demandeExpliciteCommercial) {
    return { style: 'commercial', motif: 'Demande explicite de l\'utilisateur (LIB-005 §3).' }
  }

  if (contexte.photographieReelleFournie && contexte.usageAdministratif) {
    return {
      style: 'photomontage_administratif',
      motif: 'Photographie réelle fournie pour un usage administratif — style par défaut (LIB-005).',
    }
  }

  if (contexte.contexteReunionClientOuAvantProjet) {
    return { style: 'presentation_client', motif: 'Réunion client ou avant-projet (LIB-005).' }
  }

  return {
    style: 'a_confirmer',
    motif: 'Plusieurs styles restent possibles — confirmation demandée à l\'utilisateur (LIB-005).',
  }
}
