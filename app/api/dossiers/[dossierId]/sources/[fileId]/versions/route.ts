import { NextResponse } from 'next/server'
import {
  authentifierRequete,
  obtenirDepot,
  repondreDossierIntrouvable,
  repondreErreur,
  verifierProprietaire,
} from '../../../../_lib/reponse'

/**
 * GET /api/dossiers/[dossierId]/sources/[fileId]/versions — Lot 2 Source
 * Lifecycle (D-23). `fileId` peut être n'importe quelle version (active ou
 * remplacée) d'un rôle principal — la route résout son rôle effectif puis
 * renvoie toutes les versions de ce rôle, la plus récente d'abord. Jamais
 * une perte silencieuse : une source remplacée reste consultable ici même
 * après avoir disparu de `ProjectState.sources`.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ dossierId: string; fileId: string }> },
) {
  const { dossierId, fileId } = await params
  const { user, reponseRefus } = await authentifierRequete()
  if (reponseRefus) return reponseRefus

  const depot = obtenirDepot()
  const dossier = await depot.obtenirDossier(dossierId)
  if (!dossier) return repondreDossierIntrouvable()
  const refusProprietaire = verifierProprietaire(dossier.ownerId, user.id)
  if (refusProprietaire) return refusProprietaire

  const fichier = await depot.obtenirFichierSource(fileId)
  if (!fichier) return repondreErreur('source_introuvable', 'Source introuvable.', 404)
  if (fichier.dossierId !== dossierId) {
    return repondreErreur('source_introuvable', 'Source introuvable dans ce dossier.', 404)
  }

  const roleEffectif = fichier.roleConfirmed ?? fichier.roleDetected
  const versions = await depot.listerVersionsSource(dossierId, roleEffectif)

  return NextResponse.json({ success: true, role: roleEffectif, versions })
}
