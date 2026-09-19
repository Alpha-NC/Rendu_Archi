export default function Loading() {
  return (
    <main className="route-loading" aria-busy="true" aria-label="Chargement des projets">
      <header className="route-loading__header">
        <span className="skeleton route-loading__eyebrow" />
        <span className="skeleton route-loading__title" />
        <span className="skeleton route-loading__lede" />
      </header>
      <div className="route-loading__grid" aria-hidden="true">
        {[0, 1, 2].map((item) => (
          <div className="route-loading__card" key={item}>
            <span className="skeleton route-loading__visual" />
            <span className="skeleton" />
            <span className="skeleton" />
            <span className="skeleton" />
          </div>
        ))}
      </div>
      <span className="sr-only">Chargement des projets…</span>
    </main>
  )
}
