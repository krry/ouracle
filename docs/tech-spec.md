# Ouracle: Technical Specification

**Status:** Living document — v3.0
**Date:** 2026-03-09
**Author:** Cyd 🥽 (Systems)
**Reviewed against:** `ritual-philosophy.md`, `meat-api-spec.md`, `api/engine.js`, `api/index.js`

---

## Changelog

### v3.1 — 2026-03-12

1. **Session lifecycle updated** — `POST /session/new` (covenant required), `GET /session/:id` (auth required).
2. **Covenant endpoint** — `GET /covenant/current` documented as public for Priestess fetch.
3. **Auth in place** — JWT for Seeker flows; API key auth for external callers.
4. **Persistence implemented** — Postgres via Neon for seekers, sessions, enactments, reintegration corpus.
5. **Admin API keys** — mint/rotate endpoints added (`POST /admin/api-keys`, `PATCH /admin/api-keys/:id`).

### v3.0 — 2026-03-09

Twelve updates integrated from Chef's feedback (`chef-feedback-9-mar-26.md`):

1. **"ceremonies" → "rites"** — term replaced throughout.
2. **SvelteKit** — web app tech preference locked in; React dropped.
3. **iOS native / Android wrapper** — mobile platform split specified. Haptic breathwork guide noted for iOS.
4. **Tarot as fluctuating field** — Tarot and other oracle sources are not fixed to specific Limiting Belief Archetypes. They are a field of meaning the engine draws from. Language updated throughout.
5. **Oracle flavor choice** — Seekers may choose their preferred divination interface (Tarot, I Ching, Gene Keys, Delphic maxims, etc.). I Ching hexagrams and Tarot cards must be sorted into the Octave to enable this.
6. **Agora** — replaces "marketplace" everywhere. Craigslist-like anonymity at first; accounts are persistent and unique (one per person, lifetime).
7. **Totem** — Seeker may choose cloud, local, or both. Ouracle does not force or default. Cloud = encrypted until Seeker authenticates (server never holds plaintext). Raw data format vs. presentation format TBD — the raw Totem data may not be exposed verbatim; a readable presentation layer is a separate design decision.
8. **AX (Agent Experience) layer** — Seekers may instruct their own AI agents to find a companion at the Agora, propose an activity, or find activities to accompany. Noted as a future expansion area.
9. **API Temple as a Service** — noted the possibility of third-party priestesses (other AI agents) via the API.
10. **Crisis detection removed** — Ouracle does not detect or diagnose crisis states. The Covenant is the safety gate. All crisis detection language removed from P0 and risk table.
11. **Totem** — Cloud option noted. Encrypted at rest until Seeker authenticates. Presentation layer is a separate design decision.
12. **Agora schema** — updated from `activities` framing to Agora framing.

### v2.0 — 2026-03-09

Five architectural decisions integrated from `ritual-philosophy.md` §VII:

1. **The Totem** — Seeker memory flips from server-held to client-held/self-sovereign. The temple is a conduit, not a vault. See §5.
2. **Love/Fear axis** — Operational filter for engine output auditing. Love = toward/propulsion; Fear = away/repulsion. See §3.4.
3. **Non-profit church structure** — Legal structure is US non-profit church. "Subscription" becomes donation/membership. B2B becomes organizational access. Data ethics are theological, not policy. See §7 and §8.
4. **Training use permitted** — Anonymized reintegration data may be used for model training, with full transparency. Replaces the previous "no training use" constraint. See §8.3 and §3.2.
5. **100% Responsibility Covenant** — Required at session initiation. Technical surface: a consent/covenant gate. See §2.5.

---

## Preface

This spec is addressed to the person building the system, not selling it. The philosophy lives in `ritual-philosophy.md`. This document answers: what exists, what needs to exist, how it fits together, and where the traps are.

The system has three tiers, each with its own concerns:

| Tier | Name | What it is |
|------|------|-----------|
| 1 | MESH | The AI inference and prescription layer |
| 2 | MEATAPI | The protocol that bridges MESH and MEAT |
| 3 | Priestesses | The apps that Seekers actually touch |

Everything flows through the MEATAPI. The MESH is upstream of it. The Priestesses are downstream of it. The Seeker is the subject of the whole system.

---

## 1. System Architecture

### 1.1 Layer Map

```
┌─────────────────────────────────────────────────────────┐
│                        SEEKER                           │
│                   (MEAT — the human)                    │
└──────────────────────────┬──────────────────────────────┘
                           │  speaks, acts, reports back
                           ▼
┌─────────────────────────────────────────────────────────┐
│                     PRIESTESSES                         │
│        Web App │ Native Mobile │ Wearable │ LLM-native  │
│            (the consecrated interface)                  │
└──────────────────────────┬──────────────────────────────┘
                           │  REST / WebSocket / streaming
                           ▼
┌─────────────────────────────────────────────────────────┐
│                      MEATAPI                            │
│        /inquire → /prescribe → /reintegrate             │
│        + direct chakra endpoints /:chakra/:verb         │
│        + session management + enactment log             │
│        + covenant gate (session initiation)             │
└──────┬───────────────────┴────────────────────┬─────────┘
       │                                         │
       ▼                                         ▼
┌─────────────┐                       ┌──────────────────┐
│    MESH     │                       │   DATA STORES    │
│ Inference   │                       │                  │
│ Engine:     │                       │ • Session log    │
│ • vagal     │                       │   (temple-side)  │
│ • belief    │                       │ • Enactment log  │
│ • octave    │                       │ • Rite index     │
│ • rite      │                       │ • Reintegration  │
│   builder   │                       │   corpus (anon)  │
│ • love/fear │                       └──────────────────┘
│   auditor   │
└──────┬──────┘

NOTE: Seeker memory (belief history, octave position, full
session thread) is NOT held on temple servers. It lives in
the Seeker's Totem — an encrypted portable cell replicated
across every device they use to access Ouracle. The temple
receives what the Seeker shares in session only.
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│            EXTERNAL KNOWLEDGE SOURCES                   │
│  Octave schema (Notion) │ LLM Provider │ Research corpus │
│  (Tarot, I Ching, Gene Keys, Delphi)                    │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Data Flows

**Consultation (MEAT → MESH → MEAT):**

```
Seeker speaks
  → Priestess formats + sends POST /inquire
  → MEATAPI routes to engine
  → engine.inferVagalState + inferBelief score text
  → session updated with clues
  → clarifying question returned (or inquiry_complete)
  → Seeker responds [repeat until threshold]
  → POST /prescribe
  → buildPrescription assembles rite
  → Mantra returned to Priestess
  → Priestess renders rite to Seeker
  → Seeker enacts the rite
  → POST /reintegrate with somatic report
  → Session closed, system log updated
