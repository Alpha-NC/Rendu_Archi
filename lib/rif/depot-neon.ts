import type { NeonQueryFunction } from '@neondatabase/serverless'
import { resolverUrlSignee, televerserFichier } from '../storage/vercel-blob'
import type {
  DepotDossiers,
  DossierActuel,
  DossierResume,
  GenerationDetail,
  MessageConversation,
  ParametresAuditQualite,
  ParametresFichierResultat,
  ParametresFichierSource,
  ParametresNouveauDossier,
  ParametresNouvelleGeneration,
  ParametresRapportQualite,
  PatchGeneration,
  QualityAuditDetail,
} from './depot'
import { creerProjectStateVide } from './project-state'
import type { EtatDossier } from './etat-machine'
import type { ParametresNouveauRenderTarget, RenderTarget } from './render-targets'
import type {
  FichierSourceDetail,
  ParametresNouvelAssetTemporaire,
  ParametresRemplacementSource,
  TemporaryAssetDetail,
} from './sources'
import type { RoleSource } from './project-state'
import {
  LIMITE_EVENEMENTS_DEFAUT,
  LIMITE_EVENEMENTS_MAX,
  paginerResultats,
  type EvenementProjet,
  type ParametresListeEvenements,
  type ReferencesEvenement,
} from './events'

/**
 * Sentinelle utilisée pour normaliser `render_target_id is null` dans les
 * comparaisons/index d'unicité (voir neon/migrations/0002_render_targets.sql)
 * — un dossier n'aura jamais de vraie cible avec cet id (le générateur
 * `gen_random_uuid()` de Postgres ne le produit jamais).
 */
const CIBLE_LEGACY_SENTINELLE = '00000000-0000-0000-0000-000000000000'

function mapGeneration(d: Record<string, unknown>): GenerationDetail {
  return {
    id: d.id as string,
    dossierId: d.dossier_id as string,
    type: d.type as GenerationDetail['type'],
    status: d.status as GenerationDetail['status'],
    batchId: d.batch_id as string,
    variantIndex: d.variant_index as number,
    isCanonical: d.is_canonical as boolean,
    projectStateRevision: d.project_state_revision as number,
    promptText: d.prompt_text as string,
    sourceFileIds: d.source_file_ids as string[],
    resultFileId: (d.result_file_id as string | null) ?? null,
    providerRequestId: (d.provider_request_id as string | null) ?? null,
    costActual: d.cost_actual != null ? Number(d.cost_actual) : null,
    startedAt: (d.started_at as Date).toISOString(),
    completedAt: d.completed_at ? (d.completed_at as Date).toISOString() : null,
    renderTargetId: (d.render_target_id as string | null) ?? null,
    parentGenerationId: (d.parent_generation_id as string | null) ?? null,
  }
}

function mapFichierSource(d: Record<string, unknown>): FichierSourceDetail {
  return {
    id: d.id as string,
    dossierId: d.dossier_id as string,
    roleDetected: d.role_detected as RoleSource,
    roleConfirmed: (d.role_confirmed as RoleSource | null) ?? null,
    originalName: d.original_name as string,
    storageKey: d.storage_key as string,
    mimeType: (d.mime_type as string | null) ?? null,
    sizeBytes: d.size_bytes != null ? Number(d.size_bytes) : null,
    version: d.version as number,
    sourceStatus: d.source_status as FichierSourceDetail['sourceStatus'],
    replacedAt: d.replaced_at ? (d.replaced_at as Date).toISOString() : null,
    replacedByFileId: (d.replaced_by as string | null) ?? null,
    createdAt: (d.created_at as Date).toISOString(),
  }
}

function mapTemporaryAsset(d: Record<string, unknown>): TemporaryAssetDetail {
  return {
    id: d.id as string,
    dossierId: d.dossier_id as string,
    originalName: d.original_name as string,
    storageKey: d.storage_key as string,
    mimeType: (d.mime_type as string | null) ?? null,
    sizeBytes: d.size_bytes != null ? Number(d.size_bytes) : null,
    createdAt: (d.created_at as Date).toISOString(),
    expiresAt: d.expires_at ? (d.expires_at as Date).toISOString() : null,
  }
}

