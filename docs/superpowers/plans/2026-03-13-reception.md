# Reception Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reception (new seeker creation with emoji handle) and sign-in (handle + password) to the Ouracle API, then wire the `ouracle` binary to handle the full pre-RIPL flow inline.

**Architecture:** DB migration adds `handle` and `handle_base` columns. `db.js` gains `getSeekerByHandle` and `generateHandle`. Four API route changes (POST /seeker/new, POST /auth/token, POST /auth/refresh, new POST /covenant). The `ouracle` Rust binary gains a `reception.rs` module that handles terminal prompts before handing off to RIPL.

**Tech Stack:** Node.js/Express, Neon Postgres (`@neondatabase/serverless`), Rust 2024 edition, `reqwest` blocking, `ripl` path dep.

---

## Chunk 1: DB Migration + db.js

### Files
- Create: `api/migrations/006_add_handle.sql`
- Modify: `api/db.js`

---

### Task 1: DB migration — add handle columns

- [ ] **Create `api/migrations/006_add_handle.sql`:**

```sql
-- Add handle (unique sign-in name + emoji) and handle_base (slug only, for collision queries).
ALTER TABLE seekers ADD COLUMN IF NOT EXISTS handle TEXT;
ALTER TABLE seekers ADD COLUMN IF NOT EXISTS handle_base TEXT;

-- Fill existing rows so we can add NOT NULL constraint.
UPDATE seekers
SET handle_base = LOWER(REGEXP_REPLACE(COALESCE(name, 'seeker'), '[^a-z0-9]', '', 'g')),
    handle = LOWER(REGEXP_REPLACE(COALESCE(name, 'seeker'), '[^a-z0-9]', '', 'g')) || '🌙'
WHERE handle IS NULL;

ALTER TABLE seekers ALTER COLUMN handle SET NOT NULL;
ALTER TABLE seekers ALTER COLUMN handle_base SET NOT NULL;
ALTER TABLE seekers ADD CONSTRAINT seekers_handle_unique UNIQUE (handle);
CREATE INDEX IF NOT EXISTS idx_seekers_handle_base ON seekers (handle_base);
CREATE INDEX IF NOT EXISTS idx_seekers_handle_lower ON seekers (LOWER(handle));
```

- [ ] **Run migration against the dev branch:**

```bash
cd /Users/kerry/house/desk/ouracle/api
# Confirm DATABASE_URL points to dev branch, then:
psql $DATABASE_URL -f migrations/006_add_handle.sql
```

Expected: output like `ALTER TABLE`, `UPDATE N`, `CREATE INDEX` — no errors.

- [ ] **Verify columns exist:**

```bash
node -e "
import('@neondatabase/serverless').then(async ({ neon }) => {
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql\`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'seekers' AND column_name IN ('handle', 'handle_base') ORDER BY column_name\`;
  console.log(rows);
});
"
```

Expected: two rows showing `handle` and `handle_base` as `text`, `is_nullable: NO`.

- [ ] **Commit:**

```bash
git add api/migrations/006_add_handle.sql
git commit -m "feat(db): add handle and handle_base columns to seekers"
```

---

### Task 2: Add `generateHandle` and `getSeekerByHandle` to db.js

- [ ] **Add the emoji pool constant and `generateHandle` to `api/db.js`** (insert after the imports, before the first function):

