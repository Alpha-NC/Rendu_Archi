import { NextResponse } from 'next/server'
import { creerSourceModele3D } from '@/lib/rif/geometrie-3d'
import { validerPathnameModele3D } from '@/lib/storage/contraintes-modele-3d'
import {
  authentifierRequete,
  obtenirDepot,
  repondreCorpsInvalide,
  repondreDossierIntrouvable,
  verifierProprietaire,
} from '../../_lib/reponse'

/**
 * POST /api/dossiers/[dossierId]/modele-3d
 *
 * Dépose la source géométrique 3D (RIF V2, Geometry-First).
 *
 * Contrairement à /sources, aucune classification automatique n'est appelée :
 * ce n'est pas une image et le rôle n'est pas ambigu.
 *
 * Le fichier est déjà présent dans Vercel Blob lorsque cette route est appelée.
 *
 * Cette route :
 * - enregistre ou remplace la source 3D ;
 * - conserve l'historique via le versioning source ;
 * - remet le cycle d'extraction à UPLOADED ;
 * - met à jour ProjectState ;
 * - journalise l'événement.
 *
 * Elle ne lance PAS l'extraction 3D.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ dossierId: string }> }
) {
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

  const { pathname, originalName, format, sizeBytes } =
    (corps as Record<string, unknown>) ?? {}

  if (
    typeof pathname !== 'string' ||
    typeof originalName !== 'string'
  ) {
    return repondreCorpsInvalide(
      'Les champs pathname et originalName (texte) sont requis.'
    )
  }

  if (typeof format !== 'string' || format.trim().length === 0) {
    return repondreCorpsInvalide(
      'Le champ format (texte non vide — ex. "rvt", "ifc") est requis : le format 3D définitif reste à confirmer, mais un fichier sans format déclaré ne peut pas être exploité plus tard.'
    )
  }

  try {
    validerPathnameModele3D(pathname, dossierId)
  } catch {
    return repondreCorpsInvalide(
      'Le fichier déposé ne correspond pas à ce dossier.'
    )
  }

  const sizeBytesValide =
    typeof sizeBytes === 'number' && sizeBytes >= 0
      ? sizeBytes
      : 0

  const actif = await depot.obtenirSourceActivePourRole(
    dossierId,
    'model_3d'
  )

  let fileId: string
  let evenement: string

  if (actif) {
    const resultat = await depot.remplacerFichierSource({
      dossierId,
      ancienFileId: actif.id,
      roleDetecte: 'model_3d',
      originalName,
      storageKey: pathname,
      mimeType: 'application/octet-stream',
      sizeBytes: sizeBytesValide,
    })

    fileId = resultat.id
    evenement = 'modele_3d_remplace'
  } else {
    const resultat = await depot.enregistrerFichierSource({
      dossierId,
      roleDetecte: 'model_3d',
      originalName,
      storageKey: pathname,
      mimeType: 'application/octet-stream',
      sizeBytes: sizeBytesValide,
    })

    fileId = resultat.id
    evenement = 'modele_3d_depose'
  }

  const source3D = creerSourceModele3D(
    fileId,
    format,
    'application/octet-stream',
    {
      originalName,
      sizeBytes: sizeBytesValide,
    }
  )

  await depot.mettreAJourProjectState(dossierId, {
    ...dossier.projectState,
    modele3D: source3D,
  })

  if (dossier.etat === 'BROUILLON') {
    await depot.transitionnerDossier(
      dossierId,
      'SOURCES_RECUES'
    )
  }

  await depot.journaliserEvenement(
    dossierId,
    evenement,
    {
      format,
      ancienFileId: actif?.id,
    },
    user.id,
    {
      sourceId: fileId,
    }
  )

  return NextResponse.json({
    success: true,
    fileId,
    source: source3D,
    remplace: Boolean(actif),
  })
}