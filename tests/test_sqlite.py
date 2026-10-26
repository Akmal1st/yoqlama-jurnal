"""dastur/hisobot_sqlite.py (SQL so'rovlari) = web ilova hisobotlari (tests/hisobot_golden.json).
golden faylni web ilova yaratadi: node tests/make_hisobot_golden.mjs"""
import json
import math
import sys
from pathlib import Path

TESTS = Path(__file__).resolve().parent
sys.path.insert(0, str(TESTS.parent / "dastur"))
import hisobot_sqlite as H  # noqa: E402

GOLD = json.loads((TESTS / "hisobot_golden.json").read_text(encoding="utf-8"))
DATA = json.loads((TESTS / "fixtures" / "hisobot.json").read_text(encoding="utf-8"))


def db():
    con = H.connect()
    H.load(con, DATA, GOLD["today"])
    return con


def same(a, b, path="") -> None:
    if isinstance(b, float) or isinstance(a, float):
        assert a is not None and b is not None and math.isclose(a, b, abs_tol=1e-6), f"{path}: {a} != {b}"
    elif isinstance(b, dict):
        assert isinstance(a, dict) and set(a) == set(b), f"{path}: kalitlar {sorted(a)} != {sorted(b)}"
        for k in b:
            same(a[k], b[k], f"{path}.{k}")
    elif isinstance(b, list):
        assert isinstance(a, list) and len(a) == len(b), f"{path}: uzunlik {a} != {b}"
        for i, (x, y) in enumerate(zip(a, b)):
            same(x, y, f"{path}[{i}]")
    else:
        assert a == b, f"{path}: {a!r} != {b!r}"


def q1(con):
    return H.quarter_range(con, 1)


def test_sqlite_solishtirish():
    con = db()
    lo, hi = q1(con)
    rows = H.compare(con, lo, hi, 1)
    keys = ["n", "lessons", "nGr", "avg", "att", "bsb", "chsb", "qq", "qu"]
    same([{"cls": r["cls"], **{k: r[k] for k in keys}} for r in rows], GOLD["cmp"], "cmp")
    same(H.compare_total(rows), GOLD["cmp_total"], "cmp_total")


def test_sqlite_oquvchilar():
    con = db()
    lo, hi = q1(con)
    rows = H.students(con, lo, hi)
    cls = [c["id"] for c in con.execute("SELECT id FROM class WHERE kind IS NULL ORDER BY ord")]
    got = [[{k: r[k] for k in ["name", "n", "avg", "att", "s", "dq", "k", "kq", "ch"]} for r in rows if r["class_id"] == c] for c in cls]
    same(got, GOLD["students"], "students")


def test_sqlite_ishlar():
    con = db()
    rows = H.works(con, 1)
    cls = [c["id"] for c in con.execute("SELECT id FROM class WHERE kind IS NULL ORDER BY ord")]
    got = [[{"id": r["id"], "n": r["n"], "avg": r["avg"], "pct": r["pct"], "lo": r["lo"], "hi": r["hi"], "band": [r["b5"], r["b4"], r["b3"], r["b2"]]}
            for r in rows if r["class_id"] == c] for c in cls]
    same(got, GOLD["works"], "works")


def test_sqlite_guruhlar_tolishi():
    con = db()
    year = H.year_att(con)
    got = [{"name": r["name"], "n": r["n"], "cap": r["cap"], "held": r["held"], "att": r["att"], "year": [y["pct"] for y in year if y["class_id"] == r["id"]]}
           for r in H.fill(con, "2026-11")]
    same(got, GOLD["fill"], "fill")


def test_sqlite_hisob_daftari():
    con = db()
    L = H.ledger(con)
    names = {r["id"]: r["name"] for r in con.execute("SELECT id, name FROM student")}
    paid = [c["id"] for c in con.execute("SELECT id FROM class WHERE kind = 'paid' ORDER BY ord")]
    got = [[{"name": names[sid], **{k: x[k] for k in ["held", "charge", "paid", "charged", "paidAll", "debt"]}}
            for sid, x in sorted(L.items()) if x["class_id"] == c] for c in paid]
    same(got, GOLD["ledger"], "ledger")


def test_sqlite_moliya():
    con = db()
    rng = [("2026-09-01", GOLD["today"]), ("2026-10-01", "2026-10-31"), ("2026-11-01", "2026-11-30")]
    per = [H.finance(con, lo, hi) for lo, hi in rng]
    got = [[{k: per[j][i][k] for k in ["svc", "open", "charged", "got", "close", "how"]} for j in range(len(rng))] for i in range(len(per[0]))]
    same(got, GOLD["fin"], "fin")
    for rows in per:   # yakuniy = boshlang'ich + hisoblangan − tushum
        for r in rows:
            assert r["close"] == r["open"] + r["charged"] - r["got"]
