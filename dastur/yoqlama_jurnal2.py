"""Yo'qlama jurnali 2.0 — oddiy o'qituvchi uchun soddalashtirilgan ko'rinish.

1-versiya (yoqlama_jurnal.py) bilan bitta papkada turadi va o'sha journal.json faylini ishlatadi:
hisob-kitob, dialoglar, himoya, zaxira va emaktab — hammasi 1-versiyadan olinadi, bu fayl faqat yangi oynani quradi.
Ikkala versiyani navbatma-navbat ochish mumkin (bir vaqtda emas).

Tuzilishi: chapda 4 bo'lim (Bugun, Jurnal, Hisobotlar, Sozlamalar) + «Darsni boshlash» sahifasi;
jurnalda «Oddiy» va «Kompakt» zichlik; birinchi ishga tushirishda 3 qadamli tanishuv.
"""
import copy
import sys
import datetime as dt

import yoqlama_jurnal as v1
from yoqlama_jurnal import *  # noqa: F401,F403
from PySide6.QtCore import QPointF, QRectF
from PySide6.QtGui import QCursor, QFontMetrics, QPen
from PySide6.QtWidgets import QToolButton

APP_TITLE = "Yo'qlama jurnali 2.0"
NAV = (("📅", "Bugun"), ("📒", "Jurnal"), ("📊", "Hisobotlar"), ("⚙", "Sozlamalar"))
P_TODAY, P_JOURNAL, P_REPORTS, P_SETTINGS, P_LESSON = range(5)
MONTHS_GEN = ("yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr")
ATT_OPTS = (("", "Keldi", "#0b6f79"), ("s", "Sababsiz", "#c62828"), ("dq", "Sababli", "#1565c0"),
            ("k", "Kasal", "#7b1fa2"), ("kq", "Kech qoldi", "#6d4c41"))


def v2cfg(store):
    """2-versiyaning o'z sozlamalari (journal.json → "v2"): zichlik, tanishuv o'tilganmi.
    settings ichida emas — 1-versiya faylni o'qiganda notanish sozlamalarni tashlab yuboradi."""
    return store.data.setdefault("v2", {})


def is_compact(store):
    return v2cfg(store).get("density") == "kompakt"


def tok(store):
    """Joriy mavzudan (1-versiya THEMES) 2-versiya ranglari."""
    t = store.theme()
    acc = t.get("highlight", "#0b6f79")
    return {"win": t.get("window", "#eef4f4"), "base": t.get("base", "#ffffff"), "text": t.get("text", "#12303a"),
            "muted": t.get("muted", "#5d7a82"), "acc": acc, "acc_fg": t.get("highlight_text", "#ffffff"),
            "acc_d": QColor(acc).darker(118).name(), "line": t.get("line", "#d7e5e7"),
            "soft": t.get("line_soft", t.get("alt", "#e3eff0")), "alt": t.get("alt", "#f3fafa")}


def tint_icon(ch, px, normal, checked=None):
    """1-versiyaning chizilgan ikonkasi, kerakli rangda (tanlangan holat uchun alohida rang)."""
    v1.vec_icon(ch, px)                                    # jadvalni to'ldirish uchun
    fn = v1._VEC_TABLE.get(ch)
    if fn is None:
        return QIcon()
    ic = QIcon()
    for color, state in ((normal, QIcon.State.Off), (checked or normal, QIcon.State.On)):
        pm = QPixmap(px * 2, px * 2)
        pm.fill(Qt.GlobalColor.transparent)
        pm.setDevicePixelRatio(2.0)
        p = QPainter(pm)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        p.scale(px / 24.0, px / 24.0)
        try:
            fn(p, QColor(color))
        finally:
            p.end()
        ic.addPixmap(pm, QIcon.Mode.Normal, state)
    return ic


def qss(store):
    k = tok(store)
    k.update(r10=S(10), r14=S(14), h1=S(26), h2=S(18), big=S(22))
    return """
QWidget#v2root, QWidget#v2page, QScrollArea#v2scroll, QWidget#v2scrollin {background:%(win)s;}
QFrame#v2side {background:%(base)s; border:none; border-right:1px solid %(line)s;}
QLabel#v2logo {background:%(acc)s; color:%(acc_fg)s; border-radius:%(r10)spx; font-weight:800;}
QPushButton[v2="nav"] {text-align:left; padding:%(r10)spx 14px; border:none; border-radius:%(r10)spx; color:%(text)s;
                        background:transparent; font-weight:600;}
QPushButton[v2="nav"]:hover {background:%(soft)s;}
QPushButton[v2="nav"]:checked {background:%(acc)s; color:%(acc_fg)s;}
QPushButton[v2="pri"] {background:%(acc)s; color:%(acc_fg)s; border:1px solid %(acc)s; border-radius:%(r10)spx;
                        padding:8px 18px; font-weight:700;}
QPushButton[v2="pri"]:hover {background:%(acc_d)s;}
QPushButton[v2="pri"]:disabled {background:%(soft)s; border-color:%(line)s; color:%(muted)s;}
QPushButton[v2="sec"], QToolButton[v2="sec"] {background:%(base)s; color:%(text)s; border:1px solid %(line)s;
                        border-radius:%(r10)spx; padding:7px 16px; font-weight:600;}
QPushButton[v2="sec"]:hover, QToolButton[v2="sec"]:hover {background:%(soft)s;}
QToolButton[v2="sec"]::menu-indicator {image:none; width:0;}
QPushButton[v2="link"] {background:transparent; border:none; color:%(acc)s; font-weight:700; padding:4px 6px;}
QPushButton[v2="link"]:hover {text-decoration:underline;}
QPushButton[v2="chip"] {border:1px solid %(line)s; border-radius:16px; padding:6px 14px; background:%(base)s;
                        color:%(text)s; font-weight:600;}
QPushButton[v2="chip"]:hover {background:%(soft)s;}
QPushButton[v2="chip"]:checked {background:%(acc)s; border-color:%(acc)s; color:%(acc_fg)s;}
QPushButton[v2="seg"] {border:1px solid %(line)s; border-radius:8px; padding:6px 12px; background:%(base)s;
                        color:%(text)s; font-weight:600;}
QPushButton[v2="seg"]:hover {background:%(soft)s;}
QPushButton[v2="seg"]:checked {background:%(acc)s; border-color:%(acc)s; color:%(acc_fg)s;}
QPushButton[v2="step"] {border:none; border-radius:14px; padding:6px 14px; background:%(soft)s; color:%(muted)s; font-weight:700;}
QPushButton[v2="step"]:checked {background:%(acc)s; color:%(acc_fg)s;}
QFrame#tile {background:%(base)s; border:1px solid %(line)s; border-radius:%(r14)spx;}
QFrame#tile:hover {border-color:%(acc)s; background:%(alt)s;}
QPushButton[v2="opt"] {text-align:left; background:%(base)s; color:%(text)s; border:2px solid %(line)s;
                        border-radius:%(r14)spx; padding:14px 16px;}
QPushButton[v2="opt"]:hover {border-color:%(acc)s;}
QPushButton[v2="opt"]:checked {border-color:%(acc)s; background:%(alt)s;}
QPushButton[v2="side"] {text-align:left; background:transparent; color:%(text)s; border:none; border-radius:%(r10)spx;
                        padding:%(r10)spx 14px; font-weight:600;}
QPushButton[v2="side"]:hover {background:%(soft)s;}
QPushButton[v2="side"]:checked {background:%(soft)s; color:%(text)s;}
QFrame#card {background:%(base)s; border:1px solid %(line)s; border-radius:%(r14)spx;}
QFrame#hot {background:%(base)s; border:2px solid %(acc)s; border-radius:%(r14)spx;}
QFrame#row {background:transparent; border:none; border-top:1px solid %(soft)s;}
QLabel[v2="h1"] {font-size:%(h1)spx; font-weight:800; color:%(text)s;}
QLabel[v2="h2"] {font-size:%(h2)spx; font-weight:800; color:%(text)s;}
QLabel[v2="big"] {font-size:%(big)spx; font-weight:800; color:%(text)s;}
QLabel[v2="b"] {font-weight:700; color:%(text)s;}
QLabel[v2="muted"] {color:%(muted)s;}
QLabel[v2="tag"] {color:%(acc)s; font-weight:800; letter-spacing:1px;}
QLabel[v2="avatar"] {background:%(soft)s; color:%(acc)s; border-radius:%(r14)spx; font-weight:800;}
QLabel[v2="ok"] {color:#2e7d32; font-weight:700;}
QLabel[v2="warn"] {color:#c62828; font-weight:700;}
QLineEdit[v2="in"] {background:%(base)s; border:1px solid %(line)s; border-radius:%(r10)spx; padding:8px 12px; color:%(text)s;}
QLineEdit[v2="in"]:focus {border-color:%(acc)s;}
""" % k


def btn(text, kind="sec", slot=None, tip=None, checkable=False):
    b = QPushButton(text)
    b.setProperty("v2", kind)
    b.setCursor(Qt.CursorShape.PointingHandCursor)
    b.setCheckable(checkable)
    if tip:
        b.setToolTip(tip)
    if slot is not None:
        b.clicked.connect(lambda _=False, f=slot: f())
    return b


def lbl(text="", kind=None, wrap=False):
    w = QLabel(text)
    if kind:
        w.setProperty("v2", kind)
    w.setWordWrap(wrap)
    return w


def card(name="card"):
    f = QFrame()
    f.setObjectName(name)
    return f


def clear_layout(lay):
    while lay.count():
        it = lay.takeAt(0)
        w = it.widget()
        if w is not None:
            w.hide()
            w.deleteLater()
        elif it.layout() is not None:
            clear_layout(it.layout())


def scroll_page(inner_layout_cls=QVBoxLayout):
    """Sahifa: aylantiriladigan maydon + ichki tartib. (scroll, layout) qaytaradi."""
    sc = QScrollArea()
    sc.setObjectName("v2scroll")
    sc.setWidgetResizable(True)
    sc.setFrameShape(QFrame.Shape.NoFrame)
    inner = QWidget()
    inner.setObjectName("v2scrollin")
    lay = inner_layout_cls(inner)
    lay.setContentsMargins(S(32), S(26), S(32), S(26))
    lay.setSpacing(S(18))
    sc.setWidget(inner)
    return sc, lay


