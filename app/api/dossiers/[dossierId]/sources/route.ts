import { NextResponse } from 'next/server'
import { creerClassifieurDirectives, interpreterDirectives } from '@/lib/rif/detection-directives'
import { creerClassifieurRole, interpreterDetection, type ImageSource } from '@/lib/rif/detection-role'
import { lireFichier, supprimerFichier } from '@/lib/storage/vercel-blob'
import { MIME_SOURCES_ACCEPTEES, TAILLE_SOURCE_MAX_OCTETS, validerPathnameSource } from '@/lib/storage/contraintes-source'
import type { RoleSource } from '@/lib/rif/project-state'
import { estRolePrincipal } from '@/lib/rif/sources'
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
 * PRD V2.1 §16.1 (D-19) : le fichier a déjà été téléversé directement du
 * navigateur vers Vercel Blob (`./token/route.ts` a émis le jeton) — les
 * Vercel Functions limitent le corps d'une requête à 4,5 Mo, incompatible
 * avec des exports Revit ou rendus réels. Cette route ne reçoit plus qu'un
 * petit JSON de métadonnées ; le contenu est relu depuis Blob (`lireFichier`)
 * pour la détection de rôle, qui a besoin des octets réels de l'image.
 *
 * Le rôle est détecté automatiquement depuis le contenu de l'image
 * (`lib/rif/detection-role.ts`) : le slot où l'utilisateur dépose le fichier
 * n'est plus qu'un indice (`role`, optionnel), jamais une autorité — un
 * désaccord entre l'indice et la détection vaut ambiguïté, jamais un
 * tranchage silencieux en faveur de l'un des deux.
 *
 * Lot 2 Source Lifecycle (D-23) : si le rôle effectif est PRINCIPAL (vue
 * projet, photo réelle, axonométrie — `lib/rif/sources.ts::ROLES_PRINCIPAUX`)
 * et qu'une version active existe déjà, ce dépôt devient un REMPLACEMENT
 * versionné (`depot.remplacerFichierSource`) plutôt qu'un doublon —
 * l'ancienne version reste en base au statut `replaced`, jamais supprimée.
 */
