/* Hisobotni PDF qilib Telegram botga yuborish (Akmal, 2026-11-03): Hisobotlar bo'limining har turi, BSB/CHSB tahlili eksporti,
   bo'sh varaq, davomat varag'i, chorak arxivi, TPT hujjatlari.
   2026-11-06 (Akmal: «rasmni PDF qilib jo'natyapti»): endi haqiqiy (vektor) PDF — matn tanlanadi va qidiriladi, chop etilganda tiniq.
   Qanday ishlaydi: tayyor varaq (HTML) brauzerda o'z dizaynida chiziladi, keyin DOM aylanib chiqiladi: fon, chegara, matn qatorlari,
   SVG diagrammalar — o'lchami va joyi ekrandagidek olinadi va jsPDF (docs/vendor, birinchi kerak bo'lganda yuklanadi) bilan PDF
   buyruqlariga aylanadi. Shriftlar PDF ichiga joylanadi (docs/vendor/pdf-shrift: Manrope, Liberation Serif = Times, Liberation Sans =
   Arial; o', g', ʻ, kirill harflari bor). Shriftda yo'q belgi (emoji, ikonka) kichik rasm bo'lib qo'yiladi.
   Yuborish «Telegram'ga zaxira» ulangan botga (tgCfg: token, chat) sendDocument bilan. Asosiy skriptdan oldin ulanadi. */
