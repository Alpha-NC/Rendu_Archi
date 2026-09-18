'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { authClient } from '@/lib/auth/client'
import { cibleRedirectionSure } from '@/lib/securite/redirection-sure'
import { Icon } from '@/app/ui/Icons'

/**
 * Authentification individuelle (Neon Auth, D-19 bascule) — remplace le mot
 * de passe unique partagé du formulaire V2 (PRD §17 : « Authentification
 * individuelle obligatoire avant tout dossier réel, même avec un seul
 * utilisateur »).
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

    const { error } = await authClient.signIn.email({
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
    <main className="login-page">
      <section className="login-visual" aria-label="RIF, rendu architectural fidèle">
        <p className="login-kicker">RIF · Geometry-first</p>
        <div className="login-blueprint" aria-hidden="true"><div className="villa-line" /></div>
        <div className="login-quote">
          <p className="brand-mark">RIF</p>
          <h1>Vos projets,<br/>en toute confiance.</h1>
          <p>L’architecture reste la référence. RIF orchestre les sources, la photoréalisation et la validation de chaque version.</p>
        </div>
      </section>
      <section className="login-form-pane">
        <div className="login-form">
          <p className="eyebrow">Espace professionnel</p>
          <h2>Bon retour.</h2>
          <p className="intro">Connectez-vous à votre atelier RIF.</p>
          <form onSubmit={seConnecter}>
        <label className="field">
          <span>Adresse e-mail</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@agence.fr"
          />
        </label>
        <label className="field">
          <span>Mot de passe</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
          />
        </label>
        {erreur && <div className="error-state" role="alert"><Icon name="warning"/><div><strong>Connexion impossible</strong><p>{erreur}</p></div></div>}
        <button
          type="submit"
          disabled={enCours}
          className="button button--primary"
        >
          {enCours ? 'Connexion…' : 'Se connecter'}
        </button>
          </form>
          <div className="login-note"><Icon name="lock"/><span>Accès individuel sécurisé par Neon Auth. Aucun compte ne peut être créé depuis cette interface.</span></div>
        </div>
      </section>
    </main>
  )
}
