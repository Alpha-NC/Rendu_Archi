import {
  NIVEAUX_POLITIQUE,
  PROPRIETES_POLITIQUE,
  type ElementEnvironnement,
  type EtatElementEnvironnement,
  type NiveauPolitique,
  type PolitiqueElement,
  type ProjectState,
  type ProprietePolitique,
} from './project-state'

/**
 * Couche Contraintes & Libertés — PRD §9.4A et §24A (PRD V1.3, toujours en
 * vigueur pour ce mécanisme précis).
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
 *
 * ---
 *
 * D-19 — Coexistence avec le modèle d'environnement V2.1 (ARCH-002) :
 *
 * Le Framework V1.6 introduit un second modèle, `ElementEnvironnement`
 * (project-state.ts), à trois états `locked`/`editable`/`harmonizable`. Ce
 * n'est PAS un remplacement de ce qui précède : analyse menée avant
 * d'écrire le moindre code (D-19) —
 *
 * - `contraintes_libertes` gouverne des PROPRIÉTÉS (geometry/material/
 *   lighting/appearance) par ÉLÉMENT, avec un plafond (`freedom_level`) et
 *   une échelle à 4 niveaux (locked/strict/controlled/creative) — un
 *   mécanisme général de gouvernance de la liberté, utile aussi bien pour
 *   des éléments architecturaux (piscine, terrasse) que pour nuancer une
 *   propriété précise d'un élément de contexte (ex. material_policy d'une
 *   clôture). Rien dans le Framework V1.6 ne rend ce mécanisme obsolète :
 *   ARCH-002 lui-même ne définit les trois nouveaux états QUE pour les
 *   « éléments d'environnement », jamais pour les éléments architecturaux.
 * - `ElementEnvironnement` classe des ÉLÉMENTS DE CONTEXTE entiers
 *   (pas une propriété isolée) selon une intention globale — conserver,
 *   transformer sur décision, ou améliorer cosmétiquement — qui est le
 *   vocabulaire que le PRD V2.1 et le Framework V1.6 emploient partout
 *   pour le cas standard (Retexturation contextualisée).
 *
 * Décision (option A, cf. prompt d'implémentation) : les deux coexistent.
 * `contraintes_libertes` n'est PAS simplifié ni réduit aux seules
 * propriétés architecturales — aucune règle du Framework ne le justifie et
 * cela romprait des politiques déjà valides (ex. material_policy d'un
 * élément de contexte). Le modèle d'environnement est ADDITIF : il
 * complète `contraintes_libertes` pour le cas d'usage précis que le PRD
 * V2.1 qualifie explicitement (classification globale d'un élément de
 * contexte), sans le remplacer. Les deux modèles ne sont jamais appliqués
 * au même type de donnée : une confusion mode/modèle serait elle-même un
 * bug (voir `etatEffectifEnvironnement` ci-dessous, qui ne touche jamais
 * `contraintes_libertes`).
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
 * Politique effective d'une propriété d'un élément.
 *
 * Combine, toujours par la règle du plus restrictif (§24A.4) : la politique
 * déclarée, le `freedom_level` de l'élément (plafond) et le défaut
 * restrictif.
 *
 * §7.3 + §24A.3 : une liberté (`controlled`/`creative`) ne prend effet
 * qu'une fois autorisée explicitement — `authorized_by` renseigné. Une
 * liberté seulement proposée par le modèle reste sans effet jusqu'à la
 * confirmation d'Évariste : « la proposition est confirmée avant génération
 * lorsqu'elle modifie une liberté précédemment absente ». Un durcissement
 * (`locked`/`strict`) ne demande aucune autorisation : restreindre est
 * toujours permis.
 */
export function politiqueEffective(
  projectState: ProjectState,
  element: string,
  propriete: ProprietePolitique,
): NiveauPolitique {
  const politique: PolitiqueElement | undefined = projectState.contraintes_libertes?.[element]
  const declaree = politique?.[propriete] ?? POLITIQUE_PAR_DEFAUT
  const estLiberte = (n: NiveauPolitique) => RANG[n] >= RANG['controlled']
  const autorisee = Boolean(politique?.authorized_by)

  // Liberté déclarée mais pas encore autorisée : sans effet.
  const declareeEffective = estLiberte(declaree) && !autorisee ? POLITIQUE_PAR_DEFAUT : declaree

  // `freedom_level` est un PLAFOND (§9.4A : « niveau de liberté autorisé »),
  // pas un défaut : non déclaré, il ne contraint rien — la restriction par
  // défaut vient de la politique déclarée manquante, traitée comme locked.
  const plafondDeclare = politique?.freedom_level
  const plafondEffectif: NiveauPolitique = plafondDeclare
    ? estLiberte(plafondDeclare) && !autorisee
      ? POLITIQUE_PAR_DEFAUT
      : plafondDeclare
    : 'creative'

  // La géométrie d'un élément structurel ne s'assouplit jamais (§24A.1).
  const estStructurel = (ELEMENTS_STRUCTURELS as readonly string[]).includes(element)
  if (estStructurel && propriete === 'geometry_policy') {
    return plusRestrictif(declareeEffective, 'strict')
  }

  return plusRestrictif(declareeEffective, plafondEffectif)
}

/**
 * Libertés proposées mais pas encore autorisées (§24A.3). Elles n'ont aucun
 * effet sur la génération ; elles existent pour être montrées à Évariste et
 * confirmées — ou non.
 */
