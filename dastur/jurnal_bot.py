# -*- coding: utf-8 -*-
"""
jurnal_bot.py — Yo'qlama jurnalining Telegram varianti. emaktab_tgbot.py ichida ishlaydi (alohida ishga tushirilmaydi).

O'qituvchi jurnalni to'g'ridan-to'g'ri Telegram'da yuritadi:
    📅 Bugun       — bugungi darslar (dars jadvali bo'lsa soat tartibida, HOZIR / KEYINGI), bitta bosishda «Hamma keldi»
    ✅ Yo'qlama    — o'quvchi tugmasini bosib: ✓ → S → DQ → K → KQ → ✓ (xabar joyida yangilanadi)
    ✍️ Baholash    — o'quvchi → 1…10 (ikkinchi baho ham), so'ng o'zi keyingi o'quvchiga o'tadi
    📖 Mavzu       — dars mavzusi va uy vazifasi
    📒 Jurnal      — sinf ko'rsatkichlari (o'rtacha, davomat, xavf ostidagilar), jadval, o'quvchi kartochkasi,
                     ota-onaga tayyor xabar (nusxalash tugmasi yoki to'g'ridan-to'g'ri chatga yuborish)
    🌐 Ilova       — web ilovani Telegram ichida ochish (Mini App)
    📁 Fayl        — web ilova / kompyuter dasturi bilan almashish: jurnal faylini yuborish va olish
    ⏰ Eslatma     — kun oxirida yo'qlama qilinmagan darslar haqida xabar

Ma'lumot har foydalanuvchining o'z papkasida: foydalanuvchilar/<ID>/journal.db — kompyuter dasturining journal.db
bilan bir xil tuzilma (meta, classes, students). Fayl web ilova zaxirasi bilan to'liq mos: bot bilmaydigan kalitlar
(web sozlamalari, guruhlar, to'lovlar) o'zgarishsiz saqlanadi.
Hisob-kitob (o'rtacha, davomat, xavf mezonlari) kompyuter dasturidagi Store.report_rows bilan bir xil
(tests/test_jurnal_bot.py golden.json bilan solishtiradi). Faqat standart Python kutubxonalari kerak.
"""
import datetime as dt
import html
import json
import os
import re
import shutil
import sqlite3
import tempfile
import threading
import time
import urllib.request
from pathlib import Path

B = None                                                        # emaktab_tgbot moduli: setup() beradi
WEBAPP_URL = (os.environ.get("WEBAPP_URL") or "https://akmal1st.github.io/yoqlama-jurnal/").strip()   # "-" — o'chiq
TODAY = None                                                    # testlar uchun: "YYYY-MM-DD"
NOW_HM = None                                                   # testlar uchun: "HH:MM"
JOURNALS = {}                                                   # chat -> jurnal lug'ati (xotirada)
JSTEP = {}                                                      # chat -> kutilayotgan matn: ("topic", ci, d) va h.k.
JTMP = {}                                                       # chat -> yangi sinf ustasi, import qilinadigan fayl
LOCK = threading.RLock()

ATT_MARKS = ("s", "dq", "k", "kq")
ABSENT = ("s", "dq", "k")
CH_MARK = "ch"
ATT_CYCLE = ("", "s", "dq", "k", "kq")
ATT_NAME = {"": "keldi", "s": "sababsiz", "dq": "sababli", "k": "kasal", "kq": "kech qoldi", "ch": "chet elda"}
ATT_ICON = {"": "✓", "s": "🔴 S", "dq": "🔵 DQ", "k": "🟣 K", "kq": "🟤 KQ", "ch": "✈️ CH"}
WD = ("Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya")
WD_FULL = ("Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba")
MONTHS_GEN = ("yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr")
EFFECT_TADA = "5046509860389126442"                             # 🎉 xabar effekti (faqat shaxsiy chatda)
REMIND_TIMES = ("", "13:00", "14:00", "15:00", "16:00", "18:00")
PAST = (("today", "Faqat bugun"), ("week", "Oxirgi 7 kun"), ("all", "Istalgan o'tgan kun"))

DEFAULTS = {
    "ranges": [{"min": 1, "color": "#ef9a9a", "name": "Past"}, {"min": 5, "color": "#fff59d", "name": "O'rta"},
               {"min": 8, "color": "#81c784", "name": "Yaxshi"}],
    "attendance": {"s": "#c62828", "dq": "#90caf9", "k": "#ce93d8", "kq": "#a1887f", "ch": "#80cbc4", "x": "#cfd8dc"},
    "method_weekday": None, "lesson_weekdays": [0, 1, 2, 3, 4, 5], "quarters": [None, None, None, None],
    "holidays": ["01-01", "03-08", "03-21", "05-09", "09-01", "10-01", "12-08"],
    "risk": {"avg_below": 5.0, "att_below": 80, "s_ge": 3, "min_n": 3, "few_lt": 4, "avg_min_grades": 3, "consec_ge": 3,
             "drop_ge": 1.5, "work_below": 40,
             "on": {"avg": True, "few": True, "min_n": True, "att": True, "s": True, "qgrade": True, "consec": False,
                    "drop": False, "work": False}},
}


def e(s):
    return html.escape(str(s), quote=False)


# ================================================================== jurnal yadrosi (Telegram'siz, testlanadi)
def grades_of(m):
    """'8' → [8], '8/9kq' → [8, 9], 'kq' / 's' → []."""
    g = m[:-2] if m.endswith("kq") else m
    parts = g.split("/") if g else []
    return [int(x) for x in parts] if parts and all(x.isdigit() for x in parts) else []


def late_of(m):
    return m.endswith("kq")


def att_part(m):
    """Belgidagi davomat qismi: 's' | 'dq' | 'k' | 'ch' | 'kq' | ''."""
    if not m:
        return ""
    if not grades_of(m) and m != "kq":
        return m
    return "kq" if late_of(m) else ""


def build_mark(grades, late):
    return "/".join(str(g) for g in grades) + ("kq" if late else "")


def count_att(vals, code):
    return sum(1 for v in vals if (late_of(v) if code == "kq" else v == code))


def short_mark(m):
    """Jadval katagi uchun: '8', '8/9', 'S', 'DQ', '8*' (kech qolib baho olgan)."""
    if not m:
        return "·"
    gs = grades_of(m)
    if gs:
        return "/".join(map(str, gs)) + ("*" if late_of(m) else "")
    return {"x": "×"}.get(m, m.upper())


def num(v, f, suffix=""):
    return format(v, f) + suffix if v is not None else "—"


def label(c):
    return f"{c['name']} · {c['subject']}" if c.get("subject") else c["name"]


def fmt(d):
    return f"{d[8:]}.{d[5:7]}.{d[:4]}"


def fmt5(d):
    return f"{d[8:]}.{d[5:7]}"


def long_date(d):
    x = dt.date.fromisoformat(d)
    return f"{WD_FULL[x.weekday()]}, {x.day}-{MONTHS_GEN[x.month - 1]}"


def today():
    return TODAY or dt.date.today().isoformat()


def wd_of(d):
    return dt.date.fromisoformat(d).weekday()


def d8(d):
    return d.replace("-", "")


def iso8(s):
    return f"{s[:4]}-{s[4:6]}-{s[6:8]}" if re.fullmatch(r"\d{8}", s or "") else None


def new_sid():
    return f"{int(time.time() * 1000):x}{os.urandom(3).hex()}"[:14]


def new_journal():
    return normalize({"version": 2, "classes": [], "settings": json.loads(json.dumps(DEFAULTS)), "changelog": []})


def normalize(d):
    """Tashqaridan kelgan jurnal: kerakli kalitlar bo'lsin, noma'lumlari o'zgarishsiz qolsin (web/kompyuter bilan mos)."""
    if not isinstance(d, dict) or not isinstance(d.get("classes"), list):
        raise ValueError("Bu yo'qlama jurnali fayli emas (classes ro'yxati yo'q)")
    d.setdefault("version", 2)
    st = d.setdefault("settings", {})
    if not isinstance(st, dict):
        st = d["settings"] = {}
    for k, v in DEFAULTS.items():
        if k not in st:
            st[k] = json.loads(json.dumps(v))
    risk = st["risk"]
    for k, v in DEFAULTS["risk"].items():
        if k == "on":
            risk.setdefault("on", {})
            for kk, vv in v.items():
                risk["on"].setdefault(kk, vv)
        else:
            risk.setdefault(k, v)
    if not isinstance(st.get("quarters"), list) or len(st["quarters"]) != 4:
        st["quarters"] = [None, None, None, None]
    if not isinstance(d.get("changelog"), list):
        d["changelog"] = []
    d["classes"] = [c for c in d["classes"] if isinstance(c, dict)]
    for c in d["classes"]:
        c["name"] = str(c.get("name") or "?")
        c["subject"] = str(c.get("subject") or "")
        c["dates"] = sorted({x for x in c.get("dates") or [] if isinstance(x, str) and re.fullmatch(r"\d{4}-\d\d-\d\d", x)})
        for k in ("extra_x", "held", "works", "att_ok", "analyses", "students_off"):
            if not isinstance(c.get(k), list):
                c[k] = []
        if not isinstance(c.get("lessons"), dict):
            c["lessons"] = {}
        c.setdefault("has_exam", False)
        c.setdefault("weekdays", None)
        studs = []
        for s in c.get("students") or []:
            if not isinstance(s, dict):
                continue
            s["name"] = str(s.get("name") or "?")
            if not isinstance(s.get("marks"), dict):
                s["marks"] = {}
            s["marks"] = {k: str(v) for k, v in s["marks"].items() if isinstance(k, str) and v not in (None, "")}
            if not isinstance(s.get("scores"), dict):
                s["scores"] = {}
            s.setdefault("id", new_sid())
            studs.append(s)
        c["students"] = studs
    return d


