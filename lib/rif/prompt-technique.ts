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
import type { CategorieCorrection, GeometryConstraintPack } from './geometrie-3d'
import {
  contraintesStructurelles,
  elementsHarmonisables,
  elementsModifiables,
  elementsVerrouilles,
  libertesAccordees,
  presencesAutorisees,
} from './contraintes-libertes'

function sectionModeProduction(mode: ModeProduction | undefined): string {
  switch (mode) {
    case 'retexturation_revit':
      return 'Retexturation Revit — amélioration d\'une vue Revit sans modifier sa construction visuelle.'
    case 'retexturation_contextualisee':
      return 'Retexturation contextualisée — photoréalisation de la vue Revit, contextualisée par la photo réelle du site, mode principal du cas standard.'
    case 'photomontage_controle':
      return 'Photomontage contrôlé — insertion du projet dans une photographie réelle, identité documentaire du site conservée.'
    default:
      return 'Non déterminé — ne devrait jamais atteindre la construction du prompt (précondition manquante).'
  }
}

function sectionCanevasPrincipal(mode: ModeProduction | undefined, projectState: ProjectState): string {
  const source = (role: string) => projectState.sources.find((s) => (s.role_confirmed ?? s.role_detected) === role)
  switch (mode) {
    case 'retexturation_revit':
    case 'retexturation_contextualisee':
      return `Vue Revit (source ${source('revit_view')?.id ?? 'non résolue'}).`
    case 'photomontage_controle':
      return `Photographie réelle (source ${source('site_photo')?.id ?? 'non résolue'}).`
    default:
      return `Vue Revit ou source explicitement désignée (source ${source('revit_view')?.id ?? 'non résolue'}).`
  }
}

/**
 * ENG-002 V1.6 §3.3 : garde-fou structurel et référence de contexte,
 * propres à Retexturation contextualisée — jamais présents dans les autres
 * modes (la photo n'y est jamais qu'un canevas fixe ou hors sujet).
 */
function sectionGardeFouStructurel(projectState: ProjectState): string {
  const axo = projectState.sources.find((s) => (s.role_confirmed ?? s.role_detected) === 'axonometry')
  return axo
    ? `Vue axonométrique (source ${axo.id}) — contrôle les volumes, retours de façade, toiture, terrasses, piscine et annexes partiellement masqués en perspective. Ne remplace jamais la vue Revit perspective comme canevas ou référence de caméra.`
    : 'Aucune axonométrie fournie — vigilance accrue sur les volumes partiellement masqués en perspective.'
}

function sectionReferenceContexte(projectState: ProjectState): string {
  const photo = projectState.sources.find((s) => (s.role_confirmed ?? s.role_detected) === 'site_photo')
  return photo
    ? `Photographie réelle (source ${photo.id}) — référence de contexte, jamais canevas dans ce mode : elle n'impose pas la conservation pixel par pixel de chaque détail. Le terrain, le relief, le fond et l'identité générale du site s'en inspirent selon la classification ci-dessous.`
    : "Aucune photographie réelle fournie — ce mode se rabat sur Retexturation Revit (LIB-006 §4)."
}

function ligneElement(e: { id: string; type: string; action_attendue?: string }): string {
  return `- ${e.id} (${e.type})${e.action_attendue ? ` : ${e.action_attendue}` : ''}`
}

function sectionElementsVerrouilles(projectState: ProjectState): string {
  const elements = elementsVerrouilles(projectState)
  return elements.length
    ? elements.map(ligneElement).join('\n')
    : 'Aucun élément classé — traiter tout élément de contexte comme verrouillé par défaut (ARCH-002).'
}

function sectionElementsModifiables(projectState: ProjectState): string {
  const elements = elementsModifiables(projectState)
  return elements.length
    ? elements.map(ligneElement).join('\n')
    : 'Aucun. Aucune suppression ni aucun remplacement ne sont autorisés sur les éléments de contexte.'
}

