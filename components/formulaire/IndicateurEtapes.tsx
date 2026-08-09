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
const DERNIER_INDEX = ETAPES.length - 1

function pourcentage(index: number): number {
  return (index / DERNIER_INDEX) * 100
}

export function IndicateurEtapes() {
  const { etat, envoyer } = useFormulaire()
  const progression = pourcentage(etat.etape - 1)

  return (
    <nav aria-label="Étapes">
      <div className="relative h-4 px-2">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-trait" />
        <div
          className="absolute left-0 top-1/2 h-px -translate-y-1/2 bg-encre transition-[width] duration-300 ease-out"
          style={{ width: `${progression}%` }}
        />
        {ETAPES.map((etape, index) => {
          const atteinte = etape <= etat.etapeMax
          const courante = etape === etat.etape
          return (
            <button
              key={etape}
              type="button"
              disabled={!atteinte}
              aria-current={courante ? 'step' : undefined}
              title={`${etape}. ${TITRES[etape]}`}
              onClick={() => envoyer({ type: 'allerEtape', etape })}
              style={{ left: `${pourcentage(index)}%` }}
              className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border transition disabled:cursor-not-allowed ${
                courante
                  ? 'h-3.5 w-3.5 border-encre bg-encre'
                  : atteinte
                    ? 'h-2.5 w-2.5 border-encre bg-papier hover:scale-125'
                    : 'h-2.5 w-2.5 border-trait bg-papier'
              }`}
            >
              <span className="sr-only">
                {etape}. {TITRES[etape]}
                {courante ? ' (étape actuelle)' : ''}
              </span>
            </button>
          )
        })}
      </div>

      <div className="relative mt-2 h-4 px-2">
        {ETAPES.map((etape, index) => {
          const atteinte = etape <= etat.etapeMax
          const courante = etape === etat.etape
          return (
            <span
              key={etape}
              aria-hidden="true"
              style={{ left: `${pourcentage(index)}%` }}
              className={`absolute -translate-x-1/2 font-mono text-[0.6rem] tracking-wide tabular-nums ${
                courante
                  ? 'text-encre'
                  : atteinte
                    ? 'text-encre-douce'
                    : 'text-encre-douce/50'
              }`}
            >
              {String(etape).padStart(2, '0')}
            </span>
          )
        })}
      </div>
    </nav>
  )
}
