'use client'

import { useFormulaire } from '../contexte'
import { CATEGORIES } from '@/lib/form/types'
import { LIBELLE_CATEGORIE } from '@/lib/form/libelles'

export function Etape6Precisions() {
  const { etat, envoyer } = useFormulaire()

  const nonCalibres = CATEGORIES.flatMap((categorie) => {
    const selection = etat.materiaux[categorie]
    return selection?.origine === 'libre'
      ? [{ categorie, terme: selection.terme }]
      : []
  })

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="precisions" className="block text-sm font-medium text-slate-800">
          Précisions complémentaires
        </label>
        <textarea
          id="precisions"
          rows={5}
          value={etat.precisions}
          placeholder="Toute indication utile qui n'entre pas dans les champs précédents."
          onChange={(evenement) =>
            envoyer({ type: 'precisions', valeur: evenement.target.value })
          }
          className="w-full rounded-lg border border-slate-300 p-2.5 text-sm text-slate-900"
        />
      </div>

      {nonCalibres.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">Textures non calibrées</p>
          <ul className="mt-2 space-y-1 text-xs text-amber-800">
            {nonCalibres.map(({ categorie, terme }) => (
              <li key={categorie}>
                {LIBELLE_CATEGORIE[categorie]} : {terme || '(à décrire)'}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-amber-700">
            Elles sont enregistrées pour calibration et n&apos;entreront pas dans ce rendu.
            Décrivez ici l&apos;aspect attendu si c&apos;est important.
          </p>
        </div>
      )}
    </div>
  )
}
