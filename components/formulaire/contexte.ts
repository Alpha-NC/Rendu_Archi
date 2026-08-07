'use client'

import { createContext, useContext } from 'react'
import type { ActionFormulaire } from '@/lib/form/reducer'
import type { Categorie, EtatFormulaire } from '@/lib/form/types'
import type { MateriauCatalogue } from '@/lib/n8n/contrat'

export type ContexteFormulaire = {
  etat: EtatFormulaire
  envoyer: (action: ActionFormulaire) => void
  catalogue: Record<Categorie, MateriauCatalogue[]> | null
  erreurCatalogue: string | null
}

export const ContexteFormulaireReact = createContext<ContexteFormulaire | null>(null)

export function useFormulaire(): ContexteFormulaire {
  const contexte = useContext(ContexteFormulaireReact)
  if (!contexte) {
    throw new Error('useFormulaire doit être utilisé dans FormulaireRendu.')
  }
  return contexte
}
