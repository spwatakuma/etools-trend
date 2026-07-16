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
    // APIが動作していない場合やローカル環境時は、事前に用意した最新のbaseToolsDataをフォールバック使用
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

// --- ヒートマップセルの強度分類 ---
function getIntensityClass(score) {
  if (score >= 90) return 'intensity-4';
  if (score >= 80) return 'intensity-3';
  if (score >= 70) return 'intensity-2';
  if (score >= 50) return 'intensity-1';
  return 'intensity-0';
}

// --- ヒートマップのレンダリング ---
function renderHeatmap() {
  // アフィリエイトではないソフトウェアツールのみを抽出
  let filtered = activeToolsData.filter(tool => !tool.isAffiliate);
  
  if (currentCategory !== 'all') {
    filtered = filtered.filter(tool => tool.category === currentCategory);
  }

  // 期間別言及数で並び替え
  filtered.sort((a, b) => {
    const key = getMentionsKey();
    return b[key] - a[key];
  });

  // グリッドをクリア
  heatmapGrid.innerHTML = '';

  if (filtered.length === 0) {
    heatmapGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">データがありません。</p>';
    return;
  }

  // セルを動的作成
  filtered.forEach(tool => {
    const cell = document.createElement('div');
    const intensity = getIntensityClass(tool.trendScore);
    cell.className = `heatmap-cell ${intensity}`;
    cell.dataset.id = tool.id;
    
    if (tool.id === selectedToolId) {
      cell.style.borderColor = 'var(--accent-blue)';
      cell.style.transform = 'scale(0.98)';
    }

    const mentions = tool[getMentionsKey()].toLocaleString();

    cell.innerHTML = `
      <span class="cell-name">${tool.name}</span>
      <span class="cell-score">${tool.trendScore}</span>
    `;

    // クリックイベント
    cell.addEventListener('click', () => selectTool(tool.id));

    // ツールチップ用ホバーイベント
    cell.addEventListener('mouseenter', (e) => {
      tooltip.style.opacity = '1';
      tooltip.innerText = `${tool.name}: ${mentions}言及 (${currentTimeFilter})`;
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
    ${catName}のリアルタイム注目度ヒートマップ
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
    cell.style.borderColor = 'transparent';
    cell.style.transform = 'none';
    if (cell.dataset.id === id) {
      cell.style.borderColor = 'var(--accent-blue)';
      cell.style.transform = 'scale(0.98)';
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
