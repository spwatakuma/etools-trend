import { categories, toolsData as baseToolsData } from './data.js?v=20260723_v3';

// --- アプリケーションの状態管理 (State) ---
let currentCategory = 'all';
let currentTimeFilter = '24h';
let searchQuery = '';
let selectedToolId = null;
let activeToolsData = []; // APIから取得したアクティブなデータ

// --- DOM要素の参照 ---
const categorySelect = document.getElementById('categorySelect');
const toolSearchInput = document.getElementById('toolSearchInput');
const timeFilters = document.getElementById('timeFilters');
const heatmapGrid = document.getElementById('heatmapGrid');
const panelCategoryTitle = document.getElementById('panelCategoryTitle');
const gadgetsGrid = document.getElementById('gadgetsGrid');

// 詳細パネルのDOM
const detailName = document.getElementById('detailName');
const detailCategory = document.getElementById('detailCategory');
const detailDesc = document.getElementById('detailDesc');
const trendChart = document.getElementById('trendChart');
const trendMomentumBadge = document.getElementById('trendMomentumBadge');
const chartContainer = document.getElementById('chartContainer');
const chartHoverTooltip = document.getElementById('chartHoverTooltip');
const statMentions = document.getElementById('statMentions');
const statRank = document.getElementById('statRank');
const statScore = document.getElementById('statScore');
const tooltip = document.getElementById('tooltip');

// --- アプリの初期化 (Init) ---
async function init() {
  setupEventListeners();
  
  // 1. Cloudflare Pages Functions / Worker APIからリアルタイムデータを取得
  try {
    const response = await fetch(`/api/trends?t=${Date.now()}`, { 
      cache: 'no-store',
      signal: AbortSignal.timeout(5000) 
    });
    if (response.ok) {
      activeToolsData = await response.json();
      console.log('Successfully fetched real-time trends from Cloudflare Pages Functions.');
    } else {
      throw new Error(`API error HTTP ${response.status}`);
    }
  } catch (error) {
    console.error('API fetch error:', error);
    activeToolsData = baseToolsData;
  }

  // 2. レンダリングの実行
  renderHeatmap();
  renderGadgets();
  
  // 初期表示として最もトレンドスコアの高いツールを選択状態にする
  const initialTool = [...activeToolsData]
    .sort((a, b) => b.trendScore - a.trendScore)[0];
  if (initialTool) {
    selectTool(initialTool.id);
  }

  // ウィンドウ幅が変更されたときのツリーマップ再レイアウト (レスポンシブ調整)
  window.addEventListener('resize', debounce(() => {
    renderHeatmap();
  }, 250));
}

// デバウンス関数 (リサイズイベントや検索入力の間引き用)
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// --- イベントリスナーの設定 ---
function setupEventListeners() {
  // カテゴリドロップダウン切り替え
  categorySelect.addEventListener('change', (e) => {
    currentCategory = e.target.value;
    renderHeatmap();
    renderGadgets(); // ガジェットアフィリエイト枠もカテゴリで絞り込む
  });

  // ツール名検索フィルター
  toolSearchInput.addEventListener('input', debounce((e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    renderHeatmap();
    renderGadgets();
  }, 150));

  // 期間フィルター切り替え
  timeFilters.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    
    timeFilters.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    currentTimeFilter = btn.dataset.time;
    renderHeatmap();
    
    // 現在選択されているツールのスタッツも再計算
    if (selectedToolId) {
      selectTool(selectedToolId);
    }
  });
}

