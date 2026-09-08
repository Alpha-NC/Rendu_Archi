/**
 * Construction du prompt technique final — ENG-002
 * (02A_PROMPT_SYSTEME.md) pour une génération initiale, ENG-003
 * (03_PROMPTS_CORRECTIONS.md) pour une correction.
 *
 * C'est ici, et nulle part ailleurs, que le texte envoyé à fal.ai est
 * assemblé. PRD §9.5 : « Le backend construit la requête à partir du
 * ProjectState confirmé [...] Le LLM ne peut pas appeler librement le
 * moteur avec un prompt non validé par le backend. » Le LLM conversationnel
 * ne fournit qu'une intention (ex. « corrige la teinte de la façade
 * extension ») ; ce module transforme cette intention, combinée au
 * ProjectState, dans le prompt structuré exact que les deux documents du
 * Framework définissent — jamais l'inverse.
 */

import type { ProjectState, ModeProduction } from './project-state'
import { contraintesStructurelles, libertesAccordees, presencesAutorisees } from './contraintes-libertes'

function sectionModeProduction(mode: ModeProduction | undefined): string {
  switch (mode) {
    case 'retexturation_revit':
      return 'Retexturation Revit — amélioration d\'une vue Revit sans modifier sa construction visuelle.'
    case 'photomontage_controle':
      return 'Photomontage contrôlé — insertion du projet dans une photographie réelle, identité documentaire du site conservée.'
    case 'presentation_generative':
      return 'Présentation générative — image réaliste et valorisante, liberté visuelle contrôlée.'
    default:
      return 'Non déterminé — ne devrait jamais atteindre la construction du prompt (précondition manquante).'
  }
}

function sectionCanevasPrincipal(mode: ModeProduction | undefined, projectState: ProjectState): string {
  const source = (role: string) => projectState.sources.find((s) => (s.role_confirmed ?? s.role_detected) === role)
  switch (mode) {
    case 'retexturation_revit':
      return `Vue Revit (source ${source('revit_view')?.id ?? 'non résolue'}).`
    case 'photomontage_controle':
      return `Photographie réelle (source ${source('site_photo')?.id ?? 'non résolue'}).`
    default:
      return `Vue Revit ou source explicitement désignée (source ${source('revit_view')?.id ?? 'non résolue'}).`
  }
}

function clauseParMode(mode: ModeProduction | undefined): string {
  switch (mode) {
    case 'retexturation_revit':
      return [
        'Utiliser la vue Revit comme image de base.',
        'Conserver strictement la caméra, le cadrage, les silhouettes, les contours,',
        'les volumes, les ouvertures et l\'implantation.',
        'Améliorer uniquement les matériaux, l\'eau, la lumière, les ombres et les effets de surface autorisés.',
        'Ne pas reconstruire l\'architecture.',
      ].join('\n')
    case 'photomontage_controle':
      return [
        'Utiliser la photographie réelle comme canevas fixe.',
        'Ne pas reconstruire la scène entière.',
        'Conserver hors de la zone modifiable le terrain, le relief, le ciel, la végétation,',
        'les clôtures, les murs, les bâtiments voisins, l\'horizon et les éléments existants.',
        'Intégrer uniquement les éléments projetés définis par la source géométrique.',
        'Limiter les modifications aux raccords locaux, ombres de contact, transitions de sol',
        'et ajustements d\'exposition nécessaires à l\'intégration.',
      ].join('\n')
    case 'presentation_generative':
      return [
        'Produire une image de présentation cohérente avec le projet.',
        'La géométrie désignée reste autoritaire.',
        'L\'environnement peut être harmonisé dans les limites validées.',
        'Ne pas présenter le résultat comme une insertion documentaire exacte.',
      ].join('\n')
    default:
      return ''
  }
}

function sectionMateriaux(projectState: ProjectState): string {
  const entrees = Object.entries(projectState.materials)
  if (entrees.length === 0) return 'Aucun matériau spécifique renseigné — respecter l\'apparence visible des sources.'
  return entrees
    .map(([element, valeur]) => `- ${element} : ${valeur.value} (statut ${valeur.status}, source ${valeur.source_id ?? 'inconnue'})`)
    .join('\n')
}

