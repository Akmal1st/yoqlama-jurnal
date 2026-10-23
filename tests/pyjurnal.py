"""Kompyuter dasturi (dastur/yoqlama_jurnal.py) hisob-kitoblarini test ma'lumotlari ustida bajaradi.
Natija golden.json bilan solishtiriladi; web ilova (docs/index.html) ham aynan shu natijani berishi kerak."""
import datetime
import json
import os
import shutil
import sys
import tempfile
import types
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TESTS = ROOT / "tests"
os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
sys.path.insert(0, str(ROOT / "dastur"))

import pandas as pd  # noqa: E402
import yoqlama_jurnal as J  # noqa: E402

INPUTS = json.loads((TESTS / "inputs.json").read_text(encoding="utf-8"))
TODAY = datetime.date.fromisoformat(INPUTS["today"])


class _FixedDate(datetime.date):
    @classmethod
    def today(cls):
        return cls(TODAY.year, TODAY.month, TODAY.day)


J.dt = types.SimpleNamespace(**{k: getattr(datetime, k) for k in dir(datetime) if not k.startswith("_")})
J.dt.date = _FixedDate


def norm(v):
    """JSON'ga mos, solishtirish uchun: kasr sonlar 6 xonagacha, butun kasrlar — butun son."""
    if isinstance(v, bool) or v is None or isinstance(v, str):
        return v
    if isinstance(v, (int, float)):
        r = round(float(v), 6)
        return int(r) if r == int(r) else r
    if isinstance(v, dict):
        return {str(k): norm(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [norm(x) for x in v]
    return str(v)


QKEYS = ["bsb", "chsb", "fb", "n_fb", "avg", "total", "max_bsb", "max_chsb", "missing", "complete", "grade"]
YKEYS = ["sb", "avg_fb", "year", "ready", "year_grade", "exam", "final", "final_grade"]
RKEYS = ["name", "n", "avg", "att", "s", "dq", "k", "kq", "ch", "absent", "why"]


def compute():
    tmp = Path(tempfile.mkdtemp())
    try:
        shutil.copy(TESTS / "fixtures" / "journal.json", tmp / "journal.json")
        store = J.Store(tmp / "journal.json")
        out = {
            "grade5": [J.grade5(t) for t in INPUTS["grade5"]],
            "marks": [J.norm_mark(t) for t in INPUTS["marks"]],
            "scores": [J.parse_score(t) for t in INPUTS["scores"]],
            "plans": [J.parse_plan_text(t) for t in INPUTS["plans"]],
            "emaktab": [],
            "classes": [],
        }
        for e in INPUTS["emaktab"]:
            width = max(len(r) for r in e["rows"])
            df = pd.DataFrame([r + [None] * (width - len(r)) for r in e["rows"]], dtype=object)
            sheets = J._emaktab_sheet(df, e["sheet"])
            for s in sheets:
                s.pop("source", None)
            out["emaktab"].append(sheets)
        lo, hi, q = store.period_now()
        for c in store.classes:
            co = {"label": J.cls_label(c), "quarters": {}, "year": [], "report": None}
            for qq in (1, 2):
                works = store.works_in_quarter(c, qq)
                co["quarters"][str(qq)] = {
                    "results": [{k: store.quarter_result(c, st, qq, works)[k] for k in QKEYS} for st in c["students"]],
                    "readiness": list(store.readiness(c, qq)),
                }
            for st in c["students"]:
                y = store.year_result(c, st)
                co["year"].append({**{k: y[k] for k in YKEYS}, "q": [r["grade"] if r else None for r in y["q"]]})
            rows, lessons, dates = store.report_rows(c, lo, hi, q)
            co["report"] = {"lessons": lessons, "dates": dates, "rows": [{k: r[k] for k in RKEYS} for r in rows]}
            out["classes"].append(co)
        out["period"] = [lo, hi, q]
        return norm(out)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
