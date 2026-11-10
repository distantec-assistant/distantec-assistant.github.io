/*
 * Цифроград · мастерская иллюстраций.
 * Original SVG artwork drawn for this prototype: no stock, libraries, remote
 * resources, generated images or reused character artwork. The family game's
 * cream / coral / mint / honey / blue palette is the visual reference.
 *
 * All exports return decorative, self-contained markup. No IDs or <defs> are
 * needed, so any asset can safely appear more than once on the same page.
 */

const ink = '#574967';
const cream = '#fff8ed';
const coral = '#ee7973';
const mint = '#83c9ad';
const honey = '#f2c45f';
const blue = '#8eafe2';

function svg(viewBox, content, extra = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" aria-hidden="true" focusable="false" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" ${extra}>${content}</svg>`;
}

const cafe = `
  <path d="M0 355C123 319 204 349 300 366C509 404 713 312 1000 345V560H0Z" fill="#f0f0da" stroke="none"/>
  <path d="M0 451C188 418 291 442 397 462C603 500 794 411 1000 432V560H0Z" fill="#f7e8ce" stroke="none"/>
  <path d="M696 84C706 66 726 69 731 82C746 73 762 84 760 97H687C684 89 689 84 696 84Z" fill="#fffdf7" stroke="none"/>
  <circle cx="902" cy="91" r="29" fill="#f8dda0" stroke="none"/>

  <ellipse cx="141" cy="449" rx="128" ry="15" fill="${ink}" opacity=".07" stroke="none"/>
  <path d="M31 137H256V406Q256 421 241 421H46Q31 421 31 406Z" fill="#f8e2c7"/>
  <path d="M46 159H241V402H46Z" fill="#fff0db" stroke="none"/>
  <path d="M188 218Q188 207 199 207H229V419H188Z" fill="${mint}"/>
  <path d="M199 222H218V303H199Z" fill="#d9edeb" stroke-width="3"/>
  <path d="M204 229L213 238M204 240L213 249" stroke="#fffdf7" stroke-width="4"/>
  <circle cx="218" cy="339" r="3" fill="${ink}" stroke="none"/>
  <rect x="57" y="205" width="105" height="99" rx="13" fill="${blue}"/>
  <path d="M68 220Q68 216 73 216H146Q151 216 151 221V288H68Z" fill="#dceeee" stroke="none"/>
  <path d="M109 207V302M59 254H159" stroke-width="4"/>
  <path d="M77 229L89 217M126 240L146 220" stroke="#fffdf7" stroke-width="6"/>
  <path d="M50 307H170V317H50Z" fill="${mint}" stroke-width="3"/>
  <path d="M32 166H256V178H32Z" fill="#ddbb9e" stroke="none"/>

  <path d="M15 132L39 94H247L272 132Z" fill="${cream}"/>
  <path d="M39 94H75L61 132H15ZM110 94H145V132H98ZM181 94H216L232 132H185ZM247 94L272 132H262L238 94Z" fill="${coral}" stroke="none"/>
  <path d="M15 132H58V147Q37 167 15 147Z" fill="${coral}"/>
  <path d="M58 132H101V147Q79 167 58 147Z" fill="${cream}"/>
  <path d="M101 132H144V147Q122 167 101 147Z" fill="${coral}"/>
  <path d="M144 132H187V147Q165 167 144 147Z" fill="${cream}"/>
  <path d="M187 132H230V147Q208 167 187 147Z" fill="${coral}"/>
  <path d="M230 132H272V147Q251 167 230 147Z" fill="${cream}"/>
  <path d="M15 132L39 94H247L272 132M15 132H272"/>
  <path d="M102 74H182" stroke="#d7b28d" stroke-width="9"/>
  <path d="M125 72V57Q125 50 132 50H151Q158 50 158 57V72" fill="${cream}" stroke-width="3"/>
  <path d="M158 56H164Q174 56 174 64Q174 72 158 69" stroke-width="3"/>

  <path d="M62 398L57 454M139 398L145 454" stroke="#9b7b68" stroke-width="7"/>
  <ellipse cx="101" cy="394" rx="57" ry="15" fill="${honey}"/>
  <path d="M84 383V363Q84 358 89 358H106Q111 358 111 363V383Z" fill="${cream}" stroke-width="3"/>
  <path d="M111 364H116Q124 364 124 372Q124 380 111 378" stroke-width="3"/>
  <path d="M71 387H123" stroke="#c89b48" stroke-width="3"/>

  <ellipse cx="881" cy="462" rx="94" ry="13" fill="${ink}" opacity=".07" stroke="none"/>
  <path d="M815 346L803 455M941 346L952 455" stroke="#9b7b68" stroke-width="8"/>
  <path d="M804 351H952V374H804Z" fill="${mint}"/>
  <path d="M817 376H939V413H817Z" fill="#f4d594"/>
  <path d="M835 382V406M859 382V406M883 382V406M907 382V406M931 382V406" stroke="#d7b479" stroke-width="3"/>
  <path d="M795 345Q795 336 805 336H951Q961 336 961 345V351H795Z" fill="${honey}"/>
  <path d="M829 335V323Q829 316 836 316H876Q883 316 883 323V335" fill="${cream}" stroke-width="3"/>
  <path d="M897 335V323Q897 316 904 316H929Q936 316 936 323V335" fill="${cream}" stroke-width="3"/>
  <path d="M916 292L920 270M916 290Q894 287 894 271Q910 266 916 290ZM920 280Q921 258 938 257Q945 273 920 280Z" fill="${mint}" stroke-width="3"/>
  <path d="M900 292H933L928 316H905Z" fill="${coral}" stroke-width="3"/>
  <path d="M31 492Q83 482 126 490M866 503Q903 496 935 502" stroke="#dfcda9" stroke-width="4"/>
`;

const picnic = `
  <path d="M0 347C153 311 212 360 355 371C544 386 787 317 1000 350V560H0Z" fill="#e6efda" stroke="none"/>
  <path d="M0 442C206 399 335 474 523 461C731 447 838 427 1000 452V560H0Z" fill="#d4e8ce" stroke="none"/>
  <path d="M637 79C646 61 665 62 674 77C690 70 704 79 704 91H625Q622 80 637 79Z" fill="#fffdf7" stroke="none"/>

  <ellipse cx="118" cy="440" rx="102" ry="16" fill="${ink}" opacity=".07" stroke="none"/>
  <path d="M104 218L99 405Q97 417 85 427H153Q139 414 137 402L131 217Z" fill="#d8aa78"/>
  <path d="M115 323L72 235M128 291L165 217" stroke="#b88b61" stroke-width="9"/>
  <path d="M115 406L116 352" stroke="#ba8c62" stroke-width="4"/>
  <path d="M33 230C7 232 -4 205 9 182C-8 157 8 127 34 125C28 99 54 75 80 83C93 56 130 56 145 80C174 64 207 82 206 111C236 112 251 140 238 163C260 188 244 216 222 219C216 246 184 255 164 240C142 261 108 258 94 241C71 254 42 249 33 230Z" fill="${mint}"/>
  <path d="M17 202C40 214 61 215 79 204C105 225 136 224 158 207C184 221 216 216 237 196C238 207 231 217 222 219C216 246 184 255 164 240C142 261 108 258 94 241C71 254 42 249 33 230C23 231 15 222 17 202Z" fill="#6bb798" stroke="none"/>
  <path d="M48 150Q44 131 62 122M125 100Q144 94 153 110M188 146Q203 150 201 167" stroke="#addbc1" stroke-width="7"/>

  <path d="M34 466Q32 453 46 450H146Q159 453 157 466L149 507Q147 515 139 515H53Q44 515 43 507Z" fill="${honey}"/>
  <path d="M58 450Q57 417 93 417Q130 417 132 450" stroke="#9f7b56" stroke-width="9"/>
  <path d="M58 450Q57 417 93 417Q130 417 132 450" stroke="#f7d998" stroke-width="4"/>
  <path d="M35 465H156M48 480H151M51 496H148M68 467L72 511M96 467V513M125 467L121 511" stroke="#d2a64e" stroke-width="3"/>
  <path d="M58 449L77 433L96 449L115 433L139 450" fill="${cream}" stroke="none"/>
  <path d="M34 466Q32 453 46 450H146Q159 453 157 466"/>

  <ellipse cx="866" cy="479" rx="125" ry="17" fill="${ink}" opacity=".05" stroke="none"/>
  <path d="M759 422L925 407L989 486L803 508Z" fill="${cream}" stroke="#cbbba8" stroke-width="3"/>
  <path d="M789 419L818 416L868 501L837 505ZM848 414L878 411L932 493L901 497Z" fill="#b8ddcc" stroke="none"/>
  <path d="M773 441L940 425L953 441L786 458ZM798 478L971 460L983 477L810 496Z" fill="#b8ddcc" stroke="none"/>
  <path d="M759 422L925 407L989 486L803 508Z" stroke="#a7bdab" stroke-width="3"/>

  <path d="M874 196V415" stroke="#9b7b68" stroke-width="7"/>
  <path d="M762 198Q785 120 874 112Q962 121 986 198Q951 185 929 201Q901 187 874 202Q846 187 818 201Q793 186 762 198Z" fill="${coral}"/>
  <path d="M818 201Q827 139 874 112Q920 141 929 201Q901 187 874 202Q846 187 818 201Z" fill="#f7cf83"/>
  <path d="M874 112V202" stroke="#d7a669" stroke-width="3"/>
  <path d="M874 112V103" stroke-width="5"/>
  <path d="M818 201V210M929 201V210" stroke="#dfb166" stroke-width="4"/>
  <path d="M846 418V375Q846 366 854 366H869Q878 366 878 375V418Z" fill="${blue}" stroke-width="3"/>
  <path d="M850 367V357H874V367" fill="${cream}" stroke-width="3"/>
  <path d="M848 390H876" stroke="#c7dbf2" stroke-width="6"/>
  <path d="M897 434V413H921V434Q909 442 897 434Z" fill="${coral}" stroke-width="3"/>
  <path d="M921 417H926Q935 417 935 424Q935 432 921 430" stroke-width="3"/>
  <path d="M209 480Q222 471 235 479M698 516Q714 508 727 514" stroke="#b2cfa9" stroke-width="4"/>
`;

const river = `
  <path d="M0 250C118 213 203 239 282 257C398 282 456 229 555 244C693 265 854 217 1000 247V560H0Z" fill="#edf1dd" stroke="none"/>
  <path d="M483 259C431 307 438 354 407 411C379 466 370 519 351 560H740C724 497 678 467 663 414C644 354 605 303 573 259Z" fill="#d6eae9" stroke="none"/>
  <path d="M483 259C431 307 438 354 407 411C379 466 370 519 351 560M573 259C605 303 644 354 663 414C678 467 724 497 740 560" stroke="#b4d8d2" stroke-width="4"/>
  <path d="M480 347Q515 338 551 346M534 468Q572 477 609 467M438 526Q464 520 490 524M591 531Q619 536 648 529" stroke="#f5fbf5" stroke-width="8"/>
  <path d="M0 342C137 317 224 334 362 351C406 357 422 367 412 397C389 457 375 505 365 560H0Z" fill="#cfe4c7" stroke="none"/>
  <path d="M1000 337C866 314 775 333 670 351C632 358 637 377 653 407C685 462 707 507 722 560H1000Z" fill="#cfe4c7" stroke="none"/>
  <path d="M0 342C137 317 224 334 362 351C406 357 422 367 412 397C389 457 375 505 365 560M1000 337C866 314 775 333 670 351C632 358 637 377 653 407C685 462 707 507 722 560" stroke="#99c7b0" stroke-width="4"/>
  <path d="M0 502C147 472 242 491 364 525L357 560H0ZM1000 493C881 474 803 498 714 531L722 560H1000Z" fill="#c1ddbb" stroke="none"/>
  <path d="M700 81C710 64 732 66 737 82C752 73 770 84 768 96H691Q687 83 700 81Z" fill="#fffdf7" stroke="none"/>
  <circle cx="118" cy="98" r="29" fill="#f8dda0" stroke="none"/>

  <ellipse cx="132" cy="401" rx="92" ry="12" fill="${ink}" opacity=".06" stroke="none"/>
  <path d="M71 377L76 361Q80 352 90 352H115Q124 353 130 362L140 378Z" fill="#d9d4c6" stroke-width="3"/>
  <path d="M91 353L99 368L129 363" stroke="#eee8da" stroke-width="3"/>
  <path d="M155 379Q150 344 156 322M156 362Q139 345 137 331M157 354Q172 335 173 324" stroke="#649d7d" stroke-width="5"/>
  <path d="M138 331Q127 320 128 308Q143 309 146 326ZM173 324Q173 307 186 304Q192 316 179 328Z" fill="${mint}" stroke-width="3"/>
  <path d="M224 363V327Q224 323 229 323H237Q242 323 242 327V365" fill="#d9af7e" stroke-width="3"/>
  <path d="M221 365H246" stroke="#f7dfb2" stroke-width="5"/>

  <ellipse cx="841" cy="491" rx="108" ry="13" fill="${ink}" opacity=".06" stroke="none"/>
  <path d="M791 478Q782 443 786 419M790 459Q813 439 811 416M785 445Q769 434 767 416" stroke="#679d7d" stroke-width="5"/>
  <path d="M784 427V402M811 424L815 398M767 423L763 403" stroke="#b69267" stroke-width="9"/>
  <path d="M844 476Q852 458 872 459Q888 457 899 475Z" fill="#d8d2c0" stroke-width="3"/>
  <path d="M862 465L874 469" stroke="#f7efdc" stroke-width="4"/>
  <path d="M757 363V327Q757 323 762 323H770Q775 323 775 327V365" fill="#d9af7e" stroke-width="3"/>
  <path d="M754 365H779" stroke="#f7dfb2" stroke-width="5"/>

  <path d="M41 479L171 463L180 477L48 495Z" fill="#d9af7e" stroke-width="3"/>
  <path d="M54 491L181 477L189 490L61 506Z" fill="#e8c494" stroke-width="3"/>
  <path d="M60 473L66 487M146 468L153 481M74 489L81 501M159 480L165 494" stroke="#ba8c60" stroke-width="3"/>
  <path d="M232 461Q247 453 262 459M889 379Q908 370 925 377" stroke="#9cc396" stroke-width="4"/>
`;

/** Quiet scenery; leave the middle open for the parent's foreground UI. */
export function scene(kind) {
  const content = kind === 'sharing' ? picnic : kind === 'bridge' ? river : cafe;
  return svg('0 0 1000 560', `<path d="M0 0H1000V560H0Z" fill="${cream}" stroke="none"/>${content}`, 'preserveAspectRatio="xMidYMid slice"');
}

function expression(kind, mood) {
  const bear = kind === 'bear';
  const fox = kind === 'fox';
  const left = bear ? 58 : fox ? 57 : 60;
  const right = bear ? 102 : fox ? 103 : 101;
  const eyeY = bear ? 78 : fox ? 76 : 84;
  const noseY = bear ? 98 : fox ? 96 : 101;
  const cheeks = `<ellipse class="art-cheek" cx="${left - 9}" cy="${eyeY + 16}" rx="9" ry="5" fill="#ee9b96" stroke="none"/><ellipse class="art-cheek" cx="${right + 9}" cy="${eyeY + 16}" rx="9" ry="5" fill="#ee9b96" stroke="none"/>`;
  let eyes;
  if (mood === 'win') {
    eyes = `<path d="M${left - 6} ${eyeY + 2}Q${left} ${eyeY - 9} ${left + 6} ${eyeY + 2}M${right - 6} ${eyeY + 2}Q${right} ${eyeY - 9} ${right + 6} ${eyeY + 2}" stroke-width="4"/>`;
  } else if (mood === 'thinking') {
    eyes = `<ellipse cx="${left + 2}" cy="${eyeY - 1}" rx="4.5" ry="5.8" fill="${ink}" stroke="none"/><ellipse cx="${right + 2}" cy="${eyeY - 1}" rx="4.5" ry="5.8" fill="${ink}" stroke="none"/><circle cx="${left + 3}" cy="${eyeY - 3}" r="1.4" fill="${cream}" stroke="none"/><circle cx="${right + 3}" cy="${eyeY - 3}" r="1.4" fill="${cream}" stroke="none"/><path d="M${left - 6} ${eyeY - 15}Q${left} ${eyeY - 20} ${left + 7} ${eyeY - 16}M${right - 6} ${eyeY - 13}L${right + 6} ${eyeY - 12}" stroke-width="3"/>`;
  } else {
    eyes = `<ellipse cx="${left}" cy="${eyeY}" rx="4.5" ry="5.8" fill="${ink}" stroke="none"/><ellipse cx="${right}" cy="${eyeY}" rx="4.5" ry="5.8" fill="${ink}" stroke="none"/><circle cx="${left + 1.1}" cy="${eyeY - 2}" r="1.5" fill="${cream}" stroke="none"/><circle cx="${right + 1.1}" cy="${eyeY - 2}" r="1.5" fill="${cream}" stroke="none"/>`;
  }
  const nose = bear
    ? `<path d="M71 ${noseY - 2}Q80 ${noseY - 7} 89 ${noseY - 2}Q92 ${noseY + 2} 85 ${noseY + 7}Q80 ${noseY + 11} 75 ${noseY + 7}Q68 ${noseY + 2} 71 ${noseY - 2}Z" fill="${ink}" stroke="none"/><path d="M76 ${noseY - 1}H81" stroke="#91788c" stroke-width="2.5"/>`
    : `<path d="M74 ${noseY - 2}Q80 ${noseY - 5} 86 ${noseY - 2}Q88 ${noseY} 82 ${noseY + 5}Q80 ${noseY + 7} 78 ${noseY + 5}Q72 ${noseY} 74 ${noseY - 2}Z" fill="${fox ? ink : '#cc8387'}" stroke="none"/>`;
  let mouth;
  if (mood === 'thinking') {
    mouth = `<path d="M80 ${noseY + 6}V${noseY + 11}M80 ${noseY + 11}Q85 ${noseY + 16} 91 ${noseY + 12}" stroke-width="2.8"/>`;
  } else if (mood === 'win') {
    mouth = `<path d="M69 ${noseY + 11}Q80 ${noseY + 17} 91 ${noseY + 11}Q89 ${noseY + 27} 80 ${noseY + 27}Q71 ${noseY + 27} 69 ${noseY + 11}Z" fill="${ink}" stroke-width="2"/><path d="M74 ${noseY + 23}Q80 ${noseY + 17} 86 ${noseY + 23}Q80 ${noseY + 28} 74 ${noseY + 23}Z" fill="#eea19c" stroke="none"/>`;
  } else {
    mouth = `<path d="M80 ${noseY + 6}V${noseY + 10}M68 ${noseY + 11}Q73 ${noseY + 19} 80 ${noseY + 12}Q87 ${noseY + 19} 92 ${noseY + 11}" stroke-width="2.8"/>`;
  }
  return `${cheeks}${eyes}${nose}${mouth}`;
}

function paws(kind, mood) {
  const fur = kind === 'fox' ? '#efad6c' : kind === 'bear' ? '#c69770' : '#fff9ec';
  if (mood === 'thinking') {
    return `<path d="M109 151Q99 143 94 133Q88 125 92 120Q97 113 104 121L113 132L117 126Q122 122 126 127Q132 139 125 151" fill="${fur}" stroke-width="3.5"/><path d="M99 125L105 132M105 122L111 130" stroke-width="2.2"/>`;
  }
  if (mood === 'win') {
    return `<path d="M27 144Q15 140 10 127Q4 114 13 111Q19 109 24 120Q22 108 29 108Q36 108 36 121L40 138" fill="${fur}" stroke-width="3.5"/><path d="M133 144Q145 140 150 127Q156 114 147 111Q141 109 136 120Q138 108 131 108Q124 108 124 121L120 138" fill="${fur}" stroke-width="3.5"/><path d="M18 125L23 130M142 125L137 130" stroke-width="2.2"/>`;
  }
  return `<path d="M33 151Q30 139 39 136Q49 135 51 150M109 150Q111 135 121 136Q130 139 127 151" fill="${fur}" stroke-width="3.5"/>`;
}

const rabbit = `
  <circle cx="80" cy="85" r="71" fill="#f5e5bd" stroke="none"/>
  <path d="M24 157Q26 125 57 122H104Q134 128 137 157Z" fill="${mint}"/>
  <path d="M46 69C35 53 24 24 33 12C39 4 49 8 54 18L73 61Z" fill="#fff9ec"/>
  <path d="M46 54Q33 24 39 19Q46 14 59 55" fill="#edb1ab" stroke="none"/>
  <path d="M89 60L96 20C98 7 108 3 115 9C127 19 117 49 112 67Z" fill="#fff9ec"/>
  <path d="M100 54Q103 18 110 17Q117 18 105 57" fill="#edb1ab" stroke="none"/>
  <path d="M44 65Q50 50 64 54Q78 46 92 53Q108 49 117 65C128 80 132 102 121 119C108 140 55 140 41 119C29 102 33 80 44 65Z" fill="#fff9ec"/>
  <path d="M42 111Q57 132 81 129Q106 131 122 111Q118 134 82 135Q47 136 42 111Z" fill="#efdfc6" stroke="none"/>
  <path d="M64 59Q72 63 78 57" stroke="#e2ceb1" stroke-width="3"/>
  <path d="M55 132L77 141L61 153L52 138ZM104 132L82 141L99 153L108 138Z" fill="#4e9f87" stroke-width="3"/>
  <path d="M73 137Q80 133 87 137L87 147Q80 151 73 147Z" fill="${honey}" stroke-width="3"/>
`;

const fox = `
  <circle cx="80" cy="85" r="71" fill="#dfebed" stroke="none"/>
  <path d="M37 145Q13 145 11 126Q11 108 28 100Q23 116 41 119L52 137Z" fill="#efad6c" stroke-width="3.5"/>
  <path d="M11 126Q11 108 28 100Q24 113 34 119Q24 122 23 135Z" fill="#fff3d9" stroke="none"/>
  <path d="M25 157Q28 127 57 122H104Q132 126 136 157Z" fill="${blue}"/>
  <path d="M42 57L30 22Q27 10 39 14L67 38Q80 33 93 38L121 14Q133 8 130 22L119 60Z" fill="#efad6c"/>
  <path d="M41 46L37 24L58 43ZM102 43L123 24L118 47Z" fill="#bd7f70" stroke="none"/>
  <path d="M45 48Q60 37 79 42Q99 36 116 50L124 76L140 89L128 96L133 103L117 107Q106 129 80 132Q52 131 41 110L27 105L32 97L21 90L37 76Z" fill="#efad6c"/>
  <path d="M32 88Q48 76 63 88L80 99L98 88Q113 76 128 88L122 104Q105 126 80 128Q54 126 38 105Z" fill="#fff3d9" stroke="none"/>
  <path d="M70 49Q79 52 85 46" stroke="#f8cb8f" stroke-width="4"/>
  <path d="M51 131Q80 144 108 131L102 148L81 145L62 150Z" fill="${honey}" stroke-width="3"/>
  <path d="M81 144L94 158L101 145" fill="#e0ac4e" stroke-width="3"/>
`;

const bear = `
  <circle cx="80" cy="85" r="71" fill="#f3dfcf" stroke="none"/>
  <path d="M24 157Q27 123 58 121H103Q133 125 137 157Z" fill="${coral}"/>
  <circle cx="41" cy="38" r="20" fill="#c69770"/>
  <circle cx="119" cy="38" r="20" fill="#c69770"/>
  <circle cx="41" cy="38" r="10" fill="#e9be92" stroke="none"/>
  <circle cx="119" cy="38" r="10" fill="#e9be92" stroke="none"/>
  <path d="M32 61Q37 31 80 32Q123 31 128 61C139 87 131 115 116 126Q100 137 80 135Q58 137 42 126C27 113 21 86 32 61Z" fill="#c69770"/>
  <path d="M38 107Q52 128 80 127Q108 129 125 107Q118 134 81 135Q46 136 38 107Z" fill="#b18464" stroke="none"/>
  <path d="M58 104Q57 84 79 86Q103 84 104 104Q105 123 81 126Q57 124 58 104Z" fill="#f8dfb3" stroke="none"/>
  <path d="M65 42Q75 36 84 42L91 39" stroke="#e7bc90" stroke-width="4"/>
  <path d="M51 133L48 157M109 133L113 157" stroke="${ink}" stroke-width="8"/>
  <path d="M51 133L48 157M109 133L113 157" stroke="${blue}" stroke-width="4"/>
  <path d="M70 140H90V154H70Z" fill="${honey}" stroke-width="2.5"/>
  <path d="M76 146H84" stroke="#fff5ce" stroke-width="3"/>
`;

/** rabbit | fox | bear; happy | thinking | win. Unknown values are safe. */
export function portrait(kind, mood = 'happy') {
  const animal = kind === 'fox' || kind === 'bear' ? kind : 'rabbit';
  const feeling = mood === 'thinking' || mood === 'win' ? mood : 'happy';
  const drawing = animal === 'fox' ? fox : animal === 'bear' ? bear : rabbit;
  return svg('0 0 160 160', `${drawing}${expression(animal, feeling)}${paws(animal, feeling)}`);
}

const apple = `
  <path d="M31 24Q31 16 35 9" stroke="#8c705d" stroke-width="5"/>
  <path d="M34 17Q38 5 51 8Q51 20 34 20Z" fill="${mint}" stroke-width="3"/>
  <path d="M32 24C18 13 7 23 10 38C11 52 21 60 31 55C42 61 53 49 54 35C55 20 42 15 32 24Z" fill="${coral}" stroke-width="3.5"/>
  <path d="M12 40Q19 56 31 50Q43 55 53 38Q51 54 40 56Q35 58 31 55Q17 62 12 40Z" fill="#d96464" stroke="none"/>
  <path d="M17 32Q18 26 23 27" stroke="#ffd1ba" stroke-width="4.5"/>
  <path d="M28 24Q32 27 36 23" stroke="#bc6661" stroke-width="2.5"/>
`;

const carrot = `
  <path d="M40 22Q29 13 34 7Q41 3 45 19Q42 4 49 4Q57 5 49 20Q58 10 61 16Q62 22 49 26Z" fill="${mint}" stroke-width="3"/>
  <path d="M34 20Q39 16 46 23Q53 28 48 35L23 56Q16 62 13 56Q11 53 16 46Z" fill="#f4a359" stroke-width="3.5"/>
  <path d="M46 28Q48 33 43 38L19 58Q23 58 27 53L48 35Q52 30 46 28Z" fill="#de8746" stroke="none"/>
  <path d="M33 26L39 31M26 36L32 41M20 46L24 49" stroke="#b96f44" stroke-width="2.7"/>
  <path d="M35 24L30 30" stroke="#ffd18b" stroke-width="3.5"/>
`;

const cookie = `
  <path d="M32 9Q40 7 45 13Q55 14 55 25Q61 31 55 40Q54 51 44 53Q37 61 27 55Q16 56 13 46Q5 39 10 30Q8 19 18 16Q23 7 32 9Z" fill="${honey}" stroke-width="3.5"/>
  <path d="M11 38Q20 52 34 50Q49 49 56 36Q56 48 45 53Q37 60 27 55Q16 56 13 46Z" fill="#dca64f" stroke="none"/>
  <path d="M18 27Q20 19 28 18" stroke="#ffe4a2" stroke-width="4"/>
  <path d="M26 23L32 21L35 27L30 31L25 28ZM41 30L46 31L47 37L41 39L38 34ZM20 38L25 39L27 44L21 47L17 43ZM36 44L40 46L38 51L33 49Z" fill="#8e6954" stroke="none"/>
  <path d="M44 19L47 22M18 32L20 33" stroke="#bd8c48" stroke-width="2.5"/>
`;

/** Easily recognized, countable silhouettes; unknown kind falls back to apple. */
export function item(kind = 'apple') {
  return svg('0 0 64 64', kind === 'carrot' ? carrot : kind === 'cookie' ? cookie : apple);
}

function wheel(x, y, r = 12) {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${ink}" stroke-width="3"/><circle cx="${x}" cy="${y}" r="${r * 0.39}" fill="${cream}" stroke="none"/>`;
}

