const analyzer = new KuromojiAnalyzer({ dictPath: "/dict/" });
const initialized: Promise<void> = analyzer.init();
const tokens: Promise<KuromojiAnalyzer.Token[]> = analyzer.parse("日本語");
