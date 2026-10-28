# -*- coding: utf-8 -*-
"""
emaktab_http.py — emaktab.uz ga brauzersiz (faqat standart kutubxona) kirish va jurnal Excelini olish.
Kirish (captcha bilan), «Mening sinflarim», chorak identifikatori va Excel yuklash. FAQAT O'QISH.
`ui` obyekti: log(str) va ask_captcha(png_bytes)->str|None metodlariga ega bo'lishi kerak.
"""
import http.cookiejar as _cj
import json
import os
import re
import urllib.error as _ue
import urllib.parse as _up
import urllib.request as _ur
from html.parser import HTMLParser as _HP
from pathlib import Path

EMK_HOME = Path.home() / ".emaktab"
EMK_COOKIES = EMK_HOME / "cookies.txt"
EMK_URLS = {"teachers": "https://emaktab.uz/teachers",
            "myclasses": "https://schools.emaktab.uz/v2/myclasses",
            "login": "https://login.emaktab.uz/",
            "excel": "https://schools.emaktab.uz/v2/excel"}


def _emk_safe(name):
    return re.sub(r"[^\w.-]+", "_", name, flags=re.U).strip("_")


class EmkFallback(Exception):
    """HTTP usuli bajara olmadi — brauzer (Playwright) usuliga o'tish mumkin."""


