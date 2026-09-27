import { createRequire } from "node:module";
import { defineConfig } from "vite";

const require = createRequire(import.meta.url);
const gunzip = createRequire(require.resolve("kuromoji"))
    .resolve("zlibjs/bin/gunzip.min.js").replace(/\\/g, "/");

export default defineConfig(({ mode }) => ({
    plugins: [{
        name: "zlibjs-commonjs-export",
        enforce: "pre",
        transform(code, id) {
            if (id.replace(/\\/g, "/") !== gunzip) return null;
            // This legacy dependency exports through top-level `this` without
            // an explicit CommonJS marker. Preserve Browserify's exports binding.
            return { code: `${code}\nmodule.exports = this;\n`, map: null };
        }
    }],
    resolve: {
        // The browser dictionary loader needs URL-aware joining, not Node paths.
        alias: {
            path: require.resolve("./scripts/browser-path.js"),
            "./dict-path.js": require.resolve("./src/dict-path.browser.js")
        }
    },
    build: {
        // Keep library output usable beyond Vite's default browser targets.
        target: "es2015",
        license: { fileName: "THIRD_PARTY_LICENSES.md" },
        emptyOutDir: false,
        minify: mode === "minify",
        rolldownOptions: {
            output: { postBanner: "/*! Third-party licenses: see THIRD_PARTY_LICENSES.md */" }
        },
        lib: {
            entry: "scripts/browser-entry.js",
            name: "KuromojiAnalyzer",
            formats: mode === "minify" ? ["umd"] : ["es", "umd"],
            fileName: format => `kuroshiro-analyzer-kuromoji${mode === "minify" ? ".min" : ""}.${format === "es" ? "mjs" : "js"}`
        }
    }
}));
