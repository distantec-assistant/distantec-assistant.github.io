/* ================= Что дальше? (узоры) ================= */
const C=['#e5484d','#3b7ddd','#f5c518','#2fa66a'],CD=['#b8333a','#2a5ea8','#b88f00','#1e7a4c'];
const UNITS={AB:[0,1],AAB:[0,0,1],ABB:[0,1,1],ABC:[0,1,2]};
const STAGES=[
 {scene:'train',kind:'color',units:['AB'],len:5,opts:2,q:'ph_wagon'},
 {scene:'beads',kind:'color',units:['AB'],len:6,opts:3,q:'ph_bead'},
 {scene:'flags',kind:'color',units:['AAB','ABB'],len:6,opts:3,q:'ph_flag'},
 {scene:'train',kind:'color',units:['ABC'],len:6,opts:3,q:'ph_wagon'},
 {scene:'beads',kind:'shape',units:['AB','ABB','ABC'],len:6,opts:3,q:'ph_bead'},
 {scene:'flowers',kind:'size',units:['AB','ABB','AAB'],len:6,opts:2,q:'ph_flower'},
 {scene:'beads',kind:'combo',units:['AB','ABB'],len:6,opts:3,q:'ph_bead'},
 {scene:'train',kind:'color',units:['AB','ABB','ABC'],len:6,opts:3,gap:'mid',q:'ph_middle'},
 {mix:[{scene:'flags',kind:'color',units:['ABC']},{scene:'beads',kind:'shape',units:['AAB']},{scene:'flowers',kind:'size',units:['ABB']},{scene:'beads',kind:'combo',units:['AB']},{scene:'train',kind:'color',units:['ABB'],gap:'mid'}],len:6,opts:4}
];
const PER=5,QS={train:'ph_wagon',beads:'ph_bead',flags:'ph_flag',flowers:'ph_flower'};
/* ---------- save: {done:{stage:1}, pl:{stage:plays}, last:stage} ---------- */
const KEY='uzory-v1';
const okObj=x=>x&&typeof x==='object'&&!Array.isArray(x);
let save={v:1,done:{},pl:{},last:null};
try{const o=JSON.parse(localStorage.getItem(KEY)||'{}');if(okObj(o)){for(const k of ['done','pl'])if(okObj(o[k]))save[k]=o[k];if(Number.isInteger(o.last)&&o.last>=0&&o.last<STAGES.length)save.last=o.last}}catch(e){}
const store=()=>{try{localStorage.setItem(KEY,JSON.stringify(save))}catch(e){}};
const isDone=i=>save.done[i]===1;
const unlocked=i=>i===0||isDone(i-1);
const nextStage=()=>{const i=STAGES.findIndex((_,k)=>!isDone(k));return i<0?null:i};
/* ---------- art: every item is a 100x100 svg ---------- */
function shape(s,cx,cy,r){switch(s){
 case 1:return `<rect x="${cx-r*.86}" y="${cy-r*.86}" width="${r*1.72}" height="${r*1.72}" rx="${r*.24}"/>`;
 case 2:return `<path d="M${cx} ${cy-r*1.05}L${cx+r*1.12} ${cy+r*.85}H${cx-r*1.12}Z" stroke-linejoin="round"/>`;
 case 3:{let d='';for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r*.5:r*1.12;d+=(i?'L':'M')+(cx+Math.cos(a)*rr).toFixed(1)+' '+(cy+r*.1+Math.sin(a)*rr).toFixed(1)}return `<path d="${d}Z" stroke-linejoin="round"/>`}
 case 4:return `<path d="M${cx} ${cy+r*.98}C${cx-r*1.55} ${cy-r*.02} ${cx-r*.9} ${cy-r*1.25} ${cx} ${cy-r*.42}C${cx+r*.9} ${cy-r*1.25} ${cx+r*1.55} ${cy-r*.02} ${cx} ${cy+r*.98}Z" stroke-linejoin="round"/>`;
 default:return `<circle cx="${cx}" cy="${cy}" r="${r}"/>`}}