export async function POST(request: Request, { params }: { params: Promise<{ dossierId: string }> }) {
  const { dossierId } = await params
  const { user, reponseRefus } = await authentifierRequete()
  if (reponseRefus) return reponseRefus

  const depot = obtenirDepot()
  const dossier = await depot.obtenirDossier(dossierId)
  if (!dossier) {
    return NextResponse.json(
      { success: false, error: { code: 'dossier_introuvable', message: 'Dossier introuvable.' } },
      { status: 404 },
    )
  }
  const refusProprietaire = verifierProprietaire(dossier.ownerId, user.id)
  if (refusProprietaire) return refusProprietaire

  let corps: unknown
  try {
    corps = await request.json()
  } catch {
    return repondreCorpsInvalide('Corps de requête JSON attendu.')
  }

  const { pathname, originalName, role: roleIndice } = (corps as Record<string, unknown>) ?? {}
  if (typeof pathname !== 'string' || typeof originalName !== 'string') {
    return repondreCorpsInvalide('Les champs pathname et originalName (texte) sont requis.')
  }
  // Même contrôle que ./token/route.ts — un pathname d'un autre dossier ne
  // doit jamais pouvoir être rattaché à celui-ci.
  try {
    validerPathnameSource(pathname, dossierId)
  } catch {
    return repondreCorpsInvalide('Le fichier déposé ne correspond pas à ce dossier.')
  }
  if (roleIndice !== undefined && roleIndice !== null && (typeof roleIndice !== 'string' || !ROLES_ACCEPTES.includes(roleIndice as RoleSource))) {
    return repondreCorpsInvalide(`Le champ role, s'il est fourni, doit être l'un de : ${ROLES_ACCEPTES.join(', ')}.`)
  }

  let contenu: ArrayBuffer
  let contentType: string
  try {
    const fichier = await lireFichier(pathname)
    contenu = fichier.contenu
    contentType = fichier.contentType
  } catch (erreur) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'stockage_echec', message: erreur instanceof Error ? erreur.message : 'Fichier introuvable dans le stockage.' },
      },
      { status: 502 },
    )
  }

  // Type et taille réels (Vercel Blob), jamais la déclaration du client —
  // le jeton d'upload les contraignait déjà, ceci est la défense en
  // profondeur côté lecture.
  if (!(MIME_SOURCES_ACCEPTEES as readonly string[]).includes(contentType)) {
    await supprimerFichier(pathname)
    return repondreCorpsInvalide(
      `Format non pris en charge pour la détection automatique du rôle : ${contentType || 'inconnu'}. Formats acceptés : ${MIME_SOURCES_ACCEPTEES.join(', ')}.`,
    )
  }
  if (contenu.byteLength === 0 || contenu.byteLength > TAILLE_SOURCE_MAX_OCTETS) {
    await supprimerFichier(pathname)
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

  let detection
  try {
    detection = await classifieurRole(
      { base64: Buffer.from(contenu).toString('base64'), mimeType: contentType as ImageSource['mimeType'] },
      originalName,
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

  // Lot 2 Source Lifecycle (D-23) : un rôle PRINCIPAL (vue projet, photo
  // réelle, axonométrie) déjà actif n'est plus dupliqué silencieusement —
  // un nouveau dépôt du même rôle devient un remplacement versionné.
  // `model_3d` ne passe jamais par cette route (voir .../modele-3d) ; les
  // autres rôles (référence matériau, source annotée...) restent
  // multi-valués, jamais concernés par ce remplacement.
  const roleEffectif = role_confirmed ?? role_detected
  const sourceActive = estRolePrincipal(roleEffectif)
    ? await depot.obtenirSourceActivePourRole(dossierId, roleEffectif)
    : null

  let resultat: { id: string; storageKey: string }
  try {
    resultat = sourceActive
      ? await depot.remplacerFichierSource({
          dossierId,
          ancienFileId: sourceActive.id,
          roleDetecte: role_detected,
          originalName,
          storageKey: pathname,
          mimeType: contentType,
          sizeBytes: contenu.byteLength,
        })
      : await depot.enregistrerFichierSource({
          dossierId,
          roleDetecte: role_detected,
          originalName,
          storageKey: pathname,
          mimeType: contentType,
          sizeBytes: contenu.byteLength,
        })
  } catch (erreur) {
    // Le blob existe déjà dans le stockage mais aucune ligne `files` ne le
    // référence — orphelin nettoyé plutôt que laissé facturé sans usage.
    await supprimerFichier(pathname)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'persistance_echec', message: erreur instanceof Error ? erreur.message : 'Enregistrement de la source impossible.' },
      },
      { status: 500 },
    )
  }

  // ADR-015, PRD §9.2 : une source annotée est convertie en directives
  // localisées structurées — jamais transmise brute au moteur d'image. Ne
  // bloque jamais le dépôt : si l'extraction échoue, l'annotation reste
  // exploitable manuellement via la conversation.
  let directivesExtraites: ReturnType<typeof interpreterDirectives> = []
  if (role_detected === 'annotated_source' || role_detected === 'annotated_render') {
    try {
      const classifieurDirectives = creerClassifieurDirectives()
      const detections = await classifieurDirectives({
        base64: Buffer.from(contenu).toString('base64'),
        mimeType: contentType as ImageSource['mimeType'],
      })
      directivesExtraites = interpreterDirectives(detections, resultat.id)
    } catch (erreur) {
      await depot.journaliserEvenement(
        dossierId,
        'extraction_directives_echec',
        { fileId: resultat.id, message: erreur instanceof Error ? erreur.message : 'erreur inconnue' },
        user.id,
      )
    }
  }

  // Le fichier existe dans le stockage/la table `files`, mais tant qu'il
  // n'apparaît pas dans project_state.sources, ni la conversation ni
  // l'interface ne savent qu'il a été déposé (PRD §10). Remplacement :
  // l'ancienne entrée du même rôle principal est retirée, jamais laissée à
  // côté de la nouvelle (une seule entrée par rôle principal, comme en base).
  const sourcesConservees = sourceActive
    ? dossier.projectState.sources.filter((s) => s.id !== sourceActive.id)
    : dossier.projectState.sources
  await depot.mettreAJourProjectState(dossierId, {
    ...dossier.projectState,
    sources: [
      ...sourcesConservees,
      { id: resultat.id, role_detected, ...(role_confirmed ? { role_confirmed } : {}), status: 'valid' },
    ],
    localized_directives: [...dossier.projectState.localized_directives, ...directivesExtraites],
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
    sourceActive ? 'source_remplacee' : 'source_deposee',
    {
      fileId: resultat.id,
      ancienFileId: sourceActive?.id,
      roleDetecte: role_detected,
      roleIndice,
      ambigu,
      nomOriginal: originalName,
      directivesExtraites: directivesExtraites.length,
    },
    user.id,
  )

  return NextResponse.json(
    { success: true, fileId: resultat.id, role: role_detected, ambigu, remplace: Boolean(sourceActive) },
    { status: 201 },
  )
}
