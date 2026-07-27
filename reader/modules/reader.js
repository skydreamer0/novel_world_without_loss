import { state, els } from './state.js';
import { getApiUrl, fetchChapterText } from './github.js';
import { stopTTS } from './tts.js';
import { countWords } from './sort.js';
import { saveState } from './config.js';
import { updateActiveSidebarItem, updateNavButtons, updateBookmarkUI } from './sidebar.js';
import {
  renderAnnotPanel, applyHighlightsToSection, observeParas, showResumeToastIfAny
} from './annotation_render.js';
import { indexParagraphs } from './annotation_render.js';

// --- Chapter Loading & Rendering ---

export async function loadChapter(path) {
  stopTTS();
  const index = state.files.findIndex(f => f.path === path);
  if (index === -1) return;

  state.loadedChapters = [];
  state.isLoadingNext = false;
  state.activeIndex = index;

  els.chapterTitle.textContent = "載入中...";
  els.content.classList.add("loading");
  els.content.innerHTML = "";
  updateActiveSidebarItem();

  try {
    const text = await fetchChapterText(path);

    const titleMatch = text.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : state.files[index].title;
    state.files[index].title = title;

    const section = createChapterSection(index, title, text);
    els.content.innerHTML = "";
    els.content.appendChild(section);

    state.loadedChapters = [index];

    appendSentinel();

    els.chapterTitle.textContent = title;
    const statusEl = document.getElementById("content-status");
    if (statusEl) statusEl.textContent = `已載入：${title}`;
    const chapName = state.files[index].path.split('/').pop().replace('.md', '');
    document.title = `${chapName} - 《無漏》`;
    updateWordCount(text);

    const savedPos = state.scrollPositions[path];
    window.scrollTo({ top: savedPos || 0, behavior: "auto" });

    els.content.classList.remove("loading");
    els.content.style.opacity = "0";
    els.content.style.transform = "translateY(8px)";
    requestAnimationFrame(() => {
      els.content.style.transition = "opacity 0.5s ease-out, transform 0.5s var(--ease-spring)";
      els.content.style.opacity = "1";
      els.content.style.transform = "translateY(0)";
    });
    setTimeout(() => manageFocus(), 100);

    updateNavButtons();
    updateBookmarkUI();

    if (!state.readChapters.has(path)) {
      state.readChapters.add(path);
      saveState("readChapters");
    }

    const urlObj = new URL(window.location);
    urlObj.searchParams.set("file", path);
    window.history.replaceState({ path }, "", urlObj);
    saveState("lastRead");

    // Annotations integration
    observeParas(section, path);
    renderAnnotPanel(path);
    showResumeToastIfAny(path, title);

    if (window.innerWidth <= 1024) {
      els.app.classList.add("sidebar-collapsed");
    }

  } catch (err) {
    els.content.classList.remove("loading");
    els.content.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--accent)">
      <h3>讀取失敗</h3><p>${err.message}</p>
      <button onclick="location.reload()" class="nav-btn" style="margin:20px auto; width:auto">重試</button>
    </div>`;
  }
}

export function manageFocus() {
  const title = els.chapterTitle;
  title.setAttribute("tabindex", "-1");
  title.focus({ preventScroll: true });
  title.addEventListener("blur", () => {
    title.removeAttribute("tabindex");
  }, { once: true });
}

const marked = window.marked;

// Skip drop-cap when first character is a CJK opening punctuation or quote
const DROPCAP_SKIP = /^[「『"'（(《〈【\[—…\s]/;

export function createChapterSection(index, title, rawText) {
  const section = document.createElement("section");
  section.className = "chapter-section";
  section.dataset.chapterIndex = index;
  section.dataset.chapterPath = state.files[index].path;
  section.innerHTML = marked.parse(rawText);

  // Mark first prose paragraph for drop-cap (skip headings, blockquotes, hr-led blocks)
  const firstP = section.querySelector(":scope > p");
  if (firstP) {
    const text = firstP.textContent.trim();
    if (text && !DROPCAP_SKIP.test(text)) {
      firstP.classList.add("has-dropcap");
    }
  }

  // Index paragraphs + apply saved highlights for this chapter
  const path = state.files[index].path;
  indexParagraphs(section, path);
  applyHighlightsToSection(section, path);

  return section;
}

export function createChapterDivider(title) {
  const divider = document.createElement("div");
  divider.className = "chapter-divider";
  divider.innerHTML = `
    <div class="divider-line"></div>
    <span class="divider-title">${title}</span>
    <div class="divider-line"></div>
  `;
  return divider;
}

export function appendSentinel() {
  const old = document.getElementById("load-sentinel");
  if (old) old.remove();

  const lastLoaded = state.loadedChapters[state.loadedChapters.length - 1];
  if (lastLoaded >= state.files.length - 1) return;

  const sentinel = document.createElement("div");
  sentinel.id = "load-sentinel";
  sentinel.className = "load-sentinel";
  sentinel.innerHTML = '<div class="loading-spinner"><div></div><div></div><div></div></div>';
  els.content.appendChild(sentinel);

  if (state.observer) state.observer.disconnect();
  state.observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !state.isLoadingNext) {
      appendNextChapter();
    }
  }, { rootMargin: "600px" });
  state.observer.observe(sentinel);
}

export async function appendNextChapter() {
  if (state.isLoadingNext) return;
  const lastLoaded = state.loadedChapters[state.loadedChapters.length - 1];
  const nextIndex = lastLoaded + 1;
  if (nextIndex >= state.files.length) return;

  state.isLoadingNext = true;

  try {
    const file = state.files[nextIndex];
    const url = getApiUrl(file.path);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("Load Failed");
    const text = await resp.text();

    const titleMatch = text.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : file.title;
    state.files[nextIndex].title = title;

    const oldSentinel = document.getElementById("load-sentinel");
    if (oldSentinel) oldSentinel.remove();

    const divider = createChapterDivider(title);
    const section = createChapterSection(nextIndex, title, text);
    els.content.appendChild(divider);
    els.content.appendChild(section);

    section.style.opacity = "0";
    requestAnimationFrame(() => {
      section.style.transition = "opacity 0.8s ease-out";
      section.style.opacity = "1";
    });

    state.loadedChapters.push(nextIndex);
    // Highlights for the appended chapter are applied inside createChapterSection
    // but the IntersectionObserver still tracks paragraphs of the first chapter
    // (resume target = first loaded chapter), so we don't re-observe here.

    appendSentinel();

  } catch (err) {
    console.error("Failed to append next chapter:", err);
  } finally {
    state.isLoadingNext = false;
  }
}

export function updateWordCount(text) {
  const wc = countWords(text);
  const readingTime = Math.max(1, Math.round(wc / 350));
  els.wordCount.textContent = `| ${wc} 字 · 約 ${readingTime} 分鐘`;
  els.wordCount.title = wc < 3000 ? "字數較少" : "字數充足";
  els.wordCount.style.color = wc < 3000 ? "var(--accent)" : "var(--muted)";
}

export function updateReadingProgress() {
  const scrollTop = window.scrollY;
  const docHeight = document.body.scrollHeight - window.innerHeight;
  const scrollPercent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
  els.readingProgress.style.width = `${scrollPercent}%`;

  if (state.loadedChapters.length > 0) {
    const firstPath = state.files[state.loadedChapters[0]].path;
    state.scrollPositions[firstPath] = scrollTop;
  }

  // Scroll-aware top-nav: hide on scroll down, show on scroll up or near top
  const delta = scrollTop - state.lastScrollY;
  if (scrollTop < 80) {
    if (state.navHidden) {
      document.body.classList.remove("nav-hidden");
      state.navHidden = false;
    }
  } else if (delta > 6 && !state.navHidden) {
    document.body.classList.add("nav-hidden");
    state.navHidden = true;
  } else if (delta < -6 && state.navHidden) {
    document.body.classList.remove("nav-hidden");
    state.navHidden = false;
  }
  state.lastScrollY = scrollTop;

  updateVisibleChapterTitle();
}

export function updateVisibleChapterTitle() {
  const sections = els.content.querySelectorAll(".chapter-section");
  if (sections.length === 0) return;

  const viewportMiddle = window.scrollY + window.innerHeight * 0.3;
  let currentSection = sections[0];

  for (const section of sections) {
    const rect = section.getBoundingClientRect();
    const sectionTop = rect.top + window.scrollY;
    if (sectionTop <= viewportMiddle) {
      currentSection = section;
    } else {
      break;
    }
  }

  const idx = parseInt(currentSection.dataset.chapterIndex, 10);
  if (!isNaN(idx) && idx !== state.activeIndex) {
    state.activeIndex = idx;
    els.chapterTitle.textContent = state.files[idx].title;
    const chapName = state.files[idx].path.split('/').pop().replace('.md', '');
    document.title = `${chapName} - 《無漏》`;
    updateBookmarkUI();
    updateActiveSidebarItem();

    const path = state.files[idx].path;
    if (!state.readChapters.has(path)) {
      state.readChapters.add(path);
      saveState("readChapters");
    }

    const urlObj = new URL(window.location);
    urlObj.searchParams.set("file", path);
    window.history.replaceState({ path }, "", urlObj);
    saveState("lastRead");
  }
}
