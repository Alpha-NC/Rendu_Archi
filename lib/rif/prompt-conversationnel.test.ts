import { describe, expect, it } from 'vitest'
import { determinerParcoursCollecte } from './collecte-conditionnelle'
import { construireSystemPrompt } from './prompt-conversationnel'

const parcours = determinerParcoursCollecte(null, null)

describe('construireSystemPrompt — contexte cible de rendu (Lot 1, D-22)', () => {
  it('signale explicitement l\'absence de cible active (dossier legacy)', () => {
    const prompt = construireSystemPrompt({
      modeResolu: null,
      styleResolu: null,
      usageAdministratif: false,
      parcours,
      activeRenderTarget: null,
    })
    expect(prompt).toMatch(/Aucune cible de rendu active/)
  })

  it('mentionne la cible active par son nom et son OutputType quand elle existe', () => {
    const prompt = construireSystemPrompt({
      modeResolu: null,
      styleResolu: null,
      usageAdministratif: false,
      parcours,
      activeRenderTarget: { id: 'cible-1', name: 'Perspective jardin', outputType: 'PHOTOREALISTIC_PERSPECTIVE' },
    })
    expect(prompt).toMatch(/Cible de rendu active : « Perspective jardin » \(PHOTOREALISTIC_PERSPECTIVE, id cible-1\)/)
  })
})
