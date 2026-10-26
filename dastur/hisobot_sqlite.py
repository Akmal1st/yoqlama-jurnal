"""Hisobotlar SQLite'da: jurnal faylini (journal.json yoki web ilova zaxirasi) jadvallarga yoyadi va
sinf, to'garak hamda pullik ta'lim hisobotlarini SQL so'rovlari bilan chiqaradi.

Web ilovadagi hisobotlar bilan bir xil qoidalar (tests/test_sqlite.py web natijasi — tests/hisobot_golden.json — bilan solishtiradi).

Ishlatish:
    python hisobot_sqlite.py journal.json --db hisobot.sqlite              # bazani yaratish
    python hisobot_sqlite.py journal.json sinflar --from 2026-09-02 --to 2026-10-31 --chorak 1
    python hisobot_sqlite.py journal.json ishlar --chorak 1
    python hisobot_sqlite.py journal.json guruhlar --oy 2026-11
    python hisobot_sqlite.py journal.json tolov
    python hisobot_sqlite.py journal.json moliya --from 2026-09-01 --to 2026-11-30 [--csv out.csv]

Tamoyillar:
  * Belgi bir marta tahlil qilinadi (ETL): «8/9kq» → grade jadvaliga 2 qator, mark.att = 'kq'. So'rovlar matnni qayta o'qimaydi.
  * Dars bo'lmagan kun (metodik kun, X) ham yuklashda belgilanadi: lesson.no_lesson.
  * Har so'rov bitta o'tish: indekslar (class_id, d) / (student_id, d) bo'yicha JOIN, keyin GROUP BY.
  * Yaxlitlash Python f"{x:.2f}" bilan bir xil bo'lishi uchun SQLite'ga pyfix() funksiyasi qo'shiladi.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import math
import re
import sqlite3
import sys
from pathlib import Path

SCHEMA = """
CREATE TABLE meta(today TEXT NOT NULL, cur TEXT NOT NULL, fb_min INTEGER NOT NULL);
CREATE TABLE class(id INTEGER PRIMARY KEY, ord INTEGER, name TEXT, subject TEXT, kind TEXT,  -- kind: NULL | 'club' | 'paid'
                   svc TEXT, cap INTEGER, time TEXT, fee_month INTEGER, fee_day INTEGER);
CREATE TABLE quarter(q INTEGER PRIMARY KEY, lo TEXT NOT NULL, hi TEXT NOT NULL);
-- sinf sanalari (in_dates=1) va jurnaldan tashqaridagi belgili kunlar (in_dates=0)
CREATE TABLE lesson(class_id INTEGER, d TEXT, ym TEXT, in_dates INTEGER, no_lesson INTEGER, is_sum INTEGER,
                    PRIMARY KEY(class_id, d)) WITHOUT ROWID;
CREATE TABLE student(id INTEGER PRIMARY KEY, class_id INTEGER, ord INTEGER, active INTEGER, sid TEXT, name TEXT, cls TEXT,
                     joined TEXT, off_at TEXT, plan_t TEXT, plan_sum INTEGER, phone TEXT);
CREATE TABLE mark(student_id INTEGER, d TEXT, raw TEXT, att TEXT, late INTEGER, PRIMARY KEY(student_id, d)) WITHOUT ROWID;
CREATE TABLE grade(student_id INTEGER, d TEXT, k INTEGER, g INTEGER, PRIMARY KEY(student_id, d, k)) WITHOUT ROWID;
CREATE TABLE work(id INTEGER PRIMARY KEY, class_id INTEGER, wid TEXT, type TEXT, d TEXT, max REAL);
CREATE TABLE score(work_id INTEGER, student_id INTEGER, v REAL, PRIMARY KEY(work_id, student_id)) WITHOUT ROWID;
CREATE TABLE pay(id INTEGER PRIMARY KEY, student_id INTEGER, no INTEGER, d TEXT, m TEXT, sum INTEGER, how TEXT);
CREATE TABLE contract(student_id INTEGER PRIMARY KEY, no TEXT, d TEXT, payer TEXT, d_from TEXT, d_to TEXT, disc INTEGER);

