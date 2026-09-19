'use client'

import { ErrorState } from '@/app/ui/Primitives'

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="route-error">
      <section className="route-error__card">
        <p className="eyebrow">Interface indisponible</p>
        <h1>Cette page n’a pas pu s’afficher.</h1>
        <ErrorState message="Une erreur technique a interrompu le chargement. Vos données n’ont pas été modifiées." />
        <button type="button" className="button button--primary" onClick={reset}>
          Réessayer
        </button>
      </section>
    </main>
  )
}
