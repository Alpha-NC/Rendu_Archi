import type {
  ModeProduction,
  PolitiqueElement,
  ProjectState,
  StatutValeur,
  StyleRendu,
  ValeurTracee,
} from './project-state'
import { elargitLaLiberte } from './contraintes-libertes'

/**
 * Extraction structurée du ProjectState — D-15 (DECISIONS.md).
 *
 * Le PRD ne dicte aucun mécanisme d'extraction ; ce module en construit un,
 * cohérent avec l'architecture déjà en place : le modèle propose une mise à
 * jour MINIMALE via l'outil `mettreAJourFicheProjet` (valeur + statut), et
 * c'est ce module — pas le modèle — qui complète les métadonnées de
 * traçabilité exigées par le ProjectState (PRD §10 : source_id, authority,
 * editable, locked, validated_at). Le modèle décide QUOI, le backend décide
 * COMMENT c'est tracé.
 *
 * Règle de non-régression (choix d'implémentation, pas une règle du PRD) :
 * une valeur déjà `validated` n'est jamais dégradée par une mise à jour
 * `provisional` ultérieure — seule une nouvelle confirmation explicite
 * (`validated`) peut la remplacer. Rien n'est ignoré silencieusement : les
 * champs ignorés sont retournés pour être journalisés par l'appelant (PRD
 * §8 : « Toute opération est traçable »).
 */

export interface MiseAJourMateriau {
  element: string
  valeur: string
  statut: StatutValeur
  confidence?: number
}

export interface MiseAJourValeurSimple {
  valeur: string
  statut: StatutValeur
}

export interface MiseAJourFicheProjet {
  materiaux?: MiseAJourMateriau[]
  geometrie?: MiseAJourValeurSimple
  implantation?: MiseAJourValeurSimple
  zoneIntervention?: MiseAJourValeurSimple
  lumiere?: MiseAJourValeurSimple
  environnementAConserver?: string[]
  mode?: ModeProduction
  style?: StyleRendu
  cameraCompatibility?: ProjectState['camera_compatibility']
  usage?: string[]
  interdictions?: string[]
  /**
   * Politiques Contraintes & Libertés proposées par le modèle (§24A.3).
   * Le backend n'y inscrit JAMAIS `authorized_by` : une liberté proposée
   * reste sans effet jusqu'à la confirmation de la fiche par Évariste
   * (§24A.3, contraintes-libertes.ts::autoriserLibertesEnAttente).
   */
  contraintesLibertes?: Record<string, PolitiqueElement>
}

export interface ContexteExtraction {
  /** Identifiant de la source de la mise à jour — la conversation elle-même. */
  sourceId: string
}

export interface ChampIgnore {
  champ: string
  raison: string
}

export interface ResultatExtraction {
  suivant: ProjectState
  ignores: ChampIgnore[]
}

function fusionnerValeurTracee(
  existant: ValeurTracee<string> | undefined,
  entree: MiseAJourValeurSimple,
  champ: string,
  contexte: ContexteExtraction,
  ignores: ChampIgnore[],
): ValeurTracee<string> | undefined {
  if (existant?.status === 'validated' && entree.statut !== 'validated') {
    ignores.push({
      champ,
      raison: `Valeur déjà validée ("${existant.value}") — mise à jour provisoire ("${entree.valeur}") ignorée.`,
    })
    return existant
  }

  return {
    value: entree.valeur,
    status: entree.statut,
    source_id: contexte.sourceId,
    authority: 'utilisateur',
    editable: true,
    locked: false,
    ...(entree.statut === 'validated' ? { validated_at: new Date().toISOString() } : {}),
  }
}

/**
 * Fusionne une mise à jour proposée par le modèle dans le ProjectState.
 * Fonction pure : ne mute jamais `projectState`, retourne toujours un
 * nouvel objet — cohérent avec l'immuabilité des révisions confirmées
 * (PRD §10), même si cette fusion elle-même opère avant confirmation.
 */
