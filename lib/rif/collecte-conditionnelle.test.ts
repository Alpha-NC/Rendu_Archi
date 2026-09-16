import { describe, expect, it } from 'vitest'
import { determinerParcoursCollecte, QUESTIONS_TRONC_COMMUN } from './collecte-conditionnelle'
import type { EtatQuestion } from './collecte-conditionnelle'

function etatDe(traitements: ReturnType<typeof determinerParcoursCollecte>['traitements'], question: string) {
  return traitements.find((t) => t.question === question)?.etat
}

describe('determinerParcoursCollecte — couverture des 8 questions', () => {
  it('traite toujours les 8 questions du tronc commun, quelle que soit la combinaison', () => {
    const combinaisons: Array<[Parameters<typeof determinerParcoursCollecte>[0], Parameters<typeof determinerParcoursCollecte>[1]]> = [
      ['photomontage_controle', 'administratif_sobre'],
      ['photomontage_controle', 'presentation_naturelle'],
      ['photomontage_controle', 'commercial'],
      ['retexturation_revit', 'presentation_naturelle'],
      ['retexturation_revit', 'commercial'],
      ['retexturation_contextualisee', 'presentation_naturelle'],
      ['retexturation_contextualisee', 'administratif_sobre'],
      ['retexturation_contextualisee', 'commercial'],
      [null, null],
    ]
    for (const [mode, style] of combinaisons) {
      const parcours = determinerParcoursCollecte(mode, style)
      expect(parcours.traitements.map((t) => t.question)).toEqual([...QUESTIONS_TRONC_COMMUN])
    }
  })
})

describe('ENG-004 §4.1 — Photomontage contrôlé + Administratif sobre', () => {
  const parcours = determinerParcoursCollecte('photomontage_controle', 'administratif_sobre')

  it('est documentée', () => {
    expect(parcours.combinaisonDocumentee).toBe(true)
  })

  it('retire la question lumière (remplacée par une phrase, pas une question)', () => {
    expect(etatDe(parcours.traitements, 'lumiere')).toBe('retiree')
  })

  it('réduit environnement à la seule question de suppression', () => {
    expect(etatDe(parcours.traitements, 'environnement')).toBe('reduite')
  })

  it('convertit style et éléments secondaires en confirmations', () => {
    expect(etatDe(parcours.traitements, 'style')).toBe('convertie_confirmation')
    expect(etatDe(parcours.traitements, 'elements_secondaires')).toBe('convertie_confirmation')
  })

  it('sert de traitement par défaut tant que le style photomontage_controle n\'est pas confirmé (style=null)', () => {
    const parcoursSansStyle = determinerParcoursCollecte('photomontage_controle', null)
    expect(parcoursSansStyle).toEqual(parcours)
  })
})

describe('ENG-004 §4.2 — Photomontage contrôlé + Présentation naturelle', () => {
  const parcours = determinerParcoursCollecte('photomontage_controle', 'presentation_naturelle')

  it('laisse la question environnement ouverte (réduite, pas retirée)', () => {
    expect(etatDe(parcours.traitements, 'environnement')).toBe('reduite')
  })

  it('convertit lumière en confirmation (direction déjà fixée par le style)', () => {
    expect(etatDe(parcours.traitements, 'lumiere')).toBe('convertie_confirmation')
  })

  it("n'ajoute aucune question additionnelle", () => {
    expect(parcours.questionsAdditionnelles).toEqual([])
  })
})

describe('ENG-004 §4.3 — Photomontage contrôlé + Commercial', () => {
  const parcours = determinerParcoursCollecte('photomontage_controle', 'commercial')

  it('inverse le traitement des éléments secondaires (encouragés, pas tolérés)', () => {
    expect(etatDe(parcours.traitements, 'elements_secondaires')).toBe('inversee' satisfies EtatQuestion)
  })

  it('ajoute la question du moment de la journée et sa sous-question conditionnelle', () => {
    const ids = parcours.questionsAdditionnelles.map((q) => q.id)
    expect(ids).toContain('moment_journee')
    expect(ids).toContain('eclairages_ponctuels')
    const sousQuestion = parcours.questionsAdditionnelles.find((q) => q.id === 'eclairages_ponctuels')
    expect(sousQuestion?.condition).toMatch(/fin de journée|crépuscule/)
  })

  it('laisse la question lumière du tronc commun inchangée (l\'ajout est distinct, pas un remplacement)', () => {
    expect(etatDe(parcours.traitements, 'lumiere')).toBe('inchangee')
  })
})

