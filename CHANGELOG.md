# Release notes

## 1.0.1 — 2026-11-24

- Add two-finger pan and pinch zoom, with a visible Pan tool for one-finger navigation. Starting a navigation gesture restores the unfinished edit and preserves undo history.
- Keep drawing and rotation controls within the mobile viewport, including short landscape screens, with larger touch targets and a readable shape selector.
- Keep the design name and save status visible on phones and tablets, ask for a name on the first save of an unnamed design, and keep saved-design actions accessible with long names.
- Simplify the palette to one scroll region with sticky search and collapsible categories, with settings separate from component browsing.
- Validate with 111 automated tests and Chromium touch checks at seven mobile/tablet sizes plus desktop. Physical-device Safari and keyboard testing remains outstanding.
- Include the previously undeployed Vanilla Gravship Expanded support and ship-system estimates from 1.0.0. Vanilla Gravship Expanded support still needs more thorough in-game testing.

## 1.0.0 — 2026-11-23

- First versioned release of the gravship planner, with tile drawing, ship components, design checks, local saves, and live drawing measurements.
- Display the release version in the app header.
- Enable detailed hull corners and diagonal artwork by default; faster rendering remains available in Rendering settings.

- Add optional Vanilla Gravship Expanded Chapters 1 and 2, with saved per-design settings, original component artwork, engine variants, field equipment, capacity modifiers, independent pipe layers, and subscaffold.
- Add live oxygen, heat, fuel, and range estimates, with saved crew, cabin, load, charge, jump, environment and research assumptions.
- Float the collapsible build palette and drawing/Add/Erase/rotation controls over the grid, with responsive mobile controls.
