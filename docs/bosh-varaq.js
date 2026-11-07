/* Hisobotlar → «Bo'sh varaq» — tasdiqlangan dizayn (maket v3, 2026-11-05; chop etish aniqligi va soddalashtirilgan panel — maket v6, 2026-11-07). Hisobotlar.js repBlank shu yerga murojaat qiladi.
   Tepada varaq turlari, ostida Davr (‹ ›) va «⚙ Sozlamalar» (jadval dizayni — 9 xil, chetlar, qator balandligi shu yerda); hamma varaqlar oldindan ko'rinadi.
   Chop etish aniq: sarlavha/jadval boshi/pastki qism haqiqiy o'lchanadi, qatorlar qolgan joyga sig'adi, ekran = chop etish = PDF (A4, tanlangan chet).
   2 va undan ko'p varaq bo'lsa, o'quvchilar ham, kunlar ham varaqlarga TENG bo'linadi (38 qator → 19 + 19, 13 kun → 7 + 6).
   Tanlov bosilganda butun sahifa qayta chizilmaydi: softRender() faqat o'zgargan joylarni almashtiradi.
   Varaq bir xil belgilash bilan uch joyda: ekrandagi oldindan ko'rish (kichraytirilgan), chop etish va Telegram PDF. */
const BVQ = (() => {
  const TYPES = [
    ["att", "Davomat va baho"],
    ["only", "Faqat davomat"],
    ["mz", "Mezon"],
    ["bsb", "BSB / CHSB"],
    ["own", "O'z ustunlarim"]];
  const TNAME = {att: "Davomat va baho varag'i", only: "Davomat varag'i", mz: "Baholash mezoni varag'i", bsb: "Natijalar varag'i", own: "Qayd varag'i"};
  const DZ = [["kl", "Klassik"], ["oq", "Oq-qora"], ["rang", "Rangli"], ["daf", "Daftar"], ["qal", "Qalin"], ["min", "Minimal"], ["kok", "Ko'k"], ["kat", "Katak"], ["ilik", "Iliq"]];
  const PERS = [["day", "Kun"], ["week", "Hafta"], ["month", "Oy"], ["q", "Chorak"]];
  const KEY = "yoqlama_bv";
  const DEF = {type: "att", per: "week", tasks: 5, tmax: [10, 10, 10, 10, 10], wtype: "BSB", wno: 1, own: "Kitob, Daftar, Forma",
    hdr: true, note: false, extra: 2, sig: true, zebra: false, tdz: "kl", fs: "m", ori: "auto", mg: 10, rh: "auto", lines: false};
  const B = Object.assign({}, DEF, {base: null, all: false, set: false, w: 0, ok: null});
  try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s && typeof s === "object") for (const k of Object.keys(DEF)) if (k in s && typeof s[k] === typeof DEF[k]) B[k] = s[k]; } catch (e) {}
  if (!TYPES.some((t) => t[0] === B.type)) B.type = "att";
  if (!PERS.some((p) => p[0] === B.per)) B.per = "week";
  if (!DZ.some((d) => d[0] === B.tdz)) B.tdz = "kl";
  B.tasks = Math.max(1, Math.min(12, Math.round(B.tasks) || 5));
  B.wno = Math.max(1, Math.min(20, Math.round(B.wno) || 1));
  B.tmax = (Array.isArray(B.tmax) ? B.tmax : []).map((x) => Math.max(0.5, Math.min(50, +x || 10)));
  while (B.tmax.length < 12) B.tmax.push(10);
  B.extra = Math.max(0, Math.min(10, Math.round(B.extra) || 0));
  if (![5, 10, 15].includes(B.mg)) B.mg = 10;
  if (!["auto", "6", "8", "10"].includes(B.rh)) B.rh = "auto";
  const keep = () => { try { const o = {}; for (const k of Object.keys(DEF)) o[k] = B[k]; localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} };
  const needPer = () => ["att", "only", "mz"].includes(B.type);
  const base = () => B.base || todayIso();
  const fullMax = () => B.wtype === "BSB" ? 50 : 40;
  const nb = (v) => String(+(+v).toFixed(1));

  /* ───────── davr ───────── */
  function qOf() { return quarterOf(base()) || curQuarter(); }
  function range() {
    const b = pdate(base());
    if (B.per === "day") return [base(), base()];
    if (B.per === "week") { const s = addDays(b, -pyWd(base())); return [iso(s), iso(addDays(s, 6))]; }
    if (B.per === "month") return [iso(new Date(b.getFullYear(), b.getMonth(), 1)), iso(new Date(b.getFullYear(), b.getMonth() + 1, 0))];
    return qRange(qOf()) || [base(), base()];
  }
  const dm = (s) => `${pdate(s).getDate()} ${MONTHS_GEN[pdate(s).getMonth()]}`;
  function perText() {
    const [lo, hi] = range(), a = pdate(lo), z = pdate(hi), M = MONTHS_GEN;
    if (B.per === "day") return `${dm(lo)}, ${WD[pyWd(lo)]}`;
    if (B.per === "week") return a.getMonth() === z.getMonth() ? `${a.getDate()}–${z.getDate()} ${M[a.getMonth()]}` : `${a.getDate()} ${M[a.getMonth()].slice(0, 3)} – ${z.getDate()} ${M[z.getMonth()].slice(0, 3)}`;
    if (B.per === "month") return `${MONTHS[a.getMonth()]} ${a.getFullYear()}`;
    return qRange(qOf()) ? `${qOf()}-chorak` : `${qOf()}-chorak belgilanmagan`;
  }
  function shift(n) {
    const b = pdate(base());
    if (B.per === "day") B.base = iso(addDays(b, n));
    else if (B.per === "week") B.base = iso(addDays(b, 7 * n));
    else if (B.per === "month") B.base = iso(new Date(b.getFullYear(), b.getMonth() + n, 1));
    else { let q = qOf() + n; while (q >= 1 && q <= 4 && !qRange(q)) q += n; if (q >= 1 && q <= 4) B.base = qRange(q)[0]; }
  }
  // dars kunlari: jurnaldagilar + jurnalda hali yo'q, lekin dars jadvali bo'yicha bo'ladigan kunlar (bayram va metod kuni tashlanadi)
  function dates(c) {
    const [lo, hi] = range(), have = new Set(c.dates.filter((d) => lo <= d && d <= hi && !isNoLesson(c, d)));
    const hol = new Set(); for (let y = +lo.slice(0, 4); y <= +hi.slice(0, 4); y++) for (const x of holidaySet(y)) hol.add(x);
    const fut = lessonDays(c, lo, hi).filter((d) => !hol.has(d) && !isNoLesson(c, d));
    return [...[...have].map((d) => [d, false]), ...fut.map((d) => [d, true])].sort((a, b) => a[0] < b[0] ? -1 : 1);
  }

  /* ───────── varaq tuzilishi ───────── */
  // ustun guruhi: {d: sana, h: sarlavha, h2: ikkinchi qator, sub: kichik ustunlar, w: bitta kichik ustunning eng kam kengligi (mm), fut, wk: yangi hafta}
  function groups(c) {
    const day = B.per === "day";
    if (B.type === "bsb") return Array.from({length: B.tasks}, (_, i) => ({h: `${i + 1}`, h2: `${nb(B.tmax[i])} ball`, sub: [""], w: 11}));
    if (B.type === "own") return ownCols().map((x) => ({h: x, sub: [""], w: 16}));
    let prev = null;
    return dates(c).map(([d, fut]) => {
      const wk = prev !== null && pyWd(d) <= pyWd(prev); prev = d;
      const dd = fmt(d).slice(0, 5), wd = WD[pyWd(d)], short = B.per === "month" || B.per === "q";
      if (B.type === "att") return day ? {d, h: `${dd} ${wd}`, sub: ["Davomat", "Baho"], w: 22, fut, wk} : {d, h: short ? d.slice(8) : dd, h2: wd, sub: [""], w: short ? 7 : 12, fut, wk};
      if (B.type === "only") return {d, h: short ? d.slice(8) : dd, h2: wd, sub: [""], w: day ? 22 : 6, fut, wk};
      return {d, h: `${dd} ${wd}`, sub: ["Ish", "Uy", "Baho"], w: day ? 16 : 6.5, fut, wk};
    });
  }
  const ownCols = () => B.own.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean).slice(0, 12);
  function tails() {
    const t = [];
    if (B.type === "only") t.push(["Kelmagan", 14]);
    if (B.type === "bsb") t.push(["Jami", 12], ["Baho", 11]);
    if (B.note) t.push(["Izoh", 34]);
    return t;
  }
  const NR = 7, NAME = 42, MM = 96 / 25.4, PT = 25.4 / 72;
  // chop etishda varaq balandligi 0,5 mm kam: brauzer ortiqcha bo'sh bet ochmasin; ekran, chop etish va PDF bir xil o'lchamda
  const PWm = (land) => land ? 297 : 210, PHm = (land) => land ? 209.5 : 296.5;
  const gw = (g) => g.w * g.sub.length;
  const tailW = (T) => T.reduce((a, t) => a + t[1], 0);
  const fontOf = (rh) => (rh < 5 ? 7.5 : rh < 6.5 ? 9 : 10.5) * {s: 0.85, m: 1, l: 1.15}[B.fs];
  function orient(cls) {
    if (B.ori !== "auto") return B.ori === "land";
    const W = 210 - 2 * B.mg;
    return cls.some((c) => NR + NAME + groups(c).reduce((a, g) => a + gw(g), 0) + tailW(tails()) > W);
  }
  // sarlavha + jadval boshi + pastki qism balandligi taxmin emas: bitta bo'sh qatorli varaq chizilib o'lchanadi (kesh: varaq matni bo'yicha)
  const CHROME = new Map();
  function chrome(c, P0, land) {
    const html = sheet(c, {...P0, pages: [{G: P0.G, r0: 0, r1: 0}, {}], perR: 1, rh: 6, fs: fontOf(9)}, 0, land, true);   // eng katta shrift bilan o'lchanadi: sarlavha hech qachon taxmindan baland chiqmaydi
    if (CHROME.has(html)) return CHROME.get(html);
    const box = document.createElement("div"); box.style.cssText = "position:absolute;left:-9999px;top:0;visibility:hidden";
    box.innerHTML = html; (document.querySelector("#main .hb") || document.body).appendChild(box);   // varaq chop etiladigan joydagi CSS bilan o'lchanadi
    const inn = box.querySelector(".bv-in"), tb = box.querySelector("tbody");
    const h = (inn.getBoundingClientRect().height - tb.getBoundingClientRect().height) / MM;
    box.remove();
    if (CHROME.size > 60) CHROME.clear();
    CHROME.set(html, h); return h;
  }
  // teng bo'lish: avval nechta varaq kerakligi topiladi, so'ng ustunlar (kunlar) va qatorlar shu songa teng taqsimlanadi
  function plan(c, land) {
    const G = groups(c), T = tails(), m = B.mg, W = PWm(land) - 2 * m, H = PHm(land) - 2 * m;
    const two = G.some((g) => g.sub.length > 1 || g.h2);
    const room = W - NR - NAME - tailW(T), allW = G.reduce((a, g) => a + gw(g), 0);
    let nc = Math.max(1, Math.ceil(allW / room)), parts = [[]];
    for (; G.length; nc++) {
      const per = Math.ceil(G.length / nc); parts = [];
      for (let i = 0; i < G.length; i += per) parts.push(G.slice(i, i + per));
      if (parts.every((p) => p.reduce((a, g) => a + gw(g), 0) <= room + 0.01) || nc >= G.length) break;
    }
    const n = c.students.length, empty = needPer() && !G.length;
    const chromeH = empty ? 30 : Math.max(...parts.map((p) => chrome(c, {G: p, T, W, H, two, m}, land)));
    const avail = H - chromeH - 1.2;   // 1,2 mm — chiziqlar uchun zaxira
    const fix = B.rh === "auto" ? 0 : +B.rh, minR = Math.max(4.2, fontOf(4.2) * PT * 1.25 + 0.8);
    const maxR = Math.max(1, Math.floor(avail / ((fix ? fix + 0.14 : minR))));   // 0,14 mm: jadval qator balandligini butun pikselga yaxlitlaydi
    let rows = Math.max(1, n + B.extra), trim = 0;
    // bo'sh qatorlar yangi varaq ochmasin: o'quvchilar sig'gan varaqlar sonida qolamiz
    const nrS = Math.ceil(Math.max(1, n) / maxR);
    if (Math.ceil(rows / maxR) > nrS) { trim = rows - nrS * maxR; rows = nrS * maxR; }
    const nr = Math.ceil(rows / maxR), perR = Math.ceil(rows / nr), rh = fix || Math.floor(Math.min(12, avail / perR) * MM) / MM;   // «Avto»: butun piksel — qatorlar yig'indisi aniq chiqadi
    const pages = [];
    for (const p of parts) for (let r = 0; r < rows; r += perR) pages.push({G: p, r0: r, r1: Math.min(rows, r + perR)});
    return {pages, T, W, H, two, perR, nc: parts.length, nr, rh, fs: fontOf(Math.min(rh, 9)), empty, rows, trim, m};
  }
  const hdr = () => D.web.bsb_hdr || {};
  // uzun ism sig'masa faqat o'sha ism harfi kichrayadi (o'lchov — DOM'da, Arial bilan: chop etish va PDF bilan bir xil)
  let NSP = null;
  function nameFit(name, fsPt, wMm, o) {
    if (!NSP) { NSP = document.createElement("span"); NSP.style.cssText = "position:absolute;left:-9999px;top:0;white-space:nowrap;visibility:hidden;font-family:Arial,Helvetica,sans-serif"; }
    if (!NSP.isConnected) document.body.appendChild(NSP);
    NSP.style.fontSize = fsPt + "pt"; NSP.style.fontWeight = o && o.bold ? "700" : "400"; NSP.textContent = name;
    const w = NSP.getBoundingClientRect().width / MM, room = wMm - (o && o.pad != null ? o.pad : 3.4);
    return w <= room ? 1 : Math.max(0.5, room / w * 0.97);
  }
  // bitta A4 varaq (mm o'lchamda); .bx-pg — Telegram PDF uchun (pdf-tg.js pagesPdf)
  function sheet(c, P, k, land, probe) {
    const {G, r0, r1} = P.pages[k], T = P.T, n = c.students.length, two = P.two, m = P.m, rh = P.rh, fs = P.fs;
    const nameW = Math.min(70, Math.max(NAME, P.W * 0.3)), sumW = G.reduce((a, g) => a + gw(g), 0) + tailW(T);
    const unit = sumW ? (P.W - NR - nameW) / sumW : 0;
    // sarlavha yozuvi tor ustunga sig'masa — faqat o'sha katak yozuvi kichrayadi
    const tf = (cw, ...parts) => { let k = 1; for (const [t, em, bold] of parts) if (t) k = Math.min(k, nameFit(String(t), fs * em, cw, {bold, pad: 2.6})); return k < 1 ? `font-size:${(k * 100).toFixed(0)}%;` : ""; };
    const at = (st) => st ? ` style="${st}"` : "";
    let h1 = `<tr><th ${two ? 'rowspan="2"' : ""} style="width:${NR}mm">№</th><th ${two ? 'rowspan="2"' : ""} class="bv-nmh" style="width:${nameW.toFixed(1)}mm">O'quvchi</th>`, h2 = "";
    G.forEach((g, i) => {
      const cwn = g.w * unit, cw = cwn.toFixed(2), wk = g.wk && i > 0, cl = `${g.fut ? "bv-fut" : ""} ${wk ? "bv-wk" : ""}`.trim();
      if (g.sub.length > 1) { h1 += `<th colspan="${g.sub.length}" class="${cl}"${at(tf(cwn * g.sub.length, [g.h, 1, true]))}>${esc(g.h)}</th>`; h2 += g.sub.map((sb, j) => `<th style="${tf(cwn, [sb, 0.76, false])}width:${cw}mm" class="${g.fut ? "bv-fut" : ""} ${wk && !j ? "bv-wk" : ""}"><small>${sb}</small></th>`).join(""); }
      else if (two && g.h2) { h1 += `<th style="${tf(cwn, [g.h, 1, true])}width:${cw}mm" class="${cl}">${esc(g.h)}</th>`; h2 += `<th class="${cl}"${at(tf(cwn, [g.h2, 0.76, false]))}><small>${esc(g.h2)}</small></th>`; }
      else h1 += `<th ${two ? 'rowspan="2"' : ""} style="${tf(cwn, [g.h, 1, true])}width:${cw}mm" class="${cl}">${esc(g.h)}</th>`;
    });
    for (const [t, w] of T) h1 += `<th ${two ? 'rowspan="2"' : ""} style="${tf(w * unit, [t, 1, true])}width:${(w * unit).toFixed(2)}mm">${t}</th>`;
    h1 += "</tr>" + (two ? `<tr>${h2}</tr>` : "");
    const cells = G.map((g, i) => g.sub.map((s, j) => { const cl = `${s === "Baho" && B.type === "mz" ? "bv-gr" : ""} ${g.wk && i > 0 && !j ? "bv-wk" : ""}`.trim(); return cl ? `<td class="${cl}"></td>` : "<td></td>"; }).join("")).join("") + T.map(() => "<td></td>").join("");
    let body = "";
    if (probe) body = `<tr style="height:6mm"><td class="bv-no">1</td><td class="bv-nm"></td>${cells}</tr>`;
    else for (let i = r0; i < r1; i++) {
      const cl = `${i >= n ? "bv-ex" : ""} ${(i + 1) % 5 === 0 && i + 1 < r1 ? "bv-r5" : ""}`.trim();
      const nm = i < n ? c.students[i].name : "", kf = nm ? nameFit(nm, fs, nameW) : 1;
      body += `<tr style="height:${rh.toFixed(2)}mm"${cl ? ` class="${cl}"` : ""}><td class="bv-no">${i + 1}</td><td class="bv-nm">${kf < 1 ? `<span style="font-size:${(kf * 100).toFixed(0)}%">${esc(nm)}</span>` : esc(nm)}</td>${cells}</tr>`;
    }
    const H = hdr(), ds = G.filter((g) => g.d);
    const pr = ds.length ? `${fmt(ds[0].d).slice(0, 5)} – ${fmt(ds[ds.length - 1].d)}` : "—";
    const info = [B.type === "bsb" ? ["Ish", `${B.wno}-${B.wtype}, sana: ________`] : B.type === "own" ? ["Sana", "____.____.______"] : ["Davr", pr]];
    if (B.hdr) { if ((H.teacher || "").trim()) info.push(["O'qituvchi", H.teacher.trim()]); if ((H.school || "").trim()) info.push(["Maktab", H.school.trim()]); }
    const lg = [B.type === "mz" ? "Ish — darsdagi ish (1–6), Uy — uy vazifasi (0–4), Baho = Ish + Uy (1–10)." : "",
      G.some((g) => g.fut) ? "Rangli kunlar jurnalda hali yo'q — dars jadvalidan olingan." : "",
      B.type === "att" || B.type === "only" ? "Belgilar: S — sababsiz, DQ — sababli, K — kasal, KQ — kech qoldi." : ""].filter(Boolean).join(" ");
    return `<div class="bx-pg bv-pg d-${B.tdz} ${land ? "land" : ""}" style="padding:${m}mm"><div class="bv-in" style="font-size:${fs.toFixed(1)}pt${probe ? ";height:auto" : ""}">
      <div class="bv-top"><div class="bv-ttl"><small>${TNAME[B.type]}</small><b>${esc(label(c))}${B.type === "bsb" ? ` · ${B.wno}-${B.wtype}` : ""}</b></div>
        <div class="bv-info">${info.map(([a, b]) => `<span>${a}</span><span><b>${esc(b)}</b></span>`).join("")}</div></div>
      <table class="bv-t ${B.zebra ? "zb" : ""}"><thead>${h1}</thead><tbody>${body}</tbody></table>
      <div class="bv-foot"><div class="bv-lg">${lg}</div>${B.sig ? `<div class="bv-sg"><span>O'qituvchi:</span><span>Imzo:</span></div>` : ""}${P.pages.length > 1 ? `<span class="bv-pn">${k + 1}/${P.pages.length}</span>` : ""}</div></div></div>`;
  }
  const clsList = (X) => B.all ? X.CL.map((i) => D.classes[i]) : [X.c];
  function allSheets(X) {
    const cls = clsList(X), land = orient(cls), out = [];
    for (const c of cls) { const P = plan(c, land); if (P.empty) continue; P.pages.forEach((_, k) => out.push(sheet(c, P, k, land))); }
    return {land, out};
  }
  function caption(c, P, k) {
    const {G, r0, r1} = P.pages[k], ds = G.filter((g) => g.d), n = c.students.length, parts = [];
    if (P.nr > 1 || P.pages.length === 1) parts.push(r0 < n ? `<b>${r0 + 1}–${Math.min(r1, n)}</b> o'quvchi${r1 > n ? ` + ${r1 - Math.max(r0, n)} bo'sh qator` : ""}` : `<b>${r1 - r0}</b> bo'sh qator`);
    if (P.nc > 1 && ds.length) parts.push(`<b>${pdate(ds[0].d).getDate()}–${dm(ds[ds.length - 1].d)}</b> (${ds.length} kun)`);
    else if (P.nc > 1) parts.push(`<b>${G.length}</b> ustun`);
    return `${k + 1}-varaq · ${parts.join(" · ")}`;
  }

  /* ───────── panel ───────── */
  const tg = (k, t, s) => `<div class="bv-sw"><span><b>${t}</b>${s ? `<small>${s}</small>` : ""}</span><button class="bv-tg ${B[k] ? "on" : ""}" data-bv="tog" data-k="${k}" role="switch" aria-checked="${!!B[k]}" aria-label="${t}"></button></div>`;
  const seg = (a, list, cur) => `<div class="hb-seg bv-seg">${list.map(([k, n]) => `<button class="${String(cur) === String(k) ? "on" : ""}" data-bv="${a}" data-v="${k}">${n}</button>`).join("")}</div>`;
  const step = (a, v, l) => `<span class="bv-step"><button data-bv="${a}" data-v="-1" aria-label="${l}: kamaytirish">−</button><b>${v}</b><button data-bv="${a}" data-v="1" aria-label="${l}: ko'paytirish">＋</button></span>`;
  const setCount = () => [B.hdr, B.note, B.sig, B.zebra, B.extra > 0, B.ori !== "auto", B.fs !== "m", B.mg !== 10, B.rh !== "auto", B.tdz !== "kl", B.lines].filter(Boolean).length;
  const mini = (k) => `<div class="bv-mini d-${k}"><div class="bv-rule"></div><table><thead><tr><th></th><th></th><th></th><th></th><th></th></tr></thead><tbody>${[0, 1, 2, 3].map(() => `<tr><td class="bv-no"></td><td class="bv-nm"></td><td></td><td></td><td></td></tr>`).join("")}</tbody></table></div>`;
  function settings() {
    return `<div class="bv-shd"><h2>Varaq sozlamalari</h2><button class="bv-x" data-bv="set" aria-label="Yopish">✕</button></div>
      <div class="bv-sw bv-col"><span><b>Jadval dizayni</b></span><div class="bv-dzg">${DZ.map(([k, n]) => `<button class="bv-dz ${B.tdz === k ? "on" : ""}" data-bv="tdz" data-v="${k}" aria-pressed="${B.tdz === k}">${mini(k)}<span>${n}</span></button>`).join("")}</div></div>
      ${tg("hdr", "Sarlavhada o'qituvchi va maktab", "Summativ → Eksport sarlavhasidagi ma'lumotdan")}${tg("note", "Izoh ustuni")}${tg("sig", "Imzo qatori")}${tg("zebra", "Chiziqli qatorlar", "Har 5-qatorda qalin chiziq doim bor")}${tg("lines", "Ekranda chet chizig'ini ko'rsatish")}
      <div class="bv-sw"><span><b>Bo'sh qatorlar</b><small>Yangi o'quvchilar uchun · ortiqcha varaq ochmaydi</small></span>${step("extra", B.extra, "Bo'sh qatorlar")}</div>
      <div class="bv-sw"><span><b>Yo'nalish</b></span>${seg("ori", [["auto", "Avto"], ["port", "Tik"], ["land", "Yotiq"]], B.ori)}</div>
      <div class="bv-sw"><span><b>Shrift</b></span>${seg("fs", [["s", "Kichik"], ["m", "O'rta"], ["l", "Katta"]], B.fs)}</div>
      <div class="bv-sw"><span><b>Qator balandligi, mm</b><small>Avto — varaqni to'ldiradi (12 mm gacha)</small></span>${seg("rh", [["auto", "Avto"], ["6", "6"], ["8", "8"], ["10", "10"]], B.rh)}</div>
      <div class="bv-sw"><span><b>Chetlar, mm</b><small>Printer chetni kesib qo'ysa — 15</small></span>${seg("mg", [["5", "5"], ["10", "10"], ["15", "15"]], B.mg)}</div>`;
  }
  function ctxRow() {
    if (B.type === "bsb") {
      const tot = B.tmax.slice(0, B.tasks).reduce((a, b) => a + (+b || 0), 0), F = fullMax();
      return `<div class="bv-ctx"><div class="bv-cr"><span class="bv-lb">Ish</span>${seg("wt", [["BSB", "BSB"], ["CHSB", "CHSB"]], B.wtype)}
          <span class="bv-lb">Tartib raqami</span><span class="bv-wno"><button data-bv="wno" data-v="-1" aria-label="Raqamni kamaytirish">−</button><input type="number" inputmode="numeric" min="1" max="20" id="bv-wno" value="${B.wno}" aria-label="Ish tartib raqami"><b>-${B.wtype}</b><button data-bv="wno" data-v="1" aria-label="Raqamni oshirish">＋</button></span>
          <span class="bv-lb">Topshiriqlar</span>${step("tasks", B.tasks, "Topshiriqlar")}
          <span class="bv-tot">Jami: <b>${nb(tot)}</b> ball${Math.abs(tot - F) > 0.01 ? ` <em>(${B.wtype} odatda ${F})</em>` : ""}</span></div>
        <div class="bv-cr"><span class="bv-lb">Har topshiriq balli</span><div class="bv-mxi">${B.tmax.slice(0, B.tasks).map((m, i) => `<label><small>${i + 1}</small><input type="number" inputmode="decimal" min="0.5" max="50" step="0.5" id="bv-tm-${i}" data-tm="${i}" value="${nb(m)}" aria-label="${i + 1}-topshiriq balli"></label>`).join("")}</div></div>
        <div class="bv-cr"><span class="bv-lb">Tez</span><div class="bv-mx">${[2, 5, 10].map((v) => `<button data-bv="tall" data-v="${v}">Hammasi ${v}</button>`).join("")}<button data-bv="tsplit">Jami ${F} ni teng bo'lish</button></div></div></div>`;
    }
    if (B.type === "own") return `<div class="bv-ctx"><div class="bv-cr"><span class="bv-lb">Ustunlar</span><input class="bv-own" id="bv-own" value="${esc(B.own)}" aria-label="Ustun nomlari" maxlength="300"><span class="hb-mut" style="font-size:12px">vergul bilan, 12 tagacha</span></div></div>`;
    return "";
  }
  function preview(X) {
    const cls = clsList(X), land = orient(cls), first = cls.find((c) => !plan(c, land).empty);
    if (!first) return `<div class="bv-desk bv-empty">${B.per === "day" ? "Bu kunda dars yo'q. Boshqa kunni tanlang yoki «Hafta»ga o'ting." : "Bu davrda dars kunlari yo'q."}</div>`;
    const P = plan(first, land), total = cls.reduce((a, c) => { const p = plan(c, land); return a + (p.empty ? 0 : p.pages.length); }, 0);
    const fut = P.pages.some((p) => p.G.some((g) => g.fut)), show = P.pages.slice(0, 4);
    const cols = phone() || show.length < 2 ? 1 : 2, dw = B.w || (phone() ? 320 : 700), avail = (dw - (cols > 1 ? 16 : 0)) / cols;
    const pw = PWm(land) * MM, ph = PHm(land) * MM, s = Math.min(1, avail / pw, phone() ? 9 : (cols > 1 ? 470 : 640) / ph);
    const trim = P.trim > 0 ? `<span class="bv-chip w">bo'sh qatorlar ${B.extra} → ${B.extra - P.trim}</span>` : "", bad = B.ok === false ? `<span class="bv-chip bad">pastki qism sig'madi — kesiladi</span>` : "";
    return `<div class="bv-sub"><span><b>A4 · ${land ? "yotiq" : "tik"}</b> · ${total} varaq${cls.length > 1 ? ` · ${cls.length} sinf` : ""} · qator ${nb(P.rh)} mm${fut ? " · kelgusi kunlar jadvaldan" : ""}</span>${trim}${bad}</div>
      <div class="bv-desk ${cols > 1 ? "two" : ""}">${show.map((_, k) => `<div class="bv-pgw"><div class="bv-fit" style="width:${(pw * s).toFixed(0)}px;height:${(ph * s).toFixed(0)}px"><div class="bv-scale" style="transform:scale(${s.toFixed(4)})">${sheet(first, P, k, land)}${B.lines ? `<div class="bv-mgl" style="inset:${P.m}mm"><span>${P.m} mm</span></div>` : ""}</div></div><div class="bv-cap">${caption(first, P, k)}</div></div>`).join("")}
        ${P.pages.length > 4 ? `<div class="bv-more">Yana ${P.pages.length - 4} varaq…</div>` : ""}${cls.length > 1 ? `<div class="bv-more">${esc(label(first))} ko'rsatilgan · qolgan sinflar ham alohida varaqlarda chop etiladi.</div>` : ""}</div>`;
  }
  // hisobotlar.js repBlank shu funksiyani chaqiradi
  function body(X) {
    const {land, out} = allSheets(X);
    const tabs = `<div class="bv-tabs" role="tablist">${TYPES.map(([k, n]) => `<button class="bv-tab ${B.type === k ? "on" : ""}" role="tab" aria-selected="${B.type === k}" data-bv="type" data-v="${k}">${n}</button>`).join("")}</div>`;
    const per = needPer() ? `${seg("per", PERS, B.per)}<div class="bv-per"><button data-bv="shift" data-v="-1" aria-label="Oldingi">‹</button><b>${perText()}</b><button data-bv="shift" data-v="1" aria-label="Keyingi">›</button></div>` : "";
    const bar = `<div class="bv-bar">${per}<button class="bv-setb ${B.set ? "on" : ""}" data-bv="set" aria-expanded="${B.set}">⚙ Sozlamalar <i>${setCount()}</i></button></div>`;
    const pop = B.set ? `<div class="bv-veil" data-bv="set"></div><div class="bv-pop" role="dialog" aria-label="Varaq sozlamalari">${settings()}</div>` : "";
    return `<style>@media print{@page{size:A4 ${land ? "landscape" : "portrait"};margin:0}}</style>
      <div class="bv">${tabs}${bar}${ctxRow()}${preview(X)}${pop}</div><div class="bv-print">${out.join("")}</div>`;
  }
  function fit(m) {
    const d = m.querySelector(".bv-desk"); if (!d || !d.clientWidth) return;
    const cs = getComputedStyle(d), w = d.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    if (Math.abs(w - B.w) < 2) return;
    B.w = w; softRender();
  }

  /* ───────── hodisalar ───────── */
  function act(el) {
    const a = el.dataset.bv, v = el.dataset.v;
    if (a === "type") B.type = v;
    else if (a === "per") { B.per = v; if (v === "day") B.base = null; }
    else if (a === "shift") shift(+v);
    else if (a === "tog") B[el.dataset.k] = !B[el.dataset.k];
    else if (a === "extra") B.extra = Math.max(0, Math.min(10, B.extra + +v));
    else if (a === "tasks") B.tasks = Math.max(1, Math.min(12, B.tasks + +v));
    else if (a === "wno") B.wno = Math.max(1, Math.min(20, B.wno + +v));
    else if (a === "tall") { for (let i = 0; i < 12; i++) B.tmax[i] = +v; }
    else if (a === "tsplit") { const F = fullMax(), n = B.tasks, b = Math.floor(F / n * 2) / 2; for (let i = 0; i < n; i++) B.tmax[i] = b; B.tmax[n - 1] = +(F - b * (n - 1)).toFixed(1); }
    else if (a === "wt") B.wtype = v;
    else if (a === "ori") B.ori = v;
    else if (a === "fs") B.fs = v;
    else if (a === "tdz") B.tdz = v;
    else if (a === "rh") B.rh = v;
    else if (a === "mg") B.mg = +v;
    else if (a === "set") B.set = !B.set;
    else return;
    keep(); softRender();
  }
  let inT = null, justF = null;
  const BOUND = new WeakSet();
  const phone = () => matchMedia("(max-width:820px)").matches;
  let rzT = null;
  addEventListener("resize", () => { clearTimeout(rzT); rzT = setTimeout(() => { const m = document.querySelector("#main"); if (m && m.querySelector(".bv")) fit(m); }, 200); });
  // yozib turganda: kechiktirib yangilanadi, fokus va kursor joyida qoladi
  function later(el) {
    clearTimeout(inT); const id = el.id;
    inT = setTimeout(() => { const pos = el.selectionStart; softRender(); const x = document.getElementById(id);
      if (x && document.activeElement !== x) { x.focus(); try { x.setSelectionRange(pos, pos); } catch (er) {} } }, 350);
  }
  function bind(m, getX) {
    const root = m.querySelector(".bv"); if (!root) return;
    // bitta tinglovchi: softRender tugmalarni almashtirsa ham ishlayveradi
    if (!BOUND.has(root)) { BOUND.add(root);
      root.addEventListener("click", (e) => { const el = e.target.closest("[data-bv]"); if (el && root.contains(el)) act(el); });
      root.addEventListener("input", (e) => {
        const t = e.target;
        if (t.id === "bv-own") { B.own = t.value; keep(); later(t); }
        else if (t.id === "bv-wno") { const v = parseInt(t.value, 10); if (v >= 1 && v <= 20) { B.wno = v; keep(); later(t); } }
        else if (t.dataset.tm) { const v = parseFloat(String(t.value).replace(",", ".")); if (v > 0) { B.tmax[+t.dataset.tm] = Math.min(50, v); keep(); later(t); } }
      });
      // ball kataklari: bosilganda eski son belgilanadi, Enter yoki → keyingisiga o'tadi
      root.addEventListener("focusin", (e) => { if (e.target.dataset && (e.target.dataset.tm || e.target.id === "bv-wno")) { e.target.select(); justF = e.target; } });
      root.addEventListener("mouseup", (e) => { if (justF && e.target === justF) e.preventDefault(); justF = null; });
      root.addEventListener("keydown", (e) => {
        const t = e.target; if (e.key === "Escape" && B.set) { B.set = false; softRender(); return; }
        if (!t.dataset || !t.dataset.tm) return;
        const k = e.key === "Enter" || e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0; if (!k) return;
        const nx = document.getElementById(`bv-tm-${+t.dataset.tm + k}`); if (nx) { e.preventDefault(); clearTimeout(inT); softRender(); const y = document.getElementById(`bv-tm-${+t.dataset.tm + k}`); y.focus(); y.select(); }
      });
    }
    m.querySelectorAll("[data-bvx]").forEach((b) => b.onclick = () => xlsx(getX()));
    m.querySelectorAll("[data-bvpdf]").forEach((b) => b.onclick = () => savePdf(getX(), b));
    requestAnimationFrame(() => { const on = m.querySelector(".bv-tab.on"), tb = on && on.parentElement;
      if (tb && tb.scrollWidth > tb.clientWidth) tb.scrollLeft = Math.max(0, on.offsetLeft - tb.offsetLeft - 8);
      fit(m); checkFit(m); });
  }
  // tekshiruv: har varaqda pastki qism va ismlar ichkarida qoldimi (sig'masa — «kesiladi» belgisi)
  function checkFit(m) {
    const pgs = [...m.querySelectorAll(".bv-scale .bv-pg")];
    const ok = pgs.length ? pgs.every((p) => { const i = p.querySelector(".bv-in"); return i.scrollHeight <= i.clientHeight + 1 && ![...p.querySelectorAll("td.bv-nm, thead th")].some((x) => x.scrollWidth > x.clientWidth + 1); }) : null;
    if (ok !== B.ok) { B.ok = ok; softRender(); }
  }
  async function savePdf(X, btn) {
    const t0 = btn && btn.textContent; if (btn) { btn.disabled = true; btn.textContent = "⏳ PDF…"; }
    try {
      toast("PDF tayyorlanmoqda…");
      const blob = await pdfPages(X), a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = `${B.all ? "barcha sinflar" : label(X.c)} bo'sh varaq.pdf`.replace(/[\\/:*?"<>|]+/g, " ");
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      toast("PDF saqlandi");
    } catch (e) { console.warn("Bo'sh varaq PDF:", e); toast(`PDF tayyorlanmadi: ${e.message}`); }
    finally { if (btn) { btn.disabled = false; btn.textContent = t0; } }
  }
  // Excel: varaqdagi kabi chegarali, rangli (jadval dizayniga mos), qator balandligi va A4 chetlari bilan; har sinf alohida Excel varag'ida
  const XPAL = {kl: ["E9EEF2", "1B232D", "A7B0B9", "F3F5F7", ""], oq: ["FFFFFF", "000000", "000000", "FFFFFF", ""], rang: ["0D7F7C", "FFFFFF", "9CC9C4", "E3F3F1", "F2FAF9"], daf: ["FFFFFF", "1B232D", "8FB0D9", "FFFFFF", ""],
    qal: ["1B232D", "FFFFFF", "4A535C", "E6E9EC", ""], min: ["FFFFFF", "1B232D", "C6CED6", "FFFFFF", ""], kok: ["1E3A8A", "FFFFFF", "B9C6E8", "E8EEFC", "F3F6FD"], kat: ["FFFFFF", "1B232D", "7D8791", "FFFFFF", ""], ilik: ["F3E3C3", "4A3516", "D9C7A1", "FBF3E2", "FFFAF0"]};
  async function xlsx(X) {
    const cls = clsList(X), land = orient(cls), H = hdr(), [lo, hi] = range();
    if (!cls.some((c) => !plan(c, land).empty)) return toast("Bu davrda dars kunlari yo'q");
    let XL; try { XL = await BXP.loadXlsxStyle(); } catch (e) { return xlsxPlain(X); }
    const [hf, hc, ln, no, zb] = XPAL[B.tdz] || XPAL.kl, col = (rgb) => ({rgb});
    const wb = XL.utils.book_new(), used = new Set();
    for (const c of cls) {
      const P = plan(c, land); if (P.empty) continue;
      const G = groups(c), T = P.T, n = c.students.length, two = P.two, aoa = [], mg = [], rowH = {};
      const nCol = 2 + G.reduce((a, g) => a + g.sub.length, 0) + T.length;
      const row = (a) => { const r = a.slice(); while (r.length < nCol) r.push(""); aoa.push(r); return aoa.length - 1; };
      const rT = row([`${label(c)}${B.type === "bsb" ? ` · ${B.wno}-${B.wtype}` : ""} · ${needPer() ? `${fmt(lo)} – ${fmt(hi)}` : "sana: ________"}`]); mg.push({s: {r: rT, c: 0}, e: {r: rT, c: nCol - 1}});
      const meta = B.hdr ? [["O'qituvchi", H.teacher], ["Maktab", H.school]].filter((x) => (x[1] || "").trim()).map(([a, b]) => `${a}: ${b.trim()}`).join("     ") : "";
      let rM = -1; if (meta) { rM = row([meta]); mg.push({s: {r: rM, c: 0}, e: {r: rM, c: nCol - 1}}); }
      const hd = ["№", "O'quvchi"], hd2 = ["", ""];
      for (const g of G) g.sub.forEach((sb, i) => { hd.push(i ? "" : g.h); hd2.push(sb || g.h2 || ""); });
      T.forEach(([t]) => { hd.push(t); hd2.push(""); });
      const r1 = row(hd), r2 = two ? row(hd2) : -1;
      if (two) { let ci = 0; const vm = (cc) => mg.push({s: {r: r1, c: cc}, e: {r: r2, c: cc}}); vm(0); vm(1); ci = 2;
        for (const g of G) { if (g.sub.length > 1) mg.push({s: {r: r1, c: ci}, e: {r: r1, c: ci + g.sub.length - 1}}); else if (!g.h2) vm(ci); ci += g.sub.length; }
        T.forEach((_, i) => vm(ci + i)); }
      const first = aoa.length, rows = n + B.extra;
      for (let i = 0; i < rows; i++) rowH[row([i + 1, i < n ? c.students[i].name : ""])] = P.rh * 72 / 25.4;
      const last = aoa.length - 1;
      const legend = [B.type === "mz" ? "Ish — darsdagi ish (1–6), Uy — uy vazifasi (0–4), Baho = Ish + Uy (1–10)." : "", B.type === "att" || B.type === "only" ? "Belgilar: S — sababsiz, DQ — sababli, K — kasal, KQ — kech qoldi." : ""].filter(Boolean).join(" ");
      let rL = -1; if (legend) { row([]); rL = row([legend]); mg.push({s: {r: rL, c: 0}, e: {r: rL, c: nCol - 1}}); }
      let rS = -1; if (B.sig) { rS = row(["", "O'qituvchi: ______________________   Imzo: ______________"]); mg.push({s: {r: rS, c: 1}, e: {r: rS, c: nCol - 1}}); }
      const ws = XL.utils.aoa_to_sheet(aoa);
      ws["!ref"] = XL.utils.encode_range({s: {r: 0, c: 0}, e: {r: aoa.length - 1, c: nCol - 1}});
      ws["!merges"] = mg;
      const wch = [5, 34]; for (const g of G) for (let i = 0; i < g.sub.length; i++) wch.push(Math.max(5, Math.round(g.w * 0.9))); T.forEach(([t, w]) => wch.push(Math.max(8, Math.round(w * 0.8))));
      ws["!cols"] = wch.map((w) => ({wch: w}));
      ws["!rows"] = aoa.map((_, i) => rowH[i] ? {hpt: rowH[i]} : {});
      const mi = B.mg / 25.4; ws["!margins"] = {left: mi, right: mi, top: mi, bottom: mi, header: 0.2, footer: 0.2};
      const cell = (r, cc) => { const a = XL.utils.encode_cell({r, c: cc}); return ws[a] || (ws[a] = {t: "s", v: ""}); };
      const side = (st) => ({style: st, color: col(ln)}), dot = B.tdz === "kat" ? "dotted" : "thin";
      const BOX = B.tdz === "min" ? {bottom: side("thin")} : {top: side(dot), bottom: side(dot), left: side(dot), right: side(dot)};
      const put = (r, cc, st) => { cell(r, cc).s = {font: {name: "Arial", sz: 10, ...(st.font || {})}, alignment: {vertical: "center", ...(st.alignment || {})}, ...(st.fill ? {fill: st.fill} : {}), ...(st.border ? {border: st.border} : {})}; };
      for (let cc = 0; cc < nCol; cc++) { put(rT, cc, {font: {bold: true, sz: 14}}); if (rM >= 0) put(rM, cc, {font: {color: col("55606B")}}); }
      const hb = B.tdz === "min" ? {bottom: {style: "medium", color: col("1B232D")}} : {top: side("thin"), bottom: side("thin"), left: side("thin"), right: side("thin")};
      for (const r of two ? [r1, r2] : [r1]) for (let cc = 0; cc < nCol; cc++) put(r, cc, {font: {bold: true, color: col(hc)}, fill: {fgColor: col(hf)}, alignment: {horizontal: cc === 1 ? "left" : "center", wrapText: true}, border: hb});
      for (let r = first; r <= last; r++) { const i = r - first;
        for (let cc = 0; cc < nCol; cc++) {
          const b = {...BOX}; if ((i + 1) % 5 === 0 && i + 1 < rows) b.bottom = {style: "medium", color: col(ln)};
          const z = cc >= 2 && i % 2 === 1 && (B.zebra || zb) ? (B.zebra ? "F7F9FA" : zb) : null;
          put(r, cc, {border: b, alignment: {horizontal: cc === 1 ? "left" : "center"}, font: cc === 0 ? {color: col("55606B")} : {}, fill: cc === 0 ? {fgColor: col(no)} : z ? {fgColor: col(z)} : null});
        } }
      if (rL >= 0) for (let cc = 0; cc < nCol; cc++) put(rL, cc, {font: {sz: 9, color: col("55606B")}, alignment: {wrapText: true, vertical: "top"}});
      if (rL >= 0) rowH[rL] = 24, ws["!rows"][rL] = {hpt: 24};
      let nm = String(label(c)).replace(/[\\/?*\[\]:]/g, " ").trim().slice(0, 31) || "Varaq"; for (let k = 2; used.has(nm.toLowerCase()); k++) nm = nm.slice(0, 28) + " " + k; used.add(nm.toLowerCase());
      XL.utils.book_append_sheet(wb, ws, nm);
    }
    XL.writeFile(wb, `${(B.all ? "barcha sinflar" : label(X.c)).replace(/[^\p{L}\p{N}_ .-]+/gu, "_")} bo'sh varaq.xlsx`, {cellStyles: true});
  }
  // Excel kutubxonasi yuklanmasa — oddiy jadval (avvalgi usul)
  function xlsxPlain(X) {
    const cls = clsList(X), land = orient(cls), aoa = [], H = hdr();
    let wmax = 0;
    for (const c of cls) {
      const P = plan(c, land); if (P.empty) continue;
      const G = groups(c), T = P.T, [lo, hi] = range();
      if (aoa.length) aoa.push([]);
      aoa.push([`${label(c)}${B.type === "bsb" ? ` · ${B.wno}-${B.wtype}` : ""} · ${needPer() ? `${fmt(lo)} – ${fmt(hi)}` : "sana: ________"}`]);
      if (B.hdr) { const meta = [["O'qituvchi", H.teacher], ["Maktab", H.school]].filter((x) => (x[1] || "").trim()); if (meta.length) aoa.push([meta.map(([a, b]) => `${a}: ${b.trim()}`).join("   ")]); }
      const hd = ["№", "O'quvchi"], hd2 = ["", ""];
      for (const g of G) g.sub.forEach((s, i) => { hd.push(i ? "" : g.h); hd2.push(s || g.h2 || ""); });
      T.forEach(([t]) => { hd.push(t); hd2.push(""); });
      aoa.push(hd); if (hd2.some(Boolean)) aoa.push(hd2);
      const n = c.students.length; for (let i = 0; i < n + B.extra; i++) aoa.push([i + 1, i < n ? c.students[i].name : ""]);
      wmax = Math.max(wmax, hd.length);
    }
    if (!aoa.length) return toast("Bu davrda dars kunlari yo'q");
    const nm = B.all ? "barcha sinflar" : label(X.c);
    saveTable(`${nm} bo'sh varaq`, aoa, [5, 30, ...Array.from({length: Math.max(0, wmax - 2)}, () => B.type === "own" ? 14 : 8)]);
  }
  // Telegram: tayyor varaqlar alohida PDF sahifa bo'lib ketadi
  function pdfPages(X) { const {land, out} = allSheets(X); if (!out.length) throw new Error("Bu davrda dars kunlari yo'q"); return PTG.pagesPdf(out, land); }
  const subLabel = (X) => B.all ? `Barcha sinflar · ${X.CL.length} ta` : null;
  const setAll = (v) => { B.all = !!v; };
  return {body, bind, xlsx, pdfPages, subLabel, setAll, isAll: () => B.all, plan, TYPES, state: B};
})();
