import { NextResponse } from 'next/server'
import { creerDepotSupabase } from '@/lib/rif/depot-supabase'
import { FRAMEWORK_VERSION, IMPLEMENTATION_VERSION } from '@/lib/rif/versions'
import { authentifierRequete } from './_lib/reponse'

/** GET /api/dossiers — liste les dossiers de l'utilisateur courant. */
export async function GET() {
  const { user, supabase, reponseRefus } = await authentifierRequete()
  if (reponseRefus) return reponseRefus

  const depot = creerDepotSupabase(supabase)
  const dossiers = await depot.listerDossiers(user.id)
  return NextResponse.json({ success: true, dossiers })
}

/** POST /api/dossiers — crée un nouveau dossier en BROUILLON. */
export async function POST() {
  const { user, supabase, reponseRefus } = await authentifierRequete()
  if (reponseRefus) return reponseRefus

  const depot = creerDepotSupabase(supabase)
  try {
    const { id, dossierRef } = await depot.creerDossier({
      ownerId: user.id,
      frameworkVersion: FRAMEWORK_VERSION,
      implementationVersion: IMPLEMENTATION_VERSION,
    })
    return NextResponse.json({ success: true, id, dossierRef }, { status: 201 })
  } catch (erreur) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'creation_impossible', message: erreur instanceof Error ? erreur.message : 'Erreur inconnue.' },
      },
      { status: 500 },
    )
  }
}