```javascript
// ─────────────────────────────────────────────
// HANDLE GENERATION
// ─────────────────────────────────────────────

const EMOJI_POOL = [
  '🌙','⭐','🌟','💫','✨','🌞','☄️','🪐','🌛','🌜',
  '🔥','💧','🌊','⚡','🌀','🌬️',
  '🌿','🍃','🌱','🌺','🌸','🌼','🌻','🌹','🍀','🌾',
  '🌴','🌵','🎋','🍄','🪸','🪨',
  '🦋','🦉','🐉','🦅','🦁','🐺','🦊','🦌','🦚','🦜',
  '🐝','🦈','🦩','🦬','🪶',
  '💎','🔮','💠','🗝️','🕯️','⚗️','🧿','🪬','🪄','🔭',
  '💡','🫧','🪩','🧲','🌂',
  '🌈','🏔️','🌌','🕊️','♾️','⚜️','🏵️','🎯','🎭','☯️',
  '🧊','❄️','🌪️','⛰️','🗺️','🧭','🎐','🌤️',
];

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'seeker';
}

export async function generateHandle(name) {
  const base = slugify(name);

  // Find which emoji are already taken for this base slug.
  const rows = await sql`
    SELECT handle FROM seekers WHERE handle_base = ${base}
  `;
  const taken = new Set(rows.map((r) => r.handle));

  // Shuffle and try each emoji.
  const shuffled = [...EMOJI_POOL].sort(() => Math.random() - 0.5);
  for (const emoji of shuffled) {
    const candidate = `${base}${emoji}`;
    if (!taken.has(candidate)) {
      return { handle: candidate, handle_base: base };
    }
  }

  return null; // All emoji exhausted for this slug.
}

export async function getSeekerByHandle(handle) {
  const [seeker] = await sql`
    SELECT * FROM seekers WHERE LOWER(handle) = LOWER(${handle})
  `;
  return seeker ?? null;
}
```

- [ ] **Update `createSeeker` to accept `handle` and `handle_base`** (replace the existing function):

```javascript
export async function createSeeker({ device_id, email_hash, timezone, consent_version, name, password_hash, handle, handle_base }) {
  const [seeker] = await sql`
    INSERT INTO seekers (device_id, email_hash, timezone, consent_version, consented_at, name, password_hash, handle, handle_base)
    VALUES (
      ${device_id ?? null},
      ${email_hash ?? null},
      ${timezone ?? null},
      ${consent_version},
      now(),
      ${name ?? null},
      ${password_hash ?? null},
      ${handle},
      ${handle_base}
    )
    RETURNING *
  `;
  return seeker;
}
```

- [ ] **Verify db.js exports compile (no syntax errors):**

```bash
cd /Users/kerry/house/desk/ouracle/api
node --input-type=module <<'EOF'
import { generateHandle, getSeekerByHandle } from './db.js';
console.log('db.js exports OK');
EOF
```

Expected: `db.js exports OK`

- [ ] **Commit:**

```bash
git add api/db.js
git commit -m "feat(db): add generateHandle and getSeekerByHandle"
```

---

## Chunk 2: API Routes

### Files
- Modify: `api/auth.js`
- Modify: `api/index.js`

---

### Task 3: Update `rotateRefreshToken` to return `seeker_id`

The route handler for `/auth/refresh` needs `seeker_id` to derive stage. `rotateRefreshToken` already has it — just include it in the return value.

- [ ] **Edit `api/auth.js` — update `rotateRefreshToken` return value** (find the existing function and replace the last line):

```javascript
export async function rotateRefreshToken(refresh_token) {
  const hash = hashToken(refresh_token);
  const [stored] = await sql`
    SELECT * FROM refresh_tokens
    WHERE token_hash = ${hash} AND revoked = FALSE AND expires_at > now()
  `;

  if (!stored) throw new Error('Invalid or expired refresh token');

  await sql`UPDATE refresh_tokens SET revoked = TRUE WHERE id = ${stored.id}`;

  const tokens = await issueTokenPair(stored.seeker_id);
  return { ...tokens, seeker_id: stored.seeker_id };
}
```

- [ ] **Verify no syntax errors:**

```bash
cd /Users/kerry/house/desk/ouracle/api
node --input-type=module <<'EOF'
import { rotateRefreshToken } from './auth.js';
console.log('auth.js OK');
EOF
```

Expected: `auth.js OK`

- [ ] **Commit:**