const fillT=(c,body)=>`<g fill="${C[c]}" stroke="${CD[c]}" stroke-width="3">${body}</g><g fill="url(#tx${c})">${body}</g>`;
const Q=`<text x="50" y="64" text-anchor="middle" font-size="42" font-weight="800" fill="#b9a690" font-family="inherit">?</text>`;
const DASH='fill="#fffaf2" stroke="#c9b8a6" stroke-width="3.5" stroke-dasharray="8 6"';
function itemSVG(scene,it){const g=!it;let b='';
 if(scene==='train'){b=g?`<rect x="5" y="20" width="90" height="58" rx="12" ${DASH}/><circle cx="27" cy="85" r="9" fill="#e3d8cb"/><circle cx="73" cy="85" r="9" fill="#e3d8cb"/>${Q}`
  :`${fillT(it.c,'<rect x="5" y="20" width="90" height="58" rx="12"/>')}<rect x="17" y="30" width="66" height="19" rx="6" fill="#fff" opacity=".9"/><circle cx="27" cy="85" r="10" fill="#574d70"/><circle cx="27" cy="85" r="3.5" fill="#fff"/><circle cx="73" cy="85" r="10" fill="#574d70"/><circle cx="73" cy="85" r="3.5" fill="#fff"/>`}
 else if(scene==='beads'){const s=g?0:(it.s||0);b=g?`<circle cx="50" cy="50" r="34" ${DASH}/>${Q}`:`${fillT(it.c,shape(s,50,50,34))}<ellipse cx="${s===2?44:38}" cy="${s===2?48:36}" rx="8" ry="5" fill="#fff" opacity=".55" transform="rotate(-30 38 36)"/>`}
 else if(scene==='flags'){const p='<path d="M12 9H88L50 93Z" stroke-linejoin="round"/>';b=g?`<path d="M12 9H88L50 93Z" ${DASH} stroke-linejoin="round"/><text x="50" y="52" text-anchor="middle" font-size="34" font-weight="800" fill="#b9a690">?</text>`:`${fillT(it.c,p)}<circle cx="22" cy="9" r="3.5" fill="#8f7a6a"/><circle cx="78" cy="9" r="3.5" fill="#8f7a6a"/>`}
 else{/* flowers: big (z=0) or small (z=1) */const small=!g&&it.z===1,cy=small?64:36,pr=small?9:15,d=small?11:18,stem=`<path d="M50 100V${cy}" stroke="#4f9d4f" stroke-width="${small?4:6}" stroke-linecap="round"/><path d="M50 ${small?88:78}q${small?12:18} -${small?8:12} ${small?17:26} -${small?2:4}q-${small?8:12} ${small?10:16} -${small?17:26} ${small?2:4}" fill="#6cc06c"/>`;
  if(g)b=`<circle cx="50" cy="36" r="32" ${DASH}/><path d="M50 100V70" stroke="#e3d8cb" stroke-width="6" stroke-linecap="round"/><text x="50" y="50" text-anchor="middle" font-size="34" font-weight="800" fill="#b9a690">?</text>`;
  else{let pt='';for(let k=0;k<6;k++){const a=k*Math.PI/3;pt+=`<circle cx="${(50+Math.cos(a)*d).toFixed(1)}" cy="${(cy+Math.sin(a)*d).toFixed(1)}" r="${pr}"/>`}b=stem+fillT(it.c,pt)+`<circle cx="50" cy="${cy}" r="${pr*.85}" fill="${it.c===2?'#f08a3c':'#ffd34d'}" stroke="#fff" stroke-width="2"/>`}}
 return `<svg viewBox="0 0 100 100">${b}</svg>`}
