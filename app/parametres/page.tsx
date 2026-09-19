import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/server'
import AppShell from '@/app/ui/AppShell'
import { PageHeader } from '@/app/ui/Primitives'
import AccountSettings from './AccountSettings'

export const dynamic='force-dynamic'
export default async function Page(){const{data:session}=await auth.getSession();if(!session?.user)redirect('/connexion');return <AppShell email={session.user.email} name={session.user.name}><main className="page-shell"><PageHeader eyebrow="Espace personnel" title="Paramètres" description="Compte et session. Aucun secret technique n’est exposé."/><AccountSettings email={session.user.email??''} name={session.user.name}/></main></AppShell>}
