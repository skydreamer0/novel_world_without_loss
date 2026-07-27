import { state, els } from './state.js';
import { saveState } from './config.js';
import { applyTheme, applyFontSize } from './theme.js';
import { toggleTTS, stopTTS, playNextChunk } from './tts.js';
import { toggleBottomPanel, handleTouchStart, handleTouchEnd } from './gestures.js';
import { updateBookmarkUI, renderSidebar } from './sidebar.js';
import { updateReadingProgress, loadChapter } from './reader.js';
import { performFullTextSearch } from './search.js';
import {
  toggleParaBookmark, addHighlight, renderAnnotPanel
} from './annotation_render.js';
import { setGlossaryEnabled } from './glossary.js';

// --- Event Listeners ---

export function bindEvents() {
  // Scroll
  window.addEventListener("scroll", updateReadingProgress, { passive: true });

  // Save scroll on unload
  window.addEventListener("beforeunload", () => {
    saveState("scroll");
    saveState("bookmarks");
  });

  // Sidebar Toggles
  const toggleSidebar = () => els.app.classList.toggle("sidebar-collapsed");
  els.menuBtn.onclick = toggleSidebar;
  els.sidebarCloseBtn.onclick = () => els.app.classList.add("sidebar-collapsed");
  els.sidebarOverlay.onclick = () => els.app.classList.add("sidebar-collapsed");

  // Settings
  els.themeToggle.onclick = () => {
    state.theme = state.theme === "light" ? "dark" : "light";
    applyTheme();
  };

  els.ttsToggle.onclick = toggleTTS;

  els.fontSizeInc.onclick = () => {
    state.fontSize = Math.min(state.fontSize + 0.1, 2.0);
    applyFontSize();
  };

  els.fontSizeDec.onclick = () => {
    state.fontSize = Math.max(state.fontSize - 0.1, 0.8);
    applyFontSize();
  };

  // Bookmark
  els.bookmarkBtn.onclick = () => {
    if (state.activeIndex < 0) return;
    const path = state.files[state.activeIndex].path;
    if (state.bookmarks.has(path)) {
      state.bookmarks.delete(path);
    } else {
      state.bookmarks.add(path);
    }
    updateBookmarkUI();
    saveState("bookmarks");
    renderSidebar();
  };

  // Navigation
  els.prevBtn.onclick = () => {
    if (state.activeIndex > 0) loadChapter(state.files[state.activeIndex - 1].path);
  };

  els.nextBtn.onclick = () => {
    if (state.activeIndex < state.files.length - 1) loadChapter(state.files[state.activeIndex + 1].path);
  };

  // Search mode toggle
  let modeToggle = els.searchWrap.querySelector('.search-mode-toggle');
  if (!modeToggle) {
    modeToggle = document.createElement('button');
    modeToggle.className = 'search-mode-toggle';
    modeToggle.type = 'button';
    modeToggle.textContent = '全文';
    els.searchWrap.appendChild(modeToggle);
  }
  els.searchModeToggle = modeToggle;

  els.searchModeToggle.onclick = () => {
    state.searchMode = state.searchMode === 'filter' ? 'fulltext' : 'filter';
    els.searchInput.placeholder = state.searchMode === 'filter' ? '搜尋章節...' : '搜尋內容...';
    els.searchInput.value = '';
    state.filterText = '';
    state.searchResults = [];
    state.searchContentCache = {};
    els.searchModeToggle.classList.toggle('active', state.searchMode === 'fulltext');
    renderSidebar();
  };

  // Search
  let searchDebounce = null;
  els.searchInput.oninput = (e) => {
    state.filterText = e.target.value;
    if (state.searchMode === 'fulltext') {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => performFullTextSearch(state.filterText), 300);
    } else {
      renderSidebar();
    }
  };

  // Keyboard Shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;

    if (e.key === "ArrowLeft") els.prevBtn.click();
    if (e.key === "ArrowRight") els.nextBtn.click();
    if (e.key.toLowerCase() === "t") els.themeToggle.click();
    if (e.key.toLowerCase() === "b") els.bookmarkBtn.click();
  });

  // Click behavior
  document.querySelector(".main-wrapper").addEventListener("click", (e) => {
    if (e.target.closest("button, a, input, .bottom-nav, .top-nav, .nav-btn, .chapter-divider, .bottom-panel")) return;

    const clickY = e.clientY;
    const windowH = window.innerHeight;
    const windowW = window.innerWidth;

    if (window.innerWidth <= 1024) {
      const isCenter = clickY > windowH * 0.3 && clickY < windowH * 0.7 &&
        e.clientX > windowW * 0.3 && e.clientX < windowW * 0.7;

      if (isCenter) {
        toggleBottomPanel(!state.bottomPanelOpen);
        return;
      }
    }

    if (clickY > windowH * 0.7) {
      window.scrollBy({ top: windowH * 0.85, behavior: "smooth" });
    }
  });

  // Gestures
  document.addEventListener("touchstart", handleTouchStart, { passive: true });
  document.addEventListener("touchend", handleTouchEnd, { passive: true });

  // === Annotations ===
  bindAnnotationEvents();

  // === Glossary toggle ===
  if (els.glossaryToggle) {
    // sync initial UI state
    els.glossaryToggle.checked = localStorage.getItem('reader-glossary-enabled') !== 'false';
    els.glossaryToggle.addEventListener('change', (e) => {
      setGlossaryEnabled(e.target.checked);
    });
  }

  // Bottom Panel Interactions
  els.bottomPanelOverlay.onclick = () => toggleBottomPanel(false);
  els.bottomPanelHandle.onclick = () => toggleBottomPanel(false);

  // Panel TTS Controls
  els.ttsPanelToggle.onclick = toggleTTS;
  els.ttsStopBtn.onclick = stopTTS;
  els.ttsRateInput.oninput = (e) => {
    state.ttsRate = parseFloat(e.target.value);
    els.ttsRateLabel.textContent = state.ttsRate.toFixed(1) + "x";

    if (state.tts.speaking && !state.tts.paused) {
      window.speechSynthesis.cancel();
      setTimeout(playNextChunk, 50);
    }
  };
  els.ttsStartSelect.onchange = (e) => {
    state.ttsStartMode = e.target.value;
  };

  // Panel Settings Controls
  els.panelThemeToggle.onclick = () => els.themeToggle.click();
  els.panelFontInc.onclick = () => {
    els.fontSizeInc.click();
    els.panelFontLabel.textContent = state.fontSize.toFixed(1);
  };
  els.panelFontDec.onclick = () => {
    els.fontSizeDec.click();
    els.panelFontLabel.textContent = state.fontSize.toFixed(1);
  };
}

