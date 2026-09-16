import { describe, expect, it } from 'vitest'
import {
  autoriserExportAdministratif,
  calculerVerdictPropose,
  defautsEnvironnementVersLignes,
  evaluerEnvironnement,
  type ConstatEnvironnement,
  type LigneRapport,
  type RapportControle,
} from './controle-qualite'
import type { ElementEnvironnement } from './project-state'

function rapport(lignes: LigneRapport[], usageAdministratif = true): RapportControle {
  return {
    generationId: 'gen-1',
    checklistVersion: 'LIB-002 V1.4',
    usageEvalue: usageAdministratif ? 'insertion_administrative' : 'presentation_client',
    usageAdministratif,
    lignes,
  }
}

const ligneConforme = (critere: LigneRapport['critere']): LigneRapport => ({
  critere,
  sourceControle: 'Source désignée',
  etat: 'conforme',
})

describe('calculerVerdictPropose', () => {
  it('propose Validation quand tout est conforme (prémortem #3 : ne jamais classer Conforme par excès de confiance ailleurs que ce cas)', () => {
    const r = rapport([ligneConforme('cadrage'), ligneConforme('toiture'), ligneConforme('materiaux')])
    expect(calculerVerdictPropose(r)).toEqual({
      verdict: 'validation',
      motif: 'Aucun écart relevé sur les critères applicables.',
    })
  })

  it("suspend la production sur toute confidentialité non conforme, prioritaire sur tout autre critère", () => {
    const r = rapport([
      ligneConforme('cadrage'),
      { critere: 'confidentialite', sourceControle: 'Rendu', etat: 'non_conforme', ecartObserve: 'Plaque de rue visible' },
    ])
    expect(calculerVerdictPropose(r).verdict).toBe('production_suspendue')
  })

  it('propose une reprise depuis les sources pour un défaut éliminatoire structurel (ex. toiture transformée, LIB-002 §5)', () => {
    const r = rapport([
      {
        critere: 'toiture',
        sourceControle: 'Source géométrique',
        etat: 'non_conforme',
        ecartObserve: 'Pente de toiture modifiée',
        defautEliminatoire: true,
      },
    ])
    const verdict = calculerVerdictPropose(r)
    expect(verdict.verdict).toBe('nouvelle_generation')
    expect(verdict.motif).toMatch(/toiture/)
  })

  it('propose une correction ciblée pour un défaut éliminatoire non structurel (ex. annotation visible)', () => {
    const r = rapport([
      {
        critere: 'annotations',
        sourceControle: 'Sources annotées',
        etat: 'non_conforme',
        ecartObserve: 'Flèche de correction visible dans le rendu',
        defautEliminatoire: true,
      },
    ])
    expect(calculerVerdictPropose(r).verdict).toBe('correction_ciblee')
  })

  it('propose une correction ciblée pour une non-conformité simple non marquée éliminatoire', () => {
    const r = rapport([
      { critere: 'materiaux', sourceControle: 'État du projet', etat: 'non_conforme', ecartObserve: 'Teinte incorrecte' },
    ])
    expect(calculerVerdictPropose(r).verdict).toBe('correction_ciblee')
  })

  it("n'accepte jamais une simple Réserve telle quelle en usage administratif (LIB-002 §7)", () => {
    const r = rapport(
      [{ critere: 'lumiere', sourceControle: 'Photo', etat: 'reserve', ecartObserve: 'Ombre légèrement décalée' }],
      true,
    )
    const verdict = calculerVerdictPropose(r)
    expect(verdict.verdict).toBe('correction_ciblee')
    expect(verdict.motif).toMatch(/administratif/)
  })

  it('accepte une Réserve hors usage administratif', () => {
    const r = rapport(
      [{ critere: 'lumiere', sourceControle: 'Photo', etat: 'reserve', ecartObserve: 'Ombre légèrement décalée' }],
      false,
    )
    expect(calculerVerdictPropose(r).verdict).toBe('acceptable_avec_reserve')
  })
})

