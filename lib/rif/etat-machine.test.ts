import { describe, expect, it } from 'vitest'
import { creerProjectStateVide } from './project-state'
import {
  ETATS_DOSSIER,
  transitionEstDansLeGraphe,
  transitionsPossiblesDepuis,
  verifierPrecondition,
} from './etat-machine'

describe('graphe des transitions', () => {
  it('couvre les 12 états du PRD V2.1 §17 (D-19 : fusion de deux états V1.3, 13→12)', () => {
    expect(ETATS_DOSSIER).toHaveLength(12)
  })

  it('autorise le tronc nominal complet', () => {
    const tronc: Array<[string, string]> = [
      ['BROUILLON', 'SOURCES_RECUES'],
      ['SOURCES_RECUES', 'SOURCES_ANALYSEES'],
      ['SOURCES_ANALYSEES', 'CONTEXTE_A_CONFIRMER'],
      ['CONTEXTE_A_CONFIRMER', 'PRET_A_GENERER'],
      ['PRET_A_GENERER', 'GENERATION_EN_COURS'],
      ['GENERATION_EN_COURS', 'CONTROLE_A_EXAMINER'],
      ['CONTROLE_A_EXAMINER', 'VALIDE'],
    ]
    for (const [depuis, vers] of tronc) {
      expect(
        transitionEstDansLeGraphe(depuis as never, vers as never),
        `${depuis} → ${vers} devrait être autorisé`,
      ).toBe(true)
    }
  })

  it("interdit de sauter des étapes (ex. BROUILLON directement vers PRÊT_À_GÉNÉRER)", () => {
    expect(transitionEstDansLeGraphe('BROUILLON', 'PRET_A_GENERER')).toBe(false)
  })

  it('VALIDÉ est un état terminal sans transition sortante', () => {
    expect(transitionsPossiblesDepuis('VALIDE')).toEqual([])
  })
})

describe('préconditions de transition', () => {
  it('refuse une transition hors graphe quel que soit le contexte', () => {
    const resultat = verifierPrecondition('BROUILLON', 'VALIDE', creerProjectStateVide('P-1'))
    expect(resultat.autorisee).toBe(false)
  })

  it('refuse SOURCES_ANALYSÉES sans vue Revit exploitable', () => {
    const resultat = verifierPrecondition(
      'SOURCES_RECUES',
      'SOURCES_ANALYSEES',
      creerProjectStateVide('P-1'),
      { vueRevitExploitable: false },
    )
    expect(resultat.autorisee).toBe(false)
    expect(resultat.raison).toMatch(/Revit/)
  })

  it('refuse SOURCES_ANALYSÉES avec des données confidentielles non traitées (D-19 : fusion des deux préconditions V1.3)', () => {
    const resultat = verifierPrecondition(
      'SOURCES_RECUES',
      'SOURCES_ANALYSEES',
      creerProjectStateVide('P-1'),
      { donneesConfidentiellesTraitees: false },
    )
    expect(resultat.autorisee).toBe(false)
    expect(resultat.raison).toMatch(/confidentielles/)
  })

  it('refuse PRÊT_À_GÉNÉRER sans confirmation explicite de la fiche projet', () => {
    const resultat = verifierPrecondition(
      'CONTEXTE_A_CONFIRMER',
      'PRET_A_GENERER',
      creerProjectStateVide('P-1'),
      { ficheProjetConfirmeeParEvariste: false },
    )
    expect(resultat.autorisee).toBe(false)
  })

  it('refuse GÉNÉRATION_EN_COURS sans révision confirmée du ProjectState (critère §22)', () => {
    const etatVide = creerProjectStateVide('P-1') // revision = 0
    const resultat = verifierPrecondition('PRET_A_GENERER', 'GENERATION_EN_COURS', etatVide)
    expect(resultat.autorisee).toBe(false)
    expect(resultat.raison).toMatch(/révision confirmée/)
  })

  it('autorise GÉNÉRATION_EN_COURS avec une révision confirmée', () => {
    const etatConfirme = { ...creerProjectStateVide('P-1'), revision: 1 }
    const resultat = verifierPrecondition('PRET_A_GENERER', 'GENERATION_EN_COURS', etatConfirme)
    expect(resultat.autorisee).toBe(true)
  })

  it('refuse VALIDÉ en usage administratif si le contrôle qualité n\'est pas conforme', () => {
    const etatConfirme = { ...creerProjectStateVide('P-1'), revision: 1 }
    const resultat = verifierPrecondition(
      'CONTROLE_A_EXAMINER',
      'VALIDE',
      etatConfirme,
      { usageAdministratif: true, dernierControleQualite: 'non_conforme' },
    )
    expect(resultat.autorisee).toBe(false)
  })

  it('autorise VALIDÉ hors usage administratif même sans contrôle qualité renseigné', () => {
    const etatConfirme = { ...creerProjectStateVide('P-1'), revision: 1 }
    const resultat = verifierPrecondition(
      'CONTROLE_A_EXAMINER',
      'VALIDE',
      etatConfirme,
      { usageAdministratif: false },
    )
    expect(resultat.autorisee).toBe(true)
  })
})
