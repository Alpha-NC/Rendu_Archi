import { NextResponse, type NextRequest } from 'next/server'
import { NOM_COOKIE, jetonAttendu } from '@/lib/auth/session'

export const config = {
  matcher: ['/((?!connexion|_next/static|_next/image|favicon.ico).*)'],
}

export async function middleware(requete: NextRequest) {
  const attendu = await jetonAttendu()
  if (attendu === null) return NextResponse.next()

  if (requete.cookies.get(NOM_COOKIE)?.value === attendu) {
    return NextResponse.next()
  }

  const url = requete.nextUrl.clone()
  url.pathname = '/connexion'
  url.searchParams.set('suite', requete.nextUrl.pathname)
  return NextResponse.redirect(url)
}
