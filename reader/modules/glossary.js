// Glossary: parse CANON_*.md files into a term -> description map, then
// auto-annotate matching terms in rendered chapter content with a popover.

import { state, els, config } from './state.js';
import { getApiUrl } from './github.js';

// === Configuration ===

const SOURCES = [
  { file: '02_PROJECT_DATABASE/_GLOSSARY.json', label: '核心名詞', isJson: true },
  { file: '02_PROJECT_DATABASE/CANON_characters.md', label: '角色', includeH3: true },
  { file: '02_PROJECT_DATABASE/CANON_world.md', label: '世界', includeH3: false },
  { file: '02_PROJECT_DATABASE/CANON_power.md', label: '力量', includeH3: false },
];

const MAX_TERM_LEN = 7;
const MIN_TERM_LEN = 2;
const DESC_MAX = 140;

// Subsection labels that look like terms but aren't.
const NOISE = new RegExp(
  '^(' + [
    '基礎資料', '跨卷演化表', '核心行為邏輯', '戰鬥風格', '台詞風格', '主軸人物弧線',
    '弧線速覽', '台詞範例', '常見誤判', '崩潰表現', '與主角衝突', '當前.*能力',
    '角色關係動態圖', '其他配角索引', '配角索引', '版本總表', '能力代價總表',
    '資源底層定義', '社會結構演化',
    '\\d+(\\.\\d+)?', // pure numbering leftovers
  ].join('|') + ')'
);

const RELATIONSHIP = /↔|↗|↘|↑|↓|→|←/; // relationship h3s like "林燼 ↔ 蘇嵐"

// === Helpers ===

function cleanHeadingName(raw) {
  // Strip leading numbering: "1.", "1.1", "V9 —", etc.
  let s = raw.replace(/^\s*\d+(\.\d+)?\.?\s*/, '');
  // Strip dash markers used in power: "V9 — 系統級病毒（當前版本，第 119-120 章）"
  s = s.replace(/^V?\d+(\+|-\d+)?\s*[—–-]\s*/, '');
  // Drop everything from first "（"
  const paren = s.indexOf('（');
  if (paren >= 0) s = s.slice(0, paren);
  // Trim
  s = s.trim();
  return s;
}

function pickCoreTerm(cleaned) {
  if (!cleaned) return null;
  if (NOISE.test(cleaned)) return null;
  if (RELATIONSHIP.test(cleaned)) return null;
  // If contains space, take last whitespace token (e.g. "核心盟友 蘇嵐" -> "蘇嵐")
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const last = parts[parts.length - 1];
  if (last && last.length >= MIN_TERM_LEN && last.length <= MAX_TERM_LEN) return last;
  if (cleaned.length >= MIN_TERM_LEN && cleaned.length <= MAX_TERM_LEN) return cleaned;
  return null;
}

function extractDescAfter(lines, startIdx) {
  // Pass 1: Look for explicit TL;DR tags for readers
  for (let i = startIdx + 1; i < Math.min(lines.length, startIdx + 20); i++) {
    const line = lines[i].trim();
    if (line.startsWith('#')) break;
    if (line.startsWith('> [快讀]') || line.startsWith('> [核心]')) {
      let s = line.replace(/^>\s*\[(快讀|核心)\][:：]?\s*/, '').trim();
      if (s.length > DESC_MAX) s = s.slice(0, DESC_MAX - 1) + '…';
      return s;
    }
  }

  // Pass 2: Fallback to first non-empty paragraph (legacy logic)
  for (let i = startIdx + 1; i < Math.min(lines.length, startIdx + 25); i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith('#')) return null; // ran into next heading
    if (line.startsWith('<!--')) continue;
    if (line.startsWith('|')) continue; // table row — skip for now
    if (line.startsWith('---')) continue;
    // Strip leading list/quote markers
    let s = line.replace(/^[-*+]\s+/, '').replace(/^>\s+/, '');
    // Strip bold markers
    s = s.replace(/\*\*/g, '');
    if (s.length === 0) continue;
    if (s.length > DESC_MAX) s = s.slice(0, DESC_MAX - 1) + '…';
    return s;
  }
  return null;
}

