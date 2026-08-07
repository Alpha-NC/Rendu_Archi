'use client'

import { useFormulaire } from './contexte'
import type { Etape } from '@/lib/form/types'

const TITRES: Record<Etape, string> = {
  1: 'Identification',
  2: 'Documents',
  3: 'Matériaux',
  4: 'Environnement',
  5: 'Style',
  6: 'Précisions',
  7: 'Fiche projet',
}

const ETAPES: Etape[] = [1, 2, 3, 4, 5, 6, 7]

export function IndicateurEtapes() {
  const { etat, envoyer } = useFormulaire()

  return (
    <nav aria-label="Étapes" className="flex flex-wrap gap-1.5">
      {ETAPES.map((etape) => {
        const atteinte = etape <= etat.etapeMax
        const courante = etape === etat.etape
        return (
          <button
            key={etape}
            type="button"
            disabled={!atteinte}
            onClick={() => envoyer({ type: 'allerEtape', etape })}
            className={`rounded-full px-3 py-1 text-xs transition ${
              courante
                ? 'bg-slate-900 text-white'
                : atteinte
                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  : 'bg-slate-50 text-slate-400'
            }`}
          >
            {etape}. {TITRES[etape]}
          </button>
        )
      })}
    </nav>
  )
}
