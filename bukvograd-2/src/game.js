'use strict';

(() => {
  const M = Bukvograd;
  const $ = id => document.getElementById(id);
  const icons = {
    spark: '<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z" fill="currentColor" stroke="none"/>',
    sound: '<path d="M11 4 6 8H3v8h3l5 4V4Zm4 5a4 4 0 0 1 0 6m2-9a8 8 0 0 1 0 12"/>',
    mute: '<path d="M11 4 6 8H3v8h3l5 4V4Zm5 5 5 6m0-6-5 6"/>',
    play: '<path d="m7 4 13 8-13 8z" fill="currentColor" stroke="none"/>',
    swap: '<path d="M4 8h15m-4-4 4 4-4 4M20 16H5m4 4-4-4 4-4"/>',
    right: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
    back: '<path d="M20 12H5m6 6-6-6 6-6"/>',
    eye: '<path d="M2 12s3.7-6 10-6 10 6 10 6-3.7 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.6"/>',
    check: '<path d="m5 12 4.5 4.5L19 7"/>',
    again: '<path d="M4 11a8 8 0 1 1 2 6m-2-6V5m0 6h6"/>',
    up: '<path d="M12 20V5m-5 5 5-5 5 5"/>',
  };
  function icon(el, name) {
    if (el.dataset.ready === name) return;
    el.dataset.ready = name;
    el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${icons[name]}</svg>`;
  }
  document.querySelectorAll('[data-icon]').forEach(el => icon(el, el.dataset.icon));
  const text = (el, value) => { if (el.textContent !== value) el.textContent = value; };
  function art(el, id) {
    if (!M.word(id) || el.dataset.picture === id) return;
    el.replaceChildren($(`art-${id}`).content.cloneNode(true));
    el.dataset.picture = id;
  }

  function read() {
    try { return M.readSave(localStorage.getItem(M.SAVE_KEY)); } catch { return M.readSave(null); }
  }
  const save = read();
  function persist(changedSetting) {
    try {
      const storage = localStorage;
      const merged = M.readSave(storage.getItem(M.SAVE_KEY), save, changedSetting);
      // Adopt saved progress without changing this tab's active sound or picture mode.
      save.listened = merged.listened;
      save.solved = merged.solved;
      storage.setItem(M.SAVE_KEY, JSON.stringify(merged));
    } catch { /* memory only */ }
  }
  let screen = 'home';
  let run = M.startListening();
  let bench = M.startWorkshop('om');
  let audioFailed = false;
  let listenRendered = null;
  let pairRendered = null;
  const bank = JSON.parse($('voice-bank').textContent);
  const voice = createVoice($('voice'), bank, M.isClipId,
    playing => $('shell').toggleAttribute('data-playing', playing),
    () => {
      audioFailed = true;
      if (screen === 'listen') renderListen();
      if (screen === 'bench') renderBenchSound();
    });
  const visualListen = () => save.muted || save.visual || audioFailed;

  function renderSound() {
    $('sound').setAttribute('aria-pressed', String(!save.muted));
    $('sound').title = save.muted ? 'Включить звук' : 'Выключить звук';
    icon($('sound-icon'), save.muted ? 'mute' : 'sound');
    text($('sound-label'), save.muted ? 'Тихо' : 'Звук');
  }

  function renderHome() {
    const stamps = [];
    if (save.listened) stamps.push('Картинки собраны');
    if (save.solved.length) stamps.push(`Хвосты открыты: ${save.solved.map(id => M.PAIRS[id].tail).join(', ')}`);
    $('home-progress').hidden = !stamps.length;
    text($('home-progress'), stamps.join(' · '));
  }

  function show(name) {
    voice.stop();
    screen = name;
    for (const id of ['home', 'listen', 'finish', 'bench']) $(`${id}-screen`).hidden = id !== name;
    $('go-home').hidden = name === 'home';
    if (name === 'home') renderHome();
    if (name === 'listen') renderListen();
    if (name === 'bench') renderBench();
    $(`${name}-title`).focus({preventScroll: true});
    window.scrollTo(0, 0);
  }

  for (let i = 0; i < M.LISTEN_COUNT; i++) {
    const dot = document.createElement('span');
    dot.className = 'dot';
    $('listen-dots').append(dot);
  }
  function renderListen() {
    const round = M.listeningRound(run);
    if (!round) return;
    const visual = visualListen();
    $('hear').hidden = visual;
    $('sample').hidden = !visual;
    $('listen-mode').hidden = save.muted;
    if (visual) art($('sample-art'), round.target);
    // While listening, keep even the sample image out of the active DOM.
    else if ($('sample-art').hasChildNodes()) {
      $('sample-art').replaceChildren();
      delete $('sample-art').dataset.picture;
    }
    text($('listen-instruction'), visual ? (audioFailed && !save.muted && !save.visual ?
      'Нет звука? Найди такую же.' : 'Найди такую же.') : 'Послушай и выбери.');
    text($('mode-label'), visual ? 'На слух' : 'По картинке');
    icon($('mode-icon'), visual ? 'sound' : 'eye');

    const found = run.phase === 'found';
    $('listen-dots').setAttribute('aria-label', `Картинка ${run.index + 1} из ${M.LISTEN_COUNT}`);
    [...$('listen-dots').children].forEach((el, i) => {
      el.toggleAttribute('data-done', i < run.index || (i === run.index && found));
      el.toggleAttribute('data-current', i === run.index && !found);
    });

    if (listenRendered !== round) {
      const cards = round.choices.map((id, i) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'picture';
        button.dataset.choice = id;
        button.setAttribute('aria-label', `Картинка ${i + 1}`);
        const image = document.createElement('span');
        image.className = 'art';
        art(image, id);
        const mark = document.createElement('span');
        mark.className = 'pick-mark';
        mark.dataset.icon = 'check';
        icon(mark, 'check');
        button.append(image, mark);
        return button;
      });
      $('listen-choices').replaceChildren(...cards);
      listenRendered = round;
    }
    for (const b of $('listen-choices').children) {
      b.toggleAttribute('data-missed', b.dataset.choice === run.missed);
      b.toggleAttribute('data-found', found && b.dataset.choice === round.target);
      if (found) b.setAttribute('aria-disabled', 'true');
      else b.removeAttribute('aria-disabled');
    }
    $('listen-next').hidden = !found;
    if (found) {
      const w = M.word(round.target).text;
      if ($('listen-feedback').textContent !== `Да! ${w}`) {
        const strong = document.createElement('strong');
        strong.textContent = w;
        $('listen-feedback').replaceChildren('Да! ', strong);
      }
    } else text($('listen-feedback'), run.missed ? 'Попробуй ещё.' : 'Выбери картинку.');
  }

  function hearRound(prompt = false) {
    if (visualListen()) return;
    const clip = M.word(M.listeningRound(run).target).clip;
    voice.play(prompt ? ['ph_listen', clip] : [clip]);
  }
  function startListen() {
    run = M.startListening();
    show('listen');
    hearRound(true);
  }

  function renderBenchSound() {
    $('bench-hear').disabled = save.muted;
    $('bench-hear').title = save.muted ? 'Звук выключен' : audioFailed ? 'Попробовать звук снова' : '';
  }
  function renderBench() {
    const w = M.currentWord(bench);
    const pair = M.PAIRS[bench.pair];
    for (const b of document.querySelectorAll('[data-pair]')) b.setAttribute('aria-pressed', String(b.dataset.pair === bench.pair));
    text($('word-first'), w.letter);
    text($('word-tail'), pair.tail);
    art($('bench-art'), w.id);
    if (pairRendered !== bench.pair) {
      $('letters').replaceChildren(...pair.words.map(id => {
        const letter = M.word(id).letter;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'button letter-key';
        b.dataset.letter = letter;
        b.textContent = letter;
        return b;
      }));
      pairRendered = bench.pair;
    }
    for (const b of $('letters').children) b.setAttribute('aria-pressed', String(b.dataset.letter === w.letter));
    const goal = M.goalWord(bench);
    const free = goal === null;
    $('mission').toggleAttribute('data-free', free);
    $('goal-art').hidden = free;
    $('bench-again').hidden = !free;
    if (goal) art($('goal-art'), goal);
    text($('mission-kicker'), free ? 'Превращения готовы' : `Шаг ${bench.step + 1} из 2`);
    text($('mission-task'), free ? 'Меняй как хочешь!' : bench.step ? 'Верни эту картинку' : 'Сделай такую картинку');
    renderBenchSound();
  }

  function hearBench() {
    if (!save.muted) voice.play([M.currentWord(bench).clip]);
  }
  function startBench() {
    bench = M.startWorkshop('om');
    show('bench');
    hearBench();
  }

  $('start-listen').addEventListener('click', startListen);
  $('finish-again').addEventListener('click', startListen);
  $('start-bench').addEventListener('click', startBench);
  $('finish-bench').addEventListener('click', startBench);
  $('go-home').addEventListener('click', () => show('home'));
  $('hear').addEventListener('click', () => hearRound());
  $('listen-mode').addEventListener('click', () => {
    if (save.muted) return;
    voice.stop();
    save.visual = !visualListen();
    audioFailed = false;
    persist('visual');
    renderListen();
    hearRound();
  });
  $('sound').addEventListener('click', () => {
    voice.stop();
    save.muted = !save.muted;
    if (!save.muted) audioFailed = false;
    persist('muted');
    renderSound();
    if (screen === 'listen') {
      renderListen();
      hearRound();
    }
    if (screen === 'bench') {
      renderBenchSound();
      hearBench();
    }
  });
  $('listen-choices').addEventListener('click', e => {
    const choice = e.target.closest('[data-choice]')?.dataset.choice;
    const next = M.pickPicture(run, choice);
    if (next === run) return;
    run = next;
    if (run.phase === 'found') voice.stop();
    renderListen();
    if (run.phase === 'found') $('listen-next').focus({preventScroll: true});
  });
  $('listen-next').addEventListener('click', () => {
    if (run.phase !== 'found') return;
    voice.stop();
    run = M.advanceListening(run);
    if (run.phase === 'done') {
      save.listened = true;
      persist();
      show('finish');
    } else {
      renderListen();
      $('listen-title').focus({preventScroll: true});
      hearRound();
    }
  });
  document.querySelector('.pairs').addEventListener('click', e => {
    const pair = e.target.closest('[data-pair]')?.dataset.pair;
    if (!pair) return;
    if (pair !== bench.pair) {
      bench = M.startWorkshop(pair);
      renderBench();
    }
    hearBench();
  });
  $('letters').addEventListener('click', e => {
    const letter = e.target.closest('[data-letter]')?.dataset.letter;
    if (!letter) return;
    bench = M.chooseLetter(bench, letter);
    if (bench.step === 2 && !save.solved.includes(bench.pair)) {
      save.solved.push(bench.pair);
      persist();
    }
    renderBench();
    hearBench();
  });
  $('bench-hear').addEventListener('click', () => {
    audioFailed = false;
    renderBenchSound();
    hearBench();
  });
  $('bench-again').addEventListener('click', () => {
    bench = M.startWorkshop(bench.pair);
    renderBench();
    $('letters').firstElementChild.focus({preventScroll: true});
    hearBench();
  });
  window.addEventListener('pagehide', voice.stop);
  document.addEventListener('visibilitychange', () => { if (document.hidden) voice.stop(); });
  art($('cover-dom'), 'dom');
  art($('cover-som'), 'som');
  renderHome();
  renderSound();
})();
