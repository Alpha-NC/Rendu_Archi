import { describe, expect, it } from 'vitest'
import { determinerModeParDefaut, determinerStyleParDefaut } from './modes-styles'

describe('determinerModeParDefaut (LIB-006 §5)', () => {
  it('propose Retexturation Revit pour une vue Revit seule', () => {
    const resultat = determinerModeParDefaut({
      vueRevitExploitable: true,
      photographieReelleFournie: false,
      cameraCompatible: 'Compatible',
      usageAdministratif: false,
    })
    expect(resultat.mode).toBe('retexturation_revit')
  })

  it('propose Photomontage contrôlé pour photo + vue compatible + usage administratif', () => {
    const resultat = determinerModeParDefaut({
      vueRevitExploitable: true,
      photographieReelleFournie: true,
      cameraCompatible: 'Compatible',
      usageAdministratif: true,
    })
    expect(resultat.mode).toBe('photomontage_controle')
  })

  it('accepte une caméra Approximative pour Photomontage contrôlé', () => {
    const resultat = determinerModeParDefaut({
      vueRevitExploitable: true,
      photographieReelleFournie: true,
      cameraCompatible: 'Approximative',
      usageAdministratif: true,
    })
    expect(resultat.mode).toBe('photomontage_controle')
  })

  it('suspend pour photo + vue incompatible + usage administratif — ne propose jamais de mode', () => {
    const resultat = determinerModeParDefaut({
      vueRevitExploitable: true,
      photographieReelleFournie: true,
      cameraCompatible: 'Incompatible',
      usageAdministratif: true,
    })
    expect(resultat.mode).toBe('suspendre')
  })

  it('propose Présentation générative pour une liberté d\'ambiance demandée', () => {
    const resultat = determinerModeParDefaut({
      vueRevitExploitable: true,
      photographieReelleFournie: false,
      cameraCompatible: 'Non evaluee',
      usageAdministratif: false,
      libertyAmbianceDemandee: true,
    })
    expect(resultat.mode).toBe('presentation_generative')
  })

  it('priorise la correction locale sur toute autre règle', () => {
    const resultat = determinerModeParDefaut({
      vueRevitExploitable: true,
      photographieReelleFournie: true,
      cameraCompatible: 'Incompatible', // suspendrait normalement
      usageAdministratif: true,
      correctionLocalePhotomontageConforme: true,
    })
    expect(resultat.mode).toBe('photomontage_controle')
  })

  it("ne devine jamais un mode hors des cas documentés par LIB-006 §5", () => {
    const resultat = determinerModeParDefaut({
      vueRevitExploitable: false,
      photographieReelleFournie: false,
      cameraCompatible: 'Non evaluee',
      usageAdministratif: false,
    })
    expect(resultat.mode).toBe('a_confirmer')
  })
})

describe('determinerStyleParDefaut (LIB-005)', () => {
  it('propose Photomontage administratif si photo réelle + usage administratif', () => {
    const resultat = determinerStyleParDefaut({
      photographieReelleFournie: true,
      usageAdministratif: true,
    })
    expect(resultat.style).toBe('photomontage_administratif')
  })

  it('propose Présentation client pour une réunion client ou un avant-projet', () => {
    const resultat = determinerStyleParDefaut({
      photographieReelleFournie: false,
      usageAdministratif: false,
      contexteReunionClientOuAvantProjet: true,
    })
    expect(resultat.style).toBe('presentation_client')
  })

  it("ne propose jamais Commercial automatiquement, même en contexte administratif", () => {
    const resultat = determinerStyleParDefaut({
      photographieReelleFournie: true,
      usageAdministratif: true,
    })
    expect(resultat.style).not.toBe('commercial')
  })

  it("choisit Commercial uniquement sur demande explicite, et cela prévaut sur les autres règles", () => {
    const resultat = determinerStyleParDefaut({
      photographieReelleFournie: true,
      usageAdministratif: true,
      demandeExpliciteCommercial: true,
    })
    expect(resultat.style).toBe('commercial')
  })

  it('demande confirmation si aucune règle ne tranche', () => {
    const resultat = determinerStyleParDefaut({
      photographieReelleFournie: false,
      usageAdministratif: false,
    })
    expect(resultat.style).toBe('a_confirmer')
  })
})
