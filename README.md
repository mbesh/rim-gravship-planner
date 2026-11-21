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
- Add tanks, thrusters, a pilot console, upgrades, life-support equipment, and autodoors. The palette shows footprints and stated component limits, with links to the wiki.
- Watch design checks for missing foundations, disconnected substructure, unsupported tiles, blocked thruster clearance, and invalid pump placement.
- Save and load named designs in browser local storage. Designs stay on the same browser, device, and origin (including port).

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

The optional [4x4 hull rendering audit](HULL_4X4_AUDIT.md) exercises the actual canvas renderer across 167,139 layouts and records reference candidates. Its native canvas dependency is only needed for that audit.

## Project files

- `app.js`, `index.html`, `style.css`: editor interface and canvas rendering.
- `model.js`: ship state, drawing geometry, placement rules, validation, and movement.
- `components.js`: component catalogue, footprints, rotations, artwork, and exhaust areas.
- `hull.js`: floor-aware hull corner selection, reference texture cleanup, and quarter-tile rendering.
- `server.mjs`: local static development server.
- `assets/`: component artwork and reference images.

## Artwork and references

Unofficial fan project; not affiliated with Ludeon Studios. RimWorld artwork remains the property of its respective owners. Component images were supplied from the [RimWorld Wiki](https://rimworldwiki.com/wiki/Gravship). The cleaned east-facing vac barrier was derived from an in-game screenshot with AI-assisted background removal. The oxygen pump uses a custom schematic marker.
