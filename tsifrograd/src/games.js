function stopBubbles(){}
/* ---------- station flow ---------- */
let ST=0,GAMES=[],GI=0,NUM={};
const MINIS=['howmany','missing','neighbors','long'];
const TRANS=[['after',19],['before',20],['after',29],['before',30]];
/* teen stations (11-19) get 3 mini-games after loading, 20-30 get 2, review stations get 3 without loading; the mix rotates on every replay */
function gamesOf(i){const s=SL[i],pl=save.pl[i]||0;
 if(s.r){const o=['howmany','missing','neighbors'];const k=(i+pl)%3;return [...o.slice(k),...o.slice(0,k)]}
 const k=(i+pl)%4;let m=[...MINIS.slice(k),...MINIS.slice(0,k)].slice(0,s.n<20?3:2);
 if([19,20,21,29,30].includes(s.n)&&!m.includes('neighbors'))m[m.length-1]='neighbors';
 return ['load',...m]}
const gDone=(i,g)=>!!(save.gn[i]&&save.gn[i][g]);
const numOf=i=>{const s=SL[i];return s.n||(s.r[0]+rnd(s.r[1]-s.r[0]+1))};
function openStation(i){ST=i;GAMES=gamesOf(i);GI=isDone(i)?0:GAMES.findIndex(g=>!gDone(i,g));if(GI<0)GI=0;show('station');
 const n=SL[i].n;preload(['ph_load','ph_dozen','ph_loaded','ph_howmany','ph_together','ph_missing','ph_missing2','ph_before','ph_after','ph_long','ph_try_again',...DATA.praise.map(p=>'ph_'+p),...Array.from({length:30},(_,k)=>'c_'+(k+1)),...(n?['x_'+n]:[])]);
 runGame()}
function drawDots(){$('dots').innerHTML=`<span id="stLetter">${SL[ST].ch}</span>`+GAMES.map((g,k)=>`<i class="${k<GI||gDone(ST,g)?'ok':''} ${k===GI?'now':''}"></i>`).join('')}
async function runGame(){const run=++gameRun;drawDots();$('stage').innerHTML='';const g=GAMES[GI];$('stage').dataset.g=g+':'+run;const fn={load:gLoad,howmany:gHowMany,missing:gMissing,neighbors:gNeighbors,long:gLong}[g];
 const ok=await fn(run,numOf(ST));if(!ok||run!==gameRun)return;
 save.gn[ST]=save.gn[ST]||{};save.gn[ST][g]=1;store();sfx('win');
 GI++;if(GI<GAMES.length){await wait(600);if(run!==gameRun)return;runGame()}else finishStation()}
const alive=run=>run===gameRun;
const guard=(run,resolve,isDone)=>{const w=setInterval(()=>{if(!alive(run)){clearInterval(w);resolve(false)}else if(isDone())clearInterval(w)},300)};
/* ---------- the train: a wagon holds exactly 10 ---------- */
const WCOL=['#ff9f8a','#ffcf5a','#8fd3b6','#9fc2ff'];
const LOCO=`<svg class="loco" viewBox="0 0 120 96" aria-hidden="true"><g class="chug"><rect x="14" y="10" width="20" height="26" rx="4" fill="#574d70"/><rect x="6" y="34" width="96" height="44" rx="14" fill="#e76f69" stroke="#574d70" stroke-width="4"/><rect x="62" y="12" width="46" height="40" rx="9" fill="#e76f69" stroke="#574d70" stroke-width="4"/><rect x="71" y="19" width="28" height="22" rx="5" fill="#d9f1ff" stroke="#574d70" stroke-width="3"/><circle cx="30" cy="54" r="3.4" fill="#574d70"/><circle cx="46" cy="54" r="3.4" fill="#574d70"/><path d="M32 63 q6 5 12 0" fill="none" stroke="#574d70" stroke-width="3" stroke-linecap="round"/></g><circle class="wheel" cx="30" cy="82" r="12" fill="#574d70"/><circle class="wheel" cx="84" cy="82" r="12" fill="#574d70"/><circle cx="30" cy="82" r="4" fill="#fff"/><circle cx="84" cy="82" r="4" fill="#fff"/></svg>`;
function trainHTML(nw,{label=null,pic}={}){let h=`<div class="tt">`;
 for(let w=0;w<nw;w++){h+=`<div class="wg" data-w="${w}" style="--c:${WCOL[w%4]}">${label?`<b class="wl">${label[w]}</b>`:`<div class="sl">${Array.from({length:10},(_,k)=>`<i data-k="${w*10+k}"></i>`).join('')}</div>`}<span class="wh"></span><span class="wh r"></span></div>`}
 return h+LOCO+`</div><div class="rails"></div>`}
