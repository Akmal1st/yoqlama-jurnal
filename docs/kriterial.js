/* Kundalik (formativ) bahoni kriterial jadvalda «+» / «−» bilan qo'yish — tasdiqlangan maket v3 (Akmal, 2026-11-09).
   Baho = 1 (darsda qatnashgani) + darsdagi ishning 5 deskriptori + uy vazifasining 4 deskriptori, har «+» — 1 ball.
   Shunda darsdagi ish 1–6, uy vazifasi 0–4, jami 1–10 bo'ladi (eMaktab qoidasi, mezon.js bilan bir xil).
   Rejim: D.web.fmode = "krit". Ma'lumot: s.fk[sana] = "++-+.+-++" (9 belgi: + bajardi, - bajarmadi, . belgilanmagan);
   9 tasi ham belgilansa yig'indi jurnalga oddiy baho bo'lib tushadi (s.marks[sana] = "8") va s.fp[sana] = [6, 2] ham yoziladi,
   shuning uchun FB, chorak bahosi, hisobotlar va «Mezon bo'yicha» rejimi o'zgarishsiz ishlaydi.
   Deskriptor matnlari sinf bo'yicha: c.kd = [9 ta matn] (yo'q bo'lsa — namuna). Asosiy skriptdan oldin ulanadi. */
