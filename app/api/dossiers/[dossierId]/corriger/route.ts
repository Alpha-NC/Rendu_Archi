import { genererEtAttendre } from '@/lib/fal/client'
import { estCategorieCorrectionValide } from '@/lib/rif/geometrie-3d'
import { executerGenerationOuCorrection } from '@/lib/rif/orchestrateur'
import { construirePromptCorrection } from '@/lib/rif/prompt-technique'
import {
  authentifierRequete,
  obtenirDepot,
  repondreCorpsInvalide,
  repondreDossierIntrouvable,
  repondreOperation,
  verifierProprietaire,
} from '../../_lib/reponse'

/**
 * POST /api/dossiers/[dossierId]/corriger — corrigerRendu (PRD §14.2).
 *
 * Réservée à une correction localisée sur un rendu existant fiable (état
 * À_CORRIGER). Ne modifie jamais la scène entière — voir D-09 : cette
 * opération ne doit jamais se substituer à reprendreDepuisSources.
 *
 * Chantier G (backend-completion) — durcissement : `elementAModifier`/
 * `resultatAttendu` restent des entrées utilisateur légitimes (l'intention
 * de correction), mais le PROMPT TECHNIQUE réel est désormais construit ici
 * par `prompt-technique.ts` — jamais un `promptText` accepté tel quel du
 * client (PRD §9.5). `sourceFileIds` vient du `project_state`, jamais du
 * corps de requête.
 */
export async function POST(request: Request, { params }: { params: Promise<{ dossierId: string }> }) {
  const { dossierId } = await params
  const { user, reponseRefus } = await authentifierRequete()
  if (reponseRefus) return reponseRefus

  const depot = obtenirDepot()
  const dossier = await depot.obtenirDossier(dossierId)
  if (!dossier) return repondreDossierIntrouvable()
  const refusProprietaire = verifierProprietaire(dossier.ownerId, user.id)
  if (refusProprietaire) return refusProprietaire

  let corps: unknown
  try {
    corps = await request.json()
  } catch {
    return repondreCorpsInvalide('Corps de requête JSON attendu.')
  }

  const { elementAModifier, resultatAttendu, categorie } = (corps as Record<string, unknown>) ?? {}
  if (typeof elementAModifier !== 'string' || elementAModifier.trim().length === 0) {
    return repondreCorpsInvalide('Le champ elementAModifier (texte non vide) est requis.')
  }
  if (typeof resultatAttendu !== 'string' || resultatAttendu.trim().length === 0) {
    return repondreCorpsInvalide('Le champ resultatAttendu (texte non vide) est requis.')
  }
  // ADR-021 : une correction n'existe que sous l'une des six catégories qui
  // préservent la géométrie par construction — jamais un changement
  // architectural (volume, toiture, ouverture, implantation), qui exige
  // reprendreDepuisSources (D-09).
  if (typeof categorie !== 'string' || !estCategorieCorrectionValide(categorie)) {
    return repondreCorpsInvalide(
      "Le champ categorie est requis et doit être l'une des six catégories qui préservent la géométrie (MATERIAL, LIGHTING, VEGETATION, LOCAL_ENVIRONMENT, ARTIFACT_REMOVAL, MINOR_PRESENTATION) — un changement architectural n'est jamais une correction, voir reprendreDepuisSources.",
    )
  }

  const resultat = await executerGenerationOuCorrection(depot, genererEtAttendre, {
    dossierId,
    type: 'correction',
    promptText: construirePromptCorrection(dossier.projectState, { elementAModifier, resultatAttendu, categorie }),
    sourceFileIds: dossier.projectState.sources.map((s) => s.id),
    actorId: user.id,
    contexte: { usageAdministratif: dossier.usageAdministratif },
  })

  return repondreOperation(resultat)
}
