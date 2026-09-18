'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { lireReponseApi } from '@/lib/rif/reponse-client'

/** PRD §9.4 : action explicite d'Évariste, jamais déclenchée par le LLM. */
export default function BoutonConfirmerFiche({ dossierId }: { dossierId: string }) {
  const router = useRouter()
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function confirmer() {
    setEnCours(true)
    setErreur(null)
    const reponse = await fetch(`/api/dossiers/${dossierId}/confirmer`, { method: 'POST' })
    try {
      await lireReponseApi(reponse)
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Confirmation impossible.')
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
        className="button"
      >
        {enCours ? 'Confirmation…' : 'Confirmer la fiche projet'}
      </button>
      {erreur && <p className="text-xs text-red-600">{erreur}</p>}
    </div>
  )
}
