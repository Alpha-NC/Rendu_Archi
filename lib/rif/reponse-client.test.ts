import { describe, expect, it } from 'vitest'
import { lireReponseApi } from './reponse-client'

describe('lireReponseApi', () => {
  it('rejette avec un message clair sur un 413 (corps vide ou non-JSON, posé par la plateforme)', async () => {
    const reponse = new Response(null, { status: 413 })
    await expect(lireReponseApi(reponse)).rejects.toThrow("Le fichier dépasse la taille autorisée pour ce mode d'upload.")
  })

  it('rejette proprement un corps vide (jamais "Unexpected end of JSON input")', async () => {
    const reponse = new Response('', { status: 502 })
    await expect(lireReponseApi(reponse)).rejects.toThrow('Erreur serveur (HTTP 502).')
  })

  it('rejette proprement un corps non-JSON (page HTML d\'erreur générique)', async () => {
    const reponse = new Response('<html>Internal Server Error</html>', { status: 500 })
    await expect(lireReponseApi(reponse)).rejects.toThrow('Réponse serveur inattendue (HTTP 500).')
  })

  it("relaie le message d'erreur métier quand success:false", async () => {
    const reponse = new Response(JSON.stringify({ success: false, error: { message: 'Dossier introuvable.' } }), { status: 404 })
    await expect(lireReponseApi(reponse)).rejects.toThrow('Dossier introuvable.')
  })

  it('rejette avec un message générique si success:false sans message', async () => {
    const reponse = new Response(JSON.stringify({ success: false }), { status: 500 })
    await expect(lireReponseApi(reponse)).rejects.toThrow('Erreur serveur (HTTP 500).')
  })

  it('retourne le corps parsé sur un succès réel', async () => {
    const reponse = new Response(JSON.stringify({ success: true, fileId: 'f-1' }), { status: 201 })
    await expect(lireReponseApi(reponse)).resolves.toEqual({ success: true, fileId: 'f-1' })
  })
})
