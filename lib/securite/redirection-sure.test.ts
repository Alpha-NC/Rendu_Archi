import { describe, expect, it } from 'vitest'
import { cibleRedirectionSure } from './redirection-sure'

describe('cibleRedirectionSure', () => {
  it('accepte un chemin relatif interne', () => {
    expect(cibleRedirectionSure('/mon-dossier/123')).toBe('/mon-dossier/123')
  })

  it("retombe sur '/' si null", () => {
    expect(cibleRedirectionSure(null)).toBe('/')
  })

  it("retombe sur '/' si chaîne vide", () => {
    expect(cibleRedirectionSure('')).toBe('/')
  })

  it('rejette une URL absolue http(s)', () => {
    expect(cibleRedirectionSure('https://evil.tld')).toBe('/')
    expect(cibleRedirectionSure('http://evil.tld')).toBe('/')
  })

  it('rejette une URL protocol-relative (//)', () => {
    expect(cibleRedirectionSure('//evil.tld')).toBe('/')
  })

  it('rejette une pseudo-URL protocol-relative avec antislash', () => {
    expect(cibleRedirectionSure('/\\evil.tld')).toBe('/')
  })

  it("rejette un chemin qui ne commence pas par '/'", () => {
    expect(cibleRedirectionSure('evil.tld')).toBe('/')
  })
})
