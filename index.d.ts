export = KuromojiAnalyzer;
export as namespace KuromojiAnalyzer;

declare class KuromojiAnalyzer {
    static readonly default: typeof KuromojiAnalyzer;

    constructor(options?: KuromojiAnalyzer.Options);
    init(): Promise<void>;
    parse(str?: string): Promise<KuromojiAnalyzer.Token[]>;
}

declare namespace KuromojiAnalyzer {
    interface Options {
        dictPath?: string;
    }

    interface Token {
        surface_form: string;
        pos: string;
        pos_detail_1: string;
        pos_detail_2: string;
        pos_detail_3: string;
        conjugated_type: string;
        conjugated_form: string;
        basic_form: string;
        /** Unknown words may have no reading or pronunciation. */
        reading?: string;
        pronunciation?: string;
        verbose: {
            word_id: number;
            word_type: "KNOWN" | "UNKNOWN";
            word_position: number;
        };
    }
}
