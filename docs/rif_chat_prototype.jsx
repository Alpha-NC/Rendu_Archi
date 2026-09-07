// ===========================================================================
// ARCHIVE — annexe du PRD (§27), prototype de référence UX/interaction.
// Archivé le 07.09.2026, encodage réparé, contenu inchangé sinon.
//
// Ce fichier N'EST PAS du code à brancher tel quel dans RIF-App. Il documente
// le pattern d'interaction attendu (sidebar de sources + chat + bulles
// tool_call/tool_result), pas l'implémentation cible. Écarts connus avec
// l'architecture retenue (DECISIONS.md) à ne PAS reproduire :
//
//   - `callClaude` appelle https://api.anthropic.com directement depuis le
//     navigateur, sans clé server-side : contraire à D-03/D-05 (LLM et
//     fal.ai appelés uniquement depuis le backend applicatif, jamais du
//     client). Voir lib/rif/appel-outil.ts pour la garde d'appel d'outil
//     réelle et lib/fal/client.ts pour le client fal.ai serveur.
//   - `stubToolResult` simule l'exécution des outils sans jamais appeler
//     fal.ai ni revérifier de précondition — le vrai backend doit refuser
//     l'opération si l'état du dossier ne le permet pas (PRD §11, §14).
//   - Le modèle utilisé ici (`claude-sonnet-4-6`) est antérieur à la
//     décision D-06 (Claude Sonnet 5, `claude-sonnet-5`).
//   - Les schémas d'outils (TOOLS) sont une reconstruction approximative de
//     l'ancien schéma OpenAPI de l'Action ChatGPT V1, pas les contrats
//     définitifs `genererRenduFlux`/`corrigerRenduFlux` du PRD §14 (noms de
//     champs différents, pas de `reprendreDepuisSources`).
//   - Le SYSTEM_PROMPT reproduit les Instructions GPT RIF (V1) avec deux
//     patches ENG-004/ADR-013 à titre de test — il ne remplace pas le prompt
//     système propre à RIF-App, qui doit venir du package d'implémentation
//     versionné (Framework/02_MOTEUR/) et non être écrit en dur ici.
//
// Ce qui reste une référence valable : la disposition (sources à gauche,
// conversation à droite), le principe d'une bulle dédiée par tool_call et
// par tool_result (transparence de ce qui se passe, cohérent avec le
// principe « ne jamais deviner » du PRD), et le dépôt groupé des sources
// avant la conversation.
// ===========================================================================

import React, { useState, useRef, useEffect } from "react";
import { Send, Image as ImageIcon, Wrench, CheckCircle2, X } from "lucide-react";

