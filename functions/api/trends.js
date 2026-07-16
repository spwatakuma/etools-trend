// Cloudflare Pages Functions - リアルタイムエンジニアトレンドAPI (大規模・高速化版)
import { toolsData as baseToolsData } from '../../data.js';

// 動的フェッチを適用する「主要トレンド技術・ツール (変動が激しい約35個)」を定義。
// それ以外の定番技術や静的ガジェット類は、ベースライン値をそのまま返すことでAPI制限を回避し爆速動作させます。
const activeTrendMappings = {
  // AI & LLM
  "claude-fable-5": { hnQuery: "claude fable", githubRepo: "anthropics/claude-code" },
  "deepseek-r1": { hnQuery: "deepseek r1", githubRepo: "deepseek-ai/DeepSeek-R1" },
  "cursor": { hnQuery: "cursor editor", githubRepo: "getcursor/cursor" },
  "windsurf": { hnQuery: "windsurf", githubRepo: "codeium/windsurf" },
  "mcp-protocol": { hnQuery: "model context protocol", githubRepo: "modelcontextprotocol/servers" },
  "chatgpt-o3": { hnQuery: "chatgpt o3", githubRepo: "openai/chatgpt-api" },
  
  // Languages & Runtimes
  "typescript-effect": { hnQuery: "effect ts", githubRepo: "Effect-TS/effect", npmPackage: "effect" },
  "fable-5-compiler": { hnQuery: "fable compiler", githubRepo: "fable-compiler/Fable", npmPackage: "fable-compiler" },
  "zig": { hnQuery: "zig lang", githubRepo: "ziglang/zig" },
  "rust": { hnQuery: "rust lang", githubRepo: "rust-lang/rust" },
  "python": { hnQuery: "python", githubRepo: "python/cpython" },
  "gleam-lang": { hnQuery: "gleam lang", githubRepo: "gleam-lang/gleam" },
  "bun-runtime": { hnQuery: "bun runtime", githubRepo: "oven-sh/bun", npmPackage: "bun" },
  
  // Frameworks
  "tailwind-v4": { hnQuery: "tailwindcss", githubRepo: "tailwindlabs/tailwindcss", npmPackage: "tailwindcss" },
  "biome-oxc": { hnQuery: "biome linter", githubRepo: "biomejs/biome", npmPackage: "@biomejs/biome" },
  "svelte-5": { hnQuery: "svelte 5", githubRepo: "sveltejs/svelte", npmPackage: "svelte" },
  "rspack": { hnQuery: "rspack", githubRepo: "web-infra-dev/rspack", npmPackage: "@rspack/core" },
  "hono-api": { hnQuery: "hono", githubRepo: "honojs/hono", npmPackage: "hono" },
  
  // Databases
  "valkey": { hnQuery: "valkey", githubRepo: "valkey-io/valkey" },
  "turso": { hnQuery: "turso database", githubRepo: "tursodatabase/libsql" },
  "duckdb": { hnQuery: "duckdb", githubRepo: "duckdb/duckdb" },
  "drizzle-orm": { hnQuery: "drizzle orm", githubRepo: "drizzle-team/drizzle-orm", npmPackage: "drizzle-orm" },

  // Productivity
  "ghostty": { hnQuery: "ghostty", githubRepo: "ghostty-org/ghostty" },
  "zed": { hnQuery: "zed editor", githubRepo: "zed-industries/zed" },
  "lazygit": { hnQuery: "lazygit", githubRepo: "jesseduffield/lazygit" }
};

