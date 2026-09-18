'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth/client'
import { Icon, type IconName } from './Icons'

const NAV: Array<{ href: string; label: string; icon: IconName }> = [
  { href: '/dossiers', label: 'Projets', icon: 'projects' },
  { href: '/nouveau', label: 'Nouveau projet', icon: 'plus' },
  { href: '/materiaux', label: 'Matériaux', icon: 'materials' },
  { href: '/bibliotheque', label: 'Bibliothèque', icon: 'library' },
  { href: '/parametres', label: 'Paramètres', icon: 'settings' },
]

export default function AppShell({ children, email, flush = false }: { children: React.ReactNode; email?: string | null; flush?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()

  async function deconnexion() {
    await authClient.signOut()
    router.push('/connexion')
    router.refresh()
  }

  return (
    <div className="app-frame">
      <aside className="global-sidebar">
        <Link href="/dossiers" className="brand-lockup" aria-label="RIF — Accueil projets">
          <span className="brand-mark">RIF</span>
          <span className="brand-subtitle">Rendus Immobiliers Fidèles</span>
        </Link>
        <div className="sidebar-rule" />
        <nav aria-label="Navigation principale" className="sidebar-nav">
          {NAV.map((item) => {
            const active = item.href === '/dossiers' ? pathname.startsWith('/dossiers') : pathname === item.href
            return <Link key={item.href} href={item.href} className={`sidebar-link ${active ? 'is-active' : ''}`} aria-current={active ? 'page' : undefined}><Icon name={item.icon}/><span>{item.label}</span></Link>
          })}
        </nav>
        <div className="sidebar-foot">
          <div className="user-chip"><span className="user-avatar">EB</span><span className="min-w-0"><strong>Évariste Blasco</strong><small>{email ?? 'Compte RIF'}</small></span></div>
          <button type="button" onClick={deconnexion} className="sidebar-logout"><Icon name="logout"/>Déconnexion</button>
        </div>
      </aside>
      <div className={flush ? 'app-content app-content--flush' : 'app-content'}>{children}</div>
    </div>
  )
}
