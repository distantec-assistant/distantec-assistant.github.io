# Буквоград

A browser game for learning the Russian alphabet, made for children aged about 4. It is part of «Маленькие игры» at games.distantec.app.

A little train travels across a map. Each station is one letter, and the letters go from easy to hard: А, М, О, У, П, Л, Н, К, Т, С, … Ь, Ъ.
Each station has these mini-games:

1. **Познакомься.** A letter that comes alive, with its name, its sound and a word. Then the child traces the letter with a finger twice.
2. **Поймай букву.** The child pops the bubbles that show the right letter. A review round uses one of the letters already learned.
3. **Что начинается на …?** The child chooses the pictures that start with the letter. One round is review.
4. **Собери слово.** From the third station on, the child builds words from known letters. The words are then read aloud by syllables and in full.

Each completed station earns a sticker for the album. Progress is saved in `localStorage` under the key `bukvograd-v1`.

## Files
- `index.html` is the whole game, with inline CSS, JS and SVG. It is generated from `src/` by `python3 src/build.py`.
- `audio/*.mp3` holds the voice clips, voiced by Yandex SpeechKit API v3 (voice `lera`, role `friendly`). Stress is marked with `+` before the stressed vowel. The voice does not reliably honour `+` on a word-final vowel, and a `+` after a vowel is read aloud as «плюс», so phrases avoid words whose stress is on a final vowel when the default reading is wrong. The letter Ы uses phoneme markup `[[ɨ]]`, because the voice says a plain «Ы» as «И».

## How to add a station
1. In `src/data.py`, add words for the letter to `WORDS`: the word, its stress-marked TTS text and its syllables.
2. Add a picture with the same id to `src/pics.js`.
3. Run `python3 src/data.py`. Generate the new clips with `tts/gen_ly.py` (Yandex SpeechKit v3, voice lera), which lives on the work machine and is not in the repo. Then run `python3 src/build.py`.

A station becomes playable automatically once its letter has at least 3 picture words.
