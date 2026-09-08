import type { ProjectState, ValeurTracee } from '@/lib/rif/project-state'

/**
 * Fiche projet (PRD §9.4) : « La fiche affiche les données validées et
 * provisoires, la hiérarchie des sources, le mode et le style, les zones
 * modifiables et verrouillées, les matériaux et leurs références limitées,
 * les directives issues d'annotations, les éléments intouchables, les
 * suppressions et ajouts autorisés, les interdictions et les éventuelles
 * réserves. »
 *
 * Sans elle, la confirmation exigée au même §9.4 se ferait à l'aveugle.
 * Affichage seul, aucune interactivité — l'édition passe par la
 * conversation (mettreAJourFicheProjet, D-15).
 */

const LIBELLE_STATUT: Record<string, string> = {
  validated: 'validé',
  provisional: 'provisoire',
  rejected: 'rejeté',
  unknown: 'inconnu',
}

function Valeur({ v }: { v: ValeurTracee<string> | undefined }) {
  if (!v) return <span className="text-encre-douce">—</span>
  return (
    <span>
      {v.value}{' '}
      <span className={v.status === 'validated' ? 'text-emerald-700' : 'text-amber-700'}>
        ({LIBELLE_STATUT[v.status] ?? v.status})
      </span>
    </span>
  )
}

function Ligne({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 py-0.5">
      <dt className="w-32 shrink-0 text-encre-douce">{label}</dt>
      <dd className="min-w-0 flex-1 break-words">{children}</dd>
    </div>
  )
}

export default function FicheProjet({ projectState }: { projectState: ProjectState }) {
  const materiaux = Object.entries(projectState.materials)
  const references = projectState.sources.filter(
    (s) => (s.role_confirmed ?? s.role_detected) === 'material_reference',
  )

  return (
    <section className="rounded border border-encre-douce/30 p-3 text-xs">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-encre-douce">Fiche projet</h2>
        <span className="font-mono text-[10px] text-encre-douce">révision {projectState.revision}</span>
      </div>

      <dl className="mt-2">
        <Ligne label="Usage">{projectState.usage.join(', ') || <span className="text-encre-douce">—</span>}</Ligne>
        <Ligne label="Mode">{projectState.mode ?? <span className="text-encre-douce">non déterminé</span>}</Ligne>
        <Ligne label="Style">{projectState.style ?? <span className="text-encre-douce">non déterminé</span>}</Ligne>
        <Ligne label="Caméra">{projectState.camera_compatibility}</Ligne>
        <Ligne label="Géométrie"><Valeur v={projectState.geometrie} /></Ligne>
        <Ligne label="Implantation"><Valeur v={projectState.implantation} /></Ligne>
        <Ligne label="Zone d'interv."><Valeur v={projectState.zone_intervention} /></Ligne>
        <Ligne label="Lumière"><Valeur v={projectState.lumiere} /></Ligne>

        <Ligne label="Sources">
          {projectState.sources.length === 0 ? (
            <span className="text-encre-douce">aucune</span>
          ) : (
            <ul>
              {projectState.sources.map((s) => (
                <li key={s.id}>
                  {s.role_confirmed ?? s.role_detected}
                  {s.role_confirmed ? '' : ' (rôle non confirmé)'}
                  {s.target ? ` → ${s.target}` : ''}
                </li>
              ))}
            </ul>
          )}
        </Ligne>

        <Ligne label="Matériaux">
          {materiaux.length === 0 ? (
            <span className="text-encre-douce">aucun</span>
          ) : (
            <ul>
              {materiaux.map(([element, v]) => (
                <li key={element}>
                  {element} : <Valeur v={v} />
                </li>
              ))}
            </ul>
          )}
        </Ligne>

        {/* ADR-014 : une référence matériau ne commande que l'apparence de l'élément ciblé. */}
        <Ligne label="Réf. matériau">
          {references.length === 0 ? (
            <span className="text-encre-douce">aucune</span>
          ) : (
            <ul>
              {references.map((r) => (
                <li key={r.id}>apparence de « {r.target ?? 'cible non précisée'} » uniquement</li>
              ))}
            </ul>
          )}
        </Ligne>

        <Ligne label="Directives">
          {projectState.localized_directives.length === 0 ? (
            <span className="text-encre-douce">aucune</span>
          ) : (
            <ul>
              {projectState.localized_directives.map((d, i) => (
                <li key={i}>
                  {d.action} — {d.target} ({LIBELLE_STATUT[d.status] ?? d.status})
                </li>
              ))}
            </ul>
          )}
        </Ligne>

        <Ligne label="Env. conservé">
          {projectState.environnement_a_conserver?.join(', ') || <span className="text-encre-douce">—</span>}
        </Ligne>
        <Ligne label="Zones verrou.">
          {projectState.locked.join(', ') || <span className="text-encre-douce">aucune</span>}
        </Ligne>
        <Ligne label="Interdictions">
          {projectState.interdictions?.join(', ') || <span className="text-encre-douce">—</span>}
        </Ligne>
        <Ligne label="Réserves">
          {projectState.reserves?.join(', ') || <span className="text-encre-douce">—</span>}
        </Ligne>
      </dl>
    </section>
  )
}
