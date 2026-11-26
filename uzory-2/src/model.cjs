const PatternKit = (() => {
  'use strict';
  const COLORS = Object.freeze(['sun','blue','red','green']);
  const FREE_MAX = 4;
  const KEY = 'uzory-2-v1';
  const repeat = (unit, count) => Array.from({length: count}, () => unit).flat();
  const GUIDE_ROW = Object.freeze(repeat(['sun','blue'],3));
  const BUILD_ROW = Object.freeze(repeat(['red','green'],3));
  const valid = (value) => COLORS.includes(value);
  const inside = (i,n) => Number.isInteger(i) && i >= 0 && i < n;
  const guideAnswer = (lamp) => lamp === GUIDE_ROW[GUIDE_ROW.length-1];
  const newBuild = () => ({cells:Array(BUILD_ROW.length).fill(null),cursor:0});

  function selectBuild(draft, index) {
    return inside(index, draft.cells.length) ? {...draft, cursor:index} : draft;
  }
  function putBuild(draft, lamp) {
    if (!inside(draft.cursor, draft.cells.length) || !valid(lamp)) return draft;
    const cells = [...draft.cells];
    cells[draft.cursor] = lamp;
    const gap = cells.indexOf(null);
    return {cells,cursor:gap < 0 ? null : gap};
  }
  function checkBuild(draft) {
    const gap = draft.cells.indexOf(null);
    if (gap >= 0) return {kind:'empty',index:gap};
    const mistake = BUILD_ROW.findIndex((lamp,i) => lamp !== draft.cells[i]);
    return mistake < 0 ? {kind:'done',index:null} : {kind:'wrong',index:mistake};
  }
  function addFree(block, lamp, index=null) {
    if (!valid(lamp)) return block;
    if (index === null) return block.length < FREE_MAX ? [...block, lamp] : block;
    if (!inside(index,block.length)) return block;
    const next = [...block];
    next[index] = lamp;
    return next;
  }
  function removeFree(block, index=block.length-1) {
    return inside(index,block.length) ? block.filter((_,i) => i !== index) : block;
  }
  function readSave(raw) {
    const clean = {v:1,guided:false,built:false,sound:true,block:[]};
    if (typeof raw !== 'string' || raw.length > 4096) return clean;
    let saved;
    try { saved = JSON.parse(raw); } catch { return clean; }
    if (saved?.v !== 1) return clean;
    return {
      v:1, guided:saved.guided === true, built:saved.built === true, sound:saved.sound !== false,
      block:Array.isArray(saved.block) ? saved.block.slice(0,FREE_MAX).filter(valid) : [],
    };
  }
  return Object.freeze({COLORS,FREE_MAX,KEY,GUIDE_ROW,BUILD_ROW,repeat,guideAnswer,
    newBuild,selectBuild,putBuild,checkBuild,addFree,removeFree,readSave});
})();
if (typeof module === 'object' && module.exports) module.exports = PatternKit;
