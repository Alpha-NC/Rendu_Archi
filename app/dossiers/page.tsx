import { redirect } from 'next/navigation'
import { creerClientServeur } from '@/lib/supabase/server'
import { creerDepotSupabase } from '@/lib/rif/depot-supabase'
import BoutonNouveauDossier from './BoutonNouveauDossier'

/**
 * Liste des dossiers de l'utilisateur (PRD §7 : périmètre V1, un dossier à
 * la fois — pas de traitement par lot).
 */
export default async function PageDossiers() {
  const supabase = await creerClientServeur()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Le proxy garantit déjà une session sur cette route ; garde-fou local.
  if (!user) redirect('/connexion')

  const depot = creerDepotSupabase(supabase)
  const dossiers = await depot.listerDossiers(user.id)

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-12">
      <p className="font-mono text-xs uppercase tracking-widest text-encre-douce">Alpha No_Code</p>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="font-sans text-2xl font-semibold tracking-tight text-encre">Dossiers</h1>
        <BoutonNouveauDossier />
      </div>

      {dossiers.length === 0 ? (
        <p className="mt-8 text-sm text-encre-douce">
          Aucun dossier pour l&apos;instant. Crée le premier pour démarrer une conversation.
        </p>
      ) : (
        <ul className="mt-8 flex flex-col gap-2">
          {dossiers.map((d) => (
            <li key={d.id}>
              <a
                href={`/dossiers/${d.id}`}
                className="flex items-center justify-between rounded border border-encre-douce/30 px-4 py-3 text-sm hover:border-encre-douce/60"
              >
                <span className="font-mono">{d.dossierRef}</span>
                <span className="text-encre-douce">{d.etat}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
