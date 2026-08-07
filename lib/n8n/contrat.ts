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

/**
 * Une reponse 2xx sans cle `erreur` n'est pas pour autant un succes.
 * Le node « Respond to Webhook » de n8n renvoie par defaut ses items sous
 * forme de tableau : `[{ cycle_id, image_url }]` traverserait `estErreur`
 * sans encombre et donnerait un `<img>` casse apres quatre-vingt-dix
 * secondes d'attente, sans le moindre message.
 */
export function estReponseGenerate(valeur: unknown): valeur is ReponseGenerate {
  if (typeof valeur !== 'object' || valeur === null || Array.isArray(valeur)) {
    return false
  }
  const { cycle_id, image_url } = valeur as Record<string, unknown>
  return (
    typeof cycle_id === 'string' &&
    typeof image_url === 'string' &&
    image_url.length > 0
  )
}

/** Erreur metier renvoyee par n8n : la requete a abouti, le traitement a refuse. */
export class ErreurMetier extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ErreurMetier'
  }
}

/**
 * Echec de transport : coupure, timeout de proxy, statut non-2xx, reponse
 * inexploitable. Distinct d'une erreur metier parce que la generation a pu
 * aboutir cote serveur malgre la coupure — derriere un proxy coupant a
 * 100 s, une generation reussie arrive en 524.
 */
export class ErreurReseau extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ErreurReseau'
  }
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