# — saqlash: kompyuter dasturining journal.db tuzilmasi (Store._db_read / _db_write bilan bir xil) —
def read_db(path):
    con = sqlite3.connect(f"file:{Path(path).as_posix()}?mode=ro", uri=True)
    try:
        data = {k: json.loads(v) for k, v in con.execute("SELECT k, v FROM meta") if not k.startswith("_")}
        data["classes"] = [json.loads(doc) for (doc,) in con.execute("SELECT doc FROM classes ORDER BY pos")]
    except sqlite3.Error as ex:
        raise ValueError(f"Jurnal bazasi o'qilmadi: {ex}") from ex
    finally:
        con.close()
    return data


def write_db(data, path):
    path = Path(path)
    tmp = path.with_name(path.name + ".tmp")
    tmp.unlink(missing_ok=True)
    con = sqlite3.connect(tmp)
    try:
        con.executescript("""
            CREATE TABLE meta(k TEXT PRIMARY KEY, v TEXT NOT NULL);
            CREATE TABLE classes(pos INTEGER PRIMARY KEY, name TEXT NOT NULL, subject TEXT NOT NULL, doc TEXT NOT NULL);
            CREATE TABLE students(class_pos INTEGER NOT NULL, pos INTEGER NOT NULL, name TEXT NOT NULL, PRIMARY KEY(class_pos, pos));""")
        dump = lambda v: json.dumps(v, ensure_ascii=False)        # noqa: E731
        con.executemany("INSERT INTO meta VALUES (?, ?)", [(k, dump(v)) for k, v in data.items() if k != "classes"] + [("_schema", "1")])
        for i, c in enumerate(data["classes"]):
            con.execute("INSERT INTO classes VALUES (?, ?, ?, ?)", (i, c.get("name", ""), c.get("subject", ""), dump(c)))
            con.executemany("INSERT INTO students VALUES (?, ?, ?)", [(i, j, s.get("name", "")) for j, s in enumerate(c["students"])])
        con.commit()
    finally:
        con.close()
    os.replace(tmp, path)
    try:
        path.chmod(0o600)
    except OSError:
        pass


def parse_file(name, raw):
    """Yuborilgan fayl → jurnal lug'ati: web ilova / kompyuter dasturi zaxirasi (.json) yoki journal.db."""
    if raw[:16] == b"SQLite format 3\x00":
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "journal.db"
            p.write_bytes(raw)
            return normalize(read_db(p))
    try:
        d = json.loads(raw.decode("utf-8-sig"))
    except (UnicodeDecodeError, ValueError) as ex:
        raise ValueError("Fayl o'qilmadi: JSON yoki journal.db bo'lishi kerak") from ex
    if isinstance(d, dict) and "ct" in d and "iv" in d and "classes" not in d:
        raise ValueError("Bu zaxira parol bilan shifrlangan. Web ilovada oching va «Sozlamalar → Ma'lumotlar → "
                         "Faylga zaxira» bilan oddiy fayl qilib yuboring")
    return normalize(d)


# — sanalar va darslar —
def quarter_range(D, q):
    r = D["settings"]["quarters"][q - 1] if 1 <= q <= 4 else None
    return (r[0], r[1]) if r and r[0] and r[1] else None


def quarter_of(D, d):
    for q in range(1, 5):
        r = quarter_range(D, q)
        if r and r[0] <= d <= r[1]:
            return q
    return None


def period_now(D, t=None):
    t = t or today()
    q = quarter_of(D, t)
    return (quarter_range(D, q)[0], t, q) if q else (t[:8] + "01", t, None)


def period(D, key, t=None):
    """(boshlanish, tugash, chorak, nom): cur — joriy chorak (yo'q bo'lsa oy), m — shu oy, w — shu hafta."""
    t = t or today()
    if key == "m":
        return t[:8] + "01", t, None, "shu oy"
    if key == "w":
        return (dt.date.fromisoformat(t) - dt.timedelta(days=wd_of(t))).isoformat(), t, None, "shu hafta"
    lo, hi, q = period_now(D, t)
    return lo, hi, q, f"{q}-chorak" if q else "shu oy"


def is_nolesson(D, c, d):
    if d in c["extra_x"]:
        return True
    mw = D["settings"].get("method_weekday")
    return mw is not None and mw >= 0 and wd_of(d) == mw and d not in c["held"]


def holiday_set(D, year):
    out = set()
    for h in D["settings"].get("holidays") or []:
        h = str(h).strip()
        if re.fullmatch(r"\d\d-\d\d", h):
            out.add(f"{year}-{h}")
        elif re.fullmatch(r"\d{4}-\d\d-\d\d", h):
            out.add(h)
    return out


def lesson_wds(D, c):
    return c["weekdays"] if c.get("weekdays") else D["settings"].get("lesson_weekdays") or []


def add_lesson_days(D, c, lo, hi, wds=None):
    """lo..hi oralig'idagi dars kunlarini jurnalga qo'shadi; bayramlar X bo'ladi (web ilovadagi addLessonDays)."""
    wds = lesson_wds(D, c) if wds is None else wds
    have, fresh = set(c["dates"]), []
    x, end = dt.date.fromisoformat(lo), dt.date.fromisoformat(hi)
    while x <= end:
        s = x.isoformat()
        if x.weekday() in wds and s not in have:
            fresh.append(s)
        x += dt.timedelta(days=1)
    for s in fresh:
        if s in holiday_set(D, int(s[:4])) and s not in c["held"] and s not in c["extra_x"]:
            c["extra_x"].append(s)
    c["dates"] = sorted(set(c["dates"]) | set(fresh))
    return fresh


def auto_dates(D, t=None):
    """Joriy chorak boshlanganda dars kunlari o'zi yaratiladi (web ilova bilan bir xil kalit — ikki marta qilinmaydi)."""
    t = t or today()
    q = quarter_of(D, t)
    if not q:
        return 0
    lo, hi = quarter_range(D, q)
    gen = D.setdefault("web", {}).setdefault("gen", [])
    n = 0
    for c in D["classes"]:
        key = f"{q}:{lo}:{c['name']}:{c['subject']}"
        if c.get("weekdays") and not c.get("kind") and key not in gen:
            n += len(add_lesson_days(D, c, lo, hi))
            gen.append(key)
    return n


def sched_today(D, t):
    """Dars jadvali (web ilova: web.schedule) bo'yicha bugungi soatlar: [(ci, soat raqami, boshlanish, tugash)]."""
    s = (D.get("web") or {}).get("schedule")
    wd = wd_of(t)
    if not isinstance(s, dict) or not isinstance(s.get("days"), list) or wd > 5 or wd >= len(s["days"]):
        return []
    keys = {f"{c['name']}|{c['subject']}": ci for ci, c in enumerate(D["classes"])}
    bells = s.get("bells") or []
    out = []
    for no, k in enumerate(s["days"][wd] or []):
        if k and k in keys:
            b = bells[no] if no < len(bells) and isinstance(bells[no], list) else ["", ""]
            out.append((keys[k], no, (b + ["", ""])[0], (b + ["", ""])[1]))
    return out


def has_marks(c, d):
    return any(d in s["marks"] for s in c["students"])


def is_done(c, d):
    return has_marks(c, d) or d in c["att_ok"]


def lessons_today(D, t=None):
    """Bugungi darslar: [{ci, c, done, slots}] — jadval bo'lsa soat tartibida."""
    t = t or today()
    sc = sched_today(D, t)
    out = []
    for ci, c in enumerate(D["classes"]):
        if c.get("kind") or is_nolesson(D, c, t):
            continue
        slots = [x for x in sc if x[0] == ci]
        if t in c["dates"] or slots or (c.get("weekdays") and wd_of(t) in c["weekdays"]):
            out.append({"ci": ci, "c": c, "done": is_done(c, t), "slots": slots})
    out.sort(key=lambda x: x["slots"][0][1] if x["slots"] else 99)
    return out


def can_edit(D, d, t=None):
    t = t or today()
    p = (D.get("web") or {}).get("past") or "today"
    if d == t:
        return True
    if d > t or p == "today":
        return False
    return p == "all" or (dt.date.fromisoformat(t) - dt.date.fromisoformat(d)).days <= 7


def sum_on(c, d):
    return next((w for w in c["works"] if w.get("date") == d), None)


def log_change(D, c, s, d, old, new):
    if not old:
        return
    lg = D.setdefault("changelog", [])
    lg.append({"t": dt.datetime.now().isoformat(timespec="seconds"), "cls": label(c), "student": s["name"],
               "sid": s.get("id"), "date": d, "old": old, "new": new, "kind": "edit" if new else "clear"})
    del lg[:-5000]


def put_mark(D, c, si, d, new, t=None):
    """Bitta katakka belgi. Qaytaradi: None (bajarildi yoki o'zgarish yo'q) yoki sabab matni."""
    t = t or today()
    if d > t:
        return "Kelgusi kunga belgi qo'yib bo'lmaydi"
    if not can_edit(D, d, t):
        return ("Faqat bugungi kunga belgi qo'yiladi. O'tgan darslar: ⚙️ Sozlamalar → «O'tgan darslarga belgi»"
                if ((D.get("web") or {}).get("past") or "today") == "today" else "Bu kun 7 kundan oldin — sozlamani o'zgartiring")
    if is_nolesson(D, c, d):
        return "Bu kunda dars yo'q (X)"
    s = c["students"][si]
    if s.get("joined") and d < str(s["joined"]):
        return f"{s['name']} {fmt(str(s['joined']))} dan qo'shilgan — undan oldingi darsga belgi qo'yilmaydi"
    old = s["marks"].get(d, "")
    if old == new:
        return None
    w = sum_on(c, d)
    if w and grades_of(new) and grades_of(new) != grades_of(old):
        return f"Bugun {str(w.get('type', '')).upper()}: oddiy baho qo'yilmaydi, faqat yo'qlama. Ballni web ilovada kiriting"
    if d not in c["dates"]:
        c["dates"] = sorted(set(c["dates"]) | {d})
    if new:
        s["marks"][d] = new
    else:
        s["marks"].pop(d, None)
    log_change(D, c, s, d, old, new)
    return None


