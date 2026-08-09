'use client'

import { useFormulaire } from '../contexte'
import {
  champsMateriauxPour,
  eclairagesDemandes,
  eclairagesProposes,
} from '@/lib/form/regles'
import {
  LIBELLE_CADRAGE,
  LIBELLE_CATEGORIE,
  LIBELLE_CIEL,
  LIBELLE_ECLAIRAGE,
  LIBELLE_PELOUSE,
  LIBELLE_STYLE,
  LIBELLE_TYPE_PROJET,
  LIBELLE_USAGE,
} from '@/lib/form/libelles'
import type { ReactNode } from 'react'
import type { Etape, SelectionMateriau } from '@/lib/form/types'

function decrireMateriau(selection: SelectionMateriau | null): string {
  if (selection === null) return 'Non renseigné'
  if (selection.origine === 'existant') return "Conserver l'existant"
  if (selection.origine === 'libre') {
    return `${selection.terme || '(à décrire)'} — non calibré`
  }
  return selection.terme
}

function Bloc({
  titre,
  etape,
  children,
}: {
  titre: string
  etape: Etape
  children: ReactNode
}) {
  const { envoyer } = useFormulaire()
  return (
    <section className="rounded-[2px] border border-trait p-4">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="font-sans text-sm font-semibold uppercase tracking-wide text-encre">
          {titre}
        </h3>
        <button
          type="button"
          onClick={() => envoyer({ type: 'allerEtape', etape })}
          className="text-xs text-encre-douce underline underline-offset-2 transition hover:text-encre"
        >
          Modifier
        </button>
      </div>
      <dl className="mt-3 space-y-1.5 text-sm">{children}</dl>
    </section>
  )
}

function Ligne({ cle, valeur }: { cle: string; valeur: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-44 shrink-0 font-mono text-[0.65rem] uppercase tracking-wide text-encre-douce">
        {cle}
      </dt>
      <dd className="text-encre">{valeur}</dd>
    </div>
  )
}

export function Etape7FicheProjet() {
  const { etat } = useFormulaire()
  const categories = champsMateriauxPour(etat.typeProjet)

  const eclairagesActifs = eclairagesDemandes(etat.ciel)
    ? eclairagesProposes(etat.typeProjet)
        .filter((cle) => etat.eclairages[cle])
        .map((cle) => LIBELLE_ECLAIRAGE[cle])
    : []

  return (
    <div className="space-y-4">
      <Bloc titre="Identification" etape={1}>
        <Ligne cle="Référence" valeur={etat.reference || 'Non renseignée'} />
        <Ligne
          cle="Type de projet"
          valeur={etat.typeProjet ? LIBELLE_TYPE_PROJET[etat.typeProjet] : 'Non renseigné'}
        />
        <Ligne
          cle="Usage du rendu"
          valeur={etat.usage ? LIBELLE_USAGE[etat.usage] : 'Non renseigné'}
        />
      </Bloc>

      <Bloc titre="Documents" etape={2}>
        <Ligne
          cle="Cadrage"
          valeur={etat.typeCadrage ? LIBELLE_CADRAGE[etat.typeCadrage] : 'Non renseigné'}
        />
        <Ligne
          cle="Vue de cadrage"
          valeur={etat.images.cadrage?.nomOrigine ?? 'Manquante'}
        />
        <Ligne
          cle="Vue complémentaire"
          valeur={etat.images.complementaire?.nomOrigine ?? 'Non fournie'}
        />
        <Ligne cle="Photo du site" valeur={etat.images.site?.nomOrigine ?? 'Non fournie'} />
        <Ligne cle="À préserver" valeur={etat.elementsAPreserver || 'Rien de signalé'} />
      </Bloc>

      <Bloc titre="Matériaux" etape={3}>
        {categories.length === 0 ? (
          <Ligne cle="Matériaux" valeur="Sans objet pour ce type de projet" />
        ) : (
          categories.map((categorie) => (
            <Ligne
              key={categorie}
              cle={LIBELLE_CATEGORIE[categorie]}
              valeur={decrireMateriau(etat.materiaux[categorie])}
            />
          ))
        )}
      </Bloc>

      <Bloc titre="Environnement" etape={4}>
        <Ligne
          cle="Végétation existante"
          valeur={etat.conserverVegetation ? 'Conservée' : 'Non conservée'}
        />
        <Ligne cle="Pelouse" valeur={LIBELLE_PELOUSE[etat.aspectPelouse]} />
        <Ligne cle="À retirer" valeur={etat.elementsARetirer || 'Rien'} />
        <Ligne cle="Ciel et lumière" valeur={LIBELLE_CIEL[etat.ciel]} />
        {eclairagesDemandes(etat.ciel) && (
          <Ligne
            cle="Éclairages"
            valeur={eclairagesActifs.length > 0 ? eclairagesActifs.join(', ') : 'Aucun'}
          />
        )}
      </Bloc>

      <Bloc titre="Style" etape={5}>
        <Ligne
          cle="Style de rendu"
          valeur={etat.style ? LIBELLE_STYLE[etat.style] : 'Non renseigné'}
        />
      </Bloc>

      <Bloc titre="Précisions" etape={6}>
        <Ligne cle="Précisions" valeur={etat.precisions || 'Aucune'} />
      </Bloc>
    </div>
  )
}
