'use client'

import { upload } from '@vercel/blob/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ACTIONS_DIRECTIVE, type DirectiveLocalisee, type RoleSource, type SourceDossier } from '@/lib/rif/project-state'
import type { SourceModele3D } from '@/lib/rif/geometrie-3d'
import type { FichierSourceDetail, TemporaryAssetDetail } from '@/lib/rif/sources'
import { lireReponseApi } from '@/lib/rif/reponse-client'
import { TAILLE_SOURCE_MAX_OCTETS } from '@/lib/storage/contraintes-source'
import { TAILLE_MODELE_3D_MAX_OCTETS } from '@/lib/storage/contraintes-modele-3d'
import { TAILLE_TEMPORARY_ASSET_MAX_OCTETS } from '@/lib/storage/contraintes-temporary-assets'

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
const SLOTS: Array<{ role: RoleSource; label: string; obligatoire: boolean }> = [
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
    <aside className="flex flex-col gap-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-encre-douce">Sources</p>

      {/* RIF V2, geometry-first (DECISIONS.md ADR-021) : la source géométrique
          3D fait autorité sur l'architecture — format non figé, pas de fausse
          progression d'extraction tant qu'aucun fournisseur n'est configuré. */}
      <div className="flex flex-col gap-1">
        <label className="text-sm text-encre">Modèle 3D</label>
        {modele3D ? (
          <div className="rounded border border-encre-douce/30 px-3 py-2 text-xs text-encre-douce">
            <p>Déposé — format déclaré : {modele3D.format || 'non précisé'}</p>
            <p className="mt-1">
              {modele3D.extractionStatus === 'UPLOADED'
                ? 'Extraction non disponible (aucun fournisseur configuré).'
                : `Statut : ${modele3D.extractionStatus}`}
            </p>
            {/* Lot 2 Source Lifecycle (D-23) : remplacement versionné, jamais un doublon silencieux — l'ancienne version reste dans l'historique. */}
            <label className="mt-2 block">
              <span className="text-encre-douce">Remplacer :</span>{' '}
              <input
                type="file"
                disabled={enCoursModele3D}
                onChange={(e) => {
                  const fichier = e.target.files?.[0]
                  if (fichier) deposerModele3D(fichier)
                }}
                className="text-xs"
              />
            </label>
            <HistoriqueVersions fileId={modele3D.fileId} versions={versions} basculer={basculerHistorique} />
          </div>
        ) : (
          <>
            <input
              type="file"
              disabled={enCoursModele3D}
              onChange={(e) => {
                const fichier = e.target.files?.[0]
                if (fichier) deposerModele3D(fichier)
              }}
              className="text-xs"
            />
            <p className="text-xs text-encre-douce">Format ouvert — RVT candidat principal, IFC possible.</p>
          </>
        )}
      </div>

      {SLOTS.map(({ role, label, obligatoire }) => {
        const deposee = sources.find((s) => (s.role_confirmed ?? s.role_detected) === role)
        return (
          <div key={role} className="flex flex-col gap-1">
            <label className="text-sm text-encre">
              {label} {obligatoire && <span className="text-red-600">*</span>}
            </label>
            {deposee ? (
              <div className="rounded border border-encre-douce/30 px-3 py-2 text-xs text-encre-douce">
                <p>Déposée</p>
                {/* Lot 2 Source Lifecycle (D-23) : remplacement versionné (jamais un doublon silencieux) — l'ancienne version reste consultable via GET .../sources/[fileId]/versions. */}
                <label className="mt-1 block">
                  <span>Remplacer :</span>{' '}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={enCours === role}
                    onChange={(e) => {
                      const fichier = e.target.files?.[0]
                      if (fichier) deposer(role, fichier)
                    }}
                    className="text-xs"
                  />
                </label>
                <HistoriqueVersions fileId={deposee.id} versions={versions} basculer={basculerHistorique} />
              </div>
            ) : (
              <input
                type="file"
                accept="image/*"
                disabled={enCours === role}
                onChange={(e) => {
                  const fichier = e.target.files?.[0]
                  if (fichier) deposer(role, fichier)
                }}
                className="text-xs"
              />
            )}
          </div>
        )
      })}
      {aConfirmer.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-encre-douce/30 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Rôle à confirmer</p>
          {aConfirmer.map((s) => (
            <div key={s.id} className="flex items-center gap-2 text-xs">
              <span className="text-encre-douce">détecté : {s.role_detected}</span>
              <select
                defaultValue={s.role_detected}
                disabled={confirmationEnCours === s.id}
                onChange={(e) => confirmerRole(s.id, e.target.value as RoleSource)}
                className="rounded border border-encre-douce/30 px-1 py-0.5"
              >
                {ROLES_CONFIRMABLES.map(({ role, label }) => (
                  <option key={role} value={role}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
      {directivesAConfirmer.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-encre-douce/30 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Directive à confirmer</p>
          {directivesAConfirmer.map((d) => {
            const brouillon = brouillonDirective(d)
            return (
              <div key={d.id} className="flex flex-col gap-1 text-xs">
                <span className="text-encre-douce">
                  détecté : {d.action} — {d.target}
                  {d.consigne ? ` (« ${d.consigne} »)` : ''}
                </span>
                <div className="flex items-center gap-1">
                  <select
                    value={brouillon.action}
                    disabled={confirmationEnCours === d.id}
                    onChange={(e) =>
                      setBrouillonsDirectives((prev) => ({ ...prev, [d.id]: { ...brouillon, action: e.target.value } }))
                    }
                    className="rounded border border-encre-douce/30 px-1 py-0.5"
                  >
                    {ACTIONS_DIRECTIVE.map((action) => (
                      <option key={action} value={action}>
                        {action}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={brouillon.target}
                    disabled={confirmationEnCours === d.id}
                    onChange={(e) =>
                      setBrouillonsDirectives((prev) => ({ ...prev, [d.id]: { ...brouillon, target: e.target.value } }))
                    }
                    className="min-w-0 flex-1 rounded border border-encre-douce/30 px-1 py-0.5"
                  />
                  <button
                    type="button"
                    disabled={confirmationEnCours === d.id}
                    onClick={() => confirmerDirective(d.id, brouillon.action, brouillon.target)}
                    className="rounded bg-encre px-2 py-0.5 text-white disabled:opacity-50"
                  >
                    Confirmer
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {/* Lot 2 Source Lifecycle (D-23), PRD Geometry-First §15 : photos
          terrain en volume, jamais une autorité géométrique/environnement,
          jamais une entrée project_state.sources — domaine séparé. */}
      <div className="flex flex-col gap-2 border-t border-encre-douce/30 pt-3">
        <label className="text-sm text-encre">Photos terrain (temporaire)</label>
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={enCoursAssets}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) deposerAssetsTemporaires(e.target.files)
            e.target.value = ''
          }}
          className="text-xs"
        />
        <p className="text-xs text-encre-douce">
          Aide à la compréhension du projet — pas une source faisant autorité. {enCoursAssets && 'Envoi en cours…'}
        </p>
        {assetsTemporaires.length > 0 && (
          <ul className="flex flex-col gap-1">
            {assetsTemporaires.map((asset) => (
              <li key={asset.id} className="flex items-center justify-between rounded border border-encre-douce/30 px-2 py-1 text-xs">
                <span className="truncate">{asset.originalName}</span>
                <button
                  type="button"
                  disabled={suppressionEnCours === asset.id}
                  onClick={() => supprimerAssetTemporaire(asset.id)}
                  className="ml-2 shrink-0 text-red-600 disabled:opacity-50"
                >
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {erreur && <p className="text-xs text-red-600">{erreur}</p>}
    </aside>
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
