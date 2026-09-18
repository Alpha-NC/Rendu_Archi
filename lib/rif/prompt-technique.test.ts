import { describe, expect, it } from 'vitest'
import { creerProjectStateVide } from './project-state'
import { construirePromptCorrection, construirePromptGeneration } from './prompt-technique'

function etatPhotomontageAdministratif() {
  return {
    ...creerProjectStateVide('P-1'),
    revision: 1,
    usage: ['insertion_administrative'],
    mode: 'photomontage_controle' as const,
    style: 'administratif_sobre' as const,
    camera_compatibility: 'Compatible' as const,
    sources: [
      { id: 'src-1', role_detected: 'revit_view' as const, role_confirmed: 'revit_view' as const, status: 'valid' as const },
      { id: 'src-2', role_detected: 'site_photo' as const, role_confirmed: 'site_photo' as const, status: 'valid' as const },
    ],
    locked: ['camera', 'openings', 'roof', 'existing_environment'],
    materials: {
      facade_extension: {
        value: 'enduit mineral clair',
        status: 'validated' as const,
        source_id: 'src-3',
        editable: false,
        locked: true,
        confidence: 0.91,
      },
    },
  }
}

describe('construirePromptGeneration (ENG-002)', () => {
  it('inclut les sept sections obligatoires du §4, même avec un ProjectState minimal', () => {
    const prompt = construirePromptGeneration(creerProjectStateVide('P-1'))
    expect(prompt).toMatch(/MODE DE PRODUCTION/)
    expect(prompt).toMatch(/CANEVAS PRINCIPAL/)
    expect(prompt).toMatch(/RÉFÉRENCES MATÉRIAU LIMITÉES/)
    expect(prompt).toMatch(/ZONES VERROUILLÉES/)
    expect(prompt).toMatch(/CONDITION DE BLOCAGE/)
    expect(prompt).toMatch(/ISOLATION/)
    expect(prompt).toMatch(/INTERDICTIONS/)
  })

  it('ajoute la clause du mode Photomontage contrôlé (§3.2) et référence la bonne source', () => {
    const prompt = construirePromptGeneration(etatPhotomontageAdministratif())
    expect(prompt).toMatch(/Utiliser la photographie réelle comme canevas fixe/)
    expect(prompt).toMatch(/Ne pas reconstruire la scène entière/)
    expect(prompt).toMatch(/src-2/) // site_photo, pas revit_view, pour ce mode
  })

  it('ajoute la clause Retexturation Revit (§3.1) et référence la vue Revit', () => {
    const etat = { ...etatPhotomontageAdministratif(), mode: 'retexturation_revit' as const }
    const prompt = construirePromptGeneration(etat)
    expect(prompt).toMatch(/Conserver strictement la caméra/)
    expect(prompt).toMatch(/src-1/)
  })

  it("cite la révision et le project_id dans la section ISOLATION (jamais un contexte étranger)", () => {
    const prompt = construirePromptGeneration(etatPhotomontageAdministratif())
    expect(prompt).toMatch(/P-1 \/ révision 1/)
  })

  it("n'invente jamais un matériau : renvoie une consigne de prudence si aucun n'est renseigné", () => {
    const prompt = construirePromptGeneration(creerProjectStateVide('P-1'))
    expect(prompt).toMatch(/respecter l'apparence visible des sources/)
  })

  it("signale honnêtement l'absence de pack de contraintes géométriques (ADR-021) — mode standard V2.1", () => {
    const prompt = construirePromptGeneration(creerProjectStateVide('P-1'))
    expect(prompt).toMatch(/PACK DE CONTRAINTES GÉOMÉTRIQUES\nAucun/)
    expect(prompt).toMatch(/vue Revit et l'axonométrie/)
  })

  it("donne la priorité au pack de contraintes géométriques quand il existe (ADR-021)", () => {
    const etat = {
      ...creerProjectStateVide('P-1'),
      geometryPack: { schemaVersion: 1, sourceFileId: 'file-3d-1', volumes: [{ id: 'v1' }], roofs: [{ id: 'r1' }] },
    }
    const prompt = construirePromptGeneration(etat)
    expect(prompt).toMatch(/Source modèle 3D file-3d-1 \(schéma v1\) fait autorité sur la géométrie/)
    expect(prompt).toMatch(/Champs extraits disponibles : volumes, roofs\./)
  })

  it('reprend fidèlement un matériau validé, avec sa provenance', () => {
    const prompt = construirePromptGeneration(etatPhotomontageAdministratif())
    expect(prompt).toMatch(/facade_extension : enduit mineral clair \(statut validated, source src-3\)/)
  })

  it('limite explicitement une référence matériau à l\'apparence de l\'élément ciblé (ADR-014)', () => {
    const etat = {
      ...etatPhotomontageAdministratif(),
      sources: [
        ...etatPhotomontageAdministratif().sources,
        { id: 'src-3', role_detected: 'material_reference' as const, role_confirmed: 'material_reference' as const, status: 'valid' as const, target: 'facade_extension' },
      ],
    }
    const prompt = construirePromptGeneration(etat)
    expect(prompt).toMatch(/apparence de l'élément « facade_extension » uniquement/)
  })
})

describe('construirePromptCorrection (ENG-003)', () => {
  it('inclut le contexte de correction complet (§7)', () => {
    const prompt = construirePromptCorrection(etatPhotomontageAdministratif(), {
      elementAModifier: 'Teinte de la façade extension',
      resultatAttendu: 'Enduit gris clair au lieu de blanc cassé.',
      categorie: 'MATERIAL',
    })
    expect(prompt).toMatch(/ÉLÉMENT À MODIFIER\nTeinte de la façade extension/)
    expect(prompt).toMatch(/RÉSULTAT ATTENDU\nEnduit gris clair au lieu de blanc cassé\./)
    expect(prompt).toMatch(/MARQUES À EXCLURE/)
  })

  it('réutilise les mêmes zones verrouillées que la génération initiale (pas de dérive entre les deux constructeurs)', () => {
    const etat = etatPhotomontageAdministratif()
    const promptGeneration = construirePromptGeneration(etat)
    const promptCorrection = construirePromptCorrection(etat, {
      elementAModifier: 'x',
      resultatAttendu: 'y',
      categorie: 'MATERIAL',
    })
    const extraireZones = (p: string) => p.match(/ZONES VERROUILLÉES\n([^\n]+)/)?.[1]
    expect(extraireZones(promptCorrection)).toBe(extraireZones(promptGeneration))
  })

  it('applique la clause du mode courant, identique à la génération initiale', () => {
    const etat = etatPhotomontageAdministratif()
    const promptCorrection = construirePromptCorrection(etat, { elementAModifier: 'x', resultatAttendu: 'y', categorie: 'MATERIAL' })
    expect(promptCorrection).toMatch(/Ne pas reconstruire la scène entière/)
  })

  it('inscrit la catégorie de correction (ADR-021) et rappelle que la géométrie verrouillée reste inchangée', () => {
    const prompt = construirePromptCorrection(etatPhotomontageAdministratif(), {
      elementAModifier: 'Pelouse',
      resultatAttendu: 'Plus verte',
      categorie: 'VEGETATION',
    })
    expect(prompt).toMatch(/CATÉGORIE DE CORRECTION \(ADR-021\)\nVEGETATION/)
    expect(prompt).toMatch(/ne peut jamais modifier un volume, une toiture, une ouverture ou l'implantation/)
  })
})

describe('Retexturation contextualisée dans le prompt (ENG-002 V1.6 §3.3)', () => {
  function etatContextualisee() {
    return {
      ...creerProjectStateVide('P-2'),
      revision: 1,
      mode: 'retexturation_contextualisee' as const,
      style: 'presentation_naturelle' as const,
      sources: [
        { id: 'src-1', role_detected: 'revit_view' as const, role_confirmed: 'revit_view' as const, status: 'valid' as const },
        { id: 'src-2', role_detected: 'axonometry' as const, role_confirmed: 'axonometry' as const, status: 'valid' as const },
        { id: 'src-3', role_detected: 'site_photo' as const, role_confirmed: 'site_photo' as const, status: 'valid' as const },
      ],
      environnement: [
        { id: 'voisin_nord', type: 'batiment_voisin', etat: 'locked' as const },
        {
          id: 'cloture_sud',
          type: 'cloture',
          etat: 'editable' as const,
          action_attendue: 'remplacer par une clôture bois claire',
          validation: 'validated' as const,
        },
        { id: 'pelouse', type: 'sol_vegetal', etat: 'harmonizable' as const, validation: 'validated' as const },
        // Proposé mais jamais confirmé : ne doit apparaître nulle part comme modifiable.
        { id: 'arbre_est', type: 'vegetation', etat: 'editable' as const, action_attendue: 'supprimer', validation: 'provisional' as const },
      ],
    }
  }

  it('mentionne la vue Revit comme canevas et la photo comme référence de contexte, jamais comme canevas', () => {
    const prompt = construirePromptGeneration(etatContextualisee())
    expect(prompt).toMatch(/CANEVAS PRINCIPAL\nVue Revit \(source src-1\)/)
    expect(prompt).toMatch(/RÉFÉRENCE DE CONTEXTE\nPhotographie réelle \(source src-3\).*référence de contexte, jamais canevas/)
  })

  it('mentionne l\'axonométrie comme garde-fou structurel', () => {
    const prompt = construirePromptGeneration(etatContextualisee())
    expect(prompt).toMatch(/GARDE-FOU STRUCTUREL\nVue axonométrique \(source src-2\)/)
  })

  it("ne contient jamais la clause « photographie comme canevas fixe » propre à Photomontage contrôlé", () => {
    const prompt = construirePromptGeneration(etatContextualisee())
    expect(prompt).not.toMatch(/canevas fixe/)
  })

  it('distingue les trois catégories d\'éléments, chacune dans sa propre section', () => {
    const prompt = construirePromptGeneration(etatContextualisee())
    expect(prompt).toMatch(/ÉLÉMENTS VERROUILLÉS\n- voisin_nord \(batiment_voisin\)/)
    expect(prompt).toMatch(/ÉLÉMENTS MODIFIABLES\n- cloture_sud \(cloture\) : remplacer par une clôture bois claire/)
    expect(prompt).toMatch(/ÉLÉMENTS HARMONISABLES\n- pelouse \(sol_vegetal\)/)
  })

  it("ne traite jamais une proposition non validée comme une autorisation — l'élément reste verrouillé", () => {
    const prompt = construirePromptGeneration(etatContextualisee())
    expect(prompt).toMatch(/ÉLÉMENTS VERROUILLÉS\n(.|\n)*arbre_est/)
    expect(prompt).not.toMatch(/ÉLÉMENTS MODIFIABLES\n(.|\n)*arbre_est/)
  })

  it('porte les mêmes sections dans le prompt de correction', () => {
    const prompt = construirePromptCorrection(etatContextualisee(), {
      elementAModifier: 'Clôture sud',
      resultatAttendu: 'Bois clair, hauteur inchangée.',
      categorie: 'LOCAL_ENVIRONMENT',
    })
    expect(prompt).toMatch(/GARDE-FOU STRUCTUREL/)
    expect(prompt).toMatch(/RÉFÉRENCE DE CONTEXTE/)
    expect(prompt).toMatch(/ÉLÉMENTS MODIFIABLES\n- cloture_sud/)
  })
})

describe('Contraintes & Libertés dans le prompt (PRD §9.5)', () => {
  const etatAvecLibertes = {
    ...etatPhotomontageAdministratif(),
    contraintes_libertes: {
      piscine: { geometry_policy: 'locked' as const, freedom_level: 'creative' as const, authorized_by: 'evariste' },
      eau: { appearance_policy: 'creative' as const, freedom_level: 'creative' as const, authorized_by: 'evariste' },
      transats: { presence_policy: 'add_authorized' as const, scope: 'zone piscine', authorized_by: 'evariste' },
    },
  }

  it('inscrit les contraintes structurelles et les libertés accordées', () => {
    const prompt = construirePromptGeneration(etatAvecLibertes)
    expect(prompt).toMatch(/CONTRAINTES STRUCTURELLES/)
    expect(prompt).toMatch(/piscine \/ geometry_policy : locked/)
    expect(prompt).toMatch(/LIBERTÉS CRÉATIVES ACCORDÉES/)
    expect(prompt).toMatch(/eau \/ appearance_policy : creative/)
    expect(prompt).toMatch(/transats : add_authorized \(zone : zone piscine\)/)
  })

  it("dit explicitement qu'aucune liberté n'est accordée quand la matrice est vide (§7.3)", () => {
    const prompt = construirePromptGeneration(etatPhotomontageAdministratif())
    expect(prompt).toMatch(/Aucun embellissement, aucun changement de lumière et aucun ajout ne sont autorisés/)
    expect(prompt).toMatch(/toutes les propriétés sont traitées comme verrouillées/)
  })

  it('rappelle que toute liberté non listée est refusée', () => {
    const prompt = construirePromptGeneration(etatAvecLibertes)
    expect(prompt).toMatch(/Toute liberté non listée ici est refusée/)
  })

  it('porte les mêmes contraintes dans le prompt de correction', () => {
    const prompt = construirePromptCorrection(etatAvecLibertes, {
      elementAModifier: 'Teinte de la façade',
      resultatAttendu: 'Gris clair',
      categorie: 'MATERIAL',
    })
    expect(prompt).toMatch(/CONTRAINTES STRUCTURELLES/)
    expect(prompt).toMatch(/piscine \/ geometry_policy : locked/)
  })
})
