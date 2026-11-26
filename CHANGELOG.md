# Release notes

## 1.2.2 — 2026-11-26

- Fix the draw-mode and erase-target typography mismatch by giving both dropdowns one shared 16px style. Shorten the selected Filled rectangle label to Filled rect. at narrow widths while retaining its full name above the grid and in the tooltip.
- Use the standard plus character for Add and Zoom in so their icons remain readable with the CI/Linux font set.
- Make real-browser UI validation part of `npm test` and `npm run release:check`. Check peer typography/appearance, mobile text and control sizes, label fit, adjacency, visibility, overflow, and rendered version across ten viewport sizes.
- Add CI validation on pushes and pull requests with retained screenshots and style reports. Require passing CI for the exact source commit and screenshot review before publishing or deploying; repeat the same UI gate against the live site.
- Validate with 158 unit tests, the ten-size browser suite, and CI workflow linting. The browser check reproduced the original 12px-versus-16px failure before the fix. Physical-device iPhone verification remains pending; Vanilla Gravship Expanded support still needs more thorough in-game testing.

## 1.2.1 — 2026-11-26

- Group the draw-mode and erase-target dropdowns directly beside each other while Erase is active on desktop and mobile. Hide the erase dropdown when Erase is off.
- Keep the dropdown pair together in short landscape layouts and preserve the regular desktop drawing buttons outside erase mode.
- Validate with 158 automated tests and desktop, small-phone, and landscape Chromium checks for dropdown adjacency, visibility, eraser targets, previews, Undo/Redo, and touch cancellation. Physical-device verification remains pending; Vanilla Gravship Expanded support still needs more thorough in-game testing.

## 1.2.0 — 2026-11-26

- Add a universal Erase tool in the floating toolbar that works independently of the build palette. Its Components target preserves hull and substructure by default; choose Hull / doors, Substructure, or Everything for other layers.
- Brush across mixed component types or use Filled rectangle and the other drawing shapes. Preview whole affected components and a removal count before release, then undo the completed drag as one action.
- Include dependent extenders in engine-removal previews. Cancel on interrupted touch, a second finger, or tool changes without editing the design or adding history. Preserve desktop typed right-click erasure.
- Keep controls reachable on small phones and landscape screens, hide Remove selected without a selection, and let Erase toggle back to the previous tool. Previewing does not clone or revalidate the design.
- Validate with 158 automated tests and desktop/mobile Chromium checks across five layouts, including native mouse and touch input, all targets, rectangles, foundation preservation, save, Undo/Redo, and cancellation. Physical iPhone Chrome/Safari verification remains pending; Vanilla Gravship Expanded support still needs more thorough in-game testing.

## 1.1.1 — 2026-11-25

- Fix a CSS specificity conflict that reduced component search text to 12px on phones. Keep mobile search at 16px before and during focus to address unwanted iPhone browser focus zoom.
- Preserve intentional browser zoom, grid zoom, keyboard visibility, and search result selection.
- Validate with 147 automated tests, seven-layout Chromium checks for computed text size and repeated focus/close cycles, preserved 150% page zoom, and simulated keyboard checks. Physical iPhone Chrome/Safari verification remains pending; Vanilla Gravship Expanded support still needs more thorough in-game testing.

## 1.1.0 — 2026-11-25

- Add 41 placeable Production items: all 26 base-game production buildings, tool cabinets and multi-analyzers, ten Biotech production/support machines, and three Anomaly production machines.
- Include original wiki artwork, available directional variants, DLC labels, search, full-footprint placement, rotation, moving, removal, Undo/Redo, and browser save/load. Load production canvas artwork on demand and choose an available original facing for initial placement.
- Keep mobile component search visible above the keyboard by anchoring the palette to the visual viewport during search. Follow viewport resize and scroll, preserve result positions through blur, and dismiss search focus when the palette closes.
- Document production scope, footprints, artwork sources and hashes, and simulation limits. Production rates, facility connections, interaction-cell access, and electricity consumption are not simulated.
- Validate with 147 automated tests and desktop/mobile Chromium checks for all 41 production items and 58 referenced images, touch placement and rotation, movement, removal, Undo/Redo, save/reload, DLC search, and simulated keyboard viewport changes. Physical-device iPhone Chrome/Safari verification and more thorough in-game testing of Vanilla Gravship Expanded support remain outstanding.

## 1.0.10 — 2026-11-25

- Drag component previews with touch and release to place them. Keep newly placed components selected for immediate rotation, movement, or removal, including engines and field extenders.
- Cancel unfinished placement on interruption or two-finger navigation without adding a component or undo step. Preserve the existing floor, hull, subscaffold, and pipe drawing tools.
- Show a field extender sprite in the placement preview and explain touch placement in the controls help.
- Validate with 140 automated tests and touch browser checks on phone, tablet, landscape phone, and desktop layouts. Physical-device Safari testing and more thorough in-game verification of Vanilla Gravship Expanded support remain outstanding.

## 1.0.9 — 2026-11-24

- Add 57 placeable furniture types under Furniture: 36 base-game items and 21 official DLC additions, including beds, tables, seating, thrones, storage, lighting, children's furniture, outfit stands, and decorations.
- Show required DLCs in the palette and descriptions; search by item, category, or DLC. All furniture is available for planning independently of the mod chapter toggles.
- Support full-footprint placement, rotation, movement, removal, Undo/Redo, and browser saves. Wall lamps and wall torches share hull tiles and require a mount.
- Use original wiki artwork and available directional variants, with source URLs and hashes. Load furniture canvas artwork as needed and retain lazy palette icons.
- Validate with 136 automated tests and desktop/mobile browser checks for all furniture artwork, DLC search, placement, rotation, wall mounting, movement, removal, Undo/Redo, and save/load. Physical-device Safari testing and more thorough in-game verification of Vanilla Gravship Expanded support remain outstanding.

## 1.0.8 — 2026-11-24

- Group all mod thrusters under Flight, including the giant astrofuel thruster and small, large, and giant electric thrusters.
- Preserve chapter availability, search, vanilla grouping, and Undo/Redo behavior.
- Validate with 131 automated tests and desktop/mobile browser checks for both mod chapters. More thorough in-game verification of Vanilla Gravship Expanded support remains outstanding.

## 1.0.7 — 2026-11-24

- Add wood-fired and chemfuel generators, wind turbines, geothermal generators, watermills, and vanometric power cells to Power, using wiki footprints and original artwork. Keep the ship reactor excluded.
- Move the mod gravship capacitor into Power.
- Show estimated electricity generation and a source breakdown in Ship systems, including mod engines' output after connected substructure load, gravcore adjacency bonuses, and heatsink generation from the stored-heat assumption.
- Label full-sun solar and normal-wind estimates. Show generation before consumption and exclude demand-driven emergency generators from the total.
- Import numeric mod power data and document operating assumptions and artwork provenance. Preserve placement, rotation, Undo/Redo, and local save/load.
- Validate with 131 automated tests and desktop/mobile browser checks. Physical-device Safari testing and more thorough in-game verification of Vanilla Gravship Expanded support remain outstanding.

## 1.0.6 — 2026-11-24

- Show Platform immediately after Structure in the mod component palette.
- Group the pilot console under Platform and small/large astrofuel tanks under Fuel network when mods are enabled. Restore their vanilla Flight grouping when mods are disabled.
- Preserve component search, category visibility, and grouping through mod changes and Undo/Redo.
- Validate with 127 automated tests and desktop/mobile browser checks for both mod chapters, search, and vanilla restoration. More thorough in-game verification of Vanilla Gravship Expanded support remains outstanding.

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