def next_att(old):
    """Yo'qlama tugmasi: ✓ → S → DQ → K → KQ → ✓ (KQ bahoni saqlaydi, S/DQ/K uni o'chiradi)."""
    a = att_part(old)
    v = ATT_CYCLE[(ATT_CYCLE.index(a) + 1) % len(ATT_CYCLE)] if a in ATT_CYCLE else ""
    return v if v in ABSENT else build_mark(grades_of(old), v == "kq")


def all_present(D, c, d, t=None):
    """«Hamma keldi»: S/DQ/K belgilarini olib tashlaydi va darsni o'tilgan deb belgilaydi."""
    n = 0
    for si, s in enumerate(c["students"]):
        if att_part(s["marks"].get(d, "")) in ABSENT and put_mark(D, c, si, d, "", t) is None:
            n += 1
    if d not in c["att_ok"]:
        c["att_ok"].append(d)
    if d not in c["dates"]:
        c["dates"] = sorted(set(c["dates"]) | {d})
    return n


def report_rows(D, c, lo, hi, q=None, t=None):
    """Kompyuter dasturidagi Store.report_rows bilan bir xil (chorak bahosi «2» qoidasidan tashqari — u web ilovada)."""
    t = t or today()
    dates = [d for d in c["dates"] if lo <= d <= hi and d <= t and not is_nolesson(D, c, d)]
    lessons = len(dates)
    risk = D["settings"]["risk"]
    on = risk.get("on", {})
    bsb_taken = any(w.get("type") == "bsb" and lo <= w.get("date", "") <= min(hi, t) for w in c["works"])
    rows = []
    for st in c["students"]:
        vals = [st["marks"][d] for d in dates if d in st["marks"]]
        gr = [g for m in vals for g in grades_of(m)]
        cnt = {m: count_att(vals, m) for m in ATT_MARKS}
        absent = cnt["s"] + cnt["dq"] + cnt["k"]
        n_ch = sum(1 for v in vals if v == CH_MARK)
        own = lessons - n_ch
        att = round(100.0 * (own - absent) / own, 1) if own > 0 else None
        avg = round(sum(gr) / len(gr), 2) if gr else None
        why = []
        if on.get("avg") and avg is not None and len(gr) >= max(1, int(risk.get("avg_min_grades", 3))) and avg < risk["avg_below"]:
            why.append(f"o'rtacha {avg:.1f} < {risk['avg_below']:g}")
        few = bool(on.get("few") and lessons and lessons >= int(risk.get("few_lt", 4)) and len(gr) < int(risk.get("few_lt", 4)))
        if few:
            why.append(f"shu kungacha {len(gr)} ta baho (< {int(risk.get('few_lt', 4))})")
        if not few and on.get("min_n") and risk.get("min_n") and lessons and bsb_taken and len(gr) < risk["min_n"]:
            why.append(f"baholar soni {len(gr)} < {risk['min_n']}")
        if on.get("att") and att is not None and att < risk["att_below"]:
            why.append(f"davomat {att:.0f}% < {risk['att_below']}%")
        if on.get("s") and cnt["s"] >= risk["s_ge"]:
            why.append(f"sababsiz {cnt['s']} ta")
        if on.get("consec"):
            run = best = 0
            for d in dates:
                run = run + 1 if att_part(st["marks"].get(d, "")) in ABSENT else 0
                best = max(best, run)
            if best >= max(2, int(risk.get("consec_ge", 3))):
                why.append(f"ketma-ket {best} dars qoldirgan")
        if on.get("drop") and len(gr) >= 4:
            h = len(gr) // 2
            a1, a2 = sum(gr[:h]) / h, sum(gr[h:]) / len(gr[h:])
            if a1 - a2 >= float(risk.get("drop_ge", 1.5)):
                why.append(f"baholar pasaymoqda ({a1:.1f} → {a2:.1f})")
        if on.get("work"):
            for w in c["works"]:
                v = st.get("scores", {}).get(w.get("id"))
                if lo <= w.get("date", "") <= hi and isinstance(v, (int, float)) and not isinstance(v, bool) and w.get("max"):
                    pct = 100.0 * v / w["max"]
                    if pct < float(risk.get("work_below", 40)):
                        why.append(f"{str(w['type']).upper()} {fmt(w['date'])[:5]}: {pct:.0f}%")
        rows.append({"name": st["name"], "n": len(gr), "avg": avg, **cnt, "ch": n_ch, "absent": absent, "att": att,
                     "why": why, "risk": bool(why)})
    return rows, lessons, dates


def class_totals(rows):
    gr = [r for r in rows if r["avg"] is not None]
    at = [r for r in rows if r["att"] is not None]
    return (round(sum(r["avg"] for r in gr) / len(gr), 2) if gr else None,
            round(sum(r["att"] for r in at) / len(at), 1) if at else None,
            sum(1 for r in rows if r["risk"]))


def band(D, v):
    """Baho rangi (sozlamadagi oraliqlar): 🔴 past · 🟡 o'rta · 🟢 yaxshi."""
    if v is None:
        return "⚪"
    rs = sorted(D["settings"].get("ranges") or DEFAULTS["ranges"], key=lambda r: r["min"])
    k = 0
    for i, r in enumerate(rs):
        if v >= r["min"]:
            k = i
    return ("🔴", "🟡", "🟢", "🔵")[min(k, 3)] if len(rs) > 1 else "🟢"


def parent_text(D, c, si, key="cur", t=None, rich=False, limit=None):
    """Ota-onaga xabar: davr bo'yicha o'rtacha, davomat, oxirgi baholar."""
    lo, hi, q, pname = period(D, key, t)
    s = c["students"][si]
    rows, _, dates = report_rows(D, c, lo, hi, q, t)
    r = rows[si]
    b = (lambda x: f"<b>{e(x)}</b>") if rich else str
    last = [f"{short_mark(s['marks'][d])}" for d in reversed(dates) if d in s["marks"]][:6]
    avg = b(f"{r['avg']:.1f}") if r["avg"] is not None else "—"
    att = b(f"{r['att']:.0f}%") if r["att"] is not None else "—"
    lines = [f"Assalomu alaykum! {b(s['name'])} — {e(label(c)) if rich else label(c)}, {pname}:",
             f"• O'rtacha baho: {avg} ({r['n']} ta baho)",
             f"• Davomat: {att}"
             + (f", qoldirgan darslar: {r['absent']}" + (f" (sababsiz {r['s']})" if r["s"] else "") if r["absent"] else ""),
             ]
    if last:
        lines.append(f"• Oxirgi belgilar: {', '.join(last)}")
    if r["why"]:
        lines.append(f"• E'tibor bering: {'; '.join(r['why'])}")
    lines.append("Hurmat bilan, fan o'qituvchisi.")
    txt = "\n".join(lines)
    if limit and len(txt) > limit:                              # nusxalash tugmasi 256 belgigacha
        txt = "\n".join(lines[:3] + [lines[-1]])[:limit]
    return txt


def parse_students(text):
    """Ro'yxat: har qatorda bitta ism; «1. », «1) », «- » kabi raqam/belgilar olib tashlanadi."""
    out, seen = [], set()
    for line in str(text).splitlines():
        n = re.sub(r"^\s*(\d+[.)]?|[-•*])\s*", "", line).strip()
        n = re.sub(r"\s+", " ", n)[:80]
        if n and n.lower() not in seen:
            seen.add(n.lower())
            out.append(n)
    return out[:80]


def parse_quarters(text):
    """«02.09.2026 - 29.10.2026» qatorlari (4 tagacha) → [[iso, iso] | None, …]."""
    out = []
    for line in str(text).splitlines()[:4]:
        ds = re.findall(r"(\d{1,2})[./-](\d{1,2})[./-](\d{4})", line)
        if len(ds) >= 2:
            try:
                a, b = (dt.date(int(y), int(m), int(d)).isoformat() for d, m, y in ds[:2])
            except ValueError:
                raise ValueError(f"Noto'g'ri sana: {line.strip()}") from None
            if a > b:
                raise ValueError(f"Boshlanish tugashdan keyin: {line.strip()}")
            out.append([a, b])
        else:
            out.append(None)
    if not any(out):
        raise ValueError("Sana topilmadi. Namuna: 02.09.2026 - 29.10.2026")
    return (out + [None] * 4)[:4]


def new_class(D, name, subject, students, weekdays):
    c = {"name": name, "subject": subject, "dates": [], "extra_x": [], "held": [], "lessons": {}, "has_exam": False,
         "weekdays": sorted(weekdays) or None, "analyses": [], "works": [], "att_ok": [], "students_off": [],
         "students": [{"id": new_sid(), "name": n, "marks": {}, "scores": {}} for n in students]}
    D["classes"].append(c)
    auto_dates(D)
    return len(D["classes"]) - 1


# ================================================================== Telegram qismi
def setup(bot):
    global B
    B = bot


def jpath(chat):
    return B.home(chat) / "journal.db"


def J(chat):
    with LOCK:
        if chat not in JOURNALS:
            p = jpath(chat)
            JOURNALS[chat] = normalize(read_db(p)) if p.exists() else new_journal()
            if auto_dates(JOURNALS[chat]):
                save(chat)
        return JOURNALS[chat]


def save(chat):
    with LOCK:
        p = jpath(chat)
        day = p.with_name(f"journal.{today()}.bak")              # har kuni bitta nusxa (oxirgi 7 kun)
        if p.exists() and not day.exists():
            shutil.copy2(p, day)
            for old in sorted(p.parent.glob("journal.*.bak"))[:-7]:
                old.unlink(missing_ok=True)
        write_db(JOURNALS[chat], p)


