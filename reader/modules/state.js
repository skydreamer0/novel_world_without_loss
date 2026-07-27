// --- Configuration & State ---
export const config = {
  githubOwner: "skydreamer0",
  githubRepo: "novel_world_without_loss",
  githubBranch: "master",
  includeExtensions: [".md", ".MD"],
  includeFolders: ["manuscript"],
  configFile: "reader/config.json",
};

export const PERSISTED_KEYS = {
  theme: 'reader-theme',
  fontSize: 'reader-font-size',
  ttsRate: 'reader-tts-rate',
  ttsStartMode: 'reader-tts-start-mode',
};

export const CONFIG_KEYS = [
  "githubOwner",
  "githubRepo",
  "githubBranch",
  "includeExtensions",
  "includeFolders",
];

export const state = {
  files: [],
  activeIndex: -1,
  filterText: "",
  collapsedFolders: new Set(),
  bookmarks: new Set(),
  readChapters: new Set(),
  scrollPositions: {},
  lastScrollY: 0,
  navHidden: false,
  annotations: {},
  resume: null,
  paraObserver: null,
  lastVisiblePara: -1,
  annotPanelOpen: false,
  theme: "light",
  fontSize: 1.125,
  tts: {
    speaking: false,
    paused: false,
    utterance: null,
    voice: null
  },
  loadedChapters: [],
  isLoadingNext: false,
  observer: null,
  bottomPanelOpen: false,
  ttsRate: 1.0,
  ttsStartMode: "current",
  ttsQueue: [],
  ttsChunkIndex: 0,
  ttsUtterance: null,
  touchStartX: 0,
  touchStartY: 0,
  searchMode: 'filter',
  searchResults: [],
  searchContentCache: {},
  searchAbortController: null,
  isSearching: false,
};

// --- DOM Elements ---
export const els = {
  app: document.querySelector(".app"),
  sidebar: document.getElementById("sidebar"),
  sidebarOverlay: document.querySelector(".sidebar-overlay"),
  chapterList: document.getElementById("chapter-list"),
  content: document.getElementById("content"),
  chapterTitle: document.getElementById("chapter-title"),
  status: document.getElementById("status"),
  searchInput: document.getElementById("search-input"),
  searchWrap: document.querySelector(".search-wrap"),
  readingProgress: document.getElementById("reading-progress"),

  // Buttons
  menuBtn: document.getElementById("menu-btn"),
  sidebarCloseBtn: document.getElementById("sidebar-close-btn"),
  themeToggle: document.getElementById("theme-toggle"),
  ttsToggle: document.getElementById("tts-toggle"),
  fontSizeInc: document.getElementById("font-size-inc"),
  fontSizeDec: document.getElementById("font-size-dec"),
  bookmarkBtn: document.getElementById("bookmark-btn"),
  prevBtn: document.getElementById("prev-btn"),
  nextBtn: document.getElementById("next-btn"),
  wordCount: document.getElementById("word-count"),

  // Bottom Panel & New Controls
  bottomPanel: document.getElementById("bottom-panel"),
  bottomPanelOverlay: document.querySelector(".bottom-panel-overlay"),
  bottomPanelHandle: document.querySelector(".bottom-panel-handle"),

  // Bottom Panel TTS
  ttsPanelToggle: document.getElementById("tts-panel-toggle"),
  ttsStopBtn: document.getElementById("tts-stop-btn"),
  ttsRateInput: document.getElementById("tts-rate"),
  ttsRateLabel: document.getElementById("tts-rate-label"),
  ttsStartSelect: document.getElementById("tts-start-select"),

  // Bottom Panel Settings
  panelThemeToggle: document.getElementById("panel-theme-toggle"),
  panelFontInc: document.getElementById("panel-font-inc"),
  panelFontDec: document.getElementById("panel-font-dec"),
  panelFontLabel: document.getElementById("panel-font-label"),

  // Annotations UI
  annotToggle: document.getElementById("annot-toggle"),
  annotPanel: document.getElementById("annot-panel"),
  annotPanelOverlay: document.querySelector(".annot-panel-overlay"),
  annotPanelBody: document.querySelector(".annot-panel-body"),
  annotPanelClose: document.querySelector(".annot-panel-close"),
  highlightFab: document.getElementById("highlight-fab"),
  resumeToast: document.getElementById("resume-toast"),
  resumeToastText: document.querySelector("#resume-toast .resume-text"),
  resumeJumpBtn: document.querySelector("#resume-toast .resume-jump"),
  resumeDismissBtn: document.querySelector("#resume-toast .resume-dismiss"),
};
