/**
 * Client fal.ai — soumission en file d'attente puis polling jusqu'à un état
 * terminal.
 *
 * Répond au risque #2 du prémortem du 02.09.2026 : « le polling n'a jamais
 * été validé de bout en bout », dont le symptôme est de retourner un
 * `request_id` (status `IN_QUEUE`) en le présentant comme un résultat.
 *
 * Règles appliquées ici :
 * - aucune réponse sans `image_url` n'est jamais considérée comme un succès ;
 * - le polling se poursuit jusqu'à succès, échec ou timeout — jamais d'état
 *   intermédiaire rendu à l'appelant (PRD §9.5) ;
 * - le timeout est explicite (PRD §18.3 : 3 minutes, à réajuster après
 *   mesure en Phase 0B) et produit un échec nommé, jamais un silence ;
 * - la clé API est lue côté serveur uniquement.
 *
 * D-05 : appel direct depuis le backend applicatif, sans service intermédiaire.
 */

export const MODELE_FAL = 'fal-ai/nano-banana-pro/edit'

const BASE_QUEUE = 'https://queue.fal.run'

export interface OptionsGeneration {
  prompt: string
  imageUrls: string[]
  /** Signal d'annulation (ex. abandon côté appelant). */
  signal?: AbortSignal
}

export interface ParametresPolling {
  /** PRD §18.3 : timeout explicite après 3 minutes. */
  timeoutMs?: number
  /** Intervalle entre deux vérifications de statut. */
  intervalleMs?: number
  /** Injectable pour les tests — par défaut `globalThis.fetch`. */
  fetchImpl?: typeof fetch
  /** Injectable pour les tests — par défaut une vraie attente. */
  attendre?: (ms: number) => Promise<void>
  maintenant?: () => number
}

export type ResultatGeneration =
  | { statut: 'succes'; imageUrl: string; requestId: string }
  | {
      statut: 'echec'
      code: 'fal_ai_echec' | 'generation_echouee' | 'timeout' | 'reponse_inexploitable'
      message: string
      requestId?: string
    }

const attenteReelle = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function cleFal(): string {
  const cle = process.env.FAL_KEY
  if (!cle) throw new Error('FAL_KEY absente des variables d\'environnement serveur.')
  return cle
}

/**
 * Extrait l'URL d'image d'une réponse fal.ai. Retourne `null` si la réponse
 * ne contient pas d'image exploitable — y compris quand elle contient un
 * `request_id` ou un `status` : c'est précisément le cas que le prémortem
 * décrit comme confondu avec un succès.
 */
export function extraireImageUrl(reponse: unknown): string | null {
  if (!reponse || typeof reponse !== 'object') return null
  const images = (reponse as { images?: unknown }).images
  if (!Array.isArray(images) || images.length === 0) return null
  const premiere = images[0]
  if (!premiere || typeof premiere !== 'object') return null
  const url = (premiere as { url?: unknown }).url
  return typeof url === 'string' && url.length > 0 ? url : null
}

/**
 * Soumet une génération et attend son état terminal.
 *
 * Ne retourne jamais tant qu'un état terminal n'est pas atteint : l'appelant
 * reçoit une image ou un échec nommé, jamais un identifiant de file.
 */
export async function genererEtAttendre(
  options: OptionsGeneration,
  parametres: ParametresPolling = {},
): Promise<ResultatGeneration> {
  const {
    timeoutMs = 180_000,
    intervalleMs = 2_000,
    fetchImpl = fetch,
    attendre = attenteReelle,
    maintenant = Date.now,
  } = parametres

  const entetes = {
    Authorization: `Key ${cleFal()}`,
    'Content-Type': 'application/json',
  }

  let requestId: string
  try {
    const soumission = await fetchImpl(`${BASE_QUEUE}/${MODELE_FAL}`, {
      method: 'POST',
      headers: entetes,
      body: JSON.stringify({ prompt: options.prompt, image_urls: options.imageUrls }),
      signal: options.signal,
    })

    if (!soumission.ok) {
      return {
        statut: 'echec',
        code: 'fal_ai_echec',
        message: `Soumission refusée par fal.ai (HTTP ${soumission.status}).`,
      }
    }

    const corps = (await soumission.json()) as { request_id?: string }
    if (!corps.request_id) {
      return {
        statut: 'echec',
        code: 'reponse_inexploitable',
        message: 'Réponse de soumission sans request_id.',
      }
    }
    requestId = corps.request_id
  } catch (erreur) {
    return {
      statut: 'echec',
      code: 'fal_ai_echec',
      message: erreur instanceof Error ? erreur.message : 'Appel fal.ai impossible.',
    }
  }

  const debut = maintenant()

  while (maintenant() - debut < timeoutMs) {
    await attendre(intervalleMs)

    let statutFal: string | undefined
    try {
      const reponseStatut = await fetchImpl(
        `${BASE_QUEUE}/${MODELE_FAL}/requests/${requestId}/status`,
        { headers: entetes, signal: options.signal },
      )
      const corpsStatut = (await reponseStatut.json()) as { status?: string }
      statutFal = corpsStatut.status
    } catch (erreur) {
      return {
        statut: 'echec',
        code: 'fal_ai_echec',
        message: erreur instanceof Error ? erreur.message : 'Polling fal.ai interrompu.',
        requestId,
      }
    }

    // IN_QUEUE et IN_PROGRESS ne sont PAS des résultats : on continue.
    if (statutFal === 'IN_QUEUE' || statutFal === 'IN_PROGRESS') continue

    if (statutFal !== 'COMPLETED') {
      return {
        statut: 'echec',
        code: 'generation_echouee',
        message: `Génération terminée sur un statut inattendu : ${statutFal ?? 'inconnu'}.`,
        requestId,
      }
    }

    try {
      const reponseResultat = await fetchImpl(
        `${BASE_QUEUE}/${MODELE_FAL}/requests/${requestId}`,
        { headers: entetes, signal: options.signal },
      )
      const imageUrl = extraireImageUrl(await reponseResultat.json())
      if (!imageUrl) {
        return {
          statut: 'echec',
          code: 'reponse_inexploitable',
          message: 'Réponse fal.ai sans image exploitable.',
          requestId,
        }
      }
      return { statut: 'succes', imageUrl, requestId }
    } catch (erreur) {
      return {
        statut: 'echec',
        code: 'fal_ai_echec',
        message: erreur instanceof Error ? erreur.message : 'Récupération du résultat impossible.',
        requestId,
      }
    }
  }

  return {
    statut: 'echec',
    code: 'timeout',
    message: `Aucun résultat après ${Math.round(timeoutMs / 1000)} secondes.`,
    requestId,
  }
}
