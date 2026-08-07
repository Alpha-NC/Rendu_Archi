# Formulaire 7 étapes — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire le formulaire progressif en 7 étapes du générateur de rendus, jusqu'à l'envoi de l'action `generate` au webhook n8n et l'affichage du résultat.

**Architecture:** Toute la logique métier vit dans des modules purs sous `lib/`, sans React ni DOM, développés en TDD avec Vitest. Les composants React ne font qu'afficher et dispatcher : ils interrogent `lib/form/regles.ts` et ne contiennent aucune règle. Un état unique piloté par `useReducer` traverse un contexte, persisté en `sessionStorage` pour les champs et en IndexedDB pour les images. Le seul accès réseau est un webhook n8n unique, derrière un client qui bascule automatiquement sur un adaptateur mocké quand la variable d'environnement est absente.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Tailwind CSS 4, Vitest + jsdom + fake-indexeddb (dev uniquement). Aucune dépendance de production ajoutée.

**Spec de référence :** `docs/superpowers/specs/2026-08-07-formulaire-7-etapes-design.md`

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `vitest.config.ts` | Configuration des tests, environnement jsdom |
| `vitest.setup.ts` | Injection de fake-indexeddb |
| `lib/form/types.ts` | Types du domaine et forme de l'état |
| `lib/form/libelles.ts` | Libellés français affichables pour chaque valeur d'union |
| `lib/form/etat-initial.ts` | État de départ du formulaire |
| `lib/form/regles.ts` | Logique conditionnelle : mode, styles, matériaux, environnement |
| `lib/form/validation.ts` | Franchissabilité des étapes et autorisation d'envoi |
| `lib/form/reducer.ts` | Transitions d'état et normalisation après chaque action |
| `lib/form/payload.ts` | Construction du corps de la requête `generate` |
| `lib/form/persistance.ts` | Sérialisation session et stockage des images |
| `lib/images/redimensionner.ts` | Fichier image vers data URI JPEG 2048 px |
| `lib/n8n/contrat.ts` | Types de requête et de réponse du webhook |
| `lib/n8n/mock.ts` | Adaptateur mocké, catalogue et génération factice |
| `lib/n8n/client.ts` | Appel réseau, bascule automatique vers le mock |
| `components/formulaire/champs/*.tsx` | Champs réutilisables |
| `components/formulaire/etapes/*.tsx` | Les sept étapes |
| `components/formulaire/IndicateurEtapes.tsx` | Fil d'étapes cliquable |
| `components/formulaire/FormulaireRendu.tsx` | Orchestrateur, contexte, envoi |
| `app/page.tsx` | Montage |

Trois ajouts par rapport à la structure de la spec §3, décidés ici :

- `lib/form/libelles.ts` — les libellés affichables sont la face visible du même vocabulaire que `types.ts`. Les disperser dans les composants obligerait à les chercher à six endroits pour corriger un mot.
- `components/formulaire/contexte.ts` — le contexte React et son hook, sortis de `FormulaireRendu.tsx` pour que les composants d'étape n'importent pas l'orchestrateur, ce qui créerait un cycle d'imports.
- `cielChoisiManuellement` dans l'état — la spec §5.8 dit que la pré-sélection du ciel est écrasée « selon le même mécanisme que le style », ce qui suppose un drapeau symétrique de `styleChoisiManuellement`.

---

## Task 1: Mise en place de Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`

- [ ] **Step 1: Installer les dépendances de test**

```bash
npm install -D vitest@^3 jsdom@^25 fake-indexeddb@^6
```

- [ ] **Step 2: Créer la configuration Vitest**

