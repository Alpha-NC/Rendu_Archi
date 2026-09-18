import { NextResponse } from 'next/server'
import { supprimerFichier } from '@/lib/storage/vercel-blob'
import {
  MIME_TEMPORARY_ASSETS_ACCEPTES,
  TAILLE_TEMPORARY_ASSET_MAX_OCTETS,
  validerPathnameTemporaryAsset,
} from '@/lib/storage/contraintes-temporary-assets'
import {
  authentifierRequete,
  obtenirDepot,
  repondreCorpsInvalide,
  repondreDossierIntrouvable,
  repondreErreur,
  verifierProprietaire,
} from '../../_lib/reponse'

/**
 * GET/POST /api/dossiers/[dossierId]/temporary-assets — Lot 2 Source
 * Lifecycle (D-23). Domaine séparé de `.../sources` : pas de rôle, pas de
 * version, pas d'entrée `project_state.sources` (PRD Geometry-First §15 —
 * une aide à la compréhension multimodale, jamais une autorité). Le fichier
 * est déjà dans Blob quand POST est appelé (`.../temporary-assets/token` a
 * émis le jeton) ; cette route ne fait qu'enregistrer les métadonnées.
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

  const assets = await depot.listerAssetsTemporaires(dossierId)
  return NextResponse.json({ success: true, assets })
}

export async function POST(request: Request, { params }: { params: Promise<{ dossierId: string }> }) {
  const { dossierId } = await params
  const { user, reponseRefus } = await authentifierRequete()
  if (reponseRefus) return reponseRefus

  const depot = obtenirDepot()
  const dossier = await depot.obtenirDossier(dossierId)
  if (!dossier) return repondreDossierIntrouvable()
  const refusProprietaire = verifierProprietaire(dossier.ownerId, user.id)
  if (refusProprietaire) return refusProprietaire

  let corps: unknown
  try {
    corps = await request.json()
  } catch {
    return repondreCorpsInvalide('Corps de requête JSON attendu.')
  }

  const { pathname, originalName, mimeType, sizeBytes } = (corps as Record<string, unknown>) ?? {}
  if (typeof pathname !== 'string' || typeof originalName !== 'string') {
    return repondreCorpsInvalide('Les champs pathname et originalName (texte) sont requis.')
  }
  try {
    validerPathnameTemporaryAsset(pathname, dossierId)
  } catch {
    return repondreCorpsInvalide('Le fichier déposé ne correspond pas à ce dossier.')
  }
  if (typeof mimeType !== 'string' || !(MIME_TEMPORARY_ASSETS_ACCEPTES as readonly string[]).includes(mimeType)) {
    return repondreCorpsInvalide(`Le champ mimeType doit être l'un de : ${MIME_TEMPORARY_ASSETS_ACCEPTES.join(', ')}.`)
  }
  if (typeof sizeBytes !== 'number' || sizeBytes <= 0 || sizeBytes > TAILLE_TEMPORARY_ASSET_MAX_OCTETS) {
    return repondreCorpsInvalide('Le champ sizeBytes est invalide ou dépasse la taille maximale acceptée (20 Mo).')
  }

  let asset
  try {
    asset = await depot.creerAssetTemporaire({ dossierId, originalName, storageKey: pathname, mimeType, sizeBytes })
  } catch (erreur) {
    // Même discipline que .../sources : un blob orphelin (upload réussi,
    // métadonnées non enregistrées) est nettoyé plutôt que facturé sans usage.
    await supprimerFichier(pathname)
    console.error('[temporary-assets]', erreur instanceof Error ? erreur.message : erreur)
    return repondreErreur('persistance_echec', "Impossible d'enregistrer la photo. Réessayez.", 500)
  }

  await depot.journaliserEvenement(dossierId, 'temporary_asset_depose', { assetId: asset.id, nomOriginal: originalName }, user.id)

  return NextResponse.json({ success: true, asset }, { status: 201 })
}
