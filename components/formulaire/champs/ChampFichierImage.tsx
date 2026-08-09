'use client'

import { useState } from 'react'
import { chargerImage } from '@/lib/images/redimensionner'
import type { ImageChargee } from '@/lib/form/types'
import { IconeCroix, IconeTeleverser } from '../Icones'

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
      <div className="font-sans text-sm font-semibold uppercase tracking-wide text-encre">
        {intitule}
        {obligatoire && <span className="ml-1 text-rouille">*</span>}
      </div>
      {description && <p className="text-xs text-encre-douce">{description}</p>}

      {valeur ? (
        <div className="flex items-start gap-3 rounded-[2px] border border-trait p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={valeur.dataUri}
            alt=""
            className="h-20 w-28 rounded-[2px] object-cover"
          />
          <div className="min-w-0 flex-1 text-xs text-encre-douce">
            <p className="truncate text-sm text-encre">{valeur.nomOrigine}</p>
            <p className="mt-1 font-mono tabular-nums">
              {valeur.largeur} × {valeur.hauteur} px · {formaterPoids(valeur.poidsOctets)}
            </p>
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-1 text-encre transition hover:text-rouille"
              onClick={() => onChange(null)}
            >
              <IconeCroix className="h-3.5 w-3.5" />
              Retirer
            </button>
          </div>
        </div>
      ) : (
        <label
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[2px] border border-dashed border-trait p-6 text-center transition hover:border-encre-douce ${
            enCours ? 'cursor-wait opacity-60' : ''
          }`}
        >
          <IconeTeleverser className="h-5 w-5 text-encre-douce" />
          <span className="font-sans text-sm font-medium uppercase tracking-wide text-encre">
            {enCours ? 'Préparation…' : 'Choisir un fichier'}
          </span>
          <span className="font-mono text-[0.65rem] text-encre-douce">JPEG · PNG · WEBP</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={enCours}
            onChange={(evenement) => selectionner(evenement.target.files?.[0])}
            className="sr-only"
          />
        </label>
      )}

      {erreur && <p className="text-xs text-rouille">{erreur}</p>}
    </div>
  )
}
