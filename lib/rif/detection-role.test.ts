import { describe, expect, it } from 'vitest'
import { interpreterDetection, SEUIL_CONFIANCE_ROLE } from './detection-role'

describe('interpreterDetection — PRD §9.1', () => {
  it('auto-confirme une détection confiante sans emplacement contradictoire', () => {
    const resultat = interpreterDetection({ role: 'site_photo', confidence: 0.95 })
    expect(resultat).toEqual({ role_detected: 'site_photo', role_confirmed: 'site_photo', ambigu: false })
  })

  it('traite comme ambiguë une détection sous le seuil de confiance', () => {
    const resultat = interpreterDetection({ role: 'axonometry', confidence: SEUIL_CONFIANCE_ROLE - 0.01 })
    expect(resultat.ambigu).toBe(true)
    expect(resultat.role_confirmed).toBeUndefined()
    expect(resultat.role_detected).toBe('axonometry')
  })

  it("traite comme ambiguë une détection confiante qui contredit l'emplacement choisi (indice, pas autorité)", () => {
    const resultat = interpreterDetection({ role: 'axonometry', confidence: 0.99 }, 'site_photo')
    expect(resultat.ambigu).toBe(true)
    expect(resultat.role_confirmed).toBeUndefined()
    expect(resultat.role_detected).toBe('axonometry') // la détection prévaut sur l'emplacement, jamais l'inverse
  })

  it("auto-confirme quand la détection confiante s'accorde avec l'emplacement choisi", () => {
    const resultat = interpreterDetection({ role: 'revit_view', confidence: 0.8 }, 'revit_view')
    expect(resultat).toEqual({ role_detected: 'revit_view', role_confirmed: 'revit_view', ambigu: false })
  })
})