// --- ツリーマップの再帰レイアウトアルゴリズム (Slice-and-Dice) ---
function layoutTreemap(items, x, y, width, height, vertical) {
  if (items.length === 0) return;
  
  if (items.length === 1) {
    items[0].x = x;
    items[0].y = y;
    items[0].w = width;
    items[0].h = height;
    return;
  }
  
  const totalValue = items.reduce((sum, item) => sum + item.treemapValue, 0);
  if (totalValue === 0) {
    items.forEach((item) => {
      item.treemapValue = 1;
    });
    layoutTreemap(items, x, y, width, height, vertical);
    return;
  }
  
  let currentSum = 0;
  let splitIndex = 0;
  for (let i = 0; i < items.length; i++) {
    currentSum += items[i].treemapValue;
    if (currentSum >= totalValue / 2 || i === items.length - 2) {
      splitIndex = i + 1;
      break;
    }
  }
  
  const part1 = items.slice(0, splitIndex);
  const part2 = items.slice(splitIndex);
  const part1Value = part1.reduce((sum, item) => sum + item.treemapValue, 0);
  const ratio = part1Value / totalValue;
  
  if (vertical) {
    const w1 = width * ratio;
    layoutTreemap(part1, x, y, w1, height, !vertical);
    layoutTreemap(part2, x + w1, y, width - w1, height, !vertical);
  } else {
    const h1 = height * ratio;
    layoutTreemap(part1, x, y, width, h1, !vertical);
    layoutTreemap(part2, x, y + h1, width, height - h1, !vertical);
  }
}

// --- 赤緑モメンタム (前週比変化率%) によるカラー強度判定 ---
function getMomentumIntensityClass(changePercent) {
  const change = changePercent || 0;
  if (change >= 15)  return 'intensity-up-4';   // 濃い緑
  if (change >= 5)   return 'intensity-up-2';   // 緑
  if (change >= 1)   return 'intensity-up-1';   // 薄い緑
  if (change >= -1)  return 'intensity-neutral';// グレー
  if (change >= -5)  return 'intensity-down-1'; // 薄い赤
  if (change >= -15) return 'intensity-down-2'; // 赤
  return 'intensity-down-4';                    // 濃い赤
}

