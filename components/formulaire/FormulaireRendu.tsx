'use client'

import { useEffect, useReducer, useRef, useState } from 'react'
import { ContexteFormulaireReact } from './contexte'
import { IndicateurEtapes } from './IndicateurEtapes'
import { Etape1Identification } from './etapes/Etape1Identification'
import { Etape2Documents } from './etapes/Etape2Documents'
import { Etape3Materiaux } from './etapes/Etape3Materiaux'
import { Etape4Environnement } from './etapes/Etape4Environnement'
import { Etape5Style } from './etapes/Etape5Style'
import { Etape6Precisions } from './etapes/Etape6Precisions'
import { Etape7FicheProjet } from './etapes/Etape7FicheProjet'
import { etapeVoisine, normaliser, reduire } from '@/lib/form/reducer'
import { etatInitial } from '@/lib/form/etat-initial'
import { chargerEtat, sauvegarderEtat } from '@/lib/form/persistance'
import { etapeFranchissable, peutEnvoyer } from '@/lib/form/validation'
import { construirePayloadGenerate } from '@/lib/form/payload'
import { ErreurMetier, ErreurReseau, generate, getMateriaux } from '@/lib/n8n/client'
import type { Categorie, Etape } from '@/lib/form/types'
import type { MateriauCatalogue, ReponseGenerate } from '@/lib/n8n/contrat'

const TITRES: Record<Etape, string> = {
  1: 'Identification',
  2: 'Documents',
  3: 'Matériaux',
  4: 'Environnement',
  5: 'Style de rendu',
  6: 'Précisions',
  7: 'Fiche projet',
}

type Envoi =
  | { statut: 'repos' }
  | { statut: 'en_cours'; secondes: number }
  | { statut: 'reussi'; resultat: ReponseGenerate }
  | { statut: 'echec'; message: string; coupure: boolean }

