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
        style: 'administratif_sobre',
        cameraCompatibility: 'Compatible',
        usage: ['insertion_administrative'],
        interdictions: ['Aucune piscine visible'],
        environnementAConserver: ['haie_ouest'],
      },
      contexte,
    )
    expect(suivant.mode).toBe('photomontage_controle')
    expect(suivant.style).toBe('administratif_sobre')
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

describe('contraintesLibertes — le modèle propose, il n\'autorise jamais (§24A.3)', () => {
  it('ajoute une politique proposée sans jamais y inscrire authorized_by', () => {
    const etat = creerProjectStateVide('P-1')
    const { suivant, ignores } = appliquerMiseAJourFicheProjet(
      etat,
      { contraintesLibertes: { pelouse: { appearance_policy: 'controlled', authorized_by: 'le-modele' } } },
      contexte,
    )
    expect(suivant.contraintes_libertes?.pelouse).toEqual({ appearance_policy: 'controlled' })
    expect(ignores).toEqual([])
  })

  it('préserve une autorisation existante quand la proposition ne l\'élargit pas', () => {
    const etat = {
      ...creerProjectStateVide('P-1'),
      contraintes_libertes: {
        pelouse: { appearance_policy: 'creative' as const, authorized_by: 'evariste', authorized_at: '2026-09-01T09:00:00.000Z' },
      },
    }
    const { suivant, ignores } = appliquerMiseAJourFicheProjet(
      etat,
      { contraintesLibertes: { pelouse: { appearance_policy: 'strict' } } },
      contexte,
    )
    expect(suivant.contraintes_libertes?.pelouse).toEqual({
      appearance_policy: 'strict',
      authorized_by: 'evariste',
      authorized_at: '2026-09-01T09:00:00.000Z',
    })
    expect(ignores).toEqual([])
  })

  it('fait repartir en attente une autorisation existante que la proposition élargit', () => {
    const etat = {
      ...creerProjectStateVide('P-1'),
      contraintes_libertes: {
        pelouse: { appearance_policy: 'controlled' as const, authorized_by: 'evariste', authorized_at: '2026-09-01T09:00:00.000Z' },
      },
    }
    const { suivant, ignores } = appliquerMiseAJourFicheProjet(
      etat,
      { contraintesLibertes: { pelouse: { appearance_policy: 'creative' } } },
      contexte,
    )
    expect(suivant.contraintes_libertes?.pelouse.appearance_policy).toBe('creative')
    expect(suivant.contraintes_libertes?.pelouse.authorized_by).toBeUndefined()
    expect(ignores).toEqual([
      { champ: 'contraintes_libertes.pelouse', raison: expect.stringContaining('retourne en attente') },
    ])
  })
})

describe('environnement — classification locked/editable/harmonizable (ARCH-002, D-19)', () => {
  it('ajoute un élément avec ses métadonnées de traçabilité, la source renseignée par le backend', () => {
    const etat = creerProjectStateVide('P-1')
    const { suivant, ignores } = appliquerMiseAJourFicheProjet(
      etat,
      {
        environnement: [
          { id: 'cloture_sud', type: 'cloture', etat: 'editable', actionAttendue: 'remplacer par du bois', statut: 'validated' },
        ],
      },
      contexte,
    )
    expect(ignores).toEqual([])
    expect(suivant.environnement).toEqual([
      {
        id: 'cloture_sud',
        type: 'cloture',
        etat: 'editable',
        source: 'conversation-1',
        validation: 'validated',
        action_attendue: 'remplacer par du bois',
      },
    ])
  })

  it('préserve les trois états tels quels — ne convertit jamais harmonizable en editable ni l\'inverse', () => {
    const etat = creerProjectStateVide('P-1')
    const { suivant } = appliquerMiseAJourFicheProjet(
      etat,
      { environnement: [{ id: 'pelouse', type: 'sol_vegetal', etat: 'harmonizable', statut: 'provisional' }] },
      contexte,
    )
    expect(suivant.environnement[0].etat).toBe('harmonizable')
  })

  it("ne convertit jamais une absence de décision en autorisation — statut reste 'provisional' si le modèle ne dit pas 'validated'", () => {
    const etat = creerProjectStateVide('P-1')
    const { suivant } = appliquerMiseAJourFicheProjet(
      etat,
      { environnement: [{ id: 'arbre_est', type: 'vegetation', etat: 'editable', statut: 'provisional' }] },
      contexte,
    )
    expect(suivant.environnement[0].validation).toBe('provisional')
  })

  it('ne dégrade jamais un élément déjà validé par une proposition provisoire — et le signale', () => {
    const etat = creerProjectStateVide('P-1')
    const { suivant: etatValide } = appliquerMiseAJourFicheProjet(
      etat,
      { environnement: [{ id: 'voisin_nord', type: 'batiment_voisin', etat: 'locked', statut: 'validated' }] },
      contexte,
    )
    const { suivant, ignores } = appliquerMiseAJourFicheProjet(
      etatValide,
      { environnement: [{ id: 'voisin_nord', type: 'batiment_voisin', etat: 'editable', statut: 'provisional' }] },
      contexte,
    )
    expect(suivant.environnement[0].etat).toBe('locked') // inchangé
    expect(ignores).toEqual([
      { champ: 'environnement.voisin_nord', raison: expect.stringContaining('déjà validé') },
    ])
  })

  it('met à jour un élément existant par id plutôt que de le dupliquer', () => {
    const etat = {
      ...creerProjectStateVide('P-1'),
      environnement: [{ id: 'pelouse', type: 'sol_vegetal', etat: 'locked' as const }],
    }
    const { suivant } = appliquerMiseAJourFicheProjet(
      etat,
      { environnement: [{ id: 'pelouse', type: 'sol_vegetal', etat: 'harmonizable', statut: 'validated' }] },
      contexte,
    )
    expect(suivant.environnement).toHaveLength(1)
    expect(suivant.environnement[0].etat).toBe('harmonizable')
  })

  it('ne mute jamais le ProjectState reçu en entrée', () => {
    const etat = { ...creerProjectStateVide('P-1'), environnement: [{ id: 'x', type: 'y', etat: 'locked' as const }] }
    const copie = JSON.parse(JSON.stringify(etat))
    appliquerMiseAJourFicheProjet(
      etat,
      { environnement: [{ id: 'x', type: 'y', etat: 'editable', statut: 'validated' }] },
      contexte,
    )
    expect(etat).toEqual(copie)
  })
})
