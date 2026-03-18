# Rite–Deck Pairing

When a rite is prescribed, it can optionally be paired with a drawn card that resonates with the same octave or quality. The card deepens the symbolic layer without complicating the flow — it is supplementary, not required.

---

## Why pair

A rite is an act. A card is a mirror. When both come from the same attractor — the same quality, the same vagal orientation — they reinforce each other through a different sense-making channel. The rite gives the seeker something to *do*; the card gives them something to *see*.

The pairing is especially useful when:
- The rite is abstract or difficult to visualize (e.g., a breath practice, a walk)
- The seeker has an existing relationship with a specific deck
- The quality is archetypal enough to have strong card resonances (grief, rage, longing, wonder)

---

## Two pairing modes

### 1. Octave resonance (automatic)

The server matches card keywords to the session's quality and vagal state.

**Logic:**
1. The prescribed rite carries a `quality` (e.g., `grief`, `rage`, `longing`) and a `vagal_state` (`dorsal`, `sympathetic`, `ventral`)
2. `drawDivinationSource()` already selects a divination *source type* (tarot, iching, etc.) based on `quality`
3. Extend this: after selecting the source, draw one card from that source and score its keywords against the quality and vagal state
4. High-resonance cards (≥2 keyword matches) are preferred; fall back to a random draw if none score high enough
5. Attach the card to `ritePayload.pairedCard`

**Scoring sketch:**
```js
function scoreCardResonance(card, quality, vagalState) {
  const targets = [quality, vagalState, ...getQualityAliases(quality)];
  return card.keywords.filter(k =>
    targets.some(t => k.toLowerCase().includes(t.toLowerCase()))
  ).length;
}
```

### 2. Seeker-chosen (manual)

Before or during offering, the seeker can indicate a preferred deck. If a deck preference is present on the session (or extracted from the seeker's messages), use that deck for the pairing draw.

**Logic:**
- Check `session.deck_preference` (not yet a field — would be set during inquiry if seeker mentions a deck)
- Or: present the pairing as optional in the OraclePanel after the rite is shown — *"Would you like a card to sit alongside this rite?"* — and let the seeker choose their deck before drawing

---

## Integration point

The pairing attaches to `ritePayload` at the point where it is assembled in `index.js`, just before the `rite` event is emitted to the frontend. See the `// TODO: rite-deck-pairing` comment in `api/index.js`.

The paired card, if present, would appear in `OraclePanel` beneath the rite — not as a separate draw event, but as part of the rite's visual display.

---

## Frontend rendering

In `OraclePanel.svelte` (rite state), check for `rite.pairedCard`:
- If present: render below the rite act, with its title, keywords, and body in the card style already established in Chat.svelte
- If absent: no change to current display

The pairing is always optional — `ritePayload.pairedCard` may be `null` or absent, and the UI degrades gracefully.

---

## What this is NOT

- Not a full divination session — the card doesn't start a new inquiry
- Not shown instead of the rite — always secondary
- Not guaranteed — some qualities may not have strong card resonances; the pairing can be skipped

---

## Open questions

- Should the pairing be togglable by the seeker (opt-in in OraclePanel)?
- Should the seeker be able to request an interpretation of the paired card (triggering `mode: 'interpret'`)?
- Is `deck_preference` worth adding to the session schema, or is it always inferred from the seeker's message?