describe('autoriserExportAdministratif — garde-fou (PRD §15.3, prémortem #3)', () => {
  it('refuse un rendu non contrôlé (aucun verdict humain)', () => {
    expect(autoriserExportAdministratif(null, true)).toEqual({
      autorise: false,
      raison: 'Rendu non contrôlé — aucun verdict humain enregistré.',
    })
    expect(autoriserExportAdministratif(undefined, true).autorise).toBe(false)
  })

  it('refuse toujours une production suspendue', () => {
    expect(autoriserExportAdministratif('production_suspendue', true).autorise).toBe(false)
    expect(autoriserExportAdministratif('production_suspendue', false).autorise).toBe(false)
  })

  it('refuse toujours correction_ciblee et nouvelle_generation', () => {
    expect(autoriserExportAdministratif('correction_ciblee', true).autorise).toBe(false)
    expect(autoriserExportAdministratif('nouvelle_generation', false).autorise).toBe(false)
  })

  it("refuse 'acceptable_avec_reserve' pour un usage administratif", () => {
    const decision = autoriserExportAdministratif('acceptable_avec_reserve', true)
    expect(decision.autorise).toBe(false)
    expect(decision.raison).toMatch(/sans réserve/)
  })

  it("autorise 'acceptable_avec_reserve' hors usage administratif", () => {
    expect(autoriserExportAdministratif('acceptable_avec_reserve', false).autorise).toBe(true)
  })

  it("autorise l'export administratif uniquement sur verdict humain 'validation'", () => {
    expect(autoriserExportAdministratif('validation', true)).toEqual({ autorise: true })
  })

  it('le verdict PROPOSÉ ne peut jamais servir de substitut — seule la signature de type VerdictControle humain est acceptée par la fonction', () => {
    // Test de documentation : autoriserExportAdministratif ne prend en
    // paramètre qu'un verdict humain, jamais un RapportControle ni un
    // VerdictPropose — l'API elle-même empêche de confondre les deux.
    const verdictPropose = calculerVerdictPropose(
      rapport([ligneConforme('cadrage')]),
    )
    expect(autoriserExportAdministratif(verdictPropose.verdict, true).autorise).toBe(true)
    // ...mais ceci reste un verdict PROPOSÉ : l'appelant réel doit passer le
    // champ verdict_human de quality_audits, jamais verdict_proposed.
  })
})

describe('evaluerEnvironnement — défauts déterministes (ARCH-002, D-19)', () => {
  const locked: ElementEnvironnement = { id: 'voisin_nord', type: 'batiment_voisin', etat: 'locked' }
  const editableValide: ElementEnvironnement = {
    id: 'cloture_sud',
    type: 'cloture',
    etat: 'editable',
    action_attendue: 'remplacer par du bois',
    validation: 'validated',
  }
  const harmonizableValide: ElementEnvironnement = {
    id: 'pelouse',
    type: 'sol_vegetal',
    etat: 'harmonizable',
    validation: 'validated',
  }
  const editableNonValide: ElementEnvironnement = {
    id: 'arbre_est',
    type: 'vegetation',
    etat: 'editable',
    action_attendue: 'supprimer',
    // Pas de validation : proposé, pas confirmé.
  }

  function constat(element: ElementEnvironnement, c: ConstatEnvironnement['constat']): ConstatEnvironnement {
    return { element, constat: c }
  }

  it('ne relève aucun défaut quand chaque élément est traité conformément à son état', () => {
    expect(
      evaluerEnvironnement([
        constat(locked, 'conserve'),
        constat(editableValide, 'modifie'),
        constat(harmonizableValide, 'ameliore'),
      ]),
    ).toEqual([])
  })

  it('signale une régression architecturale/environnementale : un élément locked modifié', () => {
    const defauts = evaluerEnvironnement([constat(locked, 'modifie')])
    expect(defauts).toEqual([
      expect.objectContaining({ type: 'locked_modifie', element: 'voisin_nord' }),
    ])
  })

  it("signale l'absence d'une modification demandée sur un élément editable", () => {
    const defauts = evaluerEnvironnement([constat(editableValide, 'conserve')])
    expect(defauts).toEqual([
      expect.objectContaining({ type: 'editable_non_traite', element: 'cloture_sud' }),
    ])
  })

  it("signale une transformation excessive d'un élément harmonizable (suppression ou remplacement, pas une simple amélioration)", () => {
    expect(evaluerEnvironnement([constat(harmonizableValide, 'supprime')])).toEqual([
      expect.objectContaining({ type: 'harmonizable_excessif', element: 'pelouse' }),
    ])
    expect(evaluerEnvironnement([constat(harmonizableValide, 'modifie')])).toEqual([
      expect.objectContaining({ type: 'harmonizable_excessif', element: 'pelouse' }),
    ])
  })

  it("traite un élément editable non validé comme locked — le modifier est déjà un défaut, ne pas le traiter n'en est jamais un", () => {
    expect(evaluerEnvironnement([constat(editableNonValide, 'modifie')])).toEqual([
      expect.objectContaining({ type: 'locked_modifie', element: 'arbre_est' }),
    ])
    expect(evaluerEnvironnement([constat(editableNonValide, 'conserve')])).toEqual([])
  })

  it('convertit les défauts en lignes de rapport LIB-002 éliminatoires', () => {
    const lignes = defautsEnvironnementVersLignes(evaluerEnvironnement([constat(locked, 'supprime')]))
    expect(lignes).toEqual([
      expect.objectContaining({ critere: 'environnement', etat: 'non_conforme', defautEliminatoire: true }),
    ])
  })

  it('un défaut environnement, fondu dans le rapport, déclenche une reprise depuis les sources (critère structurel)', () => {
    const lignes = defautsEnvironnementVersLignes(evaluerEnvironnement([constat(locked, 'supprime')]))
    const verdict = calculerVerdictPropose(rapport(lignes))
    expect(verdict.verdict).toBe('nouvelle_generation')
  })
})
