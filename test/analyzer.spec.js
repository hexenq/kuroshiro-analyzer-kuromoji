import path from "node:path";
import kuromoji from "kuromoji";
import Analyzer from "../src/index.js";
import browserDictPath from "../src/dict-path.browser.js";

describe("Kuromoji analyzer", () => {
    const analyzer = new Analyzer();

    beforeAll(async () => {
        await analyzer.init();
    }, 30000);

    it("resolves the installed dictionary by default", () => {
        expect(path.resolve(analyzer._dictPath)).toBe(path.resolve(
            path.dirname(require.resolve("kuromoji")), "../dict"
        ));
    });

    it("preserves the browser's relative default dictionary path", () => {
        expect(browserDictPath()).toBe("node_modules/kuromoji/dict/");
    });

    it("initializes with an explicit dictionary path", async () => {
        const custom = new Analyzer({ dictPath: "node_modules/kuromoji/dict/" });
        await expect(custom.init()).resolves.toBeUndefined();
        expect(await custom.parse("すもももももも")).toHaveLength(4);
    });

    it("rejects repeated initialization", async () => {
        await expect(analyzer.init()).rejects.toThrow("already been initialized");
    });

    it("rejects a missing dictionary", async () => {
        const missing = new Analyzer({ dictPath: "node_modules/missing-dictionary" });
        await expect(missing.init()).rejects.toBeDefined();
    });

    it("can retry after a failed initialization", async () => {
        const retry = new Analyzer();
        const build = jest.spyOn(kuromoji, "builder").mockReturnValueOnce({
            build: callback => callback(new Error("temporary failure"))
        });
        try {
            await expect(retry.init()).rejects.toThrow("temporary failure");
        }
        finally {
            build.mockRestore();
        }
        await retry.init();
        expect(await retry.parse("日本語")).toHaveLength(1);
    });

    it("preserves linguistic fields and nests tokenizer metadata in verbose", async () => {
        const result = await analyzer.parse("日本語");
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            surface_form: "日本語",
            pos: "名詞",
            basic_form: "日本語",
            reading: "ニホンゴ",
            pronunciation: "ニホンゴ",
            verbose: {
                word_id: expect.any(Number),
                word_type: "KNOWN",
                word_position: 1
            }
        });
        for (const field of ["word_id", "word_type", "word_position"]) {
            expect(result[0]).not.toHaveProperty(field);
        }
    });

    it("parses repeated particles into four tokens", async () => {
        expect(await analyzer.parse("すもももももも")).toHaveLength(4);
    });

    it.each([undefined, "", " \t\n"])("returns no tokens for %p", async (input) => {
        await expect(analyzer.parse(input)).resolves.toEqual([]);
    });

    it("rejects parsing non-empty text before initialization asynchronously", async () => {
        await expect(new Analyzer().parse("日本語")).rejects.toBeInstanceOf(Error);
    });

    it("rejects invalid input asynchronously", async () => {
        await expect(analyzer.parse(null)).rejects.toBeInstanceOf(TypeError);
    });
});
