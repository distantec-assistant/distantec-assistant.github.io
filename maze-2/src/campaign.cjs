// Each path is a walk through named places; only consecutive names are joined.
// Shared names are real junctions. No inferred neighbours, procedural maps or random routes.
const TrailCampaign = (() => {
  'use strict';
  const p = (name,x,y) => ({name,at:[x,y]});
  const item = (at,icon,label) => ({at,icon,label});
  function route({paths,...map}) {
    const trails=paths.flatMap(path=>{
      const ids=path.split(' ');
      if (ids.length<2 || ids.some(id=>!Object.hasOwn(map.places,id))) throw Error(`Unknown path in ${map.id}: ${path}`);
      return ids.slice(1).map((to,i)=>[ids[i],to]);
    });
    return {...map,start:'start',goal:'finish',trails};
  }
  function freeze(o) {
    for (const v of Object.values(o)) if (v && typeof v==='object') freeze(v);
    return Object.freeze(o);
  }
  const stories = [
    // 1–3: the original paths, bends, places, cargo and delivery conditions.
    {id:'meadow', title:'Письмо для ежа', land:'Солнечная поляна', cargo:'mail', start:'start', goal:'finish',
      theme:'meadow', recipient:'hedgehog', objectives:[], briefing:'Отнеси письмо ёжику. У развилки посмотри, какая тропинка ведёт к нему.',
      places:{start:p('Почта',61,247), fork:p('Развилка',194,236), grove:p('Роща',294,117),
        nest:p('Птичье гнездо',459,90), hill:p('Холм',361,294), finish:p('Ёжик',526,243)},
      trails:[['start','fork',[126,259]],['fork','grove',[223,164]],['grove','nest',[366,99]],
        ['fork','hill',[266,268]],['hill','finish',[449,294]]]},
    {id:'stream',title:'Посылка у ручья',land:'Кувшинки и мост',cargo:'parcel',start:'start',goal:'finish',stamp:'lilies',
      theme:'stream', recipient:'otter', objectives:[item('lilies','stamp','Марка')], briefing:'Возьми марку у кувшинок, потом неси посылку выдре через мост.',
      places:{start:p('Почта',64,291),fork:p('Развилка',201,261),lilies:p('Кувшинки',169,108),
        bridge:p('Мост',369,207), reeds:p('Камыши',445,319),finish:p('Выдра',534,132)},
      trails:[['start','fork',[125,286]],['fork','lilies',[174,178]],['fork','bridge',[273,230]],
        ['bridge','finish',[463,169]],['bridge','reeds',[411,264]]]},
    {id:'coast',title:'Огонёк для маяка',land:'Тропы у моря',cargo:'light',start:'start',goal:'finish',
      theme:'coast', recipient:'lighthouse', objectives:[], briefing:'Доставь огонёк к маяку. Можно сначала наметить два шага.',
      places:{start:p('Почта',58,260),birches:p('Берёзки',187,240),arch:p('Каменная арка',304,145),
        bench:p('Скамейка',286,319),windmill:p('Ветряк',466,48),dock:p('Причал',445,249),finish:p('Маяк',530,121)},
      trails:[['start','birches',[122,250]],['birches','arch',[231,181]],['birches','bench',[211,302]],
        ['arch','windmill',[393,87]],['arch','dock',[370,197]],['bench','dock',[370,307]],['dock','finish',[499,203]]]},

    // 4–6: one decision at a time — a side trip, a fork at the post, a dead end.
    route({id:'apple-bough',title:'Яблоко с ветки',land:'Маленький сад',theme:'orchard',recipient:'squirrel',cargo:'parcel',
      briefing:'Сорви яблоко у яблони. Вернись к скамейке и отнеси яблоко белке.',objectives:[item('tree','apple','Яблоко')],
      places:{start:p('Почта',63,219),bench:p('Скамейка',247,218),tree:p('Яблоня',248,80),finish:p('Белка',525,240)},
      paths:['start bench finish','bench tree']}),
    route({id:'garden-gate',title:'Ключ от калитки',land:'Два переулка',theme:'village',recipient:'fox',cargo:'mail',
      briefing:'У колодца лежит ключ. Возьми его и неси лисе у калитки.',objectives:[item('well','key','Ключ')],
      places:{start:p('Почта',64,213),well:p('Колодец',220,88),gate:p('Калитка',383,201),pump:p('Колонка',204,311),finish:p('Лиса',534,237)},
      paths:['start well gate finish','start pump gate']}),
    route({id:'ice-star',title:'Звезда на льду',land:'Снежная горка',theme:'snow',recipient:'penguin',cargo:'parcel',
      briefing:'Забери звёздочку у льдинки, а потом иди по следам к пингвину.',objectives:[item('ice','star','Звёздочка')],
      places:{start:p('Почта',231,186),ice:p('Льдинка',65,89),hill:p('Горка',206,314),tracks:p('Следы',392,218),finish:p('Пингвин',538,280)},
      paths:['ice start tracks finish','start hill']}),

    // 7–12: one pickup, but now the player chooses a detour, loop, or return road.
    route({id:'lamp-shop',title:'Фонарь для совы',land:'Фонарная улица',theme:'village',recipient:'owl',cargo:'light',
      briefing:'Зайди в лавку за фонарём. Сова ждёт его за воротами.',objectives:[item('shop','light','Фонарь')],
      places:{start:p('Почта',58,272),yard:p('Двор',198,206),shop:p('Лавка',313,78),gate:p('Ворота',406,217),stair:p('Ступеньки',321,318),finish:p('Сова',553,224)},
      paths:['start yard shop gate finish','yard gate stair']}),
    route({id:'raft-supplies',title:'Доски для плота',land:'Бобровая пристань',theme:'stream',recipient:'beaver',cargo:'parcel',
      briefing:'Загляни на склад за свёртком досок. Доставь его бобру на пристань.',objectives:[item('store','parcel','Свёрток досок')],
      places:{start:p('Почта',58,280),bank:p('Бережок',173,208),store:p('Склад',59,80),log:p('Бревно',296,269),bend:p('Излучина',435,206),stump:p('Пенёк',384,77),finish:p('Бобр',529,250)},
      paths:['start bank log bend finish','bank store','bend stump']}),
    route({id:'anchor-stamp',title:'Марка с якорем',land:'Песчаная коса',theme:'coast',recipient:'otter',cargo:'mail',
      briefing:'Под мачтой спрятана марка с якорем. Отнеси письмо с маркой выдре.',objectives:[item('mast','stamp','Марка с якорем')],
      places:{start:p('Почта',49,307),knot:p('Канат',159,207),mast:p('Мачта',221,75),flag:p('Флажок',359,89),pier:p('Настил',412,221),sand:p('Песок',291,310),finish:p('Выдра',546,234)},
      paths:['start knot mast flag pier finish','pier sand knot']}),
    route({id:'juice-basket',title:'Сок для ёжика',land:'Яблочная ярмарка',theme:'orchard',recipient:'hedgehog',cargo:'parcel',
      briefing:'Со стола забери коробку с соком. Иди к ёжику через цветные ворота.',objectives:[item('table','parcel','Коробка сока')],
      places:{start:p('Почта',71,322),hedge:p('Изгородь',176,271),square:p('Пятачок',320,210),table:p('Стол',305,75),stall:p('Палатка',500,90),gate:p('Цветные ворота',430,311),finish:p('Ёжик',523,240)},
      paths:['start hedge square gate finish','table square stall']}),
    route({id:'lost-mitten',title:'Ключ под варежкой',land:'Лисьи тропы',theme:'snow',recipient:'fox',cargo:'mail',
      briefing:'Загляни под варежку за ключом. Лиса ждёт у снежного домика.',objectives:[item('mitten','key','Ключик')],
      places:{start:p('Почта',59,196),pine:p('Сосна',196,81),mitten:p('Варежка',198,301),ridge:p('Гребень',323,143),lodge:p('Будка',412,206),drift:p('Сугроб',543,83),finish:p('Лиса',540,270)},
      paths:['start mitten pine start','pine ridge lodge finish','lodge drift finish']}),
    route({id:'kite-ribbon',title:'Звезда с воздушного змея',land:'Маковый луг',theme:'meadow',recipient:'squirrel',cargo:'parcel',
      briefing:'У воздушного змея лежит бумажная звезда. Отнеси её белке.',objectives:[item('kite','star','Бумажная звезда')],
      places:{start:p('Почта',60,237),poppy:p('Мак',194,174),hill:p('Бугорок',306,246),birch:p('Берёза',423,206),finish:p('Белка',514,236),bell:p('Колокольчик',105,75),root:p('Корень',212,322),kite:p('Воздушный змей',393,75)},
      paths:['start poppy hill birch finish','poppy bell','hill root','birch kite']}),

    // 13–18: the second item waits. It can always be reached before the first by mistake.
    route({id:'apple-box',title:'Яблоко в коробке',land:'Сад у беседки',theme:'orchard',recipient:'owl',cargo:'parcel',
      briefing:'Сначала сорви яблоко с ветки. Потом возьми коробку у сарая и неси подарок сове.',
      objectives:[item('bough','apple','Яблоко'),item('shed','parcel','Коробка')],
      places:{start:p('Почта',64,245),bench:p('Лавочка',197,223),bough:p('Ветка',219,82),arbour:p('Беседка',373,75),lane:p('Аллея',426,206),shed:p('Сарай',339,317),finish:p('Сова',534,233)},
      paths:['start bench bough arbour lane finish','bench lane shed']}),
    route({id:'toy-chest',title:'Как открыть сундук',land:'Двор кузнеца',theme:'village',recipient:'fox',cargo:'parcel',
      briefing:'Возьми ключ в кузнице, а потом коробку из сундука. Доставь коробку лисе.',
      objectives:[item('forge','key','Ключ'),item('chest','parcel','Коробка игрушек')],
      places:{start:p('Почта',63,273),square:p('Площадь',177,210),well:p('Водокачка',313,192),forge:p('Кузница',436,78),chest:p('Сундук',142,83),lane:p('Улочка',404,301),finish:p('Лиса',543,239)},
      paths:['start square well lane finish','well forge chest square']}),
    route({id:'ice-window',title:'Звезда в окошке',land:'Ледяной городок',theme:'snow',recipient:'penguin',cargo:'light',
      briefing:'Возьми звезду на крыше, потом фонарик у санок. Отнеси их пингвину.',
      objectives:[item('roof','star','Звезда'),item('sled','light','Фонарик')],
      places:{start:p('Почта',177,173),bank:p('Снежный вал',73,81),roof:p('Ледяная крыша',317,79),drift:p('Снежный холмик',302,277),sled:p('Санки',115,315),arch:p('Ледяная арка',431,181),spruce:p('Ёлочка',535,80),finish:p('Пингвин',546,276)},
      paths:['start bank roof start','start drift arch finish','drift sled','arch spruce']}),
    route({id:'keepers-locker',title:'Огонёк из шкафчика',land:'Бухта смотрителя',theme:'coast',recipient:'lighthouse',cargo:'light',
      briefing:'Возьми ключ в сторожке, потом огонёк из шкафчика. Неси огонёк на маяк.',
      objectives:[item('cove','key','Медный ключ'),item('locker','light','Огонёк')],
      places:{start:p('Почта',55,217),beach:p('Пляж',141,222),cove:p('Сторожка',204,75),reef:p('Белый камень',276,214),mast:p('Флюгер',398,76),locker:p('Шкафчик',363,315),pier:p('Пирс',458,205),finish:p('Маяк',546,247)},
      paths:['start beach cove reef beach','reef locker pier mast reef','pier finish']}),
    route({id:'poppy-post',title:'Посылка с луга',land:'Тропинки у ивы',theme:'meadow',recipient:'hedgehog',cargo:'parcel',
      briefing:'Сначала возьми марку у мака. Потом забери посылку с пенька и отнеси её ёжику.',
      objectives:[item('poppy','stamp','Марка'),item('stump','parcel','Посылка')],
      places:{start:p('Почта',537,309),willow:p('Ива',401,183),fork:p('Перекрёсток',316,191),poppy:p('Мак',205,76),stool:p('Табуретка',320,320),hut:p('Шалаш',153,235),stump:p('Пенёк',489,83),finish:p('Ёжик',68,176)},
      paths:['start willow fork hut finish','willow stump','fork poppy','fork stool hut']}),
    route({id:'dusk-dam',title:'Бобр строит до темноты',land:'Три мостика',theme:'stream',recipient:'beaver',cargo:'parcel',
      briefing:'Забери коробку гвоздей на барже. Потом возьми фонарь у лодки и отнеси всё бобру.',
      objectives:[item('shed','parcel','Коробка гвоздей'),item('boat','light','Фонарь')],
      places:{start:p('Почта',49,262),dock:p('Сходни',142,134),shed:p('Баржа',243,75),logs:p('Брёвна',351,75),span:p('Мостки',275,249),grass:p('Осока',145,322),boat:p('Лодка',353,304),bank:p('Высокий берег',458,181),finish:p('Бобр',553,247)},
      paths:['start dock shed logs bank finish','dock span bank','dock grass boat bank']}),

    // 19–24: different circuits on the way out and back; destinations can be visited early.
    route({id:'owls-library',title:'Библиотека совы',land:'Книжная площадь',theme:'village',recipient:'owl',cargo:'parcel',
      briefing:'Найди ключ у фонтана. Потом забери коробку книг у звонка и отнеси сове.',
      objectives:[item('fountain','key','Ключ от библиотеки'),item('bell','parcel','Коробка книг')],
      places:{start:p('Почта',70,283),step:p('Крыльцо',186,194),bell:p('Звонок',89,84),arch:p('Арка',301,81),yard:p('Читальный двор',398,178),well:p('Клумба',276,310),fountain:p('Фонтан',422,318),finish:p('Сова',546,208)},
      paths:['start step bell arch step','arch yard well step','well fountain yard finish','fountain finish']}),
    route({id:'orchard-supper',title:'Ужин под яблоней',land:'Садовые террасы',theme:'orchard',recipient:'squirrel',cargo:'parcel',
      briefing:'Сначала сорви яблоко на пригорке. Потом возьми коробку орехов у корзины. Белка ждёт ужин!',
      objectives:[item('hill','apple','Яблоко'),item('basket','parcel','Коробка орехов')],
      places:{start:p('Почта',68,124),gate:p('Калитка',173,171),shelf:p('Верхний сад',355,140),hill:p('Пригорок',501,76),swing:p('Качели',71,313),basket:p('Корзина',213,314),trellis:p('Решётка',444,216),path:p('Нижний сад',328,310),finish:p('Белка',553,284)},
      paths:['start gate shelf hill','shelf trellis path basket gate swing','trellis finish path']}),
    route({id:'snow-house',title:'Свет в снежном домике',land:'Санный круг',theme:'snow',recipient:'fox',cargo:'light',
      briefing:'Сначала забери ключ из дупла. Потом возьми лампу у сугроба и отнеси её лисе.',
      objectives:[item('hollow','key','Ключик'),item('drift','light','Лампа')],
      places:{start:p('Почта',539,79),spruce:p('Ель',390,163),hump:p('Бугор',303,166),gate:p('Снежные ворота',149,209),hollow:p('Дупло',183,80),drift:p('Сугроб',544,295),skis:p('Лыжи',375,307),sled:p('Сани',239,315),finish:p('Лиса',58,204)},
      paths:['start spruce hump gate finish','hump hollow','spruce drift skis sled gate','skis hump']}),
    route({id:'shell-mail',title:'Сувенир с берега',land:'Кольцо рыбака',theme:'coast',recipient:'otter',cargo:'mail',
      briefing:'Сначала возьми марку у флагштока. Потом забери морскую звезду у хижины. Отнеси их выдре.',
      objectives:[item('pole','stamp','Марка с рыбкой'),item('hut','star','Морская звезда')],
      places:{start:p('Почта',51,301),rock:p('Валун',151,242),hut:p('Хижина',62,112),net:p('Сети',197,86),pole:p('Флагшток',340,84),sail:p('Парус',527,110),braid:p('Галька',323,189),quay:p('Набережная',441,194),sand:p('Песчаный холм',231,311),buoy:p('Старый якорь',413,322),finish:p('Выдра',546,265)},
      paths:['start rock net pole sail quay finish','rock hut','rock braid quay','braid sand buoy quay']}),
    route({id:'dam-party',title:'Праздник на запруде',land:'Запруда с островком',theme:'stream',recipient:'beaver',cargo:'parcel',
      briefing:'Сорви яблоко в садике. Потом забери звезду у палатки и неси подарки бобру.',
      objectives:[item('garden','apple','Яблоко'),item('tent','star','Праздничная звезда')],
      places:{start:p('Почта',49,208),dock:p('Пристань',215,178),tent:p('Палатка',161,316),bridge:p('Ивовый куст',128,75),mill:p('Островок',313,161),dam:p('Запруда',460,244),shed:p('Навес',413,75),garden:p('Садик',553,88),raft:p('Плот',281,314),stone:p('Большой камень',370,299),finish:p('Бобр',553,220)},
      paths:['start dock mill dam finish','dock bridge shed mill','dock tent raft mill','raft stone dam garden']}),
    route({id:'night-crossing',title:'Ночной рейс',land:'Звёздная гавань',theme:'coast',recipient:'lighthouse',cargo:'light',
      briefing:'Сначала найди звезду на катере. Потом возьми фонарь в будке и зажги звезду на маяке.',
      objectives:[item('cape','star','Золотая звезда'),item('booth','light','Фонарь')],
      places:{start:p('Почта',57,295),yard:p('Верфь',159,210),booth:p('Будка',60,88),awning:p('Тент',250,75),well:p('Дворик',338,174),ridge:p('Утёс',427,82),cape:p('Катер',542,83),dock:p('Гавань',447,233),beach:p('Ракушки',244,316),slip:p('Спуск к воде',361,309),finish:p('Маяк',553,239)},
      paths:['start yard booth awning well yard','well ridge cape dock well','yard beach slip dock finish']}),
  ];
  return freeze(stories.map((story,i)=>({...story,number:i+1,chapter:1+Math.floor(i/6)})));
})();
if (typeof module==='object' && module.exports) module.exports=TrailCampaign;
