# Octave → Neon: Quick Start

## 1. Prerequisites

- Neon database created (get connection string)
- Node.js with `pg` library: `npm install pg`
- Notion API key (for resolving remaining titles)

## 2. Resolve Missing Titles (One-time)

This fetches `sense`, `money_stage`, `tarot_astrological_entities` titles from Notion.

```bash
export NOTION_API_KEY="secret_your_key_here"
cd ~/house/desk/ouracle
node scripts/fetch-remaining-titles.js
```

Output:
- Updates `data/octave-mapping-final.json` with title arrays
- Shows sample results

**Rate limiting:** ~1.2s between requests → ~2 minutes for 56 pages.

## 3. Import into Neon

```bash
# Set your Neon connection string
export DATABASE_URL="postgresql://user:pass@host/neondb"

# Import
node scripts/import-octave-to-neon.js

# Verify
node scripts/verify-octave-import.js
```

## 4. Query from Ouracle API

Once data is in Neon, your API can query:

```js
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });

// Get step by number
const res = await client.query('SELECT * FROM octave_steps WHERE number = $1', [1]);

// Find by element
const fireSteps = await client.query("SELECT number, name FROM octave_steps WHERE element = 'Fire'");

// Find steps that include a Hermetic Principle
const polaritySteps = await client.query(
  "SELECT number, name FROM octave_steps WHERE hermetic_principle @> ARRAY['Polarity']"
);
```

## Files

| File | Purpose |
|------|---------|
| `sql/octave_steps_schema.sql` | Table + indexes |
| `data/octave-mapping-final.json` | Clean data (before & after title fetch) |
| `scripts/fetch-remaining-titles.js` | Resolve ID→title from Notion |
| `scripts/import-octave-to-neon.js` | Import to Neon |
| `scripts/verify-octave-import.js` | Check import |
| `docs/octave-ambiance-reference.md` | Human-readable reference |

## Notes

- All flattened titles are stored as `TEXT[]` arrays (fast GIN-indexed queries)
- Visual/audio themes stored as `JSONB`
- Raw ID arrays (`*_ids`) retained for reference
- `sense`, `money_stage`, `tarot_astrological_entities` become `TEXT[]` after fetch
- `rollup` remains `UUID[]` (unresolved generic links)

## Troubleshooting

- **"relation does not exist"**: Run schema first or grant permissions.
- **Missing NOTION_API_KEY**: Set env var or find in keychain (`security find-generic-password -w -a notion_api_key`)
- **Import errors**: Check that `octave-mapping-final.json` exists and is valid JSON.

---

Ready to test? (◕‿◕)✦