function sizeTrain(nw,max=200){const W=Math.min($('stage').clientWidth-20,900);max=Math.min(max,$('stage').clientHeight*.5);const w=Math.floor(Math.min(max,(W-12)/(nw+.62)-7));$('stage').style.setProperty('--w',w+'px')}
const fillSlot=(k,pic)=>{const s=$('stage').querySelector(`.sl i[data-k="${k}"]`);if(s){s.innerHTML=picSVG(pic);s.classList.add('in')}return s};
const numHTML=n=>{const s=String(n);return s.length>1?`<b class="d1">${s[0]}</b><b class="d2">${s.slice(1)}</b>`:`<b class="d2">${s}</b>`};
/* cargo flies along an arc from the crate into its slot */
function fly(from,to,pic){return new Promise(res=>{const a=from.getBoundingClientRect(),b=to.getBoundingClientRect();
 if(REDUCED){res();return}
 const el=document.createElement('div');el.className='flyer';el.innerHTML=picSVG(pic);const s=Math.max(b.width,28);el.style.width=el.style.height=s+'px';$('fx').appendChild(el);
 const x0=a.left+a.width/2-s/2,y0=a.top+a.height*.35-s/2,x1=b.left+b.width/2-s/2,y1=b.top+b.height/2-s/2,xm=(x0+x1)/2,ym=Math.min(y0,y1)-70;
 const an=el.animate([{transform:`translate(${x0}px,${y0}px) scale(1.5) rotate(0deg)`},{transform:`translate(${xm}px,${ym}px) scale(1.25) rotate(160deg)`,offset:.5},{transform:`translate(${x1}px,${y1}px) scale(1) rotate(360deg)`}],{duration:520,easing:'cubic-bezier(.45,.05,.35,1)'});
 an.onfinish=()=>{el.remove();res()};an.oncancel=()=>{el.remove();res()}})}
/* ---------- game 1: load the wagons ---------- */
async function gLoad(run,N){const pic=SL[ST].pic;const nw=Math.ceil(N/10);
 $('stage').innerHTML=`<div class="goal fade-in"><div class="target">${numHTML(N)}</div><div class="count" id="count"></div></div><button class="crate" id="crate" aria-label="Ящик">${picSVG(pic)}<span class="box"></span></button><div class="trainbox">${trainHTML(nw,{pic})}</div>`;
 sizeTrain(nw);setInstr(['c_'+N,200,'ph_load']);
 return new Promise(resolve=>{let k=0,busy=false,done=false;const crate=$('crate');
  crate.onclick=async()=>{if(busy||done)return;busy=true;crate.classList.remove('tap');void crate.offsetWidth;crate.classList.add('tap');
   const slot=$('stage').querySelector(`.sl i[data-k="${k}"]`);k++;const my=k;
   const v=say('c_'+my);await fly(crate,slot,pic);if(!alive(run))return;fillSlot(my-1,pic);sfx('pop');$('count').innerHTML=numHTML(my);$('count').classList.remove('bump');void $('count').offsetWidth;$('count').classList.add('bump');
   await v;
   if(my%10===0){const wg=$('stage').querySelector(`.wg[data-w="${my/10-1}"]`);wg.classList.add('full');burstAt(wg,14);sfx('good');await say('ph_dozen')}
   if(!alive(run))return;
   if(my>=N){done=true;await wait(250);if(!alive(run))return;crate.classList.add('gone');const t=$('stage').querySelector('.target');t.classList.add('big');burstAt(t,16);sfx('win');
    await say(['ph_loaded',250,'x_'+N]);if(!alive(run))return;await say(praise());resolve(alive(run));return}
   busy=false};
  guard(run,resolve,()=>done)})}
