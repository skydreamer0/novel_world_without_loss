// Annotation data layer: bookmarks (paragraph-level) + highlights (text-range).
// Storage shape (localStorage key "reader-annotations"):
//   { [chapterPath]: { bookmarks: Bookmark[], highlights: Highlight[] } }
//   Bookmark  = { id, paraIndex, ts }
//   Highlight = { id, paraIndex, start, end, snippet, ts }

import { state } from './state.js';

const STORAGE_KEY = 'reader-annotations';
const RESUME_KEY = 'reader-resume';

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function loadAnnotations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state.annotations = raw ? JSON.parse(raw) : {};
  } catch {
    state.annotations = {};
  }
  try {
    const raw = localStorage.getItem(RESUME_KEY);
    state.resume = raw ? JSON.parse(raw) : null;
  } catch {
    state.resume = null;
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.annotations));
  } catch (e) {
    console.warn('annotations persist failed', e);
  }
}

function getOrInit(path) {
  if (!state.annotations[path]) {
    state.annotations[path] = { bookmarks: [], highlights: [] };
  }
  return state.annotations[path];
}

export function chapterEntries(path) {
  return state.annotations[path] || null;
}

export function chapterHasAny(path) {
  const e = state.annotations[path];
  if (!e) return false;
  return (e.bookmarks && e.bookmarks.length > 0) || (e.highlights && e.highlights.length > 0);
}

// --- Bookmarks (paragraph-level) ---

export function toggleParaBookmark(path, paraIndex) {
  const entry = getOrInit(path);
  const idx = entry.bookmarks.findIndex(b => b.paraIndex === paraIndex);
  if (idx >= 0) {
    entry.bookmarks.splice(idx, 1);
  } else {
    entry.bookmarks.push({ id: uid(), paraIndex, ts: Date.now() });
  }
  persist();
  return idx < 0; // true = added
}

export function isParaBookmarked(path, paraIndex) {
  const entry = state.annotations[path];
  if (!entry) return false;
  return entry.bookmarks.some(b => b.paraIndex === paraIndex);
}

// --- Highlights ---

export function addHighlight(path, paraIndex, start, end, snippet) {
  const entry = getOrInit(path);
  const h = { id: uid(), paraIndex, start, end, snippet, ts: Date.now() };
  entry.highlights.push(h);
  persist();
  return h;
}

export function removeAnnotation(path, id) {
  const entry = state.annotations[path];
  if (!entry) return;
  entry.bookmarks = entry.bookmarks.filter(b => b.id !== id);
  entry.highlights = entry.highlights.filter(h => h.id !== id);
  persist();
}

// --- Resume position ---

export function setResume(path, paraIndex) {
  state.resume = { path, paraIndex, ts: Date.now() };
  try {
    localStorage.setItem(RESUME_KEY, JSON.stringify(state.resume));
  } catch {}
}

export function getResume() {
  return state.resume || null;
}

export function clearResume() {
  state.resume = null;
  try {
    localStorage.removeItem(RESUME_KEY);
  } catch {}
}
