# Hull rendering sweep through 4x4

`H` means hull, `S` means substructure without hull, and `.` means empty. Hull
cells also have supporting substructure. This audit ran on November 20, 2026.

## Coverage

| Set | Actual hull renderings per sweep |
| --- | ---: |
| Every 4x4 hull/empty arrangement | 65,536 |
| Every 4x4 hull/substructure arrangement | 65,536 |
| Every 3x3 hull/substructure/empty arrangement | 19,683 |
| Deterministic sample of mixed 4x4 arrangements | 16,384 |
| Total | 167,139 |

Each arrangement goes through `hullTopology`, the supplied image textures with
runtime cleanup, and `drawHull` on a native headless canvas. The hull alpha layer
is rendered at 16 pixels per tile for automated inspection. Candidate contact
sheets also include the app's substructure renderer at 36 pixels per tile.
Twenty-four hand-selected 4x4 layouts received additional visual inspection.

The mixed 4x4 sample uses xorshift32 with seed `0x47a9c1`. It does not exhaust
all 43,046,721 mixed 4x4 arrangements. Smaller hull footprints occur within the
binary sweep; the mixed 3x3 sweep includes all three cell types.

## Defect found and fixed

When a precise corner bucket was absent, the matcher searched all reference
quarters for that host cell. Some selected quarters assumed a facing hull
neighbor that did not exist, or omitted a real one. The fallback now requires
both facing hull connections to agree before scoring reference candidates.
It may relax the floor/background match, but not those connections.

The complete sweep was run before and after this change:

| Automated diagnostic | Before: layouts flagged | After: layouts flagged |
| --- | ---: | ---: |
| Selected quarter disagrees with a facing hull neighbor | 12,788 | 0 |
| Narrow center connection missing between adjacent hull cells | 170 | 0 |
| Missing hull tile center | 0 | 0 |
| Hull fills a substructure-only tile center | 0 | 0 |

Counts are flagged renderings, not unique defects; rotations and smaller-grid
embeddings can repeat a shape. These checks inspect facing-neighbor metadata
and small alpha patches near tile centers and cardinal boundaries. They do not
prove correct corner silhouettes or shading. Browser antialiasing may also
differ from the native canvas used here.

All 6,561 center-hull 3x3 neighborhoods now have a regression test for facing
connections, including diagonal and mixed-floor contexts. Reported 4x4 fallback
failures are tested under rotations and mirrors. The existing 34 reference grids
and the upright singular-cap behavior remain covered by the tests.

## Remaining visual candidates

The following examples still show suspicious seams, cap fragments, or abrupt
artwork transitions. Their correct game appearance needs references. In
particular, a chamfered hole or asymmetric connection alone is not sufficient
evidence that the topology is wrong.

These six labels correspond to the reference-candidate contact sheet. One
orientation of each is enough initially; directional variants are useful if
the game keeps front faces upright when the layout turns.

### R1: 4x4 empty ring

Suggested file: `hull-ring-4x4-empty.png`

Stray panel/end details appear around the inner boundary. The game's intended
shape of the 2x2 empty opening also needs verification.

```text
H H H H
H . . H
H . . H
H H H H
```

### R2: thick diagonal cross

Suggested file: `hull-diagonal-cross-thick-4x4.png`

The diagonal arms meet the 2x2 center with abrupt panel and cap transitions.

```text
H . . H
. H H .
. H H .
H . . H
```

### R3: mixed-floor checkerboard

Suggested file: `hull-checkerboard-4x4-mixed-floor.png`

The alternating floored and empty gaps produce small bevel fragments near
otherwise isolated square caps. This extends the supplied smaller checkerboard.

```text
H S H S
. H . H
H S H S
. H . H
```

### R4: dense zigzag junction

Suggested file: `hull-zigzag-junction-4x4.png`

The upper and middle transitions have abruptly clipped-looking corners and
inconsistent interior edge details. Reference needed to establish connectivity
as well as the correct artwork.

```text
H . H .
. H H H
H H . .
. H H H
```

### R5: staggered loops

Suggested file: `hull-offset-loops-4x4.png`

The shared diagonal junction has an abrupt splice between the two loop frames.

```text
H H H .
H . H .
. H . H
. H H H
```

### R6: extended floored staircase

Suggested file: `hull-staircase-4x4-floor.png`

The longer diagonal edge changes panel direction near the last step and has
small cap-like fragments. This extends the supplied shorter staircase.

```text
H H S S
. H H S
. . H H
. . . H
```

The sweep also flagged 12,749 renderings with mixed quarter rotations after the
fix. That is an inspection heuristic, not a count of confirmed visual defects:
some corners intentionally combine directional pieces. Dense shape inspection
and the six references above are more useful than requesting a screenshot for
every heuristic flag. Unreferenced layouts remain approximations.

## Repeat the automated sweep

The app and normal tests need no additional dependency. For this optional audit,
install a native canvas without modifying the package manifest or lockfile:

```sh
npm install --no-save --package-lock=false @napi-rs/canvas
node tools/audit-hull.mjs
```

Run from the repository root. The default report is
`node_modules/.cache/hull-audit/hull-4x4-sweep.json`, which is ignored by Git.
An optional first argument selects another output directory:

```sh
node tools/audit-hull.mjs path/to/audit-output
```

The JSON includes coverage, diagnostic counts, and representative candidate
grids. The tool does not label every approximate reference match as a defect.