/* ---------- shared: 3 big number answers ---------- */
function options(right,cands){const o=[right];for(const c of shuffle(cands))if(c>=1&&c<=30&&!o.includes(c)&&o.length<3)o.push(c);let d=1;while(o.length<3){for(const c of [right+d,right-d])if(c>=1&&c<=30&&!o.includes(c)&&o.length<3)o.push(c);d++}return shuffle(o)}
function optsHTML(o,right){return `<div class="opts fade-in">${o.map(v=>`<button class="opt" data-v="${v}" data-ok="${v===right?1:0}">${numHTML(v)}</button>`).join('')}</div>`}
function answer(run,right,{onWrong,onRight}={}){return new Promise(resolve=>{let done=false,wrong=0;
 $('stage').querySelectorAll('.opt').forEach(b=>b.onclick=async()=>{if(done)return;const v=+b.dataset.v;
  if(v===right){done=true;b.classList.add('ok');burstAt(b,12);sfx('good');if(onRight)await onRight(v);else await say('c_'+v);resolve(alive(run))}
  else{wrong++;sfx('bad');b.classList.remove('wob');void b.offsetWidth;b.classList.add('wob');if(onWrong)await onWrong(v,wrong);else await say(['c_'+v,250,'ph_try_again']);
   if(wrong>=2){const h=$('stage').querySelector(`.opt[data-v="${right}"]`);if(h)h.classList.add('hint')}}});
 guard(run,resolve,()=>done)})}
/* ---------- game 2: how many did the train bring? ---------- */
async function gHowMany(run,N){const pic=SL[ST].pic||pick(CARGO);const nw=Math.ceil(N/10);
 $('stage').innerHTML=`<div class="q fade-in">?</div><div class="trainbox arrive">${trainHTML(nw)}</div><div id="optsSlot" class="opts" style="visibility:hidden"><button class="opt" tabindex="-1">00</button></div>`;
 sizeTrain(nw);for(let k=0;k<N;k++)fillSlot(k,pic);
 const tb=$('stage').querySelector('.trainbox');await wait(60);tb.classList.add('in');sfx('step');await wait(REDUCED?0:1500);if(!alive(run))return false;
 $('optsSlot').outerHTML=optsHTML(options(N,[N+10,N-10,N+1,N-1]),N);setInstr(['ph_howmany']);
 let helped=false;
 const help=async()=>{helped=true;await say('ph_together');const full=Math.floor(N/10);
  for(let w=0;w<full;w++){const wg=$('stage').querySelector(`.wg[data-w="${w}"]`);wg.classList.add('lit');await say('c_'+(w+1)*10);if(!alive(run))return}
  for(let k=full*10;k<N;k++){const s=$('stage').querySelector(`.sl i[data-k="${k}"]`);s.classList.add('lit');await say('c_'+(k+1));if(!alive(run))return}};
 return answer(run,N,{onWrong:async(v)=>{await say(['c_'+v,200,'ph_try_again']);if(!helped&&alive(run))await help()},onRight:async()=>{$('stage').querySelector('.q').innerHTML=numHTML(N);await say(['x_'+N,200,praise()])}})}
/* ---------- game 3: which number is missing? ---------- */
function missingTask(N){const i=ST;const back=i>=6&&Math.random()<.35;const two=(N>=20||(SL[i].r&&SL[i].r[1]>=19))&&Math.random()<.45;
 let a=Math.max(1,Math.min(27,N-1-rnd(2)));let seq=[a,a+1,a+2,a+3];if(back)seq.reverse();
 const gaps=two?pick([[1,2],[1,3]]):[pick([1,2])];return {seq,gaps,back}}
