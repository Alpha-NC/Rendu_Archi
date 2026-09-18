import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'
import {
  construireContrainteUploadTemporaryAsset,
  validerPathnameTemporaryAsset,
} from '@/lib/storage/contraintes-temporary-assets'
import { verifierBlobConfigure } from '@/lib/storage/vercel-blob'
import {
  authentifierRequete,
  obtenirDepot,
  repondreDossierIntrouvable,
  repondreErreur,
  verifierProprietaire,
} from '../../../_lib/reponse'

/**
 * POST /api/dossiers/[dossierId]/temporary-assets/token — jeton client
 * Vercel Blob pour une photo terrain (Lot 2 Source Lifecycle, D-23). Même
 * principe que `.../sources/token` — un fichier par appel ; le multi-upload
 * (mission §12) est géré côté client en appelant cette route une fois par
 * fichier, avec une concurrence limitée, jamais un lot serveur.
 */
export async function POST(request: Request, { params }: { params: Promise<{ dossierId: string }> }) {
  const { dossierId } = await params
  const { user, reponseRefus } = await authentifierRequete()
  if (reponseRefus) return reponseRefus

  const depot = obtenirDepot()
  const dossier = await depot.obtenirDossier(dossierId)
  if (!dossier) return repondreDossierIntrouvable()
  const refusProprietaire = verifierProprietaire(dossier.ownerId, user.id)
  if (refusProprietaire) return refusProprietaire

  try {
    verifierBlobConfigure()
  } catch (erreur) {
    console.error('[temporary-assets/token]', erreur instanceof Error ? erreur.message : erreur)
    return repondreErreur('configuration_manquante', 'Stockage indisponible côté serveur — réessayez plus tard.', 500)
  }

  const corps = (await request.json()) as HandleUploadBody

  try {
    const reponse = await handleUpload({
      body: corps,
      request,
      onBeforeGenerateToken: async (pathname) => {
        validerPathnameTemporaryAsset(pathname, dossierId)
        return construireContrainteUploadTemporaryAsset()
      },
    })
    return NextResponse.json(reponse)
  } catch (erreur) {
    console.error('[temporary-assets/token]', erreur instanceof Error ? erreur.message : erreur)
    return repondreErreur('jeton_upload_refuse', "Impossible de préparer l'envoi du fichier. Réessayez.", 400)
  }
}
