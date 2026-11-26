# Releasing the planner

`package.json` is the source of the app's semantic release version. The generated
`version.js` module makes that version available to the static browser app.
Commit both files together. Saved-design storage versions are independent of
release versions.

Use a patch version for fixes, a minor version for compatible features, and a
major version for incompatible changes.

1. Start with a clean checkout and bump the version:

   ```sh
   npm version patch --no-git-tag-version
   ```

   Substitute `minor`, `major`, or an explicit version as appropriate. The npm
   `version` lifecycle hook regenerates `version.js`. If editing `package.json`
   directly, run `npm run sync:version` afterward.

2. Add a dated entry to `CHANGELOG.md`, then verify:

   ```sh
   npm run release:check
   ```

   This includes the real-browser typography/layout gate; unit tests alone do not
   satisfy release validation. Review the small-phone, landscape, and desktop
   screenshots and computed-style reports in `artifacts/ui/<run>/`. See
   [required UI validation](UI_VALIDATION.md) for coverage and browser setup.

3. Review, commit, and push the source changes. Wait for **Required validation /
   Unit and browser UI checks** to pass for that exact commit before creating an
   annotated `vX.Y.Z` tag matching `package.json`, publishing the GitHub release,
   or deploying Pages. Then push the tag. For the initial release, the tag is
   `v1.0.0`. A missing browser or failing UI check blocks release; do not skip it.

4. Deploy the static app to `rim-gravship-planner/` in the separate
   `mbesh/mbesh.github.io` repository. Include `version.js`, `mods.js`,
   `mod-data.js`, `furniture.js`, `production.js`, `scenario.js`, `systems.js`, `systems-ui.js`, `assets/mods/`, `assets/furniture/`, and `assets/production/` alongside the existing HTML, CSS, JavaScript,
   and assets. A source-repository push alone does not
   update the live site. After the Pages deployment succeeds, verify the header
   version and drawing behavior on the live site. Run `npm run test:ui` again with
   `UI_BASE_URL=https://mikebeshai.com/rim-gravship-planner/` set using the current
   shell and inspect its reports before marking the release complete.
