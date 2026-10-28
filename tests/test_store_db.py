"""Jurnal SQLite faylda saqlanadi (journal.db): eski JSON ko'chiriladi, saqlash/o'qish aylanasi, zaxira JSON, buzuq fayl, bot holati."""
import json
import shutil
import sqlite3
import sys

import pytest

from pyjurnal import J, TESTS, ROOT

sys.path.insert(0, str(ROOT / "dastur"))
FIXTURE = TESTS / "fixtures" / "journal.json"


def _same(a, b):
    return json.dumps(a, sort_keys=True, ensure_ascii=False) == json.dumps(b, sort_keys=True, ensure_ascii=False)


def test_json_migrates_to_db(tmp_path):
    shutil.copy(FIXTURE, tmp_path / "journal.json")
    ref = J.Store(tmp_path / "journal.json").data               # eski usul
    st = J.Store(tmp_path / "journal.db")                       # birinchi ishga tushish: journal.json → journal.db
    assert (tmp_path / "journal.db").exists()
    assert not (tmp_path / "journal.json").exists() and (tmp_path / "journal.json.eski").exists()
    assert _same(st.data, ref)
    assert _same(J.Store(tmp_path / "journal.db").data, ref)    # qayta ochilganda ham xuddi shu


def test_save_roundtrip_and_tables(tmp_path):
    shutil.copy(FIXTURE, tmp_path / "journal.json")
    st = J.Store(tmp_path / "journal.db")
    c = st.classes[0]
    c["students"][0]["marks"]["2026-10-05"] = "9"
    st.save()
    assert _same(J.Store(tmp_path / "journal.db").data, st.data)
    con = sqlite3.connect(tmp_path / "journal.db")
    assert con.execute("SELECT COUNT(*) FROM classes").fetchone()[0] == len(st.classes)
    assert con.execute("SELECT COUNT(*) FROM students WHERE class_pos = 0").fetchone()[0] == len(c["students"])
    assert con.execute("SELECT name FROM students WHERE class_pos = 0 AND pos = 0").fetchone()[0] == c["students"][0]["name"]
    con.close()
    assert (tmp_path / "journal.db.bak").exists()


def test_backup_is_json_and_restores(tmp_path):
    shutil.copy(FIXTURE, tmp_path / "journal.json")
    st = J.Store(tmp_path / "journal.db")
    dest = st.backup("qolda")
    assert dest.suffix == ".json" and json.loads(dest.read_text(encoding="utf-8"))["classes"]
    assert st.auto_backup() is None                             # o'zgarmagan — yangi nusxa olinmaydi
    st.classes[0]["students"][0]["marks"]["2026-10-06"] = "5"
    st.save()
    assert st.auto_backup() is not None                         # o'zgargan — olinadi
    st.restore(dest)
    assert "2026-10-06" not in J.Store(tmp_path / "journal.db").classes[0]["students"][0]["marks"]


def test_corrupt_db_does_not_clobber_good_bak(tmp_path):
    shutil.copy(FIXTURE, tmp_path / "journal.json")
    st = J.Store(tmp_path / "journal.db")
    st.save()
    good_bak = (tmp_path / "journal.db.bak").read_bytes()
    (tmp_path / "journal.db").write_bytes(b"bu SQLite emas")
    with pytest.raises(Exception):
        J.Store(tmp_path / "journal.db")
    st.save()                                                   # buzuq fayl ustiga yaxshisi yoziladi, .bak buzilmaydi
    assert (tmp_path / "journal.db.bak").read_bytes() == good_bak
    assert J.Store(tmp_path / "journal.db").classes


def test_json_store_still_works(tmp_path):
    shutil.copy(FIXTURE, tmp_path / "journal.json")
    st = J.Store(tmp_path / "journal.json")
    st.save()
    assert json.loads((tmp_path / "journal.json").read_text(encoding="utf-8"))["classes"]


def test_bot_state_sqlite_and_migration(tmp_path, monkeypatch):
    import emaktab_tgbot as B
    legacy = tmp_path / "bot_holat.json"
    legacy.write_text(json.dumps({"123": {"sel": [1, 2]}, "_users": {"5": {"ok": True}}}, ensure_ascii=False), encoding="utf-8")
    monkeypatch.setattr(B, "STATE_FILE", tmp_path / "bot_holat.db")
    B.load_state()
    assert B.SAVED == {"123": {"sel": [1, 2]}, "_users": {"5": {"ok": True}}}
    assert (tmp_path / "bot_holat.db").exists() and (tmp_path / "bot_holat.json.eski").exists()
    B.SAVED["123"]["sel"] = [7]
    B.save_state()
    B.SAVED = {}
    B.load_state()
    assert B.SAVED["123"]["sel"] == [7]
    assert oct((tmp_path / "bot_holat.db").stat().st_mode & 0o777) == "0o600"


def test_reports_read_db(tmp_path):
    import hisobot_sqlite as H
    shutil.copy(FIXTURE, tmp_path / "journal.json")
    J.Store(tmp_path / "journal.db")
    assert _same(H.read_journal(tmp_path / "journal.db")["classes"], J.Store(tmp_path / "journal.db").classes)
