import { CATEGORIES } from './types'
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

/**
 * Categories de materiaux affichees a l'etape 3, dans l'ordre d'affichage.
 * Les six categories sont toujours proposees, quel que soit le type de
 * projet : ce qui determine si un materiau doit etre precise n'est pas le
 * type coche mais ce qui est effectivement visible sur la vue de cadrage et
 * la photo du site. Un projet piscine peut tres bien montrer une facade en
 * arriere-plan ; un champ superflu se laisse simplement a « Non renseigne ».
 */
export function champsMateriauxPour(typeProjet: TypeProjet | null): Categorie[] {
  if (typeProjet === null) return []
  return [...CATEGORIES]
}

/**
 * L'option « conserver l'existant » n'a de sens qu'en presence d'une
 * photographie du site : c'est elle qui montre l'aspect reel a reprendre
 * tel quel, quelle que soit la categorie de materiau ou le type de projet.
 */
export function conservationExistantProposee(
  typeProjet: TypeProjet | null,
  images: ImagesFormulaire,
): boolean {
  if (!images.site) return false
  return typeProjet !== null
}

/**
 * Preselection de l'ambiance lumineuse. La lumiere de la photographie sert
 * de reference quand elle existe, une lumiere neutre a defaut. Ce n'est
 * qu'une valeur de depart : toutes les ambiances restent choisissables.
 */
export function cielProposeParDefaut(images: ImagesFormulaire): Ciel {
  return images.site ? 'reprendre_photo' : 'neutre_diffus'
}

const CIELS_EXPLICITES: Ciel[] = [
  'degage',
  'legerement_voile',
  'neutre_diffus',
  'fin_de_journee',
  'crepuscule',
]

/**
 * Ambiances proposables, dans l'ordre d'affichage.
 * « Reprendre la lumiere de la photo » disparait sans photo du site : cette
 * valeur demanderait a n8n de suivre une photographie absente du payload.
 * Oter une option devenue sans referent n'est pas masquer un champ.
 */
export function cielsDisponibles(images: ImagesFormulaire): Ciel[] {
  return images.site ? ['reprendre_photo', ...CIELS_EXPLICITES] : [...CIELS_EXPLICITES]
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
