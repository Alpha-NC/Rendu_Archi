import { NextResponse } from 'next/server'
import { FRAMEWORK_VERSION, IMPLEMENTATION_VERSION } from '@/lib/rif/versions'
import { authentifierRequete, obtenirDepot, repondreErreur } from './_lib/reponse'

/** GET /api/dossiers — liste les dossiers de l'utilisateur courant. */
export async function GET() {
  const { user, reponseRefus } = await authentifierRequete()
  if (reponseRefus) return reponseRefus

  const depot = obtenirDepot()
  const dossiers = await depot.listerDossiers(user.id)
  return NextResponse.json({ success: true, dossiers })
}

/** POST /api/dossiers — crée un nouveau dossier en BROUILLON. */
export async function POST(request: Request) {
  const { user, reponseRefus } = await authentifierRequete()
  if (reponseRefus) return reponseRefus

  const depot = obtenirDepot()
  try {
    let projectInfo: { name: string; type?: string; location?: string; description?: string } | undefined
    const texte = await request.text()
    if (texte) {
      let corps: Record<string, unknown>
      try {
        corps = JSON.parse(texte) as Record<string, unknown>
      } catch {
        return repondreErreur('corps_invalide', 'Corps de requête JSON invalide.', 400)
      }
      const name = typeof corps.name === 'string' ? corps.name.trim() : ''
      if (!name) return repondreErreur('corps_invalide', 'Le nom du projet est requis.', 400)
      const optional = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined)
      projectInfo = {
        name,
        type: optional(corps.type),
        location: optional(corps.location),
        description: optional(corps.description),
      }
    }
    const { id, dossierRef } = await depot.creerDossier({
      ownerId: user.id,
      frameworkVersion: FRAMEWORK_VERSION,
      implementationVersion: IMPLEMENTATION_VERSION,
      projectInfo,
    })
    return NextResponse.json({ success: true, id, dossierRef }, { status: 201 })
  } catch (erreur) {
    return repondreErreur('creation_impossible', erreur instanceof Error ? erreur.message : 'Erreur inconnue.', 500)
  }
}
