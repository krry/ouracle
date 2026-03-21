# Build Failure Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically notify Hermes via Telegram when a Vercel production deployment fails, with enough context to diagnose and push a fix.

**Architecture:** A single GitHub Actions workflow triggers on `deployment_status: failure` for Vercel Production deployments. It fetches build logs from the Vercel API and sends a formatted HTML message to Hermes via Telegram Bot API. Hermes owns all analysis and repo writes.

**Tech Stack:** GitHub Actions, bash, curl, jq (pre-installed on `ubuntu-latest`)

---

## Files

| Action | Path |
|--------|------|
| Create | `.github/workflows/debug-build-failure.yml` |

No other files. No scripts. No dependencies.

---

### Task 1: Write the workflow skeleton

**Files:**
- Create: `.github/workflows/debug-build-failure.yml`

- [ ] **Step 1: Create the workflow file with trigger, permissions, and job guard**

```yaml
name: notify hermes on build failure

on:
  deployment_status:

permissions:
  contents: read

jobs:
  notify:
    runs-on: ubuntu-latest
    # Filter to Vercel Production failures only.
    # Vercel sets deployment.environment to "Production" for main-branch deploys.
    # We also guard against re-triggering on Hermes's own auto-fix commits (handled in Task 2).
    if: |
      github.event.deployment_status.state == 'failure' &&
      github.event.deployment.environment == 'Production'
    steps:
      - name: placeholder
        run: echo "workflow skeleton"
```

`permissions: contents: read` is required for `github.token` to call the GitHub Commits API. Without it, the API call will 401 on repos with tightened default permissions.

`deployment.environment == 'Production'` is the reliable filter — Vercel sets this field explicitly. Using `deployment.ref == 'main'` is fragile because Vercel sometimes passes the full SHA as the ref.

- [ ] **Step 2: Validate workflow syntax**

```bash
cd /Users/kerry/house/desk/ouracle
brew install actionlint 2>/dev/null || true
actionlint .github/workflows/debug-build-failure.yml
```

Expected: no errors.

- [ ] **Step 3: Commit skeleton**

```bash
git add .github/workflows/debug-build-failure.yml
git commit -m "feat(ci): add build failure agent workflow skeleton"
```

---

### Task 2: Fetch commit message (with loop guard)

**Files:**
- Modify: `.github/workflows/debug-build-failure.yml`

- [ ] **Step 1: Replace placeholder step with commit message fetch**

Replace the `- name: placeholder` step with:

```yaml
      - name: fetch commit message
        id: commit
        env:
          GITHUB_TOKEN: ${{ github.token }}
        run: |
          SHA="${{ github.event.deployment.sha }}"
          RESPONSE=$(curl -s \
            -H "Authorization: Bearer $GITHUB_TOKEN" \
            -H "Accept: application/vnd.github+json" \
            "https://api.github.com/repos/${{ github.repository }}/commits/$SHA")

          # Extract subject line only (first line of commit message)
          MSG=$(echo "$RESPONSE" | jq -r '.commit.message' | head -1)
          echo "message=$MSG" >> $GITHUB_OUTPUT

          # Loop guard: skip if this is already a Hermes auto-fix commit
          if [[ "$MSG" == "fix(auto):"* ]]; then
            echo "skip=true" >> $GITHUB_OUTPUT
          else
            echo "skip=false" >> $GITHUB_OUTPUT
          fi
```

- [ ] **Step 2: Validate and commit**

```bash
actionlint .github/workflows/debug-build-failure.yml
git add .github/workflows/debug-build-failure.yml
git commit -m "feat(ci): fetch commit message and add auto-fix loop guard"
```

---

### Task 3: Fetch Vercel build logs

**Files:**
- Modify: `.github/workflows/debug-build-failure.yml`

- [ ] **Step 1: Add log-fetching step after the commit step**

