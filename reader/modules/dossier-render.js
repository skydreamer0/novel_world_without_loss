import { evaluateLockState } from './dossier-lock.js';

export function renderDossierCards(container, items, globalProgress, filterCategory) {
    if (!container) return;
    container.innerHTML = '';
    
    const filteredItems = filterCategory === 'all' 
        ? items 
        : items.filter(item => item.category === filterCategory);
    
    filteredItems.forEach(item => {
        const state = evaluateLockState(item, globalProgress);
        
        const card = document.createElement('div');
        card.className = `dossier-card card ${state.isLocked ? 'locked' : 'unlocked'}`;
        card.dataset.category = item.category || 'unknown';
        
        const header = document.createElement('div');
        header.className = 'dossier-card-header';
        
        let badgesHtml = '';
        if (item.source) badgesHtml += `<span class="badge source-badge">${item.source}</span>`;
        if (item.category) badgesHtml += `<span class="badge category-badge">${item.category}</span>`;
        
        header.innerHTML = `
            <h3 class="term-title">${state.title}</h3>
            ${badgesHtml ? `<div class="term-meta">${badgesHtml}</div>` : ''}
        `;
        
        const body = document.createElement('div');
        body.className = 'dossier-card-body';
        
        const detailsPara = document.createElement('p');
        detailsPara.className = 'dossier-details term-desc';
        detailsPara.innerHTML = state.details;
        body.appendChild(detailsPara);
        
        if (state.supplemental) {
            const suppArchive = document.createElement('div');
            suppArchive.className = 'dossier-supplemental';
            suppArchive.innerHTML = `<h4 style="color:var(--abyss-bright)">Supplemental Archive</h4><p class="term-desc">${state.supplemental}</p>`;
            body.appendChild(suppArchive);
        }
        
        if (state.totalStages > 0) {
            const stages = document.createElement('div');
            stages.className = 'dossier-stages stage-indicator';
            let dots = '';
            for (let i = 0; i < state.totalStages; i++) {
                dots += `<span class="stage-dot ${i <= state.currentStage ? 'active' : ''}"></span>`;
            }
            stages.innerHTML = dots;
            body.appendChild(stages);
        }
        
        card.appendChild(header);
        card.appendChild(body);
        container.appendChild(card);
    });
}

export function renderFilters(container, items, currentFilter, onFilterChange) {
    if (!container) return;
    container.innerHTML = '';
    
    const categories = new Set();
    items.forEach(item => {
        if (item.category) categories.add(item.category);
    });
    
    const allCategories = ['all', ...Array.from(categories)];
    
    allCategories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `filter-btn ${cat === currentFilter ? 'active' : ''}`;
        btn.textContent = cat;
        btn.addEventListener('click', () => {
            onFilterChange(cat);
        });
        container.appendChild(btn);
    });
}