const PTG = (() => {
  const LIB_SRC = "vendor/jspdf-2.5.2.umd.min.js", FDIR = "vendor/pdf-shrift/";
  let libP = null;
  function loadLib() {
    if (window.jspdf) return Promise.resolve(window.jspdf.jsPDF);
    if (!libP) libP = new Promise((ok, no) => { const s = document.createElement("script"); s.src = LIB_SRC;
      s.onload = () => ok(window.jspdf.jsPDF); s.onerror = () => { libP = null; s.remove(); no(new Error("PDF kutubxonasini yuklab bo'lmadi — internetga ulanib, qayta urinib ko'ring")); }; document.head.append(s); });
    return libP;
  }

  /* ───────── shriftlar ───────── */
  const FILES = {m4: "manrope-400", m6: "manrope-600", m7: "manrope-700", m8: "manrope-800",
    sR: "lserif-Regular", sB: "lserif-Bold", sI: "lserif-Italic", sBI: "lserif-BoldItalic", aR: "lsans-Regular", aB: "lsans-Bold"};
  const fbin = {};
  function fontData(k) {   // shrift .js fayl ichida base64 (file:// da ham ishlaydi, fetch shart emas)
    if (window.PTGF && window.PTGF[k]) return Promise.resolve(window.PTGF[k]);
    if (!fbin[k]) fbin[k] = new Promise((ok, no) => { const s = document.createElement("script"); s.src = FDIR + FILES[k] + ".js";
      s.onload = () => { s.remove(); window.PTGF && window.PTGF[k] ? ok(window.PTGF[k]) : no(new Error("PDF shrifti buzilgan")); };
      s.onerror = () => { delete fbin[k]; s.remove(); no(new Error("PDF shriftini yuklab bo'lmadi — internetga ulanib, qayta urinib ko'ring")); }; document.head.append(s); });
    return fbin[k];
  }
  // CSS shrift → PDF shrifti (+ shu shriftda yo'q belgilar uchun zaxira)
  const SERIF = /times|liberation serif|tinos|georgia|pt serif|noto serif|cambria|book antiqua|garamond|^\s*serif/i;
  const SANS = /^\s*"?(arial|helvetica|liberation sans|arimo|calibri|tahoma|verdana|segoe ui)/i;
  function fontKey(fam, wt, it) {
    const b = wt >= 600;
    if (SERIF.test(fam.split(",")[0]) || (/serif/i.test(fam) && !/sans-serif/i.test(fam) && SERIF.test(fam))) return [it ? (b ? "sBI" : "sI") : (b ? "sB" : "sR"), b ? "aB" : "aR"];
    if (SANS.test(fam)) return [b ? "aB" : "aR", b ? "sB" : "sR"];
    return [wt >= 750 ? "m8" : wt >= 650 ? "m7" : b ? "m6" : "m4", b ? "aB" : "aR", b ? "sB" : "sR"];
  }
  const ICON = /bootstrap-icons/i;

  /* ───────── ranglar (har qanday CSS rangi: rgb, color-mix, oklab…) ───────── */
  const ccache = new Map(); let cctx = null;
  function color(s) {
    if (!s || s === "transparent" || s === "none") return null;
    let c = ccache.get(s); if (c !== undefined) return c;
    const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(s);
    if (m) { const a = m[4] == null ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : +m[4]; c = a <= 0.003 ? null : [+m[1], +m[2], +m[3], a]; }
    else {
      if (!cctx) { const cv = document.createElement("canvas"); cv.width = cv.height = 1; cctx = cv.getContext("2d", {willReadFrequently: true}); }
      cctx.clearRect(0, 0, 1, 1); cctx.fillStyle = "#000"; cctx.fillStyle = s; cctx.fillRect(0, 0, 1, 1);
      const d = cctx.getImageData(0, 0, 1, 1).data; c = d[3] < 1 ? null : [d[0], d[1], d[2], d[3] / 255];
    }
    ccache.set(s, c); return c;
  }

  /* ───────── matnning tayanch chizig'i (baseline): har shrift uchun bir marta o'lchanadi ───────── */
  const bcache = new Map();
  function baseRatio(cs) {
    const key = cs.fontFamily + "|" + cs.fontWeight + "|" + cs.fontStyle; let r = bcache.get(key); if (r != null) return r;
    const d = document.createElement("div");
    d.style.cssText = `position:fixed;left:-9999px;top:0;font-family:${cs.fontFamily};font-weight:${cs.fontWeight};font-style:${cs.fontStyle};font-size:100px;line-height:normal;white-space:nowrap`;
    d.innerHTML = '<span>Hxg</span><i style="display:inline-block;width:1px;height:0;vertical-align:baseline"></i>';
    document.body.append(d);
    const rg = document.createRange(); rg.selectNodeContents(d.firstChild); const t = rg.getBoundingClientRect().top, b = d.lastChild.getBoundingClientRect().bottom;
    d.remove(); r = (b - t) / 100; if (!(r > 0.3 && r < 1.5)) r = 0.8; bcache.set(key, r); return r;
  }

  /* ───────── CSS sanagichlari (counter) va ::before/::after — vaqtincha haqiqiy <span> bo'ladi ───────── */
  const PSEUDO_CSS = ".ptg-pb::before{content:none!important}.ptg-pa::after{content:none!important}";
  function pseudoContent(cs, el, ctr) {
    const c = cs.content; if (!c || c === "none" || c === "normal") return null;
    let out = "", ok = false;
    for (const m of c.matchAll(/"((?:[^"\\]|\\.)*)"|counter\(\s*([\w-]+)[^)]*\)|attr\(\s*([\w-]+)\s*\)|open-quote|close-quote/g)) {
      ok = true;
      if (m[1] != null) out += m[1].replace(/\\([0-9a-f]{1,6})\s?/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/\\(.)/g, "$1");
      else if (m[2]) out += ctr[m[2]] || 0; else if (m[3]) out += el.getAttribute(m[3]) || ""; else out += m[0] === "open-quote" ? "«" : "»";
    }
    return ok ? out : null;
  }
  function counters(cs, ctr) {
    const rs = cs.counterReset; if (rs && rs !== "none") for (const m of rs.matchAll(/([\w-]+)(?:\s+(-?\d+))?/g)) ctr[m[1]] = +(m[2] || 0);
    const inc = cs.counterIncrement; if (inc && inc !== "none") for (const m of inc.matchAll(/([\w-]+)(?:\s+(-?\d+))?/g)) ctr[m[1]] = (ctr[m[1]] || 0) + +(m[2] == null ? 1 : m[2]);
  }
  function materialize(root) {
    const ctr = {}, jobs = [];
    const pseudo = (el, ps) => {
      const p = getComputedStyle(el, ps); if (p.display === "none") return;
      counters(p, ctr); const txt = pseudoContent(p, el, ctr);
      if (txt == null || /^(IMG|INPUT|TEXTAREA|SELECT|BR|HR)$/.test(el.tagName)) return;
      const st = []; for (let i = 0; i < p.length; i++) { const k = p[i]; if (!/^(content|counter-|transition|animation|quotes)/.test(k)) st.push(`${k}:${p.getPropertyValue(k)}`); }
      jobs.push([el, ps, txt, st.join(";")]);
    };
    const visit = (el) => {
      const cs = getComputedStyle(el); if (cs.display === "none") return;
      counters(cs, ctr); pseudo(el, "::before");
      for (const ch of el.children) visit(ch);
      pseudo(el, "::after");
    };
    visit(root);
    const st = document.createElement("style"); st.textContent = PSEUDO_CSS; document.head.append(st);
    const made = [];
    for (const [el, ps, txt, css] of jobs) {
      const sp = document.createElement("span"); sp.className = "ptg-ps"; sp.style.cssText = css; sp.textContent = txt;
      if (ps === "::before") { el.prepend(sp); el.classList.add("ptg-pb"); } else { el.append(sp); el.classList.add("ptg-pa"); }
      made.push(sp);
    }
    return () => { made.forEach((s) => s.remove()); root.querySelectorAll(".ptg-pb,.ptg-pa").forEach((e) => e.classList.remove("ptg-pb", "ptg-pa")); root.classList.remove("ptg-pb", "ptg-pa"); st.remove(); };
  }

  /* ───────── DOM → chizish buyruqlari ro'yxati (CSS px, ildiz elementning chap-yuqori burchagiga nisbatan) ───────── */
  const px = (v) => parseFloat(v) || 0;
  function radii(cs, w, h) {
    const one = (v, base) => { const [a, b] = v.split(" "); const f = (x, bs) => x && x.endsWith("%") ? parseFloat(x) / 100 * bs : px(x); return [f(a, w), f(b || a, h)]; };
    let r = [one(cs.borderTopLeftRadius, 0), one(cs.borderTopRightRadius, 0), one(cs.borderBottomRightRadius, 0), one(cs.borderBottomLeftRadius, 0)].map(([a, b]) => Math.min(a, b));
    const f = Math.min(1, w / Math.max(1e-6, r[0] + r[1]), w / Math.max(1e-6, r[3] + r[2]), h / Math.max(1e-6, r[0] + r[3]), h / Math.max(1e-6, r[1] + r[2]));
    return r.some((v) => v > 0.2) ? r.map((v) => v * f) : null;
  }
  function collect(root) {
    const R = root.getBoundingClientRect(), ox = R.left, oy = R.top, ops = [];
    const add = (o, y0, y1) => { o.y0 = y0; o.y1 = y1; ops.push(o); };
    const canv = document.createElement("canvas").getContext("2d");

    function textNode(node, cs, op) {
      const s = node.data; if (!s || !/\S/.test(s)) return;
      const col = color(cs.color); if (!col) return;
      const fs = px(cs.fontSize); if (fs < 1) return;
      const pre = /^pre/.test(cs.whiteSpace), rg = document.createRange(), words = [];
      const re = pre ? /[^\n]+/g : /\S+/g;
      for (let m; (m = re.exec(s));) {
        rg.setStart(node, m.index); rg.setEnd(node, m.index + m[0].length);
        const rs = rg.getClientRects(); if (!rs.length) continue;
        if (rs.length === 1 || pre) { const r = rs[0]; if (r.width > 0 || r.height > 0) words.push({t: m[0], l: r.left, r: r.right, top: r.top, b: r.bottom}); continue; }
        // so'z qatorlarga bo'lingan: har bo'lagini harflab ajratamiz
        let cur = null;
        for (let i = 0; i < m[0].length; i++) {
          rg.setStart(node, m.index + i); rg.setEnd(node, m.index + i + 1); const r = rg.getBoundingClientRect();
          if (cur && Math.abs(r.top - cur.top) < fs * 0.5) { cur.t += m[0][i]; cur.r = r.right; }
          else { if (cur) words.push(cur); cur = {t: m[0][i], l: r.left, r: r.right, top: r.top, b: r.bottom}; }
        }
        if (cur) words.push(cur);
      }
      if (!words.length) return;
      const tt = cs.textTransform, br = baseRatio(cs), wt = +cs.fontWeight || (cs.fontWeight === "bold" ? 700 : 400), it = /italic|oblique/.test(cs.fontStyle);
      const keys = ICON.test(cs.fontFamily) ? null : fontKey(cs.fontFamily, wt, it), ls = px(cs.letterSpacing);
      const ul = /underline/.test(cs.textDecorationLine), lt = /line-through/.test(cs.textDecorationLine);
      const lines = [];
      for (const w of words) { const L = lines[lines.length - 1]; if (L && Math.abs(w.top - L.top) < fs * 0.5 && w.l >= L.r - 1) { L.t += " " + w.t; L.r = w.r; L.b = Math.max(L.b, w.b); } else lines.push({...w}); }
      for (const L of lines) {
        let t = L.t; if (tt === "uppercase") t = t.toUpperCase(); else if (tt === "lowercase") t = t.toLowerCase(); else if (tt === "capitalize") t = t.replace(/(^|\s)(\S)/g, (a, b, c) => b + c.toUpperCase());
        const y = L.top + br * fs - oy;
        add({k: "text", x: L.l - ox, y, w: L.r - L.l, t, keys, fs, col, op, ls, ul, lt, font: `${cs.fontStyle} ${cs.fontWeight} ${fs}px ${cs.fontFamily}`}, L.top - oy, L.b - oy);
      }
    }

    function box(el, cs, op) {
      const bg = color(cs.backgroundColor), bt = px(cs.borderTopWidth), brw = px(cs.borderRightWidth), bb = px(cs.borderBottomWidth), bl = px(cs.borderLeftWidth);
      const hasB = (bt && cs.borderTopStyle !== "none" && cs.borderTopStyle !== "hidden") || (brw && cs.borderRightStyle !== "none") || (bb && cs.borderBottomStyle !== "none") || (bl && cs.borderLeftStyle !== "none");
      let grad = null; if (!bg && cs.backgroundImage && cs.backgroundImage.includes("gradient")) { const m = cs.backgroundImage.match(/(rgba?\([^)]*\)|#[0-9a-f]{3,8})/i); grad = m && color(m[1]); }
      // box-shadow: faqat xiralashmagan (blur 0) soyalar — chiziq/halqa sifatida (masalan xavf ostidagi qatorning qizil chizig'i)
      const sh = [];
      if (cs.boxShadow && cs.boxShadow !== "none") for (const part of cs.boxShadow.split(/,(?![^(]*\))/)) {
        const c = color((part.match(/(rgba?\([^)]*\)|color\([^)]*\)|#[0-9a-f]{3,8}|oklab\([^)]*\)|oklch\([^)]*\))/i) || [])[1]);
        const n = part.replace(/(rgba?|color|oklab|oklch)\([^)]*\)/gi, "").match(/-?[\d.]+px/g) || [];
        const [sx, sy, bl, sp] = [0, 1, 2, 3].map((i) => px(n[i])); if (c && bl < 0.5 && (sx || sy || sp)) sh.push({c, sx, sy, sp, ins: /inset/.test(part)});
      }
      if (!bg && !grad && !hasB && !sh.length) return;
      const rects = cs.display === "inline" ? [...el.getClientRects()] : [el.getBoundingClientRect()];
      for (const r of rects) {
        if (r.width < 0.01 && r.height < 0.01) continue;
        const x = r.left - ox, y = r.top - oy, w = r.width, h = r.height, rad = radii(cs, w, h);
        for (const q of sh) if (!q.ins) add({k: "ring", o: [x + q.sx - q.sp, y + q.sy - q.sp, w + 2 * q.sp, h + 2 * q.sp], i: [x, y, w, h], rad, fill: q.c, op}, y - q.sp + Math.min(0, q.sy), y + h + q.sp + Math.max(0, q.sy));
        if (bg || grad) add({k: "rect", x, y, w, h, rad, fill: bg || grad, op}, y, y + h);
        for (const q of sh) if (q.ins) add({k: "ring", o: [x, y, w, h], i: [x + q.sx + q.sp, y + q.sy + q.sp, w - 2 * q.sp, h - 2 * q.sp], rad, fill: q.c, op, clip: true}, y, y + h);
        if (!hasB) continue;
        const sides = [["Top", bt], ["Right", brw], ["Bottom", bb], ["Left", bl]].map(([s, wd]) => ({wd, st: cs[`border${s}Style`], c: color(cs[`border${s}Color`])}));
        const vis = (q) => q.wd > 0 && q.c && q.st !== "none" && q.st !== "hidden";
        const same = sides.every((q) => vis(q) && q.wd === sides[0].wd && q.st === sides[0].st && q.c.join() === sides[0].c.join());
        if (rad && same) {   // yumaloq burchakli bir xil chegara — konturni chizamiz
          const q = sides[0], i = q.wd / 2; add({k: "srect", x: x + i, y: y + i, w: w - q.wd, h: h - q.wd, rad: rad.map((v) => Math.max(0, v - i)), col: q.c, lw: q.wd, dash: q.st, op}, y, y + h);
          continue;
        }
        const S = [[x, y, w, sides[0].wd, 0], [x + w - sides[1].wd, y, sides[1].wd, h, 1], [x, y + h - sides[2].wd, w, sides[2].wd, 0], [x, y, sides[3].wd, h, 1]];
        S.forEach(([sx, sy, sw, sh, v], k) => { const q = sides[k]; if (!vis(q)) return;
          if (q.st === "dashed" || q.st === "dotted") add({k: "line", x1: v ? sx + sw / 2 : sx, y1: v ? sy : sy + sh / 2, x2: v ? sx + sw / 2 : sx + sw, y2: v ? sy + sh : sy + sh / 2, col: q.c, lw: q.wd, dash: q.st, op}, sy, sy + sh);
          else add({k: "rect", x: sx, y: sy, w: sw, h: sh, fill: q.c, op}, sy, sy + sh); });
      }
    }

    function image(el, op) {
      const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return;
      try {
        const cv = document.createElement("canvas"), s = 3; cv.width = Math.round(r.width * s); cv.height = Math.round(r.height * s);
        cv.getContext("2d").drawImage(el, 0, 0, cv.width, cv.height);
        add({k: "img", x: r.left - ox, y: r.top - oy, w: r.width, h: r.height, src: cv.toDataURL("image/png"), op}, r.top - oy, r.bottom - oy);
      } catch (e) { /* boshqa domendan rasm — o'tkazib yuboriladi */ }
    }

    /* SVG: oddiy shakllar vektor bo'lib o'tadi (getScreenCTM — viewBox va CSS transform bilan) */
    function svg(el, op0) {
      const walkS = (n, op) => {
        if (n.nodeType !== 1) return; const cs = getComputedStyle(n); if (cs.display === "none") return;
        op *= px(cs.opacity === "" ? 1 : cs.opacity) || (cs.opacity === "0" ? 0 : 1); if (op <= 0) return;
        const tag = n.tagName.toLowerCase();
        if (tag === "g" || tag === "svg" || tag === "a") { for (const c of n.children) walkS(c, op); return; }
        if (cs.visibility === "hidden" || !n.getScreenCTM) return;
        const M = n.getScreenCTM(); if (!M) return;
        const T = (x, y) => [M.a * x + M.c * y + M.e - ox, M.b * x + M.d * y + M.f - oy], sc = Math.sqrt(Math.abs(M.a * M.d - M.b * M.c));
        const fill = cs.fill && !cs.fill.startsWith("url") ? color(cs.fill) : null, stroke = cs.stroke && !cs.stroke.startsWith("url") ? color(cs.stroke) : null;
        const fo = +cs.fillOpacity, so = +cs.strokeOpacity, lw = px(cs.strokeWidth) * sc;
        const dash = cs.strokeDasharray && cs.strokeDasharray !== "none" ? cs.strokeDasharray.split(/[\s,]+/).map((v) => px(v) * sc) : null;
        const A = (nm) => { const a = n[nm]; return a && a.baseVal ? a.baseVal.value : 0; };
        if (tag === "text") {
          const t = n.textContent.replace(/\s+/g, " ").trim(); if (!t || !fill) return;
          let p0, len; try { p0 = n.getStartPositionOfChar(0); len = n.getComputedTextLength(); } catch (e) { return; }
          const [x, y] = T(p0.x, p0.y), [x2, y2] = T(p0.x + len, p0.y), fs = px(cs.fontSize) * sc, wt = +cs.fontWeight || 400;
          add({k: "text", x, y, w: Math.hypot(x2 - x, y2 - y), t, keys: fontKey(cs.fontFamily, wt, /italic/.test(cs.fontStyle)), fs, col: [...fill.slice(0, 3), fill[3] * fo], op, ls: 0, font: `${cs.fontStyle} ${cs.fontWeight} ${fs}px ${cs.fontFamily}`}, y - fs, y + fs * 0.3);
          return;
        }
        let segs = [];
        const K = 0.5523;
        const ell = (cx, cy, rx, ry) => { segs.push(["M", cx + rx, cy], ["C", cx + rx, cy + ry * K, cx + rx * K, cy + ry, cx, cy + ry], ["C", cx - rx * K, cy + ry, cx - rx, cy + ry * K, cx - rx, cy],
          ["C", cx - rx, cy - ry * K, cx - rx * K, cy - ry, cx, cy - ry], ["C", cx + rx * K, cy - ry, cx + rx, cy - ry * K, cx + rx, cy], ["Z"]); };
        if (tag === "rect") { const x = A("x"), y = A("y"), w = A("width"), h = A("height"); if (w <= 0 || h <= 0) return; segs.push(["M", x, y], ["L", x + w, y], ["L", x + w, y + h], ["L", x, y + h], ["Z"]); }
        else if (tag === "circle") { const r = A("r"); if (r <= 0) return; ell(A("cx"), A("cy"), r, r); }
        else if (tag === "ellipse") ell(A("cx"), A("cy"), A("rx"), A("ry"));
        else if (tag === "line") segs.push(["M", A("x1"), A("y1")], ["L", A("x2"), A("y2")]);
        else if (tag === "polyline" || tag === "polygon") { const p = [...n.points]; if (!p.length) return; p.forEach((q, i) => segs.push([i ? "L" : "M", q.x, q.y])); if (tag === "polygon") segs.push(["Z"]); }
        else if (tag === "path") { segs = parsePath(n.getAttribute("d") || ""); if (!segs) return rasterSvg(n, op); }
        else return;
        segs = segs.map((s) => { const o = [s[0]]; for (let i = 1; i < s.length; i += 2) o.push(...T(s[i], s[i + 1])); return o; });
        const xs = [], ys = []; segs.forEach((s) => { for (let i = 1; i < s.length; i += 2) { xs.push(s[i]); ys.push(s[i + 1]); } });
        if (!xs.length) return;
        const closedFill = tag !== "line" && fill;
        add({k: "path", segs, fill: closedFill ? [...fill.slice(0, 3), fill[3] * fo] : null, stroke: stroke && lw > 0 ? [...stroke.slice(0, 3), stroke[3] * so] : null, lw, dash,
          cap: cs.strokeLinecap, join: cs.strokeLinejoin, op}, Math.min(...ys) - lw, Math.max(...ys) + lw);
      };
      const rasterSvg = (n, op) => image(n, op);
      for (const c of el.children) walkS(c, op0);
    }

    function marker(el, cs, op) {   // ro'yxat belgisi (•, 1.) — ::marker DOM da yo'q
      const t = cs.listStyleType, col = color(cs.color), fs = px(cs.fontSize); if (!col) return;
      let n = 1; if (/decimal|alpha|roman/.test(t)) { const ol = el.parentElement; n = ol && ol.start ? ol.start : 1; for (let e = el.previousElementSibling; e; e = e.previousElementSibling) if (getComputedStyle(e).display === "list-item") n++; }
      const m = t === "disc" ? "•" : t === "circle" ? "◦" : t === "square" ? "▪" : t === "decimal" ? n + "." : t === "lower-alpha" || t === "lower-latin" ? String.fromCharCode(96 + n) + "." : t === "upper-alpha" || t === "upper-latin" ? String.fromCharCode(64 + n) + "." : "•";
      const rg = document.createRange(); rg.selectNodeContents(el); const rs = [...rg.getClientRects()].filter((r) => r.height > 0); const r0 = el.getBoundingClientRect();
      const top = rs.length ? rs[0].top : r0.top; canv.font = `${cs.fontStyle} ${cs.fontWeight} ${fs}px ${cs.fontFamily}`;
      const w = canv.measureText(m).width, sp = canv.measureText(m + " ").width, x = r0.left - sp - ox, y = top + baseRatio(cs) * fs - oy;
      add({k: "text", x, y, w, t: m, keys: fontKey(cs.fontFamily, +cs.fontWeight || 400, false), fs, col, op, ls: 0, font: canv.font}, y - fs, y + fs * 0.3);
    }

    function walk(el, op) {
      const cs = getComputedStyle(el); if (cs.display === "none") return;
      const tag = el.tagName;
      if (/^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT|HEAD)$/.test(tag)) return;
      op *= cs.opacity === "" ? 1 : +cs.opacity; if (op <= 0.003) return;
      const vis = cs.visibility !== "hidden";
      if (vis) box(el, cs, op);
      if (tag === "svg" || el instanceof SVGSVGElement) { if (vis) svg(el, op); return; }
      if (tag === "IMG" || tag === "CANVAS") { if (vis) image(el, op); return; }
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (vis && cs.display === "list-item" && cs.listStyleType !== "none" && cs.listStylePosition !== "inside") marker(el, cs, op);
      const clip = cs.overflowX !== "visible" || cs.overflowY !== "visible";
      if (clip) {
        const r = el.getBoundingClientRect(), bl = px(cs.borderLeftWidth), btp = px(cs.borderTopWidth);
        const x = r.left - ox + bl, y = r.top - oy + btp, w = r.width - bl - px(cs.borderRightWidth), h = r.height - btp - px(cs.borderBottomWidth);
        add({k: "clip", x, y, w, h, rad: radii(cs, w, h)}, -1e9, 1e9);
      }
      for (const n of el.childNodes) {
        if (n.nodeType === 3) { if (vis) textNode(n, cs, op); }
        else if (n.nodeType === 1) walk(n, op);
      }
      if (clip) add({k: "unclip"}, -1e9, 1e9);
    }
    walk(root, 1);
    return {ops, w: R.width, h: R.height, canv};
  }

  // SVG path: M L H V C S Q T Z (nisbiy ham); yoy (A) bo'lsa — null (rasm bo'lib qo'yiladi)
  function parsePath(d) {
    const tk = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) || [], out = [];
    let i = 0, cmd = "", x = 0, y = 0, sx = 0, sy = 0, lc = null;
    const num = () => +tk[i++];
    while (i < tk.length) {
      if (/[a-zA-Z]/.test(tk[i])) cmd = tk[i++]; else if (!cmd) return null;
      const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase(), bx = rel ? x : 0, by = rel ? y : 0;
      if (C === "Z") { out.push(["Z"]); x = sx; y = sy; lc = null; continue; }
      if (C === "A") return null;
      if (C === "M") { x = bx + num(); y = by + num(); sx = x; sy = y; out.push(["M", x, y]); cmd = rel ? "l" : "L"; lc = null; }
      else if (C === "L") { x = bx + num(); y = by + num(); out.push(["L", x, y]); lc = null; }
      else if (C === "H") { x = bx + num(); out.push(["L", x, y]); lc = null; }
      else if (C === "V") { y = (rel ? y : 0) + num(); out.push(["L", x, y]); lc = null; }
      else if (C === "C") { const a = [bx + num(), by + num(), bx + num(), by + num(), bx + num(), by + num()]; out.push(["C", ...a]); lc = [a[2], a[3]]; x = a[4]; y = a[5]; }
      else if (C === "S") { const c1 = lc ? [2 * x - lc[0], 2 * y - lc[1]] : [x, y], a = [bx + num(), by + num(), bx + num(), by + num()]; out.push(["C", ...c1, ...a]); lc = [a[0], a[1]]; x = a[2]; y = a[3]; }
      else if (C === "Q" || C === "T") {
        const q = C === "Q" ? [bx + num(), by + num()] : lc ? [2 * x - lc[0], 2 * y - lc[1]] : [x, y], e = [bx + num(), by + num()];
        out.push(["C", x + 2 / 3 * (q[0] - x), y + 2 / 3 * (q[1] - y), e[0] + 2 / 3 * (q[0] - e[0]), e[1] + 2 / 3 * (q[1] - e[1]), e[0], e[1]]); lc = q; x = e[0]; y = e[1];
      } else return null;
      if (out.length && out[out.length - 1].some((v) => typeof v === "number" && !isFinite(v))) return null;
    }
    return out;
  }

  /* ───────── buyruqlar → jsPDF ───────── */
  async function newDoc() {
    const J = await loadLib();
    const doc = new J({unit: "pt", format: "a4", compress: true, putOnlyUsedFonts: true});
    doc.setProperties({creator: "Yo'qlama jurnali", producer: "Yo'qlama jurnali"});
    doc.setCharSpace(0);   // Tc/Tz matn holati PDF da keyingi matnga o'tib qoladi — har matnda aniq qiymat yoziladi
    return {doc, fonts: {}, gs: {}, cmap: {}, first: true};
  }
  async function needFonts(D, list) {
    const keys = new Set(); list.forEach((L) => L.ops.forEach((o) => o.k === "text" && o.keys && o.keys.forEach((k) => keys.add(k))));
    // faqat kerakli shriftlar yuklanadi: avval asosiylari, zaxirasi esa matnda shu shriftda yo'q belgi bo'lsa
    const prim = new Set(); list.forEach((L) => L.ops.forEach((o) => o.k === "text" && o.keys && prim.add(o.keys[0])));
    const load = async (k) => { if (D.fonts[k]) return; const b = await fontData(k); D.doc.addFileToVFS(k + ".ttf", b); D.doc.addFont(k + ".ttf", k, "normal", "normal", "Identity-H");
      D.doc.setFont(k, "normal"); const f = D.doc.getFont(); D.cmap[k] = f.metadata && f.metadata.cmap && f.metadata.cmap.unicode ? f.metadata.cmap.unicode.codeMap : null; D.fonts[k] = 1; };
    await Promise.all([...prim].map(load));
    const miss = new Set();
    list.forEach((L) => L.ops.forEach((o) => { if (o.k !== "text" || !o.keys) return; const cm = D.cmap[o.keys[0]]; if (!cm) return;
      for (const ch of o.t) { const cp = ch.codePointAt(0); if (cp > 32 && !cm[cp]) { o.keys.slice(1).forEach((k) => miss.add(k)); break; } } }));
    await Promise.all([...miss].filter((k) => keys.has(k)).map(load));
  }
  function setOp(D, a) {
    a = Math.max(0, Math.min(1, a)); const k = a.toFixed(2);
    if (D.curOp === k) return; D.curOp = k;
    if (!D.gs[k]) D.gs[k] = new D.doc.GState({opacity: a, "stroke-opacity": a});
    D.doc.setGState(D.gs[k]);
  }
  function rpath(doc, x, y, w, h, r) {   // yumaloq burchakli to'rtburchak yo'li (r: [tl,tr,br,bl])
    if (!r) { doc.moveTo(x, y); doc.lineTo(x + w, y); doc.lineTo(x + w, y + h); doc.lineTo(x, y + h); doc.close(); return; }
    const K = 0.5523, [a, b, c, d] = r;
    doc.moveTo(x + a, y); doc.lineTo(x + w - b, y); if (b) doc.curveTo(x + w - b + b * K, y, x + w, y + b - b * K, x + w, y + b);
    doc.lineTo(x + w, y + h - c); if (c) doc.curveTo(x + w, y + h - c + c * K, x + w - c + c * K, y + h, x + w - c, y + h);
    doc.lineTo(x + d, y + h); if (d) doc.curveTo(x + d - d * K, y + h, x, y + h - d + d * K, x, y + h - d);
    doc.lineTo(x, y + a); if (a) doc.curveTo(x, y + a - a * K, x + a - a * K, y, x + a, y); doc.close();
  }
  const dashOf = (st, lw) => st === "dashed" ? [lw * 3, lw * 3] : st === "dotted" ? [lw, lw * 1.6] : null;
  function charImg(D, ch, font, col, fs) {   // shriftda yo'q belgi (emoji, ikonka) — kichik PNG
    const key = ch + "|" + font + "|" + col.join(); if (D.cimg && D.cimg[key]) return D.cimg[key];
    D.cimg = D.cimg || {};
    const cv = document.createElement("canvas"), c = cv.getContext("2d"), s = 4; c.font = font; const w = Math.max(1, c.measureText(ch).width);
    cv.width = Math.ceil(w * s) + 2; cv.height = Math.ceil(fs * 1.4 * s); const c2 = cv.getContext("2d"); c2.scale(s, s); c2.font = font; c2.textBaseline = "alphabetic";
    c2.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`; c2.fillText(ch, 0, fs * 1.05);
    return (D.cimg[key] = {src: cv.toDataURL("image/png"), w, h: fs * 1.4, base: fs * 1.05});
  }
  function emitText(D, o, X, Y, k) {
    const doc = D.doc, fs = o.fs * k;
    // belgilarni shriftlar bo'yicha bo'laklarga ajratish
    const runs = [];
    for (const ch of o.t) {
      const cp = ch.codePointAt(0); let f = null;
      if (o.keys) { if (cp === 32) f = runs.length ? runs[runs.length - 1].f : o.keys[0]; else for (const kk of o.keys) { const cm = D.cmap[kk]; if (D.fonts[kk] && (!cm || cm[cp])) { f = kk; break; } } }
      if (!f && cp === 32) f = runs.length ? runs[runs.length - 1].f : "img";
      f = f || "img";
      const L = runs[runs.length - 1]; if (L && L.f === f && f !== "img") L.t += ch; else runs.push({f, t: ch});
    }
    const csp = o.ls * k;
    let nat = 0;
    for (const r of runs) {
      if (r.f === "img") { const ci = charImg(D, r.t, o.font, o.col, o.fs); r.w = ci.w * k; r.ci = ci; }
      else { doc.setFont(r.f, "normal"); doc.setFontSize(fs); r.w = doc.getStringUnitWidth(r.t) * fs + csp * [...r.t].length; }
      nat += r.w;
    }
    const tw = o.w * k; let h = nat > 0 && tw > 0 ? tw / nat : 1; if (h < 0.7 || h > 1.3) h = 1;
    setOp(D, o.op * o.col[3]); doc.setTextColor(o.col[0], o.col[1], o.col[2]);
    let x = X;
    for (const r of runs) {
      if (r.f === "img") { const ci = r.ci; doc.addImage(ci.src, "PNG", x, Y - ci.base * k, ci.w * k * h, ci.h * k, undefined, "FAST"); }
      else { doc.setFont(r.f, "normal"); doc.setFontSize(fs); doc.text(r.t, x, Y, {baseline: "alphabetic", horizontalScale: h, charSpace: csp}); }
      x += r.w * h;
    }
    if (o.ul || o.lt) { doc.setDrawColor(o.col[0], o.col[1], o.col[2]); doc.setLineWidth(Math.max(0.4, fs / 16)); const yy = o.ul ? Y + fs * 0.12 : Y - fs * 0.3; doc.line(X, yy, X + tw, yy); }
  }
  // bitta PDF sahifasi: buyruqlar ro'yxatidan [y0, y1) oralig'i, k = pt/px, (X0, Y0) — chap-yuqori burchak pt da
  function emitPage(D, L, y0, y1, k, X0, Y0, land) {
    const doc = D.doc;
    if (D.first) { D.first = false; if (land) { doc.deletePage(1); doc.addPage("a4", "l"); } } else doc.addPage("a4", land ? "l" : "p");
    D.curOp = null; setOp(D, 1);
    const X = (x) => X0 + x * k, Y = (y) => Y0 + (y - y0) * k;
    // sahifa chegarasi bo'yicha kesish
    doc.saveGraphicsState(); rpath(doc, X(0), Y(y0), L.w * k, (y1 - y0) * k, null); doc.clip(); doc.discardPath();
    let depth = 0;
    for (const o of L.ops) {
      if (o.k === "clip") { doc.saveGraphicsState(); depth++; D.curOp = null; rpath(doc, X(o.x), Y(o.y), o.w * k, o.h * k, o.rad && o.rad.map((v) => v * k)); doc.clip(); doc.discardPath(); continue; }
      if (o.k === "unclip") { if (depth) { doc.restoreGraphicsState(); depth--; D.curOp = null; } continue; }
      if (o.y1 < y0 - 2 || o.y0 > y1 + 2) continue;
      if (o.k === "rect") { setOp(D, o.op * o.fill[3]); doc.setFillColor(o.fill[0], o.fill[1], o.fill[2]); rpath(doc, X(o.x), Y(o.y), o.w * k, o.h * k, o.rad && o.rad.map((v) => v * k)); doc.fill(); }
      else if (o.k === "ring") {   // tashqi va ichki to'rtburchak orasi (even-odd)
        if (o.clip) { doc.saveGraphicsState(); rpath(doc, X(o.o[0]), Y(o.o[1]), o.o[2] * k, o.o[3] * k, o.rad && o.rad.map((v) => v * k)); doc.clip(); doc.discardPath(); D.curOp = null; }
        setOp(D, o.op * o.fill[3]); doc.setFillColor(o.fill[0], o.fill[1], o.fill[2]);
        rpath(doc, X(o.o[0]), Y(o.o[1]), o.o[2] * k, o.o[3] * k, !o.clip && o.rad ? o.rad.map((v) => v * k) : o.clip ? o.rad && o.rad.map((v) => v * k) : null);
        if (o.i[2] > 0 && o.i[3] > 0) rpath(doc, X(o.i[0]), Y(o.i[1]), o.i[2] * k, o.i[3] * k, o.rad && o.rad.map((v) => v * k));
        doc.fillEvenOdd(); if (o.clip) { doc.restoreGraphicsState(); D.curOp = null; }
      }
      else if (o.k === "srect") { setOp(D, o.op * o.col[3]); doc.setDrawColor(o.col[0], o.col[1], o.col[2]); doc.setLineWidth(o.lw * k); const ds = dashOf(o.dash, o.lw * k); doc.setLineDashPattern(ds || [], 0);
        rpath(doc, X(o.x), Y(o.y), o.w * k, o.h * k, o.rad.map((v) => v * k)); doc.stroke(); if (ds) doc.setLineDashPattern([], 0); }
      else if (o.k === "line") { setOp(D, o.op * o.col[3]); doc.setDrawColor(o.col[0], o.col[1], o.col[2]); doc.setLineWidth(o.lw * k); const ds = dashOf(o.dash, o.lw * k); doc.setLineDashPattern(ds || [], 0);
        doc.line(X(o.x1), Y(o.y1), X(o.x2), Y(o.y2)); if (ds) doc.setLineDashPattern([], 0); }
      else if (o.k === "path") {
        const draw = (fill) => { for (const s of o.segs) { if (s[0] === "M") doc.moveTo(X(s[1]), Y(s[2])); else if (s[0] === "L") doc.lineTo(X(s[1]), Y(s[2])); else if (s[0] === "C") doc.curveTo(X(s[1]), Y(s[2]), X(s[3]), Y(s[4]), X(s[5]), Y(s[6])); else if (s[0] === "Z") doc.close(); }
          if (fill) doc.fill(); else doc.stroke(); };
        if (o.fill) { setOp(D, o.op * o.fill[3]); doc.setFillColor(o.fill[0], o.fill[1], o.fill[2]); draw(true); }
        if (o.stroke) { setOp(D, o.op * o.stroke[3]); doc.setDrawColor(o.stroke[0], o.stroke[1], o.stroke[2]); doc.setLineWidth(o.lw * k);
          doc.setLineCap(o.cap === "round" ? "round" : o.cap === "square" ? "square" : "butt"); doc.setLineJoin(o.join === "round" ? "round" : o.join === "bevel" ? "bevel" : "miter");
          doc.setLineDashPattern(o.dash ? o.dash.map((v) => v * k) : [], 0); draw(false); doc.setLineDashPattern([], 0); doc.setLineCap("butt"); doc.setLineJoin("miter"); }
      }
      else if (o.k === "text") emitText(D, o, X(o.x), Y(o.y), k);
      else if (o.k === "img") { setOp(D, o.op); doc.addImage(o.src, "PNG", X(o.x), Y(o.y), o.w * k, o.h * k, undefined, "FAST"); }
    }
    while (depth--) doc.restoreGraphicsState();
    doc.restoreGraphicsState(); D.curOp = null;
  }
  function measure(el) {
    const undo = materialize(el);
    try { return collect(el); } finally { undo(); }
  }
  const ready = () => (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve());

  /* ───────── Hisobotlar: ochiq hisobot paneli (chop etish ko'rinishida: jadvallar, tugmalarsiz) ───────── */
  const BRK = "tr, .psheet, .tiles, h2, h3, table, .hb-box, .bnd, .pst, svg, .card, p";
  async function reportPdf() {
    const sec = document.querySelector("main section.card.hb-panel"); if (!sec) throw new Error("Hisobot topilmadi");
    const D = await newDoc();
    document.body.classList.add("pmeas"); sec.classList.add("pdfx");
    const oldW = sec.style.width; let land = false, W = 760, L, breaks;
    try {
      sec.style.width = W + "px";
      if (sec.scrollWidth > W + 2) { land = true; W = Math.max(1080, sec.scrollWidth + 20); sec.style.width = W + "px"; }
      await ready();
      const top = sec.getBoundingClientRect().top;
      breaks = [...sec.querySelectorAll(BRK)].map((e) => e.getBoundingClientRect().bottom - top).filter((v) => v > 0).sort((a, b) => a - b);
      L = measure(sec);
    } finally { sec.style.width = oldW; sec.classList.remove("pdfx"); document.body.classList.remove("pmeas"); }
    await needFonts(D, [L]);
    const pw = land ? 841.89 : 595.28, ph = land ? 595.28 : 841.89, m = 28.35, k = (pw - 2 * m) / W, pageH = (ph - 2 * m) / k, total = L.h;
    for (let y = 0; y < total - 1;) {
      let end = Math.min(total, y + pageH);
      if (end < total) { const b = breaks.filter((v) => v > y + pageH * 0.4 && v <= y + pageH).pop(); if (b) end = b; }
      emitPage(D, L, y, end, k, m, m, land); y = end;
    }
    return D.doc.output("blob");
  }

  /* ───────── tayyor varaqlar (.bx-pg): BSB/CHSB eksporti, bo'sh varaq, davomat, arxiv, TPT — har biri bitta PDF sahifa ───────── */
  async function pagesPdf(htmlPages, land) {
    const D = await newDoc(), box = document.createElement("div");
    box.className = "ptg-box"; box.innerHTML = htmlPages.join(""); document.body.append(box);
    const list = [];
    try {
      await ready();
      for (const pg of box.querySelectorAll(".bx-pg")) { const L = measure(pg); L.land = land != null ? (land || L.w > L.h * 1.05) : L.w > L.h; list.push(L); }
    } finally { box.remove(); }
    if (!list.length) throw new Error("Varaq topilmadi");
    await needFonts(D, list);
    for (const L of list) {
      const pw = L.land ? 841.89 : 595.28, ph = L.land ? 595.28 : 841.89, k = Math.min(pw / L.w, ph / L.h);
      emitPage(D, L, 0, L.h, k, (pw - L.w * k) / 2, (ph - L.h * k) / 2, L.land);
    }
    return D.doc.output("blob");
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
  return {reportPdf, pagesPdf, send, run, loadLib, parsePath, measure};
})();
