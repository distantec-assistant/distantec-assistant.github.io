# Буквоград

A browser game for learning the Russian alphabet, made for children aged about 4. It is part of «Маленькие игры» at games.distantec.app.

A little train rides on rails through a landscape (sky, hills, trees, a pond). Each station is one letter, and all 33 letters are playable, from easy to hard: А, М, О, У, П, Л, Н, К, Т, С, Е, И, Ы, Р, Б, Д, В, Г, З, Я, Ш, Ж, Ю, Ё, Х, Ф, Й, Ч, Э, Ц, Щ, Ь, Ъ. The train rides along the rails to the current station.

Each station has four mini-games (stations А and М have three):

1. **Познакомься.** A letter that comes alive, with its name, its sound and a word. Then the child traces the letter with a finger twice.
2. **Поймай букву.** The child pops the bubbles that show the right letter. A review round uses one of the letters already learned.
3. **Что начинается на …? / Где есть буква …?** The child chooses the pictures that fit the letter. For Ы, Ю, Ё, Й, Ь and Ъ the letter is found inside the word (mode `in`), so the game never asks what starts with Ъ. One round is review.
4. One extra game that changes each time the station is finished:
   - **Собери слово.** Build a word from known letters, then hear it by syllables and in full.
   - **Найди пары.** Memory cards: match each letter with its picture (cards flip; voiced).
   - **Пазл.** Tap the four pieces to turn them until the picture is whole, hear the word, then pick its first letter.

Ь and Ъ are explained in their intro clip: the letter has no sound of its own.

Each completed station earns a sticker for the album. Progress is saved in `localStorage` under the key `bukvograd-v1`. Older saves (per-game flags by position, `g`) are migrated on load to per-game flags by name (`gn`); `done` is unchanged. `pl` counts finished plays and rotates the extra game.

## Files
- `index.html` is the whole game, with inline CSS, JS and SVG. It is generated from `src/` by `python3 src/build.py` (template.html + pics.js + pics2.js + pics3.js + strokes.js + game-data.json).
- `audio-svetlana/*.mp3` is the active voice bank: Edge TTS `ru-RU-SvetlanaNeural`. `tools/svetlana_audio.py` converts source stress/phoneme markup into Edge input, creates separate letter/syllable/word clips, validates and checkpoints them. The isolated О has an explicit elongated override. See `../docs/voice-svetlana.md` for generation, verification and rollback.
- `audio/*.mp3` preserves the previous Julia/SpeechKit recordings unchanged for rollback. The original `+` stress marks and `[[ɨ]]` in source data are input notation, not sent literally to Edge.

## How to add words
1. In `src/data.py`, add the word to `WORDS`: the word, its stress-marked TTS text and its syllables. Letters in `IN_MODE` list their words explicitly; other letters take the words that start with them (the first one is the sticker; `FIRST` pins it).
2. Add a picture with the same id to `src/pics3.js` (same style: viewBox 0 0 100 100, outline colour `K`).
3. From the repository root, run `(cd bukvograd/src && python3 data.py)`, then `python3 tools/svetlana_audio.py --cache-dir ../cache/edge-svetlana` and `python3 bukvograd/src/build.py`. The shared generator creates only missing/changed Svetlana clips; existing Julia recordings are not required for new words and are not overwritten.

## Tests (Playwright)
Current repository checks: `python3 tools/test_svetlana_assets.py` and `python3 tools/test_svetlana_browser.py` from the repository root. The earlier `test/*.cjs` scenarios mentioned in historical notes are not included in this snapshot. Automated audio checks do not replace listening to individual letters and ambiguous stresses.
