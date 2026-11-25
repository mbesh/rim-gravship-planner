# Mobile usability review

Tested 2026-11-24 against commit `064a129` using local source and Chromium mobile viewport/touch emulation. This is a task-based usability inspection, not a study with recruited users or a physical-device certification. The findings below describe that baseline; the implementation follow-up records the subsequent fixes.

## Coverage

| Viewport (CSS pixels) | Initial drawing toolbar |
| --- | --- |
| 320 × 568 | Below the viewport: y=684–785 |
| 360 × 640 | Below the viewport: y=684–785 |
| 390 × 844 | Visible: y=684–785 |
| 430 × 932 | Visible: y=642–743 |
| 768 × 1024 | Visible: y=673–779 |
| 844 × 390, landscape | Below the viewport: y=673–779 |

Touch workflows were exercised primarily at 390 × 844. Successful checks included engine placement, substructure placement and erasure, drawing a six-tile line, saving and loading a design, selecting a pilot console, and rotating its placement preview from South to West with the visible button. Enabling Chapter 2 also enabled Chapter 1; component search filtered the expanded palette. No uncaught application exceptions were recorded in the main audit. Initial layouts had no horizontal page overflow at the six sizes above.

## Findings

### 1. High: touch navigation can modify the design

With substructure selected, a two-finger spreading gesture increased the floor count from 11 to 17 while zoom stayed at 112%. A separate fresh-design reproduction added seven floor tiles; one Undo removed six and left one accidental tile. The second pointer replaces the active drawing transaction, so a single undo does not restore the pre-gesture design.

A vertical swipe similarly painted five tiles, without scrolling the page. Drawing with one finger is expected in a drawing tool, but there is no touch equivalent of Space/middle-mouse panning. Dragging empty space in Select / move did not pan either. Users cannot safely navigate the canvas with familiar touch gestures.

**Recommendation:** support two-finger pan and pinch zoom; cancel/restore an in-progress paint stroke when another finger joins, and track pointer ownership. Add an explicit Pan tool as a discoverable alternative. Verify that a navigation gesture makes no design changes and does not add an undo entry.

**Relevant code:** `app.js:323–377` and the canvas `touch-action:none` rule in `style.css`.

### 2. High: essential controls are below the fold on shorter screens

At 320 × 568, 360 × 640, and landscape 844 × 390, drawing, Add/Erase, and rotation controls initially sit entirely below the visible screen. The workspace has a fixed height of 720px on phones and 760px on larger widths. Scrolling from the canvas does not move the page because touch input is captured for drawing. Users must discover a narrow area outside the canvas to scroll, and bringing tools into view reduces visibility of the upper grid.

**Recommendation:** size the drawing workspace to the available viewport, with its essential toolbar always visible. Account for dynamic browser chrome and safe-area insets; test short portrait and landscape explicitly.

**Relevant code:** `style.css:69–78` and the base canvas rule.

### 3. Medium: mobile users cannot name or identify their current design

The entire document header, including the design-name input and saved/unsaved indicator, is hidden at widths up to 1100px. Its input measured zero width and height on every tested layout, including the tablet. Saving a new design used “Untitled gravship” without offering a name. Multiple new designs therefore have indistinguishable default titles, and a loaded design's name is absent from the main screen.

**Recommendation:** offer a name field when saving a new design and an editable current title on mobile. Preserve a compact saved/unsaved indicator.

**Relevant code:** `style.css:1` (`.document{display:none}` breakpoint), `index.html:4`, and `app.js:385–386`.

### 4. Medium: a long saved name pushes Load and Delete offscreen

At 390px wide, a valid 70-character unbroken saved name produced a 351px-wide dialog with 844px of scrollable content. Load began at x=746 and Delete at x=806, outside the viewport. This was tested with a constructed long-name fixture representing a design named on desktop; normal short-name save/load worked.

**Recommendation:** allow the name column to shrink (`min-width:0`), wrap or truncate long names, and keep actions within the dialog. Stack actions underneath the title on narrow screens if needed.

**Relevant code:** `.saved-row` rules in `style.css:1` and `app.js:387`.

### 5. Medium: several frequently used controls have small touch targets

At 390px wide, Undo/Redo measured approximately 31 × 30px, Center ship was 29px high, header actions were 32px high, Add/Erase were 33px high, and zoom buttons were 35px high. These leave little tolerance for finger placement, especially when undoing an accidental gesture. This is a measured usability concern, not a claim of a formal accessibility-standard violation.

**Recommendation:** enlarge hit areas toward 44–48px and preserve spacing between opposing actions. Icons can remain visually smaller inside larger buttons.

### 6. Medium: shape choices lose their visible names

On phones, shape-button text is hidden with `font-size:0`; only the symbols remain. The active shape's text in `#shape-label` is also hidden. Rectangle versus filled rectangle and circle versus filled circle require interpreting small symbols. Desktop hover titles are not a dependable explanation for touch users. Accessible labels are present, so this is a visual discoverability problem rather than missing screen-reader names.

**Recommendation:** retain a visible active-shape name and expose readable labels in a touch-friendly shape picker.

**Relevant code:** `style.css:78–79` and the `.subtle{display:none}` breakpoint.

### 7. Low: the component palette has nested scrolling

With expanded mod support enabled, the palette contained 124 components. At 390 × 844 the outer palette had a 380px viewport for 672px of content, while the inner filtered component list had a separate 210px viewport for 422px of content. Browsing requires switching between scroll regions; settings, base tiles, search, and components compete for the same limited panel space.