const LOCO=`<svg viewBox="0 0 120 100"><path d="M14 80V44q0-6 6-6h56v42z" fill="#e76f69" stroke="#c4544f" stroke-width="3"/><rect x="70" y="16" width="42" height="64" rx="8" fill="#f7a35c" stroke="#d9823c" stroke-width="3"/><rect x="79" y="26" width="24" height="20" rx="5" fill="#fff" opacity=".9"/><rect x="24" y="20" width="14" height="20" rx="3" fill="#574d70"/><rect x="20" y="16" width="22" height="7" rx="3" fill="#574d70"/><path d="M14 66L2 82H16z" fill="#574d70"/><circle cx="34" cy="86" r="10" fill="#574d70"/><circle cx="34" cy="86" r="3.5" fill="#fff"/><circle cx="62" cy="86" r="10" fill="#574d70"/><circle cx="62" cy="86" r="3.5" fill="#fff"/><circle cx="94" cy="84" r="12" fill="#574d70"/><circle cx="94" cy="84" r="4" fill="#fff"/></svg>`;
/* ---------- puzzles ---------- */
const keyOf=it=>`${it.c}|${it.s??''}|${it.z??''}`;
function cfgOf(si,k){const S=STAGES[si];if(S.mix){const m=S.mix[(k+(save.pl[si]||0))%S.mix.length];return {...m,len:S.len,opts:S.opts,q:m.gap==='mid'?'ph_middle':QS[m.scene]}}return S}
function makePuzzle(si,k){const cfg=cfgOf(si,k),uname=cfg.units[k%cfg.units.length],U=UNITS[uname],nd=Math.max(...U)+1;
 let vals,pool,mk;
 if(cfg.kind==='color'){pool=shuffle([0,1,2,3]);vals=pool.slice(0,nd);mk=v=>({c:v})}
 else if(cfg.kind==='shape'){const c=rnd(4);pool=shuffle([0,1,2,3,4]);vals=pool.slice(0,nd);mk=v=>({c,s:v})}
 else if(cfg.kind==='size'){const c=rnd(4);pool=shuffle([0,1]);vals=pool;mk=v=>({c,z:v})}
 else{const cs=shuffle([0,1,2,3]).slice(0,2),ss=shuffle([0,1,2,3,4]).slice(0,2);vals=[0,1];mk=v=>({c:cs[v],s:ss[v]});pool=null;cfg._x=[{c:cs[0],s:ss[1]},{c:cs[1],s:ss[0]}]}
 const seq=Array.from({length:cfg.len},(_,i)=>mk(vals[U[i%U.length]]));
 const gap=cfg.gap==='mid'?2+rnd(cfg.len-3):cfg.len-1;const right=seq[gap];
 let cands=cfg.kind==='combo'?[...cfg._x,...seq]:[...seq,...pool.map(mk)];
 const seen=new Set([keyOf(right)]),opts=[right];for(const c of cands){if(opts.length>=cfg.opts)break;const kk=keyOf(c);if(!seen.has(kk)){seen.add(kk);opts.push(c)}}
 return {cfg,unit:uname,period:U.length,seq,gap,right,opts:shuffle(opts)}}
function nameClip(cfg,it){if(cfg.kind==='color')return (cfg.scene==='beads'?'cf_':'cm_')+it.c;if(cfg.kind==='shape')return 'sh_'+it.s;if(cfg.kind==='size')return 'sz_'+it.z;return null}
/* ---------- navigation ---------- */
let screen='home',gameRun=0,SI=0,PK=0;
function show(id){screen=id;document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('on',s.id===id));document.body.classList.toggle('playing',id!=='home');if(id!=='station'){clearTimeout(idleT);gameRun++}}
document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{stopVoice();goHome()});
function stageIcon(si){const p=makeIconPuzzle(si);return p.map(x=>`<span>${itemSVG(x.scene,x.it)}</span>`).join('')}
function makeIconPuzzle(si){const S=STAGES[si];const sc=S.mix?'beads':S.scene;
 const I=[[{c:0},{c:1},null],[{c:2},{c:3},null],[{c:1},{c:1},{c:0}],[{c:0},{c:2},{c:1}],[{c:3,s:3},{c:3,s:1},null],[{c:0,z:0},{c:0,z:1},null],[{c:0,s:4},{c:1,s:2},null],[{c:2},null,{c:2}],[{c:1,s:3},{c:0,s:1},null]][si];
 return I.map(it=>({scene:sc,it}))}
