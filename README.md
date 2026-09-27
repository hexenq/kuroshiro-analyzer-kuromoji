# kuroshiro-analyzer-kuromoji
 
[![CI](https://github.com/hexenq/kuroshiro-analyzer-kuromoji/actions/workflows/ci.yml/badge.svg)](https://github.com/hexenq/kuroshiro-analyzer-kuromoji/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/kuroshiro-analyzer-kuromoji.svg)](http://badge.fury.io/js/kuroshiro-analyzer-kuromoji)

<table>
    <tr>
        <td>Package</td>
        <td colspan=2>kuroshiro-analyzer-kuromoji</td>
    </tr>
    <tr>
        <td>Description</td>
        <td colspan=2>Kuromoji morphological analyzer for <a href="https://github.com/hexenq/kuroshiro">kuroshiro</a>.</td>
    </tr>
    <tr>
        <td rowspan=2>Compatibility</td>
        <td>Node</td>
        <td>22 or later</td>
    </tr>
    <tr>
        <td>Browser</td>
        <td>Native ES2015 support (no Internet Explorer)</td>
    </tr>
</table>

## Install

```sh
$ npm install kuroshiro-analyzer-kuromoji@beta
```
The stable 1.x release remains available without the `@beta` tag.

For a standalone browser setup, include `dist/kuroshiro-analyzer-kuromoji.min.js` in your page. It exports the global constructor `KuromojiAnalyzer` and includes the tokenizer, but not its dictionary files.

### Migrating from 1.x

Version 2 requires Node.js 22+ or a browser with native ES2015 support, including
Promises and typed arrays. Browser dictionary loading requires XMLHttpRequest
with ArrayBuffer responses. Internet Explorer is not supported.

CommonJS constructor imports, ESM default imports, the `KuromojiAnalyzer` browser
global, and the asynchronous `init()` / `parse()` API remain available. The
analyzer can be used with kuroshiro 1.x, with the same runtime requirements listed
above.

## Usage with kuroshiro
### Configure analyzer
This analyzer utilizes [kuromoji.js](https://github.com/takuyaa/kuromoji.js). 

You could specify the path of your dictionary files with `dictPath` param. 

```js
import KuromojiAnalyzer from "kuroshiro-analyzer-kuromoji";

const analyzer = new KuromojiAnalyzer();

await kuroshiro.init(analyzer);
```

CommonJS is also supported:

```js
const KuromojiAnalyzer = require("kuroshiro-analyzer-kuromoji");
```

### TypeScript

The 2.0 prerelease includes package-entry declarations for the constructor,
options, and parsed tokens. Published 1.x releases do not include these declarations.

```ts
import KuromojiAnalyzer from "kuroshiro-analyzer-kuromoji";

const options: KuromojiAnalyzer.Options = {};
const analyzer = new KuromojiAnalyzer(options);
await analyzer.init();
const tokens: KuromojiAnalyzer.Token[] = await analyzer.parse("日本語");
const readings = tokens.map(token => token.reading ?? token.surface_form);
```

Unknown words may have no `reading` or `pronunciation`. Tokenizer metadata such as
`word_id` is available under `token.verbose`, not on the token itself.

For TypeScript compiled to CommonJS, use a default import with interop enabled
(the default in TypeScript 7), or use
`import KuromojiAnalyzer = require("kuroshiro-analyzer-kuromoji")`.
Native Node ESM and bundler module resolution also support the default import.
Non-module browser scripts can reference `kuroshiro-analyzer-kuromoji` types for
the `KuromojiAnalyzer` global; load the actual UMD script separately.

### Initialization Parameters
__Example:__
```js
const analyzer = new KuromojiAnalyzer({
    dictPath: "/dict/"
});
```
- `dictPath`: *Optional* Path of the dictionary files. In Node.js, the default resolves the installed `kuromoji/dict` directory independently of the working directory. An explicit relative filesystem path is resolved from the working directory.

### Browser dictionary setup

Copy all 12 `.dat.gz` files from `node_modules/kuromoji/dict/` into a public directory served by your application, such as `public/dict/`, then pass its URL path as `dictPath`:

```js
const analyzer = new KuromojiAnalyzer({ dictPath: "/dict/" });
await kuroshiro.init(analyzer);
```

When redistributing dictionary files, include kuromoji's `NOTICE.md` alongside them. Keep the generated `dist/THIRD_PARTY_LICENSES.md` with the browser bundles as well.

- `/dict/` is relative to the origin root. For a site deployed under `/my-app/`, use `/my-app/dict/` if that is where you serve the files.
- `dict/` is relative to the current page URL. The browser default, `node_modules/kuromoji/dict/`, only works when your server actually exposes that directory.
- Serve the files as gzip data. The tokenizer decompresses them itself; do not send `Content-Encoding: gzip` for the stored `.gz` payload unless you intentionally add a separate HTTP compression layer.
- Check that dictionary requests return the actual files, not a 404 page or an HTML application fallback.
- The browser analyzer also accepts an absolute HTTP(S) dictionary URL, such as `dictPath: "https://cdn.example.com/dict/"`, with or without a trailing slash. For cross-origin hosting, the dictionary server must allow your page's origin through CORS (`Access-Control-Allow-Origin`). An HTTPS page needs an HTTPS dictionary URL. Use the `dictPath` option, not `dict`.

Browser bundlers use a prebuilt ESM entry that includes kuromoji's browser compatibility code. Import `kuroshiro-analyzer-kuromoji` normally; no Node-module polyfills or custom bundler aliases are needed. Dictionary files must still be served by your application as described above. In Next.js, initialize and use the browser analyzer in client-side code, such as an event handler or effect.

## Development

Use Node.js 22.22.2+ on the 22.x line, 24.15.0+ on the 24.x line, or 26+ for
development. These stricter requirements come from the development tools; the
published library's runtime requirement is Node.js 22+.

```sh
npm ci
npm test
npm pack --dry-run
```

Use `npm install <package>` or `npm uninstall <package>` when changing dependencies, and include `package-lock.json` in the change. Builds generate CommonJS files in `lib/`, and browser ESM and standalone UMD bundles in `dist/`; `npm pack` rebuilds them automatically.

The test suite covers the analyzer API, package exports, ES2015 output syntax,
and real dictionary loading over HTTP in a jsdom browser environment, including
a Vite consumer of the packed package. CI runs on
Node.js 22.22.2, 24.15.0, and 26. Browser builds explicitly target ES2015 instead
of following Vite's default browser targets. Syntax checks and jsdom tests do not
replace testing in actual browsers.

`npm test` also checks the declarations from the packed package using TypeScript
7.0.2 in CommonJS, native Node ESM, bundler, and browser-global consumers. It
rejects invalid options and unsafe access to optional readings, and runs compiled
Node consumers against the real dictionary. TypeScript is a development dependency.
The root `tsconfig.json` also provides editor checking without emitting files;
`npm run test:types` verifies it before checking the packed consumers. No sibling
repository or editor-specific settings are needed.

Keep development changes backward-compatible and leave version updates to the release process. Write commit messages in English using Conventional Commits, for example `build: modernize development tooling`.
