import { state, els } from './state.js';
import { getApiUrl } from './github.js';
import { loadChapter } from './navigator.js';
import { renderSidebar } from './sidebar.js';

async function fetchWithConcurrency(files, query, signal, maxConcurrency) {
  const results = [];
  const MAX_RESULTS = 20;
  let i = 0;

  while (i < files.length) {
    if (signal.aborted) break;
    if (results.length >= MAX_RESULTS) break;

    const batch = files.slice(i, i + maxConcurrency);
    i += maxConcurrency;

    const batchResults = await Promise.all(
      batch.map(async (file) => {
        if (signal.aborted) return [];

        let content = state.searchContentCache[file.path];
        if (!content) {
          try {
            const url = getApiUrl(file.path);
            const resp = await fetch(url, { signal });
            if (!resp.ok) return [];
            content = await resp.text();
            state.searchContentCache[file.path] = content;
          } catch {
            return [];
          }
        }

        if (signal.aborted) return [];

        const lower = content.toLowerCase();
        const fileResults = [];
        let idx = 0;
        while (fileResults.length < MAX_RESULTS) {
          const pos = lower.indexOf(query, idx);
          if (pos === -1) break;
          const start = Math.max(0, pos - 60);
          const end = Math.min(content.length, pos + query.length + 60);
          let snippet = content.slice(start, end);
          if (start > 0) snippet = '…' + snippet;
          if (end < content.length) snippet = snippet + '…';
          fileResults.push({ path: file.path, title: file.title, snippet });
          idx = pos + query.length;
        }
        return fileResults;
      })
    );

    for (const fileResults of batchResults) {
      if (signal.aborted) break;
      results.push(...fileResults);
    }
  }

  return results;
}

export async function performFullTextSearch(query) {
  if (!query || !query.trim()) {
    state.searchResults = [];
    state.isSearching = false;
    renderSidebar();
    return;
  }

  if (state.searchAbortController) {
    state.searchAbortController.abort();
  }
  state.searchAbortController = new AbortController();
  const signal = state.searchAbortController.signal;

  state.isSearching = true;
  state.searchResults = [];
  renderSidebar();

  const q = query.toLowerCase().trim();
  const files = state.files;

  const results = await fetchWithConcurrency(files, q, signal, 6);

  if (signal.aborted) return;

  state.searchResults = results;
  state.isSearching = false;
  renderSidebar();
}

export function renderSearchResults(results) {
  const list = els.chapterList;
  list.innerHTML = '';

  if (state.isSearching) {
    const status = document.createElement('div');
    status.className = 'search-status';
    status.textContent = '🔍 搜尋中...';
    list.appendChild(status);
    return;
  }

  if (results.length === 0) {
    const status = document.createElement('div');
    status.className = 'search-status';
    status.textContent = '無符合結果';
    list.appendChild(status);
    return;
  }

  results.forEach(r => {
    const btn = document.createElement('button');
    btn.className = 'chapter-btn';

    const title = document.createElement('div');
    title.className = 'search-result-title';
    title.textContent = r.title;

    const snippet = document.createElement('div');
    snippet.className = 'search-result-snippet';
    snippet.textContent = r.snippet;

    btn.appendChild(title);
    btn.appendChild(snippet);
    btn.onclick = () => {
      loadChapter(r.path);
      state.searchMode = 'filter';
      state.filterText = '';
      state.searchResults = [];
      els.searchInput.value = '';
      els.searchInput.placeholder = '搜尋章節...';
      const toggle = els.searchWrap?.querySelector('.search-mode-toggle');
      if (toggle) toggle.classList.remove('active');
      renderSidebar();
    };
    list.appendChild(btn);
  });
}