def drop(chat):
    """Foydalanuvchi o'chirilganda xotiradagi jurnal ham ketadi (fayllarni bot o'zi o'chiradi)."""
    with LOCK:
        JOURNALS.pop(chat, None)
    JSTEP.pop(chat, None)
    JTMP.pop(chat, None)


def jconf(chat):
    c = B.conf(chat)
    c.setdefault("jr", {"remind": "15:00", "last": ""})
    return c["jr"]


def btn(text, data):
    return {"text": text, "callback_data": data[:64]}


def webapp_btn(text="🌐 Ilovada ochish"):
    return {"text": text, "web_app": {"url": WEBAPP_URL}} if WEBAPP_URL.startswith("https://") else None


def ikb(rows):
    return {"inline_keyboard": [[b if isinstance(b, dict) else btn(*b) for b in row if b] for row in rows if row and any(row)]}


def send(chat, text, markup=None, mid=None, effect=None, reply_to=None):
    """HTML xabar: mid bo'lsa joyida tahrirlanadi. Xato HTML bo'lsa oddiy matn bilan qayta yuboriladi."""
    p = {"chat_id": chat, "text": text[:4096], "parse_mode": "HTML", "link_preview_options": {"is_disabled": True}}
    if mid:
        r = B.tg("editMessageText", {**p, "message_id": mid, "reply_markup": markup or {"inline_keyboard": []}})
        d = str(r.get("description", ""))
        if r.get("ok") or "not modified" in d:
            return mid
    if markup:
        p["reply_markup"] = markup
    if effect:
        p["message_effect_id"] = effect
    if reply_to:
        p["reply_parameters"] = {"message_id": reply_to, "allow_sending_without_reply": True}
    r = B.tg("sendMessage", p)
    if not r.get("ok") and effect:                              # effekt qo'llab-quvvatlanmasa — effektsiz
        p.pop("message_effect_id", None)
        r = B.tg("sendMessage", p)
    if not r.get("ok") and "parse" in str(r.get("description", "")).lower():
        p.pop("parse_mode")
        p["text"] = html.unescape(re.sub(r"<[^>]+>", "", text))[:4096]
        r = B.tg("sendMessage", p)
    return (r.get("result") or {}).get("message_id")


def toast(cq, text="", alert=False):
    B.tg("answerCallbackQuery", {"callback_query_id": cq["id"], "text": text[:200], "show_alert": alert})


def react(chat, mid, emoji="👍"):
    if mid:
        B.tg("setMessageReaction", {"chat_id": chat, "message_id": mid, "reaction": [{"type": "emoji", "emoji": emoji}]})


def ask(chat, text, step, placeholder="", extra=None):
    """Matn so'raydi: ForceReply (yozish maydoni o'zi ochiladi, ichida namuna)."""
    JSTEP[chat] = step
    send(chat, text, {"force_reply": True, "input_field_placeholder": placeholder[:64]} if not extra else extra)


def cls_ok(chat, ci):
    D = J(chat)
    try:
        ci = int(ci)
    except (TypeError, ValueError):
        return None
    return ci if 0 <= ci < len(D["classes"]) and not D["classes"][ci].get("kind") else None


def short_name(n, w=18):
    p = n.split()
    s = f"{p[0]} {p[1][0]}." if len(p) > 1 and len(n) > w else n
    return s[:w]


# ------------------------------------------------------------------ ekranlar
def screen_today(chat, mid=None):
    D = J(chat)
    t = today()
    q = quarter_of(D, t)
    head = f"📅 <b>{long_date(t)}</b>"
    if q:
        head += f" · {q}-chorak, {(dt.date.fromisoformat(t) - dt.date.fromisoformat(quarter_range(D, q)[0])).days // 7 + 1}-hafta"
    if not D["classes"]:
        return send(chat, head + "\n\nJurnalda hali sinf yo'q.\n\n"
                    "• Web ilovada jurnal yuritsangiz: u yerda <b>Sozlamalar → Ma'lumotlar → Faylga zaxira</b>, "
                    "so'ng faylni shu chatga yuboring.\n• Yoki yangi sinfni shu yerda yarating.",
                    ikb([[("➕ Yangi sinf", "j:N")], [("📁 Fayldan yuklash", "j:fi"), webapp_btn()]]), mid)
    L = lessons_today(D, t)
    hm = NOW_HM or time.strftime("%H:%M")
    slots = sorted((x for les in L for x in les["slots"] if x[2]), key=lambda x: x[1])
    cur = next((x for x in slots if x[2] <= hm < x[3]), None)
    nxt = None if cur else next((x for x in slots if hm < x[2]), None)
    lines, rows = [], []
    for k, les in enumerate(L, 1):
        c, ci = les["c"], les["ci"]
        tag = ", ".join(f"{no + 1}-soat" + (f" {a}–{b}" if a else "") for _, no, a, b in les["slots"])
        live = " · <b>HOZIR</b>" if cur and cur[0] == ci else " · KEYINGI" if nxt and nxt[0] == ci else ""
        if les["done"]:
            ab = [s["name"] for s in c["students"] if att_part(s["marks"].get(t, "")) in ABSENT]
            ng = sum(1 for s in c["students"] if grades_of(s["marks"].get(t, "")))
            st = f"✅ Yo'qlama: {'hamma keldi' if not ab else f'{len(ab)} kelmadi'}" + (f" · {ng} baho" if ng else "")
        else:
            st = "⏳ Yo'qlama qilinmagan"
        topic = (c["lessons"].get(t) or {}).get("topic")
        w = sum_on(c, t)
        note = (f"📝 Bugun {str(w.get('type', '')).upper()}" + (f" ({w['max']} ball)" if w.get("max") else "")) if w \
            else f"📖 {e(topic)}" if topic else "📖 <i>Mavzu kiritilmagan</i>"
        prev = next((d for d in reversed(c["dates"]) if d < t and not is_nolesson(D, c, d)), None)
        phw = prev and (c["lessons"].get(prev) or {}).get("hw")
        lines.append(f"<b>{k}. {e(label(c))}</b>" + (f" · {tag}" if tag else "") + live + f"\n{st}\n{note}"
                     + (f"\n🏠 Uyga berilgan ({fmt5(prev)}): {e(phw)}" if phw else ""))
        rows.append([(f"▶ {label(c)}"[:40], f"j:L:{ci}:{d8(t)}")] + ([] if les["done"] else [("✓ Hamma keldi", f"j:OK:{ci}:{d8(t)}")]))
    left = sum(1 for x in L if not x["done"])
    title = f"Bugun {len(L)} ta darsingiz bor" + (f", {left} tasida yo'qlama qilinmagan" if left else " — hammasi belgilandi ✅") \
        if L else "Bugun jadvalda dars yo'q. Kerak bo'lsa, istalgan sinfni «📒 Jurnal» dan oching."
    body = head + f"\n<blockquote>{title}</blockquote>\n\n" + "\n\n".join(lines)
    risk = []
    for ci, c in enumerate(D["classes"]):
        if c.get("kind"):
            continue
        lo, hi, qq = period_now(D, t)
        rr, _, _ = report_rows(D, c, lo, hi, qq, t)
        risk += [f"{e(r['name'])} ({e(c['name'])}) — {e('; '.join(r['why']))}" for r in rr if r["risk"]]
    if risk:
        body += f"\n\n⚠️ <b>Xavf ostida: {len(risk)} o'quvchi</b>\n<blockquote expandable>" + "\n".join(risk[:40]) + "</blockquote>"
    rows.append([("📒 Boshqa sinf", "j:C"), webapp_btn()])
    return send(chat, body, ikb(rows), mid)


def screen_lesson(chat, ci, d, mid=None):
    """«Darsni boshlash»: yo'qlama, baholash, mavzu bir joyda."""
    D = J(chat)
    c = D["classes"][ci]
    n = len(c["students"])
    ab = [(s["name"], att_part(s["marks"].get(d, ""))) for s in c["students"] if att_part(s["marks"].get(d, "")) in ABSENT]
    late = [s["name"] for s in c["students"] if late_of(s["marks"].get(d, ""))]
    gr = [(s["name"], s["marks"][d]) for s in c["students"] if grades_of(s["marks"].get(d, ""))]
    les = c["lessons"].get(d) or {}
    txt = [f"<b>{e(label(c))}</b> — {long_date(d)}", f"👥 {n} o'quvchi"]
    if is_nolesson(D, c, d):
        txt.append("✖️ Bu kunda dars yo'q (X)")
    elif is_done(c, d):
        txt.append(f"✅ Keldi: <b>{n - len(ab)}</b> / {n}" + (f" · kech qoldi: {len(late)}" if late else ""))
    else:
        txt.append("⏳ Yo'qlama qilinmagan")
    if ab:
        txt.append("<blockquote expandable>Kelmadi:\n" + "\n".join(f"• {e(x)} — {ATT_NAME[a]}" for x, a in ab) + "</blockquote>")
    if gr:
        txt.append(f"✍️ Baholar ({len(gr)}): " + ", ".join(f"{e(short_name(x, 14))} {short_mark(m)}" for x, m in gr[:30]))
    txt.append(f"📖 Mavzu: {e(les['topic'])}" if les.get("topic") else "📖 <i>Mavzu kiritilmagan</i>")
    if les.get("hw"):
        txt.append(f"🏠 Uyga vazifa: {e(les['hw'])}")
    k = f"{ci}:{d8(d)}"
    return send(chat, "\n".join(txt), ikb([
        [("✅ Yo'qlama", f"j:A:{k}"), ("✍️ Baholash", f"j:G:{k}")],
        [("📖 Mavzu va uy vazifasi", f"j:tp:{k}")],
        [("📋 Jadval", f"j:tb:{ci}"), ("📊 Sinf", f"j:c:{ci}")],
        [("◀ Bugun", "j:T")]]), mid)


