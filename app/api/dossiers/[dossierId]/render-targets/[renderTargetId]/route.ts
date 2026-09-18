import { NextResponse } from 'next/server'
import {
  authentifierRequete,
  obtenirDepot,
  repondreDossierIntrouvable,
  repondreErreur,
  verifierProprietaire,
  verifierRenderTargetDuDossier,
} from '../../../_lib/reponse'

/**
 * GET /api/dossiers/[dossierId]/render-targets/[renderTargetId] — détail
 * d'une cible de rendu (Lot 1 RenderTarget, D-22) et ses générations,
 * les plus récentes d'abord. Filtrage en mémoire depuis
 * `listerGenerations` — pas de méthode dédiée côté dépôt, le volume par
 * dossier reste faible (pas de logique métier supplémentaire justifiée).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ dossierId: string; renderTargetId: string }> },
) {
  const { dossierId, renderTargetId } = await params
  const { user, reponseRefus } = await authentifierRequete()
  if (reponseRefus) return reponseRefus

  const depot = obtenirDepot()
  const dossier = await depot.obtenirDossier(dossierId)
  if (!dossier) return repondreDossierIntrouvable()
  const refusProprietaire = verifierProprietaire(dossier.ownerId, user.id)
  if (refusProprietaire) return refusProprietaire

  const renderTarget = await depot.obtenirRenderTarget(renderTargetId)
  if (!renderTarget) return repondreErreur('cible_introuvable', 'Cible de rendu introuvable.', 404)
  const refusCible = verifierRenderTargetDuDossier(renderTarget.dossierId, dossierId)
  if (refusCible) return refusCible

  const toutesGenerations = await depot.listerGenerations(dossierId)
  const generations = toutesGenerations.filter((g) => g.renderTargetId === renderTargetId)

  return NextResponse.json({ success: true, renderTarget, generations })
}
