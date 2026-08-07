import type {
  AspectPelouse,
  Categorie,
  Ciel,
  CleEclairage,
  Style,
  TypeCadrage,
  TypeProjet,
  Usage,
} from './types'

export const LIBELLE_TYPE_PROJET: Record<TypeProjet, string> = {
  piscine: 'Piscine',
  extension: 'Extension',
  restructuration: 'Restructuration',
  terrasse: 'Terrasse',
  pool_house: 'Pool house',
}

export const LIBELLE_USAGE: Record<Usage, string> = {
  permis_de_construire: 'Permis de construire',
  presentation_client: 'Présentation client',
  les_deux: 'Les deux',
}

export const LIBELLE_CADRAGE: Record<TypeCadrage, string> = {
  perspective: 'Perspective',
  axonometrie: 'Axonométrie',
}

export const LIBELLE_CATEGORIE: Record<Categorie, string> = {
  toiture: 'Toiture',
  facade: 'Façade',
  volets: 'Volets',
  menuiseries: 'Menuiseries',
  margelles: 'Margelles',
  plage: 'Plage de piscine',
}

export const LIBELLE_CIEL: Record<Ciel, string> = {
  reprendre_photo: 'Reprendre la lumière de la photo',
  degage: 'Dégagé',
  legerement_voile: 'Légèrement voilé',
  neutre_diffus: 'Neutre diffus',
  fin_de_journee: 'Fin de journée, lumière chaude',
  crepuscule: 'Crépuscule',
}

export const LIBELLE_PELOUSE: Record<AspectPelouse, string> = {
  telle_quelle: 'Telle quelle',
  tondue_soignee: 'Tondue et soignée',
  fleurie: 'Fleurie, type prairie avec marguerites',
}

export const ORDRE_PELOUSE: readonly AspectPelouse[] = [
  'telle_quelle',
  'tondue_soignee',
  'fleurie',
]

export const LIBELLE_ECLAIRAGE: Record<CleEclairage, string> = {
  margelles: 'Éclairage des margelles',
  sousMarin: 'Éclairage sous-marin de la piscine',
  appliquesFacade: 'Appliques de façade',
  interieurVisible: 'Intérieur visible par les baies',
}

export const LIBELLE_STYLE: Record<Style, string> = {
  photomontage_administratif: 'Photomontage administratif',
  presentation_client: 'Présentation client',
  commercial: 'Commercial',
}

export const DESCRIPTION_STYLE: Record<Style, string> = {
  photomontage_administratif:
    "Insertion sur photographie réelle, sans effet. Pour un permis de construire ou une déclaration préalable.",
  presentation_client:
    'Photoréalisme soigné, lumière chaleureuse mais réaliste. Pour une réunion ou un avant-projet.',
  commercial:
    'Registre de la photographie résidentielle professionnelle : lumière travaillée, contraste marqué, matières profondes.',
}