def screen_att(chat, ci, d, mid=None):
    D = J(chat)
    c = D["classes"][ci]
    k = f"{ci}:{d8(d)}"
    rows, cur = [], []
    ab = 0
    for si, s in enumerate(c["students"]):
        a = att_part(s["marks"].get(d, ""))
        ab += a in ABSENT
        cur.append(btn(f"{ATT_ICON.get(a, a.upper())} {short_name(s['name'])}", f"j:a:{k}:{si}"))
        if len(cur) == 2:
            rows.append(cur)
            cur = []
    if cur:
        rows.append(cur)
    rows.append([btn("✓ Hamma keldi", f"j:ok:{k}"), btn("✅ Tayyor", f"j:ad:{k}")])
    rows.append([btn("◀ Dars", f"j:L:{k}")])
    n = len(c["students"])
    txt = (f"✅ <b>Yo'qlama · {e(label(c))}</b> — {fmt5(d)}\n"
           f"Keldi: <b>{n - ab}</b> / {n}\n"
           "<blockquote>Bosing: ✓ keldi → 🔴 S sababsiz → 🔵 DQ sababli → 🟣 K kasal → 🟤 KQ kech qoldi → ✓</blockquote>")
    return send(chat, txt, {"inline_keyboard": rows}, mid)


def screen_grades(chat, ci, d, mid=None):
    D = J(chat)
    c = D["classes"][ci]
    k = f"{ci}:{d8(d)}"
    rows, cur = [], []
    for si, s in enumerate(c["students"]):
        m = s["marks"].get(d, "")
        a = att_part(m)
        tag = short_mark(m) if grades_of(m) else ("—" if a in ABSENT else "")
        cur.append(btn((f"{tag} · " if tag else "") + short_name(s["name"]), f"j:g:{k}:{si}"))
        if len(cur) == 2:
            rows.append(cur)
            cur = []
    if cur:
        rows.append(cur)
    rows.append([btn("◀ Dars", f"j:L:{k}")])
    ng = sum(1 for s in c["students"] if grades_of(s["marks"].get(d, "")))
    n = len(c["students"])
    w = sum_on(c, d)
    note = f"\n⚠️ Bugun {str(w.get('type', '')).upper()}: oddiy baho qo'yilmaydi." if w else ""
    pct = round(100 * ng / n) if n else 0
    return send(chat, f"✍️ <b>Baholash · {e(label(c))}</b> — {fmt5(d)}\nBaholangan: <b>{ng}</b> / {n} ({pct}%"
                + (" ✓" if pct >= 30 else ", kamida 30% kerak") + f"){note}\nO'quvchini tanlang:", {"inline_keyboard": rows}, mid)


def screen_pick(chat, ci, d, si, mid=None, add=False):
    D = J(chat)
    c = D["classes"][ci]
    s = c["students"][si]
    m = s["marks"].get(d, "")
    k = f"{ci}:{d8(d)}:{si}"
    ap = "1" if add else "0"
    nums = [btn(str(v), f"j:v:{k}:{v}:{ap}") for v in range(1, 11)]
    rows = [nums[:5], nums[5:]]
    ext = []
    if len(grades_of(m)) == 1 and not add:
        ext.append(btn("➕ Ikkinchi baho", f"j:g2:{k}"))
    if m:
        ext.append(btn("🧹 O'chirish", f"j:v:{k}:0:0"))
    rows.append(ext)
    nav = []
    if si > 0:
        nav.append(btn("⬅️", f"j:g:{ci}:{d8(d)}:{si - 1}"))
    nav.append(btn("📋 Ro'yxat", f"j:G:{ci}:{d8(d)}"))
    if si + 1 < len(c["students"]):
        nav.append(btn("➡️", f"j:g:{ci}:{d8(d)}:{si + 1}"))
    rows.append(nav)
    now = short_mark(m) if m else "—"
    a = att_part(m)
    warn = f"\n⚠️ Bugun {ATT_NAME[a]} deb belgilangan — baho qo'ysangiz, yo'qlama belgisi o'rniga yoziladi." if a in ABSENT else ""
    return send(chat, f"✍️ <b>{e(s['name'])}</b> ({si + 1}/{len(c['students'])}) · {e(label(c))} — {fmt5(d)}\n"
                f"Hozir: <b>{e(now)}</b>{warn}\n" + ("<b>Ikkinchi bahoni</b> tanlang:" if add else "Baho tanlang:"),
                ikb(rows), mid)


def next_student(c, d, si):
    """Baho qo'yilgandan keyin: keyingi kelgan (S/DQ/K emas) o'quvchi."""
    for j in range(si + 1, len(c["students"])):
        if att_part(c["students"][j]["marks"].get(d, "")) not in ABSENT:
            return j
    return None


def screen_classes(chat, mid=None):
    D = J(chat)
    rows = []
    for ci, c in enumerate(D["classes"]):
        if not c.get("kind"):
            rows.append([(f"{label(c)} · {len(c['students'])}"[:60], f"j:c:{ci}")])
    grp = sum(1 for c in D["classes"] if c.get("kind"))
    rows.append([("➕ Yangi sinf", "j:N"), ("📁 Fayl", "j:F")])
    rows.append([("⚙️ Sozlamalar", "j:set"), webapp_btn()])
    txt = "📒 <b>Jurnal</b> — sinfni tanlang." if len(rows) > 2 else "📒 <b>Jurnal</b>\nHali sinf yo'q: yangisini yarating yoki web ilova faylini yuboring."
    if grp:
        txt += f"\n<i>{grp} ta guruh (to'garak, kurs) faqat web ilovada ochiladi.</i>"
    return send(chat, txt, ikb(rows), mid)


def screen_class(chat, ci, key="cur", mid=None):
    D = J(chat)
    c = D["classes"][ci]
    t = today()
    lo, hi, q, pname = period(D, key, t)
    rows, lessons, _ = report_rows(D, c, lo, hi, q, t)
    avg, att, nrisk = class_totals(rows)
    lines = []
    for i, r in enumerate(rows, 1):
        a = f"{r['avg']:.1f}" if r["avg"] is not None else "—"
        dv = f"{r['att']:.0f}%" if r["att"] is not None else "—"
        lines.append(f"{i}. {band(D, r['avg'])} {e(r['name'])} — {a} · {dv}" + (f" · {r['s']} S" if r["s"] else "") + (" ⚠️" if r["risk"] else ""))
    txt = (f"📒 <b>{e(label(c))}</b>\n{pname.capitalize()}: {fmt5(lo)} – {fmt5(hi)} · {lessons} dars · {len(rows)} o'quvchi\n"
           f"O'rtacha: {band(D, avg)} <b>{f'{avg:.2f}' if avg is not None else '—'}</b> · Davomat: <b>{f'{att:.0f}%' if att is not None else '—'}</b>"
           + (f" · ⚠️ Xavf ostida: <b>{nrisk}</b>" if nrisk else "")
           + "\n<blockquote expandable>" + ("\n".join(lines) or "O'quvchi yo'q") + "</blockquote>\n<i>Ism · o'rtacha · davomat. O'quvchi kartochkasi — pastdagi tugma.</i>")
    t8 = d8(t)
    per = [(("• " if key == k else "") + n, f"j:cp:{ci}:{k}") for k, n in (("cur", "Chorak"), ("m", "Oy"), ("w", "Hafta"))]
    return send(chat, txt, ikb([
        [("✅ Yo'qlama", f"j:A:{ci}:{t8}"), ("✍️ Baholash", f"j:G:{ci}:{t8}")],
        [("👤 O'quvchilar", f"j:SL:{ci}"), ("📋 Jadval", f"j:tb:{ci}")],
        [("⚠️ Xavf ostidagilar", f"j:R:{ci}:{key}"), ("📆 Boshqa kun", f"j:D:{ci}")],
        per,
        [("➕ O'quvchi qo'shish", f"j:as:{ci}"), ("◀ Sinflar", "j:C")]]), mid)


def screen_students(chat, ci, mid=None):
    c = J(chat)["classes"][ci]
    rows, cur = [], []
    for si, s in enumerate(c["students"]):
        cur.append(btn(f"{si + 1}. {short_name(s['name'], 22)}", f"j:S:{ci}:{si}"))
        if len(cur) == 2:
            rows.append(cur)
            cur = []
    if cur:
        rows.append(cur)
    rows.append([btn("◀ Sinf", f"j:c:{ci}")])
    return send(chat, f"👤 <b>{e(label(c))}</b> — o'quvchini tanlang:", {"inline_keyboard": rows[:99]}, mid)


def screen_risk(chat, ci, key="cur", mid=None):
    D = J(chat)
    c = D["classes"][ci]
    lo, hi, q, pname = period(D, key)
    rows, _, _ = report_rows(D, c, lo, hi, q)
    rk = [(si, r) for si, r in enumerate(rows) if r["risk"]]
    txt = f"⚠️ <b>Xavf ostidagilar · {e(label(c))}</b> ({pname})\n\n" + (
        "\n".join(f"• <b>{e(r['name'])}</b> — {e('; '.join(r['why']))}" for _, r in rk) or "Hech kim yo'q 👍")
    return send(chat, txt, ikb([[(f"👤 {short_name(r['name'], 24)}", f"j:S:{ci}:{si}")] for si, r in rk[:20]] + [[("◀ Sinf", f"j:c:{ci}")]]), mid)


