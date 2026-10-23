# -*- coding: utf-8 -*-
"""
emaktab_hisobot.py — Telegram bot uchun sinf hisoboti. Hisob yo'qlama jurnalidagi «Hisobotlar» oynasi bilan bir xil:
o'rtacha ball, davomat foizi, chorak balli (BSB + CHSB + formativ), xavf ostidagi o'quvchilar; PDF, Excel, o'quvchi varaqlari.

emaktabdan olingan Excel fayl vaqtinchalik omborga import qilinadi. journal.json faqat O'QILADI (xavf mezonlari,
chorak sanalari, PDF dizayni olinadi) — unga hech narsa yozilmaydi.
Kerak: yoqlama_jurnal.py shu papkada; pip install PySide6 pandas xlrd openpyxl
"""
import copy
import datetime as dt
import json
import os
import shutil
import tempfile
from html import escape as esc
from pathlib import Path

_J = {"mod": None, "app": None}
# journal.json dan olinadigan sozlamalar (login/parol saqlanadigan «auto» bo'limi olinmaydi)
SETTINGS_KEYS = ("ranges", "attendance", "quarters", "fb_min", "pdf_font", "pdf_design", "report_cols",
                 "report_extras", "pdf_new_alpha", "pdf_sort", "risk")


def jm():
    """yoqlama_jurnal modulini (va PDF uchun ekransiz Qt ilovasini) bir marta yuklaydi."""
    if _J["mod"] is None:
        os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
        import yoqlama_jurnal as J
        from PySide6.QtWidgets import QApplication
        _J["app"] = QApplication.instance() or QApplication(["emaktab-bot"])
        _J["mod"] = J
    return _J["mod"]


def available():
    """(bor/yo'q, sabab)."""
    try:
        jm()
        import pandas                                           # noqa: F401
        import openpyxl                                         # noqa: F401
        return True, ""
    except ImportError as e:
        return False, (f"{e.name or e} topilmadi. Kerak: yoqlama_jurnal.py shu papkada va "
                       "pip install PySide6 pandas xlrd openpyxl")