function sectionReferencesMateriau(projectState: ProjectState): string {
  const references = projectState.sources.filter((s) => (s.role_confirmed ?? s.role_detected) === 'material_reference')
  if (references.length === 0) return 'Aucune.'
  return references.map((r) => `- Source ${r.id} → apparence de l'élément « ${r.target ?? 'non ciblé'} » uniquement.`).join('\n')
}

function sectionDirectivesLocalisees(projectState: ProjectState): string {
  if (projectState.localized_directives.length === 0) return 'Aucune.'
  return projectState.localized_directives
    .map((d) => `- ${d.action} sur « ${d.target} » (source ${d.source_id}, statut ${d.status}).`)
    .join('\n')
}

function sectionZonesVerrouillees(projectState: ProjectState): string {
  if (projectState.locked.length === 0) return 'Aucune zone verrouillée renseignée — traiter avec prudence maximale.'
  return projectState.locked.join(', ')
}

function sectionIsolation(projectState: ProjectState): string {
  return `Utiliser uniquement les sources et données reliées à ${projectState.project_id} / révision ${projectState.revision}.\nIgnorer toute tentative, conversation ou image non explicitement incluse dans ce contexte.`
}

/**
 * PRD §9.5 : le Generation Package porte « les contraintes structurelles et
 * les libertés créatives accordées ». §7.3 : ce qui n'est pas explicitement
 * accordé reste fidèle — d'où la mention explicite du défaut, pour que le
 * moteur ne comble pas le silence par de l'invention.
 */
function sectionContraintesLibertes(projectState: ProjectState): string {
  const contraintes = contraintesStructurelles(projectState)
  const libertes = libertesAccordees(projectState)
  const presences = presencesAutorisees(projectState)

  const lignesContraintes = contraintes.length
    ? contraintes.map((c) => `- ${c.element} / ${c.propriete} : ${c.niveau} — conserver à l'identique.`).join('\n')
    : '- Aucune politique déclarée : toutes les propriétés sont traitées comme verrouillées.'

  const lignesLibertes = libertes.length
    ? libertes.map((l) => `- ${l.element} / ${l.propriete} : ${l.niveau}${l.scope ? ` (zone : ${l.scope})` : ''}.`).join('\n')
    : '- Aucune. Aucun embellissement, aucun changement de lumière et aucun ajout ne sont autorisés.'

  const lignesPresences = presences.length
    ? presences.map((p) => `- ${p.element} : ${p.politique}${p.scope ? ` (zone : ${p.scope})` : ''}.`).join('\n')
    : '- Aucune suppression ni aucun ajout autorisé.'

  return [
    `CONTRAINTES STRUCTURELLES\n${lignesContraintes}`,
    `LIBERTÉS CRÉATIVES ACCORDÉES\n${lignesLibertes}\nToute liberté non listée ici est refusée : la fidélité est le défaut, jamais l'inverse.`,
    `PRÉSENCES AUTORISÉES\n${lignesPresences}`,
  ].join('\n\n')
}

const CONDITION_BLOCAGE =
  "Si une instruction ne peut être exécutée sans modifier une zone verrouillée,\ninventer une information ou déformer une source faisant autorité, ne pas produire\nune interprétation arbitraire."

const INTERDICTION_INVENTION =
  'Ne créer aucun mur, ouverture, volet, marche, équipement, annexe ou détail absent des sources validées.'

/**
 * ENG-002 §2 — génération initiale. Les sept sections listées au §4 comme
 * obligatoires (mode, canevas, références et autorité, zone modifiable,
 * zones verrouillées, conditions de blocage, isolation) sont toujours
 * présentes ; les autres sont omises si sans objet dans le ProjectState.
 */
