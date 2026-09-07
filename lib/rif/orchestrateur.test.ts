import { describe, expect, it, vi } from 'vitest'
import { creerProjectStateVide } from './project-state'
import type { DepotDossiers, DossierActuel, PatchGeneration } from './depot'
import { executerGenerationOuCorrection, executerReprise } from './orchestrateur'

/** Dépôt en mémoire — aucun Supabase requis pour tester la logique métier. */
function depotMemoire(dossierInitial: DossierActuel) {
  const evenements: Array<{ type: string; payload: unknown; actorId?: string }> = []
  const generations = new Map<string, { statut?: string; patch?: PatchGeneration }>()
  let dossier = { ...dossierInitial }
  let compteurGeneration = 0

  const depot: DepotDossiers = {
    async obtenirDossier(id) {
      return id === dossier.id ? { ...dossier, projectState: { ...dossier.projectState } } : null
    },
    async resolverUrlsSignees(fileIds) {
      return fileIds.map((id) => `https://storage.test/${id}?signed=1`)
    },
    async creerGeneration() {
      compteurGeneration += 1
      const id = `gen-${compteurGeneration}`
      generations.set(id, {})
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
    async journaliserEvenement(_id, type, payload, actorId) {
      evenements.push({ type, payload, actorId })
    },
  }

  return { depot, evenements, generations, obtenirEtatCourant: () => dossier.etat }
}

const dossierPretAGenerer: DossierActuel = {
  id: 'd-1',
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
    const { depot, evenements } = depotMemoire({ ...dossierPretAGenerer, etat: 'COLLECTE_EN_COURS' })
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

describe('executerReprise', () => {
  it('transitionne A_REPRENDRE -> SOURCES_CONTRÔLÉES sans jamais appeler fal.ai', async () => {
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
    expect(obtenirEtatCourant()).toBe('SOURCES_CONTROLEES')
    expect(evenements[0]).toMatchObject({ type: 'reprise_depuis_sources' })
  })

  it("refuse une reprise hors de l'état À_REPRENDRE", async () => {
    const { depot } = depotMemoire({ ...dossierPretAGenerer, etat: 'CONTROLE_A_EXAMINER' })
    const resultat = await executerReprise(depot, { dossierId: 'd-1', actorId: 'user-1', motif: 'x' })
    expect(resultat.success).toBe(false)
    expect(resultat.error?.code).toBe('transition_refusee')
  })
})
