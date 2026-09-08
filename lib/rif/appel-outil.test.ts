import { describe, expect, it } from 'vitest'
import { creerProjectStateVide } from './project-state'
import { analyserReponseModele, autoriserAvancementParcours, autoriserOperation } from './appel-outil'

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

  it('détecte aussi un appel simulé à mettreAJourFicheProjet (D-15)', () => {
    const resultat = analyserReponseModele([
      { type: 'text', text: 'mettreAJourFicheProjet({"materiaux": []})' },
    ])
    expect(resultat.genre).toBe('appel_simule_detecte')
    if (resultat.genre === 'appel_simule_detecte') {
      expect(resultat.operationEvoquee).toBe('mettreAJourFicheProjet')
    }
  })

  it('autorise mettreAJourFicheProjet tant que la fiche est en collecte (D-15)', () => {
    for (const etat of [
      'BROUILLON',
      'SOURCES_RECUES',
      'SOURCES_CONTROLEES',
      'COLLECTE_EN_COURS',
      'FICHE_A_CONFIRMER',
    ] as const) {
      expect(autoriserOperation('mettreAJourFicheProjet', etat, etatConfirme).autorisee).toBe(true)
    }
  })

  it('refuse mettreAJourFicheProjet une fois la révision engagée (D-15)', () => {
    for (const etat of ['PRET_A_GENERER', 'GENERATION_EN_COURS', 'CONTROLE_A_EXAMINER', 'VALIDE'] as const) {
      expect(autoriserOperation('mettreAJourFicheProjet', etat, etatConfirme).autorisee).toBe(false)
    }
  })
})

describe('autoriserAvancementParcours — le modèle propose, le backend décide (PRD §8)', () => {
  it('autorise une avancée nominale du parcours de collecte', () => {
    expect(
      autoriserAvancementParcours('SOURCES_CONTROLEES', 'COLLECTE_EN_COURS', etatConfirme).autorisee,
    ).toBe(true)
    expect(
      autoriserAvancementParcours('COLLECTE_EN_COURS', 'FICHE_A_CONFIRMER', etatConfirme).autorisee,
    ).toBe(true)
  })

  it("refuse PRÊT_À_GÉNÉRER : le passage exige une action explicite d'Évariste (PRD §9.4)", () => {
    const decision = autoriserAvancementParcours('FICHE_A_CONFIRMER', 'PRET_A_GENERER', etatConfirme)
    expect(decision.autorisee).toBe(false)
    expect(decision.raison).toMatch(/PRET_A_GENERER/)
  })

  it("refuse les états de production, qui découlent des opérations et de l'audit", () => {
    for (const cible of ['GENERATION_EN_COURS', 'CONTROLE_A_EXAMINER', 'VALIDE', 'ECHEC'] as const) {
      expect(autoriserAvancementParcours('COLLECTE_EN_COURS', cible, etatConfirme).autorisee).toBe(false)
    }
  })

  it('autorise une suspension sur blocage majeur (PRD §9.2)', () => {
    expect(autoriserAvancementParcours('SOURCES_RECUES', 'SUSPENDU', etatConfirme).autorisee).toBe(true)
  })

  it('reste soumis aux préconditions : pas de contrôle des sources sans vue Revit exploitable', () => {
    const decision = autoriserAvancementParcours(
      'SOURCES_RECUES',
      'SOURCES_CONTROLEES',
      etatConfirme,
      { vueRevitExploitable: false },
    )
    expect(decision.autorisee).toBe(false)
    expect(decision.raison).toMatch(/Revit/)
  })

  it('refuse un saut hors du graphe même vers un état proposable', () => {
    expect(autoriserAvancementParcours('BROUILLON', 'FICHE_A_CONFIRMER', etatConfirme).autorisee).toBe(false)
  })
})
