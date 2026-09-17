import type { NeonQueryFunction } from '@neondatabase/serverless'
import { resolverUrlSignee, televerserFichier } from '../storage/vercel-blob'
import type {
  DepotDossiers,
  DossierActuel,
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
 * Implémentation Neon PostgreSQL de DepotDossiers (schéma : neon/schema.sql)
 * — cible PRD V2.1 §16 (D-19).
 *
 * Statut : additif, non branché. `app/api/dossiers/_lib/reponse.ts::obtenirDepot`
 * appelle encore `creerDepotSupabase` — aucune Route Handler ne consomme ce
 * module. La bascule reste à faire, avec l'authentification mono-utilisateur
 * (PRD §16.5, pas encore tranchée : ce module accepte `ownerId`/`actorId`/
 * `validatedBy` comme des identifiants opaques, sans présumer comment ils
 * sont établis).
 *
 * Non testée contre un projet Neon réel — même statut que depot-supabase.ts
 * ne l'a jamais été contre un projet Supabase réel. La logique métier qui
 * compte est testée indépendamment dans orchestrateur.test.ts via un dépôt
 * en mémoire ; ce fichier n'est que la traduction SQL/Blob de l'interface.
 * Seul le contrat d'ordonnancement de `resolverUrlsSignees` (partagé avec
 * depot-supabase.ts, même risque) est testé ici (depot-neon.test.ts).
 *
 * Fichiers : chaque opération de stockage passe par
 * lib/storage/vercel-blob.ts, jamais par un accès direct à `@vercel/blob`
 * ici — même séparation que depot-supabase.ts avec `client.storage`.
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
      // seule peut fournir (même contrainte que depot-supabase.ts).
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
        // par prudence (jamais l'inverse) — même règle que depot-supabase.ts.
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

      // `any(...)` ne garantit AUCUN ordre de retour, comme le `.in()` de
      // Supabase — même contrat, même risque, même correctif : on réordonne
      // sur fileIds plutôt que de faire confiance à l'ordre de la base.
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
      const extension = params.originalName.split('.').pop() ?? 'bin'
      // Nom technique nettoyé côté serveur (PRD §9.1) — l'utilisateur ne
      // renomme jamais rien lui-même.
      const safeName = `${params.roleDetecte}-${Date.now()}.${extension}`
      const storageKey = `${params.ownerId}/${params.dossierId}/sources/${safeName}`

      await televerserFichier(storageKey, params.contenu, params.mimeType)

      const lignes = await sql`
        insert into files (dossier_id, role_detected, original_name, safe_name, storage_key, mime_type, size_bytes)
        values (${params.dossierId}, ${params.roleDetecte}, ${params.originalName}, ${safeName}, ${storageKey}, ${params.mimeType}, ${params.contenu.byteLength})
        returning id
      `
      const id = lignes[0]?.id as string | undefined
      if (!id) throw new Error('Enregistrement de la source impossible.')
      return { id, storageKey }
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
        // métier elle-même, mais ne doit jamais rester silencieux (même
        // règle que depot-supabase.ts).
        console.error(
          `Échec de journalisation (${type}) pour le dossier ${dossierId} :`,
          erreur instanceof Error ? erreur.message : erreur,
        )
      }
    },
  }
}
