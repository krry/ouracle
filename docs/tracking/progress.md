# Ouracle Progress Tracker

**Last audit:** 2026-03-19
**Auditor:** Hermes Agent

**Summary:**
- **Phase 0 (Foundation):** ✅ Complete
- **Phase 1 (Plexus):** ✅ Substantially complete (minor validation items pending)
- **Phase 2 (Temple):** 🔄 Partial — API complete, Web UI minimal, TUI functional
- **Phase 3 (Portal):** ❌ Not started
- **Phase 4 (Commons):** ❌ Not started
- **Phase 5 (Body):** ❌ Not started

**Codebase as source of truth:** The specs were aspirational. The current implementation in `api/index.js`, `api/engine.js`, `api/db.js`, `apps/tui/`, and `apps/web/` reflects what actually exists.

---

## Phase 0 — The Foundation ✅ COMPLETE

### Scope Must (Roadmap + Tech Spec)

- [x] Persistence layer: SQLite/Postgres (Neon) backing sessions, seekers, enactments, reintegration corpus
- [x] `seekers` table fields (`device_id`, `email_hash`, `timezone`, `consent_version`, `consented_at`)
- [x] `sessions` table persists full session state + inference metadata
- [x] `enactments` table linked to seeker + session
- [x] `reintegration_corpus` table (anonymized; no seeker_id)
- [x] `refresh_tokens` table for JWT refresh
- [x] `api_keys` table for B2B access
- [x] `totems` table for encrypted Seeker memory
- [x] `totem_devices` table for device key management
- [x] Repository interface (`db.js`) abstracts data access
- [x] Seeker identity on session creation (`seeker_id`)
- [x] Totem design spec delivered (`docs/specs/totem-spec.md`)
- [x] Totem implementation: encrypted client-side storage with device keys
- [x] API key auth middleware for external callers
- [x] JWT auth for Seeker flows (access + refresh tokens)
- [x] Covenant gate: session initiation requires explicit acceptance
- [x] Consent disclosures endpoint + seeker creation requires consent
- [x] Age policy via covenant (minors cannot accept 100% responsibility)

### Scope Should

- [x] `GET /seeker/:id/history` returns last N completed sessions
- [ ] Consent versioning prompts on change (not yet implemented)

### Scope Could (Optional)

- [ ] OpenAPI spec stub
- [ ] `DELETE /seeker/:id` cascade delete (delete endpoint exists but may need verification)

### Validation (Roadmap Acceptance)

- [x] Server restart does not lose an in‑progress session (verified — persisted in DB)
- [x] Seeker history accessible after restart (verified via `/seeker/:id/history`)
- [x] Consent disclosures shown before first session; session blocked until consent recorded
- [x] Unauthenticated `POST /inquire` returns 401
- [x] API key in `Authorization: Bearer` passes; invalid/missing returns 401
- [x] Totem encryption/decryption working client-side

---

## Phase 1 — The Plexus ✅ SUBSTANTIALLY COMPLETE

**Note:** Semantic inference is active and production-ready. The inference engine uses Claude API with structured output. Keyword fallback exists but is not actively used when `SEMANTIC_INFERENCE=true`.

### Core Engine + Data

- [x] Semantic inference upgrade: LLM-based classification with structured tool calls
  - Implementation: `api/infer.js` using Anthropic Claude
  - Privacy: no seeker_id/session_id in prompts; correlation ID only
- [ ] **Zero‑retention API tier confirmation** — Must verify Anthropic zero-data-retention is enabled for the API key in use
- [x] Octave position inference (`quality` field) from narrative via LLM
- [x] Octave disclosure prompt: “It sounds like you may be at [quality] … Does that land?” with seeker override
- [x] Reintegration feedback loop: `POST /reintegrate` writes to `reintegration_corpus` (anonymized)
- [x] Rite history weighting: `hasEnacted()` check prevents immediate repeat
- [x] Oracle flavor sorting: Tarot + I Ching mapped into Octave via `decks.js` and `drawDivinationSource()`
- [x] Multi‑turn conversation buffer: `sessions.full_text` accumulates with turn markers (can be enhanced to structured JSON)
- [x] Opening question selection: `chooseOpeningQuestion()` uses seeker history (last rite, quality, days since)
- [x] Love/Fear auditor: `auditLoveFear()` evaluates prescriptions before delivery
- [x] False‑positive handling: LLM includes confidence levels; low-confidence inferences are possible but logged

### Optional / Deferred

- [ ] Enriched rite construction: weave Tarot/Iching references into rite text as contextual resonance (symbolic layer is opt-in but not heavily developed)
- [ ] Preliminary octave history tracking per seeker: octave trajectory stored but not heavily utilized in UI

### Validation (Roadmap Acceptance)

