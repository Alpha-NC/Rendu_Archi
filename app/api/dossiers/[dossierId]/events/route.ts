import { NextResponse } from 'next/server'
import { libelleEvenement } from '@/lib/rif/events'
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

  // Références distinctes présentes sur cette seule page — jamais toutes
  // les cibles/générations/sources du dossier, pour rester une lecture
  // légère (mission §11 : « sans duplication excessive »).
  const renderTargetIds = [...new Set(events.map((e) => e.renderTargetId).filter((id): id is string => !!id))]
  const generationIds = [...new Set(events.map((e) => e.generationId).filter((id): id is string => !!id))]
  const sourceIds = [...new Set(events.map((e) => e.sourceId).filter((id): id is string => !!id))]

  const [renderTargets, generations, sources] = await Promise.all([
    Promise.all(renderTargetIds.map((id) => depot.obtenirRenderTarget(id))),
    Promise.all(generationIds.map((id) => depot.obtenirGeneration(id))),
    Promise.all(sourceIds.map((id) => depot.obtenirFichierSource(id))),
  ])
  const renderTargetParId = new Map(renderTargets.filter((r) => r).map((r) => [r!.id, r!]))
  const generationParId = new Map(generations.filter((g) => g).map((g) => [g!.id, g!]))
  const sourceParId = new Map(sources.filter((s) => s).map((s) => [s!.id, s!]))

  const evenementsEnrichis = events.map((evenement) => ({
    ...evenement,
    label: libelleEvenement(evenement),
    renderTarget: evenement.renderTargetId
      ? (() => {
          const cible = renderTargetParId.get(evenement.renderTargetId)
          return cible ? { id: cible.id, name: cible.name, outputType: cible.outputType } : null
        })()
      : null,
    generation: evenement.generationId
      ? (() => {
          const generation = generationParId.get(evenement.generationId)
          return generation ? { id: generation.id, type: generation.type, status: generation.status } : null
        })()
      : null,
    source: evenement.sourceId
      ? (() => {
          const source = sourceParId.get(evenement.sourceId)
          return source ? { id: source.id, role: source.roleConfirmed ?? source.roleDetected, version: source.version } : null
        })()
      : null,
  }))

  return NextResponse.json({ success: true, events: evenementsEnrichis, nextCursor })
}
