import { describe, expect, it, vi } from 'vitest'
import { creerProjectStateVide } from './project-state'
import type { DepotDossiers, DossierActuel, MessageConversation } from './depot'
import {
  calculerContexteBranchement,
  executerTourConversationnel,
  type AppelModele,
} from './orchestrateur-conversationnel'

function depotMemoire(dossierInitial: DossierActuel) {
  const evenements: Array<{ type: string; payload: unknown }> = []
  const messages: MessageConversation[] = []
  let dossier = { ...dossierInitial }

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
      return id === dossier.id ? dossier : null
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
    async obtenirHistoriqueConversation() {
      return [...messages]
    },
    async ajouterMessageConversation(_id, message) {
      messages.push(message)
    },
    async listerGenerations() {
      return []
    },
    async obtenirGeneration() {
      return null
    },
    async definirGenerationCanonique() {},
    async obtenirAuditQualite() {
      return null
    },
    async creerRapportQualite() {
      return { id: 'audit-1' }
    },
    async enregistrerVerdictHumain() {},
    async creerRenderTarget() {
      throw new Error('Non utilisé dans ces tests.')
    },
    async listerRenderTargets() {
      return []
    },
    async obtenirRenderTarget() {
      return null
    },
  }

  return { depot, evenements, messages, obtenirDossierCourant: () => dossier }
}

const dossierBase: DossierActuel = {
  id: 'd-1',
  dossierRef: 'RIF-TEST',
  ownerId: 'user-1',
  etat: 'PRET_A_GENERER',
  projectState: {
    ...creerProjectStateVide('d-1'),
    revision: 1,
    usage: ['insertion_administrative'],
    mode: 'photomontage_controle',
    style: 'administratif_sobre',
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
    expect(styleResolu).toBe('administratif_sobre')
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
    expect(styleResolu).toBe('administratif_sobre') // photo + admin (LIB-005)
  })
})

describe("executerTourConversationnel — réponse texte simple", () => {
  it('retourne le texte quand aucun outil n\'est appelé', async () => {
    const { depot, messages } = depotMemoire(dossierBase)
    const appelerModele = vi.fn<AppelModele>(async () => ({
      content: [{ type: 'text', text: 'Quelle est la teinte de la façade ?' }],
    }))

    const resultat = await executerTourConversationnel(depot, appelerModele, falSucces, {
      dossier: dossierBase,
      nouveauMessage: 'Voici mes documents.',
      actorId: 'user-1',
    })

    expect(resultat).toEqual({ type: 'message', texte: 'Quelle est la teinte de la façade ?' })
    // Le prompt système a bien été transmis avec le plan de collecte calculé.
    expect(appelerModele.mock.calls[0][0].system).toMatch(/PLAN DE COLLECTE/)
    // PRD §13.5 : le tour est persisté (texte seul, jamais les blocs bruts).
    expect(messages).toEqual([
      { role: 'user', content: 'Voici mes documents.' },
      { role: 'assistant', content: 'Quelle est la teinte de la façade ?' },
    ])
  })

  it("charge l'historique persisté et le transmet au modèle", async () => {
    const { depot } = depotMemoire(dossierBase)
    await depot.ajouterMessageConversation(dossierBase.id, { role: 'user', content: 'Premier message.' })
    await depot.ajouterMessageConversation(dossierBase.id, { role: 'assistant', content: 'Première réponse.' })
    const appelerModele = vi.fn<AppelModele>(async () => ({
      content: [{ type: 'text', text: 'Suite.' }],
    }))

    await executerTourConversationnel(depot, appelerModele, falSucces, {
      dossier: dossierBase,
      nouveauMessage: 'Deuxième message.',
      actorId: 'user-1',
    })

    expect(appelerModele.mock.calls[0][0].messages[0]).toEqual({ role: 'user', content: 'Premier message.' })
    expect(appelerModele.mock.calls[0][0].messages[1]).toEqual({ role: 'assistant', content: 'Première réponse.' })
  })
})

