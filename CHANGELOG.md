# Release notes

## 1.0.5 — 2026-11-24

- Paint normal and hidden astrofuel pipes with continuous strokes and every drawing shape on desktop and mobile. Connect both pipe types through cardinal neighbors, without diagonal joins; show hidden pipes with faint linked artwork.
- Preserve existing fuel pipes and valves when painting across them. Erase only the selected pipe type, undo whole strokes, and enforce the saved-design component limit during placement.
- Cache network tile lookup for connected rendering of long pipe runs.
- Highlight the original engine field boundary when selecting a placed engine or choosing its build tool, including when the general field view is hidden.
- Validate with 127 automated tests and desktop/mobile browser checks for pipe drawing, mixed connections, erase, Undo/Redo, save/load, and engine field selection. Physical-device Safari testing and more thorough in-game verification of Vanilla Gravship Expanded support remain outstanding.

## 1.0.4 — 2026-11-24

- Allow planning tiles and components outside the grav field, including moves and rotations. Mark unsupported placements red while Validation highlights is enabled.
- Allow structures without substructure, including over subscaffold. Mark missing foundation tiles red; adding substructure underneath clears the warning.
- Keep invalid field extenders and unlinked mod field generators from adding field coverage or capacity. Preserve collision, mounting, component-count, substructure-capacity, and save-grid limits.
- Show red placement and movement previews, retain warnings through save/load, and clear field warnings when valid coverage reaches the design.
- Reuse field sources during validation and add regression coverage for both planning modes, support restoration, and Undo/Redo.
- Validate with 123 automated tests and desktop/mobile browser checks. Physical-device Safari testing and more thorough in-game verification of Vanilla Gravship Expanded support remain outstanding.

## 1.0.3 — 2026-11-24

- Add touch-sized rotation arrows beside selected rotatable components. Choose **Select / move**, tap the component, then use the arrows.
- Make the toolbar's Rotate buttons and Q / E rotate placed selections as well as placement previews. Keep the toolbar available when nearby arrows cannot fit on a short screen.
- Rotate around a stable central grid tile without drifting across repeated turns. Support Undo/Redo and reject blocked footprints, unsupported field positions, and invalid oxygen-pump outlets without changing the design.
- Preserve supporting floor and apply the existing hull-replacement rules for doors. Fixed components remain non-rotatable.
- Improve short-landscape controls and canvas resizing between tablet and desktop layouts; allow Space to activate focused buttons.
- Validate with 117 automated tests and Chromium touch-rotation checks across seven mobile/tablet sizes plus desktop. Physical-device Safari testing and more thorough in-game verification of Vanilla Gravship Expanded support remain outstanding.

## 1.0.2 — 2026-11-24

- Move **Select / move** into the bottom floating toolbar so selection is available without opening the build palette.
- Show the selected item's name and a **Remove selected** action. Delete and Backspace also remove the selection; Undo restores it. Removing a component preserves its supporting floor and other overlapping layers.
- Adapt the toolbar for phones, tablets, and short landscape screens, hiding irrelevant drawing controls during selection.
- Validate with 113 automated tests and mobile/desktop browser layout and native-button checks. Physical-device verification of tapping Remove immediately after dragging remains outstanding.

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
