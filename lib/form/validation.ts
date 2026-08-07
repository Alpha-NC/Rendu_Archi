import { modeProduction, stylesDisponibles } from './regles'
import type { Etape, EtatFormulaire } from './types'

/**
 * Conditions pour quitter une etape vers la suivante.
 * Le retour en arriere n'est jamais conditionne.
 * Aucun materiau n'est obligatoire : les etapes 3, 4 et 6 sont toujours
 * franchissables.
 */
export function etapeFranchissable(etat: EtatFormulaire, etape: Etape): boolean {
  switch (etape) {
    case 1:
      return etat.reference.trim().length > 0 && etat.typeProjet !== null
    case 2:
      return etat.typeCadrage !== null && etat.images.cadrage !== null
    case 5: {
      if (etat.style === null) return false
      const mode = modeProduction(etat.images, etat.typeCadrage)
      return stylesDisponibles(mode).includes(etat.style)
    }
    case 3:
    case 4:
    case 6:
      return true
    case 7:
      return peutEnvoyer(etat)
  }
}

/** L'envoi exige que toutes les etapes bloquantes soient satisfaites. */
export function peutEnvoyer(etat: EtatFormulaire): boolean {
  return (
    etapeFranchissable(etat, 1) &&
    etapeFranchissable(etat, 2) &&
    etapeFranchissable(etat, 5)
  )
}
