export default function Page() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-xs uppercase tracking-widest text-encre-douce">
        Alpha No_Code
      </p>
      <h1 className="mt-2 font-sans text-2xl font-semibold tracking-tight text-encre">
        RIF-App — en construction
      </h1>
      <p className="mt-3 text-sm text-encre-douce">
        Le formulaire V2 a été retiré. L&apos;application conversationnelle décrite dans{' '}
        <code className="font-mono text-xs">docs/prd-generateur-rendu-v2.md</code> (V1.3) est en
        phase de décisions architecturales (Phase 0A) avant tout développement.
      </p>
    </main>
  )
}
