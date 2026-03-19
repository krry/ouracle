# Totem Spec — v0.1

**Status:** Draft
**Date:** 2026-03-11
**Owner:** Ouracle

## Purpose
The Totem is the Seeker’s self-sovereign memory cell. It holds cross-session memory and narrative continuity. The temple never holds the Totem in plaintext. The Totem is portable across devices, encrypted at rest and in transit, and controlled by the Seeker.

## Goals
- Seeker-owned memory, portable across devices.
- Default mode: local + cloud sync (both).
- End-to-end encryption (E2E) via Ouracle servers; server never sees plaintext.
- Summaries + metadata only (no raw full-text transcript).
- Export/import as JSON (machine-readable, convertible).
- Totem versioning paired to client version, with server-side conversion.

## Non-Goals (v0.1)
- Social recovery.
- Human-readable export.
- Full transcript storage.
- Server-side plaintext access under any circumstance.

## Data Scope (v0.1)
The Totem stores **summaries and metadata**, designed to rehydrate context for the Priestess and the Seeker.

**Included:**
- Session summary (short abstract)
- Rite prescribed (name + core act)
- Octave position (quality)
- Vagal state + belief pattern (as metadata)
- Enactment status + reintegration summary
- Timestamps, session IDs

**Excluded:**
- Full inquiry text
- Any Seeker identifiers beyond a local Totem ID

## Data Model (JSON)
```json
{
  "totem_version": "0.1",
  "totem_id": "uuid",
  "created_at": "ISO8601",
  "updated_at": "ISO8601",
  "seeker_preferences": {
    "oracle_flavor": "tarot|iching|gene_keys|delphi|none",
    "timezone": "America/Chicago"
  },
  "sessions": [
    {
      "session_id": "uuid",
      "created_at": "ISO8601",
      "completed_at": "ISO8601",
      "summary": "short abstract, 1–3 sentences",
      "octave_quality": "entity|affinity|activity|pity|capacity|causality|eternity|unity|calamity|cyclicity|null",
      "vagal_state": "ventral|sympathetic|dorsal|mixed",
      "belief_pattern": "scarcity|unworthiness|control|isolation|silence|blindness|separation|null",
      "rite": {
        "name": "The Receiving",
        "act": "Accept a gift without deflecting."
      },
      "reintegration": {
        "enacted": true,
        "resistance_level": 2,
        "summary": "short abstract"
      }
    }
  ]
}
```

## Encryption
**Key derivation:** Passphrase-derived key using Argon2id.
- **Input:** Seeker passphrase
- **Output:** Master encryption key (MEK)
- **Storage:** MEK never stored on server or device in plaintext

**At rest (local):**
- Totem JSON encrypted with MEK
- Stored locally on device (app sandbox / OS keychain for metadata only)

**In transit (cloud sync):**
- Client encrypts Totem JSON with MEK before upload
- Server stores only ciphertext blobs
- Server cannot decrypt

## Cloud Sync (Default)
- Server stores encrypted blobs keyed by `totem_id`
- Client uploads new version when updated
- Client pulls latest on launch or manual sync
- Conflict resolution: last-write-wins for v0.1

## Versioning & Conversion
- Totem versions are paired to client versions.
- A conversion service endpoint returns a Totem blob in the version required by a client.
- Conversions are deterministic and forward-only (v0.1 → v0.2, etc.).
- The conversion service never sees plaintext; conversion happens client-side unless a future encrypted transform is defined.

### Proposed Endpoint (Future)
`POST /totem/convert`
```json
{
  "from_version": "0.1",
  "to_version": "0.2",
  "encrypted_blob": "base64",
  "metadata": { "client_version": "0.2.3" }
}
```

Response:
```json
{
  "encrypted_blob": "base64",
  "to_version": "0.2"
}
```

## Export / Import
- Export returns encrypted JSON blob + metadata
- Import accepts encrypted JSON blob, rehydrates into local store
- Human-readable export is out of scope for v0.1

## API Surfaces (Future)
This is a client-owned artifact. The temple only receives:
- A **session-scoped summary payload** (derived from Totem) for opening question selection
- No Totem upload unless the client explicitly syncs

## Security & Privacy
- No server-side plaintext
- No identity binding beyond Totem ID
- The Seeker can delete their Totem locally and remotely at any time

## Open Questions
- Do we want per-field encryption or whole-blob encryption? (v0.1 uses whole-blob)
- How do we migrate Totem versions without breaking old clients?
