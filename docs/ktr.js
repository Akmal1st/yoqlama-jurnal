/* Kalendar-tematik reja (KTR) sahifasi — tasdiqlangan maket v4, 2026-11-12.
   Ma'lumot: c.plan = {on, start, topics: [{t, h, q, hw}]}; hw — uy vazifasi, ko'p soatli mavzuda har dars uchun «a ; b».
   Mavzular dars kunlariga index.html dagi reflowPlan bilan taqsimlanadi (c.lessons[d] = {topic, hw, auto, si, ah});
   bu sahifa faqat rejani ko'rsatadi va o'zgartiradi. Bo'limlar: Reja (chorak kartalari, ogohlantirishlar, mavzular),
   Matn (eski matn ko'rinishi), Chop etish (A4 hujjat → chop etish / PDF / Telegram). Excel — «ish reja» shakli
   (Darslar tartibi · Mavzu nomi · Uyga vazifa, har dars alohida qator, har chorak alohida fayl). Hamma narsa .kt-* sinflarida. */
const KTR = (() => {
  const st = {ci: -1, tab: "plan", qf: 0, flt: "all", find: "", closed: new Set(), pq: 0, pcol: {done: true, hw: true, izoh: false}};
  const I = (n, c = "") => `<i class="bi bi-${n}${c ? " " + c : ""}" aria-hidden="true"></i>`;
  const MS = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];
  const WDL = ["dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba", "yakshanba"];
  const fD = (d) => `${+d.slice(8)}-${MS[+d.slice(5, 7) - 1]}`;
  const fL = (d) => `${+d.slice(8)}-${MONTHS_GEN[+d.slice(5, 7) - 1]}, ${WDL[pyWd(d)]}`;
  const dm = (d) => `${d.slice(8)}.${d.slice(5, 7)}`;
  const kind = (t) => { const w = workOfTopic(t); return w && (w[0] === "bsb" || w[0] === "chsb") ? w[0] : null; };
  const noHwOk = (t) => !!kind(t) || /^(takrorlash|mustaqil ish|yakuniy)/i.test(String(t).trim());
  const hwParts = (x) => String(x.hw || "").split(";").map((s) => s.trim());
  const hwShow = (x) => { const p = hwParts(x); return p.length > 1 ? p.map((v, i) => `${i + 1}-dars: ${v || "—"}`).join(" · ") : String(x.hw || "").trim(); };
  const ROMAN_Q = ["", "I", "II", "III", "IV"];
  const ABS = ["s", "dq", "k", "ch", "ox"];   // ch — chet elda: «kelganlar» soniga kirmaydi
  const cls = () => D.classes[S.ci];
  const subj = (c) => c.subject || "Fan";

  /* ───────── hisob ───────── */
  function model(c) {
    const plan = c.plan || {on: false, topics: []}, T = plan.topics || [], t = todayIso(), on = !!plan.on;
    const slots = planSlots(plan), sd = {};
    if (on) for (const [d, l] of Object.entries(c.lessons)) if (l && l.auto && l.si !== undefined && slots[l.si] && slots[l.si].text === l.topic) sd[l.si] = d;
    const rows = T.map((x, i) => ({x, i, q: x.q || 0, dd: []}));
    slots.forEach((s, si) => rows[s.i].dd.push(sd[si] || null));
    const hasQ = T.some((x) => x.q), held = c.dates.filter((d) => !isNoLesson(c, d)).sort();
    const lo = ISO_D.test(String(plan.start)) ? plan.start : t;
    const used = new Set(Object.values(sd));
    const Q = {}, keys = hasQ ? [1, 2, 3, 4, ...(rows.some((r) => !r.q) ? [0] : [])] : [0];
    for (const q of keys) {
      const rg = q ? qRange(q) : null, rs = rows.filter((r) => r.q === q);
      const ds = held.filter((d) => !rg || (rg[0] <= d && d <= rg[1]));
      const hrs = rs.reduce((a, r) => a + r.dd.length, 0), done = rs.reduce((a, r) => a + r.dd.filter((d) => d && d <= t).length, 0);
      const lack = on ? rs.reduce((a, r) => a + r.dd.filter((d) => !d).length, 0) : 0;
      const spare = on && hrs && (!q || rg) ? ds.filter((d) => d >= lo && !used.has(d) && !((c.lessons[d] || {}).topic)).length : 0;
      const off = c.extra_x.filter((d) => (!rg || (rg[0] <= d && d <= rg[1])) && d >= lo).sort();
      Q[q] = {q, rg, rows: rs, ds, hrs, done, lack, spare, off};
    }
    let n = 0; rows.forEach((r) => { r.n = ++n; });
    const total = slots.length, doneH = rows.reduce((a, r) => a + r.dd.filter((d) => d && d <= t).length, 0);
    return {plan, T, rows, Q, keys, hasQ, on, t, total, doneH, held, lo};
  }
  function stOf(M, r) {
    if (!M.on) return ["f", "clock", "Taqsimlanmagan"];
    const d = r.dd;
    if (d.some((x) => !x)) return ["x", "x-lg", "Kun yetmaydi"];
    if (d.includes(M.t)) return ["t", "play-fill", "Bugun"];
    const p = d.filter((x) => x < M.t).length;
    if (p === d.length) return ["d", "check-lg", "O'tildi"];
    if (p) return ["o", "clock", `${p}/${d.length} o'tildi`];
    return ["f", "clock", "Rejada"];
  }
  const present = (c, d) => c.students.filter((s) => !ABS.includes(attPart(s.marks[d] || ""))).length;
  const hasAtt = (c, d) => c.att_ok.includes(d) || c.students.some((s) => s.marks[d]);
  function weekDays(c) {
    const t = todayIso(), q = quarterOf(t), rg = q ? qRange(q) : null;
    const ds = c.dates.filter((d) => !isNoLesson(c, d) && (!rg || (rg[0] <= d && d <= rg[1])));
    const wd = [...new Set(ds.map(pyWd))].sort();
    if (!wd.length) return "";
    // haftasiga necha soat: eng ko'p dars bo'lgan haftadagi darslar
    const wk = {}; ds.forEach((d) => { const m = iso(addDays(pdate(d), -pyWd(d))); wk[m] = (wk[m] || 0) + 1; });
    return `${wd.map((i) => WD[i]).join(", ")} · haftasiga ${Math.max(...Object.values(wk))} soat`;
  }

  /* ───────── sahifa ───────── */
  function donut(p, sz) {
    const r = sz / 2 - 5, cc = 2 * Math.PI * r;
    return `<svg width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}" aria-hidden="true"><circle cx="${sz / 2}" cy="${sz / 2}" r="${r}" fill="none" stroke="var(--kt-soft)" stroke-width="6"/><circle cx="${sz / 2}" cy="${sz / 2}" r="${r}" fill="none" stroke="var(--acc)" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(cc * p).toFixed(1)} ${cc.toFixed(1)}" transform="rotate(-90 ${sz / 2} ${sz / 2})"/></svg>`;
  }
  function page(m) {
    const c = cls();
    if (st.ci !== S.ci) { st.ci = S.ci; st.qf = 0; st.find = ""; st.flt = "all"; const cq = quarterOf(todayIso()) || 0; st.closed = new Set([1, 2, 3, 4].filter((q) => cq && q < cq)); st.pq = 0; }
    const M = model(c), t = M.t, k = ktrProgress(c);
    const tr = M.rows.find((r) => r.dd.includes(t)), tl = c.lessons[t] || {};
    const nx = M.rows.find((r) => r !== tr && r.dd.some((d) => d && d > t)), nd = nx && nx.dd.find((d) => d && d > t);
    const isDay = c.dates.includes(t) && !isNoLesson(c, t);
    const todayT = tr ? tr.x.t : tl.topic || "", todayHw = tr ? ktrHw(tr.x, tr.dd.indexOf(t)) || tl.hw : tl.hw;
    const pct = M.total ? M.doneH / M.total : 0, wd = weekDays(c);
    const body = !M.T.length && st.tab === "plan" ? emptyView() : st.tab === "txt" ? txtView(M) : st.tab === "print" ? printView(c, M) : planView(c, M);
    m.innerHTML = `<div class="kt" data-ktpage>
      <header class="kt-hd"><button class="kt-ib" data-k="back" aria-label="Jurnalga qaytish" title="Jurnalga qaytish">${I("chevron-left")}</button>
        <div class="kt-ht"><div class="kt-eb">${I("journal-text")}Kalendar-tematik reja</div><h1>${esc(label(c))}</h1>
          <div class="kt-meta">${wd ? `<span>${I("calendar2-week")}${wd}</span>` : ""}<span>${I("clock")}jami ${M.total} soat</span><span>${I("people")}${c.students.length} o'quvchi</span>${k && k.behind >= 2 ? `<span class="kt-w">${I("exclamation-triangle")}${k.behind} soat orqada</span>` : ""}</div></div>
        <div class="kt-acts"><button class="kt-btn" data-k="imp" title="Excel, matn yoki boshqa sinfdan yuklash">${I("upload")}<span>Yuklash</span></button><button class="kt-btn" data-k="set" title="Boshlanish sanasi va taqsimlash">${I("sliders")}<span>Sozlash</span></button><button class="kt-btn pri" data-k="exp" title="Chop etish, PDF, Excel, Telegram">${I("download")}<span>Eksport</span></button></div></header>
      <section class="kt-hero" aria-label="Bugungi dars">
        <div class="kt-dn"><small>${WD[pyWd(t)]}</small><b>${+t.slice(8)}</b><small>${MS[+t.slice(5, 7) - 1]}</small></div>
        <div class="kt-hx"><span class="kt-eb">${isDay ? "Bugungi dars" : "Bugun dars yo'q"}${tr && tr.dd.length > 1 ? ` · ${tr.dd.indexOf(t) + 1}/${tr.dd.length}-soat` : ""}</span>
          <b class="kt-htp">${todayT ? esc(todayT) : isDay ? "Mavzu belgilanmagan" : nx ? "Keyingi dars pastda" : "—"}</b>
          <div class="kt-hl">${isDay && todayT ? `<span>${I("house-door")}${todayHw ? esc(todayHw) : tr ? `<button class="kt-lnk" data-k="hwed" data-i="${tr.i}">uy vazifasi qo'shish</button>` : "uy vazifasi yo'q"}</span>` : ""}${nx ? `<span class="kt-mu">${I("arrow-right")}${fD(nd)}: ${esc(nx.x.t)}</span>` : ""}</div></div>
        <div class="kt-dnut" title="Reja bajarilishi">${donut(pct, 72)}<span><b>${Math.round(pct * 100)}%</b><small>${M.doneH}/${M.total} soat</small></span></div>
      </section>
      <nav class="kt-tabs" aria-label="Bo'limlar">${[["plan", "list-ul", "Reja"], ["txt", "card-text", "Matn"], ["print", "printer", "Chop etish"]].map(([x, ic, l]) => `<button data-k="tab" data-v="${x}" class="${st.tab === x ? "on" : ""}" aria-current="${st.tab === x}">${I(ic)}${l}</button>`).join("")}</nav>
      ${body}</div>`;
    if (st.tab === "print") setTimeout(fitPapers, 0);
  }
  function emptyView() {
    return `<div class="kt-card kt-empty">${I("journal-bookmark", "kt-ei")}<b>Reja hali yo'q</b><span>Excel fayldan (shu jumladan «Darslar tartibi · Mavzu nomi · Uyga vazifa» shaklidagi ish rejadan), matndan yoki boshqa sinfdan yuklang.</span>
      <div class="kt-row"><button class="kt-btn pri" data-k="ximp">${I("file-earmark-arrow-up")}Excel fayldan</button><button class="kt-btn" data-k="tab" data-v="txt">${I("pencil-square")}Matn sifatida yozish</button>${others(cls()).length ? `<button class="kt-btn" data-k="imp">${I("copy")}Boshqa sinfdan</button>` : ""}</div></div>`;
  }
  function qCards(M) {
    if (!M.hasQ) return "";
    return `<div class="kt-pg">${[1, 2, 3, 4].map((q) => {
      const r = M.Q[q]; if (!r.rg) return `<div class="kt-qc dis"><span class="t">${q}-chorak</span><small>Sanalari belgilanmagan</small></div>`;
      const pct = r.hrs ? r.done / r.hrs * 100 : 0, [a, b] = r.rg, t = M.t, cur = a <= t && t <= b;
      const pass = t < a ? 0 : t > b ? 100 : r.ds.filter((x) => x <= t).length / Math.max(1, r.ds.length) * 100;
      const [ic, cl, note] = !r.hrs ? ["dash-circle", "i", "Mavzu yo'q"] : r.lack ? ["exclamation-triangle", "w", `${r.lack} soatga kun yetmaydi`] : r.spare ? ["info-circle", "i", `${r.spare} ta dars kuni bo'sh`] : ["check-circle-fill", "ok", M.on ? "Kunlar yetarli" : `${r.ds.length} ta dars kuni`];
      return `<button class="kt-qc ${st.qf === q ? "on" : ""}" data-k="qf" data-v="${q}" aria-pressed="${st.qf === q}"><span class="t">${q}-chorak${cur ? "<em>joriy</em>" : ""}<span class="kt-sp"></span>${I(ic, "kt-" + cl)}</span><span class="num"><b>${r.done}</b> / ${r.hrs} soat</span><span class="br"><i style="width:${pct.toFixed(1)}%"></i>${pass > 0 && pass < 100 ? `<u style="left:${pass.toFixed(1)}%" title="Bugungi kun"></u>` : ""}</span><small class="kt-${cl}">${note}</small></button>`;
    }).join("")}</div>`;
  }
  function warns(c, M) {
    if (!M.on) return M.T.length ? `<div class="kt-warn inf">${I("info-circle", "wi")}<div class="kt-wx"><div><b>Mavzular dars kunlariga taqsimlanmagan.</b> Yoqilsa, har mavzu o'z dars kuniga yoziladi, uy vazifasi ham shu kunga o'tadi.</div><div class="kt-sg"><button class="kt-btn sm pri" data-k="onauto">${I("check-lg")}Taqsimlashni yoqish</button></div></div></div>` : "";
    return M.keys.filter((q) => M.Q[q].lack || (M.Q[q].spare >= 3 && M.Q[q].hrs)).map((q) => {
      const r = M.Q[q], nm = q ? `${q}-chorak` : "Reja";
      if (r.lack) {
        const two = r.rows.filter((x) => x.dd.length > 1 && !x.dd.some((d) => d && d <= M.t)).slice(-3);
        const offs = r.off.filter((d) => [...c.dates].includes(d));
        return `<div class="kt-warn">${I("exclamation-triangle", "wi")}<div class="kt-wx"><div><b>${nm}: ${r.hrs} soatlik mavzu, ${r.hrs - r.lack + r.spare} ta dars kuni.</b> Oxirgi ${r.lack} soatga kun yetmaydi${offs.length ? ` (dars bo'lmagan kunlar: ${offs.slice(0, 3).map(fD).join(", ")}${offs.length > 3 ? "…" : ""})` : ""}.</div>
          ${two.length || offs.length ? `<div class="kt-sg"><span class="kt-mu kt-sm">Bir bosishda tuzatish:</span>${two.map((x) => `<button class="kt-btn sm" data-k="minus" data-i="${x.i}" title="${esc(x.x.t)}: ${x.x.h} → ${x.x.h - 1} soat">${I("dash-lg")}1 soat · ${esc(x.x.t.length > 26 ? x.x.t.slice(0, 25) + "…" : x.x.t)}</button>`).join("")}${offs.length ? `<button class="kt-btn sm" data-k="unoff" data-v="${offs[0]}">${I("arrow-counterclockwise")}${fD(offs[0])} ni dars kuni qilish</button>` : ""}</div>` : ""}</div></div>`;
      }
      return `<div class="kt-warn inf">${I("info-circle", "wi")}<div class="kt-wx"><div><b>${nm}: ${r.spare} ta dars kuniga mavzu yo'q.</b> Chorak oxiridagi darslar bo'sh qoladi.</div><div class="kt-sg"><button class="kt-btn sm" data-k="addrev" data-v="${q}">${I("plus-lg")}Takrorlash darsi qo'shish</button></div></div></div>`;
    }).join("");
  }
  function rowHtml(c, M, r) {
    const [sc, si, sl] = stOf(M, r), x = r.x, kd = kind(x.t), t = M.t, now = r.dd.includes(t);
    const dates = M.on ? r.dd.map((d) => d ? `<button class="kt-dc ${d === t ? "td" : d < t ? "ps" : ""}" data-k="dpop" data-v="${d}" title="${fL(d)}">${fD(d)}</button>` : `<span class="kt-dc none">—</span>`).join("") : `<span class="kt-mu">—</span>`;
    const kel = r.dd.filter((d) => d && d <= t && hasAtt(c, d)).map((d) => `${present(c, d)}/${c.students.length}`);
    const hw = hwShow(x);
    return `<div class="kt-tr ${sc === "d" ? "done" : ""} ${now ? "now" : ""} ${sc === "x" ? "left" : ""}" data-kti="${r.i}"><span class="n">${r.n}</span>
      <span class="mt"><span class="tl">${esc(x.t)}${kd ? `<span class="kt-tag ${kd === "chsb" ? "ch" : ""}">${kd.toUpperCase()}</span>` : ""}</span>${hw ? `<button class="kt-hwl" data-k="hwed" data-i="${r.i}" title="Uy vazifasini o'zgartirish">${I("house-door")}<span>${esc(hw)}</span></button>` : noHwOk(x.t) ? "" : `<button class="kt-hwl add" data-k="hwed" data-i="${r.i}">${I("plus-lg")}<span>Uy vazifasi</span></button>`}${kel.length ? `<small class="kt-kel">${I("people")}${kel.join(" · ")}</small>` : ""}</span>
      <span class="meta"><span class="kt-h" role="group" aria-label="Soat"><button data-k="hm" data-i="${r.i}" aria-label="Soatni kamaytirish" ${x.h <= 1 ? "disabled" : ""}>${I("dash-lg")}</button><span>${x.h || 1}</span><button data-k="hp" data-i="${r.i}" aria-label="Soatni oshirish">${I("plus-lg")}</button></span><span class="kt-dt">${dates}</span><span class="kt-st ${sc}">${I(si)}${sl}</span></span>
      <button class="kt-mb" data-k="rmenu" data-i="${r.i}" aria-label="Mavzu menyusi">${I("three-dots")}</button></div>`;
  }
  function planView(c, M) {
    const f = st.find.trim().toLowerCase(), keys = st.qf && M.hasQ ? [st.qf] : M.keys;
    const nohw = M.rows.filter((r) => !r.x.hw && !noHwOk(r.x.t)).length;
    const sec = keys.map((q) => {
      const r = M.Q[q]; if (!r) return "";
      const rows = r.rows.filter((x) => { const s = stOf(M, x)[0]; return (st.flt === "all" || (st.flt === "nohw" ? !x.x.hw && !noHwOk(x.x.t) : st.flt === "left" ? s !== "d" : s === "d")) && (!f || x.x.t.toLowerCase().includes(f) || String(x.x.hw || "").toLowerCase().includes(f)); });
      const cl = st.closed.has(q) && !st.qf && !f && st.flt === "all";
      const head = `<button class="kt-qh ${cl ? "cl" : ""}" data-k="tog" data-v="${q}" aria-expanded="${!cl}">${I("chevron-down", "cv")}<b>${q ? `${q}-chorak` : M.hasQ ? "Choraksiz" : "Mavzular"}</b>${r.rg ? `<small>${fD(r.rg[0])} – ${fD(r.rg[1])} · ${r.ds.length} ta dars kuni</small>` : ""}<span class="kt-sp"></span><span class="qn">${r.done}/${r.hrs} soat</span>${r.lack ? `<span class="kt-st x">${I("exclamation-triangle")}−${r.lack}</span>` : r.spare && r.hrs ? `<span class="kt-st f">+${r.spare} bo'sh</span>` : r.hrs && M.on ? `<span class="kt-st d">${I("check-lg")}</span>` : ""}</button>`;
      if (cl) return `<section class="kt-qs">${head}</section>`;
      // shu chorakdagi dars bo'lmagan kunlar (bayram yoki o'qituvchi belgilagan)
      const offs = M.on ? r.off.filter((d) => c.dates.includes(d)) : [];
      const items = rows.map((x) => rowHtml(c, M, x));
      if (!st.find && st.flt === "all") offs.forEach((d) => { const at = r.rows.findIndex((x) => x.dd.some((y) => y && y > d)); const html = `<div class="kt-off">${I("calendar-x")}<span>${fL(d)} — dars bo'lmadi, mavzular surildi</span><button class="kt-btn sm" data-k="unoff" data-v="${d}">${I("arrow-counterclockwise")}Dars kuni qilish</button></div>`; const pos = at < 0 ? items.length : items.findIndex((h0) => h0.includes(`data-kti="${r.rows[at].i}"`)); items.splice(pos < 0 ? items.length : pos, 0, html); });
      return `<section class="kt-qs">${head}<div class="kt-tr th"><span>№</span><span>Dars mavzusi va uy vazifasi</span><span>Soat</span><span>Sana</span><span>Holat</span><span></span></div>${items.join("") || `<div class="kt-emp">${I("search")}Mos mavzu yo'q</div>`}${!f && st.flt === "all" ? `<div class="kt-addr"><button data-k="add" data-v="${q}">${I("plus-lg")}${q ? `${q}-chorakka ` : ""}mavzu qo'shish</button></div>` : ""}</section>`;
    }).join("");
    return `${qCards(M)}${warns(c, M)}
      <div class="kt-tb"><div class="kt-seg">${[["all", "Hammasi"], ["left", "Qolganlari"], ["done", "O'tilganlar"]].map(([x, l]) => `<button data-k="flt" data-v="${x}" class="${st.flt === x ? "on" : ""}">${l}</button>`).join("")}</div>${nohw || st.flt === "nohw" ? `<button class="kt-chip ${st.flt === "nohw" ? "on" : ""}" data-k="flt" data-v="${st.flt === "nohw" ? "all" : "nohw"}">${I("house-door")}Uy vazifasi yo'q: ${nohw}</button>` : ""}
        <label class="kt-sw">${I("search")}<input id="kt-find" type="search" placeholder="Mavzu qidirish" value="${esc(st.find)}" autocomplete="off"></label></div>
      <div class="kt-kl">${sec}</div>
      <p class="kt-hint">${I("info-circle")}<span>Uy vazifasi mavzu o'tiladigan kunning «Uy vazifasi» maydoniga o'zi yoziladi. Sanani bossangiz, «Dars bo'lmadi» deb belgilash mumkin — keyingi mavzular o'zi suriladi. «BSB» yoki «CHSB» bilan boshlangan mavzu kuniga summativ ish o'zi ochiladi.</span></p>`;
  }
  function txtView(M) {
    return `<div class="kt-card kt-txt"><div class="kt-mu kt-sm">Har qatorda bitta mavzu. Chorak sarlavhasi: <code>== 2-chorak</code>. Bir necha soatlik mavzu: <code>Kasrlar | 3</code>. Uy vazifasi bilan: <code>Kasrlar | 2 | §12, 45-mashq ; §12, 50-mashq</code> (har dars uchun «;» bilan).</div>
      <textarea id="kt-txt" class="kt-code" spellcheck="false" placeholder="== 1-chorak&#10;Natural sonlar | 2 | §1, 1–4-mashqlar ; §1, 5–8-mashqlar&#10;BSB №1 (25 ball)">${esc(planToText(M.plan))}</textarea>
      <div class="kt-row"><span class="kt-mu kt-sm" id="kt-tinfo">${M.T.length} ta mavzu · ${M.total} soat</span><span class="kt-sp"></span><button class="kt-btn pri" data-k="applytxt">${I("check-lg")}Rejaga qo'llash</button></div></div>`;
  }

  /* ───────── chop etish: A4 hujjat (.bx-pg — PTG.pagesPdf va bx-print bilan bir xil) ───────── */
  function docRows(c, M) {
    const qs = st.pq && M.hasQ ? [st.pq] : M.keys, t = M.t, P = st.pcol, out = [];
    for (const q of qs) {
      const r = M.Q[q]; if (!r || !r.rows.length) continue;
      if (M.hasQ) out.push(`<tr class="q"><td colspan="${ncol()}">${q ? `${ROMAN_Q[q]} chorak · ${r.hrs} soat` : "Choraksiz"}</td></tr>`);
      for (const x of r.rows) {
        const kd = kind(x.x.t), dd = x.dd;
        out.push(`<tr><td class="c">${x.n}</td><td${kd ? ' class="b"' : ""}>${esc(x.x.t)}</td><td class="c">${x.x.h || 1}</td><td class="c">${M.on ? dd.map((d) => d ? dm(d) : "—").join("<br>") : ""}</td>${P.done ? `<td class="c">${dd.filter((d) => d && d <= t).map(dm).join("<br>")}</td>` : ""}${P.hw ? `<td class="s">${dd.map((_, i) => esc(ktrHw(x.x, i))).join("<br>")}</td>` : ""}${P.izoh ? `<td class="s">${kd ? "Summativ ish" : ""}</td>` : ""}</tr>`);
      }
    }
    return out;
  }
  const ncol = () => 4 + (st.pcol.done ? 1 : 0) + (st.pcol.hw ? 1 : 0) + (st.pcol.izoh ? 1 : 0);
  function docPages(c, M) {
    const P = st.pcol, y = todayIso().slice(0, 4), qn = st.pq && M.hasQ ? M.Q[st.pq] : null;
    const tot = qn ? qn.hrs : M.total, sy = +todayIso().slice(5, 7) >= 8 ? +y : +y - 1, per = weekDays(c).split(" · ")[1] || "";
    const cols = `<colgroup><col style="width:9mm"><col><col style="width:11mm"><col style="width:17mm">${P.done ? `<col style="width:17mm">` : ""}${P.hw ? `<col style="width:${P.izoh ? 34 : 42}mm">` : ""}${P.izoh ? `<col style="width:20mm">` : ""}</colgroup>`;
    const th = `<tr><th>№</th><th>Dars mavzusi</th><th>Soat</th><th>Sana (reja)</th>${P.done ? "<th>O'tilgan sana</th>" : ""}${P.hw ? "<th>Uy vazifasi</th>" : ""}${P.izoh ? "<th>Izoh</th>" : ""}</tr>`;
    const head = `<div class="kt-ap"><div><b>TASDIQLAYMAN</b><br>Maktab direktori<br>______________<br>«____» __________ ${sy}-y.</div></div><h5>Kalendar-tematik reja</h5><div class="kt-s2">${esc(c.name)} sinf · ${esc(subj(c))} · ${sy}–${sy + 1} o'quv yili<br>${per ? `${esc(per[0].toUpperCase() + per.slice(1))} · ` : ""}${st.pq && M.hasQ ? `${st.pq}-chorak · ` : ""}jami ${tot} soat</div>`;
    const foot = `<div class="kt-sg2"><span>Fan o'qituvchisi: ______________</span><span>O'IBDO': ______________</span></div>`;
    const rows = docRows(c, M);
    const box = document.createElement("div"); box.className = "kt-meas"; document.body.append(box);
    const pages = [];
    try {
      let cur = null, tb = null;
      const open = (first) => { box.innerHTML = `<div class="bx-pg kt-pgd"><div class="kt-pi">${first ? head : ""}<table class="kt-pt">${cols}<thead>${th}</thead><tbody></tbody></table></div></div>`; tb = box.querySelector("tbody"); cur = {first, rows: []}; };
      const fits = () => { const pi = box.querySelector(".kt-pi"); return pi.scrollHeight <= pi.clientHeight + 1; };
      open(true);
      for (const r of rows) {
        tb.insertAdjacentHTML("beforeend", r);
        if (!fits() && cur.rows.length) { tb.lastElementChild.remove(); pages.push(cur); open(false); tb.insertAdjacentHTML("beforeend", r); }
        cur.rows.push(r);
      }
      box.querySelector(".kt-pi").insertAdjacentHTML("beforeend", foot);
      if (!fits() && cur.rows.length) { pages.push(cur); cur = {first: false, rows: [], foot: true}; }
      cur.last = true; pages.push(cur);
    } finally { box.remove(); }
    return pages.map((p, i) => `<div class="bx-pg kt-pgd"><div class="kt-pi">${p.first ? head : ""}${p.rows.length || p.first ? `<table class="kt-pt">${cols}<thead>${th}</thead><tbody>${p.rows.join("")}</tbody></table>` : ""}${p.last ? foot : ""}</div><div class="kt-pn">${i + 1} / ${pages.length}</div></div>`);
  }
  const fileName = (c, ext) => `KTR ${c.name} ${subj(c)}${st.pq ? ` ${st.pq}-chorak` : ""}.${ext}`.replace(/[\\/:*?"<>|]+/g, " ");
  function printView(c, M) {
    if (!M.T.length) return `<div class="kt-card kt-empty">${I("printer", "kt-ei")}<b>Chop etish uchun reja yo'q</b><span>Avval rejani yuklang yoki yozing.</span></div>`;
    return `<div class="kt-card kt-pv">
      <div class="kt-pvo">${M.hasQ ? `<div class="kt-og"><span class="kt-ol">Davr</span><div class="kt-chips">${[[0, "Butun yil"], [1, "1-chorak"], [2, "2-chorak"], [3, "3-chorak"], [4, "4-chorak"]].map(([x, l]) => `<button class="kt-chip ${st.pq === x ? "on" : ""}" data-k="pq" data-v="${x}">${l}</button>`).join("")}</div></div>` : ""}
        <div class="kt-og"><span class="kt-ol">Ustunlar</span><div class="kt-chips">${[["done", "O'tilgan sana"], ["hw", "Uy vazifasi"], ["izoh", "Izoh"]].map(([x, l]) => `<button class="kt-chip ${st.pcol[x] ? "on" : ""}" data-k="pcol" data-v="${x}" aria-pressed="${!!st.pcol[x]}">${st.pcol[x] ? I("check-lg") : ""}${l}</button>`).join("")}</div></div></div>
      <div class="kt-pva"><button class="kt-btn" data-k="print">${I("printer")}Chop etish</button><button class="kt-btn" data-k="pdf">${I("filetype-pdf", "kt-pdf")}PDF</button><button class="kt-btn" data-k="xls">${I("filetype-xlsx", "kt-xls")}Excel</button><button class="kt-btn pri" data-k="tgp">${I("telegram")}Telegram</button></div>
      <div class="kt-pw" id="kt-pw">${docPages(c, M).join("")}</div></div>`;
  }
  function fitPapers() {
    const pw = document.getElementById("kt-pw"); if (!pw) return;
    pw.querySelectorAll(".bx-pg").forEach((pp) => {
      pp.style.transform = ""; pp.style.marginBottom = ""; pp.style.marginRight = "";
      const sc = Math.min(1, (pw.clientWidth - 28) / pp.offsetWidth);
      pp.style.transform = `scale(${sc})`; pp.style.marginBottom = `${-(1 - sc) * pp.offsetHeight}px`; pp.style.marginRight = `${-(1 - sc) * pp.offsetWidth}px`;
    });
  }
  function doPrint(c) {
    const M = model(c), pages = docPages(c, M);
    let el = document.getElementById("pdoc"); if (!el) { el = document.createElement("div"); el.id = "pdoc"; document.body.append(el); }
    el.className = "bx-print"; el.innerHTML = pages.join(""); document.body.classList.add("pdoc");
    let css = document.getElementById("pdoc-css"); if (!css) { css = document.createElement("style"); css.id = "pdoc-css"; document.head.append(css); }
    css.textContent = "@media print{@page{size:A4 portrait;margin:0}}";
    const old = document.title, back = () => { document.title = old; window.removeEventListener("afterprint", back); el.className = ""; };
    document.title = fileName(c, "pdf").replace(/\.pdf$/, ""); window.addEventListener("afterprint", back); setTimeout(() => { document.title = old; }, 120000);
    window.print();
  }
  const pdfBlob = (c) => PTG.pagesPdf(docPages(c, model(c)), false);
  async function savePdf(c, btn) {
    if (btn) btn.disabled = true;
    try {
      toast("PDF tayyorlanmoqda…");
      const blob = await pdfBlob(c), a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = fileName(c, "pdf");
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      toast("PDF saqlandi");
    } catch (e) { console.warn("KTR PDF:", e); toast(`PDF tayyorlanmadi: ${e.message}`); }
    finally { if (btn) btn.disabled = false; }
  }

  /* ───────── Excel: «ish reja» shakli (namuna: «9-sinf algebra 2-chorak e_baza_ishreja.xlsx») ───────── */
  function xRows(c, q) {
    const T = ((c.plan || {}).topics || []).filter((x) => (x.q || 0) === q), o = [];
    T.forEach((x) => { for (let i = 0; i < Math.max(1, +x.h || 1); i++) o.push({n: o.length + 1, t: x.t, hw: ktrHw(x, i), b: !!kind(x.t)}); });
    return o;
  }
  const xSheet = (c) => `${c.name}. ${subj(c)}`.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);
  const xFile = (c, q) => `${c.name} ${subj(c).toLowerCase()} ${q ? `${q}-chorak ` : ""}ish reja.xlsx`.replace(/[\\/:*?"<>|]+/g, " ");
  function xBook(X, rows, sheet) {
    const L = {style: "thin", color: {rgb: "000000"}}, bd = {top: L, bottom: L, left: L, right: L}, al = (hz) => ({horizontal: hz, vertical: "center", wrapText: true}), tnr = (b) => ({name: "Times New Roman", sz: 12, bold: !!b});
    const H = {font: tnr(1), fill: {patternType: "solid", fgColor: {rgb: "808080"}}, alignment: al("center"), border: bd}, A = {font: tnr(), alignment: al("center"), border: bd}, C = {font: {name: "Cambria", sz: 11}, alignment: al("center"), border: bd};
    const ws = {}, put = (r, cc, v, s) => { ws[X.utils.encode_cell({r, c: cc})] = {v, t: typeof v === "number" ? "n" : "s", s}; };
    ["Darslar tartibi", "Mavzu nomi", "Uyga vazifa"].forEach((x, i) => put(0, i, x, H));
    rows.forEach((x, i) => { put(i + 1, 0, x.n, A); put(i + 1, 1, x.t, {font: tnr(x.b), alignment: al("justify"), border: bd}); put(i + 1, 2, x.hw, C); });
    ws["!ref"] = X.utils.encode_range({s: {r: 0, c: 0}, e: {r: rows.length, c: 2}});
    ws["!cols"] = [{width: 13.86}, {width: 47.71}, {width: 15.57}];
    ws["!rows"] = [{hpt: 31.5}, ...rows.map((x) => ({hpt: 15.75 * Math.max(1, Math.ceil(x.t.length / 54), Math.ceil(x.hw.length / 18))}))];
    ws["!margins"] = {left: 0.71, right: 0.71, top: 0.75, bottom: 0.75, header: 0.31, footer: 0.31};
    const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, sheet); return wb;
  }
  function xlsDialog(c, tg) {
    const M = model(c), qs = M.hasQ ? [1, 2, 3, 4] : [0];
    let q = M.hasQ ? (st.pq || quarterOf(todayIso()) || 1) : 0;
    const inner = () => {
      const rows = xRows(c, q);
      return `<div class="kt-dlg kt-xlc">${dh(tg ? "Excel · Telegram'ga" : "Excel · ish reja", "filetype-xlsx")}
        ${M.hasQ ? `<div class="kt-fl">Chorak<div class="kt-qsel">${qs.map((x) => `<button class="${q === x ? "on" : ""}" data-xq="${x}">${x}</button>`).join("")}</div></div>` : ""}
        <div class="kt-xlw"><table class="kt-xl"><colgroup><col style="width:26px"><col style="width:17%"><col><col style="width:24%"></colgroup><thead><tr><th></th><th>A</th><th>B</th><th>C</th></tr></thead><tbody><tr><th>1</th><td class="xh">Darslar tartibi</td><td class="xh">Mavzu nomi</td><td class="xh">Uyga vazifa</td></tr>${rows.map((r, i) => `<tr><th>${i + 2}</th><td class="a">${r.n}</td><td class="b ${r.b ? "bb" : ""}">${esc(r.t)}</td><td class="c">${esc(r.hw)}</td></tr>`).join("")}</tbody></table></div>
        <div class="kt-xtab"><span>${esc(xSheet(c))}</span></div>
        <div class="kt-xfn">${I("filetype-xlsx", "kt-xls")}<span><b>${esc(xFile(c, q))}</b><br>${rows.length ? `${rows.length} ta dars · har dars alohida qatorda · ko'p soatli mavzu har darsda qaytariladi` : "Bu chorakda mavzu yo'q"}</span></div>
        <div class="kt-ft2"><button class="kt-btn" data-x>Yopish</button><button class="kt-btn pri" data-ok ${rows.length ? "" : "disabled"}>${tg ? `${I("telegram")}Yuborish` : `${I("download")}Yuklab olish`}</button></div></div>`;
    };
    modal(inner(), (mm, close) => {
      const bind = () => {
        mm.querySelectorAll("[data-xq]").forEach((b) => b.onclick = () => { q = +b.dataset.xq; $(".card", mm).innerHTML = inner(); bind(); });
        $("[data-x]", mm).onclick = () => close();
        $("[data-ok]", mm).onclick = async (e) => {
          const btn = e.currentTarget; btn.disabled = true;
          try {
            const X = await BXP.loadXlsxStyle(), wb = xBook(X, xRows(c, q), xSheet(c)), name = xFile(c, q);
            if (tg) { await sendFile(new Blob([X.write(wb, {type: "array", bookType: "xlsx"})], {type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}), name, `📚 ${label(c)} · ${q ? `${q}-chorak ` : ""}ish reja`); toast("Excel fayl Telegram'ga yuborildi"); }
            else { X.writeFile(wb, name, {cellStyles: true}); toast(`Saqlandi: ${name}`); }
            close();
          } catch (err) { console.warn("KTR Excel:", err); toast(err.net ? tgErrTxt(err) : `Excel tayyorlanmadi: ${err.message}`); btn.disabled = false; }
        };
      };
      bind();
    });
  }

  /* ───────── Telegram ───────── */
  async function tgReady() {
    if (tgOn()) return true;
    if (await confirmBox("Telegram ulanmagan", "Fayl «Telegram'ga zaxira» ulangan botingizga boradi. Hozir ulaysizmi?", "Ulash")) { S.sec = 5; go("settings"); }
    return false;
  }
  async function sendFile(blob, name, caption) {
    if (!await tgReady()) throw new Error("Telegram ulanmagan");
    const fd = new FormData(); fd.append("chat_id", tgCfg().chat); fd.append("caption", caption.slice(0, 1000)); fd.append("document", blob, name);
    return tgApi("sendDocument", fd);
  }
  function weekText(c) {
    const t = todayIso(), mon = iso(addDays(pdate(t), -pyWd(t))), sun = iso(addDays(pdate(mon), 6));
    const ds = c.dates.filter((d) => d >= mon && d <= sun && !isNoLesson(c, d)).sort();
    const lines = ds.map((d) => { const l = c.lessons[d] || {}; return `${dm(d)} (${WD[pyWd(d)]}): ${l.topic || "—"}${l.hw ? `\n   🏠 Uy vazifasi: ${l.hw}` : ""}`; });
    return `📚 ${label(c)} — bu haftaning darslari (${dm(mon)}–${dm(sun)})\n\n${lines.join("\n") || "Bu hafta dars yo'q"}`;
  }

  /* ───────── yuklash ───────── */
  const others = (c) => D.classes.filter((x) => x !== c && !isGrp(x) && x.plan && (x.plan.topics || []).length && (!c.subject || normQ(x.subject || "") === normQ(c.subject)));
  // «Darslar tartibi · Mavzu nomi · Uyga vazifa» — har dars alohida qator; ketma-ket bir xil mavzu bitta ko'p soatli mavzu bo'ladi
  function fromLessonRows(aoa) {
    const cs = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
    const hr = aoa.slice(0, 15).findIndex((r) => (r || []).some((x) => /mavzu|тема/i.test(cs(x))) && (r || []).some((x) => /vazifa|задани/i.test(cs(x))));
    if (hr < 0) return null;
    const H = aoa[hr].map(cs), ct = H.findIndex((x) => /mavzu|тема/i.test(x)), cw = H.findIndex((x) => /vazifa|задани/i.test(x));
    const L = []; for (const r of aoa.slice(hr + 1)) { const t = cs((r || [])[ct]); if (!t || /^(IV|III|II|I|[1-4])\s*-?\s*(chorak|четверть)/i.test(t)) continue; L.push({t: t.replace(/\|/g, "/"), hw: cs((r || [])[cw]).replace(/[|;]/g, ",")}); }
    const T = []; L.forEach((r) => { const p = T[T.length - 1]; if (p && p.t === r.t && p.ps.length < 10) p.ps.push(r.hw); else T.push({t: r.t, ps: [r.hw]}); });
    return T.map((x) => { const o = {t: x.t, h: x.ps.length}; const hw = x.ps.every((v) => v === x.ps[0]) ? x.ps[0] : x.ps.join(" ; "); if (hw) o.hw = hw; return o; });
  }
  function pickFile(c) {
    const f = document.createElement("input"); f.type = "file"; f.accept = ".xls,.xlsx,.txt,text/plain,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    f.onchange = async () => {
      const file = f.files[0]; if (!file) return;
      try {
        if (!/\.xlsx?$/i.test(file.name)) { const tp = parsePlanText(await file.text()); if (!tp.length) return toast("Faylda mavzu topilmadi"); return replaceAll(c, tp, file.name); }
        toast("Fayl o'qilmoqda…");
        const X = await loadXlsx(), wb = X.read(new Uint8Array(await file.arrayBuffer()), {type: "array"});
        for (const n of wb.SheetNames) {
          const T = fromLessonRows(X.utils.sheet_to_json(wb.Sheets[n], {header: 1, raw: false, defval: ""}));
          if (T && T.length) { const m = file.name.match(/([1-4])\s*-?\s*chorak/i); return quarterImport(c, T, file.name, m ? +m[1] : quarterOf(todayIso()) || 1); }
        }
        const sh = await planFromExcel(file, c);
        if (!sh.length) return toast("Faylda mavzular topilmadi — «Mavzu» ustuni bo'lishi kerak");
        replaceAll(c, parsePlanText(sh[0].text), `${file.name} · ${sh[0].n}`);
      } catch (e) { console.warn("KTR fayl:", e); toast("Faylni o'qib bo'lmadi: " + e.message); }
    };
    f.click();
  }
  function quarterImport(c, T, name, q0) {
    let q = q0;
    const inner = () => { const h0 = T.reduce((a, x) => a + x.h, 0); return `<div class="kt-dlg">${dh("Excel'dan yuklash", "file-earmark-arrow-up")}
      <div class="kt-xfn">${I("filetype-xlsx", "kt-xls")}<span><b>${esc(name)}</b><br>${h0} ta dars → ${T.length} ta mavzu (bir xil nomli ketma-ket darslar bitta mavzuga birlashtirildi)</span></div>
      <div class="kt-fl">Qaysi chorak rejasi o'rniga qo'yilsin<div class="kt-qsel">${[1, 2, 3, 4].map((x) => `<button class="${q === x ? "on" : ""}" data-xq="${x}">${x}</button>`).join("")}</div></div>
      <div class="kt-xil">${T.slice(0, 8).map((x, i) => `<div><span class="n">${i + 1}</span><span><b>${esc(x.t)}</b>${x.h > 1 ? ` · ${x.h} soat` : ""}<br><small>${esc(hwShow(x)) || "—"}</small></span></div>`).join("")}${T.length > 8 ? `<div class="kt-mu kt-sm">… yana ${T.length - 8} ta mavzu</div>` : ""}</div>
      <div class="kt-ft2"><button class="kt-btn" data-x>Bekor qilish</button><button class="kt-btn pri" data-ok>${I("check-lg")}${q}-chorakka qo'yish</button></div></div>`; };
    modal(inner(), (mm, close) => {
      const bind = () => {
        mm.querySelectorAll("[data-xq]").forEach((b) => b.onclick = () => { q = +b.dataset.xq; $(".card", mm).innerHTML = inner(); bind(); });
        $("[data-x]", mm).onclick = () => close();
        $("[data-ok]", mm).onclick = () => {
          const p = ensure(c), ins = T.map((x) => Object.assign({}, x, {q}));
          // choraksiz eski reja bo'lsa — hammasi shu chorakka o'tkaziladi (aralash bo'lmasin)
          if (p.topics.length && !p.topics.some((x) => x.q)) p.topics = [];
          const i0 = p.topics.findIndex((x) => x.q === q); p.topics = p.topics.filter((x) => x.q !== q);
          let at = i0 >= 0 ? i0 : p.topics.findIndex((x) => (x.q || 0) > q); if (at < 0) at = p.topics.length;
          p.topics.splice(at, 0, ...ins); st.closed.delete(q); close(); commit(c, `${q}-chorak: ${ins.length} ta mavzu yuklandi`);
        };
      };
      bind();
    });
  }
  async function replaceAll(c, tp, name) {
    const p = c.plan || {topics: []}, h0 = tp.reduce((a, x) => a + x.h, 0);
    if ((p.topics || []).length && !await confirmBox("Rejani almashtirish", `«${name}»: ${tp.length} ta mavzu, ${h0} soat. Hozirgi reja (${p.topics.length} ta mavzu) shu bilan almashtirilsinmi?`, "Almashtirish")) return;
    ensure(c).topics = tp; commit(c, `${tp.length} ta mavzu yuklandi`);
  }

  /* ───────── o'zgartirish ───────── */
  function ensure(c) { if (!c.plan || typeof c.plan !== "object") c.plan = {on: true, topics: []}; if (!Array.isArray(c.plan.topics)) c.plan.topics = []; return c.plan; }
  function clearAuto(c) { for (const [d, les] of Object.entries(c.lessons)) if (les.auto) { if (ownHw(les)) c.lessons[d] = {topic: "", hw: les.hw}; else delete c.lessons[d]; } }
  function commit(c, msg, act) {
    const p = ensure(c);
    if (p.on && p.topics.length) reflowPlan(c); else clearAuto(c);
    save(); redraw(); if (msg) toast(msg, act);
  }
  function redraw() { if (S.page === "journal" && S.jpage === "ktr") softRender(); else render(); }
  function editDlg(c, i, opt = {}) {
    const p = ensure(c), isNew = !!opt.isNew, hasQ = p.topics.some((x) => x.q) || !p.topics.length;
    const x = isNew ? {t: "", h: 1, q: opt.q || (hasQ ? quarterOf(todayIso()) || 1 : 0), hw: ""} : Object.assign({}, p.topics[i]);
    x.h = Math.max(1, +x.h || 1);
    const read = (mm) => { x.t = $("#kt-et", mm).value; const v = [...mm.querySelectorAll(".kt-ehw")].map((e) => e.value.trim()); x.hw = v.every((y) => y === v[0]) ? v[0] : v.join(" ; "); };
    const hwAt = (k) => ktrHw(x, k);
    const inner = () => `<div class="kt-dlg">${dh(isNew ? "Yangi mavzu" : "Mavzuni tahrirlash", isNew ? "plus-lg" : "pencil")}
      <label class="kt-fl">Dars mavzusi<textarea id="kt-et" rows="2">${esc(x.t)}</textarea></label>
      ${x.h > 1 ? `<div class="kt-fl"><span>${I("house-door")} Uy vazifasi · har dars uchun alohida</span>${Array.from({length: x.h}, (_, k) => `<label class="kt-hwr"><small>${k + 1}-dars</small><input class="kt-ehw" value="${esc(hwAt(k))}" placeholder="Masalan: §12, ${45 + k * 4}–${48 + k * 4}-mashqlar"></label>`).join("")}</div>`
        : `<label class="kt-fl"><span>${I("house-door")} Uy vazifasi</span><input class="kt-ehw" value="${esc(x.hw || "")}" placeholder="Masalan: §12, 45–48-mashqlar"></label>`}
      <div class="kt-frow"><div class="kt-fl">Soat<div class="kt-hs"><button data-eh="-1" aria-label="Kamaytirish">${I("dash-lg")}</button><b>${x.h}</b><button data-eh="1" aria-label="Oshirish">${I("plus-lg")}</button></div></div>
        <div class="kt-fl">Turi<div class="kt-chips eq3">${[["", "Oddiy"], ["BSB", "BSB"], ["CHSB", "CHSB"]].map(([v, l]) => `<button class="kt-chip ${(kind(x.t) || "") === v.toLowerCase() ? "on" : ""}" data-ek="${v}">${l}</button>`).join("")}</div></div></div>
      ${hasQ ? `<div class="kt-fl">Chorak<div class="kt-qsel">${[1, 2, 3, 4].map((q) => `<button class="${x.q === q ? "on" : ""}" data-eq="${q}">${q}</button>`).join("")}</div></div>` : ""}
      <p class="kt-hint">${I("info-circle")}<span>BSB yoki CHSB tanlansa, shu dars kuniga summativ ish ustuni o'zi ochiladi.</span></p>
      <div class="kt-ft2"><button class="kt-btn" data-x>Bekor qilish</button><button class="kt-btn pri" data-ok>${I("check-lg")}Saqlash</button></div></div>`;
    modal(inner(), (mm, close) => {
      const bind = () => {
        mm.querySelectorAll("[data-eh]").forEach((b) => b.onclick = () => { read(mm); x.h = Math.max(1, Math.min(10, x.h + +b.dataset.eh)); $(".card", mm).innerHTML = inner(); bind(); });
        mm.querySelectorAll("[data-eq]").forEach((b) => b.onclick = () => { read(mm); x.q = +b.dataset.eq; $(".card", mm).innerHTML = inner(); bind(); });
        mm.querySelectorAll("[data-ek]").forEach((b) => b.onclick = () => {
          read(mm); const v = b.dataset.ek, rest = x.t.replace(/^\s*(CHSB|BSB)\b\s*(№\s*\d+)?\s*(\(\s*\d+\s*ball\s*\))?\s*/i, "");
          x.t = v ? `${v}${v === "BSB" ? ` №${p.topics.filter((y) => kind(y.t) === "bsb").length + (kind(x.t) === "bsb" ? 0 : 1)} (25 ball)` : " (40 ball)"}${rest ? " " + rest : ""}` : rest;
          $(".card", mm).innerHTML = inner(); bind();
        });
        $("[data-x]", mm).onclick = () => close();
        $("[data-ok]", mm).onclick = () => {
          read(mm); x.t = x.t.replace(/\s+/g, " ").replace(/\|/g, "/").trim(); if (!x.t) { toast("Mavzu nomini yozing"); return; }
          const o = {t: x.t, h: x.h, q: hasQ ? x.q : null}; if (x.hw && x.hw.replace(/[;\s]/g, "")) o.hw = x.hw;
          if (isNew) {
            if (opt.before !== undefined) p.topics.splice(opt.before, 0, o);
            else { let li = -1; p.topics.forEach((y, k) => { if ((y.q || 0) <= (o.q || 0)) li = k; }); p.topics.splice(li + 1, 0, o); }
          } else p.topics[i] = o;
          close(); commit(c, "Saqlandi");
        };
        if (opt.hw) setTimeout(() => { const f = $(".kt-ehw", mm); if (f) f.focus(); }, 30);
      };
      bind();
    });
  }
  function setDlg(c) {
    const p = ensure(c), t = todayIso(), cq = quarterOf(t), qlo = cq && qRange(cq) ? qRange(cq)[0] : "", ylo = qRange(1) ? qRange(1)[0] : "";
    let start = ISO_D.test(String(p.start)) ? p.start : "", on = !!p.on || !p.topics.length, cal = false, cm = (start || t).slice(0, 7);
    const lessonDay = (d) => c.dates.includes(d) && !isNoLesson(c, d);
    const calHtml = () => {
      const y = +cm.slice(0, 4), mo = +cm.slice(5, 7) - 1, first = (new Date(y, mo, 1).getDay() + 6) % 7, nd = new Date(y, mo + 1, 0).getDate();
      let hh = WD.map((x) => `<b>${x}</b>`).join("") + "<span></span>".repeat(first);
      for (let d = 1; d <= nd; d++) { const ds = `${cm}-${String(d).padStart(2, "0")}`; hh += `<button class="${lessonDay(ds) ? "ls" : ""} ${start === ds ? "on" : ""}" data-pick="${ds}">${d}</button>`; }
      return `<div class="kt-calw"><div class="kt-row"><button class="kt-ib sm" data-cm="-1" aria-label="Oldingi oy">${I("chevron-left")}</button><b style="flex:1;text-align:center">${MONTHS[mo]} ${y}</b><button class="kt-ib sm" data-cm="1" aria-label="Keyingi oy">${I("chevron-right")}</button></div><div class="kt-mcal">${hh}</div><div class="kt-mu kt-sm">Ajratilgan kunlar — shu sinfning dars kunlari.</div></div>`;
    };
    const free = () => c.dates.filter((d) => d >= (start || t) && !isNoLesson(c, d)).length;
    const inner = () => `<div class="kt-dlg">${dh("Reja sozlamalari", "sliders")}
      <div class="kt-fl">Reja qachondan boshlanadi<div class="kt-chips">${[[ylo, "O'quv yili boshidan"], [qlo, "Chorak boshidan"], ["", "Bugundan"]].filter(([d, l], k) => k === 2 || d).map(([d, l]) => `<button class="kt-chip ${start === d ? "on" : ""}" data-pick="${d}">${l}</button>`).join("")}<button class="kt-chip ${cal ? "on" : ""}" data-calo>${I("calendar-event")}${start && start !== ylo && start !== qlo ? fD(start) : "Boshqa kun"}</button></div></div>
      ${cal ? calHtml() : ""}
      <div class="kt-mu kt-sm" id="kt-sinfo">Birinchi mavzu ${start ? fL(start) : "bugun"}dan keyingi dars kuniga qo'yiladi · shu kundan ${free()} ta dars kuni bor.</div>
      <label class="kt-tgl"><input type="checkbox" id="kt-on" ${on ? "checked" : ""}><span><b>Mavzularni dars kunlariga avtomatik taqsimlash</b><small>Darsda qo'lda yozilgan mavzular o'zgarmaydi.</small></span></label>
      <div class="kt-ft2"><button class="kt-btn" data-x>Bekor qilish</button><button class="kt-btn pri" data-ok>${I("check-lg")}Saqlash</button></div></div>`;
    modal(inner(), (mm, close) => {
      const bind = () => {
        const re = () => { on = $("#kt-on", mm).checked; $(".card", mm).innerHTML = inner(); bind(); };
        mm.querySelectorAll("[data-pick]").forEach((b) => b.onclick = () => { start = b.dataset.pick; if (!b.closest(".kt-mcal")) cal = false; re(); });
        const co = $("[data-calo]", mm); if (co) co.onclick = () => { cal = !cal; re(); };
        mm.querySelectorAll("[data-cm]").forEach((b) => b.onclick = () => { const d = new Date(+cm.slice(0, 4), +cm.slice(5, 7) - 1 + +b.dataset.cm, 1); cm = iso(d).slice(0, 7); re(); });
        $("[data-x]", mm).onclick = () => close();
        $("[data-ok]", mm).onclick = () => {
          const old = ISO_D.test(String(p.start)) ? p.start : "";
          p.on = $("#kt-on", mm).checked; if (start) p.start = start; else delete p.start;
          if (start !== old) clearAuto(c);
          close(); commit(c, p.on ? "Reja sozlamalari saqlandi" : "Avtomatik taqsimlash o'chirildi");
        };
      };
      bind();
    });
  }
  const dh = (t, ic) => `<div class="kt-dh">${I(ic)}<h3>${t}</h3><span class="kt-sp"></span><button class="kt-ib sm" data-x aria-label="Yopish">${I("x-lg")}</button></div>`;

  /* ───────── menyular ───────── */
  let POP = null, POP_T = 0;
  function closePop() { if (POP) { POP.remove(); POP = null; } }
  const mi = (ic, k, l, extra = "", cl = "") => `<button class="${cl}" data-k="${k}" ${extra}>${I(ic)}<span>${l}</span></button>`;
  function pop(anchor, html) {
    closePop();
    const el = document.createElement("div"); el.className = "kt-pop"; el.setAttribute("role", "menu"); el.innerHTML = html; document.body.append(el); POP = el;
    const r = anchor.getBoundingClientRect(), w = el.offsetWidth, hh = el.offsetHeight, vw = document.documentElement.clientWidth, vh = window.innerHeight;
    let x = r.left; if (x + w > vw - 8) x = vw - w - 8; let y = r.bottom + 4; if (y + hh > vh - 8 && r.top - hh - 4 > 8) y = r.top - hh - 4;
    el.style.left = Math.max(8, x) + "px"; el.style.top = Math.max(8, y) + "px"; POP_T = Date.now();
    el.addEventListener("click", onClick);
    const b = el.querySelector("button"); if (b) b.focus({preventScroll: true});
  }
  document.addEventListener("click", (e) => { if (POP && !e.target.closest(".kt-pop") && !e.target.closest("[data-k]")) closePop(); }, true);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && POP) { e.preventDefault(); closePop(); } });
  window.addEventListener("resize", () => { closePop(); fitPapers(); });
  window.addEventListener("scroll", () => { if (Date.now() - POP_T > 400) closePop(); }, {passive: true});

  async function onClick(e) {
    const b = e.target.closest("[data-k]"); if (!b) return;
    const c = cls(), k = b.dataset.k, v = b.dataset.v, i = b.dataset.i !== undefined ? +b.dataset.i : -1, p = c.plan || {topics: []}, x = p.topics[i];
    if (!["dpop", "rmenu", "imp", "exp", "tgp"].includes(k)) closePop();
    switch (k) {
      case "back": S.jpage = "j"; render(); window.scrollTo(0, 0); return;
      case "tab": st.tab = v; break;
      case "qf": st.qf = st.qf === +v ? 0 : +v; st.closed.delete(+v); break;
      case "flt": st.flt = v; break;
      case "tog": st.closed.has(+v) ? st.closed.delete(+v) : st.closed.add(+v); break;
      case "pq": st.pq = +v; break;
      case "pcol": st.pcol[v] = !st.pcol[v]; break;
      case "hm": if (x && x.h > 1) { x.h--; commit(c); } return;
      case "hp": if (x && (x.h || 1) < 10) { x.h = (x.h || 1) + 1; commit(c); } return;
      case "minus": if (x && x.h > 1) { x.h--; commit(c, `«${x.t}» — ${x.h} soat`); } return;
      case "onauto": ensure(c).on = true; commit(c, "Mavzular dars kunlariga taqsimlandi"); return;
      case "addrev": { const T = ensure(c).topics, q = +v; let li = -1; T.forEach((y, j) => { if ((y.q || 0) === q) li = j; }); const last = T[li], at = last && /xatolar ustida|^\s*chsb/i.test(last.t) ? li : li + 1; T.splice(Math.max(0, at), 0, {t: "Takrorlash", h: 1, q: q || null}); commit(c, "Takrorlash darsi qo'shildi"); return; }
      case "unoff": if (ARX.dateLocked(v, c)) return ARX.deny(quarterOf(v)); c.extra_x = c.extra_x.filter((d) => d !== v); commit(c, `${fD(v)} yana dars kuni`); return;
      case "off": {
        if (ARX.dateLocked(v, c)) return ARX.deny(quarterOf(v));
        if (hasMarks(c, v)) { toast("Bu kunda baholar bor — avval ularni tozalang"); return; }
        c.held = c.held.filter((d) => d !== v); if (!c.extra_x.includes(v)) c.extra_x.push(v);
        commit(c, `${fD(v)}: dars bo'lmadi — mavzular surildi`, ["Qaytarish", () => { c.extra_x = c.extra_x.filter((d) => d !== v); commit(c); }]); return;
      }
      case "dayopen": colMenu(S.ci, v); return;
      case "add": editDlg(c, -1, {isNew: true, q: +v || null}); return;
      case "ins": editDlg(c, -1, {isNew: true, before: i, q: x && x.q}); return;
      case "edit": editDlg(c, i); return;
      case "hwed": editDlg(c, i, {hw: true}); return;
      case "up": case "down": {
        const T = p.topics, j = i + (k === "up" ? -1 : 1); if (j < 0 || j >= T.length) return;
        if ((T[j].q || 0) !== (x.q || 0)) { x.q = T[j].q; commit(c, `${x.q}-chorakka o'tkazildi`); return; }
        [T[i], T[j]] = [T[j], T[i]]; commit(c); return;
      }
      case "dup": p.topics.splice(i + 1, 0, JSON.parse(JSON.stringify(x))); commit(c, "Nusxa qo'shildi"); return;
      case "del": { const T = ensure(c).topics, gone = T.splice(i, 1)[0]; commit(c, "Mavzu o'chirildi", ["Qaytarish", () => { ensure(c).topics.splice(i, 0, gone); commit(c, "Qaytarildi"); }]); return; }
      case "applytxt": {
        const tp = parsePlanText($("#kt-txt").value);
        if (!tp.length && p.topics.length && !await confirmBox("Rejani tozalash", "Matn bo'sh — reja butunlay o'chirilsinmi?", "O'chirish")) return;
        ensure(c).topics = tp; st.tab = "plan"; commit(c, `${tp.length} ta mavzu rejaga qo'llandi`); return;
      }
      case "set": setDlg(c); return;
      case "ximp": pickFile(c); return;
      case "copy": { const o = D.classes[+v]; if (!o) return; replaceAll(c, JSON.parse(JSON.stringify(o.plan.topics)), label(o)); return; }
      case "print": doPrint(c); return;
      case "pdf": savePdf(c, b); return;
      case "xls": xlsDialog(c, false); return;
      case "tgpdf": if (!await tgReady()) return; PTG.run(() => pdfBlob(c), fileName(c, "pdf").replace(/\.pdf$/, ""), `📚 Kalendar-tematik reja\n${label(c)}${st.pq ? ` · ${st.pq}-chorak` : ""}`); return;
      case "tgxls": if (!await tgReady()) return; xlsDialog(c, true); return;
      case "tgweek": {
        const txt = weekText(c); if (!await tgReady()) { copyText(txt); return; }
        try { await tgApi("sendMessage", {chat_id: tgCfg().chat, text: txt}); toast("Bu haftaning mavzulari Telegram'ga yuborildi"); } catch (err) { toast(tgErrTxt(err)); }
        return;
      }
      case "tgcopy": copyText(weekText(c)); return;
      case "dpop": pop(b, `<h4>${fL(v)}</h4><p>${v < todayIso() ? "O'tgan dars" : v === todayIso() ? "Bugungi dars" : "Rejadagi dars"}</p>${mi("calendar-x", "off", "Bu kunda dars bo'lmadi<small>Keyingi mavzular bir darsga suriladi</small>", `data-v="${v}"`)}${mi("journal-text", "dayopen", "Kun oynasini ochish<small>Mavzu, uy vazifasi, yo'qlama</small>", `data-v="${v}"`)}`); return;
      case "rmenu": { const a = `data-i="${i}"`; pop(b, `<h4>${esc(x.t)}</h4>${mi("pencil", "edit", "Tahrirlash", a)}${mi("house-door", "hwed", x.hw ? "Uy vazifasini o'zgartirish" : "Uy vazifasi qo'shish", a)}<hr>${mi("arrow-up", "up", "Yuqoriga", a)}${mi("arrow-down", "down", "Pastga", a)}${mi("plus-lg", "ins", "Oldidan mavzu qo'shish", a)}${mi("copy", "dup", "Nusxa olish", a)}<hr>${mi("trash", "del", "O'chirish", a, "dg")}`); return; }
      case "imp": { const os = others(c); pop(b, `<h4>Rejani yuklash</h4>${mi("file-earmark-arrow-up", "ximp", "Excel yoki matn fayldan<small>KTR jadvali yoki ish reja: Darslar tartibi · Mavzu nomi · Uyga vazifa</small>")}${mi("pencil-square", "tab", "Matn sifatida yozish", `data-v="txt"`)}${os.length ? `<hr><p>Boshqa sinfdan nusxa olish</p>${os.map((o) => mi("copy", "copy", `${esc(label(o))}<small>${planSlots(o.plan).length} soat</small>`, `data-v="${D.classes.indexOf(o)}"`)).join("")}` : ""}`); return; }
      case "exp": pop(b, `<h4>Eksport</h4><p>${st.pq ? `${st.pq}-chorak` : "Butun yil"} · ustunlarni «Chop etish» bo'limida tanlaysiz</p>${mi("printer", "tab", "Chop etish (A4)", `data-v="print"`)}${mi("filetype-pdf", "pdf", "PDF yuklab olish")}${mi("filetype-xlsx", "xls", "Excel (ish reja)<small>Darslar tartibi · Mavzu nomi · Uyga vazifa</small>")}<hr>${mi("telegram", "tgp", "Telegram'ga…")}`); return;
      case "tgp": pop(POP && POP.contains(b) ? document.querySelector('[data-k="exp"]') || b : b, `<h4>${I("telegram")} Telegram'ga yuborish</h4>${mi("filetype-pdf", "tgpdf", "PDF fayl<small>A4, chop etishga tayyor</small>")}${mi("filetype-xlsx", "tgxls", "Excel fayl (ish reja)<small>Har chorak alohida fayl</small>")}${mi("chat-left-text", "tgweek", "Bu hafta: mavzular va uy vazifalari<small>Matn — ota-onalar guruhiga uzatish uchun</small>")}${mi("clipboard", "tgcopy", "Shu matnni nusxalash")}`); return;
      default: return;
    }
    redraw();
  }
  function bind(m) {
    if (m._kt) return; m._kt = true;
    m.addEventListener("click", (e) => { if (S.page === "journal" && S.jpage === "ktr" && e.target.closest("[data-ktpage]")) onClick(e); });
    m.addEventListener("input", (e) => {
      if (e.target.id === "kt-find") { st.find = e.target.value; const pos = e.target.selectionStart; softRender(); const f = document.getElementById("kt-find"); if (f) { f.focus(); f.setSelectionRange(pos, pos); } }
      if (e.target.id === "kt-txt") { const tp = parsePlanText(e.target.value), el = document.getElementById("kt-tinfo"); if (el) el.textContent = `${tp.length} ta mavzu · ${tp.reduce((a, x) => a + x.h, 0)} soat`; }
    });
  }
  function open(ci) { if (ci !== undefined) S.ci = ci; S.page = "journal"; S.jpage = "ktr"; render(); window.scrollTo(0, 0); }
  return {page: (m) => { bind(m); page(m); }, open, model, xRows, xBook, fromLessonRows, weekText, docPages, state: st};
})();
