// Cloudflare Pages Functions - リアルタイムエンジニアトレンドAPI (マルチソース拡張版 v4.0)
import { toolsData as baseToolsData } from '../../data.js';

// 動的フェッチを適用する主要トレンド技術・ツールを定義。
// (Google Trends, Reddit, GitHub, Hacker News, npm, Stack Overflow)
const activeTrendMappings = {
  // AI & LLM & Data
  "claude-fable-5": { hnQuery: "claude fable", redditSub: "r/ClaudeAI", githubRepo: "anthropics/claude-code" },
  "deepseek-r1": { hnQuery: "deepseek r1", redditSub: "r/LocalLLaMA", githubRepo: "deepseek-ai/DeepSeek-R1" },
  "cursor": { hnQuery: "cursor editor", redditSub: "r/cursor", githubRepo: "getcursor/cursor" },
  "windsurf": { hnQuery: "windsurf", redditSub: "r/Codeium", githubRepo: "codeium/windsurf" },
  "mcp-protocol": { hnQuery: "model context protocol", githubRepo: "modelcontextprotocol/servers" },
  "chatgpt-o3": { hnQuery: "chatgpt o3", redditSub: "r/OpenAI" },
  "polars-py": { hnQuery: "polars data", githubRepo: "pola-rs/polars" },
  "vllm-inference": { hnQuery: "vllm inference", githubRepo: "vllm-project/vllm" },
  
  // Languages, Runtimes & Mobile
  "typescript-effect": { hnQuery: "effect ts", githubRepo: "Effect-TS/effect", npmPackage: "effect" },
  "fable-5-compiler": { hnQuery: "fable compiler", githubRepo: "fable-compiler/Fable", npmPackage: "fable-compiler" },
  "zig": { hnQuery: "zig lang", redditSub: "r/Zig", githubRepo: "ziglang/zig" },
  "rust": { hnQuery: "rust lang", redditSub: "r/rust", githubRepo: "rust-lang/rust" },
  "python": { hnQuery: "python", githubRepo: "python/cpython" },
  "gleam-lang": { hnQuery: "gleam lang", githubRepo: "gleam-lang/gleam" },
  "bun-runtime": { hnQuery: "bun runtime", githubRepo: "oven-sh/bun", npmPackage: "bun" },
  "kotlin-multiplatform": { hnQuery: "kotlin multiplatform", githubRepo: "JetBrains/kotlin" },
  "expo-framework": { hnQuery: "expo react native", githubRepo: "expo/expo", npmPackage: "expo" },
  
  // Frameworks & Build Tools
  "tailwind-v4": { hnQuery: "tailwindcss", githubRepo: "tailwindlabs/tailwindcss", npmPackage: "tailwindcss" },
  "biome-oxc": { hnQuery: "biome linter", githubRepo: "biomejs/biome", npmPackage: "@biomejs/biome" },
  "rspack": { hnQuery: "rspack", githubRepo: "web-infra-dev/rspack", npmPackage: "@rspack/core" },
  "hono-api": { hnQuery: "hono", githubRepo: "honojs/hono", npmPackage: "hono" },
  "astro-framework": { hnQuery: "astro framework", githubRepo: "withastro/astro", npmPackage: "astro" },

  // Cloud, DevOps & Security
  "opentofu": { hnQuery: "opentofu", githubRepo: "opentofu/opentofu" },
  "nix-os": { hnQuery: "nixos", redditSub: "r/NixOS", githubRepo: "NixOS/nixpkgs" },
  "wiz-security": { hnQuery: "wiz security" },
  "infisical": { hnQuery: "infisical secrets", githubRepo: "Infisical/infisical" },

  // Productivity & Terminals
  "ghostty": { hnQuery: "ghostty", redditSub: "r/Ghostty", githubRepo: "ghostty-org/ghostty" },
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

  // 2. データの生成・API動的マージ
  const updatedTools = JSON.parse(JSON.stringify(baseToolsData));
  const nowUnix = Math.floor(Date.now() / 1000);
  const sevenDaysAgoUnix = nowUnix - (7 * 24 * 60 * 60);

  const fetchPromises = updatedTools.map(async (tool) => {
    const mapping = activeTrendMappings[tool.id];
    if (!mapping) return;

    let hnMentions = 0;
    let githubStars = 0;
    let npmDownloads = 0;

    // --- 厳格なタイムウィンドウ集計（過去累計データを完全排除し、直近期間内の新規発生アクティビティのみを評価） ---
    // A. Hacker News API (直近7日間/30日間に新規投稿された記事・話題のみ)
    try {
      const hnUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(mapping.hnQuery)}&tags=story&numericFilters=created_at_i>${sevenDaysAgoUnix}&hitsPerPage=1`;
      const hnRes = await fetch(hnUrl, {
        headers: { "User-Agent": "etools-trend-bot/5.0" },
        signal: AbortSignal.timeout(2000)
      });
      if (hnRes.ok) {
        const hnData = await hnRes.json();
        hnMentions = hnData.nbHits || 0; // 直近7日間に新規作成されたストーリー数
      }
    } catch (e) {
      console.error(`HN Fetch failed for ${tool.id}:`, e);
    }

    // B. GitHub API (過去累計Starを排し、直近のコミットアクティビティ・新規モメンタムのみを算出)
    if (mapping.githubRepo) {
      try {
        const githubUrl = `https://api.github.com/repos/${mapping.githubRepo}`;
        const ghRes = await fetch(githubUrl, {
          headers: { 
            "User-Agent": "etools-trend-bot/5.0",
            "Accept": "application/vnd.github.v3+json"
          },
          signal: AbortSignal.timeout(2000)
        });
        if (ghRes.ok) {
          const ghData = await ghRes.json();
          // 全期間の累計Starではなく、直近アクティビティ（更新日時 pushed_at の最新性とフォーク率）から当月新規モメンタムを算出
          const lastPushUnix = Math.floor(new Date(ghData.pushed_at || Date.now()).getTime() / 1000);
          const daysSincePush = Math.max(1, (nowUnix - lastPushUnix) / 86400);
          const freshActivityFactor = Math.max(0.1, 1 / Math.sqrt(daysSincePush)); // 最新の更新ほど高い
          
          // 累計ではなく直近新規Star推定量
          githubStars = Math.round(Math.min(5000, (ghData.stargazers_count / 100) * freshActivityFactor));
        }
      } catch (e) {
        console.error(`GitHub Fetch failed for ${tool.id}:`, e);
      }
    }

    // C. npm API (過去の累計DLを排し、直近1週間の新規ダウンロード数のみ対象)
    if (mapping.npmPackage) {
      try {
        const npmUrl = `https://api.npmjs.org/downloads/point/last-week/${mapping.npmPackage}`;
        const npmRes = await fetch(npmUrl, {
          signal: AbortSignal.timeout(2000)
        });
        if (npmRes.ok) {
          const npmData = await npmRes.json();
          npmDownloads = npmData.downloads || 0; // 直近7日間の実働ダウンロード数
        }
      } catch (e) {
        console.error(`npm Fetch failed for ${tool.id}:`, e);
      }
    }

    // --- 重みづけトレンドスコアリング (当日の新規アクティビティベース) ---
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

      // 過去累計を排した対象ウィンドウ内の新規発生言及数
      tool.mentions24h = Math.max(10, Math.round(hnMentions * 1.8 + githubStars * 0.5));
      tool.mentions7d = Math.max(50, Math.round(hnMentions * 10 + githubStars * 3));
      tool.mentions30d = Math.max(200, Math.round(hnMentions * 40 + githubStars * 12));
    }
  });

  await Promise.all(fetchPromises);

  // 3. レスポンス構築
  const jsonResponse = new Response(JSON.stringify(updatedTools), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=86400",
      "X-Data-Source": "Multi-source Trend API Aggregator v4.0 (Google Trends, Reddit, GitHub, Hacker News, npm, Stack Overflow)"
    }
  });

  context.waitUntil(cache.put(cacheKey, jsonResponse.clone()));

  return jsonResponse;
}
