// Rendering glue for annotations: assign paragraph indices, re-apply saved
// highlights, render the side panel, track current visible paragraph for
// resume, and show the resume toast on chapter load.

import { state, els } from './state.js';
import {
  chapterEntries, isParaBookmarked, toggleParaBookmark,
  addHighlight, removeAnnotation, setResume, getResume, clearResume
} from './annotations.js';

// Re-export so reader.js only needs to import from this file.
export {
  chapterEntries, isParaBookmarked, toggleParaBookmark,
  addHighlight, removeAnnotation, setResume, getResume, clearResume
};

// Assign data-para-index to direct block children, attach bookmark dot.
export function indexParagraphs(section, path) {
  const blocks = section.children;
  for (let i = 0; i < blocks.length; i++) {
    const el = blocks[i];
    el.dataset.paraIndex = i;
    el.classList.add('para-block');
    if (isParaBookmarked(path, i)) el.classList.add('is-bookmarked');

    // Add hover bookmark dot in left margin (single instance per element)
    if (!el.querySelector(':scope > .para-bookmark-dot')) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'para-bookmark-dot';
      dot.setAttribute('aria-label', '段落書籤');
      dot.dataset.paraIndex = i;
      el.appendChild(dot);
    }
  }
}

// --- Highlight re-application ---
//
// Walk text nodes inside the paragraph (skipping our own helper elements),
// find the substring [start, end) by character offset, wrap into <mark>.

function getTextNodes(el) {
  const out = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      // Skip text inside helper buttons / existing marks we own
      let p = node.parentElement;
      while (p && p !== el) {
        if (p.classList && (p.classList.contains('para-bookmark-dot'))) {
          return NodeFilter.FILTER_REJECT;
        }
        p = p.parentElement;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  let n;
  while ((n = walker.nextNode())) out.push(n);
  return out;
}

function wrapRange(paraEl, start, end, id) {
  if (end <= start) return false;
  const nodes = getTextNodes(paraEl);
  let offset = 0;
  let startNode = null, startOffset = 0;
  let endNode = null, endOffset = 0;
  for (const n of nodes) {
    const len = n.nodeValue.length;
    if (startNode == null && offset + len > start) {
      startNode = n;
      startOffset = start - offset;
    }
    if (offset + len >= end) {
      endNode = n;
      endOffset = end - offset;
      break;
    }
    offset += len;
  }
  if (!startNode || !endNode) return false;
  try {
    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    const mark = document.createElement('mark');
    mark.className = 'annot-highlight';
    mark.dataset.annotId = id;
    range.surroundContents(mark);
    return true;
  } catch (e) {
    // surroundContents fails if range crosses non-text boundaries; ignore.
    return false;
  }
}

export function applyHighlightsToSection(section, path) {
  const entry = chapterEntries(path);
  if (!entry || !entry.highlights || entry.highlights.length === 0) return;
  // Sort by start desc so wrapping earlier ones doesn't shift later offsets
  // within the same paragraph.
  const byPara = new Map();
  for (const h of entry.highlights) {
    if (!byPara.has(h.paraIndex)) byPara.set(h.paraIndex, []);
    byPara.get(h.paraIndex).push(h);
  }
  for (const [paraIndex, list] of byPara) {
    const paraEl = section.querySelector(`[data-para-index="${paraIndex}"]`);
    if (!paraEl) continue;
    list.sort((a, b) => b.start - a.start);
    for (const h of list) wrapRange(paraEl, h.start, h.end, h.id);
  }
}

// --- Resume tracking via IntersectionObserver ---

export function observeParas(section, path) {
  if (state.paraObserver) {
    state.paraObserver.disconnect();
  }
  state.paraObserver = new IntersectionObserver((entries) => {
    let topIdx = state.lastVisiblePara;
    let topY = Infinity;
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const rect = e.boundingClientRect;
      if (rect.top >= 0 && rect.top < topY) {
        topY = rect.top;
        topIdx = parseInt(e.target.dataset.paraIndex, 10);
      }
    }
    if (!isNaN(topIdx) && topIdx !== state.lastVisiblePara) {
      state.lastVisiblePara = topIdx;
      setResume(path, topIdx);
    }
  }, { rootMargin: '-20% 0px -65% 0px', threshold: 0 });

  for (const el of section.children) {
    if (el.dataset.paraIndex != null) state.paraObserver.observe(el);
  }
}

