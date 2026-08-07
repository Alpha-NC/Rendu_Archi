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
