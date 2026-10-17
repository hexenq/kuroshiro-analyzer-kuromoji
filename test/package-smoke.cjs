"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { gzipSync, gunzipSync } = require("node:zlib");
const { pathToFileURL } = require("node:url");
const { JSDOM, VirtualConsole } = require("jsdom");
const acorn = require("acorn");
const installPackedPackage = require("./packed-package.cjs");

const root = path.resolve(__dirname, "..");
const dictionary = path.resolve(path.dirname(require.resolve("kuromoji")), "../dict");
const sentence = "すもももももも。日本語を学ぶ。";
const invalidDictionaryFiles = [
    ["base.dat.gz"],
    ["cc.dat.gz"],
    ["unk_compat.dat.gz"],
    ["base.dat.gz", "cc.dat.gz"]
];

function assertAssemblyError(error, directory, ErrorType, RangeErrorType) {
    assert.ok(error instanceof ErrorType);
    assert.ok(error.message.includes(directory));
    assert.match(error.message, /assemble dictionary/i);
    assert.ok(error.cause instanceof RangeErrorType);
}

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
    await testNodeDictionaryAssembly(Analyzer);

    for (const file of ["index.js", "lib/index.js", "lib/build-tokenizer.js", "lib/dict-path.js", "lib/dict-path.browser.js"]) {
        acorn.parse(fs.readFileSync(path.join(root, file), "utf8"), { ecmaVersion: 2015 });
    }

    for (const filename of ["kuroshiro-analyzer-kuromoji.js", "kuroshiro-analyzer-kuromoji.min.js"]) {
        await testBrowserBundle(filename, expected);
    }
    await testBundlerImport(expected);
    console.log("CommonJS, native ESM and browser package smoke tests passed");
}

async function testBundlerImport(expected) {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "kuromoji-browser-import-"));
    try {
        const metadata = installPackedPackage(root, temp);
        const entry = path.join(temp, "node_modules", metadata.name, metadata.browser);
        acorn.parse(fs.readFileSync(entry, "utf8"), { ecmaVersion: 2015, sourceType: "module" });
        assertConstructor((await import(pathToFileURL(entry))).default);

        // Use a normal consumer import, without our library's Vite plugins or aliases.
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
        const browserCode = `${code}\nwindow.KuromojiAnalyzer = KuromojiAnalyzer;`;
        // UMD tests cover the URL matrix; this case checks the consumer entry,
        // decompression, token output, missing files and CORS rejection together.
        await testAbsoluteDictionaryUrl(browserCode, expected, "cross-origin", "");
        await testDictionaryErrors(browserCode);
        await testDictionaryAssembly(browserCode);
        console.log("Packed browser ESM import: consumer build and real HTTP dictionary loading passed");
    }
    finally {
        fs.rmSync(temp, { recursive: true, force: true });
    }
}

async function createDictionaryServer({ cors = false, payload = "gzip", invalidFiles = [] } = {}) {
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
        // Normally send raw gzip bytes: kuromoji itself performs decompression.
        let bytes = fs.readFileSync(path.join(dictionary, filename));
        if (filename === "base.dat.gz") {
            if (payload === "empty-response") bytes = Buffer.alloc(0);
            if (payload === "empty-dictionary") bytes = gzipSync(Buffer.alloc(0));
        }
        if (payload === "html") bytes = Buffer.from("<!doctype html><title>Application fallback</title>");
        if (payload === "truncated") bytes = bytes.subarray(0, 64);
        if (payload === "decoded") bytes = gunzipSync(bytes);
        if (payload === "double-gzip") bytes = gzipSync(bytes);
        if (invalidFiles.includes(filename)) bytes = gzipSync(Buffer.from([1]));
        if (payload === "http-gzip" || payload === "double-gzip") {
            response.setHeader("Content-Encoding", "gzip");
        }
        response.writeHead(200, { "Content-Type": "application/octet-stream" });
        response.end(bytes);
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    return { server, origin, requests, repair: () => { invalidFiles = []; } };
}

async function testBrowserBundle(filename, expected) {
    const code = fs.readFileSync(path.join(root, "dist", filename), "utf8");
    acorn.parse(code, { ecmaVersion: 2015 });
    await testDictionaryErrors(code);
    await testDictionaryAssembly(code);

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
    for (const kind of ["same-origin", "cross-origin", "protocol-relative"]) {
        for (const suffix of ["", "/"]) {
            await testAbsoluteDictionaryUrl(code, expected, kind, suffix);
        }
    }
    console.log(`${filename}: exports, ES2015 syntax and real HTTP dictionary loading passed`);
}

