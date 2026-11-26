const TrailMail = (() => {
  'use strict';
  const KEY = 'maze-mail-2-v1';
  const place = (name,x,y) => ({name,at:[x,y]});
  function freeze(obj) {
    for (const value of Object.values(obj)) if (value && typeof value==='object') freeze(value);
    return Object.freeze(obj);
  }
  const MAPS = freeze([
    {id:'meadow', title:'Письмо для ежа', land:'Солнечная поляна', cargo:'mail', start:'start', goal:'finish',
      places:{start:place('Почта',61,247), fork:place('Развилка',194,236), grove:place('Роща',294,117),
        nest:place('Птичье гнездо',459,90), hill:place('Холм',361,294), finish:place('Ёжик',526,243)},
      trails:[['start','fork',[126,259]],['fork','grove',[223,164]],['grove','nest',[366,99]],
        ['fork','hill',[266,268]],['hill','finish',[449,294]]]},
    {id:'stream',title:'Посылка у ручья',land:'Кувшинки и мост',cargo:'parcel',start:'start',goal:'finish',stamp:'lilies',
      places:{start:place('Почта',64,291),fork:place('Развилка',201,261),lilies:place('Кувшинки',169,108),
        bridge:place('Мост',369,207), reeds:place('Камыши',445,319),finish:place('Выдра',534,132)},
      trails:[['start','fork',[125,286]],['fork','lilies',[174,178]],['fork','bridge',[273,230]],
        ['bridge','finish',[463,169]],['bridge','reeds',[411,264]]]},
    {id:'coast',title:'Огонёк для маяка',land:'Тропы у моря',cargo:'light',start:'start',goal:'finish',
      places:{start:place('Почта',58,260),birches:place('Берёзки',187,240),arch:place('Каменная арка',304,145),
        bench:place('Скамейка',286,319),windmill:place('Ветряк',466,48),dock:place('Причал',445,249),finish:place('Маяк',530,121)},
      trails:[['start','birches',[122,250]],['birches','arch',[231,181]],['birches','bench',[211,302]],
        ['arch','windmill',[393,87]],['arch','dock',[370,197]],['bench','dock',[370,307]],['dock','finish',[499,203]]]},
  ]);
  const start = map => ({at:map.start,stamped:false,won:false});
  const edge = (map,from,to) => map.trails.find(([a,b])=>(a===from&&b===to)||(b===from&&a===to));
  function neighbours(map,where) {
    return map.trails.flatMap(([a,b])=>a===where?[b]:b===where?[a]:[]);
  }
  function points(map,route,from=route[0]) {
    const [a,b,...bends] = route;
    const forward = [map.places[a].at,...bends,map.places[b].at];
    return from===b ? forward.reverse() : forward;
  }
  function step(map,state,to) {
    if (state.won || !edge(map,state.at,to)) return state;
    const stamped = state.stamped || map.stamp===to;
    return {at:to,stamped,won:to===map.goal&&(!map.stamp||stamped)};
  }
  function preview(map,state,stops) {
    if (!Array.isArray(stops) || stops.length>2) return null;
    const moves=[];
    for (const to of stops) {
      const from=state.at, next=step(map,state,to);
      if (next===state) return null;
      moves.push({from,to,state:next});
      state=next;
    }
    return {state,moves};
  }
  const ready = plan => !!plan && (plan.moves.length===2 || (plan.moves.length===1 && plan.state.won));
  function readSave(raw) {
    const clean={v:1,done:{}};
    if (typeof raw!=='string'||raw.length>2048) return clean;
    try {
      const save=JSON.parse(raw);
      if (save?.v!==1) return clean;
      for (const {id} of MAPS) if (save.done?.[id]===true) clean.done[id]=true;
    } catch { return clean; }
    return clean;
  }
  function complete(save,id) {
    return !MAPS.some(m=>m.id===id)||save.done[id]===true ? save : {...save,done:{...save.done,[id]:true}};
  }
  return Object.freeze({KEY,MAPS,start,edge,points,neighbours,step,preview,ready,readSave,complete});
})();
if (typeof module==='object' && module.exports) module.exports=TrailMail;
