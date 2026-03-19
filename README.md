# Ouracle

Multimodal oracle drawing on Tarot de Marseilles, I Ching, Gene Keys, Delphic maxims, and other divination traditions.

## Structure

- `docs/` — specifications and design documents
- Source of truth: implement `docs/` rather than editing them to match code
- `api/` — MEATAPI diagnostic engine (Node.js/Express)
- `research/` — Wesley's research on divination source material

## Components

### MEATAPI
Diagnostic engine bridging MESH (AI) and MEAT (embodied human).

Three-stage flow:
1. **Inquire** — vagal state inference, limiting belief detection
2. **Prescribe** — ceremony generation (chakra-mapped rituals)
3. **Reintegrate** — somatic feedback, system tuning

See `docs/meat-api-spec.md` for full specification.

### Research
Authoritative source material on:
- Tarot de Marseilles
- I Ching hexagrams
- Gene Keys (Richard Rudd)
- Delphic maxims
- Other divination traditions

See `research/` directory.
# Source of Truth

Docs in `docs/` are the source of truth.
When in doubt, implement the roadmap/specs instead of editing them to match code.
