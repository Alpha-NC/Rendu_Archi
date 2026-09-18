import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/server'
import { sql } from '@/lib/neon/client'
import { creerDepotNeon } from '@/lib/rif/depot-neon'
import type { ResultatOperation } from '@/lib/rif/orchestrateur'

/**
 * Utilitaires communs aux trois routes d'opérations (PRD §14). Regroupés ici
 * pour que les trois Route Handlers restent de simples adaptateurs HTTP
 * autour de lib/rif/orchestrateur.ts — toute la logique métier reste dans un
 * module framework-agnostique, testé sans Next.js.
 */

/**
 * Authentifie la requête. PRD §17 : authentification individuelle
 * obligatoire avant tout dossier réel — jamais de mot de passe partagé.
 */
export async function authentifierRequete() {
  const { data: session } = await auth.getSession()

  if (!session?.user) {
    return {
      user: null,
      reponseRefus: NextResponse.json(
        { success: false, error: { code: 'non_authentifie', message: 'Authentification requise.' }, requestId: randomUUID() },
        { status: 401 },
      ),
    }
  }

  return { user: session.user, reponseRefus: null }
}

/**
 * Vérifie que l'utilisateur authentifié est bien le propriétaire du
 * dossier — défense en profondeur (PRD §17) en plus de la RLS : un compte
 * de supervision (Alpha_no_code) a un accès en LECTURE via RLS
 * (DECISIONS.md D-03) mais ne doit pas pouvoir déclencher ces opérations à
 * la place du propriétaire.
 */
export function verifierProprietaire(ownerId: string, userId: string) {
  if (ownerId !== userId) {
    return NextResponse.json(
      { success: false, error: { code: 'acces_refuse', message: "Ce dossier n'appartient pas à cet utilisateur." }, requestId: randomUUID() },
      { status: 403 },
    )
  }
  return null
}

/**
 * Défense en profondeur (Chantier F, backend-completion) : un `generationId`
 * est un identifiant global, pas scopé à un dossier — sans ce contrôle, un
 * propriétaire du dossier A pourrait référencer une génération du dossier B
 * (audit, comparaison, canonicalisation). Même 404 que « génération
 * inexistante » — ne révèle jamais qu'un identifiant existe ailleurs.
 * Prend le `dossierId` DE LA GÉNÉRATION (pas la génération entière), pour
 * que l'appelant garde le contrôle du narrowing TypeScript sur son `null`.
 */
export function verifierGenerationDuDossier(generationDossierId: string, dossierId: string) {
  if (generationDossierId !== dossierId) {
    return repondreErreur('generation_introuvable', 'Génération introuvable dans ce dossier.', 404)
  }
  return null
}

/**
 * Même défense en profondeur que `verifierGenerationDuDossier`, pour les
 * cibles de rendu (Lot 1 RenderTarget, D-22) : un `renderTargetId` est un
 * identifiant global — sans ce contrôle, le propriétaire du dossier A
 * pourrait référencer une cible du dossier B.
 */
export function verifierRenderTargetDuDossier(renderTargetDossierId: string, dossierId: string) {
  if (renderTargetDossierId !== dossierId) {
    return repondreErreur('cible_introuvable', 'Cible de rendu introuvable dans ce dossier.', 404)
  }
  return null
}

export function obtenirDepot() {
  return creerDepotNeon(sql)
}

const STATUT_PAR_CODE: Record<string, number> = {
  dossier_introuvable: 404,
  generation_introuvable: 404,
  transition_refusee: 409,
  fal_ai_echec: 502,
  reponse_inexploitable: 502,
  stockage_echec: 502,
  timeout: 504,
  generation_echouee: 422,
  // Lot 1 RenderTarget (D-22) : renderTargetId fourni mais introuvable ou
  // n'appartenant pas à ce dossier — erreur de requête, pas un conflit d'état.
  cible_invalide: 400,
}

/** Traduit un ResultatOperation en réponse HTTP, sans jamais renvoyer 200 sur un success:false. */
export function repondreOperation(resultat: ResultatOperation) {
  if (resultat.success) return NextResponse.json(resultat, { status: 200 })
  const statut = STATUT_PAR_CODE[resultat.error?.code ?? ''] ?? 500
  return NextResponse.json({ ...resultat, requestId: randomUUID() }, { status: statut })
}

export function repondreCorpsInvalide(message: string) {
  return NextResponse.json(
    { success: false, error: { code: 'corps_invalide', message }, requestId: randomUUID() },
    { status: 400 },
  )
}

/** Erreur générique standardisée (Chantier I) — {success:false, error:{code,message}, requestId}. */
export function repondreErreur(code: string, message: string, status: number) {
  return NextResponse.json({ success: false, error: { code, message }, requestId: randomUUID() }, { status })
}

export function repondreDossierIntrouvable() {
  return repondreErreur('dossier_introuvable', 'Dossier introuvable.', 404)
}