```bash
git add api/auth.js
git commit -m "feat(auth): rotateRefreshToken returns seeker_id for stage derivation"
```

---

### Task 4: Add `deriveStage` helper and update routes in `index.js`

Stage derivation is used in three places. Define it once.

- [ ] **Add import for new db functions at the top of `api/index.js`** (update the existing destructured import from `./db.js`):

Add `generateHandle`, `getSeekerByHandle` to the import list.

- [ ] **Add `deriveStage` helper and normalize `COVENANT.version` to a string** near the top of `index.js`, after the imports. Also update the existing `COVENANT` constant so `version` is a string `'1.0'` (was the integer `1`) — this ensures `consent_version` and `covenant_version` stored on seekers are always the same value:

```javascript
// Change the existing COVENANT constant's version field from 1 to '1.0':
const COVENANT = {
  version: '1.0',     // <-- was: 1
  effective_date: '2026-03-11',
  text: [
    'I accept 100% responsibility for my actions — legal, lawful, moral, ethical, physical, and financial.',
    'Ouracle listens. Ouracle speaks. I act as I will.',
  ],
};

function deriveStage(seeker) {
  return seeker?.covenant_at ? 'covenanted' : 'known';
}
```

---

### Task 5: Update `POST /seeker/new`

Replace the existing route. Remove the `consented` gate. Accept `name`, `password`, `device_id`, `timezone`. Generate handle atomically.

- [ ] **Replace the `POST /seeker/new` handler in `api/index.js`:**

```javascript
app.post('/seeker/new', async (req, res) => {
  const { name, password, device_id, timezone } = req.body || {};

  if (!name || String(name).trim().length === 0) {
    return res.status(400).json({ error: 'name required.' });
  }
  if (!password || String(password).trim().length === 0) {
    return res.status(400).json({ error: 'password required.' });
  }

  // Retry loop guards against the race between generateHandle's SELECT
  // and the INSERT — the UNIQUE constraint catches concurrent collisions.
  const password_hash = await hashPassword(String(password));
  let seeker;
  for (let attempt = 0; attempt < 5; attempt++) {
    const handleResult = await generateHandle(String(name).trim());
    if (!handleResult) {
      return res.status(409).json({
        error: 'handle_exhausted',
        message: 'No unique handle available for this name. Try a different name.',
      });
    }
    try {
      seeker = await createSeeker({
        device_id: device_id ?? null,
        email_hash: null,
        timezone: timezone ?? null,
        consent_version: COVENANT.version,
        name: String(name).trim(),
        password_hash,
        handle: handleResult.handle,
        handle_base: handleResult.handle_base,
      });
      break; // success
    } catch (err) {
      if (err?.code === '23505' && attempt < 4) continue; // unique violation, retry
      throw err;
    }
  }

  const tokens = await issueTokenPair(seeker.id);
  return res.status(201).json({
    seeker_id: seeker.id,
    handle: seeker.handle,
    stage: deriveStage(seeker),
    ...tokens,
  });
});
```

- [ ] **Remove `GET /consent`** — delete the route and the `CONSENT_DISCLOSURES` constant above it.

- [ ] **Smoke test `POST /seeker/new`** (requires local API running: `bun run dev`):

```bash
curl -s -X POST http://localhost:3737/seeker/new \
  -H 'Content-Type: application/json' \
  -d '{"name":"luna","password":"test1234","device_id":"dev-001","timezone":"America/Chicago"}' \
  | jq '{seeker_id, handle, stage}'
```

Expected: `{ "seeker_id": "<uuid>", "handle": "luna🌙" (or similar), "stage": "known" }`

- [ ] **Commit:**

```bash
git add api/index.js
git commit -m "feat(api): POST /seeker/new — handle generation, atomic password, remove consent gate"
```

---

### Task 6: Update `POST /auth/token` for handle-based sign-in

- [ ] **Replace the `POST /auth/token` handler in `api/index.js`:**

