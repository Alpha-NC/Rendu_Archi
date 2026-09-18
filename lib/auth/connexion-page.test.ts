import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { connexionEmail, push, refresh } = vi.hoisted(() => ({
  connexionEmail: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('@/lib/auth/client', () => ({
  authClient: { signIn: { email: connexionEmail } },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => new URLSearchParams(),
}))

import PageConnexion from '@/app/connexion/page'

describe('formulaire de connexion', () => {
  let conteneur: HTMLDivElement
  let racine: Root

  beforeEach(async () => {
    connexionEmail.mockReset()
    push.mockReset()
    refresh.mockReset()
    conteneur = document.createElement('div')
    document.body.appendChild(conteneur)
    racine = createRoot(conteneur)

    await act(async () => {
      racine.render(React.createElement(PageConnexion))
    })
  })

  afterEach(async () => {
    await act(async () => racine.unmount())
    conteneur.remove()
  })

  it("réactive le bouton et affiche une erreur quand Neon Auth lève une exception", async () => {
    connexionEmail.mockRejectedValueOnce(new Error('Invalid email or password'))

    const champs = conteneur.querySelectorAll('input')
    await act(async () => {
      changerValeur(champs[0], 'diagnostic@example.invalid')
      changerValeur(champs[1], 'mot-de-passe-invalide')
    })

    const formulaire = conteneur.querySelector('form')!
    await act(async () => {
      formulaire.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })

    const bouton = conteneur.querySelector('button[type="submit"]') as HTMLButtonElement
    expect(bouton.disabled).toBe(false)
    expect(bouton.textContent).toContain('Se connecter')
    expect(conteneur.querySelector('[role="alert"]')?.textContent).toContain('Identifiants incorrects.')
    expect(push).not.toHaveBeenCalled()
  })

  it("affiche aussi l'erreur quand Neon Auth la renvoie dans le résultat", async () => {
    connexionEmail.mockResolvedValueOnce({ error: { message: 'Invalid email or password' } })

    const champs = conteneur.querySelectorAll('input')
    await act(async () => {
      changerValeur(champs[0], 'diagnostic@example.invalid')
      changerValeur(champs[1], 'mot-de-passe-invalide')
    })

    await act(async () => {
      conteneur.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })

    expect(conteneur.querySelector('[role="alert"]')?.textContent).toContain('Identifiants incorrects.')
    expect(push).not.toHaveBeenCalled()
  })

  it('redirige vers le tableau de bord quand Neon Auth accepte les identifiants', async () => {
    connexionEmail.mockResolvedValueOnce({ error: null })

    const champs = conteneur.querySelectorAll('input')
    await act(async () => {
      changerValeur(champs[0], 'architecte@example.test')
      changerValeur(champs[1], 'mot-de-passe-valide')
    })

    await act(async () => {
      conteneur.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })

    expect(connexionEmail).toHaveBeenCalledWith({
      email: 'architecte@example.test',
      password: 'mot-de-passe-valide',
    })
    expect(push).toHaveBeenCalledWith('/')
    expect(refresh).toHaveBeenCalledOnce()
  })
})

function changerValeur(champ: Element, valeur: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(champ, valeur)
  champ.dispatchEvent(new Event('input', { bubbles: true }))
  champ.dispatchEvent(new Event('change', { bubbles: true }))
}
