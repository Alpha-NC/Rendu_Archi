import { verifierPrecondition } from '@/lib/rif/etat-machine'
import { LIB_002_VERSION, type VerdictControle } from '@/lib/rif/controle-qualite'
import {
  authentifierRequete,
  obtenirDepot,
  repondreCorpsInvalide,
  repondreDossierIntrouvable,
  repondreErreur,
  repondreOperation,
  verifierGenerationDuDossier,
  verifierProprietaire,
} from '../../../../_lib/reponse'

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
 * Chantier C (backend-completion) — arbitrage documenté : la version
 * canonique est un concept DISTINCT de la validation humaine (§10.7 du
 * PRD), mais seul un verdict humain qui valide (avec ou sans réserve) peut
 * en déclencher une — jamais un calcul automatique, jamais le verdict
 * proposé. `definirGenerationCanonique` garantit au plus une canonique par
 * dossier (voir depot-neon.ts) ; une génération correction_ciblee/
 * nouvelle_generation/production_suspendue ne touche jamais ce statut — la
 * précédente canonique, si elle existe, reste en place.
 */
const VERDICTS_CANONIQUES: VerdictControle[] = ['validation', 'acceptable_avec_reserve']

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
  const { user, reponseRefus } = await authentifierRequete()
  if (reponseRefus) return reponseRefus

  const depot = obtenirDepot()
  const dossier = await depot.obtenirDossier(dossierId)
  if (!dossier) return repondreDossierIntrouvable()
  const refusProprietaire = verifierProprietaire(dossier.ownerId, user.id)
  if (refusProprietaire) return refusProprietaire

  // Chantier F : generationId est un identifiant global — sans ce contrôle,
  // un propriétaire du dossier A pourrait valider une génération du dossier B.
  const generation = await depot.obtenirGeneration(generationId)
  if (!generation) return repondreErreur('generation_introuvable', 'Génération introuvable.', 404)
  const refusGeneration = verifierGenerationDuDossier(generation.dossierId, dossierId)
  if (refusGeneration) return refusGeneration

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

  // Chantier E : si un audit multimodal a déjà écrit un rapport/verdict
  // proposé pour cette génération, on complète CETTE ligne (verdict humain
  // distinct du verdict proposé, jamais une seconde ligne) — sinon,
  // comportement historique inchangé : une ligne neuve, verdict humain
  // direct (dossier jamais passé par un contrôle multimodal).
  const auditExistant = await depot.obtenirAuditQualite(generationId)
  if (auditExistant && !auditExistant.verdictHuman) {
    await depot.enregistrerVerdictHumain(auditExistant.id, {
      verdictHuman: verdictHuman as VerdictControle,
      reserves: typeof reserves === 'string' ? reserves : undefined,
      validatedBy: user.id,
    })
  } else {
    await depot.enregistrerAuditQualite({
      generationId,
      checklistVersion: LIB_002_VERSION,
      verdictHuman: verdictHuman as VerdictControle,
      reserves: typeof reserves === 'string' ? reserves : undefined,
      validatedBy: user.id,
    })
  }

  await depot.transitionnerDossier(dossierId, versEtat)
  await depot.journaliserEvenement(dossierId, 'audit_qualite_enregistre', { generationId, verdictHuman }, user.id)

  if (VERDICTS_CANONIQUES.includes(verdictHuman as VerdictControle)) {
    await depot.definirGenerationCanonique(dossierId, generationId)
    await depot.journaliserEvenement(dossierId, 'version_canonique_definie', { generationId }, user.id)
  }

  return repondreOperation({ success: true })
}
