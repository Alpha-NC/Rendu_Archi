'use client'

type Option<T extends string> = {
  valeur: T
  libelle: string
  description?: string
}

type Props<T extends string> = {
  intitule: string
  options: readonly Option<T>[]
  valeur: T | null
  onChange: (valeur: T) => void
  obligatoire?: boolean
}

export function ChampChoixUnique<T extends string>({
  intitule,
  options,
  valeur,
  onChange,
  obligatoire = false,
}: Props<T>) {
  return (
    <fieldset className="space-y-3">
      <legend className="font-sans text-sm font-semibold uppercase tracking-wide text-encre">
        {intitule}
        {obligatoire && <span className="ml-1 text-rouille">*</span>}
      </legend>
      <div className="grid gap-2">
        {options.map((option) => {
          const selectionne = valeur === option.valeur
          return (
            <label
              key={option.valeur}
              className={`flex cursor-pointer items-start gap-3 rounded-[2px] border p-3 transition ${
                selectionne
                  ? 'border-encre bg-papier-eleve'
                  : 'border-trait hover:border-encre-douce'
              }`}
            >
              <input
                type="radio"
                className="mt-1 accent-encre"
                checked={selectionne}
                onChange={() => onChange(option.valeur)}
              />
              <span>
                <span className="block text-sm text-encre">{option.libelle}</span>
                {option.description && (
                  <span className="mt-0.5 block text-xs text-encre-douce">
                    {option.description}
                  </span>
                )}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
