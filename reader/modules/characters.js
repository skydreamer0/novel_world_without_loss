import { state, els } from './state.js';

const CATALOG_ASSET_ROOT = '../visual_harness/';

// Visual Bible anchor keys are English by contract (the prompt engine reads them); the Reader is a
// Traditional Chinese surface, so labels are translated here and values come from `display`.
const ANCHOR_LABELS = {
  apparent_age: '外貌年齡',
  face_structure: '臉部結構',
  eyes: '眼睛',
  nose: '鼻子',
  hair: '髮型',
  physique: '體態',
  signature_clothing: '標誌服裝',
  signature_item: '標誌物件',
  distinguishing_marks: '辨識特徵',
};
const ANCHOR_ORDER = Object.keys(ANCHOR_LABELS);
// Turnaround masters are wide production sheets; never crop them. Reader portraits prefer the
// independently registered three-quarter view, so the master is only a final fallback.
const UNCROPPED_REFERENCE_ROLES = new Set(['turnaround', 'outfit', 'pose']);

function projectionCharacters() {
  const projection = window.WWL_CHARACTER_CATALOG;
  if (!projection || projection.schema_version !== 1 || !Array.isArray(projection.characters)) {
    return [];
  }

  return projection.characters.filter((character) => (
    character &&
    typeof character.character_id === 'string' &&
    typeof character.canonical_name === 'string'
  ));
}

function textValues(value) {
  if (typeof value === 'string' || typeof value === 'number') return [String(value)];
  if (Array.isArray(value)) return value.flatMap(textValues);
  if (value && typeof value === 'object') return Object.values(value).flatMap(textValues);
  return [];
}

function displayRole(character) {
  return character.display?.role || character.role || '';
}

function displayAnchors(character) {
  return character.display?.visual_anchors || character.visual_anchors;
}

function displayForbidden(character) {
  return character.display?.forbidden_traits?.length
    ? character.display.forbidden_traits
    : character.forbidden_traits;
}

function searchText(character) {
  // Both languages stay searchable: readers type Chinese, the Visual Bible is authored in English.
  return [
    character.canonical_name,
    ...(character.aliases || []),
    character.role,
    character.display?.role,
    ...textValues(character.visual_anchors),
    ...textValues(character.display?.visual_anchors),
    ...textValues(character.prompt_tokens),
    ...textValues(character.forbidden_traits),
    ...textValues(character.display?.forbidden_traits),
  ].filter(Boolean).join(' ').toLocaleLowerCase('zh-Hant');
}

