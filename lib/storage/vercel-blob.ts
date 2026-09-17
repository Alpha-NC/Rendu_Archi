import { del, get, put } from '@vercel/blob'

/**
 * Adaptateur de stockage Vercel Blob — cible PRD V2.1 §16.1/§16.4 (D-19).
 *
 * Statut : module additif, non encore branché sur `DepotDossiers`
 * (`lib/rif/depot.ts`) ni sur aucune Route Handler. Aucun fichier existant
 * modifié, aucun basculement effectué — Supabase Storage reste le
 * stockage réellement utilisé jusqu'à ce que `depot-neon.ts` (à écrire)
 * consomme ce module.
 *
 * Choix d'accès : chaque fichier est stocké en `access: 'private'`
 * (`@vercel/blob` ≥ 2.x le permet réellement — vérifié dans les types du
 * SDK avant d'écrire ce module, pas supposé). Un blob privé n'est jamais
 * atteignable par son URL seule : sa lecture exige le jeton serveur
 * (`BLOB_READ_WRITE_TOKEN`), jamais exposé au navigateur (PRD §18 :
 * « aucun secret de provider [...] exposé côté client »).
 *
 * Différence avec Supabase Storage à documenter pour depot-neon.ts :
 * Supabase fournit une URL signée à courte durée de vie que le navigateur
 * peut utiliser directement (`createSignedUrl`). `@vercel/blob` n'a pas
 * d'équivalent aussi direct pour une simple lecture authentifiée — la
 * primitive `presignUrl` existe mais suppose un jeton de délégation
 * (`issueSignedToken`), conçu pour l'upload direct depuis le navigateur,
 * pas pour une lecture ponctuelle. Servir un fichier au client passera
 * donc par une Route Handler authentifiée qui lit le blob ici
 * (`lireFichier`) et le retransmet (proxy) — jamais par une redirection
 * vers une URL Vercel. Décision d'architecture à trancher explicitement
 * quand `depot-neon.ts` sera écrit, pas prise ici.
 *
 * Chaque fonction est un fin wrapper testable : les tests mockent
 * `@vercel/blob` directement (`vi.mock`), pas d'injection de dépendance
 * ici — le SDK ne fait rien d'autre qu'un appel réseau, comme
 * `lib/fal/client.ts` pour ses parties non testées contre le réseau réel.
 */

export interface FichierTeleverse {
  pathname: string
  url: string
  contentType: string
}

/**
 * Téléverse un fichier en accès privé. `pathname` doit déjà être unique
 * (même discipline que `depot-supabase.ts` : rôle + horodatage, ou id de
 * génération) — `addRandomSuffix` est désactivé pour que le pathname
 * stocké en base corresponde exactement à celui retourné ici, sans
 * suffixe ajouté par le SDK qui romprait la correspondance.
 */
export async function televerserFichier(
  pathname: string,
  contenu: ArrayBuffer,
  mimeType: string,
): Promise<FichierTeleverse> {
  const resultat = await put(pathname, contenu, {
    access: 'private',
    contentType: mimeType,
    addRandomSuffix: false,
    allowOverwrite: false,
  })
  return { pathname: resultat.pathname, url: resultat.url, contentType: resultat.contentType }
}

/**
 * Lit un fichier privé — jamais résolu en URL utilisable par le
 * navigateur (voir note d'en-tête). Lève une erreur explicite si le
 * fichier est introuvable, jamais un résultat silencieusement vide.
 */
export async function lireFichier(pathname: string): Promise<{ contenu: ArrayBuffer; contentType: string }> {
  const resultat = await get(pathname, { access: 'private' })
  if (!resultat || resultat.statusCode !== 200) {
    throw new Error(`Fichier introuvable dans Vercel Blob : ${pathname}`)
  }
  const contenu = await new Response(resultat.stream).arrayBuffer()
  return { contenu, contentType: resultat.blob.contentType }
}

/** Supprime un fichier. Idempotent côté SDK (pas d'erreur si déjà absent). */
export async function supprimerFichier(pathname: string): Promise<void> {
  await del(pathname)
}
