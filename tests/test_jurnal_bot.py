"""Telegram jurnal boti (dastur/jurnal_bot.py): hisob-kitob golden.json bilan bir xil, fayl formati kompyuter dasturi
bilan mos, tugmalar oqimi soxta Telegram bilan (tarmoqsiz) tekshiriladi."""
import copy
import importlib
import json
import os
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
TESTS = ROOT / "tests"
sys.path.insert(0, str(ROOT / "dastur"))

import jurnal_bot as JB  # noqa: E402

FIXTURE = json.loads((TESTS / "fixtures" / "journal.json").read_text(encoding="utf-8"))
GOLDEN = json.loads((TESTS / "golden.json").read_text(encoding="utf-8"))
TODAY = json.loads((TESTS / "inputs.json").read_text(encoding="utf-8"))["today"]
NUM = ("n", "avg", "att", "s", "dq", "k", "kq", "ch", "absent")


def journal():
    return JB.normalize(copy.deepcopy(FIXTURE))


def near(a, b):
    return a == b if a is None or b is None else abs(a - b) < 1e-6


def test_report_rows_match_golden():
    D = journal()
    lo, hi, q = GOLDEN["period"]
    assert JB.period_now(D, TODAY) == (lo, hi, q)
    for c, g in zip(D["classes"], GOLDEN["classes"]):
        assert JB.label(c) == g["label"]
        rows, lessons, dates = JB.report_rows(D, c, lo, hi, q, TODAY)
        assert lessons == g["report"]["lessons"] and dates == g["report"]["dates"]
        for r, gr in zip(rows, g["report"]["rows"]):
            assert r["name"] == gr["name"]
            for k in NUM:
                assert near(r[k], gr[k]), (g["label"], r["name"], k, r[k], gr[k])
            # «chorak bahosi 2» — chorak balli hisobi web ilova / kompyuter dasturida
            assert r["why"] == [w for w in gr["why"] if w != "chorak bahosi 2"], (r["name"], r["why"], gr["why"])


def test_marks_helpers_match_golden():
    for raw, want in zip(json.loads((TESTS / "inputs.json").read_text(encoding="utf-8"))["marks"], GOLDEN["marks"]):
        if want is None or not isinstance(raw, str):
            continue
        assert JB.build_mark(JB.grades_of(want), JB.late_of(want)) == want or JB.att_part(want) == want


def test_attendance_cycle():
    seq, m = [], ""
    for _ in range(5):
        m = JB.next_att(m)
        seq.append(m)
    assert seq == ["s", "dq", "k", "kq", ""]
    assert JB.next_att("8") == "s"                              # S/DQ/K bahoni o'chiradi
    assert JB.next_att("k") == "kq" and JB.next_att("8kq") == "8"   # KQ bahoni saqlaydi


def test_put_mark_rules():
    D = journal()
    c = D["classes"][0]
    assert JB.put_mark(D, c, 0, "2026-10-26", "8", TODAY) == "Kelgusi kunga belgi qo'yib bo'lmaydi"
    assert "Faqat bugungi" in JB.put_mark(D, c, 0, "2026-10-21", "8", TODAY)
    D.setdefault("web", {})["past"] = "week"
    assert JB.put_mark(D, c, 0, "2026-10-22", "8", TODAY) == "Bu kunda dars yo'q (X)"   # payshanba — metod kuni
    w = c["works"][0]
    D["web"]["past"] = "all"
    assert "oddiy baho qo'yilmaydi" in JB.put_mark(D, c, 0, w["date"], "9", TODAY)
    assert JB.put_mark(D, c, 0, w["date"], "s", TODAY) is None   # summativ kuni ham yo'qlama mumkin
    old = c["students"][1]["marks"].get(TODAY, "")
    assert JB.put_mark(D, c, 1, TODAY, "10", TODAY) is None
    assert c["students"][1]["marks"][TODAY] == "10"
    if old:
        assert D["changelog"][-1]["old"] == old and D["changelog"][-1]["new"] == "10"