describe("executerTourConversationnel — appel simulé (prémortem #1)", () => {
  it("bloque et journalise un texte imitant un appel d'outil, sans jamais exécuter d'opération", async () => {
    const { depot, evenements } = depotMemoire(dossierBase)
    const appelerModele = vi.fn<AppelModele>(async () => ({
      content: [{ type: 'text', text: 'Je lance : genererRendu({})' }],
    }))

    const resultat = await executerTourConversationnel(depot, appelerModele, falSucces, {
      dossier: dossierBase,
      nouveauMessage: 'Lance la génération.',
      actorId: 'user-1',
    })

    expect(resultat.type).toBe('incident')
    expect(evenements[0].type).toBe('appel_outil_simule_detecte')
    expect(falSucces).not.toHaveBeenCalled()
  })
})

describe('executerTourConversationnel — genererRendu réel', () => {
  it("construit le prompt technique côté backend et exécute la génération", async () => {
    contexteFetchOk()
    const { depot } = depotMemoire(dossierBase)
    const appelerModele = vi.fn<AppelModele>(async () => ({
      content: [{ type: 'tool_use', name: 'genererRendu', input: {} }],
    }))

    const resultat = await executerTourConversationnel(depot, appelerModele, falSucces, {
      dossier: dossierBase,
      nouveauMessage: 'La fiche est bonne, lance.',
      actorId: 'user-1',
    })

    expect(resultat.type).toBe('operation')
    if (resultat.type === 'operation') {
      expect(resultat.operation).toBe('genererRendu')
      expect(resultat.resultat.success).toBe(true)
    }
    // Le prompt envoyé à fal.ai vient de construirePromptGeneration, pas du modèle.
    expect(falSucces.mock.calls.at(-1)?.[0].prompt).toMatch(/MODE DE PRODUCTION/)
  })
})

describe('executerTourConversationnel — corrigerRendu réel', () => {
  it('refuse proprement une correction aux paramètres incomplets, sans appeler fal.ai', async () => {
    const { depot, evenements } = depotMemoire({ ...dossierBase, etat: 'A_CORRIGER' })
    const appelerModele = vi.fn<AppelModele>(async () => ({
      content: [{ type: 'tool_use', name: 'corrigerRendu', input: { elementAModifier: 'Façade' } }],
    }))

    const resultat = await executerTourConversationnel(depot, appelerModele, falSucces, {
      dossier: { ...dossierBase, etat: 'A_CORRIGER' },
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
          name: 'corrigerRendu',
          input: { elementAModifier: 'Teinte de la façade', resultatAttendu: 'Gris clair', categorie: 'MATERIAL' },
        },
      ],
    }))

    const resultat = await executerTourConversationnel(depot, appelerModele, falSucces, {
      dossier: { ...dossierBase, etat: 'A_CORRIGER' },
      nouveauMessage: 'Corrige la teinte.',
      actorId: 'user-1',
    })

    expect(resultat.type).toBe('operation')
    expect(falSucces.mock.calls.at(-1)?.[0].prompt).toMatch(/ÉLÉMENT À MODIFIER\nTeinte de la façade/)
    expect(falSucces.mock.calls.at(-1)?.[0].prompt).toMatch(/CATÉGORIE DE CORRECTION \(ADR-021\)\nMATERIAL/)
  })

  it("refuse une correction sans categorie valide (ADR-021) — jamais traitée comme une modification architecturale silencieuse", async () => {
    const { depot, evenements } = depotMemoire({ ...dossierBase, etat: 'A_CORRIGER' })
    const appelerModele = vi.fn<AppelModele>(async () => ({
      content: [
        {
          type: 'tool_use',
          name: 'corrigerRendu',
          input: { elementAModifier: 'Toiture', resultatAttendu: 'Un niveau de plus', categorie: 'ARCHITECTURAL_CHANGE' },
        },
      ],
    }))

    const resultat = await executerTourConversationnel(depot, appelerModele, falSucces, {
      dossier: { ...dossierBase, etat: 'A_CORRIGER' },
      nouveauMessage: 'Ajoute un niveau.',
      actorId: 'user-1',
    })

    expect(resultat.type).toBe('incident')
    expect(evenements[0].type).toBe('operation_refusee')
    expect(falSucces).not.toHaveBeenCalled()
  })
})