// --- ヒートマップ (ツリーマップ) のレンダリング (大容量データ描画パフォーマンス最適化版) ---
function renderHeatmap() {
  let filtered = [...activeToolsData];
  
  // 1. カテゴリ絞り込み (✨ 自動検出トレンド への切り替え対応)
  if (currentCategory === 'dynamic_discovered') {
    filtered = filtered.filter(tool => tool.isDynamic);
  } else if (currentCategory !== 'all') {
    filtered = filtered.filter(tool => tool.category === currentCategory);
  }

  // 2. 検索キーワード絞り込み
  if (searchQuery) {
    filtered = filtered.filter(tool => 
      tool.name.toLowerCase().includes(searchQuery) ||
      (tool.description && tool.description.toLowerCase().includes(searchQuery))
    );
  }

  const mentionsKey = getMentionsKey();
  
  filtered.forEach(tool => {
    tool.treemapValue = tool[mentionsKey] || 10;
  });

  filtered.sort((a, b) => b.treemapValue - a.treemapValue);

  heatmapGrid.innerHTML = '';
  heatmapGrid.style.position = 'relative';
  heatmapGrid.style.height = '480px'; 
  heatmapGrid.style.width = '100%';

  if (filtered.length === 0) {
    heatmapGrid.innerHTML = '<p style="position: absolute; width:100%; top: 40%; text-align: center; color: var(--text-muted);">該当するツールが見つかりません。</p>';
    return;
  }

  layoutTreemap(filtered, 0, 0, 100, 100, true);

  // 高速 DOM 描画用 Fragment
  const fragment = document.createDocumentFragment();

  filtered.forEach(tool => {
    // 描画領域が極めて小さすぎるセルの計算負荷を軽減
    if (tool.w < 1.5 && tool.h < 1.5) return;

    const cell = document.createElement('div');
    const intensity = getMomentumIntensityClass(tool.changePercent);
    cell.className = `heatmap-cell ${intensity}`;
    cell.dataset.id = tool.id;
    
    cell.style.position = 'absolute';
    cell.style.left = `${tool.x}%`;
    cell.style.top = `${tool.y}%`;
    cell.style.width = `${tool.w}%`;
    cell.style.height = `${tool.h}%`;
    cell.style.border = '1px solid var(--border-light)';
    cell.style.boxSizing = 'border-box';
    
    if (tool.id === selectedToolId) {
      cell.style.outline = '2.5px solid #3b82f6';
      cell.style.outlineOffset = '-2.5px';
      cell.style.zIndex = '5';
    }

    const mentions = (tool[mentionsKey] || 0).toLocaleString();
    const changeText = tool.changePercent > 0 ? `+${tool.changePercent}%` : `${tool.changePercent}%`;

    const isSmall = tool.w < 12 || tool.h < 12;
    const isTiny = tool.w < 7 || tool.h < 7;

    const prefix = tool.isAffiliate ? '🛒 ' : tool.isDynamic ? '✨ ' : '';

    if (isTiny) {
      cell.innerHTML = `
        <span class="cell-name" style="font-size: 0.65rem; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; display: block;">${prefix || tool.name[0]}</span>
      `;
    } else if (isSmall) {
      cell.innerHTML = `
        <span class="cell-name" style="font-size: 0.7rem; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; display: block;">${prefix}${tool.name}</span>
      `;
    } else {
      const dynamicBadge = tool.isDynamic ? '<span style="font-size:0.6rem; background:#8b5cf6; color:#fff; padding:1px 4px; border-radius:3px; margin-left:3px;">NEW</span>' : '';
      cell.innerHTML = `
        <span class="cell-name">${prefix}${tool.name}${dynamicBadge}</span>
        <span class="cell-score" style="font-size: 0.9rem;">${changeText}</span>
      `;
    }

    // クリックイベント
    cell.addEventListener('click', () => selectTool(tool.id));

    // ツールチップ用ホバーイベント
    cell.addEventListener('mouseenter', (e) => {
      tooltip.style.opacity = '1';
      const typeStr = tool.isAffiliate ? '（ガジェット・パーツ）' : tool.isDynamic ? '（✨ 自動検知最新トレンド）' : '';
      tooltip.innerHTML = `<strong>${tool.name} ${typeStr}</strong><br>本日実測言及数: <strong>${mentions} 件</strong> (7/23スタート)<br>前週比モメンタム: <strong>${changeText}</strong>`;
      positionTooltip(e);
    });

    cell.addEventListener('mousemove', (e) => {
      positionTooltip(e);
    });

    cell.addEventListener('mouseleave', () => {
      tooltip.style.opacity = '0';
    });

    fragment.appendChild(cell);
  });

  heatmapGrid.appendChild(fragment);

  // タイトルの更新
  const catName = currentCategory === 'all' ? 'すべてのITカテゴリ (500+)' : currentCategory === 'dynamic_discovered' ? '✨ 自動検出された最新トレンド (New Discovered)' : (categories[currentCategory] || currentCategory);
  panelCategoryTitle.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 0.5rem; vertical-align: middle;"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>
    ${catName} の勢いヒートマップ
  `;
}

// 期間設定から言及データキーを取得
function getMentionsKey() {
  if (currentTimeFilter === '24h') return 'mentions24h';
  if (currentTimeFilter === '7d') return 'mentions7d';
  return 'mentions30d';
}

// ツールチップの座標計算
function positionTooltip(e) {
  const tooltipWidth = tooltip.offsetWidth;
  const tooltipHeight = tooltip.offsetHeight;
  tooltip.style.left = `${e.pageX - tooltipWidth / 2}px`;
  tooltip.style.top = `${e.pageY - tooltipHeight - 12}px`;
}

// --- ツール選択時の処理 (詳細パネル更新) ---
function selectTool(id) {
  selectedToolId = id;
  const tool = activeToolsData.find(t => t.id === id);
  if (!tool) return;

  // ヒートマップのセルの選択枠をクリアして再設定
  document.querySelectorAll('.heatmap-cell').forEach(cell => {
    cell.style.outline = 'none';
    if (cell.dataset.id === id) {
      cell.style.outline = '2.5px solid #3b82f6';
      cell.style.outlineOffset = '-2.5px';
      cell.style.zIndex = '5';
    }
  });

  // テキストの更新
  detailName.innerText = tool.name;
  detailCategory.innerText = categories[tool.category] || tool.category;
  detailDesc.innerText = tool.description;

  const key = getMentionsKey();
  statMentions.innerText = `${(tool[key] || 0).toLocaleString()} 件`;
  statScore.innerText = `${tool.trendScore}/100`;

  // 順位の算出
  const sortedTools = [...activeToolsData]
    .sort((a, b) => b[key] - a[key]);
  const rank = sortedTools.findIndex(t => t.id === id) + 1;
  statRank.innerText = `#${rank}`;

  // 前週比モメンタムバッジの描画
  const change = tool.changePercent || 0;
  if (change > 0) {
    trendMomentumBadge.className = 'momentum-badge up';
    trendMomentumBadge.innerText = `前週比 +${change}% 📈`;
  } else if (change < 0) {
    trendMomentumBadge.className = 'momentum-badge down';
    trendMomentumBadge.innerText = `前週比 ${change}% 📉`;
  } else {
    trendMomentumBadge.className = 'momentum-badge neutral';
    trendMomentumBadge.innerText = `前週比 0.0% ➖`;
  }

  // インタラクティブSVG折れ線グラフの描画
  renderSVGChart(tool);

  // 外部リンク・アフィリエイトリンクボタンの更新
  const detailLink = document.getElementById('detailLink');
  if (tool.url) {
    detailLink.href = tool.url;
    detailLink.style.display = 'flex';
    detailLink.innerHTML = tool.isAffiliate ? `
      <svg class="amazon-icon" fill="currentColor" viewBox="0 0 24 24" width="14" height="14" style="margin-right: 0.25rem;"><path d="M17.2 12.3c-.6 0-1 .4-1 1s.4 1 1 1 1-.4 1-1-.4-1-1-1zm3.8-3.4c-.4-.4-1-.4-1.4 0l-1 1c-.4.4-.4 1 0 1.4.4.4 1 .4 1.4 0l1-1c.4-.4.4-1 0-1.4zm-13.8 0l-1 1c-.4.4-.4 1 0 1.4.4.4 1 .4 1.4 0l1-1c.4-.4.4-1 0-1.4-.4-.4-1-.4-1.4 0zm3.8 3.4c-.6 0-1 .4-1 1s.4 1 1 1 1-.4 1-1-.4-1-1-1zm1 5.9c-.3.3-.3.8 0 1.1l1 1c.3.3.8.3 1.1 0 .3-.3.3-.8 0-1.1l-1-1c-.3-.3-.8-.3-1.1 0zm7-1.1l-1 1c-.3.3-.3.8 0 1.1.3.3.8.3 1.1 0l1-1c.3-.3.3-.8 0-1.1-.3-.3-.8-.3-1.1 0zm-3-2.1c-.6 0-1 .4-1 1s.4 1 1 1 1-.4 1-1-.4-1-1-1zM12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8zm0-10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
      Amazonで詳細を見る
    ` : `
      公式サイトを見る ↗
    `;
  } else {
    detailLink.style.display = 'none';
  }

  // データソース別評価重み内訳の描画
  renderSourceWeights(tool);
}