def test_lessons_today_and_all_present():
    D = journal()
    L = JB.lessons_today(D, TODAY)
    assert [x["c"]["name"] for x in L] == [c["name"] for c in D["classes"] if TODAY in c["dates"] and not c.get("kind")]
    c = D["classes"][0]
    JB.all_present(D, c, TODAY, TODAY)
    assert not any(JB.att_part(s["marks"].get(TODAY, "")) in JB.ABSENT for s in c["students"])
    assert TODAY in c["att_ok"]


def test_db_roundtrip_keeps_unknown_keys(tmp_path):
    D = journal()
    D["web"] = {"past": "week", "schedule": {"bells": [["08:00", "08:45"]], "days": [["6-A|Matematika"]] + [[]] * 5}}
    D["groups_extra"] = {"keep": [1, 2]}
    p = tmp_path / "journal.db"
    JB.write_db(D, p)
    back = JB.read_db(p)
    assert back == json.loads(json.dumps(D))
    assert JB.parse_file("journal.db", p.read_bytes()) == JB.normalize(copy.deepcopy(back))
    assert JB.parse_file("a.json", json.dumps(D).encode())["web"]["past"] == "week"
    with pytest.raises(ValueError, match="shifrlangan"):
        JB.parse_file("a.json", b'{"v":1,"salt":"x","iv":"y","ct":"z"}')
    with pytest.raises(ValueError):
        JB.parse_file("a.json", b'{"hello": 1}')


def test_desktop_store_opens_bot_db(tmp_path):
    """Bot yozgan journal.db ni kompyuter dasturi ochadi (PySide6 bo'lsa)."""
    pytest.importorskip("PySide6")
    os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
    import yoqlama_jurnal as Y
    D = journal()
    p = tmp_path / "journal.db"
    JB.write_db(D, p)
    st = Y.Store(p)
    assert [Y.cls_label(c) for c in st.classes] == [JB.label(c) for c in D["classes"]]
    assert st.classes[0]["students"][0]["marks"] == D["classes"][0]["students"][0]["marks"]


def test_parse_helpers():
    assert JB.parse_students("1. Aliyev Ali\n2) Valiyev Vali\n- aliyev ali\n\n  Karimova  Zuhra ") == ["Aliyev Ali", "Valiyev Vali", "Karimova Zuhra"]
    assert JB.parse_quarters("02.09.2026 - 29.10.2026\n5.11.2026-27.12.2026") == [["2026-09-02", "2026-10-29"], ["2026-11-05", "2026-12-27"], None, None]
    with pytest.raises(ValueError):
        JB.parse_quarters("salom")


def test_parent_text_fits_copy_button():
    D = journal()
    for si in range(len(D["classes"][0]["students"])):
        t = JB.parent_text(D, D["classes"][0], si, t=TODAY, limit=256)
        assert 0 < len(t) <= 256 and D["classes"][0]["students"][si]["name"] in t


# ------------------------------------------------------------------ soxta Telegram bilan butun oqim
ALLOWED_TAGS = {"b", "i", "u", "s", "code", "pre", "blockquote", "tg-spoiler", "a"}


class TagCheck(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack = []

    def handle_starttag(self, tag, attrs):
        assert tag in ALLOWED_TAGS, tag
        self.stack.append(tag)

    def handle_endtag(self, tag):
        assert self.stack and self.stack.pop() == tag, tag


@pytest.fixture()
def bot(tmp_path, monkeypatch):
    monkeypatch.setenv("BOT_USERS", str(tmp_path / "users"))
    monkeypatch.setenv("BOT_STATE", str(tmp_path / "holat.db"))
    monkeypatch.setenv("BOT_ENV", str(tmp_path / "yoq.env"))
    monkeypatch.setenv("ADMIN_IDS", "1")
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "123:abc")
    B = importlib.import_module("emaktab_tgbot")
    B = importlib.reload(B)
    JB.setup(B)
    JB.JOURNALS.clear()
    JB.JSTEP.clear()
    JB.JTMP.clear()
    monkeypatch.setattr(JB, "TODAY", TODAY)
    monkeypatch.setattr(JB, "NOW_HM", "10:00")
    calls = []

    def fake_tg(method, params=None, files=None, timeout=70):
        calls.append((method, params or {}, files))
        if method in ("sendMessage", "editMessageText"):
            TagCheck().feed(params.get("text", "")) if params.get("parse_mode") == "HTML" else None
            assert len(params["text"]) <= 4096
            for row in (params.get("reply_markup") or {}).get("inline_keyboard", []):
                for b in row:
                    assert len(b.get("callback_data", "").encode()) <= 64, b
                    if "copy_text" in b:
                        assert len(b["copy_text"]["text"]) <= 256
        return {"ok": True, "result": {"message_id": len(calls)}}

    monkeypatch.setattr(B, "tg", fake_tg)
    monkeypatch.setattr(JB, "download", lambda fid: json.dumps(FIXTURE).encode())
    B.load_state()
    B._calls = calls
    return B


