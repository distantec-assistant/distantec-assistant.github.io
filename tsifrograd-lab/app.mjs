import { GAME_IDS, createRound, addPiece, removePiece, transfer, total, evaluate } from './model.mjs';
import { scene, portrait, item, train } from './art.mjs';
import { KEY, parseProgress, winProgress } from './progress.mjs';
import { clipUrl, instruction, feedbackClip } from './narration.mjs';

const $ = id => document.getElementById(id);
const CONFIG = {
  orders: { title: 'Заказы для пассажиров', short: 'Собери заказ', place: 'Станция «Вкусная»', description: 'Выбирай десятки и единицы. Решай сам, когда заказ готов.', button: 'Отправить заказ', animal: 'rabbit', reward: 'Заказ доставлен!', after: 'Зайчик получил ровно столько яблок, сколько просил.' },
  sharing: { title: 'Угости поровну', short: 'Угости друзей', place: 'Станция «Дружная»', description: 'Перекладывай угощение, чтобы обоим друзьям досталось поровну.', button: 'У всех поровну!', animal: 'fox', reward: 'Хватило обоим!', after: 'На двух тарелках одинаковое количество. Вот это дружба!' },
  bridge: { title: 'Построй мост', short: 'Построй мост', place: 'Станция «Речная»', description: 'Соединяй детали разной длины и открывай поезду дорогу.', button: 'Поезд, поехали!', animal: 'bear', reward: 'Дорога открыта!', after: 'Мост соединил берега. Поезд может ехать дальше.' },
};
let progress;
try { progress = parseProgress(localStorage.getItem(KEY)); } catch { progress = parseProgress(null); }
let current = null;
let phase = 'playing';
let journey = false;
let journeyStep = 0;
let storageAvailable = true;

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(progress)); }
  catch { storageAvailable = false; $('save-note').textContent = 'Сохранение недоступно — результаты останутся до закрытия страницы'; }
}

