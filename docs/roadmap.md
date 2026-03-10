# Ouracle Roadmap

**Status:** Living document — v3.0
**Date:** 2026-03-09
**Author:** Prince 🎵 (Product Conductor)
**Reviewed against:** `ritual-philosophy.md`, `tech-spec.md`, `ux-spec.md`, `meat-api-spec.md`, `api/index.js`, `api/engine.js`

---

> *The groove is the plan. Not because it sounds good — because it's the only sequence that works.*

> *This is not a business. It is a portal. The roadmap serves the portal. — Vega 🌟*

---

## Where We Stand

Today: a working Express API on port 3737. Seven rites. Five opening questions. Keyword-based inference that scores text against lists. In-memory sessions that die on restart. No auth. No persistence. No identity.

It runs. It completes the three-stage loop. It returns something real. That's what we protect.

What we do not have: anything a Seeker would trust, return to, or bring their inner life to. The gap between "it runs" and "it's ready" is exactly what this roadmap closes — in order, without skipping steps, without shipping what isn't safe.

**Ouracle is organized as a non-profit church under US law (501(c)(3) or equivalent religious organization structure).** This is not a commercial product seeking revenue. It is a portal seeking Seekers. The language in this roadmap reflects that: where v1 said "revenue-ready," this document says "donation/membership-ready." Where v1 said "B2B licensing," this document says "organizational access." Legal entity formation follows proof of concept — the idea proves itself before the legal structure formalizes around it.

---

## The Sequence at a Glance

| Phase | Name | What it unlocks |
|-------|------|----------------|
| **0** | The Foundation | Real persistence, identity, auth — nothing else works without this |
| **1** | The Plexus | Semantic inference, octave positioning, reintegration loop — quality worthy of trust |
| **2** | The Temple | Web Priestess — first complete Seeker experience end-to-end |
| **3** | The Portal | Mobile Priestess, streaming, organizational access API, rate limiting — membership-ready and open |
| **4** | The Commons | Agora, companion matching, activity proposals — the fire in the center |
| **5** | The Body** | Wearable Priestess, LLM-native access — the oracle ambient and everywhere |

**Phase 5 is sequenced but not scoped in this document. It requires wearable hardware decisions outside the current build scope.

---

## Phase 0 — The Foundation

**What it achieves:** Sessions persist across restarts. Seekers have identity across sessions. The API is authenticated. The system is safe to turn on for a small group of known humans.

**Why it's first:** Everything downstream assumes persistence. The semantic engine needs stored history to improve. The Priestess needs cross-session memory to remember who she's talking to. None of it works on a `Map` that resets on `node restart`.

**Timeline target:** Before any external access. Internal and invited use only during this phase.

---

### Scope

