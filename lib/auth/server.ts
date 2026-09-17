import { createNeonAuth } from '@neondatabase/auth/next/server'

/**
 * Authentification individuelle (Neon Auth / Managed Better Auth) — remplace
 * Supabase Auth (D-19, bascule). Point d'entrée unique côté serveur : Route
 * Handlers, Server Actions, Server Components, proxy.ts (PRD §17).
 */
export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET!,
  },
})
