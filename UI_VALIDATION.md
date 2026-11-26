# Required UI validation

`npm test` runs version validation, the unit suite, and the rendered UI suite. `npm run release:check` runs that complete suite plus `git diff --check`. Chrome/Chromium and Node 24+ are required for development validation; the static app itself has no browser-automation dependency. Set `BROWSER_BIN` if the browser is installed outside the usual locations. Missing Chrome or failed UI assertions cause a nonzero exit; no browser checks are skipped.

The checked-in `Required validation` GitHub Actions workflow runs the same test command on pushes and pull requests, installs Chrome, and retains UI screenshots and computed-style JSON reports for seven days, including failed runs. The workflow becomes active when these changes are pushed. This does not alter GitHub branch-protection settings.

## Contracts checked in a real browser

The suite covers 320 × 568, 360 × 640, 390 × 844, 430 × 932, 568 × 320, 844 × 390, 768 × 1024, 1100 × 1000, 1101 × 1000, and 1440 × 900. This includes both sides of the mobile/desktop breakpoint.

- Paired dropdowns share font family, size, weight, style, line height, letter spacing, text case/alignment, text/background colors, border styling, corner radius, padding, and native appearance.
- The rendered version matches the validated source, including when running against the live site.
- Peer toolbar buttons share typography in both build and erase modes; intentional semantic color differences are preserved.
- Mobile dropdown text is at least 16px, dropdown targets are at least 44px high, and mobile buttons have 44px height.
- Both dropdowns stay visible, adjacent, and on one row, with no horizontal page overflow. Every selected option label fits with room reserved for the native arrow.
- Erase options appear only in erase mode. Selection and Pan hide the drawing options; desktop build mode retains its shape buttons. Focus retains peer typography.

Screenshots and reports are stored in `artifacts/ui/<timestamp>/`, ignored by Git. Browser profiles use isolated temporary directories and are excluded from reports. A failure names the viewport, control, and mismatched property or geometry. Before a release, review screenshots of portrait, landscape, and desktop for visual differences beyond the automated contracts. A shared-style assertion cannot detect every artwork or native-platform rendering defect; physical iPhone Chrome/Safari validation remains separate.

Run against a deployed build by setting `UI_BASE_URL` to the planner URL before `npm run test:ui`. It uses a fresh browser profile and does not access the user's saved designs.

## Why the v1.2.1 mismatch passed earlier checks

The unit suite uses a mock DOM/canvas and does not render CSS. The previous temporary browser scripts checked placement, visibility, adjacency, and behavior without comparing computed typography. The screenshot review also missed the difference. Separate rules left draw-mode text at 12px and erase-target text at 16px. The new suite reproduced that exact failure before the shared-style fix; it now runs as part of the normal test command and the required release gate. The dropdowns share one 16px style. “Filled rect.” keeps the selected label readable at narrow widths; the full “Filled rectangle” name remains above the grid and in its tooltip.