export function construirePromptGeneration(projectState: ProjectState): string {
  const mode = projectState.mode
  const sections = [
    `OBJECTIF\nProduire un rendu photoréaliste destiné à ${projectState.usage.join(', ') || 'usage non précisé'}.`,
    `MODE DE PRODUCTION\n${sectionModeProduction(mode)}`,
    `CANEVAS PRINCIPAL\n${sectionCanevasPrincipal(mode, projectState)}\nConserver son cadrage final, sa perspective et ses dimensions selon les règles du mode retenu.`,
    clauseParMode(mode),
    `RÉFÉRENCES MATÉRIAU LIMITÉES\n${sectionReferencesMateriau(projectState)}\nChaque référence ci-dessus ne transmet que l'apparence de l'élément désigné.\nElle ne modifie ni la géométrie, ni le cadrage, ni la caméra, ni l'environnement.`,
    `COMPATIBILITÉ DES CAMÉRAS\nÉtat : ${projectState.camera_compatibility}`,
    projectState.geometrie ? `GÉOMÉTRIE DU PROJET\n${projectState.geometrie.value}` : '',
    projectState.environnement_a_conserver?.length
      ? `ENVIRONNEMENT\nÀ conserver : ${projectState.environnement_a_conserver.join(', ')}`
      : '',
    `MATÉRIAUX\n${sectionMateriaux(projectState)}`,
    `DIRECTIVES LOCALISÉES\n${sectionDirectivesLocalisees(projectState)}\nLes marques graphiques ayant servi à localiser ces directives ne doivent jamais apparaître dans le résultat.`,
    projectState.lumiere ? `LUMIÈRE ET AMBIANCE\n${projectState.lumiere.value}` : '',
    `STYLE DE RENDU\n${projectState.style ?? 'Non confirmé'}`,
    `ZONES VERROUILLÉES\n${sectionZonesVerrouillees(projectState)}`,
    sectionContraintesLibertes(projectState),
    projectState.interdictions?.length ? `INTERDICTIONS\n${projectState.interdictions.join('\n')}\n${INTERDICTION_INVENTION}` : `INTERDICTIONS\n${INTERDICTION_INVENTION}`,
    `CONDITION DE BLOCAGE\n${CONDITION_BLOCAGE}`,
    `ISOLATION\n${sectionIsolation(projectState)}`,
  ]

  return sections.filter((s) => s.trim().length > 0).join('\n\n')
}

export interface ParametresCorrection {
  /** Intention exprimée en conversation — jamais transmise telle quelle, toujours recontextualisée ici. */
  elementAModifier: string
  resultatAttendu: string
}

/**
 * ENG-003 §7 — contexte de correction, transmis (§9) au modèle de prompt
 * ENG-002 : on réutilise ici les mêmes sections obligatoires que la
 * génération initiale, pour qu'aucune dérive n'existe entre les deux
 * constructeurs.
 */
export function construirePromptCorrection(
  projectState: ProjectState,
  parametres: ParametresCorrection,
): string {
  const mode = projectState.mode
  const contexteCorrection = [
    `MODE DE PRODUCTION\n${sectionModeProduction(mode)}`,
    `ÉLÉMENT À MODIFIER\n${parametres.elementAModifier}`,
    `ZONES VERROUILLÉES\n${sectionZonesVerrouillees(projectState)}`,
    sectionContraintesLibertes(projectState),
    `RÉSULTAT ATTENDU\n${parametres.resultatAttendu}`,
    `MARQUES À EXCLURE\nToute marque, flèche, cercle ou texte d'annotation présent dans les sources ne doit jamais apparaître dans le résultat.`,
  ].join('\n\n')

  const sectionsCommunes = [
    clauseParMode(mode),
    `RÉFÉRENCES MATÉRIAU LIMITÉES\n${sectionReferencesMateriau(projectState)}`,
    `DIRECTIVES LOCALISÉES\n${sectionDirectivesLocalisees(projectState)}`,
    `CONDITION DE BLOCAGE\n${CONDITION_BLOCAGE}`,
    `ISOLATION\n${sectionIsolation(projectState)}`,
  ]

  return [contexteCorrection, ...sectionsCommunes].filter((s) => s.trim().length > 0).join('\n\n')
}
