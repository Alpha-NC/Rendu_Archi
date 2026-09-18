import { del, get, issueSignedToken, presignUrl, put } from '@vercel/blob'

/**
 * Adaptateur de stockage Vercel Blob — cible PRD V2.1 §16.1/§16.4 (D-19).
 * Stockage réellement actif depuis la bascule Neon, consommé par
 * `lib/rif/depot-neon.ts`.
 *
 * Choix d'accès : chaque fichier est stocké en `access: 'private'`
 * (`@vercel/blob` ≥ 2.x le permet réellement — vérifié dans les types du
 * SDK avant d'écrire ce module, pas supposé). Un blob privé n'est jamais
 * atteignable par son URL seule : sa lecture exige le jeton serveur
 * (`BLOB_READ_WRITE_TOKEN`), jamais exposé au navigateur (PRD §18 :
 * « aucun secret de provider [...] exposé côté client »).
 *
 * Chaque fonction est un fin wrapper testable : les tests mockent
 * `@vercel/blob` directement (`vi.mock`), pas d'injection de dépendance
 * ici — le SDK ne fait rien d'autre qu'un appel réseau, comme
 * `lib/fal/client.ts` pour ses parties non testées contre le réseau réel.
 */

/**
 * Lot 2 Source Lifecycle (D-23) — diagnostic du bug observé localement :
 * `POST .../sources/token` répondait 400, le navigateur n'affichant que
 * « Vercel Blob: Failed to retrieve the client token » (message générique
 * du SDK client — `@vercel/blob/dist/client.js` le lève dès que la réponse
 * HTTP n'est pas `ok`, quel que soit le corps JSON réellement renvoyé ;
 * notre message d'erreur détaillé n'atteint donc jamais le navigateur par
 * ce chemin). Cause racine confirmée : `BLOB_READ_WRITE_TOKEN` absent ou
 * vide fait échouer `handleUpload` en interne (`readEnv` du SDK traite une
 * chaîne vide comme absente). Cette fonction rend cette cause explicite et
 * loggable AVANT d'appeler `handleUpload`, pour que le serveur journalise
 * clairement « configuration manquante » plutôt qu'une erreur SDK opaque —
 * appelée par chaque route `.../token` (sources, modele-3d, temporary-assets).
 */
export function verifierBlobConfigure(): void {
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN absent ou vide dans l'environnement serveur — impossible d'émettre un jeton d'upload Vercel Blob.",
    )
  }
}

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

/**
 * URL de lecture temporaire pour un blob privé, valable `dureeSecondes`,
 * vérifiée par le CDN sans jeton porteur — utilisable directement par le
 * navigateur, ou transmise à un fournisseur externe (fal.ai, API Anthropic)
 * qui doit pouvoir récupérer l'image sans connaître notre jeton serveur.
 *
 * Composition en deux appels (`issueSignedToken` puis `presignUrl`), tous
 * deux authentifiés par `BLOB_READ_WRITE_TOKEN` côté serveur — jamais
 * exposés au client.
 */
export async function resolverUrlSignee(pathname: string, dureeSecondes: number): Promise<string> {
  const validUntil = Date.now() + dureeSecondes * 1000
  const { clientSigningToken, delegationToken } = await issueSignedToken({ pathname, operations: ['get'], validUntil })
  const { presignedUrl } = await presignUrl(
    { clientSigningToken, delegationToken },
    { operation: 'get', pathname, validUntil, access: 'private' },
  )
  return presignedUrl
}
