# macOS Dictation Setup

macOS has a built-in dictation engine that can be faster than Whisper for casual, short-form input.

## Enable Dictation

1. Open System Settings.
2. Navigate to Keyboard.
3. Toggle Dictation to On.

## Shortcut

Use `F5` or double-press the `Fn/Globe` key.

## Caveat

Dictation output writes through the OS Accessibility layer and lands in the terminal scroll buffer. It does not enter the TUI input field (crossterm raw-mode events are bypassed).

## Recommendation

Use Space-hold (Whisper) for in-TUI voice input, and use macOS dictation in standard terminal sessions or other apps.
