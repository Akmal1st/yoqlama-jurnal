/* «Bugun» — chorak tugagandan keyin. Tasdiqlangan maket v1 (Akmal, 2026-11-07: «Joriy et»),
   /mnt/project-files/bugun-tatil/bugun-tatil-maket.html. Uch payt:
   1. grace — chorak tugadi, hali arxivlanmagan: «N-chorakni yopish» kartasi (4 qadam, kunlar sanog'i, 4 ko'rsatkich) +
      «Sinflar bo'yicha tayyorlik» jadvali; «E'tibor» — chorak bahosi «2» chiqishi mumkin bo'lganlar (ball bilan).
   2. arx — ta'til, chorak arxivlangan: «Ta'til» kartasi (keyingi chorakkacha kunlar, birinchi kun darslari,
      «Yangi chorakka tayyorgarlik» ro'yxati); qulflangan chorakning ishlari bitta qatorda («Ochish»); «E'tibor» — «2» olganlar.
   3. new — yangi chorakning boshida: yopsa bo'ladigan «N-chorak natijasi» qatori (1 hafta), Sinflar ko'rsatkichida
      o'tgan chorak qiymatlari (2 hafta), «E'tibor»da o'tgan chorakda «2» olganlar (2 hafta).
   Hisob-kitob index.html dan (quarterResult, lessonGaps, analysisGaps, compareRows, ktrProgress) va arxiv.js dan (ARX).
   bugun.js dan oldin ulanadi; asosiy skriptdagi nomlar faqat chaqirilganda ishlatiladi. */