function sectionElementsHarmonisables(projectState: ProjectState): string {
  const elements = elementsHarmonisables(projectState)
  return elements.length
    ? elements.map(ligneElement).join('\n')
    : 'Aucun. Aucune amélioration visuelle des éléments de contexte au-delà de leur apparence actuelle.'
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
    case 'retexturation_contextualisee':
      return [
        'Utiliser la vue Revit comme image de base et comme seule autorité de caméra, cadrage,',
        'perspective, silhouette, volumes, ouvertures, toiture et implantation.',
        'Utiliser la photographie réelle comme référence de contexte, jamais comme canevas :',
        'elle n\'impose pas la conservation pixel par pixel de chaque détail.',
        'Respecter la classification de chaque élément d\'environnement : verrouillé, modifiable ou harmonisable.',
        'Ne pas reconstruire le site dans son intégralité.',
        'Ne pas présenter le résultat comme une insertion documentaire exacte.',
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

/**
 * RIF V2, workflow geometry-first (ADR-021, docs/PRD_RIF_V2_GEOMETRY_FIRST.md
 * §7) : quand un pack de contraintes géométriques existe, il devient la
 * référence prioritaire sur la géométrie (volumes, toiture, ouvertures,
 * implantation) — la vue Revit ne reste alors autorité que sur le cadrage
 * intentionnel (caméra, perspective). En son absence, ne jamais prétendre
 * un verrouillage géométrique renforcé : le mode V2.1 standard (vue Revit +
 * axonométrie font autorité sur la géométrie) reste explicitement en
 * vigueur — pas de fausse promesse de précision.
 */
function sectionPackContraintesGeometriques(projectState: ProjectState): string {
  const pack = projectState.geometryPack
  if (!pack) {
    return "PACK DE CONTRAINTES GÉOMÉTRIQUES\nAucun — aucune source modèle 3D extraite pour ce dossier. La géométrie reste régie par la vue Revit et l'axonométrie, selon les règles standard du mode de production (mode non geometry-first pour cette génération)."
  }
  const champsRemplis = (Object.keys(pack) as Array<keyof GeometryConstraintPack>).filter(
    (cle) => cle !== 'schemaVersion' && cle !== 'sourceFileId' && pack[cle] !== undefined,
  )
  const detail = champsRemplis.length
    ? `Champs extraits disponibles : ${champsRemplis.join(', ')}.`
    : 'Aucun champ extrait pour le moment (pack créé mais vide) — traiter comme non disponible.'
  return `PACK DE CONTRAINTES GÉOMÉTRIQUES\nSource modèle 3D ${pack.sourceFileId} (schéma v${pack.schemaVersion}) fait autorité sur la géométrie (volumes, toiture, ouvertures, implantation) — la vue Revit ne fait plus autorité que sur le cadrage intentionnel (caméra, perspective). ${detail} Ne jamais compléter un champ absent par une supposition.`
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
    mode === 'retexturation_contextualisee' ? `GARDE-FOU STRUCTUREL\n${sectionGardeFouStructurel(projectState)}` : '',
    mode === 'retexturation_contextualisee' ? `RÉFÉRENCE DE CONTEXTE\n${sectionReferenceContexte(projectState)}` : '',
    clauseParMode(mode),
    `RÉFÉRENCES MATÉRIAU LIMITÉES\n${sectionReferencesMateriau(projectState)}\nChaque référence ci-dessus ne transmet que l'apparence de l'élément désigné.\nElle ne modifie ni la géométrie, ni le cadrage, ni la caméra, ni l'environnement.`,
    `COMPATIBILITÉ DES CAMÉRAS\nÉtat : ${projectState.camera_compatibility}`,
    sectionPackContraintesGeometriques(projectState),
    projectState.geometrie ? `GÉOMÉTRIE DU PROJET\n${projectState.geometrie.value}` : '',
    projectState.environnement_a_conserver?.length
      ? `ENVIRONNEMENT\nÀ conserver : ${projectState.environnement_a_conserver.join(', ')}`
      : '',
    `MATÉRIAUX\n${sectionMateriaux(projectState)}`,
    `DIRECTIVES LOCALISÉES\n${sectionDirectivesLocalisees(projectState)}\nLes marques graphiques ayant servi à localiser ces directives ne doivent jamais apparaître dans le résultat.`,
    projectState.lumiere ? `LUMIÈRE ET AMBIANCE\n${projectState.lumiere.value}` : '',
    `STYLE DE RENDU\n${projectState.style ?? 'Non confirmé'}`,
    `ZONES VERROUILLÉES\n${sectionZonesVerrouillees(projectState)}`,
    mode === 'retexturation_contextualisee' ? `ÉLÉMENTS VERROUILLÉS\n${sectionElementsVerrouilles(projectState)}` : '',
    mode === 'retexturation_contextualisee' ? `ÉLÉMENTS MODIFIABLES\n${sectionElementsModifiables(projectState)}` : '',
    mode === 'retexturation_contextualisee' ? `ÉLÉMENTS HARMONISABLES\n${sectionElementsHarmonisables(projectState)}` : '',
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
  /**
   * ADR-021 : catégorie de correction, validée en amont par
   * `estCategorieCorrectionValide` (orchestrateur-conversationnel.ts) avant
   * d'atteindre ce module — une correction n'existe ici que sous l'une des
   * six catégories qui préservent la géométrie par construction. Un
   * changement architectural n'est jamais une catégorie valide : il est
   * refusé en amont, jamais transformé en prompt de correction.
   */
  categorie: CategorieCorrection
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
    `CATÉGORIE DE CORRECTION (ADR-021)\n${parametres.categorie} — cette catégorie ne peut jamais modifier un volume, une toiture, une ouverture ou l'implantation ; toute géométrie verrouillée ci-dessous reste inchangée quelle que soit la demande.`,
    `ÉLÉMENT À MODIFIER\n${parametres.elementAModifier}`,
    `ZONES VERROUILLÉES\n${sectionZonesVerrouillees(projectState)}`,
    sectionPackContraintesGeometriques(projectState),
    mode === 'retexturation_contextualisee' ? `ÉLÉMENTS VERROUILLÉS\n${sectionElementsVerrouilles(projectState)}` : '',
    mode === 'retexturation_contextualisee' ? `ÉLÉMENTS MODIFIABLES\n${sectionElementsModifiables(projectState)}` : '',
    mode === 'retexturation_contextualisee' ? `ÉLÉMENTS HARMONISABLES\n${sectionElementsHarmonisables(projectState)}` : '',
    sectionContraintesLibertes(projectState),
    `RÉSULTAT ATTENDU\n${parametres.resultatAttendu}`,
    `MARQUES À EXCLURE\nToute marque, flèche, cercle ou texte d'annotation présent dans les sources ne doit jamais apparaître dans le résultat.`,
  ].join('\n\n')

  const sectionsCommunes = [
    clauseParMode(mode),
    mode === 'retexturation_contextualisee' ? `GARDE-FOU STRUCTUREL\n${sectionGardeFouStructurel(projectState)}` : '',
    mode === 'retexturation_contextualisee' ? `RÉFÉRENCE DE CONTEXTE\n${sectionReferenceContexte(projectState)}` : '',
    `RÉFÉRENCES MATÉRIAU LIMITÉES\n${sectionReferencesMateriau(projectState)}`,
    `DIRECTIVES LOCALISÉES\n${sectionDirectivesLocalisees(projectState)}`,
    `CONDITION DE BLOCAGE\n${CONDITION_BLOCAGE}`,
    `ISOLATION\n${sectionIsolation(projectState)}`,
  ]

  return [contexteCorrection, ...sectionsCommunes].filter((s) => s.trim().length > 0).join('\n\n')
}
