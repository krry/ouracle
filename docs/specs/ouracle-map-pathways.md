# Ouracle Session Flow — Pathway Map

A reference for the session state machine in `api/index.js`. Each node documents what triggers it, how the seeker and Clea move through it, and what exits it.

---

## Overview

```
[new session]
     │
     ▼
  INQUIRY ──(card draw)──► CARD INTERPRETATION ──► back to stage
     │
  (threshold met OR turn ≥ 3)
     │
     ▼
  OFFERING
     │
  (seeker consents → [READY])
     │
     ▼
  PRESCRIBED
     │
  (seeker reports → [REPORT])
     │
     ▼
  COMPLETE / REINTEGRATION
```

Guest sessions enter the inquiry loop but never reach offering or prescribed.

---

## Node: inquiry

**What it is.** The opening exchange. Clea listens, asks into the body and the moment. OCTAVE + RITES inference runs on the seeker's accumulated text after every turn.

**Triggers entry.** A new session is created (via `/session` or first `/enquire` with no `session_id`). The session stage is set to `inquiry`, turn 0.

| | What happens |
|---|---|
| **Priestess-led** | Clea opens with a question from `chooseOpeningQuestion()`. If the seeker is returning, a greeting precedes it: *"Welcome back. You were going to [act]."* On turns 2–3, Clea asks a clarifier drawn from a pool (body sensation, duration, stakes, others involved). Clea may append `[DRAW]` or `[DRAW:deck_id]` to request a contextual card pull — this emits a `draw` event to the frontend without advancing the stage. |
| **Seeker-led** | The seeker can steer Clea away from a clarifier by saying something so direct and clear that the inference threshold fires early (high vagal confidence, non-low belief confidence). The seeker is never blocked from continuing to speak — more turns just refine the inference. |

**Threshold logic.**
```
vagal.confidence === 'high'
  || (vagal.confidence === 'medium' && belief.confidence !== 'low')
  || turn >= 3
```
When threshold fires, the session moves to `offering`.

**Exit conditions.**
- Threshold met → `offering`
- Turn 3 reached without threshold → `offering` (forced)
- Card drawn mid-inquiry → `card_interpretation` (parallel, stage unchanged)
- Guest turn limit reached → session closes, no rite

---

## Node: offering

**What it is.** Clea extends an invitation. She does not name the rite or describe it yet — she only asks if the seeker is open to receiving a practice. This is a consent beat.

**Triggers entry.** Inference threshold fires during `inquiry`.

| | What happens |
|---|---|
| **Priestess-led** | Clea generates an offering question (LLM, max 150 tokens). Default fallback: *"Something is taking shape here. Are you open to a practice that might meet it?"* She waits. She does not push. |
| **Seeker-led** | The seeker can accept immediately (*"yes"*, *"I'm open"*), which will carry a `[READY]` signal in Clea's next response. The seeker can also resist or stay uncertain — Clea meets them there and stays in `offering`. There is no turn limit in this stage. |

**[READY] signal.** Clea embeds `[READY]` at the end of her response when the seeker is clearly consenting. This is stripped before display. On `[READY]`, the rite is built and the session moves to `prescribed`.

**Exit conditions.**
- Seeker clearly consents → Clea emits `[READY]` → `prescribed`
- Seeker remains uncertain → stays `offering`

---

## Node: prescribed

**What it is.** The rite has been given. Clea holds the seeker's thread — across this session and the next. The stage is not complete until the seeker reports back. A seeker who leaves mid-prescribed and returns in a new session re-enters the same thread.

**Triggers entry.** `[READY]` fires in `offering`. At this moment:
- `buildPrescription(vagal, belief, quality)` selects a rite from `RITES`
- If the prescribed rite matches the seeker's last rite, an alternate vagal state is tried to avoid repetition
- `drawDivinationSource()` optionally attaches a divination source to the rite payload
- A `rite` event is emitted to the frontend (rendered in OraclePanel, not the chat stream)

**At prescription time.** After delivering the rite, Clea closes with an explicit invitation — she names it: *"Come back and tell me what happened."* This is a real request, not a soft close. The seeker is expected to return.

