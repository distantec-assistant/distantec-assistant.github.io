/**
 * Цифроград — original paper-cut railway world, drawn in SVG for this lab.
 * No assets, fonts, libraries, IDs, defs or external references are required.
 * The parent owns all text, quantities, controls and wrapper positioning.
 * Scene safe area: x=270…730, y=130…475 in the 1000×560 viewBox.
 */
const C = Object.freeze({
  paper: '#fff9ec', ink: '#244c45', sun: '#ffd763', sky: '#dff3f5',
  leaf: '#80c8a3', coral: '#fa947d', pale: '#e8f1dc', wood: '#edc38e',
  river: '#bee4e8', fox: '#edb178', bear: '#bd9675', white: '#fffdf6',
});
const SCENES = Object.freeze(['load', 'find', 'count', 'missing', 'neighbors', 'long', 'orders', 'sharing', 'bridge']);
const ANIMALS = Object.freeze(['rabbit', 'fox', 'bear']);
const MOODS = Object.freeze(['happy', 'thinking', 'win']);
const ITEMS = Object.freeze(['apple', 'cookie', 'carrot', 'box10', 'plank']);

// Exact numeric/dataset values only: do not stringify or interpolate user input.
function region(value) {
  return [1, 2, 3, 4, 5].find(n => value === n || value === `${n}`) ?? 1;
}
function member(values, value, fallback) {
  return values.includes(value) ? value : fallback;
}
function svg(viewBox, content) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" aria-hidden="true" focusable="false" fill="none" stroke="${C.ink}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">${content}</svg>`;
}
function at(x, y, scale, content, className = '') {
  return `<g${className ? ` class="${className}"` : ''} transform="translate(${x} ${y}) scale(${scale})">${content}</g>`;
}
function shadow(cx, cy, rx, ry = 8) {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${C.ink}" opacity=".08" stroke="none"/>`;
}
function cloud(x, y, scale = 1) {
  return at(x, y, scale, `<path d="M0 27Q-3 13 12 12Q16-5 34 3Q48-8 60 8Q79 5 80 27Z" fill="${C.white}" stroke="none"/>`);
}
function tree(x, y, scale = 1) {
  return at(x, y, scale, `<path d="M49 77L44 144H72L66 76" fill="${C.wood}"/><path d="M57 109L79 86"/><path d="M12 83C-5 68 4 47 20 44C12 25 31 8 48 17C57-2 85 4 89 24C113 21 126 42 116 58C132 80 107 102 90 93C78 110 50 106 44 95C29 105 14 98 12 83Z" fill="${C.leaf}"/><path d="M29 49Q35 30 51 35M81 44Q99 39 101 57" stroke="${C.paper}" stroke-width="5" opacity=".7"/>`);
}

