export function evaluateLockState(item, globalProgress) {
    const isLocked = globalProgress < (item.unlock || 0);
    const visibility = item.visibility || 'restricted';

    let title = item.title || item.term || 'Unknown';
    let details = item.details || '';
    let supplemental = item.supplementalArchive || '';
    
    let currentStage = -1;
    const totalStages = item.unlock_stages ? item.unlock_stages.length : 0;

    if (item.unlock_stages && totalStages > 0) {
        let maxStage = -1;
        for (let i = 0; i < totalStages; i++) {
            if (globalProgress >= item.unlock_stages[i].chapter) {
                maxStage = i;
            }
        }
        if (maxStage >= 0) {
            currentStage = maxStage;
            const stageText = item.unlock_stages[maxStage].text;
            if (stageText) {
                supplemental = supplemental ? `${supplemental}\n\n${stageText}` : stageText;
            }
        }
    }

    if (isLocked) {
        supplemental = '';
        const lockedText = item.lockedText || item.teaser || '';
        if (visibility === 'blackbox') {
            title = '<span aria-label="Blackbox file locked">██████</span>';
            details = lockedText || '<span aria-label="Blackbox file locked">■■■ UNAUTHORIZED ACCESS ■■■</span>';
        } else if (visibility === 'restricted') {
            details = lockedText || '<span class="redaction-block" aria-label="redacted">████</span> <span class="redaction-block" aria-label="redacted">████</span> <span class="redaction-block" aria-label="redacted">████</span>';
        } else if (visibility === 'partial') {
            details = lockedText || '同步率不足。檔案內容尚未解封。';
        }
    }

    return { isLocked, title, details, supplemental, currentStage, totalStages };
}
