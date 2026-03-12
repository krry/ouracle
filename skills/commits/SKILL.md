---
name: commits
description: Use when asked to commit code or ship changes; ensure versions/tags are bumped with scripts when appropriate and keep commits scoped.
---

# Commits

## Overview
Provide a disciplined commit workflow that scopes changes, bumps versions when needed, and tags milestones using the project scripts.

## Workflow

### 1. Inspect Scope
- Check `git status --short` and relevant diffs.
- Identify whether changes touch API, TUI, or both.
- Ask one clarifying question if commit scope is ambiguous.

### 2. Apply Versioning (When Appropriate)
- If API behavior changed or endpoints moved, bump API version via `scripts/bump_api.sh <version>`.
- If TUI behavior changed, bump TUI version via `scripts/bump_tui.sh <version>`.
- If user asked for a milestone or phase, create a tag via `scripts/tag_phase.sh <tag> [message]`.
- Only bump/tag when the user requested it or when it is clearly implied by the request.

### 3. Stage Precisely
- Stage only the files intended for the commit.
- Avoid staging unrelated changes; call them out explicitly.

### 4. Commit
- Use concise, descriptive messages (e.g., `feat(tui): ...`, `fix(api): ...`, `docs: ...`).
- Split into multiple commits when changesets are distinct.

### 5. Report State
- Confirm what was committed and what remains uncommitted.

## Resources
- `scripts/bump_api.sh` — update API version in `api/package.json` and `api/index.js`.
- `scripts/bump_tui.sh` — update TUI version in `apps/tui/Cargo.toml`.
- `scripts/tag_phase.sh` — create annotated git tags for milestones.
