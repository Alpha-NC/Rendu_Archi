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
 * Extrait les quatre champs sans lesquels aucune requete n'a de sens.
 * Les tests de nullite sont faits ici plutot que confies a `peutEnvoyer` :
 * une assertion non-nulle adossee a une garantie que le compilateur ne voit
 * pas produirait, le jour ou cette garantie tomberait, une cle absente du
 * JSON et donc un prompt construit sur du vide. Trois des quatre champs
 * echoueraient en silence, et `typeCadrage` manquant ferait en plus deduire
 * le mauvais mode de production.
 */
function champsObligatoires(etat: EtatFormulaire) {
  const { typeProjet, typeCadrage, style } = etat
  const cadrage = etat.images.cadrage
  if (typeProjet === null || typeCadrage === null || style === null || cadrage === null) {
    return null
  }
  return { typeProjet, typeCadrage, style, cadrage }
}

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
  const obligatoires = champsObligatoires(etat)
  if (obligatoires === null || !peutEnvoyer(etat)) {
    throw new Error(
      'La fiche projet est incomplète : la génération ne peut pas être lancée.',
    )
  }
  const { typeProjet, typeCadrage, style, cadrage } = obligatoires

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
      // Ouvrir le champ « Autre texture » sans rien y ecrire est un etat
      // atteignable : ne pas creer de ligne a calibrer vide dans Supabase.
      const terme = selection.terme.trim()
      if (terme.length > 0) materiauxLibres.push({ categorie, terme })
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
