import { notFound, redirect } from 'next/navigation'
import { creerClientServeur } from '@/lib/supabase/server'
import { creerDepotSupabase } from '@/lib/rif/depot-supabase'
import DepotSources from './DepotSources'
import ConversationRif from './ConversationRif'
import BoutonConfirmerFiche from './BoutonConfirmerFiche'
import FicheProjet from './FicheProjet'

export default async function PageDossier({ params }: { params: Promise<{ dossierId: string }> }) {
  const { dossierId } = await params
  const supabase = await creerClientServeur()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/connexion')

  const depot = creerDepotSupabase(supabase)
  const dossier = await depot.obtenirDossier(dossierId)

  if (!dossier || dossier.ownerId !== user.id) notFound()

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-8">
      <p className="font-mono text-xs uppercase tracking-widest text-encre-douce">{dossier.dossierRef}</p>
      <div className="mt-1 flex items-center justify-between">
        <h1 className="font-sans text-xl font-semibold tracking-tight text-encre">
          {dossier.etat.replace(/_/g, ' ')}
        </h1>
        {dossier.etat === 'FICHE_A_CONFIRMER' && <BoutonConfirmerFiche dossierId={dossier.id} />}
      </div>

      <div className="mt-6 grid flex-1 grid-cols-1 gap-6 md:grid-cols-[280px_1fr]">
        <div className="flex flex-col gap-6">
          <DepotSources dossierId={dossier.id} sources={dossier.projectState.sources} />
          {/* PRD §9.4 : la fiche doit être visible — sans elle, la
              confirmation demandée juste au-dessus se ferait à l'aveugle. */}
          <FicheProjet projectState={dossier.projectState} />
        </div>
        <ConversationRif dossierId={dossier.id} />
      </div>
    </main>
  )
}
