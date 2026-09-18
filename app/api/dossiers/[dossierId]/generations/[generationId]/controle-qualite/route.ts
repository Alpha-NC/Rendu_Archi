import { NextResponse } from 'next/server'
import { calculerVerdictPropose, LIB_002_VERSION, type RapportControle } from '@/lib/rif/controle-qualite'
import { creerClassifieurQualite, type ImageEntree } from '@/lib/rif/controle-multimodal'
import { criteresApplicables } from '@/lib/rif/render-targets'
import {
  authentifierRequete,
  obtenirDepot,
  repondreDossierIntrouvable,
  repondreErreur,
  verifierGenerationDuDossier,
  verifierProprietaire,
} from '../../../../_lib/reponse'

function mimeDepuisContentType(contentType: string): ImageEntree['mimeType'] {
  if (contentType.includes('png')) return 'image/png'
  if (contentType.includes('gif')) return 'image/gif'
  if (contentType.includes('webp')) return 'image/webp'
  return 'image/jpeg'
}

/**
 * POST .../generations/[generationId]/controle-qualite — Chantier E
 * backend-completion (PRD §15) : lance l'audit multimodal LIB-002 réel et
 * persiste le rapport + verdict PROPOSÉ (jamais `verdict_human` — la
 * validation humaine reste un acte séparé, `.../audit`).
 *
 * NOT_VERIFIED_LIVE (voir lib/rif/controle-multimodal.ts) : le contrat est
 * implémenté et son échec est géré proprement (502 explicite), mais
 * ANTHROPIC_API_KEY est absente de cet environnement au moment d'écrire
 * cette route.
 */
export async function POST(
  _request: Request,
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

  const generation = await depot.obtenirGeneration(generationId)
  if (!generation) return repondreErreur('generation_introuvable', 'Génération introuvable.', 404)
  const refusGeneration = verifierGenerationDuDossier(generation.dossierId, dossierId)
  if (refusGeneration) return refusGeneration

  if (generation.status !== 'succeeded' || !generation.resultFileId) {
    return repondreErreur('generation_non_terminee', 'Le contrôle qualité exige un rendu terminé avec succès.', 409)
  }

  let classifieur
  try {
    classifieur = creerClassifieurQualite()
  } catch (erreur) {
    return repondreErreur(
      'configuration_manquante',
      erreur instanceof Error ? erreur.message : 'Configuration du modèle indisponible.',
      500,
    )
  }

  // Relit le rendu ET les sources depuis le stockage privé — jamais une URL
  // fournisseur transitoire, jamais un contrôle sans voir les images
  // réelles (même principe que le rapatriement du rendu, orchestrateur.ts).
  const idsATelecharger = [generation.resultFileId, ...generation.sourceFileIds]
  let images: ImageEntree[]
  try {
    const urls = await depot.resolverUrlsSignees(idsATelecharger)
    images = await Promise.all(
      urls.map(async (url) => {
        const reponseImage = await fetch(url)
        if (!reponseImage.ok) throw new Error(`Téléchargement d'image impossible (HTTP ${reponseImage.status}).`)
        const contenu = await reponseImage.arrayBuffer()
        const contentType = reponseImage.headers.get('content-type') ?? 'image/jpeg'
        return { base64: Buffer.from(contenu).toString('base64'), mimeType: mimeDepuisContentType(contentType) }
      }),
    )
  } catch (erreur) {
    return repondreErreur(
      'stockage_echec',
      erreur instanceof Error ? erreur.message : 'Lecture des images impossible.',
      502,
    )
  }
  const [renduImage, ...sourcesImages] = images

  // Lot 1 RenderTarget (D-22) §18 : le QualityProfile est dérivé côté
  // backend depuis la cible de rendu de la génération — jamais transmis par
  // le frontend. Sans cible (génération legacy), la grille complète
  // s'applique, comportement inchangé.
  const renderTarget = generation.renderTargetId ? await depot.obtenirRenderTarget(generation.renderTargetId) : null
  const criteres = criteresApplicables(renderTarget?.outputType)

  let lignes
  try {
    lignes = await classifieur({
      rendu: renduImage,
      sources: sourcesImages,
      projectState: dossier.projectState,
      usageAdministratif: dossier.usageAdministratif,
      criteresApplicables: renderTarget ? criteres : undefined,
    })
  } catch (erreur) {
    await depot.journaliserEvenement(
      dossierId,
      'controle_qualite_multimodal_echec',
      { generationId, message: erreur instanceof Error ? erreur.message : 'erreur inconnue' },
      user.id,
    )
    return repondreErreur(
      'controle_qualite_echec',
      erreur instanceof Error ? erreur.message : 'Contrôle qualité multimodal indisponible.',
      502,
    )
  }

  const rapport: RapportControle = {
    generationId,
    checklistVersion: LIB_002_VERSION,
    usageEvalue: dossier.projectState.usage?.join(', ') || 'non précisé',
    usageAdministratif: dossier.usageAdministratif,
    lignes,
  }
  const { verdict, motif } = calculerVerdictPropose(rapport)

  const { id: auditId } = await depot.creerRapportQualite({
    generationId,
    checklistVersion: LIB_002_VERSION,
    report: lignes,
    verdictProposed: verdict,
  })
  await depot.journaliserEvenement(
    dossierId,
    'controle_qualite_multimodal',
    { generationId, auditId, verdictProposed: verdict },
    user.id,
  )

  return NextResponse.json({
    success: true,
    auditId,
    report: lignes,
    verdictProposed: verdict,
    motif,
    // Lot 1 RenderTarget (D-22) §10 : le rapport expose désormais sa cible,
    // son OutputType et les critères réellement applicables — calculés à la
    // demande, jamais dupliqués dans la ligne `quality_audits` elle-même
    // (dérivables depuis generation_id à tout moment, comme render_target_id
    // sur `generations`).
    renderTargetId: generation.renderTargetId,
    outputType: renderTarget?.outputType ?? null,
    criteresApplicables: criteres,
  })
}