def msg(text=None, **kw):
    m = {"message_id": 500, "chat": {"id": 1, "type": "private"}, "from": {"id": 1, "first_name": "Akmal"}}
    if text is not None:
        m["text"] = text
    m.update(kw)
    return {"message": m}


def cb(data, mid=77):
    return {"callback_query": {"id": "q", "from": {"id": 1}, "data": data,
                               "message": {"message_id": mid, "chat": {"id": 1, "type": "private"}}}}


def sent(B, method="sendMessage"):
    return [p for m, p, _ in B._calls if m == method]


def last_text(B):
    return [p["text"] for m, p, _ in B._calls if m in ("sendMessage", "editMessageText")][-1]


def test_bot_flow(bot):
    B = bot
    B.process(1, msg("/start"))
    kb = sent(B)[-1]["reply_markup"]["keyboard"]
    assert kb[0] == [B.B_TODAY, B.B_JOURNAL]

    B.process(1, msg(B.B_TODAY))
    assert "Jurnalda hali sinf yo'q" in last_text(B)

    # web ilova zaxirasini yuborish → jurnal botga ko'chadi va diskka yoziladi
    B.process(1, msg(document={"file_id": "F1", "file_name": "journal_2026-10-23_1200.json", "file_size": 1000}))
    assert "Jurnal yuklandi: 3 ta sinf" in last_text(B) or "Jurnal yuklandi" in last_text(B)
    assert (B.USERS_DIR / "1" / "journal.db").exists()

    B.process(1, msg(B.B_TODAY))
    t = last_text(B)
    assert "Bugun" in t and "6-A · Matematika" in t
    ci = 0
    d8 = TODAY.replace("-", "")

    # yo'qlama: 3-o'quvchini bosish → S, yana → DQ
    B.process(1, cb(f"j:A:{ci}:{d8}"))
    assert "Yo'qlama" in last_text(B)
    s2 = JB.JOURNALS[1]["classes"][ci]["students"][2]
    first = JB.next_att(s2["marks"].get(TODAY, ""))
    B.process(1, cb(f"j:a:{ci}:{d8}:2"))
    assert s2["marks"].get(TODAY, "") == first
    B.process(1, cb(f"j:ok:{ci}:{d8}"))
    assert JB.att_part(s2["marks"].get(TODAY, "")) not in JB.ABSENT
    B.process(1, cb(f"j:ad:{ci}:{d8}"))
    done = sent(B)[-1]
    assert "Yo'qlama saqlandi" in done["text"] and done.get("message_effect_id") == JB.EFFECT_TADA

    # baholash: 1-o'quvchiga 9, so'ng ikkinchi baho 7 → «9/7»
    B.process(1, cb(f"j:g:{ci}:{d8}:1"))
    B.process(1, cb(f"j:v:{ci}:{d8}:1:9:0"))
    st = JB.JOURNALS[1]["classes"][ci]["students"][1]
    assert JB.grades_of(st["marks"][TODAY]) == [9]
    B.process(1, cb(f"j:v:{ci}:{d8}:1:7:1"))
    assert st["marks"][TODAY] == "9/7"
    toasts = [p.get("text", "") for m, p, _ in B._calls if m == "answerCallbackQuery"]
    assert any("9/7" in x for x in toasts)

    # mavzu → uy vazifasi (ForceReply), foydalanuvchi xabariga reaksiya
    B.process(1, cb(f"j:tp:{ci}:{d8}"))
    assert sent(B)[-1]["reply_markup"].get("force_reply")
    B.process(1, msg("Kasrlarni ko'paytirish"))
    B.process(1, msg("46-bet, 5-mashq"))
    les = JB.JOURNALS[1]["classes"][ci]["lessons"][TODAY]
    assert les == {"topic": "Kasrlarni ko'paytirish", "hw": "46-bet, 5-mashq"}
    assert any(m == "setMessageReaction" for m, _, _ in B._calls)

    # diskdagi fayl ham yangilangan
    disk = JB.read_db(B.USERS_DIR / "1" / "journal.db")
    assert disk["classes"][ci]["students"][1]["marks"][TODAY] == "9/7"

    # sinf, jadval, o'quvchi kartochkasi (nusxalash va chatga yuborish tugmalari)
    for data in (f"j:c:{ci}", f"j:cp:{ci}:w", f"j:tb:{ci}", f"j:R:{ci}:cur", f"j:D:{ci}", f"j:SL:{ci}", f"j:S:{ci}:1", "j:C", "j:set", "j:F"):
        B.process(1, cb(data))
    card = [p for p in sent(B, "editMessageText") if "👤" in p["text"] and "O'rtacha" in p["text"]][-1]
    flat = [b for row in card["reply_markup"]["inline_keyboard"] for b in row]
    assert any("copy_text" in b for b in flat) and any("switch_inline_query_chosen_chat" in b for b in flat)

    # inline rejim
    B.process(1, {"inline_query": {"id": "iq", "from": {"id": 1}, "query": st["name"].split()[0]}})
    ans = [p for m, p, _ in B._calls if m == "answerInlineQuery"][-1]
    assert ans["results"] and st["name"] in ans["results"][0]["input_message_content"]["message_text"]
    B.process(1, {"inline_query": {"id": "iq2", "from": {"id": 1}, "query": f"o:{ci}.1"}})
    assert len([p for m, p, _ in B._calls if m == "answerInlineQuery"][-1]["results"]) == 1

    # eksport: JSON fayl, web ilova o'qiy oladigan
    B.process(1, cb("j:fx"))
    f = [fl for m, _, fl in B._calls if m == "sendDocument"][-1]
    name, raw = f["document"]
    assert name.endswith(".json") and json.loads(raw)["classes"][ci]["lessons"][TODAY]["hw"] == "46-bet, 5-mashq"


