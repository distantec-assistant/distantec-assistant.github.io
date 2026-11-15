import { GAME_IDS, STAGES, getStage, availableGames, planJourney, createTask, act, assess, taskTotal } from './journey.mjs?v=5';
import { scene, portrait, item, train, worldMap, landmark } from './art.mjs?v=5';
import { KEY, parseProgress, winProgress, finishJourney } from './progress.mjs?v=5';
import { clipUrl, instruction, feedback } from './narration.mjs?v=5';

const $ = id => document.getElementById(id);
const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const CONFIG = Object.freeze({
  load: { title: 'Загрузи вагон', hint: 'Ящики для поезда', animal: 'rabbit', task: 'Погрузи в вагон нужное число ящиков.', reward: 'Вагон готов!', after: 'Все ящики на месте. Можно ехать!' },
  find: { title: 'Найди число', hint: 'Послушай и выбери', animal: 'fox', task: 'Послушай, какое число нужно найти.', reward: 'Вот оно!', after: 'Ты нашёл нужное число.' },
  count: { title: 'Сколько яблок?', hint: 'Посчитай и выбери', animal: 'rabbit', task: 'Сколько здесь яблок? Посчитай и выбери число.', reward: 'Всё посчитано!', after: 'У каждого яблока нашлось своё число.' },
  missing: { title: 'Числа в окошках', hint: 'Что пропущено?', animal: 'fox', task: 'Какое число пропущено? Заполни окошко.', reward: 'Все на местах!', after: 'Числовой поезд снова в порядке.' },
  neighbors: { title: 'Числа-соседи', hint: 'До или после?', animal: 'bear', task: 'Какое число рядом? Выбери соседа.', reward: 'Сосед нашёлся!', after: 'Числа снова вместе.' },
  long: { title: 'Длинный счёт', hint: 'Считай с поездом', animal: 'bear', task: 'Нажимай на поезд и считай вместе с Юлией.', reward: 'Доехали!', after: 'Вот какое длинное путешествие!' },
  orders: { title: 'Собери заказ', hint: 'Десятки и единицы', animal: 'rabbit', task: 'Собери заказ из яблок. Когда готово — проверь.', check: 'Отправить заказ', reward: 'Заказ доставлен!', after: 'Зайчик получил ровно столько яблок, сколько просил.' },
  sharing: { title: 'Угости поровну', hint: 'Поделись с другом', animal: 'fox', task: 'Нажимай на тарелки и делись, чтобы стало поровну.', check: 'У всех поровну!', reward: 'Хватило обоим!', after: 'На двух тарелках одинаковое количество угощений.' },
  bridge: { title: 'Построй мост', hint: 'Детали разной длины', animal: 'bear', task: 'Дострой мост до флажка. Потом отправь поезд.', check: 'Поезд, поехали!', reward: 'Дорога открыта!', after: 'Мост соединил берега. Поезд может ехать дальше.' },
});
const ADVANCED = new Set(['orders', 'sharing', 'bridge']);
const HIDDEN_TARGET = new Set(['find', 'count', 'missing', 'neighbors']);
let saveMessage = '';
let progress;
let current = null;
let phase = 'playing';
let journey = null;
let hasGesture = false;

function validStage(id) {
  try { return getStage(id) || null; } catch { return null; }
}
function savedShapeIsValid(value) {
  if (!value || value.version !== 2 || !validStage(value.stage) || typeof value.sound !== 'boolean' || !value.counts || !value.sessions) return false;
  const validCount = n => Number.isSafeInteger(n) && n >= 0 && n <= 1000000;
  return STAGES.every(stage => validCount(value.sessions[stage.id]) && GAME_IDS.every(kind => validCount(value.counts[stage.id]?.[kind])));
}
try {
  const raw = localStorage.getItem(KEY);
  progress = parseProgress(raw);
  if (raw !== null) {
    let value;
    try { value = JSON.parse(raw); } catch { /* The model restores a safe, fresh save. */ }
    if (!savedShapeIsValid(value)) saveMessage = 'Сохранение повреждено. Игра продолжается; новые результаты можно сохранить заново.';
  }
} catch {
  progress = parseProgress(null);
  saveMessage = 'Сохранение недоступно — можно играть, но после закрытия страницы результаты могут пропасть.';
}
let stageId = validStage(progress.stage) ? progress.stage : 1;
function updateSaveNote() {
  $('save-note').textContent = saveMessage || 'Прогресс только на этом устройстве';
  $('save-note').dataset.warning = String(Boolean(saveMessage));
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(progress)); }
  catch { saveMessage = 'Сохранение недоступно — можно играть, но после закрытия страницы результаты могут пропасть.'; }
  updateSaveNote();
}