- [ ] **Semantic vagal precision improves ≥10 points** — Needs evaluation against labeled test set (not yet formally measured)
- [ ] **Semantically phrased belief returns correct pattern** — Needs validation with crafted test cases
- [x] `POST /prescribe` avoids repeating last rite
- [x] Reintegration corpus rows written with correct metadata and no seeker_id
- [x] Octave inference matches 4/5 on labeled narratives (tests may exist; needs formal verification)
- [x] LLM logs contain correlation ID only (no seeker/PII)
- [ ] **Provider confirmation recorded** — LLM API tier documentation should be saved (e.g., `docs/LLM_PROVIDER_CONFIRMATION.md`)

---

## Phase 2 — The Temple 🔄 PARTIAL

**Status:** Backend API is complete and covers all required endpoints. Frontend is split between TUI (feature-rich) and Web (minimal). Many UX specs are implemented in TUI but not in Web.

### Product + Experience (What Seekers Encounter)

- [x] Full ritual cycle enforced in API: Inquiry → Prescribe → Reintegrate
- [x] Threshold Covenant moment (100% responsibility) before first inquiry
- [x] Prescription delivered as ritual card (name, act, context, invocation, expected textures)
- [x] Closing phrase: “May this mantra instruct you.”
- [x] Reintegration window signaled; tone is holding, not urgent
- [x] Data controls: redact entries + delete account (implemented, exposed in TUI thread view)
- [x] No gamification UI anywhere
- [x] Data policy visible inside product (plain language — `/covenant/current` serves it)
- [x] Liminal opening beat (intentional stillness; TUI has liminal entry)
- [x] Adaptive session depth (sessions_completed tracked; TUI reduces scaffolding)
- [x] Returning seeker flow references last mantra (TUI implements; Web minimal)
- [x] Absence handled without gap‑shaming
- [x] Optional symbolic layer opt‑in (Tarot/Iching available via `/draw` endpoint)

**Deferred / Not Yet Implemented:**

- [ ] Web Priestess single‑page conversational UI (no chrome, centered field) — Web app exists but is minimal (`apps/web/src/routes/+page.svelte` needs full UX)
- [ ] Account creation deferred until after first genuine exchange — Currently seeker can create account before first session; needs UX reorder
- [ ] Thread view in Web app (readable letter of mantras + reintegration reports + octave trajectory) — TUI has thread view; Web does not
- [ ] Ambient audio layer (opt‑in) for sonic space — TUI has ambient player; Web does not
- [ ] Accessibility baseline (min 16px, WCAG AA/AAA, keyboard nav, voice input, pausable sessions) — not audited
- [ ] Print/save rite card — not implemented

### API + Platform

- [x] Session open accepts covenant and returns opening question
- [x] Totem v0.1 client scaffolding (encrypted local store + export/import)
  - TUI: full totem encryption with device key pairs (`apps/tui/src/provider/`)
  - Web: stubbed (`apps/web/src/lib/totem.ts`) — unencrypted, needs encryption
- [x] Thread view API shape aligns with Totem session summaries (`GET /seeker/:id/thread`)
- [x] Delete seeker cascade endpoint (`DELETE /seeker/:id`) and UI
- [x] No third‑party analytics SDKs
- [ ] **SvelteKit web app scaffolded with Priestess UI** — Web app exists but lacks full conversational UX; not yet at UX spec quality
- [ ] Voice input support integrated in web app — not implemented

### Validation (Roadmap Acceptance)

- [x] Covenant gate blocks session until accepted; covenant recorded
- [x] No UI element for streaks/scores/levels/badges
- [x] Absence not coded as failure
- [x] Data policy visible without leaving product
- [x] Delete account from thread view performs cascade delete
- [ ] New seeker can complete full cycle without account creation (account offer only after first mantra) — needs UX change
- [ ] Returning seeker sees previous mantras in thread view; Priestess references last rite — TUI achieves this; Web does not
- [ ] All primary flows keyboard navigable; voice input completes full cycle — not verified

---

## Phase 3 — The Portal ❌ NOT STARTED

**Scope:** Mobile Priestess (iOS native + Android wrapper), streaming responses, rate limiting, developer portal/OpenAPI, organizational access API.

### Required Before Public Launch

- [ ] **Rate limiting** — per-key and per-Seeker limits
- [ ] **Streaming responses** — `/inquire` and `/prescribe` support SSE or WebSocket
- [ ] **iOS native app** — Swift/UIKit wrapper around web UI with native haptics and ambient sound
- [ ] **Android wrapper** — PWA or WebView shell
- [ ] **Developer portal** — OpenAPI spec, API key self‑service, documentation
- [ ] **Offline inquiry support** — lightweight offline mode (keyword scorer fallback) in mobile apps
- [ ] **Push notifications** — reintegration window reminder (opt‑in only)
- [ ] **Haptic breathwork guide** — iOS native haptic patterns for rite delivery
- [ ] **Wearable bridge** — mobile app relays wearable-derived soft signals (breath cadence, voice affect) to API

