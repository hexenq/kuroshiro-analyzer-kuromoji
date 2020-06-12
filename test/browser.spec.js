/**
 * @jest-environment jsdom
 */

import Analyzer from "../src";

describe("kuroshiro-analyzer-kuromoji Browser Test", () => {
    const EXAMPLE_TEXT = "すもももももも";

    let analyzer;

    beforeAll(async () => {
        analyzer = new Analyzer();
        await analyzer.init();
    });
    it("Parse Sentence", () => {
        const ori = EXAMPLE_TEXT;
        const result = analyzer.parseSync(ori);
        expect(result).toBeInstanceOf(Array);
        expect(result).toHaveLength(4);
    });
});
