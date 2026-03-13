**TODO**

## TUI tuneup
- [ ] test speech to text and text to speech
- [ ] toggle dev mode more easy; keymaps?
- [ ] wire up TUI with openclaw?
- [ ] figure out the covenant dance in the TUI
- [ ] write a script for the typical ouracle consultation
- [ ] find the priestess a better voice on fish.audio
- [ ] pace the typewriter with the speech so it doesn't talk over itself
- [ ] have claude pass through the conversation UX after writing a script

## EMO DETECTOR
- [ ] evaluation inquiries and seeker messages according to Russell's Circumplex model, tracking position on the 2D map over time
  - Circumplex guardrails are a perfect fit for Ouracle—it’s basically giving the oracle a mood-ring API.

  If you sketch them as contracts, you can keep them very lean:

  - Always force numeric output on fixed ranges, e.g. valence and arousal in ‎`[−1.0, +1.0]`, plus a very short natural-language gloss.

  - Require the model to justify coordinates in lived semantics: what in the language implies “high arousal” vs “low,” etc.

  - Add a hard rule that if the affect is ambiguous or mixed, it must say so and still pick a best-guess coordinate, with a note like “low :confidence, conflicting cues.”