```yaml
      - name: fetch vercel logs
        id: logs
        if: steps.commit.outputs.skip != 'true'
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
          VERCEL_TEAM_ID: ${{ secrets.VERCEL_TEAM_ID }}
        run: |
          TARGET_URL="${{ github.event.deployment_status.target_url }}"

          # Build team query param (empty string if VERCEL_TEAM_ID not set)
          TEAM_PARAM=""
          if [ -n "$VERCEL_TEAM_ID" ]; then
            TEAM_PARAM="&teamId=$VERCEL_TEAM_ID"
          fi

          # Resolve Vercel deployment ID from full URL (not stripped domain).
          # /v9/deployments?url= expects the full URL including https://.
          VERCEL_RESPONSE=$(curl -s \
            -H "Authorization: Bearer $VERCEL_TOKEN" \
            "https://api.vercel.com/v9/deployments?url=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$TARGET_URL")$TEAM_PARAM")

          DEPLOYMENT_ID=$(echo "$VERCEL_RESPONSE" | jq -r '.deployments[0].uid // empty')

          if [ -n "$DEPLOYMENT_ID" ]; then
            # Use /v9/ (not /v2/) — /v2/ is legacy and may return 404.
            # Response is NDJSON: one JSON object per line.
            EVENTS=$(curl -s \
              -H "Authorization: Bearer $VERCEL_TOKEN" \
              "https://api.vercel.com/v9/deployments/$DEPLOYMENT_ID/events?builds=1$TEAM_PARAM")

            # Parse NDJSON line-by-line: fromjson? tolerates non-JSON lines.
            LOGS=$(echo "$EVENTS" | jq -R 'fromjson? | .text? // empty' 2>/dev/null | \
              jq -r '.' | \
              tail -c 3000)

            # HTML-escape for Telegram parse_mode: HTML
            LOGS_ESCAPED=$(printf '%s' "$LOGS" | \
              sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g')
          else
            LOGS_ESCAPED=""
          fi

          # Write to file — avoids env var size limits for large logs
          printf '%s' "$LOGS_ESCAPED" > /tmp/build_logs.txt
```

Key decisions:
- Pass the **full URL** (including `https://`) to `v9/deployments?url=` — passing a bare domain returns no results
- Use `/v9/deployments/{id}/events` not `/v2/` — v2 is legacy
- NDJSON parsed with `jq -R 'fromjson?'` — reads each line as a raw string, attempts JSON parse, silently skips non-JSON lines (e.g. blank lines or SSE headers)
- `VERCEL_TEAM_ID` is optional — only appended when the secret is set

- [ ] **Step 2: Validate and commit**

```bash
actionlint .github/workflows/debug-build-failure.yml
git add .github/workflows/debug-build-failure.yml
git commit -m "feat(ci): fetch vercel build logs via /v9/ NDJSON events endpoint"
```

---

### Task 4: Send Telegram message to Hermes

**Files:**
- Modify: `.github/workflows/debug-build-failure.yml`

- [ ] **Step 1: Add Telegram notification step**

```yaml
      - name: notify hermes
        if: steps.commit.outputs.skip != 'true'
        env:
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
          # Pass as env var — never interpolate user-controlled strings inline in bash
          COMMIT_MSG: ${{ steps.commit.outputs.message }}
        run: |
          SHA="${{ github.event.deployment.sha }}"
          SHA_SHORT="${SHA:0:7}"
          REF="${{ github.event.deployment.ref }}"
          DEPLOY_URL="${{ github.event.deployment_status.target_url }}"
          LOGS=$(cat /tmp/build_logs.txt 2>/dev/null || echo "")

          if [ -n "$LOGS" ]; then
            LOG_SECTION="<pre>$LOGS</pre>"
          else
            LOG_SECTION="(Build logs unavailable — check Vercel dashboard)"
          fi

          MESSAGE="🔴 <b>Build failure: ouracle/apps/web</b>

Commit: $SHA_SHORT — $COMMIT_MSG
Branch: $REF
Deployment: $DEPLOY_URL

$LOG_SECTION

Please fix the build failure, commit, and push to main."

          # Enforce Telegram's 4096-char hard limit
          # (trim the log section if needed — it's the only variable-length part)
          MSG_LEN=${#MESSAGE}
          if [ "$MSG_LEN" -gt 4096 ]; then
            OVERFLOW=$(( MSG_LEN - 4090 ))
            TRIMMED_LOGS=$(printf '%s' "$LOGS" | head -c $(( ${#LOGS} - OVERFLOW )) )
            LOG_SECTION="<pre>$TRIMMED_LOGS</pre>"
            MESSAGE="🔴 <b>Build failure: ouracle/apps/web</b>

Commit: $SHA_SHORT — $COMMIT_MSG
Branch: $REF
Deployment: $DEPLOY_URL

$LOG_SECTION

Please fix the build failure, commit, and push to main."
          fi

          # Build JSON payload with jq --arg to avoid any escaping issues.
          # Do NOT encode $MESSAGE separately — jq handles all escaping internally.
          PAYLOAD=$(jq -n \
            --arg chat_id "$TELEGRAM_CHAT_ID" \
            --arg text "$MESSAGE" \
            '{
              chat_id: $chat_id,
              text: $text,
              parse_mode: "HTML",
              disable_web_page_preview: true
            }')

          curl -s -X POST \
            "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
            -H "Content-Type: application/json" \
            -d "$PAYLOAD"
```

