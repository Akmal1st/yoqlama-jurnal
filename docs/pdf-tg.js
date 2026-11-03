/* Hisobotni PDF qilib Telegram botga yuborish (Akmal, 2026-11-03): Hisobotlar bo'limining har turi va BSB/CHSB tahlili eksporti.
   PDF brauzerda yasaladi: sahifa html2canvas (docs/vendor, birinchi kerak bo'lganda yuklanadi) bilan rasmga olinadi, A4 varaqlarga
   qator o'rtasidan kesmasdan bo'linadi va JPEG sahifali oddiy PDF faylga yoziladi (alohida PDF kutubxonasi kerak emas).
   Yuborish «Telegram'ga zaxira» ulangan botga (tgCfg: token, chat) sendDocument bilan. Asosiy skriptdan oldin ulanadi. */
const PTG = (() => {
  const H2C_SRC = "vendor/html2canvas-1.4.1.min.js";
  let h2cP = null;
  function loadH2C() {
    if (window.html2canvas) return Promise.resolve(window.html2canvas);
    if (!h2cP) h2cP = new Promise((ok, no) => { const s = document.createElement("script"); s.src = H2C_SRC;
      s.onload = () => ok(window.html2canvas); s.onerror = () => { h2cP = null; no(new Error("PDF kutubxonasini yuklab bo'lmadi — internetga ulanib, qayta urinib ko'ring")); }; document.head.append(s); });
    return h2cP;
  }

  /* ───────── PDF yozuvchi: har sahifa bitta JPEG rasm (A4, 10 mm chet) ───────── */
  async function pdf(pages) {   // pages: [{blob: image/jpeg, w, h (px), land}]
    const enc = new TextEncoder(), parts = [], offs = []; let len = 0;
    const put = (x) => { const b = typeof x === "string" ? enc.encode(x) : x; parts.push(b); len += b.length; };
    const obj = (n, body) => { offs[n] = len; put(`${n} 0 obj\n`); body(); put("\nendobj\n"); };
    put("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
    const n = pages.length, kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(" ");
    obj(1, () => put("<< /Type /Catalog /Pages 2 0 R >>"));
    obj(2, () => put(`<< /Type /Pages /Kids [${kids}] /Count ${n} >>`));
    for (let i = 0; i < n; i++) {
      const p = pages[i], pw = p.land ? 841.89 : 595.28, ph = p.land ? 595.28 : 841.89, m = 28.35;
      const s = Math.min((pw - 2 * m) / p.w, (ph - 2 * m) / p.h), dw = p.w * s, dh = p.h * s, x = (pw - dw) / 2, y = ph - m - dh;
      const img = new Uint8Array(await p.blob.arrayBuffer()), cs = `q ${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im Do Q`;
      const o = 3 + i * 3;
      obj(o, () => put(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im ${o + 1} 0 R >> >> /Contents ${o + 2} 0 R >>`));
      obj(o + 1, () => { put(`<< /Type /XObject /Subtype /Image /Width ${p.pxw} /Height ${p.pxh} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.length} >>\nstream\n`); put(img); put("\nendstream"); });
      obj(o + 2, () => put(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`));
    }
    const xref = len, last = 3 + n * 3;
    put(`xref\n0 ${last}\n0000000000 65535 f \n`);
    for (let k = 1; k < last; k++) put(`${String(offs[k]).padStart(10, "0")} 00000 n \n`);
    put(`trailer\n<< /Size ${last} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    return new Blob(parts, {type: "application/pdf"});
  }
  const jpeg = (cv) => new Promise((ok, no) => cv.toBlob((b) => b ? ok(b) : no(new Error("Sahifa rasmga olinmadi")), "image/jpeg", 0.9));
  function slice(cv, y0, y1, sc) {   // CSS px oralig'ini alohida canvasga kesish
    const out = document.createElement("canvas"); out.width = cv.width; out.height = Math.max(1, Math.round((y1 - y0) * sc));
    const c = out.getContext("2d"); c.fillStyle = "#fff"; c.fillRect(0, 0, out.width, out.height);
    c.drawImage(cv, 0, Math.round(y0 * sc), cv.width, out.height, 0, 0, out.width, out.height); return out;
  }

  /* ───────── Hisobotlar: ochiq hisobot paneli (chop etish ko'rinishida: jadvallar, tugmalarsiz) ───────── */
  const BRK = "tr, .psheet, .tiles, h2, h3, table, .hb-box, .bnd, .pst, svg, .card, p";
  async function reportPdf() {
    const sec = document.querySelector("main section.card.hb-panel"); if (!sec) throw new Error("Hisobot topilmadi");
    const h2c = await loadH2C(), sc = 2;
    document.body.classList.add("pmeas"); sec.classList.add("pdfx");
    const oldW = sec.style.width; let land = false, W = 760, breaks = [];
    try {
      sec.style.width = W + "px";
      if (sec.scrollWidth > W + 2) { land = true; W = Math.max(1080, sec.scrollWidth + 20); sec.style.width = W + "px"; }
      const cv = await h2c(sec, {scale: sc, backgroundColor: "#ffffff", logging: false, windowWidth: Math.max(1280, W + 100), useCORS: true,
        onclone: (doc) => { const s2 = doc.querySelector("main section.card.hb-panel"); if (!s2) return; const top = s2.getBoundingClientRect().top;
          breaks = [...s2.querySelectorAll(BRK)].map((e) => e.getBoundingClientRect().bottom - top).filter((v) => v > 0).sort((a, b) => a - b); }});
      const total = cv.height / sc, pageH = W * (land ? 190 / 277 : 277 / 190), pages = [];
      for (let y = 0; y < total - 1;) {
        let end = Math.min(total, y + pageH);
        if (end < total) { const b = breaks.filter((v) => v > y + pageH * 0.4 && v <= y + pageH).pop(); if (b) end = b; }
        const part = slice(cv, y, end, sc); pages.push({blob: await jpeg(part), w: W, h: end - y, pxw: part.width, pxh: part.height, land}); y = end;
      }
      return pdf(pages);
    } finally { sec.style.width = oldW; sec.classList.remove("pdfx"); document.body.classList.remove("pmeas"); }
  }

  /* ───────── BSB/CHSB tahlili: eksport oynasidagi tayyor varaqlar (har biri alohida PDF sahifa) ───────── */
  async function pagesPdf(htmlPages, land) {
    const h2c = await loadH2C(), sc = 2, box = document.createElement("div");
    box.className = "ptg-box"; box.innerHTML = htmlPages.join(""); document.body.append(box);
    try {
      const out = [];
      for (const pg of box.querySelectorAll(".bx-pg")) {
        const cv = await h2c(pg, {scale: sc, backgroundColor: "#ffffff", logging: false, windowWidth: 1400});
        out.push({blob: await jpeg(cv), w: pg.offsetWidth, h: pg.offsetHeight, pxw: cv.width, pxh: cv.height, land, full: true});
      }
      return pdf(out.map((p) => Object.assign(p, {land})));
    } finally { box.remove(); }
  }

  /* ───────── Telegram'ga yuborish ───────── */
  const safe = (s) => String(s).replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 90) || "hisobot";
  async function send(blob, name, caption) {
    const fd = new FormData(); fd.append("chat_id", tgCfg().chat); fd.append("caption", caption.slice(0, 1000)); fd.append("document", blob, safe(name) + ".pdf");
    return tgApi("sendDocument", fd);
  }
  let busy = false;
  async function run(make, name, caption, btn) {
    if (!tgOn()) { if (await confirmBox("Telegram ulanmagan", "PDF hisobot «Telegram'ga zaxira» ulangan botingizga boradi. Hozir ulaysizmi?", "Ulash")) { S.sec = 5; go("settings"); } return; }
    if (busy) return; busy = true; const t0 = btn && btn.textContent; if (btn) { btn.disabled = true; btn.textContent = "⏳ PDF…"; }
    try { toast("PDF tayyorlanmoqda…"); const b = await make(); await send(b, name, caption); toast("📄 PDF hisobot Telegram'ga yuborildi"); }
    catch (e) { console.warn("PDF/Telegram:", e); toast(e.net ? tgErrTxt(e) : e.message && /Telegram|Bad Request|Forbidden|Unauthorized/.test(e.message) ? tgErrTxt(e) : `PDF yuborilmadi: ${e.message}`); }
    finally { busy = false; if (btn) { btn.disabled = false; btn.textContent = t0; } }
  }
  return {reportPdf, pagesPdf, pdf, send, run, loadH2C};
})();
