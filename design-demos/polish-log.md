# Polish log — code-intel icon (F · Stratum)

Environment note: this session's model cannot read images and Python playwright is not
installed, so `polish.py shot` / `design_lint.py check` could not be run. The rounds below
were analytic: geometry math on the 48×48 viewBox, contrast calculations, and pixel
statistics on the renders (`magick` color counts, coverage). Final visual judgment was the
user's at presentation time.

## Round 1 — structural fix

- Problem: the dark "underside" rects overlapped the light plate faces almost entirely
  (2-unit offset under a 7-tall plate), so the extrusion read as nothing.
- Fix: rebuilt as three contiguous slabs — each a light top face (7 units) plus a dark side
  face (3.25 units) below it — inside one `skewY(-14)` group. Seams now read as strata.
- Problem: the node-graph strokes (1.25) and nodes (r 1.7) would vanish at 48 px.
- Fix: raised strokes to 1.75 and node radii to 2.2/2.9 before round 2 superseded them.

## Round 2 — small-size legibility

- Problem: at 48 px the icon risked reading as a generic database "stack of cylinders";
  the graph — the only part that says *code-intel* — was too small to matter.
- Fix: scaled the graph up (focal node r 3.4, satellites r 2.6, edge stroke 2.1) and
  spread the nodes across the top slab; tightened the halo from r 6.5 to r 5.5 so it stays
  a glow rather than a bubble.
- Verified containment: all node positions sit inside the top slab silhouette at every
  relevant y; slab right edge max 42.7 px stays inside the tile's 11-px corner radius.

## Verification performed

- Color/contrast: white marks on #101A2E→#1B2C4A ≈ 15:1; cyan #3CC8F5 focal node ≈ 8:1.
- Render checks: unique-color counts and tile coverage on both 512 px and 48 px renders.
- Packaging: `npm pack --dry-run` lists `icon.svg` (1.7 kB) in the tarball; `prepack`
  assertion passes with `icon.svg` added to REQUIRED.
- Size: final `icon.svg` is 1.7 kB — far under the 256 KiB DSH manifest icon limit.
