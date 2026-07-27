import { evaluateLockState } from './dossier-lock.js';

export async function performSync(statusElement, currentItems, oldProgress, newProgress, onPulse) {
    if (!statusElement) return;

    statusElement.textContent = 'Syncing...';
    statusElement.className = 'sync-status syncing';

    try {
        let newUnlocks = 0;

        for (const item of currentItems) {
            const oldState = evaluateLockState(item, oldProgress);
            const newState = evaluateLockState(item, newProgress);

            if (oldState.isLocked && !newState.isLocked) {
                newUnlocks++;
            } else if (newState.currentStage > oldState.currentStage) {
                newUnlocks++;
            }
        }

        if (newUnlocks > 0) {
            statusElement.textContent = `Updated: ${newUnlocks} new entries.`;
            statusElement.className = 'sync-status updated';
            if (typeof onPulse === 'function') {
                onPulse(newUnlocks);
            }
        } else {
            statusElement.textContent = 'Database synchronized. No new entries.';
            statusElement.className = 'sync-status no-change';
        }
    } catch (error) {
        console.error('Dossier sync failed:', error);
        statusElement.textContent = 'Error connecting to archive.';
        statusElement.className = 'sync-status error';
    }
}
