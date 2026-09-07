import { creerAppelModele } from '@/lib/rif/claude-client'
import { genererEtAttendre } from '@/lib/fal/client'
import { executerTourConversationnel, type MessageConversation } from '@/lib/rif/orchestrateur-conversationnel'
import {
  authentifierRequete,
  obtenirDepot,
  repondreCorpsInvalide,
  verifierProprietaire,
} from '../../_lib/reponse'
import { NextResponse } from 'next/server'

/**
 * POST /api/dossiers/[dossierId]/message — un tour de conversation.
 *
 * L'historique de conversation n'est pas encore persisté côté serveur
 * (PRD §13.5 : « peut être stocké séparément », conception restant à
 * faire) — le client transmet l'historique à chaque appel. Cette route
 * n'est donc qu'un tour isolé, pas encore une session conversationnelle
 * complète ; voir la note en tête de lib/rif/orchestrateur-conversationnel.ts
 * pour le périmètre exact couvert.
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

  let corps: unknown
  try {
    corps = await request.json()
  } catch {
    return repondreCorpsInvalide('Corps de requête JSON attendu.')
  }

  const { message, historique } = (corps as Record<string, unknown>) ?? {}
  if (typeof message !== 'string' || message.trim().length === 0) {
    return repondreCorpsInvalide('Le champ message (texte non vide) est requis.')
  }
  const historiqueValide: MessageConversation[] = Array.isArray(historique) ? historique : []

  let appelerModele
  try {
    appelerModele = creerAppelModele()
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

  const resultat = await executerTourConversationnel(depot, appelerModele, genererEtAttendre, {
    dossier,
    historique: historiqueValide,
    nouveauMessage: message,
    actorId: user.id,
  })

  return NextResponse.json({ success: true, tour: resultat }, { status: 200 })
}
