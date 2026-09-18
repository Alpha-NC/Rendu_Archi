import { libelleEvenement, type EvenementProjet } from '@/lib/rif/events'

/**
 * Timeline / audit trail (Lot 3 Project History, DECISIONS.md D-24) —
 * affichage seul, server component (comme FicheProjet.tsx) : pas
 * d'interactivité, pas de pagination dans cette passe minimale (mission
 * Lot 3 §21, pas de refonte cockpit). Composant `Timeline` séparé de
 * `DepotSources`/`FicheProjet` — un audit trail n'est ni une source ni un
 * état projet, un troisième axe de lecture du dossier.
 */
export default function Timeline({ evenements }: { evenements: EvenementProjet[] }) {
  return (
    <section className="rounded border border-encre-douce/30 p-3 text-xs">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-encre-douce">Activité</h2>

      {evenements.length === 0 ? (
        <p className="mt-2 text-encre-douce">Aucune activité enregistrée pour ce projet.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {evenements.map((evenement) => (
            <li key={evenement.id} className="flex flex-col border-b border-encre-douce/10 pb-1.5 last:border-0">
              <div className="flex items-baseline justify-between gap-2">
                <span>{libelleEvenement(evenement)}</span>
                <time dateTime={evenement.createdAt} className="shrink-0 text-encre-douce">
                  {new Date(evenement.createdAt).toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
              </div>
              {(evenement.renderTargetId || evenement.generationId || evenement.sourceId) && (
                <p className="text-encre-douce">
                  {evenement.renderTargetId && `cible : ${evenement.renderTargetId.slice(0, 8)}`}
                  {evenement.generationId && ` · génération : ${evenement.generationId.slice(0, 8)}`}
                  {evenement.sourceId && ` · source : ${evenement.sourceId.slice(0, 8)}`}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