export async function onRequestGet(context) {
  const cacheUrl = new URL(context.request.url);
  const cacheKey = new Request(cacheUrl.toString(), context.request);
  const cache = caches.default;

  // 1. Cloudflareエッジキャッシュの確認 (24時間キャッシュ)
  let response = await cache.match(cacheKey);
  if (response) {
    return response;
  }

  // 2. 本物のAPIデータの取得開始
  const updatedTools = JSON.parse(JSON.stringify(baseToolsData));
  const nowUnix = Math.floor(Date.now() / 1000);
  const sevenDaysAgoUnix = nowUnix - (7 * 24 * 60 * 60);

  // 主要なアクティブトレンド対象のみを並列フェッチ
  const fetchPromises = updatedTools.map(async (tool) => {
    const mapping = activeTrendMappings[tool.id];
    if (!mapping) return; // 定番技術、ガジェット等はベースデータを維持してスキップ (超高速化)

    let hnMentions = 0;
    let githubStars = 0;
    let npmDownloads = 0;

    // A. Hacker News API
    try {
      const hnUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(mapping.hnQuery)}&tags=story&numericFilters=created_at_i>${sevenDaysAgoUnix}&hitsPerPage=1`;
      const hnRes = await fetch(hnUrl, {
        headers: { "User-Agent": "etools-trend-bot/1.0" },
        signal: AbortSignal.timeout(2000)
      });
      if (hnRes.ok) {
        const hnData = await hnRes.json();
        hnMentions = hnData.nbHits || 0;
      }
    } catch (e) {
      console.error(`HN Fetch failed for ${tool.id}:`, e);
    }

    // B. GitHub API
    if (mapping.githubRepo) {
      try {
        const githubUrl = `https://api.github.com/repos/${mapping.githubRepo}`;
        const ghRes = await fetch(githubUrl, {
          headers: { 
            "User-Agent": "etools-trend-bot/1.0",
            "Accept": "application/vnd.github.v3+json"
          },
          signal: AbortSignal.timeout(2000)
        });
        if (ghRes.ok) {
          const ghData = await ghRes.json();
          githubStars = ghData.stargazers_count || 0;
        }
      } catch (e) {
        console.error(`GitHub Fetch failed for ${tool.id}:`, e);
      }
    }

    // C. npm API
    if (mapping.npmPackage) {
      try {
        const npmUrl = `https://api.npmjs.org/downloads/point/last-week/${mapping.npmPackage}`;
        const npmRes = await fetch(npmUrl, {
          signal: AbortSignal.timeout(2000)
        });
        if (npmRes.ok) {
          const npmData = await npmRes.json();
          npmDownloads = npmData.downloads || 0;
        }
      } catch (e) {
        console.error(`npm Fetch failed for ${tool.id}:`, e);
      }
    }

    // --- トレンドスコアリング計算 ---
    if (hnMentions > 0 || githubStars > 0 || npmDownloads > 0) {
      const hnScore = Math.min(40, Math.log2(hnMentions + 1) * 5.5);
      const starScore = githubStars > 0 ? Math.min(30, Math.log10(githubStars + 1) * 5) : 0;
      const dlScore = npmDownloads > 0 ? Math.min(30, Math.log10(npmDownloads + 1) * 4) : 10;

      let calculatedScore = Math.round(hnScore + starScore + dlScore);

      // 最新ツールへのボーナス補正
      const totalIndicator = githubStars + (npmDownloads / 10);
      const activityRatio = hnMentions / (Math.log10(totalIndicator + 1) + 1);

      if (activityRatio > 2.0) {
        calculatedScore = Math.round(calculatedScore * 1.15);
      }

      tool.trendScore = Math.max(30, Math.min(99, calculatedScore));

      // 期間別言及数のスケーリング
      tool.mentions24h = Math.max(10, Math.round(hnMentions * 1.8 + Math.log10(githubStars + 1) * 50));
      tool.mentions7d = Math.max(50, Math.round(hnMentions * 10 + Math.log10(githubStars + 1) * 200));
      tool.mentions30d = Math.max(200, Math.round(hnMentions * 40 + Math.log10(githubStars + 1) * 800));

      const trendVariance = [
        Math.max(25, tool.trendScore - 12),
        Math.max(25, tool.trendScore - 8),
        Math.max(25, tool.trendScore - 9),
        Math.max(25, tool.trendScore - 5),
        Math.max(25, tool.trendScore - 4),
        Math.max(25, tool.trendScore - 6),
        Math.max(25, tool.trendScore - 2),
        Math.max(25, tool.trendScore + 1),
        Math.max(25, tool.trendScore - 1),
        tool.trendScore
      ];
      tool.trendData = trendVariance;
    }
  });

  await Promise.all(fetchPromises);

  // 3. レスポンスオブジェクトの構築とエッジキャッシュへの書き込み
  const jsonResponse = new Response(JSON.stringify(updatedTools), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=86400",
      "X-Data-Source": "Real-time Treemap API Aggregator v3.0 (GitHub, Hacker News, npm)"
    }
  });

  context.waitUntil(cache.put(cacheKey, jsonResponse.clone()));

  return jsonResponse;
}