// Only existing Julia MP3 files. Numbers in narration arrays are quantities, never delays.
const failedAudio = new Set();
let audioUnavailable = false;
class Voice {
  constructor() {
    this.generation = 0;
    this.context = null;
    this.cache = new Map();
    this.source = null;
    this.finish = null;
    this.ready = Promise.resolve();
  }
  unlock() {
    if (!progress.sound || !hasGesture) return;
    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) { audioUnavailable = true; updateSound(); return; }
      if (!this.context) this.context = new Context();
      if (this.context.state === 'suspended') this.ready = this.context.resume().catch(() => { audioUnavailable = true; updateSound(); });
      if (this.context.state === 'running') audioUnavailable = false;
    } catch { audioUnavailable = true; updateSound(); }
  }
  stop() {
    this.generation++;
    const source = this.source;
    const finish = this.finish;
    this.source = null;
    this.finish = null;
    if (source) { try { source.stop(); } catch { /* Already ended. */ } }
    if (finish) finish();
  }
  async clip(id, token) {
    if (!progress.sound || token !== this.generation || !this.context || document.hidden) return;
    if (!this.cache.has(id)) {
      const pending = Promise.resolve().then(() => fetch(clipUrl(id))).then(response => {
        if (!response.ok) throw new Error('Recording unavailable');
        return response.arrayBuffer();
      }).then(buffer => this.context.decodeAudioData(buffer)).then(buffer => {
        failedAudio.delete(id); updateSound(); return buffer;
      }).catch(() => {
        this.cache.delete(id); failedAudio.add(id); updateSound(); return null;
      });
      this.cache.set(id, pending);
    }
    const buffer = await this.cache.get(id);
    if (!buffer || !progress.sound || token !== this.generation || this.context.state !== 'running' || document.hidden) return;
    await new Promise(resolve => {
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.connect(this.context.destination);
      let ended = false;
      const finish = () => {
        if (ended) return;
        ended = true;
        clearTimeout(timer);
        if (this.source === source) this.source = null;
        if (this.finish === finish) this.finish = null;
        source.disconnect();
        resolve();
      };
      const timer = setTimeout(() => { try { source.stop(); } catch { /* Already ended. */ } finish(); }, buffer.duration * 1000 + 700);
      this.finish = finish;
      this.source = source;
      source.onended = finish;
      try { source.start(); failedAudio.delete(id); updateSound(); }
      catch { this.cache.delete(id); failedAudio.add(id); updateSound(); finish(); }
    });
  }
  async say(parts) {
    this.stop();
    if (!progress.sound || !hasGesture || document.hidden) return;
    this.unlock();
    const token = this.generation;
    await this.ready;
    for (const part of parts) {
      if (token !== this.generation || !progress.sound || document.hidden) return;
      if (typeof part === 'number') {
        if (Number.isInteger(part) && part >= 1 && part <= 40) await this.clip(`c_${part}`, token);
      } else if (part && typeof part.clip === 'string') await this.clip(part.clip, token);
    }
  }
}
const voice = new Voice();
const iconSound = muted => muted
  ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m11 4-6 5H2v6h3l6 5ZM16 9l6 6m0-6-6 6"/></svg>'
  : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m11 4-6 5H2v6h3l6 5ZM15 8q5 4 0 8M18 4q9 8 0 16"/></svg>';
function updateSound() {
  $('sound').innerHTML = iconSound(!progress.sound);
  $('sound').setAttribute('aria-label', progress.sound ? 'Выключить звук' : 'Включить звук');
  $('sound').setAttribute('aria-pressed', String(progress.sound));
  $('voice-note').hidden = !progress.sound || (!audioUnavailable && failedAudio.size === 0);
  $('voice-note').textContent = audioUnavailable
    ? 'Браузер пока не включил звук. Нажмите «Послушать» ещё раз. Играть можно и без звука.'
    : 'Запись пока не загрузилась. Нажмите «Послушать» ещё раз — попробуем снова.';
}
function setFeedback(text = '', type = '') {
  $('feedback').textContent = text;
  $('feedback').dataset.type = type;
}
function narrateTask() {
  if (current) voice.say(instruction(current));
}

