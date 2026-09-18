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

  return <AppShell email={session.user.email} flush><ProjectCockpit dossier={dossier}/></AppShell>
}
