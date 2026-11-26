const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/model.cjs');

const pattern = ['sun', 'blue'];
const six = ['sun', 'blue', 'sun', 'blue', 'sun', 'blue'];

test('whole repeats, without disturbing the unit', () => {
  assert.deepEqual(M.repeat(pattern, 3), six);
  assert.deepEqual(pattern, ['sun', 'blue']);
  assert.deepEqual(M.repeat([], 3), []);
});

test('guided row has one gap and exactly one choice completes it', () => {
  assert.deepEqual(M.GUIDE_ROW.slice(0,-1), six.slice(0,-1));
  assert.equal(M.guideAnswer('sun'), false);
  assert.equal(M.guideAnswer('blue'), true);
  assert.equal(M.guideAnswer('toString'), false);
});

test('builder lights nothing automatically and checking an empty row points out the first gap', () => {
  const draft = M.newBuild();
  assert.deepEqual(draft, {cells:Array(6).fill(null),cursor:0});
  assert.deepEqual(M.checkBuild(draft), {kind:'empty',index:0});
  assert.throws(() => {M.BUILD_ROW.push('red');}, TypeError);
});

test('placing advances to the next gap and does not mutate previous states', () => {
  const draft = M.newBuild();
  const first = M.putBuild(draft, 'red');
  assert.deepEqual(first, {cells:['red',null,null,null,null,null],cursor:1});
  assert.equal(draft.cells[0], null);
  assert.equal(M.putBuild(first, 'not-a-lamp'), first);
  assert.equal(M.selectBuild(first, -1), first);
  assert.equal(M.selectBuild(first, 1.5), first);
  assert.deepEqual(M.checkBuild(first), {kind:'empty',index:1});
});

test('a completely filled row can be checked, then corrected in place', () => {
  const correct = ['red','green','red','green','red','green'];
  assert.deepEqual(M.BUILD_ROW, correct);
  const incorrect = [...correct]; incorrect[1] = 'red';
  const draft = incorrect.reduce((state, lamp) => M.putBuild(state, lamp), M.newBuild());
  assert.equal(draft.cursor, null);
  assert.equal(M.putBuild(draft, 'green'), draft, 'choose an occupied slot before replacing');
  const result = M.checkBuild(draft);
  assert.deepEqual(result, {kind:'wrong',index:1});
  const fixed = M.putBuild(M.selectBuild(draft,1),'green');
  assert.deepEqual(M.checkBuild(fixed), {kind:'done',index:null});
  assert.deepEqual(draft.cells, incorrect);
  assert.deepEqual(fixed.cells, correct);
});

test('free block can start empty, build up to four, replace a selected lamp, and delete', () => {
  const block = M.addFree(M.addFree([], 'sun'),'blue');
  assert.deepEqual(M.repeat(block,3), six);
  const replaced = M.addFree(block,'red',0);
  assert.deepEqual(replaced, ['red','blue']);
  assert.deepEqual(block, ['sun','blue']);
  const max = M.addFree(M.addFree(block,'green'),'green');
  assert.equal(M.addFree(max,'red'), max);
  assert.deepEqual(M.removeFree(max,1), ['sun','green','green']);
  assert.deepEqual(M.removeFree(block), ['sun']);
  assert.deepEqual(M.removeFree([]), []);
  assert.equal(M.removeFree(max,4), max);
  assert.equal(M.addFree(max,'red',4), max);
});

test('save reader rejects broken or unsupported data and makes a fresh copy', () => {
  const clean = {v:1, guided:false, built:false, sound:true, block:[]};
  for (const raw of [null, '{}', '{bad json', 'null', '[]','"hello"','{"v":2,"built":true}', ' '.repeat(4097)]) {
    assert.deepEqual(M.readSave(raw), clean);
  }
  const valid = JSON.stringify({v:1, guided:true, built:'yes', sound:false, block:['sun',null,'green','bad','blue'], unknown:42});
  assert.deepEqual(M.readSave(valid), {...clean, guided:true,sound:false,block:['sun','green']});
  const first = M.readSave(valid);
  first.block.pop();
  assert.deepEqual(M.readSave(valid).block, ['sun','green']);
});
