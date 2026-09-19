import { Icon, type IconName } from './Icons'

export function StatusBadge({ tone = 'neutral', children }: { tone?: 'neutral'|'success'|'warning'|'danger'|'info'; children: React.ReactNode }) {
  return <span className={`status-badge status-badge--${tone}`}><span className="status-dot" />{children}</span>
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: React.ReactNode }) {
  return <header className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{description && <p className="page-lede">{description}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</header>
}

export function EmptyState({ icon = 'image', title, description, action }: { icon?: IconName; title: string; description: string; action?: React.ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><Icon name={icon} className="size-6"/></span><h3>{title}</h3><p>{description}</p>{action}</div>
}

export function ErrorState({ message, title = 'Action impossible' }: { message: string; title?: string }) {
  return <div className="error-state" role="alert"><Icon name="warning"/><div><strong>{title}</strong><p>{message}</p></div></div>
}

export function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function formatBytes(value?: number) {
  if (value === undefined) return null
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} Ko`
  return `${(value / (1024 * 1024)).toFixed(value > 10 * 1024 * 1024 ? 0 : 1)} Mo`
}
