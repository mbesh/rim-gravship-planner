# Required validation

- Run `npm test` before declaring implementation complete. It includes version checks, unit tests, and real-browser UI validation. `npm run test:unit` and ad-hoc browser scripts are diagnostic tools, not substitutes for the required suite.
- UI changes must pass `npm run test:ui` using Chrome/Chromium. A missing browser is a failure, not a reason to skip. Use Node 24+ and install Chrome or set `BROWSER_BIN` to its executable.
- Review the new screenshots and computed-style reports under `artifacts/ui/<run>/`, including small-phone portrait, short landscape, and desktop. Compare peer-control typography, selected-label fit, alignment, and mode visibility.
- Use shared styles for peer controls. When adding or changing a control, extend the rendered-style contracts in `tools/validate-ui.mjs` to cover its peer group, visible states, and responsive breakpoints. Do not weaken checks or accept a changed baseline merely to make a failure pass; explain any intentional style difference.
- Report the actual coverage: Chromium emulation and screenshots do not establish physical iPhone Chrome/Safari behavior.

# Release gate

- Follow `RELEASING.md`. Run `npm run release:check`; then commit and push the source and wait for **Required validation / Unit and browser UI checks** to pass for that exact commit before creating a release tag, publishing a GitHub release, or pushing a Pages deployment.
- After Pages succeeds, run the same UI suite against the live site with `UI_BASE_URL=https://mikebeshai.com/rim-gravship-planner/ npm run test:ui` (set the environment variable using the current shell). Inspect its artifacts before declaring the release complete.