class Book:
    """Bir yoki bir nechta emaktab Excel fayli asosidagi vaqtinchalik ombor."""

    def __init__(self, files, settings_file=None):
        J = jm()
        st = {}
        if settings_file and Path(settings_file).exists():
            try:
                saved = json.loads(Path(settings_file).read_text(encoding="utf-8")).get("settings", {})
                st = {k: copy.deepcopy(saved[k]) for k in SETTINGS_KEYS if k in saved}
            except (OSError, ValueError):
                st = {}
        st["method_weekday"] = None                             # emaktabdagi sanalar — o'tilgan darslar
        self.tmp = Path(tempfile.mkdtemp(prefix="emk_hisobot_"))
        p = self.tmp / "journal.json"
        p.write_text(json.dumps({"version": 2, "classes": [], "settings": st}, ensure_ascii=False), encoding="utf-8")
        self.store = J.Store(p)
        self.cur_q = {}                                         # sinf yorlig'i -> fayldagi chorak raqami
        self.problems = []
        for f in files:
            try:
                imps = J.read_import_file(str(f))
            except Exception as e:                              # noqa: BLE001
                self.problems.append(f"{Path(f).name}: {str(e)[:150]}")
                continue
            if not imps:
                self.problems.append(f"{Path(f).name}: emaktab «Fan jurnali» formati tanilmadi")
            for imp in imps:
                rep = self.store.merge_import(imp)
                qd = imp.get("quarter")
                if qd:
                    self.cur_q[J.cls_label(rep["cls"])] = qd["q"]
        self._apply()

    def _apply(self):
        """PDF sozlamalari jurnal modulida umumiy — har chizishdan oldin shu omborniki qo'yiladi."""
        J = jm()
        s = self.store.data["settings"]
        J.set_pdf_font(s.get("pdf_font", "Libertinus Serif (Typst)"))
        J.set_pdf_design(s.get("pdf_design"))
        J._PDF_FONT["alpha"] = bool(s.get("pdf_new_alpha", True))
        J._PDF_FONT["sort"] = s.get("pdf_sort", "default")

    def close(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    @property
    def classes(self):
        return self.store.classes

    def label(self, cls):
        return jm().cls_label(cls)

    # — davr —
    def period(self, cls, key, today=None):
        """key: cur | q1…q4 | month | week | all  →  (boshlanish, tugash, chorak yoki None)."""
        today = today or dt.date.today()
        ds = sorted(cls["dates"])
        if key == "month":
            return today.replace(day=1).isoformat(), today.isoformat(), None
        if key == "week":
            return (today - dt.timedelta(days=today.weekday())).isoformat(), today.isoformat(), None
        q = int(key[1:]) if key.startswith("q") and key[1:].isdigit() else self.cur_q.get(self.label(cls))
        r = self.store.quarter_range(q) if q else None
        if key != "all" and r:
            return r[0], r[1], q
        if ds:
            return ds[0], ds[-1], None
        return today.isoformat(), today.isoformat(), None

    def rows(self, cls, lo, hi, q):
        return self.store.report_rows(cls, lo, hi, q)

    # — chat uchun matn (Telegram HTML) —
    def summary(self, cls, lo, hi, q):
        J = jm()
        rows, lessons, _d = self.rows(cls, lo, hi, q)
        sm = J.risk_summary(rows)
        avg = f"{sm['avg']:.2f}" if sm["avg"] is not None else "—"
        att = f"{sm['att']:.1f}%" if sm["att"] is not None else "—"
        head = (f"📊 <b>{esc(self.label(cls), quote=False)}</b>\n{esc(J.period_title(lo, hi, q), quote=False)}\n"
                f"Dars kunlari: <b>{lessons}</b> · o'rtacha ball: <b>{avg}</b> · davomat: <b>{att}</b>\n"
                f"Xavf ostida: <b>{sm['risk']}</b> / {sm['n']}")
        if not rows:
            return [head + "\n\nO'quvchilar yo'q."]
        lines = [f"{'№':>2} {'O`quvchi':<16} {'O`rt':>4} {'Dav%':>4}" + (" Ball Bh" if q else "")]
        for i, r in enumerate(rows, 1):
            name = r["name"] if len(r["name"]) <= 16 else r["name"][:15] + "…"
            a = f"{r['avg']:.1f}" if r["avg"] is not None else "—"
            d = f"{r['att']:.0f}" if r["att"] is not None else "—"
            line = f"{i:>2} {name:<16} {a:>4} {d:>4}"
            if q:
                qr = r["q"]
                line += f" {qr['total']:>4.0f} {qr['grade'] if qr and qr['complete'] else '–':>2}" if qr else "    –  –"
            lines.append(line + (" ⚠" if r["risk"] else ""))
        foot = ("\n<i>Dav% — davomat; " + ("Ball — chorak balli (100 dan); Bh — tavsiya etilgan baho; " if q else "")
                + "⚠ — xavf ostida.</i>")
        out, chunk = [], []
        for ln in lines:                                        # Telegram xabari 4096 belgidan oshmasin
            if sum(len(x) + 1 for x in chunk) + len(ln) > 3000:
                out.append(chunk)
                chunk = [lines[0]]
            chunk.append(ln)
        out.append(chunk)
        msgs = [f"<pre>{esc(chr(10).join(c), quote=False)}</pre>" for c in out]
        msgs[0] = head + "\n\n" + msgs[0]
        msgs[-1] += foot
        return msgs

    def risk_text(self, cls, lo, hi, q):
        J = jm()
        rows, _l, _d = self.rows(cls, lo, hi, q)
        bad = [r for r in rows if r["risk"]]
        head = f"⚠ <b>Xavf ostidagi o'quvchilar</b> — {esc(self.label(cls), quote=False)}\n{esc(J.period_title(lo, hi, q), quote=False)}\n\n"
        if not bad:
            return head + "Xavf ostidagi o'quvchi yo'q ✅"
        return head + "\n".join(f"{i}. <b>{esc(r['name'], quote=False)}</b> — {esc('; '.join(r['why']), quote=False)}" for i, r in enumerate(bad, 1))

    # — fayllar —
    def _name(self, cls, lo, hi, suffix, extra=""):
        J = jm()
        return self.tmp / f"{J.safe_name(self.label(cls))}{extra}_{lo}_{hi}{suffix}"

    def pdf(self, cls, lo, hi, q, only_risk=False):
        J = jm()
        self._apply()
        rows, lessons, _d = self.rows(cls, lo, hi, q)
        if only_risk:
            rows = [r for r in rows if r["risk"]]
        path = self._name(cls, lo, hi, ".pdf", "_xavf" if only_risk else "")
        J.write_pdf_fit(path, lambda f, pd: J.report_html(self.store, cls, lo, hi, q, rows, lessons, f, pd), landscape=True)
        return path

    def xlsx(self, cls, lo, hi, q):
        J = jm()
        self._apply()
        rows, lessons, _d = self.rows(cls, lo, hi, q)
        path = self._name(cls, lo, hi, ".xlsx")
        J.export_xlsx(str(path), self.store, cls, lo, hi, q, rows, lessons)
        return path

    def sheets(self, cls, lo, hi, q, names):
        """Ota-onalar uchun o'quvchi varaqlari: bitta PDF, har o'quvchi — alohida sahifa."""
        J = jm()
        self._apply()
        names = J.sort_pdf_items(names, lambda n: n)
        pages = [J.student_sheet_html(self.store, cls, n, lo, hi, q, first=(i == 0)) for i, n in enumerate(names)]
        html = "".join(p for p in pages if p)
        extra = "_" + J.safe_name(names[0]) if len(names) == 1 else "_varaqlar"
        path = self._name(cls, lo, hi, ".pdf", extra)
        J.write_pdf(path, html, landscape=False)
        return path
