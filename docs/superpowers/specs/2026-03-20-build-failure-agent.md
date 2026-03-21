# Build Failure Agent

**Date:** 2026-03-20
**Status:** Approved

## Problem

Vercel build failures on `main` require manual diagnosis and repair. The failure sits until someone notices it, reads the logs, and commits a fix — all toil.

## Goal

When a Vercel deployment fails, automatically notify Hermes (a model-agnostic local agent) via Telegram with enough context to diagnose and push a fix without human intervention.

## Design

### Trigger

GitHub `deployment_status` event, filtered to `state: failure`. Vercel automatically reports deployment status back to GitHub — no webhook configuration required.

Filter to ouracle's web deployment only by checking that the deployment URL matches `*ouracle*.vercel.app` in the workflow `if` condition.

### Workflow: `.github/workflows/debug-build-failure.yml`

**Step 1 — Extract context from event payload**

Available directly from `github.event`:
- `deployment.environment_url` — public deployment URL (e.g. `https://ouracle-abc123.vercel.app`)
- `deployment.sha` — commit SHA
- `deployment.ref` — branch name

**Step 2 — Fetch commit message**

`GITHUB_TOKEN` is auto-provisioned in every Actions run. Use it:
```
GET /repos/{owner}/{repo}/commits/{sha}
Authorization: Bearer $GITHUB_TOKEN
```
Extract `.commit.message` (first line only).

**Step 3 — Resolve Vercel deployment ID and fetch build logs**

```
GET https://api.vercel.com/v9/deployments?url={deployment_url}
Authorization: Bearer $VERCEL_TOKEN
```
Extract `.deployments[0].uid` as the deployment ID. Then:
```
GET https://api.vercel.com/v2/deployments/{id}/events
Authorization: Bearer $VERCEL_TOKEN
```
Collect `text` fields from log event objects. **Take the last 3000 characters** — build failures surface at the tail, not the head. If this API call fails for any reason, continue with an empty log body.

**Step 4 — Send Telegram message**

Endpoint: `https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage`

Body (JSON, `parse_mode: HTML` to avoid markdown escaping issues in bash):
```
🔴 <b>Build failure: ouracle/apps/web</b>

Commit: {sha_short} — {commit_message_first_line}
Branch: {ref}
Deployment: {url}

<pre>{logs_tail}</pre>

Please fix the build failure, commit, and push to main.
```

Telegram's message limit is 4096 characters. With ~200 chars of header and the 3000-char log tail, this fits cleanly. If logs are empty (fetch failed), omit the `<pre>` block.

**Step 5 — Done.** Hermes handles analysis, fix, and push.

### Runaway loop guard

Hermes's commits will trigger another `deployment_status` event. To prevent a feedback loop, add a condition to skip the workflow if the triggering commit message starts with `fix(auto):`. This matches the convention already in use in the repo.

```yaml
if: |
  github.event.deployment_status.state == 'failure' &&
  !startsWith(github.event.deployment.description, 'fix(auto):')
```

Note: `deployment.description` may not reliably carry the commit message — an alternative is to fetch the commit message in step 2 and add a job-level `if` on it after that step, or simply accept that a broken auto-fix will notify Hermes again (one retry is acceptable, infinite loops are not). Implementation should prefer the simple path and monitor for loops in practice.

### Implementation

Pure bash + curl — no Node.js, no npm, no external actions. The workflow is self-contained.

### Secrets Required

| Secret | Purpose |
|--------|---------|
| `VERCEL_TOKEN` | Fetch deployment ID + logs via Vercel API |
| `TELEGRAM_BOT_TOKEN` | Authenticate with Telegram Bot API |
| `TELEGRAM_CHAT_ID` | Target chat where Hermes listens |
| `GITHUB_TOKEN` | Auto-provisioned — fetch commit message |

### Scope

This workflow only sends a notification. It does not attempt to apply fixes itself. All repo writes are performed by Hermes.

## Out of Scope

- Deduplication beyond the loop guard above
- Fix verification
- Other apps/services beyond `apps/web`
