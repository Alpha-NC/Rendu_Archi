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
