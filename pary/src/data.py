# -*- coding: utf-8 -*-
# «Найди пару»: themes, levels, clips. TTS: '+' goes BEFORE the stressed vowel, never after a vowel.
import json, re, sys
sys.path.insert(0, '/workspace/games/bukvograd/src')
from data import WORDS, LETTERS, slug   # same words and stress marks as Буквоград
TTS = {slug(w): t for w, t, _ in WORDS}
def cap(s): return s[0].upper()+s[1:] if s[0] != '+' else '+'+s[1].upper()+s[2:]
THEMES = [
 # id, title, spoken title, icon, pictures
 ("zveri", "Звери", "Зв+ери!", "kot", ["kot","slon","tigr","zebra","zhiraf","sova","pingvin","yozh","belka","zajka","homyak","enot","oslik","schenok","cherepaha","utka","cyplyonok"]),
 ("eda", "Фрукты и овощи", "Фр+укты и +овощи!", "yabloko", ["yabloko","banan","grusha","arbuz","limon","apelsin","vinograd","ananas","dynya","pomidor","ogurec","tykva","kapusta","repka"]),
 ("transport", "Транспорт", "Трансп+орт!", "avtobus", ["avtobus","mashina","samolyot","raketa","lodka","traktor","tramvaj","yahta","samokat","eekskavator"]),
 ("veschi", "Игрушки и вещи", "Игр+ушки и в+ещи!", "myach", ["myach","kukla","baraban","gitara","yula","shar","chajnik","zont","chasy","klyuch","lampa","shapka"]),
 ("priroda", "Небо и природа", "Н+ебо и прир+ода!", "solnce", ["solnce","luna","zvezda","oblako","cvetok","yolka","grib","list","gora","dub"]),
]
LEVELS = [2, 3, 4, 6]            # pairs per level: 4, 6, 8, 12 cards
# «Буква и картинка»: one simple word per letter (Ы, Ь, Ъ have no word that starts with them)
LETTER_WORD = {"a":"arbuz","m":"myach","o":"oblako","u":"utka","p":"pingvin","l":"limon","n":"nos","k":"kot","t":"tigr","s":"slon",
 "e":"enot","i":"indyuk","r":"ryba","b":"banan","d":"dom","v":"volk","g":"grib","z":"zebra","ya":"yabloko","sh":"shar","zh":"zhuk",
 "yu":"yula","yo":"yozh","h":"homyak","f":"flag","ch":"chajnik","ee":"eeskimo","c":"cyplyonok","sch":"schenok","j":"jogurt"}
LETTER_LEVELS = [["a","m"],["o","u","p"],["l","n","k","t"],["s","e","i","r","b","d"],["v","g","z","ya","sh","zh"],["yu","yo","h","f","ch","ee"],["c","sch","j","a","m","o"]]
PHRASES = {
 "find": "Найд+и один+аковые карт+инки!",
 "find_l": "Найд+и б+укву и карт+инку!",
 "more": "Теп+ерь к+арточек б+ольше!",
 "done": "Ур+а! Все п+ары н+айдены!",
}
PRAISE = ["p1","p2","p3","p4","p5","p6","p7"]
REUSE = [f"ph_{p}" for p in PRAISE]   # from Буквоград, same voice
# letter names voiced fresh for this game (Буквоград's take was creaky); Буквоград's files are untouched
OWN_NAMES = {"s": "+Эс."}
def build():
    clips = {}; pics = set()
    for tid, title, spoken, icon, ps in THEMES:
        clips[f"t_{tid}"] = spoken; pics.update(ps)
    L = {lid: (ch, name) for ch, lid, name, *_ in LETTERS}
    letters = []
    for lid, w in LETTER_WORD.items():
        ch, name = L[lid]; pics.add(w)
        clips[f"lp_{lid}"] = f"{name} — {TTS[w]}!"
        letters.append({"id": lid, "ch": ch, "w": w})
        if lid in OWN_NAMES: clips[f"name_{lid}"] = OWN_NAMES[lid]
        else: REUSE.append(f"name_{lid}")
    for p in sorted(pics): clips[f"n_{p}"] = cap(TTS[p]) + "!"
    clips["t_bukvy"] = "Б+уква и карт+инка!"
    for k, t in PHRASES.items(): clips[f"ph_{k}"] = t
    for t in clips.values():
        assert not re.search(r"\+(?![аеёиоуыэюяАЕЁИОУЫЭЮЯ])", t), t
    data = {"themes": [{"id": a, "title": b, "icon": d, "pics": e} for a, b, c, d, e in THEMES],
            "levels": LEVELS, "letters": letters, "letterLevels": LETTER_LEVELS, "praise": PRAISE}
    return data, clips
if __name__ == "__main__":
    data, clips = build()
    json.dump(data, open("game-data.json", "w"), ensure_ascii=False)
    json.dump(clips, open("clips.json", "w"), ensure_ascii=False, indent=0)
    json.dump(REUSE, open("reuse.json", "w"))
    print(len(clips), "clips,", len(REUSE), "reused")
