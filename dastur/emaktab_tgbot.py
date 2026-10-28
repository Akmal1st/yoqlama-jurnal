#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
emaktab_tgbot.py — emaktab jurnallarini Telegram bot orqali olish va sinf hisobotlari (FAQAT O'QISH).

Fayllar (bir papkada):
    emaktab_tgbot.py    — shu bot
    emaktab_http.py     — brauzersiz (faqat standart Python) kirish va Excel yuklash
    emaktab_hisobot.py  — sinf hisoboti (yo'qlama jurnalidagi «Hisobotlar» bilan bir xil hisob)
    yoqlama_jurnal.py   — hisobot uchun kerak (pip install PySide6 pandas xlrd openpyxl)
    emaktab_pw.py       — ixtiyoriy zaxira: sizning Playwright kodingiz (pip install playwright && playwright install chromium)

Sozlash — bot.env fayli (shu papkada; bot.env.example dan nusxa oling):
    TELEGRAM_BOT_TOKEN=123456:ABC...      # @BotFather dan
    ADMIN_IDS=11111111                    # admin(lar) Telegram ID — yangi foydalanuvchilarni tasdiqlaydi
    ALLOWED_IDS=                          # ixtiyoriy: tasdiqsiz to'liq ruxsat berilganlar (ADMIN_IDS bo'sh bo'lsa — ular admin)
    JURNAL_FILE=                          # ixtiyoriy: journal.json (xavf mezonlari, chorak sanalari, PDF dizayni shundan olinadi)
(Muhit o'zgaruvchilari ham ishlaydi. Login/parol faylga yozilmaydi — bot ularni chatda so'raydi.)

Ishga tushirish:   python3 emaktab_tgbot.py [--show]

Foydalanuvchilar: yangi odam botga yozsa, adminga «✅ Tasdiqlash / ⛔ Rad etish» tugmalari bilan xabar keladi.
Tasdiqlanguncha bot cheklangan (faqat ma'lumot va holat). Har foydalanuvchi o'z emaktab hisobi bilan kiradi:
sessiyasi, tanlovi va fayllari foydalanuvchilar/<ID>/ papkasida alohida. Foydalanuvchilar parallel ishlaydi.
Admin menyusida «👥 Foydalanuvchilar» — tasdiqlash, ruxsatni olish, o'chirish.

Hamma amallar tugmalar orqali (pastdagi menyu):
    📊 Hisobot     — jurnal → davr (chorak / oy / hafta) → qisqacha jadval chatda; so'ng PDF, Excel,
                     xavf ostidagilar, o'quvchi varaqlari (ota-onalar uchun)
    📥 Eksport     — tanlangan jurnallar emaktab Excel faylini yuborish (joriy yoki 1–4 chorak)
    📚 Sinflar     — «Mening sinflarim»: sinflarni ✅ belgilab saqlash (jurnal havolasini yuborsangiz ham qo'shiladi)
    📋 Tanlangan   — tanlangan jurnallar
    🔑 Kirish      — login/parol (captcha chiqsa rasm keladi — belgilarni yozasiz)
    ℹ️ Holat, ⚙️ Sozlamalar — usul (auto/http/brauzer), Cookie bilan kirish, tanlovni tozalash, chiqish
"""
import argparse
import io
import json
import mimetypes
import os
import queue
import re
import shutil
import sqlite3
import sys
import threading
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))


def load_env():
    p = Path(os.environ.get("BOT_ENV", HERE / "bot.env"))
    if p.exists():
        for line in p.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.split(" #")[0].strip().strip("'\""))


load_env()
import emaktab_http as EH                                       # noqa: E402

TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
API = os.environ.get("TG_API", "https://api.telegram.org")
ALLOWED = {int(x) for x in re.findall(r"-?\d+", os.environ.get("ALLOWED_IDS", ""))}      # oldindan ruxsat berilganlar
ADMINS = {int(x) for x in re.findall(r"-?\d+", os.environ.get("ADMIN_IDS", ""))} or set(ALLOWED)   # bo'sh — ALLOWED_IDS admin
ENGINE = os.environ.get("EMAKTAB_ENGINE", "auto").lower()      # bitta avtomatik usul: kirish — brauzer (bo'lsa), qolgani HTTP
ENGINE = ENGINE if ENGINE in ("auto", "http", "pw") else "auto"
STATE_FILE = Path(os.environ.get("BOT_STATE", HERE / "bot_holat.db"))
USERS_DIR = Path(os.environ.get("BOT_USERS", HERE / "foydalanuvchilar"))   # har foydalanuvchining sessiyasi va fayllari
JURNAL_FILE = Path(os.environ.get("JURNAL_FILE") or (HERE / "journal.db" if (HERE / "journal.db").exists() else HERE / "journal.json"))
CAPTCHA_WAIT = 240
CACHE_TTL = 15 * 60                                             # yuklangan Excel shuncha soniya qayta ishlatiladi
JOURNAL_RE = re.compile(r"/journal/school/(\d+)/group/(\d+)/subject/(\d+)")

OFFSET = None
SAVED = {}                                                      # chat -> {"sel": [...], "hidden": {...}}; "_users" -> {id: {...}}
STEP, TMP, CATALOG, COOKIE = {}, {}, {}, {}
PICK = {}                                                       # chat -> «Sinflar» oynasida belgilangan raqamlar
REP = {}                                                        # chat -> hisobot holati: {"j", "p", "book", "items"}
FILES = {}                                                      # (chat, url, chorak) -> (vaqt, yo'l)
PWMS = {}                                                       # chat -> o'z brauzeri: {"p", "browser", "ctx", "page", "mod"}
SHOW_BROWSER = [False]
QUEUES, WORKERS = {}, {}                                        # chat -> navbat va uning oqimi (foydalanuvchilar parallel)
PW_LOCK = threading.RLock()                                     # emaktab_pw modul o'zgaruvchilari umumiy — navbat bilan
REPORT_LOCK = threading.Lock()                                  # PDF/Qt chizish — navbat bilan
STATE_LOCK = threading.RLock()

# pastdagi doimiy menyu tugmalari
B_REPORT, B_EXPORT, B_CLASSES = "📊 Hisobot", "📥 Excel fayl", "📚 Sinflarim"
B_LOGIN, B_STATUS, B_SETTINGS = "🔑 emaktabga kirish", "ℹ️ Holat", "⚙️ Sozlamalar"
B_USERS, B_HELP = "👥 Foydalanuvchilar", "❓ Yordam"
LIMITED_MENU = {"keyboard": [[B_STATUS, B_HELP]], "resize_keyboard": True, "is_persistent": True}
PERIODS = (("cur", "Joriy chorak"), ("q1", "1-chorak"), ("q2", "2-chorak"), ("q3", "3-chorak"), ("q4", "4-chorak"),
           ("month", "Shu oy"), ("week", "Shu hafta"))


# ------------------------------------------------------------------ Telegram
def _form_safe(v):
    """multipart sarlavhasiga tushadigan nomlar: qo'shtirnoq, CR/LF va yo'l belgilarisiz."""
    return re.sub(r'[\r\n"\\/]', "_", str(v))


def tg(method, params=None, files=None, timeout=70):
    url = f"{API}/bot{TOKEN}/{method}"
    if files:
        b = uuid.uuid4().hex
        buf = io.BytesIO()
        for k, v in (params or {}).items():
            if isinstance(v, (dict, list)):
                v = json.dumps(v, ensure_ascii=False)
            buf.write(f'--{b}\r\nContent-Disposition: form-data; name="{_form_safe(k)}"\r\n\r\n{v}\r\n'.encode())
        for k, (fname, raw) in files.items():
            fname = _form_safe(fname)
            ct = mimetypes.guess_type(fname)[0] or "application/octet-stream"
            buf.write(f'--{b}\r\nContent-Disposition: form-data; name="{_form_safe(k)}"; filename="{fname}"\r\n'
                      f"Content-Type: {ct}\r\n\r\n".encode())
            buf.write(raw)
            buf.write(b"\r\n")
        buf.write(f"--{b}--\r\n".encode())
        req = urllib.request.Request(url, data=buf.getvalue(),
                                     headers={"Content-Type": f"multipart/form-data; boundary={b}"})
    else:
        req = urllib.request.Request(url, data=json.dumps(params or {}).encode(),
                                     headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read().decode("utf-8"))
        except Exception:                                      # noqa: BLE001
            return {"ok": False, "description": str(e)}
    except (urllib.error.URLError, OSError, ValueError) as e:  # tarmoq uzilishi, timeout: URL (token) chiqarilmaydi
        return {"ok": False, "description": f"tarmoq xatosi: {type(e).__name__}"}


def kb(rows):
    """Inline tugmalar: [[(matn, callback), …], …]."""
    return {"inline_keyboard": [[{"text": t, "callback_data": d} for t, d in row] for row in rows if row]}


def say(chat, text, markup=None, html=False):
    """Xabar yuboradi (uzun bo'lsa bo'laklab). Tugmalar oxirgi bo'lakka qo'yiladi. Qaytaradi: oxirgi xabar id."""
    text = str(text)
    parts = [text[i:i + 3900] for i in range(0, max(len(text), 1), 3900)] if not html else [text]
    mid = None
    for k, part in enumerate(parts):
        p = {"chat_id": chat, "text": part, "disable_web_page_preview": True}
        if html:
            p["parse_mode"] = "HTML"
        if markup and k == len(parts) - 1:
            p["reply_markup"] = markup
        r = tg("sendMessage", p)
        if html and not r.get("ok"):                            # HTML xato bo'lsa — oddiy matn
            p.pop("parse_mode")
            p["text"] = re.sub(r"<[^>]+>", "", part).replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
            r = tg("sendMessage", p)
        mid = (r.get("result") or {}).get("message_id", mid)
    return mid


def show(chat, text, markup=None, mid=None, html=False):
    """Inline oynani yangilaydi (mid bo'lsa xabarni tahrirlaydi, aks holda yangi xabar)."""
    if mid:
        p = {"chat_id": chat, "message_id": mid, "text": text, "disable_web_page_preview": True,
             "reply_markup": markup or {"inline_keyboard": []}}
        if html:
            p["parse_mode"] = "HTML"
        r = tg("editMessageText", p)
        if r.get("ok") or "not modified" in str(r.get("description", "")):
            return mid
    return say(chat, text, markup, html)


def send_bytes(chat, name, raw, caption="", kind="document"):
    r = tg("sendPhoto" if kind == "photo" else "sendDocument", {"chat_id": chat, "caption": caption}, files={kind: (name, raw)})
    if kind == "photo" and not r.get("ok"):
        send_bytes(chat, name, raw, caption, "document")


def send_file(chat, path, caption=""):
    send_bytes(chat, Path(path).name, Path(path).read_bytes(), caption)


def typing(chat, action="typing"):
    tg("sendChatAction", {"chat_id": chat, "action": action})


def delete_msg(chat, mid):
    tg("deleteMessage", {"chat_id": chat, "message_id": mid})


def next_updates(timeout=50):
    global OFFSET
    r = tg("getUpdates", {"timeout": timeout, "offset": OFFSET, "allowed_updates": ["message", "callback_query"]},
           timeout=timeout + 20)
    out = []
    if not r.get("ok"):
        time.sleep(5)       # tarmoq/Telegram xatosida band aylanmasin
    for u in r.get("result", []) if r.get("ok") else []:
        OFFSET = u["update_id"] + 1
        if "message" in u or "callback_query" in u:
            out.append(u)
    return out


class UI:
    """emaktab_http / Playwright qismlari uchun: shu foydalanuvchiga xabarlar va captcha (Telegram orqali).
    Captcha javobi foydalanuvchining o'z navbatidan olinadi — boshqa foydalanuvchilar ishi to'xtamaydi."""

    def __init__(self, chat):
        self.chat = chat

    def log(self, s):
        if re.search(r"Captcha rasmi|Captcha kiritildi|Kirib bo'lmadi|Muvaffaqiyatli", str(s)):
            say(self.chat, str(s))

    def ask_captcha(self, png):
        chat = self.chat
        ext = "png" if bytes(png[:4]) == b"\x89PNG" else ("jpg" if bytes(png[:2]) == b"\xff\xd8" else "gif" if bytes(png[:3]) == b"GIF" else "png")
        send_bytes(chat, f"captcha.{ext}", bytes(png), "Captcha: rasmdagi belgilarni yozib yuboring", "photo")
        q = QUEUES.get(chat)
        end = time.time() + CAPTCHA_WAIT
        while q is not None and time.time() < end:
            try:
                u = q.get(timeout=5)
            except queue.Empty:
                continue
            if "callback_query" in u:                          # captcha kutilayotganda tugmalar ishlamaydi
                tg("answerCallbackQuery", {"callback_query_id": u["callback_query"]["id"],
                                           "text": "Avval captcha belgilarini yozib yuboring"})
                continue
            t = (u["message"].get("text") or "").strip()
            if t:
                return t
        say(chat, "Captcha javobi kelmadi (vaqt tugadi).")
        return None


# ------------------------------------------------------------------ holat
def _state_is_db():
    return STATE_FILE.suffix.lower() in (".db", ".sqlite", ".sqlite3")


def _state_read_db(path):
    con = sqlite3.connect(f"file:{Path(path).as_posix()}?mode=ro", uri=True)
    try:
        return {k: json.loads(v) for k, v in con.execute("SELECT k, v FROM state")}
    finally:
        con.close()


def load_state():
    """Holat SQLite faylda (jadval state: bitta qator — bitta chat yoki «_users»). Eski bot_holat.json bo'lsa — bir marta ko'chiriladi."""
    global SAVED
    legacy = STATE_FILE.with_suffix(".json")
    try:
        if not _state_is_db():
            SAVED = json.loads(STATE_FILE.read_text(encoding="utf-8"))
        elif STATE_FILE.exists():
            SAVED = _state_read_db(STATE_FILE)
        elif legacy.exists():
            SAVED = json.loads(legacy.read_text(encoding="utf-8"))
            save_state()
            os.replace(legacy, legacy.with_name(legacy.name + ".eski"))
        else:
            SAVED = {}
    except Exception:                                          # noqa: BLE001
        SAVED = {}


def save_state():
    with STATE_LOCK:
        try:
            tmp = STATE_FILE.with_name(STATE_FILE.name + ".tmp")
            if _state_is_db():
                tmp.unlink(missing_ok=True)
                con = sqlite3.connect(tmp)
                try:
                    con.execute("CREATE TABLE state(k TEXT PRIMARY KEY, v TEXT NOT NULL)")
                    con.executemany("INSERT INTO state VALUES (?, ?)", [(k, json.dumps(v, ensure_ascii=False)) for k, v in SAVED.items()])
                    con.commit()
                finally:
                    con.close()
            else:
                tmp.write_text(json.dumps(SAVED, ensure_ascii=False, indent=1), encoding="utf-8")
            tmp.chmod(0o600)                                   # o'quvchi ro'yxatlari: boshqa foydalanuvchilar o'qimasin
            os.replace(tmp, STATE_FILE)
        except (OSError, sqlite3.Error) as e:
            print("holatni yozib bo'lmadi:", e)


def conf(chat):
    with STATE_LOCK:
        c = SAVED.setdefault(str(chat), {})
        c.setdefault("sel", [])
        c.setdefault("hidden", {})                              # hisobotdan chiqarilgan o'quvchilar: {sinf yorlig'i: [ism, …]}
    return c


def home(chat):
    """Foydalanuvchining o'z papkasi: emaktab cookie'lari, brauzer sessiyasi, yuklangan fayllar."""
    d = USERS_DIR / str(chat)
    d.mkdir(parents=True, exist_ok=True)
    try:
        d.chmod(0o700)
    except OSError:
        pass
    return d


def out_dir(chat):
    return home(chat) / "eksport"


def http_s(chat):
    return EH.EmkHttp(UI(chat), COOKIE.get(chat, ""), home=home(chat))


# ------------------------------------------------------------------ foydalanuvchilar va ruxsat
def users():
    with STATE_LOCK:
        return SAVED.setdefault("_users", {})


def role(uid):
    """admin | ok (tasdiqlangan) | pending (kutilmoqda) | blocked (rad etilgan) | new (birinchi marta)."""
    if uid in ADMINS:
        return "admin"
    if uid in ALLOWED:
        return "ok"
    return users().get(str(uid), {}).get("st", "new")


def who(rec, uid):
    name = rec.get("name") or "—"
    return f"{name}" + (f" (@{rec['un']})" if rec.get("un") else "") + f" · ID {uid}"


def has_session(chat):
    return (USERS_DIR / str(chat) / "cookies.txt").exists() or (USERS_DIR / str(chat) / "state.json").exists()


def menu_for(uid):
    """Pastdagi menyu holatga qarab: kerakli tugma eng tepada, qolganlari pastda."""
    r = role(uid)
    if r not in ("admin", "ok"):
        return LIMITED_MENU
    if not has_session(uid):                                    # 1-qadam: kirish
        rows = [[B_LOGIN], [B_HELP]]
    elif not conf(uid)["sel"]:                                  # 2-qadam: sinflarni tanlash
        rows = [[B_CLASSES], [B_SETTINGS, B_HELP]]
    else:                                                       # ish rejimi: hisobot eng tepada
        rows = [[B_REPORT], [B_EXPORT, B_CLASSES], [B_SETTINGS, B_HELP]]
    if r == "admin":
        rows[-1].append(B_USERS)
    return {"keyboard": rows, "resize_keyboard": True, "is_persistent": True}


# ------------------------------------------------------------------ Playwright (ixtiyoriy zaxira)
def pw_available():
    try:
        import emaktab_pw                                      # noqa: F401
        import playwright.sync_api                             # noqa: F401
        return True
    except ImportError:
        return False


class pw_ctx:
    """Shu foydalanuvchining brauzeri bilan ishlash: `with pw_ctx(chat) as (pw, page): …`.
    emaktab_pw modul o'zgaruvchilari (sessiya fayli, captcha, eksport papkasi) umumiy bo'lgani uchun brauzer
    amallari navbat bilan bajariladi va har safar shu foydalanuvchiniki qo'yiladi."""

    def __init__(self, chat):
        self.chat = chat

    def __enter__(self):
        PW_LOCK.acquire()
        try:
            import emaktab_pw as pw
            ui = UI(self.chat)
            pw.STATE_FILE = home(self.chat) / "state.json"
            pw.EXPORT_DIR = out_dir(self.chat)
            pw.ask_captcha = lambda path: ui.ask_captcha(Path(path).read_bytes()) or ""
            return pw, pw_start(self.chat, pw)
        except BaseException:
            PW_LOCK.release()
            raise

    def __exit__(self, *exc):
        PW_LOCK.release()
        return False


def pw_start(chat, pw):
    """Shu foydalanuvchi uchun Playwright brauzerini bir marta ishga tushiradi; uning HTTP cookie'lari ham beriladi."""
    m = PWMS.get(chat)
    if m:
        return m["page"]
    from playwright.sync_api import sync_playwright
    p = sync_playwright().start()
    args = ["--no-sandbox"] if hasattr(os, "geteuid") and os.geteuid() == 0 else []
    browser = p.chromium.launch(headless=not SHOW_BROWSER[0], args=args)
    kw = {"locale": "uz-UZ", "accept_downloads": True}
    if pw.STATE_FILE.exists():
        kw["storage_state"] = str(pw.STATE_FILE)
    ctx = browser.new_context(**kw)
    page = ctx.new_page()
    page.set_default_timeout(20000)
    try:
        import http.cookiejar as cj
        cks = []
        ck = home(chat) / "cookies.txt"
        if ck.exists():
            jar = cj.MozillaCookieJar(str(ck))
            jar.load(ignore_discard=True, ignore_expires=True)
            cks += [{"name": c.name, "value": c.value, "domain": c.domain, "path": c.path or "/", "secure": bool(c.secure)} for c in jar]
        for part in COOKIE.get(chat, "").split(";"):
            if "=" in part:
                k, v = part.split("=", 1)
                for u in (pw.TEACHERS_URL, pw.MYCLASSES_URL, pw.LOGIN_URL):
                    cks.append({"name": k.strip(), "value": v.strip(), "url": u})
        if cks:
            ctx.add_cookies(cks)
    except Exception:                                          # noqa: BLE001
        pass
    PWMS[chat] = {"p": p, "browser": browser, "ctx": ctx, "page": page, "mod": pw}
    return page


def pw_stop(chat):
    """Brauzerni yopadi (uni ochgan oqimda chaqiriladi)."""
    m = PWMS.pop(chat, None)
    if not m:
        return
    for k in ("ctx", "browser"):
        try:
            m[k].close()
        except Exception:                                      # noqa: BLE001
            pass
    try:
        m["p"].stop()
    except Exception:                                          # noqa: BLE001
        pass


def pw_save(chat):
    """Brauzer sessiyasini foydalanuvchi papkasiga (state.json) va HTTP usuli uchun cookies.txt ga yozadi."""
    import http.cookiejar as cj
    m = PWMS.get(chat)
    if not m:
        return
    st, ck = home(chat) / "state.json", home(chat) / "cookies.txt"
    m["ctx"].storage_state(path=str(st))
    jar = cj.MozillaCookieJar(str(ck))
    for c in m["ctx"].cookies():
        dom = c.get("domain") or ""
        jar.set_cookie(cj.Cookie(0, c["name"], c["value"], None, False, dom, True, dom.startswith("."), c.get("path") or "/",
                                 True, bool(c.get("secure")), None, True, None, None, {}))
    jar.save(ignore_discard=True, ignore_expires=True)
    for f in (ck, st):
        try:
            f.chmod(0o600)
        except OSError:
            pass


# ------------------------------------------------------------------ amallar
def logged_in(chat):
    eng = ENGINE
    try:
        if eng != "pw":
            with http_s(chat) as s:
                if s.is_logged_in():
                    return True
            if eng == "http":
                return False
        if chat in PWMS or (eng != "http" and pw_available()):
            with pw_ctx(chat) as (pw, page):
                return bool(pw.is_logged_in(page))
    except Exception:                                          # noqa: BLE001
        pass
    return False


def do_login(chat, user, password):
    eng = ENGINE
    say(chat, "⏳ emaktabga kirilmoqda…")
    why = None
    # captcha rasmini brauzer ekrandan aniq oladi — Playwright bo'lsa, kirish shu usulda; keyingi ishlar HTTP bilan
    if eng in ("auto", "http") and not (eng == "auto" and pw_available()):
        try:
            with http_s(chat) as s:
                s.login(user, password)
            return logged_ok(chat)
        except EH.EmkFallback as e:
            why = str(e)
        except Exception as e:                                 # noqa: BLE001
            return say(chat, f"❌ {str(e)[:250]}", kb([[("🔑 Qayta urinish", "m:login")]]))
        if eng == "http" or not pw_available():
            print(f"[{chat}] HTTP kirish o'tmadi: {why} (zaxira: pip install playwright && playwright install chromium, emaktab_pw.py)")
            return say(chat, f"❌ Kirib bo'lmadi ({why}). Birozdan so'ng qayta urinib ko'ring; takrorlansa adminga ayting.",
                       kb([[("🔑 Qayta urinish", "m:login")]]))
    try:
        with pw_ctx(chat) as (pw, page):
            pw.login(page, user, password)
            pw_save(chat)
        logged_ok(chat)
    except Exception as e:                                     # noqa: BLE001
        say(chat, f"❌ Kirib bo'lmadi: {str(e)[:250]}", kb([[("🔑 Qayta urinish", "m:login")]]))


def logged_ok(chat):
    """Kirgandan keyin: menyu yangilanadi va keyingi qadam taklif qilinadi."""
    say(chat, "✅ emaktabga kirildi.", menu_for(chat))
    if not conf(chat)["sel"]:
        do_catalog(chat)


# ------------------------------------------------------------------ sinflar (tanlash tugmalar bilan)
def do_catalog(chat, mid=None):
    eng = ENGINE
    classes = None
    typing(chat)
    if eng != "pw":
        try:
            with http_s(chat) as s:
                classes = s.catalog()
        except EH.EmkFallback as e:
            if eng == "http" or not pw_available():
                return say(chat, f"❌ Sinflar topilmadi (HTTP): {e}.\nJurnal havolalarini yuboring — ular qo'shiladi.")
            say(chat, "HTTP usuli sinflarni topa olmadi; brauzer usuli…")
        except Exception as e:                                 # noqa: BLE001
            return say(chat, f"❌ {str(e)[:250]}", login_kb(str(e)))
    if classes is None:
        try:
            with pw_ctx(chat) as (pw, page):
                classes = pw.fetch_catalog(page)
                pw_save(chat)
        except Exception as e:                                 # noqa: BLE001
            return say(chat, f"❌ {str(e)[:250]}", login_kb(str(e)))
    CATALOG[chat] = classes
    have = {x["url"] for x in conf(chat)["sel"]}
    PICK[chat] = {i for i, c in enumerate(classes) if c["journals"] and all(j["url"] in have for j in c["journals"])}
    picker(chat, mid)


def login_kb(err=""):
    return kb([[("🔑 emaktabga kirish", "m:login")]]) if re.search(r"[Ss]essiya|login|kirish", err) else None


def picker(chat, mid=None, note=""):
    classes = CATALOG.get(chat) or []
    if not classes:
        return show(chat, "«Mening sinflarim» bo'sh.", None, mid)
    pick = PICK.setdefault(chat, set())
    rows, row = [], []
    for i, c in enumerate(classes):
        subj = ", ".join(j["subject"] for j in c["journals"]) or "jurnal yo'q"
        row.append((("✅ " if i in pick else "⬜ ") + f"{c['name']} — {subj}"[:40], f"sel:t:{i}"))
        if len(row) == 2 or len(c["name"] + subj) > 18:
            rows.append(row)
            row = []
    rows.append(row)
    rows.append([("☑ Hammasi", "sel:all"), ("✖ Hech biri", "sel:none")])
    rows.append([(f"💾 Saqlash ({sum(len(classes[i]['journals']) for i in pick)} jurnal)", "sel:ok")])
    return show(chat, note + "📚 Mening sinflarim\nKerakli sinflarni belgilang va «Saqlash» ni bosing:", kb(rows), mid)


def on_pick(chat, mid, arg):
    classes = CATALOG.get(chat) or []
    pick = PICK.setdefault(chat, set())
    if arg.startswith("t:"):
        i = int(arg[2:])
        pick.symmetric_difference_update({i})
    elif arg == "all":
        pick.update(range(len(classes)))
    elif arg == "none":
        pick.clear()
    elif arg == "ok":
        items = [{"class": classes[i]["name"], "subject": j["subject"], "url": j["url"]}
                 for i in sorted(pick) if i < len(classes) for j in classes[i]["journals"]]
        if not items:
            return picker(chat, mid, "⚠ Hech narsa tanlanmadi.\n")
        conf(chat)["sel"] = items
        save_state()
        REP.pop(chat, None)
        show(chat, f"✅ {len(items)} ta jurnal saqlandi:\n" + "\n".join(f"• {x['class']} — {x['subject']}" for x in items),
             kb([[("📊 Hisobot olish", "m:report")]]), mid)
        return say(chat, "Pastdagi menyu yangilandi.", menu_for(chat))
    picker(chat, mid)


def show_selected(chat, mid=None):
    """«📚 Sinflarim»: tanlanganlar; hali tanlanmagan bo'lsa — darhol emaktabdan ro'yxat."""
    sel = conf(chat)["sel"]
    if not sel:
        return do_catalog(chat, mid)
    return show(chat, "📚 Sinflarim:\n" + "\n".join(f"{i}. {x['class']} — {x['subject']}" for i, x in enumerate(sel, 1)),
                kb([[("📊 Hisobot olish", "m:report")], [("✏️ Sinflarni o'zgartirish", "m:catalog")]]), mid)


# ------------------------------------------------------------------ eksport (emaktab Excel)
def export_one(chat, it, quarter):
    """(yo'l, usul). HTTP o'tmasa (auto) brauzer usuliga tushadi."""
    eng = ENGINE
    if eng != "pw":
        try:
            with http_s(chat) as s:
                return s.download(it["class"], {"subject": it["subject"], "url": it["url"]}, quarter, out_dir(chat)), "HTTP"
        except EH.EmkFallback as e:
            if eng == "http" or not pw_available():
                raise RuntimeError(f"HTTP o'tmadi: {e}")
    with pw_ctx(chat) as (pw, page):
        return pw.export_journal(page, it["class"], {"subject": it["subject"], "url": it["url"]}, quarter), "brauzer"


def fetch(chat, it, quarter, fresh=False):
    """Excel faylni yuklaydi; yaqinda yuklangan bo'lsa (CACHE_TTL) — o'shani qaytaradi."""
    key = (chat, it["url"], quarter or "")
    hit = FILES.get(key)
    if hit and not fresh and time.time() - hit[0] < CACHE_TTL and Path(hit[1]).exists():
        return hit[1], "kesh"
    path, how = export_one(chat, it, quarter)
    FILES[key] = (time.time(), str(path))
    return str(path), how


def need_ready(chat, mid=None):
    """Tanlangan jurnallar va sessiya bormi. Bo'lmasa sababini tugma bilan aytadi."""
    if not conf(chat)["sel"]:
        show(chat, "Jurnal tanlanmagan. Avval sinflarni belgilang (yoki jurnal havolasini yuboring).",
             kb([[("📚 Sinflarni olish", "m:catalog")]]), mid)
        return False
    if not logged_in(chat):
        show(chat, "emaktab sessiyasi tugagan — qayta kiring.", kb([[("🔑 emaktabga kirish", "m:login")]]), mid)
        return False
    return True


def export_menu(chat, mid=None):
    if not conf(chat)["sel"]:
        return need_ready(chat, mid)
    n = len(conf(chat)["sel"])
    return show(chat, f"📥 {n} ta jurnalning emaktab Excel fayli.\nQaysi chorak?",
                kb([[("Joriy chorak", "ex:0")], [(f"{q}-chorak", f"ex:{q}") for q in range(1, 5)]]), mid)


def do_export(chat, quarter, mid=None):
    if not need_ready(chat, mid):
        return
    sel = conf(chat)["sel"]
    show(chat, f"⏳ {len(sel)} ta jurnal" + (f" ({quarter}-chorak)" if quarter else " (joriy chorak)") + " yuklanmoqda…", None, mid)
    ok, bad = 0, []
    for it in sel:
        typing(chat, "upload_document")
        try:
            path, how = fetch(chat, it, quarter, fresh=True)
            send_file(chat, path, f"{it['class']} · {it['subject']} ({how})")
            ok += 1
        except Exception as e:                                 # noqa: BLE001
            bad.append(f"{it['class']} / {it['subject']}: {str(e)[:140]}")
        time.sleep(1)
    if chat in PWMS:
        try:
            with pw_ctx(chat):
                pw_save(chat)
        except Exception:                                      # noqa: BLE001
            pass
    say(chat, f"Tayyor: {ok} ta fayl yuborildi" + (f", xato: {len(bad)}\n" + "\n".join(bad) if bad else "."))


# ------------------------------------------------------------------ hisobot (yo'qlama jurnalidagi kabi)
def H():
    import emaktab_hisobot as EHB
    return EHB


def rep_close(chat):
    r = REP.pop(chat, None)
    if r and r.get("book"):
        r["book"].close()


def report_menu(chat, mid=None):
    """1-qadam: jurnal tanlash (bitta bo'lsa — o'tkazib yuboriladi)."""
    try:
        ok, why = H().available()
    except ImportError:
        ok, why = False, "emaktab_hisobot.py shu papkada emas"
    if not ok:
        return show(chat, f"❌ Hisobot ishlamaydi: {why}", None, mid)
    sel = conf(chat)["sel"]
    if not sel:
        return need_ready(chat, mid)
    rep_close(chat)
    REP[chat] = {}
    if len(sel) == 1:
        REP[chat]["j"] = [0]
        return period_menu(chat, mid)
    rows = [[(f"{x['class']} — {x['subject']}"[:40], f"rj:{i}")] for i, x in enumerate(sel)]
    rows.append([("📚 Hammasi", "rj:all")])
    return show(chat, "📊 Hisobot\nQaysi jurnal?", kb(rows), mid)


def period_menu(chat, mid=None):
    """2-qadam: davr."""
    sel = conf(chat)["sel"]
    js = REP.get(chat, {}).get("j") or []
    what = f"{sel[js[0]]['class']} — {sel[js[0]]['subject']}" if len(js) == 1 else f"{len(js)} ta jurnal"
    p = dict(PERIODS)
    rows = [[(p["cur"], "rp:cur")], [(p["month"], "rp:month"), (p["week"], "rp:week")], [(p[f"q{q}"], f"rp:q{q}") for q in range(1, 5)]]
    if len(sel) > 1:
        rows.append([("◀ Jurnal", "m:report")])
    return show(chat, f"📊 Hisobot: {what}\nQaysi davr?", kb(rows), mid)


def build(chat, key, mid=None, fresh=False):
    """3-qadam: Excel yuklab, vaqtinchalik omborga import qiladi va qisqacha jadvalni yuboradi."""
    if not need_ready(chat, mid):
        return
    sel = conf(chat)["sel"]
    js = [i for i in REP.get(chat, {}).get("j") or [] if i < len(sel)]
    if not js:
        return report_menu(chat, mid)
    quarter = key[1:] if key.startswith("q") else None
    show(chat, f"⏳ {dict(PERIODS)[key]}: {len(js)} ta jurnal yuklanmoqda…", None, mid)
    files, bad = [], []
    for i in js:
        typing(chat)
        try:
            files.append(fetch(chat, sel[i], quarter, fresh)[0])
        except Exception as e:                                 # noqa: BLE001
            bad.append(f"{sel[i]['class']} / {sel[i]['subject']}: {str(e)[:140]}")
    if bad:
        say(chat, "Yuklab bo'lmadi:\n" + "\n".join(bad))
    if not files:
        return
    typing(chat)
    old = REP.get(chat, {}).get("book")
    if old:
        old.close()
    with REPORT_LOCK:
        # journal.json sozlamalari (xavf mezonlari, PDF dizayni) — faqat adminlar uchun; boshqalarga standart
        book = H().Book(files, JURNAL_FILE if chat in ADMINS else None)
        book.orig = {book.label(c): list(c["students"]) for c in book.classes}   # emaktabdagi to'liq ro'yxat
        apply_hidden(chat, book)
        items = [(cls,) + tuple(book.period(cls, key)) for cls in book.classes]
        parts = [part for it in items for part in summary_parts(chat, book, *it)]
    if book.problems:
        say(chat, "Ogohlantirish:\n" + "\n".join(book.problems))
    REP[chat] = {"j": js, "p": key, "book": book, "items": items}
    if not items:
        return say(chat, "Fayllarda sinf topilmadi.")
    for part in parts:
        say(chat, part, html=True)
    format_menu(chat)


def apply_hidden(chat, book, label=None):
    """Foydalanuvchi o'chirgan o'quvchilar hisobotga kirmaydi (emaktabdagi jurnalga ta'sir qilmaydi)."""
    hid = conf(chat).setdefault("hidden", {})
    for c in book.classes:
        lb = book.label(c)
        if label is None or lb == label:
            h = set(hid.get(lb, []))
            c["students"] = [s for s in book.orig[lb] if s["name"] not in h]


def summary_parts(chat, book, cls, lo, hi, q):
    parts = book.summary(cls, lo, hi, q)
    n = len(conf(chat).get("hidden", {}).get(book.label(cls), []))
    if n:
        parts[-1] += f"\n🗑 Hisobotdan o'chirilgan: {n} ta o'quvchi (qaytarish: «🗑 O'quvchilarni o'chirish»)."
    return parts


def del_menu(chat, arg, mid=None):
    """O'quvchilarni o'chirish rejimi: belgilanganlar keyingi hisobotlarda ham chiqmaydi."""
    r = REP.get(chat) or {}
    book = r.get("book")
    if not book or not r.get("items"):
        return show(chat, "Hisobot eskirgan — qaytadan tanlang.", kb([[(B_REPORT, "m:report")]]), mid)
    labels = [book.label(c) for c, *_ in r["items"]]
    hid = conf(chat).setdefault("hidden", {})
    act, _, val = arg.partition(":")
    if act == "menu":
        if len(labels) > 1:
            return show(chat, "🗑 Qaysi sinfdan o'quvchi o'chiriladi?",
                        kb([[(lb[:40], f"rd:j:{i}")] for i, lb in enumerate(labels)] + [[("◀ Orqaga", "rf:back")]]), mid)
        act, val = "j", "0"
    if act == "j":
        r["dl"] = labels[int(val)]
        r["dset"] = set(hid.get(r["dl"], []))
    lb = r.get("dl")
    if lb not in book.orig:
        return format_menu(chat, mid)
    names = [s["name"] for s in book.orig[lb]]
    dset = r.setdefault("dset", set())
    if act == "t":
        dset.symmetric_difference_update({names[int(val)]})
    elif act == "none":
        dset.clear()
    elif act == "ok":
        if dset:
            hid[lb] = sorted(dset)
        else:
            hid.pop(lb, None)
        save_state()
        with REPORT_LOCK:
            apply_hidden(chat, book, lb)
            parts = [p for c, lo, hi, q in r["items"] if book.label(c) == lb for p in summary_parts(chat, book, c, lo, hi, q)]
        show(chat, f"✅ Saqlandi: {lb} — {len(dset)} ta o'quvchi hisobotlarda ko'rsatilmaydi.", None, mid)
        for p in parts:
            say(chat, p, html=True)
        return format_menu(chat)
    rows, row = [], []
    for i, n in enumerate(names):
        row.append((("❌ " if n in dset else "✅ ") + n[:28], f"rd:t:{i}"))
        if len(row) == 2:
            rows.append(row)
            row = []
    rows.append(row)
    rows = rows[:95]
    rows += [[(f"💾 Saqlash (o'chiriladi: {len(dset)})", "rd:ok")], [("♻ Hammasini qaytarish", "rd:none"), ("◀ Bekor", "rf:back")]]
    return show(chat, f"🗑 O'quvchilarni o'chirish — {lb}\nO'chiriladiganlarni bosing (❌). Ular hisobot, PDF va Excelda ko'rinmaydi; "
                      "emaktabdagi jurnalga ta'sir qilmaydi. Tanlov saqlanadi va keyingi hisobotlarda ham amal qiladi.", kb(rows), mid)


def format_menu(chat, mid=None):
    r = REP.get(chat) or {}
    if not r.get("items"):
        return report_menu(chat, mid)
    rows = [[("📄 PDF hisobot", "rf:pdf"), ("📊 Excel", "rf:xlsx")],
            [("⚠ Xavf ostidagilar", "rf:risk"), ("👤 O'quvchi varaqlari", "rf:sheets")],
            [("🗑 O'quvchilarni o'chirish", "rd:menu")],
            [("🗓 Boshqa davr", "rf:period"), ("🔄 Yangilash", "rf:fresh")]]
    return show(chat, "Hisobotdan nima kerak?", kb(rows), mid)


def students_menu(chat, mid=None):
    r = REP.get(chat) or {}
    items = r.get("items") or []
    if len(items) != 1:                                         # bir nechta jurnal — hammasi uchun
        return show(chat, "👤 O'quvchi varaqlari (har o'quvchi — alohida sahifa):",
                    kb([[("Hamma o'quvchilar", "rs:all"), ("Faqat xavf ostidagilar", "rs:risk")], [("◀ Orqaga", "rf:back")]]), mid)
    cls = items[0][0]
    rows = [[("Hamma o'quvchilar", "rs:all"), ("Faqat xavf ostidagilar", "rs:risk")]]
    row = []
    for i, st in enumerate(cls["students"]):
        row.append((st["name"][:30], f"rs:{i}"))
        if len(row) == 2:
            rows.append(row)
            row = []
    rows.append(row)
    rows.append([("◀ Orqaga", "rf:back")])
    return show(chat, f"👤 O'quvchi varaqlari — {r['book'].label(cls)}\nKimniki kerak?", kb(rows[:99]), mid)


def do_format(chat, what, mid=None):
    r = REP.get(chat) or {}
    if what == "period":
        return period_menu(chat, mid)
    if what == "fresh":
        return build(chat, r.get("p", "cur"), mid, fresh=True)
    if what == "back":
        return format_menu(chat, mid)
    if not r.get("items"):
        return show(chat, "Hisobot eskirgan — qaytadan tanlang.", kb([[(B_REPORT, "m:report")]]), mid)
    if what == "sheets":
        return students_menu(chat, mid)
    book = r["book"]
    show(chat, "⏳ Tayyorlanmoqda…", None, mid)
    for cls, lo, hi, q in r["items"]:
        label = book.label(cls)
        try:
            if what == "risk":
                with REPORT_LOCK:
                    txt = book.risk_text(cls, lo, hi, q)
                say(chat, txt, html=True)
                continue
            typing(chat, "upload_document")
            with REPORT_LOCK:
                path = book.pdf(cls, lo, hi, q) if what == "pdf" else book.xlsx(cls, lo, hi, q)
            send_file(chat, path, f"{label} · {H().jm().period_title(lo, hi, q)}")
        except Exception as e:                                 # noqa: BLE001
            say(chat, f"❌ {label}: {type(e).__name__}: {str(e)[:200]}")
    format_menu(chat)


def do_sheets(chat, arg, mid=None):
    r = REP.get(chat) or {}
    if not r.get("items"):
        return show(chat, "Hisobot eskirgan — qaytadan tanlang.", kb([[(B_REPORT, "m:report")]]), mid)
    book = r["book"]
    show(chat, "⏳ O'quvchi varaqlari tayyorlanmoqda…", None, mid)
    for cls, lo, hi, q in r["items"]:
        if arg == "all":
            names = [s["name"] for s in cls["students"]]
        elif arg == "risk":
            with REPORT_LOCK:
                names = [x["name"] for x in book.rows(cls, lo, hi, q)[0] if x["risk"]]
        else:
            i = int(arg)
            names = [cls["students"][i]["name"]] if i < len(cls["students"]) else []
        if not names:
            say(chat, f"{book.label(cls)}: varaq uchun o'quvchi yo'q" + (" (xavf ostida hech kim yo'q ✅)." if arg == "risk" else "."))
            continue
        typing(chat, "upload_document")
        try:
            with REPORT_LOCK:
                path = book.sheets(cls, lo, hi, q, names)
            send_file(chat, path, f"{book.label(cls)} · {len(names)} ta o'quvchi varag'i")
        except Exception as e:                                 # noqa: BLE001
            say(chat, f"❌ {book.label(cls)}: {type(e).__name__}: {str(e)[:200]}")
    format_menu(chat)


# ------------------------------------------------------------------ sozlamalar, holat
def settings_menu(chat, mid=None):
    rows = [[("ℹ️ Holat", "m:status")], [("✏️ Sinflarni o'zgartirish", "m:catalog")],
            [("🔑 Qayta kirish", "m:login"), ("🚪 emaktabdan chiqish", "st:logout")]]
    return show(chat, "⚙️ Sozlamalar", kb(rows), mid)


def status(chat):
    typing(chat)
    cf = conf(chat)
    ok = logged_in(chat)
    try:
        hok, why = H().available()
    except ImportError:
        hok, why = False, "emaktab_hisobot.py yo'q"
    jset = (JURNAL_FILE.name if JURNAL_FILE.exists() else "standart (journal.json topilmadi)") if chat in ADMINS else "standart"
    nh = sum(len(v) for v in cf.get("hidden", {}).values())
    say(chat, ("✅ emaktabga kirilgan" if ok else "❌ emaktabga kirilmagan") +
        f"\nTanlangan jurnallar: {len(cf['sel'])}" + (f"\nHisobotdan o'chirilgan o'quvchilar: {nh}" if nh else "") +
        f"\nHisobot: {'ishlaydi' if hok else 'ishlamaydi — ' + why}" +
        (f"\nHisobot sozlamalari: {jset}\nUlanish: {'brauzer + HTTP' if pw_available() else 'HTTP'}" if chat in ADMINS else ""),
        None if ok else kb([[("🔑 emaktabga kirish", "m:login")]]))


def logout(chat):
    """Faqat shu foydalanuvchining emaktab sessiyasini o'chiradi (boshqalarnikiga tegmaydi)."""
    COOKIE.pop(chat, None)
    STEP.pop(chat, None)
    TMP.pop(chat, None)
    rep_close(chat)
    for k in [k for k in list(FILES) if k[0] == chat]:
        FILES.pop(k, None)
    if chat in PWMS:
        try:
            PWMS[chat]["ctx"].clear_cookies()
        except Exception:                                      # noqa: BLE001
            pass
    for f in ("cookies.txt", "state.json"):
        try:
            (home(chat) / f).unlink()
        except OSError:
            pass


def ask_login(chat):
    STEP[chat] = "login"
    say(chat, "emaktab loginini yuboring:", kb([[("❌ Bekor qilish", "x")]]))


# ------------------------------------------------------------------ admin: foydalanuvchilarni tasdiqlash
def register(m):
    """Yangi foydalanuvchini «kutilmoqda» ro'yxatiga yozadi va adminlarga xabar beradi."""
    fr = m.get("from") or {}
    uid = fr.get("id", m["chat"]["id"])
    rec = {"st": "pending", "name": " ".join(x for x in (fr.get("first_name"), fr.get("last_name")) if x),
           "un": fr.get("username") or "", "chat": m["chat"]["id"], "t": time.strftime("%Y-%m-%d %H:%M")}
    with STATE_LOCK:
        users()[str(uid)] = rec
    save_state()
    for a in ADMINS:
        say(a, f"🆕 Yangi foydalanuvchi botga ulandi:\n{who(rec, uid)}\nTasdiqlansa, botdan to'liq foydalana oladi.",
            kb([[("✅ Tasdiqlash", f"adm:ok:{uid}"), ("⛔ Rad etish", f"adm:no:{uid}")]]))
    if not ADMINS:
        print(f"Yangi foydalanuvchi {uid}, lekin ADMIN_IDS bo'sh — tasdiqlaydigan admin yo'q.")


def users_menu(chat, mid=None):
    rows, lines = [], []
    marks = {"pending": "⏳", "ok": "✅", "blocked": "⛔"}
    with STATE_LOCK:
        items = sorted(users().items(), key=lambda kv: ({"pending": 0, "ok": 1, "blocked": 2}.get(kv[1].get("st"), 3), kv[1].get("t", "")))
    for uid, rec in items:
        st = rec.get("st")
        lines.append(f"{marks.get(st, '•')} {who(rec, uid)}")
        name = (rec.get("name") or rec.get("un") or uid)[:22]
        if st == "pending":
            rows.append([(f"✅ {name}", f"adm:ok:{uid}"), ("⛔ Rad etish", f"adm:no:{uid}")])
        elif st == "ok":
            rows.append([(f"🚫 {name} — ruxsatni olish", f"adm:no:{uid}")])
        else:
            rows.append([(f"✅ {name} — tasdiqlash", f"adm:ok:{uid}"), ("🗑 O'chirish", f"adm:rm:{uid}")])
    fixed = [x for x in ALLOWED if x not in ADMINS]
    head = (f"👥 Foydalanuvchilar\nAdmin: {', '.join(map(str, sorted(ADMINS))) or '—'}" +
            (f"\nbot.env da ruxsat berilgan: {', '.join(map(str, sorted(fixed)))}" if fixed else ""))
    body = "\n".join(lines) if lines else "Botga hali hech kim ulanmagan."
    return show(chat, head + "\n\n" + body + "\n\n⏳ kutilmoqda · ✅ tasdiqlangan · ⛔ rad etilgan", kb(rows[:90]), mid)


def set_role(admin_chat, uid, action, mid=None):
    with STATE_LOCK:
        rec = users().get(str(uid))
    if rec is None:
        return users_menu(admin_chat, mid)
    uchat = rec.get("chat", int(uid))
    if action == "rm":
        with STATE_LOCK:
            users().pop(str(uid), None)
            SAVED.pop(str(uchat), None)
    else:
        rec["st"] = "ok" if action == "ok" else "blocked"
    save_state()
    if action == "ok":
        say(uchat, "✅ Admin sizni tasdiqladi. Endi botdan to'liq foydalanishingiz mumkin.\n"
                   "Boshlash: «🔑 emaktabga kirish» (o'zingizning emaktab loginingiz).", menu_for(int(uid)))
    else:                                                       # ruxsat olinsa — sessiyasi va fayllari ham o'chiriladi
        enqueue(uchat, {"_wipe": True})
        if action == "no":
            say(uchat, "⛔ Admin botdan to'liq foydalanishga ruxsat bermadi.", LIMITED_MENU)
    users_menu(admin_chat, mid)


def wipe(chat):
    """Foydalanuvchi ruxsati olinganda: brauzeri yopiladi, emaktab sessiyasi va fayllari o'chiriladi (o'z oqimida)."""
    pw_stop(chat)
    logout(chat)
    for d in (CATALOG, PICK):
        d.pop(chat, None)
    shutil.rmtree(USERS_DIR / str(chat), ignore_errors=True)


# ------------------------------------------------------------------ xabar va tugmalar
HELP = ("emaktab boti — sinf hisobotlari (faqat o'qish).\n\n"
        "1. «🔑 emaktabga kirish» — o'zingizning emaktab login va parolingiz.\n"
        "2. «📚 Sinflarim» — kerakli sinflarni belgilang.\n"
        "3. «📊 Hisobot» — davrni tanlang: o'rtacha ball, davomat, chorak balli, xavf ostidagilar; "
        "so'ng PDF, Excel, o'quvchi varaqlari. Kerak bo'lmagan o'quvchilarni «🗑 O'quvchilarni o'chirish» bilan olib tashlaysiz.\n\n"
        "«📥 Excel fayl» — emaktabning o'z Excel fayli. «⚙️ Sozlamalar» — holat, qayta kirish, chiqish.")
LIMITED_HELP = ("emaktab boti: emaktab jurnallaridan sinf hisobotlari (o'rtacha ball, davomat, chorak balli, "
                "xavf ostidagi o'quvchilar), PDF va Excel fayllar.\n\nBotdan to'liq foydalanish uchun admin tasdig'i kerak.")

BUTTONS = {B_REPORT: "report", B_EXPORT: "export", B_CLASSES: "sel", B_LOGIN: "login", B_STATUS: "status",
           B_SETTINGS: "settings", B_USERS: "users", B_HELP: "help",
           # eski menyu tugmalari (yangilanmagan klaviaturada qolgan bo'lsa)
           "📥 Eksport": "export", "📚 Sinflar": "sel", "📋 Tanlangan": "sel", "🔑 Kirish": "login"}
OLD_CMDS = {"/hisobot": "report", "/eksport": "export", "/sinflar": "catalog", "/tanlangan": "sel", "/kirish": "login",
            "/holat": "status", "/usul": "settings", "/sozlamalar": "settings"}


def menu_action(chat, act, mid=None):
    if act == "report":
        return report_menu(chat, mid)
    if act == "export":
        return export_menu(chat, mid)
    if act == "catalog":
        return do_catalog(chat, mid)
    if act == "sel":
        return show_selected(chat, mid)
    if act == "login":
        return ask_login(chat)
    if act == "status":
        return status(chat)
    if act == "settings":
        return settings_menu(chat, mid)
    if act == "help":
        return say(chat, HELP, menu_for(chat))
    if act == "users" and chat in ADMINS:
        return users_menu(chat, mid)


def limited(m, uid, r):
    """Tasdiqlanmagan foydalanuvchi: faqat ma'lumot va holat."""
    chat = m["chat"]["id"]
    text = (m.get("text") or "").strip()
    if r == "new":
        register(m)
        return say(chat, "👋 Assalomu alaykum! So'rovingiz adminga yuborildi.\nAdmin tasdiqlagach, botdan to'liq foydalana olasiz "
                         "— o'zingizning emaktab hisobingiz bilan.\n\n" + LIMITED_HELP, LIMITED_MENU)
    if text == B_HELP or text.startswith("/help"):
        return say(chat, LIMITED_HELP, LIMITED_MENU)
    note = ("⏳ So'rovingiz admin tomonidan ko'rib chiqilmoqda. Tasdiqlansa, xabar keladi."
            if r == "pending" else "⛔ Admin botdan to'liq foydalanishga ruxsat bermagan.")
    return say(chat, note + f"\nSizning ID: {uid}", LIMITED_MENU)


def handle(m):
    chat = m["chat"]["id"]
    uid = (m.get("from") or {}).get("id", chat)
    text = (m.get("text") or "").strip()
    r = role(uid)
    if r not in ("admin", "ok"):
        return limited(m, uid, r)
    cmd = text.split()[0].split("@")[0].lower() if text.startswith("/") else ""
    cf = conf(chat)

    if cmd in ("/start", "/help", "/menu"):
        STEP.pop(chat, None)
        return say(chat, HELP, menu_for(uid))
    act = BUTTONS.get(text) or OLD_CMDS.get(cmd)
    if act:                                                     # menyu tugmasi — boshlangan qadam bekor bo'ladi
        if STEP.pop(chat, None) == "password":
            TMP.pop(chat, None)
        return menu_action(chat, act)

    st = STEP.get(chat)
    if st == "login":
        TMP[chat] = text
        STEP[chat] = "password"
        return say(chat, "Parolni yuboring (xabar darhol o'chiriladi):", kb([[("❌ Bekor qilish", "x")]]))
    if st == "password":
        delete_msg(chat, m.get("message_id"))
        STEP.pop(chat, None)
        return do_login(chat, TMP.pop(chat, ""), text)
    found = []
    for mm in JOURNAL_RE.finditer(text):
        url = f"{EH.EMK_URLS['teachers'].split('/teachers')[0]}/journal/school/{mm.group(1)}/group/{mm.group(2)}/subject/{mm.group(3)}"
        if url not in {x["url"] for x in cf["sel"]} and url not in {x["url"] for x in found}:
            found.append({"class": f"sinf{mm.group(2)[-4:]}", "subject": f"fan{mm.group(3)[-4:]}", "url": url})
    if found:
        cf["sel"].extend(found)
        save_state()
        return say(chat, f"{len(found)} ta jurnal havolasi qo'shildi (jami {len(cf['sel'])}).",
                   kb([[(B_REPORT, "m:report"), (B_EXPORT, "m:export")]]))
    say(chat, HELP, menu_for(uid))


def handle_cb(cq):
    msg = cq.get("message") or {}
    chat = (msg.get("chat") or {}).get("id")
    uid = (cq.get("from") or {}).get("id")
    data = cq.get("data") or ""
    kind, _, arg = data.partition(":")
    r = role(uid)
    if chat is None or r not in ("admin", "ok") or (kind == "adm" and r != "admin"):
        return tg("answerCallbackQuery", {"callback_query_id": cq["id"], "text": "Ruxsat yo'q"})
    tg("answerCallbackQuery", {"callback_query_id": cq["id"]})
    mid = msg.get("message_id")
    cf = conf(chat)
    if kind == "adm":
        act, _, target = arg.partition(":")
        return set_role(chat, target, act, mid) if act in ("ok", "no", "rm") else users_menu(chat, mid)
    if kind == "x":
        STEP.pop(chat, None)
        TMP.pop(chat, None)
        return show(chat, "Bekor qilindi.", None, mid)
    if kind == "m":
        return menu_action(chat, arg, mid)
    if kind == "sel":
        return on_pick(chat, mid, arg)
    if kind == "ex":
        return do_export(chat, arg if arg in ("1", "2", "3", "4") else None, mid)
    if kind == "rj":
        REP.setdefault(chat, {})["j"] = list(range(len(cf["sel"]))) if arg == "all" else [int(arg)]
        return period_menu(chat, mid)
    if kind == "rp":
        return build(chat, arg if arg in dict(PERIODS) else "cur", mid)
    if kind == "rf":
        return do_format(chat, arg, mid)
    if kind == "rs":
        return do_sheets(chat, arg, mid)
    if kind == "rd":
        return del_menu(chat, arg, mid)
    if kind == "st":
        if arg == "clear":
            cf["sel"] = []
            save_state()
            rep_close(chat)
            return show(chat, "Tanlov o'chirildi.", kb([[("📚 Sinflarni olish", "m:catalog")]]), mid)
        if arg == "logout":
            logout(chat)
            show(chat, "emaktab sessiyasi o'chirildi.", None, mid)
            return say(chat, "Qayta kirish uchun «🔑 emaktabga kirish».", menu_for(chat))


# ------------------------------------------------------------------ parallel ishlash: har chatga o'z oqimi
def chat_of(u):
    return ((u.get("message") or (u.get("callback_query") or {}).get("message") or {}).get("chat") or {}).get("id")


def process(chat, u):
    try:
        if "_wipe" in u:
            return wipe(chat)
        if "callback_query" in u:
            handle_cb(u["callback_query"])
        else:
            handle(u["message"])
    except Exception as e:                                     # noqa: BLE001
        print("xato:", chat, type(e).__name__, e)
        try:
            say(chat, f"Xato: {type(e).__name__}: {str(e)[:200]}")
        except Exception:                                      # noqa: BLE001
            pass


def worker(chat, q):
    """Bitta foydalanuvchining navbati: uning so'rovlari ketma-ket, boshqalarniki esa parallel bajariladi."""
    try:
        while True:
            u = q.get()
            if u is None:
                break
            process(chat, u)
    finally:
        pw_stop(chat)                                           # brauzer uni ochgan oqimda yopiladi


def enqueue(chat, u):
    q = QUEUES.setdefault(chat, queue.Queue())
    q.put(u)
    t = WORKERS.get(chat)
    if t is None or not t.is_alive():
        t = threading.Thread(target=worker, args=(chat, q), name=f"chat-{chat}", daemon=True)
        WORKERS[chat] = t
        t.start()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--show", action="store_true", help="brauzerni ko'rsatish (faqat brauzer usuli uchun)")
    a = ap.parse_args()
    SHOW_BROWSER[0] = a.show
    if not TOKEN:
        sys.exit("TELEGRAM_BOT_TOKEN berilmagan: bot.env faylini to'ldiring (bot.env.example ga qarang).")
    if not ADMINS:
        print("OGOHLANTIRISH: ADMIN_IDS (yoki ALLOWED_IDS) bo'sh — yangi foydalanuvchilarni tasdiqlaydigan admin yo'q.")
    load_state()
    tg("setMyCommands", {"commands": [{"command": "start", "description": "Menyu tugmalarini ko'rsatish"}]})
    try:
        hok, why = H().available()                              # Qt ilovasi asosiy oqimda yaratiladi
    except ImportError:
        hok, why = False, "emaktab_hisobot.py yo'q"
    print(f"Bot ishga tushdi. Admin: {sorted(ADMINS)}; usul: {ENGINE}; Playwright: {'bor' if pw_available() else 'yo`q'}; "
          f"hisobot: {'bor' if hok else 'yo`q (' + why + ')'}. To'xtatish: Ctrl+C")
    try:
        while True:
            try:
                ups = next_updates()
            except Exception as e:                             # noqa: BLE001
                print("tarmoq xatosi:", e)
                time.sleep(5)
                continue
            for u in ups:
                chat = chat_of(u)
                if chat is not None:
                    enqueue(chat, u)
            if os.environ.get("BOT_ONCE") and not ups:
                break
    finally:
        for q in QUEUES.values():
            q.put(None)
        for t in list(WORKERS.values()):
            t.join(timeout=10)
        for r in REP.values():
            r.get("book") and r["book"].close()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
