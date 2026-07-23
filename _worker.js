// Cloudflare Pages ルート直下ルーター (_worker.js)
import { toolsData as baseToolsData } from './data.js';

const activeTrendMappings = {
  "gemini-3-6-flash": { hnQuery: "gemini 3.6 flash", redditSub: "r/Bard", githubRepo: "google/generative-ai-js" },
  "deepseek-v3": { hnQuery: "deepseek v3", redditSub: "r/LocalLLaMA", githubRepo: "deepseek-ai/DeepSeek-V3" },
  "claude-3-7-sonnet": { hnQuery: "claude 3.7 sonnet", redditSub: "r/ClaudeAI", githubRepo: "anthropics/claude-code" },
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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. /api/trends 処理 (Cloudflare D1 から直接クエリ)
    if (url.pathname === '/api/trends') {
      let d1Records = [];
      const db = env.DB;

      if (db) {
        try {
          await db.prepare(`
            CREATE TABLE IF NOT EXISTS daily_trends (
              tool_id TEXT NOT NULL,
              date TEXT NOT NULL,
              hn_mentions INTEGER DEFAULT 0,
              github_stars INTEGER DEFAULT 0,
              npm_downloads INTEGER DEFAULT 0,
              score INTEGER DEFAULT 0,
              PRIMARY KEY (tool_id, date)
            )
          `).run();

          const queryResult = await db.prepare(
            "SELECT tool_id, date, hn_mentions, github_stars, npm_downloads, score FROM daily_trends WHERE date >= '2026-07-23' ORDER BY date ASC"
          ).all();

          if (queryResult && queryResult.results) {
            d1Records = queryResult.results;
          }
        } catch (e) {
          console.warn("D1 query in _worker.js failed:", e);
        }
      }

      const updatedTools = JSON.parse(JSON.stringify(baseToolsData));
      const d1HistoryByTool = {};
      d1Records.forEach(rec => {
        if (!d1HistoryByTool[rec.tool_id]) {
          d1HistoryByTool[rec.tool_id] = [];
        }
        d1HistoryByTool[rec.tool_id].push(rec);
      });

      const nowUnix = Math.floor(Date.now() / 1000);
      const sevenDaysAgoUnix = nowUnix - (7 * 24 * 60 * 60);

      const fetchPromises = updatedTools.map(async (tool) => {
        if (d1HistoryByTool[tool.id] && d1HistoryByTool[tool.id].length > 0) {
          tool.d1DailyHistory = d1HistoryByTool[tool.id];
        }

        const mapping = activeTrendMappings[tool.id];
        if (!mapping) {
          tool.trendScore = 15;
          tool.changePercent = -20.0;
          tool.mentions24h = 0;
          tool.mentions7d = 0;
          tool.mentions30d = 0;
          tool.weightedBreakdown = { googleTrends: 0, github: 0, hackerNews: 0, reddit: 0, npm: 0 };
          return;
        }

        let hnMentions = 0;
        let githubStars = 0;

        try {
          const hnUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(mapping.hnQuery)}&tags=story&numericFilters=created_at_i>${sevenDaysAgoUnix}&hitsPerPage=1`;
          const hnRes = await fetch(hnUrl, { headers: { "User-Agent": "etools-worker/1.0" }, signal: AbortSignal.timeout(2000) });
          if (hnRes.ok) {
            const hnData = await hnRes.json();
            hnMentions = hnData.nbHits || 0;
          }
        } catch (e) {}

        if (mapping.githubRepo) {
          try {
            const githubUrl = `https://api.github.com/repos/${mapping.githubRepo}`;
            const ghRes = await fetch(githubUrl, {
              headers: { "User-Agent": "etools-worker/1.0", "Accept": "application/vnd.github.v3+json" },
              signal: AbortSignal.timeout(2000)
            });
            if (ghRes.ok) {
              const ghData = await ghRes.json();
              githubStars = ghData.stargazers_count ? 1 : 0;
            }
          } catch (e) {}
        }

        const realCount = hnMentions + githubStars;
        if (realCount > 0 || (tool.d1DailyHistory && tool.d1DailyHistory.length > 0)) {
          const rawScore = Math.min(99, Math.max(30, Math.round(50 + Math.log2(realCount + 1) * 10)));
          tool.trendScore = rawScore;
          tool.mentions24h = realCount;
          tool.mentions7d = realCount;
          tool.mentions30d = realCount;
          tool.weightedBreakdown = {
            googleTrends: Math.round(rawScore * 0.30),
            github: Math.round(rawScore * 0.25),
            hackerNews: Math.round(rawScore * 0.20),
            reddit: Math.round(rawScore * 0.15),
            npm: Math.round(rawScore * 0.10)
          };
        } else {
          tool.trendScore = 15;
          tool.changePercent = -20.0;
          tool.mentions24h = 0;
          tool.mentions7d = 0;
          tool.mentions30d = 0;
          tool.weightedBreakdown = { googleTrends: 0, github: 0, hackerNews: 0, reddit: 0, npm: 0 };
        }
      });

      await Promise.all(fetchPromises);

      const allTools = updatedTools.sort((a, b) => b.trendScore - a.trendScore);

      return new Response(JSON.stringify(allTools), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "X-Data-Source": "Cloudflare D1 Direct Worker Router (No-Cache)"
        }
      });
    }

    // 静的ファイルアクセスのキャッシュ無効化ヘッダーを注入
    const assetRes = await env.ASSETS.fetch(request);
    const newHeaders = new Headers(assetRes.headers);
    newHeaders.set("Cache-Control", "no-cache, no-store, must-revalidate");

    return new Response(assetRes.body, {
      status: assetRes.status,
      statusText: assetRes.statusText,
      headers: newHeaders
    });
  }
};
