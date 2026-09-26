## 2.0.0-beta.1 (Unreleased)

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
