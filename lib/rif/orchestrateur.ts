import { autoriserOperation, type OperationRif } from './appel-outil'
import type { DepotDossiers } from './depot'
import type { genererEtAttendre, ResultatGeneration } from '../fal/client'

/**
 * Orchestrateur des trois opérations techniques (PRD §14). Logique pure,
 * injectée avec un `DepotDossiers` et un client fal.ai — testable sans
 * Supabase ni réseau réel.
 *
 * Chaque fonction ici est le point où convergent les deux garde-fous déjà
 * construits : `autoriserOperation` (préconditions revérifiées côté backend,
 * PRD §11) et la journalisation transactionnelle (PRD §18.1). Aucun Route
 * Handler ne doit dupliquer cette logique ni la contourner.
 */

export interface ResultatOperation {
  success: boolean
  generationId?: string
  imageUrl?: string
  error?: { code: string; message: string }
}

type AppelFal = typeof genererEtAttendre

export interface ParametresGenerationOuCorrection {
  dossierId: string
  type: 'initial' | 'correction'
  promptText: string
  sourceFileIds: string[]
  actorId: string
  /** Contexte de préconditions, transmis tel quel à autoriserOperation. */
  contexte?: Parameters<typeof autoriserOperation>[3]
}

const OPERATION_PAR_TYPE: Record<'initial' | 'correction', OperationRif> = {
  initial: 'genererRendu',
  correction: 'corrigerRendu',
}

/**
 * Exécute `genererRendu` ou `corrigerRendu` — même déroulé
 * transactionnel pour les deux, seul le type et l'état de départ autorisé
 * diffèrent (D-09 : deux opérations distinctes, jamais confondues, mais
 * l'une n'est pas plus « privilégiée » que l'autre dans son exécution).
 */
