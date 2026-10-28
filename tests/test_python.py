"""Kompyuter dasturi hisob-kitoblari golden.json bilan bir xilmi."""
import json

import pytest

from pyjurnal import TESTS, compute

GOLDEN = json.loads((TESTS / "golden.json").read_text(encoding="utf-8"))
RESULT = compute()


@pytest.mark.parametrize("key", ["grade5", "marks", "scores", "plans", "emaktab", "period", "bsb"])
def test_simple(key):
    assert RESULT[key] == GOLDEN[key]


@pytest.mark.parametrize("ci", range(len(GOLDEN["classes"])))
def test_class(ci):
    got, exp = RESULT["classes"][ci], GOLDEN["classes"][ci]
    assert got["quarters"] == exp["quarters"], "chorak natijalari / tayyorlik"
    assert got["year"] == exp["year"], "yillik natijalar"
    assert got["report"] == exp["report"], "hisobot va xavf belgilari"


# SQLite hisobotlari ham shu qadamda tekshiriladi (CI faqat test_python.py ni ishga tushiradi)
from test_sqlite import *  # noqa: E402,F401,F403
from test_store_db import *  # noqa: E402,F401,F403
