'use client'

import { useState } from 'react'
import type { MateriauCatalogue } from '@/lib/n8n/contrat'
import type { SelectionMateriau } from '@/lib/form/types'

const VALEUR_LIBRE = '__libre__'
const VALEUR_EXISTANT = '__existant__'
const VALEUR_VIDE = ''

type Props = {
  intitule: string
  catalogue: MateriauCatalogue[]
  valeur: SelectionMateriau | null
  onChange: (valeur: SelectionMateriau | null) => void
  existantPropose: boolean
}

export function ChampMateriau({
  intitule,
  catalogue,
  valeur,
  onChange,
  existantPropose,
}: Props) {
  const [saisieLibre, setSaisieLibre] = useState(
    valeur?.origine === 'libre' ? valeur.terme : '',
  )

  const valeurSelect =
    valeur === null
      ? VALEUR_VIDE
      : valeur.origine === 'libre'
        ? VALEUR_LIBRE
        : valeur.origine === 'existant'
          ? VALEUR_EXISTANT
          : valeur.id

  function choisir(brut: string) {
    if (brut === VALEUR_VIDE) return onChange(null)
    if (brut === VALEUR_EXISTANT) return onChange({ origine: 'existant' })
    if (brut === VALEUR_LIBRE) return onChange({ origine: 'libre', terme: saisieLibre })
    const trouve = catalogue.find((materiau) => materiau.id === brut)
    if (trouve) onChange({ origine: 'catalogue', id: trouve.id, terme: trouve.terme })
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-800">{intitule}</label>
      <select
        value={valeurSelect}
        onChange={(evenement) => choisir(evenement.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-900"
      >
        <option value={VALEUR_VIDE}>Non renseigné</option>
        {existantPropose && (
          <option value={VALEUR_EXISTANT}>Conserver l&apos;existant visible sur la photo</option>
        )}
        {catalogue.map((materiau) => (
          <option key={materiau.id} value={materiau.id}>
            {materiau.terme}
          </option>
        ))}
        <option value={VALEUR_LIBRE}>Autre texture…</option>
      </select>

      {valeur?.origine === 'libre' && (
        <div className="space-y-1">
          <input
            type="text"
            value={saisieLibre}
            placeholder="Décrivez la texture"
            onChange={(evenement) => {
              setSaisieLibre(evenement.target.value)
              onChange({ origine: 'libre', terme: evenement.target.value })
            }}
            className="w-full rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-sm text-slate-900"
          />
          <p className="text-xs text-amber-700">
            Texture non calibrée : elle sera enregistrée pour calibration et n&apos;entrera
            pas dans le rendu.
          </p>
        </div>
      )}

      {valeur?.origine === 'existant' && (
        <p className="text-xs text-slate-500">
          Le matériau sera repris tel qu&apos;il apparaît sur la photo du site.
        </p>
      )}
    </div>
  )
}