CREATE INDEX student_class ON student(class_id, active, ord);
CREATE INDEX lesson_ym ON lesson(class_id, ym, d);
CREATE INDEX work_class ON work(class_id, d);
CREATE INDEX pay_student ON pay(student_id, m);
CREATE INDEX pay_date ON pay(d);

-- o'quvchining narxi: o'z narxi, bo'lmasa guruh narxi (web: planOf)
CREATE VIEW v_plan AS
  SELECT s.id student_id, s.class_id, COALESCE(s.plan_t, 'month') plan_t,
         COALESCE(NULLIF(s.plan_sum, 0), CASE COALESCE(s.plan_t, 'month') WHEN 'day' THEN c.fee_day ELSE c.fee_month END, 0) plan_sum
  FROM student s JOIN class c ON c.id = s.class_id WHERE c.kind = 'paid';

-- hisob daftari: o'quvchi × oy — o'tilgan darslar va hisoblangan summa (web: ledgerOf)
CREATE VIEW v_charge AS
  WITH les AS (SELECT l.class_id, l.d, l.ym FROM lesson l JOIN class c ON c.id = l.class_id
               WHERE c.kind = 'paid' AND l.in_dates = 1 AND l.no_lesson = 0),
       lm AS (SELECT DISTINCT class_id, ym FROM les),
       months AS (SELECT class_id, ym FROM lm WHERE ym <= (SELECT cur FROM meta)
                  UNION SELECT id, (SELECT cur FROM meta) FROM class WHERE kind = 'paid'),
       held AS (SELECT m.student_id, l.ym, COUNT(*) h
                FROM mark m JOIN student s ON s.id = m.student_id
                JOIN les l ON l.class_id = s.class_id AND l.d = m.d
                WHERE m.raw = 'ot' AND l.d <= (SELECT today FROM meta) AND (s.joined IS NULL OR l.d >= s.joined)
                GROUP BY m.student_id, l.ym)
  SELECT p.student_id, p.class_id, mo.ym, COALESCE(h.h, 0) held,
         CASE WHEN s.joined IS NOT NULL AND substr(s.joined, 1, 7) > mo.ym THEN 0
              WHEN p.plan_t = 'day' THEN p.plan_sum * COALESCE(h.h, 0)
              WHEN EXISTS (SELECT 1 FROM lm WHERE lm.class_id = p.class_id AND lm.ym = mo.ym) THEN p.plan_sum
              ELSE 0 END charge
  FROM v_plan p JOIN student s ON s.id = p.student_id
  JOIN months mo ON mo.class_id = p.class_id
  LEFT JOIN held h ON h.student_id = p.student_id AND h.ym = mo.ym;
"""

# ── so'rovlar ──────────────────────────────────────────────────────────────
# O'quvchi qatorlari davr uchun (web: reportRows): baholar soni va o'rtachasi, S/DQ/K/KQ/CH, davomat %
Q_STUDENTS = """
WITH les AS (SELECT class_id, d FROM lesson
             WHERE in_dates = 1 AND no_lesson = 0 AND d BETWEEN :lo AND :hi AND d <= (SELECT today FROM meta)),
     nles AS (SELECT class_id, COUNT(*) n FROM les GROUP BY class_id),
     mk AS (SELECT m.student_id, m.raw, m.att FROM mark m JOIN student s ON s.id = m.student_id
            JOIN les l ON l.class_id = s.class_id AND l.d = m.d),
     cnt AS (SELECT student_id, SUM(att = 's') s, SUM(att = 'dq') dq, SUM(att = 'k') k, SUM(att = 'kq') kq,
                    SUM(raw = 'ch') ch, SUM(raw = 'ot') ot, SUM(raw = 'ox') ox FROM mk GROUP BY student_id),
     gr AS (SELECT g.student_id, COUNT(*) n, AVG(g.g) a FROM grade g JOIN student s ON s.id = g.student_id
            JOIN les l ON l.class_id = s.class_id AND l.d = g.d GROUP BY g.student_id)
