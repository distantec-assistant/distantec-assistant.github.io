import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { clipUrl, instruction, feedbackClip, NEW_CLIPS } from './narration.mjs';

test('all numbers through the editable maximum resolve to a real recorded file', () => {
  for (let n = 1; n <= 40; n++) {
    const path = clipUrl(`c_${n}`);
    assert.ok(existsSync(new URL(path, import.meta.url)), path);
    assert.equal(path.startsWith('../tsifrograd/'), n <= 30);
  }
});
test('unknown identifiers cannot become network or arbitrary asset paths', () => {
  for (const id of ['../secret', 'https://example.com/key', 'c_0', 'c_41', 'c_01', 'toString', null, 31]) {
    assert.throws(() => clipUrl(id), RangeError);
  }
});
test('all new clips have source text, actual bytes and a matching manifest hash', () => {
  const source = JSON.parse(readFileSync(new URL('./tts/clips.json', import.meta.url)));
  const manifest = JSON.parse(readFileSync(new URL('./audio/manifest.json', import.meta.url)));
  assert.equal(manifest.voice, 'julia');
  assert.equal(manifest.apiVersion, 'v3');
  assert.equal(manifest.provider, 'Yandex SpeechKit');
  assert.deepEqual([...NEW_CLIPS].sort(), Object.keys(source.clips).sort());
  for (const id of NEW_CLIPS) {
    const data = readFileSync(new URL(clipUrl(id), import.meta.url));
    assert.ok(data.length > 500);
    assert.equal(createHash('sha256').update(data).digest('hex'), manifest.clips[id].sha256);
    assert.equal(source.clips[id].text, manifest.clips[id].text);
  }
});
test('each instruction consists entirely of recorded phrases and numbers', () => {
  for (const kind of ['orders', 'sharing', 'bridge']) {
    for (let n = 11; n <= 30; n++) {
      const parts = instruction(kind, n);
      assert.ok(parts.length);
      for (const part of parts) assert.ok(existsSync(new URL(clipUrl(typeof part === 'number' ? `c_${part}` : part.clip), import.meta.url)));
    }
  }
  assert.throws(() => instruction('bad', 12), RangeError);
});
test('all wrong-answer paths have a Julia recording', () => {
  for (const [kind, states] of [['orders', ['less', 'more']], ['bridge', ['less', 'more']], ['sharing', ['unequal']]]) {
    for (const state of states) assert.ok(existsSync(new URL(clipUrl(feedbackClip(kind, state)), import.meta.url)));
  }
});