async function gMissing(run,N){const {seq,gaps}=missingTask(N);
 $('stage').innerHTML=`<div class="trainbox seq fade-in">${trainHTML(4,{label:seq.map((v,k)=>gaps.includes(k)?'?':v)})}</div><div id="optsSlot" class="opts" style="visibility:hidden"><button class="opt" tabindex="-1">00</button></div>`;
 sizeTrain(4,170);const W=k=>$('stage').querySelector(`.wg[data-w="${k}"]`);
 const read=async()=>{for(let k=0;k<4;k++){const w=W(k);w.classList.add('lit');if(gaps.includes(k)&&w.querySelector('.wl').textContent==='?'){w.classList.add('ask');await wait(650)}else await say('c_'+w.querySelector('.wl').textContent);w.classList.remove('lit');if(!alive(run))return}};
 await wait(300);await read();if(!alive(run))return false;
 for(let g=0;g<gaps.length;g++){const k=gaps[g],right=seq[k];const others=gaps.filter(x=>x!==k).map(x=>seq[x]);
  const slot=$('optsSlot')||$('stage').querySelector('.opts');slot.outerHTML=`<div id="optsSlot">${optsHTML(options(right,[...others,right+10,right-10,right+2,right-2]),right)}</div>`;
  $('stage').querySelectorAll('.wg').forEach(w=>w.classList.remove('ask'));W(k).classList.add('ask');
  setInstr([g===0&&gaps.length>1?'ph_missing2':'ph_missing'],true);
  const ok=await answer(run,right,{onRight:async v=>{const w=W(k);w.classList.remove('ask');w.querySelector('.wl').textContent=v;w.classList.add('pop');burstAt(w,10);await say('c_'+v)}});if(!ok)return false}
 $('optsSlot').innerHTML='';await read();if(!alive(run))return false;await say(praise());return alive(run)}
/* ---------- game 4: neighbours (emphasis on crossing 20 and 30) ---------- */
function neighborTask(N){const s=SL[ST];let mode,x;
 if(s.r){const tr=TRANS.filter(([m,v])=>v>=s.r[0]&&v<=s.r[1]);if(tr.length&&Math.random()<.6)[mode,x]=pick(tr);else{x=N;mode=pick(['before','after'])}}
 else if(N>=19&&N<=21)[mode,x]=pick(TRANS.slice(0,2));else if(N>=29)[mode,x]=pick(TRANS.slice(2));else{x=N;mode=pick(['before','after'])}
 if(x>=30)mode='before';return {mode,x}}
async function gNeighbors(run,N){const {mode,x}=neighborTask(N);const right=mode==='before'?x-1:x+1;
 const lab=mode==='before'?['?',x,x+1>30?'':x+1]:[x-1,x,'?'];const labels=lab;
 $('stage').innerHTML=`<div class="trainbox seq fade-in">${trainHTML(3,{label:labels})}</div><div id="optsSlot" class="opts" style="visibility:hidden"><button class="opt" tabindex="-1">00</button></div>`;
 sizeTrain(3,190);$('stage').querySelectorAll('.wg').forEach(w=>{const t=w.querySelector('.wl').textContent;if(t==='?')w.classList.add('ask');if(t==='')w.classList.add('ghost');if(t==String(x))w.classList.add('lit')});
 $('optsSlot').outerHTML=optsHTML(options(right,[mode==='before'?x+1:x-1,right+10,right-10,right+2]),right);
 setInstr(['c_'+x,200,mode==='before'?'ph_before':'ph_after']);
 const ok=await answer(run,right,{onRight:async v=>{const w=$('stage').querySelector('.wg.ask');w.classList.remove('ask');w.querySelector('.wl').textContent=v;w.classList.add('pop');burstAt(w,10);
  const seq=mode==='before'?[x-1,x]:[x,x+1];await say(['c_'+seq[0],150,'c_'+seq[1]])}});
 if(!ok)return false;await say(praise());return alive(run)}
