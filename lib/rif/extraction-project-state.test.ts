import { describe, expect, it } from 'vitest'
import { creerProjectStateVide } from './project-state'
import { appliquerMiseAJourFicheProjet } from './extraction-project-state'

const contexte = { sourceId: 'conversation-1' }

describe('appliquerMiseAJourFicheProjet — fonction pure', () => {
  it('ne mute jamais le ProjectState reçu en entrée', () => {
    const etat = creerProjectStateVide('P-1')
    const copie = JSON.parse(JSON.stringify(etat))
    appliquerMiseAJourFicheProjet(etat, { mode: 'retexturation_revit' }, contexte)
    expect(etat).toEqual(copie)
  })

  it('ajoute un matériau provisoire avec ses métadonnées de traçabilité', () => {
    const etat = creerProjectStateVide('P-1')
    const { suivant, ignores } = appliquerMiseAJourFicheProjet(
      etat,
      { materiaux: [{ element: 'facade_extension', valeur: 'enduit clair', statut: 'provisional', confidence: 0.8 }] },
      contexte,
    )
    expect(ignores).toEqual([])
    expect(suivant.materials.facade_extension).toMatchObject({
      value: 'enduit clair',
      status: 'provisional',
      source_id: 'conversation-1',
      authority: 'utilisateur',
      confidence: 0.8,
    })
  })

  it('horodate validated_at uniquement pour un statut validated', () => {
    const etat = creerProjectStateVide('P-1')
    const { suivant } = appliquerMiseAJourFicheProjet(
      etat,
      { materiaux: [{ element: 'toiture', valeur: 'tuile romane', statut: 'validated' }] },
      contexte,
    )
    expect(suivant.materials.toiture.validated_at).toBeDefined()

    const { suivant: suivant2 } = appliquerMiseAJourFicheProjet(
      etat,
      { materiaux: [{ element: 'toiture', valeur: 'tuile romane', statut: 'provisional' }] },
      contexte,
    )
    expect(suivant2.materials.toiture.validated_at).toBeUndefined()
  })

  it('ne dégrade jamais un matériau validé par une mise à jour provisoire — et le signale', () => {
    const etat = creerProjectStateVide('P-1')
    const { suivant: etatValide } = appliquerMiseAJourFicheProjet(
      etat,
      { materiaux: [{ element: 'facade_extension', valeur: 'enduit clair', statut: 'validated' }] },
      contexte,
    )

    const { suivant, ignores } = appliquerMiseAJourFicheProjet(
      etatValide,
      { materiaux: [{ element: 'facade_extension', valeur: 'bardage bois', statut: 'provisional' }] },
      contexte,
    )

    expect(suivant.materials.facade_extension.value).toBe('enduit clair') // inchangé
    expect(ignores).toEqual([
      { champ: 'materials.facade_extension', raison: expect.stringContaining('déjà validé') },
    ])
  })

  it('accepte de remplacer une valeur validée par une nouvelle confirmation validée (re-confirmation explicite)', () => {
    const etat = creerProjectStateVide('P-1')
    const { suivant: etatValide } = appliquerMiseAJourFicheProjet(
      etat,
      { materiaux: [{ element: 'facade_extension', valeur: 'enduit clair', statut: 'validated' }] },
      contexte,
    )
    const { suivant, ignores } = appliquerMiseAJourFicheProjet(
      etatValide,
      { materiaux: [{ element: 'facade_extension', valeur: 'bardage bois', statut: 'validated' }] },
      contexte,
    )
    expect(suivant.materials.facade_extension.value).toBe('bardage bois')
    expect(ignores).toEqual([])
  })

  it('applique la même règle de non-régression aux ValeurTracee simples (géométrie, implantation, zone, lumière)', () => {
    const etat = creerProjectStateVide('P-1')
    const { suivant: etatValide } = appliquerMiseAJourFicheProjet(
      etat,
      { geometrie: { valeur: 'R+1, toiture deux pans', statut: 'validated' } },
      contexte,
    )
    const { suivant, ignores } = appliquerMiseAJourFicheProjet(
      etatValide,
      { geometrie: { valeur: 'plain-pied', statut: 'provisional' } },
      contexte,
    )
    expect(suivant.geometrie?.value).toBe('R+1, toiture deux pans')
    expect(ignores[0]?.champ).toBe('geometrie')
  })

  it('remplace directement les champs sans statut (mode, style, usage, interdictions, environnement, caméra)', () => {
    const etat = creerProjectStateVide('P-1')
    const { suivant } = appliquerMiseAJourFicheProjet(
      etat,
      {
        mode: 'photomontage_controle',
        style: 'photomontage_administratif',
        cameraCompatibility: 'Compatible',
        usage: ['insertion_administrative'],
        interdictions: ['Aucune piscine visible'],
        environnementAConserver: ['haie_ouest'],
      },
      contexte,
    )
    expect(suivant.mode).toBe('photomontage_controle')
    expect(suivant.style).toBe('photomontage_administratif')
    expect(suivant.camera_compatibility).toBe('Compatible')
    expect(suivant.usage).toEqual(['insertion_administrative'])
    expect(suivant.interdictions).toEqual(['Aucune piscine visible'])
    expect(suivant.environnement_a_conserver).toEqual(['haie_ouest'])
  })

  it('ignore silencieusement rien : un champ non fourni dans la mise à jour reste identique', () => {
    const etat = { ...creerProjectStateVide('P-1'), mode: 'retexturation_revit' as const }
    const { suivant } = appliquerMiseAJourFicheProjet(etat, { style: 'commercial' }, contexte)
    expect(suivant.mode).toBe('retexturation_revit')
    expect(suivant.style).toBe('commercial')
  })
})