def long_date(d):
    return f"{WEEKDAYS_FULL[d.weekday()]}, {d.day}-{MONTHS_GEN[d.month - 1]}"


def initials(name):
    parts = [p for p in name.split() if p[:1].isalpha()]
    return "".join(p[0].upper() for p in parts[:2]) or "?"


# ───────────────────────── jurnal jadvali (1-versiyadan, ixchamlashtirilgan) ─────────────────────────
class CellDelegate(MarkDelegate):
    """Dizayndagi katak: oraliqli, yumaloq burchakli rangli tugma; joriy katak — ko'k halqa."""

    def __init__(self, table, view):
        super().__init__(table, view)
        self.cv = view

    def paint(self, p, opt, idx):
        cv, k = self.cv, tok(self.cv.store)
        nd, col = len(cv.dates), idx.column()
        p.save()
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        text = idx.data(Qt.ItemDataRole.DisplayRole) or ""
        font = idx.data(Qt.ItemDataRole.FontRole) or opt.font
        if nd <= col < nd + cv.NSUM:                   # O'rt. / Dav. — oddiy qalin matn
            f = QFont(opt.font)
            f.setBold(True)
            f.setPointSizeF(opt.font.pointSizeF() * (0.95 if cv.compact else 1.05))
            p.setFont(f)
            p.setPen(QColor(k["text"] if col == nd else k["muted"]))
            p.drawText(opt.rect, Qt.AlignmentFlag.AlignCenter, text)
            p.restore()
            return
        g = S(1.5) if cv.compact else S(2.5)
        r = QRectF(opt.rect).adjusted(g, g, -g, -g)
        rad = S(4) if cv.compact else S(7)
        br = idx.data(Qt.ItemDataRole.BackgroundRole)
        bg = br.color() if isinstance(br, QBrush) and br.style() != Qt.BrushStyle.NoBrush else QColor(k["alt"])
        p.setPen(Qt.PenStyle.NoPen)
        p.setBrush(bg)
        p.drawRoundedRect(r, rad, rad)
        if opt.state & QStyle.StateFlag.State_Selected:
            sel = QColor(k["acc"])
            sel.setAlpha(45)
            p.setBrush(sel)
            p.drawRoundedRect(r, rad, rad)
        if idx == cv.table.currentIndex():
            pen = QPen(QColor(k["acc"]))
            pen.setWidthF(S(2.5) if not cv.compact else S(2))
            p.setPen(pen)
            p.setBrush(Qt.BrushStyle.NoBrush)
            p.drawRoundedRect(r.adjusted(1, 1, -1, -1), rad, rad)
        fr = idx.data(Qt.ItemDataRole.ForegroundRole)
        p.setPen(fr.color() if isinstance(fr, QBrush) and fr.style() != Qt.BrushStyle.NoBrush else QColor(k["text"]))
        p.setFont(font)
        p.drawText(r, Qt.AlignmentFlag.AlignCenter, text)
        p.restore()


class DateHeader(QHeaderView):
    """Ustun sarlavhasi: kun raqami va hafta kuni; bugun — sariq «tabletka», dars yo'q kun — xira."""

    def __init__(self, cv):
        super().__init__(Qt.Orientation.Horizontal)
        self.cv = cv
        self.setSectionsClickable(True)
        self.setHighlightSections(False)

    def paintSection(self, p, rect, i):
        cv, k = self.cv, tok(self.cv.store)
        p.save()
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        p.fillRect(rect, QColor(k["base"]))
        nd = len(cv.dates)
        f = QFont(self.font())
        f.setBold(True)
        di = cv.date_idx(i) if i == cv.ball_col() else (i if i < nd else -1)
        if di < 0:
            p.setFont(f)
            p.setPen(QColor(k["muted"]))
            name = {nd: "O'rt.", nd + 1: "Dav."}.get(i, "")
            p.drawText(rect, Qt.AlignmentFlag.AlignCenter, name)
            p.restore()
            return
        d = dt.date.fromisoformat(cv.dates[di])
        mode = cv.view.mode
        nl = cv.store.is_nolesson(cv.cls, cv.dates[di])
        if i == cv.ball_col():
            top, sub = "Ball", ""
        elif mode == "day":
            top, sub = f"{d.day}-{MONTHS_GEN[d.month - 1]}", "Davomat"
        elif mode == "week":
            top, sub = f"{d.day:02d}.{d.month:02d}", WEEKDAYS_FULL[d.weekday()]
        else:
            top = str(d.day)
            prev = cv.dates[di - 1] if di > 0 else None
            sub = (MONTHS_GEN[d.month - 1][:3] if mode == "quarter" and (prev is None or prev[5:7] != cv.dates[di][5:7])
                   else WEEKDAYS[d.weekday()])
            if nl:
                sub = "X"
        r = QRectF(rect).adjusted(S(2), S(4), -S(2), -S(4))
        today = d == cv.today and i != cv.ball_col()
        if today:
            p.setPen(Qt.PenStyle.NoPen)
            p.setBrush(QColor("#ffd35c"))
            p.drawRoundedRect(r, S(8), S(8))
        fg = QColor("#12303a") if today else QColor(k["muted"] if nl or d > cv.today else k["text"])
        p.setPen(fg)
        f.setPointSizeF(self.font().pointSizeF() * (0.95 if cv.compact else 1.05))
        p.setFont(f)
        top_r = QRectF(r.x(), r.y(), r.width(), r.height() * 0.55)
        p.drawText(top_r, Qt.AlignmentFlag.AlignHCenter | Qt.AlignmentFlag.AlignBottom, top)
        f2 = QFont(self.font())
        f2.setPointSizeF(self.font().pointSizeF() * 0.78)
        f2.setBold(sub == "X" or (mode == "quarter" and not sub[:1].isupper()))
        p.setFont(f2)
        if not today:
            p.setPen(QColor(k["acc"]) if (mode == "quarter" and sub[:1].islower()) else QColor(k["muted"]))
        p.drawText(QRectF(r.x(), r.y() + r.height() * 0.55, r.width(), r.height() * 0.45),
                   Qt.AlignmentFlag.AlignHCenter | Qt.AlignmentFlag.AlignTop, sub)
        if cv.cls.get("lessons", {}).get(cv.dates[di]) and not today:     # mavzu kiritilgan dars — kichik nuqta
            p.setPen(Qt.PenStyle.NoPen)
            p.setBrush(QColor(k["acc"]))
            p.drawEllipse(QPointF(r.right() - S(4), r.top() + S(4)), S(2), S(2))
        p.restore()


class NameHeader(QHeaderView):
    """Qator sarlavhasi: tartib raqami, o'quvchi ismi va «xavf» belgisi."""

    def __init__(self, cv):
        super().__init__(Qt.Orientation.Vertical)
        self.cv = cv
        self.setSectionsClickable(True)
        self.setHighlightSections(False)

    def paintSection(self, p, rect, i):
        cv, k = self.cv, tok(self.cv.store)
        if not 0 <= i < len(cv.students):
            return
        s = cv.students[i]
        p.save()
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        p.fillRect(rect, QColor(k["base"]))
        cur = cv.table.currentRow() == i
        if cur:
            hl = QColor(k["acc"])
            hl.setAlpha(28)
            p.setPen(Qt.PenStyle.NoPen)
            p.setBrush(hl)
            p.drawRoundedRect(QRectF(rect).adjusted(S(2), S(2), -S(2), -S(2)), S(7), S(7))
        pad = S(8)
        nw = S(26)
        p.setFont(self.font())
        p.setPen(QColor(k["muted"]))
        p.drawText(QRectF(rect.x() + pad, rect.y(), nw, rect.height()), Qt.AlignmentFlag.AlignVCenter, str(i + 1))
        f = QFont(self.font())
        f.setBold(True)
        p.setFont(f)
        p.setPen(QColor(k["text"]))
        name = ("⭐ " if s.get("star") else "") + s["name"]
        x = rect.x() + pad + nw
        risk = s["name"] in cv.risk_names
        badge_w = S(40) if risk else 0
        avail = rect.right() - x - pad - badge_w
        fm = QFontMetrics(f)
        name = fm.elidedText(name, Qt.TextElideMode.ElideRight, int(avail))
        p.drawText(QRectF(x, rect.y(), avail, rect.height()), Qt.AlignmentFlag.AlignVCenter, name)
        if risk:
            f3 = QFont(self.font())
            f3.setBold(True)
            f3.setPointSizeF(self.font().pointSizeF() * 0.75)
            p.setFont(f3)
            bx = x + fm.horizontalAdvance(name) + S(8)
            br = QRectF(bx, rect.center().y() - S(8), S(34), S(16))
            p.setPen(Qt.PenStyle.NoPen)
            p.setBrush(QColor("#fde8e6"))
            p.drawRoundedRect(br, S(8), S(8))
            p.setPen(QColor("#b42318"))
            p.drawText(br, Qt.AlignmentFlag.AlignCenter, "xavf")
            p.setFont(f)
        p.restore()


