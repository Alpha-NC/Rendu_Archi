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
 * POST /api/dossiers/[dossierId]/generer — genererRenduFlux (PRD §14.1).
 *
 * Réservée à une première génération. Refusée si le dossier n'est pas dans
 * l'état PRÊT_À_GÉNÉRER (revérifié côté backend par
 * lib/rif/orchestrateur.ts, jamais supposé côté client).
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
    return repondreCorpsInvalide('Le champ promptText (texte non vide) est requis.')
  }
  if (!Array.isArray(sourceFileIds) || sourceFileIds.some((id) => typeof id !== 'string')) {
    return repondreCorpsInvalide('Le champ sourceFileIds (tableau de chaînes) est requis.')
  }

  const resultat = await executerGenerationOuCorrection(depot, genererEtAttendre, {
    dossierId,
    type: 'initial',
    promptText,
    sourceFileIds: sourceFileIds as string[],
    actorId: user.id,
    contexte: { usageAdministratif: dossier.usageAdministratif },
  })

  return repondreOperation(resultat)
}
