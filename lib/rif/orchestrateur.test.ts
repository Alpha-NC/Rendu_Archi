import { describe, expect, it, vi } from 'vitest'
import { creerProjectStateVide } from './project-state'
import type { DepotDossiers, DossierActuel, GenerationDetail, ParametresNouvelleGeneration, PatchGeneration } from './depot'
import { executerGenerationOuCorrection, executerReprise } from './orchestrateur'
import type { RenderTarget } from './render-targets'
import type { ReferencesEvenement } from './events'

/** Dépôt en mémoire — aucune base réelle requise pour tester la logique métier. */
function depotMemoire(dossierInitial: DossierActuel) {
  const evenements: Array<{ type: string; payload: unknown; actorId?: string; refs?: ReferencesEvenement }> = []
  const generations = new Map<string, { statut?: string; patch?: PatchGeneration }>()
  const generationsDetail: GenerationDetail[] = []
  const renderTargets = new Map<string, RenderTarget>()
  let dossier = { ...dossierInitial }
  let compteurGeneration = 0
  let compteurCible = 0

  const depot: DepotDossiers = {
    async creerDossier() {
      throw new Error('Non utilisé dans ces tests.')
    },
    async listerDossiers() {
      return [
        {
          id: dossier.id,
          dossierRef: 'RIF-TEST',
          etat: dossier.etat,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          nombreGenerations: 0,
          derniereGeneration: null,
          generationCanoniqueId: null,
        },
      ]
    },
    async obtenirDossier(id) {
      return id === dossier.id ? { ...dossier, projectState: { ...dossier.projectState } } : null
    },
    async mettreAJourProjectState(_id, projectState) {
      dossier = { ...dossier, projectState }
    },
    async enregistrerFichierSource() {
      return { id: 'file-source-1', storageKey: 'test/source-1' }
    },
    async enregistrerAuditQualite() {
      return { id: 'audit-1' }
    },
    async resolverUrlsSignees(fileIds) {
      return fileIds.map((id) => `https://storage.test/${id}?signed=1`)
    },
    async creerGeneration(params: ParametresNouvelleGeneration) {
      compteurGeneration += 1
      const id = `gen-${compteurGeneration}`
      generations.set(id, {})
      generationsDetail.unshift({
        id,
        dossierId: params.dossierId,
        type: params.type,
        status: 'queued',
        batchId: id,
        variantIndex: 0,
        isCanonical: false,
        projectStateRevision: params.projectStateRevision,
        promptText: params.promptText,
        sourceFileIds: params.sourceFileIds,
        resultFileId: null,
        providerRequestId: null,
        costActual: null,
        startedAt: new Date().toISOString(),
        completedAt: null,
        renderTargetId: params.renderTargetId ?? null,
        parentGenerationId: params.parentGenerationId ?? null,
      })
      return { id }
    },
    async mettreAJourGeneration(id, patch) {
      const entree = generations.get(id)
      if (entree) entree.patch = patch
    },
    async enregistrerFichierResultat() {
      return { id: 'file-resultat-1' }
    },
    async transitionnerDossier(_id, versEtat) {
      dossier = { ...dossier, etat: versEtat }
    },
    async journaliserEvenement(_id, type, payload, actorId, refs) {
      evenements.push({ type, payload, actorId, refs })
    },
    async obtenirHistoriqueConversation() {
      return []
    },
    async ajouterMessageConversation() {},
    async listerGenerations(dossierId) {
      return generationsDetail.filter((g) => g.dossierId === dossierId)
    },
    async obtenirGeneration(generationId) {
      return generationsDetail.find((g) => g.id === generationId) ?? null
    },
    async definirGenerationCanonique() {},
    async obtenirAuditQualite() {
      return null
    },
    async creerRapportQualite() {
      return { id: 'audit-1' }
    },
    async enregistrerVerdictHumain() {},
    async creerRenderTarget(params) {
      compteurCible += 1
      const id = `cible-${compteurCible}`
      const maintenant = new Date().toISOString()
      const cible: RenderTarget = {
        id,
        dossierId: params.dossierId,
        name: params.name,
        outputType: params.outputType,
        canonicalGenerationId: null,
        createdAt: maintenant,
        updatedAt: maintenant,
      }
      renderTargets.set(id, cible)
      return cible
    },
    async listerRenderTargets(dossierId) {
      return [...renderTargets.values()].filter((c) => c.dossierId === dossierId)
    },
    async obtenirRenderTarget(renderTargetId) {
      return renderTargets.get(renderTargetId) ?? null
    },
    async obtenirFichierSource() {
      return null
    },
    async obtenirSourceActivePourRole() {
      return null
    },
    async listerVersionsSource() {
      return []
    },
    async remplacerFichierSource() {
      throw new Error('Non utilisé dans ces tests.')
    },
    async creerAssetTemporaire() {
      throw new Error('Non utilisé dans ces tests.')
    },
    async listerAssetsTemporaires() {
      return []
    },
    async obtenirAssetTemporaire() {
      return null
    },
    async supprimerAssetTemporaire() {},
    async listerEvenements() {
      return { events: [], nextCursor: null }
    },
  }

  return { depot, evenements, generations, generationsDetail, renderTargets, obtenirEtatCourant: () => dossier.etat }
}

