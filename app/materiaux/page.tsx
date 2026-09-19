import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/server'
import AppShell from '@/app/ui/AppShell'
import { EmptyState, PageHeader } from '@/app/ui/Primitives'
import { Icon } from '@/app/ui/Icons'

export const dynamic='force-dynamic'
export default async function Page(){const{data:session}=await auth.getSession();if(!session?.user)redirect('/connexion');return <AppShell email={session.user.email} name={session.user.name}><main className="page-shell"><PageHeader eyebrow="Référentiel projet" title="Matériaux" description="Les matériaux sont gouvernés par le ProjectState de chaque projet."/><EmptyState icon="materials" title="Matériaux liés aux projets" description="Le backend ne fournit pas de catalogue global. Ouvrez un projet pour consulter uniquement ses matériaux réels et leur provenance." action={<Link href="/dossiers" className="button button--primary"><Icon name="projects"/>Voir les projets</Link>}/></main></AppShell>}
