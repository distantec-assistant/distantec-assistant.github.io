'use strict';

// The same rules run in the standalone file and in the Node tests.
const Bukvograd = (() => {
  const SAVE_KEY = 'bukvograd-2-v1';
  const own = (obj, key) => typeof key === 'string' && Object.hasOwn(obj, key);
  const words = Object.freeze(Object.fromEntries([
    ['dom', 'ДОМ'], ['som', 'СОМ'], ['mak', 'МАК'], ['rak', 'РАК'],
  ].map(([id, text]) => [id, Object.freeze({id, text, letter: text[0], clip: `w_${id}`})])));
  const PAIRS = Object.freeze({
    om: Object.freeze({tail: 'ОМ', words: Object.freeze(['dom', 'som'])}),
    ak: Object.freeze({tail: 'АК', words: Object.freeze(['mak', 'rak'])}),
  });
  const LISTEN = [
    ['dom', 'mak', 'dom', 'som'], ['som', 'som', 'rak', 'dom'],
    ['mak', 'dom', 'rak', 'mak'], ['rak', 'mak', 'rak', 'som'],
  ].map(([target, ...choices]) => Object.freeze({target, choices: Object.freeze(choices)}));
  const CLIP_IDS = Object.freeze(['ph_listen', ...Object.values(words).map(w => w.clip)]);
  const isClipId = id => CLIP_IDS.includes(id);
  const word = id => own(words, id) ? words[id] : null;

  const startListening = () => ({index: 0, phase: 'pick', missed: null});
  const listeningRound = run => LISTEN[run.index] || null;
  function pickPicture(run, id) {
    const round = listeningRound(run);
    if (run.phase !== 'pick' || !round || !round.choices.includes(id)) return run;
    return id === round.target ? {...run, phase: 'found', missed: null} : {...run, missed: id};
  }
  function advanceListening(run) {
    if (run.phase !== 'found') return run;
    const index = run.index + 1;
    return {index, phase: index < LISTEN.length ? 'pick' : 'done', missed: null};
  }

  const startWorkshop = pair => own(PAIRS, pair) ? {pair, word: PAIRS[pair].words[0], step: 0} : null;
  const currentWord = bench => word(bench.word);
  const goalWord = bench => bench.step < 2 ? PAIRS[bench.pair].words[1 - bench.step] : null;
  function chooseLetter(bench, letter) {
    const id = PAIRS[bench.pair].words.find(id => word(id).letter === letter);
    if (!id || id === bench.word) return bench;
    return {...bench, word: id, step: bench.step + Number(id === goalWord(bench))};
  }

  function readSave(raw, local = {}, changedSetting) {
    let value;
    try { value = JSON.parse(raw); } catch { /* start fresh */ }
    const savedSolved = Array.isArray(value?.solved) ? value.solved : [];
    const localSolved = Array.isArray(local.solved) ? local.solved : [];
    return {
      muted: (changedSetting === 'muted' ? local.muted : value?.muted) === true,
      visual: (changedSetting === 'visual' ? local.visual : value?.visual) === true,
      listened: value?.listened === true || local.listened === true,
      solved: Object.keys(PAIRS).filter(id => savedSolved.includes(id) || localSolved.includes(id)),
    };
  }

  return Object.freeze({SAVE_KEY, PAIRS, LISTEN_COUNT: LISTEN.length, CLIP_IDS, isClipId, word,
    startListening, listeningRound, pickPicture, advanceListening,
    startWorkshop, currentWord, goalWord, chooseLetter, readSave});
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Bukvograd;