SELECT s.id, s.class_id, s.name, COALESCE(gr.n, 0) n, CASE WHEN gr.n > 0 THEN pyfix(gr.a, 2) END avg,
       COALESCE(nles.n, 0) lessons, COALESCE(cnt.s, 0) s, COALESCE(cnt.dq, 0) dq, COALESCE(cnt.k, 0) k,
       COALESCE(cnt.kq, 0) kq, COALESCE(cnt.ch, 0) ch,
       CASE WHEN c.kind IS NOT NULL THEN
              CASE WHEN COALESCE(cnt.ot, 0) + COALESCE(cnt.ox, 0) > 0 THEN pyfix(100.0 * cnt.ot / (cnt.ot + cnt.ox), 1) END
            WHEN COALESCE(nles.n, 0) - COALESCE(cnt.ch, 0) > 0 THEN
              pyfix(100.0 * (nles.n - COALESCE(cnt.ch, 0) - COALESCE(cnt.s, 0) - COALESCE(cnt.dq, 0) - COALESCE(cnt.k, 0))
                    / (nles.n - COALESCE(cnt.ch, 0)), 1) END att
FROM student s JOIN class c ON c.id = s.class_id
LEFT JOIN nles ON nles.class_id = s.class_id LEFT JOIN cnt ON cnt.student_id = s.id LEFT JOIN gr ON gr.student_id = s.id
WHERE s.active = 1 AND (:cid IS NULL OR s.class_id = :cid)
ORDER BY c.ord, s.ord
"""

# Chorak natijasi (web: quarterResult): BSB, CHSB, FB, jami, to'liqmi, baho
Q_QUARTER = """
WITH qw AS (SELECT w.* FROM work w WHERE w.d BETWEEN :qlo AND :qhi),
     mx AS (SELECT class_id, SUM(CASE WHEN type = 'bsb' THEN max ELSE 0 END) mb,
                   SUM(CASE WHEN type <> 'bsb' THEN max ELSE 0 END) mc, COUNT(*) nw FROM qw GROUP BY class_id),
     ss AS (SELECT s.id student_id, SUM(CASE WHEN qw.type = 'bsb' THEN sc.v ELSE 0 END) b,
                   SUM(CASE WHEN qw.type <> 'bsb' THEN sc.v ELSE 0 END) c, COUNT(sc.v) got
            FROM student s JOIN qw ON qw.class_id = s.class_id
            LEFT JOIN score sc ON sc.work_id = qw.id AND sc.student_id = s.id GROUP BY s.id),
     fb AS (SELECT g.student_id, COUNT(*) n, AVG(g.g) a FROM grade g JOIN student s ON s.id = g.student_id
            JOIN lesson l ON l.class_id = s.class_id AND l.d = g.d
            WHERE g.d BETWEEN :qlo AND :qhi AND l.no_lesson = 0 AND l.is_sum = 0 GROUP BY g.student_id),
     r AS (SELECT s.id, s.class_id, COALESCE(ss.b, 0) bsb, COALESCE(ss.c, 0) chsb,
                  CASE WHEN fb.n >= (SELECT fb_min FROM meta) THEN CAST(floor(fb.a + 0.5) AS INTEGER) ELSE 0 END fb,
                  COALESCE(mx.mb, 0) = 50 AND COALESCE(mx.mc, 0) = 40 AND COALESCE(mx.nw, 0) = COALESCE(ss.got, 0) complete
           FROM student s LEFT JOIN ss ON ss.student_id = s.id LEFT JOIN mx ON mx.class_id = s.class_id
           LEFT JOIN fb ON fb.student_id = s.id WHERE s.active = 1)
SELECT id, class_id, bsb, chsb, fb, bsb + chsb + fb total, complete,
       CASE WHEN NOT complete THEN NULL WHEN bsb + chsb + fb >= 86 THEN 5 WHEN bsb + chsb + fb >= 66 THEN 4
            WHEN bsb + chsb + fb >= 30 THEN 3 ELSE 2 END grade
