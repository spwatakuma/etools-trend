// 2026年最新（7月時点）のエンジニアツール・動向のデータ
export const categories = {
  ai: "AI & LLM",
  languages: "Languages & Runtimes",
  frameworks: "Frameworks & Libraries",
  databases: "Databases & Backend",
  productivity: "Productivity & Terminals",
  gadgets: "Gadgets & Hardware"
};

// 各カテゴリに属するツール/ガジェットのデータ
export const toolsData = [
  // --- AI & LLM ---
  {
    id: "claude-fable-5",
    name: "Claude Fable 5",
    category: "ai",
    trendScore: 99,
    mentions24h: 5300,
    mentions7d: 38200,
    mentions30d: 154000,
    description: "2026年6月に発表され、7月1日にグローバル展開が再開されたAnthropicの超最新鋭フラグシップAIモデル。従来のSonnetを遥かに凌駕する圧倒的な推論・論理思考能力を持ち、自律的なコーディング能力において技術界隈の話題を独占しています。",
    trendData: [40, 65, 80, 88, 92, 95, 98, 97, 98, 99],
    isAffiliate: false,
    url: "https://www.anthropic.com/claude"
  },
  {
    id: "deepseek-r1",
    name: "DeepSeek-R1 / Ollama",
    category: "ai",
    trendScore: 97,
    mentions24h: 4120,
    mentions7d: 29500,
    mentions30d: 120000,
    description: "月20ドルのAIサブスク疲れへの回答として台頭。極めて高い推論性能を持ちながら安価なAPI使用料、またローカル実行環境（Ollama）でのプライバシー保護の観点から開発者の主力AIとして定着しました。",
    trendData: [60, 68, 75, 82, 88, 91, 93, 95, 96, 97],
    isAffiliate: false,
    url: "https://ollama.com/"
  },
  {
    id: "cursor-windsurf",
    name: "Cursor & Windsurf (AI IDEs)",
    category: "ai",
    trendScore: 96,
    mentions24h: 3800,
    mentions7d: 27100,
    mentions30d: 110000,
    description: "コードベース全体を自律的にデバッグ・リファクタリングする「Agentic Workflow（エージェント型開発）」の標準エディタ。現在CursorとWindsurfが市場の覇権を争い、激しい機能競合を展開中。",
    trendData: [92, 93, 94, 95, 96, 95, 96, 97, 96, 96],
    isAffiliate: false,
    url: "https://www.cursor.com/"
  },
  {
    id: "mcp-protocol",
    name: "Model Context Protocol (MCP)",
    category: "ai",
    trendScore: 95,
    mentions24h: 3400,
    mentions7d: 24500,
    mentions30d: 98000,
    description: "特定のツールではなく「AIとローカルツールの連携標準プロトコル」。AIエージェントにファイルやターミナル、外部APIへの接続権限を安全に渡すインフラとして、2026年最大の技術トレンドとなっています。",
    trendData: [30, 48, 62, 75, 82, 86, 90, 93, 94, 95],
    isAffiliate: false,
    url: "https://modelcontextprotocol.io/"
  },

  // --- Languages & Runtimes ---
  {
    id: "fable-5-compiler",
    name: "Fable 5 (F# to JS)",
    category: "languages",
    trendScore: 91,
    mentions24h: 1980,
    mentions7d: 13500,
    mentions30d: 54000,
    description: "2026年4月にメジャーリリースされ、7月現在もマイナーアプデ（5.8.x）を重ね話題沸騰中のF#コンパイラ。.NET 10に完全対応し、MSBuild連携の大幅改善とJavaScript/Rust出力の高速化で、関数型フロントエンド開発を飛躍させました。",
    trendData: [45, 55, 68, 74, 80, 84, 86, 89, 90, 91],
    isAffiliate: false,
    url: "https://fable.io/"
  },
  {
    id: "rust",
    name: "Rust",
    category: "languages",
    trendScore: 95,
    mentions24h: 3200,
    mentions7d: 22100,
    mentions30d: 90000,
    description: "システムプログラミングのみならず、現代のJS/TS開発ツールチェーン（Biome、Oxc、Rspackなど）がこぞってRustで完全に書き換えられ爆速化しているため、Webエンジニアにとっても重要性が極限に達しています。",
    trendData: [92, 93, 92, 94, 95, 94, 95, 96, 94, 95],
    isAffiliate: false,
    url: "https://www.rust-lang.org/"
  },
  {
    id: "typescript-effect",
    name: "TS & Effect TS",
    category: "languages",
    trendScore: 93,
    mentions24h: 2900,
    mentions7d: 20500,
    mentions30d: 83000,
    description: "型安全なWeb開発のデファクトであるTypeScriptに加え、非同期処理や堅牢なエラーハンドリングを一元管理する関数型ライブラリ「Effect TS」のプロダクション導入事例が急増し、開発トレンドとなっています。",
    trendData: [60, 68, 74, 80, 83, 86, 89, 91, 92, 93],
    isAffiliate: false,
    url: "https://effect.website/"
  },
  {
    id: "python",
    name: "Python / uv",
    category: "languages",
    trendScore: 94,
    mentions24h: 3100,
    mentions7d: 21200,
    mentions30d: 87000,
    description: "AI/機械学習人気に加え、Rust製超高速パッケージ管理ツール「uv」の登場によってこれまでのPython開発の「遅さ・複雑さ」が一掃され、開発者体験が劇的に向上したことでシェアが更に急拡大しています。",
    trendData: [89, 90, 91, 90, 92, 93, 94, 93, 94, 94],
    isAffiliate: false,
    url: "https://github.com/astral-sh/uv"
  },
  {
    id: "zig",
    name: "Zig",
    category: "languages",
    trendScore: 86,
    mentions24h: 1720,
    mentions7d: 11900,
    mentions30d: 49000,
    description: "C言語の代替としての立ち位置を確固たるものに。GhosttyやBunなど、2026年に話題を席巻している超高速パフォーマンス系ツールのベース言語として知名度と採用数が急伸しています。",
    trendData: [70, 72, 75, 78, 80, 83, 85, 84, 85, 86],
    isAffiliate: false,
    url: "https://ziglang.org/"
  },

  // --- Frameworks & Libraries ---
  {
    id: "tailwind-v4",
    name: "Tailwind CSS v4.0",
    category: "frameworks",
    trendScore: 92,
    mentions24h: 2950,
    mentions7d: 20800,
    mentions30d: 85000,
    description: "Rustエンジン採用による完全刷新。ビルド時間が最大10倍高速化し、CSS自体を設定ファイルとして機能させる超軽量アプローチにより、フロントエンドエンジニアの「必須スタイリングツール」として不動の評価を得ています。",
    trendData: [75, 80, 83, 85, 88, 89, 91, 90, 91, 92],
    isAffiliate: false,
    url: "https://tailwindcss.com/"
  },
  {
    id: "biome-oxc",
    name: "Biome / Oxc (Toolchains)",
    category: "frameworks",
    trendScore: 91,
    mentions24h: 2800,
    mentions7d: 19500,
    mentions30d: 79000,
    description: "ESLintやPrettierを一掃しつつある、Rust製の超高速リンター/フォーマッター。秒間数万行の静的解析をノーレイテンシーで行い、AIによる自動修正やビルドチェーンの高速化に欠かせない存在になっています。",
    trendData: [50, 62, 70, 78, 82, 85, 87, 89, 90, 91],
    isAffiliate: false,
    url: "https://biomejs.dev/"
  },
  {
    id: "svelte-5",
    name: "Svelte 5 (Runes)",
    category: "frameworks",
    trendScore: 88,
    mentions24h: 1950,
    mentions7d: 13900,
    mentions30d: 57000,
    description: "リアクティビティを完全に再定義した「Runes」システムを搭載。Reactのような複雑な状態管理コードを圧倒的に短くし、かつ仮想DOMなしの超高速レンダリングを行えるため注目度が最高潮に達しています。",
    trendData: [68, 72, 75, 78, 80, 83, 85, 86, 87, 88],
    isAffiliate: false,
    url: "https://svelte.dev/"
  },
  {
    id: "rspack",
    name: "Rspack",
    category: "frameworks",
    trendScore: 87,
    mentions24h: 1680,
    mentions7d: 12100,
    mentions30d: 49000,
    description: "WebpackのRust製互換クローン。大企業のレガシーで巨大なWebpack設定をほぼ維持したまま、ビルド時間を数分から数秒へと一瞬で短縮できるため、大規模開発現場への導入が急増しています。",
    trendData: [50, 58, 65, 72, 78, 81, 83, 85, 86, 87],
    isAffiliate: false,
    url: "https://www.rspack.dev/"
  },

  // --- Databases & Backend ---
  {
    id: "postgresql",
    name: "PostgreSQL",
    category: "databases",
    trendScore: 94,
    mentions24h: 3100,
    mentions7d: 21500,
    mentions30d: 89000,
    description: "拡張機能のpgvectorを用いた生成AI用ベクターストア化、また高い信頼性により、RDBの絶対的デファクトスタンダードとして君臨し続けています。",
    trendData: [93, 94, 93, 94, 94, 95, 94, 95, 94, 94],
    isAffiliate: false,
    url: "https://www.postgresql.org/"
  },
  {
    id: "valkey",
    name: "Valkey",
    category: "databases",
    trendScore: 92,
    mentions24h: 2800,
    mentions7d: 19800,
    mentions30d: 81000,
    description: "Redisのライセンス変更に伴い、Linux Foundation主導で立ち上がった真のオープンソースフォーク。AWSやGCP等の大手ベンダーも全面サポートを表明し、本番環境のRedisからの移行トレンドが本格化しています。",
    trendData: [40, 55, 68, 75, 82, 85, 88, 90, 91, 92],
    isAffiliate: false,
    url: "https://valkey.io/"
  },
  {
    id: "turso",
    name: "Turso",
    category: "databases",
    trendScore: 88,
    mentions24h: 1850,
    mentions7d: 13100,
    mentions30d: 53000,
    description: "libsql（SQLiteのオープンソースフォーク）ベースの超高速・分散型エッジデータベース。個人開発からスタートアップのサーバーレスアーキテクチャにおいて、超低コストかつ爆速なデータ提供でブレイク中。",
    trendData: [72, 75, 76, 79, 81, 84, 86, 85, 87, 88],
    isAffiliate: false,
    url: "https://turso.tech/"
  },
  {
    id: "duckdb",
    name: "DuckDB",
    category: "databases",
    trendScore: 87,
    mentions24h: 1720,
    mentions7d: 12400,
    mentions30d: 51000,
    description: "ローカルおよびサーバーレス環境でデータ分析（OLAP）を爆速化する組み込みカラムナーデータベース。データサイエンス、AI、Pandas等の代替分析ツールとして絶大な人気を獲得しています。",
    trendData: [60, 68, 72, 75, 79, 82, 84, 86, 85, 87],
    isAffiliate: false,
    url: "https://duckdb.org/"
  },

  // --- Productivity & Terminals ---
  {
    id: "ghostty",
    name: "Ghostty",
    category: "productivity",
    trendScore: 96,
    mentions24h: 3300,
    mentions7d: 23100,
    mentions30d: 94000,
    description: "Zig言語で開発されたGPU加速対応の超高速ターミナルエミュレータ。圧倒的な表示ラグの無さ、複数タブ・分割画面の滑らかさ、極小の省メモリ設計で、一気に開発者のメイン端末として標準化しました。",
    trendData: [50, 65, 78, 85, 89, 91, 93, 95, 95, 96],
    isAffiliate: false,
    url: "https://ghostty.org/"
  },
  {
    id: "zed",
    name: "Zed Editor",
    category: "productivity",
    trendScore: 91,
    mentions24h: 2150,
    mentions7d: 14800,
    mentions30d: 62000,
    description: "Rustで書かれた爆速のコードエディタ。VS Codeの「起動やタイピングの重さ」を嫌うパワーユーザーや、内蔵のAIペアプロ機能、軽量な操作感を求めるエンジニアの間で愛用されています。",
    trendData: [78, 80, 82, 83, 85, 88, 87, 89, 90, 91],
    isAffiliate: false,
    url: "https://zed.dev/"
  },
  {
    id: "docker-devcontainers",
    name: "Devcontainers",
    category: "productivity",
    trendScore: 89,
    mentions24h: 1900,
    mentions7d: 13200,
    mentions30d: 55000,
    description: "開発環境の定義（コンテナ）とエディタを密に連携。新メンバーの参入や、AIエージェントにプロジェクト全体の依存関係（実行環境）を正しく渡すための必須ルールとして普及が進んでいます。",
    trendData: [82, 84, 85, 86, 88, 87, 88, 89, 88, 89],
    isAffiliate: false,
    url: "https://containers.dev/"
  },

  // --- Gadgets & Hardware (Affiliate) ---
  {
    id: "keychron-q1-he",
    name: "Keychron Q1 HE (Magnetic)",
    category: "gadgets",
    trendScore: 92,
    mentions24h: 1150,
    mentions7d: 8300,
    mentions30d: 36000,
    description: "磁気ホールエフェクトスイッチを搭載し、キーの押し込み深さ（アクチュエーション）を0.1mm単位で調整可能なラピッドトリガー対応キーボード。コトコトした極上の打鍵感と超高速なタイピングレスポンスで2026年エンジニアの憧れのキーボードとなっています。",
    trendData: [60, 68, 75, 80, 83, 85, 88, 90, 91, 92],
    isAffiliate: true,
    affiliatePrice: "¥38,500",
    url: "https://amzn.to/example-keychron-q1-he",
    imageName: "keychron_q1.png" // 既存のKeychron画像アセットを使用
  },
  {
    id: "hhkb-studio",
    name: "HHKB Studio",
    category: "gadgets",
    trendScore: 91,
    mentions24h: 1050,
    mentions7d: 7900,
    mentions30d: 34000,
    description: "ホームポジションから手を動かさずにすべてを操作できる「ポインティングスティック」と「ジェスチャーパッド」を搭載。プロフェッショナルのための静音メカニカルスイッチキーボード。",
    trendData: [85, 86, 85, 88, 89, 90, 89, 91, 90, 91],
    isAffiliate: true,
    affiliatePrice: "¥44,000",
    url: "https://amzn.to/example-hhkb-studio",
    imageName: "hhkb_studio.png"
  },
  {
    id: "32-oled-4k-monitor",
    name: "32\" OLED 4K Monitor",
    category: "gadgets",
    trendScore: 93,
    mentions24h: 1250,
    mentions7d: 9100,
    mentions30d: 39000,
    description: "LGやASUSなどから登場した、32インチの有機EL（OLED）4Kディスプレイ。圧倒的な黒の表現力によりコードの視認性が極めて高く、低反射設計による目の疲労軽減効果から、長時間のコーディングを行うエンジニアのデスクセットアップでブームとなっています。",
    trendData: [70, 75, 80, 83, 86, 89, 91, 92, 92, 93],
    isAffiliate: true,
    affiliatePrice: "¥148,000",
    url: "https://amzn.to/example-oled-4k",
    imageName: "oled_monitor.png" // 既存のOLEDアセットがまだないため暫定的にアセット配置
  },
  {
    id: "mx-master-3s",
    name: "Logicool MX Master 3S",
    category: "gadgets",
    trendScore: 89,
    mentions24h: 950,
    mentions7d: 7100,
    mentions30d: 29000,
    description: "静音クリック、1秒間に1000行スクロール可能なMagSpeed電磁気スクロールホイールを搭載。エルゴノミクスに基づいた究極の快適性を持つ、プロの開発者のための高機能マウス。",
    trendData: [88, 89, 88, 89, 89, 90, 89, 90, 88, 89],
    isAffiliate: true,
    affiliatePrice: "¥16,900",
    url: "https://amzn.to/example-mx-master-3s",
    imageName: "mx_master_3s.png"
  }
];
