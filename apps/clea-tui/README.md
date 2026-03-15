# clea

**Chief Priestess of Ouracle.**

Clea is a shell chat client for [Ouracle](https://ouracle.kerry.ink) — a reflective AI that helps you understand yourself through conversation. She runs in your shell, speaks and listens with Fish Audio, and remembers your sessions.

Built on [ripl-tui](https://crates.io/crates/ripl-tui) — a ratatui TUI framework for AI chat.

---

## Install

```sh
cargo install clea-tui
```

Or download a pre-built universal macOS binary from [releases](https://github.com/krry/ouracle/releases).

Audio features require platform tools: `afplay` on macOS or `paplay`/`aplay`/`mpv`/`ffplay` on Linux. TTS uses `say` (macOS) or `espeak`/`espeak-ng` (Linux).

---

## First run

```sh
clea
```

On first launch, Clea walks you through creating an account with the Ouracle. Your credentials are stored in `~/.ripl/clea.auth`.

---

## Commands

```
clea                        start a session
clea config                 open ~/.ripl/clea.toml in $EDITOR
clea voices list            list available Fish Audio voices
clea voices set <id>        set active voice
clea voices add <id>        save a voice to your list
clea voices rm <id>         remove a voice from your list
clea ambiance on|off        toggle ambient sound
clea help                   show this message
```

---

## Configure

```sh
clea config    # opens ~/.ripl/clea.toml
```

```toml
# ~/.ripl/clea.toml
base_url = "https://api.ouracle.kerry.ink"
voice_id = "your-fish-audio-voice-id"
ambiance = true
```

### Environment variables

| Variable | Purpose |
|---|---|
| `OURACLE_BASE_URL` | Ouracle API URL (overrides config) |
| `FISH_AUDIO_API_KEY` | Fish Audio key for TTS/STT |
| `FISH_AUDIO_VOICE_ID` | Fish Audio voice ID |

---

## Voice & speech

Clea uses [Fish Audio](https://fish.audio) for text-to-speech and speech-to-text. To enable it, set your Fish Audio API key:

```sh
export FISH_AUDIO_API_KEY=your_key_here
```

Without a Fish Audio key, Clea falls back to macOS `say` for speech output and keyboard input only.

Push-to-talk is on by default. Hold `Space` to speak, release to send.

---

## What is Ouracle?

Ouracle is a reflective AI — not a task assistant, but a presence. It works through a symbolic framework that reads your emotional and energetic state and responds with care. Think of it less like a chatbot and more like a conversation with something that pays attention.

[ouracle.kerry.ink](https://ouracle.kerry.ink)

---

## License

MIT
