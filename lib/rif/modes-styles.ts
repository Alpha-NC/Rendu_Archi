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
}

export type ResultatChoixMode =
  | { mode: ModeProduction; motif: string }
  | { mode: 'suspendre'; motif: string }
  | { mode: 'a_confirmer'; motif: string }

/**
 * LIB-006 V1.6 §5 — Matrice de choix, transcrite sans y ajouter de cas.
 *
 * D-19 : `retexturation_contextualisee` (cas standard) doit être vérifié
 * APRÈS les branches Photomontage contrôlé, jamais avant — LIB-006 §6 :
 * « Photomontage contrôlé prévaut dès qu'un usage documentaire strict est
 * déclaré [...] Retexturation contextualisée reste le choix par défaut dans
 * tous les autres cas où une photographie est disponible. » L'incompatibilité
 * caméra ne bloque jamais ce mode (LIB-006 §4 Prérequis, TEST-007C) : la
 * correspondance de caméra n'a pas besoin d'être parfaite.
 */
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

  if (contexte.vueRevitExploitable && contexte.photographieReelleFournie && !contexte.usageAdministratif) {
    return {
      mode: 'retexturation_contextualisee',
      motif: 'Vue Revit + photo réelle, sans usage administratif strict : cas standard (LIB-006 §4-§5).',
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

/** LIB-005 V1.6 — section « Sélection automatique », transcrite sans y ajouter de cas. */
export function determinerStyleParDefaut(contexte: ContexteChoixStyle): ResultatChoixStyle {
  // LIB-005 : Commercial n'est jamais choisi par défaut ni par sélection
  // automatique — seule une demande explicite le permet, quelle que soit
  // la situation par ailleurs.
  if (contexte.demandeExpliciteCommercial) {
    return { style: 'commercial', motif: 'Demande explicite de l\'utilisateur (LIB-005 §3).' }
  }

  if (contexte.photographieReelleFournie && contexte.usageAdministratif) {
    return {
      style: 'administratif_sobre',
      motif: 'Photographie réelle fournie pour un usage administratif — style par défaut (LIB-005).',
    }
  }

  // D-19 : depuis V1.6, une photo seule (sans usage administratif) ne
  // sélectionne plus Administratif sobre — c'est le cas standard de
  // Retexturation contextualisée, dont Présentation naturelle est le style
  // par défaut (LIB-005 « Sélection automatique »).
  if (contexte.photographieReelleFournie && !contexte.usageAdministratif) {
    return {
      style: 'presentation_naturelle',
      motif: 'Photographie réelle sans usage administratif strict — cas standard, Retexturation contextualisée (LIB-005).',
    }
  }

  if (contexte.contexteReunionClientOuAvantProjet) {
    return { style: 'presentation_naturelle', motif: 'Réunion client ou avant-projet (LIB-005).' }
  }

  return {
    style: 'a_confirmer',
    motif: 'Plusieurs styles restent possibles — confirmation demandée à l\'utilisateur (LIB-005).',
  }
}