const BTL = (() => {
  const d5 = (s) => fmt(s).slice(0, 5);
  const days = (a, b) => Math.round((pdate(b) - pdate(a)) / 864e5);
  const NEW_STRIP = 7, NEW_PREV = 14;   // yangi chorakda: natija qatori — 7 kun, o'tgan chorak qiymatlari — 14 kun
  let tile = null;                       // «Chorakni yopish» kartasida bosilgan ko'rsatkich (jadval shu bo'yicha saralanadi)
  const real = () => D.classes.filter((c) => !isGrp(c) && c.students.length);
  const lastEnded = (t) => [4, 3, 2, 1].find((k) => { const r = qRange(k); return r && r[1] < t; }) || null;

  // qaysi payt: null — odatdagi «Bugun»
  function mode(t) {
    if (typeof ARX === "undefined" || !real().length) return null;
    const cq = quarterOf(t);
    if (cq) {
      const r = qRange(cq), p = cq > 1 ? qRange(cq - 1) : null, d = days(r[0], t);
      // o'tgan chorak arxivlangan bo'lsa — yangi chorak noldan boshlanadi: «1-chorak natijasi», «1-ch» qiymatlari va
      // «1-chorakda «2» olganlar» ko'rsatilmaydi (Akmal, 2026-11-08: «oldingi chorak ta'sir qilmasin»); u faqat arxivda
      return p && p[1] < r[0] && d < NEW_PREV && !ARX.entry(cq - 1) ? {k: "new", q: cq, pq: cq - 1, d} : null;
    }
    const q = lastEnded(t); if (!q) return null;
    const nr = q < 4 ? qRange(q + 1) : null, next = nr && nr[0] > t ? nr : null;
    if (ARX.entry(q)) return {k: "arx", q, next};
    return {k: "grace", q, next, due: ARX.pending() === q ? ARX.due(q) : null};
  }

  /* ───────── sarlavha ───────── */
  function title(M, t, tel) {
    if (M.k === "grace") return [`${longDate(t)} · ta'til`, tel ? `${M.q}-chorak tugadi` : `<em>${M.q}-chorak tugadi</em>`];
    if (M.k === "arx") {
      const n = M.next ? days(t, M.next[0]) : null;
      return [`${longDate(t)} · ta'til`, tel ? "Ta'til kunlari" : `<em>Ta'til${n ? ` · ${M.q + 1}-chorakgacha ${n} kun` : ""}</em>`];
    }
    return M.d === 0 ? [`${longDate(t)} · ${M.q}-chorak, 1-hafta`, tel ? `${M.q}-chorak boshlandi` : `<em>${M.q}-chorak boshlandi</em>`] : null;
  }

  /* ───────── chorak bahosi «2» (taxminiy) ───────── */
  // o'quvchining chorak natijasi 100 dan: to'liq bo'lsa — jami ball, aks holda qo'yilgan ballar + FB ÷ ularning maksimali
  function est(c, s, q, W) {
    const r = quarterResult(c, s, q, W);
    if (r.complete) return {sc: r.total, full: true};
    let g = 0, m = 0;
    for (const w of W) { const v = (s.scores || {})[w.id]; if (isNum(v)) { g += v; m += +w.max; } }
    if (r.n_fb) { g += Math.min(r.avg, FB_TOTAL); m += FB_TOTAL; }
    return {sc: m ? 100 * g / m : null, full: false};
  }
  // edge — chorak yopilmagan payt: taxminiy ball ham hisobga olinadi, «3» chegarasidagilar ham; aks holda faqat haqiqiy «2»
  function lowList(q, edge) {
    const out = [];
    D.classes.forEach((c, ci) => {
      if (isGrp(c)) return;
      const W = worksInQuarter(c, q);
      for (const s of c.students) {
        const f = (s.scores || {})[`final:q${q}`], {sc, full} = est(c, s, q, W);
        const two = isNum(f) ? f === 2 : (edge || full) && sc !== null && sc < 30;
        const near = edge && !two && !isNum(f) && sc !== null && sc < 35;
        if (two || near) out.push({ci, name: s.name, sc, two});
      }
    });
    return out.sort((a, b) => b.two - a.two || (a.sc ?? 0) - (b.sc ?? 0));
  }
  function lowBody(L, cap, right) {
    const N = 5;
    const rows = L.slice(0, N).map((r) => `<button class="bn-ri" data-stud="${r.ci}|${esc(r.name)}"><span class="bn-av">${esc(initials(r.name))}</span><span class="bn-tx"><b class="bn-ell">${esc(r.name)} <small>· ${esc(D.classes[r.ci].name)}</small></b><span class="bn-why"><span class="bn-chip ${r.two ? "bad" : "warn"}">${r.two ? "chorak bahosi «2»" : "«3» chegarasida"}</span></span></span><span class="bt-sc">${r.sc === null ? "—" : Math.round(r.sc)}<small>ball</small></span></button>`).join("");
    return `<div class="bt-g">${cap}<span>${right}</span></div><div class="bn-rl">${rows}</div>
      <div class="bn-more">${L.length > N ? `<span>va yana ${L.length - N} ta</span>` : "<span></span>"}<button class="bn-lnk" data-go2="reports">Hammasi →</button></div>`;
  }
  function lowCard(M) {
    const edge = M.k === "grace", L = lowList(edge ? M.q : M.k === "new" ? M.pq : M.q, edge);
    const body = L.length ? lowBody(L, edge ? "Chorak bahosi «2» chiqishi mumkin" : `${M.k === "new" ? M.pq : M.q}-chorakda «2» olganlar`, edge ? "ball / 100" : `${M.k === "new" ? M.q : M.q + 1}-chorakda e'tibor bering`)
      : `<div class="bn-okl" style="padding:4px 16px 14px">${edge ? "Chorak bahosi «2» chiqadigan o'quvchi yo'q. 👍" : `${M.q}-chorakda «2» olgan o'quvchi yo'q. 👍`}</div>`;
    return {n: L.length, body};
  }
  // yangi chorakda odatdagi «E'tibor» ro'yxati tepasida — o'tgan chorakda «2» olganlar
  function lowTop(M) {
    if (!M || M.k !== "new") return "";
    const L = lowList(M.pq, false); if (!L.length) return "";
    return lowBody(L, `${M.pq}-chorakda «2» olganlar`, "2 hafta turadi").replace(/<div class="bn-more">[\s\S]*$/, L.length > 5 ? `<div class="bn-more"><span>va yana ${L.length - 5} ta</span><span></span></div>` : "");
  }

  /* ───────── 1. Chorakni yopish ───────── */
  function readyRows(q) {
    const r = qRange(q), LG = lessonGaps(r[1], days(r[0], r[1]) + 1), AN = analysisGaps();
    return ARX.gaps(q).map((g) => {
      const n = g.c.students.length, an = AN.q === q ? AN.rows.find((x) => x.ci === g.ci) : null;
      const x = {...g, n, cb: n - g.noF, bsb: n - g.noS, gaps: LG.filter((y) => y.ci === g.ci).length, anl: an ? an.works.length : 0};
      x.done = x.cb >= n && x.bsb >= n && !x.gaps && !x.anl;
      return x;
    });
  }
  const pct = (a, b) => b ? Math.round(100 * a / b) : 100;
  const lvl = (a, b) => a >= b ? "ok" : a * 2 < b ? "bad" : "warn";
  const prog = (a, b) => `<span class="bt-pg ${lvl(a, b)}"><span>${a >= b ? "✓ hammasi" : `${a} <em>/ ${b}</em>`}</span><span class="bt-bar"><i style="width:${pct(a, b)}%"></i></span></span>`;
  function closeCard(M, R, tel) {
    const N = R.reduce((a, x) => a + x.n, 0), cb = R.reduce((a, x) => a + x.cb, 0), bsb = R.reduce((a, x) => a + x.bsb, 0);
    const gaps = R.reduce((a, x) => a + x.gaps, 0), anl = R.reduce((a, x) => a + x.anl, 0);
    const ready = N ? Math.round(100 * (cb + bsb) / (2 * N)) : 100, r = qRange(M.q), left = M.due ? days(todayIso(), M.due) : null;
    const T = [["cb", "Chorak baholari", cb, N], ["bsb", "BSB/CHSB ballari", bsb, N], ["gaps", "To'ldirilmagan dars", gaps, 0], ["anl", "Tahlil qilinmagan", anl, 0]];
    const tl = ([k, t, a, b]) => { const l = b ? lvl(a, b) : a ? "warn" : "ok";
      return `<button type="button" class="bt-tile ${l}${tile === k ? " on" : ""}" data-btlt="${k}" aria-pressed="${tile === k}"><small>${t}</small><b>${b ? `${a}<span> / ${b}</span>` : a || "✓"}</b>${b ? `<span class="bt-bar"><i style="width:${pct(a, b)}%"></i></span>` : `<small>${a ? (k === "gaps" ? "yo'qlama yoki mavzu yo'q" : "Summativ ish") : "hammasi bajarilgan"}</small>`}</button>`; };
    const nx = M.next || (M.q < 4 ? qRange(M.q + 1) : null);
    const st = (c, i, b, s) => `<div class="bt-st ${c}"><span class="bt-n">${c === "done" ? "✓" : i}</span><b>${b}</b><small>${s}</small></div>`;
    const why = M.due ? (tel ? `${d5(r[1])} da tugadi · ${d5(M.due)} da arxivlanadi` : `${M.q}-chorak ${d5(r[1])} da tugadi. ${d5(M.due)} kuni avtomatik arxivlanadi — shundan keyin baholar va yo'qlamani o'zgartirib bo'lmaydi.`)
      : `${M.q}-chorak ${d5(r[1])} da tugadi. Hali arxivlanmagan — baholar qulflanmagan.`;
    return `<section class="card bt-close"><div class="bt-top"><div class="bt-tt"><span class="bn-badge warn">🗓 CHORAK TUGADI</span><h2>${M.q}-chorakni yopish</h2><div class="bn-mut">${why}</div></div>
        ${left !== null ? `<div class="bt-cd"><b>${left}</b><small>kun qoldi</small></div>` : ""}</div>
      <div class="bt-steps">${st("done", 1, "Tugadi", d5(r[1]))}${st("cur", 2, "Yakunlash", `${ready}% tayyor`)}${st("", 3, "Arxiv", M.due ? d5(M.due) : "qo'lda")}${M.q < 4 ? st("", 4, `${M.q + 1}-chorak`, nx ? d5(nx[0]) : "—") : st("", 4, "Ta'til", "")}</div>
      <div class="bt-tiles">${T.map(tl).join("")}</div>
      <div class="bt-acts"><button class="btn btn-primary" data-axnow="${M.q}">🗄 Hozir arxivlash</button><button class="btn" data-baxrep="${M.q}">📊 ${tel ? "Hisobot" : "Chorak hisoboti (taxminiy)"}</button></div></section>`;
  }
  function readyCard(M, R, tel) {
    const k = tile, L = [...R];
    const sc = (x) => k === "cb" ? x.cb / x.n : k === "bsb" ? x.bsb / x.n : k === "gaps" ? -x.gaps : k === "anl" ? -x.anl : (x.cb + x.bsb) / (2 * x.n) - (x.gaps + x.anl) * .05;
    L.sort((a, b) => sc(a) - sc(b) || a.ci - b.ci);
    const left = L.filter((x) => !x.done).length;
    const btn = (x) => x.done ? `<span class="bn-chip ok">✓ Tayyor</span>` : `<button class="btn btn-sm btn-primary" data-axfix="${x.ci}|${M.q}" title="Shu sinfning chorak baholari sahifasi">Yakunlash</button>`;
    const chip = (v) => v ? `<span class="bn-chip warn">${v}</span>` : `<span class="bn-mut">—</span>`;
    const hd = `<div class="bn-ch"><h2>Sinflar bo'yicha tayyorlik</h2><span class="bn-cnt ${left ? "warn" : "ok"}">${left ? `${left} ta sinfda kamchilik` : "✓ Tayyor"}</span></div>`;
    if (tel) return `<section class="card bt-ready">${hd}${L.map((x) => `<div class="bt-cr"><div class="bt-l1"><b class="bn-ell">${esc(label(x.c))}</b><small class="bn-mut">${x.n} o'q.</small>${btn(x)}</div>
      <div class="bt-l2"><div><small>CHORAK BAHOSI</small>${prog(x.cb, x.n)}</div><div><small>BSB/CHSB</small>${prog(x.bsb, x.n)}</div></div>
      ${x.gaps || x.anl ? `<div class="bt-l3">${x.gaps ? `<span class="bn-chip warn">${x.gaps} dars to'ldirilmagan</span>` : ""}${x.anl ? `<span class="bn-chip warn">${x.anl} tahlil</span>` : ""}</div>` : ""}</div>`).join("")}</section>`;
    return `<section class="card bt-ready">${hd}<div class="bt-tw"><table class="bt-tbl"><thead><tr><th>Sinf</th><th>Chorak bahosi</th><th>BSB/CHSB ballari</th><th class="c">Darslar</th><th class="c">Tahlil</th><th></th></tr></thead><tbody>
      ${L.map((x) => `<tr class="${k && x.done ? "dim" : ""}"><td><b>${esc(label(x.c))}</b><small>${x.n} o'quvchi</small></td><td>${prog(x.cb, x.n)}</td><td>${prog(x.bsb, x.n)}</td><td class="c">${chip(x.gaps)}</td><td class="c">${chip(x.anl)}</td><td class="r">${btn(x)}</td></tr>`).join("")}</tbody></table></div>
      <div class="bt-note">Raqam: qo'yilganlar / jami o'quvchi. «Yakunlash» — shu sinfning chorak baholari sahifasini ochadi.</div></section>`;
  }

  /* ───────── 2. Ta'til ───────── */
  function prep(M) {
    const out = [], nq = M.q + 1, nr = M.q < 4 ? qRange(nq) : null;
    if (M.q < 4) out.push(nr ? ["ok", `${nq}-chorak sanalari`, `${d5(nr[0])} – ${d5(nr[1])} · ${Math.round(days(nr[0], nr[1]) / 7)} hafta`, ""]
      : ["warn", `${nq}-chorak sanalari`, "kiritilmagan — «Bugun» va jurnal sanalari shunga bog'liq", `<button class="btn btn-sm" data-days>Kiritish</button>`]);
    const cl = real(), nowd = cl.filter((c) => !c.weekdays || !c.weekdays.length);
    out.push(nowd.length ? ["warn", "Dars kunlari", `${nowd.length <= 2 ? nowd.map((c) => esc(label(c))).join(", ") : `${nowd.length} ta sinf`} — belgilanmagan`, `<button class="btn btn-sm" data-days>Belgilash</button>`]
      : ["ok", "Dars kunlari", `${cl.length} ta sinfda belgilangan`, ""]);
    if (M.q < 4) {
      const withPlan = cl.filter((c) => c.plan && (c.plan.topics || []).length), miss = withPlan.filter((c) => !c.plan.topics.some((x) => x.q === nq || x.q === null || x.q === undefined));
      if (!withPlan.length) out.push(["o", `KTR: ${nq}-chorak mavzulari`, "reja yuklanmagan — mavzular darsda o'zi taklif qilinadi", `<button class="btn btn-sm" data-ktr="${D.classes.indexOf(cl[0])}">Reja</button>`]);
      else if (miss.length) out.push(["warn", `KTR: ${nq}-chorak mavzulari`, `${miss.length <= 2 ? miss.map((c) => esc(label(c))).join(", ") : `${miss.length} ta sinf`} — mavzular yo'q`, `<button class="btn btn-sm" data-ktr="${D.classes.indexOf(miss[0])}">Reja</button>`]);
      else out.push(["ok", `KTR: ${nq}-chorak mavzulari`, `${withPlan.length} ta sinfda bor`, ""]);
    }
    const at = D.web.emk_at, ea = at ? Math.floor((Date.now() - new Date(at)) / 864e5) : null;
    out.push(ea !== null && ea <= 3 ? ["ok", "eMaktab'dan yangilash", ea ? `${ea} kun oldin yangilangan` : "bugun yangilangan", ""]
      : ["warn", "eMaktab'dan yangilash", ea === null ? "hali yangilanmagan" : `oxirgisi ${ea} kun oldin`, `<button class="btn btn-sm" data-ekgo>🔄 Yangilash</button>`]);
    // Hisobotlar → «Sinflarni solishtirish» (shu chorak) yoki arxivdagi «PDF → Telegram» yuborilganda belgilanadi (pdf-tg.js markQ)
    const sent = typeof PTG !== "undefined" ? PTG.sentQ(M.q) : null;
    out.push(sent ? ["ok", `${M.q}-chorak hisobotini yuborish`, `Telegram'ga yuborilgan · ${d5(sent)}`, ""]
      : ["o", `${M.q}-chorak hisobotini yuborish`, "hisobotni oching va «✈ Telegram» tugmasini bosing", `<button class="btn btn-sm" data-baxrep="${M.q}">✈ Ochish</button>`]);
    const a = backupAge(), tg = typeof tgAge === "function" ? tgAge() : null, b = [a, tg].filter((x) => x !== null), ba = b.length ? Math.min(...b) : null;
    out.push(ba !== null && ba <= 7 ? ["ok", "Zaxira nusxa", ba ? `${ba} kun oldin olingan` : "bugun olingan", ""] : ["warn", "Zaxira nusxa", ba === null ? "hali olinmagan" : `oxirgisi ${ba} kun oldin`, `<button class="btn btn-sm" data-backup2>💾 Saqlash</button>`]);
    return out;
  }
  function vacCard(M, tel) {
    const t = todayIso(), n = M.next ? days(t, M.next[0]) : null, d0 = M.next ? M.next[0] : null;
    let first = [];
    if (d0) {
      const sc = schedToday(d0);
      first = D.classes.map((c, ci) => ({c, ci})).filter(({c}) => !isGrp(c) && c.dates.includes(d0) && !isNoLesson(c, d0))
        .map((x) => ({...x, s: sc.find((y) => y.ci === x.ci)})).sort((a, b) => (a.s ? a.s.no : 99) - (b.s ? b.s.no : 99));
    }
    const P = prep(M), ok = P.filter((p) => p[0] === "ok").length;
    const cal = d0 ? `<div class="bt-cal"><div class="bt-m">${MONTHS[+d0.slice(5, 7) - 1]}</div><b>${d0.slice(8)}</b><small>${longDate(d0).split(",")[0]}</small></div>`
      : `<div class="bt-cal"><div class="bt-m">Ta'til</div><b>☀</b><small>${M.q === 4 ? "yozgi" : "sanasi yo'q"}</small></div>`;
    const h = M.q === 4 ? "Yozgi ta'til" : n ? `${M.q + 1}-chorak ${n === 1 ? "ertaga" : `${n} kundan keyin`} boshlanadi` : `${M.q + 1}-chorak sanalari kiritilmagan`;
    const sub = d0 ? (first.length ? (tel ? `${d5(d0)} · birinchi kun ${first.length} ta dars` : `${longDate(d0)}. Birinchi kungi darslaringiz:`) : (tel ? d5(d0) : `${longDate(d0)}.`)) : "Sozlamalar → Dars kunlari va choraklar bo'limida kiriting.";
    const txt = `<span class="bn-badge bt-vb">☀ TA'TIL</span><h2>${h}</h2><div class="bn-mut">${sub}</div>`;
    const fl = first.length ? `<div class="bt-first">${first.map((x) => `<span>${x.s && x.s.from ? `<small>${x.s.from}</small>` : ""}${esc(label(x.c))}</span>`).join("")}</div>` : "";
    return `<section class="card bt-vac">${tel ? `<div class="bt-crow">${cal}<div>${txt}</div></div>` : cal}<div class="bt-vb2">${tel ? "" : txt}${fl}
      <div class="bt-prep"><div class="bt-ph"><b>📋 ${M.q === 4 ? "Yangi o'quv yiliga tayyorgarlik" : "Yangi chorakka tayyorgarlik"}</b><span class="bn-cnt ${ok === P.length ? "" : "warn"}">${ok} / ${P.length}</span></div>
        ${P.map(([s, a, b, btn]) => `<div class="bt-pi p-${s}"><span class="bt-ic p-${s}">${s === "ok" ? "✓" : s === "warn" ? "!" : "○"}</span><span class="bt-tx"><b>${a}</b><small>${b}</small></span>${btn}</div>`).join("")}</div></div></section>`;
  }
  // qulflangan chorakdagi ishlar: «Bajarish kerak»dan olinadi, bitta qatorga yig'iladi
  function lockedInfo(M) {
    if (!ARX.lockedQ(M.q)) return null;
    const r = qRange(M.q), g = lessonGaps(r[1], days(r[0], r[1]) + 1).length, AN = analysisGaps(), a = AN.q === M.q ? AN.rows.reduce((s, x) => s + x.works.length, 0) : 0;
    return g || a ? {g, a} : null;
  }
  function filterTodo(T, M) {
    if (!M || M.k !== "arx") return T;
    const gaps = T.gaps.filter((x) => !ARX.dateLocked(x.d, x.c) && quarterOf(x.d)),   // ta'til kunidagi (hech qaysi chorakka kirmagan) darslar ham chiqmaydi
      an = ARX.lockedQ(T.an.q) ? {q: T.an.q, rows: []} : T.an;
    return {...T, gaps, an, lk: lockedInfo(M), n: gaps.length + an.rows.length + T.qrows.length + T.ktr.length};
  }
  const lockedRow = (M, lk) => lk ? `<div class="bt-lock"><span class="bt-li">🔒</span><span class="bt-tx"><b>${M.q}-chorakdan qolgan: ${[lk.g ? `${lk.g} ta dars` : "", lk.a ? `${lk.a} ta tahlil` : ""].filter(Boolean).join(", ")}</b><small>Chorak arxivlangan — o'zgartirish uchun vaqtincha oching.</small></span><button class="btn btn-sm" data-axopen="${M.q}">🔓 Ochish</button></div>` : "";

  /* ───────── 3. Yangi chorak ───────── */
  function strip(M, tel) {
    if (!M || M.k !== "new" || M.d >= NEW_STRIP) return "";
    const r = qRange(M.pq), k = `${r[0]}|${r[1]}`; if (D.web.btl_x === k) return "";
    const X = BAX.data(M.pq), pc = (v) => v === null || v === undefined ? "—" : Math.round(v) + "%";
    return `<section class="card bt-strip">${ARX.entry(M.pq) ? "🔒" : "🗓"}<div class="bt-sk"><b>${M.pq}-chorak natijasi</b><span>O'zlashtirish <b>${pc(X.qu)}</b></span><span>Davomat <b>${pc(X.att)}</b></span>${tel ? "" : `<span>Sifat <b>${pc(X.sq)}</b></span>`}<span>«2»: <b class="${X.by[3] ? "bt-bad" : ""}">${X.by[3]}</b></span></div>
      <button class="btn btn-sm" data-baxrep="${M.pq}">${tel ? "Ko'rish" : "Chorak hisoboti"}</button><button class="bn-x" data-btlx="${k}" title="Yopish" aria-label="Yopish">✕</button></section>`;
  }
  // Sinflar ko'rsatkichi: har sinf uchun o'tgan chorak qiymati (sinf obyekti → {att, qu, avg})
  function prev(M) {
    if (!M || M.k !== "new") return null;
    const [lo, hi] = qRange(M.pq), m = new Map();
    for (const r of compareRows(lo, hi, M.pq)) if (r.n) m.set(r.c, {att: r.att, qu: r.qu ?? r.qp, avg: r.avg});
    return {q: M.pq, m};
  }
  const was = (P, c, k) => { if (!P) return ""; const v = (P.m.get(c) || {})[k]; return `<small class="bt-was">${P.q}-ch: ${v === null || v === undefined ? "—" : k === "avg" ? v.toFixed(2) : Math.round(v) + "%"}</small>`; };

  function bind(m) {
    m.querySelectorAll("[data-btlt]").forEach((b) => b.onclick = () => { tile = tile === b.dataset.btlt ? null : b.dataset.btlt; render(); });
    m.querySelectorAll("[data-btlx]").forEach((b) => b.onclick = () => { D.web.btl_x = b.dataset.btlx; save(); render(); });
  }
  return {mode, title, lowCard, lowTop, readyRows, closeCard, readyCard, vacCard, filterTodo, lockedRow, strip, prev, was, bind};
})();