function miniArt(kind) {
  if (kind === 'load') return `<span class="mini-boxes">${unitBox()}${unitBox()}</span>`;
  if (kind === 'sharing') return `<span class="mini-friends"><span class="art-portrait">${portrait('rabbit')}</span><b>=</b><span class="art-portrait">${portrait('fox')}</span></span>`;
  if (kind === 'bridge') return '<span class="mini-planks"><i>1</i><i>2</i><i>5</i></span>';
  if (kind === 'find') return '<span class="mini-numbers"><i>1</i><i>2</i><i>3</i></span>';
  if (kind === 'missing') return '<span class="mini-numbers"><i>2</i><i>?</i><i>4</i></span>';
  if (kind === 'neighbors') return '<span class="mini-numbers"><i>?</i><i>5</i><i>?</i></span>';
  if (kind === 'long') return `<span class="art-train mini-train">${train()}</span>`;
  if (kind === 'orders') return `<span class="mini-order"><span class="art-item">${item('apple')}</span><b>10</b><span>+</span><span class="art-item">${item('apple')}</span></span>`;
  return `<span class="mini-apples">${Array.from({ length: 3 }, () => `<span class="art-item">${item('apple')}</span>`).join('')}</span>`;
}
function renderHome() {
  const stage = validStage(stageId);
  $('home').dataset.stage = String(stage.id);
  $('world-map').innerHTML = worldMap(stage.id);
  $('map-train').innerHTML = train();
  $('stations').innerHTML = STAGES.map(s => `<button type="button" class="station ${s.id === stage.id ? 'is-selected' : ''}" data-action="stage" data-stage="${s.id}" aria-pressed="${s.id === stage.id}" aria-label="${escape(s.title)}, ${escape(s.range)}"><span class="station-number" aria-hidden="true">${s.id}</span><span class="station-art" aria-hidden="true">${landmark(s.id)}</span><strong>${escape(s.title)}</strong><span class="station-range">${escape(s.range)}</span>${progress.sessions[s.id] > 0 ? '<span class="station-done" aria-hidden="true">★</span>' : ''}</button>`).join('');
  $('selected-place').textContent = stage.title;
  $('selected-range').textContent = `Числа ${stage.range} · два коротких задания`;
  $('practice-range').textContent = `Станция ${stage.id} · ${stage.range}`;
  $('game-cards').innerHTML = availableGames(stage.id).map(kind => `<button type="button" class="game-card ${kind}" data-action="start" data-kind="${kind}"><span class="card-picture" aria-hidden="true">${miniArt(kind)}</span><span class="card-copy"><strong>${CONFIG[kind].title}</strong><span>${CONFIG[kind].hint}</span></span><span class="card-arrow" aria-hidden="true">${progress.counts[stage.id][kind] > 0 ? '✓' : '→'}</span></button>`).join('');
}
function selectStage(id) {
  const stage = validStage(id);
  if (!stage) return false;
  voice.stop();
  stageId = stage.id;
  progress.stage = stage.id;
  persist();
  $('journey-note').hidden = true;
  renderHome();
  document.querySelector(`[data-action="stage"][data-stage="${stage.id}"]`)?.focus({ preventScroll: true });
  return true;
}
function clearGameQuery() {
  const url = new URL(location.href);
  if (!url.searchParams.has('game') && !url.searchParams.has('stage')) return;
  url.searchParams.delete('game'); url.searchParams.delete('stage');
  history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}
