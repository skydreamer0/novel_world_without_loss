// reader/modules/dossier-merge.js

/**
 * Merges JSON glossary items with parsed markdown items.
 * @param {Array} jsonItems 
 * @param {Array} mdItems 
 * @returns {Array}
 */
export function mergeDossierItems(jsonItems, mdItems) {
    const mergedMap = new Map();
    
    // Process JSON items
    for (const item of jsonItems) {
        const id = item.id || item.term;
        if (!id) continue;
        
        const dossierInfo = item.dossier || {};
        
        mergedMap.set(id, {
            id: id,
            term: item.term || id,
            category: dossierInfo.category || item.category || 'Other',
            visibility: dossierInfo.visibility || item.visibility || 'hidden',
            unlock: dossierInfo.unlock !== undefined ? dossierInfo.unlock : (item.unlock || 0),
            unlock_stages: dossierInfo.unlock_stages || item.unlock_stages || [],
            details: dossierInfo.details !== undefined ? dossierInfo.details : (item.details || item.definition || item.description || item.display_text || ''),
            display_priority: dossierInfo.display_priority !== undefined ? dossierInfo.display_priority : (item.display_priority || 0),
            supplementalArchive: '',
            source: 'Database'
        });
    }
    
    // Process Markdown items
    for (const item of mdItems) {
        const id = item.id;
        
        if (mergedMap.has(id)) {
            const existing = mergedMap.get(id);
            existing.supplementalArchive = existing.supplementalArchive 
                ? existing.supplementalArchive + '\n\n' + item.mdContent 
                : item.mdContent;
                
            if (existing.source === 'Database') {
                existing.source = 'Merged File';
            } else if (existing.source !== 'Merged File' && !existing.source.includes(item.source)) {
                existing.source += ', ' + item.source;
            }
        } else {
            let finalVisibility = item.mdVisibility || 'partial';
            if (!['partial', 'restricted', 'blackbox'].includes(finalVisibility)) {
                finalVisibility = 'partial';
            }

            mergedMap.set(id, {
                id: id,
                term: item.term,
                category: item.category || 'Other',
                visibility: finalVisibility,
                unlock: item.mdUnlock || 0,
                unlock_stages: [],
                details: '',
                display_priority: 0,
                supplementalArchive: item.mdContent,
                source: item.source
            });
        }
    }
    
    return Array.from(mergedMap.values());
}
