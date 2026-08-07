'use client'

import { useState } from 'react'
import { chargerImage } from '@/lib/images/redimensionner'
import type { ImageChargee } from '@/lib/form/types'

type Props = {
  intitule: string
  description?: string
  valeur: ImageChargee | null
  onChange: (valeur: ImageChargee | null) => void
  obligatoire?: boolean
}

function formaterPoids(octets: number): string {
  const mo = octets / (1024 * 1024)
  return mo >= 1 ? `${mo.toFixed(1)} Mo` : `${Math.round(octets / 1024)} Ko`
}

export function ChampFichierImage({
  intitule,
  description,
  valeur,
  onChange,
  obligatoire = false,
}: Props) {
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function selectionner(fichier: File | undefined) {
    if (!fichier) return
    setEnCours(true)
    setErreur(null)
    try {
      onChange(await chargerImage(fichier))
    } catch {
      setErreur("Ce fichier n'a pas pu être lu. Essayez un JPEG ou un PNG.")
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-slate-800">
        {intitule}
        {obligatoire && <span className="ml-1 text-rose-600">*</span>}
      </div>
      {description && <p className="text-xs text-slate-500">{description}</p>}

      {valeur ? (
        <div className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={valeur.dataUri}
            alt=""
            className="h-20 w-28 rounded object-cover"
          />
          <div className="min-w-0 flex-1 text-xs text-slate-600">
            <p className="truncate text-slate-900">{valeur.nomOrigine}</p>
            <p className="mt-1">
              {valeur.largeur} × {valeur.hauteur} px · {formaterPoids(valeur.poidsOctets)}
            </p>
            <button
              type="button"
              className="mt-2 text-slate-700 underline"
              onClick={() => onChange(null)}
            >
              Retirer
            </button>
          </div>
        </div>
      ) : (
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={enCours}
          onChange={(evenement) => selectionner(evenement.target.files?.[0])}
          className="block w-full cursor-pointer rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600"
        />
      )}

      {enCours && <p className="text-xs text-slate-500">Préparation de l&apos;image…</p>}
      {erreur && <p className="text-xs text-rose-600">{erreur}</p>}
    </div>
  )
}