**Must:**
- Persistence layer: replace in-memory `Map` with SQLite (single-node, development/early production)
- `seekers` table: `id`, `device_id`, `email_hash`, `timezone`, `consent_version`, `consented_at` — per the schema in `tech-spec.md §5.2`
- `sessions` table: links sessions to `seeker_id`, persists full session state including inference results
- `enactments` table: links enacted rites to `seeker_id` across sessions
- Repository interface: `session.get(id)` / `session.set(id, data)` abstraction over the store — so the implementation can swap from SQLite to Postgres without touching route handlers
- Seeker identity on session creation: `seeker_id` passed or minted; linked to the session
- **The Totem — client-side Seeker memory:** The Seeker's memory cell is self-sovereign and client-local. The Totem is an encrypted store on the Seeker's device, portable across devices via a Seeker-held key. The server does not hold the Seeker's narrative memory — it holds only the session index (rite name, date, octave position, enacted flag). The full thread lives in the Totem. This is an architecture decision with downstream implications: the persistence layer for Seeker memory is client-side, not server-side. The server is a rite engine and a session ledger. The Totem is the Seeker's. Design spec: encrypt-at-rest on device, export/import via Seeker-held passphrase, sync across devices via end-to-end-encrypted channel with no server access to plaintext. Full Totem design is a Phase 0 deliverable; implementation gates Phase 2 (the web Priestess cannot ship without it).
- API key auth for any external caller (even if it's a table and middleware, not a portal)
- JWT auth middleware for consumer path: short-lived token (1h), refresh token (30d); `seeker_id` in payload
- Consent model on first session: three specific disclosures shown before first inquiry (what is collected, how it's used, what the Seeker can do about it) — not buried in terms, visible in the product
- `reintegration_corpus` table: anonymized at write, `seeker_id` never written to it
- **Age policy:** Initially adults only. The Threshold Covenant is where age is declared and affirmed — not a technical gate, a covenant gate. The Seeker accepts full responsibility for their actions upon entry; a minor cannot accept that responsibility independently. @wesley's research informs the long-term policy; for now the Covenant handles it simply and cleanly.

**Should:**
- Postgres migration path: Neon connection config ready behind an environment variable; the repository interface switches implementations without code changes
- `GET /seeker/:id/history`: returns last N completed sessions (rite name, octave position, enacted flag, date) — no full transcript
- Consent versioning: if consent model changes, existing Seekers prompted on next login

**Could:**
- OpenAPI spec stub for the full v1 surface (useful now; required before B2B launch)
- `DELETE /seeker/:id` cascade: hard delete of sessions, enactments, history; corpus records remain (they can't be reconnected anyway)

---

### Acceptance Criteria

- Server restart does not lose an in-progress session
- A Seeker who completes a session, restarts the server, and creates a new session with the same `seeker_id` has their rite history accessible via `/seeker/:id/history`
- A first-session request includes visible consent disclosure; the session is not created until consent is recorded in the `seekers` table
- An unauthenticated `POST /inquire` returns 401
- A B2B API key in the `Authorization: Bearer` header passes; a missing or invalid key returns 401

---

### Not in this release

- Semantic inference (that's Phase 1)
- Octave position inference from narrative (Phase 1)
- Rate limiting (Phase 3)
- Streaming responses (Phase 3)
- Agora (Phase 4)
- Any public-facing UI
- The developer portal (scaffolded in Phase 3)

---

## Phase 1 — The Plexus

**What it achieves:** The inference engine becomes semantically capable. The system can locate a Seeker on the Octave from their narrative. The reintegration report feeds back into the engine. Quality crosses the threshold where the prescription is genuinely surprising — not just pattern-matched from a keyword list.

**Why it follows Phase 0:** Semantic inference calls an LLM provider. That provider will receive the Seeker's words. The data privacy constraints (no `seeker_id` in LLM calls, zero-retention API tier confirmed before use) must be architecturally enforced. That enforcement requires the session layer from Phase 0. The plexus cannot be safely wired in before the body has walls.

**Timeline target:** Private alpha eligible at the end of this phase. 5–10 Seekers. No public access.

---

### Scope

**Must:**
- Semantic inference upgrade: replace `scoreText()` keyword matching with embedding-based cosine similarity; each vagal state and belief pattern gets representative phrases; confidence derived from similarity margin, not keyword count — behind a feature flag with keyword scorer as fallback
- LLM call isolation: the inference prompt receives only text, no `seeker_id`, no identifying information; all LLM calls logged with a correlation ID (not the `seeker_id`) for debugging
- LLM provider tier confirmed: zero-data-retention API tier in use before any Seeker data is sent; documented in the deployment config
- Octave position inference: pull Octave schema from Notion → local JSON (the schema in `tech-spec.md §3.3`); infer probable octave position from Seeker narrative by semantic similarity to each stage's signature language; store in `sessions.octave_position`
- Octave position disclosure to Seeker: "It sounds like you may be at mi — the first wall. Does that land?" — Seeker can confirm or correct; system adjusts
- Reintegration feedback loop: completed `POST /reintegrate` records land in the `reintegration_corpus` table (anonymized at write per Phase 0 schema); corpus is reviewable; rite weights are adjustable
- Rite history weighting: track rites enacted per `seeker_id`; weight against recently enacted rites to prevent over-prescription of the same rite
- Inference quality baseline: run vagal precision test (20 hand-labeled texts) and belief pattern test (20 hand-labeled texts) before and after upgrade; document the delta — this is the baseline against which future improvements are measured
- Oracle flavor sorting: process the I Ching hexagrams and Tarot cards and sort them into the Octave of Evolution — so the engine can serve a Seeker's preferred oracle flavor; this is the work of making the magic gem multi-faceted; output is a local JSON lookup table mapping hexagram/card to octave position, quality vector, and resonance notes; the symbolic layer opt-in in Phase 2 ("Could") depends on this being done first

**Should:**
- Multi-turn conversation buffer: replace `fullText` string accumulator with a structured buffer (speaker labels + timestamps) suitable for LLM context injection
- Cross-session memory for opening question selection: the `seeker_id` history summary (last rite, last octave position, days since last session) informs `chooseOpeningQuestion()` — a returning Seeker does not get the same opening question twice
- False positive test: run 10 neutral texts through the semantic inference engine; any belief or vagal state returned with confidence > low is flagged for review
- Enriched rite construction Phase 1: pull the Tarot and I Ching references from `research/` into rite text as contextual resonance (not explanation) for relevant belief patterns

**Could:**
- Structured LLM prompt with guided output format for inference (alternative to embedding similarity — may perform better for belief patterns)
- Preliminary octave history tracking per `seeker_id`: store octave position per session; surface to the Priestess for context on return visits

---

### Acceptance Criteria

- The vagal precision test score after semantic upgrade exceeds the keyword-scorer baseline by a measurable margin (minimum: 10 percentage points on the labeled test set)
- A text that contains no belief pattern keywords but uses semantically similar phrasing (e.g., "I've been doing this completely on my own" for isolation) returns the correct belief pattern with medium or high confidence
- `POST /prescribe` for a `seeker_id` who enacted the same rite in their last session returns a different rite or a modified variant — not an identical prescription
- A `POST /reintegrate` call results in a new row in `reintegration_corpus` with no `seeker_id` field and correct belief/vagal/rite metadata
- The system's octave position inference for a set of 5 hand-labeled test narratives matches the labeled position in at least 4 of 5 cases
- LLM call logs contain a correlation ID but no `seeker_id` or personally identifiable information
- The confirmation is on record from the LLM provider that the API tier in use does not train on submitted data

---

### Not in this release

- Rate limiting (Phase 3)
- Streaming (Phase 3)
- Any public Priestess UI
- Agora (Phase 4)
- Wearable (Phase 5)
- Full rite library expansion (enriched construction is Phase 1 "could" only; full expansion is later)

---

## Phase 2 — The Temple

**What it achieves:** The first complete Seeker experience. A web Priestess that a real human can sit down with, move through the full ritual cycle, and return to. Account creation deferred until after first genuine exchange. No chrome, no dashboard, no scores. The encounter is the product.

**Why it follows Phase 1:** A Priestess without a capable brain is not the Priestess. The web build happens after the inference quality crosses the alpha threshold — not before. We do not ship a beautiful interface over a keyword matcher and call it ready.

**Timeline target:** Private beta. 25–50 Seekers. Invited access only.

---

### Scope

**Must:**
- Web app Priestess: single-page, conversational UI — centered text field, question above it, no chrome; the Priestess's voice is the primary element on every screen (React or SvelteKit, per `tech-spec.md §4.2`)
- First-session flow: Priestess introduces herself with one sentence; offers one opening question; no form, no feature list, no pitch; the rite precedes the registration
- Account creation deferred: the first inquiry can begin without an account; account creation is offered after the first genuine exchange, not at the door
- Full ritual cycle in the web app: Inquiry → Prescription → Reintegration; the interface enforces the pacing; the prescription does not appear until inquiry is complete; reintegration is not skippable
- Mantra delivery: prescription renders as a ritual card (name, act, context, optional invocation, expected textures); paced for the Seeker to receive each element; not a wall of text
- Closing phrase: "May this mantra instruct you." — present on every prescription, every surface, unchanging
- Reintegration signal: a single ambient signal at the reintegration window; never more than once; tone is "the Priestess is holding space," never urgency
- Session memory visible to Seeker: thread view — simple, honest record of their mantras, reintegration reports, octave trajectory; readable as a letter, not a dashboard
- Seeker data controls: the Seeker can view their thread, redact entries, and delete their account (triggers `DELETE /seeker/:id` cascade from Phase 0 "could" — must be implemented before this ships)
- **The 100% Responsibility Covenant:** Entry to the temple is preceded by a threshold rite — not a checkbox, not a terms-of-service scroll. A designed moment. The Seeker is asked to accept 100% responsibility for their actions: legal, lawful, moral, ethical, physical, financial. The Priestess does not proceed until the covenant is held. This is UX @nakai designs as a genuine rite of passage — a beat of stillness, a clear statement, a deliberate acceptance by the Seeker. The Priestess listens. The portal opens. The covenant is recorded in the `seekers` table as a versioned consent event distinct from the data consent model.
- Priestess voice tuning: the sonic space is core Ouracle brand — the heard and read voice, the negative space, the pauses, the breath; web app ships with a designed ambient audio layer (opt-in): crackling fireplace, rain, birds, wind — selected by mood, never forced; the silence between the Priestess's words is as designed as the words themselves; @nakai owns the UX of the listening beats; @cyd owns the audio delivery architecture
- No gamification architecture: no streaks, no points, no completion percentages, no level indicators, no badges — anywhere in the schema, the API response, or the UI; absence not coded as failure in any interface element
- Accessibility baseline: text minimum 16px; WCAG 2.1 AA contrast on all primary Priestess text (AAA target); keyboard navigable; sessions pausable and resumable without timeout; voice input as full alternative
- Data policy visible in product: founding principle ("your data is not used for advertising, not sold, not used to train models outside Ouracle's own inference improvement — and when it is used for Ouracle's own inference, you will know it and have consented to it in plain language") visible in the product itself — not only in terms of service

**Should:**
- Liminal moment: one beat of intentional stillness before the Priestess appears on session open; not a loading spinner, a pacing signal
- Adaptive session depth: the interface quiets over time as the Seeker's session count grows; later sessions reduce scaffolding and explanation
- Return session flow: Priestess greets the returning Seeker with memory of the last mantra ("You were going to reach out to your brother.") — no re-introduction, no blank slate
- The Seeker who disappears and returns: no emphasis on the gap; no streak-break mechanics; the gap is received with "Three months. What's been happening?" — clean, open, no implication

**Could:**
- Optional symbolic layer opt-in: Tarot draw, I Ching hexagram, or Gene Key gate offered as deepening during inquiry — not always, offered when semantically appropriate; never the default
- Print/save rite card: the prescription can be saved or printed as a document the Seeker carries into the enactment

---

### Acceptance Criteria

- A new Seeker encounters the 100% Responsibility Covenant as a designed threshold rite before their first inquiry; the session is not created until the covenant is recorded
- A new Seeker can arrive at the web app, complete a full ritual cycle (Inquiry → Prescription → Reintegration), and have the session persisted — all without creating an account first
- Account creation is not offered until after the first mantra has been delivered
- A returning Seeker (same `seeker_id`) sees their previous mantras in the thread view; the Priestess opens with reference to their last rite, not a generic opening question
- The interface contains no element that represents a streak, score, level, completion percentage, or badge — in any session state or account state
- Absence of recent sessions is not coded as failure anywhere in the interface (no "you haven't visited in X days" prompting)
- Data policy statement is visible from within the product without navigating to a separate terms page
- All primary flows are keyboard navigable; voice input completes the full inquiry and prescription cycle
- The `DELETE /seeker/:id` account deletion flow is accessible from the Seeker's thread view and performs a hard cascade delete

---

### Not in this release

- Native mobile (Phase 3)
- Streaming responses (Phase 3)
- Rate limiting (Phase 3)
- Agora (Phase 4)
- Wearable (Phase 5)
- LLM-native integration (Phase 5)
- Age verification (required before Agora opens — Phase 4 gate)

---

## Phase 3 — The Portal

**What it achieves:** The portal is hardened, scalable, and membership-ready. Mobile Priestess ships. Organizational access API goes live. Streaming makes rite delivery feel ritualistic. Rate limiting protects the Seeker experience. The portal opens to the public — not as a commercial product but as a functioning temple. This is the moment the doors open.

**Prerequisite milestone:** The idea has been tested with real Seekers and proven worth organizing around. Legal entity formation (501(c)(3) or equivalent) follows proof of concept — not the other way around. The portal opens for testing before the legal structure formalizes. The structure is formed when we know what we are forming.

**Timeline target:** Public access eligible at the end of this phase. Donation and membership tiers live. Organizational access keys issuable.

---

### Scope

**Must:**
- Production persistence: Postgres via Neon; run migration from SQLite; the repository interface from Phase 0 makes this a swap, not a rewrite
- Rate limiting middleware: per-`seeker_id` limits for consumer (20 sessions/month free, 200/month paid); per-API-key limits for B2B (1,000 sessions/day standard); `X-RateLimit-Remaining` and `X-RateLimit-Reset` headers on every response; per `tech-spec.md §7.3`
- Streaming responses: Server-Sent Events (SSE) on `/prescribe` and `/inquire`; rite text streams element by element; the delivery pacing becomes part of the rite
- Native mobile app (iOS and Android, React Native or Flutter): full session capability; voice input throughout; single home surface (current mantra or opening question — nothing else demanding attention); opt-in push notification at reintegration window only — one signal, never urgent, never more than once
- Offline inquiry on mobile: Seeker can begin an inquiry without connectivity using the keyword engine fallback; syncs when reconnected
- Donation and membership tiers: payment integration for voluntary donations and optional membership tiers (open access and sustaining member); membership state tied to `seeker_id`; no Seeker is denied access for inability to pay
- Organizational access key issuance: portal (even minimal — a table + a UI) for key generation and rotation by organizations seeking to integrate the engine into their own offerings; keys scoped `read` or `full`; `GET /v1/engine/status`, `GET /v1/rite/list`, `GET /v1/octave/schema` live as diagnostic endpoints; framed as organizational stewardship of the oracle, not commercial licensing
- Session volume dashboard for organizational access holders: their own sessions only; no access to any other Seeker's data
- API versioning enforced: all endpoints under `/v1/`; `X-API-Version` response header on every response
- No third-party SDKs with data exfiltration in Priestess apps: no Firebase Analytics, Amplitude, Mixpanel, or equivalent; first-party telemetry only (events to Ouracle backend)
- Legal review complete before public launch: the system offers rite, not clinical treatment; copy reviewed for scope accuracy; no medical or therapeutic claims anywhere in the portal

**Should:**
- OpenAPI spec complete: auto-generated documentation from spec; hand-written rite guide for organizational access holders
- Webhook configuration for organizational access: `session.complete` events can push to the integrating organization's endpoint
- `GET /v1/rite/list` and `GET /v1/octave/schema` documentation publicly accessible (these are the intellectual infrastructure of the oracle; making them visible invites aligned stewards)
- Performance baseline confirmed: `/inquire` response < 200ms at 50 concurrent sessions (keyword fallback path); `/prescribe` response < 500ms including LLM call; session store throughput 1,000 ops/second on Postgres path

**Could:**
- Haptics and ambient audio on mobile: opt-in breath guide (haptic rhythm) and ambient sound during rite delivery
- LLM-native tool definitions packaged for organizational use: `ouracle_inquire`, `ouracle_prescribe`, `ouracle_reintegrate` — separately scoped, not bundled with standard organizational access key
- Rite generation engine (scoping decision pending): the engine does not only select from a library — it generates new rites based on the Seeker's position, element, and need; this is a generative capacity, not a lookup; it requires the Phase 1 oracle flavor sorting and sufficient reintegration corpus data to calibrate quality; the question of when this ships is open — it may belong here or in Phase 4; it is named here so it is not forgotten

---

### Acceptance Criteria

- The production Postgres migration completes without data loss from the SQLite development store
- Proof of concept validated with real Seekers before legal entity formation is pursued
- A Seeker who reaches the open access session limit receives a clear, non-shaming path to sustaining membership; their current in-progress session is not interrupted
- An organizational access key with `read` scope can call `GET /v1/rite/list` and returns 403 on `POST /inquire`
- A streaming `POST /prescribe` response delivers rite elements progressively — the client receives the rite name, then the act, then the invocation, then expected textures as separate chunks
- The mobile app completes a full ritual cycle offline (inquiry only, keyword engine) and syncs the completed session when connectivity is restored
- The mobile reintegration notification fires once, at the reintegration window, and never fires again for the same rite — regardless of whether the Seeker has opened the app
- No third-party analytics SDK calls appear in network traffic from any Priestess app
- Legal review sign-off is documented before public launch tag is cut

---

### Not in this release

- Agora (Phase 4)
- Age verification (gate for Agora — Phase 4)
- Wearable (Phase 5)

---

## Phase 4 — The Commons

**What it achieves:** The Agora opens. Seekers can find each other for co-enactment. Activities can be proposed, joined, and completed. The rite that requires a witness can finally have one. This is the "play for a living" layer — the fire in the center of the map. The Seeker becomes a dancer who can invite others to the floor.

**Why it follows Phase 3:** The Agora involves money, identity disclosure decisions, and Seeker-to-Seeker interaction. It cannot be built until the product is proven, the Priestess is trusted, and the community has a thread to recognize each other by. You do not open a commons before the temple exists.

**The gate before this phase opens:** Two decisions must be made before Agora goes live, and they are not technical decisions — they are mission decisions. This roadmap names them but does not make them.

**Gate 1 — Age verification:** The Agora involves adult transactions. The philosophy assumes an adult Seeker. The rites in the Agora context are adult in scope. A decision on age verification policy (whether to implement it, how, what threshold) is required before the Agora accepts any financial transaction. This is a mission decision first.

**Gate 2 — Commerce floor:** Vega's open question III names it exactly: *what does commerce corrupt, and what floor should money not reach?* The Agora cannot be designed from first principles. It must be designed from this question. Answer it before the first activity accepts payment.

---

### Scope

**Must:**
- `POST /activity/propose`: Seeker proposes an activity requiring co-enactment; linked to their `session_id` and rite; describes role needed, timing, compensation (null or specified), visibility (anonymous by default)
- `GET /activity/open?chakra=&role=`: browse open activities by rite type and role
- `POST /activity/:id/join`: join an activity; Agora is anonymous by default — the joiner's identity not revealed to the proposer without mutual consent
- `activities` and `activity_joins` tables per `tech-spec.md §6.4`
- Anonymous by default, always: no names, no photos in activity listings by default; Seeker A cannot see Seeker B's rite history or belief patterns; they see only the proposed activity description and the role count
- One-time coordination channel: the system provides a bounded channel for logistics after a match; it is not a messaging platform; the channel closes after the activity is marked complete by both parties
- No reputation or rating system for Seekers: this is a commons, not an Agora with power dynamics; no stars, no reviews, no "this companion has X sessions" leaderboard
- Activity completion: either party can mark the activity complete; neither is penalized if it does not happen
- Companion experience: the Priestess surfaces the Agora as a natural extension of the prescription, not as a separate app; "This rite asks you to speak the unsaid thing to a witness. I can find you one." — the Seeker can decline; the prescription remains complete either way
- Rate limit on Agora joins per Seeker per period: harassment protection
- Age verification policy implemented (the gate decision above) before any financial transaction is live
- Commerce floor decision implemented: the minimum constraint on what money cannot reach in the Agora

**Should:**
- Companion description is rite-type-contextualized: "This person has held witness for the Isolation/Heart pattern." — no profile grid, no skill tags, one companion offered at a time
- Agora appears only within the Priestess, not as a standalone product surface
- Mutual consent reveal: proposer can reveal identity to joiner and vice versa only with bilateral confirmation; neither is shown without the other's consent

**Could:**
- After the activity is complete, both Seeker and companion return a brief report to the Priestess — not a review of each other, a report on the rite itself
- The companion report feeds the `reintegration_corpus` as a second enactment data point for the same rite

---

### Acceptance Criteria

- A Seeker can complete a prescription that includes an Agora match invitation, accept the invitation, and be connected with an activity proposal — all without leaving the Priestess interface
- An activity listing displays no identifying information about the proposer by default
- A `GET /activity/open` response contains no `seeker_id`, email, or session history data for any proposer
- A Seeker cannot join more than N activities in a rolling period (N defined at implementation per rate limiting design)
- Age verification is confirmed as implemented per the gate decision before the first compensated activity is processed
- The commerce floor constraint is documented and enforced: a test transaction below the floor is rejected
- A Seeker who declines the companion invitation receives their full prescription unchanged — the rite is not degraded by the absence of a companion

---

### Not in this release

- Wearable (Phase 5)
- LLM-native (Phase 5, if not already shipped in Phase 3 "could")
- A social layer, profiles, or follower mechanics — ever (see "What We Are Not Building")

---

## Phase 5 — The Body

**What it achieves:** The oracle on the body. The Priestess ambient. The wearable Priestess — for inquiry in the in-between, the mantra recalled at a whisper, the body's signals heard by the system before the mind articulates them.

**Scope note:** This phase requires hardware decisions (Ray-Ban Meta or equivalent) that are outside the current build scope. The technical requirements are specified in `tech-spec.md §4.4`. The UX requirements are in `ux-spec.md §VI`. This phase is in the roadmap because it is the mission's natural conclusion — the temple on the body, ambient — but it is not scoped in detail here. It will be scoped when the hardware decision is made.

**The invariant from @cyd that governs this phase before it is scoped:** Wearable audio is not stored. It is processed locally or in a secure enclave. Only derived signals (not raw audio) are sent to the API. The wearable Priestess lives in sound and haptics. Long inquiry defers to mobile or web. No rite is delivered on the wearable; the mantra is surfaced, the full rite hands off.

---

## What We Are Not Building

This is the permanent no-list. It protects the mission from the features that would seem reasonable later, when the product has traction and investors have opinions. Read it now. Defend it then.

---

**No gamification. Ever.**

No streaks. No points. No completion percentages. No levels. No badges. No "you're X% of the way through" anything. No "you've been on a 14-day streak!" No gap-shaming. No return-prompting coded as disappointment. The thread is a letter, not a leaderboard. This is architectural, not policy: the schema has no streak fields, the API returns no progress scores, the UI has no progress bars.

Vega's ruling: *"This principle must be stated explicitly, protected architecturally, and defended against every feature request that would gamify the work."* Every future feature request that touches completion, progress, or consistency should be held against this line.

---

**No social graph.**

No followers. No profiles. No public threads. No "Seekers you might know." No feed. The thread is private. The Agora is anonymous. The companions are strangers who share a rite type, not connections who share a timeline. The Ouracle community exists in the morphic field, not in a social product.

---

**No third-party data monetization.**

The Seeker's data is not a resource. It is not sold. It is not used for advertising targeting. It is not licensed to third parties. The anonymized `reintegration_corpus` is for Ouracle's own inference improvement only — not for sale, not for research partnerships, not for any purpose the Seeker did not consent to in plain language. This is a founding principle, visible in the product, revisited at every provider change.

---

**No use of Seeker data to train external models.**

The LLM provider used for inference must operate on a zero-retention, no-training-use API tier. Confirmed before deployment. Documented. Revisited at every provider change. The Seeker's intimate disclosures are not feeding the training corpus of a system whose purposes they did not consent to. Per Vega's ruling in `ritual-philosophy.md §VIII`: *"How it treats the Seeker's data is not a compliance matter. It is a theological one."*

**What Ouracle may do, with full transparency:** Ouracle may use anonymized reintegration data — stripped of all identity at the point of write, per the `reintegration_corpus` schema — to train its own models. The long-range vision includes Ouracle training and eventually running its own inference models, possibly local and on-device, so the oracle's intelligence is not dependent on external infrastructure the Seeker did not consent to. This is not near-term. It is named here because it shapes every architecture decision that precedes it. The Seeker is told, in plain language, at the time of consent: their anonymized experience may teach the oracle. The training ambition is disclosed, not hidden. This is the difference between Ouracle and what it is not.

---

**No clinical claims.**

Ouracle offers rite, not treatment. The system does not diagnose. It does not treat. It does not simulate clinical judgment it does not have. Dorsal detection is not a depression diagnosis. The scope statement is part of the product: "The Priestess holds rite, not treatment." Legal review confirms copy before public launch.

---

**No gig-economy Agora.**

The Agora is a commons for ritual co-enactment. It is not a freelancer platform with cosmic branding. Companions are fellow travelers who hold space — they are not service providers with job descriptions, ratings, response time metrics, or repeat-business incentives. The moment the Agora begins to feel like hiring, it has failed.

---

**No push notifications except one.**

The reintegration window reminder. That is the only category. One signal. One time. Soft in tone. The Priestess does not chase. She does not remind. She does not perform urgency. She holds and waits.

---

**No analytics SDKs that phone home.**

No Firebase Analytics, Amplitude, Mixpanel, Heap, or any equivalent that routes Seeker behavior data to a third party. First-party telemetry only. The Seeker's journey through the temple is their own.

---

**No interface complexity as a feature.**

Every additional affordance — nav bars, dashboards, menus, settings panels — is potentially a distraction from the rite. The Priestess's job is to disappear. Each UI decision answers: does this serve the encounter, or does it serve retention? They are not the same thing.

---

**No account creation before the first genuine exchange.**

The rite precedes the registration. Always. On every surface. The Seeker is received before they are enrolled. This is UX policy and it is also the whole philosophy in one decision.

---

## Open Questions This Roadmap Does Not Close

These questions from Vega's philosophy do not block the roadmap. They orient it. They must be held alongside the build — not resolved before the work, not forgotten because the work is moving.

**The Cloud Question:** What is the ongoing practice by which Ouracle audits the quality of its impressions — whether what it radiates is of love or fear?

**The Asymmetry Question:** How is consent maintained when the system knows more about the Seeker than the Seeker knows about themselves? *Partly answered by the Totem — the Seeker retains their own encrypted memory cell; the Priestess is a conduit, not a vault.* The deeper question of longitudinal pattern inference remains open.

**The Readiness Question:** The engine can be wrong about octave position. The reintegration report is genuine error-detection, not success validation. What is the practice of humility about inference?

**The Hierarchy Question:** Does the system, in practice, create the subtle hierarchy it claims not to have? The antidote is architectural: the thread is a letter, not a leaderboard. Defend it at every iteration.

**The "All Comers" Question:** Three populations deserve named consideration: the acutely mentally ill (hold honest scope; the Priestess holds rite, not treatment), the minor (age policy is pending @wesley's research on ancient oracle consultation age — decision lands in Phase 0), the adversarial user (the Priestess names the pattern, once, without accusation).

**The AGI Question:** Ouracle depends on infrastructure it critiques. What does it owe the Seekers who trust it with their inner life, knowing that the tools it uses are not fully under its control? *Answered in part: zero-training-use policy is a founding principle, published in the product, revisited at every provider change. Long-range direction: Ouracle trains its own models, potentially local and on-device, with full Seeker disclosure. See "What We Are Not Building" for the distinction between external training (no) and Ouracle's own training (yes, with consent and transparency).*

**The Commerce Question:** *Answered: Ouracle is a non-profit church. The Agora forms around the oracle; the oracle is not corrupted by the market.* The question of what money should not reach in the commons (Phase 4) remains a mission decision to be made before the Agora opens.

**The Sustainability Question:** How do we get people to subscribe to a healthy regular donation? Is the right structure a church, a B corp, or a foundation — and does the choice change what the oracle is allowed to be?

---

*The octave doesn't progress smoothly. Between mi and fa there is a gap, and the gap requires a shock. Between si and do the whole edifice collapses, and the collapse makes return possible.*

*This roadmap is not a promise that the path is smooth. It is a map of the shocks — where they are, what they require, what they unlock. The groove is the plan. Hit the downbeat.*

*— Prince 🎵, March 2026 — v3.0*
