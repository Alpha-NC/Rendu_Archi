import { verifierPrecondition } from '@/lib/rif/etat-machine'
import { authentifierRequete, obtenirDepot, repondreOperation, verifierProprietaire } from '../../_lib/reponse'

/**
 * POST /api/dossiers/[dossierId]/confirmer — action explicite d'Évariste
 * (PRD §9.4) : FICHE_À_CONFIRMER → PRÊT_À_GÉNÉRER, incrémente la révision
 * confirmée du ProjectState (PRD §10 : « une modification ultérieure crée
 * une nouvelle révision »). Jamais déclenchée par le LLM — un bouton humain
 * uniquement.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ dossierId: string }> }) {
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

  const precondition = verifierPrecondition(dossier.etat, 'PRET_A_GENERER', dossier.projectState, {
    ficheProjetConfirmeeParEvariste: true,
  })
  if (!precondition.autorisee) {
    await depot.journaliserEvenement(
      dossierId,
      'operation_refusee',
      { operation: 'confirmerFicheProjet', raison: precondition.raison },
      user.id,
    )
    return repondreOperation({
      success: false,
      error: { code: 'transition_refusee', message: precondition.raison ?? 'Confirmation impossible dans cet état.' },
    })
  }

  const projectStateConfirme = { ...dossier.projectState, revision: dossier.projectState.revision + 1 }
  await depot.mettreAJourProjectState(dossierId, projectStateConfirme)
  await depot.transitionnerDossier(dossierId, 'PRET_A_GENERER')
  await depot.journaliserEvenement(
    dossierId,
    'fiche_projet_confirmee',
    { revision: projectStateConfirme.revision },
    user.id,
  )

  return repondreOperation({ success: true })
}
