import { NextResponse } from 'next/server'
import { enrichirEvenements } from '@/lib/rif/events'
import {
  authentifierRequete,
  obtenirDepot,
  repondreDossierIntrouvable,
  verifierProprietaire,
} from '../../_lib/reponse'

/**
 * GET /api/dossiers/[dossierId]/events — timeline / audit trail (Lot 3
 * Project History, DECISIONS.md D-24). Lecture paginée de la table `events`
 * (append-only, PRD §13.5/§18) — cette route n'écrit jamais dedans.
 *
 * Tri du plus récent au plus ancien (mission Lot 3 §7) — cohérent avec la
 * façon dont l'historique des générations (`.../generations`) et la liste
 * des dossiers sont déjà présentés.
 *
 * Enrichissement (§11) : fait ici, à la lecture, jamais en dupliquant la
 * donnée dans `events` elle-même — un événement qui référence une cible de
 * rendu/génération/source disparue reste affichable (référence `null`),
 * jamais une erreur.
 */
export async function GET(request: Request, { params }: { params: Promise<{ dossierId: string }> }) {
  const { dossierId } = await params
  const { user, reponseRefus } = await authentifierRequete()
  if (reponseRefus) return reponseRefus

  const depot = obtenirDepot()
  const dossier = await depot.obtenirDossier(dossierId)
  if (!dossier) return repondreDossierIntrouvable()
  const refusProprietaire = verifierProprietaire(dossier.ownerId, user.id)
  if (refusProprietaire) return refusProprietaire

  const url = new URL(request.url)
  const eventType = url.searchParams.get('type') ?? undefined
  const renderTargetId = url.searchParams.get('renderTargetId') ?? undefined
  const generationId = url.searchParams.get('generationId') ?? undefined
  const curseur = url.searchParams.get('cursor') ?? undefined
  const limiteBrute = Number(url.searchParams.get('limit'))
  const limite = Number.isFinite(limiteBrute) && limiteBrute > 0 ? limiteBrute : undefined

  const { events, nextCursor } = await depot.listerEvenements(dossierId, {
    eventType,
    renderTargetId,
    generationId,
    curseur,
    limite,
  })

  // Enrichissement partagé avec la première page (page.tsx) — Lot 5 : une
  // seule implémentation pour ne jamais laisser une page de la timeline
  // afficher des UUID bruts pendant qu'une autre affiche des noms lisibles.
  const evenementsEnrichis = await enrichirEvenements(depot, events)

  return NextResponse.json({ success: true, events: evenementsEnrichis, nextCursor })
}
