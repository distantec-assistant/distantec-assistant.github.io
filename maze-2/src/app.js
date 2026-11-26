(() => {
  'use strict';
  const M=TrailMail, A=MailArt;
  const $=id=>document.getElementById(id);
  const view=$('view'), home=$('home');
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  let canStore=true, saved=M.readSave(read());
  let map, state, planning=false, busy=false, stops=[], epoch=0, note='';

  function storageError() { canStore=false; $('store-note').hidden=false; }
  function read() { try { return localStorage.getItem(M.KEY); } catch { storageError(); return null; } }
  function save() { if(canStore) try { localStorage.setItem(M.KEY,JSON.stringify(saved)); } catch { storageError(); } }
  function stamp(id) {
    const next=M.complete(saved,id);
    if(next!==saved) { saved=next; save(); }
  }
  const control=(id,title,icon,theme='pale',enabled=true)=>`<button type="button" id="${id}" data-act="${id}" class="control ${theme}"${enabled?'':' disabled'}>${A.icon(icon)}<span>${title}</span></button>`;
  function cover() {
    const markers=M.MAPS.map((m,i)=>{
      const done=saved.done[m.id]===true;
      return `<button type="button" class="mission${done?' done':''}" data-story="${m.id}"><span class="mission-art ${m.id}">${A.object(A.goal[m.id])}<span class="mission-no">${i+1}</span></span>
        <span class="mission-text"><strong>${m.title}</strong><small>${m.land}</small></span><span class="mission-end">${A.icon(done?'check':'arrow')}</span>${done?'<span class="visually-hidden">Доставлено</span>':''}</button>`;
    }).join('');
    return `<section class="cover" aria-labelledby="screen-title">
      <div class="cover-text"><p class="kicker">ТРИ ИСТОРИИ</p><h2 id="screen-title" tabindex="-1">У зайчика<br> новая почта!</h2><p>Выбери историю. Нажимай на стрелки, чтобы пройти по тропинкам.</p></div>
      <svg class="cover-art" viewBox="0 0 340 170" aria-hidden="true" focusable="false"><rect width="340" height="170" fill="#dcebc7"/>
        <path d="M0 112Q93 59 199 102q66 30 141-15v83H0Z" fill="#c0d9a9"/>
        <path d="M-6 155q78-35 151-27T347 82" fill="none" stroke="#fff2c9" stroke-width="23" stroke-linecap="round"/>
        <path d="M21 37q8-15 24-6 12-10 26 5m186-3q9-14 23-9 11-10 24 4" fill="none" stroke="#fff9dc" stroke-width="6" stroke-linecap="round"/>
        <g transform="translate(103 21) scale(1.95)">${A.hare()}</g>
        <g transform="translate(240 70) rotate(-10 37 37)">${A.object('mail')}</g><path d="M58 107q-5-11-11-11m7 11q7-10 12-10" fill="none" stroke="#759f78" stroke-width="3" stroke-linecap="round"/>
        <g fill="#efac88"><circle cx="47" cy="95" r="3.6"/><circle cx="66" cy="95" r="4"/><circle cx="293" cy="139" r="3"/><circle cx="308" cy="144" r="3"/></g>
      </svg>
    </section><section aria-label="Истории" class="missions">${markers}</section>`;
  }
  function trailD(points) {
    const at=p=>p.join(' ');
    const toward=(a,b)=>[a[0]+.24*(b[0]-a[0]),a[1]+.24*(b[1]-a[1])];
    let d='M'+at(points[0]);
    for(let i=1;i<points.length-1;i++) d+=' L'+at(toward(points[i],points[i-1]))+' Q'+at(points[i])+' '+at(toward(points[i],points[i+1]));
    return d+' L'+at(points.at(-1));
  }
  function makeWays(project) {
    const trails=map.trails.map((edge,i)=>{
      const route=trailD(M.points(map,edge));
      const span=map.stamp&&edge.includes('bridge')&&edge.includes('fork');
      return `<g class="${span?'bridge-road':'road'}"><path class="road-bank" d="${route}"/><path class="road-core" id="road-${i}" d="${route}"/>${span?`<path class="bridge-planks" d="${route}"/>`:''}</g>`;
    }).join('');
    const places=Object.entries(map.places).map(([id,p])=>{
      const target=id===map.goal, stamped=id===map.stamp&&!state.stamped;
      return `<circle cx="${p.at[0]}" cy="${p.at[1]}" r="${target?15:stamped?13:8}" class="spot${target?' destination':''}${stamped?' stamp-spot':''}"/>`;
    }).join('');
    const preview=planning?project.moves.map(({from,to},i)=>{
      const e=M.edge(map,from,to), [x,y]=map.places[to].at;
      return `<path class="preview-route" d="${trailD(M.points(map,e,from))}"/>
        <g class="planned-dot" transform="translate(${x} ${y})"><circle r="15"/><text text-anchor="middle" y="6">${i+1}</text></g>`;
    }).join(''):'';
    const [x,y]=map.places[state.at].at;
    return `<svg id="map-svg" viewBox="0 0 600 370" aria-hidden="true" focusable="false">${A.terrain[map.id]()}${trails}${places}
      ${A.decorate(map,state.stamped)}${preview}<g id="courier" transform="translate(${x} ${y})"><g transform="translate(-34 -60) scale(.95)">${A.hare()}</g></g></svg>`;
  }
  function card(project) {
    const n=M.MAPS.indexOf(map);
    const side = state.won ? `<div id="delivered" class="delivered">${A.icon('check')}<strong>Доставлено!</strong></div>
      <div class="actions">${n+1<M.MAPS.length?control('next-story','Следующая история','arrow','primary'):''}${control('replay','Ещё раз','redo')}</div>`:
      busy?'<p class="travel-tag">Зайчик идёт по тропинке…</p>':planning?`
      <div class="plan-steps" aria-label="Будущие шаги">${(stops.length===1&&project.state.won?[0]:[0,1]).map(i=>`<span class="plan-step${stops[i]?' filled':''}"><b>${i+1}</b><span>${stops[i]?map.places[stops[i]].name:'Выбери стрелку'}</span></span>`).join('')}</div>
      <div class="actions plan-actions">${control('undo-plan','Назад','undo','pale',stops.length>0)}${control('cancel-plan','Отменить','close')}${control('walk-plan','Пойти','start','primary',M.ready(project))}</div>`:
      `<div class="actions">${map.id==='coast'?control('start-plan','Составить план','map'):''}${control('replay','Сначала','redo')}</div>`;
    return `<section class="journey ${map.id}" aria-labelledby="screen-title">
      <div class="mission-head"><div><p class="kicker">ИСТОРИЯ ${n+1} · ${map.land}</p><h2 id="screen-title" tabindex="-1">${map.title}</h2></div>
        <div class="badge" aria-label="${map.stamp?(state.stamped?'Марка найдена':'Нужна марка'):'Груз зайчика'}">${A.object(map.cargo)}${map.stamp?`<span class="stamp-badge ${state.stamped?'collected':''}">${A.object('stamp')}${state.stamped?A.icon('check'):''}</span>`:''}</div></div>
      <div class="play-grid"><div id="board" class="board" aria-label="Карта тропинок" aria-busy="${busy}">${makeWays(project)}<div id="trail-buttons" role="group" aria-label="Доступные тропинки"></div></div>
      <div class="panel"><p class="panel-label">${planning?'ПЛАН МАРШРУТА':state.won?'ПОЧТА ДОШЛА':'ПУТЬ ЗАЙЧИКА'}</p>
        <p id="notice" class="notice" role="status">${note}</p>${side}</div></div></section>`;
  }
  function roadElement(from,to) { return $('road-'+map.trails.indexOf(M.edge(map,from,to))); }
  function buttons(project) {
    const where=planning?project.state.at:state.at;
    if(busy||state.won||(planning&&M.ready(project))) return;
    const tray=$('trail-buttons');
    for(const to of M.neighbours(map,where)) {
      const route=M.edge(map,where,to), path=roadElement(where,to), length=path.getTotalLength();
      const forward=route[0]===where, progress=forward ? .56 : .44;
      const p=path.getPointAtLength(length*progress), q=path.getPointAtLength(length*(progress+(forward ? .075 : -.075)));
      const b=document.createElement('button');
      b.type='button'; b.className='trail'; b.dataset.to=to;
      b.style.left=`${p.x/6}%`; b.style.top=`${p.y/3.7}%`;
      b.style.setProperty('--arrow',`${Math.atan2(q.y-p.y,q.x-p.x)}rad`);
      b.setAttribute('aria-label',`По тропе: ${map.places[to].name}`); b.title=map.places[to].name;
      b.innerHTML=A.icon('arrow'); tray.append(b);
    }
  }
  function render(focus) {
    const project=map?M.preview(map,state,stops):null;
    const set=(key,value)=>{ const s=String(value); if(view.dataset[key]!==s) view.dataset[key]=s; };
    set('mode',map?'story':'home'); set('at',state?.at??''); set('moving',busy);
    set('planning',planning); set('endpoint',planning?project.state.at:state?.at??'');
    set('stamped',state?.stamped??false);
    home.hidden=!map;
    view.innerHTML=map?card(project):cover();
    if(map) buttons(project);
    if(focus==='heading') $('screen-title').focus({preventScroll:true});
    else if(focus) {
      const target=$(focus);
      if(target&&!target.disabled) target.focus({preventScroll:true});
      else view.querySelector('.trail')?.focus({preventScroll:true});
    }
  }
  function message() {
    if(state.won) return 'Получатель рад! История отмечена галочкой.';
    if(map.stamp&&!state.stamped) return state.at===map.goal?'Сначала загляни за маркой к кувшинкам.':'Возьми марку у кувшинок, потом неси посылку выдре.';
    if(map.stamp) return 'Марка на месте. Теперь к выдре через мост!';
    if(map.id==='meadow') return 'Где ёжик? Нажми на стрелку на тропинке.';
    return 'Нажимай на стрелки и неси огонёк к маяку.';
  }
  function planMessage() {
    return stops.length===0?'Выбери первую стрелку. Зайчик пока стоит.':M.ready(M.preview(map,state,stops))?
      'Путь видно на карте. Можешь поправить его или нажать «Пойти».':'Теперь выбери стрелку от кружка с цифрой 1.';
  }
  function open(id) {
    const chosen=M.MAPS.find(m=>m.id===id); if(!chosen) return;
    epoch++; map=chosen; state=M.start(map); planning=map.id==='coast'; busy=false; stops=[];
    note=planning?planMessage():message();
    render('heading'); window.scrollTo(0,0);
  }
  function animate(from,to,token) {
    if(reduce.matches) return Promise.resolve();
    const path=roadElement(from,to), actor=$('courier'), length=path.getTotalLength();
    const forward=M.edge(map,from,to)[0]===from;
    const duration=Math.max(260,Math.min(460,length*2.05));
    const began=performance.now();
    return new Promise(resolve=>{
      const frame = now=>{
        if(token!==epoch) { resolve(); return; }
        const t=Math.max(0,Math.min(1,(now-began)/duration));
        const p=path.getPointAtLength((forward?t:1-t)*length);
        actor.setAttribute('transform',`translate(${p.x} ${p.y})`);
        if(t===1) resolve(); else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
  }
  async function walk(route,keyboard) {
    const project=M.preview(map,state,route);
    if(busy||!project?.moves.length) return;
    const id=++epoch;
    busy=true; stops=[]; planning=false; note='Зайчик отправился по тропинке.'; render();
    for (const {from,to,state:next} of project.moves) {
      await animate(from,to,id);
      if(id!==epoch) return;
      state=next;
      if(state.won) stamp(map.id);
      render();
      // Even with reduced motion render the intermediate arrival as a separate turn.
      if(to!==project.moves.at(-1).to) await new Promise(resolve=>setTimeout(resolve,reduce.matches?0:120));
      if(id!==epoch) return;
    }
    busy=false; note=message();
    render(keyboard?(state.won?'heading':'trail'):'');
  }
  view.addEventListener('click',e=>{
    const b=e.target.closest('button'); if(!b||b.disabled) return;
    if(b.dataset.story) { open(b.dataset.story); return; }
    if(busy||!map) return;
    const keyboard=e.detail===0;
    if(b.dataset.to) {
      const to=b.dataset.to;
      if(planning) {
        const next=[...stops,to];
        if(M.preview(map,state,next)) { stops=next; note=planMessage(); render(keyboard?(M.ready(M.preview(map,state,stops))?'walk-plan':'trail'):''); }
      } else void walk([to],keyboard);
      return;
    }
    switch(b.dataset.act) {
      case 'start-plan': planning=true; stops=[]; note=planMessage(); render(keyboard?'trail':''); break;
      case 'cancel-plan': planning=false; stops=[]; note=message(); render(keyboard?'start-plan':''); break;
      case 'undo-plan': stops=stops.slice(0,-1); note=planMessage(); render(keyboard?'trail':''); break;
      case 'walk-plan': if(M.ready(M.preview(map,state,stops))) void walk(stops,keyboard); break;
      case 'replay': open(map.id); break;
      case 'next-story': { const next=M.MAPS[M.MAPS.indexOf(map)+1]; if(next) open(next.id); break; }
    }
  });
  $('brand').innerHTML=A.object('mail');
  home.innerHTML=A.icon('home'); home.title='Выбор истории';
  home.addEventListener('click',()=>{ epoch++; map=state=undefined; busy=planning=false; stops=[]; render('heading'); window.scrollTo(0,0); });
  render();
})();