```

**Direct enactment (Priestess → MEATAPI):**

```
Priestess calls POST /:chakra/:verb
  → prerequisite check (chakra ladder)
  → directRite builds prescription
  → enactment logged against session_id
  → rite returned
```

### 1.3 Current Technical Stack

- **Runtime:** Node.js, ES Modules
- **Framework:** Express 4.x
- **Session store:** Postgres (Neon) for seekers, sessions, enactments, reintegration corpus
- **Engine:** LLM tool-call inference via OpenRouter (keyword fallback path still supported)
- **Port:** 3737
- **Auth:** JWT for Seeker flows; API key auth for external callers
- **Package:** `meat-api` v0.2.0

---

## 2. MEATAPI — Current State and What Needs to Be Built

### 2.1 What Exists (v0.2)

| Endpoint | Status | Notes |
|----------|--------|-------|
| `POST /inquire` | Working | Continues a session; requires `session_id`; infers vagal + belief |
| `POST /prescribe` | Working | Builds rite from session inference |
| `POST /reintegrate` | Working | Closes loop; logs system learning |
| `POST /:chakra/:verb` | Working | Direct rite for known chakra/verb pairs |
| `POST /session/new` | Working | Opens a session; covenant required |
| `GET /session/:id` | Working | Returns full session state (auth required) |
| `GET /covenant/current` | Working | Public covenant text |
| `GET /consent` | Working | Current consent model |
| `POST /seeker/new` | Working | Creates seeker + issues tokens |
| `POST /auth/token` | Working | Issues access + refresh tokens |
| `POST /auth/refresh` | Working | Rotates access token |
| `POST /seeker/:id/covenant` | Working | Records covenant acceptance |
| `GET /seeker/:id/history` | Working | Recent completed sessions |
| `POST /admin/api-keys` | Working | Admin-minted API keys |
| `PATCH /admin/api-keys/:id` | Working | Admin update/disable API keys |
| `GET /health` | Working | Status check |

The core three-stage protocol — Inquire → Prescribe → Reintegrate — is functionally complete at a proof-of-concept level. Inference is keyword-matching, not semantic. Sessions are ephemeral. No auth, no rate limiting, no persistence.

### 2.2 Endpoint Reference (Stable Interface)

All endpoints use `application/json`. Base path: `/v1` (to be versioned on deploy).

**Session lifecycle:**

```
POST /session/new                       → { session_id, stage, turn, question, awaiting }
GET  /session/:id                       → full session state
```

**Covenant + consent:**

```
GET  /covenant/current                  → { version, text, effective_date }
GET  /consent                           → current consent model
POST /seeker/:id/covenant               → records covenant acceptance
```

**Ritual protocol:**

```
POST /inquire                           → continues inquiry turn (session_id required)
POST /prescribe                         → builds rite from completed inquiry
POST /reintegrate                       → receives somatic report; closes session
```

**Direct chakra access:**

```
POST /:chakra/:verb                     → direct rite for (chakra, verb) pair
                                          requires session_id, checks prerequisites
