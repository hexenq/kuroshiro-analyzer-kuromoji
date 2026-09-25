import KuromojiAnalyzer from "kuroshiro-analyzer-kuromoji";

const analyzer: KuromojiAnalyzer = new KuromojiAnalyzer();
if (typeof analyzer.parse !== "function") throw new Error("Invalid CommonJS default import");
