**TODO**

# Web Polish v0.1.1

- [ ] body text should be the `font-serif` Crimson Pro, not `font-mono`
- [ ] `font-mono` should be Fira Code first, remove JetBrains
- [ ] the floating particles are cool, but look like sharp rectangles; can we make them star-shaped? stars with a varied number of points from 3 to 9 would be cool, and some variance in color the way we vary colors in the aura of ripl?
- [ ] when I hit begin or enter I go to /chat but nothing happens when I submit text, and I don't think the STT is working; is it supposed to start an Ouracle /aspire session?

# Prime directive
- [x] >= 10 perfect opening questions for engine.js
- [x] why is the api/engine in js?
- [x] answering the opening question: 402 for openrouter, needs backup

- [x] voice layer: Priestess character fully developed — see docs/clea.md

## Post RIPL integration cleanup
- [x] clickable ripples are not present in ripl
- [x] text wrap for dev-less hole lines: seeker crash + wrap fixed; priestess wrap fixed
- [x] priestess text hugs the hole edge — wrap_width has no visual margin (full area width)
- [x] the space bar lag reduced (300ms→120ms) but dictation/STT still untested
- [x] why is name password asked before and without aura?
- [x] default to /dev off
- [x] if missing all bootstrap files, just write them
- [x] bootstrap scaffold dialog script should say
  - title: Prepare for Agents?
  - if files not present, just make them and don't show a dialog
  - if files are present, multiple choice:
    - "Do it:"
      - "[C]lean - overwrite and start fresh"
      - "[D]irty - append and mix it up"
      - "[E]gotistically - I know what I'm doing already"
      

## TUI tuneup
- [ ] test speech to text and text to speech
- [ ] toggle dev mode more easy; keymaps?
- [ ] figure out the covenant dance in the TUI
- [ ] write a script for the typical ouracle consultation
- [x] find the priestess a better voice on fish.audio — FISH_AUDIO_VOICE_ONDREA (fallback: GALADRIEL)
- [x] pace the typewriter with the speech so it doesn't talk over itself — priestess_target_duration_ms synced to TTS
- [ ] have claude pass through the conversation UX after writing a script

## EMO DETECTOR
- [ ] evaluation inquiries and seeker messages according to Russell's Circumplex model, tracking position on the 2D map over time
  - Circumplex guardrails are a perfect fit for Ouracle—it’s basically giving the oracle a mood-ring API.

  If you sketch them as contracts, you can keep them very lean:

  - Always force numeric output on fixed ranges, e.g. valence and arousal in ‎`[−1.0, +1.0]`, plus a very short natural-language gloss.

  - Require the model to justify coordinates in lived semantics: what in the language implies “high arousal” vs “low,” etc.

  - Add a hard rule that if the affect is ambiguous or mixed, it must say so and still pick a best-guess coordinate, with a note like “low :confidence, conflicting cues.”
