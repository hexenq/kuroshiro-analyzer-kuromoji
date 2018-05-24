/**
 * @jest-environment node
 */

import Analyzer from "../src";

describe("kuroshiro-analyzer-kuromoji Node Test", () => {
    const EXAMPLE_TEXT = "すもももももも";

    let analyzer;

    test("Initialization", async (done) => {
        analyzer = new Analyzer({
            dicPath: "node_modules/kuromoji/dict/"
        });
        await analyzer.init();
        done();
    });

    test("Repeated Initialization", async (done) => {
        analyzer = new Analyzer({
            dicPath: "node_modules/kuromoji/dict/"
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

    test("Kuromoji Build Failed", async (done) => {
        analyzer = new Analyzer({
            dicPath: "node_modules/foo/bar"
        });
        try {
            await analyzer.init();
            done("SHOULD NOT BE HERE");
        }
        catch (err) {
            done();
        }
    });

    test("Parse Sentence", async (done) => {
        analyzer = new Analyzer();
        await analyzer.init();

        const ori = EXAMPLE_TEXT;
        analyzer.parse(ori)
            .then((result) => {
                // console.debug(result);
                expect(result).toBeInstanceOf(Array);
                expect(result).toHaveLength(4);
                done();
            })
            .catch((err) => {
                done(err);
            });
    });

    test("Parse Blank Sentence", async (done) => {
        analyzer = new Analyzer();
        await analyzer.init();

        const ori = "";
        analyzer.parse(ori)
            .then((result) => {
                // console.debug(result);
                expect(result).toBeInstanceOf(Array);
                expect(result).toHaveLength(0);
                done();
            })
            .catch((err) => {
                done(err);
            });
    });
});