// データソース別重み評価内訳バーの描画
function renderSourceWeights(tool) {
  const sourceWeightsBar = document.getElementById('sourceWeightsBar');
  if (!sourceWeightsBar) return;

  const wb = tool.weightedBreakdown || {
    googleTrends: Math.round(tool.trendScore * 0.30),
    github:       Math.round(tool.trendScore * 0.25),
    hackerNews:   Math.round(tool.trendScore * 0.20),
    reddit:       Math.round(tool.trendScore * 0.15),
    npm:          Math.round(tool.trendScore * 0.10)
  };

  const sources = [
    { name: 'Google 検索', weight: '30%', cls: 'google', score: wb.googleTrends, max: 30 },
    { name: 'GitHub API',  weight: '25%', cls: 'github', score: wb.github,       max: 25 },
    { name: 'Hacker News', weight: '20%', cls: 'hn',     score: wb.hackerNews,   max: 20 },
    { name: 'Reddit コミュニティ', weight: '15%', cls: 'reddit', score: wb.reddit, max: 15 },
    { name: 'npm / 実稼働', weight: '10%', cls: 'npm',    score: wb.npm,          max: 10 }
  ];

  sourceWeightsBar.innerHTML = sources.map(s => {
    const pct = Math.min(100, Math.round((s.score / s.max) * 100));
    return `
      <div class="weight-row">
        <span class="weight-name">${s.name} (${s.weight})</span>
        <div class="weight-track">
          <div class="weight-fill ${s.cls}" style="width: ${pct}%"></div>
        </div>
        <span class="weight-val">${s.score}pt</span>
      </div>
    `;
  }).join('');
}

