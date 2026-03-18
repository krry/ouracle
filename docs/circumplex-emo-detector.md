# Emo-Detector v0.4 — Circumplex Affect Tracking

**Status:** Implemented in `main` (merged from parallel development)

## Goal

Add Russell's Circumplex model of affect (valence × arousal) to Ouracle's inference pipeline. Track emotional coordinates over the course of a session and expose them to frontend/TUI for a "mood-ring" visualization. The affect data lives in the conversation JSONB — no schema change required.

---

## Design

### Inference Integration

`api/engine.js`'s `infer()` function now performs two parallel LLM calls:
- `inferSemantics()` — existing vagal/belief/quality
- `inferAffect()` — new valence/arousal/gloss/confidence/reasoning

Results are merged: `{ ...semantics, affect }`.

### Affective Schema

```ts
interface Affect {
  valence: number;   // [-1.0, +1.0]
  arousal: number;   // [-1.0, +1.0]
  gloss: string;     // 5–7 words
  confidence: 'low' | 'medium' | 'high';
  reasoning: string; // one sentence
}
```

### Validation

- Clamp valence/arousal to [-1,1] if out of range → confidence set to low.
- Truncate gloss to 7 words if longer → confidence set to low, reasoning prefixed.

### Fallbacks

- `SEMANTIC_INFERENCE=false`: `affect = { valence: 0, arousal: 0, gloss: 'neutral', confidence: 'low', reasoning: 'inference disabled' }`
- Embeddings mode: neutral affect with low confidence.

### Storage & Emission

- Attached to each seeker message in `conversation` array (JSONB).
- Emitted via SSE as `{ type: 'affect', ... }` in `/chat`.
- Included in `_meta.affect` for both `/inquire` and `/chat` complete events.

---

## Files Modified

- `api/infer.js` — add `AFFECT_TOOL`, `AFFECT_SYSTEM_PROMPT`, `inferAffect()`
- `api/engine.js` — parallel calls, validation, fallback affects
- `api/index.js` — destructure `affect` from `infer()`; attach to conversation; emit SSE `affect` events; include in `_meta`
- `apps/web/src/lib/Chat.svelte` — handle new `affect` events, update TUI/state

---

## Comparison Metrics (Parallel Dev)

- Time to implementation: ~1 session
- Token overhead: +1 parallel LLM call per inference (acceptance trade)
- Code modularity: high (separate tool, central validation in engine)
- Error handling: robust (fallback neutral, clamping)

---

## Future Work

- Frontend visualization of affect trajectory in Ripl/TUI.
- Dynamic prompts that adapt to valence/arousal (e.g., softening for high distress).
- Long-term mood trends in seeker history.