function goHome(){show('home');const nx=nextStage();
 $('tiles').innerHTML=STAGES.map((s,i)=>`<button class="tile${isDone(i)?' done':''}${unlocked(i)?'':' locked'}${i===nx?' next':''}" data-i="${i}" aria-label="Этап ${i+1}"><span class="ic">${stageIcon(i)}</span><span class="no">${i+1}</span></button>`).join('');
 placeTiles();
 $('tiles').querySelectorAll('.tile').forEach(b=>b.onclick=()=>{unlockAudio();const i=+b.dataset.i;if(!unlocked(i)){b.classList.remove('no-go');void b.offsetWidth;b.classList.add('no-go');sfx('tick');return}startStage(i)})}
/* tiles snake like a road: 3 per row in portrait, 5 in landscape */
function placeTiles(){const cols=innerWidth>innerHeight?5:3;const ts=[...$('tiles').children];ts.forEach((t,i)=>{const r=Math.floor(i/cols),c=i%cols;t.style.gridRow=r+1;t.style.gridColumn=(r%2?cols-c:c+1)});
 requestAnimationFrame(()=>{const box=$('tiles').getBoundingClientRect();const pts=ts.map(t=>{const b=t.getBoundingClientRect();return [b.left-box.left+b.width/2,b.top-box.top+b.height/2]});
  $('road').setAttribute('viewBox',`0 0 ${box.width} ${box.height}`);$('road').innerHTML=`<path d="M${pts.map(p=>p.map(v=>v.toFixed(1)).join(' ')).join('L')}" fill="none" stroke="#efdcc4" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/><path d="M${pts.map(p=>p.map(v=>v.toFixed(1)).join(' ')).join('L')}" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="2 12" stroke-linecap="round"/>`})}
function hero(){const its=[{c:0},{c:1},{c:0},{c:1},null];$('hero').innerHTML=`<div class="ht"><span class="lo">${LOCO}</span>${its.map(i=>`<span>${itemSVG('train',i)}</span>`).join('')}</div>`}
/* ---------- stage ---------- */
function drawDots(){$('stNo').textContent=SI+1;$('dots').innerHTML=Array.from({length:PER},(_,k)=>`<i class="${k<PK?'ok':''} ${k===PK?'now':''}"></i>`).join('')}
function startStage(i){SI=i;PK=0;save.last=i;store();show('station');preload(['ph_what','ph_wagon','ph_bead','ph_flag','ph_flower','ph_middle','ph_intro','ph_hint','ph_again','ph_done',...DATA.praise.map(p=>'ph_'+p),...[0,1,2,3].flatMap(c=>['cm_'+c,'cf_'+c]),...[0,1,2,3,4].map(s=>'sh_'+s),'sz_0','sz_1']);runPuzzle(true)}
const alive=run=>run===gameRun&&screen==='station';
/* the biggest items that fit: one row of items (+ engine), then the answer buttons */
function sizeStage(n,loco,k){const st=$('stage'),cs=getComputedStyle(st);const W=st.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight)-12,H=st.clientHeight-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom);
 /* tall screens: the pattern wraps into two lines (like reading), so the items stay big */
 const rows=W<H*.8&&n>=5?2:1,per=Math.ceil(n/rows);
 const gr=.1,units=per+(loco?1.2:0)+(per-1+(loco?1:0))*gr;const sg=Math.max(14,Math.min(40,H*.07)),rg=rows>1?Math.max(14,H*.03):0;
 let w=Math.min(W/units,(H*.44-rg*(rows-1))/rows,150);
 let o=Math.min(H-w*rows-rg*(rows-1)-sg-12,(W-(k-1)*16)/k,160);o=Math.max(56,Math.floor(o));
 st.style.setProperty('--w',Math.floor(w)+'px');st.style.setProperty('--g',Math.floor(w*gr)+'px');st.style.setProperty('--o',o+'px');st.style.setProperty('--sg',Math.floor(sg)+'px');st.style.setProperty('--rg',Math.floor(rg)+'px');return {rows,per}}
