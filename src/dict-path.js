export default function defaultDictPath() {
    return require.resolve("kuromoji").replace(/src(?!.*src).*/, "dict/");
}
