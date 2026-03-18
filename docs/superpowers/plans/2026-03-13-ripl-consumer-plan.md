# Ouracle → RIPL Consumer Plan

**Date:** 2026-03-13

## Goal
Make Ouracle the first consumer of RIPL by moving domain/app logic into the API backend and replacing the Ouracle TUI with RIPL.

---

## Plan

1. **Baseline audit**
   - Inventory `apps/tui` responsibilities, domain state machine, persistence, and API usage.
   - Classify logic as backend-owned vs client-only UI.

2. **Backend expansion design**
   - Define API contracts for Covenant → Inquiry → Prescribed → Reintegration.
   - Specify state transitions, payloads, auth, error semantics, and streaming format for RIPL.
   - Version endpoints if needed to protect existing clients.

3. **Backend implementation**
   - Move domain logic into API.
   - Add/extend endpoints and persistence.
   - Add tests and contract coverage.
   - Ensure web/native clients can consume the same flow.

4. **RIPL integration**
   - Implement an Ouracle provider targeting the new API (in RIPL or Ouracle repo shim).
   - Map messages, auth tokens, session identifiers, and streaming tokens.

5. **TUI replacement**
   - Retire the Ouracle-specific TUI logic.
   - Wire RIPL as the default Ouracle terminal client with correct config defaults and bootstrap.

6. **Migration & validation**
   - Data compatibility checks and regression tests.
   - Smoke tests for API + RIPL TUI.

7. **Docs & rollout**
   - Update specs/README with new flow.
   - Document deprecation of old TUI.

---

## Risks & mitigations
- **API contract changes** may break existing clients → version endpoints or add compatibility layer.
- **Streaming format** may lock in implementation → define clearly and test contract.
- **Auth/session migration** complexity → add integration tests + migration checklist.

---

## Next steps (immediate)
1. Baseline audit of `apps/tui` and current API surface.
2. Draft the RIPL-facing API contract (request/response + streaming schema).
3. Decide on endpoint versioning strategy (compat layer vs v2).

---

## Assumptions
- Ouracle API remains the single source of truth for seeker state.
- RIPL stays UI-only; an Ouracle shim handles domain logic and API calls.
- Existing auth tokens remain valid; we can extend claims as needed.

---

## Scope
**In scope**
- Move domain state transitions to the API.
- Add API endpoints + persistence for the Covenant → Inquiry → Prescribed → Reintegration flow.
- Replace Ouracle TUI with RIPL as the default terminal client.

**Out of scope**
- Web UI redesigns or non-terminal clients.
- Major schema redesigns unrelated to RIPL consumption.
- Non-Ouracle RIPL providers.

---

## Detailed checklist

### 1) Baseline audit
- Map `apps/tui` flows to the current domain model.
- Capture all API calls made by the TUI and note inputs/outputs.
- Identify logic that must move server-side vs UI-only behavior.

---

## Baseline audit findings (apps/tui)

### Responsibilities
- Terminal UI loop, input handling, and screen rendering (`apps/tui/src/main.rs`, `apps/tui/src/ui.rs`).
- Client-side state machine and flow control (`apps/tui/src/app.rs`).
- HTTP API client for all domain actions (`apps/tui/src/api.rs`).
- Ambient visualizer + animations (`apps/tui/src/aura.rs`, `apps/tui/src/theme.rs`).
- Local “Totem” preferences storage in `~/.ouracle/totem.json` (`apps/tui/src/totem.rs`).
- Local speech-to-text (STT) and text-to-speech (TTS) plumbing (spawned OS processes).

### Client-side domain flow + state
- Modes: `Covenant`, `Inquiry`, `Prescribed`, `Reintegration`, `Complete`.
- “Stage” is a client-managed string (`disconnected`, `consent`, `seeker_ready`, `covenanted`, `inquiry`, `inquiry_complete`, `prescribed`, `reintegration_complete`, `deleted`).
- Consent → Name → Password prompts are enforced client-side (`awaiting_consent`, `awaiting_name`, `awaiting_password`).
- `/begin` gates inquiry by: fetch covenant text → `/intromit` → queued `/session/new`.
- Inquiry continues via `/inquire` with `session_id` and `response` until `stage == inquiry_complete`.
- `prescribe` and `reintegrate` are allowed only after inquiry completion (client-side checks).

### API usage (endpoints + payloads)
- `GET /consent` → disclosures.
- `GET /covenant/current` → `{ version, text[] }`.
- `POST /seeker/new` → `{ device_id, email_hash: null, timezone, name, consented: true, consent_version: "1.0" }` → `{ seeker_id, access_token, refresh_token }`.
- `POST /seeker/:id/password` → `{ password }`.
- `POST /seeker/:id/covenant` → `{ covenant_version: "1.0" }`.
- `POST /session/new` → `{ covenant: { version: 1, accepted: true, timestamp } }` → `{ session_id, turn, question, greeting? }`.
- `POST /inquire` → `{ session_id, response }` → `{ stage, session_id, turn, question? | quality_sense? }`.
- `POST /prescribe` → `{ session_id, divination_source? }` → `{ rite, reintegration_window? }`.
- `POST /reintegrate` → `{ session_id, report: { enacted } }` → `{ witness, what_shifted, next }`.
- `GET /session/:id` → `{ stage, turn, conversation[] }` (client extracts priestess lines).
- `GET /seeker/:id/thread` → `{ thread[] }`.
- `PATCH /seeker/:id/thread/:session_id/redact`.
- `DELETE /seeker/:id`.

