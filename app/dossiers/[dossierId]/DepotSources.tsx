'use client'

import { upload } from '@vercel/blob/client'
import { useRouter } from 'next/navigation'
import { type ReactNode, useState } from 'react'
import { ACTIONS_DIRECTIVE, type DirectiveLocalisee, type RoleSource, type SourceDossier } from '@/lib/rif/project-state'
import type { SourceModele3D } from '@/lib/rif/geometrie-3d'
import type { FichierSourceDetail, TemporaryAssetDetail } from '@/lib/rif/sources'
import { lireReponseApi } from '@/lib/rif/reponse-client'
import { TAILLE_SOURCE_MAX_OCTETS } from '@/lib/storage/contraintes-source'
import { TAILLE_MODELE_3D_MAX_OCTETS } from '@/lib/storage/contraintes-modele-3d'
import { TAILLE_TEMPORARY_ASSET_MAX_OCTETS } from '@/lib/storage/contraintes-temporary-assets'
import { Icon, type IconName } from '@/app/ui/Icons'
import { ErrorState, formatBytes } from '@/app/ui/Primitives'

// Lot 5 (VISUAL ALIGNMENT §14) : reprend telles quelles les cartes source du
// wizard (`.source-choice`, déjà alignées sur la maquette) au lieu de blocs
// Tailwind ad hoc — une même carte (icône, autorité, dépôt/remplacement,
// fichier actif) sert donc au wizard ET au cockpit.
const SOURCE_META: Record<'model_3d' | 'revit_view' | 'site_photo' | 'axonometry', { label: string; authority: string; icon: IconName }> = {
  model_3d: { label: 'Modèle 3D', authority: 'Autorité géométrique', icon: 'model' },
  revit_view: { label: 'Vue projet', authority: 'Autorité de cadrage', icon: 'view' },
  site_photo: { label: 'Photo réelle', authority: 'Autorité environnementale', icon: 'photo' },
  axonometry: { label: 'Axonométrie', authority: 'Contrôle spatial', icon: 'axonometry' },
}

/**
 * Lot 2 Source Lifecycle (D-23) — humanise toute erreur issue directement
 * du SDK client Vercel Blob (`upload()`), qui ne remonte jamais le détail
 * serveur (voir lib/storage/vercel-blob.ts::verifierBlobConfigure : un 400
 * quelconque devient systématiquement « Failed to retrieve the client
 * token » côté SDK, quel que soit le corps JSON réellement renvoyé). Le
 * détail technique reste en console développeur, jamais affiché tel quel.
 */
function messageUploadHumanise(e: unknown): string {
  console.error('[upload]', e)
  return "Impossible de préparer l'envoi du fichier. Réessayez."
}

/** Concurrence limitée pour le multi-upload (mission Lot 2 §12) — ne pas saturer navigateur/réseau. */
const CONCURRENCE_MULTI_UPLOAD = 3

// Reprend la disposition du prototype de référence (docs/rif_chat_prototype.jsx,
// annexe PRD §27) : vue Revit obligatoire, photo et axonométrie facultatives.
// Libellés alignés sur RIF V2 (geometry-first, DECISIONS.md ADR-021) — le
// rôle technique (revit_view/site_photo) est inchangé, seul l'intitulé
// affiché change pour refléter les 4 blocs du nouveau workflow.
const SLOTS: Array<{ role: 'revit_view' | 'site_photo' | 'axonometry'; label: string; obligatoire: boolean }> = [
  { role: 'revit_view', label: 'Vue projet', obligatoire: true },
  { role: 'site_photo', label: 'Photo réelle', obligatoire: false },
  { role: 'axonometry', label: 'Axonométrie', obligatoire: false },
]

// Rôles que la détection automatique peut produire (lib/rif/detection-role.ts,
// non importé ici : ce module charge le SDK Anthropic, réservé au serveur).
const ROLES_CONFIRMABLES: Array<{ role: RoleSource; label: string }> = [
  { role: 'revit_view', label: 'Vue 3D Revit' },
  { role: 'site_photo', label: 'Photo du site' },
  { role: 'axonometry', label: 'Axonométrie' },
  { role: 'annotated_source', label: 'Source annotée' },
  { role: 'material_reference', label: 'Référence matériau' },
  { role: 'existing_building_photo', label: 'Photo bâtiment existant' },
]

