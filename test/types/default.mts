import KuromojiAnalyzer from "kuroshiro-analyzer-kuromoji";

const options: KuromojiAnalyzer.Options = {};
const analyzer = new KuromojiAnalyzer(options);
async function check() {
    await analyzer.init();
    const tokens: KuromojiAnalyzer.Token[] = await analyzer.parse("日本語");
    if (tokens.map(token => token.reading || "").join("") !== "ニホンゴ") {
        throw new Error("Invalid native ESM analyzer");
    }
}
void check();