function wagon(x, color, number) {
  return `<path d="M${x + 7} 138H${x + 65}" stroke-width="6"/>${wheel(x + 17, 146)}${wheel(x + 57, 146)}<rect x="${x}" y="88" width="74" height="49" rx="12" fill="${color}"/><path d="M${x + 9} 96H${x + 63}" stroke="#fff8ed" stroke-opacity=".42" stroke-width="3"/><text x="${x + 37}" y="124" fill="${cream}" stroke="${ink}" stroke-width="1.25" paint-order="stroke fill" text-anchor="middle" font-family="ui-rounded, system-ui, sans-serif" font-size="29" font-weight="800">${number}</text>`;
}

/** Friendly coral locomotive, three carriages and a quiet wisp of steam. */
export function train() {
  return svg('0 0 420 180', `
    <ellipse cx="213" cy="164" rx="196" ry="8" fill="${ink}" opacity=".08" stroke="none"/>
    <path d="M10 166H409" stroke="#c2a17d" stroke-width="4"/>
    <path d="M22 171H31M53 171H62M84 171H93M115 171H124M146 171H155M177 171H186M208 171H217M239 171H248M270 171H279M301 171H310M332 171H341M363 171H372M394 171H403" stroke="#d8ba94" stroke-width="4"/>
    <path d="M133 125H158M224 125H246M312 125H335" stroke-width="5"/>
    ${wagon(155, mint, 10)}
    ${wagon(243, honey, 20)}
    ${wagon(331, blue, 30)}
    <path class="art-steam art-steam-far" d="M32 25C22 23 22 10 31 8C41 5 46 16 40 22Q38 26 32 25Z" fill="#fffdf7" stroke="#dfd4c6" stroke-width="2.5"/>
    <path class="art-steam" d="M46 50C34 50 32 37 39 31C48 22 62 33 58 42Q55 51 46 50Z" fill="#fffdf7" stroke="#dfd4c6" stroke-width="3"/>
    <path d="M38 62V52Q38 48 43 48H54Q59 48 59 52V77H38Z" fill="${ink}" stroke-width="3"/>
    <path d="M32 73H64V82H32Z" fill="#caa06e" stroke-width="3"/>
    <path d="M12 136L25 113L31 137Z" fill="${honey}" stroke-width="3.5"/>
    <path d="M23 96Q23 80 40 80H86V57Q86 49 94 49H130Q139 49 139 58V121Q139 138 121 138H40Q23 138 23 121Z" fill="${coral}"/>
    <path d="M25 121Q30 131 42 131H123Q134 131 139 119V124Q136 138 121 138H40Q25 137 25 121Z" fill="#d86666" stroke="none"/>
    <path d="M81 51Q81 43 90 43H133Q142 43 144 51Z" fill="#d96d6d" stroke-width="3.5"/>
    <rect x="98" y="60" width="29" height="27" rx="7" fill="#c9e5ee" stroke-width="3.5"/>
    <path d="M104 70L111 65M106 79L119 66" stroke="#fffaf1" stroke-width="3"/>
    <path d="M95 100H126" stroke="#f7a59a" stroke-width="4"/>
    <ellipse cx="37" cy="112" rx="5" ry="4" fill="#f9afa5" stroke="none"/>
    <ellipse cx="74" cy="112" rx="5" ry="4" fill="#f9afa5" stroke="none"/>
    <ellipse cx="46" cy="102" rx="3.5" ry="4.5" fill="${ink}" stroke="none"/>
    <ellipse cx="65" cy="102" rx="3.5" ry="4.5" fill="${ink}" stroke="none"/>
    <path d="M47 116Q56 125 65 116" stroke-width="3"/>
    ${wheel(42, 145, 15)}
    ${wheel(116, 145, 15)}
    <path d="M43 145H115" stroke="#b0928c" stroke-width="5"/>
    <circle cx="42" cy="145" r="4" fill="${cream}" stroke="none"/>
    <circle cx="116" cy="145" r="4" fill="${cream}" stroke="none"/>
  `);
}
