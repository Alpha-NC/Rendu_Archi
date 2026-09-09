import { NextResponse } from 'next/server'
import { creerClassifieurRole, interpreterDetection, type ImageSource } from '@/lib/rif/detection-role'
import type { RoleSource } from '@/lib/rif/project-state'
import { authentifierRequete, obtenirDepot, repondreCorpsInvalide, verifierProprietaire } from '../../_lib/reponse'

const ROLES_ACCEPTES: RoleSource[] = [
  'revit_view',
  'site_photo',
  'axonometry',
  'annotated_source',
  'material_reference',
  'existing_building_photo',
]

const MIME_SUPPORTES: ImageSource['mimeType'][] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

/**
 * POST /api/dossiers/[dossierId]/sources — dépôt d'une source (PRD §9.1).
 *
 * Le rôle est désormais détecté automatiquement depuis le contenu de
 * l'image (`lib/rif/detection-role.ts`) : le slot où l'utilisateur dépose
 * le fichier n'est plus qu'un indice (`role` dans le formulaire, optionnel),
 * jamais une autorité — un désaccord entre l'indice et la détection vaut
 * ambiguïté, jamais un tranchage silencieux en faveur de l'un des deux.
 */
export async function POST(request: Request, { params }: { params: Promise<{ dossierId: string }> }) {
  const { dossierId } = await params
  const { user, supabase, reponseRefus } = await authentifierRequete()
  if (reponseRefus) return reponseRefus

  const depot = obtenirDepot(supabase)
  const dossier = await depot.obtenirDossier(dossierId)
  if (!dossier) {
    return NextResponse.json(
      { success: false, error: { code: 'dossier_introuvable', message: 'Dossier introuvable.' } },
      { status: 404 },
    )
  }
  const refusProprietaire = verifierProprietaire(dossier.ownerId, user.id)
  if (refusProprietaire) return refusProprietaire

  let formulaire: FormData
  try {
    formulaire = await request.formData()
  } catch {
    return repondreCorpsInvalide('Corps de requête multipart/form-data attendu.')
  }

  const fichier = formulaire.get('fichier')
  const roleIndice = formulaire.get('role')

  if (!(fichier instanceof File)) {
    return repondreCorpsInvalide('Le champ fichier (fichier binaire) est requis.')
  }
  if (roleIndice !== null && (typeof roleIndice !== 'string' || !ROLES_ACCEPTES.includes(roleIndice as RoleSource))) {
    return repondreCorpsInvalide(`Le champ role, s'il est fourni, doit être l'un de : ${ROLES_ACCEPTES.join(', ')}.`)
  }
  if (!MIME_SUPPORTES.includes(fichier.type as ImageSource['mimeType'])) {
    return repondreCorpsInvalide(
      `Format non pris en charge pour la détection automatique du rôle : ${fichier.type || 'inconnu'}. Formats acceptés : ${MIME_SUPPORTES.join(', ')}.`,
    )
  }

  // Contrôle minimal avant collecte (PRD §9.1 : format, taille, intégrité).
  const TAILLE_MAX_OCTETS = 25 * 1024 * 1024
  if (fichier.size === 0 || fichier.size > TAILLE_MAX_OCTETS) {
    return repondreCorpsInvalide('Fichier vide ou dépassant la taille maximale acceptée (25 Mo).')
  }

  let classifieurRole
  try {
    classifieurRole = creerClassifieurRole()
  } catch (erreur) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'configuration_manquante',
          message: erreur instanceof Error ? erreur.message : 'Configuration du modèle indisponible.',
        },
      },
      { status: 500 },
    )
  }

  const contenu = await fichier.arrayBuffer()

  let detection
  try {
    detection = await classifieurRole(
      { base64: Buffer.from(contenu).toString('base64'), mimeType: fichier.type as ImageSource['mimeType'] },
      fichier.name,
    )
  } catch (erreur) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'detection_role_echec',
          message: erreur instanceof Error ? erreur.message : 'Détection automatique du rôle indisponible.',
        },
      },
      { status: 502 },
    )
  }
  const { role_detected, role_confirmed, ambigu } = interpreterDetection(
    detection,
    roleIndice as RoleSource | null ?? undefined,
  )

  const resultat = await depot.enregistrerFichierSource({
    dossierId,
    ownerId: user.id,
    roleDetecte: role_detected,
    originalName: fichier.name,
    contenu,
    mimeType: fichier.type || 'application/octet-stream',
  })

  // Le fichier existe dans le stockage/la table `files`, mais tant qu'il
  // n'apparaît pas dans project_state.sources, ni la conversation ni
  // l'interface ne savent qu'il a été déposé (PRD §10).
  await depot.mettreAJourProjectState(dossierId, {
    ...dossier.projectState,
    sources: [
      ...dossier.projectState.sources,
      { id: resultat.id, role_detected, ...(role_confirmed ? { role_confirmed } : {}), status: 'valid' },
    ],
  })

  // BROUILLON -> SOURCES_REÇUES : fait mécanique (des sources sont
  // arrivées), aucun jugement requis — contrairement aux étapes suivantes,
  // qui passent par avancerParcours. Sans ça, le dossier reste bloqué en
  // BROUILLON et la génération est inatteignable.
  if (dossier.etat === 'BROUILLON') {
    await depot.transitionnerDossier(dossierId, 'SOURCES_RECUES')
  }

  await depot.journaliserEvenement(
    dossierId,
    'source_deposee',
    { fileId: resultat.id, roleDetecte: role_detected, roleIndice, ambigu, nomOriginal: fichier.name },
    user.id,
  )

  return NextResponse.json(
    { success: true, fileId: resultat.id, role: role_detected, ambigu },
    { status: 201 },
  )
}
