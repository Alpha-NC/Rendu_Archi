import type {
  AspectPelouse,
  Categorie,
  Ciel,
  ModeProduction,
  Style,
  TypeCadrage,
  TypeProjet,
  Usage,
} from '@/lib/form/types'

export type MateriauCatalogue = { id: string; terme: string }

export type RequeteGetMateriaux = { action: 'get_materiaux' }

export type ReponseGetMateriaux = {
  materiaux: Record<Categorie, MateriauCatalogue[]>
}

export type MateriauEnvoye =
  | { origine: 'catalogue'; id: string; terme: string }
  | { origine: 'existant' }

export type MateriauLibre = { categorie: Categorie; terme: string }

export type EclairagesEnvoyes = {
  margelles: boolean
  sous_marin: boolean
  appliques_facade: boolean
  interieur_visible: boolean
}

export type RequeteGenerate = {
  action: 'generate'
  reference: string
  projet: { type: TypeProjet; usage: Usage | null }
  cadrage: { type: TypeCadrage }
  mode_production: ModeProduction
  images: {
    cadrage: string
    complementaire: string | null
    site: string | null
  }
  elements_a_preserver: string
  materiaux: Record<Categorie, MateriauEnvoye | null>
  materiaux_libres: MateriauLibre[]
  environnement: {
    conserver_vegetation: boolean
    aspect_pelouse: AspectPelouse
    elements_a_retirer: string
    ciel: Ciel
    eclairages: EclairagesEnvoyes | null
  }
  style: Style
  precisions: string
}

export type ReponseGenerate = {
  cycle_id: string
  reference: string
  image_url: string
  prompt: string
}

export type ReponseErreur = { erreur: { code: string; message: string } }

export function estErreur(valeur: unknown): valeur is ReponseErreur {
  return typeof valeur === 'object' && valeur !== null && 'erreur' in valeur
}
