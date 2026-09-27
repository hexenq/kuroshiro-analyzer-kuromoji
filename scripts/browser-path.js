import path from "path-browserify";

// Kuromoji's browser loader uses path.join(directory, filename). Filesystem
// normalization loses the second slash of a URL's scheme or authority.
export function join(directory, filename) {
    if (!/^(https?:)?\/\//i.test(directory)) return path.join(directory, filename);

    const protocolRelative = directory.startsWith("//");
    const base = new URL(protocolRelative ? `https:${directory}` : directory);
    if (!base.pathname.endsWith("/")) base.pathname += "/";
    const url = new URL(filename, base);
    return protocolRelative ? url.href.slice(url.protocol.length) : url.href;
}

export default { join };
