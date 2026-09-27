"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const installPackedPackage = require("./packed-package.cjs");

const root = path.resolve(__dirname, "..");
const compiler = path.join(path.dirname(require.resolve("typescript/package.json")), "bin/tsc");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "kuroshiro-types-"));

function run(command, args) {
    return execFileSync(command, args, { cwd: temp, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function compile(label, options, files, execute = false) {
    const outDir = path.join(temp, label);
    const config = path.join(temp, label + ".json");
    fs.writeFileSync(config, JSON.stringify({
        compilerOptions: {
            strict: true, skipLibCheck: false, types: [], target: "ES2015",
            lib: ["ES2015"], moduleDetection: "legacy", noEmit: !execute, outDir, ...options
        },
        files
    }));
    run(process.execPath, [compiler, "--project", config]);
    if (execute) {
        for (const file of files) {
            const emitted = path.basename(file).replace(/\.cts$/, ".cjs").replace(/\.mts$/, ".mjs");
            run(process.execPath, [path.join(outDir, emitted)]);
        }
    }
    console.log("Packed types passed: " + label);
}

try {
    const metadata = installPackedPackage(root, temp);
    assert.ok(fs.existsSync(path.join(temp, "node_modules", metadata.name, metadata.types)), "Declaration must be published");
    const fixtureRoot = path.join(root, "test/types");
    for (const file of fs.readdirSync(fixtureRoot)) {
        fs.copyFileSync(path.join(fixtureRoot, file), path.join(temp, file));
    }
    const modules = ["commonjs.cts", "default.mts", "interop.cts"];
    compile("node16", { module: "Node16", moduleResolution: "Node16" }, modules);
    compile("nodenext", { module: "NodeNext", moduleResolution: "NodeNext" }, modules, true);
    compile("bundler", { module: "ESNext", moduleResolution: "Bundler", verbatimModuleSyntax: true }, ["default.mts"]);
    compile("browser-global", { module: "Node16", moduleResolution: "Node16", types: ["kuroshiro-analyzer-kuromoji"] }, ["browser.ts"]);

}
catch (error) {
    console.error(error.stdout || error.stderr || error);
    process.exitCode = 1;
}
finally {
    fs.rmSync(temp, { recursive: true, force: true });
}
