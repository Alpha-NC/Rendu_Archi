import type { ProjectState, RoleSource } from './project-state'
import type { EtatDossier } from './etat-machine'
import type { LigneRapport, VerdictControle } from './controle-qualite'

/**
 * Interface d'accès aux données du dossier — sépare la logique métier
 * (`orchestrateur.ts`) du backend réel (Neon, `depot-neon.ts`), pour pouvoir
 * tester la première avec un dépôt en mémoire plutôt qu'une vraie base.
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

/**
 * PRD V2.1 §16.1 (upload direct navigateur → Vercel Blob, gate 4,5 Mo des
 * Vercel Functions) : le fichier est déjà dans le stockage privé
 * (`storageKey`) quand ce dépôt est appelé — plus de `contenu` binaire ici,
 * seulement les métadonnées à écrire dans `files`.
 */
export interface ParametresFichierSource {
  dossierId: string
  roleDetecte: RoleSource
  originalName: string
  storageKey: string
  mimeType: string
  sizeBytes: number
}

export interface ParametresAuditQualite {
  generationId: string
  checklistVersion: string
  verdictHuman: VerdictControle
  reserves?: string
  validatedBy: string
}

/**
 * Historique des générations (PRD §10.7, Chantier A backend-completion) —
 * une vue complète d'une ligne `generations`, jamais une URL de fichier en
 * dur : `resultFileId` est un identifiant interne, résolu en URL signée à
 * la demande par `resolverUrlsSignees` (jamais stocké comme source de
 * vérité, PRD §12).
 */
export interface GenerationDetail {
  id: string
  dossierId: string
  type: 'initial' | 'correction' | 'restart_from_sources'
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'timed_out'
  batchId: string
  variantIndex: number
  isCanonical: boolean
  projectStateRevision: number
  promptText: string
  sourceFileIds: string[]
  resultFileId: string | null
  providerRequestId: string | null
  costActual: number | null
  startedAt: string
  completedAt: string | null
}

export interface ParametresRapportQualite {
  generationId: string
  checklistVersion: string
  report: LigneRapport[]
  verdictProposed: VerdictControle
}

/**
 * Vue complète d'une ligne `quality_audits` — `report`/`verdictProposed`
 * sont écrits par un audit multimodal (Chantier E), `verdictHuman` reste la
 * seule autorité pour l'export administratif (PRD §15.1/§15.3, inchangé).
 */
export interface QualityAuditDetail {
  id: string
  generationId: string
  checklistVersion: string
  report: LigneRapport[]
  verdictProposed: VerdictControle | null
  verdictHuman: VerdictControle | null
  reserves: string | null
  validatedBy: string | null
  validatedAt: string | null
  createdAt: string
}

/**
 * Tour de conversation persisté (PRD §13.5 : « l'historique de conversation
 * peut être stocké séparément »). Texte seul, jamais les blocs
 * tool_use/tool_result bruts de l'API Anthropic — voir la note en tête de
 * orchestrateur-conversationnel.ts pour le raisonnement.
 */
export interface MessageConversation {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Résumé dossier pour le dashboard (Chantier J, backend-completion) — les
 * champs dérivés (dernière génération, canonique, décompte) sont CALCULÉS
 * à la lecture, jamais des colonnes dupliquées de `generations`.
 */
export interface DossierResume {
  id: string
  dossierRef: string
  etat: EtatDossier
  createdAt: string
  updatedAt: string
  nombreGenerations: number
  derniereGeneration: { id: string; status: GenerationDetail['status']; startedAt: string } | null
  generationCanoniqueId: string | null
}

export interface DepotDossiers {
  creerDossier(params: ParametresNouveauDossier): Promise<{ id: string; dossierRef: string }>

  obtenirDossier(dossierId: string): Promise<DossierActuel | null>

  /** Dossiers dont l'utilisateur est propriétaire, les plus récents d'abord. */
  listerDossiers(ownerId: string): Promise<DossierResume[]>