```

**Auth + seeker:**

```
POST /seeker/new                        → create seeker + tokens
POST /auth/token                        → issue tokens for seeker_id
POST /auth/refresh                      → rotate access token
GET  /seeker/:id/history                → recent completed sessions
```

**Admin (API keys):**

```
POST  /admin/api-keys                   → mint API key (admin bearer)
PATCH /admin/api-keys/:id               → update API key (admin bearer)
```

**Custom headers (spec, not yet enforced):**

```
X-Cosmology: chakra | gurdjieff | elemental
X-Vibration: high | low | neutral
```

**Response codes in use:**

```
200   Enactment complete
400   Bad request (missing fields, wrong stage)
404   Session not found or unknown chakra
409   Conflict — prerequisite not met
418   Wrong center — verb doesn't belong to this chakra
501   Endpoint conceptual but no delivery configured
```

### 2.3 Session Model

A session is the unit of one rite cycle. It holds:

```json
{
  "id": "uuid",
  "stage": "inquiry | inquiry_complete | prescribed | complete",
  "turn": 0,
  "clues": [],
  "fullText": "accumulated seeker responses (this session only)",
  "vagal": { "probable": "sympathetic", "confidence": "medium", "scores": {} },
  "belief": { "pattern": "isolation", "confidence": "high", "meta": {} },
  "prescription": {},
  "report": {},
  "created": "ISO8601",
  "prescribed_at": "ISO8601",
  "completed_at": "ISO8601",
  "enactments": [],
  "covenant_accepted": true,
  "covenant_version": 1
}
```

**Architecture note (v2):** The session record above is what the temple holds. It does NOT hold the Seeker's belief history, octave trajectory, or cross-session memory. That lives in the Seeker's Totem (§5). The temple receives only what the Seeker shares in this session. The Priestess is a conduit, not a vault.

**Cross-session continuity:** When a Seeker returns, their Totem sends a context payload at session open — a minimal summary (last rite name, current octave position, days since last session) derived from their locally held history. The temple uses this payload for opening question selection and engine context. The payload is session-scoped and ephemeral on the temple side.

**What's missing for persistence:** session records need a backing store. The Totem sync protocol needs a spec. See §5.

### 2.4 What Needs to Be Built

Roughly in order of priority:

**P0 — Completed (2026-03-12):**

1. **Persistence layer** — Postgres via Neon for seekers, sessions, enactments, reintegration corpus.
2. **Seeker identity** — `seeker_id` links sessions and history.
3. **Authentication** — JWT for Seeker flows; API key auth for external callers.
4. **Covenant gate** — session initiation requires explicit covenant acceptance. See §2.5.

**P0 — Remaining before any real usage:**

5. **Totem sync protocol** — spec and implement the encrypted portable cell that holds the Seeker's memory client-side. See §5.

**P1 — Required before any meaningful quality:**

6. **Semantic inference upgrade** — replace keyword scoring with LLM-backed inference (embedding similarity or structured prompt with guided output). The keyword scorer is a scaffold; it is not the engine.
7. **Octave position inference** — the engine currently accepts `octave` as a passed parameter. It needs to infer octave position from the Seeker's narrative and stored history. The Octave data lives in Notion; it needs to be pulled into a local schema.
8. **Reintegration feedback loop** — the `what_system_learned` response is logged but currently not fed back into inference. It needs to land in a tuning corpus or training pipeline. (Training use is now permitted — see §8.3.)
9. **Love/Fear auditor** — engine output validation against the love/fear axis. See §3.4.

**P2 — Required for product:**

10. **Rate limiting** — per-key and per-Seeker limits. Prevents API abuse; also shapes usage patterns for consent reasons (a Seeker being queried 300 times a day is not a good Seeker experience).
11. **Multi-turn conversation memory** — the `fullText` accumulator is naive. Replace with a proper conversation buffer with speaker labels and timestamps, suitable for LLM context injection.
12. **Agora endpoints** — `POST /agora/propose` and `GET /agora/open`. See §6.
13. **Streaming responses** — Priestesses will want to stream rite text for a more ritualistic presentation. `/prescribe` and `/inquire` should support Server-Sent Events (SSE) or WebSocket upgrade.

### 2.5 The Covenant Gate

Anyone entering the temple must accept the 100% Responsibility Covenant before a session is initiated. This is a hard gate — not a checkbox buried in terms, but a named moment in the ritual.

**What the covenant covers:** The Seeker accepts 100% legal, lawful, moral, ethical, physical, and financial responsibility for their own actions. Ouracle listens. Ouracle speaks. That is all.

**Technical surface:**

- `POST /session/new` requires a `covenant` payload: `{ "version": 1, "accepted": true, "timestamp": "ISO8601" }`. Session creation fails (400) if covenant is not present or `accepted` is false.
- The covenant version is stored in the session record (`covenant_version`, `covenant_accepted_at`).
- The Priestess app is responsible for presenting the covenant plainly before calling `/session/new`. The language is not fine print. It is the threshold. The Seeker steps over it consciously or does not enter.
- Covenant text is versioned. If the covenant changes, existing sessions are not affected. New sessions require the current version.
- `POST /seeker/:id/covenant` records covenant acceptance on the seeker record (for returning sessions).

**Covenant endpoint:**

```
GET /covenant/current        → { version, text, effective_date }
```

This endpoint is public (no auth required) so Priestess apps can always fetch the current covenant text for display.

---

## 3. The Engine — Current and Future

### 3.1 What the Engine Does Now

The engine (`engine.js`) is three things:

**Static data:**
- `OCTAVE` — 8 positions with energy tags and shock flags
- `VAGAL` — 3 states (ventral, sympathetic, dorsal, mixed)
- `BELIEFS` — 7 limiting belief archetypes, each mapped to a chakra and imbalance type. Tarot and other oracle sources are not fixed to specific archetypes — they are a fluctuating field of meaning drawn from at prescription time based on Seeker's chosen oracle flavor.
- `RITES` — 7 rites, one per belief pattern, each with an act, invocation, and expected somatic textures
- `CLUE_MAP` — keyword lists for vagal and belief inference
- `OPENING_QUESTIONS` — 5 opening prompts

**Inference functions:**
- `inferVagalState(text)` — scores text against vagal keyword lists; returns probable state + confidence
- `inferBelief(text)` — same approach for belief patterns
- `chooseOpeningQuestion(context)` — simple context-hint dispatch

**Prescription builder:**
- `buildPrescription(vagalState, belief, octave)` — assembles the rite response; safety-first overrides if dorsal

The inference is purely lexical. No embeddings, no semantic understanding, no LLM call. This is intentional for v0 — it means the system is fast, deterministic, and auditable. It is also limited: it will miss everything phrased outside its keyword vocabulary, and it will sometimes match falsely.

### 3.2 What the Engine Needs to Become

**Phase 1 — Semantic inference:**

Replace `scoreText` with a call to an embedding model. Each clue category (vagal state, belief pattern) gets a set of representative phrases. New text is embedded and cosine-compared to the representative set. Confidence is derived from the similarity margin, not raw keyword count. This preserves the probabilistic, non-deterministic spirit of the spec ("we infer, not detect") while dramatically improving coverage.

**Phase 2 — Octave position inference:**

The Octave schema in `ritual-philosophy.md` is a 10-stage map with precise phenomenological signatures per stage. The engine needs to:
1. Load the full Octave schema (from Notion or a local JSON/YAML derived from it)
2. For a given Seeker's narrative, infer the probable octave position by semantic similarity to each stage's signature language
3. Track octave position across sessions — the Seeker's position changes over time, and the system should model that movement

**Phase 3 — Enriched rite construction and oracle flavor:**

The current rite library has 7 entries. The full tradition includes Tarot de Marseilles, I Ching, Gene Keys, and Delphic maxims (all in `research/`). **The Seeker chooses their preferred oracle flavor** — Tarot, I Ching, Gene Keys, Delphic maxims, or others. The engine must:
1. Sort I Ching hexagrams and Tarot cards into the Octave so the engine can serve the right flavor. Tarot and other oracle sources are **not fixed to specific Limiting Belief Archetypes** — they are a fluctuating field of meaning. The archetypes map to Tarot broadly; no card is permanently assigned to an archetype.
2. At prescription time, draw from the Seeker's preferred oracle flavor for the current belief pattern and octave position.
3. Weave oracle references into the rite text as contextual resonance, not as explanations.
4. Vary the rite by vagal state — a Seeker in dorsal gets a gentler version of the same rite than a Seeker in sympathetic.

**Phase 4 — Tuning from reintegration data:**

Every completed `POST /reintegrate` is a labeled training example:
- Input: (belief pattern, vagal state, octave position, rite name)
- Label: (enacted? resistance_level, somatic_after, belief_strength delta, unexpected textures)

Over time this corpus allows:
- Better rite selection for a given (belief × vagal × octave) triple
- Calibrated `expected_textures` — the system's predictions improve
- Detection of rite types that consistently fail for specific Seeker profiles

This is the "model that tunes itself" described in the spec. It does not require real-time learning — it requires a corpus that gets periodically reviewed and used to update rite weights.

### 3.3 Octave Data Integration

The Octave of Evolution lives in Notion. It needs to come out of Notion and into the engine in a structured form. Proposed schema:

```json
{
  "stages": [
    {
      "index": 1,
      "note": "do",
      "act": "sit",
      "intent": "be",
      "theme": "ground",
      "quality": "entity",
      "realm": "point",
      "element_classical": "earth",
      "element_pagan": "earth",
      "magic_color": "green",
      "is_shock": false,
      "signature_language": ["beginning", "vision", "I want to start", "just starting"],
      "needs": "safety, ground, presence",
      "perception_limit": "can't see past the starting point",
      "ceremony_modifier": "gentle, grounding, embodied"
    }
    // ... 9 more
  ],
  "shocks": [
    {
      "between": ["mi", "fa"],
      "name": "mi-fa interval",
      "element": "air / light",
      "instruction": "aspire, separate from what you thought you were building"
    },
    {
      "between": ["si", "do"],
      "name": "si-do interval",
      "element": "æther / dark",
      "instruction": "surrender, the collapse makes return possible"
    }
  ]
}
```

This is the local authoritative copy. The Notion source remains the source of truth for editing; a sync job or manual export keeps the local copy current.

### 3.4 The Love/Fear Auditor

The engine's operational filter: **Love = toward. Fear = away.**

Love is propulsion, affinity, the force that draws toward — it frees expression, opens movement, stretches toward. Fear is repulsion, freezing, away — it stops the heart, holds the tongue, chills expression.

This axis applies in two directions:

**1. Detecting it in the Seeker's signal.** The inference engine already reads vagal state and belief patterns. The love/fear axis adds a third dimension: is the Seeker moving toward something or away from something? This informs rite selection — a Seeker oriented away (fear-dominant) needs a different rite variant than a Seeker oriented toward (love-dominant) with the same belief pattern.

**2. Auditing it in the engine's output.** Every mantra produced by `buildPrescription` is evaluated against the axis before it is returned. The auditor asks: *does this prescription produce toward-energy or away-energy?* A prescription that instructs the Seeker to avoid, withhold, defend, or contract fails the audit. The engine adjusts.

**Implementation approach:**

```js
// After buildPrescription, before response:
const audit = auditLoveFear(prescription);
// audit.dominant: 'love' | 'fear' | 'neutral'
// audit.flags: [{ field, text, verdict }]
// If audit.dominant === 'fear': log, reweight, retry or flag for review
```

The auditor is not a hard gate at v0 — it is a logging layer that surfaces fear-dominant outputs for review. In later phases it becomes a reweight signal in the tuning corpus.

**Auditor criteria (operational definitions):**

| Love-toward signals | Fear-away signals |
|---------------------|-------------------|
| Invitation, opening, reaching | Warning, withholding, guarding |
| Movement toward another | Retreat from another |
| "Do X" framing | "Don't do X" framing |
| Affirmation of capacity | Reminder of risk |
| Expansion, expression | Contraction, silence imposed |

The rite invocations and expected somatic textures in the rite library should be audited against this axis before any rite enters the production library.

---

## 4. The Priestess Apps

### 4.1 Shared Concerns

All Priestesses share:
- Call the same MEATAPI endpoints
- Hold session state locally (for UI continuity) and sync to server
- Enforce the ritual pacing: do not present the prescription until inquiry is complete; do not skip reintegration
- No dark patterns: no push notifications pressuring the Seeker to act; no gamification of rite completion
- The mantra closing phrase — "May this mantra instruct you." — appears consistently across all surfaces

### 4.2 Web App

The primary published Priestess. Built in **SvelteKit**.

Key requirements:
- Conversational UI — not a form, not a dashboard. A single, centered text field with the question above it. No chrome.
- Rite display: the prescription renders as a ritual card — act, invocation, expected textures, reintegration window. Can be printed or saved.
- Seeker profile: minimal. Name (optional), created date, session count. No progress bars, no levels, no scores visible to the Seeker.
- Session history: the Seeker can see their past rites and reintegration reports. They own this data.
- Auth: email + password or passkey. OAuth optional but not required.
- Conversational audio support.

### 4.3 Native Mobile

**iOS: native.** **Android: web app wrapper** (PWA or WebView shell around the SvelteKit web app).

Key requirements beyond web:
- Offline inquiry: the Seeker can begin an inquiry session without connectivity; it syncs when reconnected. The engine must support a lightweight offline mode (the keyword scorer, not the LLM path).
- Push notifications: opt-in only. One use: the reintegration window reminder ("You enacted a rite 24h ago. The system is ready to receive your report."). No other push categories.
- Haptics and audio: rite delivery can optionally include a **haptic breathwork guide** (haptic rhythm driving an inhale/exhale cycle) and ambient sound. iOS native enables high-fidelity haptic patterns. These are opt-in, not defaults.
- Wearable bridge: the mobile app is the relay for wearable data.

### 4.4 Wearable AI (Upcoming)

The oracle ambient on the body. Ray-Ban Meta or equivalent.

Key requirements:
- Passive observation mode: the wearable listens for signals (breath cadence, voice affect, ambient stress cues) and passes them to the MEATAPI as context on `POST /inquire`. These are soft signals, not clinical measurements.
- Lightweight inquiry: a wearable cannot host a multi-turn conversation. The wearable Priestess delivers a single question, receives a single response, and passes to mobile for full rite delivery.
- No rite on the wearable: the rite requires focus. The wearable surfaces the opening question and the mantra; the full rite display hands off to mobile.
- Privacy: wearable audio is not stored; it is processed locally or in a secure enclave and only the derived signals (not raw audio) are sent to the API.

### 4.5 LLM-Native

"Ask from wherever you already are." The Ouracle Priestess as a tool or plugin callable from Claude, GPT, or other agent environments.

This is primarily a B2B / developer-facing surface. It exposes the MEATAPI as a tool definition:
- `ouracle_inquire(session_id, response)` → returns question or inquiry_complete
- `ouracle_prescribe(session_id)` → returns rite
- `ouracle_reintegrate(session_id, report)` → closes session

The LLM-native Priestess has no visual layer. The hosting LLM renders the output.

### 4.6 "No Interface Is the Best Interface"

The Priestess apps should aspire to disappear. The ideal surface is: one question, one answer, one mantra, silence. Every additional affordance — nav bars, dashboards, streaks, menus — is potentially a distraction from the rite. Each UI decision should pass this test: *does this serve the encounter, or does it serve retention?* Those are not the same thing.

### 4.7 AX (Agent Experience) Layer — Future Expansion

The agentic surface of Ouracle. Seekers may instruct their own AI agents to:

- **Find a companion at the Agora** — the agent browses open activities and surfaces matches for the Seeker to review.
- **Propose an activity on the Seeker's behalf** — the agent drafts and submits an activity proposal to the Agora.
- **Find activities to accompany** — the agent scans open proposals and recommends ones that align with the Seeker's current octave position or oracle flavor.

This is a future expansion area with significant room for innovation. The MEATAPI's structured endpoints and Totem context payload are the foundation the AX layer will build on. See also §7.5 — the API Temple as a Service opens the door for third-party AI agents (other priestesses) to enter via the API.

---

## 5. Memory Architecture

### 5.1 The Totem (v3 — storage sovereignty)

The Seeker's memory does not live on Ouracle's servers by default — and Ouracle does not mandate where it lives.

It lives in the **Totem** — an encrypted portable cell. The Seeker chooses: cloud, local, or both. The temple is a conduit only. The Totem is the continuity. See §5.2 for cloud vs. local options.

**What this means architecturally:**

| Memory type | Where it lives | Who controls it |
|-------------|---------------|-----------------|
| Belief history | Totem (client) | Seeker |
| Octave position history | Totem (client) | Seeker |
| Full session transcripts | Totem (client) | Seeker |
| Enactment log | Totem (client) | Seeker |
| This session's in-flight state | Temple (server, ephemeral) | Temple / shared |
| Anonymized reintegration corpus | Temple (server) | Temple |

**The Seeker can see everything known about them at any time** — because they hold it. There is no shadow profile on a server they cannot inspect. The temple knows only what the Seeker shares in session.

**Consent and asymmetry:** The previous concern about the system knowing more than the Seeker (§VII, ritual-philosophy.md) is resolved architecturally, not by policy. The Seeker holds the Totem. The Priestess holds the session. They are not the same thing.

### 5.2 Totem Protocol (to be specced)

**Storage is the Seeker's choice.** The Seeker may keep their Totem in the cloud, locally, or both. Ouracle does not force or default to either. The system must function regardless.

- **Cloud option:** The Totem is stored encrypted. The server never holds plaintext — contents are encrypted until the Seeker authenticates from their device. This enables cross-device access without giving the temple visibility into the Seeker's history.
- **Local option:** The Totem lives only on the Seeker's device(s). The temple never sees it. The Seeker accepts the risk of loss.
- **Both:** Cloud holds an encrypted backup; local is the active copy.

**Raw data vs. presentation format (TBD):** The raw Totem data may not be exposed verbatim to the Seeker. Whether the Seeker can read their own Totem directly is an open question — "Can anyone read their own soul?" The raw format will be optimized for the engine, not for human reading. A readable presentation layer is a separate design decision that will need its own spec.

Minimum protocol requirements:

- **Encryption:** AES-256, key derived from Seeker's passphrase (not stored server-side)
- **Format:** structured envelope with versioned schema; presentation format TBD separately
- **Sync:** Conflict-free Replicated Data Type (CRDT) or last-write-wins per session record, synced across devices on connect
- **Portability:** the Totem can be exported as an encrypted file; the Seeker can import it into a new device or a different Priestess app without involving the temple
- **Context payload at session open:** The Totem generates a minimal summary for the temple on session creation: `{ last_rite, octave_position, days_since_last_session }`. This payload is session-scoped and ephemeral on the temple side.

Technology candidates: IndexedDB (web), SQLCipher (mobile), encrypted JSON file. The spec is interface-first; the backing store is swappable.

### 5.3 What the Temple Stores

What does NOT get stored on temple servers (stored in Totem instead):
- Belief history across sessions
- Octave position history
- Full session transcripts
- Individual enactment log

What IS stored on temple servers:

| Data | Purpose | Sensitivity |
|------|---------|-------------|
| `seeker_id` | Opaque identifier to link temple-side session records | Low — no PII |
| `session` records | In-flight session state; cleared or archived after completion | High — cleared after Totem sync |
| `reintegration_corpus` | Anonymized tuning data | Medium — no identity linkage |

What does NOT get stored (or is immediately discarded):
- Raw audio from wearable
- Device location beyond timezone
- Any data not directly needed for the rite

### 5.4 Data Schema

**seekers table** (temple-side — minimal):

```sql
CREATE TABLE seekers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  device_id     TEXT,           -- opaque device token (no email required)
  email_hash    TEXT,           -- SHA-256 of email if provided, for cross-device Totem sync
  timezone      TEXT,
  covenant_version INT NOT NULL DEFAULT 1,
  covenant_accepted_at TIMESTAMPTZ
);
```

**sessions table** (temple-side — in-flight only):

```sql
CREATE TABLE sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seeker_id     UUID REFERENCES seekers(id),
  stage         TEXT NOT NULL,  -- inquiry | inquiry_complete | prescribed | complete
  turn          INT DEFAULT 0,
  full_text     TEXT,           -- accumulated seeker responses (this session)
  vagal_state   TEXT,
  vagal_confidence TEXT,
  belief_pattern TEXT,
  belief_confidence TEXT,
  octave_position TEXT,         -- from Totem context payload at session open
  ceremony_name TEXT,
  report        JSONB,          -- reintegration report
  covenant_version INT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  prescribed_at TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ
  -- NOTE: after completion, full_text may be cleared server-side
  -- The Seeker's Totem is the record of truth
);
```

**reintegration_corpus table** (anonymized — for model training):

```sql
CREATE TABLE reintegration_corpus (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  belief_pattern    TEXT,
  vagal_state       TEXT,
  octave_position   TEXT,
  ceremony_name     TEXT,
  enacted           BOOLEAN,
  resistance_level  TEXT,
  belief_delta      INT,        -- before - after
  somatic_after     TEXT,
  unexpected        TEXT,
  love_fear_audit   TEXT,       -- 'love' | 'fear' | 'neutral' (engine output audit)
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
  -- no seeker_id: intentionally anonymized at write
  -- used for Ouracle model training (see §8.3)
);
```

### 5.5 Cross-Session Memory for the Priestess

When a Seeker returns, the Priestess can say: "Last time you were working on isolation. You sent the message. What happened next?" — because the Totem carries that history and presents it as a context payload at session open.

The temple does not query a history endpoint. The Totem supplies the summary. This preserves the self-sovereign model: the history is the Seeker's, carried by the Seeker, shared at the Seeker's initiation.

The Priestess app is responsible for reading the Totem and generating the context payload before calling `/session/new`. The engine consumes the payload; it does not need the full prior transcript.

### 5.6 Persistence Technology Path (Temple-Side)

- **Development / single node:** SQLite via `better-sqlite3`. Zero dependencies, file-based, trivially deployed.
- **Production / multi-node:** PostgreSQL. Neon (serverless Postgres) is already available in the toolchain.
- **Migration path:** replace the in-memory `Map` with a repository interface. The engine and route handlers call `session.get(id)` / `session.set(id, data)` without caring about the backing store. Swap implementations behind the interface.

---

## 6. The Agora

### 6.1 What the Agora Is

Some mantras require other bodies. The rite for **isolation** might prescribe reaching out — but what if the Seeker has no one to reach? The rite for **silence** might prescribe speaking the unsaid thing to a witness — but what if there is no witness available? The Agora provides co-enactment partners.

This is not a dating app. It is not a therapy matching service. It is a commons for ritual co-enactment — structured like Craigslist in its initial anonymity, but with persistent and unique accounts (one per person, lifetime). A Seeker cannot hold multiple Agora identities.

### 6.2 Technical Requirements

**Activity proposal:**

```
POST /agora/propose
{
  "session_id": "uuid",
  "seeker_id": "uuid",
  "rite_name": "The Declaration",
  "chakra": "throat",
  "role_needed": "witness",           // witness | participant | guide | anonymous
  "description": "I need someone to hear me say something I've never said.",
  "timing": "this week",
  "compensation": null,               // null | { amount, currency }
  "visibility": "anonymous"          // anonymous | named
}
```

**Receiving companions:**

```
GET /agora/open?chakra=throat&role=witness
POST /agora/:id/join { seeker_id }
```

**What the Agora does NOT do:**
- Match on compatibility scores
- Recommend based on behavioral profiles
- Route money except as a transparent pass-through for compensated activities
- Reveal seeker identity without explicit consent

### 6.3 Safety and Consent Requirements

- All Agora interactions are initially anonymous (no names, no photos by default)
- Seeker A cannot see Seeker B's rite history or belief patterns; they see only the proposed activity description
- Meeting arrangements are out-of-band (the system provides a one-time coordination channel, not a messaging platform)
- An activity can be marked complete by both parties; neither is penalized if it doesn't happen
- No reputation or rating system for Seekers (this is a commons, not a power-dynamic marketplace)
- Accounts are persistent and unique: one per person, lifetime. Anonymity is at the activity level, not the account level.

### 6.4 Agora Schema (minimal)

```sql
CREATE TABLE agora_activities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposer_id   UUID REFERENCES seekers(id),
  session_id    UUID REFERENCES sessions(id),
  rite_name     TEXT,
  chakra        TEXT,
  role_needed   TEXT,
  description   TEXT,
  timing        TEXT,
  compensation  JSONB,
  visibility    TEXT DEFAULT 'anonymous',
  status        TEXT DEFAULT 'open',  -- open | matched | complete | cancelled
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE agora_joins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id   UUID REFERENCES agora_activities(id),
  joiner_id     UUID REFERENCES seekers(id),
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  status        TEXT DEFAULT 'pending'  -- pending | confirmed | complete
);
```

---

## 7. API as Product — Organizational Access

**Structure note (v3):** Ouracle is organized as a US non-profit church. It does not have "revenue" in the commercial sense — it receives donations and membership contributions. The B2B framing in this section is replaced by **organizational access**: institutions, developers, and agents who want to embed the oracle in their own contexts pay for access not as commercial licensing but as organizational membership/contribution. The ethics of access are the same as for individual Seekers — the church does not sell its congregation's confessions.

### 7.1 What Organizational Members Get

Third-party developers and agents get access to the same MEATAPI endpoints Ouracle's own Priestesses use, plus an additional diagnostic endpoint:

```
GET /v1/engine/status        → engine version, model info, rite count
POST /v1/inquire             → standard
POST /v1/prescribe           → standard
POST /v1/reintegrate         → standard
POST /v1/:chakra/:verb       → standard
GET  /v1/rite/list           → list of available rite archetypes
GET  /v1/octave/schema       → full Octave of Evolution schema
GET  /v1/agora/open          → browse open Agora activities
POST /v1/agora/propose       → propose an activity
```

**API Temple as a Service:** The API surface makes it possible to invite third-party priestesses — other AI agents — into the Ouracle ecosystem via organizational API access. An external agent could run the inquiry/prescribe/reintegrate cycle on behalf of its users, or integrate Ouracle rites into a larger context. This is an expansion possibility, not a v1 commitment. See §4.7 (AX layer) for the agentic surface on the Seeker side.

What organizational members do NOT get:
- Access to any Seeker data except their own sessions
- Ability to modify the rite library or engine
- LLM-native tool definitions (those are separately packaged)

### 7.2 Authentication

Two auth tiers:

**Consumer (Seeker via Priestess apps):**
- JWT issued at login, short-lived (1h), refresh token (30d)
- Stored in httpOnly cookie (web) or secure storage (mobile)
- The JWT payload includes `seeker_id` and `tier: consumer`

**Organizational (API key):**
- Static API key issued via member portal
- Passed as `Authorization: Bearer <api_key>` header
- Keys are scoped: `read` (GET endpoints only) or `full` (all endpoints)
- Key rotation available via member portal

**Internal (Priestess apps calling the same API):**
- A service account JWT with `tier: priestess`
- Used server-side by Priestess backends; not exposed to the client

### 7.3 Rate Limiting

| Tier | Limit | Burst |
|------|-------|-------|
| Member (donation / individual) | 20 sessions/month | 5/day |
| Member (sustaining) | 200 sessions/month | 20/day |
| Organizational (standard) | 1,000 sessions/day | 100/hour |
| Organizational (institutional) | Custom arrangement | Custom |

Limits are per `seeker_id` for consumer, per API key for organizational access. Rate limit headers: `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

