type Props = {
  className?: string
}

const BASE = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export function IconeChevronGauche({ className }: Props) {
  return (
    <svg {...BASE} className={className} aria-hidden="true">
      <path d="M14.5 5.5 8 12l6.5 6.5" />
    </svg>
  )
}

export function IconeChevronDroit({ className }: Props) {
  return (
    <svg {...BASE} className={className} aria-hidden="true">
      <path d="M9.5 5.5 16 12l-6.5 6.5" />
    </svg>
  )
}

export function IconeTeleverser({ className }: Props) {
  return (
    <svg {...BASE} className={className} aria-hidden="true">
      <path d="M12 15.5V4M12 4 8 8M12 4l4 4" />
      <path d="M5 15.5v2A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5v-2" />
    </svg>
  )
}

export function IconeCoche({ className }: Props) {
  return (
    <svg {...BASE} className={className} aria-hidden="true">
      <path d="M5 12.5 9.5 17 19 6.5" />
    </svg>
  )
}

export function IconeCroix({ className }: Props) {
  return (
    <svg {...BASE} className={className} aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}
