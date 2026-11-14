/* ================= Найди пару ================= */
const THEMES=[...DATA.themes.map(t=>({...t,kind:'pics',levels:DATA.levels.length})),{id:'bukvy',title:'Буква и картинка',kind:'letters',levels:DATA.letterLevels.length}];
const LETTERS=Object.fromEntries(DATA.letters.map(l=>[l.id,l]));
const BACKS={zveri:'#f7a35c',eda:'#e76f69',transport:'#5b8def',veschi:'#b48ae6',priroda:'#7cc9a8',bukvy:'#f7bd43'};
/* ---------- save: {done:{theme:{level:1}}, next:{theme:level}, last:theme, pl:{theme:plays}} ---------- */
const KEY='pary-v1';
const okObj=x=>x&&typeof x==='object'&&!Array.isArray(x);
let save={v:1,done:{},next:{},last:null,pl:{}};
try{const o=JSON.parse(localStorage.getItem(KEY)||'{}');if(okObj(o)){for(const k of ['done','next','pl'])if(okObj(o[k]))save[k]=o[k];if(THEMES.some(t=>t.id===o.last))save.last=o.last}}catch(e){}
for(const t of THEMES){if(!okObj(save.done[t.id]))save.done[t.id]={};const n=+save.next[t.id];save.next[t.id]=Number.isInteger(n)&&n>=0&&n<t.levels?n:0}
const store=()=>{try{localStorage.setItem(KEY,JSON.stringify(save))}catch(e){}};
const lvDone=(t,l)=>!!save.done[t][l];
/* ---------- navigation ---------- */
let screen='home',gameRun=0,TH=null,LV=0;
function show(id){screen=id;document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('on',s.id===id));document.body.classList.toggle('playing',id!=='home');if(id!=='station'){clearTimeout(idleT);gameRun++}}
document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{stopVoice();goHome()});
/* ---------- home: theme tiles ---------- */
const backSVG='<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" fill="#fff" opacity=".9"/></svg>';
function cardHTML(front,n,bk,cls=''){return `<button class="mc ${cls}" data-n="${n}" style="--bk:${bk}" aria-label="Карточка"><span class="mc-in"><span class="mc-b">${backSVG}</span><span class="mc-f">${front}</span></span></button>`}
function goHome(){show('home');
 $('tiles').innerHTML=THEMES.map(t=>`<button class="tile${save.last===t.id?' last':''}" data-t="${t.id}" aria-label="${t.title}"><span class="ic">${t.kind==='letters'?'<b>А<i>а</i></b>':picSVG(t.icon)}</span><span class="tt">${t.title}</span><span class="td">${Array.from({length:t.levels},(_,l)=>`<i class="${lvDone(t.id,l)?'ok':''}"></i>`).join('')}</span></button>`).join('');
 $('tiles').querySelectorAll('.tile').forEach(b=>b.onclick=()=>{unlockAudio();startLevel(b.dataset.t,save.next[b.dataset.t],true)})}
/* the two hero cards on the home screen flip back and forth */
function hero(){const ps=['kot','yabloko'];$('hero').innerHTML=ps.map((p,k)=>cardHTML(picSVG(p),k,['#f7a35c','#7cc9a8'][k])).join('');$('hero').style.setProperty('--s','var(--hc)');
 let k=0;if(!REDUCED)setInterval(()=>{if(screen!=='home')return;const c=$('hero').children[k%2];c.classList.toggle('up');k++},1300)}
/* ---------- level ---------- */
function pairsOf(t,l){if(t.kind==='letters')return DATA.letterLevels[l].map(id=>{const L=LETTERS[id];return {key:id,a:{type:'l',L},b:{type:'p',p:L.w},match:'lp_'+id}});
 const n=DATA.levels[l];return shuffle(t.pics).slice(0,n).map(p=>({key:p,a:{type:'p',p},b:{type:'p',p},match:'n_'+p}))}
const sideHTML=s=>s.type==='l'?`<b>${s.L.ch}</b>`:picSVG(s.p);
const sideClip=s=>s.type==='l'?'name_'+s.L.id:'n_'+s.p;
/* the biggest square cards that fit the stage without scrolling */
function layout(n){const st=$('stage'),cs=getComputedStyle(st);const W=st.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight),H=st.clientHeight-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom);
 let best=null;for(let c=1;c<=n;c++){const r=Math.ceil(n/c);if(r*c-n>=c)continue;const g=Math.max(8,Math.min(16,Math.min(W,H)*.025));const s=Math.min((W-g*(c-1))/c,(H-g*(r-1))/r-6,230);const sc=s-(r*c!==n?6:0);if(!best||sc>best.sc)best={c,r,g,s:Math.floor(s),sc}}
 st.style.setProperty('--c',best.c);st.style.setProperty('--s',best.s+'px');st.style.setProperty('--g',best.g+'px');return best}
