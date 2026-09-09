import Anthropic from '@anthropic-ai/sdk'
import { ACTIONS_DIRECTIVE, type ActionDirective, type DirectiveLocalisee } from './project-state'

/**
 * Conversion d'une source annotée en directives localisées — ADR-015,
 * PRD §9.2 : « Une source annotée est convertie en directives localisées
 * de type conserver, supprimer, remplacer, corriger ou verrouiller. Si la
 * cible ou l'action n'est pas certaine, l'utilisateur confirme avant la
 * suite. Les marques graphiques ne sont jamais intégrées au résultat. »
 *
 * Comme detection-role.ts : l'appel réel au modèle (creerClassifieurDirectives)
 * n'est pas testé contre l'API Anthropic ; la logique de décision
 * (interpreterDirectives) est pure et testée avec des détections en mémoire.
 * Une directive de confiance insuffisante rejoint quand même
 * `localized_directives` (pour rester visible dans la fiche projet, PRD
 * §9.4) mais avec le statut `unknown` — jamais `provisional` ni
 * `validated` — et n'est utilisée par le prompt technique qu'une fois
 * confirmée individuellement (`PATCH .../directives/[directiveId]`).
 */

export interface ImageSource {
  base64: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
}

export interface DirectiveDetectee {
  action: ActionDirective
  target: string
  consigne?: string
  zone_ou_masque?: string
  /** Confiance entre 0 et 1 sur la cible ET l'action. */
  confidence: number
}

export type ClassifieurDirectives = (image: ImageSource) => Promise<DirectiveDetectee[]>

/** Sous ce seuil, la directive est traitée comme ambiguë (PRD §9.2). */
export const SEUIL_CONFIANCE_DIRECTIVE = 0.7

/**
 * Transforme les détections brutes en directives localisées complètes,
 * avec un identifiant stable et le statut qui reflète la confiance.
 * Fonction pure, déterministe (id dérivé de sourceId + rang, jamais aléatoire).
 */
export function interpreterDirectives(detections: DirectiveDetectee[], sourceId: string): DirectiveLocalisee[] {
  return detections.map((d, i) => ({
    id: `${sourceId}-d${i}`,
    source_id: sourceId,
    action: d.action,
    target: d.target,
    status: d.confidence < SEUIL_CONFIANCE_DIRECTIVE ? 'unknown' : 'provisional',
    remove_annotation_from_output: true,
    ...(d.consigne ? { consigne: d.consigne } : {}),
    ...(d.zone_ou_masque ? { zone_ou_masque: d.zone_ou_masque } : {}),
  }))
}

/** Implémentation réelle (Claude Sonnet 5, D-06) — non testée contre l'API réelle, voir claude-client.ts. */
export function creerClassifieurDirectives(apiKey = process.env.ANTHROPIC_API_KEY): ClassifieurDirectives {
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY absente des variables d'environnement serveur.")
  const client = new Anthropic({ apiKey })

  return async (image) => {
    const reponse = await client.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      tool_choice: { type: 'tool', name: 'extraireDirectives' },
      tools: [
        {
          name: 'extraireDirectives',
          description:
            "Extrait, pour chaque marque d'annotation visible sur l'image (cercle, flèche, surlignage, texte manuscrit), une directive localisée structurée (ADR-015). N'invente aucune marque absente ; renvoie un tableau vide si l'image ne porte aucune annotation.",
          input_schema: {
            type: 'object',
            properties: {
              directives: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    action: { type: 'string', enum: ACTIONS_DIRECTIVE as unknown as string[] },
                    target: {
                      type: 'string',
                      description: "Ce que la marque désigne, en langage clair (ex. 'façade extension', 'toiture annexe').",
                    },
                    consigne: { type: 'string', description: 'Texte manuscrit ou instruction associée à la marque, si présent.' },
                    zone_ou_masque: {
                      type: 'string',
                      description: "Description de la zone entourée si l'action ne cible pas un élément nommé.",
                    },
                    confidence: { type: 'number', description: "Confiance entre 0 et 1 sur la cible ET l'action." },
                  },
                  required: ['action', 'target', 'confidence'],
                },
              },
            },
            required: ['directives'],
          },
        },
      ],
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: image.mimeType, data: image.base64 } },
            {
              type: 'text',
              text: "Identifie chaque marque d'annotation visible (cercle, flèche, surlignage, texte) et la directive qu'elle exprime. Les marques elles-mêmes ne doivent jamais apparaître dans un rendu final — elles ne servent qu'à localiser l'action.",
            },
          ],
        },
      ],
    })

    const bloc = reponse.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
    const entree = bloc?.input as { directives?: unknown[] } | undefined
    if (!Array.isArray(entree?.directives)) {
      throw new Error('Extraction de directives : réponse du modèle invalide ou absente.')
    }
    return entree.directives.filter(
      (d): d is DirectiveDetectee =>
        !!d &&
        typeof d === 'object' &&
        (ACTIONS_DIRECTIVE as readonly string[]).includes((d as DirectiveDetectee).action) &&
        typeof (d as DirectiveDetectee).target === 'string',
    )
  }
}