def screen_table(chat, ci, mid=None):
    """Jurnal ko'rinishi: oxirgi 6 dars, eni teng (monospace) jadval."""
    D = J(chat)
    c = D["classes"][ci]
    t = today()
    ds = [d for d in c["dates"] if d <= t and not is_nolesson(D, c, d)][-6:]
    w = 11
    head = "№  " + "Ism".ljust(w) + "".join(fmt5(d)[:2].rjust(4) for d in ds)
    lines = [head, "-" * len(head)]
    for i, s in enumerate(c["students"], 1):
        nm = short_name(s["name"], w).ljust(w)
        lines.append(f"{i:<3}{nm}" + "".join(short_mark(s["marks"].get(d, ""))[:4].rjust(4) for d in ds))
    body = "\n".join(lines)
    if len(body) > 3500:
        body = body[:3500] + "\n…"
    mon = " · ".join(f"{fmt5(d)}" for d in ds)
    return send(chat, f"📋 <b>{e(label(c))}</b> — oxirgi {len(ds)} dars ({e(mon)})\n<pre>{e(body)}</pre>\n"
                "<i>S sababsiz · DQ sababli · K kasal · KQ kech qoldi · 8* kech qolib baho olgan · × dars yo'q</i>",
                ikb([[webapp_btn("🌐 To'liq jurnal (ilovada)")], [("◀ Sinf", f"j:c:{ci}")]]), mid)


def screen_days(chat, ci, mid=None):
    D = J(chat)
    c = D["classes"][ci]
    t = today()
    ds = [d for d in c["dates"] if d <= t and not is_nolesson(D, c, d)][-12:]
    pol = (D.get("web") or {}).get("past") or "today"
    rows, cur = [], []
    for d in reversed(ds):
        ok = can_edit(D, d, t)
        cur.append(btn(("✅ " if is_done(c, d) else "⏳ ") + f"{WD[wd_of(d)]} {fmt5(d)}" + ("" if ok else " 🔒"), f"j:L:{ci}:{d8(d)}"))
        if len(cur) == 3:
            rows.append(cur)
            cur = []
    if cur:
        rows.append(cur)
    rows.append([btn("◀ Sinf", f"j:c:{ci}")])
    note = {"today": "🔒 Hozir faqat bugungi kunga belgi qo'yiladi (⚙️ Sozlamalar → «O'tgan darslarga belgi»).",
            "week": "Oxirgi 7 kunga belgi qo'yish mumkin.", "all": "Istalgan o'tgan kunga belgi qo'yish mumkin."}.get(pol, "")
    return send(chat, f"📆 <b>{e(label(c))}</b> — dars kunini tanlang.\n✅ belgilangan · ⏳ belgilanmagan\n{note}", {"inline_keyboard": rows}, mid)


def screen_student(chat, ci, si, mid=None):
    D = J(chat)
    c = D["classes"][ci]
    s = c["students"][si]
    t = today()
    lo, hi, q, pname = period(D, "cur", t)
    rows, _, dates = report_rows(D, c, lo, hi, q, t)
    r = rows[si]
    hist = [f"{WD[wd_of(d)]} {fmt5(d)} — {e(short_mark(s['marks'][d]))}" + (f" ({ATT_NAME[att_part(s['marks'][d])]})" if att_part(s["marks"][d]) in ABSENT + ("kq",) else "")
            for d in reversed(dates) if d in s["marks"]][:25]
    par = s.get("par") or {}
    parl = ""
    if par.get("name") or par.get("phone") or par.get("tg"):
        parl = "\n👪 Ota-ona: " + e(par.get("name") or "") + (f" · <tg-spoiler>{e(par['phone'])}</tg-spoiler>" if par.get("phone") else "") \
            + (f" · @{e(par['tg'])}" if par.get("tg") else "")
    absn = ", ".join(f"{ATT_NAME[k]} {r[k]}" for k in ABSENT if r[k])
    txt = (f"👤 <b>{e(s['name'])}</b>\n{e(label(c))} · {pname} ({fmt5(lo)} – {fmt5(hi)})\n\n"
           f"O'rtacha: {band(D, r['avg'])} <b>{num(r['avg'], '.2f')}</b> ({r['n']} ta baho)\n"
           f"Davomat: <b>{num(r['att'], '.0f', '%')}</b>" + (f" · qoldirgan {r['absent']} ({absn})" if r["absent"] else "")
           + (f" · kech qolgan {r['kq']}" if r["kq"] else "")
           + (f"\n⚠️ <b>Xavf:</b> {e('; '.join(r['why']))}" if r["why"] else "")
           + parl
           + ("\n\n<b>Belgilar</b>\n<blockquote expandable>" + "\n".join(hist) + "</blockquote>" if hist else "\n\nBu davrda belgi yo'q."))
    msg = parent_text(D, c, si, t=t, limit=256)
    rows_kb = [[{"text": "📨 Ota-onaga yuborish", "switch_inline_query_chosen_chat":
                 {"query": f"o:{ci}.{si}", "allow_user_chats": True, "allow_group_chats": True}},
                {"text": "📋 Xabarni nusxalash", "copy_text": {"text": msg}}]]
    nav = []
    if si > 0:
        nav.append(btn("⬅️", f"j:S:{ci}:{si - 1}"))
    nav.append(btn("◀ Sinf", f"j:c:{ci}"))
    if si + 1 < len(c["students"]):
        nav.append(btn("➡️", f"j:S:{ci}:{si + 1}"))
    rows_kb.append(nav)
    return send(chat, txt, {"inline_keyboard": rows_kb}, mid)


def screen_file(chat, mid=None):
    D = J(chat)
    n = sum(len(c["students"]) for c in D["classes"])
    return send(chat, f"📁 <b>Jurnal fayli</b>\nHozir: {len(D['classes'])} ta sinf, {n} o'quvchi.\n\n"
                "<b>Web ilovadan botga:</b> ilovada <i>Sozlamalar → Ma'lumotlar → Faylga zaxira</i>, so'ng faylni shu chatga yuboring.\n"
                "<b>Botdan web ilovaga:</b> «📤 Faylni olish» → ilovada <i>Sozlamalar → Ma'lumotlar → Fayldan yuklash</i>.\n"
                "Kompyuter dasturining <code>journal.db</code> fayli ham qabul qilinadi.",
                ikb([[("📤 Faylni olish", "j:fx"), ("📥 Fayldan yuklash", "j:fi")], [webapp_btn(), ("◀ Jurnal", "j:C")]]), mid)


def screen_settings(chat, mid=None):
    D = J(chat)
    jc = jconf(chat)
    st = D["settings"]
    pol = (D.get("web") or {}).get("past") or "today"
    mw = st.get("method_weekday")
    qs = [f"{i + 1}-chorak: {fmt(r[0])} – {fmt(r[1])}" if r and r[0] and r[1] else f"{i + 1}-chorak: —" for i, r in enumerate(st["quarters"])]
    txt = ("⚙️ <b>Jurnal sozlamalari</b>\n\n"
           f"⏰ Yo'qlama eslatmasi: <b>{jc.get('remind') or 'o‘chiq'}</b> (yo'qlama qilinmagan dars qolsa, shu vaqtda xabar keladi)\n"
           f"✏️ O'tgan darslarga belgi: <b>{dict(PAST).get(pol, pol)}</b>\n"
           f"📆 Metod kuni (dars yo'q): <b>{WD_FULL[mw] if mw is not None and 0 <= mw <= 6 else 'yo‘q'}</b>\n"
           "<blockquote expandable>" + "\n".join(qs) + "</blockquote>")
    rt = REMIND_TIMES
    return send(chat, txt, ikb([
        [(("• " if (jc.get("remind") or "") == x else "") + (x or "O'chiq"), f"j:rm:{x.replace(':', '') or '-'}") for x in rt[:3]],
        [(("• " if (jc.get("remind") or "") == x else "") + x, f"j:rm:{x.replace(':', '')}") for x in rt[3:]],
        [(("• " if pol == k else "") + n, f"j:pp:{k}") for k, n in PAST],
        [(("• " if mw == i else "") + WD[i], f"j:mw:{i}") for i in range(6)] + [(("• " if mw is None else "") + "Yo'q", "j:mw:-")],
        [("🗓 Chorak sanalari", "j:qt"), ("◀ Jurnal", "j:C")]]), mid)


def screen_newclass_days(chat, mid=None):
    w = JTMP.get(chat) or {}
    sel = w.get("wd", set())
    return send(chat, f"➕ <b>{e(w.get('name', ''))}{' · ' + e(w['subject']) if w.get('subject') else ''}</b> — {len(w.get('students', []))} o'quvchi\n"
                "Dars kunlarini belgilang (bugungi darslar ro'yxati shundan tuziladi):",
                ikb([[(("✅ " if i in sel else "") + WD[i], f"j:wd:{i}") for i in range(6)],
                     [("💾 Saqlash", "j:ws"), ("❌ Bekor", "j:x")]]), mid)


# ------------------------------------------------------------------ amallar
def do_all_ok(chat, ci, d, cq):
    D = J(chat)
    c = D["classes"][ci]
    why = "Bu kunda dars yo'q (X)" if is_nolesson(D, c, d) else None if can_edit(D, d) else "Bu kunga belgi qo'yib bo'lmaydi"
    if why:
        return toast(cq, why, True)
    all_present(D, c, d)
    save(chat)
    toast(cq, f"🎉 {c['name']}: hamma keldi")


def done_message(chat, ci, d):
    """Yo'qlama yakuni — alohida xabar (chatda iz qoladi). Hamma kelgan bo'lsa 🎉 effekti bilan."""
    D = J(chat)
    c = D["classes"][ci]
    if d not in c["att_ok"] and not has_marks(c, d):
        c["att_ok"].append(d)
        if d not in c["dates"]:
            c["dates"] = sorted(set(c["dates"]) | {d})
        save(chat)
    n = len(c["students"])
    ab = [(s["name"], att_part(s["marks"].get(d, ""))) for s in c["students"] if att_part(s["marks"].get(d, "")) in ABSENT]
    late = [s["name"] for s in c["students"] if late_of(s["marks"].get(d, ""))]
    txt = f"✅ <b>Yo'qlama saqlandi</b> · {e(label(c))}, {fmt5(d)}\nKeldi: <b>{n - len(ab)}</b> / {n}"
    if ab:
        txt += "\n<blockquote expandable>" + "\n".join(f"• {e(x)} — {ATT_NAME[a]}" for x, a in ab) + "</blockquote>"
    if late:
        txt += "\n🟤 Kech qoldi: " + ", ".join(e(x) for x in late)
    k = f"{ci}:{d8(d)}"
    return send(chat, txt, ikb([[("✍️ Baholash", f"j:G:{k}"), ("📖 Mavzu", f"j:tp:{k}")], [("◀ Bugun", "j:T")]]),
                effect=EFFECT_TADA if not ab else None)