export function libertesEnAttente(
  projectState: ProjectState,
): Array<{ element: string; propriete: ProprietePolitique; niveauPropose: NiveauPolitique }> {
  const attente: Array<{ element: string; propriete: ProprietePolitique; niveauPropose: NiveauPolitique }> = []
  for (const [element, politique] of Object.entries(projectState.contraintes_libertes ?? {})) {
    if (politique.authorized_by) continue
    for (const propriete of PROPRIETES_POLITIQUE) {
      const declaree = politique[propriete]
      if (declaree && RANG[declaree] >= RANG['controlled']) {
        attente.push({ element, propriete, niveauPropose: declaree })
      }
    }
  }
  return attente
}

/**
 * Autorise toutes les libertés en attente (action explicite d'Évariste au
 * moment de confirmer la fiche projet, §9.4 + §24A.3). Fonction pure.
 */
export function autoriserLibertesEnAttente(
  projectState: ProjectState,
  autorisePar: string,
  horodatage = new Date().toISOString(),
): ProjectState {
  const matrice = projectState.contraintes_libertes
  if (!matrice) return projectState

  const suivante: Record<string, PolitiqueElement> = {}
  for (const [element, politique] of Object.entries(matrice)) {
    suivante[element] = politique.authorized_by
      ? politique
      : { ...politique, authorized_by: autorisePar, authorized_at: horodatage }
  }
  return { ...projectState, contraintes_libertes: suivante }
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

/**
 * Une proposition élargit-elle une politique déjà en vigueur ? Sert à décider
 * si une autorisation existante doit repartir en attente (§24A.3 : élargir
 * une liberté déjà accordée redemande confirmation, restreindre n'en demande
 * jamais). Compare uniquement les propriétés présentes dans `proposee` — un
 * champ omis n'élargit rien.
 */
export function elargitLaLiberte(existante: PolitiqueElement, proposee: PolitiqueElement): boolean {
  for (const propriete of PROPRIETES_POLITIQUE) {
    const apres = proposee[propriete]
    if (!apres) continue
    const avant = existante[propriete] ?? POLITIQUE_PAR_DEFAUT
    if (RANG[apres] > RANG[avant]) return true
  }
  if (proposee.presence_policy && proposee.presence_policy !== (existante.presence_policy ?? 'conserve')) {
    return proposee.presence_policy !== 'conserve'
  }
  return false
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

/* =========================================================================
 * Modèle d'environnement V2.1 (ARCH-002) — voir décision D-19 en en-tête.
 * ========================================================================= */

/**
 * État effectif d'un élément d'environnement — même doctrine que
 * `politiqueEffective` pour `contraintes_libertes` (§24A.3, ADR-019) :
 * « ne pas convertir une absence de décision en autorisation ». Un état
 * `editable`/`harmonizable` proposé mais non validé (`validation` absent ou
 * différent de `'validated'`) n'a AUCUN effet sur la génération — l'élément
 * reste `locked` tant qu'Évariste ne l'a pas confirmé. Un élément déjà
 * `locked` n'a besoin d'aucune validation : restreindre est toujours permis.
 */
export function etatEffectifEnvironnement(element: ElementEnvironnement): EtatElementEnvironnement {
  if (element.etat === 'locked') return 'locked'
  return element.validation === 'validated' ? element.etat : 'locked'
}

/** Éléments dont l'état effectif est `locked` (identité à conserver). */
export function elementsVerrouilles(projectState: ProjectState): ElementEnvironnement[] {
  return projectState.environnement.filter((e) => etatEffectifEnvironnement(e) === 'locked')
}

/**
 * Éléments réellement modifiables — état `editable` ET décision validée.
 * Une proposition `editable` non confirmée n'apparaît jamais ici (elle
 * reste dans `elementsVerrouilles` via `etatEffectifEnvironnement`).
 */
export function elementsModifiables(projectState: ProjectState): ElementEnvironnement[] {
  return projectState.environnement.filter((e) => etatEffectifEnvironnement(e) === 'editable')
}

/** Éléments réellement harmonisables — état `harmonizable` ET décision validée. */
export function elementsHarmonisables(projectState: ProjectState): ElementEnvironnement[] {
  return projectState.environnement.filter((e) => etatEffectifEnvironnement(e) === 'harmonizable')
}

/**
 * Éléments proposés (`editable`/`harmonizable`) mais pas encore validés —
 * pour les montrer à Évariste avant confirmation, comme
 * `libertesEnAttente` pour `contraintes_libertes`.
 */
export function elementsEnvironnementEnAttente(projectState: ProjectState): ElementEnvironnement[] {
  return projectState.environnement.filter(
    (e) => e.etat !== 'locked' && e.validation !== 'validated',
  )
}

/**
 * Valide qu'une classification respecte la sémantique obligatoire d'ARCH-002
 * avant de l'enregistrer — utilisée par extraction-project-state.ts.
 * Ne bloque jamais une classification `locked` (toujours valide) ni une
 * classification non encore validée (une proposition peut être incomplète,
 * elle n'a de toute façon aucun effet tant qu'elle n'est pas validée).
 */
export function elementEnvironnementValide(element: ElementEnvironnement): boolean {
  if (element.etat === 'locked' || element.validation !== 'validated') return true
  // editable validé : une décision (action_attendue) doit être exprimée —
  // sans quoi « validé » ne voudrait rien dire de plus qu'une conservation.
  if (element.etat === 'editable') return Boolean(element.action_attendue?.trim())
  return true
}
