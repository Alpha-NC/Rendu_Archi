import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/server'
import AppShell from '@/app/ui/AppShell'
import { EmptyState, PageHeader } from '@/app/ui/Primitives'

export const dynamic='force-dynamic'
export default async function Page(){const{data:session}=await auth.getSession();if(!session?.user)redirect('/connexion');return <AppShell email={session.user.email} name={session.user.name}><main className="page-shell"><PageHeader eyebrow="Ressources" title="Bibliothèque" description="Références, matériaux et préréglages partagés."/><EmptyState icon="library" title="Bibliothèque bientôt disponible" description="Aucun contrat backend robuste ne permet encore de gérer une bibliothèque globale. Aucun contenu de démonstration n’est affiché à la place." action={<button className="button" disabled>Être informé des nouveautés</button>}/></main></AppShell>}