async function testAbsoluteDictionaryUrl(code, expected, kind, suffix) {
    const crossOrigin = kind !== "same-origin";
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
        await withTimeout(assert.rejects(missing.init(), error => {
            assert.ok(error instanceof dom.window.Error);
            assert.ok(error.message.includes(`${base}/missing/`));
            assert.match(error.message, /HTTP 404/);
            return true;
        }));
        if (crossOrigin) {
            // This endpoint serves dictionary bytes without allowing this origin.
            const blocked = new dom.window.KuromojiAnalyzer({ dictPath: `${base}/blocked/` });
            await withTimeout(assert.rejects(blocked.init(), error => {
                assert.ok(error instanceof dom.window.Error);
                assert.ok(error.message.includes(`${base}/blocked/`));
                assert.match(error.message, /network error/i);
                return true;
            }));
            assert.ok(requests.includes("/blocked/base.dat.gz"));
        }
    }
    finally {
        if (dom) dom.window.close();
        await new Promise(resolve => server.close(resolve));
    }
}

async function testDictionaryErrors(code) {
    for (const payload of ["empty-response", "empty-dictionary", "html", "truncated", "decoded", "http-gzip", "double-gzip"]) {
        const { server, origin } = await createDictionaryServer({ payload });
        const errors = [];
        const virtualConsole = new VirtualConsole();
        virtualConsole.on("jsdomError", error => errors.push(error));
        const dom = new JSDOM("", { url: origin, runScripts: "outside-only", virtualConsole });
        try {
            dom.window.eval(code);
            const analyzer = new dom.window.KuromojiAnalyzer({ dictPath: `${origin}/dict/` });
            if (payload === "double-gzip") {
                // HTTP decoding removes only the extra outer layer; valid gzip remains.
                await withTimeout(analyzer.init());
                assert.equal((await analyzer.parse("日本語"))[0].reading, "ニホンゴ");
            }
            else {
                // Keep the timeout outside assert.rejects: a hung init is not a rejection.
                await withTimeout(assert.rejects(analyzer.init(), error => {
                    assert.ok(error instanceof dom.window.Error, payload);
                    assert.ok(error.message.includes(`${origin}/dict/`), payload);
                    assert.match(error.message, /HTTP 200/);
                    if (payload === "empty-response" || payload === "empty-dictionary") {
                        assert.ok(error.message.includes("/dict/base.dat.gz"));
                        assert.match(error.message, payload === "empty-response"
                            ? /empty dictionary response/i : /dictionary is empty after decompression/i);
                    }
                    else {
                        assert.match(error.message, /decompress/i);
                        assert.ok(error.cause instanceof dom.window.Error, payload);
                    }
                    return true;
                }));
            }
            assert.deepEqual(errors, [], `Uncaught browser errors for ${payload}`);
        }
        finally {
            dom.window.close();
            await new Promise(resolve => server.close(resolve));
        }
    }
}

async function testNodeDictionaryAssembly(Analyzer) {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "kuromoji-invalid-dictionary-"));
    try {
        fs.cpSync(dictionary, temp, { recursive: true });
        for (const files of invalidDictionaryFiles) {
            for (const file of files) fs.writeFileSync(path.join(temp, file), gzipSync(Buffer.from([1])));
            const analyzer = new Analyzer({ dictPath: temp });
            await withTimeout(assert.rejects(analyzer.init(), error => {
                assertAssemblyError(error, temp, Error, RangeError);
                return true;
            }));
            for (const file of files) fs.copyFileSync(path.join(dictionary, file), path.join(temp, file));
            await withTimeout(analyzer.init());
            assert.equal((await analyzer.parse("日本語"))[0].reading, "ニホンゴ");
        }
    }
    finally {
        fs.rmSync(temp, { recursive: true, force: true });
    }
}

async function testDictionaryAssembly(code) {
    for (const invalidFiles of invalidDictionaryFiles) {
        const { server, origin, repair } = await createDictionaryServer({ invalidFiles });
        const errors = [];
        const virtualConsole = new VirtualConsole();
        virtualConsole.on("jsdomError", error => errors.push(error));
        const dom = new JSDOM("", { url: origin, runScripts: "outside-only", virtualConsole });
        try {
            dom.window.eval(code);
            const directory = `${origin}/dict/`;
            const analyzer = new dom.window.KuromojiAnalyzer({ dictPath: directory });
            await withTimeout(assert.rejects(analyzer.init(), error => {
                assertAssemblyError(error, directory, dom.window.Error, dom.window.RangeError);
                return true;
            }));
            repair();
            await withTimeout(analyzer.init());
            assert.equal((await analyzer.parse("日本語"))[0].reading, "ニホンゴ");
            assert.deepEqual(errors, [], `Uncaught browser errors for ${invalidFiles.join(", ")}`);
        }
        finally {
            dom.window.close();
            await new Promise(resolve => server.close(resolve));
        }
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
