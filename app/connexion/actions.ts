'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DUREE_COOKIE_SECONDES, NOM_COOKIE, jetonAttendu, jetonPour } from '@/lib/auth/session'

export async function seConnecter(donnees: FormData): Promise<void> {
  const motDePasse = String(donnees.get('motDePasse') ?? '')
  const suiteBrute = String(donnees.get('suite') ?? '/')
  const suite = suiteBrute.startsWith('/') ? suiteBrute : '/'

  const attendu = await jetonAttendu()
  if (attendu !== null && (await jetonPour(motDePasse)) === attendu) {
    const magasin = await cookies()
    magasin.set(NOM_COOKIE, attendu, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: DUREE_COOKIE_SECONDES,
      path: '/',
    })
    redirect(suite)
  }

  redirect(`/connexion?erreur=1&suite=${encodeURIComponent(suite)}`)
}