function face(animal, mood) {
  const cheeks = `<ellipse class="art-cheek" cx="47" cy="99" rx="9" ry="5" fill="${C.coral}" stroke="none"/><ellipse class="art-cheek" cx="113" cy="99" rx="9" ry="5" fill="${C.coral}" stroke="none"/>`;
  const eyes = mood === 'win'
    ? '<path d="M53 83Q59 72 65 83M95 83Q101 72 107 83"/>'
    : `<ellipse cx="${mood === 'thinking' ? 62 : 59}" cy="81" rx="4" ry="5.5" fill="${C.ink}" stroke="none"/><ellipse cx="${mood === 'thinking' ? 104 : 101}" cy="81" rx="4" ry="5.5" fill="${C.ink}" stroke="none"/>${mood === 'thinking' ? '<path d="M53 66Q59 60 66 63M96 64L108 66" stroke-width="2.5"/>' : ''}`;
  const muzzle = animal === 'bear' ? `<ellipse cx="80" cy="104" rx="25" ry="20" fill="${C.paper}" stroke="none"/>` : '';
  const nose = `<path d="M73 96Q80 92 87 96Q89 99 80 104Q71 99 73 96Z" fill="${animal === 'rabbit' ? C.coral : C.ink}" stroke-width="2"/>`;
  const mouth = mood === 'win'
    ? `<path d="M69 108Q80 114 91 108Q90 124 80 124Q70 124 69 108Z" fill="${C.ink}" stroke-width="2"/><path d="M75 120Q80 115 85 120" stroke="${C.coral}"/>`
    : mood === 'thinking'
      ? '<path d="M80 103V109M80 109Q85 115 92 109" stroke-width="2.5"/>'
      : '<path d="M80 103V109M68 110Q73 118 80 111Q87 118 92 110" stroke-width="2.5"/>';
  return `${muzzle}${cheeks}${eyes}${nose}${mouth}`;
}
function friend(animal, mood = 'happy') {
  const fur = animal === 'fox' ? C.fox : animal === 'bear' ? C.bear : C.paper;
  const coat = animal === 'fox' ? C.sky : animal === 'bear' ? C.coral : C.leaf;
  const head = animal === 'rabbit'
    ? `<path d="M49 62C37 46 28 16 39 8Q50 1 57 21L70 57M91 57L100 20Q105 0 117 9C128 19 116 48 110 63" fill="${fur}"/><path d="M47 21L58 51M110 20L103 49" stroke="#edc1b1" stroke-width="7"/><path d="M40 65Q52 46 80 54Q108 46 120 65C136 94 126 128 80 132C34 128 24 94 40 65Z" fill="${fur}"/>`
    : animal === 'fox'
      ? `<path d="M39 66L29 20Q29 9 40 17L65 40Q80 35 95 40L120 17Q131 9 131 20L121 66" fill="${fur}"/><path d="M40 31L45 53L58 46M120 31L115 53L102 46" fill="${C.coral}" stroke="none"/><path d="M41 55Q80 35 119 55L124 80L140 93L125 102Q117 126 80 133Q43 126 35 102L20 93L36 80Z" fill="${fur}"/><path d="M31 93Q48 78 64 94L80 101L96 94Q112 78 129 93Q115 123 80 129Q45 123 31 93Z" fill="${C.paper}" stroke="none"/>`
      : `<circle cx="39" cy="38" r="20" fill="${fur}"/><circle cx="121" cy="38" r="20" fill="${fur}"/><circle cx="39" cy="38" r="10" fill="${C.wood}" stroke="none"/><circle cx="121" cy="38" r="10" fill="${C.wood}" stroke="none"/><path d="M30 73Q29 29 80 31Q131 29 130 73Q140 127 80 134Q20 127 30 73Z" fill="${fur}"/>`;
  const paws = mood === 'win'
    ? `<path d="M38 147Q18 143 11 124Q7 111 17 111Q23 111 27 124Q23 108 32 109Q40 111 40 128L46 141M122 147Q142 143 149 124Q153 111 143 111Q137 111 133 124Q137 108 128 109Q120 111 120 128L114 141" fill="${fur}"/>`
    : mood === 'thinking'
      ? `<path d="M115 157Q99 149 94 133Q89 124 96 119Q103 115 108 128L117 137Q129 136 129 145L125 157" fill="${fur}"/><path d="M33 157Q30 144 40 141Q49 139 51 157" fill="${fur}"/>`
      : `<path d="M31 157Q28 141 40 139Q52 138 54 157M106 157Q108 138 120 139Q132 141 129 157" fill="${fur}"/>`;
  return `<g class="art-friend art-friend-${animal}"><path d="M26 162Q27 126 56 122H104Q133 126 134 162Z" fill="${coat}"/>${head}<path d="M54 131L80 139L106 131L99 150L80 144L61 150Z" fill="${C.sun}" stroke-width="2.5"/><circle cx="80" cy="142" r="5" fill="${C.paper}" stroke-width="2.5"/>${face(animal, mood)}${paws}</g>`;
}

/** rabbit | fox | bear, and happy | thinking | win; defaults are rabbit/happy. */
export function portrait(kind, mood = 'happy') {
  const animal = member(ANIMALS, kind, 'rabbit');
  const feeling = member(MOODS, mood, 'happy');
  const tint = animal === 'rabbit' ? '#f7e9ba' : animal === 'fox' ? C.sky : '#e6ecd8';
  return svg('0 0 160 170', `<path d="M9 92Q6 25 80 20Q154 25 151 92Q151 162 80 164Q9 162 9 92Z" fill="${tint}" stroke="none"/>${friend(animal, feeling)}`);
}

