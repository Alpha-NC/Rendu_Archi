'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function BoutonNouveauDossier() {
  const router = useRouter()
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function creerDossier() {
    setEnCours(true)
    setErreur(null)
    try {
      const reponse = await fetch('/api/dossiers', { method: 'POST' })
      const corps = await reponse.json()
      if (!reponse.ok || !corps.success) {
        throw new Error(corps.error?.message ?? 'Création du dossier impossible.')
      }
      router.push(`/dossiers/${corps.id}`)
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue.')
      setEnCours(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={creerDossier}
        disabled={enCours}
        className="rounded bg-encre px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {enCours ? 'Création…' : 'Nouveau dossier'}
      </button>
      {erreur && <p className="text-xs text-red-600">{erreur}</p>}
    </div>
  )
}
