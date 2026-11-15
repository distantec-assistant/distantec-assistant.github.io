# Что дальше? (узоры)

Pattern-continuation game for ages ~2.5–5 for «Маленькие игры». A row of wagons, beads, flags or flowers repeats a pattern and has a gap («?»); the child picks the right piece from 2–4 big buttons.

## Stages (map on the home screen, unlocked one after another, every passed stage can be replayed)
| # | Scene | What changes | Patterns | Options |
|---|-------|--------------|----------|---------|
| 1 | вагончики | colour | AB | 2 |
| 2 | бусы | colour | AB | 3 |
| 3 | флажки | colour | AAB, ABB | 3 |
| 4 | вагончики | colour | ABC | 3 |
| 5 | бусы | shape (кружок, квадрат, треугольник, звезда, сердечко) | AB, ABB, ABC | 3 |
| 6 | цветы у забора | size (большой / маленький) | AB, ABB, AAB | 2 |
| 7 | бусы | colour + shape together | AB, ABB | 3 (cross-over distractors) |
| 8 | вагончики | colour, gap in the middle | AB, ABB, ABC | 3 |
| 9 | mix | all of the above | — | up to 4 |

Each stage has 5 puzzles. Colours are red, blue, yellow and green; each colour also has its own texture (dots, stripes, diagonal hatching, crosses) so they differ without colour vision too.

On a right answer the piece flies into the gap, Julia names the pattern in rhythm («Красный. Синий. Красный. Синий…», each piece bounces with its word), praises, and the train drives off / beads shine / flags flap / flowers sway. On a wrong answer the button wobbles with a soft tick (no sad sound): the first time Julia says «Смотри, узор повторяется!» and the pieces bounce one by one, unit by unit; the second time she names them and the right button pulses. Taps are ignored while an animation or hint is running.

On tall screens the row wraps into two lines (like reading) so the pieces stay big.

Progress: `localStorage` key `uzory-v1`: `{v:1, done:{stage:1}, pl:{stage:plays}, last}`. Broken saves fall back to a clean start.

## Files
- `index.html` – the whole game, built by `python3 src/build.py` from `src/template.html`, `src/game.js`, the shared engine parts (`src/shared_css.txt`, `src/shared_js.txt`, cut from Цифроград, same as «Найди пару») and `src/game-data.json`.
- `src/data.py` – all voice texts with stress marks ('+' before the stressed vowel of every word with 2+ syllables); writes `clips.json`, `reuse.json`, `game-data.json`, and checks the marks.
- `audio/*.mp3` – Yandex SpeechKit v3, voice `julia`, role `neutral`, speed 1.0 (0.95 for three re-takes). Praise (`ph_p1,2,4,5,6,7`) is reused from Буквоград.

## Tests (Playwright)
`test/all.cjs` plays all 9 stages (`VP=phone|small|phoneL|tablet|tabletL`, `SHOTS=prefix`) with wrong answers and quick extra taps, checking overflow, console/HTTP errors, missing clips and double voice. `test/smoke.cjs` checks clips, the puzzle generator (2000+ random puzzles), save/restore and broken saves.
