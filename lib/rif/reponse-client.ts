/**
 * Lit une réponse fetch des Route Handlers RIF (`{ success, error: { message } }`,
 * voir app/api/dossiers/_lib/reponse.ts) de façon robuste côté navigateur.
 *
 * Trouvé après un 413 en production (upload direct Vercel Blob, D-19,
 * §16.1) : le code appelant faisait `await reponse.json()` sans jamais
 * vérifier `reponse.ok` ni la présence d'un corps — un 413 posé par la
 * plateforme avant d'atteindre notre code (corps vide ou non-JSON), ou tout
 * autre échec d'infrastructure, remontait tel quel « Unexpected end of JSON
 * input » à l'utilisateur au lieu d'un message exploitable.
 */
export async function lireReponseApi<T = Record<string, unknown>>(reponse: Response): Promise<T> {
  if (reponse.status === 413) {
    throw new Error("Le fichier dépasse la taille autorisée pour ce mode d'upload.")
  }

  const texte = await reponse.text()
  if (!texte) {
    throw new Error(`Erreur serveur (HTTP ${reponse.status}).`)
  }

  let corps: unknown
  try {
    corps = JSON.parse(texte)
  } catch {
    throw new Error(`Réponse serveur inattendue (HTTP ${reponse.status}).`)
  }

  const objet = corps as { success?: boolean; error?: { message?: string } }
  if (!reponse.ok || !objet.success) {
    throw new Error(objet.error?.message ?? `Erreur serveur (HTTP ${reponse.status}).`)
  }

  return corps as T
}
