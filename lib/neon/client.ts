import { neon } from '@neondatabase/serverless'

/**
 * Client Neon HTTP — sans état de session : une seule instance partagée
 * suffit, la défense en profondeur reste `verifierProprietaire` côté Route
 * Handler (D-19).
 */
export const sql = neon(process.env.DATABASE_URL!)
