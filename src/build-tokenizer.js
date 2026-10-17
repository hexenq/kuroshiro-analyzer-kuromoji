import DictionaryLoader from "kuromoji/src/loader/NodeDictionaryLoader.js";
import Tokenizer from "kuromoji/src/Tokenizer.js";

export default function buildTokenizer(dictPath) {
    return new Promise((resolve, reject) => {
        const loader = new DictionaryLoader(dictPath);
        const loadArrayBuffer = loader.loadArrayBuffer.bind(loader);
        loader.loadArrayBuffer = (url, callback) => {
            loadArrayBuffer(url, (error, buffer) => {
                try {
                    callback(error, buffer);
                }
                catch (cause) {
                    const message = cause instanceof Error ? cause.message : String(cause);
                    const error = new Error(`Failed to assemble dictionary "${dictPath}": ${message}`);
                    error.cause = cause;
                    // The upstream callback has already run. Reject directly;
                    // calling it again with an error would invoke it twice.
                    reject(error);
                }
            });
        };
        loader.load((error, dictionary) => {
            if (error) reject(error);
            else resolve(dictionary);
        });
        // Construct only after successful loading, outside the guarded callbacks.
    }).then(dictionary => new Tokenizer(dictionary));
}
