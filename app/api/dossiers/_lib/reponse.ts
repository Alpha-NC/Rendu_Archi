import { NextResponse } from 'next/server'
import { creerClientServeur } from '@/lib/supabase/server'
import { creerDepotSupabase } from '@/lib/rif/depot-supabase'
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
  const supabase = await creerClientServeur()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      user: null,
      supabase,
      reponseRefus: NextResponse.json(
        { success: false, error: { code: 'non_authentifie', message: 'Authentification requise.' } },
        { status: 401 },
      ),
    }
  }

  return { user, supabase, reponseRefus: null }
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
      { success: false, error: { code: 'acces_refuse', message: "Ce dossier n'appartient pas à cet utilisateur." } },
      { status: 403 },
    )
  }
  return null
}

export function obtenirDepot(supabase: Awaited<ReturnType<typeof creerClientServeur>>) {
  return creerDepotSupabase(supabase)
}

const STATUT_PAR_CODE: Record<string, number> = {
  dossier_introuvable: 404,
  transition_refusee: 409,
  fal_ai_echec: 502,
  reponse_inexploitable: 502,
  stockage_echec: 502,
  timeout: 504,
  generation_echouee: 422,
}

/** Traduit un ResultatOperation en réponse HTTP, sans jamais renvoyer 200 sur un success:false. */
export function repondreOperation(resultat: ResultatOperation) {
  if (resultat.success) return NextResponse.json(resultat, { status: 200 })
  const statut = STATUT_PAR_CODE[resultat.error?.code ?? ''] ?? 500
  return NextResponse.json(resultat, { status: statut })
}

export function repondreCorpsInvalide(message: string) {
  return NextResponse.json(
    { success: false, error: { code: 'corps_invalide', message } },
    { status: 400 },
  )
}
