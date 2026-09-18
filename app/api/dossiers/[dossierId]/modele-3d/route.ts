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
 * POST /api/dossiers/[dossierId]/modele-3d — dépose la source géométrique
 * 3D (RIF V2, geometry-first, DECISIONS.md ADR-021). Contrairement à
 * `.../sources`, aucune classification automatique n'est appelée : ce
 * n'est pas une image (`detection-role.ts` ne s'applique pas), et le rôle
 * n'est pas ambigu — l'utilisateur dépose explicitement dans le slot
 * « Modèle 3D ». Le fichier est déjà dans Vercel Blob quand cette route
 * est appelée (`.../modele-3d/token` a émis le jeton).
 *
 * Ne lance PAS l'extraction ici — seulement l'enregistrement du dépôt, au
 * statut `UPLOADED`. L'extraction réelle dépend d'un fournisseur qui n'est
 * pas encore choisi (voir lib/rif/geometrie-3d.ts::creerExtracteurNonConfigure).
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

  let corps: unknown
  try {
    corps = await request.json()
  } catch {
    return repondreCorpsInvalide('Corps de requête JSON attendu.')
  }

  const { pathname, originalName, format, sizeBytes } = (corps as Record<string, unknown>) ?? {}
  if (typeof pathname !== 'string' || typeof originalName !== 'string') {
    return repondreCorpsInvalide('Les champs pathname et originalName (texte) sont requis.')
  }
  if (typeof format !== 'string' || format.trim().length === 0) {
    return repondreCorpsInvalide('Le champ format (texte non vide — ex. "rvt", "ifc") est requis : le format 3D définitif reste à confirmer, mais un fichier sans format déclaré ne peut pas être exploité plus tard.')
  }
  try {
    validerPathnameModele3D(pathname, dossierId)
  } catch {
    return repondreCorpsInvalide('Le fichier déposé ne correspond pas à ce dossier.')
  }

  const resultat = await depot.enregistrerFichierSource({
    dossierId,
    roleDetecte: 'model_3d',
    originalName,
    storageKey: pathname,
    mimeType: 'application/octet-stream',
    // Déclaré par le client (taille déjà connue avant upload, File.size) —
    // même confiance que originalName, jamais revérifié depuis le blob ici
    // (fichier potentiellement volumineux, pas de relecture systématique).
    sizeBytes: typeof sizeBytes === 'number' && sizeBytes >= 0 ? sizeBytes : 0,
  })

  const source3D = creerSourceModele3D(resultat.id, format)
  await depot.mettreAJourProjectState(dossierId, { ...dossier.projectState, modele3D: source3D })
  await depot.journaliserEvenement(dossierId, 'modele_3d_depose', { fileId: resultat.id, format }, user.id)

  return NextResponse.json({ success: true, fileId: resultat.id, source: source3D })
}
