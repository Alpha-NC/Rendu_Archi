'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

/** PRD §9.4 : action explicite d'Évariste, jamais déclenchée par le LLM. */
export default function BoutonConfirmerFiche({ dossierId }: { dossierId: string }) {
  const router = useRouter()
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function confirmer() {
    setEnCours(true)
    setErreur(null)
    const reponse = await fetch(`/api/dossiers/${dossierId}/confirmer`, { method: 'POST' })
    const corps = await reponse.json()
    if (!reponse.ok || !corps.success) {
      setErreur(corps.error?.message ?? 'Confirmation impossible.')
      setEnCours(false)
      return
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={confirmer}
        disabled={enCours}
        className="rounded bg-encre px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {enCours ? 'Confirmation…' : 'Confirmer la fiche projet'}
      </button>
      {erreur && <p className="text-xs text-red-600">{erreur}</p>}
    </div>
  )
}
