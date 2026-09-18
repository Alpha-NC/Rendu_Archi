import { NextResponse } from 'next/server'
import { estOutputTypeValide, OUTPUT_TYPES } from '@/lib/rif/render-targets'
import {
  authentifierRequete,
  obtenirDepot,
  repondreCorpsInvalide,
  repondreDossierIntrouvable,
  verifierProprietaire,
} from '../../_lib/reponse'

/**
 * GET/POST /api/dossiers/[dossierId]/render-targets — Lot 1 RenderTarget
 * (DECISIONS.md D-22). Une cible de rendu organise les générations qui
 * visent le même résultat (« Perspective entrée », « Axonométrie
 * générale »...) ; elle vit dans sa propre table (`render_targets`), jamais
 * dupliquée dans `ProjectState` (voir project-state.ts::active_render_target_id,
 * un simple pointeur).
 *
 * Pas de DELETE ici (mission Lot 1 §14) : les implications sur les
 * générations déjà rattachées à une cible supprimée restent à auditer
 * séparément avant d'exposer cette opération.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ dossierId: string }> }) {
  const { dossierId } = await params
  const { user, reponseRefus } = await authentifierRequete()
  if (reponseRefus) return reponseRefus

  const depot = obtenirDepot()
  const dossier = await depot.obtenirDossier(dossierId)
  if (!dossier) return repondreDossierIntrouvable()
  const refusProprietaire = verifierProprietaire(dossier.ownerId, user.id)
  if (refusProprietaire) return refusProprietaire

  const renderTargets = await depot.listerRenderTargets(dossierId)
  return NextResponse.json({ success: true, renderTargets })
}

export async function POST(request: Request, { params }: { params: Promise<{ dossierId: string }> }) {
  const { dossierId } = await params
  const { user, reponseRefus } = await authentifierRequete()
  if (reponseRefus) return reponseRefus

  const depot = obtenirDepot()
  const dossier = await depot.obtenirDossier(dossierId)
  if (!dossier) return repondreDossierIntrouvable()
  const refusProprietaire = verifierProprietaire(dossier.ownerId, user.id)
  if (refusProprietaire) return refusProprietaire

  let corps: unknown
  try {
    corps = await request.json()
  } catch {
    return repondreCorpsInvalide('Corps de requête JSON attendu.')
  }

  const { name, outputType } = (corps as Record<string, unknown>) ?? {}
  if (typeof name !== 'string' || name.trim().length === 0) {
    return repondreCorpsInvalide('Le champ name (texte non vide) est requis.')
  }
  if (typeof outputType !== 'string' || !estOutputTypeValide(outputType)) {
    return repondreCorpsInvalide(`Le champ outputType est requis et doit être l'un de : ${OUTPUT_TYPES.join(', ')}.`)
  }

  const renderTarget = await depot.creerRenderTarget({ dossierId, name: name.trim(), outputType })
  await depot.journaliserEvenement(dossierId, 'cible_rendu_creee', { renderTargetId: renderTarget.id, name: renderTarget.name, outputType }, user.id)

  return NextResponse.json({ success: true, renderTarget }, { status: 201 })
}