/* ---------- game 5: the long train, count every wagon ---------- */
async function gLong(run,N){
 $('stage').innerHTML=`<div class="count big2" id="count"></div><div class="long fade-in">${Array.from({length:Math.ceil(N/10)},(_,r)=>`<div class="lrow">${Array.from({length:Math.min(10,N-r*10)},(_,k)=>`<button class="lw" data-k="${r*10+k}" style="--c:${WCOL[r%4]}" aria-label="Вагон"></button>`).join('')}</div>`).join('')}</div>`;
 const W=Math.min($('stage').clientWidth-24,980);const cols=W>=640?10:5;$('stage').style.setProperty('--cols',cols);$('stage').style.setProperty('--lw',Math.floor(Math.min(cols===5?66:84,(W-40)/(cols*1.12)))+'px');
 setInstr(['ph_long']);
 return new Promise(resolve=>{let k=0,busy=false,done=false;const ws=[...$('stage').querySelectorAll('.lw')];ws[0].classList.add('next');
  $('stage').querySelector('.long').onclick=async()=>{if(busy||done)return;busy=true;const w=ws[k];w.classList.remove('next');w.classList.add('on');k++;const my=k;sfx('step');
   $('count').innerHTML=numHTML(my);$('count').classList.remove('bump');void $('count').offsetWidth;$('count').classList.add('bump');
   await say('c_'+my);if(!alive(run))return;
   if(my%10===0){const row=w.parentElement;row.classList.add('full');burstAt(row,12);sfx('good');await say('ph_dozen')}
   if(my>=N){done=true;burstAt($('count'),16);sfx('win');await say(['x_'+N,250,praise()]);resolve(alive(run));return}
   ws[k].classList.add('next');busy=false};
  guard(run,resolve,()=>done)})}
/* ---------- reward ---------- */
function confetti(){const c=$('confetti');c.innerHTML='';if(REDUCED)return;for(let n=0;n<40;n++){const i=document.createElement('i');i.style.cssText=`left:${Math.random()*100}%;background:${pick(['#f7bd43','#e76f69','#7cc9a8','#8fb4ff','#e6a8ff'])};animation-delay:${Math.random()*1.2}s;animation-duration:${2.4+Math.random()*1.6}s`;c.appendChild(i)}}
async function finishStation(){const i=ST;const first=!isDone(i);save.done[i]=1;save.pl[i]=(save.pl[i]||0)+1;delete save.gn[i];store();
 $('rewardSticker').innerHTML=picSVG(SL[i].pic)+`<i>${SL[i].ch}</i>`;show('reward');confetti();sfx('win');say(['ph_station_done']);setTimeout(()=>{if(screen==='reward')burstAt($('rewardSticker'),18)},650);
 $('rewardNext').onclick=()=>{stopVoice();openMap();if(first&&i+1<SL.length)setTimeout(()=>say('ph_next_station'),400)}}
/* ---------- album ---------- */
function openAlbum(){show('album');const got=SL.filter((_,i)=>isDone(i)).length;$('albumCount').textContent=`Наклеек: ${got} из ${SL.length}`;
 $('albumGrid').innerHTML=SL.map((s,i)=>isDone(i)?`<button class="al got" data-i="${i}">${picSVG(s.pic)}<i>${s.ch}</i></button>`:`<div class="al">${s.ch}</div>`).join('');
 $('albumGrid').querySelectorAll('.al.got').forEach(b=>b.onclick=()=>{const s=SL[+b.dataset.i];if(s.n)say('c_'+s.n)});
 say('ph_album')}
/* shrink the stage content when the screen is too short (phone landscape) */
function fitStage(){const s=$('stage');if(!s)return;const kids=[...s.children];kids.forEach(c=>c.style.zoom='');
 const cs=getComputedStyle(s);const avail=s.clientHeight-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom);
 let need=0;kids.forEach(c=>{const st=getComputedStyle(c);if(st.position==='absolute'||st.position==='fixed')return;need+=c.getBoundingClientRect().height+parseFloat(st.marginTop)+parseFloat(st.marginBottom)});
 need+=parseFloat(cs.rowGap||0)*Math.max(0,kids.length-1);
 if(need>avail&&avail>0){const z=Math.max(.45,avail/need);kids.forEach(c=>c.style.zoom=z)}}
let fitRaf=0;const fitSoon=()=>{cancelAnimationFrame(fitRaf);fitRaf=requestAnimationFrame(fitStage)};
new MutationObserver(fitSoon).observe($('stage'),{childList:true});
addEventListener('resize',fitSoon);
addEventListener('resize',()=>{if(screen==='map')openMap()});
window.BG={SL,gamesOf,get save(){return save},get state(){return {screen,ST,GI,game:GAMES[GI]}}};