function mapEvenement(d: Record<string, unknown>): EvenementProjet {
  return {
    id: d.id as string,
    dossierId: d.dossier_id as string,
    eventType: d.event_type as string,
    payload: (d.payload as Record<string, unknown>) ?? {},
    actorId: (d.actor_id as string | null) ?? null,
    renderTargetId: (d.render_target_id as string | null) ?? null,
    generationId: (d.generation_id as string | null) ?? null,
    sourceId: (d.source_id as string | null) ?? null,
    createdAt: (d.created_at as Date).toISOString(),
  }
}

function mapRenderTarget(d: Record<string, unknown>): RenderTarget {
  return {
    id: d.id as string,
    dossierId: d.dossier_id as string,
    name: d.name as string,
    outputType: d.output_type as RenderTarget['outputType'],
    canonicalGenerationId: (d.canonical_generation_id as string | null) ?? null,
    createdAt: (d.created_at as Date).toISOString(),
    updatedAt: (d.updated_at as Date).toISOString(),
  }
}

function mapDossierResume(d: Record<string, unknown>): DossierResume {
  return {
    id: d.id as string,
    dossierRef: d.dossier_ref as string,
    etat: d.workflow_state as EtatDossier,
    createdAt: (d.created_at as Date).toISOString(),
    updatedAt: (d.updated_at as Date).toISOString(),
    nombreGenerations: Number(d.nombre_generations),
    derniereGeneration: d.derniere_generation_id
      ? {
          id: d.derniere_generation_id as string,
          status: d.derniere_generation_status as GenerationDetail['status'],
          startedAt: (d.derniere_generation_started_at as Date).toISOString(),
        }
      : null,
    generationCanoniqueId: (d.generation_canonique_id as string | null) ?? null,
  }
}

