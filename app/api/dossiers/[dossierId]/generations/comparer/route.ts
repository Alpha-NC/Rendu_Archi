import { NextResponse } from 'next/server'
import {
  authentifierRequete,
  obtenirDepot,
  repondreDossierIntrouvable,
  repondreErreur,
  verifierGenerationDuDossier,
  verifierProprietaire,
} from '../../../_lib/reponse'

/**
 * GET /api/dossiers/[dossierId]/generations/comparer?a=ID&b=ID — Chantier D
 * backend-completion. Fournit les données brutes (métadonnées + URLs
 * signées) pour que le FRONT compose visuellement la comparaison — ce
 * backend ne construit aucun composant, juste le contrat (voir la mission :
 * « ne pas créer de logique métier inutile côté backend »).
 *
 * Les deux générations doivent appartenir à ce dossier — sinon 404, jamais
 * de comparaison inter-dossiers (Chantier F). Depuis le Lot 1 RenderTarget
 * (D-22), elles doivent aussi partager la même cible de rendu (ou être
 * toutes deux legacy, sans cible) — sinon 409, jamais de comparaison
 * cross-target.
 */
export async function GET(request: Request, { params }: { params: Promise<{ dossierId: string }> }) {
  const { dossierId } = await params
  const { user, reponseRefus } = await authentifierRequete()
  if (reponseRefus) return reponseRefus

  const depot = obtenirDepot()
  const dossier = await depot.obtenirDossier(dossierId)
  if (!dossier) return repondreDossierIntrouvable()
  const refusProprietaire = verifierProprietaire(dossier.ownerId, user.id)
  if (refusProprietaire) return refusProprietaire

  const url = new URL(request.url)
  const idA = url.searchParams.get('a')
  const idB = url.searchParams.get('b')
  if (!idA || !idB) {
    return repondreErreur('parametres_invalides', 'Les paramètres a et b (identifiants de génération) sont requis.', 400)
  }

  const [generationA, generationB] = await Promise.all([depot.obtenirGeneration(idA), depot.obtenirGeneration(idB)])

  if (!generationA || !generationB) {
    return repondreErreur('generation_introuvable', 'Génération introuvable.', 404)
  }
  const refusA = verifierGenerationDuDossier(generationA.dossierId, dossierId)
  if (refusA) return refusA
  const refusB = verifierGenerationDuDossier(generationB.dossierId, dossierId)
  if (refusB) return refusB

  // Lot 1 RenderTarget (D-22) §11 : comparaison restreinte par défaut à la
  // même cible de rendu — deux générations legacy (sans cible) restent
  // comparables entre elles (même « pool » qu'avant ce lot), mais comparer
  // une cible à une autre, ou une cible à du legacy, n'a pas de sens produit
  // et n'est pas construit dans ce lot (mode R&D cross-target : hors
  // périmètre, voir docs/RIF_BACKEND_CONTRACTS_V2.md).
  if (generationA.renderTargetId !== generationB.renderTargetId) {
    return repondreErreur(
      'cible_differente',
      "Ces deux générations ne visent pas la même cible de rendu — la comparaison n'est pas prise en charge entre cibles différentes.",
      409,
    )
  }

  const idsAvecResultat = [generationA.resultFileId, generationB.resultFileId].filter((id): id is string => id !== null)
  const urls = idsAvecResultat.length > 0 ? await depot.resolverUrlsSignees(idsAvecResultat) : []
  const urlParFileId = new Map(idsAvecResultat.map((id, i) => [id, urls[i]]))

  const renderTarget = generationA.renderTargetId ? await depot.obtenirRenderTarget(generationA.renderTargetId) : null

  const avecUrl = (g: typeof generationA) => ({ ...g, imageUrl: g.resultFileId ? (urlParFileId.get(g.resultFileId) ?? null) : null })

  return NextResponse.json({
    success: true,
    generationA: avecUrl(generationA),
    generationB: avecUrl(generationB),
    outputType: renderTarget?.outputType ?? null,
  })
}
