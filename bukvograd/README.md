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
- `audio/*.mp3` holds the voice clips, voiced by Yandex SpeechKit API v3, voice `julia`, role `neutral` (generator: `tts/gen_jl.py`; re-takes are pinned in `tts/jl_overrides.json`). Stress is marked with `+` before the stressed vowel; a `+` is never put after a vowel (it would be read aloud as «плюс»). The letter Ы uses phoneme markup `[[ɨ]]`.

## How to add words
1. In `src/data.py`, add the word to `WORDS`: the word, its stress-marked TTS text and its syllables. Letters in `IN_MODE` list their words explicitly; other letters take the words that start with them (the first one is the sticker; `FIRST` pins it).
2. Add a picture with the same id to `src/pics3.js` (same style: viewBox 0 0 100 100, outline colour `K`).
3. Run `python3 src/data.py`, generate the new clips with `tts/gen_jl.py` (it only voices new or changed clips), copy them to `audio/`, then run `python3 src/build.py`.

## Tests (Playwright)
`test/smoke.cjs` (every audio clip and picture exists), `test/all.cjs` (plays any stations end to end: `STATIONS=0,12,32 VP=phone|desktop PL=n`), `test/trace.cjs`, `test/catch.cjs`, `test/test.cjs`.