function parseSource(text, source) {
  const lines = text.split(/\r?\n/);
  const items = [];
  for (let i = 0; i < lines.length; i++) {
    const m2 = lines[i].match(/^##\s+(.+)$/);
    const m3 = source.includeH3 ? lines[i].match(/^###\s+(.+)$/) : null;
    const raw = m2 ? m2[1] : (m3 ? m3[1] : null);
    if (!raw) continue;
    const cleaned = cleanHeadingName(raw);
    const term = pickCoreTerm(cleaned);
    if (!term) continue;
    const desc = extractDescAfter(lines, i);
    if (!desc) continue;
    items.push({ term, desc, source: source.label, file: source.file });
  }
  return items;
}

// === Loading ===

export async function loadGlossary() {
  state.glossary = new Map();
  state.glossaryRegex = null;

  try {
    const results = await Promise.all(
      SOURCES.map(s => fetch(getApiUrl(s.file)).then(r => r.ok ? (s.isJson ? r.json() : r.text()) : null).catch(() => null))
    );
    const all = [];
    results.forEach((data, idx) => {
      if (!data) return;
      const s = SOURCES[idx];
      if (s.isJson) {
        all.push(...data.map(it => ({ ...it, source: it.source || s.label, file: s.file })));
      } else {
        all.push(...parseSource(data, s));
      }
    });

    // Deduplicate by term — keep the first definition
    for (const it of all) {
      if (!state.glossary.has(it.term)) {
        state.glossary.set(it.term, it);
      }
    }

    if (state.glossary.size > 0) {
      // Sort by length desc so longer matches win over shorter ones
      const terms = [...state.glossary.keys()].sort((a, b) => b.length - a.length);
      const escaped = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      state.glossaryRegex = new RegExp('(' + escaped.join('|') + ')', 'g');
    }

    console.info(`Glossary loaded: ${state.glossary.size} terms`);
  } catch (e) {
    console.warn('Glossary load failed', e);
  }
}

// === Annotation pass on chapter content ===

const SKIP_TAGS = new Set(['MARK', 'CODE', 'PRE', 'H1', 'H2', 'H3', 'BUTTON', 'A', 'SCRIPT', 'STYLE']);

export function annotateGlossary(section) {
  if (!state.glossaryEnabled) return;
  if (!state.glossaryRegex || state.glossary.size === 0) return;

  const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      let p = node.parentElement;
      while (p && p !== section) {
        if (SKIP_TAGS.has(p.tagName)) return NodeFilter.FILTER_REJECT;
        if (p.classList && (
          p.classList.contains('term') ||
          p.classList.contains('para-bookmark-dot') ||
          p.classList.contains('annot-highlight')
        )) return NodeFilter.FILTER_REJECT;
        p = p.parentElement;
      }
      return state.glossaryRegex.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });

  const targets = [];
  let n;
  while ((n = walker.nextNode())) targets.push(n);

  for (const node of targets) {
    state.glossaryRegex.lastIndex = 0;
    const text = node.nodeValue;
    const frag = document.createDocumentFragment();
    let lastEnd = 0;
    let m;
    while ((m = state.glossaryRegex.exec(text)) !== null) {
      if (m.index > lastEnd) {
        frag.appendChild(document.createTextNode(text.slice(lastEnd, m.index)));
      }
      const span = document.createElement('span');
      span.className = 'term';
      span.dataset.term = m[1];
      span.textContent = m[1];
      frag.appendChild(span);
      lastEnd = m.index + m[1].length;
    }
    if (lastEnd === 0) continue;
    if (lastEnd < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastEnd)));
    }
    node.parentNode.replaceChild(frag, node);
  }
}

// === Popover ===

let popoverEl = null;
let hideTimer = null;

function ensurePopover() {
  if (popoverEl) return popoverEl;
  popoverEl = document.createElement('div');
  popoverEl.id = 'glossary-popover';
  popoverEl.hidden = true;
  popoverEl.innerHTML = `
    <div class="gp-head">
      <strong class="gp-term"></strong>
      <span class="gp-source"></span>
    </div>
    <p class="gp-desc"></p>
    <a class="gp-link" target="_blank" rel="noopener">在設定庫中查看 →</a>
  `;
  document.body.appendChild(popoverEl);

  popoverEl.addEventListener('mouseenter', () => {
    clearTimeout(hideTimer);
  });
  popoverEl.addEventListener('mouseleave', () => {
    scheduleHide();
  });
  return popoverEl;
}

function scheduleHide(delay = 180) {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    if (popoverEl) {
      popoverEl.classList.remove('show');
      setTimeout(() => { if (popoverEl) popoverEl.hidden = true; }, 200);
    }
  }, delay);
}

function showPopover(termEl) {
  const term = termEl.dataset.term;
  const entry = state.glossary.get(term);
  if (!entry) return;

  const pop = ensurePopover();
  pop.querySelector('.gp-term').textContent = term;
  pop.querySelector('.gp-source').textContent = entry.source;
  
  // Prioritize display_text, fallback to desc
  const description = entry.display_text || entry.desc || '';
  pop.querySelector('.gp-desc').textContent = description;

  const link = pop.querySelector('.gp-link');
  link.href = `https://github.com/${config.githubOwner}/${config.githubRepo}/blob/${config.githubBranch}/${entry.file}`;

  pop.hidden = false;
  // Position above the term
  const rect = termEl.getBoundingClientRect();
  const popRect = pop.getBoundingClientRect();
  const popW = popRect.width || 300;
  let left = rect.left + rect.width / 2 - popW / 2 + window.scrollX;
  left = Math.max(8, Math.min(left, window.innerWidth - popW - 8));
  let top = rect.top + window.scrollY - popRect.height - 12;
  if (top < window.scrollY + 8) {
    // Flip below
    top = rect.bottom + window.scrollY + 12;
    pop.dataset.flip = 'below';
  } else {
    delete pop.dataset.flip;
  }
  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;

  requestAnimationFrame(() => pop.classList.add('show'));
  clearTimeout(hideTimer);
}

export function bindGlossaryPopover() {
  document.addEventListener('mouseover', (e) => {
    const term = e.target.closest('.term');
    if (!term) return;
    clearTimeout(hideTimer);
    showPopover(term);
  });
  document.addEventListener('mouseout', (e) => {
    const term = e.target.closest('.term');
    if (!term) return;
    scheduleHide();
  });

  // Mobile tap
  document.addEventListener('click', (e) => {
    const term = e.target.closest('.term');
    if (term) {
      e.preventDefault();
      e.stopPropagation();
      showPopover(term);
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => scheduleHide(0), 6000);
      return;
    }
    // Tap outside dismisses
    if (popoverEl && !popoverEl.hidden && !popoverEl.contains(e.target)) {
      scheduleHide(0);
    }
  }, { capture: true });
}

// === User toggle ===

export function setGlossaryEnabled(enabled) {
  state.glossaryEnabled = enabled;
  try {
    localStorage.setItem('reader-glossary-enabled', String(enabled));
  } catch {}
  document.body.classList.toggle('no-glossary', !enabled);
}
