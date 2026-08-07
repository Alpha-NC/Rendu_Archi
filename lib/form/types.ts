export type Etape = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type TypeProjet =
  | 'piscine'
  | 'extension'
  | 'restructuration'
  | 'terrasse'
  | 'pool_house'

export type Usage = 'permis_de_construire' | 'presentation_client' | 'les_deux'

export type TypeCadrage = 'perspective' | 'axonometrie'

export type Categorie =
  | 'toiture'
  | 'facade'
  | 'volets'
  | 'menuiseries'
  | 'margelles'
  | 'plage'

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

export type CleEclairage =
  | 'margelles'
  | 'sousMarin'
  | 'appliquesFacade'
  | 'interieurVisible'

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

export const CATEGORIES: readonly Categorie[] = [
  'toiture',
  'facade',
  'volets',
  'menuiseries',
  'margelles',
  'plage',
]
