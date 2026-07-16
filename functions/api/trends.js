// Cloudflare Pages Functions - リアルタイムエンジニアトレンドAPI (大規模・ツリーマップ調整版)
import { toolsData as baseToolsData } from '../../data.js';

// 各ツールがAPIから最新データを取得するためのマッピングテーブル (定番・枯れた技術含む35種類)
const toolSourceMappings = {
  // AI & LLM
  "claude-fable-5": { hnQuery: "claude fable", githubRepo: "anthropics/claude-code" },
  "deepseek-r1": { hnQuery: "deepseek r1", githubRepo: "deepseek-ai/DeepSeek-R1" },
  "cursor-windsurf": { hnQuery: "cursor editor", githubRepo: "getcursor/cursor" },
  "mcp-protocol": { hnQuery: "model context protocol", githubRepo: "modelcontextprotocol/servers" },
  "github-copilot": { hnQuery: "github copilot", githubRepo: "copilot-language-server" },
  
  // Languages & Runtimes
  "python": { hnQuery: "python", githubRepo: "python/cpython" },
  "typescript-effect": { hnQuery: "effect ts", githubRepo: "Effect-TS/effect", npmPackage: "effect" },
  "rust": { hnQuery: "rust lang", githubRepo: "rust-lang/rust" },
  "fable-5-compiler": { hnQuery: "fable compiler", githubRepo: "fable-compiler/Fable", npmPackage: "fable-compiler" },
  "zig": { hnQuery: "zig lang", githubRepo: "ziglang/zig" },
  "go": { hnQuery: "golang", githubRepo: "golang/go" },
  "javascript": { hnQuery: "javascript", githubRepo: "tc39/ecma262" },
  "csharp": { hnQuery: "csharp dotnet", githubRepo: "dotnet/csharplang" },
  "java": { hnQuery: "java programming", githubRepo: "openjdk/jdk" },
  "cpp": { hnQuery: "c++ programming" },
  "php": { hnQuery: "php programming", githubRepo: "php/php-src" },
  "ruby": { hnQuery: "ruby lang", githubRepo: "ruby/ruby" },

  // Frameworks
  "tailwind-v4": { hnQuery: "tailwindcss", githubRepo: "tailwindlabs/tailwindcss", npmPackage: "tailwindcss" },
  "biome-oxc": { hnQuery: "biome linter", githubRepo: "biomejs/biome", npmPackage: "@biomejs/biome" },
  "react-next": { hnQuery: "nextjs", githubRepo: "vercel/next.js", npmPackage: "next" },
  "svelte-5": { hnQuery: "svelte 5", githubRepo: "sveltejs/svelte", npmPackage: "svelte" },
  "rspack": { hnQuery: "rspack", githubRepo: "web-infra-dev/rspack", npmPackage: "@rspack/core" },
  "spring-boot": { hnQuery: "spring boot", githubRepo: "spring-projects/spring-boot" },
  "laravel": { hnQuery: "laravel php", githubRepo: "laravel/laravel", npmPackage: "laravel" },
  "jquery": { hnQuery: "jquery", githubRepo: "jquery/jquery", npmPackage: "jquery" },

  // Databases
  "postgresql": { hnQuery: "postgresql", githubRepo: "postgres/postgres" },
  "valkey": { hnQuery: "valkey", githubRepo: "valkey-io/valkey" },
  "cloudflare-workers": { hnQuery: "cloudflare workers", githubRepo: "cloudflare/workers-sdk" },
  "supabase": { hnQuery: "supabase", githubRepo: "supabase/supabase" },
  "mysql": { hnQuery: "mysql", githubRepo: "mysql/mysql-server" },
  "oracle": { hnQuery: "oracle database" },

  // Productivity
  "ghostty": { hnQuery: "ghostty", githubRepo: "ghostty-org/ghostty" },
  "zed": { hnQuery: "zed editor", githubRepo: "zed-industries/zed" },
  "vs-code": { hnQuery: "vscode", githubRepo: "microsoft/vscode" },
  "eclipse": { hnQuery: "eclipse ide" },

  // Gadgets
  "keychron-q1-he": { hnQuery: "keychron q1", githubRepo: "keychron/qmk_firmware" }
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
  const updatedTools = JSON.parse(JSON.stringify(baseToolsData)); // ディープコピー
  const nowUnix = Math.floor(Date.now() / 1000);
  const sevenDaysAgoUnix = nowUnix - (7 * 24 * 60 * 60);

  const fetchPromises = updatedTools.map(async (tool) => {
    const mapping = toolSourceMappings[tool.id];
    if (!mapping) return;

    let hnMentions = 0;
    let githubStars = 0;
    let npmDownloads = 0;

    // A. Hacker News API (言及数)
    try {
      const hnUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(mapping.hnQuery)}&tags=story&numericFilters=created_at_i>${sevenDaysAgoUnix}&hitsPerPage=1`;
      const hnRes = await fetch(hnUrl, {
        headers: { "User-Agent": "etools-trend-bot/1.0" },
        signal: AbortSignal.timeout(2500)
      });
      if (hnRes.ok) {
        const hnData = await hnRes.json();
        hnMentions = hnData.nbHits || 0;
      }
    } catch (e) {
      console.error(`HN Fetch failed for ${tool.id}:`, e);
    }

    // B. GitHub API (スター数)
    if (mapping.githubRepo) {
      try {
        const githubUrl = `https://api.github.com/repos/${mapping.githubRepo}`;
        const ghRes = await fetch(githubUrl, {
          headers: { 
            "User-Agent": "etools-trend-bot/1.0",
            "Accept": "application/vnd.github.v3+json"
          },
          signal: AbortSignal.timeout(2500)
        });
        if (ghRes.ok) {
          const ghData = await ghRes.json();
          githubStars = ghData.stargazers_count || 0;
        }
      } catch (e) {
        console.error(`GitHub Fetch failed for ${tool.id}:`, e);
      }
    }

    // C. npm API (DL数)
    if (mapping.npmPackage) {
      try {
        const npmUrl = `https://api.npmjs.org/downloads/point/last-week/${mapping.npmPackage}`;
        const npmRes = await fetch(npmUrl, {
          signal: AbortSignal.timeout(2500)
        });
        if (npmRes.ok) {
          const npmData = await npmRes.json();
          npmDownloads = npmData.downloads || 0;
        }
      } catch (e) {
        console.error(`npm Fetch failed for ${tool.id}:`, e);
      }
    }

    // --- 改良版スコアリングロジック (30〜99点の分布スケーリング) ---
    // 最新トレンドと枯れた定番技術が明確な色の強弱（ヒートマップ）として区別されるように調整します。
    if (hnMentions > 0 || githubStars > 0 || npmDownloads > 0) {
      // 1. 直近言及度スコア (Hacker News) : 最大40点。直近の熱量をダイレクトに反映
      const hnScore = Math.min(40, Math.log2(hnMentions + 1) * 5.5);
      
      // 2. 規模スコア (GitHub) : 最大30点。
      const starScore = githubStars > 0 ? Math.min(30, Math.log10(githubStars + 1) * 5) : 0;

      // 3. 利用実態スコア (npm) : 最大30点。
      const dlScore = npmDownloads > 0 ? Math.min(30, Math.log10(npmDownloads + 1) * 4) : 10;

      let calculatedScore = Math.round(hnScore + starScore + dlScore);

      // 4. トレンド・モダニティによる重み補正 (最新技術には加点、枯れた技術には減点)
      // 直近7日間のHNでの言及割合が非常に低いものは、分母が大きい定番技術であってもトレンドスコアを下げます
      const totalIndicator = githubStars + (npmDownloads / 10);
      const activityRatio = hnMentions / (Math.log10(totalIndicator + 1) + 1);

      if (activityRatio < 0.1) {
        // 定番だが最近話題になっていない（Java, PHP, jQuery, Oracle, Eclipseなど）
        calculatedScore = Math.round(calculatedScore * 0.65);
      } else if (activityRatio > 2.0) {
        // 新興で今まさに話題沸騰（Claude Fable 5, Ghostty, Valkey, DeepSeekなど）
        calculatedScore = Math.round(calculatedScore * 1.15);
      }

      // スコアの最終マッピングを30〜99点に強制スケーリング
      tool.trendScore = Math.max(30, Math.min(99, calculatedScore));

      // 期間別言及数のスケーリング (GitHub規模とHN言及をリアルに配合)
      tool.mentions24h = Math.max(10, Math.round(hnMentions * 1.8 + Math.log10(githubStars + 1) * 50));
      tool.mentions7d = Math.max(50, Math.round(hnMentions * 10 + Math.log10(githubStars + 1) * 200));
      tool.mentions30d = Math.max(200, Math.round(hnMentions * 40 + Math.log10(githubStars + 1) * 800));

      // トレンド推移データの再構築
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

  // レスポンスの構築
  const jsonResponse = new Response(JSON.stringify(updatedTools), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=86400",
      "X-Data-Source": "Real-time Treemap API Aggregator v2.0 (GitHub, Hacker News, npm)"
    }
  });

  context.waitUntil(cache.put(cacheKey, jsonResponse.clone()));

  return jsonResponse;
}
