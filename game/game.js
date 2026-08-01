import { INTRO, RESOURCE_META, ORGAN_META, INITIAL_STATE, EVENTS } from './data/events.js';
import { createCityScene } from './scene.js';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

function freshState() {
  return {
    turn: INITIAL_STATE.turn,
    resources: { ...INITIAL_STATE.resources },
    organs: { ...INITIAL_STATE.organs },
    debts: [],
    flags: {},
    log: [],
  };
}

let state = freshState();
let eventIndex = 0;
let sceneApi = null;

const $ = (id) => document.getElementById(id);
const els = {
  intro: $('intro-screen'),
  game: $('game-screen'),
  end: $('end-screen'),
  sceneViewport: $('scene-viewport'),
  introTitle: $('intro-title'),
  introText: $('intro-text'),
  introStart: $('intro-start-btn'),
  turnCounter: $('turn-counter'),
  meters: $('meters'),
  organs: $('organs'),
  debts: $('debts'),
  eventChapter: $('event-chapter'),
  eventTitle: $('event-title'),
  eventText: $('event-text'),
  eventChoices: $('event-choices'),
  logList: $('log-list'),
  endBadge: $('end-badge'),
  endTitle: $('end-title'),
  endSummary: $('end-summary'),
  endStats: $('end-stats'),
  restartBtn: $('restart-btn'),
};

function renderIntro() {
  els.introTitle.textContent = INTRO.title;
  els.introText.innerHTML = INTRO.paragraphs.map((p) => `<p>${p}</p>`).join('');
  els.introStart.textContent = INTRO.startLabel;
}

function meterBarHtml(key, value) {
  const meta = RESOURCE_META[key];
  const pct = clamp(value, 0, 100);
  const danger = meta.invert ? pct >= 70 : pct <= 20;
  const warn = meta.invert ? pct >= 40 && pct < 70 : pct > 20 && pct <= 40;
  const cls = danger ? 'danger' : warn ? 'warn' : 'ok';
  return `
    <div class="meter">
      <div class="meter-label"><span class="meter-icon">${meta.icon}</span>${meta.label}<span class="meter-value">${Math.round(pct)}</span></div>
      <div class="meter-track"><div class="meter-fill ${cls}" style="width:${pct}%"></div></div>
    </div>`;
}

function renderMeters() {
  const r = state.resources;
  const popMeta = RESOURCE_META.population;
  const html = [
    `<div class="meter meter-population">
      <div class="meter-label"><span class="meter-icon">${popMeta.icon}</span>${popMeta.label}</div>
      <div class="meter-pop-value">${popMeta.format(r.population)} 人</div>
    </div>`,
    meterBarHtml('food', r.food),
    meterBarHtml('order', r.order),
    meterBarHtml('trust', r.trust),
    meterBarHtml('pressure', r.pressure),
  ].join('');
  els.meters.innerHTML = html;
}

function renderOrgans() {
  els.organs.innerHTML = Object.entries(ORGAN_META).map(([key, meta]) => {
    const lvl = clamp(state.organs[key] || 0, 0, 5);
    const dots = Array.from({ length: 5 }, (_, i) => `<span class="dot ${i < lvl ? 'filled' : ''}"></span>`).join('');
    return `<div class="organ"><span class="organ-icon">${meta.icon}</span><span class="organ-label">${meta.label}</span><span class="organ-dots">${dots}</span></div>`;
  }).join('');
}

function renderDebts() {
  if (!state.debts.length) {
    els.debts.innerHTML = '<div class="debts-empty">暫無未償界力借債</div>';
    return;
  }
  els.debts.innerHTML = state.debts.map((d) =>
    `<div class="debt-chip"><strong>${d.label}</strong><span>${d.source} · 第 ${d.dueTurn} 回合到期</span></div>`
  ).join('');
}

function renderLog() {
  els.logList.innerHTML = state.log.map((entry) =>
    `<li><span class="log-turn">第${entry.turn}回合</span>${entry.text}</li>`
  ).join('');
}

function renderEvent(event) {
  els.turnCounter.textContent = `第 ${state.turn} 回合 · 第一卷進度 ${eventIndex + 1}/${EVENTS.length}`;
  els.eventChapter.textContent = event.chapter;
  els.eventTitle.textContent = event.title;
  els.eventText.textContent = event.text;
  els.eventChoices.innerHTML = '';
  event.choices.forEach((choice, idx) => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.textContent = choice.label;
    btn.addEventListener('click', () => resolveChoice(event, choice));
    els.eventChoices.appendChild(btn);
  });
}

function render() {
  renderMeters();
  renderOrgans();
  renderDebts();
  renderLog();
  if (sceneApi) sceneApi.update(state);
}