// --- インタラクティブSVG折れ線グラフの描画 (本物生データ優先バインド版) ---
function renderSVGChart(tool) {
  const mentionsKey = getMentionsKey();
  const totalMentions = tool[mentionsKey] || 100;
  const change = tool.changePercent || 0;
  const today = new Date();
  const weekDays = ['日', '月', '火', '水', '木', '金', '土'];

  let data = [];
  let timeLabels = [];

  // A. Cloudflare D1 データベースからの本物日次自動蓄積データ (d1DailyHistory) が存在する場合
  if (tool.d1DailyHistory && Array.isArray(tool.d1DailyHistory) && tool.d1DailyHistory.length > 0) {
    const rawList = tool.d1DailyHistory;
    const targetSlice = currentTimeFilter === '24h' ? rawList.slice(-8) : currentTimeFilter === '7d' ? rawList.slice(-7) : rawList.slice(-30);
    
    data = targetSlice.map(item => item.score || item.github_stars || item.hn_mentions || 10);
    timeLabels = targetSlice.map(item => {
      const d = new Date(item.date);
      const m = d.getMonth() + 1;
      const date = d.getDate();
      const dayName = weekDays[d.getDay()];
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      return { label: `${m}/${date}(${dayName})`, isWeekend };
    });
  } 
  // B. APIから100%本物の過去日別生データ (realDailyData) が取得できている場合
  else if (tool.realDailyData && Array.isArray(tool.realDailyData) && tool.realDailyData.length > 0) {
    const rawList = tool.realDailyData;
    const targetSlice = currentTimeFilter === '24h' ? rawList.slice(-8) : currentTimeFilter === '7d' ? rawList.slice(-7) : rawList.slice(-30);
    
    data = targetSlice.map(item => item.count);
    timeLabels = targetSlice.map(item => {
      const d = new Date(item.date);
      const m = d.getMonth() + 1;
      const date = d.getDate();
      const dayName = weekDays[d.getDay()];
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      return { label: `${m}/${date}(${dayName})`, isWeekend };
    });
  } else {
    // C. 2026年7月23日集計スタート (Day 1 本日からのクリーン実測プロット)
    const m = today.getMonth() + 1;
    const date = today.getDate();
    const dayName = weekDays[today.getDay()];
    const isWeekend = today.getDay() === 0 || today.getDay() === 6;

    data = [tool.trendScore || 50];
    timeLabels = [{ label: `${m}/${date}(${dayName}) 本日スタート`, isWeekend }];
  }

  const width = trendChart.clientWidth || 320;
  const height = 160;
  const paddingLeft = 45;
  const paddingRight = 15;
  const paddingTop = 15;
  const paddingBottom = 22;

  trendChart.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  const valRange = maxVal - minVal || 1;

  const getX = (idx) => paddingLeft + (idx / (data.length - 1)) * (width - paddingLeft - paddingRight);
  const getY = (val) => height - paddingBottom - ((val - minVal) / valRange) * (height - paddingTop - paddingBottom);

  let linePath = '';
  let areaPath = '';

  const points = data.map((val, idx) => {
    const x = getX(idx);
    const y = getY(val);
    if (idx === 0) {
      linePath = `M ${x} ${y}`;
      areaPath = `M ${x} ${height - paddingBottom} L ${x} ${y}`;
    } else {
      linePath += ` L ${x} ${y}`;
      areaPath += ` L ${x} ${y}`;
    }
    
    const timeInfo = timeLabels[idx];
    const displayLabel = typeof timeInfo === 'object' ? timeInfo.label : timeInfo;
    const isWeekend = typeof timeInfo === 'object' ? timeInfo.isWeekend : false;
    return { x, y, val, displayLabel, isWeekend };
  });

  areaPath += ` L ${getX(data.length - 1)} ${height - paddingBottom} Z`;

  const lineColorClass = change > 0 ? 'up' : change < 0 ? 'down' : '';
  const areaColor = change > 0 ? '#10b981' : change < 0 ? '#ef4444' : '#3b82f6';
  const midVal = Math.round((maxVal + minVal) / 2);

  let svgContent = `
    <defs>
      <linearGradient id="chart-grad-${selectedToolId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${areaColor}" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="${areaColor}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <!-- Y軸数値ラベル (縦軸: 新規件数) -->
    <text class="chart-text" x="${paddingLeft - 6}" y="${paddingTop + 4}" text-anchor="end" font-weight="600" fill="var(--text-secondary)">${maxVal.toLocaleString()}</text>
    <text class="chart-text" x="${paddingLeft - 6}" y="${(height - paddingBottom + paddingTop) / 2 + 3}" text-anchor="end" fill="var(--text-muted)">${midVal.toLocaleString()}</text>
    <text class="chart-text" x="${paddingLeft - 6}" y="${height - paddingBottom}" text-anchor="end" fill="var(--text-muted)">${minVal.toLocaleString()}</text>

    <!-- 背景ガイド線 -->
    <line class="chart-axis" x1="${paddingLeft}" y1="${paddingTop}" x2="${width - paddingRight}" y2="${paddingTop}" />
    <line class="chart-axis" x1="${paddingLeft}" y1="${(height - paddingBottom + paddingTop) / 2}" x2="${width - paddingRight}" y2="${(height - paddingBottom + paddingTop) / 2}" />
    <line class="chart-axis" x1="${paddingLeft}" y1="${height - paddingBottom}" x2="${width - paddingRight}" y2="${height - paddingBottom}" />

    <!-- Y軸・X軸の軸線 -->
    <line stroke="var(--border-medium)" stroke-width="1" x1="${paddingLeft}" y1="${paddingTop}" x2="${paddingLeft}" y2="${height - paddingBottom}" />
    <line stroke="var(--border-medium)" stroke-width="1" x1="${paddingLeft}" y1="${height - paddingBottom}" x2="${width - paddingRight}" y2="${height - paddingBottom}" />

    <!-- グラフ塗りつぶしエリア -->
    <path class="chart-area" d="${areaPath}" fill="url(#chart-grad-${selectedToolId})" />
    <!-- 折れ線 -->
    <path class="chart-line ${lineColorClass}" d="${linePath}" />
  `;

  // データポイントのプロット
  points.forEach((p, idx) => {
    svgContent += `
      <circle class="chart-dots" cx="${p.x}" cy="${p.y}" r="4.5" fill="${areaColor}" data-idx="${idx}"></circle>
    `;
  });

  // X軸ラベル (最初・中間・最新)
  const startLabel = points[0].displayLabel;
  const midLabel = points[Math.floor(points.length / 2)].displayLabel;
  const endLabel = points[points.length - 1].displayLabel;

  svgContent += `
    <text class="chart-text" x="${paddingLeft}" y="${height - 2}" text-anchor="start">${startLabel}</text>
    <text class="chart-text" x="${(width + paddingLeft - paddingRight) / 2}" y="${height - 2}" text-anchor="middle">${midLabel}</text>
    <text class="chart-text" x="${width - paddingRight}" y="${height - 2}" text-anchor="end">${endLabel}</text>
  `;

  trendChart.innerHTML = svgContent;

  // データポイントホバーで正確な数値ポップアップ
  const dots = trendChart.querySelectorAll('.chart-dots');
  dots.forEach(dot => {
    dot.addEventListener('mouseenter', () => {
      const idx = dot.dataset.idx;
      const p = points[idx];
      chartHoverTooltip.style.display = 'block';
      chartHoverTooltip.style.left = `${(p.x / width) * 100}%`;
      chartHoverTooltip.style.top = `${p.y - 12}px`;
      chartHoverTooltip.innerHTML = `<strong>${p.displayLabel}</strong><br>新規発生: <strong>${p.val.toLocaleString()}</strong> 件`;
    });

    dot.addEventListener('mouseleave', () => {
      chartHoverTooltip.style.display = 'none';
    });
  });
}

