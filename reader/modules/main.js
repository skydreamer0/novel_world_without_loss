import { loadExternalConfig, inferGithubRepo, loadState } from './config.js';
import { applyTheme, applyFontSize } from './theme.js';
import { bindEvents } from './events.js';
import { initTTS } from './tts.js';
import { loadFileList } from './github.js';
import { renderSidebar } from './sidebar.js';
import { loadChapter } from './reader.js';
import { state } from './state.js';
import { loadAnnotations } from './annotations.js';
import { showError, wrapModule } from '../error-boundary.js';

// --- Main ---

export async function init() {
  try {
    await loadExternalConfig();
    inferGithubRepo();
    loadState();
    loadAnnotations();
    applyTheme();
    applyFontSize();
    bindEvents();

    initTTS();
    await wrapModule('loadFileList', () => loadFileList());
    renderSidebar();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('SW Registered!', reg))
        .catch(err => console.error('SW Failed', err));
    }

    const params = new URLSearchParams(window.location.search);
    const file = params.get("file") || localStorage.getItem("reader-last-read");

    if (file) {
      const fileExists = state.files && state.files.some(f => f.path === file);
      if (fileExists) {
        loadChapter(file);
      } else if (state.files && state.files.length > 0) {
        loadChapter(state.files[0].path);
      }
    } else if (state.files && state.files.length > 0) {
      loadChapter(state.files[0].path);
    }
  } catch (err) {
    console.error('[Main] 關鍵初始化失敗:', err);
    showError('部分功能載入失敗', '請重新整理頁面');
  }
}