```javascript
app.post('/auth/token', async (req, res) => {
  const { seeker_id, handle, password } = req.body;

  if (!password || String(password).trim().length === 0) {
    return res.status(400).json({ error: 'password required.' });
  }

  let seeker;
  if (handle) {
    seeker = await getSeekerByHandle(String(handle).trim());
    if (!seeker) return res.status(404).json({ error: 'Seeker not found.' });
  } else if (seeker_id) {
    seeker = await getSeeker(seeker_id);
    if (!seeker) return res.status(404).json({ error: 'Seeker not found.' });
  } else {
    return res.status(400).json({ error: 'handle or seeker_id required.' });
  }

  if (!seeker.password_hash) {
    return res.status(401).json({ error: 'No password set on this account.' });
  }
  const ok = await verifyPassword(String(password), seeker.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials.' });

  const tokens = await issueTokenPair(seeker.id);
  return res.json({
    seeker_id: seeker.id,
    stage: deriveStage(seeker),
    ...tokens,
  });
});
```

- [ ] **Smoke test handle-based sign-in** (use handle from Task 5 test):

```bash
curl -s -X POST http://localhost:3737/auth/token \
  -H 'Content-Type: application/json' \
  -d '{"handle":"luna🌙","password":"test1234"}' \
  | jq '{seeker_id, stage, access_token: .access_token[:20]}'
```

Expected: `{ "seeker_id": "<uuid>", "stage": "known", "access_token": "<truncated>" }`

- [ ] **Commit:**

```bash
git add api/index.js
git commit -m "feat(api): POST /auth/token — add handle-based sign-in, return stage"
```

---

### Task 7: Update `POST /auth/refresh` to return stage

- [ ] **Replace the `POST /auth/refresh` handler in `api/index.js`:**

```javascript
app.post('/auth/refresh', async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) return res.status(400).json({ error: 'refresh_token required.' });
  try {
    const result = await rotateRefreshToken(refresh_token);
    const seeker = await getSeeker(result.seeker_id);
    return res.json({
      seeker_id: result.seeker_id,
      stage: deriveStage(seeker),
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      expires_in: result.expires_in,
    });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired refresh token.' });
  }
});
```

- [ ] **Commit:**

```bash
git add api/index.js
git commit -m "feat(api): POST /auth/refresh — return seeker_id and stage"
```

---

### Task 8: Add `POST /covenant`

- [ ] **Add the new `POST /covenant` route to `api/index.js`** (place it after `POST /auth/refresh`):

```javascript
// POST /covenant — accept the current covenant. Auth required.
app.post('/covenant', authenticate, async (req, res) => {
  const seeker = await recordCovenant(req.seeker_id, String(COVENANT.version));
  if (!seeker) return res.status(404).json({ error: 'Seeker not found.' });
  return res.json({
    seeker_id: seeker.id,
    covenant_at: seeker.covenant_at,
    stage: deriveStage(seeker),
  });
});
```

- [ ] **Smoke test the full reception flow:**

```bash
# 1. Create seeker
RESULT=$(curl -s -X POST http://localhost:3737/seeker/new \
  -H 'Content-Type: application/json' \
  -d '{"name":"test","password":"pass1234","device_id":"smoke-001","timezone":"UTC"}')
TOKEN=$(echo $RESULT | jq -r '.access_token')
echo "handle: $(echo $RESULT | jq -r '.handle'), stage: $(echo $RESULT | jq -r '.stage')"

# 2. Accept covenant
curl -s -X POST http://localhost:3737/covenant \
  -H "Authorization: Bearer $TOKEN" \
  | jq '{stage, covenant_at}'
```

Expected:
- Step 1: `handle: "test🔥"` (or similar), `stage: "known"`
- Step 2: `stage: "covenanted"`, `covenant_at: "<timestamp>"`

- [ ] **Commit:**

```bash
git add api/index.js
git commit -m "feat(api): add POST /covenant — accept covenant, return stage"
```

