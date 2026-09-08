import {
  NIVEAUX_POLITIQUE,
  PROPRIETES_POLITIQUE,
  type NiveauPolitique,
  type PolitiqueElement,
  type ProjectState,
  type ProprietePolitique,
} from './project-state'

/**
 * Couche Contraintes & Libertés — PRD §9.4A et §24A.
 *
 * Doctrine appliquée ici, littéralement :
 *
 * - §7.3 : « La liberté créative n'est jamais implicite. » Une propriété
 *   sans politique déclarée est traitée comme `locked`, jamais comme libre.
 * - §9.4A : « Le backend refuse toute requête qui accorderait une liberté
 *   non présente dans cette matrice. »
 * - §24A.4 : « En cas de conflit entre créativité et fidélité, la propriété
 *   la plus restrictive prévaut. »
 * - §24A.1 : les propriétés structurelles sont `locked`/`strict` par défaut
 *   lorsqu'elles viennent d'une source autoritaire — la liste ci-dessous
 *   n'est donc pas configurable par la conversation.
 */

/** Rang de restriction : 0 = le plus restrictif (§24A.4). */
const RANG: Record<NiveauPolitique, number> = {
  locked: 0,
  strict: 1,
  controlled: 2,
  creative: 3,
}

/**
 * Éléments structurels du §24A.1. Leur géométrie ne peut jamais devenir
 * `controlled` ou `creative` : « Une demande d'embellissement, de changement
 * d'ambiance ou de style ne modifie jamais automatiquement ces propriétés. »
 */
export const ELEMENTS_STRUCTURELS = [
  'camera',
  'cadrage',
  'perspective',
  'silhouette',
  'volumes',
  'ouvertures',
  'toiture',
  'implantation',
  'piscine',
  'terrasse',
  'annexe',
  'environnement_conserve',
] as const

/** Défaut hors matrice : fidélité stricte (§7.3). */
export const POLITIQUE_PAR_DEFAUT: NiveauPolitique = 'locked'

export function plusRestrictif(a: NiveauPolitique, b: NiveauPolitique): NiveauPolitique {
  return RANG[a] <= RANG[b] ? a : b
}

/**
 * Politique effective d'une propriété d'un élément. Combine la politique
 * déclarée, le `freedom_level` global de l'élément (plafond) et le défaut
 * restrictif — toujours par la règle du plus restrictif (§24A.4).
 */
export function politiqueEffective(
  projectState: ProjectState,
  element: string,
  propriete: ProprietePolitique,
): NiveauPolitique {
  const politique: PolitiqueElement | undefined = projectState.contraintes_libertes?.[element]
  const declaree = politique?.[propriete] ?? POLITIQUE_PAR_DEFAUT
  const plafond = politique?.freedom_level ?? POLITIQUE_PAR_DEFAUT

  // La géométrie d'un élément structurel ne s'assouplit jamais (§24A.1).
  const estStructurel = (ELEMENTS_STRUCTURELS as readonly string[]).includes(element)
  if (estStructurel && propriete === 'geometry_policy') {
    return plusRestrictif(declaree, 'strict')
  }

  return plusRestrictif(declaree, plafond)
}

export interface DecisionLiberte {
  autorisee: boolean
  niveauEffectif: NiveauPolitique
  raison?: string
}

/**
 * §9.4A : refuse toute liberté non présente dans la matrice. `niveauDemande`
 * est le niveau qu'une opération voudrait exercer ; il est accordé seulement
 * si la matrice est au moins aussi permissive.
 */
export function verifierLiberte(
  projectState: ProjectState,
  element: string,
  propriete: ProprietePolitique,
  niveauDemande: NiveauPolitique,
): DecisionLiberte {
  const niveauEffectif = politiqueEffective(projectState, element, propriete)
  if (RANG[niveauDemande] <= RANG[niveauEffectif]) {
    return { autorisee: true, niveauEffectif }
  }
  return {
    autorisee: false,
    niveauEffectif,
    raison: `« ${element} / ${propriete} » est ${niveauEffectif} : une liberté ${niveauDemande} n'a pas été accordée dans la fiche projet.`,
  }
}

/**
 * Libertés réellement accordées, pour les inscrire dans le prompt technique
 * (§9.5 : le Generation Package porte « les libertés créatives accordées »)
 * et pour les rendre traçables (§22 : tout enrichissement visible doit être
 * rattaché à une autorisation du ProjectState).
 */
export function libertesAccordees(
  projectState: ProjectState,
): Array<{ element: string; propriete: ProprietePolitique; niveau: NiveauPolitique; scope?: string }> {
  const accordees: Array<{ element: string; propriete: ProprietePolitique; niveau: NiveauPolitique; scope?: string }> = []
  for (const [element, politique] of Object.entries(projectState.contraintes_libertes ?? {})) {
    for (const propriete of PROPRIETES_POLITIQUE) {
      const niveau = politiqueEffective(projectState, element, propriete)
      if (RANG[niveau] >= RANG['controlled']) {
        accordees.push({ element, propriete, niveau, scope: politique.scope })
      }
    }
  }
  return accordees
}

/** Contraintes explicites : tout ce qui est locked ou strict dans la matrice. */
export function contraintesStructurelles(
  projectState: ProjectState,
): Array<{ element: string; propriete: ProprietePolitique; niveau: NiveauPolitique }> {
  const contraintes: Array<{ element: string; propriete: ProprietePolitique; niveau: NiveauPolitique }> = []
  for (const element of Object.keys(projectState.contraintes_libertes ?? {})) {
    for (const propriete of PROPRIETES_POLITIQUE) {
      const niveau = politiqueEffective(projectState, element, propriete)
      if (RANG[niveau] <= RANG['strict']) {
        contraintes.push({ element, propriete, niveau })
      }
    }
  }
  return contraintes
}

/** Présences autorisées (§9.4A `presence_policy`, §24A.3). */
export function presencesAutorisees(
  projectState: ProjectState,
): Array<{ element: string; politique: NonNullable<PolitiqueElement['presence_policy']>; scope?: string }> {
  return Object.entries(projectState.contraintes_libertes ?? {})
    .filter(([, p]) => p.presence_policy && p.presence_policy !== 'conserve')
    .map(([element, p]) => ({ element, politique: p.presence_policy!, scope: p.scope }))
}

export { NIVEAUX_POLITIQUE }