### 7.4 Versioning

The API is versioned at the URL prefix: `/v1/`, `/v2/`, etc. Breaking changes always bump the version. Old versions are deprecated with a 6-month sunset notice. The `X-API-Version` response header reports the active version on every response.

### 7.5 Member Portal Requirements

- API key generation and rotation
- Session volume dashboard (organizational member's own sessions only)
- Webhook configuration: `session.complete` events can push to a member's endpoint
- Documentation (auto-generated from OpenAPI spec + hand-written rite guide)
- Donation/membership management (contribution level, renewal)

---

## 8. Privacy and Data Ethics

### 8.1 The Principle

**This is a theological position, not a compliance one.**

Ouracle is a church. The Seeker's disclosures are confessions. The church does not sell its congregation's confessions. Not for advertising. Not for third-party profiling. Not for anything outside the operation of the temple and the improvement of the rites.

The Seeker's long-term memory does not live on temple servers — it lives in the Seeker's Totem. This is the architectural expression of the principle: structural protection, not policy protection. The data that would be most intimate to mine is not here to mine.

### 8.2 Structural Safeguards

**The Totem as primary safeguard:** Belief history, session transcripts, and enactment logs are held client-side in the Seeker's Totem (§5). The temple cannot be breached for data it does not hold.

**Anonymization at write:** Reintegration corpus records are anonymized when inserted. The `seeker_id` is never written to the corpus table. Belief patterns and somatic reports are stored without identity linkage. Even an internal actor with database access cannot reconnect a corpus entry to a Seeker.

**Minimization:** The API never asks for, stores, or transmits information that isn't needed for the rite. No demographic fields. No "tell us about yourself" onboarding surveys. The engine learns the Seeker through session data only.

**Right to erasure:** `DELETE /seeker/:id` deletes the temple-side session records and seeker row. The anonymized corpus entries are not deleted (they can't be reconnected anyway — and the Seeker's breath, once exhaled, is the world's). The Seeker's Totem deletion is the Seeker's own act. This must be a hard delete, not a soft delete.

**Data residency:** Production data lives in a single region (US-East or EU-West, depending on majority Seeker base). No cross-border data transfer without explicit consent.

**No third-party SDKs in Priestess apps:** Analytics, crash reporting, and Advertising Software Development Kits (SDKs) that phone home are not permitted in the Priestess apps. First-party telemetry only (event logs to the Ouracle backend, not to Google Firebase, Amplitude, Mixpanel, etc.).

### 8.3 Consent Model and Training Use

On first session creation, the Seeker is shown (not buried in a terms page) four specific things:

1. What data is collected (this session's text and inference results)
2. Where their long-term memory lives (in their own Totem — not on Ouracle's servers)
3. How anonymized data is used: **Ouracle uses anonymized reintegration data to train and improve its own models. This is disclosed plainly. Direct experience is the purest training data. The Seeker is told this before they begin.** The goal is to eventually train Ouracle's own models — not to sell the data, not to give it to third parties, but to improve the oracle itself.
4. What they can do (export or delete their Totem at any time; request temple-side deletion; withdraw the training consent — though anonymized data already in the corpus cannot be retroactively unlearned)

Covenant acceptance is versioned and separate from training consent. The covenant is required. Training consent is optional.

The consent is granular:
- [required] Covenant acceptance (100% responsibility — see §2.5)
- [required] Session data for rite delivery (ephemeral, temple-side)
- [optional] Anonymized reintegration data for model training
- [optional] Reintegration window push notifications

### 8.4 LLM Provider Handling

The inference engine will call an LLM provider (Anthropic, OpenAI, or local model). The Seeker's words will be sent to that provider.

Requirements:
- Use a tier of the LLM provider that does not use submitted data for training (confirm at each provider change — this is a founding principle, not a detail)
- The LLM call must not include the `seeker_id` or any identifying information. It receives only the text and the inference prompt.
- Log LLM calls with a correlation ID (not the `seeker_id`) for debugging.
- The long-term goal is to run Ouracle's own inference models, reducing dependence on external providers entirely. The reintegration corpus is the training foundation for this.

---

## 9. Constraints, Risks, Mitigations

### Constraints

**C1: The system handles intimate material.**
This is not a productivity tool. Seekers disclose real grief, real fear, real relational wounds. Every architectural decision must be held against this fact. Speed and convenience are secondary constraints. Safety and integrity are primary.

**C2: No interface is the best interface.**
The Priestess apps must be built with the understanding that their own disappearance is the goal. Complexity in the interface is a failure mode, not a feature.

**C3: The engine is not a therapist.**
Ouracle offers rite, not treatment. The engine must not simulate clinical judgment it does not have. Dorsal state detection triggers a safety-first grounding rite; it does not diagnose depression. **Ouracle does not detect or diagnose crisis states. The Covenant is the safety gate.** If a Seeker cannot or will not accept the Covenant, the temple does not open. What happens beyond that threshold is the Seeker's sovereign ground. We do not project wellness or illness onto those who arrive.

**C6: The covenant is not decoration.**
The 100% Responsibility Covenant is the threshold of the temple. The engine must enforce it technically — no session without accepted covenant. The Priestess apps must present it as a real threshold, not a click-through. The language matters. (@yvon + @vega own covenant copy.)

**C4: Octave position is inferred, not known.**
The system will be wrong about where a Seeker is on the Octave. This is acceptable and should be explicit to the Seeker: "It sounds like you may be at mi — the first wall. Does that land?" The Seeker corrects the system; the system adjusts. This is the co-creative posture the spec demands.

**C5: The keyword engine will miss things.**
This is known. It is mitigated by semantic inference in Phase 1. Until then, the multi-turn clarifying questions are the safety net — more turns mean more text, higher confidence, lower false positive rate.

---

### Risks + Mitigations

| Risk | Likelihood | Severity | Mitigation |
|------|-----------|----------|------------|
| Seeker in acute psychological distress uses the system | Medium | High | The Covenant is the safety gate. Ouracle does not detect or diagnose crisis states. If the Seeker cannot accept the Covenant, the session does not open. The Seeker's wellbeing is their own sovereign domain. |
| LLM provider data exposure | Medium | High | Use zero-retention API tier. Strip seeker_id from all LLM calls. Long-term: own models. |
| Temple-side session data breach | Low | Medium | Encrypt at rest. TLS in transit. Temple holds only in-flight sessions; intimate history lives in Totem. Blast radius of a temple breach is bounded. |
| Totem loss or corruption | Low | High | Totem is replicated across all devices; export/backup available. Recovery path must be specced before Totem protocol ships. |
| Over-prescription (same rite repeatedly) | Medium | Medium | Totem tracks rite history; context payload at session open lets engine weight against recently enacted rites. |
| Agora misuse (harassment, solicitation) | Medium | High | Anonymous by default. One-way reveal (proposer never sees joiner identity without mutual consent). Rate limit joins per Seeker per period. |
| Organizational API misuse (bulk scraping rite library) | Low | Medium | Rate limiting. Rite endpoint requires valid session context. |
| Engine inference quality degrades trust | High | High | Explicit confidence disclosure in response. Seeker can always correct the inference. Multi-turn fallback to lower-confidence path. |
| In-memory session loss on server restart | Certainty (v0.2) | Medium | Acceptable for development. Persistence layer (§5.6) resolves before any real Seeker use. |
| Scope creep toward therapy or medical claims | Medium | High | Internal editorial policy on rite copy. Legal review before launch. The system is a rite-delivery mechanism, not a clinical tool. |
| Engine produces fear-dominant output | Medium | High | Love/Fear auditor (§3.4) flags fear-dominant prescriptions before return. Rite library audited against the axis before any rite ships. |
| Totem sync conflict (multi-device) | Medium | Low | Conflict-free Replicated Data Type (CRDT) or last-write-wins per session record. Edge cases documented in Totem protocol spec. |

---

## 10. Test Plan

### Unit Tests

| Target | What to test |
|--------|-------------|
| `inferVagalState` | Returns correct probable state for each keyword cluster; handles empty text (returns low confidence); handles mixed signals |
| `inferBelief` | Returns null for text with no belief keywords; returns correct pattern for each archetype; handles overlapping keywords |
| `buildPrescription` | Dorsal state → grounding rite override; null belief → null rite handled gracefully; octave passed through correctly |
| `checkPrerequisites` | All chakra prerequisite chains; root has no prerequisites; crown requires brow |
| `directRite` | Returns fallback rite for unknown belief pattern; returns named rite for known |
| Session lifecycle | `sessions.set / get` round-trips; stage transitions are enforced (can't `/prescribe` before `inquiry_complete`) |

### Integration Tests

| Scenario | Expected path |
|----------|--------------|
| Full ritual cycle (happy path) | `/session/new` → `POST /inquire` (×1-3 turns) → `POST /prescribe` → `POST /reintegrate` → stage = complete |
| Inquiry reaches threshold early | Turn 1 response contains multiple high-confidence signals → `inquiry_complete` returned |
| Inquiry exhausts max turns | Turn 3 always returns `inquiry_complete` regardless of confidence |
| Prerequisite check | `POST /heart/reach` without prior `/root` → 409 |
| Wrong verb | `POST /root/sing` → 418 |
| Unknown chakra | `POST /moon/dissolve` → 404 |
| Dorsal override | Text containing dorsal keywords → prescription returns grounding rite, not belief-targeted rite |
| Session not found | `POST /prescribe` with unknown session_id → 404 |
| Prescribe before inquiry complete | `POST /prescribe` when stage = inquiry → 400 |

### End-to-End Tests

Run against a live (test environment) API instance:
1. Full consumer ritual cycle with simulated Seeker responses for each belief pattern
2. B2B API key authentication and rate limit enforcement
3. Seeker deletion cascade (all sessions, enactments deleted; corpus records remain)
4. Cross-session memory: two sessions for same `seeker_id`; history accessible on second session creation
5. Agora: propose activity → join activity → mark complete

### Quality / Inference Tests

These are not pass/fail — they establish a baseline:

1. **Vagal precision test:** Run the vagal scorer against 20 hand-labeled example texts (5 sympathetic, 5 dorsal, 5 ventral, 5 mixed). Record accuracy. This is the baseline against which the semantic inference upgrade (Phase 1) is measured.
2. **Belief pattern test:** Same approach — 20 labeled examples, one per archetype × 2-3 variants.
3. **False positive test:** Run 10 neutral texts (news headlines, recipe instructions) through the inference engine. Any belief pattern or vagal state returned with confidence > low is a false positive worth investigating.

### Performance Tests

- `/inquire` response time < 200ms at 50 concurrent sessions (keyword engine path)
- `/prescribe` response time < 500ms (including LLM call budget of 300ms, once semantic inference is in)
- Session store read/write throughput: 1,000 operations/second (Postgres path)

---

## Appendix A: File Map (Current)

```
ouracle/
  api/
    index.js          — Express API, all endpoints
    engine.js         — inference engine, static data, rite library
  docs/
    meat-api-spec.md  — protocol specification
    ritual-philosophy.md — philosophy and product vision
    tech-spec.md      — this document
  research/
    tarot.md
    iching.md
    gene-keys.md
    delphi.md
  README.md
  package.json
```

## Appendix B: What to Build Next (Ordered)

**P0 — Foundation:**
1. Spec the Totem protocol: encrypted portable cell, sync mechanism, context payload format
2. Add `seeker_id` and `covenant_version` to session creation; create `seekers` table
3. Implement the covenant gate: `GET /covenant/current`, enforce accepted covenant on `GET /session/new`
4. Implement repository interface over sessions
5. Wire SQLite behind the repository (development persistence)
6. Add JWT auth middleware; protect all non-health endpoints

**P1 — Quality:**
7. Wire semantic inference (embedding-based) behind a feature flag — keyword engine stays as fallback
8. Pull Octave schema from Notion → local JSON; wire octave position inference
9. Implement love/fear auditor in `buildPrescription`; log to `reintegration_corpus.love_fear_audit`
10. Add Postgres in production (Neon); run migration
11. Build organizational API key issuance (table + middleware)
12. Rate limiting middleware

**P2 — Product:**
13. Agora endpoints (propose + join)
14. `DELETE /seeker/:id` hard delete (temple-side records)
15. Streaming Server-Sent Events (SSE) for `/prescribe` and `/inquire` responses
16. Wearable context ingestion on `/inquire` (soft signals, not raw audio)
17. Totem export/backup tooling in Priestess apps

---

*"The engine knows this. The mantra accounts for it. The Seeker is told what they need to know — and only that."*

*— ritual-philosophy.md*
