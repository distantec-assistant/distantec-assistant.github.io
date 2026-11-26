'use strict';

// One native media element owns both the current clip and the optional prompt queue.
function createVoice(media, bank, isClipId, onPlaying, onUnavailable) {
  let job = null;
  const allowed = id => isClipId(id) && Object.hasOwn(bank, id) &&
    typeof bank[id] === 'string' && bank[id].startsWith('data:audio/mpeg;base64,');

  function stop() {
    job = null;
    if (media.hasAttribute('src')) {
      media.pause();
      media.removeAttribute('src');
      media.load();
    }
    onPlaying(false);
  }

  function fail(expected) {
    if (job !== expected) return;
    stop();
    onUnavailable();
  }

  function start(expected) {
    onPlaying(false);
    try {
      media.src = expected.src = bank[expected.ids[expected.index]];
      Promise.resolve(media.play()).catch(() => fail(expected));
    } catch {
      fail(expected);
    }
  }

  const current = () => job && media.currentSrc === job.src;
  media.addEventListener('playing', () => {
    if (current() && !media.paused) onPlaying(true);
  });
  media.addEventListener('ended', () => {
    if (!current() || !media.ended) return;
    if (job.index + 1 < job.ids.length) {
      job = {...job, index: job.index + 1};
      start(job);
    } else stop();
  });
  media.addEventListener('error', () => {
    if (job && media.error && media.getAttribute('src') === job.src) fail(job);
  });

  function play(ids) {
    stop();
    if (!Array.isArray(ids) || !ids.length || ![...ids].every(allowed)) return false;
    job = {ids: ids.slice(), index: 0, src: ''};
    start(job);
    return true;
  }

  return {play, stop};
}