class ClassView2(ClassView):
    """1-versiya jurnali, 2-versiya ko'rinishida: yumaloq rangli kataklar, «№ · O'quvchi · sanalar · O'rt. · Dav.» ustunlari,
    yuqoridagi tugmalar qatori yashirilgan (amallar 2-versiya sarlavhasida), belgi tugmalari pastda;
    «Kompakt» rejimda kataklar kichik — butun chorak bitta ekranda."""

    def __init__(self, store, cls, view, guard, compact=False):
        self.compact = compact
        self.risk_names = set()
        super().__init__(store, cls, view, guard)
        lay = self.stack.widget(0).layout()
        top = lay.itemAt(0).widget()
        if top is not None:
            top.hide()
        lay.removeWidget(self.marks_box)
        lay.addWidget(self.marks_box)
        self.marks_box.setVisible(True)
        self.marks_box.setObjectName("v2marks")
        for _val, b in self.quick + [(None, self.btn2)]:
            b.setMinimumSize(S(30 if compact else 36), S(26 if compact else 36))
        for w in (self.info_stud, self.info_date):
            w.setVisible(not compact)
        self.restyle_table()
        r = max(self.table.currentRow(), 0)
        self.rebuild()
        self.select_default(r)

    def restyle_table(self):
        t, k = self.table, tok(self.store)
        t.setItemDelegate(CellDelegate(t, self))
        t.setShowGrid(False)
        t.setHorizontalScrollMode(QAbstractItemView.ScrollMode.ScrollPerPixel)
        t.setVerticalScrollMode(QAbstractItemView.ScrollMode.ScrollPerPixel)
        hh = DateHeader(self)
        t.setHorizontalHeader(hh)
        hh.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        hh.customContextMenuRequested.connect(self.header_menu)
        hh.sectionDoubleClicked.connect(lambda c: self.edit_lesson(c))
        hh.setFixedHeight(S(38) if self.compact else S(50))
        vh = NameHeader(self)
        t.setVerticalHeader(vh)
        vh.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        vh.customContextMenuRequested.connect(self.row_menu)
        vh.setSectionResizeMode(QHeaderView.ResizeMode.Fixed)
        t.setStyleSheet(
            "QTableWidget{background:%(base)s;border:1px solid %(line)s;border-radius:%(r)spx;padding:%(p)spx;"
            "selection-background-color:transparent;selection-color:%(text)s;}"
            "QTableCornerButton::section{background:%(base)s;border:none;}" % dict(k, r=S(14), p=S(6)))
        t.currentCellChanged.connect(lambda *_a: t.verticalHeader().viewport().update())

    def on_marks_toggled(self, on, save=True):          # 2-versiyada belgi qatori doim ko'rinadi
        self.marks_box.setVisible(True)

    def cell_pt(self):
        return 9 if self.compact else {"day": 16, "week": 13}.get(self.view.mode, 12)

    def rebuild(self):
        lo, hi, q = self.store.period_now()
        try:
            rows, _n, _d = self.store.report_rows(self.cls, lo, hi, q)
            self.risk_names = {r["name"] for r in rows if any(not w.startswith("baholar soni") for w in r["why"])}
        except Exception:  # noqa: BLE001
            self.risk_names = set()
        super().rebuild()
        t = self.table
        rh = S(24) if self.compact else S(42 if self.view.mode == "day" else 40)
        for r in range(t.rowCount()):
            t.setRowHeight(r, rh)
        if isinstance(t.verticalHeader(), NameHeader):
            fm = QFontMetrics(t.verticalHeader().font())
            w = max([fm.horizontalAdvance(("⭐ " if s.get("star") else "") + s["name"]) for s in self.students] or [100])
            t.verticalHeader().setFixedWidth(int(w * 1.12) + S(26 + 16 + 46))

    def apply_columns(self):
        super().apply_columns()
        t, nd = self.table, len(self.dates)
        width = {"day": 160, "week": 96}.get(self.view.mode, 30 if self.compact else 40)
        for c in self.vis_cols():
            t.setColumnWidth(c, S(width))
        if self.day_mode() and self.vis_cols():
            t.setColumnWidth(self.ball_col(), S(width))
        t.setColumnWidth(nd, S(48 if self.compact else 54))
        t.setColumnWidth(nd + 1, S(48 if self.compact else 54))
        for k in range(2, self.NSUM):                       # S / DQ / K / KQ ustunlari o'rniga — «Dav.» (davomat foizi)
            t.setColumnHidden(nd + k, True)

    def update_summary(self, r):
        super().update_summary(r)
        nd, marks = len(self.dates), self.students[r]["marks"]
        iso = self.today.isoformat()
        ds = [d for d in self.vis_dates() if d <= iso and not self.store.is_nolesson(self.cls, d)]
        miss = sum(1 for d in ds if att_part(marks.get(d, "")) in ("s", "dq", "k"))
        it = self.table.item(r, nd + 1)
        if it is not None:
            it.setText(f"{round(100 * (len(ds) - miss) / len(ds))}%" if ds else "—")

    def put_today(self, r, new):
        """Bugungi katakka aniq belgi (himoya va tarix qoidalari bilan). True — o'zgardi."""
        c = self.today_col()
        if c < 0 or not 0 <= r < len(self.students) or self.store.is_nolesson(self.cls, self.dates[c]):
            return False
        old = self.students[r]["marks"].get(self.dates[c], "")
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


# ───────────────────────── 1. Bugun ─────────────────────────
class TodayPage(QWidget):
    def __init__(self, win):
        super().__init__()
        self.win = win
        self.setObjectName("v2page")
        outer = QVBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)
        sc, self.lay = scroll_page()
        outer.addWidget(sc)

    def refresh(self):
        win, st, lay = self.win, self.win.store, self.lay
        clear_layout(lay)
        today = dt.date.today()
        iso = today.isoformat()
        # sarlavha
        head = QHBoxLayout()
        left = QVBoxLayout()
        left.setSpacing(S(4))
        q = st.quarter_of(iso)
        sub = long_date(today)
        if q:
            q0 = dt.date.fromisoformat(st.quarter_range(q)[0])
            sub += f" · {q}-chorak, {(today - q0).days // 7 + 1}-hafta"
        left.addWidget(lbl(sub, "muted"))
        lessons = st.lessons_today() if st.classes else []
        h = dt.datetime.now().hour
        hello = "Xayrli tong!" if h < 11 else "Xayrli kun!" if h < 17 else "Xayrli kech!"
        left.addWidget(lbl(f"{hello} Bugun {len(lessons)} ta darsingiz bor" if lessons else
                           (f"{hello} Bugun darsingiz yo'q" if st.classes else "Xush kelibsiz!"), "h1", True))
        head.addLayout(left, 1)
        find = QLineEdit()
        find.setProperty("v2", "in")
        find.setPlaceholderText("🔍  O'quvchi yoki sinfni qidirish")
        find.setMinimumWidth(S(280))
        find.returnPressed.connect(lambda: self.find(find.text()))
        head.addWidget(find, 0, Qt.AlignmentFlag.AlignBottom)
        lay.addLayout(head)

        if not st.classes:
            c = card()
            cl = QVBoxLayout(c)
            cl.setContentsMargins(S(22), S(20), S(22), S(20))
            cl.addWidget(lbl("Hozircha birorta sinf yo'q", "h2"))
            cl.addWidget(lbl("Sinflarni emaktabdan olish, fayldan import qilish yoki qo'lda qo'shish mumkin.", "muted", True))
            row = QHBoxLayout()
            row.addWidget(btn("Boshlash", "pri", win.empty_start))
            row.addStretch()
            cl.addLayout(row)
            lay.addWidget(c)
            lay.addStretch()
            return

        nowd = [c for c in st.classes if not c.get("weekdays")]
        if nowd:
            c = card("hot")
            cl = QHBoxLayout(c)
            cl.setContentsMargins(S(18), S(12), S(12), S(12))
            cl.addWidget(lbl(f"📆 {len(nowd)} ta sinf uchun dars kunlari belgilanmagan — shuning uchun «Bugun» ro'yxati "
                             "to'liq bo'lmasligi mumkin.", None, True), 1)
            cl.addWidget(btn("Dars kunlarini belgilash", "sec", lambda: (WeekdaysDialog(win).exec(), win.after_settings())))
            lay.addWidget(c)

        # bugungi darslar
        flow = FlowLayout(hspacing=S(16), vspacing=S(16))
        for cls, done in lessons:
            flow.addWidget(self.lesson_card(cls, done, iso))
        if not lessons:
            c = card()
            c.setMinimumWidth(S(300))
            cl = QVBoxLayout(c)
            cl.setContentsMargins(S(20), S(18), S(20), S(18))
            cl.addWidget(lbl("Bugun jadvalda dars yo'q", "b"))
            cl.addWidget(lbl("Kerak bo'lsa, istalgan sinf jurnalini ochib, baho qo'yishingiz mumkin.", "muted", True))
            r = QHBoxLayout()
            r.addWidget(btn("Jurnalni ochish", "sec", lambda: win.go(P_JOURNAL)))
            r.addStretch()
            cl.addLayout(r)
            flow.addWidget(c)
        lay.addWidget(FlowBox(flow))

        # pastki qator: e'tibor talab qiladi + yaqin kunlar + tezkor amallar
        bottom = QHBoxLayout()
        bottom.setSpacing(S(18))
        bottom.addWidget(self.risk_card(), 3, Qt.AlignmentFlag.AlignTop)
        right = QVBoxLayout()
        right.setSpacing(S(18))
        right.addWidget(self.upcoming_card())
        right.addWidget(self.quick_card())
        right.addStretch()
        bottom.addLayout(right, 2)
        lay.addLayout(bottom)
        lay.addStretch()

    def lesson_card(self, cls, done, iso):
        win = self.win
        c = card("card" if done else "hot")
        c.setFixedWidth(S(320))
        cl = QVBoxLayout(c)
        cl.setContentsMargins(S(20), S(16), S(20), S(18))
        cl.setSpacing(S(6))
        top = QHBoxLayout()
        top.addWidget(lbl("BUGUN", "tag"))
        top.addStretch()
        n_marks = sum(1 for s in cls["students"] if s["marks"].get(iso))
        top.addWidget(lbl(f"Yo'qlama ✓ · {n_marks} belgi" if done else "Yo'qlama qilinmagan", "ok" if done else "warn"))
        cl.addLayout(top)
        cl.addWidget(lbl(cls["name"], "big"))
        subj = cls.get("subject") or "Fan ko'rsatilmagan"
        cl.addWidget(lbl(f"{subj} · {len(cls['students'])} o'quvchi", "muted"))
        topic = cls.get("lessons", {}).get(iso, {}).get("topic", "")
        works = [w for w in cls.get("works", []) if w["date"] == iso]
        if works:
            w = works[0]
            note = f"Bugun {w['type'].upper()}" + (f" ({w['max']} ball)" if w.get("max") else "") + " — natijalarni kiritish"
        else:
            note = f"Mavzu: {topic}" if topic else "Mavzu kiritilmagan"
        cl.addWidget(lbl(note, None, True))
        cl.addStretch()
        if done:
            cl.addWidget(btn("Jurnalni ochish", "sec", lambda c_=cls: win.open_journal(c_)))
        else:
            cl.addWidget(btn("▶  Darsni boshlash", "pri", lambda c_=cls: win.start_lesson(c_)))
        return c

    def risk_card(self):
        win, st = self.win, self.win.store
        risk = st.risk_overview()
        items = [(r["cls"], name, why) for r in risk for name, why in r["names"]]
        c = card()
        cl = QVBoxLayout(c)
        cl.setContentsMargins(S(22), S(18), S(22), S(14))
        cl.setSpacing(S(4))
        hd = QHBoxLayout()
        hd.addWidget(lbl(f"E'tibor talab qiladi — {len(items)} o'quvchi" if items else "E'tibor talab qiladi", "h2"), 1)
        if items:
            hd.addWidget(btn("Hammasi", "link", lambda: win.show_risk_all()))
        cl.addLayout(hd)
        if not items:
            cl.addWidget(lbl("Hozircha hamma o'quvchi me'yorda — xavf ostida hech kim yo'q. 👍", "muted", True))
            return c
        for cls, name, why in items[:6]:
            row = card("row")
            rl = QHBoxLayout(row)
            rl.setContentsMargins(0, S(10), 0, S(6))
            av = lbl(initials(name), "avatar")
            av.setFixedSize(S(38), S(38))
            av.setAlignment(Qt.AlignmentFlag.AlignCenter)
            rl.addWidget(av)
            tx = QVBoxLayout()
            tx.setSpacing(0)
            t1 = QLabel(f"<b>{esc(name)}</b> <span style='color:gray'>· {esc(cls_label(cls))}</span>")
            tx.addWidget(t1)
            tx.addWidget(lbl(why.split(";")[0], "muted", True))
            rl.addLayout(tx, 1)
            rl.addWidget(btn("Ko'rish", "sec", lambda c_=cls, n=name: StudentCardDialog(win, st, c_, n).exec()))
            cl.addWidget(row)
        if len(items) > 6:
            cl.addWidget(lbl(f"va yana {len(items) - 6} ta — «Hammasi» tugmasini bosing", "muted"))
        return c

    def upcoming_card(self):
        st = self.win.store
        c = card()
        cl = QVBoxLayout(c)
        cl.setContentsMargins(S(22), S(18), S(22), S(18))
        cl.setSpacing(S(8))
        cl.addWidget(lbl("Yaqin kunlarda", "h2"))
        ups = st.upcoming(days=7)
        if not ups:
            cl.addWidget(lbl("Yaqin bir haftada summativ ish yoki chorak yakuni yo'q.", "muted", True))
        for u in ups[:6]:
            cl.addWidget(lbl("• " + u, None, True))
        return c

    def quick_card(self):
        win = self.win
        c = card()
        cl = QVBoxLayout(c)
        cl.setContentsMargins(S(22), S(18), S(22), S(18))
        cl.setSpacing(S(8))
        cl.addWidget(lbl("Tezkor amallar", "h2"))
        cl.addWidget(btn("📄  Sinf hisoboti (PDF)", "sec", lambda: win.show_report(win.current_cls())))
        cl.addWidget(btn("🌐  emaktabdan yangilash", "sec", win.emaktab_web))
        cl.addWidget(btn("🖨  Bo'sh yo'qlama varag'ini chop etish", "sec", lambda: BlankSheetDialog(win).exec()))
        return c

    def find(self, text):
        win = self.win
        text = text.strip().lower()
        if text:
            for cls in win._tab_cls:                     # sinf nomi yozilgan bo'lsa — o'sha jurnalni ochamiz
                if text in (cls_label(cls).lower(), cls["name"].lower()):
                    win.open_journal(cls)
                    return
        d = FindDialog(win)
        d.e.setText(text)
        d.exec()


