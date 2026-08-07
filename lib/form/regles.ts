import type {
  Categorie,
  Ciel,
  CleEclairage,
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
 * Le photomontage n'est revendique que sur une perspective averee, jamais
 * par defaut : tant que le cadrage n'est pas choisi, une photo seule ne
 * suffit pas.
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
 * Styles proposables selon le mode, dans l'ordre d'affichage de l'etape 5.
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
 * Categories de materiaux affichees selon le type de projet, dans l'ordre
 * d'affichage de l'etape 3.
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
    case null:
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

const ECLAIRAGES_BATI: CleEclairage[] = ['appliquesFacade', 'interieurVisible']
const ECLAIRAGES_PISCINE: CleEclairage[] = ['margelles', 'sousMarin']

/**
 * Eclairages proposes, dans l'ordre d'affichage : ceux du bassin n'ont de
 * sens que sur un projet qui en comporte un.
 * La fonction rend la liste et non un booleen, pour que les cles restent
 * dans ce module. Le reducer s'en sert aussi pour eteindre un eclairage
 * devenu sans objet apres un changement de type de projet.
 */
export function eclairagesProposes(typeProjet: TypeProjet | null): CleEclairage[] {
  const avecBassin = typeProjet === 'piscine' || typeProjet === 'pool_house'
  return avecBassin ? [...ECLAIRAGES_PISCINE, ...ECLAIRAGES_BATI] : [...ECLAIRAGES_BATI]
}
