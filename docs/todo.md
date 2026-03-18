**TODO**

# Next to do for v0.3

- [ ] covenant-rite — copy + staging redesign
- [ ] tui-torus — visual, self-contained
- [ ] octave-ambiance — requires mapping work first
- [ ] tui-stt — testing + wiring
- [ ] web-aura — bigger, WebGL work
- [ ] emo-detector — v0.4
- [ ] companions — post v1.0      
- [x] rite-card-ui — quickest win, all frontend
- [x] reintegration-greeting — one clea-prompt.js edit
- [x] reintegration-panel
   - [x] cards are non-blocking of the conversation
   - [x] structural but contained - cards show here too
- [x] mobile layout for bottom bar
- [x] rite-deck-pairing — depends on rite-card-ui
- [x] map-pathways — doc work

## TUI tuneup
- [ ] test speech to text and text to speech
- [ ] toggle dev mode more easy; keymaps?
- [ ] write a script for the typical ouracle consultation
- [ ] have claude pass through the conversation UX after writing a script

## EMO DETECTOR
- [ ] evaluation inquiries and seeker messages according to Russell's Circumplex model, tracking position on the 2D map over time
  - Circumplex guardrails are a perfect fit for Ouracle—it’s basically giving the oracle a mood-ring API.

  If you sketch them as contracts, you can keep them very lean:

  - Always force numeric output on fixed ranges, e.g. valence and arousal in ‎`[−1.0, +1.0]`, plus a very short natural-language gloss.

  - Require the model to justify coordinates in lived semantics: what in the language implies “high arousal” vs “low,” etc.

  - Add a hard rule that if the affect is ambiguous or mixed, it must say so and still pick a best-guess coordinate, with a note like “low :confidence, conflicting cues.”

# DONE

- [x] figure out the covenant dance in the TUI
- [x] find the priestess a better voice on fish.audio — FISH_AUDIO_VOICE_ONDREA (fallback: GALADRIEL)
- [x] pace the typewriter with the speech so it doesn't talk over itself — priestess_target_duration_ms synced to TTS
- [x] voice layer: Priestess character fully developed — see docs/clea.md
- [x] >= 10 perfect opening questions for engine.js
- [x] why is the api/engine in js?
- [x] answering the opening question: 402 for openrouter, needs backup
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
