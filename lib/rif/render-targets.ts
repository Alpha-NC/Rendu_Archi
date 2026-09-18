/**
 * RenderTarget / OutputType / QualityProfile — RIF V2, Lot 1
 * (rif-framework/Implementations/RIF-App/DECISIONS.md D-22, ADR-022).
 *
 * Un RenderTarget représente une cible de rendu identifiable dans un projet
 * (« Perspective entrée », « Axonométrie générale »...). Plusieurs
 * générations/variantes/corrections peuvent viser la même cible ; chaque
 * cible a au plus une génération canonique (lib/rif/depot-neon.ts).
 *
 * `OutputType` reste volontairement à deux valeurs (confirmé RDV Évariste
 * 18.09.2026) — ne pas en ajouter d'autres dans ce lot.
 */

export const OUTPUT_TYPES = ['PHOTOREALISTIC_PERSPECTIVE', 'PHOTOREALISTIC_AXONOMETRY'] as const
export type OutputType = (typeof OUTPUT_TYPES)[number]

export function estOutputTypeValide(valeur: string): valeur is OutputType {
  return (OUTPUT_TYPES as readonly string[]).includes(valeur)
}

/**
 * Cible de rendu — persistée dans `render_targets` (neon/migrations/0002).
 * Champs volontairement minimaux (mission Lot 1 §4) : pas de `status` propre
 * (le statut utile est celui de ses générations, jamais dupliqué ici), pas
 * de champ spéculatif. `canonicalGenerationId` est `null` tant qu'aucun
 * verdict humain n'a validé une génération de cette cible (même garde que
 * l'ancien mécanisme dossier-large, voir depot-neon.ts::definirGenerationCanonique).
 */
export interface RenderTarget {
  id: string
  dossierId: string
  name: string
  outputType: OutputType
  canonicalGenerationId: string | null
  createdAt: string
  updatedAt: string
}

export interface ParametresNouveauRenderTarget {
  dossierId: string
  name: string
  outputType: OutputType
}

import { CRITERES_CONTROLE, type CritereControle } from './controle-qualite'

/**
 * Grille officielle LIB-002 §3 (05_CHECKLIST_CONTROLE.md V1.9) — un
 * `QualityProfile` ne fait qu'ordonner un SOUS-ENSEMBLE de critères déjà
 * documentés, il n'en invente jamais un nouveau ici (les deux critères
 * réellement nouveaux, `elements_inventes`/`photorealisme`, sont ajoutés à
 * la grille elle-même, pas seulement à ce profil — voir
 * controle-qualite.ts::CRITERES_CONTROLE).
 *
 * Choix de correspondance documentés (mission Lot 1 §9, termes Évariste
 * → critère LIB-002 existant, pour ne pas dupliquer un critère déjà
 * couvert) :
 * - `conservation_existant` (Évariste) → `environnement` (LIB-002 couvre
 *   déjà le respect de l'état déclaré locked/editable/harmonizable, PRD §14).
 * - `faitages`/`pans_toiture` → `toiture` (la grille LIB-002 définit déjà
 *   « pans, faîtages, rives, débords, noues » sous ce seul critère).
 * - `coherence_spatiale`/`relations_batiments` → `implantation` (déjà
 *   « bâtiment, piscine, terrasses, annexes »).
 * - `lisibilite` (axonométrie) → `silhouette` (clarté de lecture du contour
 *   géométrique — simplification assumée : pas un critère dédié tant
 *   qu'aucun retour terrain ne le justifie).
 * - `qualite_visuelle` (axonométrie) → `photorealisme` (même critère que
 *   « photoréalisme » en perspective ; la description de la ligne de rapport,
 *   pas l'identifiant, porte la nuance « objectif secondaire »).
 */
export interface QualityProfile {
  outputType: OutputType
  /** Ordre = priorité (mission Lot 1 §3), tous des `CritereControle` existants. */
  criteresPrioritaires: CritereControle[]
}

export const QUALITY_PROFILES: Record<OutputType, QualityProfile> = {
  PHOTOREALISTIC_PERSPECTIVE: {
    outputType: 'PHOTOREALISTIC_PERSPECTIVE',
    criteresPrioritaires: [
      'implantation',
      'cadrage',
      'perspective',
      'volumes',
      'ouvertures',
      'toiture',
      'environnement',
      'elements_inventes',
      'photorealisme',
    ],
  },
  PHOTOREALISTIC_AXONOMETRY: {
    outputType: 'PHOTOREALISTIC_AXONOMETRY',
    criteresPrioritaires: [
      'toiture',
      'volumes',
      'implantation',
      'environnement',
      'elements_inventes',
      'silhouette',
      'photorealisme',
    ],
  },
}

export function obtenirQualityProfile(outputType: OutputType): QualityProfile {
  return QUALITY_PROFILES[outputType]
}

/**
 * Critères applicables pour une génération donnée. Sans `OutputType` connu
 * (génération legacy, sans RenderTarget), retombe sur la grille complète —
 * jamais un sous-ensemble arbitraire pour un dossier qui n'a pas encore
 * adopté le modèle RenderTarget (compatibilité legacy, mission Lot 1 §6).
 */
export function criteresApplicables(outputType: OutputType | undefined): CritereControle[] {
  return outputType ? QUALITY_PROFILES[outputType].criteresPrioritaires : [...CRITERES_CONTROLE]
}
