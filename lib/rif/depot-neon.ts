import type { NeonQueryFunction } from '@neondatabase/serverless'
import { resolverUrlSignee, televerserFichier } from '../storage/vercel-blob'
import type {
  DepotDossiers,
  DossierActuel,
  MessageConversation,
  ParametresAuditQualite,
  ParametresFichierResultat,
  ParametresFichierSource,
  ParametresNouveauDossier,
  ParametresNouvelleGeneration,
  PatchGeneration,
} from './depot'
import { creerProjectStateVide } from './project-state'
import type { EtatDossier } from './etat-machine'

/**
 * Implémentation Neon PostgreSQL de DepotDossiers (schéma :
 * neon/migrations/) — cible PRD V2.1 §16 (D-19). Backend réellement actif
 * depuis la bascule du 17.09.2026 (`app/api/dossiers/_lib/reponse.ts::obtenirDepot`).
 *
 * `ownerId`/`actorId`/`validatedBy` viennent de Neon Auth
 * (`lib/auth/server.ts`), traités ici comme de simples identifiants opaques.
 *
 * Non testée contre un projet Neon réel dans cette suite — la logique
 * métier qui compte est testée indépendamment dans orchestrateur.test.ts via
 * un dépôt en mémoire ; ce fichier n'est que la traduction SQL/Blob de
 * l'interface. Seul le contrat d'ordonnancement de `resolverUrlsSignees`
 * (une source de bug classique avec `= any(...)`, qui ne garantit aucun
 * ordre de retour) est testé ici (depot-neon.test.ts).
 *
 * Fichiers : chaque opération de stockage passe par
 * lib/storage/vercel-blob.ts, jamais par un accès direct à `@vercel/blob`
 * ici.
 */

const URL_SIGNEE_DUREE_SECONDES = 300

type Sql = NeonQueryFunction<false, false>

