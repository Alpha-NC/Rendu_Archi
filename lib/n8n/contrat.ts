/**
 * Le contrat externe emploie volontairement le vocabulaire du domaine
 * interne : les valeurs du webhook et celles du formulaire sont les memes par
 * conception, et dupliquer les six unions creerait deux listes a synchroniser
 * a la main dont la divergence ne se verrait qu'a l'execution, cote n8n.
 * Consequence a garder en tete : renommer une valeur dans
 * `lib/form/types.ts` modifie le contrat externe et exige une modification
 * du workflow n8n. Si les deux vocabulaires doivent un jour diverger, la
 * couture est une fonction de traduction dans `payload.ts`, pas une copie
 * des types ici.
 */
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

/**
 * Verifie la forme imbriquee, pas seulement la presence de la cle.
 * C'est le chemin le moins pardonnable : une reponse `{ erreur: null }` ferait
 * lever un TypeError brut au moment precis ou l'on veut afficher a
 * l'utilisateur le message metier renvoye par n8n.
 */
export function estErreur(valeur: unknown): valeur is ReponseErreur {
  if (typeof valeur !== 'object' || valeur === null || !('erreur' in valeur)) {
    return false
  }
  const { erreur } = valeur as { erreur: unknown }
  if (typeof erreur !== 'object' || erreur === null) return false
  const { code, message } = erreur as { code?: unknown; message?: unknown }
  return typeof code === 'string' && typeof message === 'string'
}
