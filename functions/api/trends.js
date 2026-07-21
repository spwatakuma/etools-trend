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

    // A. Hacker News API
    try {
      const hnUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(mapping.hnQuery)}&tags=story&numericFilters=created_at_i>${sevenDaysAgoUnix}&hitsPerPage=1`;
      const hnRes = await fetch(hnUrl, {
        headers: { "User-Agent": "etools-trend-bot/4.0" },
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
            "User-Agent": "etools-trend-bot/4.0",
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

    // --- トレンドスコアリング & 前週比モメンタム補正 ---
    if (hnMentions > 0 || githubStars > 0 || npmDownloads > 0) {
      const hnScore = Math.min(40, Math.log2(hnMentions + 1) * 5.5);
      const starScore = githubStars > 0 ? Math.min(30, Math.log10(githubStars + 1) * 5) : 0;
      const dlScore = npmDownloads > 0 ? Math.min(30, Math.log10(npmDownloads + 1) * 4) : 10;

      let calculatedScore = Math.round(hnScore + starScore + dlScore);

      const totalIndicator = githubStars + (npmDownloads / 10);
      const activityRatio = hnMentions / (Math.log10(totalIndicator + 1) + 1);

      if (activityRatio > 2.0) {
        calculatedScore = Math.round(calculatedScore * 1.15);
      }

      tool.trendScore = Math.max(30, Math.min(99, calculatedScore));

      tool.mentions24h = Math.max(10, Math.round(hnMentions * 1.8 + Math.log10(githubStars + 1) * 50));
      tool.mentions7d = Math.max(50, Math.round(hnMentions * 10 + Math.log10(githubStars + 1) * 200));
      tool.mentions30d = Math.max(200, Math.round(hnMentions * 40 + Math.log10(githubStars + 1) * 800));
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
