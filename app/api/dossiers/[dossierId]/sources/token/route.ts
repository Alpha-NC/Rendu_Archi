import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'
import { construireContrainteUploadSource, validerPathnameSource } from '@/lib/storage/contraintes-source'
import { verifierBlobConfigure } from '@/lib/storage/vercel-blob'
import {
  authentifierRequete,
  obtenirDepot,
  repondreDossierIntrouvable,
  repondreErreur,
  verifierProprietaire,
} from '../../../_lib/reponse'

/**
 * POST /api/dossiers/[dossierId]/sources/token — émet un jeton client Vercel
 * Blob à durée/portée limitées (PRD V2.1 §16.1, D-19 : upload direct
 * navigateur → Blob, jamais via une Vercel Function — la limite de 4,5 Mo du
 * body des Functions rendait l'ancien flux inutilisable pour les fichiers
 * RIF réels).
 *
 * Autorise l'upload AVANT que le navigateur obtienne un droit d'écriture :
 * authentification, propriété du dossier et préfixe de pathname vérifiés
 * ici — jamais côté client. Le jeton émis est signé, à durée de vie limitée
 * (`validUntil`) et contraint (type MIME, taille) ; `BLOB_READ_WRITE_TOKEN`
 * (le jeton maître) n'est jamais transmis au navigateur.
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

  // Lot 2 (D-23) — diagnostic du bug « Failed to retrieve the client token » :
  // sans ce contrôle explicite, un BLOB_READ_WRITE_TOKEN absent/vide fait
  // échouer handleUpload avec une erreur SDK opaque, jamais visible côté
  // navigateur (voir vercel-blob.ts::verifierBlobConfigure). Ici, le
  // problème est journalisé clairement côté serveur avant tout appel SDK.
  try {
    verifierBlobConfigure()
  } catch (erreur) {
    console.error('[sources/token]', erreur instanceof Error ? erreur.message : erreur)
    return repondreErreur('configuration_manquante', 'Stockage indisponible côté serveur — réessayez plus tard.', 500)
  }

  const corps = (await request.json()) as HandleUploadBody

  try {
    const reponse = await handleUpload({
      body: corps,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Le dossier a déjà été vérifié appartenir à l'utilisateur ci-dessus
        // — ceci empêche seulement d'écrire dans le dossier d'un autre, ça
        // ne réévalue pas l'autorité.
        validerPathnameSource(pathname, dossierId)
        return construireContrainteUploadSource()
      },
    })

    return NextResponse.json(reponse)
  } catch (erreur) {
    // Lot 2 (D-23), mission §22 : le détail technique (pathname invalide,
    // contrainte SDK...) reste en log serveur — le message renvoyé au
    // client reste actionnable sans jamais exposer une erreur SDK brute.
    console.error('[sources/token]', erreur instanceof Error ? erreur.message : erreur)
    return repondreErreur('jeton_upload_refuse', "Impossible de préparer l'envoi du fichier. Réessayez.", 400)
  }
}
