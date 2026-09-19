import type { EvenementEnrichi } from '@/lib/rif/events'

/**
 * Timeline / audit trail (Lot 3 Project History, DECISIONS.md D-24) —
 * affichage seul, server component (comme FicheProjet.tsx) : pas
 * d'interactivité, pas de pagination dans ce composant (la pagination vit
 * dans ProjectCockpit, qui gère l'état et recharge des pages). Composant
 * `Timeline` séparé de `DepotSources`/`FicheProjet` — un audit trail n'est ni
 * une source ni un état projet, un troisième axe de lecture du dossier.
 *
 * Lot 5 (VISUAL ALIGNMENT §21) : reprend `.data-list`/`.data-row` (déjà
 * utilisées par les autres sections du cockpit) au lieu d'un encart Tailwind
 * ad hoc, et affiche les références enrichies (nom de cible, type de
 * génération, rôle de source) au lieu d'UUID tronqués. Ne rend plus son
 * propre titre — le conteneur appelant (`DetailsView`) porte déjà « Activité ».
 */
export default function Timeline({ evenements }: { evenements: EvenementEnrichi[] }) {
  if (evenements.length === 0) {
    return <p className="page-lede" style={{ margin: 0 }}>Aucune activité enregistrée pour ce projet.</p>
  }

  return (
    <div className="data-list">
      {evenements.map((evenement) => (
        <div className="data-row" key={evenement.id} style={{ gridTemplateColumns: '1fr auto' }}>
          <span style={{ color: 'var(--ink)' }}>
            {evenement.label}
            {referenceLisible(evenement) && <small style={{ display: 'block', color: 'var(--muted)', marginTop: 2 }}>{referenceLisible(evenement)}</small>}
          </span>
          <time dateTime={evenement.createdAt} style={{ whiteSpace: 'nowrap' }}>
            {new Date(evenement.createdAt).toLocaleString('fr-FR', {
              day: '2-digit',
              month: '2-digit',
              year: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </time>
        </div>
      ))}
    </div>
  )
}

/** Une phrase courte plutôt que des UUID juxtaposés — `null` si aucune référence. */
function referenceLisible(evenement: EvenementEnrichi): string | null {
  const parties = [
    evenement.renderTarget && `Vue : ${evenement.renderTarget.name}`,
    evenement.generation && `Génération ${evenement.generation.type === 'correction' ? '(correction)' : evenement.generation.type === 'restart_from_sources' ? '(reprise)' : '(initiale)'}`,
    evenement.source && `Source : ${evenement.source.role}`,
  ].filter((p): p is string => Boolean(p))
  return parties.length > 0 ? parties.join(' · ') : null
}