describe('executerTourConversationnel — reprendreDepuisSources réel', () => {
  it("n'appelle jamais fal.ai et transitionne vers SOURCES_ANALYSÉES", async () => {
    const falEspion = vi.fn()
    const { depot, evenements } = depotMemoire({ ...dossierBase, etat: 'A_REPRENDRE' })
    const appelerModele = vi.fn<AppelModele>(async () => ({
      content: [{ type: 'tool_use', name: 'reprendreDepuisSources', input: { motif: 'Caméra dérivée.' } }],
    }))

    const resultat = await executerTourConversationnel(depot, appelerModele, falEspion as never, {
      dossier: { ...dossierBase, etat: 'A_REPRENDRE' },
      nouveauMessage: 'Il faut repartir des sources.',
      actorId: 'user-1',
    })

    expect(resultat.type).toBe('operation')
    expect(falEspion).not.toHaveBeenCalled()
    expect(evenements.map((e) => e.type)).toContain('reprise_depuis_sources')
  })
})

describe('executerTourConversationnel — mettreAJourFicheProjet (D-15)', () => {
  it('persiste la mise à jour dans le ProjectState et journalise', async () => {
    const { depot, evenements, obtenirDossierCourant } = depotMemoire({
      ...dossierBase,
      etat: 'SOURCES_ANALYSEES',
    })
    const appelerModele = vi.fn<AppelModele>(async () => ({
      content: [
        {
          type: 'tool_use',
          name: 'mettreAJourFicheProjet',
          input: {
            materiaux: [{ element: 'facade_extension', valeur: 'enduit clair', statut: 'validated' }],
          },
        },
      ],
    }))

    const resultat = await executerTourConversationnel(depot, appelerModele, falSucces, {
      dossier: { ...dossierBase, etat: 'SOURCES_ANALYSEES' },
      nouveauMessage: 'La façade extension sera en enduit clair.',
      actorId: 'user-1',
    })

    expect(resultat).toEqual({ type: 'fiche_mise_a_jour', champsModifies: ['materiaux'], ignores: [] })
    expect(obtenirDossierCourant().projectState.materials.facade_extension).toMatchObject({
      value: 'enduit clair',
      status: 'validated',
    })
    expect(evenements.map((e) => e.type)).toContain('fiche_projet_mise_a_jour')
  })

  it('refuse une mise à jour de la fiche une fois la révision engagée (D-15)', async () => {
    const { depot, evenements } = depotMemoire({ ...dossierBase, etat: 'GENERATION_EN_COURS' })
    const appelerModele = vi.fn<AppelModele>(async () => ({
      content: [{ type: 'tool_use', name: 'mettreAJourFicheProjet', input: { style: 'commercial' } }],
    }))

    const resultat = await executerTourConversationnel(depot, appelerModele, falSucces, {
      dossier: { ...dossierBase, etat: 'GENERATION_EN_COURS' },
      nouveauMessage: 'Change le style en Commercial.',
      actorId: 'user-1',
    })

    expect(resultat.type).toBe('incident')
    expect(evenements[0].type).toBe('operation_refusee')
  })
})

describe('executerTourConversationnel — avancerParcours', () => {
  it('applique une avancée autorisée et la journalise', async () => {
    const { depot, evenements, obtenirDossierCourant } = depotMemoire({
      ...dossierBase,
      etat: 'SOURCES_ANALYSEES',
    })
    const appelerModele = vi.fn<AppelModele>(async () => ({
      content: [
        {
          type: 'tool_use',
          name: 'avancerParcours',
          input: { versEtat: 'CONTEXTE_A_CONFIRMER', motif: 'Sources analysées, rôles confirmés.' },
        },
      ],
    }))

    const resultat = await executerTourConversationnel(depot, appelerModele, falSucces, {
      dossier: { ...dossierBase, etat: 'SOURCES_ANALYSEES' },
      nouveauMessage: 'On peut passer à la confirmation du contexte.',
      actorId: 'user-1',
    })

    expect(resultat).toEqual({ type: 'parcours_avance', versEtat: 'CONTEXTE_A_CONFIRMER' })
    expect(obtenirDossierCourant().etat).toBe('CONTEXTE_A_CONFIRMER')
    expect(evenements.map((e) => e.type)).toContain('parcours_avance')
  })

  it("refuse et journalise une avancée vers PRÊT_À_GÉNÉRER proposée par le modèle (PRD §9.4)", async () => {
    const { depot, evenements, obtenirDossierCourant } = depotMemoire({
      ...dossierBase,
      etat: 'CONTEXTE_A_CONFIRMER',
    })
    const appelerModele = vi.fn<AppelModele>(async () => ({
      content: [
        { type: 'tool_use', name: 'avancerParcours', input: { versEtat: 'PRET_A_GENERER', motif: 'Fiche complète.' } },
      ],
    }))

    const resultat = await executerTourConversationnel(depot, appelerModele, falSucces, {
      dossier: { ...dossierBase, etat: 'CONTEXTE_A_CONFIRMER' },
      nouveauMessage: 'Lance la génération.',
      actorId: 'user-1',
    })

    expect(resultat.type).toBe('incident')
    expect(obtenirDossierCourant().etat).toBe('CONTEXTE_A_CONFIRMER')
    expect(evenements[0].type).toBe('operation_refusee')
  })
})

