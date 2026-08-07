'use client'

import { ChampChoixUnique } from '../champs/ChampChoixUnique'
import { ChampFichierImage } from '../champs/ChampFichierImage'
import { useFormulaire } from '../contexte'
import { LIBELLE_CADRAGE } from '@/lib/form/libelles'
import type { TypeCadrage } from '@/lib/form/types'

const CADRAGES = (Object.keys(LIBELLE_CADRAGE) as TypeCadrage[]).map((valeur) => ({
  valeur,
  libelle: LIBELLE_CADRAGE[valeur],
}))

export function Etape2Documents() {
  const { etat, envoyer } = useFormulaire()
  const enAxonometrie = etat.typeCadrage === 'axonometrie'

  return (
    <div className="space-y-8">
      <ChampChoixUnique
        intitule="Type de cadrage de la vue principale"
        obligatoire
        options={CADRAGES}
        valeur={etat.typeCadrage}
        onChange={(valeur) => envoyer({ type: 'typeCadrage', valeur })}
      />

      <ChampFichierImage
        intitule="Vue de cadrage"
        obligatoire
        description="Export Revit. C'est la référence géométrique : volumes, ouvertures, toiture et perspective en sont repris à l'identique."
        valeur={etat.images.cadrage}
        onChange={(valeur) => envoyer({ type: 'image', role: 'cadrage', valeur })}
      />

      <ChampFichierImage
        intitule="Vue complémentaire"
        description="L'autre type de vue du même projet, en référence de volume supplémentaire."
        valeur={etat.images.complementaire}
        onChange={(valeur) => envoyer({ type: 'image', role: 'complementaire', valeur })}
      />

      <div className="space-y-2">
        <ChampFichierImage
          intitule="Photo réelle du site"
          description="Terrain, relief, accès, voisinage et végétation existante."
          valeur={etat.images.site}
          onChange={(valeur) => envoyer({ type: 'image', role: 'site', valeur })}
        />
        {enAxonometrie && etat.images.site && (
          <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            Le cadrage étant une axonométrie, aucun alignement n&apos;est possible avec la
            photo. Elle servira de référence d&apos;ambiance et de matériaux, pas
            d&apos;insertion.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="elements-a-preserver"
          className="block text-sm font-medium text-slate-800"
        >
          Éléments à préserver absolument
        </label>
        <textarea
          id="elements-a-preserver"
          rows={3}
          value={etat.elementsAPreserver}
          placeholder="Garde-corps du balcon nord, muret en pierre le long de l'accès, escalier extérieur…"
          onChange={(evenement) =>
            envoyer({ type: 'elementsAPreserver', valeur: evenement.target.value })
          }
          className="w-full rounded-lg border border-slate-300 p-2.5 text-sm text-slate-900"
        />
        <p className="text-xs text-slate-500">
          Nommez un par un les éléments secondaires à ne pas perdre. Ceux qui ne sont pas
          nommés risquent d&apos;être réinterprétés, même si la géométrie générale est
          respectée.
        </p>
      </div>
    </div>
  )
}
