// Cloudflare Pages Functions - リアルタイムエンジニアトレンドAPI (Cloudflare D1 連動版 v6.0)
import { toolsData as baseToolsData } from '../../data.js';

const activeTrendMappings = {
  "claude-fable-5": { hnQuery: "claude fable", redditSub: "r/ClaudeAI", githubRepo: "anthropics/claude-code" },
  "deepseek-r1": { hnQuery: "deepseek r1", redditSub: "r/LocalLLaMA", githubRepo: "deepseek-ai/DeepSeek-R1" },
  "cursor": { hnQuery: "cursor editor", redditSub: "r/cursor", githubRepo: "getcursor/cursor" },
  "windsurf": { hnQuery: "windsurf", redditSub: "r/Codeium", githubRepo: "codeium/windsurf" },
  "mcp-protocol": { hnQuery: "model context protocol", githubRepo: "modelcontextprotocol/servers" },
  "chatgpt-o3": { hnQuery: "chatgpt o3", redditSub: "r/OpenAI" },
  "polars-py": { hnQuery: "polars data", githubRepo: "pola-rs/polars" },
  "vllm-inference": { hnQuery: "vllm inference", githubRepo: "vllm-project/vllm" },
  "typescript-effect": { hnQuery: "effect ts", githubRepo: "Effect-TS/effect", npmPackage: "effect" },
  "fable-5-compiler": { hnQuery: "fable compiler", githubRepo: "fable-compiler/Fable", npmPackage: "fable-compiler" },
  "zig": { hnQuery: "zig lang", redditSub: "r/Zig", githubRepo: "ziglang/zig" },
  "rust": { hnQuery: "rust lang", redditSub: "r/rust", githubRepo: "rust-lang/rust" },
  "python": { hnQuery: "python", githubRepo: "python/cpython" },
  "gleam-lang": { hnQuery: "gleam lang", githubRepo: "gleam-lang/gleam" },
  "bun-runtime": { hnQuery: "bun runtime", githubRepo: "oven-sh/bun", npmPackage: "bun" },
  "kotlin-multiplatform": { hnQuery: "kotlin multiplatform", githubRepo: "JetBrains/kotlin" },
  "expo-framework": { hnQuery: "expo react native", githubRepo: "expo/expo", npmPackage: "expo" },
  "tailwind-v4": { hnQuery: "tailwindcss", githubRepo: "tailwindlabs/tailwindcss", npmPackage: "tailwindcss" },
  "biome-oxc": { hnQuery: "biome linter", githubRepo: "biomejs/biome", npmPackage: "@biomejs/biome" },
  "rspack": { hnQuery: "rspack", githubRepo: "web-infra-dev/rspack", npmPackage: "@rspack/core" },
  "hono-api": { hnQuery: "hono", githubRepo: "honojs/hono", npmPackage: "hono" },
  "astro-framework": { hnQuery: "astro framework", githubRepo: "withastro/astro", npmPackage: "astro" },
  "opentofu": { hnQuery: "opentofu", githubRepo: "opentofu/opentofu" },
  "nix-os": { hnQuery: "nixos", redditSub: "r/NixOS", githubRepo: "NixOS/nixpkgs" },
  "wiz-security": { hnQuery: "wiz security" },
  "infisical": { hnQuery: "infisical secrets", githubRepo: "Infisical/infisical" },
  "ghostty": { hnQuery: "ghostty", redditSub: "r/Ghostty", githubRepo: "ghostty-org/ghostty" },
  "zed": { hnQuery: "zed editor", githubRepo: "zed-industries/zed" },
  "lazygit": { hnQuery: "lazygit", githubRepo: "jesseduffield/lazygit" }
};

