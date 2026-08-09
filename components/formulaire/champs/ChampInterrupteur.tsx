'use client'

type Props = {
  intitule: string
  description?: string
  valeur: boolean
  onChange: (valeur: boolean) => void
}

export function ChampInterrupteur({ intitule, description, valeur, onChange }: Props) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-[2px] border p-3 transition ${
        valeur ? 'border-encre bg-papier-eleve' : 'border-trait hover:border-encre-douce'
      }`}
    >
      <input
        type="checkbox"
        className="mt-1 accent-encre"
        checked={valeur}
        onChange={(evenement) => onChange(evenement.target.checked)}
      />
      <span>
        <span className="block text-sm text-encre">{intitule}</span>
        {description && (
          <span className="mt-0.5 block text-xs text-encre-douce">{description}</span>
        )}
      </span>
    </label>
  )
}
