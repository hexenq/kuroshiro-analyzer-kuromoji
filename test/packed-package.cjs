"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

module.exports = function installPackedPackage(root, temp) {
    assert.ok(process.env.npm_execpath, "Run package checks through npm");
    const metadata = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    // Build first via npm test; do not recurse into prepack or install from the network.
    const output = execFileSync(process.execPath, [
        process.env.npm_execpath, "pack", "--ignore-scripts", "--json",
        "--pack-destination", temp, "--cache", path.join(temp, "cache")
    ], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    const result = JSON.parse(output);
    // npm 12 keys results by name; earlier npm versions return an array.
    const packed = Array.isArray(result) ? result[0] : result[metadata.name];
    const destination = path.join(temp, "node_modules", metadata.name);
    fs.mkdirSync(destination, { recursive: true });
    execFileSync("tar", ["-xzf", path.join(temp, packed.filename), "--strip-components=1", "-C", destination],
        { stdio: ["ignore", "pipe", "pipe"] });
    // Reuse installed runtime dependencies; our own code and types come from the tarball.
    for (const dependency of Object.keys(metadata.dependencies)) {
        const link = path.join(temp, "node_modules", dependency);
        fs.mkdirSync(path.dirname(link), { recursive: true });
        const manifest = require.resolve(`${dependency}/package.json`, { paths: [root] });
        fs.symlinkSync(path.dirname(manifest), link, "junction");
    }
    return metadata;
};