function apple() {
  return `<g class="art-apple"><path d="M32 23Q31 15 36 8" stroke-width="4"/><path d="M35 18Q39 5 53 9Q52 23 35 21Z" fill="${C.leaf}" stroke-width="2.5"/><path d="M32 25C16 14 6 25 10 40C13 56 23 61 32 56C42 61 53 50 55 36C58 21 44 15 32 25Z" fill="${C.coral}" stroke-width="3"/><path d="M18 33Q19 28 24 29" stroke="${C.paper}" stroke-width="4"/></g>`;
}
function cookie() {
  return `<path d="M31 8Q39 5 45 13Q56 14 55 26Q63 33 55 42Q53 54 42 54Q34 63 25 56Q13 56 12 44Q4 36 11 27Q8 17 19 15Q21 7 31 8Z" fill="${C.sun}" stroke-width="3"/><path d="M17 28Q18 20 27 19" stroke="${C.paper}" stroke-width="4"/><path d="M29 24L34 22L37 28L31 32L27 28ZM43 34L48 36L46 42L40 40ZM22 40L27 43L24 49L18 46ZM34 47L39 47L39 53L33 53Z" fill="${C.ink}" stroke="none"/>`;
}
function carrot() {
  return `<path d="M38 23Q28 12 35 7Q43 5 45 20Q43 5 51 6Q58 9 50 22Q60 14 61 21Q60 28 49 28Z" fill="${C.leaf}" stroke-width="3"/><path d="M34 22Q39 18 47 26Q53 31 47 37L20 58Q11 64 13 53L29 28Z" fill="${C.fox}" stroke-width="3"/><path d="M32 29L38 34M25 39L31 44M19 49L23 52" stroke-width="2.5"/>`;
}
function box10() {
  let cells = '';
  for (let row = 0; row < 2; row++) {
    for (let column = 0; column < 5; column++) {
      const x = 12 + column * 32;
      const y = 7 + row * 37;
      cells += `<rect class="art-box-cell" x="${x}" y="${y}" width="30" height="35" rx="5" fill="${C.paper}" stroke="#caab7f" stroke-width="2"/>${at(x + 1, y + 2, .45, apple())}`;
    }
  }
  return `<g class="art-box10"><rect x="6" y="3" width="168" height="80" rx="9" fill="${C.wood}"/>${cells}<path d="M6 79H174V108Q174 115 166 115H14Q6 115 6 108Z" fill="${C.wood}"/><path d="M18 94H162" stroke="#c49d6d" stroke-width="2.5"/><path d="M67 79V115M113 79V115" stroke="#c49d6d" stroke-width="2.5"/><path d="M76 91H104V99H76Z" fill="${C.paper}" stroke-width="2.5"/></g>`;
}
function plank() {
  return `<path d="M6 24L52 13L59 39L13 51Z" fill="${C.wood}" stroke-width="3"/><path d="M13 32L47 24M19 42L50 34" stroke="#c49d6d" stroke-width="2.5"/><circle cx="16" cy="30" r="1.5" fill="${C.ink}" stroke="none"/><circle cx="48" cy="33" r="1.5" fill="${C.ink}" stroke="none"/>`;
}
/** Supported items: apple, cookie, carrot, box10 (ten apples), plank. */
export function item(kind = 'apple') {
  const selected = member(ITEMS, kind, 'apple');
  if (selected === 'box10') return svg('0 0 180 120', box10());
  const drawing = selected === 'cookie' ? cookie() : selected === 'carrot' ? carrot() : selected === 'plank' ? plank() : apple();
  return svg('0 0 64 64', drawing);
}

