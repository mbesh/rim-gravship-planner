# Vanilla Gravship Expanded support

Enable Chapter 1 or Chapter 2 under **Build palette → Ship settings → Mod support**. Chapter 2 automatically enables
Chapter 1; disabling Chapter 1 disables both. The settings and selected engine
are stored with each design, draft and undo step. New keeps the selected settings.
Disabling a chapter preserves its placed components and flags them in design
checks. Loading older vanilla saves keeps vanilla rules.

The catalog includes **77 Chapter 1 components**, **32 Chapter 2 components**, two
additional engine types, and subscaffold. The [complete component table](MOD_CATALOG.md)
links each footprint, rotation rule and ship limit to the authors' definition.
Conditional Biotech/Ideology furniture is labeled with its required DLC.

## Engine and field rules

| Ruleset / engine | Footprint | Base capacity | Field radius |
| --- | --- | --- | --- |
| Vanilla grav engine | 3 × 3 | 500 | 18.9 |
| Chapter 1 gravjumper engine | 1 × 1 | 100 | 7.9 |
| Chapter 1 gravship engine | 3 × 3 | 250 | 11.9 |
| Chapter 1 gravhulk engine | 5 × 5 | 500 | 23.9 |

Chapter 2 uses Chapter 1's engine rules. Only one engine can be placed. Engine
selection changes its actual placement, selection, moving and support footprint.
All footprints still require manually placed substructure.

| Field equipment | Radius | Capacity offset | Maximum | Placement |
| --- | --- | --- | --- | --- |
| Vanilla extender | 16.9 | +250 | 6 | Original engine field |
| Mod extender | 12.9 | +100 | 10 | Engine or active amplifier field |
| Grav field amplifier | 22.9 | +200 | 4 | Original engine field |
| Grav field dilutor (Chapter 2) | 36.9 | −250 | 1 | Original engine field |
| Structural beam | 3.9 | 0 | No ship-wide cap | Supported field; beams can extend a chain |

An extender cannot link through another extender. Removing an amplifier removes
support from extenders that depended on it. Unsupported beam chains no longer
extend the field. The original engine boundary remains highlighted when placing
field equipment.

Radius values come from the XML and describe distance between tile centers.
The engine and extender masks retain the supplied vanilla screenshots. Other
fields use the same stepped-circle construction. Drawing a filled circle with a
reach of `floor(radius)` matches that field's tile mask. The structural beam's
description says 5 × 5, but the current XML sets its footprint radius to **3.9**;
the planner follows the XML value.

Mod astrofuel thrusters add capacity multipliers of +1% (small), +5% (large), and
+10% (giant). Their limits are 10, 6 and 4 respectively. Electric thrusters have
the same size limits and add no capacity multiplier. Supported capacity is:

```text
floor((engine base + valid extender/amplifier/dilutor offsets)
      × (1 + sum of astrofuel thruster multipliers))
```

The overview shows this calculation. Component limits update with the mod rules:
for example, astrofuel optimizers allow four and rotate in Chapter 1; Chapter 2
allows four standard shield generators and one signal jammer.

## Other planning behavior

- Oxygen and astrofuel pipes/valves occupy independent network layers. Both can
  share a tile with each other, hull or equipment. Pipes use connected artwork.
- Subscaffold connects floor areas and uses no substructure capacity. It cannot
  support buildings and can be replaced by regular substructure. It remains
  subject to the supported field boundary.
- Airlocks, larger vac barriers, armor, industrial oxygen pumps and structural
  beams can replace hull. Hull can replace them again. Multi-tile barriers join
  hull at their ends in either orientation.
- Wall fixtures require hull or a hull-like mod component. Both oxygen pump
  types need a non-hull outlet. The original small pump keeps its orange edge
  marker.
- Thruster exhaust checks cover all sizes, including electric and giant
  thrusters. The catalog uses original directional artwork and turret overlays.
- Descriptions in the palette and definition links expose the mod's oxygen,
  astrofuel, heat, power, maintenance, research and combat roles.

The [ship systems summary](SYSTEMS.md) estimates fuel use, mixed-propulsion range,
oxygen balance and reserves, and heatsink capacity, jump heat and cooling.
Planning assumptions are saved with each design. Totals assume connected,
powered and supplied equipment; missing foundations, disconnections, field
boundaries and clearance are checked separately. Actual pipe flow, room pressure,
power-grid operation, room temperature, crew jobs and combat are not simulated. Enemy-only props, wreckage, natural
terrain, pawns, apparel, handheld weapons and integrations requiring unrelated
third-party mods are outside the placeable ship catalog.

## Sources and artwork

Read from the official [Chapter 1 Workshop page](https://steamcommunity.com/sharedfiles/filedetails/?id=3609835606)
and [Chapter 2 Workshop page](https://steamcommunity.com/sharedfiles/filedetails/?id=3799737423),
including their linked infographics. Exact data and artwork were imported from:

- [Chapter 1 source snapshot](https://github.com/Vanilla-Expanded/VanillaGravshipExpanded/tree/7212a0c11bc392079d1f8ac9395d6434aa29b8af)
- [Chapter 2 source snapshot](https://github.com/Vanilla-Expanded/VanillaGravshipExpanded2/tree/9dcee5bc5c78864dfda60c7b89ce1094b83ef26c)

The import uses the `1.6` definitions. The main building definitions also match
the repositories' `1.7` versions at these snapshots. `assets/mods/sources.json`
records the source URL and SHA-256 of every copied PNG. Artwork is unmodified;
runtime drawing selects directions, atlas cells and overlays.

Mod content belongs to the Vanilla Expanded team, credited on the Workshop
pages: Oskar Potocki, Sarg Bjornson, Taranchuk, Soky/Sokyran, erdelf and other
listed contributors. The pages state [CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/).
RimWorld remains the property of Ludeon Studios. See [artwork attribution](assets/mods/NOTICE.md).

To refresh against a reviewed upstream revision, obtain the authors' repositories
as `chapter1/` and `chapter2/`, then run:

```sh
python tools/import-mods.py path/to/source-checkouts
npm test
```

Review XML/patch changes, the generated catalog, artwork and rule tests together;
update the documented snapshot links when importing a new revision.
