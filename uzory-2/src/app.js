(() => {
  'use strict';
  const M = PatternKit;
  const A = PartyArt;
  const $ = (id) => document.getElementById(id);
  const view = $('view');
  const sound = $('sound');
  const home = $('back-home');
  const narrator = $('narrator');
  const voiceBank = new Map(Object.entries(JSON.parse($('voices').textContent)));
  let usableStorage = true;
  let saved = M.readSave(read());
  let screen = 'home', nextCorrect = false, lit = false, hint = false;
  let build = M.newBuild(), freeSelected = null;
  let notice = '', tone = '';

  function storageError() {
    usableStorage = false;
    $('store-note').hidden = false;
  }
  function read() {
    try { return localStorage.getItem(M.KEY); } catch { storageError(); return null; }
  }
  function save() {
    if (!usableStorage) return;
    try { localStorage.setItem(M.KEY,JSON.stringify(saved)); } catch { storageError(); }
  }
  function stopVoice() {
    narrator.pause();
    if (narrator.hasAttribute('src')) {
      narrator.removeAttribute('src');
      narrator.load();
    }
    delete narrator.dataset.clip;
  }
  function speak(clip) {
    stopVoice();
    if (!saved.sound || !voiceBank.has(clip)) return;
    narrator.dataset.clip = clip;
    narrator.src = voiceBank.get(clip);
    narrator.play().catch(() => {});
  }
  function soundButton() {
    sound.setAttribute('aria-pressed',String(saved.sound));
    sound.innerHTML = A.icon(saved.sound?'sound':'mute');
    sound.title = saved.sound?'Выключить озвучку':'Включить озвучку';
  }
  function mark(message, kind='') { notice = message; tone = kind; }
  function action(id,text,icon,style='primary') {
    return `<button id="${id}" class="action ${style}" type="button" data-act="${id}" data-focus="${id}">${A.icon(icon)}<span>${text}</span></button>`;
  }
  function poster() {
    const lamps=['sun','blue','red','green','sun'].map(A.lamp).join('');
    return `<section class="hero-card" aria-labelledby="screen-title">
      <div class="hero-text"><span class="kicker">${A.icon('star')} Вечер со светлячком</span>
        <h2 id="screen-title" tabindex="-1">Зажжём огоньки!</h2><p>Продолжи узор, собери гирлянду по образцу, а потом придумай свою.</p>
        <div class="actions">${action('start-lesson','Играть','play')}${action('start-free','Моя гирлянда','star','secondary')}</div>
        ${saved.built?'<p id="done-stamp">✓ Праздник уже зажигался</p>':''}
      </div>
      <div class="hero-art" aria-hidden="true">${A.hills()}<div class="hero-lights">${lamps}</div>${A.hero()}</div>
    </section>`;
  }
  function heading(title, tag, help=false) {
    return `<div class="stage-head"><div><p class="stage-number">${tag}</p><h2 id="screen-title" tabindex="-1">${title}</h2></div>${help?
      `<button type="button" class="icon-button" id="help" data-act="help" data-focus="help" aria-label="Подсказка" title="Подсказка" aria-pressed="${hint}">${A.icon('bulb')}</button>`:''}</div>`;
  }
  const piece = (lamp, reference=false) => `<span class="piece" data-lamp="${lamp??'blank'}"${reference===true?' data-reference="true"':''} role="img" aria-label="${A.label(lamp)}">${A.lamp(lamp)}</span>`;
  function slot(lamp,index,isActive,kind) {
    return `<button type="button" class="slot" data-act="${kind}-slot" data-slot="${index}" data-focus="${kind}-${index}"
      data-lamp="${lamp??'blank'}" aria-pressed="${isActive}" aria-label="Место ${index+1}: ${A.label(lamp)}">${A.lamp(lamp)}</button>`;
  }
  function tray(ids) {
    return `<div id="paint-tray" class="tray" role="group" aria-label="Фонарики">${ids.map(lamp=>
      `<button type="button" class="paint" data-act="paint" data-paint="${lamp}" data-focus="paint-${lamp}" aria-label="${A.label(lamp)}">${A.lamp(lamp)}</button>`).join('')}</div>`;
  }
  function board(id,label,tiles,{light=false,highlight=false,editor=false}={}) {
    return `<section id="${id}" class="board" data-lit="${light}" data-hint="${highlight}" aria-label="${label}">
      ${A.hills()}<span class="board-label">${label}</span><div class="row"${editor?' role="group" aria-label="Места для фонариков"':''}>${tiles}</div></section>`;
  }
  function text() { return `<p id="notice" class="notice" data-tone="${tone}" role="status">${notice}</p>`; }
  function nextPage() {
    const row = nextCorrect ? M.GUIDE_ROW : [...M.GUIDE_ROW.slice(0,-1),null];
    return `<section class="play-card">${heading('Что дальше?','1 / 2 · Продолжи узор',!nextCorrect)}
      ${board('question','Какой фонарик дальше?',row.map(piece).join(''),{light:nextCorrect,highlight:hint})}
      ${text()}<div class="control-bar">${nextCorrect?action('next-step','Дальше','arrow'):tray(['sun','blue'])}</div>
    </section>`;
  }
  function buildPage() {
    const sample = M.BUILD_ROW.map((lamp,i) => piece(lamp,!lit&&i===build.cursor)).join('');
    return `<section class="play-card">${heading('Собери гирлянду','2 / 2 · Собери по образцу',!lit)}
      <div class="boards">${board('sample','Образец',sample,{highlight:hint})}
      ${board('learner','Твоя гирлянда',build.cells.map((lamp,i)=>slot(lamp,i,i===build.cursor,'build')).join(''),{light:lit,editor:true})}</div>
      ${text()}<div class="control-bar">${lit?action('free-after','Моя гирлянда','star'):tray(['red','green'])+action('check','Проверить','check')}</div>
    </section>`;
  }
  function freePage() {
    const block = saved.block;
    const copies = M.repeat(block,3);
    const units = block.length ? Array.from({length:3},(_,i)=>`<div class="unit" aria-label="Повтор ${i+1}">${copies.slice(i*block.length,(i+1)*block.length).map(piece).join('')}</div>`).join('') : '<p class="results-empty">Здесь появятся повторы</p>';
    const edit = [...block,...Array(M.FREE_MAX-block.length).fill(null)].map((lamp,i)=>
      lamp?slot(lamp,i,i===freeSelected,'free'):`<span class="slot ghost-slot" aria-hidden="true">${A.lamp(null)}</span>`).join('');
    return `<section class="play-card">${heading('Моя гирлянда','Свободная игра',true)}
      <div class="boards"><section class="board free-board" aria-label="Кусочек узора"><span class="board-label">Твой кусочек · ${block.length} / ${M.FREE_MAX}</span>
        <div id="unit-edit" class="unit-edit">${edit}</div></section>
        <section id="repeat" class="board free-board" aria-label="Три повтора" data-lit="${!!block.length}">${A.hills()}<span class="board-label">Так он повторяется</span><div class="results-row">${units}</div></section></div>
      ${text()}<div class="control-bar">${tray(M.COLORS)}${block.length?action('free-delete','Убрать','remove','ghost'):''}</div>
    </section>`;
  }
  function render(focus) {
    const previous = document.activeElement?.closest('[data-focus]')?.dataset.focus;
    view.dataset.mode = screen;
    view.innerHTML = screen==='home'?poster():screen==='next'?nextPage():screen==='build'?buildPage():freePage();
    home.hidden = screen === 'home';
    const restore = focus ?? previous;
    if (restore === 'heading') $('screen-title').focus({preventScroll:true});
    else if (restore) [...view.querySelectorAll('[data-focus]')].find(el=>el.dataset.focus===restore)?.focus({preventScroll:true});
  }
  function enter(screenName,message,clip) {
    screen = screenName;
    hint = false;
    mark(message);
    render('heading');
    window.scrollTo(0,0);
    if (clip) speak(clip);
    else stopVoice();
  }
  function enterFree() {
    freeSelected = null;
    enter('free','Нажимай фонарики и смотри, как повторяется твой кусочек.');
  }
  function paint(lamp) {
    if (!M.COLORS.includes(lamp)) return;
    if (screen==='next' && !nextCorrect) {
      if (!M.guideAnswer(lamp)) {
        hint = true;
        mark('Попробуй ещё. Посмотри, как огоньки чередуются.','hint');
        render(); speak('ph_again'); return;
      }
      nextCorrect = true; hint = false;
      if (!saved.guided) { saved.guided = true; save(); }
      mark('Верно! Узор продолжился.','good');
      render('next-step'); speak('ph_done');
    } else if (screen==='build' && !lit) {
      const next = M.putBuild(build,lamp);
      if (next===build) mark('Нажми на фонарик, который хочешь поменять.','hint');
      else {
        build = next;
        mark(build.cursor===null?'Нажми «Проверить» или поменяй любой фонарик.':'Поставь следующий фонарик.');
      }
      render();
    } else if (screen==='free') {
      const block = M.addFree(saved.block,lamp,freeSelected);
      if (block !== saved.block) {
        saved.block = block; freeSelected = null; save();
        mark('Хочешь поменять фонарик? Нажми на него в своём кусочке.');
      } else mark('В кусочке уже четыре фонарика. Можно поменять или убрать любой.','hint');
      render();
    }
  }
  function check() {
    if (screen!=='build' || lit) return;
    const result = M.checkBuild(build);
    if (result.kind==='done') {
      lit = true;
      if (!saved.built) { saved.built=true; save(); }
      build = {...build,cursor:null};
      mark('Огоньки зажглись! Можно их поменять или собрать свой узор.','good');
      render('free-after'); speak('ph_done'); return;
    }
    build = M.selectBuild(build,result.index);
    mark(result.kind==='empty'?'Здесь пока пусто. Поставь фонарик.':'Поменяй отмеченный фонарик — посмотри на образец.','hint');
    render(); speak('ph_again');
  }
  function help() {
    hint = !hint;
    mark(screen==='next'?'Посмотри на пары: один огонёк, потом другой.':screen==='build'?'Смотри на верхний ряд. Внизу нужны такие же фонарики.':'Делай кусочек из одного, двух, трёх или четырёх фонариков.','hint');
    render();
    if (hint && screen !== 'free') speak('ph_hint');
  }
  view.addEventListener('click',event=>{
    const button = event.target.closest('button[data-act]');
    if (!button || button.disabled) return;
    switch(button.dataset.act) {
      case 'start-lesson':
        nextCorrect=false; enter('next','Выбери фонарик, которого не хватает.','ph_what'); break;
      case 'next-step':
        if (screen==='next' && nextCorrect) {
          build=M.newBuild(); lit=false;
          enter('build','Нажимай на фонарики, чтобы поставить их в нижний ряд.','ph_intro');
        }
        break;
      case 'start-free': case 'free-after': enterFree(); break;
      case 'help': help(); break;
      case 'paint': paint(button.dataset.paint); break;
      case 'check': check(); break;
      case 'build-slot':
        lit=false; build=M.selectBuild(build,Number(button.dataset.slot));
        mark('Выбери фонарик для отмеченного места.'); render(); break;
      case 'free-slot':
        freeSelected=Number(button.dataset.slot); mark('Выбери другой фонарик или нажми «Убрать».'); render(); break;
      case 'free-delete':
        saved.block=M.removeFree(saved.block,freeSelected??saved.block.length-1);
        freeSelected=null; save(); mark('Добавь фонарик или выбери тот, который хочешь поменять.'); render(); break;
    }
  });
  home.innerHTML = A.icon('home');
  home.title = 'На главный экран';
  home.addEventListener('click',()=>enter('home',''));
  sound.addEventListener('click',()=>{
    saved.sound=!saved.sound; save(); soundButton();
    if (!saved.sound) stopVoice();
    else if (screen==='next'&&!nextCorrect) speak('ph_what');
    else if (screen==='build'&&!lit) speak('ph_intro');
  });
  soundButton(); render();
})();
