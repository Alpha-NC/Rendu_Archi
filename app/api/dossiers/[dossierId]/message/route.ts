import { creerAppelModele } from '@/lib/rif/claude-client'
import { genererEtAttendre } from '@/lib/fal/client'
import { executerTourConversationnel } from '@/lib/rif/orchestrateur-conversationnel'
import {
  authentifierRequete,
  obtenirDepot,
  repondreCorpsInvalide,
  repondreDossierIntrouvable,
  repondreErreur,
  verifierProprietaire,
} from '../../_lib/reponse'
import { NextResponse } from 'next/server'

/**
 * GET /api/dossiers/[dossierId]/message — historique persisté (PRD §13.5),
 * pour réafficher la conversation à l'ouverture de la page.
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

  const historique = await depot.obtenirHistoriqueConversation(dossierId)
  return NextResponse.json({ success: true, historique }, { status: 200 })
}

/**
 * POST /api/dossiers/[dossierId]/message — un tour de conversation.
 *
 * L'historique de conversation est persisté côté serveur (PRD §13.5,
 * lib/rif/depot.ts::MessageConversation) — voir la note en tête de
 * lib/rif/orchestrateur-conversationnel.ts pour le périmètre exact couvert
 * (pas encore de boucle multi-tour renvoyant le tool_result au modèle).
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

  const { message } = (corps as Record<string, unknown>) ?? {}
  if (typeof message !== 'string' || message.trim().length === 0) {
    return repondreCorpsInvalide('Le champ message (texte non vide) est requis.')
  }

  let appelerModele
  try {
    appelerModele = creerAppelModele()
  } catch (erreur) {
    return repondreErreur(
      'configuration_manquante',
      erreur instanceof Error ? erreur.message : 'Configuration du modèle indisponible.',
      500,
    )
  }

  const resultat = await executerTourConversationnel(depot, appelerModele, genererEtAttendre, {
    dossier,
    nouveauMessage: message,
    actorId: user.id,
  })

  return NextResponse.json({ success: true, tour: resultat }, { status: 200 })
}
