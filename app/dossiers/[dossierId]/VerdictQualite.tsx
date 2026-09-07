'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

const VERDICTS = [
  { valeur: 'validation', label: 'Valider' },
  { valeur: 'acceptable_avec_reserve', label: 'Acceptable avec réserve' },
  { valeur: 'correction_ciblee', label: 'Corriger' },
  { valeur: 'nouvelle_generation', label: 'Reprendre depuis les sources' },
  { valeur: 'production_suspendue', label: 'Suspendre' },
] as const

/** Verdict HUMAIN (PRD §15.1) — jamais déclenché par le modèle. */
export default function VerdictQualite({
  dossierId,
  generationId,
  imageUrl,
}: {
  dossierId: string
  generationId: string
  imageUrl?: string
}) {
  const router = useRouter()
  const [enCours, setEnCours] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  async function voter(verdictHuman: string) {
    setEnCours(verdictHuman)
    setErreur(null)
    const reponse = await fetch(`/api/dossiers/${dossierId}/generations/${generationId}/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verdictHuman }),
    })
    const corps = await reponse.json()
    if (!reponse.ok || !corps.success) {
      setErreur(corps.error?.message ?? 'Verdict impossible.')
      setEnCours(null)
      return
    }
    router.refresh()
  }

  return (
    <div className="mt-2 flex flex-col gap-2 rounded border border-encre-douce/30 p-3">
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- URL signée temporaire, pas un asset optimisable.
        <img src={imageUrl} alt="Rendu généré" className="max-h-64 rounded" />
      )}
      <p className="text-xs text-encre-douce">Contrôle qualité — verdict d&apos;Évariste :</p>
      <div className="flex flex-wrap gap-2">
        {VERDICTS.map((v) => (
          <button
            key={v.valeur}
            type="button"
            onClick={() => voter(v.valeur)}
            disabled={enCours !== null}
            className="rounded border border-encre-douce/40 px-3 py-1.5 text-xs disabled:opacity-50"
          >
            {enCours === v.valeur ? '…' : v.label}
          </button>
        ))}
      </div>
      {erreur && <p className="text-xs text-red-600">{erreur}</p>}
    </div>
  )
}