  /**
   * Persiste un ProjectState mis à jour (D-15, extraction-project-state.ts).
   * N'incrémente jamais `revision` — la révision n'avance qu'à la
   * confirmation explicite de la fiche projet (PRD §9.4), pas encore câblée.
   */
  mettreAJourProjectState(dossierId: string, projectState: ProjectState): Promise<void>

  /**
   * Résout des IDs de fichiers internes en URLs signées temporaires
   * (PRD §12 : « Aucune URL publique permanente n'est utilisée »).
   *
   * CONTRAT : le tableau retourné suit l'ordre de `fileIds`, index par
   * index. Les appelants apparient par position (rôle de chaque source,
   * ordre des images envoyées au moteur) — un retour désordonné
   * étiquetterait les sources les unes pour les autres.
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

  /**
   * Persiste le verdict humain (PRD §15.1, §15.3) — la seule écriture qui
   * compte pour le garde-fou d'export (lib/rif/controle-qualite.ts). Le
   * verdict proposé, s'il existe, n'est qu'indicatif : voir
   * autoriserExportAdministratif, qui ne lit jamais ce champ.
   */
  enregistrerAuditQualite(params: ParametresAuditQualite): Promise<{ id: string }>

  transitionnerDossier(dossierId: string, versEtat: EtatDossier): Promise<void>

  /** Historique des générations d'un dossier, les plus récentes d'abord (PRD §10.7). */
  listerGenerations(dossierId: string): Promise<GenerationDetail[]>

  /**
   * Une génération précise, ou `null`. Ne vérifie PAS l'appartenance au
   * dossier attendu — défense en profondeur à la charge de l'appelant
   * (comme `verifierProprietaire`), pour ne jamais confondre deux dossiers.
   */
  obtenirGeneration(generationId: string): Promise<GenerationDetail | null>

  /**
   * Marque une génération comme canonique pour son dossier et retire ce
   * statut à toute autre génération du même dossier — au plus une
   * canonique par dossier (Chantier C, arbitrage D-19 : seul un verdict
   * humain validant peut déclencher ceci, jamais un calcul automatique ;
   * voir l'appel dans la Route Handler d'audit). Met aussi à jour
   * `project_state.canonical_result_id` (champ préexistant, jusqu'ici
   * jamais lu ni écrit — les deux représentations restent synchronisées).
   */
  definirGenerationCanonique(dossierId: string, generationId: string, resultFileId: string | null): Promise<void>

  /** Dernier audit qualité d'une génération (rapport + les deux verdicts), ou `null` si aucun. */
  obtenirAuditQualite(generationId: string): Promise<QualityAuditDetail | null>

  /**
   * Enregistre un rapport qualité multimodal (Chantier E) — verdict
   * PROPOSÉ uniquement, jamais `verdictHuman` (distinct, voir
   * `enregistrerAuditQualite`/`enregistrerVerdictHumain`).
   */
  creerRapportQualite(params: ParametresRapportQualite): Promise<{ id: string }>

  /**
   * Ajoute le verdict humain à un audit déjà créé par
   * `creerRapportQualite` (mise à jour, jamais une nouvelle ligne — un seul
   * audit par cycle génération/contrôle).
   */
  enregistrerVerdictHumain(
    auditId: string,
    params: { verdictHuman: VerdictControle; reserves?: string; validatedBy: string },
  ): Promise<void>

  /** Journal append-only (PRD §13.5, §18). */
  journaliserEvenement(
    dossierId: string,
    type: string,
    payload: Record<string, unknown>,
    actorId?: string,
  ): Promise<void>

  /** Historique de conversation, du plus ancien au plus récent (PRD §13.5). */
  obtenirHistoriqueConversation(dossierId: string): Promise<MessageConversation[]>

  ajouterMessageConversation(dossierId: string, message: MessageConversation): Promise<void>
}