FROM r
"""

# Sinflarni solishtirish (web: compareRows): vaznli o'rtacha, davomat, BSB/CHSB %, sifat va o'zlashtirish
Q_COMPARE = """
WITH sr AS ({students}),
     q AS ({quarter}),
     wk AS (SELECT w.class_id, SUM(CASE WHEN w.type = 'bsb' THEN sc.v END) bg, SUM(CASE WHEN w.type = 'bsb' THEN w.max END) bm,
                   SUM(CASE WHEN w.type <> 'bsb' THEN sc.v END) cg, SUM(CASE WHEN w.type <> 'bsb' THEN w.max END) cm
            FROM work w JOIN score sc ON sc.work_id = w.id JOIN student s ON s.id = sc.student_id AND s.active = 1
            WHERE w.d BETWEEN :lo AND :hi GROUP BY w.class_id),
     ql AS (SELECT class_id, SUM(complete) qn, SUM(complete AND grade >= 4) q45, SUM(complete AND grade >= 3) q35 FROM q GROUP BY class_id)
SELECT c.id, c.name || CASE WHEN c.subject <> '' THEN ' · ' || c.subject ELSE '' END cls,
       COUNT(sr.id) n, MAX(sr.lessons) lessons,
       SUM(CASE WHEN sr.avg IS NOT NULL THEN sr.n ELSE 0 END) nGr,
       SUM(CASE WHEN sr.avg IS NOT NULL THEN sr.avg * sr.n END) sGr,
       SUM(sr.avg * sr.n) / NULLIF(SUM(CASE WHEN sr.avg IS NOT NULL THEN sr.n ELSE 0 END), 0) avg,
       COUNT(sr.att) nAt, SUM(sr.att) sAt, AVG(sr.att) att,
       wk.bg, wk.bm, wk.cg, wk.cm, 100.0 * wk.bg / wk.bm bsb, 100.0 * wk.cg / wk.cm chsb,
       COALESCE(ql.qn, 0) qn, COALESCE(ql.q45, 0) q45, COALESCE(ql.q35, 0) q35,
       100.0 * ql.q45 / NULLIF(ql.qn, 0) qq, 100.0 * ql.q35 / NULLIF(ql.qn, 0) qu
FROM class c LEFT JOIN sr ON sr.class_id = c.id LEFT JOIN wk ON wk.class_id = c.id LEFT JOIN ql ON ql.class_id = c.id
WHERE c.kind IS NULL GROUP BY c.id ORDER BY c.ord
"""

# Ishlar bo'yicha (web: sumData): topshirganlar, o'rtacha, %, eng past/yuqori, foiz oraliqlari
Q_WORKS = """
SELECT w.class_id, w.wid id, w.type, w.d, w.max, COUNT(sc.v) n, AVG(sc.v) avg,
       100.0 * SUM(sc.v) / (COUNT(sc.v) * w.max) pct, MIN(sc.v) lo, MAX(sc.v) hi,
       COALESCE(SUM(100.0 * sc.v / w.max >= 86), 0) b5, COALESCE(SUM(100.0 * sc.v / w.max >= 66 AND 100.0 * sc.v / w.max < 86), 0) b4,
       COALESCE(SUM(100.0 * sc.v / w.max >= 30 AND 100.0 * sc.v / w.max < 66), 0) b3, COALESCE(SUM(100.0 * sc.v / w.max < 30), 0) b2
FROM work w JOIN class c ON c.id = w.class_id
LEFT JOIN (SELECT sc.* FROM score sc JOIN student s ON s.id = sc.student_id AND s.active = 1) sc ON sc.work_id = w.id
WHERE w.d BETWEEN :qlo AND :qhi
GROUP BY w.id ORDER BY c.ord, w.d, w.type <> 'bsb', w.wid
"""

# Guruhlar to'lishi (web: grFill): a'zolar, sig'im, oy darslari, qatnashuv %
Q_FILL = """
WITH les AS (SELECT class_id, d FROM lesson WHERE in_dates = 1 AND no_lesson = 0 AND ym = :ym AND d <= (SELECT today FROM meta)),
     mk AS (SELECT s.class_id, m.d, m.raw FROM mark m JOIN student s ON s.id = m.student_id AND s.active = 1
            JOIN les l ON l.class_id = s.class_id AND l.d = m.d WHERE m.raw IN ('ot', 'ox'))
