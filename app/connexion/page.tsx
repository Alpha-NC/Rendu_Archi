import { seConnecter } from './actions'

export const metadata = {
  title: 'Connexion — Générateur de rendu',
}

type Props = {
  searchParams: Promise<{ erreur?: string; suite?: string }>
}

export default async function PageConnexion({ searchParams }: Props) {
  const { erreur, suite } = await searchParams

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6">
      <p className="font-mono text-xs uppercase tracking-widest text-encre-douce">
        Alpha No_Code
      </p>
      <h1 className="mt-1 font-sans text-2xl font-semibold tracking-tight text-encre">
        Générateur de rendu
      </h1>
      <p className="mt-1 text-sm text-encre-douce">Accès protégé par mot de passe.</p>

      <form action={seConnecter} className="mt-8 space-y-4">
        <input type="hidden" name="suite" value={suite ?? '/'} />
        <div className="space-y-2">
          <label
            htmlFor="motDePasse"
            className="block font-sans text-sm font-semibold uppercase tracking-wide text-encre"
          >
            Mot de passe
          </label>
          <input
            id="motDePasse"
            name="motDePasse"
            type="password"
            autoFocus
            required
            className="w-full rounded-[2px] border border-trait bg-papier p-2.5 text-sm text-encre"
          />
        </div>

        {erreur && (
          <p className="rounded-[2px] border border-rouille/50 bg-rouille-fond/60 p-3 text-sm text-encre">
            Mot de passe incorrect.
          </p>
        )}

        <button
          type="submit"
          className="w-full rounded-[3px] bg-encre px-6 py-2.5 font-sans text-sm font-semibold uppercase tracking-wide text-papier transition hover:bg-encre/90"
        >
          Entrer
        </button>
      </form>
    </main>
  )
}
