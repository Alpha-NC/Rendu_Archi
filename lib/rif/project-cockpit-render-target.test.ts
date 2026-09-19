import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DossierActuel, GenerationDetail } from '@/lib/rif/depot'
import type { RenderTarget } from '@/lib/rif/render-targets'
import { creerProjectStateVide } from '@/lib/rif/project-state'

/**
 * Lot 4 UX Product Integration — couvre la logique nouvelle de ProjectCockpit
 * (RenderTarget UX, filtrage par cible, libellés OutputType) sans réseau réel
 * ni backend Neon : mock de `fetch` et des composants enfants (déjà testés
 * séparément ou purement présentationnels), suivant le même schéma que
 * lib/auth/connexion-page.test.ts (createRoot + act, pas de dépendance
 * @testing-library/react). Vitest ne collecte que lib/**\/*.test.ts
 * (vitest.config.mts) — ce test vit donc ici, pas à côté du composant.
 */

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
// Composants enfants déjà couverts ailleurs (ou purement présentationnels) —
// stubbés ici pour isoler la logique propre à ProjectCockpit et éviter leurs
// propres appels réseau (ConversationRif charge l'historique au montage).
vi.mock('@/app/dossiers/[dossierId]/ConversationRif', () => ({ default: () => null }))
vi.mock('@/app/dossiers/[dossierId]/DepotSources', () => ({ default: () => null }))
vi.mock('@/app/dossiers/[dossierId]/FicheProjet', () => ({ default: () => null }))
vi.mock('@/app/dossiers/[dossierId]/Timeline', () => ({ default: () => null }))
vi.mock('@/app/dossiers/[dossierId]/BoutonConfirmerFiche', () => ({ default: () => null }))

const { default: ProjectCockpit } = await import('@/app/dossiers/[dossierId]/ProjectCockpit')

function dossierFixture(overrides: Partial<DossierActuel> = {}): DossierActuel {
  return {
    id: 'dossier-1',
    dossierRef: 'RIF-0001',
    ownerId: 'user-1',
    etat: 'PRET_A_GENERER',
    projectState: creerProjectStateVide('dossier-1'),
    usageAdministratif: false,
    ...overrides,
  }
}

function generationFixture(overrides: Partial<GenerationDetail> = {}): GenerationDetail & { imageUrl: string | null } {
  return {
    id: 'g1',
    dossierId: 'dossier-1',
    type: 'initial',
    status: 'succeeded',
    batchId: 'batch-1',
    variantIndex: 0,
    isCanonical: false,
    projectStateRevision: 1,
    promptText: 'prompt',
    sourceFileIds: [],
    resultFileId: 'file-1',
    providerRequestId: null,
    costActual: null,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    renderTargetId: null,
    parentGenerationId: null,
    imageUrl: null,
    ...overrides,
  }
}