SELECT c.id, c.name, c.kind, c.cap,
       (SELECT COUNT(*) FROM student s WHERE s.class_id = c.id AND s.active = 1) n,
       (SELECT COUNT(DISTINCT d) FROM mk WHERE mk.class_id = c.id AND raw = 'ot') held,
       (SELECT jsround(100.0 * SUM(raw = 'ot') / COUNT(*)) FROM mk WHERE mk.class_id = c.id) att
FROM class c WHERE c.kind IS NOT NULL ORDER BY c.ord
"""

# O'quv yili bo'yicha qatnashuv (web: gYear)
Q_YEAR = """
SELECT s.class_id, s.id, s.name, SUM(m.raw = 'ot') ot, SUM(m.raw = 'ox') ox,
       jsround(100.0 * SUM(m.raw = 'ot') / NULLIF(SUM(m.raw IN ('ot', 'ox')), 0)) pct
FROM student s JOIN class c ON c.id = s.class_id AND c.kind IS NOT NULL
LEFT JOIN lesson l ON l.class_id = s.class_id AND l.in_dates = 1 AND l.no_lesson = 0 AND l.d <= (SELECT today FROM meta)
LEFT JOIN mark m ON m.student_id = s.id AND m.d = l.d
WHERE s.active = 1 GROUP BY s.id ORDER BY c.ord, s.ord
"""

# Moliyaviy hisobot (web: finOf): boshlang'ich qarz + hisoblangan − tushum = yakuniy qarz; faolsizlar ham, ketgan oyigacha
Q_FIN = """
WITH ch AS (SELECT v.class_id, v.ym, v.charge FROM v_charge v JOIN student s ON s.id = v.student_id
            WHERE s.off_at IS NULL OR v.ym <= substr(s.off_at, 1, 7)),
     chs AS (SELECT class_id, SUM(CASE WHEN ym < :mlo THEN charge ELSE 0 END) open_ch,
                    SUM(CASE WHEN ym BETWEEN :mlo AND :mhi THEN charge ELSE 0 END) charged FROM ch GROUP BY class_id),
     pd AS (SELECT s.class_id, SUM(CASE WHEN p.d < :lo THEN p.sum ELSE 0 END) open_pd,
                   SUM(CASE WHEN p.d BETWEEN :lo AND :hi THEN p.sum ELSE 0 END) got
            FROM pay p JOIN student s ON s.id = p.student_id GROUP BY s.class_id)
SELECT c.id, c.name, COALESCE(c.svc, 'private') svc, COALESCE(chs.open_ch, 0) - COALESCE(pd.open_pd, 0) open,
       COALESCE(chs.charged, 0) charged, COALESCE(pd.got, 0) got,
       COALESCE(chs.open_ch, 0) - COALESCE(pd.open_pd, 0) + COALESCE(chs.charged, 0) - COALESCE(pd.got, 0) close
