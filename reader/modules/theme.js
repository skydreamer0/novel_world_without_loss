import { state, els } from './state.js';
import { saveState } from './config.js';

// --- Theme & Appearance ---

// Order used when cycling with the top-nav button / keyboard shortcut.
export const THEME_ORDER = ["light", "sepia", "dark", "oled"];
const DARK_THEMES = new Set(["dark", "oled"]);
const THEME_COLORS = {
  light: "#faf7f0",
  sepia: "#f4ecd8",
  dark: "#0d1117",
  oled: "#000000",
};

const SUN_PATH = '<path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />';
const MOON_PATH = '<path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />';

export function applyTheme() {
  if (!THEME_ORDER.includes(state.theme)) state.theme = "light";
  document.body.dataset.theme = state.theme;

  // Keep the browser UI (status bar / address bar) in sync.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && THEME_COLORS[state.theme]) meta.setAttribute("content", THEME_COLORS[state.theme]);

  // Top-nav icon: show a sun on dark themes (tap to lighten), moon otherwise.
  if (els.themeToggle) {
    let svg = els.themeToggle.querySelector("svg");
    if (!svg) {
      els.themeToggle.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"></svg>';
      svg = els.themeToggle.querySelector("svg");
    }
    svg.innerHTML = DARK_THEMES.has(state.theme) ? SUN_PATH : MOON_PATH;
  }

  updateThemeSwatches();
  saveState("theme");
}

export function setTheme(name) {
  if (!THEME_ORDER.includes(name)) return;
  state.theme = name;
  applyTheme();
}

export function cycleTheme() {
  const idx = THEME_ORDER.indexOf(state.theme);
  const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
  setTheme(next);
}

function updateThemeSwatches() {
  if (!els.themeSwatches) return;
  els.themeSwatches.querySelectorAll(".theme-swatch").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.theme === state.theme);
    btn.setAttribute("aria-pressed", btn.dataset.theme === state.theme ? "true" : "false");
  });
}

export function applyFontSize() {
  document.documentElement.style.setProperty("--content-font-size", `${state.fontSize}rem`);
  saveState("fontSize");
}

// --- Reading typography: column width, line height, font family ---

export function applyTypography() {
  const root = document.documentElement.style;
  root.setProperty("--content-measure", `${state.measure}rem`);
  root.setProperty("--content-line-height", String(state.lineHeight));
  root.setProperty("--font-body", state.fontFamily === "sans" ? "var(--font-sans)" : "var(--font-serif)");
  updateTypographyUI();
}

function updateTypographyUI() {
  if (els.measureRange) els.measureRange.value = String(state.measure);
  if (els.measureLabel) els.measureLabel.textContent = `${state.measure} rem`;
  if (els.lineheightRange) els.lineheightRange.value = String(state.lineHeight);
  if (els.lineheightLabel) els.lineheightLabel.textContent = state.lineHeight.toFixed(2);
  if (els.fontFamilyToggle) {
    els.fontFamilyToggle.querySelectorAll(".seg-btn").forEach((btn) => {
      const active = btn.dataset.font === state.fontFamily;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }
}
