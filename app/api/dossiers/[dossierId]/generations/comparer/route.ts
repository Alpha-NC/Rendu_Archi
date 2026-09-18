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
 * de comparaison inter-dossiers (Chantier F).
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

  const idsAvecResultat = [generationA.resultFileId, generationB.resultFileId].filter((id): id is string => id !== null)
  const urls = idsAvecResultat.length > 0 ? await depot.resolverUrlsSignees(idsAvecResultat) : []
  const urlParFileId = new Map(idsAvecResultat.map((id, i) => [id, urls[i]]))

  const avecUrl = (g: typeof generationA) => ({ ...g, imageUrl: g.resultFileId ? (urlParFileId.get(g.resultFileId) ?? null) : null })

  return NextResponse.json({ success: true, generationA: avecUrl(generationA), generationB: avecUrl(generationB) })
}
