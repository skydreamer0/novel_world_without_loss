// reader/dossier.js
// Secret Dossier entry point. Wires the modular pipeline:
//   progress  -> dossier-data -> dossier-render -> dossier-sync
// Memory fragment export/import is handled by dossier-memory.

import { getGlobalProgress } from './modules/progress.js';
import { loadFullDossier } from './modules/dossier-data.js';
import { renderDossierCards } from './modules/dossier-render.js';
import { performSync } from './modules/dossier-sync.js';
import {
    exportMemory,
    decodeMemoryFragment,
    applyMemoryPayload
} from './modules/dossier-memory.js';

const SELECTORS = {
    grid: '#dossier-grid',
    status: '#sync-status',
    exportBtn: '#export-btn',
    importBtn: '#import-btn',
    filterBtns: '.filter-btn'
};

let currentItems = [];
let currentFilter = 'all';
let currentProgress = 0;

function getActiveFilterFromDOM() {
    const active = document.querySelector('.filter-btn.active');
    if (!active) return 'all';
    return active.dataset.category || active.dataset.source || 'all';
}

function rerender() {
    const grid = document.querySelector(SELECTORS.grid);
    if (!grid) return;
    if (!currentItems.length) {
        grid.innerHTML = '<div class="loading-state">【查無符合條件之名錄檔案】</div>';
        return;
    }
    renderDossierCards(grid, currentItems, currentProgress, currentFilter);
}

function bindFilters() {
    const btns = document.querySelectorAll(SELECTORS.filterBtns);
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.category || btn.dataset.source || 'all';
            rerender();
        });
    });
}

function bindMemoryButtons() {
    const exportBtn = document.querySelector(SELECTORS.exportBtn);
    const importBtn = document.querySelector(SELECTORS.importBtn);
    const status = document.querySelector(SELECTORS.status);

    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            try {
                await exportMemory();
                if (status) status.textContent = '> 記憶片段已導出至剪貼簿';
            } catch (err) {
                console.error('Export failed:', err);
                if (status) status.textContent = '> 記憶片段導出失敗';
            }
        });
    }

    if (importBtn) {
        importBtn.addEventListener('click', async () => {
            const code = window.prompt('請貼上記憶片段代碼：');
            if (!code) return;
            try {
                const payload = decodeMemoryFragment(code);
                const localLast = localStorage.getItem('reader-last-read');
                let overwriteLastRead = false;
                if (localLast && payload.lastRead && payload.lastRead !== localLast) {
                    overwriteLastRead = window.confirm(
                        '匯入的閱讀位置與目前不同，是否覆蓋當前閱讀位置？\n（取消則只更新全域進度，保留當前章節）'
                    );
                }
                const result = applyMemoryPayload(payload, { overwriteLastRead });
                if (status) {
                    status.textContent = `> 記憶覆寫完成：新增 ${result.addedEntries} 筆，全域進度 Ch.${result.newGlobalProgress}`;
                }
                // Re-sync UI against the (possibly higher) global progress.
                const newProgress = getGlobalProgress();
                const grid = document.querySelector(SELECTORS.grid);
                if (status && grid) {
                    await performSync(status, currentItems, currentProgress, newProgress, () => {
                        grid.classList.add('pulse');
                        setTimeout(() => grid.classList.remove('pulse'), 1000);
                    });
                }
                currentProgress = newProgress;
                rerender();
            } catch (err) {
                console.error('Import failed:', err);
                if (status) status.textContent = '> 無效的記憶片段';
                window.alert('無效的記憶片段');
            }
        });
    }
}

export async function init() {
    const grid = document.querySelector(SELECTORS.grid);
    const status = document.querySelector(SELECTORS.status);
    if (!grid) {
        console.error('Dossier grid container not found.');
        return;
    }

    bindFilters();
    bindMemoryButtons();
    currentFilter = getActiveFilterFromDOM();

    try {
        currentProgress = getGlobalProgress();
        currentItems = await loadFullDossier();
        rerender();

        if (status) {
            // Animate an initial sync pulse from 0 -> currentProgress so users
            // see how many entries are unlocked at load time.
            await performSync(status, currentItems, 0, currentProgress, () => {
                grid.classList.add('pulse');
                setTimeout(() => grid.classList.remove('pulse'), 1000);
            });
        }
    } catch (error) {
        console.error('Failed to initialize Dossier:', error);
        if (status) status.textContent = '> 母巢連線失敗';
    }
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}