describe('executerTourConversationnel — sources jointes au modèle (D-06, PRD §9.2)', () => {
  it('joint chaque source comme bloc image pendant la phase de collecte', async () => {
    const { depot } = depotMemoire({ ...dossierBase, etat: 'SOURCES_RECUES' })
    const appelerModele = vi.fn<AppelModele>(async () => ({
      content: [{ type: 'text', text: 'Je regarde les documents.' }],
    }))

    await executerTourConversationnel(depot, appelerModele, falSucces, {
      dossier: { ...dossierBase, etat: 'SOURCES_RECUES' },
      nouveauMessage: 'Voici mes documents.',
      actorId: 'user-1',
    })

    const contenu = appelerModele.mock.calls[0][0].messages.at(-1)!.content
    expect(Array.isArray(contenu)).toBe(true)
    const blocs = contenu as Array<{ type: string; source?: { url: string }; text?: string }>
    const images = blocs.filter((b) => b.type === 'image')
    expect(images).toHaveLength(2) // src-1 (revit) + src-2 (photo)
    expect(images[0].source?.url).toBe('https://storage.test/src-1')
    // Chaque image est précédée d'un libellé de rôle, sinon le modèle ne sait
    // pas laquelle fait autorité sur quoi.
    expect(blocs.some((b) => b.text?.includes('rôle revit_view'))).toBe(true)
    // Le message de l'utilisateur reste présent, en dernier.
    expect(blocs.at(-1)).toEqual({ type: 'text', text: 'Voici mes documents.' })
  })

  it('ne rejoint plus les sources une fois la révision engagée (coût inutile)', async () => {
    const { depot } = depotMemoire(dossierBase) // PRET_A_GENERER
    const appelerModele = vi.fn<AppelModele>(async () => ({
      content: [{ type: 'text', text: 'Prêt.' }],
    }))

    await executerTourConversationnel(depot, appelerModele, falSucces, {
      dossier: dossierBase,
      nouveauMessage: 'On en est où ?',
      actorId: 'user-1',
    })

    const blocs = appelerModele.mock.calls[0][0].messages.at(-1)!.content as Array<{ type: string }>
    expect(blocs.filter((b) => b.type === 'image')).toHaveLength(0)
  })
})

