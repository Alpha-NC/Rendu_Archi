import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

/**
 * Client Supabase côté serveur (Route Handlers, Server Actions, Server
 * Components). Utilise les cookies de session — jamais la clé service_role
 * ici : ce client respecte la RLS comme un utilisateur normal.
 *
 * Voir rif-framework/Implementations/RIF-App/DECISIONS.md — D-03.
 */
export async function creerClientServeur() {
  const magasinCookies = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return magasinCookies.getAll()
        },
        setAll(cookiesASetter) {
          try {
            for (const { name, value, options } of cookiesASetter) {
              magasinCookies.set(name, value, options)
            }
          } catch {
            // Appelé depuis un Server Component : le rafraîchissement de
            // session est alors géré par le middleware. Ignorer.
          }
        },
      },
    },
  )
}

/**
 * Client Supabase avec la clé service_role — contourne la RLS. Réservé aux
 * opérations serveur qui doivent agir hors du contexte d'un utilisateur
 * précis (ex. jobs de fond, contrôles de supervision transverses).
 *
 * Ne jamais importer ce module depuis un composant ou une route accessible
 * indirectement par une entrée utilisateur non validée. La clé associée
 * (SUPABASE_SERVICE_ROLE_KEY) doit être définie uniquement dans les secrets
 * serveur — jamais préfixée NEXT_PUBLIC_, jamais dans ce dépôt.
 */
export function creerClientServiceRole() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
