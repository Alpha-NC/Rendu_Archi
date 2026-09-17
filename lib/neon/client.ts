import { neon } from '@neondatabase/serverless'

/**
 * Client Neon HTTP — sans état de session, contrairement au client Supabase
 * qu'il remplace (D-19, bascule) : une seule instance partagée suffit, la
 * défense en profondeur reste `verifierProprietaire` côté Route Handler.
 */
export const sql = neon(process.env.DATABASE_URL!)
