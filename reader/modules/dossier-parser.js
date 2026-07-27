// reader/modules/dossier-parser.js

/**
 * Parses markdown text into sections based on '###' headings.
 * @param {string} markdownText 
 * @param {string} sourceLabel 
 * @returns {Array} Array of extracted sections.
 */
export function parseMarkdownSections(markdownText, sourceLabel) {
    if (!markdownText) return [];

    const results = [];
    const headingRegex = /^###\s+(.*)$/gm;
    let match;

    while ((match = headingRegex.exec(markdownText)) !== null) {
        const headingStr = match[1];

        // Extract metadata first
        const metaRegex = /<!--\s*(.*?)\s*-->/;

        let mdUnlock = 0;
        let mdVisibility = 'partial';
        let category = 'Other';

        const contentStartIndex = match.index + match[0].length;

        const nextHeadingRegex = /\n##?#?\s+/g;
        nextHeadingRegex.lastIndex = contentStartIndex;
        const nextHeadingMatch = nextHeadingRegex.exec(markdownText);
        const contentEndIndex = nextHeadingMatch ? nextHeadingMatch.index : markdownText.length;

        let mdContentRaw = markdownText.substring(contentStartIndex, contentEndIndex).trim();

        const metaMatch = headingStr.match(metaRegex) || mdContentRaw.match(metaRegex);

        if (metaMatch) {
            const metaStr = metaMatch[1];

            const unlockMatch = metaStr.match(/unlock:\s*(\d+)/i);
            if (unlockMatch) mdUnlock = parseInt(unlockMatch[1], 10);

            const visibilityMatch = metaStr.match(/visibility:\s*([^\s]+)/i);
            if (visibilityMatch) mdVisibility = visibilityMatch[1].trim();

            const categoryMatch = metaStr.match(/category:\s*([^\s]+)/i);
            if (categoryMatch) category = categoryMatch[1].trim();
        }

        // Clean heading for term extraction
        const headingClean = headingStr.replace(metaRegex, '').trim();
        let termMatch = headingClean.match(/^(?:[\d\.]+\s+)?(.+)$/);
        let term = termMatch ? termMatch[1].trim() : headingClean.trim();

        // Clean content
        let mdContent = mdContentRaw.replace(metaRegex, '').trim();

        results.push({
            id: term,
            term: term,
            mdContent: mdContent,
            mdUnlock: mdUnlock,
            mdVisibility: mdVisibility,
            category: category,
            source: sourceLabel
        });
    }

    return results;
}