FROM class c LEFT JOIN chs ON chs.class_id = c.id LEFT JOIN pd ON pd.class_id = c.id
WHERE c.kind = 'paid' ORDER BY c.ord
"""
Q_FIN_HOW = """
SELECT s.class_id, COALESCE(NULLIF(p.how, ''), '—') how, SUM(p.sum) v FROM pay p JOIN student s ON s.id = p.student_id
WHERE p.d BETWEEN :lo AND :hi GROUP BY s.class_id, 2
"""

# Oylik to'lov holati (web: grMat): o'quvchi × oy — hisoblangan va shu oy uchun to'langan
Q_MATRIX = """
SELECT v.class_id, v.student_id, v.ym, v.held, v.charge, COALESCE(p.v, 0) paid
FROM v_charge v JOIN student s ON s.id = v.student_id AND s.active = 1
LEFT JOIN (SELECT student_id, m, SUM(sum) v FROM pay GROUP BY student_id, m) p ON p.student_id = v.student_id AND p.m = v.ym
ORDER BY v.class_id, s.ord, v.ym
"""


# ── yuklash (ETL) ──────────────────────────────────────────────────────────
def grades_of(m: str) -> list[int]:
    if not m:
        return []
    g = m[:-2] if m.endswith("kq") else m
    p = g.split("/") if g else []
    return [int(x) for x in p] if p and all(re.fullmatch(r"\d+", x) for x in p) else []


def att_part(m: str) -> str:
    if not m:
        return ""
    if not grades_of(m) and m != "kq":
        return m
    return "kq" if m.endswith("kq") else ""


def pyfix(x, d):
    return None if x is None else float(f"{x:.{int(d)}f}")


def jsround(x):
    return None if x is None else math.floor(x + 0.5)


def connect(path: str = ":memory:") -> sqlite3.Connection:
    con = sqlite3.connect(path)
    con.row_factory = sqlite3.Row
    con.create_function("pyfix", 2, pyfix, deterministic=True)
    con.create_function("jsround", 1, jsround, deterministic=True)
    return con


def load(con: sqlite3.Connection, data: dict, today: str | None = None) -> None:
    """Jurnal ma'lumotini bazaga yozadi (bitta tranzaksiya)."""
    today = today or dt.date.today().isoformat()
    st = data.get("settings") or {}
    mw = st.get("method_weekday")
    con.executescript(SCHEMA)
    con.execute("INSERT INTO meta VALUES (?, ?, ?)", (today, today[:7], max(1, int(st.get("fb_min") or 4))))
    for q, r in enumerate(st.get("quarters") or [], 1):
        if r and r[0] and r[1]:
            con.execute("INSERT INTO quarter VALUES (?, ?, ?)", (q, r[0], r[1]))
    for ci, c in enumerate(data.get("classes") or []):
        kind = c.get("kind") if c.get("kind") in ("club", "paid") else None
        fee = c.get("fee") or {}
        cid = con.execute("INSERT INTO class(ord, name, subject, kind, svc, cap, time, fee_month, fee_day) VALUES (?,?,?,?,?,?,?,?,?)",
                          (ci, str(c.get("name") or "?"), str(c.get("subject") or ""), kind, c.get("svc"), c.get("cap") or None,
                           c.get("time"), int(fee.get("month") or 0), int(fee.get("day") or 0))).lastrowid
        extra_x, held = set(c.get("extra_x") or []), set(c.get("held") or [])
        sums = set() if kind else {w.get("date") for w in c.get("works") or [] if w.get("type") in ("bsb", "chsb")}
        studs = [(s, 1) for s in c.get("students") or []] + [(s, 0) for s in c.get("students_off") or []]
        days = set(c.get("dates") or []) | {d for s, _ in studs for d in (s.get("marks") or {})}

        def no_lesson(d):
            return d in extra_x or (mw is not None and mw >= 0 and dt.date.fromisoformat(d).weekday() == mw and d not in held)
        in_dates = set(c.get("dates") or [])
        con.executemany("INSERT INTO lesson VALUES (?,?,?,?,?,?)",
                        [(cid, d, d[:7], int(d in in_dates), int(no_lesson(d)), int(d in sums)) for d in sorted(days)])
        wids = {}
        for w in c.get("works") or []:
            wids[str(w.get("id"))] = con.execute("INSERT INTO work(class_id, wid, type, d, max) VALUES (?,?,?,?,?)",
                                                 (cid, str(w.get("id")), w.get("type"), w.get("date"), float(w.get("max") or 0))).lastrowid
        for k, (s, active) in enumerate(studs):
            plan = s.get("plan") or {}
            sid = con.execute("INSERT INTO student(class_id, ord, active, sid, name, cls, joined, off_at, plan_t, plan_sum, phone) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                              (cid, k, active, s.get("id"), str(s.get("name") or "?"), s.get("cls"), s.get("joined") if kind else None,
                               (s.get("off") or {}).get("at") if not active else None,
                               ("day" if plan.get("t") == "day" else "month") if kind == "paid" else None,
                               int(plan.get("sum") or 0), (s.get("par") or {}).get("phone"))).lastrowid
            marks = s.get("marks") or {}
            con.executemany("INSERT INTO mark VALUES (?,?,?,?,?)",
                            [(sid, d, m, att_part(m), int(m.endswith("kq"))) for d, m in marks.items() if m])
            con.executemany("INSERT INTO grade VALUES (?,?,?,?)",
                            [(sid, d, j, g) for d, m in marks.items() for j, g in enumerate(grades_of(m or ""))])
            con.executemany("INSERT INTO score VALUES (?,?,?)",
                            [(wids[w], sid, float(v)) for w, v in (s.get("scores") or {}).items()
                             if w in wids and isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)])
            con.executemany("INSERT INTO pay(student_id, no, d, m, sum, how) VALUES (?,?,?,?,?,?)",
                            [(sid, p.get("no"), p.get("d") or "", p.get("m"), int(p.get("sum") or 0), p.get("how") or "") for p in s.get("pays") or []])
            k_ = s.get("contract")
            if k_ and k_.get("no"):
                con.execute("INSERT INTO contract VALUES (?,?,?,?,?,?,?)",
                            (sid, k_["no"], k_.get("d"), k_.get("payer"), k_.get("from"), k_.get("to"), int(bool(k_.get("disc")))))
    con.commit()