const dossierPretAGenerer: DossierActuel = {
  id: 'd-1',
  dossierRef: 'RIF-TEST',
  ownerId: 'user-1',
  etat: 'PRET_A_GENERER',
  projectState: { ...creerProjectStateVide('d-1'), revision: 1 },
  usageAdministratif: true,
}

const falSucces = vi.fn(async () => ({
  statut: 'succes' as const,
  imageUrl: 'https://fal.media/rendu.png',
  requestId: 'req-1',
}))

describe('executerGenerationOuCorrection', () => {
  it('refuse et journalise si le dossier est introuvable', async () => {
    const { depot } = depotMemoire(dossierPretAGenerer)
    const resultat = await executerGenerationOuCorrection(depot, falSucces, {
      dossierId: 'inconnu',
      type: 'initial',
      promptText: 'p',
      sourceFileIds: [],
      actorId: 'user-1',
    })
    expect(resultat).toEqual({
      success: false,
      error: { code: 'dossier_introuvable', message: 'Dossier introuvable.' },
    })
  })

  it("refuse et journalise 'operation_refusee' si l'état ne l'autorise pas", async () => {
    const { depot, evenements } = depotMemoire({ ...dossierPretAGenerer, etat: 'SOURCES_ANALYSEES' })
    const resultat = await executerGenerationOuCorrection(depot, falSucces, {
      dossierId: 'd-1',
      type: 'initial',
      promptText: 'p',
      sourceFileIds: [],
      actorId: 'user-1',
    })
    expect(resultat.success).toBe(false)
    expect(resultat.error?.code).toBe('transition_refusee')
    expect(evenements[0].type).toBe('operation_refusee')
  })

  it('déroulé complet réussi : generation créée avant l\'appel, dossier en CONTRÔLE_À_EXAMINER, fichier enregistré', async () => {
    const { depot, obtenirEtatCourant, generations, evenements } = depotMemoire(dossierPretAGenerer)

    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      headers: new Headers({ 'content-type': 'image/png' }),
      arrayBuffer: async () => new ArrayBuffer(8),
    })) as unknown as typeof fetch

    const resultat = await executerGenerationOuCorrection(depot, falSucces, {
      dossierId: 'd-1',
      type: 'initial',
      promptText: 'construire le rendu',
      sourceFileIds: ['src-1', 'src-2'],
      actorId: 'user-1',
    })

    expect(resultat.success).toBe(true)
    expect(resultat.generationId).toBe('gen-1')
    expect(resultat.imageUrl).toBe('https://storage.test/file-resultat-1?signed=1')
    expect(obtenirEtatCourant()).toBe('CONTROLE_A_EXAMINER')
    expect(generations.get('gen-1')?.patch).toMatchObject({
      status: 'succeeded',
      resultFileId: 'file-resultat-1',
      providerRequestId: 'req-1',
    })
    expect(evenements.map((e) => e.type)).toEqual(['generation_reussie'])
  })

  it('échec fal.ai : dossier basculé en ÉCHEC, generation marquée failed, aucun fichier créé', async () => {
    const { depot, obtenirEtatCourant, generations, evenements } = depotMemoire(dossierPretAGenerer)
    const falEchec = vi.fn(async () => ({
      statut: 'echec' as const,
      code: 'generation_echouee' as const,
      message: 'Le moteur a refusé la requête.',
    }))

    const resultat = await executerGenerationOuCorrection(depot, falEchec, {
      dossierId: 'd-1',
      type: 'initial',
      promptText: 'p',
      sourceFileIds: [],
      actorId: 'user-1',
    })

    expect(resultat.success).toBe(false)
    expect(resultat.error?.code).toBe('generation_echouee')
    expect(obtenirEtatCourant()).toBe('ECHEC')
    expect(generations.get('gen-1')?.patch?.status).toBe('failed')
    expect(evenements.map((e) => e.type)).toEqual(['generation_echouee'])
  })

  it("échec de rapatriement du rendu (stockage) : traité comme un échec, jamais comme un succès partiel", async () => {
    const { depot, obtenirEtatCourant, generations } = depotMemoire(dossierPretAGenerer)
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 500 })) as unknown as typeof fetch

    const resultat = await executerGenerationOuCorrection(depot, falSucces, {
      dossierId: 'd-1',
      type: 'initial',
      promptText: 'p',
      sourceFileIds: [],
      actorId: 'user-1',
    })

    expect(resultat.success).toBe(false)
    expect(resultat.error?.code).toBe('stockage_echec')
    expect(obtenirEtatCourant()).toBe('ECHEC')
    expect(generations.get('gen-1')?.patch?.status).toBe('failed')
  })

  it("autorise corrigerRendu depuis A_CORRIGER mais pas depuis PRÊT_À_GÉNÉRER", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      headers: new Headers({ 'content-type': 'image/png' }),
      arrayBuffer: async () => new ArrayBuffer(8),
    })) as unknown as typeof fetch

    const { depot: depotCorrection } = depotMemoire({ ...dossierPretAGenerer, etat: 'A_CORRIGER' })
    const resultatOk = await executerGenerationOuCorrection(depotCorrection, falSucces, {
      dossierId: 'd-1',
      type: 'correction',
      promptText: 'corriger la teinte',
      sourceFileIds: [],
      actorId: 'user-1',
    })
    expect(resultatOk.success).toBe(true)

    const { depot: depotMauvaisEtat } = depotMemoire({ ...dossierPretAGenerer, etat: 'PRET_A_GENERER' })
    const resultatRefuse = await executerGenerationOuCorrection(depotMauvaisEtat, falSucces, {
      dossierId: 'd-1',
      type: 'correction',
      promptText: 'p',
      sourceFileIds: [],
      actorId: 'user-1',
    })
    expect(resultatRefuse.success).toBe(false)
  })
})

