import { NextResponse } from 'next/server'
import type { RoleSource } from '@/lib/rif/project-state'
import { authentifierRequete, obtenirDepot, repondreCorpsInvalide, verifierProprietaire } from '../../../_lib/reponse'

const ROLES_ACCEPTES: RoleSource[] = [
  'revit_view',
  'site_photo',
  'axonometry',
  'annotated_source',
  'material_reference',
  'existing_building_photo',
]

/**
 * PATCH /api/dossiers/[dossierId]/sources/[fileId] — confirmation humaine
 * du rôle d'une source (PRD §9.1). Seul cas encore nécessaire depuis que le
 * rôle est détecté automatiquement (`lib/rif/detection-role.ts`) : une
 * détection ambiguë (confiance insuffisante ou en désaccord avec
 * l'emplacement choisi) n'inscrit jamais `role_confirmed` toute seule —
 * cette route est le seul endroit qui l'écrit à la main.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ dossierId: string; fileId: string }> },
) {
  const { dossierId, fileId } = await params
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
  const { role } = (corps as Record<string, unknown>) ?? {}
  if (typeof role !== 'string' || !ROLES_ACCEPTES.includes(role as RoleSource)) {
    return repondreCorpsInvalide(`Le champ role doit être l'un de : ${ROLES_ACCEPTES.join(', ')}.`)
  }

  const source = dossier.projectState.sources.find((s) => s.id === fileId)
  if (!source) {
    return NextResponse.json(
      { success: false, error: { code: 'source_introuvable', message: 'Source introuvable dans ce dossier.' } },
      { status: 404 },
    )
  }

  await depot.mettreAJourProjectState(dossierId, {
    ...dossier.projectState,
    sources: dossier.projectState.sources.map((s) =>
      s.id === fileId ? { ...s, role_confirmed: role as RoleSource } : s,
    ),
  })

  await depot.journaliserEvenement(
    dossierId,
    'role_source_confirme',
    { fileId, roleConfirme: role, roleDetecte: source.role_detected },
    user.id,
  )

  return NextResponse.json({ success: true }, { status: 200 })
}