describe('executerTourConversationnel — boucle tool_use → tool_result (Chantier H)', () => {
  it('renvoie le résultat au modèle en tool_result et utilise sa clôture en langage naturel', async () => {
    contexteFetchOk()
    const { depot, messages } = depotMemoire(dossierBase)
    const appelerModele = vi.fn<AppelModele>()
    appelerModele
      .mockResolvedValueOnce({ content: [{ type: 'tool_use', id: 'tool-1', name: 'genererRendu', input: {} }] })
      .mockResolvedValueOnce({ content: [{ type: 'text', text: 'Voilà ton rendu, il est prêt à être contrôlé.' }] })

    const resultat = await executerTourConversationnel(depot, appelerModele, falSucces, {
      dossier: dossierBase,
      nouveauMessage: 'Lance la génération.',
      actorId: 'user-1',
    })

    expect(resultat.type).toBe('operation')
    expect(appelerModele).toHaveBeenCalledTimes(2)

    // Le second appel pair bien le tool_result au tool_use par id, et porte
    // le résultat réel de l'opération (jamais un texte inventé).
    const messagesSecondAppel = appelerModele.mock.calls[1][0].messages
    const dernierMessage = messagesSecondAppel.at(-1)!
    expect(dernierMessage.content).toEqual([
      { type: 'tool_result', tool_use_id: 'tool-1', content: expect.stringContaining('genererRendu'), is_error: false },
    ])

    // Le texte de clôture RÉDIGÉ PAR LE MODÈLE est ce qui est affiché/persisté.
    expect(messages.at(-1)).toEqual({ role: 'assistant', content: 'Voilà ton rendu, il est prêt à être contrôlé.' })
  })

  it("marque is_error sur le tool_result quand l'opération a échoué", async () => {
    const { depot } = depotMemoire({ ...dossierBase, etat: 'A_CORRIGER' })
    const falEchec = vi.fn<typeof import('../fal/client').genererEtAttendre>(async () => ({
      statut: 'echec' as const,
      code: 'fal_ai_echec' as const,
      message: 'Panne fournisseur.',
    }))
    const appelerModele = vi.fn<AppelModele>()
    appelerModele
      .mockResolvedValueOnce({
        content: [{ type: 'tool_use', id: 'tool-2', name: 'corrigerRendu', input: { elementAModifier: 'Façade', resultatAttendu: 'Plus claire', categorie: 'MATERIAL' } }],
      })
      .mockResolvedValueOnce({ content: [{ type: 'text', text: 'La correction a échoué, on réessaie ?' }] })

    await executerTourConversationnel(depot, appelerModele, falEchec, {
      dossier: { ...dossierBase, etat: 'A_CORRIGER' },
      nouveauMessage: 'Corrige la façade.',
      actorId: 'user-1',
    })

    const toolResult = (appelerModele.mock.calls[1][0].messages.at(-1)!.content as Array<{ is_error?: boolean }>)[0]
    expect(toolResult.is_error).toBe(true)
  })

  it("n'exécute jamais un second tool_use enchaîné par le modèle (limite d'itérations)", async () => {
    contexteFetchOk()
    const { depot, evenements } = depotMemoire(dossierBase)
    const appelerModele = vi.fn<AppelModele>()
    appelerModele
      .mockResolvedValueOnce({ content: [{ type: 'tool_use', id: 'tool-3', name: 'genererRendu', input: {} }] })
      // Le modèle tente d'enchaîner une seconde opération au lieu de clore en texte.
      .mockResolvedValueOnce({ content: [{ type: 'tool_use', id: 'tool-4', name: 'genererRendu', input: {} }] })

    await executerTourConversationnel(depot, appelerModele, falSucces, {
      dossier: dossierBase,
      nouveauMessage: 'Lance la génération.',
      actorId: 'user-1',
    })

    // Un seul appel fal.ai réel — jamais un second déclenché par la tentative de chaînage.
    expect(falSucces).toHaveBeenCalledTimes(1)
    expect(appelerModele).toHaveBeenCalledTimes(2) // jamais un 3ᵉ appel modèle
    expect(evenements.some((e) => e.type === 'boucle_outil_limite_atteinte')).toBe(true)
  })

  it('reste sur le résumé templated si la clôture échoue (le tour ne plante jamais pour autant)', async () => {
    contexteFetchOk()
    const { depot, messages } = depotMemoire(dossierBase)
    const appelerModele = vi.fn<AppelModele>()
    appelerModele
      .mockResolvedValueOnce({ content: [{ type: 'tool_use', id: 'tool-5', name: 'genererRendu', input: {} }] })
      .mockRejectedValueOnce(new Error('Réseau indisponible.'))

    const resultat = await executerTourConversationnel(depot, appelerModele, falSucces, {
      dossier: dossierBase,
      nouveauMessage: 'Lance la génération.',
      actorId: 'user-1',
    })

    expect(resultat.type).toBe('operation') // l'opération reste acquise
    expect(messages.at(-1)).toEqual({ role: 'assistant', content: expect.stringContaining('genererRendu exécutée') })
  })
})