`jq -n --arg text "$MESSAGE"` is the correct pattern — jq handles all JSON encoding internally. Using `jq -Rs .` and concatenating it into a larger JSON string would produce double-encoded output.

- [ ] **Step 2: Validate and commit**

```bash
actionlint .github/workflows/debug-build-failure.yml
git add .github/workflows/debug-build-failure.yml
git commit -m "feat(ci): send telegram notification to hermes on build failure"
```

---

### Task 5: Add secrets to GitHub repository

These are manual steps in the GitHub UI.

- [ ] **Step 1: Add VERCEL_TOKEN**

GitHub repo → Settings → Secrets and variables → Actions → New repository secret.

Name: `VERCEL_TOKEN`
Value: A Vercel personal access token. Generate at https://vercel.com/account/tokens. Needs read access to deployments and logs.

- [ ] **Step 2: Add TELEGRAM_BOT_TOKEN**

Name: `TELEGRAM_BOT_TOKEN`
Value: The bot token for the bot that messages Hermes.

- [ ] **Step 3: Add TELEGRAM_CHAT_ID**

Name: `TELEGRAM_CHAT_ID`
Value: The Telegram chat ID where Hermes listens.

- [ ] **Step 4: Add VERCEL_TEAM_ID (if applicable)**

Name: `VERCEL_TEAM_ID`
Value: The Vercel team ID (found in team settings), if the project lives under a team account. **Skip this if the project is on a personal Vercel account.** The workflow gracefully omits the `teamId` param if this secret is not set.

---

### Task 6: Smoke test

**Do not push a breaking commit to main.** Use a test branch to trigger a preview deployment — but our workflow only fires on `Production` environment. Instead, test the Telegram delivery in isolation first.

- [ ] **Step 1: Test Telegram delivery manually**

Run locally to verify the bot token, chat ID, and message format work:

```bash
TELEGRAM_BOT_TOKEN="your-token"
TELEGRAM_CHAT_ID="your-chat-id"

PAYLOAD=$(jq -n \
  --arg chat_id "$TELEGRAM_CHAT_ID" \
  --arg text "🔴 <b>Test: build failure notification</b>

Commit: abc1234 — test: smoke test
Branch: main
Deployment: https://ouracle-test.vercel.app

<pre>Error: Cannot find module 'sharp'</pre>

This is a test. Ignore." \
  '{chat_id: $chat_id, text: $text, parse_mode: "HTML", disable_web_page_preview: true}')

curl -s -X POST \
  "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"
```

Expected: Hermes receives a formatted message in Telegram.

- [ ] **Step 2: Trigger a real workflow run**

Temporarily reintroduce the `sharp` bug we just fixed (known build failure) to trigger a Vercel Production failure:

```bash
# In apps/web/package.json, add sharp back temporarily
# Then commit and push to main
git add apps/web/package.json
git commit -m "test: temporarily reintroduce sharp to trigger build failure"
git push
```

- [ ] **Step 3: Verify in GitHub Actions**

GitHub → Actions tab → `notify hermes on build failure` → confirm it runs and all steps succeed.

- [ ] **Step 4: Verify Hermes receives the message**

Check Telegram. Hermes should receive the full formatted notification within ~2 minutes.

- [ ] **Step 5: Revert**

```bash
git revert HEAD --no-edit
git push
```

Or if Hermes auto-fixed and pushed, verify main is green without manual intervention.
