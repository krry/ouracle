**TODO**


# Next to do for v0.5+
- [ ] octave-ambiance — requires mapping work first
- [ ] companions — post v1.0
- [ ] web-aura — bigger, WebGL work

## TUI tuneup
- [ ] test speech to text and text to speech in TUI
- [ ] toggle dev mode more easy; keymaps?
- [ ] write a script for the typical ouracle consultation
- [ ] have claude pass through the conversation UX after writing a script

## EMO DETECTOR / INFERENCE
- [ ] rite generation quality tuning — test generated rites across vagal states; refine system prompt based on output
- [ ] octave quality inference accuracy — evaluation against labeled test cases
- [ ] evaluation inquiries and seeker messages according to Russell's Circumplex model, tracking position on the 2D map over time

# DONE

- [x] identity block moved to SeekerPanel bottom; handle rename field; Seeker tab shows username
- [x] account creation deferred — guest session first, sign-in only after first exchange
- [x] rite generation — LLM synthesizes rites from conversation (rite-gen.js, PR #21)
- [x] tarot card images — symlink static/tarot → assets/tarot (PR #20)
- [x] web ambient audio layer — AmbientControls.svelte + ambientEngine/ambientPlayer
- [x] web voice input (STT/PTT) — wired in Chat.svelte, push-to-talk UI
- [x] web thread view — ThreadsPanel.svelte in SeekerPanel
- [x] streaming responses — /enquire uses SSE
- [x] covenant-rite — copy + staging redesign
- [x] tui-torus — visual, self-contained
- [x] rite-card-ui — quickest win, all frontend
- [x] reintegration-greeting — one clea-prompt.js edit
- [x] reintegration-panel
   - [x] cards are non-blocking of the conversation
   - [x] structural but contained - cards show here too
- [x] mobile layout for bottom bar
- [x] rite-deck-pairing — depends on rite-card-ui
- [x] map-pathways — doc work
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
- [x] emo-detector — Russell's Circumplex affect detection (valence/arousal tracking, SSE integration, demo validation)
