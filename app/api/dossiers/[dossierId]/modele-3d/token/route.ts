import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'
import { construireContrainteUploadModele3D, validerPathnameModele3D } from '@/lib/storage/contraintes-modele-3d'
import { authentifierRequete, obtenirDepot, repondreDossierIntrouvable, repondreErreur, verifierProprietaire } from '../../../_lib/reponse'

/**
 * POST /api/dossiers/[dossierId]/modele-3d/token — jeton client Vercel Blob
 * pour la source géométrique 3D (RIF V2, geometry-first). Même principe que
 * `.../sources/token` (upload direct navigateur → Blob, jamais via une
 * Vercel Function) mais contraintes distinctes : pas de restriction de type
 * (format non figé, §1) et une taille maximale bien plus grande (500 Mo).
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

  const corps = (await request.json()) as HandleUploadBody

  try {
    const reponse = await handleUpload({
      body: corps,
      request,
      onBeforeGenerateToken: async (pathname) => {
        validerPathnameModele3D(pathname, dossierId)
        return construireContrainteUploadModele3D()
      },
    })
    return NextResponse.json(reponse)
  } catch (erreur) {
    return repondreErreur(
      'jeton_upload_refuse',
      erreur instanceof Error ? erreur.message : 'Émission du jeton de dépôt impossible.',
      400,
    )
  }
}
