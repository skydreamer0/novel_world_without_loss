/**
 * Dossier Memory Module
 *
 * Provides Base64 export/import of the reader's localStorage progress
 * (Secret Dossier feature). Uses the GLOBAL progress (highest chapter
 * across `reader-read` + `reader-last-read`) for the export payload but
 * preserves both raw localStorage keys so that importing on another
 * device restores both global progress and current contextual reading
 * without destroying the user's in-progress re-read position.
 *
 * Storage keys touched (read & written):
 *   - reader-read       : JSON array of chapter ids / paths (history)
 *   - reader-last-read  : string (current contextual position)
 */

import { getGlobalProgress, extractChapterNumber } from './progress.js';

const READ_KEY = 'reader-read';
const LAST_KEY = 'reader-last-read';
const PAYLOAD_VERSION = 2;

function safeParseReadHistory() {
    try {
        const raw = localStorage.getItem(READ_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return [];
    }
}

function utf8ToBase64(str) {
    if (typeof TextEncoder !== 'undefined') {
        const bytes = new TextEncoder().encode(str);
        let bin = '';
        for (const b of bytes) bin += String.fromCharCode(b);
        return btoa(bin);
    }
    return btoa(unescape(encodeURIComponent(str)));
}

function base64ToUtf8(code) {
    const bin = atob(code);
    if (typeof TextDecoder !== 'undefined') {
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new TextDecoder().decode(bytes);
    }
    return decodeURIComponent(escape(bin));
}

/**
 * Build the export payload object (also returned so callers can preview).
 */
export function buildMemoryPayload() {
    const readHistory = safeParseReadHistory();
    const lastRead = localStorage.getItem(LAST_KEY) || '';
    return {
        version: PAYLOAD_VERSION,
        exportedAt: new Date().toISOString(),
        globalProgress: getGlobalProgress(),
        readHistory,
        lastRead
    };
}

/**
 * Encode the current memory fragment as a Base64 string.
 * @returns {string} Base64-encoded JSON payload.
 */
export function encodeMemoryFragment() {
    return utf8ToBase64(JSON.stringify(buildMemoryPayload()));
}

/**
 * Decode a Base64 memory fragment into a structured payload.
 * Throws on invalid input.
 * @param {string} code
 * @returns {object}
 */
export function decodeMemoryFragment(code) {
    if (typeof code !== 'string' || !code.trim()) {
        throw new Error('Empty memory fragment.');
    }
    const json = base64ToUtf8(code.trim());
    const payload = JSON.parse(json);
    if (!payload || typeof payload !== 'object') {
        throw new Error('Malformed memory fragment.');
    }
    if (!payload.version) {
        throw new Error('Unknown memory fragment version.');
    }
    return payload;
}

/**
 * Apply an imported payload to localStorage.
 *
 * Behaviour:
 *  - `reader-read` becomes the UNION of the existing array and the imported
 *    array (deduplicated), so global unlock progress can only grow — never
 *    regress — when importing.
 *  - `reader-last-read` (current contextual position) is preserved by default
 *    so an in-progress re-read isn't destroyed. It is only overwritten when
 *    the local key is missing, OR when `options.overwriteLastRead === true`
 *    (e.g. user confirmed in a dialog).
 *
 * @param {object} payload Result from decodeMemoryFragment().
 * @param {{overwriteLastRead?: boolean}} [options]
 * @returns {{addedEntries: number, lastReadUpdated: boolean, newGlobalProgress: number}}
 */
export function applyMemoryPayload(payload, options = {}) {
    if (!payload || typeof payload !== 'object') {
        throw new Error('Invalid payload.');
    }

    const incomingHistory = Array.isArray(payload.readHistory) ? payload.readHistory : [];
    const existing = safeParseReadHistory();
    const merged = existing.slice();
    const seen = new Set(existing.map(v => String(v)));
    let added = 0;
    for (const entry of incomingHistory) {
        const key = String(entry);
        if (!seen.has(key)) {
            merged.push(entry);
            seen.add(key);
            added++;
        }
    }
    localStorage.setItem(READ_KEY, JSON.stringify(merged));

    let lastReadUpdated = false;
    const currentLast = localStorage.getItem(LAST_KEY);
    const incomingLast = typeof payload.lastRead === 'string' ? payload.lastRead : '';
    if (incomingLast) {
        if (!currentLast || options.overwriteLastRead === true) {
            localStorage.setItem(LAST_KEY, incomingLast);
            lastReadUpdated = true;
        }
    }

    return {
        addedEntries: added,
        lastReadUpdated,
        newGlobalProgress: getGlobalProgress(),
        incomingGlobalProgress: extractChapterNumber(incomingLast) || (payload.globalProgress || 0)
    };
}

/**
 * Convenience: encode + write to clipboard (with prompt fallback).
 * @returns {Promise<{code: string, payload: object}>}
 */
export async function exportMemory() {
    const payload = buildMemoryPayload();
    const code = utf8ToBase64(JSON.stringify(payload));
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(code);
        } else {
            window.prompt('請複製以下記憶片段代碼：', code);
        }
    } catch (_) {
        window.prompt('請複製以下記憶片段代碼：', code);
    }
    return { code, payload };
}

/**
 * Convenience: prompt for a fragment, decode and apply it.
 * Returns null if the user cancels.
 * @param {{overwriteLastRead?: boolean, prompt?: (msg:string)=>string|null}} [options]
 */
export function importMemory(options = {}) {
    const ask = options.prompt || ((msg) => window.prompt(msg));
    const code = ask('請貼上記憶片段代碼：');
    if (code === null || code === undefined) return null;
    const payload = decodeMemoryFragment(code);
    return { payload, result: applyMemoryPayload(payload, options) };
}
