const COPY = {
  open: { title: 'Найди одинаковых', guide: 'Нажми на две одинаковые картинки.', label: 'Пары', cover: 'fox' },
  closed: { title: 'Пары на память', guide: 'Открой две карточки. Запомни, кто где.', label: 'На память', cover: 'penguin' },
  missing: { title: 'Кто исчез с фотографии?', label: 'Кто исчез?', cover: 'rabbit' },
};
const NAMES = { fox: 'Лисёнок', penguin: 'Пингвин', frog: 'Лягушка', rabbit: 'Зайчик', bear: 'Медвежонок', cat: 'Котёнок' };
const SVG = 'http://www.w3.org/2000/svg';
const $ = (id) => document.getElementById(id);
const ui = Object.fromEntries([
  'chapter', 'counter', 'game-heading', 'instruction', 'feedback', 'pair-area', 'board', 'peek-grid', 'photo-area',
  'scene-people', 'photo-caption', 'missing-action', 'pick-note', 'original', 'choices', 'hint', 'replay', 'next', 'awards',
].map((id) => [id, $(id)]));
const nav = [...document.querySelectorAll('.pages a')];
const album = createAlbum(() => window.localStorage);
let round;
let buttons = [];
let candidates = [];
let sceneKey = '';

function icon(id, className = '', viewBox = '0 0 32 32') {
  const svg = document.createElementNS(SVG, 'svg');
  if (className) svg.setAttribute('class', className);
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const use = document.createElementNS(SVG, 'use');
  use.setAttribute('href', `#${id}`);
  svg.append(use);
  return svg;
}

