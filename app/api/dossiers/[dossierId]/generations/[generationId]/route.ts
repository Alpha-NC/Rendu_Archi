import { NextResponse } from 'next/server'
import {
  authentifierRequete,
  obtenirDepot,
  repondreDossierIntrouvable,
  repondreErreur,
  verifierGenerationDuDossier,
  verifierProprietaire,
} from '../../../_lib/reponse'

/**
 * GET /api/dossiers/[dossierId]/generations/[generationId] — lifecycle
 * d'une génération (Chantier B backend-completion) : status, timestamps,
 * résultat si terminée, dernier audit qualité si un existe. Le front
 * restaure l'état d'une génération après refresh en rappelant cette route,
 * jamais en se fiant à un état local.
 *
 * `status` reste le vocabulaire V2.1 déjà en base : `queued`/`running`/
 * `succeeded`/`failed`/`timed_out` — jamais de pourcentage simulé, seul un
 * statut qualitatif est disponible (PRD §9.5, aucun `IN_QUEUE` fal.ai n'est
 * jamais présenté comme un résultat, voir lib/fal/client.ts).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ dossierId: string; generationId: string }> },
) {
  const { dossierId, generationId } = await params
  const { user, reponseRefus } = await authentifierRequete()
  if (reponseRefus) return reponseRefus

  const depot = obtenirDepot()
  const dossier = await depot.obtenirDossier(dossierId)
  if (!dossier) return repondreDossierIntrouvable()
  const refusProprietaire = verifierProprietaire(dossier.ownerId, user.id)
  if (refusProprietaire) return refusProprietaire

  const generation = await depot.obtenirGeneration(generationId)
  if (!generation) return repondreErreur('generation_introuvable', 'Génération introuvable.', 404)
  const refusGeneration = verifierGenerationDuDossier(generation.dossierId, dossierId)
  if (refusGeneration) return refusGeneration

  const [imageUrl] = generation.resultFileId ? await depot.resolverUrlsSignees([generation.resultFileId]) : [null]
  const audit = await depot.obtenirAuditQualite(generationId)

  return NextResponse.json({ success: true, generation: { ...generation, imageUrl }, audit })
}