# ───────────────────────── 3. Darsni boshlash ─────────────────────────
class LessonPage(QWidget):
    """Dars oqimi: 1 · Yo'qlama → 2 · Baholar → 3 · Mavzu va uy vazifasi. Har bosish darhol saqlanadi."""

    def __init__(self, win):
        super().__init__()
        self.win, self.cls = win, None
        self.setObjectName("v2page")
        self.setFocusPolicy(Qt.FocusPolicy.StrongFocus)
        root = QVBoxLayout(self)
        root.setContentsMargins(S(32), S(20), S(32), S(20))
        root.setSpacing(S(14))
        head = QHBoxLayout()
        head.addWidget(btn("‹ Chiqish", "sec", self.leave))
        tl = QVBoxLayout()
        tl.setSpacing(0)
        self.t_cls = lbl("", "h2")
        self.t_sub = lbl("", "muted")
        tl.addWidget(self.t_cls)
        tl.addWidget(self.t_sub)
        head.addSpacing(S(10))
        head.addLayout(tl, 1)
        self.steps = []
        grp = QButtonGroup(self)
        for i, name in enumerate(("1 · Yo'qlama", "2 · Baholar", "3 · Mavzu va uy vazifasi")):
            b = btn(name, "step", lambda k=i: self.set_step(k), checkable=True)
            grp.addButton(b)
            head.addWidget(b)
            self.steps.append(b)
        root.addLayout(head)
        self.stack = QStackedWidget()
        root.addWidget(self.stack, 1)
        self.stack.addWidget(self.build_att())
        self.stack.addWidget(self.build_grades())
        self.stack.addWidget(self.build_topic())
        foot = QHBoxLayout()
        self.summary = lbl("", "muted")
        foot.addWidget(self.summary, 1)
        self.back_b = btn("‹ Orqaga", "sec", lambda: self.set_step(self.stack.currentIndex() - 1))
        self.next_b = btn("", "pri", self.next_step)
        foot.addWidget(self.back_b)
        foot.addWidget(self.next_b)
        root.addLayout(foot)

    # — qurish —
    def build_att(self):
        w = QWidget()
        lay = QVBoxLayout(w)
        lay.setContentsMargins(0, 0, 0, 0)
        hd = QHBoxLayout()
        self.att_title = lbl("", "h1")
        hd.addWidget(self.att_title, 1)
        hd.addWidget(btn("Hammasi keldi", "sec", self.all_in,
                         "Sababsiz/sababli/kasal belgilarini tozalaydi — baholar saqlanadi"))
        lay.addLayout(hd)
        lay.addWidget(lbl("Belgilanmagan o'quvchi darsda bo'lgan hisoblanadi. Faqat kelmaganlarni bosing — bitta bosish yetarli. "
                          "Klaviatura: ↑↓ o'quvchi, S sababsiz, D sababli, K kasal, Q kech qoldi, Space keldi.", "muted", True))
        sc, self.att_lay = scroll_page()
        self.att_lay.setContentsMargins(0, S(6), 0, S(6))
        self.att_lay.setSpacing(0)
        lay.addWidget(sc, 1)
        return w

    def build_grades(self):
        w = QWidget()
        lay = QVBoxLayout(w)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.addWidget(lbl("Baholar (ixtiyoriy)", "h1"))
        lay.addWidget(lbl("Kimdan so'ragan bo'lsangiz — bahosini bosing. Qayta bosilsa o'chadi. Kelmaganlar ro'yxatda xira.",
                          "muted", True))
        sc, self.gr_lay = scroll_page()
        self.gr_lay.setContentsMargins(0, S(6), 0, S(6))
        self.gr_lay.setSpacing(0)
        lay.addWidget(sc, 1)
        return w

    def build_topic(self):
        w = QWidget()
        lay = QVBoxLayout(w)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(S(12))
        lay.addWidget(lbl("Mavzu va uy vazifasi", "h1"))
        lay.addWidget(lbl("Kalendar-tematik reja (KTR) bo'lsa, mavzu o'zi to'ldiriladi — kerak bo'lsa o'zgartiring.", "muted", True))
        c = card()
        f = QFormLayout(c)
        f.setContentsMargins(S(22), S(18), S(22), S(18))
        f.setVerticalSpacing(S(12))
        self.topic = QLineEdit()
        self.topic.setProperty("v2", "in")
        self.topic.setPlaceholderText("Bugungi dars mavzusi")
        self.hw = QLineEdit()
        self.hw.setProperty("v2", "in")
        self.hw.setPlaceholderText("Masalan: 45-bet, 3–5-mashqlar")
        f.addRow(lbl("Mavzu", "b"), self.topic)
        f.addRow(lbl("Uy vazifasi", "b"), self.hw)
        lay.addWidget(c)
        lay.addStretch()
        return w

    # — ochish —
    @property
    def cv(self):
        """Sinf jurnali har safar qaytadan topiladi: jurnallar qayta qurilsa (sana almashsa va h.k.) eski vidjet o'chadi."""
        return self.win.view_for(self.cls) if self.cls is not None else None

    @property
    def c(self):
        cv = self.cv
        return cv.today_col() if cv is not None else -1

    def open(self, cv):
        self.cls = cv.cls
        cls, iso = cv.cls, cv.dates[self.c]
        les = cls.get("lessons", {}).get(iso, {})
        self.t_cls.setText(cls_label(cls))
        self.t_sub.setText(long_date(dt.date.fromisoformat(iso)) + (f" · {les['topic']}" if les.get("topic") else ""))
        self._les0 = (les.get("topic", ""), les.get("hw", ""))
        self.topic.setText(self._les0[0])
        self.hw.setText(self._les0[1])
        self.fill_att()
        self.fill_grades()
        self.set_step(0)

    def mark(self, r):
        return self.cv.students[r]["marks"].get(self.cv.dates[self.c], "")

    def fill_att(self):
        clear_layout(self.att_lay)
        self.att_rows = []
        for r, s in enumerate(self.cv.students):
            row = card("row")
            rl = QHBoxLayout(row)
            rl.setContentsMargins(S(4), S(8), S(4), S(8))
            n = lbl(f"{r + 1}", "muted")
            n.setFixedWidth(S(28))
            rl.addWidget(n)
            rl.addWidget(lbl(s["name"], "b"), 1)
            grp = QButtonGroup(row)
            grp.setExclusive(True)
            bs = {}
            for val, name, color in ATT_OPTS:
                b = QPushButton(name)
                b.setCheckable(True)
                b.setCursor(Qt.CursorShape.PointingHandCursor)
                b.setFocusPolicy(Qt.FocusPolicy.NoFocus)
                b.setMinimumHeight(S(34))
                b.setStyleSheet(f"QPushButton{{border:1px solid palette(mid);border-radius:{S(8)}px;padding:4px 12px;"
                                f"background:palette(base);font-weight:600;}}"
                                f"QPushButton:checked{{background:{color};border-color:{color};color:#ffffff;}}")
                b.clicked.connect(lambda _=False, rr=r, v=val: self.put_att(rr, v))
                grp.addButton(b)
                rl.addWidget(b)
                bs[val] = b
            self.att_lay.addWidget(row)
            self.att_rows.append((row, bs))
        self.att_lay.addStretch()
        self.cur = 0
        self.sync_att()

    def att_of(self, r):
        a = att_part(self.mark(r))
        return a if a in ("s", "dq", "k", "kq") else ""

    def sync_att(self):
        present = 0
        for r, (row, bs) in enumerate(self.att_rows):
            a = self.att_of(r)
            if a in ("", "kq"):
                present += 1
            for v, b in bs.items():
                with blocked(b):
                    b.setChecked(v == a)
            row.setStyleSheet("QFrame#row{background:palette(alternate-base);}" if r == self.cur else "")
        n = len(self.att_rows)
        self.att_title.setText(f"Kim darsda?  {present} / {n} keldi")
        self.update_foot()

    def put_att(self, r, val):
        old = self.mark(r)
        gs = grades_of(old) if old else []
        if val in ("s", "dq", "k"):
            new = val
        else:
            new = build_mark(gs, val == "kq")
        self.cv.put_today(r, new)
        self.cur = r
        self.sync_att()
        self.fill_grades()

    def all_in(self):
        for r in range(len(self.cv.students)):
            if self.att_of(r) in ("s", "dq", "k"):
                self.cv.put_today(r, "")
        self.sync_att()
        self.fill_grades()

    def fill_grades(self):
        clear_layout(self.gr_lay)
        self.gr_rows = []
        for r, s in enumerate(self.cv.students):
            absent = self.att_of(r) in ("s", "dq", "k")
            row = card("row")
            rl = QHBoxLayout(row)
            rl.setContentsMargins(S(4), S(6), S(4), S(6))
            n = lbl(f"{r + 1}", "muted")
            n.setFixedWidth(S(28))
            rl.addWidget(n)
            nm = lbl(s["name"] + (f"  ({ABSENT_NAMES[self.att_of(r)]})" if absent else ""), "muted" if absent else "b")
            rl.addWidget(nm, 1)
            gs = grades_of(self.mark(r))
            for g in range(1, 11):
                b = QPushButton(str(g))
                b.setCheckable(True)
                b.setChecked(g in gs)
                b.setEnabled(not absent)
                b.setFocusPolicy(Qt.FocusPolicy.NoFocus)
                b.setCursor(Qt.CursorShape.PointingHandCursor)
                b.setFixedSize(S(34), S(32))
                b.setStyleSheet(f"QPushButton{{border:1px solid palette(mid);border-radius:{S(7)}px;background:palette(base);"
                                f"font-weight:700;padding:0;color:palette(text);}}QPushButton:disabled{{color:palette(mid);border-color:palette(midlight);}}QPushButton:checked{{background:{self.win.grade_color(g)};"
                                f"border:2px solid palette(text);color:#000000;}}")
                b.clicked.connect(lambda _=False, rr=r, v=g: self.put_grade(rr, v))
                rl.addWidget(b)
            self.gr_lay.addWidget(row)
        self.gr_lay.addStretch()

    def put_grade(self, r, g):
        old = self.mark(r)
        gs = grades_of(old) if old else []
        late = bool(old) and late_of(old)
        new = build_mark([] if gs == [g] else [g], late)
        self.cv.put_today(r, new)
        self.fill_grades()
        self.update_foot()

    def save_lesson(self):
        if self.cv is None or self.c < 0:
            return
        topic, hw = self.topic.text().strip(), self.hw.text().strip()
        if (topic, hw) == self._les0:
            return
        cls, iso = self.cv.cls, self.cv.dates[self.c]
        old = cls.setdefault("lessons", {}).get(iso, {})
        if topic or hw:
            new = {"topic": topic, "hw": hw}
            if old.get("auto") and old.get("topic") == topic:
                new.update(auto=True, si=old.get("si"))
            cls["lessons"][iso] = new
        else:
            cls["lessons"].pop(iso, None)
        self.win.store.reflow_plan(cls)
        self.win.store.save()
        self._les0 = (topic, hw)

    # — qadamlar —
    def set_step(self, k):
        k = max(0, min(2, k))
        self.stack.setCurrentIndex(k)
        for i, b in enumerate(self.steps):
            b.setChecked(i == k)
        self.update_foot()
        if k == 2:
            self.topic.setFocus()
        else:
            self.setFocus()

    def next_step(self):
        k = self.stack.currentIndex()
        if k < 2:
            self.set_step(k + 1)
        else:
            self.finish()

    def update_foot(self):
        if self.cv is None:
            return
        k = self.stack.currentIndex()
        n = len(self.cv.students)
        absent = sum(1 for r in range(n) if self.att_of(r) in ("s", "dq", "k"))
        late = sum(1 for r in range(n) if self.att_of(r) == "kq")
        graded = sum(1 for r in range(n) if grades_of(self.mark(r)))
        self.summary.setText(f"Kelmagan: {absent} · kech qolgan: {late} · baho qo'yilgan: {graded}")
        self.back_b.setVisible(k > 0)
        self.next_b.setText(("Saqlash va baholarga o'tish ›", "Keyingi: mavzu ›", "✓ Darsni yakunlash")[k])

    def finish(self):
        if self.c < 0:
            return self.leave()
        self.save_lesson()
        cls, d = self.cv.cls, self.cv.dates[self.c]
        ok = cls.setdefault("att_ok", [])
        if d not in ok:
            ok.append(d)
            del ok[:-400]
        self.win.store.save()
        self.win.statusBar().showMessage(f"{cls_label(cls)}: {fmt_date(d)} darsi saqlandi — davomat tasdiqlandi.", 8000)
        self.win.lesson_done(cls)

    def leave(self):
        self.save_lesson()
        self.win.lesson_done(self.cv.cls if self.cv else None, finished=False)

    def keyPressEvent(self, e):
        if self.stack.currentIndex() != 0 or not getattr(self, "att_rows", None):
            return super().keyPressEvent(e)
        k = e.key()
        keys = {Qt.Key.Key_S: "s", Qt.Key.Key_D: "dq", Qt.Key.Key_K: "k", Qt.Key.Key_Q: "kq", Qt.Key.Key_Space: ""}
        if k == Qt.Key.Key_Down:
            self.cur = min(self.cur + 1, len(self.att_rows) - 1)
        elif k == Qt.Key.Key_Up:
            self.cur = max(self.cur - 1, 0)
        elif k in keys:
            self.put_att(self.cur, keys[k])
            self.cur = min(self.cur + 1, len(self.att_rows) - 1)
        elif k in (Qt.Key.Key_Return, Qt.Key.Key_Enter):
            return self.next_step()
        else:
            return super().keyPressEvent(e)
        self.sync_att()


