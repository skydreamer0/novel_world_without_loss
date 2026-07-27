// Dossier View: Loads terms from _GLOSSARY.json and CANON_*.md
// and displays them in a classified dossier style.

const JSON_SOURCE = '../02_PROJECT_DATABASE/_GLOSSARY.json';

function getReadingProgress() {
  try {
    let paths = [];
    const readList = JSON.parse(localStorage.getItem('reader-read') || '[]');
    if (Array.isArray(readList)) paths = paths.concat(readList);
    
    const lastRead = localStorage.getItem('reader-last-read');
    if (lastRead) paths.push(lastRead);

    let maxChapter = 0;
    // Regex to match "第X章", "chX", "chapter-X", or raw numbers like "086" at the start of filename/folder
    const chapterRegex = /(?:第|ch(?:apter)?-?)?0*(\d+)(?:章)?/i; 
    
    paths.forEach(path => {
      if (!path) return;
      // It's safer to extract the filename part first if it's a full path
      const parts = path.split('/');
      const filename = parts[parts.length - 1] || path;
      const match = filename.match(chapterRegex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxChapter) maxChapter = num;
      }
    });
    return maxChapter;
  } catch (err) {
    console.error('Failed to parse reading progress:', err);
    return 0;
  }
}

function updateStatusHeader(progress) {
  const statusEl = document.getElementById('sync-status');
  if (statusEl) {
    statusEl.textContent = `> 已偵測到載體進度：Ch.${progress} | 感知延遲：穩定 | 正在同步母巢數據...`;
  }
}

/**
 * Parses markdown text to extract term metadata and content.
 * Matches: ### Title <!-- unlock: XX visibility: YY category: ZZ -->
 */
function parseMDMetadata(text, defaultCategory = '檔案') {
  const metaRegex = /<!--\s*unlock:\s*(\d+)\s*(?:visibility:\s*(\w+))?\s*(?:category:\s*([\u4e00-\u9fa5\w]+))?\s*-->/;
  const lines = text.split('\n');
  const items = [];
  let currentItem = null;

  for (const line of lines) {
    const headingMatch = line.match(/^###\s+(.+)$/);
    if (headingMatch) {
      const rawTitle = headingMatch[1];
      const metaMatch = rawTitle.match(metaRegex);
      const title = rawTitle.replace(metaRegex, '').trim();
      currentItem = {
        term: title,
        unlock: metaMatch && metaMatch[1] ? parseInt(metaMatch[1], 10) : 0,
        visibility: metaMatch && metaMatch[2] ? metaMatch[2] : 'partial',
        category: metaMatch && metaMatch[3] ? metaMatch[3] : defaultCategory,
        content: ''
      };
      items.push(currentItem);
    } else if (currentItem) {
      currentItem.content += line + '\n';
    }
  }
  return items.map(item => ({...item, content: item.content.trim()}));
}

/**
 * Merges JSON terms with Markdown terms.
 * JSON metadata overrides MD metadata; MD provides content.
 */
function mergeSources(jsonTerms, mdTerms) {
  const merged = new Map();
  mdTerms.forEach(t => merged.set(t.term, { ...t, source: 'Canon Archive' }));
  jsonTerms.forEach(t => {
    const existing = merged.get(t.term) || {};
    const isMerged = !!existing.term;
    
    // Ensure unlock logic for JSON stages is handled
    let unlock = t.unlock || 0;
    if (t.unlock_stages && t.unlock_stages.length > 0) {
       unlock = Math.min(...t.unlock_stages.map(s => s.chapter));
    }

    merged.set(t.term, {
      ...existing,
      ...t,
      unlock: unlock, // JSON dictates unlock threshold
      category: t.category || existing.category || '檔案',
      visibility: t.visibility || existing.visibility || 'partial',
      mdContent: existing.content || '',
      source: isMerged ? 'Merged File' : 'Dynamic Report'
    });
  });
  return Array.from(merged.values());
}

async function fetchTerms() {
  let jsonTerms = [];
  try {
    const res = await fetch(JSON_SOURCE);
    if (res.ok) jsonTerms = await res.json();
  } catch (e) { console.warn('JSON fetch failed'); }

  const MD_SOURCES = [
    { path: '../02_PROJECT_DATABASE/CANON_characters.md', cat: '角色' },
    { path: '../02_PROJECT_DATABASE/CANON_world.md', cat: '世界' },
    { path: '../02_PROJECT_DATABASE/STATE.md', cat: '檔案' }
  ];
  
  let mdTerms = [];
  for (const src of MD_SOURCES) {
    try {
      const res = await fetch(src.path);
      if (res.ok) {
        const text = await res.text();
        mdTerms = mdTerms.concat(parseMDMetadata(text, src.cat));
      }
    } catch(e) { console.warn('Failed to fetch', src.path); }
  }
  return mergeSources(jsonTerms, mdTerms);
}

window.handleCardClick = function(el) {
  if (!el.classList.contains('locked')) return;
  
  // Add shake
  el.classList.remove('shake');
  void el.offsetWidth; // trigger reflow
  el.classList.add('shake');
  
  // Remove shake after animation ends
  setTimeout(() => el.classList.remove('shake'), 500);
  
  const level = el.getAttribute('data-level');
  let msg = 'CRITICAL ERROR: SYNC FAILED';
  if (level === 'restricted') msg = 'ACCESS DENIED: AUTHORITY BELOW THRESHOLD';
  if (level === 'blackbox') msg = 'DATA CORRUPTION: OBSERVER REJECTED';
  
  console.warn(msg);
};

/**
 * Renders visible stage texts based on progress.
 */
function renderStages(stages, progress) {
  if (!stages || !stages.length) return '';
  const visibleStages = stages.filter(s => progress >= s.chapter);
  if (!visibleStages.length) return '';
  return visibleStages
    .map((s, i) => `<div class="stage-text"><span class="stage-label">[階段 ${i+1}]</span> ${s.text}</div>`)
    .join('');
}

/**
 * Renders progress dots for multiple stages.
 */
function renderDots(stages, progress) {
  if (!stages || stages.length <= 1) return '';
  return `
    <div class="stage-indicator">
      ${stages.map(s => `<div class="stage-dot ${progress >= s.chapter ? 'active' : ''}"></div>`).join('')}
    </div>
  `;
}

function renderTerms(terms, filter = 'all', userProgress = 0) {
  const grid = document.getElementById('dossier-grid');
  const filtered = filter === 'all' 
    ? terms 
    : terms.filter(t => t.source === filter);

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="loading-state">【查無符合條件之名錄檔案】</div>';
    return;
  }

  grid.innerHTML = filtered.map(t => {
    // Fallback properties for older items
    const unlockCh = t.unlock || Number.MAX_SAFE_INTEGER; 
    const isLocked = userProgress < unlockCh;
    const vis = t.visibility || 'partial';
    
    let displayTitle = t.term;
    let displayMeta = t.source || 'UNKNOWN';
    let lockedClass = '';
    
    if (isLocked) {
      lockedClass = 'locked ';
      if (vis === 'restricted') {
        displayTitle = t.term.replace(/./g, (c, i) => i % 2 ? '■' : c);
        displayMeta = 'RESTRICTED';
        lockedClass += 'level-2';
      } else if (vis === 'blackbox') {
        displayTitle = '[ REDACTED ]';
        displayMeta = 'BLACK BOX';
        lockedClass += 'level-3';
      } else {
        lockedClass += 'level-1';
      }
    }
    
    // For now, render display_text or mdContent or internal_note
    let contentHtml = '';
    if (t.unlock_stages && t.unlock_stages.length > 0) {
      contentHtml = renderStages(t.unlock_stages, userProgress);
      if (!contentHtml && isLocked) {
         contentHtml = '【數據損毀：權限不足】';
      }
    } else {
      contentHtml = t.display_text || t.mdContent || t.internal_note || '【數據損毀：權限不足】';
    }
    const dotsHtml = renderDots(t.unlock_stages, userProgress);

    return `
      <article class="card ${lockedClass}" data-source="${t.source}" data-level="${vis}" onclick="handleCardClick(this)">
        <h2 class="term-title">${displayTitle}</h2>
        <div class="term-meta">
          <span class="meta-src">SRC: ${displayMeta}</span>
          <span class="meta-ver">VER: ${t.v_version || '??'}</span>
        </div>
        <div class="content term-desc">
          ${contentHtml}
        </div>
        ${dotsHtml}
      </article>
    `;
  }).join('');
}

