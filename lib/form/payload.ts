import { eclairagesDemandes, modeProduction } from './regles'
import { peutEnvoyer } from './validation'
import { CATEGORIES } from './types'
import type { Categorie, EtatFormulaire } from './types'
import type {
  MateriauEnvoye,
  MateriauLibre,
  RequeteGenerate,
} from '@/lib/n8n/contrat'

/**
 * Construit le corps de la requete `generate`.
 *
 * Trois conventions de forme, pour que le traitement cote n8n soit
 * deterministe :
 * - les six categories sont toujours presentes, a null si sans objet ;
 * - chaque selection porte son discriminant `origine` ;
 * - `eclairages` vaut null quand la question n'a pas ete posee, pour ne pas
 *   confondre « non demande » et « tout eteint ».
 *
 * Les saisies libres ne figurent jamais dans `materiaux` : elles partent
 * dans `materiaux_libres`, que n8n utilise pour creer des lignes a calibrer
 * et jamais pour construire un prompt.
 */
export function construirePayloadGenerate(etat: EtatFormulaire): RequeteGenerate {
  if (!peutEnvoyer(etat)) {
    throw new Error('Le formulaire est incomplet : payload non constructible.')
  }
  // peutEnvoyer garantit ces quatre valeurs.
  const cadrage = etat.images.cadrage!
  const typeCadrage = etat.typeCadrage!
  const style = etat.style!
  const typeProjet = etat.typeProjet!

  const materiaux = {} as Record<Categorie, MateriauEnvoye | null>
  const materiauxLibres: MateriauLibre[] = []

  for (const categorie of CATEGORIES) {
    const selection = etat.materiaux[categorie]
    if (selection === null) {
      materiaux[categorie] = null
      continue
    }
    if (selection.origine === 'libre') {
      materiaux[categorie] = null
      materiauxLibres.push({ categorie, terme: selection.terme.trim() })
      continue
    }
    materiaux[categorie] = selection
  }

  return {
    action: 'generate',
    reference: etat.reference.trim(),
    projet: { type: typeProjet, usage: etat.usage },
    cadrage: { type: typeCadrage },
    mode_production: modeProduction(etat.images, typeCadrage),
    images: {
      cadrage: cadrage.dataUri,
      complementaire: etat.images.complementaire?.dataUri ?? null,
      site: etat.images.site?.dataUri ?? null,
    },
    elements_a_preserver: etat.elementsAPreserver.trim(),
    materiaux,
    materiaux_libres: materiauxLibres,
    environnement: {
      conserver_vegetation: etat.conserverVegetation,
      aspect_pelouse: etat.aspectPelouse,
      elements_a_retirer: etat.elementsARetirer.trim(),
      ciel: etat.ciel,
      eclairages: eclairagesDemandes(etat.ciel)
        ? {
            margelles: etat.eclairages.margelles,
            sous_marin: etat.eclairages.sousMarin,
            appliques_facade: etat.eclairages.appliquesFacade,
            interieur_visible: etat.eclairages.interieurVisible,
          }
        : null,
    },
    style,
    precisions: etat.precisions.trim(),
  }
}
