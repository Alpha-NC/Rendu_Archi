import { notFound, redirect } from 'next/navigation'
import { creerClientServeur } from '@/lib/supabase/server'
import { creerDepotSupabase } from '@/lib/rif/depot-supabase'
import DepotSources from './DepotSources'
import ConversationRif from './ConversationRif'

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
      <h1 className="mt-1 font-sans text-xl font-semibold tracking-tight text-encre">
        {dossier.etat.replace(/_/g, ' ')}
      </h1>

      <div className="mt-6 grid flex-1 grid-cols-1 gap-6 md:grid-cols-[240px_1fr]">
        <DepotSources dossierId={dossier.id} sources={dossier.projectState.sources} />
        <ConversationRif dossierId={dossier.id} />
      </div>
    </main>
  )
}