def export_file(chat):
    D = J(chat)
    raw = json.dumps(D, ensure_ascii=False, indent=1).encode("utf-8")
    B.typing(chat, "upload_document")
    B.send_bytes(chat, f"journal_{today()}_{(NOW_HM or time.strftime('%H:%M')).replace(':', '')}.json", raw,
                 f"📒 Yo'qlama jurnali · {len(D['classes'])} ta sinf\n"
                 "Web ilovada: Sozlamalar → Ma'lumotlar → Fayldan yuklash.\nKompyuter dasturida: Fayl → Zaxiradan tiklash.")


def download(file_id):
    r = B.tg("getFile", {"file_id": file_id})
    fp = (r.get("result") or {}).get("file_path")
    if not fp:
        raise ValueError("Faylni Telegram'dan olib bo'lmadi: " + str(r.get("description", "")))
    with urllib.request.urlopen(f"{B.API}/file/bot{B.TOKEN}/{fp}", timeout=60) as resp:
        return resp.read(20 * 1024 * 1024 + 1)


def on_document(chat, m):
    """Jurnal fayli keldi (web zaxira .json yoki journal.db). Qaytaradi: True — fayl shu modulga tegishli."""
    doc = m.get("document") or {}
    name = str(doc.get("file_name") or "")
    if not re.search(r"\.(json|db|sqlite3?)$", name, re.I):
        return False
    if int(doc.get("file_size") or 0) > 20 * 1024 * 1024:
        send(chat, "Fayl juda katta (20 MB dan ortiq).")
        return True
    B.typing(chat)
    try:
        data = parse_file(name, download(doc["file_id"]))
    except (ValueError, OSError) as ex:
        send(chat, f"⚠️ {e(ex)}")
        return True
    nc = len(data["classes"])
    ns = sum(len(c["students"]) for c in data["classes"])
    cur = J(chat)
    if not cur["classes"]:
        return replace_journal(chat, data, m.get("message_id"))
    JTMP[chat] = {"import": data}
    send(chat, f"📥 <b>{e(name)}</b>: {nc} ta sinf, {ns} o'quvchi.\n"
               f"Botdagi hozirgi jurnal ({len(cur['classes'])} ta sinf) shu fayl bilan <b>almashtiriladi</b>. "
               "Eski nusxa saqlanib qoladi (journal.oldingi.db).",
         ikb([[("♻️ Almashtirish", "j:fr"), ("❌ Bekor", "j:x")]]), reply_to=m.get("message_id"))
    return True


def replace_journal(chat, data, msg_id=None):
    p = jpath(chat)
    with LOCK:
        if p.exists():
            shutil.copy2(p, p.with_name("journal.oldingi.db"))
        JOURNALS[chat] = data
        auto_dates(data)
        save(chat)
    JTMP.pop(chat, None)
    react(chat, msg_id, "👌")
    send(chat, f"✅ Jurnal yuklandi: {len(data['classes'])} ta sinf.", ikb([[("📅 Bugun", "j:T"), ("📒 Jurnal", "j:C")]]))
    return True


def on_text(chat, m):
    """Kutilgan matn (mavzu, ism, ro'yxat). Qaytaradi: True — matn shu yerda ishlatildi."""
    step = JSTEP.get(chat)
    if not step:
        return False
    text = (m.get("text") or "").strip()
    if not text:
        return False
    JSTEP.pop(chat, None)
    D = J(chat)
    kind = step[0]
    mid = m.get("message_id")
    if kind in ("topic", "hw", "addst") and cls_ok(chat, step[1]) is None:
        send(chat, "Sinf topilmadi (jurnal o'zgargan bo'lishi mumkin).")
        return True
    if kind == "topic":
        _, ci, d = step
        D["classes"][ci]["lessons"].setdefault(d, {})["topic"] = text[:300]
        save(chat)
        react(chat, mid, "✍")
        ask(chat, "🏠 Uyga vazifa? (bo'lmasa «O'tkazib yuborish»)", ("hw", ci, d),
            extra=ikb([[("⏭ O'tkazib yuborish", f"j:L:{ci}:{d8(d)}")]]))
        return True
    if kind == "hw":
        _, ci, d = step
        D["classes"][ci]["lessons"].setdefault(d, {})["hw"] = text[:300]
        save(chat)
        react(chat, mid, "👍")
        screen_lesson(chat, ci, d)
        return True
    if kind == "newname":
        p = text.split(None, 1)
        name, subject = p[0][:30], (p[1] if len(p) > 1 else "")[:40]
        if any(c["name"].lower() == name.lower() and c["subject"].lower() == subject.lower() for c in D["classes"]):
            ask(chat, "Bunday sinf (va fan) jurnalda bor. Boshqa nom yozing:", ("newname",), "6-A Matematika")
            return True
        JTMP[chat] = {"name": name, "subject": subject, "wd": set()}
        ask(chat, f"<b>{e(name)}</b>{' · ' + e(subject) if subject else ''}\nEndi o'quvchilar ro'yxatini yuboring — har qatorda bitta ism:",
            ("newst",), "Aliyev Ali")
        return True
    if kind == "newst":
        names = parse_students(text)
        if not names or chat not in JTMP:
            ask(chat, "Ro'yxat bo'sh. Har qatorda bitta ism yozing:", ("newst",), "Aliyev Ali")
            return True
        JTMP[chat]["students"] = names
        screen_newclass_days(chat)
        return True
    if kind == "addst":
        ci = step[1]
        c = D["classes"][ci]
        have = {s["name"].lower() for s in c["students"] + c["students_off"]}
        names = [n for n in parse_students(text) if n.lower() not in have]
        for n in names:
            c["students"].append({"id": new_sid(), "name": n, "marks": {}, "scores": {}, "joined": today()})
        save(chat)
        react(chat, mid, "👍")
        send(chat, f"➕ {len(names)} ta o'quvchi qo'shildi." if names else "Yangi ism topilmadi (bu o'quvchilar bor).")
        screen_class(chat, ci)
        return True
    if kind == "quarters":
        try:
            D["settings"]["quarters"] = parse_quarters(text)
        except ValueError as ex:
            ask(chat, f"⚠️ {e(ex)}\nQaytadan yuboring:", ("quarters",), "02.09.2026 - 29.10.2026")
            return True
        n = auto_dates(D)
        save(chat)
        react(chat, mid, "👍")
        if n:
            send(chat, f"📆 Joriy chorak uchun {n} ta dars kuni qo'shildi.")
        screen_settings(chat)
        return True
    return False