# ── hisobotlar ─────────────────────────────────────────────────────────────
def quarter_range(con, q):
    r = con.execute("SELECT lo, hi FROM quarter WHERE q = ?", (q,)).fetchone()
    return (r["lo"], r["hi"]) if r else None


def students(con, lo, hi, cid=None):
    return [dict(r) for r in con.execute(Q_STUDENTS, {"lo": lo, "hi": hi, "cid": cid})]


def compare(con, lo, hi, q=None):
    qr = quarter_range(con, q) if q else None
    sql = Q_COMPARE.format(students=Q_STUDENTS.replace("ORDER BY c.ord, s.ord", ""), quarter=Q_QUARTER)
    rows = [dict(r) for r in con.execute(sql, {"lo": lo, "hi": hi, "cid": None, "qlo": qr[0] if qr else "9", "qhi": qr[1] if qr else "0"})]
    for r in rows:
        if not qr:
            r["qq"] = r["qu"] = None
    return rows


def compare_total(rows):
    s = lambda k: sum(r[k] or 0 for r in rows)
    pp = lambda g, m: 100 * s(g) / s(m) if s(m) else None
    return {"n": s("n"), "lessons": s("lessons"), "avg": s("sGr") / s("nGr") if s("nGr") else None, "att": s("sAt") / s("nAt") if s("nAt") else None,
            "bsb": pp("bg", "bm"), "chsb": pp("cg", "cm"), "qq": 100 * s("q45") / s("qn") if s("qn") else None,
            "qu": 100 * s("q35") / s("qn") if s("qn") else None}


def works(con, q):
    lo, hi = quarter_range(con, q)
    return [dict(r) for r in con.execute(Q_WORKS, {"qlo": lo, "qhi": hi})]


def fill(con, ym):
    return [dict(r) for r in con.execute(Q_FILL, {"ym": ym})]


def year_att(con):
    return [dict(r) for r in con.execute(Q_YEAR)]


def ledger(con):
    out = {}
    for r in con.execute(Q_MATRIX):
        L = out.setdefault(r["student_id"], {"class_id": r["class_id"], "held": {}, "charge": {}, "paid": {}})
        L["held"][r["ym"]] = r["held"]
        L["charge"][r["ym"]] = r["charge"]
    for r in con.execute("SELECT p.student_id, p.m, SUM(p.sum) v FROM pay p JOIN student s ON s.id = p.student_id AND s.active = 1 "
                         "JOIN class c ON c.id = s.class_id AND c.kind = 'paid' GROUP BY 1, 2 ORDER BY 1, MIN(p.id)"):
        out[r["student_id"]]["paid"][r["m"]] = r["v"]
    for L in out.values():
        L["charged"], L["paidAll"] = sum(L["charge"].values()), sum(L["paid"].values())
        L["debt"] = L["charged"] - L["paidAll"]
    return out


