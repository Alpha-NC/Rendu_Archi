import { describe, expect, it } from 'vitest'
import { libelleEvenement, paginerResultats } from './events'

describe('libelleEvenement — Lot 3 Project History (D-24)', () => {
  it('distingue génération initiale, correction et reprise pour un succès (generation_reussie)', () => {
    expect(libelleEvenement({ eventType: 'generation_reussie', payload: { type: 'initial' } })).toBe('Nouvelle génération créée')
    expect(libelleEvenement({ eventType: 'generation_reussie', payload: { type: 'correction' } })).toBe('Correction générée')
    expect(libelleEvenement({ eventType: 'generation_reussie', payload: { type: 'restart_from_sources' } })).toBe('Reprise générée')
  })

  it('distingue les mêmes cas pour un échec (generation_echouee)', () => {
    expect(libelleEvenement({ eventType: 'generation_echouee', payload: { type: 'correction' } })).toBe('Échec de la correction')
    expect(libelleEvenement({ eventType: 'generation_echouee', payload: { type: 'initial' } })).toBe('Échec de la génération')
  })

  it('libellé du verdict humain selon la valeur réelle, jamais un texte générique trompeur', () => {
    expect(libelleEvenement({ eventType: 'audit_qualite_enregistre', payload: { verdictHuman: 'validation' } })).toBe('Version validée')
    expect(libelleEvenement({ eventType: 'audit_qualite_enregistre', payload: { verdictHuman: 'production_suspendue' } })).toBe(
      'Production suspendue',
    )
    expect(libelleEvenement({ eventType: 'audit_qualite_enregistre', payload: { verdictHuman: 'correction_ciblee' } })).toBe(
      'Correction ou reprise demandée',
    )
  })

  it('retombe sur le code brut pour un type non mappé — jamais un texte inventé', () => {
    expect(libelleEvenement({ eventType: 'evenement_futur_inconnu', payload: {} })).toBe('evenement_futur_inconnu')
  })

  it('couvre les événements de sources/cibles déjà en place (Lot 1/2)', () => {
    expect(libelleEvenement({ eventType: 'source_deposee', payload: {} })).toBe('Source ajoutée')
    expect(libelleEvenement({ eventType: 'source_remplacee', payload: {} })).toBe('Source remplacée')
    expect(libelleEvenement({ eventType: 'cible_rendu_creee', payload: {} })).toBe('Cible de rendu créée')
    expect(libelleEvenement({ eventType: 'version_canonique_definie', payload: {} })).toBe('Version définie comme référence')
  })
})

describe('paginerResultats — cursor-based, jamais un offset (mission Lot 3 §8)', () => {
  const items = ['a', 'b', 'c']

  it("sans ligne supplémentaire (limite >= nombre de résultats), aucune page suivante", () => {
    const resultat = paginerResultats(items, 3, (x) => x)
    expect(resultat).toEqual({ page: ['a', 'b', 'c'], nextCursor: null })
  })

  it("avec une ligne supplémentaire (convention limite+1 côté SQL), détecte la page suivante sans l'inclure", () => {
    // Convention : l'appelant a demandé limite+1 = 3 lignes pour une limite réelle de 2.
    const resultat = paginerResultats(items, 2, (x) => x)
    expect(resultat.page).toEqual(['a', 'b'])
    expect(resultat.nextCursor).toBe('b')
  })

  it('un résultat vide ne produit jamais de curseur', () => {
    expect(paginerResultats([], 10, (x: string) => x)).toEqual({ page: [], nextCursor: null })
  })
})
