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

The build palette floats over the upper-left grid corner; click its heading to collapse it. **Select / move**, drawing shapes, Add/Erase, and rotation controls are available in the floating toolbar along the bottom. On narrow screens the palette starts collapsed and closes after choosing an item. Mod, view and rendering options are under **Build palette → Ship settings**.

- Place one grav engine, then draw substructure beneath and around it.
- Draw individual tiles, straight or diagonal lines, outlined or filled rectangles, and outlined or filled circles.
- While dragging a line, circle, or rectangle, a center badge shows the preview's tile count. Width and height appear along the top and left when that dimension is greater than four tiles. Straight lines show their count once; outlines and filled shapes count their actual preview tiles.
- Place up to six grav field extenders. The planner uses the stepped engine and extender field layouts supplied in the reference screenshots.
- Selecting the placed engine or choosing its build tool highlights the original engine field boundary, even when the grav field view is hidden.
- Add tanks, thrusters, a pilot console, upgrades, life-support equipment, autodoors, and solar generators. The palette shows footprints and stated component limits, with links to the wiki. Solar generators are fixed 4 × 4 components under Power and need 16 supporting substructure tiles.
- Power also includes wood-fired and chemfuel generators, wind turbines, geothermal generators, watermills, and vanometric power cells. Their wiki footprints and operating requirements appear in the palette; terrain and wind clearance are not simulated. With mods enabled, gravship capacitors appear in Power.
- Furniture includes 57 base-game and official DLC items: beds and sleeping spots, animal beds, tables, seating and thrones, storage, lighting, children's furniture, outfit stands, and decorations. Required DLCs appear in the palette and descriptions; all are available for planning independently of the mod toggles. Search by item, category or DLC name. Rotatable items use Q/E or the visible rotation controls. Wall lamps and wall torches share a hull tile and require that mount. Furniture uses the standard placement, move, erase, and local-save controls. Materials, comfort, light coverage and furniture power consumption are not simulated.
- Production includes 41 workstations and supporting facilities: the base-game crafting, cooking, research, refining, and hydroponics buildings, plus Biotech gene/mech/subcore production and Anomaly bioferrite/serum equipment. Required DLCs appear in search and descriptions. Use the standard placement, rotation, move, removal, Undo/Redo, and browser-save controls. Production rates, recipes, interaction-cell access, facility links, and power consumption are not simulated. See the [production catalog](PRODUCTION.md).
- Watch design checks for missing foundations, disconnected substructure, unsupported tiles, blocked thruster clearance, and invalid pump placement.
- Plan tiles and components outside the grav field: these placements are allowed and marked red while validation highlights are enabled. Field warnings also apply when moving or rotating components. Unlinked extenders and inactive mod field generators do not expand the supported area or capacity; collision, mounting, component limits, and substructure capacity rules still apply.
- Place structures before laying their substructure, including on subscaffold. Missing foundation tiles are marked red until you add substructure underneath. Placement, movement, and rotation remain available; oxygen pumps still need a hull mount.
- Save and load named designs in browser local storage. Designs stay on the same browser, device, and origin (including port).
- Hull corners and detailed diagonal artwork are enabled by default. Under Rendering, turn off **Render diagonal in hull (slower performance)** to use faster cardinal-only rendering. This view option leaves the design unchanged. Small edits update nearby diagonal hull cells; the app loads prepared textures without processing screenshot pixels in the browser.

## Mod support

Enable **Vanilla Gravship Expanded — Chapter 1** or **Chapter 2** under **Build palette → Ship settings**. Chapter 2 enables Chapter 1 automatically. Select a gravjumper, gravship, or gravhulk engine; the planner applies the corresponding footprint, field and capacity rules. Mod settings are saved with each design.

The mods add 109 placeable components, two engine variants, and subscaffold, using original mod artwork. See [mod rules and source notes](MOD_SUPPORT.md) and the [complete component catalog](MOD_CATALOG.md).

Both astrofuel pipe types support click-and-drag painting and every drawing shape, including on mobile. Normal and hidden pipes connect to each other through tile edges; diagonal neighbors do not connect. Hidden pipes use faint linked artwork. Painting across existing fuel-network tiles preserves them. Desktop right-click removes only the selected pipe type; the universal Erase tool removes all matching components in its area. Each stroke can be undone as one action.

Choose **Erase** in the floating toolbar without choosing a palette item. Its default **Components** target removes whole components, including engines, extenders, furniture, machines, and pipes, while preserving hull and substructure. **Hull / doors** removes hull tiles and doors but leaves mounted equipment; **Substructure** removes substructure and subscaffold while leaving structures; **Everything** clears all layers under the brush. Removing an engine also removes its extenders, which are included in the preview.

Drag with **Single tile** to brush across items, or choose **Filled rectangle** to clear an area; the other drawing shapes also work. Touching any footprint tile includes the whole component. Highlighted items and a removal count preview the result before release. Cancel or begin a two-finger gesture to abandon the preview; each completed drag is one Undo action. Tap Erase again to return to the previous tool, or choose Select / move or a palette item. Erase targets are kept while using the editor and reset to Components when the app reloads.