# ───────────────────────── 4. Hisobotlar ─────────────────────────
class Tile(QFrame):
    """Bosiladigan karta: ikonka, sarlavha va izoh (matn tor ekranda qatorga o'raladi)."""

    def __init__(self, ic, title, sub, fn, color):
        super().__init__()
        self.setObjectName("tile")
        self.setAttribute(Qt.WidgetAttribute.WA_Hover)
        self.fn = fn
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        self.setMinimumHeight(S(92))
        h = QHBoxLayout(self)
        h.setContentsMargins(S(18), S(14), S(18), S(14))
        h.setSpacing(S(14))
        icl = QLabel()
        icl.setPixmap(tint_icon(ic, S(28), color).pixmap(S(28), S(28)))
        icl.setFixedWidth(S(30))
        h.addWidget(icl, 0, Qt.AlignmentFlag.AlignTop)
        v = QVBoxLayout()
        v.setSpacing(S(3))
        v.addWidget(lbl(title, "b"))
        v.addWidget(lbl(sub, "muted", True))
        v.addStretch()
        h.addLayout(v, 1)

    def mouseReleaseEvent(self, e):
        if e.button() == Qt.MouseButton.LeftButton and self.rect().contains(e.position().toPoint()):
            self.fn()


class ReportsPage(QWidget):
    def __init__(self, win):
        super().__init__()
        self.win = win
        self.setObjectName("v2page")
        outer = QVBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)
        sc, lay = scroll_page()
        outer.addWidget(sc)
        lay.addWidget(lbl("Hisobotlar", "h1"))
        lay.addWidget(lbl("Nima kerakligini tanlang — oynada ko'rib, keyin PDF yoki Excel qilib olasiz.", "muted", True))
        cur = lambda: win.current_cls()        # noqa: E731
        tiles = (
            ("📄", "Sinf hisoboti", "O'rtacha baho, davomat, chorak bali — PDF, Excel, chop etish", lambda: win.show_report(cur())),
            ("⚠", "Xavf ostidagilar", "O'rtacha past, ko'p qoldirgan yoki davomati past o'quvchilar", win.show_risk_all),
            ("📝", "BSB / CHSB tahlili", "Ball jadvali, diagramma va tavsiyalar", lambda: win.show_bsb_analysis(cur())),
            ("✅", "Chorak yakuniga tayyorlik", "Kimda qaysi ball yetishmayapti",
             lambda: win.store.classes and ReadinessDialog(win, win.store).exec()),
            ("📈", "Sinflarni solishtirish", "Sinflar ko'rsatkichlari yonma-yon",
             lambda: win.store.classes and CompareDialog(win, win.store).exec()),
            ("⭐", "Kuzatuvdagi o'quvchilar", "Yulduzcha qo'yilgan o'quvchilar ro'yxati", lambda: WatchDialog(win).exec()),
            ("🖨", "Bo'sh yo'qlama varag'i", "Qog'ozda belgilash uchun chop etiladigan varaq", lambda: BlankSheetDialog(win).exec()),
            ("📋", "Jadvalni nusxalash", "Ko'rinayotgan jurnalni Excel yoki emaktabga qo'yish uchun",
             lambda: win.tabs.currentWidget() and (win.tabs.currentWidget().copy_period(),
                                                   win.statusBar().showMessage("Jadval nusxalandi — Excelga qo'ying (Ctrl+V)", 8000))),
            ("📱", "Telefon uchun nusxa", "Faqat ko'rish uchun HTML fayl — telefonda ochiladi", win.export_mobile),
        )
        grid = QGridLayout()
        grid.setSpacing(S(14))
        for i, (ic, title, sub, fn) in enumerate(tiles):
            grid.addWidget(Tile(ic, title, sub, fn, tok(win.store)["acc"]), i // 3, i % 3)
        for c in range(3):
            grid.setColumnStretch(c, 1)
        lay.addLayout(grid)
        lay.addStretch()


# ───────────────────────── 5. Sozlamalar ─────────────────────────
class SettingsPage(QWidget):
    def __init__(self, win):
        super().__init__()
        self.win = win
        self.setObjectName("v2page")
        root = QVBoxLayout(self)
        root.setContentsMargins(S(32), S(26), S(32), S(26))
        root.setSpacing(S(18))
        root.addWidget(lbl("Sozlamalar", "h1"))
        body = QHBoxLayout()
        body.setSpacing(S(18))
        side = card()
        side.setFixedWidth(S(270))
        sl = QVBoxLayout(side)
        sl.setContentsMargins(S(10), S(10), S(10), S(10))
        sl.setSpacing(S(4))
        self.sec_btns = []
        grp = QButtonGroup(self)
        for i, (title, _sub, _rows) in enumerate(self.sections()):
            b = btn(title, "side", lambda k=i: self.show_sec(k), checkable=True)
            grp.addButton(b)
            sl.addWidget(b)
            self.sec_btns.append(b)
        sl.addStretch()
        body.addWidget(side, 0, Qt.AlignmentFlag.AlignTop)
        self.panel = card()
        self.pl = QVBoxLayout(self.panel)
        self.pl.setContentsMargins(S(26), S(18), S(26), S(18))
        self.pl.setSpacing(0)
        sc = QScrollArea()
        sc.setObjectName("v2scroll")
        sc.setWidgetResizable(True)
        sc.setFrameShape(QFrame.Shape.NoFrame)
        sc.setWidget(self.panel)
        body.addWidget(sc, 1)
        root.addLayout(body, 1)
        self.k = 0

    def sections(self):
        w, st = self.win, self.win.store
        cv = lambda: w.tabs.currentWidget()          # noqa: E731
        qs = []
        for q in range(1, 5):
            r = st.quarter_range(q)
            if r:
                qs.append(f"{q}: {fmt_date(r[0])} – {fmt_date(r[1])}")
        mw = st.method_weekday()
        theme = "Mening dizaynim" if st.theme_key() == "custom" else THEMES[st.theme_key()]["title"]
        zoom = st.data["settings"].get("ui_zoom", 0)
        g = w.guard
        prot = "Yoqilgan" if g.enabled() else "O'chiq"
        return (
            ("Sinflar va o'quvchilar", "Sinf qo'shish, nomini o'zgartirish, o'quvchilarni qo'shish yoki chiqarish.", (
                ("Sinflarim", f"{len(st.classes)} ta jurnal: " + ", ".join(cls_label(c) for c in st.classes[:6])
                 + (" …" if len(st.classes) > 6 else ""), "＋ Sinf qo'shish", w.add_class),
                ("Joriy sinf", (cls_label(w.current_cls()) if w.current_cls() else "tanlanmagan") + " — nomi va fanini o'zgartirish",
                 "O'zgartirish", w.edit_class),
                ("O'quvchi qo'shish", "Joriy sinfga yangi o'quvchilar (ro'yxatni nusxalab qo'yish mumkin)", "Qo'shish",
                 lambda: cv() and cv().add_students()),
                ("Joriy sinfni olib tashlash", "Oldin zaxira nusxa olinadi", "Olib tashlash", w.remove_class),
                ("Yangi o'quv yili", "Sinflarni keyingi sinfga o'tkazish (6-A → 7-A)", "Boshlash",
                 lambda: st.classes and RolloverDialog(w).exec()))),
            ("Dars kunlari va choraklar", "Jadval bir marta sozlanadi — sanalar o'zi yaratiladi.", (
                ("Dars kunlari", "Har bir fan haftaning qaysi kunlari o'tiladi", "Belgilash", lambda: WeekdaysDialog(w).exec()),
                ("Choraklar", "; ".join(qs) or "belgilanmagan", "O'zgartirish", w.edit_quarters),
                ("Bayramlar", "Bu kunlarda dars bo'lmaydi", "Ko'rish", w.edit_holidays),
                ("Metod kuni", "Belgilanmagan" if mw is None else WEEKDAYS_FULL[mw], "Tanlash", self.method_menu),
                ("Kalendar-tematik reja (KTR)", "Mavzular darslarga o'zi tushadi", "Ochish", lambda: PlanDialog(w).exec()))),
            ("Baholash", "Ranglar va «xavf ostida» deb belgilash qoidalari.", (
                ("Baho ranglari", "Qaysi baho qaysi rangda ko'rinadi", "O'zgartirish", w.edit_ranges),
                ("Xavf ostida deb hisoblash", "O'rtacha baho, davomat va sababsiz qoldirish chegaralari", "O'zgartirish", w.edit_risk))),
            ("emaktab", "Kirish bir marta — keyin baholar bir tugma bilan olinadi.", (
                ("emaktabga kirish", "Login va parol bilan: sinflar, o'quvchilar va baholarni olish", "Kirish", w.emaktab_web),
                ("Fayldan import", "emaktabdan yuklangan «Fan jurnali» (.xls) faylini o'qish va solishtirish", "Fayl tanlash",
                 w.sync_file),
                ("Avtomatlashtirish", "Eslatmalar, haftalik hisobot, zaxira va kuzatiladigan papka", "Sozlash",
                 lambda: AutoDialog(w).exec()))),
            ("Ko'rinish", "Rang va o'lcham — ko'zingizga qulay holatda.", (
                ("Mavzu", theme, "Tanlash", lambda: self.menu_of("Dizayn")),
                ("Ko'rinish zichligi", "Kompakt — butun chorak bitta ekranda" if is_compact(st) else "Oddiy — katta tugmalar",
                 "Kompakt" if not is_compact(st) else "Oddiy", lambda: w.set_density(not is_compact(st))),
                ("Matn o'lchami", "Avto (ekranga qarab)" if not zoom else f"{zoom} pt", "Tanlash",
                 lambda: self.menu_of("Interfeys o'lchami")),
                ("Uslub", "Tugma va jadvallar ko'rinishi", "Tanlash", lambda: self.menu_of("Uslub")),
                ("PDF hisobot dizayni", "Shrift, ranglar va sarlavha", "Sozlash", lambda: PdfDesignDialog(w).exec()))),
            ("Himoya va zaxira", "Baholar yo'qolmaydi va tasodifan o'zgarmaydi.", (
                ("Qo'yilgan baholarni himoyalash", "O'zgartirishdan oldin qulfni ochish so'raladi", prot,
                 lambda: w.set_protect(not g.enabled())),
                ("Parol", "Qulfni ochish uchun parol", "O'rnatish", w.set_pin),
                ("Avtomatik qulflash", "Qancha vaqtdan keyin qayta qulflanadi", "Sozlash", w.set_auto_lock),
                ("Zaxira nusxa", "Avtomatik olinadi; hozir ham olish mumkin", "Hozir olish", w.backup_now),
                ("Zaxiradan tiklash", "Istalgan oldingi holatga qaytish", "Ochish", w.show_restore),
                ("O'zgarishlar tarixi", "Qachon, qaysi bahoni o'zgartirildi — qaytarish mumkin", "Ko'rish", w.show_history))),
        )

    def menu_of(self, title):
        """1-versiya «Sozlamalar» menyusidagi kichik menyuni tugma yonida ochadi."""
        for top in self.win.menuBar().actions():
            m = top.menu()
            if m is None:
                continue
            for a in m.actions():
                if a.menu() is not None and a.text().replace("&", "") == title:
                    a.menu().exec(QCursor.pos())
                    self.win.after_settings()
                    return

    def method_menu(self):
        m = QMenu(self)
        for val, a in self.win.method_acts.items():
            m.addAction(a)
        m.exec(QCursor.pos())
        self.refresh()

    def show_sec(self, k):
        self.k = k
        clear_layout(self.pl)
        title, sub, rows = self.sections()[k]
        for i, b in enumerate(self.sec_btns):
            b.setChecked(i == k)
        self.pl.addWidget(lbl(title, "h2"))
        s = lbl(sub, "muted", True)
        s.setContentsMargins(0, S(4), 0, S(10))
        self.pl.addWidget(s)
        for t, d, b, fn in rows:
            row = card("row")
            rl = QHBoxLayout(row)
            rl.setContentsMargins(0, S(14), 0, S(14))
            tx = QVBoxLayout()
            tx.setSpacing(S(2))
            tx.addWidget(lbl(t, "b"))
            tx.addWidget(lbl(d, "muted", True))
            rl.addLayout(tx, 1)
            rl.addWidget(btn(b, "sec", lambda f=fn: (f(), self.win.after_settings())))
            self.pl.addWidget(row)
        self.pl.addStretch()

    def refresh(self):
        self.show_sec(self.k)


# ───────────────────────── birinchi ishga tushirish ─────────────────────────
class WelcomeDialog(QDialog):
    OPTS = (("emaktab", "Tavsiya", "emaktabdan olish", "Login va parol bilan kirasiz — sinflar, o'quvchilar va baholar o'zi keladi."),
            ("file", "", "Fayldan", "emaktabdan yuklangan Excel (.xls) yoki eski jadvalingiz (.ods)."),
            ("hand", "", "Qo'lda", "Sinf nomini yozib, o'quvchilar ro'yxatini nusxalab qo'yasiz."))

    def __init__(self, win):
        super().__init__(win)
        self.setWindowTitle("Xush kelibsiz")
        self.setStyleSheet(qss(win.store) + "QDialog{background:%s;}" % tok(win.store)["win"])
        fit_to_screen(self, 640, 520)
        lay = QVBoxLayout(self)
        lay.setContentsMargins(S(30), S(26), S(30), S(22))
        lay.setSpacing(S(12))
        lay.addWidget(lbl("Xush kelibsiz · 3 qadamdan 1-qadam", "tag"))
        lay.addWidget(lbl("Sinflaringizni qanday qo'shamiz?", "h1", True))
        lay.addWidget(lbl("Keyingi qadamlar: dars kunlari va choraklar. Hammasi 2 daqiqa oladi, keyin istalgan payt o'zgartirasiz.",
                          "muted", True))
        grp = QButtonGroup(self)
        self.btns = {}
        for key, tag, title, sub in self.OPTS:
            b = btn(f"{title}{'   · ' + tag if tag else ''}\n{sub}", "opt", checkable=True)
            b.setMinimumHeight(S(70))
            grp.addButton(b)
            lay.addWidget(b)
            self.btns[key] = b
        self.btns["emaktab"].setChecked(True)
        lay.addStretch()
        row = QHBoxLayout()
        row.addWidget(btn("Keyinroq — bo'sh jurnal bilan boshlash", "link", self.reject))
        row.addStretch()
        row.addWidget(btn("Davom etish ›", "pri", self.accept))
        lay.addLayout(row)

    def choice(self):
        return next(k for k, b in self.btns.items() if b.isChecked())


# ───────────────────────── asosiy oyna ─────────────────────────
class MainWindow2(MainWindow):
    def __init__(self, store):
        self._v2 = None
        cfg = v2cfg(store)
        if not cfg.get("ranges3"):                    # baho ranglari: 1–4 qizil, 5–7 sariq, 8–10 yashil (bir marta o'rnatiladi)
            store.data["settings"]["ranges"] = copy.deepcopy(DEFAULT_SETTINGS["ranges"])
            cfg["ranges3"] = True
            store.save()
        super().__init__(store)
        self.setWindowTitle(APP_TITLE)
        # 1-versiyaning menyusi va asboblar paneli yashiriladi: hamma amallar bo'limlarda, tugmalar orqali.
        # Klaviatura tugmalari (Ctrl+Z, Ctrl+F, …) ishlashda davom etishi uchun amallar oynaning o'ziga qo'shiladi.
        self.menuBar().hide()
        for tb in self.findChildren(QToolBar):
            tb.hide()
            tb.toggleViewAction().setVisible(False)
        self.setContextMenuPolicy(Qt.ContextMenuPolicy.NoContextMenu)
        self.add_shortcuts(self.menuBar().actions())
        self.page_btns = self.v2_page_btns
        self.sync_nav()
        self.go(P_TODAY)

    def add_shortcuts(self, actions):
        for a in actions:
            if a.menu() is not None:
                self.add_shortcuts(a.menu().actions())
            elif not a.shortcut().isEmpty():
                self.addAction(a)

    # — qobiq —
    def build_central(self):
        if self._v2 is not None:                      # 1-versiyaning «joylashuv» almashtirishi 2-versiyada kerak emas
            return
        self._v2 = True
        root = QWidget()
        root.setObjectName("v2root")
        h = QHBoxLayout(root)
        h.setContentsMargins(0, 0, 0, 0)
        h.setSpacing(0)
        h.addWidget(self.build_side())
        self.pages = QStackedWidget()
        h.addWidget(self.pages, 1)
        self.today_page = TodayPage(self)
        self.pages.addWidget(self.today_page)
        self.pages.addWidget(self.build_journal())
        self.reports_page = ReportsPage(self)
        self.pages.addWidget(self.reports_page)
        self.settings_page = SettingsPage(self)
        self.pages.addWidget(self.settings_page)
        self.lesson_page = LessonPage(self)
        self.pages.addWidget(self.lesson_page)
        # 1-versiya banneri ishlatilmaydi («Bugun» sahifasi o'rnini bosadi), lekin ota vidjeti bo'lishi shart
        self._parking = QWidget(root)
        self._parking.hide()
        self.auto_bar.setParent(self._parking)
        self.setCentralWidget(root)
        self.apply_v2_style()
        self.side_list = None

    def apply_v2_style(self):
        self.centralWidget().setStyleSheet(qss(self.store))
        k = tok(self.store)
        for (ch, _name), b in zip(NAV, self.nav_btns):
            b.setIcon(tint_icon(ch, S(20), k["text"], k["acc_fg"]))
            b.setIconSize(QSize(S(20), S(20)))

    def build_side(self):
        sb = self.side = QFrame()
        sb.setObjectName("v2side")
        lay = QVBoxLayout(sb)
        lay.setContentsMargins(S(14), S(20), S(14), S(14))
        lay.setSpacing(S(6))
        top = QHBoxLayout()
        logo = QLabel("Y")
        logo.setObjectName("v2logo")
        logo.setAlignment(Qt.AlignmentFlag.AlignCenter)
        logo.setFixedSize(S(36), S(36))
        top.addWidget(logo)
        self.side_title = QLabel("<b>Yo'qlama jurnali</b><br><span style='color:gray'>2.0</span>")
        top.addWidget(self.side_title, 1)
        lay.addLayout(top)
        lay.addSpacing(S(16))
        self.nav_btns = []
        grp = QButtonGroup(self)
        grp.setExclusive(True)
        for i, (_ch, name) in enumerate(NAV):
            b = btn(name, "nav", lambda k=i: self.go(k), checkable=True)
            b.setToolTip(name)
            grp.addButton(b)
            lay.addWidget(b)
            self.nav_btns.append(b)
        lay.addStretch()
        self.v2_lock = btn("", "sec", self.toggle_lock)
        lay.addWidget(self.v2_lock)
        self.density_btn = btn("", "sec", lambda: self.set_density(not is_compact(self.store)),
                               "Oddiy — katta kataklar; Kompakt — butun chorak bitta ekranda")
        lay.addWidget(self.density_btn)
        self.all_btn = btn("☰  Barcha buyruqlar", "sec", self.all_commands, "1-versiyadagi to'liq menyu")
        lay.addWidget(self.all_btn)
        self.sync_side()
        return sb

    def sync_side(self):
        c = is_compact(self.store)
        self.side.setFixedWidth(S(76) if c else S(232))
        self.side_title.setVisible(not c)
        for (_ch, name), b in zip(NAV, self.nav_btns):
            b.setText("" if c else "  " + name)
        self.density_btn.setText("▦" if c else "▦  Kompakt ko'rinish")
        self.density_btn.setToolTip("Oddiy ko'rinishga qaytish" if c else "Kompakt: butun chorak bitta ekranda")
        self.all_btn.setText("☰" if c else "☰  Barcha buyruqlar")
        if hasattr(self, "lock_btn"):
            self.sync_lock()

    def all_commands(self):
        m = QMenu(self)
        for top in self.menuBar().actions():
            if top.menu() is not None:
                m.addMenu(top.menu())
        m.exec(self.all_btn.mapToGlobal(QPoint(self.all_btn.width(), 0)))
        self.after_settings()

    def sync_lock(self):
        super().sync_lock()
        if not hasattr(self, "v2_lock"):
            return
        g = self.guard
        c = is_compact(self.store)
        txt = "⚠" if not g.enabled() else "🔒" if g.is_locked() else "🔓"
        full = {"⚠": "⚠  Himoya o'chiq", "🔒": "🔒  Baholar himoyalangan", "🔓": "🔓  Ochiq — qulflash"}[txt]
        self.v2_lock.setText(txt if c else full)
        self.v2_lock.setToolTip(self.lock_btn.toolTip())
        self.v2_lock.setStyleSheet("" if g.is_locked() and g.enabled() else
                                   "QPushButton{color:#c62828;}" if not g.enabled() else
                                   "QPushButton{background:#ffca28;color:#000000;border-color:#ffca28;}")

    # — jurnal sahifasi —
    def build_journal(self):
        page = QWidget()
        page.setObjectName("v2page")
        lay = QVBoxLayout(page)
        lay.setContentsMargins(S(24), S(16), S(24), S(10))
        lay.setSpacing(S(10))
        self.chips = FlowLayout(hspacing=S(8), vspacing=S(6))
        self.chip_grp = QButtonGroup(self)
        self.chip_grp.setExclusive(True)
        row1 = QHBoxLayout()
        row1.setSpacing(S(6))
        row1.addWidget(FlowBox(self.chips), 1)
        self.v2_page_btns = []
        g = QButtonGroup(self)
        for i, name in enumerate(("Baholar", "BSB / CHSB", "Yillik")):
            b = btn(name, "seg", lambda k=i: self.set_page(k), f"Alt+{i + 1}", checkable=True)
            b.setShortcut(f"Alt+{i + 1}")
            g.addButton(b)
            row1.addWidget(b, 0, Qt.AlignmentFlag.AlignTop)
            self.v2_page_btns.append(b)
        self.v2_page_btns[0].setChecked(True)
        lay.addLayout(row1)
        bar = QHBoxLayout()
        bar.setSpacing(S(6))
        bar.addWidget(btn("‹", "sec", lambda: self.shift_view(-1), "Oldingi davr (Alt+←)"))
        self.j_title = lbl("", "h2")
        self.j_title.setMinimumWidth(S(150))
        self.j_title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        bar.addWidget(self.j_title)
        bar.addWidget(btn("›", "sec", lambda: self.shift_view(1), "Keyingi davr (Alt+→)"))
        bar.addWidget(btn("Bugun", "sec", lambda: self.set_view(anchor=dt.date.today())))
        bar.addSpacing(S(10))
        self.mode_seg = {}
        g = QButtonGroup(self)
        for i, (key, name) in enumerate(VIEW_MODES, 1):
            b = btn(name, "seg", lambda k=key: self.set_view(mode=k), f"{name} ko'rinishi (Ctrl+{i})", checkable=True)
            b.setShortcut(f"Ctrl+{i}")
            g.addButton(b)
            bar.addWidget(b)
            self.mode_seg[key] = b
        bar.addSpacing(S(10))
        g = QButtonGroup(self)
        self.dens_seg = []
        for i, name in enumerate(("Oddiy", "Kompakt")):
            b = btn(name, "seg", lambda k=i: self.set_density(bool(k)), checkable=True)
            g.addButton(b)
            bar.addWidget(b)
            self.dens_seg.append(b)
        self.dens_seg[int(is_compact(self.store))].setChecked(True)
        bar.addStretch(1)
        self.start_btn = btn("▶  Darsni boshlash", "pri", lambda: self.start_lesson(self.current_cls()),
                             "Bugungi dars: yo'qlama, baholar, mavzu (Ctrl+D)")
        bar.addWidget(self.start_btn)
        more = QToolButton()
        more.setText("Yana ▾")
        more.setProperty("v2", "sec")
        more.setPopupMode(QToolButton.ToolButtonPopupMode.InstantPopup)
        more.setCursor(Qt.CursorShape.PointingHandCursor)
        more.setMenu(self.more_menu(more))
        bar.addWidget(more)
        lay.addLayout(bar)
        body = QHBoxLayout()
        body.setSpacing(S(12))
        body.addWidget(self.tabs, 1)
        body.addWidget(self.inspector)
        self.inspector.setObjectName("card")
        self.inspector.setFixedWidth(S(280))
        lay.addLayout(body, 1)
        self.tabs.tabBar().hide()
        self.tabs.show()
        self.sync_density_widgets()
        QShortcut(QKeySequence("Ctrl+D"), page, lambda: self.start_lesson(self.current_cls()))
        return page

    def more_menu(self, parent):
        m = QMenu(parent)
        cv = lambda: self.tabs.currentWidget()        # noqa: E731

        def call(name):
            return lambda: cv() and getattr(cv(), name)()
        m.addAction("＋ O'quvchi qo'shish…", call("add_students"))
        m.addAction("✎ Tanlangan o'quvchi ismini o'zgartirish…", call("rename_student"))
        m.addAction("− Tanlangan o'quvchini olib tashlash…", call("remove_students"))
        m.addAction("📇 O'quvchi kartochkasi…", call("show_card"))
        m.addAction("⭐ Kuzatuvga qo'shish / olib tashlash", call("toggle_star"))
        m.addSeparator()
        m.addAction("＋ Sana qo'shish…", call("add_date"))
        m.addAction("− Tanlangan sanani o'chirish", call("remove_date"))
        m.addAction("✕ Tanlangan kunni «dars yo'q» deb belgilash / qaytarish", call("toggle_x"))
        m.addSeparator()
        m.addAction("↶ Oxirgi o'zgarishni bekor qilish (Ctrl+Z)", call("undo_last"))
        m.addAction("📋 Ko'rinayotgan jadvalni nusxalash", call("copy_period"))
        m.addAction("🔍 O'quvchini qidirish (Ctrl+F)", lambda: self.store.classes and FindDialog(self).exec())
        m.addAction("📚 Kalendar-tematik reja…", lambda: PlanDialog(self).exec())
        m.addSeparator()
        m.addAction("✎ Sinf nomi va fani…", lambda: self.edit_class())
        m.addAction("− Sinfni olib tashlash…", lambda: self.remove_class())
        iconize_menu(m)
        return m

    def refresh_chips(self):
        if not hasattr(self, "chips"):
            return
        clear_layout(self.chips)
        self.chips._items = []
        for b in self.chip_grp.buttons():
            self.chip_grp.removeButton(b)
        cur = self.tabs.currentIndex()
        for i, cls in enumerate(self._tab_cls):
            b = btn(cls_label(cls), "chip", lambda k=i: self.tabs.setCurrentIndex(k), checkable=True)
            b.setChecked(i == cur)
            self.chip_grp.addButton(b)
            self.chips.addWidget(b)
        self.chips.addWidget(btn("＋ Sinf qo'shish", "chip", self.add_class))
        self.chips.invalidate()

    def sync_chips(self):
        cur = self.tabs.currentIndex()
        for i, b in enumerate(self.chip_grp.buttons()):
            with blocked(b):
                b.setChecked(i == cur)

    def visible_classes(self):                        # 2-versiyada fan filtri yo'q: hamma sinflar ko'rinadi
        return list(self.store.classes)

    def build_tabs(self):
        self.store.reflow_all()
        cur_cls, cur = self.current_cls(), self.tabs.currentIndex()
        self.refresh_subjects()
        classes = self._tab_cls = self.visible_classes()
        for i in range(self.tabs.count()):
            self.tabs.widget(i).deleteLater()
        self.tabs.clear()
        compact = is_compact(self.store)
        for cls in classes:
            cv = ClassView2(self.store, cls, self.view, self.guard, compact)
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
        self.refresh_chips()
        self.inspector.queue()
        if self._v2 and self.pages.currentIndex() == P_TODAY:
            self.today_page.refresh()

    def sync_sidebar(self):
        self.sync_chips()

    def refresh_sidebar(self):
        pass

    def set_page(self, k):
        self.page = k
        for i, b in enumerate(self.v2_page_btns):
            b.setChecked(i == k)
        for b in self.mode_seg.values():
            b.setVisible(k == 0)
        cur = self.tabs.currentWidget()
        for i in range(self.tabs.count()):
            w = self.tabs.widget(i)
            w.set_page(k, refresh=(w is cur))

    def sync_nav(self):
        super().sync_nav()
        if hasattr(self, "j_title"):
            self.j_title.setText(self.view.title())
            self.mode_seg[self.view.mode].setChecked(True)

    def refresh_auto_bar(self):
        super().refresh_auto_bar()
        self.auto_bar.hide()
        if self._v2 and self.pages.currentIndex() == P_TODAY:
            self.today_page.refresh()

    def update_risk_chip(self):
        super().update_risk_chip()
        self.risk_chip.hide()                         # xavf ro'yxati «Bugun» sahifasida

    def resizeEvent(self, e):
        QMainWindow.resizeEvent(self, e)

    # — zichlik —
    def set_density(self, compact):
        v2cfg(self.store)["density"] = "kompakt" if compact else "oddiy"
        self.store.save()
        self.dens_seg[int(bool(compact))].setChecked(True)
        if compact:                                    # kompakt: butun chorak bitta ekranda
            self.view.mode = "quarter"
        elif self.view.mode == "quarter":
            self.view.mode = "month"
        self.sync_side()
        self.sync_density_widgets()
        self.build_tabs()
        self.sync_nav()
        if self.pages.currentIndex() == P_SETTINGS:
            self.settings_page.refresh()
        self.statusBar().showMessage("Kompakt ko'rinish: butun chorak bitta ekranda" if compact else "Oddiy ko'rinish", 5000)

    def sync_density_widgets(self):
        c = is_compact(self.store)
        self.inspector.setVisible(not c)
        self.inspector.queue()

    # — bo'limlar —
    def go(self, k):
        self.pages.setCurrentIndex(k)
        for i, b in enumerate(self.nav_btns):
            with blocked(b):
                b.setChecked(i == k if k != P_LESSON else i == P_JOURNAL)
        if k == P_TODAY:
            self.today_page.refresh()
        elif k == P_SETTINGS:
            self.settings_page.refresh()
        elif k == P_JOURNAL and self.tabs.currentWidget() is not None:
            self.tabs.currentWidget().refresh_page()
            self.inspector.queue()

    def after_settings(self):
        """Sozlama dialogi yopilgandan keyin: ko'rinishni yangilash."""
        if not self._v2:
            return
        self.apply_v2_style()
        self.sync_lock()
        self.sync_nav()
        k = self.pages.currentIndex()
        if k == P_SETTINGS:
            self.settings_page.refresh()
        elif k == P_TODAY:
            self.today_page.refresh()

    def apply_theme(self, key, save=True):
        super().apply_theme(key, save)
        if self._v2:
            self.apply_v2_style()
            self.after_settings()

    def view_for(self, cls):
        for i in range(self.tabs.count()):
            if self.tabs.widget(i).cls is cls:
                return self.tabs.widget(i)
        return None

    def open_journal(self, cls):
        self.select_class(cls)
        self.go(P_JOURNAL)

    def show_risk_all(self):
        risk = self.store.risk_overview()
        self.show_risk_report(risk[0]["cls"] if risk else self.current_cls())

    def grade_color(self, g):
        col = "#ffffff"
        for r in self.store.ranges():
            if g >= r["min"]:
                col = r["color"]
        return col

    # — dars oqimi —
    def start_lesson(self, cls):
        if cls is None:
            if not self.store.classes:
                return self.empty_start()
            todo = [c for c, done in self.store.lessons_today() if not done]
            cls = todo[0] if todo else self.store.classes[0]
        self.select_class(cls)
        cv = self.tabs.currentWidget()
        if cv is None:
            return
        if not cv.students:
            QMessageBox.information(self, "Darsni boshlash", "Bu sinfda o'quvchilar yo'q. Avval o'quvchilarni qo'shing.")
            return
        iso = dt.date.today().isoformat()
        if cv.today_col() < 0:
            ok = QMessageBox.question(self, "Darsni boshlash",
                                      f"Bugungi sana ({fmt_date(iso)}) «{cls_label(cls)}» jurnalida yo'q.\n"
                                      "Bugunni dars kuni sifatida qo'shaymi?")
            if ok != QMessageBox.StandardButton.Yes:
                return
            cv.dates.append(iso)
            cv.dates.sort()
            self.store.reflow_plan(cls)
            self.store.save()
            self.set_view(anchor=dt.date.today())
        if self.store.is_nolesson(cls, iso):
            QMessageBox.information(self, "Darsni boshlash", "Bugun bu sinfda «dars yo'q» (X) deb belgilangan.")
            return
        self.lesson_page.open(cv)
        self.go(P_LESSON)
        self.lesson_page.setFocus()

    def lesson_done(self, cls, finished=True):
        cv = self.tabs.currentWidget()
        if cv is not None:
            cv.apply_view()
        self.refresh_auto_bar()
        if finished and cls is not None:
            self.open_journal(cls)
        else:
            self.go(P_TODAY)

    def fast_current(self):
        self.start_lesson(self.current_cls())

    def go_today(self):
        self.set_view(anchor=dt.date.today())
        self.go(P_TODAY)

    # — birinchi ishga tushirish —
    def empty_start(self):
        d = WelcomeDialog(self)
        if not d.exec():
            v2cfg(self.store)["welcomed"] = True
            self.store.save()
            return
        k = d.choice()
        if k == "emaktab":
            self.emaktab_web()
        elif k == "file":
            self.import_file()
        else:
            self.add_class()
        v2cfg(self.store)["welcomed"] = True
        self.store.save()
        if not self.store.classes:
            return
        QMessageBox.information(self, "2-qadam: dars kunlari",
                                "Endi har bir fan haftaning qaysi kunlari o'tilishini belgilang — "
                                "shunda «Bugun» sahifasi darslaringizni o'zi ko'rsatadi.")
        WeekdaysDialog(self).exec()
        QMessageBox.information(self, "3-qadam: choraklar",
                                "Oxirgi qadam: chorak sanalarini tekshiring. «Yaratish» tugmasi dars kunlarini jurnalga o'zi qo'shadi.")
        self.edit_quarters()
        self.build_tabs()
        self.go(P_TODAY)


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
    win = MainWindow2(store)
    win.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
