'use client'

import { ChampChoixUnique } from '../champs/ChampChoixUnique'
import { useFormulaire } from '../contexte'
import { LIBELLE_TYPE_PROJET, LIBELLE_USAGE } from '@/lib/form/libelles'
import type { TypeProjet, Usage } from '@/lib/form/types'

const TYPES_PROJET = (Object.keys(LIBELLE_TYPE_PROJET) as TypeProjet[]).map((valeur) => ({
  valeur,
  libelle: LIBELLE_TYPE_PROJET[valeur],
}))

const USAGES = (Object.keys(LIBELLE_USAGE) as Usage[]).map((valeur) => ({
  valeur,
  libelle: LIBELLE_USAGE[valeur],
}))

export function Etape1Identification() {
  const { etat, envoyer } = useFormulaire()

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <label
          htmlFor="reference"
          className="block font-sans text-sm font-semibold uppercase tracking-wide text-encre"
        >
          Référence du dossier <span className="text-rouille">*</span>
        </label>
        <input
          id="reference"
          type="text"
          value={etat.reference}
          placeholder="Votre numéro d'affaire"
          onChange={(evenement) =>
            envoyer({ type: 'reference', valeur: evenement.target.value })
          }
          className="w-full rounded-[2px] border border-trait bg-papier p-2.5 text-sm text-encre"
        />
        <p className="text-xs text-encre-douce">
          Elle nomme le dossier d&apos;archivage et permet de retrouver l&apos;historique
          des rendus.
        </p>
      </div>

      <ChampChoixUnique
        intitule="Type de projet"
        obligatoire
        options={TYPES_PROJET}
        valeur={etat.typeProjet}
        onChange={(valeur) => envoyer({ type: 'typeProjet', valeur })}
      />

      <ChampChoixUnique
        intitule="Usage du rendu"
        options={USAGES}
        valeur={etat.usage}
        onChange={(valeur) => envoyer({ type: 'usage', valeur })}
      />
    </div>
  )
}