function drawDots(){const t=TH;$('dots').innerHTML=Array.from({length:t.levels},(_,l)=>`<i class="${lvDone(t.id,l)?'ok':''} ${l===LV?'now':''}"></i>`).join('')}
async function startLevel(tid,l,fromHome){const t=THEMES.find(x=>x.id===tid);TH=t;LV=l;save.last=tid;store();show('station');drawDots();
 const run=++gameRun;const pairs=pairsOf(t,l);const cards=shuffle(pairs.flatMap((p,k)=>[{k,s:p.a},{k,s:p.b}]));
 preload([...new Set(cards.map(c=>sideClip(c.s)).concat(pairs.map(p=>p.match),['ph_find','ph_find_l','ph_more','ph_done','t_'+tid],DATA.praise.map(p=>'ph_'+p)))]);
 const st=$('stage');st.innerHTML='';const lay=layout(cards.length);
 st.innerHTML=`<div class="board" id="board">${cards.map((c,n)=>cardHTML(sideHTML(c.s),n,BACKS[tid],'deal')).join('')}</div>`;
 const els=[...st.querySelectorAll('.mc')];els.forEach((e,n)=>e.style.animationDelay=(REDUCED?0:n*55)+'ms');
 const first=(save.pl[tid+':'+l]||0)===0;
 const ins=[t.kind==='letters'?'ph_find_l':'ph_find'];
 st.dataset.g='level:'+tid+':'+l+':'+run;
 await say([...(fromHome?['t_'+tid,250]:[]),...(l>0&&first&&t.kind==='pics'?['ph_more',250]:[])]);if(!alive(run))return;
 /* the smallest levels show all the pictures for a moment first */
 const peek=t.kind==='pics'&&l<=1;let busy=true;
 if(peek){els.forEach(e=>e.classList.add('up'));await wait(REDUCED?400:900+pairs.length*450);if(!alive(run))return;els.forEach(e=>{e.classList.remove('up');e.classList.add('back')});await wait(450)}
 setInstr(ins);busy=false;els.forEach(e=>e.classList.remove('deal'));
 let open=[],got=0;window.__level={cards:cards.map(c=>c.k),open:()=>open.length,busy:()=>busy,got:()=>got,n:pairs.length,run};
 els.forEach(el=>el.onclick=async()=>{if(busy||el.classList.contains('up')||el.classList.contains('ok')||!alive(run))return;
  const c=cards[+el.dataset.n];el.classList.remove('back');el.classList.add('up');sfx('step');open.push(el);
  if(open.length<2){say(sideClip(c.s));return}
  busy=true;const [a,b]=open;open=[];
  if(a.dataset.n!==b.dataset.n&&cards[+a.dataset.n].k===cards[+b.dataset.n].k){
   const p=pairs[c.k];await wait(380);if(!alive(run))return;a.classList.add('ok');b.classList.add('ok');sfx('good');burstAt(a,10);burstAt(b,10);got++;
   await say(p.match);if(!alive(run))return;
   if(got===pairs.length){await finishLevel(run,t,l,pairs,els);return}
   if(got%2===0&&got<pairs.length)say(praise());busy=false}
  else{await say(sideClip(c.s));if(!alive(run))return;await wait(450);if(!alive(run))return;sfx('tick');a.classList.add('back');b.classList.add('back');a.classList.remove('up');b.classList.remove('up');await wait(500);busy=false}});
}
const alive=run=>run===gameRun&&screen==='station';
function confetti(){const c=$('confetti');c.innerHTML='';if(REDUCED)return;for(let n=0;n<40;n++){const i=document.createElement('i');i.style.cssText=`left:${Math.random()*100}%;background:${pick(['#f7bd43','#e76f69','#7cc9a8','#8fb4ff','#e6a8ff'])};animation-delay:${Math.random()*1.2}s;animation-duration:${2.4+Math.random()*1.6}s`;c.appendChild(i)}}
async function finishLevel(run,t,l,pairs,els){const b=$('board');await wait(300);b.classList.add('win');els.forEach((e,n)=>e.style.animationDelay=(n*60)+'ms');sfx('win');await wait(900+els.length*60);if(!alive(run))return;
 save.done[t.id][l]=1;save.pl[t.id+':'+l]=(save.pl[t.id+':'+l]||0)+1;const nx=l+1<t.levels?l+1:0;save.next[t.id]=nx;store();
 const last=pairs[pairs.length-1];$('rewardSticker').innerHTML=t.kind==='letters'?`<b style="font-size:min(30vw,130px);color:#e76f69;font-weight:800;display:grid;place-items:center;height:100%">${last.a.L.ch}</b>`:picSVG(last.key);
 $('rewardStars').innerHTML=Array.from({length:t.levels},(_,k)=>`<i class="${lvDone(t.id,k)?'ok':''}"></i>`).join('');
 show('reward');confetti();say(['ph_done',300,praise()]);setTimeout(()=>{if(screen==='reward')burstAt($('rewardSticker'),18)},650);
 $('rewardNext').onclick=()=>{stopVoice();if(l+1<t.levels)startLevel(t.id,l+1,false);else goHome()};
 $('rewardHome').onclick=()=>{stopVoice();goHome()}}
$('rewardHome').innerHTML=HOME;
addEventListener('resize',()=>{if(screen==='station'&&$('board'))layout($('board').children.length);if(screen==='home')goHome()});
hero();goHome();
window.PG={THEMES,get save(){return save},get state(){return {screen,TH:TH&&TH.id,LV}},startLevel,pairsOf};
