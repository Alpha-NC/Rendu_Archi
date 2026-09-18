import {
  authentifierRequete,
  obtenirDepot,
  repondreDossierIntrouvable,
  repondreErreur,
  repondreOperation,
  verifierProprietaire,
  verifierRenderTargetDuDossier,
} from '../../../../_lib/reponse'

/**
 * POST /api/dossiers/[dossierId]/render-targets/[renderTargetId]/activer —
 * Lot 1 RenderTarget (D-22). Pointe `ProjectState.active_render_target_id`
 * vers cette cible — devient la cible par défaut de la prochaine génération
 * initiale (`genererRendu` sans `renderTargetId` explicite) et du contexte
 * conversationnel (lib/rif/prompt-conversationnel.ts). N'affecte jamais une
 * correction en cours, qui hérite toujours de sa génération parente
 * (lib/rif/orchestrateur.ts).
 */
export async function POST(
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

  await depot.mettreAJourProjectState(dossierId, { ...dossier.projectState, active_render_target_id: renderTargetId })
  await depot.journaliserEvenement(dossierId, 'cible_rendu_activee', {}, user.id, { renderTargetId })

  return repondreOperation({ success: true })
}
