'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { RoleSource, SourceDossier } from '@/lib/rif/project-state'

// Reprend la disposition du prototype de référence (docs/rif_chat_prototype.jsx,
// annexe PRD §27) : vue Revit obligatoire, photo et axonométrie facultatives.
const SLOTS: Array<{ role: RoleSource; label: string; obligatoire: boolean }> = [
  { role: 'revit_view', label: 'Vue 3D Revit', obligatoire: true },
  { role: 'site_photo', label: 'Photo du site', obligatoire: false },
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
}: {
  dossierId: string
  sources: SourceDossier[]
}) {
  const router = useRouter()
  const [enCours, setEnCours] = useState<RoleSource | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [confirmationEnCours, setConfirmationEnCours] = useState<string | null>(null)
  const aConfirmer = sources.filter((s) => !s.role_confirmed)

  async function confirmerRole(fileId: string, role: RoleSource) {
    setConfirmationEnCours(fileId)
    setErreur(null)
    try {
      const reponse = await fetch(`/api/dossiers/${dossierId}/sources/${fileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      const corps = await reponse.json()
      if (!reponse.ok || !corps.success) {
        throw new Error(corps.error?.message ?? 'Confirmation du rôle impossible.')
      }
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
      const corpsFormulaire = new FormData()
      corpsFormulaire.set('fichier', fichier)
      corpsFormulaire.set('role', role)
      const reponse = await fetch(`/api/dossiers/${dossierId}/sources`, {
        method: 'POST',
        body: corpsFormulaire,
      })
      const corps = await reponse.json()
      if (!reponse.ok || !corps.success) {
        throw new Error(corps.error?.message ?? 'Dépôt du fichier impossible.')
      }
      router.refresh()
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur inconnue.')
    } finally {
      setEnCours(null)
    }
  }

  return (
    <aside className="flex flex-col gap-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-encre-douce">Sources</p>
      {SLOTS.map(({ role, label, obligatoire }) => {
        const deposee = sources.find((s) => (s.role_confirmed ?? s.role_detected) === role)
        return (
          <div key={role} className="flex flex-col gap-1">
            <label className="text-sm text-encre">
              {label} {obligatoire && <span className="text-red-600">*</span>}
            </label>
            {deposee ? (
              <p className="rounded border border-encre-douce/30 px-3 py-2 text-xs text-encre-douce">Déposée</p>
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
      {erreur && <p className="text-xs text-red-600">{erreur}</p>}
    </aside>
  )
}