export function appliquerMiseAJourFicheProjet(
  projectState: ProjectState,
  miseAJour: MiseAJourFicheProjet,
  contexte: ContexteExtraction,
): ResultatExtraction {
  const ignores: ChampIgnore[] = []
  const suivant: ProjectState = { ...projectState }

  if (miseAJour.materiaux) {
    const materials = { ...suivant.materials }
    for (const m of miseAJour.materiaux) {
      const existant = materials[m.element]
      if (existant?.status === 'validated' && m.statut !== 'validated') {
        ignores.push({
          champ: `materials.${m.element}`,
          raison: `Matériau déjà validé ("${existant.value}") — mise à jour provisoire ("${m.valeur}") ignorée.`,
        })
        continue
      }
      materials[m.element] = {
        value: m.valeur,
        status: m.statut,
        source_id: contexte.sourceId,
        authority: 'utilisateur',
        editable: true,
        locked: false,
        confidence: m.confidence,
        ...(m.statut === 'validated' ? { validated_at: new Date().toISOString() } : {}),
      }
    }
    suivant.materials = materials
  }

  if (miseAJour.geometrie) {
    suivant.geometrie = fusionnerValeurTracee(suivant.geometrie, miseAJour.geometrie, 'geometrie', contexte, ignores)
  }
  if (miseAJour.implantation) {
    suivant.implantation = fusionnerValeurTracee(
      suivant.implantation,
      miseAJour.implantation,
      'implantation',
      contexte,
      ignores,
    )
  }
  if (miseAJour.zoneIntervention) {
    suivant.zone_intervention = fusionnerValeurTracee(
      suivant.zone_intervention,
      miseAJour.zoneIntervention,
      'zone_intervention',
      contexte,
      ignores,
    )
  }
  if (miseAJour.lumiere) {
    suivant.lumiere = fusionnerValeurTracee(suivant.lumiere, miseAJour.lumiere, 'lumiere', contexte, ignores)
  }

  // Champs sans ValeurTracee dans le modèle actuel (PRD §10 les liste comme
  // valeurs simples) : remplacement direct, pas de statut à comparer.
  if (miseAJour.environnementAConserver) suivant.environnement_a_conserver = miseAJour.environnementAConserver
  if (miseAJour.mode) suivant.mode = miseAJour.mode
  if (miseAJour.style) suivant.style = miseAJour.style
  if (miseAJour.cameraCompatibility) suivant.camera_compatibility = miseAJour.cameraCompatibility
  if (miseAJour.usage) suivant.usage = miseAJour.usage
  if (miseAJour.interdictions) suivant.interdictions = miseAJour.interdictions

  if (miseAJour.contraintesLibertes) {
    const matrice = { ...(suivant.contraintes_libertes ?? {}) }
    for (const [element, proposee] of Object.entries(miseAJour.contraintesLibertes)) {
      // Le modèle propose ; il n'autorise jamais (§24A.3). Une autorisation
      // déjà donnée par Évariste est préservée tant que la politique ne
      // s'élargit pas ; si elle s'élargit, elle repart en attente.
      const existante = matrice[element]
      const fusionnee: PolitiqueElement = { ...existante, ...proposee }
      // Le modèle propose ; il n'autorise jamais (§24A.3).
      delete fusionnee.authorized_by
      delete fusionnee.authorized_at
      if (existante?.authorized_by && !elargitLaLiberte(existante, fusionnee)) {
        fusionnee.authorized_by = existante.authorized_by
        fusionnee.authorized_at = existante.authorized_at
      } else if (existante?.authorized_by) {
        delete fusionnee.authorized_by
        delete fusionnee.authorized_at
        ignores.push({
          champ: `contraintes_libertes.${element}`,
          raison: "Liberté élargie par rapport à l'autorisation en vigueur — elle retourne en attente de confirmation (PRD §24A.3).",
        })
      }
      matrice[element] = fusionnee
    }
    suivant.contraintes_libertes = matrice
  }

  return { suivant, ignores }
}
