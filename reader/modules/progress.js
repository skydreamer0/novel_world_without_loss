/**
 * Progress Module
 * Centralizes localStorage logic and distinguishes between global and contextual progress.
 */

/**
 * Robustly extract an integer from strings like "第150章" or paths like "01_第一卷_艙底種火/第150章_標題.md".
 * @param {string|number} input 
 * @returns {number} The chapter number, or 0 if not found.
 */
export function extractChapterNumber(input) {
    if (typeof input === 'number') {
        return isNaN(input) ? 0 : Math.floor(input);
    }
    if (!input || typeof input !== 'string') return 0;
    
    // Isolate filename to avoid matching directory numbers (like 01_第一卷)
    const filename = input.split('/').pop().split('\\').pop();

    // 1. Try '第150章' (highest priority)
    const chapterMatch = filename.match(/第(\d+)章/);
    if (chapterMatch) return parseInt(chapterMatch[1], 10);

    // 2. Try '150章'
    const suffixMatch = filename.match(/(\d+)章/);
    if (suffixMatch) return parseInt(suffixMatch[1], 10);

    // 3. Try English markers 'chapter-150', 'ch150', 'chapter_150'
    const enMatch = filename.match(/(?:ch|chapter)[-_]*(\d+)/i);
    if (enMatch) return parseInt(enMatch[1], 10);

    // 4. Fallback: Find the FIRST number in the filename.
    // Since we isolated the filename, the first number is usually the chapter identifier.
    const fallbackMatch = filename.match(/(\d+)/);
    if (fallbackMatch) {
        return parseInt(fallbackMatch[1], 10);
    }

    return 0;
}

/**
 * Returns highest value from `reader-read` (array of integers/paths) or `reader-last-read` (integer/string).
 * @returns {number} The highest chapter number reached globally.
 */
export function getGlobalProgress() {
    if (typeof localStorage === 'undefined') return 0;
    
    let maxProgress = 0;

    // Support existing `reader-last-read` (integer or path string)
    const lastRead = localStorage.getItem('reader-last-read');
    if (lastRead) {
        maxProgress = extractChapterNumber(lastRead);
    }

    // Support existing `reader-read` (JSON array of integers/paths)
    const readHistory = localStorage.getItem('reader-read');
    if (readHistory) {
        try {
            const historyArray = JSON.parse(readHistory);
            if (Array.isArray(historyArray) && historyArray.length > 0) {
                // Find max in one pass
                maxProgress = historyArray.reduce((max, item) => {
                    const num = extractChapterNumber(item);
                    return Math.max(max, num);
                }, maxProgress);
            }
        } catch (e) {
            console.warn('Failed to parse reader-read history:', e);
        }
    }

    return maxProgress;
}

/**
 * Identifies the contextual progress.
 * If `chapterId` is provided, extract its number; else fallback to `reader-last-read`.
 * @param {string|number} [chapterId] 
 * @returns {number} The chapter number for the given context.
 */
export function getContextualProgress(chapterId) {
    if (chapterId !== undefined && chapterId !== null) {
        return extractChapterNumber(chapterId);
    }

    if (typeof localStorage === 'undefined') return 0;

    const lastRead = localStorage.getItem('reader-last-read');
    if (lastRead) {
        return extractChapterNumber(lastRead);
    }

    return 0;
}
