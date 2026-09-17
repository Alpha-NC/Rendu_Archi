import { NextResponse } from 'next/server'
import { authentifierRequete, obtenirDepot, repondreDossierIntrouvable, verifierProprietaire } from '../../_lib/reponse'

/**
 * GET /api/dossiers/[dossierId]/generations — historique des générations
 * (PRD §10.7, Chantier A backend-completion) : restaure ce que l'interface
 * doit montrer après un refresh, sans dépendre d'un état React transitoire.
 *
 * `imageUrl` est résolue à la demande (URL signée, 5 min) — jamais stockée
 * comme source de vérité (PRD §12). `resultFileId` reste la référence
 * durable ; une génération sans résultat (en cours ou échouée) a
 * `imageUrl: null`.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ dossierId: string }> }) {
  const { dossierId } = await params
  const { user, reponseRefus } = await authentifierRequete()
  if (reponseRefus) return reponseRefus

  const depot = obtenirDepot()
  const dossier = await depot.obtenirDossier(dossierId)
  if (!dossier) return repondreDossierIntrouvable()
  const refusProprietaire = verifierProprietaire(dossier.ownerId, user.id)
  if (refusProprietaire) return refusProprietaire

  const generations = await depot.listerGenerations(dossierId)

  const idsAvecResultat = generations
    .map((g) => g.resultFileId)
    .filter((id): id is string => id !== null)
  const urls = idsAvecResultat.length > 0 ? await depot.resolverUrlsSignees(idsAvecResultat) : []
  const urlParFileId = new Map(idsAvecResultat.map((id, i) => [id, urls[i]]))

  return NextResponse.json({
    success: true,
    generations: generations.map((g) => ({
      ...g,
      imageUrl: g.resultFileId ? (urlParFileId.get(g.resultFileId) ?? null) : null,
    })),
  })
}