function mockerFetchImageSucces() {
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    headers: new Headers({ 'content-type': 'image/png' }),
    arrayBuffer: async () => new ArrayBuffer(8),
  })) as unknown as typeof fetch
}

describe('executerGenerationOuCorrection — RenderTarget (Lot 1, D-22)', () => {
  it("génération initiale sans cible ni active_render_target_id : reste legacy (render_target_id null)", async () => {
    mockerFetchImageSucces()
    const { depot, generationsDetail } = depotMemoire(dossierPretAGenerer)

    const resultat = await executerGenerationOuCorrection(depot, falSucces, {
      dossierId: 'd-1',
      type: 'initial',
      promptText: 'p',
      sourceFileIds: [],
      actorId: 'user-1',
    })

    expect(resultat.success).toBe(true)
    expect(generationsDetail[0].renderTargetId).toBeNull()
    expect(generationsDetail[0].parentGenerationId).toBeNull()
  })

  it('génération initiale avec renderTargetId explicite valide : la génération porte cette cible', async () => {
    mockerFetchImageSucces()
    const { depot, generationsDetail } = depotMemoire(dossierPretAGenerer)
    const cible = await depot.creerRenderTarget({ dossierId: 'd-1', name: 'Perspective entrée', outputType: 'PHOTOREALISTIC_PERSPECTIVE' })

    const resultat = await executerGenerationOuCorrection(depot, falSucces, {
      dossierId: 'd-1',
      type: 'initial',
      promptText: 'p',
      sourceFileIds: [],
      actorId: 'user-1',
      renderTargetId: cible.id,
    })

    expect(resultat.success).toBe(true)
    expect(generationsDetail[0].renderTargetId).toBe(cible.id)
  })

  it("génération initiale sans renderTargetId explicite : utilise active_render_target_id du ProjectState", async () => {
    mockerFetchImageSucces()
    const { depot, generationsDetail } = depotMemoire(dossierPretAGenerer)
    const cible = await depot.creerRenderTarget({ dossierId: 'd-1', name: 'Axonométrie générale', outputType: 'PHOTOREALISTIC_AXONOMETRY' })
    await depot.mettreAJourProjectState('d-1', { ...dossierPretAGenerer.projectState, active_render_target_id: cible.id })

    const resultat = await executerGenerationOuCorrection(depot, falSucces, {
      dossierId: 'd-1',
      type: 'initial',
      promptText: 'p',
      sourceFileIds: [],
      actorId: 'user-1',
    })

    expect(resultat.success).toBe(true)
    expect(generationsDetail[0].renderTargetId).toBe(cible.id)
  })

  it("refuse une cible inexistante ou d'un autre dossier — aucune génération orpheline créée", async () => {
    const { depot, generationsDetail, evenements } = depotMemoire(dossierPretAGenerer)
    // Cible réelle mais rattachée à un autre dossier.
    const cibleAutreDossier = await depot.creerRenderTarget({ dossierId: 'd-2', name: 'Autre projet', outputType: 'PHOTOREALISTIC_PERSPECTIVE' })

    const resultat = await executerGenerationOuCorrection(depot, falSucces, {
      dossierId: 'd-1',
      type: 'initial',
      promptText: 'p',
      sourceFileIds: [],
      actorId: 'user-1',
      renderTargetId: cibleAutreDossier.id,
    })

    expect(resultat.success).toBe(false)
    expect(resultat.error?.code).toBe('cible_invalide')
    expect(generationsDetail).toHaveLength(0)
    expect(evenements.map((e) => e.type)).toEqual(['operation_refusee'])
  })

  it('une correction hérite toujours de la cible de la génération la plus récente (jamais une valeur séparée)', async () => {
    mockerFetchImageSucces()
    const { depot: depotACorriger, generationsDetail } = depotMemoire({ ...dossierPretAGenerer, etat: 'A_CORRIGER' })
    const cible = await depotACorriger.creerRenderTarget({ dossierId: 'd-1', name: 'Perspective jardin', outputType: 'PHOTOREALISTIC_PERSPECTIVE' })
    // Génération parente déjà existante, rattachée à la cible.
    generationsDetail.push({
      id: 'gen-parent',
      dossierId: 'd-1',
      type: 'initial',
      status: 'succeeded',
      batchId: 'gen-parent',
      variantIndex: 0,
      isCanonical: false,
      projectStateRevision: 1,
      promptText: 'p',
      sourceFileIds: [],
      resultFileId: 'file-1',
      providerRequestId: null,
      costActual: null,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      renderTargetId: cible.id,
      parentGenerationId: null,
    })

    const resultat = await executerGenerationOuCorrection(depotACorriger, falSucces, {
      dossierId: 'd-1',
      type: 'correction',
      promptText: 'corrige la teinte',
      sourceFileIds: [],
      actorId: 'user-1',
    })

    expect(resultat.success).toBe(true)
    const correction = generationsDetail.find((g) => g.type === 'correction')
    expect(correction?.renderTargetId).toBe(cible.id)
    expect(correction?.parentGenerationId).toBe('gen-parent')
  })

  it('une correction sur un dossier sans cible (legacy) reste sans cible', async () => {
    mockerFetchImageSucces()
    const { depot: depotACorriger, generationsDetail } = depotMemoire({ ...dossierPretAGenerer, etat: 'A_CORRIGER' })
    generationsDetail.push({
      id: 'gen-parent-legacy',
      dossierId: 'd-1',
      type: 'initial',
      status: 'succeeded',
      batchId: 'gen-parent-legacy',
      variantIndex: 0,
      isCanonical: false,
      projectStateRevision: 1,
      promptText: 'p',
      sourceFileIds: [],
      resultFileId: 'file-1',
      providerRequestId: null,
      costActual: null,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      renderTargetId: null,
      parentGenerationId: null,
    })

    const resultat = await executerGenerationOuCorrection(depotACorriger, falSucces, {
      dossierId: 'd-1',
      type: 'correction',
      promptText: 'corrige la teinte',
      sourceFileIds: [],
      actorId: 'user-1',
    })

    expect(resultat.success).toBe(true)
    const correction = generationsDetail.find((g) => g.type === 'correction')
    expect(correction?.renderTargetId).toBeNull()
    expect(correction?.parentGenerationId).toBe('gen-parent-legacy')
  })
})

