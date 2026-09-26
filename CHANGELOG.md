<a name="1.2.0"></a>
## [1.2.0](https://github.com/hexenq/kuroshiro-analyzer-kuromoji/compare/1.1.0...1.2.0)

### Features

* Include TypeScript declarations for the constructor, options, parsed tokens,
  and browser global. Adapted from #7 by ALOHACREPES345.

### Fixes

* Resolve the default Node dictionary path from the installed kuromoji package.
* Preserve CommonJS constructor imports, ESM default imports, and standalone
  browser dictionary loading across the updated build.

### Development

* Modernize build tooling and add package, browser, and TypeScript consumer checks.
* Include a shared TypeScript configuration for contributors; CI runs on Node 22/24.

<a name="1.1.0"></a>
## [1.1.0](https://github.com/hexenq/kuroshiro-analyzer-kuromoji/compare/1.0.0...1.1.0) (2018-08-05)

### Build

* modify the name of umd file

### Miscellaneous

* Update README.md
