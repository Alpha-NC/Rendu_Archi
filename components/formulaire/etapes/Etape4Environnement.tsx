'use client'

import { ChampChoixUnique } from '../champs/ChampChoixUnique'
import { ChampInterrupteur } from '../champs/ChampInterrupteur'
import { useFormulaire } from '../contexte'
import {
  cielsDisponibles,
  eclairagesDemandes,
  eclairagesProposes,
} from '@/lib/form/regles'
import {
  LIBELLE_CIEL,
  LIBELLE_ECLAIRAGE,
  LIBELLE_PELOUSE,
  ORDRE_PELOUSE,
} from '@/lib/form/libelles'

const OPTIONS_PELOUSE = ORDRE_PELOUSE.map((valeur) => ({
  valeur,
  libelle: LIBELLE_PELOUSE[valeur],
}))

export function Etape4Environnement() {
  const { etat, envoyer } = useFormulaire()
  const cles = eclairagesProposes(etat.typeProjet)
  const optionsCiel = cielsDisponibles(etat.images).map((valeur) => ({
    valeur,
    libelle: LIBELLE_CIEL[valeur],
  }))

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <ChampInterrupteur
          intitule="Conserver la végétation existante"
          valeur={etat.conserverVegetation}
          onChange={(valeur) => envoyer({ type: 'conserverVegetation', valeur })}
        />

        <ChampChoixUnique
          intitule="Aspect de la pelouse"
          options={OPTIONS_PELOUSE}
          valeur={etat.aspectPelouse}
          onChange={(valeur) => envoyer({ type: 'aspectPelouse', valeur })}
        />

        <div className="space-y-2">
          <label
            htmlFor="elements-a-retirer"
            className="block font-sans text-sm font-semibold uppercase tracking-wide text-encre"
          >
            Éléments à retirer
          </label>
          <input
            id="elements-a-retirer"
            type="text"
            value={etat.elementsARetirer}
            placeholder="Abri de jardin, benne, véhicule stationné…"
            onChange={(evenement) =>
              envoyer({ type: 'elementsARetirer', valeur: evenement.target.value })
            }
            className="w-full rounded-[2px] border border-trait bg-papier p-2.5 text-sm text-encre"
          />
        </div>
      </div>

      <ChampChoixUnique
        intitule="Ciel et lumière"
        options={optionsCiel}
        valeur={etat.ciel}
        onChange={(valeur) => envoyer({ type: 'ciel', valeur })}
      />

      {eclairagesDemandes(etat.ciel) && (
        <fieldset className="space-y-3 rounded-[2px] border border-trait p-4">
          <legend className="px-1 font-sans text-sm font-semibold uppercase tracking-wide text-encre">
            Éclairages à activer
          </legend>
          <p className="text-xs text-encre-douce">
            Sans éclairage, une ambiance de fin de journée donne un bâtiment éteint.
          </p>
          {cles.map((cle) => (
            <ChampInterrupteur
              key={cle}
              intitule={LIBELLE_ECLAIRAGE[cle]}
              valeur={etat.eclairages[cle]}
              onChange={(valeur) => envoyer({ type: 'eclairage', cle, valeur })}
            />
          ))}
        </fieldset>
      )}
    </div>
  )
}
