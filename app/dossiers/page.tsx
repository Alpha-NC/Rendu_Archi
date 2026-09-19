import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/server'
import { sql } from '@/lib/neon/client'
import { creerDepotNeon } from '@/lib/rif/depot-neon'
import AppShell from '@/app/ui/AppShell'
import ProjectDashboard from './ProjectDashboard'

// Neon Auth lit la session à chaque requête : rendu dynamique obligatoire.
export const dynamic = 'force-dynamic'

/**
 * Liste des dossiers de l'utilisateur (PRD §7 : périmètre V1, un dossier à
 * la fois — pas de traitement par lot).
 */
export default async function PageDossiers() {
  const { data: session } = await auth.getSession()

  // Le proxy garantit déjà une session sur cette route ; garde-fou local.
  if (!session?.user) redirect('/connexion')

  const depot = creerDepotNeon(sql)
  const dossiers = await depot.listerDossiers(session.user.id)

  return <AppShell email={session.user.email} name={session.user.name}><ProjectDashboard dossiers={dossiers} /></AppShell>
}
