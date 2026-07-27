import { state, els } from './state.js';
import { loadChapter } from './reader.js';

// --- Bottom Panel & Gestures ---

export function toggleBottomPanel(show) {
  state.bottomPanelOpen = show;
  if (show) {
    els.bottomPanel.classList.add("active");
    els.bottomPanelOverlay.classList.add("active");
    els.panelFontLabel.textContent = state.fontSize.toFixed(1);
  } else {
    els.bottomPanel.classList.remove("active");
    els.bottomPanelOverlay.classList.remove("active");
  }
}

// --- Gesture Handlers ---

export function handleTouchStart(e) {
  if (e.touches.length !== 1) return;
  state.touchStartX = e.touches[0].clientX;
  state.touchStartY = e.touches[0].clientY;
}

export function handleTouchMove(e) {
  // Optional: Prevent default if gesture is recognized to stop scrolling
  // But we want to be careful not to block scrolling
}

export function handleTouchEnd(e) {
  if (e.changedTouches.length !== 1) return;

  const touchEndX = e.changedTouches[0].clientX;
  const touchEndY = e.changedTouches[0].clientY;

  const deltaX = touchEndX - state.touchStartX;
  const deltaY = touchEndY - state.touchStartY;

  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  if (window.innerWidth > 1024) return;

  if (state.touchStartX < 40 && deltaX > 60 && absY < 50) {
    els.app.classList.remove("sidebar-collapsed");
    return;
  }

  if (!els.app.classList.contains("sidebar-collapsed") && deltaX < -60 && absY < 50) {
    els.app.classList.add("sidebar-collapsed");
    return;
  }

  if (els.app.classList.contains("sidebar-collapsed") && absY < 50 && state.touchStartX >= 40) {
    if (deltaX < -60 && state.activeIndex < state.files.length - 1) {
      loadChapter(state.files[state.activeIndex + 1].path);
      return;
    }
    if (deltaX > 60 && state.activeIndex > 0) {
      loadChapter(state.files[state.activeIndex - 1].path);
      return;
    }
  }

  if (state.bottomPanelOpen && deltaY > 40 && absX < 60) {
    toggleBottomPanel(false);
    return;
  }
}
