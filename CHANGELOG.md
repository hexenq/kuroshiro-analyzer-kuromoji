<a name="2.0.0-beta.2"></a>
## [2.0.0-beta.2](https://github.com/hexenq/kuroshiro-analyzer-kuromoji/compare/2.0.0-beta.1...2.0.0-beta.2) (2026-09-28)

### Fixes

* Preserve HTTP(S) and protocol-relative dictionary URLs in browser builds (#10).
* Fix browser imports in bundlers such as Vite and Next.js with a bundled ESM
  entry (#8, #11).

<a name="2.0.0-beta.1"></a>
## [2.0.0-beta.1](https://github.com/hexenq/kuroshiro-analyzer-kuromoji/compare/1.1.0...2.0.0-beta.1) (2026-09-26)

### Breaking Changes

* Require Node.js 22 or later at runtime.
* Require native ES2015 browser support; the standalone bundles no longer use
  ES5-only syntax.

### Features

* Include TypeScript declarations for the constructor, options, parsed tokens,
  and browser global. Adapted from #7 by ALOHACREPES345.

### Fixes

* Resolve the default Node dictionary path from the installed kuromoji package.
* Preserve CommonJS constructor imports, ESM default imports, and standalone
  browser dictionary loading across the updated build.

### Development

* Modernize build tooling and expand package, browser, and TypeScript tests.

<a name="1.1.0"></a>
## [1.1.0](https://github.com/hexenq/kuroshiro-analyzer-kuromoji/compare/1.0.0...1.1.0) (2018-08-05)

### Build

* modify the name of umd file

### Miscellaneous

* Update README.md