function wheel(x, y, radius = 16) {
  return `<circle cx="${x}" cy="${y}" r="${radius}" fill="${C.ink}"/><circle cx="${x}" cy="${y}" r="${radius * .48}" fill="${C.sun}" stroke="none"/><circle cx="${x}" cy="${y}" r="3" fill="${C.ink}" stroke="none"/>`;
}
function trainDrawing() {
  return `${shadow(250, 190, 239, 6)}
    <path d="M94 145H154M248 145H306" stroke-width="7"/>
    <path d="M17 109H123V151Q123 161 113 161H27Q17 161 17 151Z" fill="${C.leaf}"/>
    <path d="M12 108Q12 102 20 102H121Q129 102 129 108V116H12Z" fill="${C.paper}"/>
    <path d="M39 129V147M103 129V147" opacity=".45"/><path d="M58 140Q67 120 84 129Q83 147 62 145M62 145L78 132" fill="${C.paper}" stroke-width="2.5"/>
    <rect x="144" y="55" width="129" height="106" rx="18" fill="${C.sky}"/>
    <path d="M137 57Q133 43 151 42H265Q280 42 279 57Z" fill="${C.leaf}"/>
    <rect x="154" y="68" width="46" height="63" rx="13" fill="${C.paper}" stroke-width="3"/>
    <rect x="216" y="68" width="46" height="63" rx="13" fill="${C.paper}" stroke-width="3"/>
    ${at(156, 77, .265, friend('fox'))}${at(217, 77, .265, friend('bear'))}
    <path d="M154 132H199M216 132H261M154 145H260" stroke-width="3"/>
    <path class="art-steam art-steam-far" d="M418 24Q408 27 406 18Q404 8 415 7Q426 5 429 15Q431 24 418 24Z" fill="${C.white}" stroke="#accac4" stroke-width="2.5"/>
    <path class="art-steam" d="M401 44Q387 46 387 35Q385 25 398 25Q410 23 414 34Q416 44 401 44Z" fill="${C.white}" stroke="#accac4" stroke-width="2.5"/>
    <path d="M390 87V53H415V87" fill="${C.ink}"/><path d="M385 51H420V61H385Z" fill="${C.sun}"/>
    <path d="M289 155V58Q289 49 299 49H345Q356 49 356 60V89H438Q476 88 478 126V155Z" fill="${C.leaf}"/>
    <path d="M289 58Q289 49 299 49H345Q356 49 356 60V155H289Z" fill="${C.coral}"/>
    <path d="M281 50Q281 37 296 37H350Q365 37 365 50Z" fill="${C.ink}"/>
    <rect x="299" y="59" width="47" height="65" rx="12" fill="${C.paper}" stroke-width="3"/>
    ${at(299, 62, .29, friend('rabbit'))}
    <path d="M297 126H347M300 140H343" stroke-width="3"/>
    <path d="M364 99H433" stroke="${C.paper}" stroke-width="5" opacity=".7"/>
    <ellipse cx="429" cy="118" rx="3.5" ry="5" fill="${C.ink}" stroke="none"/>
    <ellipse cx="454" cy="118" rx="3.5" ry="5" fill="${C.ink}" stroke="none"/>
    <ellipse class="art-cheek" cx="420" cy="132" rx="6" ry="4" fill="${C.coral}" stroke="none"/>
    <ellipse class="art-cheek" cx="464" cy="132" rx="6" ry="4" fill="${C.coral}" stroke="none"/>
    <path d="M433 134Q442 145 451 134" stroke-width="3"/>
    <path d="M282 153H478V164H282Z" fill="${C.ink}"/><path d="M477 141L495 163H476Z" fill="${C.sun}"/>
    ${wheel(40, 167, 15)}${wheel(105, 167, 15)}${wheel(167, 167, 16)}${wheel(250, 167, 16)}
    ${wheel(318, 165, 21)}${wheel(392, 165, 21)}${wheel(455, 166, 17)}
    <path d="M318 165H392" stroke="${C.paper}" stroke-width="5"/>
    <circle cx="318" cy="165" r="4" fill="${C.ink}" stroke="none"/><circle cx="392" cy="165" r="4" fill="${C.ink}" stroke="none"/>`;
}
/** The same right-facing, family-operated train is used throughout the world. */
export function train() {
  return svg('0 0 500 200', trainDrawing());
}

