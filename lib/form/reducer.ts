import {
  champsMateriauxPour,
  cielProposeParDefaut,
  cielsDisponibles,
  conservationExistantProposee,
  eclairagesProposes,
  modeProduction,
  stylePreselectionne,
  stylesDisponibles,
} from './regles'
import { CATEGORIES, CLES_ECLAIRAGE } from './types'
import type {
  AspectPelouse,
  Categorie,
  Ciel,
  CleEclairage,
  Etape,
  EtatFormulaire,
  ImageChargee,
  RoleImage,
  SelectionMateriau,
  Style,
  TypeCadrage,
  TypeProjet,
  Usage,
} from './types'

export type ActionFormulaire =
  | { type: 'reference'; valeur: string }
  | { type: 'typeProjet'; valeur: TypeProjet }
  | { type: 'usage'; valeur: Usage }
  | { type: 'typeCadrage'; valeur: TypeCadrage }
  | { type: 'image'; role: RoleImage; valeur: ImageChargee | null }
  | { type: 'elementsAPreserver'; valeur: string }
  | { type: 'materiau'; categorie: Categorie; valeur: SelectionMateriau | null }
  | { type: 'conserverVegetation'; valeur: boolean }
  | { type: 'aspectPelouse'; valeur: AspectPelouse }
  | { type: 'elementsARetirer'; valeur: string }
  | { type: 'ciel'; valeur: Ciel }
  | { type: 'eclairage'; cle: CleEclairage; valeur: boolean }
  | { type: 'style'; valeur: Style }
  | { type: 'precisions'; valeur: string }
  | { type: 'allerEtape'; etape: Etape }
  | { type: 'restaurer'; etat: EtatFormulaire }

export function reduire(
  etat: EtatFormulaire,
  action: ActionFormulaire,
): EtatFormulaire {
  return normaliser(appliquer(etat, action))
}

/**
 * Etape voisine, bornee a l'intervalle 1..7.
 * `etape + 1` ne compile pas contre une union litterale : l'assertion est
 * isolee ici, une fois, plutot que dispersee dans les composants.
 */
export function etapeVoisine(etape: Etape, pas: 1 | -1): Etape {
  const cible = etape + pas
  if (cible < 1) return 1
  if (cible > 7) return 7
  return cible as Etape
}

function appliquer(
  etat: EtatFormulaire,
  action: ActionFormulaire,
): EtatFormulaire {
  switch (action.type) {
    case 'reference':
      return { ...etat, reference: action.valeur }
    case 'typeProjet':
      return { ...etat, typeProjet: action.valeur }
    case 'usage':
      return { ...etat, usage: action.valeur }
    case 'typeCadrage':
      return { ...etat, typeCadrage: action.valeur }
    case 'image':
      return { ...etat, images: { ...etat.images, [action.role]: action.valeur } }
    case 'elementsAPreserver':
      return { ...etat, elementsAPreserver: action.valeur }
    case 'materiau':
      return {
        ...etat,
        materiaux: { ...etat.materiaux, [action.categorie]: action.valeur },
      }
    case 'conserverVegetation':
      return { ...etat, conserverVegetation: action.valeur }
    case 'aspectPelouse':
      return { ...etat, aspectPelouse: action.valeur }
    case 'elementsARetirer':
      return { ...etat, elementsARetirer: action.valeur }
    case 'ciel':
      return { ...etat, ciel: action.valeur, cielChoisiManuellement: true }
    case 'eclairage':
      return {
        ...etat,
        eclairages: { ...etat.eclairages, [action.cle]: action.valeur },
      }
    case 'style':
      return { ...etat, style: action.valeur, styleChoisiManuellement: true }
    case 'precisions':
      return { ...etat, precisions: action.valeur }
    case 'allerEtape':
      return {
        ...etat,
        etape: action.etape,
        etapeMax: action.etape > etat.etapeMax ? action.etape : etat.etapeMax,
      }
    case 'restaurer':
      return action.etat
  }
}

/**
 * Retablit les invariants apres chaque action :
 * - le style suit la preselection tant qu'il n'a pas ete choisi a la main,
 *   et bascule de force s'il devient indisponible dans le mode courant ;
 * - le ciel obeit a la meme regle, « reprendre la lumiere de la photo »
 *   cessant d'etre disponible des que la photo du site est retiree ;
 * - les materiaux des categories qui ne sont plus affichees sont effaces,
 *   ainsi que les conservations de l'existant devenues impossibles ;
 * - les eclairages qui ne sont plus proposes sont eteints, faute de quoi un
 *   projet passe de piscine a extension enverrait un eclairage de bassin
 *   sur un projet qui n'en a pas.
 *
 * Chaque bloc lit uniquement les champs bruts de `etat`, jamais la sortie
 * d'un autre bloc : c'est ce qui rend leur ordre indifferent. Tout invariant
 * qui dependrait d'une valeur normalisee devrait etre place explicitement
 * apres elle.
 *
 * Deux choses ne sont volontairement pas normalisees ici :
 * - la coherence des eclairages avec le ciel. La question n'etant pas posee
 *   hors ambiance crepusculaire, `payload.ts` envoie `null` ; conserver les
 *   interrupteurs permet un aller-retour sans perte.
 * - la navigation. `etape` et `etapeMax` relevent de l'orchestrateur, qui
 *   s'appuie sur `validation.ts` pour activer ou non le bouton Continuer.
 */
export function normaliser(etat: EtatFormulaire): EtatFormulaire {
  const mode = modeProduction(etat.images, etat.typeCadrage)
  const disponibles = stylesDisponibles(mode)

  const style =
    etat.styleChoisiManuellement &&
    etat.style !== null &&
    disponibles.includes(etat.style)
      ? etat.style
      : stylePreselectionne(mode, etat.usage)

  const ciel =
    etat.cielChoisiManuellement && cielsDisponibles(etat.images).includes(etat.ciel)
      ? etat.ciel
      : cielProposeParDefaut(etat.images)

  const affichees = champsMateriauxPour(etat.typeProjet)
  const existantPropose = conservationExistantProposee(etat.typeProjet, etat.images)
  const materiaux = { ...etat.materiaux }
  for (const categorie of CATEGORIES) {
    const selection = materiaux[categorie]
    if (selection === null) continue
    if (!affichees.includes(categorie)) {
      materiaux[categorie] = null
      continue
    }
    if (selection.origine === 'existant' && !existantPropose) {
      materiaux[categorie] = null
    }
  }

  const proposes = eclairagesProposes(etat.typeProjet)
  const eclairages = { ...etat.eclairages }
  for (const cle of CLES_ECLAIRAGE) {
    if (!proposes.includes(cle)) eclairages[cle] = false
  }

  return { ...etat, style, ciel, materiaux, eclairages }
}
