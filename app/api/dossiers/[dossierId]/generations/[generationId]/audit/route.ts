import { verifierPrecondition } from '@/lib/rif/etat-machine'
import { LIB_002_VERSION, type VerdictControle } from '@/lib/rif/controle-qualite'
import { authentifierRequete, obtenirDepot, repondreCorpsInvalide, repondreOperation, verifierProprietaire } from '../../../../_lib/reponse'

const VERDICTS: VerdictControle[] = [
  'validation',
  'acceptable_avec_reserve',
  'correction_ciblee',
  'nouvelle_generation',
  'production_suspendue',
]

// PRD §9.6/§15 : un verdict humain fait avancer le dossier vers l'un de ces
// cinq états depuis CONTRÔLE_À_EXAMINER (PRD §8).
const ETAT_PAR_VERDICT: Record<VerdictControle, 'VALIDE' | 'A_CORRIGER' | 'A_REPRENDRE' | 'SUSPENDU'> = {
  validation: 'VALIDE',
  acceptable_avec_reserve: 'VALIDE',
  correction_ciblee: 'A_CORRIGER',
  nouvelle_generation: 'A_REPRENDRE',
  production_suspendue: 'SUSPENDU',
}

/**
 * POST /api/dossiers/[dossierId]/generations/[generationId]/audit — verdict
 * HUMAIN sur un rendu (PRD §15.1). Seul ce champ compte pour
 * autoriserExportAdministratif (lib/rif/controle-qualite.ts) — jamais un
 * verdict calculé automatiquement.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ dossierId: string; generationId: string }> },
) {
  const { dossierId, generationId } = await params
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
  const { verdictHuman, reserves } = (corps as Record<string, unknown>) ?? {}
  if (typeof verdictHuman !== 'string' || !VERDICTS.includes(verdictHuman as VerdictControle)) {
    return repondreCorpsInvalide(`Le champ verdictHuman doit être l'un de : ${VERDICTS.join(', ')}.`)
  }

  const versEtat = ETAT_PAR_VERDICT[verdictHuman as VerdictControle]
  const precondition = verifierPrecondition(dossier.etat, versEtat, dossier.projectState, {
    usageAdministratif: dossier.usageAdministratif,
    dernierControleQualite: verdictHuman === 'validation' ? 'conforme' : verdictHuman === 'acceptable_avec_reserve' ? 'reserve' : 'non_conforme',
  })
  if (!precondition.autorisee) {
    await depot.journaliserEvenement(
      dossierId,
      'operation_refusee',
      { operation: 'enregistrerAuditQualite', raison: precondition.raison },
      user.id,
    )
    return repondreOperation({
      success: false,
      error: { code: 'transition_refusee', message: precondition.raison ?? 'Verdict impossible dans cet état.' },
    })
  }

  await depot.enregistrerAuditQualite({
    generationId,
    checklistVersion: LIB_002_VERSION,
    verdictHuman: verdictHuman as VerdictControle,
    reserves: typeof reserves === 'string' ? reserves : undefined,
    validatedBy: user.id,
  })
  await depot.transitionnerDossier(dossierId, versEtat)
  await depot.journaliserEvenement(dossierId, 'audit_qualite_enregistre', { generationId, verdictHuman }, user.id)

  return repondreOperation({ success: true })
}
