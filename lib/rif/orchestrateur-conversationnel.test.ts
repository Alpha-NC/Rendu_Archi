import { describe, expect, it, vi } from 'vitest'
import { creerProjectStateVide } from './project-state'
import type { DepotDossiers, DossierActuel } from './depot'
import {
  calculerContexteBranchement,
  executerTourConversationnel,
  type AppelModele,
} from './orchestrateur-conversationnel'

function depotMemoire(dossierInitial: DossierActuel) {
  const evenements: Array<{ type: string; payload: unknown }> = []
  let dossier = { ...dossierInitial }

  const depot: DepotDossiers = {
    async obtenirDossier(id) {
      return id === dossier.id ? dossier : null
    },
    async resolverUrlsSignees(fileIds) {
      return fileIds.map((id) => `https://storage.test/${id}`)
    },
    async creerGeneration() {
      return { id: 'gen-1' }
    },
    async mettreAJourGeneration() {},
    async enregistrerFichierResultat() {
      return { id: 'file-1' }
    },
    async transitionnerDossier(_id, versEtat) {
      dossier = { ...dossier, etat: versEtat }
    },
    async journaliserEvenement(_id, type, payload) {
      evenements.push({ type, payload })
    },
  }

  return { depot, evenements }
}

const dossierBase: DossierActuel = {
  id: 'd-1',
  ownerId: 'user-1',
  etat: 'PRET_A_GENERER',
  projectState: {
    ...creerProjectStateVide('d-1'),
    revision: 1,
    usage: ['insertion_administrative'],
    mode: 'photomontage_controle',
    style: 'photomontage_administratif',
    sources: [
      { id: 'src-1', role_detected: 'revit_view', role_confirmed: 'revit_view', status: 'valid' },
      { id: 'src-2', role_detected: 'site_photo', role_confirmed: 'site_photo', status: 'valid' },
    ],
  },
  usageAdministratif: true,
}

const falSucces = vi.fn<typeof import('../fal/client').genererEtAttendre>(async () => ({
  statut: 'succes' as const,
  imageUrl: 'https://fal.media/rendu.png',
  requestId: 'req-1',
}))

const contexteFetchOk = () => {
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    headers: new Headers({ 'content-type': 'image/png' }),
    arrayBuffer: async () => new ArrayBuffer(8),
  })) as unknown as typeof fetch
}

describe('calculerContexteBranchement', () => {
  it('reprend le mode/style déjà confirmés dans le ProjectState sans les recalculer', () => {
    const { modeResolu, styleResolu } = calculerContexteBranchement(dossierBase)
    expect(modeResolu).toBe('photomontage_controle')
    expect(styleResolu).toBe('photomontage_administratif')
  })

  it('calcule un mode/style par défaut quand le ProjectState ne les a pas encore', () => {
    const dossierSansModeStyle: DossierActuel = {
      ...dossierBase,
      projectState: {
        ...dossierBase.projectState,
        mode: undefined,
        style: undefined,
        camera_compatibility: 'Compatible',
      },
    }
    const { modeResolu, styleResolu } = calculerContexteBranchement(dossierSansModeStyle)
    expect(modeResolu).toBe('photomontage_controle') // photo + camera Compatible + admin (LIB-006 §5)
    expect(styleResolu).toBe('photomontage_administratif') // photo + admin (LIB-005)
  })
})

describe("executerTourConversationnel — réponse texte simple", () => {
  it('retourne le texte quand aucun outil n\'est appelé', async () => {
    const { depot } = depotMemoire(dossierBase)
    const appelerModele = vi.fn<AppelModele>(async () => ({
      content: [{ type: 'text', text: 'Quelle est la teinte de la façade ?' }],
    }))

    const resultat = await executerTourConversationnel(depot, appelerModele, falSucces, {
      dossier: dossierBase,
      historique: [],
      nouveauMessage: 'Voici mes documents.',
      actorId: 'user-1',
    })

    expect(resultat).toEqual({ type: 'message', texte: 'Quelle est la teinte de la façade ?' })
    // Le prompt système a bien été transmis avec le plan de collecte calculé.
    expect(appelerModele.mock.calls[0][0].system).toMatch(/PLAN DE COLLECTE/)
  })
})

