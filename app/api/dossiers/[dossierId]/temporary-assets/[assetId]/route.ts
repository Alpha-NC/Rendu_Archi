import { NextResponse } from 'next/server'
import { supprimerFichier } from '@/lib/storage/vercel-blob'
import {
  authentifierRequete,
  obtenirDepot,
  repondreDossierIntrouvable,
  repondreErreur,
  verifierProprietaire,
} from '../../../_lib/reponse'

/**
 * DELETE /api/dossiers/[dossierId]/temporary-assets/[assetId] — Lot 2
 * Source Lifecycle (D-23). Suppression RÉELLE (blob + ligne), sûre pour ce
 * domaine uniquement : un asset temporaire n'est jamais référencé par une
 * génération, un audit qualité ou `project_state.sources` (contrairement
 * aux sources principales — voir DECISIONS.md D-23, aucune route DELETE
 * n'existe pour celles-ci, délibérément).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ dossierId: string; assetId: string }> },
) {
  const { dossierId, assetId } = await params
  const { user, reponseRefus } = await authentifierRequete()
  if (reponseRefus) return reponseRefus

  const depot = obtenirDepot()
  const dossier = await depot.obtenirDossier(dossierId)
  if (!dossier) return repondreDossierIntrouvable()
  const refusProprietaire = verifierProprietaire(dossier.ownerId, user.id)
  if (refusProprietaire) return refusProprietaire

  const asset = await depot.obtenirAssetTemporaire(assetId)
  if (!asset) return repondreErreur('asset_introuvable', 'Photo introuvable.', 404)
  if (asset.dossierId !== dossierId) {
    return repondreErreur('asset_introuvable', 'Photo introuvable dans ce dossier.', 404)
  }

  await depot.supprimerAssetTemporaire(assetId)
  try {
    await supprimerFichier(asset.storageKey)
  } catch (erreur) {
    // La ligne DB a déjà disparu — un blob orphelin restant est un problème
    // de nettoyage, jamais un échec de l'action utilisateur (déjà réussie
    // de son point de vue).
    console.error('[temporary-assets DELETE]', erreur instanceof Error ? erreur.message : erreur)
  }
  await depot.journaliserEvenement(dossierId, 'temporary_asset_supprime', { assetId }, user.id)

  return NextResponse.json({ success: true })
}
