/* Hisobotlar → «Bo'sh varaq» — tasdiqlangan dizayn (maket v3, Akmal 2026-11-05). Hisobotlar.js repBlank shu yerga murojaat qiladi.
   Tepada varaq turlari, ostida Davr (‹ ›) va «⚙ Sozlamalar»; «Jadval dizayni» (5 xil); hamma varaqlar oldindan ko'rinadi.
   2 va undan ko'p varaq bo'lsa, o'quvchilar ham, kunlar ham varaqlarga TENG bo'linadi (38 qator → 19 + 19, 13 kun → 7 + 6).
   Tanlov bosilganda butun sahifa qayta chizilmaydi: softRender() faqat o'zgargan joylarni almashtiradi.
   Varaq bir xil belgilash bilan uch joyda: ekrandagi oldindan ko'rish (kichraytirilgan), chop etish va Telegram PDF. */
const BVQ = (() => {
  const TYPES = [
    ["att", "✍️", "Davomat va baho", "har kunga 1 katak"],
    ["only", "✓", "Faqat davomat", "oxirida «Kelmagan»"],
    ["mz", "🎯", "Mezon bo'yicha", "Ish · Uy · Baho"],
    ["bsb", "🧮", "BSB / CHSB", "topshiriqlar, Jami"],
    ["own", "✏️", "O'z ustunlarim", "nomini o'zingiz yozasiz"]];
  const TNAME = {att: "Davomat va baho varag'i", only: "Davomat varag'i", mz: "Baholash mezoni varag'i", bsb: "Natijalar varag'i", own: "Qayd varag'i"};
  const DZ = [["kl", "Klassik", "Kulrang sarlavha"], ["oq", "Oq-qora", "Rangsiz, siyoh tejaydi"], ["rang", "Rangli", "Yashil sarlavha"], ["daf", "Daftar", "Ko'k chiziq, qizil hoshiya"], ["qal", "Qalin", "To'q sarlavha, aniq"]];
  const PERS = [["day", "Kun"], ["week", "Hafta"], ["month", "Oy"], ["q", "Chorak"]];
  const KEY = "yoqlama_bv";
  const DEF = {type: "att", per: "week", tasks: 5, tmax: [10, 10, 10, 10, 10], wtype: "BSB", wno: 1, own: "Kitob, Daftar, Forma",
    hdr: true, note: false, extra: 2, sig: true, zebra: false, tdz: "kl", fs: "m", ori: "auto"};
  const B = Object.assign({}, DEF, {base: null, all: false, set: false, w: 0});
  try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s && typeof s === "object") for (const k of Object.keys(DEF)) if (k in s && typeof s[k] === typeof DEF[k]) B[k] = s[k]; } catch (e) {}
  if (!TYPES.some((t) => t[0] === B.type)) B.type = "att";
  if (!PERS.some((p) => p[0] === B.per)) B.per = "week";
  if (!DZ.some((d) => d[0] === B.tdz)) B.tdz = "kl";
  B.tasks = Math.max(1, Math.min(12, Math.round(B.tasks) || 5));
  B.wno = Math.max(1, Math.min(20, Math.round(B.wno) || 1));
  B.tmax = (Array.isArray(B.tmax) ? B.tmax : []).map((x) => Math.max(0.5, Math.min(50, +x || 10)));
  while (B.tmax.length < 12) B.tmax.push(10);
  B.extra = Math.max(0, Math.min(10, Math.round(B.extra) || 0));
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
  const NR = 7, NAME = 42, MM = 96 / 25.4;
  const gw = (g) => g.w * g.sub.length;
  const tailW = (T) => T.reduce((a, t) => a + t[1], 0);
  function orient(cls) {
    if (B.ori !== "auto") return B.ori === "land";
    return cls.some((c) => NR + NAME + groups(c).reduce((a, g) => a + gw(g), 0) + tailW(tails()) > 190);
  }
  // teng bo'lish: avval nechta varaq kerakligi topiladi, so'ng ustunlar (kunlar) va qatorlar shu songa teng taqsimlanadi
  function plan(c, land) {
    const G = groups(c), T = tails(), W = land ? 277 : 190, H = (land ? 190 : 277) - 4;
    const two = G.some((g) => g.sub.length > 1 || g.h2);
    const head = 16 + (two ? 10 : 7) + 11;
    const room = W - NR - NAME - tailW(T), allW = G.reduce((a, g) => a + gw(g), 0);
    let nc = Math.max(1, Math.ceil(allW / room)), parts = [[]];
    for (; G.length; nc++) {
      const per = Math.ceil(G.length / nc); parts = [];
      for (let i = 0; i < G.length; i += per) parts.push(G.slice(i, i + per));
      if (parts.every((p) => p.reduce((a, g) => a + gw(g), 0) <= room + 0.01) || nc >= G.length) break;
    }
    const rows = Math.max(1, c.students.length + B.extra), maxR = Math.max(1, Math.floor((H - head) / 4.2));
    const nr = Math.ceil(rows / maxR), perR = Math.ceil(rows / nr);
    const pages = [];
    for (const p of parts) for (let r = 0; r < rows; r += perR) pages.push({G: p, r0: r, r1: Math.min(rows, r + perR)});
    return {pages, T, W, H, head, two, perR, nc: parts.length, nr, empty: needPer() && !G.length};
  }
  const hdr = () => D.web.bsb_hdr || {};
  // bitta A4 varaq (mm o'lchamda); .bx-pg — Telegram PDF uchun (pdf-tg.js pagesPdf)
  function sheet(c, P, k, land) {
    const {G, r0, r1} = P.pages[k], T = P.T, n = c.students.length, two = P.two;
    const rh = Math.max(4, Math.min(9, (P.H - P.head) / P.perR));
    const fs = (rh < 5 ? 7.5 : rh < 6.5 ? 9 : 10.5) * {s: 0.85, m: 1, l: 1.15}[B.fs];
    const nameW = Math.min(70, Math.max(NAME, P.W * 0.3)), sumW = G.reduce((a, g) => a + gw(g), 0) + tailW(T);
    const unit = sumW ? (P.W - NR - nameW) / sumW : 0;
    let h1 = `<tr><th ${two ? 'rowspan="2"' : ""} style="width:${NR}mm">№</th><th ${two ? 'rowspan="2"' : ""} class="bv-nmh" style="width:${nameW.toFixed(1)}mm">O'quvchi</th>`, h2 = "";
    G.forEach((g, i) => {
      const cw = (g.w * unit).toFixed(2), wk = g.wk && i > 0, cl = `${g.fut ? "bv-fut" : ""} ${wk ? "bv-wk" : ""}`.trim();
      if (g.sub.length > 1) { h1 += `<th colspan="${g.sub.length}" class="${cl}">${esc(g.h)}</th>`; h2 += g.sub.map((s, j) => `<th style="width:${cw}mm" class="${g.fut ? "bv-fut" : ""} ${wk && !j ? "bv-wk" : ""}"><small>${s}</small></th>`).join(""); }
      else if (two && g.h2) { h1 += `<th style="width:${cw}mm" class="${cl}">${esc(g.h)}</th>`; h2 += `<th class="${cl}"><small>${esc(g.h2)}</small></th>`; }
      else h1 += `<th ${two ? 'rowspan="2"' : ""} style="width:${cw}mm" class="${cl}">${esc(g.h)}</th>`;
    });
    for (const [t, w] of T) h1 += `<th ${two ? 'rowspan="2"' : ""} style="width:${(w * unit).toFixed(2)}mm">${t}</th>`;
    h1 += "</tr>" + (two ? `<tr>${h2}</tr>` : "");
    const cells = G.map((g, i) => g.sub.map((s, j) => { const cl = `${s === "Baho" && B.type === "mz" ? "bv-gr" : ""} ${g.wk && i > 0 && !j ? "bv-wk" : ""}`.trim(); return cl ? `<td class="${cl}"></td>` : "<td></td>"; }).join("")).join("") + T.map(() => "<td></td>").join("");
    let body = "";
    for (let i = r0; i < r1; i++) { const cl = `${i >= n ? "bv-ex" : ""} ${(i + 1) % 5 === 0 && i + 1 < r1 ? "bv-r5" : ""}`.trim();
      body += `<tr style="height:${rh.toFixed(2)}mm"${cl ? ` class="${cl}"` : ""}><td class="bv-no">${i + 1}</td><td class="bv-nm">${i < n ? esc(c.students[i].name) : ""}</td>${cells}</tr>`; }
    const H = hdr(), ds = G.filter((g) => g.d), [lo] = range();
    const pr = ds.length ? `${fmt(ds[0].d).slice(0, 5)} – ${fmt(ds[ds.length - 1].d)}` : "—";
    const info = [B.type === "bsb" ? ["Ish", `${B.wno}-${B.wtype}, sana: ________`] : B.type === "own" ? ["Sana", "____.____.______"] : ["Davr", pr]];
    if (B.hdr) { if ((H.teacher || "").trim()) info.push(["O'qituvchi", H.teacher.trim()]); if ((H.school || "").trim()) info.push(["Maktab", H.school.trim()]); }
    const lg = [B.type === "mz" ? "Ish — darsdagi ish (1–6), Uy — uy vazifasi (0–4), Baho = Ish + Uy (1–10)." : "",
      G.some((g) => g.fut) ? "Rangli kunlar jurnalda hali yo'q — dars jadvalidan olingan." : "",
      B.type === "att" || B.type === "only" ? "Belgilar: S — sababsiz, DQ — sababli, K — kasal, KQ — kech qoldi." : ""].filter(Boolean).join(" ");
    void lo;
    return `<div class="bx-pg bv-pg d-${B.tdz} ${land ? "land" : ""}"><div class="bv-in" style="font-size:${fs.toFixed(1)}pt">
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
  const seg = (a, list, cur) => `<div class="hb-seg bv-seg">${list.map(([k, n]) => `<button class="${cur === k ? "on" : ""}" data-bv="${a}" data-v="${k}">${n}</button>`).join("")}</div>`;
  const step = (a, v, l) => `<span class="bv-step"><button data-bv="${a}" data-v="-1" aria-label="${l}: kamaytirish">−</button><b>${v}</b><button data-bv="${a}" data-v="1" aria-label="${l}: ko'paytirish">＋</button></span>`;
  const setCount = () => [B.hdr, B.note, B.sig, B.zebra, B.extra > 0, B.ori !== "auto", B.fs !== "m"].filter(Boolean).length;
  function settings() {
    return `<div class="bv-shd"><h2>Varaq sozlamalari</h2><button class="bv-x" data-bv="set" aria-label="Yopish">✕</button></div>
      ${tg("hdr", "Sarlavhada o'qituvchi va maktab", "BSB tahlili sahifasidagi ma'lumotdan")}${tg("note", "Izoh ustuni")}${tg("sig", "Imzo qatori")}${tg("zebra", "Chiziqli qatorlar", "Har 5-qatorda qalin chiziq doim bor")}
      <div class="bv-sw"><span><b>Bo'sh qatorlar</b><small>Yangi o'quvchilar uchun</small></span>${step("extra", B.extra, "Bo'sh qatorlar")}</div>
      <div class="bv-sw"><span><b>Yo'nalish</b></span>${seg("ori", [["auto", "Avto"], ["port", "Tik"], ["land", "Yotiq"]], B.ori)}</div>
      <div class="bv-sw"><span><b>Shrift</b></span>${seg("fs", [["s", "Kichik"], ["m", "O'rta"], ["l", "Katta"]], B.fs)}</div>`;
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
  const mini = (k) => `<div class="bv-mini d-${k}"><div class="bv-rule"></div><table><thead><tr><th></th><th></th><th></th><th></th><th></th></tr></thead><tbody>${[0, 1, 2, 3].map(() => `<tr><td class="bv-no"></td><td class="bv-nm"></td><td></td><td></td><td></td></tr>`).join("")}</tbody></table></div>`;
  function preview(X) {
    const dzRow = `<h3 class="bv-h3">Jadval dizayni</h3><div class="bv-dzs">${DZ.map(([k, n, d]) => `<button class="bv-dz ${B.tdz === k ? "on" : ""}" data-bv="tdz" data-v="${k}" aria-pressed="${B.tdz === k}">${mini(k)}<b>${B.tdz === k ? "✓ " : ""}${n}</b><small>${d}</small></button>`).join("")}</div>`;
    const cls = clsList(X), land = orient(cls), first = cls.find((c) => !plan(c, land).empty);
    if (!first) return `${dzRow}<div class="bv-desk bv-empty">${B.per === "day" ? "Bu kunda dars yo'q. Boshqa kunni tanlang yoki «Hafta»ga o'ting." : "Bu davrda dars kunlari yo'q."}</div>`;
    const P = plan(first, land), total = cls.reduce((a, c) => { const p = plan(c, land); return a + (p.empty ? 0 : p.pages.length); }, 0);
    const fut = P.pages.some((p) => p.G.some((g) => g.fut)), show = P.pages.slice(0, 4);
    const cols = phone() || show.length < 2 ? 1 : 2, dw = B.w || (phone() ? 320 : 700), avail = (dw - (cols > 1 ? 16 : 0)) / cols;
    const pw = (land ? 297 : 210) * MM, ph = (land ? 210 : 297) * MM, s = Math.min(1, avail / pw, phone() ? 9 : (cols > 1 ? 470 : 640) / ph);
    const even = P.pages.length > 1 ? `<span class="bv-chip ok">✓ teng bo'lingan${P.nr > 1 ? ` · ${P.perR} qatordan` : ""}</span>` : "";
    return `${dzRow}<div class="bv-bar2"><span class="bv-chip a">A4 · ${land ? "yotiq" : "tik"}</span><span class="bv-chip">${total} varaq${cls.length > 1 ? ` · ${cls.length} sinf` : ""}</span>${even}${fut ? `<span class="bv-chip w" title="Jurnalda hali yo'q kunlar dars jadvalidan olindi">jadvaldan</span>` : ""}</div>
      <div class="bv-desk ${cols > 1 ? "two" : ""}">${show.map((_, k) => `<div class="bv-pgw"><div class="bv-fit" style="width:${(pw * s).toFixed(0)}px;height:${(ph * s).toFixed(0)}px"><div class="bv-scale" style="transform:scale(${s.toFixed(4)})">${sheet(first, P, k, land)}</div></div><div class="bv-cap">${caption(first, P, k)}</div></div>`).join("")}
        ${P.pages.length > 4 ? `<div class="bv-more">Yana ${P.pages.length - 4} varaq…</div>` : ""}${cls.length > 1 ? `<div class="bv-more">${esc(label(first))} ko'rsatilgan · qolgan sinflar ham alohida varaqlarda chop etiladi.</div>` : ""}</div>`;
  }
  // hisobotlar.js repBlank shu funksiyani chaqiradi
  function body(X) {
    const {land, out} = allSheets(X);
    const tabs = `<div class="bv-tabs" role="tablist">${TYPES.map(([k, ic, n, d]) => `<button class="bv-tab ${B.type === k ? "on" : ""}" role="tab" aria-selected="${B.type === k}" data-bv="type" data-v="${k}"><span class="bv-ic">${ic}</span><span><b>${n}</b><small>${d}</small></span></button>`).join("")}</div>`;
    const per = needPer() ? `${seg("per", PERS, B.per)}<div class="bv-per"><button data-bv="shift" data-v="-1" aria-label="Oldingi">‹</button><b>${perText()}</b><button data-bv="shift" data-v="1" aria-label="Keyingi">›</button></div>` : "";
    const bar = `<div class="bv-bar">${per}<button class="bv-setb ${B.set ? "on" : ""}" data-bv="set" aria-expanded="${B.set}">⚙ Sozlamalar <i>${setCount()}</i></button></div>`;
    const pop = B.set ? `<div class="bv-veil" data-bv="set"></div><div class="bv-pop" role="dialog" aria-label="Varaq sozlamalari">${settings()}</div>` : "";
    return `<style>@media print{@page{size:A4 ${land ? "landscape" : "portrait"};margin:10mm}}</style>
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
    requestAnimationFrame(() => { const on = m.querySelector(".bv-tab.on"), tb = on && on.parentElement;
      if (tb && tb.scrollWidth > tb.clientWidth) tb.scrollLeft = Math.max(0, on.offsetLeft - tb.offsetLeft - 8);
      fit(m); });
  }
  function xlsx(X) {
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