def test_new_class_wizard_and_reminder(bot):
    B = bot
    B.process(1, cb("j:N"))
    B.process(1, msg("7-B Fizika"))
    B.process(1, msg("1. Aliyev Ali\n2. Valiyeva Vali"))
    wd = JB.wd_of(TODAY)
    B.process(1, cb(f"j:wd:{wd}"))
    B.process(1, cb("j:ws"))
    D = JB.JOURNALS[1]
    assert [JB.label(c) for c in D["classes"]] == ["7-B · Fizika"]
    assert D["classes"][0]["weekdays"] == [wd] and len(D["classes"][0]["students"]) == 2
    assert JB.lessons_today(D, TODAY)[0]["ci"] == 0

    # eslatma: 15:00 dan keyin bir marta, yo'qlama qilinmagan dars bo'lsa
    assert JB.due_reminders("14:00", TODAY) == []
    assert JB.due_reminders("15:05", TODAY) == [1]
    assert JB.due_reminders("15:06", TODAY) == []
    B.process(1, {"_jremind": True})
    assert "Eslatma" in last_text(B)

    # boshqa foydalanuvchining tugmasi: ruxsatsiz
    n = len(B._calls)
    B.process(2, {"callback_query": {"id": "z", "from": {"id": 2}, "data": "j:T", "message": {"message_id": 1, "chat": {"id": 2}}}})
    assert B._calls[n][0] == "answerCallbackQuery" and "Ruxsat" in B._calls[n][1]["text"]


def test_html_escaping(bot):
    B = bot
    B.process(1, cb("j:N"))
    B.process(1, msg("<b>9-V Tarix"))
    B.process(1, msg("Ali <script> & Co"))
    B.process(1, cb("j:ws"))
    B.process(1, cb("j:c:0"))
    assert "&lt;script&gt;" in last_text(B) and re.search(r"&lt;b&gt;9-V", last_text(B))
