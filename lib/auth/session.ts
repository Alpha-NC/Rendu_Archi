/**
 * Mot de passe unique partage (PRD §8) : pas de comptes, pas de roles.
 * Le cookie ne porte jamais le mot de passe en clair, seulement son
 * empreinte SHA-256 — comparee a celle du mot de passe configure.
 */

export const NOM_COOKIE = 'rendu_session'
export const DUREE_COOKIE_SECONDES = 60 * 60 * 24 * 30

async function empreinte(valeur: string): Promise<string> {
  const donnees = new TextEncoder().encode(valeur)
  const hachage = await crypto.subtle.digest('SHA-256', donnees)
  return Array.from(new Uint8Array(hachage))
    .map((octet) => octet.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Empreinte du mot de passe configure, ou null si `APP_PASSWORD` est absent :
 * la protection reste alors desactivee plutot que de verrouiller tout le
 * monde dehors, notamment en developpement local sans variable posee.
 */
export function jetonAttendu(): Promise<string | null> {
  const motDePasse = process.env.APP_PASSWORD
  return motDePasse ? empreinte(motDePasse) : Promise.resolve(null)
}

/** Empreinte d'un mot de passe saisi, a comparer a `jetonAttendu()`. */
export function jetonPour(motDePasse: string): Promise<string> {
  return empreinte(motDePasse)
}
