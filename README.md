# RimWorld Gravship Planner

A browser-based, 2D tile planner for RimWorld: Odyssey gravships.

## Run locally

Requires Node.js 20 or newer. No dependency installation or build step is needed.

```sh
npm start
```

Open the local URL printed in the terminal. The server starts at port 5173 and tries the next available port if it is occupied. To choose a port:

```sh
npm start -- --port 5174
```

## Planning a ship

- Place one grav engine, then draw substructure beneath and around it.
- Draw individual tiles, straight or diagonal lines, outlined or filled rectangles, and outlined or filled circles.
- Place up to six grav field extenders. The planner uses the stepped engine and extender field layouts supplied in the reference screenshots.
- Add tanks, thrusters, a pilot console, upgrades, life-support equipment, autodoors, and solar generators. The palette shows footprints and stated component limits, with links to the wiki. Solar generators are fixed 4 × 4 components under Power and need 16 supporting substructure tiles.
- Watch design checks for missing foundations, disconnected substructure, unsupported tiles, blocked thruster clearance, and invalid pump placement.
- Save and load named designs in browser local storage. Designs stay on the same browser, device, and origin (including port).
- Hull uses fast, cardinal-only rendering by default. Under Rendering, enable **Render diagonal in hull (slower performance)** for the detailed diagonal artwork. This view option leaves the design unchanged and starts off on each page load. Small edits update nearby diagonal hull cells; the app loads prepared textures without processing screenshot pixels in the browser.

## Controls

| Action | Control |
| --- | --- |
| Place tiles or components | Select a palette item, then click or drag |
| Draw a shape | Select a drawing tool, then drag between tiles |
| Rotate before placing | Q / E or the rotation buttons |
| Erase the active palette layer | Right-click an occupied tile, or choose Erase |
| Deselect the build tool | Right-click empty space or press Escape |
| Select and move | Choose Select / move, then drag a placed item |
| Cancel a move | Escape |
| Pan | Space + drag or middle mouse drag |
| Zoom | Mouse wheel or zoom buttons |
| Undo / redo | Ctrl+Z / Ctrl+Shift+Z |
| Save | Ctrl+S or Save design |

Autodoors and hull replace each other while preserving substructure. Oxygen pumps mount on hull edges, face a non-hull tile, and appear as small orange markers. Moving items preserves their orientation; invalid drops leave the design unchanged.

## Tests

```sh
npm test
```

The tests cover placement rules, field geometry, rotation, replacement, movement, local save data, and editor interactions using a simulated DOM/canvas.

Rendering requests are batched into browser frames. Placement and movement previews share read-only validation with committed edits; tool changes reuse design checks and grav fields. Regression tests cover curved/coalesced strokes, final pointer-up positions, cancellation, one-step undo, cached sidebar updates, and saved-design changes from another tab.

The optional [4x4 hull rendering audit](HULL_4X4_AUDIT.md) exercises the actual canvas renderer across 167,139 layouts and records reference candidates. Native canvas is only needed for the optional audit and asset-preparation tools.

## Prepare hull artwork

The checked-in PNGs under `assets/hull-prepared/` are ready for the browser; running
the app and normal tests needs no image-processing dependency. When hull reference
images, reference grids, or texture-cleanup rules change, regenerate these assets:

```sh
npm install --no-save --package-lock=false @napi-rs/canvas
npm run prepare:hull
npm run check:hull-textures
```

Commit the prepared PNGs and their generated manifest with the source changes.
Normal tests verify their source hashes, reference grids, cleanup recipe, PNG
dimensions, and output hashes. The optional pixel check above also verifies that
each prepared image exactly matches a fresh run of the cleanup function.

## Project files

- `app.js`, `index.html`, `style.css`: editor interface and canvas rendering.
- `model.js`: ship state, drawing geometry, placement rules, validation, and movement.
- `components.js`: component catalogue, footprints, rotations, artwork, and exhaust areas.
- `hull.js`: floor-aware hull corner selection, incremental layout updates, texture-preparation rules, and tile rendering.
- `tools/prepare-hull-textures.mjs`: development-only generation and pixel verification of prepared hull artwork.
- `server.mjs`: local static development server.
- `assets/`: component artwork and reference images.

## Artwork and references

Unofficial fan project; not affiliated with Ludeon Studios. RimWorld artwork remains the property of its respective owners. Component images were supplied from the [RimWorld Wiki](https://rimworldwiki.com/wiki/Gravship). The cleaned east-facing vac barrier was derived from an in-game screenshot with AI-assisted background removal. The oxygen pump uses a custom schematic marker.
