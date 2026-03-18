# Octave Data Completion Plan

## Goal
Fully resolve all 10 octave steps from the Notion database by fetching all 156 linked relation pages, producing a complete `octave-steps-truth.json` with all properties populated, then generate the final `octave-mapping-enhanced.json` that matches actual step names and includes visual/audio themes.

## Current State
- `data/octave-steps.json`: Raw extraction with all relation fields empty (element, color, chakra, tarot, etc. all blank)
- `data/octave-steps-truth.json`: Step 1 complete, steps 2-10 placeholders
- `scripts/extract-octave-data.js`: Fetches step records only, does NOT resolve relations
- `scripts/build-octave-mapping.js`: Creates enhanced mapping from prototype data, not actual resolved data

**156 linked pages** need to be fetched from Notion to fill all relation properties for all 10 steps.

## Approach

### Phase 1: Enhance Extraction Script to Resolve Relations

Modify `scripts/extract-octave-data.js` to:
1. Fetch all step records (already does this)
2. For each step, iterate through all properties that are relations
3. For each relation (which contains an array of linked page IDs), fetch the linked page data
4. Extract meaningful values (typically the page `title` or a specific property like `name`)
5. Store the resolved values in the step data

**Property types to handle:**
- `relation` → single linked page → fetch and extract title or relevant property
- `multi_relation` (if exists) → multiple linked pages → fetch all and extract titles

**Expected relations (based on schema):**
- `Bagua` (relation to Bagua pages)
- `Chakra` (relation to Chakra pages)
- `Changes Above` (relation)
- `Changes Below` (relation)
- `Dimension` (relation)
- `Dimensional Trinities` (multi-relation)
- `Element` (relation to Element pages)
- `Hermetic Principle` (multi-relation)
- `Loveforms` (multi-relation)
- `Major Arcana` (multi-relation)
- `Next step` (relation to another step)
- `Previous step` (relation to another step)
- `Sacred Bodies` (multi-relation)
- `Stories of Deep Well` (multi-relation)
- `Timespace` (relation)
- `Vedic pantheon` (relation)

Plus any other relation-type properties present in the database.

### Rate Limiting Strategy

- Notion API: ~3-5 requests/second recommended, ~1 request/second safe
- We'll implement a configurable delay between requests (e.g., 200ms = 5 req/sec)
- Batch processing: fetch all relations for one step before moving to next
- Use `Promise.all` carefully with concurrency limit (e.g., max 5 parallel fetches)
- Implement retry logic with exponential backoff for 429/5xx errors
- Log progress so we can resume if interrupted

### Data Structure

For each relation property, we'll store:
```json
{
  "property_name": "resolved value",
  "property_name_raw": { original relation object },
  "property_name_ids": ["page_id_1", "page_id_2"]  // for traceability
}
```

For multi-relations, `resolved value` will be an array of titles.

### Phase 2: Generate Complete Truth File

After enhanced extraction:
- Save to `data/octave-steps-truth.json` with all steps fully resolved
- Include metadata indicating relations_resolved count
- Verify that each step has non-empty values for all expected properties
- Generate a summary report showing completion percentage

### Phase 3: Build Final Enhanced Mapping

Modify `scripts/build-octave-mapping.js` to:
- Use the **actual resolved data** from `octave-steps-truth.json` (not `octave-steps.json`)
- Map each step's real name, act, intent, element, color, chakra, etc.
- Only apply default visual/audio themes for properties that are still missing (unlikely after full resolution)
- Generate `data/octave-mapping-enhanced.json` that matches the real 10 steps exactly

### Phase 4: Update Reference Documentation

- Update `docs/octave-ambiance-reference.md` to reflect the complete, accurate data
- Ensure all 10 steps have correct properties as pulled from Notion

## Files to Modify/Create

1. `scripts/extract-octave-data.js` — Add relation resolution logic
2. `data/octave-steps-truth.json` — Output (will be overwritten with complete data)
3. `scripts/build-octave-mapping.js` — Modify to use truth data
4. `data/octave-mapping-enhanced.json` — Output (regenerated)
5. `docs/octave-ambiance-reference.md` — Update with correct data

## Validation

- All 10 steps must have:
  - Element (non-empty string)
  - Color (hex code or empty string from Notion)
  - Chakra (non-empty)
  - All multi-relation properties resolved to arrays of titles
  - Next/Previous step references correct step numbers
- No empty arrays where relations exist
- `relations_resolved` count in metadata matches expectation (156)
- Each step has at least 10+ non-empty properties beyond id/name

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Notion API rate limits (429) | Implement delays, exponential backoff, retry logic |
| Large number of API calls (156+) | Batch efficiently, add progress logging, support resumability |
| Missing property mappings | Inspect Notion page structure, log unknown property types |
| Corrupted data mid-run | Write to temp file, validate, then atomic rename |
| Timeout/failure after partial completion | Save progress incrementally, enable resume |

## Open Questions

- Should we implement incremental caching (store fetched relations by ID to avoid re-fetching same page)?
  - **Decision:** Yes, simple in-memory cache per run; persistent cache would be overkill for one-off completion
- What delay between requests? Start with 200ms, adjust if we see 429s
- How to handle pages with missing properties? Store empty string/array and log warning
- Should we fetch ALL properties from linked pages or just `title`? Typically `title` suffices, but some relations may have specific property we need (e.g., `name`). We'll inspect one or two samples to determine pattern.

## Execution Steps

1. Inspect Notion database structure to understand relation property patterns
2. Enhance `extract-octave-data.js` with relation resolution
3. Test on step 1 only to verify correctness
4. Run full extraction for all 10 steps
5. Verify `octave-steps-truth.json` completeness
6. Update `build-octave-mapping.js` to use truth data
7. Regenerate `octave-mapping-enhanced.json`
8. Update documentation
9. Create summary report of completion

---

**Plan written.** Ready to execute upon approval.
