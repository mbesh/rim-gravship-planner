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
   npm run check:version
   npm test
   ```

3. Review and commit the release changes, create an annotated `vX.Y.Z` tag
   matching `package.json`, then push the commit and tag to the source repository.
   For the initial release, the tag is `v1.0.0`.

4. Deploy the static app to `rim-gravship-planner/` in the separate
   `mbesh/mbesh.github.io` repository. Include `version.js`, `mods.js`,
   `mod-data.js`, `scenario.js`, `systems.js`, `systems-ui.js`, and `assets/mods/` alongside the existing HTML, CSS, JavaScript,
   and assets. A source-repository push alone does not
   update the live site. After the Pages deployment succeeds, verify the header
   version and drawing behavior on the live site.