Créer `vitest.config.ts` :

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['lib/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
```

- [ ] **Step 3: Créer le fichier de setup**

Créer `vitest.setup.ts` :

```ts
import 'fake-indexeddb/auto'
```

- [ ] **Step 4: Ajouter les scripts npm**

Dans `package.json`, remplacer le bloc `"scripts"` par :

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest"
  },
```

- [ ] **Step 5: Vérifier que Vitest démarre**

Run: `npm test`
Expected: sortie `No test files found`, code de sortie 1. C'est le comportement normal tant qu'aucun test n'existe.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts vitest.setup.ts
git commit -m "test: mise en place de Vitest avec jsdom et fake-indexeddb"
```

---

## Task 2: Types du domaine

**Files:**
- Create: `lib/form/types.ts`

Aucun test : ce fichier porte le vocabulaire du domaine — des types vérifiés par le compilateur, plus la liste des catégories dont l'union est dérivée.

- [ ] **Step 1: Écrire les types**

Créer `lib/form/types.ts` :

```ts
export type Etape = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type TypeProjet =
  | 'piscine'
  | 'extension'
  | 'restructuration'
  | 'terrasse'
  | 'pool_house'

export type Usage = 'permis_de_construire' | 'presentation_client' | 'les_deux'

export type TypeCadrage = 'perspective' | 'axonometrie'

/**
 * L'union est derivee du tableau, et non l'inverse : une annotation
 * `readonly Categorie[]` verifierait que chaque element est une categorie,
 * jamais que les six y sont. Un tableau incomplet compilerait en silence et
 * `payload.ts` enverrait une cle absente la ou le contrat exige `null`.
 */
export const CATEGORIES = [
  'toiture',
  'facade',
  'volets',
  'menuiseries',
  'margelles',
  'plage',
] as const

export type Categorie = (typeof CATEGORIES)[number]

export type Style =
  | 'photomontage_administratif'
  | 'presentation_client'
  | 'commercial'

export type ModeProduction =
  | 'photomontage_controle'
  | 'presentation_generative'
  | 'retexturation_revit'

export type Ciel =
  | 'reprendre_photo'
  | 'degage'
  | 'legerement_voile'
  | 'neutre_diffus'
  | 'fin_de_journee'
  | 'crepuscule'

export type AspectPelouse = 'telle_quelle' | 'tondue_soignee' | 'fleurie'

export type CleEclairage =
  | 'margelles'
  | 'sousMarin'
  | 'appliquesFacade'
  | 'interieurVisible'

export type Eclairages = Record<CleEclairage, boolean>

export type RoleImage = 'cadrage' | 'complementaire' | 'site'

export type ImageChargee = {
  dataUri: string
  nomOrigine: string
  largeur: number
  hauteur: number
  poidsOctets: number
}

export type ImagesFormulaire = Record<RoleImage, ImageChargee | null>

export type SelectionMateriau =
  | { origine: 'catalogue'; id: string; terme: string }
  | { origine: 'libre'; terme: string }
  | { origine: 'existant' }

export type EtatFormulaire = {
  etape: Etape
  etapeMax: Etape

  reference: string
  typeProjet: TypeProjet | null
  usage: Usage | null

  typeCadrage: TypeCadrage | null
  images: ImagesFormulaire
  elementsAPreserver: string

  materiaux: Record<Categorie, SelectionMateriau | null>

  conserverVegetation: boolean
  aspectPelouse: AspectPelouse
  elementsARetirer: string
  ciel: Ciel
  cielChoisiManuellement: boolean
  eclairages: Eclairages

  style: Style | null
  styleChoisiManuellement: boolean

  precisions: string
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add lib/form/types.ts
git commit -m "feat: types du domaine du formulaire"
```

---

## Task 3: État initial

**Files:**
- Create: `lib/form/etat-initial.ts`

- [ ] **Step 1: Écrire l'état initial**

Créer `lib/form/etat-initial.ts` :

```ts
import type { EtatFormulaire } from './types'

export const etatInitial: EtatFormulaire = {
  etape: 1,
  etapeMax: 1,

  reference: '',
  typeProjet: null,
  usage: null,

  typeCadrage: null,
  images: { cadrage: null, complementaire: null, site: null },
  elementsAPreserver: '',

  materiaux: {
    toiture: null,
    facade: null,
    volets: null,
    menuiseries: null,
    margelles: null,
    plage: null,
  },

  conserverVegetation: true,
  aspectPelouse: 'telle_quelle',
  elementsARetirer: '',
  ciel: 'neutre_diffus',
  cielChoisiManuellement: false,
  eclairages: {
    margelles: false,
    sousMarin: false,
    appliquesFacade: false,
    interieurVisible: false,
  },

  style: null,
  styleChoisiManuellement: false,

  precisions: '',
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add lib/form/etat-initial.ts
git commit -m "feat: etat initial du formulaire"
```

---

## Task 4: Règles — mode de production

Transcription de la matrice `LIB-006 §5` (spec §5.1).

**Files:**
- Create: `lib/form/regles.ts`
- Test: `lib/form/regles.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `lib/form/regles.test.ts` :

```ts
import { describe, expect, it } from 'vitest'
import { modeProduction } from './regles'
import type { ImageChargee, ImagesFormulaire } from './types'

const image: ImageChargee = {
  dataUri: 'data:image/jpeg;base64,AAAA',
  nomOrigine: 'vue.jpg',
  largeur: 2048,
  hauteur: 1536,
  poidsOctets: 1000,
}

function images(partiel: Partial<ImagesFormulaire> = {}): ImagesFormulaire {
  return { cadrage: null, complementaire: null, site: null, ...partiel }
}

describe('modeProduction', () => {
  it('photo du site et perspective donnent un photomontage controle', () => {
    expect(modeProduction(images({ cadrage: image, site: image }), 'perspective')).toBe(
      'photomontage_controle',
    )
  })

  it('photo du site et axonometrie donnent une presentation generative', () => {
    expect(modeProduction(images({ cadrage: image, site: image }), 'axonometrie')).toBe(
      'presentation_generative',
    )
  })

  it('absence de photo du site donne une retexturation Revit', () => {
    expect(modeProduction(images({ cadrage: image }), 'perspective')).toBe(
      'retexturation_revit',
    )
  })

  it('cadrage non encore choisi avec photo ne revendique pas un photomontage', () => {
    expect(modeProduction(images({ site: image }), null)).toBe('presentation_generative')
  })
})
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npm test -- regles`
Expected: FAIL, `Failed to resolve import "./regles"`.

- [ ] **Step 3: Écrire l'implémentation minimale**

Créer `lib/form/regles.ts` :

```ts
import type { ImagesFormulaire, ModeProduction, TypeCadrage } from './types'

/**
 * Matrice de deduction du mode de production.
 * Le mode n'est jamais affiche : il commande uniquement les styles
 * proposables et la clause de prompt construite cote n8n.
 */
export function modeProduction(
  images: ImagesFormulaire,
  typeCadrage: TypeCadrage | null,
): ModeProduction {
  if (!images.site) return 'retexturation_revit'
  if (typeCadrage === 'perspective') return 'photomontage_controle'
  return 'presentation_generative'
}
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npm test -- regles`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/form/regles.ts lib/form/regles.test.ts
git commit -m "feat: deduction du mode de production"
```

---

## Task 5: Règles — styles disponibles et pré-sélection

Spec §5.2 et §5.4.

**Files:**
- Modify: `lib/form/regles.ts`
- Modify: `lib/form/regles.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter à la fin de `lib/form/regles.test.ts` :

```ts
import { stylePreselectionne, stylesDisponibles } from './regles'

describe('stylesDisponibles', () => {
  it('propose les trois styles en photomontage controle', () => {
    expect(stylesDisponibles('photomontage_controle')).toEqual([
      'photomontage_administratif',
      'presentation_client',
      'commercial',
    ])
  })

  it('exclut le photomontage administratif en presentation generative', () => {
    expect(stylesDisponibles('presentation_generative')).toEqual([
      'presentation_client',
      'commercial',
    ])
  })

  it('exclut le photomontage administratif en retexturation Revit', () => {
    expect(stylesDisponibles('retexturation_revit')).toEqual([
      'presentation_client',
      'commercial',
    ])
  })
})

describe('stylePreselectionne', () => {
  it('choisit le photomontage administratif pour un permis de construire', () => {
    expect(stylePreselectionne('photomontage_controle', 'permis_de_construire')).toBe(
      'photomontage_administratif',
    )
  })

  it('choisit le photomontage administratif pour un usage mixte', () => {
    expect(stylePreselectionne('photomontage_controle', 'les_deux')).toBe(
      'photomontage_administratif',
    )
  })

  it('choisit la presentation client pour une reunion client', () => {
    expect(stylePreselectionne('photomontage_controle', 'presentation_client')).toBe(
      'presentation_client',
    )
  })

  it('choisit la presentation client quand le photomontage est indisponible', () => {
    expect(stylePreselectionne('retexturation_revit', 'permis_de_construire')).toBe(
      'presentation_client',
    )
    expect(stylePreselectionne('presentation_generative', 'les_deux')).toBe(
      'presentation_client',
    )
  })

  it('choisit la presentation client quand l usage n est pas encore renseigne', () => {
    expect(stylePreselectionne('photomontage_controle', null)).toBe('presentation_client')
  })

  it('ne preselectionne jamais le style commercial', () => {
    const modes = [
      'photomontage_controle',
      'presentation_generative',
      'retexturation_revit',
    ] as const
    const usages = ['permis_de_construire', 'presentation_client', 'les_deux', null] as const
    for (const mode of modes) {
      for (const usage of usages) {
        expect(stylePreselectionne(mode, usage)).not.toBe('commercial')
      }
    }
  })
})
```

Fusionner les deux lignes `import ... from './regles'` en une seule pour satisfaire ESLint.

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npm test -- regles`
Expected: FAIL, `stylesDisponibles is not a function`.

- [ ] **Step 3: Écrire l'implémentation**

Ajouter à `lib/form/regles.ts`, en complétant l'import de types avec `Style` et `Usage` :

```ts
/**
 * Styles proposables selon le mode.
 * Le photomontage administratif exige une photo du site et une perspective :
 * il est structurellement exclu en retexturation Revit (son objet est
 * l'integration a une photographie, absente de ce mode) et exclu en
 * presentation generative faute d'alignement possible avec une axonometrie.
 */
export function stylesDisponibles(mode: ModeProduction): Style[] {
  if (mode === 'photomontage_controle') {
    return ['photomontage_administratif', 'presentation_client', 'commercial']
  }
  return ['presentation_client', 'commercial']
}

/**
 * Style propose par defaut. Le style commercial est reserve a une demande
 * explicite et n'entre jamais dans cette selection.
 * L'usage mixte suit la regle du plus exigeant en fidelite.
 */
export function stylePreselectionne(mode: ModeProduction, usage: Usage | null): Style {
  const photomontageDisponible = stylesDisponibles(mode).includes(
    'photomontage_administratif',
  )
  if (!photomontageDisponible) return 'presentation_client'
  if (usage === 'permis_de_construire' || usage === 'les_deux') {
    return 'photomontage_administratif'
  }
  return 'presentation_client'
}
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npm test -- regles`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/form/regles.ts lib/form/regles.test.ts
git commit -m "feat: styles disponibles et preselection du style"
```

---

## Task 6: Règles — matériaux

Spec §5.5 et §5.6.

**Files:**
- Modify: `lib/form/regles.ts`
- Modify: `lib/form/regles.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter à `lib/form/regles.test.ts` (et ajouter `champsMateriauxPour` et `conservationExistantProposee` à l'import depuis `./regles`) :

```ts
describe('champsMateriauxPour', () => {
  it('propose margelles et plage pour une piscine', () => {
    expect(champsMateriauxPour('piscine')).toEqual(['margelles', 'plage'])
  })

  it('propose le bati pour une extension', () => {
    expect(champsMateriauxPour('extension')).toEqual([
      'toiture',
      'facade',
      'volets',
      'menuiseries',
    ])
  })

  it('propose le bati pour une restructuration', () => {
    expect(champsMateriauxPour('restructuration')).toEqual([
      'toiture',
      'facade',
      'volets',
      'menuiseries',
    ])
  })

  it('ne propose aucun materiau pour une terrasse', () => {
    expect(champsMateriauxPour('terrasse')).toEqual([])
  })

  it('propose les six categories pour un pool house', () => {
    expect(champsMateriauxPour('pool_house')).toEqual([
      'toiture',
      'facade',
      'volets',
      'menuiseries',
      'margelles',
      'plage',
    ])
  })

  it('ne propose rien tant que le type de projet est inconnu', () => {
    expect(champsMateriauxPour(null)).toEqual([])
  })
})

describe('conservationExistantProposee', () => {
  it('est proposee en extension avec une photo du site', () => {
    expect(conservationExistantProposee('extension', images({ site: image }))).toBe(true)
  })

  it('est proposee en restructuration avec une photo du site', () => {
    expect(conservationExistantProposee('restructuration', images({ site: image }))).toBe(
      true,
    )
  })

  it('n est pas proposee sans photo du site', () => {
    expect(conservationExistantProposee('extension', images())).toBe(false)
  })

  it('n est pas proposee sur un projet neuf', () => {
    expect(conservationExistantProposee('piscine', images({ site: image }))).toBe(false)
    expect(conservationExistantProposee('pool_house', images({ site: image }))).toBe(false)
  })
})
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npm test -- regles`
Expected: FAIL, `champsMateriauxPour is not a function`.

- [ ] **Step 3: Écrire l'implémentation**

Ajouter à `lib/form/regles.ts`, en complétant l'import de types avec `Categorie` et `TypeProjet` :

```ts
const MATERIAUX_BATI: Categorie[] = ['toiture', 'facade', 'volets', 'menuiseries']
const MATERIAUX_PISCINE: Categorie[] = ['margelles', 'plage']

/**
 * Categories de materiaux affichees selon le type de projet.
 * Margelles et plage restent deux ouvrages distincts, jamais fusionnes.
 */
export function champsMateriauxPour(typeProjet: TypeProjet | null): Categorie[] {
  switch (typeProjet) {
    case 'piscine':
      return [...MATERIAUX_PISCINE]
    case 'extension':
    case 'restructuration':
      return [...MATERIAUX_BATI]
    case 'pool_house':
      return [...MATERIAUX_BATI, ...MATERIAUX_PISCINE]
    case 'terrasse':
    default:
      return []
  }
}

/**
 * L'option « conserver l'existant » n'a de sens que lorsque la photographie
 * montre un bati existant que le projet reprend : extension et
 * restructuration. Le materiau est alors repris tel quel, jamais interprete.
 */
export function conservationExistantProposee(
  typeProjet: TypeProjet | null,
  images: ImagesFormulaire,
): boolean {
  if (!images.site) return false
  return typeProjet === 'extension' || typeProjet === 'restructuration'
}
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npm test -- regles`
Expected: PASS, 23 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/form/regles.ts lib/form/regles.test.ts
git commit -m "feat: champs materiaux et conservation de l existant"
```

---

## Task 7: Règles — environnement

Spec §5.8. Ces fonctions n'ont aucun paramètre de mode : l'étape 4 est toujours entièrement affichée.

**Files:**
- Modify: `lib/form/regles.ts`
- Modify: `lib/form/regles.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter à `lib/form/regles.test.ts` (compléter l'import avec `cielProposeParDefaut`, `eclairagesDemandes`, `eclairagesPiscineProposes`) :

```ts
describe('cielProposeParDefaut', () => {
  it('propose de reprendre la lumiere de la photo quand elle existe', () => {
    expect(cielProposeParDefaut(images({ site: image }))).toBe('reprendre_photo')
  })

  it('propose une lumiere neutre sans photo', () => {
    expect(cielProposeParDefaut(images({ cadrage: image }))).toBe('neutre_diffus')
  })
})

describe('eclairagesDemandes', () => {
  it('demande les eclairages en fin de journee', () => {
    expect(eclairagesDemandes('fin_de_journee')).toBe(true)
  })

  it('demande les eclairages au crepuscule', () => {
    expect(eclairagesDemandes('crepuscule')).toBe(true)
  })

  it('ne demande rien pour les autres ambiances', () => {
    for (const ciel of ['reprendre_photo', 'degage', 'legerement_voile', 'neutre_diffus'] as const) {
      expect(eclairagesDemandes(ciel)).toBe(false)
    }
  })
})

describe('eclairagesPiscineProposes', () => {
  it('propose les eclairages de bassin sur les projets avec piscine', () => {
    expect(eclairagesPiscineProposes('piscine')).toBe(true)
    expect(eclairagesPiscineProposes('pool_house')).toBe(true)
  })

  it('ne les propose pas ailleurs', () => {
    expect(eclairagesPiscineProposes('extension')).toBe(false)
    expect(eclairagesPiscineProposes('restructuration')).toBe(false)
    expect(eclairagesPiscineProposes('terrasse')).toBe(false)
    expect(eclairagesPiscineProposes(null)).toBe(false)
  })
})
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npm test -- regles`
Expected: FAIL, `cielProposeParDefaut is not a function`.

- [ ] **Step 3: Écrire l'implémentation**

Ajouter à `lib/form/regles.ts`, en complétant l'import de types avec `Ciel` :

```ts
/**
 * Preselection de l'ambiance lumineuse. La lumiere de la photographie sert
 * de reference quand elle existe, une lumiere neutre a defaut. Ce n'est
 * qu'une valeur de depart : toutes les ambiances restent choisissables.
 */
export function cielProposeParDefaut(images: ImagesFormulaire): Ciel {
  return images.site ? 'reprendre_photo' : 'neutre_diffus'
}

/**
 * Une ambiance de fin de journee ou de crepuscule appelle une question
 * complementaire sur les eclairages : sans elle, le resultat montre une
 * maison eteinte.
 */
export function eclairagesDemandes(ciel: Ciel): boolean {
  return ciel === 'fin_de_journee' || ciel === 'crepuscule'
}

/** Les eclairages de bassin n'ont de sens que sur un projet qui en comporte un. */
export function eclairagesPiscineProposes(typeProjet: TypeProjet | null): boolean {
  return typeProjet === 'piscine' || typeProjet === 'pool_house'
}
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npm test -- regles`
Expected: PASS, 30 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/form/regles.ts lib/form/regles.test.ts
git commit -m "feat: regles d environnement, ciel et eclairages"
```

---

## Task 8: Validation des étapes

Spec §5.10.

**Files:**
- Create: `lib/form/validation.ts`
- Test: `lib/form/validation.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `lib/form/validation.test.ts` :

```ts
import { describe, expect, it } from 'vitest'
import { etapeFranchissable, peutEnvoyer } from './validation'
import { etatInitial } from './etat-initial'
import type { EtatFormulaire, ImageChargee } from './types'

const image: ImageChargee = {
  dataUri: 'data:image/jpeg;base64,AAAA',
  nomOrigine: 'vue.jpg',
  largeur: 2048,
  hauteur: 1536,
  poidsOctets: 1000,
}

function etat(partiel: Partial<EtatFormulaire> = {}): EtatFormulaire {
  return { ...etatInitial, ...partiel }
}

const etatComplet = etat({
  reference: '2026-042',
  typeProjet: 'extension',
  usage: 'permis_de_construire',
  typeCadrage: 'perspective',
  images: { cadrage: image, complementaire: null, site: image },
  style: 'photomontage_administratif',
})

describe('etapeFranchissable — etape 1', () => {
  it('exige une reference et un type de projet', () => {
    expect(etapeFranchissable(etat(), 1)).toBe(false)
    expect(etapeFranchissable(etat({ reference: '2026-042' }), 1)).toBe(false)
    expect(etapeFranchissable(etat({ typeProjet: 'piscine' }), 1)).toBe(false)
    expect(
      etapeFranchissable(etat({ reference: '2026-042', typeProjet: 'piscine' }), 1),
    ).toBe(true)
  })

  it('refuse une reference faite d espaces', () => {
    expect(
      etapeFranchissable(etat({ reference: '   ', typeProjet: 'piscine' }), 1),
    ).toBe(false)
  })
})

describe('etapeFranchissable — etape 2', () => {
  it('exige un type de cadrage et une vue de cadrage', () => {
    const base = { reference: '2026-042', typeProjet: 'piscine' as const }
    expect(etapeFranchissable(etat(base), 2)).toBe(false)
    expect(etapeFranchissable(etat({ ...base, typeCadrage: 'perspective' }), 2)).toBe(false)
    expect(
      etapeFranchissable(
        etat({
          ...base,
          typeCadrage: 'perspective',
          images: { cadrage: image, complementaire: null, site: null },
        }),
        2,
      ),
    ).toBe(true)
  })
})

describe('etapeFranchissable — etapes libres', () => {
  it('laisse passer les etapes 3, 4 et 6 sans condition propre', () => {
    for (const etapeLibre of [3, 4, 6] as const) {
      expect(etapeFranchissable(etatComplet, etapeLibre)).toBe(true)
    }
  })
})

describe('etapeFranchissable — etape 5', () => {
  it('exige un style disponible dans le mode courant', () => {
    expect(etapeFranchissable(etatComplet, 5)).toBe(true)
  })

  it('refuse un style indisponible dans le mode courant', () => {
    const sansPhoto = etat({
      ...etatComplet,
      images: { cadrage: image, complementaire: null, site: null },
    })
    expect(etapeFranchissable(sansPhoto, 5)).toBe(false)
  })

  it('refuse un style non renseigne', () => {
    expect(etapeFranchissable(etat({ ...etatComplet, style: null }), 5)).toBe(false)
  })
})

describe('peutEnvoyer', () => {
  it('autorise l envoi quand toutes les conditions sont reunies', () => {
    expect(peutEnvoyer(etatComplet)).toBe(true)
  })

  it('refuse l envoi sans vue de cadrage', () => {
    const sansCadrage = etat({
      ...etatComplet,
      images: { cadrage: null, complementaire: null, site: image },
    })
    expect(peutEnvoyer(sansCadrage)).toBe(false)
  })

  it('refuse l envoi sans reference', () => {
    expect(peutEnvoyer(etat({ ...etatComplet, reference: '' }))).toBe(false)
  })
})
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npm test -- validation`
Expected: FAIL, `Failed to resolve import "./validation"`.

- [ ] **Step 3: Écrire l'implémentation**

Créer `lib/form/validation.ts` :

```ts
import { modeProduction, stylesDisponibles } from './regles'
import type { Etape, EtatFormulaire } from './types'

/**
 * Conditions pour quitter une etape vers la suivante.
 * Le retour en arriere n'est jamais conditionne.
 * Aucun materiau n'est obligatoire : les etapes 3, 4 et 6 sont toujours
 * franchissables.
 */
export function etapeFranchissable(etat: EtatFormulaire, etape: Etape): boolean {
  switch (etape) {
    case 1:
      return etat.reference.trim().length > 0 && etat.typeProjet !== null
    case 2:
      return etat.typeCadrage !== null && etat.images.cadrage !== null
    case 5: {
      if (etat.style === null) return false
      const mode = modeProduction(etat.images, etat.typeCadrage)
      return stylesDisponibles(mode).includes(etat.style)
    }
    case 3:
    case 4:
    case 6:
      return true
    case 7:
      return peutEnvoyer(etat)
  }
}

/** L'envoi exige que toutes les etapes bloquantes soient satisfaites. */
export function peutEnvoyer(etat: EtatFormulaire): boolean {
  return (
    etapeFranchissable(etat, 1) &&
    etapeFranchissable(etat, 2) &&
    etapeFranchissable(etat, 5)
  )
}
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npm test -- validation`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/form/validation.ts lib/form/validation.test.ts
git commit -m "feat: franchissabilite des etapes et autorisation d envoi"
```

---

## Task 9: Reducer et normalisation

Spec §5.3, §5.4, §5.8. La normalisation s'applique après chaque action et maintient les invariants : style et ciel cohérents, matériaux des catégories retirées effacés.

**Files:**
- Create: `lib/form/reducer.ts`
- Test: `lib/form/reducer.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `lib/form/reducer.test.ts` :

```ts
import { describe, expect, it } from 'vitest'
import { etapeVoisine, reduire } from './reducer'
import { etatInitial } from './etat-initial'
import type { EtatFormulaire, ImageChargee } from './types'

const image: ImageChargee = {
  dataUri: 'data:image/jpeg;base64,AAAA',
  nomOrigine: 'vue.jpg',
  largeur: 2048,
  hauteur: 1536,
  poidsOctets: 1000,
}

function etat(partiel: Partial<EtatFormulaire> = {}): EtatFormulaire {
  return { ...etatInitial, ...partiel }
}

describe('preselection du style', () => {
  it('suit l usage tant que le style n a pas ete choisi a la main', () => {
    let e = reduire(etat(), { type: 'image', role: 'site', valeur: image })
    e = reduire(e, { type: 'typeCadrage', valeur: 'perspective' })
    e = reduire(e, { type: 'usage', valeur: 'permis_de_construire' })
    expect(e.style).toBe('photomontage_administratif')

    e = reduire(e, { type: 'usage', valeur: 'presentation_client' })
    expect(e.style).toBe('presentation_client')
  })

  it('cesse de suivre l usage des qu un style est choisi a la main', () => {
    let e = reduire(etat(), { type: 'image', role: 'site', valeur: image })
    e = reduire(e, { type: 'typeCadrage', valeur: 'perspective' })
    e = reduire(e, { type: 'style', valeur: 'commercial' })
    e = reduire(e, { type: 'usage', valeur: 'permis_de_construire' })
    expect(e.style).toBe('commercial')
  })
})

describe('correction automatique du style', () => {
  it('abandonne le photomontage quand la photo du site est retiree', () => {
    let e = reduire(etat(), { type: 'image', role: 'site', valeur: image })
    e = reduire(e, { type: 'typeCadrage', valeur: 'perspective' })
    e = reduire(e, { type: 'style', valeur: 'photomontage_administratif' })
    expect(e.style).toBe('photomontage_administratif')

    e = reduire(e, { type: 'image', role: 'site', valeur: null })
    expect(e.style).toBe('presentation_client')
  })

  it('abandonne le photomontage au passage en axonometrie', () => {
    let e = reduire(etat(), { type: 'image', role: 'site', valeur: image })
    e = reduire(e, { type: 'typeCadrage', valeur: 'perspective' })
    e = reduire(e, { type: 'style', valeur: 'photomontage_administratif' })

    e = reduire(e, { type: 'typeCadrage', valeur: 'axonometrie' })
    expect(e.style).toBe('presentation_client')
  })
})

describe('preselection du ciel', () => {
  it('bascule sur la lumiere de la photo des qu une photo est fournie', () => {
    expect(etatInitial.ciel).toBe('neutre_diffus')
    const e = reduire(etat(), { type: 'image', role: 'site', valeur: image })
    expect(e.ciel).toBe('reprendre_photo')
  })

  it('respecte un choix manuel', () => {
    let e = reduire(etat(), { type: 'ciel', valeur: 'crepuscule' })
    e = reduire(e, { type: 'image', role: 'site', valeur: image })
    expect(e.ciel).toBe('crepuscule')
  })
})

describe('materiaux', () => {
  it('efface les materiaux des categories retirees par un changement de projet', () => {
    let e = reduire(etat(), { type: 'typeProjet', valeur: 'extension' })
    e = reduire(e, {
      type: 'materiau',
      categorie: 'toiture',
      valeur: { origine: 'catalogue', id: 'a', terme: 'Tuiles plates' },
    })
    expect(e.materiaux.toiture).not.toBeNull()

    e = reduire(e, { type: 'typeProjet', valeur: 'piscine' })
    expect(e.materiaux.toiture).toBeNull()
  })

  it('efface une conservation de l existant devenue impossible', () => {
    let e = reduire(etat(), { type: 'image', role: 'site', valeur: image })
    e = reduire(e, { type: 'typeProjet', valeur: 'extension' })
    e = reduire(e, { type: 'materiau', categorie: 'facade', valeur: { origine: 'existant' } })
    expect(e.materiaux.facade).toEqual({ origine: 'existant' })

    e = reduire(e, { type: 'image', role: 'site', valeur: null })
    expect(e.materiaux.facade).toBeNull()
  })
})

describe('navigation', () => {
  it('memorise la plus haute etape atteinte', () => {
    let e = reduire(etat(), { type: 'allerEtape', etape: 3 })
    expect(e.etapeMax).toBe(3)
    e = reduire(e, { type: 'allerEtape', etape: 2 })
    expect(e.etape).toBe(2)
    expect(e.etapeMax).toBe(3)
  })

  it('borne l etape voisine aux extremites', () => {
    expect(etapeVoisine(1, -1)).toBe(1)
    expect(etapeVoisine(7, 1)).toBe(7)
    expect(etapeVoisine(3, 1)).toBe(4)
    expect(etapeVoisine(3, -1)).toBe(2)
  })

  it('ne perd aucune donnee lors d un retour en arriere', () => {
    let e = reduire(etat(), { type: 'reference', valeur: '2026-042' })
    e = reduire(e, { type: 'allerEtape', etape: 4 })
    e = reduire(e, { type: 'elementsARetirer', valeur: 'abri de jardin' })
    e = reduire(e, { type: 'allerEtape', etape: 1 })
    expect(e.reference).toBe('2026-042')
    expect(e.elementsARetirer).toBe('abri de jardin')
  })
})
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npm test -- reducer`
Expected: FAIL, `Failed to resolve import "./reducer"`.

- [ ] **Step 3: Écrire l'implémentation**

Créer `lib/form/reducer.ts` :

```ts
import {
  champsMateriauxPour,
  cielProposeParDefaut,
  conservationExistantProposee,
  modeProduction,
  stylePreselectionne,
  stylesDisponibles,
} from './regles'
import { CATEGORIES } from './types'
import type {
  AspectPelouse,
  Categorie,
  Ciel,
  CleEclairage,
  Etape,
  EtatFormulaire,
  ImageChargee,
  RoleImage,
  SelectionMateriau,
  Style,
  TypeCadrage,
  TypeProjet,
  Usage,
} from './types'

export type ActionFormulaire =
  | { type: 'reference'; valeur: string }
  | { type: 'typeProjet'; valeur: TypeProjet }
  | { type: 'usage'; valeur: Usage }
  | { type: 'typeCadrage'; valeur: TypeCadrage }
  | { type: 'image'; role: RoleImage; valeur: ImageChargee | null }
  | { type: 'elementsAPreserver'; valeur: string }
  | { type: 'materiau'; categorie: Categorie; valeur: SelectionMateriau | null }
  | { type: 'conserverVegetation'; valeur: boolean }
  | { type: 'aspectPelouse'; valeur: AspectPelouse }
  | { type: 'elementsARetirer'; valeur: string }
  | { type: 'ciel'; valeur: Ciel }
  | { type: 'eclairage'; cle: CleEclairage; valeur: boolean }
  | { type: 'style'; valeur: Style }
  | { type: 'precisions'; valeur: string }
  | { type: 'allerEtape'; etape: Etape }
  | { type: 'restaurer'; etat: EtatFormulaire }

export function reduire(
  etat: EtatFormulaire,
  action: ActionFormulaire,
): EtatFormulaire {
  return normaliser(appliquer(etat, action))
}

/**
 * Etape voisine, bornee a l'intervalle 1..7.
 * `etape + 1` ne compile pas contre une union litterale : l'assertion est
 * isolee ici, une fois, plutot que dispersee dans les composants.
 */
export function etapeVoisine(etape: Etape, pas: 1 | -1): Etape {
  const cible = etape + pas
  if (cible < 1) return 1
  if (cible > 7) return 7
  return cible as Etape
}

function appliquer(
  etat: EtatFormulaire,
  action: ActionFormulaire,
): EtatFormulaire {
  switch (action.type) {
    case 'reference':
      return { ...etat, reference: action.valeur }
    case 'typeProjet':
      return { ...etat, typeProjet: action.valeur }
    case 'usage':
      return { ...etat, usage: action.valeur }
    case 'typeCadrage':
      return { ...etat, typeCadrage: action.valeur }
    case 'image':
      return { ...etat, images: { ...etat.images, [action.role]: action.valeur } }
    case 'elementsAPreserver':
      return { ...etat, elementsAPreserver: action.valeur }
    case 'materiau':
      return {
        ...etat,
        materiaux: { ...etat.materiaux, [action.categorie]: action.valeur },
      }
    case 'conserverVegetation':
      return { ...etat, conserverVegetation: action.valeur }
    case 'aspectPelouse':
      return { ...etat, aspectPelouse: action.valeur }
    case 'elementsARetirer':
      return { ...etat, elementsARetirer: action.valeur }
    case 'ciel':
      return { ...etat, ciel: action.valeur, cielChoisiManuellement: true }
    case 'eclairage':
      return {
        ...etat,
        eclairages: { ...etat.eclairages, [action.cle]: action.valeur },
      }
    case 'style':
      return { ...etat, style: action.valeur, styleChoisiManuellement: true }
    case 'precisions':
      return { ...etat, precisions: action.valeur }
    case 'allerEtape':
      return {
        ...etat,
        etape: action.etape,
        etapeMax: action.etape > etat.etapeMax ? action.etape : etat.etapeMax,
      }
    case 'restaurer':
      return action.etat
  }
}

/**
 * Retablit les invariants apres chaque action :
 * - le style suit la preselection tant qu'il n'a pas ete choisi a la main,
 *   et bascule de force s'il devient indisponible dans le mode courant ;
 * - le ciel suit la preselection tant qu'il n'a pas ete choisi a la main ;
 * - les materiaux des categories qui ne sont plus affichees sont effaces,
 *   ainsi que les conservations de l'existant devenues impossibles.
 */
function normaliser(etat: EtatFormulaire): EtatFormulaire {
  const mode = modeProduction(etat.images, etat.typeCadrage)
  const disponibles = stylesDisponibles(mode)

  let style = etat.style
  if (!etat.styleChoisiManuellement) {
    style = stylePreselectionne(mode, etat.usage)
  } else if (style !== null && !disponibles.includes(style)) {
    style = stylePreselectionne(mode, etat.usage)
  }

  const ciel = etat.cielChoisiManuellement ? etat.ciel : cielProposeParDefaut(etat.images)

  const affichees = champsMateriauxPour(etat.typeProjet)
  const existantPropose = conservationExistantProposee(etat.typeProjet, etat.images)
  const materiaux = { ...etat.materiaux }
  for (const categorie of CATEGORIES) {
    const selection = materiaux[categorie]
    if (selection === null) continue
    if (!affichees.includes(categorie)) {
      materiaux[categorie] = null
      continue
    }
    if (selection.origine === 'existant' && !existantPropose) {
      materiaux[categorie] = null
    }
  }

  return { ...etat, style, ciel, materiaux }
}
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npm test -- reducer`
Expected: PASS, 11 tests.

- [ ] **Step 5: Lancer toute la suite**

Run: `npm test`
Expected: PASS, 51 tests.

- [ ] **Step 6: Commit**

```bash
git add lib/form/reducer.ts lib/form/reducer.test.ts
git commit -m "feat: reducer et normalisation des invariants"
```

---

## Task 10: Contrat du webhook

Spec §8. Types partagés entre le client réseau, le mock et la construction du payload.

**Files:**
- Create: `lib/n8n/contrat.ts`

- [ ] **Step 1: Écrire les types**

Créer `lib/n8n/contrat.ts` :

```ts
import type {
  AspectPelouse,
  Categorie,
  Ciel,
  ModeProduction,
  Style,
  TypeCadrage,
  TypeProjet,
  Usage,
} from '@/lib/form/types'

export type MateriauCatalogue = { id: string; terme: string }

export type RequeteGetMateriaux = { action: 'get_materiaux' }

export type ReponseGetMateriaux = {
  materiaux: Record<Categorie, MateriauCatalogue[]>
}

export type MateriauEnvoye =
  | { origine: 'catalogue'; id: string; terme: string }
  | { origine: 'existant' }

export type MateriauLibre = { categorie: Categorie; terme: string }

export type EclairagesEnvoyes = {
  margelles: boolean
  sous_marin: boolean
  appliques_facade: boolean
  interieur_visible: boolean
}

export type RequeteGenerate = {
  action: 'generate'
  reference: string
  projet: { type: TypeProjet; usage: Usage | null }
  cadrage: { type: TypeCadrage }
  mode_production: ModeProduction
  images: {
    cadrage: string
    complementaire: string | null
    site: string | null
  }
  elements_a_preserver: string
  materiaux: Record<Categorie, MateriauEnvoye | null>
  materiaux_libres: MateriauLibre[]
  environnement: {
    conserver_vegetation: boolean
    aspect_pelouse: AspectPelouse
    elements_a_retirer: string
    ciel: Ciel
    eclairages: EclairagesEnvoyes | null
  }
  style: Style
  precisions: string
}

export type ReponseGenerate = {
  cycle_id: string
  reference: string
  image_url: string
  prompt: string
}

export type ReponseErreur = { erreur: { code: string; message: string } }

export function estErreur(valeur: unknown): valeur is ReponseErreur {
  return typeof valeur === 'object' && valeur !== null && 'erreur' in valeur
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add lib/n8n/contrat.ts
git commit -m "feat: types du contrat webhook n8n"
```

---

## Task 11: Construction du payload

Spec §8.2. Trois conventions de forme à respecter : les six catégories toujours présentes, le discriminant `origine`, `eclairages` à `null` hors ambiance crépusculaire.

**Files:**
- Create: `lib/form/payload.ts`
- Test: `lib/form/payload.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `lib/form/payload.test.ts` :

```ts
import { describe, expect, it } from 'vitest'
import { construirePayloadGenerate } from './payload'
import { etatInitial } from './etat-initial'
import type { EtatFormulaire, ImageChargee } from './types'

function img(nom: string): ImageChargee {
  return {
    dataUri: `data:image/jpeg;base64,${nom}`,
    nomOrigine: `${nom}.jpg`,
    largeur: 2048,
    hauteur: 1536,
    poidsOctets: 1000,
  }
}

const base: EtatFormulaire = {
  ...etatInitial,
  reference: '  2026-042  ',
  typeProjet: 'extension',
  usage: 'permis_de_construire',
  typeCadrage: 'perspective',
  images: { cadrage: img('cadrage'), complementaire: null, site: img('site') },
  elementsAPreserver: 'garde-corps du balcon nord',
  style: 'photomontage_administratif',
  ciel: 'reprendre_photo',
}

describe('construirePayloadGenerate', () => {
  it('produit le corps attendu pour un cas nominal', () => {
    const payload = construirePayloadGenerate(base)
    expect(payload.action).toBe('generate')
    expect(payload.reference).toBe('2026-042')
    expect(payload.projet).toEqual({ type: 'extension', usage: 'permis_de_construire' })
    expect(payload.cadrage).toEqual({ type: 'perspective' })
    expect(payload.mode_production).toBe('photomontage_controle')
    expect(payload.images.cadrage).toBe('data:image/jpeg;base64,cadrage')
    expect(payload.images.site).toBe('data:image/jpeg;base64,site')
    expect(payload.images.complementaire).toBeNull()
    expect(payload.elements_a_preserver).toBe('garde-corps du balcon nord')
  })

  it('presente les six categories, les non applicables a null', () => {
    const payload = construirePayloadGenerate(base)
    expect(Object.keys(payload.materiaux).sort()).toEqual([
      'facade',
      'margelles',
      'menuiseries',
      'plage',
      'toiture',
      'volets',
    ])
    expect(payload.materiaux.margelles).toBeNull()
    expect(payload.materiaux.plage).toBeNull()
  })

  it('transporte le discriminant origine des selections', () => {
    const etat: EtatFormulaire = {
      ...base,
      materiaux: {
        ...base.materiaux,
        toiture: { origine: 'catalogue', id: 'uuid-1', terme: 'Tuiles plates' },
        facade: { origine: 'existant' },
      },
    }
    const payload = construirePayloadGenerate(etat)
    expect(payload.materiaux.toiture).toEqual({
      origine: 'catalogue',
      id: 'uuid-1',
      terme: 'Tuiles plates',
    })
    expect(payload.materiaux.facade).toEqual({ origine: 'existant' })
  })

  it('sort les saisies libres de materiaux vers materiaux_libres', () => {
    const etat: EtatFormulaire = {
      ...base,
      materiaux: {
        ...base.materiaux,
        volets: { origine: 'libre', terme: 'bois peint vert olive' },
      },
    }
    const payload = construirePayloadGenerate(etat)
    expect(payload.materiaux.volets).toBeNull()
    expect(payload.materiaux_libres).toEqual([
      { categorie: 'volets', terme: 'bois peint vert olive' },
    ])
  })

  it('met les eclairages a null hors ambiance crepusculaire', () => {
    const payload = construirePayloadGenerate(base)
    expect(payload.environnement.ciel).toBe('reprendre_photo')
    expect(payload.environnement.eclairages).toBeNull()
  })

  it('transporte les eclairages en fin de journee', () => {
    const etat: EtatFormulaire = {
      ...base,
      ciel: 'fin_de_journee',
      eclairages: {
        margelles: true,
        sousMarin: false,
        appliquesFacade: true,
        interieurVisible: false,
      },
    }
    const payload = construirePayloadGenerate(etat)
    expect(payload.environnement.eclairages).toEqual({
      margelles: true,
      sous_marin: false,
      appliques_facade: true,
      interieur_visible: false,
    })
  })

  it('leve une erreur si l etat n autorise pas l envoi', () => {
    const incomplet: EtatFormulaire = { ...base, images: { ...base.images, cadrage: null } }
    expect(() => construirePayloadGenerate(incomplet)).toThrow()
  })
})
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npm test -- payload`
Expected: FAIL, `Failed to resolve import "./payload"`.

- [ ] **Step 3: Écrire l'implémentation**

Créer `lib/form/payload.ts` :

```ts
import { eclairagesDemandes, modeProduction } from './regles'
import { peutEnvoyer } from './validation'
import { CATEGORIES } from './types'
import type { Categorie, EtatFormulaire } from './types'
import type {
  MateriauEnvoye,
  MateriauLibre,
  RequeteGenerate,
} from '@/lib/n8n/contrat'

/**
 * Construit le corps de la requete `generate`.
 *
 * Trois conventions de forme, pour que le traitement cote n8n soit
 * deterministe :
 * - les six categories sont toujours presentes, a null si sans objet ;
 * - chaque selection porte son discriminant `origine` ;
 * - `eclairages` vaut null quand la question n'a pas ete posee, pour ne pas
 *   confondre « non demande » et « tout eteint ».
 *
 * Les saisies libres ne figurent jamais dans `materiaux` : elles partent
 * dans `materiaux_libres`, que n8n utilise pour creer des lignes a calibrer
 * et jamais pour construire un prompt.
 */
export function construirePayloadGenerate(etat: EtatFormulaire): RequeteGenerate {
  if (!peutEnvoyer(etat)) {
    throw new Error('Le formulaire est incomplet : payload non constructible.')
  }
  // peutEnvoyer garantit ces trois valeurs.
  const cadrage = etat.images.cadrage!
  const typeCadrage = etat.typeCadrage!
  const style = etat.style!
  const typeProjet = etat.typeProjet!

  const materiaux = {} as Record<Categorie, MateriauEnvoye | null>
  const materiauxLibres: MateriauLibre[] = []

  for (const categorie of CATEGORIES) {
    const selection = etat.materiaux[categorie]
    if (selection === null) {
      materiaux[categorie] = null
      continue
    }
    if (selection.origine === 'libre') {
      materiaux[categorie] = null
      materiauxLibres.push({ categorie, terme: selection.terme.trim() })
      continue
    }
    materiaux[categorie] = selection
  }

  return {
    action: 'generate',
    reference: etat.reference.trim(),
    projet: { type: typeProjet, usage: etat.usage },
    cadrage: { type: typeCadrage },
    mode_production: modeProduction(etat.images, typeCadrage),
    images: {
      cadrage: cadrage.dataUri,
      complementaire: etat.images.complementaire?.dataUri ?? null,
      site: etat.images.site?.dataUri ?? null,
    },
    elements_a_preserver: etat.elementsAPreserver.trim(),
    materiaux,
    materiaux_libres: materiauxLibres,
    environnement: {
      conserver_vegetation: etat.conserverVegetation,
      aspect_pelouse: etat.aspectPelouse,
      elements_a_retirer: etat.elementsARetirer.trim(),
      ciel: etat.ciel,
      eclairages: eclairagesDemandes(etat.ciel)
        ? {
            margelles: etat.eclairages.margelles,
            sous_marin: etat.eclairages.sousMarin,
            appliques_facade: etat.eclairages.appliquesFacade,
            interieur_visible: etat.eclairages.interieurVisible,
          }
        : null,
    },
    style,
    precisions: etat.precisions.trim(),
  }
}
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npm test -- payload`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/form/payload.ts lib/form/payload.test.ts
git commit -m "feat: construction du payload generate"
```

---

## Task 12: Redimensionnement des images

Spec §7. Le calcul des dimensions est pur et testé ; la conversion canvas est une enveloppe fine non testée, faute de canvas dans jsdom.

**Files:**
- Create: `lib/images/redimensionner.ts`
- Test: `lib/images/redimensionner.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `lib/images/redimensionner.test.ts` :

```ts
import { describe, expect, it } from 'vitest'
import { LARGEUR_MAX, dimensionsCibles } from './redimensionner'

describe('dimensionsCibles', () => {
  it('plafonne la largeur a 2048 px', () => {
    expect(LARGEUR_MAX).toBe(2048)
    expect(dimensionsCibles(4096, 3072)).toEqual({ largeur: 2048, hauteur: 1536 })
  })

  it('conserve le rapport d aspect', () => {
    const { largeur, hauteur } = dimensionsCibles(3000, 1000)
    expect(largeur / hauteur).toBeCloseTo(3, 5)
  })

  it('ne monte jamais en resolution', () => {
    expect(dimensionsCibles(800, 600)).toEqual({ largeur: 800, hauteur: 600 })
  })

  it('laisse intacte une image exactement a la limite', () => {
    expect(dimensionsCibles(2048, 1536)).toEqual({ largeur: 2048, hauteur: 1536 })
  })

  it('arrondit a l entier', () => {
    const { largeur, hauteur } = dimensionsCibles(4097, 3000)
    expect(Number.isInteger(largeur)).toBe(true)
    expect(Number.isInteger(hauteur)).toBe(true)
  })

  it('plafonne aussi une image en portrait par sa largeur', () => {
    expect(dimensionsCibles(3000, 4000)).toEqual({ largeur: 2048, hauteur: 2731 })
  })
})
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npm test -- redimensionner`
Expected: FAIL, `Failed to resolve import "./redimensionner"`.

- [ ] **Step 3: Écrire l'implémentation**

Créer `lib/images/redimensionner.ts` :

```ts
import type { ImageChargee } from '@/lib/form/types'

export const LARGEUR_MAX = 2048
export const QUALITE_JPEG = 0.92

/**
 * Dimensions de sortie : largeur plafonnee, rapport d'aspect conserve,
 * jamais de montee en resolution. La sortie du moteur etant en 2K,
 * 2048 px de large ne retirent aucune information exploitable.
 */
export function dimensionsCibles(
  largeur: number,
  hauteur: number,
): { largeur: number; hauteur: number } {
  if (largeur <= LARGEUR_MAX) {
    return { largeur: Math.round(largeur), hauteur: Math.round(hauteur) }
  }
  const facteur = LARGEUR_MAX / largeur
  return { largeur: LARGEUR_MAX, hauteur: Math.round(hauteur * facteur) }
}

/**
 * Convertit un fichier choisi par l'utilisateur en data URI JPEG redimensionne.
 * Effectue a la selection du fichier, pas a l'envoi : l'apercu affiche est
 * donc exactement l'image qui partira, et son poids est connu tout de suite.
 */
export async function chargerImage(fichier: File): Promise<ImageChargee> {
  const bitmap = await createImageBitmap(fichier)
  const { largeur, hauteur } = dimensionsCibles(bitmap.width, bitmap.height)

  const canvas = document.createElement('canvas')
  canvas.width = largeur
  canvas.height = hauteur
  const contexte = canvas.getContext('2d')
  if (!contexte) {
    bitmap.close()
    throw new Error("Impossible de preparer l'image : contexte canvas indisponible.")
  }
  contexte.drawImage(bitmap, 0, 0, largeur, hauteur)
  bitmap.close()

  const dataUri = canvas.toDataURL('image/jpeg', QUALITE_JPEG)

  return {
    dataUri,
    nomOrigine: fichier.name,
    largeur,
    hauteur,
    poidsOctets: Math.round((dataUri.length - dataUri.indexOf(',') - 1) * 0.75),
  }
}
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npm test -- redimensionner`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/images/redimensionner.ts lib/images/redimensionner.test.ts
git commit -m "feat: redimensionnement des images a 2048 px"
```

---

## Task 13: Persistance de session

Spec §6. Les champs vont en `sessionStorage`, les images en IndexedDB — trois images redimensionnées dépassent le plafond pratique de `sessionStorage`.

**Files:**
- Create: `lib/form/persistance.ts`
- Test: `lib/form/persistance.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `lib/form/persistance.test.ts` :

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import {
  chargerEtat,
  effacerEtat,
  sauvegarderEtat,
} from './persistance'
import { etatInitial } from './etat-initial'
import type { EtatFormulaire, ImageChargee } from './types'

const image: ImageChargee = {
  dataUri: 'data:image/jpeg;base64,AAAA',
  nomOrigine: 'vue.jpg',
  largeur: 2048,
  hauteur: 1536,
  poidsOctets: 1000,
}

const etat: EtatFormulaire = {
  ...etatInitial,
  etape: 4,
  etapeMax: 5,
  reference: '2026-042',
  typeProjet: 'pool_house',
  usage: 'les_deux',
  typeCadrage: 'perspective',
  images: { cadrage: image, complementaire: null, site: image },
  elementsAPreserver: 'muret en pierre',
  ciel: 'crepuscule',
  cielChoisiManuellement: true,
  style: 'commercial',
  styleChoisiManuellement: true,
}

beforeEach(async () => {
  sessionStorage.clear()
  await effacerEtat()
})

describe('persistance', () => {
  it('restitue un etat complet, images comprises', async () => {
    await sauvegarderEtat(etat)
    const restaure = await chargerEtat()
    expect(restaure).toEqual(etat)
  })

  it('rend null quand rien n a ete sauvegarde', async () => {
    expect(await chargerEtat()).toBeNull()
  })

  it('rend null quand les champs sont illisibles', async () => {
    sessionStorage.setItem('rendu-architectural:formulaire', 'ceci-n-est-pas-du-json')
    expect(await chargerEtat()).toBeNull()
  })

  it('restitue un etat sans image', async () => {
    const sansImage: EtatFormulaire = {
      ...etat,
      images: { cadrage: null, complementaire: null, site: null },
    }
    await sauvegarderEtat(sansImage)
    expect(await chargerEtat()).toEqual(sansImage)
  })
})
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npm test -- persistance`
Expected: FAIL, `Failed to resolve import "./persistance"`.

- [ ] **Step 3: Écrire l'implémentation**

Créer `lib/form/persistance.ts` :

```ts
import type { EtatFormulaire, ImagesFormulaire } from './types'

const CLE_SESSION = 'rendu-architectural:formulaire'
const BASE_IDB = 'rendu-architectural'
const MAGASIN = 'images'
const CLE_IMAGES = 'formulaire'

type EtatSansImages = Omit<EtatFormulaire, 'images'>

/**
 * Les champs tiennent largement dans sessionStorage. Les images non :
 * trois vues redimensionnees pesent environ 4 Mo en base64, au-dessus du
 * plafond pratique de 5 Mo, qui echoue en perdant l'ecriture entiere.
 * D'ou le partage entre les deux stockages.
 */
export async function sauvegarderEtat(etat: EtatFormulaire): Promise<void> {
  const { images, ...champs } = etat
  sessionStorage.setItem(CLE_SESSION, JSON.stringify(champs))
  await ecrireImages(images)
}

export async function chargerEtat(): Promise<EtatFormulaire | null> {
  const brut = sessionStorage.getItem(CLE_SESSION)
  if (!brut) return null

  let champs: EtatSansImages
  try {
    champs = JSON.parse(brut) as EtatSansImages
  } catch {
    return null
  }

  const images = await lireImages()
  return { ...champs, images }
}

export async function effacerEtat(): Promise<void> {
  sessionStorage.removeItem(CLE_SESSION)
  await ecrireImages({ cadrage: null, complementaire: null, site: null })
}

function ouvrirBase(): Promise<IDBDatabase> {
  return new Promise((resoudre, rejeter) => {
    const requete = indexedDB.open(BASE_IDB, 1)
    requete.onupgradeneeded = () => {
      requete.result.createObjectStore(MAGASIN)
    }
    requete.onsuccess = () => resoudre(requete.result)
    requete.onerror = () => rejeter(requete.error)
  })
}

async function ecrireImages(images: ImagesFormulaire): Promise<void> {
  const base = await ouvrirBase()
  await new Promise<void>((resoudre, rejeter) => {
    const transaction = base.transaction(MAGASIN, 'readwrite')
    transaction.objectStore(MAGASIN).put(images, CLE_IMAGES)
    transaction.oncomplete = () => resoudre()
    transaction.onerror = () => rejeter(transaction.error)
  })
  base.close()
}

async function lireImages(): Promise<ImagesFormulaire> {
  const vide: ImagesFormulaire = { cadrage: null, complementaire: null, site: null }
  const base = await ouvrirBase()
  const images = await new Promise<ImagesFormulaire>((resoudre) => {
    const transaction = base.transaction(MAGASIN, 'readonly')
    const requete = transaction.objectStore(MAGASIN).get(CLE_IMAGES)
    requete.onsuccess = () => resoudre((requete.result as ImagesFormulaire) ?? vide)
    requete.onerror = () => resoudre(vide)
  })
  base.close()
  return images
}
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npm test -- persistance`
Expected: PASS, 4 tests.

- [ ] **Step 5: Lancer toute la suite**

Run: `npm test`
Expected: PASS, 68 tests.

- [ ] **Step 6: Commit**

```bash
git add lib/form/persistance.ts lib/form/persistance.test.ts
git commit -m "feat: persistance de session, champs et images"
```

---

## Task 14: Adaptateur mocké

Spec §9. Les termes du catalogue sont repris du node `Construction Prompt` du workflow n8n existant.

**Files:**
- Create: `lib/n8n/mock.ts`

- [ ] **Step 1: Écrire le mock**

Créer `lib/n8n/mock.ts` :

```ts
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
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add lib/n8n/mock.ts
git commit -m "feat: adaptateur mocke du webhook n8n"
```

---

## Task 15: Client réseau

Spec §10. Trois issues jamais confondues : succès, erreur métier, échec réseau.

**Files:**
- Create: `lib/n8n/client.ts`

- [ ] **Step 1: Écrire le client**

Créer `lib/n8n/client.ts` :

```ts
import { mockGenerate, mockGetMateriaux } from './mock'
import { estErreur } from './contrat'
import type {
  ReponseGenerate,
  ReponseGetMateriaux,
  RequeteGenerate,
} from './contrat'

/** Erreur metier renvoyee par n8n : la requete a abouti, le traitement a refuse. */
export class ErreurMetier extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ErreurMetier'
  }
}

/**
 * Echec de transport : coupure, timeout de proxy, statut non-2xx.
 * Distinct d'une erreur metier parce que la generation a pu aboutir cote
 * serveur malgre la coupure — derriere un proxy coupant a 100 s, une
 * generation reussie arrive en 524.
 */
export class ErreurReseau extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ErreurReseau'
  }
}