## Ship systems

The inspector shows estimated electricity generation (including mod engine output), fuel storage, refining and consumption, range from fuel and thrusters, oxygen production and crew reserves, and heatsink capacity, jump heat and cooling. Open **Planning assumptions** to set crew, cabin volume, jump distance, fill levels, electric charge, vacuum and Heat Dissipation research. These values are saved with the design. See [formulas and assumptions](SYSTEMS.md).

## Controls

| Action | Control |
| --- | --- |
| Place tiles or components | Select a palette item, then click or drag |
| Place a component with touch | Choose it in the palette, touch the grid and drag its preview, then release; it stays selected for rotation, moving or removal |
| Draw a shape | Select a drawing tool, then drag between tiles |
| Rotate before placing | Q / E or the rotation buttons |
| Rotate a placed component | Select / move, tap the component, then use the arrows beside it, toolbar Rotate buttons, or Q / E |
| Erase across component types | Choose Erase, choose targets, then tap or drag; release to apply the preview |
| Clear a rectangular area | Choose Erase and Filled rectangle, then drag across the area |
| Erase the active palette layer | Right-click an occupied tile with the build tool active |
| Deselect the build tool | Right-click empty space or press Escape |
| Select and move | Choose Select / move, then drag a placed item |
| Remove selected item | Remove selected button, Delete, or Backspace; Undo restores it |
| Cancel a move | Escape |
| Pan | Two-finger drag, choose Pan and drag, Space + drag, or middle mouse drag |
| Zoom | Pinch with two fingers, mouse wheel, or zoom buttons |
| Undo / redo | Ctrl+Z / Ctrl+Shift+Z |
| Save | Ctrl+S or Save design |

Autodoors and hull replace each other while preserving substructure. Oxygen pumps mount on hull edges, face a non-hull tile, and appear as small orange markers. Moving items preserves their orientation; invalid drops leave the design unchanged.

Rotatable selections show touch-sized arrows beside their footprint. The toolbar also shows their current facing and Rotate buttons, including when the selected item is close to a screen edge. Rotation uses a stable central tile as its pivot, respects placement rules, and can be undone; blocked rotations leave the component unchanged.

On phones and tablets, components (including engines and field extenders) follow your finger until release and then stay selected in Select / move mode. Tap the rotation arrows or toolbar buttons, or drag the selected item again to adjust it. Choose the palette item again to place another copy. Invalid drops add nothing and keep the placement tool active; cancellation or a second finger adds nothing. Substructure, hull, subscaffold and paintable astrofuel pipes keep their brush/shape behavior. The shape selector displays readable shape names and the drawing controls stay within the viewport. The design name and save status remain visible; the first save of an unnamed design asks for a name. The palette uses one scroll region with sticky search and collapsible component categories. Starting a two-finger navigation gesture cancels the unfinished edit without adding an undo step.

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

## Releases

The header displays the release version from `package.json`, starting with **1.0.0**. See [release notes](CHANGELOG.md) and the [release workflow](RELEASING.md) for version bumps and deployment.

## Project files

- `app.js`, `index.html`, `style.css`: editor interface and canvas rendering.
- `model.js`: ship state, drawing geometry, placement rules, validation, and movement.
- `components.js`: component catalogue, footprints, rotations, artwork, and exhaust areas.
- `furniture.js`: base-game and official DLC furniture footprints, rotation and artwork references.
- `production.js`: production workstations and supporting facilities, including official DLC additions.
- `mods.js`, `mod-data.js`: mod dependency settings, engine profiles, imported components, and vanilla overrides.
- `tools/import-mods.py`: optional regeneration from the official mod source checkouts.
- `hull.js`: floor-aware hull corner selection, incremental layout updates, texture-preparation rules, and tile rendering.
- `tools/prepare-hull-textures.mjs`: development-only generation and pixel verification of prepared hull artwork.
- `server.mjs`: local static development server.
- `assets/`: component artwork and reference images.

## Artwork and references

Unofficial fan project; not affiliated with Ludeon Studios. RimWorld artwork remains the property of its respective owners. Component images come from the [RimWorld Wiki](https://rimworldwiki.com/wiki/Gravship); the additional base-game power artwork has [source URLs and hashes](assets/power-sources.json). The cleaned east-facing vac barrier was derived from an in-game screenshot with AI-assisted background removal. The oxygen pump uses a custom schematic marker.

Furniture artwork comes from the [wiki furniture list](https://rimworldwiki.com/wiki/Furniture) and linked item pages, with [source URLs and hashes](assets/furniture/sources.json). One representative material or sculpture design is shown per item.

Production artwork comes from the [wiki production list](https://rimworldwiki.com/wiki/Production) and linked item/DLC pages, with [source URLs and hashes](assets/production/sources.json). Available directional images retain their facing; other orientations use rotated artwork. The initial placement uses an available original facing.

Vanilla Gravship Expanded artwork and data are credited to the Vanilla Expanded team. See [mod artwork attribution](assets/mods/NOTICE.md) for sources and licensing.