function mapQualityAudit(d: Record<string, unknown>): QualityAuditDetail {
  return {
    id: d.id as string,
    generationId: d.generation_id as string,
    checklistVersion: d.checklist_version as string,
    report: d.report as QualityAuditDetail['report'],
    verdictProposed: (d.verdict_proposed as QualityAuditDetail['verdictProposed']) ?? null,
    verdictHuman: (d.verdict_human as QualityAuditDetail['verdictHuman']) ?? null,
    reserves: (d.reserves as string | null) ?? null,
    validatedBy: (d.validated_by as string | null) ?? null,
    validatedAt: d.validated_at ? (d.validated_at as Date).toISOString() : null,
    createdAt: (d.created_at as Date).toISOString(),
  }
}

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
      // Chantier J (dashboard) : décompte, dernière génération et
      // canonique CALCULÉS à la lecture (LATERAL JOIN, pas de colonnes
      // dupliquées) — index existant sur generations(dossier_id, started_at).
      const lignes = await sql`
        select
          d.id, d.dossier_ref, d.workflow_state, d.created_at, d.updated_at,
          coalesce(compte.n, 0) as nombre_generations,
          derniere.id as derniere_generation_id,
          derniere.status as derniere_generation_status,
          derniere.started_at as derniere_generation_started_at,
          canonique.id as generation_canonique_id
        from dossiers d
        left join lateral (
          select g.id, g.status, g.started_at from generations g
          where g.dossier_id = d.id order by g.started_at desc limit 1
        ) derniere on true
        left join lateral (
          select count(*) as n from generations g where g.dossier_id = d.id
        ) compte on true
        left join lateral (
          select g.id from generations g where g.dossier_id = d.id and g.is_canonical = true limit 1
        ) canonique on true
        where d.owner_id = ${ownerId}
        order by d.created_at desc
      `
      return lignes.map(mapDossierResume)
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
        insert into generations (dossier_id, type, status, project_state_revision, prompt_text, source_file_ids, render_target_id, parent_generation_id)
        values (${params.dossierId}, ${params.type}, 'queued', ${params.projectStateRevision}, ${params.promptText}, ${JSON.stringify(params.sourceFileIds)}::jsonb, ${params.renderTargetId ?? null}, ${params.parentGenerationId ?? null})
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

    async listerGenerations(dossierId) {
      const lignes = await sql`
        select id, dossier_id, type, status, batch_id, variant_index, is_canonical,
               project_state_revision, prompt_text, source_file_ids, result_file_id,
               provider_request_id, cost_actual, started_at, completed_at,
               render_target_id, parent_generation_id
        from generations where dossier_id = ${dossierId} order by started_at desc
      `
      return lignes.map(mapGeneration)
    },

    async obtenirGeneration(generationId) {
      const lignes = await sql`
        select id, dossier_id, type, status, batch_id, variant_index, is_canonical,
               project_state_revision, prompt_text, source_file_ids, result_file_id,
               provider_request_id, cost_actual, started_at, completed_at,
               render_target_id, parent_generation_id
        from generations where id = ${generationId}
      `
      const data = lignes[0]
      return data ? mapGeneration(data) : null
    },

    async definirGenerationCanonique(dossierId, generationId, resultFileId) {
      // Lot 1 RenderTarget (D-22) : la canonique est désormais scopée par
      // cible de rendu, sauf pour une génération legacy (render_target_id
      // null), qui garde EXACTEMENT le comportement D-19 d'origine (au plus
      // une canonique par dossier parmi les générations sans cible — jamais
      // mélangée avec les canoniques des cibles réelles). L'index
      // `generations_une_canonique_par_cible` (migration 0002) applique la
      // même règle au niveau base, ceci n'est que la mise à jour applicative.
      const cible = await sql`select render_target_id from generations where id = ${generationId}`
      const renderTargetId = (cible[0]?.render_target_id as string | null) ?? null

      const canoniqueJson = resultFileId ? JSON.stringify(resultFileId) : 'null'
      const instructions = [
        // Même expression que l'index partiel de la migration 0002 — pour
        // que « même groupe » soit défini une seule fois, identiquement.
        sql`
          update generations set is_canonical = false
          where dossier_id = ${dossierId}
            and is_canonical = true
            and coalesce(render_target_id, ${CIBLE_LEGACY_SENTINELLE}::uuid) = coalesce(${renderTargetId}::uuid, ${CIBLE_LEGACY_SENTINELLE}::uuid)
        `,
        sql`update generations set is_canonical = true where id = ${generationId}`,
      ]
      if (renderTargetId) {
        // Cible réelle : la canonique se lit sur render_targets, jamais sur
        // project_state.canonical_result_id (qui reste le pointeur legacy
        // dossier-large, un axe distinct — voir RenderTarget.canonicalGenerationId).
        instructions.push(
          sql`update render_targets set canonical_generation_id = ${generationId}, updated_at = now() where id = ${renderTargetId}`,
        )
      } else {
        // Génération legacy : comportement D-19 inchangé.
        instructions.push(
          sql`update dossiers set project_state = jsonb_set(project_state, '{canonical_result_id}', ${canoniqueJson}::jsonb), updated_at = now() where id = ${dossierId}`,
        )
      }
      await sql.transaction(instructions)
    },

    async obtenirAuditQualite(generationId) {
      const lignes = await sql`
        select id, generation_id, checklist_version, report, verdict_proposed, verdict_human, reserves, validated_by, validated_at, created_at
        from quality_audits where generation_id = ${generationId}
        order by created_at desc limit 1
      `
      const data = lignes[0]
      return data ? mapQualityAudit(data) : null
    },

    async creerRapportQualite(params: ParametresRapportQualite) {
      const lignes = await sql`
        insert into quality_audits (generation_id, checklist_version, report, verdict_proposed)
        values (${params.generationId}, ${params.checklistVersion}, ${JSON.stringify(params.report)}::jsonb, ${params.verdictProposed})
        returning id
      `
      const id = lignes[0]?.id as string | undefined
      if (!id) throw new Error('Enregistrement du rapport qualité impossible.')
      return { id }
    },

    async enregistrerVerdictHumain(auditId, params) {
      await sql`
        update quality_audits set
          verdict_human = ${params.verdictHuman},
          reserves = ${params.reserves ?? null},
          validated_by = ${params.validatedBy},
          validated_at = now()
        where id = ${auditId}
      `
    },

    async journaliserEvenement(dossierId, type, payload, actorId, refs?: ReferencesEvenement) {
      try {
        await sql`
          insert into events (dossier_id, event_type, payload, actor_id, render_target_id, generation_id, source_id)
          values (${dossierId}, ${type}, ${JSON.stringify(payload)}::jsonb, ${actorId ?? null}, ${refs?.renderTargetId ?? null}, ${refs?.generationId ?? null}, ${refs?.sourceId ?? null})
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

    async creerRenderTarget(params: ParametresNouveauRenderTarget) {
      const lignes = await sql`
        insert into render_targets (dossier_id, name, output_type)
        values (${params.dossierId}, ${params.name}, ${params.outputType})
        returning id, dossier_id, name, output_type, canonical_generation_id, created_at, updated_at
      `
      const data = lignes[0]
      if (!data) throw new Error('Création de la cible de rendu impossible.')
      return mapRenderTarget(data)
    },

    async listerRenderTargets(dossierId) {
      const lignes = await sql`
        select id, dossier_id, name, output_type, canonical_generation_id, created_at, updated_at
        from render_targets where dossier_id = ${dossierId} order by created_at desc
      `
      return lignes.map(mapRenderTarget)
    },

    async obtenirRenderTarget(renderTargetId) {
      const lignes = await sql`
        select id, dossier_id, name, output_type, canonical_generation_id, created_at, updated_at
        from render_targets where id = ${renderTargetId}
      `
      const data = lignes[0]
      return data ? mapRenderTarget(data) : null
    },

    async obtenirFichierSource(fileId) {
      const lignes = await sql`
        select id, dossier_id, role_detected, role_confirmed, original_name, safe_name, storage_key,
               mime_type, size_bytes, version, source_status, replaced_at, replaced_by, created_at
        from files where id = ${fileId}
      `
      const data = lignes[0]
      return data ? mapFichierSource(data) : null
    },

    async obtenirSourceActivePourRole(dossierId, role) {
      const lignes = await sql`
        select id, dossier_id, role_detected, role_confirmed, original_name, safe_name, storage_key,
               mime_type, size_bytes, version, source_status, replaced_at, replaced_by, created_at
        from files
        where dossier_id = ${dossierId}
          and coalesce(role_confirmed, role_detected) = ${role}
          and source_status = 'active'
        limit 1
      `
      const data = lignes[0]
      return data ? mapFichierSource(data) : null
    },

    async listerVersionsSource(dossierId, role) {
      const lignes = await sql`
        select id, dossier_id, role_detected, role_confirmed, original_name, safe_name, storage_key,
               mime_type, size_bytes, version, source_status, replaced_at, replaced_by, created_at
        from files
        where dossier_id = ${dossierId} and coalesce(role_confirmed, role_detected) = ${role}
        order by version desc
      `
      return lignes.map(mapFichierSource)
    },

    async remplacerFichierSource(params: ParametresRemplacementSource) {
      const safeName = params.storageKey.split('/').pop() ?? params.originalName
      const ancien = await sql`select version from files where id = ${params.ancienFileId}`
      const versionPrecedente = (ancien[0]?.version as number | undefined) ?? 0
      const nouvelleVersion = versionPrecedente + 1

      // Une seule transaction, ordre important : l'ancienne version doit
      // devenir `replaced` AVANT l'insertion de la nouvelle `active` — sinon
      // l'index unique partiel (neon/migrations/0003, « une seule active par
      // rôle ») refuserait l'insertion tant que l'ancienne reste active. Si
      // l'insertion échoue pour une autre raison, la transaction entière est
      // annulée : l'ancienne version redevient/reste `active`, jamais de
      // source cassée à moitié (mission Lot 2 §6).
      const resultats = await sql.transaction([
        sql`update files set source_status = 'replaced', replaced_at = now() where id = ${params.ancienFileId}`,
        sql`
          insert into files (dossier_id, role_detected, original_name, safe_name, storage_key, mime_type, size_bytes, version, source_status)
          values (${params.dossierId}, ${params.roleDetecte}, ${params.originalName}, ${safeName}, ${params.storageKey}, ${params.mimeType}, ${params.sizeBytes}, ${nouvelleVersion}, 'active')
          returning id
        `,
      ])
      const ligneInseree = resultats[1] as Array<{ id: string }>
      const id = ligneInseree[0]?.id
      if (!id) throw new Error('Enregistrement de la nouvelle version impossible.')

      // `replaced_by` est un pointeur de confort (navigation avant dans
      // l'historique) — posé après coup puisque l'id de la nouvelle ligne
      // n'existe qu'une fois l'insertion faite. Un échec ici ne remet jamais
      // en cause le remplacement déjà acté (source_status déjà cohérent) ;
      // journalisé plutôt que silencieux.
      try {
        await sql`update files set replaced_by = ${id} where id = ${params.ancienFileId}`
      } catch (erreur) {
        console.error(
          `Échec de pose de replaced_by pour ${params.ancienFileId} → ${id} :`,
          erreur instanceof Error ? erreur.message : erreur,
        )
      }

      return { id, storageKey: params.storageKey, version: nouvelleVersion }
    },

    async creerAssetTemporaire(params: ParametresNouvelAssetTemporaire) {
      const lignes = await sql`
        insert into temporary_assets (dossier_id, original_name, storage_key, mime_type, size_bytes)
        values (${params.dossierId}, ${params.originalName}, ${params.storageKey}, ${params.mimeType}, ${params.sizeBytes})
        returning id, dossier_id, original_name, storage_key, mime_type, size_bytes, created_at, expires_at
      `
      const data = lignes[0]
      if (!data) throw new Error("Enregistrement de l'asset temporaire impossible.")
      return mapTemporaryAsset(data)
    },

    async listerAssetsTemporaires(dossierId) {
      const lignes = await sql`
        select id, dossier_id, original_name, storage_key, mime_type, size_bytes, created_at, expires_at
        from temporary_assets where dossier_id = ${dossierId} order by created_at desc
      `
      return lignes.map(mapTemporaryAsset)
    },

    async obtenirAssetTemporaire(assetId) {
      const lignes = await sql`
        select id, dossier_id, original_name, storage_key, mime_type, size_bytes, created_at, expires_at
        from temporary_assets where id = ${assetId}
      `
      const data = lignes[0]
      return data ? mapTemporaryAsset(data) : null
    },

    async supprimerAssetTemporaire(assetId) {
      await sql`delete from temporary_assets where id = ${assetId}`
    },

    async listerEvenements(dossierId, options: ParametresListeEvenements = {}) {
      const limite = Math.min(options.limite ?? LIMITE_EVENEMENTS_DEFAUT, LIMITE_EVENEMENTS_MAX)

      // Curseur = id du dernier événement déjà vu ; on résout son
      // (created_at, id) pour comparer par tuple — stable même si plusieurs
      // événements partagent la même seconde (mission Lot 3 §8 : cursor
      // basé sur created_at + id, jamais un offset).
      let curseurCreatedAt: Date | null = null
      if (options.curseur) {
        const lignesCurseur = await sql`select created_at from events where id = ${options.curseur}`
        curseurCreatedAt = (lignesCurseur[0]?.created_at as Date | undefined) ?? null
      }

      // limite + 1 pour savoir s'il reste une page suivante, sans requête séparée.
      const lignes = await sql`
        select id, dossier_id, event_type, payload, actor_id, render_target_id, generation_id, source_id, created_at
        from events
        where dossier_id = ${dossierId}
          and (${options.eventType ?? null}::text is null or event_type = ${options.eventType ?? null})
          and (${options.renderTargetId ?? null}::uuid is null or render_target_id = ${options.renderTargetId ?? null})
          and (${options.generationId ?? null}::uuid is null or generation_id = ${options.generationId ?? null})
          and (
            ${curseurCreatedAt}::timestamptz is null
            or (created_at, id) < (${curseurCreatedAt}::timestamptz, ${options.curseur ?? null}::uuid)
          )
        order by created_at desc, id desc
        limit ${limite + 1}
      `

      const { page, nextCursor } = paginerResultats(lignes.map(mapEvenement), limite, (e) => e.id)
      return { events: page, nextCursor }
    },
  }
}
