// reader/modules/dossier-data.js

const PUBLIC_DOSSIER_SOURCES = [
    './public-dossier/index.json',
    './public-dossier/characters.json',
    './public-dossier/world.json',
    './public-dossier/power.json'
];

function normalizePublicDossierPayload(payload, sourcePath) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.items)) return payload.items;
    console.warn(`Public dossier source ${sourcePath} must be an array or an object with an items array.`);
    return [];
}

function mapPublicDossierItem(item) {
    const title = item.title || item.term || item.id || 'Unknown';
    const unlock = Number.isFinite(item.unlockChapter) ? item.unlockChapter : (item.unlock || 0);

    return {
        id: item.id || title,
        title,
        term: title,
        category: item.category || '其他',
        visibility: item.visibility || 'partial',
        unlock,
        unlock_stages: item.unlockStages || item.unlock_stages || [],
        details: item.readerText || item.teaser || '',
        display_priority: item.displayPriority || item.display_priority || unlock,
        supplementalArchive: '',
        source: 'Public Dossier',
        teaser: item.teaser || '',
        lockedText: item.lockedText || '',
        spoilerLevel: item.spoilerLevel || 'safe'
    };
}

async function loadPublicDossierSource(sourcePath) {
    const response = await fetch(sourcePath);
    if (!response.ok) {
        throw new Error(`Could not fetch ${sourcePath}: ${response.status}`);
    }

    const payload = await response.json();
    return normalizePublicDossierPayload(payload, sourcePath).map(mapPublicDossierItem);
}

const sessionCache = new Map();

/**
 * Loads reader-facing dossier data.
 * Caches result per session so subsequent calls skip fetching.
 *
 * Phase 1 intentionally stops exposing raw author-canon markdown and the
 * internal glossary as the primary setting-page data source. Canon files remain
 * maintenance sources only; reader-facing copy lives in reader/public-dossier/.
 *
 * @returns {Promise<Array>} The normalized public dossier items.
 */
export async function loadFullDossier() {
    if (sessionCache.has('mergedDossier')) {
        return sessionCache.get('mergedDossier');
    }

    const allItems = [];

    for (const sourcePath of PUBLIC_DOSSIER_SOURCES) {
        try {
            const items = await loadPublicDossierSource(sourcePath);
            allItems.push(...items);
        } catch (error) {
            console.error('Error loading public dossier source:', error);
        }
    }

    const sorted = allItems.sort((a, b) => {
        const priorityDiff = (a.display_priority || 0) - (b.display_priority || 0);
        if (priorityDiff !== 0) return priorityDiff;
        return String(a.title || a.term || '').localeCompare(String(b.title || b.term || ''), 'zh-Hant');
    });

    sessionCache.set('mergedDossier', sorted);
    return sorted;
}
