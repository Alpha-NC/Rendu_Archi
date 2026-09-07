'use client'

import { useRef, useState } from 'react'

/**
 * Historique tel que renvoyé au serveur à chaque tour. Simplification
 * assumée tant que la persistance de conversation n'existe pas (PRD §13.5,
 * voir la note en tête de lib/rif/orchestrateur-conversationnel.ts) : on ne
 * renvoie que du texte, jamais les blocs tool_use/tool_result bruts de
 * l'API Anthropic. Le ProjectState (recalculé et injecté dans le prompt
 * système à chaque tour) porte la mémoire structurée ; ce texte ne sert
 * qu'à la fluidité de la conversation visible.
 */
interface TourHistorique {
  role: 'user' | 'assistant'
  content: string
}

interface MessageAffiche {
  auteur: 'utilisateur' | 'assistant' | 'systeme'
  texte: string
}

export default function ConversationRif({ dossierId }: { dossierId: string }) {
  const [historique, setHistorique] = useState<TourHistorique[]>([])
  const [messages, setMessages] = useState<MessageAffiche[]>([
    { auteur: 'systeme', texte: 'Décris le projet ou dépose tes sources pour commencer.' },
  ])
  const [saisie, setSaisie] = useState('')
  const [enCours, setEnCours] = useState(false)
  const zoneMessages = useRef<HTMLDivElement>(null)

  function resumerTour(tour: unknown): string {
    if (!tour || typeof tour !== 'object') return 'Réponse inattendue.'
    const t = tour as { type: string; texte?: string; message?: string; operation?: string; resultat?: { success: boolean; error?: { message: string } }; champsModifies?: string[] }
    if (t.type === 'message') return t.texte ?? ''
    if (t.type === 'incident') return `⚠️ ${t.message}`
    if (t.type === 'operation') {
      if (t.resultat?.success) return `✅ ${t.operation} exécutée.`
      return `❌ ${t.operation} a échoué : ${t.resultat?.error?.message ?? 'raison inconnue'}.`
    }
    if (t.type === 'fiche_mise_a_jour') {
      return `📋 Fiche projet mise à jour (${(t.champsModifies ?? []).join(', ') || 'aucun champ'}).`
    }
    return 'Réponse inattendue.'
  }

  async function envoyer() {
    const texte = saisie.trim()
    if (!texte || enCours) return

    setMessages((prev) => [...prev, { auteur: 'utilisateur', texte }])
    setSaisie('')
    setEnCours(true)

    try {
      const reponse = await fetch(`/api/dossiers/${dossierId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: texte, historique }),
      })
      const corps = await reponse.json()

      if (!reponse.ok || !corps.success) {
        setMessages((prev) => [
          ...prev,
          { auteur: 'systeme', texte: `⚠️ ${corps.error?.message ?? 'Erreur de communication.'}` },
        ])
        return
      }

      const resume = resumerTour(corps.tour)
      setMessages((prev) => [...prev, { auteur: 'assistant', texte: resume }])
      setHistorique((prev) => [
        ...prev,
        { role: 'user', content: texte },
        { role: 'assistant', content: resume },
      ])
    } catch {
      setMessages((prev) => [...prev, { auteur: 'systeme', texte: '⚠️ Connexion impossible.' }])
    } finally {
      setEnCours(false)
      requestAnimationFrame(() => {
        zoneMessages.current?.scrollTo({ top: zoneMessages.current.scrollHeight, behavior: 'smooth' })
      })
    }
  }

  return (
    <section className="flex min-h-[480px] flex-col rounded border border-encre-douce/30">
      <div ref={zoneMessages} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.auteur === 'utilisateur'
                ? 'ml-auto max-w-[75%] rounded-lg rounded-br-sm bg-encre px-3 py-2 text-sm text-white'
                : m.auteur === 'systeme'
                  ? 'max-w-[85%] rounded-lg bg-encre-douce/10 px-3 py-2 text-xs text-encre-douce'
                  : 'max-w-[75%] rounded-lg rounded-bl-sm border border-encre-douce/20 px-3 py-2 text-sm text-encre'
            }
          >
            {m.texte}
          </div>
        ))}
        {enCours && <p className="text-xs italic text-encre-douce">Le RIF réfléchit…</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          envoyer()
        }}
        className="flex gap-2 border-t border-encre-douce/30 p-3"
      >
        <textarea
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              envoyer()
            }
          }}
          rows={1}
          placeholder="Décris le projet, réponds aux questions…"
          className="flex-1 resize-none rounded border border-encre-douce/30 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={enCours}
          className="rounded bg-encre px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Envoyer
        </button>
      </form>
    </section>
  )
}