function landmarkDrawing(stage) {
  if (stage === 2) return `${shadow(90, 148, 80)}
    <path d="M65 69L58 145H124L114 65" fill="${C.wood}"/>
    <path d="M26 83Q4 73 14 52Q8 29 33 28Q35 5 60 13Q74-3 94 13Q118-2 133 19Q161 12 166 39Q185 52 168 74Q156 99 131 90Q108 109 88 92Q65 108 45 91Q31 99 26 83Z" fill="${C.leaf}"/>
    <path d="M80 146V111Q80 94 94 94Q108 94 108 111V146Z" fill="${C.coral}"/>
    <circle cx="100" cy="121" r="2" fill="${C.ink}" stroke="none"/>
    <path d="M59 147H126M66 153H119" stroke="${C.wood}" stroke-width="5"/>
    <path d="M70 65Q70 48 87 48Q104 48 104 65V78H70Z" fill="${C.paper}"/><path d="M87 51V76M72 65H101" stroke-width="2.5"/>
    <path d="M31 48Q37 32 50 36M120 38Q139 30 144 47" stroke="${C.paper}" stroke-width="5" opacity=".7"/>`;
  if (stage === 3) return `${shadow(90, 149, 82)}
    <path d="M17 82H58V144H17Z" fill="${C.wood}"/><path d="M124 66H161V144H124Z" fill="${C.leaf}"/>
    <path d="M15 81L38 59L61 81M121 65L143 43L165 65" fill="${C.coral}"/>
    <path d="M51 54H130V145H51Z" fill="${C.paper}"/>
    <path d="M44 56L91 29L138 56Z" fill="${C.coral}"/>
    <path d="M75 34V16Q91 0 107 16V34" fill="${C.sun}"/>
    <circle cx="91" cy="65" r="18" fill="${C.sky}"/><path d="M91 54V66L100 70" stroke-width="2.5"/>
    <path d="M75 145V112Q75 94 91 94Q107 94 107 112V145Z" fill="${C.leaf}"/>
    <path d="M29 97H43V115H29ZM135 83H150V103H135Z" fill="${C.sky}" stroke-width="2.5"/>
    <path d="M9 146H171" stroke-width="5"/>`;
  if (stage === 4) return `${shadow(90, 149, 83)}
    <path d="M20 59H160V144H20Z" fill="${C.coral}"/>
    <path d="M12 60L46 35L68 49L101 27L129 48L164 34V60Z" fill="${C.sun}"/>
    <path d="M40 144V89Q40 73 56 73H123Q140 73 140 89V144Z" fill="${C.leaf}"/>
    <path d="M90 76V143M44 108H136" stroke-width="2.5"/>
    <rect x="55" y="85" width="23" height="16" rx="4" fill="${C.sky}" stroke-width="2.5"/>
    <rect x="102" y="85" width="23" height="16" rx="4" fill="${C.sky}" stroke-width="2.5"/>
    <path d="M135 12Q143 7 151 12L141 20L146 28L158 24Q158 37 147 40L129 59Q125 63 120 58Q117 54 122 49L138 31Q130 22 135 12Z" fill="${C.paper}" stroke-width="3"/>
    <path d="M52 153L60 144M128 153L120 144M10 146H170" stroke-width="4"/>`;
  if (stage === 5) return `${shadow(90, 149, 85)}
    <path d="M7 118L52 20Q57 8 64 20L106 116Z" fill="${C.leaf}"/>
    <path d="M73 117L119 8Q124-1 130 10L174 118Z" fill="${C.river}"/>
    <path d="M43 40L56 16Q60 10 64 19L76 43L63 36L57 43L51 36ZM108 37L120 10Q124 2 130 13L143 43L129 34L121 40L116 33Z" fill="${C.paper}" stroke-width="2.5"/>
    <path d="M85 116Q96 133 90 158H131Q133 134 117 115Z" fill="${C.river}" stroke="none"/>
    <path d="M12 111H168V138H155V128Q155 119 143 119Q132 119 132 128V138H113V128Q113 119 101 119Q90 119 90 128V138H71V128Q71 119 59 119Q48 119 48 128V138H29V128Q29 119 17 119H12Z" fill="${C.coral}"/>
    <path d="M10 107H170M100 150H120" stroke-width="3"/>`;
  return `${shadow(90, 148, 81)}
    <path d="M30 82H149V142H30Z" fill="${C.leaf}"/>
    <path d="M21 83Q13 73 27 66L75 47Q91 40 106 47L154 66Q168 73 159 83Z" fill="${C.sun}"/>
    <path d="M69 142V109Q69 88 90 88Q111 88 111 109V142Z" fill="${C.coral}"/>
    <path d="M43 98H58V116H43ZM122 98H137V116H122Z" fill="${C.sky}" stroke-width="2.5"/>
    <path d="M85 46L72 34Q65 24 78 23Q70 7 84 8Q92-4 99 8Q115 4 111 20Q126 22 115 34L101 46Z" fill="${C.sun}"/>
    <circle cx="93" cy="27" r="13" fill="${C.paper}" stroke-width="2.5"/>
    <path d="M20 143H160M85 143V151M98 143V151" stroke-width="4"/>`;
}
/** Small station-button picture, with no interactive or textual content. */
export function landmark(stageId = 1) {
  return svg('0 0 180 160', landmarkDrawing(region(stageId)));
}