---

## Chunk 3: Rust Binary

### Files
- Modify: `apps/ripl/src/main.rs` (full rewrite)
- Create: `apps/ripl/src/reception.rs`

---

### Task 9: Create `reception.rs` — terminal prompts and API calls

- [ ] **Create `apps/ripl/src/reception.rs`:**

```rust
//! Pre-RIPL terminal reception and sign-in flow.
//! Runs before raw-mode TUI starts — uses plain stdin/stdout.

use std::io::{self, BufRead, Write};
use std::time::Duration;

use color_eyre::eyre::{bail, Result};
use reqwest::blocking::Client;
use serde_json::Value;

use crate::Config;

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

fn client() -> Client {
    Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .unwrap_or_else(|_| Client::new())
}

fn post_json(client: &Client, url: &str, body: &Value, token: Option<&str>) -> Result<Value> {
    let mut req = client.post(url).json(body);
    if let Some(t) = token {
        req = req.bearer_auth(t);
    }
    let resp = req.send()?;
    let status = resp.status().as_u16();
    let json: Value = resp.json()?;
    if status >= 400 {
        let msg = json.get("message")
            .or_else(|| json.get("error"))
            .and_then(|v| v.as_str())
            .unwrap_or("request failed");
        bail!("{msg}");
    }
    Ok(json)
}

fn get_json(client: &Client, url: &str) -> Result<Value> {
    let resp = client.get(url).send()?;
    let status = resp.status().as_u16();
    let json: Value = resp.json()?;
    if status >= 400 {
        let msg = json.get("message").or_else(|| json.get("error"))
            .and_then(|v| v.as_str()).unwrap_or("request failed");
        bail!("{msg}");
    }
    Ok(json)
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

fn prompt(label: &str) -> Result<String> {
    print!("{label}: ");
    io::stdout().flush()?;
    let stdin = io::stdin();
    let mut line = String::new();
    stdin.lock().read_line(&mut line)?;
    Ok(line.trim().to_string())
}

fn prompt_password(label: &str) -> Result<String> {
    // No terminal echo suppression — acceptable for CLI at this stage.
    prompt(label)
}

// ─── Covenant display ─────────────────────────────────────────────────────────

fn show_and_accept_covenant(client: &Client, base_url: &str) -> Result<bool> {
    let covenant = get_json(client, &format!("{base_url}/covenant/current"))?;
    let lines = covenant.get("text")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    println!("\nThe Covenant:\n");
    for line in &lines {
        if let Some(s) = line.as_str() {
            println!("  {s}");
        }
    }
    println!();

    let answer = prompt("Accept? (y/n)")?;
    Ok(answer.to_lowercase().starts_with('y'))
}

// ─── Reception outcomes ───────────────────────────────────────────────────────

pub struct Credentials {
    pub seeker_id: String,
    pub access_token: String,
    pub refresh_token: String,
}

// ─── New seeker ───────────────────────────────────────────────────────────────

fn new_seeker(client: &Client, base_url: &str) -> Result<Credentials> {
    let resp = loop {
        let name = loop {
            let n = prompt("Name")?;
            if !n.is_empty() { break n; }
            println!("Name cannot be empty.");
        };
        let password = prompt_password("Password")?;
        if password.is_empty() {
            bail!("Password cannot be empty.");
        }

        let body = serde_json::json!({
            "name": name,
            "password": password,
            "device_id": hostname(),
            "timezone": iana_timezone(),
        });

        match post_json(client, &format!("{base_url}/seeker/new"), &body, None) {
            Ok(r) => break r,
            Err(e) if e.to_string().contains("handle_exhausted") => {
                println!("That name has no handles left. Try a different name.\n");
            }
            Err(e) => bail!(e),
        }
    };
    let handle = resp.get("handle").and_then(|v| v.as_str()).unwrap_or("?").to_string();
    let seeker_id = resp.get("seeker_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let access_token = resp.get("access_token").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let refresh_token = resp.get("refresh_token").and_then(|v| v.as_str()).unwrap_or("").to_string();

    println!("\nYou are {handle}\n");

    // Show covenant and require acceptance.
    let accepted = show_and_accept_covenant(client, base_url)?;
    if !accepted {
        bail!("Reception cancelled.");
    }

    post_json(client, &format!("{base_url}/covenant"), &serde_json::json!({}), Some(&access_token))?;
    println!("Welcome.\n");

    Ok(Credentials { seeker_id, access_token, refresh_token })
}

// ─── Returning seeker ─────────────────────────────────────────────────────────

fn returning_seeker(client: &Client, base_url: &str) -> Result<Credentials> {
    let handle = prompt("Handle")?;
    let password = prompt_password("Password")?;

    let body = serde_json::json!({ "handle": handle, "password": password });
    let resp = post_json(client, &format!("{base_url}/auth/token"), &body, None)?;

    let seeker_id = resp.get("seeker_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let access_token = resp.get("access_token").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let refresh_token = resp.get("refresh_token").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let stage = resp.get("stage").and_then(|v| v.as_str()).unwrap_or("covenanted");

    // If known but not yet covenanted (e.g. created on another client).
    if stage == "known" {
        let accepted = show_and_accept_covenant(client, base_url)?;
        if !accepted {
            bail!("Reception cancelled.");
        }
        post_json(client, &format!("{base_url}/covenant"), &serde_json::json!({}), Some(&access_token))?;
    }

    Ok(Credentials { seeker_id, access_token, refresh_token })
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/// Run reception (if no token) or refresh (if token exists).
/// Returns credentials ready to launch RIPL.
pub fn ensure_credentials(cfg: &Config, base_url: &str) -> Result<Credentials> {
    let c = client();

    // Saved refresh token → attempt rotation.
    if let Some(rt) = &cfg.refresh_token {
        let body = serde_json::json!({ "refresh_token": rt });
        match post_json(&c, &format!("{base_url}/auth/refresh"), &body, None) {
            Ok(resp) => {
                let seeker_id = resp.get("seeker_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let access_token = resp.get("access_token").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let refresh_token = resp.get("refresh_token").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let stage = resp.get("stage").and_then(|v| v.as_str()).unwrap_or("covenanted");

                if stage == "known" {
                    let accepted = show_and_accept_covenant(&c, base_url)?;
                    if !accepted {
                        bail!("Reception cancelled.");
                    }
                    post_json(&c, &format!("{base_url}/covenant"), &serde_json::json!({}), Some(&access_token))?;
                }

                return Ok(Credentials { seeker_id, access_token, refresh_token });
            }
            Err(_) => {
                println!("Session expired. Please sign in again.\n");
            }
        }
    }

    // No credentials or refresh failed → reception.
    let answer = prompt("New or returning? (n/r)")?;
    println!();
    if answer.to_lowercase().starts_with('n') {
        new_seeker(&c, base_url)
    } else {
        returning_seeker(&c, base_url)
    }
}

// ─── System helpers ───────────────────────────────────────────────────────────

fn hostname() -> String {
    std::process::Command::new("hostname")
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "unknown".to_string())
}

fn iana_timezone() -> String {
    std::fs::read_link("/etc/localtime")
        .ok()
        .and_then(|p| {
            let s = p.to_string_lossy().into_owned();
            s.find("zoneinfo/").map(|i| s[i + 9..].to_string())
        })
        .unwrap_or_else(|| "UTC".to_string())
}
```