describe("executerTourConversationnel — appel simulé (prémortem #1)", () => {
  it("bloque et journalise un texte imitant un appel d'outil, sans jamais exécuter d'opération", async () => {
    const { depot, evenements } = depotMemoire(dossierBase)
    const appelerModele = vi.fn<AppelModele>(async () => ({
      content: [{ type: 'text', text: 'Je lance : genererRenduFlux({})' }],
    }))

    const resultat = await executerTourConversationnel(depot, appelerModele, falSucces, {
      dossier: dossierBase,
      historique: [],
      nouveauMessage: 'Lance la génération.',
      actorId: 'user-1',
    })

    expect(resultat.type).toBe('incident')
    expect(evenements[0].type).toBe('appel_outil_simule_detecte')
    expect(falSucces).not.toHaveBeenCalled()
  })
})

describe('executerTourConversationnel — genererRenduFlux réel', () => {
  it("construit le prompt technique côté backend et exécute la génération", async () => {
    contexteFetchOk()
    const { depot } = depotMemoire(dossierBase)
    const appelerModele = vi.fn<AppelModele>(async () => ({
      content: [{ type: 'tool_use', name: 'genererRenduFlux', input: {} }],
    }))

    const resultat = await executerTourConversationnel(depot, appelerModele, falSucces, {
      dossier: dossierBase,
      historique: [],
      nouveauMessage: 'La fiche est bonne, lance.',
      actorId: 'user-1',
    })

    expect(resultat.type).toBe('operation')
    if (resultat.type === 'operation') {
      expect(resultat.operation).toBe('genererRenduFlux')
      expect(resultat.resultat.success).toBe(true)
    }
    // Le prompt envoyé à fal.ai vient de construirePromptGeneration, pas du modèle.
    expect(falSucces.mock.calls.at(-1)?.[0].prompt).toMatch(/MODE DE PRODUCTION/)
  })
})

describe('executerTourConversationnel — corrigerRenduFlux réel', () => {
  it('refuse proprement une correction aux paramètres incomplets, sans appeler fal.ai', async () => {
    const { depot, evenements } = depotMemoire({ ...dossierBase, etat: 'A_CORRIGER' })
    const appelerModele = vi.fn<AppelModele>(async () => ({
      content: [{ type: 'tool_use', name: 'corrigerRenduFlux', input: { elementAModifier: 'Façade' } }],
    }))

    const resultat = await executerTourConversationnel(depot, appelerModele, falSucces, {
      dossier: { ...dossierBase, etat: 'A_CORRIGER' },
      historique: [],
      nouveauMessage: 'Corrige la teinte.',
      actorId: 'user-1',
    })

    expect(resultat.type).toBe('incident')
    expect(evenements[0].type).toBe('operation_refusee')
  })

  it('exécute une correction bien formée en construisant le prompt ENG-003', async () => {
    contexteFetchOk()
    const { depot } = depotMemoire({ ...dossierBase, etat: 'A_CORRIGER' })
    const appelerModele = vi.fn<AppelModele>(async () => ({
      content: [
        {
          type: 'tool_use',
          name: 'corrigerRenduFlux',
          input: { elementAModifier: 'Teinte de la façade', resultatAttendu: 'Gris clair' },
        },
      ],
    }))

    const resultat = await executerTourConversationnel(depot, appelerModele, falSucces, {
      dossier: { ...dossierBase, etat: 'A_CORRIGER' },
      historique: [],
      nouveauMessage: 'Corrige la teinte.',
      actorId: 'user-1',
    })

    expect(resultat.type).toBe('operation')
    expect(falSucces.mock.calls.at(-1)?.[0].prompt).toMatch(/ÉLÉMENT À MODIFIER\nTeinte de la façade/)
  })
})

describe('executerTourConversationnel — reprendreDepuisSources réel', () => {
  it("n'appelle jamais fal.ai et transitionne vers SOURCES_CONTRÔLÉES", async () => {
    const falEspion = vi.fn()
    const { depot, evenements } = depotMemoire({ ...dossierBase, etat: 'A_REPRENDRE' })
    const appelerModele = vi.fn<AppelModele>(async () => ({
      content: [{ type: 'tool_use', name: 'reprendreDepuisSources', input: { motif: 'Caméra dérivée.' } }],
    }))

    const resultat = await executerTourConversationnel(depot, appelerModele, falEspion as never, {
      dossier: { ...dossierBase, etat: 'A_REPRENDRE' },
      historique: [],
      nouveauMessage: 'Il faut repartir des sources.',
      actorId: 'user-1',
    })

    expect(resultat.type).toBe('operation')
    expect(falEspion).not.toHaveBeenCalled()
    expect(evenements.map((e) => e.type)).toContain('reprise_depuis_sources')
  })
})
