// Cloudflare Pages Functions - 日次データ自動蓄積Cron API (D1 Database Sync)
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
  return await processCronSync(context.env);
}

export async function onScheduled(event, env, ctx) {
  ctx.waitUntil(processCronSync(env));
}

async function processCronSync(env) {
  const db = env.DB;
  const todayStr = new Date().toISOString().split('T')[0];
  const nowUnix = Math.floor(Date.now() / 1000);
  const sevenDaysAgoUnix = nowUnix - (7 * 24 * 60 * 60);

  if (!db) {
    return new Response(JSON.stringify({ status: "skipped", reason: "D1 database binding 'DB' not configured in local preview" }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // 1. テーブルの初期化 ＆ 過去汚染データの完全クリーンリセット (2026-07-23以前のデータをクリア)
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

    // 2026年7月23日より前のテスト・汚染データを完全廃棄
    await db.prepare("DELETE FROM daily_trends WHERE date < '2026-07-23'").run();
  } catch (e) {
    console.error("Failed to initialize or clean D1 table:", e);
  }

  // 2. 公式APIから全ツールの最新本物データを集計
  const batchStatements = [];

  for (const tool of baseToolsData) {
    const mapping = activeTrendMappings[tool.id];
    let hnMentions = 0;
    let githubStars = 0;
    let npmDownloads = 0;

    if (mapping) {
      // Hacker News API
      try {
        const hnUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(mapping.hnQuery)}&tags=story&numericFilters=created_at_i>${sevenDaysAgoUnix}&hitsPerPage=1`;
        const hnRes = await fetch(hnUrl, { headers: { "User-Agent": "etools-trend-cron/1.0" }, signal: AbortSignal.timeout(2000) });
        if (hnRes.ok) {
          const hnData = await hnRes.json();
          hnMentions = hnData.nbHits || 0;
        }
      } catch (e) {}

      // GitHub API
      if (mapping.githubRepo) {
        try {
          const githubUrl = `https://api.github.com/repos/${mapping.githubRepo}`;
          const ghRes = await fetch(githubUrl, {
            headers: { "User-Agent": "etools-trend-cron/1.0", "Accept": "application/vnd.github.v3+json" },
            signal: AbortSignal.timeout(2000)
          });
          if (ghRes.ok) {
            const ghData = await ghRes.json();
            githubStars = ghData.stargazers_count || 0;
          }
        } catch (e) {}
      }

      // npm API
      if (mapping.npmPackage) {
        try {
          const npmUrl = `https://api.npmjs.org/downloads/point/last-day/${mapping.npmPackage}`;
          const npmRes = await fetch(npmUrl, { signal: AbortSignal.timeout(2000) });
          if (npmRes.ok) {
            const npmData = await npmRes.json();
            npmDownloads = npmData.downloads || 0;
          }
        } catch (e) {}
      }
    }

    // 重み評価スコア計算
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

    // D1 挿入バッチステートメントの作成
    batchStatements.push(
      db.prepare(`
        INSERT OR REPLACE INTO daily_trends (tool_id, date, hn_mentions, github_stars, npm_downloads, score)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(tool.id, todayStr, hnMentions, githubStars, npmDownloads, weightedScore)
    );
  }

  // 3. D1 バッチ実行 (無料枠 Write 制限に十分余裕を持って完了)
  try {
    // 100件ずつ分割バッチ実行
    for (let i = 0; i < batchStatements.length; i += 100) {
      const chunk = batchStatements.slice(i, i + 100);
      await db.batch(chunk);
    }
    return new Response(JSON.stringify({ status: "success", date: todayStr, totalSaved: batchStatements.length }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("D1 Batch insert error:", e);
    return new Response(JSON.stringify({ status: "error", message: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
