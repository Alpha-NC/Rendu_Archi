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
      <legend className="text-sm font-medium text-slate-800">
        {intitule}
        {obligatoire && <span className="ml-1 text-rose-600">*</span>}
      </legend>
      <div className="grid gap-2">
        {options.map((option) => {
          const selectionne = valeur === option.valeur
          return (
            <label
              key={option.valeur}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                selectionne
                  ? 'border-slate-800 bg-slate-50'
                  : 'border-slate-200 hover:border-slate-400'
              }`}
            >
              <input
                type="radio"
                className="mt-1 accent-slate-800"
                checked={selectionne}
                onChange={() => onChange(option.valeur)}
              />
              <span>
                <span className="block text-sm text-slate-900">{option.libelle}</span>
                {option.description && (
                  <span className="mt-0.5 block text-xs text-slate-500">
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