**Recommendation:** use one main scroll region with sticky search, collapsible categories, and optionally recently used components. Keep settings separate from the main browsing path.

## Evidence and limits

The temporary, ignored test artifacts are under `node_modules/.mobile-ux-2026-11-24/`:

- `results.json`: six viewport measurements, core task results, gesture counts, and library overflow measurements.
- `followup-partial.json`: confirmed rotation, empty-space drag, and the pinch/Undo reproduction. The follow-up stopped when a later save probe could not read a saved entry; subsequent component movement was not validated. The main audit separately completed save/load successfully.
- `small-phone-initial.png`, `landscape-initial.png`: controls below the fold.
- `phone-after-pinch.png`: accidental drawing following a pinch.
- `phone-touch-rotation-confirmed.png`: visible rotation control and West-facing preview.
- `phone-long-name-library.png`: clipped saved-name row and offscreen actions.

Physical iOS Safari/Android Chrome, the on-screen keyboard, browser chrome changes, notches/safe areas, assistive technology, finger precision, large-design performance, and the numerical accuracy of mod support still need separate testing. The initial inspection made no application changes. See the implementation follow-up below for the subsequent fixes.


## Implementation follow-up — 2026-11-24

All seven findings have corresponding changes:

- **Safe navigation:** two fingers pan and pinch to zoom; joining with another finger rolls back the unfinished drawing/move transaction. The remaining finger cannot paint until all fingers lift. Pointer ownership prevents unrelated pointers from committing a stroke. A visible Pan toggle permits one-finger navigation and returns to the previous drawing tool.
- **Reachable controls:** mobile/tablet workspace height follows the visible viewport and measured header height, with safe-area spacing. Short landscape layouts keep rotation, Add/Erase, and Pan on a compact row. The empty-state instructions were shortened visually to fit the available space.
- **Design identity:** editable title and saved/unsaved status remain visible on mobile/tablet. The first save of an unnamed design asks for a name; later saves update the same entry.
- **Library overflow:** long names wrap and mobile Load/Delete actions move below the title, remaining within the dialog.
- **Touch targets:** primary mobile actions and the name field have hit areas at least 44px in each relevant dimension; rotation and zoom controls have larger targets too.
- **Shape names:** mobile uses a labeled native shape selector, while the active shape/dimensions remain visible above the grid. Desktop retains the shape buttons.
- **Palette navigation:** the palette has one scroll region, sticky search, and collapsible component categories. Search opens matching categories. Opening Ship settings presents settings separately from component browsing. The palette collapses after a selection at tablet/mobile widths.

### Follow-up verification

Automated Chromium touch emulation passed at **320 × 568, 360 × 640, 390 × 844, 430 × 932, 768 × 1024, 844 × 390, and 568 × 320**, plus a **1440 × 900** desktop check. Screenshots were inspected, including rotation controls in short landscape. The drawing toolbar stayed within the viewport in all mobile layouts, with visible name/status and no initial horizontal page overflow.

At 390 × 844, a pinch changed zoom from **100% to 157%** while the saved design remained identical. Undo removed the prior floor edit and Redo restored it. Explicit Pan changed the view without editing. Naming, shape changes, rotation, mod-dependent component search, and save/load completed successfully. A 70-character saved name produced no dialog overflow, with both actions visible and 44px high. No uncaught application exceptions were recorded.

`npm test` passed **111 tests**, including five new regression tests for gesture rollback/history, Pan, pointer ownership/cancellation, first-save naming, and category search/shape selection. `npm run check:version` and `git diff --check` passed.

Temporary browser verification artifacts are in `node_modules/.mobile-ux-2026-11-24/fixes/verification.json` and the screenshots alongside it. They are ignored by Git. Browser emulation still does not replace physical Safari/Android keyboard and safe-area testing. No commit, release, or deployment was performed.

## Mobile search keyboard follow-up — 2026-11-25

A user reported that Chrome on iPhone hid the search field while the keyboard was open. The palette was positioned within the board's clipped area: reducing the visible viewport height shortened the board, while browser scrolling left the focused field outside that area. Keyboard behavior can resize and pan the visual viewport independently of the layout viewport; see [Chrome's viewport resize documentation](https://developer.chrome.com/blog/viewport-resize-behavior).

Focusing mobile component search now anchors the palette to the visual viewport, with its size and position updated on viewport resize and scroll. The search field stays below the sticky palette heading. The panel retains its position through input blur so tapping a result does not move that result before the click; closing the palette restores its usual placement and blurs the field to dismiss the keyboard. Desktop browsing retains the normal floating palette.

Controlled Chromium checks reproduced the old clipping at 390 × 844: with a 320px visible viewport and a 90px viewport offset, the palette ended at y=101 while the focused search field began at y=293. The fixed palette occupied y=102–398 and the field y=159–203. Checks passed at 360 × 640, 390 × 844, 844 × 390, and 768 × 1024, including viewport panning, filtering, no results, tapping a result, closing/reopening the palette, and no horizontal overflow. Desktop 1440 × 900 kept its usual palette. These checks simulated keyboard viewport geometry; they did not open a physical iPhone keyboard.

All 141 automated tests passed, including regression coverage for focus, keyboard resize/pan events, result filtering, close/blur behavior, desktop restoration, and the fallback without VisualViewport. Ignored browser artifacts are in `node_modules/.mobile-search-keyboard-baseline/` and `node_modules/.mobile-search-keyboard-fixed/`. Physical iPhone Chrome verification remains pending.