let curP=null;
async function runPuzzle(first){const run=++gameRun;drawDots();const p=makePuzzle(SI,PK);curP=p;const {cfg}=p;const st=$('stage');
 const loco=cfg.scene==='train';const L=sizeStage(p.seq.length,loco,p.opts.length);
 const itHTML=i=>`<span class="it${i===p.gap?' gap':''}${loco?'':' in'}" data-i="${i}" style="animation-delay:${i*70}ms"><span class="glow"></span>${itemSVG(cfg.scene,i===p.gap?null:p.seq[i])}</span>`;
 const rowsHTML=Array.from({length:L.rows},(_,r)=>`<div class="row${loco?' arrive':''}" style="transition-delay:${r*120}ms">${loco?(r===0?`<span class="lo">${LOCO}</span>`:'<span class="lo sp"></span>'):''}${Array.from({length:Math.min(L.per,p.seq.length-r*L.per)},(_,j)=>itHTML(r*L.per+j)).join('')}${r>0&&p.seq.length-r*L.per<L.per?'<span class="it sp"></span>'.repeat(L.per-(p.seq.length-r*L.per)):''}</div>`).join('');
 st.innerHTML=`<div class="scene sc-${cfg.scene}" id="scene">${rowsHTML}</div><div class="opts" id="opts"></div>`;
 st.dataset.g=`${SI}:${PK}:${run}`;
 if(loco){await wait(40);$('scene').querySelectorAll('.row').forEach(r=>r.classList.remove('arrive'));sfx('step')}
 await wait(REDUCED?50:loco?950:p.seq.length*70+350);if(!alive(run))return;
 $('opts').innerHTML=p.opts.map((o,i)=>`<button class="op in" data-k="${i}" style="animation-delay:${i*80}ms" aria-label="Вариант ${i+1}">${itemSVG(cfg.scene,o)}</button>`).join('');
 const q=cfg.gap==='mid'?'ph_middle':(PK%2&&!first?'ph_what':cfg.q);
 const firstEver=first&&SI===0&&!(save.pl[0]>0);
 setInstr(firstEver?['ph_intro',250,cfg.q]:[q]);
 let busy=false,wrong=0,solved=false;const rk=p.opts.findIndex(o=>keyOf(o)===keyOf(p.right));
 window.__puz={right:rk,n:p.opts.length,busy:()=>busy,solved:()=>solved,si:SI,k:PK,run,unit:p.unit,kind:cfg.kind,scene:cfg.scene,gap:p.gap,len:p.seq.length};
 const items=()=>[...$('scene').querySelectorAll('.it:not(.sp)')];
 const highlight=async(withNames)=>{const its=items();for(let i=0;i<its.length;i++){if(!alive(run))return;const el=its[i];el.classList.remove('hl');void el.offsetWidth;el.classList.add('hl');
   const nc=i!==p.gap&&withNames?nameClip(cfg,p.seq[i]):null;if(nc)await say(nc);else await wait(i===p.gap?500:330);
   if((i+1)%p.period===0)await wait(180)}
  await wait(400);its.forEach(e=>e.classList.remove('hl'))};
 $('opts').querySelectorAll('.op').forEach(b=>b.onclick=async()=>{if(busy||solved||!alive(run))return;busy=true;const k=+b.dataset.k;b.classList.remove('in','no');
  if(k===rk){solved=true;b.classList.add('ok');sfx('pop');await solve(run,p,b);return}
  wrong++;void b.offsetWidth;b.classList.add('no');sfx('tick');
  if(wrong===1){await say('ph_hint');if(!alive(run))return;await highlight(false)}
  else{await highlight(true);if(!alive(run))return;$('opts').querySelector(`.op[data-k="${rk}"]`).classList.add('hint');say('ph_again')}
  if(alive(run))busy=false})}
