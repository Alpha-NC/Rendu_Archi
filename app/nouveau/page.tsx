import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/server'
import AppShell from '@/app/ui/AppShell'
import NewProjectWizard from './NewProjectWizard'

export const dynamic='force-dynamic'
export default async function Page(){const {data:session}=await auth.getSession();if(!session?.user)redirect('/connexion');return <AppShell email={session.user.email}><NewProjectWizard/></AppShell>}