### Auth + session handling
- Access + refresh tokens stored in memory only (no persistence).
- `seeker_id` stored in memory; no client-side token refresh call present.
- `/token` prints access token for debugging.

### Local persistence + files
- Totem: `~/.ouracle/totem.json` (unencrypted).
- TTS cache: `data/tts_cache/` (MP3s).
- TTS error log: `logs/tts.log`.
- STT recordings: `data/stt_recordings/`.
- STT transcripts: `data/stt_transcripts/`.

### External process dependencies
- STT: `sox` (default), `whisper` or `whisper-cpp` (CLI).
- TTS: `say` (fallback), `afplay`/`afinfo`, Fish Audio HTTP API.

### Client-only UI/UX logic (likely stay client-side)
- Aura visuals, color theming, cursor handling, scrolling.
- Text rendering, animated priestess typing, fade transitions.
- Push-to-talk (PTT) state machine + audio capture.

### 2) API contract design
- Define endpoints for each state transition.
- Specify required fields, error codes, and idempotency behavior.
- Define streaming token envelope and termination semantics.
- Document auth requirements (bearer, refresh, session scope).

---

## Architecture decision
RIPL remains a **dumb TUI**. An Ouracle **shim client** owns all domain logic, API calls, and session state. RIPL only renders messages and forwards input events.

### Shim responsibilities
- Manage seeker identity, consent, covenant, inquiry, prescribe, reintegrate flows.
- Persist local state if needed (tokens, last session id).
- Translate between RIPL events and Ouracle API calls.
- Stream priestess output back to RIPL in a UI-agnostic format.

### RIPL responsibilities
- Render transcript and input.
- Emit user input events + control events (start, cancel, quit).
- Display streaming tokens and final responses.

---

## RIPL ↔ Ouracle shim interface (proposed)

### Inputs to shim (from RIPL)
- `user_text`: free-form user message.
- `command`: structured control event (e.g., `welcome`, `begin`, `prescribe`, `reintegrate`, `thread`, `reset`).
- `config`: base URL, auth settings, optional divination source, etc.

### Outputs to RIPL (from shim)
- `system`: state updates (stage, mode, pending, errors).
- `assistant_stream`: token stream for priestess output.
- `assistant_final`: final assistant message and metadata (turn, session_id).
- `prompt`: when the shim needs structured input (consent, name, password).

### Error handling
- All errors are surfaced as `system` events with `code`, `message`, and `retryable` flags.

### Streaming format
- Shim emits token events `{ type: "token", text }` and a final `{ type: "done", message, meta }`.
- RIPL treats stream as display-only; no parsing of domain meaning.

---

## Shim API contract (concrete)

### Shim config (local)
```toml
base_url = "http://127.0.0.1:3737"
seeker_id = "uuid"
access_token = "jwt"
refresh_token = "jwt"
```

### Shim boot sequence
1. Refresh tokens if `refresh_token` exists: `POST /auth/refresh`
2. If stage is `known`, run covenant acceptance:
   - `GET /covenant/current`
   - user accept prompt
   - `POST /covenant`
3. Create session before launching RIPL:
   - `POST /session/new` with `{ covenant: { version, accepted: true, timestamp } }`
   - seed RIPL session cache with greeting + question

### Provider runtime (RIPL → Shim → API)
- On each user message:
  - If no `session_id`, fail fast and prompt “Restart the client to open a new session.”
  - Call `POST /enquire` with `{ session_id, message }`
  - Stream SSE events to RIPL:
    - `token` → `ApiResponse::TokenChunk`
    - `break` → `"\n\n"` chunk
    - `complete` → `ApiResponse::TurnComplete` (clear `session_id` if stage = `complete`)
    - `error` → `ApiResponse::Error`

### Error mapping
- HTTP non-2xx → `ApiResponse::Error { message: "HTTP <status>: <body>" }`
- SSE `error` → surface `message` verbatim
- Token refresh failures → fall back to reception (sign-in) flow

### 3) Backend implementation
- Implement state machine transitions and validation in API.
- Add persistence for all domain events and outputs.
- Add tests for happy-path + invalid transition coverage.

### 4) RIPL integration
- Implement Ouracle provider in RIPL (or a shim in this repo).
- Map RIPL message/streaming APIs to Ouracle endpoints.
- Validate login + token refresh flows.

### 5) TUI replacement
- Remove or retire Ouracle-specific TUI entrypoints.
- Ensure RIPL TUI bootstraps with sane defaults.
- Provide a migration note for users invoking the TUI.

### 6) Migration & validation
- Verify data compatibility for existing seekers.
- Add smoke tests for: sign-in, covenant, inquiry, prescribed, reintegration.
- Run a dry-run rollout checklist in staging.

### 7) Docs & rollout
- Update README/specs to point to RIPL TUI.
- Publish deprecation notice for old TUI entrypoints.
- Document required env vars and config changes.

---

## Deliverables
- API endpoints and schema updates for full domain flow.
- RIPL provider + terminal boot configuration.
- Test suite coverage for new transitions and streaming.
- Updated docs and migration notes.