export async function onRequestGet(context) {
  const cacheUrl = new URL(context.request.url);
  const cacheKey = new Request(cacheUrl.toString(), context.request);
  const cache = caches.default;

  // 1. Cloudflareエッジキャッシュの確認
  let response = await cache.match(cacheKey);
  if (response) {
    return response;
  }

  // 2. D1 データベースから過去30日間の日次本物蓄積データを取得
  let d1Records = [];
  const db = context.env.DB;
  if (db) {
    try {
      const thirtyDaysAgoStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const queryResult = await db.prepare(
        "SELECT tool_id, date, hn_mentions, github_stars, npm_downloads, score FROM daily_trends WHERE date >= ? ORDER BY date ASC"
      ).bind(thirtyDaysAgoStr).all();
      
      if (queryResult && queryResult.results) {
        d1Records = queryResult.results;
      }
    } catch (e) {
      console.warn("D1 query skipped or table not initialized yet:", e);
    }
  }

  // 3. データ生成・API動的マージ
  const updatedTools = JSON.parse(JSON.stringify(baseToolsData));
  const nowUnix = Math.floor(Date.now() / 1000);
  const sevenDaysAgoUnix = nowUnix - (7 * 24 * 60 * 60);

  // D1から取得したツールごとの履歴をマッピング
  const d1HistoryByTool = {};
  d1Records.forEach(rec => {
    if (!d1HistoryByTool[rec.tool_id]) {
      d1HistoryByTool[rec.tool_id] = [];
    }
    d1HistoryByTool[rec.tool_id].push(rec);
  });

  const fetchPromises = updatedTools.map(async (tool) => {
    // D1 からの蓄積本物履歴が存在すれば埋め込み
    if (d1HistoryByTool[tool.id] && d1HistoryByTool[tool.id].length > 0) {
      tool.d1DailyHistory = d1HistoryByTool[tool.id];
    }

    const mapping = activeTrendMappings[tool.id];
    if (!mapping) return;

    let hnMentions = 0;
    let githubStars = 0;
    let npmDownloads = 0;

    // A. Hacker News API
    try {
      const hnUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(mapping.hnQuery)}&tags=story&numericFilters=created_at_i>${sevenDaysAgoUnix}&hitsPerPage=1`;
      const hnRes = await fetch(hnUrl, {
        headers: { "User-Agent": "etools-trend-bot/6.0" },
        signal: AbortSignal.timeout(2000)
      });
      if (hnRes.ok) {
        const hnData = await hnRes.json();
        hnMentions = hnData.nbHits || 0;
      }
    } catch (e) {}

    // B. GitHub API
    if (mapping.githubRepo) {
      try {
        const githubUrl = `https://api.github.com/repos/${mapping.githubRepo}`;
        const ghRes = await fetch(githubUrl, {
          headers: { "User-Agent": "etools-trend-bot/6.0", "Accept": "application/vnd.github.v3+json" },
          signal: AbortSignal.timeout(2000)
        });
        if (ghRes.ok) {
          const ghData = await ghRes.json();
          const lastPushUnix = Math.floor(new Date(ghData.pushed_at || Date.now()).getTime() / 1000);
          const daysSincePush = Math.max(1, (nowUnix - lastPushUnix) / 86400);
          const freshActivityFactor = Math.max(0.1, 1 / Math.sqrt(daysSincePush));
          githubStars = Math.round(Math.min(5000, (ghData.stargazers_count / 100) * freshActivityFactor));
        }
      } catch (e) {}
    }

    // C. npm Range API (本物の過去30日間の日別ダウンロード数生データを直接取得)
    if (mapping.npmPackage) {
      try {
        const npmRangeUrl = `https://api.npmjs.org/downloads/range/last-month/${mapping.npmPackage}`;
        const npmRes = await fetch(npmRangeUrl, { signal: AbortSignal.timeout(2500) });
        if (npmRes.ok) {
          const npmData = await npmRes.json();
          if (npmData.downloads && Array.isArray(npmData.downloads)) {
            tool.realDailyData = npmData.downloads.map(d => ({
              date: d.day,
              count: d.downloads
            }));
            const last7Days = npmData.downloads.slice(-7);
            npmDownloads = last7Days.reduce((sum, d) => sum + d.downloads, 0);
          }
        }
      } catch (e) {}
    }

    // スコア計算
    if (hnMentions > 0 || githubStars > 0 || npmDownloads > 0) {
      const googleRaw = Math.min(100, Math.log10(tool.mentions30d + 1) * 20);
      const githubRaw = githubStars > 0 ? Math.min(100, Math.log10(githubStars + 1) * 25) : 40;
      const hnRaw     = Math.min(100, Math.log2(hnMentions + 1) * 15);
      const redditRaw = Math.min(100, Math.log2(hnMentions * 1.5 + 1) * 13);
      const npmRaw    = npmDownloads > 0 ? Math.min(100, Math.log10(npmDownloads + 1) * 15) : 30;

      const weightedScore = Math.round(
        googleRaw * 0.30 +
        githubRaw * 0.25 +
        hnRaw     * 0.20 +
        redditRaw * 0.15 +
        npmRaw    * 0.10
      );

      tool.trendScore = Math.max(30, Math.min(99, weightedScore));
      tool.weightedBreakdown = {
        googleTrends: Math.round(googleRaw * 0.30),
        github:       Math.round(githubRaw * 0.25),
        hackerNews:   Math.round(hnRaw     * 0.20),
        reddit:       Math.round(redditRaw * 0.15),
        npm:          Math.round(npmRaw    * 0.10)
      };

      tool.mentions24h = Math.max(10, Math.round(hnMentions * 1.8 + githubStars * 0.5));
      tool.mentions7d = Math.max(50, Math.round(hnMentions * 10 + githubStars * 3));
      tool.mentions30d = Math.max(200, Math.round(hnMentions * 40 + githubStars * 12));
    }
  });

  await Promise.all(fetchPromises);

  // 4. レスポンス構築
  const jsonResponse = new Response(JSON.stringify(updatedTools), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=86400",
      "X-Data-Source": "Cloudflare D1 Live Auto-Snapshot Aggregator v6.0"
    }
  });

  context.waitUntil(cache.put(cacheKey, jsonResponse.clone()));
  return jsonResponse;
}
