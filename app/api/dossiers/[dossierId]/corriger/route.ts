import { genererEtAttendre } from '@/lib/fal/client'
import { executerGenerationOuCorrection } from '@/lib/rif/orchestrateur'
import {
  authentifierRequete,
  obtenirDepot,
  repondreCorpsInvalide,
  repondreOperation,
  verifierProprietaire,
} from '../../_lib/reponse'

/**
 * POST /api/dossiers/[dossierId]/corriger — corrigerRendu (PRD §14.2).
 *
 * Réservée à une correction localisée sur un rendu existant fiable (état
 * À_CORRIGER). Ne modifie jamais la scène entière — voir D-09 : cette
 * opération ne doit jamais se substituer à reprendreDepuisSources.
 */
export async function POST(request: Request, { params }: { params: Promise<{ dossierId: string }> }) {
  const { dossierId } = await params
  const { user, supabase, reponseRefus } = await authentifierRequete()
  if (reponseRefus) return reponseRefus

  const depot = obtenirDepot(supabase)
  const dossier = await depot.obtenirDossier(dossierId)
  if (!dossier) {
    return repondreOperation({ success: false, error: { code: 'dossier_introuvable', message: 'Dossier introuvable.' } })
  }
  const refusProprietaire = verifierProprietaire(dossier.ownerId, user.id)
  if (refusProprietaire) return refusProprietaire

  let corps: unknown
  try {
    corps = await request.json()
  } catch {
    return repondreCorpsInvalide('Corps de requête JSON attendu.')
  }

  const { promptText, sourceFileIds } = (corps as Record<string, unknown>) ?? {}
  if (typeof promptText !== 'string' || promptText.trim().length === 0) {
    return repondreCorpsInvalide('Le champ promptText (texte non vide) est requis — décrit uniquement ce qui doit changer (PRD §14.2).')
  }
  if (!Array.isArray(sourceFileIds) || sourceFileIds.some((id) => typeof id !== 'string')) {
    return repondreCorpsInvalide('Le champ sourceFileIds (tableau de chaînes) est requis.')
  }

  const resultat = await executerGenerationOuCorrection(depot, genererEtAttendre, {
    dossierId,
    type: 'correction',
    promptText,
    sourceFileIds: sourceFileIds as string[],
    actorId: user.id,
    contexte: { usageAdministratif: dossier.usageAdministratif },
  })

  return repondreOperation(resultat)
}
