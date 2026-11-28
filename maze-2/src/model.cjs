const TrailMail = (() => {
  'use strict';
  const KEY = 'maze-mail-2-v1';
  const MAPS = typeof TrailCampaign!=='undefined' ? TrailCampaign : require('./campaign.cjs');
  const start = map => ({at:map.start,collected:0,stamped:false,won:false});
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
    const collected = state.collected + Number(map.objectives[state.collected]?.at===to);
    return {at:to,collected,stamped,won:to===map.goal && collected===map.objectives.length};
  }
  function nextHop(map,state) {
    if (state.won) return null;
    const target = map.objectives[state.collected]?.at ?? map.goal;
    const queue=[state.at], first=new Map([[state.at,null]]);
    for (const here of queue) for (const to of neighbours(map,here)) {
      if (first.has(to)) continue;
      const hop = first.get(here) ?? to;
      if (to===target) return hop;
      first.set(to,hop); queue.push(to);
    }
    return null;
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
  return Object.freeze({KEY,MAPS,start,edge,points,neighbours,step,preview,ready,nextHop,readSave,complete});
})();
if (typeof module==='object' && module.exports) module.exports=TrailMail;
