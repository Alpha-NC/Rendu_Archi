import Anthropic from '@anthropic-ai/sdk'
import type { BlocContenu } from './appel-outil'
import type { AppelModele } from './orchestrateur-conversationnel'

/**
 * Implémentation réelle d'AppelModele avec le SDK Anthropic — D-06 :
 * Claude Sonnet 5 (`claude-sonnet-5`).
 *
 * Non testée contre l'API réelle dans cette suite (comme depot-supabase.ts
 * pour Supabase) : la logique qui compte est testée indépendamment dans
 * orchestrateur-conversationnel.test.ts via un AppelModele en mémoire. Ce
 * fichier n'est que l'adaptateur SDK, à vérifier en Phase 0B avec une vraie
 * clé API.
 */
export function creerAppelModele(apiKey = process.env.ANTHROPIC_API_KEY): AppelModele {
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY absente des variables d\'environnement serveur.')
  const client = new Anthropic({ apiKey })

  return async ({ system, tools, messages }) => {
    const reponse = await client.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 2048,
      system,
      // OUTILS_CONVERSATIONNELS est déclaré `as const` (immuable, pour que
      // les tests puissent affiner les types) — le SDK Anthropic veut des
      // tableaux mutables ; un aller-retour JSON lève la profonde
      // immuabilité sans dupliquer la déclaration des outils.
      tools: JSON.parse(JSON.stringify(tools)) as Anthropic.Tool[],
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content as Anthropic.MessageParam['content'],
      })),
    })

    return { content: reponse.content as unknown as BlocContenu[] }
  }
}