const MAP_STOPS = Object.freeze([
  { stage: 1, x: 75, y: 250, stopX: 165, stopY: 465, trainX: 200, trainY: 397 },
  { stage: 2, x: 280, y: 35, stopX: 370, stopY: 235, trainX: 320, trainY: 167 },
  { stage: 3, x: 590, y: 25, stopX: 680, stopY: 235, trainX: 620, trainY: 167 },
  { stage: 4, x: 950, y: 140, stopX: 1040, stopY: 365, trainX: 911, trainY: 297 },
  { stage: 5, x: 665, y: 295, stopX: 755, stopY: 485, trainX: 492, trainY: 417 },
]);
// Flat station approaches keep every wheel on the railway, even in small UI.
const MAP_ROUTE = 'M165 465C6 427 17 257 205 238Q262 235 330 235H875C963 235 1022 264 1090 320Q1135 357 1100 365H910C891 365 931 426 900 449Q880 485 850 485H435Q410 485 395 465H165';
/** Decorative five-region railway. Station selection belongs to HTML buttons. */
export function worldMap(stageId = 1) {
  const selected = region(stageId);
  const stop = MAP_STOPS[selected - 1];
  return svg('0 0 1200 560', `
    <path d="M33 205Q14 81 173 64L315 32Q450 7 583 37Q720-7 854 49Q1005 38 1108 145Q1192 211 1160 342Q1191 478 1019 511Q848 560 665 525Q466 569 320 508Q127 520 69 426Q4 335 33 205Z" fill="${C.sky}" stroke="none"/>
    <path d="M42 354Q65 259 181 252Q288 257 327 368Q348 466 229 486Q89 492 42 419Z" fill="#edf0d0" stroke="none"/>
    <path d="M224 148Q204 45 338 27Q476 12 507 115Q518 224 371 239Q251 238 224 148Z" fill="#c9e5cd" stroke="none"/>
    <path d="M524 104Q535 13 685 22Q847 6 869 115Q854 230 681 231Q528 235 524 104Z" fill="#f6e5c4" stroke="none"/>
    <path d="M863 236Q864 117 1008 125Q1154 128 1164 258Q1156 365 1001 365Q866 354 863 236Z" fill="#f9ddcd" stroke="none"/>
    <path d="M577 400Q587 291 753 289Q925 297 938 417Q924 528 751 531Q588 528 577 400Z" fill="#cce9df" stroke="none"/>
    <path d="M820 331Q799 390 836 425Q865 455 857 524" stroke="${C.river}" stroke-width="30"/>
    ${cloud(66, 108, 1.2)}${cloud(988, 59, .9)}${cloud(455, 284, .75)}
    <path d="${MAP_ROUTE}" stroke="${C.wood}" stroke-width="24" stroke-dasharray="3 14"/>
    <path class="art-map-track" d="${MAP_ROUTE}" stroke="${C.ink}" stroke-width="14"/>
    <path d="${MAP_ROUTE}" stroke="${C.paper}" stroke-width="8"/>
    <ellipse class="art-map-selected" cx="${stop.x + 90}" cy="${stop.y + 101}" rx="103" ry="77" fill="${C.sun}" opacity=".65" stroke="none"/>
    ${MAP_STOPS.map(s => at(s.x, s.y, 1, landmarkDrawing(s.stage), 'art-map-landmark')).join('')}
    ${MAP_STOPS.map(s => `<circle class="art-map-stop" cx="${s.stopX}" cy="${s.stopY}" r="10" fill="${s.stage === selected ? C.sun : C.paper}" stroke-width="3"/>`).join('')}
    ${at(stop.trainX, stop.trainY, .37, trainDrawing(), 'art-map-train')}
  `);
}

