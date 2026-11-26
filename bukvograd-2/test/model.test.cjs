'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const M = require('../src/model.js');

test('каждое целое слово встречается на слух; ошибка не меняет ход', () => {
  let run = M.startListening();
  const heard = new Set();
  while (run.phase !== 'done') {
    const round = M.listeningRound(run);
    assert.equal(new Set(round.choices).size, 3);
    assert.ok(round.choices.includes(round.target));
    heard.add(round.target);
    assert.strictEqual(M.advanceListening(run), run);
    assert.strictEqual(M.pickPicture(run, '__proto__'), run);
    const wrong = round.choices.find(id => id !== round.target);
    const retry = M.pickPicture(run, wrong);
    assert.equal(retry.phase, 'pick');
    assert.equal(retry.missed, wrong);
    assert.strictEqual(M.listeningRound(retry), round);
    run = M.pickPicture(retry, round.target);
    assert.equal(run.phase, 'found');
    assert.strictEqual(M.pickPicture(run, wrong), run);
    run = M.advanceListening(run);
  }
  assert.deepEqual([...heard].sort(), ['dom', 'mak', 'rak', 'som']);
  assert.equal(M.listeningRound(run), null);
  assert.strictEqual(M.advanceListening(run), run);
  assert.equal(M.startListening().index, 0);
});

test('меняется только первая буква: вперёд, обратно, свободная игра и повтор', () => {
  for (const [id, expectedTail, before, after] of [['om', 'ОМ', 'ДОМ', 'СОМ'], ['ak', 'АК', 'МАК', 'РАК']]) {
    let bench = M.startWorkshop(id);
    const pair = M.PAIRS[id];
    assert.equal(pair.tail, expectedTail);
    const first = M.currentWord(bench);
    const next = M.word(M.goalWord(bench));
    assert.equal(first.text, before);
    assert.equal(next.text, after);
    assert.strictEqual(M.chooseLetter(bench, first.letter), bench);
    assert.strictEqual(M.chooseLetter(bench, 'Я'), bench);
    assert.strictEqual(M.chooseLetter(bench, next.letter.toLowerCase()), bench);
    bench = M.chooseLetter(bench, next.letter);
    assert.equal(bench.step, 1);
    assert.equal(M.goalWord(bench), first.id);
    assert.equal(M.currentWord(bench).text, after);
    bench = M.chooseLetter(bench, first.letter);
    assert.equal(bench.step, 2);
    assert.equal(M.goalWord(bench), null);
    assert.equal(M.currentWord(bench).text, before);
    bench = M.chooseLetter(bench, next.letter);
    assert.equal(bench.step, 2);
    assert.equal(M.currentWord(bench).text, after);
    assert.deepEqual(M.startWorkshop(id), {pair: id, word: first.id, step: 0});
    for (const w of [first, next]) {
      assert.equal(w.text, w.letter + pair.tail);
      assert.equal(w.clip, `w_${w.id}`);
    }
  }
  assert.equal(M.startWorkshop('constructor'), null);
  assert.equal(M.word('toString'), null);
});

test('разрешены только точные ID пяти записей из исходной расшифровки', () => {
  const expected = {ph_listen: 'Посл+ушай.', w_dom: 'д+ом', w_som: 'с+ом', w_mak: 'м+ак', w_rak: 'р+ак'};
  const reference = JSON.parse(readFileSync(new URL('../../bukvograd/src/clips.json', `file://${__filename}`), 'utf8'));
  const manifest = JSON.parse(readFileSync(new URL('../src/voice.json', `file://${__filename}`), 'utf8'));
  assert.deepEqual(M.CLIP_IDS.toSorted(), Object.keys(expected).toSorted());
  assert.deepEqual(Object.fromEntries(Object.entries(manifest).map(([id, item]) => [id, item.text])), expected);
  for (const [id, text] of Object.entries(expected)) {
    assert.equal(reference[id], text);
    assert.equal(M.isClipId(id), true);
  }
  for (const invalid of ['w_dom.mp3', 'w_dom ', ' W_DOM', 'w_luk', 'snd_d', '../w_dom', '', '__proto__', 'constructor', null, ['w_dom']]) {
    assert.equal(M.isClipId(invalid), false);
  }
});

test('изолированный ключ и строгие значения сохранения; мусор безопасен', () => {
  assert.equal(M.SAVE_KEY, 'bukvograd-2-v1');
  const fresh = {muted: false, visual: false, listened: false, solved: []};
  assert.deepEqual(M.readSave('{'), fresh);
  assert.deepEqual(M.readSave('null'), fresh);
  assert.deepEqual(M.readSave('[true]'), fresh);
  assert.deepEqual(M.readSave('{"muted":1,"visual":"true","listened":true,"solved":["ak","ak","toString","om"]}'),
    {...fresh, listened: true, solved: ['om', 'ak']});
  assert.deepEqual(M.readSave(JSON.stringify({...fresh, muted: true, visual: true, solved: ['om']})),
    {...fresh, muted: true, visual: true, solved: ['om']});
});

test('выключение звука в старой вкладке не стирает свежие отметки и режим картинки', () => {
  const local = {...M.readSave(null), muted: true};
  const raw = '{"muted":false,"visual":true,"listened":true,"solved":["om"]}';
  assert.deepEqual(M.readSave(raw, local, 'muted'), {muted: true, visual: true, listened: true, solved: ['om']});
  assert.equal(local.visual, false);
});

test('смена режима в старой вкладке не меняет свежую настройку звука', () => {
  const local = M.readSave(null);
  const raw = '{"muted":true,"visual":true,"listened":false,"solved":[]}';
  assert.deepEqual(M.readSave(raw, local, 'visual'), {muted: true, visual: false, listened: false, solved: []});
  assert.equal(local.muted, false);
});

test('отметки двух вкладок объединяются в порядке заданий без повторов и лишних ID', () => {
  const local = {...M.readSave(null), listened: true, solved: ['ak', 'later']};
  const raw = '{"muted":true,"visual":true,"listened":false,"solved":["om","om","toString"]}';
  const merged = M.readSave(raw, local);
  assert.deepEqual(merged, {muted: true, visual: true, listened: true, solved: ['om', 'ak']});
  assert.deepEqual(M.readSave(JSON.stringify(merged), local), merged);
});