function urlWebhook(): string | null {
  const url = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL
  return url && url.trim().length > 0 ? url.trim() : null
}

/** Vrai quand aucune URL n'est configuree : le client sert alors le mock. */
export function enModeMock(): boolean {
  return urlWebhook() === null
}

async function appeler<T>(corps: object): Promise<T> {
  const url = urlWebhook()
  if (url === null) {
    throw new ErreurReseau("Aucune URL de webhook n'est configurée.")
  }

  let reponse: Response
  try {
    reponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
    })
  } catch {
    throw new ErreurReseau('La connexion au service a échoué.')
  }

  if (!reponse.ok) {
    throw new ErreurReseau(`Le service a répondu avec le statut ${reponse.status}.`)
  }

  let charge: unknown
  try {
    charge = await reponse.json()
  } catch {
    throw new ErreurReseau('La réponse du service est illisible.')
  }

  if (estErreur(charge)) {
    throw new ErreurMetier(charge.erreur.code, charge.erreur.message)
  }

  return charge as T
}

export async function getMateriaux(): Promise<ReponseGetMateriaux> {
  if (enModeMock()) return mockGetMateriaux()
  return appeler<ReponseGetMateriaux>({ action: 'get_materiaux' })
}

export async function generate(requete: RequeteGenerate): Promise<ReponseGenerate> {
  if (enModeMock()) return mockGenerate(requete)
  return appeler<ReponseGenerate>(requete)
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add lib/n8n/client.ts
git commit -m "feat: client webhook avec bascule automatique vers le mock"
```

---

## Task 16: Libellés affichables

**Files:**
- Create: `lib/form/libelles.ts`

- [ ] **Step 1: Écrire les libellés**

Créer `lib/form/libelles.ts` :

```ts
import type {
  AspectPelouse,
  Categorie,
  Ciel,
  CleEclairage,
  Style,
  TypeCadrage,
  TypeProjet,
  Usage,
} from './types'

export const LIBELLE_TYPE_PROJET: Record<TypeProjet, string> = {
  piscine: 'Piscine',
  extension: 'Extension',
  restructuration: 'Restructuration',
  terrasse: 'Terrasse',
  pool_house: 'Pool house',
}

export const LIBELLE_USAGE: Record<Usage, string> = {
  permis_de_construire: 'Permis de construire',
  presentation_client: 'Présentation client',
  les_deux: 'Les deux',
}

export const LIBELLE_CADRAGE: Record<TypeCadrage, string> = {
  perspective: 'Perspective',
  axonometrie: 'Axonométrie',
}

export const LIBELLE_CATEGORIE: Record<Categorie, string> = {
  toiture: 'Toiture',
  facade: 'Façade',
  volets: 'Volets',
  menuiseries: 'Menuiseries',
  margelles: 'Margelles',
  plage: 'Plage de piscine',
}

export const LIBELLE_CIEL: Record<Ciel, string> = {
  reprendre_photo: 'Reprendre la lumière de la photo',
  degage: 'Dégagé',
  legerement_voile: 'Légèrement voilé',
  neutre_diffus: 'Neutre diffus',
  fin_de_journee: 'Fin de journée, lumière chaude',
  crepuscule: 'Crépuscule',
}

export const ORDRE_CIEL: readonly Ciel[] = [
  'reprendre_photo',
  'degage',
  'legerement_voile',
  'neutre_diffus',
  'fin_de_journee',
  'crepuscule',
]

export const LIBELLE_PELOUSE: Record<AspectPelouse, string> = {
  telle_quelle: 'Telle quelle',
  tondue_soignee: 'Tondue et soignée',
  fleurie: 'Fleurie, type prairie avec marguerites',
}

export const ORDRE_PELOUSE: readonly AspectPelouse[] = [
  'telle_quelle',
  'tondue_soignee',
  'fleurie',
]

export const LIBELLE_ECLAIRAGE: Record<CleEclairage, string> = {
  margelles: 'Éclairage des margelles',
  sousMarin: 'Éclairage sous-marin de la piscine',
  appliquesFacade: 'Appliques de façade',
  interieurVisible: 'Intérieur visible par les baies',
}

export const LIBELLE_STYLE: Record<Style, string> = {
  photomontage_administratif: 'Photomontage administratif',
  presentation_client: 'Présentation client',
  commercial: 'Commercial',
}

export const DESCRIPTION_STYLE: Record<Style, string> = {
  photomontage_administratif:
    "Insertion sur photographie réelle, sans effet. Pour un permis de construire ou une déclaration préalable.",
  presentation_client:
    'Photoréalisme soigné, lumière chaleureuse mais réaliste. Pour une réunion ou un avant-projet.',
  commercial:
    'Registre de la photographie résidentielle professionnelle : lumière travaillée, contraste marqué, matières profondes.',
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add lib/form/libelles.ts
git commit -m "feat: libelles affichables du domaine"
```

---

## Task 17: Champs réutilisables

Aucun test de composant (spec §13). La vérification est visuelle, à la Task 22.

**Files:**
- Create: `components/formulaire/champs/ChampChoixUnique.tsx`
- Create: `components/formulaire/champs/ChampInterrupteur.tsx`
- Create: `components/formulaire/champs/ChampFichierImage.tsx`
- Create: `components/formulaire/champs/ChampMateriau.tsx`

- [ ] **Step 1: Créer le champ de choix unique**

Créer `components/formulaire/champs/ChampChoixUnique.tsx` :

```tsx
'use client'

type Option<T extends string> = {
  valeur: T
  libelle: string
  description?: string
}

type Props<T extends string> = {
  intitule: string
  options: readonly Option<T>[]
  valeur: T | null
  onChange: (valeur: T) => void
  obligatoire?: boolean
}

export function ChampChoixUnique<T extends string>({
  intitule,
  options,
  valeur,
  onChange,
  obligatoire = false,
}: Props<T>) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-slate-800">
        {intitule}
        {obligatoire && <span className="ml-1 text-rose-600">*</span>}
      </legend>
      <div className="grid gap-2">
        {options.map((option) => {
          const selectionne = valeur === option.valeur
          return (
            <label
              key={option.valeur}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                selectionne
                  ? 'border-slate-800 bg-slate-50'
                  : 'border-slate-200 hover:border-slate-400'
              }`}
            >
              <input
                type="radio"
                className="mt-1 accent-slate-800"
                checked={selectionne}
                onChange={() => onChange(option.valeur)}
              />
              <span>
                <span className="block text-sm text-slate-900">{option.libelle}</span>
                {option.description && (
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {option.description}
                  </span>
                )}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
```

- [ ] **Step 2: Créer l'interrupteur**

Créer `components/formulaire/champs/ChampInterrupteur.tsx` :

```tsx
'use client'

type Props = {
  intitule: string
  description?: string
  valeur: boolean
  onChange: (valeur: boolean) => void
}

export function ChampInterrupteur({ intitule, description, valeur, onChange }: Props) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3">
      <input
        type="checkbox"
        className="mt-1 accent-slate-800"
        checked={valeur}
        onChange={(evenement) => onChange(evenement.target.checked)}
      />
      <span>
        <span className="block text-sm text-slate-900">{intitule}</span>
        {description && (
          <span className="mt-0.5 block text-xs text-slate-500">{description}</span>
        )}
      </span>
    </label>
  )
}
```

- [ ] **Step 3: Créer le champ fichier image**

Créer `components/formulaire/champs/ChampFichierImage.tsx` :

```tsx
'use client'

import { useState } from 'react'
import { chargerImage } from '@/lib/images/redimensionner'
import type { ImageChargee } from '@/lib/form/types'

type Props = {
  intitule: string
  description?: string
  valeur: ImageChargee | null
  onChange: (valeur: ImageChargee | null) => void
  obligatoire?: boolean
}

function formaterPoids(octets: number): string {
  const mo = octets / (1024 * 1024)
  return mo >= 1 ? `${mo.toFixed(1)} Mo` : `${Math.round(octets / 1024)} Ko`
}

export function ChampFichierImage({
  intitule,
  description,
  valeur,
  onChange,
  obligatoire = false,
}: Props) {
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function selectionner(fichier: File | undefined) {
    if (!fichier) return
    setEnCours(true)
    setErreur(null)
    try {
      onChange(await chargerImage(fichier))
    } catch {
      setErreur("Ce fichier n'a pas pu être lu. Essayez un JPEG ou un PNG.")
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-slate-800">
        {intitule}
        {obligatoire && <span className="ml-1 text-rose-600">*</span>}
      </div>
      {description && <p className="text-xs text-slate-500">{description}</p>}

      {valeur ? (
        <div className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={valeur.dataUri}
            alt=""
            className="h-20 w-28 rounded object-cover"
          />
          <div className="min-w-0 flex-1 text-xs text-slate-600">
            <p className="truncate text-slate-900">{valeur.nomOrigine}</p>
            <p className="mt-1">
              {valeur.largeur} × {valeur.hauteur} px · {formaterPoids(valeur.poidsOctets)}
            </p>
            <button
              type="button"
              className="mt-2 text-slate-700 underline"
              onClick={() => onChange(null)}
            >
              Retirer
            </button>
          </div>
        </div>
      ) : (
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={enCours}
          onChange={(evenement) => selectionner(evenement.target.files?.[0])}
          className="block w-full cursor-pointer rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600"
        />
      )}

      {enCours && <p className="text-xs text-slate-500">Préparation de l&apos;image…</p>}
      {erreur && <p className="text-xs text-rose-600">{erreur}</p>}
    </div>
  )
}
```

- [ ] **Step 4: Créer le champ matériau**

Créer `components/formulaire/champs/ChampMateriau.tsx` :

```tsx
'use client'

import { useState } from 'react'
import type { MateriauCatalogue } from '@/lib/n8n/contrat'
import type { SelectionMateriau } from '@/lib/form/types'

const VALEUR_LIBRE = '__libre__'
const VALEUR_EXISTANT = '__existant__'
const VALEUR_VIDE = ''

type Props = {
  intitule: string
  catalogue: MateriauCatalogue[]
  valeur: SelectionMateriau | null
  onChange: (valeur: SelectionMateriau | null) => void
  existantPropose: boolean
}

export function ChampMateriau({
  intitule,
  catalogue,
  valeur,
  onChange,
  existantPropose,
}: Props) {
  const [saisieLibre, setSaisieLibre] = useState(
    valeur?.origine === 'libre' ? valeur.terme : '',
  )

  const valeurSelect =
    valeur === null
      ? VALEUR_VIDE
      : valeur.origine === 'libre'
        ? VALEUR_LIBRE
        : valeur.origine === 'existant'
          ? VALEUR_EXISTANT
          : valeur.id

  function choisir(brut: string) {
    if (brut === VALEUR_VIDE) return onChange(null)
    if (brut === VALEUR_EXISTANT) return onChange({ origine: 'existant' })
    if (brut === VALEUR_LIBRE) return onChange({ origine: 'libre', terme: saisieLibre })
    const trouve = catalogue.find((materiau) => materiau.id === brut)
    if (trouve) onChange({ origine: 'catalogue', id: trouve.id, terme: trouve.terme })
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-800">{intitule}</label>
      <select
        value={valeurSelect}
        onChange={(evenement) => choisir(evenement.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-900"
      >
        <option value={VALEUR_VIDE}>Non renseigné</option>
        {existantPropose && (
          <option value={VALEUR_EXISTANT}>Conserver l&apos;existant visible sur la photo</option>
        )}
        {catalogue.map((materiau) => (
          <option key={materiau.id} value={materiau.id}>
            {materiau.terme}
          </option>
        ))}
        <option value={VALEUR_LIBRE}>Autre texture…</option>
      </select>

      {valeur?.origine === 'libre' && (
        <div className="space-y-1">
          <input
            type="text"
            value={saisieLibre}
            placeholder="Décrivez la texture"
            onChange={(evenement) => {
              setSaisieLibre(evenement.target.value)
              onChange({ origine: 'libre', terme: evenement.target.value })
            }}
            className="w-full rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-sm text-slate-900"
          />
          <p className="text-xs text-amber-700">
            Texture non calibrée : elle sera enregistrée pour calibration et n&apos;entrera
            pas dans le rendu.
          </p>
        </div>
      )}

      {valeur?.origine === 'existant' && (
        <p className="text-xs text-slate-500">
          Le matériau sera repris tel qu&apos;il apparaît sur la photo du site.
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 6: Commit**

```bash
git add components/formulaire/champs
git commit -m "feat: champs reutilisables du formulaire"
```

---

## Task 18: Contexte et indicateur d'étapes

**Files:**
- Create: `components/formulaire/contexte.ts`
- Create: `components/formulaire/IndicateurEtapes.tsx`

- [ ] **Step 1: Créer le contexte**

Créer `components/formulaire/contexte.ts` :

```ts
'use client'

import { createContext, useContext } from 'react'
import type { ActionFormulaire } from '@/lib/form/reducer'
import type { Categorie, EtatFormulaire } from '@/lib/form/types'
import type { MateriauCatalogue } from '@/lib/n8n/contrat'

export type ContexteFormulaire = {
  etat: EtatFormulaire
  envoyer: (action: ActionFormulaire) => void
  catalogue: Record<Categorie, MateriauCatalogue[]> | null
  erreurCatalogue: string | null
}

export const ContexteFormulaireReact = createContext<ContexteFormulaire | null>(null)

export function useFormulaire(): ContexteFormulaire {
  const contexte = useContext(ContexteFormulaireReact)
  if (!contexte) {
    throw new Error('useFormulaire doit être utilisé dans FormulaireRendu.')
  }
  return contexte
}
```

- [ ] **Step 2: Créer l'indicateur d'étapes**

Créer `components/formulaire/IndicateurEtapes.tsx` :

```tsx
'use client'

import { useFormulaire } from './contexte'
import type { Etape } from '@/lib/form/types'

const TITRES: Record<Etape, string> = {
  1: 'Identification',
  2: 'Documents',
  3: 'Matériaux',
  4: 'Environnement',
  5: 'Style',
  6: 'Précisions',
  7: 'Fiche projet',
}

const ETAPES: Etape[] = [1, 2, 3, 4, 5, 6, 7]

export function IndicateurEtapes() {
  const { etat, envoyer } = useFormulaire()

  return (
    <nav aria-label="Étapes" className="flex flex-wrap gap-1.5">
      {ETAPES.map((etape) => {
        const atteinte = etape <= etat.etapeMax
        const courante = etape === etat.etape
        return (
          <button
            key={etape}
            type="button"
            disabled={!atteinte}
            onClick={() => envoyer({ type: 'allerEtape', etape })}
            className={`rounded-full px-3 py-1 text-xs transition ${
              courante
                ? 'bg-slate-900 text-white'
                : atteinte
                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  : 'bg-slate-50 text-slate-400'
            }`}
          >
            {etape}. {TITRES[etape]}
          </button>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 3: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add components/formulaire/contexte.ts components/formulaire/IndicateurEtapes.tsx
git commit -m "feat: contexte du formulaire et indicateur d etapes"
```

---

## Task 19: Étapes 1 et 2

**Files:**
- Create: `components/formulaire/etapes/Etape1Identification.tsx`
- Create: `components/formulaire/etapes/Etape2Documents.tsx`

- [ ] **Step 1: Créer l'étape 1**

Créer `components/formulaire/etapes/Etape1Identification.tsx` :

```tsx
'use client'

import { ChampChoixUnique } from '../champs/ChampChoixUnique'
import { useFormulaire } from '../contexte'
import { LIBELLE_TYPE_PROJET, LIBELLE_USAGE } from '@/lib/form/libelles'
import type { TypeProjet, Usage } from '@/lib/form/types'

const TYPES_PROJET = (Object.keys(LIBELLE_TYPE_PROJET) as TypeProjet[]).map((valeur) => ({
  valeur,
  libelle: LIBELLE_TYPE_PROJET[valeur],
}))

const USAGES = (Object.keys(LIBELLE_USAGE) as Usage[]).map((valeur) => ({
  valeur,
  libelle: LIBELLE_USAGE[valeur],
}))

export function Etape1Identification() {
  const { etat, envoyer } = useFormulaire()

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <label htmlFor="reference" className="block text-sm font-medium text-slate-800">
          Référence du dossier <span className="text-rose-600">*</span>
        </label>
        <input
          id="reference"
          type="text"
          value={etat.reference}
          placeholder="Votre numéro d'affaire"
          onChange={(evenement) =>
            envoyer({ type: 'reference', valeur: evenement.target.value })
          }
          className="w-full rounded-lg border border-slate-300 p-2.5 text-sm text-slate-900"
        />
        <p className="text-xs text-slate-500">
          Elle nomme le dossier d&apos;archivage et permet de retrouver l&apos;historique
          des rendus.
        </p>
      </div>

      <ChampChoixUnique
        intitule="Type de projet"
        obligatoire
        options={TYPES_PROJET}
        valeur={etat.typeProjet}
        onChange={(valeur) => envoyer({ type: 'typeProjet', valeur })}
      />

      <ChampChoixUnique
        intitule="Usage du rendu"
        options={USAGES}
        valeur={etat.usage}
        onChange={(valeur) => envoyer({ type: 'usage', valeur })}
      />
    </div>
  )
}
```

- [ ] **Step 2: Créer l'étape 2**

Créer `components/formulaire/etapes/Etape2Documents.tsx` :

```tsx
'use client'

import { ChampChoixUnique } from '../champs/ChampChoixUnique'
import { ChampFichierImage } from '../champs/ChampFichierImage'
import { useFormulaire } from '../contexte'
import { LIBELLE_CADRAGE } from '@/lib/form/libelles'
import type { TypeCadrage } from '@/lib/form/types'

const CADRAGES = (Object.keys(LIBELLE_CADRAGE) as TypeCadrage[]).map((valeur) => ({
  valeur,
  libelle: LIBELLE_CADRAGE[valeur],
}))

export function Etape2Documents() {
  const { etat, envoyer } = useFormulaire()
  const enAxonometrie = etat.typeCadrage === 'axonometrie'

  return (
    <div className="space-y-8">
      <ChampChoixUnique
        intitule="Type de cadrage de la vue principale"
        obligatoire
        options={CADRAGES}
        valeur={etat.typeCadrage}
        onChange={(valeur) => envoyer({ type: 'typeCadrage', valeur })}
      />

      <ChampFichierImage
        intitule="Vue de cadrage"
        obligatoire
        description="Export Revit. C'est la référence géométrique : volumes, ouvertures, toiture et perspective en sont repris à l'identique."
        valeur={etat.images.cadrage}
        onChange={(valeur) => envoyer({ type: 'image', role: 'cadrage', valeur })}
      />

      <ChampFichierImage
        intitule="Vue complémentaire"
        description="L'autre type de vue du même projet, en référence de volume supplémentaire."
        valeur={etat.images.complementaire}
        onChange={(valeur) => envoyer({ type: 'image', role: 'complementaire', valeur })}
      />

      <div className="space-y-2">
        <ChampFichierImage
          intitule="Photo réelle du site"
          description="Terrain, relief, accès, voisinage et végétation existante."
          valeur={etat.images.site}
          onChange={(valeur) => envoyer({ type: 'image', role: 'site', valeur })}
        />
        {enAxonometrie && etat.images.site && (
          <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            Le cadrage étant une axonométrie, aucun alignement n&apos;est possible avec la
            photo. Elle servira de référence d&apos;ambiance et de matériaux, pas
            d&apos;insertion.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label
          htmlFor="elements-a-preserver"
          className="block text-sm font-medium text-slate-800"
        >
          Éléments à préserver absolument
        </label>
        <textarea
          id="elements-a-preserver"
          rows={3}
          value={etat.elementsAPreserver}
          placeholder="Garde-corps du balcon nord, muret en pierre le long de l'accès, escalier extérieur…"
          onChange={(evenement) =>
            envoyer({ type: 'elementsAPreserver', valeur: evenement.target.value })
          }
          className="w-full rounded-lg border border-slate-300 p-2.5 text-sm text-slate-900"
        />
        <p className="text-xs text-slate-500">
          Nommez un par un les éléments secondaires à ne pas perdre. Ceux qui ne sont pas
          nommés risquent d&apos;être réinterprétés, même si la géométrie générale est
          respectée.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add components/formulaire/etapes
git commit -m "feat: etapes 1 et 2, identification et documents"
```

---

## Task 20: Étapes 3 et 4

**Files:**
- Create: `components/formulaire/etapes/Etape3Materiaux.tsx`
- Create: `components/formulaire/etapes/Etape4Environnement.tsx`

- [ ] **Step 1: Créer l'étape 3**

Créer `components/formulaire/etapes/Etape3Materiaux.tsx` :

```tsx
'use client'

import { ChampMateriau } from '../champs/ChampMateriau'
import { useFormulaire } from '../contexte'
import { champsMateriauxPour, conservationExistantProposee } from '@/lib/form/regles'
import { LIBELLE_CATEGORIE } from '@/lib/form/libelles'

export function Etape3Materiaux() {
  const { etat, envoyer, catalogue, erreurCatalogue } = useFormulaire()
  const categories = champsMateriauxPour(etat.typeProjet)
  const existantPropose = conservationExistantProposee(etat.typeProjet, etat.images)

  if (categories.length === 0) {
    return (
      <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
        Aucun matériau à renseigner pour ce type de projet. Vous pouvez passer à
        l&apos;étape suivante.
      </p>
    )
  }

  if (erreurCatalogue) {
    return (
      <div className="space-y-2 rounded-lg bg-rose-50 p-4 text-sm text-rose-700">
        <p>Les matériaux n&apos;ont pas pu être chargés.</p>
        <p className="text-xs">{erreurCatalogue}</p>
      </div>
    )
  }

  if (!catalogue) {
    return <p className="text-sm text-slate-500">Chargement des matériaux…</p>
  }

  return (
    <div className="space-y-6">
      {existantPropose && (
        <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          Ce projet reprend un bâti existant. Pour tout élément déjà visible sur la photo du
          site, choisissez « conserver l&apos;existant » plutôt qu&apos;un matériau du
          catalogue : il sera repris tel quel, sans réinterprétation.
        </p>
      )}

      {categories.map((categorie) => (
        <ChampMateriau
          key={categorie}
          intitule={LIBELLE_CATEGORIE[categorie]}
          catalogue={catalogue[categorie]}
          valeur={etat.materiaux[categorie]}
          existantPropose={existantPropose}
          onChange={(valeur) => envoyer({ type: 'materiau', categorie, valeur })}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Créer l'étape 4**

Créer `components/formulaire/etapes/Etape4Environnement.tsx` :

```tsx
'use client'

import { ChampChoixUnique } from '../champs/ChampChoixUnique'
import { ChampInterrupteur } from '../champs/ChampInterrupteur'
import { useFormulaire } from '../contexte'
import { eclairagesDemandes, eclairagesPiscineProposes } from '@/lib/form/regles'
import {
  LIBELLE_CIEL,
  LIBELLE_ECLAIRAGE,
  LIBELLE_PELOUSE,
  ORDRE_CIEL,
  ORDRE_PELOUSE,
} from '@/lib/form/libelles'
import type { CleEclairage } from '@/lib/form/types'

const OPTIONS_CIEL = ORDRE_CIEL.map((valeur) => ({
  valeur,
  libelle: LIBELLE_CIEL[valeur],
}))

const OPTIONS_PELOUSE = ORDRE_PELOUSE.map((valeur) => ({
  valeur,
  libelle: LIBELLE_PELOUSE[valeur],
}))

const ECLAIRAGES_BATI: CleEclairage[] = ['appliquesFacade', 'interieurVisible']
const ECLAIRAGES_PISCINE: CleEclairage[] = ['margelles', 'sousMarin']

export function Etape4Environnement() {
  const { etat, envoyer } = useFormulaire()

  const cles = eclairagesPiscineProposes(etat.typeProjet)
    ? [...ECLAIRAGES_PISCINE, ...ECLAIRAGES_BATI]
    : ECLAIRAGES_BATI

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <ChampInterrupteur
          intitule="Conserver la végétation existante"
          valeur={etat.conserverVegetation}
          onChange={(valeur) => envoyer({ type: 'conserverVegetation', valeur })}
        />

        <ChampChoixUnique
          intitule="Aspect de la pelouse"
          options={OPTIONS_PELOUSE}
          valeur={etat.aspectPelouse}
          onChange={(valeur) => envoyer({ type: 'aspectPelouse', valeur })}
        />

        <div className="space-y-2">
          <label
            htmlFor="elements-a-retirer"
            className="block text-sm font-medium text-slate-800"
          >
            Éléments à retirer
          </label>
          <input
            id="elements-a-retirer"
            type="text"
            value={etat.elementsARetirer}
            placeholder="Abri de jardin, benne, véhicule stationné…"
            onChange={(evenement) =>
              envoyer({ type: 'elementsARetirer', valeur: evenement.target.value })
            }
            className="w-full rounded-lg border border-slate-300 p-2.5 text-sm text-slate-900"
          />
        </div>
      </div>

      <ChampChoixUnique
        intitule="Ciel et lumière"
        options={OPTIONS_CIEL}
        valeur={etat.ciel}
        onChange={(valeur) => envoyer({ type: 'ciel', valeur })}
      />

      {eclairagesDemandes(etat.ciel) && (
        <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4">
          <legend className="px-1 text-sm font-medium text-slate-800">
            Éclairages à activer
          </legend>
          <p className="text-xs text-slate-500">
            Sans éclairage, une ambiance de fin de journée donne un bâtiment éteint.
          </p>
          {cles.map((cle) => (
            <ChampInterrupteur
              key={cle}
              intitule={LIBELLE_ECLAIRAGE[cle]}
              valeur={etat.eclairages[cle]}
              onChange={(valeur) => envoyer({ type: 'eclairage', cle, valeur })}
            />
          ))}
        </fieldset>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add components/formulaire/etapes
git commit -m "feat: etapes 3 et 4, materiaux et environnement"
```

---

## Task 21: Étapes 5, 6 et 7

**Files:**
- Create: `components/formulaire/etapes/Etape5Style.tsx`
- Create: `components/formulaire/etapes/Etape6Precisions.tsx`
- Create: `components/formulaire/etapes/Etape7FicheProjet.tsx`

- [ ] **Step 1: Créer l'étape 5**

Créer `components/formulaire/etapes/Etape5Style.tsx` :

```tsx
'use client'

import { ChampChoixUnique } from '../champs/ChampChoixUnique'
import { useFormulaire } from '../contexte'
import { modeProduction, stylesDisponibles } from '@/lib/form/regles'
import { DESCRIPTION_STYLE, LIBELLE_STYLE } from '@/lib/form/libelles'

export function Etape5Style() {
  const { etat, envoyer } = useFormulaire()
  const mode = modeProduction(etat.images, etat.typeCadrage)
  const disponibles = stylesDisponibles(mode)

  const options = disponibles.map((valeur) => ({
    valeur,
    libelle: LIBELLE_STYLE[valeur],
    description: DESCRIPTION_STYLE[valeur],
  }))

  const photomontageRetire = !disponibles.includes('photomontage_administratif')

  return (
    <div className="space-y-6">
      {photomontageRetire && (
        <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          {etat.images.site
            ? "Le photomontage administratif n'est pas proposé : il suppose une insertion alignée sur la photo, impossible depuis une vue axonométrique."
            : "Le photomontage administratif n'est pas proposé : il suppose une photo réelle du site, que vous n'avez pas fournie."}
        </p>
      )}

      <ChampChoixUnique
        intitule="Style de rendu"
        obligatoire
        options={options}
        valeur={etat.style}
        onChange={(valeur) => envoyer({ type: 'style', valeur })}
      />

      <p className="text-xs text-slate-500">
        Le style agit sur la lumière et la présentation. Il ne modifie jamais
        l&apos;architecture.
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Créer l'étape 6**

Créer `components/formulaire/etapes/Etape6Precisions.tsx` :

```tsx
'use client'

import { useFormulaire } from '../contexte'
import { CATEGORIES } from '@/lib/form/types'
import { LIBELLE_CATEGORIE } from '@/lib/form/libelles'

export function Etape6Precisions() {
  const { etat, envoyer } = useFormulaire()

  const nonCalibres = CATEGORIES.flatMap((categorie) => {
    const selection = etat.materiaux[categorie]
    return selection?.origine === 'libre'
      ? [{ categorie, terme: selection.terme }]
      : []
  })

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="precisions" className="block text-sm font-medium text-slate-800">
          Précisions complémentaires
        </label>
        <textarea
          id="precisions"
          rows={5}
          value={etat.precisions}
          placeholder="Toute indication utile qui n'entre pas dans les champs précédents."
          onChange={(evenement) =>
            envoyer({ type: 'precisions', valeur: evenement.target.value })
          }
          className="w-full rounded-lg border border-slate-300 p-2.5 text-sm text-slate-900"
        />
      </div>

      {nonCalibres.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">Textures non calibrées</p>
          <ul className="mt-2 space-y-1 text-xs text-amber-800">
            {nonCalibres.map(({ categorie, terme }) => (
              <li key={categorie}>
                {LIBELLE_CATEGORIE[categorie]} : {terme || '(à décrire)'}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-amber-700">
            Elles sont enregistrées pour calibration et n&apos;entreront pas dans ce rendu.
            Décrivez ici l&apos;aspect attendu si c&apos;est important.
          </p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Créer l'étape 7**

Créer `components/formulaire/etapes/Etape7FicheProjet.tsx` :

```tsx
'use client'

import { useFormulaire } from '../contexte'
import {
  champsMateriauxPour,
  eclairagesDemandes,
  eclairagesPiscineProposes,
} from '@/lib/form/regles'
import {
  LIBELLE_CADRAGE,
  LIBELLE_CATEGORIE,
  LIBELLE_CIEL,
  LIBELLE_ECLAIRAGE,
  LIBELLE_PELOUSE,
  LIBELLE_STYLE,
  LIBELLE_TYPE_PROJET,
  LIBELLE_USAGE,
} from '@/lib/form/libelles'
import type { ReactNode } from 'react'
import type { CleEclairage, Etape, SelectionMateriau } from '@/lib/form/types'

function decrireMateriau(selection: SelectionMateriau | null): string {
  if (selection === null) return 'Non renseigné'
  if (selection.origine === 'existant') return "Conserver l'existant"
  if (selection.origine === 'libre') {
    return `${selection.terme || '(à décrire)'} — non calibré`
  }
  return selection.terme
}

function Bloc({
  titre,
  etape,
  children,
}: {
  titre: string
  etape: Etape
  children: ReactNode
}) {
  const { envoyer } = useFormulaire()
  return (
    <section className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-sm font-medium text-slate-800">{titre}</h3>
        <button
          type="button"
          onClick={() => envoyer({ type: 'allerEtape', etape })}
          className="text-xs text-slate-600 underline"
        >
          Modifier
        </button>
      </div>
      <dl className="mt-3 space-y-1.5 text-sm">{children}</dl>
    </section>
  )
}

function Ligne({ cle, valeur }: { cle: string; valeur: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-44 shrink-0 text-slate-500">{cle}</dt>
      <dd className="text-slate-900">{valeur}</dd>
    </div>
  )
}

export function Etape7FicheProjet() {
  const { etat } = useFormulaire()
  const categories = champsMateriauxPour(etat.typeProjet)

  const clesEclairage: CleEclairage[] = eclairagesPiscineProposes(etat.typeProjet)
    ? ['margelles', 'sousMarin', 'appliquesFacade', 'interieurVisible']
    : ['appliquesFacade', 'interieurVisible']

  const eclairagesActifs = eclairagesDemandes(etat.ciel)
    ? clesEclairage.filter((cle) => etat.eclairages[cle]).map((cle) => LIBELLE_ECLAIRAGE[cle])
    : []

  return (
    <div className="space-y-4">
      <Bloc titre="Identification" etape={1}>
        <Ligne cle="Référence" valeur={etat.reference || 'Non renseignée'} />
        <Ligne
          cle="Type de projet"
          valeur={etat.typeProjet ? LIBELLE_TYPE_PROJET[etat.typeProjet] : 'Non renseigné'}
        />
        <Ligne
          cle="Usage du rendu"
          valeur={etat.usage ? LIBELLE_USAGE[etat.usage] : 'Non renseigné'}
        />
      </Bloc>

      <Bloc titre="Documents" etape={2}>
        <Ligne
          cle="Cadrage"
          valeur={etat.typeCadrage ? LIBELLE_CADRAGE[etat.typeCadrage] : 'Non renseigné'}
        />
        <Ligne
          cle="Vue de cadrage"
          valeur={etat.images.cadrage?.nomOrigine ?? 'Manquante'}
        />
        <Ligne
          cle="Vue complémentaire"
          valeur={etat.images.complementaire?.nomOrigine ?? 'Non fournie'}
        />
        <Ligne cle="Photo du site" valeur={etat.images.site?.nomOrigine ?? 'Non fournie'} />
        <Ligne cle="À préserver" valeur={etat.elementsAPreserver || 'Rien de signalé'} />
      </Bloc>

      <Bloc titre="Matériaux" etape={3}>
        {categories.length === 0 ? (
          <Ligne cle="Matériaux" valeur="Sans objet pour ce type de projet" />
        ) : (
          categories.map((categorie) => (
            <Ligne
              key={categorie}
              cle={LIBELLE_CATEGORIE[categorie]}
              valeur={decrireMateriau(etat.materiaux[categorie])}
            />
          ))
        )}
      </Bloc>

      <Bloc titre="Environnement" etape={4}>
        <Ligne
          cle="Végétation existante"
          valeur={etat.conserverVegetation ? 'Conservée' : 'Non conservée'}
        />
        <Ligne cle="Pelouse" valeur={LIBELLE_PELOUSE[etat.aspectPelouse]} />
        <Ligne cle="À retirer" valeur={etat.elementsARetirer || 'Rien'} />
        <Ligne cle="Ciel et lumière" valeur={LIBELLE_CIEL[etat.ciel]} />
        {eclairagesDemandes(etat.ciel) && (
          <Ligne
            cle="Éclairages"
            valeur={eclairagesActifs.length > 0 ? eclairagesActifs.join(', ') : 'Aucun'}
          />
        )}
      </Bloc>

      <Bloc titre="Style" etape={5}>
        <Ligne
          cle="Style de rendu"
          valeur={etat.style ? LIBELLE_STYLE[etat.style] : 'Non renseigné'}
        />
      </Bloc>

      <Bloc titre="Précisions" etape={6}>
        <Ligne cle="Précisions" valeur={etat.precisions || 'Aucune'} />
      </Bloc>
    </div>
  )
}
```

- [ ] **Step 4: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 5: Commit**

```bash
git add components/formulaire/etapes
git commit -m "feat: etapes 5, 6 et 7, style, precisions et fiche projet"
```

---

## Task 22: Orchestrateur et montage

Spec §6 pour la persistance, §10 pour l'envoi et les trois issues.

**Files:**
- Create: `components/formulaire/FormulaireRendu.tsx`
- Modify: `app/page.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Créer l'orchestrateur**

Créer `components/formulaire/FormulaireRendu.tsx` :

```tsx
'use client'

import { useEffect, useReducer, useRef, useState } from 'react'
import { ContexteFormulaireReact } from './contexte'
import { IndicateurEtapes } from './IndicateurEtapes'
import { Etape1Identification } from './etapes/Etape1Identification'
import { Etape2Documents } from './etapes/Etape2Documents'
import { Etape3Materiaux } from './etapes/Etape3Materiaux'
import { Etape4Environnement } from './etapes/Etape4Environnement'
import { Etape5Style } from './etapes/Etape5Style'
import { Etape6Precisions } from './etapes/Etape6Precisions'
import { Etape7FicheProjet } from './etapes/Etape7FicheProjet'
import { etapeVoisine, reduire } from '@/lib/form/reducer'
import { etatInitial } from '@/lib/form/etat-initial'
import { chargerEtat, sauvegarderEtat } from '@/lib/form/persistance'
import { etapeFranchissable, peutEnvoyer } from '@/lib/form/validation'
import { construirePayloadGenerate } from '@/lib/form/payload'
import { ErreurMetier, ErreurReseau, generate, getMateriaux } from '@/lib/n8n/client'
import type { Categorie, Etape } from '@/lib/form/types'
import type { MateriauCatalogue, ReponseGenerate } from '@/lib/n8n/contrat'

const TITRES: Record<Etape, string> = {
  1: 'Identification',
  2: 'Documents',
  3: 'Matériaux',
  4: 'Environnement',
  5: 'Style de rendu',
  6: 'Précisions',
  7: 'Fiche projet',
}

type Envoi =
  | { statut: 'repos' }
  | { statut: 'en_cours'; secondes: number }
  | { statut: 'reussi'; resultat: ReponseGenerate }
  | { statut: 'echec'; message: string; coupure: boolean }

export function FormulaireRendu() {
  const [etat, envoyer] = useReducer(reduire, etatInitial)
  const [restaure, setRestaure] = useState(false)
  const [catalogue, setCatalogue] = useState<Record<Categorie, MateriauCatalogue[]> | null>(
    null,
  )
  const [erreurCatalogue, setErreurCatalogue] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState<Envoi>({ statut: 'repos' })
  const enVol = useRef(false)

  // Restauration au montage, avant toute sauvegarde.
  useEffect(() => {
    let annule = false
    chargerEtat()
      .then((sauvegarde) => {
        if (!annule && sauvegarde) envoyer({ type: 'restaurer', etat: sauvegarde })
      })
      .catch(() => undefined)
      .finally(() => {
        if (!annule) setRestaure(true)
      })
    return () => {
      annule = true
    }
  }, [])

  useEffect(() => {
    if (!restaure) return
    sauvegarderEtat(etat).catch(() => undefined)
  }, [etat, restaure])

  useEffect(() => {
    getMateriaux()
      .then((reponse) => setCatalogue(reponse.materiaux))
      .catch((erreur: unknown) =>
        setErreurCatalogue(
          erreur instanceof Error ? erreur.message : 'Erreur inconnue.',
        ),
      )
  }, [])

  useEffect(() => {
    if (envoi.statut !== 'en_cours') return
    const minuteur = setInterval(() => {
      setEnvoi((courant) =>
        courant.statut === 'en_cours'
          ? { statut: 'en_cours', secondes: courant.secondes + 1 }
          : courant,
      )
    }, 1000)
    return () => clearInterval(minuteur)
  }, [envoi.statut])

  async function lancerGeneration() {
    if (enVol.current || !peutEnvoyer(etat)) return
    enVol.current = true
    setEnvoi({ statut: 'en_cours', secondes: 0 })
    try {
      const resultat = await generate(construirePayloadGenerate(etat))
      setEnvoi({ statut: 'reussi', resultat })
    } catch (erreur: unknown) {
      if (erreur instanceof ErreurMetier) {
        setEnvoi({ statut: 'echec', message: erreur.message, coupure: false })
      } else if (erreur instanceof ErreurReseau) {
        setEnvoi({ statut: 'echec', message: erreur.message, coupure: true })
      } else {
        setEnvoi({
          statut: 'echec',
          message: erreur instanceof Error ? erreur.message : 'Erreur inconnue.',
          coupure: false,
        })
      }
    } finally {
      enVol.current = false
    }
  }

  if (!restaure) {
    return <p className="p-8 text-sm text-slate-500">Chargement…</p>
  }

  if (envoi.statut === 'reussi') {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-6">
        <h1 className="text-lg font-medium text-slate-900">
          Rendu généré — {envoi.resultat.reference}
        </h1>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={envoi.resultat.image_url}
          alt="Rendu généré"
          className="w-full rounded-lg border border-slate-200"
        />
        <p className="text-xs text-slate-500">Cycle {envoi.resultat.cycle_id}</p>
      </main>
    )
  }

  const franchissable = etapeFranchissable(etat, etat.etape)
  const derniere = etat.etape === 7

  return (
    <ContexteFormulaireReact.Provider
      value={{ etat, envoyer, catalogue, erreurCatalogue }}
    >
      <main className="mx-auto max-w-3xl space-y-6 p-6">
        <header className="space-y-4">
          <h1 className="text-lg font-medium text-slate-900">Générateur de rendu</h1>
          <IndicateurEtapes />
          <h2 className="text-base text-slate-700">
            {etat.etape}. {TITRES[etat.etape]}
          </h2>
        </header>

        {etat.etape === 1 && <Etape1Identification />}
        {etat.etape === 2 && <Etape2Documents />}
        {etat.etape === 3 && <Etape3Materiaux />}
        {etat.etape === 4 && <Etape4Environnement />}
        {etat.etape === 5 && <Etape5Style />}
        {etat.etape === 6 && <Etape6Precisions />}
        {etat.etape === 7 && <Etape7FicheProjet />}

        {envoi.statut === 'en_cours' && (
          <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
            <p>Génération en cours — {envoi.secondes} s</p>
            {envoi.secondes > 60 && (
              <p className="mt-1 text-xs text-slate-500">
                Une génération prend généralement une à deux minutes. Ne fermez pas cette
                page.
              </p>
            )}
          </div>
        )}

        {envoi.statut === 'echec' && (
          <div className="space-y-1 rounded-lg bg-rose-50 p-4 text-sm text-rose-800">
            <p>{envoi.message}</p>
            {envoi.coupure && (
              <p className="text-xs">
                La génération a peut-être abouti côté serveur malgré cette coupure. Vos
                saisies sont conservées.
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-200 pt-4">
          <button
            type="button"
            disabled={etat.etape === 1}
            onClick={() =>
              envoyer({ type: 'allerEtape', etape: etapeVoisine(etat.etape, -1) })
            }
            className="rounded-lg px-4 py-2 text-sm text-slate-600 disabled:text-slate-300"
          >
            Retour
          </button>

          {derniere ? (
            <button
              type="button"
              disabled={!peutEnvoyer(etat) || envoi.statut === 'en_cours'}
              onClick={lancerGeneration}
              className="rounded-lg bg-slate-900 px-5 py-2 text-sm text-white disabled:bg-slate-300"
            >
              {envoi.statut === 'en_cours' ? 'Génération…' : 'Lancer la génération'}
            </button>
          ) : (
            <button
              type="button"
              disabled={!franchissable}
              onClick={() =>
                envoyer({ type: 'allerEtape', etape: etapeVoisine(etat.etape, 1) })
              }
              className="rounded-lg bg-slate-900 px-5 py-2 text-sm text-white disabled:bg-slate-300"
            >
              Continuer
            </button>
          )}
        </div>
      </main>
    </ContexteFormulaireReact.Provider>
  )
}
```

- [ ] **Step 2: Monter le formulaire**

Remplacer tout le contenu de `app/page.tsx` par :

```tsx
import { FormulaireRendu } from '@/components/formulaire/FormulaireRendu'

export default function Page() {
  return <FormulaireRendu />
}
```

- [ ] **Step 3: Corriger la langue et le titre**

Dans `app/layout.tsx`, remplacer le bloc `metadata` et l'attribut `lang` :

```tsx
export const metadata: Metadata = {
  title: 'Générateur de rendu',
  description: 'Production de rendus architecturaux à partir d\'exports Revit.',
}
```

et remplacer `lang="en"` par `lang="fr"`.

- [ ] **Step 4: Vérifier la compilation et le lint**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

Run: `npm run lint`
Expected: aucune erreur.

- [ ] **Step 5: Vérifier le build**

Run: `npm run build`
Expected: build réussi.

- [ ] **Step 6: Vérification manuelle du parcours**

Run: `npm run dev`

Ouvrir `http://localhost:3000` et vérifier :

1. Le bouton Continuer reste inactif tant que la référence ou le type de projet manquent.
2. Choisir Terrasse : l'étape 3 affiche « aucun matériau à renseigner ».
3. Choisir Extension avec une photo du site : l'option « conserver l'existant » apparaît dans chaque liste.
4. Choisir Piscine : seuls Margelles et Plage de piscine sont proposés, et ce sont deux champs distincts.
5. Sélectionner « Autre texture… » : le champ libre apparaît avec la mention non calibré, et le récapitulatif de l'étape 6 le reprend.
6. À l'étape 4, choisir Crépuscule : les interrupteurs d'éclairage apparaissent. Les deux éclairages de bassin ne sont là que pour Piscine et Pool house.
7. Fournir une photo du site et une perspective : le photomontage administratif est proposé à l'étape 5. Retirer la photo : il disparaît et le style bascule sur Présentation client, avec l'explication affichée.
8. Recharger la page en cours de saisie : toutes les valeurs et les images sont restaurées, à l'étape où l'on était.
9. À l'étape 7, lancer la génération : le compteur tourne trois secondes, puis l'image de test s'affiche.

- [ ] **Step 7: Commit**

```bash
git add components/formulaire/FormulaireRendu.tsx app/page.tsx app/layout.tsx
git commit -m "feat: orchestrateur du formulaire et montage de la page"
```

---

## Task 23: Documentation du contrat et variables d'environnement

Spec §14.

**Files:**
- Create: `.env.example`
- Create: `docs/contrat-webhook-n8n.md`

- [ ] **Step 1: Créer le fichier d'exemple d'environnement**

Créer `.env.example` :

```bash
# URL du webhook n8n unique. Laisser vide pour développer sur l'adaptateur mocké.
NEXT_PUBLIC_N8N_WEBHOOK_URL=
```

- [ ] **Step 2: Écrire le contrat**

Créer `docs/contrat-webhook-n8n.md` :

````markdown
# Contrat du webhook n8n

Un seul endpoint, appelé en POST avec un corps JSON contenant toujours un champ
`action`, routé côté n8n par un node Switch. Le front ne connaît qu'une URL,
fournie par `NEXT_PUBLIC_N8N_WEBHOOK_URL`.

Deux actions sont implémentées côté front. Les quatre autres sont spécifiées
pour mémoire et hors du lot en cours.

| Action | État |
|---|---|
| `get_materiaux` | dans le lot |
| `generate` | dans le lot |
| `correct` | hors lot |
| `regenerate` | hors lot |
| `validate` | hors lot |
| `get_dossier` | hors lot |

## Règles générales

- Réponse en JSON, statut 2xx pour un succès comme pour une erreur métier.
- Une erreur métier prend la forme `{ "erreur": { "code": "...", "message": "..." } }`.
  Le message est affiché tel quel à l'utilisateur : il doit être en français et
  compréhensible sans contexte technique.
- Les images circulent en data URI base64. Le front les redimensionne à 2048 px
  de large et les réencode en JPEG avant envoi : n8n les transmet à fal.ai sans
  conversion.
- Le polling fal.ai est entièrement géré côté n8n. Le front envoie une requête et
  attend une réponse finale unique.

## `get_materiaux`

Requête :

```json
{ "action": "get_materiaux" }
```

Réponse :

```json
{
  "materiaux": {
    "toiture":     [{ "id": "uuid", "terme": "Tuiles canal terre cuite" }],
    "facade":      [],
    "volets":      [],
    "menuiseries": [],
    "margelles":   [],
    "plage":       []
  }
}
```

Les six clés sont toujours présentes, même vides. Seules les lignes de statut
`valide` sont retournées. `fragment_prompt` n'est jamais exposé : il ne sert
qu'à la construction du prompt côté n8n.

## `generate`

Requête :

```json
{
  "action": "generate",
  "reference": "2026-042",
  "projet": { "type": "extension", "usage": "permis_de_construire" },
  "cadrage": { "type": "perspective" },
  "mode_production": "photomontage_controle",
  "images": {
    "cadrage": "data:image/jpeg;base64,...",
    "complementaire": null,
    "site": "data:image/jpeg;base64,..."
  },
  "elements_a_preserver": "garde-corps du balcon nord",
  "materiaux": {
    "toiture": { "origine": "catalogue", "id": "uuid", "terme": "Tuiles plates" },
    "facade": { "origine": "existant" },
    "volets": null,
    "menuiseries": null,
    "margelles": null,
    "plage": null
  },
  "materiaux_libres": [{ "categorie": "volets", "terme": "bois peint vert olive" }],
  "environnement": {
    "conserver_vegetation": true,
    "aspect_pelouse": "tondue_soignee",
    "elements_a_retirer": "",
    "ciel": "fin_de_journee",
    "eclairages": {
      "margelles": true,
      "sous_marin": false,
      "appliques_facade": true,
      "interieur_visible": false
    }
  },
  "style": "photomontage_administratif",
  "precisions": ""
}
```

Réponse :

```json
{
  "cycle_id": "uuid",
  "reference": "2026-042",
  "image_url": "https://...",
  "prompt": "..."
}
```

### Ce que n8n doit faire de chaque champ

| Champ | Traitement |
|---|---|
| `mode_production` | Détermine la clause de mode ajoutée au prompt. Trois valeurs : `photomontage_controle`, `presentation_generative`, `retexturation_revit` |
| `materiaux[c].origine = "catalogue"` | Insérer le `fragment_prompt` de la ligne `materiaux` correspondante |
| `materiaux[c].origine = "existant"` | N'insérer aucun fragment de matériau. Insérer une instruction de conservation de l'aspect visible sur la photographie, sans réinterprétation |
| `materiaux[c] = null` | Ne rien insérer pour cette catégorie |
| `materiaux_libres` | Créer une ligne `materiaux` par entrée, `statut = 'a_calibrer'`, `dossier_origine = reference`. **Ne jamais utiliser pour construire le prompt** |
| `elements_a_preserver` | Section dédiée du prompt, distincte des précisions. Reprendre les éléments nommés un par un |
| `environnement.ciel = "reprendre_photo"` | Suivre la lumière de la photographie |
| `environnement.eclairages = null` | La question n'a pas été posée. À distinguer d'un objet dont tous les champs sont `false`, qui signifie « tout éteint » explicitement |
| `style` | Sélectionner le bloc de style correspondant. Trois valeurs : `photomontage_administratif`, `presentation_client`, `commercial` |

### Valeurs à calibrer

Le workflow V1 ne couvre pas ces valeurs. Chacune demande un fragment de prompt.

- `ciel` : six valeurs — `reprendre_photo`, `degage`, `legerement_voile`,
  `neutre_diffus`, `fin_de_journee`, `crepuscule`
- `aspect_pelouse` : trois valeurs — `telle_quelle`, `tondue_soignee`, `fleurie`.
  La variation naturelle de couleur doit y être bornée, faute de quoi le résultat
  prend un aspect irrégulier et maladif
- `eclairages` : quatre interrupteurs
- Catégories `volets`, `margelles`, `plage` : aucun terme n'existe aujourd'hui

### Écriture en base

Une ligne `dossiers` est écrite à chaque cycle, immédiatement après réception de
l'image — pas à la validation. Les cycles non validés restent tracés.
`prompt` contient le texte envoyé, `payload` l'intégralité du corps transmis à
fal.ai.

## Actions hors lot

| Action | Rôle |
|---|---|
| `correct` | Correction ciblée sur un rendu existant, avec zone annotée et note |
| `regenerate` | Relance complète depuis les mêmes données, seed différent |
| `validate` | Passe la ligne du cycle concerné à `statut = 'valide'` |
| `get_dossier` | Historique des cycles d'une référence |
````

- [ ] **Step 3: Commit**

```bash
git add .env.example docs/contrat-webhook-n8n.md
git commit -m "docs: contrat du webhook n8n et exemple d environnement"
```

---

## Task 24: Vérification finale

- [ ] **Step 1: Lancer toute la suite de tests**

Run: `npm test`
Expected: PASS, 68 tests, aucun échec.

- [ ] **Step 2: Vérifier le lint et les types**

Run: `npm run lint`
Expected: aucune erreur.

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Vérifier le build de production**

Run: `npm run build`
Expected: build réussi.

- [ ] **Step 4: Vérifier l'absence de secret**

Run: `git grep -nE "fal\.(run|ai)|Key [0-9a-f]{8}-|SUPABASE|apikey" -- . ':!docs'`
Expected: aucun résultat. Aucune clé d'API ne doit exister dans le code.

- [ ] **Step 5: Commit final si nécessaire**

```bash
git status
```

Si des fichiers restent non commités, les examiner avant de les ajouter.