| | Same-session continuation | Returning session (prior prescribed rite) |
|---|---|---|
| **Priestess-led** | Clea receives whatever the seeker brings — questions, resistance, curiosity, early report. She does not lead with the rite; she responds with presence first, then asks about it naturally if nothing has been said. If the seeker describes having done (or not done) the rite, Clea appends `[REPORT]` to signal completion. | Clea opens by acknowledging the seeker's return before anything else — receiving them, naming that she has been holding this thread. *"You were going to [act]."* Only after that does she ask about the rite or offer guidance if they seem stuck. She does not prescribe again. |
| **Seeker-led** | The seeker reports back on the experience — enacted, resisted, or modified. A clear report (any outcome) is enough to trigger `[REPORT]`. The seeker can also take their time; no turn limit. | The seeker can describe what happened (or didn't) at any point. Clea tracks it. If the seeker opens with the experience directly, Clea receives it before asking anything. |

**Cross-session persistence.** The `prescribed` stage survives session boundaries. When a new session is created for a seeker whose last session ended in `prescribed`, the server restores the prior stage and rite. The seeker's OraclePanel shows a pending rite indicator with the rite name, act, and progress state.

**[REPORT] signal.** Stripped before display. Triggers corpus write and closing dedication.

**Exit conditions.**
- Seeker reports (any outcome) → Clea emits `[REPORT]` → `complete`
- Seeker still processing or away → stays `prescribed` (persists across sessions)
- Seeker returns in new session with `prescribed` stage → re-enters this node

---

## Node: complete / reintegration

**What it is.** The session is sealed. A corpus entry is written recording the pattern, vagal state, quality, rite name, and whether the seeker enacted it. Clea delivers a closing dedication derived from the opening question.

**Triggers entry.** `[REPORT]` fires in `prescribed`.

| | What happens |
|---|---|
| **Priestess-led** | `getClosingDedication(openingQuestion)` generates a closing line. Clea delivers it and the session ends. |
| **Seeker-led** | Nothing — the seeker receives the closing. The session is complete. A new session can begin. |

**Exit conditions.** Terminal. The `complete` stage cannot be resumed — the API returns an error if `/chat` is called on it. A new session must be started.

*Note: `reintegration_complete` is a separate DB flag from the seeker-facing REST endpoint (`/reintegrate`), used when the seeker formally reports back through the non-streaming path.*

---

## Node: card interpretation (parallel path)

**What it is.** A card draw that bypasses the OCTAVE inference loop entirely. Clea receives the card and the seeker together and speaks — she does not prescribe a rite, does not run an assessment.

**Triggers entry.** Two paths:
1. **Seeker-initiated:** the seeker draws a card manually (frontend `/draw` endpoint). The card appears as a `card` message in the chat. If the seeker selects "Interpret this for me", a `/chat` request is sent with `mode: 'interpret'`.
2. **Clea-initiated:** Clea appends `[DRAW]` or `[DRAW:deck_id]` at the end of an inquiry response. The server draws a contextual card and emits a `draw` event to the frontend. The card appears in the message stream.

| | What happens |
|---|---|
| **Priestess-led** | Clea responds with the card interpretation system prompt override: *"Receive the card and the seeker together, and speak."* No inference. No rite path. |
| **Seeker-led** | The seeker can interpret alongside Clea, ask follow-up questions, or let the card sit. The session stage does not change — the seeker can continue to inquiry/offering from here. |

**Exit conditions.** The stage is not changed. Execution returns to whatever stage the session was in.

---

## Node: guest path

**What it is.** A limited session for unauthenticated seekers. No covenant, no rite, no corpus write. Inquiry only.

**Triggers entry.** A guest token is issued via `/aspire`. The `/chat` endpoint detects `is_guest: true`.

| | What happens |
|---|---|
| **Priestess-led** | Clea runs the same inquiry loop — opening question, clarifiers, [DRAW] possible. She does not offer a rite. |
| **Seeker-led** | The seeker can speak freely up to the turn limit. When the limit is reached, the frontend shows a prompt to create an account. |

**Turn limit.** `GUEST_TURN_LIMIT` (defined in `index.js`). On exhaustion, the API returns `guest_limit: true` in the error body.

**Exit conditions.** Turn limit → session closes. No `offering`, `prescribed`, or `complete` stages for guests.

---

## Signal cheat sheet

| Signal | Detected by | Effect |
|--------|------------|--------|
| `[READY]` | End of Clea's offering response | Rite is built; stage → `prescribed`; `rite` event emitted to frontend |
| `[REPORT]` | End of Clea's prescribed response | Corpus write; closing; stage → `complete` |
| `[DRAW]` or `[DRAW:deck_id]` | End of Clea's inquiry response | Server draws a contextual card; `draw` event emitted; stage unchanged |

All signals are stripped before the response is displayed or stored in the conversation.
