# «Что дальше?» — all voice texts. '+' goes right before the stressed vowel of EVERY word with 2+ syllables.
import json, re
VOW = "аеёиоуыэюяАЕЁИОУЫЭЮЯ"
CLIPS = {
 # task phrases
 "ph_what":   "Что д+альше?",
 "ph_wagon":  "Как+ой ваг+ончик сл+едующий?",
 "ph_bead":   "Как+ая б+усинка сл+едующая?",
 "ph_flag":   "Как+ой флаж+ок сл+едующий?",
 "ph_flower": "Как+ой цвет+ок сл+едующий?",
 "ph_middle": "Чег+о не хват+ает?",
 "ph_intro":  "Продолж+и уз+ор!",
 "ph_hint":   "Смотр+и, уз+ор повтор+яется!",
 "ph_again":  "Попр+обуй ещ+ё!",
 "ph_done":   "Ур+а! Всё получ+илось!",
 # colours: masculine (вагончик, флажок, цветок) and feminine (бусинка)
 "cm_0": "Кр+асный.", "cm_1": "С+иний.", "cm_2": "Ж+ёлтый.", "cm_3": "Зел+ёный.",
 "cf_0": "Кр+асная.", "cf_1": "С+иняя.", "cf_2": "Ж+ёлтая.", "cf_3": "Зел+ёная.",
 # shapes
 "sh_0": "Круж+ок.", "sh_1": "Квадр+ат.", "sh_2": "Треуг+ольник.", "sh_3": "Звезд+а.", "sh_4": "Серд+ечко.",
 # sizes
 "sz_0": "Больш+ой.", "sz_1": "М+аленький.",
}
PRAISE = ["p1", "p2", "p4", "p5", "p6", "p7"]   # reused from Буквоград (same voice); p3 skipped (slight buzz)
REUSE = [f"ph_{p}" for p in PRAISE]
def check(t):
    assert not re.search(r"\+(?![" + VOW + "])", t), ("+ not before a vowel", t)
    assert not re.search(r"[" + VOW + r"]\+", t), ("+ right after a vowel", t)
    for w in re.findall(r"[+А-Яа-яЁё]+", t):
        nv = len(re.findall("[" + VOW + "]", w))
        if nv >= 2: assert w.count("+") == 1 or ("ё" in w.lower() and "+" in w), ("word needs exactly one +", w, t)
        assert w.count("+") <= 1, w
if __name__ == "__main__":
    for t in CLIPS.values(): check(t)
    json.dump(CLIPS, open("clips.json", "w"), ensure_ascii=False, indent=0)
    json.dump(REUSE, open("reuse.json", "w"))
    json.dump({"praise": PRAISE}, open("game-data.json", "w"))
    print(len(CLIPS), "clips,", len(REUSE), "reused")