---

### Task 10: Rewrite `main.rs`

- [ ] **Rewrite `apps/ripl/src/main.rs`:**

```rust
mod provider;
mod reception;

use std::fs;
use std::path::PathBuf;
use std::sync::Arc;

use color_eyre::eyre::Result;
use serde::{Deserialize, Serialize};

use provider::OuracleProvider;
use reception::ensure_credentials;

// ─── Config ──────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct Config {
    pub base_url: Option<String>,
    pub seeker_id: Option<String>,
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
}

fn config_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join(".ouracle").join("ripl.toml")
}

fn load_config() -> Config {
    let path = config_path();
    let raw = match fs::read_to_string(&path) {
        Ok(r) => r,
        Err(_) => return Config::default(),
    };
    toml::from_str(&raw).unwrap_or_default()
}

fn save_config(cfg: &Config) -> Result<()> {
    let path = config_path();
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)?;
    }
    let raw = toml::to_string_pretty(cfg)?;
    fs::write(path, raw)?;
    Ok(())
}

fn resolve_base_url(cfg: &Config) -> String {
    std::env::var("OURACLE_BASE_URL")
        .ok()
        .or_else(|| cfg.base_url.clone())
        .unwrap_or_else(|| "http://localhost:3737".to_string())
}

// ─── Main ─────────────────────────────────────────────────────────────────────

fn main() -> Result<()> {
    color_eyre::install()?;

    let mut cfg = load_config();
    let base_url = resolve_base_url(&cfg);

    let creds = match ensure_credentials(&cfg, &base_url) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("{e}");
            std::process::exit(1);
        }
    };

    // Persist updated credentials.
    cfg.base_url = Some(base_url.clone());
    cfg.seeker_id = Some(creds.seeker_id.clone());
    cfg.access_token = Some(creds.access_token.clone());
    cfg.refresh_token = Some(creds.refresh_token.clone());
    save_config(&cfg)?;

    let provider = Arc::new(OuracleProvider::new(base_url, creds.access_token));
    ripl::run_with_provider(provider, Some("Ouracle".to_string()))
}
```

