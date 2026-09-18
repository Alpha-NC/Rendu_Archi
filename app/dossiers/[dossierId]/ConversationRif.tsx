'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { lireReponseApi } from '@/lib/rif/reponse-client'
import { Icon } from '@/app/ui/Icons'

interface MessageAffiche {
  auteur: 'utilisateur' | 'assistant' | 'systeme'
  texte: string
  /** Présent seulement quand une génération/correction vient de réussir (PRD §9.6). */
  generationId?: string
  imageUrl?: string
}

export default function ConversationRif({ dossierId, onActivity }: { dossierId: string; onActivity?: () => void }) {
  const router = useRouter()
  const [messages, setMessages] = useState<MessageAffiche[]>([
    { auteur: 'systeme', texte: 'Décris le projet ou dépose tes sources pour commencer.' },
  ])
  const [saisie, setSaisie] = useState('')
  const [enCours, setEnCours] = useState(false)
  const zoneMessages = useRef<HTMLDivElement>(null)

  // Réaffiche la conversation persistée (PRD §13.5) à l'ouverture de la page.
  useEffect(() => {
    fetch(`/api/dossiers/${dossierId}/message`).then((r) => lireReponseApi<{success:true;historique?:Array<{role:'user'|'assistant';content:string}>}>(r))
      .then((corps) => {
        if (!corps.historique?.length) return
        setMessages(
          corps.historique.map((m) => ({
            auteur: m.role === 'user' ? 'utilisateur' : 'assistant',
            texte: m.content,
          })),
        )
      })
      .catch(() => {})
  }, [dossierId])

  function resumerTour(tour: unknown): Pick<MessageAffiche, 'texte' | 'generationId' | 'imageUrl'> {
    if (!tour || typeof tour !== 'object') return { texte: 'Réponse inattendue.' }
    const t = tour as {
      type: string
      texte?: string
      message?: string
      operation?: string
      resultat?: { success: boolean; generationId?: string; imageUrl?: string; error?: { message: string } }
      champsModifies?: string[]
      versEtat?: string
    }
    if (t.type === 'message') return { texte: t.message ?? t.texte ?? '' }
    if (t.type === 'incident') return { texte: `⚠️ ${t.message}` }
    if (t.type === 'operation') {
      if (t.resultat?.success) {
        // PRD §9.6 : après une génération/correction, le rendu doit entrer
        // en contrôle qualité — jamais déclaré conforme automatiquement.
        const enControle = t.operation === 'genererRendu' || t.operation === 'corrigerRendu'
        return {
          texte: `✅ ${t.operation} exécutée.${enControle ? ' Contrôle qualité requis ci-dessous.' : ''}`,
          generationId: enControle ? t.resultat.generationId : undefined,
          imageUrl: enControle ? t.resultat.imageUrl : undefined,
        }
      }
      return { texte: `❌ ${t.operation} a échoué : ${t.resultat?.error?.message ?? 'raison inconnue'}.` }
    }
    if (t.type === 'parcours_avance') {
      return { texte: `➡️ Dossier passé en ${(t.versEtat ?? '').replace(/_/g, ' ')}.` }
    }
    if (t.type === 'fiche_mise_a_jour') {
      return { texte: `📋 Fiche projet mise à jour (${(t.champsModifies ?? []).join(', ') || 'aucun champ'}).` }
    }
    return { texte: 'Réponse inattendue.' }
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
        body: JSON.stringify({ message: texte }),
      })
      const corps = await lireReponseApi<{success:true;tour:unknown}>(reponse)

      const resume = resumerTour(corps.tour)
      setMessages((prev) => [...prev, { auteur: 'assistant', ...resume }])
      // L'état du dossier est rendu côté serveur (en-tête, bouton de
      // confirmation) : sans ça, une avancée ou une opération resterait
      // invisible jusqu'à un rafraîchissement manuel.
      const typeTour = (corps.tour as { type?: string } | undefined)?.type
      if (typeTour === 'parcours_avance' || typeTour === 'operation') { router.refresh(); onActivity?.() }
    } catch (e) {
      setMessages((prev) => [...prev, { auteur: 'systeme', texte: e instanceof Error ? e.message : 'Connexion impossible.' }])
    } finally {
      setEnCours(false)
      requestAnimationFrame(() => {
        zoneMessages.current?.scrollTo({ top: zoneMessages.current.scrollHeight, behavior: 'smooth' })
      })
    }
  }

  return (
    <section className="chat-panel">
      <header className="chat-head"><div><span>Assistant de projet</span><h2>Conversation</h2></div><Icon name="message"/></header>
      <div ref={zoneMessages} className="messages" aria-live="polite">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`message message--${m.auteur==='utilisateur'?'user':m.auteur}`}
          >
            {m.auteur==='assistant'&&<span className="message-author">RIF</span>}
            {m.texte}
          </div>
        ))}
        {enCours && <p className="chat-loading">RIF analyse votre demande…</p>}
      </div>
      <div className="chat-composer"><form
        onSubmit={(e) => {
          e.preventDefault()
          envoyer()
        }}
      >
        <button type="button" className="composer-add" aria-label="Ajouter une source"><Icon name="plus"/></button>
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
          placeholder="Décrivez votre modification…"
          aria-label="Message à RIF"
        />
        <button
          type="submit"
          disabled={enCours}
          className="composer-send"
          aria-label="Envoyer"
        >
          <Icon name="send"/>
        </button>
      </form><div className="composer-hint"><span>Entrée pour envoyer · Maj + Entrée pour une ligne</span><span>Conversation persistée</span></div></div>
    </section>
  )
}
