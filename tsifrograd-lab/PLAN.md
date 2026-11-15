# Цифроград v2 — план интегрированной тестовой версии

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Сделать и опубликовать только на `-lab` новый Цифроград с мягким началом, интегрированными продвинутыми играми и оригинальной графикой.

**Architecture:** Чистая модель и планировщик отделены от UI, иллюстраций, сохранения и карты готовых аудиофайлов. Независимые writers работают с исключительным владением файлами; публикацией и замороженными проверками управляет родитель.

**Tech Stack:** Нативные ES modules, HTML/CSS/SVG, WebAudio и localStorage; Node test runner, Python stdlib и существующие Playwright/Chromium для QA.

---

## Запрос, baseline и границы

Андрей: ребёнку около 4 лет игры понравились, но некоторые сложные; включить лабораторные занятия в Цифроград на более сложных уровнях, обновить графику, сначала проверить на существующем `/tsifrograd-lab/`. Открытие ребёнком маршрута «До 30» не доказывает освоения самостоятельного составления числа.

Baseline `697639452c4d3d05dc05732d15999394fdf45d84`, ветка `feat/tsifrograd-lab-v2-integration`. Разрешённый дифф — только `tsifrograd-lab/`. Основные игры, новые pary/uzory, каталог, CNAME, все MP3/tts и оба аудиобанка побайтно сохранить. Хеши 1509 защищённых файлов — `/root/projects/gamedev/verification/tsifrograd-lab-v2/baseline.json`.

Без внешних библиотек/шрифтов/картинок, покупных ассетов, сервера и API синтеза. Только сохранённая Юлия. Новая графика — оригинальные SVG/CSS, направление в `DESIGN.md`. Ключ новой версии `tsifrograd-lab-v2`; не читать/не мигрировать/не менять `tsifrograd-v1`, `bukvograd-v1`, `tsifrograd-lab-v1`. Эксперимент `noindex,nofollow`, без ссылки из основного каталога. В production переносить только по отдельной команде после семейного теста.

## Лестница сложности

Все пять станций доступны по явному выбору. По умолчанию первая; нет замков, таймера, жизней, наказаний и автоматического перехода на сложную станцию. Путешествие — ровно два коротких задания; виды вращаются. Отдельная практика доступна для всех механик текущей станции.

1. **Лужайка, 1–5:** погрузка по одному, найти названную цифру, сосчитать картинки. Два варианта ответа. Никаких lab-задач.
2. **Лес, 1–10:** базовые действия, три ответа; длинный поезд отдельно как сопровождаемый счёт.
3. **Город, 11–20:** погрузка десятком/единицами, количество в вагонах, прямой ряд с одним пропуском, соседи; необязательный длинный поезд. Самостоятельных заказов/деления/мостов ещё нет.
4. **Мастерская:** одно базовое задание и одно из трёх самостоятельных. Заказы постепенно 11–20, угощение по 3–5 (начало с одного переноса), мост 11–15 с деталями 1/2/5. Не добавлять все три подряд к каждой станции.
5. **Большое путешествие, 21–30:** заказы и мосты до 30, деталь-десяток, угощение по 6–15, позднее обратный ряд и два пропуска. Границы всех чисел остаются 1–30; исправимый перебор самостоятельных составлений — до 40.

Механики `load,find,count,missing,neighbors,long,orders,sharing,bridge`. Последние три разрешены только на стадиях 4 и 5. Первые сопровождаемые игры могут завершаться по правильному действию; самостоятельные — только явной проверкой. Сохранять удаление/исправление, общую сумму при переносе, запрет редактирования после успеха и однократную награду.

## Общие интерфейсы реализации

`journey.mjs`: `GAME_IDS,STAGES,getStage(id),availableGames(stageId),planJourney(stageId,index),createTask(stageId,kind,round=0),act(task,{type,value}),assess(task),taskTotal(task)`.

`STAGES` имеет `id,title,range,min,max,art`; id 1…5, art meadow/forest/town/workshop/mountains. Общие поля task `stageId,kind,round,target,autoFinish`. Дополнительные: load/orders/bridge `parts,pieces`; sharing `piles`; find/count/neighbors `choices,selected` (neighbors `anchor,direction`); missing `sequence` с null, `holes,solution,answers,choices,lastCorrect,lastPick`; long `cursor`. Действия add/remove/transfer/pick/tick. Чистые функции не мутируют вход; неизвестные стадии/игры/параметры не дают нарушить диапазон. assess: `correct,status,current,target,delta`; статусы correct/progress/more/less/unequal/wrong/empty. Частичный ответ двух пропусков не завершает задачу.