describe('executerReprise', () => {
  it('transitionne A_REPRENDRE -> SOURCES_ANALYSÉES sans jamais appeler fal.ai', async () => {
    const { depot, obtenirEtatCourant, evenements } = depotMemoire({
      ...dossierPretAGenerer,
      etat: 'A_REPRENDRE',
    })

    const resultat = await executerReprise(depot, {
      dossierId: 'd-1',
      actorId: 'user-1',
      motif: 'Dérive de caméra constatée après deux corrections.',
    })

    expect(resultat.success).toBe(true)
    expect(obtenirEtatCourant()).toBe('SOURCES_ANALYSEES')
    expect(evenements[0]).toMatchObject({ type: 'reprise_depuis_sources' })
  })

  it("refuse une reprise hors de l'état À_REPRENDRE", async () => {
    const { depot } = depotMemoire({ ...dossierPretAGenerer, etat: 'CONTROLE_A_EXAMINER' })
    const resultat = await executerReprise(depot, { dossierId: 'd-1', actorId: 'user-1', motif: 'x' })
    expect(resultat.success).toBe(false)
    expect(resultat.error?.code).toBe('transition_refusee')
  })
})

describe('journaliserEvenement — enrichissement Lot 3 Project History (D-24)', () => {
  it('une génération réussie journalise le type, la cible et parentGenerationId=null (initiale)', async () => {
    mockerFetchImageSucces()
    const { depot, evenements } = depotMemoire(dossierPretAGenerer)
    const cible = await depot.creerRenderTarget({ dossierId: 'd-1', name: 'Perspective entrée', outputType: 'PHOTOREALISTIC_PERSPECTIVE' })

    await executerGenerationOuCorrection(depot, falSucces, {
      dossierId: 'd-1',
      type: 'initial',
      promptText: 'p',
      sourceFileIds: [],
      actorId: 'user-1',
      renderTargetId: cible.id,
    })

    const evenement = evenements.find((e) => e.type === 'generation_reussie')
    expect(evenement?.refs).toMatchObject({ renderTargetId: cible.id })
    expect(evenement?.refs?.generationId).toBeDefined()
    expect(evenement?.payload).toMatchObject({ type: 'initial', parentGenerationId: null })
  })

  it('une correction réussie journalise parentGenerationId et hérite la cible dans les refs', async () => {
    mockerFetchImageSucces()
    const { depot: depotACorriger, evenements, generationsDetail } = depotMemoire({ ...dossierPretAGenerer, etat: 'A_CORRIGER' })
    const cible = await depotACorriger.creerRenderTarget({ dossierId: 'd-1', name: 'Perspective jardin', outputType: 'PHOTOREALISTIC_PERSPECTIVE' })
    generationsDetail.push({
      id: 'gen-parent', dossierId: 'd-1', type: 'initial', status: 'succeeded', batchId: 'gen-parent',
      variantIndex: 0, isCanonical: false, projectStateRevision: 1, promptText: 'p', sourceFileIds: [],
      resultFileId: 'file-1', providerRequestId: null, costActual: null, startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(), renderTargetId: cible.id, parentGenerationId: null,
    })

    await executerGenerationOuCorrection(depotACorriger, falSucces, {
      dossierId: 'd-1', type: 'correction', promptText: 'corrige', sourceFileIds: [], actorId: 'user-1',
    })

    const evenement = evenements.find((e) => e.type === 'generation_reussie')
    expect(evenement?.refs).toMatchObject({ renderTargetId: cible.id })
    expect(evenement?.payload).toMatchObject({ type: 'correction', parentGenerationId: 'gen-parent' })
  })

  it("n'émet qu'un seul événement de succès par génération — jamais de doublon", async () => {
    mockerFetchImageSucces()
    const { depot, evenements } = depotMemoire(dossierPretAGenerer)
    await executerGenerationOuCorrection(depot, falSucces, {
      dossierId: 'd-1', type: 'initial', promptText: 'p', sourceFileIds: [], actorId: 'user-1',
    })
    expect(evenements.filter((e) => e.type === 'generation_reussie')).toHaveLength(1)
  })
})