// --- ガジェット・ハードウェアアフィリエイトのレンダリング ---
function renderGadgets() {
  let gadgets = activeToolsData.filter(tool => tool.isAffiliate);

  if (currentCategory !== 'all') {
    gadgets = gadgets.filter(g => g.category === currentCategory);
  }

  if (searchQuery) {
    gadgets = gadgets.filter(g => 
      g.name.toLowerCase().includes(searchQuery) ||
      (g.description && g.description.toLowerCase().includes(searchQuery))
    );
  }

  gadgetsGrid.innerHTML = '';

  if (gadgets.length === 0) {
    gadgetsGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">条件に一致する紹介ガジェット・パーツがありません。</p>';
    return;
  }

  gadgets.forEach(gadget => {
    const card = document.createElement('article');
    card.className = 'gadget-card';

    card.innerHTML = `
      <div class="gadget-image-container">
        <img class="gadget-img" src="${gadget.imageName}" alt="${gadget.name}" referrerpolicy="no-referrer" loading="lazy">
      </div>
      <div class="gadget-info">
        <div>
          <div class="gadget-header">
            <h3 class="gadget-name">${gadget.name}</h3>
            <span class="gadget-price">${gadget.affiliatePrice}</span>
          </div>
          <p class="gadget-desc">${gadget.description}</p>
        </div>
        <a class="affiliate-btn" href="${gadget.url}" target="_blank" rel="noopener noreferrer">
          <svg class="amazon-icon" fill="currentColor" viewBox="0 0 24 24" width="16" height="16"><path d="M17.2 12.3c-.6 0-1 .4-1 1s.4 1 1 1 1-.4 1-1-.4-1-1-1zm3.8-3.4c-.4-.4-1-.4-1.4 0l-1 1c-.4.4-.4 1 0 1.4.4.4 1 .4 1.4 0l1-1c.4-.4.4-1 0-1.4zm-13.8 0l-1 1c-.4.4-.4 1 0 1.4.4.4 1 .4 1.4 0l1-1c.4-.4.4-1 0-1.4-.4-.4-1-.4-1.4 0zm3.8 3.4c-.6 0-1 .4-1 1s.4 1 1 1 1-.4 1-1-.4-1-1-1zm1 5.9c-.3.3-.3.8 0 1.1l1 1c.3.3.8.3 1.1 0 .3-.3.3-.8 0-1.1l-1-1c-.3-.3-.8-.3-1.1 0zm7-1.1l-1 1c-.3.3-.3.8 0 1.1.3.3.8.3 1.1 0l1-1c.3-.3.3-.8 0-1.1-.3-.3-.8-.3-1.1 0zm-3-2.1c-.6 0-1 .4-1 1s.4 1 1 1 1-.4 1-1-.4-1-1-1zM12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8zm0-10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
          Amazonで詳細を見る
        </a>
      </div>
    `;

    gadgetsGrid.appendChild(card);
  });
}

// 起動
init();
