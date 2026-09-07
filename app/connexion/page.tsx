'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { creerClientNavigateur } from '@/lib/supabase/client'
import { cibleRedirectionSure } from '@/lib/securite/redirection-sure'

/**
 * Authentification individuelle (Supabase Auth) — remplace le mot de passe
 * unique partagé du formulaire V2 (PRD §17 : « Authentification individuelle
 * obligatoire avant tout dossier réel, même avec un seul utilisateur »).
 */
export default function PageConnexion() {
  return (
    <Suspense>
      <FormulaireConnexion />
    </Suspense>
  )
}

function FormulaireConnexion() {
  const router = useRouter()
  const parametres = useSearchParams()
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  async function seConnecter(evenement: React.FormEvent) {
    evenement.preventDefault()
    setErreur(null)
    setEnCours(true)

    const supabase = creerClientNavigateur()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: motDePasse,
    })

    setEnCours(false)

    if (error) {
      setErreur('Identifiants incorrects.')
      return
    }

    router.push(cibleRedirectionSure(parametres.get('redirect')))
    router.refresh()
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <p className="font-mono text-xs uppercase tracking-widest text-encre-douce">
        Alpha No_Code
      </p>
      <h1 className="mt-2 font-sans text-2xl font-semibold tracking-tight text-encre">
        Connexion
      </h1>

      <form onSubmit={seConnecter} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-encre">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded border border-encre-douce/40 px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-encre">
          Mot de passe
          <input
            type="password"
            required
            autoComplete="current-password"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            className="rounded border border-encre-douce/40 px-3 py-2 text-sm"
          />
        </label>

        {erreur && <p className="text-sm text-red-600">{erreur}</p>}

        <button
          type="submit"
          disabled={enCours}
          className="mt-2 rounded bg-encre px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {enCours ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </main>
  )
}
