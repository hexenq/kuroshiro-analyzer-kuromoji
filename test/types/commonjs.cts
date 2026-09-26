import KuromojiAnalyzer = require("kuroshiro-analyzer-kuromoji");

const defaults = new KuromojiAnalyzer({});
const options: KuromojiAnalyzer.Options = { dictPath: "dict/" };
const custom = new KuromojiAnalyzer(options);
const legacy: KuromojiAnalyzer = new KuromojiAnalyzer.default();

async function check() {
    const initialized: Promise<void> = defaults.init();
    await initialized;
    const tokens: KuromojiAnalyzer.Token[] = await defaults.parse("日本語 xyzabc");
    if (!tokens.length) throw new Error("Expected real dictionary tokens");
    const surface: string = tokens[0].surface_form;
    const reading: string | undefined = tokens[0].reading;
    const position: number = tokens[0].verbose.word_position;
    if (!surface || position < 1) throw new Error("Invalid token");
    const empty: KuromojiAnalyzer.Token[] = await defaults.parse();
    if (empty.length) throw new Error("Expected empty parse");
}
void check();

function invalid(token: KuromojiAnalyzer.Token) {
    // @ts-expect-error dictPath belongs in an options object.
    new KuromojiAnalyzer("dict/");
    // @ts-expect-error Paths must be strings.
    new KuromojiAnalyzer({ dictPath: 42 });
    // @ts-expect-error parse accepts text, not a number.
    defaults.parse(1);
    // @ts-expect-error Parsing remains asynchronous.
    const tokens: KuromojiAnalyzer.Token[] = defaults.parse("日本語");
    // @ts-expect-error Unknown tokens may have no reading.
    const reading: string = token.reading;
    // @ts-expect-error Unknown tokens may have no pronunciation.
    const pronunciation: string = token.pronunciation;
    // @ts-expect-error Metadata is nested under verbose.
    token.word_id;
    // @ts-expect-error Fields are typed, not any.
    const id: string = token.verbose.word_id;
}
