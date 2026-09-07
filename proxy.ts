import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Rafraîchit la session Supabase à chaque requête et bloque l'accès aux
 * routes protégées pour un utilisateur non authentifié.
 *
 * RIF-App impose une authentification individuelle avant tout dossier réel
 * (PRD §17) — contrairement au mot de passe unique partagé du formulaire V2
 * (middleware.ts précédent, supprimé lors du retrait de la V2).
 */
export async function proxy(requete: NextRequest) {
  let reponse = NextResponse.next({ request: requete })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return requete.cookies.getAll()
        },
        setAll(cookiesASetter) {
          for (const { name, value } of cookiesASetter) {
            requete.cookies.set(name, value)
          }
          reponse = NextResponse.next({ request: requete })
          for (const { name, value, options } of cookiesASetter) {
            reponse.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const cheminPublic =
    requete.nextUrl.pathname.startsWith('/connexion') ||
    requete.nextUrl.pathname.startsWith('/_next')

  // Les routes API (ex. /api/dossiers/.../generer) ne redirigent jamais :
  // un client programmatique doit recevoir un 401 JSON exploitable, pas une
  // redirection vers une page HTML de connexion. Chaque Route Handler fait
  // sa propre vérification via authentifierRequete() (PRD §17).
  const cheminApi = requete.nextUrl.pathname.startsWith('/api/')

  if (!user && cheminApi) {
    return NextResponse.json(
      { success: false, error: { code: 'non_authentifie', message: 'Authentification requise.' } },
      { status: 401 },
    )
  }

  if (!user && !cheminPublic) {
    const urlConnexion = requete.nextUrl.clone()
    urlConnexion.pathname = '/connexion'
    urlConnexion.searchParams.set('redirect', requete.nextUrl.pathname)
    return NextResponse.redirect(urlConnexion)
  }

  return reponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
