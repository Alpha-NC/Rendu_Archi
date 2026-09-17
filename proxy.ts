import { auth } from '@/lib/auth/server'

/**
 * Garde d'accès (PRD §17) — délègue à Neon Auth (D-19, bascule Neon).
 *
 * Les routes /api/* sont exclues du matcher : un client programmatique doit
 * recevoir un 401 JSON exploitable, pas une redirection vers une page HTML
 * de connexion. Chaque Route Handler fait sa propre vérification via
 * authentifierRequete() (app/api/dossiers/_lib/reponse.ts).
 */
export const proxy = auth.middleware({ loginUrl: '/connexion' })

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api|connexion|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