function element(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function text(node, value) {
  if (node.textContent !== value) node.textContent = value;
}

function label(node, value) {
  if (node.getAttribute('aria-label') !== value) node.setAttribute('aria-label', value);
}

function tile(tag, activate) {
  const node = element(tag, 'tile');
  const art = icon('icon-camera', 'hero', '0 0 120 110');
  const mark = icon('icon-check', 'tile-mark');
  if (activate) {
    node.type = 'button';
    node.addEventListener('click', activate);
  } else {
    node.setAttribute('role', 'img');
  }
  node.append(art, mark);
  return { node, art, use: art.firstElementChild };
}

function paintTile(target, look, hero, name, disabled = false) {
  const { node, art, use } = target;
  node.dataset.look = look;
  if (hero) node.dataset.hero = hero;
  else delete node.dataset.hero;
  art.setAttribute('viewBox', hero ? '0 0 120 110' : '0 0 32 32');
  use.setAttribute('href', hero ? `#hero-${hero}` : '#icon-camera');
  label(node, name);
  if (disabled) node.setAttribute('aria-disabled', 'true');
  else node.removeAttribute('aria-disabled');
}

const stampNodes = STAGES.map((kind, i) => {
  const node = element('li', 'stamp');
  node.dataset.award = kind;
  node.dataset.hero = COPY[kind].cover;
  const frame = element('span', 'stamp-frame');
  frame.setAttribute('aria-hidden', 'true');
  const art = icon('icon-frame', 'stamp-art');
  frame.append(art, icon('icon-check', 'stamp-seal'));
  const copy = element('span', 'stamp-copy');
  const ordinal = element('span', 'stamp-num');
  ordinal.textContent = `0${i + 1}`;
  const title = element('span', 'stamp-title');
  title.textContent = COPY[kind].label;
  copy.append(ordinal, title);
  node.append(frame, copy);
  ui.awards.append(node);
  return { node, art };
});

function showAlbum() {
  const earned = album.completed();
  for (const [i, kind] of STAGES.entries()) {
    const { node, art } = stampNodes[i];
    const done = earned.includes(kind);
    if (node.dataset.earned === `${done}`) continue;
    node.dataset.earned = `${done}`;
    art.setAttribute('viewBox', done ? '0 0 120 110' : '0 0 32 32');
    art.firstElementChild.setAttribute('href', done ? `#hero-${COPY[kind].cover}` : '#icon-frame');
    label(node, `${COPY[kind].label}: ${done ? 'снимок в альбоме' : 'пока без снимка'}`);
  }
}

function makePairs() {
  const preview = ui['peek-grid'];
  ui.board.dataset.columns = preview.dataset.columns = round.kind === 'open' ? '2' : '3';
  buttons = round.cards.map((_, index) => tile('button', () => act({ type: 'card', index })));
  ui.board.replaceChildren(...buttons.map(({ node }) => node));
  preview.replaceChildren(...(round.kind === 'closed' ? round.cards.map((hero, i) => {
    const item = tile('div');
    paintTile(item, 'peek', hero, `Карточка ${i + 1}: ${NAMES[hero]}`);
    return item.node;
  }) : []));
}

function showPairs() {
  const { kind, cards, peeking, first, second, found, finished } = round;
  text(ui.instruction, peeking ? 'Посмотри, где кто.' : COPY[kind].guide);
  text(ui.counter, `${found.length / 2} из ${cards.length / 2} пар`);
  ui['peek-grid'].hidden = !peeking;
  ui.board.hidden = peeking;
  ui.hint.hidden = kind === 'open' || finished;
  ui.hint.setAttribute('aria-expanded', `${peeking}`);
  text(ui.hint.querySelector('span'), peeking ? 'Закрыть подсказку' : 'Подсмотреть');
  const suffix = { found: ', пара найдена', picked: ', выбрана', retry: ', не пара', face: '' };
  for (const [i, card] of buttons.entries()) {
    const look = cardState(round, i);
    const back = look === 'back';
    const name = back ? `Карточка ${i + 1}, закрыта` : `Карточка ${i + 1}: ${NAMES[cards[i]]}${suffix[look]}`;
    paintTile(card, look, back ? null : cards[i], name, look === 'found');
  }
  const feedback = finished ? 'Все пары найдены!' : peeking ? 'В подсказке пары не отмечаются.'
    : second !== null ? 'Эти разные. Выбери другую карточку.' : first !== null ? 'Где такая же картинка?'
      : found.length ? 'Есть пара!' : '';
  text(ui.feedback, feedback);
}

function makeMissing() {
  sceneKey = '';
  candidates = round.options.map((hero) => {
    const target = tile('button', () => act({ type: 'choose', hero }));
    return { ...target, hero };
  });
  ui.choices.replaceChildren(...candidates.map(({ node }) => node));
}

function showMissing() {
  const { phase, original, remaining, viewing, attempt, finished } = round;
  const studying = phase === 'study';
  const questioning = !studying && !viewing && !finished;
  const pictured = questioning ? remaining : original;
  const key = pictured.join('|');
  if (key !== sceneKey) {
    ui['scene-people'].replaceChildren(...pictured.map((hero) => {
      const frame = element('span', 'scene-hero');
      frame.setAttribute('role', 'img');
      label(frame, NAMES[hero]);
      frame.append(icon(`hero-${hero}`, 'hero', '0 0 120 110'));
      return frame;
    }));
    sceneKey = key;
  }
  text(ui['photo-caption'], finished ? 'Снова вместе' : questioning ? 'Новое фото' : 'Первое фото');
  text(ui.counter, finished ? 'Герой найден' : questioning ? 'Снимок 2 / 2' : 'Снимок 1 / 2');
  text(ui.instruction, finished ? 'Друзья снова вместе на снимке.' : studying ? 'Посмотри, кто на снимке.'
    : viewing ? 'Вспомни всех, кто был на первом фото.' : 'На новом снимке кого-то не хватает.');
  ui['missing-action'].hidden = !studying;
  ui['pick-note'].hidden = !questioning;
  ui.original.hidden = studying || finished;
  ui.original.setAttribute('aria-expanded', `${viewing}`);
  label(ui.original, viewing ? 'Вернуться к выбору' : 'Показать первое фото');
  text(ui.original.querySelector('span'), viewing ? 'К выбору' : 'Первое фото');
  ui.choices.hidden = studying || viewing;
  for (const target of candidates) {
    const selected = attempt === target.hero;
    const look = finished ? (selected ? 'found' : 'quiet') : selected ? 'retry' : 'face';
    paintTile(target, look, target.hero, NAMES[target.hero], finished);
  }
  text(ui.feedback, finished ? 'Ты нашёл пропавшего друга!' : viewing ? 'Посмотрели — теперь можно вернуться к выбору.'
    : attempt ? 'Этот герой не пропал. Попробуй ещё!' : '');
}

function render() {
  if (round.kind === 'missing') showMissing();
  else showPairs();
  ui.feedback.dataset.success = `${round.finished}`;
  const next = STAGES[STAGES.indexOf(round.kind) + 1];
  ui.next.hidden = !next || !album.completed().includes(round.kind);
  if (next) ui.next.setAttribute('href', `#${next}`);
}

function act(action) {
  const previous = round;
  const updated = step(previous, action);
  if (updated === previous) return false;
  round = updated;
  if (round.finished && album.earn(round.kind)) showAlbum();
  render();
  if (action.type === 'remember') candidates[0].node.focus({ preventScroll: true });
  if (round.kind === 'missing' && round.finished) ui.replay.focus({ preventScroll: true });
  return true;
}

function start(kind, focusHeading = false) {
  round = createRound(kind);
  const isPhoto = kind === 'missing';
  ui['pair-area'].hidden = isPhoto;
  ui['photo-area'].hidden = !isPhoto;
  ui.hint.hidden = true;
  text(ui.chapter, `Страница 0${STAGES.indexOf(kind) + 1} / 03`);
  text(ui['game-heading'], COPY[kind].title);
  for (const tab of nav) {
    if (tab.dataset.stage === kind) tab.setAttribute('aria-current', 'step');
    else tab.removeAttribute('aria-current');
  }
  if (isPhoto) makeMissing();
  else makePairs();
  render();
  if (focusHeading) ui['game-heading'].focus();
}

function stageFromHash() {
  const hash = window.location.hash.slice(1);
  return STAGES.includes(hash) ? hash : 'open';
}

ui.hint.addEventListener('click', () => act({ type: 'toggle-peek' }));
ui.original.addEventListener('click', () => act({ type: 'toggle-original' }));
ui['missing-action'].addEventListener('click', () => act({ type: 'remember' }));
ui.replay.addEventListener('click', () => start(round.kind));
window.addEventListener('hashchange', () => {
  const stage = stageFromHash();
  if (stage !== round.kind) start(stage, true);
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (act({ type: 'dismiss' })) {
    event.preventDefault();
    (round.kind === 'missing' ? ui.original : ui.hint).focus({ preventScroll: true });
  }
});

showAlbum();
start(stageFromHash());