function renderTargetFixture(overrides: Partial<RenderTarget> = {}): RenderTarget {
  return {
    id: 'rt-1',
    dossierId: 'dossier-1',
    name: 'Perspective entrée',
    outputType: 'PHOTOREALISTIC_PERSPECTIVE',
    canonicalGenerationId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function reponseJson(corps: unknown) {
  return new Response(JSON.stringify(corps), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function texteUrl(input: RequestInfo | URL): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
}

describe('ProjectCockpit — RenderTarget UX (Lot 4)', () => {
  let conteneur: HTMLDivElement
  let racine: Root

  beforeEach(() => {
    conteneur = document.createElement('div')
    document.body.appendChild(conteneur)
  })

  afterEach(async () => {
    await act(async () => racine.unmount())
    conteneur.remove()
    vi.restoreAllMocks()
  })

  async function monter(
    dossier: DossierActuel,
    { generations = [], renderTargets = [] }: { generations?: ReturnType<typeof generationFixture>[]; renderTargets?: RenderTarget[] } = {},
  ) {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = texteUrl(input)
      const methode = init?.method ?? 'GET'
      if (url.endsWith('/generations') && methode === 'GET') return reponseJson({ success: true, generations })
      if (url.endsWith('/render-targets') && methode === 'GET') return reponseJson({ success: true, renderTargets })
      if (/\/generations\/[^/]+$/.test(url) && methode === 'GET') return reponseJson({ success: true, audit: null })
      throw new Error(`Route non mockée dans ce test : ${methode} ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    racine = createRoot(conteneur)
    await act(async () => {
      racine.render(React.createElement(ProjectCockpit, { dossier }))
    })
    // Laisse le setTimeout(0) de montage (load + loadTargets) et les
    // microtâches des promesses associées se résoudre.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })
    return fetchMock
  }

  it("sans aucune cible créée : mode legacy, le bouton Nouvelle génération reste actif", async () => {
    await monter(dossierFixture())

    expect(conteneur.textContent).toContain('Aucune vue créée')
    const bouton = [...conteneur.querySelectorAll('button')].find((b) => b.textContent?.includes('Nouvelle génération'))!
    expect(bouton.disabled).toBe(false)
  })

  it('avec des cibles créées mais aucune active : le bouton de génération est désactivé et explique pourquoi', async () => {
    const cible = renderTargetFixture()
    await monter(dossierFixture(), { renderTargets: [cible] })

    expect(conteneur.textContent).toContain('Perspective entrée')
    // Jamais la constante technique brute dans l'UI principale (mission §5).
    expect(conteneur.textContent).not.toContain('PHOTOREALISTIC_PERSPECTIVE')
    expect(conteneur.textContent).toContain('Sélectionnez une vue ci-dessus pour pouvoir générer un rendu.')
    const bouton = [...conteneur.querySelectorAll('button')].find((b) => b.textContent?.includes('Nouvelle génération'))!
    expect(bouton.disabled).toBe(true)
  })

  it('avec une cible active : affiche son libellé humain et filtre les générations par cible, legacy à part', async () => {
    const cible = renderTargetFixture({ id: 'rt-1', canonicalGenerationId: 'g1' })
    const dossier = dossierFixture({ projectState: { ...creerProjectStateVide('dossier-1'), active_render_target_id: 'rt-1' } })
    const generationCible = generationFixture({ id: 'g1', renderTargetId: 'rt-1', isCanonical: true })
    const generationLegacy = generationFixture({ id: 'g2', renderTargetId: null })

    await monter(dossier, { renderTargets: [cible], generations: [generationCible, generationLegacy] })

    // Libellé humain de l'OutputType affiché dans l'en-tête, jamais la constante brute.
    expect(conteneur.textContent).toContain('Perspective photoréaliste')
    expect(conteneur.textContent).not.toContain('PHOTOREALISTIC_PERSPECTIVE')

    const ongletGenerations = [...conteneur.querySelectorAll('button.cockpit-tab')].find((b) => b.textContent?.includes('Générations'))!
    await act(async () => {
      ongletGenerations.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(conteneur.textContent).toContain('1 version rechargée depuis le backend (+ 1 sans vue)')
    expect(conteneur.textContent).toContain('Anciennes générations')
    expect(conteneur.textContent).toContain('Perspective entrée · Réf.')
  })

  it('crée une cible puis l’active via deux appels distincts (création, puis activation)', async () => {
    const dossier = dossierFixture()
    const nouvelleCible = renderTargetFixture({ id: 'rt-2', name: 'Axonométrie générale', outputType: 'PHOTOREALISTIC_AXONOMETRY' })
    const appelsPost: string[] = []
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = texteUrl(input)
      const methode = init?.method ?? 'GET'
      if (url.endsWith('/generations') && methode === 'GET') return reponseJson({ success: true, generations: [] })
      if (url.endsWith('/render-targets') && methode === 'GET')
        return reponseJson({ success: true, renderTargets: appelsPost.includes('POST /render-targets') ? [nouvelleCible] : [] })
      if (url.endsWith('/render-targets') && methode === 'POST') {
        appelsPost.push('POST /render-targets')
        return reponseJson({ success: true, renderTarget: nouvelleCible })
      }
      if (url.endsWith('/render-targets/rt-2/activer') && methode === 'POST') {
        appelsPost.push('POST /activer')
        return reponseJson({ success: true })
      }
      throw new Error(`Route non mockée : ${methode} ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    racine = createRoot(conteneur)
    await act(async () => {
      racine.render(React.createElement(ProjectCockpit, { dossier }))
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })

    const boutonNouvelleVue = conteneur.querySelector('[aria-label="Nouvelle vue"]') as HTMLButtonElement
    await act(async () => {
      boutonNouvelleVue.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const input = conteneur.querySelector('.modal input') as HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    await act(async () => {
      setter?.call(input, 'Axonométrie générale')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const boutonCreer = [...conteneur.querySelectorAll('.modal button')].find((b) => b.textContent === 'Créer') as HTMLButtonElement
    await act(async () => {
      boutonCreer.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })

    // Création et activation restent deux appels distincts (Lot 1 §7 : la
    // cible créée n'est jamais activée automatiquement côté backend — c'est
    // le frontend qui enchaîne les deux actions explicitement).
    expect(appelsPost).toEqual(['POST /render-targets', 'POST /activer'])
  })
})