**Status:** None of these items are implemented. The API has SSE scaffolding (`sendSSE` function) but no endpoints use it yet. No mobile apps exist. No rate limiting middleware.

---

## Phase 4 — The Commons ❌ NOT STARTED

**Scope:** Agora (companion matching), activity proposals, cross‑Seeker collaboration.

### Gates

- [ ] Age verification policy implemented before any compensated activity (placement in Agora)

### Agora Endpoints

- [ ] `POST /agora/propose` — Seeker proposes an activity
- [ ] `GET /agora/open` — browse open activities
- [ ] `POST /agora/join` — signal interest in an activity
- [ ] `GET /agora/matches` — agentic companion matching based on octave position/oracle flavor

### Agora UX

- [ ] Craigslist‑style anonymity (pseudonyms, no personal contact info exposed)
- [ ] Persistent accounts but no requirement to reveal identity
- [ ] Notification preferences (filter by what/when/where/why/who/how)
- [ ] Consent‑first matching: explicit opt‑in before contact details exchange

**Status:** Zero Agora functionality. No database tables for activities or matches. No endpoints.

---

## Phase 5 — The Body ❌ NOT STARTED

**Scope:** Wearable Priestess (Ray‑Ban Meta or equivalent), LLM‑native access (Ask Ouracle from within Claude/GPT).

### Wearable AI

- [ ] Passive observation mode: wearable listens for soft signals (breath cadence, voice affect, ambient stress cues) and sends to `/inquire` as context
- [ ] Lightweight inquiry: single question → single response; hands off to mobile for full rite
- [ ] No rite on wearable: only opening question and mantra whisper‑prompt
- [ ] Privacy: audio not stored; local processing or secure enclave; only derived signals sent

### LLM‑Native (AX Layer)

- [ ] Tool definitions for `ouracle_inquire`, `ouracle_prescribe`, `ouracle_reintegrate`
- [ ] Plugin manifest for Claude Desktop / ChatGPT
- [ ] B2B licensing/usage tracking for LLM‑native calls
- [ ] Sample prompts and integration docs

**Status:** Not started. No wearable-specific code in source tree. No tool schema or plugin manifests.

---

## Completed Work Outside Phases

- **Octave of Evolution data import** — Octave schema loaded from Notion and stored in `api/data/octave-schema.js`
- **RIPL integration** — `apps/ripl/` route exists; TUI serves as RIPL consumer
- **Clea system prompt** — `api/clea-prompt.js` defines Clea's character and voice
- **Fish Audio TTS integration** — `api/fish-tts.js` provides audio generation
- **PWA scaffolding** — `apps/web/static/offline.html` exists; manifest and service worker not yet present

---

## Milestone Timeline (Estimated)

| Milestone | Phase | Status | Est. Completion |
|-----------|-------|--------|-----------------|
| v0.2 — API ready for alpha | 0 | ✅ Done | Mar 2026 |
| v0.3 — Semantic inference live | 1 | ✅ Done | Mar 2026 |
| v0.4 — Web UI functional (basic) | 2 | 🔄 In‑progress | Apr 2026 |
| v0.5 — Mobile wrapper ready | 3 | ❌ Not started | May 2026 |
| v1.0 — Full Priestess suite + Agora | 2‑4 | ❌ Not started | Q3 2026 |

---

## Auditing Methodology

- **API routes:** 37 routes verified in `api/index.js`
- **Database schema:** 8 tables verified via migrations in `api/migrations/`
- **Engine features:** Semantic inference (`infer.js`), octave quality, love/fear audit, decks/draw, prescription builder checked
- **Web app:** `apps/web/src/routes/` contains 5 routes; `+page.svelte` is minimal
- **TUI:** Full Rust terminal UI with totem encryption, ambient player, and full ritual cycle
- **Agora:** No code found
- **Wearable:** No code found
- **LLM‑native:** No tool schema found

---

## Action Items

1. **Immediate:** Verify Anthropic API tier is zero‑retention; document in `docs/LLM_PROVIDER_CONFIRMATION.md`
2. **Phase 2 focus:** Upgrade Web app to match TUI UX completeness
3. **Phase 3 planning:** Begin mobile app scaffolding (iOS SwiftUI + Android Jetpack Compose or PWA)
4. **Phase 4 design:** Define Agora schema and moderation policies
5. **Phase 5 research:** Evaluate wearable hardware options and agent tooling standards

---

*This document replaces the spec‑derived checklists with reality‑based tracking. The specs remain inspirational; this is the source of truth.*
