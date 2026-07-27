import { state, els } from './state.js';

// --- Text-to-Speech (TTS) ---

export function initTTS() {
  const loadVoices = () => {
    const voices = window.speechSynthesis.getVoices();
    state.tts.voice = voices.find(v => (v.lang === "zh-TW" || v.lang === "zh-HK" || v.lang === "zh-CN") && v.name.includes("Google"))
      || voices.find(v => v.lang === "zh-TW" || v.lang === "zh-HK" || v.lang === "zh-CN");
  };

  loadVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
}

export function stopTTS() {
  window.speechSynthesis.cancel();
  state.tts.speaking = false;
  state.tts.paused = false;
  state.ttsQueue = [];
  state.ttsChunkIndex = 0;
  updateTTSIcon();
}

export function playNextChunk() {
  if (!state.tts.speaking) return;
  if (state.tts.paused) return;

  if (state.ttsChunkIndex >= state.ttsQueue.length) {
    stopTTS();
    return;
  }

  const text = state.ttsQueue[state.ttsChunkIndex];
  const u = new SpeechSynthesisUtterance(text);

  if (state.tts.voice) u.voice = state.tts.voice;
  u.rate = state.ttsRate;

  state.ttsUtterance = u;

  u.onend = () => {
    state.ttsChunkIndex++;
    playNextChunk();
  };

  u.onerror = (e) => {
    console.warn("TTS Error", e);
    state.ttsChunkIndex++;
    setTimeout(playNextChunk, 100);
  };

  window.speechSynthesis.speak(u);
}

export function toggleTTS() {
  if (state.tts.speaking && !state.tts.paused) {
    window.speechSynthesis.pause();
    state.tts.paused = true;
  } else if (state.tts.paused) {
    window.speechSynthesis.resume();
    state.tts.paused = false;
  } else {
    let fullText = "";

    if (state.ttsStartMode === "beginning") {
      fullText = els.content.innerText;
    } else {
      const elements = els.content.querySelectorAll("p, h1, h2, h3, blockquote, li");
      let startIndex = 0;
      const viewportTop = window.scrollY + 80;

      for (let i = 0; i < elements.length; i++) {
        const rect = elements[i].getBoundingClientRect();
        if (rect.bottom > 80 && rect.top + window.scrollY > viewportTop) {
          startIndex = i;
          break;
        }
      }

      const chunks = [];
      for (let i = startIndex; i < elements.length; i++) {
        const t = elements[i].innerText.trim();
        if (t) chunks.push(t);
      }
      state.ttsQueue = chunks;
    }

    if (state.ttsStartMode === "beginning" && !state.ttsQueue.length) {
      state.ttsQueue = els.content.innerText.split(/\n+/).filter(t => t.trim().length > 0);
    }

    if (state.ttsQueue.length === 0) return;

    state.tts.speaking = true;
    state.tts.paused = false;
    state.ttsChunkIndex = 0;

    playNextChunk();
  }
  updateTTSIcon();
}

export function updateTTSIcon() {
  const isPlaying = state.tts.speaking && !state.tts.paused;

  const svg = els.ttsToggle.querySelector("svg");
  if (isPlaying) {
    svg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />';
    els.ttsToggle.classList.add("speaking");
  } else {
    svg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />';
    els.ttsToggle.classList.remove("speaking");
  }

  if (isPlaying) {
    els.ttsPanelToggle.textContent = "⏸ 暫停朗讀";
    els.ttsPanelToggle.classList.add("playing");
  } else {
    els.ttsPanelToggle.textContent = "▶ 開始朗讀";
    els.ttsPanelToggle.classList.remove("playing");
  }
}
