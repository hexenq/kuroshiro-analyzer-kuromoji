# Repository Guidance

## Compatibility

- Preserve the asynchronous `init()` and `parse()` API and token output format.
- Preserve CommonJS constructor imports, ESM default imports, and the standalone
  browser global `KuromojiAnalyzer`.
- Keep Node.js runtime compatibility separate from development-tool requirements.
- Do not change the package version until preparing a release.

## Development

- Use `npm ci` for an unchanged lockfile. Use `npm install` or `npm uninstall`
  when intentionally changing dependencies, and commit the updated lockfile.
- Run `npm test` and `npm pack --dry-run` before submitting changes.
- Edit `src/` and build configuration, not generated files in `lib/` or `dist/`.
- Test browser bundles with real dictionary loading, not only mocked tokenizers.
- Write commit messages in English using Conventional Commits.
