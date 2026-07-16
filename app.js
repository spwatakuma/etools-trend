import { categories, toolsData as baseToolsData } from './data.js';

// --- アプリケーションの状態管理 (State) ---
let currentCategory = 'all';
let currentTimeFilter = '24h';
let selectedToolId = null;
let activeToolsData = []; // APIから取得したアクティブなデータ

// --- DOM要素の参照 ---
const categoryTabs = document.getElementById('categoryTabs');
const timeFilters = document.getElementById('timeFilters');
const heatmapGrid = document.getElementById('heatmapGrid');
const panelCategoryTitle = document.getElementById('panelCategoryTitle');
const gadgetsGrid = document.getElementById('gadgetsGrid');

// 詳細パネルのDOM
const detailName = document.getElementById('detailName');
const detailCategory = document.getElementById('detailCategory');
const detailDesc = document.getElementById('detailDesc');
const trendChart = document.getElementById('trendChart');
const statMentions = document.getElementById('statMentions');
const statRank = document.getElementById('statRank');
const statScore = document.getElementById('statScore');
const tooltip = document.getElementById('tooltip');

// --- アプリの初期化 (Init) ---
async function init() {
  setupEventListeners();
  
  // 1. Cloudflare Pages Functions APIからリアルタイムデータを取得
  try {
    const response = await fetch('/api/trends', { signal: AbortSignal.timeout(5000) });
    if (response.ok) {
      activeToolsData = await response.json();
      console.log('Successfully fetched real-time trends from Cloudflare Pages Functions.');
    } else {
      throw new Error('API response was not OK');
    }
  } catch (error) {
    // APIが動作していない場合やローカル環境時は、事前に用意したbaseToolsDataをフォールバック使用
    console.warn('API fetch failed. Falling back to local data:', error);
    activeToolsData = baseToolsData;
  }

  // 2. レンダリングの実行
  renderHeatmap();
  renderGadgets();
  
  // 初期表示として最もトレンドスコアの高いツールを選択状態にする
  const initialTool = activeToolsData
    .filter(t => !t.isAffiliate)
    .sort((a, b) => b.trendScore - a.trendScore)[0];
  if (initialTool) {
    selectTool(initialTool.id);
  }

  // ウィンドウ幅が変更されたときのツリーマップ再レイアウト (レスポンシブ調整)
  window.addEventListener('resize', debounce(() => {
    renderHeatmap();
  }, 250));
}

