(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const KEY = 'raskraska-v1';
  const WHITE = '#ffffff';
  const ERASE = 'eraser';
  const COLORS = new Map([
    ['red', ['Красный', '#f46668']], ['orange', ['Оранжевый', '#fa9a51']],
    ['yellow', ['Жёлтый', '#ffd35e']], ['green', ['Зелёный', '#75cd79']],
    ['blue', ['Голубой', '#66acef']], ['purple', ['Фиолетовый', '#a180eb']],
    ['pink', ['Розовый', '#ed88ba']], ['brown', ['Коричневый', '#bf8b66']],
  ]);
  const PREVIEWS = ['#eae4ff', '#e0f3d9', '#e0edff', '#ddf4ef'];
  const $ = (id) => document.getElementById(id);
  const {levels, scenes} = JSON.parse($('scenes').textContent);
  const byId = new Map(scenes.map((scene) => [scene.id, scene]));
  const levelsById = new Map(levels.map((level) => [level.id, level]));
  const levelOf = new Map(levels.flatMap((level) => level.sheets.map((id) => [id, level.id])));
  const sheetNumber = new Map(scenes.map((scene, i) => [scene.id, i + 1]));
  const areaOf = new Map(scenes.map((scene) => [scene.id, new Map(scene.areas.map((part) => [part.id, part]))]));
  const history = new Map(scenes.map((scene) => [scene.id, []]));
  const buttons = new Map();
  const levelButtons = new Map();
  const sheets = new Map();
  const paths = new Map();
  const board = $('board');
  const tip = $('tip');
  const undo = $('undo');
  const eraser = $('eraser');
  const progress = $('progress');
  const progressText = progress.querySelector('.progress-text');
  let tool = null;
  let visibleLevel = null;
  let storageAvailable = true;
  const state = load();

  function freshPictures() {
    return Object.fromEntries(scenes.map(({id}) => [id, Object.create(null)]));
  }
  function noStorage() {
    storageAvailable = false;
    $('save-status').textContent = 'Сохранение недоступно, но можно раскрашивать.';
  }
  function load() {
    const clean = {version: 1, scene: scenes[0].id, pictures: freshPictures()};
    let raw;
    try { raw = localStorage.getItem(KEY); } catch { noStorage(); }
    if (!raw || raw.length > 16000) return clean;
    let saved;
    try { saved = JSON.parse(raw); } catch { return clean; }
    if (saved?.version !== 1) return clean;
    if (byId.has(saved.scene)) clean.scene = saved.scene;
    for (const {id, areas} of scenes) {
      const picture = saved.pictures?.[id];
      for (const part of areas) {
        const color = picture?.[part.id];
        if (COLORS.has(color)) clean.pictures[id][part.id] = color;
      }
    }
    return clean;
  }
  function save() {
    if (!storageAvailable) return;
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { noStorage(); }
  }
  function svg(tag, attrs) {
    const el = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
    return el;
  }
  function span(className, text) {
    const el = document.createElement('span');
    el.className = className;
    el.textContent = text;
    return el;
  }
  function mark(path, part, color) {
    const paint = COLORS.get(color);
    path.setAttribute('fill', paint?.[1] ?? WHITE);
    path.setAttribute('aria-label', `${part.label} — ${paint?.[0] ?? 'белый'}`);
  }
  function artwork(scene, interactive) {
    const canvas = svg('svg', {viewBox: '0 0 480 360'});
    if (interactive) {
      canvas.id = 'drawing';
      canvas.classList.add('drawing');
      canvas.setAttribute('role', 'group');
      canvas.setAttribute('aria-labelledby', 'scene-title');
    } else {
      canvas.setAttribute('aria-hidden', 'true');
      canvas.setAttribute('focusable', 'false');
    }
    for (const part of scene.areas) {
      const {id, d, at, color} = part;
      if (interactive) {
        const path = svg('path', {d, class: 'paint-area', role: 'button', tabindex: '0',
          'data-area': id, 'data-x': at[0], 'data-y': at[1]});
        mark(path, part, state.pictures[scene.id][id]);
        paths.set(id, path);
        canvas.append(path);
      } else {
        canvas.append(svg('path', {d, class: 'preview-area', fill: COLORS.get(color)[1]}));
      }
    }
    for (const d of scene.details) canvas.append(svg('path', {d, class: 'art-detail', 'aria-hidden': 'true'}));
    return canvas;
  }
  function renderProgress() {
    const count = Object.keys(state.pictures[state.scene]).length;
    const total = byId.get(state.scene).areas.length;
    const complete = count === total;
    progress.classList.toggle('done', complete);
    const text = complete ? 'Готово!' : `${count} / ${total}`;
    if (progressText.textContent !== text) progressText.textContent = text;
    undo.disabled = !history.get(state.scene).length;
  }
  function select(next) {
    tool = next;
    for (const [color, button] of buttons) button.setAttribute('aria-pressed', String(color === tool));
    eraser.setAttribute('aria-pressed', String(tool === ERASE));
    tip.textContent = tool === null ? 'Выбери краску' : tool === ERASE ? 'Нажми, чтобы стереть' : 'Нажми на рисунок';
  }
  function makeSheet(id) {
    const scene = byId.get(id);
    const number = sheetNumber.get(id);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sheet';
    button.dataset.scene = id;
    const preview = span('sheet-art', '');
    preview.style.setProperty('--preview', PREVIEWS[(number - 1) % PREVIEWS.length]);
    preview.setAttribute('aria-hidden', 'true');
    preview.append(artwork(scene, false), span('sheet-seal', String(number)));
    button.append(preview, span('sheet-name', scene.title), span('sheet-sub', `Деталей: ${scene.areas.length}`));
    button.addEventListener('click', () => showScene(id, true));
    sheets.set(id, button);
    return button;
  }
  function showLevel(id) {
    if (id !== visibleLevel) {
      visibleLevel = id;
      sheets.clear();
      $('sheets').replaceChildren(...levelsById.get(id).sheets.map(makeSheet));
      for (const [level, button] of levelButtons) button.setAttribute('aria-pressed', String(level === id));
    }
    for (const [sheet, button] of sheets) button.setAttribute('aria-pressed', String(sheet === state.scene));
  }
  function showScene(id, changed = false) {
    state.scene = id;
    const scene = byId.get(id);
    paths.clear();
    board.replaceChildren(artwork(scene, true));
    $('scene-title').textContent = scene.title;
    $('sheet-no').textContent = String(sheetNumber.get(id)).padStart(2, '0');
    showLevel(levelOf.get(id));
    renderProgress();
    if (changed) {
      save();
      board.closest('.paper').scrollIntoView({block: 'nearest'});
    }
  }
  function replaceColor(id, value) {
    const picture = state.pictures[state.scene];
    if (value === null) delete picture[id];
    else picture[id] = value;
    mark(paths.get(id), areaOf.get(state.scene).get(id), value);
    renderProgress();
    save();
  }
  function paint(id) {
    if (tool === null || !paths.has(id)) return;
    const previous = state.pictures[state.scene][id] ?? null;
    const value = tool === ERASE ? null : tool;
    if (previous === value) return;
    const stack = history.get(state.scene);
    stack.push({id, previous});
    if (stack.length > 64) stack.shift();
    replaceColor(id, value);
  }

  for (const [id, [name, hex]] of COLORS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'swatch';
    button.dataset.color = id;
    button.style.setProperty('--paint', hex);
    button.setAttribute('aria-label', name);
    button.title = name;
    button.addEventListener('click', () => select(id));
    $('paints').append(button);
    buttons.set(id, button);
  }
  levels.forEach(({id, title}, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'level';
    button.dataset.level = id;
    const number = span('level-number', String(i + 1));
    number.setAttribute('aria-hidden', 'true');
    button.append(number, span('level-name', title));
    button.addEventListener('click', () => showLevel(id));
    $('levels').append(button);
    levelButtons.set(id, button);
  });
  $('album-summary').textContent = `Всего рисунков: ${scenes.length} · от простого к сложному`;
  eraser.addEventListener('click', () => select(ERASE));
  undo.addEventListener('click', () => {
    const last = history.get(state.scene).pop();
    if (last) replaceColor(last.id, last.previous);
  });
  board.addEventListener('click', (event) => {
    const part = event.target.closest('[data-area]');
    if (part) paint(part.dataset.area);
  });
  board.addEventListener('keydown', (event) => {
    const part = event.target.closest('[data-area]');
    if (!part || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    if (!event.repeat) paint(part.dataset.area);
  });
  $('catalog').hidden = !/^https?:$/.test(location.protocol);
  select(null);
  showScene(state.scene);
})();