export function creerDepotNeon(sql: Sql): DepotDossiers {
  return {
    async creerDossier(params: ParametresNouveauDossier) {
      const dossierRef = `RIF-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random()
        .toString(36)
        .slice(2, 6)
        .toUpperCase()}`

      const lignes = await sql`
        insert into dossiers (owner_id, dossier_ref, workflow_state, project_state, project_state_revision, framework_version, implementation_version)
        values (${params.ownerId}, ${dossierRef}, 'BROUILLON', ${JSON.stringify(creerProjectStateVide('temp'))}::jsonb, 0, ${params.frameworkVersion}, ${params.implementationVersion})
        returning id
      `
      const id = lignes[0]?.id as string | undefined
      if (!id) throw new Error('Création du dossier impossible.')

      // project_id posé après coup, une fois l'id réel du dossier connu —
      // creerProjectStateVide a besoin d'un identifiant que l'insertion
      // seule peut fournir.
      await sql`update dossiers set project_state = ${JSON.stringify(creerProjectStateVide(id))}::jsonb where id = ${id}`

      return { id, dossierRef }
    },

    async listerDossiers(ownerId) {
      const lignes = await sql`
        select id, dossier_ref, workflow_state from dossiers
        where owner_id = ${ownerId}
        order by created_at desc
      `
      return lignes.map((d) => ({
        id: d.id as string,
        dossierRef: d.dossier_ref as string,
        etat: d.workflow_state as EtatDossier,
      }))
    },

    async obtenirDossier(dossierId): Promise<DossierActuel | null> {
      const lignes = await sql`
        select id, dossier_ref, owner_id, workflow_state, project_state from dossiers where id = ${dossierId}
      `
      const data = lignes[0]
      if (!data) return null

      const projectState = data.project_state as DossierActuel['projectState']
      return {
        id: data.id as string,
        dossierRef: data.dossier_ref as string,
        ownerId: data.owner_id as string,
        etat: data.workflow_state as EtatDossier,
        projectState,
        // PRD §10 : absence du champ 'usage' = traité comme administratif
        // par prudence (jamais l'inverse).
        usageAdministratif:
          !Array.isArray(projectState?.usage) || projectState.usage.includes('insertion_administrative'),
      }
    },

    async mettreAJourProjectState(dossierId, projectState) {
      await sql`
        update dossiers set project_state = ${JSON.stringify(projectState)}::jsonb, updated_at = now()
        where id = ${dossierId}
      `
    },

    async resolverUrlsSignees(fileIds) {
      if (fileIds.length === 0) return []

      const lignes = await sql`select id, storage_key from files where id = any(${fileIds})`

      // `any(...)` ne garantit AUCUN ordre de retour : on réordonne sur
      // fileIds plutôt que de faire confiance à l'ordre de la base.
      const clesParId = new Map(lignes.map((f) => [f.id as string, f.storage_key as string]))

      return await Promise.all(
        fileIds.map(async (fileId) => {
          const storageKey = clesParId.get(fileId)
          if (!storageKey) throw new Error(`Fichier ${fileId} introuvable.`)
          return resolverUrlSignee(storageKey, URL_SIGNEE_DUREE_SECONDES)
        }),
      )
    },

    async creerGeneration(params: ParametresNouvelleGeneration) {
      const lignes = await sql`
        insert into generations (dossier_id, type, status, project_state_revision, prompt_text, source_file_ids)
        values (${params.dossierId}, ${params.type}, 'queued', ${params.projectStateRevision}, ${params.promptText}, ${JSON.stringify(params.sourceFileIds)}::jsonb)
        returning id
      `
      const id = lignes[0]?.id as string | undefined
      if (!id) throw new Error('Création de la ligne generations impossible.')
      return { id }
    },

    async mettreAJourGeneration(generationId, patch: PatchGeneration) {
      await sql`
        update generations set
          status = ${patch.status},
          result_file_id = ${patch.resultFileId ?? null},
          provider_request_id = ${patch.providerRequestId ?? null},
          cost_actual = ${patch.costActual ?? null},
          completed_at = ${patch.completedAt}
        where id = ${generationId}
      `
    },

    async enregistrerFichierResultat(params: ParametresFichierResultat) {
      const extension = params.mimeType === 'image/png' ? 'png' : 'jpg'
      const storageKey = `${params.ownerId}/${params.dossierId}/generations/${params.generationId}.${extension}`
      const nom = `generation-${params.generationId}.${extension}`

      await televerserFichier(storageKey, params.contenu, params.mimeType)

      const lignes = await sql`
        insert into files (dossier_id, role_detected, role_confirmed, original_name, safe_name, storage_key, mime_type, size_bytes)
        values (${params.dossierId}, 'render', 'render', ${nom}, ${nom}, ${storageKey}, ${params.mimeType}, ${params.contenu.byteLength})
        returning id
      `
      const id = lignes[0]?.id as string | undefined
      if (!id) throw new Error('Enregistrement du fichier résultat impossible.')
      return { id }
    },

    async enregistrerFichierSource(params: ParametresFichierSource) {
      // Upload déjà fait (navigateur → Vercel Blob en direct, gate 4,5 Mo des
      // Vercel Functions) — cette fonction n'écrit plus que les métadonnées.
      const safeName = params.storageKey.split('/').pop() ?? params.originalName

      const lignes = await sql`
        insert into files (dossier_id, role_detected, original_name, safe_name, storage_key, mime_type, size_bytes)
        values (${params.dossierId}, ${params.roleDetecte}, ${params.originalName}, ${safeName}, ${params.storageKey}, ${params.mimeType}, ${params.sizeBytes})
        returning id
      `
      const id = lignes[0]?.id as string | undefined
      if (!id) throw new Error('Enregistrement de la source impossible.')
      return { id, storageKey: params.storageKey }
    },

    async enregistrerAuditQualite(params: ParametresAuditQualite) {
      const lignes = await sql`
        insert into quality_audits (generation_id, checklist_version, verdict_human, reserves, validated_by, validated_at)
        values (${params.generationId}, ${params.checklistVersion}, ${params.verdictHuman}, ${params.reserves ?? null}, ${params.validatedBy}, now())
        returning id
      `
      const id = lignes[0]?.id as string | undefined
      if (!id) throw new Error("Enregistrement de l'audit qualité impossible.")
      return { id }
    },

    async transitionnerDossier(dossierId, versEtat) {
      await sql`update dossiers set workflow_state = ${versEtat}, updated_at = now() where id = ${dossierId}`
    },

    async journaliserEvenement(dossierId, type, payload, actorId) {
      try {
        await sql`
          insert into events (dossier_id, event_type, payload, actor_id)
          values (${dossierId}, ${type}, ${JSON.stringify(payload)}::jsonb, ${actorId ?? null})
        `
      } catch (erreur) {
        // Un échec de journalisation ne doit pas faire échouer l'opération
        // métier elle-même, mais ne doit jamais rester silencieux.
        console.error(
          `Échec de journalisation (${type}) pour le dossier ${dossierId} :`,
          erreur instanceof Error ? erreur.message : erreur,
        )
      }
    },

    async obtenirHistoriqueConversation(dossierId): Promise<MessageConversation[]> {
      const lignes = await sql`
        select role, content from messages where dossier_id = ${dossierId} order by created_at asc
      `
      return lignes.map((l) => ({ role: l.role as MessageConversation['role'], content: l.content as string }))
    },

    async ajouterMessageConversation(dossierId, message: MessageConversation) {
      await sql`
        insert into messages (dossier_id, role, content) values (${dossierId}, ${message.role}, ${message.content})
      `
    },
  }
}
