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
        <td>✓ (>=6)</td>
    </tr>
    <tr>
        <td>Browser</td>
        <td>✓</td>
    </tr>
</table>

## Install
```sh
$ npm install kuroshiro-analyzer-kuromoji
```
For a standalone browser setup, include `dist/kuroshiro-analyzer-kuromoji.min.js` in your page. It exports the global constructor `KuromojiAnalyzer` and includes the tokenizer, but not its dictionary files.

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

When redistributing dictionary files, include kuromoji's `NOTICE.md` alongside them. Keep the generated `dist/THIRD_PARTY_LICENSES.md` with the standalone bundles as well.

- `/dict/` is relative to the origin root. For a site deployed under `/my-app/`, use `/my-app/dict/` if that is where you serve the files.
- `dict/` is relative to the current page URL. The browser default, `node_modules/kuromoji/dict/`, only works when your server actually exposes that directory.
- Serve the files as gzip data. The tokenizer decompresses them itself; do not send `Content-Encoding: gzip` for the stored `.gz` payload unless you intentionally add a separate HTTP compression layer.
- Check that dictionary requests return the actual files, not a 404 page or an HTML application fallback. Absolute cross-origin URLs are not covered by this setup: the upstream loader uses filesystem-style path joining, which can alter URL schemes.

The standalone UMD bundles include the browser compatibility code needed by kuromoji. Applications importing the npm source entry through another bundler may need their own Node-module compatibility configuration; this package's Vite build configuration does not configure the consuming application.

## Development

Use Node.js 22.13+ on the 22.x line or Node.js 24+ for development. This requirement applies to the tooling, not to the library's runtime compatibility.

```sh
npm ci
npm test
npm pack --dry-run
```

Use `npm install <package>` or `npm uninstall <package>` when changing dependencies, and include `package-lock.json` in the change. Builds generate CommonJS files in `lib/` and standalone UMD bundles in `dist/`; `npm pack` rebuilds them automatically.

The test suite covers the analyzer API, package exports, ES2015 output syntax, and real dictionary loading over HTTP in a jsdom browser environment. CI runs on Node.js 22 and 24. Legacy Node.js runtime claims should also be checked on the actual runtime before release; syntax checks alone do not prove runtime compatibility.

Keep development changes backward-compatible and leave version updates to the release process. Write commit messages in English using Conventional Commits, for example `build: modernize development tooling`.