- [ ] **Build:**

```bash
cd /Users/kerry/house/desk/ouracle/apps/ripl
cargo build 2>&1
```

Expected: `Finished` with no errors.

- [ ] **Commit:**

```bash
git add apps/ripl/src/main.rs apps/ripl/src/reception.rs
git commit -m "feat(ouracle): inline reception and sign-in flow before RIPL launch"
```

---

### Task 11: End-to-end smoke test

Requires local API running (`bun run dev` in `api/`).

- [ ] **Delete any existing credentials to start clean:**

```bash
rm -f ~/.ouracle/ripl.toml
```

- [ ] **Run `ouracle` and go through new seeker reception:**

```bash
/Users/kerry/house/desk/ouracle/apps/ripl/target/debug/ouracle
```

Expected flow:
1. Prompt: `New or returning? (n/r)` → type `n`
2. Prompt: `Name:` → type a name
3. Prompt: `Password:` → type a password
4. Output: `You are <name><emoji>`
5. Covenant text displayed
6. Prompt: `Accept? (y/n)` → type `y`
7. Output: `Welcome.`
8. RIPL TUI launches with status bar showing `Ouracle`

- [ ] **Exit RIPL, re-run — should go straight to RIPL (token refresh):**

```bash
/Users/kerry/house/desk/ouracle/apps/ripl/target/debug/ouracle
```

Expected: RIPL launches immediately with no prompts.

- [ ] **Final commit:**

```bash
git add -A
git commit -m "chore: reception smoke test verified"
```

---

## Summary

| Task | Files | What it does |
|------|-------|-------------|
| 1 | `migrations/006_add_handle.sql` | Adds `handle`, `handle_base` columns |
| 2 | `api/db.js` | `generateHandle`, `getSeekerByHandle`, updated `createSeeker` |
| 3 | `api/auth.js` | `rotateRefreshToken` returns `seeker_id` |
| 4–8 | `api/index.js` | `deriveStage`, updated routes, new `POST /covenant` |
| 9–10 | `apps/ripl/src/` | `reception.rs` + rewritten `main.rs` |
| 11 | — | End-to-end smoke test |
