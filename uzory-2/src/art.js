const PartyArt = (() => {
  'use strict';
  const designs = {
    sun: {
      label:'Жёлтый круглый фонарик', fill:'#ffd36e', side:'#e3a84e', shine:'#fff1ba',
      body:'M23 21Q40 16 57 21Q69 29 69 45Q69 63 55 70Q40 76 25 70Q11 63 11 45Q11 29 23 21Z',
      strokes:'M29 24Q19 45 29 67M51 24Q61 45 51 67', glint:'M28 32Q34 27 40 27',
    },
    blue: {
      label:'Синий ромб', fill:'#74b9fc', side:'#4f8acb', shine:'#dff1ff',
      body:'M36 19Q40 16 44 19L67 37Q74 43 68 50L47 72Q40 79 33 72L12 50Q6 43 13 37Z',
      strokes:'M26 42L40 29 54 42M27 55L40 67 53 55', glint:'M36 47H44',
    },
    red: {
      label:'Красный фонарик-капля', fill:'#fc846f', side:'#dc5b53', shine:'#ffccae',
      body:'M26 24Q33 19 40 18Q47 19 54 24Q69 33 69 50Q69 66 55 72Q40 77 25 72Q11 66 11 50Q11 33 26 24Z',
      strokes:'M23 47Q40 60 57 47M26 58Q40 68 54 58', glint:'M25 37Q29 32 35 30',
    },
    green: {
      label:'Зелёный фонарик с полосками', fill:'#a4df88', side:'#6faa73', shine:'#e3ffb9',
      body:'M24 20H56L69 32V61L57 73H23L11 61V32Z',
      strokes:'M25 29V64M40 28V66M55 29V64', glint:'M20 37V45',
    },
  };
  const icons = {
    play:'M9 5.5 20 12 9 18.5V5.5Z', arrow:'M5 12h13m-5-5 5 5-5 5',
    home:'m3 11 9-7 9 7m-3-2v11H6V9m4 11v-6h4v6',
    sound:'M3 10h4l5-4v12l-5-4H3zm12-2a5 5 0 0 1 0 8m2.5-10.5a8.5 8.5 0 0 1 0 13',
    mute:'M3 10h4l5-4v12l-5-4H3zm12-1 6 6m0-6-6 6',
    bulb:'M9 18h6m-5 3h4m1-6c0-1.8 3-2.5 3-6a6 6 0 1 0-12 0c0 3.5 3 4.2 3 6',
    check:'m5 12 4 4 10-10', star:'m12 3 2.5 5.5 6 1-4.3 4.1 1 6-5.2-2.8L6.8 19.6l1-6L3.5 9.5l6-1Z',
    remove:'M5 12h14', edit:'m5 16-1 4 4-1L20 7l-3-3zm10-10 3 3',
  };
  const icon = (name) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${icons[name]}"/></svg>`;
  const lamp = (id) => {
    const d = designs[id];
    if (!d) return `<svg class="lamp empty" viewBox="0 0 80 88" aria-hidden="true" focusable="false"><path d="M40 4v14M26 22Q40 15 54 22L65 34V57Q57 72 40 72T15 57V34Z" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="4 5" stroke-linecap="round"/><path d="M36 40c1-5 12-5 11 1-.4 3-6 4-6 8m0 7h.01" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/></svg>`;
    return `<svg class="lamp" viewBox="0 0 80 88" aria-hidden="true" focusable="false"><g stroke-linecap="round" stroke-linejoin="round"><path d="M40 3v15" stroke="#ceb5fa" stroke-width="3"/><path d="${d.body}" fill="${d.fill}" stroke="#292044" stroke-width="3.5"/><path d="${d.strokes}" stroke="${d.side}" fill="none" stroke-width="2.8"/><path d="${d.glint}" stroke="${d.shine}" fill="none" stroke-width="3.8"/><path d="M30 18h20l-3-5H33zM31 73h18v5H31z" fill="#fdf0bb" stroke="#39304e" stroke-width="2.6"/></g></svg>`;
  };
  const label = (id) => designs[id]?.label ?? 'пусто';
  const hero = () => `<svg class="firefly" viewBox="0 0 218 172" aria-hidden="true" focusable="false">
    <g stroke="#2e2550" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round">
      <path d="M115 81C101 45 135 17 161 25q21 7 11 32-13 26-57 36Z" fill="#9ae5cc"/>
      <path d="M105 86C91 51 65 30 44 41q-23 15 1 37 23 19 62 19Z" fill="#b8f1db"/>
      <path d="M139 54q7-14 21-18M76 71q-10-12-27-17" fill="none" stroke="#59ae9b"/>
      <path d="M113 97 Q142 92 153 117q10 27-23 36-33 8-48-12-10-14 .5-31Z" fill="#ffd36e"/>
      <path d="M105 105q3 23 32 36M126 99q4 17 24 25" fill="none" stroke="#df9c50" stroke-width="5"/>
      <path d="M91 119q8 13 28 17" fill="none" stroke="#ffecad" stroke-width="4"/>
      <path d="M71 87Q58 69 44 73m36-12Q79 39 64 31" fill="none"/>
      <circle cx="43" cy="73" r="4.5" fill="#ffd36e"/><circle cx="63" cy="31" r="4.5" fill="#ffd36e"/>
      <path d="M73 74Q96 60 117 72Q132 81 129 100Q128 123 103 126Q81 131 66 115Q51 102 58 88Q62 79 73 74Z" fill="#fff6e1"/>
      <path d="M77 98v3m31-5v3" stroke-width="4.7"/><path d="M89 109q5 5 10-1" fill="none"/>
      <path d="M69 107h4m39-3h5" stroke="#ee9389" stroke-width="3.8"/>
      <path d="M128 116q17-13 24-8m-59 17-13 8" fill="none"/>
    </g>
    <g fill="#ffeb9e"><path d="M186 82l2.8 7.2 7.2 2.8-7.2 2.8-2.8 7.2-2.8-7.2-7.2-2.8 7.2-2.8Z"/><circle cx="176" cy="123" r="2.6"/><circle cx="35" cy="113" r="3"/><path d="M32 41l1.6 4.4 4.4 1.6-4.4 1.6L32 53l-1.6-4.4-4.4-1.6 4.4-1.6Z"/></g>
  </svg>`;
  const hills = () => `<svg class="hills" viewBox="0 0 540 152" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <path fill="#3e3265" d="M0 81q90-46 181-7 58 24 118-5 122-59 241 17v66H0z"/>
    <path fill="#4d3a6d" d="M0 116q87-28 186 0 65 20 129-3 106-39 225 3v36H0z"/>
    <g fill="#67528b"><path d="m33 130 17-29 17 29zm447 4 15-28 15 28z"/><path d="m19 131 10-19 10 19zm491 7 10-18 10 18z"/></g>
    <g fill="#f7d996" opacity=".7"><circle cx="41" cy="32" r="1.7"/><circle cx="104" cy="25" r="2.2"/><circle cx="171" cy="58" r="1.6"/><circle cx="245" cy="26" r="1.3"/><circle cx="343" cy="31" r="1.7"/><circle cx="436" cy="20" r="2.4"/><circle cx="496" cy="50" r="1.7"/></g>
  </svg>`;
  return Object.freeze({icon,lamp,label,hero,hills});
})();
