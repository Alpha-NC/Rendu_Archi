import { NextResponse } from 'next/server'
import { ACTIONS_DIRECTIVE, type ActionDirective } from '@/lib/rif/project-state'
import { authentifierRequete, obtenirDepot, repondreCorpsInvalide, verifierProprietaire } from '../../../_lib/reponse'

/**
 * PATCH /api/dossiers/[dossierId]/directives/[directiveId] — confirmation
 * humaine d'une directive localisée ambiguë (PRD §9.2, ADR-015) : « Si la
 * cible ou l'action n'est pas certaine, l'utilisateur confirme avant la
 * suite. » `lib/rif/detection-directives.ts` ne marque jamais une directive
 * ambiguë `validated` toute seule — cette route est le seul endroit qui
 * l'écrit, une fois l'action et la cible corrigées ou approuvées par
 * l'utilisateur.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ dossierId: string; directiveId: string }> },
) {
  const { dossierId, directiveId } = await params
  const { user, supabase, reponseRefus } = await authentifierRequete()
  if (reponseRefus) return reponseRefus

  const depot = obtenirDepot(supabase)
  const dossier = await depot.obtenirDossier(dossierId)
  if (!dossier) {
    return NextResponse.json(
      { success: false, error: { code: 'dossier_introuvable', message: 'Dossier introuvable.' } },
      { status: 404 },
    )
  }
  const refusProprietaire = verifierProprietaire(dossier.ownerId, user.id)
  if (refusProprietaire) return refusProprietaire

  let corps: unknown
  try {
    corps = await request.json()
  } catch {
    return repondreCorpsInvalide('Corps de requête JSON attendu.')
  }
  const { action, target } = (corps as Record<string, unknown>) ?? {}
  if (typeof action !== 'string' || !(ACTIONS_DIRECTIVE as readonly string[]).includes(action)) {
    return repondreCorpsInvalide(`Le champ action doit être l'un de : ${ACTIONS_DIRECTIVE.join(', ')}.`)
  }
  if (typeof target !== 'string' || target.trim().length === 0) {
    return repondreCorpsInvalide('Le champ target (texte non vide) est requis.')
  }

  const directive = dossier.projectState.localized_directives.find((d) => d.id === directiveId)
  if (!directive) {
    return NextResponse.json(
      { success: false, error: { code: 'directive_introuvable', message: 'Directive introuvable dans ce dossier.' } },
      { status: 404 },
    )
  }

  await depot.mettreAJourProjectState(dossierId, {
    ...dossier.projectState,
    localized_directives: dossier.projectState.localized_directives.map((d) =>
      d.id === directiveId ? { ...d, action: action as ActionDirective, target, status: 'validated' } : d,
    ),
  })

  await depot.journaliserEvenement(
    dossierId,
    'directive_confirmee',
    { directiveId, action, target, actionDetectee: directive.action, targetDetecte: directive.target },
    user.id,
  )

  return NextResponse.json({ success: true }, { status: 200 })
}
