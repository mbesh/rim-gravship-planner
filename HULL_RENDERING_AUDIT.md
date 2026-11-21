# Hull rendering audit

`H` is hull, `S` is substructure without hull, and `.` is empty.

## Integrated references

All six references requested in the November 20 audit are now registered in the
renderer. Their hull quarters select matching context rather than approximate
pieces from unrelated layouts. Tests cover all four rotations and mirrors of
all 34 supplied reference grids.

| Reference | Placement rows, top to bottom |
| --- | --- |
| `hull-diagonal-chain-floor-one-side.png` | `HSS / .HS / ..H` |
| `hull-diagonal-corner-floor-transition.png` | `..H / .HH / HSS` |
| `hull-diagonal-checkerboard-mixed-floor.png` | `HSH / .H. / HSH` |
| `hull-parallel-diagonal-chains.png` | `H.H. / .H.H / H.H.` |
| `hull-parallel-diagonal-chains-90.png` | `H.H / .H. / H.H / .H.` |
| `hull-parallel-diagonal-chains-270.png` | `.H. / H.H / .H. / H.H` |
| `hull-diagonal-junction-mixed-floor.png` | `HSH / .H. / H.H` |
| `hull-cross-mixed-floor.png` | `SH. / HHH / .HS` |

The junction's bottom-center tile is empty, as confirmed by the user. Screenshot
background pixels are filtered at runtime; the supplied images are untouched.
The checkerboard and mixed junction references confirm that their center hull
tile stays isolated rather than forming an X-shaped connection. The asymmetry
in the parallel-diagonal reference is also present in the game image.

Singular hull caps always render as a complete native, upright tile, without
rotation or mirroring. Context matching may rotate the placement grid to find
the right reference, but that transform is not applied to isolated cap artwork.
Connected diagonal hull continues to use directional quarter artwork.
The 90-degree and 270-degree parallel-chain chevrons now use their dedicated
native references for both the connected hull and the enclosed gap, preserving
the upright shading and front faces that rotating the side chevron lost.

## Rendering rules and regression checks

Ordinary walls without an empty diagonal join compose native straight-wall and
inside-corner quarters. Exact supplied reference matches retain their artwork.
This addresses the reported straight wall, floored cross, and extended floored
cross (original cases 3-5), along with floored T, long wall, L, U, floor hole,
paired floor holes, and parallel corridor cases.

Adding the new references exposed another selection problem: artwork from a
one-sided floored diagonal could add bevels across a fully floored gap. Floor
decoration now requires the same corner configuration as the target layout.
Tests check fully floored diagonals in all rotations and ensure a one-sided
diagonal still retains its native small inside bevel.

The tests now enumerate all 6,561 center-hull 3x3 neighborhoods, including empty
diagonal joins. Every tested quarter preserves its center tile's horizontal and
vertical hull connections. A broader [4x4 audit](HULL_4X4_AUDIT.md) exposed and
fixed an unconstrained reference fallback, and documents remaining visual
candidates separately from structural checks.

## Visual verification and limits

The audit rendered the original five reported layouts and 16 additional layouts
across all four rotations (84 renderings). Contact sheets show the six new
reference cases in all rotations, plus the broader shape checks. These use the
actual canvas renderer and runtime texture cleanup.

Unpictured contexts still use approximate selection. In particular, the
alternating-floor diagonal and empty Z below lack dedicated game references;
their exact transitions remain unverified. No pixel-equivalence claim is made
for these or arbitrary larger designs.

```text
Alternating-floor diagonal   Empty Z
H S .                       H H .
. H S                       . H H
S . H                       H H .
```

Rotational alpha-mask differences are inspection aids rather than pass/fail
criteria: native lighting, screenshot borders, and overhangs can differ with
orientation. Exact-match tests establish reference selection and connectivity,
not pixel-perfect in-game shading in every rotation.
