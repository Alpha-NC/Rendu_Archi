import type {
  ReponseGenerate,
  ReponseGetMateriaux,
  RequeteGenerate,
} from './contrat'

const DELAI_GENERATION_MS = 3000

/**
 * Catalogue de developpement. Toiture, facade et menuiseries reprennent les
 * termes du node « Construction Prompt » du workflow n8n existant, deja
 * calibres. Volets, margelles et plage sont des termes plausibles, a
 * remplacer par le contenu reel de la table `materiaux`.
 */
const CATALOGUE: ReponseGetMateriaux['materiaux'] = {
  toiture: [
    { id: 'mock-toi-1', terme: 'Tuiles canal terre cuite' },
    { id: 'mock-toi-2', terme: 'Tuiles mécaniques rouge' },
    { id: 'mock-toi-3', terme: 'Tuiles mécaniques anthracite' },
    { id: 'mock-toi-4', terme: 'Tuiles plates' },
    { id: 'mock-toi-5', terme: 'Ardoise' },
    { id: 'mock-toi-6', terme: 'Bac acier' },
    { id: 'mock-toi-7', terme: 'Toiture terrasse' },
  ],
  facade: [
    { id: 'mock-fac-1', terme: 'Enduit blanc' },
    { id: 'mock-fac-2', terme: 'Enduit blanc cassé / crème' },
    { id: 'mock-fac-3', terme: 'Enduit gris clair' },
    { id: 'mock-fac-4', terme: 'Enduit ocre / sable' },
    { id: 'mock-fac-5', terme: 'Pierre apparente' },
    { id: 'mock-fac-6', terme: 'Bardage bois naturel' },
    { id: 'mock-fac-7', terme: 'Bardage bois peint' },
  ],
  volets: [
    { id: 'mock-vol-1', terme: 'Volets battants bois peint' },
    { id: 'mock-vol-2', terme: 'Volets roulants aluminium blanc' },
    { id: 'mock-vol-3', terme: 'Volets roulants aluminium anthracite' },
    { id: 'mock-vol-4', terme: 'Volets coulissants bois naturel' },
  ],
  menuiseries: [
    { id: 'mock-men-1', terme: 'Aluminium blanc' },
    { id: 'mock-men-2', terme: 'PVC blanc' },
    { id: 'mock-men-3', terme: 'Bois naturel' },
    { id: 'mock-men-4', terme: 'Bois peint' },
    { id: 'mock-men-5', terme: 'Aluminium gris anthracite' },
    { id: 'mock-men-6', terme: 'Aluminium noir' },
  ],
  margelles: [
    { id: 'mock-mar-1', terme: 'Pierre reconstituée beige' },
    { id: 'mock-mar-2', terme: 'Travertin' },
    { id: 'mock-mar-3', terme: 'Pierre naturelle bouchardée' },
    { id: 'mock-mar-4', terme: 'Béton lissé gris clair' },
  ],
  plage: [
    { id: 'mock-pla-1', terme: 'Dalles en pierre reconstituée' },
    { id: 'mock-pla-2', terme: 'Lames bois exotique' },
    { id: 'mock-pla-3', terme: 'Lames composite gris' },
    { id: 'mock-pla-4', terme: 'Béton désactivé' },
  ],
}

/** Image de test, un rectangle 4:3 gris uni encode en SVG. */
const IMAGE_TEST =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">' +
      '<rect width="800" height="600" fill="#8a8f98"/>' +
      '<text x="400" y="300" font-family="sans-serif" font-size="28" fill="#fff" ' +
      'text-anchor="middle">Rendu de test</text></svg>',
  )

export async function mockGetMateriaux(): Promise<ReponseGetMateriaux> {
  return { materiaux: CATALOGUE }
}

export async function mockGenerate(requete: RequeteGenerate): Promise<ReponseGenerate> {
  await new Promise((resoudre) => setTimeout(resoudre, DELAI_GENERATION_MS))
  return {
    cycle_id: `mock-${Date.now()}`,
    reference: requete.reference,
    image_url: IMAGE_TEST,
    prompt: `[mock] style ${requete.style}, mode ${requete.mode_production}`,
  }
}