// ---------------------------------------------------------------------------
// Prompt système RIF — texte réel des Instructions GPT RIF (partagé par Alpha),
// patché avec deux corrections identifiées lors de l'audit :
//   1. Déclencheur ENG-004 (parcours de collecte conditionnelle) — absent de
//      la version en production, ajouté ici pour test.
//   2. Rappel de l'exclusion ADR-013 (Photomontage administratif exclu sous
//      Retexturation Revit) — actuellement délégué au Knowledge, mis en dur ici.
// Les deux patches sont marqués [PATCH] pour rester repérables et faciles à
// retirer si tu veux tester la version non patchée.
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `Tu es l'implémentation conversationnelle du Rendering Intelligence Framework (RIF), dédiée à créer et corriger des rendus architecturaux à partir de vues Revit.

MISSION Accompagner l'utilisateur pas à pas jusqu'à un rendu photoréaliste fidèle au projet. La fidélité architecturale prévaut toujours sur l'esthétique. Tu produis réellement l'image via l'outil disponible ; tu n'expliques jamais comment le faire à la place.

PRINCIPES ABSOLUS

La perspective Revit principale fait autorité pour la géométrie (volumes, proportions, niveaux, ouvertures, toitures, terrasses, piscines, annexes, implantation, cadrage, caméra, perspective) ; la photographie réelle fait autorité pour l'environnement (terrain, relief, végétation, voisinage, clôtures, accès, horizon, ciel, lumière).
Un matériau ou une teinte validés dans la fiche projet priment sur la photo pour cet élément ; la photo garde alors son rôle de repère de position et d'environnement.
L'axonométrie sert uniquement au contrôle des volumes et de l'implantation, sans jamais remplacer la perspective principale.
Les informations validées par l'utilisateur complètent les images.
N'invente rien d'absent des sources — ni géométrie, ni matériau, ni environnement. Ne remplace jamais le ciel ou la lumière de la photo par une condition différente, même plus esthétique.
N'améliore que le photoréalisme, les textures, l'eau, les reflets, la lumière et les raccords visuels, sans transformer le projet.
Le rendu reste une représentation visuelle soumise à validation humaine, jamais un document technique ou réglementaire.

MÉMOIRE DE PROJET Maintiens silencieusement une fiche projet à jour : documents reçus et leur rôle, données de l'étape 3, mode et style retenus, validations, corrections, réserves. Ne redemande jamais une information déjà obtenue, sauf contradiction réelle ; la dernière validation remplace l'ancienne.

PARCOURS OBLIGATOIRE

ÉTAPE 1 — DOCUMENTS Pour un nouveau rendu, demander : la vue 3D Revit principale (obligatoire) ; la photographie réelle si un photomontage du site est attendu ; l'axonométrie en complément facultatif. Sans photographie, proposer la Retexturation Revit en signalant la limite, sans bloquer inutilement.

ÉTAPE 2 — CONTRÔLE INITIAL Dès réception, indiquer brièvement : le rôle de chaque image ; les informations confidentielles visibles ; la compatibilité des points de vue (Compatible, Approximative, Incompatible, Non évaluée) ; ce qui est certain, ce qui manque. La vérification de confidentialité porte sur le contenu visible, jamais les métadonnées. Incompatibilité majeure en usage administratif : suspendre, demander une nouvelle vue ou photo. Approximative : expliquer la réserve une fois, demander l'accord de poursuivre, l'enregistrer sans reposer la question sauf nouvelle contradiction.

ÉTAPE 3 — COLLECTE PROGRESSIVE [PATCH ENG-004] Dès que le mode et/ou le style sont pressentis, adapter la suite du parcours : réduire, convertir en confirmation d'une ligne, ou retirer les questions suivantes plutôt que les poser toutes comme des choix ouverts. En particulier, en Photomontage contrôlé + Photomontage administratif (cas par défaut dès qu'une photo existe pour un usage administratif), le mode et le style se confirment en une ligne plutôt que de se poser comme un choix ouvert, la conservation de l'environnement est déjà la règle par défaut, et la lumière suit la photographie sans qu'il soit besoin de le demander.
Poser uniquement les questions utiles, par petits groupes, puis attendre la réponse ; jamais de long questionnaire. Ordre : type de projet, phase, usage du rendu ; mode de production (voir MODES ET STYLES) et implantation attendue ; éléments intouchables ; toiture, façades, menuiseries, sols, couleurs (existant conservé ou modifié) ; environnement à conserver/supprimer/améliorer ; ambiance lumineuse ; style ; personnages, véhicules, mobilier, autres ajouts. Si une réponse contient plusieurs informations, tout enregistrer et ne redemander que le manquant. Un matériau inconnu ne se déduit jamais d'une couleur Revit seule : préciser si nécessaire, sinon conserver prudemment l'apparence visible.

MODES ET STYLES Choisir le mode avant le style : le mode fabrique l'image, le style l'habille. Trois modes : Retexturation Revit (Revit seul) ; Photomontage contrôlé (photo + vue compatible, défaut en usage administratif) ; Présentation générative (liberté d'ambiance validée, non documentaire). Caméras incompatibles en usage administratif : suspendre, demander une nouvelle vue ou calibration. Styles (détails et interdictions dans le Knowledge) : Photomontage administratif (défaut), Présentation client, Commercial (jamais automatique ; demander le moment — jour, fin de journée, crépuscule ; éclairage ponctuel seulement si tardif). [PATCH ADR-013] Sous le mode Retexturation Revit (sans photographie), le style Photomontage administratif n'est jamais proposable — seuls Présentation client (valeur par défaut) et Commercial le sont. Le style n'agit que sur l'apparence, jamais l'architecture — jamais d'esthétique publicitaire. En cas de doute, demander confirmation.

ÉTAPE 4 — FICHE PROJET FINALE Une fois les informations réunies, présenter une synthèse distinguant : informations validées ; choix provisoires ou réserves ; hiérarchie des sources ; éléments à préserver ; modifications autorisées ; éléments interdits. Ne répète pas la conversation. Termine par : « Souhaites-tu que je lance la génération ? »

ÉTAPE 5 — GÉNÉRATION Après confirmation : première génération — genererRenduFlux, jamais l'outil interne image_gen. Modification d'un rendu déjà obtenu — corrigerRenduFlux (voir CORRECTIONS), jamais genererRenduFlux à nouveau. Action indisponible : le signaler, ne pas se rabattre sur un autre outil. Réponse avec success à false : transmettre error.message tel quel, sans deviner ni reformuler. N'affiche pas le prompt technique, ne redemande pas de confirmation. Selon le mode : Retexturation Revit — caméra, cadrage, contours, volumes intouchables, seuls matériaux/eau/lumière/ombres s'améliorent. Photomontage contrôlé — la photo fait foi pour le cadrage final, intégration par translation et échelle cohérentes, sans rotation ni déformation, rien hors zone d'intervention. Présentation générative — géométrie Revit autoritaire, environnement harmonisable dans les limites validées. Toujours : focale neutre 35-50mm, rien reconstruit ni inventé.

APRÈS GÉNÉRATION Avant de présenter le rendu, comparer aux sources dans cet ordre : géométrie, ouvertures, toiture, implantation, terrain, environnement, matériaux, lumière, éléments secondaires. Classer chaque point : Conforme, Réserve, Non conforme, Non applicable. Signaler immédiatement tout écart, avant que l'utilisateur ait à le relever. Proposer une décision : Validation, Correction ciblée ou Nouvelle génération. Le lien du fichier généré est toujours inclus, quelle que soit la décision.

CORRECTIONS Une correction ne modifie que les éléments demandés, jamais une régénération globale : appelle corrigerRenduFlux, jamais genererRenduFlux. openaiFileIdRefs commence par le dernier rendu validé (référence de base), suivi des sources disponibles (Revit, photo, axono), puis du rendu annoté s'il existe. correctionPrompt ne décrit que ce qui doit changer — jamais de redemander de préserver le reste, c'est la règle par défaut. lockedAreas/editableAreas renforcent la consigne quand la fiche projet les établit clairement. Un rendu annoté n'est qu'une indication visuelle, jamais un masque garanti : précise-le dans correctionPrompt. Après chaque correction, contrôler les régressions ; si plusieurs zones sont fausses, la caméra a dérivé, l'environnement a été recréé en Photomontage contrôlé, ou les corrections s'accumulent en dégradant l'image : repartir des sources d'origine, nouvelle génération via genererRenduFlux.

COMPORTEMENT Parler simplement, directement, professionnellement, une étape à la fois. Ne jamais inventer, ne pas reposer une question tranchée, ne pas bloquer pour une préférence secondaire. Signaler clairement les limites importantes. Ne proposer un conseil que s'il apporte une valeur réelle, sans retarder le rendu. Ne mentionner les modules internes du RIF que si demandé.`;

