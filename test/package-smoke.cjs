"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");
const { JSDOM, VirtualConsole } = require("jsdom");
const acorn = require("acorn");

const root = path.resolve(__dirname, "..");
const dictionary = path.resolve(path.dirname(require.resolve("kuromoji")), "../dict");
const sentence = "すもももももも。日本語を学ぶ。";

function assertConstructor(Analyzer) {
    assert.equal(typeof Analyzer, "function");
    assert.equal(Analyzer.default, Analyzer);
    assert.equal(new Analyzer()._dictPath, "node_modules/kuromoji/dict/");
}

async function withTimeout(promise, timeoutMs = 30000) {
    let timer;
    try {
        return await Promise.race([
            promise,
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error("Dictionary load timed out")), timeoutMs);
            })
        ]);
    }
    finally {
        clearTimeout(timer);
    }
}

async function main() {
    // A hung operation must fail even when the inner assertion expects rejection.
    await assert.rejects(
        withTimeout(assert.rejects(new Promise(() => {})), 10),
        /Dictionary load timed out/
    );
    const licenses = fs.readFileSync(path.join(root, "dist/THIRD_PARTY_LICENSES.md"), "utf8");
    for (const dependency of ["kuromoji", "zlibjs", "path-browserify", "async", "doublearray"]) {
        assert.ok(licenses.includes(dependency), `Missing license attribution for ${dependency}`);
    }
    // Check the legacy entry before the root wrapper can modify its exports.
    const LegacyAnalyzer = require(path.join(root, "lib/index.js"));
    assert.equal(typeof LegacyAnalyzer, "function");
    assert.equal(LegacyAnalyzer.default, LegacyAnalyzer);
    assert.equal(typeof new LegacyAnalyzer().init, "function");
    assert.equal((await import(pathToFileURL(path.join(root, "lib/index.js")))).default, LegacyAnalyzer);
    const Analyzer = require(root);
    assert.equal(Analyzer, LegacyAnalyzer);
    assert.equal(typeof Analyzer, "function");
    assert.equal(Analyzer.default, Analyzer);
    assert.equal((await import(pathToFileURL(path.join(root, "index.js")))).default, Analyzer);
    const analyzer = new Analyzer();
    await analyzer.init();
    const expected = await analyzer.parse(sentence);
    assert.ok(expected.length > 0);
    assert.ok(expected.every(token => token.verbose && !Object.hasOwn(token, "word_id")));

    for (const file of ["index.js", "lib/index.js", "lib/dict-path.js", "lib/dict-path.browser.js"]) {
        acorn.parse(fs.readFileSync(path.join(root, file), "utf8"), { ecmaVersion: 2015 });
    }

    for (const filename of ["kuroshiro-analyzer-kuromoji.js", "kuroshiro-analyzer-kuromoji.min.js"]) {
        await testBrowserBundle(filename, expected);
    }
    await testBundlerImport(expected);
    console.log("CommonJS, native ESM and browser package smoke tests passed");
}

async function testBundlerImport(expected) {
    const metadata = require("../package.json");
    const entry = path.join(root, metadata.browser);
    acorn.parse(fs.readFileSync(entry, "utf8"), { ecmaVersion: 2015, sourceType: "module" });
    assertConstructor((await import(pathToFileURL(entry))).default);

    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "kuromoji-browser-import-"));
    try {
        // Resolve a bare import from the published files, without consumer aliases
        // or our library's Vite plugins. Build first through npm test.
        const output = execFileSync(process.execPath, [
            process.env.npm_execpath, "pack", "--ignore-scripts", "--json",
            "--pack-destination", temp, "--cache", path.join(temp, "cache")
        ], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
        const packed = JSON.parse(output);
        const result = Array.isArray(packed) ? packed[0] : packed[metadata.name];
        assert.ok(result.files.some(file => file.path === metadata.browser));
        const destination = path.join(temp, "node_modules", metadata.name);
        fs.mkdirSync(destination, { recursive: true });
        execFileSync("tar", ["-xzf", path.join(temp, result.filename), "--strip-components=1", "-C", destination]);
        for (const dependency of Object.keys(metadata.dependencies)) {
            fs.symlinkSync(path.dirname(require.resolve(`${dependency}/package.json`)),
                path.join(temp, "node_modules", dependency), "junction");
        }
        const source = path.join(temp, "entry.js");
        fs.writeFileSync(source, `export { default } from "${metadata.name}";`);
        const { build } = await import("vite");
        const bundle = await build({
            configFile: false, root: temp, publicDir: false, logLevel: "silent",
            build: {
                target: "es2015", write: false, minify: false,
                lib: { entry: source, formats: ["iife"], name: "KuromojiAnalyzer" }
            }
        });
        const outputs = Array.isArray(bundle) ? bundle : [bundle];
        const code = outputs.flatMap(output => output.output).find(file => file.type === "chunk").code;
        acorn.parse(code, { ecmaVersion: 2015 });
        // Exercise the consumer's output with real compressed dictionaries,
        // including cross-origin URLs, CORS rejection and missing files.
        await testAbsoluteDictionaryUrls(`${code}\nwindow.KuromojiAnalyzer = KuromojiAnalyzer;`, expected);
        console.log("Packed browser ESM import: consumer build and real HTTP dictionary loading passed");
    }
    finally {
        fs.rmSync(temp, { recursive: true, force: true });
    }
}

