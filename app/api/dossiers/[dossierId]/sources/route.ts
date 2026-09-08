import { NextResponse } from 'next/server'
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

/**
 * POST /api/dossiers/[dossierId]/sources — dépôt d'une source (PRD §9.1).
 *
 * Simplification assumée pour cette première interface : le rôle est choisi
 * explicitement par l'utilisateur au dépôt (slot dans l'UI), pas détecté
 * automatiquement depuis le contenu du fichier — la pré-analyse automatique
 * du rôle (§9.1 : « le système propose automatiquement le rôle ») reste à
 * construire. `role_detected` porte donc ici un choix humain, pas une
 * inférence : à corriger le jour où la détection existe.
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
  const role = formulaire.get('role')

  if (!(fichier instanceof File)) {
    return repondreCorpsInvalide('Le champ fichier (fichier binaire) est requis.')
  }
  if (typeof role !== 'string' || !ROLES_ACCEPTES.includes(role as RoleSource)) {
    return repondreCorpsInvalide(`Le champ role doit être l'un de : ${ROLES_ACCEPTES.join(', ')}.`)
  }

  // Contrôle minimal avant collecte (PRD §9.1 : format, taille, intégrité).
  const TAILLE_MAX_OCTETS = 25 * 1024 * 1024
  if (fichier.size === 0 || fichier.size > TAILLE_MAX_OCTETS) {
    return repondreCorpsInvalide('Fichier vide ou dépassant la taille maximale acceptée (25 Mo).')
  }

  const contenu = await fichier.arrayBuffer()
  const resultat = await depot.enregistrerFichierSource({
    dossierId,
    ownerId: user.id,
    roleDetecte: role as RoleSource,
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
      { id: resultat.id, role_detected: role as RoleSource, status: 'valid' },
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
    { fileId: resultat.id, role, nomOriginal: fichier.name },
    user.id,
  )

  return NextResponse.json({ success: true, fileId: resultat.id }, { status: 201 })
}
