# Data Inputs (Local)

Place these files here for oracle mapping scripts:

- `tarot_interpretations.json` (MIT): from `dariusk/corpora`.
- `iChing_Legge.json`: parsed hexagrams from the public-domain Legge translation.

Then run:

```
node scripts/build_oracle_mappings.mjs
```

Outputs:
- `api/data/tarot-octave-map.json`
- `api/data/iching-octave-map.json`
