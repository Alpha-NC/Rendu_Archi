'use client'

import { ChampMateriau } from '../champs/ChampMateriau'
import { useFormulaire } from '../contexte'
import { champsMateriauxPour, conservationExistantProposee } from '@/lib/form/regles'
import { LIBELLE_CATEGORIE } from '@/lib/form/libelles'

export function Etape3Materiaux() {
  const { etat, envoyer, catalogue, erreurCatalogue } = useFormulaire()
  const categories = champsMateriauxPour(etat.typeProjet)
  const existantPropose = conservationExistantProposee(etat.typeProjet, etat.images)

  if (categories.length === 0) {
    return (
      <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
        Aucun matériau à renseigner pour ce type de projet. Vous pouvez passer à
        l&apos;étape suivante.
      </p>
    )
  }

  if (erreurCatalogue) {
    return (
      <div className="space-y-2 rounded-lg bg-rose-50 p-4 text-sm text-rose-700">
        <p>Les matériaux n&apos;ont pas pu être chargés.</p>
        <p className="text-xs">{erreurCatalogue}</p>
      </div>
    )
  }

  if (!catalogue) {
    return <p className="text-sm text-slate-500">Chargement des matériaux…</p>
  }

  return (
    <div className="space-y-6">
      {existantPropose && (
        <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          Ce projet reprend un bâti existant. Pour tout élément déjà visible sur la photo du
          site, choisissez « conserver l&apos;existant » plutôt qu&apos;un matériau du
          catalogue : il sera repris tel quel, sans réinterprétation.
        </p>
      )}

      {categories.map((categorie) => (
        <ChampMateriau
          key={categorie}
          intitule={LIBELLE_CATEGORIE[categorie]}
          catalogue={catalogue[categorie]}
          valeur={etat.materiaux[categorie]}
          existantPropose={existantPropose}
          onChange={(valeur) => envoyer({ type: 'materiau', categorie, valeur })}
        />
      ))}
    </div>
  )
}
