# Hull rendering audit

`H` is hull, `S` is substructure without hull, and `.` is empty.

The November 20 audit rendered the five reported layouts and 16 additional
layouts, checking all four rotations of each (84 renderings). The renderer's
output was inspected in contact sheets; this is not a comparison against new
in-game screenshots.

## Fixed in this change

Nearby floor was causing the reference matcher to select unrelated diagonal
artwork for ordinary walls. Hull without an empty diagonal join now composes
native straight-wall and inside-corner quarters, while exact supplied reference
matches retain their existing artwork.

The reported straight wall, floored cross, and extended floored cross (3–5) now
render without those false bevels and end caps. Additional floored T, long wall,
L, U, floor hole, paired floor holes, and parallel corridor cases also look
consistent in the audit.

The tests enumerate all 6,561 center-hull 3x3 neighborhoods. Of these, 2,543 have
no empty diagonal joins; every tested quarter preserves its center tile's
horizontal and vertical hull connections. The other 4,018 contexts are excluded
from this ordinary-wall assertion, not considered visually verified.

## Remaining reference requests

Diagonal references still do not cover the following contexts. The approximate
matcher can introduce quarter seams, cap fragments, or inconsistent joins.
These are unresolved, even though all exact supplied references pass tests.
One orientation of each reference below is sufficient to start; another is
useful if the game changes its topology when rotated.

**Reported 1 — `hull-diagonal-chain-floor-one-side.png`**

```text
H S S
. H S
. . H
```

**Reported 2 — `hull-diagonal-corner-floor-transition.png`**

```text
. . H
. H H
H S S
```

Additional suspicious cases, prioritized for new game references:

**`hull-diagonal-checkerboard-mixed-floor.png`** — center junction changes shape
with floor placement; it needs verification against the game's connectivity.

```text
H S H
. H .
H S H
```

**`hull-parallel-diagonal-chains.png`** — quarter artwork and joins differ between
the two interleaved diagonal chains.

```text
H . H .
. H . H
H . H .
```

**`hull-diagonal-junction-mixed-floor.png`** — mixed upper/lower diagonal joins
produce cap fragments and orientation-dependent silhouettes.

```text
H S H
. H .
H . H
```

**`hull-cross-mixed-floor.png`** — a cardinal cross with two floored and two empty
corners still uses approximate artwork; its chamfer transitions need verification.

```text
S H .
H H H
. H S
```

Other checked layouts: both-sides-floored diagonal, alternating-floor diagonal,
fully floored diagonal bend, and empty Z. The alternating-floor diagonal has the
same seam problem as reported 1. The empty Z has suspicious transition shading.
Both-sides-floored diagonal and floored bend now use isolated ordinary wall caps;
their exact in-game appearance remains unverified.

This audit does not establish pixel equivalence for layouts without game
references. Rotational alpha-mask comparisons were used only to find candidates
for inspection, since native lighting and overhangs can differ by orientation.