// ---------------------------------------------------------------------------
// Schémas d'outils — reconstruction raisonnable à partir du comportement décrit
// dans les Instructions (ÉTAPE 5, CORRECTIONS). À aligner sur le schéma OpenAPI
// réel v1.2.0 de l'Action avant tout branchement en production.
// ---------------------------------------------------------------------------
const TOOLS = [
  {
    name: "genererRenduFlux",
    description:
      "Lance la première génération d'un rendu photoréaliste à partir des sources validées et de la fiche projet finalisée. Ne jamais utiliser pour une correction.",
    input_schema: {
      type: "object",
      properties: {
        revitViewFileId: {
          type: "string",
          description: "Référence de la vue 3D Revit principale (obligatoire).",
        },
        sitePhotoFileId: {
          type: "string",
          description: "Référence de la photo du site, si un photomontage est attendu.",
        },
        axonometryFileId: {
          type: "string",
          description: "Référence de l'axonométrie, si fournie.",
        },
        projectData: {
          type: "object",
          description: "Fiche projet structurée telle que validée à l'étape 4.",
          properties: {
            projectType: { type: "string" },
            phase: { type: "string" },
            renderMode: {
              type: "string",
              enum: ["retexturation_revit", "photomontage_controle", "presentation_generative"],
            },
            renderStyle: {
              type: "string",
              enum: ["photomontage_administratif", "presentation_client", "commercial"],
            },
            cameraCompatibility: {
              type: "string",
              enum: ["compatible", "approximative", "incompatible", "non_evaluee"],
            },
            interventionZone: { type: "string" },
            existingElements: { type: "array", items: { type: "string" } },
            projectElements: { type: "array", items: { type: "string" } },
            elementsToRemove: { type: "array", items: { type: "string" } },
            environmentToKeep: { type: "array", items: { type: "string" } },
            gardenTreatment: { type: "string" },
            forbidden: { type: "array", items: { type: "string" } },
          },
        },
        generationPrompt: {
          type: "string",
          description:
            "Prompt technique final en langage naturel transmis au moteur de génération d'image.",
        },
      },
      required: ["revitViewFileId", "projectData", "generationPrompt"],
    },
  },
  {
    name: "corrigerRenduFlux",
    description:
      "Applique une correction ciblée sur un rendu déjà généré, sans régénérer la scène entière.",
    input_schema: {
      type: "object",
      properties: {
        baseRenderFileId: {
          type: "string",
          description: "Dernier rendu validé, servant de base à la correction.",
        },
        revitViewFileId: { type: "string" },
        sitePhotoFileId: { type: "string" },
        axonometryFileId: { type: "string" },
        annotatedRenderFileId: {
          type: "string",
          description: "Rendu annoté par l'utilisateur, si présent — indication visuelle, jamais un masque garanti.",
        },
        correctionPrompt: {
          type: "string",
          description: "Décrit uniquement ce qui doit changer, jamais ce qui doit être préservé.",
        },
        lockedAreas: { type: "string" },
        editableAreas: { type: "string" },
      },
      required: ["baseRenderFileId", "correctionPrompt"],
    },
  },
];

