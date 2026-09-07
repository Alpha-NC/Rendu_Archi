/**
 * Valide qu'une cible de redirection post-connexion est un chemin relatif
 * interne, jamais une URL absolue ou protocol-relative — évite l'open
 * redirect via `?redirect=` (ex. `//evil.tld`, `https://evil.tld`,
 * `/\evil.tld`, que certains navigateurs traitent comme protocol-relative).
 *
 * Trouvé par revue de sécurité automatisée le 07.09.2026 sur
 * app/connexion/page.tsx, qui passait `parametres.get('redirect')` tel quel
 * à `router.push`.
 */
export function cibleRedirectionSure(cible: string | null): string {
  if (!cible) return '/'
  const estCheminRelatifInterne =
    cible.startsWith('/') && !cible.startsWith('//') && !cible.startsWith('/\\')
  return estCheminRelatifInterne ? cible : '/'
}
