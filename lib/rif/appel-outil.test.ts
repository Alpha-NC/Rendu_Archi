import { describe, expect, it } from 'vitest'
import { creerProjectStateVide } from './project-state'
import { analyserReponseModele, autoriserOperation } from './appel-outil'

const etatConfirme = { ...creerProjectStateVide('P-1'), revision: 1 }

describe('analyserReponseModele — détection des appels fantômes (prémortem #1)', () => {
  it('reconnaît un vrai tool_use', () => {
    const resultat = analyserReponseModele([
      { type: 'tool_use', name: 'genererRendu', input: { dossierId: 'd-1' } },
    ])
    expect(resultat).toEqual({
      genre: 'appel_reel',
      operation: 'genererRendu',
      entree: { dossierId: 'd-1' },
    })
  })

  it("détecte un appel simulé en texte (bloc de code JSON) et ne l'exécute pas", () => {
    const resultat = analyserReponseModele([
      {
        type: 'text',
        text: 'Je lance la génération :\n```json\ngenererRendu({"dossierId": "d-1"})\n```',
      },
    ])
    expect(resultat.genre).toBe('appel_simule_detecte')
    if (resultat.genre === 'appel_simule_detecte') {
      expect(resultat.operationEvoquee).toBe('genererRendu')
    }
  })

  it('détecte la forme "name": "corrigerRendu" imitant un schéma d\'outil', () => {
    const resultat = analyserReponseModele([
      { type: 'text', text: '{"type": "tool_use", "name": "corrigerRendu"}' },
    ])
    expect(resultat.genre).toBe('appel_simule_detecte')
  })

  it('donne la priorité au tool_use réel même si du texte bavard le précède', () => {
    const resultat = analyserReponseModele([
      { type: 'text', text: 'Je vais appeler genererRendu maintenant.' },
      { type: 'tool_use', name: 'genererRendu', input: { dossierId: 'd-2' } },
    ])
    expect(resultat.genre).toBe('appel_reel')
  })

  it('ne signale rien sur une réponse conversationnelle normale', () => {
    const resultat = analyserReponseModele([
      { type: 'text', text: 'Quelle est la teinte de la façade existante ?' },
    ])
    expect(resultat).toEqual({ genre: 'aucun_appel' })
  })

  it('signale un outil hors périmètre RIF', () => {
    const resultat = analyserReponseModele([{ type: 'tool_use', name: 'supprimerDossier' }])
    expect(resultat).toEqual({ genre: 'operation_inconnue', nom: 'supprimerDossier' })
  })
})

describe('autoriserOperation — revérification backend (PRD §11, §14)', () => {
  it('refuse une génération hors PRÊT_À_GÉNÉRER', () => {
    const decision = autoriserOperation('genererRendu', 'COLLECTE_EN_COURS', etatConfirme)
    expect(decision.autorisee).toBe(false)
  })

  it('refuse une génération sans révision confirmée du ProjectState', () => {
    const decision = autoriserOperation(
      'genererRendu',
      'PRET_A_GENERER',
      creerProjectStateVide('P-1'),
    )
    expect(decision.autorisee).toBe(false)
    expect(decision.raison).toMatch(/révision confirmée/)
  })

  it('autorise une génération depuis PRÊT_À_GÉNÉRER avec révision confirmée', () => {
    const decision = autoriserOperation('genererRendu', 'PRET_A_GENERER', etatConfirme)
    expect(decision.autorisee).toBe(true)
  })

  it('refuse une correction locale depuis un état qui ne le permet pas', () => {
    const decision = autoriserOperation('corrigerRendu', 'PRET_A_GENERER', etatConfirme)
    expect(decision.autorisee).toBe(false)
  })

  it('ne laisse pas une reprise passer pour une correction locale (D-09)', () => {
    // Depuis À_REPRENDRE, seule la reprise est licite — pas la correction.
    expect(autoriserOperation('corrigerRendu', 'A_REPRENDRE', etatConfirme).autorisee).toBe(
      false,
    )
    expect(
      autoriserOperation('reprendreDepuisSources', 'A_REPRENDRE', etatConfirme).autorisee,
    ).toBe(true)
    // Et inversement depuis À_CORRIGER.
    expect(
      autoriserOperation('reprendreDepuisSources', 'A_CORRIGER', etatConfirme).autorisee,
    ).toBe(false)
    expect(autoriserOperation('corrigerRendu', 'A_CORRIGER', etatConfirme).autorisee).toBe(
      true,
    )
  })
})