async function syncData(progress) {
  const status = document.getElementById('sync-status');
  if (status) status.textContent = '正在同步母巢數據...';
  try {
    const mergedTerms = await fetchTerms();
    // Simulate latency for the effect (optional, 500ms)
    await new Promise(r => setTimeout(r, 500)); 
    
    if (status) status.textContent = '同步完成：新增檔案已解封';
    
    // Update global cache for filters
    window.__cachedTerms = mergedTerms;

    // Re-render
    const activeFilter = document.querySelector('.filter-btn.active')?.dataset.source || 'all';
    renderTerms(mergedTerms, activeFilter, progress);
  } catch (e) {
    console.error(e);
    if (status) status.textContent = '離線模式：顯示上次同步資料';
  }
}

async function exportMemory() {
  const state = {
    version: 1,
    highestChapter: getReadingProgress(),
    exportedAt: new Date().toISOString()
  };
  const code = btoa(JSON.stringify(state));
  try {
    await navigator.clipboard.writeText(code);
    alert('記憶片段已導出至剪貼簿');
  } catch (err) {
    prompt('請複製以下記憶片段代碼：', code);
  }
}

function importMemory() {
  const code = prompt('請貼上記憶片段代碼：');
  if (!code) return;
  try {
    const state = JSON.parse(atob(code));
    if (!state.version || state.highestChapter === undefined) throw new Error('Invalid format');
    
    const currentProgress = getReadingProgress();
    if (state.highestChapter > currentProgress || confirm(`導入進度 (Ch.${state.highestChapter}) 低於當前進度 (Ch.${currentProgress})，是否覆蓋？`)) {
      localStorage.setItem('reader-last-read', `第${state.highestChapter}章`);
      alert('記憶覆寫完成。');
      location.reload(); 
    }
  } catch (e) {
    alert('無效的記憶片段');
    console.error(e);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Detect progress and update header
  const progress = getReadingProgress();
  updateStatusHeader(progress);

  // Bind Export/Import
  const exportBtn = document.getElementById('export-btn');
  const importBtn = document.getElementById('import-btn');
  if (exportBtn) exportBtn.addEventListener('click', exportMemory);
  if (importBtn) importBtn.addEventListener('click', importMemory);

  // Start background sync
  syncData(progress);

  // Filter Logic
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (window.__cachedTerms) {
        renderTerms(window.__cachedTerms, btn.dataset.source, progress);
      }
    });
  });
});
