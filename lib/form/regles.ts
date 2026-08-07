import type { ImagesFormulaire, ModeProduction, TypeCadrage } from './types'

/**
 * Matrice de deduction du mode de production.
 * Le mode n'est jamais affiche : il commande uniquement les styles
 * proposables et la clause de prompt construite cote n8n.
 */
export function modeProduction(
  images: ImagesFormulaire,
  typeCadrage: TypeCadrage | null,
): ModeProduction {
  if (!images.site) return 'retexturation_revit'
  if (typeCadrage === 'perspective') return 'photomontage_controle'
  return 'presentation_generative'
}
