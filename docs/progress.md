# Ouracle Progress Tracker

Rules:
- Generate checkboxes from `docs/roadmap.md`, `docs/tech-spec.md`, and `docs/ux-spec.md` when planning a phase.
- Do not advance to the next phase until all boxes in the current phase are checked.

## Phase 0 — The Foundation (Checklist)

### Scope Must (Roadmap + Tech Spec)
- [x] Persistence layer (Postgres/Neon backing sessions, seekers, enactments, reintegration corpus).
- [x] `seekers` table fields (`device_id`, `email_hash`, `timezone`, `consent_version`, `consented_at`).
- [x] `sessions` table persists full session state + inference metadata.
- [x] `enactments` table linked to seeker + session.
- [x] Repository interface (`db.js`) abstracts data access.
- [x] Seeker identity on session creation (`seeker_id`).
- [x] Totem design spec delivered (v0.1 in `docs/totem-spec.md`).
- [x] API key auth middleware for external callers.
- [x] JWT auth for Seeker flows (access + refresh).
- [x] Covenant gate: session initiation requires explicit acceptance.
- [x] Consent disclosures endpoint + seeker creation requires consent.
- [x] `reintegration_corpus` table (anonymized; no seeker_id).

### Scope Should
- [x] `GET /seeker/:id/history` returns last N completed sessions.
- [ ] Consent versioning prompts on change.

### Scope Could
- [ ] OpenAPI spec stub.
- [ ] `DELETE /seeker/:id` cascade delete.

### Validation (Roadmap Acceptance)
- [x] Server restart does not lose an in‑progress session (verified).
- [x] Seeker history accessible after restart (verified via `/seeker/:id/history`).
- [x] Consent disclosures shown before first session; session blocked until consent recorded (verified in UI).
- [x] Unauthenticated `POST /inquire` returns 401.
- [x] API key in `Authorization: Bearer` passes; invalid/missing returns 401.

## Phase 1 — The Plexus (Checklist)

### Core Engine + Data (Roadmap + Tech Spec)
- [x] Semantic inference upgrade (embedding similarity; keyword fallback behind flag).
- [x] LLM call isolation: no seeker/session IDs in prompts; correlation ID only.
- [ ] Confirm zero‑retention API tier before sending seeker data.
- [x] Octave position inference from narrative; store in sessions.
- [x] Octave disclosure prompt: “It sounds like you may be at … Does that land?” with seeker override.
- [x] Reintegration feedback loop writes anonymized corpus entries (no seeker_id).
- [x] Rite history weighting to prevent same rite repeat.
- [x] Inference quality baseline: vagal + belief tests (20 each) before/after upgrade.
- [x] Oracle flavor sorting: Tarot + I Ching mapped into Octave JSON lookup.
- [x] Multi‑turn conversation buffer (speaker + timestamps) suitable for LLM context.
- [x] Opening question selection uses seeker history summary (last rite/quality/days since).
- [x] False‑positive test: 10 neutral texts; flag any confidence > low.
- [ ] Enriched rite construction (optional): add symbolic resonance to rite text.
- [ ] Preliminary octave history tracking per seeker (optional).

### Validation (Roadmap Acceptance)
- [ ] Semantic vagal precision improves ≥10 points over keyword baseline on labeled set.
- [ ] Semantically phrased belief (no keywords) returns correct pattern with ≥ medium confidence.
- [x] Prescribe avoids repeating last rite (variant or different).
- [x] Reintegration corpus row written with correct metadata and no seeker_id.
- [x] Octave inference matches 4/5 on labeled narratives.
- [x] LLM logs have correlation ID only (no seeker/PII).
- [ ] Provider confirmation recorded for zero‑training retention tier.

## Phase 2 — The Temple (Checklist)

### Product + Experience (Roadmap + UX)
- [ ] Web Priestess single‑page conversational UI (no chrome, centered field, question above).
- [x] First‑session flow: one‑sentence Priestess intro; opening question before any form.
- [ ] Account creation deferred until after first genuine exchange. (deferred: anonymous reception taste, not a session)
- [x] Full ritual cycle enforced: Inquiry → Prescription → Reintegration (no skipping).
- [x] Prescription delivered as ritual card (name, act, context, optional invocation, expected textures) with pacing.
- [x] Closing phrase fixed: “May this mantra instruct you.”
- [x] Reintegration window signaled once; tone is holding, never urgent.
- [ ] Thread view: readable letter of mantras + reintegration reports + octave trajectory. (deferred to Phase 7)
- [x] Data controls: redact entries + delete account from thread view.
- [x] Threshold Covenant moment (100% responsibility) before first inquiry.
- [ ] Ambient audio layer (opt‑in) for sonic space; silence/pacing designed. (deferred)
- [x] No gamification UI anywhere (no streaks/scores/levels/badges).
- [ ] Accessibility baseline: min 16px, WCAG AA/AAA contrast, keyboard nav, voice input, pausable sessions. (deferred)
- [x] Data policy visible inside product (plain language).
- [x] Liminal opening beat (intentional stillness; not spinner).
- [x] Adaptive session depth (less scaffolding as sessions increase). (tracked via sessions_completed in TUI)
- [x] Returning seeker flow references last mantra; no re‑intro.
- [x] Absence handled without gap‑shaming (“Three months. What’s been happening?”).
- [x] Optional symbolic layer opt‑in (Tarot/I Ching) when appropriate.
- [ ] Print/save rite card. (deferred)

### API + Platform (Tech Spec)
- [ ] SvelteKit web app scaffolded with Priestess UI. (deferred)
- [x] Session open accepts covenant and returns opening question (already in API, surfaced in TUI).
- [x] Totem v0.1 client scaffolding (encrypted local store + export/import stub). (stubbed, unencrypted)
- [x] Thread view API shape aligns with Totem session summaries.
- [x] Delete seeker cascade endpoint implemented and exposed in UI.
- [ ] Voice input support integrated in web app. (deferred)
- [x] No third‑party analytics SDKs.

### Validation (Roadmap Acceptance)
- [ ] New seeker can complete full cycle without account creation; account offer only after first mantra. (deferred)
- [x] Covenant gate blocks session until accepted; covenant recorded.
- [ ] Returning seeker sees previous mantras in thread view; Priestess references last rite. (deferred: thread view Phase 7)
- [x] No UI element for streaks/scores/levels/badges.
- [x] Absence not coded as failure.
- [x] Data policy visible without leaving product.
- [ ] All primary flows keyboard navigable; voice input completes full cycle. (deferred: web UI)
- [x] Delete account from thread view performs cascade delete.

## Phase 4 — The Commons (Checklist)

### Gates (Roadmap)
- [ ] Age verification policy implemented before any compensated activity.
