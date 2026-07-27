import { config, CONFIG_KEYS, state, PERSISTED_KEYS } from './state.js';

const SCHEMA_VERSION = 1;

// --- Initialization ---

export function inferGithubRepo() {
  const host = window.location.hostname;
  if (host.endsWith(".github.io")) {
    config.githubOwner = host.replace(".github.io", "");
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts.length > 0) config.githubRepo = parts[0];
  }

  const params = new URLSearchParams(window.location.search);
  if (params.has("owner")) config.githubOwner = params.get("owner");
  if (params.has("repo")) config.githubRepo = params.get("repo");
  if (params.has("branch")) config.githubBranch = params.get("branch");
  if (params.has("folders")) {
    config.includeFolders = params.get("folders").split(",").map(v => v.trim()).filter(Boolean);
  }
  if (params.has("ext")) {
    config.includeExtensions = params.get("ext").split(",").map(v => v.trim()).filter(Boolean);
  }
}

export function mergeConfig(partialConfig) {
  if (!partialConfig || typeof partialConfig !== "object") return;

  for (const key of CONFIG_KEYS) {
    if (!(key in partialConfig)) continue;

    if (Array.isArray(config[key])) {
      if (Array.isArray(partialConfig[key])) {
        config[key] = partialConfig[key].map(v => String(v).trim()).filter(Boolean);
      }
    } else if (typeof partialConfig[key] === "string") {
      config[key] = partialConfig[key].trim();
    }
  }
}

export async function loadExternalConfig() {
  try {
    const configPath = location.pathname.endsWith("/config.json")
      ? "config.json"
      : (location.pathname.includes("/reader/") ? "config.json" : "reader/config.json");
    const resp = await fetch(`./${configPath}?t=${Date.now()}`, { cache: "no-store" });
    if (!resp.ok) return;
    const data = await resp.json();
    mergeConfig(data);
  } catch (err) {
    console.info("No external reader config loaded", err);
  }
}

export function loadState() {
  try {
    const savedBookmarks = JSON.parse(localStorage.getItem("reader-bookmarks") || "[]");
    state.bookmarks = new Set(savedBookmarks);

    const savedRead = JSON.parse(localStorage.getItem("reader-read") || "[]");
    state.readChapters = new Set(savedRead);

    const savedScroll = JSON.parse(localStorage.getItem("reader-scroll-pos") || "{}");
    state.scrollPositions = savedScroll;

    for (const [key, lsKey] of Object.entries(PERSISTED_KEYS)) {
      const raw = localStorage.getItem(lsKey);
      if (raw === null) continue;
      if (key === 'fontSize' || key === 'ttsRate') {
        state[key] = parseFloat(raw);
      } else if (key === 'glossaryEnabled') {
        state[key] = raw !== 'false';
      } else {
        state[key] = raw;
      }
    }

    if (!localStorage.getItem(PERSISTED_KEYS.theme)) {
      state.theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }

    localStorage.setItem('reader-schema-version', String(SCHEMA_VERSION));
  } catch (e) {
    console.warn("Failed to load state", e);
  }
}

export function saveState(key) {
  try {
    if (key === "bookmarks") {
      localStorage.setItem("reader-bookmarks", JSON.stringify([...state.bookmarks]));
    } else if (key === "readChapters") {
      localStorage.setItem("reader-read", JSON.stringify([...state.readChapters]));
    } else if (key === "scroll") {
      localStorage.setItem("reader-scroll-pos", JSON.stringify(state.scrollPositions));
    } else if (key === "lastRead") {
      if (state.activeIndex >= 0) {
        localStorage.setItem("reader-last-read", state.files[state.activeIndex].path);
      }
    } else if (key in PERSISTED_KEYS) {
      localStorage.setItem(PERSISTED_KEYS[key], String(state[key]));
    }
  } catch (e) {
    console.warn("Failed to save state", e);
  }
}