// === Annotation event bindings ===

function getActivePath() {
  if (state.activeIndex < 0) return null;
  return state.files[state.activeIndex]?.path || null;
}

function getTextOffsetWithin(paraEl, node, offset) {
  // Walk text nodes in document order; sum lengths until we hit (node, offset).
  let total = 0;
  const walker = document.createTreeWalker(paraEl, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      let p = n.parentElement;
      while (p && p !== paraEl) {
        if (p.classList && p.classList.contains('para-bookmark-dot')) {
          return NodeFilter.FILTER_REJECT;
        }
        p = p.parentElement;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  let n;
  while ((n = walker.nextNode())) {
    if (n === node) return total + offset;
    total += n.nodeValue.length;
  }
  return -1;
}

function bindAnnotationEvents() {
  // (1) Paragraph bookmark dot — delegate click on content
  els.content.addEventListener('click', (e) => {
    const dot = e.target.closest('.para-bookmark-dot');
    if (!dot) return;
    e.stopPropagation();
    const paraEl = dot.parentElement;
    const paraIndex = parseInt(paraEl.dataset.paraIndex, 10);
    const path = paraEl.closest('.chapter-section')?.dataset.chapterPath;
    if (!path || isNaN(paraIndex)) return;
    const added = toggleParaBookmark(path, paraIndex);
    paraEl.classList.toggle('is-bookmarked', added);
    if (getActivePath() === path) renderAnnotPanel(path);
  });

  // (2) Selection -> highlight FAB
  const fab = els.highlightFab;
  let pendingHighlight = null;

  function hideFab() {
    fab.hidden = true;
    pendingHighlight = null;
  }

  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      hideFab();
      return;
    }
    const range = sel.getRangeAt(0);
    const paraEl = range.startContainer.parentElement?.closest('[data-para-index]');
    if (!paraEl) { hideFab(); return; }
    if (range.endContainer.parentElement?.closest('[data-para-index]') !== paraEl) {
      hideFab();
      return;
    }
    const text = sel.toString().trim();
    if (text.length < 1 || text.length > 400) { hideFab(); return; }
    const start = getTextOffsetWithin(paraEl, range.startContainer, range.startOffset);
    const end = getTextOffsetWithin(paraEl, range.endContainer, range.endOffset);
    if (start < 0 || end <= start) { hideFab(); return; }

    const path = paraEl.closest('.chapter-section')?.dataset.chapterPath;
    const paraIndex = parseInt(paraEl.dataset.paraIndex, 10);
    if (!path || isNaN(paraIndex)) { hideFab(); return; }

    const rect = range.getBoundingClientRect();
    fab.hidden = false;
    fab.style.top = `${Math.max(8, rect.top - 44) + window.scrollY}px`;
    fab.style.left = `${rect.left + rect.width / 2 + window.scrollX}px`;
    pendingHighlight = { path, paraIndex, start, end, snippet: text.slice(0, 80) };
  });

  fab.addEventListener('mousedown', (e) => e.preventDefault()); // keep selection
  fab.addEventListener('click', () => {
    if (!pendingHighlight) return;
    const { path, paraIndex, start, end, snippet } = pendingHighlight;
    addHighlight(path, paraIndex, start, end, snippet);
    // Re-render: clear current paragraph and re-apply via dynamic import to avoid cycle
    import('./annotation_render.js').then(({ applyHighlightsToSection }) => {
      const section = document.querySelector(`.chapter-section[data-chapter-path="${CSS.escape(path)}"]`);
      if (section) {
        // Remove existing marks in that paragraph first, then re-apply all
        const paraEl = section.querySelector(`[data-para-index="${paraIndex}"]`);
        if (paraEl) {
          paraEl.querySelectorAll('mark.annot-highlight').forEach(m => {
            const parent = m.parentNode;
            while (m.firstChild) parent.insertBefore(m.firstChild, m);
            parent.removeChild(m);
          });
          paraEl.normalize();
        }
        applyHighlightsToSection(section, path);
      }
      if (getActivePath() === path) renderAnnotPanel(path);
    });
    window.getSelection().removeAllRanges();
    hideFab();
  });

  // (3) Annotations panel toggle
  if (els.annotToggle) {
    els.annotToggle.onclick = () => {
      const path = getActivePath();
      if (path) renderAnnotPanel(path);
      const open = !state.annotPanelOpen;
      state.annotPanelOpen = open;
      els.annotPanel.hidden = !open;
      els.annotPanelOverlay.hidden = !open;
      els.annotPanel.classList.toggle('open', open);
      els.annotPanelOverlay.classList.toggle('open', open);
    };
    const close = () => {
      state.annotPanelOpen = false;
      els.annotPanel.classList.remove('open');
      els.annotPanelOverlay.classList.remove('open');
      setTimeout(() => {
        els.annotPanel.hidden = true;
        els.annotPanelOverlay.hidden = true;
      }, 320);
    };
    els.annotPanelClose.onclick = close;
    els.annotPanelOverlay.onclick = close;
  }

  // Hide FAB when clicking elsewhere
  document.addEventListener('mousedown', (e) => {
    if (e.target === fab || fab.contains(e.target)) return;
    if (window.getSelection().isCollapsed) hideFab();
  });
}
