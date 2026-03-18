# Octave of Evolution — Neon Import Guide

This document describes how to import the fully denormalized Octave data into a Neon Postgres database.

## 📦 Files

- `sql/octave_steps_schema.sql` — Table definition + indexes
- `data/octave-mapping-final.json` — Final cleaned data (all steps)
- `scripts/import-octave-to-neon.js` — Import script
- `scripts/verify-octave-import.js` — Verification script

## 🎯 Data Model

Single denormalized table `octave_steps` with:
- All scalar properties (element, chakra, act, intent, etc.)
- Arrays for multi-values (hermetic_principle, major_arcana, etc.)
- JSONB for visualTheme & audioProfile
- Resolved step links (next_step_number, previous_step_name)
- Resolved I Ching changes (changes_above, changes_below) as titles
- Flattened select/multi-select fields (tarot_elements, vedic_direction)
- Remaining ID-only relation arrays (sense, money_stage, rollup, tarot_astrological_entities)
- All original ID fields retained for reference (_ids)

## 🚀 Quick Start

1. **Create a Neon project** (if you don't have one) and get the connection string.

2. **Install Node dependencies** (only needed once):
   ```bash
   npm install pg
   ```

3. **Set your database URL**:
   ```bash
   export DATABASE_URL="postgresql://user:pass@your-neon-host/neondb"
   ```

4. **Run import**:
   ```bash
   node scripts/import-octave-to-neon.js
   ```

   This will:
   - Create the table (if not exists)
   - Insert or update all 10 steps
   - Print success message

5. **Verify**:
   ```bash
   node scripts/verify-octave-import.js
   ```

## 📊 Query Examples

Once imported, you can query the data via your Ouracle API or directly:

```sql
-- Get step by number
SELECT * FROM octave_steps WHERE number = 1;

-- Find steps by element
SELECT number, name, chakra FROM octave_steps WHERE element = 'Fire';

-- Find steps containing a specific Hermetic Principle
SELECT number, name FROM octave_steps
WHERE hermetic_principle @> ARRAY['Polarity'];

-- Get next/previous step chain
SELECT number, name, next_step_number, next_step_name FROM octave_steps ORDER BY number;

-- Get changes for a step
SELECT number, changes_above, changes_below FROM octave_steps WHERE number = 1;
```

## 🛠️ Schema Design Decisions

- **Denormalized**: All flattened titles stored directly on the step row → one-table queries, no joins.
- **Array columns**: Postgres `TEXT[]` for multi-values, with GIN indexes for fast containment (`@>`) queries.
- **JSONB**: Used for nested visual/audio themes (allows partial queries if needed).
- **ID arrays**: For unresolved relations (sense, money_stage, etc.) we keep arrays of UUIDs for possible future joins.
- **Step chain**: `next_step_number`/`previous_step_number` as integers for efficient sorting.

## 📈 Performance Tips

- Indexes are created on number, element, chakra, act, and all array columns.
- For lookups by ID (e.g., `tarot_astrological_entities`), consider creating a separate lookup table if queries become frequent.
- If you need to resolve the remaining ID-only relations, you would need to create mapping tables (e.g., `senses`, `money_stages`) and join during import or later.

## 🔧 Troubleshooting

- **"relation does not exist"**: Ensure you ran the schema script first or that your user has permissions.
- **Array parameter errors**: The import script uses pg's native array support; ensure you're using a recent pg library.
- **Date parsing**: Dates are parsed from ISO strings; ensure they're valid in the JSON.

## 📝 Notes

- The data was extracted from Notion on 2026-03-18. Relations resolved: 181.
- `changes_above` and `changes_below` are titles of I Ching hexagrams (from `octave_changes.json`).
- `next_step` and `previous_step` were fixed from `['[object Object]']` to actual step numbers/names.
- Unresolved relation titles (tarot_astrological_entities, sense, money_stage, rollup) remain as ID arrays due to lack of title mapping in the local dataset.