export function FormulaireRendu() {
  // L'etat de depart est normalise comme les suivants : sans cela, `style`
  // resterait null jusqu'a la premiere action.
  const [etat, envoyer] = useReducer(reduire, etatInitial, normaliser)
  const [restaure, setRestaure] = useState(false)
  const [catalogue, setCatalogue] = useState<Record<Categorie, MateriauCatalogue[]> | null>(
    null,
  )
  const [erreurCatalogue, setErreurCatalogue] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState<Envoi>({ statut: 'repos' })
  const [persistanceEnEchec, setPersistanceEnEchec] = useState(false)
  const enVol = useRef(false)

  // Restauration au montage, avant toute sauvegarde.
  useEffect(() => {
    let annule = false
    chargerEtat()
      .then((sauvegarde) => {
        if (!annule && sauvegarde) envoyer({ type: 'restaurer', etat: sauvegarde })
      })
      .catch(() => undefined)
      .finally(() => {
        if (!annule) setRestaure(true)
      })
    return () => {
      annule = true
    }
  }, [])

  // Sauvegarde differee : `normaliser` reconstruit `materiaux` et
  // `eclairages` a chaque action, donc l'effet se redeclenche a chaque
  // frappe. Sans ce delai, chaque caractere tape provoquerait une ecriture
  // sessionStorage et une transaction IndexedDB.
  //
  // L'echec n'est jamais bloquant, mais il est signale : avaler l'erreur
  // laisserait la sauvegarde cesser de fonctionner sans que personne ne le
  // sache, et l'utilisateur perdrait tout au premier rechargement en croyant
  // son travail conserve.
  useEffect(() => {
    if (!restaure) return
    const minuteur = setTimeout(() => {
      sauvegarderEtat(etat).then(
        () => setPersistanceEnEchec(false),
        () => setPersistanceEnEchec(true),
      )
    }, 400)
    return () => clearTimeout(minuteur)
  }, [etat, restaure])

  useEffect(() => {
    getMateriaux()
      .then((reponse) => setCatalogue(reponse.materiaux))
      .catch((erreur: unknown) =>
        setErreurCatalogue(
          erreur instanceof Error ? erreur.message : 'Erreur inconnue.',
        ),
      )
  }, [])

  useEffect(() => {
    if (envoi.statut !== 'en_cours') return
    const minuteur = setInterval(() => {
      setEnvoi((courant) =>
        courant.statut === 'en_cours'
          ? { statut: 'en_cours', secondes: courant.secondes + 1 }
          : courant,
      )
    }, 1000)
    return () => clearInterval(minuteur)
  }, [envoi.statut])

  async function lancerGeneration() {
    if (enVol.current || !peutEnvoyer(etat)) return
    enVol.current = true
    setEnvoi({ statut: 'en_cours', secondes: 0 })
    try {
      const resultat = await generate(construirePayloadGenerate(etat))
      setEnvoi({ statut: 'reussi', resultat })
    } catch (erreur: unknown) {
      if (erreur instanceof ErreurMetier) {
        setEnvoi({ statut: 'echec', message: erreur.message, coupure: false })
      } else if (erreur instanceof ErreurReseau) {
        setEnvoi({ statut: 'echec', message: erreur.message, coupure: true })
      } else {
        setEnvoi({
          statut: 'echec',
          message: erreur instanceof Error ? erreur.message : 'Erreur inconnue.',
          coupure: false,
        })
      }
    } finally {
      enVol.current = false
    }
  }

  if (!restaure) {
    return <p className="p-8 text-sm text-slate-500">Chargement…</p>
  }

  if (envoi.statut === 'reussi') {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-6">
        <h1 className="text-lg font-medium text-slate-900">
          Rendu généré — {envoi.resultat.reference}
        </h1>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={envoi.resultat.image_url}
          alt="Rendu généré"
          className="w-full rounded-lg border border-slate-200"
        />
        <p className="text-xs text-slate-500">Cycle {envoi.resultat.cycle_id}</p>
      </main>
    )
  }

  const franchissable = etapeFranchissable(etat, etat.etape)
  const derniere = etat.etape === 7

  return (
    <ContexteFormulaireReact.Provider
      value={{ etat, envoyer, catalogue, erreurCatalogue }}
    >
      <main className="mx-auto max-w-3xl space-y-6 p-6">
        <header className="space-y-4">
          <h1 className="text-lg font-medium text-slate-900">Générateur de rendu</h1>
          <IndicateurEtapes />
          <h2 className="text-base text-slate-700">
            {etat.etape}. {TITRES[etat.etape]}
          </h2>
          {persistanceEnEchec && (
            <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              Vos saisies ne peuvent pas être enregistrées sur ce poste. Le
              formulaire reste utilisable, mais un rechargement de la page ferait
              tout perdre.
            </p>
          )}
        </header>

        {etat.etape === 1 && <Etape1Identification />}
        {etat.etape === 2 && <Etape2Documents />}
        {etat.etape === 3 && <Etape3Materiaux />}
        {etat.etape === 4 && <Etape4Environnement />}
        {etat.etape === 5 && <Etape5Style />}
        {etat.etape === 6 && <Etape6Precisions />}
        {etat.etape === 7 && <Etape7FicheProjet />}

        {envoi.statut === 'en_cours' && (
          <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
            <p>Génération en cours — {envoi.secondes} s</p>
            {envoi.secondes > 60 && (
              <p className="mt-1 text-xs text-slate-500">
                Une génération prend généralement une à deux minutes. Ne fermez pas cette
                page.
              </p>
            )}
          </div>
        )}

        {envoi.statut === 'echec' && (
          <div className="space-y-1 rounded-lg bg-rose-50 p-4 text-sm text-rose-800">
            <p>{envoi.message}</p>
            {envoi.coupure && (
              <p className="text-xs">
                La génération a peut-être abouti côté serveur malgré cette coupure. Vos
                saisies sont conservées.
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-200 pt-4">
          <button
            type="button"
            disabled={etat.etape === 1}
            onClick={() =>
              envoyer({ type: 'allerEtape', etape: etapeVoisine(etat.etape, -1) })
            }
            className="rounded-lg px-4 py-2 text-sm text-slate-600 disabled:text-slate-300"
          >
            Retour
          </button>

          {derniere ? (
            <button
              type="button"
              disabled={!peutEnvoyer(etat) || envoi.statut === 'en_cours'}
              onClick={lancerGeneration}
              className="rounded-lg bg-slate-900 px-5 py-2 text-sm text-white disabled:bg-slate-300"
            >
              {envoi.statut === 'en_cours' ? 'Génération…' : 'Lancer la génération'}
            </button>
          ) : (
            <button
              type="button"
              disabled={!franchissable}
              onClick={() =>
                envoyer({ type: 'allerEtape', etape: etapeVoisine(etat.etape, 1) })
              }
              className="rounded-lg bg-slate-900 px-5 py-2 text-sm text-white disabled:bg-slate-300"
            >
              Continuer
            </button>
          )}
        </div>
      </main>
    </ContexteFormulaireReact.Provider>
  )
}
