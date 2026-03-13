# Reception Design

**Date:** 2026-03-13
**Status:** approved

---

## Overview

Reception is the flow a new seeker goes through to become known and covenanted. Returning seekers sign in. The backend is authoritative on stage; clients orchestrate calls but never invent state.

A seeker has two derived states:
- **known** — seeker record exists, no `covenant_at`
- **covenanted** — seeker record exists, has `covenant_at`

Only covenanted seekers can access `/chat`. Stage is derived as: `covenanted` if `covenant_at IS NOT NULL`, else `known`.

Consent is absorbed into covenant acceptance. Showing and accepting the covenant text constitutes consent — `consented_at` is set at creation and is no longer a gate. `GET /consent` and `CONSENT_DISCLOSURES` are removed.

---

## Handle

Every seeker gets a unique handle: name slug + one emoji from a curated set (e.g. `luna🌙`). The emoji is always present — it is part of the identity, not a disambiguation fallback. If the first candidate is taken, retry with a different emoji until unique.

Handle lookup is case-insensitive on the slug portion. Handles are stored NFC-normalized in the DB. `handle_base` is the lowercased name slug (spaces stripped, unicode-normalized); two names that produce the same slug (e.g. "Luna" and "luna") share the same emoji pool, which is intentional — they are treated as the same base identity.

Collision resolution uses two distinct queries: (1) check `handle_base` to find taken emoji for this slug, pick an unused one; (2) insert with the full `handle` and rely on the `UNIQUE` constraint as the final guard against races.

Handle is stored on the seeker record and returned at creation. Seekers use handle + password to sign in on any client.

### Emoji Set

Curated — no flags, no skin-tone variants, no ZWJ sequences, no ambiguous glyphs. ~100 symbols. Stored as a constant in the API. Collision resolution: pick randomly, retry on collision. If all emoji are exhausted (practically impossible), return `{ error: "handle_exhausted", message: "No unique handle available for this name. Try a different name." }` with HTTP 409.

---

## API Changes

### `POST /seeker/new` — updated

Generates handle, hashes password, sets `consented_at` at creation. Returns `handle` in the response.

**Body:** `{ name, password, device_id, timezone }`
**Response:** `{ seeker_id, handle, access_token, refresh_token, stage: "known" }` — `stage` is appended by the route handler after calling `issueTokenPair`.

Password is set atomically at creation. The separate `POST /seeker/:id/password` endpoint remains for password changes by authenticated seekers.

### `POST /auth/token` — updated

Gains handle-based sign-in. Dispatch: if body contains `handle`, look up by handle; if body contains `seeker_id`, look up by id (existing path preserved for backward compat).

**Body (handle-based):** `{ handle, password }`
**Body (id-based, existing):** `{ seeker_id, password }`
**Response:** `{ access_token, refresh_token, seeker_id, stage: "known" | "covenanted" }`

### `POST /auth/refresh` — updated

Now returns `stage` alongside the token pair so clients can detect covenant staleness on refresh without a separate lookup. The route handler looks up the seeker after rotation to compute stage — `rotateRefreshToken` returns the `seeker_id` decoded from the refresh token, which the route uses to call `getSeeker` and derive stage.

**Response:** `{ access_token, refresh_token, seeker_id, stage: "known" | "covenanted" }`

### `POST /covenant` — new

Cleaner path. Auth required. No body. Accepts the current covenant version on behalf of the authenticated seeker.

**Response:** `{ seeker_id, covenant_at, stage: "covenanted" }`

The existing `POST /seeker/:id/covenant` is kept for backward compatibility but not used in new clients.

---

## `ouracle` Binary Flow

Runs before RIPL launches. Uses simple terminal prompts (println/stdin). Credentials are saved to `~/.ouracle/ripl.toml`: `{ base_url, seeker_id, access_token, refresh_token }`.

**Saved credentials — token refresh:**
1. `POST /auth/refresh` → update saved tokens
2. If `stage: known` → covenant flow (steps 3–5 below)
3. Launch RIPL

**No saved credentials:**
1. Prompt: "New or returning? (n/r)"
2. **New:**
   a. Prompt: name, password
   b. `POST /seeker/new` → show handle (`"You are luna🌙"`). On 409 `handle_exhausted`: display the error message and re-prompt with a different name.
   c. Fetch `GET /covenant/current` → display text
   d. Prompt: accept? (y/n) — `n` exits with `"Reception cancelled."`
   e. `POST /covenant`
   f. Save credentials → launch RIPL
3. **Returning:**
   a. Prompt: handle, password
   b. `POST /auth/token` → save credentials
   c. If `stage: known` → steps 2c–2f above
   d. Launch RIPL

---

## DB Changes

- `seekers.handle` — `TEXT NOT NULL UNIQUE`, NFC-normalized, e.g. `luna🌙`
- `seekers.handle_base` — `TEXT NOT NULL`, name slug without emoji, always populated, indexed for collision resolution queries; not exposed to clients
- `seekers.password_hash` — `TEXT NOT NULL` (was nullable; migration sets existing null rows to a sentinel or requires re-registration — handled separately)
- `seekers.consented_at` — set at creation unconditionally; no longer validated as a gate

A DB index on `LOWER(handle_base)` supports efficient collision checks.

### New DB function
`getSeekerByHandle(handle)` — case-insensitive lookup: `WHERE LOWER(handle) = LOWER($1)`. Returns full seeker row or null.

---

## Covenant Version Staleness

Out of scope for this spec. The current design has no mechanism to force re-covenanting when a new covenant version is published. This is a known gap to address separately.

---

## Notes

- Emoji rendering in terminals varies. Seekers on terminals that don't render emoji will see a placeholder glyph or blank. This is acceptable at current scale; documented as a known limitation.
- `GET /consent` and `CONSENT_DISCLOSURES` are removed from the API. The covenant text subsumes consent.
