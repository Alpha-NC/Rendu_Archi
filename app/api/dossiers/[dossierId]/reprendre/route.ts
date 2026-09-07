import { executerReprise } from '@/lib/rif/orchestrateur'
import {
  authentifierRequete,
  obtenirDepot,
  repondreCorpsInvalide,
  repondreOperation,
  verifierProprietaire,
} from '../../_lib/reponse'

/**
 * POST /api/dossiers/[dossierId]/reprendre — reprendreDepuisSources (PRD §14.3).
 *
 * N'appelle jamais fal.ai : réinitialise le parcours vers
 * SOURCES_CONTRÔLÉES pour reconstruire une révision confirmée du
 * ProjectState. Utilisée quand la géométrie ou la caméra a dérivé,
 * l'environnement verrouillé a été altéré, ou plusieurs corrections ont
 * accumulé des régressions — jamais présentée comme une correction locale
 * (D-09).
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
    corps = {}
  }

  const { motif } = (corps as Record<string, unknown>) ?? {}
  if (typeof motif !== 'string' || motif.trim().length === 0) {
    return repondreCorpsInvalide('Le champ motif (texte non vide) est requis — traçabilité de la reprise (PRD §18).')
  }

  const resultat = await executerReprise(depot, { dossierId, actorId: user.id, motif })
  return repondreOperation(resultat)
}
