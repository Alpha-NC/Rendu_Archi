import Anthropic from '@anthropic-ai/sdk'
import {
  CRITERES_CONTROLE,
  type CritereControle,
  type EtatCritere,
  type LigneRapport,
} from './controle-qualite'
import type { ProjectState } from './project-state'

/**
 * Audit qualité multimodal (Chantier E backend-completion, PRD §15) —
 * remplit RÉELLEMENT le rapport LIB-002 depuis les images, au lieu de
 * dépendre d'un rapport pré-rempli comme le prévoyait déjà
 * `controle-qualite.ts::calculerVerdictPropose` (inchangé, déjà testé —
 * cette fonction ne fait QUE produire les lignes qu'il consomme).
 *
 * Ne produit jamais que le verdict PROPOSÉ — jamais `verdict_human`, jamais
 * de raccourci vers l'export administratif (PRD §15.1/§15.3, garde-fou
 * inchangé dans autoriserExportAdministratif).
 *
 * Arbitrage documenté (mission backend-completion §8/§9) : la grille
 * `EtatCritere` actuelle n'a que 4 états (`conforme`/`reserve`/
 * `non_conforme`/`non_applicable`), pas de 5ᵉ état « non évalué » distinct.
 * Un critère que le modèle ne peut pas juger (image insuffisante, angle
 * absent...) est classé `non_applicable`, jamais `conforme` par défaut, et
 * le motif exact reste dans `ecartObserve` pour la revue humaine. À
 * raffiner avec un état dédié si ce cas devient fréquent en usage réel.
 *
 * NOT_VERIFIED_LIVE : non testée contre l'API Anthropic réelle
 * (ANTHROPIC_API_KEY absente de cet environnement au moment d'écrire ce
 * module) — même statut que detection-role.ts/detection-directives.ts,
 * même style d'appel (tool_choice forcé, jamais de texte libre parsé).
 */

export interface ImageEntree {
  base64: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
}

export interface ContexteControleMultimodal {
  rendu: ImageEntree
  sources: ImageEntree[]
  projectState: ProjectState
  usageAdministratif: boolean
}

export type ClassifieurQualite = (contexte: ContexteControleMultimodal) => Promise<LigneRapport[]>

/**
 * Valide et normalise la sortie brute du modèle (le `tool_use.input`) en
 * lignes de rapport exploitables — pure, testable sans API réelle, comme
 * `interpreterDetection`/`interpreterDirectives` pour les autres
 * classifieurs multimodaux du projet.
 */
export function interpreterReponseControle(entree: unknown): LigneRapport[] {
  const lignesBrutes = (entree as { lignes?: unknown } | undefined)?.lignes
  if (!Array.isArray(lignesBrutes)) {
    throw new Error('Contrôle qualité multimodal : réponse du modèle invalide ou absente.')
  }

  return lignesBrutes.map((ligneBrute) => {
    const ligne = ligneBrute as Record<string, unknown>
    return {
      critere: ligne.critere as CritereControle,
      sourceControle: 'Analyse multimodale (Claude Sonnet 5, D-06)',
      etat: ligne.etat as EtatCritere,
      ecartObserve: typeof ligne.ecartObserve === 'string' ? ligne.ecartObserve : undefined,
      actionRecommandee: typeof ligne.actionRecommandee === 'string' ? ligne.actionRecommandee : undefined,
      defautEliminatoire: typeof ligne.defautEliminatoire === 'boolean' ? ligne.defautEliminatoire : undefined,
    }
  })
}

const ETATS_CRITERE = ['conforme', 'reserve', 'non_conforme', 'non_applicable'] as const

export function creerClassifieurQualite(apiKey = process.env.ANTHROPIC_API_KEY): ClassifieurQualite {
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY absente des variables d'environnement serveur.")
  const client = new Anthropic({ apiKey })

  return async (contexte) => {
    const reponse = await client.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 4096,
      tool_choice: { type: 'tool', name: 'evaluerCriteres' },
      tools: [
        {
          name: 'evaluerCriteres',
          description:
            "Évalue le rendu généré contre la grille officielle LIB-002 en le comparant aux sources et au ProjectState fournis. N'invente jamais un critère hors de la liste fournie ni un état 'conforme' par défaut pour un critère qui ne peut pas être jugé — classe-le non_applicable avec le motif dans ecartObserve.",
          input_schema: {
            type: 'object',
            properties: {
              lignes: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    critere: { type: 'string', enum: CRITERES_CONTROLE as unknown as string[] },
                    etat: { type: 'string', enum: ETATS_CRITERE as unknown as string[] },
                    ecartObserve: { type: 'string' },
                    actionRecommandee: { type: 'string' },
                    defautEliminatoire: { type: 'boolean' },
                  },
                  required: ['critere', 'etat'],
                },
              },
            },
            required: ['lignes'],
          },
        },
      ],
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'RENDU GÉNÉRÉ À CONTRÔLER :' },
            { type: 'image', source: { type: 'base64', media_type: contexte.rendu.mimeType, data: contexte.rendu.base64 } },
            { type: 'text', text: 'SOURCES DE RÉFÉRENCE (autorité géométrique et contexte) :' },
            ...contexte.sources.map((s) => ({
              type: 'image' as const,
              source: { type: 'base64' as const, media_type: s.mimeType, data: s.base64 },
            })),
            {
              type: 'text',
              text: `PROJECT STATE (contraintes, matériaux, libertés autorisées) :\n${JSON.stringify(contexte.projectState)}`,
            },
            {
              type: 'text',
              text: `USAGE ÉVALUÉ : ${contexte.usageAdministratif ? 'administratif — aucune réserve tolérée (LIB-002 §7)' : 'présentation'}.`,
            },
          ],
        },
      ],
    })

    const bloc = reponse.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
    return interpreterReponseControle(bloc?.input)
  }
}