def on_cb(chat, arg, cq, mid):
    """«j:…» tugmalari. Callback javobini (toast) shu yerda beradi."""
    op, *a = arg.split(":")
    D = J(chat)
    JSTEP.pop(chat, None)                                       # boshqa tugma bosilsa — kutilayotgan matn bekor

    def cd(i=0):                                               # (ci, sana) — tekshirilgan
        ci = cls_ok(chat, a[i] if len(a) > i else None)
        d = iso8(a[i + 1]) if len(a) > i + 1 else None
        return ci, d

    answered = False
    if op == "T":
        screen_today(chat, mid)
    elif op == "C":
        screen_classes(chat, mid)
    elif op in ("c", "cp", "SL", "tb", "D", "R", "as", "S"):
        ci = cls_ok(chat, a[0] if a else None)
        if ci is None:
            toast(cq, "Sinf topilmadi", True)
            return screen_classes(chat, mid)
        if op == "c":
            screen_class(chat, ci, "cur", mid)
        elif op == "cp":
            screen_class(chat, ci, a[1] if len(a) > 1 and a[1] in ("cur", "m", "w") else "cur", mid)
        elif op == "SL":
            screen_students(chat, ci, mid)
        elif op == "tb":
            screen_table(chat, ci, mid)
        elif op == "D":
            screen_days(chat, ci, mid)
        elif op == "R":
            screen_risk(chat, ci, a[1] if len(a) > 1 and a[1] in ("cur", "m", "w") else "cur", mid)
        elif op == "as":
            toast(cq)
            answered = True
            ask(chat, f"<b>{e(label(D['classes'][ci]))}</b> — yangi o'quvchi(lar) ismini yuboring (har qatorda bitta):", ("addst", ci), "Aliyev Ali")
        elif op == "S":
            si = int(a[1]) if len(a) > 1 and a[1].isdigit() else -1
            if 0 <= si < len(D["classes"][ci]["students"]):
                screen_student(chat, ci, si, mid)
    elif op in ("L", "A", "G", "a", "ok", "OK", "ad", "g", "g2", "v", "tp"):
        ci, d = cd()
        if ci is None or not d:
            toast(cq, "Dars topilmadi (jurnal o'zgargan bo'lishi mumkin)", True)
            return screen_today(chat, mid)
        c = D["classes"][ci]
        si = int(a[2]) if len(a) > 2 and a[2].isdigit() else -1
        if op in ("a", "g", "g2", "v") and not 0 <= si < len(c["students"]):
            toast(cq, "O'quvchi topilmadi", True)
            return screen_lesson(chat, ci, d, mid)
        if op == "L":
            screen_lesson(chat, ci, d, mid)
        elif op == "A":
            screen_att(chat, ci, d, mid)
        elif op == "G":
            screen_grades(chat, ci, d, mid)
        elif op == "a":
            why = put_mark(D, c, si, d, next_att(c["students"][si]["marks"].get(d, "")))
            if why:
                toast(cq, why, True)
                answered = True
            else:
                save(chat)
            screen_att(chat, ci, d, mid)
        elif op in ("ok", "OK"):
            do_all_ok(chat, ci, d, cq)
            answered = True
            screen_att(chat, ci, d, mid) if op == "ok" else screen_today(chat, mid)
        elif op == "ad":
            done_message(chat, ci, d)
            B.delete_msg(chat, mid)
        elif op == "g":
            screen_pick(chat, ci, d, si, mid)
        elif op == "g2":
            screen_pick(chat, ci, d, si, mid, add=True)
        elif op == "v":
            v = a[3] if len(a) > 3 and a[3].isdigit() else "0"
            old = c["students"][si]["marks"].get(d, "")
            if v == "0":
                new = ""
            else:
                gs = grades_of(old)[:1] + [int(v)] if len(a) > 4 and a[4] == "1" else [int(v)]
                new = build_mark(gs, late_of(old))
            why = put_mark(D, c, si, d, new)
            if why:
                toast(cq, why, True)
                return screen_pick(chat, ci, d, si, mid)
            save(chat)
            toast(cq, f"{short_name(c['students'][si]['name'])}: {short_mark(new) if new else 'o‘chirildi'}")
            answered = True
            nx = next_student(c, d, si) if new else si
            if nx is None:
                screen_grades(chat, ci, d, mid)
            else:
                screen_pick(chat, ci, d, nx, mid)
        elif op == "tp":
            toast(cq)
            answered = True
            cur = (c["lessons"].get(d) or {}).get("topic")
            ask(chat, f"📖 <b>{e(label(c))}</b>, {fmt5(d)} — dars mavzusini yozing" + (f"\nHozir: {e(cur)}" if cur else "") + ":",
                ("topic", ci, d), "Masalan: Kasrlarni qo'shish")
    elif op == "F":
        screen_file(chat, mid)
    elif op == "fx":
        toast(cq, "Fayl tayyorlanmoqda…")
        answered = True
        export_file(chat)
    elif op == "fi":
        send(chat, "📥 Jurnal faylini (web ilova zaxirasi <code>.json</code> yoki <code>journal.db</code>) shu chatga yuboring.", None, mid)
    elif op == "fr":
        imp = (JTMP.get(chat) or {}).get("import")
        if not imp:
            toast(cq, "Fayl topilmadi — qayta yuboring", True)
            answered = True
        else:
            B.delete_msg(chat, mid)
            replace_journal(chat, imp)
    elif op == "N":
        toast(cq)
        answered = True
        JTMP.pop(chat, None)
        ask(chat, "➕ <b>Yangi sinf</b>\nSinf nomi va fanni yozing:", ("newname",), "6-A Matematika")
    elif op == "wd":
        w = JTMP.get(chat)
        if w and "students" in w and a and a[0].isdigit():
            w["wd"] ^= {int(a[0])}
            screen_newclass_days(chat, mid)
    elif op == "ws":
        w = JTMP.pop(chat, None)
        if not w or "students" not in w:
            toast(cq, "Qaytadan boshlang: ➕ Yangi sinf", True)
            return True
        ci = new_class(D, w["name"], w["subject"], w["students"], w["wd"])
        save(chat)
        toast(cq, "✅ Sinf yaratildi")
        answered = True
        screen_class(chat, ci, "cur", mid)
    elif op == "set":
        screen_settings(chat, mid)
    elif op == "rm":
        v = a[0] if a else "-"
        jconf(chat)["remind"] = f"{v[:2]}:{v[2:]}" if re.fullmatch(r"\d{4}", v) else ""
        B.save_state()
        screen_settings(chat, mid)
    elif op == "pp":
        if a and a[0] in dict(PAST):
            D.setdefault("web", {})["past"] = a[0]
            save(chat)
        screen_settings(chat, mid)
    elif op == "mw":
        D["settings"]["method_weekday"] = int(a[0]) if a and a[0].isdigit() and int(a[0]) <= 6 else None
        save(chat)
        screen_settings(chat, mid)
    elif op == "qt":
        toast(cq)
        answered = True
        ask(chat, "🗓 Chorak sanalarini yuboring — har chorak alohida qatorda:\n<code>02.09.2026 - 29.10.2026\n"
                  "05.11.2026 - 27.12.2026\n08.01.2027 - 20.03.2027\n29.03.2027 - 25.05.2027</code>", ("quarters",), "02.09.2026 - 29.10.2026")
    elif op == "x":
        JSTEP.pop(chat, None)
        JTMP.pop(chat, None)
        send(chat, "Bekor qilindi.", None, mid)
    if not answered:
        toast(cq)
    return True


# ------------------------------------------------------------------ inline rejim: istalgan chatda «@bot ism»
def on_inline(iq):
    """O'quvchi kartochkasini (ota-onaga xabar) istalgan chatga yuborish. BotFather'da /setinline yoqilgan bo'lishi kerak."""
    uid = (iq.get("from") or {}).get("id")
    q = (iq.get("query") or "").strip()
    D = J(uid)
    res = []
    m = re.fullmatch(r"o:(\d+)\.(\d+)", q)
    if m:
        ci, si = int(m.group(1)), int(m.group(2))
        pairs = [(ci, si)] if cls_ok(uid, ci) is not None and si < len(D["classes"][ci]["students"]) else []
    else:
        ql = q.lower()
        pairs = [(ci, si) for ci, c in enumerate(D["classes"]) if not c.get("kind")
                 for si, s in enumerate(c["students"]) if not ql or ql in s["name"].lower() or ql in label(c).lower()][:20]
    for ci, si in pairs:
        c = D["classes"][ci]
        lo, hi, qq, _ = period(D, "cur")
        r = report_rows(D, c, lo, hi, qq)[0][si]
        res.append({"type": "article", "id": f"{ci}.{si}", "title": f"{c['students'][si]['name']} · {label(c)}",
                    "description": f"o'rtacha {num(r['avg'], '.1f')} · davomat {num(r['att'], '.0f', '%')}"
                                   + (" · ⚠️" if r["risk"] else ""),
                    "input_message_content": {"message_text": parent_text(D, c, si, rich=True), "parse_mode": "HTML",
                                              "link_preview_options": {"is_disabled": True}}})
    p = {"inline_query_id": iq["id"], "results": res, "cache_time": 0, "is_personal": True}
    if not res:
        p["button"] = {"text": "📒 Jurnalni ochish", "start_parameter": "jurnal"}
    B.tg("answerInlineQuery", p)


def deny_inline(iq):
    B.tg("answerInlineQuery", {"inline_query_id": iq["id"], "results": [], "cache_time": 0, "is_personal": True,
                               "button": {"text": "Botdan foydalanish uchun ruxsat so'rang", "start_parameter": "start"}})


# ------------------------------------------------------------------ eslatma
def remind(chat):
    """Kun oxirida: yo'qlama qilinmagan bugungi darslar."""
    D = J(chat)
    t = today()
    left = [x for x in lessons_today(D, t) if not x["done"]]
    if not left:
        return
    rows = [[(f"✅ {label(x['c'])}"[:40], f"j:A:{x['ci']}:{d8(t)}"), ("✓ Hamma keldi", f"j:OK:{x['ci']}:{d8(t)}")] for x in left[:10]]
    send(chat, f"⏰ <b>Eslatma:</b> bugun {len(left)} ta darsda yo'qlama qilinmagan.", ikb(rows))


def due_reminders(now_hm=None, day=None):
    """Eslatma vaqti kelgan foydalanuvchilar (yakshanbadan tashqari, vaqtdan keyin 3 soat ichida, kuniga bir marta)."""
    now_hm = now_hm or NOW_HM or time.strftime("%H:%M")
    day = day or today()
    if wd_of(day) == 6:
        return []
    out = []
    root = B.USERS_DIR
    if not root.exists():
        return out
    for d in root.iterdir():
        if not d.name.lstrip("-").isdigit() or not (d / "journal.db").exists():
            continue
        chat = int(d.name)
        if B.role(chat) not in ("admin", "ok"):
            continue
        jc = jconf(chat)
        r = jc.get("remind") or ""
        if not r or jc.get("last") == day:
            continue
        h, m = map(int, r.split(":"))
        nh, nm = map(int, now_hm.split(":"))
        if 0 <= (nh * 60 + nm) - (h * 60 + m) <= 180:
            jc["last"] = day
            out.append(chat)
    if out:
        B.save_state()
    return out


def ticker(stop):
    while not stop.wait(60):
        try:
            for chat in due_reminders():
                B.enqueue(chat, {"_jremind": True})
        except Exception as ex:                                 # noqa: BLE001
            print("eslatma xatosi:", type(ex).__name__, ex)


def bot_setup():
    """Telegram'dagi bot ko'rinishi: buyruqlar, Mini App menyu tugmasi, tavsif."""
    B.tg("setMyCommands", {"commands": [
        {"command": "bugun", "description": "📅 Bugungi darslar va yo'qlama"},
        {"command": "jurnal", "description": "📒 Sinflar, baholar, o'quvchi kartochkasi"},
        {"command": "fayl", "description": "📁 Web ilova bilan fayl almashish"},
        {"command": "start", "description": "Menyu tugmalari"}]})
    if WEBAPP_URL.startswith("https://"):
        B.tg("setChatMenuButton", {"menu_button": {"type": "web_app", "text": "📒 Ilova", "web_app": {"url": WEBAPP_URL}}})
    B.tg("setMyShortDescription", {"short_description": "Yo'qlama jurnali: davomat, baholar, mavzular va hisobotlar — Telegram'da."})
    B.tg("setMyDescription", {"description": "O'qituvchi uchun yo'qlama jurnali. Bugungi darslar, bir bosishda yo'qlama, "
                                             "baholash, dars mavzusi, xavf ostidagi o'quvchilar va ota-onaga tayyor xabar. "
                                             "Web ilova bilan fayl orqali almashadi. emaktab hisobotlari ham shu yerda."})