const SLOTS = [
  { key: "vue_revit_principale", label: "Vue 3D Revit", required: true },
  { key: "photo_site", label: "Photo du site", required: false },
  { key: "axonometrie", label: "Axonométrie", required: false },
];

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(",")[1]);
    r.onerror = () => reject(new Error("Lecture du fichier échouée"));
    r.readAsDataURL(file);
  });
}

export default function RifChatPrototype() {
  const [sources, setSources] = useState({});
  const [displayMsgs, setDisplayMsgs] = useState([
    {
      role: "assistant",
      text: "Dépose ta vue 3D Revit (obligatoire) et, si besoin, une photo du site, puis décris le projet — je m'occupe du reste.",
    },
  ]);
  const [apiMsgs, setApiMsgs] = useState([]); // format Anthropic messages
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [displayMsgs, busy]);

  async function handleUpload(slotKey, file) {
    if (!file) return;
    const base64 = await fileToBase64(file);
    setSources((prev) => ({
      ...prev,
      [slotKey]: { file, base64, mediaType: file.type || "image/jpeg", previewUrl: URL.createObjectURL(file) },
    }));
  }

  function removeSource(slotKey) {
    setSources((prev) => {
      const next = { ...prev };
      delete next[slotKey];
      return next;
    });
  }

  async function callClaude(messages) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      }),
    });
    if (!res.ok) throw new Error(`Erreur API (${res.status})`);
    return res.json();
  }

  // Exécution stub d'un outil — à remplacer par le vrai appel fal.ai / n8n.
  function stubToolResult(toolUse) {
    if (toolUse.name === "genererRenduFlux") {
      return {
        success: true,
        note: "STUB — aucune image réelle générée. Branchement fal.ai/n8n à faire.",
        renderUrl: null,
        renderFileId: "local://render-stub-" + Date.now(),
        promptEnvoyé: toolUse.input.generationPrompt,
        sourcesReçues: {
          revitViewFileId: toolUse.input.revitViewFileId,
          sitePhotoFileId: toolUse.input.sitePhotoFileId,
          axonometryFileId: toolUse.input.axonometryFileId,
        },
      };
    }
    if (toolUse.name === "corrigerRenduFlux") {
      return {
        success: true,
        note: "STUB — correction simulée, aucune image réelle produite.",
        renderUrl: null,
        renderFileId: "local://render-stub-" + Date.now(),
        baseUtilisée: toolUse.input.baseRenderFileId,
        promptEnvoyé: toolUse.input.correctionPrompt,
      };
    }
    return { success: false, error: { message: "Outil inconnu" } };
  }

  async function runLoop(messages) {
    let currentMessages = messages;
    for (let i = 0; i < 5; i++) {
      const response = await callClaude(currentMessages);
      const assistantContent = response.content || [];

      const textParts = assistantContent.filter((b) => b.type === "text");
      const toolUses = assistantContent.filter((b) => b.type === "tool_use");

      textParts.forEach((t) => {
        setDisplayMsgs((prev) => [...prev, { role: "assistant", text: t.text }]);
      });

      currentMessages = [...currentMessages, { role: "assistant", content: assistantContent }];

      if (toolUses.length === 0) {
        setApiMsgs(currentMessages);
        return;
      }

      const toolResultsContent = [];
      for (const tu of toolUses) {
        setDisplayMsgs((prev) => [...prev, { role: "tool_call", tool: tu.name, input: tu.input }]);
        const result = stubToolResult(tu);
        setDisplayMsgs((prev) => [...prev, { role: "tool_result", tool: tu.name, result }]);
        toolResultsContent.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: JSON.stringify(result),
        });
      }
      currentMessages = [...currentMessages, { role: "user", content: toolResultsContent }];
    }
    setApiMsgs(currentMessages);
  }

  async function handleSend() {
    if (!input.trim() && Object.keys(sources).length === 0) return;
    setBusy(true);

    const contentBlocks = [];
    SLOTS.forEach(({ key, label }) => {
      const s = sources[key];
      if (s) {
        contentBlocks.push({ type: "text", text: `${label} (id: local://${key}) :` });
        contentBlocks.push({
          type: "image",
          source: { type: "base64", media_type: s.mediaType, data: s.base64 },
        });
      }
    });
    if (input.trim()) contentBlocks.push({ type: "text", text: input.trim() });

    setDisplayMsgs((prev) => [
      ...prev,
      {
        role: "user",
        text: input.trim(),
        images: Object.entries(sources).map(([k, v]) => ({ label: SLOTS.find((s) => s.key === k)?.label, url: v.previewUrl })),
      },
    ]);

    const newApiMsgs = [...apiMsgs, { role: "user", content: contentBlocks }];
    setInput("");
    setSources({});

    try {
      await runLoop(newApiMsgs);
    } catch (e) {
      setDisplayMsgs((prev) => [...prev, { role: "assistant", text: `Erreur : ${e.message}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={styles.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-thumb { background: #C9DAD6; border-radius: 8px; }
        textarea:focus, button:focus { outline: 2px solid #1C7C72; outline-offset: 2px; }
      `}</style>

      <header style={styles.header}>
        <div style={styles.headerTitle}>RIF — Prototype conversationnel</div>
        <div style={styles.headerSub}>Hors ChatGPT · sources → chat → outil de génération (stub)</div>
      </header>

      <div style={styles.body}>
        <aside style={styles.sidebar}>
          <div style={styles.sidebarLabel}>Sources</div>
          {SLOTS.map(({ key, label, required }) => {
            const s = sources[key];
            return (
              <div key={key} style={styles.slot}>
                <div style={styles.slotLabelRow}>
                  <span style={styles.slotLabel}>
                    {label} {required && <span style={{ color: "#D65A3A" }}>*</span>}
                  </span>
                  {s && (
                    <button style={styles.removeBtn} onClick={() => removeSource(key)} aria-label={`Retirer ${label}`}>
                      <X size={13} />
                    </button>
                  )}
                </div>
                {s ? (
                  <img src={s.previewUrl} alt={label} style={styles.thumb} />
                ) : (
                  <label style={styles.dropzone}>
                    <ImageIcon size={18} color="#7A9490" />
                    <span style={styles.dropzoneText}>Ajouter</span>
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) => handleUpload(key, e.target.files?.[0])}
                    />
                  </label>
                )}
              </div>
            );
          })}
          <div style={styles.sidebarNote}>
            La génération est simulée dans ce prototype : le prompt technique assemblé par le modèle
            s'affiche dans la conversation, sans appel fal.ai réel.
          </div>
        </aside>

        <main style={styles.chatCol}>
          <div style={styles.messages} ref={scrollRef}>
            {displayMsgs.map((m, i) => (
              <MessageBubble key={i} msg={m} />
            ))}
            {busy && <div style={styles.typing}>Le RIF réfléchit…</div>}
          </div>

          <div style={styles.inputRow}>
            <textarea
              style={styles.textarea}
              placeholder="Décris le projet, réponds aux questions…"
              value={input}
              rows={1}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button style={styles.sendBtn} onClick={handleSend} disabled={busy} aria-label="Envoyer">
              <Send size={16} color="#fff" />
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}

function MessageBubble({ msg }) {
  if (msg.role === "tool_call") {
    return (
      <div style={styles.toolCard}>
        <div style={styles.toolHeader}>
          <Wrench size={14} color="#7C5CC4" />
          <span>Outil appelé : {msg.tool}</span>
        </div>
        <pre style={styles.toolPre}>{JSON.stringify(msg.input, null, 2)}</pre>
      </div>
    );
  }
  if (msg.role === "tool_result") {
    return (
      <div style={styles.toolResultCard}>
        <div style={styles.toolHeader}>
          <CheckCircle2 size={14} color="#1C7C72" />
          <span>Résultat ({msg.tool})</span>
        </div>
        <pre style={styles.toolPre}>{JSON.stringify(msg.result, null, 2)}</pre>
      </div>
    );
  }
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 10 }}>
      <div style={isUser ? styles.userBubble : styles.assistantBubble}>
        {msg.images && msg.images.length > 0 && (
          <div style={styles.imgRow}>
            {msg.images.map((im, idx) => (
              <div key={idx} style={styles.imgChip}>
                <img src={im.url} alt={im.label} style={styles.imgChipThumb} />
                <span style={styles.imgChipLabel}>{im.label}</span>
              </div>
            ))}
          </div>
        )}
        {msg.text && <div style={{ whiteSpace: "pre-wrap" }}>{msg.text}</div>}
      </div>
    </div>
  );
}

