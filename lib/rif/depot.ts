import type { ProjectState, RoleSource } from './project-state'
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
  dossierRef: string
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

export interface ParametresNouveauDossier {
  ownerId: string
  frameworkVersion: string
  implementationVersion: string
}

export interface ParametresFichierSource {
  dossierId: string
  ownerId: string
  roleDetecte: RoleSource
  originalName: string
  contenu: ArrayBuffer
  mimeType: string
}

export interface DepotDossiers {
  creerDossier(params: ParametresNouveauDossier): Promise<{ id: string; dossierRef: string }>

  obtenirDossier(dossierId: string): Promise<DossierActuel | null>

  /** Dossiers dont l'utilisateur est propriétaire, les plus récents d'abord. */
  listerDossiers(ownerId: string): Promise<Array<{ id: string; dossierRef: string; etat: EtatDossier }>>

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

  /**
   * Enregistre une source déposée par l'utilisateur (PRD §9.1) — étape 1,
   * distincte de enregistrerFichierResultat (étape 5). N'inscrit pas encore
   * la source dans le ProjectState : c'est l'appelant qui décide de
   * l'ajouter à `sources` (souvent via mettreAJourFicheProjet, D-15) une
   * fois le rôle confirmé.
   */
  enregistrerFichierSource(params: ParametresFichierSource): Promise<{ id: string; storageKey: string }>

  transitionnerDossier(dossierId: string, versEtat: EtatDossier): Promise<void>

  /** Journal append-only (PRD §13.5, §18). */
  journaliserEvenement(
    dossierId: string,
    type: string,
    payload: Record<string, unknown>,
    actorId?: string,
  ): Promise<void>
}
