import { genererEtAttendre } from '@/lib/fal/client'
import { executerGenerationOuCorrection } from '@/lib/rif/orchestrateur'
import { construirePromptGeneration } from '@/lib/rif/prompt-technique'
import { authentifierRequete, obtenirDepot, repondreDossierIntrouvable, repondreOperation, verifierProprietaire } from '../../_lib/reponse'

/**
 * POST /api/dossiers/[dossierId]/generer — genererRendu (PRD §14.1).
 *
 * Réservée à une première génération. Refusée si le dossier n'est pas dans
 * l'état PRÊT_À_GÉNÉRER (revérifié côté backend par
 * lib/rif/orchestrateur.ts, jamais supposé côté client).
 *
 * Chantier G (backend-completion) — durcissement : cette route acceptait
 * autrefois `promptText`/`sourceFileIds` directement du corps de requête,
 * jamais utilisés en pratique (seul `orchestrateur-conversationnel.ts`
 * appelle `executerGenerationOuCorrection`, en interne, avec un prompt
 * construit par `prompt-technique.ts`) — mais rien n'empêchait un futur
 * front d'appeler cette route HTTP directement avec un prompt arbitraire,
 * contournant tous les garde-fous PRD §9.5. Le prompt et les sources
 * viennent maintenant exclusivement du `project_state` du dossier, comme
 * dans le chemin conversationnel — aucune entrée de ce type acceptée ici.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ dossierId: string }> }) {
  const { dossierId } = await params
  const { user, reponseRefus } = await authentifierRequete()
  if (reponseRefus) return reponseRefus

  const depot = obtenirDepot()
  const dossier = await depot.obtenirDossier(dossierId)
  if (!dossier) return repondreDossierIntrouvable()
  const refusProprietaire = verifierProprietaire(dossier.ownerId, user.id)
  if (refusProprietaire) return refusProprietaire

  const resultat = await executerGenerationOuCorrection(depot, genererEtAttendre, {
    dossierId,
    type: 'initial',
    promptText: construirePromptGeneration(dossier.projectState),
    sourceFileIds: dossier.projectState.sources.map((s) => s.id),
    actorId: user.id,
    contexte: { usageAdministratif: dossier.usageAdministratif },
  })

  return repondreOperation(resultat)
}
