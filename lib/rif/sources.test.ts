import { describe, expect, it } from 'vitest'
import { estRolePrincipal, ROLES_PRINCIPAUX, STATUTS_SOURCE } from './sources'

describe('ROLES_PRINCIPAUX / estRolePrincipal (Lot 2, D-23)', () => {
  it('reconnaît exactement les 4 rôles principaux, aucun autre', () => {
    expect(ROLES_PRINCIPAUX).toEqual(['model_3d', 'revit_view', 'site_photo', 'axonometry'])
  })

  it('les rôles principaux sont soumis au versioning/remplacement', () => {
    expect(estRolePrincipal('model_3d')).toBe(true)
    expect(estRolePrincipal('revit_view')).toBe(true)
    expect(estRolePrincipal('site_photo')).toBe(true)
    expect(estRolePrincipal('axonometry')).toBe(true)
  })

  it('les rôles multi-valués (référence matériau, source annotée...) ne sont jamais principaux', () => {
    expect(estRolePrincipal('material_reference')).toBe(false)
    expect(estRolePrincipal('annotated_source')).toBe(false)
    expect(estRolePrincipal('existing_building_photo')).toBe(false)
    expect(estRolePrincipal('render')).toBe(false)
    expect(estRolePrincipal('annotated_render')).toBe(false)
  })
})

describe('STATUTS_SOURCE — cycle de stockage distinct du cycle geometry-first', () => {
  it("n'expose que trois états honnêtes (active/replaced/deleted), jamais uploading/failed inventés", () => {
    expect(STATUTS_SOURCE).toEqual(['active', 'replaced', 'deleted'])
  })
})
