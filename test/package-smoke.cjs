"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const vm = require("node:vm");
const { pathToFileURL } = require("node:url");
const { JSDOM } = require("jsdom");
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

    const requests = [];
    const server = http.createServer((request, response) => {
        const url = new URL(request.url, "http://localhost");
        requests.push(url.pathname);
        const filename = path.posix.basename(url.pathname);
        const allowed = ["/dict/", "/nested/dict/", "/nested/node_modules/kuromoji/dict/"];
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

    try {
        for (const filename of ["kuroshiro-analyzer-kuromoji.js", "kuroshiro-analyzer-kuromoji.min.js"]) {
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
                const dom = new JSDOM("", { url: `${origin}/nested/page.html`, runScripts: "outside-only" });
                try {
                    dom.window.eval(code);
                    assertConstructor(dom.window.KuromojiAnalyzer);
                    const browserAnalyzer = new dom.window.KuromojiAnalyzer({ dictPath });
                    requests.length = 0;
                    await withTimeout(browserAnalyzer.init());
                    assert.equal(new Set(requests).size, 12);
                    const prefix = dictPath === undefined ? "/nested/node_modules/kuromoji/dict/"
                        : dictPath === "/dict/" ? "/dict/" : "/nested/dict/";
                    assert.ok(requests.every(url => url.startsWith(prefix)));
                    assert.deepEqual(JSON.parse(JSON.stringify(await browserAnalyzer.parse(sentence))), expected);
                    await assert.rejects(browserAnalyzer.init(), /already been initialized/);
                    const missing = new dom.window.KuromojiAnalyzer({ dictPath: "/missing/" });
                    await withTimeout(assert.rejects(missing.init()));
                }
                finally {
                    dom.window.close();
                }
            }
            console.log(`${filename}: exports, ES2015 syntax and real HTTP dictionary loading passed`);
        }
    }
    finally {
        await new Promise(resolve => server.close(resolve));
    }
    console.log("CommonJS, native ESM and browser package smoke tests passed");
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
