'use client'

type Props = {
  intitule: string
  description?: string
  valeur: boolean
  onChange: (valeur: boolean) => void
}

export function ChampInterrupteur({ intitule, description, valeur, onChange }: Props) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3">
      <input
        type="checkbox"
        className="mt-1 accent-slate-800"
        checked={valeur}
        onChange={(evenement) => onChange(evenement.target.checked)}
      />
      <span>
        <span className="block text-sm text-slate-900">{intitule}</span>
        {description && (
          <span className="mt-0.5 block text-xs text-slate-500">{description}</span>
        )}
      </span>
    </label>
  )
}
