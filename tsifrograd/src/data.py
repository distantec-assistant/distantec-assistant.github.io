# -*- coding: utf-8 -*-
# Цифроград: stations, clips. TTS text: '+' goes BEFORE the stressed vowel, never after a vowel.
import json
UNITS = {1:"од+ин",2:"два",3:"три",4:"чет+ыре",5:"пять",6:"шесть",7:"семь",8:"в+осемь",9:"д+евять"}
TEENS = {10:"д+есять",11:"од+иннадцать",12:"двен+адцать",13:"трин+адцать",14:"чет+ырнадцать",15:"пятн+адцать",
         16:"шестн+адцать",17:"семн+адцать",18:"восемн+адцать",19:"девятн+адцать"}
def word(n):
    if n < 10: return UNITS[n]
    if n < 20: return TEENS[n]
    if n == 20: return "дв+адцать"
    if n < 30: return "дв+адцать " + UNITS[n-20]
    return "тр+идцать"
def cap(s): return s[0].upper()+s[1:] if s[0] != '+' else '+'+s[1].upper()+s[2:]
def explain(n):
    w = cap(word(n))
    if n < 20: return f"{w} — это дес+яток и {UNITS[n-10]}."
    if n == 20: return f"{w} — это два дес+ятка."
    if n < 30: return f"{w} — это два дес+ятка и {UNITS[n-20]}."
    return f"{w} — это три дес+ятка."
# stations: a number, or a review range (lo, hi)
STATIONS = [11,12,13,14,15,(11,15),16,17,18,19,(11,19),20,21,22,23,24,25,(20,25),26,27,28,29,30,(11,30)]
# cargo pictures (ids from pics*.js), rotated over stations
CARGO = ["yabloko","shar","cyplyonok","grib","ryba","zvezda","grusha","konfeta","banan","yajco","cvetok","apelsin","shishka","yagoda","myach","utka"]
PHRASES = {
 "hello": "Прив+ет! По+ехали в Цифрогр+ад!",
 "load": "Ст+олько н+адо погруз+ить. Нажим+ай на +ящик!",
 "dozen": "Дес+яток!",
 "loaded": "Всё, погруз+или!",
 "howmany": "Ск+олько прив+ёз паров+озик?",
 "together": "Дав+ай посчит+аем вм+есте.",
 "missing": "Как+ое ч+исло проп+ало?",
 "missing2": "Проп+али два ч+исла!",
 "before": "А как+ое ч+исло идёт п+еред ним?",
 "after": "А как+ое ч+исло идёт п+осле?",
 "long": "Посчит+аем ваг+оны! Нажим+ай по пор+ядку.",
}
# clips reused from Буквоград (same voice, same processing)
REUSE = ["ph_pick_station","ph_try_again","ph_station_done","ph_next_station","ph_locked","ph_album",
         "ph_p1","ph_p2","ph_p3","ph_p4","ph_p5","ph_p6","ph_p7"]
PRAISE = ["p1","p2","p3","p4","p5","p6","p7"]
def build():
    clips = {}
    for n in range(1, 31): clips[f"c_{n}"] = cap(word(n)) + "."
    for n in range(11, 31): clips[f"x_{n}"] = explain(n)
    for k, t in PHRASES.items(): clips[f"ph_{k}"] = t
    st = []
    for i, s in enumerate(STATIONS):
        if isinstance(s, tuple): st.append({"r": list(s), "pic": "zvezda" if s != (11,30) else "raketa"})
        else: st.append({"n": s, "pic": CARGO[i % len(CARGO)]})
    return st, clips
if __name__ == "__main__":
    st, clips = build()
    for t in clips.values():
        import re
        assert not re.search(r"\+(?![аеёиоуыэюяАЕЁИОУЫЭЮЯ])", t), t
    json.dump({"stations": st, "praise": PRAISE, "cargo": CARGO}, open("game-data.json","w"), ensure_ascii=False)
    json.dump(clips, open("clips.json","w"), ensure_ascii=False, indent=0)
    print(len(st), "stations", len(clips), "clips")
