import Anthropic from '@anthropic-ai/sdk'
import type { RoleSource } from './project-state'

/**
 * Détection automatique du rôle d'une source — PRD §9.1 : « Le système
 * propose automatiquement le rôle de chaque fichier puis demande une
 * confirmation groupée ; seuls les cas ambigus sont traités
 * individuellement. » et « Le nom de fichier est un indice, jamais une
 * autorité. »
 *
 * Simplification assumée (aucune session de revue groupée n'existe côté
 * interface) : une détection non ambiguë est auto-confirmée — lecture
 * pragmatique de « confirmation groupée » comme « sans friction ». Seules
 * les détections ambiguës (confiance insuffisante, ou désaccord avec
 * l'emplacement choisi par l'utilisateur au dépôt) demandent une
 * confirmation individuelle, ce qui correspond au texte littéral du PRD.
 *
 * Comme claude-client.ts : l'appel réel au modèle (creerClassifieurRole)
 * n'est pas testé contre l'API Anthropic ; la logique de décision
 * (interpreterDetection) est pure et testée avec un classifieur en mémoire.
 */

/** Rôles détectables à la réception (`render`/`annotated_render` sont des sorties, jamais déposés). */
export const ROLES_DETECTABLES = [
  'revit_view',
  'site_photo',
  'axonometry',
  'annotated_source',
  'material_reference',
  'existing_building_photo',
] as const

type RoleDetectable = (typeof ROLES_DETECTABLES)[number]

export interface ImageSource {
  base64: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
}

export interface RoleDetecte {
  role: RoleDetectable
  confidence: number
}

export type ClassifieurRole = (image: ImageSource, indiceNomFichier: string) => Promise<RoleDetecte>

/** Sous ce seuil, la détection est traitée comme ambiguë. */
export const SEUIL_CONFIANCE_ROLE = 0.7

export interface ResultatDetectionRole {
  role_detected: RoleSource
  role_confirmed?: RoleSource
  ambigu: boolean
}

/**
 * Décide si une détection peut être auto-confirmée. `indiceEmplacement` est
 * le rôle du slot où l'utilisateur a déposé le fichier — un indice, pas une
 * autorité (§9.1) : un désaccord avec la détection vaut ambiguïté, jamais
 * un tranchage silencieux en faveur de l'un ou l'autre.
 */
export function interpreterDetection(
  detection: RoleDetecte,
  indiceEmplacement?: RoleSource,
): ResultatDetectionRole {
  const desaccord = indiceEmplacement !== undefined && indiceEmplacement !== detection.role
  const ambigu = detection.confidence < SEUIL_CONFIANCE_ROLE || desaccord
  return {
    role_detected: detection.role,
    ambigu,
    ...(ambigu ? {} : { role_confirmed: detection.role }),
  }
}

/** Implémentation réelle (Claude Sonnet 5, D-06) — non testée contre l'API réelle, voir claude-client.ts. */
export function creerClassifieurRole(apiKey = process.env.ANTHROPIC_API_KEY): ClassifieurRole {
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY absente des variables d'environnement serveur.")
  const client = new Anthropic({ apiKey })

  return async (image, indiceNomFichier) => {
    const reponse = await client.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 256,
      tool_choice: { type: 'tool', name: 'classifierRole' },
      tools: [
        {
          name: 'classifierRole',
          description:
            "Identifie le rôle d'une image architecturale parmi les rôles pris en charge (PRD §9.1). Le nom de fichier est un indice, jamais une autorité.",
          input_schema: {
            type: 'object',
            properties: {
              role: { type: 'string', enum: ROLES_DETECTABLES as unknown as string[] },
              confidence: { type: 'number', description: 'Confiance entre 0 et 1.' },
            },
            required: ['role', 'confidence'],
          },
        },
      ],
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: image.mimeType, data: image.base64 } },
            { type: 'text', text: `Nom de fichier (indice, jamais une autorité) : "${indiceNomFichier}".` },
          ],
        },
      ],
    })

    const bloc = reponse.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
    const entree = bloc?.input as { role?: string; confidence?: number } | undefined
    if (!entree?.role || !(ROLES_DETECTABLES as readonly string[]).includes(entree.role)) {
      throw new Error('Détection de rôle : réponse du modèle invalide ou absente.')
    }
    return { role: entree.role as RoleDetectable, confidence: entree.confidence ?? 0 }
  }
}