function safeAssetUrl(path) {
  if (typeof path !== 'string') return null;
  const normalized = path.trim().replace(/^\.\//, '');
  if (!normalized || normalized.startsWith('/') || normalized.includes('..') || /^[a-z][a-z\d+.-]*:/i.test(normalized)) {
    return null;
  }
  return `${CATALOG_ASSET_ROOT}${normalized}`;
}

function characterInitial(character) {
  return character.canonical_name.trim().charAt(0) || '？';
}

// canonical_name carries both scripts ("遲影 (Chiying)"), which overflows a 280px sidebar row.
// The list shows the Chinese name only; the detail header keeps the full canonical form.
function shortName(character) {
  const match = character.canonical_name.match(/^([^(（]+)[(（]/);
  return match ? match[1].trim() : character.canonical_name;
}

function latinName(character) {
  const match = character.canonical_name.match(/[(（]([^)）]+)[)）]/);
  return match ? match[1].trim() : '';
}

function portraitReference(character) {
  return character.display_reference || character.preferred_reference || null;
}

function makePortrait(character, className) {
  const portrait = document.createElement('div');
  portrait.className = className;

  const placeholder = document.createElement('span');
  placeholder.className = 'character-portrait-placeholder';
  placeholder.textContent = characterInitial(character);
  placeholder.setAttribute('aria-hidden', 'true');
  portrait.appendChild(placeholder);

  const reference = portraitReference(character);
  const imageUrl = safeAssetUrl(reference?.path);
  if (imageUrl) {
    // Unccroppable sheets get letterboxed on a light plate instead of being cover-cropped.
    if (UNCROPPED_REFERENCE_ROLES.has(reference.role)) portrait.classList.add('is-sheet');
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = `${character.canonical_name}角色參考圖`;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.addEventListener('load', () => portrait.classList.add('has-image'), { once: true });
    img.addEventListener('error', () => img.remove(), { once: true });
    portrait.appendChild(img);
  }

  return portrait;
}

function appendTextList(parent, values, className = '') {
  const list = document.createElement('ul');
  list.className = className;
  values.forEach((value) => {
    const item = document.createElement('li');
    item.textContent = value;
    list.appendChild(item);
  });
  parent.appendChild(list);
}

function appendAnchorDefinition(parent, anchors) {
  const source = anchors && typeof anchors === 'object' && !Array.isArray(anchors) ? anchors : null;

  if (!source) {
    const values = textValues(anchors);
    if (values.length) appendTextList(parent, values, 'character-feature-list');
    return;
  }

  // Known anchors render in Visual Bible order; anything unmapped still shows, just after them.
  const keys = [
    ...ANCHOR_ORDER.filter((key) => source[key] !== undefined),
    ...Object.keys(source).filter((key) => !ANCHOR_LABELS[key]),
  ];

  const list = document.createElement('dl');
  list.className = 'character-anchor-list';
  keys.forEach((key) => {
    const values = textValues(source[key]);
    if (values.length === 0) return;

    const term = document.createElement('dt');
    term.textContent = ANCHOR_LABELS[key] || key.replaceAll('_', ' ');
    list.appendChild(term);

    const description = document.createElement('dd');
    if (values.length > 1) {
      const inner = document.createElement('ul');
      inner.className = 'character-anchor-multi';
      values.forEach((value) => {
        const item = document.createElement('li');
        item.textContent = value;
        inner.appendChild(item);
      });
      description.appendChild(inner);
    } else {
      description.textContent = values[0];
    }
    list.appendChild(description);
  });
  if (list.childElementCount) parent.appendChild(list);
}

function makeSection(title, contentBuilder) {
  const section = document.createElement('section');
  section.className = 'character-detail-section';
  const heading = document.createElement('h4');
  heading.textContent = title;
  section.appendChild(heading);
  contentBuilder(section);
  return section.childElementCount > 1 ? section : null;
}

// The status line belongs to the list; the detail view borrows it, so keep the list copy around.
let listStatusText = '';

function showCharacterList() {
  state.activeCharacterId = null;
  els.characterCatalogStatus.textContent = listStatusText;
  els.characterDetail.hidden = true;
  els.characterList.hidden = false;
  els.characterSearchInput?.focus({ preventScroll: true });
}

function showCharacterDetail(character) {
  state.activeCharacterId = character.character_id;
  els.characterCatalogStatus.textContent = portraitReference(character)
    ? '已核准參考圖'
    : '尚未建立參考圖';
  const detail = els.characterDetail;
  detail.replaceChildren();

  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'character-detail-back';
  back.textContent = '← 返回角色列表';
  back.addEventListener('click', showCharacterList);
  detail.appendChild(back);

  detail.appendChild(makePortrait(character, 'character-detail-portrait'));

  const identity = document.createElement('header');
  identity.className = 'character-detail-identity';
  const name = document.createElement('h3');
  name.textContent = shortName(character);
  const latin = latinName(character);
  if (latin) {
    const latinLine = document.createElement('span');
    latinLine.className = 'character-detail-latin';
    latinLine.textContent = latin;
    name.appendChild(latinLine);
  }
  identity.appendChild(name);
  const role = displayRole(character);
  if (role) {
    const roleLine = document.createElement('p');
    roleLine.textContent = role;
    identity.appendChild(roleLine);
  }
  detail.appendChild(identity);

  const anchorSection = makeSection('視覺定錨', (section) => {
    appendAnchorDefinition(section, displayAnchors(character));
  });
  if (anchorSection) detail.appendChild(anchorSection);

  const tokens = textValues(character.prompt_tokens);
  const tokenSection = makeSection('造型關鍵字', (section) => {
    if (!tokens.length) return;
    const cloud = document.createElement('div');
    cloud.className = 'character-token-cloud';
    tokens.forEach((token) => {
      const chip = document.createElement('span');
      chip.textContent = token;
      cloud.appendChild(chip);
    });
    section.appendChild(cloud);
  });
  if (tokenSection) detail.appendChild(tokenSection);

  const forbidden = textValues(displayForbidden(character));
  const forbiddenSection = makeSection('避免特徵', (section) => {
    if (forbidden.length) appendTextList(section, forbidden, 'character-feature-list');
  });
  if (forbiddenSection) detail.appendChild(forbiddenSection);

  const referenceSetId = portraitReference(character)?.reference_set_id;
  if (referenceSetId) {
    const reference = document.createElement('p');
    reference.className = 'character-reference-note';
    reference.textContent = `參考組 · ${referenceSetId}`;
    detail.appendChild(reference);
  } else {
    const reference = document.createElement('p');
    reference.className = 'character-reference-note is-missing';
    reference.textContent = '尚未建立已核准的 Reference Set · 目前顯示文字替代圖';
    detail.appendChild(reference);
  }

  els.characterList.hidden = true;
  detail.hidden = false;
  detail.scrollTop = 0;
}

function renderCharacterList() {
  const characters = projectionCharacters();
  const query = state.characterFilter.trim().toLocaleLowerCase('zh-Hant');
  const visible = query
    ? characters.filter((character) => searchText(character).includes(query))
    : characters;

  els.characterList.replaceChildren();
  els.characterDetail.hidden = true;
  els.characterList.hidden = false;

  if (characters.length === 0) {
    listStatusText = '角色資料尚未發布';
    els.characterCatalogStatus.textContent = listStatusText;
    const empty = document.createElement('div');
    empty.className = 'character-empty';
    empty.innerHTML = '<span aria-hidden="true">卷</span><p>Catalog 完成發布後，角色會自動出現在這裡。</p>';
    els.characterList.appendChild(empty);
    return;
  }

  listStatusText = query
    ? `${visible.length} / ${characters.length} 位角色`
    : `共 ${characters.length} 位角色`;
  els.characterCatalogStatus.textContent = listStatusText;

  if (visible.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'character-empty';
    empty.innerHTML = '<span aria-hidden="true">無</span><p>找不到符合名稱、職能或視覺特徵的角色。</p>';
    els.characterList.appendChild(empty);
    return;
  }

  visible.forEach((character, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'character-list-item';
    button.style.setProperty('--character-index', index);
    button.dataset.characterId = character.character_id;
    button.appendChild(makePortrait(character, 'character-list-portrait'));

    const copy = document.createElement('span');
    copy.className = 'character-list-copy';
    const name = document.createElement('strong');
    name.textContent = shortName(character);
    copy.appendChild(name);
    const role = displayRole(character);
    if (role) {
      const roleLine = document.createElement('small');
      roleLine.textContent = role;
      copy.appendChild(roleLine);
    }
    button.appendChild(copy);

    const arrow = document.createElement('span');
    arrow.className = 'character-list-arrow';
    arrow.textContent = '›';
    arrow.setAttribute('aria-hidden', 'true');
    button.appendChild(arrow);
    button.addEventListener('click', () => showCharacterDetail(character));
    els.characterList.appendChild(button);
  });
}

function setSidebarView(view, { focus = false } = {}) {
  const nextView = view === 'characters' ? 'characters' : 'chapters';
  state.sidebarView = nextView;
  const showingCharacters = nextView === 'characters';

  els.chaptersPanel.hidden = showingCharacters;
  els.charactersPanel.hidden = !showingCharacters;
  els.sidebarTabs.querySelectorAll('[role="tab"]').forEach((tab) => {
    const selected = tab.dataset.sidebarView === nextView;
    tab.classList.toggle('active', selected);
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });

  if (showingCharacters) {
    renderCharacterList();
    if (focus) els.characterSearchInput?.focus();
  } else if (focus) {
    els.searchInput?.focus();
  }
}

export function initCharacters() {
  if (!els.sidebarTabs || !els.charactersPanel || !els.characterList || !els.characterDetail) return;

  els.sidebarTabs.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-sidebar-view]');
    if (tab) setSidebarView(tab.dataset.sidebarView, { focus: true });
  });

  els.sidebarTabs.addEventListener('keydown', (event) => {
    const tabs = Array.from(els.sidebarTabs.querySelectorAll('[role="tab"]'));
    const current = tabs.indexOf(event.target);
    if (current < 0) return;

    let next = current;
    if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;

    event.preventDefault();
    setSidebarView(tabs[next].dataset.sidebarView, { focus: false });
    tabs[next].focus();
  });

  els.characterSearchInput.addEventListener('input', (event) => {
    state.characterFilter = event.target.value;
    renderCharacterList();
  });

  setSidebarView(state.sidebarView);
}