export default function DepotSources({
  dossierId,
  sources,
  directives,
  modele3D,
  assetsTemporaires = [],
}: {
  dossierId: string
  sources: SourceDossier[]
  directives: DirectiveLocalisee[]
  /** RIF V2, geometry-first (DECISIONS.md ADR-021) — absent tant qu'aucun modèle 3D n'a été déposé. */
  modele3D?: SourceModele3D
  /** Lot 2 Source Lifecycle (D-23) — photos terrain, jamais une autorité. */
  assetsTemporaires?: TemporaryAssetDetail[]
}) {
  const router = useRouter()
  const [enCours, setEnCours] = useState<RoleSource | null>(null)
  const [enCoursModele3D, setEnCoursModele3D] = useState(false)
  const [enCoursAssets, setEnCoursAssets] = useState(false)
  const [suppressionEnCours, setSuppressionEnCours] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [confirmationEnCours, setConfirmationEnCours] = useState<string | null>(null)
  // Lot 4 §17 — historique de versions par fileId, chargé à la demande
  // (GET .../sources/[fileId]/versions), jamais préchargé pour tous les rôles.
  const [versions, setVersions] = useState<Record<string, FichierSourceDetail[] | 'chargement'>>({})
  const [brouillonsDirectives, setBrouillonsDirectives] = useState<Record<string, { action: string; target: string }>>({})
  const aConfirmer = sources.filter((s) => !s.role_confirmed)
  // ADR-015, PRD §9.2 : une directive au statut unknown n'est utilisable
  // qu'après confirmation individuelle de sa cible et de son action.
  const directivesAConfirmer = directives.filter((d) => d.status === 'unknown')

  async function confirmerRole(fileId: string, role: RoleSource) {
    setConfirmationEnCours(fileId)
    setErreur(null)
    try {
      const reponse = await fetch(`/api/dossiers/${dossierId}/sources/${fileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      await lireReponseApi(reponse)
      router.refresh()
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue.')
    } finally {
      setConfirmationEnCours(null)
    }
  }

  function brouillonDirective(d: DirectiveLocalisee) {
    return brouillonsDirectives[d.id] ?? { action: d.action, target: d.target }
  }

  async function confirmerDirective(directiveId: string, action: string, target: string) {
    setConfirmationEnCours(directiveId)
    setErreur(null)
    try {
      const reponse = await fetch(`/api/dossiers/${dossierId}/directives/${directiveId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, target }),
      })
      await lireReponseApi(reponse)
      router.refresh()
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue.')
    } finally {
      setConfirmationEnCours(null)
    }
  }

  async function deposer(role: RoleSource, fichier: File) {
    setEnCours(role)
    setErreur(null)
    try {
      if (fichier.size === 0 || fichier.size > TAILLE_SOURCE_MAX_OCTETS) {
        throw new Error('Fichier vide ou dépassant la taille maximale acceptée (25 Mo).')
      }

      // PRD V2.1 §16.1 (D-19) : upload direct navigateur → Vercel Blob — le
      // corps d'une Vercel Function est plafonné à 4,5 Mo, incompatible avec
      // des exports Revit ou rendus réels. Le jeton (émis par
      // .../sources/token) est contraint en type/taille/portée, jamais le
      // jeton maître.
      const extension = fichier.name.split('.').pop() ?? 'bin'
      // eslint-disable-next-line react-hooks/purity -- deposer() n'exécute qu'en réponse à un événement (onChange), jamais pendant le rendu.
      const pathname = `${dossierId}/sources/${role}-${Date.now()}.${extension}`
      let blob
      try {
        blob = await upload(pathname, fichier, {
          access: 'private',
          contentType: fichier.type,
          handleUploadUrl: `/api/dossiers/${dossierId}/sources/token`,
        })
      } catch (e) {
        throw new Error(messageUploadHumanise(e))
      }

      const reponse = await fetch(`/api/dossiers/${dossierId}/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pathname: blob.pathname, originalName: fichier.name, role }),
      })
      await lireReponseApi(reponse)
      router.refresh()
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue.')
    } finally {
      setEnCours(null)
    }
  }

  /**
   * RIF V2, geometry-first (DECISIONS.md ADR-021) — pas une image : aucune
   * classification automatique n'est appelée, le format n'est pas encore
   * figé (le nom de fichier ne sert qu'à en tirer un libellé, jamais une
   * validation réelle — voir lib/rif/geometrie-3d.ts).
   */
  async function deposerModele3D(fichier: File) {
    setEnCoursModele3D(true)
    setErreur(null)
    try {
      if (fichier.size === 0 || fichier.size > TAILLE_MODELE_3D_MAX_OCTETS) {
        throw new Error('Fichier vide ou dépassant la taille maximale acceptée (500 Mo).')
      }

      const extension = fichier.name.split('.').pop()?.toLowerCase() ?? 'bin'
      const pathname = `${dossierId}/modele-3d/${Date.now()}.${extension}`
      let blob
      try {
        blob = await upload(pathname, fichier, {
          access: 'private',
          handleUploadUrl: `/api/dossiers/${dossierId}/modele-3d/token`,
        })
      } catch (e) {
        throw new Error(messageUploadHumanise(e))
      }

      const reponse = await fetch(`/api/dossiers/${dossierId}/modele-3d`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pathname: blob.pathname, originalName: fichier.name, format: extension, sizeBytes: fichier.size }),
      })
      await lireReponseApi(reponse)
      router.refresh()
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue.')
    } finally {
      setEnCoursModele3D(false)
    }
  }

  /**
   * Lot 2 Source Lifecycle (D-23) — multi-upload à concurrence limitée
   * (mission §12) : un échec individuel n'annule jamais les autres fichiers
   * (Promise.allSettled), chaque photo suit son propre cycle jeton → upload
   * → enregistrement métadonnées.
   */
  async function deposerUnAssetTemporaire(fichier: File): Promise<void> {
    if (fichier.size === 0 || fichier.size > TAILLE_TEMPORARY_ASSET_MAX_OCTETS) {
      throw new Error(`« ${fichier.name} » : fichier vide ou dépassant la taille maximale acceptée (20 Mo).`)
    }
    const extension = fichier.name.split('.').pop() ?? 'bin'
    const pathname = `${dossierId}/temporary-assets/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`
    let blob
    try {
      blob = await upload(pathname, fichier, {
        access: 'private',
        contentType: fichier.type,
        handleUploadUrl: `/api/dossiers/${dossierId}/temporary-assets/token`,
      })
    } catch (e) {
      throw new Error(`« ${fichier.name} » : ${messageUploadHumanise(e)}`)
    }
    const reponse = await fetch(`/api/dossiers/${dossierId}/temporary-assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pathname: blob.pathname, originalName: fichier.name, mimeType: fichier.type, sizeBytes: fichier.size }),
    })
    await lireReponseApi(reponse)
  }

  async function deposerAssetsTemporaires(fichiers: FileList) {
    setEnCoursAssets(true)
    setErreur(null)
    const liste = Array.from(fichiers)
    const echecs: string[] = []
    // Lot par lot (CONCURRENCE_MULTI_UPLOAD à la fois) plutôt que tout en
    // parallèle — ne pas saturer navigateur/réseau (mission §12).
    for (let i = 0; i < liste.length; i += CONCURRENCE_MULTI_UPLOAD) {
      const lot = liste.slice(i, i + CONCURRENCE_MULTI_UPLOAD)
      const resultats = await Promise.allSettled(lot.map(deposerUnAssetTemporaire))
      for (const resultat of resultats) {
        if (resultat.status === 'rejected') {
          echecs.push(resultat.reason instanceof Error ? resultat.reason.message : 'Erreur inconnue.')
        }
      }
    }
    if (echecs.length > 0) setErreur(echecs.join(' '))
    router.refresh()
    setEnCoursAssets(false)
  }

  async function basculerHistorique(fileId: string) {
    const dejaOuvert = versions[fileId] !== undefined
    setVersions((prev) => {
      if (!(fileId in prev)) return { ...prev, [fileId]: 'chargement' }
      const copie = { ...prev }
      delete copie[fileId]
      return copie
    })
    if (dejaOuvert) return
    try {
      const reponse = await fetch(`/api/dossiers/${dossierId}/sources/${fileId}/versions`)
      const corps = await lireReponseApi<{ success: true; versions: FichierSourceDetail[] }>(reponse)
      setVersions((prev) => (fileId in prev ? { ...prev, [fileId]: corps.versions } : prev))
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Historique indisponible.')
      setVersions((prev) => {
        const copie = { ...prev }
        delete copie[fileId]
        return copie
      })
    }
  }

  async function supprimerAssetTemporaire(assetId: string) {
    setSuppressionEnCours(assetId)
    setErreur(null)
    try {
      const reponse = await fetch(`/api/dossiers/${dossierId}/temporary-assets/${assetId}`, { method: 'DELETE' })
      await lireReponseApi(reponse)
      router.refresh()
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue.')
    } finally {
      setSuppressionEnCours(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* RIF V2, geometry-first (DECISIONS.md ADR-021) : la source géométrique
          3D fait autorité sur l'architecture — format non figé, pas de fausse
          progression d'extraction tant qu'aucun fournisseur n'est configuré. */}
      <div className="source-choice-grid">
        <SourceCard
          meta={SOURCE_META.model_3d}
          present={Boolean(modele3D)}
          originalName={modele3D?.originalName}
          sizeBytes={modele3D?.sizeBytes}
          extra={
            modele3D
              ? modele3D.extractionStatus === 'UPLOADED'
                ? 'Extraction non disponible (aucun fournisseur configuré).'
                : `Statut : ${modele3D.extractionStatus}`
              : 'Format ouvert — RVT candidat principal, IFC possible.'
          }
          busy={enCoursModele3D}
          onFichier={deposerModele3D}
        >
          {modele3D && <HistoriqueVersions fileId={modele3D.fileId} versions={versions} basculer={basculerHistorique} />}
        </SourceCard>
        {SLOTS.map(({ role, label, obligatoire }) => {
          const deposee = sources.find((s) => (s.role_confirmed ?? s.role_detected) === role)
          const meta = SOURCE_META[role]
          return (
            <SourceCard
              key={role}
              meta={{ ...meta, label: obligatoire ? `${label} *` : label }}
              present={Boolean(deposee)}
              originalName={deposee?.originalName}
              sizeBytes={deposee?.sizeBytes}
              busy={enCours === role}
              accept="image/*"
              onFichier={(fichier) => deposer(role, fichier)}
            >
              {deposee && <HistoriqueVersions fileId={deposee.id} versions={versions} basculer={basculerHistorique} />}
            </SourceCard>
          )
        })}
      </div>

      {aConfirmer.length > 0 && (
        <div className="panel-section">
          <p className="eyebrow" style={{ marginBottom: 8 }}>Rôle à confirmer</p>
          <div className="flex flex-col gap-2">
            {aConfirmer.map((s) => (
              <label key={s.id} className="field">
                <span>Détecté : {s.role_detected}</span>
                <select
                  defaultValue={s.role_detected}
                  disabled={confirmationEnCours === s.id}
                  onChange={(e) => confirmerRole(s.id, e.target.value as RoleSource)}
                >
                  {ROLES_CONFIRMABLES.map(({ role, label }) => (
                    <option key={role} value={role}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      )}
      {directivesAConfirmer.length > 0 && (
        <div className="panel-section">
          <p className="eyebrow" style={{ marginBottom: 8 }}>Directive à confirmer</p>
          <div className="flex flex-col gap-3">
            {directivesAConfirmer.map((d) => {
              const brouillon = brouillonDirective(d)
              return (
                <div key={d.id} className="flex flex-col gap-2">
                  <p className="page-lede" style={{ margin: 0, fontSize: 10 }}>
                    Détecté : {d.action} — {d.target}
                    {d.consigne ? ` (« ${d.consigne} »)` : ''}
                  </p>
                  <div className="field-grid" style={{ gridTemplateColumns: '1fr 1fr auto', alignItems: 'end', gap: 8 }}>
                    <label className="field">
                      <span>Action</span>
                      <select
                        value={brouillon.action}
                        disabled={confirmationEnCours === d.id}
                        onChange={(e) => setBrouillonsDirectives((prev) => ({ ...prev, [d.id]: { ...brouillon, action: e.target.value } }))}
                      >
                        {ACTIONS_DIRECTIVE.map((action) => (
                          <option key={action} value={action}>
                            {action}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Cible</span>
                      <input
                        type="text"
                        value={brouillon.target}
                        disabled={confirmationEnCours === d.id}
                        onChange={(e) => setBrouillonsDirectives((prev) => ({ ...prev, [d.id]: { ...brouillon, target: e.target.value } }))}
                      />
                    </label>
                    <button
                      type="button"
                      disabled={confirmationEnCours === d.id}
                      onClick={() => confirmerDirective(d.id, brouillon.action, brouillon.target)}
                      className="button button--primary button--small"
                    >
                      Confirmer
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Lot 2 Source Lifecycle (D-23), PRD Geometry-First §15 : les photos
          terrain restent visuellement secondaires (Lot 5 §15) — jamais une
          autorité géométrique/environnement, jamais une entrée
          project_state.sources, domaine séparé des quatre cartes ci-dessus. */}
      <div className="panel-section">
        <div className="panel-heading">
          <h2>Photos terrain complémentaires</h2>
          <label className="icon-button" style={{ position: 'relative', overflow: 'hidden' }} aria-label="Ajouter des photos terrain">
            <Icon name="upload" />
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={enCoursAssets}
              style={{ position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none' }}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) deposerAssetsTemporaires(e.target.files)
                e.target.value = ''
              }}
            />
          </label>
        </div>
        <p className="authority-note" style={{ margin: 0 }}>
          Aident à comprendre le site mais ne remplacent pas les sources de référence.
          {enCoursAssets && ' Envoi en cours…'}
        </p>
        {assetsTemporaires.length > 0 && (
          <ul className="flex flex-col gap-1" style={{ marginTop: 8 }}>
            {assetsTemporaires.map((asset) => (
              <li key={asset.id} className="source-mini">
                <span className="source-mini__icon"><Icon name="photo" /></span>
                <span>
                  <strong>{asset.originalName}</strong>
                  <small>{formatBytes(asset.sizeBytes ?? undefined) ?? 'Taille inconnue'}</small>
                </span>
                <button
                  type="button"
                  disabled={suppressionEnCours === asset.id}
                  onClick={() => supprimerAssetTemporaire(asset.id)}
                  className="icon-button"
                  aria-label={`Supprimer ${asset.originalName}`}
                >
                  <Icon name="close" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {erreur && <ErrorState message={erreur} />}
    </div>
  )
}

function SourceCard({
  meta,
  present,
  originalName,
  sizeBytes,
  extra,
  busy,
  accept,
  onFichier,
  children,
}: {
  meta: { label: string; authority: string; icon: IconName }
  present: boolean
  originalName?: string
  sizeBytes?: number
  extra?: string
  busy: boolean
  accept?: string
  onFichier: (fichier: File) => void
  children?: ReactNode
}) {
  return (
    <article className={`source-choice${present ? '' : ' source-choice--empty'}`}>
      <span className="source-choice__icon"><Icon name={meta.icon} /></span>
      <div>
        <h3>{meta.label}</h3>
        <p>
          <strong>{meta.authority}</strong>
          {extra && (
            <>
              <br />
              {extra}
            </>
          )}
        </p>
        <label>
          <Icon name="upload" /> {busy ? 'Envoi…' : present ? 'Remplacer' : 'Choisir un fichier'}
          <input
            type="file"
            accept={accept}
            disabled={busy}
            onChange={(e) => {
              const fichier = e.target.files?.[0]
              if (fichier) onFichier(fichier)
            }}
          />
        </label>
        {present && originalName && (
          <span className="source-choice__file">
            <Icon name="check" /> {originalName}
            {sizeBytes !== undefined ? ` · ${formatBytes(sizeBytes) ?? ''}` : ''}
          </span>
        )}
        {children}
      </div>
    </article>
  )
}

/**
 * Lot 4 §17 — historique sobre d'un rôle principal (GET .../sources/[fileId]/versions).
 * `fileId` accepte n'importe quelle version (active ou remplacée) du rôle :
 * la route résout elle-même le rôle effectif et renvoie tout l'historique.
 */
function HistoriqueVersions({
  fileId,
  versions,
  basculer,
}: {
  fileId: string
  versions: Record<string, FichierSourceDetail[] | 'chargement'>
  basculer: (fileId: string) => void
}) {
  const etat = versions[fileId]
  return (
    <div className="mt-1">
      <button type="button" onClick={() => basculer(fileId)} className="text-encre-douce underline">
        {etat === undefined ? 'Voir l’historique' : 'Masquer l’historique'}
      </button>
      {etat === 'chargement' && <p className="mt-1 text-encre-douce">Chargement…</p>}
      {Array.isArray(etat) && (
        <ul className="mt-1 flex flex-col gap-0.5">
          {etat.map((v) => (
            <li key={v.id}>
              Version {v.version} — {v.sourceStatus === 'active' ? 'actuelle' : 'remplacée'}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
