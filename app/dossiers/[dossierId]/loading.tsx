export default function Loading() {
  return (
    <main className="cockpit-loading" aria-busy="true" aria-label="Chargement du projet">
      <aside className="cockpit-loading__rail" aria-hidden="true">
        <span className="cockpit-loading__brand">RIF</span>
        {[0, 1, 2, 3, 4].map((item) => <span className="skeleton cockpit-loading__nav" key={item} />)}
      </aside>
      <section className="cockpit-loading__shell">
        <header className="cockpit-loading__header">
          <span className="skeleton cockpit-loading__project" />
          <span className="skeleton cockpit-loading__action" />
        </header>
        <div className="cockpit-loading__body" aria-hidden="true">
          <aside className="cockpit-loading__panel">
            {[0, 1, 2, 3, 4, 5].map((item) => <span className="skeleton" key={item} />)}
          </aside>
          <div className="cockpit-loading__viewer"><span className="skeleton" /></div>
          <aside className="cockpit-loading__chat">
            {[0, 1, 2, 3].map((item) => <span className="skeleton" key={item} />)}
          </aside>
        </div>
      </section>
      <span className="sr-only">Chargement du projet…</span>
    </main>
  )
}
