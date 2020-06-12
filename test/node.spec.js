/**
 * @jest-environment node
 */

import Analyzer from "../src";

describe("kuroshiro-analyzer-kuromoji Node Test", () => {
    const EXAMPLE_TEXT = "すもももももも";

    let analyzer;

    it("Initialization", async (done) => {
        analyzer = new Analyzer({
            dictPath: "node_modules/kuromoji/dict/"
        });
        await analyzer.init();
        done();
    });

    it("Repeated Initialization", async (done) => {
        analyzer = new Analyzer({
            dictPath: "node_modules/kuromoji/dict/"
        });
        try {
            await analyzer.init();
            await analyzer.init();
            done("SHOULD NOT BE HERE");
        }
        catch (err) {
            done();
        }
    });

    it("Kuromoji Build Failed", async (done) => {
        analyzer = new Analyzer({
            dictPath: "node_modules/foo/bar"
        });
        try {
            await analyzer.init();
            done("SHOULD NOT BE HERE");
        }
        catch (err) {
            done();
        }
    });

    it("Parse Attempt Before Initialization", async () => {
        analyzer = new Analyzer();
        analyzer.init();

        const ori = EXAMPLE_TEXT;
        expect(() => {
            analyzer.parseSync(ori);
        }).toThrowError("Analyzer has not been initialized yet. Use Analyzer.init() before parsing.");
    });

    it("Parse Sentence Sync", async () => {
        analyzer = new Analyzer();
        await analyzer.init();

        const ori = EXAMPLE_TEXT;
        const result = analyzer.parseSync(ori);
        expect(result).toBeInstanceOf(Array);
        expect(result).toHaveLength(4);
    });

    it("Parse Sentence Async", async () => {
        analyzer = new Analyzer();
        await analyzer.init();

        const ori = EXAMPLE_TEXT;
        const result = await analyzer.parse(ori);
        expect(result).toBeInstanceOf(Array);
        expect(result).toHaveLength(4);
    });

    it("Parse Empty", async () => {
        analyzer = new Analyzer();
        await analyzer.init();

        const oriSync = analyzer.parseSync();
        expect(oriSync).toBeInstanceOf(Array);
        expect(oriSync).toHaveLength(0);

        const oriAsync = await analyzer.parse();
        expect(oriAsync).toBeInstanceOf(Array);
        expect(oriAsync).toHaveLength(0);
    });

    it("Parse Null", async () => {
        analyzer = new Analyzer();
        await analyzer.init();

        const result = analyzer.parseSync();
        expect(result).toBeInstanceOf(Array);
        expect(result).toHaveLength(0);
    });

    it("Parse Blank Sentence", async () => {
        analyzer = new Analyzer();
        await analyzer.init();

        const ori = "";
        const result = analyzer.parseSync(ori);
        expect(result).toBeInstanceOf(Array);
        expect(result).toHaveLength(0);
    });
});
