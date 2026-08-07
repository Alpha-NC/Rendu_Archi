'use client'

import { ChampChoixUnique } from '../champs/ChampChoixUnique'
import { useFormulaire } from '../contexte'
import { modeProduction, stylesDisponibles } from '@/lib/form/regles'
import { DESCRIPTION_STYLE, LIBELLE_STYLE } from '@/lib/form/libelles'

export function Etape5Style() {
  const { etat, envoyer } = useFormulaire()
  const mode = modeProduction(etat.images, etat.typeCadrage)
  const disponibles = stylesDisponibles(mode)

  const options = disponibles.map((valeur) => ({
    valeur,
    libelle: LIBELLE_STYLE[valeur],
    description: DESCRIPTION_STYLE[valeur],
  }))

  const photomontageRetire = !disponibles.includes('photomontage_administratif')

  return (
    <div className="space-y-6">
      {photomontageRetire && (
        <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          {etat.images.site
            ? "Le photomontage administratif n'est pas proposé : il suppose une insertion alignée sur la photo, impossible depuis une vue axonométrique."
            : "Le photomontage administratif n'est pas proposé : il suppose une photo réelle du site, que vous n'avez pas fournie."}
        </p>
      )}

      <ChampChoixUnique
        intitule="Style de rendu"
        obligatoire
        options={options}
        valeur={etat.style}
        onChange={(valeur) => envoyer({ type: 'style', valeur })}
      />

      <p className="text-xs text-slate-500">
        Le style agit sur la lumière et la présentation. Il ne modifie jamais
        l&apos;architecture.
      </p>
    </div>
  )
}