const KRT = (() => {
  const N = 9, ND = 5;
  const DEF = ["Darsning barcha bosqichlarida faol", "Savollarga to'g'ri javob beradi", "Guruh / juftlik ishida faol", "Topshiriqni mustaqil bajaradi", "Xatoga yo'l qo'ymaydi",
    "Uy vazifasi bajarilgan", "To'liq bajarilgan", "Xatosiz yoki kam xato", "O'z vaqtida va ozoda"];
  const GR = [{n: "Darsdagi ish", r: "1–6", s: "D"}, {n: "Uy vazifasi", r: "0–4", s: "U"}];
  const ABS = ["s", "dq", "k", "ch", "ox"];   // ch — chet elda: darsda yo'q, baho qo'yilmaydi
  const on = () => (D.web || {}).fmode === "krit";
  const tel = () => typeof matchMedia === "function" && matchMedia("(max-width: 700px)").matches;
  const code = (k) => k < ND ? `D${k + 1}` : `U${k - ND + 1}`;
  const descs = (c) => Array.isArray(c.kd) && c.kd.length === N ? c.kd : DEF;
  const absent = (mk) => ABS.includes(attPart(mk || ""));
  const sym = (v) => v === "p" ? "+" : v === "m" ? "−" : "·";
  const first = (k) => k === 0 || k === ND;
  const st = {f: null, v: "list", stu: 0, des: 0, flt: "all", tab: "day", q: null, ao: null};   // fokus, telefon rejimi, filtr, bo'lim (bugun / chorak), chorak, davomati ochiq qator

  const sum = (a) => { let d = 1, u = 0; a.forEach((v, k) => { if (v === "p") { if (k < ND) d++; else u++; } }); return [d, u]; };
  // saqlangan belgilar faqat jurnaldagi baho bilan mos kelsa ishlatiladi (baho boshqa joyda o'zgartirilgan bo'lsa — e'tiborsiz)
  function marks(s, d) {
    const blank = Array(N).fill(null), k = s.fk && s.fk[d]; if (!k) return blank;
    const a = [...k].map((ch) => ch === "+" ? "p" : ch === "-" ? "m" : null), gs = gradesOf(s.marks[d] || "");
    if (a.every(Boolean)) {   // baho va mezon qismlari (s.fp) ham shu belgilarga mos bo'lishi kerak
      const [x, y] = sum(a), fp = s.fp && s.fp[d];
      return gs.length === 1 && gs[0] === x + y && (!fp || (fp[0] === x && fp[1] === y)) ? a : blank;
    }
    return gs.length ? blank : a;
  }
  // baho boshqa usulda (Oddiy / Mezon bo'yicha) qo'yilgan: belgilar unga mos emas — katak bosilsa baho tasodifan o'chmasin
  const other = (s, d) => gradesOf(s.marks[d] || "").length > 0 && !marks(s, d).some(Boolean);
  const OTHER = "Bu o'quvchiga baho boshqa usulda qo'yilgan. Kriterial baholash uchun avval ⋯ → «Bahoni o'chirish».";
  function info(s, d) {
    const a = marks(s, d), [dd, uu] = sum(a), e = a.filter((v) => !v).length;
    return {a, d: dd, u: uu, g: dd + uu, e, pl: a.filter((v) => v === "p").length, mi: a.filter((v) => v === "m").length, full: !e, any: e < N};
  }
  const rowsOf = (c, d) => c.students.map((s, si) => si).filter((si) => !preJoin(c, c.students[si], d));
  const liveOf = (c, d) => rowsOf(c, d).filter((si) => !absent(c.students[si].marks[d]));
  function colStat(c, d, k) {
    let p = 0, m = 0, e = 0;
    for (const si of liveOf(c, d)) { const v = marks(c.students[si], d)[k]; if (v === "p") p++; else if (v === "m") m++; else e++; }
    return {p, m, e, pct: p + m ? Math.round(p / (p + m) * 100) : null};
  }
  const pctCol = (p) => p >= 86 ? "var(--ok)" : p >= 66 ? "var(--acc)" : p >= 30 ? "var(--today,#e5a53a)" : "var(--danger)";
  const partial = (c, d) => liveOf(c, d).filter((si) => { const i = info(c.students[si], d); return i.any && !i.full; }).length;

  // bitta katakni o'zgartirish: 9 tasi bo'lsa — yig'indi baho, bo'lmasa — baho yo'q (chala)
  function write(c, si, d, a, putFn) {
    const s = c.students[si], old = s.marks[d] || "", late = lateOf(old), full = a.every(Boolean), [dd, uu] = sum(a);
    const nw = full ? buildMark([dd + uu], late) : late ? "kq" : (gradesOf(old).length ? "" : old);
    const pk = s.fk && s.fk[d], pp = s.fp && s.fp[d], str = a.map((v) => v === "p" ? "+" : v === "m" ? "-" : ".").join("");
    s.fk = s.fk || {}; s.fp = s.fp || {};
    if (a.some(Boolean)) s.fk[d] = str; else delete s.fk[d];
    if (full) s.fp[d] = [dd, uu]; else delete s.fp[d];
    const tidy = () => { if (!Object.keys(s.fk).length) delete s.fk; if (!Object.keys(s.fp).length) delete s.fp; };
    if (nw !== old && !putFn(si, nw)) {
      if (pk) s.fk[d] = pk; else delete s.fk[d];
      if (pp) s.fp[d] = pp; else delete s.fp[d];
      tidy(); return false;
    }
    tidy(); if (nw === old) save();
    else { const u = typeof UNDO !== "undefined" && UNDO[UNDO.length - 1]; if (u && u.length === 1 && u[0].kind === "mark" && u[0].s === s && u[0].key === d) u[0].kx = [pk || null, pp || null]; }   // ↶ belgilarni ham qaytaradi
    return true;
  }
  function setCell(c, si, d, k, v, putFn) {
    if (!canEdit(d)) { putMark(c, si, d, c.students[si].marks[d] || ""); return false; }   // sababini toast bilan aytadi
    const s = c.students[si]; if (absent(s.marks[d])) return false;
    if (other(s, d)) { toast(OTHER); return false; }
    const a = marks(s, d); a[k] = v; return write(c, si, d, a, putFn);
  }
  function fillRow(c, si, d, how, putFn) {
    if (!canEdit(d)) { putMark(c, si, d, c.students[si].marks[d] || ""); return false; }
    const s = c.students[si]; if (absent(s.marks[d])) return false;
    if (how !== "clr" && other(s, d)) { toast(OTHER); return false; }
    const a = marks(s, d).map((v) => how === "clr" ? null : how === "allp" ? "p" : v || how);
    return write(c, si, d, a, putFn);
  }
  function fillCol(c, d, k, how, putFn) {
    if (!canEdit(d)) { putMark(c, 0, d, c.students[0].marks[d] || ""); return 0; }
    let n = 0;
    for (const si of liveOf(c, d)) {
      const s = c.students[si], a = marks(s, d);
      if (how === "clr" ? !a[k] : a[k]) continue;
      if (other(s, d)) continue;   // boshqa usulda qo'yilgan bahoga tegilmaydi
      a[k] = how === "clr" ? null : how; if (write(c, si, d, a, putFn)) n++;
    }
    save(); return n;
  }

  /* ── ko'rinish ── */
  // mk — jurnaldagi belgi: baho boshqa usulda (Oddiy / Mezon bo'yicha) qo'yilgan bo'lsa, o'shani ko'rsatamiz
  function badge(i, mk) {
    const gs = gradesOf(mk || "");
    if (!i.any && gs.length) { const col = gradeColor(gs.reduce((a, b) => a + b, 0) / gs.length) || "var(--alt)"; return `<span class="kr-bh" style="background:${col};color:${contrast(col.startsWith("#") ? col : "#ffffff")}" title="Baho boshqa usulda qo'yilgan. Deskriptorni bossangiz, kriterial baho bilan almashtiriladi.">${gs.join("/")}</span><small>boshqa usul</small>`; }
    if (!i.any) return `<span class="kr-bh none">—</span>`;
    if (!i.full) return `<span class="kr-bh none" title="Hali hamma deskriptor belgilanmagan">${i.g}…</span><small>chala</small>`;
    const col = gradeColor(i.g) || "var(--alt)";
    return `<span class="kr-bh" style="background:${col};color:${contrast(col.startsWith("#") ? col : "#ffffff")}">${i.g}</span><small>${i.d} + ${i.u}</small>`;
  }
  function attSum(c, d) {
    const R = rowsOf(c, d), n = R.length, cnt = (v) => R.filter((si) => v === "kq" ? lateOf(c.students[si].marks[d] || "") : attPart(c.students[si].marks[d] || "") === v).length;
    const ab = R.filter((si) => absent(c.students[si].marks[d])).length;
    return `<div class="kr-att"><b>Davomat</b><span>Keldi <b>${n - ab}</b> / ${n}</span>${DAY_ATT.map(([v, t]) => { const col = markColors(v); return `<span title="${esc(t)}"><i style="${col ? `background:${col[0]};color:${col[1]}` : ""}">${v.toUpperCase()}</i>${esc(t.split(" (")[0])} <b>${cnt(v)}</b></span>`; }).join("")}</div>`;
  }
  // asboblar (mezon.js dagi «Mezon bo'yicha / Kriterial / Oddiy» panelining o'ng tomoni)
  const tools = () => `<button class="btn" type="button" data-kred>✎ Deskriptorlar</button><button class="btn" type="button" data-krpr>🖨 Chop etish / PDF</button>`;
  function head(c) {
    const ds = descs(c);
    return `<thead><tr class="g"><th class="nm" rowspan="2">O'quvchi</th><th class="att" rowspan="2">Davomat</th>
      <th class="gh" colspan="${ND + 1}">${GR[0].n}<small>${GR[0].r} ball</small></th><th class="gh" colspan="${N - ND}">${GR[1].n}<small>${GR[1].r} ball</small></th><th class="tot" rowspan="2">Baho<small>/ 10</small></th></tr>
      <tr class="d"><th class="gs base" title="Darsda qatnashgani uchun 1 ball (o'zi qo'yiladi)">D0<small>qatn.</small></th>${ds.map((t, k) => `<th class="${k === ND ? "gs" : ""}" data-krcol="${k}" tabindex="0" title="${code(k)} ${esc(t)}\nBosing: ustunni to'ldirish">${code(k)}<small>1 b</small></th>`).join("")}</tr></thead>`;
  }
  // ctx: {ed, att(si) — yo'qlama tugmalari, dn(si) — ism, risk: Set}
  function table(c, d, ctx) {
    const R = rowsOf(c, d).filter((si) => st.flt === "all" || (!absent(c.students[si].marks[d]) && !info(c.students[si], d).full && !other(c.students[si], d)));
    const ds = descs(c);
    let body = "";
    for (const si of R) {
      const s = c.students[si], mk = s.marks[d] || "", q = esc(normName(s.name)), risk = ctx.risk.has(s.name) ? "risk" : "";
      const att = `<td class="att"><div class="datt" role="group" aria-label="Yo'qlama">${ctx.att(si)}</div></td>`;
      if (absent(mk)) { body += `<tr class="off ${risk}" data-q="${q}" data-krr="${si}"><td class="nm"><div class="kr-nmw"><span class="kr-rm"></span>${ctx.dn(si)}</div></td>${att}<td colspan="${N + 1}" class="abs gs">${esc((DAY_ATT.find((x) => x[0] === attPart(mk)) || [0, "Darsda yo'q"])[1].split(" (")[0])} — baho qo'yilmaydi</td><td class="tot">—</td></tr>`; continue; }
      const i = info(s, d);
      body += `<tr class="${risk}" data-q="${q}" data-krr="${si}"><td class="nm"><div class="kr-nmw"><button type="button" class="kr-rm" data-krrow="${si}" title="Qatorni to'ldirish" aria-label="${esc(s.name)}: qatorni to'ldirish">⋯</button>${ctx.dn(si)}</div></td>${att}<td class="c gs base">1</td>
        ${i.a.map((v, k) => `<td class="c ${k === ND ? "gs" : ""}"><button type="button" class="kr-c ${v || "e"}" data-krc="${si}|${k}" ${ctx.ed ? "" : "disabled"} aria-label="${esc(s.name)}, ${code(k)}: ${v === "p" ? "plyus" : v === "m" ? "minus" : "bo'sh"}" title="${esc(s.name)}\n${code(k)} ${esc(ds[k])}">${sym(v)}</button></td>`).join("")}
        <td class="tot">${badge(i, mk)}</td></tr>`;
    }
    if (!R.length) body = `<tr><td class="nm muted" colspan="${N + 4}">Chala o'quvchi yo'q</td></tr>`;
    const L = liveOf(c, d).map((si) => info(c.students[si], d)).filter((i) => i.full), avg = L.length ? L.reduce((a, i) => a + i.g, 0) / L.length : null;
    const ft = `<td class="gs">—</td>` + ds.map((t, k) => { const cs = colStat(c, d, k); return `<td class="${k === ND ? "gs" : ""}" title="${code(k)}: + ${cs.p} ta, − ${cs.m} ta">${cs.pct == null ? "—" : cs.pct + "%"}<i class="kr-bar"><i style="width:${cs.pct || 0}%;background:${pctCol(cs.pct || 0)}"></i></i></td>`; }).join("");
    return `<div class="kr-tw"><table class="kr-t">${head(c)}<tbody>${body}</tbody>
      <tfoot><tr><td class="nm">«+» ulushi (sinf)</td><td class="att"></td>${ft}<td class="tot">${avg == null ? "—" : avg.toFixed(1)}</td></tr></tfoot></table></div>`;
  }
  function pmBtns(si, k, v, ed) {
    return `<span class="kr-pm"><button type="button" class="p ${v === "p" ? "on" : ""}" data-krset="${si}|${k}|p" aria-pressed="${v === "p"}" aria-label="Plyus" ${ed ? "" : "disabled"}>+</button><button type="button" class="m ${v === "m" ? "on" : ""}" data-krset="${si}|${k}|m" aria-pressed="${v === "m"}" aria-label="Minus" ${ed ? "" : "disabled"}>−</button></span>`;
  }
  function stuView(c, d, ctx) {
    const L = liveOf(c, d); if (!L.length) return `<p class="muted kr-pad">Darsda o'quvchi yo'q.</p>`;
    if (!L.includes(st.stu)) st.stu = L[0];
    const si = st.stu, s = c.students[si], i = info(s, d), ds = descs(c);
    return `<div class="kr-stuh"><button type="button" class="btn" data-krstu="-1" aria-label="Oldingi o'quvchi">‹</button><select class="form-select" data-krstusel aria-label="O'quvchi">${L.map((k) => { const j = info(c.students[k], d); return `<option value="${k}" ${k === si ? "selected" : ""}>${k + 1}. ${esc(c.students[k].name)}${j.full ? " · " + j.g : j.any ? " · chala" : " · bo'sh"}</option>`; }).join("")}</select><button type="button" class="btn" data-krstu="1" aria-label="Keyingi o'quvchi">›</button></div>
      <div class="kr-tot2"><span class="datt" role="group" aria-label="Yo'qlama">${ctx.att(si)}</span><span class="sp"></span>${badge(i, s.marks[d])}</div>
      ${GR.map((g, gi) => `<div class="kr-mg"><div class="kr-mh"><span>${g.n}</span><span class="muted">${gi ? i.u : i.d} / ${gi ? 4 : 6}</span></div>
        ${gi ? "" : `<div class="kr-dr"><span class="t"><b>D0</b> Darsda qatnashdi<small>1 ball · o'zi qo'yiladi</small></span><span class="muted">✓</span></div>`}
        ${ds.map((t, k) => (k < ND) === !gi ? `<div class="kr-dr"><span class="t"><b>${code(k)}</b> ${esc(t)}</span>${pmBtns(si, k, i.a[k], ctx.ed)}</div>` : "").join("")}</div>`).join("")}
      <div class="kr-nav">${ctx.ed ? `<button type="button" class="btn" data-krrowfill="${si}|p">Bo'shlarga +</button>` : ""}<button type="button" class="btn" data-krmsg="${si}">✉ Ota-onaga xabar</button><span class="sp"></span><button type="button" class="btn btn-primary" data-krstu="1">Keyingi o'quvchi ›</button></div>`;
  }
  function desView(c, d, ctx) {
    const k = st.des, ds = descs(c), cs = colStat(c, d, k), L = liveOf(c, d);
    return `<div class="kr-stuh"><button type="button" class="btn" data-krdes="-1" aria-label="Oldingi deskriptor">‹</button><select class="form-select" data-krdessel aria-label="Deskriptor">${ds.map((t, j) => `<option value="${j}" ${j === k ? "selected" : ""}>${code(j)} ${esc(t)}</option>`).join("")}</select><button type="button" class="btn" data-krdes="1" aria-label="Keyingi deskriptor">›</button></div>
      <div class="kr-cnt"><span class="muted">${k < ND ? GR[0].n : GR[1].n} · «+» = 1 ball</span><span class="sp"></span><b class="a">+ ${cs.p}</b><b class="b">− ${cs.m}</b><b class="c">bo'sh ${cs.e}</b></div>
      <div class="kr-sl">${L.map((si) => `<div class="kr-dr"><span class="t">${si + 1}. ${esc(c.students[si].name)}</span>${pmBtns(si, k, marks(c.students[si], d)[k], ctx.ed)}</div>`).join("")}</div>
      <div class="kr-nav">${ctx.ed ? `<button type="button" class="btn" data-krcolfill="${k}|p">Bo'shlarga +</button>` : ""}<span class="sp"></span><button type="button" class="btn btn-primary" data-krdes="1">Keyingi deskriptor ›</button></div>`;
  }
  /* ── v5 (Akmal tasdiqladi, 2026-11-12): chorak tahlili, telefonda «Ro'yxat», chala ogohlantirish, ota-onaga xabar ── */
  const heat = (p) => p == null ? "var(--soft,var(--alt))" : `color-mix(in srgb, ${pctCol(p)} ${p >= 86 ? 34 : p >= 66 ? 30 : 36}%, var(--base))`;
  const gcol = (g) => { const col = gradeColor(g) || "var(--alt)"; return `background:${col};color:${contrast(col.startsWith("#") ? col : "#ffffff")}`; };
  const low = (t) => t.charAt(0).toLowerCase() + t.slice(1);
  const subj = (c) => c.subject ? ` ${c.subject}` : "";
  // telefon «Ro'yxat»: har o'quvchi kartochkada, 9 katak bir qatorda — jadvalni yon tomonga surish shart emas
  function listView(c, d, ctx) {
    const R = rowsOf(c, d).filter((si) => st.flt === "all" || (!absent(c.students[si].marks[d]) && !info(c.students[si], d).full && !other(c.students[si], d)));
    if (!R.length) return `<p class="muted kr-pad">${st.flt === "all" ? "O'quvchi yo'q." : "Chala o'quvchi yo'q."}</p>`;
    const cell = (s, si, k, v) => `<button type="button" class="kr-c kr-lc ${v || "e"}" data-krc="${si}|${k}" ${ctx.ed ? "" : "disabled"} aria-label="${esc(s.name)}, ${code(k)}: ${v === "p" ? "plyus" : v === "m" ? "minus" : "bo'sh"}" title="${code(k)} ${esc(descs(c)[k])}"><span>${sym(v)}</span><small>${code(k)}</small></button>`;
    return `<div class="kr-lv">${R.map((si) => {
      const s = c.students[si], mk = s.marks[d] || "", ab = absent(mk), ap = attPart(mk), late = lateOf(mk), i = info(s, d), cur = ab ? ap : late ? "kq" : "", col = cur && markColors(cur);
      const top = `<div class="kr-lt">${ctx.dn(si)}<button type="button" class="kr-ac" data-kratt="${si}" aria-expanded="${st.ao === si || ab}" title="Davomat" style="${col ? `background:${col[0]};color:${col[1]};border-color:transparent` : ""}">${cur ? cur.toUpperCase() : "✓"}</button><span class="sp"></span>${ab ? `<span class="kr-bh none">—</span>` : badge(i, mk)}<button type="button" class="kr-rm" data-krrow="${si}" aria-label="${esc(s.name)}: amallar">⋯</button></div>`;
      const att = st.ao === si || ab ? `<div class="datt kr-la" role="group" aria-label="Yo'qlama">${ctx.att(si)}</div>` : "";
      const body = ab ? `<div class="muted kr-small">${esc((DAY_ATT.find((x) => x[0] === ap) || [0, "Darsda yo'q"])[1].split(" (")[0])} — baho qo'yilmaydi</div>`
        : `<div class="kr-lr"><span class="kr-d0" title="D0 — darsda qatnashgani, 1 ball">1</span>${i.a.map((v, k) => (k === ND ? `<span class="kr-gsep"></span>` : "") + cell(s, si, k, v)).join("")}</div>`;
      return `<div class="kr-lc0 ${ab ? "off" : i.any && !i.full ? "ch" : ""} ${ctx.risk.has(s.name) ? "risk" : ""}" data-krr="${si}" data-q="${esc(normName(s.name))}">${top}${att}${body}</div>`;
    }).join("")}</div>`;
  }
  // baho chala qolganlar: 9 deskriptor belgilanmaguncha jurnalga baho tushmaydi
  function chala(c, d, ctx) {
    const L = liveOf(c, d).filter((si) => !other(c.students[si], d)), I = L.map((si) => info(c.students[si], d));
    const ch = I.filter((i) => i.any && !i.full).length, em = I.filter((i) => !i.any).length, full = I.filter((i) => i.full).length;
    if (!ch && !(em && full)) return full && !em ? `<div class="kr-okb">✓ Hamma o'quvchining bahosi jurnalga yozildi</div>` : "";
    return `<div class="kr-wb"><span><b>${ch + em} o'quvchining bahosi jurnalga hali yozilmagan</b><small>${[ch ? `chala: ${ch} ta` : "", em ? `umuman belgilanmagan: ${em} ta` : ""].filter(Boolean).join(" · ")} — 9 ta deskriptor belgilanmaguncha baho chiqmaydi</small></span><span class="sp"></span>${st.flt === "ch" ? `<button type="button" class="btn btn-sm" data-krflt="all">Hammasini ko'rsatish</button>` : `<button type="button" class="btn btn-sm" data-krflt="ch">Ko'rsatish</button>`}${ch && ctx.ed ? `<button type="button" class="btn btn-sm" data-krchm>Chalalarning bo'shiga −</button>` : ""}</div>`;
  }
  /* chorak tahlili: chorakdagi kriterial baholangan darslar (kamida bitta to'liq baho) bo'yicha */
  function qData(c, q) {
    const r = qRange(q), t = todayIso(); if (!r) return null;
    const ds = c.dates.filter((x) => x >= r[0] && x <= r[1] && x <= t && !isNoLesson(c, x)).sort().filter((x) => c.students.some((s) => !preJoin(c, s, x) && info(s, x).full));
    const per = c.students.map((s) => {
      const P = {g: [], p: Array(N).fill(0), n: Array(N).fill(0), ab: 0};
      for (const x of ds) {
        if (preJoin(c, s, x)) { P.g.push(null); continue; }
        if (absent(s.marks[x])) { P.ab++; P.g.push(null); continue; }
        const a = marks(s, x); P.g.push(a.every(Boolean) ? sum(a)[0] + sum(a)[1] : null);
        a.forEach((v, k) => { if (v) { P.n[k]++; if (v === "p") P.p[k]++; } });
      }
      const g = P.g.filter((v) => v != null), h = Math.floor(g.length / 2), mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
      P.cnt = g.length; P.avg = g.length ? mean(g) : null; P.tr = g.length >= 4 ? mean(g.slice(h)) - mean(g.slice(0, h)) : 0;
      P.pct = P.p.map((p, k) => P.n[k] ? Math.round(p / P.n[k] * 100) : null);
      return P;
    });
    const les = ds.map((x) => { const g = c.students.map((s) => info(s, x)).filter((i) => i.full).map((i) => i.g); return g.length ? g.reduce((a, b) => a + b, 0) / g.length : null; });
    const h = Math.floor(ds.length / 2), dp = descs(c).map((t2, k) => {
      let p = 0, n = 0, p1 = 0, n1 = 0;
      ds.forEach((x, li) => c.students.forEach((s) => { if (preJoin(c, s, x) || absent(s.marks[x])) return; const v = marks(s, x)[k]; if (!v) return; n++; if (v === "p") p++; if (li < h) { n1++; if (v === "p") p1++; } }));
      const a = n1 ? p1 / n1 * 100 : null, b = n - n1 ? (p - p1) / (n - n1) * 100 : null;
      return {k, pct: n ? Math.round(p / n * 100) : null, ch: a != null && b != null && ds.length >= 4 ? Math.round(b - a) : 0};
    });
    return {q, ds, per, les, dp};
  }
  const attn = (Q) => Q.per.map((P, si) => ({si, ...P})).filter((P) => P.cnt >= 2 && (P.avg < 5.5 || (P.tr <= -1.2 && P.avg < 7.5))).sort((a, b) => a.avg - b.avg);
  const trIc = (tr) => tr >= 0.8 ? `<span class="kr-up" title="Ko'tarilmoqda">↑</span>` : tr <= -0.8 ? `<span class="kr-dn" title="Pasaymoqda">↓</span>` : `<span class="muted">→</span>`;
  function qView(c, d) {
    const qs = [1, 2, 3, 4].filter((q) => qRange(q)), q = qs.includes(st.q) ? st.q : quarterOf(d) || qs[0];
    const chips = `<div class="kr-bar2"><div class="mz-seg" role="group" aria-label="Chorak">${qs.map((k) => `<button type="button" class="${k === q ? "on" : ""}" data-krq="${k}">${k}-chorak</button>`).join("")}</div>`;
    if (!q) return `${chips}</div><p class="muted kr-pad">Sozlamalarda chorak sanalari yo'q.</p>`;
    const Q = qData(c, q), ds = descs(c);
    if (!Q.ds.length) return `${chips}</div><p class="muted kr-pad">${q}-chorakda kriterial (+/−) usulida baholangan dars hali yo'q.</p>`;
    const all = Q.per.filter((P) => P.avg != null), avg = all.reduce((a, P) => a + P.avg, 0) / Math.max(1, all.length);
    const pp = Q.dp.filter((x) => x.pct != null), plus = pp.length ? Math.round(pp.reduce((a, x) => a + x.pct, 0) / pp.length) : 0, A = attn(Q);
    const n = Q.ds.length, W = Math.max(300, n * 30), H = 130, step = (W - 40) / n, bw = Math.min(22, step - 6), every = Math.ceil(n / 9);
    const grid = [2, 4, 6, 8, 10].map((v) => { const y = H - 18 - v / 10 * (H - 30); return `<line x1="30" x2="${W}" y1="${y}" y2="${y}" class="kr-gl"/><text x="24" y="${y + 4}" text-anchor="end" class="kr-ax">${v}</text>`; }).join("");
    const bars = Q.les.map((g, li) => { if (g == null) return ""; const x = 34 + li * step, hh = g / 10 * (H - 30); return `<rect x="${x}" y="${H - 18 - hh}" width="${bw}" height="${hh}" rx="3" fill="${pctCol((g - 1) / 9 * 100)}"><title>${fmt(Q.ds[li])}: o'rtacha ${g.toFixed(1)}</title></rect>${li % every === 0 || li === n - 1 ? `<text x="${x + bw / 2}" y="${H - 4}" text-anchor="middle" class="kr-ax">${fmt(Q.ds[li]).slice(0, 5)}</text>` : ""}`; }).join("");
    const dps = Q.dp.filter((x) => x.pct != null).sort((a, b) => a.pct - b.pct);
    const rows = Q.per.map((P, si) => P.cnt || P.p.some(Boolean) || P.n.some(Boolean) ? `<tr data-krprof="${si}" tabindex="0" title="${esc(c.students[si].name)} — profil va ota-onaga xabar"><td class="nm"><span class="dn"><i>${si + 1}</i>${esc(c.students[si].name)}</span></td>${P.pct.map((p, k) => `<td class="${k === ND ? "gs" : ""}"><span class="kr-ht" style="background:${heat(p)}">${p == null ? "—" : p}</span></td>`).join("")}<td class="tot">${P.avg == null ? "—" : `<span class="kr-bh" style="${gcol(P.avg)}">${P.avg.toFixed(1)}</span>`}</td><td class="kr-trc">${trIc(P.tr)}</td></tr>` : "").join("");
    return `${chips}<span class="muted kr-small">${n} ta dars · ${fmt(Q.ds[0])} – ${fmt(Q.ds[n - 1])}</span><span class="sp"></span><button type="button" class="btn btn-sm" data-krqall="${q}">✉ Ota-onalarga chorak xabarlari</button></div>
      <div class="kr-tiles"><div><small>Kriterial baholangan darslar</small><b>${n}</b></div><div><small>Sinf o'rtacha bahosi</small><b>${all.length ? avg.toFixed(1) : "—"}</b></div><div><small>«+» ulushi</small><b>${plus}%</b></div><div><small>E'tibor kerak</small><b style="${A.length ? "color:var(--danger)" : ""}">${A.length} o'quvchi</b></div></div>
      <div class="kr-two"><div class="card kr-card"><b>Darslar bo'yicha sinf o'rtachasi</b><div class="kr-chw"><svg viewBox="0 0 ${W + 4} ${H}" width="100%" style="min-width:300px;max-height:240px" role="img" aria-label="Darslar bo'yicha o'rtacha baho">${grid}${bars}</svg></div></div>
        <div class="card kr-card"><b>Deskriptorlar · chorakda «+» ulushi</b>${dps.map((x) => `<div class="kr-wk"><span><b>${code(x.k)}</b> ${esc(ds[x.k])}</span><b>${x.pct}%${x.ch >= 5 ? ` <small class="kr-up">↑${x.ch}</small>` : x.ch <= -5 ? ` <small class="kr-dn">↓${-x.ch}</small>` : ""}</b><i class="kr-bar"><i style="width:${x.pct}%;background:${pctCol(x.pct)}"></i></i></div>`).join("")}<span class="muted kr-small">↑ / ↓ — chorakning ikkinchi yarmi birinchisiga nisbatan.</span></div></div>
      ${A.length ? `<div class="card kr-card"><b>E'tibor kerak bo'lgan o'quvchilar</b><div class="kr-at2">${A.map((P) => { const w = P.pct.map((p, k) => ({p, k})).filter((x) => x.p != null).sort((a, b) => a.p - b.p).slice(0, 2); return `<button type="button" class="kr-atc" data-krprof="${P.si}"><b>${esc(c.students[P.si].name)}</b><span class="kr-bh" style="${gcol(P.avg)}">${P.avg.toFixed(1)}</span>${P.tr <= -0.8 ? `<span class="kr-dn">pasaymoqda ↓</span>` : ""}<small>${w.map((x) => `${code(x.k)} ${x.p}%`).join(" · ")}</small></button>`; }).join("")}</div></div>` : ""}
      <div class="card kr-card"><b>O'quvchi × deskriptor (chorakda «+» %)</b>
        <div class="kr-tw"><table class="kr-t kr-hq"><thead><tr class="d"><th class="nm">O'quvchi</th>${ds.map((t2, k) => `<th class="${k === ND ? "gs" : ""} base" title="${esc(t2)}">${code(k)}</th>`).join("")}<th class="tot">O'rt.</th><th>Yo'n.</th></tr></thead><tbody>${rows}</tbody></table></div>
        <span class="muted kr-small">Qatorni bosing — o'quvchining chorakdagi profili va ota-onaga xabar matni.</span></div>`;
  }
  function parentDay(c, si, d) {
    const s = c.students[si], mk = s.marks[d] || "", i = info(s, d), ds = descs(c), when = `bugun (${fmt(d)})`;
    if (absent(mk)) return `Hurmatli ota-ona! ${s.name} ${when}${subj(c)} darsida bo'lmadi: ${low((DAY_ATT.find((x) => x[0] === attPart(mk)) || [0, "darsda yo'q"])[1].split(" (")[0])}.`;
    if (other(s, d)) return `Hurmatli ota-ona! ${s.name} ${when}${subj(c)} darsidan ${gradesOf(mk).join("/")} baho oldi.`;
    if (!i.full) return `Hurmatli ota-ona! ${s.name}ning ${when}gi${subj(c)} bahosi hali to'liq qo'yilmagan.`;
    const pl = i.a.map((v, k) => v === "p" && k < ND ? low(ds[k]) : null).filter(Boolean), mi = i.a.map((v, k) => v === "m" ? low(ds[k]) : null).filter(Boolean);
    return `Hurmatli ota-ona! ${s.name} ${when}${subj(c)} darsidan ${i.g} baho oldi (darsdagi ish ${i.d}/6, uy vazifasi ${i.u}/4).` + (pl.length ? `\nYaxshi tomonlari: ${pl.slice(0, 3).join("; ")}.` : "") + (mi.length ? `\nE'tibor qaratish kerak: ${mi.join("; ")}.` : "\nBarcha mezonlar bajarildi — barakalla!");
  }
  function parentQ(c, si, Q) {
    const s = c.students[si], P = Q.per[si], ds = descs(c);
    if (P.avg == null) return `Hurmatli ota-ona! ${s.name}: ${Q.q}-chorakda${subj(c)} fanidan kriterial baho yo'q.`;
    const sc = P.pct.map((p, k) => ({p, k})).filter((x) => x.p != null), best = sc.filter((x) => x.p >= 66).sort((a, b) => b.p - a.p).slice(0, 2), weak = sc.filter((x) => x.p < 66).sort((a, b) => a.p - b.p).slice(0, 3);
    return `Hurmatli ota-ona! ${s.name}ning ${Q.q}-chorakdagi${subj(c)} fanidan kundalik baholari: o'rtacha ${P.avg.toFixed(1)} (${P.cnt} ta dars${P.ab ? `, ${P.ab} ta darsda qatnashmagan` : ""}).` + (P.tr >= 0.8 ? " Natijalar ko'tarilmoqda." : P.tr <= -0.8 ? " Chorak oxirida natijalar pasaygan." : "")
      + (best.length ? `\nKuchli tomonlari: ${best.map((x) => low(ds[x.k])).join("; ")}.` : "") + (weak.length ? `\nE'tibor qaratish kerak: ${weak.map((x) => `${low(ds[x.k])} (${x.p}%)`).join("; ")}.` : "");
  }
  // matn Telegram botingizga boradi (u yerdan ota-onaga uzatasiz); 4096 belgidan uzun bo'lsa — bo'lib
  async function tgText(t, btn) {
    if (typeof tgOn !== "function" || !tgOn()) { toast("Telegram ulanmagan: Sozlamalar → «Telegram'ga zaxira»"); return; }
    const parts = []; let cur = "";
    for (const blk of t.split("\n\n")) { if (cur && (cur + "\n\n" + blk).length > 3800) { parts.push(cur); cur = blk; } else cur = cur ? cur + "\n\n" + blk : blk; }
    if (cur) parts.push(cur);
    if (btn) btn.disabled = true;
    try { for (const p of parts) await tgApi("sendMessage", {chat_id: tgCfg().chat, text: p}); toast("Telegram'ga yuborildi — ota-onaga uzating"); }
    catch (e) { toast(tgErrTxt(e)); } finally { if (btn) btn.disabled = false; }
  }
  const msgBox = (t) => `<div class="kr-edh">✉ Ota-onaga xabar</div><textarea class="form-control kr-msg" rows="5" aria-label="Xabar matni">${esc(t)}</textarea><span class="muted kr-small">Matnni o'zgartirishingiz mumkin. «Telegram'ga» — botingizga yuboriladi, u yerdan ota-onaga uzatasiz.</span>`;
  const msgFoot = `<div class="kr-foot"><button class="btn" type="button" data-x>Yopish</button><span class="sp"></span><button class="btn" type="button" data-kcp>Nusxalash</button><button class="btn btn-primary" type="button" data-ktt>✈️ Telegram'ga</button></div>`;
  const msgBind = (m, close) => { $("[data-x]", m).onclick = () => close(); $("[data-kcp]", m).onclick = () => copyText($(".kr-msg", m).value); $("[data-ktt]", m).onclick = (e) => tgText($(".kr-msg", m).value, e.currentTarget); };
  function msgDlg(c, si, d) { modal(`<div class="kr-dlg"><h2>${si + 1}. ${esc(c.students[si].name)}</h2>${msgBox(parentDay(c, si, d))}${msgFoot}</div>`, msgBind); }
  function profDlg(c, si, q) {
    const Q = qData(c, q); if (!Q) return; const P = Q.per[si], g = P.g, ds = descs(c), W = 300, H = 70;
    const pts = g.map((v, k) => v == null ? null : [14 + k * ((W - 24) / Math.max(1, g.length - 1)), H - 10 - (v - 1) / 9 * (H - 20)]);
    const path = pts.filter(Boolean).map((p, k) => (k ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    modal(`<div class="kr-dlg"><h2>${si + 1}. ${esc(c.students[si].name)}</h2>
      <span class="muted kr-small">${q}-chorak${esc(subj(c))} · o'rtacha <b>${P.avg == null ? "—" : P.avg.toFixed(1)}</b> · ${P.cnt} ta baho${P.ab ? ` · ${P.ab} ta darsda yo'q` : ""}</span>
      ${P.cnt ? `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="Baholar dinamikasi">${[1, 5.5, 10].map((v) => `<line x1="0" x2="${W}" y1="${H - 10 - (v - 1) / 9 * (H - 20)}" y2="${H - 10 - (v - 1) / 9 * (H - 20)}" class="kr-gl"/>`).join("")}<path d="${path}" fill="none" stroke="var(--acc)" stroke-width="2"/>${pts.map((p, k) => p ? `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="${pctCol((g[k] - 1) / 9 * 100)}"><title>${fmt(Q.ds[k])}: ${g[k]}</title></circle>` : "").join("")}</svg>` : ""}
      ${GR.map((gr, gi) => `<div class="kr-edh">${gr.n}</div>${ds.map((t2, k) => (k < ND) === !gi ? `<div class="kr-wk"><span><b>${code(k)}</b> ${esc(t2)}</span><b>${P.pct[k] == null ? "—" : P.pct[k] + "%"}</b><i class="kr-bar"><i style="width:${P.pct[k] || 0}%;background:${pctCol(P.pct[k] || 0)}"></i></i></div>` : "").join("")}`).join("")}
      ${msgBox(parentQ(c, si, Q))}${msgFoot}</div>`, msgBind);
  }
  function qAllDlg(c, q) {
    const Q = qData(c, q); if (!Q) return;
    const L = c.students.map((s, si) => si).filter((si) => Q.per[si].cnt), txt = L.map((si) => parentQ(c, si, Q));
    modal(`<div class="kr-dlg"><h2>Ota-onalarga chorak xabarlari</h2><span class="muted kr-small">${L.length} ta xabar · ${q}-chorak${esc(subj(c))}. Har birini nusxalab ota-ona guruhiga yoki shaxsiy chatga yuborasiz.</span>
      <div class="kr-qml">${L.map((si, k) => `<div class="kr-qm"><div class="hrow"><b>${si + 1}. ${esc(c.students[si].name)}</b><span class="sp"></span><button class="btn btn-sm" type="button" data-kq1="${k}">Nusxalash</button></div><p>${esc(txt[k]).replace(/\n/g, "<br>")}</p></div>`).join("")}</div>
      <div class="kr-foot"><button class="btn" type="button" data-x>Yopish</button><span class="sp"></span><button class="btn" type="button" data-kcpa>Hammasini nusxalash</button><button class="btn btn-primary" type="button" data-ktta>✈️ Telegram'ga</button></div></div>`,
    (m, close) => {
      $("[data-x]", m).onclick = () => close();
      m.querySelectorAll("[data-kq1]").forEach((b) => b.onclick = () => copyText(txt[+b.dataset.kq1]));
      $("[data-kcpa]", m).onclick = () => copyText(txt.join("\n\n"));
      $("[data-ktta]", m).onclick = (e) => tgText(txt.join("\n\n"), e.currentTarget);
    });
  }
  // fanlar bo'yicha tayyor deskriptorlar («✎ Deskriptorlar» oynasida)
  const TPL = [
    ["Umumiy (namuna)", DEF],
    ["Matematika", ["Yangi mavzuni tushunib, savollarga javob beradi", "Misol va masalani to'g'ri yechadi", "Yechimni izohlab beradi", "Doskada / guruhda faol ishlaydi", "Hisoblashda xato qilmaydi", "Uy vazifasi bajarilgan", "Barcha misollar yechilgan", "Yechimlar to'g'ri", "Daftar ozoda, yechim to'liq yozilgan"]],
    ["Ona tili va adabiyot", ["Matnni ifodali o'qiydi", "Savollarga to'liq javob beradi", "Fikrini og'zaki aniq bayon qiladi", "Imlo va tinish belgilariga rioya qiladi", "Yozma ishni mustaqil bajaradi", "Uy vazifasi bajarilgan", "To'liq bajarilgan", "Imloviy xatosiz", "Husnixat va ozodalik"]],
    ["Ingliz tili", ["Yangi so'zlarni biladi", "Savollarga ingliz tilida javob beradi", "Juftlikda muloqot qiladi", "Tinglab tushunadi", "Grammatikani to'g'ri qo'llaydi", "Uy vazifasi bajarilgan", "Yangi so'zlar yodlangan", "Mashqlar to'g'ri bajarilgan", "O'z vaqtida va ozoda"]],
    ["Informatika", ["Nazariy savollarga javob beradi", "Kompyuterda topshiriqni bajaradi", "Algoritm / dasturni to'g'ri tuzadi", "Texnika xavfsizligiga rioya qiladi", "Mustaqil ishlaydi", "Uy vazifasi bajarilgan", "To'liq bajarilgan", "To'g'ri ishlaydi, xatosiz", "O'z vaqtida topshirilgan"]],
    ["Tabiiy fanlar", ["Mavzu bo'yicha savollarga javob beradi", "Tajriba / kuzatishda faol", "Atamalarni to'g'ri qo'llaydi", "Jadval, chizma, xaritadan foydalanadi", "Xulosa chiqara oladi", "Uy vazifasi bajarilgan", "To'liq bajarilgan", "Xatosiz yoki kam xato", "O'z vaqtida va ozoda"]],
    ["Jismoniy tarbiya", ["Sport kiyimida kelgan", "Badantarbiya mashqlarini bajaradi", "Asosiy mashqni to'g'ri bajaradi", "Jamoada qoidaga rioya qilib o'ynaydi", "Xavfsizlik qoidalariga rioya qiladi", "Uy mashqlari bajarilgan", "Kun tartibiga rioya qiladi", "Me'yorni bajaradi", "Gigiyena qoidalariga rioya qiladi"]]];

  // .dlist ichidagi hamma narsa
  function view(c, d, ctx) {
    const tabs = `<div class="mz-seg kr-seg" role="group" aria-label="Bo'lim"><button type="button" class="${st.tab === "q" ? "" : "on"}" data-krtab="day">Bugungi dars</button><button type="button" class="${st.tab === "q" ? "on" : ""}" data-krtab="q">Chorak tahlili</button></div>`;
    if (st.tab === "q") return `<div class="kr-box">${tabs}${qView(c, d)}</div>`;
    const t = tel(), v = t ? st.v : "tab";
    const seg = t ? `<div class="mz-seg kr-seg" role="group" aria-label="Ko'rinish">${[["list", "Ro'yxat"], ["tab", "Jadval"], ["stu", "O'quvchi"], ["des", "Deskriptor"]].map(([k, l]) => `<button type="button" class="${v === k ? "on" : ""}" data-krv="${k}">${l}</button>`).join("")}</div>` : "";
    const bar = `<div class="kr-bar2">${t ? "" : `<div class="mz-seg" role="group" aria-label="Filtr">${[["all", "Hammasi"], ["ch", "Chala / bo'sh"]].map(([k, l]) => `<button type="button" class="${st.flt === k ? "on" : ""}" data-krflt="${k}">${l}</button>`).join("")}</div>`}
      <span class="kr-lg"><i class="p">+</i>bajardi — 1 ball <i class="m">−</i>bajarmadi — 0</span><span class="sp"></span>${ctx.ed ? `<button type="button" class="btn btn-sm" data-krall>Bo'sh kataklarga +</button>` : ""}</div>`;
    const fl = t && v === "list" ? `<div class="kr-bar2"><div class="mz-seg" role="group" aria-label="Filtr">${[["all", "Hammasi"], ["ch", "Chala / bo'sh"]].map(([k, l]) => `<button type="button" class="${st.flt === k ? "on" : ""}" data-krflt="${k}">${l}</button>`).join("")}</div><span class="sp"></span>${ctx.ed ? `<button type="button" class="btn btn-sm" data-krall>Bo'shlarga +</button>` : ""}</div>` : "";
    return `<div class="kr-box">${tabs}${chala(c, d, ctx)}${attSum(c, d)}${seg}${v === "tab" ? bar + table(c, d, ctx) : v === "list" ? fl + listView(c, d, ctx) : v === "stu" ? stuView(c, d, ctx) : desView(c, d, ctx)}</div>`;
  }
  function side(c, d) {
    const L = liveOf(c, d), F = L.map((si) => info(c.students[si], d)).filter((i) => i.full), ds = descs(c);
    const av = (k) => F.length ? (F.reduce((a, i) => a + i[k], 0) / F.length).toFixed(1) : "—";
    const dist = [[9, "8–10", (g) => g >= 8], [6, "5–7", (g) => g >= 5 && g < 8], [2, "1–4", (g) => g < 5]].map(([x, l, f]) => { const col = gradeColor(x) || "var(--alt)"; return `<span><i style="background:${col};color:${contrast(col.startsWith("#") ? col : "#ffffff")}">${l}</i><b>${F.filter((i) => f(i.g)).length}</b> ta</span>`; }).join("");
    const weak = ds.map((t, k) => ({k, t, ...colStat(c, d, k)})).filter((x) => x.pct != null && x.m).sort((a, b) => a.pct - b.pct).slice(0, 3);
    return `<div class="kr-side"><div class="card kr-card"><b>Bugungi dars</b>
      <div class="kr-av"><span>Darsdagi ish · o'rtacha</span><b>${av("d")} / 6</b></div><div class="kr-av"><span>Uy vazifasi · o'rtacha</span><b>${av("u")} / 4</b></div>
      <div class="kr-dist">${dist}</div><span class="muted kr-small">Jurnalga yozildi: ${F.length} / ${L.length}</span></div>
      ${weak.length ? `<div class="card kr-card"><b>Eng ko'p «−» olgan deskriptorlar</b>${weak.map((x) => `<div class="kr-wk"><span><b>${code(x.k)}</b> ${esc(x.t)} <small class="muted">· − ${x.m} ta</small></span><b>${x.pct}%</b><i class="kr-bar"><i style="width:${x.pct}%;background:${pctCol(x.pct)}"></i></i></div>`).join("")}<span class="muted kr-small">Keyingi darsda shularga e'tibor bering.</span></div>` : ""}</div>`;
  }

  /* ── oynalar ── */
  let pop = null;
  const closePop = () => { if (pop) { pop.remove(); pop = null; document.removeEventListener("pointerdown", outPop, true); } };
  const outPop = (e) => { if (pop && !pop.contains(e.target)) closePop(); };
  function openPop(anchor, html, bindFn) {
    closePop(); pop = h(`<div class="kr-pop" role="menu">${html}</div>`); document.body.append(pop);
    const r = anchor.getBoundingClientRect(), w = pop.offsetWidth;
    pop.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + scrollX + "px"; pop.style.top = r.bottom + 4 + scrollY + "px";
    setTimeout(() => document.addEventListener("pointerdown", outPop, true), 0);
    bindFn(pop);
  }
  function editDlg(c, after) {
    const ds = descs(c).slice(), row = (k) => `<label class="kr-ed"><b>${code(k)}</b><input class="form-control" id="kr-d${k}" maxlength="60" value="${esc(ds[k])}" aria-label="${code(k)}"></label>`;
    modal(`<div class="kr-dlg"><h2>Deskriptorlar · ${esc(c.name || "")}${c.subject ? " " + esc(c.subject) : ""}</h2>
      <p class="muted kr-small">Har «+» — 1 ball. Soni o'zgarmaydi: darsdagi ish 5 ta (+1 qatnashgani uchun), uy vazifasi 4 ta. Matnni fan va sinfga moslab yozing.</p>
      <div class="kr-edh">Fan bo'yicha shablon</div><div class="kr-tpl">${TPL.map(([n2], k) => `<button type="button" class="kr-chip ${TPL[k][1].every((t, j) => t === ds[j]) ? "on" : ""}" data-krtpl="${k}">${esc(n2)}</button>`).join("")}</div><span class="muted kr-small">Shablonni tanlang, keyin matnni o'zingizga moslang.</span>
      <div class="kr-edh">Darsdagi ish · 1–6</div><label class="kr-ed"><b>D0</b><input class="form-control" value="Darsda qatnashdi (o'zi qo'yiladi)" disabled></label>${ds.slice(0, ND).map((t, k) => row(k)).join("")}
      <div class="kr-edh">Uy vazifasi · 0–4</div>${ds.slice(ND).map((t, k) => row(k + ND)).join("")}
      <label class="kr-chk"><input type="checkbox" id="kr-all"> Barcha sinflarimga qo'llash</label>
      <div class="kr-foot"><button class="btn" type="button" data-krdef>Namunaga qaytarish</button><span class="sp"></span><button class="btn" type="button" data-x>Bekor qilish</button><button class="btn btn-primary" type="button" data-ok>Saqlash</button></div></div>`,
    (m, close) => {
      $("[data-x]", m).onclick = () => close();
      $("[data-krdef]", m).onclick = () => DEF.forEach((t, k) => { $(`#kr-d${k}`, m).value = t; });
      m.querySelectorAll("[data-krtpl]").forEach((b) => b.onclick = () => { TPL[+b.dataset.krtpl][1].forEach((t, k) => { $(`#kr-d${k}`, m).value = t; }); m.querySelectorAll("[data-krtpl]").forEach((x) => x.classList.toggle("on", x === b)); });
      $("[data-ok]", m).onclick = () => {
        const v = DEF.map((t, k) => String($(`#kr-d${k}`, m).value || "").trim().slice(0, 60) || t), same = v.every((t, k) => t === DEF[k]);
        for (const x of $("#kr-all", m).checked ? D.classes : [c]) { if (same) delete x.kd; else x.kd = v.slice(); }
        save(); close(); toast("Deskriptorlar saqlandi"); after();
      };
    });
  }
  // chop etish / PDF / Telegram — alohida fayl: kriterial-chop.js (KCH, maket v5, 2026-11-13)

  /* ── hodisalar ── ctx: {ed, refresh()} */
  function bind(root, c, d, ctx) {
    const put = (si, nw) => putMark(c, si, d, nw), ref = () => { closePop(); ctx.refresh(); };
    const focus = () => { if (!st.f) return; const b = root.querySelector(`[data-krc="${st.f[0]}|${st.f[1]}"]`); if (b) b.focus({preventScroll: false}); };
    root.querySelectorAll("[data-krc]").forEach((b) => {
      b.onclick = () => { const [si, k] = b.dataset.krc.split("|").map(Number), v = marks(c.students[si], d)[k]; st.f = [si, k]; if (setCell(c, si, d, k, v == null ? "p" : v === "p" ? "m" : null, put)) { ref(); } };
      b.onkeydown = (e) => {
        const [si, k] = b.dataset.krc.split("|").map(Number), rows = [...root.querySelectorAll("[data-krr]")].filter((r) => r.style.display !== "none" && r.querySelector("[data-krc]")).map((r) => +r.dataset.krr), ri = rows.indexOf(si);
        const mv = (dr, dc) => { st.f = [rows[Math.max(0, Math.min(rows.length - 1, ri + dr))], Math.max(0, Math.min(N - 1, k + dc))]; };
        let ch = false;
        if (["+", "="].includes(e.key)) { ch = setCell(c, si, d, k, "p", put); mv(1, 0); }
        else if (["-", "_"].includes(e.key)) { ch = setCell(c, si, d, k, "m", put); mv(1, 0); }
        else if (e.key === "Delete" || e.key === "Backspace") { ch = setCell(c, si, d, k, null, put); st.f = [si, k]; }
        else if (e.key === "ArrowDown") mv(1, 0); else if (e.key === "ArrowUp") mv(-1, 0); else if (e.key === "ArrowRight") mv(0, 1); else if (e.key === "ArrowLeft") mv(0, -1);
        else return;
        e.preventDefault(); if (ch) ref(); else focus();
      };
    });
    root.querySelectorAll("[data-krset]").forEach((b) => b.onclick = () => { const [si, k, v] = b.dataset.krset.split("|"), cur = marks(c.students[+si], d)[+k]; if (setCell(c, +si, d, +k, cur === v ? null : v, put)) ref(); });
    root.querySelectorAll("[data-krcol]").forEach((th) => {
      const open = () => { if (!ctx.ed) return; const k = +th.dataset.krcol, cs = colStat(c, d, k);
        openPop(th, `<b>${code(k)} ${esc(descs(c)[k])}</b><small>+ ${cs.p} · − ${cs.m} · bo'sh ${cs.e}</small><button type="button" data-v="p"><i class="p">+</i>Bo'sh kataklarga +</button><button type="button" data-v="m"><i class="m">−</i>Bo'sh kataklarga −</button><button type="button" data-v="clr"><i>·</i>Ustunni tozalash</button>`,
          (p) => p.querySelectorAll("[data-v]").forEach((x) => x.onclick = () => { const n = fillCol(c, d, k, x.dataset.v, put); ref(); toast(x.dataset.v === "clr" ? `${code(k)}: tozalandi` : n ? `${code(k)}: ${n} o'quvchiga «${sym(x.dataset.v)}»` : "Bo'sh katak yo'q"); })); };
      th.onclick = open; th.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } };
    });
    root.querySelectorAll("[data-krrow]").forEach((b) => b.onclick = () => { const si = +b.dataset.krrow, s = c.students[si], i = info(s, d), ab = absent(s.marks[d]);
      const fill = ctx.ed && !ab ? `<button type="button" data-v="p"><i class="p">+</i>Bo'sh kataklarga +</button><button type="button" data-v="allp"><i class="p">+</i>Hammasiga + (10)</button><button type="button" data-v="clr"><i>·</i>Bahoni o'chirish</button>` : "";
      openPop(b, `<b>${si + 1}. ${esc(s.name)}</b><small>${ab ? "Darsda yo'q" : other(s, d) ? `Baho boshqa usulda: ${esc(gradesOf(s.marks[d] || "").join("/"))}` : i.full ? `Baho ${i.g} (${i.d} + ${i.u})` : "Baho hali to'liq emas"}</small>${fill}<button type="button" data-v="msg"><i>✉</i>Ota-onaga xabar</button>`,
        (p) => p.querySelectorAll("[data-v]").forEach((x) => x.onclick = () => { if (x.dataset.v === "msg") { closePop(); msgDlg(c, si, d); return; } if (fillRow(c, si, d, x.dataset.v, put)) ref(); else closePop(); })); });
    root.querySelectorAll("[data-krmsg]").forEach((b) => b.onclick = () => msgDlg(c, +b.dataset.krmsg, d));
    root.querySelectorAll("[data-kratt]").forEach((b) => b.onclick = () => { const si = +b.dataset.kratt; st.ao = st.ao === si ? null : si; ref(); });
    root.querySelectorAll("[data-krtab]").forEach((b) => b.onclick = () => { st.tab = b.dataset.krtab; ref(); });
    root.querySelectorAll("[data-krq]").forEach((b) => b.onclick = () => { st.q = +b.dataset.krq; ref(); });
    root.querySelectorAll("[data-krprof]").forEach((b) => { const open = () => profDlg(c, +b.dataset.krprof, st.q && qRange(st.q) ? st.q : quarterOf(d) || [1, 2, 3, 4].find((q) => qRange(q))); b.onclick = open; b.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); open(); } }; });
    root.querySelectorAll("[data-krqall]").forEach((b) => b.onclick = () => qAllDlg(c, +b.dataset.krqall));
    const chm = root.querySelector("[data-krchm]"); if (chm) chm.onclick = () => { if (!canEdit(d)) { putMark(c, 0, d, c.students[0].marks[d] || ""); return; } let n = 0; for (const si of liveOf(c, d)) { const s = c.students[si], i = info(s, d); if (i.any && !i.full && !other(s, d) && fillRow(c, si, d, "m", put)) n++; } st.flt = "all"; ref(); toast(n ? `${n} o'quvchining bo'sh kataklariga «−» qo'yildi` : "Chala o'quvchi yo'q"); };
    root.querySelectorAll("[data-krrowfill]").forEach((b) => b.onclick = () => { const [si, v] = b.dataset.krrowfill.split("|"); if (fillRow(c, +si, d, v, put)) ref(); });
    root.querySelectorAll("[data-krcolfill]").forEach((b) => b.onclick = () => { const [k, v] = b.dataset.krcolfill.split("|"); fillCol(c, d, +k, v, put); ref(); });
    const all = root.querySelector("[data-krall]"); if (all) all.onclick = () => { let n = 0; if (!canEdit(d)) { putMark(c, 0, d, c.students[0].marks[d] || ""); return; } for (let k = 0; k < N; k++) n += fillCol(c, d, k, "p", put); ref(); toast(n ? "Bo'sh kataklarga «+» qo'yildi" : "Bo'sh katak yo'q"); };
    root.querySelectorAll("[data-krflt]").forEach((b) => b.onclick = () => { st.flt = b.dataset.krflt; ref(); });
    root.querySelectorAll("[data-krv]").forEach((b) => b.onclick = () => { st.v = b.dataset.krv; ref(); });
    const L = () => liveOf(c, d);
    root.querySelectorAll("[data-krstu]").forEach((b) => b.onclick = () => { const l = L(); if (!l.length) return; const i = Math.max(0, l.indexOf(st.stu)); st.stu = l[(i + +b.dataset.krstu + l.length) % l.length]; ref(); });
    root.querySelectorAll("[data-krdes]").forEach((b) => b.onclick = () => { st.des = (st.des + +b.dataset.krdes + N) % N; ref(); });
    const ss = root.querySelector("[data-krstusel]"); if (ss) ss.onchange = () => { st.stu = +ss.value; ref(); };
    const ds = root.querySelector("[data-krdessel]"); if (ds) ds.onchange = () => { st.des = +ds.value; ref(); };
    focus();
  }
  // asboblar paneli tugmalari (sahifa bo'yicha bir marta)
  function bindTools(m, c, d, after) {
    const e = $("[data-kred]", m); if (e) e.onclick = () => editDlg(c, after);
    const p = $("[data-krpr]", m); if (p) p.onclick = () => KCH.dialog(c, d);
  }

  // tozalash: tashqi fayldan kelgan belgilar (cleanStudent) va deskriptor matnlari (cleanClass)
  function clean(s) {
    if (s.fk && typeof s.fk === "object" && !Array.isArray(s.fk)) {
      const o = {}; for (const [d, v] of Object.entries(s.fk)) if (/^\d{4}-\d{2}-\d{2}$/.test(d) && typeof v === "string" && /^[+.-]{9}$/.test(v) && /[+-]/.test(v)) o[d] = v;
      if (Object.keys(o).length) s.fk = o; else delete s.fk;
    } else delete s.fk;
  }
  function cleanCls(c) {
    if (Array.isArray(c.kd) && c.kd.length === N) c.kd = c.kd.map((t, k) => String(t == null ? "" : t).trim().slice(0, 60) || DEF[k]); else delete c.kd;
  }

  return {N, DEF, TPL, descs, other, absent, rowsOf, on, qData, parentDay, parentQ, marks, info, setCell, fillRow, fillCol, partial, view, side, tools, bind, bindTools, clean, cleanCls, closePop, state: st};
})();