// デバウンス関数 (リサイズイベントの間引き用)
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// --- イベントリスナーの設定 ---
function setupEventListeners() {
  // カテゴリタブ切り替え
  categoryTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    
    categoryTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    currentCategory = btn.dataset.category;
    renderHeatmap();
  });

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
// items: レイアウトする要素配列
// x, y: 開始座標 (0〜100%)
// width, height: 利用可能な幅と高さ (0〜100%)
// vertical: 分割方向 (縦か横か)
function layoutTreemap(items, x, y, width, height, vertical) {
  if (items.length === 0) return;
  
  // 残り要素が1つの場合、領域全体を割り当て
  if (items.length === 1) {
    items[0].x = x;
    items[0].y = y;
    items[0].w = width;
    items[0].h = height;
    return;
  }
  
  // 合計言及数を算出
  const totalValue = items.reduce((sum, item) => sum + item.treemapValue, 0);
  if (totalValue === 0) {
    // 0の場合は均等分割
    items.forEach((item, idx) => {
      item.treemapValue = 1;
    });
    layoutTreemap(items, x, y, width, height, vertical);
    return;
  }
  
  // 配列をバランス良く2つのグループに分割 (累計が全体の半分に最も近づく位置)
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
  
  // 縦または横に分割して再帰
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

// --- ヒートマップセルの強度分類 (トレンドの色彩強度) ---
function getIntensityClass(score) {
  if (score >= 90) return 'intensity-4';
  if (score >= 75) return 'intensity-3';
  if (score >= 60) return 'intensity-2';
  if (score >= 45) return 'intensity-1';
  return 'intensity-0';
}

// --- ヒートマップ (ツリーマップ) のレンダリング ---
function renderHeatmap() {
  // アフィリエイトではないソフトウェアツールのみを抽出
  let filtered = activeToolsData.filter(tool => !tool.isAffiliate);
  
  if (currentCategory !== 'all') {
    filtered = filtered.filter(tool => tool.category === currentCategory);
  }

  const mentionsKey = getMentionsKey();
  
  // ツリーマップの「面積（Value）」として30日間の総言及数(mentions30d)を使用し、
  // リサイズや切り替え時に崩れないよう面積計算用のプロパティをセット
  filtered.forEach(tool => {
    tool.treemapValue = tool[mentionsKey] || 10;
  });

  // 面積の大きい順にソート (ツリーマップが綺麗に収まるための必須処理)
  filtered.sort((a, b) => b.treemapValue - a.treemapValue);

  // グリッドをクリアし、ツリーマップ用の相対配置にセット
  heatmapGrid.innerHTML = '';
  heatmapGrid.style.position = 'relative';
  heatmapGrid.style.height = '480px'; // 固定高さ (CSS側と連動)
  heatmapGrid.style.width = '100%';

  if (filtered.length === 0) {
    heatmapGrid.innerHTML = '<p style="position: absolute; width:100%; top: 40%; text-align: center; color: var(--text-muted);">データがありません。</p>';
    return;
  }

  // 2. ツリーマップアルゴリズムで各タイルの座標 (x, y, w, h) を計算
  layoutTreemap(filtered, 0, 0, 100, 100, true);

  // 3. タイルをDOMに配置
  filtered.forEach(tool => {
    const cell = document.createElement('div');
    const intensity = getIntensityClass(tool.trendScore);
    cell.className = `heatmap-cell ${intensity}`;
    cell.dataset.id = tool.id;
    
    // 計算された座標をインラインCSS（パーセンテージ）で適用
    cell.style.position = 'absolute';
    cell.style.left = `${tool.x}%`;
    cell.style.top = `${tool.y}%`;
    cell.style.width = `${tool.w}%`;
    cell.style.height = `${tool.h}%`;
    cell.style.border = '1px solid var(--border-light)';
    
    // タイル同士の隙間（余白）を微調整
    cell.style.boxSizing = 'border-box';
    
    if (tool.id === selectedToolId) {
      cell.style.outline = '2.5px solid var(--accent-blue)';
      cell.style.outlineOffset = '-2.5px';
      cell.style.zIndex = '5';
    }

    const mentions = tool[mentionsKey].toLocaleString();

    // タイルのサイズ（幅・高さ）に応じてテキストの表示方法を最適化
    // 面積が極端に小さいタイルは、フォントを極小にし、余計なスタッツを表示しないようにする
    const isSmall = tool.w < 12 || tool.h < 12;
    const isTiny = tool.w < 7 || tool.h < 7;

    if (isTiny) {
      cell.innerHTML = `
        <span class="cell-name" style="font-size: 0.65rem; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; display: block;">${tool.name[0]}</span>
      `;
    } else if (isSmall) {
      cell.innerHTML = `
        <span class="cell-name" style="font-size: 0.7rem; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; display: block;">${tool.name}</span>
      `;
    } else {
      cell.innerHTML = `
        <span class="cell-name">${tool.name}</span>
        <span class="cell-score" style="font-size: 0.95rem;">${tool.trendScore}</span>
      `;
    }

    // クリックイベント
    cell.addEventListener('click', () => selectTool(tool.id));

    // ツールチップ用ホバーイベント
    cell.addEventListener('mouseenter', (e) => {
      tooltip.style.opacity = '1';
      tooltip.innerHTML = `<strong>${tool.name}</strong><br>期間中: ${mentions}言及 (${currentTimeFilter})<br>トレンド: ${tool.trendScore}点`;
      positionTooltip(e);
    });

    cell.addEventListener('mousemove', (e) => {
      positionTooltip(e);
    });

    cell.addEventListener('mouseleave', () => {
      tooltip.style.opacity = '0';
    });

    heatmapGrid.appendChild(cell);
  });

  // タイトルの更新
  const catName = currentCategory === 'all' ? 'すべてのツール' : categories[currentCategory];
  panelCategoryTitle.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 0.5rem; vertical-align: middle;"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>
    ${catName}のツリーマップ動向 (サイズ＝言及規模 / 色＝トレンド)
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
      cell.style.outline = '2.5px solid var(--accent-blue)';
      cell.style.outlineOffset = '-2.5px';
      cell.style.zIndex = '5';
    }
  });

  // テキストの更新
  detailName.innerText = tool.name;
  detailCategory.innerText = categories[tool.category];
  detailDesc.innerText = tool.description;

  const key = getMentionsKey();
  statMentions.innerText = tool[key].toLocaleString();
  statScore.innerText = `${tool.trendScore}/100`;

  // 順位の算出
  const sortedTools = activeToolsData
    .filter(t => !t.isAffiliate)
    .sort((a, b) => b[key] - a[key]);
  const rank = sortedTools.findIndex(t => t.id === id) + 1;
  statRank.innerText = `#${rank}`;

  // SVG折れ線グラフの描画
  renderSVGChart(tool.trendData);
}