def finance(con, lo, hi):
    p = {"lo": lo, "hi": hi, "mlo": lo[:7], "mhi": hi[:7]}
    rows = [dict(r) for r in con.execute(Q_FIN, p)]
    how = {}
    for r in con.execute(Q_FIN_HOW, p):
        how.setdefault(r["class_id"], {})[r["how"]] = r["v"]
    for r in rows:
        r["how"] = how.get(r["id"], {})
    return rows


# ── buyruq satri ───────────────────────────────────────────────────────────
def _table(rows, cols, out=None):
    if out:
        with open(out, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f, delimiter=";")
            w.writerow(cols)
            w.writerows([[r.get(c) for c in cols] for r in rows])
        print(f"{out}: {len(rows)} qator")
        return
    fmtv = lambda v: "" if v is None else f"{v:.2f}".rstrip("0").rstrip(".") if isinstance(v, float) else str(v)
    data = [[fmtv(r.get(c)) for c in cols] for r in rows]
    wd = [max([len(c)] + [len(x[i]) for x in data]) for i, c in enumerate(cols)]
    print("  ".join(c.ljust(wd[i]) for i, c in enumerate(cols)))
    for x in data:
        print("  ".join(v.ljust(wd[i]) for i, v in enumerate(x)))


def main(argv=None):
    ap = argparse.ArgumentParser(description="Jurnal hisobotlari (SQLite)")
    ap.add_argument("jurnal", help="journal.json yoki web ilova zaxirasi (.json)")
    ap.add_argument("hisobot", nargs="?", choices=["sinflar", "ishlar", "guruhlar", "tolov", "moliya"])
    ap.add_argument("--db", help="bazani faylga saqlash (aks holda xotirada)")
    ap.add_argument("--bugun", help="hisob sanasi, YYYY-MM-DD (odatda — bugun)")
    ap.add_argument("--from", dest="lo")
    ap.add_argument("--to", dest="hi")
    ap.add_argument("--chorak", type=int)
    ap.add_argument("--oy", help="YYYY-MM")
    ap.add_argument("--csv", help="natijani CSV faylga yozish")
    a = ap.parse_args(argv)
    data = json.loads(Path(a.jurnal).read_text(encoding="utf-8"))
    if a.db and Path(a.db).exists():
        Path(a.db).unlink()
    con = connect(a.db or ":memory:")
    load(con, data, a.bugun)
    today = con.execute("SELECT today FROM meta").fetchone()[0]
    if not a.hisobot:
        print(f"{a.db or 'xotira'}: " + ", ".join(f"{t} {con.execute(f'SELECT COUNT(*) FROM {t}').fetchone()[0]}"
                                                   for t in ("class", "student", "lesson", "mark", "grade", "work", "score", "pay", "contract")))
        return
    qr = quarter_range(con, a.chorak) if a.chorak else None
    lo, hi = a.lo or (qr[0] if qr else today[:4] + "-09-01"), a.hi or (qr[1] if qr else today)
    if a.hisobot == "sinflar":
        rows = compare(con, lo, hi, a.chorak)
        rows.append({"cls": "Jami / o'rtacha", **compare_total(rows)})
        _table(rows, ["cls", "n", "lessons", "avg", "att", "bsb", "chsb", "qq", "qu"], a.csv)
    elif a.hisobot == "ishlar":
        _table(works(con, a.chorak or 1), ["class_id", "id", "type", "d", "max", "n", "avg", "pct", "lo", "hi", "b5", "b4", "b3", "b2"], a.csv)
    elif a.hisobot == "guruhlar":
        _table(fill(con, a.oy or today[:7]), ["name", "kind", "cap", "n", "held", "att"], a.csv)
    elif a.hisobot == "tolov":
        rows = [dict(r) for r in con.execute(Q_MATRIX)]
        _table(rows, ["class_id", "student_id", "ym", "held", "charge", "paid"], a.csv)
    else:
        rows = finance(con, lo, hi)
        _table(rows, ["name", "svc", "open", "charged", "got", "close"], a.csv)


if __name__ == "__main__":
    sys.exit(main())
