"use strict";

const DictionaryLoader = require("kuromoji/src/loader/DictionaryLoader.js");
const zlib = require("zlibjs/bin/gunzip.min.js");

// Keep kuromoji's dictionary assembly, but propagate asynchronous XHR/decode errors.
module.exports = class BrowserDictionaryLoader extends DictionaryLoader {
    loadArrayBuffer(url, callback) {
        const xhr = new XMLHttpRequest();
        const fail = (reason, cause) => {
            const error = new Error(`Failed to load dictionary "${url}" (HTTP ${xhr.status}): ${reason}`);
            // Assign explicitly rather than requiring the ES2022 Error constructor.
            if (cause) error.cause = cause;
            callback(error, null);
        };
        xhr.open("GET", url, true);
        xhr.responseType = "arraybuffer";
        xhr.onload = () => {
            if (xhr.status > 0 && xhr.status !== 200) {
                fail(xhr.statusText || "Unexpected HTTP response");
                return;
            }
            const bytes = new Uint8Array(xhr.response);
            if (bytes.length === 0) {
                fail("Empty dictionary response");
                return;
            }
            let buffer;
            try {
                buffer = new zlib.Zlib.Gunzip(bytes).decompress().buffer;
            }
            catch (error) {
                fail(`Gzip decompression failed: ${error.message}`, error);
                return;
            }
            if (buffer.byteLength === 0) {
                fail("Dictionary is empty after decompression");
                return;
            }
            // Keep downstream dictionary callbacks outside the decompression catch.
            callback(null, buffer);
        };
        xhr.onerror = () => fail("Network error");
        xhr.send();
    }
};