async function createDictionaryServer({ cors = false } = {}) {
    const requests = [];
    const server = http.createServer((request, response) => {
        const url = new URL(request.url, "http://localhost");
        requests.push(url.pathname);
        if (cors && url.pathname !== "/blocked/base.dat.gz") {
            response.setHeader("Access-Control-Allow-Origin", "http://localhost");
        }
        const filename = path.posix.basename(url.pathname);
        const allowed = ["/dict/", "/nested/dict/", "/nested/node_modules/kuromoji/dict/", "/blocked/"];
        if (!allowed.some(prefix => url.pathname === prefix + filename)
            || !/^[a-z_]+\.dat\.gz$/.test(filename)) {
            response.writeHead(404);
            response.end("Not found");
            return;
        }
        // Send raw gzip bytes: kuromoji itself performs decompression.
        const bytes = fs.readFileSync(path.join(dictionary, filename));
        response.writeHead(200, { "Content-Type": "application/octet-stream" });
        response.end(bytes);
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    return { server, origin, requests };
}

async function testBrowserBundle(filename, expected) {
    const code = fs.readFileSync(path.join(root, "dist", filename), "utf8");
    acorn.parse(code, { ecmaVersion: 2015 });

    const commonjs = { module: { exports: {} }, exports: {} };
    vm.runInNewContext(code, commonjs);
    assertConstructor(commonjs.module.exports);
    let amd;
    const define = (dependencies, factory) => {
        assert.equal(dependencies.length, 0);
        amd = factory();
    };
    define.amd = {};
    vm.runInNewContext(code, { define });
    assertConstructor(amd);
    for (const context of [{}, { self: {} }, { globalThis: undefined, self: {} }]) {
        vm.runInNewContext(code, context);
        assertConstructor(context.KuromojiAnalyzer || context.self.KuromojiAnalyzer);
    }

    for (const dictPath of [undefined, "/dict/", "dict/"]) {
        // A failed parallel load may still have requests in flight after rejection.
        // Give every case its own server and log so late requests cannot cross cases.
        const { server, origin, requests } = await createDictionaryServer();
        let dom;
        try {
            dom = new JSDOM("", { url: `${origin}/nested/page.html`, runScripts: "outside-only" });
            dom.window.eval(code);
            assertConstructor(dom.window.KuromojiAnalyzer);
            const browserAnalyzer = new dom.window.KuromojiAnalyzer({ dictPath });
            await withTimeout(browserAnalyzer.init());
            assert.ok(requests.length > 0, "Expected real HTTP dictionary requests");
            const prefix = dictPath === undefined ? "/nested/node_modules/kuromoji/dict/"
                : dictPath === "/dict/" ? "/dict/" : "/nested/dict/";
            assert.ok(requests.every(url => url.startsWith(prefix)));
            assert.deepEqual(JSON.parse(JSON.stringify(await browserAnalyzer.parse(sentence))), expected);
            await assert.rejects(browserAnalyzer.init(), /already been initialized/);
            const missing = new dom.window.KuromojiAnalyzer({ dictPath: "/missing/" });
            await withTimeout(assert.rejects(missing.init()));
        }
        finally {
            if (dom) dom.window.close();
            await new Promise(resolve => server.close(resolve));
        }
    }
    await testAbsoluteDictionaryUrls(code, expected);
    console.log(`${filename}: exports, ES2015 syntax and real HTTP dictionary loading passed`);
}

async function testAbsoluteDictionaryUrls(code, expected) {
    for (const kind of ["same-origin", "cross-origin", "protocol-relative"]) {
        const crossOrigin = kind !== "same-origin";
        for (const suffix of ["", "/"]) {
            const { server, origin, requests } = await createDictionaryServer({ cors: crossOrigin });
            let dom;
            try {
                const pageOrigin = crossOrigin ? "http://localhost" : origin;
                const errors = [];
                const virtualConsole = new VirtualConsole();
                virtualConsole.on("jsdomError", error => errors.push(error));
                dom = new JSDOM("", { url: `${pageOrigin}/nested/page.html`, runScripts: "outside-only", virtualConsole });
                dom.window.eval(code);
                const base = kind === "protocol-relative" ? origin.replace(/^http:/, "") : origin;
                const analyzer = new dom.window.KuromojiAnalyzer({ dictPath: `${base}/nested/dict${suffix}` });
                await withTimeout(analyzer.init());
                assert.ok(requests.length > 0, `Expected dictionary requests for ${kind}`);
                assert.ok(requests.every(url => url.startsWith("/nested/dict/")), `Wrong URL for ${kind}`);
                assert.deepEqual(JSON.parse(JSON.stringify(await analyzer.parse(sentence))), expected);
                assert.deepEqual(errors, []);

                const missing = new dom.window.KuromojiAnalyzer({ dictPath: `${base}/missing/` });
                await withTimeout(assert.rejects(missing.init()));
                if (crossOrigin) {
                    // This endpoint serves dictionary bytes without allowing this origin.
                    const blocked = new dom.window.KuromojiAnalyzer({ dictPath: `${base}/blocked/` });
                    await withTimeout(assert.rejects(blocked.init()));
                    assert.ok(requests.includes("/blocked/base.dat.gz"));
                }
            }
            finally {
                if (dom) dom.window.close();
                await new Promise(resolve => server.close(resolve));
            }
        }
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
