import { mockGenerate, mockGetMateriaux } from './mock'
import { estErreur } from './contrat'
import { CATEGORIES } from '@/lib/form/types'
import type {
  ReponseGenerate,
  ReponseGetMateriaux,
  RequeteGenerate,
} from './contrat'

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
 * Echec de transport : coupure, timeout de proxy, statut non-2xx.
 * Distinct d'une erreur metier parce que la generation a pu aboutir cote
 * serveur malgre la coupure — derriere un proxy coupant a 100 s, une
 * generation reussie arrive en 524.
 */
export class ErreurReseau extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ErreurReseau'
  }
}

function urlWebhook(): string | null {
  const url = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL
  return url && url.trim().length > 0 ? url.trim() : null
}

/** Vrai quand aucune URL n'est configuree : le client sert alors le mock. */
export function enModeMock(): boolean {
  return urlWebhook() === null
}

async function appeler<T>(corps: object): Promise<T> {
  const url = urlWebhook()
  if (url === null) {
    throw new ErreurReseau("Aucune URL de webhook n'est configurée.")
  }

  let reponse: Response
  try {
    reponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
    })
  } catch {
    throw new ErreurReseau('La connexion au service a échoué.')
  }

  if (!reponse.ok) {
    throw new ErreurReseau(`Le service a répondu avec le statut ${reponse.status}.`)
  }

  let charge: unknown
  try {
    charge = await reponse.json()
  } catch {
    throw new ErreurReseau('La réponse du service est illisible.')
  }

  if (estErreur(charge)) {
    throw new ErreurMetier(charge.erreur.code, charge.erreur.message)
  }

  return charge as T
}

/**
 * Reconstruit les six categories a partir de CATEGORIES, en defaussant sur
 * un tableau vide. Le contrat impose que n8n les renvoie toutes, mais c'est
 * ici la frontiere entre « ce que le fil a donne » et « ce que le domaine
 * promet » : une cle manquante doit produire une liste vide, pas un ecran
 * blanc a l'etape 3.
 */
function normaliserCatalogue(
  brut: Partial<ReponseGetMateriaux['materiaux']> | undefined,
): ReponseGetMateriaux['materiaux'] {
  const catalogue = {} as ReponseGetMateriaux['materiaux']
  for (const categorie of CATEGORIES) {
    catalogue[categorie] = brut?.[categorie] ?? []
  }
  return catalogue
}

export async function getMateriaux(): Promise<ReponseGetMateriaux> {
  if (enModeMock()) return mockGetMateriaux()
  const reponse = await appeler<Partial<ReponseGetMateriaux>>({
    action: 'get_materiaux',
  })
  return { materiaux: normaliserCatalogue(reponse.materiaux) }
}

export async function generate(requete: RequeteGenerate): Promise<ReponseGenerate> {
  if (enModeMock()) return mockGenerate(requete)
  return appeler<ReponseGenerate>(requete)
}
