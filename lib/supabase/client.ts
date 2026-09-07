import { createBrowserClient } from '@supabase/ssr'

/**
 * Client Supabase côté navigateur. N'utilise que la clé anonyme (publique
 * par construction) — toute autorisation réelle est portée par la RLS,
 * jamais par ce client. Voir DECISIONS.md — D-03.
 */
export function creerClientNavigateur() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
