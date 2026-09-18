import type { SVGProps } from 'react'

export type IconName =
  | 'projects' | 'plus' | 'materials' | 'library' | 'settings' | 'logout'
  | 'search' | 'arrow' | 'model' | 'view' | 'photo' | 'axonometry'
  | 'check' | 'warning' | 'clock' | 'sparkle' | 'send' | 'upload'
  | 'compare' | 'quality' | 'details' | 'constraints' | 'align' | 'image'
  | 'message' | 'chevron' | 'close' | 'refresh' | 'lock' | 'edit'

const paths: Record<IconName, React.ReactNode> = {
  projects: <><path d="M3 5.5h7l1.5 2H21v11H3z"/><path d="M3 9h18"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  materials: <><circle cx="8" cy="8" r="4"/><circle cx="16" cy="16" r="4"/><path d="M11 13l2-2"/></>,
  library: <><path d="M5 4h12v16H5zM17 7h2v13H7"/><path d="M8 8h6M8 12h6"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z"/></>,
  logout: <><path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10"/></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></>,
  arrow: <><path d="M5 12h14M14 7l5 5-5 5"/></>,
  model: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/></>,
  view: <><rect x="3" y="4" width="18" height="16" rx="1"/><path d="m5 17 5-5 3 3 2-2 4 4M8 8h.01"/></>,
  photo: <><path d="M4 6h4l1-2h6l1 2h4v14H4z"/><circle cx="12" cy="13" r="4"/></>,
  axonometry: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12 4 7.5M12 12v9"/></>,
  check: <path d="m5 12 4 4L19 6"/>, warning: <><path d="M12 3 2.8 20h18.4z"/><path d="M12 9v4M12 17h.01"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  sparkle: <><path d="m12 3 1.4 4.1L17 9l-3.6 1.9L12 15l-1.4-4.1L7 9l3.6-1.9zM18 15l.7 2.3L21 18l-2.3.7L18 21l-.7-2.3L15 18l2.3-.7z"/></>,
  send: <><path d="m3 4 18 8-18 8 3-8z"/><path d="M6 12h15"/></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v4h16v-4"/></>,
  compare: <><rect x="3" y="5" width="8" height="14" rx="1"/><rect x="13" y="5" width="8" height="14" rx="1"/></>,
  quality: <><path d="m12 3 7 3v5c0 4.6-2.8 8-7 10-4.2-2-7-5.4-7-10V6z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></>,
  details: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></>,
  constraints: <><path d="M6 4v16M18 4v16M3 8h6M15 8h6M3 16h6M15 16h6"/><circle cx="12" cy="12" r="3"/></>,
  align: <><path d="M4 4v6h6M20 20v-6h-6M4 10c1-4 4-6 8-6 3 0 5 1 7 3M20 14c-1 4-4 6-8 6-3 0-5-1-7-3"/></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m4 16 5-5 4 4 2-2 5 5"/></>,
  message: <path d="M4 5h16v12H9l-5 4z"/>, chevron: <path d="m9 6 6 6-6 6"/>, close: <path d="M6 6l12 12M18 6 6 18"/>,
  refresh: <><path d="M20 6v5h-5M4 18v-5h5"/><path d="M18 11a7 7 0 0 0-12-4L4 11M6 13a7 7 0 0 0 12 4l2-4"/></>,
  lock: <><rect x="5" y="10" width="14" height="10" rx="1"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
  edit: <><path d="m4 20 4-.8L19 8.2 15.8 5 4.8 16z"/><path d="m14 6.8 3.2 3.2"/></>,
}

export function Icon({ name, className = 'size-4', ...props }: { name: IconName; className?: string } & SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" {...props}>{paths[name]}</svg>
}