_EMK_UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36")
class _EmkForms(_HP):
    """HTML dan formalar (input maydonlari, rasmlari) va sinf/jurnal havolalarini yig'adi."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.forms, self._f, self.imgs, self.img_attrs, self.inputs = [], None, [], {}, []
        self.links, self._a, self._root_depth, self._depth, self.has_root = [], None, None, 0, False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        self._depth += 1
        if a.get("id") == "ContentPanelTeacher":
            self.has_root, self._root_depth = True, self._depth
        if tag == "form":
            self._f = {"action": a.get("action") or "", "inputs": [], "imgs": []}
            self.forms.append(self._f)
        elif tag == "img" and (a.get("src") or a.get("data-src")):
            src = a.get("src") or a.get("data-src")
            self.imgs.append(src)
            self.img_attrs[src] = a
            if self._f is not None:
                self._f["imgs"].append(src)
        elif tag in ("input", "button"):
            i = {"name": a.get("name"), "type": (a.get("type") or "text").lower(), "value": a.get("value") or ""}
            self.inputs.append(i)                                 # sahifadagi hamma maydonlar (captcha forma tashqarisida bo'lishi mumkin)
            if self._f is not None:
                self._f["inputs"].append(i)
        elif tag == "a" and a.get("href"):
            self._a = {"href": a["href"], "title": a.get("title") or "", "text": "", "root": self._root_depth is not None}
            self.links.append(self._a)

    def handle_endtag(self, tag):
        if tag == "form":
            self._f = None
        elif tag == "a":
            self._a = None
        if self._root_depth is not None and self._depth == self._root_depth:
            self._root_depth = None
        self._depth -= 1

    def handle_data(self, d):
        if self._a is not None:
            self._a["text"] += d


def is_image(b):
    b = bytes(b[:12])
    return b.startswith((b"\x89PNG", b"\xff\xd8", b"GIF8", b"BM")) or (b[:4] == b"RIFF" and b[8:12] == b"WEBP")


def catalog_from_state(html):
    """Yangi «Mening sinflarim» sahifasi: sinflar havolalar emas, skript ichidagi JSON da
    (window.__TEACHERV2__INITIAL__STATE__ = {groups: {"groups": [{name, redirectUrl, journal: [{subjectName, journalUrl}]}]}})."""
    i = html.find("__TEACHERV2__INITIAL__STATE__")
    m = re.compile(r"groups\s*:\s*\{").search(html, i) if i >= 0 else None
    if not m:
        return []
    try:
        data, _ = json.JSONDecoder().raw_decode(html, m.end() - 1)
    except ValueError:
        return []
    out = []
    for g in data.get("groups") or []:
        if not isinstance(g, dict) or not g.get("name"):
            continue
        cur = {"name": str(g["name"]).strip(), "url": str(g.get("redirectUrl") or ""), "journals": []}
        for j in g.get("journal") or []:
            u = str((j or {}).get("journalUrl") or "")
            mm = re.search(r"https?://[^/]+/journal/school/\d+/group/\d+/subject/\d+", u)
            if mm:
                subj = str(j.get("subjectName") or "").strip() + (f" ({j['subgroupName']})" if j.get("subgroupName") else "")
                cur["journals"].append({"subject": subj, "url": mm.group(0)})
        out.append(cur)
    return out


class EmkHttp:
    """Brauzersiz (faqat standart kutubxona) seans: login/captcha, sinflar, Excel. Interfeysi EmkSession bilan bir xil."""
    is_http = True

    def __init__(self, ui, cookie="", home=None):
        """home — sessiya papkasi (cookies.txt shu yerda). Bot har foydalanuvchiga alohida papka beradi."""
        self.ui, self.cookie = ui, (cookie or "").strip()
        self.home = Path(home) if home else EMK_HOME
        self.cookies = self.home / "cookies.txt"

    def __enter__(self):
        self.jar = _cj.MozillaCookieJar(str(self.cookies))
        try:
            if self.cookies.exists():
                self.jar.load(ignore_discard=True, ignore_expires=True)
        except Exception:  # noqa: BLE001
            pass
        self.op = _ur.build_opener(_ur.HTTPCookieProcessor(self.jar))
        return self

    def __exit__(self, *exc):
        return False

    def pause(self, ms):
        import time
        time.sleep(ms / 1000)

    def save_state(self):
        try:
            self.home.mkdir(parents=True, exist_ok=True)
            self.jar.save(ignore_discard=True, ignore_expires=True)
            self.cookies.chmod(0o600)
        except Exception:  # noqa: BLE001
            pass

    def raw(self, url, data=None, headers=None, timeout=60):
        h = {"User-Agent": _EMK_UA, "Accept-Language": "uz,ru;q=0.8,en;q=0.5"}
        if self.cookie:
            h["Cookie"] = self.cookie
        h.update(headers or {})
        body = None
        if data is not None:
            body = _up.urlencode(data).encode()
            h["Content-Type"] = "application/x-www-form-urlencoded"
        try:
            r = self.op.open(_ur.Request(url, data=body, headers=h), timeout=timeout)
            st = r.status
        except _ue.HTTPError as e:
            r, st = e, e.code
        except (_ue.URLError, OSError) as e:
            raise RuntimeError(f"Tarmoq xatosi: {getattr(e, 'reason', e)}")
        return st, getattr(r, "url", url), r.headers, r.read()

    def req(self, url, data=None, headers=None):
        st, final, hd, raw = self.raw(url, data, headers)
        return st, final, raw.decode(hd.get_content_charset() or "utf-8", errors="replace")

    @staticmethod
    def is_login(final, html):
        """Kirish sahifasimi? Parol maydoni bo'lsa — ha. «Chiqish» (logout) formasi bo'lsa — yo'q, tizimga kirilgan
        (manzil login.emaktab.uz bo'lib qolsa ham: u yerdan sinflar sahifasiga o'tkaziladi)."""
        if re.search(r"<input[^>]+type=[\"']?password", html, re.I):
            return True
        if re.search(r"<form[^>]+action=[\"'][^\"']*/logout", html, re.I):
            return False
        return _up.urlparse(final).netloc.lower().startswith("login.")

    def is_logged_in(self):
        st, final, html = self.req(EMK_URLS["myclasses"])
        return st < 400 and not self.is_login(final, html)

    def login(self, user, password):
        if self.is_logged_in():
            self.ui.log("Saqlangan sessiya bilan kirildi.")
            return
        # tartib: 1) login va parol bilan «Kirish»; 2) yana shu sahifa ochilsa — login, parol va captcha
        # (rasm foydalanuvchiga yuboriladi, javobi kiritiladi); 3) muvaffaqiyatli bo'lsa — keyingi ishlar
        st, final, html = self.req(EMK_URLS["login"])
        for attempt in range(1, 4):
            try:                                                  # nosozlikni topish uchun: login sahifasi har urinishda saqlanadi
                self.home.mkdir(parents=True, exist_ok=True)
                (self.home / "debug_login.html").write_text(html, encoding="utf-8")
            except Exception:  # noqa: BLE001
                pass
            if not self.is_login(final, html):                   # sahifa allaqachon tizim ichida (sinflar va h.k.)
                self.save_state()
                self.ui.log("Muvaffaqiyatli kirildi.")
                return
            fp = _EmkForms()
            fp.feed(html)
            form = next((f for f in fp.forms if any(i["type"] == "password" for i in f["inputs"])), None)
            if not form and any(i["type"] == "password" for i in fp.inputs):
                # maydonlar <form> tegisiz (yoki forma yopilib qolgan) — sahifadagi hamma maydonlar, yuborish shu manzilga
                form = {"action": next((f["action"] for f in fp.forms if f["action"]), ""), "inputs": fp.inputs, "imgs": fp.imgs}
            if not form:
                t = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
                title = re.sub(r"\s+", " ", t.group(1)).strip()[:60] if t else ""
                print(f"Login sahifasi: {st} {final} «{title}», {len(html)} belgi, {len(fp.forms)} forma, "
                      f"{len(fp.inputs)} maydon; to'liq matn: {self.home / 'debug_login.html'}")
                raise EmkFallback(f"Login formasi topilmadi (sahifa: {final[:60]}, javob {st}" + (f", «{title}»" if title else "") + ")")
            data = {i["name"]: i["value"] for i in form["inputs"]
                    if i["name"] and i["type"] not in ("submit", "button", "checkbox", "radio", "file", "image")}
            pw = next((i["name"] for i in form["inputs"] if i["type"] == "password" and i["name"]), None)
            texts = [i["name"] for i in form["inputs"] if i["name"] and i["type"] in ("text", "email", "tel", "number")]
            us = next((n for n in texts if re.search(r"^(log|user|mail|phone|tel)", n, re.I)), None) or (texts[0] if texts else None)
            if not pw or not us:
                raise EmkFallback("Login maydonlari topilmadi")
            data[us], data[pw] = user, password
            for i in form["inputs"]:
                if i["type"] == "checkbox" and i["name"] and re.search(r"remember|eslab|save", i["name"], re.I):
                    data[i["name"]] = i["value"] or "true"
            # captcha rasmi: <img class="captcha__image" alt="captcha image" src=".../captcha/true/<guid>"> — src har safar
            # yangi, shuning uchun har urinishda shu sahifaning o'zidan olinadi (forma ichida bo'lmasa ham)
            marked = [u for u in fp.imgs if re.search(r"captcha|капч", " ".join(
                str(fp.img_attrs.get(u, {}).get(k) or "") for k in ("class", "alt", "id", "title")), re.I)]
            imgs = marked + (form.get("imgs") or fp.imgs)
            # captcha manzili <img> da bo'lmasa (JS/JSON ichida): …/captcha/true/<guid> ko'rinishidagi havolalarni qidiramiz
            extra = [m.group(0) for m in re.finditer(r"[^\s\"'<>()=]*captcha/[^\s\"'<>()]*", html.replace("\\/", "/"), re.I)]
            if not extra:
                for i in form["inputs"]:
                    if i["type"] == "hidden" and re.search(r"captcha", i["name"] or "", re.I) and \
                            re.fullmatch(r"[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}", i["value"] or ""):
                        extra.append("/captcha/true/" + i["value"])
            imgs = list(dict.fromkeys(extra + list(imgs)))
            outside = [i["name"] for i in fp.inputs if i["name"] and i["type"] in ("text", "number", "tel") and i["name"] not in texts]
            cap = next((n for n in texts + outside if n != us and re.search(r"captcha|code|kod|answer|sum|number|digit", n, re.I)), None) \
                or next((n for n in texts if n != us), None)
            if attempt > 1 and not (cap and imgs):            # qayta ochilgan sahifada captcha yo'q — sabab parolda
                raise RuntimeError("Login yoki parol noto'g'ri (emaktab sahifasi qayta ochildi, captcha so'ralmadi).")
            if attempt > 1:
                def _score(u):                                    # captcha rasmini boshqa rasmlardan (logotip va h.k.) ajratish
                    at = fp.img_attrs.get(u, {})
                    blob = " ".join([u[:200], at.get("id") or "", at.get("class") or "", at.get("alt") or "", at.get("title") or ""]).lower()
                    sc = 10 if ("captcha" in blob or "капч" in blob) else 0
                    if re.search(r"kod|code|secur|verify|digit|num|son", blob):
                        sc += 3
                    if sc < 10 and re.search(r"logo|icon|favicon|banner|sprite|avatar|flag|\.svg|brand|header|footer", blob):
                        sc -= 10
                    return sc
                png, tried = None, []
                for src in sorted(imgs, key=_score, reverse=True)[:6]:
                    try:
                        cst, _, hd, body = self.raw(_up.urljoin(final, src), headers={"Accept": "image/*,*/*;q=0.8", "Referer": final})
                    except RuntimeError as e:
                        tried.append(f"{src[:60]}: {str(e)[:60]}")
                        continue
                    # ba'zan server rasmni «application/octet-stream» deb yuboradi — fayl boshidagi belgilar bo'yicha ham tanlanadi
                    if cst == 200 and len(body) > 60 and ((hd.get_content_type() or "").startswith("image/") or is_image(body)):
                        png = body
                        self.ui.log(f"Captcha rasmi: {src[:150]}")
                        break
                    tried.append(f"{src[:60]}: {cst} {hd.get_content_type()} {len(body)} bayt")
                if png is None:
                    print("Captcha rasmlari:", tried or imgs[:6])
                    raise EmkFallback("Captcha rasmini yuklab bo'lmadi" + (f": {tried[0]}" if tried else ""))
                ans = self.ui.ask_captcha(png)
                if ans is None:
                    raise RuntimeError("Captcha kiritish bekor qilindi.")
                data[cap] = ans
                self.ui.log(f"[{attempt}] Captcha kiritildi.")
            st, final2, html = self.req(_up.urljoin(final, form["action"] or final), data, {"Referer": final})
            if not self.is_login(final2, html):
                self.save_state()
                self.ui.log("Muvaffaqiyatli kirildi.")
                return
            if attempt > 1:
                self.ui.log(f"[{attempt}] Kirib bo'lmadi (parol yoki captcha noto'g'ri bo'lishi mumkin).")
            final = final2
        raise EmkFallback("Kirib bo'lmadi (HTTP usuli)")

    def catalog(self):
        st, final, html = self.req(EMK_URLS["myclasses"])
        if self.is_login(final, html):
            raise RuntimeError("Sessiya tugagan — «Kirish» tugmasini bosing.")
        fp = _EmkForms()
        fp.feed(html)
        out, cur = [], None
        for a in fp.links:
            if fp.has_root and not a["root"]:
                continue
            href = _up.urljoin(final, a["href"])
            if "/v2/class?class=" in href:
                cur = {"name": a["text"].strip(), "url": href, "journals": []}
                out.append(cur)
            elif cur is not None and re.search(r"/journal/school/\d+/group/\d+/subject/\d+", href):
                cur["journals"].append({"subject": (a["title"] or a["text"]).strip(), "url": href})
        if not out:
            out = catalog_from_state(html)
        if not out:
            raise EmkFallback("Sinflar HTML ichida topilmadi")
        self.save_state()
        return out

    def download(self, cname, journal, quarter, folder):
        url = journal["url"]
        m = re.search(r"/school/(\d+)/group/(\d+)/subject/(\d+)", url)
        if not m:
            raise EmkFallback("Jurnal havolasi noto'g'ri")
        st, final, html = self.req(url)
        if self.is_login(final, html):
            raise RuntimeError("Sessiya tugagan — «Kirish» tugmasini bosing.")
        i = html.find("__JOURNAL__INITIAL__STATE__")
        state = None
        if i >= 0:
            j = html.find("=", i)
            try:
                state, _ = json.JSONDecoder().raw_decode(html[j + 1:].lstrip())
            except ValueError:
                state = None
        hdr = (state or {}).get("journalHeader") if isinstance(state, dict) else None
        if not hdr:
            raise EmkFallback("Jurnal holati (chorak identifikatori) HTML ichida topilmadi")
        pers = ((hdr.get("periods") or {}).get(hdr.get("currentGroupId")) or {}).get("periods") or []
        target = hdr.get("currentPeriodId")
        if quarter:
            q = str(quarter)
            mt = next((p for p in pers if str(p.get("number", -1) + 1) == q or str(p.get("name", "")).startswith(q)), None)
            if not mt:
                raise ValueError(f"{quarter}-chorak topilmadi: {[p.get('name') for p in pers]}")
            target = mt["id"]
        label = next((p["name"] for p in pers if p["id"] == target), "joriy")
        school, group, subject = m.groups()
        st, _, hd, body = self.raw(EMK_URLS["excel"] + "?" + _up.urlencode(
            {"action": "gjsxls", "school": school, "group": group, "subgroup": 0, "subject": subject, "period": target}),
            headers={"Referer": url}, timeout=120)
        if st != 200 or not body or "html" in (hd.get("content-type") or "").lower():
            raise EmkFallback(f"Excel o'rniga javob keldi (HTTP {st})")
        mm = re.search(r"filename\*?=(?:UTF-8'')?\"?([^\";]+)", hd.get("content-disposition") or "", re.I)
        folder.mkdir(parents=True, exist_ok=True)
        path = folder / (_emk_safe(f"{cname}_{journal['subject']}_{label}") + ((Path(mm.group(1)).suffix if mm else "") or ".xls"))
        path.write_bytes(body)
        return path
