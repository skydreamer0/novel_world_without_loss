import { state, els } from './state.js';
import { loadChapter } from './navigator.js';
import { renderSearchResults } from './search.js';
import { chapterHasAny } from './annotations.js';

// --- Sidebar Rendering ---

export function renderSidebar() {
  const list = els.chapterList;
  list.innerHTML = "";

  if (state.searchMode === 'fulltext' && state.filterText) {
    renderSearchResults(state.searchResults);
    return;
  }

  const groups = new Map();
  const filter = state.filterText.toLowerCase();

  state.files.forEach(file => {
    if (filter && !file.path.toLowerCase().includes(filter) && !file.title.toLowerCase().includes(filter)) return;

    const parts = file.path.split("/");
    const folder = parts.length > 1 ? parts.slice(0, -1).join("/") : "未分類";

    if (!groups.has(folder)) groups.set(folder, []);
    groups.get(folder).push(file);
  });

  for (const [folder, files] of groups) {
    const isExpanded = !state.collapsedFolders.has(folder) || filter.length > 0;

    const folderBtn = document.createElement("button");
    folderBtn.className = "folder";
    folderBtn.onclick = () => {
      if (state.collapsedFolders.has(folder)) state.collapsedFolders.delete(folder);
      else state.collapsedFolders.add(folder);
      renderSidebar();
    };
    folderBtn.setAttribute("aria-expanded", isExpanded);
    folderBtn.innerHTML = `
      <span class="folder-arrow">▶</span>
      <span>${folder}</span>
    `;
    list.appendChild(folderBtn);

    const groupDiv = document.createElement("div");
    groupDiv.className = "folder-group";
    if (!isExpanded) groupDiv.hidden = true;
    else groupDiv.style.height = "auto";

    files.forEach(file => {
      const btn = document.createElement("button");
      btn.className = "chapter-btn";
      btn.dataset.path = file.path;
      if (state.readChapters.has(file.path)) btn.dataset.read = "1";

      const label = document.createElement("span");
      label.className = "chapter-btn-label";
      label.textContent = file.title;
      btn.appendChild(label);

      if (state.bookmarks.has(file.path) || chapterHasAny(file.path)) {
        const flag = document.createElement("span");
        flag.className = "chapter-btn-flag";
        flag.textContent = "⚑";
        btn.appendChild(flag);
      }

      btn.onclick = () => loadChapter(file.path);
      if (state.activeIndex >= 0 && state.files[state.activeIndex]?.path === file.path) {
        btn.classList.add("active");
      }
      groupDiv.appendChild(btn);
    });

    list.appendChild(groupDiv);
  }
}

export function updateActiveSidebarItem() {
  const prev = els.chapterList.querySelector(".chapter-btn.active");
  if (prev) prev.classList.remove("active");

  const activeFile = state.files[state.activeIndex];
  if (!activeFile) return;

  const next = els.chapterList.querySelector(`.chapter-btn[data-path="${CSS.escape(activeFile.path)}"]`);
  if (!next) return;

  next.classList.add("active");
  if (state.readChapters.has(activeFile.path)) next.dataset.read = "1";
  next.scrollIntoView({ block: "center", behavior: "smooth" });
}

export function updateNavButtons() {
  els.prevBtn.disabled = state.activeIndex <= 0;
  els.nextBtn.disabled = state.activeIndex >= state.files.length - 1;
}

export function updateBookmarkUI() {
  if (state.activeIndex < 0) return;
  const path = state.files[state.activeIndex].path;
  const isBookmarked = state.bookmarks.has(path);
  const svg = els.bookmarkBtn.querySelector("svg");
  if (isBookmarked) {
    svg.style.fill = "currentColor";
  } else {
    svg.style.fill = "none";
  }
}