async function fly(fromEl,toEl,html){const a=fromEl.getBoundingClientRect(),b=toEl.getBoundingClientRect();if(REDUCED||!document.body.animate)return;const f=document.createElement('div');f.className='flyer';f.innerHTML=html;f.style.cssText=`left:${b.left}px;top:${b.top}px;width:${b.width}px;height:${b.height}px`;$('fx').appendChild(f);
 const dx=a.left+a.width/2-(b.left+b.width/2),dy=a.top+a.height/2-(b.top+b.height/2),s=(a.width*.76)/b.width;
 try{await f.animate([{transform:`translate(${dx}px,${dy}px) scale(${s})`},{transform:`translate(${dx*.3}px,${-Math.max(30,b.height*.5)}px) scale(${(1+s)/2})`,offset:.55},{transform:'none'}],{duration:560,easing:'cubic-bezier(.35,.6,.4,1)'}).finished}catch(e){}
 f.remove()}
async function solve(run,p,btn){const {cfg}=p;const gapEl=$('scene').querySelector('.it.gap');const html=itemSVG(cfg.scene,p.right);
 btn.style.visibility='hidden';await fly(btn,gapEl,html);if(!alive(run))return;
 gapEl.classList.remove('gap');gapEl.innerHTML=`<span class="glow"></span>${html}`;gapEl.classList.add('hl');sfx('good');burstAt(gapEl,12);$('opts').classList.add('away');
 await wait(450);if(!alive(run))return;
 /* Julia names the pattern in rhythm, each item bounces with its word */
 const its=[...$('scene').querySelectorAll('.it:not(.sp)')];its.forEach(e=>e.classList.remove('hl'));
 if(nameClip(cfg,p.right)){for(let i=0;i<its.length;i++){its[i].classList.add('say');const ok=await say(nameClip(cfg,p.seq[i]));its[i].classList.remove('say');if(!ok||!alive(run))return;await wait(60)}}
 await say(praise());if(!alive(run))return;
 $('scene').classList.add('go');if(cfg.scene==='train')sfx('step');else sfx('win');
 its.forEach((e,i)=>e.style.animationDelay=(i*80)+'ms');
 await wait(REDUCED?100:cfg.scene==='train'?1250:900+its.length*80);if(!alive(run))return;
 PK++;if(PK<PER){runPuzzle(false)}else finishStage(run)}
function confetti(){const c=$('confetti');c.innerHTML='';if(REDUCED)return;for(let n=0;n<40;n++){const i=document.createElement('i');i.style.cssText=`left:${Math.random()*100}%;background:${pick(['#f7bd43','#e76f69','#7cc9a8','#8fb4ff','#e6a8ff'])};animation-delay:${Math.random()*1.2}s;animation-duration:${2.4+Math.random()*1.6}s`;c.appendChild(i)}}
function finishStage(run){const i=SI;save.done[i]=1;save.pl[i]=(save.pl[i]||0)+1;store();
 $('rewardSticker').innerHTML=`<span class="ic">${stageIcon(i)}</span><i>${i+1}</i>`;
 $('rewardStars').innerHTML=STAGES.map((_,k)=>`<i class="${isDone(k)?'ok':''}"></i>`).join('');
 show('reward');confetti();sfx('win');say(['ph_done',300,praise()]);setTimeout(()=>{if(screen==='reward')burstAt($('rewardSticker'),18)},650);
 $('rewardNext').onclick=()=>{stopVoice();if(i+1<STAGES.length)startStage(i+1);else goHome()};
 $('rewardHome').onclick=()=>{stopVoice();goHome()}}
$('rewardHome').innerHTML=HOME;
let rsT=null;addEventListener('resize',()=>{clearTimeout(rsT);rsT=setTimeout(()=>{if(screen==='home')goHome();else if(screen==='station'&&curP){const L=sizeStage(curP.seq.length,curP.cfg.scene==='train',curP.opts.length);if(L.rows!==$('scene').querySelectorAll('.row').length)runPuzzle(false)}},120)});
hero();goHome();
window.UZ={STAGES,PER,get save(){return save},get state(){return {screen,SI,PK}},startStage,makePuzzle};