export async function executerGenerationOuCorrection(
  depot: DepotDossiers,
  appelerFal: AppelFal,
  parametres: ParametresGenerationOuCorrection,
): Promise<ResultatOperation> {
  const dossier = await depot.obtenirDossier(parametres.dossierId)
  if (!dossier) {
    return { success: false, error: { code: 'dossier_introuvable', message: 'Dossier introuvable.' } }
  }

  const operation = OPERATION_PAR_TYPE[parametres.type]
  const decision = autoriserOperation(operation, dossier.etat, dossier.projectState, parametres.contexte)
  if (!decision.autorisee) {
    await depot.journaliserEvenement(
      dossier.id,
      'operation_refusee',
      { operation, raison: decision.raison },
      parametres.actorId,
    )
    return {
      success: false,
      error: { code: 'transition_refusee', message: decision.raison ?? 'Opération non autorisée dans cet état.' },
    }
  }

  // PRD §18.1 : la ligne existe avant l'appel fournisseur — pas de rendu
  // orphelin possible si tout échoue après ce point.
  const { id: generationId } = await depot.creerGeneration({
    dossierId: dossier.id,
    type: parametres.type,
    projectStateRevision: dossier.projectState.revision,
    promptText: parametres.promptText,
    sourceFileIds: parametres.sourceFileIds,
  })

  await depot.transitionnerDossier(dossier.id, 'GENERATION_EN_COURS')

  let resultatFal: ResultatGeneration
  try {
    const imageUrls = await depot.resolverUrlsSignees(parametres.sourceFileIds)
    resultatFal = await appelerFal({ prompt: parametres.promptText, imageUrls })
  } catch (erreur) {
    resultatFal = {
      statut: 'echec',
      code: 'fal_ai_echec',
      message: erreur instanceof Error ? erreur.message : 'Appel fal.ai interrompu.',
    }
  }

  if (resultatFal.statut === 'echec') {
    await depot.mettreAJourGeneration(generationId, {
      status: resultatFal.code === 'timeout' ? 'timed_out' : 'failed',
      completedAt: new Date().toISOString(),
    })
    await depot.transitionnerDossier(dossier.id, 'ECHEC')
    await depot.journaliserEvenement(
      dossier.id,
      'generation_echouee',
      { generationId, code: resultatFal.code, message: resultatFal.message },
      parametres.actorId,
    )
    return { success: false, generationId, error: { code: resultatFal.code, message: resultatFal.message } }
  }

  // PRD §12 : le rendu est rapatrié dans le stockage privé — l'URL fal.ai
  // n'est jamais conservée comme référence durable.
  let fichierResultat: { id: string }
  try {
    const reponseImage = await fetch(resultatFal.imageUrl)
    if (!reponseImage.ok) throw new Error(`Téléchargement du rendu impossible (HTTP ${reponseImage.status}).`)
    const contenu = await reponseImage.arrayBuffer()
    const mimeType = reponseImage.headers.get('content-type') ?? 'image/png'
    fichierResultat = await depot.enregistrerFichierResultat({
      dossierId: dossier.id,
      ownerId: dossier.ownerId,
      generationId,
      contenu,
      mimeType,
    })
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : 'Rapatriement du rendu impossible.'
    await depot.mettreAJourGeneration(generationId, { status: 'failed', completedAt: new Date().toISOString() })
    await depot.transitionnerDossier(dossier.id, 'ECHEC')
    await depot.journaliserEvenement(
      dossier.id,
      'generation_echouee',
      { generationId, code: 'stockage_echec', message },
      parametres.actorId,
    )
    return { success: false, generationId, error: { code: 'stockage_echec', message } }
  }

  await depot.mettreAJourGeneration(generationId, {
    status: 'succeeded',
    resultFileId: fichierResultat.id,
    providerRequestId: resultatFal.requestId,
    completedAt: new Date().toISOString(),
  })
  // PRD §9.6 : le rendu entre obligatoirement en CONTRÔLE_À_EXAMINER — il
  // n'est jamais déclaré conforme sur la seule base de la réponse fal.ai.
  await depot.transitionnerDossier(dossier.id, 'CONTROLE_A_EXAMINER')
  await depot.journaliserEvenement(
    dossier.id,
    'generation_reussie',
    { generationId, resultFileId: fichierResultat.id },
    parametres.actorId,
  )

  // URL signée pour que l'appelant (interface de contrôle qualité) puisse
  // afficher le rendu — sans ça, impossible de juger quoi que ce soit.
  const [imageUrl] = await depot.resolverUrlsSignees([fichierResultat.id])
  return { success: true, generationId, imageUrl }
}

export interface ParametresReprise {
  dossierId: string
  actorId: string
  motif: string
}

/**
 * Exécute `reprendreDepuisSources` (PRD §14.3). Contrairement aux deux
 * opérations ci-dessus, celle-ci n'appelle jamais fal.ai : elle réinitialise
 * le parcours vers SOURCES_CONTRÔLÉES pour reconstruire une révision
 * confirmée du ProjectState avant toute nouvelle génération. Ne jamais la
 * présenter ni l'implémenter comme une correction locale (D-09).
 */
export async function executerReprise(
  depot: DepotDossiers,
  parametres: ParametresReprise,
): Promise<ResultatOperation> {
  const dossier = await depot.obtenirDossier(parametres.dossierId)
  if (!dossier) {
    return { success: false, error: { code: 'dossier_introuvable', message: 'Dossier introuvable.' } }
  }

  const decision = autoriserOperation('reprendreDepuisSources', dossier.etat, dossier.projectState)
  if (!decision.autorisee) {
    await depot.journaliserEvenement(
      dossier.id,
      'operation_refusee',
      { operation: 'reprendreDepuisSources', raison: decision.raison },
      parametres.actorId,
    )
    return {
      success: false,
      error: { code: 'transition_refusee', message: decision.raison ?? 'Reprise non autorisée dans cet état.' },
    }
  }

  await depot.transitionnerDossier(dossier.id, 'SOURCES_CONTROLEES')
  await depot.journaliserEvenement(
    dossier.id,
    'reprise_depuis_sources',
    { motif: parametres.motif },
    parametres.actorId,
  )

  return { success: true }
}