// --- SVG折れ線グラフの描画 ---
function renderSVGChart(data) {
  const width = trendChart.clientWidth || 300;
  const height = 160;
  const padding = 15;
  
  trendChart.setAttribute('viewBox', `0 0 ${width} ${height}`);
  
  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  const valRange = maxVal - minVal || 1;

  // データ座標へのマッピング関数
  const getX = (idx) => padding + (idx / (data.length - 1)) * (width - padding * 2);
  const getY = (val) => height - padding - ((val - minVal) / valRange) * (height - padding * 2);

  // パス（d属性）の組み立て
  let linePath = '';
  let areaPath = '';

  data.forEach((val, idx) => {
    const x = getX(idx);
    const y = getY(val);
    if (idx === 0) {
      linePath = `M ${x} ${y}`;
      areaPath = `M ${x} ${height - padding} L ${x} ${y}`;
    } else {
      linePath += ` L ${x} ${y}`;
      areaPath += ` L ${x} ${y}`;
    }
  });
  
  areaPath += ` L ${getX(data.length - 1)} ${height - padding} Z`;

  // グリッドガイド線と軸の生成
  let svgContent = `
    <!-- グラデーション定義 -->
    <defs>
      <linearGradient id="chart-grad-${selectedToolId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--accent-blue)" stop-opacity="0.15"/>
        <stop offset="100%" stop-color="var(--accent-blue)" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <!-- 背景ガイド線 -->
    <line class="chart-axis" x1="${padding}" y1="${padding}" x2="${width - padding}" y2="${padding}" />
    <line class="chart-axis" x1="${padding}" y1="${height / 2}" x2="${width - padding}" y2="${height / 2}" />
    <line class="chart-axis" x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" />
    
    <!-- グラフ塗りつぶしエリア -->
    <path class="chart-area" d="${areaPath}" fill="url(#chart-grad-${selectedToolId})" />
    <!-- 折れ線 -->
    <path class="chart-line" d="${linePath}" />
  `;

  // データポイントの丸を描画
  data.forEach((val, idx) => {
    const x = getX(idx);
    const y = getY(val);
    svgContent += `
      <circle class="chart-dots" cx="${x}" cy="${y}" r="4" data-value="${val}"></circle>
    `;
  });

  // 日付の簡易軸ラベル
  svgContent += `
    <text class="chart-text" x="${padding}" y="${height - 2}" text-anchor="start">30日前</text>
    <text class="chart-text" x="${width / 2}" y="${height - 2}" text-anchor="middle">15日前</text>
    <text class="chart-text" x="${width - padding}" y="${height - 2}" text-anchor="end">最新</text>
  `;

  trendChart.innerHTML = svgContent;
}

// --- ガジェットアフィリエイトのレンダリング ---
function renderGadgets() {
  const gadgets = activeToolsData.filter(tool => tool.isAffiliate);
  gadgetsGrid.innerHTML = '';

  gadgets.forEach(gadget => {
    const card = document.createElement('article');
    card.className = 'gadget-card';

    card.innerHTML = `
      <div class="gadget-image-container">
        <img class="gadget-img" src="${gadget.imageName}" alt="${gadget.name}" loading="lazy">
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
