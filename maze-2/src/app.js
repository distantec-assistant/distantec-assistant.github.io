(() => {
  'use strict';
  const M = TrailMail, A = MailArt;
  const $ = id => document.getElementById(id);
  const view = $('view'), home = $('home');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const chapters = [
    ['Первые письма','mail','Первый конверт'], ['Дальняя почта','parcel','Дорожная посылка'],
    ['Особые поручения','stamp','Звёздная марка'], ['Большое путешествие','light','Путевой фонарь']
  ];
  const escape = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const icon = name => A.icon(name);
  const glyph = (paths, cls='icon') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths}</svg>`;
  const pencil = () => glyph('<path d="m4 16-1 5 5-1L21 7l-4-4Zm10-10 4 4M4 16l4 4"/>');
  const clue = () => glyph('<path d="M8.7 15.4a6 6 0 1 1 6.6 0l-1 2.6H9.8Zm1.3 6h4M12 1v1M2.5 8l1 .4M21.5 8l-1 .4"/>');
  const arrow = angle => `<span class="dir" style="--angle:${angle}rad">${icon('arrow')}</span>`;
  const rabbit = () => `<svg class="rabbit" viewBox="0 0 74 74" aria-hidden="true" focusable="false">${A.hare()}</svg>`;
  const stampArt = (object,cls='') => `<span class="postage ${cls}" aria-hidden="true">${A.object(object)}</span>`;
  const control = (id,text,image,cls='',enabled=true) => `<button type="button" id="${id}" data-act="${id}" class="control ${cls}"${enabled?'':' disabled'}>${image}<span>${text}</span></button>`;
  const idx = m => M.MAPS.indexOf(m)+1;
  const chapterMaps = n => M.MAPS.filter(m => m.chapter === n);
  let storeOK = true;
  function storageError() { storeOK = false; $('store-note').hidden = false; }
  function stored() {
    try { return M.readSave(localStorage.getItem(M.KEY)); }
    catch { storageError(); return M.readSave(null); }
  }
  let saved = stored();
  const done = m => saved.done[m.id] === true;
  const firstOpen = () => M.MAPS.find(m => !done(m));
  const chapterCount = n => chapterMaps(n).filter(done).length;
  const total = () => M.MAPS.filter(done).length;
  function award(id) {
    // Another tab may have delivered a different letter since this one opened.
    const fresh = storeOK ? stored() : M.readSave(null);
    saved = M.complete({v:1,done:{...fresh.done,...saved.done}},id);
    if (storeOK && Object.keys(saved.done).some(key => !fresh.done[key])) {
      try { localStorage.setItem(M.KEY,JSON.stringify(saved)); } catch { storageError(); }
    }
  }
  let chapter = firstOpen()?.chapter || 1, map = null, state = null;
  let planning = false, busy = false, stops = [], hinted = null, epoch = 0;
  const chapterSeal = n => chapters[n-1][2];
  function album() {
    const next = firstOpen(), count = total();
    const tabs = chapters.map(([name,obj],i) => {
      const n=i+1, marks=chapterCount(n), max=chapterMaps(n).length, earned=marks===max;
      return `<button type="button" class="chapter ch${n}${earned?' earned':''}" data-chapter="${n}" aria-pressed="${chapter===n}" aria-label="Глава ${n}. ${name}. ${marks} из ${max}.${earned?' Знак: '+chapterSeal(n):''}">
        ${stampArt(obj)}<span class="chapter-meta"><b>Глава ${n}</b><span class="tab-name">${name}</span><small>${earned?'✓ ':''}${marks} / ${max}</small></span></button>`;
    }).join('');
    const cards = chapterMaps(chapter).map(m => `<button type="button" class="mission${done(m)?' done':''}" data-story="${escape(m.id)}">
        <span class="mission-stamp">${A.object(m.recipient)}<b>${idx(m)}</b></span>
        <span class="mission-text"><strong>${escape(m.title)}</strong><small>${escape(m.land)}</small></span>
        <span class="mission-end" aria-hidden="true">${icon(done(m)?'check':'arrow')}</span>${done(m)?'<span class="visually-hidden">Доставлено</span>':''}</button>`).join('');
    const max=chapterMaps(chapter).length, hasSeal=chapterCount(chapter)===max;
    return `<section class="album ch${chapter}" aria-labelledby="screen-title">
      <div class="album-head"><div><p class="kicker">ПОЧТОВАЯ КОЛЛЕКЦИЯ</p><h2 id="screen-title" tabindex="-1">Атлас почтальона</h2></div>
        <div class="count-seal" aria-label="Доставлено: ${count} из ${M.MAPS.length}">${icon('check')}<strong id="album-count">${count} / ${M.MAPS.length}</strong></div></div>
      <div class="atlas-bar">${next?control('continue',`${count?'Продолжить':'В путь'} · № ${idx(next)}`,icon('start'),'primary'):'<div class="grand-prize">✦ Вся почта доставлена!</div>'}
        <div class="postmark" aria-hidden="true"><i></i><i></i><i></i></div>${rabbit()}</div>
      <nav class="chapters" aria-label="Главы атласа">${tabs}</nav>
      <div class="chapter-page"><div class="chapter-head"><div><p class="kicker">ГЛАВА ${chapter}</p><h3>${chapters[chapter-1][0]}</h3></div>
        <div class="seal-note${hasSeal?' earned':''}">${hasSeal?`${icon('check')} ${chapterSeal(chapter)}`:`<span class="dot-stamps" aria-hidden="true">${chapterMaps(chapter).map(m=>`<i class="${done(m)?'inked':''}"></i>`).join('')}</span>`}</div></div>
        <div class="missions" aria-label="Письма главы">${cards}</div></div></section>`;
  }
  function trailD(points) {
    const xy=p=>p.join(' '), near=(a,b)=>[a[0]+.24*(b[0]-a[0]),a[1]+.24*(b[1]-a[1])];
    let d='M'+xy(points[0]);
    for(let i=1;i<points.length-1;i++) d+=' L'+xy(near(points[i],points[i-1]))+' Q'+xy(points[i])+' '+xy(near(points[i],points[i+1]));
    return d+' L'+xy(points[points.length-1]);
  }
  const way = (from,to) => M.edge(map,from,to);
  const routeD = (from,to) => trailD(M.points(map,way(from,to),from));
  const currentGoal = () => map.objectives[state.collected] || {at:map.goal,icon:map.recipient,label:map.places[map.goal].name};
  const angle = (from,to) => {
    const a=map.places[from].at,b=map.places[to].at;
    return Math.atan2(b[1]-a[1],b[0]-a[0]);
  };
  function makeWays(project) {
    const roads=map.trails.map((edge,i)=>{
      const d=trailD(M.points(map,edge)), bridge=map.id==='stream'&&edge.slice(0,2).includes('bridge')&&edge.slice(0,2).includes('fork');
      return `<g class="${bridge?'bridge-road':'road'}"><path class="road-bank" d="${d}"/><path class="road-core" id="road-${i}" d="${d}"/>${bridge?`<path class="bridge-planks" d="${d}"/>`:''}</g>`;
    }).join('');
    const spots=Object.entries(map.places).map(([id,p])=>`<circle cx="${p.at[0]}" cy="${p.at[1]}" r="${id===map.goal?14:8}" class="spot"/>`).join('');
    const goal=map.places[currentGoal().at].at;
    const ring=`<circle cx="${goal[0]}" cy="${goal[1]}" r="17" class="goal-ring"/>`;
    const marks=planning?project.moves.map(({from,to})=>`<path class="preview-route" d="${routeD(from,to)}"/>`).join(''):'';
    const dots=planning?project.moves.map(({to},i)=>{
      const [x,y]=map.places[to].at;
      return `<g class="planned-dot" transform="translate(${x} ${y})"><circle r="16"/><text text-anchor="middle" y="6">${i+1}</text>${i===stops.length-1?'<g transform="translate(8 -22) rotate(-7)"><path d="m0 14 2-7 10-10 5 5L7 12Z" fill="#ffdc89" stroke="#6e437d" stroke-width="2"/></g>':''}</g>`;
    }).join(''):'';
    const [x,y]=map.places[state.at].at;
    return `<svg id="map-svg" viewBox="0 0 600 370" aria-hidden="true" focusable="false">${A.terrain[map.theme]()}${roads}${spots}${ring}${hinted?`<path class="hint-route" d="${routeD(state.at,hinted)}"/>`:''}${A.decorate(map,state.collected)}${marks}<g id="courier" transform="translate(${x} ${y})"><g transform="translate(-34 -60) scale(.95)">${A.hare()}</g></g>${dots}</svg>`;
  }
  function goals() {
    const entries=[...map.objectives,{at:map.goal,icon:map.recipient,label:map.places[map.goal].name}];
    return `<div class="itinerary" role="group" aria-label="Порядок доставки"><span class="cargo" title="Груз зайчика">${A.object(map.cargo)}</span>${entries.map((o,i)=>{
      const checked=i<state.collected||state.won, active=i===state.collected&&!state.won;
      return `<span class="sequence-arrow" aria-hidden="true">›</span><span class="goal-chip ${checked?'checked':active?'active':'later'}" data-goal-index="${i}" aria-label="${i+1}. ${escape(o.label)}${checked?', готово':active?', сейчас':', потом'}" role="img" title="${escape(o.label)}">${A.object(o.icon)}<b>${checked?'✓':i+1}</b></span>`;
    }).join('')}</div>`;
  }
  function guide(project) {
    if (M.ready(project)) return null;
    return planning ? M.nextHop(map,project.state) : hinted;
  }
  function steps(project) {
    const recommended=guide(project), short=stops.length===1&&project.state.won;
    return `<div class="plan-strip" aria-label="Намеченный путь">${pencil()}${(short?[0]:[0,1]).map(i=>{
      const move=project.moves[i],active=!move&&stops.length===i;
      const img=move?arrow(angle(move.from,move.to)):active&&recommended?arrow(angle(project.state.at,recommended)):'<span class="blank">···</span>';
      return `<span class="step-slot${move?' filled':active?' now':''}" aria-label="Шаг ${i+1}: ${move?escape(map.places[move.to].name):'выбери стрелку'}"><b>${i+1}</b>${img}</span>`;
    }).join('<span class="plus" aria-hidden="true">+</span>')}<span class="equals" aria-hidden="true">=</span>${rabbit()}</div>`;
  }
  function notice(project) {
    if(state.won) return 'Доставлено!';
    if(busy) return 'Зайчик идёт…';
    if(planning) return M.ready(project)?'Путь готов!':'Выбери '+(stops.length?'вторую':'первую')+' стрелку';
    if(hinted) return 'Вот тропа: '+map.places[hinted].name;
    if(state.at===map.goal && state.collected<map.objectives.length) return 'Сначала забери: '+currentGoal().label;
    return 'Цель: '+currentGoal().label;
  }
  function panel(project) {
    if(state.won) {
      const chapterWon=chapterCount(chapter)===chapterMaps(chapter).length, all=total()===M.MAPS.length;
      return `<div class="win"><div class="win-art">${stampArt(chapterWon?chapters[chapter-1][1]:map.recipient)}${icon('check')}</div><div><p class="kicker">${all?'АЛЬБОМ СОБРАН':chapterWon?'ЗНАК ГЛАВЫ':'МАРКА В АЛЬБОМЕ'}</p><h3 id="delivered">Доставлено!</h3><p class="win-note" id="notice">${all?`Все ${M.MAPS.length} письма нашли адресатов!`:chapterWon?`Знак «${chapterSeal(chapter)}»`:`В альбоме: ${total()} / ${M.MAPS.length}`}</p></div></div><div class="actions">${control('next-story',idx(map)<M.MAPS.length?'Дальше':'В атлас',icon('arrow'),'primary')}${control('replay','Ещё раз',icon('redo'))}</div>`;
    }
    if(busy) return `<p class="travel" id="notice">${rabbit()} Зайчик идёт…</p>`;
    if(planning) return `<p class="kicker">КАРАНДАШ · ПЛАН</p>${steps(project)}<p class="notice" id="notice">${notice(project)}</p>
      ${control('walk-plan','Пойти',icon('start'),'go',M.ready(project))}<div class="plan-tools">${control('undo-plan','Стереть шаг',icon('undo'),'',stops.length>0)}${control('cancel-plan','Идти по одной',icon('close'))}</div>`;
    return `<div class="walk-top"><p id="notice" class="notice">${escape(notice(project))}</p>${control('hint','Подсказка',clue())}</div>
      ${idx(map)>=3?`<button type="button" class="plan-offer" id="start-plan" data-act="start-plan"><span class="example" aria-hidden="true">${pencil()}<i>→</i><i>↗</i><b>=</b>${rabbit()}</span><strong>План на два шага</strong></button>`:''}
      <details class="brief"><summary>Задание</summary><p>${escape(map.briefing)}</p></details>`;
  }
  function card(project) {
    return `<section class="journey ch${chapter}" aria-labelledby="screen-title"><div class="mission-head"><div><p class="kicker">ГЛАВА ${chapter} · ПИСЬМО ${idx(map)}</p><h2 id="screen-title" tabindex="-1">${escape(map.title)}</h2></div>${goals()}</div>
      <div class="play-grid"><div class="map-column"><div id="board" class="board" aria-label="Карта тропинок" aria-busy="${busy}">${makeWays(project)}<div id="trail-buttons" role="group" aria-label="Стрелки на карте"></div></div><div id="choice-row" role="group" aria-label="Выбери стрелку с карты" hidden></div></div>
      <div class="panel${planning?' planning':''}">${panel(project)}</div></div></section>`;
  }
  function roadElement(from,to) { return $('road-'+map.trails.indexOf(way(from,to))); }
  function pathPoint(from,to,t) {
    const path=roadElement(from,to), forward=way(from,to)[0]===from;
    return path.getPointAtLength((forward?t:1-t)*path.getTotalLength());
  }
  // Try positions on each actual trail, keeping the courier, pencil and other hit boxes clear.
  // Dense junctions get numbered map pins and a real, non-overlapping strip of buttons.
  function positions(where,options,rect,size) {
    const sx=rect.width/600, sy=rect.height/370, half=size/2, gap=3;
    const p=map.places[state.at].at, c=map.places[where].at;
    const avoid=[[p[0]*sx-20*sx,(p[1]-53)*sy,p[0]*sx+20*sx,(p[1]-4)*sy]];
    if(planning&&stops.length) avoid.push([(c[0]-15)*sx,(c[1]-15)*sy,(c[0]+18)*sx,(c[1]+15)*sy]);
    for(const sign of $('map-svg').querySelectorAll('[data-recipient],[data-map-objective]')) {
      const r=sign.getBoundingClientRect();
      avoid.push([r.left-rect.left,r.top-rect.top,r.right-rect.left,r.bottom-rect.top]);
    }
    function fits(x,y) {
      return x>=half+gap&&y>=half+gap&&x+half+gap<=rect.width&&y+half+gap<=rect.height&&!avoid.some(([l,t,r,b])=>x+half>l&&x-half<r&&y+half>t&&y-half<b);
    }
    const candidates=options.map(to=>[.52,.62,.43,.72,.36,.79].map(t=>pathPoint(where,to,t)).map(p=>[p.x*sx,p.y*sy]).filter(([x,y])=>fits(x,y)));
    const result=[];
    function pick(i) {
      if(i===options.length) return true;
      for(const q of candidates[i]) if(!result.some(r=>Math.abs(q[0]-r[0])<size+gap&&Math.abs(q[1]-r[1])<size+gap)) {
        result.push(q); if(pick(i+1)) return true; result.pop();
      }
      return false;
    }
    return pick(0)?result:null;
  }
  function buttons(project) {
    if(busy||state.won||(planning&&M.ready(project))) return;
    const where=planning?project.state.at:state.at, options=M.neighbours(map,where), best=guide(project);
    const board=$('board'), tray=$('trail-buttons'), row=$('choice-row'), rect=board.getBoundingClientRect();
    const layout=positions(where,options,rect,44), prior=document.activeElement?.dataset.to;
    tray.replaceChildren(); row.replaceChildren(); row.hidden=!!layout;
    options.forEach((to,i)=>{
      const name=map.places[to].name, tip=to===best, bearing=angle(where,to), dir=arrow(bearing);
      const b=document.createElement('button'); b.type='button'; b.dataset.to=to; b.dataset.hinted=String(tip);
      b.className='trail '+(layout?'map-trail':'choice')+(tip?' hinted':'');
      b.setAttribute('aria-label',`${planning?'Наметить шаг':'Идти'}: ${name}${tip?' (подсказка)':''}`); b.title=name;
      const badge=tip?'<span class="spark" aria-hidden="true">✦</span>':'';
      if(layout) {
        b.innerHTML=dir+badge; b.style.left=layout[i][0]+'px'; b.style.top=layout[i][1]+'px'; tray.append(b);
      } else {
        const pt=pathPoint(where,to,.59), pin=document.createElement('span');
        pin.className='map-pin'+(tip?' hinted':''); pin.style.left=`${pt.x/6}%`; pin.style.top=`${pt.y/3.7}%`;
        pin.innerHTML=dir+`<b>${i+1}</b>`; pin.setAttribute('aria-hidden','true'); tray.append(pin);
        b.innerHTML=`<span class="way-id">${i+1}</span>${dir}<span class="choice-name">${escape(name)}</span>${badge}`; row.append(b);
      }
      if(prior===to) b.focus({preventScroll:true});
    });
  }
  let observedWidth=0;
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(entries=>{
    if(!map || entries[0].target!==$('board')) return;
    const width=entries[0].contentRect.width;
    if(Math.abs(observedWidth-width)>.1) { observedWidth=width; buttons(M.preview(map,state,stops)); }
  }):null;
  if(!observer) window.addEventListener('resize',()=>{ if(map) buttons(M.preview(map,state,stops)); });
  function render(focus='') {
    observer?.disconnect();
    const project=map?M.preview(map,state,stops):null;
    const values={mode:map?'story':'home',currentChapter:chapter,at:state?.at??'',moving:busy,planning,endpoint:project?.state.at??'',stamped:state?.stamped??false,collected:state?.collected??0,hint:hinted??''};
    for(const [k,v] of Object.entries(values)) if(view.dataset[k]!==String(v)) view.dataset[k]=v;
    home.hidden=!map;
    view.innerHTML=map?card(project):album();
    if(map) { buttons(project); observedWidth=$('board').getBoundingClientRect().width; observer?.observe($('board')); }
    if(focus) {
      const target=focus==='trail'?(view.querySelector('.trail.hinted')||view.querySelector('.trail')):view.querySelector(focus);
      target?.focus({preventScroll:true});
    }
    $('spoken').textContent=map?(state.won?$('notice').textContent+' Доставлено!':notice(project)):chapters[chapter-1][0];
  }
  function open(id) {
    const chosen=M.MAPS.find(m=>m.id===id); if(!chosen) return;
    epoch++; map=chosen; chapter=map.chapter; state=M.start(map); planning=busy=false; stops=[]; hinted=null;
    render('#screen-title'); window.scrollTo(0,0);
  }
  function backHome() {
    const restore=map?.id;
    epoch++; map=state=null; planning=busy=false; stops=[]; hinted=null;
    render(restore?`[data-story="${CSS.escape(restore)}"]`:'#screen-title'); window.scrollTo(0,0);
  }
  function cancelPlan(keyboard) { planning=false; stops=[]; hinted=null; render(keyboard?'#start-plan':''); }
  function animate(from,to,token) {
    if(reduced.matches) return Promise.resolve();
    const path=roadElement(from,to), actor=$('courier'), len=path.getTotalLength(), forward=way(from,to)[0]===from;
    const duration=Math.max(250,Math.min(470,len*2)), start=performance.now();
    return new Promise(resolve=>{
      function frame(now) {
        if(token!==epoch) { resolve(); return; }
        const t=Math.max(0,Math.min(1,(now-start)/duration));
        const p=path.getPointAtLength((forward?t:1-t)*len);
        actor.setAttribute('transform',`translate(${p.x} ${p.y})`);
        if(t===1) resolve(); else requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
  }
  async function walk(route,keyboard) {
    const project=M.preview(map,state,route); if(busy||!project?.moves.length) return;
    const token=++epoch; busy=true; stops=[]; planning=false; hinted=null; render();
    for(const [i,{from,to,state:next}] of project.moves.entries()) {
      await animate(from,to,token); if(token!==epoch) return;
      state=next; if(state.won) award(map.id);
      if(i<project.moves.length-1) {
        render(); await new Promise(resolve=>setTimeout(resolve,reduced.matches?0:100)); if(token!==epoch) return;
      }
    }
    busy=false; render(keyboard?(state.won?'#next-story':'trail'):'');
  }
  view.addEventListener('click',e=>{
    const b=e.target.closest('button'); if(!b||b.disabled) return;
    const keyboard=e.detail===0;
    if(b.dataset.chapter&&!map) { chapter=Number(b.dataset.chapter); render(keyboard?`[data-chapter="${chapter}"]`:''); return; }
    if(b.dataset.story) { open(b.dataset.story); return; }
    if(!map) { if(b.id==='continue'&&firstOpen()) open(firstOpen().id); return; }
    if(busy) return;
    if(b.dataset.to) {
      if(planning) {
        const next=[...stops,b.dataset.to], project=M.preview(map,state,next);
        if(project) { stops=next; render(keyboard?(M.ready(project)?'#walk-plan':'trail'):''); }
      } else void walk([b.dataset.to],keyboard);
      return;
    }
    switch(b.dataset.act) {
      case 'hint': hinted=M.nextHop(map,state); render(keyboard?'trail':''); break;
      case 'start-plan': planning=true; stops=[]; hinted=null; render(keyboard?'trail':''); break;
      case 'cancel-plan': cancelPlan(keyboard); break;
      case 'undo-plan': stops=stops.slice(0,-1); render(keyboard?'trail':''); break;
      case 'walk-plan': if(M.ready(M.preview(map,state,stops))) void walk(stops,keyboard); break;
      case 'replay': open(map.id); break;
      case 'next-story': { const next=M.MAPS[idx(map)]; if(next) open(next.id); else backHome(); break; }
    }
  });
  window.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&map) { e.preventDefault(); if(planning&&!busy) cancelPlan(true); else backHome(); }
  });
  window.addEventListener('storage',e=>{
    if(e.key!==M.KEY) return;
    const fresh=M.readSave(e.newValue); saved={v:1,done:{...saved.done,...fresh.done}};
    if(!map) {
      const el=document.activeElement, focus=el.dataset.story?`[data-story="${CSS.escape(el.dataset.story)}"]`:el.dataset.chapter?`[data-chapter="${el.dataset.chapter}"]`:el.id==='continue'?'#continue':'';
      render(focus);
    }
  });
  $('brand').innerHTML=A.object('mail'); home.innerHTML=icon('home')+'<span>В атлас</span>';
  home.addEventListener('click',backHome); render();
})();
