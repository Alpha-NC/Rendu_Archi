import type { ProjectState } from './project-state'
import type { EtatDossier } from './etat-machine'

/**
 * Interface d'accès aux données du dossier — sépare la logique métier
 * (`orchestrateur.ts`) de Supabase, pour pouvoir tester la première avec un
 * dépôt en mémoire plutôt qu'une vraie base (aucun projet Supabase n'existe
 * encore pour RIF-App — D-02/D-03 tranchées, provisioning à faire par
 * Alpha No_Code).
 */

export interface DossierActuel {
  id: string
  ownerId: string
  etat: EtatDossier
  projectState: ProjectState
  usageAdministratif: boolean
}

export interface ParametresNouvelleGeneration {
  dossierId: string
  type: 'initial' | 'correction' | 'restart_from_sources'
  projectStateRevision: number
  promptText: string
  sourceFileIds: string[]
}

export interface PatchGeneration {
  status: 'succeeded' | 'failed' | 'timed_out'
  resultFileId?: string
  providerRequestId?: string
  costActual?: number
  completedAt: string
}

export interface ParametresFichierResultat {
  dossierId: string
  ownerId: string
  generationId: string
  contenu: ArrayBuffer
  mimeType: string
}

export interface DepotDossiers {
  obtenirDossier(dossierId: string): Promise<DossierActuel | null>

  /**
   * Persiste un ProjectState mis à jour (D-15, extraction-project-state.ts).
   * N'incrémente jamais `revision` — la révision n'avance qu'à la
   * confirmation explicite de la fiche projet (PRD §9.4), pas encore câblée.
   */
  mettreAJourProjectState(dossierId: string, projectState: ProjectState): Promise<void>

  /**
   * Résout des IDs de fichiers internes en URLs signées temporaires
   * (PRD §12 : « Aucune URL publique permanente n'est utilisée »).
   */
  resolverUrlsSignees(fileIds: string[]): Promise<string[]>

  /**
   * Crée la ligne `generations` AVANT l'appel fournisseur (PRD §18.1) —
   * une panne après l'appel ne doit jamais créer de rendu orphelin.
   */
  creerGeneration(params: ParametresNouvelleGeneration): Promise<{ id: string }>

  mettreAJourGeneration(generationId: string, patch: PatchGeneration): Promise<void>

  /**
   * Enregistre le rendu produit dans le stockage privé et la table `files`
   * (PRD §12 : le résultat fal.ai est rapatrié, jamais laissé en URL
   * fournisseur transitoire).
   */
  enregistrerFichierResultat(params: ParametresFichierResultat): Promise<{ id: string }>

  transitionnerDossier(dossierId: string, versEtat: EtatDossier): Promise<void>

  /** Journal append-only (PRD §13.5, §18). */
  journaliserEvenement(
    dossierId: string,
    type: string,
    payload: Record<string, unknown>,
    actorId?: string,
  ): Promise<void>
}
