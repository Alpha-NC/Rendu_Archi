import { mockGenerate, mockGetMateriaux } from './mock'
import {
  ErreurMetier,
  ErreurReseau,
  estErreur,
  estReponseGenerate,
} from './contrat'
import { CATEGORIES } from '@/lib/form/types'
import type {
  ReponseGenerate,
  ReponseGetMateriaux,
  RequeteGenerate,
} from './contrat'

export { ErreurMetier, ErreurReseau } from './contrat'

/**
 * Traduit une reponse deja lue en issue du domaine. Aucun acces reseau, donc
 * testable sur des objets nus.
 *
 * C'est la seule fonction du projet dont la sortie n'est pas une valeur mais
 * un choix parmi trois issues, et ce choix determine mot pour mot ce que
 * l'utilisateur lit apres quatre-vingt-dix secondes d'attente.
 */
export function interpreter<T>(
  statut: number,
  charge: unknown,
  estAttendue: (valeur: unknown) => valeur is T,
): T {
  if (statut < 200 || statut >= 300) {
    throw new ErreurReseau(`Le service a répondu avec le statut ${statut}.`)
  }
  if (estErreur(charge)) {
    throw new ErreurMetier(charge.erreur.code, charge.erreur.message)
  }
  if (!estAttendue(charge)) {
    throw new ErreurReseau("La réponse du service n'est pas exploitable.")
  }
  return charge
}

function urlWebhook(): string | null {
  const url = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL
  return url && url.trim().length > 0 ? url.trim() : null
}

/** Vrai quand aucune URL n'est configuree : le client sert alors le mock. */
export function enModeMock(): boolean {
  return urlWebhook() === null
}

/** En deca de ce delai, la requete n'a pas pu atteindre le moteur. */
const DELAI_ECHEC_IMMEDIAT_MS = 5000

async function appeler<T>(
  corps: object,
  estAttendue: (valeur: unknown) => valeur is T,
): Promise<T> {
  const url = urlWebhook()
  if (url === null) {
    throw new ErreurReseau("Aucune URL de webhook n'est configurée.")
  }

  const depart = Date.now()
  let reponse: Response
  try {
    reponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
    })
  } catch {
    // Un rejet quasi immediat n'a pas atteint le service : refus CORS,
    // DNS, hors ligne. Le distinguer d'une coupure tardive evite d'annoncer
    // « la generation a peut-etre abouti » alors que rien n'est parti.
    throw new ErreurReseau(
      Date.now() - depart < DELAI_ECHEC_IMMEDIAT_MS
        ? "Le service n'a pas pu être contacté. Vérifiez l'adresse du webhook et votre connexion."
        : 'La connexion au service a été interrompue.',
    )
  }

  let charge: unknown
  try {
    charge = await reponse.json()
  } catch {
    charge = null
  }

  return interpreter(reponse.status, charge, estAttendue)
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

/** Le catalogue est normalise ensuite : toute forme d'objet est acceptable ici. */
function estObjet(valeur: unknown): valeur is Partial<ReponseGetMateriaux> {
  return typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur)
}

export async function getMateriaux(): Promise<ReponseGetMateriaux> {
  if (enModeMock()) return mockGetMateriaux()
  const reponse = await appeler({ action: 'get_materiaux' }, estObjet)
  return { materiaux: normaliserCatalogue(reponse.materiaux) }
}

export async function generate(requete: RequeteGenerate): Promise<ReponseGenerate> {
  if (enModeMock()) return mockGenerate(requete)
  return appeler(requete, estReponseGenerate)
}