Планировщик: 1 load+find/count; 2 load/find+count; 3 load+count/missing/neighbors; 4–5 count/missing/neighbors + orders/sharing/bridge. Long не навязывается в сессии. Прогресс целей последовательный, не старый скачок 11→18→25. Ответы перемешиваются; верный не всегда на одной позиции. Старые model.mjs/model.test.mjs сохраняются, их чистые правила можно переиспользовать для сложных задач.

`progress.mjs`: KEY, parseProgress(raw), winProgress(progress,stageId,kind), finishJourney(progress,stageId). Структура `{version:2,stage:1,sound:true,counts:{'1':{kind:0},…},sessions:{'1':0,…}}`, числовые поля строго ограничены. Испорченное/недоступное хранилище не блокирует игру.

`narration.mjs`: clipUrl(id), instruction(task), feedback(task,status), прежний NEW_CLIPS. Очередь — `{clip:id}`/числа-количества, НЕ старые числовые паузы. Allowlist расширяется только существующими Julia-файлами; заказная реплика требует яблоки/десяток. MP3 не изменяются. Сохранить настоящий WebAudio, отмену старой речи, mute/repeat, повтор загрузки после ошибки. Видимый текст не подменяет голос для нечитающего ребёнка.

Графический API: scene(kind,stageId=1), portrait(kind,mood), item(kind), train(), worldMap(stageId=1), landmark(stageId=1). Персонажи rabbit/fox/bear, настроения happy/thinking/win, предметы как минимум apple/cookie. Self-contained SVG с viewBox/aria-hidden/focusable=false без script/events/IDs/defs/внешних ресурсов. Новые карта, поезд и пять мест назначения, не только смена цвета карточек.

UI: `#home[data-stage]`, `[data-action=stage][data-stage]`, `#start-journey[data-action=journey]`, `[data-action=start][data-kind]`; `#game[data-stage,kind,target,phase,current,round]`, phase playing/won. `#board,#sound,#check,#reward,#next,#feedback,#voice-note,#save-note`. Действия add/remove/transfer/pick/tick/help/repeat/reset/home/next с data-value/data-index/data-from. В find/count/missing/neighbors не показывать правильный ответ в шапке. `?stage=N&game=…` разрешает только виды этой стадии; прежний `?game=orders|sharing|bridge` без stage открывает 4-ю. Некорректные параметры возвращают карту.

Изменённые runtime-импорты и CSS — `?v=5`; entry app.mjs?v=5, build journey-v2-preview-1. Крупные кнопки, исправление без drag-and-drop, подробности только в родительском блоке.

## Владение и проверка

- Модель/голос: journey.mjs + test, progress.mjs + test, narration.mjs + test.
- Арт: art.mjs, art.css, art.test.mjs; отдельный реальный contact-sheet.
- UI: index.html, app.mjs, style.css.
- Браузерная QA: test-browser.py, test-voice.py.
- Родитель: PLAN/DESIGN/README/VERIFICATION, общий integration/preview. Ни один writer не редактирует чужие файлы, не коммитит и не публикует.

Проверки: node всех моделей/сохранений/планировщика/голоса/ассетов; реальные Chromium-сценарии всех 9 игр от старта до успеха, неверный ввод и исправление, награды/повтор/следующее/домой; 320/390, landscape 844×390, планшет 768/1024, desktop; максимальные границы/40 предметов/пустая тарелка; доступность удаления и проверки, не только отсутствие overflow; reload, повреждённое/недоступное хранилище, opaque sentinel прежних ключей; настоящие fetch/decode/start/stop, mute и отказ/повтор аудио, отсутствие внешних запросов.

Закончить writers, механическую проверку, документацию и локальные тесты, затем заморозить кандидат хешами. Бюджет: одно spec-review, затем одно quality/security-review; максимум один адресный recheck существенных замечаний каждого этапа. Minor/style не блокируют. Не редактировать кандидата во время review.

Перед push — сверка актуального origin/main, всего scope и аудиобанков; без force-push. После — exact-head Pages success, byte readback и реальные live игровые/голосовые сценарии. Ожидание bounded с отслеживанием результата; ошибка/очередь провайдера не успешный релиз. Откат — отдельный коммит восстановления только lab из baseline. Семейный плейтест, физический тач/Safari и слышимое качество отдельно не подтверждены автоматикой.
