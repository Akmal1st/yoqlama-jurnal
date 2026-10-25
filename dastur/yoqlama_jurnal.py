#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Yo'qlama jurnali — emaktab uslubidagi sinf jurnali.

Ishga tushirish:   python3 yoqlama_jurnal.py
Kerak:             pip install PySide6
Import uchun:      pip install pandas xlrd odfpy openpyxl   (faqat "Fayl → Import" uchun)
emaktabga kirish:  ishlashi uchun qo'shimcha narsa shart emas (HTTP usuli); HTTP o'tmasa zaxira: pip install playwright && playwright install chromium

Ma'lumotlar shu papkadagi journal.json faylida saqlanadi (har o'zgarishda avtomatik).
Katakka kiritiladigan qiymatlar:   1…10 — baho,   S — sababsiz,   DQ — sababli,   K — kasal,   KQ — kech qoldi
X — butun kun uchun (metod kuni / bayram): sana sarlavhasi yoki katakka o'ng tugma bilan
    qo'yiladi va olib tashlanadi. Metod kuni Sozlamalar menyusidan tanlanadi.
"""
import calendar
import copy
import hashlib
import hmac
import json
import os
import re
import tempfile
import shutil
import sys
import unicodedata
from html import escape as esc
import datetime as dt
from contextlib import contextmanager
from pathlib import Path

from PySide6.QtCore import QEvent, QDate, QMarginsF, QSizeF, QObject, QPoint, QRect, QRegularExpression, QSize, Qt, QThread, QTime, QTimer, QUrl, Signal
from PySide6.QtGui import (QAction, QActionGroup, QBrush, QColor, QDesktopServices, QFont, QFontDatabase, QGuiApplication, QRawFont, QKeySequence, QPageLayout,
                           QIcon, QImage, QPageSize, QPixmap, QPainter, QPalette, QPdfWriter, QPen, QShortcut, QTextDocument,
                           QRegularExpressionValidator)
from PySide6.QtWidgets import (
    QAbstractButton, QAbstractItemDelegate, QAbstractItemView, QApplication, QButtonGroup, QCheckBox, QColorDialog,
    QComboBox, QDateEdit, QDialog, QDialogButtonBox, QDoubleSpinBox, QFileDialog,
    QFormLayout, QHBoxLayout, QInputDialog, QLabel, QLayout, QLineEdit, QMainWindow, QMenu, QMessageBox,
    QListWidget, QListWidgetItem, QPlainTextEdit, QPushButton, QScrollArea, QRadioButton, QSizePolicy, QSpacerItem, QSpinBox, QStackedWidget, QStyledItemDelegate, QTableWidget, QTableWidgetItem,
    QFrame, QStyle, QTabBar, QTabWidget, QToolBar, QTextBrowser, QSystemTrayIcon, QTimeEdit, QTreeWidget, QTreeWidgetItem, QVBoxLayout, QWidget, QHeaderView, QProgressDialog, QGroupBox, QGridLayout,
)

BASE = Path(__file__).resolve().parent
DATA_FILE = BASE / "journal.json"

WEEKDAYS = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"]
WEEKDAYS_FULL = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"]
MONTHS_UZ = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
             "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"]
ABSENT_NAMES = {"s": "sababsiz", "dq": "sababli", "k": "kasal", "kq": "kech qoldi", "ch": "chet elda", "x": "dars yo'q"}
ATT_MARKS = ("s", "dq", "k", "kq")        # yo'qlama belgilari (jadvaldagi yig'indi ustunlari tartibida)
CH_MARK = "ch"                            # chet elga chiqib ketgan o'quvchi: davomat hisobiga kirmaydi
GRADE_TOKENS = {str(i) for i in range(1, 11)}

# Diapazon "Dan" qiymatidan boshlanadi va keyingi diapazon boshigacha davom etadi.
DEFAULT_SETTINGS = {
    "ranges": [
        {"min": 1, "color": "#ef9a9a", "name": "Past"},
        {"min": 5, "color": "#fff59d", "name": "O'rta"},
        {"min": 8, "color": "#81c784", "name": "Yaxshi"},
    ],
    "attendance": {"s": "#c62828", "dq": "#90caf9", "k": "#ce93d8", "kq": "#a1887f", "ch": "#80cbc4", "x": "#cfd8dc"},
    "method_weekday": 3,                 # 0=Dushanba … 6=Yakshanba, None — belgilanmagan
    "lesson_weekdays": [0, 1, 2, 3, 4, 5],   # oy generatsiyasida qaysi kunlar olinadi
    "theme": "sut",
    "style": "zamonaviy",
    "custom_theme": {"window": "#f4efe6", "base": "#fffdf8", "text": "#2b2620", "highlight": "#c2682b", "today": "#ffd35c"},
    "view_mode": "month",               # day | week | month
    "protect": {"enabled": True, "auto_lock_min": 10, "pin": None},   # qo'yilgan baholar himoyasi
    "quarters": [None, None, None, None],   # [[boshlanish, tugash], …] ISO sanalar; None — belgilanmagan
    "fb_min": 4,                            # formativ ball uchun chorakdagi eng kam baholar soni
    "bsb_pdf_style": "klassik",             # BSB tahlili PDF dizayni: klassik | zamonaviy | ixcham
    "quick_marks": None,                    # tezkor belgi tugmalari qatori: True/False; None — ekranga qarab avto
    "ui_zoom": 0,                           # interfeys o'lchami: 0 — avto (ekranga qarab), aks holda shrift pt
    "pdf_sort": "default",                                      # PDFda o'quvchilar tartibi: default | az | za | avg | att
    "pdf_new_alpha": True,                                      # PDFda yangi alifbo belgilari: o'→ö, g'→ğ, sh→ş, ch→ç
    "pdf_design": {"scheme": "kok", "scale": 100, "margin": 10, "zebra": True, "layout": "zamonaviy"},   # PDF dizayni: rang sxemasi, shrift masshtabi %, chetlar mm
    "report_cols": {},                  # hisobot ustunlari: {nom: False} — yashirilganlar (yo'qlari ko'rsatiladi)
    "report_extras": {"cards": True, "footnote": True},   # hisobot qo'shimcha bloklari: ko'rsatkichlar kartochkalari, izoh matni
    "layout": "tabs",                       # asosiy oyna joylashuvi: "panel" (yon panel + o'quvchi paneli) | "tabs" (klassik yorliqlar)
    "inspector": True,                      # «panel» joylashuvda o'ngdagi o'quvchi paneli ko'rinadimi
    "pdf_font": "Libertinus Serif (Typst)",                    # barcha PDF hisobotlar shrifti (PDF_FONTS kalitlaridan biri)
    "auto": {"quarters": True,              # chorak boshlanganda dars kunlari o'zi yaratiladi
             "remind": "15:00",             # davomat eslatmasi vaqti (HH:MM); "" — o'chiq
             "banner": True,                # tepada: xavf ostidagilar, bugungi darslar, yaqin summativlar
             "weekly": 4,                   # haftalik avto-hisobot kuni (0=Dush … 6); None — o'chiq
             "ktr_works": True,             # KTR dagi «BSB-1 (25 ball)» qatorlaridan ishlar o'zi yaratiladi
             "backup_min": 30,              # har necha daqiqada avto-zaxira tekshiriladi (0 — faqat ochish/yopishda)
             "watch_dir": "",               # shu papkaga yangi emaktab fayli tushsa solishtirish taklif qilinadi
             "emaktab_login": "",           # emaktab.uz login (parol faqat «eslab qolish» belgilansa saqlanadi)
             "emaktab_pass": "",
             "emaktab_sel": [],             # tanlangan jurnallar havolalari (Excel yuklash uchun)
             "emaktab_cat": [],             # «Mening sinflarim» ro'yxati (oxirgi marta olingan)
             "cloud_dir": "",               # bulut papkasi (Google Drive / Yandex Disk / Dropbox): jurnal nusxasi shu yerga ham tushadi
             "tray": True,                  # eslatmalar tizim tray'ida (oyna chiqarmasdan)
             "tray_upcoming": True,         # ertalab: yaqin BSB/CHSB va chorak tugashi haqida bir marta
             "tray_hide": False},           # oyna yopilganda dastur tray'da ishlashda davom etadi
    "subject_filter": "",                   # ko'rinadigan fan: "" — hammasi | NO_SUBJECT | fan nomi
    "risk": {"avg_below": 5.0, "att_below": 80, "s_ge": 3, "min_n": 3,   # «xavf ostidagi» o'quvchi mezonlari
             "few_lt": 4,                # shu kungacha jami baholar soni shundan kam (BSB o'tkazilgan-o'tkazilmaganidan qat'i nazar)
             "notice": "chip",           # xavf bildirishnomasi: chip (pastki panelda nishon) | banner (tepadagi satrda) | off
             "avg_min_grades": 3,        # o'rtacha ball kamida shuncha baho bo'lganda tekshiriladi
             "consec_ge": 3,             # ketma-ket shuncha dars qoldirgan (S/DQ/K)
             "drop_ge": 1.5,             # davr ikkinchi yarmining o'rtachasi birinchisidan shuncha pasaygan
             "work_below": 40,           # BSB/CHSB ball foizi shundan past
             "on": {"avg": True, "few": True, "min_n": True, "att": True, "s": True, "qgrade": True, "consec": False, "drop": False, "work": False},
             "show": {"col_risk": True, "col_reason": True, "card": True, "highlight": True, "list": False, "sheet": True}},
    # har yili takrorlanadigan bayramlar (MM-DD) yoki bir martalik sana (YYYY-MM-DD): oy yaratilganda X bo'ladi
    "holidays": ["01-01", "03-08", "03-21", "05-09", "09-01", "10-01", "12-08"],
}

# Uchta tema: och (sutrang qog'oz), qora (tun ko'k-qora), kulrang (po'lat). Sof oq/qora/kulrang emas.
THEMES = {
    "sut": {
        "title": "Okean — och",
        "line": "#c9dde0", "line_soft": "#dcebed",
        "window": "#eef6f6", "base": "#ffffff", "alt": "#f3fafa", "text": "#12303a",
        "button": "#e3f0f1", "button_text": "#12303a", "muted": "#6f8d95",
        "highlight": "#0e9aa7", "highlight_text": "#ffffff",
        "tip_base": "#12303a", "tip_text": "#eef6f6",
        "past_cell": "#e6f1f2", "today_cell": "#fff0c2",
        "hdr_past": "#d5e8ea", "hdr_past_fg": "#12303a",
        "hdr_today": "#ffc94d", "hdr_x": "#9db8be", "hdr_x_fg": "#12303a",
    },
    "tun": {
        "title": "Kosmos — qora",
        "line": "#2f3b4d", "line_soft": "#232d3b",
        "window": "#0d1117", "base": "#151b24", "alt": "#1a212c", "text": "#dde5f0",
        "button": "#1f2836", "button_text": "#dde5f0", "muted": "#6e7c91",
        "highlight": "#2dd4bf", "highlight_text": "#06201c",
        "tip_base": "#dde5f0", "tip_text": "#0d1117",
        "past_cell": "#1b2330", "today_cell": "#3a3320",
        "hdr_past": "#232d3b", "hdr_past_fg": "#c3cedd",
        "hdr_today": "#f0b429", "hdr_x": "#4a5a70", "hdr_x_fg": "#ffffff",
    },
    "tosh": {
        "title": "Qum — iliq",
        "line": "#e0d3c0", "line_soft": "#ece2d2",
        "window": "#f6f0e6", "base": "#fffcf6", "alt": "#faf5ec", "text": "#32281d",
        "button": "#efe6d6", "button_text": "#32281d", "muted": "#9a8a73",
        "highlight": "#d2691e", "highlight_text": "#ffffff",
        "tip_base": "#32281d", "tip_text": "#f6f0e6",
        "past_cell": "#efe7d8", "today_cell": "#ffe7a3",
        "hdr_past": "#e6dac6", "hdr_past_fg": "#32281d",
        "hdr_today": "#f2b84b", "hdr_x": "#b9a98f", "hdr_x_fg": "#32281d",
    },
    "claude": {
        "title": "Claude — och",
        "line": "#e3e0d5", "line_soft": "#eeece2",
        "window": "#faf9f5", "base": "#ffffff", "alt": "#f5f4ee", "text": "#141413",
        "button": "#f0eee6", "button_text": "#141413", "muted": "#83827d",
        "highlight": "#d97757", "highlight_text": "#ffffff",
        "tip_base": "#141413", "tip_text": "#faf9f5",
        "past_cell": "#f1efe6", "today_cell": "#fbeed2",
        "hdr_past": "#ece9de", "hdr_past_fg": "#3d3d3a",
        "hdr_today": "#e9b86b", "hdr_x": "#b8b5a9", "hdr_x_fg": "#141413",
    },
    "claude_tun": {
        "title": "Claude — qora",
        "line": "#43413c", "line_soft": "#383733",
        "window": "#262624", "base": "#30302e", "alt": "#2b2b29", "text": "#faf9f5",
        "button": "#3a3936", "button_text": "#faf9f5", "muted": "#9c9a92",
        "highlight": "#d97757", "highlight_text": "#ffffff",
        "tip_base": "#faf9f5", "tip_text": "#262624",
        "past_cell": "#2f2f2d", "today_cell": "#4a3f2a",
        "hdr_past": "#3a3936", "hdr_past_fg": "#d9d7cd",
        "hdr_today": "#c9923a", "hdr_x": "#5d5b55", "hdr_x_fg": "#ffffff",
    },
}


CUSTOM_FIELDS = (("window", "Fon (oyna)"), ("base", "Jadval foni"), ("text", "Matn"),
                 ("highlight", "Asosiy rang (tanlov, tugma)"), ("today", "Bugungi kun"))


def mix(a, b, k):
    """a va b ranglarni aralashtiradi (k=0 → a, k=1 → b)."""
    A, B = QColor(a), QColor(b)
    return QColor(round(A.red() + (B.red() - A.red()) * k), round(A.green() + (B.green() - A.green()) * k),
                  round(A.blue() + (B.blue() - A.blue()) * k)).name()


def build_custom_theme(c):
    """5 ta asosiy rangdan to'liq tema yasaydi."""
    w, b, t, h, today = c["window"], c["base"], c["text"], c["highlight"], c["today"]
    xbg = mix(w, t, 0.35)
    return {
        "title": "Mening dizaynim", "line": mix(w, t, 0.2), "line_soft": mix(w, t, 0.1),
        "window": w, "base": b, "alt": mix(b, w, 0.5), "text": t,
        "button": b, "button_text": t, "muted": mix(b, t, 0.5),
        "highlight": h, "highlight_text": contrast(h),
        "tip_base": t, "tip_text": w,
        "past_cell": mix(b, w, 0.8), "today_cell": mix(b, today, 0.35),
        "hdr_past": mix(w, t, 0.1), "hdr_past_fg": t,
        "hdr_today": today, "hdr_x": xbg, "hdr_x_fg": contrast(xbg),
    }


def make_palette(t):
    p = QPalette()
    R, G = QPalette.ColorRole, QPalette.ColorGroup
    win = QColor(t["window"])
    for role, val in ((R.Window, t["window"]), (R.WindowText, t["text"]), (R.Base, t["base"]),
                      (R.AlternateBase, t["alt"]), (R.Text, t["text"]), (R.Button, t["button"]),
                      (R.ButtonText, t["button_text"]), (R.Highlight, t["highlight"]),
                      (R.HighlightedText, t["highlight_text"]), (R.ToolTipBase, t["tip_base"]),
                      (R.ToolTipText, t["tip_text"]), (R.PlaceholderText, t["muted"]),
                      (R.BrightText, "#ff4444"), (R.Link, t["highlight"])):
        p.setColor(role, QColor(val))
    line, soft = QColor(t.get("line", win.darker(130).name())), QColor(t.get("line_soft", win.lighter(120).name()))
    for role, col in ((R.Light, win.lighter(140)), (R.Midlight, soft),
                      (R.Mid, line), (R.Dark, win.darker(160)), (R.Shadow, win.darker(220))):
        p.setColor(role, col)
    for role in (R.Text, R.WindowText, R.ButtonText):
        p.setColor(G.Disabled, role, QColor(t["muted"]))
    return p


# ───────────────────────── yordamchi funksiyalar ─────────────────────────
def contrast(hex_color):
    c = QColor(hex_color)
    lum = 0.299 * c.red() + 0.587 * c.green() + 0.114 * c.blue()
    return "#000000" if lum > 150 else "#ffffff"


def parse_mark(text, strict=False):
    """Belgi matnini tahlil qiladi: (baholar ro'yxati, kech_qoldi, yo'qlama_belgisi) yoki None (noto'g'ri).
    Bir katakda eng ko'pi 2 ta baho, ular orasida ajratuvchi bo'ladi: «8/9», «8 9», «8,9» («89» qabul qilinmaydi);
    KQ — baho bilan birga: «kq9», «kq10». strict=True (qo'lda kiritilganda): KQ bahodan OLDIN yoziladi; «9kq», «9 kq» rad etiladi."""
    toks, prev_end, prev_grade = [], -1, False
    for m in re.finditer(r"kq|dq|ch|10|[1-9]|s|k|x|[^\s/,+;]", str(text).lower()):
        tok = m.group()
        is_grade = tok in GRADE_TOKENS
        if is_grade and prev_grade and m.start() == prev_end:    # ajratuvchisiz ketma-ket raqamlar («89», «110»)
            return None
        if strict and tok == "kq" and any(t in GRADE_TOKENS for t in toks):
            return None
        toks.append(tok)
        prev_end, prev_grade = m.end(), is_grade
    if not toks:
        return [], False, ""
    absent = [x for x in toks if x in ("s", "dq", "k", "x", "ch")]
    if absent:
        return ([], False, absent[0]) if len(toks) == 1 else None
    grades, late = [], False
    for x in toks:
        if x == "kq":
            if late:
                return None
            late = True
        elif x in GRADE_TOKENS:
            grades.append(int(x))
        else:
            return None
    return (grades, late, "") if len(grades) <= 2 else None


def build_mark(grades, late):
    return "/".join(str(g) for g in grades) + ("kq" if late else "")


def norm_mark(text, strict=False):
    """'' | '8' | '8/9' | 's' | 'dq' | 'k' | 'kq' | '8kq' | '8/9kq' | 'x'  (noto'g'ri bo'lsa None)."""
    p = parse_mark(text, strict)
    if p is None:
        return None
    grades, late, absent = p
    return absent or build_mark(grades, late)


def grades_of(m):
    """Belgidagi baholar ro'yxati: '8' → [8], '8/9kq' → [8, 9], 'kq' / 's' → []."""
    g = m[:-2] if m.endswith("kq") else m
    parts = g.split("/") if g else []
    return [int(x) for x in parts] if parts and all(x.isdigit() for x in parts) else []


def grade_of(m):
    gs = grades_of(m)
    return gs[0] if gs else None


def late_of(m):
    return m.endswith("kq")


def count_att(vals, code):
    """Belgilar ro'yxatida shu yo'qlama belgisi necha marta uchraydi; KQ — baho bilan birga qo'yilganlarni ham sanaydi."""
    return sum(1 for v in vals if (late_of(v) if code == "kq" else v == code))


def display_mark(m):
    if not m:
        return ""
    gs = grades_of(m)
    if gs:
        txt = "/".join(str(g) for g in gs)
        if late_of(m):
            txt = "KQ" + txt if len(gs) == 1 else "KQ\n" + txt
        return txt
    return m.upper()


def att_part(m):
    """Belgidagi davomat qismi: 's' | 'dq' | 'k' | 'ch' | 'kq' (baho bilan birga kech qolgan ham) | ''."""
    if not m:
        return ""
    if not grades_of(m) and m != "kq":
        return m
    return "kq" if late_of(m) else ""


def score_part(m):
    """Belgidagi ball qismi: '8' | '8/9' | ''."""
    return "/".join(str(g) for g in grades_of(m)) if m else ""


def apply_part(old, part, text, strict=False):
    """Kun rejimida davomat («att») yoki ball («score») ustuniga yozilgan matnni butun belgiga qo'shadi.
    Baho va KQ birga yozilishi mumkin («kq9», «kq10»; strict bo'lsa «9kq» rad etiladi). Noto'g'ri matn bo'lsa None."""
    p = parse_mark(text, strict)
    if p is None:
        return None
    grades, late, absent = p
    if absent:                                           # S / DQ / K / CH — butun belgini almashtiradi
        return absent
    og = grades_of(old) if old else []
    olate = bool(old) and late_of(old)
    if part == "att":
        return build_mark(grades or og, late)            # davomat ustuniga «kq9» yozilsa — baho ham olinadi
    if not str(text).strip():                            # ballni tozalash: davomat belgisi qoladi
        return old if (old and not og and old != "kq") else build_mark([], olate)
    return build_mark(grades, olate or late)


def combine_mark(old, value, drop_late=False, second=False):
    """Tezkor tugma bosilganda yangi belgi. Baho — kech qolish belgisini saqlaydi (second=True bo'lsa ikkinchi baho
    sifatida qo'shiladi); KQ — baho bilan birga qo'shiladi (drop_late=True bo'lsa olib tashlanadi);
    S / DQ / K — butun belgini almashtiradi; bo'sh — tozalaydi."""
    if value == "":
        return ""
    gs = grades_of(old) if old else []
    late = bool(old) and late_of(old)
    if value == "kq":
        return build_mark(gs, not drop_late)
    if value.isdigit():
        g = int(value)
        return build_mark([gs[0], g] if (second and gs) else [g], late)
    return value


class InfoLabel(QLabel):
    """Pastki ma'lumot qatori: ko'pi bilan 2 qator joy egallaydi (jadvalga joy qoladi), to'liq matn — kursor ustida (tooltip)."""

    def __init__(self, lines=2, parent=None):
        super().__init__(parent)
        self._lines = lines
        self.setWordWrap(True)
        self.setMinimumWidth(1)
        self.setTextFormat(Qt.TextFormat.RichText)
        self.setSizePolicy(QSizePolicy.Policy.Ignored, QSizePolicy.Policy.Fixed)

    def setText(self, text):
        super().setText(text)
        self.setToolTip(re.sub(r"<[^>]+>", "", text.replace("<br>", "\n")).replace("&nbsp;", " "))

    def sizeHint(self):
        return QSize(100, self.fontMetrics().lineSpacing() * self._lines + 4)

    def minimumSizeHint(self):
        return self.sizeHint()


class InfoRow(QLabel):
    """Aniq bitta qator. Joy yetmasa, kam muhim bo'laklar (oxiridagilar) tushirib qoldiriladi — matn hech qachon
    bo'linib ketmaydi yoki kesilmaydi; to'liq matn kursor ustida (tooltip)."""

    SEP = " <span style='color:#9e9e9e'>│</span> "

    def __init__(self, parent=None):
        super().__init__(parent)
        self._parts = []
        self.setWordWrap(False)
        self.setMinimumWidth(1)
        self.setTextFormat(Qt.TextFormat.RichText)
        self.setSizePolicy(QSizePolicy.Policy.Ignored, QSizePolicy.Policy.Fixed)

    @staticmethod
    def _plain(parts):
        return re.sub(r"<[^>]+>", "", " │ ".join(parts)).replace("&nbsp;", " ")

    def set_parts(self, parts):
        self._parts = [p for p in parts if p]
        self.setToolTip(self._plain(self._parts))
        self._fit()

    def _fit(self):
        parts, w = list(self._parts), max(10, self.width() - 4)
        fm = self.fontMetrics()
        while len(parts) > 1 and fm.horizontalAdvance(self._plain(parts)) > w:
            parts.pop()
        html = self.SEP.join(p.replace(" ", "&nbsp;") for p in parts)
        if len(parts) == 1 and fm.horizontalAdvance(self._plain(parts)) > w:     # bitta bo'lak ham sig'masa — «…»
            html = esc(fm.elidedText(self._plain(parts), Qt.TextElideMode.ElideRight, w))
        super().setText(html)

    def resizeEvent(self, ev):
        super().resizeEvent(ev)
        self._fit()

    def sizeHint(self):
        return QSize(100, self.fontMetrics().lineSpacing() + 4)

    def minimumSizeHint(self):
        return QSize(1, self.fontMetrics().lineSpacing() + 4)


class FlowLayout(QLayout):
    """Vidjetlarni sig'maganda keyingi qatorga o'tkazadigan tartib — tor ekranda panel kengaytirmaydi."""

    def __init__(self, parent=None, hspacing=6, vspacing=4):
        super().__init__(parent)
        self._items, self._h, self._v = [], hspacing, vspacing
        self.setContentsMargins(0, 0, 0, 0)

    def addItem(self, item):
        self._items.append(item)

    def addSpacing(self, n):
        self.addItem(QSpacerItem(n, 1))

    def addStretch(self, *_):
        pass

    def _live(self):
        """O'chirilgan (C++ tomondan yo'q qilingan) elementlarni ro'yxatdan chiqarib tashlaydi."""
        ok = []
        for it in self._items:
            try:
                it.sizeHint()
                ok.append(it)
            except RuntimeError:
                pass
        if len(ok) != len(self._items):
            self._items = ok
        return ok

    def count(self):
        return len(self._items)

    def itemAt(self, i):
        return self._items[i] if 0 <= i < len(self._items) else None

    def takeAt(self, i):
        return self._items.pop(i) if 0 <= i < len(self._items) else None

    def expandingDirections(self):
        return Qt.Orientation(0)

    def hasHeightForWidth(self):
        return True

    def heightForWidth(self, w):
        return self._layout(QRect(0, 0, w, 0), True)

    def setGeometry(self, rect):
        super().setGeometry(rect)
        need = self._layout(rect, False)
        if need != getattr(self, "_need", None):          # kerakli balandlik o'zgardi — ota tartibga bildiramiz
            self._need = need
            QTimer.singleShot(0, self._refresh)

    def _refresh(self):
        try:
            self.invalidate()
            pw = self.parentWidget()
            if pw is not None:
                pw.updateGeometry()
        except RuntimeError:
            pass

    def sizeHint(self):
        return self.minimumSize()

    def minimumSize(self):
        size = QSize()
        for it in self._live():
            size = size.expandedTo(it.minimumSize())
        m = self.contentsMargins()
        size = size + QSize(m.left() + m.right(), m.top() + m.bottom())
        need = getattr(self, "_need", 0) or 0
        return QSize(size.width(), max(size.height(), need))     # hfw ishlamasa ham panel ustiga chiqib ketmaydi

    def _layout(self, rect, test):
        m = self.contentsMargins()
        r = rect.adjusted(m.left(), m.top(), -m.right(), -m.bottom())
        x, y, line_h = r.x(), r.y(), 0
        for it in self._live():
            sz = it.sizeHint()
            if x + sz.width() > r.right() + 1 and line_h > 0:
                x, y, line_h = r.x(), y + line_h + self._v, 0
            if not test:
                it.setGeometry(QRect(QPoint(x, y), sz))
            x += sz.width() + self._h
            line_h = max(line_h, sz.height())
        return y + line_h - rect.y() + m.bottom()


class FlowBox(QWidget):
    """FlowLayout uchun o'ram: balandligini o'zi hisoblab, ota tartibga ishonchli bildiradi (ustma-ust tushmaydi)."""

    def __init__(self, flow):
        super().__init__()
        self.flow = flow
        self.setLayout(flow)
        self.setSizePolicy(QSizePolicy.Policy.Preferred, QSizePolicy.Policy.Minimum)

    def hasHeightForWidth(self):
        return True

    def heightForWidth(self, w):
        return self.flow.heightForWidth(w)

    def sizeHint(self):
        return QSize(100, self.flow.heightForWidth(max(self.width(), 100)))

    def minimumSizeHint(self):
        return QSize(1, self.flow.heightForWidth(max(self.width(), 100)))

    def resizeEvent(self, e):
        super().resizeEvent(e)
        h = self.flow.heightForWidth(max(self.width(), 1))
        if self.minimumHeight() != h:
            self.setMinimumHeight(h)
            self.updateGeometry()


UI = {"scale": 1.0}                # interfeys masshtabi (asosiy shrift 10 pt = 1.0)
UI_ZOOMS = (("Avto (ekranga qarab)", 0), ("Kichik (9 pt)", 9), ("O'rta (10 pt)", 10), ("Katta (12 pt)", 12),
            ("Juda katta (14 pt)", 14), ("Eng katta (16 pt)", 16))


def S(n):
    """Piksel o'lchamini interfeys masshtabiga moslaydi."""
    return max(1, int(round(n * UI["scale"])))


def auto_ui_pt(screen=None):
    """Ekran ish maydoni balandligiga qarab asosiy shrift o'lchamini tanlaydi (mantiqiy pikselda — HiDPI hisobga olingan)."""
    scr = screen or QGuiApplication.primaryScreen()
    h = scr.availableGeometry().height() if scr else 800
    return 9 if h < 700 else 10 if h < 900 else 11 if h < 1250 else 12 if h < 1700 else 14


def apply_ui_zoom(pt_setting):
    """pt_setting: 0 — avto, aks holda shrift o'lchami (pt). Ilova shriftini va masshtabni yangilaydi, joriy pt ni qaytaradi."""
    pt = pt_setting if pt_setting else auto_ui_pt()
    app = QApplication.instance()
    f = app.font()
    f.setPointSizeF(float(pt))
    app.setFont(f)
    UI["scale"] = pt / 10.0
    return pt


def _is_emoji_char(ch):
    o = ord(ch)
    return o >= 0x1F000 or 0x2600 <= o <= 0x27BF or 0x2B00 <= o <= 0x2BFF or 0x2300 <= o <= 0x23FF or ch in "⬇↺⭐↶"


_EMOJI_FAMILIES = ("Noto Color Emoji", "Twemoji Mozilla", "Twitter Color Emoji", "Apple Color Emoji", "Segoe UI Emoji",
                   "JoyPixels", "EmojiOne Color", "Noto Emoji", "Symbola", "Segoe UI Symbol")
_EMOJI_CACHE = {}


def emoji_family():
    """Tizimdagi emoji shrifti nomi (topilmasa None). Natija eslab qolinadi."""
    if "fam" not in _EMOJI_CACHE:
        try:
            have = set(QFontDatabase.families())
        except Exception:  # noqa: BLE001
            have = set()
        _EMOJI_CACHE["fam"] = next((f for f in _EMOJI_FAMILIES if f in have), None)
    return _EMOJI_CACHE["fam"]


def _font_for_char(ch):
    """Shu belgini chizadigan shrift: avval emoji shrifti, so'ng belgini qo'llaydigan har qanday shrift (yoki None)."""
    key = ("ch", ch)
    if key in _EMOJI_CACHE:
        return _EMOJI_CACHE[key]
    found = None
    cands = ([emoji_family()] if emoji_family() else [])
    try:
        cands += [f for f in QFontDatabase.families() if f not in cands]
    except Exception:  # noqa: BLE001
        pass
    for fam in cands[:400]:
        try:
            if QRawFont.fromFont(QFont(fam)).supportsCharacter(ord(ch)):
                found = fam
                break
        except Exception:  # noqa: BLE001
            continue
    _EMOJI_CACHE[key] = found
    return found


def install_emoji_font():
    """Matnning ichidagi emojilar (tugma, yorliq) ham chiqishi uchun: asosiy shriftga emoji shriftini zaxira qilib qo'yadi."""
    fam = emoji_family()
    if not fam:
        return None
    try:
        base = QApplication.instance().font().family()
        QFont.insertSubstitution(base, fam)
        for extra in ("Sans Serif", "sans-serif", "System-ui"):
            QFont.insertSubstitution(extra, fam)
    except Exception:  # noqa: BLE001
        pass
    return fam


def emoji_diag():
    fam = emoji_family()
    rows = [f"Emoji shrifti: {fam or 'TOPILMADI'}"]
    for ch in "📚🔑⬇⚙🌐📋💾🗑":
        rows.append(f"  {ch}  →  {_font_for_char(ch) or 'shrift yo`q'}")
    if not fam:
        rows.append("\nEmoji shrifti o'rnatilmagan. Fedora:  sudo dnf install google-noto-color-emoji-fonts\n"
                    "Ubuntu/Debian:  sudo apt install fonts-noto-color-emoji   (so'ng dasturni qayta ishga tushiring)")
    return "\n".join(rows)


# ── Shriftsiz (vektor) ikonkalar: emoji shrifti bo'lmasa ham ishlaydi ──
def _vec_draw_table():
    from PySide6.QtGui import QPainterPath, QPolygonF
    from PySide6.QtCore import QPointF, QRectF

    def pt(*xy):
        return [QPointF(xy[i], xy[i + 1]) for i in range(0, len(xy), 2)]

    BLUE, GREEN, RED, AMBER, GRAY, PURPLE, BROWN = (QColor(c) for c in
                                                    ("#4f8cff", "#2e9e5b", "#d64545", "#e0a100", "#8a94a6", "#8b5cf6", "#a8754a"))

    def line(p, w, col, *xy, cap=True):
        pen = QPen(col, w)
        pen.setCapStyle(Qt.PenCapStyle.RoundCap)
        pen.setJoinStyle(Qt.PenJoinStyle.RoundJoin)
        p.setPen(pen)
        p.setBrush(Qt.BrushStyle.NoBrush)
        p.drawPolyline(QPolygonF(pt(*xy)))

    def fill(p, col, *xy):
        p.setPen(Qt.PenStyle.NoPen)
        p.setBrush(col)
        p.drawPolygon(QPolygonF(pt(*xy)))

    def rect(p, x, y, w, h, fg=None, bg=None, r=1.5, lw=1.6):
        p.setPen(QPen(fg, lw) if fg else Qt.PenStyle.NoPen)
        p.setBrush(bg if bg else Qt.BrushStyle.NoBrush)
        p.drawRoundedRect(QRectF(x, y, w, h), r, r)

    def circ(p, cx, cy, r, fg=None, bg=None, lw=1.6):
        p.setPen(QPen(fg, lw) if fg else Qt.PenStyle.NoPen)
        p.setBrush(bg if bg else Qt.BrushStyle.NoBrush)
        p.drawEllipse(QPointF(cx, cy), r, r)

    def arc_arrow(p, fg, flip=False):
        pen = QPen(fg, 2.0)
        pen.setCapStyle(Qt.PenCapStyle.RoundCap)
        p.setPen(pen)
        p.setBrush(Qt.BrushStyle.NoBrush)
        p.drawArc(QRectF(5, 5, 14, 14), 40 * 16, 270 * 16)
        fill(p, fg, 17.5, 3.5, 20.5, 9.5, 13.5, 8.5) if not flip else fill(p, fg, 6.5, 3.5, 3.5, 9.5, 10.5, 8.5)

    T = {}
    T["⭐"] = lambda p, fg: fill(p, AMBER, 12, 2.5, 14.8, 9, 21.5, 9.4, 16.3, 13.8, 18, 20.5, 12, 16.8, 6, 20.5, 7.7, 13.8, 2.5, 9.4, 9.2, 9)
    T["⚡"] = lambda p, fg: fill(p, AMBER, 13.5, 2, 5.5, 13.5, 11, 13.5, 9.5, 22, 18.5, 10, 13, 10)
    T["✎"] = lambda p, fg: (fill(p, fg, 4, 20, 5, 15, 16, 4, 20, 8, 9, 19), line(p, 1.6, fg, 14, 6, 18, 10))
    T["📝"] = lambda p, fg: (rect(p, 4, 3, 13, 18, fg, None, 2), line(p, 1.4, fg, 7, 8, 14, 8), line(p, 1.4, fg, 7, 12, 14, 12),
                            fill(p, AMBER, 13, 21, 14, 16.5, 21, 9.5, 24, 12.5, 17, 19.5))
    T["📊"] = lambda p, fg: (rect(p, 3, 12, 5, 9, None, BLUE, 1), rect(p, 10, 6, 5, 15, None, GREEN, 1), rect(p, 17, 3, 5, 18, None, AMBER, 1))
    T["📈"] = lambda p, fg: (line(p, 1.6, fg, 3, 3, 3, 21, 21, 21), line(p, 2.2, GREEN, 6, 16, 11, 11, 14, 14, 20, 6),
                            fill(p, GREEN, 20.5, 4.5, 20.5, 9.5, 15.5, 9.5))
    T["📄"] = lambda p, fg: (rect(p, 5, 2.5, 14, 19, fg, None, 2), line(p, 1.4, fg, 8, 9, 16, 9), line(p, 1.4, fg, 8, 13, 16, 13), line(p, 1.4, fg, 8, 17, 13, 17))
    T["📋"] = lambda p, fg: (rect(p, 5, 4, 14, 18, fg, None, 2), rect(p, 8.5, 2, 7, 4.5, fg, QColor("#f2f4f8"), 1.5), line(p, 1.4, fg, 8, 12, 16, 12), line(p, 1.4, fg, 8, 16, 16, 16))
    T["📇"] = lambda p, fg: (rect(p, 3, 5, 18, 14, fg, None, 2), circ(p, 9, 11.5, 2.2, None, fg), line(p, 1.4, fg, 13, 10, 18, 10), line(p, 1.4, fg, 13, 14, 18, 14))
    T["📚"] = lambda p, fg: (rect(p, 3, 4, 5, 17, None, BLUE, 1), rect(p, 9.5, 3, 5, 18, None, RED, 1), rect(p, 16, 6, 5, 15, None, GREEN, 1))
    T["📗"] = lambda p, fg: (rect(p, 5, 3, 14, 18, None, GREEN, 2), line(p, 1.4, QColor("#ffffff"), 8, 7, 8, 17))
    T["📒"] = lambda p, fg: (rect(p, 5, 3, 14, 18, None, AMBER, 2), line(p, 1.4, QColor("#ffffff"), 8, 7, 8, 17))
    T["📂"] = lambda p, fg: (line(p, 1.6, fg, 3, 7, 3, 19, 18, 19, 21, 11, 9, 11, 7, 8, 3, 8), fill(p, AMBER, 5, 19, 8, 11, 21, 11, 18, 19))
    T["📅"] = T["📆"] = lambda p, fg: (rect(p, 3, 5, 18, 16, fg, None, 2), rect(p, 3, 5, 18, 4.5, None, RED, 1.5), line(p, 2, fg, 8, 3, 8, 7), line(p, 2, fg, 16, 3, 16, 7),
                                       rect(p, 7, 12, 3, 3, None, fg, .6), rect(p, 12, 12, 3, 3, None, fg, .6), rect(p, 7, 16.5, 3, 2.5, None, fg, .6))
    T["⚠"] = lambda p, fg: (fill(p, AMBER, 12, 3, 22, 20.5, 2, 20.5), line(p, 2, QColor("#3a2c00"), 12, 9, 12, 14.5), circ(p, 12, 17.5, 1.1, None, QColor("#3a2c00")))
    T["✔"] = T["✓"] = lambda p, fg: line(p, 2.6, GREEN if True else fg, 4.5, 12.5, 9.5, 17.5, 19.5, 6.5)
    T["✅"] = lambda p, fg: (circ(p, 12, 12, 9.5, None, GREEN), line(p, 2.4, QColor("#ffffff"), 7.5, 12.5, 10.8, 15.8, 16.8, 8.8))
    T["❌"] = lambda p, fg: (line(p, 2.8, RED, 5.5, 5.5, 18.5, 18.5), line(p, 2.8, RED, 18.5, 5.5, 5.5, 18.5))
    T["✕"] = T["✖"] = lambda p, fg: (line(p, 2.4, fg, 6, 6, 18, 18), line(p, 2.4, fg, 18, 6, 6, 18))
    T["☑"] = lambda p, fg: (rect(p, 4, 4, 16, 16, fg, None, 2.5), line(p, 2.2, GREEN, 8, 12.5, 11, 15.5, 16.5, 8.5))
    T["✉"] = lambda p, fg: (rect(p, 3, 6, 18, 13, fg, None, 2), line(p, 1.6, fg, 3.5, 7.5, 12, 14, 20.5, 7.5))
    T["🔍"] = lambda p, fg: (circ(p, 10, 10, 6, fg, None, 2.2), line(p, 2.8, fg, 14.5, 14.5, 20.5, 20.5))
    T["🎓"] = lambda p, fg: (fill(p, fg, 12, 5, 23, 10, 12, 15, 1, 10), line(p, 1.8, fg, 6, 12.5, 6, 17, 12, 19.5, 18, 17, 18, 12.5), line(p, 1.6, fg, 22, 10.5, 22, 16))
    T["🔒"] = lambda p, fg: (rect(p, 5, 11, 14, 10, None, AMBER, 2), line(p, 2.2, fg, 8, 11, 8, 8, 9.5, 5, 12, 4, 14.5, 5, 16, 8, 16, 11))
    T["🔓"] = lambda p, fg: (rect(p, 5, 11, 14, 10, None, GRAY, 2), line(p, 2.2, fg, 8, 11, 8, 8, 9.5, 5, 12, 4, 14.5, 5, 16, 7))
    T["🔑"] = lambda p, fg: (circ(p, 8, 9, 4.8, AMBER, None, 2.4), line(p, 2.4, AMBER, 11.5, 12.5, 20, 21), line(p, 2.2, AMBER, 16.5, 17, 19.5, 14), line(p, 2.2, AMBER, 19, 20, 21.5, 17.5))
    T["⬇"] = lambda p, fg: (line(p, 2.6, BLUE, 12, 3.5, 12, 17), line(p, 2.6, BLUE, 6, 12, 12, 18, 18, 12), line(p, 2.4, fg, 4.5, 21, 19.5, 21))
    T["💾"] = lambda p, fg: (rect(p, 3.5, 3.5, 17, 17, None, BLUE, 2), rect(p, 7, 3.5, 10, 6, None, QColor("#e6edfb"), 1), rect(p, 7, 13, 10, 7.5, None, QColor("#ffffff"), 1))
    T["⚙"] = lambda p, fg: (lambda: [p.save(), p.translate(12, 12), [(p.rotate(45), rect(p, -1.8, -10.5, 3.6, 5, None, fg, .8)) for _ in range(8)], p.restore(),
                                      circ(p, 12, 12, 7, None, fg), circ(p, 12, 12, 3.2, None, QColor(255, 255, 255, 0))])()
    T["🗑"] = lambda p, fg: (line(p, 2, fg, 4, 6.5, 20, 6.5), line(p, 2, fg, 9, 6.5, 9, 4, 15, 4, 15, 6.5), rect(p, 6, 8, 12, 13, fg, None, 2), line(p, 1.6, fg, 10, 11, 10, 18), line(p, 1.6, fg, 14, 11, 14, 18))
    T["👁"] = lambda p, fg: (line(p, 1.8, fg, 2, 12, 6, 7.5, 12, 5.5, 18, 7.5, 22, 12, 18, 16.5, 12, 18.5, 6, 16.5, 2, 12), circ(p, 12, 12, 3.4, None, fg))
    T["🖼"] = lambda p, fg: (rect(p, 3, 4, 18, 16, fg, None, 2), fill(p, GREEN, 5, 18, 10, 11, 14, 16, 16, 13.5, 19, 18), circ(p, 16.5, 8.5, 1.8, None, AMBER))
    T["👤"] = lambda p, fg: (circ(p, 12, 8, 4, None, fg), fill(p, fg, 4, 21, 5.5, 15.5, 8.5, 13.5, 15.5, 13.5, 18.5, 15.5, 20, 21))
    T["🎨"] = lambda p, fg: (circ(p, 12, 12, 9.5, fg, None, 1.8), circ(p, 8, 10, 1.8, None, RED), circ(p, 12.5, 7.5, 1.8, None, BLUE), circ(p, 16.5, 11, 1.8, None, GREEN))
    T["🧰"] = lambda p, fg: (rect(p, 3, 8, 18, 12, None, RED, 2), line(p, 2, fg, 8.5, 8, 8.5, 5, 15.5, 5, 15.5, 8), line(p, 1.4, QColor("#ffffff"), 3.5, 13, 20.5, 13))
    T["🖨"] = lambda p, fg: (rect(p, 3, 9, 18, 8, fg, None, 2), rect(p, 7, 3.5, 10, 5.5, fg, None, 1), rect(p, 7, 14, 10, 6.5, fg, QColor("#ffffff"), 1))
    T["⏱"] = lambda p, fg: (circ(p, 12, 13.5, 8, fg, None, 1.9), line(p, 1.9, fg, 12, 13.5, 12, 8.5), line(p, 2.2, fg, 9.5, 3.5, 14.5, 3.5))
    T["🌐"] = lambda p, fg: (circ(p, 12, 12, 9.5, BLUE, None, 1.8), line(p, 1.4, BLUE, 2.5, 12, 21.5, 12), p.drawEllipse(QRectF(7.5, 2.5, 9, 19)), line(p, 1.4, BLUE, 4, 7.5, 20, 7.5), line(p, 1.4, BLUE, 4, 16.5, 20, 16.5))
    T["📱"] = lambda p, fg: (rect(p, 6.5, 2.5, 11, 19, fg, None, 2.5), line(p, 1.8, fg, 10.5, 18.5, 13.5, 18.5))
    T["🔔"] = lambda p, fg: (fill(p, AMBER, 12, 3, 17, 7, 17.5, 14, 20, 17, 4, 17, 6.5, 14, 7, 7), circ(p, 12, 19.5, 1.8, None, AMBER))
    T["☁"] = lambda p, fg: (lambda path: (path.addEllipse(QRectF(3, 11, 9, 9)), path.addEllipse(QRectF(8, 6, 10, 10)), path.addEllipse(QRectF(13, 11, 8, 9)),
                                          path.addRect(QRectF(7.5, 14, 9.5, 6)), p.setPen(Qt.PenStyle.NoPen), p.setBrush(GRAY), p.drawPath(path.simplified())))(QPainterPath())
    T["↺"] = lambda p, fg: arc_arrow(p, fg, True)
    T["↶"] = lambda p, fg: arc_arrow(p, fg, True)
    T["↳"] = lambda p, fg: (line(p, 2.2, fg, 5, 4, 5, 14, 17, 14), line(p, 2.2, fg, 13, 9.5, 18, 14, 13, 18.5))
    T["⇤"] = lambda p, fg: (line(p, 2.4, fg, 4.5, 4, 4.5, 20), line(p, 2.4, fg, 20, 12, 8, 12), line(p, 2.4, fg, 12.5, 7, 7.5, 12, 12.5, 17))
    T["⇥"] = lambda p, fg: (line(p, 2.4, fg, 19.5, 4, 19.5, 20), line(p, 2.4, fg, 4, 12, 16, 12), line(p, 2.4, fg, 11.5, 7, 16.5, 12, 11.5, 17))
    T["◀"] = lambda p, fg: fill(p, fg, 16.5, 5, 16.5, 19, 6.5, 12)
    T["▶"] = lambda p, fg: fill(p, fg, 7.5, 5, 7.5, 19, 17.5, 12)
    T["◧"] = lambda p, fg: (rect(p, 4, 4, 16, 16, fg, None, 2), rect(p, 4, 4, 8, 16, None, fg, 1))
    T["⌫"] = lambda p, fg: (line(p, 1.8, fg, 9, 5, 21, 5, 21, 19, 9, 19, 2.5, 12, 9, 5), line(p, 2, fg, 12.5, 9, 17.5, 15), line(p, 2, fg, 17.5, 9, 12.5, 15))
    return T


_VEC_TABLE = {}


def vec_icon(ch, px=18):
    """Shriftga bog'liq bo'lmagan ikonka (QPainter bilan chizilgan). Ma'lum bo'lmagan belgi uchun None."""
    ch = ch.replace("\ufe0f", "")
    if not _VEC_TABLE:
        try:
            _VEC_TABLE.update(_vec_draw_table())
        except Exception:  # noqa: BLE001
            _VEC_TABLE["_err"] = True
    fn = _VEC_TABLE.get(ch)
    if fn is None:
        return None
    dpr = 2.0
    pm = QPixmap(int(px * dpr), int(px * dpr))
    pm.fill(Qt.GlobalColor.transparent)
    pm.setDevicePixelRatio(dpr)
    p = QPainter(pm)
    p.setRenderHint(QPainter.RenderHint.Antialiasing)
    p.scale(px / 24.0, px / 24.0)
    fg = QApplication.instance().palette().color(QPalette.ColorRole.Text)
    try:
        fn(p, fg)
    finally:
        p.end()
    return QIcon(pm)


def emoji_icon(ch, px=18):
    """Emoji belgisini QIcon ga aylantiradi (menyu shrifti emoji ko'rsatmasa ham rasm sifatida chiqadi).
    Shrift topilmasa — belgi o'rniga ranglı yumaloq belgi chiziladi (bo'sh qolmaydi)."""
    vi = vec_icon(ch, px)                                    # avval shriftga bog'liq bo'lmagan o'z ikonkalarimiz
    if vi is not None:
        return vi
    dpr = 2.0
    pm = QPixmap(int(px * dpr), int(px * dpr))
    pm.fill(Qt.GlobalColor.transparent)
    pm.setDevicePixelRatio(dpr)
    p = QPainter(pm)
    p.setRenderHint(QPainter.RenderHint.Antialiasing)
    fam = _font_for_char(ch)
    if fam:
        f = QFont(fam)
        f.setPixelSize(int(px * 0.82))
        p.setFont(f)
        p.setPen(QColor("#d97706") if ch in "⭐⚡" else QApplication.instance().palette().color(QPalette.ColorRole.Text))
        p.drawText(QRect(0, 0, px, px), Qt.AlignmentFlag.AlignCenter, ch)
    else:                                                    # zaxira: belgi kodiga qarab doimiy rang
        col = QColor.fromHsv((ord(ch) * 37) % 360, 140, 200)
        p.setBrush(col)
        p.setPen(Qt.PenStyle.NoPen)
        p.drawRoundedRect(QRect(2, 2, px - 4, px - 4), 4, 4)
    p.end()
    return QIcon(pm)


def iconize_menu(menu):
    """Menyu bandlari matnidagi boshlang'ich emojini rasm-ikonkaga o'tkazadi (rekursiv)."""
    for a in menu.actions():
        sm = a.menu()
        if sm is not None:
            iconize_menu(sm)
        t = a.text()
        if a.icon().isNull() and len(t) > 2 and t[1] == " " and _is_emoji_char(t[0]):
            a.setIcon(emoji_icon(t[0]))
            a.setText(t[2:])
        elif a.icon().isNull() and len(t) > 3 and t[0] == "&" and False:
            pass


def iconize_widget(w):
    """Tugma, asboblar paneli, yorliq (tab) va ro'yxat bandlaridagi boshlang'ich emojini ikonkaga aylantiradi."""
    def split(t):
        t = t or ""
        if len(t) > 2 and t[1] == " " and _is_emoji_char(t[0]):
            return t[0], t[2:]
        if len(t) > 1 and t[0] == "&" and False:
            return None
        return None
    try:
        if isinstance(w, QToolBar):
            for a in w.actions():
                s = split(a.text())
                if s and a.icon().isNull():
                    a.setIcon(emoji_icon(s[0]))
                    a.setText(s[1])
        elif isinstance(w, QAbstractButton) and not isinstance(w, (QCheckBox, QRadioButton)):
            s = split(w.text())
            if s and w.icon().isNull():
                w.setIcon(emoji_icon(s[0]))
                w.setIconSize(QSize(18, 18))
                w.setText(s[1])
        elif isinstance(w, QTabBar):
            for i in range(w.count()):
                s = split(w.tabText(i))
                if s and w.tabIcon(i).isNull():
                    w.setTabIcon(i, emoji_icon(s[0]))
                    w.setTabText(i, s[1])
        elif isinstance(w, QListWidget):
            for i in range(w.count()):
                it = w.item(i)
                s = split(it.text())
                if s and it.icon().isNull():
                    it.setIcon(emoji_icon(s[0]))
                    it.setText(s[1])
    except Exception:  # noqa: BLE001
        pass


class ScreenGuard(QObject):
    """Har bir oyna/dialog ochilganda uni ekran ish maydoniga sig'dirib qo'yadi (minimal o'lcham ekrandan katta bo'lsa — kichraytiradi)."""

    def eventFilter(self, obj, ev):
        if ev.type() == QEvent.Type.Show and isinstance(obj, (QAbstractButton, QToolBar, QTabBar, QListWidget)):
            iconize_widget(obj)
            return False
        if ev.type() == QEvent.Type.Show and isinstance(obj, QMenu):
            try:
                iconize_menu(obj)                                   # keyin ochiladigan (kontekst) menyularda ham emoji ikonkalar chiqsin
            except Exception:  # noqa: BLE001
                pass
            return False
        if ev.type() == QEvent.Type.Show and isinstance(obj, QWidget) and obj.isWindow() \
                and isinstance(obj, (QDialog, QMainWindow)):
            scr = obj.screen() or QGuiApplication.primaryScreen()
            if scr:
                av = scr.availableGeometry()
                mw, mh = int(av.width() * 0.97), int(av.height() * 0.95)
                if obj.minimumWidth() > mw:
                    obj.setMinimumWidth(mw)
                if obj.minimumHeight() > mh:
                    obj.setMinimumHeight(mh)
                if obj.width() > mw or obj.height() > mh:
                    obj.resize(min(obj.width(), mw), min(obj.height(), mh))
                    g = obj.frameGeometry()
                    g.moveTopLeft(QPoint(max(av.x(), min(g.x(), av.right() - g.width())),
                                         max(av.y(), min(g.y(), av.bottom() - g.height()))))
                    obj.move(g.topLeft())
        return False


def _arrow_dir():
    """Ochiladigan ro'yxat va hisoblagich o'qlari uchun kichik SVG rasmlar (QSS ularni url() bilan oladi)."""
    d = Path(tempfile.gettempdir()) / "yoqlama_jurnal_ui"
    try:
        d.mkdir(exist_ok=True)
        for name, body in (("check", '<polyline points="2.5,6.5 5,9 9.5,3.5" fill="none" stroke="#4f8cff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
                           ("dot", '<circle cx="6" cy="6" r="2.8" fill="#4f8cff"/>')):
            f = d / f"{name}.svg"
            f.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12">{body}</svg>', encoding="utf-8")
        for name, pts in (("down", "2,4 6,8 10,4"), ("up", "2,8 6,4 10,8")):
            f = d / f"{name}.svg"
            if not f.exists():
                f.write_text('<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12">'
                             f'<polyline points="{pts}" fill="none" stroke="#8a94a6" stroke-width="1.8" '
                             'stroke-linecap="round" stroke-linejoin="round"/></svg>', encoding="utf-8")
    except OSError:
        pass
    return d.as_posix()


_ARW = _arrow_dir()

_QSS_MODERN = """
QPushButton { padding: 7px 16px; border: none; border-radius: 14px; background: palette(button); }
QPushButton:hover { background: palette(midlight); }
QPushButton:pressed { background: palette(mid); }
QPushButton:checked { background: palette(highlight); color: palette(highlighted-text); border-color: palette(highlight); }
QPushButton:focus { border: 2px solid palette(highlight); padding: 5px 14px; }
QPushButton:disabled { color: palette(mid); background: palette(window); }
QToolBar { spacing: 8px; padding: 6px 10px; border: none; background: palette(base); }
QToolBar QLabel { padding: 0 2px; }
QToolBar QToolButton { padding: 6px 12px; border: none; border-radius: 14px; }
QToolBar QToolButton:hover { background: palette(midlight); }
QToolTip { padding: 6px 8px; border: none; border-radius: 6px; }
QTabWidget::pane { border: none; }
QTabBar::tab { padding: 7px 18px; margin: 4px 3px; border: none; border-radius: 15px; background: transparent; }
QTabBar::tab:hover { background: palette(midlight); }
QTabBar::tab:selected { background: palette(highlight); color: palette(highlighted-text); font-weight: 600; }
QLineEdit, QSpinBox, QDoubleSpinBox, QDateEdit, QTimeEdit, QPlainTextEdit, QTextBrowser {
    padding: 4px 8px; border: 1px solid palette(midlight); border-radius: 10px; background: palette(base); }
QLineEdit:focus, QSpinBox:focus, QDoubleSpinBox:focus, QDateEdit:focus, QTimeEdit:focus, QPlainTextEdit:focus {
    border: 1px solid palette(highlight); }
QComboBox { padding: 4px 8px; border: 1px solid palette(midlight); border-radius: 10px; background: palette(base); }
QComboBox:hover, QComboBox:focus { border-color: palette(highlight); }
QComboBox::drop-down, QDateEdit::drop-down { subcontrol-origin: padding; subcontrol-position: center right; width: 24px; border: none; background: transparent; }
QComboBox::down-arrow, QDateEdit::down-arrow { image: url(@ARW@/down.svg); width: 12px; height: 12px; }
QSpinBox::up-button, QDoubleSpinBox::up-button, QTimeEdit::up-button { subcontrol-origin: border; subcontrol-position: top right; width: 20px; border: none; background: transparent; }
QSpinBox::down-button, QDoubleSpinBox::down-button, QTimeEdit::down-button { subcontrol-origin: border; subcontrol-position: bottom right; width: 20px; border: none; background: transparent; }
QSpinBox::up-arrow, QDoubleSpinBox::up-arrow, QTimeEdit::up-arrow { image: url(@ARW@/up.svg); width: 10px; height: 10px; }
QSpinBox::down-arrow, QDoubleSpinBox::down-arrow, QTimeEdit::down-arrow { image: url(@ARW@/down.svg); width: 10px; height: 10px; }
QComboBox QAbstractItemView { border: 1px solid palette(mid); selection-background-color: palette(highlight); selection-color: palette(highlighted-text); padding: 4px; }
QCheckBox, QRadioButton { spacing: 8px; padding: 2px 0; }
QMenuBar { padding: 3px 6px; background: palette(base); }
QMenuBar::item { padding: 5px 12px; border-radius: 12px; background: transparent; }
QMenuBar::item:selected { background: palette(alternate-base); }
QMenu { padding: 6px; border: 1px solid palette(midlight); border-radius: 12px; }
QMenu::item { padding: 7px 26px 7px 14px; border-radius: 9px; }
QMenu::item:selected { background: palette(highlight); color: palette(highlighted-text); }
QMenu::separator { height: 1px; background: palette(midlight); margin: 5px 8px; }
QScrollBar:vertical { width: 12px; background: transparent; margin: 0; }
QScrollBar:horizontal { height: 12px; background: transparent; margin: 0; }
QScrollBar::handle:vertical { min-height: 36px; margin: 2px; border-radius: 4px; background: palette(mid); }
QScrollBar::handle:horizontal { min-width: 36px; margin: 2px; border-radius: 4px; background: palette(mid); }
QScrollBar::handle:hover { background: palette(highlight); }
QScrollBar::add-line, QScrollBar::sub-line { width: 0; height: 0; }
QScrollBar::add-page, QScrollBar::sub-page { background: transparent; }
QTableWidget, QTableView { border: none; border-radius: 12px; gridline-color: palette(midlight); }
QStatusBar { border-top: 1px solid palette(midlight); }
QStatusBar::item { border: none; }
QDialog { background: palette(window); }
QDialogButtonBox QPushButton { min-width: 84px; }
QProgressBar { border: 1px solid palette(mid); border-radius: 6px; text-align: center; }
""".replace("@ARW@", _ARW)


def _compact(q):
    for a, b in (("padding: 7px 16px", "padding: 3px 10px"), ("padding: 5px 14px", "padding: 1px 8px"),
                 ("padding: 6px 10px; border: none; background", "padding: 2px 6px; border: none; background"),
                 ("padding: 6px 12px; border: none", "padding: 3px 8px; border: none"),
                 ("padding: 7px 18px; margin: 4px 3px", "padding: 3px 12px; margin: 2px 2px"),
                 ("padding: 7px 26px 7px 14px", "padding: 3px 22px 3px 10px"),
                 ("padding: 4px 8px; border: 1px", "padding: 1px 6px; border: 1px"),
                 ("padding: 5px 12px; border-radius: 12px", "padding: 2px 8px; border-radius: 10px"),
                 ("padding: 3px 6px; background: palette(base)", "padding: 1px 4px; background: palette(base)")):
        q = q.replace(a, b)
    return q


_QSS_CLAUDE = """
* { font-family: "Segoe UI", "Inter", "Helvetica Neue", sans-serif; }
QPushButton { padding: 7px 16px; border: 1px solid palette(mid); border-radius: 9px; background: palette(button); }
QPushButton:hover { background: palette(midlight); }
QPushButton:pressed { background: palette(mid); }
QPushButton:checked { background: palette(highlight); color: palette(highlighted-text); border-color: palette(highlight); }
QPushButton:focus { border: 1px solid palette(highlight); }
QPushButton:disabled { color: palette(mid); background: palette(window); border-color: palette(midlight); }
QToolBar { spacing: 8px; padding: 6px 10px; border: none; border-bottom: 1px solid palette(midlight); background: palette(window); }
QToolBar QToolButton { padding: 6px 12px; border: 1px solid transparent; border-radius: 9px; }
QToolBar QToolButton:hover { background: palette(midlight); }
QMenuBar { padding: 3px 6px; background: palette(window); border-bottom: 1px solid palette(midlight); }
QMenuBar::item { padding: 5px 12px; border-radius: 8px; background: transparent; }
QMenuBar::item:selected { background: palette(midlight); }
QMenu { padding: 6px; border: 1px solid palette(mid); border-radius: 12px; background: palette(base); }
QMenu::item { padding: 7px 26px 7px 14px; border-radius: 8px; }
QMenu::item:selected { background: palette(midlight); color: palette(text); }
QMenu::separator { height: 1px; background: palette(midlight); margin: 5px 8px; }
QToolTip { padding: 6px 8px; border: none; border-radius: 8px; }
QTabWidget::pane { border: none; border-top: 1px solid palette(midlight); }
QTabBar::tab { padding: 8px 16px; margin: 0 2px; border: none; border-bottom: 2px solid transparent; background: transparent;
    font-family: Georgia, "Times New Roman", serif; font-size: 11pt; }
QTabBar::tab:hover { color: palette(highlight); }
QTabBar::tab:selected { border-bottom: 2px solid palette(highlight); color: palette(text); font-weight: 600; }
QLineEdit, QSpinBox, QDoubleSpinBox, QDateEdit, QTimeEdit, QPlainTextEdit, QTextBrowser, QComboBox {
    padding: 5px 9px; border: 1px solid palette(mid); border-radius: 9px; background: palette(base); }
QLineEdit:focus, QSpinBox:focus, QDoubleSpinBox:focus, QDateEdit:focus, QTimeEdit:focus, QPlainTextEdit:focus, QComboBox:focus { border: 1px solid palette(highlight); }
QComboBox:hover { border-color: palette(highlight); }
QComboBox::drop-down, QDateEdit::drop-down { subcontrol-origin: padding; subcontrol-position: center right; width: 24px; border: none; background: transparent; }
QComboBox::down-arrow, QDateEdit::down-arrow { image: url(@ARW@/down.svg); width: 12px; height: 12px; }
QSpinBox::up-button, QDoubleSpinBox::up-button, QTimeEdit::up-button { subcontrol-origin: border; subcontrol-position: top right; width: 20px; border: none; background: transparent; }
QSpinBox::down-button, QDoubleSpinBox::down-button, QTimeEdit::down-button { subcontrol-origin: border; subcontrol-position: bottom right; width: 20px; border: none; background: transparent; }
QSpinBox::up-arrow, QDoubleSpinBox::up-arrow, QTimeEdit::up-arrow { image: url(@ARW@/up.svg); width: 10px; height: 10px; }
QSpinBox::down-arrow, QDoubleSpinBox::down-arrow, QTimeEdit::down-arrow { image: url(@ARW@/down.svg); width: 10px; height: 10px; }
QComboBox QAbstractItemView { border: 1px solid palette(mid); selection-background-color: palette(midlight); selection-color: palette(text); padding: 4px; }
QCheckBox, QRadioButton { spacing: 8px; padding: 2px 0; }
QScrollBar:vertical { width: 12px; background: transparent; margin: 0; }
QScrollBar:horizontal { height: 12px; background: transparent; margin: 0; }
QScrollBar::handle:vertical { min-height: 36px; margin: 2px; border-radius: 4px; background: palette(mid); }
QScrollBar::handle:horizontal { min-width: 36px; margin: 2px; border-radius: 4px; background: palette(mid); }
QScrollBar::handle:hover { background: palette(highlight); }
QScrollBar::add-line, QScrollBar::sub-line { width: 0; height: 0; }
QScrollBar::add-page, QScrollBar::sub-page { background: transparent; }
QTableWidget, QTableView { border: 1px solid palette(midlight); border-radius: 10px; gridline-color: palette(midlight); }
QGroupBox { border: 1px solid palette(mid); border-radius: 10px; margin-top: 10px; padding-top: 8px; }
QGroupBox::title { subcontrol-origin: margin; left: 10px; padding: 0 4px; font-family: Georgia, "Times New Roman", serif; }
QStatusBar { border-top: 1px solid palette(midlight); }
QStatusBar::item { border: none; }
QDialog { background: palette(window); }
QDialogButtonBox QPushButton { min-width: 84px; }
QProgressBar { border: 1px solid palette(mid); border-radius: 8px; text-align: center; }
""".replace("@ARW@", _ARW)

_QSS_CLASSIC = """
QToolBar { spacing: 4px; padding: 2px; }
QTabBar::tab { padding: 6px 14px; }
QDialogButtonBox QPushButton { min-width: 84px; }
QComboBox QAbstractItemView { selection-background-color: palette(highlight); selection-color: palette(highlighted-text); }
"""

_QSS_CLASSIC_COMPACT = """
QPushButton { padding: 2px 8px; }
QToolBar { spacing: 2px; padding: 0px; }
QToolBar QToolButton { padding: 2px 6px; }
QTabBar::tab { padding: 3px 10px; }
QMenu::item { padding: 3px 20px 3px 8px; }
QMenu::item:selected { background: palette(highlight); color: palette(highlighted-text); }
QMenu::item:disabled { color: palette(mid); }
QDialogButtonBox QPushButton { min-width: 70px; }
"""

_QSS_AERO = """
QPushButton, QToolBar QToolButton { padding: 5px 14px; border: 1px solid palette(mid); border-radius: 3px;
    background: qlineargradient(x1:0,y1:0,x2:0,y2:1, stop:0 palette(light), stop:0.48 palette(button), stop:0.52 palette(midlight), stop:1 palette(mid)); }
QPushButton:hover, QToolBar QToolButton:hover { border-color: palette(highlight);
    background: qlineargradient(x1:0,y1:0,x2:0,y2:1, stop:0 palette(light), stop:0.48 palette(highlight), stop:0.52 palette(highlight), stop:1 palette(light)); color: palette(highlighted-text); }
QPushButton:pressed { background: palette(highlight); color: palette(highlighted-text); }
QPushButton:checked { background: qlineargradient(x1:0,y1:0,x2:0,y2:1, stop:0 palette(mid), stop:1 palette(highlight)); color: palette(highlighted-text); border-color: palette(highlight); }
QPushButton:focus { border: 1px solid palette(highlight); }
QPushButton:disabled { color: palette(mid); background: palette(window); }
QToolBar { spacing: 6px; padding: 3px 6px; border: none; border-bottom: 1px solid palette(mid);
    background: qlineargradient(x1:0,y1:0,x2:0,y2:1, stop:0 palette(light), stop:1 palette(midlight)); }
QMenuBar { padding: 1px 4px; border-bottom: 1px solid palette(mid);
    background: qlineargradient(x1:0,y1:0,x2:0,y2:1, stop:0 palette(light), stop:1 palette(midlight)); }
QMenuBar::item { padding: 4px 10px; border: 1px solid transparent; border-radius: 3px; background: transparent; }
QMenuBar::item:selected { border-color: palette(mid); background: palette(base); }
QMenu { padding: 2px; border: 1px solid palette(mid); background: palette(base); }
QMenu::item { padding: 5px 26px 5px 22px; border: 1px solid transparent; border-radius: 3px; }
QMenu::item:selected { border-color: palette(highlight); background: palette(midlight); color: palette(text); }
QMenu::separator { height: 1px; background: palette(midlight); margin: 3px 4px; }
QTabWidget::pane { border: 1px solid palette(mid); top: -1px; }
QTabBar::tab { padding: 6px 16px; margin-right: 1px; border: 1px solid palette(mid); border-bottom: none; border-top-left-radius: 4px; border-top-right-radius: 4px;
    background: qlineargradient(x1:0,y1:0,x2:0,y2:1, stop:0 palette(light), stop:1 palette(midlight)); }
QTabBar::tab:hover { background: palette(base); border-color: palette(highlight); }
QTabBar::tab:selected { background: palette(base); font-weight: 600; border-top: 2px solid palette(highlight); }
QLineEdit, QSpinBox, QDoubleSpinBox, QDateEdit, QTimeEdit, QPlainTextEdit, QTextBrowser, QComboBox {
    padding: 3px 6px; border: 1px solid palette(mid); border-radius: 3px; background: palette(base); }
QLineEdit:focus, QSpinBox:focus, QDoubleSpinBox:focus, QDateEdit:focus, QTimeEdit:focus, QComboBox:focus, QComboBox:hover { border-color: palette(highlight); }
QComboBox::drop-down, QDateEdit::drop-down { subcontrol-origin: padding; subcontrol-position: center right; width: 22px; border: none; background: transparent; }
QComboBox::down-arrow, QDateEdit::down-arrow { image: url(@ARW@/down.svg); width: 12px; height: 12px; }
QSpinBox::up-button, QDoubleSpinBox::up-button, QTimeEdit::up-button { subcontrol-origin: border; subcontrol-position: top right; width: 18px; border: none; background: transparent; }
QSpinBox::down-button, QDoubleSpinBox::down-button, QTimeEdit::down-button { subcontrol-origin: border; subcontrol-position: bottom right; width: 18px; border: none; background: transparent; }
QSpinBox::up-arrow, QDoubleSpinBox::up-arrow, QTimeEdit::up-arrow { image: url(@ARW@/up.svg); width: 10px; height: 10px; }
QSpinBox::down-arrow, QDoubleSpinBox::down-arrow, QTimeEdit::down-arrow { image: url(@ARW@/down.svg); width: 10px; height: 10px; }
QComboBox QAbstractItemView { border: 1px solid palette(mid); selection-background-color: palette(highlight); selection-color: palette(highlighted-text); }
QScrollBar:vertical { width: 16px; background: palette(midlight); margin: 0; }
QScrollBar:horizontal { height: 16px; background: palette(midlight); margin: 0; }
QScrollBar::handle:vertical { min-height: 30px; margin: 1px; border: 1px solid palette(mid); border-radius: 3px; background: palette(button); }
QScrollBar::handle:horizontal { min-width: 30px; margin: 1px; border: 1px solid palette(mid); border-radius: 3px; background: palette(button); }
QScrollBar::handle:hover { background: palette(highlight); }
QScrollBar::add-line, QScrollBar::sub-line { width: 0; height: 0; }
QTableWidget, QTableView { border: 1px solid palette(mid); gridline-color: palette(midlight); }
QStatusBar { border-top: 1px solid palette(mid); background: qlineargradient(x1:0,y1:0,x2:0,y2:1, stop:0 palette(midlight), stop:1 palette(window)); }
QStatusBar::item { border: none; }
QToolTip { padding: 4px 6px; border: 1px solid palette(mid); }
QDialog { background: palette(window); }
QDialogButtonBox QPushButton { min-width: 84px; }
QProgressBar { border: 1px solid palette(mid); border-radius: 3px; text-align: center; }
""".replace("@ARW@", _ARW)

_QSS_BREEZE = """
QPushButton { padding: 5px 14px; border: 1px solid palette(mid); border-radius: 3px; background: palette(button); }
QPushButton:hover { border-color: palette(highlight); background: palette(alternate-base); }
QPushButton:pressed { background: palette(midlight); }
QPushButton:checked { background: palette(highlight); color: palette(highlighted-text); border-color: palette(highlight); }
QPushButton:focus { border: 1px solid palette(highlight); }
QPushButton:disabled { color: palette(mid); background: palette(window); }
QToolBar { spacing: 4px; padding: 3px 6px; border: none; border-bottom: 1px solid palette(midlight); background: palette(window); }
QToolBar QToolButton { padding: 4px 8px; border: 1px solid transparent; border-radius: 3px; }
QToolBar QToolButton:hover { border-color: palette(highlight); background: palette(alternate-base); }
QMenuBar { background: palette(window); border-bottom: 1px solid palette(midlight); }
QMenuBar::item { padding: 4px 10px; border-radius: 3px; background: transparent; }
QMenuBar::item:selected { background: palette(highlight); color: palette(highlighted-text); }
QMenu { padding: 3px; border: 1px solid palette(mid); background: palette(base); }
QMenu::item { padding: 5px 24px 5px 12px; border-radius: 3px; }
QMenu::item:selected { background: palette(highlight); color: palette(highlighted-text); }
QMenu::separator { height: 1px; background: palette(midlight); margin: 3px 4px; }
QTabWidget::pane { border: 1px solid palette(mid); top: -1px; }
QTabBar::tab { padding: 6px 16px; margin-right: 1px; border: 1px solid transparent; border-bottom: 2px solid transparent; background: transparent; }
QTabBar::tab:hover { border-bottom: 2px solid palette(mid); }
QTabBar::tab:selected { border-bottom: 2px solid palette(highlight); font-weight: 600; }
QLineEdit, QSpinBox, QDoubleSpinBox, QDateEdit, QTimeEdit, QPlainTextEdit, QTextBrowser, QComboBox {
    padding: 3px 6px; border: 1px solid palette(mid); border-radius: 3px; background: palette(base); }
QLineEdit:focus, QSpinBox:focus, QDoubleSpinBox:focus, QDateEdit:focus, QTimeEdit:focus, QComboBox:focus { border: 1px solid palette(highlight); }
QComboBox::drop-down, QDateEdit::drop-down { subcontrol-origin: padding; subcontrol-position: center right; width: 22px; border: none; background: transparent; }
QComboBox::down-arrow, QDateEdit::down-arrow { image: url(@ARW@/down.svg); width: 12px; height: 12px; }
QSpinBox::up-button, QDoubleSpinBox::up-button, QTimeEdit::up-button { subcontrol-origin: border; subcontrol-position: top right; width: 18px; border: none; background: transparent; }
QSpinBox::down-button, QDoubleSpinBox::down-button, QTimeEdit::down-button { subcontrol-origin: border; subcontrol-position: bottom right; width: 18px; border: none; background: transparent; }
QSpinBox::up-arrow, QDoubleSpinBox::up-arrow, QTimeEdit::up-arrow { image: url(@ARW@/up.svg); width: 10px; height: 10px; }
QSpinBox::down-arrow, QDoubleSpinBox::down-arrow, QTimeEdit::down-arrow { image: url(@ARW@/down.svg); width: 10px; height: 10px; }
QScrollBar:vertical { width: 10px; background: transparent; margin: 0; }
QScrollBar:horizontal { height: 10px; background: transparent; margin: 0; }
QScrollBar::handle:vertical { min-height: 30px; margin: 2px; border-radius: 3px; background: palette(mid); }
QScrollBar::handle:horizontal { min-width: 30px; margin: 2px; border-radius: 3px; background: palette(mid); }
QScrollBar::handle:hover { background: palette(highlight); }
QScrollBar::add-line, QScrollBar::sub-line { width: 0; height: 0; }
QScrollBar::add-page, QScrollBar::sub-page { background: transparent; }
QTableWidget, QTableView { border: 1px solid palette(mid); gridline-color: palette(midlight); }
QStatusBar { border-top: 1px solid palette(midlight); }
QStatusBar::item { border: none; }
QDialogButtonBox QPushButton { min-width: 84px; }
""".replace("@ARW@", _ARW)

_QSS_CARDS = _QSS_MODERN.replace("border-radius: 14px", "border-radius: 8px").replace("border-radius: 15px", "border-radius: 8px") + """
QPushButton { border: 1px solid palette(midlight); background: palette(base); }
QPushButton:checked { border: 1px solid palette(highlight); }
QHeaderView::section { background: palette(alternate-base); color: palette(text); border: none; border-bottom: 1px solid palette(midlight);
    padding: 6px 4px; font-weight: 600; }
QTableWidget, QTableView { border: 1px solid palette(midlight); border-radius: 10px; background: palette(base); alternate-background-color: palette(alternate-base); }
QToolBar { border-bottom: 1px solid palette(midlight); }
QGroupBox { border: 1px solid palette(midlight); border-radius: 10px; margin-top: 12px; padding-top: 8px; }
QGroupBox::title { subcontrol-origin: margin; left: 12px; padding: 0 4px; }
"""

# Uslublar: kalit → (nomi, QSS, jadval qatori balandligi koeffitsienti)
STYLES = {
    "klassik": ("Klassik", _QSS_CLASSIC, 1.0),
    "klassik_k": ("Klassik kompakt", _QSS_CLASSIC_COMPACT, 0.8),
    "zamonaviy": ("Zamonaviy", _QSS_MODERN, 1.0),
    "zamonaviy_k": ("Zamonaviy kompakt", _compact(_QSS_MODERN), 0.8),
    "aero": ("Windows 7 Aero", _QSS_AERO, 1.0),
    "claude": ("Claude", _QSS_CLAUDE, 1.0),
    "kartalar": ("Kartalar (yumshoq burchakli, ramkali)", _QSS_CARDS, 1.05),
    "breeze": ("KDE Breeze", _QSS_BREEZE, 1.0),
    "fusion": ("Fusion (Qt)", "", 1.0),
}
_ROW_SCALE = [1.0]


def RH():
    """Jadval qatori balandligi (uslubga qarab)."""
    return S(30 * _ROW_SCALE[0])


# Menyu bandlarida belgi (✓ / ●) ko'rinib turishi uchun: QSS bilan bezalgan menyuda tizim belgisi yo'qoladi
_QSS_MENU_FIX = """
QMenu::item { padding-left: 30px; }
QMenu::item:!checkable { padding-left: 14px; }
QMenu::icon { padding-left: 6px; }
QMenu::indicator { width: 14px; height: 14px; left: 8px; }
QMenu::indicator:non-exclusive:checked, QMenu::indicator:exclusive:checked { image: url(@ARW@/check.svg); }
QMenu::indicator:exclusive:checked { image: url(@ARW@/dot.svg); }
QMenu::indicator:non-exclusive:unchecked, QMenu::indicator:exclusive:unchecked { image: none; }
""".replace("@ARW@", _ARW)


def app_qss(key=None):
    k = key if key in STYLES else "zamonaviy"
    _ROW_SCALE[0] = STYLES[k][2]
    q = STYLES[k][1]
    return (q + _QSS_MENU_FIX) if q else q


def qt_style_name(key):
    """KDE Breeze o'rnatilgan bo'lsa — haqiqiysi, bo'lmasa Fusion + Breeze'ga o'xshash QSS. Qolganlari — Fusion."""
    from PySide6.QtWidgets import QStyleFactory
    if key == "breeze":
        for n in QStyleFactory.keys():
            if n.lower() == "breeze":
                return n
    return "Fusion"


def set_app_style(key, store_theme=None):
    """Qt vidjet uslubini + QSS ni qo'llaydi (palitra qayta o'rnatiladi)."""
    app = QApplication.instance()
    name = qt_style_name(key)
    app.setStyle(name)
    if store_theme is not None:
        app.setPalette(make_palette(store_theme))
    # haqiqiy Breeze o'zi chizadi — QSS kerak emas
    app.setStyleSheet("" if (key == "breeze" and name.lower() == "breeze") else app_qss(key))
    if key == "breeze" and name.lower() == "breeze":
        _ROW_SCALE[0] = 1.0


APP_QSS = _QSS_MODERN       # eski nom (moslik uchun)


def store_settings(store):
    return store.data["settings"]


def fit_to_screen(widget, w, h, center=True):
    """Oynani kerakli o'lchamga keltiradi (masshtabga qarab), lekin ekranning ish maydonidan (panellarsiz) kattaroq qilmaydi."""
    scr = widget.screen() if widget.screen() else QGuiApplication.primaryScreen()
    avail = scr.availableGeometry()
    ww, hh = min(S(w), int(avail.width() * 0.97)), min(S(h), int(avail.height() * 0.93))
    widget.resize(ww, hh)
    if center:
        widget.move(avail.x() + (avail.width() - ww) // 2, avail.y() + max(0, (avail.height() - hh) // 2))


@contextmanager
def blocked(widget):
    old = widget.blockSignals(True)
    try:
        yield
    finally:
        widget.blockSignals(old)


# ───────────────── xatolar: tushunarli xabarlar, fon oqimi ─────────────────
def friendly_error(e):
    """Istisnoni foydalanuvchiga tushunarli o'zbekcha matnga aylantiradi: (xabar, maslahat)."""
    import errno
    import json as _json
    import traceback as _tb
    name = type(e).__name__
    if isinstance(e, PermissionError):
        return ("Faylga yozib (o'qib) bo'lmadi: ruxsat yo'q yoki fayl boshqa dasturda ochiq.",
                "Excel yoki PDF ko'rgichda ochiq turgan faylni yoping, so'ng qayta urinib ko'ring yoki boshqa nom/papka tanlang.")
    if isinstance(e, FileNotFoundError):
        return ("Fayl yoki papka topilmadi.", "Fayl ko'chirilgan yoki o'chirilgan bo'lishi mumkin. Joyini qayta tanlang.")
    if isinstance(e, OSError) and getattr(e, "errno", None) == errno.ENOSPC:
        return ("Diskda bo'sh joy qolmagan.", "Joy bo'shatib qayta urinib ko'ring yoki boshqa diskni tanlang.")
    if isinstance(e, OSError):
        return (f"Faylni o'qish/yozishda xato: {e.strerror or e}", "Fayl yo'lini va diskni tekshiring.")
    if isinstance(e, _json.JSONDecodeError) or isinstance(e, UnicodeDecodeError):
        return ("Ma'lumot fayli buzilgan yoki noto'g'ri formatda.", "Zaxira nusxadan tiklang (Fayl → Zaxira nusxalar).")
    if name in ("BadZipFile", "XLRDError", "InvalidFileException") or "not a zip" in str(e).lower() or "Unsupported format" in str(e) or "cannot be determined" in str(e):
        return ("Fayl buzilgan yoki kutilgan Excel/ODS formatida emas.",
                "emaktabdan «Fan jurnali»ni qayta yuklab oling va to'g'ridan-to'g'ri (.xls/.xlsx) shu faylni tanlang.")
    if isinstance(e, ImportError):
        mod = getattr(e, "name", None) or "kerakli kutubxona"
        return (f"«{mod}» kutubxonasi o'rnatilmagan.",
                f"Buyruq satrida bajaring: pip install {'openpyxl' if mod == 'openpyxl' else 'pandas xlrd odfpy openpyxl'}")
    if isinstance(e, MemoryError):
        return ("Xotira yetmadi.", "Boshqa dasturlarni yoping yoki faylni kichikroq qismlarga bo'ling.")
    if isinstance(e, ValueError) and e.args and isinstance(e.args[0], str) and re.search(r"[a-z']{3,}", e.args[0]) and not str(e).startswith("("):
        return (str(e), "")                              # dasturning o'z xabarlari allaqachon tushunarli
    return (f"Kutilmagan xatolik: {name}: {e}", "Ma'lumotlaringiz saqlangan. Muammo takrorlansa, quyidagi «Batafsil» matnini yuboring.")


def log_error(e):
    """Xatoni xatolar.log fayliga yozadi (dastur papkasida); matnni qaytaradi."""
    import traceback as _tb
    text = "".join(_tb.format_exception(type(e), e, e.__traceback__))
    try:
        with open(BASE / "xatolar.log", "a", encoding="utf-8") as f:
            f.write(f"--- {dt.datetime.now():%Y-%m-%d %H:%M:%S}\n{text}\n")
    except OSError:
        pass
    return text


def show_error(parent, title, e, what=""):
    """Tushunarli xabar + «Batafsil» (texnik matn). what — qaysi amal bajarilayotgani edi."""
    msg, hint = friendly_error(e)
    detail = log_error(e)
    box = QMessageBox(parent)
    box.setIcon(QMessageBox.Icon.Critical)
    box.setWindowTitle(title)
    box.setText((what + "\n\n" if what else "") + msg)
    if hint:
        box.setInformativeText(hint)
    box.setDetailedText(detail)
    box.exec()


class _BgWorker(QThread):
    done = Signal(object)
    failed = Signal(object)

    def __init__(self, fn):
        super().__init__()
        self.fn = fn

    def run(self):
        try:
            self.done.emit(self.fn())
        except Exception as e:  # noqa: BLE001
            self.failed.emit(e)


def run_bg(parent, title, fn, on_done, text="Bajarilmoqda… iltimos, kuting.", on_fail=None):
    """fn() ni alohida oqimda bajaradi (oyna qotmaydi); tugagach on_done(natija) asosiy oqimda chaqiriladi.
    Xato bo'lsa — tushunarli xabar ko'rsatiladi. fn ichida oynalar (QWidget) bilan ishlash mumkin emas."""
    dlg = QProgressDialog(text, None, 0, 0, parent)
    dlg.setWindowTitle(title)
    dlg.setWindowModality(Qt.WindowModality.WindowModal)
    dlg.setMinimumDuration(400)                      # tez tugasa — oyna ko'rinmaydi
    dlg.setCancelButton(None)
    dlg.setAutoClose(False)
    dlg.setAutoReset(False)
    w = _BgWorker(fn)
    keep = getattr(parent, "_bg_jobs", None)
    if keep is None:
        keep = parent._bg_jobs = []
    keep.append((w, dlg))

    def finish():
        dlg.close()
        dlg.deleteLater()
        if (w, dlg) in keep:
            keep.remove((w, dlg))
        w.deleteLater()

    def ok(res):
        finish()
        on_done(res)

    def bad(e):
        finish()
        if on_fail:
            on_fail(e)
        else:
            show_error(parent, title, e)
    w.done.connect(ok)
    w.failed.connect(bad)
    w.start()
    return w


def install_excepthook():
    """Kutilmagan xatolar jim yopilmasin: tushunarli oyna chiqadi va xatolar.log ga yoziladi."""
    def hook(tp, e, tb):
        e.__traceback__ = tb
        try:
            if QApplication.instance():
                show_error(QApplication.activeWindow(), "Kutilmagan xato", e)
                return
        except Exception:  # noqa: BLE001
            pass
        sys.__excepthook__(tp, e, tb)
    sys.excepthook = hook


def natural_key(name):
    m = re.match(r"(\d+)-(.*)", name)
    return (int(m.group(1)), m.group(2)) if m else (999, name)


def cls_label(cls):
    """Sinf + fan: «6-A · Matematika» (fan belgilanmagan bo'lsa — faqat «6-A»)."""
    s = cls.get("subject", "")
    return f"{cls['name']} · {s}" if s else cls["name"]


def class_sort_key(c):
    return (natural_key(c["name"]), c.get("subject", "").casefold())


DEFAULT_SUBJECTS = ("Matematika", "Algebra", "Geometriya", "Informatika")
NO_SUBJECT = "__none__"          # fan filtri: «fansiz sinflar»


# ───────────────────────────── ODS import ─────────────────────────────
def ods_import(path):
    """ODS fayldagi sinf varaqlarini (masalan '9-A') o'qiydi."""
    import pandas as pd

    sheets = pd.read_excel(path, engine="odf", sheet_name=None, header=None)
    classes = []
    for name, df in sheets.items():
        name = str(name).strip()
        if not re.fullmatch(r"\d{1,2}-\S", name) or df.shape[0] < 2 or df.shape[1] < 3:
            continue
        dates = {}
        for c in range(2, df.shape[1]):
            d = pd.to_datetime(df.iat[0, c], errors="coerce")
            if pd.notna(d):
                dates[c] = d.date().isoformat()
        students = []
        for r in range(1, df.shape[0]):
            nm = df.iat[r, 1]
            if pd.isna(nm) or not str(nm).strip():
                continue
            marks = {}
            for c, d in dates.items():
                v = df.iat[r, c]
                if pd.isna(v):
                    continue
                if isinstance(v, (int, float)):
                    v = int(round(v))
                raw = str(v).strip().lower()
                # jadvaldagi eski belgilar: n = kelmadi (sababsiz), s = sababli
                m = {"n": "s", "s": "dq"}.get(raw) or norm_mark(v)
                if m:
                    marks[d] = m
            students.append({"name": str(nm).strip(), "marks": marks})
        classes.append({"name": name, "dates": sorted(dates.values()), "students": students})
    classes.sort(key=class_sort_key)
    return classes


# ───────────────────── emaktab «Fan jurnali» (.xls / .xlsx) importi ─────────────────────
UZ_MONTHS = {"yanvar": 1, "fevral": 2, "mart": 3, "aprel": 4, "may": 5, "iyun": 6,
             "iyul": 7, "avgust": 8, "sentabr": 9, "oktabr": 10, "noyabr": 11, "dekabr": 12,
             # ruscha emaktab eksporti
             "январь": 1, "февраль": 2, "март": 3, "апрель": 4, "май": 5, "июнь": 6,
             "июль": 7, "август": 8, "сентябрь": 9, "октябрь": 10, "ноябрь": 11, "декабрь": 12}


SCALE5 = ((86, 5), (66, 4), (30, 3))          # emaktab: 100–86 → 5, 85–66 → 4, 65–30 → 3, qolgani → 2
BSB_TOTAL, CHSB_TOTAL, FB_TOTAL = 50, 40, 10   # chorak balli (100): BSB 50 + CHSB 40 + formativ 10


def grade5(total):
    for lo, g in SCALE5:
        if total >= lo:
            return g
    return 2


def fmt_num(v):
    return f"{v:g}" if isinstance(v, float) else str(v)


def fmt_date(iso):
    return f"{iso[8:]}.{iso[5:7]}.{iso[:4]}"


def parse_score(text):
    """Summativ ball: son (1 xona kasr) | S / DQ / K / KQ belgisi | bo'sh; noto'g'ri bo'lsa None."""
    t = str(text).strip().lower().replace(",", ".")
    if t == "":
        return ""
    if t in ATT_MARKS or t == CH_MARK:
        return t
    try:
        v = round(float(t), 1)
    except ValueError:
        return None
    if v != v or v < 0 or v > 1000:
        return None
    return int(v) if v == int(v) else v


def norm_name(name):
    """O'quvchi ismini solishtirish uchun: kichik harf, bir xil apostrof, bitta bo'shliq."""
    t = unicodedata.normalize("NFKC", str(name)).lower()
    t = re.sub(r"[‘’ʻʼ`´′]", "'", t)
    return re.sub(r"\s+", " ", t).strip()


def _num(v):
    """Raqam bo'lsa float, aks holda None (bo'sh / NaN / matn)."""
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return None if v != v else float(v)
    try:
        return float(str(v).strip().replace(",", "."))
    except ValueError:
        return None


def _emaktab_mark(v):
    """(belgi, noma'lum_qiymat): belgi — '1'..'10' | 's' | 'dq' | None."""
    if v is None or (isinstance(v, float) and v != v):
        return None, None
    if isinstance(v, str):
        t = v.strip().lower()
        if t == "":
            return None, None
        if t in ATT_MARKS or t == CH_MARK:
            return t, None
        alias = {"n": "s", "н": "s", "б": "k", "п": "dq", "о": "kq"}.get(t)   # ruscha: н — sababsiz, п — sababli (propusk), б — kasal, о — kech qoldi
        if alias:
            return alias, None
        comp = norm_mark(t)                      # «10kq», «kq 8», «8/kq» kabi baho + kech qolish
        if comp and ((late_of(comp) and len(comp) > 2) or len(grades_of(comp)) == 2):
            return comp, None
        n = _num(t)
        if n is None:
            return None, t
    else:
        n = _num(v)
    if n is not None and n == int(n) and 1 <= int(n) <= 10:
        return str(int(n)), None
    return None, str(v)


SUBJECT_LABEL = re.compile(r"^(?:fan(?:\s*nomi)?|предмет|дисциплина|subject)\s*[:：\-–—]?\s*(.*)$", re.I)


RU_SUBJECTS = (("информатик", "Informatika"), ("алгебр", "Algebra"), ("геометри", "Geometriya"), ("математик", "Matematika"),
               ("узбекск", "Ona tili"), ("родной язык", "Ona tili"), ("русск", "Rus tili"), ("английск", "Ingliz tili"),
               ("физик", "Fizika"), ("хими", "Kimyo"), ("биологи", "Biologiya"), ("истори", "Tarix"), ("географи", "Geografiya"))


def clean_subject(t):
    t = re.sub(r"\s+", " ", str(t or "")).strip(" \t:;-–—,.\"'«»")
    for stem, uz in RU_SUBJECTS:                    # ruscha fan nomi → o'zbekcha (Информатика и ИКТ → Informatika)
        if t.casefold().startswith(stem):
            return uz
    return t[:60]


def detect_subject(text, nr, nc, r0, r1, sheet_name=""):
    """Import varag'idan fan nomini aniqlaydi: «Fan: Algebra» (istalgan katakda yoki sinf qatorida),
    «Fan» yozuvidan keyingi katak; topilmasa — varaq nomidagi ma'lum fan. Topilmasa ''."""
    for r in range(r0, min(r1, r0 + 12)):
        for c in range(min(nc, 12)):
            t = text(r, c)
            if not t:
                continue
            m = SUBJECT_LABEL.match(t)
            if m:
                v = clean_subject(m.group(1))
                if not v:                                   # «Fan:» alohida katakda — qiymat yonidagi katakda
                    v = next((clean_subject(text(r, k)) for k in range(c + 1, min(nc, c + 6)) if text(r, k)), "")
                if v:
                    return v
            m = re.search(r"(?:^|[\s,;])(?:fan|предмет)\s*[:：]\s*([^,;|]+)", t, re.I)   # «Sinf: 9-A  Fan: Algebra»
            if m and clean_subject(m.group(1)):
                return clean_subject(m.group(1))
    known = {x.casefold(): x for x in DEFAULT_SUBJECTS}
    for w in re.split(r"[\s_,;()\-–]+", str(sheet_name)):
        if w.casefold() in known:
            return known[w.casefold()]
    return ""


def _emaktab_sheet(df, sheet_name=""):
    nr, nc = df.shape

    def cell(r, c):
        v = df.iat[r, c]
        return None if (isinstance(v, float) and v != v) else v

    def text(r, c):
        v = cell(r, c)
        return "" if v is None else str(v).strip()

    starts = [r for r in range(nr) if re.match(r"^(?:Sinf|Класс)\s*:", text(r, 0), re.I)]
    out = []
    for i, r0 in enumerate(starts):
        r_end = starts[i + 1] if i + 1 < len(starts) else nr
        m = re.match(r"^(?:Sinf|Класс)\s*:\s*(\S+)(?:\s+(\d{4})\s*/\s*(\d{4}))?", text(r0, 0), re.I)
        name = m.group(1).strip()
        today = dt.date.today()
        y1 = int(m.group(2)) if m.group(2) else (today.year if today.month >= 9 else today.year - 1)
        y2 = int(m.group(3)) if m.group(3) else y1 + 1
        subject = detect_subject(text, nr, nc, r0, r_end, sheet_name)
        mrow = next((r for r in range(r0 + 1, min(r0 + 20, r_end))
                     if any(text(r, c).lower() in UZ_MONTHS for c in range(2, nc))), None)
        if mrow is None or mrow + 1 >= r_end:
            continue
        drow = mrow + 1                                  # kun raqamlari qatori
        cols, cur = [], None
        for c in range(2, nc):
            lab = text(mrow, c).lower()
            if lab in UZ_MONTHS:
                cur = UZ_MONTHS[lab]
            elif lab:                                    # BSB / FB / Ballar kabi ustunlar — sana emas
                cur = None
            day = _num(cell(drow, c))
            if cur is None or day is None or day != int(day) or not 1 <= day <= 31:
                continue
            try:
                cols.append((c, dt.date(y1 if cur >= 9 else y2, cur, int(day)).isoformat()))
            except ValueError:
                continue
        if not cols:
            continue
        wcols = []                               # summativ ishlar ustunlari: (ustun, tur, sana, maks.)
        for c in range(2, nc):
            typ = text(drow, c).lower()
            md = re.match(r"^(\d{1,2})\.(\d{1,2})$", text(mrow, c))
            mx = _num(cell(drow + 1, c))
            if typ in ("bsb", "chsb") and md and mx:
                dd, mm = int(md.group(1)), int(md.group(2))
                try:
                    wcols.append((c, typ, dt.date(y1 if mm >= 9 else y2, mm, dd).isoformat(),
                                  int(mx) if mx == int(mx) else mx))
                except ValueError:
                    pass
        qnum = next((int(mq.group(1)) for c in range(2, nc)
                     for mq in [re.search(r"(\d)\s*(?:chorak|чтв|четв)", text(mrow, c).lower())] if mq), None)
        skipped, warnings, studs = {}, [], []
        for r in range(drow + 1, r_end):
            if _num(cell(r, 0)) is None or not text(r, 1):
                continue
            marks = {}
            for c, iso in cols:
                mk, unk = _emaktab_mark(cell(r, c))
                if mk:
                    if iso in marks and marks[iso] != mk:
                        skipped["bir kunda 2 ta baho"] = skipped.get("bir kunda 2 ta baho", 0) + 1
                    else:
                        marks.setdefault(iso, mk)
                elif unk:
                    skipped[unk] = skipped.get(unk, 0) + 1
            scores = {}
            for c, typ, iso, _mx in wcols:
                v = cell(r, c)
                if v is None:
                    continue
                n = _num(v)
                if n is not None:
                    scores[f"{typ}|{iso}"] = int(n) if n == int(n) else round(n, 1)
                else:
                    mk, unk = _emaktab_mark(v)
                    if mk in ATT_MARKS or mk == CH_MARK:
                        scores[f"{typ}|{iso}"] = mk
                    elif unk:
                        skipped[unk] = skipped.get(unk, 0) + 1
            studs.append({"name": text(r, 1), "marks": marks, "scores": scores})
        alld = sorted({iso for _, iso in cols} | {iso for _, _t, iso, _m in wcols})
        out.append({"name": name, "subject": subject, "source": "emaktab",
                    "dates": sorted({iso for _, iso in cols}), "students": studs, "skipped": skipped,
                    "works": [{"type": typ, "date": iso, "max": mx, "title": ""} for _c, typ, iso, mx in wcols],
                    "quarter": {"q": qnum, "start": alld[0], "end": alld[-1]} if qnum and 1 <= qnum <= 4 else None})
    return out


def _emk_date(v):
    """emaktab API sanasi (2026-10-16 / 16.10.2026 / 16/10/2026 / ISO vaqt bilan) → 'YYYY-MM-DD' yoki None."""
    t = str(v or "").strip()
    if not t:
        return None
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", t)
    if m:
        y, mo, d = map(int, m.groups())
    else:
        m = re.match(r"^(\d{1,2})[./](\d{1,2})[./](\d{4})", t)
        if not m:
            return None
        d, mo, y = map(int, m.groups())
    try:
        return dt.date(y, mo, d).isoformat()
    except ValueError:
        return None


_EMK_JOURNAL_URL = re.compile(r"/journal/school/(\d+)/group/(\d+)/subject/(\d+)")


def parse_journal_urls(text):
    """Matndagi emaktab jurnal havolalaridan (…/journal/school/S/group/G/subject/X) [{school, group, subject}] ajratadi."""
    out, seen = [], set()
    for m in _EMK_JOURNAL_URL.finditer(text or ""):
        k = m.groups()
        if k not in seen:
            seen.add(k)
            out.append({"school": k[0], "group": k[1], "subject": k[2]})
    return out


_EMK_JS_NAMES = r"""(function(){
  var t=(document.body.innerText||'');
  var m=t.match(/(\d{1,2}\s*-\s*[A-Za-z\u0400-\u04FF]{1,2})\s*,\s*([^\n]{2,40})/);
  return m?(m[1].replace(/\s+/g,'')+'|'+m[2].trim()):'';})()"""

_EMK_JS_QTAB = r"""(function(k){
  function vis(e){var r=e.getBoundingClientRect();return r.width>0&&r.height>0;}
  var all=document.querySelectorAll('a,button,span,div,li,label'),first=null;
  for(var i=0;i<all.length;i++){var e=all[i];if(!vis(e)||e.children.length>1)continue;
    if(/^1\s*chorak$/i.test((e.innerText||'').trim())){first=e;break;}}
  if(!first)return 'no';
  var c=first.parentElement?first.parentElement.children:[];
  for(var j=0;j<c.length;j++){var t=(c[j].innerText||'').trim();
    if(t===String(k)||new RegExp('^'+k+'\\s*chorak$','i').test(t)){c[j].click();return 'ok';}}
  return 'no';})(%d)"""


def emaktab_json_import(data, name, subject="", q=None):
    """emaktab `api/v2/journals/subjectJournal` javobini (to'g'ridan-to'g'ri olingan) import tuzilmasiga aylantiradi —
    Excel importi bilan bir xil format (SyncDialog o'zi solishtiradi). Bo'sh/noto'g'ri javob — None."""
    if not isinstance(data, dict) or not isinstance(data.get("persons"), list) or not data["persons"]:
        return None
    lessons = data.get("lessons") or []
    s_lessons = data.get("summativeLessons") or []
    work_date, lesson_date, dates = {}, {}, set()
    for ls in lessons:
        iso = _emk_date(ls.get("resultDate")) or _emk_date(ls.get("plannedDate"))
        if not iso:
            continue
        dates.add(iso)
        lesson_date[str(ls.get("id"))] = iso
        for w in ls.get("works") or []:
            work_date[str(w.get("id"))] = iso
    works, swork = [], {}
    for ls in s_lessons:
        iso = _emk_date(ls.get("resultDate")) or _emk_date(ls.get("plannedDate"))
        if not iso:
            continue
        for w in ls.get("summativeWorks") or []:
            t = str(w.get("title") or w.get("workName") or "").strip().lower()
            typ = "chsb" if t.startswith("chsb") else "bsb" if t.startswith("bsb") else None
            if typ is None:
                continue
            mx = w.get("maxMarkValue")
            try:
                mx = int(mx) if float(mx) == int(float(mx)) else float(mx)
            except (TypeError, ValueError):
                mx = 0
            swork[str(w.get("id"))] = (typ, iso)
            if not any(x["type"] == typ and x["date"] == iso for x in works):
                works.append({"type": typ, "date": iso, "max": mx, "title": ""})
    skipped, studs = {}, []
    for pe in data["persons"]:
        nm = " ".join(x for x in (str(pe.get("lastName") or "").strip(), str(pe.get("firstName") or "").strip()) if x)
        if not nm:
            continue
        grades, att = {}, {}
        for wid, items in (pe.get("marks") or {}).items():
            iso = work_date.get(str(wid))
            if not iso:
                continue
            for it in items or []:
                raw = it.get("rawValue")
                mk, unk = _emaktab_mark(raw if raw not in (None, "") else it.get("value"))
                if mk and grades_of(mk):
                    g = grades.setdefault(iso, [])
                    if grades_of(mk)[0] not in g and len(g) < 2:
                        g.append(grades_of(mk)[0])
                    elif len(g) >= 2:
                        skipped["bir kunda 3 ta baho"] = skipped.get("bir kunda 3 ta baho", 0) + 1
                elif mk in ATT_MARKS or mk == CH_MARK:
                    att[iso] = mk
                elif unk:
                    skipped[unk] = skipped.get(unk, 0) + 1
        for lid, code in (pe.get("lessonLogEntries") or {}).items():
            iso = lesson_date.get(str(lid))
            c = str(code or "").strip().lower()
            if not iso or not c:
                continue
            if c in ATT_MARKS or c == CH_MARK:
                att[iso] = c
            else:
                skipped[f"davomat «{c}»"] = skipped.get(f"davomat «{c}»", 0) + 1
        marks = {}
        for iso in set(grades) | set(att):
            a, g = att.get(iso, ""), grades.get(iso, [])
            if g:
                marks[iso] = build_mark(g, a == "kq")
            elif a:
                marks[iso] = a
        scores = {}
        for wid, items in (pe.get("summativeMarks") or {}).items():
            tw = swork.get(str(wid))
            if not tw or not items:
                continue
            raw = items[0].get("rawValue")
            if raw in (None, ""):
                raw = items[0].get("value")
            try:
                n = float(str(raw).replace(",", "."))
                scores[f"{tw[0]}|{tw[1]}"] = int(n) if n == int(n) else round(n, 1)
            except ValueError:
                mk, unk = _emaktab_mark(raw)
                if mk in ATT_MARKS or mk == CH_MARK:
                    scores[f"{tw[0]}|{tw[1]}"] = mk
                elif unk:
                    skipped[unk] = skipped.get(unk, 0) + 1
        studs.append({"name": nm, "marks": marks, "scores": scores})
    if not studs or not dates:
        return None
    alld = sorted(dates | {x["date"] for x in works})
    return {"name": str(name), "subject": clean_subject(subject), "source": "emaktab",
            "dates": sorted(dates), "students": studs, "skipped": skipped, "works": works,
            "quarter": {"q": q, "start": alld[0], "end": alld[-1]} if q and 1 <= q <= 4 else None}


def emaktab_import(path):
    """emaktab «Fan jurnali» faylini o'qiydi. Format mos kelmasa — bo'sh ro'yxat."""
    import pandas as pd

    out = []
    for sname, df in pd.read_excel(path, sheet_name=None, header=None).items():
        out.extend(_emaktab_sheet(df, sname))
    return out


def read_import_file(path):
    ext = Path(path).suffix.lower()
    if ext in (".xls", ".xlsx"):
        return emaktab_import(path)
    if ext == ".ods":
        found = []
        try:
            found = emaktab_import(path)
        except Exception:  # noqa: BLE001
            pass
        return found or ods_import(path)
    raise ValueError("Faqat .xls, .xlsx va .ods fayllar qo'llab-quvvatlanadi.")


# ───────────────────────────── ma'lumotlar ombori ─────────────────────────────
class Store:
    def __init__(self, path=DATA_FILE):
        self.path = Path(path)
        self.data = self._load()

    def _load(self, path=None):
        src = Path(path) if path else self.path
        if src.exists():
            with open(src, encoding="utf-8") as f:
                data = json.load(f)
        else:
            data = {"version": 2, "classes": []}
            for ods in sorted(self.path.parent.glob("*.ods")):
                try:
                    data["classes"] = ods_import(ods)
                    break
                except Exception as e:  # noqa: BLE001
                    print("ODS import xatosi:", e)
        st = copy.deepcopy(DEFAULT_SETTINGS)
        saved = data.get("settings", {})
        if "ranges" in saved:
            st["ranges"] = saved["ranges"]
        att = dict(saved.get("attendance", {}))
        if "n" in att:   # eski format: n=kelmadi, s=sababli  →  s=sababsiz, dq=sababli
            att = {"s": att["n"], "dq": att.get("s", st["attendance"]["dq"]), "x": att.get("x", st["attendance"]["x"])}
        st["attendance"].update(att)
        for k in ("method_weekday", "lesson_weekdays", "theme", "style", "custom_theme", "view_mode", "quarters", "fb_min", "subject_filter", "bsb_pdf_style", "pdf_font", "pdf_design", "report_cols", "report_extras", "pdf_new_alpha", "pdf_sort", "ui_zoom", "quick_marks", "layout", "inspector", "side_style"):
            if k in saved:
                st[k] = saved[k]
        st["protect"].update(saved.get("protect", {}))
        sr = dict(saved.get("risk", {}))
        for sub in ("on", "show"):                                  # ichki lug'atlar: eski faylda yo'q kalitlar standart bo'lib qoladi
            st["risk"][sub].update(sr.pop(sub, {}) or {})
        if "on" not in saved.get("risk", {}) and not sr.get("min_n", 3):
            st["risk"]["on"]["min_n"] = False                       # eski «tekshirilmasin» (0) — o'chiq
        st["risk"].update(sr)
        st["auto"].update(saved.get("auto", {}))
        if "holidays" in saved:
            st["holidays"] = saved["holidays"]
        data["settings"] = st
        data.setdefault("changelog", [])
        if data.get("version", 1) < 2:
            # eski format: n = kelmadi, s = sababli  →  yangi: s = sababsiz, dq = sababli
            remap = {"n": "s", "s": "dq"}
            for cls in data["classes"]:
                for stu in cls["students"]:
                    stu["marks"] = {d: remap.get(m, m) for d, m in stu["marks"].items()}
            data["version"] = 2
        data.setdefault("generated_months", [])
        data.setdefault("auto_state", {})
        for cls in data["classes"]:
            self.normalize_class(cls)
        return data

    @property
    def classes(self):
        return self.data["classes"]

    def save(self):
        tmp = self.path.with_name(self.path.name + ".tmp")
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(self.data, f, ensure_ascii=False, indent=1)
        if self.path.exists():
            shutil.copy2(self.path, self.path.with_name(self.path.name + ".bak"))
        os.replace(tmp, self.path)

    # — sinf tuzilmasi, X (dars yo'q) kunlari, oy generatsiyasi —
    @staticmethod
    def normalize_class(cls):
        """Eski formatni yangisiga o'tkazadi: hamma o'quvchida 'x' bo'lgan ustun — X kuni."""
        cls.setdefault("extra_x", [])   # qo'lda qo'yilgan X (bayram va h.k.)
        cls.setdefault("held", [])      # metod kuniga to'g'ri kelsa ham dars o'tilgan sanalar
        cls.setdefault("subject", "")   # fan (Matematika, Informatika, …); bo'sh — belgilanmagan
        cls.setdefault("lessons", {})      # dars mavzusi va uy vazifasi: {sana: {"topic": …, "hw": …}}
        cls.setdefault("has_exam", False)  # fanda yakuniy imtihon bormi (yakuniy ball hisobi uchun)
        cls.setdefault("weekdays", None)   # jurnalning o'z dars kunlari (0=Du … 6=Ya); None — umumiy sozlama
        cls.setdefault("analyses", [])  # saqlangan BSB tahlillari: {id, title, date, q, max[], rows{ism: {in, pts[]}}}
        cls.setdefault("works", [])     # summativ ishlar (BSB / CHSB): {id, type, date, max, title}
        studs = cls["students"]
        for s in studs:
            s.setdefault("scores", {})  # {ish id: ball | yo'qlama belgisi}
        for d in cls["dates"]:
            if studs and all(s["marks"].get(d) == "x" for s in studs) and d not in cls["extra_x"]:
                cls["extra_x"].append(d)
        for s in studs:
            s["marks"] = {d: m for d, m in s["marks"].items() if m != "x"}
        cls["extra_x"] = sorted(set(cls["extra_x"]))
        cls["dates"] = sorted(set(cls["dates"]))

    def theme_key(self):
        k = self.data["settings"].get("theme")
        return k if (k in THEMES or k == "custom") else "sut"

    def theme(self):
        k = self.theme_key()
        if k == "custom":
            base = dict(DEFAULT_SETTINGS["custom_theme"]) if "DEFAULT_SETTINGS" in globals() else {}
            base.update(self.data["settings"].get("custom_theme") or {})
            return build_custom_theme(base)
        return THEMES[k]

    def method_weekday(self):
        return self.data["settings"].get("method_weekday")

    def is_nolesson(self, cls, iso):
        """Shu sanada dars yo'qmi (X)?  Metod kuni (agar istisno bo'lmasa) yoki qo'lda qo'yilgan X."""
        if iso in cls["extra_x"]:
            return True
        mw = self.method_weekday()
        return (mw is not None and dt.date.fromisoformat(iso).weekday() == mw
                and iso not in cls["held"])

    @staticmethod
    def has_marks(cls, iso):
        return any(iso in s["marks"] for s in cls["students"])

    def set_nolesson(self, cls, iso, on):
        mw = self.method_weekday()
        is_method = mw is not None and dt.date.fromisoformat(iso).weekday() == mw
        xs, held = cls["extra_x"], cls["held"]
        if on:
            for s in cls["students"]:
                s["marks"].pop(iso, None)
            if iso in held:
                held.remove(iso)
            if not is_method and iso not in xs:
                xs.append(iso)
        else:
            if iso in xs:
                xs.remove(iso)
            if is_method and iso not in held:
                held.append(iso)

    # — kalendar-tematik reja (KTR) —
    @staticmethod
    def plan_slots(plan):
        """Reja mavzularini dars o'rinlariga ochadi: soati ko'p mavzu bir necha dars oladi («Mavzu (1/2)»)."""
        slots = []
        for i, t in enumerate(plan.get("topics", [])):
            h = max(1, int(t.get("h", 1) or 1))
            for k in range(h):
                slots.append({"text": t["t"] if h == 1 else f'{t["t"]} ({k + 1}/{h})', "q": t.get("q"), "i": i})
        return slots

    def reflow_plan(self, cls, start=None):
        """Rejadagi mavzularni dars kunlariga taqsimlaydi. Qoidalar:
        • qo'lda yozilgan mavzu (auto belgisiz) o'zgarmaydi va rejadan o'rin olmaydi;
        • start dan oldingi avtomatik mavzular o'zgarmaydi (o'tilgan deb hisoblanadi);
        • start dan keyingi (standart: bugundan) avtomatik mavzular qayta taqsimlanadi — dars yo'q (X) kunlari
          o'tkazib yuboriladi va keyingi mavzular keyingi dars kuniga siljiydi.
        Qaytaradi: {"assigned": n, "left": [sig'magan mavzular], "free": bo'sh dars kunlari soni} yoki None."""
        plan = cls.get("plan")
        if not plan or not plan.get("on") or not plan.get("topics"):
            return None
        lo = start or dt.date.today().isoformat()
        lessons = cls.setdefault("lessons", {})
        slots = self.plan_slots(plan)
        for d, les in list(lessons.items()):                   # qayta taqsimlanadigan avtomatik yozuvlarni tozalaymiz
            if les.get("auto") and (d >= lo or d not in cls["dates"] or self.is_nolesson(cls, d)):
                if les.get("hw"):
                    lessons[d] = {"topic": "", "hw": les["hw"]}
                else:
                    del lessons[d]
        taken = set()
        for d in sorted(lessons):                              # o'tilgan (start dan oldingi) avtomatik mavzular o'rinni band qiladi
            les = lessons[d]
            if not les.get("auto"):
                continue
            idx = next((i for i, sl in enumerate(slots) if i not in taken and sl["text"] == les.get("topic")), None)
            if idx is None:
                les.pop("auto", None)                          # reja o'zgargan — yozuv qo'lda yozilgandek qoladi
                les.pop("si", None)
            else:
                taken.add(idx)
                les["si"] = idx
        free = [d for d in sorted(cls["dates"]) if d >= lo and not self.is_nolesson(cls, d)
                and not (lessons.get(d, {}).get("topic"))]
        used, left, assigned, order = set(), [], 0, []
        for sl in slots:
            if sl["q"] not in order:
                order.append(sl["q"])
        for q in order:
            gs = [i for i, sl in enumerate(slots) if sl["q"] == q and i not in taken]
            rng = self.quarter_range(q) if q else None
            if q and not rng:                                  # chorak sanalari belgilanmagan — oldingi mavzulardan keyingi kunlardan
                after = max(used) if used else ""
                gd = [d for d in free if d not in used and d > after]
            else:
                gd = [d for d in free if d not in used and (q is None or (rng[0] <= d <= rng[1]))]
            for i, d in zip(gs, gd):
                old = lessons.get(d, {})
                lessons[d] = {"topic": slots[i]["text"], "hw": old.get("hw", ""), "auto": True, "si": i}
                used.add(d)
                assigned += 1
            left += [slots[i]["text"] for i in gs[len(gd):]]
        self.plan_works(cls, slots)
        return {"assigned": assigned, "left": left, "free": len(free)}

    def reflow_all(self):
        for c in self.classes:
            self.reflow_plan(c)

    def set_method_weekday(self, wd):
        self.data["settings"]["method_weekday"] = wd
        if wd is None:
            return
        for cls in self.classes:          # baho qo'yilgan kun — dars o'tilgan, X bilan yopilmaydi
            for d in cls["dates"]:
                if (dt.date.fromisoformat(d).weekday() == wd and d not in cls["held"]
                        and d not in cls["extra_x"] and self.has_marks(cls, d)):
                    cls["held"].append(d)

    @staticmethod
    def month_dates(year, month, weekdays):
        out = []
        for day in range(1, calendar.monthrange(year, month)[1] + 1):
            d = dt.date(year, month, day)
            if d.weekday() in weekdays:
                out.append(d.isoformat())
        return out

    def holiday_set(self, year):
        out = set()
        for h in self.data["settings"].get("holidays", []):
            h = str(h).strip()
            if re.fullmatch(r"\d{2}-\d{2}", h):
                out.add(f"{year:04d}-{h}")
            elif re.fullmatch(r"\d{4}-\d{2}-\d{2}", h):
                out.add(h)
        return out

    def generate_month(self, year, month, weekdays, classes=None):
        """Oy sanalarini yaratadi (mavjudlarini qayta yaratmaydi). Jurnalning o'z dars kunlari (cls["weekdays"]) bo'lsa —
        shular, aks holda weekdays qo'llanadi. Bayram kunlariga X qo'yiladi. Qo'shilgan ustunlar sonini qaytaradi."""
        holidays = self.holiday_set(year)
        added = 0
        for cls in (self.classes if classes is None else classes):
            new = self.month_dates(year, month, cls.get("weekdays") or weekdays)
            have = set(cls["dates"])
            fresh = [d for d in new if d not in have]
            cls["dates"] = sorted(have | set(fresh))
            for d in fresh:
                if d in holidays and d not in cls["held"] and d not in cls["extra_x"]:
                    cls["extra_x"].append(d)
            added += len(fresh)
        if classes is None:
            key = f"{year:04d}-{month:02d}"
            if key not in self.data["generated_months"]:
                self.data["generated_months"].append(key)
        return added

    def quarter_dates(self, q, weekdays, cls=None):
        """q-chorak oralig'idagi dars sanalari (jurnalning o'z dars kunlari bo'lsa — shular)."""
        r = self.quarter_range(q)
        if not r:
            return []
        lo, hi = dt.date.fromisoformat(r[0]), dt.date.fromisoformat(r[1])
        wds = (cls.get("weekdays") if cls else None) or weekdays
        out, d = [], lo
        while d <= hi:
            if d.weekday() in wds:
                out.append(d.isoformat())
            d += dt.timedelta(days=1)
        return out

    def generate_quarter(self, q, weekdays, classes=None):
        """Chorak oralig'idagi barcha dars sanalarini yaratadi (mavjudlarini qayta yaratmaydi; bayramlar X bo'ladi).
        Qo'shilgan ustunlar sonini qaytaradi."""
        r = self.quarter_range(q)
        if not r:
            return 0
        added = 0
        for cls in (self.classes if classes is None else classes):
            have = set(cls["dates"])
            fresh = [d for d in self.quarter_dates(q, weekdays, cls) if d not in have]
            cls["dates"] = sorted(have | set(fresh))
            for d in fresh:
                if d in self.holiday_set(int(d[:4])) and d not in cls["held"] and d not in cls["extra_x"]:
                    cls["extra_x"].append(d)
            added += len(fresh)
        lo, hi = dt.date.fromisoformat(r[0]), dt.date.fromisoformat(r[1])
        y, m = lo.year, lo.month
        while (y, m) <= (hi.year, hi.month):                    # butunlay chorak ichida qolgan oylarni «yaratilgan» deb belgilash
            first, last = dt.date(y, m, 1), dt.date(y, m, calendar.monthrange(y, m)[1])
            key = f"{y:04d}-{m:02d}"
            if classes is None and lo <= first and last <= hi and key not in self.data["generated_months"]:
                self.data["generated_months"].append(key)
            y, m = (y + 1, 1) if m == 12 else (y, m + 1)
        return added

    def extra_dates(self, cls, weekdays):
        """(olib tashlanadigan, baho/ish borligi uchun qoladigan) ortiqcha sanalar: dars kuni bo'lmagan hafta kunlari."""
        wd = set(weekdays or [])
        busy = {d for st in cls["students"] for d in st["marks"]} | {w["date"] for w in cls.get("works", [])}
        extra = [d for d in cls["dates"] if dt.date.fromisoformat(d).weekday() not in wd]
        return [d for d in extra if d not in busy], [d for d in extra if d in busy]

    def prune_dates(self, cls, weekdays=None):
        """Dars kuni bo'lmagan hafta kunidagi BO'SH sanalarni (baho, ball, summativ ish yo'q) jurnaldan olib tashlaydi."""
        wd = set(weekdays or cls.get("weekdays") or [])
        if not wd:
            return 0
        gone = set(self.extra_dates(cls, wd)[0])
        cls["dates"] = [d for d in cls["dates"] if d not in gone]
        for key in ("extra_x", "held"):
            cls[key] = [d for d in cls[key] if d not in gone]
        for d in gone:                                          # shu kunlarga tushgan avtomatik KTR mavzulari ham ketadi
            les = cls.get("lessons", {}).get(d)
            if les and les.get("auto"):
                del cls["lessons"][d]
        return len(gone)

    def guess_weekdays(self, cls):
        """Jurnalning dars kunlari: belgilangan bo'lsa shu; aks holda baho qo'yilgan hafta kunlari; u ham yo'q bo'lsa — umumiy sozlama."""
        if cls.get("weekdays"):
            return list(cls["weekdays"])
        seen = {dt.date.fromisoformat(d).weekday() for st in cls["students"] for d in st["marks"]}
        return sorted(seen) or list(self.data["settings"]["lesson_weekdays"])

    def ensure_current_month(self):
        """Dastur ochilganda joriy oy sanalari yo'q bo'lsa — o'zi yaratadi (bir marta)."""
        if not self.classes:
            return 0
        today = dt.date.today()
        key = f"{today.year:04d}-{today.month:02d}"
        if key in self.data["generated_months"]:
            return 0
        n = self.generate_month(today.year, today.month, self.data["settings"]["lesson_weekdays"])
        self.save()
        return n

    # — avtonom funksiyalar (baho va davomatga tegmaydi) —
    def auto_cfg(self):
        return self.data["settings"]["auto"]

    def auto_state(self):
        return self.data.setdefault("auto_state", {})

    def auto_quarters(self, today=None):
        """Joriy chorak (yoki 7 kundan keyin boshlanadigani) uchun dars kunlarini bir marta yaratadi. Qaytaradi: [(q, n)]."""
        if not self.auto_cfg().get("quarters") or not self.classes:
            return []
        today = today or dt.date.today()
        done, out = self.auto_state().setdefault("quarters", []), []
        for q in range(1, 5):
            r = self.quarter_range(q)
            if not r:
                continue
            lo, hi = dt.date.fromisoformat(r[0]), dt.date.fromisoformat(r[1])
            key = f"{q}:{r[0]}:{r[1]}"
            if key in done or not (lo - dt.timedelta(days=7) <= today <= hi):
                continue
            n = self.generate_quarter(q, self.data["settings"]["lesson_weekdays"])
            done.append(key)
            out.append((q, n))
        if out:
            self.save()
        return out

    def lessons_today(self, today=None):
        """Bugun dars bor sinflar: [(sinf, davomat/baho olinganmi)]."""
        iso = (today or dt.date.today()).isoformat()
        return [(c, self.has_marks(c, iso) or iso in c.get("att_ok", []))
                for c in self.classes if iso in c["dates"] and not self.is_nolesson(c, iso)]

    def class_compare(self, cls, lo, hi, q=None):
        """Sinf ko'rsatkichlari (solishtirish uchun): o'quvchilar, o'rtacha baho, davomat, xavfdagilar, BSB / CHSB foizi, chorak bali."""
        rows, lessons, _d = self.report_rows(cls, lo, hi, q)
        n_gr = sum(r["n"] for r in rows)
        avg = sum(r["avg"] * r["n"] for r in rows if r["avg"] is not None) / n_gr if n_gr else None
        atts = [r["att"] for r in rows if r["att"] is not None]
        pct = {}
        for t in ("bsb", "chsb"):
            got = mx = 0
            for w in cls.get("works", []):
                if (w["type"] == t) and lo <= w["date"] <= hi and w.get("max"):
                    for st in cls["students"]:
                        v = st.get("scores", {}).get(w["id"])
                        if isinstance(v, (int, float)) and not isinstance(v, bool):
                            got += v
                            mx += w["max"]
            pct[t] = 100.0 * got / mx if mx else None
        totals = [r["q"]["total"] for r in rows if r.get("q") and r["q"]["complete"]]
        return {"n": len(rows), "avg": avg, "att": (sum(atts) / len(atts)) if atts else None,
                "risk": sum(1 for r in rows if r["risk"]), "bsb": pct["bsb"], "chsb": pct["chsb"],
                "total": (sum(totals) / len(totals)) if totals else None, "lessons": lessons}

    def period_now(self, today=None):
        """(boshlanish, tugash, chorak) — bugun tushgan chorak, bo'lmasa joriy oy."""
        today = today or dt.date.today()
        q = self.quarter_of(today.isoformat())
        if q:
            return self.quarter_range(q)[0], today.isoformat(), q
        return today.replace(day=1).isoformat(), today.isoformat(), None

    def risk_overview(self, today=None):
        """Xavf ostidagi o'quvchilar: [{cls, names:[(ism, sabab)]}] (joriy davr bo'yicha)."""
        lo, hi, q = self.period_now(today)
        out = []
        for c in self.classes:
            rows, _n, _d = self.report_rows(c, lo, hi, q)
            bad = [(r["name"], "; ".join(r["why"])) for r in rows
                   if any(not w.startswith("baholar soni") for w in r["why"])]       # faqat «baholar kam» — bannerga chiqmaydi
            if bad:
                out.append({"cls": c, "names": bad})
        return out

    def upcoming(self, today=None, days=3):
        """Yaqin kunlardagi summativ ishlar va chorak tugashi: [matn]."""
        today = today or dt.date.today()
        lo, hi = today.isoformat(), (today + dt.timedelta(days=days)).isoformat()
        out = []
        for c in self.classes:
            for w in c.get("works", []):
                if lo <= w["date"] <= hi:
                    left = (dt.date.fromisoformat(w["date"]) - today).days
                    when = "bugun" if left == 0 else "ertaga" if left == 1 else fmt_date(w["date"])
                    out.append(f"{w['type'].upper()} — {cls_label(c)} ({when})")
        q = self.quarter_of(lo)
        if q:
            end = dt.date.fromisoformat(self.quarter_range(q)[1])
            if 0 <= (end - today).days <= 7:
                out.append(f"{q}-chorak {fmt_date(end.isoformat())} da tugaydi — baholarni tekshiring")
        return out

    def weekly_report_due(self, today=None):
        today = today or dt.date.today()
        wd = self.auto_cfg().get("weekly")
        if wd is None or not self.classes or today.weekday() < int(wd):
            return False
        wk = f"{today.isocalendar()[0]}-W{today.isocalendar()[1]:02d}"
        return self.auto_state().get("reported") != wk

    def auto_reports(self, today=None):
        """Har sinf uchun joriy davr hisobotini PDF qilib hisobotlar/ papkasiga saqlaydi. Qaytaradi: [fayl yo'llari]."""
        today = today or dt.date.today()
        lo, hi, q = self.period_now(today)
        folder = self.path.parent / "hisobotlar"
        folder.mkdir(exist_ok=True)
        files = []
        for c in self.classes:
            rows, lessons, _d = self.report_rows(c, lo, hi, q)
            if not lessons:
                continue
            path = folder / f"{today:%Y-%m-%d}_{safe_name(cls_label(c))}.pdf"
            write_pdf_fit(path, lambda f, pd, c=c, rows=rows, lessons=lessons: report_html(self, c, lo, hi, q, rows, lessons, f, pd),
                          landscape=True)
            files.append(path)
        wk = f"{today.isocalendar()[0]}-W{today.isocalendar()[1]:02d}"
        self.auto_state()["reported"] = wk
        self.save()
        return files

    @staticmethod
    def _work_of_topic(text):
        """«BSB-1 (25 ball)», «CHSB 2», «1-BSB» → (tur, maksimal ball yoki None) yoki None; «BSB tahlili» — ish emas."""
        m = re.match(r"^\s*(?:\d+\s*-?\s*)?(CHSB|BSB)\b(?:\s*[-№#]?\s*\d+)?(?!\s*[^\W\d_])\s*(?:\(\s*(\d+(?:[.,]\d+)?)\s*ball\s*\))?", str(text), re.I)
        if not m:
            return None
        mx = float(m.group(2).replace(",", ".")) if m.group(2) else None
        if mx is not None and mx == int(mx):
            mx = int(mx)
        return m.group(1).lower(), mx

    def plan_works(self, cls, slots):
        """KTRda BSB/CHSB qatori tushgan kunga ish yaratadi (mavzu siljisa — ish sanasi ham siljiydi).
        Faqat o'zi yaratgan («ktr» belgili) ishlarga tegadi; ball qo'yilgan ish hech qachon o'chirilmaydi."""
        if not self.auto_cfg().get("ktr_works"):
            return
        wanted = {}
        for d, les in cls.get("lessons", {}).items():
            if not les.get("auto") or d not in cls["dates"]:
                continue
            si = les.get("si")
            if si is None or si >= len(slots):
                continue
            w = self._work_of_topic(slots[si]["text"])
            if w:
                wanted[si] = (d, w[0], w[1] if w[1] is not None else (25 if w[0] == "bsb" else CHSB_TOTAL), slots[si]["text"])
        mine = {w["ktr"]: w for w in cls["works"] if w.get("ktr") is not None}
        for si, (d, typ, mx, title) in wanted.items():
            w = mine.get(si)
            if w is None:
                nw = self.add_work(cls, typ, d, mx, title)
                nw["ktr"] = si
            else:
                w["date"], w["type"] = d, typ
                if not any(st.get("scores", {}).get(w["id"], "") != "" for st in cls["students"]):
                    w["max"] = mx
        for si, w in mine.items():
            if si not in wanted and not any(st.get("scores", {}).get(w["id"], "") != "" for st in cls["students"]):
                cls["works"].remove(w)

    # — sinflar: qo'shish, olib tashlash, zaxira —
    @staticmethod
    def _cls_key(name):
        return re.sub(r"\s+", "", str(name)).casefold()

    def has_class(self, name, subject="", ignore=None):
        k, sk = self._cls_key(name), self._cls_key(subject)
        return any(c is not ignore and self._cls_key(c["name"]) == k
                   and self._cls_key(c.get("subject", "")) == sk for c in self.classes)

    def find_class(self, name, subject=""):
        """(sinf, fan_belgilanadi). Fan berilsa — aynan shu fan yoki fansiz sinf (unga fan belgilanadi);
        fan berilmasa — shu nomli yagona sinf yoki fansiz sinf."""
        key, sk = self._cls_key(name), self._cls_key(subject)
        same = [c for c in self.classes if self._cls_key(c["name"]) == key]
        if sk:
            exact = next((c for c in same if self._cls_key(c.get("subject", "")) == sk), None)
            if exact:
                return exact, False
            bare = [c for c in same if not c.get("subject")]
            return (bare[0], True) if len(bare) == 1 else (None, False)
        if len(same) == 1:
            return same[0], False
        return next((c for c in same if not c.get("subject")), None), False

    def subjects(self):
        seen = {}
        for c in self.classes:
            sub = c.get("subject", "").strip()
            if sub:
                seen.setdefault(sub.casefold(), sub)
        return sorted(seen.values(), key=str.casefold)

    def add_class(self, name, student_names, source=None, subject=""):
        """source: None — bo'sh | "month" — joriy oy | mavjud sinf (lug'at yoki nomi) — sanalarni (X kunlari bilan) nusxalash."""
        cls = {"name": name.strip(), "subject": subject.strip(), "dates": [], "extra_x": [], "held": [],
               "students": [{"name": n, "marks": {}} for n in student_names]}
        if source == "month":
            today = dt.date.today()
            cls["dates"] = self.month_dates(today.year, today.month, self.data["settings"]["lesson_weekdays"])
        elif source:
            src = source if isinstance(source, dict) else next((c for c in self.classes if c["name"] == source), None)
            if src:
                cls["dates"] = list(src["dates"])
                cls["extra_x"] = list(src["extra_x"])
                cls["held"] = list(src["held"])
        self.normalize_class(cls)
        if isinstance(source, dict) or (source and source != "month"):
            src2 = source if isinstance(source, dict) else next((c for c in self.classes if c["name"] == source), None)
            if src2 and src2.get("weekdays"):
                cls["weekdays"] = list(src2["weekdays"])
        self.classes.append(cls)
        self.classes.sort(key=class_sort_key)
        return cls

    def edit_class(self, cls, name, subject, weekdays=None):
        """Sinf nomi, fani va dars kunlarini o'zgartiradi; o'zgarishlar tarixidagi yozuvlar ham yangi nomga ko'chiriladi."""
        old = cls_label(cls)
        cls["name"], cls["subject"] = name.strip(), subject.strip()
        cls["weekdays"] = sorted(weekdays) if weekdays else None
        new = cls_label(cls)
        if new != old:
            for e in self.data.get("changelog", []):
                if e.get("cls") == old:
                    e["cls"] = new
        self.classes.sort(key=class_sort_key)

    def remove_class(self, cls):
        self.classes[:] = [c for c in self.classes if c is not cls]

    @staticmethod
    def next_class_name(name, last_grade=11):
        """«8-A» → «9-A»; oxirgi sinf (11) — None (bitiruvchi). Raqamsiz nom o'zgarishsiz qoladi."""
        m = re.match(r"^(\s*)(\d+)(.*)$", name)
        if not m:
            return name
        g = int(m.group(2))
        return None if g >= last_grade else f"{m.group(1)}{g + 1}{m.group(3)}"

    @staticmethod
    def school_year_label(today=None):
        t = today or dt.date.today()
        y = t.year if t.month >= 11 else t.year - 1          # yil oxirida / yangi yil boshida — hozirgina tugagan o'quv yili
        return f"{y}-{y + 1}"

    def rollover_check(self, items):
        """items: [{cls, new}] — yangi nomlar to'qnashuvini tekshiradi. Qaytaradi: xatolar ro'yxati."""
        rolled = {id(it["cls"]) for it in items}
        errs, seen = [], []
        for it in items:
            n = (it["new"] or "").strip()
            if not n:
                continue
            sub = it["cls"].get("subject", "")
            k = (self._cls_key(n), self._cls_key(sub))
            if k in seen:
                errs.append(f"«{n}» nomi ikki marta takrorlangan")
            seen.append(k)
            if any(id(c) not in rolled and self._cls_key(c["name"]) == k[0] and self._cls_key(c.get("subject", "")) == k[1]
                   for c in self.classes):
                errs.append(f"«{n}» nomli jurnal allaqachon bor")
        return errs

    def rollover(self, items, label, reset_quarters=True):
        """Yangi o'quv yiliga o'tkazish. Avval butun jurnal arxiv/ papkasiga to'liq nusxalanadi (hech qachon o'chirilmaydi).
        So'ng tanlangan sinflar uchun o'quvchilar ro'yxati bilan yangi (bo'sh) jurnallar yaratiladi, eskilari olib tashlanadi.
        Qaytaradi: (arxiv fayli, [yangi sinflar])."""
        self.save()
        folder = self.path.parent / "arxiv"
        folder.mkdir(exist_ok=True)
        dest, n = folder / f"{self.path.stem}_{label}.json", 1
        while dest.exists():
            n += 1
            dest = folder / f"{self.path.stem}_{label}_{n}.json"
        shutil.copy2(self.path, dest)
        today = dt.date.today()
        created = []
        for it in items:
            old, new = it["cls"], (it["new"] or "").strip()
            if not new:
                continue
            nc = self.add_class(new, [st["name"] for st in old["students"]], None, old.get("subject", ""))
            if old.get("weekdays"):
                nc["weekdays"] = list(old["weekdays"])
            nc["has_exam"] = bool(old.get("has_exam"))
            created.append(nc)
        for it in items:
            self.remove_class(it["cls"])
        if reset_quarters:
            self.data["settings"]["quarters"] = [None, None, None, None]
            self.auto_state()["quarters"] = []
        self.generate_month(today.year, today.month, self.data["settings"]["lesson_weekdays"], created) if created else None
        self.log_change("(o'quv yili)", "(yangi yilga o'tkazish)", "", label,
                        f"{len(items)} jurnal → {len(created)} yangi", "rollover")
        self.save()
        return dest, created

    # — zaxira nusxalar —
    BACKUP_KEEP = {"avto": 40, "amal": 40, "qolda": 40, "tiklash": 10}   # har turdan nechta oxirgisi saqlanadi

    def backup_dir(self):
        d = self.path.parent / "zaxira"
        d.mkdir(exist_ok=True)
        return d

    def _copy_backup(self, tag):
        stamp = f"{dt.datetime.now():%Y%m%d_%H%M%S}"
        base = self.backup_dir() / f"{self.path.stem}_{stamp}_{tag}"
        dest, n = base.with_suffix(".json"), 1
        while dest.exists():                    # bir soniyada ikkinchi nusxa oldingisini bosib ketmasin
            n += 1
            dest = base.parent / f"{base.name}_{n}.json"
        shutil.copy2(self.path, dest)
        self.prune()
        return dest

    def backup(self, tag="amal"):
        """Hozirgi holatni zaxira/ papkasiga nusxalaydi: journal_<sana>_<vaqt>_<tur>.json."""
        self.save()
        return self._copy_backup(tag)

    def backups(self):
        """Barcha zaxira nusxalar, eng yangisi birinchi: [{path, when, tag, size}]."""
        stem = re.escape(self.path.stem)
        sources = [(self.backup_dir(), re.compile(rf"^{stem}_(\d{{8}})_(\d{{6}})_([a-z]+)(?:_\d+)?\.json$"), None),
                   (self.path.parent, re.compile(rf"^{stem}_zaxira_(\d{{8}})_(\d{{6}})(?:_\d+)?\.json$"), "eski")]
        out = []
        for folder, rx, fixed in sources:
            for f in folder.glob("*.json"):
                m = rx.match(f.name)
                if not m:
                    continue
                try:
                    when = dt.datetime.strptime(m.group(1) + m.group(2), "%Y%m%d%H%M%S")
                except ValueError:
                    when = dt.datetime.fromtimestamp(f.stat().st_mtime)
                out.append({"path": f, "when": when, "tag": fixed or m.group(3), "size": f.stat().st_size})
        out.sort(key=lambda b: (b["when"], b["path"].name), reverse=True)
        return out

    @staticmethod
    def _digest(path):
        return hashlib.sha256(Path(path).read_bytes()).hexdigest()

    def auto_backup(self):
        """Ma'lumot oxirgi zaxiradan farq qilsa, avtomatik nusxa oladi (ilova ochilganda va yopilganda)."""
        try:
            if not self.path.exists():
                return None
            last = self.backups()
            if last and self._digest(last[0]["path"]) == self._digest(self.path):
                return None
            return self._copy_backup("avto")
        except OSError as e:
            print("Zaxira xatosi:", e)
            return None

    def cloud_sync(self):
        """Jurnalni bulut papkasiga nusxalaydi: jurnal_oxirgi.json (har safar) va kunlik jurnal_<sana>.json (oxirgi 14 ta).
        Ma'lumot o'zgarmagan bo'lsa — hech narsa qilmaydi. Qaytaradi: papka yo'li yoki None."""
        d = self.auto_cfg().get("cloud_dir")
        if not d or not self.path.exists():
            return None
        folder = Path(d)
        if not folder.is_dir():
            raise OSError(f"Bulut papkasi topilmadi: {folder}")
        dig = self._digest(self.path)
        if dig == getattr(self, "_cloud_dig", None):
            return None
        tmp = folder / "jurnal_oxirgi.json.tmp"
        shutil.copy2(self.path, tmp)
        os.replace(tmp, folder / "jurnal_oxirgi.json")
        shutil.copy2(self.path, folder / f"jurnal_{dt.date.today().isoformat()}.json")
        for old in sorted(folder.glob("jurnal_????-??-??.json"))[:-14]:
            try:
                old.unlink()
            except OSError:
                pass
        self._cloud_dig = dig
        return folder

    def readiness(self, cls, q):
        """Chorak yakuni tayyorligi: (sinf muammolari [str], {ism: [muammolar]}) — chorak bahosi chiqishi uchun nima yetishmaydi."""
        works = self.works_in_quarter(cls, q)
        cp = []
        mb = sum(w["max"] for w in works if w["type"] == "bsb")
        mc = sum(w["max"] for w in works if w["type"] != "bsb")
        if mb != BSB_TOTAL:
            cp.append(f"BSB maksimal ballari yig'indisi {mb} (kerak: {BSB_TOTAL})")
        if mc != CHSB_TOTAL:
            cp.append(f"CHSB maksimal ballari yig'indisi {mc} (kerak: {CHSB_TOTAL})")
        per = {}
        for st in cls["students"]:
            res = self.quarter_result(cls, st, q, works)
            probs = []
            sc = st.get("scores", {})
            for w in works:
                if not isinstance(sc.get(w["id"]), (int, float)):
                    probs.append(f"{w['type'].upper()} {fmt_date(w['date'])[:5]} — ball yo'q")
            if res["n_fb"] < self.fb_min():
                probs.append(f"formativ baholar {res['n_fb']} ta (kamida {self.fb_min()} ta kerak)")
            if probs:
                per[st["name"]] = probs
        return cp, per

    def class_by_key(self, name, subject=""):
        k, sk = self._cls_key(name), self._cls_key(subject)
        return next((c for c in self.classes if self._cls_key(c["name"]) == k
                     and self._cls_key(c.get("subject", "")) == sk), None)

    INBOX = "bot_inbox.json"

    def apply_ops(self, ops, allow_overwrite=False, today=None):
        """Telegram bot (yoki boshqa tashqi vosita) amallari: belgi (faqat bugun), davomat tasdig'i, eslatma, kuzatuv.
        Mavjud belgini o'zgartirish faqat allow_overwrite=True bo'lsa (qulf ochiq). Qaytaradi: {applied, skipped:[sabab]}."""
        today = (today or dt.date.today()).isoformat()
        applied, skipped = 0, []
        for op in ops:
            try:
                cls = self.class_by_key(op.get("cls", ""), op.get("subject", ""))
                if cls is None:
                    skipped.append(f"jurnal topilmadi: {op.get('cls')}")
                    continue
                kind = op.get("op")
                if kind == "att_ok":
                    ok = cls.setdefault("att_ok", [])
                    if op["date"] not in ok:
                        ok.append(op["date"])
                        del ok[:-400]
                        applied += 1
                    continue
                st = next((x for x in cls["students"] if x["name"] == op.get("student")), None)
                if st is None:
                    skipped.append(f"o'quvchi topilmadi: {op.get('student')} ({cls_label(cls)})")
                    continue
                if kind == "note":
                    text = str(op.get("text", "")).strip()
                    if text:
                        st.setdefault("notes", []).append({"t": op.get("t") or dt.datetime.now().isoformat(timespec="minutes"),
                                                           "text": text})
                        applied += 1
                elif kind == "star":
                    if op.get("on"):
                        st["star"] = True
                    else:
                        st.pop("star", None)
                    applied += 1
                elif kind == "mark":
                    d = op["date"]
                    if d != today or d not in cls["dates"] or self.is_nolesson(cls, d):
                        skipped.append(f"{st['name']}: {fmt_date(d)} — faqat bugungi dars kuniga belgi qo'yiladi")
                        continue
                    old = st["marks"].get(d, "")
                    new = combine_mark(old, op.get("value", ""), False, False)
                    if new == old:
                        continue
                    go, gn = grades_of(old), grades_of(new)
                    additive = (not old) or (bool(go) and gn[:len(go)] == go)
                    if not additive and not allow_overwrite:
                        skipped.append(f"{st['name']}: katakda «{display_mark(old)}» bor — himoyalangan, o'zgartirilmadi")
                        continue
                    if new:
                        st["marks"][d] = new
                    else:
                        st["marks"].pop(d, None)
                    if old:
                        self.log_change(cls_label(cls), st["name"], d, old, new, "clear" if not new else "edit", src="telegram")
                    applied += 1
                else:
                    skipped.append(f"noma'lum amal: {kind}")
            except (KeyError, TypeError, ValueError) as e:
                skipped.append(f"xato amal ({e})")
        return {"applied": applied, "skipped": skipped}

    def apply_inbox(self, allow_overwrite=False):
        """bot_inbox.json (jurnal papkasida) dagi navbatni qo'llaydi va saqlaydi. Qaytaradi: natija yoki None (navbat yo'q)."""
        inbox = self.path.parent / self.INBOX
        if not inbox.exists():
            return None
        proc = inbox.with_name(inbox.name + ".processing")
        try:
            os.replace(inbox, proc)
        except OSError:
            return None
        try:
            ops = json.loads(proc.read_text(encoding="utf-8"))
            if not isinstance(ops, list):
                raise ValueError("navbat ro'yxat emas")
        except (OSError, ValueError) as e:
            proc.replace(inbox.with_name(f"bot_inbox_buzuq_{dt.datetime.now():%Y%m%d_%H%M%S}.json"))
            return {"applied": 0, "skipped": [f"navbat fayli o'qilmadi: {e}"]}
        res = self.apply_ops(ops, allow_overwrite)
        if res["applied"]:
            self.save()
        try:
            proc.unlink()
        except OSError:
            pass
        return res

    def prune(self):
        groups = {}
        for b in self.backups():
            if b["tag"] != "eski":              # eski (journal_zaxira_…) nusxalarga tegilmaydi
                groups.setdefault(b["tag"], []).append(b)
        for tag, items in groups.items():
            for b in items[self.BACKUP_KEEP.get(tag, 40):]:
                try:
                    b["path"].unlink()
                except OSError:
                    pass

    def restore(self, path):
        """Zaxira (yoki boshqa jurnal) faylidan tiklaydi; oldin joriy holat «tiklash» nusxasida saqlanadi."""
        with open(path, encoding="utf-8") as f:
            raw = json.load(f)
        ok = (isinstance(raw, dict) and isinstance(raw.get("classes"), list)
              and all(isinstance(c, dict) and "name" in c and isinstance(c.get("students"), list)
                      and all(isinstance(s, dict) and "name" in s and isinstance(s.get("marks"), dict)
                              for s in c["students"]) for c in raw["classes"]))
        if not ok:
            raise ValueError("Bu fayl jurnal ma'lumotlariga o'xshamaydi.")
        data = self._load(path)
        safety = self.backup("tiklash")
        self.data = data
        self.save()
        return safety

    # — o'quvchilar: qo'shish, olib tashlash, nomini o'zgartirish —
    @staticmethod
    def add_students(cls, names, alpha=True):
        """Yangi o'quvchilarni qo'shadi. alpha=True — alifbo bo'yicha mos joyga, aks holda oxiriga.
        (qo'shilganlar, o'tkazib yuborilganlar) qaytaradi."""
        have = {norm_name(s["name"]) for s in cls["students"]}
        added, skipped = [], []
        for n in names:
            k = norm_name(n)
            if not k or k in have:
                skipped.append(n)
                continue
            have.add(k)
            pos = len(cls["students"])
            if alpha:
                pos = next((i for i, s in enumerate(cls["students"]) if norm_name(s["name"]) > k), pos)
            cls["students"].insert(pos, {"name": n, "marks": {}, "scores": {}})
            added.append(n)
        return added, skipped

    @staticmethod
    def remove_students(cls, rows):
        """Berilgan qator raqamlaridagi o'quvchilarni o'chiradi; o'chirilgan baholar sonini qaytaradi."""
        gone = set(rows)
        n_marks = sum(len(s["marks"]) for i, s in enumerate(cls["students"]) if i in gone)
        cls["students"][:] = [s for i, s in enumerate(cls["students"]) if i not in gone]
        return n_marks

    @staticmethod
    def rename_student(cls, i, new):
        k = norm_name(new)
        if not k or any(j != i and norm_name(s["name"]) == k for j, s in enumerate(cls["students"])):
            return False
        cls["students"][i]["name"] = new
        return True

    # — import: mavjud sinfga qo'shish —
    def merge_import(self, imp, overwrite=False, dry=False, only_new=False):
        """Import qilinadigan sinfni (imp) mavjud sinfga qo'shadi. dry=True — faqat hisobot, hech narsa o'zgarmaydi.
        only_new=True — mavjud o'quvchilarning mavjud sanalardagi kataklariga tegmaydi (ular solishtirish jadvalida tanlanadi):
        faqat yangi sinf, yangi o'quvchilar, yangi sanalar, summativ ishlar va chorak sanalari qo'shiladi."""
        cls, adopt = self.find_class(imp["name"], imp.get("subject", ""))
        created = cls is None
        if created:
            cls = {"name": imp["name"], "subject": imp.get("subject", ""), "dates": [], "students": [],
                   "extra_x": [], "held": [], "works": []}
        elif dry:
            cls = copy.deepcopy(cls)
        if adopt:                               # fansiz sinfga importdagi fan belgilanadi
            old_label = cls_label(cls)
            cls["subject"] = imp["subject"]
            if not dry:                         # tarix yozuvlari yangi nomga ko'chiriladi
                for e in self.data.get("changelog", []):
                    if e.get("cls") == old_label:
                        e["cls"] = cls_label(cls)
        rep = {"name": imp["name"], "created": created, "adopted": bool(adopt), "cls": cls,
               "subject": cls.get("subject", ""), "new_dates": [], "new_students": [], "matched": 0,
               "absent": [], "filled": 0, "replaced": 0, "kept": 0, "same": 0,
               "total": sum(1 for st in imp["students"] for m in st["marks"].values() if m != "x"),
               "x_dates": [d for d in imp["dates"] if imp["students"]
                           and all(st["marks"].get(d) == "x" for st in imp["students"])]}
        have = set(cls["dates"])
        rep["new_dates"] = [d for d in imp["dates"] if d not in have]
        rep["changes"] = []                     # almashtirilgan baholar: (o'quvchi, sana, eski, yangi)
        rep.update(new_works=[], s_filled=0, s_replaced=0, s_kept=0, s_same=0, s_invalid=0, score_changes=[])
        cls["dates"] = sorted(have | set(imp["dates"]))
        new_dset = set(rep["new_dates"])
        idx = {norm_name(st["name"]): st for st in cls["students"]}
        in_file, prev, touched, pairs = set(), None, set(), []
        for st in imp["students"]:
            key = norm_name(st["name"])
            in_file.add(key)
            cs = idx.get(key)
            fresh = cs is None
            if cs is None:                      # yangi o'quvchi — fayldagi tartibga yaqin joyga
                cs = {"name": st["name"], "marks": {}, "scores": {}}
                pos = 0 if prev is None else next(i for i, x in enumerate(cls["students"]) if x is prev) + 1
                cls["students"].insert(pos, cs)
                idx[key] = cs
                rep["new_students"].append(st["name"])
            else:
                rep["matched"] += 1
            prev = cs
            pairs.append((st, cs))
            for d, m in st["marks"].items():
                if only_new and not (fresh or d in new_dset):
                    continue
                cur = cs["marks"].get(d)
                if m == "x":                     # butun kun X — normalize_class X kuniga aylantiradi
                    if cur is None:
                        cs["marks"][d] = "x"
                    continue
                if cur == m:
                    rep["same"] += 1
                elif cur is None:
                    cs["marks"][d] = m
                    rep["filled"] += 1
                    if m != "x":
                        touched.add(d)
                elif overwrite:
                    rep["changes"].append((cs["name"], d, cur, m))
                    cs["marks"][d] = m
                    rep["replaced"] += 1
                    if m != "x":
                        touched.add(d)
                else:
                    rep["kept"] += 1
        wmap, fresh_w = {}, set()               # summativ ishlar: tur + sana bo'yicha moslashtiriladi
        for w in imp.get("works", []):
            ex = next((x for x in cls["works"] if x["type"] == w["type"] and x["date"] == w["date"]), None)
            if ex is None:
                ex = {"id": self.new_work_id(cls), "type": w["type"], "date": w["date"], "max": w["max"],
                      "title": w.get("title", "")}
                cls["works"].append(ex)
                rep["new_works"].append(ex)
                fresh_w.add(ex["id"])
            wmap[f"{w['type']}|{w['date']}"] = ex
        new_names = {norm_name(n) for n in rep["new_students"]}
        for st, cs in pairs:
            sc = cs.setdefault("scores", {})
            for key, v in st.get("scores", {}).items():
                ex = wmap.get(key)
                if ex is None:
                    continue
                if only_new and not (ex["id"] in fresh_w or norm_name(cs["name"]) in new_names):
                    continue
                if isinstance(v, (int, float)) and v > ex["max"]:
                    rep["s_invalid"] += 1
                    continue
                cur = sc.get(ex["id"], "")
                if cur == v:
                    rep["s_same"] += 1
                elif cur == "":
                    sc[ex["id"]] = v
                    rep["s_filled"] += 1
                elif overwrite:
                    rep["score_changes"].append((cs["name"], ex["id"], ex["type"].upper(), ex["date"], cur, v))
                    sc[ex["id"]] = v
                    rep["s_replaced"] += 1
                else:
                    rep["s_kept"] += 1
        qd = imp.get("quarter")
        rep["quarter_new"] = bool(qd and not self.quarters()[qd["q"] - 1])
        if rep["quarter_new"] and not dry:
            self.quarters()[qd["q"] - 1] = [qd["start"], qd["end"]]
        rep["absent"] = [x["name"] for x in cls["students"] if norm_name(x["name"]) not in in_file]
        mw = self.method_weekday()
        for d in touched:                       # baho qo'yilgan kun — dars o'tilgan (X emas)
            if d in cls["extra_x"]:
                cls["extra_x"].remove(d)
            if mw is not None and dt.date.fromisoformat(d).weekday() == mw and d not in cls["held"]:
                cls["held"].append(d)
        self.normalize_class(cls)
        if not dry and created:
            self.classes.append(cls)
            self.classes.sort(key=class_sort_key)
        return rep

    # — emaktab bilan solishtirish (sinxronlash) —
    SYNC_LABELS = {"theirs": "Faqat emaktabda", "ours": "Faqat bizda", "diff": "Farq qiladi"}

    def sync_diff(self, imp):
        """emaktab fayli (imp) va bizning jurnal o'rtasidagi farqlar. Hech narsa o'zgarmaydi.
        Qaytaradi: {"cls": sinf yoki None, "rows": [...], "same": n, "only_students": {...}}.
        Qator: dict(student, date, ours, theirs, status) — status: theirs | ours | diff."""
        cls, _adopt = self.find_class(imp["name"], imp.get("subject", ""))
        res = {"name": imp["name"], "subject": imp.get("subject", ""), "cls": cls, "rows": [], "same": 0,
               "new_students": [], "absent": []}
        if cls is None:
            return res
        dates = sorted(imp["dates"])
        if not dates:
            return res
        lo, hi = dates[0], dates[-1]                    # emaktab qamragan davr; undan tashqarisi solishtirilmaydi
        ours = {norm_name(st["name"]): st for st in cls["students"]}
        theirs = {norm_name(st["name"]): st for st in imp["students"]}
        res["new_students"] = [st["name"] for k, st in theirs.items() if k not in ours]
        res["absent"] = [st["name"] for k, st in ours.items() if k not in theirs]
        for k, cs in ours.items():
            ts = theirs.get(k)
            if ts is None:
                continue
            for d in sorted(set(ts["marks"]) | {x for x in cs["marks"] if lo <= x <= hi}):
                if not lo <= d <= hi:
                    continue
                a, b = cs["marks"].get(d, ""), ts["marks"].get(d, "")
                if b == "x" or a == "x" or self.is_nolesson(cls, d):
                    continue
                if a == b:
                    if a:
                        res["same"] += 1
                    continue
                st_ = "theirs" if not a else ("ours" if not b else "diff")
                res["rows"].append({"student": cs["name"], "date": d, "ours": a, "theirs": b, "status": st_})
        return res

    def sync_apply(self, res, rows):
        """Tanlangan qatorlarni (emaktab qiymati) jurnalga qo'llaydi. O'zgargan kataklar sonini qaytaradi."""
        cls = res["cls"]
        idx = {norm_name(st["name"]): st for st in cls["students"]}
        n = 0
        for r in rows:
            cs = idx.get(norm_name(r["student"]))
            if cs is None or r["status"] == "ours" or not r["theirs"]:
                continue
            old = cs["marks"].get(r["date"], "")
            if old == r["theirs"]:
                continue
            cs["marks"][r["date"]] = r["theirs"]
            if r["date"] not in cls["dates"]:
                cls["dates"] = sorted(cls["dates"] + [r["date"]])
            if r["date"] in cls.get("extra_x", []):
                cls["extra_x"].remove(r["date"])
            self.log_change(cls_label(cls), cs["name"], r["date"], old, r["theirs"], "sync")
            n += 1
        self.normalize_class(cls)
        return n

    # — summativ ishlar (BSB / CHSB) va chorak balli —
    def quarters(self):
        return self.data["settings"]["quarters"]

    def quarter_range(self, q):
        r = self.quarters()[q - 1]
        return (r[0], r[1]) if r else None

    def quarter_of(self, iso):
        for q in range(1, 5):
            r = self.quarter_range(q)
            if r and r[0] <= iso <= r[1]:
                return q
        return None

    def fb_min(self):
        return int(self.data["settings"].get("fb_min", 4) or 1)

    def works_in_quarter(self, cls, q):
        r = self.quarter_range(q)
        if not r:
            return []
        return sorted((w for w in cls["works"] if r[0] <= w["date"] <= r[1]),
                      key=lambda w: (w["date"], w["type"] != "bsb", w["id"]))

    @staticmethod
    def new_work_id(cls):
        ids = [int(w["id"][1:]) for w in cls["works"] if str(w["id"])[1:].isdigit()]
        return f"w{max(ids, default=0) + 1}"

    def add_work(self, cls, wtype, date, mx, title=""):
        w = {"id": self.new_work_id(cls), "type": wtype, "date": date, "max": mx, "title": title}
        cls["works"].append(w)
        return w

    @staticmethod
    def remove_work(cls, work):
        cls["works"][:] = [w for w in cls["works"] if w is not work]
        for st in cls["students"]:
            st.get("scores", {}).pop(work["id"], None)

    def fb_info(self, cls, st, rng):
        """Formativ ball (maks. 10): chorakdagi 1–10 baholar o'rtachasi (yaxlitlanadi); kamida fb_min ta baho
        bo'lmasa 0. Qaytaradi: (ball, baholar soni, o'rtacha)."""
        if not rng:
            return 0, 0, None
        gr = self.formative_grades(cls, st, rng)
        if not gr:
            return 0, 0, None
        avg = sum(gr) / len(gr)
        return (int(avg + 0.5) if len(gr) >= self.fb_min() else 0), len(gr), avg

    def growth_data(self, cls, st, rng):
        """O'quvchining o'sish dinamikasi: darslar bo'yicha baholar, yig'ma o'rtacha, sinf yig'ma o'rtachasi, qoldirishlar, BSB/CHSB.
        rng — (boshlanish, tugash) ISO yoki None (hamma sanalar)."""
        today = dt.date.today().isoformat()
        dates = [d for d in cls["dates"] if d <= today and not self.is_nolesson(cls, d)
                 and (not rng or rng[0] <= d <= rng[1])]
        pts, run, crun, absn = [], [], [], []
        sg, sn, cg, cn = 0.0, 0, 0.0, 0
        for i, d in enumerate(dates):
            for g in grades_of(st["marks"].get(d, "")):
                pts.append((i, g))
                sg += g
                sn += 1
            for o in cls["students"]:
                for g in grades_of(o["marks"].get(d, "")):
                    cg += g
                    cn += 1
            run.append(sg / sn if sn else None)
            crun.append(cg / cn if cn else None)
            m = st["marks"].get(d, "")
            a = att_part(m) if m else ""
            if a in ("s", "dq", "k"):
                absn.append((i, a))
        works = []
        for w in cls["works"]:
            v = st.get("scores", {}).get(w["id"])
            if not isinstance(v, (int, float)) or isinstance(v, bool) or not w.get("max"):
                continue
            if rng and not (rng[0] <= w["date"] <= rng[1]):
                continue
            idx = max([i for i, d in enumerate(dates) if d <= w["date"]], default=0)
            works.append((idx, w["type"], 100.0 * v / w["max"], w["date"]))
        return {"dates": dates, "points": pts, "run": run, "cls_run": crun, "abs": absn, "works": works}

    def formative_grades(self, cls, st, rng):
        """Davrdagi barcha formativ baholar ro'yxati (X kunlarisiz)."""
        if not rng:
            return []
        return [g for d, m in st["marks"].items()
                if rng[0] <= d <= rng[1] and not self.is_nolesson(cls, d) for g in grades_of(m)]

    def year_result(self, cls, st):
        """Yillik va yakuniy tavsiya etilgan ball (emaktab qo'llanmasi matniga ko'ra):
        yillik = (barcha choraklar SB ballari yig'indisi / 4) + yil bo'yicha barcha FB larning o'rtachasi;
        yakuniy = 0.7 × yillik + 0.3 × imtihon (imtihon bo'lmasa — yillik bilan bir xil)."""
        qres, sb, fbg = [], 0.0, []
        for q in range(1, 5):
            rng = self.quarter_range(q)
            r = self.quarter_result(cls, st, q, self.works_in_quarter(cls, q)) if rng else None
            qres.append(r)
            if r:
                sb += r["bsb"] + r["chsb"]
                fbg += self.formative_grades(cls, st, rng)
        ready = all(r is not None and r["complete"] for r in qres)
        avg_fb = sum(fbg) / len(fbg) if fbg else 0.0
        year = sb / 4 + avg_fb
        exam = st.get("scores", {}).get("exam")
        has_exam = isinstance(exam, (int, float)) and not isinstance(exam, bool)
        if not cls.get("has_exam"):
            final = year if ready else None
        else:
            final = 0.7 * year + 0.3 * exam if (ready and has_exam) else None
        return {"q": qres, "sb": sb, "avg_fb": avg_fb, "year": year, "ready": ready,
                "year_grade": grade5(year) if ready else None, "exam": exam if has_exam else None,
                "final": final, "final_grade": grade5(final) if final is not None else None}

    def quarter_result(self, cls, st, q, works):
        """O'quvchining chorak balli: BSB + CHSB + formativ (maks. 100) va tavsiya etilgan baho."""
        sc = st.get("scores", {})
        bsb = chsb = mb = mc = missing = 0
        for w in works:
            v = sc.get(w["id"])
            if w["type"] == "bsb":
                mb += w["max"]
            else:
                mc += w["max"]
            if isinstance(v, (int, float)):
                if w["type"] == "bsb":
                    bsb += v
                else:
                    chsb += v
            else:
                missing += 1                    # ball qo'yilmagan yoki yo'qlama belgisi
        fb, n_fb, avg = self.fb_info(cls, st, self.quarter_range(q))
        total = bsb + chsb + fb
        complete = mb == BSB_TOTAL and mc == CHSB_TOTAL and missing == 0
        return {"bsb": bsb, "chsb": chsb, "fb": fb, "n_fb": n_fb, "avg": avg, "total": total,
                "max_bsb": mb, "max_chsb": mc, "missing": missing, "complete": complete,
                "grade": grade5(total) if complete else None}

    def log_change(self, cls_name, student, date, old, new, kind="edit", **extra):
        """Qo'yilgan bahoning o'zgarishini tarixga yozadi (oxirgi 5000 ta saqlanadi)."""
        log = self.data.setdefault("changelog", [])
        entry = {"t": dt.datetime.now().isoformat(timespec="seconds"), "cls": cls_name,
                 "student": student, "date": date, "old": old, "new": new, "kind": kind}
        entry.update({k: v for k, v in extra.items() if v})
        log.append(entry)
        del log[:-5000]

    def report_rows(self, cls, lo, hi, q=None):
        """Davr bo'yicha o'quvchilar hisoboti. Dars kunlari: davrdagi X bo'lmagan va bugundan oshmagan sanalar.
        Davomat = (dars kunlari − S − DQ − K) / dars kunlari (KQ davomatga ta'sir qilmaydi; CH — chet elda — kunlari
        o'quvchining dars kunlaridan ham chiqariladi)."""
        today = dt.date.today().isoformat()
        dates = [d for d in cls["dates"] if lo <= d <= hi and d <= today and not self.is_nolesson(cls, d)]
        lessons = len(dates)
        risk = self.data["settings"]["risk"]
        has_q = bool(q and self.quarter_range(q))
        works = self.works_in_quarter(cls, q) if has_q else []
        bsb_taken = any(w["type"] == "bsb" and lo <= w["date"] <= min(hi, today) for w in cls.get("works", []))   # «baholar kam» qoidasi 1-BSB o'tgach ishga tushadi
        rows = []
        for st in cls["students"]:
            vals = [st["marks"][d] for d in dates if d in st["marks"]]
            gr = [g for m in vals for g in grades_of(m)]
            cnt = {m: count_att(vals, m) for m in ATT_MARKS}
            absent = cnt["s"] + cnt["dq"] + cnt["k"]
            n_ch = sum(1 for v in vals if v == CH_MARK)          # chet elda bo'lgan kunlar davomatga kirmaydi
            own = lessons - n_ch
            att = round(100.0 * (own - absent) / own, 1) if own > 0 else None
            avg = round(sum(gr) / len(gr), 2) if gr else None
            qr = self.quarter_result(cls, st, q, works) if has_q else None
            why = []
            on = risk["on"]
            if on.get("avg") and avg is not None and len(gr) >= max(1, int(risk.get("avg_min_grades", 3))) and avg < risk["avg_below"]:
                why.append(f"o'rtacha {avg:.1f} < {risk['avg_below']:g}")
            few = bool(on.get("few") and lessons and lessons >= int(risk.get("few_lt", 4)) and len(gr) < int(risk.get("few_lt", 4)))
            if few:                                               # shu kungacha jami baholar kam (BSB ni kutmaydi)
                why.append(f"shu kungacha {len(gr)} ta baho (< {int(risk.get('few_lt', 4))})")
            if not few and on.get("min_n") and risk.get("min_n") and lessons and bsb_taken and len(gr) < risk["min_n"]:
                why.append(f"baholar soni {len(gr)} < {risk['min_n']}")
            if on.get("att") and att is not None and att < risk["att_below"]:
                why.append(f"davomat {att:.0f}% < {risk['att_below']}%")
            if on.get("s") and cnt["s"] >= risk["s_ge"]:
                why.append(f"sababsiz {cnt['s']} ta")
            if on.get("qgrade") and qr and qr["complete"] and qr["grade"] == 2:
                why.append("chorak bahosi 2")
            if on.get("consec"):                                  # ketma-ket qoldirilgan darslar (eng uzun qator)
                run = best = 0
                for d in dates:
                    run = run + 1 if att_part(st["marks"].get(d, "")) in ("s", "dq", "k") else 0
                    best = max(best, run)
                if best >= max(2, int(risk.get("consec_ge", 3))):
                    why.append(f"ketma-ket {best} dars qoldirgan")
            if on.get("drop") and len(gr) >= 4:                    # baholar pasayish dinamikasi
                h = len(gr) // 2
                a1, a2 = sum(gr[:h]) / h, sum(gr[h:]) / len(gr[h:])
                if a1 - a2 >= float(risk.get("drop_ge", 1.5)):
                    why.append(f"baholar pasaymoqda ({a1:.1f} → {a2:.1f})")
            if on.get("work"):                                    # BSB / CHSB natijasi past
                for w in cls.get("works", []):
                    v = st.get("scores", {}).get(w["id"])
                    if lo <= w["date"] <= hi and isinstance(v, (int, float)) and not isinstance(v, bool) and w.get("max"):
                        pct = 100.0 * v / w["max"]
                        if pct < float(risk.get("work_below", 40)):
                            why.append(f"{w['type'].upper()} {fmt_date(w['date'])[:5]}: {pct:.0f}%")
            rows.append({"name": st["name"], "n": len(gr), "avg": avg, **cnt, "ch": n_ch, "absent": absent, "att": att,
                         "q": qr, "why": why, "risk": bool(why)})
        return rows, lessons, dates

    # — ranglar —
    def ranges(self):
        return sorted(self.data["settings"]["ranges"], key=lambda r: r["min"])

    def grade_color(self, value):
        color = None
        for r in self.ranges():
            if value >= r["min"]:
                color = r["color"]
        return color

    def mark_colors(self, mark):
        """(fon, matn) yoki None."""
        if not mark:
            return None
        gs = grades_of(mark)
        if gs:
            c = self.grade_color(sum(gs) / len(gs))
        else:
            c = self.data["settings"]["attendance"].get(mark)
        return (c, contrast(c)) if c else None


# ───────────────────────────── hisobotlar: hisoblash va eksport ─────────────────────────────
def risk_show(store, key):
    """Xavf ko'rsatish sozlamasi (checkbox): col_risk, col_reason, card, highlight, list, sheet."""
    return bool(store.data["settings"]["risk"]["show"].get(key, True))


REPORT_OPT_COLS = (("Baholar", "Baholar soni"), ("O'rtacha", "O'rtacha ball"), ("S", "S — sababsiz"), ("DQ", "DQ — sababli"),
                   ("K", "K — kasal"), ("KQ", "KQ — kech qoldi"), ("Qoldirgan", "Qoldirgan darslar"), ("Davomat %", "Davomat %"),
                   ("BSB", "BSB balli (chorak)"), ("CHSB", "CHSB balli (chorak)"), ("FB", "Formativ ball (chorak)"),
                   ("Ballar", "Jami ball (chorak)"), ("Baho", "Chorak bahosi"))
REPORT_PRESETS = {"Hammasi": None,
                  "Qisqa": ("Baholar", "O'rtacha", "Davomat %", "Baho"),
                  "Davomat": ("S", "DQ", "K", "KQ", "Qoldirgan", "Davomat %"),
                  "Baholar": ("Baholar", "O'rtacha", "BSB", "CHSB", "FB", "Ballar", "Baho")}


def _all_report_columns(q):
    cols = ["№", "O'quvchi", "Baholar", "O'rtacha", "S", "DQ", "K", "KQ", "Qoldirgan", "Davomat %"]
    if q:
        cols += ["BSB", "CHSB", "FB", "Ballar", "Baho"]
    return cols + ["Xavf", "Sabab"]


def report_columns(q, store=None):
    """Hisobot ustunlari. store berilsa — foydalanuvchi checkbox bilan yashirganlari chiqarib tashlanadi."""
    cols = _all_report_columns(q)
    if store is None:
        return cols
    hidden = store.data["settings"].get("report_cols", {})
    return [c for c in cols if (c in ("№", "O'quvchi") or hidden.get(c, True))
            and (c != "Xavf" or risk_show(store, "col_risk")) and (c != "Sabab" or risk_show(store, "col_reason"))]


def report_values(row, i, q, store=None):
    v = [i, row["name"], row["n"] or "", row["avg"] if row["avg"] is not None else "", row["s"] or "", row["dq"] or "",
         row["k"] or "", row["kq"] or "", row["absent"] or "", row["att"] if row["att"] is not None else ""]
    if q:
        r = row["q"]
        if r:
            v += [round(r["bsb"], 1) if r["max_bsb"] else "", round(r["chsb"], 1) if r["max_chsb"] else "", r["fb"],
                  round(r["total"], 1), r["grade"] if r["complete"] else "<100"]
        else:
            v += ["", "", "", "", ""]
    full = v + ["⚠" if row["risk"] else "", "; ".join(row["why"])]
    if store is None:
        return full
    keep = set(report_columns(q, store))
    return [x for name, x in zip(_all_report_columns(q), full) if name in keep]


def risk_summary(rows):
    avgs = [r["avg"] for r in rows if r["avg"] is not None]
    atts = [r["att"] for r in rows if r["att"] is not None]
    return {"avg": sum(avgs) / len(avgs) if avgs else None, "att": sum(atts) / len(atts) if atts else None,
            "risk": sum(1 for r in rows if r["risk"]), "n": len(rows)}


def period_title(lo, hi, q=None):
    return (f"{q}-chorak · " if q else "") + f"{fmt_date(lo)} – {fmt_date(hi)}"


def safe_name(text):
    return re.sub(r'[\\/:*?"<>|\s]+', "_", text).strip("_") or "hisobot"


def pdf_page_count(path):
    """PDF fayldagi sahifalar soni (fayl ichidagi /Type /Page belgilaridan)."""
    try:
        data = Path(path).read_bytes()
    except OSError:
        return 0
    return len(re.findall(rb"/Type\s*/Page(?![s\w])", data))


PDF_SCHEMES = {            # nom -> (asosiy to'q rang, kartochka foni, juft qator foni, qator chizig'i, sarlavha ostki matni); None — oq-qora (chop etish)
    "kok": ("Ko'k (standart)", ("#1f3a5f", "#e8f0fb", "#f1f5fa", "#e0e5ee", "#dbe6f5")),
    "yashil": ("Yashil", ("#1f5f3f", "#e6f4ec", "#f1faf4", "#dbeee2", "#d6f0e0")),
    "bordo": ("Bordo", ("#7a1f2e", "#f8e8ea", "#fbf2f3", "#ecdde0", "#f5d9de")),
    "binafsha": ("Binafsha", ("#4a2f7a", "#eee8f8", "#f6f2fb", "#e4dcf1", "#e3d9f5")),
    "oqqora": ("Oq-qora (chop etish uchun)", None),
}
_PDF_BASE_COLORS = ("#1f3a5f", "#e8f0fb", "#f1f5fa", "#e0e5ee", "#dbe6f5")
_PDF_DESIGN = {"scheme": "kok", "scale": 100, "margin": 10, "zebra": True, "layout": "zamonaviy"}


def set_pdf_design(d):
    dd = {"scheme": "kok", "scale": 100, "margin": 10, "zebra": True, "layout": "zamonaviy"}
    if isinstance(d, dict):
        dd.update({k: v for k, v in d.items() if k in dd})
    if dd["scheme"] not in PDF_SCHEMES:
        dd["scheme"] = "kok"
    if dd["layout"] not in ("zamonaviy", "klassik"):
        dd["layout"] = "zamonaviy"
    dd["scale"] = max(60, min(180, int(dd["scale"] or 100)))
    dd["margin"] = max(4, min(30, int(dd["margin"] or 10)))
    _PDF_DESIGN.update(dd)


def _lum(hexc):
    c = QColor(hexc)
    return 0.299 * c.red() + 0.587 * c.green() + 0.114 * c.blue()


def pdf_mono(html):
    """Oq-qora (chop etish) rejimi. Rang o'rniga kontekst bo'yicha almashtiriladi, shunda matn hech qachon fon bilan qo'shilib ketmaydi:
    fon (bgcolor / background) — och kulrang (asosiy sarlavha rangi — to'q kulrang), matn rangi — qora
    (sarlavha tasmasidagi och matn — oq), qolgan ranglar (chiziq, ramka) — kulrang."""
    accent = _PDF_BASE_COLORS[0].lower()

    def gray(v, light):
        g = round(_lum(v))
        g = max(170, 255 - round((255 - g) * 0.4)) if light else round(g * 0.6)
        return "#%02x%02x%02x" % (g, g, g)

    def fix(m):
        ctx, hx = m.group("ctx"), m.group("hex")
        low = ctx.lower().replace(" ", "")
        if low.startswith(("background", "bgcolor")):
            return ctx + ("#333333" if hx.lower() == accent else gray(hx, True))
        if "font" in m.group(0) or "=" in low:                      # <font color="..."> — sarlavha tasmasidagi och matn qoladi
            return ctx + (hx if _lum(hx) > 200 else "#1a1a1a")
        return ctx + "#000000"                                        # style="color:..." — doim qora (fonlar och bo'lgani uchun)
    rx = (r"(?P<ctx>background-color\s*:\s*|background\s*:\s*|bgcolor\s*=\s*[\"']?|"
          r"(?<![\w-])color\s*:\s*|(?<![\w-])color\s*=\s*[\"']?)(?P<hex>#[0-9a-fA-F]{6})")
    html = re.sub(rx, fix, html)
    # qolgan (ramka, chiziq) ranglari — kulrang; yuqorida ishlanganlar allaqachon kulrang (r==g==b)
    return re.sub(r"#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})\b",
                  lambda m: m.group(0) if m.group(1) == m.group(2) == m.group(3) else gray(m.group(0), True), html)


def pdf_restyle(html, scale):
    """HTML ga PDF dizaynini qo'llaydi: rang sxemasi (yoki oq-qora), qator zebra va shrift o'lchamlari masshtabi."""
    sch = PDF_SCHEMES[_PDF_DESIGN["scheme"]][1]
    if not _PDF_DESIGN["zebra"]:                         # juft qator foni — rang sxemasidan oldin olib tashlanadi
        html = re.sub(re.escape(_PDF_BASE_COLORS[2]), "#ffffff", html, flags=re.I)
    if sch:
        if sch != _PDF_BASE_COLORS:
            for a, b in zip(_PDF_BASE_COLORS, sch):
                html = re.sub(re.escape(a), b, html, flags=re.I)
    else:                                               # oq-qora: fonlar och kulrang, matn qora; sarlavha tasmasi — to'q kulrang + oq matn
        html = pdf_mono(html)
    if abs(scale - 1.0) > 0.001:
        html = re.sub(r"(font-size\s*:\s*)([\d.]+)(pt)", lambda m: f"{m.group(1)}{float(m.group(2)) * scale:.2f}{m.group(3)}", html)
    return html


def write_pdf_fit(path, html_fn, landscape=True, fs_max=12.0, fs_min=5.0, max_pages=None, scale_base=False, title=None):
    """Jadval bitta varaqqa sig'adigan eng katta shrift va eng keng qator oralig'ini tanlaydi: html_fn(shrift_pt, padding).
    Shrift ikkilik qidiruv bilan topiladi (har bir sinovda PDF yoziladi va sahifalar soni tekshiriladi).
    (shrift, padding) qaytariladi."""
    limit = [max_pages or 1]

    S_ = _PDF_DESIGN["scale"] / 100.0                           # masshtab: sig'dirish uchun yuqori shrift chegarasi o'zgaradi
    fs_max = fs_max * S_
    fs_min = fs_min * min(1.0, S_)

    def fits(fs, pad):
        write_pdf(path, html_fn(fs, pad), landscape, base_pt=fs if scale_base else 9, title=title, scale=1.0)
        return pdf_page_count(path) <= limit[0]

    sizes = [fs_max - 0.25 * i for i in range(int(round((fs_max - fs_min) / 0.25)) + 1)]      # kattadan kichikka
    if max_pages is None and not fits(sizes[-1], 0):
        return sizes[-1], 0
    if max_pages is None:
        pass
    else:                                                       # sahifalar soni — eng kichik shriftdagi natija (ortiqcha sahifa qo'shilmasin)
        fits(sizes[-1], 0)
        limit[0] = pdf_page_count(path)
    lo, hi = 0, len(sizes) - 1                                  # sizes[hi] sig'adi; eng kichik indeksni (eng katta shrift) izlaymiz
    while lo < hi:
        mid = (lo + hi) // 2
        if fits(sizes[mid], 1):
            hi = mid
        else:
            lo = mid + 1
    fs = sizes[hi]
    for pad in (6, 5, 4, 3, 2):                                 # shu shriftda eng keng qator oralig'i
        if fits(fs, pad):
            return fs, pad
    fits(fs, 1)
    return fs, 1


PDF_FONTS = {                       # nom -> shriftlar zanjiri (birinchi mavjud shrift olinadi); ö ğ ş ç harflari bor shriftlar
    "Libertinus Serif (Typst)": ["Libertinus Serif", "Linux Libertine O", "Linux Libertine", "Times New Roman",
                                 "Liberation Serif", "DejaVu Serif"],
    "Arial": ["Arial", "Liberation Sans", "Helvetica", "DejaVu Sans"],
    "Calibri": ["Calibri", "Carlito", "DejaVu Sans"],
    "Times New Roman": ["Times New Roman", "Liberation Serif", "DejaVu Serif"],
    "DejaVu Sans": ["DejaVu Sans", "Verdana", "Arial"],
    "Tizim shrifti": None,
}
_PDF_FONT = {"key": "Libertinus Serif (Typst)", "alpha": True, "sort": "default"}


def set_pdf_font(key):
    _PDF_FONT["key"] = key if key in PDF_FONTS else "Libertinus Serif (Typst)"


def pdf_base_font(size):
    f = QFont(QApplication.font())
    fam = PDF_FONTS.get(_PDF_FONT["key"])
    if fam:
        f.setFamilies(fam)
    f.setPointSizeF(size)
    return f


_UZ_APOS = "['\u2018\u2019\u02bb\u02bc\u02b9`\u00b4]"
_UZ_RE = re.compile(r"(?P<keep>(?<![A-Za-z])CH(?:SB)?(?![A-Za-z]))|([oOgG])" + _UZ_APOS + r"|[sS][hH]|[cC][hH]")


def uz_turkic_text(t):
    """Matndagi o', g', sh, ch ni ö, ğ, ş, ç ga almashtiradi (yakka turgan «CH» belgisi — chet elda — va «CHSB» o'zgarmaydi)."""
    def sub(m):
        g = m.group(0)
        if m.group("keep"):
            return g
        if m.group(2):
            return {"o": "ö", "O": "Ö", "g": "ğ", "G": "Ğ"}[m.group(2)]
        base = "ş" if g[0] in "sS" else "ç"
        return base.upper() if g[0].isupper() else base
    return _UZ_RE.sub(sub, t)


_CYR = {"а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "yo", "ж": "j", "з": "z", "и": "i", "й": "y",
        "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f",
        "х": "x", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "shch", "ъ": "'", "ы": "i", "ь": "", "э": "e", "ю": "yu",
        "я": "ya", "ў": "o'", "қ": "q", "ғ": "g'", "ҳ": "h"}
_CYR_VOWELS = set("аеёиоуэюяўы")
_CYR_RE = re.compile("[А-ЯЁЎҚҒҲа-яёўқғҳ]+")


def cyr_to_lat(t):
    """Kirill → o'zbek lotin (ru/uz): masalan «Ўқувчи» → «O'quvchi», «Щербаков» → «Shcherbakov»."""
    def word(m):
        w = m.group(0)
        up = len(w) > 1 and w.isupper()
        out = []
        for i, ch in enumerate(w):
            lo = ch.lower()
            r = _CYR[lo]
            if lo == "е" and (i == 0 or w[i - 1].lower() in _CYR_VOWELS or w[i - 1] in "ъЪ"):
                r = "ye"
            if ch != lo:                                        # bosh harf
                r = r.upper() if up else r[:1].upper() + r[1:]
            out.append(r)
        return "".join(out)
    return _CYR_RE.sub(word, t)


def uz_turkic_html(html):
    """PDF matni: kirill → lotin, so'ng o' g' sh ch → ö ğ ş ç. Faqat matn qismlariga qo'llanadi (teg va atributlarga tegilmaydi)."""
    out = []
    for part in re.split(r"(<[^>]*>)", html):
        if part.startswith("<"):
            out.append(part)
        else:
            part = part.replace("&#x27;", "'").replace("&#39;", "'").replace("&apos;", "'")
            part = cyr_to_lat(part)
            out.append(uz_turkic_text(part) if _PDF_FONT.get("alpha", True) else part)
    return "".join(out)


def pdf_font_combo(store):
    """Hisobot oynalari uchun umumiy shrift tanlash ro'yxati; tanlov sozlamalarda saqlanadi."""
    cb = QComboBox()
    for k in PDF_FONTS:
        cb.addItem(k, k)
    cb.setCurrentIndex(max(0, cb.findData(store.data["settings"].get("pdf_font", "Libertinus Serif (Typst)"))))
    cb.setToolTip("Barcha PDF hisobotlar (sinf hisoboti, o'quvchi varaqlari, BSB tahlili) shu shrift bilan chiqadi")

    def changed(_i):
        store.data["settings"]["pdf_font"] = cb.currentData()
        set_pdf_font(cb.currentData())
        store.save()
    cb.currentIndexChanged.connect(changed)
    set_pdf_font(cb.currentData())
    return cb


def name_key(n):
    """Ismlarni alifbo bo'yicha saralash kaliti (kirill ham lotinga o'girib solishtiriladi)."""
    return re.sub(r"[‘’ʻʼ`´′]", "'", cyr_to_lat(str(n))).casefold()


def sort_pdf_items(items, name_fn, extra=None):
    """PDF uchun o'quvchilar tartibi (sozlamadagi tanlov): az / za — alifbo; extra — {kalit: saralash funksiyasi}; aks holda o'zgarmaydi."""
    mode = _PDF_FONT.get("sort", "default")
    if mode in ("az", "za"):
        return sorted(items, key=lambda x: name_key(name_fn(x)), reverse=(mode == "za"))
    if extra and mode in extra:
        return sorted(items, key=extra[mode])
    return list(items)


def pdf_sort_combo(store, kind="journal"):
    """«Tartib» tanlovi: PDF hisobotlarida o'quvchilar qanday tartibda chiqishi. Tanlov sozlamalarda saqlanadi."""
    cb = QComboBox()
    cb.addItem("Ball bo'yicha (yuqoridan)" if kind == "bsb" else "Jurnal tartibida", "default")
    cb.addItem("Alifbo bo'yicha (A→Z)", "az")
    cb.addItem("Alifbo bo'yicha (Z→A)", "za")
    if kind == "report":
        cb.addItem("O'rtacha ball bo'yicha (yuqoridan)", "avg")
        cb.addItem("Davomat bo'yicha (pastdan)", "att")
    cur = store.data["settings"].get("pdf_sort", "default")
    cb.setCurrentIndex(max(0, cb.findData(cur)))
    _PDF_FONT["sort"] = cb.currentData()
    cb.setToolTip("PDF hisobotlarida o'quvchilar tartibi (raqamlar shu tartibda qayta qo'yiladi)")

    def changed(_i):
        store.data["settings"]["pdf_sort"] = cb.currentData()
        _PDF_FONT["sort"] = cb.currentData()
        store.save()
    cb.currentIndexChanged.connect(changed)
    return cb


def pdf_alpha_check(store):
    """«Yangi alifbo» belgisi: PDFda o'→ö, g'→ğ, sh→ş, ch→ç. Tanlov sozlamalarda saqlanadi va barcha PDFlarga qo'llanadi."""
    cb = QCheckBox("Yangi alifbo (ö, ğ, ş, ç)")
    cb.setToolTip("Belgilansa: o'→ö, g'→ğ, sh→ş, ch→ç. Belgilanmasa — oddiy o'zbek lotini (o', g', sh, ch). "
                  "Kirill ismlar har doim lotinga o'giriladi.")
    cb.setChecked(bool(store.data["settings"].get("pdf_new_alpha", True)))
    _PDF_FONT["alpha"] = cb.isChecked()

    def changed(on):
        store.data["settings"]["pdf_new_alpha"] = bool(on)
        _PDF_FONT["alpha"] = bool(on)
        store.save()
    cb.toggled.connect(changed)
    return cb


def center_th(html):
    """Jadval sarlavha (<th>) kataklaridagi matn gorizontal va vertikal o'rtada turadi."""
    def fix(m):
        attrs = re.sub(r'\s(?:align|valign)\s*=\s*("[^"]*"|\'[^\']*\'|\S+)', "", m.group(1))
        return f'<th{attrs} align="center" valign="middle">'
    return re.sub(r"<th\b([^>]*)>", fix, html)


def write_pdf(path, html, landscape=False, base_pt=9, title=None, scale=None):
    sc = _PDF_DESIGN["scale"] / 100.0 if scale is None else scale
    html = pdf_restyle(html, sc)
    base_pt = base_pt * sc
    writer = QPdfWriter(str(path))
    writer.setPageSize(QPageSize(QPageSize.PageSizeId.A4))
    writer.setPageOrientation(QPageLayout.Orientation.Landscape if landscape else QPageLayout.Orientation.Portrait)
    mg = _PDF_DESIGN["margin"]
    writer.setPageMargins(QMarginsF(mg, mg, mg, mg), QPageLayout.Unit.Millimeter)
    writer.setTitle(title or "Yo'qlama jurnali hisoboti")
    doc = QTextDocument()
    doc.setDefaultFont(pdf_base_font(base_pt))
    doc.setDocumentMargin(0)
    k = 96.0 / writer.resolution()                  # sahifa o'lchami mantiqiy (96 dpi) birliklarda — aks holda chetlar kattalashadi
    doc.setPageSize(QSizeF(writer.width() * k, writer.height() * k))
    doc.setHtml(center_th(uz_turkic_html(html)))
    doc.print_(writer)


PDF_BLUE = "#1f3a5f"
PDF_LINE = "#e0e5ee"          # jadval qatorlari orasidagi ingichka chiziq (katak ramkalari yo'q)


def _th(text, width=None, bg=PDF_BLUE):
    w = f' width="{width}%"' if width else ""
    return f'<th bgcolor="{bg}"{w}><font color="#ffffff">{esc(str(text))}</font></th>'


def _band(title, sub=""):
    """PDF sarlavha tasmasi: to'q ko'k fon, oq matn."""
    return (f'<table width="100%" cellspacing="0" cellpadding="5"><tr><td bgcolor="{PDF_BLUE}">'
            f'<font color="#ffffff" size="5"><b>{esc(title)}</b></font>'
            + (f'<br><font color="#dbe6f5" size="3">{sub}</font>' if sub else "") + "</td></tr></table>")


def _cards(items, bgs=None):
    """Ko'rsatkichlar kartochkalari qatori: [(nom, qiymat)]."""
    bgs = bgs or ["#e8f0fb"] * len(items)
    return ('<table width="100%" cellspacing="3" cellpadding="3"><tr>' + "".join(
        f'<td bgcolor="{bg}" align="center"><font color="#555555" size="2">{esc(str(k))}</font><br>'
        f'<span style="font-size:13pt;"><b>{esc(str(v))}</b></span></td>' for (k, v), bg in zip(items, bgs)) +
        "</tr></table>")


def _cell(text, bg=None, fg=None, align="center", bold=False):
    st = f"text-align:{align};border-bottom:2px solid {PDF_LINE};" + (f"background-color:{bg};" if bg else "") + (f"color:{fg};" if fg else "")
    t = esc(str(text)).replace("\n", "<br>")
    return f'<td style="{st}">' + (f"<b>{t}</b>" if bold else t) + "</td>"


def risk_list_html(rows, enabled):
    """PDF hisobotda alohida «Xavf ostidagi o'quvchilar» bloki (ism — sabablar)."""
    risky = [r for r in rows if r["risk"]]
    if not enabled or not risky:
        return ""
    items = "".join(f"<li><b>{esc(r['name'])}</b> — {esc('; '.join(r['why']))}</li>" for r in risky)
    return (f"<p style='margin-top:6px;margin-bottom:1px;color:#b71c1c;'><b>Xavf ostidagi o'quvchilar ({len(risky)}):</b></p>"
            f"<ul style='margin-top:0;margin-bottom:2px;'>{items}</ul>")


def report_html_modern(store, cls, lo, hi, q, rows, lessons, fs=8, pad=1):
    """Zamonaviy maket: ingichka sarlavha chizig'i, rangli chiziqli ko'rsatkichlar, och sarlavhali jadval, nolga teng qiymatlar xira."""
    A, LINE, CARD = _PDF_BASE_COLORS[0], _PDF_BASE_COLORS[3], _PDF_BASE_COLORS[1]
    sm = risk_summary(rows)
    allcols = report_columns(q)
    has_risk = any(r["risk"] for r in rows)
    shown_cols = report_columns(q, store)
    cols = [c for c in allcols if c in shown_cols and (has_risk or c not in ("Xavf", "Sabab"))]
    ex = store.data["settings"].get("report_extras", {})
    hl = risk_show(store, "highlight")
    rk = store.data["settings"]["risk"]
    wmap = {"№": 3, "O'quvchi": 20, "Baholar": 6.5, "O'rtacha": 7, "S": 4, "DQ": 4, "K": 4, "KQ": 4,
            "Qoldirgan": 7.5, "Davomat %": 8, "BSB": 5.5, "CHSB": 5.5, "FB": 4.5, "Ballar": 6, "Baho": 5.5, "Xavf": 4.5, "Sabab": 22}
    tot = sum(wmap[c] for c in cols)
    wmap = {c: round(wmap[c] * 100.0 / tot, 2) for c in cols}
    head = "".join(f'<th width="{wmap[c]}%" style="background-color:{CARD};color:{A};border-bottom:2px solid {A};">'
                   f'{esc(c)}</th>' for c in cols)
    gc = store.grade_color
    rows = sort_pdf_items(rows, lambda r: r["name"], {
        "avg": lambda r: -(r["avg"] if r["avg"] is not None else -1.0),
        "att": lambda r: (r["att"] if r["att"] is not None else 101.0)})
    zebra = _PDF_DESIGN.get("zebra", True)
    body = []
    for i, row in enumerate(rows, 1):
        vals = report_values(row, i, q)
        tds = []
        for c, v in zip(allcols, vals):
            if c not in cols:
                continue
            base = f"text-align:{'left' if c in (chr(79) + chr(39) + 'quvchi', 'Sabab') else 'center'};border-bottom:1px solid {LINE};"
            bg = _PDF_BASE_COLORS[2] if (zebra and i % 2 == 0) else None
            fg, bold, txt = None, False, v
            if c in ("BSB", "CHSB", "FB", "Ballar") and v == 0:
                txt, fg = "–", "#9aa5b8"                                   # nol — xira chiziqcha
            elif c == "Baho" and v == "<100":
                txt, fg = "–", "#9aa5b8"
            elif c in ("S", "DQ", "K", "KQ", "Qoldirgan", "Baholar") and v in ("", 0):
                txt = ""
            elif c == "Davomat %" and v != "":
                txt = f"{v:.0f}%" if float(v) == int(float(v)) else f"{v:.1f}%"
            if c == "O'rtacha" and row["avg"] is not None:
                bg, bold = gc(row["avg"]) or bg, True
                txt = f"{row['avg']:.1f}"
                fg = "#000000"
            elif c == "Ballar":
                bold = True
            elif c == "O'quvchi" and row["risk"] and hl:
                fg = "#b71c1c"
            elif c in ("Xavf", "Sabab") and row["risk"]:
                fg = "#b71c1c"
                if hl:
                    bg = "#fdecea"
            elif c == "Davomat %" and hl and rk["on"].get("att") and row["att"] is not None and row["att"] < rk["att_below"]:
                fg, bold = "#b71c1c", True
            st = base + (f"background-color:{bg};" if bg else "") + (f"color:{fg};" if fg else "")
            t = esc(str(txt)).replace("\n", "<br>")
            tds.append(f'<td style="{st}">' + (f"<b>{t}</b>" if bold else t) + "</td>")
        body.append("<tr>" + "".join(tds) + "</tr>")
    avg = f"{sm['avg']:.2f}" if sm["avg"] is not None else "—"
    att = f"{sm['att']:.1f}%" if sm["att"] is not None else "—"
    kp = [("Dars kunlari", lessons, A), ("O'quvchilar", sm["n"], A), ("O'rtacha ball", avg, "#2e7d32"), ("O'rtacha davomat", att, "#2e7d32")]
    if risk_show(store, "card"):
        kp.append(("Xavf ostida", sm["risk"], "#c62828" if sm["risk"] else A))
    cards = ('<table width="100%" cellspacing="0" cellpadding="3"><tr>' + "".join(
        f'<td style="border-left:3px solid {col};padding-left:8px;"><font color="#777777" size="2">{esc(k)}</font><br>'
        f'<span style="font-size:{fs + 6}pt;font-weight:bold;">{esc(str(v))}</span></td>' for k, v, col in kp) + "</tr></table>") if ex.get("cards", True) else ""
    title = (f'<table width="100%" cellspacing="0" cellpadding="3"><tr>'
             f'<td style="border-bottom:3px solid {A};"><span style="font-size:{fs + 9}pt;color:{A};font-weight:bold;">Sinf hisoboti</span>'
             f'<span style="font-size:{fs + 9}pt;color:#777777;"> &nbsp;{esc(cls_label(cls))}</span></td>'
             f'<td align="right" style="border-bottom:3px solid {A};color:#555555;">Davr: {esc(period_title(lo, hi, q))}</td></tr></table>')
    return (f"<style>td, th {{ font-size: {fs}pt; }}</style>" + title + "<p style='margin:2px;'></p>" + cards + "<p style='margin:3px;'></p>"
            + f'<table border="0" cellspacing="0" cellpadding="{pad + 1}" width="100%"><tr>{head}</tr>{"".join(body)}</table>'
            + risk_list_html(rows, risk_show(store, "list"))
            + (f"<p style='margin-top:4px;color:#777777;'><small>Davomat = (dars kunlari − S − DQ − K) / dars kunlari. Kechikish (KQ) davomatga ta'sir qilmaydi. "
               f"Hisobot sanasi: {fmt_date(dt.date.today().isoformat())}.</small></p>" if ex.get("footnote", True) else ""))


def report_html(store, cls, lo, hi, q, rows, lessons, fs=8, pad=1):
    if _PDF_DESIGN.get("layout", "zamonaviy") == "zamonaviy":
        return report_html_modern(store, cls, lo, hi, q, rows, lessons, fs, pad)
    sm = risk_summary(rows)
    allcols = report_columns(q)
    has_risk = any(r["risk"] for r in rows)
    shown_cols = report_columns(q, store)
    cols = [c for c in allcols if c in shown_cols and (has_risk or c not in ("Xavf", "Sabab"))]
    ex = store.data["settings"].get("report_extras", {})   # xavfli o'quvchi yo'q yoki o'chirilgan bo'lsa — ustunlar yo'q
    hl = risk_show(store, "highlight")
    rk = store.data["settings"]["risk"]
    wmap = {"№": 3, "O'quvchi": 19, "Baholar": 6, "O'rtacha": 6.5, "S": 4, "DQ": 4, "K": 4, "KQ": 4,
            "Qoldirgan": 7, "Davomat %": 7.5, "BSB": 5.5, "CHSB": 5.5, "FB": 4.5, "Ballar": 6, "Baho": 5.5, "Xavf": 4.5,
            "Sabab": 22}
    tot = sum(wmap[c] for c in cols)
    wmap = {c: round(wmap[c] * 100.0 / tot, 2) for c in cols}                      # jami kenglik aniq 100% (sahifa kengligi)
    head = "".join(_th(c, wmap[c]) for c in cols)
    body = []
    gc = store.grade_color
    rows = sort_pdf_items(rows, lambda r: r["name"], {
        "avg": lambda r: -(r["avg"] if r["avg"] is not None else -1.0),
        "att": lambda r: (r["att"] if r["att"] is not None else 101.0)})
    for i, row in enumerate(rows, 1):
        vals = report_values(row, i, q)
        tds = []
        for k, (c, v) in enumerate(zip(allcols, vals)):
            if c not in cols:
                continue
            bg = "#f1f5fa" if i % 2 == 0 else None
            if c == "O'rtacha" and row["avg"] is not None:
                bg = gc(row["avg"])
            elif hl and c in ("O'quvchi", "Xavf", "Sabab") and row["risk"]:
                bg = "#ffcdd2"
            elif hl and c == "Davomat %" and rk["on"].get("att") and row["att"] is not None and row["att"] < rk["att_below"]:
                bg = "#ffcdd2"
            tds.append(_cell(v, bg, "#000000" if bg else None, "left" if c in ("O'quvchi", "Sabab") else "center",
                             c in ("O'rtacha", "Ballar", "Baho")))
        body.append("<tr>" + "".join(tds) + "</tr>")
    avg = f"{sm['avg']:.2f}" if sm["avg"] is not None else "—"
    att = f"{sm['att']:.1f}%" if sm["att"] is not None else "—"
    return (f"<style>td, th {{ font-size: {fs}pt; }}</style>"
            + _band(f"Sinf hisoboti — {cls_label(cls)}", f"Davr: {esc(period_title(lo, hi, q))}")
            + (_cards([("Dars kunlari", lessons), ("O'quvchilar", sm["n"]), ("O'rtacha ball", avg),
                       ("O'rtacha davomat", att)] + ([("Xavf ostida", sm["risk"])] if risk_show(store, "card") else []),
                      ["#e8f0fb", "#e8f0fb", "#e3f4e6", "#e3f4e6"] + (["#fde3e3" if sm["risk"] else "#e8f0fb"] if risk_show(store, "card") else []))
               if ex.get("cards", True) else "")
            + f'<table border="0" cellspacing="0" cellpadding="{pad}" width="100%"><tr>{head}</tr>{"".join(body)}</table>'
            + risk_list_html(rows, risk_show(store, "list"))
            + (f"<p style='margin-top:3px;'><small>Davomat = (dars kunlari − S − DQ − K) / dars kunlari. Kechikish (KQ) davomatga ta'sir qilmaydi. "
               f"Hisobot sanasi: {fmt_date(dt.date.today().isoformat())}.</small></p>" if ex.get("footnote", True) else ""))


def student_sheet_html(store, cls, name, lo, hi, q, first=True):
    rows, lessons, dates = store.report_rows(cls, lo, hi, q)
    row = next((r for r in rows if r["name"] == name), None)
    st = next((s for s in cls["students"] if s["name"] == name), None)
    if row is None or st is None:
        return ""
    avg = f"{row['avg']:.2f}" if row["avg"] is not None else "—"
    att = f"{row['att']:.1f}%" if row["att"] is not None else "—"
    html = ['<div style="page-break-before: always;">' if not first else "<div>"]
    html.append(_band(name, f"{esc(cls_label(cls))} &nbsp;·&nbsp; davr: {esc(period_title(lo, hi, q))}"))
    cells = [("Baholar soni", row["n"]), ("O'rtacha ball", avg), ("Dars kunlari", lessons),
             ("Qoldirgan (S+DQ+K)", row["absent"]), ("Davomat", att), ("Kechikkan (KQ)", row["kq"])]
    html.append(_cards(cells, ["#e8f0fb", "#e3f4e6", "#e8f0fb", "#fde3e3" if row["absent"] else "#e8f0fb",
                               "#e3f4e6", "#fff4d6"]))
    html.append(f"<p style='margin-top:3px;margin-bottom:3px;'>Sababsiz: <b>{row['s']}</b> &nbsp;·&nbsp; sababli: <b>{row['dq']}</b> &nbsp;·&nbsp; "
                f"kasal: <b>{row['k']}</b></p>")
    r = row["q"]
    if r:
        g = f"{r['grade']}" if r["complete"] else "&lt;100 (ishlar tugallanmagan)"
        html.append(f"<p style='margin-top:3px;margin-bottom:3px;'><b>{q}-chorak umumiy balli:</b> BSB <b>{fmt_num(round(r['bsb'], 1))}</b>/{BSB_TOTAL} &nbsp;·&nbsp; "
                    f"CHSB <b>{fmt_num(round(r['chsb'], 1))}</b>/{CHSB_TOTAL} &nbsp;·&nbsp; formativ <b>{r['fb']}</b>/{FB_TOTAL}"
                    f" &nbsp;=&nbsp; <b>{fmt_num(round(r['total'], 1))}</b> / 100 &nbsp;·&nbsp; tavsiya etilgan baho: <b>{g}</b></p>")
    if row["risk"] and risk_show(store, "sheet"):
        html.append(f"<p style='color:#b71c1c;margin-top:3px;margin-bottom:3px;'><b>E'tibor talab etadi:</b> {esc('; '.join(row['why']))}.</p>")
    items = [(d, st["marks"][d]) for d in sorted(st["marks"]) if lo <= d <= hi and not store.is_nolesson(cls, d)]
    html.append('<p style="margin-top:6px;margin-bottom:2px;"><b>Baholar va yo\'qlama</b></p>')
    if items:
        per = 4
        trs = []
        for k in range(0, len(items), per):
            tds = []
            for d, m in items[k:k + per]:
                col = store.mark_colors(m)
                tds.append(_cell(f"{d[8:]}.{d[5:7]}", None, None, "center") +
                           _cell(display_mark(m), col[0] if col else None, col[1] if col else None, "center", True))
            tds += ["<td></td><td></td>"] * (per - len(items[k:k + per]))
            trs.append("<tr>" + "".join(tds) + "</tr>")
        head = "".join(_th("Sana") + _th("Belgi") for _ in range(per))
        html.append(f'<table border="0" cellspacing="0" cellpadding="2" width="100%"><tr>{head}</tr>{"".join(trs)}</table>')
    else:
        html.append("<p>Bu davrda belgi qo'yilmagan.</p>")
    html.append(f"<p><small>S — sababsiz, DQ — sababli, K — kasal, KQ — kech qoldi. "
                f"Sana: {fmt_date(dt.date.today().isoformat())}</small></p>"
                "<p>&nbsp;</p><p>O'qituvchi imzosi: ____________________ &nbsp;&nbsp;&nbsp;&nbsp; "
                "Ota-ona imzosi: ____________________</p></div>")
    return "".join(html)


def export_xlsx(path, store, cls, lo, hi, q, rows, lessons):
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill
    from openpyxl.utils import get_column_letter

    def fill(hex_color):
        return PatternFill("solid", fgColor=hex_color.lstrip("#"))

    wb = Workbook()
    ws = wb.active
    ws.title = "Hisobot"
    ws["A1"] = f"Sinf hisoboti — {cls_label(cls)}"
    ws["A1"].font = Font(bold=True, size=14)
    sm = risk_summary(rows)
    ws["A2"] = (f"Davr: {period_title(lo, hi, q)} · dars kunlari: {lessons} · o'quvchilar: {sm['n']}"
                + (f" · xavf ostida: {sm['risk']}" if risk_show(store, "card") else ""))
    cols = report_columns(q, store)
    for c, name in enumerate(cols, 1):
        cell = ws.cell(row=4, column=c, value=name)
        cell.font, cell.fill = Font(bold=True), fill("#d9d9d9")
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    for i, row in enumerate(rows, 1):
        for c, (name, v) in enumerate(zip(cols, report_values(row, i, q, store)), 1):
            cell = ws.cell(row=4 + i, column=c, value=(None if v == "" else v))
            cell.alignment = Alignment(horizontal="left" if name in ("O'quvchi", "Sabab") else "center")
            if name == "O'rtacha" and row["avg"] is not None:
                cell.number_format = "0.00"
                if store.grade_color(row["avg"]):
                    cell.fill = fill(store.grade_color(row["avg"]))
            elif name == "Davomat %":
                cell.number_format = "0.0"
            if row["risk"] and name in ("O'quvchi", "Xavf", "Sabab") and risk_show(store, "highlight"):
                cell.fill = fill("#ffcdd2")
    widths = {"№": 5, "O'quvchi": 30, "Sabab": 46}
    for c, name in enumerate(cols, 1):
        ws.column_dimensions[get_column_letter(c)].width = widths.get(name, 11)
    ws.freeze_panes = "C5"
    ws.auto_filter.ref = f"A4:{get_column_letter(len(cols))}{4 + len(rows)}"

    wj = wb.create_sheet("Jurnal")
    dates = [d for d in cls["dates"] if lo <= d <= hi]
    wj.cell(row=1, column=1, value="№").font = Font(bold=True)
    wj.cell(row=1, column=2, value="O'quvchi").font = Font(bold=True)
    for k, d in enumerate(dates, 3):
        c = wj.cell(row=1, column=k, value=f"{d[8:]}.{d[5:7]}")
        c.font, c.alignment = Font(bold=True), Alignment(horizontal="center")
        wj.column_dimensions[get_column_letter(k)].width = 7
    wj.column_dimensions["B"].width = 30
    for r, st in enumerate(cls["students"], 2):
        wj.cell(row=r, column=1, value=r - 1)
        wj.cell(row=r, column=2, value=st["name"])
        for k, d in enumerate(dates, 3):
            m = st["marks"].get(d, "")
            nolesson = store.is_nolesson(cls, d)
            text = "X" if nolesson else display_mark(m).replace("\n", " ")
            cell = wj.cell(row=r, column=k, value=text or None)
            cell.alignment = Alignment(horizontal="center")
            col = store.mark_colors("x" if nolesson else m)
            if col:
                cell.fill = fill(col[0])
    wj.freeze_panes = "C2"
    lessons = {d: v for d, v in cls.get("lessons", {}).items() if lo <= d <= hi}
    if lessons:
        wl = wb.create_sheet("Mavzular")
        for k, name in enumerate(("Sana", "Hafta kuni", "Dars mavzusi", "Uy vazifasi"), 1):
            c = wl.cell(row=1, column=k, value=name)
            c.font, c.fill = Font(bold=True), fill("#d9d9d9")
        for r, d in enumerate(sorted(lessons), 2):
            wl.cell(row=r, column=1, value=fmt_date(d))
            wl.cell(row=r, column=2, value=WEEKDAYS_FULL[dt.date.fromisoformat(d).weekday()])
            wl.cell(row=r, column=3, value=lessons[d].get("topic", ""))
            wl.cell(row=r, column=4, value=lessons[d].get("hw", ""))
        for col, wd in zip("ABCD", (12, 14, 46, 46)):
            wl.column_dimensions[col].width = wd
    wb.save(str(path))


# ───────────────────────────── ko'rinish davri ─────────────────────────────
VIEW_MODES = (("day", "Kun"), ("week", "Hafta"), ("month", "Oy"), ("quarter", "Chorak"))


class ViewState:
    """Kun / hafta / oy ko'rinishi: barcha sinf varaqlari uchun umumiy davr."""

    def __init__(self, mode="month", anchor=None):
        self.mode = mode if mode in dict(VIEW_MODES) else "month"
        self.anchor = anchor or dt.date.today()
        self.notify = None
        self.store = None                              # choraklik ko'rinish uchun chorak sanalari (MainWindow o'rnatadi)

    def quarter_no(self):
        """anchor tegishli chorak raqami; chorak oralig'ida bo'lmasa (ta'til) — eng yaqin keyingi, u ham bo'lmasa oxirgi chorak."""
        if not self.store:
            return None
        iso = self.anchor.isoformat()
        q = self.store.quarter_of(iso)
        if q:
            return q
        rng = [(i, self.store.quarter_range(i)) for i in range(1, 5) if self.store.quarter_range(i)]
        if not rng:
            return None
        nxt = [i for i, r in rng if r[0] > iso]
        return nxt[0] if nxt else rng[-1][0]

    def changed(self):
        if self.notify:
            self.notify()

    def range(self):
        a = self.anchor
        if self.mode == "day":
            return a, a
        if self.mode == "week":                       # dushanba — yakshanba
            st = a - dt.timedelta(days=a.weekday())
            return st, st + dt.timedelta(days=6)
        if self.mode == "quarter":
            q = self.quarter_no()
            if q:
                lo, hi = self.store.quarter_range(q)
                return dt.date.fromisoformat(lo), dt.date.fromisoformat(hi)
            # chorak sanalari belgilanmagan — oy ko'rinishiga qaytadi
        return a.replace(day=1), a.replace(day=calendar.monthrange(a.year, a.month)[1])

    def bounds(self):
        st, en = self.range()
        return st.isoformat(), en.isoformat()

    def contains(self, iso):
        st, en = self.bounds()
        return st <= iso <= en

    def shift(self, n):
        a = self.anchor
        if self.mode == "day":
            self.anchor = a + dt.timedelta(days=n)
        elif self.mode == "week":
            self.anchor = a + dt.timedelta(days=7 * n)
        elif self.mode == "quarter" and self.quarter_no():
            qs = [i for i in range(1, 5) if self.store.quarter_range(i)]
            k = qs.index(self.quarter_no()) + n
            if 0 <= k < len(qs):
                q = qs[k]
                lo, hi = (dt.date.fromisoformat(x) for x in self.store.quarter_range(q))
                today = dt.date.today()
                self.anchor = today if lo <= today <= hi else lo
        else:
            m = a.month - 1 + n
            y, m = a.year + m // 12, m % 12 + 1
            self.anchor = dt.date(y, m, min(a.day, calendar.monthrange(y, m)[1]))

    def title(self):
        st, en = self.range()
        if self.mode == "day":
            return f"{st:%d.%m.%Y} · {WEEKDAYS_FULL[st.weekday()]}"
        if self.mode == "week":
            return f"{st:%d.%m} – {en:%d.%m.%Y} · {st.isocalendar()[1]}-hafta"
        if self.mode == "quarter" and self.quarter_no():
            return f"{self.quarter_no()}-chorak · {st:%d.%m} – {en:%d.%m.%Y}"
        return f"{MONTHS_UZ[st.month - 1]} {st.year}"


# ───────────────────────────── baholarni himoyalash ─────────────────────────────
def make_pin(pin):
    salt = os.urandom(16)
    h = hashlib.pbkdf2_hmac("sha256", pin.encode("utf-8"), salt, 200_000)
    return {"salt": salt.hex(), "hash": h.hex(), "iters": 200_000}


def check_pin(pin, rec):
    try:
        h = hashlib.pbkdf2_hmac("sha256", pin.encode("utf-8"), bytes.fromhex(rec["salt"]), int(rec["iters"]))
        return hmac.compare_digest(h.hex(), rec["hash"])
    except (KeyError, ValueError, TypeError):
        return False


class Guard(QObject):
    """Qo'yilgan baholarni tasodifan yoki ruxsatsiz o'zgartirishdan himoya: qulf, ixtiyoriy parol, avto-qulf.
    Bo'sh kataklarga yangi baho qo'yish har doim erkin; mavjud baho faqat qulf ochiqligida o'zgaradi."""
    changed = Signal()

    def __init__(self, store, parent=None):
        super().__init__(parent)
        self.store = store
        self._unlocked = False
        self.timer = QTimer(self)
        self.timer.setSingleShot(True)
        self.timer.timeout.connect(self.lock)

    @property
    def cfg(self):
        return self.store.data["settings"]["protect"]

    def enabled(self):
        return bool(self.cfg.get("enabled", True))

    def has_pin(self):
        return bool(self.cfg.get("pin"))

    def is_locked(self):
        return self.enabled() and not self._unlocked

    def lock(self):
        self._unlocked = False
        self.timer.stop()
        self.changed.emit()

    def touch(self):
        """Qulf ochiq bo'lsa, harakatsizlik taymerini qayta boshlaydi."""
        mins = int(self.cfg.get("auto_lock_min", 10) or 0)
        if self._unlocked and mins > 0:
            self.timer.start(mins * 60_000)

    def unlock(self, parent=None, reason=""):
        if not self.is_locked():
            self.touch()
            return True
        head = (reason + "\n\n") if reason else ""
        if self.has_pin():
            pin, ok = QInputDialog.getText(parent, "Qulfni ochish", head + "Parolni kiriting:",
                                           QLineEdit.EchoMode.Password)
            if not ok:
                return False
            if not check_pin(pin, self.cfg["pin"]):
                QMessageBox.warning(parent, "Parol", "Parol noto'g'ri.")
                return False
        elif QMessageBox.question(parent, "Himoyalangan baho",
                                  head + "Qulfni ochib, o'zgartirishga ruxsat berasizmi?"
                                  ) != QMessageBox.StandardButton.Yes:
            return False
        self._unlocked = True
        self.touch()
        self.changed.emit()
        return True

    def require(self, parent, reason=""):
        """Mavjud baholarni o'zgartiradigan amal oldidan: qulf ochiq bo'lsa True, yopiq bo'lsa ochishni so'raydi."""
        if not self.is_locked():
            self.touch()
            return True
        return self.unlock(parent, reason)


# ───────────────────────────── jadval ─────────────────────────────
class MarkDelegate(QStyledItemDelegate):
    def __init__(self, parent=None, view=None):
        super().__init__(parent)
        self.view = view

    def createEditor(self, parent, option, index):
        if self.view is not None and not self.view.can_edit_cell(index.row(), index.column()):
            return None
        e = QLineEdit(parent)
        e.setAlignment(Qt.AlignmentFlag.AlignCenter)
        e.setMaxLength(9)
        e.setValidator(QRegularExpressionValidator(
            QRegularExpression(r"^[0-9/ ,+kqsdchKQSDCH]{0,9}$"), e))
        return e

    def setEditorData(self, editor, index):
        raw = index.data(Qt.ItemDataRole.UserRole)
        editor.setText(raw.upper() if raw else (index.data(Qt.ItemDataRole.EditRole) or ""))
        editor.selectAll()

    def setModelData(self, editor, model, index):
        model.setData(index, editor.text().strip().upper(), Qt.ItemDataRole.EditRole)


class MarkTable(QTableWidget):
    on_delete = None
    on_copy = None
    on_paste = None
    on_undo = None

    def closeEditor(self, editor, hint):
        super().closeEditor(editor, hint)
        # Enter bosilganda — pastdagi o'quvchiga o'tish (emaktab kabi)
        if hint == QAbstractItemDelegate.EndEditHint.SubmitModelCache:
            r, c = self.currentRow(), self.currentColumn()
            if r + 1 < self.rowCount():
                self.setCurrentCell(r + 1, c)

    def keyPressEvent(self, e):
        if (e.key() in (Qt.Key.Key_Delete, Qt.Key.Key_Backspace)
                and self.state() != QAbstractItemView.State.EditingState and self.on_delete):
            self.on_delete()
            return
        if self.state() != QAbstractItemView.State.EditingState:
            if self.on_copy and e.matches(QKeySequence.StandardKey.Copy):
                self.on_copy()
                return
            if self.on_paste and e.matches(QKeySequence.StandardKey.Paste):
                self.on_paste()
                return
        super().keyPressEvent(e)


class ClassView(QWidget):
    NSUM = 5  # O'rtacha, S, DQ, K, KQ

    def __init__(self, store, cls, view, guard):
        super().__init__()
        self.store, self.cls, self.view, self.guard = store, cls, view, guard
        self.undo_stack = []            # Ctrl+Z uchun: so'nggi o'zgarishlar paketlari (shu seans, shu jurnal)
        self.today = dt.date.today()

        outer = QVBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)
        self.stack = QStackedWidget()                    # sahifa (Jurnal / Summativ / Yillik) tugmalari asosiy oynada — hamma sinf uchun umumiy
        outer.addWidget(self.stack, 1)
        page = QWidget()
        self.stack.addWidget(page)
        lay = QVBoxLayout(page)
        bar = FlowLayout()
        for text, slot in (("+ Sana", self.add_date), ("− Sana", self.remove_date)):
            b = QPushButton(text)
            b.clicked.connect(slot)
            bar.addWidget(b)
        self.xbtn = QPushButton()
        self.xbtn.clicked.connect(lambda _=False: self.toggle_x())
        bar.addWidget(self.xbtn)
        self.stbtn = QPushButton("O'quvchi ▾")
        self.stbtn.setToolTip("O'quvchilarni qo'shish, ismini o'zgartirish yoki olib tashlash")
        stmenu = QMenu(self.stbtn)
        stmenu.addAction("＋ O'quvchi qo'shish…", lambda: self.add_students())
        stmenu.addAction("✎ Tanlangan o'quvchi ismini o'zgartirish…", lambda: self.rename_student())
        stmenu.addAction("− Tanlangan o'quvchini olib tashlash…", lambda: self.remove_students())
        stmenu.addSeparator()
        stmenu.addAction("📇 Tanlangan o'quvchi kartochkasi…", lambda: self.show_card())
        stmenu.addAction("⭐ Kuzatuvga qo'shish / olib tashlash", lambda: self.toggle_star())
        stmenu.addAction("📈 Tanlangan o'quvchi o'sish grafigi…", lambda: self.show_growth())
        self.stbtn.setMenu(stmenu)
        bar.addWidget(self.stbtn)
        self.fast_btn = QPushButton("⚡ Tezkor davomat")
        self.fast_btn.setToolTip("Bugungi dars uchun davomatni klaviatura bilan tez belgilash (Ctrl+D)")
        self.fast_btn.clicked.connect(lambda _=False: self.fast_attendance())
        bar.addWidget(self.fast_btn)
        QShortcut(QKeySequence("Ctrl+D"), self, self.fast_attendance)
        self.marks_btn = QPushButton()
        self.marks_btn.setCheckable(True)
        self.marks_btn.setToolTip("Tezkor belgi tugmalari (1–10, S, DQ, K, KQ, CH) qatorini ko'rsatish / yashirish")
        bar.addWidget(self.marks_btn)
        bar.addStretch()
        lay.addWidget(FlowBox(bar))
        self.marks_box = QWidget()
        bar = FlowLayout(self.marks_box)
        bar.addWidget(QLabel("Tanlangan kataklarga:"))
        self.quick = []
        for val in [str(i) for i in range(1, 11)] + list(ATT_MARKS) + [CH_MARK, ""]:
            b = QPushButton(display_mark(val) if val else "⌫")
            b.setMinimumWidth(S(30))
            b.setToolTip("Tozalash" if not val else (
                "Kech qoldi — baho bilan birga qo'shiladi; qayta bosilsa olib tashlanadi" if val == "kq"
                else (ABSENT_NAMES.get(val) or f"{val} baho (kech qolish belgisi saqlanadi; «＋2» yoqilsa — ikkinchi baho)")))
            b.clicked.connect(lambda _=False, v=val: self.apply_selected(v))
            self.quick.append((val, b))
            bar.addWidget(b)
            if val == "10":
                self.btn2 = QPushButton("＋2")
                self.btn2.setCheckable(True)
                self.btn2.setMinimumWidth(S(30))
                self.btn2.setToolTip("Yoqilgan bo'lsa, baho tugmasi mavjud bahoni almashtirmaydi — uni ikkinchi baho "
                                     "sifatida qo'shadi (bir katakda 2 ta baho)")
                self.btn2.setStyleSheet("QPushButton:checked{background:#ffca28;color:#000000;font-weight:bold;}")
                bar.addWidget(self.btn2)
        lay.addWidget(self.marks_box)
        qm = store_settings(self.store).get("quick_marks")
        if qm is None:
            qm = (QGuiApplication.primaryScreen().availableGeometry().height() >= 800) if QGuiApplication.primaryScreen() else True
        self.marks_btn.setChecked(bool(qm))
        self.marks_btn.toggled.connect(self.on_marks_toggled)
        self.on_marks_toggled(bool(qm), save=False)

        t = self.table = MarkTable()
        t.setItemDelegate(MarkDelegate(t, self))
        t.setSelectionMode(QAbstractItemView.SelectionMode.ExtendedSelection)
        t.setEditTriggers(QAbstractItemView.EditTrigger.AnyKeyPressed
                          | QAbstractItemView.EditTrigger.DoubleClicked
                          | QAbstractItemView.EditTrigger.EditKeyPressed)
        t.verticalHeader().setDefaultSectionSize(RH())
        t.verticalHeader().setDefaultAlignment(Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignVCenter)
        t.horizontalHeader().setDefaultSectionSize(S(48))
        t.horizontalHeader().setFixedHeight(S(46))
        t.on_delete = lambda: self.apply_selected("")
        t.on_copy = self.copy_selected
        t.on_paste = self.paste_cells
        t.itemChanged.connect(self.on_changed)
        t.currentCellChanged.connect(self.on_current)
        t.cellDoubleClicked.connect(self.on_double)
        t.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        t.customContextMenuRequested.connect(self.cell_menu)
        hh = t.horizontalHeader()
        hh.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        hh.customContextMenuRequested.connect(self.header_menu)
        hh.sectionDoubleClicked.connect(lambda c: self.edit_lesson(c))
        vh = t.verticalHeader()
        vh.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        vh.customContextMenuRequested.connect(self.row_menu)
        self.empty = QLabel()
        self.empty.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.empty.setWordWrap(True)
        self.empty.setStyleSheet("padding:6px;font-style:italic;")
        self.empty.hide()
        lay.addWidget(self.empty)
        lay.addWidget(t, 1)

        self.info_stud = InfoRow()                      # 1-qator: o'quvchi
        self.info_date = InfoRow()                      # 2-qator: sana, sinf, mavzu
        lay.addWidget(self.info_stud)
        lay.addWidget(self.info_date)

        self.rebuild()
        self.select_default(0)
        self.summ = SummativeView(self)
        self.stack.addWidget(self.summ)
        self.year = YearView(self)
        self.stack.addWidget(self.year)

    def set_page(self, k, refresh=True):
        self.stack.setCurrentIndex(k)
        if refresh:
            self.refresh_page()

    def refresh_page(self):
        k = self.stack.currentIndex()
        if k == 1:
            self.summ.refresh()
        elif k == 2:
            self.year.refresh()

    def summ_refresh(self):
        for name in ("summ", "year"):
            s = getattr(self, name, None)
            if s is not None:
                s.refresh()

    # — qurilish —
    @property
    def dates(self):
        return self.cls["dates"]

    @property
    def students(self):
        return self.cls["students"]

    def rebuild(self):
        self.today = dt.date.today()
        t, nd = self.table, len(self.dates)
        with blocked(t):
            t.clear()
            t.setRowCount(len(self.students))
            t.setColumnCount(nd + self.NSUM + 1)                  # oxirgi ustun — faqat kun rejimidagi «Ball» ustuni
            for r in range(len(self.students)):
                t.setRowHeight(r, 38 if self.view.mode == "day" else 30)
            for c, d in enumerate(self.dates):
                t.setHorizontalHeaderItem(c, self._header_item(d))
            hb = QTableWidgetItem("Ball")
            hb.setFont(self._bold(10))
            hb.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            t.setHorizontalHeaderItem(self.ball_col(), hb)
            for k, name in enumerate(["O'rtacha"] + [m.upper() for m in ATT_MARKS]):
                h = QTableWidgetItem(name)
                h.setFont(self._bold(10))
                t.setHorizontalHeaderItem(nd + k, h)
                t.setColumnWidth(nd + k, S(74 if k == 0 else 44))
            for r, s in enumerate(self.students):
                t.setVerticalHeaderItem(r, QTableWidgetItem(f"{r + 1}. {'⭐ ' if s.get('star') else ''}{s['name']}"))
                for c in range(nd):
                    it = QTableWidgetItem()
                    it.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                    it.setFont(self._bold(self.cell_pt()))
                    t.setItem(r, c, it)
                for k in range(self.NSUM):
                    it = QTableWidgetItem()
                    it.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                    it.setFlags(Qt.ItemFlag.ItemIsEnabled)
                    it.setFont(self._bold(11))
                    t.setItem(r, nd + k, it)
                ib = QTableWidgetItem()
                ib.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                ib.setFont(self._bold(self.cell_pt()))
                t.setItem(r, self.ball_col(), ib)
            self.repaint_all(_inner=True)
        self.apply_columns()

    def ball_col(self):
        return len(self.dates) + self.NSUM

    def day_mode(self):
        return self.view.mode == "day"

    def date_idx(self, c):
        """Ustun → sana indeksi (kun rejimidagi «Ball» ustuni ham shu kunga tegishli); sana ustuni bo'lmasa -1."""
        nd = len(self.dates)
        if 0 <= c < nd:
            return c
        if c == self.ball_col() and self.day_mode():
            vis = self.vis_cols()
            return vis[0] if vis else -1
        return -1

    def cell_pt(self):
        return {"day": 18, "week": 13}.get(self.view.mode, 11)

    @staticmethod
    def _bold(size):
        f = QFont()
        f.setBold(True)
        f.setPointSize(size)
        return f

    def _header_item(self, iso):
        d = dt.date.fromisoformat(iso)
        if self.view.mode == "day":
            text = f"{d.day:02d}.{d.month:02d}.{d.year} · {WEEKDAYS[d.weekday()]}\nDavomat"
        elif self.view.mode == "week":
            text = f"{d.day:02d}.{d.month:02d}\n{WEEKDAYS_FULL[d.weekday()]}"
        else:
            text = f"{d.day:02d}.{d.month:02d}\n{WEEKDAYS[d.weekday()]}"
        les = self.cls.get("lessons", {}).get(iso)
        if les:
            text += "•"
        h = QTableWidgetItem(text)
        h.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
        nl = self.store.is_nolesson(self.cls, iso)
        tip = []
        if nl:
            tip.append("Dars yo'q (X). O'ng tugma bilan X ni olib tashlash mumkin.")
        if les:
            tip.append("Mavzu: " + (les.get("topic") or "—"))
            if les.get("hw"):
                tip.append("Uy vazifasi: " + les["hw"])
        if tip:
            h.setToolTip("\n".join(tip))
        th = self.store.theme()
        if d == self.today:
            h.setBackground(QBrush(QColor(th["hdr_today"])))
            h.setForeground(QBrush(QColor("#000000")))
            h.setFont(self._bold(10))
        elif nl:
            h.setBackground(QBrush(QColor(th["hdr_x"])))
            h.setForeground(QBrush(QColor(th["hdr_x_fg"])))
        elif d < self.today:
            h.setBackground(QBrush(QColor(th["hdr_past"])))
            h.setForeground(QBrush(QColor(th["hdr_past_fg"])))
        return h

    # — bo'yash —
    def paint(self, r, c):
        it = self.table.item(r, c)
        d = self.dates[c]
        base = Qt.ItemFlag.ItemIsSelectable | Qt.ItemFlag.ItemIsEnabled
        day = self.day_mode()
        ib = self.table.item(r, self.ball_col()) if (day and c == self.date_idx(self.ball_col())) else None   # «Ball» ustuni — faqat ko'rinayotgan kun uchun
        if self.store.is_nolesson(self.cls, d):       # dars yo'q kuni: X, tahrirlab bo'lmaydi
            bgx = self.store.data["settings"]["attendance"]["x"]
            for w in (it, ib):
                if w is not None:
                    w.setFlags(base)
                    w.setText("X")
                    w.setBackground(QBrush(QColor(bgx)))
                    w.setForeground(QBrush(QColor(contrast(bgx))))
            return
        m = self.students[r]["marks"].get(d, "")
        if not day:
            self._style_cell(it, d, m, display_mark(m), m, shrink_for=m)
            return
        ap, sp = att_part(m), score_part(m)
        self._style_cell(it, d, ap, ap.upper(), ap)                     # davomat ustuni
        if ib is not None:
            self._style_cell(ib, d, sp, sp, sp)                         # ball ustuni

    def _style_cell(self, it, d, mark, text, raw, shrink_for=None):
        fl = Qt.ItemFlag.ItemIsSelectable | Qt.ItemFlag.ItemIsEnabled
        it.setFlags(fl | Qt.ItemFlag.ItemIsEditable if self.is_today(d) else fl)    # o'tgan va kelgusi kunlar — faqat ko'rish
        it.setText(text)
        it.setData(Qt.ItemDataRole.UserRole, raw)
        shrink = 0
        if shrink_for is not None:
            gs = grades_of(shrink_for)
            shrink = (4 if len(gs) == 2 else 3) if (gs and late_of(shrink_for)) else (1 if len(gs) == 2 else 0)
        it.setFont(self._bold(max(7, self.cell_pt() - shrink)))
        colors = self.store.mark_colors(mark)
        if colors:
            bg, fg = colors
        else:
            dd = dt.date.fromisoformat(d)
            th = self.store.theme()
            bg = th["today_cell"] if dd == self.today else (th["past_cell"] if dd < self.today else None)
            fg = th["text"]
        it.setBackground(QBrush(QColor(bg)) if bg else QBrush())
        it.setForeground(QBrush(QColor(fg)) if bg else QBrush())

    def update_summary(self, r):
        nd, marks = len(self.dates), self.students[r]["marks"]
        vals = [marks[d] for d in self.vis_dates() if d in marks and not self.store.is_nolesson(self.cls, d)]
        grades = [g for m in vals for g in grades_of(m)]
        avg = sum(grades) / len(grades) if grades else None
        att = self.store.data["settings"]["attendance"]
        cells = [(f"{avg:.1f}" if avg is not None else "", self.store.grade_color(avg) if avg is not None else None)]
        for m in ATT_MARKS:
            n = count_att(vals, m)
            cells.append((str(n) if n else "", att[m] if n else None))
        for k, (text, bg) in enumerate(cells):
            it = self.table.item(r, nd + k)
            it.setText(text)
            it.setBackground(QBrush(QColor(bg)) if bg else QBrush())
            it.setForeground(QBrush(QColor(contrast(bg))) if bg else QBrush())

    def repaint_all(self, _inner=False):
        def work():
            for r in range(len(self.students)):
                for c in range(len(self.dates)):
                    self.paint(r, c)
                self.update_summary(r)
        if _inner:
            work()
        else:
            with blocked(self.table):
                work()
        for val, b in self.quick:
            col = self.store.mark_colors(val)
            b.setStyleSheet(f"background:{col[0]};color:{col[1]};font-weight:bold;padding:2px 4px;" if col else "padding:2px 4px;")
        self.on_current(self.table.currentRow(), self.table.currentColumn(), -1, -1)

    def on_marks_toggled(self, on, save=True):
        self.marks_box.setVisible(on)
        self.marks_btn.setText("Belgilar ▴" if on else "Belgilar ▾")
        if save:
            store_settings(self.store)["quick_marks"] = bool(on)
            self.store.save()

    # — kiritish —
    def set_mark(self, r, c, value):
        marks = self.students[r]["marks"]
        d = self.dates[c]
        if value:
            marks[d] = value
        else:
            marks.pop(d, None)
        with blocked(self.table):
            self.paint(r, c)

    # — himoya —
    def is_today(self, d):
        return d == dt.date.today().isoformat()

    def can_edit_cell(self, r, c):
        c = self.date_idx(c)
        if not (0 <= r < len(self.students) and 0 <= c < len(self.dates)):
            return True
        if not self.is_today(self.dates[c]):
            self.say("Faqat bugungi kunga belgi qo'yish mumkin. Boshqa kunlar o'zgartirilmaydi.", 6000)
            return False
        if self.students[r]["marks"].get(self.dates[c]) and self.guard.is_locked():
            self.say("🔒 Qo'yilgan baho himoyalangan. O'zgartirish uchun tepadagi «🔒 Himoyalangan» "
                     "tugmasi bilan qulfni oching.", 8000)
            return False
        return True

    def only_today(self, todo):
        """Jurnal kataklari uchun: faqat joriy kunga belgi qo'yish mumkin."""
        ok = [t for t in todo if self.is_today(self.dates[t[1]])]
        if len(ok) < len(todo):
            self.say(f"Faqat bugungi kunga belgi qo'yish mumkin: boshqa kunlardagi {len(todo) - len(ok)} ta katak o'zgartirilmadi.", 8000)
        return ok

    def guard_changes(self, todo):
        """todo: [(qator, ustun, eski, yangi)]. Himoyaga ko'ra amalga oshiriladigan o'zgarishlar ro'yxatini qaytaradi."""
        def additive(t):        # mavjud baho o'zgarmaydi: ikkinchi baho yoki KQ belgisi qo'shildi / KQ olindi
            old, new = t[2], t[3]
            if not (isinstance(old, str) and isinstance(new, str)) or old == new:
                return False
            go, gn = grades_of(old), grades_of(new)
            return bool(go) and gn[:len(go)] == go

        prot = [t for t in todo if t[2] and not additive(t)]   # eski bahosi bor katak — himoyalangan
        if not prot:
            return todo
        if self.guard.is_locked():
            free = [t for t in todo if t not in prot]
            self.say(f"🔒 {len(prot)} ta mavjud baho himoyalangan va o'zgartirilmadi"
                     + (f"; {len(free)} ta bo'sh katak to'ldirildi" if free else "")
                     + ". O'zgartirish uchun qulfni oching.", 10000)
            return free
        if len(prot) >= 3 and QMessageBox.question(
                self, "Baholarni o'zgartirish",
                f"{len(prot)} ta mavjud baho/yo'qlama o'zgaradi (o'zgarishlar tarixiga yoziladi).\n"
                "Davom etasizmi?") != QMessageBox.StandardButton.Yes:
            return []
        self.guard.touch()
        return todo

    def log_changes(self, done):
        batch = []
        for r, c, old, new in done:
            batch.append((self.students[r]["name"], self.dates[c], old, new))
            if old:
                self.store.log_change(cls_label(self.cls), self.students[r]["name"], self.dates[c], old, new,
                                      "clear" if not new else "edit")
        if batch:
            self.undo_stack.append(batch)
            del self.undo_stack[:-100]

    def undo_last(self):
        """Oxirgi o'zgarishni bekor qiladi (Ctrl+Z). Yangi qo'yilgan belgini yoki qo'shilgan ikkinchi baho / KQ ni qaytarish
        erkin; mavjud bahoni eski qiymatiga qaytarish esa himoya qoidalariga bo'ysunadi."""
        if self.stack.currentIndex() == 1:
            self.summ.undo_last()
            return
        if self.stack.currentIndex() != 0:
            self.say("Bekor qilish (Ctrl+Z) jurnal va summativ (BSB/CHSB) sahifalarida ishlaydi.", 6000)
            return
        if not self.undo_stack:
            self.say("Bekor qilinadigan o'zgarish yo'q.", 5000)
            return
        batch = self.undo_stack.pop()
        idx = {st["name"]: i for i, st in enumerate(self.students)}
        dcol = {d: c for c, d in enumerate(self.dates)}
        free, prot = [], []
        for name, d, old, new in batch:
            r, c = idx.get(name), dcol.get(d)
            if r is None or c is None or self.students[r]["marks"].get(d, "") != new or not self.is_today(d):
                continue                                    # keyin yana o'zgargan — tegmaymiz
            go, gn = grades_of(old), grades_of(new)
            additive = old == "" or (bool(go) and gn[:len(go)] == go)     # asl o'zgarish qo'shimcha bo'lgan
            (free if additive else prot).append((r, c, new, old))
        allowed = free + self.guard_changes(prot) if prot else free
        if not allowed:
            if not free and not prot:
                self.say("Bekor qilinadigan o'zgarish qolmagan (katakdagi qiymatlar keyin o'zgargan).", 6000)
            else:
                self.undo_stack.append(batch)               # himoya to'sdi — keyinroq qulf ochilgach urinib ko'rish mumkin
            return
        with blocked(self.table):
            for r, c, _cur, old in allowed:
                self.set_mark(r, c, old)
            for r in {t[0] for t in allowed}:
                self.update_summary(r)
        for r, c, cur, old in allowed:
            if cur and (r, c, cur, old) in prot:
                self.store.log_change(cls_label(self.cls), self.students[r]["name"], self.dates[c], cur, old, "revert")
        self.store.save()
        self.on_current(self.table.currentRow(), self.table.currentColumn(), -1, -1)
        self.say(f"Bekor qilindi: {len(allowed)} ta katak", 6000)

    def on_changed(self, item):
        col, r = item.column(), item.row()
        c = self.date_idx(col)
        if c < 0:
            return
        old = self.students[r]["marks"].get(self.dates[c], "")
        if self.day_mode():                               # kun rejimi: davomat va ball alohida ustunlarda
            m = apply_part(old, "att" if col < len(self.dates) else "score", item.text(), strict=True)
        else:
            m = norm_mark(item.text(), strict=True)
        if m is None:  # noto'g'ri qiymat — avvalgisiga qaytaramiz
            self.say(f"«{item.text().strip()}» belgisi noto'g'ri. Mumkin: 1–10, ikki baho (8/9), S, DQ, K, KQ, CH, "
                     "baho + KQ faqat «kq9», «kq10» shaklida (KQ oldin yoziladi; «9kq» qabul qilinmaydi).", 8000)
            m = old
        todo = self.guard_changes(self.only_today([(r, c, old, m)])) if m != old else []
        if not todo:                                      # o'zgarish yo'q yoki himoya to'sdi — avvalgisi qoladi
            m = old
        with blocked(self.table):
            self.set_mark(r, c, m)
            self.update_summary(r)
        if todo:
            self.log_changes(todo)
            self.store.save()
        self.on_current(r, col, -1, -1)

    def apply_selected(self, value, second=None):
        second = self.btn2.isChecked() if second is None else second
        nd = len(self.dates)
        items = [i for i in self.table.selectedItems()
                 if self.date_idx(i.column()) >= 0 and not self.table.isColumnHidden(i.column())
                 and not self.store.is_nolesson(self.cls, self.dates[self.date_idx(i.column())])]
        if not items:
            return
        seen, cells = {}, []
        for it in items:
            c = self.date_idx(it.column())
            part = ("att" if it.column() < nd else "score") if self.day_mode() else None
            key = (it.row(), c, part if value == "" else None)
            if key not in seen:
                seen[key] = True
                cells.append((it.row(), c, self.students[it.row()]["marks"].get(self.dates[c], ""), part))
        drop = value == "kq" and all(old and late_of(old) for _r, _c, old, _p in cells)   # hammasida bor — olib tashlaymiz
        todo = []
        for r, c, old, part in cells:
            if value == "" and part:                      # kun rejimida Delete / ⌫ — faqat shu ustun qismini tozalaydi
                new = apply_part(old, part, "")
            else:
                new = combine_mark(old, value, drop, second)
            if new != old:
                todo.append((r, c, old, new))
        todo = self.guard_changes(self.only_today(todo))
        if not todo:
            return
        with blocked(self.table):
            for r, c, _old, new in todo:
                self.set_mark(r, c, new)
            for r in {t[0] for t in todo}:
                self.update_summary(r)
        self.log_changes(todo)
        self.store.save()
        self.on_current(self.table.currentRow(), self.table.currentColumn(), -1, -1)

    def period_stats(self, studs):
        """Tanlangan davr uchun: (o'rtacha, baholar soni, {belgi: soni})."""
        vis = [d for d in self.vis_dates() if not self.store.is_nolesson(self.cls, d)]
        vals = [st["marks"][d] for st in studs for d in vis if d in st["marks"]]
        grades = [g for m in vals for g in grades_of(m)]
        avg = f"{sum(grades) / len(grades):.2f}" if grades else "—"
        return avg, len(grades), {m: count_att(vals, m) for m in ATT_MARKS}

    def on_current(self, r, c, pr, pc):
        c = self.date_idx(c) if c >= 0 else c
        self.update_xbtn(c)
        cav, _cn, cc = self.period_stats(self.students)
        cls_part = (f"Sinf: o'rtacha <b>{cav}</b>  " + "  ".join(f"{m.upper()} {cc[m]}" for m in ATT_MARKS)
                    + f"  qoldirgan <b>{cc['s'] + cc['dq'] + cc['k']}</b>")
        has_c = 0 <= c < len(self.dates)
        if has_c:
            d = dt.date.fromisoformat(self.dates[c])
            when = (f"<b>{d.day:02d}.{d.month:02d}.{d.year}</b> {WEEKDAYS_FULL[d.weekday()]}"
                    + (" (bugun)" if d == dt.date.today() else " (faqat ko'rish)"))
            short = f"<b>{d.day:02d}.{d.month:02d}</b> " + ("bugun" if d == dt.date.today() else "ko'rish")
        else:
            when = short = f"<b>{esc(self.view.title())}</b>"
        if 0 <= r < len(self.students):                  # 1-qator — o'quvchi (muhimlik tartibida)
            s = self.students[r]
            av, n, sc = self.period_stats([s])
            stud = [f"<b>{esc(s['name'])}</b>",
                    f"o'rtacha <b>{av}</b>",
                    f"qoldirgan: <b>{sc['s'] + sc['dq'] + sc['k']}</b>",
                    f"baholar: {n} ta",
                    "  ".join(f"{m.upper()} {sc[m]}" for m in ATT_MARKS)]
        else:
            stud = ["O'quvchi tanlanmagan"]
        parts = [cls_part]                               # 2-qator — sinf statistikasi, dars mavzusi
        les = self.cls.get("lessons", {}).get(self.dates[c]) if has_c else None
        if les:
            parts.append(f"<b>Mavzu:</b> {esc(les.get('topic') or '—')}")
            if les.get("hw"):
                parts.append(f"<b>Uy vazifasi:</b> {esc(les['hw'])}")
        if getattr(self, "compact", False):              # past ekran: bitta qator (o'quvchi + sana)
            self.info_stud.set_parts(stud[:3])
            self.info_date.hide()
        else:
            self.info_stud.set_parts(stud)
            self.info_date.set_parts(parts)
            self.info_date.show()

    def resizeEvent(self, ev):
        super().resizeEvent(ev)
        comp = self.height() < S(430)
        if comp != getattr(self, "compact", False):
            self.compact = comp
            self.marks_box.setVisible(self.marks_btn.isChecked() and not comp)    # past ekranda tezkor tugmalar yashiriladi
            self.on_current(self.table.currentRow(), self.table.currentColumn(), -1, -1)

    # — X (dars yo'q) kunlari —
    def update_xbtn(self, c):
        ok = 0 <= c < len(self.dates)
        self.xbtn.setEnabled(ok)
        if ok and self.store.is_nolesson(self.cls, self.dates[c]):
            self.xbtn.setText("✓ Dars o'tiladi (X ni olib tashlash)")
            self.xbtn.setToolTip("Tanlangan kunda dars o'tiladigan bo'lsa, X belgisini olib tashlaydi")
        else:
            self.xbtn.setText("✕ X qo'yish (dars yo'q)")
            self.xbtn.setToolTip("Tanlangan kunda dars bo'lmasa, butun ustunga X qo'yadi")

    def refresh(self):
        t = self.table
        r, c = t.currentRow(), t.currentColumn()
        hv, vv = t.horizontalScrollBar().value(), t.verticalScrollBar().value()
        self.rebuild()
        if 0 <= r < t.rowCount() and 0 <= c < t.columnCount():
            t.setCurrentCell(r, c)
        t.horizontalScrollBar().setValue(hv)
        t.verticalScrollBar().setValue(vv)
        self.summ_refresh()

    # — nusxalash / qo'yish —
    def cell_text(self, r, c):
        d = self.dates[c]
        if self.store.is_nolesson(self.cls, d):
            return "X"
        return display_mark(self.students[r]["marks"].get(d, "")).replace("\n", " ")

    def copy_selected(self):
        """Tanlangan kataklar belgilarini (Excel / matn uchun) nusxalaydi — Ctrl+C."""
        sel = {(i.row(), i.column()) for i in self.table.selectedItems()
               if i.column() < len(self.dates) and not self.table.isColumnHidden(i.column())}
        if not sel:
            return
        rows, cols = sorted({r for r, _ in sel}), sorted({c for _, c in sel})
        QApplication.clipboard().setText("\n".join(
            "\t".join(self.cell_text(r, c) if (r, c) in sel else "" for c in cols) for r in rows))
        self.say(f"{len(sel)} ta katak nusxalandi (Ctrl+V — boshqa joyga qo'yish)", 6000)

    def copy_period(self):
        """Ko'rinayotgan davr jadvalini (ism + sanalar + belgilar) nusxalaydi — emaktabga qo'lda kiritish yoki Excel uchun."""
        cols = [c for c in range(len(self.dates)) if not self.table.isColumnHidden(c)]
        head = "№\tO'quvchi\t" + "\t".join(f"{self.dates[c][8:]}.{self.dates[c][5:7]}" for c in cols)
        lines = [head] + [f"{r + 1}\t{st['name']}\t" + "\t".join(self.cell_text(r, c) for c in cols)
                          for r, st in enumerate(self.students)]
        QApplication.clipboard().setText("\n".join(lines))
        self.say(f"Jadval nusxalandi: {len(self.students)} o'quvchi × {len(cols)} sana ({self.view.title()})", 8000)

    def paste_cells(self):
        """Buferdagi jadvalni (Excel / matn, ustunlar Tab bilan) joriy katakdan boshlab qo'yadi — Ctrl+V.
        Bo'sh qiymatlar mavjud belgini o'chirmaydi; noto'g'ri qiymatlar o'tkazib yuboriladi; himoya qoidalari amal qiladi."""
        text = QApplication.clipboard().text()
        r0, c0 = self.table.currentRow(), self.table.currentColumn()
        vis = [c for c in range(len(self.dates)) if not self.table.isColumnHidden(c)]
        if not text.strip() or r0 < 0 or c0 not in vis:
            return
        k0, todo, bad, skipped_x = vis.index(c0), [], 0, 0
        for i, line in enumerate(text.splitlines()):
            for j, raw in enumerate(line.split("\t")):
                r, k = r0 + i, k0 + j
                if r >= len(self.students) or k >= len(vis) or not raw.strip():
                    continue
                c = vis[k]
                if self.store.is_nolesson(self.cls, self.dates[c]):
                    skipped_x += 1
                    continue
                m = norm_mark(raw, strict=True)
                if m is None or m == "x":
                    bad += 1
                    continue
                old = self.students[r]["marks"].get(self.dates[c], "")
                if m != old:
                    todo.append((r, c, old, m))
        todo = self.guard_changes(self.only_today(todo))
        if todo:
            with blocked(self.table):
                for r, c, _old, new in todo:
                    self.set_mark(r, c, new)
                for r in {t[0] for t in todo}:
                    self.update_summary(r)
            self.log_changes(todo)
            self.store.save()
            self.on_current(self.table.currentRow(), self.table.currentColumn(), -1, -1)
        self.say(f"Qo'yildi: {len(todo)} ta katak" + (f"; noto'g'ri qiymat: {bad}" if bad else "")
                 + (f"; X kunlariga qo'yilmadi: {skipped_x}" if skipped_x else ""), 8000)

    def lesson_note(self, c):
        les = self.cls.get("lessons", {}).get(self.dates[c]) if 0 <= c < len(self.dates) else None
        if not les:
            return ""
        return (f"<br><b>Mavzu ({self.dates[c][8:]}.{self.dates[c][5:7]}):</b> {esc(les.get('topic') or '—')}"
                + (f" &nbsp;|&nbsp; <b>Uy vazifasi:</b> {esc(les['hw'])}" if les.get("hw") else ""))

    def edit_lesson(self, c=None):
        c = self.date_idx(self.table.currentColumn() if c is None else c)
        if not 0 <= c < len(self.dates):
            QMessageBox.information(self, "Dars mavzusi", "Avval sana ustunidagi katakni tanlang.")
            return
        iso = self.dates[c]
        dlg = LessonDialog(self.cls, iso, self)
        if not dlg.exec():
            return
        topic, hw = dlg.values()
        old = self.cls["lessons"].get(iso, {})
        if topic or hw:
            new = {"topic": topic, "hw": hw}
            if old.get("auto") and old.get("topic") == topic:      # faqat uy vazifasi o'zgardi — reja mavzusi saqlanadi
                new.update(auto=True, si=old.get("si"))
            self.cls["lessons"][iso] = new
        else:
            self.cls["lessons"].pop(iso, None)
        self.store.reflow_plan(self.cls)
        self.store.save()
        self.refresh()

    def toggle_x(self, c=None):
        c = self.date_idx(self.table.currentColumn() if c is None else c)
        if not 0 <= c < len(self.dates):
            QMessageBox.information(self, "X", "Avval kerakli sana ustunidagi katakni tanlang.")
            return
        iso = self.dates[c]
        if self.store.is_nolesson(self.cls, iso):
            self.store.set_nolesson(self.cls, iso, False)
            self.store.reflow_plan(self.cls)
        else:
            if self.store.has_marks(self.cls, iso) and not self.is_today(iso):
                self.say("Baho/yo'qlama kiritilgan o'tgan kunga X qo'yib bo'lmaydi (belgilar o'chib ketardi): "
                         "faqat bugungi kun o'zgartiriladi.", 8000)
                return
            if self.store.has_marks(self.cls, iso):
                if not self.guard.require(self, f"{iso[8:]}.{iso[5:7]} sanasidagi baholar X qo'yilganda o'chadi."):
                    return
                if QMessageBox.question(
                        self, "X qo'yish",
                        f"{iso[8:]}.{iso[5:7]} sanasida baho/yo'qlama kiritilgan. X qo'yilsa ular o'chiriladi.\n"
                        "Davom etasizmi?") != QMessageBox.StandardButton.Yes:
                    return
                for st in self.students:
                    if iso in st["marks"]:
                        self.store.log_change(cls_label(self.cls), st["name"], iso, st["marks"][iso], "X", "x")
            self.store.set_nolesson(self.cls, iso, True)
        self.store.reflow_plan(self.cls)                      # KTR: dars yo'q kunda keyingi mavzular siljiydi
        self.store.save()
        self.refresh()

    def on_double(self, r, c):
        if c < len(self.dates) and self.store.is_nolesson(self.cls, self.dates[c]):
            iso = self.dates[c]
            if QMessageBox.question(self, "Dars o'tiladimi?",
                                    f"{iso[8:]}.{iso[5:7]} kuni dars o'tiladimi?\nX belgisi olib tashlanadi."
                                    ) == QMessageBox.StandardButton.Yes:
                self.toggle_x(c)

    def cell_menu(self, pos):
        self.show_ctx_menu(self.table.viewport().mapToGlobal(pos),
                           self.table.rowAt(pos.y()), self.table.columnAt(pos.x()))

    def header_menu(self, pos):
        hh = self.table.horizontalHeader()
        self.show_ctx_menu(hh.mapToGlobal(pos), -1, hh.logicalIndexAt(pos))

    def row_menu(self, pos):
        vh = self.table.verticalHeader()
        self.show_ctx_menu(vh.mapToGlobal(pos), vh.logicalIndexAt(pos), -1)

    def show_ctx_menu(self, gpos, r, c):
        menu = QMenu(self)
        if 0 <= c < len(self.dates):
            iso = self.dates[c]
            label = f"{iso[8:]}.{iso[5:7]}"
            if self.store.is_nolesson(self.cls, iso):
                act = menu.addAction(f"✓ {label} — dars o'tiladi (X ni olib tashlash)")
            else:
                act = menu.addAction(f"✕ {label} — X qo'yish (dars yo'q)")
            act.triggered.connect(lambda _=False: self.toggle_x(c))
            act = menu.addAction(f"📝 {label} — dars mavzusi va uy vazifasi…")
            act.triggered.connect(lambda _=False: self.edit_lesson(c))
            menu.addSeparator()
        if 0 <= r < len(self.students):
            name = self.students[r]["name"]
            act = menu.addAction(f"📇 «{name}» — kartochka…")
            act.triggered.connect(lambda _=False: self.show_card(r))
            act = menu.addAction("⭐ Kuzatuvdan olib tashlash" if self.students[r].get("star") else "⭐ Kuzatuvga qo'shish")
            act.triggered.connect(lambda _=False: self.toggle_star(self.selected_rows() if r in self.selected_rows() else [r]))
            act = menu.addAction(f"📄 «{name}» — o'quvchi varag'i (PDF)…")
            act.triggered.connect(lambda _=False: self.window().export_student_sheets(
                self.cls, [name], *self.view.bounds(), None))
            act = menu.addAction(f"✎ «{name}» — ismini o'zgartirish…")
            act.triggered.connect(lambda _=False: self.rename_student(r))
            sel = self.selected_rows()
            rows = sel if r in sel else [r]
            act = menu.addAction(f"− «{name}» — olib tashlash…" if len(rows) == 1
                                 else f"− Tanlangan {len(rows)} ta o'quvchini olib tashlash…")
            act.triggered.connect(lambda _=False: self.remove_students(rows))
        act = menu.addAction("＋ O'quvchi qo'shish…")
        act.triggered.connect(lambda _=False: self.add_students())
        menu.exec(gpos)

    # — o'quvchilarni qo'shish / olib tashlash —
    def say(self, text, ms=10000):
        win = self.window()
        if hasattr(win, "statusBar"):
            win.statusBar().showMessage(text, ms)

    def selected_rows(self):
        t = self.table
        rows = {i.row() for i in t.selectedItems()}
        if not rows and t.currentRow() >= 0:
            rows = {t.currentRow()}
        return sorted(r for r in rows if 0 <= r < len(self.students))

    def add_students(self):
        dlg = StudentsDialog(self.cls, self)
        if not dlg.exec():
            return
        names, alpha = dlg.values()
        added, _skipped = self.store.add_students(self.cls, names, alpha)
        if not added:
            return
        self.store.save()
        self.refresh()
        r = next(i for i, st in enumerate(self.students) if st["name"] == added[0])
        c = self.table.currentColumn()
        if c < 0 or self.table.isColumnHidden(c):
            vis = self.vis_cols()
            c = vis[0] if vis else -1
        if c >= 0:
            self.table.setCurrentCell(r, c)
        self.say(f"«{cls_label(self.cls)}»: {len(added)} ta o'quvchi qo'shildi")

    def confirm_remove_students(self, names, n_marks):
        box = QMessageBox(self)
        box.setIcon(QMessageBox.Icon.Warning)
        box.setWindowTitle("O'quvchini olib tashlash")
        box.setText(f"{len(names)} ta o'quvchi olib tashlansinmi?" if len(names) > 1
                    else f"«{names[0]}» olib tashlansinmi?")
        shown = "\n".join(f"• {n}" for n in names[:10]) + (f"\n… va yana {len(names) - 10} ta" if len(names) > 10 else "")
        box.setInformativeText((shown + "\n\n" if len(names) > 1 else "") +
                               f"Ularning {n_marks} ta bahosi/yo'qlamasi ham o'chiriladi.\n"
                               "Oldin ma'lumotlarning zaxira nusxasi saqlanadi.")
        yes = box.addButton("Olib tashlash", QMessageBox.ButtonRole.DestructiveRole)
        no = box.addButton("Bekor qilish", QMessageBox.ButtonRole.RejectRole)
        box.setDefaultButton(no)
        box.setEscapeButton(no)
        box.exec()
        return box.clickedButton() is yes

    def remove_students(self, rows=None):
        rows = self.selected_rows() if rows is None else sorted(rows)
        if not rows:
            QMessageBox.information(self, "O'quvchi", "Avval olib tashlanadigan o'quvchini tanlang.")
            return
        names = [self.students[r]["name"] for r in rows]
        n_marks = sum(len(self.students[r]["marks"]) for r in rows)
        if n_marks and not self.guard.require(
                self, f"Olib tashlanadigan o'quvchilarning {n_marks} ta bahosi/yo'qlamasi ham o'chadi."):
            return
        if not self.confirm_remove_students(names, n_marks):
            return
        backup = self.store.backup()
        for r in rows:
            if self.students[r]["marks"]:
                self.store.log_change(cls_label(self.cls), self.students[r]["name"], "",
                                      f"{len(self.students[r]['marks'])} ta belgi", "", "del_student")
        self.store.remove_students(self.cls, rows)
        self.store.save()
        self.refresh()
        self.say(f"«{cls_label(self.cls)}»: {len(names)} ta o'quvchi olib tashlandi. Zaxira nusxa: {backup.name}", 20000)

    def today_col(self):
        iso = dt.date.today().isoformat()
        return self.dates.index(iso) if iso in self.dates else -1

    def set_today_mark(self, r, value, second=False):
        """Tezkor davomat: bitta o'quvchining bugungi katagiga belgi (himoya va tarix qoidalari bilan)."""
        c = self.today_col()
        if c < 0 or not 0 <= r < len(self.students) or self.store.is_nolesson(self.cls, self.dates[c]):
            return False
        old = self.students[r]["marks"].get(self.dates[c], "")
        new = combine_mark(old, value, False, second)
        if new == old:
            return False
        todo = self.guard_changes([(r, c, old, new)])
        if not todo:
            return False
        for rr, cc, _o, nn in todo:
            self.set_mark(rr, cc, nn)
            self.update_summary(rr)
        self.log_changes(todo)
        self.store.save()
        return True

    def fast_attendance(self):
        if not self.students:
            QMessageBox.information(self, "Tezkor davomat", "Sinfda o'quvchilar yo'q.")
            return
        c = self.today_col()
        if c < 0 or self.store.is_nolesson(self.cls, self.dates[c]):
            QMessageBox.information(self, "Tezkor davomat",
                                    "Bugungi sana jurnalda yo'q yoki «dars yo'q» (X) deb belgilangan.\n"
                                    "Avval «+ Sana» bilan bugungi kunni qo'shing.")
            return
        FastAttendDialog(self).exec()
        self.on_current(self.table.currentRow(), self.table.currentColumn(), -1, -1)

    def toggle_star(self, rows=None):
        rows = self.selected_rows() if rows is None else rows
        rows = [r for r in rows if 0 <= r < len(self.students)]
        if not rows:
            QMessageBox.information(self, "Kuzatuv", "Avval o'quvchini tanlang.")
            return
        on = not all(self.students[r].get("star") for r in rows)
        for r in rows:
            if on:
                self.students[r]["star"] = True
            else:
                self.students[r].pop("star", None)
        self.store.save()
        for r in rows:
            self.table.verticalHeaderItem(r).setText(f"{r + 1}. {'⭐ ' if on else ''}{self.students[r]['name']}")
        self.say(f"{len(rows)} ta o'quvchi kuzatuv ro'yxatiga {'qo' + chr(39) + 'shildi' if on else 'olib tashlandi'}.", 6000)

    def show_card(self, r=None):
        r = self.table.currentRow() if r is None else r
        if not 0 <= r < len(self.students):
            QMessageBox.information(self, "O'quvchi", "Avval o'quvchini tanlang.")
            return
        StudentCardDialog(self, self.store, self.cls, self.students[r]["name"]).exec()

    def show_growth(self):
        r = self.table.currentRow()
        name = self.students[r]["name"] if 0 <= r < len(self.students) else None
        GrowthDialog(self, self.store, self.cls, name).exec()

    def rename_student(self, r=None):
        r = self.table.currentRow() if r is None else r
        if not 0 <= r < len(self.students):
            QMessageBox.information(self, "O'quvchi", "Avval o'quvchini tanlang.")
            return
        old = self.students[r]["name"]
        new, ok = QInputDialog.getText(self, "Ismini o'zgartirish", "Familiya Ism:", text=old)
        new = re.sub(r"\s+", " ", new).strip()
        if not ok or not new or new == old:
            return
        if not self.store.rename_student(self.cls, r, new):
            QMessageBox.warning(self, "O'quvchi", f"«{new}» ismli o'quvchi bu sinfda allaqachon bor.")
            return
        self.store.save()
        self.refresh()

    # — davr (kun / hafta / oy) —
    def vis_dates(self):
        return [d for d in self.dates if self.view.contains(d)]

    def vis_cols(self):
        return [i for i, d in enumerate(self.dates) if self.view.contains(d)]

    def apply_columns(self):
        """Faqat tanlangan davrdagi sana ustunlarini ko'rsatadi."""
        t, nd = self.table, len(self.dates)
        vis = set(self.vis_cols())
        width = {"day": 200, "week": 96}.get(self.view.mode, 48)
        for c in range(nd):
            t.setColumnHidden(c, c not in vis)
            if c in vis:
                t.setColumnWidth(c, S(width))
        for k in range(self.NSUM):
            t.setColumnHidden(nd + k, False)
        bc, hh = self.ball_col(), t.horizontalHeader()
        day = self.day_mode() and bool(vis)
        t.setColumnHidden(bc, not day)
        hh.moveSection(hh.visualIndex(bc), hh.count() - 1)           # odatda oxirida (yashirin)
        if day:
            first = min(vis)
            hh.moveSection(hh.visualIndex(bc), hh.visualIndex(first) + 1)   # kun rejimida — «Davomat» ustunining yonida
            t.setColumnWidth(first, S(130))
            t.setColumnWidth(bc, S(130))
        if vis:
            self.empty.hide()
        else:
            self.empty.setText(
                "Bu kunda dars sanasi yo'q. «+ Sana» tugmasi bilan qo'shing." if self.view.mode == "day" else
                "Tanlangan davrda dars sanalari yo'q. «+ Sana» yoki tepadagi «＋ Chorak» bilan qo'shing.")
            self.empty.show()

    def apply_view(self):
        """Davr / rejim o'zgarganda chaqiriladi."""
        r = max(self.table.currentRow(), 0)
        self.rebuild()
        self.select_default(r)
        self.summ_refresh()

    def select_default(self, r=0):
        vis = self.vis_cols()
        if not vis or not self.students:
            self.on_current(-1, -1, -1, -1)
            return
        today = self.today.isoformat()
        c = next((i for i in vis if self.dates[i] == today), vis[0])
        r = min(max(r, 0), len(self.students) - 1)
        self.table.setCurrentCell(r, c)
        it = self.table.item(r, c)
        if it:
            self.table.scrollToItem(it, QAbstractItemView.ScrollHint.PositionAtCenter)

    # — sanalar —
    def add_date(self):
        dlg = QDialog(self)
        dlg.setWindowTitle("Yangi sana")
        form = QFormLayout(dlg)
        a = self.view.anchor
        de = QDateEdit(QDate(a.year, a.month, a.day))
        de.setCalendarPopup(True)
        de.setDisplayFormat("dd.MM.yyyy")
        form.addRow("Dars sanasi:", de)
        bb = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel)
        bb.accepted.connect(dlg.accept)
        bb.rejected.connect(dlg.reject)
        form.addRow(bb)
        if not dlg.exec():
            return
        iso = de.date().toString("yyyy-MM-dd")
        if iso in self.dates:
            QMessageBox.information(self, "Sana", "Bu sana allaqachon mavjud.")
            return
        r = max(self.table.currentRow(), 0)
        self.dates.append(iso)
        self.dates.sort()
        self.store.reflow_plan(self.cls)
        self.store.save()
        if self.view.contains(iso):
            self.rebuild()
        else:                                   # yangi sana boshqa davrda — o'sha davrga o'tamiz
            self.view.anchor = dt.date.fromisoformat(iso)
            self.view.changed()
        self.table.setCurrentCell(r, self.dates.index(iso))

    def remove_date(self):
        c = self.date_idx(self.table.currentColumn())
        if c < 0 or c >= len(self.dates):
            QMessageBox.information(self, "Sana", "Avval o'chiriladigan sana ustunidagi katakni tanlang.")
            return
        iso = self.dates[c]
        if self.store.has_marks(self.cls, iso) and not self.is_today(iso):
            self.say("Baho/yo'qlama kiritilgan kunni o'chirib bo'lmaydi: faqat bugungi kun o'zgartiriladi.", 8000)
            return
        if self.store.has_marks(self.cls, iso) and not self.guard.require(
                self, f"{iso[8:]}.{iso[5:7]} sanasidagi baholar/yo'qlamalar ham o'chadi."):
            return
        if QMessageBox.question(self, "Sanani o'chirish",
                                f"{iso} sanasi va shu kundagi barcha baho/yo'qlamalar o'chiriladi. Davom etasizmi?"
                                ) != QMessageBox.StandardButton.Yes:
            return
        self.dates.remove(iso)
        self.cls.get("lessons", {}).pop(iso, None)
        for k in ("extra_x", "held"):
            if iso in self.cls[k]:
                self.cls[k].remove(iso)
        for s in self.students:
            if iso in s["marks"]:
                self.store.log_change(cls_label(self.cls), s["name"], iso, s["marks"][iso], "", "del_date")
            s["marks"].pop(iso, None)
        self.store.reflow_plan(self.cls)
        self.rebuild()
        self.store.save()


# ───────────────────────────── sozlamalar oynasi ─────────────────────────────
def set_btn_color(btn, hex_color):
    btn.setProperty("hex", hex_color)
    btn.setText(hex_color)
    btn.setStyleSheet(f"background:{hex_color};color:{contrast(hex_color)};border:1px solid #777;padding:3px;")


class RangesDialog(QDialog):
    def __init__(self, store, parent=None):
        super().__init__(parent)
        self.store = store
        self.setWindowTitle("Baho diapazonlari va ranglar")
        self.resize(600, 520)
        lay = QVBoxLayout(self)
        lay.addWidget(QLabel("Har bir diapazon «Dan» qiymatidan boshlanadi va keyingisigacha davom etadi.\n"
                             "Bu ranglar kataklarda, o'rtacha ballda va tezkor tugmalarda ishlatiladi."))
        self.tbl = QTableWidget(0, 4)
        self.tbl.setHorizontalHeaderLabels(["Dan", "Oraliq", "Rang", "Nomi"])
        self.tbl.setColumnWidth(0, S(80))
        self.tbl.setColumnWidth(1, S(120))
        self.tbl.setColumnWidth(2, S(110))
        self.tbl.horizontalHeader().setStretchLastSection(True)
        self.tbl.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        lay.addWidget(self.tbl, 1)

        row = QHBoxLayout()
        for text, slot in (("+ Diapazon", lambda: self.add_row(5, "#bbdefb", "")),
                           ("− Olib tashlash", self.del_row), ("Standart", self.reset)):
            b = QPushButton(text)
            b.clicked.connect(slot)
            row.addWidget(b)
        row.addStretch()
        lay.addLayout(row)

        form = QFormLayout()
        self.att = {}
        for k, label in (("s", "S — sababsiz"), ("dq", "DQ — sababli"), ("k", "K — kasal"),
                         ("kq", "KQ — kech qoldi"), ("ch", "CH — chet elda"), ("x", "X — dars yo'q")):
            b = QPushButton()
            set_btn_color(b, store.data["settings"]["attendance"][k])
            b.clicked.connect(lambda _=False, btn=b: self.pick(btn))
            self.att[k] = b
            form.addRow(label, b)
        lay.addLayout(form)

        bb = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel)
        bb.accepted.connect(self.accept_)
        bb.rejected.connect(self.reject)
        lay.addWidget(bb)
        self.fill(store.ranges())

    def fill(self, ranges):
        self.tbl.setRowCount(0)
        for r in ranges:
            self.add_row(r["min"], r["color"], r.get("name", ""))

    def add_row(self, vmin, color, name):
        r = self.tbl.rowCount()
        self.tbl.insertRow(r)
        sp = QDoubleSpinBox()
        sp.setRange(0, 10)
        sp.setDecimals(1)
        sp.setSingleStep(0.5)
        sp.setValue(float(vmin))
        sp.valueChanged.connect(self.update_labels)
        self.tbl.setCellWidget(r, 0, sp)
        self.tbl.setCellWidget(r, 1, QLabel())
        b = QPushButton()
        set_btn_color(b, color)
        b.clicked.connect(lambda _=False, btn=b: self.pick(btn))
        self.tbl.setCellWidget(r, 2, b)
        self.tbl.setCellWidget(r, 3, QLineEdit(name))
        self.update_labels()

    def del_row(self):
        r = self.tbl.currentRow()
        if r >= 0:
            self.tbl.removeRow(r)
            self.update_labels()

    def reset(self):
        self.fill(DEFAULT_SETTINGS["ranges"])
        for k, b in self.att.items():
            set_btn_color(b, DEFAULT_SETTINGS["attendance"][k])

    def pick(self, btn):
        c = QColorDialog.getColor(QColor(btn.property("hex")), self)
        if c.isValid():
            set_btn_color(btn, c.name())

    def update_labels(self):
        rows = sorted(range(self.tbl.rowCount()), key=lambda r: self.tbl.cellWidget(r, 0).value())
        for i, r in enumerate(rows):
            lo = self.tbl.cellWidget(r, 0).value()
            if i + 1 < len(rows):
                hi = self.tbl.cellWidget(rows[i + 1], 0).value()
                text = f"{lo:g} ≤ x < {hi:g}"
            else:
                text = f"{lo:g} ≤ x ≤ 10"
            self.tbl.cellWidget(r, 1).setText(text)

    def accept_(self):
        ranges = []
        for r in range(self.tbl.rowCount()):
            ranges.append({"min": self.tbl.cellWidget(r, 0).value(),
                           "color": self.tbl.cellWidget(r, 2).property("hex"),
                           "name": self.tbl.cellWidget(r, 3).text().strip()})
        if not ranges:
            QMessageBox.warning(self, "Xato", "Kamida bitta diapazon bo'lishi kerak.")
            return
        if len({r["min"] for r in ranges}) != len(ranges):
            QMessageBox.warning(self, "Xato", "«Dan» qiymatlari takrorlanmasligi kerak.")
            return
        s = self.store.data["settings"]
        s["ranges"] = sorted(ranges, key=lambda r: r["min"])
        s["attendance"] = {k: b.property("hex") for k, b in self.att.items()}
        self.store.save()
        self.accept()


class AddClassDialog(QDialog):
    def __init__(self, store, current=None, parent=None):
        super().__init__(parent)
        self.store = store
        self.dupes = 0
        self.setWindowTitle("Sinf qo'shish")
        self.setMinimumWidth(S(500))
        lay = QVBoxLayout(self)
        form = QFormLayout()
        self.name = QLineEdit()
        self.name.setPlaceholderText("masalan: 8-B")
        self.name.setMaxLength(24)
        form.addRow("Sinf nomi:", self.name)
        self.subject = subject_combo(store, (current or {}).get("subject", ""))
        form.addRow("Fan:", self.subject)
        lay.addLayout(form)
        self.warn = QLabel()
        self.warn.setStyleSheet("color:#c62828;")
        lay.addWidget(self.warn)
        lay.addWidget(QLabel("O'quvchilar — har qatorda bitta («Familiya Ism»). Ixtiyoriy, Excel ustunini ham qo'yish mumkin:"))
        self.students = QPlainTextEdit()
        self.students.setMinimumHeight(170)
        lay.addWidget(self.students)
        self.count_lbl = QLabel()
        lay.addWidget(self.count_lbl)
        lay.addWidget(QLabel("Dars sanalari:"))
        names = list(store.classes)
        self.cb_src = QComboBox()
        for c in names:
            self.cb_src.addItem(cls_label(c), c)
        for i, c in enumerate(names):
            if c is current:
                self.cb_src.setCurrentIndex(i)
        self.r_copy = QRadioButton("Mavjud sinfdan nusxalash (X kunlari bilan):")
        row = QHBoxLayout()
        row.addWidget(self.r_copy)
        row.addWidget(self.cb_src, 1)
        self.r_month = QRadioButton("Joriy oy sanalarini yaratish")
        self.r_empty = QRadioButton("Bo'sh (keyin «＋ Chorak» bilan)")
        lay.addLayout(row)
        lay.addWidget(self.r_month)
        lay.addWidget(self.r_empty)
        self.r_copy.setEnabled(bool(names))
        self.cb_src.setEnabled(bool(names))
        (self.r_copy if names else self.r_month).setChecked(True)
        self.bb = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel)
        self.bb.button(QDialogButtonBox.StandardButton.Ok).setText("Qo'shish")
        self.bb.accepted.connect(self.accept)
        self.bb.rejected.connect(self.reject)
        lay.addWidget(self.bb)
        self.name.textChanged.connect(self.update_state)
        self.students.textChanged.connect(self.update_state)
        self.subject.currentTextChanged.connect(self.update_state)
        self.update_state()

    @staticmethod
    def parse_students(text):
        out, seen, dupes = [], set(), 0
        for line in text.splitlines():
            parts = [x.strip() for x in line.split("\t")]          # Excel qatori: № \t ism \t ...
            name = next((x for x in parts if re.search(r"[^\W\d_]", x)), "")
            name = re.sub(r"^\s*\d+\s*[.)\-:]?\s*", "", name)      # "1. " kabi raqamlarni olib tashlaydi
            name = re.sub(r"\s+", " ", name).strip()
            if not name:
                continue
            k = norm_name(name)
            if k in seen:
                dupes += 1
                continue
            seen.add(k)
            out.append(name)
        return out, dupes

    def update_state(self, *_):
        name = self.name.text().strip()
        studs, self.dupes = self.parse_students(self.students.toPlainText())
        sub = self.subject.currentText().strip()
        dup = bool(name) and self.store.has_class(name, sub)
        self.warn.setText(f"«{name}»{' · ' + sub if sub else ''} sinfi allaqachon mavjud." if dup else "")
        self.count_lbl.setText(f"O'quvchilar soni: {len(studs)}" +
                               (f"  (takroriy ismlar o'tkazib yuboriladi: {self.dupes})" if self.dupes else ""))
        self.bb.button(QDialogButtonBox.StandardButton.Ok).setEnabled(bool(name) and not dup)

    def values(self):
        studs, _ = self.parse_students(self.students.toPlainText())
        source = (self.cb_src.currentData() if self.r_copy.isChecked()
                  else "month" if self.r_month.isChecked() else None)
        return self.name.text().strip(), self.subject.currentText().strip(), studs, source


def subject_combo(store, current=""):
    cb = QComboBox()
    cb.setEditable(True)
    items = store.subjects()
    items += [x for x in DEFAULT_SUBJECTS if x.casefold() not in {i.casefold() for i in items}]
    cb.addItems(items)
    cb.setCurrentText(current)
    cb.lineEdit().setPlaceholderText("masalan: Matematika (ixtiyoriy)")
    return cb


class ClassEditDialog(QDialog):
    def __init__(self, store, cls, parent=None):
        super().__init__(parent)
        self.store, self.cls = store, cls
        self.setWindowTitle(f"Sinf nomi va fani — {cls_label(cls)}")
        self.setMinimumWidth(S(440))
        lay = QVBoxLayout(self)
        form = QFormLayout()
        self.name = QLineEdit(cls["name"])
        self.name.setMaxLength(24)
        form.addRow("Sinf nomi:", self.name)
        self.subject = subject_combo(store, cls.get("subject", ""))
        form.addRow("Fan:", self.subject)
        lay.addLayout(form)
        hint = QLabel("Dars kunlari alohida jadvalda belgilanadi: Sozlamalar → Sinf sozlamalari → Fanlarning dars kunlari.")
        hint.setWordWrap(True)
        lay.addWidget(hint)
        self.warn = QLabel()
        self.warn.setStyleSheet("color:#c62828;")
        lay.addWidget(self.warn)
        lay.addWidget(QLabel("Baholar, sanalar va o'zgarishlar tarixi saqlanadi; faqat nomi o'zgaradi."))
        self.bb = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel)
        self.bb.accepted.connect(self.accept)
        self.bb.rejected.connect(self.reject)
        lay.addWidget(self.bb)
        self.name.textChanged.connect(self.update_state)
        self.subject.currentTextChanged.connect(self.update_state)
        self.update_state()

    def update_state(self, *_):
        name, sub = self.name.text().strip(), self.subject.currentText().strip()
        dup = bool(name) and self.store.has_class(name, sub, ignore=self.cls)
        self.warn.setText(f"«{name}»{' · ' + sub if sub else ''} sinfi allaqachon mavjud." if dup else "")
        self.bb.button(QDialogButtonBox.StandardButton.Ok).setEnabled(bool(name) and not dup)

    def values(self):
        return self.name.text().strip(), self.subject.currentText().strip()


class HolidaysDialog(QDialog):
    def __init__(self, store, parent=None):
        super().__init__(parent)
        self.store = store
        self.setWindowTitle("Bayram kunlari")
        self.setMinimumWidth(S(460))
        lay = QVBoxLayout(self)
        info = QLabel("Har qatorga bitta sana: «MM-DD» (har yili, masalan 03-21) yoki «YYYY-MM-DD» (bir martalik). "
                      "Oy yaratilganda shu sanalar dars kuniga to'g'ri kelsa, avtomatik X bilan belgilanadi. "
                      "Ro'za va Qurbon hayiti kabi har yili o'zgaradigan kunlarni shu yerga bir martalik kiriting.")
        info.setWordWrap(True)
        lay.addWidget(info)
        self.text = QPlainTextEdit("\n".join(store.data["settings"].get("holidays", [])))
        self.text.setMinimumHeight(180)
        lay.addWidget(self.text)
        self.warn = QLabel()
        self.warn.setStyleSheet("color:#c62828;")
        lay.addWidget(self.warn)
        bb = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel)
        bb.accepted.connect(self.accept)
        bb.rejected.connect(self.reject)
        lay.addWidget(bb)

    def accept(self):
        out, bad = [], []
        for line in self.text.toPlainText().splitlines():
            t = line.split("#")[0].strip()
            if not t:
                continue
            try:
                if re.fullmatch(r"\d{2}-\d{2}", t):
                    dt.date(2024, int(t[:2]), int(t[3:]))           # 2024 — kabisa yil: 02-29 ham to'g'ri
                elif re.fullmatch(r"\d{4}-\d{2}-\d{2}", t):
                    dt.date.fromisoformat(t)
                else:
                    raise ValueError(t)
                out.append(t)
            except ValueError:
                bad.append(t)
        if bad:
            self.warn.setText("Noto'g'ri sana: " + ", ".join(bad[:4]))
            return
        self.store.data["settings"]["holidays"] = sorted(set(out))
        super().accept()


class RiskDialog(QDialog):
    """«Xavf ostida» mezonlari: har bir holat alohida yoqiladi/o'chiriladi (checkbox) va chegarasi sozlanadi;
    hisobotda nima ko'rsatilishi ham checkbox bilan tanlanadi."""
    CRIT = (                                    # (kalit, matn, sozlama kaliti, turi, min, max, qadam, qo'shimcha)
        ("avg", "O'rtacha ball shundan past:", "avg_below", "d", 1, 10, 0.5, ""),
        ("att", "Davomat shundan past:", "att_below", "i", 0, 100, 1, " %"),
        ("s", "Sababsiz (S) soni shuncha va undan ko'p:", "s_ge", "i", 1, 99, 1, " ta"),
        ("few", "Shu kungacha jami baholar soni shundan kam (BSB ni kutmasdan):", "few_lt", "i", 1, 99, 1, " ta"),
        ("min_n", "Baholar soni shundan kam (1-BSB dan keyin):", "min_n", "i", 1, 99, 1, " ta"),
        ("consec", "Ketma-ket shuncha dars qoldirgan:", "consec_ge", "i", 2, 30, 1, " dars"),
        ("drop", "Baholar shuncha ballga pasaygan (davr 2-yarmi 1-yarmiga nisbatan):", "drop_ge", "d", 0.5, 9, 0.5, " ball"),
        ("work", "BSB/CHSB natijasi shu foizdan past:", "work_below", "i", 1, 99, 1, " %"),
        ("qgrade", "Chorak bahosi 2 chiqqan (ishlar tugallangan bo'lsa)", None, None, 0, 0, 0, ""),
    )
    SHOW = (("col_risk", "Jadvalda «Xavf» ustuni (⚠)"), ("col_reason", "Jadvalda «Sabab» ustuni"),
            ("card", "«Xavf ostida: N» ko'rsatkichi (hisobot sarlavhasi, Excel)"),
            ("highlight", "Xavfli o'quvchilar va past davomat qizil bilan belgilansin"),
            ("list", "PDF hisobot oxirida «Xavf ostidagi o'quvchilar» ro'yxati (ism — sabab)"),
            ("sheet", "O'quvchi varag'ida «E'tibor talab etadi» qatori"))

    def __init__(self, store, parent=None):
        super().__init__(parent)
        self.store = store
        self.setWindowTitle("Xavf mezonlari")
        r = store.data["settings"]["risk"]
        lay = QVBoxLayout(self)
        g1 = QGroupBox("Qaysi holatlar «xavf ostida» hisoblansin")
        gl = QGridLayout(g1)
        self.cbs, self.sps = {}, {}
        for row, (key, text, skey, kind, lo, hi, step, suf) in enumerate(self.CRIT):
            cb = QCheckBox(text)
            cb.setChecked(bool(r["on"].get(key)))
            self.cbs[key] = cb
            gl.addWidget(cb, row, 0)
            if skey:
                sp = QDoubleSpinBox() if kind == "d" else QSpinBox()
                sp.setRange(lo, hi)
                sp.setSingleStep(step)
                if kind == "d":
                    sp.setDecimals(1)
                sp.setSuffix(suf)
                sp.setValue(float(r[skey]) if kind == "d" else int(r[skey] or lo))
                self.sps[skey] = sp
                cb.toggled.connect(sp.setEnabled)
                sp.setEnabled(cb.isChecked())
                gl.addWidget(sp, row, 1)
        row = len(self.CRIT)
        self.sp_min = QSpinBox()
        self.sp_min.setRange(1, 30)
        self.sp_min.setSuffix(" ta baho")
        self.sp_min.setValue(int(r.get("avg_min_grades", 3)))
        self.cbs["avg"].toggled.connect(self.sp_min.setEnabled)
        self.sp_min.setEnabled(self.cbs["avg"].isChecked())
        gl.addWidget(QLabel("   o'rtacha ball kamida shuncha baho bo'lganda tekshiriladi:"), row, 0)
        gl.addWidget(self.sp_min, row, 1)
        lay.addWidget(g1)
        g2 = QGroupBox("Hisobotlarda nimalar ko'rsatilsin")
        sl = QVBoxLayout(g2)
        self.shows = {}
        for key, text in self.SHOW:
            cb = QCheckBox(text)
            cb.setChecked(bool(r["show"].get(key, True)))
            self.shows[key] = cb
            sl.addWidget(cb)
        lay.addWidget(g2)
        nl = QHBoxLayout()
        nl.addWidget(QLabel("Bosh oynada xavf ostidagilar bildirishnomasi:"))
        self.notice = QComboBox()
        for k, t in (("chip", "Pastki panelda nishon (⚠ 10)"), ("banner", "Tepadagi banner ichida (matn bilan)"), ("off", "Ko'rsatilmasin")):
            self.notice.addItem(t, k)
        self.notice.setCurrentIndex(max(0, self.notice.findData(r.get("notice", "chip"))))
        nl.addWidget(self.notice, 1)
        lay.addLayout(nl)
        note = QLabel("O'quvchi yoqilgan mezonlardan kamida bittasiga tushsa «xavf ostida» deb belgilanadi. "
                      "Hech qaysi mezon yoqilmasa — hech kim xavf ostida hisoblanmaydi.")
        note.setWordWrap(True)
        lay.addWidget(note)
        bb = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel)
        bb.accepted.connect(self.accept)
        bb.rejected.connect(self.reject)
        lay.addWidget(bb)

    def accept(self):
        r = self.store.data["settings"]["risk"]
        for (key, _t, skey, kind, *_x) in self.CRIT:
            r["on"][key] = self.cbs[key].isChecked()
            if skey:
                v = self.sps[skey].value()
                r[skey] = float(v) if kind == "d" else int(v)
        r["avg_min_grades"] = self.sp_min.value()
        r["notice"] = self.notice.currentData()
        for key, cb in self.shows.items():
            r["show"][key] = cb.isChecked()
        super().accept()


# ───────────────────────────── BSB tahlili ─────────────────────────────
GRADE_COLORS = {5: "#66bb6a", 4: "#c5e1a5", 3: "#fff59d", 2: "#ef9a9a"}


def _names(items, limit=6):
    items = list(items)
    txt = ", ".join(items[:limit])
    return txt + (f" va yana {len(items) - limit} ta" if len(items) > limit else "")


def bsb_stats(qmax, rows):
    """BSB natijalarini tahlil qiladi. qmax — savollarning maksimal ballari; rows — [{name, in, pts[]}].
    Faqat ishtirok etganlar hisobga olinadi; bo'sh katak — 0 ball. Baho: ballning foizi bo'yicha (86/66/30)."""
    nq, tot_max = len(qmax), float(sum(qmax))
    stu = []
    for r in rows:
        if not r["in"]:
            continue
        raw = list(r["pts"][:nq]) + [None] * (nq - len(r["pts"]))
        pts = [min(max(float(p or 0), 0.0), float(qmax[i])) for i, p in enumerate(raw)]
        total = sum(pts)
        pct = 100.0 * total / tot_max if tot_max else 0.0
        stu.append({"name": r["name"], "pts": pts, "total": total, "pct": pct, "grade": grade5(pct),
                    "empty": sum(1 for p in raw if p is None)})
    absent = [r["name"] for r in rows if not r["in"]]
    n = len(stu)
    out = {"n": n, "absent": absent, "qmax": list(qmax), "tot_max": tot_max, "students": stu, "questions": [],
           "grades": {g: 0 for g in (5, 4, 3, 2)}}
    if not n or not tot_max:
        return out
    pcts = sorted(s["pct"] for s in stu)
    mid = n // 2
    out.update({"mean_total": sum(s["total"] for s in stu) / n, "mean_pct": sum(pcts) / n,
                "median_pct": pcts[mid] if n % 2 else (pcts[mid - 1] + pcts[mid]) / 2,
                "best": max(stu, key=lambda s: s["total"]), "worst": min(stu, key=lambda s: s["total"]),
                "empty_cells": sum(s["empty"] for s in stu)})
    for s in stu:
        out["grades"][s["grade"]] += 1
    g = out["grades"]
    out["quality"] = 100.0 * (g[5] + g[4]) / n          # bilim sifati: «4» va «5» olganlar ulushi
    out["mastery"] = 100.0 * (n - g[2]) / n             # o'zlashtirish: «2» dan yuqori olganlar ulushi
    ranked = sorted(stu, key=lambda s: -s["total"])
    k = max(1, round(0.27 * n))
    for i in range(nq):
        mx = float(qmax[i]) or 1.0
        vals = [s["pts"][i] for s in stu]
        mean = sum(vals) / n
        pct = 100.0 * mean / mx
        d = None
        if n >= 6:                                       # ajratish indeksi: kuchli va kuchsiz 27% farqi
            d = (sum(s["pts"][i] for s in ranked[:k]) - sum(s["pts"][i] for s in ranked[-k:])) / k / mx
        out["questions"].append({
            "i": i + 1, "max": qmax[i], "mean": mean, "pct": pct, "full": sum(1 for v in vals if v >= mx),
            "zero": sum(1 for v in vals if v <= 0), "d": d,
            "level": "qiyin" if pct < 40 else ("o'rtacha" if pct < 70 else "oson")})
    return out


def bsb_recommendations(an):
    """Tahlil natijasidan yutuqlar, kamchiliklar va tavsiyalar (matn ro'yxatlari)."""
    good, bad, tips = [], [], []
    n = an["n"]
    if not n or not an["questions"]:
        return {"good": good, "bad": ["Tahlil uchun ishtirok etgan o'quvchilar va ballar kerak."], "tips": tips}
    g, qs = an["grades"], an["questions"]
    stu = an["students"]
    # — yutuqlar —
    if an["quality"] >= 60:
        good.append(f"Bilim sifati yuqori: {an['quality']:.0f}% o'quvchi «4» va «5» baho olgan.")
    if g[5]:
        good.append(f"«5» baho olganlar: {g[5]} ta ({_names(s['name'] for s in stu if s['grade'] == 5)}).")
    easy = [q for q in qs if q["pct"] >= 75]
    if easy:
        good.append("Yaxshi o'zlashtirilgan savollar: " + ", ".join(f"{q['i']}-savol ({q['pct']:.0f}%)" for q in easy) +
                    " — bu mavzular bo'yicha bilim mustahkam.")
    if an["mastery"] == 100:
        good.append("Ishtirok etgan barcha o'quvchi «3» dan past bo'lmagan baho olgan.")
    if an["mean_pct"] >= 66 and not good:
        good.append(f"O'rtacha natija yaxshi: {an['mean_pct']:.0f}%.")
    if not good:
        good.append("Sezilarli yutuqlar aniqlanmadi — quyidagi tavsiyalarga e'tibor bering.")
    # — kamchiliklar —
    hard = sorted((q for q in qs if q["pct"] < 50), key=lambda q: q["pct"])
    if hard:
        bad.append("O'zlashtirishi past savollar: " + ", ".join(f"{q['i']}-savol ({q['pct']:.0f}%)" for q in hard) + ".")
    skipped = [q for q in qs if q["zero"] >= max(2, 0.3 * n)]
    if skipped:
        bad.append("Ko'pchilik 0 ball olgan savollar: " + ", ".join(f"{q['i']}-savol ({q['zero']} ta)" for q in skipped) +
                   " — mavzu o'tilmagan, shart tushunarsiz yoki vaqt yetmagan bo'lishi mumkin.")
    weak_d = [q for q in qs if q["d"] is not None and q["d"] < 0.2 and q["pct"] < 90]
    if weak_d:
        bad.append("Kuchli va kuchsiz o'quvchilarni yaxshi ajratmagan savollar: " +
                   ", ".join(f"{q['i']}-savol" for q in weak_d) + " — savol shakli yoki murakkabligini ko'rib chiqing.")
    if len(qs) >= 6:
        t = len(qs) // 3
        first, last = sum(q["pct"] for q in qs[:t]) / t, sum(q["pct"] for q in qs[-t:]) / t
        if first - last >= 25:
            bad.append(f"Oxirgi savollar ({last:.0f}%) boshidagilardan ({first:.0f}%) ancha past — vaqt yetmagan yoki "
                       "murakkab topshiriqlar qiyinlik tug'dirgan bo'lishi mumkin.")
    if g[2]:
        bad.append(f"«2» baho olganlar: {g[2]} ta ({100.0 * g[2] / n:.0f}%): {_names(s['name'] for s in stu if s['grade'] == 2)}.")
    if an["quality"] < 40:
        bad.append(f"Bilim sifati past: faqat {an['quality']:.0f}% o'quvchi «4» va «5» baho olgan.")
    if an["absent"]:
        bad.append(f"Ishtirok etmaganlar: {len(an['absent'])} ta ({_names(an['absent'])}).")
    if an.get("empty_cells"):
        bad.append(f"{an['empty_cells']} ta katak to'ldirilmagan — hisobda 0 ball deb olindi.")
    if not bad:
        bad.append("Jiddiy kamchiliklar aniqlanmadi.")
    # — tavsiyalar —
    for q in hard[:4]:
        lvl = "mavzuni qayta tushuntiring, o'xshash misollarni sinfda birgalikda yeching" if q["pct"] < 35 else \
              "xatolarni tahlil qiling va qo'shimcha mashqlar bering"
        tips.append(f"{q['i']}-savol ({q['pct']:.0f}%): {lvl}.")
    low = [s["name"] for s in stu if s["grade"] == 2]
    if low:
        tips.append(f"{_names(low)} bilan yakka tartibda ishlang: asosiy tushunchalarni takrorlash va qo'shimcha dars.")
    near = []
    for s in stu:
        for thr, gr in ((30, 3), (66, 4), (86, 5)):
            if s["pct"] < thr:
                need = -(-(thr * an["tot_max"] / 100.0 - s["total"] - 1e-9) // 1)
                if 0 < need <= max(2.0, 0.06 * an["tot_max"]):
                    near.append(f"{s['name']} ({need:g} ball → «{gr}»)")
                break
    if near:
        tips.append("Yuqori bahoga yaqin o'quvchilar — qisqa takrorlash bilan natijani oshirish mumkin: " + _names(near) + ".")
    top = [s["name"] for s in stu if s["grade"] == 5]
    if top and len(top) >= 2:
        tips.append(f"{_names(top, 4)} — qiyinroq (olimpiada, qo'shimcha) topshiriqlar bering yoki yordamchi sifatida jalb qiling.")
    if an["absent"]:
        tips.append("Ishtirok etmaganlarga BSB ni qayta topshirish imkonini bering (kasallik va boshqa sabablarni aniqlang).")
    if an["quality"] < 40 or len(hard) > len(qs) / 2:
        tips.append("Bo'lim bo'yicha umumiy takrorlash darsi o'tkazing, so'ng qisqa nazorat (formativ) ishi bilan natijani tekshiring.")
    elif an["quality"] >= 70 and not hard:
        tips.append("Natija yaxshi — keyingi bo'limga o'tishingiz mumkin; qiyin topshiriqlar ulushini oshirib ko'ring.")
    if not tips:
        tips.append("Joriy yondashuvni davom ettiring; keyingi BSB da natijalarni shu tahlil bilan solishtiring.")
    return {"good": good, "bad": bad, "tips": tips}


def _chart_font(px, bold=False):
    f = QFont(QApplication.font())
    f.setPixelSize(px)
    f.setBold(bold)
    return f


def draw_bar_chart(title, labels, values, colors, ymax, fmt, w=760, h=300, hlines=(), steps=5, sc=1):
    """Oddiy ustunli diagramma (oq fonda — ekran va PDF uchun bir xil)."""
    img = QImage(int(w * sc), int(h * sc), QImage.Format.Format_ARGB32)    # sc — aniqlik ko'paytiruvchisi (chop etish uchun)
    img.fill(QColor("#ffffff"))
    p = QPainter(img)
    p.setRenderHint(QPainter.RenderHint.Antialiasing)
    p.scale(sc, sc)
    left, right, top, bottom = 40, 10, 34, 28
    pw, ph = w - left - right, h - top - bottom
    p.setPen(QColor("#222222"))
    p.setFont(_chart_font(14, True))
    p.drawText(QRect(6, 4, w - 12, 24), Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignVCenter, title)
    p.setFont(_chart_font(12))
    for k in range(steps + 1):
        y = top + ph - ph * k / steps
        p.setPen(QPen(QColor("#dddddd"), 1))
        p.drawLine(left, int(y), left + pw, int(y))
        p.setPen(QColor("#555555"))
        p.drawText(QRect(0, int(y) - 8, left - 6, 16), Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter,
                   f"{ymax * k / steps:g}")
    n = max(1, len(values))
    slot = pw / n
    bw = max(6, min(48, slot * 0.62))
    for i, (lab, v, col) in enumerate(zip(labels, values, colors)):
        x = left + slot * i + (slot - bw) / 2
        bh = ph * min(v, ymax) / ymax if ymax else 0
        p.setPen(Qt.PenStyle.NoPen)
        p.setBrush(QColor(col))
        p.drawRect(int(x), int(top + ph - bh), int(bw), int(bh))
        p.setPen(QColor("#222222"))
        p.drawText(QRect(int(x - 10), int(top + ph - bh - 17), int(bw + 20), 16), Qt.AlignmentFlag.AlignCenter, fmt.format(v))
        p.setPen(QColor("#444444"))
        p.drawText(QRect(int(left + slot * i), top + ph + 4, int(slot), 20), Qt.AlignmentFlag.AlignCenter, str(lab))
    for val, col in hlines:
        y = top + ph - ph * val / ymax
        p.setPen(QPen(QColor(col), 1, Qt.PenStyle.DashLine))
        p.drawLine(left, int(y), left + pw, int(y))
    p.setPen(QPen(QColor("#888888"), 1))
    p.drawLine(left, top, left, top + ph)
    p.drawLine(left, top + ph, left + pw, top + ph)
    p.end()
    return img


BSB_STYLES = {
    "klassik": {"title": "Klassik — oddiy jadvallar", "accent": "#1565c0", "th_bg": "#d9d9d9", "th_fg": "#000000",
                "zebra": None, "band": False, "cards": False, "mono": False, "heads": True,
                "grades": GRADE_COLORS, "levels": {"qiyin": "#ef9a9a", "o'rtacha": "#fff59d", "oson": "#c5e1a5"}},
    "zamonaviy": {"title": "Zamonaviy — rangli sarlavha va kartochkalar", "accent": "#1f3a5f", "th_bg": "#1f3a5f",
                  "th_fg": "#ffffff", "zebra": "#f1f5fa", "band": True, "cards": True, "mono": False, "heads": True,
                  "grades": {5: "#43a047", 4: "#aed581", 3: "#ffe082", 2: "#ef9a9a"},
                  "levels": {"qiyin": "#ef9a9a", "o'rtacha": "#ffe082", "oson": "#aed581"}},
    "ixcham": {"title": "Ixcham — oq-qora, tejamkor chop etish uchun", "accent": "#000000", "th_bg": "#ffffff",
               "th_fg": "#000000", "zebra": None, "band": False, "cards": False, "mono": True, "heads": False,
               "grades": {5: None, 4: None, 3: None, 2: None}, "levels": {"qiyin": None, "o'rtacha": None, "oson": None}},
}


def bsb_html(meta, an, rec, wide=False, style="klassik", pdf=False, cw=None, pdf_pad=1):
    S = BSB_STYLES.get(style, BSB_STYLES["klassik"])
    qs, stu, nq = an["questions"], an["students"], len(an["qmax"])
    img_w = int(cw) if cw else ((1030 if wide else 700) if pdf else 640)
    ac = S["accent"]
    line = "#c4c4c4" if S["mono"] else PDF_LINE
    pad, pad2 = (pdf_pad, pdf_pad) if pdf else (4, 3)               # PDF da katak ichki masofasi kichik
    mg = "margin-top:5px;margin-bottom:2px;" if pdf else ""
    pm = "margin-top:2px;margin-bottom:3px;" if pdf else ""

    def td(t, bg=None, al="center", b=False, big=False):
        text = esc(str(t)).replace("\n", "<br>")
        if big:
            text = f'<span style="font-size:17pt;">{text}</span>'
        st = f"text-align:{al};border-bottom:2px solid {line};" + (f"background-color:{bg};" if bg else "") + ("color:#000000;" if bg else "")
        return f'<td style="{st}">' + (f"<b>{text}</b>" if b else text) + "</td>"

    def th(h, width=None):
        w = f' width="{width}%"' if width else ""
        txt = esc(str(h))
        if S["th_fg"] != "#000000":
            txt = f'<font color="{S["th_fg"]}">{txt}</font>'
        return f'<th bgcolor="{S["th_bg"]}"{w}>{txt}</th>'

    def table(extra=""):
        return f'<table border="0" cellspacing="0" cellpadding="{pad}" width="100%" {extra}>'

    def h3(text, col=None):
        c = col or ac
        if S["band"]:
            return (f'<table width="100%" cellspacing="0" cellpadding="3"><tr><td bgcolor="{c}" width="1%"></td>'
                    f'<td><font color="{c}" size="4"><b>&nbsp;{esc(text)}</b></font></td></tr></table>')
        return f'<h3 style="color:{c};{mg}">{esc(text)}</h3>'

    sub = (f"<b>Bo'lim / mavzu:</b> {esc(meta['title'] or '—')} &nbsp; <b>Sana:</b> {esc(meta['date'])} &nbsp; "
           f"<b>Maksimal ball:</b> {an['tot_max']:g} &nbsp; <b>Savollar:</b> {nq}")
    if S["band"]:
        parts = [f'<table width="100%" cellspacing="0" cellpadding="8"><tr><td bgcolor="{ac}">'
                 f'<font color="#ffffff" size="6"><b>BSB tahlili</b></font><br>'
                 f'<font color="#dbe6f5" size="4">{esc(meta["label"])}</font></td></tr></table>',
                 f'<p style="{pm}">{sub}</p>']
    elif style == "ixcham":
        parts = [f'<h2 style="margin-bottom:0;">BSB tahlili — {esc(meta["label"])}</h2><hr>', f'<p style="{pm}">{sub}</p>']
    else:
        parts = [f'<h2 style="margin-top:0;margin-bottom:0;">BSB tahlili — {esc(meta["label"])}</h2>', f'<p style="{pm}">{sub}</p>']
    if not an["n"] or not qs:
        return "".join(parts) + "<p>Tahlil uchun ishtirok etgan o'quvchilar va ballar kiritilmagan.</p>"
    g = an["grades"]
    gbg = S["grades"]
    if S["cards"]:
        cards = [("Ishtirok", f"{an['n']} / {an['n'] + len(an['absent'])}", "#e8f0fb"),
                 ("O'rtacha natija", f"{an['mean_pct']:.0f}%", "#e8f0fb"),
                 ("Bilim sifati", f"{an['quality']:.0f}%", "#e3f4e6"),
                 ("O'zlashtirish", f"{an['mastery']:.0f}%", "#e3f4e6"),
                 ("Eng yuqori", f"{an['best']['total']:g}", "#fff4d6"),
                 ("Eng past", f"{an['worst']['total']:g}", "#fde3e3")]
        parts.append('<table width="100%" cellspacing="6" cellpadding="6"><tr>' + "".join(
            f'<td bgcolor="{bg}" align="center"><font color="#555555" size="2">{esc(lbl)}</font><br>'
            f'<span style="font-size:17pt;"><b>{esc(val)}</b></span></td>' for lbl, val, bg in cards) + "</tr></table>")
        parts.append(table() + "<tr>" + "".join(th(h) for h in ("«5»", "«4»", "«3»", "«2»", "O'rtacha ball", "Mediana")) +
                     "</tr><tr>" + "".join(td(g[k], gbg[k], b=True) for k in (5, 4, 3, 2)) +
                     td(f"{an['mean_total']:.1f} / {an['tot_max']:g}") + td(f"{an['median_pct']:.0f}%") + "</tr></table>")
    else:
        parts.append(table() + "<tr>" + "".join(th(h) for h in (
            "Bor", "Yo'q", "O'rt. ball", "O'rt. %", "Mediana", "Eng yuq.", "Eng past", "«5»", "«4»", "«3»", "«2»", "Sifat",
            "O'zlash.")) + "</tr><tr>" +
            td(an["n"]) + td(len(an["absent"])) + td(f"{an['mean_total']:.1f}") + td(f"{an['mean_pct']:.0f}%") +
            td(f"{an['median_pct']:.0f}%") + td(f"{an['best']['total']:g}") + td(f"{an['worst']['total']:g}") +
            "".join(td(g[k], gbg[k], b=True) for k in (5, 4, 3, 2)) +
            td(f"{an['quality']:.0f}%", b=True) + td(f"{an['mastery']:.0f}%", b=True) + "</tr></table>")
    parts.append(h3("Savollar tahlili"))
    lv = S["levels"]
    rows = [table() + "<tr>" + "".join(th(h, wd) for h, wd in zip((
        "Savol", "Maks.", "O'rtacha ball", "O'zlashtirish %", "To'liq yechgan", "0 ball olgan", "Ajratish indeksi",
        "Qiyinlik"), (8, 8, 14, 16, 14, 14, 14, 12))) + "</tr>"]
    for k, q in enumerate(qs):
        z = S["zebra"] if (S["zebra"] and k % 2) else None
        rows.append("<tr>" + td(q["i"], z, b=True) + td(f"{q['max']:g}", z) + td(f"{q['mean']:.2f}", z) +
                    td(f"{q['pct']:.0f}%", lv[q["level"]], b=True) + td(q["full"], z) + td(q["zero"], z) +
                    td("—" if q["d"] is None else f"{q['d']:.2f}", z) + td(q["level"], lv[q["level"]]) + "</tr>")
    parts.append("".join(rows) + "</table>")
    parts.append("<p><small>Bor — ishtirok etganlar, Yo'q — ishtirok etmaganlar; sifat — «4» va «5» olganlar ulushi; "
                 "o'zlash. — «3» va undan yuqori olganlar ulushi. Qiyinlik: &lt;40% — qiyin, 40–70% — o'rtacha, &gt;70% — "
                 "oson. Ajratish indeksi (kuchli va kuchsiz 27% o'quvchi farqi): 0,4 dan yuqori — a'lo, 0,2–0,4 — yaxshi, "
                 "0,2 dan past — kuchsiz (6 tadan kam o'quvchida hisoblanmaydi).</small></p>")
    for title, key, col in (("Yutuqlar", "good", "#2e7d32"), ("Kamchiliklar", "bad", "#c62828"),
                            ("Tavsiyalar", "tips", "#1565c0")):
        if S["mono"]:
            col = "#000000"
        parts.append(h3(title, col) + ('<ul style="margin-top:0;margin-bottom:2px;">' if pdf else "<ul>") + "".join(f"<li>{esc(t)}</li>" for t in rec[key]) + "</ul>")
    if pdf:                                              # o'quvchilar jadvali — alohida varoqda
        parts.append('<h3 style="page-break-before: always; margin-top:0px; margin-bottom:3px;">&nbsp;</h3>')
    parts.append(h3("O'quvchilar natijalari"))
    wq = max(3.0, min(7.0, 52.0 / max(1, nq)))
    rows = [table() + "<tr>" + th("№", 5) + th("O'quvchi", 24) +
            "".join(th(i + 1, wq) for i in range(nq)) + th("Jami", 7) + th("%", 7) + th("Baho", 8) + "</tr>"]
    mx_bg = "#eeeeee" if style != "ixcham" else None
    rows.append("<tr>" + td("", mx_bg) + td("Maksimal ball", mx_bg, "left", True) +
                "".join(td(f"{m:g}", mx_bg) for m in an["qmax"]) + td(f"{an['tot_max']:g}", mx_bg, b=True) +
                td("100", mx_bg) + td("", mx_bg) + "</tr>")
    for i, s in enumerate(sort_pdf_items(sorted(stu, key=lambda s: -s["total"]), lambda s: s["name"]), 1):
        z = S["zebra"] if (S["zebra"] and i % 2 == 0) else None
        rows.append("<tr>" + td(i, z) + td(s["name"], z, "left") + "".join(td(f"{v:g}", z) for v in s["pts"]) +
                    td(f"{s['total']:g}", z, b=True) + td(f"{s['pct']:.0f}%", z) +
                    td(s["grade"], gbg[s["grade"]], b=True) + "</tr>")
    parts.append("".join(rows) + "</table>")
    if an["absent"]:
        parts.append(f"<p><b>Ishtirok etmaganlar:</b> {esc(', '.join(an['absent']))}</p>")
    parts.append("<p><small>Baho foiz bo'yicha qo'yilgan: 86–100% — 5, 66–85% — 4, 30–65% — 3, 30% dan past — 2. "
                 "Bo'sh kataklar 0 ball deb olingan.</small></p>")
    return "".join(parts)


def bsb_export_xlsx(path, meta, an, rec, rows):
    """BSB tahlilini Excel ga yozadi: «Natijalar» (formulalar bilan), «Savollar tahlili» va «Xulosa» (diagrammalar, tavsiyalar)."""
    from openpyxl import Workbook
    from openpyxl.chart import BarChart, Reference
    from openpyxl.formatting.rule import CellIsRule
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
    from openpyxl.utils import get_column_letter as L

    nq, qmax = len(an["qmax"]), an["qmax"]
    thin = Side(style="thin", color="999999")
    box = Border(left=thin, right=thin, top=thin, bottom=thin)
    head_fill = PatternFill("solid", fgColor="1F3A5F")
    head_font = Font(bold=True, color="FFFFFF")
    center = Alignment(horizontal="center", vertical="center", wrap_text=True)
    wb = Workbook()

    # — Natijalar —
    ws = wb.active
    ws.title = "Natijalar"
    ws["A1"] = f"BSB — {meta['label']}"
    ws["A1"].font = Font(bold=True, size=14)
    ws["A2"] = f"Bo'lim / mavzu: {meta['title'] or '—'}      Sana: {meta['date']}"
    hdr = ["Ishtirok", "№", "O'quvchi"] + [f"{i + 1}-savol" for i in range(nq)] + ["Jami", "%", "Baho"]
    HR, MR = 4, 5
    for c, h in enumerate(hdr, 1):
        cell = ws.cell(HR, c, h)
        cell.fill, cell.font, cell.alignment, cell.border = head_fill, head_font, center, box
    ws.cell(MR, 3, "Maksimal ball").font = Font(bold=True)
    for i, m in enumerate(qmax):
        ws.cell(MR, 4 + i, m)
    tc, pc, gc = 4 + nq, 5 + nq, 6 + nq
    ws.cell(MR, tc, f"=SUM({L(4)}{MR}:{L(3 + nq)}{MR})")
    ws.cell(MR, pc, 100)
    for c in range(1, gc + 1):
        cell = ws.cell(MR, c)
        cell.fill = PatternFill("solid", fgColor="EEEEEE")
        cell.font, cell.alignment, cell.border = Font(bold=True), center, box
    by_name = {s["name"]: s for s in an["students"]}
    r = MR + 1
    first = r
    for k, row in enumerate(rows, 1):
        on = row["in"]
        ws.cell(r, 1, "✔" if on else "—")
        ws.cell(r, 2, k)
        ws.cell(r, 3, row["name"])
        for i in range(nq):
            v = row["pts"][i] if i < len(row["pts"]) else None
            ws.cell(r, 4 + i, v if (on and v is not None) else None)
        if on:
            ws.cell(r, tc, f"=SUM({L(4)}{r}:{L(3 + nq)}{r})")
            ws.cell(r, pc, f"=ROUND(100*{L(tc)}{r}/{L(tc)}${MR},0)")
            ws.cell(r, gc, f"=IF(100*{L(tc)}{r}/{L(tc)}${MR}>=86,5,IF(100*{L(tc)}{r}/{L(tc)}${MR}>=66,4,IF(100*{L(tc)}{r}/{L(tc)}${MR}>=30,3,2)))")
        else:
            for c in (tc, pc, gc):
                ws.cell(r, c, "—")
        for c in range(1, gc + 1):
            cell = ws.cell(r, c)
            cell.border = box
            cell.alignment = Alignment(horizontal="left" if c == 3 else "center", vertical="center")
            if not on:
                cell.font = Font(color="999999")
        ws.cell(r, tc).font = Font(bold=True)
        ws.cell(r, gc).font = Font(bold=True)
        r += 1
    last = r - 1
    rng = f"{L(gc)}{first}:{L(gc)}{last}"
    for val, col in ((5, "66BB6A"), (4, "C5E1A5"), (3, "FFF59D"), (2, "EF9A9A")):
        ws.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=[str(val)],
                                                      fill=PatternFill("solid", bgColor=col, fgColor=col)))
    ws.column_dimensions["A"].width = 9
    ws.column_dimensions["B"].width = 5
    ws.column_dimensions["C"].width = 30
    for c in range(4, gc + 1):
        ws.column_dimensions[L(c)].width = 9
    ws.row_dimensions[HR].height = 30
    ws.freeze_panes = ws.cell(MR + 1, 4)
    ws.cell(last + 2, 1, "Ballarni o'zgartirsangiz Jami, % va Baho avtomatik yangilanadi (86% / 66% / 30% chegaralari).").font = \
        Font(italic=True, color="666666")

    # — Savollar tahlili —
    wq = wb.create_sheet("Savollar tahlili")
    heads = ["Savol", "Maks. ball", "O'rtacha ball", "O'zlashtirish %", "To'liq yechgan", "0 ball olgan",
             "Ajratish indeksi", "Qiyinlik"]
    for c, h in enumerate(heads, 1):
        cell = wq.cell(1, c, h)
        cell.fill, cell.font, cell.alignment, cell.border = head_fill, head_font, center, box
    lvl = {"qiyin": "EF9A9A", "o'rtacha": "FFE082", "oson": "AED581"}
    for k, q in enumerate(an["questions"], 2):
        vals = [q["i"], q["max"], round(q["mean"], 2), round(q["pct"], 1), q["full"], q["zero"],
                None if q["d"] is None else round(q["d"], 2), q["level"]]
        for c, v in enumerate(vals, 1):
            cell = wq.cell(k, c, v)
            cell.border, cell.alignment = box, Alignment(horizontal="center")
        wq.cell(k, 4).fill = PatternFill("solid", fgColor=lvl[q["level"]])
        wq.cell(k, 8).fill = PatternFill("solid", fgColor=lvl[q["level"]])
    for c in range(1, 9):
        wq.column_dimensions[L(c)].width = 16
    # — Xulosa —
    wx = wb.create_sheet("Xulosa")
    wx["A1"] = f"BSB tahlili — {meta['label']}"
    wx["A1"].font = Font(bold=True, size=14)
    wx["A2"] = f"Bo'lim / mavzu: {meta['title'] or '—'}      Sana: {meta['date']}"
    summary = [("Ishtirok etdi", an["n"]), ("Ishtirok etmadi", len(an["absent"])),
               ("Maksimal ball", an["tot_max"]), ("O'rtacha ball", round(an["mean_total"], 2)),
               ("O'rtacha %", round(an["mean_pct"], 1)), ("Mediana %", round(an["median_pct"], 1)),
               ("Eng yuqori ball", an["best"]["total"]), ("Eng past ball", an["worst"]["total"]),
               ("Bilim sifati, % («4» va «5»)", round(an["quality"], 1)),
               ("O'zlashtirish, % («3» va undan yuqori)", round(an["mastery"], 1))]
    for k, (a, b) in enumerate(summary, 4):
        wx.cell(k, 1, a).border = box
        wx.cell(k, 2, b).border = box
        wx.cell(k, 2).alignment = Alignment(horizontal="center")
    gr0 = 4 + len(summary) + 1
    for c, h in enumerate(("Baho", "O'quvchilar soni"), 1):
        cell = wx.cell(gr0, c, h)
        cell.fill, cell.font, cell.alignment, cell.border = head_fill, head_font, center, box
    for k, gv in enumerate((5, 4, 3, 2), gr0 + 1):
        wx.cell(k, 1, gv).border = box
        wx.cell(k, 2, an["grades"][gv]).border = box
        for c in (1, 2):
            wx.cell(k, c).alignment = Alignment(horizontal="center")
        wx.cell(k, 1).fill = PatternFill("solid", fgColor={5: "66BB6A", 4: "C5E1A5", 3: "FFF59D", 2: "EF9A9A"}[gv])
    k = gr0 + 7
    wrap = Alignment(wrap_text=True, vertical="top")
    for title, key, color in (("Yutuqlar", "good", "2E7D32"), ("Kamchiliklar", "bad", "C62828"), ("Tavsiyalar", "tips", "1565C0")):
        wx.cell(k, 1, title).font = Font(bold=True, size=12, color=color)
        k += 1
        for t in rec[key]:
            wx.cell(k, 1, "• " + t).alignment = wrap
            wx.merge_cells(start_row=k, start_column=1, end_row=k, end_column=10)
            wx.row_dimensions[k].height = 15 * max(1, -(-len(t) // 95))
            k += 1
        k += 1
    wx.column_dimensions["A"].width = 40
    wx.column_dimensions["B"].width = 16
    for c in range(3, 11):
        wx.column_dimensions[L(c)].width = 11
    wb.save(path)


class BsbTransferDialog(QDialog):
    """Qaysi BSB ishiga ballarni yozishni tanlash (mavjud ish yoki yangisini yaratish)."""

    def __init__(self, store, cls, an, iso, title, parent=None):
        super().__init__(parent)
        self.an, self.cls = an, cls
        self.setWindowTitle("Ballarni Summativga o'tkazish")
        self.setMinimumWidth(S(520))
        lay = QVBoxLayout(self)
        lay.addWidget(QLabel("Ballar qaysi BSB ishiga yozilsin?"))
        self.cb = QComboBox()
        self.works = sorted((w for w in cls["works"] if w["type"] == "bsb"), key=lambda w: w["date"])
        for w in self.works:
            self.cb.addItem(f"BSB · {fmt_date(w['date'])} · maks. {fmt_num(w['max'])}"
                            + (f" · {w['title']}" if w.get("title") else ""), w["id"])
        self.cb.addItem(f"＋ Yangi BSB ishi yaratish ({fmt_date(iso)}, maks. {an['tot_max']:g})", None)
        self.cb.setCurrentIndex(self.cb.count() - 1)
        for i, w in enumerate(self.works):                 # tahlil sanasidagi ish bo'lsa — shuni tanlaymiz
            if w["date"] == iso:
                self.cb.setCurrentIndex(i)
        lay.addWidget(self.cb)
        self.scale = QCheckBox()
        lay.addWidget(self.scale)
        self.info = QLabel()
        self.info.setWordWrap(True)
        lay.addWidget(self.info)
        bb = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel)
        bb.accepted.connect(self.accept)
        bb.rejected.connect(self.reject)
        lay.addWidget(bb)
        self.cb.currentIndexChanged.connect(lambda _i: self.update_state())
        self.update_state()

    def current_work(self):
        wid = self.cb.currentData()
        return next((w for w in self.works if w["id"] == wid), None)

    def update_state(self):
        w, tot = self.current_work(), self.an["tot_max"]
        if w is None or abs(w["max"] - tot) < 1e-9:
            self.scale.setChecked(False)
            self.scale.setEnabled(False)
            self.scale.setText("Ballar o'zgarishsiz yoziladi")
            self.info.setText("Ballar o'zgartirilmaydi." if w else
                              "Yangi ish yaratiladi: sana — tahlil sanasi, maksimal ball — savollar yig'indisi.")
        else:
            self.scale.setChecked(True)
            self.scale.setEnabled(False)
            self.scale.setText(f"Proporsional moslash: {tot:g} dan {fmt_num(w['max'])} ga")
            self.info.setText(f"Tahlildagi maksimal ball ({tot:g}) ishning maksimalidan ({fmt_num(w['max'])}) farq qiladi, "
                              "shuning uchun ballar proporsional qayta hisoblanadi (1 xona kasr).")

    def values(self):
        return self.current_work(), self.scale.isChecked()


class BsbDialog(QDialog):
    """BSB tahlili: ishtirok belgisi, o'quvchilar va savollar bo'yicha ball jadvali, tahlil, diagramma, tavsiyalar, PDF."""
    C_IN, C_NUM, C_NAME, C_Q0 = 0, 1, 2, 3

    def __init__(self, win, cls=None):
        super().__init__(win)
        self.win, self.store = win, win.store
        self.setWindowTitle("BSB tahlili")
        fit_to_screen(self, 1180, 700, center=False)
        self.cur_id, self.loading, self.an, self.q_built = None, False, None, 5
        self._snap = None                        # oxirgi saqlangan/yuklangan holat (saqlanmagan o'zgarishni bilish uchun)
        self._base_title = "BSB tahlili"
        lay = QVBoxLayout(self)
        top = FlowLayout()
        top.addWidget(QLabel("Jurnal:"))
        self.jc = QComboBox()
        cur = cls or win.current_cls()
        for i, c in enumerate(self.store.classes):
            self.jc.addItem(cls_label(c), i)      # indeks (Qt lug'atni nusxalab yuboradi)
            if c is cur:
                self.jc.setCurrentIndex(i)
        self._jc_prev = self.jc.currentIndex()
        top.addWidget(self.jc)
        top.addWidget(QLabel("  Saqlangan:"))
        self.saved = QComboBox()
        self.saved.setMinimumWidth(S(190))
        top.addWidget(self.saved)
        for text, slot in (("＋ Yangi", self.new_clicked), ("💾 Saqlash", self.save_analysis),
                           ("🗑 O'chirish", self.delete_analysis)):
            b = QPushButton(text)
            b.clicked.connect(lambda _=False, s=slot: s())
            top.addWidget(b)
        lay.addWidget(FlowBox(top))
        row2 = FlowLayout()
        row2.addWidget(QLabel("Bo'lim / mavzu:"))
        self.title = QLineEdit()
        self.title.setMinimumWidth(S(220))
        self.title.setPlaceholderText("Masalan: «Kvadrat tenglamalar» bo'limi")
        row2.addWidget(self.title)
        row2.addWidget(QLabel("Sana:"))
        self.date = QDateEdit()
        self.date.setCalendarPopup(True)
        self.date.setDisplayFormat("dd.MM.yyyy")
        self.date.setDate(QDate.currentDate())
        row2.addWidget(self.date)
        row2.addWidget(QLabel("Savollar soni:"))
        self.nq = QSpinBox()
        self.nq.setRange(1, 30)
        self.nq.setValue(5)
        row2.addWidget(self.nq)
        self.btn_an = QPushButton("🔍 Tahlil qilish")
        self.btn_an.setStyleSheet("QPushButton{background:palette(highlight);color:palette(highlighted-text);font-weight:bold;"
                                  "padding:4px 14px;}")
        self.btn_an.setToolTip("Ballar bo'yicha tahlilni hisoblaydi va «Tahlil» sahifasini ochadi")
        self.btn_an.clicked.connect(lambda _=False: self.analyze())
        row2.addWidget(self.btn_an)
        lay.addWidget(FlowBox(row2))
        row2 = FlowLayout()                                  # keyingi qator: natijani chiqarish
        row2.addWidget(QLabel("Natijani:"))
        self.btn_pdf = QPushButton("📄 PDF ga export…")
        self.btn_pdf.clicked.connect(lambda _=False: self.export_pdf())
        row2.addWidget(self.btn_pdf)
        self.btn_xls = QPushButton("📗 Excel ga export…")
        self.btn_xls.clicked.connect(lambda _=False: self.export_excel())
        row2.addWidget(self.btn_xls)
        self.btn_tr = QPushButton("↳ Jami ballni Summativga o'tkazish")
        self.btn_tr.setToolTip("Har bir o'quvchining jami ballini Summativ sahifadagi BSB ishiga yozadi")
        self.btn_tr.clicked.connect(lambda _=False: self.transfer())
        row2.addWidget(self.btn_tr)
        row2.addWidget(QLabel("PDF dizayni:"))
        self.style = QComboBox()
        for k, v in BSB_STYLES.items():
            self.style.addItem(v["title"], k)
        ix = self.style.findData(self.store.data["settings"].get("bsb_pdf_style", "klassik"))
        self.style.setCurrentIndex(max(0, ix))
        self.style.setToolTip("Tanlangan dizayn «Tahlil» sahifasida ham ko'rinadi va PDF ga shunday chiqadi")
        self.style.setSizeAdjustPolicy(QComboBox.SizeAdjustPolicy.AdjustToMinimumContentsLengthWithIcon)
        self.style.setMinimumContentsLength(16)
        self.style.currentIndexChanged.connect(lambda _i: self.on_style())
        row2.addWidget(self.style)
        row2.addWidget(QLabel("Shrift:"))
        row2.addWidget(pdf_font_combo(self.store))
        row2.addWidget(pdf_alpha_check(self.store))
        row2.addWidget(QLabel("Tartib:"))
        row2.addWidget(pdf_sort_combo(self.store, "bsb"))
        lay.addWidget(FlowBox(row2))
        self.msg = QLabel()
        self.msg.setWordWrap(True)
        self.msg.setTextFormat(Qt.TextFormat.RichText)
        lay.addWidget(self.msg)
        self.tabs = QTabWidget()
        self.tbl = QTableWidget(0, 0)
        self.tbl.verticalHeader().hide()
        self.tbl.setAlternatingRowColors(True)
        self.tbl.itemChanged.connect(self.on_item_changed)
        self.tabs.addTab(self.tbl, "Jadval")
        self.view = QTextBrowser()
        self.view.setStyleSheet("QTextBrowser{background:#ffffff;color:#000000;}")
        self.tabs.addTab(self.view, "Tahlil")
        lay.addWidget(self.tabs, 1)
        bot = QHBoxLayout()
        self.hint = QLabel("Birinchi qator — savollarning maksimal ballari (o'zgartirish mumkin). "
                           "✔ olib tashlansa, o'quvchi ishtirok etmagan hisoblanadi.")
        self.hint.setWordWrap(True)
        bot.addWidget(self.hint, 1)
        close = QPushButton("Yopish")
        close.clicked.connect(self.reject)
        bot.addWidget(close)
        lay.addLayout(bot)
        self.jc.currentIndexChanged.connect(lambda _i: self.on_class())
        self.saved.currentIndexChanged.connect(lambda _i: self.on_saved())
        self.nq.valueChanged.connect(lambda _v: self.on_nq())
        self.title.textChanged.connect(lambda _t: self.update_mark())
        self.date.dateChanged.connect(lambda _d: self.update_mark())
        self.on_class()

    # — ma'lumot —
    def cls(self):
        return self.store.classes[self.jc.currentData()]

    def analyses(self):
        return self.cls().setdefault("analyses", [])

    # — saqlanmagan o'zgarishlardan himoya —
    def state_key(self):
        try:
            return json.dumps([self.title.text().strip(), self.date.date().toString("yyyy-MM-dd"), self.collect()],
                              sort_keys=True, ensure_ascii=False)
        except Exception:  # noqa: BLE001
            return None

    def is_dirty(self):
        return self._snap is not None and self.state_key() != self._snap

    def mark_clean(self):
        self._snap = self.state_key()
        self.update_mark()

    def update_mark(self):
        if self.loading or self._snap is None:
            return
        self.setWindowTitle(self._base_title + ("  •  saqlanmagan o'zgarishlar" if self.is_dirty() else ""))

    def ask_discard(self):
        """Saqlanmagan o'zgarish bo'lsa so'raydi: 'save' | 'discard' | 'cancel'. O'zgarish yo'q bo'lsa — 'discard'."""
        if not self.is_dirty():
            return "discard"
        box = QMessageBox(self)
        box.setIcon(QMessageBox.Icon.Warning)
        box.setWindowTitle("Saqlanmagan o'zgarishlar")
        box.setText("Joriy BSB tahlilida saqlanmagan o'zgarishlar bor.")
        box.setInformativeText("Davom etsangiz, kiritilgan ma'lumotlar yo'qoladi.")
        b_save = box.addButton("💾 Saqlash va davom etish", QMessageBox.ButtonRole.AcceptRole)
        b_drop = box.addButton("Saqlamasdan davom etish", QMessageBox.ButtonRole.DestructiveRole)
        b_cancel = box.addButton("Bekor qilish", QMessageBox.ButtonRole.RejectRole)
        box.setDefaultButton(b_save)
        box.setEscapeButton(b_cancel)
        box.exec()
        b = box.clickedButton()
        return "save" if b is b_save else ("discard" if b is b_drop else "cancel")

    def new_clicked(self):
        r = self.ask_discard()
        if r == "cancel":
            return
        if r == "save":
            self.save_analysis()
        self.new_analysis()

    def reject(self):
        r = self.ask_discard()
        if r == "cancel":
            return
        if r == "save":
            self.save_analysis()
        super().reject()

    def on_class(self):
        new_ix = self.jc.currentIndex()
        if self.is_dirty():                       # sinf almashtirilmoqda: avval eski sinfdagi o'zgarishlarni hal qilamiz
            with blocked(self.jc):
                self.jc.setCurrentIndex(self._jc_prev)
            r = self.ask_discard()
            if r == "cancel":
                return
            if r == "save":
                self.save_analysis()
            with blocked(self.jc):
                self.jc.setCurrentIndex(new_ix)
        self._jc_prev = self.jc.currentIndex()
        self.fill_saved(None)
        self.new_analysis()

    def fill_saved(self, select_id):
        with blocked(self.saved):
            self.saved.clear()
            self.saved.addItem("— yangi tahlil —", None)
            for a in self.analyses():
                self.saved.addItem(f"{a.get('title') or 'Nomsiz'} · {fmt_date(a['date'])}", a["id"])
            ix = self.saved.findData(select_id)
            self.saved.setCurrentIndex(max(0, ix))

    def on_saved(self):
        aid = self.saved.currentData()
        if aid == self.cur_id and self._snap is not None:
            return
        if self.is_dirty():
            with blocked(self.saved):             # tanlangan elementni vaqtincha joyiga qaytaramiz
                self.saved.setCurrentIndex(max(0, self.saved.findData(self.cur_id)))
            r = self.ask_discard()
            if r == "cancel":
                return
            if r == "save":
                self.save_analysis()
            with blocked(self.saved):
                self.saved.setCurrentIndex(max(0, self.saved.findData(aid)))
        if aid is None:
            self.new_analysis(keep_combo=True)
            return
        a = next((x for x in self.analyses() if x["id"] == aid), None)
        if a:
            self.load(a)

    def new_analysis(self, keep_combo=False):
        self.cur_id = None
        if not keep_combo:
            with blocked(self.saved):
                self.saved.setCurrentIndex(0)
        with blocked(self.title), blocked(self.date), blocked(self.nq):
            self.title.clear()
            self.date.setDate(QDate.currentDate())
            self.nq.setValue(5)
        self.build({"q": 5, "max": [2] * 5, "rows": {}})
        self.view.clear()
        self.an = None
        self.mark_clean()

    def load(self, a):
        self.cur_id = a["id"]
        with blocked(self.title), blocked(self.date), blocked(self.nq):
            self.title.setText(a.get("title", ""))
            self.date.setDate(QDate.fromString(a["date"], "yyyy-MM-dd"))
            self.nq.setValue(a["q"])
        self.build(a)
        self.view.clear()
        self.an = None
        self.mark_clean()

    def on_nq(self):
        if self.loading:
            return
        data = self.collect()
        n = self.nq.value()
        mx = (data["max"] + [data["max"][-1] if data["max"] else 2] * n)[:n]
        for r in data["rows"].values():
            r["pts"] = (r["pts"] + [None] * n)[:n]
        data["q"], data["max"] = n, mx
        self.build(data)
        self.update_mark()

    # — jadval —
    def build(self, data):
        self.loading = True
        t, n = self.tbl, data["q"]
        self.q_built = n
        studs = self.cls()["students"]
        with blocked(t):
            t.clear()
            t.setRowCount(len(studs) + 1)
            t.setColumnCount(self.C_Q0 + n + 1)
            heads = ["✔", "№", "O'quvchi"] + [f"{i + 1}-savol" for i in range(n)] + ["Jami"]
            t.setHorizontalHeaderLabels(heads)
            t.horizontalHeaderItem(0).setToolTip("Ishtirok etdi / etmadi")
            ro = Qt.ItemFlag.ItemIsEnabled
            bold = QFont()
            bold.setBold(True)
            head_bg = QBrush(QColor(self.store.theme()["hdr_past"]))
            head_fg = QBrush(QColor(self.store.theme()["hdr_past_fg"]))
            for c in range(t.columnCount()):
                it = QTableWidgetItem("")
                it.setFlags(ro)
                it.setBackground(head_bg)
                it.setForeground(head_fg)
                it.setFont(bold)
                it.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                t.setItem(0, c, it)
            t.item(0, self.C_NAME).setText("Maksimal ball →")
            t.item(0, self.C_NAME).setTextAlignment(Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignVCenter)
            for i in range(n):
                it = t.item(0, self.C_Q0 + i)
                it.setFlags(ro | Qt.ItemFlag.ItemIsEditable | Qt.ItemFlag.ItemIsSelectable)
                it.setText(f"{data['max'][i]:g}")
                it.setData(Qt.ItemDataRole.UserRole, f"{data['max'][i]:g}")
            for r, st in enumerate(studs, 1):
                saved = data["rows"].get(st["name"], {"in": True, "pts": [None] * n})
                chk = QTableWidgetItem()
                chk.setFlags(ro | Qt.ItemFlag.ItemIsUserCheckable)
                chk.setCheckState(Qt.CheckState.Checked if saved.get("in", True) else Qt.CheckState.Unchecked)
                t.setItem(r, 0, chk)
                num = QTableWidgetItem(str(r))
                num.setFlags(ro)
                num.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                t.setItem(r, 1, num)
                nm = QTableWidgetItem(st["name"])
                nm.setFlags(ro)
                t.setItem(r, 2, nm)
                pts = (list(saved.get("pts", [])) + [None] * n)[:n]
                for i in range(n):
                    it = QTableWidgetItem("" if pts[i] is None else f"{pts[i]:g}")
                    it.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                    it.setData(Qt.ItemDataRole.UserRole, it.text())
                    t.setItem(r, self.C_Q0 + i, it)
                tot = QTableWidgetItem("")
                tot.setFlags(ro)
                tot.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                tot.setFont(bold)
                t.setItem(r, t.columnCount() - 1, tot)
            hh = t.horizontalHeader()
            hh.setSectionResizeMode(QHeaderView.ResizeMode.Interactive)
            t.setColumnWidth(0, S(44))
            t.setColumnWidth(1, S(40))
            t.setColumnWidth(2, S(230))
            hh.setMinimumSectionSize(S(56))
            for i in range(n):
                t.setColumnWidth(self.C_Q0 + i, S(74))
                hh.setSectionResizeMode(self.C_Q0 + i, QHeaderView.ResizeMode.Stretch)      # savol ustunlari bo'sh joyni teng bo'lib oladi
            t.setColumnWidth(t.columnCount() - 1, S(80))
            t.setRowHeight(0, S(30))
        self.loading = False
        for r in range(1, t.rowCount()):
            self.refresh_row(r)
        self.refresh_row(0)

    def max_values(self):
        out = []
        for i in range(self.q_built):
            v = _num(self.tbl.item(0, self.C_Q0 + i).text())
            out.append(v if v and v > 0 else 0.0)
        return out

    def refresh_row(self, r):
        with blocked(self.tbl):          # katak o'zgarishlari itemChanged ni qayta chaqirmasin
            self._refresh_row(r)

    def _refresh_row(self, r):
        t, n = self.tbl, self.q_built
        mx = self.max_values()
        last = t.columnCount() - 1
        if r == 0:
            t.item(0, last).setText(f"{sum(mx):g}")
            return
        on = t.item(r, 0).checkState() == Qt.CheckState.Checked
        total, bad = 0.0, False
        pal = t.palette()
        for i in range(n):
            it = t.item(r, self.C_Q0 + i)
            v = _num(it.text())
            over = v is not None and v > mx[i] + 1e-9
            bad = bad or over
            if on:
                it.setFlags(Qt.ItemFlag.ItemIsEnabled | Qt.ItemFlag.ItemIsEditable | Qt.ItemFlag.ItemIsSelectable)
            else:
                it.setFlags(Qt.ItemFlag.NoItemFlags)
            if on and over:
                it.setBackground(QBrush(QColor("#ef9a9a")))
                it.setForeground(QBrush(QColor("#000000")))
                it.setToolTip(f"Maksimal balldan ({mx[i]:g}) oshib ketgan")
            else:
                it.setData(Qt.ItemDataRole.BackgroundRole, None)
                it.setData(Qt.ItemDataRole.ForegroundRole, None)
                it.setToolTip("")
            if on and v:
                total += min(v, mx[i])
        tot = t.item(r, last)
        tot.setText(f"{total:g}" if on else "—")
        for c in (1, 2):
            t.item(r, c).setForeground(pal.brush(QPalette.ColorRole.Text) if on else pal.brush(QPalette.ColorGroup.Disabled, QPalette.ColorRole.Text))

    def on_item_changed(self, it):
        if self.loading:
            return
        r, c, n = it.row(), it.column(), self.q_built
        t = self.tbl
        if c == 0 and r >= 1:
            self.refresh_row(r)
            self.update_mark()
        elif self.C_Q0 <= c < self.C_Q0 + n:
            txt = it.text().strip().replace(",", ".")
            val = None if txt == "" else _num(txt)
            ok = txt == "" or (val is not None and val >= 0 and (val > 0 if r == 0 else True) and val <= 1000)
            if not ok:
                self.msg.setText('<span style="color:#c62828;">Noto\'g\'ri qiymat: musbat son kiriting '
                                 '(masalan 2 yoki 1,5).</span>')
                with blocked(t):
                    it.setText(it.data(Qt.ItemDataRole.UserRole) or "")
                return
            with blocked(t):
                it.setText("" if val is None else f"{round(val, 2):g}")
            it.setData(Qt.ItemDataRole.UserRole, it.text())
            self.msg.clear()
            if r == 0:
                for rr in range(0, t.rowCount()):
                    self.refresh_row(rr)
            else:
                self.refresh_row(r)
            self.update_mark()

    def collect(self):
        t, n = self.tbl, self.q_built
        rows = {}
        for r in range(1, t.rowCount()):
            pts = [_num(t.item(r, self.C_Q0 + i).text()) for i in range(n)]
            rows[t.item(r, 2).text()] = {"in": t.item(r, 0).checkState() == Qt.CheckState.Checked, "pts": pts}
        return {"q": n, "max": self.max_values(), "rows": rows}

    # — saqlash —
    def save_analysis(self):
        data = self.collect()
        a = {"id": self.cur_id, "title": self.title.text().strip(), "date": self.date.date().toString("yyyy-MM-dd"), **data}
        lst = self.analyses()
        if self.cur_id is None:
            ids = [int(x["id"][1:]) for x in lst if str(x["id"])[1:].isdigit()]
            a["id"] = self.cur_id = f"a{max(ids, default=0) + 1}"
            lst.append(a)
        else:
            lst[:] = [a if x["id"] == self.cur_id else x for x in lst]
        self.store.save()
        self.fill_saved(self.cur_id)
        self.mark_clean()
        self.win.statusBar().showMessage("BSB tahlili saqlandi", 8000)

    def delete_analysis(self):
        if self.cur_id is None:
            return
        if QMessageBox.question(self, "O'chirish", "Saqlangan tahlil o'chirilsinmi?") != QMessageBox.StandardButton.Yes:
            return
        lst = self.analyses()
        lst[:] = [x for x in lst if x["id"] != self.cur_id]
        self.store.save()
        self.fill_saved(None)
        self.new_analysis()

    # — tahlil —
    def run_stats(self):
        data = self.collect()
        if not data["max"] or not all(m > 0 for m in data["max"]):
            self.msg.setText('<span style="color:#c62828;">Hamma savol uchun maksimal ball (0 dan katta) kiriting.</span>')
            self.tabs.setCurrentIndex(0)
            return None
        rows = [{"name": k, **v} for k, v in data["rows"].items()]
        return bsb_stats(data["max"], rows)

    def meta(self):
        return {"label": cls_label(self.cls()), "title": self.title.text().strip(),
                "date": self.date.date().toString("dd.MM.yyyy")}

    def style_key(self):
        return self.style.currentData() or "klassik"

    def on_style(self):
        self.store.data["settings"]["bsb_pdf_style"] = self.style_key()
        self.store.save()
        if self.an is not None and self.tabs.currentIndex() == 1:
            self.analyze()

    def analyze(self):
        an = self.run_stats()
        if an is None:
            return None
        self.an = an
        self.msg.clear()
        self.view.setHtml(bsb_html(self.meta(), an, bsb_recommendations(an), False, self.style_key()))
        self.tabs.setCurrentIndex(1)
        return an

    def export_pdf(self):
        an = self.run_stats()
        if an is None:
            return
        if not an["n"] or not an["questions"]:
            QMessageBox.information(self, "PDF", "Avval ishtirok etgan o'quvchilar uchun ballarni kiriting.")
            return
        folder = self.store.path.parent / "hisobotlar"
        try:
            folder.mkdir(exist_ok=True)
        except OSError:
            folder = self.store.path.parent
        dflt = str(folder / f"BSB_tahlil_{safe_name(cls_label(self.cls()))}_{self.date.date().toString('yyyy-MM-dd')}.pdf")
        path, _ = QFileDialog.getSaveFileName(self, "BSB tahlili — PDF", dflt, "PDF (*.pdf)")
        if not path:
            return
        wide = len(an["qmax"]) > 10
        rec, meta, sk = bsb_recommendations(an), self.meta(), self.style_key()
        def done(r):
            self.analyze()
            self.win.statusBar().showMessage(f"BSB tahlili PDF saqlandi (shrift {r[0]:g} pt): {path}", 15000)
        run_bg(self, "BSB tahlili", lambda: write_pdf_fit(path, lambda f, pd: bsb_html(meta, an, rec, wide, sk, True, None, pd), landscape=wide,
                                                           fs_max=12.5, fs_min=6.5, max_pages=0, scale_base=True, title="BSB tahlili"),
               done, "PDF tayyorlanmoqda…",
               on_fail=lambda e: show_error(self, "BSB tahlili", e, "PDF faylni saqlab bo'lmadi."))

    def export_excel(self):
        an = self.run_stats()
        if an is None:
            return
        if not an["n"] or not an["questions"]:
            QMessageBox.information(self, "Excel", "Avval ishtirok etgan o'quvchilar uchun ballarni kiriting.")
            return
        folder = self.store.path.parent / "hisobotlar"
        try:
            folder.mkdir(exist_ok=True)
        except OSError:
            folder = self.store.path.parent
        dflt = str(folder / f"BSB_tahlil_{safe_name(cls_label(self.cls()))}_{self.date.date().toString('yyyy-MM-dd')}.xlsx")
        path, _ = QFileDialog.getSaveFileName(self, "BSB tahlili — Excel", dflt, "Excel (*.xlsx)")
        if not path:
            return
        data = self.collect()
        rows = [{"name": k, **v} for k, v in data["rows"].items()]
        try:
            bsb_export_xlsx(path, self.meta(), an, bsb_recommendations(an), rows)
        except ImportError:
            QMessageBox.critical(self, "Excel", "Excel yozish uchun openpyxl kerak: pip install openpyxl")
            return
        except OSError as e:
            QMessageBox.critical(self, "Excel", f"Faylni saqlab bo'lmadi:\n{e}")
            return
        self.win.statusBar().showMessage(f"BSB tahlili Excel saqlandi: {path}", 15000)

    def class_view(self):
        cls = self.cls()
        for i in range(self.win.tabs.count()):
            w = self.win.tabs.widget(i)
            if getattr(w, "cls", None) is cls and hasattr(w, "summ"):
                return w
        return None

    def transfer(self):
        """Jami ballarni Summativ sahifadagi BSB ishiga yozadi (himoya qoidalariga bo'ysunadi)."""
        an = self.run_stats()
        if an is None:
            return
        if not an["n"]:
            QMessageBox.information(self, "Summativ", "Avval ishtirok etgan o'quvchilar uchun ballarni kiriting.")
            return
        cv = self.class_view()
        if cv is None:
            QMessageBox.information(self, "Summativ", "Bu jurnal sahifasi hozir ko'rinmayapti (fan filtrini tekshiring).")
            return
        cls, iso = self.cls(), self.date.date().toString("yyyy-MM-dd")
        dlg = BsbTransferDialog(self.store, cls, an, iso, self.title.text().strip(), self)
        if not dlg.exec():
            return
        work, scale = dlg.values()
        if work is None:
            if not self.store.quarter_of(iso):
                QMessageBox.warning(self, "Summativ", f"{fmt_date(iso)} sanasi biror chorak oralig'iga kirmaydi. "
                                    "Avval «Sozlamalar → Taqvim → Choraklar» da chorak sanalarini belgilang yoki tahlil sanasini o'zgartiring.")
                return
            mx = int(an["tot_max"]) if an["tot_max"] == int(an["tot_max"]) else an["tot_max"]
            work = self.store.add_work(cls, "bsb", iso, mx, self.title.text().strip())
        values = {}
        for s_ in an["students"]:
            v = s_["total"] * work["max"] / an["tot_max"] if scale else s_["total"]
            v = round(v, 1)
            values[s_["name"]] = int(v) if v == int(v) else v
        q = self.store.quarter_of(work["date"])
        if q and cv.summ.q != q:
            cv.summ.qcb.setCurrentIndex(q - 1)
        done, skipped = cv.summ.transfer_scores(work, values)
        msg = f"BSB ({fmt_date(work['date'])}, maks. {fmt_num(work['max'])}): {done} ta o'quvchining balli Summativ sahifaga yozildi"
        if skipped:
            msg += f"; {skipped} tasi himoya tufayli o'zgartirilmadi"
        if an["absent"]:
            msg += f"; ishtirok etmaganlar ({len(an['absent'])} ta) bo'sh qoldi"
        self.win.statusBar().showMessage(msg, 15000)
        QMessageBox.information(self, "Summativ", msg + ".")


class ReportColsDialog(QDialog):
    """Hisobotda qaysi ustunlar va bloklar chiqishini checkbox bilan tanlash (jadval, PDF va Excel uchun umumiy)."""

    def __init__(self, store, parent=None):
        super().__init__(parent)
        self.store = store
        self.setWindowTitle("Hisobot ma'lumotlari")
        st = store.data["settings"]
        hidden, ex, rk = st.get("report_cols", {}), st.get("report_extras", {}), st["risk"]["show"]
        lay = QVBoxLayout(self)
        pr = QHBoxLayout()
        pr.addWidget(QLabel("Tayyor to'plamlar:"))
        for name in REPORT_PRESETS:
            b = QPushButton(name)
            b.clicked.connect(lambda _=False, n=name: self.preset(n))
            pr.addWidget(b)
        pr.addStretch(1)
        lay.addLayout(pr)
        g1 = QGroupBox("Ustunlar (№ va «O'quvchi» doim chiqadi)")
        gl = QGridLayout(g1)
        self.cols = {}
        for i, (key, text) in enumerate(REPORT_OPT_COLS):
            cb = QCheckBox(text)
            cb.setChecked(hidden.get(key, True))
            self.cols[key] = cb
            gl.addWidget(cb, i // 2, i % 2)
        n = (len(REPORT_OPT_COLS) + 1) // 2
        self.risk_cols = {}
        for j, (key, text) in enumerate((("col_risk", "Xavf (⚠)"), ("col_reason", "Xavf sababi"))):
            cb = QCheckBox(text)
            cb.setChecked(bool(rk.get(key, True)))
            self.risk_cols[key] = cb
            gl.addWidget(cb, n + j // 2, j % 2)
        lay.addWidget(g1)
        g2 = QGroupBox("Qo'shimcha bloklar")
        sl = QVBoxLayout(g2)
        self.ex = {}
        for key, text in (("cards", "Sarlavha ostidagi ko'rsatkichlar kartochkalari (dars kunlari, o'rtacha ball, davomat…)"),
                          ("footnote", "Pastdagi izoh (davomat formulasi va hisobot sanasi)")):
            cb = QCheckBox(text)
            cb.setChecked(bool(ex.get(key, True)))
            self.ex[key] = cb
            sl.addWidget(cb)
        lay.addWidget(g2)
        note = QLabel("BSB / CHSB / FB / Jami ball / Chorak bahosi ustunlari faqat chorak tanlanganda chiqadi. "
                      "Xavf mezonlari alohida: «⚙ Xavf mezonlari…».")
        note.setWordWrap(True)
        lay.addWidget(note)
        bb = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel)
        bb.accepted.connect(self.accept)
        bb.rejected.connect(self.reject)
        lay.addWidget(bb)

    def preset(self, name):
        keep = REPORT_PRESETS[name]
        for k, cb in self.cols.items():
            cb.setChecked(keep is None or k in keep)

    def accept(self):
        st = self.store.data["settings"]
        st["report_cols"] = {k: cb.isChecked() for k, cb in self.cols.items() if not cb.isChecked()}
        st["report_extras"] = {k: cb.isChecked() for k, cb in self.ex.items()}
        for k, cb in self.risk_cols.items():
            st["risk"]["show"][k] = cb.isChecked()
        super().accept()


class PdfDesignDialog(QDialog):
    """Barcha PDF hisobotlar uchun umumiy dizayn: shrift, shrift o'lchami, rang sxemasi, chetlar."""

    def __init__(self, win):
        super().__init__(win)
        self.store = win.store
        self.setWindowTitle("PDF hisobot dizayni")
        d = dict(_PDF_DESIGN)
        lay = QVBoxLayout(self)
        form = QFormLayout()
        form.addRow("Shrift:", pdf_font_combo(self.store))
        self.scale = QSpinBox()
        self.scale.setRange(60, 180)
        self.scale.setSingleStep(5)
        self.scale.setSuffix(" %")
        self.scale.setValue(d["scale"])
        self.scale.setToolTip("Barcha PDFlarda shrift o'lchamlari shu foizga ko'paytiriladi. Bir varaqqa sig'dirilgan jadvallarda — eng katta shrift chegarasi.")
        form.addRow("Shrift o'lchami:", self.scale)
        self.scheme = QComboBox()
        for k, (title, _c) in PDF_SCHEMES.items():
            self.scheme.addItem(title, k)
        self.scheme.setCurrentIndex(max(0, self.scheme.findData(d["scheme"])))
        form.addRow("Rang sxemasi:", self.scheme)
        self.layout_cb = QComboBox()
        self.layout_cb.addItem("Zamonaviy (yengil, ixcham jadval)", "zamonaviy")
        self.layout_cb.addItem("Klassik (to'q sarlavha tasmasi)", "klassik")
        self.layout_cb.setCurrentIndex(max(0, self.layout_cb.findData(d.get("layout", "zamonaviy"))))
        form.addRow("Sinf hisoboti maketi:", self.layout_cb)
        self.margin = QSpinBox()
        self.margin.setRange(4, 30)
        self.margin.setSuffix(" mm")
        self.margin.setValue(d["margin"])
        form.addRow("Sahifa chetlari:", self.margin)
        self.zebra = QCheckBox("Juft qatorlar fonini ajratish")
        self.zebra.setChecked(d["zebra"])
        form.addRow("", self.zebra)
        form.addRow("", pdf_alpha_check(self.store))
        form.addRow("Tartib:", pdf_sort_combo(self.store, "report"))
        lay.addLayout(form)
        row = QHBoxLayout()
        pv = QPushButton("👁 Namunani ko'rish")
        pv.clicked.connect(self.preview)
        row.addWidget(pv)
        row.addStretch()
        bb = QDialogButtonBox(QDialogButtonBox.StandardButton.Save | QDialogButtonBox.StandardButton.Cancel)
        bb.accepted.connect(self.accept)
        bb.rejected.connect(self.reject)
        row.addWidget(bb)
        lay.addLayout(row)

    def values(self):
        return {"scheme": self.scheme.currentData(), "scale": self.scale.value(),
                "margin": self.margin.value(), "zebra": self.zebra.isChecked(), "layout": self.layout_cb.currentData()}

    def sample_html(self):
        rows = "".join(
            "<tr>" + _cell(i, "#f1f5fa" if i % 2 == 0 else None) + _cell(n, "#f1f5fa" if i % 2 == 0 else None, align="left") +
            _cell(a, gradecolor(a)) + _cell(p, "#f1f5fa" if i % 2 == 0 else None) + "</tr>"
            for i, (n, a, p) in enumerate((("Abdullayev Jasur", 4.8, "98%"), ("Karimova Dilnoza", 4.2, "95%"),
                                           ("Yusupov Bekzod", 3.4, "81%"), ("Ergasheva Madina", 4.9, "100%")), 1))
        return (_band("Sinf hisoboti — namuna", "Davr: 1-chorak") +
                _cards([("Dars kunlari", 24), ("O'quvchilar", 4), ("O'rtacha ball", "4.33"), ("Davomat", "93.5%")]) +
                '<table width="100%" cellspacing="0" cellpadding="2"><tr>' + _th("№", 6) + _th("O'quvchi", 54) + _th("O'rtacha", 20) + _th("Davomat %", 20) +
                f"</tr>{rows}</table><p style='font-size:9pt;'>Shu dizaynda barcha hisobotlar chiqadi.</p>")

    def preview(self):
        old = dict(_PDF_DESIGN)
        set_pdf_design(self.values())
        try:
            path = Path(tempfile.gettempdir()) / "yoqlama_pdf_namuna.pdf"
            write_pdf(path, self.sample_html(), landscape=False, base_pt=11)
            QDesktopServices.openUrl(QUrl.fromLocalFile(str(path)))
        finally:
            set_pdf_design(old)

    def accept(self):
        v = self.values()
        set_pdf_design(v)
        self.store.data["settings"]["pdf_design"] = dict(_PDF_DESIGN)
        self.store.save()
        super().accept()


def gradecolor(a):
    return "#c8e6c9" if a >= 4.5 else "#fff2b3" if a >= 3.5 else "#ffcdd2"


def paint_growth(p, r, store, data, title):
    """O'sish grafigini QPainter bilan chizadi (ekran, PNG va PDF uchun umumiy). r — chizish maydoni (QRect)."""
    th = store.theme()
    txt, line, base = QColor(th["text"]), QColor(th["line"]), QColor(th["base"])
    acc, muted = QColor(th["highlight"]), QColor(th["muted"])
    p.save()
    p.setRenderHint(QPainter.RenderHint.Antialiasing, True)
    p.fillRect(r, base)
    f = QFont(p.font())
    f.setPixelSize(max(10, int(r.height() / 34)))
    p.setFont(f)
    fm = p.fontMetrics()
    L, R, T, B = fm.horizontalAdvance("10  ") + 14, 18, fm.height() * 2 + 14, fm.height() * 3 + 12
    pl = QRect(r.left() + L, r.top() + T, r.width() - L - R, r.height() - T - B)
    p.setPen(txt)
    bf = QFont(f)
    bf.setBold(True)
    p.setFont(bf)
    p.drawText(QRect(r.left() + 10, r.top() + 4, r.width() - 20, fm.height() + 4), Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignVCenter, title)
    p.setFont(f)
    n = len(data["dates"])
    if n == 0:
        p.setPen(muted)
        p.drawText(r, Qt.AlignmentFlag.AlignCenter, "Bu davrda dars kunlari yo'q")
        p.restore()
        return
    X = lambda i: pl.left() + (i + 0.5) * pl.width() / n
    Y = lambda v: pl.bottom() - v / 10.0 * pl.height()
    for v in range(0, 11, 2):                                               # gorizontal to'r
        p.setPen(QPen(line, 1, Qt.PenStyle.DotLine if v else Qt.PenStyle.SolidLine))
        p.drawLine(pl.left(), int(Y(v)), pl.right(), int(Y(v)))
        p.setPen(muted)
        p.drawText(QRect(r.left(), int(Y(v)) - fm.height() // 2, L - 6, fm.height()), Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter, str(v))
    step = max(1, int(round(n / max(2, pl.width() / (fm.horizontalAdvance("00.00") + 12)))))   # sana yozuvlari
    for i, d in enumerate(data["dates"]):
        if i % step == 0 or i == n - 1:
            p.setPen(muted)
            p.drawText(QRect(int(X(i)) - 28, pl.bottom() + 4, 56, fm.height()), Qt.AlignmentFlag.AlignCenter, f"{d[8:10]}.{d[5:7]}")
    for series, pen in ((data["cls_run"], QPen(muted, 2, Qt.PenStyle.DashLine)), (data["run"], QPen(acc, 3))):
        p.setPen(pen)
        prev = None
        for i, v in enumerate(series):
            if v is None:
                prev = None
                continue
            pt = (X(i), Y(v))
            if prev:
                p.drawLine(int(prev[0]), int(prev[1]), int(pt[0]), int(pt[1]))
            prev = pt
    rad = max(3, int(r.height() / 70))
    for i, g in data["points"]:                                             # alohida baholar
        c = QColor(store.grade_color(g) or th["highlight"])
        p.setPen(QPen(txt, 1))
        p.setBrush(c)
        p.drawEllipse(QPoint(int(X(i)), int(Y(g))), rad, rad)
    for i, wt, pct, _d in data["works"]:                                    # BSB / CHSB: foizi 10 ballik shkalada
        p.setPen(QPen(txt, 1))
        p.setBrush(QColor("#ffca28") if wt == "bsb" else QColor("#ab47bc"))
        cx, cy = int(X(i)), int(Y(pct / 10.0))
        p.drawPolygon([QPoint(cx, cy - rad - 2), QPoint(cx + rad + 2, cy), QPoint(cx, cy + rad + 2), QPoint(cx - rad - 2, cy)])
    ay = pl.bottom() + fm.height() + 8                                      # qoldirishlar qatori
    for i, a in data["abs"]:
        c = QColor(store.data["settings"]["attendance"].get(a, "#c62828"))
        p.setPen(Qt.PenStyle.NoPen)
        p.setBrush(c)
        p.drawRoundedRect(QRect(int(X(i)) - rad, ay, rad * 2, rad * 2 + 2), 2, 2)
    p.setBrush(Qt.BrushStyle.NoBrush)
    lx = pl.left()                                                           # izoh
    ly = r.bottom() - fm.height() - 2
    for text, kind in (("o'quvchi o'rtachasi", "a"), ("sinf o'rtachasi", "b"), ("baho", "c"), ("BSB", "d"), ("CHSB", "e"), ("S / DQ / K", "f")):
        p.setPen(QPen(acc, 3) if kind == "a" else QPen(muted, 2, Qt.PenStyle.DashLine) if kind == "b" else QPen(txt, 1))
        if kind in ("a", "b"):
            p.drawLine(lx, ly + fm.height() // 2, lx + 22, ly + fm.height() // 2)
        else:
            p.setBrush({"c": QColor("#66bb6a"), "d": QColor("#ffca28"), "e": QColor("#ab47bc"), "f": QColor(th["highlight"])}[kind])
            p.drawRect(lx + 6, ly + fm.height() // 2 - 5, 10, 10)
            p.setBrush(Qt.BrushStyle.NoBrush)
        p.setPen(txt)
        p.drawText(lx + 28, ly, fm.horizontalAdvance(text) + 6, fm.height(), Qt.AlignmentFlag.AlignVCenter, text)
        lx += 28 + fm.horizontalAdvance(text) + 18
    p.restore()


class GrowthChart(QWidget):
    def __init__(self, store):
        super().__init__()
        self.store, self.data, self.title = store, {"dates": [], "points": [], "run": [], "cls_run": [], "abs": [], "works": []}, ""
        self.setMinimumSize(S(560), S(320))

    def set_data(self, data, title):
        self.data, self.title = data, title
        self.update()

    def paintEvent(self, _e):
        p = QPainter(self)
        paint_growth(p, self.rect(), self.store, self.data, self.title)
        p.end()


class GrowthDialog(QDialog):
    """O'quvchining chorak (yoki butun yil) davomidagi o'sish dinamikasi: baholar, yig'ma o'rtacha, sinf bilan taqqoslash."""

    def __init__(self, parent, store, cls, name=None):
        super().__init__(parent)
        self.store, self.cls = store, cls
        self.setWindowTitle(f"O'sish grafigi — {cls_label(cls)}")
        fit_to_screen(self, 900, 620, center=False)
        lay = QVBoxLayout(self)
        top = QHBoxLayout()
        top.addWidget(QLabel("O'quvchi:"))
        self.sc = QComboBox()
        for st in sorted(cls["students"], key=lambda s: s["name"]):
            self.sc.addItem(st["name"], st["name"])
        if name and self.sc.findData(name) >= 0:
            self.sc.setCurrentIndex(self.sc.findData(name))
        top.addWidget(self.sc, 1)
        top.addWidget(QLabel("  Davr:"))
        self.pc = QComboBox()
        today = dt.date.today().isoformat()
        cur = store.quarter_of(today)
        for q in range(1, 5):
            if store.quarter_range(q):
                self.pc.addItem(f"{q}-chorak", q)
        self.pc.addItem("Butun yil", None)
        ix = self.pc.findData(cur) if cur else -1
        self.pc.setCurrentIndex(ix if ix >= 0 else self.pc.count() - 1)
        top.addWidget(self.pc)
        lay.addLayout(top)
        self.chart = GrowthChart(store)
        lay.addWidget(self.chart, 1)
        self.sum = QLabel()
        self.sum.setWordWrap(True)
        self.sum.setTextFormat(Qt.TextFormat.RichText)
        lay.addWidget(self.sum)
        row = QHBoxLayout()
        b1, b2, b3 = QPushButton("🖼 PNG saqlash…"), QPushButton("📄 PDF saqlash…"), QPushButton("Yopish")
        b1.clicked.connect(lambda: self.export("png"))
        b2.clicked.connect(lambda: self.export("pdf"))
        b3.clicked.connect(self.accept)
        row.addWidget(b1)
        row.addWidget(b2)
        row.addStretch()
        row.addWidget(b3)
        lay.addLayout(row)
        self.sc.currentIndexChanged.connect(self.refresh)
        self.pc.currentIndexChanged.connect(self.refresh)
        self.refresh()

    def student(self):
        return next((s for s in self.cls["students"] if s["name"] == self.sc.currentData()), None)

    def title(self):
        q = self.pc.currentData()
        return f"{self.sc.currentData()} — {cls_label(self.cls)} — {f'{q}-chorak' if q else 'butun yil'}"

    def refresh(self):
        st = self.student()
        if st is None:
            return
        q = self.pc.currentData()
        rng = self.store.quarter_range(q) if q else None
        self.data = self.store.growth_data(self.cls, st, rng)
        self.chart.set_data(self.data, self.title())
        pts = [g for _i, g in self.data["points"]]
        if not pts:
            self.sum.setText("Bu davrda baholar yo'q.")
            return
        half = max(1, len(pts) // 2)
        a, b = sum(pts[:half]) / half, (sum(pts[half:]) / len(pts[half:]) if pts[half:] else None)
        avg = sum(pts) / len(pts)
        cr = next((v for v in reversed(self.data["cls_run"]) if v is not None), None)
        trend = ""
        if b is not None:
            dlt = b - a
            trend = (f" &nbsp;|&nbsp; dinamika: <b style='color:{'#2e7d32' if dlt > 0.2 else '#c62828' if dlt < -0.2 else 'inherit'}'>"
                     f"{'o‘sish ▲' if dlt > 0.2 else 'pasayish ▼' if dlt < -0.2 else 'barqaror ▬'} ({dlt:+.2f})</b> "
                     f"(birinchi yarmi {a:.2f} → ikkinchi yarmi {b:.2f})")
        ab = len(self.data["abs"])
        self.sum.setText(f"Baholar: <b>{len(pts)}</b> &nbsp;|&nbsp; o'rtacha: <b>{avg:.2f}</b>"
                         + (f" &nbsp;|&nbsp; sinf o'rtachasi: <b>{cr:.2f}</b>" if cr is not None else "") + trend
                         + f" &nbsp;|&nbsp; qoldirgan darslar: <b>{ab}</b>")

    def export(self, kind):
        folder = self.store.path.parent / "hisobotlar"
        try:
            folder.mkdir(exist_ok=True)
        except OSError:
            folder = self.store.path.parent
        base = safe_name(f"osish_{self.sc.currentData()}_{self.pc.currentText()}")
        path, _ = QFileDialog.getSaveFileName(self, "O'sish grafigi", str(folder / f"{base}.{kind}"),
                                              "PNG (*.png)" if kind == "png" else "PDF (*.pdf)")
        if not path:
            return
        try:
            W, H = 1000, 520
            if kind == "png":
                img = QImage(W * 2, H * 2, QImage.Format.Format_ARGB32)
                img.fill(Qt.GlobalColor.white)
                p = QPainter(img)
                p.scale(2, 2)
                paint_growth(p, QRect(0, 0, W, H), self.store, self.data, self.title())
                p.end()
                if not img.save(path):
                    raise OSError("Rasmni saqlab bo'lmadi")
            else:
                w = QPdfWriter(path)
                w.setPageSize(QPageSize(QPageSize.PageSizeId.A4))
                w.setPageOrientation(QPageLayout.Orientation.Landscape)
                w.setPageMargins(QMarginsF(10, 10, 10, 10), QPageLayout.Unit.Millimeter)
                p = QPainter(w)
                k = w.width() / W
                p.scale(k, k)
                paint_growth(p, QRect(0, 0, W, int(min(H, w.height() / k))), self.store, self.data, self.title())
                p.end()
        except Exception as e:  # noqa: BLE001
            show_error(self, "O'sish grafigi", e, "Faylni saqlab bo'lmadi.")
            return
        QDesktopServices.openUrl(QUrl.fromLocalFile(path))


FAST_KEYS = {Qt.Key.Key_S: "s", Qt.Key.Key_D: "dq", Qt.Key.Key_K: "k", Qt.Key.Key_Q: "kq", Qt.Key.Key_C: "ch"}


PARENT_KINDS = [("att", "Davomat (qoldirilgan darslar)"), ("low", "Baholar past"), ("drop", "Baholar pasaymoqda"),
                ("good", "Maqtov (yaxshi natija)"), ("gen", "Umumiy ma'lumot")]


def parent_message(kind, lang, name, cls, row, period):
    """Ota-onaga xabar matni: o'quvchining haqiqiy ko'rsatkichlari bilan to'ldiriladi."""
    avg = f"{row['avg']:.1f}" if row and row["avg"] is not None else "—"
    att = f"{row['att']:.0f}%" if row and row["att"] is not None else "—"
    ab = row["absent"] if row else 0
    s_, dq, k = (row["s"], row["dq"], row["k"]) if row else (0, 0, 0)
    sub, cl = cls.get("subject") or "", cls_label(cls)
    if lang == "ru":
        head = f"Здравствуйте! Ваш(а) ребёнок {name} ({cl}{', ' + sub if sub else ''}). Период: {period}.\n"
        body = {
            "att": f"Пропущено уроков: {ab} (без уважительной причины — {s_}, по уважительной — {dq}, болезнь — {k}). Посещаемость: {att}. "
                   "Просим выяснить причины и сообщить мне.",
            "low": f"Средний балл за период: {avg}. Оценки ниже ожидаемого уровня. Просим помочь ребёнку с домашними заданиями; "
                   "готов(а) провести дополнительные занятия.",
            "drop": f"Оценки за период снижаются (средний балл: {avg}). Просим обратить внимание и поговорить с ребёнком.",
            "good": f"Средний балл за период: {avg}, посещаемость: {att}. Хороший результат — благодарю за поддержку!",
            "gen": f"Средний балл: {avg}, посещаемость: {att}, пропущено уроков: {ab}.",
        }[kind]
        return head + body + "\nС уважением, учитель."
    head = f"Assalomu alaykum! Farzandingiz {name} ({cl}{', ' + sub if sub else ''}). Davr: {period}.\n"
    body = {
        "att": f"Qoldirilgan darslar: {ab} ta (sababsiz — {s_}, sababli — {dq}, kasallik — {k}). Davomat: {att}. "
               "Iltimos, sababini aniqlab, menga xabar bering.",
        "low": f"Davr bo'yicha o'rtacha baho: {avg}. Baholari kutilgan darajadan past. Iltimos, uy vazifalarida farzandingizga yordam bering; "
               "qo'shimcha mashg'ulot o'tkazishga tayyorman.",
        "drop": f"Davr davomida baholari pasayib bormoqda (o'rtacha: {avg}). Iltimos, e'tibor bering va farzandingiz bilan suhbatlashing.",
        "good": f"Davr bo'yicha o'rtacha baho: {avg}, davomat: {att}. Yaxshi natija — qo'llab-quvvatlaganingiz uchun rahmat!",
        "gen": f"O'rtacha baho: {avg}, davomat: {att}, qoldirilgan darslar: {ab} ta.",
    }[kind]
    return head + body + "\nHurmat bilan, fan o'qituvchisi."


def parent_default_kind(row):
    if not row:
        return "gen"
    w = " ".join(row["why"])
    if "davomat" in w or "sababsiz" in w or "ketma-ket" in w:
        return "att"
    if "pasaymoqda" in w:
        return "drop"
    if row["why"]:
        return "low"
    if row["avg"] is not None and row["avg"] >= 8.5 and (row["att"] or 0) >= 90:
        return "good"
    return "gen"


def export_mobile_html(store, path):
    """Hamma sinflar jurnalini bitta HTML faylga chiqaradi: telefonda faqat ko'rish uchun (qidiruv, sinf tanlash).
    Eslatmalar kiritilmaydi."""
    today = dt.date.today().isoformat()
    opts, secs = [], []
    for ci, cls in enumerate(store.classes):
        dates = [d for d in cls["dates"] if d <= today]
        lo, hi = (dates[0], dates[-1]) if dates else (today, today)
        rows, _n, _d = store.report_rows(cls, lo, hi, None)
        by = {r["name"]: r for r in rows}
        opts.append(f"<option value='c{ci}'>{esc(cls_label(cls))}</option>")
        head = ("<tr><th class='nm'>O'quvchi</th><th>O'rt.</th><th>Dav.</th><th>S</th><th>DQ</th><th>K</th><th>KQ</th>"
                + "".join(f"<th class='{'x' if store.is_nolesson(cls, d) else ''}'>{d[8:]}.{d[5:7]}</th>" for d in dates) + "</tr>")
        body = []
        for st in cls["students"]:
            r = by.get(st["name"])
            cells = []
            for d in dates:
                if store.is_nolesson(cls, d):
                    cells.append("<td class='x'>X</td>")
                    continue
                m = st["marks"].get(d, "")
                t = display_mark(m).replace("\n", "/")
                g = grades_of(m)
                a = att_part(m) if m else ""
                cl = ("s" if a == "s" else "q" if a in ("dq", "k") else "l" if late_of(m) else
                      "g" + str(min(g)) if g else "")
                cells.append(f"<td class='{cl}'>{esc(t)}</td>")
            r = r or {"avg": None, "att": None, "s": 0, "dq": 0, "k": 0, "kq": 0}
            avg = "—" if r["avg"] is None else f"{r['avg']:.1f}"
            att = "—" if r["att"] is None else f"{round(r['att'])}%"
            body.append(f"<tr><td class='nm'>{esc(st['name'])}</td><td>{avg}</td><td>{att}</td><td>{r['s']}</td><td>{r['dq']}</td>"
                        f"<td>{r['k']}</td><td>{r['kq']}</td>" + "".join(cells) + "</tr>")
        works = [w for w in cls.get("works", []) if w["date"] <= today]
        wtab = ""
        if works:
            wh = "".join(f"<th>{w['type'].upper()}<br>{w['date'][8:]}.{w['date'][5:7]}<br>/{w['max']}</th>" for w in works)
            wr = "".join(f"<tr><td class='nm'>{esc(st['name'])}</td>"
                         + "".join(f"<td>{esc(str(st.get('scores', {}).get(w['id'], '')))}</td>" for w in works) + "</tr>"
                         for st in cls["students"])
            wtab = f"<h3>BSB / CHSB ballari</h3><div class='w'><table><tr><th class='nm'>O'quvchi</th>{wh}</tr>{wr}</table></div>"
        secs.append(f"<section id='c{ci}'><h2>{esc(cls_label(cls))}</h2><div class='w'><table>{head}{''.join(body)}</table></div>{wtab}</section>")
    css = ("body{font:14px system-ui,sans-serif;margin:0;background:#f4f6f8;color:#1b1f23}"
           "header{position:sticky;top:0;background:#1976d2;color:#fff;padding:8px;z-index:5;display:flex;gap:8px;flex-wrap:wrap}"
           "header select,header input{font-size:16px;padding:6px;border-radius:6px;border:0;flex:1;min-width:120px}"
           "main{padding:8px}.w{overflow:auto;background:#fff;border-radius:8px;margin-bottom:12px;max-height:80vh}"
           "table{border-collapse:collapse;font-size:13px}th,td{border:1px solid #d5dbe1;padding:4px 7px;text-align:center;white-space:nowrap}"
           "th{background:#e8eef4;position:sticky;top:0;z-index:2}.nm{text-align:left;position:sticky;left:0;background:#fff;z-index:1;font-weight:600}"
           "th.nm{background:#e8eef4;z-index:3}.x{background:#cfd8dc;color:#546e7a}"
           ".s{background:#ef9a9a}.q{background:#fff59d}.l{background:#ffcc80}"
           ".g1,.g2,.g3{background:#ffcdd2}.g4,.g5,.g6{background:#ffe0b2}.g7,.g8{background:#dcedc8}.g9,.g10{background:#a5d6a7}"
           "small{display:block;color:#667;padding:6px 10px}"
           "@media(prefers-color-scheme:dark){body{background:#14181c;color:#e6e9ec}.w{background:#1d2329}th{background:#2a323a}"
           ".nm{background:#1d2329}th.nm{background:#2a323a}th,td{border-color:#38424b}.x{background:#37474f;color:#90a4ae}"
           ".s{background:#7f2f2f}.q{background:#6b6420}.l{background:#7a5320}.g1,.g2,.g3{background:#6a2a2e}.g4,.g5,.g6{background:#6a4a20}"
           ".g7,.g8{background:#3d5a2e}.g9,.g10{background:#2e6b3a}}")
    js = ("var sel=document.getElementById('cs'),q=document.getElementById('q');"
          "function show(){document.querySelectorAll('section').forEach(function(s){s.style.display=s.id==sel.value?'':'none'});filt()}"
          "function filt(){var v=q.value.toLowerCase();document.querySelectorAll('section:not([style*=none]) tr').forEach(function(r,i){"
          "if(i==0)return;var n=r.querySelector('.nm');if(n)r.style.display=(!v||n.textContent.toLowerCase().indexOf(v)>=0)?'':'none'})}"
          "sel.onchange=show;q.oninput=filt;show();")
    html = (f"<!doctype html><html lang='uz'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
            f"<title>Jurnal</title><style>{css}</style></head><body><header><select id='cs'>{''.join(opts)}</select>"
            f"<input id='q' placeholder='O‘quvchini qidirish…'></header><main>{''.join(secs)}"
            f"<small>Faqat ko‘rish uchun nusxa · {dt.datetime.now().strftime('%d.%m.%Y %H:%M')}</small></main><script>{js}</script></body></html>")
    Path(path).write_text(html, encoding="utf-8")


class FastAttendDialog(QDialog):
    """Tezkor davomat: bugungi dars uchun klaviatura bilan belgilash. ↑↓ — o'quvchi, S/D/K/Q/C — belgi, 1–9, 0 (=10) — baho,
    Space / Delete — tozalash. Har belgidan keyin keyingi o'quvchiga o'tadi. Hamma o'zgarishlar jurnal himoyasi va tarixiga bo'ysunadi."""

    def __init__(self, view):
        super().__init__(view)
        self.view = view
        self.c = view.today_col()
        self.setWindowTitle(f"⚡ Tezkor davomat — {cls_label(view.cls)} — {fmt_date(view.dates[self.c])}")
        fit_to_screen(self, 520, 640, center=False)
        lay = QVBoxLayout(self)
        h = QLabel("<b>S</b> sababsiz · <b>D</b> sababli · <b>K</b> kasal · <b>Q</b> kech qoldi · <b>C</b> chet elda · "
                   "<b>1–9, 0</b> baho (0 = 10) · <b>Space</b> tozalash · <b>↑↓</b> o'quvchi")
        h.setWordWrap(True)
        lay.addWidget(h)
        les = view.cls.get("lessons", {}).get(view.dates[self.c], {})
        self._les0 = (les.get("topic", ""), les.get("hw", ""))
        form = QFormLayout()
        self.topic = QLineEdit(self._les0[0])
        self.topic.setPlaceholderText("Dars mavzusi (Ctrl+T)")
        self.hw = QLineEdit(self._les0[1])
        self.hw.setPlaceholderText("Uy vazifasi")
        form.addRow("Mavzu:", self.topic)
        form.addRow("Uy vazifasi:", self.hw)
        lay.addLayout(form)
        self.lst = QListWidget()
        self.lst.setUniformItemSizes(True)
        lay.addWidget(self.lst, 1)
        for e in (self.topic, self.hw):
            e.returnPressed.connect(self.lst.setFocus)
        QShortcut(QKeySequence("Ctrl+T"), self, self.topic.setFocus)
        opt = QHBoxLayout()
        self.skip = QCheckBox("Baho qo'yilgach — keyingi belgilanmaganga o'tish")
        self.skip.setToolTip("Og'zaki so'rovda qulay: baho qo'yilgan o'quvchilar o'tkazib yuboriladi")
        self.second = QCheckBox("＋2 (ikkinchi baho)")
        self.second.setToolTip("Baho mavjud bahoni almashtirmaydi, ikkinchi baho sifatida qo'shiladi")
        for c_ in (self.skip, self.second):
            c_.setFocusPolicy(Qt.FocusPolicy.NoFocus)
            opt.addWidget(c_)
        lay.addLayout(opt)
        self.info = QLabel()
        lay.addWidget(self.info)
        b = QPushButton("✓ Qolganlari keldi — davomatni tasdiqlash (Enter)")
        b.setToolTip("Belgilanmagan o'quvchilar darsda bo'lgan deb hisoblanadi (jurnalda bo'sh katak = keldi). "
                     "Bu kun uchun davomat tasdiqlangan deb eslab qolinadi.")
        b.clicked.connect(self.confirm)
        b.setAutoDefault(False)
        lay.addWidget(b)
        b = QPushButton("Yopish")
        b.clicked.connect(self.accept)
        b.setAutoDefault(False)
        lay.addWidget(b)
        self.refill()
        self.lst.setCurrentRow(0)
        self.lst.setFocus()

    def save_lesson(self):
        topic, hw = self.topic.text().strip(), self.hw.text().strip()
        if (topic, hw) == self._les0:
            return
        cls, iso = self.view.cls, self.view.dates[self.c]
        old = cls["lessons"].get(iso, {})
        if topic or hw:
            new = {"topic": topic, "hw": hw}
            if old.get("auto") and old.get("topic") == topic:
                new.update(auto=True, si=old.get("si"))
            cls["lessons"][iso] = new
        else:
            cls["lessons"].pop(iso, None)
        self.view.store.reflow_plan(cls)
        self.view.store.save()
        self._les0 = (topic, hw)

    def done(self, r):
        self.save_lesson()
        super().done(r)

    def confirm(self):
        ok = self.view.cls.setdefault("att_ok", [])
        d = self.view.dates[self.c]
        if d not in ok:
            ok.append(d)
            del ok[:-400]
        self.view.store.save()
        self.view.say(f"{cls_label(self.view.cls)}: {fmt_date(d)} uchun davomat tasdiqlandi.", 6000)
        self.view.store.save()
        self.accept()

    def text_of(self, r):
        m = self.view.students[r]["marks"].get(self.view.dates[self.c], "")
        star = "⭐ " if self.view.students[r].get("star") else ""
        return f"{r + 1}. {star}{self.view.students[r]['name']}   —   {display_mark(m) if m else '·'}"

    def refill(self):
        cur = self.lst.currentRow()
        self.lst.clear()
        for r in range(len(self.view.students)):
            self.lst.addItem(self.text_of(r))
        if cur >= 0:
            self.lst.setCurrentRow(min(cur, self.lst.count() - 1))
        d = self.view.dates[self.c]
        ms = [st["marks"].get(d, "") for st in self.view.students]
        self.info.setText(f"Belgilangan: {sum(1 for m in ms if m)} / {len(ms)} · "
                          f"yo'qlama: {sum(1 for m in ms if att_part(m) in ('s', 'dq', 'k'))} ta"
                          + (" · ✓ davomat tasdiqlangan" if d in self.view.cls.get("att_ok", []) else ""))

    def keyPressEvent(self, e):
        r = self.lst.currentRow()
        k, t = e.key(), e.text()
        if e.modifiers() & (Qt.KeyboardModifier.ControlModifier | Qt.KeyboardModifier.AltModifier):
            return super().keyPressEvent(e)
        val = None
        if k in FAST_KEYS:
            val = FAST_KEYS[k]
        elif k in (Qt.Key.Key_Return, Qt.Key.Key_Enter):
            return self.confirm()
        elif k in (Qt.Key.Key_Space, Qt.Key.Key_Delete, Qt.Key.Key_Backspace):
            val = ""
        elif t and t in "123456789":
            val = t
        elif t == "0":
            val = "10"
        if val is None or r < 0:
            return super().keyPressEvent(e)
        self.view.set_today_mark(r, val, self.second.isChecked() and val.isdigit())
        self.refill()
        nxt = r + 1
        if self.skip.isChecked() and val.isdigit():
            d = self.view.dates[self.c]
            while nxt < len(self.view.students) and self.view.students[nxt]["marks"].get(d):
                nxt += 1
        self.lst.setCurrentRow(min(nxt, self.lst.count() - 1))


class StudentCardDialog(QDialog):
    """O'quvchi kartochkasi: ko'rsatkichlar, chorak natijasi, xavf sabablari, o'sish grafigi va o'qituvchi eslatmalari."""

    def __init__(self, parent, store, cls, name):
        super().__init__(parent)
        self.store, self.cls, self.name = store, cls, name
        self.st = next(s for s in cls["students"] if s["name"] == name)
        self.setWindowTitle(f"Kartochka — {name}")
        fit_to_screen(self, 980, 700, center=False)
        lay = QVBoxLayout(self)
        top = QHBoxLayout()
        t = QLabel(f"<h2 style='margin:0'>{esc(name)}</h2>{esc(cls_label(cls))}")
        top.addWidget(t, 1)
        top.addWidget(QLabel("Davr:"))
        self.pc = QComboBox()
        for q in range(1, 5):
            if store.quarter_range(q):
                self.pc.addItem(f"{q}-chorak", q)
        self.pc.addItem("Butun yil", None)
        cur = store.quarter_of(dt.date.today().isoformat())
        ix = self.pc.findData(cur) if cur else -1
        self.pc.setCurrentIndex(ix if ix >= 0 else self.pc.count() - 1)
        top.addWidget(self.pc)
        lay.addLayout(top)
        body = QHBoxLayout()
        left = QVBoxLayout()
        self.sum = QLabel()
        self.sum.setWordWrap(True)
        self.sum.setTextFormat(Qt.TextFormat.RichText)
        self.sum.setAlignment(Qt.AlignmentFlag.AlignTop)
        left.addWidget(self.sum)
        self.qt = QTableWidget()
        self.qt.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.qt.setSelectionMode(QAbstractItemView.SelectionMode.NoSelection)
        self.qt.verticalHeader().setDefaultSectionSize(S(24))
        self.qt.horizontalHeader().setFixedHeight(S(26))
        self.qt.setFixedHeight(S(26 + 7 * 24 + 6))
        self.qt.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        left.addWidget(self.qt)
        self.chart = GrowthChart(store)
        left.addWidget(self.chart, 1)
        body.addLayout(left, 3)
        right = QVBoxLayout()
        right.addWidget(QLabel("<b>📝 Eslatmalar</b>"))
        self.notes = QListWidget()
        self.notes.setWordWrap(True)
        right.addWidget(self.notes, 1)
        self.edit = QPlainTextEdit()
        self.edit.setPlaceholderText("Yangi eslatma (ota-ona bilan suhbat, kuzatuv, kelishuv…)")
        self.edit.setFixedHeight(S(80))
        right.addWidget(self.edit)
        row = QHBoxLayout()
        b = QPushButton("＋ Qo'shish")
        b.clicked.connect(self.add_note)
        d = QPushButton("− O'chirish")
        d.clicked.connect(self.del_note)
        row.addWidget(b)
        row.addWidget(d)
        right.addLayout(row)
        body.addLayout(right, 2)
        lay.addLayout(body, 1)
        bot = QHBoxLayout()
        m = QPushButton("✉ Ota-onaga xabar…")
        m.clicked.connect(lambda: ParentMsgDialog(self, self.store, self.cls, self.name, self.pc.currentData()).exec())
        bot.addWidget(m)
        bot.addStretch()
        c = QPushButton("Yopish")
        c.clicked.connect(self.accept)
        bot.addWidget(c)
        lay.addLayout(bot)
        self.pc.currentIndexChanged.connect(self.refresh)
        self.refresh()
        self.fill_quarters()
        self.fill_notes()

    def fill_quarters(self):
        """Choraklar solishtirmasi: o'quvchining har chorakdagi ko'rsatkichlari va oldingi chorakka nisbatan o'zgarish."""
        store = self.store
        qs = [q for q in range(1, 5) if store.quarter_range(q)]
        labels = ["O'rtacha baho", "Baholar soni", "Davomat", "BSB", "CHSB", "Chorak bali", "Chorak bahosi"]
        self.qt.setRowCount(len(labels))
        self.qt.setColumnCount(len(qs))
        self.qt.setVerticalHeaderLabels(labels)
        self.qt.setHorizontalHeaderLabels([f"{q}-chorak" for q in qs])
        self.qt.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        today = dt.date.today().isoformat()
        prev = None
        for j, q in enumerate(qs):
            lo, hi = store.quarter_range(q)
            if lo > today:                                    # hali boshlanmagan chorak
                continue
            rows, _l, _d = store.report_rows(self.cls, lo, hi, q)
            r = next((x for x in rows if x["name"] == self.name), None)
            if r is None:
                continue
            qr = r["q"]
            vals = ["—" if r["avg"] is None else f"{r['avg']:.2f}", str(r["n"]),
                    "—" if r["att"] is None else f"{r['att']:.0f}%",
                    f"{qr['bsb']:g}/{qr['max_bsb']:g}" if qr else "—", f"{qr['chsb']:g}/{qr['max_chsb']:g}" if qr else "—",
                    f"{qr['total']:g}" if qr else "—", str(qr["grade"]) if qr and qr["grade"] else "—"]
            if prev is not None and r["avg"] is not None and prev["avg"] is not None:
                dl = r["avg"] - prev["avg"]
                vals[0] += f"  {'▲' if dl > 0.05 else '▼' if dl < -0.05 else '▬'} {dl:+.2f}"
            for i, v in enumerate(vals):
                it = QTableWidgetItem(v)
                it.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                self.qt.setItem(i, j, it)
            prev = r

    def fill_notes(self):
        self.notes.clear()
        for n in sorted(self.st.get("notes", []), key=lambda n: n.get("t", ""), reverse=True):
            it = QListWidgetItem(f"{n.get('t', '')[:10]}  {n.get('text', '')}")
            it.setData(Qt.ItemDataRole.UserRole, n)
            self.notes.addItem(it)

    def add_note(self):
        text = self.edit.toPlainText().strip()
        if not text:
            return
        self.st.setdefault("notes", []).append({"t": dt.datetime.now().isoformat(timespec="minutes"), "text": text})
        self.store.save()
        self.edit.clear()
        self.fill_notes()

    def del_note(self):
        it = self.notes.currentItem()
        if it is None:
            return
        n = it.data(Qt.ItemDataRole.UserRole)
        if QMessageBox.question(self, "Eslatma", "Eslatma o'chirilsinmi?") != QMessageBox.StandardButton.Yes:
            return
        self.st["notes"] = [x for x in self.st.get("notes", []) if x is not n and x != n]
        self.store.save()
        self.fill_notes()

    def refresh(self):
        store, q = self.store, self.pc.currentData()
        rng = store.quarter_range(q) if q else None
        today = dt.date.today().isoformat()
        lo = rng[0] if rng else min(self.cls["dates"], default=today)
        hi = rng[1] if rng else max(self.cls["dates"], default=today)
        rows, lessons, _d = store.report_rows(self.cls, lo, hi, q)
        r = next((x for x in rows if x["name"] == self.name), None)
        self.chart.set_data(store.growth_data(self.cls, self.st, rng), f"{self.name} — {f'{q}-chorak' if q else 'butun yil'}")
        if r is None:
            self.sum.setText("")
            return
        avg = f"{r['avg']:.2f}" if r["avg"] is not None else "—"
        att = f"{r['att']:.0f}%" if r["att"] is not None else "—"
        h = (f"Dars kunlari: <b>{lessons}</b> · baholar: <b>{r['n']}</b> · o'rtacha: <b>{avg}</b> · davomat: <b>{att}</b><br>"
             f"S: <b>{r['s']}</b> · DQ: <b>{r['dq']}</b> · K: <b>{r['k']}</b> · KQ: <b>{r['kq']}</b>")
        qr = r["q"]
        if qr:
            h += (f"<br>BSB: <b>{qr['bsb']}</b>/{qr['max_bsb']} · CHSB: <b>{qr['chsb']}</b>/{qr['max_chsb']} · "
                  f"FB: <b>{qr['fb']}</b> · jami: <b>{qr['total']}</b>"
                  + (f" · chorak bahosi: <b>{qr['grade']}</b>" if qr["grade"] else " · <i>(chorak bahosi hali chiqmaydi)</i>"))
        if r["why"]:
            h += "<br><span style='color:#c62828'><b>⚠ Xavf:</b> " + esc("; ".join(r["why"])) + "</span>"
        else:
            h += "<br><span style='color:#2e7d32'>✓ Xavf belgilari yo'q</span>"
        self.sum.setText(h)


class ParentMsgDialog(QDialog):
    """Ota-onaga xabar: tayyor shablon o'quvchining ko'rsatkichlari bilan to'ladi; tahrirlab nusxalanadi."""

    def __init__(self, parent, store, cls, name, q=None):
        super().__init__(parent)
        self.store, self.cls, self.name = store, cls, name
        self.setWindowTitle(f"✉ Ota-onaga xabar — {name}")
        fit_to_screen(self, 560, 420, center=False)
        today = dt.date.today().isoformat()
        rng = store.quarter_range(q) if q else None
        self.q = q
        self.lo, self.hi = (rng if rng else (min(cls["dates"], default=today), max(cls["dates"], default=today)))
        self.period = f"{q}-chorak" if q else "butun yil"
        rows, _l, _d = store.report_rows(cls, self.lo, self.hi, q)
        self.row = next((r for r in rows if r["name"] == name), None)
        lay = QVBoxLayout(self)
        top = QHBoxLayout()
        self.kc = QComboBox()
        for k, t in PARENT_KINDS:
            self.kc.addItem(t, k)
        self.kc.setCurrentIndex(self.kc.findData(parent_default_kind(self.row)))
        self.lc = QComboBox()
        self.lc.addItem("O'zbekcha", "uz")
        self.lc.addItem("Русский", "ru")
        top.addWidget(self.kc, 1)
        top.addWidget(self.lc)
        lay.addLayout(top)
        self.txt = QPlainTextEdit()
        lay.addWidget(self.txt, 1)
        row = QHBoxLayout()
        b = QPushButton("📋 Nusxalash")
        b.clicked.connect(self.copy)
        c = QPushButton("Yopish")
        c.clicked.connect(self.accept)
        row.addWidget(b)
        row.addStretch()
        row.addWidget(c)
        lay.addLayout(row)
        self.kc.currentIndexChanged.connect(self.fill)
        self.lc.currentIndexChanged.connect(self.fill)
        self.fill()

    def fill(self):
        self.txt.setPlainText(parent_message(self.kc.currentData(), self.lc.currentData(), self.name, self.cls, self.row,
                                             self.period))

    def copy(self):
        QApplication.clipboard().setText(self.txt.toPlainText())
        self.setWindowTitle("✉ Nusxalandi ✓")


class FindDialog(QDialog):
    """Ctrl+F: hamma sinflar bo'yicha o'quvchini ism bo'yicha qidirish."""

    def __init__(self, win):
        super().__init__(win)
        self.win = win
        self.setWindowTitle("🔍 O'quvchini qidirish")
        fit_to_screen(self, 460, 460, center=False)
        lay = QVBoxLayout(self)
        self.e = QLineEdit()
        self.e.setPlaceholderText("Ism yoki familiyaning bir qismi…")
        lay.addWidget(self.e)
        self.lst = QListWidget()
        lay.addWidget(self.lst, 1)
        lay.addWidget(QLabel("Enter — jurnalga o'tish · Ctrl+Enter — kartochka"))
        self.items = [(c, i, st["name"]) for c in win.store.classes for i, st in enumerate(c["students"])]
        self.e.textChanged.connect(self.fill)
        self.e.returnPressed.connect(lambda: self.go(False))
        self.lst.itemActivated.connect(lambda _i: self.go(False))
        QShortcut(QKeySequence("Ctrl+Return"), self, lambda: self.go(True))
        QShortcut(QKeySequence("Down"), self, lambda: self.lst.setCurrentRow(min(self.lst.currentRow() + 1, self.lst.count() - 1)))
        QShortcut(QKeySequence("Up"), self, lambda: self.lst.setCurrentRow(max(self.lst.currentRow() - 1, 0)))
        self.fill()
        self.e.setFocus()

    @staticmethod
    def norm(t):
        return re.sub(r"[ʻʼ`’‘']", "", t.casefold())

    def fill(self):
        v = self.norm(self.e.text().strip())
        self.lst.clear()
        self.hits = [x for x in self.items if not v or v in self.norm(x[2])][:200]
        for c, _i, n in self.hits:
            self.lst.addItem(f"{n}   ({cls_label(c)})")
        if self.hits:
            self.lst.setCurrentRow(0)

    def go(self, card):
        r = self.lst.currentRow()
        if not 0 <= r < len(self.hits):
            return
        c, i, n = self.hits[r]
        self.accept()
        self.win.select_class(c)
        v = self.win.tabs.currentWidget()
        v.set_page(0, refresh=True) if hasattr(v, "set_page") else None
        if v.students and i < len(v.students):
            v.table.setCurrentCell(i, max(v.table.currentColumn(), 0))
            v.table.selectRow(i)
            if card:
                v.show_card(i)


class BarChart(QWidget):
    """Gorizontal ustunli diagramma: [(nom, qiymat yoki None)], birlik, maksimum."""

    def __init__(self):
        super().__init__()
        self.items, self.unit, self.vmax = [], "", 10.0

    def set_data(self, items, unit, vmax):
        self.items, self.unit, self.vmax = items, unit, vmax
        self.setMinimumHeight(max(S(120), len(items) * S(30) + S(20)))
        self.update()

    def paintEvent(self, _e):
        p = QPainter(self)
        pal = self.palette()
        fm = p.fontMetrics()
        lw = max([fm.horizontalAdvance(n) for n, _v in self.items] + [S(40)]) + S(12)
        rw = fm.horizontalAdvance("100.0%") + S(8)
        h = S(22)
        x0, wmax = lw, max(10, self.width() - lw - rw - S(8))
        for i, (n, v) in enumerate(self.items):
            y = S(8) + i * S(30)
            p.setPen(pal.color(QPalette.ColorRole.WindowText))
            p.drawText(QRect(0, y, lw - S(6), h), Qt.AlignmentFlag.AlignVCenter | Qt.AlignmentFlag.AlignRight, n)
            p.fillRect(QRect(x0, y, wmax, h), pal.color(QPalette.ColorRole.AlternateBase))
            if v is None:
                p.drawText(QRect(x0 + S(6), y, wmax, h), Qt.AlignmentFlag.AlignVCenter, "—")
                continue
            w = int(wmax * max(0.0, min(1.0, v / self.vmax))) if self.vmax else 0
            p.fillRect(QRect(x0, y, w, h), pal.color(QPalette.ColorRole.Highlight))
            p.setPen(pal.color(QPalette.ColorRole.WindowText))
            p.drawText(QRect(x0 + w + S(6), y, rw, h), Qt.AlignmentFlag.AlignVCenter,
                       f"{v:.1f}{self.unit}" if self.unit == "%" else f"{v:.2f}" if self.unit == "" else f"{v:.0f}{self.unit}")
        p.end()


class CompareDialog(QDialog):
    """Sinflarni solishtirish: o'rtacha baho, davomat, xavfdagilar, BSB / CHSB foizi, chorak bali — jadval va diagramma."""
    METRICS = (("avg", "O'rtacha baho", "", 10.0), ("att", "Davomat", "%", 100.0), ("riskp", "Xavfdagilar ulushi", "%", 100.0),
               ("bsb", "BSB natijasi", "%", 100.0), ("chsb", "CHSB natijasi", "%", 100.0), ("total", "Chorak bali (o'rtacha)", " ball", 100.0))

    def __init__(self, parent, store):
        super().__init__(parent)
        self.store = store
        self.setWindowTitle("📊 Sinflarni solishtirish")
        fit_to_screen(self, 980, 680, center=False)
        lay = QVBoxLayout(self)
        top = FlowLayout()
        top.addWidget(QLabel("Davr:"))
        self.pc = QComboBox()
        for q in range(1, 5):
            if store.quarter_range(q):
                self.pc.addItem(f"{q}-chorak", q)
        self.pc.addItem("Butun yil", None)
        cur = store.quarter_of(dt.date.today().isoformat())
        ix = self.pc.findData(cur) if cur else -1
        self.pc.setCurrentIndex(ix if ix >= 0 else self.pc.count() - 1)
        top.addWidget(self.pc)
        top.addWidget(QLabel("  Fan:"))
        self.sc = QComboBox()
        self.sc.addItem("Hammasi", "")
        for sub in sorted({c.get("subject", "") for c in store.classes if c.get("subject")}):
            self.sc.addItem(sub, sub)
        top.addWidget(self.sc)
        top.addWidget(QLabel("  Parallel:"))
        self.gc = QComboBox()
        self.gc.addItem("Hammasi", "")
        for g in sorted({self.grade_of(c) for c in store.classes if self.grade_of(c)}, key=int):
            self.gc.addItem(f"{g}-sinflar", g)
        top.addWidget(self.gc)
        top.addWidget(QLabel("  Diagramma:"))
        self.mc = QComboBox()
        for k, t, _u, _m in self.METRICS:
            self.mc.addItem(t, k)
        top.addWidget(self.mc)
        lay.addWidget(FlowBox(top))
        self.tbl = QTableWidget()
        self.tbl.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.tbl.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        heads = ["Sinf", "O'quvchi", "O'rtacha baho", "Davomat", "Xavfda", "BSB", "CHSB", "Chorak bali"]
        self.tbl.setColumnCount(len(heads))
        self.tbl.setHorizontalHeaderLabels(heads)
        self.tbl.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.ResizeToContents)
        self.tbl.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self.tbl.verticalHeader().hide()
        lay.addWidget(self.tbl, 2)
        self.chart = BarChart()
        sa = QScrollArea()
        sa.setWidgetResizable(True)
        sa.setWidget(self.chart)
        lay.addWidget(sa, 2)
        row = QHBoxLayout()
        b = QPushButton("📋 Jadvalni nusxalash")
        b.clicked.connect(self.copy)
        c = QPushButton("Yopish")
        c.clicked.connect(self.accept)
        row.addWidget(b)
        row.addStretch()
        row.addWidget(c)
        lay.addLayout(row)
        for w in (self.pc, self.sc, self.gc):
            w.currentIndexChanged.connect(self.refresh)
        self.mc.currentIndexChanged.connect(self.draw)
        self.refresh()

    @staticmethod
    def grade_of(cls):
        m = re.match(r"\s*(\d+)", cls.get("name", ""))
        return m.group(1) if m else ""

    def refresh(self):
        st, q = self.store, self.pc.currentData()
        rng = st.quarter_range(q) if q else None
        today = dt.date.today().isoformat()
        self.res = []
        for c in st.classes:
            if self.sc.currentData() and c.get("subject", "") != self.sc.currentData():
                continue
            if self.gc.currentData() and self.grade_of(c) != self.gc.currentData():
                continue
            lo = rng[0] if rng else min(c["dates"], default=today)
            hi = rng[1] if rng else max(c["dates"], default=today)
            r = st.class_compare(c, lo, hi, q)
            r["riskp"] = 100.0 * r["risk"] / r["n"] if r["n"] else None
            self.res.append((cls_label(c), r))
        f = lambda v, u="", d=1: "—" if v is None else f"{v:.{d}f}{u}"
        self.tbl.setRowCount(len(self.res))
        for i, (name, r) in enumerate(self.res):
            vals = [name, str(r["n"]), f(r["avg"], "", 2), f(r["att"], "%", 0), f"{r['risk']}",
                    f(r["bsb"], "%", 0), f(r["chsb"], "%", 0), f(r["total"], "", 1)]
            for j, v in enumerate(vals):
                it = QTableWidgetItem(v)
                if j:
                    it.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                self.tbl.setItem(i, j, it)
        self.draw()

    def draw(self):
        k = self.mc.currentData()
        _k, _t, unit, vmax = next(m for m in self.METRICS if m[0] == k)
        self.chart.set_data([(n, r.get(k)) for n, r in self.res], unit, vmax)

    def copy(self):
        lines = ["\t".join(self.tbl.horizontalHeaderItem(j).text() for j in range(self.tbl.columnCount()))]
        for i in range(self.tbl.rowCount()):
            lines.append("\t".join(self.tbl.item(i, j).text() for j in range(self.tbl.columnCount())))
        QApplication.clipboard().setText("\n".join(lines))
        self.setWindowTitle("📊 Nusxalandi ✓")


class WatchDialog(QDialog):
    """⭐ Kuzatuvdagi o'quvchilar (hamma sinflar bo'yicha): joriy davr ko'rsatkichlari, xavf sabablari, oxirgi eslatma."""

    def __init__(self, win):
        super().__init__(win)
        self.win, self.store = win, win.store
        self.setWindowTitle("⭐ Kuzatuvdagi o'quvchilar")
        fit_to_screen(self, 960, 520, center=False)
        lay = QVBoxLayout(self)
        self.tbl = QTableWidget()
        heads = ["Sinf", "O'quvchi", "O'rtacha", "Davomat", "Xavf sabablari", "Oxirgi eslatma"]
        self.tbl.setColumnCount(len(heads))
        self.tbl.setHorizontalHeaderLabels(heads)
        self.tbl.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.tbl.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.tbl.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.ResizeToContents)
        self.tbl.horizontalHeader().setStretchLastSection(True)
        self.tbl.verticalHeader().hide()
        self.tbl.cellDoubleClicked.connect(lambda r, _c: self.card())
        lay.addWidget(self.tbl, 1)
        self.lbl = QLabel("Ikki marta bosing — kartochka. O'quvchini kuzatuvga jurnaldagi «O'quvchi ▾» menyusidan qo'shasiz.")
        lay.addWidget(self.lbl)
        row = QHBoxLayout()
        b = QPushButton("📇 Kartochka")
        b.clicked.connect(self.card)
        d = QPushButton("⭐ Kuzatuvdan olib tashlash")
        d.clicked.connect(self.unstar)
        c = QPushButton("Yopish")
        c.clicked.connect(self.accept)
        row.addWidget(b)
        row.addWidget(d)
        row.addStretch()
        row.addWidget(c)
        lay.addLayout(row)
        self.refresh()

    def refresh(self):
        lo, hi, q = self.store.period_now()
        self.items = []
        for cls in self.store.classes:
            if not any(s.get("star") for s in cls["students"]):
                continue
            rows, _l, _d = self.store.report_rows(cls, lo, hi, q)
            by = {r["name"]: r for r in rows}
            for st in cls["students"]:
                if st.get("star"):
                    self.items.append((cls, st, by.get(st["name"])))
        self.tbl.setRowCount(len(self.items))
        for i, (cls, st, r) in enumerate(self.items):
            notes = sorted(st.get("notes", []), key=lambda n: n.get("t", ""))
            vals = [cls_label(cls), st["name"],
                    "—" if not r or r["avg"] is None else f"{r['avg']:.2f}",
                    "—" if not r or r["att"] is None else f"{r['att']:.0f}%",
                    "; ".join(r["why"]) if r and r["why"] else "—",
                    (notes[-1]["t"][:10] + " " + notes[-1]["text"]) if notes else ""]
            for j, v in enumerate(vals):
                it = QTableWidgetItem(v)
                if j in (2, 3):
                    it.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                self.tbl.setItem(i, j, it)
        self.lbl.setText(f"Kuzatuvda: {len(self.items)} ta o'quvchi." if self.items else
                         "Kuzatuvda o'quvchi yo'q. Jurnaldagi «O'quvchi ▾» menyusidan ⭐ bilan qo'shing.")

    def cur(self):
        r = self.tbl.currentRow()
        return self.items[r] if 0 <= r < len(self.items) else None

    def card(self):
        it = self.cur()
        if it:
            StudentCardDialog(self, self.store, it[0], it[1]["name"]).exec()
            self.refresh()

    def unstar(self):
        it = self.cur()
        if it:
            it[1].pop("star", None)
            self.store.save()
            self.refresh()
            self.win.build_tabs()


class RolloverDialog(QDialog):
    """Yangi o'quv yiliga o'tkazish: sinflar bir pog'ona yuqoriga ko'chadi (8-A → 9-A), o'quvchilar ro'yxati saqlanadi,
    baholar bo'sh. Eski jurnal to'liq arxivga saqlanadi."""

    def __init__(self, win):
        super().__init__(win)
        self.win, self.store = win, win.store
        self.setWindowTitle("🎓 Yangi o'quv yiliga o'tkazish")
        fit_to_screen(self, 760, 560, center=False)
        lay = QVBoxLayout(self)
        info = QLabel("Tanlangan jurnallar uchun o'quvchilar ro'yxati bilan <b>yangi bo'sh jurnal</b> yaratiladi, eskisi esa "
                      "jurnaldan olib tashlanadi. Oldin butun jurnal <b>arxiv/</b> papkasiga to'liq saqlanadi (baholar ham). "
                      "Yangi nomni o'zgartirishingiz mumkin; nom bo'sh bo'lsa (bitiruvchilar) — faqat arxivlanadi.")
        info.setWordWrap(True)
        info.setTextFormat(Qt.TextFormat.RichText)
        lay.addWidget(info)
        top = QHBoxLayout()
        top.addWidget(QLabel("Tugagan o'quv yili:"))
        self.label = QLineEdit(self.store.school_year_label())
        self.label.setMaximumWidth(S(140))
        top.addWidget(self.label)
        top.addStretch()
        lay.addLayout(top)
        self.tbl = QTableWidget(len(self.store.classes), 4)
        self.tbl.setHorizontalHeaderLabels(["", "Joriy jurnal", "Yangi nom", "O'quvchi / baho"])
        self.tbl.verticalHeader().hide()
        self.tbl.setColumnWidth(0, S(34))
        self.tbl.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        self.tbl.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeMode.Stretch)
        self.tbl.horizontalHeader().setSectionResizeMode(3, QHeaderView.ResizeMode.ResizeToContents)
        for i, c in enumerate(self.store.classes):
            ck = QTableWidgetItem()
            ck.setFlags(Qt.ItemFlag.ItemIsUserCheckable | Qt.ItemFlag.ItemIsEnabled)
            ck.setCheckState(Qt.CheckState.Checked)
            self.tbl.setItem(i, 0, ck)
            it = QTableWidgetItem(cls_label(c))
            it.setFlags(Qt.ItemFlag.ItemIsEnabled)
            self.tbl.setItem(i, 1, it)
            self.tbl.setItem(i, 2, QTableWidgetItem(self.store.next_class_name(c["name"]) or ""))
            nm = sum(len(s["marks"]) for s in c["students"])
            inf = QTableWidgetItem(f"{len(c['students'])} / {nm}")
            inf.setFlags(Qt.ItemFlag.ItemIsEnabled)
            inf.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            self.tbl.setItem(i, 3, inf)
        lay.addWidget(self.tbl, 1)
        self.c_q = QCheckBox("Choraklar sanalarini tozalash (yangi yil sanalarini «Taqvim» dan qo'yasiz)")
        self.c_q.setChecked(True)
        lay.addWidget(self.c_q)
        lay.addWidget(QLabel("Bitiruvchi (11-sinf) jurnallarida «Yangi nom» bo'sh qoldiriladi. Kelmaydigan o'quvchilarni keyin "
                             "«O'quvchi ▾» menyusidan olib tashlaysiz."))
        bb = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel)
        bb.button(QDialogButtonBox.StandardButton.Ok).setText("O'tkazish")
        bb.button(QDialogButtonBox.StandardButton.Cancel).setText("Bekor qilish")
        bb.accepted.connect(self.go)
        bb.rejected.connect(self.reject)
        lay.addWidget(bb)

    def items(self):
        out = []
        for i, c in enumerate(self.store.classes):
            if self.tbl.item(i, 0).checkState() == Qt.CheckState.Checked:
                out.append({"cls": c, "new": self.tbl.item(i, 2).text().strip()})
        return out

    def go(self):
        its = self.items()
        if not its:
            QMessageBox.information(self, "O'tkazish", "Hech bir jurnal tanlanmagan.")
            return
        errs = self.store.rollover_check(its)
        if errs:
            QMessageBox.warning(self, "Nomlar", "\n".join(errs))
            return
        label = re.sub(r"[^\w\-]+", "_", self.label.text().strip()) or self.store.school_year_label()
        n_new = sum(1 for i in its if i["new"])
        n_marks = sum(len(s["marks"]) for i in its for s in i["cls"]["students"])
        if n_marks and not self.win.guard.require(self, f"{len(its)} ta jurnaldagi {n_marks} ta baho/yo'qlama arxivga ko'chib, "
                                                        "joriy jurnaldan olib tashlanadi."):
            return
        if QMessageBox.question(self, "Yangi o'quv yili",
                                f"{len(its)} ta jurnal arxivga saqlanadi va olib tashlanadi, {n_new} ta yangi jurnal yaratiladi.\n"
                                "Davom etasizmi?") != QMessageBox.StandardButton.Yes:
            return
        try:
            self.store.backup("yil")
            dest, created = self.store.rollover(its, label, self.c_q.isChecked())
        except OSError as e:
            show_error(self, "O'tkazish", e)
            return
        self.win.build_tabs()
        if created:
            self.win.select_class(created[0])
        self.win.statusBar().showMessage(f"Yangi o'quv yili: {len(created)} ta yangi jurnal. Arxiv: {dest}", 30000)
        QMessageBox.information(self, "Tayyor", f"{len(created)} ta yangi jurnal yaratildi.\nArxiv fayli:\n{dest}\n\n"
                                "Keyingi qadam: «Sozlamalar → Taqvim» da yangi choraklar sanalarini kiriting.")
        super().accept()


SIDE_STYLES = {"keng": 244, "tor": 150}        # yon panel kengligi (px); ranglar ilova mavzusidan olinadi
SIDE_TITLES = {"keng": "Yon panel: keng (to'liq)", "tor": "Yon panel: tor (ixcham)"}
SIDE_COMPACT = False


def side_key(v):
    return "tor" if v in ("tor", "ixcham") else "keng"


def set_side_style(key):
    globals()["SIDE_COMPACT"] = side_key(key) == "tor"


class SideDelegate(QStyledItemDelegate):
    """Yon paneldagi sinf qatori: chap chiziq, nom, qisqa ma'lumot, bugungi davomat nuqtasi va xavf soni."""

    def sizeHint(self, option, index):
        return QSize(option.rect.width(), S(34) if SIDE_COMPACT else S(50))

    def paint(self, p, opt, idx):
        name, sub, risk, state = idx.data(Qt.ItemDataRole.UserRole) or ("", "", 0, None)
        pal = opt.palette
        sel = bool(opt.state & QStyle.StateFlag.State_Selected)
        hov = bool(opt.state & QStyle.StateFlag.State_MouseOver)
        p.save()
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        r = opt.rect.adjusted(S(6), S(2), -S(6), -S(2))
        hl = pal.color(QPalette.ColorRole.Highlight)
        if sel:
            bg = QColor(hl)
            bg.setAlpha(46)
            p.setPen(Qt.PenStyle.NoPen)
            p.setBrush(bg)
            p.drawRoundedRect(r, 7, 7)
            p.setBrush(hl)
            p.drawRoundedRect(QRect(r.left(), r.top() + S(6), S(4), r.height() - S(12)), 2, 2)
        elif hov:
            bg = QColor(pal.color(QPalette.ColorRole.Text))
            bg.setAlpha(18)
            p.setPen(Qt.PenStyle.NoPen)
            p.setBrush(bg)
            p.drawRoundedRect(r, 7, 7)
        txt = pal.color(QPalette.ColorRole.Text)
        muted = QColor(txt)
        muted.setAlpha(140)
        f = QFont(opt.font)
        f.setBold(True)
        p.setFont(f)
        p.setPen(hl if sel else txt)
        x = r.left() + S(14)
        right = r.right() - S(8)
        if risk:                                               # o'ng chekkada qizil son
            rf = QFont(opt.font)
            rf.setPointSizeF(max(7.0, rf.pointSizeF() - 1.5))
            rf.setBold(True)
            p.setFont(rf)
            t = str(risk)
            w = p.fontMetrics().horizontalAdvance(t) + S(12)
            pill = QRect(right - w, r.center().y() - S(9), w, S(18))
            p.setPen(Qt.PenStyle.NoPen)
            p.setBrush(QColor("#dc2626"))
            p.drawRoundedRect(pill, 9, 9)
            p.setPen(QColor("#ffffff"))
            p.drawText(pill, Qt.AlignmentFlag.AlignCenter, t)
            right = pill.left() - S(6)
            p.setFont(f)
        if state:                                              # yashil — davomat olingan, sariq — kutilmoqda
            p.setPen(Qt.PenStyle.NoPen)
            p.setBrush(QColor("#22c55e" if state == "done" else "#f59e0b"))
            p.drawEllipse(QPoint(right - S(4), r.center().y()), S(4), S(4))
            right -= S(14)
        p.setFont(f)
        p.setPen(hl if sel else txt)
        if SIDE_COMPACT:
            p.drawText(QRect(x, r.top(), max(10, right - x), r.height()), Qt.AlignmentFlag.AlignVCenter, p.fontMetrics().elidedText(name, Qt.TextElideMode.ElideRight, max(10, right - x)))
        else:
            p.drawText(QRect(x, r.top() + S(4), max(10, right - x), S(22)), Qt.AlignmentFlag.AlignVCenter, p.fontMetrics().elidedText(name, Qt.TextElideMode.ElideRight, max(10, right - x)))
            sf = QFont(opt.font)
            sf.setPointSizeF(max(7.0, sf.pointSizeF() - 1.5))
            p.setFont(sf)
            p.setPen(muted)
            p.drawText(QRect(x, r.top() + S(25), r.width() - S(20), S(18)), Qt.AlignmentFlag.AlignVCenter, p.fontMetrics().elidedText(sub, Qt.TextElideMode.ElideRight, r.width() - S(20)))
        p.restore()


class InspectorPanel(QFrame):
    """O'ngdagi o'quvchi paneli: jadvalda tanlangan o'quvchining ko'rsatkichlari, grafigi va eslatmalari."""

    def __init__(self, win):
        super().__init__()
        self.win, self.cv, self.name = win, None, None
        self.setObjectName("inspector")
        self.setFixedWidth(S(320))
        lay = QVBoxLayout(self)
        lay.setContentsMargins(S(14), S(14), S(14), S(14))
        lay.setSpacing(S(8))
        self.title = QLabel("O'quvchini tanlang")
        self.title.setWordWrap(True)
        self.title.setStyleSheet("font-size:16pt;font-weight:700;")
        self.title.setSizePolicy(QSizePolicy.Policy.Preferred, QSizePolicy.Policy.Maximum)
        lay.addWidget(self.title)
        self.sub = QLabel()
        self.sub.setStyleSheet("color:palette(mid);")
        self.sub.setSizePolicy(QSizePolicy.Policy.Preferred, QSizePolicy.Policy.Maximum)
        lay.addWidget(self.sub)
        tiles = QHBoxLayout()
        self.tiles = []
        for cap in ("O'rtacha", "Davomat", "Baholar"):
            box = QFrame()
            box.setObjectName("tile")
            bl = QVBoxLayout(box)
            bl.setContentsMargins(S(8), S(6), S(8), S(6))
            bl.setSpacing(0)
            v = QLabel("—")
            v.setAlignment(Qt.AlignmentFlag.AlignCenter)
            v.setStyleSheet("font-size:17pt;font-weight:700;")
            c = QLabel(cap)
            c.setAlignment(Qt.AlignmentFlag.AlignCenter)
            c.setStyleSheet("color:palette(mid);font-size:8pt;")
            bl.addWidget(v)
            bl.addWidget(c)
            tiles.addWidget(box)
            self.tiles.append(v)
        lay.addLayout(tiles)
        self.info = QLabel()
        self.info.setWordWrap(True)
        self.info.setTextFormat(Qt.TextFormat.RichText)
        self.info.setSizePolicy(QSizePolicy.Policy.Preferred, QSizePolicy.Policy.Maximum)
        lay.addWidget(self.info)
        self.chart = GrowthChart(win.store)
        self.chart.setMinimumSize(S(240), S(170))
        self.chart.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Expanding)
        lay.addWidget(self.chart, 2)
        lay.addWidget(QLabel("<b>📝 Eslatmalar</b>"))
        self.notes = QListWidget()
        self.notes.setWordWrap(True)
        self.notes.setMinimumHeight(S(60))
        lay.addWidget(self.notes, 1)
        self.edit = QLineEdit()
        self.edit.setPlaceholderText("Yangi eslatma… (Enter)")
        self.edit.returnPressed.connect(self.add_note)
        lay.addWidget(self.edit)
        row = QHBoxLayout()
        for text, slot in (("📇 Kartochka", self.card), ("✉ Xabar", self.msg), ("⭐", self.star)):
            b = QPushButton(text)
            b.clicked.connect(lambda _=False, f=slot: f())
            row.addWidget(b)
        lay.addLayout(row)
        self.setStyleSheet("#inspector{background:palette(base);border-left:1px solid palette(midlight);}"
                           "#tile{background:palette(alternate-base);border-radius:10px;}")
        self.timer = QTimer(self)
        self.timer.setSingleShot(True)
        self.timer.timeout.connect(self.refresh)

    def queue(self):
        self.timer.start(90)                                 # tez-tez o'zgarishda (↑↓ tugmalari) har safar qayta hisoblamaslik uchun

    def student(self):
        cv = self.win.tabs.currentWidget()
        if cv is None or not self.isVisible():
            return None, None
        r = cv.table.currentRow()
        return (cv, cv.students[r]) if 0 <= r < len(cv.students) else (cv, None)

    def refresh(self):
        cv, st = self.student()
        self.cv = cv
        if cv is None or st is None:
            self.name = None
            self.title.setText("O'quvchini tanlang")
            self.sub.setText(cls_label(cv.cls) if cv else "")
            for v in self.tiles:
                v.setText("—")
            self.info.setText("")
            self.notes.clear()
            self.chart.set_data({"dates": [], "points": [], "run": [], "cls_run": [], "abs": [], "works": []}, "")
            return
        store, cls = self.win.store, cv.cls
        self.name = st["name"]
        lo, hi, q = store.period_now()
        rows, _l, _d = store.report_rows(cls, lo, hi, q)
        row = next((x for x in rows if x["name"] == st["name"]), None)
        self.title.setText(("⭐ " if st.get("star") else "") + st["name"])
        self.sub.setText(f"{cls_label(cls)} · {f'{q}-chorak' if q else 'joriy oy'}")
        if row:
            self.tiles[0].setText("—" if row["avg"] is None else f"{row['avg']:.1f}")
            self.tiles[1].setText("—" if row["att"] is None else f"{row['att']:.0f}%")
            self.tiles[2].setText(str(row["n"]))
            h = f"S {row['s']} · DQ {row['dq']} · K {row['k']} · KQ {row['kq']}"
            qr = row["q"]
            if qr:
                h += (f"<br>BSB {qr['bsb']:g}/{qr['max_bsb']:g} · CHSB {qr['chsb']:g}/{qr['max_chsb']:g} · FB {qr['fb']}"
                      + (f" · <b>baho {qr['grade']}</b>" if qr["grade"] else ""))
            h += (f"<br><span style='color:#dc2626'><b>⚠</b> {esc('; '.join(row['why']))}</span>" if row["why"]
                  else "<br><span style='color:#16a34a'>✓ Xavf belgilari yo'q</span>")
            self.info.setText(h)
        rng = store.quarter_range(q) if q else None
        self.chart.set_data(store.growth_data(cls, st, rng), "")
        self.notes.clear()
        for n in sorted(st.get("notes", []), key=lambda n: n.get("t", ""), reverse=True):
            self.notes.addItem(f"{n.get('t', '')[:10]}  {n.get('text', '')}")

    def add_note(self):
        text = self.edit.text().strip()
        if not text or self.cv is None or self.name is None:
            return
        st = next((s for s in self.cv.students if s["name"] == self.name), None)
        if st is None:
            return
        st.setdefault("notes", []).append({"t": dt.datetime.now().isoformat(timespec="minutes"), "text": text})
        self.win.store.save()
        self.edit.clear()
        self.refresh()

    def card(self):
        if self.cv is not None and self.name:
            StudentCardDialog(self.win, self.win.store, self.cv.cls, self.name).exec()
            self.refresh()

    def msg(self):
        if self.cv is not None and self.name:
            _lo, _hi, q = self.win.store.period_now()
            ParentMsgDialog(self.win, self.win.store, self.cv.cls, self.name, q).exec()

    def star(self):
        cv, st = self.student()
        if cv is not None and st is not None:
            cv.toggle_star([cv.table.currentRow()])
            self.refresh()


class ReadinessDialog(QDialog):
    """Chorak yakuni tayyorlik tekshiruvi: chorak bahosini chiqarish uchun nima yetishmaydi (BSB/CHSB ballari, formativ baholar)."""

    def __init__(self, parent, store):
        super().__init__(parent)
        self.store = store
        self.setWindowTitle("✔ Chorak yakuni tayyorligi")
        fit_to_screen(self, 760, 620, center=False)
        lay = QVBoxLayout(self)
        top = QHBoxLayout()
        top.addWidget(QLabel("Chorak:"))
        self.pc = QComboBox()
        for q in range(1, 5):
            if store.quarter_range(q):
                self.pc.addItem(f"{q}-chorak", q)
        cur = store.quarter_of(dt.date.today().isoformat())
        ix = self.pc.findData(cur) if cur else -1
        self.pc.setCurrentIndex(ix if ix >= 0 else max(0, self.pc.count() - 1))
        top.addWidget(self.pc)
        top.addStretch()
        lay.addLayout(top)
        self.tree = QTreeWidget()
        self.tree.setHeaderHidden(True)
        lay.addWidget(self.tree, 1)
        self.lbl = QLabel()
        lay.addWidget(self.lbl)
        b = QPushButton("Yopish")
        b.clicked.connect(self.accept)
        lay.addWidget(b, 0, Qt.AlignmentFlag.AlignRight)
        self.pc.currentIndexChanged.connect(self.refresh)
        self.refresh()

    def check(self, cls, q):
        return self.store.readiness(cls, q)

    def refresh(self):
        self.tree.clear()
        q = self.pc.currentData()
        if not q:
            self.lbl.setText("Choraklar sanalari belgilanmagan.")
            return
        tot_bad = tot = 0
        for cls in self.store.classes:
            cp, per = self.check(cls, q)
            tot += len(cls["students"])
            tot_bad += len(per)
            ok = not cp and not per
            top = QTreeWidgetItem([f"{'✅' if ok else '⚠'} {cls_label(cls)} — "
                                   + ("tayyor" if ok else f"{len(per)} / {len(cls['students'])} o'quvchida kamchilik")])
            self.tree.addTopLevelItem(top)
            for c in cp:
                QTreeWidgetItem(top, [f"Sinf: {c}"])
            for n, probs in per.items():
                it = QTreeWidgetItem(top, [n])
                for pr in probs:
                    QTreeWidgetItem(it, [pr])
            top.setExpanded(not ok and len(per) <= 12)
        self.lbl.setText(f"Jami o'quvchilar: {tot}, kamchiligi borlar: {tot_bad}.")


class ReportDialog(QDialog):
    """Sinf hisoboti: o'rtacha ball, davomat foizi, chorak balli, xavf ostidagi o'quvchilar; Excel / PDF / o'quvchi varaqlari."""

    def __init__(self, win, cls=None):
        super().__init__(win)
        self.win, self.store = win, win.store
        self.setWindowTitle("Hisobotlar")
        fit_to_screen(self, 1180, 660, center=False)
        self.rows, self.meta = [], None
        lay = QVBoxLayout(self)
        top = QHBoxLayout()
        top.addWidget(QLabel("Jurnal:"))
        self.jc = QComboBox()
        cur = cls or win.current_cls()
        for i, c in enumerate(self.store.classes):
            self.jc.addItem(cls_label(c), c)
            if c is cur:
                self.jc.setCurrentIndex(i)
        top.addWidget(self.jc)
        top.addWidget(QLabel("  Davr:"))
        self.pc = QComboBox()
        top.addWidget(self.pc)
        self.d1, self.d2 = QDateEdit(), QDateEdit()
        for d in (self.d1, self.d2):
            d.setCalendarPopup(True)
            d.setDisplayFormat("dd.MM.yyyy")
            d.setDate(QDate.currentDate())
            d.setEnabled(False)
        self.l1, self.l2 = QLabel("dan"), QLabel("gacha")
        top.addWidget(self.l1)
        top.addWidget(self.d1)
        top.addWidget(self.l2)
        top.addWidget(self.d2)
        self.only = QCheckBox("Faqat xavf ostidagilar")
        top.addWidget(self.only)
        top.addStretch()
        lay.addLayout(top)
        self.sumlbl = QLabel()
        self.sumlbl.setTextFormat(Qt.TextFormat.RichText)
        self.sumlbl.setWordWrap(True)
        lay.addWidget(self.sumlbl)
        self.tbl = QTableWidget(0, 0)
        self.tbl.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.tbl.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.tbl.setSelectionMode(QAbstractItemView.SelectionMode.ExtendedSelection)
        self.tbl.verticalHeader().hide()
        lay.addWidget(self.tbl, 1)
        row = QHBoxLayout()
        for text, slot in (("📊 Excel (.xlsx)…", self.do_xlsx), ("📄 PDF hisobot…", self.do_pdf),
                           ("👤 O'quvchi varaqlari (PDF)…", self.do_sheets)):
            b = QPushButton(text)
            b.clicked.connect(lambda _=False, s=slot: s())
            row.addWidget(b)
        for text, items in (
                ("⚙ Sozlamalar ▾", (("☑ Ustunlar va bloklar…", self.do_cols), ("⚠ Xavf mezonlari…", self.do_risk),
                                    ("🎨 PDF dizayni (shrift, rang, tartib)…", lambda: PdfDesignDialog(self.win).exec()))),
                ("🧰 Boshqa ▾", (("📈 O'sish grafigi…", self.do_growth),
                                 ("📝 BSB tahlili…", lambda: self.win.show_bsb_analysis(self.jc.currentData())),
                                 ("🖨 Bo'sh yo'qlama varag'i…", lambda: BlankSheetDialog(self.win).exec()),
                                 ("⏱ Haftalik avto-hisobot…", lambda: AutoDialog(self.win).exec())))):
            b = QPushButton(text)
            m = QMenu(b)
            for t, slot in items:
                m.addAction(t, slot)
            b.setMenu(m)
            row.addWidget(b)
        row.addStretch()
        close = QPushButton("Yopish")
        close.clicked.connect(self.reject)
        row.addWidget(close)
        lay.addLayout(row)
        self.fill_periods()
        self.jc.currentIndexChanged.connect(lambda _i: (self.fill_periods(), self.recompute()))
        self.pc.currentIndexChanged.connect(self.on_period)
        self.d1.dateChanged.connect(self.recompute)
        self.d2.dateChanged.connect(self.recompute)
        self.only.toggled.connect(self.recompute)
        self.recompute()

    # — davr —
    def cls(self):
        return self.jc.currentData()

    def fill_periods(self):
        keep = self.pc.currentData()
        with blocked(self.pc):
            self.pc.clear()
            self.pc.addItem(f"Jurnal ko'rinishi: {self.win.view.title()}", "view")
            for q in range(1, 5):
                r = self.store.quarter_range(q)
                if r:
                    self.pc.addItem(f"{q}-chorak ({fmt_date(r[0])} – {fmt_date(r[1])})", f"q{q}")
            self.pc.addItem("Butun jurnal (hamma sanalar)", "all")
            self.pc.addItem("Oraliq…", "custom")
            k = self.pc.findData(keep)
            self.pc.setCurrentIndex(max(k, 0))

    def on_period(self, _i):
        custom = self.pc.currentData() == "custom"
        for d in (self.d1, self.d2, self.l1, self.l2):
            d.setEnabled(custom)
        if custom and self.meta:
            with blocked(self.d1), blocked(self.d2):
                self.d1.setDate(QDate.fromString(self.meta[1], "yyyy-MM-dd"))
                self.d2.setDate(QDate.fromString(self.meta[2], "yyyy-MM-dd"))
        self.recompute()

    def range_for(self, cls, key):
        if key == "view":
            lo, hi = self.win.view.bounds()
            return lo, hi, None
        if key and key.startswith("q"):
            q = int(key[1:])
            lo, hi = self.store.quarter_range(q)
            return lo, hi, q
        if key == "all":
            ds = sorted(cls["dates"])
            return (ds[0], ds[-1], None) if ds else (dt.date.today().isoformat(),) * 2 + (None,)
        a, b = self.d1.date().toString("yyyy-MM-dd"), self.d2.date().toString("yyyy-MM-dd")
        return min(a, b), max(a, b), None

    # — jadval —
    def recompute(self, *_):
        cls = self.cls()
        if cls is None:
            return
        lo, hi, q = self.range_for(cls, self.pc.currentData())
        rows, lessons, _dates = self.store.report_rows(cls, lo, hi, q)
        self.rows, self.meta = rows, (cls, lo, hi, q, lessons)
        shown = [r for r in rows if r["risk"]] if self.only.isChecked() else rows
        cols = report_columns(q, self.store)
        hl = risk_show(self.store, "highlight")
        rk = self.store.data["settings"]["risk"]
        t, gc = self.tbl, self.store.grade_color
        t.setSortingEnabled(False)
        t.clear()
        t.setColumnCount(len(cols))
        t.setRowCount(len(shown))
        t.setHorizontalHeaderLabels(cols)
        red = "#ffcdd2"
        for i, row in enumerate(shown):
            for k, (c, v) in enumerate(zip(cols, report_values(row, rows.index(row) + 1, q, self.store))):
                it = QTableWidgetItem()
                if isinstance(v, (int, float)) and not isinstance(v, bool):
                    it.setData(Qt.ItemDataRole.DisplayRole, v)
                else:
                    it.setText(str(v))
                it.setTextAlignment((Qt.AlignmentFlag.AlignLeft if c in ("O'quvchi", "Sabab") else Qt.AlignmentFlag.AlignCenter)
                                    | Qt.AlignmentFlag.AlignVCenter)
                bg = None
                if c == "O'rtacha" and row["avg"] is not None:
                    bg = gc(row["avg"])
                elif c == "Baho" and v in (2, 3, 4, 5):
                    bg = gc({5: 10, 4: 8, 3: 5, 2: 2}[v])
                elif hl and c in ("O'quvchi", "Xavf", "Sabab") and row["risk"]:
                    bg = red
                elif hl and c == "Davomat %" and rk["on"].get("att") and row["att"] is not None and row["att"] < rk["att_below"]:
                    bg = red
                if bg:
                    it.setBackground(QBrush(QColor(bg)))
                    it.setForeground(QBrush(QColor(contrast(bg))))
                if c == "O'quvchi":
                    it.setData(Qt.ItemDataRole.UserRole, row["name"])
                if c == "Sabab" and row["why"]:
                    it.setToolTip("\n".join(row["why"]))
                t.setItem(i, k, it)
        for k, c in enumerate(cols):
            t.setColumnWidth(k, S({"№": 40, "O'quvchi": 230, "Sabab": 320}.get(c, 78)))
        t.horizontalHeader().setStretchLastSection(True)
        t.setSortingEnabled(True)
        sm = risk_summary(rows)
        avg = f"{sm['avg']:.2f}" if sm["avg"] is not None else "—"
        att = f"{sm['att']:.1f}%" if sm["att"] is not None else "—"
        self.sumlbl.setText(f"<b>{esc(cls_label(cls))}</b> &nbsp;|&nbsp; {esc(period_title(lo, hi, q))} &nbsp;|&nbsp; dars kunlari: "
                            f"<b>{lessons}</b> &nbsp;|&nbsp; baholarning o'rtachasi: <b>{avg}</b> &nbsp;|&nbsp; o'rtacha davomat: "
                            f"<b>{att}</b>" + (f" &nbsp;|&nbsp; xavf ostida: <b style='color:#c62828'>{sm['risk']}</b> / {sm['n']}" if risk_show(self.store, "card") else ""))

    # — eksport —
    def default_path(self, suffix):
        folder = self.store.path.parent / "hisobotlar"
        folder.mkdir(exist_ok=True)
        cls, lo, hi, q, _l = self.meta
        return str(folder / f"{safe_name(cls_label(cls))}_{lo}_{hi}{suffix}")

    def do_xlsx(self):
        if not self.meta:
            return
        path, _ = QFileDialog.getSaveFileName(self, "Excel hisobot", self.default_path(".xlsx"), "Excel (*.xlsx)")
        if not path:
            return
        cls, lo, hi, q, lessons = self.meta
        rows = list(self.rows)
        run_bg(self, "Excel hisobot", lambda: export_xlsx(path, self.store, cls, lo, hi, q, rows, lessons),
               lambda _r: self.win.statusBar().showMessage(f"Excel hisobot saqlandi: {path}", 15000),
               "Excel fayl yozilmoqda…",
               on_fail=lambda e: show_error(self, "Excel hisobot", e, "Hisobotni Excel faylga saqlab bo'lmadi."))

    def do_pdf(self):
        if not self.meta:
            return
        path, _ = QFileDialog.getSaveFileName(self, "PDF hisobot", self.default_path(".pdf"), "PDF (*.pdf)")
        if not path:
            return
        cls, lo, hi, q, lessons = self.meta
        rows = [r for r in self.rows if r["risk"]] if self.only.isChecked() else self.rows
        run_bg(self, "PDF hisobot",
               lambda: write_pdf_fit(path, lambda f, pd: report_html(self.store, cls, lo, hi, q, rows, lessons, f, pd), landscape=True),
               lambda r: self.win.statusBar().showMessage(f"PDF hisobot saqlandi (jadval shrifti {r[0]:g} pt): {path}", 15000),
               "PDF tayyorlanmoqda…",
               on_fail=lambda e: show_error(self, "PDF hisobot", e, "Hisobotni PDF faylga saqlab bo'lmadi."))

    def do_sheets(self):
        if not self.meta:
            return
        names = []
        for ix in self.tbl.selectionModel().selectedRows():
            it = self.tbl.item(ix.row(), 1)
            if it is not None and it.data(Qt.ItemDataRole.UserRole):
                names.append(it.data(Qt.ItemDataRole.UserRole))
        cls, lo, hi, q, _l = self.meta
        if not names:                                   # tanlanmagan bo'lsa — jadvalda ko'rinayotganlarning hammasi
            names = [self.tbl.item(r, 1).data(Qt.ItemDataRole.UserRole) for r in range(self.tbl.rowCount())]
        if names:
            self.win.export_student_sheets(cls, names, lo, hi, q)

    def do_cols(self):
        if ReportColsDialog(self.store, self).exec():
            self.store.save()
            self.recompute()

    def do_growth(self):
        sel = self.tbl.selectionModel().selectedRows()
        it = self.tbl.item(sel[0].row(), 1) if sel else None
        name = it.data(Qt.ItemDataRole.UserRole) if it is not None else None
        GrowthDialog(self, self.store, self.jc.currentData(), name).exec()

    def do_risk(self):
        if RiskDialog(self.store, self).exec():
            self.store.save()
            self.recompute()
            self.win.refresh_auto_bar()


class RestoreDialog(QDialog):
    TAGS = {"avto": "avtomatik", "amal": "amal oldidan", "qolda": "qo'lda", "tiklash": "tiklashdan oldin",
            "eski": "eski nusxa"}

    def __init__(self, win):
        super().__init__(win)
        self.win, self.store = win, win.store
        self.setWindowTitle("Zaxiradan tiklash")
        fit_to_screen(self, 780, 470, center=False)
        lay = QVBoxLayout(self)
        intro = QLabel("Tanlangan nusxa hozirgi barcha ma'lumotlar (sinflar, baholar, sozlamalar) o'rniga qo'yiladi. "
                       "Tiklashdan oldin hozirgi holat ham «tiklashdan oldin» nusxasida saqlanadi — xato qilsangiz, "
                       "uni ham shu ro'yxatdan qaytarib olasiz.")
        intro.setWordWrap(True)
        lay.addWidget(intro)
        self.tbl = QTableWidget(0, 6)
        self.tbl.setHorizontalHeaderLabels(["Sana va vaqt", "Turi", "Sinflar", "O'quvchilar", "Baho/ball", "Hajmi"])
        self.tbl.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.tbl.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.tbl.setSelectionMode(QAbstractItemView.SelectionMode.SingleSelection)
        for k, w in enumerate((150, 130, 80, 100, 100)):
            self.tbl.setColumnWidth(k, S(w))
        self.tbl.horizontalHeader().setStretchLastSection(True)
        self.tbl.itemSelectionChanged.connect(self.sync_btn)
        self.tbl.doubleClicked.connect(lambda _i: self.restore_selected())
        lay.addWidget(self.tbl, 1)
        row = QHBoxLayout()
        self.btn = QPushButton("↶ Tanlanganini tiklash")
        self.btn.clicked.connect(self.restore_selected)
        row.addWidget(self.btn)
        other = QPushButton("Boshqa fayldan…")
        other.clicked.connect(self.pick_file)
        row.addWidget(other)
        folder = QPushButton("Papkani ochish")
        folder.clicked.connect(win.open_backup_dir)
        row.addWidget(folder)
        row.addStretch()
        close = QPushButton("Yopish")
        close.clicked.connect(self.reject)
        row.addWidget(close)
        lay.addLayout(row)
        self.fill()

    @staticmethod
    def summary(path):
        try:
            with open(path, encoding="utf-8") as f:
                cs = json.load(f)["classes"]
            return (len(cs), sum(len(c["students"]) for c in cs),
                    sum(len(s["marks"]) + len(s.get("scores", {})) for c in cs for s in c["students"]))
        except (OSError, ValueError, KeyError, TypeError):
            return None

    def fill(self):
        self.items = self.store.backups()
        self.tbl.setRowCount(len(self.items))
        for r, b in enumerate(self.items):
            sm = self.summary(b["path"])
            vals = [f"{b['when']:%d.%m.%Y  %H:%M:%S}", self.TAGS.get(b["tag"], b["tag"]),
                    *( [str(x) for x in sm] if sm else ["buzilgan", "", ""]), f"{max(1, b['size'] // 1024)} KB"]
            for k, v in enumerate(vals):
                it = QTableWidgetItem(v)
                it.setToolTip(str(b["path"]))
                self.tbl.setItem(r, k, it)
        if self.items:
            self.tbl.selectRow(0)
        self.sync_btn()

    def sync_btn(self):
        r = self.tbl.currentRow()
        self.btn.setEnabled(0 <= r < len(self.items) and self.summary(self.items[r]["path"]) is not None)

    def restore_selected(self):
        r = self.tbl.currentRow()
        if 0 <= r < len(self.items) and self.btn.isEnabled() and self.win.restore_backup(self.items[r]["path"]):
            self.accept()

    def pick_file(self):
        path, _ = QFileDialog.getOpenFileName(self, "Jurnal fayli (.json)", str(self.store.backup_dir()),
                                              "Jurnal ma'lumotlari (*.json)")
        if path and self.win.restore_backup(Path(path)):
            self.accept()


class StudentsDialog(QDialog):
    def __init__(self, cls, parent=None):
        super().__init__(parent)
        self.have = {norm_name(st["name"]) for st in cls["students"]}
        self.setWindowTitle(f"O'quvchi qo'shish — {cls_label(cls)}")
        self.setMinimumWidth(S(480))
        lay = QVBoxLayout(self)
        lay.addWidget(QLabel("Har qatorga bitta o'quvchi («Familiya Ism»). Excel ustunini ham qo'yish mumkin:"))
        self.text = QPlainTextEdit()
        self.text.setMinimumHeight(180)
        lay.addWidget(self.text)
        self.alpha = QCheckBox("Alifbo tartibidagi o'ziga mos joyga qo'yish (o'chirilsa — ro'yxat oxiriga)")
        self.alpha.setChecked(True)
        lay.addWidget(self.alpha)
        self.info = QLabel()
        self.info.setWordWrap(True)
        lay.addWidget(self.info)
        self.bb = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel)
        self.bb.button(QDialogButtonBox.StandardButton.Ok).setText("Qo'shish")
        self.bb.accepted.connect(self.accept)
        self.bb.rejected.connect(self.reject)
        lay.addWidget(self.bb)
        self.text.textChanged.connect(self.update_state)
        self.update_state()

    def names(self):
        names, _ = AddClassDialog.parse_students(self.text.toPlainText())
        return [n for n in names if norm_name(n) not in self.have]

    def update_state(self, *_):
        allnames, dupes = AddClassDialog.parse_students(self.text.toPlainText())
        new = self.names()
        skip = dupes + len(allnames) - len(new)
        self.info.setText(f"Qo'shiladi: {len(new)} ta" +
                          (f"  (o'tkazib yuboriladi: {skip} — ro'yxatda allaqachon bor yoki takroriy)" if skip else ""))
        self.bb.button(QDialogButtonBox.StandardButton.Ok).setEnabled(bool(new))

    def values(self):
        return self.names(), self.alpha.isChecked()


class ScoreDelegate(QStyledItemDelegate):
    def __init__(self, parent, view):
        super().__init__(parent)
        self.view = view

    def createEditor(self, parent, option, index):
        if not self.view.can_edit(index.row(), index.column()):
            return None
        e = QLineEdit(parent)
        e.setAlignment(Qt.AlignmentFlag.AlignCenter)
        e.setMaxLength(6)
        e.setValidator(QRegularExpressionValidator(
            QRegularExpression(r"^(\d{1,3}([.,]\d?)?|s|dq|kq?)?$", QRegularExpression.PatternOption.CaseInsensitiveOption), e))
        return e

    def setEditorData(self, editor, index):
        editor.setText(index.data(Qt.ItemDataRole.EditRole) or "")
        editor.selectAll()

    def setModelData(self, editor, model, index):
        model.setData(index, editor.text().strip(), Qt.ItemDataRole.EditRole)


class SummativeView(QWidget):
    """Summativ baholash: BSB / CHSB ishlari, ballar va chorak umumiy balli (maks. 100) + tavsiya etilgan baho."""
    HEADS = ("BSB\njami", "CHSB", "FB", "Ballar\n/100", "Tavsiya\netilgan", "Chorak\nbahosi")

    def __init__(self, cv):
        super().__init__()
        self.cv, self.store, self.cls, self.guard = cv, cv.store, cv.cls, cv.guard
        self._works = []
        self.q = (self.store.quarter_of(dt.date.today().isoformat())
                  or next((i for i in range(1, 5) if self.store.quarter_range(i)), 1))
        lay = QVBoxLayout(self)
        bar = FlowLayout()
        bar.addWidget(QLabel("Chorak:"))
        self.qcb = QComboBox()
        for i in range(1, 5):
            self.qcb.addItem(f"{i}-chorak", i)
        self.qcb.setCurrentIndex(self.q - 1)
        self.qcb.currentIndexChanged.connect(self.on_quarter)
        bar.addWidget(self.qcb)
        self.qlbl = QLabel()
        bar.addWidget(self.qlbl)
        bar.addSpacing(14)
        for text, slot in (("＋ BSB", lambda: self.add_work("bsb")), ("＋ CHSB", lambda: self.add_work("chsb")),
                           ("✎ Ishni o'zgartirish", lambda: self.edit_work()),
                           ("− Ishni olib tashlash", lambda: self.remove_work()),
                           ("↳ Tavsiya → chorak bahosi", lambda: self.apply_recommended()),
                           ("📊 BSB tahlili…", lambda: self.window().show_bsb_analysis(self.cls))):
            b = QPushButton(text)
            b.clicked.connect(lambda _=False, s=slot: s())
            bar.addWidget(b)
        bar.addStretch()
        lay.addWidget(FlowBox(bar))
        self.warn = QLabel()
        self.warn.setWordWrap(True)
        self.warn.setTextFormat(Qt.TextFormat.RichText)
        lay.addWidget(self.warn)
        t = self.table = MarkTable()
        t.setItemDelegate(ScoreDelegate(t, self))
        t.setSelectionMode(QAbstractItemView.SelectionMode.ExtendedSelection)
        t.setEditTriggers(QAbstractItemView.EditTrigger.AnyKeyPressed
                          | QAbstractItemView.EditTrigger.DoubleClicked
                          | QAbstractItemView.EditTrigger.EditKeyPressed)
        t.verticalHeader().setDefaultSectionSize(RH())
        t.verticalHeader().setDefaultAlignment(Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignVCenter)
        t.horizontalHeader().setFixedHeight(S(58))
        t.on_delete = self.clear_selected
        t.itemChanged.connect(self.on_item_changed)
        t.currentCellChanged.connect(lambda *a: self.show_info())
        hh = t.horizontalHeader()
        hh.sectionDoubleClicked.connect(lambda c: self.edit_work(c))
        hh.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        hh.customContextMenuRequested.connect(self.header_menu)
        lay.addWidget(t, 1)
        self.info = InfoLabel(2)
        lay.addWidget(self.info)
        self.refresh()

    @property
    def students(self):
        return self.cls["students"]

    # — ko'rinish —
    def refresh(self):
        t, store = self.table, self.store
        r0, c0 = t.currentRow(), t.currentColumn()
        works = self._works = store.works_in_quarter(self.cls, self.q)
        rng = store.quarter_range(self.q)
        nw, studs = len(works), self.students
        self.qlbl.setText(f"{fmt_date(rng[0])} – {fmt_date(rng[1])}" if rng else "sanalari belgilanmagan")
        bold = QFont()
        bold.setBold(True)
        with blocked(t):
            t.clear()
            t.setRowCount(len(studs))
            t.setColumnCount(nw + len(self.HEADS))
            for c, w in enumerate(works):
                h = QTableWidgetItem(f"{w['type'].upper()}\n{w['date'][8:]}.{w['date'][5:7]}\n/{fmt_num(w['max'])}")
                h.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                h.setToolTip((w.get("title") or "Tavsifi yo'q") + "\nTahrirlash: sarlavhaga ikki marta bosing")
                t.setHorizontalHeaderItem(c, h)
                t.setColumnWidth(c, S(72))
            for k, name in enumerate(self.HEADS):
                h = QTableWidgetItem(name)
                h.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                h.setFont(bold)
                t.setHorizontalHeaderItem(nw + k, h)
                t.setColumnWidth(nw + k, S(70))
            for r, st in enumerate(studs):
                t.setVerticalHeaderItem(r, QTableWidgetItem(f"{r + 1}. {st['name']}"))
                for c, w in enumerate(works):
                    it = QTableWidgetItem()
                    it.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                    it.setFont(bold)
                    self.paint_score(it, st.get("scores", {}).get(w["id"]), w)
                    t.setItem(r, c, it)
                self.fill_totals(r)
        self.update_warn()
        if 0 <= r0 < t.rowCount() and 0 <= c0 < t.columnCount():
            t.setCurrentCell(r0, c0)
        self.show_info()

    def paint_score(self, it, v, w):
        it.setBackground(QBrush())
        it.setForeground(QBrush())
        if v is None or v == "":
            it.setText("")
            return
        if isinstance(v, str):
            it.setText(display_mark(v))
            col = self.store.data["settings"]["attendance"].get(v)
        else:
            it.setText(fmt_num(v))
            col = self.store.grade_color(max(1.0, 10.0 * v / w["max"])) if w["max"] else None
        if col:
            it.setBackground(QBrush(QColor(col)))
            it.setForeground(QBrush(QColor(contrast(col))))

    def fill_totals(self, r):
        t, store, nw = self.table, self.store, len(self._works)
        res = store.quarter_result(self.cls, self.students[r], self.q, self._works)
        gc = store.grade_color
        bold = QFont()
        bold.setBold(True)

        def ratio(v, mx):
            return gc(max(1.0, 10.0 * v / mx)) if mx else None

        def put(k, text, bg=None, tip=""):
            it = QTableWidgetItem(text)
            it.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            it.setFont(bold)
            it.setFlags(Qt.ItemFlag.ItemIsEnabled | Qt.ItemFlag.ItemIsSelectable)
            if bg:
                it.setBackground(QBrush(QColor(bg)))
                it.setForeground(QBrush(QColor(contrast(bg))))
            if tip:
                it.setToolTip(tip)
            t.setItem(r, nw + k, it)

        put(0, fmt_num(round(res["bsb"], 1)) if res["max_bsb"] else "", ratio(res["bsb"], res["max_bsb"]),
            f"BSB ballari yig'indisi (chorak uchun {BSB_TOTAL} ball). Ishlar maksimali: {fmt_num(res['max_bsb'])}")
        put(1, fmt_num(round(res["chsb"], 1)) if res["max_chsb"] else "", ratio(res["chsb"], res["max_chsb"]),
            f"CHSB balli (chorak uchun {CHSB_TOTAL} ball). Ish maksimali: {fmt_num(res['max_chsb'])}")
        tip = (f"{res['n_fb']} ta formativ baho" + (f", o'rtacha {res['avg']:.2f}" if res["avg"] is not None else "")
               + (f". Kamida {store.fb_min()} ta baho bo'lmagani uchun 0 ball."
                  if 0 < res["n_fb"] < store.fb_min() else ""))
        put(2, str(res["fb"]), ratio(res["fb"], FB_TOTAL), tip)
        maxpts = res["max_bsb"] + res["max_chsb"] + FB_TOTAL
        put(3, fmt_num(round(res["total"], 1)), ratio(res["total"], maxpts),
            f"Hozircha mumkin bo'lgan ball: {fmt_num(maxpts)} / 100")
        if res["complete"]:
            g = res["grade"]
            put(4, str(g), gc({5: 10, 4: 8, 3: 5, 2: 2}[g]), "Tavsiya etilgan baho (5 ballik): 100–86 → 5, 85–66 → 4, 65–30 → 3, qolgani → 2")
        else:
            put(4, "<100", None, "Baho barcha ishlar (BSB 50 + CHSB 40 ball) o'tkazilib, hamma ballar qo'yilgach hisoblanadi")
        fin = self.students[r].get("scores", {}).get(f"final:q{self.q}", "")
        it = QTableWidgetItem(str(fin) if fin != "" else "")
        it.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
        it.setFont(bold)
        it.setToolTip("Chorak bahosini (2–5) o'qituvchi qo'yadi; tavsiya etilgan baho yonida ko'rsatiladi")
        if fin in (2, 3, 4, 5):
            bg = gc({5: 10, 4: 8, 3: 5, 2: 2}[fin])
            if bg:
                it.setBackground(QBrush(QColor(bg)))
                it.setForeground(QBrush(QColor(contrast(bg))))
        t.setItem(r, nw + 5, it)

    def update_warn(self):
        works = self._works
        bs = [w for w in works if w["type"] == "bsb"]
        cs = [w for w in works if w["type"] == "chsb"]

        def part(name, items, target):
            s = sum(w["max"] for w in items)
            col = "#2e7d32" if s == target else ("#c62828" if s > target else "#ef6c00")
            return f"<b>{name}</b>: <span style='color:{col}'>{fmt_num(s)}/{target} ball</span> ({len(items)} ta ish)"

        if not self.store.quarter_range(self.q):
            self.warn.setText("<span style='color:#c62828'>Bu chorakning sanalari belgilanmagan — "
                              "«Sozlamalar → Taqvim → Choraklar…» orqali kiriting.</span>")
            return
        txt = (part("BSB", bs, BSB_TOTAL) + " &nbsp;|&nbsp; " + part("CHSB", cs, CHSB_TOTAL) +
               f" &nbsp;|&nbsp; <b>Formativ</b>: chorakdagi 1–10 baholar o'rtachasi, kamida {self.store.fb_min()} ta baho "
               f"kerak ({FB_TOTAL} ball)")
        notes = []
        if len(bs) > 3:
            notes.append("BSB odatda chorakda 3 tadan oshmaydi")
        if len(cs) > 1:
            notes.append("CHSB chorakda bitta bo'ladi")
        if notes:
            txt += "<br><span style='color:#ef6c00'>" + "; ".join(notes) + " — rasmiy TMR bilan solishtiring.</span>"
        self.warn.setText(txt)

    def show_info(self):
        r = self.table.currentRow()
        if not 0 <= r < len(self.students):
            self.info.setText("")
            return
        st = self.students[r]
        res = self.store.quarter_result(self.cls, st, self.q, self._works)
        maxpts = res["max_bsb"] + res["max_chsb"] + FB_TOTAL
        parts = [f"<b>{st['name']}</b>", f"BSB {fmt_num(round(res['bsb'], 1))}/{fmt_num(res['max_bsb'])}",
                 f"CHSB {fmt_num(round(res['chsb'], 1))}/{fmt_num(res['max_chsb'])}",
                 f"FB {res['fb']} ({res['n_fb']} ta baho" + (f", o'rtacha {res['avg']:.2f}" if res["avg"] is not None else "") + ")",
                 f"jami <b>{fmt_num(round(res['total'], 1))}</b> (hozircha mumkin: {fmt_num(maxpts)}/100)"]
        if res["complete"]:
            parts.append(f"tavsiya etilgan baho <b>{res['grade']}</b>")
        elif self._works and res["missing"]:
            parts.append(f"{res['missing']} ta ishga ball qo'yilmagan")
        self.info.setText(" &nbsp;|&nbsp; ".join(parts))

    def on_quarter(self, _i):
        self.q = self.qcb.currentData()
        self.refresh()

    # — ballarni kiritish —
    def can_edit(self, r, c):
        if c == len(self._works) + 5 and 0 <= r < len(self.students):       # chorak bahosi ustuni
            key = f"final:q{self.q}"
            if self.students[r].get("scores", {}).get(key, "") != "" and self.guard.is_locked():
                self.cv.say("🔒 Qo'yilgan chorak bahosi himoyalangan. O'zgartirish uchun qulfni oching.", 8000)
                return False
            return True
        if not (0 <= c < len(self._works) and 0 <= r < len(self.students)):
            return False
        if self.students[r].get("scores", {}).get(self._works[c]["id"], "") != "" and self.guard.is_locked():
            self.cv.say("🔒 Qo'yilgan ball himoyalangan. O'zgartirish uchun tepadagi «🔒 Himoyalangan» tugmasi "
                        "bilan qulfni oching.", 8000)
            return False
        return True

    undo_stack = None

    def push_undo(self, batch):
        """batch: [(o'quvchi ismi, kalit (ish id yoki final:qN), eski, yangi)] — Ctrl+Z uchun (oxirgi 100 ta)."""
        if self.undo_stack is None:
            self.undo_stack = []
        if batch:
            self.undo_stack.append(batch)
            del self.undo_stack[:-100]

    def undo_last(self):
        if not self.undo_stack:
            self.cv.say("Bekor qilinadigan o'zgarish yo'q.", 5000)
            return
        batch = self.undo_stack.pop()
        idx = {st["name"]: i for i, st in enumerate(self.students)}
        works = {w["id"]: (c, w) for c, w in enumerate(self._works)}
        todo = []
        for name, key, old, new in batch:
            r = idx.get(name)
            if r is None:
                continue
            cur = self.students[r].get("scores", {}).get(key, "")
            if cur != new:
                continue                                      # keyin yana o'zgargan — tegmaymiz
            todo.append((r, key, cur, old))
        prot = [t for t in todo if t[2] != ""]
        free = [t for t in todo if t[2] == ""]
        allowed = free
        if prot:
            ok = self.cv.guard_changes([(r, 0, str(cur), "" if old == "" else str(old)) for r, _k, cur, old in prot])
            okr = {t[0] for t in ok}
            allowed = free + [t for t in prot if t[0] in okr]
            if not allowed:
                self.undo_stack.append(batch)
                return
        if not allowed:
            self.cv.say("Bekor qilinadigan o'zgarish qolmagan (qiymatlar keyin o'zgargan).", 6000)
            return
        for r, key, cur, old in allowed:
            sc = self.students[r].setdefault("scores", {})
            if old == "":
                sc.pop(key, None)
            else:
                sc[key] = old
            if cur != "":
                w = works.get(key, (0, None))[1]
                self.store.log_change(cls_label(self.cls), self.students[r]["name"], w["date"] if w else "", cur, old,
                                      "revert", work=key, wt=(w["type"].upper() if w else f"{self.q}-CHORAK"))
        self.store.save()
        self.refresh()
        self.cv.say(f"Bekor qilindi: {len(allowed)} ta ball", 6000)

    def log(self, r, w, old, new, kind):
        self.store.log_change(cls_label(self.cls), self.students[r]["name"], w["date"], old, new, kind,
                              work=w["id"], wt=w["type"].upper())

    def update_row(self, r):
        with blocked(self.table):
            for c, w in enumerate(self._works):
                self.paint_score(self.table.item(r, c), self.students[r].get("scores", {}).get(w["id"]), w)
            self.fill_totals(r)
        self.show_info()

    def on_final_changed(self, item):
        r, key = item.row(), f"final:q{self.q}"
        st = self.students[r]
        sc = st.setdefault("scores", {})
        old, text = sc.get(key, ""), item.text().strip()
        new = "" if text == "" else (int(text) if text.isdigit() and 2 <= int(text) <= 5 else None)
        if new is None:
            self.cv.say("Chorak bahosi 2 dan 5 gacha bo'lishi kerak.", 8000)
            new = old
        todo = []
        if new != old:
            todo = self.cv.guard_changes([(r, item.column(), "" if old == "" else str(old), "" if new == "" else str(new))])
        if todo:
            if new == "":
                sc.pop(key, None)
            else:
                sc[key] = new
            if old != "":
                self.store.log_change(cls_label(self.cls), st["name"], "", old, new, "clear" if new == "" else "edit",
                                      work=key, wt=f"{self.q}-CHORAK")
            self.push_undo([(st["name"], key, old, new)])
            self.store.save()
        self.update_row(r)

    def transfer_scores(self, work, values):
        """{ism: ball} ni ishga yozadi. Mavjud ballar himoya qoidalariga bo'ysunadi. (yozilgan, o'tkazilmagan) qaytaradi."""
        todo = []
        for r, st in enumerate(self.students):
            if st["name"] not in values:
                continue
            new, old = values[st["name"]], st.get("scores", {}).get(work["id"], "")
            if old != new:
                todo.append((r, 0, "" if old == "" else str(old), new))
        done = self.cv.guard_changes(todo)
        for r, _c, old, new in done:
            self.students[r].setdefault("scores", {})[work["id"]] = new
            if old != "":
                self.log(r, work, old, new, "edit")
        self.push_undo([(self.students[r]["name"], work["id"], "" if old == "" else old, new) for r, _c, old, new in done])
        if done:
            self.store.save()
            self.refresh()
        return len(done), len(todo) - len(done)

    def apply_recommended(self):
        n = 0
        for st in self.students:
            res = self.store.quarter_result(self.cls, st, self.q, self._works)
            sc = st.setdefault("scores", {})
            if res["complete"] and sc.get(f"final:q{self.q}", "") == "":
                sc[f"final:q{self.q}"] = res["grade"]
                n += 1
        if n:
            self.store.save()
            self.refresh()
        self.cv.say(f"{self.q}-chorak: tavsiya etilgan baho {n} ta o'quvchiga qo'yildi" if n else
                    "Qo'yiladigan tavsiya yo'q (ishlar tugallanmagan yoki baholar allaqachon qo'yilgan)", 8000)

    def on_item_changed(self, item):
        r, c = item.row(), item.column()
        if c == len(self._works) + 5 and r < len(self.students):
            self.on_final_changed(item)
            return
        if c >= len(self._works) or r >= len(self.students):
            return
        w, st = self._works[c], self.students[r]
        scores = st.setdefault("scores", {})
        old = scores.get(w["id"], "")
        new = parse_score(item.text())
        if new is None or (isinstance(new, (int, float)) and new > w["max"]):
            if new is not None:
                self.cv.say(f"Ball ishning maksimal balli ({fmt_num(w['max'])}) dan oshmasligi kerak.", 8000)
            new = old
        todo = []
        if new != old:
            todo = self.cv.guard_changes([(r, c, "" if old == "" else str(old), new)])
        if todo:
            if new == "":
                scores.pop(w["id"], None)
            else:
                scores[w["id"]] = new
            if old != "":
                self.log(r, w, old, new, "clear" if new == "" else "edit")
            self.push_undo([(st["name"], w["id"], old, new)])
            self.store.save()
        self.update_row(r)

    def clear_selected(self):
        todo = []
        for it in self.table.selectedItems():
            c, r = it.column(), it.row()
            if c < len(self._works):
                old = self.students[r].get("scores", {}).get(self._works[c]["id"], "")
                if old != "":
                    todo.append((r, c, str(old), ""))
        todo = self.cv.guard_changes(todo)
        batch = []
        for r, c, _o, _n in todo:
            w = self._works[c]
            old = self.students[r]["scores"].pop(w["id"])
            self.log(r, w, old, "", "clear")
            batch.append((self.students[r]["name"], w["id"], old, ""))
        self.push_undo(batch)
        if todo:
            self.store.save()
            for r in {t[0] for t in todo}:
                self.update_row(r)

    # — ishlar (BSB / CHSB) —
    def work_at(self, c):
        c = self.table.currentColumn() if c is None else c
        if 0 <= c < len(self._works):
            return self._works[c]
        QMessageBox.information(self, "Summativ ish", "Avval ish ustunini (BSB / CHSB) tanlang.")
        return None

    def add_work(self, wtype):
        if not self.store.quarter_range(self.q):
            QMessageBox.information(self, "Chorak", "Avval chorak sanalarini belgilang.")
            self.settings()
            return
        dlg = WorkDialog(self.store, self.cls, self.q, wtype=wtype, parent=self)
        if not dlg.exec():
            return
        v = dlg.values()
        self.store.add_work(self.cls, v["type"], v["date"], v["max"], v["title"])
        self.store.save()
        self.refresh()
        self.cv.say(f"{v['type'].upper()} ishi qo'shildi: {fmt_date(v['date'])}, maksimal {v['max']} ball")

    def edit_work(self, c=None):
        w = self.work_at(c)
        if w is None:
            return
        dlg = WorkDialog(self.store, self.cls, self.q, work=w, parent=self)
        if not dlg.exec():
            return
        v = dlg.values()
        w.update(date=v["date"], max=v["max"], title=v["title"])
        w.pop("ktr", None)                       # qo'lda o'zgartirilgan ish KTR siljishlariga bo'ysunmaydi
        self.store.save()
        self.refresh()

    def remove_work(self, c=None):
        w = self.work_at(c)
        if w is None:
            return
        n = sum(1 for st in self.students if st.get("scores", {}).get(w["id"], "") != "")
        label = f"{w['type'].upper()} ({fmt_date(w['date'])})"
        if n and not self.guard.require(self, f"{label} ishidagi {n} ta ball ham o'chadi."):
            return
        box = QMessageBox(self)
        box.setIcon(QMessageBox.Icon.Warning)
        box.setWindowTitle("Ishni olib tashlash")
        box.setText(f"{label} ishi olib tashlansinmi?")
        box.setInformativeText((f"Shu ishdagi {n} ta ball ham o'chadi. " if n else "") +
                               "Oldin ma'lumotlarning zaxira nusxasi saqlanadi.")
        yes = box.addButton("Olib tashlash", QMessageBox.ButtonRole.DestructiveRole)
        no = box.addButton("Bekor qilish", QMessageBox.ButtonRole.RejectRole)
        box.setDefaultButton(no)
        box.setEscapeButton(no)
        box.exec()
        if box.clickedButton() is not yes:
            return
        backup = self.store.backup()
        if n:
            self.store.log_change(cls_label(self.cls), "(butun sinf)", w["date"], f"{n} ta ball", "", "del_work",
                                  work=w["id"], wt=w["type"].upper())
        self.store.remove_work(self.cls, w)
        self.store.save()
        self.refresh()
        self.cv.say(f"{label} ishi olib tashlandi. Zaxira nusxa: {backup.name}", 15000)

    def header_menu(self, pos):
        hh = self.table.horizontalHeader()
        c = hh.logicalIndexAt(pos)
        if not 0 <= c < len(self._works):
            return
        menu = QMenu(self)
        menu.addAction("✎ Ishni o'zgartirish…", lambda: self.edit_work(c))
        menu.addAction("− Ishni olib tashlash…", lambda: self.remove_work(c))
        menu.exec(hh.mapToGlobal(pos))

class YearView(QWidget):
    """Yillik va yakuniy baho: choraklar bo'yicha ballar, yillik ball, imtihon va tavsiya etilgan baholar."""
    HEADS = ("1-chorak\nball", "1-ch.\nbaho", "2-chorak\nball", "2-ch.\nbaho", "3-chorak\nball", "3-ch.\nbaho",
             "4-chorak\nball", "4-ch.\nbaho", "SB yig'indisi\n/ 4", "O'rtacha\nFB", "Yillik\nball", "Tavs.\nyil",
             "Yillik\nbaho", "Imtihon\n(0–100)", "Yakuniy\nball", "Tavs.\nyakuniy", "Yakuniy\nbaho")
    EDIT = {12: "final:y", 13: "exam", 16: "final:f"}

    def __init__(self, cv):
        super().__init__()
        self.cv, self.store, self.cls, self.guard = cv, cv.store, cv.cls, cv.guard
        lay = QVBoxLayout(self)
        bar = FlowLayout()
        self.cb_exam = QCheckBox("Fanda yakuniy imtihon bor")
        self.cb_exam.setChecked(bool(self.cls.get("has_exam")))
        self.cb_exam.setToolTip("Imtihon bo'lmasa, yakuniy ball yillik ball bilan bir xil bo'ladi")
        self.cb_exam.toggled.connect(self.on_exam_toggled)
        bar.addWidget(self.cb_exam)
        b = QPushButton("↳ Tavsiya → yillik / yakuniy baho")
        b.setToolTip("Hamma choraklar tugallangan o'quvchilar uchun tavsiya etilgan bahoni (bo'sh kataklarga) qo'yadi")
        b.clicked.connect(lambda _=False: self.apply_recommended())
        bar.addWidget(b)
        lay.addWidget(FlowBox(bar))
        self.note = QLabel("ⓘ Yillik ball = choraklar SB yig'indisi / 4 + o'rtacha FB · Yakuniy = 0.7 × yillik + 0.3 × imtihon  "
                           "(batafsil — kursorni shu yerga olib keling)")
        self.note.setToolTip("Yillik ball = (barcha choraklar SB ballari yig'indisi / 4) + yil bo'yicha o'rtacha formativ baho.\n"
                             "Yakuniy ball = 0.7 × yillik + 0.3 × imtihon.\nChorak bahosi — «Summativ» sahifasida.\n"
                             "Yillik ball 4 ta chorak tugallangandan keyin chiqadi.\n"
                             "Formula emaktab qo'llanmasi matniga ko'ra tuzilgan — emaktabdagi «Yillik» ustuni bilan solishtirib ko'ring.")
        self.note.setStyleSheet("font-style:italic;")
        self.note.setMinimumWidth(1)
        lay.addWidget(self.note)
        t = self.table = MarkTable()
        t.setItemDelegate(ScoreDelegate(t, self))
        t.setSelectionMode(QAbstractItemView.SelectionMode.ExtendedSelection)
        t.setEditTriggers(QAbstractItemView.EditTrigger.AnyKeyPressed | QAbstractItemView.EditTrigger.DoubleClicked
                          | QAbstractItemView.EditTrigger.EditKeyPressed)
        t.verticalHeader().setDefaultSectionSize(RH())
        t.verticalHeader().setDefaultAlignment(Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignVCenter)
        t.horizontalHeader().setFixedHeight(S(58))
        t.itemChanged.connect(self.on_item_changed)
        lay.addWidget(t, 1)
        self.refresh()

    @property
    def students(self):
        return self.cls["students"]

    def on_exam_toggled(self, on):
        self.cls["has_exam"] = bool(on)
        self.store.save()
        self.refresh()

    def refresh(self):
        t, store, gc = self.table, self.store, self.store.grade_color
        r0, c0 = t.currentRow(), t.currentColumn()
        bold = QFont()
        bold.setBold(True)
        gmap = {5: 10, 4: 8, 3: 5, 2: 2}
        with blocked(t):
            t.clear()
            t.setRowCount(len(self.students))
            t.setColumnCount(len(self.HEADS))
            for k, name in enumerate(self.HEADS):
                h = QTableWidgetItem(name)
                h.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                h.setFont(bold)
                t.setHorizontalHeaderItem(k, h)
                t.setColumnWidth(k, S(96 if k == 8 else 78))
            exam_on = bool(self.cls.get("has_exam"))
            for r, st in enumerate(self.students):
                t.setVerticalHeaderItem(r, QTableWidgetItem(f"{r + 1}. {st['name']}"))
                res = store.year_result(self.cls, st)
                sc = st.get("scores", {})

                def put(k, text, bg=None, tip="", editable=False):
                    it = QTableWidgetItem(text)
                    it.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                    it.setFont(bold)
                    it.setFlags(Qt.ItemFlag.ItemIsEnabled | Qt.ItemFlag.ItemIsSelectable
                                | (Qt.ItemFlag.ItemIsEditable if editable else Qt.ItemFlag.NoItemFlags))
                    if bg:
                        it.setBackground(QBrush(QColor(bg)))
                        it.setForeground(QBrush(QColor(contrast(bg))))
                    if tip:
                        it.setToolTip(tip)
                    t.setItem(r, k, it)

                for q in range(1, 5):
                    qr = res["q"][q - 1]
                    if qr:
                        put(2 * (q - 1), fmt_num(round(qr["total"], 1)),
                            gc(max(1.0, 10.0 * qr["total"] / max(1, qr["max_bsb"] + qr["max_chsb"] + FB_TOTAL))),
                            f"{q}-chorak: BSB {fmt_num(round(qr['bsb'], 1))}, CHSB {fmt_num(round(qr['chsb'], 1))}, "
                            f"FB {qr['fb']}" + ("" if qr["complete"] else " (chorak hali tugallanmagan)"))
                    else:
                        put(2 * (q - 1), "", None, "Chorak sanalari belgilanmagan (Sozlamalar → Taqvim → Choraklar)")
                    fq = sc.get(f"final:q{q}", "")
                    put(2 * (q - 1) + 1, str(fq) if fq != "" else "", gc(gmap[fq]) if fq in gmap else None,
                        "Chorak bahosi (Summativ sahifasida qo'yiladi)")
                if res["ready"]:
                    put(8, fmt_num(round(res["sb"] / 4, 1)))
                    put(9, f"{res['avg_fb']:.2f}")
                    put(10, fmt_num(round(res["year"], 1)), gc(max(1.0, res["year"] / 10)))
                    put(11, str(res["year_grade"]), gc(gmap[res["year_grade"]]),
                        "Tavsiya etilgan yillik baho: 100–86 → 5, 85–66 → 4, 65–30 → 3, qolgani → 2")
                else:
                    put(8, fmt_num(round(res["sb"] / 4, 1)), None, "Hozircha (hamma choraklar tugallanmagan)")
                    put(9, f"{res['avg_fb']:.2f}" if res["avg_fb"] else "")
                    put(10, "—", None, "Yillik ball 4 ta chorak (BSB 50 + CHSB 40 ball) tugallangach chiqadi")
                    put(11, "")
                yb = sc.get("final:y", "")
                put(12, str(yb) if yb != "" else "", gc(gmap[yb]) if yb in gmap else None, "Yillik baho (2–5), o'qituvchi qo'yadi", True)
                ex = sc.get("exam", "")
                if exam_on:
                    put(13, fmt_num(ex) if ex != "" else "", gc(max(1.0, ex / 10)) if isinstance(ex, (int, float)) else None,
                        "Imtihon bali (0–100)", True)
                else:
                    put(13, "—", None, "Fanda imtihon yo'q (yuqoridagi belgini yoqing)")
                if res["final"] is not None:
                    put(14, fmt_num(round(res["final"], 1)), gc(max(1.0, res["final"] / 10)))
                    put(15, str(res["final_grade"]), gc(gmap[res["final_grade"]]))
                else:
                    put(14, "—")
                    put(15, "")
                fb = sc.get("final:f", "")
                put(16, str(fb) if fb != "" else "", gc(gmap[fb]) if fb in gmap else None, "Yakuniy baho (2–5), o'qituvchi qo'yadi", True)
        if 0 <= r0 < t.rowCount() and 0 <= c0 < t.columnCount():
            t.setCurrentCell(r0, c0)

    def can_edit(self, r, c):
        key = self.EDIT.get(c)
        if key is None or not 0 <= r < len(self.students):
            return False
        if key == "exam" and not self.cls.get("has_exam"):
            return False
        if self.students[r].get("scores", {}).get(key, "") != "" and self.guard.is_locked():
            self.cv.say("🔒 Qo'yilgan qiymat himoyalangan. O'zgartirish uchun tepadagi «🔒 Himoyalangan» tugmasi bilan "
                        "qulfni oching.", 8000)
            return False
        return True

    def on_item_changed(self, item):
        r, c = item.row(), item.column()
        key = self.EDIT.get(c)
        if key is None or r >= len(self.students):
            return
        st = self.students[r]
        sc = st.setdefault("scores", {})
        old = sc.get(key, "")
        text = item.text().strip().replace(",", ".")
        new = None
        if text == "":
            new = ""
        elif key == "exam":
            v = parse_score(text)
            new = v if isinstance(v, (int, float)) and 0 <= v <= 100 else None
        elif text.isdigit() and 2 <= int(text) <= 5:
            new = int(text)
        if new is None:
            self.cv.say("Baho 2–5 oralig'ida, imtihon bali 0–100 oralig'ida bo'lishi kerak.", 8000)
            new = old
        todo = []
        if new != old:
            todo = self.cv.guard_changes([(r, c, "" if old == "" else str(old), "" if new == "" else str(new))])
        if todo:
            if new == "":
                sc.pop(key, None)
            else:
                sc[key] = new
            if old != "":
                self.store.log_change(cls_label(self.cls), st["name"], "", old, new, "clear" if new == "" else "edit",
                                      work=key, wt={"exam": "IMTIHON", "final:y": "YILLIK", "final:f": "YAKUNIY"}[key])
            self.store.save()
        self.refresh()

    def apply_recommended(self):
        n = 0
        for st in self.students:
            res = self.store.year_result(self.cls, st)
            sc = st.setdefault("scores", {})
            if res["year_grade"] is not None and sc.get("final:y", "") == "":
                sc["final:y"] = res["year_grade"]
                n += 1
            if res["final_grade"] is not None and sc.get("final:f", "") == "":
                sc["final:f"] = res["final_grade"]
                n += 1
        if n:
            self.store.save()
            self.refresh()
        self.cv.say(f"Tavsiya etilgan baholar qo'yildi: {n} ta katak" if n else
                    "Qo'yiladigan tavsiya yo'q (choraklar tugallanmagan yoki baholar allaqachon qo'yilgan)", 8000)


_ROMAN_Q = {"I": 1, "II": 2, "III": 3, "IV": 4}
_PLAN_Q = re.compile(r"^\s*(?:=+\s*)?([1-4]|IV|III|II|I)\s*-?\s*chorak\b.*$", re.I)


def _plan_qnum(m):
    g = m.group(1).upper()
    return int(g) if g.isdigit() else _ROMAN_Q[g]


def parse_plan_text(text):
    """Reja matni → mavzular. Qator: «Mavzu» yoki «Mavzu | 2» (2 soat). «== 2-chorak» sarlavhasi keyingi mavzularni
    o'sha chorak dars kunlariga bog'laydi. Boshidagi «1.», «2)» kabi raqamlar olib tashlanadi."""
    topics, q = [], None
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        m = _PLAN_Q.match(line)
        if m:
            q = _plan_qnum(m)
            continue
        h = 1
        parts = re.split(r"\s*\|\s*|\t+", line)
        if len(parts) > 1 and parts[-1].strip().isdigit():
            h = max(1, min(int(parts[-1]), 10))
            line = " | ".join(parts[:-1]).strip()
        line = re.sub(r"^\d+\s*[\.\)]\s+", "", line).strip()
        if line:
            topics.append({"t": line, "h": h, "q": q})
    return topics


def plan_to_text(topics):
    out, q = [], None
    for t in topics:
        if t.get("q") != q:
            q = t.get("q")
            if q:
                out.append(f"== {q}-chorak")
        out.append(t["t"] + (f" | {t['h']}" if int(t.get("h", 1) or 1) > 1 else ""))
    return "\n".join(out)


def read_plan_file(path):
    """Fayldan mavzular ro'yxati → (matn, meta). Qo'llab-quvvatlanadi:
    • «TAQVIM-MAVZU REJA» jadvali (.xls/.xlsx/.ods): sarlavhada [fan] — [sinf] sinf; «I CHORAK» qatorlari; ustunlar:
      Dars tartibi | Dars mavzusi | Soat | Taqvimiy muddat (har qator — bitta dars);
    • oddiy ro'yxat: 1-ustun — mavzu, 2-ustun (ixtiyoriy) — soat; .txt/.csv — har qator bitta mavzu.
    meta: {"subject": ..., "grade": ..., "hours": ..., "lessons": n}"""
    ext = Path(path).suffix.lower()
    meta = {}
    if ext not in (".xlsx", ".xls", ".ods"):
        return Path(path).read_text(encoding="utf-8", errors="replace"), meta
    import pandas as pd
    df = pd.read_excel(path, header=None)

    def cell(r, c):
        if c >= df.shape[1]:
            return ""
        v = df.iat[r, c]
        return "" if v != v or v is None else str(v).strip()

    head = " ".join(cell(r, 0) for r in range(min(3, len(df))))
    ms = re.search(r"\[([^\]]+)\]\s*[—–-]\s*\[(\d+)\]\s*sinf", head)
    if ms:
        meta.update(subject=ms.group(1).strip(), grade=int(ms.group(2)))
    mh = re.search(r"jami\s*\[(\d+)\]\s*soat", head, re.I)
    if mh:
        meta["hours"] = int(mh.group(1))
    lines, structured, lessons = [], False, 0
    for r in range(len(df)):
        a, b, c = cell(r, 0), cell(r, 1), cell(r, 2)
        mq = _PLAN_Q.match(a) if a else None
        if mq:
            lines.append(f"== {_plan_qnum(mq)}-chorak")
            structured = True
            continue
        if re.fullmatch(r"\d+(\.0)?", a) and b:                  # «Dars tartibi | mavzu | soat»
            try:
                h = int(float(c)) if c else 1
            except ValueError:
                h = 1
            h = max(1, min(h, 10))
            lines.append(b + (f" | {h}" if h > 1 else ""))
            structured = True
            lessons += h
    if not structured:                                         # oddiy ro'yxat: 1-ustun mavzu, 2-ustun soat
        lines = []
        for r in range(len(df)):
            a = cell(r, 0)
            if not a:
                continue
            try:
                h = int(float(cell(r, 1))) if cell(r, 1) else 1
            except ValueError:
                h = 1
            lines.append(a + (f" | {h}" if h > 1 else ""))
        lessons = len(lines)
    meta["lessons"] = lessons
    return "\n".join(lines), meta


class PlanDialog(QDialog):
    """Kalendar-tematik reja (KTR): mavzular ro'yxati bir marta kiritiladi, har dars kuniga avtomatik tushadi;
    dars yo'q (X) kunlarida keyingi mavzular siljiydi."""

    def __init__(self, win, cls=None):
        super().__init__(win)
        self.win, self.store = win, win.store
        self.setWindowTitle("Kalendar-tematik reja (KTR)")
        fit_to_screen(self, 980, 640)
        lay = QVBoxLayout(self)
        top = QHBoxLayout()
        top.addWidget(QLabel("Sinf:"))
        self.jc = QComboBox()
        cur = cls or win.current_cls()
        for i, c in enumerate(self.store.classes):
            self.jc.addItem(cls_label(c), i)                 # indeks saqlanadi (QComboBox lug'atni nusxalab qaytaradi)
            if c is cur:
                self.jc.setCurrentIndex(i)
        top.addWidget(self.jc)
        top.addWidget(QLabel("  Taqsimlash boshlanishi:"))
        self.start = QDateEdit(QDate.currentDate())
        self.start.setCalendarPopup(True)
        self.start.setDisplayFormat("dd.MM.yyyy")
        self.start.setToolTip("Shu sanadan boshlab mavzular qayta taqsimlanadi. Undan oldingi (o'tilgan) kunlar o'zgarmaydi. "
                              "Reja yangi bo'lsa — chorak boshlanish sanasini tanlang.")
        top.addWidget(self.start)
        top.addStretch(1)
        b = QPushButton("📂 Fayldan yuklash…")
        b.clicked.connect(self.load_file)
        top.addWidget(b)
        b2 = QPushButton("📚 Bir necha faylni qo'llash…")
        b2.setToolTip("Bir nechta yillik rejani (har fan/sinf uchun alohida fayl) tanlang — har biri o'z sinfiga avtomatik qo'llanadi")
        b2.clicked.connect(self.apply_many)
        top.addWidget(b2)
        lay.addLayout(top)
        split = QHBoxLayout()
        left = QVBoxLayout()
        left.addWidget(QLabel("Mavzular (har qatorda bittadan):"))
        self.txt = QPlainTextEdit()
        self.txt.setPlaceholderText("== 1-chorak\nKvadrat tenglama | 2\nViet teoremasi\n...\n== 2-chorak\n...")
        left.addWidget(self.txt, 1)
        hint = QLabel("«Mavzu | 2» — 2 soatlik mavzu. «== 2-chorak» — keyingi mavzular faqat shu chorak darslariga. "
                      "Excel / Word dan ro'yxatni to'g'ridan-to'g'ri joylash mumkin.")
        hint.setWordWrap(True)
        left.addWidget(hint)
        left.addWidget(QLabel("Rejani qo'llanadigan sinflar (parallel sinflar uchun bir xil):"))
        self.lst = QListWidget()
        self.lst.setMaximumHeight(S(110))
        self.fill_classes()
        left.addWidget(self.lst)
        split.addLayout(left, 2)
        right = QVBoxLayout()
        self.info = QLabel()
        self.info.setWordWrap(True)
        self.info.setTextFormat(Qt.TextFormat.RichText)
        right.addWidget(self.info)
        self.tbl = QTableWidget(0, 4)
        self.tbl.setHorizontalHeaderLabels(["Sana", "Kun", "Mavzu", "Holat"])
        self.tbl.verticalHeader().hide()
        self.tbl.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.tbl.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeMode.Stretch)
        right.addWidget(self.tbl, 1)
        split.addLayout(right, 3)
        lay.addLayout(split, 1)
        row = QHBoxLayout()
        self.b_clear = QPushButton("Rejani o'chirish")
        self.b_clear.clicked.connect(self.clear_plan)
        self.b_pdf = QPushButton("📄 PDF jadval…")
        self.b_pdf.clicked.connect(self.export_pdf)
        row.addWidget(self.b_clear)
        row.addWidget(self.b_pdf)
        row.addStretch(1)
        ok = QPushButton("Saqlash va qo'llash")
        ok.setDefault(True)
        ok.clicked.connect(self.apply)
        cancel = QPushButton("Yopish")
        cancel.clicked.connect(self.reject)
        row.addWidget(cancel)
        row.addWidget(ok)
        lay.addLayout(row)
        self.rows = []
        self.load_class()
        self.jc.currentIndexChanged.connect(lambda _i: (self.fill_classes(), self.load_class()))
        self.txt.textChanged.connect(self.preview)
        self.start.dateChanged.connect(self.preview)

    def cls(self):
        i = self.jc.currentData()
        return self.store.classes[i] if i is not None and 0 <= i < len(self.store.classes) else None

    def fill_classes(self):
        cur = self.cls()
        self.lst.clear()
        for i, c in enumerate(self.store.classes):
            it = QListWidgetItem(cls_label(c))
            it.setFlags(it.flags() | Qt.ItemFlag.ItemIsUserCheckable)
            it.setCheckState(Qt.CheckState.Checked if c is cur else Qt.CheckState.Unchecked)
            it.setData(Qt.ItemDataRole.UserRole, i)
            self.lst.addItem(it)

    def load_class(self):
        c = self.cls()
        plan = (c or {}).get("plan") or {}
        with blocked(self.txt):
            self.txt.setPlainText(plan_to_text(plan.get("topics", [])))
        self.preview()

    def load_file(self):
        path, _ = QFileDialog.getOpenFileName(self, "Mavzular ro'yxati", str(BASE),
                                              "Ro'yxat (*.txt *.csv *.xlsx *.xls *.ods);;Hammasi (*)")
        if not path:
            return
        try:
            text, meta = read_plan_file(path)
        except Exception as e:  # noqa: BLE001
            show_error(self, "Fayl", e, f"«{Path(path).name}» faylini o'qib bo'lmadi.")
            return
        self.txt.setPlainText(text)
        if meta.get("subject") or meta.get("grade"):          # fan va sinf nomiga mos sinflarni belgilaydi
            sub, gr = (meta.get("subject") or "").casefold(), meta.get("grade")
            by_grade = [i for i, c in enumerate(self.store.classes) if not gr or re.match(rf"^{gr}-", c["name"])]
            match = ([i for i in by_grade if not sub or self.store.classes[i].get("subject", "").casefold() == sub]
                     or [i for i in by_grade if not self.store.classes[i].get("subject")])    # fani belgilanmagan sinflar ham mos
            if match:
                with blocked(self.jc):
                    self.jc.setCurrentIndex(match[0])
                self.fill_classes()
                for i in match:
                    self.lst.item(i).setCheckState(Qt.CheckState.Checked)
                self.preview()
            self.file_note = (f"Fayl: {meta.get('subject', '')} · {meta.get('grade', '')}-sinf · "
                              f"{meta.get('lessons', 0)} dars"
                              + (f" · mos sinflar: {', '.join(cls_label(self.store.classes[i]) for i in match)}" if match
                                 else " · mos sinf topilmadi (sinfni o'zingiz tanlang)"))
            self.preview()

    def match_classes(self, meta):
        """Fayl metama'lumotiga (fan, sinf raqami) mos sinflar. Fani bor sinflar fan bo'yicha aniq mos keladi; fani belgilanmagan
        sinflar faqat bir xil sinf raqami uchun bitta fayl bo'lsa mos hisoblanadi (aks holda noaniq)."""
        sub, gr = (meta.get("subject") or "").casefold(), meta.get("grade")
        by_grade = [c for c in self.store.classes if not gr or re.match(rf"^{gr}-", c["name"])]
        return [c for c in by_grade if sub and c.get("subject", "").casefold() == sub]

    def apply_many(self):
        paths, _ = QFileDialog.getOpenFileNames(self, "Yillik rejalar (bir nechta fayl)", str(BASE),
                                                "Ro'yxat (*.xlsx *.xls *.ods);;Hammasi (*)")
        if not paths:
            return
        items, report = [], []
        for pth in paths:
            try:
                text, meta = read_plan_file(pth)
            except Exception as e:  # noqa: BLE001
                report.append(f"✖ {Path(pth).name}: {friendly_error(e)[0]}")
                continue
            topics = parse_plan_text(text)
            cl = self.match_classes(meta)
            label = f"{meta.get('subject', '?')} · {meta.get('grade', '?')}-sinf · {len(topics)} dars"
            if not topics:
                report.append(f"✖ {Path(pth).name}: mavzu topilmadi")
            elif not cl:
                report.append(f"⚠ {label}: mos sinf yo'q — «{meta.get('subject', '')}» fanli {meta.get('grade', '')}-sinf kerak "
                              "(sinfning fanini Sozlamalar → Sinf sozlamalari da belgilang)")
            else:
                items.append((cl, topics))
                report.append(f"✔ {label} → {', '.join(cls_label(c) for c in cl)}")
        if not items:
            QMessageBox.warning(self, "KTR", "\n".join(report))
            return
        if QMessageBox.question(self, "KTR — bir necha fayl", "\n".join(report) + "\n\nQo'llansinmi?") != QMessageBox.StandardButton.Yes:
            return
        s0 = self.start.date().toString("yyyy-MM-dd")
        n = 0
        for cl, topics in items:
            for c in cl:
                c["plan"] = {"on": True, "topics": copy.deepcopy(topics)}
                res = self.store.reflow_plan(c, start=s0)
                n += res["assigned"] if res else 0
        self.store.save()
        self.win.build_tabs()
        self.win.statusBar().showMessage(f"KTR qo'llandi: {sum(len(cl) for cl, _t in items)} ta sinf, {n} ta darsga mavzu tushdi", 10000)
        self.accept()

    def simulate(self, cls=None):
        """Tanlangan sinf nusxasida rejani sinab ko'radi (hech narsa o'zgarmaydi)."""
        cls = cls or self.cls()
        if cls is None:
            return None, None, []
        topics = parse_plan_text(self.txt.toPlainText())
        sim = copy.deepcopy(cls)
        sim["plan"] = {"on": True, "topics": topics}
        s0 = self.start.date().toString("yyyy-MM-dd")
        res = self.store.reflow_plan(sim, start=s0)
        return sim, res, topics

    def preview(self, *_):
        sim, res, topics = self.simulate()
        self.rows = []
        if sim is None:
            return
        s0 = self.start.date().toString("yyyy-MM-dd")
        les = sim.get("lessons", {})
        for d in sorted(sim["dates"]):
            if d < s0:
                continue
            x = self.store.is_nolesson(sim, d)
            l = les.get(d, {})
            if x:
                st, tp = "Dars yo'q (X)", ""
            elif l.get("topic") and l.get("auto"):
                st, tp = "Rejadan", l["topic"]
            elif l.get("topic"):
                st, tp = "Qo'lda yozilgan", l["topic"]
            else:
                st, tp = "Bo'sh", ""
            self.rows.append((d, x, tp, st))
        self.tbl.setRowCount(len(self.rows))
        colors = {"Rejadan": "#e3f2fd", "Qo'lda yozilgan": "#fff9c4", "Dars yo'q (X)": "#eeeeee", "Bo'sh": None}
        for r, (d, x, tp, st) in enumerate(self.rows):
            dd = dt.date.fromisoformat(d)
            for c, v in enumerate((fmt_date(d), WEEKDAYS[dd.weekday()], tp, st)):
                it = QTableWidgetItem(v)
                if colors[st]:
                    it.setBackground(QBrush(QColor(colors[st])))
                    it.setForeground(QBrush(QColor("#000000")))
                self.tbl.setItem(r, c, it)
        self.tbl.resizeColumnsToContents()
        self.tbl.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeMode.Stretch)
        n_slots = len(Store.plan_slots({"topics": topics}))
        msg = (esc(getattr(self, "file_note", "")) + "<br>") if getattr(self, "file_note", "") else ""
        msg += f"Mavzular: <b>{len(topics)}</b> ({n_slots} dars). "
        if res:
            msg += f"Joylashtirildi: <b>{res['assigned']}</b> dars kuniga."
            if res["left"]:
                msg += (f" <span style='color:#c62828'>Dars kunlari yetmaydi: {len(res['left'])} ta mavzu sig'madi "
                        f"(masalan: «{esc(res['left'][0])}»). «＋ Chorak» bilan sanalarni qo'shing.</span>")
        else:
            msg += "Mavzu kiriting."
        self.info.setText(msg)

    def apply(self):
        topics = parse_plan_text(self.txt.toPlainText())
        if not topics:
            QMessageBox.information(self, "KTR", "Mavzular ro'yxati bo'sh.")
            return
        s0 = self.start.date().toString("yyyy-MM-dd")
        targets = [self.store.classes[self.lst.item(i).data(Qt.ItemDataRole.UserRole)] for i in range(self.lst.count())
                   if self.lst.item(i).checkState() == Qt.CheckState.Checked] or [self.cls()]
        n = 0
        for c in targets:
            c["plan"] = {"on": True, "topics": copy.deepcopy(topics)}
            res = self.store.reflow_plan(c, start=s0)
            n += res["assigned"] if res else 0
        self.store.save()
        self.win.build_tabs()
        self.win.statusBar().showMessage(f"KTR qo'llandi: {len(targets)} ta sinf, {n} ta darsga mavzu tushdi", 10000)
        self.accept()

    def clear_plan(self):
        c = self.cls()
        if c is None or not c.get("plan"):
            return
        if QMessageBox.question(self, "KTR", f"{cls_label(c)}: reja va undan tushgan mavzular (bugundan keyingi) o'chiriladi. "
                                "O'tgan kunlardagi mavzular qoladi. Davom etasizmi?") != QMessageBox.StandardButton.Yes:
            return
        today = dt.date.today().isoformat()
        for d, les in list(c.get("lessons", {}).items()):
            if les.get("auto") and d >= today:
                if les.get("hw"):
                    c["lessons"][d] = {"topic": "", "hw": les["hw"]}
                else:
                    del c["lessons"][d]
            elif les.get("auto"):
                les.pop("auto", None)
                les.pop("si", None)
        c.pop("plan", None)
        self.store.save()
        self.win.build_tabs()
        self.load_class()

    def export_pdf(self):
        cls = self.cls()
        sim, res, topics = self.simulate()
        if sim is None or not topics:
            return
        folder = self.store.path.parent / "hisobotlar"
        folder.mkdir(exist_ok=True)
        path, _ = QFileDialog.getSaveFileName(self, "KTR — PDF", str(folder / f"KTR_{safe_name(cls_label(cls))}.pdf"), "PDF (*.pdf)")
        if not path:
            return
        les = sim.get("lessons", {})
        body = []
        k = 0
        s0 = self.start.date().toString("yyyy-MM-dd")
        for d in sorted(sim["dates"]):
            if d < s0 or self.store.is_nolesson(sim, d):
                continue
            k += 1
            dd = dt.date.fromisoformat(d)
            l = les.get(d, {})
            body.append(f"<tr><td align='center'>{k}</td><td align='center'>{fmt_date(d)}</td>"
                        f"<td align='center'>{WEEKDAYS[dd.weekday()]}</td><td>{esc(l.get('topic', ''))}</td>"
                        f"<td align='center'>1</td><td>&nbsp;</td></tr>")
        head = "".join(_th(t, w) for t, w in (("№", 5), ("Sana", 13), ("Kun", 6), ("Mavzu", 54), ("Soat", 6), ("Izoh", 16)))
        html = (_band(f"Kalendar-tematik reja — {cls_label(cls)}", f"Dars kunlari: {k}")
                + f'<table border="1" bordercolor="#9aa5b8" cellspacing="0" cellpadding="4" width="100%" '
                  f'style="border-collapse:collapse;"><tr>{head}</tr>{"".join(body)}</table>')
        try:
            write_pdf(path, html, landscape=False, base_pt=10, title="Kalendar-tematik reja")
        except OSError as e:
            QMessageBox.critical(self, "PDF", str(e))
            return
        self.win.statusBar().showMessage(f"KTR PDF saqlandi: {path}", 10000)
        QDesktopServices.openUrl(QUrl.fromLocalFile(path))


class LessonDialog(QDialog):
    def __init__(self, cls, iso, parent=None):
        super().__init__(parent)
        self.setWindowTitle(f"Dars mavzusi va uy vazifasi — {fmt_date(iso)}")
        self.setMinimumWidth(S(480))
        les = cls.get("lessons", {}).get(iso, {})
        lay = QVBoxLayout(self)
        form = QFormLayout()
        self.topic = QLineEdit(les.get("topic", ""))
        self.topic.setPlaceholderText("masalan: Kvadrat tenglamalar")
        form.addRow("Dars mavzusi:", self.topic)
        self.hw = QPlainTextEdit(les.get("hw", ""))
        self.hw.setPlaceholderText("masalan: §12, 5–8-mashqlar")
        self.hw.setFixedHeight(90)
        form.addRow("Uy vazifasi:", self.hw)
        lay.addLayout(form)
        lay.addWidget(QLabel(f"{cls_label(cls)} · {WEEKDAYS_FULL[dt.date.fromisoformat(iso).weekday()]}. "
                             "Ikkalasi ham bo'sh qoldirilsa, yozuv o'chiriladi."))
        bb = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel)
        bb.accepted.connect(self.accept)
        bb.rejected.connect(self.reject)
        lay.addWidget(bb)

    def values(self):
        return self.topic.text().strip(), self.hw.toPlainText().strip()


class WorkDialog(QDialog):
    def __init__(self, store, cls, q, work=None, wtype="bsb", parent=None):
        super().__init__(parent)
        self.store, self.cls, self.q, self.work = store, cls, q, work
        self.setWindowTitle("Summativ ishni o'zgartirish" if work else "Summativ ish qo'shish")
        self.setMinimumWidth(S(420))
        form = QFormLayout(self)
        self.type = QComboBox()
        self.type.addItem("BSB — bo'lim bo'yicha summativ baholash", "bsb")
        self.type.addItem("CHSB — chorak bo'yicha summativ baholash", "chsb")
        self.type.setCurrentIndex(0 if (work["type"] if work else wtype) == "bsb" else 1)
        self.type.setEnabled(work is None)
        form.addRow("Ish turi:", self.type)
        rng = store.quarter_range(q)
        self.date = QDateEdit()
        self.date.setCalendarPopup(True)
        self.date.setDisplayFormat("dd.MM.yyyy")
        if rng:
            self.date.setDateRange(QDate.fromString(rng[0], "yyyy-MM-dd"), QDate.fromString(rng[1], "yyyy-MM-dd"))
        today = dt.date.today().isoformat()
        d0 = work["date"] if work else (today if rng and rng[0] <= today <= rng[1] else (rng[0] if rng else today))
        self.date.setDate(QDate.fromString(d0, "yyyy-MM-dd"))
        form.addRow("Sana:", self.date)
        self.max = QSpinBox()
        self.max.setRange(1, 100)
        self.max.setValue(int(work["max"]) if work else self.suggest(wtype))
        form.addRow("Maksimal ball:", self.max)
        self.title = QLineEdit(work.get("title", "") if work else "")
        self.title.setPlaceholderText("masalan: 3-bob. Tenglamalar (ixtiyoriy)")
        form.addRow("Tavsifi:", self.title)
        self.hint = QLabel()
        self.hint.setWordWrap(True)
        form.addRow(self.hint)
        bb = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel)
        bb.button(QDialogButtonBox.StandardButton.Ok).setText("Saqlash" if work else "Yaratish")
        bb.accepted.connect(self.accept)
        bb.rejected.connect(self.reject)
        form.addRow(bb)
        self.type.currentIndexChanged.connect(self.on_type)
        self.update_hint()

    def sums(self):
        others = [w for w in self.store.works_in_quarter(self.cls, self.q) if w is not self.work]
        return (sum(w["max"] for w in others if w["type"] == "bsb"),
                sum(w["max"] for w in others if w["type"] == "chsb"))

    def suggest(self, wtype):
        sb, sc = self.sums()
        return max(1, (BSB_TOTAL - sb) if wtype == "bsb" else (CHSB_TOTAL - sc))

    def on_type(self, _i):
        if self.work is None:
            self.max.setValue(self.suggest(self.type.currentData()))
        self.update_hint()

    def update_hint(self):
        sb, sc = self.sums()
        self.hint.setText(f"Chorakdagi boshqa ishlar: BSB {fmt_num(sb)}/{BSB_TOTAL}, CHSB {fmt_num(sc)}/{CHSB_TOTAL} ball. "
                          "Maksimal ballar rasmiy TMR ga mos bo'lishi kerak.")

    def values(self):
        return {"type": self.type.currentData(), "date": self.date.date().toString("yyyy-MM-dd"),
                "max": self.max.value(), "title": self.title.text().strip()}

    def accept(self):
        v = self.values()
        for w in self.cls["works"]:
            if w is not self.work and w["type"] == v["type"] and w["date"] == v["date"]:
                QMessageBox.warning(self, "Summativ ish", f"{fmt_date(v['date'])} sanasida {v['type'].upper()} ishi allaqachon bor.")
                return
        if self.work:
            top = max((s for st in self.cls["students"]
                       for s in [st.get("scores", {}).get(self.work["id"])] if isinstance(s, (int, float))), default=0)
            if v["max"] < top:
                QMessageBox.warning(self, "Maksimal ball",
                                    f"Bu ishda {fmt_num(top)} ball qo'yilgan. Maksimal ballni undan pastroq qilib bo'lmaydi — "
                                    "avval katta ballarni tuzating.")
                return
        super().accept()


class QuartersDialog(QDialog):
    def __init__(self, store, parent=None):
        super().__init__(parent)
        self.store = store
        self.setWindowTitle("Choraklar: sanalar va dars kunlarini yaratish")
        self.gen = None
        lay = QVBoxLayout(self)
        lay.addWidget(QLabel("Choraklarning boshlanish va tugash sanalari (summativ ishlar shu oraliqqa qarab guruhlanadi):"))
        grid = QFormLayout()
        self.rows = []
        cur = store.quarters()
        for i in range(4):
            cb = QCheckBox(f"{i + 1}-chorak")
            s, e = QDateEdit(), QDateEdit()
            for w in (s, e):
                w.setCalendarPopup(True)
                w.setDisplayFormat("dd.MM.yyyy")
            r = cur[i]
            if r:
                s.setDate(QDate.fromString(r[0], "yyyy-MM-dd"))
                e.setDate(QDate.fromString(r[1], "yyyy-MM-dd"))
            cb.setChecked(bool(r))
            for w in (s, e):
                w.setEnabled(bool(r))
            cb.toggled.connect(lambda on, s=s, e=e: (s.setEnabled(on), e.setEnabled(on)))
            row = QHBoxLayout()
            row.addWidget(cb)
            row.addWidget(s)
            row.addWidget(QLabel("–"))
            row.addWidget(e)
            grid.addRow(row)
            self.rows.append((cb, s, e))
        lay.addLayout(grid)
        self.fb = QSpinBox()
        self.fb.setRange(1, 30)
        self.fb.setValue(store.fb_min())
        fr = QFormLayout()
        fr.addRow("Formativ ball uchun chorakda kamida nechta baho kerak:", self.fb)
        lay.addLayout(fr)
        note = QLabel("Formativ ball (10) — chorakdagi 1–10 baholar o'rtachasi; baholar soni shundan kam bo'lsa 0 ball. "
                      "emaktab jurnalingizdagi natijalarga qarab shu son tanlangan (standart 4).")
        note.setWordWrap(True)
        lay.addWidget(note)
        gl = QHBoxLayout()
        gl.addWidget(QLabel("Dars kunlarini yaratish:"))
        self.gq = QComboBox()
        for i in range(1, 5):
            self.gq.addItem(f"{i}-chorak", i)
        cur_q = store.quarter_of(dt.date.today().isoformat())
        self.gq.setCurrentIndex((cur_q or next((i for i in range(1, 5) if store.quarter_range(i)), 1)) - 1)
        gl.addWidget(self.gq)
        self.gall = QCheckBox("Barcha sinflar")
        self.gall.setChecked(True)
        gl.addWidget(self.gall)
        self.gbtn = QPushButton("Saqlab, yaratish")
        self.gbtn.setToolTip("Sanalarni saqlaydi va tanlangan chorakning barcha dars kunlarini bir yo'la yaratadi")
        self.gbtn.clicked.connect(self.generate)
        gl.addWidget(self.gbtn)
        gl.addStretch(1)
        lay.addLayout(gl)
        gnote = QLabel("Dars kunlari «Fanlarning dars kunlari» jadvalidagi sinf kunlari bo'yicha olinadi; bayramlar X bo'ladi; "
                       "mavjud sanalar qayta yaratilmaydi, baholar o'zgarmaydi.")
        gnote.setWordWrap(True)
        lay.addWidget(gnote)
        bb = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel)
        bb.accepted.connect(self.accept)
        bb.rejected.connect(self.reject)
        lay.addWidget(bb)

    def generate(self):
        q = self.gq.currentData()
        if not self.rows[q - 1][0].isChecked():
            QMessageBox.information(self, "Chorak", f"{q}-chorak sanalarini avval belgilang (katakni yoqing).")
            return
        if self.commit():
            self.gen = (q, self.gall.isChecked())
            super().accept()

    def accept(self):
        if self.commit():
            super().accept()

    def commit(self):
        out = []
        for i, (cb, s, e) in enumerate(self.rows):
            if not cb.isChecked():
                out.append(None)
                continue
            a, b = s.date().toString("yyyy-MM-dd"), e.date().toString("yyyy-MM-dd")
            if a > b:
                QMessageBox.warning(self, "Chorak", f"{i + 1}-chorak: boshlanish sanasi tugashidan keyin.")
                return False
            out.append([a, b])
        spans = sorted(x for x in out if x)
        for p, n in zip(spans, spans[1:]):
            if n[0] <= p[1]:
                QMessageBox.warning(self, "Chorak", "Choraklar sanalari bir-biriga kirishib ketgan.")
                return False
        self.store.data["settings"]["quarters"] = out
        self.store.data["settings"]["fb_min"] = self.fb.value()
        return True


class HistoryDialog(QDialog):
    KIND = {"edit": "o'zgartirildi", "clear": "o'chirildi", "x": "X qo'yildi", "del_date": "sana o'chirildi",
            "del_student": "o'quvchi olib tashlandi", "del_class": "sinf olib tashlandi",
            "import": "import: almashtirildi", "revert": "qaytarildi", "del_work": "summativ ish olib tashlandi"}
    REVERTABLE = ("edit", "clear", "import", "revert")

    def __init__(self, win):
        super().__init__(win)
        self.win = win
        self.setWindowTitle("O'zgarishlar tarixi")
        fit_to_screen(self, 880, 480, center=False)
        lay = QVBoxLayout(self)
        lay.addWidget(QLabel("Qo'yilgan baholarning o'zgartirilishi, o'chirilishi va almashtirilishi — eng yangisi tepada "
                             "(oxirgi 5000 ta yozuv saqlanadi)."))
        self.tbl = QTableWidget(0, 7)
        self.tbl.setHorizontalHeaderLabels(["Vaqt", "Sinf", "O'quvchi", "Sana", "Eski", "Yangi", "Amal"])
        self.tbl.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.tbl.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.tbl.setSelectionMode(QAbstractItemView.SelectionMode.SingleSelection)
        for k, w in enumerate((110, 130, 200, 100, 70, 70)):
            self.tbl.setColumnWidth(k, S(w))
        self.tbl.horizontalHeader().setStretchLastSection(True)
        self.tbl.itemSelectionChanged.connect(self.sync_btn)
        lay.addWidget(self.tbl, 1)
        row = QHBoxLayout()
        self.btn = QPushButton("↶ Tanlanganini qaytarish")
        self.btn.setToolTip("Katakni eski bahosiga qaytaradi (katakdagi qiymat hali o'zgarmagan bo'lsa)")
        self.btn.clicked.connect(self.revert)
        row.addWidget(self.btn)
        row.addStretch()
        close = QPushButton("Yopish")
        close.clicked.connect(self.accept)
        row.addWidget(close)
        lay.addLayout(row)
        self.fill()

    def fill(self):
        self.ents = list(reversed(self.win.store.data.get("changelog", [])))[:1000]
        self.tbl.setRowCount(len(self.ents))
        for r, e in enumerate(self.ents):
            d = e.get("date", "")
            t = e.get("t", "")
            vals = [f"{t[8:10]}.{t[5:7]} {t[11:16]}", e.get("cls", ""), e.get("student", ""),
                    (f"{d[8:]}.{d[5:7]}.{d[:4]}" if d else "") + (f" {e['wt']}" if e.get("wt") else ""),
                    self.fmt(e.get("old")), self.fmt(e.get("new")),
                    self.KIND.get(e.get("kind"), e.get("kind", ""))]
            for k, v in enumerate(vals):
                self.tbl.setItem(r, k, QTableWidgetItem(v))
        self.sync_btn()

    @staticmethod
    def fmt(v):
        if v in ("", None):
            return "—"
        return display_mark(v).replace("\n", " ") if isinstance(v, str) else fmt_num(v)

    def sync_btn(self):
        r = self.tbl.currentRow()
        self.btn.setEnabled(0 <= r < len(self.ents) and self.ents[r].get("kind") in self.REVERTABLE)

    def revert(self):
        r = self.tbl.currentRow()
        if 0 <= r < len(self.ents) and self.win.revert_change(self.ents[r]):
            self.fill()


def sync_export_xlsx(path, results):
    """emaktabga kiritilishi kerak bo'lgan baholar: har sinf uchun jadval (o'quvchi × sana) + umumiy ro'yxat."""
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill
    wb = Workbook()
    ws = wb.active
    ws.title = "Ro'yxat"
    ws.append(["Sinf", "O'quvchi", "Sana", "Jurnalimizda", "emaktabda hozir", "Holat"])
    for c in ws[1]:
        c.font = Font(bold=True)
    fill = {"ours": PatternFill("solid", fgColor="FFF59D"), "diff": PatternFill("solid", fgColor="FFCC80")}
    used = set()
    for res in results:
        rows = [r for r in res["rows"] if r["status"] in ("ours", "diff")]
        label = cls_label(res["cls"]) if res["cls"] else res["name"]
        for r in rows:
            ws.append([label, r["student"], fmt_date(r["date"]), display_mark(r["ours"]).replace("\n", " "),
                       display_mark(r["theirs"]).replace("\n", " "), Store.SYNC_LABELS[r["status"]]])
        if not rows:
            continue
        name = re.sub(r"[\\/*?:\[\]]", "_", label)[:28] or "Sinf"
        k, base = 2, name
        while name in used:
            name, k = f"{base[:25]}_{k}", k + 1
        used.add(name)
        sh = wb.create_sheet(name)
        dates = sorted({r["date"] for r in rows})
        studs = [st["name"] for st in res["cls"]["students"]]
        sh.append(["№", "O'quvchi"] + [fmt_date(d)[:5] for d in dates])
        for c in sh[1]:
            c.font = Font(bold=True)
            c.alignment = Alignment(horizontal="center")
        grid = {(r["student"], r["date"]): r for r in rows}
        for i, nm in enumerate(studs, 1):
            vals = [grid[(nm, d)]["ours"] if (nm, d) in grid else "" for d in dates]
            sh.append([i, nm] + [display_mark(v).replace("\n", " ") for v in vals])
            for j, d in enumerate(dates):
                g = grid.get((nm, d))
                if g:
                    cell = sh.cell(row=i + 1, column=3 + j)
                    cell.fill = fill[g["status"]]
                    cell.alignment = Alignment(horizontal="center")
        sh.column_dimensions["B"].width = 34
        sh.freeze_panes = "C2"
    for col, w in zip("ABCDEF", (14, 34, 12, 14, 16, 16)):
        ws.column_dimensions[col].width = w
    wb.save(path)


# ═══════════ emaktab: kirish, sinflar va Excel yuklash (Playwright; alohida oqimda) ═══════════
EMK_HOME = Path.home() / ".emaktab"
EMK_STATE = EMK_HOME / "state.json"            # brauzer sessiyasi (cookie) — captcha har safar so'ralmasligi uchun
EMK_URLS = {"teachers": "https://emaktab.uz/teachers",
            "myclasses": "https://schools.emaktab.uz/v2/myclasses",
            "login": "https://login.emaktab.uz/",
            "excel": "https://schools.emaktab.uz/v2/excel"}
_EMK_SEL_LOGIN = "input[name*='login' i], input[id*='login' i], input[type='text']"
_EMK_SEL_PASS = "input[type='password']"
_EMK_SEL_SUBMIT = "button[type='submit'], input[type='submit']"
_EMK_SEL_CAP_IMG = "img[src*='captcha' i], img[id*='captcha' i], img[class*='captcha' i]"
_EMK_SEL_CAP_IN = "input[name*='captcha' i], input[id*='captcha' i]"
_EMK_EXCEL_BTN = ("[title*='xcel' i], [aria-label*='xcel' i], [alt*='xcel' i], [class*='xcel' i], "
                  "img[src*='xcel' i], img[src*='xls' i], [data-test-id*='xcel' i]")
_EMK_CLASSES_JS = r"""
() => {
  const root = document.querySelector('#ContentPanelTeacher') || document;
  const out = []; let cur = null;
  root.querySelectorAll('a[href]').forEach(a => {
    const href = a.href;
    if (/\/v2\/class\?class=/.test(href)) { cur = {name: a.textContent.trim(), url: href, journals: []}; out.push(cur); }
    else if (cur && /\/journal\/school\/\d+\/group\/\d+\/subject\/\d+/.test(href)) {
      cur.journals.push({subject: (a.getAttribute('title') || a.textContent).trim(), url: href}); }
  });
  return out;
}"""
_EMK_STATE_JS = r"""
() => {
  const s = window.__JOURNAL__INITIAL__STATE__;
  if (!s || !s.journalHeader) return null;
  const h = s.journalHeader; const p = h.periods && h.periods[h.currentGroupId];
  return {currentPeriod: h.currentPeriodId, periods: p ? p.periods : []};
}"""


def _emk_safe(name):
    return re.sub(r"[^\w.-]+", "_", name, flags=re.U).strip("_")


class EmkSession:
    """Headless Chromium (Playwright). `ui` — log(str) va ask_captcha(png_bytes)->str|None beradigan obyekt."""

    is_http = False

    def __init__(self, ui, show=False, cookie=""):
        self.ui, self.show, self.cookie = ui, show, (cookie or "").strip()

    def pause(self, ms):
        self.page.wait_for_timeout(ms)

    def __enter__(self):
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            raise RuntimeError("Playwright o'rnatilmagan.\nBuyruq satrida bajaring:\n  pip install playwright\n  playwright install chromium")
        self.p = sync_playwright().start()
        try:
            args = ["--no-sandbox"] if hasattr(os, "geteuid") and os.geteuid() == 0 else []
            self.browser = self.p.chromium.launch(headless=not self.show, args=args)
        except Exception as e:  # noqa: BLE001
            self.p.stop()
            raise RuntimeError("Chromium ishga tushmadi. Buyruq satrida bajaring:  playwright install chromium\n\n" + str(e)[:300])
        kw = {"locale": "uz-UZ", "accept_downloads": True}
        if EMK_STATE.exists():
            kw["storage_state"] = str(EMK_STATE)
        self.ctx = self.browser.new_context(**kw)
        self.page = self.ctx.new_page()
        self.page.set_default_timeout(20000)
        self.import_cookies()
        return self

    def import_cookies(self):
        """HTTP usulida olingan cookie'lar (va qo'lda berilgani) brauzerga ham beriladi — qayta kirish kerak bo'lmaydi."""
        try:
            cks = []
            if EMK_COOKIES.exists():
                jar = _cj.MozillaCookieJar(str(EMK_COOKIES))
                jar.load(ignore_discard=True, ignore_expires=True)
                cks += [{"name": c.name, "value": c.value, "domain": c.domain, "path": c.path or "/", "secure": bool(c.secure)} for c in jar]
            if self.cookie:
                for part in self.cookie.split(";"):
                    if "=" in part:
                        k, v = part.split("=", 1)
                        for u in (EMK_URLS["teachers"], EMK_URLS["myclasses"], EMK_URLS["login"]):
                            cks.append({"name": k.strip(), "value": v.strip(), "url": u})
            if cks:
                self.ctx.add_cookies(cks)
        except Exception:  # noqa: BLE001
            pass

    def __exit__(self, *exc):
        for f in (self.ctx.close, self.browser.close, self.p.stop):
            try:
                f()
            except Exception:  # noqa: BLE001
                pass

    # — yordamchilar —
    def first_visible(self, selector):
        for el in self.page.locator(selector).all():
            try:
                if el.is_visible():
                    return el
            except Exception:  # noqa: BLE001
                continue
        return None

    def on_login_page(self):
        from urllib.parse import urlparse
        host = urlparse(self.page.url).hostname or ""
        return host.startswith("login.") or self.first_visible(_EMK_SEL_PASS) is not None

    def save_state(self):
        EMK_HOME.mkdir(parents=True, exist_ok=True)
        self.ctx.storage_state(path=str(EMK_STATE))
        try:
            EMK_STATE.chmod(0o600)
            jar = _cj.MozillaCookieJar(str(EMK_COOKIES))          # HTTP usuli ham shu sessiyadan foydalansin
            for c in self.ctx.cookies():
                dom = c.get("domain") or ""
                jar.set_cookie(_cj.Cookie(0, c["name"], c["value"], None, False, dom, True, dom.startswith("."), c.get("path") or "/",
                                          True, bool(c.get("secure")), None, True, None, None, {}))
            jar.save(ignore_discard=True, ignore_expires=True)
            EMK_COOKIES.chmod(0o600)
        except Exception:  # noqa: BLE001
            pass

    def is_logged_in(self):
        self.page.goto(EMK_URLS["myclasses"])
        self.page.wait_for_load_state("networkidle")
        return not self.on_login_page()

    # — kirish —
    def login(self, user, password):
        if self.is_logged_in():
            self.ui.log("Saqlangan sessiya bilan kirildi.")
            return
        pg = self.page
        if not self.on_login_page():
            pg.goto(EMK_URLS["login"])
            pg.wait_for_load_state("networkidle")
        for attempt in range(1, 5):
            u, p = self.first_visible(_EMK_SEL_LOGIN), self.first_visible(_EMK_SEL_PASS)
            if u and p:
                u.fill(user)
                p.fill(password)
            img, inp = self.first_visible(_EMK_SEL_CAP_IMG), self.first_visible(_EMK_SEL_CAP_IN)
            if img and inp:
                ans = self.ui.ask_captcha(img.screenshot())
                if ans is None:
                    raise RuntimeError("Captcha kiritish bekor qilindi.")
                inp.fill(ans)
                self.ui.log(f"[{attempt}] Captcha kiritildi.")
            pg.wait_for_timeout(600)
            btn = self.first_visible(_EMK_SEL_SUBMIT)
            if btn:
                btn.click()
            elif p:
                p.press("Enter")
            pg.wait_for_load_state("networkidle")
            if not self.on_login_page():
                self.save_state()
                self.ui.log("Muvaffaqiyatli kirildi.")
                return
            self.ui.log(f"[{attempt}] Kirib bo'lmadi (parol yoki captcha noto'g'ri bo'lishi mumkin).")
        raise RuntimeError("Kirib bo'lmadi. Login/parol yoki captchani tekshiring.")

    # — sinflar —
    def catalog(self):
        pg = self.page
        pg.goto(EMK_URLS["teachers"])
        pg.wait_for_load_state("networkidle")
        link = pg.locator("a[href*='/v2/myclasses']").first
        href = link.get_attribute("href") if link.count() else None
        from urllib.parse import urljoin
        pg.goto(urljoin(pg.url, href) if href else EMK_URLS["myclasses"])
        pg.wait_for_load_state("networkidle")
        if self.on_login_page():
            raise RuntimeError("Sessiya tugagan — «Kirish» tugmasini bosing.")
        classes = pg.evaluate(_EMK_CLASSES_JS)
        if not classes:
            raise RuntimeError("«Mening sinflarim» sahifasida sinflar topilmadi.")
        self.save_state()
        return classes

    # — jurnal va Excel —
    def open_journal(self, url, quarter=None):
        from urllib.parse import parse_qs, urlencode, urlparse
        pg = self.page
        pg.goto(url)
        pg.wait_for_load_state("networkidle")
        st = pg.evaluate(_EMK_STATE_JS) or {}
        periods, target = st.get("periods", []), st.get("currentPeriod")
        if quarter:
            q = str(quarter)
            match = next((p for p in periods if str(p["number"] + 1) == q or p["name"].startswith(q)), None)
            if not match:
                raise ValueError(f"{quarter}-chorak topilmadi: {[p['name'] for p in periods]}")
            if match["id"] != target:
                target = match["id"]
                parts = urlparse(url)
                qs = parse_qs(parts.query)
                qs["periodId"] = [target]
                pg.goto(parts._replace(query=urlencode(qs, doseq=True)).geturl())
                pg.wait_for_load_state("networkidle")
        target = target or parse_qs(urlparse(url).query).get("periodId", [None])[0]
        label = next((p["name"] for p in periods if p["id"] == target), "joriy")
        return label, target

    def download(self, cname, journal, quarter, folder):
        from urllib.parse import urlencode
        label, period = self.open_journal(journal["url"], quarter)
        base = _emk_safe(f"{cname}_{journal['subject']}_{label}")
        folder.mkdir(parents=True, exist_ok=True)
        m = re.search(r"/school/(\d+)/group/(\d+)/subject/(\d+)", journal["url"])
        if m and period:                                           # 1) to'g'ridan-to'g'ri havola (cookie bilan)
            try:
                school, group, subject = m.groups()
                resp = self.page.context.request.get(EMK_URLS["excel"] + "?" + urlencode(
                    {"action": "gjsxls", "school": school, "group": group, "subgroup": 0, "subject": subject, "period": period}),
                    timeout=120000)
                body, ctype = resp.body(), resp.headers.get("content-type", "").lower()
                if resp.status == 200 and body and "html" not in ctype:
                    cd = resp.headers.get("content-disposition", "")
                    mm = re.search(r"filename\*?=(?:UTF-8'')?\"?([^\";]+)", cd, re.I)
                    path = folder / (base + ((Path(mm.group(1)).suffix if mm else "") or ".xls"))
                    path.write_bytes(body)
                    return path
                self.ui.log(f"  to'g'ridan-to'g'ri yuklanmadi (status {resp.status}); tugmalar orqali urinaman…")
            except Exception as e:  # noqa: BLE001
                self.ui.log(f"  to'g'ridan-to'g'ri yuklanmadi ({str(e)[:80]}); tugmalar orqali urinaman…")
        # 2) zaxira: Excel ikonkasi → «Jurnalni eksport qilish» → «Eksport qilish»
        pg = self.page
        try:
            pg.wait_for_selector(_EMK_EXCEL_BTN, state="visible", timeout=20000)
        except Exception:  # noqa: BLE001
            pass
        btn = None
        for el in pg.locator(_EMK_EXCEL_BTN).all():
            try:
                if el.is_visible():
                    btn = el
                    break
            except Exception:  # noqa: BLE001
                continue
        if btn is None:
            raise RuntimeError("Excel ikonkasi topilmadi")
        btn.click()
        pg.get_by_text(re.compile(r"faylni tanlang", re.I)).first.wait_for(timeout=10000)
        pg.get_by_text(re.compile(r"^\s*Jurnalni eksport", re.I)).first.click()
        pg.wait_for_timeout(400)
        confirm = pg.get_by_role("button", name=re.compile(r"^\s*Eksport qilish\s*$", re.I)).first
        with pg.expect_download(timeout=120000) as dl:
            confirm.click()
        path = folder / (base + (Path(dl.value.suggested_filename).suffix or ".xls"))
        dl.value.save_as(str(path))
        return path


class EmkFallback(Exception):
    """HTTP usuli bajara olmadi — brauzer (Playwright) usuliga o'tish mumkin."""


import http.cookiejar as _cj
import urllib.error as _ue
import urllib.parse as _up
import urllib.request as _ur
from html.parser import HTMLParser as _HP

_EMK_UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36")
EMK_COOKIES = EMK_HOME / "cookies.txt"


class _EmkForms(_HP):
    """HTML dan formalar (input maydonlari, rasmlari) va sinf/jurnal havolalarini yig'adi."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.forms, self._f, self.imgs, self.img_attrs = [], None, [], {}
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
        elif tag in ("input", "button") and self._f is not None:
            self._f["inputs"].append({"name": a.get("name"), "type": (a.get("type") or "text").lower(), "value": a.get("value") or ""})
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


class EmkHttp:
    """Brauzersiz (faqat standart kutubxona) seans: login/captcha, sinflar, Excel. Interfeysi EmkSession bilan bir xil."""
    is_http = True

    def __init__(self, ui, cookie=""):
        self.ui, self.cookie = ui, (cookie or "").strip()

    def __enter__(self):
        self.jar = _cj.MozillaCookieJar(str(EMK_COOKIES))
        try:
            if EMK_COOKIES.exists():
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
            EMK_HOME.mkdir(parents=True, exist_ok=True)
            self.jar.save(ignore_discard=True, ignore_expires=True)
            EMK_COOKIES.chmod(0o600)
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
        host = _up.urlparse(final).netloc.lower()
        return host.startswith("login.") or bool(re.search(r"<input[^>]+type=[\"']?password", html, re.I))

    def is_logged_in(self):
        st, final, html = self.req(EMK_URLS["myclasses"])
        return st == 200 and not self.is_login(final, html)

    def login(self, user, password):
        if self.is_logged_in():
            self.ui.log("Saqlangan sessiya bilan kirildi.")
            return
        st, final, html = self.req(EMK_URLS["login"])
        for attempt in range(1, 5):
            fp = _EmkForms()
            fp.feed(html)
            form = next((f for f in fp.forms if any(i["type"] == "password" for i in f["inputs"])), None)
            if not form:
                raise EmkFallback("Login formasi topilmadi")
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
            imgs = form.get("imgs") or fp.imgs
            # captcha manzili <img> da bo'lmasa (JS/JSON ichida): …/captcha/true/<guid> ko'rinishidagi havolalarni qidiramiz
            extra = [m.group(0) for m in re.finditer(r"[^\s\"'<>()=]*captcha/[^\s\"'<>()]*", html.replace("\\/", "/"), re.I)]
            if not extra:
                for i in form["inputs"]:
                    if i["type"] == "hidden" and re.search(r"captcha", i["name"] or "", re.I) and \
                            re.fullmatch(r"[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}", i["value"] or ""):
                        extra.append("/captcha/true/" + i["value"])
            imgs = list(dict.fromkeys(extra + list(imgs)))
            cap = next((n for n in texts if n != us and re.search(r"captcha|code|kod|answer|sum|number|digit", n, re.I)), None) \
                or next((n for n in texts if n != us), None)
            if cap and imgs:
                def _score(u):                                    # captcha rasmini boshqa rasmlardan (logotip va h.k.) ajratish
                    at = fp.img_attrs.get(u, {})
                    blob = " ".join([u[:200], at.get("id") or "", at.get("class") or "", at.get("alt") or "", at.get("title") or ""]).lower()
                    sc = 10 if ("captcha" in blob or "капч" in blob) else 0
                    if re.search(r"kod|code|secur|verify|digit|num|son", blob):
                        sc += 3
                    if sc < 10 and re.search(r"logo|icon|favicon|banner|sprite|avatar|flag|\.svg|brand|header|footer", blob):
                        sc -= 10
                    return sc
                png = None
                for src in sorted(imgs, key=_score, reverse=True)[:4]:
                    try:
                        cst, _, hd, body = self.raw(_up.urljoin(final, src), headers={"Accept": "image/*,*/*;q=0.8", "Referer": final})
                    except RuntimeError as e:
                        raise EmkFallback(str(e))
                    if cst == 200 and len(body) > 60 and (hd.get_content_type() or "").startswith("image/"):
                        png = body
                        self.ui.log(f"Captcha rasmi: {src[:150]}")
                        break
                if png is None:
                    raise EmkFallback("Captcha rasmini yuklab bo'lmadi")
                try:
                    EMK_HOME.mkdir(parents=True, exist_ok=True)
                    (EMK_HOME / "debug_login.html").write_text(html, encoding="utf-8")   # nosozlikni topish uchun
                except Exception:  # noqa: BLE001
                    pass
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


class _CaptchaDialog(QDialog):
    def __init__(self, parent, png):
        super().__init__(parent)
        self.setWindowTitle("Captcha")
        lay = QVBoxLayout(self)
        from PySide6.QtGui import QPixmap
        pm = QPixmap()
        pm.loadFromData(png)
        if pm.width() < 250 and pm.width() > 0:
            pm = pm.scaledToWidth(pm.width() * 2)
        lb = QLabel()
        lb.setPixmap(pm)
        lb.setAlignment(Qt.AlignmentFlag.AlignCenter)
        lay.addWidget(lb)
        lay.addWidget(QLabel("Rasmdagi belgilarni kiriting:"))
        self.e = QLineEdit()
        f = self.e.font()
        f.setPointSize(f.pointSize() + 4)
        self.e.setFont(f)
        self.e.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.e.returnPressed.connect(self.accept)
        lay.addWidget(self.e)
        bb = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel)
        bb.accepted.connect(self.accept)
        bb.rejected.connect(self.reject)
        lay.addWidget(bb)
        self.e.setFocus()


class _EmkJob(QThread):
    """fn(session) ni Playwright seansida alohida oqimda bajaradi; captcha asosiy oynada so'raladi."""
    sig_log = Signal(str)
    sig_captcha = Signal(bytes)
    sig_done = Signal(object)
    sig_fail = Signal(str)

    def __init__(self, parent, fn, show=False, engine="auto", cookie=""):
        super().__init__(parent)
        import queue
        self.fn, self.show, self._q = fn, show, queue.Queue()
        self.engine, self.cookie = engine, cookie

    def log(self, s):
        self.sig_log.emit(str(s))

    def ask_captcha(self, png):
        self.sig_captcha.emit(bytes(png))
        return self._q.get()                       # asosiy oqim javob berguncha kutadi (None — bekor)

    def answer(self, text):
        self._q.put(text)

    @staticmethod
    def pw_available():
        try:
            import playwright.sync_api  # noqa: F401
            return True
        except ImportError:
            return False

    def run(self):
        try:
            res, why = None, None
            # kirish (captcha) uchun brauzer usuli ishonchliroq (rasmni ekrandan aniq oladi): Playwright bo'lsa — o'sha birinchi
            pw_first = self.engine == "auto" and getattr(self.fn, "prefer_pw", False) and self.pw_available()
            if self.engine in ("auto", "http") and not pw_first:
                try:
                    with EmkHttp(self, self.cookie) as s:
                        res = self.fn(s)
                    self.sig_done.emit(res)
                    return
                except EmkFallback as e:
                    why = str(e)
                if self.engine == "http" or not self.pw_available():
                    tip = ("\n\nBrauzer usuli uchun:  pip install playwright && playwright install chromium"
                           if self.engine == "auto" else "")
                    raise RuntimeError(f"emaktabga ulanib bo'lmadi: {why}.{tip}")
                self.log(f"HTTP usuli o'tmadi ({why}); brauzer (Playwright) usuliga o'tilmoqda…")
            with EmkSession(self, self.show, self.cookie) as s:
                res = self.fn(s)
            self.sig_done.emit(res)
        except Exception as e:  # noqa: BLE001
            self.sig_fail.emit(str(e))


class EmaktabDialog(QDialog):
    """emaktabga login (captcha bilan) kiradi, «Mening sinflarim» ro'yxatini oladi, tanlangan sinflar jurnalini
    Excelga yuklab oladi va solishtirish/import oynasiga beradi. Sessiya ~/.emaktab/state.json da saqlanadi."""

    def __init__(self, win, store):
        super().__init__(win)
        self.win, self.store, self.job = win, store, None
        self.setWindowTitle("emaktabga kirish va Excel import")
        fit_to_screen(self, 860, 640)
        a = store.data["settings"]["auto"]
        lay = QVBoxLayout(self)
        top = FlowLayout()
        top.addWidget(QLabel("Login:"))
        self.e_login = QLineEdit(a.get("emaktab_login", ""))
        self.e_login.setMinimumWidth(S(170))
        top.addWidget(self.e_login)
        top.addWidget(QLabel("Parol:"))
        self.e_pass = QLineEdit(a.get("emaktab_pass", ""))
        self.e_pass.setEchoMode(QLineEdit.EchoMode.Password)
        self.e_pass.setMinimumWidth(S(150))
        top.addWidget(self.e_pass)
        self.c_save = QCheckBox("Parolni eslab qolish")
        self.c_save.setChecked(bool(a.get("emaktab_pass")))
        self.c_save.setToolTip("Parol sozlamalar faylida ochiq matn ko'rinishida saqlanadi — faqat shaxsiy kompyuterda belgilang")
        top.addWidget(self.c_save)
        self.b_login = QPushButton("🔑 Kirish")
        self.b_login.setToolTip("Login/parol bilan kiradi; captcha chiqsa rasm oynada ko'rsatiladi. Sessiya saqlanadi.")
        self.b_login.clicked.connect(self.do_login)
        top.addWidget(self.b_login)
        self.b_cat = QPushButton("📚 Sinflarni yangilash")
        self.b_cat.setToolTip("emaktabning «Mening sinflarim» bo'limidan sinflar va fan jurnallarini oladi")
        self.b_cat.clicked.connect(self.do_catalog)
        top.addWidget(self.b_cat)
        # ulanish usuli bitta — avtomatik (kirish brauzerda bo'lsa aniqroq, qolgani HTTP); tanlov va Cookie maydoni ko'rsatilmaydi
        self.cb_eng = QComboBox()
        self.cb_eng.addItem("Avto (HTTP → brauzer)", "auto")
        self.cb_eng.addItem("Faqat HTTP (brauzersiz)", "http")
        self.cb_eng.addItem("Faqat brauzer (Playwright)", "pw")
        self.cb_eng.setToolTip("HTTP — yengil, Chromium kerak emas; o'tmasa «Avto» brauzerga o'tadi (Playwright o'rnatilgan bo'lsa)")
        self.e_cookie = QLineEdit()
        self.e_cookie.setPlaceholderText("ixtiyoriy: brauzerdan nusxalangan Cookie (captcha o'tmasa)")
        self.e_cookie.setMinimumWidth(S(200))
        self.c_show = QCheckBox("Brauzer oynasini ko'rsatish")
        self.c_show.setToolTip("Nosozlikni topish uchun: Chromium oynasi ochiladi")
        lay.addWidget(FlowBox(top))
        self.lst = QListWidget()
        self.lst.setAlternatingRowColors(True)
        lay.addWidget(self.lst, 1)
        row = QHBoxLayout()
        b = QPushButton("Hammasini belgilash / olib tashlash")
        b.clicked.connect(self.toggle_all)
        row.addWidget(b)
        row.addStretch(1)
        row.addWidget(QLabel("Chorak:"))
        self.cb_q = QComboBox()
        self.cb_q.addItem("Joriy chorak", "")
        for q in range(1, 5):
            self.cb_q.addItem(f"{q}-chorak", str(q))
        row.addWidget(self.cb_q)
        self.b_go = QPushButton("⬇ Yuklab olish va import")
        self.b_go.setToolTip("Belgilangan jurnallar Excelini yuklab oladi va jurnalingiz bilan solishtirish oynasini ochadi")
        self.b_go.clicked.connect(self.do_download)
        row.addWidget(self.b_go)
        lay.addLayout(row)
        self.log_w = QPlainTextEdit()
        self.log_w.setReadOnly(True)
        self.log_w.setMaximumBlockCount(500)
        self.log_w.setFixedHeight(S(130))
        lay.addWidget(self.log_w)
        self.say("«🔑 Kirish» → «📚 Sinflarni yangilash» → sinflarni belgilang → «⬇ Yuklab olish va import».")
        sel = set(a.get("emaktab_sel") or [])
        for c in (a.get("emaktab_cat") or []):
            self.add_items(c, sel)

    # — yordamchilar —
    def say(self, s):
        self.log_w.appendPlainText(str(s))

    def add_items(self, c, sel):
        for j in c.get("journals", []):
            it = QListWidgetItem(f"{c['name']} — {j['subject']}")
            it.setData(Qt.ItemDataRole.UserRole, {"class": c["name"], "subject": j["subject"], "url": j["url"]})
            it.setFlags(it.flags() | Qt.ItemFlag.ItemIsUserCheckable)
            it.setCheckState(Qt.CheckState.Checked if j["url"] in sel else Qt.CheckState.Unchecked)
            self.lst.addItem(it)

    def toggle_all(self):
        n = self.lst.count()
        on = any(self.lst.item(i).checkState() == Qt.CheckState.Unchecked for i in range(n))
        for i in range(n):
            self.lst.item(i).setCheckState(Qt.CheckState.Checked if on else Qt.CheckState.Unchecked)

    def checked(self):
        return [self.lst.item(i).data(Qt.ItemDataRole.UserRole) for i in range(self.lst.count())
                if self.lst.item(i).checkState() == Qt.CheckState.Checked]

    def save_cred(self):
        a = self.store.data["settings"]["auto"]
        a["emaktab_login"] = self.e_login.text().strip()
        a["emaktab_pass"] = self.e_pass.text() if self.c_save.isChecked() else ""
        a["emaktab_sel"] = [x["url"] for x in self.checked()]
        self.store.save()

    def busy(self, on):
        for w in (self.b_login, self.b_cat, self.b_go):
            w.setEnabled(not on)

    def start(self, fn, on_done, engine=None):
        if self.job is not None:
            return
        self.save_cred()
        self.busy(True)
        job = _EmkJob(self, fn, self.c_show.isChecked(), engine or self.cb_eng.currentData(), self.e_cookie.text())
        self.job = job
        job.sig_log.connect(self.say)
        job.sig_captcha.connect(self.on_captcha)

        def done(res):
            self.job = None
            self.busy(False)
            on_done(res)

        def fail(msg):
            self.job = None
            self.busy(False)
            self.say("❌ " + msg)
            QMessageBox.warning(self, "emaktab", msg)
        job.sig_done.connect(done)
        job.sig_fail.connect(fail)
        job.finished.connect(job.deleteLater)
        job.start()

    def on_captcha(self, png):
        dlg = _CaptchaDialog(self, png)
        ok = dlg.exec() == QDialog.DialogCode.Accepted
        self.job.answer(dlg.e.text().strip() if ok else None)

    # — amallar —
    def do_login(self):
        user, pw = self.e_login.text().strip(), self.e_pass.text()
        if not user or not pw:
            QMessageBox.information(self, "emaktab", "Login va parolni kiriting.")
            return
        self.say("Kirilmoqda…")

        def fn(s):
            s.login(user, pw)
            return True
        fn.prefer_pw = True                           # Playwright o'rnatilgan bo'lsa, kirish (captcha) brauzerda — keyingi ishlar HTTP bilan
        self.start(fn, lambda _r: self.say("✅ Kirildi. Endi «📚 Sinflarni yangilash»."))

    def do_catalog(self):
        self.say("Sinflar olinmoqda…")

        def fn(s):
            if not s.is_logged_in():
                raise RuntimeError("Kirilmagan — avval «🔑 Kirish» tugmasini bosing.")
            return s.catalog()

        def done(classes):
            a = self.store.data["settings"]["auto"]
            a["emaktab_cat"] = classes
            sel = set(a.get("emaktab_sel") or [])
            self.lst.clear()
            for c in classes:
                self.add_items(c, sel)
            self.store.save()
            self.say(f"✅ {len(classes)} ta sinf, {self.lst.count()} ta jurnal. Kerakligini belgilang.")
        self.start(fn, done)

    def do_download(self):
        items = self.checked()
        if not items:
            QMessageBox.information(self, "emaktab", "Jurnallarni belgilang (avval «📚 Sinflarni yangilash»).")
            return
        quarter = self.cb_q.currentData() or None
        folder = self.store.path.parent / "emaktab_yuklangan"
        self.say(f"{len(items)} ta jurnal yuklanmoqda…")

        def fn(s):
            if not s.is_logged_in():
                raise RuntimeError("Sessiya tugagan — «🔑 Kirish» tugmasini bosing.")
            files, errs, retry = [], [], []
            for i, it in enumerate(items, 1):
                try:
                    p = s.download(it["class"], {"subject": it["subject"], "url": it["url"]}, quarter, folder)
                    files.append(str(p))
                    s.ui.log(f"[{i}/{len(items)}] ✔ {it['class']} — {it['subject']} → {Path(p).name}")
                except EmkFallback as e:
                    retry.append(it)
                    s.ui.log(f"[{i}/{len(items)}] ⟳ {it['class']} / {it['subject']}: HTTP o'tmadi ({str(e)[:80]})")
                except Exception as e:  # noqa: BLE001
                    errs.append(f"{it['class']} / {it['subject']}: {str(e)[:120]}")
                    s.ui.log(f"[{i}/{len(items)}] ✖ {it['class']} / {it['subject']}: {str(e)[:120]}")
                s.pause(900)
            s.save_state()
            return files, errs, retry

        def finish(files, errs):
            if not files:
                QMessageBox.warning(self, "emaktab", "Hech bir fayl yuklanmadi.\n\n" + "\n".join(errs))
                return
            self.do_import(files, errs)

        def done(res):
            files, errs, retry = res
            eng = self.cb_eng.currentData()
            if retry and eng == "auto" and _EmkJob.pw_available():
                self.say(f"{len(retry)} ta jurnal brauzer usulida qayta uriniladi…")
                items[:] = retry                                   # fn shu ro'yxatni o'qiydi

                def done2(res2):
                    f2, e2, r2 = res2
                    finish(files + f2, errs + e2 + [f"{x['class']} / {x['subject']}: yuklanmadi" for x in r2])
                self.start(fn, done2, engine="pw")
                return
            finish(files, errs + [f"{x['class']} / {x['subject']}: HTTP usuli o'tmadi" for x in retry])
        self.start(fn, done)

    def do_import(self, files, errs):
        def work():
            out, bad = [], list(errs)
            for f in files:
                try:
                    out.extend(read_import_file(str(f)))
                except Exception as e:  # noqa: BLE001
                    bad.append(f"{Path(f).name}: {e}")
            return out, bad

        def done(res):
            imports, bad = res
            if bad:
                QMessageBox.warning(self, "Ba'zi jurnallar olinmadi", "\n".join(bad))
            if not imports:
                QMessageBox.warning(self, "Import", "Fayllarda sinf jurnali topilmadi.")
                return
            SyncDialog(self.win, self.store, imports, f"emaktab ({len(files)} ta fayl)").exec()
        run_bg(self, "emaktab fayllari", work, done, "Fayllar o'qilmoqda…",
               on_fail=lambda e: show_error(self, "Import", e))

    def closeEvent(self, e):
        if self.job is not None:
            QMessageBox.information(self, "emaktab", "Amal tugayotgan paytda oynani yopib bo'lmaydi.")
            e.ignore()
            return
        self.save_cred()
        super().closeEvent(e)

    def reject(self):
        if self.job is not None:
            return
        super().reject()


class SyncDialog(QDialog):
    """emaktab fayli bilan solishtirish: farqlarni ko'rsatadi; tanlanganlarni jurnalga oladi; emaktabga kiritiladiganlarni Excelga chiqaradi."""

    def __init__(self, win, store, imports, filename):
        super().__init__(win)
        self.win, self.store = win, store
        self.results = [store.sync_diff(i) for i in imports]
        self.setWindowTitle("emaktab bilan ishlash: import va sinxronlash")
        fit_to_screen(self, 900, 600)
        lay = QVBoxLayout(self)
        self.head = QLabel()
        self.head.setWordWrap(True)
        self.head.setTextFormat(Qt.TextFormat.RichText)
        lay.addWidget(self.head)
        self.imports = imports
        self.build_struct(lay)
        fr = QHBoxLayout()
        fr.addWidget(QLabel("Ko'rsatish:"))
        self.f_status = QComboBox()
        self.f_status.addItem("Hammasi", "")
        for k, v in Store.SYNC_LABELS.items():
            self.f_status.addItem(v, k)
        fr.addWidget(self.f_status)
        self.f_cls = QComboBox()
        self.f_cls.addItem("Barcha sinflar", -1)
        for i, r in enumerate(self.results):
            self.f_cls.addItem(cls_label(r["cls"]) if r["cls"] else r["name"] + " (bizda yo'q)", i)
        fr.addWidget(self.f_cls)
        fr.addStretch(1)
        lay.addLayout(fr)
        self.tbl = QTableWidget(0, 7)
        self.tbl.setHorizontalHeaderLabels(["", "Sinf", "O'quvchi", "Sana", "Jurnalimizda", "emaktabda", "Holat"])
        self.tbl.verticalHeader().hide()
        self.tbl.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self.tbl.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        hh = self.tbl.horizontalHeader()
        hh.setSectionResizeMode(2, QHeaderView.ResizeMode.Stretch)
        lay.addWidget(self.tbl, 1)
        self.note = QLabel("«Faqat emaktabda» va «Farq qiladi» qatorlarini belgilab, jurnalga olish mumkin (mavjud baho faqat "
                           "belgilangan katakda almashadi). «Faqat bizda» baholarni emaktabga qo'lda kiritish uchun Excelga chiqaring.")
        self.note.setWordWrap(True)
        lay.addWidget(self.note)
        br = QHBoxLayout()
        self.b_theirs = QPushButton("Belgilanganlarni qo'llash")
        self.b_theirs.clicked.connect(self.apply_checked)
        self.b_xlsx = QPushButton("emaktabga kiritish ro'yxati (Excel)…")
        self.b_xlsx.clicked.connect(self.export_xlsx)
        self.b_all = QPushButton("Hammasini belgilash / olib tashlash")
        self.b_all.clicked.connect(self.toggle_all)
        br.addWidget(self.b_all)
        br.addStretch(1)
        br.addWidget(self.b_xlsx)
        br.addWidget(self.b_theirs)
        close = QPushButton("Yopish")
        close.clicked.connect(self.accept)
        br.addWidget(close)
        lay.addLayout(br)
        self.f_status.currentIndexChanged.connect(self.fill)
        self.f_cls.currentIndexChanged.connect(self.fill)
        self.items = []
        self.fill()
        self.check_struct()

    # — yangi ma'lumotlar (import): yangi sinf, o'quvchi, sana, summativ ishlar —
    def build_struct(self, lay):
        self.struct = []                                        # [(imp, checkbox, subject combo, label)]
        for imp in self.imports:
            r = self.store.merge_import(imp, False, dry=True, only_new=True)
            if not (r["created"] or r["new_students"] or r["new_dates"] or r["new_works"] or r["quarter_new"]
                    or r["s_filled"] or r["adopted"]):
                continue
            cb = QCheckBox()
            cb.setChecked(True)
            sc = subject_combo(self.store, imp.get("subject", ""))
            sc.setMinimumWidth(S(180))
            sc.lineEdit().setPlaceholderText("Fan nomi (majburiy)")
            lbl = QLabel()
            lbl.setTextFormat(Qt.TextFormat.RichText)
            lbl.setWordWrap(True)
            row = QHBoxLayout()
            row.addWidget(cb)
            row.addWidget(lbl, 1)
            row.addWidget(sc)
            lay.addLayout(row)
            sc.currentTextChanged.connect(lambda _t, i=imp, w=sc: self.on_subject(i, w))
            cb.toggled.connect(self.fill_new)
            cb.toggled.connect(self.check_struct)
            self.struct.append((imp, cb, sc, lbl))
        if self.struct:
            hint = QLabel("Yangi ma'lumotlar jurnalga qo'shiladi (mavjud baholarga tegmaydi):")
            hint.setStyleSheet("font-weight:bold;")
            lay.insertWidget(lay.indexOf(self.head) + 1, hint)
            self.newtbl = QTableWidget(0, 5)                    # qo'shiladigan o'quvchilar ro'yxati (oldindan ko'rish)
            self.newtbl.setHorizontalHeaderLabels(["Sinf", "O'quvchi", "Baholar", "Ballar", "Holat"])
            self.newtbl.verticalHeader().hide()
            self.newtbl.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
            self.newtbl.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
            self.newtbl.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
            self.newtbl.setMinimumHeight(S(150))
            lay.addWidget(self.newtbl, 1)
        self.update_struct()

    def on_subject(self, imp, w):
        imp["subject"] = clean_subject(w.currentText())
        self.update_struct()

    def update_struct(self):
        for imp, cb, sc, lbl in self.struct:
            r = self.store.merge_import(imp, False, dry=True, only_new=True)
            bits = [f"<b>{esc(imp['name'])}</b>: " + ("YANGI SINF" if r["created"] else "mavjud sinfga")]
            if r["new_students"]:
                bits.append(f"{len(r['new_students'])} yangi o'quvchi")
            if r["new_dates"]:
                bits.append(f"{len(r['new_dates'])} yangi sana")
            if r["new_works"]:
                bits.append(f"{len(r['new_works'])} summativ ish")
            if r["s_filled"]:
                bits.append(f"{r['s_filled']} ball")
            if r["quarter_new"]:
                bits.append("chorak sanalari")
            if r["adopted"]:
                bits.append(f"fan belgilanadi: {esc(r['subject'])}")
            lbl.setText(", ".join(bits[:1] + [", ".join(bits[1:])] if len(bits) > 1 else bits))
            sc.setVisible(r["created"] or bool(r["adopted"]))
            sc.setStyleSheet("QComboBox{border:1px solid #c62828}" if (cb.isChecked() and r["created"] and not imp.get("subject")) else "")
        self.fill_new()
        self.check_struct()

    def fill_new(self):
        """Qo'shiladigan o'quvchilar: yangi sinfning hammasi yoki mavjud sinfga qo'shiladigan yangilari."""
        tbl = getattr(self, "newtbl", None)
        if tbl is None:
            return
        rows = []
        for imp, cb, _sc, _l in self.struct:
            if not cb.isChecked():
                continue
            r = self.store.merge_import(imp, False, dry=True, only_new=True)
            newset = {norm_name(n) for n in r["new_students"]}
            for st in imp["students"]:
                if norm_name(st["name"]) in newset:
                    rows.append((imp["name"], st["name"], len(st["marks"]), len(st.get("scores", {})),
                                 "Yangi sinf" if r["created"] else "Yangi o'quvchi"))
        tbl.setRowCount(len(rows))
        for i, vals in enumerate(rows):
            for c, v in enumerate(vals):
                it = QTableWidgetItem(str(v) if v != 0 or c not in (2, 3) else "")
                if c in (2, 3):
                    it.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                tbl.setItem(i, c, it)
        tbl.resizeColumnsToContents()
        tbl.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        tbl.setVisible(bool(rows))

    def check_struct(self, *_):
        bad = any(cb.isChecked() and not imp.get("subject")
                  and self.store.find_class(imp["name"], "")[0] is None for imp, cb, _sc, _l in self.struct)
        b = getattr(self, "b_theirs", None)
        if b is not None:
            b.setEnabled(not bad)
            b.setToolTip("Yangi sinf uchun fan nomini kiriting" if bad else "")

    def chosen_struct(self):
        return [imp for imp, cb, _sc, _l in self.struct if cb.isChecked()]

    def summary(self):
        parts = []
        for r in self.results:
            label = cls_label(r["cls"]) if r["cls"] else f"{r['name']} (bizda yo'q — pastdagi «yangi sinf» bandi bilan yaratiladi)"
            c = {k: sum(1 for x in r["rows"] if x["status"] == k) for k in Store.SYNC_LABELS}
            parts.append(f"<b>{esc(label)}</b>: bir xil {r['same']}, faqat emaktabda {c['theirs']}, "
                         f"faqat bizda {c['ours']}, farq {c['diff']}"
                         + (f"; yangi o'quvchilar: {len(r['new_students'])}" if r["new_students"] else ""))
        return "<br>".join(parts)

    def fill(self):
        self.head.setText(self.summary())
        st, ci = self.f_status.currentData(), self.f_cls.currentData()
        self.tbl.setRowCount(0)
        self.items = []
        for i, res in enumerate(self.results):
            if ci not in (-1, None) and ci != i:
                continue
            for row in res["rows"]:
                if st and row["status"] != st:
                    continue
                self.items.append((i, row))
        self.tbl.setRowCount(len(self.items))
        colors = {"theirs": "#e3f2fd", "ours": "#fff9c4", "diff": "#ffe0b2"}
        for r, (i, row) in enumerate(self.items):
            res = self.results[i]
            chk = QTableWidgetItem()
            can = row["status"] != "ours"
            chk.setFlags(Qt.ItemFlag.ItemIsEnabled | (Qt.ItemFlag.ItemIsUserCheckable if can else Qt.ItemFlag.NoItemFlags))
            chk.setCheckState(Qt.CheckState.Checked if row["status"] == "theirs" else Qt.CheckState.Unchecked)
            self.tbl.setItem(r, 0, chk)
            vals = [cls_label(res["cls"]), row["student"], fmt_date(row["date"]),
                    display_mark(row["ours"]).replace("\n", " "), display_mark(row["theirs"]).replace("\n", " "),
                    Store.SYNC_LABELS[row["status"]]]
            for c, v in enumerate(vals, 1):
                it = QTableWidgetItem(v)
                it.setBackground(QBrush(QColor(colors[row["status"]])))
                it.setForeground(QBrush(QColor("#000000")))
                self.tbl.setItem(r, c, it)
        self.tbl.resizeColumnsToContents()
        self.tbl.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeMode.Stretch)

    def toggle_all(self):
        rows = [r for r in range(self.tbl.rowCount()) if self.tbl.item(r, 0).flags() & Qt.ItemFlag.ItemIsUserCheckable]
        on = any(self.tbl.item(r, 0).checkState() != Qt.CheckState.Checked for r in rows)
        for r in rows:
            self.tbl.item(r, 0).setCheckState(Qt.CheckState.Checked if on else Qt.CheckState.Unchecked)

    def checked(self):
        out = {}
        for r, (i, row) in enumerate(self.items):
            if self.tbl.item(r, 0).checkState() == Qt.CheckState.Checked and row["status"] != "ours":
                out.setdefault(i, []).append(row)
        return out

    def apply_checked(self):
        sel, structs = self.checked(), self.chosen_struct()
        if not sel and not structs:
            QMessageBox.information(self, "emaktab", "Hech narsa belgilanmagan.")
            return
        n_over = sum(1 for rows in sel.values() for r in rows if r["status"] == "diff")
        if n_over and not self.win.guard.require(self, f"{n_over} ta mavjud baho emaktabdagi qiymatga almashadi."):
            return
        self.store.backup("amal")
        total = sum(self.store.sync_apply(self.results[i], rows) for i, rows in sel.items())
        reps = [self.store.merge_import(imp, False, only_new=True) for imp in structs]
        for r in reps:
            for stud, d, old, new in r["changes"]:
                self.store.log_change(r["name"], stud, d, old, new, "import")
        self.store.save()
        self.win.build_tabs()
        if reps:
            self.win.select_class(reps[0]["cls"])
        txt = f"emaktab: {total} ta katak almashtirildi/to'ldirildi"
        if reps:
            txt += "; " + "; ".join(f"{cls_label(r['cls'])}: +{len(r['new_students'])} o'quvchi, +{len(r['new_dates'])} sana, "
                                    f"+{len(r['new_works'])} ish" for r in reps)
        self.win.statusBar().showMessage(txt, 15000)
        self.accept()

    def export_xlsx(self):
        if not any(r["status"] in ("ours", "diff") for res in self.results for r in res["rows"]):
            QMessageBox.information(self, "Sinxronlash", "emaktabga kiritiladigan baho yo'q: hammasi mos.")
            return
        path, _ = QFileDialog.getSaveFileName(self, "emaktabga kiritish ro'yxati",
                                              str(BASE / "emaktabga_kiritish.xlsx"), "Excel (*.xlsx)")
        if not path:
            return
        try:
            sync_export_xlsx(path, [r for r in self.results if r["cls"]])
        except Exception as e:  # noqa: BLE001
            show_error(self, "Excel", e, "emaktabga kiritish ro'yxatini saqlab bo'lmadi.")
            return
        self.win.statusBar().showMessage(f"Saqlandi: {path}", 10000)


BLANK_ROW_PAD = {"Ixcham": 3, "Oddiy": 6, "Keng": 10}


BLANK_MAX_COLS = 31


def blank_chunks(entries, mode):
    """Bir varaqqa sig'maydigan uzun davrni (oraliq) bir necha varaqqa bo'ladi: har varaqda ko'pi bilan 31 kun."""
    out = []
    step = BLANK_MAX_COLS if mode != "day" else 1
    for cls, dates in entries:
        for i in range(0, max(1, len(dates)), step):
            out.append((cls, dates[i:i + step]))
    return out


def blank_sheet_html(store, entries, mode, title, pad=6, font_pt=10):
    """Bo'sh yo'qlama varag'i (qo'lda to'ldirish uchun): faqat o'quvchilar va dars kunlari — hech qanday belgi chiqmaydi.
    entries: [(sinf, [sanalar])]. Kun rejimida har kun uchun ikkita ustun: «Davomat» va «Ball»."""
    wd = ("Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya")
    line = "#555555"
    out = []
    for n, (cls, dates) in enumerate(blank_chunks(entries, mode)):
        two = mode == "day"
        cols = []
        for d in dates:
            dd = dt.date.fromisoformat(d)
            cols.append((f"{dd.day:02d}" if mode == "month" else f"{dd.day:02d}.{dd.month:02d}", wd[dd.weekday()]))
        ncol = len(dates) * (2 if two else 1)
        name_w = 30 if ncol <= 8 else 24 if ncol <= 14 else 20
        cell_w = (100 - 4 - name_w) / max(1, ncol)
        h = [f'<table width="100%" cellspacing="0" cellpadding="4" border="0"><tr>'
             f'<td><b><span style="font-size:{font_pt + 4}pt;">{esc(cls_label(cls))}</span></b></td>'
             f'<td align="right">{esc(title)}</td></tr></table>',
             f'<table width="100%" cellspacing="0" cellpadding="{pad}" border="1" bordercolor="{line}" '
             f'style="border-collapse:collapse;">']
        rs = ' rowspan="2"' if two else ""
        head = [f'<th width="4%" bgcolor="#eeeeee"{rs}>№</th>', f'<th width="{name_w}%" bgcolor="#eeeeee"{rs}>O\'quvchi</th>']
        for dm, w in cols:
            if two:
                head.append(f'<th colspan="2" bgcolor="#eeeeee">{dm} {w}</th>')
            else:
                head.append(f'<th width="{cell_w:.2f}%" bgcolor="#eeeeee">{dm}<br><small>{w}</small></th>')
        h.append("<tr>" + "".join(head) + "</tr>")
        if two:
            sub = [f'<th width="{cell_w:.2f}%" bgcolor="#f6f6f6"><small>{x}</small></th>'
                                            for _ in cols for x in ("Davomat", "Ball")]
            h.append("<tr>" + "".join(sub) + "</tr>")
        for i, st in enumerate(sort_pdf_items(cls["students"], lambda x: x["name"]), 1):
            h.append(f'<tr><td align="center">{i}</td><td>{esc(st["name"])}</td>' + "<td>&nbsp;</td>" * ncol + "</tr>")
        h.append("</table>")
        out.append(('<p style="page-break-before:always;"></p>' if n else "") + "".join(h))
    return f'<div style="font-size:{font_pt}pt;">' + "".join(out) + "</div>"


class RangeSpan:
    """Ixtiyoriy sana oralig'i (ViewState bilan bir xil interfeys: range / bounds / title)."""

    def __init__(self, lo, hi):
        self.lo, self.hi = lo, hi

    def range(self):
        return self.lo, self.hi

    def bounds(self):
        return self.lo.isoformat(), self.hi.isoformat()

    def title(self):
        return f"{self.lo:%d.%m.%Y} – {self.hi:%d.%m.%Y}"


class BlankSheetDialog(QDialog):
    """Qo'lda yo'qlama qilish uchun chop etiladigan bo'sh varaq (kun / hafta / oy)."""

    def __init__(self, win):
        super().__init__(win)
        self.win, self.store = win, win.store
        self.setWindowTitle("Bo'sh yo'qlama varag'i (chop etish uchun)")
        fit_to_screen(self, 460, 560)
        lay = QVBoxLayout(self)
        info = QLabel("Faqat o'quvchilar ismlari va dars kunlari chiqadi; jurnaldagi hech qanday belgi yoki baho ko'rsatilmaydi. "
                      "Dars yo'q (X) kunlar kiritilmaydi.")
        info.setWordWrap(True)
        lay.addWidget(info)
        form = QFormLayout()
        self.mode = QComboBox()
        for k, v in (("day", "Kun"), ("week", "Hafta"), ("month", "Oy"), ("range", "Sana oralig'i…")):
            self.mode.addItem(v, k)
        cur = win.view.mode
        self.mode.setCurrentIndex(max(0, self.mode.findData(cur if cur in ("day", "week", "month") else "month")))
        form.addRow("Davr:", self.mode)
        a = win.view.anchor
        self.date = QDateEdit(QDate(a.year, a.month, a.day))
        self.date.setCalendarPopup(True)
        self.date.setDisplayFormat("dd.MM.yyyy")
        form.addRow("Sana:", self.date)
        self.d2 = QDateEdit(QDate(a.year, a.month, a.day))
        self.d2.setCalendarPopup(True)
        self.d2.setDisplayFormat("dd.MM.yyyy")
        self.l_to = QLabel("Gacha:")
        form.addRow(self.l_to, self.d2)
        self.pad = QComboBox()
        for k in BLANK_ROW_PAD:
            self.pad.addItem(k, k)
        self.pad.setCurrentIndex(1)
        form.addRow("Qator balandligi:", self.pad)
        self.font = pdf_font_combo(self.store)
        form.addRow("Shrift:", self.font)
        form.addRow("", pdf_alpha_check(self.store))
        form.addRow("Tartib:", pdf_sort_combo(self.store, "journal"))
        lay.addLayout(form)
        lay.addWidget(QLabel("Sinflar:"))
        self.list = QListWidget()
        curcls = win.current_cls() if hasattr(win, "current_cls") else None
        for c in self.store.classes:
            it = QListWidgetItem(cls_label(c))
            it.setFlags(it.flags() | Qt.ItemFlag.ItemIsUserCheckable)
            it.setCheckState(Qt.CheckState.Checked if c is curcls else Qt.CheckState.Unchecked)
            it.setData(Qt.ItemDataRole.UserRole, c["name"] + "\0" + c.get("subject", ""))
            self.list.addItem(it)
        lay.addWidget(self.list, 1)
        row = QHBoxLayout()
        b = QPushButton("Hammasi")
        b.clicked.connect(lambda: self.set_all(Qt.CheckState.Checked))
        b2 = QPushButton("Hech biri")
        b2.clicked.connect(lambda: self.set_all(Qt.CheckState.Unchecked))
        row.addWidget(b)
        row.addWidget(b2)
        row.addStretch(1)
        lay.addLayout(row)
        self.info = QLabel()
        self.info.setWordWrap(True)
        lay.addWidget(self.info)
        bb = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel)
        self.ok = bb.button(QDialogButtonBox.StandardButton.Ok)
        self.ok.setText("PDF saqlash…")
        bb.accepted.connect(self.export)
        bb.rejected.connect(self.reject)
        lay.addWidget(bb)
        for sig in (self.mode.currentIndexChanged, self.date.dateChanged, self.d2.dateChanged, self.list.itemChanged):
            sig.connect(self.update_info)
        self.update_info()

    def set_all(self, state):
        for i in range(self.list.count()):
            self.list.item(i).setCheckState(state)

    def period(self):
        d = self.date.date()
        if self.mode.currentData() == "range":
            e = self.d2.date()
            a, b = dt.date(d.year(), d.month(), d.day()), dt.date(e.year(), e.month(), e.day())
            return RangeSpan(min(a, b), max(a, b))
        vs = ViewState(self.mode.currentData(), dt.date(d.year(), d.month(), d.day()))
        vs.store = self.store
        return vs

    def entries(self):
        vs = self.period()
        lo, hi = vs.bounds()
        keys = {self.list.item(i).data(Qt.ItemDataRole.UserRole) for i in range(self.list.count())
                if self.list.item(i).checkState() == Qt.CheckState.Checked}
        out = []
        for c in self.store.classes:
            if c["name"] + "\0" + c.get("subject", "") not in keys:
                continue
            ds = [d for d in sorted(c["dates"]) if lo <= d <= hi and not self.store.is_nolesson(c, d)]
            out.append((c, ds))
        return vs, out

    def update_info(self, *_):
        rng = self.mode.currentData() == "range"
        self.d2.setVisible(rng)
        self.l_to.setVisible(rng)
        vs, ents = self.entries()
        empty = [cls_label(c) for c, ds in ents if not ds]
        n = sum(1 for _c, ds in ents if ds)
        self.info.setText(f"{vs.title()} — varaqlar: {n} ta sinf"
                          + (f". Dars kunlari yo'q: {', '.join(empty)}" if empty else ""))
        self.ok.setEnabled(n > 0)

    def export(self):
        vs, ents = self.entries()
        ents = [(c, ds) for c, ds in ents if ds]
        if not ents:
            return
        mode = self.mode.currentData()
        base = (f"yoqlama_varaq_{vs.range()[0]:%Y-%m-%d}_{vs.range()[1]:%Y-%m-%d}.pdf" if mode == "range"
                else f"yoqlama_varaq_{vs.range()[0]:%Y-%m-%d}_{mode}.pdf")
        path, _ = QFileDialog.getSaveFileName(self, "Bo'sh yo'qlama varag'i", str(BASE / base), "PDF (*.pdf)")
        if not path:
            return
        most = max(min(len(ds), BLANK_MAX_COLS) * (2 if mode == "day" else 1) for _c, ds in ents)
        n_pages = len(blank_chunks(ents, mode))
        pad = BLANK_ROW_PAD[self.pad.currentData()]
        landscape = most > 7
        try:
            tries = [(10, pad)] + [(10, x) for x in (5, 4, 3, 2, 1) if x < pad] + [(9, 1), (8, 1), (7, 1)]
            for fs, pd in tries:                       # har bir sinf bitta varaqqa sig'guncha qator oralig'i/shrift kichrayadi
                html = blank_sheet_html(self.store, ents, mode, vs.title(), pad=pd, font_pt=fs)
                write_pdf(path, html, landscape=landscape, base_pt=fs, title="Yo'qlama varag'i")
                if pdf_page_count(path) <= n_pages:
                    break
        except Exception as e:  # noqa: BLE001
            show_error(self, "Yo'qlama varag'i", e, "PDF faylni saqlab bo'lmadi.")
            return
        self.win.statusBar().showMessage(f"Saqlandi: {path}", 10000)
        QDesktopServices.openUrl(QUrl.fromLocalFile(path))
        self.accept()


# ───────────────────────────── asosiy oyna ─────────────────────────────
HELP_SECTIONS = [
    ("Tezkor tugmalar", [
        "<b>Ctrl+D</b> — ⚡ tezkor davomat (bugungi dars): S / D / K / Q / C belgilar, 1–9 va 0 (=10) baho, Space tozalash, "
        "↑↓ o'quvchi, Enter — «qolganlari keldi», Ctrl+T — dars mavzusi.",
        "<b>Ctrl+F</b> — o'quvchini qidirish (Enter — jurnalga, Ctrl+Enter — kartochka) · <b>Ctrl+Z</b> — oxirgi o'zgarishni bekor qilish.",
        "<b>Ctrl+H</b> — sinf hisoboti · <b>Ctrl+K</b> — KTR · <b>Ctrl+O</b> — emaktab bilan ishlash · <b>Ctrl+P</b> — bo'sh yo'qlama varag'i.",
        "<b>Alt+1 / 2 / 3</b> — Jurnal / Summativ / Yillik sahifa · <b>Ctrl+=</b>, <b>Ctrl+-</b>, <b>Ctrl+0</b> — interfeys o'lchami.",
        "<b>Ctrl+C / Ctrl+V</b> — kataklarni nusxalash va qo'yish (Excel bilan ham) · <b>Delete</b> — tanlangan kataklarni tozalash.",
        "O'quvchi ustida o'ng tugma: 📇 kartochka, ⭐ kuzatuv, 📄 o'quvchi varag'i. «Hisobot» menyusi: ⭐ kuzatuvdagilar, "
        "📊 sinflarni solishtirish, chorak tayyorligi.",
    ]),
    ("Belgilar", [
        "Katakni tanlab 1…10 raqamini yoki S / DQ / K / KQ / CH yozing, Enter — pastdagi o'quvchiga o'tadi.",
        "<b>S</b> — sababsiz qatnashmadi · <b>DQ</b> — sababli · <b>K</b> — kasal · <b>KQ</b> — kech qoldi · "
        "<b>CH</b> — chet elda (davomat hisobiga kirmaydi) · <b>X</b> — dars yo'q kuni (butun ustun).",
        "«Qoldirgan jami» = S + DQ + K; kechikish alohida sanaladi.",
        "Kechikkan o'quvchiga baho ham qo'yiladi: «kq9» deb yozing yoki bahodan keyin KQ tugmasini bosing "
        "(qayta bosilsa olib tashlanadi). KQ va bahoni bitta qilib ham yozish mumkin: «kq9», «kq10».",
        "<b>Kun</b> rejimida davomat («Davomat» ustuni: S, DQ, K, KQ, CH) va ball («Ball» ustuni) alohida ustunlarda; "
        "boshqa rejimlarda ikkalasi bitta katakda yoziladi.",
        "Bir katakka 2 ta baho: «8/9» yoki «＋2» tugmasi orqali. Ikkala baho ham o'rtachaga alohida kiradi.",
        "Delete — tanlangan kataklarni tozalash. Bir nechta katakni tanlab, tepadagi tezkor tugmalar bilan to'ldirish mumkin.",
    ]),
    ("Kalendar va dars kunlari", [
        "«＋ Chorak» (Sozlamalar → Taqvim → Choraklar) — tanlangan chorak oralig'idagi barcha dars kunlarini "
        "bir yo'la yaratadi.",
        "Joriy oy sanalari dastur ochilganda avtomatik yaratiladi. Metod kuni Sozlamalar menyusidan tanlanadi va shu hafta kuni X bo'ladi. "
        "Shu kuni dars o'tilsa: sana sarlavhasiga o'ng tugma → «X ni olib tashlash» (yoki «✓ Dars o'tiladi»).",
        "Har bir jurnalning o'z dars kunlari bor: yorliqqa o'ng tugma → tahrirlash (masalan Algebra — Du, Ch, Sh; "
        "Geometriya — Se, Ju). Belgilansa, ortiqcha bo'sh sanalar olib tashlanadi.",
        "Bayram kunlari: Sozlamalar menyusida; oy yaratilganda o'zi X bo'ladi.",
        "Ko'rinish: Kun / Hafta / Oy / Chorak (Ctrl+1/2/3/4); ◀ ▶ (Alt+←/→) yoki sana tanlagich bilan o'ting. "
        "Sariq ustun — bugun, kulrang — o'tgan sanalar.",
        "Dars mavzusi va uy vazifasi: sana sarlavhasiga ikki marta bosing (yozuvli sanada nuqta • turadi).",
    ]),
    ("Sinflar, fanlar, o'quvchilar", [
        "Sinflar: Sozlamalar → Sinf sozlamalari → «＋ Sinf» (Ctrl+N) / «− Sinf» yoki yorliqqa o'ng tugma. O'quvchilar: «O'quvchi ▾» tugmasi yoki ismga o'ng tugma. "
        "Olib tashlashdan oldin zaxira nusxa saqlanadi.",
        "Fan: tepadagi «Fan» ro'yxati faqat tanlangan fan sinflarini ko'rsatadi. Algebra va Geometriya kabi ikki fan "
        "alohida jurnal bo'ladi: sinfni fani bilan qo'shing yoki import qilganda fan nomini kiriting. Har sinf (fan) dars kunlari: Sozlamalar → Taqvim → Fanlarning dars kunlari.",
        "Fayl → emaktab bilan ishlash (Ctrl+O): emaktab «Fan jurnali» (.xls/.xlsx/.ods) o'qiladi. Yuqorida — yangi sinf, o'quvchi, sana va summativ ishlar (qo'shiladi, mavjud baholarga tegmaydi); "
        "pastda — baholar farqi: faqat emaktabda / faqat bizda / farq qiladi. Belgilanganlargina jurnalga o'tadi; «faqat bizda» baholar emaktabga qo'lda kiritish uchun Excelga chiqariladi.",
    ]),
    ("Himoya va tarix", [
        "Qo'yilgan baho/yo'qlama odatda qulflangan («🔒 Himoyalangan»). Bo'sh katakka yangi baho qo'yish erkin; mavjudini "
        "o'zgartirish yoki o'chirish uchun qulfni oching (parol o'rnatilgan bo'lsa — parol bilan). Qulf harakatsizlikdan keyin o'zi yopiladi.",
        "Har bir o'zgarish Ma'lumot → O'zgarishlar tarixida saqlanadi va u yerdan qaytariladi.",
        "Bekor qilish (Ctrl+Z): jurnal sahifasidagi oxirgi o'zgarishlar (shu seans) birma-bir qaytariladi.",
        "Nusxalash: Ctrl+C / Ctrl+V (Excel dan ham); butun davr jadvali — Hisobot → «Ko'rinayotgan jadvalni nusxalash» (Ctrl+Shift+C).",
    ]),
    ("Summativ, yillik, BSB tahlili", [
        "Summativ (📝): BSB / CHSB ishlari — sana va maksimal ball bilan (BSB yig'indisi 50, CHSB 40). Chorak balli = BSB + CHSB + "
        "formativ (1–10 baholar o'rtachasi, maks. 10) = 100; hamma ishlar o'tkazilgach tavsiya etilgan baho chiqadi. "
        "Chorak sanalari Sozlamalar → Taqvim → «Choraklar…» da (hamma sinflar uchun umumiy).",
        "Yillik / yakuniy (🎓): yillik = (SB yig'indisi / 4) + yil bo'yicha o'rtacha formativ; yakuniy = 0.7 × yillik + 0.3 × imtihon. "
        "Baholarni (2–5) o'qituvchi qo'yadi, tavsiya tugma bilan ko'chiriladi.",
        "BSB tahlili (Hisobot menyusi yoki Summativ sahifadagi tugma): ✔ — ishtirok, savollar bo'yicha ballar, «🔍 Tahlil qilish» — "
        "jadval, diagramma, yutuq/kamchiliklar va tavsiyalar; PDF (3 dizayn) va Excel ga export; "
        "«↳ Jami ballni Summativga o'tkazish» — ballarni BSB ishiga yozadi.",
    ]),
    ("Hisobotlar, zaxira, sozlamalar", [
        "Tahrirlash → Kalendar-tematik reja (KTR) (Ctrl+K): mavzular ro'yxatini (qo'lda, joylab yoki Excel/matn fayldan) bir marta kiriting — "
        "har dars kuniga mavzu o'zi tushadi. Dars yo'q (X) kuni yoki sana o'chirilsa, keyingi mavzular siljiydi; o'tgan kunlar va qo'lda yozilgan mavzular o'zgarmaydi. "
        "«Mavzu | 2» — 2 soatlik mavzu, «== 2-chorak» — chorak bo'yicha. Parallel sinflarga bir xil reja qo'llash mumkin.",
        "Sozlamalar → Sinf sozlamalari → Fanlarning dars kunlari: har sinf (fan) uchun hafta kunlarini bir jadvalda belgilang — jurnalda faqat shu kunlar qoladi, ortiqcha bo'sh sanalar olib tashlanadi (baho bor sanalar saqlanadi). "
        "Sozlamalar → Avtomatlashtirish: chorak boshlanganda dars kunlari o'zi yaratiladi; belgilangan soatda davomat olinmagan sinflar haqida eslatma; "
        "tepada banner (xavf ostidagilar, bugungi darslar, yaqin BSB/CHSB, chorak tugashi); haftalik PDF hisobot (hisobotlar/ papkasi); "
        "KTRdagi «BSB-1 (25 ball)» / «CHSB-1» qatorlaridan summativ ishlar o'zi yaratiladi va mavzu siljisa sanasi ham siljiydi; "
        "papkaga yangi emaktab fayli tushsa solishtirish taklif qilinadi. Baho va davomat hech qachon o'zi qo'yilmaydi.",
        "Hisobot → «Bo'sh yo'qlama varag'i» (Ctrl+P): kun / hafta / oy / ixtiyoriy sana oralig'i bo'yicha o'quvchilar va dars kunlari (31 kundan oshsa bir necha varaqqa bo'linadi), belgilarsiz — chop etib qo'lda yo'qlama qilish uchun.",
        "Hisobot (Ctrl+H): o'rtacha ball, davomat foizi, chorak balli, «xavf ostidagi» o'quvchilar; Excel, PDF va ota-onalar uchun o'quvchi varaqlari.",
        "Zaxira: dastur ochilganda/yopilganda va sinf, o'quvchi, ish, sana olib tashlashdan oldin zaxira/ papkasiga nusxa saqlanadi. "
        "«Ma'lumot» menyusidan hozir nusxa olish yoki tiklash mumkin (har turdan oxirgi 40 tasi qoladi).",
        "Tema: Sozlamalar → Tema (Sut / Tun / Tosh). Ranglar: Sozlamalar → diapazonlar.",
    ]),
]


class HelpDialog(QDialog):
    """Yordam: aylantiriladigan matn, ekranga moslashadi; chapda bo'limlar ro'yxati."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Belgilar va tugmalar")
        fit_to_screen(self, 860, 640)
        self.setMinimumSize(340, 240)
        lay = QVBoxLayout(self)
        body = []
        for i, (title, items) in enumerate(HELP_SECTIONS):
            body.append(f'<h3><a name="s{i}">{esc(title)}</a></h3><ul>' + "".join(f"<li>{t}</li>" for t in items) + "</ul>")
        row = QHBoxLayout()
        self.nav = QListWidget()
        self.nav.setMaximumWidth(200)
        for title, _ in HELP_SECTIONS:
            self.nav.addItem(title)
        row.addWidget(self.nav)
        self.view = QTextBrowser()
        self.view.setOpenExternalLinks(False)
        self.view.setHtml("".join(body))
        row.addWidget(self.view, 1)
        lay.addLayout(row, 1)
        self.nav.currentRowChanged.connect(lambda i: i >= 0 and self.view.scrollToAnchor(f"s{i}"))
        bb = QDialogButtonBox(QDialogButtonBox.StandardButton.Close)
        bb.rejected.connect(self.reject)
        bb.button(QDialogButtonBox.StandardButton.Close).setText("Yopish")
        lay.addWidget(bb)


class WeekdaysDialog(QDialog):
    """Hamma sinflar uchun fan dars kunlarini bir jadvalda belgilash; ortiqcha (dars bo'lmaydigan) kunlar jurnaldan olib tashlanadi."""

    def __init__(self, win):
        super().__init__(win)
        self.win, self.store = win, win.store
        self.setWindowTitle("Fanlarning dars kunlari")
        fit_to_screen(self, 760, 520, center=False)
        lay = QVBoxLayout(self)
        info = QLabel("Har bir sinf (fan) uchun haftaning qaysi kunlari dars bo'lishini belgilang. Saqlanganda jurnalda faqat shu kunlar "
                      "qoladi: boshqa kunlardagi bo'sh sanalar olib tashlanadi. Baho yoki summativ ish bor sanalar o'chirilmaydi — "
                      "ular o'ng ustunda «qoladi» deb ko'rsatiladi. Yangi oy va chorak ham shu kunlar bo'yicha yaratiladi.")
        info.setWordWrap(True)
        lay.addWidget(info)
        self.tbl = QTableWidget(len(self.store.classes), 9)
        self.tbl.setHorizontalHeaderLabels(["Sinf · fan"] + WEEKDAYS + ["Ortiqcha sana"])
        self.tbl.verticalHeader().setVisible(False)
        self.tbl.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self.tbl.horizontalHeader().setSectionResizeMode(8, QHeaderView.ResizeMode.ResizeToContents)
        self._rows = list(range(len(self.store.classes)))
        for r, c in enumerate(self.store.classes):
            it = QTableWidgetItem(cls_label(c))
            it.setFlags(Qt.ItemFlag.ItemIsEnabled)
            self.tbl.setItem(r, 0, it)
            wd = self.store.guess_weekdays(c)
            for i in range(7):
                ch = QTableWidgetItem()
                ch.setFlags(Qt.ItemFlag.ItemIsEnabled | Qt.ItemFlag.ItemIsUserCheckable)
                ch.setCheckState(Qt.CheckState.Checked if i in wd else Qt.CheckState.Unchecked)
                ch.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                self.tbl.setItem(r, 1 + i, ch)
            info_it = QTableWidgetItem()
            info_it.setFlags(Qt.ItemFlag.ItemIsEnabled)
            self.tbl.setItem(r, 8, info_it)
            self.tbl.setColumnWidth(1 + r % 7, 42) if r == 0 else None
        for i in range(1, 8):
            self.tbl.setColumnWidth(i, 46)
        self.tbl.itemChanged.connect(self.update_row)
        for r in range(self.tbl.rowCount()):
            self.update_row(self.tbl.item(r, 1))
        lay.addWidget(self.tbl, 1)
        bb = QDialogButtonBox(QDialogButtonBox.StandardButton.Save | QDialogButtonBox.StandardButton.Cancel)
        bb.accepted.connect(self.accept)
        bb.rejected.connect(self.reject)
        lay.addWidget(bb)

    def days(self, r):
        return [i for i in range(7) if self.tbl.item(r, 1 + i).checkState() == Qt.CheckState.Checked]

    def update_row(self, item):
        if item is None or item.column() == 0 or item.column() == 8:
            return
        r = item.row()
        wd = self.days(r)
        it = self.tbl.item(r, 8)
        if not wd:
            it.setText("kun tanlang")
            return
        gone, kept = self.store.extra_dates(self.store.classes[r], wd)
        it.setText(f"{len(gone)} ta olinadi" + (f", {len(kept)} ta qoladi (baho bor)" if kept else ""))

    def accept(self):
        if any(not self.days(r) for r in range(self.tbl.rowCount())):
            QMessageBox.warning(self, "Dars kunlari", "Har bir sinf uchun kamida bitta dars kunini belgilang.")
            return
        removed = 0
        self.store.backup("amal")
        for r, c in enumerate(self.store.classes):
            c["weekdays"] = self.days(r)
            removed += self.store.prune_dates(c)
        self.store.data["settings"]["lesson_weekdays"] = sorted({d for c in self.store.classes for d in c["weekdays"]})   # yangi sinf uchun umumiy
        self.store.save()
        self.win.build_tabs()
        self.win.statusBar().showMessage(f"Dars kunlari saqlandi; {removed} ta ortiqcha sana olib tashlandi", 12000)
        super().accept()


class ThemeEditor(QDialog):
    """O'z dizaynini yasash: 5 ta rang tanlanadi, qolganlari avtomatik hisoblanadi; o'zgarish darhol ko'rinadi."""
    PRESETS = (("Grafit", {"window": "#e9ebef", "base": "#f8f9fb", "text": "#20242c", "highlight": "#5b6cff", "today": "#ffd35c"}),
               ("Yashil", {"window": "#e8f0ea", "base": "#f9fcf9", "text": "#1d2b22", "highlight": "#2e7d5b", "today": "#f4d35e"}),
               ("Binafsha tun", {"window": "#1b1626", "base": "#241d33", "text": "#ece6f7", "highlight": "#9b7cf0", "today": "#d9a441"}))

    def __init__(self, win):
        super().__init__(win)
        self.win = win
        self.setWindowTitle("O'z dizaynimni yasash")
        st = win.store.data["settings"]
        self.old_theme = st.get("theme")
        self.old_custom = dict(st.get("custom_theme") or {})
        self.cur = dict(DEFAULT_SETTINGS["custom_theme"])
        self.cur.update(self.old_custom)
        lay = QVBoxLayout(self)
        form = QFormLayout()
        self.btns = {}
        for key, title in CUSTOM_FIELDS:
            b = QPushButton()
            b.setMinimumWidth(S(120))
            b.clicked.connect(lambda _=False, k=key: self.pick(k))
            self.btns[key] = b
            form.addRow(title, b)
        lay.addLayout(form)
        pr = QHBoxLayout()
        pr.addWidget(QLabel("Tayyor namunalar:"))
        for name, vals in self.PRESETS:
            b = QPushButton(name)
            b.clicked.connect(lambda _=False, v=vals: self.preset(v))
            pr.addWidget(b)
        pr.addStretch(1)
        lay.addLayout(pr)
        bb = QDialogButtonBox(QDialogButtonBox.StandardButton.Save | QDialogButtonBox.StandardButton.Cancel)
        bb.accepted.connect(self.accept)
        bb.rejected.connect(self.reject)
        lay.addWidget(bb)
        self.paint_btns()
        self.preview()

    def paint_btns(self):
        for k, b in self.btns.items():
            c = self.cur[k]
            b.setText(c)
            b.setStyleSheet(f"background:{c};color:{contrast(c)};border:1px solid #888;padding:4px;")

    def pick(self, key):
        c = QColorDialog.getColor(QColor(self.cur[key]), self)
        if c.isValid():
            self.cur[key] = c.name()
            self.paint_btns()
            self.preview()

    def preset(self, vals):
        self.cur.update(vals)
        self.paint_btns()
        self.preview()

    def preview(self):
        st = self.win.store.data["settings"]
        st["custom_theme"] = dict(self.cur)
        self.win.apply_theme("custom", save=False)

    def reject(self):
        st = self.win.store.data["settings"]
        st["custom_theme"] = self.old_custom or dict(DEFAULT_SETTINGS["custom_theme"])
        self.win.apply_theme(self.old_theme if (self.old_theme in THEMES or self.old_theme == "custom") else "sut", save=False)
        self.win.sync_theme_menu()
        super().reject()

    def accept(self):
        self.win.store.data["settings"]["custom_theme"] = dict(self.cur)
        self.win.apply_theme("custom")
        super().accept()


class AutoDialog(QDialog):
    """Avtonom funksiyalar sozlamasi: dastur o'zi bajaradigan ishlar. Baho va davomatga hech qachon tegmaydi."""

    DAYS = ("Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba")

    def __init__(self, win):
        super().__init__(win)
        self.win, self.store = win, win.store
        a = self.store.auto_cfg()
        self.setWindowTitle("Avtomatlashtirish")
        lay = QVBoxLayout(self)
        lay.addWidget(QLabel("Dastur ochiq turganda o'zi bajaradigan ishlar. Baho va davomat qo'yish yoki o'zgartirish "
                             "hech qachon avtomatik emas."))
        self.c_q = QCheckBox("Chorak boshlanganda dars kunlarini o'zi yaratish (bayramlar X bo'ladi)")
        self.c_q.setChecked(bool(a.get("quarters")))
        lay.addWidget(self.c_q)
        row = QHBoxLayout()
        self.c_rem = QCheckBox("Davomat eslatmasi, soat:")
        self.c_rem.setChecked(bool(a.get("remind")))
        self.t_rem = QTimeEdit(QTime.fromString(a.get("remind") or "15:00", "HH:mm"))
        self.t_rem.setDisplayFormat("HH:mm")
        row.addWidget(self.c_rem)
        row.addWidget(self.t_rem)
        row.addStretch()
        lay.addLayout(row)
        self.c_tray = QCheckBox("Eslatmalar tizim tray'ida chiqsin (oyna ochmasdan)")
        self.c_tray.setChecked(bool(a.get("tray", True)))
        lay.addWidget(self.c_tray)
        self.c_trayu = QCheckBox("Ertalab bir marta: yaqin BSB / CHSB va chorak tugashi haqida tray eslatmasi")
        self.c_trayu.setChecked(bool(a.get("tray_upcoming", True)))
        lay.addWidget(self.c_trayu)
        self.c_trayh = QCheckBox("Oynani yopganda dastur tray'da ishlashda davom etsin (eslatmalar uchun)")
        self.c_trayh.setChecked(bool(a.get("tray_hide", False)))
        lay.addWidget(self.c_trayh)
        self.c_bn = QCheckBox("Tepada banner: xavf ostidagilar, bugungi darslar, yaqin BSB/CHSB va chorak tugashi")
        self.c_bn.setChecked(bool(a.get("banner")))
        lay.addWidget(self.c_bn)
        row = QHBoxLayout()
        self.c_wk = QCheckBox("Haftalik hisobot (PDF) — hisobotlar/ papkasiga, kuni:")
        self.c_wk.setChecked(a.get("weekly") is not None)
        self.d_wk = QComboBox()
        self.d_wk.addItems(self.DAYS)
        self.d_wk.setCurrentIndex(int(a.get("weekly") if a.get("weekly") is not None else 4))
        row.addWidget(self.c_wk)
        row.addWidget(self.d_wk)
        b = QPushButton("Hozir yaratish")
        b.clicked.connect(self.now_reports)
        row.addWidget(b)
        row.addStretch()
        lay.addLayout(row)
        self.c_kw = QCheckBox("KTR dagi «BSB-1 (25 ball)» / «CHSB-1» qatorlaridan summativ ishlarni o'zi yaratish va siljitish")
        self.c_kw.setChecked(bool(a.get("ktr_works")))
        lay.addWidget(self.c_kw)
        row = QHBoxLayout()
        row.addWidget(QLabel("Avto-zaxira har"))
        self.s_bk = QSpinBox()
        self.s_bk.setRange(0, 600)
        self.s_bk.setSuffix(" daqiqada")
        self.s_bk.setSpecialValueText("faqat ochish/yopishda")
        self.s_bk.setValue(int(a.get("backup_min", 30) or 0))
        row.addWidget(self.s_bk)
        row.addStretch()
        lay.addLayout(row)
        row = QHBoxLayout()
        self.c_wd = QCheckBox("Papkani kuzatish (emaktab fayli tushsa solishtirishni taklif qilish):")
        self.c_wd.setChecked(bool(a.get("watch_dir")))
        self.e_wd = QLineEdit(a.get("watch_dir") or str(Path.home() / "Downloads"))
        b2 = QPushButton("…")
        b2.setFixedWidth(32)
        b2.clicked.connect(self.pick_dir)
        row.addWidget(self.c_wd)
        row.addWidget(self.e_wd, 1)
        row.addWidget(b2)
        lay.addLayout(row)
        row = QHBoxLayout()
        self.c_cl = QCheckBox("Bulut papkasiga nusxalash (Google Drive / Yandex Disk / Dropbox):")
        self.c_cl.setChecked(bool(a.get("cloud_dir")))
        self.e_cl = QLineEdit(a.get("cloud_dir") or "")
        self.e_cl.setPlaceholderText("Kompyuteringizdagi sinxronlanadigan papka")
        b3 = QPushButton("…")
        b3.setFixedWidth(32)
        b3.clicked.connect(self.pick_cloud)
        b4 = QPushButton("Hozir")
        b4.clicked.connect(self.cloud_now)
        row.addWidget(self.c_cl)
        row.addWidget(self.e_cl, 1)
        row.addWidget(b3)
        row.addWidget(b4)
        lay.addLayout(row)
        bb = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel)
        bb.accepted.connect(self.accept)
        bb.rejected.connect(self.reject)
        lay.addWidget(bb)

    def pick_cloud(self):
        d = QFileDialog.getExistingDirectory(self, "Bulut papkasi", self.e_cl.text() or str(Path.home()))
        if d:
            self.e_cl.setText(d)
            self.c_cl.setChecked(True)

    def cloud_now(self):
        a = self.store.auto_cfg()
        old = a.get("cloud_dir")
        a["cloud_dir"] = self.e_cl.text().strip()
        self.store._cloud_dig = None
        try:
            self.store.save()
            res = self.store.cloud_sync()
            QMessageBox.information(self, "Bulut nusxa", f"Nusxa saqlandi:\n{res}" if res else "Papka ko'rsatilmagan.")
        except OSError as e:
            QMessageBox.warning(self, "Bulut nusxa", f"Nusxalab bo'lmadi:\n{e}")
        finally:
            a["cloud_dir"] = old

    def pick_dir(self):
        d = QFileDialog.getExistingDirectory(self, "Kuzatiladigan papka", self.e_wd.text())
        if d:
            self.e_wd.setText(d)

    def now_reports(self):
        try:
            files = self.store.auto_reports()
        except OSError as e:
            QMessageBox.critical(self, "Hisobot", f"Saqlab bo'lmadi:\n{e}")
            return
        QMessageBox.information(self, "Hisobot", f"{len(files)} ta PDF saqlandi:\n{self.store.path.parent / 'hisobotlar'}")

    def accept(self):
        a = self.store.auto_cfg()
        a["quarters"] = self.c_q.isChecked()
        a["remind"] = self.t_rem.time().toString("HH:mm") if self.c_rem.isChecked() else ""
        a["banner"] = self.c_bn.isChecked()
        a["tray"], a["tray_upcoming"], a["tray_hide"] = self.c_tray.isChecked(), self.c_trayu.isChecked(), self.c_trayh.isChecked()
        a["weekly"] = self.d_wk.currentIndex() if self.c_wk.isChecked() else None
        a["ktr_works"] = self.c_kw.isChecked()
        a["backup_min"] = self.s_bk.value()
        a["watch_dir"] = self.e_wd.text().strip() if self.c_wd.isChecked() else ""
        a["cloud_dir"] = self.e_cl.text().strip() if self.c_cl.isChecked() else ""
        self.store._cloud_dig = None
        self.store.save()
        self.win.auto_restart()
        super().accept()


class MainWindow(QMainWindow):
    def __init__(self, store):
        super().__init__()
        self.store = store
        set_pdf_font(store.data["settings"].get("pdf_font", "Libertinus Serif (Typst)"))
        set_pdf_design(store.data["settings"].get("pdf_design"))
        _PDF_FONT["alpha"] = bool(store.data["settings"].get("pdf_new_alpha", True))
        _PDF_FONT["sort"] = store.data["settings"].get("pdf_sort", "default")
        self.guard = Guard(store, self)
        self._tab_cls = []
        self.setWindowTitle("Yo'qlama jurnali")
        fit_to_screen(self, 1320, 780)
        self.tabs = QTabWidget()
        self.tabs.setDocumentMode(True)
        self.today_btn = QPushButton()                   # menyu qatorining o'ng chetida — hamma sahifada doim ko'rinadi
        self.today_btn.setFlat(True)
        self.today_btn.setToolTip("Bugungi sana. Bosilsa — jurnalda bugungi kunga o'tadi")
        self.today_btn.setStyleSheet("QPushButton{border:none;padding:2px 10px;font-weight:bold;}"
                                     "QPushButton:hover{background:palette(midlight);}")
        self.today_btn.clicked.connect(lambda _=False: self.go_today())
        self.menuBar().setCornerWidget(self.today_btn, Qt.Corner.TopRightCorner)
        self.sync_today()
        self._today_timer = QTimer(self)
        self._today_timer.timeout.connect(self.auto_tick)
        self._today_timer.start(60_000)
        self._last_day = dt.date.today()
        self._seen_files = None
        self._last_bk = dt.datetime.now()
        self._busy = False
        self._quitting = False
        self.tray = None
        self.setup_tray()
        self.page = 0
        self.page_btns = []
        self.auto_bar = QLabel()                         # avtonom banner: xavf, bugungi darslar, eslatmalar
        self.auto_bar.setTextFormat(Qt.TextFormat.RichText)
        self.auto_bar.setWordWrap(True)
        self._bar_key = None
        self.auto_bar.setSizePolicy(QSizePolicy.Policy.Ignored, QSizePolicy.Policy.Preferred)
        self.auto_bar.setContentsMargins(12, 3, 12, 3)
        self.auto_bar.setStyleSheet("QLabel{background:palette(alternate-base);border-top:1px solid palette(mid);"
                                    "border-bottom:1px solid palette(mid);}")
        self.risk_chip = QPushButton("⚠")
        self.risk_chip.setFlat(True)
        self.risk_chip.setCursor(Qt.CursorShape.PointingHandCursor)
        self.risk_chip.setStyleSheet("QPushButton{color:#c62828;font-weight:bold;border:1px solid #c62828;border-radius:9px;"
                                     "padding:1px 10px;background:transparent;}QPushButton:hover{background:rgba(198,40,40,40);}")
        self.risk_chip.clicked.connect(self.risk_chip_menu)
        self.risk_chip.hide()
        self.statusBar().addPermanentWidget(self.risk_chip)
        self.auto_bar.linkActivated.connect(self.on_auto_link)
        self.auto_bar.hide()
        self.inspector = InspectorPanel(self)
        self.side_list = None
        self.build_central()
        self.tabs.currentChanged.connect(lambda _i: self.tabs.currentWidget() and self.tabs.currentWidget().refresh_page())
        self.tabs.currentChanged.connect(lambda _i: (self.sync_sidebar(), self.inspector.queue()))
        self.legend = QLabel()
        self.legend.setSizePolicy(QSizePolicy.Policy.Ignored, QSizePolicy.Policy.Preferred)
        self.statusBar().addPermanentWidget(self.legend)

        m = self.menuBar().addMenu("&Fayl")
        a = QAction("emaktab bilan ishlash: import va sinxronlash…", self)
        a.setShortcut("Ctrl+O")
        a.setToolTip("emaktab «Fan jurnali» faylini o'qiydi: yangi sinf/o'quvchi/sana/summativ ishlarni qo'shadi, baholarni solishtiradi")
        a.triggered.connect(self.sync_file)
        m.addAction(a)
        a = QAction("🌐 emaktabga kirib Excel yuklash va import…", self)
        a.setToolTip("emaktab.uz ga login/parol (captcha bilan) kiradi, sinflaringizni oladi, tanlanganlarning Excelini yuklab olib import qiladi (Playwright kerak)")
        a.triggered.connect(self.emaktab_web)
        m.addAction(a)
        m.addSeparator()
        a = QAction("🎓 Yangi o'quv yiliga o'tkazish…", self)
        a.triggered.connect(lambda _=False: self.store.classes and RolloverDialog(self).exec())
        m.addAction(a)
        a = QAction("📱 Telefon uchun HTML nusxa (faqat ko'rish)…", self)
        a.triggered.connect(lambda _=False: self.export_mobile())
        m.addAction(a)
        m.addSeparator()
        a = QAction("Chiqish", self)
        a.setShortcut(QKeySequence.StandardKey.Quit)
        a.triggered.connect(self.close)
        m.addAction(a)
        m = self.menuBar().addMenu("&Sozlamalar")
        cm = m.addMenu("Sinf sozlamalari")
        a = QAction("＋ Sinf…", self)
        a.setShortcut("Ctrl+N")
        a.triggered.connect(lambda _=False: self.add_class())
        cm.addAction(a)
        self.act_rm = QAction("− Sinf (joriy sinfni olib tashlash)…", self)
        self.act_rm.triggered.connect(lambda _=False: self.remove_class())
        cm.addAction(self.act_rm)
        cm.addSeparator()
        self.act_edit = QAction("✎ Joriy sinf nomi va fani…", self)
        self.act_edit.triggered.connect(lambda _=False: self.edit_class())
        cm.addAction(self.act_edit)
        tq = m.addMenu("Taqvim (dars kunlari, choraklar, bayramlar)")
        a = QAction("📆 Fanlarning dars kunlari (hamma sinflar)…", self)
        a.triggered.connect(lambda _=False: WeekdaysDialog(self).exec())
        tq.addAction(a)
        a = QAction("Choraklar: sanalar va dars kunlarini yaratish…", self)
        a.setToolTip("Chorak boshlanish va tugash sanalari — hamma sinflar uchun umumiy")
        a.triggered.connect(lambda _=False: self.edit_quarters())
        tq.addAction(a)
        a = QAction("Bayram kunlari…", self)
        a.triggered.connect(lambda _=False: self.edit_holidays())
        tq.addAction(a)
        mm = tq.addMenu("Metod kuni")
        mg = QActionGroup(self)
        mg.setExclusive(True)
        self.method_acts = {}
        for val, name in [(-1, "Belgilanmagan")] + list(enumerate(WEEKDAYS_FULL)):
            a = QAction(name, self)
            a.setCheckable(True)
            a.triggered.connect(lambda _=False, v=val: self.set_method(v))
            mg.addAction(a)
            mm.addAction(a)
            self.method_acts[val] = a
        mm.setToolTip("Fan o'qituvchisi dars o'tmaydigan hafta kuni — kalendarda avtomatik X bilan belgilanadi")
        self.sync_method_menu()
        bq = m.addMenu("Baholash qoidalari")
        a = QAction("Baho diapazonlari va ranglar…", self)
        a.setShortcut("Ctrl+R")
        a.triggered.connect(self.edit_ranges)
        bq.addAction(a)
        a = QAction("Xavf mezonlari («xavf ostidagi» o'quvchi)…", self)
        a.triggered.connect(lambda _=False: self.edit_risk())
        bq.addAction(a)
        a = QAction("Avtomatlashtirish…", self)
        a.triggered.connect(lambda _=False: AutoDialog(self).exec())
        m.addAction(a)
        tm = m.addMenu("Dizayn")
        grp = QActionGroup(self)
        grp.setExclusive(True)
        self.theme_acts = {}
        for key, th in THEMES.items():
            a = QAction(th["title"], self)
            a.setCheckable(True)
            a.setChecked(key == store.theme_key())
            a.triggered.connect(lambda _=False, k=key: self.apply_theme(k))
            grp.addAction(a)
            tm.addAction(a)
            self.theme_acts[key] = a
        a = QAction("Mening dizaynim", self)
        a.setCheckable(True)
        a.setChecked(store.theme_key() == "custom")
        a.triggered.connect(lambda _=False: self.apply_theme("custom"))
        grp.addAction(a)
        tm.addAction(a)
        self.theme_acts["custom"] = a
        tm.addSeparator()
        a = QAction("PDF hisobot dizayni…", self)
        a.triggered.connect(lambda _=False: PdfDesignDialog(self).exec())
        tm.addAction(a)
        a = QAction("O'z dizaynimni yasash…", self)
        a.triggered.connect(lambda _=False: ThemeEditor(self).exec())
        tm.addAction(a)
        sm = m.addMenu("Uslub")
        sg = QActionGroup(self)
        sg.setExclusive(True)
        self.style_acts = {}
        for key, (title, _q, _r) in STYLES.items():
            a = QAction(title, self)
            a.setCheckable(True)
            a.setChecked(key == (store.data["settings"].get("style") if store.data["settings"].get("style") in STYLES else "zamonaviy"))
            a.triggered.connect(lambda _=False, k=key: self.apply_style(k))
            sg.addAction(a)
            sm.addAction(a)
            self.style_acts[key] = a
        lm = m.addMenu("Joylashuv")
        lg = QActionGroup(self)
        lg.setExclusive(True)
        self.layout_acts = {}
        for key, title in (("panel", "Yon panel (sinflar chapda, o'quvchi paneli o'ngda)"), ("tabs", "Klassik (yuqorida yorliqlar)")):
            a = QAction(title, self)
            a.setCheckable(True)
            a.setChecked(key == self.layout_mode())
            a.triggered.connect(lambda _=False, k=key: self.set_layout(k))
            lg.addAction(a)
            lm.addAction(a)
            self.layout_acts[key] = a
        lm.addSeparator()
        sg2 = QActionGroup(self)
        sg2.setExclusive(True)
        self.side_acts = {}
        cur_side = side_key(self.store.data["settings"].get("side_style", "keng"))
        for key, title in SIDE_TITLES.items():
            a = QAction(title, self)
            a.setCheckable(True)
            a.setChecked(key == cur_side)
            a.triggered.connect(lambda _=False, k=key: self.set_side_style_key(k))
            sg2.addAction(a)
            lm.addAction(a)
            self.side_acts[key] = a
        zm = m.addMenu("Interfeys o'lchami")
        zg = QActionGroup(self)
        zg.setExclusive(True)
        self.zoom_acts = {}
        for title, pt in UI_ZOOMS:
            a = QAction(title, self)
            a.setCheckable(True)
            a.setChecked(pt == store.data["settings"].get("ui_zoom", 0))
            a.triggered.connect(lambda _=False, v=pt: self.set_zoom(v))
            zg.addAction(a)
            zm.addAction(a)
            self.zoom_acts[pt] = a
        for key, name, delta in (("Ctrl+=", "Kattalashtirish", 1), ("Ctrl+-", "Kichiklashtirish", -1), ("Ctrl+0", "Avto o'lcham", 0)):
            a = QAction(name, self)
            a.setShortcut(key)
            a.triggered.connect(lambda _=False, d=delta: self.step_zoom(d))
            zm.addAction(a)
            self.addAction(a)
        m = self.menuBar().addMenu("&Himoya")
        self.act_protect = QAction("Qo'yilgan baholar himoyalangan", self)
        self.act_protect.setCheckable(True)
        self.act_protect.triggered.connect(self.set_protect)
        m.addAction(self.act_protect)
        a = QAction("Parol o'rnatish / o'zgartirish…", self)
        a.triggered.connect(lambda _=False: self.set_pin())
        m.addAction(a)
        self.act_rmpin = QAction("Parolni olib tashlash…", self)
        self.act_rmpin.triggered.connect(lambda _=False: self.remove_pin())
        m.addAction(self.act_rmpin)
        a = QAction("Avtomatik qulflash vaqti…", self)
        a.triggered.connect(lambda _=False: self.set_auto_lock())
        m.addAction(a)
        m = self.menuBar().addMenu("&Tahrirlash")
        a = QAction("🔍 O'quvchini qidirish…", self)
        a.setShortcut("Ctrl+F")
        a.triggered.connect(lambda _=False: self.store.classes and FindDialog(self).exec())
        m.addAction(a)
        m.addSeparator()
        a = QAction("Kalendar-tematik reja (KTR)…", self)
        a.setShortcut("Ctrl+K")
        a.triggered.connect(lambda _=False: PlanDialog(self).exec())
        m.addAction(a)
        m.addSeparator()
        a = QAction("Oxirgi o'zgarishni bekor qilish", self)
        a.setShortcut("Ctrl+Z")
        a.triggered.connect(lambda _=False: self.tabs.currentWidget() and self.tabs.currentWidget().undo_last())
        m.addAction(a)
        m = self.menuBar().addMenu("&Hisobot")
        a = QAction("Sinf hisoboti va xavf ostidagi o'quvchilar…", self)
        a.setShortcut("Ctrl+H")
        a.triggered.connect(lambda _=False: self.show_report())
        m.addAction(a)
        a = QAction("⭐ Kuzatuvdagi o'quvchilar…", self)
        a.triggered.connect(lambda _=False: WatchDialog(self).exec())
        m.addAction(a)
        a = QAction("📊 Sinflarni solishtirish…", self)
        a.triggered.connect(lambda _=False: self.store.classes and CompareDialog(self, self.store).exec())
        m.addAction(a)
        a = QAction("Chorak yakuni tayyorligi (yetishmayotgan ballar)…", self)
        a.triggered.connect(lambda _=False: self.store.classes and ReadinessDialog(self, self.store).exec())
        m.addAction(a)
        a = QAction("BSB tahlili (ball jadvali, diagramma, tavsiyalar, PDF)…", self)
        a.triggered.connect(lambda _=False: self.show_bsb_analysis())
        m.addAction(a)
        a = QAction("Bo'sh yo'qlama varag'i (chop etish uchun)…", self)
        a.setShortcut("Ctrl+P")
        a.triggered.connect(lambda _=False: BlankSheetDialog(self).exec())
        m.addAction(a)
        a = QAction("Ko'rinayotgan jadvalni nusxalash (Excel / emaktab uchun)", self)
        a.setShortcut("Ctrl+Shift+C")
        a.triggered.connect(lambda _=False: self.tabs.currentWidget() and self.tabs.currentWidget().copy_period())
        m.addAction(a)
        m = self.menuBar().addMenu("&Ma'lumot")
        a = QAction("O'zgarishlar tarixi (baholarni qaytarish)…", self)
        a.triggered.connect(lambda _=False: self.show_history())
        m.addAction(a)
        m.addSeparator()
        a = QAction("Hozir zaxira nusxa olish", self)
        a.triggered.connect(lambda _=False: self.backup_now())
        m.addAction(a)
        a = QAction("Zaxiradan tiklash…", self)
        a.triggered.connect(lambda _=False: self.show_restore())
        m.addAction(a)
        a = QAction("Zaxira papkasini ochish", self)
        a.triggered.connect(lambda _=False: self.open_backup_dir())
        m.addAction(a)
        m = self.menuBar().addMenu("&Yordam")
        a = QAction("Belgilar va tugmalar", self)
        a.triggered.connect(self.help)
        m.addAction(a)
        a = QAction("Emoji shriftlari tashxisi…", self)
        a.setToolTip("Emoji ikonkalar chiqmasa: tizimda emoji shrifti borligini tekshiradi")
        a.triggered.connect(lambda _=False: QMessageBox.information(self, "Emoji shriftlari", emoji_diag()))
        m.addAction(a)
        for top in self.menuBar().actions():
            if top.menu() is not None:
                iconize_menu(top.menu())

        self.view = ViewState(store.data["settings"].get("view_mode", "month"))
        self.view.store = store
        self.view.notify = self.on_view_changed
        self.build_toolbar()
        self.guard.changed.connect(self.sync_lock)
        self.sync_lock()
        self.build_nav()
        self.build_corner()
        store.auto_backup()                     # ishga tushganda: ma'lumot o'zgargan bo'lsa zaxira nusxa
        added = store.ensure_current_month()
        self.build_tabs()
        self.update_legend()
        if added:
            self.statusBar().showMessage(
                f"{MONTHS_UZ[dt.date.today().month - 1]} oyi sanalari avtomatik yaratildi", 10000)
        if not store.classes:
            QTimer.singleShot(300, self.empty_start)
        else:
            QTimer.singleShot(800, self.auto_startup)

    # — avtonom funksiyalar —
    def auto_restart(self):
        self.build_tabs()
        self.refresh_auto_bar()
        self.auto_tick()

    def auto_startup(self):
        """Dastur ochilganda: chorak sanalari, haftalik hisobot, banner."""
        notes = []
        self.bot_tick()
        try:
            for q, n in self.store.auto_quarters():
                notes.append(f"{q}-chorak: {n} ta dars kuni avtomatik yaratildi")
            if notes:
                self.build_tabs()
            if self.store.weekly_report_due():
                files = self.store.auto_reports()
                if files:
                    notes.append(f"haftalik hisobot: {len(files)} ta PDF → hisobotlar/")
        except Exception as e:  # noqa: BLE001
            notes.append(f"avto-ish xatosi: {e}")
        if notes:
            self.statusBar().showMessage("Avtomatik: " + "; ".join(notes), 20000)
        self.refresh_auto_bar()
        self.auto_tick()

    def update_risk_chip(self):
        """Pastki paneldagi «⚠ N» nishoni: xavf ostidagi o'quvchilar soni; bosilsa — sinflar ro'yxati, so'ng hisobot."""
        st = self.store
        self.refresh_sidebar()
        mode = st.data["settings"]["risk"].get("notice", "chip")
        risk = st.risk_overview() if (mode == "chip" and st.classes) else []
        if not risk:
            self.risk_chip.hide()
            return
        n = sum(len(r["names"]) for r in risk)
        self.risk_chip.setText(f"⚠ {n}")
        tip = "\n".join(f"{cls_label(r['cls'])}: " + ", ".join(x[0] for x in r["names"][:6])
                        + (f" va yana {len(r['names']) - 6} ta" if len(r["names"]) > 6 else "") for r in risk)
        self.risk_chip.setToolTip(f"Xavf ostidagi o'quvchilar: {n} ta\n{tip}\n\nBosing — sinfni tanlang")
        self.risk_chip.show()

    def risk_chip_menu(self):
        risk = self.store.risk_overview()
        if not risk:
            return
        m = QMenu(self)
        for r in risk:
            m.addAction(f"{cls_label(r['cls'])} — {len(r['names'])} ta", lambda c=r["cls"]: self.show_risk_report(c))
        m.addSeparator()
        m.addAction("⚙ Xavf mezonlari…", self.edit_risk)
        m.exec(self.risk_chip.mapToGlobal(QPoint(0, -m.sizeHint().height())))

    def show_risk_report(self, cls):
        d = ReportDialog(self, cls)
        d.only.setChecked(True)
        d.exec()

    def refresh_auto_bar(self):
        st = self.store
        self.update_risk_chip()
        if not st.auto_cfg().get("banner") or not st.classes:
            self.auto_bar.hide()
            return
        parts = []
        compact = self.height() < 620 or self.width() < 900          # kichik ekran: banner bitta qatorga sig'sin — faqat sonlar
        nowd = sum(1 for c in st.classes if not c.get("weekdays"))
        if nowd:
            parts.append(f"<a href='weekdays' style='color:#e65100;'><b>📆 dars kunlari: {nowd} sinf</b></a>" if compact else
                         f"<a href='weekdays' style='color:#e65100;'><b>📆 {nowd} ta sinf uchun dars kunlari belgilanmagan</b></a>")
        risk = st.risk_overview() if st.data["settings"]["risk"].get("notice", "chip") == "banner" else []
        if risk:
            n = sum(len(r["names"]) for r in risk)
            names = "; ".join(f"{cls_label(r['cls'])}: " + ", ".join(x[0].split()[0] for x in r["names"][:3])
                              + (f" +{len(r['names']) - 3}" if len(r["names"]) > 3 else "") for r in risk[:3])
            parts.append(f"<a href='risk' style='color:#c62828;'><b>⚠ {n} xavf</b></a>" if compact else
                         f"<a href='risk' style='color:#c62828;'><b>⚠ {n} ta o'quvchi xavf ostida</b></a> ({esc(names)})")
        today = st.lessons_today()
        if today:
            todo = [cls_label(c) for c, done in today if not done]
            if compact:
                txt = (f"bugun {len(today)} dars, davomat: <a href='today'><b>{len(todo)} sinf kutilmoqda</b></a>" if todo
                       else f"bugun {len(today)} dars ✓")
            else:
                txt = f"bugun {len(today)} ta dars"
                txt += f", davomat olinmagan: <a href='today'><b>{esc(', '.join(todo))}</b></a>" if todo else ", davomat olingan ✓"
            parts.append(txt)
        ups = st.upcoming()
        parts += [f"🔔 {esc(t)}" for t in (ups[:1] if compact else ups)]
        if compact and len(ups) > 1:
            parts.append(f"🔔 +{len(ups) - 1}")
        if not parts:
            self.auto_bar.hide()
            return
        self.auto_bar.setText(" &nbsp;│&nbsp; ".join(parts))
        self.auto_bar.show()

    def resizeEvent(self, e):
        super().resizeEvent(e)
        key = (self.height() < 620 or self.width() < 900)
        if getattr(self, "_bar_key", key) != key and hasattr(self, "store"):     # ixcham/oddiy rejim almashganda banner qayta tuziladi
            QTimer.singleShot(0, self.refresh_auto_bar)
        self._bar_key = key

    def on_auto_link(self, link):
        if link == "weekdays":
            WeekdaysDialog(self).exec()
        elif link == "risk":
            self.show_report()
        elif link == "today":
            self.go_today()

    def auto_tick(self):
        """Har daqiqada: sana almashganini, eslatma vaqtini, zaxira va kuzatilayotgan papkani tekshiradi."""
        if self._busy:
            return
        self._busy = True
        try:
            self.sync_today()
            st, now = self.store, dt.datetime.now()
            if now.date() != self._last_day:                              # yarim tundan keyin yangi kun
                self._last_day = now.date()
                st.ensure_current_month()
                st.auto_quarters()
                self.build_tabs()
                self.go_today()
                if st.weekly_report_due():
                    st.auto_reports()
            a = st.auto_cfg()
            bm = int(a.get("backup_min", 0) or 0)
            if bm and (now - self._last_bk).total_seconds() >= bm * 60:
                self._last_bk = now
                st.save()
                st.auto_backup()
            self.cloud_tick()
            self.bot_tick()
            if st.classes:
                self.refresh_auto_bar()
                self.check_reminder(now)
                self.check_upcoming(now)
                self.check_watch_dir()
        finally:
            self._busy = False

    def app_icon(self):
        pm = QPixmap(64, 64)
        pm.fill(Qt.GlobalColor.transparent)
        p = QPainter(pm)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        p.setBrush(QColor("#1976d2"))
        p.setPen(Qt.PenStyle.NoPen)
        p.drawRoundedRect(4, 4, 56, 56, 12, 12)
        p.setPen(QColor("#ffffff"))
        f = QFont()
        f.setBold(True)
        f.setPixelSize(34)
        p.setFont(f)
        p.drawText(QRect(0, 0, 64, 62), Qt.AlignmentFlag.AlignCenter, "Y")
        p.end()
        return QIcon(pm)

    def setup_tray(self):
        self.setWindowIcon(self.app_icon())
        if not QSystemTrayIcon.isSystemTrayAvailable():
            return
        self.tray = QSystemTrayIcon(self.app_icon(), self)
        self.tray.setToolTip("Yo'qlama jurnali")
        m = QMenu(self)
        m.addAction("Oynani ochish", self.show_from_tray)
        m.addAction("⚡ Tezkor davomat", lambda: (self.show_from_tray(), self.fast_current()))
        m.addSeparator()
        m.addAction("Chiqish", self.quit_app)
        self.tray.setContextMenu(m)
        self.tray.activated.connect(lambda r: self.show_from_tray() if r in (
            QSystemTrayIcon.ActivationReason.Trigger, QSystemTrayIcon.ActivationReason.DoubleClick) else None)
        self.tray.messageClicked.connect(self.show_from_tray)
        self.tray.show()

    def show_from_tray(self):
        self.showNormal()
        self.raise_()
        self.activateWindow()
        self.go_today()

    def fast_current(self):
        v = self.tabs.currentWidget()
        if v is not None:
            v.fast_attendance()

    def quit_app(self):
        self._quitting = True
        self.close()
        QApplication.quit()

    def notify(self, title, text):
        """Tray bildirishnomasi (sozlama yoqilgan va tray mavjud bo'lsa). True — yuborildi."""
        if self.tray is None or not self.store.auto_cfg().get("tray", True):
            return False
        self.tray.showMessage(title, text, QSystemTrayIcon.MessageIcon.Information, 15000)
        return True

    def cloud_tick(self):
        try:
            res = self.store.cloud_sync()
            self._cloud_err = False
            if res:
                self.statusBar().showMessage(f"☁ Nusxa bulut papkasiga saqlandi ({res})", 5000)
        except OSError as e:
            if not getattr(self, "_cloud_err", False):                # xato haqida bir marta xabar beradi
                self._cloud_err = True
                self.statusBar().showMessage(f"☁ Bulut papkasiga nusxalab bo'lmadi: {e}", 15000)

    def bot_tick(self):
        """Telegram bot navbatini (bot_inbox.json) jurnalga qo'llaydi."""
        try:
            res = self.store.apply_inbox(not self.guard.is_locked())
        except Exception as e:  # noqa: BLE001
            log_error(e)
            return
        if not res:
            return
        if res["applied"]:
            cur = self.current_cls()
            self.build_tabs()
            if cur is not None:
                self.select_class(cur)
        msg = f"🤖 Telegram bot: {res['applied']} ta o'zgarish jurnalga yozildi"
        if res["skipped"]:
            msg += f"; o'tkazib yuborildi: {len(res['skipped'])} ({'; '.join(res['skipped'][:3])})"
        self.statusBar().showMessage(msg, 20000)

    def check_upcoming(self, now):
        a, state = self.store.auto_cfg(), self.store.auto_state()
        if not a.get("tray_upcoming", True) or state.get("upcoming_notified") == now.date().isoformat():
            return
        state["upcoming_notified"] = now.date().isoformat()
        up = self.store.upcoming()
        if up:
            self.store.save()
            self.notify("Yaqin kunlarda", "\n".join("• " + u for u in up[:5]))

    def check_reminder(self, now):
        a, state = self.store.auto_cfg(), self.store.auto_state()
        rem = a.get("remind")
        if not rem or state.get("reminded") == now.date().isoformat() or now.strftime("%H:%M") < rem:
            return
        todo = [cls_label(c) for c, done in self.store.lessons_today() if not done]
        state["reminded"] = now.date().isoformat()                        # kuniga bir marta
        if not todo:
            return
        self.store.save()
        if self.notify("Davomat eslatmasi", "Bugun davomat olinmagan sinflar:\n• " + "\n• ".join(todo)):
            return
        box = QMessageBox(QMessageBox.Icon.Information, "Davomat eslatmasi",
                          "Bugun davomat olinmagan sinflar:\n• " + "\n• ".join(todo), QMessageBox.StandardButton.Close, self)
        b = box.addButton("Bugungi kunga o'tish", QMessageBox.ButtonRole.AcceptRole)
        b.clicked.connect(self.go_today)
        box.setWindowModality(Qt.WindowModality.NonModal)
        box.setAttribute(Qt.WidgetAttribute.WA_DeleteOnClose)
        box.show()
        self._reminder_box = box

    def check_watch_dir(self):
        wd = self.store.auto_cfg().get("watch_dir")
        if not wd or not Path(wd).is_dir():
            return
        try:
            files = {f.name: f.stat().st_mtime for f in Path(wd).iterdir()
                     if f.suffix.lower() in (".xls", ".xlsx", ".ods") and f.is_file()}
        except OSError:
            return
        if self._seen_files is None:                                       # birinchi tekshiruv: mavjudlari «ko'rilgan»
            self._seen_files = files
            return
        new = [n for n, t in files.items() if self._seen_files.get(n) != t]
        self._seen_files = files
        for n in sorted(new)[:1]:
            path = str(Path(wd) / n)
            try:
                imports = read_import_file(path)
            except Exception:  # noqa: BLE001
                continue
            if not imports:
                continue
            r = QMessageBox.question(self, "Yangi emaktab fayli", f"«{n}» papkaga tushdi.\nJurnal bilan solishtiraymi?")
            if r == QMessageBox.StandardButton.Yes:
                SyncDialog(self, self.store, imports, n).exec()

    # — baholarni himoyalash —
    def sync_lock(self):
        g = self.guard
        if not g.enabled():
            self.lock_btn.setText("⚠ Himoya o'chiq")
            self.lock_btn.setToolTip("Qo'yilgan baholar himoyalanmagan. Bosib himoyani yoqing.")
            self.lock_btn.setStyleSheet("color:#c62828;font-weight:bold;")
        elif g.is_locked():
            self.lock_btn.setText("🔒 Himoyalangan")
            self.lock_btn.setToolTip("Qo'yilgan baholarni o'zgartirib bo'lmaydi (bo'sh kataklarga yangi baho qo'yish mumkin). "
                                     "Qulfni ochish uchun bosing.")
            self.lock_btn.setStyleSheet("")
        else:
            self.lock_btn.setText("🔓 Ochiq — qulflash")
            self.lock_btn.setToolTip("Baholarni o'zgartirish mumkin. Qayta qulflash uchun bosing.")
            self.lock_btn.setStyleSheet("background:#ffca28;color:#000000;font-weight:bold;")
        self.act_protect.setChecked(g.enabled())
        self.act_rmpin.setEnabled(g.has_pin())

    def toggle_lock(self):
        g = self.guard
        if not g.enabled():
            self.set_protect(True)
        elif g.is_locked():
            g.unlock(self)
        else:
            g.lock()

    def set_protect(self, on):
        g = self.guard
        if on:
            g.cfg["enabled"] = True
            g._unlocked = False
        else:
            if g.is_locked() and not g.unlock(self, "Himoyani o'chirish uchun avval qulfni oching."):
                self.sync_lock()
                return
            g.cfg["enabled"] = False
        self.store.save()
        g.changed.emit()

    def ask_pin(self, title, label):
        text, ok = QInputDialog.getText(self, title, label, QLineEdit.EchoMode.Password)
        return text if ok else None

    def set_pin(self):
        g = self.guard
        if g.has_pin():
            cur = self.ask_pin("Parol", "Joriy parol:")
            if cur is None:
                return
            if not check_pin(cur, g.cfg["pin"]):
                QMessageBox.warning(self, "Parol", "Joriy parol noto'g'ri.")
                return
        p1 = self.ask_pin("Yangi parol", "Yangi parol (kamida 4 belgi).\nParolni unutsangiz, qulfni ilovada ochib bo'lmaydi:")
        if p1 is None:
            return
        if len(p1) < 4:
            QMessageBox.warning(self, "Parol", "Parol kamida 4 belgidan iborat bo'lishi kerak.")
            return
        p2 = self.ask_pin("Yangi parol", "Parolni takrorlang:")
        if p2 is None:
            return
        if p1 != p2:
            QMessageBox.warning(self, "Parol", "Parollar mos kelmadi.")
            return
        g.cfg["pin"] = make_pin(p1)
        self.store.save()
        self.sync_lock()
        self.statusBar().showMessage("Parol o'rnatildi", 8000)

    def remove_pin(self):
        g = self.guard
        if not g.has_pin():
            return
        cur = self.ask_pin("Parolni olib tashlash", "Joriy parol:")
        if cur is None:
            return
        if not check_pin(cur, g.cfg["pin"]):
            QMessageBox.warning(self, "Parol", "Parol noto'g'ri.")
            return
        g.cfg["pin"] = None
        self.store.save()
        self.sync_lock()
        self.statusBar().showMessage("Parol olib tashlandi (qulfni ochish faqat tasdiq bilan)", 8000)

    def set_auto_lock(self):
        g = self.guard
        mins, ok = QInputDialog.getInt(
            self, "Avtomatik qulflash", "Qulf ochilgandan keyin harakatsiz turilsa, necha daqiqada qayta qulflansin?\n"
            "(0 — o'zi qulflanmasin)", int(g.cfg.get("auto_lock_min", 10) or 0), 0, 240)
        if ok:
            g.cfg["auto_lock_min"] = mins
            self.store.save()
            g.touch() if mins else g.timer.stop()

    def show_history(self):
        HistoryDialog(self).exec()

    def revert_change(self, e):
        cls = next((c for c in self.store.classes if cls_label(c) == e.get("cls")), None)
        if cls is None:                          # eski yozuv (fan belgilanmasdan oldin): nom bo'yicha, faqat noyob bo'lsa
            same = [c for c in self.store.classes if c["name"] == e.get("cls")]
            cls = same[0] if len(same) == 1 else None
        st = next((x for x in cls["students"] if x["name"] == e.get("student")), None) if cls else None
        if st is None:
            QMessageBox.warning(self, "Qaytarish", "Sinf yoki o'quvchi topilmadi.")
            return False
        wid = e.get("work")
        if wid and not wid.startswith("final:") and wid != "exam" and not any(w["id"] == wid for w in cls["works"]):
            QMessageBox.warning(self, "Qaytarish", "Bu summativ ish endi mavjud emas.")
            return False
        d = e["date"]
        bucket, key = (st.setdefault("scores", {}), wid) if wid else (st["marks"], d)
        cur = bucket.get(key, "")
        if cur != e.get("new", ""):
            QMessageBox.warning(self, "Qaytarish", "Katakdagi qiymat keyin yana o'zgargan, shuning uchun "
                                "bu yozuvni qaytarib bo'lmaydi.")
            return False
        if not self.guard.require(self, "Bahoni qaytarish mavjud bahoni o'zgartiradi."):
            return False
        old = e.get("old", "")
        if old != "":
            bucket[key] = old
        else:
            bucket.pop(key, None)
        self.store.log_change(cls_label(cls), st["name"], d, cur, old, "revert",
                              **({"work": wid, "wt": e.get("wt")} if wid else {}))
        self.store.save()
        for i in range(self.tabs.count()):
            self.tabs.widget(i).apply_view()
        self.statusBar().showMessage("Baho qaytarildi", 8000)
        return True

    # — kun / hafta / oy ko'rinishi —
    def build_nav(self):
        scr = self.screen() or QGuiApplication.primaryScreen()
        if scr is None or scr.availableGeometry().width() < S(1250):    # tor ekranda ikkinchi qatorga; keng ekranda bitta qatorga
            self.addToolBarBreak()
        tb = self.nav_tb = self.addToolBar("Davr")
        tb.setMovable(False)
        tb.addWidget(QLabel("  Ko'rinish: "))
        grp = QButtonGroup(self)
        grp.setExclusive(True)
        self.mode_btns = {}
        for i, (key, name) in enumerate(VIEW_MODES, 1):
            b = QPushButton(name)
            b.setCheckable(True)
            b.setMinimumWidth(S(64))
            b.setShortcut(f"Ctrl+{i}")
            b.setToolTip(f"{name} ko'rinishi (Ctrl+{i})")
            b.clicked.connect(lambda _=False, k=key: self.set_view(mode=k))
            grp.addButton(b)
            tb.addWidget(b)
            self.mode_btns[key] = b
        tb.addSeparator()
        prev = QPushButton("◀")
        prev.setMinimumWidth(S(36))
        prev.setShortcut("Alt+Left")
        prev.setToolTip("Oldingi kun / hafta / oy / chorak (Alt+←)")
        prev.clicked.connect(lambda _=False: self.shift_view(-1))
        tb.addWidget(prev)
        self.date_edit = QDateEdit()
        self.date_edit.setCalendarPopup(True)
        self.date_edit.setDisplayFormat("dd.MM.yyyy")
        self.date_edit.setToolTip("Kerakli sanani tanlang — shu kun / hafta / oy / chorak ko'rsatiladi")
        tb.addWidget(self.date_edit)
        nxt = QPushButton("▶")
        nxt.setMinimumWidth(S(36))
        nxt.setShortcut("Alt+Right")
        nxt.setToolTip("Keyingi kun / hafta / oy / chorak (Alt+→)")
        nxt.clicked.connect(lambda _=False: self.shift_view(1))
        tb.addWidget(nxt)
        today = QPushButton("Bugun")
        today.clicked.connect(lambda _=False: self.set_view(anchor=dt.date.today()))
        tb.addWidget(today)
        tb.addSeparator()
        self.period_lbl = QLabel()
        f = self.period_lbl.font()
        f.setBold(True)
        self.period_lbl.setFont(f)
        self.period_lbl.setMinimumWidth(S(230))
        tb.addWidget(self.period_lbl)
        self.sync_nav()
        self.date_edit.dateChanged.connect(
            lambda qd: self.set_view(anchor=dt.date(qd.year(), qd.month(), qd.day())))

    def sync_nav(self):
        a = self.view.anchor
        with blocked(self.date_edit):
            self.date_edit.setDate(QDate(a.year, a.month, a.day))
        self.mode_btns[self.view.mode].setChecked(True)
        self.period_lbl.setText("  " + self.view.title())

    def set_view(self, mode=None, anchor=None):
        if mode and mode != self.view.mode:
            self.view.mode = mode
            self.store.data["settings"]["view_mode"] = mode
            self.store.save()
        if anchor:
            self.view.anchor = anchor
        self.on_view_changed()

    def shift_view(self, n):
        self.view.shift(n)
        self.on_view_changed()

    def on_view_changed(self):
        self.sync_nav()
        for i in range(self.tabs.count()):
            self.tabs.widget(i).apply_view()

    def set_zoom(self, pt):
        """Interfeys o'lchamini o'zgartiradi (0 — avto): shrift, jadval kataklari va tugmalar qayta quriladi."""
        self.store.data["settings"]["ui_zoom"] = pt
        self.store.save()
        cur = apply_ui_zoom(pt)
        if pt in self.zoom_acts:
            self.zoom_acts[pt].setChecked(True)
        self.build_tabs()
        self.statusBar().showMessage(f"Interfeys o'lchami: {cur} pt" + (" (avto)" if not pt else ""), 6000)

    def step_zoom(self, delta):
        cur = self.store.data["settings"].get("ui_zoom", 0) or auto_ui_pt(self.screen())
        self.set_zoom(0 if delta == 0 else max(8, min(18, cur + delta)))

    def apply_style(self, key):
        self.store.data["settings"]["style"] = key
        set_app_style(key, self.store.theme())
        self.store.save()
        self.build_tabs()
        self.statusBar().showMessage(f"Uslub: {STYLES[key][0]}", 6000)

    def sync_theme_menu(self):
        a = self.theme_acts.get(self.store.theme_key())
        if a:
            a.setChecked(True)

    def apply_theme(self, key, save=True):
        self.store.data["settings"]["theme"] = key
        th = self.store.theme()
        set_app_style(self.store.data["settings"].get("style"), th)
        if save:
            self.store.save()
        self.sync_theme_menu()
        for i in range(self.tabs.count()):
            self.tabs.widget(i).refresh()
        self.update_legend()
        self.statusBar().showMessage(f"Dizayn: {th['title']}", 6000)

    def build_toolbar(self):
        tb = self.addToolBar("Asosiy")
        tb.setMovable(False)
        self.subj_lbl = tb.addWidget(QLabel("  Fan: "))
        self.subj_cb = QComboBox()
        self.subj_cb.setToolTip("Ko'rinadigan sinflar: tanlangan fan bo'yicha filtrlanadi")
        self.subj_act = tb.addWidget(self.subj_cb)
        self.subj_cb.currentIndexChanged.connect(self.on_subject_filter)
        tb.addSeparator()
        act = QAction("＋ Chorak", self)
        act.setToolTip("Choraklar: sanalarni belgilash va dars kunlarini bir yo'la yaratish")
        act.triggered.connect(self.gen_quarter)
        tb.addAction(act)
        tb.addSeparator()
        self.lock_btn = QPushButton()
        self.lock_btn.clicked.connect(lambda _=False: self.toggle_lock())
        tb.addWidget(self.lock_btn)

    def set_method(self, val):
        """Metod kuni (-1 — belgilanmagan, 0..6 — hafta kuni)."""
        self.store.set_method_weekday(None if val < 0 else val)
        self.store.save()
        self.sync_method_menu()
        self.build_tabs()
        self.statusBar().showMessage(
            "Metod kuni belgilanmadi" if val < 0 else
            f"Metod kuni: {WEEKDAYS_FULL[val]} — kalendarda X bilan belgilanadi", 8000)

    def sync_method_menu(self):
        mw = self.store.method_weekday()
        a = self.method_acts.get(-1 if mw is None else mw)
        if a:
            a.setChecked(True)

    def edit_quarters(self):
        dlg = QuartersDialog(self.store, self)
        if not dlg.exec():
            return
        self.store.save()
        if dlg.gen:
            q, all_classes = dlg.gen
            if all_classes:
                classes = None if not self.store.data["settings"].get("subject_filter") else list(self._tab_cls)
            else:
                classes = [self.current_cls()]
            n = self.store.generate_quarter(q, self.store.data["settings"]["lesson_weekdays"], classes)
            self.store.save()
            self.build_tabs()
            lo = dt.date.fromisoformat(self.store.quarter_range(q)[0])
            today = dt.date.today()
            self.set_view(mode="quarter", anchor=today if self.store.quarter_of(today.isoformat()) == q else lo)
            self.statusBar().showMessage(
                f"{q}-chorak: {n} ta yangi sana qo'shildi" if n else f"{q}-chorak: yangi sana yo'q (hammasi mavjud)", 8000)
            return
        for i in range(self.tabs.count()):
            self.tabs.widget(i).refresh()
        self.on_view_changed()
        self.statusBar().showMessage("Chorak sanalari saqlandi", 6000)

    def gen_quarter(self):
        if not self.store.classes:
            QMessageBox.information(self, "Chorak", "Avval sinflarni import qiling.")
            return
        self.edit_quarters()

    # — fan bo'yicha filtr —
    def current_cls(self):
        w = self.tabs.currentWidget()
        return w.cls if w is not None else None

    def visible_classes(self):
        f = self.store.data["settings"].get("subject_filter", "")
        if not f:
            return list(self.store.classes)
        if f == NO_SUBJECT:
            return [c for c in self.store.classes if not c.get("subject")]
        k = Store._cls_key(f)
        return [c for c in self.store.classes if Store._cls_key(c.get("subject", "")) == k]

    def refresh_subjects(self):
        """Fan ro'yxatini yangilaydi; hech qaysi sinfga fan belgilanmagan bo'lsa — filtrni yashiradi."""
        subs = self.store.subjects()
        f = self.store.data["settings"].get("subject_filter", "")
        has_bare = any(not c.get("subject") for c in self.store.classes)
        valid = {""} | {Store._cls_key(x) for x in subs} | ({NO_SUBJECT} if has_bare else set())
        if f and f != NO_SUBJECT and Store._cls_key(f) not in valid or (f == NO_SUBJECT and not has_bare):
            f = self.store.data["settings"]["subject_filter"] = ""
        with blocked(self.subj_cb):
            self.subj_cb.clear()
            self.subj_cb.addItem("Hammasi", "")
            for x in subs:
                self.subj_cb.addItem(x, x)
            if subs and has_bare:
                self.subj_cb.addItem("(fan belgilanmagan)", NO_SUBJECT)
            k = self.subj_cb.findData(f)
            if k < 0 and f:
                k = next((i for i in range(self.subj_cb.count())
                          if Store._cls_key(self.subj_cb.itemData(i) or "") == Store._cls_key(f)), 0)
            self.subj_cb.setCurrentIndex(max(k, 0))
        for a in (self.subj_lbl, self.subj_act):
            a.setVisible(bool(subs))

    def on_subject_filter(self, _i):
        self.store.data["settings"]["subject_filter"] = self.subj_cb.currentData() or ""
        self.store.save()
        self.build_tabs()

    def select_class(self, cls):
        """Berilgan sinf tabini ochadi (filtr yashirgan bo'lsa — filtrni «Hammasi» ga qaytaradi)."""
        if not any(c is cls for c in self._tab_cls):
            self.store.data["settings"]["subject_filter"] = ""
            self.build_tabs()
        for i, c in enumerate(self._tab_cls):
            if c is cls:
                self.tabs.setCurrentIndex(i)
                return

    def sync_today(self):
        d = dt.date.today()
        self.today_btn.setText(f"📅 Bugun: {WEEKDAYS_FULL[d.weekday()]}, {d:%d.%m.%Y}")

    def go_today(self):
        if self.page != 0:
            self.set_page(0)
        self.set_view(anchor=dt.date.today())

    def set_page(self, k):
        """Sahifani (0 — Jurnal, 1 — Summativ, 2 — Yillik) hamma sinf yorliqlari uchun birdan almashtiradi."""
        self.page = k
        self.nav_tb.setVisible(k == 0)                   # Kun/Hafta/Oy/Chorak faqat jurnal sahifasiga tegishli
        for i, b in enumerate(self.page_btns):
            b.setChecked(i == k)
        cur = self.tabs.currentWidget()
        for i in range(self.tabs.count()):
            w = self.tabs.widget(i)
            w.set_page(k, refresh=(w is cur))

    # — asosiy oyna joylashuvi: klassik yorliqlar / yon panel —
    def layout_mode(self):
        return "panel" if self.store.data["settings"].get("layout") == "panel" else "tabs"

    PAGES = (("📒", "Jurnal", "Baholar va yo'qlama jurnali — hamma sinflar uchun (Alt+1)"),
             ("📝", "Summativ: BSB / CHSB", "Summativ baholash — hamma sinflar uchun (Alt+2)"),
             ("🎓", "Yillik / yakuniy", "Yillik va yakuniy baholar — hamma sinflar uchun (Alt+3)"))

    def make_page_buttons(self):
        self.page_btns = []
        for i, (ic, name, tip) in enumerate(self.PAGES):
            b = QPushButton(f"{ic} {name}")
            b.setCheckable(True)
            b.setChecked(i == self.page)
            b.setToolTip(tip)
            b.setShortcut(f"Alt+{i + 1}")
            b.clicked.connect(lambda _=False, k=i: self.set_page(k))
            self.page_btns.append(b)
        return self.page_btns

    def build_central(self):
        """Markaziy qismni tanlangan joylashuv bo'yicha quradi (yorliqlar va banner qayta ishlatiladi)."""
        old = self.centralWidget()
        for w in (self.tabs, self.auto_bar, self.inspector):
            w.setParent(None)
        central = QWidget()
        if self.layout_mode() == "tabs":
            cl = QVBoxLayout(central)
            cl.setContentsMargins(0, 0, 0, 0)
            cl.setSpacing(0)
            pagebar = QHBoxLayout()
            pagebar.setContentsMargins(9, 6, 9, 4)
            pagebar.setSpacing(6)
            for b in self.make_page_buttons():
                pagebar.addWidget(b)
            pagebar.addStretch()
            cl.addLayout(pagebar)
            cl.addWidget(self.auto_bar)
            cl.addWidget(self.tabs, 1)
            self.tabs.tabBar().show()
            self.side_list = None
        else:
            root = QHBoxLayout(central)
            root.setContentsMargins(0, 0, 0, 0)
            root.setSpacing(0)
            root.addWidget(self.make_sidebar())
            mid = QVBoxLayout()
            mid.setContentsMargins(0, 0, 0, 0)
            mid.setSpacing(0)
            self.head = QLabel()
            self.head.setTextFormat(Qt.TextFormat.RichText)
            self.head.setContentsMargins(S(18), S(10), S(18), S(6))
            hb = QHBoxLayout()
            hb.setContentsMargins(0, 0, S(10), 0)
            hb.addWidget(self.head, 1)
            self.insp_btn = QPushButton("◧ Panel")
            self.insp_btn.setCheckable(True)
            self.insp_btn.setChecked(bool(self.store.data["settings"].get("inspector", True)))
            self.insp_btn.setToolTip("O'ngdagi o'quvchi panelini ko'rsatish / yashirish")
            self.insp_btn.toggled.connect(self.toggle_inspector)
            hb.addWidget(self.insp_btn)
            mid.addLayout(hb)
            mid.addWidget(self.auto_bar)
            mid.addWidget(self.tabs, 1)
            root.addLayout(mid, 1)
            root.addWidget(self.inspector)
            self.inspector.setVisible(self.insp_btn.isChecked())
            self.tabs.tabBar().hide()
        self.tabs.show()
        self.setCentralWidget(central)                      # eski markaziy vidjet (va uning yon paneli) o'chadi
        if old is not None:
            old.deleteLater()
        self._bar_key = None
        if hasattr(self, "view"):
            self.refresh_auto_bar()
            self.sync_sidebar()
            self.inspector.queue()

    def make_sidebar(self):
        key = side_key(self.store.data["settings"].get("side_style", "keng"))
        set_side_style(key)
        sb = QFrame()
        sb.setObjectName("sidebar")
        sb.setFixedWidth(S(SIDE_STYLES[key]))
        sb.setStyleSheet(
            "#sidebar{background:palette(alternate-base);border-right:1px solid palette(midlight);}"
            "#sidebar QLabel#sec{color:palette(mid);font-size:8pt;font-weight:700;letter-spacing:1px;padding:0;}"
            "#sidebar QLabel#today{color:palette(mid);}"
            "#sidebar QListWidget{background:transparent;border:none;outline:0;}"
            "#sidebar QLineEdit{background:palette(base);border:1px solid palette(midlight);border-radius:7px;padding:4px 8px;}"
            "#sidebar QPushButton{background:transparent;border:none;border-radius:7px;padding:7px 10px;text-align:left;}"
            "#sidebar QPushButton:hover{background:palette(midlight);}"
            "#sidebar QPushButton:checked{background:palette(highlight);color:palette(highlighted-text);font-weight:600;}"
            "#sidebar QPushButton#tool{padding:6px 0;text-align:center;font-size:11pt;}"
            "#sidebar QPushButton#mini{padding:2px 8px;text-align:center;font-size:11pt;}"
            "#sidebar QScrollBar:vertical{width:6px;background:transparent;margin:0;}"
            "#sidebar QScrollBar::handle:vertical{background:palette(mid);border-radius:3px;min-height:24px;}"
            "#sidebar QScrollBar::add-line,#sidebar QScrollBar::sub-line{height:0;width:0;}")
        lay = QVBoxLayout(sb)
        lay.setContentsMargins(S(8), S(10), S(8), S(8))
        lay.setSpacing(S(6))
        self.today_lbl = QLabel()
        self.today_lbl.setObjectName("today")
        self.today_lbl.setTextFormat(Qt.TextFormat.RichText)
        self.today_lbl.setWordWrap(True)
        self.today_lbl.setContentsMargins(S(6), 0, 0, 0)
        lay.addWidget(self.today_lbl)
        # sinflar sarlavhasi + «＋» va kengaytirish tugmalari
        hd = QHBoxLayout()
        hd.setContentsMargins(S(6), S(2), 0, 0)
        sec = QLabel("SINFLAR")
        sec.setObjectName("sec")
        hd.addWidget(sec, 1)
        add = QPushButton("＋")
        add.setObjectName("mini")
        add.setToolTip("Sinf qo'shish")
        add.clicked.connect(lambda _=False: self.add_class())
        hd.addWidget(add)
        wide = QPushButton("⇤" if key == "keng" else "⇥")
        wide.setObjectName("mini")
        wide.setToolTip("Yon panelni toraytirish / kengaytirish")
        wide.clicked.connect(lambda _=False: self.set_side_style_key("tor" if key == "keng" else "keng"))
        hd.addWidget(wide)
        lay.addLayout(hd)
        self.side_find = QLineEdit()
        self.side_find.setPlaceholderText("Sinfni qidirish…")
        self.side_find.setClearButtonEnabled(True)
        self.side_find.textChanged.connect(lambda _t: self.refresh_sidebar())
        lay.addWidget(self.side_find)
        self.side_list = QListWidget()
        self.side_list.setItemDelegate(SideDelegate(self.side_list))
        self.side_list.setMouseTracking(True)
        self.side_list.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAsNeeded)
        self.side_list.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.side_list.setMinimumHeight(S(120))
        self.side_list.setFocusPolicy(Qt.FocusPolicy.NoFocus)
        self.side_list.currentRowChanged.connect(self.on_side_row)
        self.side_list.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.side_list.customContextMenuRequested.connect(self.side_menu)
        lay.addWidget(self.side_list, 1)
        sec = QLabel("SAHIFA")
        sec.setObjectName("sec")
        sec.setContentsMargins(S(6), 0, 0, 0)
        lay.addWidget(sec)
        for b in self.make_page_buttons():
            if SIDE_COMPACT:
                b.setText(b.text().split(" ")[0])
                b.setStyleSheet("text-align:center;")
            lay.addWidget(b)
        tools = QHBoxLayout()
        tools.setSpacing(S(2))
        for text, tip, slot in (("⚡", "Tezkor davomat (Ctrl+D)", lambda: self.fast_current()),
                                ("🔍", "Qidirish (Ctrl+F)", lambda: self.store.classes and FindDialog(self).exec()),
                                ("⭐", "Kuzatuv ro'yxati", lambda: self.store.classes and WatchDialog(self).exec()),
                                ("📊", "Sinflarni solishtirish", lambda: self.store.classes and CompareDialog(self, self.store).exec()),
                                ("📄", "Hisobot", lambda: self.show_report())):
            b = QPushButton(text)
            b.setObjectName("tool")
            b.setToolTip(tip)
            b.clicked.connect(lambda _=False, f=slot: f())
            tools.addWidget(b)
        lay.addLayout(tools)
        back = QPushButton("↺ Klassik" if SIDE_COMPACT else "↺ Klassik joylashuv")
        back.setToolTip("Yuqoridagi yorliqli ko'rinishga qaytish")
        back.setStyleSheet("font-size:8pt;color:palette(mid);")
        back.clicked.connect(lambda _=False: self.set_layout("tabs"))
        lay.addWidget(back)
        return sb

    def set_layout(self, key):
        self.store.data["settings"]["layout"] = key
        self.store.save()
        for k, a in getattr(self, "layout_acts", {}).items():
            a.setChecked(k == key)
        self.build_central()
        self.statusBar().showMessage("Joylashuv: " + ("yon panel" if key == "panel" else "klassik yorliqlar"), 5000)

    def set_side_style_key(self, key):
        key = side_key(key)
        self.store.data["settings"]["side_style"] = key
        self.store.save()
        for k, a in getattr(self, "side_acts", {}).items():
            a.setChecked(k == key)
        if self.layout_mode() == "panel":
            self.build_central()
        else:
            self.set_layout("panel")

    def toggle_inspector(self, on):
        self.store.data["settings"]["inspector"] = bool(on)
        self.store.save()
        self.inspector.setVisible(bool(on))
        self.inspector.queue()

    def on_side_row(self, row):
        it = self.side_list.item(row) if self.side_list is not None and row >= 0 else None
        k = it.data(Qt.ItemDataRole.UserRole + 1) if it is not None else None
        if k is not None and 0 <= k < self.tabs.count() and k != self.tabs.currentIndex():
            self.tabs.setCurrentIndex(k)

    def side_menu(self, pos):
        i = self.side_list.row(self.side_list.itemAt(pos)) if self.side_list.itemAt(pos) else -1
        menu = QMenu(self)
        menu.addAction("＋ Sinf qo'shish…", lambda: self.add_class())
        if 0 <= i < len(self._tab_cls):
            menu.addAction(f"✎ «{cls_label(self._tab_cls[i])}» — nomi va fani…", lambda k=i: self.edit_class(k))
            menu.addAction(f"− «{cls_label(self._tab_cls[i])}» sinfini olib tashlash…", lambda k=i: self.remove_class(k))
        menu.exec(self.side_list.mapToGlobal(pos))

    def refresh_sidebar(self):
        """Yon paneldagi sinflar ro'yxati, bugungi holat va sarlavha (faqat «panel» joylashuvda)."""
        if self.layout_mode() != "panel" or self.side_list is None:
            return
        st = self.store
        risk = {id(r["cls"]): len(r["names"]) for r in st.risk_overview()} if st.classes else {}
        today = {id(c): ("done" if done else "todo") for c, done in st.lessons_today()}
        with blocked(self.side_list):
            self.side_list.clear()
            q = self.side_find.text().strip().lower() if getattr(self, "side_find", None) is not None else ""
            for k, c in enumerate(self._tab_cls):
                if q and q not in cls_label(c).lower():
                    continue
                it = QListWidgetItem()
                it.setData(Qt.ItemDataRole.UserRole, (cls_label(c), f"{len(c['students'])} o'quvchi", risk.get(id(c), 0), today.get(id(c))))
                it.setData(Qt.ItemDataRole.UserRole + 1, k)
                self.side_list.addItem(it)
        todo = sum(1 for v in today.values() if v == "todo")
        d = dt.date.today()
        self.today_lbl.setText(f"{WEEKDAYS_FULL[d.weekday()]}, {d.day}.{d.month:02d}"
                               + (f" · <span style='color:#f59e0b'>⏳ davomat: {todo} sinf</span>" if todo
                                  else (" · <span style='color:#22c55e'>✓ davomat olingan</span>" if today else "")))
        self.select_side()

    def sync_sidebar(self):
        if self.layout_mode() != "panel" or self.side_list is None:
            return
        if not getattr(self, "side_find", None) or not self.side_find.text().strip():
            if self.side_list.count() != len(self._tab_cls):
                self.refresh_sidebar()
                return
        self.select_side()

    def select_side(self):
        i = self.tabs.currentIndex()
        with blocked(self.side_list):
            self.side_list.setCurrentRow(-1)
            for r in range(self.side_list.count()):
                if self.side_list.item(r).data(Qt.ItemDataRole.UserRole + 1) == i:
                    self.side_list.setCurrentRow(r)
                    break
        cv = self.tabs.currentWidget()
        if cv is not None and hasattr(self, "head"):
            c = cv.cls
            self.head.setText(f"<span style='font-size:17pt;font-weight:700'>{esc(cls_label(c))}</span>"
                              f" &nbsp;<span style='color:gray'>{len(c['students'])} o'quvchi · {len(c['dates'])} dars kuni</span>")
        elif hasattr(self, "head"):
            self.head.setText("")

    def build_tabs(self):
        self.store.reflow_all()                                   # KTR: bugundan keyingi mavzularni yangilaydi
        cur_cls, cur = self.current_cls(), self.tabs.currentIndex()
        self.refresh_subjects()
        classes = self._tab_cls = self.visible_classes()
        for i in range(self.tabs.count()):
            self.tabs.widget(i).deleteLater()
        self.tabs.clear()
        for cls in classes:
            cv = ClassView(self.store, cls, self.view, self.guard)
            cv.table.currentCellChanged.connect(lambda *_a: self.inspector.queue())
            self.tabs.addTab(cv, cls_label(cls))
            cv.set_page(self.page, refresh=False)
        idx = next((i for i, c in enumerate(classes) if c is cur_cls), cur)
        if 0 <= idx < self.tabs.count():
            self.tabs.setCurrentIndex(idx)
        if self.tabs.currentWidget() is not None:
            self.tabs.currentWidget().refresh_page()
        self.act_rm.setEnabled(self.tabs.count() > 0)
        self.act_edit.setEnabled(self.tabs.count() > 0)
        self.refresh_sidebar()
        self.inspector.queue()

    # — sinflarni qo'shish / olib tashlash —
    def build_corner(self):
        tb = self.tabs.tabBar()
        tb.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        tb.customContextMenuRequested.connect(self.tab_menu)

    def tab_menu(self, pos):
        tb = self.tabs.tabBar()
        i = tb.tabAt(pos)
        menu = QMenu(self)
        a = menu.addAction("＋ Sinf qo'shish…")
        a.triggered.connect(lambda _=False: self.add_class())
        if 0 <= i < len(self._tab_cls):
            a = menu.addAction(f"✎ «{cls_label(self._tab_cls[i])}» — nomi va fani…")
            a.triggered.connect(lambda _=False, k=i: self.edit_class(k))
            a = menu.addAction(f"− «{cls_label(self._tab_cls[i])}» sinfini olib tashlash…")
            a.triggered.connect(lambda _=False, k=i: self.remove_class(k))
        menu.exec(tb.mapToGlobal(pos))

    def add_class(self):
        cur = self.current_cls()
        dlg = AddClassDialog(self.store, cur, self)
        if not dlg.exec():
            return
        name, subject, studs, source = dlg.values()
        if not name or self.store.has_class(name, subject):
            return
        cls = self.store.add_class(name, studs, source, subject)
        self.store.save()
        self.build_tabs()
        self.select_class(cls)
        self.statusBar().showMessage(f"«{cls_label(cls)}» sinfi qo'shildi: {len(studs)} o'quvchi", 10000)

    def edit_class(self, idx=None):
        cls = self._tab_cls[idx] if idx is not None and 0 <= idx < len(self._tab_cls) else self.current_cls()
        if cls is None:
            return
        dlg = ClassEditDialog(self.store, cls, self)
        if not dlg.exec():
            return
        name, subject = dlg.values()
        self.store.edit_class(cls, name, subject, cls.get("weekdays"))
        self.store.save()
        self.build_tabs()
        self.select_class(cls)
        self.statusBar().showMessage(f"Sinf: «{cls_label(cls)}»", 8000)

    def confirm_remove(self, cls):
        n_marks = sum(len(s["marks"]) for s in cls["students"])
        box = QMessageBox(self)
        box.setIcon(QMessageBox.Icon.Warning)
        box.setWindowTitle("Sinfni olib tashlash")
        box.setText(f"«{cls_label(cls)}» sinfi olib tashlansinmi?")
        box.setInformativeText(f"{len(cls['students'])} o'quvchi, {len(cls['dates'])} sana va "
                               f"{n_marks} ta baho/yo'qlama o'chiriladi.\n"
                               "Oldin ma'lumotlarning zaxira nusxasi saqlanadi.")
        yes = box.addButton("Olib tashlash", QMessageBox.ButtonRole.DestructiveRole)
        no = box.addButton("Bekor qilish", QMessageBox.ButtonRole.RejectRole)
        box.setDefaultButton(no)
        box.setEscapeButton(no)
        box.exec()
        return box.clickedButton() is yes

    def remove_class(self, idx=None):
        idx = self.tabs.currentIndex() if idx is None else idx
        if not 0 <= idx < len(self._tab_cls):
            return
        cls = self._tab_cls[idx]
        n_marks = sum(len(st["marks"]) for st in cls["students"])
        if n_marks and not self.guard.require(
                self, f"«{cls_label(cls)}» sinfidagi {n_marks} ta baho/yo'qlama ham o'chadi."):
            return
        if not self.confirm_remove(cls):
            return
        backup = self.store.backup()
        if n_marks:
            self.store.log_change(cls_label(cls), "(butun sinf)", "", f"{n_marks} ta belgi", "", "del_class")
        self.store.remove_class(cls)
        self.store.save()
        self.build_tabs()
        if self.tabs.count():
            self.tabs.setCurrentIndex(min(idx, self.tabs.count() - 1))
        self.statusBar().showMessage(f"«{cls_label(cls)}» olib tashlandi. Zaxira nusxa: {backup.name}", 20000)
        if not self.store.classes:
            QTimer.singleShot(0, self.empty_start)

    def empty_start(self):
        box = QMessageBox(self)
        box.setWindowTitle("Sinflar yo'q")
        box.setText("Hozircha birorta sinf yo'q.")
        box.setInformativeText("Yangi sinf qo'shing yoki jadval faylidan import qiling.")
        add = box.addButton("＋ Sinf qo'shish", QMessageBox.ButtonRole.AcceptRole)
        imp = box.addButton("Import…", QMessageBox.ButtonRole.ActionRole)
        box.addButton("Yopish", QMessageBox.ButtonRole.RejectRole)
        box.exec()
        if box.clickedButton() is add:
            self.add_class()
        elif box.clickedButton() is imp:
            self.import_file()

    def update_legend(self):
        rs = self.store.ranges()
        parts = []
        for i, r in enumerate(rs):
            lo = r["min"]
            if i + 1 < len(rs):
                nxt = rs[i + 1]["min"]
                hi = nxt - 1 if float(nxt).is_integer() and float(lo).is_integer() else nxt
                txt = f"{lo:g}" if hi == lo else (f"{lo:g}–{hi:g}" if hi > lo else f"{lo:g}+")
                if hi != nxt - 1 and not float(lo).is_integer():
                    txt = f"{lo:g}–&lt;{nxt:g}"
            else:
                txt = f"{lo:g}–10"
            parts.append(f'<span style="background:{r["color"]};color:{contrast(r["color"])};">&nbsp;{txt}&nbsp;</span>')
        att = self.store.data["settings"]["attendance"]
        for k in (*ATT_MARKS, CH_MARK, "x"):
            parts.append(f'<span style="background:{att[k]};color:{contrast(att[k])};">&nbsp;{k.upper()}&nbsp;</span>')
        self.legend.setText("&nbsp;".join(parts))
        self.legend.setToolTip("S — sababsiz · DQ — sababli · K — kasal · KQ — kech qoldi · CH — chet elda · X — dars yo'q")

    def edit_risk(self):
        if RiskDialog(self.store, self).exec():
            self.store.save()
            self.refresh_auto_bar()
            self.statusBar().showMessage("Xavf mezonlari saqlandi", 6000)

    def edit_holidays(self):
        if HolidaysDialog(self.store, self).exec():
            self.store.save()
            self.statusBar().showMessage("Bayram kunlari saqlandi (yangi yaratiladigan oylar uchun amal qiladi)", 8000)

    def edit_ranges(self):
        if RangesDialog(self.store, self).exec():
            for i in range(self.tabs.count()):
                self.tabs.widget(i).repaint_all()
            self.update_legend()

    def import_file(self):
        self.sync_file()

    def emaktab_web(self):
        dlg = EmaktabDialog(self, self.store)
        dlg.exec()
        self.build_tabs()

    def sync_file(self):
        path, _ = QFileDialog.getOpenFileName(
            self, "emaktab: yuklab olingan «Fan jurnali» (.xls/.xlsx/.ods)", str(BASE),
            "Jadval fayllari (*.xls *.xlsx *.ods);;Hammasi (*)")
        if not path:
            return
        def done(imports):
            if not imports:
                QMessageBox.warning(self, "Sinxronlash", "Faylda sinf jurnali topilmadi (emaktab «Fan jurnali» kerak).")
                return
            SyncDialog(self, self.store, imports, Path(path).name).exec()
        run_bg(self, "emaktab fayli", lambda: read_import_file(path), done, "Fayl o'qilmoqda…",
               on_fail=lambda e: show_error(self, "Faylni o'qib bo'lmadi", e, f"«{Path(path).name}» faylini o'qishda xato."))

    # — hisobotlar —
    def show_report(self, cls=None):
        if not self.store.classes:
            return
        ReportDialog(self, cls).exec()

    def show_bsb_analysis(self, cls=None):
        if not self.store.classes:
            return
        BsbDialog(self, cls).exec()

    def export_mobile(self):
        if not self.store.classes:
            return
        folder = self.store.path.parent / "hisobotlar"
        folder.mkdir(exist_ok=True)
        path, _ = QFileDialog.getSaveFileName(self, "Telefon uchun HTML nusxa",
                                              str(folder / f"jurnal_{dt.date.today().isoformat()}.html"), "HTML (*.html)")
        if not path:
            return
        try:
            export_mobile_html(self.store, path)
        except Exception as e:
            show_error(self, "HTML nusxa", e)
            return
        self.statusBar().showMessage(f"Saqlandi: {path}. Faylni telefoningizga yuboring va brauzerda oching (eslatmalar kiritilmagan).", 20000)

    def export_student_sheets(self, cls, names, lo, hi, q=None):
        """Tanlangan o'quvchilar uchun bitta PDF: har bir o'quvchi — alohida sahifa (ota-onalar uchun)."""
        folder = self.store.path.parent / "hisobotlar"
        folder.mkdir(exist_ok=True)
        base = names[0] if len(names) == 1 else f"{cls_label(cls)}_o'quvchilar"
        path, _ = QFileDialog.getSaveFileName(self, "O'quvchi varag'i (PDF)",
                                              str(folder / f"{safe_name(base)}_{lo}_{hi}.pdf"), "PDF (*.pdf)")
        if not path:
            return
        names = sort_pdf_items(names, lambda n: n)
        pages = [student_sheet_html(self.store, cls, n, lo, hi, q, first=(i == 0)) for i, n in enumerate(names)]
        html = "".join(p for p in pages if p)
        run_bg(self, "O'quvchi varaqlari", lambda: write_pdf(path, html, landscape=False),
               lambda _r: self.statusBar().showMessage(f"O'quvchi varag'i saqlandi ({len(pages)} sahifa): {path}", 15000),
               "PDF tayyorlanmoqda…",
               on_fail=lambda e: show_error(self, "O'quvchi varaqlari", e, "PDF faylni saqlab bo'lmadi."))

    # — zaxira va tiklash —
    def backup_now(self):
        try:
            dest = self.store.backup("qolda")
        except OSError as e:
            show_error(self, "Zaxira", e, "Zaxira nusxa olib bo'lmadi.")
            return
        self.statusBar().showMessage(f"Zaxira nusxa saqlandi: zaxira/{dest.name}", 12000)

    def open_backup_dir(self):
        QDesktopServices.openUrl(QUrl.fromLocalFile(str(self.store.backup_dir())))

    def show_restore(self):
        RestoreDialog(self).exec()

    def restore_backup(self, path):
        if not self.guard.require(self, "Zaxiradan tiklash hozirgi barcha baholarni almashtiradi."):
            return False
        box = QMessageBox(self)
        box.setIcon(QMessageBox.Icon.Warning)
        box.setWindowTitle("Zaxiradan tiklash")
        box.setText(f"«{Path(path).name}» nusxasi bilan tiklansinmi?")
        box.setInformativeText("Hozirgi barcha ma'lumotlar shu nusxadagi bilan almashtiriladi. "
                               "Hozirgi holat oldin «tiklashdan oldin» nusxasida saqlanadi.")
        yes = box.addButton("Tiklash", QMessageBox.ButtonRole.DestructiveRole)
        no = box.addButton("Bekor qilish", QMessageBox.ButtonRole.RejectRole)
        box.setDefaultButton(no)
        box.setEscapeButton(no)
        box.exec()
        if box.clickedButton() is not yes:
            return False
        try:
            safety = self.store.restore(path)
        except (OSError, ValueError, KeyError, TypeError) as e:
            QMessageBox.critical(self, "Tiklash xatosi", str(e))
            return False
        self.reload_after_restore()
        self.statusBar().showMessage(f"Tiklandi: {Path(path).name}. Oldingi holat saqlandi: zaxira/{safety.name}", 25000)
        return True

    def reload_after_restore(self):
        st = self.store.data["settings"]
        set_app_style(st.get("style"), self.store.theme())
        if st.get("view_mode") in dict(VIEW_MODES):
            self.view.mode = st["view_mode"]
        self.sync_method_menu()
        if self.store.theme_key() in self.theme_acts:
            self.theme_acts[self.store.theme_key()].setChecked(True)
        self.build_tabs()
        self.sync_nav()
        self.sync_lock()
        self.update_legend()

    def closeEvent(self, e):
        if (not self._quitting and self.tray is not None and self.tray.isVisible()
                and self.store.auto_cfg().get("tray_hide")):
            e.ignore()
            self.hide()
            QApplication.setQuitOnLastWindowClosed(False)
            self.store.save()
            self.notify("Yo'qlama jurnali", "Dastur fonda ishlayapti. Tray belgisini bosib oching; «Chiqish» — to'liq yopadi.")
            return
        if self.tray is not None:
            self.tray.hide()
        try:
            self.store.save()
            self.store.auto_backup()            # yopilganda: ma'lumot o'zgargan bo'lsa zaxira nusxa
            self.store.cloud_sync()
        except OSError as ex:
            print("Yopishda saqlash/nusxalash xatosi:", ex)
        super().closeEvent(e)

    def help(self):
        HelpDialog(self).exec()


def safe_store():
    """Ma'lumot fayli buzilgan bo'lsa — dastur yopilib qolmaydi: buzuq fayl saqlab qo'yiladi, eng yangi zaxira ochiladi."""
    try:
        return Store()
    except Exception as e:  # noqa: BLE001
        log_error(e)
        msg, _h = friendly_error(e)
        broken = DATA_FILE.with_name(f"{DATA_FILE.stem}_buzuq_{dt.datetime.now():%Y%m%d_%H%M%S}.json")
        try:
            if DATA_FILE.exists():
                shutil.copy2(DATA_FILE, broken)
        except OSError:
            pass
        try:
            probe = Store.__new__(Store)
            probe.path = DATA_FILE
            for b in Store.backups(probe):
                try:
                    st = Store.__new__(Store)
                    st.path = DATA_FILE
                    st.data = st._load(b["path"])
                    st.save()
                    QMessageBox.warning(None, "Ma'lumot tiklandi",
                                        f"{msg}\n\nEng yangi zaxira nusxa ochildi ({b['when']:%d.%m.%Y %H:%M}).\n"
                                        f"Buzilgan fayl nusxasi: {broken.name}")
                    return Store()
                except Exception:  # noqa: BLE001
                    continue
        except Exception:  # noqa: BLE001
            pass
        QMessageBox.critical(None, "Ma'lumot fayli ochilmadi",
                             f"{msg}\n\nZaxira nusxa topilmadi. Buzilgan fayl nusxasi: {broken.name}.\nDastur bo'sh jurnal bilan boshlanadi.")
        if DATA_FILE.exists():
            try:
                DATA_FILE.rename(DATA_FILE.with_name(DATA_FILE.name + ".buzuq"))
            except OSError:
                pass
        return Store()


def main():
    app = QApplication(sys.argv)
    install_excepthook()
    store = safe_store()
    set_app_style(store.data["settings"].get("style"), store.theme())
    apply_ui_zoom(store.data["settings"].get("ui_zoom", 0))
    install_emoji_font()
    app._screen_guard = ScreenGuard(app)
    app.installEventFilter(app._screen_guard)
    app.setPalette(make_palette(store.theme()))
    win = MainWindow(store)
    win.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
