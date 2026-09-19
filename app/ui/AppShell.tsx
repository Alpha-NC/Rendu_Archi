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

function accountInitials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.split('@')[0] || 'RIF'
  const parts = source.split(/[^a-z0-9À-ÿ]+/i).filter(Boolean)
  const initials = parts.length > 1 ? parts.slice(0, 2).map((part) => part[0]).join('') : source.slice(0, 2)
  return initials.toUpperCase()
}

export default function AppShell({ children, email, name, flush = false }: { children: React.ReactNode; email?: string | null; name?: string | null; flush?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const displayName = name?.trim() || 'Compte RIF'

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
          <div className="user-chip"><span className="user-avatar">{accountInitials(name, email)}</span><span className="min-w-0"><strong>{displayName}</strong><small>{email ?? 'Compte RIF'}</small></span></div>
          <button type="button" onClick={deconnexion} className="sidebar-logout"><Icon name="logout"/>Déconnexion</button>
        </div>
      </aside>
      <div className={flush ? 'app-content app-content--flush' : 'app-content'}>{children}</div>
    </div>
  )
}