function showHome({ completed = false, focus = true, clearQuery = true } = {}) {
  voice.stop();
  current = null;
  journey = null;
  $('home').hidden = false;
  $('game').hidden = true;
  $('reward').hidden = true;
  $('journey-note').hidden = !completed;
  if (completed) $('journey-note').textContent = 'Два дела готовы! Можно ещё поиграть здесь или выбрать станцию самому.';
  renderHome(); updateSound();
  document.title = 'Цифроград — маленькое путешествие';
  if (clearQuery) clearGameQuery();
  window.scrollTo(0, 0);
  if (focus) $('home-title').focus({ preventScroll: true });
}
function startTask(kind, { route = null, narrate = true } = {}) {
  if (!validStage(stageId) || !availableGames(stageId).includes(kind)) return false;
  voice.stop();
  journey = route;
  const round = progress.counts[stageId][kind];
  current = createTask(stageId, kind, round);
  phase = 'playing';
  $('home').hidden = true; $('game').hidden = false;
  $('game-title').textContent = CONFIG[kind].title;
  $('game-kicker').textContent = journey ? `${validStage(stageId).title} · дело ${journey.index + 1} из 2` : `${validStage(stageId).title} · ${validStage(stageId).range}`;
  $('task-icon').innerHTML = portrait(CONFIG[kind].animal);
  $('task-text').textContent = kind === 'neighbors'
    ? `Какое число ${current.direction === 'before' ? 'перед' : 'после'} ${current.anchor}?`
    : kind === 'missing' && current.holes.length > 1 ? 'Заполни окошки по очереди. Какое число пропущено?' : CONFIG[kind].task;
  $('task-number').hidden = HIDDEN_TARGET.has(kind);
  $('task-number').textContent = kind === 'sharing' ? '=' : String(current.target);
  $('task-number').setAttribute('aria-label', kind === 'sharing' ? 'Поровну' : `Нужно ${current.target}`);
  $('check').textContent = CONFIG[kind].check || 'Проверить';
  $('check').hidden = !ADVANCED.has(kind);
  $('help').hidden = false;
  $('reward').hidden = true;
  setFeedback(kind === 'find' && !progress.sound ? 'Чтобы услышать число, включи звук вверху.' : '');
  renderBoard(); updateSound();
  document.title = `${CONFIG[kind].title} — Цифроград`;
  window.scrollTo(0, 0);
  if (narrate) narrateTask();
  return true;
}
function beginJourney() {
  const kinds = planJourney(stageId, progress.sessions[stageId]);
  if (!Array.isArray(kinds) || kinds.length !== 2 || !kinds.every(kind => availableGames(stageId).includes(kind))) {
    throw new Error('A journey must contain exactly two available games');
  }
  startTask(kinds[0], { route: { stageId, kinds, index: 0, completed: false } });
}
function sceneWorld(content, extraClass = '') {
  return `<div class="play-world ${current.kind}-world ${extraClass}"><div class="art-backdrop" aria-hidden="true">${scene(current.kind, current.stageId)}</div><div class="world-content">${content}</div></div>`;
}
function unitBox() {
  return '<span class="unit-box" aria-hidden="true"><i></i></span>';
}
function cargoPiece(value, index) {
  const action = `type="button" data-action="remove" data-index="${index}" data-focus="piece-${index}"`;
  if (current.kind === 'load') {
    if (value === 10) return `<button class="cargo-piece full-crate crate-stack" ${action} aria-label="Убрать десять ящиков"><span class="crate-units">${Array.from({ length: 10 }, unitBox).join('')}</span><b>10</b><span class="remove-mark" aria-hidden="true">−</span></button>`;
    return `<button class="cargo-piece load-box" ${action} aria-label="Убрать один ящик">${unitBox()}<span class="remove-mark" aria-hidden="true">−</span></button>`;
  }
  if (value === 10) return `<button class="cargo-piece full-crate" ${action} aria-label="Убрать коробку с десятью яблоками"><span class="crate-apples" aria-hidden="true">${Array.from({ length: 10 }, () => `<span class="art-item">${item('apple')}</span>`).join('')}</span><b>10</b><span class="remove-mark" aria-hidden="true">−</span></button>`;
  return `<button class="cargo-piece single-apple" ${action} aria-label="Убрать одно яблоко"><span class="art-item" aria-hidden="true">${item('apple')}</span><span class="remove-mark" aria-hidden="true">−</span></button>`;
}
function addSupplies() {
  const max = current.autoFinish ? current.target : 40;
  const sum = taskTotal(current);
  const supplies = current.pieces.map(value => {
    const isLoad = current.kind === 'load';
    const picture = isLoad
      ? value === 10 ? `<span class="supply-bundle">${unitBox()}${unitBox()}<b>10</b></span>` : unitBox()
      : value === 10 ? `<span class="small-crate"><span class="art-item">${item('apple')}</span><b>10</b></span>` : `<span class="art-item">${item('apple')}</span>`;
    const label = isLoad ? value === 10 ? 'Ящики · 10' : 'Ящик · 1' : value === 10 ? 'Коробка · 10' : 'Яблоко · 1';
    return `<button class="supply-button ${value === 10 ? 'ten' : 'one'}" type="button" data-action="add" data-value="${value}" data-focus="add-${value}" ${sum + value > max ? 'disabled' : ''}><span class="supply-icon" aria-hidden="true">${picture}</span><span>${label}</span><strong aria-hidden="true">+</strong></button>`;
  });
  return `<div class="supply-row">${supplies.join('')}</div>`;
}
function cargoBoard() {
  const isOrder = current.kind === 'orders';
  return sceneWorld(`<div class="cargo-heading"><div class="cargo-train art-train" aria-hidden="true">${train()}</div><span class="cargo-total">${isOrder ? 'В заказе' : 'В вагоне'} <strong id="current-total">${taskTotal(current)}</strong></span><div class="cargo-friend art-portrait" aria-hidden="true">${portrait('rabbit', phase === 'won' ? 'win' : 'happy')}</div></div><div class="delivery-tray"><div class="cargo-space">${current.parts.length ? current.parts.map(cargoPiece).join('') : `<div class="empty-tray">${isOrder ? 'Соберём заказ?' : 'Вагон ждёт ящики'}<span>Выбирай внизу ↓</span></div>`}</div></div>`) + addSupplies() + `<p class="play-hint">${isOrder ? 'Чтобы убрать, нажми на яблоко или коробку.' : 'Чтобы убрать, нажми на ящик в вагоне.'}</p>`;
}
function choiceButtons() {
  return `<div class="number-choices" role="group" aria-label="Выбери число">${current.choices.map(value => `<button class="number-choice ${current.selected === value ? 'is-picked' : ''}" type="button" data-action="pick" data-value="${value}" data-focus="choice-${value}">${value}</button>`).join('')}</div>`;
}
function findBoard() {
  return sceneWorld(`<div class="find-display"><div class="find-friend art-portrait" aria-hidden="true">${portrait('fox', phase === 'won' ? 'win' : 'thinking')}</div><span class="mystery-ticket" aria-hidden="true">?</span><button class="secondary-button listen-button" type="button" data-action="repeat"><span aria-hidden="true">♫</span> Послушать</button></div>`) + choiceButtons();
}
function objectGroups(n, kind = 'apple') {
  const groups = [];
  for (let offset = 0; offset < n; offset += 5) groups.push(`<span class="object-group">${Array.from({ length: Math.min(5, n - offset) }, () => `<span class="count-object art-item" aria-hidden="true">${item(kind)}</span>`).join('')}</span>`);
  return groups.join('');
}
function countBoard() {
  return sceneWorld(`<div class="count-field" role="img" aria-label="Яблоки для счёта">${objectGroups(current.target)}</div>`) + choiceButtons();
}
function missingBoard() {
  // The model fills sequence only after a correct pick; answers is ordered by holes.
  const firstOpen = current.holes.find(index => current.sequence[index] === null);
  const visible = current.sequence.filter(value => value !== null);
  const reverse = visible[0] > visible.at(-1);
  return sceneWorld(`<div class="sequence-label">${reverse ? 'Считаем обратно' : 'Числа по порядку'}</div><div class="number-sequence" aria-label="Числовой ряд">${current.sequence.map((value, index) => {
    const wasHole = current.holes.includes(index);
    return `<span class="sequence-car ${wasHole ? 'was-hole' : ''} ${index === firstOpen ? 'open-hole' : ''} ${wasHole && value !== null ? 'filled-hole' : ''}" aria-label="${value === null ? 'Пропущенное число' : value}"><strong>${value === null ? '?' : value}</strong><i aria-hidden="true"></i></span>`;
  }).join('')}</div>`) + choiceButtons();
}
function neighborsBoard() {
  const before = current.direction === 'before';
  return sceneWorld(`<div class="neighbor-label">${before ? 'Перед этим числом' : 'После этого числа'}</div><div class="neighbor-track" aria-label="${before ? 'Какое число перед' : 'Какое число после'} ${current.anchor}"><span class="neighbor-number ${before ? 'unknown' : ''}">${before ? '?' : current.anchor}</span><span class="neighbor-arrow" aria-hidden="true">→</span><span class="neighbor-number ${before ? '' : 'unknown'}">${before ? current.anchor : '?'}</span></div>`) + choiceButtons();
}
function longBoard() {
  const cursor = current.cursor;
  return sceneWorld(`<div class="long-route" aria-hidden="true">${Array.from({ length: current.target }, (_, index) => `<i class="${index < cursor ? 'visited' : ''}"></i>`).join('')}</div><button type="button" class="count-train" data-action="tick" data-focus="tick" aria-label="Следующее число. Сейчас ${cursor}"><span class="art-train" aria-hidden="true">${train()}</span><strong class="cursor-number">${cursor || 'Поехали!'}</strong><span class="train-tap">Нажимай на поезд</span></button>`);
}
function sharingBoard() {
  return sceneWorld(`<div class="picnic-table">${current.piles.map((n, index) => `<div class="plate-group"><div class="friend"><span class="friend-portrait art-portrait" aria-hidden="true">${portrait(index ? 'fox' : 'rabbit', phase === 'won' ? 'win' : 'happy')}</span><strong>${index ? 'Лисёнок' : 'Зайчик'}</strong></div><button type="button" class="plate" data-action="transfer" data-from="${index}" data-focus="plate-${index}" aria-label="${index ? 'Лисёнок' : 'Зайчик'}: ${n} угощений. Переложить одно соседу" ${n === 0 ? 'disabled' : ''}><span class="plate-food">${n ? Array.from({ length: n }, () => `<span class="art-item" aria-hidden="true">${item('cookie')}</span>`).join('') : '<span class="empty-plate">Пока пусто</span>'}</span><strong class="plate-count">${n}</strong></button><span class="transfer-label" aria-hidden="true">${index ? '← Поделиться' : 'Поделиться →'}</span></div>`).join('')}</div>`) + '<p class="play-hint">Нажми на тарелку — одно печенье перейдёт другу.</p>';
}
function bridgeBoard() {
  const sum = taskTotal(current);
  const span = Math.max(current.target, sum, 1);
  const marker = current.target / span * 100;
  const river = `<div class="bridge-meter"><span>Построено <strong id="current-total">${sum}</strong></span><span>Нужно <strong>${current.target}</strong></span></div><div class="river-crossing"><div class="river-water" aria-hidden="true"></div><div class="bridge-target" style="--marker:${marker}%" aria-label="Цель ${current.target}"><span>${current.target}</span><i aria-hidden="true"></i></div><div class="crossing-train art-train ${phase === 'won' ? 'crossed' : ''}" style="left:${phase === 'won' ? Math.min(65, Math.max(0, marker - 30)) : 0}%" aria-hidden="true">${train()}</div><div class="bridge-built" aria-label="Детали моста">${current.parts.map(value => `<span class="bridge-segment length-${value}" style="width:${value / span * 100}%" aria-label="Длина ${value}">${value / span >= .055 ? `<b>${value}</b>` : ''}</span>`).join('')}</div><div class="bridge-ruler" style="--span:${span}" aria-hidden="true">${Array.from({ length: span }, (_, i) => `<i${i + 1 === current.target ? ' class="goal-tick"' : ''}></i>`).join('')}</div></div>`;
  return sceneWorld(river) + `<div class="bridge-pieces" role="group" aria-label="Выбери длину детали">${current.pieces.map(value => `<button class="plank-button length-${value}" type="button" data-action="add" data-value="${value}" data-focus="add-${value}" aria-label="Добавить деталь длиной ${value}" ${sum + value > 40 ? 'disabled' : ''}><span class="plank-icon" style="--length:${value}" aria-hidden="true"><i></i></span><strong>${value}</strong><span aria-hidden="true">+</span></button>`).join('')}</div><div class="built-pieces" role="group" aria-label="Убрать деталь">${current.parts.length ? current.parts.map((value, index) => `<button type="button" class="piece-chip length-${value}" data-action="remove" data-index="${index}" data-focus="piece-${index}" aria-label="Убрать деталь ${index + 1} длиной ${value}">${value}<span aria-hidden="true">×</span></button>`).join('') : '<span class="empty-pieces">Выбери первую деталь ↑</span>'}</div><p class="play-hint">Нажми на число с ×, чтобы убрать любую деталь.</p>`;
}
const BOARD_RENDERERS = { load: cargoBoard, find: findBoard, count: countBoard, missing: missingBoard, neighbors: neighborsBoard, long: longBoard, orders: cargoBoard, sharing: sharingBoard, bridge: bridgeBoard };
function renderBoard() {
  if (!current) return;
  const focus = document.activeElement?.dataset.focus;
  const root = $('game');
  root.dataset.stage = current.stageId;
  root.dataset.kind = current.kind;
  root.dataset.target = current.target;
  root.dataset.phase = phase;
  root.dataset.round = current.round;
  root.dataset.current = current.kind === 'sharing' ? current.piles.join(',') : taskTotal(current);
  $('board').innerHTML = BOARD_RENDERERS[current.kind]();
  root.querySelector('[data-action="reset"]').disabled = phase === 'won';
  $('help').hidden = phase === 'won';
  if (phase === 'won') $('board').querySelectorAll('button').forEach(button => { button.disabled = true; });
  if (focus) {
    const target = Array.from($('board').querySelectorAll('[data-focus]')).find(button => button.dataset.focus === focus);
    if (target && !target.disabled) target.focus({ preventScroll: true });
    else if (phase === 'playing') $('board').querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
  }
}
function tryText(result) {
  if (current.kind === 'sharing') return 'Пока не поровну. Посмотри, у кого больше, и поделись.';
  if (current.kind === 'orders') return ['empty', 'less'].includes(result.status) ? 'Зайчик просил больше. Добавь яблоки.' : 'Яблок больше, чем нужно. Убери лишнее.';
  if (current.kind === 'bridge') return ['empty', 'less'].includes(result.status) ? 'До флажка ещё немного. Добавь деталь.' : 'Мост длиннее, чем нужно. Убери или замени деталь.';
  if (current.kind === 'missing') return 'Попробуем другое число. Посмотри на соседние окошки.';
  if (current.kind === 'neighbors') return `Посмотри ещё раз: нужно число ${current.direction === 'before' ? 'перед' : 'после'}.`;
  if (current.kind === 'count') return 'Давай посчитаем ещё раз. Можно нажать «Подсказка».';
  return 'Послушай ещё раз и попробуй другое число.';
}
function winTask(prefix = []) {
  if (!current || phase !== 'playing') return;
  phase = 'won';
  progress = winProgress(progress, current.stageId, current.kind);
  if (journey && journey.index === 1 && !journey.completed) {
    progress = finishJourney(progress, journey.stageId);
    journey.completed = true;
  }
  persist(); renderBoard();
  $('check').hidden = true;
  $('reward').hidden = false;
  $('reward-title').textContent = CONFIG[current.kind].reward;
  $('reward-text').textContent = journey && journey.completed ? 'Два дела сделаны! Следующая станция — только если ты сам захочешь.' : CONFIG[current.kind].after;
  $('next').textContent = journey ? (journey.completed ? 'На карту →' : 'Второе дело →') : 'Ещё задание →';
  setFeedback();
  voice.say([...prefix, ...feedback(current, 'correct')]);
  $('next').focus({ preventScroll: true });
}
function edit(action, button) {
  if (!current || phase !== 'playing') return;
  const value = action === 'remove' ? Number(button.dataset.index) : action === 'transfer' ? Number(button.dataset.from) : Number(button.dataset.value);
  const previous = current;
  current = act(current, action === 'tick' ? { type: action } : { type: action, value });
  if (current === previous) {
    if (action === 'add') {
      setFeedback('Здесь уже достаточно места занято. Можно убрать лишнее.');
      if (ADVANCED.has(current.kind)) voice.say([{ clip: 'ph_capacity' }]);
    }
    return;
  }
  const result = assess(current);
  let quantity = [];
  if (current.kind === 'long') quantity = [current.cursor];
  else if (action === 'add' || action === 'remove') quantity = taskTotal(current) > 0 ? [taskTotal(current)] : [];
  else if (action === 'transfer') quantity = current.piles[1 - value] > 0 ? [current.piles[1 - value]] : [];
  if (current.autoFinish && result.correct) { winTask(quantity); return; }
  renderBoard();
  if (action === 'pick') {
    if (result.status === 'progress') {
      setFeedback('Это окошко готово! Теперь заполни следующее.', 'progress');
      voice.say(feedback(current, 'progress'));
    } else {
      setFeedback(tryText(result), 'try');
      voice.say(feedback(current, result.status));
    }
  } else {
    setFeedback();
    if (quantity.length) voice.say(quantity); else voice.stop();
  }
}
function checkAnswer() {
  if (!current || phase !== 'playing' || !ADVANCED.has(current.kind)) return;
  const result = assess(current);
  if (result.correct) { winTask(); return; }
  setFeedback(tryText(result), 'try');
  voice.say(feedback(current, result.status));
}
function helpTask() {
  if (!current || phase !== 'playing') return;
  if (current.kind === 'count') {
    setFeedback('Считай по одному яблоку. Потом выбери число.', 'help');
    voice.say(Array.from({ length: current.target }, (_, index) => index + 1));
    return;
  }
  const hint = {
    load: 'Добавляй ящики кнопкой внизу. Чтобы убрать — нажми на ящик в вагоне.',
    find: 'Послушай число. Затем найди такую же цифру на кнопке.',
    missing: 'Смотри на числа рядом с жёлтым окошком. Заполняй окошки по очереди.',
    neighbors: `Нужно число ${current.direction === 'before' ? 'перед' : 'после'} ${current.anchor}. Считай по порядку.`,
    long: 'Нажми на большой поезд — он назовёт следующее число.',
    orders: 'В коробке десять яблок. Можно добавлять по одному и убирать любой предмет.',
    sharing: 'У кого печенья больше? Нажми на его тарелку, чтобы поделиться одним.',
    bridge: 'Одна большая деталь заменяет несколько маленьких. Цель отмечена флажком.',
  }[current.kind];
  setFeedback(hint, 'help');
  narrateTask();
}
function resetTask() {
  if (!current || phase !== 'playing') return;
  voice.stop();
  const kind = current.kind;
  const route = journey;
  startTask(kind, { route });
}
function nextTask() {
  if (!current || phase !== 'won') return;
  if (!journey) { startTask(current.kind); return; }
  if (journey.completed) { showHome({ completed: true }); return; }
  const route = { ...journey, index: journey.index + 1 };
  startTask(route.kinds[route.index], { route });
}

