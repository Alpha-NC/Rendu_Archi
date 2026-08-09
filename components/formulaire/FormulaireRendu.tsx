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
import { IconeChevronDroit, IconeChevronGauche } from './Icones'

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
    return (
      <p className="p-10 text-center font-mono text-xs uppercase tracking-widest text-encre-douce">
        Chargement…
      </p>
    )
  }

  if (envoi.statut === 'reussi') {
    return (
      <main className="mx-auto max-w-3xl space-y-5 px-6 py-10 sm:px-10 sm:py-14">
        <h1 className="font-sans text-3xl font-semibold tracking-tight text-encre sm:text-4xl">
          Rendu généré
          <span className="ml-3 font-mono text-base font-normal tracking-normal text-encre-douce">
            {envoi.resultat.reference}
          </span>
        </h1>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={envoi.resultat.image_url}
          alt="Rendu généré"
          className="w-full rounded-[2px] border border-trait"
        />
        <p className="font-mono text-xs uppercase tracking-widest text-encre-douce">
          Cycle {envoi.resultat.cycle_id}
        </p>
      </main>
    )
  }

  const franchissable = etapeFranchissable(etat, etat.etape)
  const derniere = etat.etape === 7

  return (
    <ContexteFormulaireReact.Provider
      value={{ etat, envoyer, catalogue, erreurCatalogue }}
    >
      <main className="mx-auto max-w-3xl px-6 py-10 sm:px-10 sm:py-14">
        <header className="space-y-6">
          <IndicateurEtapes />
          <h1 className="font-sans text-4xl font-semibold tracking-tight text-encre sm:text-5xl">
            <span className="mr-3 align-middle font-mono text-lg font-normal tracking-normal text-encre-douce">
              {String(etat.etape).padStart(2, '0')}/07
            </span>
            {TITRES[etat.etape]}
          </h1>
          {persistanceEnEchec && (
            <p className="rounded-[2px] border border-ocre/50 bg-ocre-fond/60 p-3 text-xs text-encre">
              Vos saisies ne peuvent pas être enregistrées sur ce poste. Le
              formulaire reste utilisable, mais un rechargement de la page ferait
              tout perdre.
            </p>
          )}
        </header>

        <div className="mt-8 space-y-8">
          {etat.etape === 1 && <Etape1Identification />}
          {etat.etape === 2 && <Etape2Documents />}
          {etat.etape === 3 && <Etape3Materiaux />}
          {etat.etape === 4 && <Etape4Environnement />}
          {etat.etape === 5 && <Etape5Style />}
          {etat.etape === 6 && <Etape6Precisions />}
          {etat.etape === 7 && <Etape7FicheProjet />}
        </div>

        {envoi.statut === 'en_cours' && (
          <div className="mt-8 flex items-start gap-3 rounded-[2px] border border-trait bg-papier-eleve p-4 text-sm text-encre">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-encre" />
            <div>
              <p>Génération en cours — {envoi.secondes} s</p>
              {envoi.secondes > 60 && (
                <p className="mt-1 text-xs text-encre-douce">
                  Une génération prend généralement une à deux minutes. Ne fermez pas cette
                  page.
                </p>
              )}
            </div>
          </div>
        )}

        {envoi.statut === 'echec' && (
          <div className="mt-8 space-y-1 rounded-[2px] border border-rouille/50 bg-rouille-fond/60 p-4 text-sm text-encre">
            <p>{envoi.message}</p>
            {envoi.coupure && (
              <p className="text-xs text-encre-douce">
                La génération a peut-être abouti côté serveur malgré cette coupure. Vos
                saisies sont conservées.
              </p>
            )}
          </div>
        )}

        <div className="mt-10 flex items-center justify-between border-t border-trait pt-6">
          <button
            type="button"
            disabled={etat.etape === 1}
            onClick={() =>
              envoyer({ type: 'allerEtape', etape: etapeVoisine(etat.etape, -1) })
            }
            className="inline-flex items-center gap-1.5 text-sm text-encre-douce transition hover:text-encre disabled:cursor-not-allowed disabled:text-encre-douce/30"
          >
            <IconeChevronGauche className="h-4 w-4" />
            Retour
          </button>

          {derniere ? (
            <button
              type="button"
              disabled={!peutEnvoyer(etat) || envoi.statut === 'en_cours'}
              onClick={lancerGeneration}
              className="rounded-[3px] bg-encre px-6 py-2.5 font-sans text-sm font-semibold uppercase tracking-wide text-papier transition hover:bg-encre/90 disabled:cursor-not-allowed disabled:bg-papier-creux disabled:text-encre-douce/40"
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
              className="inline-flex items-center gap-2 rounded-[3px] bg-encre px-6 py-2.5 font-sans text-sm font-semibold uppercase tracking-wide text-papier transition hover:bg-encre/90 disabled:cursor-not-allowed disabled:bg-papier-creux disabled:text-encre-douce/40"
            >
              Continuer
              <IconeChevronDroit className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between font-mono text-[0.65rem] uppercase tracking-widest text-encre-douce/70">
          <span>Alpha No_Code</span>
          <span>{etat.reference ? etat.reference : 'Sans référence'}</span>
        </div>
      </main>
    </ContexteFormulaireReact.Provider>
  )
}
