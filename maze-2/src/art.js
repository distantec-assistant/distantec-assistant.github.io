const MailArt = (() => {
  'use strict';
  const ink='#385550';
  const outline = shapes => `<g stroke="${ink}" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round">${shapes}</g>`;
  const glyph = {
    arrow:'M4.5 12h14m-5-5 5 5-5 5', home:'m3 11 9-7 9 7m-3-2v11H6V9m4 11v-6h4v6',
    map:'m3 6 6-2 6 3 6-2v13l-6 2-6-3-6 2zm6-2v13m6-10v13', start:'m9 5 11 7-11 7Z',
    redo:'M20 10a8 8 0 1 0-.8 6M20 5v5h-5', undo:'M8 6 4 10l4 4m-4-4h9a5 5 0 0 1 0 10h-2',
    close:'m6 6 12 12m0-12L6 18', check:'m5 12 4 4L20 5',
  };
  const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${glyph[name]}"/></svg>`;
  const objects = {
    mail: outline('<rect x="8" y="17" width="56" height="39" rx="7" fill="#fff4ce"/><path d="m10 20 23 18q3 2 6 0l23-18M11 52l16-15m34 15L45 37" fill="none"/><path d="M37 38c-8-8-14 3 0 9 13-7 7-17 0-9Z" fill="#ed9075" stroke="none"/>'),
    parcel: outline('<path d="m10 28 24-13 27 12v26L35 66 10 53Z" fill="#f0b777"/><path d="m10 28 25 13 26-14M35 41v25m-10-45 25 13v11l-6 3V37L19 25" fill="#f9d99b"/><path d="m16 44 13 7v6l-13-7Z" fill="#fff4db" stroke-width="1.4"/>'),
    light: outline('<path d="M32 16a6 6 0 1 1 10 0m-22 5h34l-5 9H25Zm5 11-6 22h35l-5-22M21 60h31" fill="none"/><path d="M25 30h24l6 24H19Z" fill="#ffe49d"/><path d="M43 49q8-7-7-17 4 8-4 10-7 9 5 11Z" stroke="none" fill="#f5ac62"/>'),
    stamp: outline('<path d="M15 20q5 0 5-5h6q0 5 5 5t5-5h6q0 5 5 5t5-5h6q0 5 5 5v7q-5 0-5 5t5 5v7q-5 0-5 5t5 5v7q-5 0-5 5h-7q0-5-5-5t-5 5h-6q0-5-5-5t-5 5h-6q0-5-5-5v-8q5 0 5-5t-5-5v-7q5 0 5-5t-5-5Z" fill="#f9fff3"/><rect x="23" y="25" width="33" height="31" rx="5" fill="#cfb0e8" stroke-width="1.6"/><path d="m40 30 3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1Z" fill="#ffdf87" stroke="none"/>'),
    post: outline('<path d="M20 61V36Q20 16 36 16h14q10 0 10 17v15H18m23 0v14H31V48" fill="#e99a7b"/><path d="M18 38q0-18 14-18t13 18H18" fill="#fff2d2"/><path d="M51 16V6h13v8H51" fill="#fad98d"/><path d="m23 29 8 5 8-5" fill="none"/>'),
    hedgehog: outline('<path d="m8 55 1-9-4-3 8-5-2-6 8-1 2-10 8 6 8-11 5 10 11-5 1 10 10 1-4 10 6 3-7 12q-18 11-51-2Z" fill="#a57760"/><path d="M34 53q-1-15 14-16 10-1 14 10l7 4q-1 9-14 9H36Z" fill="#ffe5b0"/><path d="M36 57l-5 6m14-4 2 5m5-18h.1" fill="none" stroke-width="3.5"/><circle cx="67" cy="51" r="2.2" fill="#385550"/><path d="m18 44 5-5m1 11 4-5m-1-11 5-4" fill="none" stroke="#805846"/>'),
    otter: outline('<path d="M19 63q-14 1-12-7 2-7 14-11m9-14q-14 11-10 27 5 10 22 7 17-1 14-15-1-12-13-20Z" fill="#bd8b67"/><circle cx="21" cy="20" r="7" fill="#bd8b67"/><circle cx="53" cy="20" r="7" fill="#bd8b67"/><path d="M16 28q0-15 20-16 22 0 23 17 2 14-21 17-22 1-22-18Z" fill="#c89b71"/><path d="M37 31q-16-4-17 3 4 10 18 9 13-1 16-8-1-8-17-4Z" fill="#f8dbab" stroke="none"/><path d="M27 26v1m21-1v1m-12 7h4m-10 3q5 5 8 0 4 5 7 0" fill="none"/><path d="M28 54q8-7 19 0" fill="none"/>'),
    lighthouse: outline('<path d="M16 63h43v7H16zM25 30h25l5 34H20Z" fill="#ffecd6"/><path d="M24 37h27l2 10H22zm-2 16h32l1 8H21Z" fill="#ec937a" stroke="none"/><path d="M22 29h31v5H22zm5-17h22v17H27z" fill="#ffe599"/><path d="m22 13 16-11 16 11Zm11 48v9h10v-9" fill="#df795f"/><path d="m16 19-11-4m12 12L6 30m50-11 10-4m-9 12 10 3" fill="none" stroke="#eda94d"/>'),
    nest: outline('<g fill="#c5e492"><path d="M8 44q2-14 21-13-5 15-21 13m56-5q-2-13-20-13 4 13 20 13"/></g><path d="M12 45q13 23 26 23 19 0 23-23Z" fill="#c88a60"/><path d="M23 45q-3-16 7-17t9 16m2 1q0-20 11-16 8 3 5 16" fill="#dcebfd"/><path d="M10 46q30 6 53 0M20 52l31 9m-23 3 25-12" fill="none"/>'),
    arch: outline('<path d="M9 63V44c0-20 13-32 27-32s27 12 27 32v19H53V45c0-14-7-21-17-21S19 31 19 45v18Z" fill="#d1c7e3"/><path d="m14 29 9 5m16-22v12m13-6-5 8m8 15 9-2M9 50h10m35 5h10" fill="none" stroke-width="1.8"/><path d="M29 64h13" fill="none" stroke="#e9bf89"/>'),
    wind: outline('<path d="M27 31h20l4 28H22Z" fill="#ffe7ba"/><path d="M24 29 37 17l13 12Z" fill="#ee9b7d"/><path d="M37 33 20 17m17 16 16-17M37 33l15 15M37 33 21 50" fill="none"/><path d="m20 17-5-2-3 5 12 13 5-6zm33-1 3-6 5 4-11 14-5-5zM51 47l6 1 4-4-12-12-5 6ZM21 50l-6 1-3-4 13-14 5 6Z" fill="#def2e5"/>'),
  };
  const object = (name,cls='object') => `<svg class="${cls}" width="74" height="74" viewBox="0 0 74 74" aria-hidden="true" focusable="false">${objects[name]||objects.mail}</svg>`;
  const goal = {meadow:'hedgehog',stream:'otter',coast:'lighthouse'};
  const hare = () => outline(`<ellipse cx="36" cy="64" rx="24" ry="5" fill="#385550" opacity=".16" stroke="none"/>
    <path d="M25 33C11 22 16 4 22 5s15 15 13 26M40 29C38 14 45 1 51 6q8 6 0 26" fill="#fff1d7"/>
    <path d="M24 12q7 9 7 15m17-15-4 14" fill="none" stroke="#e99b91" stroke-width="4"/>
    <path d="M23 44Q11 51 18 60q6 6 17 1 12 5 22-1 6-6-7-14Z" fill="#e8bd83"/>
    <path d="M15 38q1-18 21-18 24-1 25 18 1 15-23 17-25-1-23-17Z" fill="#fff2db"/>
    <path d="M16 33q8-16 25-14 11 2 18 14-16-5-43 0Z" fill="#79b5a0"/>
    <path d="M18 34q18-2 34 4l9-4M27 41v2m20-2v2m-12 4h4" fill="none"/>
    <path d="M23 52q18 7 31-3l-4 11-14 4-2-5-8 2Z" fill="#ee8b77"/>
    <path d="M21 46h4m23 0h5" fill="none" stroke="#ebaaa0" stroke-width="3"/>`);
  const tree = (x,y,scale,color) => `<g transform="translate(${x} ${y}) scale(${scale})" stroke="#57736a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M0 3v16" fill="none" stroke="#ac855e" stroke-width="5"/><path d="M-16 4q-11-3-8-15 1-9 12-9 1-14 14-13 10 3 12 14 14 1 13 12-1 11-14 11Z" fill="${color}"/><path d="m-8-13 8 9 9-11M0-5v9" fill="none" opacity=".55"/></g>`;
  const sprig = (x,y,color) => `<path d="M${x-4} ${y-3}q4 8 8 0m-4 5v4" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/>`;
  const lily = (x,y) => `<g transform="translate(${x} ${y})"><path d="M-21 1q2-12 19-12L0 0 11-8q14 2 17 12-4 10-26 11Q-21 13-21 1Z" fill="#89bb87" stroke="#5f977e" stroke-width="2"/><path d="M1 4q-14-4-9-14 5 1 8 6 1-8 7-9 6 7 2 13 8-3 10 2-7 7-18 2Z" fill="#efb4cd"/></g>`;
  const house = (x,y) => `<g transform="translate(${x} ${y})" aria-hidden="true">${outline('<path d="M-19 1h38v31h-38Z" fill="#fff5d4"/><path d="M-27 3L0-20 28 3Z" fill="#df987b"/><path d="M-7 31V14h13v17m1-20H16v10H7Z" fill="#b8dccb" stroke-width="2"/>')}</g>`;
  const terrain = {
    meadow: () => `<rect width="600" height="370" fill="#e9f0bf"/><path d="M0 76Q118 26 215 65T432 63q116-39 168 0V0H0Z" fill="#d8e8a6"/>
      <path d="M0 305q139-56 252-4 115 47 245-2 52-20 103-7v78H0Z" fill="#d2e6aa"/>
      <path d="M16 128q35-28 84-23t75 1q-31 34-105 36Z" fill="#f6f3cb"/>
      ${[[42,74,.83,'#b1d488'],[90,92,.65,'#91bf78'],[154,70,.91,'#b4d89b'],[251,119,.48,'#9bc17f'],[499,58,.6,'#c2db92'],[556,84,.98,'#a9ce86'],[562,312,.92,'#91bf78'],[197,330,.7,'#abd77c']].map(v=>tree(...v)).join('')}
      ${[[116,141],[205,122],[156,197],[364,181],[397,127],[463,183],[88,319],[142,338],[476,327],[560,177]].map(p=>sprig(...p,'#7da66d')).join('')}
      <g fill="#eca984"><circle cx="96" cy="153" r="3.4"/><circle cx="181" cy="186" r="3"/><circle cx="375" cy="200" r="4"/><circle cx="484" cy="195" r="3"/><circle cx="527" cy="300" r="5"/></g>`,
    stream: () => `<rect width="600" height="370" fill="#d5ebd4"/><path d="M117 0h184q-23 67 17 107 25 28 23 76 31 45 26 94-13 60 14 93h-96q-17-55 1-111 10-39-22-71Q153 137 117 0Z" fill="#94ccdf"/>
      <path d="M207 0q9 93 89 150 28 23 28 88-4 66 3 132" fill="none" stroke="#c9e6eb" stroke-width="3" stroke-linecap="round" stroke-dasharray="29 22"/>
      <path d="M0 340q113-50 250-5l-10 35H0ZM487 16q63-19 113 12v99q-67-8-113-49Z" fill="#b6d9b2"/>
      ${[[47,86,.95,'#9cc996'],[95,122,.75,'#add9a2'],[565,262,.69,'#a2cb98'],[536,45,.89,'#a3d1a4'],[122,322,.6,'#97c699']].map(v=>tree(...v)).join('')}
      ${[[192,101],[231,124],[246,85],[320,307]].map(p=>lily(...p)).join('')}
      ${[[27,177],[77,205],[234,271],[478,78],[531,235],[494,311],[461,345]].map(p=>sprig(...p,'#5c9a7c')).join('')}`,
    coast: () => `<rect width="600" height="370" fill="#e2efce"/><path d="M546 0q-83 69-12 145 35 36-14 81-39 44-11 144H600V0Z" fill="#abdce9"/>
      <path d="M553 104q-15-17 18-45m-18 217q-24 27-1 56M570 206q12-14 5-28" fill="none" stroke="#e2f1f2" stroke-width="3" stroke-linecap="round"/>
      <path d="M0 0h283q-37 54-114 72Q82 91 0 56Z" fill="#c7e0b7"/><path d="M0 347q97-66 210-9 41 22 80 32H0Z" fill="#c4deae"/>
      ${[[41,89,.81,'#b4d28e'],[106,65,1.02,'#a6cc93'],[170,111,.94,'#b7d7a2'],[158,166,.68,'#9ec894'],[363,42,.63,'#b0d6a2'],[291,239,.58,'#a5c8a7'],[420,346,.65,'#b1d6a6']].map(v=>tree(...v)).join('')}
      <path d="M446 239h143v22H446Zm24 0v22m22-22v22m20-22v22m20-22v22m20-22v22m20-22v22" fill="#c89c73" stroke="#a87c5e" stroke-width="3"/>
      ${[[72,130],[103,306],[205,341],[230,106],[353,254],[392,141],[475,157]].map(p=>sprig(...p,'#81ad7f')).join('')}`,
  };
  function decorate(map,stamped) {
    const out=[];
    const tiny=(art,p,dx=-30,dy=-59,size=60)=>`<svg x="${p[0]+dx}" y="${p[1]+dy}" width="${size}" height="${size}" viewBox="0 0 74 74" aria-hidden="true">${objects[art]}</svg>`;
    out.push(tiny('post',map.places.start.at,-37,-48,45));
    const [goalX,goalY]=map.places[map.goal].at;
    out.push(`<path d="M${goalX} ${goalY-55}v36" stroke="#9e8469" stroke-width="2.5" fill="none" stroke-dasharray="2 5" stroke-linecap="round"/>
      <g data-recipient="true">${tiny(goal[map.id],[goalX,goalY],-30,-113,59)}</g>`);
    if(map.id==='meadow') out.push(tiny('nest',map.places.nest.at,-18,-43,46),house(372,256));
    if(map.id==='stream'&&!stamped) out.push(tiny('stamp',map.places.lilies.at,-24,-55,51));
    if(map.id==='coast') out.push(tiny('arch',map.places.arch.at,-22,-52,48),tiny('wind',map.places.windmill.at,-17,-42,50));
    return out.join('');
  }
  return Object.freeze({icon,object,hare,terrain,decorate,goal});
})();