document.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button || button.disabled) return;
  hasGesture = true;
  const action = button.dataset.action;
  if (action === 'sound') {
    voice.stop(); progress.sound = !progress.sound; persist(); updateSound();
    if (progress.sound) { voice.unlock(); if (current) narrateTask(); }
    else if (current?.kind === 'find' && phase === 'playing') setFeedback('Чтобы услышать число, включи звук вверху.');
    return;
  }
  voice.unlock();
  if (action === 'stage') selectStage(Number(button.dataset.stage));
  else if (action === 'start') startTask(button.dataset.kind);
  else if (action === 'journey') beginJourney();
  else if (action === 'home') showHome();
  else if (action === 'repeat') narrateTask();
  else if (action === 'reset') resetTask();
  else if (action === 'check') checkAnswer();
  else if (action === 'help') helpTask();
  else if (action === 'next') nextTask();
  else if (['add', 'remove', 'transfer', 'pick', 'tick'].includes(action)) edit(action, button);
});
document.addEventListener('visibilitychange', () => { if (document.hidden) voice.stop(); });
window.addEventListener('pagehide', () => voice.stop());

showHome({ focus: false, clearQuery: false });
updateSaveNote();
const query = new URLSearchParams(location.search);
const queryStage = query.get('stage');
const queryGame = query.get('game');
// Direct links stay silent until a gesture. Invalid explicit combinations stay home.
if (queryStage !== null) {
  const requested = /^[1-5]$/.test(queryStage) ? validStage(Number(queryStage)) : null;
  if (requested && (!queryGame || availableGames(requested.id).includes(queryGame))) {
    stageId = requested.id; progress.stage = requested.id; persist(); renderHome();
    if (queryGame) startTask(queryGame, { narrate: false });
  }
} else if (queryGame && GAME_IDS.includes(queryGame)) {
  const requestedId = ADVANCED.has(queryGame) ? 4 : stageId;
  if (availableGames(requestedId).includes(queryGame)) {
    stageId = requestedId; progress.stage = requestedId; persist(); renderHome();
    startTask(queryGame, { narrate: false });
  }
}
