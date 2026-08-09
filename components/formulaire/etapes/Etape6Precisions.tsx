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
        <label
          htmlFor="precisions"
          className="block font-sans text-sm font-semibold uppercase tracking-wide text-encre"
        >
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
          className="w-full rounded-[2px] border border-trait bg-papier p-2.5 text-sm text-encre"
        />
      </div>

      {nonCalibres.length > 0 && (
        <div className="rounded-[2px] border border-ocre/50 bg-ocre-fond/60 p-4">
          <p className="font-sans text-sm font-semibold uppercase tracking-wide text-encre">
            Textures non calibrées
          </p>
          <ul className="mt-2 space-y-1 text-xs text-encre-douce">
            {nonCalibres.map(({ categorie, terme }) => (
              <li key={categorie}>
                {LIBELLE_CATEGORIE[categorie]} : {terme || '(à décrire)'}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ocre">
            Elles sont enregistrées pour calibration et n&apos;entreront pas dans ce rendu.
            Décrivez ici l&apos;aspect attendu si c&apos;est important.
          </p>
        </div>
      )}
    </div>
  )
}
