import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth/server'
import { sql } from '@/lib/neon/client'
import { creerDepotNeon } from '@/lib/rif/depot-neon'
import AppShell from '@/app/ui/AppShell'
import ProjectCockpit from './ProjectCockpit'

// Neon Auth lit la session à chaque requête : rendu dynamique obligatoire.
export const dynamic = 'force-dynamic'

export default async function PageDossier({ params }: { params: Promise<{ dossierId: string }> }) {
  const { dossierId } = await params
  const { data: session } = await auth.getSession()

  if (!session?.user) redirect('/connexion')

  const depot = creerDepotNeon(sql)
  const dossier = await depot.obtenirDossier(dossierId)

  if (!dossier || dossier.ownerId !== session.user.id) notFound()

  // Lot 2 Source Lifecycle (D-23) — domaine séparé de project_state.sources.
  const assetsTemporaires = await depot.listerAssetsTemporaires(dossier.id)
  // Lot 3 Project History (D-24) — première page ; le curseur permet au
  // cockpit (client) de charger la suite à la demande (Lot 4 §20).
  const { events: evenementsRecents, nextCursor: eventsNextCursor } = await depot.listerEvenements(dossier.id, { limite: 30 })

  return (
    <AppShell email={session.user.email} flush>
      <ProjectCockpit
        dossier={dossier}
        assetsTemporaires={assetsTemporaires}
        evenementsRecents={evenementsRecents}
        eventsNextCursor={eventsNextCursor}
      />
    </AppShell>
  )
}