const styles = {
  app: {
    fontFamily: "'Inter', sans-serif",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "#F6F8F6",
    color: "#16221F",
  },
  header: {
    padding: "14px 20px",
    borderBottom: "1px solid #DCE7E4",
    background: "#0E3B39",
  },
  headerTitle: { fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 16, color: "#fff" },
  headerSub: { fontSize: 12, color: "#A9CFC8", marginTop: 2 },
  body: { flex: 1, display: "flex", overflow: "hidden" },
  sidebar: {
    width: 200,
    padding: 16,
    borderRight: "1px solid #DCE7E4",
    background: "#FBFDFC",
    overflowY: "auto",
    flexShrink: 0,
  },
  sidebarLabel: { fontSize: 11, fontWeight: 600, letterSpacing: 0.3, color: "#5C716C", marginBottom: 10 },
  sidebarNote: { fontSize: 11, color: "#7A9490", marginTop: 14, lineHeight: 1.5 },
  slot: { marginBottom: 14 },
  slotLabelRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  slotLabel: { fontSize: 12, fontWeight: 500, color: "#16221F" },
  removeBtn: { border: "none", background: "none", cursor: "pointer", color: "#7A9490", padding: 2 },
  dropzone: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    height: 64,
    border: "1.5px dashed #C9DAD6",
    borderRadius: 6,
    cursor: "pointer",
    background: "#F0F6F4",
  },
  dropzoneText: { fontSize: 11, color: "#7A9490" },
  thumb: { width: "100%", height: 64, objectFit: "cover", borderRadius: 6, border: "1px solid #DCE7E4" },
  chatCol: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 },
  messages: { flex: 1, overflowY: "auto", padding: "18px 20px" },
  typing: { fontSize: 12, color: "#7A9490", fontStyle: "italic", marginTop: 4 },
  userBubble: {
    maxWidth: "72%",
    background: "#0E3B39",
    color: "#fff",
    padding: "10px 14px",
    borderRadius: "12px 12px 2px 12px",
    fontSize: 14,
    lineHeight: 1.5,
  },
  assistantBubble: {
    maxWidth: "78%",
    background: "#fff",
    border: "1px solid #DCE7E4",
    padding: "10px 14px",
    borderRadius: "12px 12px 12px 2px",
    fontSize: 14,
    lineHeight: 1.5,
  },
  imgRow: { display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" },
  imgChip: { display: "flex", flexDirection: "column", alignItems: "center", width: 64 },
  imgChipThumb: { width: 64, height: 48, objectFit: "cover", borderRadius: 5, border: "1px solid rgba(255,255,255,0.3)" },
  imgChipLabel: { fontSize: 9, marginTop: 2, opacity: 0.85, textAlign: "center" },
  toolCard: {
    background: "#F4F0FB",
    border: "1px solid #D8CDF0",
    borderLeft: "3px solid #7C5CC4",
    borderRadius: 6,
    padding: "10px 12px",
    marginBottom: 10,
    maxWidth: "85%",
  },
  toolResultCard: {
    background: "#EDF6F4",
    border: "1px solid #C9DAD6",
    borderLeft: "3px solid #1C7C72",
    borderRadius: 6,
    padding: "10px 12px",
    marginBottom: 10,
    maxWidth: "85%",
  },
  toolHeader: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, marginBottom: 6 },
  toolPre: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 11,
    background: "rgba(0,0,0,0.03)",
    padding: 8,
    borderRadius: 4,
    overflowX: "auto",
    margin: 0,
    lineHeight: 1.5,
  },
  inputRow: {
    display: "flex",
    gap: 8,
    padding: 14,
    borderTop: "1px solid #DCE7E4",
    background: "#fff",
  },
  textarea: {
    flex: 1,
    resize: "none",
    border: "1px solid #DCE7E4",
    borderRadius: 8,
    padding: "10px 12px",
    fontFamily: "'Inter', sans-serif",
    fontSize: 14,
    minHeight: 40,
    maxHeight: 120,
  },
  sendBtn: {
    background: "#D65A3A",
    border: "none",
    borderRadius: 8,
    width: 40,
    height: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
  },
};
