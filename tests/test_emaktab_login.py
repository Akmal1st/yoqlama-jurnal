"""emaktab kirish tartibi (soxta sayt bilan, tarmoqsiz): 1) login + parol; 2) yana shu sahifa ochilsa —
login, parol va captcha (rasm foydalanuvchiga yuboriladi); 3) muvaffaqiyat."""
import sys
from email.message import Message
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "dastur"))
import emaktab_http as EH  # noqa: E402

PAGE = """<form action="/login" method="post"><input name="login" type="text"><input name="password" type="password">
{cap}<button type="submit">Kirish</button></form><img src="/logo.svg">"""
# emaktabdagi haqiqiy belgi (Akmal, 2026-10-28); src (guid) har safar yangi
CAPTCHA = '<img alt="captcha image" class="captcha__image" src="https://login.emaktab.uz/captcha/true/{g}"><input name="Captcha.Input" type="text">'
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 100


class UI:
    def __init__(self, answer="AB12"):
        self.answer, self.asked, self.logs = answer, [], []

    def log(self, s):
        self.logs.append(s)

    def ask_captcha(self, png):
        self.asked.append(png)
        return self.answer


def site(monkeypatch, s, ok_password="parol", captcha_on_retry=True, ctype="image/png"):
    posts, seen = [], []

    def raw(url, data=None, headers=None, timeout=60):
        hd = Message()
        hd["Content-Type"] = "text/html; charset=utf-8"
        if "captcha/true" in url:
            assert url.endswith(seen[-1])                         # shu sahifadagi yangi rasm olinadi
            hd.replace_header("Content-Type", ctype)
            return 200, url, hd, PNG
        if url.endswith("/userfeed") or "myclasses" in url or "/v2/" in url:   # tekshiruv: kirilmagan
            return 200, "https://login.emaktab.uz/", hd, PAGE.format(cap="").encode()
        if data is not None:
            posts.append(dict(data))
            first = len(posts) == 1
            good = data.get("password") == ok_password and (not captcha_on_retry or (not first and data.get("Captcha.Input") == "AB12"))
            if good:
                return 200, "https://emaktab.uz/userfeed", hd, b"<html>ok</html>"
            guid = f"1b333a0e-187a-40a0-b205-{len(posts):012d}"
            seen.append(guid)
            return 200, "https://login.emaktab.uz/login", hd, PAGE.format(cap=CAPTCHA.format(g=guid) if captcha_on_retry else "").encode()
        return 200, "https://login.emaktab.uz/", hd, PAGE.format(cap="").encode()

    monkeypatch.setattr(s, "raw", raw)
    monkeypatch.setattr(s, "save_state", lambda: None)
    return posts


def make(tmp_path, ui):
    s = EH.EmkHttp(ui, "", home=tmp_path)
    s.__enter__()
    return s


@pytest.mark.parametrize("ctype", ["image/png", "application/octet-stream"])
def test_login_then_captcha(tmp_path, monkeypatch, ctype):
    ui = UI()
    s = make(tmp_path, ui)
    posts = site(monkeypatch, s, ctype=ctype)
    s.login("ali", "parol")
    assert len(posts) == 2
    assert posts[0]["login"] == "ali" and posts[0]["password"] == "parol" and not posts[0].get("Captcha.Input")
    assert posts[1]["login"] == "ali" and posts[1]["password"] == "parol" and posts[1]["Captcha.Input"] == "AB12"
    assert ui.asked == [PNG] and "Muvaffaqiyatli kirildi." in ui.logs
    assert (tmp_path / "debug_login.html").exists()


def test_login_without_captcha(tmp_path, monkeypatch):
    ui = UI()
    s = make(tmp_path, ui)
    posts = site(monkeypatch, s, captcha_on_retry=False)
    s.login("ali", "parol")
    assert len(posts) == 1 and ui.asked == []


def test_wrong_password_no_captcha(tmp_path, monkeypatch):
    s = make(tmp_path, UI())
    site(monkeypatch, s, ok_password="boshqa", captcha_on_retry=False)
    with pytest.raises(RuntimeError, match="Login yoki parol noto'g'ri"):
        s.login("ali", "parol")


def test_captcha_outside_form(tmp_path, monkeypatch):
    """Captcha rasmi va maydoni forma tashqarisida bo'lsa ham topiladi."""
    global PAGE
    old = PAGE
    PAGE = old.replace("{cap}<button", "<button").replace("</form>", "</form>{cap}")
    try:
        ui = UI()
        s = make(tmp_path, ui)
        posts = site(monkeypatch, s)
        s.login("ali", "parol")
        assert posts[1]["Captcha.Input"] == "AB12" and len(ui.asked) == 1
    finally:
        PAGE = old
