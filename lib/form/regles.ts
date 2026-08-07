import type {
  Categorie,
  Ciel,
  ImagesFormulaire,
  ModeProduction,
  Style,
  TypeCadrage,
  TypeProjet,
  Usage,
} from './types'

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

/**
 * Styles proposables selon le mode.
 * Le photomontage administratif exige une photo du site et une perspective :
 * il est structurellement exclu en retexturation Revit (son objet est
 * l'integration a une photographie, absente de ce mode) et exclu en
 * presentation generative faute d'alignement possible avec une axonometrie.
 */
export function stylesDisponibles(mode: ModeProduction): Style[] {
  if (mode === 'photomontage_controle') {
    return ['photomontage_administratif', 'presentation_client', 'commercial']
  }
  return ['presentation_client', 'commercial']
}

/**
 * Style propose par defaut. Le style commercial est reserve a une demande
 * explicite et n'entre jamais dans cette selection.
 * L'usage mixte suit la regle du plus exigeant en fidelite.
 */
export function stylePreselectionne(mode: ModeProduction, usage: Usage | null): Style {
  const photomontageDisponible = stylesDisponibles(mode).includes(
    'photomontage_administratif',
  )
  if (!photomontageDisponible) return 'presentation_client'
  if (usage === 'permis_de_construire' || usage === 'les_deux') {
    return 'photomontage_administratif'
  }
  return 'presentation_client'
}

const MATERIAUX_BATI: Categorie[] = ['toiture', 'facade', 'volets', 'menuiseries']
const MATERIAUX_PISCINE: Categorie[] = ['margelles', 'plage']

/**
 * Categories de materiaux affichees selon le type de projet.
 * Margelles et plage restent deux ouvrages distincts, jamais fusionnes.
 */
export function champsMateriauxPour(typeProjet: TypeProjet | null): Categorie[] {
  switch (typeProjet) {
    case 'piscine':
      return [...MATERIAUX_PISCINE]
    case 'extension':
    case 'restructuration':
      return [...MATERIAUX_BATI]
    case 'pool_house':
      return [...MATERIAUX_BATI, ...MATERIAUX_PISCINE]
    case 'terrasse':
    default:
      return []
  }
}

/**
 * L'option « conserver l'existant » n'a de sens que lorsque la photographie
 * montre un bati existant que le projet reprend : extension et
 * restructuration. Le materiau est alors repris tel quel, jamais interprete.
 */
export function conservationExistantProposee(
  typeProjet: TypeProjet | null,
  images: ImagesFormulaire,
): boolean {
  if (!images.site) return false
  return typeProjet === 'extension' || typeProjet === 'restructuration'
}

/**
 * Preselection de l'ambiance lumineuse. La lumiere de la photographie sert
 * de reference quand elle existe, une lumiere neutre a defaut. Ce n'est
 * qu'une valeur de depart : toutes les ambiances restent choisissables.
 */
export function cielProposeParDefaut(images: ImagesFormulaire): Ciel {
  return images.site ? 'reprendre_photo' : 'neutre_diffus'
}

/**
 * Une ambiance de fin de journee ou de crepuscule appelle une question
 * complementaire sur les eclairages : sans elle, le resultat montre une
 * maison eteinte.
 */
export function eclairagesDemandes(ciel: Ciel): boolean {
  return ciel === 'fin_de_journee' || ciel === 'crepuscule'
}

/** Les eclairages de bassin n'ont de sens que sur un projet qui en comporte un. */
export function eclairagesPiscineProposes(typeProjet: TypeProjet | null): boolean {
  return typeProjet === 'piscine' || typeProjet === 'pool_house'
}