function landscape(stage) {
  const ground = [C.pale, '#e0efdf', '#f2ead7', '#f6e7d7', '#e1eee1'][stage - 1];
  const distance = ['#eef3dc', '#cbe4cf', '#ece9d8', '#f3dfc5', '#cce5dd'][stage - 1];
  return `<path d="M0 0H1000V560H0Z" fill="${C.paper}" stroke="none"/>
    <path d="M0 0H1000V249Q835 220 717 242Q476 280 301 239Q135 216 0 255Z" fill="${C.sky}" stroke="none"/>
    <path d="M0 212Q133 173 254 214Q466 269 672 217Q849 170 1000 214V560H0Z" fill="${distance}" stroke="none"/>
    <path d="M0 330Q119 288 264 321Q499 356 731 320Q893 291 1000 328V560H0Z" fill="${ground}" stroke="none"/>
    ${cloud(434, 48, 1.05)}<circle cx="684" cy="66" r="25" fill="${C.sun}" stroke="none"/>`;
}
function route(bridge = false) {
  const path = bridge ? 'M0 520H233M766 520H1000' : 'M0 520Q128 504 245 520M755 520Q882 504 1000 520';
  return `<path d="${path}" stroke="${C.wood}" stroke-width="17" stroke-dasharray="2 19"/><path d="${path}" stroke="${C.ink}" stroke-width="8"/><path d="${path}" stroke="${C.paper}" stroke-width="3"/>`;
}
function regionEdges(stage) {
  const left = at(25, 94, 1.13, landmarkDrawing(stage));
  if (stage === 2) return `${left}${tree(843, 108, 1.25)}`;
  if (stage === 3) return `${left}<path d="M817 265V178H870V142L901 120L934 142V207H982V265Z" fill="#edd3b6"/><path d="M832 199H853V222H832ZM886 161H907V184H886ZM948 227H969V250H948Z" fill="${C.sky}" stroke-width="2.5"/>`;
  if (stage === 4) return `${left}<path d="M813 263V176L855 146L896 176V263M904 263V198L944 171L985 198V263" fill="#f2cfb6"/><path d="M830 219H883M924 226H970" stroke-width="4"/>`;
  if (stage === 5) return `${left}<path d="M789 275L855 99Q861 85 869 102L934 275M862 275L936 149Q942 138 949 151L1000 275" fill="#b6d7cb"/><path d="M840 140L859 97L878 140L865 132L856 142L850 133" fill="${C.paper}" stroke-width="2.5"/>`;
  return `${left}${tree(864, 140, .9)}<path d="M802 260Q796 224 813 213Q829 204 838 224Q850 238 841 260Z" fill="${C.leaf}"/>`;
}
function bench() {
  return `<path d="M32 408H219V428H32ZM48 380H204V399H48Z" fill="${C.wood}"/><path d="M49 431L42 466M201 431L208 466M60 400V408M192 400V408" stroke-width="5"/>`;
}
function satchel() {
  return `<path d="M65 419Q65 398 87 398Q109 398 109 419" stroke-width="5"/><rect x="51" y="418" width="72" height="53" rx="12" fill="${C.sun}"/><path d="M52 435Q86 448 122 435M86 437V451" stroke-width="3"/>`;
}
function basicScene(kind, stage) {
  let foreground;
  if (kind === 'load') foreground = `${at(4, 366, .49, trainDrawing())}${at(815, 322, .95, friend('rabbit'))}`;
  else if (kind === 'find') foreground = `${bench()}${satchel()}${at(820, 327, .93, friend('fox'))}<path d="M805 411L861 395L870 417L814 433Z" fill="${C.sun}"/><path d="M801 410L814 406L824 434L811 438Z" fill="${C.leaf}"/>`;
  else if (kind === 'count') foreground = `${bench()}${at(58, 324, .78, friend('rabbit'))}${at(815, 315, .98, friend('bear'))}<path d="M832 466H967L959 488H841Z" fill="${C.wood}"/>`;
  else if (kind === 'missing') foreground = `${at(40, 333, .86, friend('rabbit', 'thinking'))}<path d="M888 328V485M857 485H919" stroke-width="7"/><rect x="856" y="319" width="65" height="56" rx="22" fill="${C.sun}"/><path d="M880 336L899 347L880 358" stroke-width="4"/>`;
  else if (kind === 'neighbors') foreground = `${at(40, 330, .9, friend('rabbit'))}${at(815, 330, .9, friend('fox'))}<path d="M25 484H237M799 484H980" stroke="${C.wood}" stroke-width="7"/>`;
  else foreground = `${at(2, 370, .5, trainDrawing())}${at(825, 324, .92, friend('bear'))}<path d="M814 472H968V489H814Z" fill="${C.sun}"/><path d="M834 473V480M859 473V480M884 473V480M909 473V480M934 473V480" stroke-width="2.5"/>`;
  return `${regionEdges(stage)}${route()}${foreground}`;
}
function cafeScene(stage) {
  return `<g class="art-cafe">
    ${at(821, 74, .85, landmarkDrawing(stage))}
    <path d="M26 173H240V423H26Z" fill="${C.wood}"/>
    <path d="M34 174H233V420H34Z" fill="${C.paper}" stroke="none"/>
    <rect x="51" y="207" width="72" height="76" rx="16" fill="${C.sky}"/><path d="M87 211V280M54 244H120" stroke-width="3"/>
    <path d="M146 423V235Q146 211 171 211Q196 211 196 235V423" fill="${C.leaf}"/>
    <path d="M15 173L36 122H225L251 173Z" fill="${C.paper}"/>
    <path d="M37 123H72L60 173H16M106 123H141V173H95M175 123H209L234 173H188" fill="${C.coral}" stroke="none"/>
    <path d="M15 173H251V188Q230 204 211 188Q190 204 171 188Q150 204 131 188Q110 204 91 188Q70 204 51 188Q31 204 15 188Z" fill="${C.sun}"/>
    <path d="M87 121V102H179V121" fill="${C.leaf}"/>
    ${at(104, 47, .85, apple())}
    ${at(58, 296, .97, friend('rabbit'))}
    <rect x="20" y="423" width="229" height="26" rx="9" fill="${C.coral}"/>
    <path d="M38 449V482M230 449V482" stroke-width="7"/>
    ${tree(855, 235, .94)}${at(788, 373, 1.05, box10())}
    ${route()}
  </g>`;
}
function picnicScene(stage) {
  return `<g class="art-picnic">${at(25, 78, 1.08, landmarkDrawing(stage))}
    <path d="M795 231Q810 160 890 144Q970 157 990 231Q959 220 941 233Q911 220 890 234Q864 219 841 233Q818 220 795 231Z" fill="${C.sun}"/>
    <path d="M841 232Q853 169 890 145Q927 170 941 232" fill="${C.coral}"/><path d="M891 235V342" stroke-width="6"/>
    <path d="M12 473L237 468L260 548H0ZM783 470L977 466L1000 544H758Z" fill="${C.paper}" stroke="#c4d9bd" stroke-width="3"/>
    <path d="M24 494H244M12 522H251M788 493H987M777 522H994M57 474L48 545M104 473L101 546M150 472L157 546M831 472L821 544M879 470L881 545M925 468L942 546" stroke="#c4e0c8" stroke-width="9"/>
    ${at(13, 311, .77, friend('rabbit'))}${at(125, 325, .72, friend('fox'))}${at(812, 310, .98, friend('bear'))}
    <path d="M35 478Q35 460 55 460H115Q135 460 135 478L127 515H44Z" fill="${C.wood}"/><path d="M54 459Q54 426 84 426Q114 426 114 459M40 483H129M47 499H126" stroke-width="4"/>
  </g>`;
}
function bridgeScene(stage) {
  return `<g class="art-river-build">${at(805, 70, .95, landmarkDrawing(stage))}
    <path d="M425 255Q382 352 348 560H685Q655 375 569 255Z" fill="${C.river}" stroke="none"/>
    <path d="M0 340Q143 313 241 345L260 560H0ZM1000 338Q865 315 775 346L745 560H1000Z" fill="#c7e1c8" stroke="none"/>
    <rect class="art-crane-tower" x="58" y="217" width="28" height="247" fill="${C.sun}"/>
    <path d="M54 217H227L223 237H86Z" fill="${C.sun}"/>
    <path d="M214 238V290"/>
    <path d="M58 275L86 247M58 324L86 295M58 373L86 344M58 422L86 393M86 217L137 237L180 217L223 237" stroke-width="3"/>
    <path d="M214 290Q214 305 226 305Q239 304 238 294" stroke-width="4"/>
    ${at(115, 336, .79, friend('bear'))}
    <path d="M223 453V503M242 453V503M756 453V503M777 453V503" stroke="${C.wood}" stroke-width="10"/>
    <path d="M208 453H251M748 453H792" stroke-width="5"/>
    ${at(822, 420, 1.28, plank())}${at(865, 439, 1.28, plank())}
    <path d="M795 504Q846 494 891 503M411 539Q438 533 466 539M582 514Q609 521 634 514" stroke="${C.paper}" stroke-width="5"/>
    ${route(true)}
  </g>`;
}
/** Quiet regional scene; the middle is reserved for actual task objects/HTML. */
export function scene(kind, stageId = 1) {
  const selected = member(SCENES, kind, 'load');
  const stage = region(stageId);
  const drawing = selected === 'orders' ? cafeScene(stage)
    : selected === 'sharing' ? picnicScene(stage)
      : selected === 'bridge' ? bridgeScene(stage)
        : basicScene(selected, stage);
  return svg('0 0 1000 560', `${landscape(stage)}${drawing}`);
}