function applyEffects(effects) {
  if (!effects) return;
  for (const key of ['population', 'food', 'order', 'trust', 'pressure']) {
    if (effects[key] != null) state.resources[key] += effects[key];
  }
  if (effects.organs) {
    for (const k of Object.keys(effects.organs)) {
      state.organs[k] = clamp((state.organs[k] || 0) + effects.organs[k], 0, 5);
    }
  }
}

function clampResources() {
  state.resources.population = Math.max(0, state.resources.population);
  state.resources.food = clamp(state.resources.food, 0, 100);
  state.resources.order = clamp(state.resources.order, 0, 100);
  state.resources.trust = clamp(state.resources.trust, 0, 100);
  state.resources.pressure = clamp(state.resources.pressure, 0, 100);
}

function addLog(text) {
  state.log.unshift({ turn: state.turn, text });
}

function processDebts() {
  const due = state.debts.filter((d) => d.dueTurn <= state.turn);
  state.debts = state.debts.filter((d) => d.dueTurn > state.turn);
  for (const d of due) {
    applyEffects(d.effect);
    addLog(`【債務到期】${d.label}：${d.source}承受了${d.amount}的代價。`);
  }
}

function checkImbalance() {
  const vals = Object.values(state.organs);
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  if (max - min >= 3) {
    state.resources.trust -= 3;
    addLog('【器官失衡】天地器官發展失衡，居民隱隱感到不安。');
  }
}

function checkGameOver() {
  const r = state.resources;
  if (r.population <= 0) return { reason: '居民全數散逸，空胎重新墜回虛無。' };
  if (r.trust <= 0) return { reason: '居民徹底失去信任，五席議事會聯合奪權，你被逐出自己的空胎。' };
  if (r.pressure >= 100) return { reason: '中樞定額壓力突破臨界，特級清收提前降下，無漏之地覆滅。' };
  return null;
}

function endTurnMaintenance() {
  state.resources.pressure += 2;
  state.resources.food -= 3;
  state.resources.order -= 1;
  if (state.resources.food <= 0) {
    state.resources.population = Math.round(state.resources.population * 0.95);
    state.resources.trust -= 5;
    addLog('【糧荒】糧食見底，居民開始挨餓，人口與信任持續流失。');
  }
}

function showEnd(result, reason) {
  els.game.hidden = true;
  els.end.hidden = false;
  const win = result === 'win';
  els.endBadge.textContent = win ? '第一卷 · 通關' : 'game over';
  els.endBadge.className = `end-badge ${win ? 'win' : 'lose'}`;
  els.endTitle.textContent = win ? '無漏之地，正式獨立' : '空胎崩解';
  els.endSummary.textContent = reason;
  const r = state.resources;
  els.endStats.innerHTML = `
    <div>存續回合：第 ${state.turn} 回合</div>
    <div>最終人口：${RESOURCE_META.population.format(r.population)} 人</div>
    <div>居民信任：${Math.round(clamp(r.trust, 0, 100))}</div>
    <div>中樞定額壓力：${Math.round(clamp(r.pressure, 0, 100))}</div>
  `;
  render();
}

function resolveChoice(event, choice) {
  applyEffects(choice.effects);
  if (choice.setFlags) choice.setFlags.forEach((f) => { state.flags[f] = true; });
  if (choice.addDebt) {
    state.debts.push({ ...choice.addDebt, dueTurn: state.turn + choice.addDebt.dueInTurns });
  }
  addLog(choice.log);

  if (choice.end === 'win') {
    clampResources();
    render();
    showEnd('win', choice.log);
    return;
  }

  state.turn += 1;
  endTurnMaintenance();
  processDebts();
  checkImbalance();
  clampResources();

  const gameOver = checkGameOver();
  if (gameOver) {
    showEnd('lose', gameOver.reason);
    return;
  }

  eventIndex += 1;
  if (eventIndex >= EVENTS.length) {
    showEnd('win', '你撐過了空胎第一卷的所有抉擇，無漏之地在黑暗中站穩了腳跟。');
    return;
  }
  render();
  renderEvent(EVENTS[eventIndex]);
}

function startGame() {
  state = freshState();
  eventIndex = 0;
  els.intro.hidden = true;
  els.end.hidden = true;
  els.game.hidden = false;
  if (!sceneApi) sceneApi = createCityScene(els.sceneViewport);
  render();
  renderEvent(EVENTS[eventIndex]);
}

els.introStart.addEventListener('click', startGame);
els.restartBtn.addEventListener('click', () => {
  els.end.hidden = true;
  els.intro.hidden = false;
});

renderIntro();