describe('ENG-004 §4.4 — Retexturation Revit', () => {
  it('retire la question d\'implantation (sans objet sans photo)', () => {
    const parcours = determinerParcoursCollecte('retexturation_revit', 'presentation_naturelle')
    expect(etatDe(parcours.traitements, 'mode_implantation')).toBe('retiree')
  })

  it('réduit le style à deux choix et exclut Administratif sobre (ADR-013)', () => {
    const parcours = determinerParcoursCollecte('retexturation_revit', 'presentation_naturelle')
    const traitementStyle = parcours.traitements.find((t) => t.question === 'style')
    expect(traitementStyle?.etat).toBe('reduite')
    expect(traitementStyle?.precision).toMatch(/ADR-013/)
  })

  it('rend la question lumière à nouveau pleinement ouverte (aucune photo ne la contraint)', () => {
    const parcours = determinerParcoursCollecte('retexturation_revit', 'commercial')
    expect(etatDe(parcours.traitements, 'lumiere')).toBe('inchangee')
  })
})

describe('ENG-004 §4.5 — Retexturation contextualisée + Présentation naturelle (cas standard)', () => {
  const parcours = determinerParcoursCollecte('retexturation_contextualisee', 'presentation_naturelle')

  it('est documentée', () => {
    expect(parcours.combinaisonDocumentee).toBe(true)
  })

  it('reformule la question environnement en classification par élément (pas une réduction, pas une confirmation)', () => {
    expect(etatDe(parcours.traitements, 'environnement')).toBe('reformulee')
  })

  it('retire la question lumière (remplacée par une phrase de référence de contexte)', () => {
    expect(etatDe(parcours.traitements, 'lumiere')).toBe('retiree')
  })

  it('sert de traitement par défaut tant que le style n\'est pas confirmé (style=null)', () => {
    const parcoursSansStyle = determinerParcoursCollecte('retexturation_contextualisee', null)
    expect(parcoursSansStyle).toEqual(parcours)
  })
})

describe('ENG-004 §4.6 — Retexturation contextualisée + Administratif sobre', () => {
  it('réduit environnement (conservation par défaut), contrairement au cas standard reformulé', () => {
    const parcours = determinerParcoursCollecte('retexturation_contextualisee', 'administratif_sobre')
    expect(etatDe(parcours.traitements, 'environnement')).toBe('reduite')
  })
})

describe('ENG-004 §4.7 — Retexturation contextualisée + Commercial', () => {
  const parcours = determinerParcoursCollecte('retexturation_contextualisee', 'commercial')

  it('reformule aussi la question environnement (classification par élément)', () => {
    expect(etatDe(parcours.traitements, 'environnement')).toBe('reformulee')
  })

  it('inverse le traitement des éléments secondaires et ajoute la question du moment de la journée', () => {
    expect(etatDe(parcours.traitements, 'elements_secondaires')).toBe('inversee')
    expect(parcours.questionsAdditionnelles.map((q) => q.id)).toContain('moment_journee')
  })
})

describe('Mode non pressenti — aucune combinaison ne peut être documentée', () => {
  it("ne réduit, ne retire ni ne convertit aucune question — jamais d'invention de règle", () => {
    const parcours = determinerParcoursCollecte(null, 'presentation_naturelle')
    expect(parcours.combinaisonDocumentee).toBe(false)
    expect(parcours.traitements.every((t) => t.etat === 'inchangee')).toBe(true)
    expect(parcours.questionsAdditionnelles).toEqual([])
  })
})

describe('Mode inconnu (null) — rien n\'est encore pressenti', () => {
  it("traite toutes les questions comme inchangées, sans branchement prématuré", () => {
    const parcours = determinerParcoursCollecte(null, null)
    expect(parcours.combinaisonDocumentee).toBe(false)
    expect(parcours.traitements.every((t) => t.etat === 'inchangee')).toBe(true)
  })
})
