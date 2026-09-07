import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  DepotDossiers,
  DossierActuel,
  ParametresFichierResultat,
  ParametresNouvelleGeneration,
  PatchGeneration,
} from './depot'
import type { EtatDossier } from './etat-machine'

/**
 * Implémentation Supabase de DepotDossiers (schéma : supabase/schema-rif-app.sql).
 *
 * Non testée contre un projet Supabase réel — aucun n'existe encore pour
 * RIF-App (D-02/D-03 tranchées, provisioning restant à faire par
 * Alpha No_Code). La logique métier qui compte est testée indépendamment
 * dans orchestrateur.test.ts via un dépôt en mémoire ; ce fichier n'est que
 * la traduction SQL/Storage de l'interface, à vérifier en Phase 0B dès
 * qu'un projet existe.
 *
 * Le client injecté doit être lié à la session de l'utilisateur courant
 * (lib/supabase/server.ts::creerClientServeur) — jamais le client
 * service_role — pour que la RLS s'applique normalement en plus des
 * vérifications explicites faites ici (PRD §17 : défense en profondeur).
 */

const URL_SIGNEE_DUREE_SECONDES = 300

export function creerDepotSupabase(
  client: SupabaseClient,
  bucket = process.env.SUPABASE_STORAGE_BUCKET ?? 'rif-app-sources',
): DepotDossiers {
  return {
    async obtenirDossier(dossierId): Promise<DossierActuel | null> {
      const { data, error } = await client
        .from('dossiers')
        .select('id, owner_id, workflow_state, project_state')
        .eq('id', dossierId)
        .maybeSingle()

      if (error || !data) return null

      const projectState = data.project_state as DossierActuel['projectState']
      return {
        id: data.id,
        ownerId: data.owner_id,
        etat: data.workflow_state as EtatDossier,
        projectState,
        // PRD §10 : 'usage' porte les valeurs déclarées, dont
        // 'insertion_administrative'. Absence de ce champ = traité comme
        // administratif par prudence (jamais l'inverse).
        usageAdministratif:
          !Array.isArray(projectState?.usage) || projectState.usage.includes('insertion_administrative'),
      }
    },

    async mettreAJourProjectState(dossierId, projectState) {
      const { error } = await client
        .from('dossiers')
        .update({ project_state: projectState, updated_at: new Date().toISOString() })
        .eq('id', dossierId)
      if (error) throw new Error(`Mise à jour du ProjectState impossible : ${error.message}`)
    },

    async resolverUrlsSignees(fileIds) {
      if (fileIds.length === 0) return []

      const { data, error } = await client.from('files').select('id, storage_key').in('id', fileIds)
      if (error || !data) {
        throw new Error('Résolution des URLs signées impossible : fichiers introuvables.')
      }

      const urls = await Promise.all(
        data.map(async (fichier) => {
          const { data: signee, error: erreurSignature } = await client.storage
            .from(bucket)
            .createSignedUrl(fichier.storage_key, URL_SIGNEE_DUREE_SECONDES)
          if (erreurSignature || !signee) {
            throw new Error(`Impossible de signer l'URL du fichier ${fichier.id}.`)
          }
          return signee.signedUrl
        }),
      )
      return urls
    },

    async creerGeneration(params: ParametresNouvelleGeneration) {
      const { data, error } = await client
        .from('generations')
        .insert({
          dossier_id: params.dossierId,
          type: params.type,
          status: 'queued',
          project_state_revision: params.projectStateRevision,
          prompt_text: params.promptText,
          source_file_ids: params.sourceFileIds,
        })
        .select('id')
        .single()

      if (error || !data) throw new Error(`Création de la ligne generations impossible : ${error?.message}`)
      return { id: data.id }
    },

    async mettreAJourGeneration(generationId, patch: PatchGeneration) {
      const { error } = await client
        .from('generations')
        .update({
          status: patch.status,
          result_file_id: patch.resultFileId,
          provider_request_id: patch.providerRequestId,
          cost_actual: patch.costActual,
          completed_at: patch.completedAt,
        })
        .eq('id', generationId)

      if (error) throw new Error(`Mise à jour de generations impossible : ${error.message}`)
    },

    async enregistrerFichierResultat(params: ParametresFichierResultat) {
      const extension = params.mimeType === 'image/png' ? 'png' : 'jpg'
      const storageKey = `${params.ownerId}/${params.dossierId}/generations/${params.generationId}.${extension}`

      const { error: erreurUpload } = await client.storage
        .from(bucket)
        .upload(storageKey, params.contenu, { contentType: params.mimeType, upsert: false })
      if (erreurUpload) throw new Error(`Envoi du rendu vers le stockage privé impossible : ${erreurUpload.message}`)

      const { data, error } = await client
        .from('files')
        .insert({
          dossier_id: params.dossierId,
          role_detected: 'render',
          role_confirmed: 'render',
          original_name: `generation-${params.generationId}.${extension}`,
          safe_name: `generation-${params.generationId}.${extension}`,
          storage_key: storageKey,
          mime_type: params.mimeType,
          size_bytes: params.contenu.byteLength,
        })
        .select('id')
        .single()

      if (error || !data) throw new Error(`Enregistrement du fichier résultat impossible : ${error?.message}`)
      return { id: data.id }
    },

    async transitionnerDossier(dossierId, versEtat) {
      const { error } = await client
        .from('dossiers')
        .update({ workflow_state: versEtat, updated_at: new Date().toISOString() })
        .eq('id', dossierId)
      if (error) throw new Error(`Transition du dossier impossible : ${error.message}`)
    },

    async journaliserEvenement(dossierId, type, payload, actorId) {
      const { error } = await client.from('events').insert({
        dossier_id: dossierId,
        event_type: type,
        payload,
        actor_id: actorId ?? null,
      })
      // Un échec de journalisation ne doit pas faire échouer l'opération
      // métier elle-même, mais ne doit jamais rester silencieux.
      if (error) console.error(`Échec de journalisation (${type}) pour le dossier ${dossierId} :`, error.message)
    },
  }
}