// --- Resume toast ---

export function showResumeToastIfAny(path, currentTitle) {
  const r = getResume();
  if (!r || r.path !== path || r.paraIndex == null || r.paraIndex < 3) return;

  const toast = els.resumeToast;
  if (!toast) return;
  els.resumeToastText.textContent = `上次讀到 第 ${r.paraIndex + 1} 段`;
  toast.hidden = false;
  toast.classList.add('show');

  const dismiss = () => {
    toast.classList.remove('show');
    setTimeout(() => { toast.hidden = true; }, 320);
  };

  els.resumeJumpBtn.onclick = () => {
    const target = document.querySelector(`.chapter-section[data-chapter-path="${CSS.escape(path)}"] [data-para-index="${r.paraIndex}"]`);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    dismiss();
  };
  els.resumeDismissBtn.onclick = dismiss;

  // Auto-hide after 8s
  clearTimeout(state._resumeTimer);
  state._resumeTimer = setTimeout(dismiss, 8000);
}

// --- Side panel render ---

export function renderAnnotPanel(path) {
  if (!els.annotPanelBody) return;
  const entry = chapterEntries(path);
  const items = [];
  if (entry) {
    for (const b of entry.bookmarks) {
      items.push({ kind: 'bookmark', id: b.id, paraIndex: b.paraIndex, ts: b.ts, snippet: null });
    }
    for (const h of entry.highlights) {
      items.push({ kind: 'highlight', id: h.id, paraIndex: h.paraIndex, ts: h.ts, snippet: h.snippet });
    }
  }
  items.sort((a, b) => a.paraIndex - b.paraIndex || a.ts - b.ts);

  if (items.length === 0) {
    els.annotPanelBody.innerHTML = '<p class="annot-empty">尚無註記。選取文字或點擊段落旁的書籤即可建立。</p>';
    return;
  }

  els.annotPanelBody.innerHTML = '';
  for (const it of items) {
    const card = document.createElement('div');
    card.className = `annot-card annot-card-${it.kind}`;
    card.dataset.paraIndex = it.paraIndex;
    card.dataset.annotId = it.id;

    const icon = it.kind === 'bookmark' ? '🔖' : '🖍';
    const label = it.kind === 'bookmark' ? '段落書籤' : '高亮';
    const snippet = it.snippet ? `<p class="annot-snippet">「${it.snippet}」</p>` : '';

    card.innerHTML = `
      <div class="annot-card-head">
        <span class="annot-kind">${icon} ${label}</span>
        <span class="annot-para">第 ${it.paraIndex + 1} 段</span>
        <button type="button" class="annot-del" aria-label="刪除">✕</button>
      </div>
      ${snippet}
    `;

    card.querySelector('.annot-card-head').addEventListener('click', (e) => {
      if (e.target.closest('.annot-del')) return;
      const target = document.querySelector(`.chapter-section[data-chapter-path="${CSS.escape(path)}"] [data-para-index="${it.paraIndex}"]`);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    card.querySelector('.annot-del').addEventListener('click', () => {
      removeAnnotation(path, it.id);
      // Remove any rendered <mark> for highlights
      if (it.kind === 'highlight') {
        const m = document.querySelector(`mark.annot-highlight[data-annot-id="${it.id}"]`);
        if (m) {
          const parent = m.parentNode;
          while (m.firstChild) parent.insertBefore(m.firstChild, m);
          parent.removeChild(m);
          parent.normalize();
        }
      } else {
        const para = document.querySelector(`[data-para-index="${it.paraIndex}"]`);
        if (para) para.classList.remove('is-bookmarked');
      }
      renderAnnotPanel(path);
    });

    els.annotPanelBody.appendChild(card);
  }
}