// Julia v3 is synthesized only at build time; the browser plays static files.
const failedAudio = new Set();
class Voice {
  constructor() { this.generation = 0; this.context = null; this.cache = new Map(); this.source = null; this.finish = null; }
  unlock() {
    if (!progress.sound) return;
    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!this.context && Context) this.context = new Context();
      if (this.context?.state === 'suspended') this.context.resume().catch(() => {});
    } catch { /* Visible instructions remain usable when sound is unavailable. */ }
  }
  stop() {
    this.generation++;
    if (this.source) { try { this.source.stop(); } catch { /* Already ended. */ } this.source = null; }
    if (this.finish) { const finish = this.finish; this.finish = null; finish(); }
  }
  async clip(id, token) {
    if (!progress.sound || token !== this.generation || !this.context) return;
    if (!this.cache.has(id)) {
      const result = fetch(clipUrl(id)).then(r => {
        if (!r.ok) throw new Error('audio unavailable');
        return r.arrayBuffer();
      }).then(buffer => this.context.decodeAudioData(buffer)).then(buffer => {
        failedAudio.delete(id); updateSound(); return buffer;
      }).catch(() => {
        this.cache.delete(id); failedAudio.add(id); updateSound(); return null;
      });
      this.cache.set(id, result);
    }
    const buffer = await this.cache.get(id);
    if (!buffer || !progress.sound || token !== this.generation || this.context.state !== 'running') return;
    await new Promise(resolve => {
      const source = this.context.createBufferSource(); source.buffer = buffer; source.connect(this.context.destination);
      let ended = false;
      const finish = () => { if (ended) return; ended = true; clearTimeout(timer); if (this.source === source) this.source = null; if (this.finish === finish) this.finish = null; resolve(); };
      const timer = setTimeout(() => { try { source.stop(); } catch {} finish(); }, buffer.duration * 1000 + 700);
      this.finish = finish; this.source = source; source.onended = finish;
      try { source.start(); } catch { finish(); }
    });
  }
  async say(parts) {
    this.stop(); if (!progress.sound) return;
    this.unlock(); const token = this.generation;
    for (const part of parts) {
      if (token !== this.generation || !progress.sound) return;
      if (typeof part === 'number') {
        if (Number.isInteger(part) && part >= 1 && part <= 40) await this.clip(`c_${part}`, token);
      } else if (typeof part === 'object' && part?.clip) await this.clip(part.clip, token);
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
  $('sound').setAttribute('aria-pressed', String(!progress.sound));
  $('voice-note').hidden = !progress.sound || failedAudio.size === 0;
}

function cardArt(kind) {
  if (kind === 'orders') return `<div class="card-portrait art-portrait">${portrait('rabbit')}</div><div class="card-crate"><span>10</span>${item('apple')}</div><div class="card-apple">${item('apple')}</div>`;
  if (kind === 'sharing') return `<div class="card-friend first art-portrait">${portrait('rabbit')}</div><div class="card-friend second art-portrait">${portrait('fox')}</div><div class="card-cookie">${item('cookie')}</div><span class="card-equals">=</span>`;
  return `<div class="mini-bridge"><i></i><i></i><i></i><i></i><i></i></div><div class="card-train art-train">${train()}</div><span class="card-length">10</span><span class="card-length small">5</span>`;
}
function renderHome() {
  $('game-cards').innerHTML = GAME_IDS.map((kind, i) => `<button type="button" class="game-card ${kind}" data-action="start" data-kind="${kind}"><div class="card-picture"><div class="art-backdrop">${scene(kind)}</div>${cardArt(kind)}<span class="card-index">0${i + 1}</span></div><div class="card-copy"><span class="card-kicker">${CONFIG[kind].place}</span><h3>${CONFIG[kind].short}</h3><p>${CONFIG[kind].description}</p><div class="card-bottom"><span>${progress.counts[kind] ? `Выполнено: ${progress.counts[kind]}` : 'Попробовать'}</span><span class="card-arrow" aria-hidden="true">→</span></div></div></button>`).join('');
}
function showHome() {
  voice.stop(); current = null; journey = false;
  $('home').hidden = false; $('game').hidden = true;
  renderHome(); updateSound(); window.scrollTo(0, 0);
  document.title = 'Цифроград — новые приключения';
}
function narrateTask() {
  if (!current) return;
  voice.say(instruction(current.kind, current.target));
}
function setFeedback(text, type = '') {
  $('feedback').textContent = text; $('feedback').dataset.type = type;
}
function start(kind, asJourney = false) {
  if (!GAME_IDS.includes(kind)) return;
  voice.stop(); journey = asJourney;
  current = createRound(kind, progress.counts[kind]); phase = 'playing';
  $('home').hidden = true; $('game').hidden = false;
  $('game-title').textContent = CONFIG[kind].title;
  $('game-kicker').textContent = asJourney ? `Путешествие · станция ${journeyStep + 1} из 3` : CONFIG[kind].place;
  $('task-icon').innerHTML = portrait(CONFIG[kind].animal);
  $('task-number').textContent = kind === 'sharing' ? '=' : String(current.target);
  $('task-number').setAttribute('aria-label', kind === 'sharing' ? 'Одинаково' : `Нужно ${current.target}`);
  $('task-text').textContent = {
    orders: 'Собери заказ для зайчика. Добавляй и убирай яблоки, пока не будет нужного количества.',
    sharing: 'У друзей разное количество угощений. Нажимай на тарелки, чтобы поделиться и сделать поровну.',
    bridge: 'Соедини берега. Мост должен заканчиваться у флажка. Детали можно добавлять и убирать.',
  }[kind];
  $('check').textContent = CONFIG[kind].button;
  $('reward').hidden = true; $('check').hidden = false;
  setFeedback('Можно пробовать и исправлять — мы никуда не спешим.');
  renderBoard(); updateSound(); window.scrollTo(0, 0);
  document.title = `${CONFIG[kind].short} — Цифроград`;
  narrateTask();
}
function cargoPiece(value, index) {
  if (value === 10) return `<button class="cargo-piece full-crate" type="button" data-action="remove" data-index="${index}" data-focus="piece-${index}" aria-label="Убрать коробку с десятью яблоками"><span class="crate-apples">${Array.from({ length: 10 }, () => `<span class="art-item">${item('apple')}</span>`).join('')}</span><b>10</b><span class="remove-mark" aria-hidden="true">−</span></button>`;
  return `<button class="cargo-piece single-apple" type="button" data-action="remove" data-index="${index}" data-focus="piece-${index}" aria-label="Убрать одно яблоко"><span class="art-item">${item('apple')}</span><span class="remove-mark" aria-hidden="true">−</span></button>`;
}
function orderBoard() {
  const n = total(current);
  return `<div class="play-world orders-world"><div class="art-backdrop">${scene('orders')}</div><div class="order-customer art-portrait">${portrait('rabbit', phase === 'won' ? 'win' : 'happy')}</div><div class="customer-bubble">Заказ <strong>${current.target}</strong></div><div class="delivery-tray"><div class="tray-label"><span>В заказе</span><strong id="current-total">${n}</strong></div><div class="cargo-space">${current.parts.length ? current.parts.map(cargoPiece).join('') : '<div class="empty-tray">Здесь будет заказ<br><span>Выбирай яблоки внизу ↓</span></div>'}</div></div></div><div class="supply-row"><button class="supply-button ten" type="button" data-action="add" data-value="10" data-focus="add-10"><span class="supply-crate">${item('apple')}<b>10</b></span><span>Добавить десяток</span><strong aria-hidden="true">+</strong></button><button class="supply-button one" type="button" data-action="add" data-value="1" data-focus="add-1"><span class="supply-apple art-item">${item('apple')}</span><span>Добавить одно</span><strong aria-hidden="true">+</strong></button></div><p class="play-hint">Нажми на яблоко или коробку в заказе, чтобы убрать.</p>`;
}
function sharingBoard() {
  return `<div class="play-world sharing-world"><div class="art-backdrop">${scene('sharing')}</div><div class="friends"><div class="friend"><div class="friend-portrait art-portrait">${portrait('rabbit', phase === 'won' ? 'win' : 'happy')}</div><span class="friend-name">Зайчик</span></div><div class="friend"><div class="friend-portrait art-portrait">${portrait('fox', phase === 'won' ? 'win' : 'happy')}</div><span class="friend-name">Лисёнок</span></div></div><div class="picnic-table">${current.piles.map((n, i) => `<div class="plate-group"><button type="button" class="plate" data-action="transfer" data-from="${i}" data-focus="plate-${i}" aria-label="${i ? 'Лисёнок' : 'Зайчик'}: ${n}. Переложить одно угощение соседу" ${n === 0 ? 'disabled' : ''}><span class="plate-food">${Array.from({ length: n }, () => `<span class="art-item">${item('cookie')}</span>`).join('')}${n ? '' : '<span class="empty-plate">Пока пусто</span>'}</span><span class="plate-count">${n}</span></button><span class="transfer-label" aria-hidden="true">${i ? '← Поделиться' : 'Поделиться →'}</span></div>`).join('')}</div></div><p class="play-hint">Нажми на тарелку с большим количеством — одно угощение перейдёт соседу.</p>`;
}
function bridgeBoard() {
  const n = total(current); const span = Math.max(current.target, n, 1);
  const marker = current.target / span * 100;
  return `<div class="play-world bridge-world"><div class="art-backdrop">${scene('bridge')}</div><div class="bridge-foreman art-portrait">${portrait('bear', phase === 'won' ? 'win' : 'happy')}</div><div class="bridge-meter"><span>Нужно <strong>${current.target}</strong></span><span>Построено <strong id="current-total">${n}</strong></span></div><div class="river-crossing"><div class="river-water"><i></i><i></i><i></i></div><div class="river-bank near"></div><div class="river-bank far" style="--marker:${marker}%"></div><div class="bridge-target" style="--marker:${marker}%"><span>Цель ${current.target}</span><i></i></div><div class="bridge-built" style="--span:${span}">${current.parts.map(value => `<span class="bridge-segment length-${value}" style="width:${value / span * 100}%"><b>${value}</b></span>`).join('')}</div><div class="bridge-ruler" style="--span:${span}">${Array.from({ length: span }, (_, i) => `<i${i + 1 === current.target ? ' class="goal-tick"' : ''}></i>`).join('')}</div><div class="crossing-train art-train ${phase === 'won' ? 'crossed' : ''}" style="--marker:${marker}%">${train()}</div></div></div><div class="bridge-pieces" aria-label="Выбрать длину детали">${[1, 2, 5, 10].map(value => `<button class="plank-button length-${value}" type="button" data-action="add" data-value="${value}" data-focus="add-${value}" aria-label="Добавить деталь длиной ${value}"><span class="plank-icon" style="--length:${value}"><i></i></span><strong>${value}</strong><span aria-hidden="true">+</span></button>`).join('')}</div><div class="built-pieces" aria-label="Добавленные детали">${current.parts.length ? current.parts.map((value, i) => `<button type="button" class="piece-chip length-${value}" data-action="remove" data-index="${i}" data-focus="piece-${i}" aria-label="Убрать деталь ${i + 1} длиной ${value}">${value}<span aria-hidden="true">×</span></button>`).join('') : '<span class="empty-pieces">Выбери первую деталь ↑</span>'}</div><p class="play-hint">Мост короткий или длинный? Нажми на добавленную деталь, чтобы убрать её.</p>`;
}
function renderBoard() {
  const focus = document.activeElement?.dataset.focus;
  const root = $('game'); root.dataset.kind = current.kind; root.dataset.target = current.target;
  root.dataset.phase = phase; root.dataset.round = current.round;
  root.dataset.current = current.kind === 'sharing' ? current.piles.join(',') : total(current);
  $('board').innerHTML = ({ orders: orderBoard, sharing: sharingBoard, bridge: bridgeBoard })[current.kind]();
  document.querySelector('#game [data-action="reset"]').disabled = phase === 'won';
  if (phase === 'won') $('board').querySelectorAll('button').forEach(b => { b.disabled = true; });
  if (focus) $('board').querySelector(`[data-focus="${focus}"]`)?.focus({ preventScroll: true });
}
function edit(action, button) {
  if (!current || phase !== 'playing') return;
  let next = current;
  if (action === 'add') next = addPiece(current, Number(button.dataset.value));
  if (action === 'remove') next = removePiece(current, Number(button.dataset.index));
  if (action === 'transfer') next = transfer(current, Number(button.dataset.from));
  if (next === current) {
    setFeedback('Места уже достаточно. Можно убрать лишнее и попробовать ещё раз.');
    voice.say([{ clip: 'ph_capacity' }]); return;
  }
  current = next; renderBoard(); setFeedback('');
  const n = current.kind === 'sharing' ? current.piles[1 - Number(button.dataset.from)] : total(current);
  if (n > 0) voice.say([n]); else voice.stop();
}
function checkAnswer() {
  if (!current || phase !== 'playing') return;
  const result = evaluate(current);
  if (!result.correct) {
    const text = current.kind === 'sharing' ? 'Пока не поровну. Посмотри, на какой тарелке больше, и поделись.'
      : current.kind === 'orders' ? (result.status === 'less' ? 'Зайчик просил больше. Добавь яблоки и проверь ещё раз.' : 'Получилось больше, чем нужно. Убери лишнее — и попробуй снова.')
      : result.status === 'less' ? 'Мост пока не доходит до флажка. Добавь деталь.' : 'Мост длиннее, чем нужно. Убери или замени деталь.';
    setFeedback(text, 'try'); voice.say([{ clip: feedbackClip(current.kind, result.status) }]); return;
  }
  phase = 'won'; progress = winProgress(progress, current.kind); persist(); renderBoard();
  $('check').hidden = true; $('reward').hidden = false;
  $('reward-title').textContent = CONFIG[current.kind].reward;
  $('reward-text').textContent = CONFIG[current.kind].after;
  $('next').textContent = journey ? (journeyStep === 2 ? 'Путешествие завершено →' : 'Следующая станция →') : 'Ещё задание →';
  setFeedback(''); voice.say([{ clip: 'ph_p1' }]);
  $('next').focus({ preventScroll: true });
}
document.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button || button.disabled) return;
  voice.unlock();
  const action = button.dataset.action;
  if (action === 'start') { journeyStep = 0; start(button.dataset.kind); }
  else if (action === 'journey') { journeyStep = 0; start(GAME_IDS[0], true); }
  else if (action === 'home') showHome();
  else if (action === 'repeat') narrateTask();
  else if (action === 'reset' && current) start(current.kind, journey);
  else if (action === 'check') checkAnswer();
  else if (action === 'next' && current && phase === 'won') {
    if (journey) {
      if (journeyStep === 2) { showHome(); $('home-title').focus({ preventScroll: true }); }
      else { journeyStep++; start(GAME_IDS[journeyStep], true); }
    } else start(current.kind);
  } else if (['add', 'remove', 'transfer'].includes(action)) edit(action, button);
});
$('sound').addEventListener('click', () => {
  voice.stop(); progress.sound = !progress.sound; persist(); updateSound();
  if (progress.sound && current) narrateTask();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) voice.stop(); });
window.addEventListener('pagehide', () => voice.stop());
$('hero-scene').innerHTML = scene('sharing'); $('hero-train').innerHTML = train();
renderHome(); updateSound();
const direct = new URLSearchParams(location.search).get('game');
// A direct link opens a scene silently; narration starts after a user gesture.
if (GAME_IDS.includes(direct)) { const wasSound = progress.sound; progress.sound = false; start(direct); progress.sound = wasSound; updateSound(); }
