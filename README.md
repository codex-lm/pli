# Pli

*A paper-folding puzzle — ink & paper.*

Fold an inky sheet along any dashed line. **Ink merges with ink**: two stains
that land on the same spot become one. **Grains of sand never overlap**: a fold
is refused if two grains — or a grain and a stain — would land on each other.
The folding side must be no wider than the side that stays in place. Win when
**exactly one stain remains, resting on the target**. Fewer folds, brighter
stars.

## How to play

- **Tap a dashed fold line** between two columns or rows, then **tap an arrow**
  to fold that side over. On keyboard: arrow keys fold through the middle of
  the sheet; **U** undoes, **R** restarts.
- Ink stains merge when they meet; the target is the dashed ring.
- 12 sheets with a proven optimal fold count (`par`): ★★★ at par, ★★ at par+1.

Interface in **English** (default), **French** and **Spanish**.

## Run locally

Everything is static and self-contained (no network). `index.html` is the
published autonomous bundle required by LOB7 (all styles and scripts inlined);
it is **generated** from `index.src.html` + `assets/*` — never edit it by
hand. The generator (a tiny Node inliner) and the test suite live in the Z Code
workshop.

```bash
python -m http.server 8139       # then open http://localhost:8139/
```

## Design notes

- The rules engine (`assets/engine.js`) is pure and deterministic: any fold is
  a mirrored merge of cell layers (ink ∪ ink merges, grain conflicts refuse
  the whole fold).
- Levels 3–12 were produced by an **inverse-unfolding generator**: start from
  the winning state (one stain on the target) and unfold bands while
  redistributing ink (duplicable — the exact inverse of a merge), grains and
  target between the layers. Every level is therefore solvable **by
  construction**; the `par` of each level is then re-proved by a BFS solver.
- Palette: **paper & ink** — ivory paper on a warm desk, vermillion ink,
  sepia text and target, charcoal grains — a deliberate break from the
  dark/indigo look of most of the catalogue.

## Credits & license

A game by Cédric Bernadac, created with AI agents (ZCode & Kimi K3.1 Pro).
Code under the [MIT license](LICENSE). Produced automatically with Z Code in
the Z Code game workshop; see `LOB7-ATTRIBUTION.json` for contributions.
