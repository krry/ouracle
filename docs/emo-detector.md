# Emo-Detector (Circumplex Affect Tracking)

**Status:** Implemented (v0.4)

The emo-detector extends Ouracle's inference with Russell's Circumplex model of affect. For each seeker message, the system computes:

- **valence** (negative to positive, -1.0 to +1.0)
- **arousal** (low/deactivated to high/activated, -1.0 to +1.0)
- **gloss** (brief affect label, e.g., "anxious anticipation")
- **confidence** (low/medium/high)
- **reasoning** (one-sentence justification)

Affect data is stored in the `conversation` JSONB field, attached to each seeker turn, and exposed via API responses.

---

## API Changes

### `/enquire` (SSE)

After affect inference completes, the server emits an additional SSE event:

```json
{ "type": "affect", "valence": 0.4, "arousal": -0.2, "gloss": "tentative hope", "confidence": "medium", "reasoning": "..." }
```

The final `complete` event also includes the latest affect in its payload:

```json
{ "type": "complete", "stage": "inquiry", "session_id": "...", "turn": 2, "affect": { "valence": 0.4, "arousal": -0.2, "gloss": "...", "confidence": "medium" } }
```

### `/inquire` (JSON)

The JSON response now contains an `_meta.affect` object:

```json
{
  "session_id": "...",
  "stage": "inquiry",
  "turn": 2,
  "question": "...",
  "awaiting": "response",
  "_meta": {
    "vagal_hint": "sympathetic",
    "belief_hint": "scarcity",
    "quality_hint": "activity",
    "affect": { "valence": 0.4, "arousal": -0.2, "gloss": "tentative hope", "confidence": "medium" }
  }
}
```

---

## Data Model

The `sessions.conversation` column (JSONB) now includes, for each seeker entry:

```json
{
  "role": "seeker",
  "text": "I'm feeling really anxious about this.",
  "at": "2026-03-17T23:10:00.000Z",
  "affect": {
    "valence": -0.7,
    "arousal": 0.8,
    "gloss": "high anxiety",
    "confidence": "high",
    "reasoning": "phrases like 'anxious about this' and 'really' suggest high arousal and negative valence"
  }
}
```

No database schema change was required.

---

## Implementation Notes

- `infer()` (in `api/engine.js`) now returns `{ vagal, belief, quality, affect }`.
- Affect inference is performed in parallel with semantics via `Promise.all([inferSemantics, inferAffect])`.
- Validation (range clamping, gloss truncation to ≤7 words) happens in `engine.js`.
- When `SEMANTIC_INFERENCE` is disabled, a neutral affect fallback is provided.

---

## Frontend / TUI Notes

The TUI can subscribe to the `affect` SSE event to update a live "mood ring" indicator showing current position on the circumplex. Over time, the frontend can plot valence/arousal trajectories by reading the conversation array.

---

## Development

Demo script: `scripts/affect-demo.js` (run with Bun: `bun run scripts/affect-demo.js`).

Design spec: `docs/circumplex-emo-detector.md`.
