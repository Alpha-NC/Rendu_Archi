export type Etape = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type TypeProjet =
  | 'piscine'
  | 'extension'
  | 'restructuration'
  | 'terrasse'
  | 'pool_house'

export type Usage = 'permis_de_construire' | 'presentation_client' | 'les_deux'

export type TypeCadrage = 'perspective' | 'axonometrie'

/**
 * L'union est derivee du tableau, et non l'inverse : une annotation
 * `readonly Categorie[]` verifierait que chaque element est une categorie,
 * jamais que les six y sont. Un tableau incomplet compilerait en silence et
 * `payload.ts` enverrait une cle absente la ou le contrat exige `null`.
 */
export const CATEGORIES = [
  'toiture',
  'facade',
  'volets',
  'menuiseries',
  'margelles',
  'plage',
] as const

export type Categorie = (typeof CATEGORIES)[number]

export type Style =
  | 'photomontage_administratif'
  | 'presentation_client'
  | 'commercial'

export type ModeProduction =
  | 'photomontage_controle'
  | 'presentation_generative'
  | 'retexturation_revit'

export type Ciel =
  | 'reprendre_photo'
  | 'degage'
  | 'legerement_voile'
  | 'neutre_diffus'
  | 'fin_de_journee'
  | 'crepuscule'

export type AspectPelouse = 'telle_quelle' | 'tondue_soignee' | 'fleurie'

/** Meme raison que pour CATEGORIES : la liste doit etre prouvablement complete. */
export const CLES_ECLAIRAGE = [
  'margelles',
  'sousMarin',
  'appliquesFacade',
  'interieurVisible',
] as const

export type CleEclairage = (typeof CLES_ECLAIRAGE)[number]

export type Eclairages = Record<CleEclairage, boolean>

export type RoleImage = 'cadrage' | 'complementaire' | 'site'

export type ImageChargee = {
  dataUri: string
  nomOrigine: string
  largeur: number
  hauteur: number
  poidsOctets: number
}

export type ImagesFormulaire = Record<RoleImage, ImageChargee | null>

export type SelectionMateriau =
  | { origine: 'catalogue'; id: string; terme: string }
  | { origine: 'libre'; terme: string }
  | { origine: 'existant' }

export type EtatFormulaire = {
  etape: Etape
  etapeMax: Etape

  reference: string
  typeProjet: TypeProjet | null
  usage: Usage | null

  typeCadrage: TypeCadrage | null
  images: ImagesFormulaire
  elementsAPreserver: string

  materiaux: Record<Categorie, SelectionMateriau | null>

  conserverVegetation: boolean
  aspectPelouse: AspectPelouse
  elementsARetirer: string
  ciel: Ciel
  cielChoisiManuellement: boolean
  eclairages: Eclairages

  style: Style | null
  styleChoisiManuellement: boolean

  precisions: string
}
