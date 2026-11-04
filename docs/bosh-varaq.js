/* Hisobotlar → «Bo'sh varaq» — tasdiqlangan dizayn (maket v2, Akmal 2026-11-04). Hisobotlar.js repBlank shu yerga murojaat qiladi.
   5 xil varaq turi, Kun / Hafta / Oy / Chorak (‹ › bilan), kelgusi kunlar dars jadvalidan, A4 oldindan ko'rish, «Barcha sinflar», Excel.
   Tanlov bosilganda butun sahifa qayta chizilmaydi: softRender() faqat o'zgargan joylarni almashtiradi.
   Varaq bir xil belgilash bilan uch joyda ishlatiladi: ekrandagi oldindan ko'rish (kichraytirilgan), chop etish va Telegram PDF. */
const BVQ = (() => {
  const TYPES = [
    ["att", "✍️", "Davomat va baho", "Har dars kuniga bitta katak"],
    ["only", "✓", "Faqat davomat", "Tor kataklar, oxirida «Kelmagan»"],
    ["mz", "🎯", "Mezon bo'yicha", "Ish 1–6 · Uy 0–4 · Baho"],
    ["bsb", "🧮", "BSB / CHSB", "Topshiriqlar, Jami, Baho"],
    ["own", "✏️", "O'z ustunlarim", "Ustun nomlarini o'zingiz yozasiz"]];
  const PERS = [["day", "Kun"], ["week", "Hafta"], ["month", "Oy"], ["q", "Chorak"]];
  const KEY = "yoqlama_bv";
  const DEF = {type: "att", per: "week", tasks: 5, tmax: [10, 10, 10, 10, 10], wtype: "BSB", own: "Kitob, Daftar, Forma",
    hdr: true, note: false, extra: 2, sig: true, zebra: true, fs: "m", ori: "auto"};
  const B = Object.assign({}, DEF, {base: null, all: false, page: 0, more: false, w: 0});
  try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s && typeof s === "object") for (const k of Object.keys(DEF)) if (k in s && typeof s[k] === typeof DEF[k]) B[k] = s[k]; } catch (e) {}
  if (!TYPES.some((t) => t[0] === B.type)) B.type = "att";
  if (!PERS.some((p) => p[0] === B.per)) B.per = "week";
  B.tasks = Math.max(1, Math.min(12, Math.round(B.tasks) || 5));
  B.tmax = (Array.isArray(B.tmax) ? B.tmax : []).map((x) => Math.max(1, Math.min(50, +x || 10)));
  while (B.tmax.length < 12) B.tmax.push(10);
  B.extra = Math.max(0, Math.min(10, Math.round(B.extra) || 0));
  const keep = () => { try { const o = {}; for (const k of Object.keys(DEF)) o[k] = B[k]; localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} };
  const needPer = () => ["att", "only", "mz"].includes(B.type);
  const base = () => B.base || todayIso();
  const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;

  /* ───────── davr ───────── */
  function qOf() { return quarterOf(base()) || curQuarter(); }
  function range() {
    const b = pdate(base());
    if (B.per === "day") return [base(), base()];
    if (B.per === "week") { const s = addDays(b, -pyWd(base())); return [iso(s), iso(addDays(s, 6))]; }
    if (B.per === "month") return [iso(new Date(b.getFullYear(), b.getMonth(), 1)), iso(new Date(b.getFullYear(), b.getMonth() + 1, 0))];
    return qRange(qOf()) || [base(), base()];
  }
  function perText() {
    const [lo, hi] = range(), a = pdate(lo), z = pdate(hi), M = MONTHS_GEN;
    if (B.per === "day") return `${a.getDate()} ${M[a.getMonth()]}, ${WD[pyWd(lo)]}`;
    if (B.per === "week") return a.getMonth() === z.getMonth() ? `${a.getDate()}–${z.getDate()} ${M[a.getMonth()]}` : `${a.getDate()} ${M[a.getMonth()].slice(0, 3)} – ${z.getDate()} ${M[z.getMonth()].slice(0, 3)}`;
    if (B.per === "month") return `${MONTHS[a.getMonth()]} ${a.getFullYear()}`;
    return qRange(qOf()) ? `${qOf()}-chorak · ${fmt(lo).slice(0, 5)} – ${fmt(hi).slice(0, 5)}` : `${qOf()}-chorak belgilanmagan`;
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
  // ustun guruhi: {h: sarlavha, h2: ikkinchi qator, sub: kichik ustunlar, w: bitta kichik ustunning eng kam kengligi (mm), fut}
  function groups(c) {
    const day = B.per === "day";
    if (B.type === "bsb") return Array.from({length: B.tasks}, (_, i) => ({h: `${i + 1}`, h2: `${B.tmax[i]} ball`, sub: [""], w: 11}));
    if (B.type === "own") return ownCols().map((x) => ({h: x, sub: [""], w: 16}));
    return dates(c).map(([d, fut]) => {
      const dd = fmt(d).slice(0, 5), wd = WD[pyWd(d)];
      if (B.type === "att") return day ? {h: `${dd} ${wd}`, sub: ["Davomat", "Baho"], w: 22, fut} : {h: B.per === "month" ? d.slice(8) : dd, h2: wd, sub: [""], w: B.per === "month" ? 7 : 12, fut};
      if (B.type === "only") return {h: B.per === "month" ? d.slice(8) : dd, h2: wd, sub: [""], w: day ? 22 : 6, fut};
      return {h: `${dd} ${wd}`, sub: ["Ish", "Uy", "Baho"], w: day ? 16 : 6.5, fut};
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
  const NR = 7, NAME = 42;
  const need = (G, T) => NR + NAME + G.reduce((a, g) => a + g.w * g.sub.length, 0) + T.reduce((a, t) => a + t[1], 0);
  // bitta sinf uchun varaqlar: ustunlar sig'masa — keyingi varaqqa, qatorlar sig'masa — ham
  function plan(c, land) {
    const G = groups(c), T = tails(), W = land ? 277 : 190, H = (land ? 190 : 277) - 4;
    const two = G.some((g) => g.sub.length > 1 || g.h2) || B.type === "bsb";
    const head = 9 + (B.hdr ? 5 : 0) + (two ? 10 : 7) + ((B.type === "mz" || G.some((g) => g.fut)) ? 4 : 0) + (B.sig ? 12 : 0);
    const rows = c.students.length + B.extra, perPage = Math.max(1, Math.floor((H - head) / 4.2));
    const parts = []; let cur = [], w = NR + NAME + T.reduce((a, t) => a + t[1], 0);
    for (const g of G) { const gw = g.w * g.sub.length; if (cur.length && w + gw > W) { parts.push(cur); cur = []; w = NR + NAME + T.reduce((a, t) => a + t[1], 0); } cur.push(g); w += gw; }
    parts.push(cur);
    const out = [];
    for (const p of parts) for (let r = 0; r < Math.max(1, rows); r += perPage) out.push({G: p, r0: r, r1: Math.min(rows, r + perPage)});
    return {pages: out, T, W, H, head, two, empty: needPer() && !G.length};
  }
  function orient(cls) {
    if (B.ori !== "auto") return B.ori === "land";
    return cls.some((c) => need(groups(c), tails()) > 190);
  }
  const hdr = () => D.web.bsb_hdr || {};
  // bitta A4 varaq (mm o'lchamda); .bx-pg — Telegram PDF uchun (pdf-tg.js pagesPdf)
  function sheet(c, P, k, land) {
    const pg = P.pages[k], {G, r0, r1} = pg, T = P.T, rowsN = r1 - r0, n = c.students.length;
    const rh = Math.max(4, Math.min(9, (P.H - P.head) / Math.max(1, rowsN)));
    const fs = (rh < 5 ? 7.5 : rh < 6.5 ? 9 : 10.5) * {s: 0.85, m: 1, l: 1.15}[B.fs];
    const nameW = Math.min(70, Math.max(NAME, P.W * 0.3)), sumW = G.reduce((a, g) => a + g.w * g.sub.length, 0) + T.reduce((a, t) => a + t[1], 0);
    const unit = sumW ? (P.W - NR - nameW) / sumW : 0, two = P.two;
    let h1 = `<tr><th ${two ? 'rowspan="2"' : ""} style="width:${NR}mm">№</th><th ${two ? 'rowspan="2"' : ""} class="bv-nmh" style="width:${nameW.toFixed(1)}mm">O'quvchi</th>`, h2 = "";
    for (const g of G) {
      const cw = (g.w * unit).toFixed(2), f = g.fut ? ' class="bv-fut"' : "";
      if (g.sub.length > 1) { h1 += `<th colspan="${g.sub.length}"${f}>${esc(g.h)}</th>`; h2 += g.sub.map((s) => `<th style="width:${cw}mm"${f}><small>${s}</small></th>`).join(""); }
      else if (two && g.h2) { h1 += `<th style="width:${cw}mm"${f}>${esc(g.h)}</th>`; h2 += `<th${f}><small>${esc(g.h2)}</small></th>`; }
      else h1 += `<th ${two ? 'rowspan="2"' : ""} style="width:${cw}mm"${f}>${esc(g.h)}</th>`;
    }
    for (const [t, w] of T) h1 += `<th ${two ? 'rowspan="2"' : ""} style="width:${(w * unit).toFixed(2)}mm">${t}</th>`;
    h1 += "</tr>" + (two ? `<tr>${h2}</tr>` : "");
    const cells = G.map((g) => g.sub.map((s) => `<td${s === "Baho" && B.type === "mz" ? ' class="bv-gr"' : ""}></td>`).join("")).join("") + T.map(() => "<td></td>").join("");
    let body = "";
    for (let i = r0; i < r1; i++) body += `<tr style="height:${rh.toFixed(2)}mm"${i >= n ? ' class="bv-ex"' : ""}><td class="bv-no">${i + 1}</td><td class="bv-nm">${i < n ? esc(c.students[i].name) : ""}</td>${cells}</tr>`;
    const [lo, hi] = range(), H = hdr(), many = P.pages.length > 1;
    const per = B.type === "bsb" ? `${B.wtype} · sana: ____________` : B.type === "own" ? "Sana: ____________" : `${fmt(lo)} – ${fmt(hi)}`;
    const meta = [["Maktab", (H.school || "").trim()], ["O'qituvchi", (H.teacher || "").trim()], ["Fan", c.subject || ""]].filter((x) => x[1]);
    const lg = [B.type === "mz" ? "Ish — darsdagi ish (1–6), Uy — uy vazifasi (0–4), Baho = Ish + Uy (1–10)." : "", G.some((g) => g.fut) ? "Rangli sarlavhali kunlar jurnalda hali yo'q — dars jadvalidan olingan." : ""].filter(Boolean).join(" ");
    return `<div class="bx-pg bv-pg ${land ? "land" : ""}"><div class="bv-in" style="font-size:${fs.toFixed(1)}pt">
      <div class="bv-ph"><b>${esc(B.hdr && c.subject ? c.name : label(c))}${B.type === "bsb" ? ` · ${B.wtype}` : ""}</b><span>${per}${many ? ` · ${k + 1}/${P.pages.length}-varaq` : ""}</span></div>
      ${B.hdr && meta.length ? `<div class="bv-meta">${meta.map(([a, b]) => `<span>${a}: <b>${esc(b)}</b></span>`).join("")}</div>` : ""}
      <table class="bv-t ${B.zebra ? "zb" : ""}"><thead>${h1}</thead><tbody>${body}</tbody></table>
      ${lg ? `<div class="bv-lg">${lg}</div>` : ""}
      ${B.sig ? `<div class="bv-sig"><span>O'qituvchi:${B.hdr && H.teacher ? ` ${esc(H.teacher)}` : ""}</span><span>Imzo:</span></div>` : ""}</div></div>`;
  }
  const clsList = (X) => B.all ? X.CL.map((i) => D.classes[i]) : [X.c];
  function allSheets(X) {
    const cls = clsList(X), land = orient(cls), out = [];
    for (const c of cls) { const P = plan(c, land); if (P.empty) continue; P.pages.forEach((_, k) => out.push(sheet(c, P, k, land))); }
    return {land, out};
  }

  /* ───────── panel ───────── */
  const tg = (k, t, s) => `<div class="bv-sw"><span><b>${t}</b>${s ? `<small>${s}</small>` : ""}</span><button class="bv-tg ${B[k] ? "on" : ""}" data-bv="tog" data-k="${k}" role="switch" aria-checked="${!!B[k]}" aria-label="${t}"></button></div>`;
  const seg = (a, list, cur) => `<div class="hb-seg bv-seg">${list.map(([k, n]) => `<button class="${cur === k ? "on" : ""}" data-bv="${a}" data-v="${k}">${n}</button>`).join("")}</div>`;
  const step = (a, v, l) => `<span class="bv-step"><button data-bv="${a}" data-v="-1" aria-label="${l}: kamaytirish">−</button><b>${v}</b><button data-bv="${a}" data-v="1" aria-label="${l}: ko'paytirish">＋</button></span>`;
  function options() {
    const per = needPer() ? `<div class="bv-og"><h3>Davr</h3>${seg("per", PERS, B.per)}
      <div class="bv-perrow"><button class="bv-arr" data-bv="shift" data-v="-1" aria-label="Oldingi">‹</button><div class="bv-perl">${perText()}</div><button class="bv-arr" data-bv="shift" data-v="1" aria-label="Keyingi">›</button></div></div>` : "";
    const bsb = B.type === "bsb" ? `<div class="bv-og"><h3>Ish</h3>${seg("wt", [["BSB", "BSB"], ["CHSB", "CHSB"]], B.wtype)}
      <div class="bv-sw"><span><b>Topshiriqlar soni</b></span>${step("tasks", B.tasks, "Topshiriqlar")}</div>
      <div class="bv-hint">Har topshiriq balli (bosib o'zgartiring):</div><div class="bv-tmax">${B.tmax.slice(0, B.tasks).map((m, i) => `<button class="btn btn-sm" data-bv="tmax" data-i="${i}">${i + 1}: ${m}</button>`).join("")}</div></div>` : "";
    const own = B.type === "own" ? `<div class="bv-og"><h3>Ustunlar</h3><input class="hb-date bv-own" id="bv-own" value="${esc(B.own)}" aria-label="Ustun nomlari" maxlength="300"><div class="bv-hint">Vergul bilan ajrating, 12 tagacha.</div></div>` : "";
    const sum = [B.hdr && "sarlavha", B.note && "izoh", B.sig && "imzo", B.extra && `+${B.extra} qator`].filter(Boolean).join(", ");
    return `<div class="bv-opts">
      <div class="bv-og"><h3>Varaq turi</h3><div class="bv-tiles">${TYPES.map(([k, ic, n, d]) => `<button class="bv-tile ${B.type === k ? "on" : ""}" data-bv="type" data-v="${k}"><span class="bv-ic">${ic}</span><span><b class="hb-ell">${n}</b><small>${d}</small></span></button>`).join("")}</div></div>
      ${per}${bsb}${own}
      <div class="bv-more ${B.more ? "open" : ""}"><button class="bv-sum" data-bv="more" aria-expanded="${B.more}">⚙ Varaq sozlamalari <em>${sum}</em><span class="bv-car">▾</span></button><div class="bv-mbody">
        <h3 class="hb-pc">Varaqda</h3>
        ${tg("hdr", "Sarlavha", "Maktab, o'qituvchi, fan")}${tg("note", "Izoh ustuni")}${tg("sig", "Imzo qatori")}${tg("zebra", "Chiziqli qatorlar")}
        <div class="bv-sw"><span><b>Bo'sh qatorlar</b><small>Yangi o'quvchilar uchun</small></span>${step("extra", B.extra, "Bo'sh qatorlar")}</div>
        <div class="bv-sw"><span><b>Yo'nalish</b></span>${seg("ori", [["auto", "Avto"], ["port", "Tik"], ["land", "Yotiq"]], B.ori)}</div>
        <div class="bv-sw"><span><b>Shrift</b></span>${seg("fs", [["s", "Kichik"], ["m", "O'rta"], ["l", "Katta"]], B.fs)}</div>
      </div></div></div>`;
  }
  function preview(X) {
    const cls = clsList(X), land = orient(cls), first = cls.find((c) => !plan(c, land).empty);
    if (!first) return `<div class="bv-pv"><div class="bv-desk bv-empty">${B.per === "day" ? "Bu kunda dars yo'q. Boshqa kunni tanlang yoki «Hafta»ga o'ting." : "Bu davrda dars kunlari yo'q."}</div></div>`;
    const P = plan(first, land), total = cls.reduce((a, c) => { const p = plan(c, land); return a + (p.empty ? 0 : p.pages.length); }, 0);
    B.page = Math.max(0, Math.min(B.page, P.pages.length - 1));
    const fut = P.pages.some((p) => p.G.some((g) => g.fut)), pw = land ? 297 : 210, ph = land ? 210 : 297;
    const s = B.w ? Math.min(1, B.w / (pw * 3.7795), phone() ? 9 : 640 / (ph * 3.7795)) : 0.5;
    return `<div class="bv-pv"><div class="bv-bar"><span class="bv-chip a">A4 · ${land ? "yotiq" : "tik"}</span><span class="bv-chip">${total} varaq${cls.length > 1 ? ` · ${cls.length} sinf` : ""}</span>${fut ? `<span class="bv-chip w" title="Jurnalda hali yo'q kunlar dars jadvalidan olindi">jadvaldan</span>` : ""}
        ${P.pages.length > 1 ? `<div class="bv-pgs">${P.pages.map((_, i) => `<button class="${B.page === i ? "on" : ""}" data-bv="pg" data-v="${i}">${i + 1}</button>`).join("")}</div>` : ""}</div>
      <div class="bv-desk"><div class="bv-fit" style="width:${(pw * 3.7795 * s).toFixed(0)}px;height:${(ph * 3.7795 * s).toFixed(0)}px"><div class="bv-scale" style="transform:scale(${s.toFixed(4)})">${sheet(first, P, B.page, land)}</div></div></div>
      ${cls.length > 1 ? `<div class="bv-hint">Birinchi sinf ko'rsatilgan. Chop etilganda har sinf alohida varaqdan boshlanadi.</div>` : ""}</div>`;
  }
  // hisobotlar.js repBlank shu funksiyani chaqiradi
  function body(X) {
    const {land, out} = allSheets(X);
    return `<style>@media print{@page{size:A4 ${land ? "landscape" : "portrait"};margin:10mm}}</style>
      <div class="bv">${options()}${preview(X)}</div><div class="bv-print">${out.join("")}</div>`;
  }
  function fit(m) {
    const d = m.querySelector(".bv-desk"); if (!d || !d.clientWidth) return;
    const w = d.clientWidth - (phone() ? 16 : 28); if (Math.abs(w - B.w) < 2) return;
    B.w = w; softRender();
  }

  /* ───────── hodisalar ───────── */
  function act(el) {
    const a = el.dataset.bv, v = el.dataset.v;
    if (a === "type") { B.type = v; B.page = 0; }
    else if (a === "per") { B.per = v; B.page = 0; }
    else if (a === "shift") { shift(+v); B.page = 0; }
    else if (a === "tog") B[el.dataset.k] = !B[el.dataset.k];
    else if (a === "extra") B.extra = Math.max(0, Math.min(10, B.extra + +v));
    else if (a === "tasks") B.tasks = Math.max(1, Math.min(12, B.tasks + +v));
    else if (a === "tmax") { const i = +el.dataset.i, seq = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25]; B.tmax[i] = seq[(seq.indexOf(B.tmax[i]) + 1) % seq.length]; }
    else if (a === "wt") B.wtype = v;
    else if (a === "ori") B.ori = v;
    else if (a === "fs") B.fs = v;
    else if (a === "pg") B.page = +v;
    else if (a === "more") B.more = !B.more;
    keep(); softRender();
  }
  let ownT = null;
  const BOUND = new WeakSet();
  const phone = () => matchMedia("(max-width:820px)").matches;
  let rzT = null;
  addEventListener("resize", () => { clearTimeout(rzT); rzT = setTimeout(() => { const m = document.querySelector("#main"); if (m && m.querySelector(".bv")) fit(m); }, 200); });
  function bind(m, getX) {
    const root = m.querySelector(".bv"); if (!root) return;
    // bitta tinglovchi: softRender tugmalarni almashtirsa ham ishlayveradi
    if (!BOUND.has(root)) { BOUND.add(root);
      root.addEventListener("click", (e) => { const el = e.target.closest("[data-bv]"); if (el && root.contains(el)) act(el); });
      root.addEventListener("input", (e) => { if (e.target.id !== "bv-own") return; B.own = e.target.value; keep(); clearTimeout(ownT);
        ownT = setTimeout(() => { const pos = e.target.selectionStart; softRender(); const el = document.getElementById("bv-own"); if (el && document.activeElement !== el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (er) {} } }, 350); });
    }
    m.querySelectorAll("[data-bvx]").forEach((b) => b.onclick = () => xlsx(getX()));
    requestAnimationFrame(() => fit(m));
  }
  function xlsx(X) {
    const cls = clsList(X), land = orient(cls), aoa = [], H = hdr();
    let wmax = 0;
    for (const c of cls) {
      const P = plan(c, land); if (P.empty) continue;
      const G = groups(c), T = P.T, [lo, hi] = range();
      if (aoa.length) aoa.push([]);
      aoa.push([`${c.name}${B.type === "bsb" ? " · " + B.wtype : ""} · ${needPer() ? `${fmt(lo)} – ${fmt(hi)}` : "sana: ________"}`]);
      if (B.hdr) aoa.push([[["Maktab", H.school], ["O'qituvchi", H.teacher], ["Fan", c.subject]].filter((x) => (x[1] || "").trim()).map(([a, b]) => `${a}: ${b.trim()}`).join("   ")]);
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
  const setAll = (v) => { B.all = !!v; B.page = 0; };
  return {body, bind, xlsx, pdfPages, subLabel, setAll, isAll: () => B.all, TYPES, state: B};
})();
