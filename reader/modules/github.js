import { config, state, els } from './state.js';
import { naturalSort } from './sort.js';

export function getApiUrl(path) {
  const branch = config.githubBranch;
  const pathEnc = path.split("/").map(encodeURIComponent).join("/");
  return `https://raw.githubusercontent.com/${config.githubOwner}/${config.githubRepo}/${branch}/${pathEnc}`;
}

export async function fetchChapterText(path) {
  try {
    const relPath = location.pathname.includes('/reader/') ? `../${path}` : `./${path}`;
    const localResp = await fetch(encodeURI(relPath));
    if (localResp.ok) {
      const text = await localResp.text();
      if (!text.trim().startsWith("<!DOCTYPE") && !text.trim().startsWith("<html")) {
        return text;
      }
    }
  } catch (e) {
    // Fallthrough to remote fetch
  }

  const url = getApiUrl(path);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error("Chapter Load Failed");
  return await resp.text();
}

const TREE_CACHE_KEY = "reader-tree-cache";
const TREE_CACHE_TTL = 5 * 60 * 1000;

function getCachedTree() {
  try {
    const raw = localStorage.getItem(TREE_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.ts > TREE_CACHE_TTL) {
      localStorage.removeItem(TREE_CACHE_KEY);
      return null;
    }
    return cached.tree;
  } catch {
    return null;
  }
}

function setCachedTree(tree) {
  try {
    localStorage.setItem(TREE_CACHE_KEY, JSON.stringify({ ts: Date.now(), tree }));
  } catch {
    // localStorage full — ignore
  }
}

export async function loadFileList() {
  els.status.textContent = "正在同步資料...";

  const cached = getCachedTree();
  if (cached && cached.length > 0) {
    state.files = cached;
    els.status.textContent = `共 ${state.files.length} 章`;
    return;
  }

  // Local fallback: try loading reader/file-list.json first (great for local dev & offline)
  try {
    const listPath = location.pathname.includes('/reader/') ? 'file-list.json' : 'reader/file-list.json';
    const localResp = await fetch(`./${listPath}?t=${Date.now()}`);
    if (localResp.ok) {
      const localFiles = await localResp.json();
      if (Array.isArray(localFiles) && localFiles.length > 0) {
        state.files = localFiles.sort((a, b) => naturalSort(a.path, b.path));
        setCachedTree(state.files);
        els.status.textContent = `共 ${state.files.length} 章`;
        return;
      }
    }
  } catch (e) {
    // Ignore and proceed to GitHub API
  }

  const treeUrl = `https://api.github.com/repos/${config.githubOwner}/${config.githubRepo}/git/trees/${config.githubBranch}?recursive=1`;

  try {
    const resp = await fetch(treeUrl);
    if (!resp.ok) throw new Error("API Limit or Net Error");
    const data = await resp.json();

    state.files = data.tree
      .filter((item) => {
        if (item.type !== "blob") return false;
        const passExt = config.includeExtensions.some(ext => item.path.endsWith(ext));
        if (!passExt) return false;
        return config.includeFolders.some(folder => item.path.includes(folder));
      })
      .map(item => ({
        path: item.path,
        title: item.path.split("/").pop().replace(".md", ""),
        size: item.size
      }))
      .sort((a, b) => naturalSort(a.path, b.path));

    setCachedTree(state.files);
    els.status.textContent = `共 ${state.files.length} 章`;

  } catch (err) {
    console.error(err);
    els.status.textContent = "目錄載入失敗，3 秒後重試...";
    setTimeout(() => loadFileList(), 3000);
  }
}
