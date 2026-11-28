const MailArt = (() => {
  'use strict';
  const ink='#385550';
  const outline = shapes => `<g stroke="${ink}" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round">${shapes}</g>`;
  const glyph = {
    arrow:'M4.5 12h14m-5-5 5 5-5 5', home:'m3 11 9-7 9 7m-3-2v11H6V9m4 11v-6h4v6',
    map:'m3 6 6-2 6 3 6-2v13l-6 2-6-3-6 2zm6-2v13m6-10v13', start:'m9 5 11 7-11 7Z',
    redo:'M20 10a8 8 0 1 0-.8 6M20 5v5h-5', undo:'M8 6 4 10l4 4m-4-4h9a5 5 0 0 1 0 10h-2',
    close:'m6 6 12 12m0-12L6 18', check:'m5 12 4 4L20 5',
    hint:'M8.5 15c0-2-3-3-3-6.3a6.5 6.5 0 0 1 13 0c0 3.3-3 4.3-3 6.3Zm.5 3h6m-5 3h4',
    album:'M5 3.5h13q1.5 0 1.5 2v15H6a2.5 2.5 0 0 1-2.5-2.5v-12q0-2.5 1.5-2.5Zm2.5.5v13m-3.6 1q.4-1 2.1-1h13m-8-8 1-2 1 2 2 .3-1.5 1.5.4 2.2-1.9-1-1.9 1 .4-2.2-1.5-1.5Z',
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
    squirrel: outline(`
      <path d="M35 63C20 69 7 59 5 46 3 36 9 30 12 27 6 19 11 8 21 7c11-1 18 7 17 17-1 8-8 12-12 15-8 6-5 15 8 17Z" fill="#d78a61"/>
      <path d="M14 20c0-9 14-12 17-2 2 6-5 12-10 8 6-1 7-5 3-7-4-3-8 1-10 1Z" fill="#efbe86" stroke="none"/><path d="M12 43q-1 9 8 14" fill="none" stroke="#edb07a" stroke-width="3.4"/>
      <path d="M27 59q-4-11 6-23l3-11-1-14 9 8 6-1 5-12 3 18q7 4 5 12l6 3q-1 7-12 9l-2 9 6 3q4 5-3 6H28q-9-2-1-7Z" fill="#dd9168"/>
      <path d="M50 42q9 3 14-1-2 5-10 7l-2 12h-8q0-12 6-18Z" fill="#ffe5b4" stroke="none"/>
      <path d="M52 29v1m13 9h1m-33 9q9-6 13 5" fill="none" stroke-width="3.6"/>
      <path d="M45 48q7-3 11 1-1 10-7 12-6-4-4-13Z" fill="#c29b63"/><path d="M43 49q0-7 7-7 6-1 8 5Z" fill="#867855"/>`),
    owl: outline(`
      <path d="M11 62q15 2 27 2 15 0 26-5l-1 5q-26 9-52 2Z" fill="#c59b74"/>
      <path d="m16 26-2-15 14 7q10-3 20 0l12-9-1 20q8 22-3 30-6 5-19 5-21 0-25-12-3-12 4-26Z" fill="#a78ca9"/>
      <path d="M16 36q9 2 9 11-1 8-8 10-7-10-1-21Zm41 0q-9 3-9 11 1 9 7 10 8-10 2-21Z" fill="#83778f"/>
      <path d="M16 31q3-13 14-10 4 1 7 6 6-9 14-6 12 3 7 16-3 9-13 6-5-1-8-4-4 6-12 5-12-1-9-13Z" fill="#fff0c8"/>
      <g fill="#45595b" stroke="none"><circle cx="27" cy="32" r="4"/><circle cx="48" cy="32" r="4"/></g>
      <path d="m32 36 6 8 5-9Z" fill="#e7ab62" stroke-width="1.8"/><path d="m29 49 4 4 4-4m1 7 4 3 4-4" fill="none" stroke="#e3c9ca"/>
      <path d="m27 62-2 5m7-5-1 5m13-5-1 5m7-5-1 4" stroke="#b38858"/>`),
    fox: outline(`
      <path d="M18 64q2-14 12-19l16 1q8 5 11 19Z" fill="#c97a56"/><path d="m25 52 6 8 5-2 4 5 9-13Z" stroke="none" fill="#fff1ce"/>
      <path d="m15 35-4-26q10 3 19 15 7-2 14 0L60 8l-1 26 7 8-9 1q-5 8-20 14Q22 51 17 45L8 42Z" fill="#ed9b65"/>
      <path d="m13 12 4 15 5-6Zm44 1-9 10 7 4Z" fill="#835f57" stroke="none"/>
      <path d="M11 41q17-2 26 11 12-16 26-12-7 11-26 18-17-7-26-17Z" fill="#ffebc5" stroke="none"/>
      <path d="M24 37q2-2 5 0m15 0q3-2 5 0" fill="none" stroke-width="3.2"/><path d="M32 49q4-4 10-1-1 6-5 7-4-1-5-6Z" fill="#385550" stroke="none"/>`),
    beaver: outline(`
      <path d="M39 61q6-17 17-24 14-5 13 4 0 14-19 22Z" fill="#a78166"/><path d="m53 47 9 6m-5-11 9 6m-16 5 8 4m-1-2 7-13" fill="none" stroke="#765f53" stroke-width="1.8"/>
      <path d="M19 63q-8-7-3-21 4-11 17-10 18 2 18 16 8 15-4 17H21Z" fill="#af845f"/>
      <path d="M13 29q-6-12 3-14 6-2 9 4 8-2 16-1 6-8 12-3 6 6-1 11 7 13-2 20-9 7-24 4-18-1-19-9-1-7 6-12Z" fill="#bd936c"/>
      <path d="M13 36q8-5 16 1 9-7 18-3 5 9-8 13-14 7-25 0-7-5-1-11Z" fill="#f1cf9f" stroke="none"/>
      <path d="m26 42 12-1-1 10-8 1Zm6 1 1 7" fill="#fffae4" stroke-width="1.8"/><path d="M24 35q6-4 12-1-1 5-6 6-6 0-6-5Z" fill="#385550" stroke="none"/>
      <path d="M19 29v1m21-2v1m-23 10-6-1m30 0 6-2m-21 22q3 3 7 0" fill="none"/>`),
    penguin: outline(`
      <path d="M21 59q-7-14-2-29 4-17 18-18 15-1 20 18 3 15-2 30-13 8-34-1Z" fill="#506b79"/>
      <path d="M17 34Q8 38 7 49q6 3 14-8m35-8q10 6 12 17-6 2-15-9" fill="#506b79"/>
      <path d="M22 34q0-11 9-12 5-1 7 6 4-7 9-6 10 2 7 15-2 5-5 7 7 14-5 17-16 4-21-4-3-6 3-15-4-3-4-8Z" fill="#fff0cf" stroke="none"/>
      <path d="m32 36 6 5 6-6q-7-3-12 1Z" fill="#f0ae67" stroke-width="1.8"/><path d="M29 31v1m17-1v1" fill="none" stroke-width="3.3"/>
      <path d="M19 42q17 7 35 0l-1 6q-6 2-10 2l5 7-7 3-5-10q-11 0-17-4Z" fill="#eb987e" stroke-width="1.8"/>
      <path d="M24 61q-9 3-10 6 8 2 18-3m13-2q12-1 15 4-7 4-16-1" fill="#edb06c" stroke-width="2"/>`),
    key: outline(`<path d="M40 18c9-11 27-6 27 7 0 11-11 16-20 12L24 61l-7-7-5 4-7-7 8-8 6 5 4-4-4-5 19-17Z" fill="#f3c36a"/>
      <ellipse cx="54" cy="25" rx="6.3" ry="6" fill="#fffae7"/><path d="m28 41 13-13m7-11q5-4 10-2" fill="none" stroke="#ffe7a0" stroke-width="3"/>`),
    apple: outline(`<path d="M35 26q-1-12 8-18" fill="none" stroke="#7f6752" stroke-width="4"/><path d="M36 23Q19 24 17 10q14-1 19 13Z" fill="#90b878"/>
      <path d="M35 27q15-11 25 0 9 12-3 29-9 12-20 6-12 7-21-7C1 34 16 14 35 27Z" fill="#e88772"/><path d="M17 39q0-6 5-9" fill="none" stroke="#ffcfac" stroke-width="4.4"/>`),
    star: outline(`<path d="m37 8 9 18 20 3q3 1 0 4L52 47l3 19-18-9-19 9 3-20L7 32q-2-2 1-3l20-3Z" fill="#f6c663"/>
      <path d="m36 18-5 13-13 2m22 17 8 5" fill="none" stroke="#fff0a4" stroke-width="3.5"/>`),
    nest: outline('<g fill="#c5e492"><path d="M8 44q2-14 21-13-5 15-21 13m56-5q-2-13-20-13 4 13 20 13"/></g><path d="M12 45q13 23 26 23 19 0 23-23Z" fill="#c88a60"/><path d="M23 45q-3-16 7-17t9 16m2 1q0-20 11-16 8 3 5 16" fill="#dcebfd"/><path d="M10 46q30 6 53 0M20 52l31 9m-23 3 25-12" fill="none"/>'),
    arch: outline('<path d="M9 63V44c0-20 13-32 27-32s27 12 27 32v19H53V45c0-14-7-21-17-21S19 31 19 45v18Z" fill="#d1c7e3"/><path d="m14 29 9 5m16-22v12m13-6-5 8m8 15 9-2M9 50h10m35 5h10" fill="none" stroke-width="1.8"/><path d="M29 64h13" fill="none" stroke="#e9bf89"/>'),
    wind: outline('<path d="M27 31h20l4 28H22Z" fill="#ffe7ba"/><path d="M24 29 37 17l13 12Z" fill="#ee9b7d"/><path d="M37 33 20 17m17 16 16-17M37 33l15 15M37 33 21 50" fill="none"/><path d="m20 17-5-2-3 5 12 13 5-6zm33-1 3-6 5 4-11 14-5-5zM51 47l6 1 4-4-12-12-5 6ZM21 50l-6 1-3-4 13-14 5 6Z" fill="#def2e5"/>'),
  };
  const object = (name,cls='object') => `<svg class="${cls}" width="74" height="74" viewBox="0 0 74 74" aria-hidden="true" focusable="false">${objects[name]||objects.mail}</svg>`;
  const goal = Object.freeze({meadow:'hedgehog',stream:'otter',coast:'lighthouse',orchard:'squirrel',village:'fox',snow:'penguin'});
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
  // Vignettes share the rounded pen and flat gouache colours of the courier.
  // Their ground is unmarked: the map graph, not its theme, supplies the roads.
  const vignette = (x,y,s,art) => `<g transform="translate(${x} ${y}) scale(${s})" stroke-linecap="round" stroke-linejoin="round">${art}</g>`;
  const flower = `<path d="M0-2c-5-7-11 0-5 4-5 6 2 11 6 4 6 5 11-2 5-5 2-7-4-10-6-3Z" fill="#fce6db"/><circle cx=".5" cy="2" r="1.8" fill="#da846f"/>`;
  const cherry = (x,y,s) => vignette(x,y,s,`<ellipse cx="-1" cy="0" rx="28" ry="5" fill="#bdd098"/>
    <path d="M-8 0q8-16 4-26l-18-18 5-4 15 11 5-18 6 2-6 22 16-11 3 4L5-20 4-3 10 0Z" fill="#a17a65" stroke="#826d5b" stroke-width="2.3"/>
    <path d="M-23-29q-16 1-19-12-2-12 9-17-1-15 14-16 5-13 20-11 8 0 13 8 15-5 21 7 1 4 0 8 14 2 14 15-1 13-17 13-9 10-23 4-8 7-19-1-7 5-13 2Z" fill="#e8a8ab" stroke="#a27c7b" stroke-width="2.6"/>
    <path d="M-36-52q0-8 11-9 0-12 13-10 4-10 16-8 8 1 10 8 10-4 15 4-8-2-14 4-11-6-18 1-8-2-14 4-5-1-9 5Z" fill="#f4c4bd"/>
    ${[[-24,-46,.8],[-9,-65,.64],[0,-46,1],[17,-62,.8],[32,-48,.62]].map(([a,b,k])=>vignette(a,b,k,flower)).join('')}
    <path d="M-14-34q-10 1-13-5 8-3 13 5m33-7q5-8 11-7 0 7-11 7Z" fill="#94ad87"/>`);
  const stall = (x,y,s,wall,roof,shop=false) => vignette(x,y,s,`<g stroke="#7c8170" stroke-width="2">
    <path d="M-18-32h36V0h-36Z" fill="${wall}"/><path d="m-23-31 8-17h30l9 17Z" fill="${roof}"/>
    <path d="M6-47v-9h7v9" fill="#c09377"/><path d="m-15-43 26-1" stroke="#fff0cd" opacity=".65"/>
    ${shop?'<path d="M-11 0v-18h22V0" fill="#acccbd"/><path d="M-17-24h34l3 8q-3 5-7 1-3 4-7 0-3 4-7 0-4 4-7 0-5 4-8 0Z" fill="#fff0ca"/><path d="m-9-24-2 9m10-9-1 9m9-9 1 9" stroke="#d58e7a" stroke-width="4"/>':'<path d="M-11-21h8v10h-8Zm13 21v-14q4-7 9 0V0" fill="#b7d4c6"/><path d="M-14-9h13" stroke="#b78269" stroke-width="3"/>'}</g>`);
  const spruce = (x,y,s,foliage) => vignette(x,y,s,`<path d="M-1-9V1" stroke="#898a89" stroke-width="4"/>
    <path d="m0-44 11 17-5-1 11 15-7-1 11 9q-20 8-41 1l10-11-6 1 11-15-5 1Z" fill="${foliage}" stroke="#749398" stroke-width="1.8"/>
    <path d="m0-43 7 12-6-2-5 4-2-2Zm-7 23 8 2 6-4-5 8-6-1-6 2Z" fill="#ebf5ef"/>`);
  const terrain = {
    orchard: () => `<rect width="600" height="370" fill="#edf0c6"/>
      <path d="M0 0h600v63q-76-28-144-13-71 16-142-7-72-20-150 2C102 61 45 73 0 92Z" fill="#d4dfad"/>
      <path d="M0 308q52-12 94 22 42 26 109 21l31 19H0Zm600-16q-74 7-104 44-25 20-74 34h178Z" fill="#d4e2ae"/>
      ${[[153,49,.53],[205,43,.45],[252,39,.4],[531,51,.57],[598,88,.93],[85,75,.82],[9,111,1.13]].map(v=>cherry(...v)).join('')}
      <g fill="#e5afae"><path d="M46 101q1-9 8-8 0 7-8 8m23-8q3-8 9-6-1 6-9 6m71-31q3-9 10-7-1 6-10 7m401 5q5 0 7 6-6 2-7-6Z"/></g>
      ${vignette(56,349,.85,`<g stroke="#9a8066" stroke-width="2.4"><path d="M-21-10q-1-20 18-23 16-2 21 19" fill="none" stroke-width="4"/><path d="M-21-12q5-7 11-2 4-10 11-4 10-7 14 1 8-1 11 6" fill="#d88980"/><path d="m-27-12 55-2-6 18q-20 6-41 1Z" fill="#d9ae78"/><path d="m-18-6 37-2m-31 7 27-2" fill="none"/></g>`)}
      ${vignette(594,369,.86,`<path d="M13 9Q-24-17-88-29q60 4 101 26Z" fill="#a1856c"/>
        <path d="M-57-23q-13-15-29-10 10 12 29 10m19 7q-3-18 10-23 4 14-10 23m22 9q13-24 33-23-5 16-33 23Z" fill="#96af7e"/>
        <path d="M-50-21q3 9-2 15m3-15q4 7 7 11" fill="none" stroke="#8e9775" stroke-width="2"/><g fill="#c88686"><circle cx="-53" cy="-6" r="4.8"/><circle cx="-41" cy="-9" r="4.6"/></g>
        ${vignette(-69,-25,1.25,flower)}${vignette(-15,-9,1.4,flower)}`)}`,
    village: () => `<rect width="600" height="370" fill="#f3e8ca"/>
      <path d="M0 0h600v41q-35-9-72-1-44 12-97-1-57-11-89-7-101 14-150 6Q96 33 0 81Z" fill="#d4e6db"/>
      <path d="M0 66q52-6 82-15 39-11 68-6 43 7 65-4-50 29-117 33-64 3-98 22Z" fill="#e6d6b6"/>
      ${stall(5,66,.94,'#edbc95','#94b6ac')}${stall(54,73,1.21,'#f4d49d','#ce8976',true)}${stall(102,55,.86,'#a3cbbd','#9796b5')}
      ${vignette(147,61,.87,`<g stroke="#828176" stroke-width="2.2"><path d="M-13 0v-36h27V0Z" fill="#efc8aa"/><path d="m-17-35 17-30 17 30Z" fill="#93abb0"/><circle cy="-24" r="7.6" fill="#fff0c9"/><path d="M0-29v5l4 1m-8 20v-7h8v7" fill="none"/></g>`)}
      ${stall(180,42,.7,'#d4bdd0','#bd9588')}${stall(545,47,.96,'#efd4a4','#a5b7be')}${stall(594,53,1.28,'#b5cfc2','#c59391',true)}
      <path d="M190 7q40 24 80 2" fill="none" stroke="#a3a58c" stroke-width="2"/><path d="m200 13 9 3-7 7Zm21 6 9 1-5 8Zm22 0 10-2-3 9Z" fill="#d79583"/><path d="m211 17 8 2-5 7Zm22 3 9-1-4 7Z" fill="#93b8aa"/>
      <path d="M0 329q31-6 61 11 29 18 73 30H0Zm600-28q-16 18-52 32-68 28-81 37h133Z" fill="#e4d5b9"/>
      ${vignette(566,353,.87,`<g stroke="#878772" stroke-width="2.5"><path d="M-27-8q-4-17 8-12 0-17 12-9 8-13 16-5 14-3 13 10 13-1 10 12Z" fill="#a8bf96"/><path d="m-31-9 63-2-4 18-54 1Z" fill="#dba488"/><path d="m-32-11 65-2v6l-64 2Z" fill="#eac0a0"/></g><g fill="#dc999f"><circle cx="-17" cy="-19" r="5"/><circle cx="1" cy="-24" r="6"/><circle cx="19" cy="-18" r="5"/></g>`)}
      <g fill="#ddcfb4"><ellipse cx="26" cy="313" rx="7" ry="2"/><ellipse cx="40" cy="310" rx="4" ry="1.8"/><ellipse cx="527" cy="349" rx="6" ry="2"/></g>`,
    snow: () => `<rect width="600" height="370" fill="#dfedf0"/>
      <path d="M0 0h600v58q-57 14-134 6-120-20-201-9Q106 72 0 83Z" fill="#657c92"/>
      <path d="M-10 47C61 44 89-9 170-5c39 2 53 20 100 9 44-10 60-23 105-13-51 3-66 30-124 40-38 5-62-24-97-18C78 22 56 59-8 58Z" fill="#95c9bd"/>
      <path d="M75 30q48-36 86-31c33 2 55 20 87 13l-10 13c-36 0-51-21-85-18-29 2-53 15-78 23Z" fill="#b4d9bd"/>
      <path d="M287 29C355 15 374-7 417-4c51 5 59 31 109 21 37-7 54-23 76-22v10c-28 7-50 27-89 30-40 3-67-27-107-27-41 0-59 18-119 21Z" fill="#ada9c9"/>
      <path d="m218 26 5-12 6 2-7 12Zm12 1 8-12h4l-6 13Zm247-5 5-12 5 3-7 12Zm13 4 6-13h4l-5 14Z" fill="#bcd3ca" opacity=".6"/>
      <g fill="#f9eccd"><circle cx="32" cy="13" r="2"/><circle cx="292" cy="15" r="1.7"/><circle cx="334" cy="37" r="1.5"/><circle cx="453" cy="13" r="1.8"/><circle cx="532" cy="8" r="1.6"/></g>
      <path d="m0 60 43-26 24 12 39-25 31 24 19-10 57 23 53-14 37 7 38-21 26 11 30-20 48 27 51-8 21 6 43-23 40 23v23H0Z" fill="#a6bbc8"/>
      <path d="m77 40 29-19 21 16-14-4-7 3-8-4Zm288 0 32-19 28 16-16-2-9-7-10 7-6-2Z" fill="#dee9e6"/>
      <path d="M0 60q58-12 114 0 52 8 123-6 66-15 133-1t111 2q79-22 119-3v27q-57-11-113 1-77 12-142-5-56-12-112 0-74 16-131 4-70-15-102 8Z" fill="#c2d5db"/>
      ${[[5,99,1.18,'#88aaa7'],[34,84,.81,'#96b7ad'],[63,75,.55,'#a0bcb9'],[532,64,.46,'#a0babb'],[558,70,.65,'#98b3b1'],[591,79,.93,'#88a9a4']].map(v=>spruce(...v)).join('')}
      <path d="M0 322q37-21 87 2t100 30q-25 9-37 16H0Zm600-15q-44-8-81 13-61 37-128 39l-20 11h229Z" fill="#c5dde0"/>
      ${spruce(576,356,.91,'#91aca7')}${spruce(598,359,1.29,'#82a4a3')}
      <g fill="#f6fbf5"><ellipse cx="83" cy="338" rx="22" ry="3.4"/><ellipse cx="114" cy="346" rx="9" ry="2.4"/><ellipse cx="484" cy="351" rx="16" ry="3"/></g>`,
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
      ${[[72,130],[103,306],[205,341],[230,106],[353,254],[392,141],[475,157]].map(p=>sprig(...p,'#81ad7f')).join('')}`,
  };
  const miniature = (name,x,y,size) => `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 74 74" aria-hidden="true" focusable="false">${objects[name]||objects.mail}</svg>`;
  const petals = '<path d="M-11 2q4-8 10-5-1 7-10 5m12 4q2-8 9-8 0 7-9 8Z" fill="#dfa8aa"/><path d="M-6 8q0-5 3-8 4 3 3 8Z" fill="#a5b788"/>';
  const reeds = '<path d="M-7 7q-1-9-8-14m14 15-2-22m7 21q1-10 8-15" fill="none" stroke="#92aa83" stroke-width="2.8"/><path d="m-3-13-.6-6m13 11 3-6" fill="none" stroke="#ae9673" stroke-width="4"/>';
  const shells = '<path d="M-10 2q-5-6 1-8 2-6 7-3 7-3 9 3 5 4-1 8L1 8Z" fill="#e4bfa6" stroke="#ac9985" stroke-width="1.6"/><path d="m-5-4 6 9m1-12-1 13m6-9-5 9" fill="none" stroke="#c59f86" stroke-width="1.7"/>';
  const pot = '<path d="M-8-1q-8-7-1-11 6 0 7 9 1-11 6-13 5 7-2 13 10-7 13-2-5 7-14 6Z" fill="#95ae8f"/><path d="m-9 0 20-1-3 10q-6 2-13 0Z" fill="#d8a489" stroke="#ac8e78" stroke-width="1.6"/>';
  const frost = '<path d="m-12 7 6-6-3-8 10 8 6-15 7 20Z" fill="#b1d2d8" stroke="#96b6c0" stroke-width="1.8"/><path d="m6-12 1 14 5 2Z" fill="#eff7f2"/>';
  const stone = '<path d="M-15 4q1-8 9-9 4-7 11-3 8 2 11 12-12 6-31 0Z" fill="#b8ccd2"/><path d="M-12 0q2-6 7-6 6-8 14 1L5-2 0-3-6 1Z" fill="#f5fbf6"/>';
  const scattered = {
    orchard:[petals, `<path d="M1 4Q-2-8-13-6q2 8 14 10m0 0Q8-6 14-5q0 10-13 9Z" fill="#acbc87"/>${vignette(-3,-6,.83,flower)}`],
    village:[pot,'<g fill="#dccbb6" stroke="#c8b49f" stroke-width="1.3"><path d="m-14 2 9-2 6 3-8 3Zm16-8 8-1 6 4-9 1Z"/></g>'],
    snow:[stone,frost],coast:[shells,reeds],stream:[reeds,'<path d="M-11 4q1-6 6-5 2-6 9-4 6 2 8 8-11 4-23 1Z" fill="#adc7b0"/>'],
    meadow:[sprig(-4,3,'#90aa77'),'<path d="M-10 5q1-11 9-10-1 8-9 10m8 0q3-11 12-8Q6 5-2 5Z" fill="#a4bf88"/>'],
  };
  const gapToLine = ([x,y],[a,b,c,d]) => {
    const dx=c-a,dy=d-b,t=Math.max(0,Math.min(1,((x-a)*dx+(y-b)*dy)/(dx*dx+dy*dy||1)));
    return Math.hypot(x-a-t*dx,y-b-t*dy);
  };
  const layouts = new WeakMap();
  function layout(map) {
    if(layouts.has(map)) return layouts.get(map);
    const stops=map.objectives ?? (map.stamp?[{at:map.stamp,icon:'stamp'}]:[]);
    const places=Object.values(map.places).map(p=>p.at), lines=[], buttons=[], arrows=[], used=[];
    for(const [a,b,...bends] of map.trails||[]) {
      const ps=[map.places[a].at,...bends,map.places[b].at], lengths=[];
      for(let i=1;i<ps.length;i++) {
        lines.push([...ps[i-1],...ps[i]]);
        lengths.push(Math.hypot(ps[i][0]-ps[i-1][0],ps[i][1]-ps[i-1][1]));
      }
      // The two directions of a trail can put its button on different sides of the midpoint.
      for(const [f,reserve] of [[.44,buttons],[.56,buttons],[.41,arrows],[.59,arrows]]) {
        let n=lengths.reduce((sum,v)=>sum+v,0)*f;
        for(let i=0;i<lengths.length;i++) {
          if(n<=lengths[i]) { const t=n/(lengths[i]||1); reserve.push(ps[i].map((v,k)=>v+(ps[i+1][k]-v)*t)); break; }
          n-=lengths[i];
        }
      }
    }
    // All possible courier positions count, not just the current one. Station signs stay put on collection.
    const overlap = (dx,dy) => dx>0&&dy>0 ? Math.min(dx,dy)+10 : 0;
    function space(p,r) {
      const [x,y]=p;
      let score=0;
      for(const q of places) score+=1800*overlap(r+30-Math.abs(x-q[0]),r+35-Math.abs(y-(q[1]-25)));
      for(const [a,b,s] of used) score+=2000*overlap(r+s+4-Math.abs(x-a),r+s+4-Math.abs(y-b));
      for(const [a,b] of arrows) score+=240*overlap(r+27-Math.abs(x-a),r+27-Math.abs(y-b));
      for(const line of lines) score+=18*Math.max(0,r+16-gapToLine(p,line));
      for(const [a,b] of buttons) score+=12*overlap(r+43-Math.abs(x-a),r+43-Math.abs(y-b));
      return score;
    }
    function pin(at,r) {
      const [x,y]=map.places[at].at, side=r+35,up=r+66,down=r+15;
      const offsets=[[0,-up],[side,-17],[-side,-17],[0,down],[side,6],[-side,6],
        [side,-46],[-side,-46],[side-10,down],[-side+10,down],[side,down],[-side,down],
        [36,-up],[-36,-up],[side+15,-17],[-side-15,-17],[0,down+15],[0,down+31]];
      let best,low=Infinity;
      for(const [i,[dx,dy]] of offsets.entries()) {
        const a=Math.min(592-r,Math.max(8+r,x+dx)), b=Math.min(362-r,Math.max(8+r,y+dy));
        const cost=space([a,b],r)+i*1.4+Math.hypot(x-a,y-b)*.08;
        if(cost<low) { best=[a,b]; low=cost; }
      }
      used.push([...best,r]);
      return {node:[x,y],p:best,r};
    }
    const destination=pin(map.goal,32), stations=stops.map(s=>({...s,...pin(s.at,24)}));
    const post=pin(map.start||'start',18);
    let scenery='';
    if(map.id==='meadow'&&map.places.nest) {
      const [x,y]=map.places.nest.at; scenery=miniature('nest',x-18,y-43,46)+house(372,256);
    } else if(map.id==='coast'&&map.places.arch&&map.places.windmill) {
      // Planks stop against the visible bank of the classic trail; other coasts have no phantom pier.
      scenery='<path d="M476 239h113v22H450Zm-6 6v16m22-22v22m20-22v22m20-22v22m20-22v22m20-22v22" fill="#c89c73" stroke="#a87c5e" stroke-width="3"/>';
      for(const [id,art,dx,dy,s] of [['arch','arch',-22,-52,48],['windmill','wind',-17,-42,50]]) {
        const [x,y]=map.places[id].at; scenery+=miniature(art,x+dx,y+dy,s);
      }
    } else if(!['meadow','stream','coast'].includes(map.id)) {
      const details=scattered[map.theme]||scattered.meadow;
      const sites=[[45,155],[140,125],[248,95],[356,154],[471,117],[563,155],[81,219],[192,190],
        [290,252],[428,225],[549,270],[112,307],[219,333],[333,322],[455,319],[51,285]];
      const seed=Array.from(map.id||'').reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0);
      for(let i=0,count=0;i<sites.length&&count<5;i++) {
        const p=sites[(seed%sites.length+i*7)%sites.length];
        if(space(p,16)!==0) continue;
        scenery+=vignette(...p,.79+(count%2)*.15,details[(seed+count)%details.length]);
        used.push([...p,23]); count++;
      }
    }
    const result={destination,stations,post,scenery};
    layouts.set(map,result); return result;
  }
  const leader = ({node:[x,y],p:[a,b],r},colour) => {
    const length=Math.hypot(a-x,b-y)||1, dx=(a-x)/length,dy=(b-y)/length;
    return `<path d="M${a-dx*(r-4)} ${b-dy*(r-4)}L${x+dx*13} ${y+dy*13}" stroke="${colour}" stroke-width="2.8" stroke-dasharray="1 5" stroke-linecap="round" fill="none"/>`;
  };
  function decorate(map,collected=0) {
    const {destination,stations,post,scenery}=layout(map), index=Number(collected)||0;
    const ready=index>=stations.length,recipient=map.recipient||goal[map.theme||map.id]||'hedgehog';
    const [gx,gy]=destination.p;
    let out=scenery+leader(post,'#a2947d')+miniature('post',post.p[0]-21,post.p[1]-21,42);
    // The address is a little house; the things to collect are round counters, never houses.
    out+=leader(destination,ready?'#a97d60':'#998e78')+`<g data-recipient="true" data-state="${ready?'active':'waiting'}" transform="translate(${gx} ${gy})"><g>
      <path d="M-31-10q0-4 4-7l22-13q5-3 10 0l22 13q4 3 4 7v28q0 9-9 9h-44q-9 0-9-9Z" fill="${ready?'#fff1cf':'#f9f2df'}" stroke="${ready?'#aa775c':'#a89c86'}" stroke-width="3"/>
      <path d="m-28-14 24-15q4-2 8 0l24 15" fill="none" stroke="${ready?'#cf886e':'#b9a68c'}" stroke-width="4.4" stroke-linecap="round"/>
      ${miniature(recipient,-29,-27,58)}</g></g>`;
    for(const [i,station] of stations.entries()) {
      if(i<index) continue;
      const [x,y]=station.p, active=i===index, colour=active?'#805477':'#9b968a';
      out+=leader(station,colour)+`<g data-map-objective="${i}" data-state="${active?'active':'future'}" transform="translate(${x} ${y})">
        ${active?'<circle r="23" fill="#f8dfad" stroke="#805477" stroke-width="3.5"/><circle r="19.6" fill="#fff7dc" stroke="#d3b68d" stroke-width="1.5"/>':'<circle r="20" fill="#f8f6e8" stroke="#8e9386" stroke-width="2.5" stroke-dasharray="5 3"/>'}
        <g opacity="${active?1:.88}">${miniature(station.icon,active?-21:-19,active?-21:-19,active?42:38)}</g></g>`;
    }
    return out;
  }
  return Object.freeze({icon,object,hare,terrain,decorate,goal});
})();
