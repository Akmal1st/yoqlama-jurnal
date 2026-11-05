/* ───────── Guruhlar bo'limi: to'garak va pullik ta'lim (alohida fayl) ─────────
   Asosiy ilova (index.html) dan oldin yuklanadi; ilovaning umumiy narsalari (D, save, render, toast, esc, todayIso,
   newSid, normalize, isGrp, MONTHS…) faqat chaqirilganda ishlatiladi.

   Ma'lumot — eski shaklda, D.classes ichida (guruh = c.kind "paid" | "club"):
     c.gdays  [1,3,5]   dars kunlari (0 = yakshanba … 6 = shanba); bo'lmasa eski c.weekdays (0 = dushanba) dan olinadi
     c.gtime  "15:00",  c.gdur 90 (daqiqa),  c.garch true — arxivda
     c.packs  [{id, name, n, sum}]  paketlar: n dars = sum so'm
     s.pkg    tanlangan paket id,  s.marks[sana] = "ot" — o'quvchi kelgan kun,  s.par {phone, tg}
     s.pays   [{id, no, d, m, sum, pk, how}]  pk — shu to'lov bilan nechta dars sotib olingani
   Hisob — bitta qoida: qoldiq = sotib olingan darslar − kelgan kunlar
     > 1 — yashil, 0…1 — to'lov vaqti, < 0 — qarz = |qoldiq| × (paket narxi ÷ darslar soni) */
const TPT = (() => {
  const WDS = ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"];
  const WL = ["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"];
  const MG = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
  const MN = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
  const HOW = ["Naqd", "Karta", "Click", "Payme"];
  const AVC = ["#0d8a87", "#6d4fd3", "#d9480f", "#1c7ed6", "#c2255c", "#2b8a3e", "#e67700"];
  const TIMES = Array.from({length: 27}, (_, i) => `${String(7 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
  const DURS = [45, 60, 90, 120];

  const q = (sel, el) => (el || document).querySelector(sel);
  const qa = (sel, el) => (el || document).querySelectorAll(sel);
  const e = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[ch]));
  const sp3 = (n) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const som = (n) => `${sp3(n)} so'm`;
  const pd = (s) => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = () => todayIso();
  const wdOf = (s) => pd(s).getDay();
  const dm = (s) => `${+s.slice(8, 10)} ${MG[+s.slice(5, 7) - 1]}`;
  const ini = (n) => String(n).split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join("") || "?";
  const avs = (n) => { let h = 0; for (const ch of String(n)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; const c = AVC[h % AVC.length]; return `background:${c}1f;color:${c}`; };
  const okTime = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t || ""));

  /* ── ma'lumot ── */
  const isG = (c) => !!(c && (c.kind === "paid" || c.kind === "club"));
  const groups = () => D.classes.map((c, ci) => ({c, ci})).filter((x) => isG(x.c));
  const daysOf = (c) => Array.isArray(c.gdays) && c.gdays.length ? c.gdays : (c.weekdays || []).map((w) => (w + 1) % 7);
  const timeOf = (c) => okTime(c.gtime) ? c.gtime : "";
  const sched = (c) => { const d = daysOf(c); return [d.length ? [1, 2, 3, 4, 5, 6, 0].filter((x) => d.includes(x)).map((x) => WDS[x]).join(" · ") : "Kunlari belgilanmagan", timeOf(c)].filter(Boolean).join(" · "); };
  const isLesson = (c, d) => daysOf(c).includes(wdOf(d));
  const pkgOf = (c, s) => (c.packs || []).find((p) => p.id === s.pkg) || null;
  const came = (s, upto) => Object.keys(s.marks || {}).filter((d) => s.marks[d] === "ot" && d <= (upto || today())).sort();
  // eski to'lovda «nechta dars» yozilmagan bo'lsa: summa ÷ bitta dars narxi
  const payLessons = (c, s, p) => p.pk ? +p.pk : (() => { const k = pkgOf(c, s); return k && k.sum > 0 ? Math.floor((+p.sum || 0) / (k.sum / k.n) + 1e-9) : 0; })();
  function acct(c, s) {
    const k = pkgOf(c, s), used = came(s).length, bought = (s.pays || []).reduce((a, p) => a + payLessons(c, s, p), 0);
    const left = bought - used, one = k && k.n ? k.sum / k.n : 0;
    return {k, used, bought, left, one, money: Math.abs(left) * one, due: !!k && left <= 0};
  }
  // bir marta: oylik/kunlik narxli eski o'quvchiga mos paket yaratiladi
  function prep(c) {
    if (c.kind !== "paid") return false;
    let ch = false;
    for (const s of c.students) {
      if (pkgOf(c, s) || !s.plan || !(+s.plan.sum > 0)) continue;
      const day = s.plan.t === "day", n = day ? 1 : Math.max(1, Math.trunc(+s.pack || +c.pack || 12)), sum = +s.plan.sum;
      c.packs = c.packs || [];
      let k = c.packs.find((p) => p.n === n && p.sum === sum);
      if (!k) { k = {id: "pk" + newSid(), name: day ? "1 dars" : "Oylik", n, sum}; c.packs.push(k); }
      s.pkg = k.id; ch = true;
    }
    return ch;
  }

  /* ── holat ── */
  TPTM.init({e, q, qa, pd, iso, dm, wdOf, today, isLesson, sched, WDS, WL, MN, cntOn: (c, d) => cntOn(c, d),
    openLayer: (...a) => openLayer(...a), closeLayer: () => closeLayer(), hdr: (t) => hdr(t), confirmG: (...a) => confirmG(...a), dayPicker: (o) => dayPicker(o),
    save: () => save(), draw: () => draw(), toast: (x) => toast(x)});
  const T = {scr: "home", gi: -1, tab: "att", day: "", mo: "", av: "day", flt: "all", arch: false};
  const G = () => D.classes[T.gi];

  function statusPill(c, s) {
    if (c.kind === "club") { const m = today().slice(0, 7), n = came(s).filter((d) => d.startsWith(m)).length; return `<span class="g-pill p-club">Bu oy ${n} marta keldi</span>`; }
    const a = acct(c, s);
    if (!a.k) return `<span class="g-pill p-mut">Paket tanlanmagan</span>`;
    if (a.left < 0) return `<span class="g-pill p-bad">Qarz: ${-a.left} dars · ${som(a.money)}</span>`;
    if (a.left === 0) return `<span class="g-pill p-warn">To'lov vaqti</span>`;
    if (a.left === 1) return `<span class="g-pill p-warn">1 dars qoldi</span>`;
    return `<span class="g-pill p-ok">${a.left} dars qoldi</span>`;
  }
  const subTxt = (c, s) => { const a = acct(c, s); if (!a.k) return "paket yo'q"; if (a.left < 0) return `qarz ${-a.left} dars`; if (a.left === 0) return "to'lov vaqti"; return `${a.left} dars qoldi`; };
  // joriy paket: nechtasi ishlatilgan (to'langan darslar ichida)
  function inPack(a) { const n = a.k.n; if (a.left < 0) return {used: n, over: -a.left}; const rest = a.left > 0 ? (a.left % n || n) : 0; return {used: n - rest, over: 0}; }
  function dots(a) {
    const n = a.k.n, p = inPack(a); let h = "";
    for (let i = 0; i < n; i++) h += `<i class="${i < p.used ? "u" : ""}"></i>`;
    for (let i = 0; i < Math.min(p.over, 30); i++) h += `<i class="o"></i>`;
    return `<div class="g-dots" aria-hidden="true">${h}</div>`;
  }

  /* ── 1. ro'yxat ── */
  function homeHtml() {
    const all = groups(), list = all.filter((x) => !!x.c.garch === T.arch), t = today(), mo = t.slice(0, 7);
    const act = all.filter((x) => !x.c.garch), paid = act.filter((x) => x.c.kind === "paid");
    const todayG = act.filter((x) => isLesson(x.c, t));
    const due = paid.flatMap((x) => x.c.students.filter((s) => acct(x.c, s).due));
    const mon = paid.flatMap((x) => x.c.students.flatMap((s) => s.pays || [])).filter((p) => String(p.d).startsWith(mo)).reduce((a, p) => a + (+p.sum || 0), 0);
    const nArch = all.filter((x) => x.c.garch).length;
    const head = `<div class="g-row"><div style="flex:1;min-width:0"><h1>${T.arch ? "Arxivdagi guruhlar" : "Guruhlar"}</h1><div class="g-muted">To'garak va pullik ta'lim · ${dm(t)}, ${["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"][wdOf(t)]}</div></div>
      ${T.arch ? `<button class="g-btn" type="button" data-arch="0">‹ Guruhlarga qaytish</button>` : `<button class="g-btn pri" type="button" data-new>＋ Yangi guruh</button>`}</div>`;
    if (!all.length) return head + `<div class="g-card g-empty"><h2>Hali guruh yo'q</h2><div class="g-muted">To'garak yoki pullik guruh qo'shing: nomi, dars kunlari va paket narxlari. Keyin o'quvchilarni qo'shasiz.</div><button class="g-btn pri" type="button" data-new>＋ Yangi guruh</button></div>`;
    return head + (T.arch ? "" : `<div class="g-stats">
      <div class="g-stat"><small>Bugun dars</small><strong class="g-num">${todayG.length} guruh</strong><span class="g-muted">${todayG.map((x) => e(x.c.name) + (timeOf(x.c) ? " " + timeOf(x.c) : "")).join(", ") || "yo'q"}</span></div>
      <button class="g-stat" type="button" data-due><small>To'lov kutilmoqda</small><strong class="g-num" style="${due.length ? "color:var(--g-bad)" : ""}">${due.length} o'quvchi</strong><span class="g-muted">${due.length ? "bosing — ro'yxat" : "hamma to'lagan"}</span></button>
      <div class="g-stat"><small>${MN[+mo.slice(5) - 1]} tushumi</small><strong class="g-num">${som(mon)}</strong><span class="g-muted">${paid.length} pullik guruh</span></div></div>`) + `
    <div class="g-list">${list.map(({c, ci}) => {
      const dueN = c.kind === "paid" ? c.students.filter((s) => acct(c, s).due).length : 0;
      return `<button class="g-gcard" type="button" data-g="${ci}">
        <div class="g-row" style="gap:8px;flex-wrap:nowrap"><h2 style="flex:1;min-width:0">${e(c.name)}</h2>${c.kind === "paid" ? `<span class="g-pill p-acc">Pullik</span>` : `<span class="g-pill p-club">To'garak</span>`}</div>
        <div class="g-meta">${!c.garch && isLesson(c, t) ? `<span class="g-pill p-ok">Bugun${timeOf(c) ? " " + timeOf(c) : ""}</span>` : ""}${dueN ? `<span class="g-pill p-bad">${dueN} ta to'lov kutilmoqda</span>` : ""}</div>
        ${!c.garch && isLesson(c, t) && TPTM.todayLine(c) ? `<div class="g-muted g-ttoday">Bugun: ${e(TPTM.todayLine(c))}</div>` : ""}
        <div class="g-foot"><span>${e(sched(c))}</span><span class="g-sp"></span><span class="g-num">${c.students.length} o'quvchi</span></div></button>`;
    }).join("")}${T.arch ? "" : `<button class="g-add" type="button" data-new>＋ Guruh qo'shish</button>`}</div>
    ${!T.arch && nArch ? `<button class="g-link" type="button" data-arch="1">Arxivdagi guruhlar (${nArch})</button>` : ""}`;
  }

  /* ── 2. guruh ── */
  function groupHtml() {
    const c = G(), paid = c.kind === "paid";
    const tabs = [["att", "Yo'qlama"], ["stu", "O'quvchilar"]].concat(paid ? [["pay", "To'lovlar"]] : [], [["top", "Mavzular"]]);
    if (!tabs.some(([k]) => k === T.tab)) T.tab = "att";
    return `<div class="g-head"><div class="g-t">
      <button class="g-back" type="button" data-home>‹ Guruhlar</button>
      <h1>${e(c.name)}</h1>
      <div class="g-row" style="gap:6px">${paid ? `<span class="g-pill p-acc">Pullik</span>` : `<span class="g-pill p-club">To'garak</span>`}${c.garch ? `<span class="g-pill p-warn">Arxivda</span>` : ""}<span class="g-pill p-mut">${e(sched(c))}</span><span class="g-pill p-mut">${c.students.length} o'quvchi</span>
      ${paid ? (c.packs || []).map((p) => `<span class="g-pill p-mut">${e(p.name)} — ${som(p.sum)}</span>`).join("") : ""}</div></div>
      <button class="g-btn" type="button" data-set>Guruh sozlamalari</button></div>
    <div class="g-row"><div class="g-tabs" role="tablist">${tabs.map(([k, t]) => `<button type="button" role="tab" aria-selected="${T.tab === k}" data-tab="${k}" class="${T.tab === k ? "on" : ""}">${t}</button>`).join("")}</div>
      ${T.tab === "att" && c.students.length ? `<span class="g-sp"></span><div class="g-seg" role="group" aria-label="Ko'rinish"><button type="button" data-av="day" class="${T.av !== "grid" ? "on" : ""}">Kun</button><button type="button" data-av="grid" class="${T.av === "grid" ? "on" : ""}">Oy jadvali</button></div>` : ""}</div>
    ${T.tab === "att" ? attHtml(c) : T.tab === "stu" ? stuHtml(c) : T.tab === "top" ? TPTM.tabHtml(c) : payHtml(c)}`;
  }
  // o'quvchi guruhda qaysi kundan bor: qo'shilgan sana (s.joined) yoki birinchi kelgan kuni — qaysi biri oldin bo'lsa
  const since = (s) => { const f = Object.keys(s.marks || {}).filter((d) => s.marks[d] === "ot").sort()[0] || "", j = /^\d{4}-\d\d-\d\d$/.test(String(s.joined || "")) ? s.joined : ""; return j && f ? (f < j ? f : j) : j || f; };
  const inG = (s, d) => { const x = since(s); return !x || d >= x; };
  const actOn = (c, d) => c.students.filter((s) => inG(s, d));
  // kun bo'yicha nechta o'quvchi kelgan
  const cntOn = (c, d) => c.students.filter((s) => (s.marks || {})[d] === "ot").length;
  const monthDays = (mo) => { const f = pd(mo + "-01"), n = new Date(f.getFullYear(), f.getMonth() + 1, 0).getDate(); return Array.from({length: n}, (_, i) => `${mo}-${String(i + 1).padStart(2, "0")}`); };
  const shiftM = (mo, k) => { const f = pd(mo + "-01"); return iso(new Date(f.getFullYear(), f.getMonth() + k, 1)).slice(0, 7); };
  // oxirgi n ta dars kuni (bugun ham, dars kuni bo'lsa)
  function lastLessons(c, n) { const o = [], ds = daysOf(c); if (!ds.length) return o; const x = pd(today()); for (let i = 0; i < 120 && o.length < n; i++) { if (ds.includes(x.getDay())) o.push(iso(x)); x.setDate(x.getDate() - 1); } return o; }
  // guruh ochilganda: bugun dars kuni bo'lmasa — oxirgi dars kuni
  const startDay = (c) => { const t = today(); return !daysOf(c).length || isLesson(c, t) ? t : lastLessons(c, 1)[0] || t; };
  const mnav = (mo) => `<button class="g-btn sm ghost" type="button" data-mo="-1" aria-label="Oldingi oy">‹</button><button class="g-btn sm ghost" type="button" data-mo="1" aria-label="Keyingi oy" ${shiftM(mo, 1) > today().slice(0, 7) ? "disabled" : ""}>›</button>`;
  function attHtml(c) {
    if (!c.students.length) return `<div class="g-card g-empty"><h2>Guruhda hali o'quvchi yo'q</h2><button class="g-btn pri" type="button" data-addst>＋ O'quvchi qo'shish</button></div>`;
    if (!T.mo) T.mo = T.day.slice(0, 7);
    return T.av === "grid" ? gridHtml(c) : dayHtml(c);
  }
  // Kun: oylik kalendar + tanlangan kun ro'yxati
  function dayHtml(c) {
    const d = T.day, t = today(), n = cntOn(c, d), mo = T.mo, ds = daysOf(c), f = pd(mo + "-01"), off = (f.getDay() + 6) % 7;
    let cal = [1, 2, 3, 4, 5, 6, 0].map((w) => `<span class="h ${ds.includes(w) ? "ls" : ""}">${WDS[w]}</span>`).join("");
    for (let i = 0; i < off; i++) cal += "<span></span>";
    for (const x of monthDays(mo)) {
      const k = cntOn(c, x), fut = x > t, l = isLesson(c, x), na = actOn(c, x).length;
      const cls = ["g-dc", l ? "les" : "", x === t ? "today" : "", fut ? "fut" : "", x === d ? "sel" : "", !fut && l && k ? "done" : "", !fut && l && !k && na && x !== t ? "miss" : ""].join(" ");
      cal += `<button type="button" class="${cls}" ${fut ? "disabled" : ""} data-pick="${x}" aria-pressed="${x === d}" aria-label="${dm(x)}${k ? `, ${k} kishi keldi` : ""}"><b class="g-num">${+x.slice(8, 10)}</b><i class="g-num">${k ? k + "/" + na : ""}</i></button>`;
    }
    const miss = lastLessons(c, 4).filter((x) => x !== t && !cntOn(c, x) && actOn(c, x).length), act = c.students.map((s, si) => ({s, si})).filter(({s}) => inG(s, d));
    return `<div class="g-dayv">
      <div class="g-card"><div class="g-mh"><h2>${MN[+mo.slice(5) - 1]} ${mo.slice(0, 4)}</h2>${mnav(mo)}</div>
        <div class="g-mcal">${cal}</div>
        <div class="g-legend" style="margin-top:10px"><span><i style="background:var(--g-soft)"></i>dars kuni</span><span><i style="background:var(--g-ok);border-radius:50%;width:8px;height:8px"></i>yo'qlama qilingan</span><span><i style="background:var(--g-warn);border-radius:50%;width:8px;height:8px"></i>dars bo'lgan, belgilanmagan</span></div></div>
      <div class="g-card g-dlist"><div class="g-daybar"><span class="g-d">${d === t ? "Bugun, " : ""}${dm(d)}, ${WL[wdOf(d)]}</span>
        <span class="g-pill ${n ? "p-ok" : "p-mut"} g-num">Keldi: ${n} / ${act.length}</span>
        ${act.length ? `<button class="g-btn sm" type="button" data-all>Hammasi keldi</button>` : ""}</div>
        ${TPTM.dayStrip(c, d)}
        ${isLesson(c, d) || !ds.length ? "" : `<div class="g-note warn"><b>Bu kun jadvalda dars yo'q.</b> Belgilasangiz — qo'shimcha dars sifatida hisoblanadi.</div>`}
        ${act.length ? "" : `<div class="g-muted">Bu kunda guruhda hali o'quvchi bo'lmagan. O'quvchilar guruhga qo'shilgan kunidan boshlab ko'rinadi.</div>`}
        <div class="g-att">${act.map(({s, si}) => {
          const on = (s.marks || {})[d] === "ot";
          return `<button class="g-who ${on ? "on" : ""}" type="button" data-came="${si}" aria-pressed="${on}"><span class="g-box">✓</span>
            <span class="g-nm"><b>${e(s.name)}</b><span>${c.kind === "paid" ? subTxt(c, s) : came(s).length + " marta kelgan"}</span></span></button>`;
        }).join("")}</div>
        ${act.length < c.students.length ? `<span class="g-muted" style="font-size:12.5px">${c.students.length - act.length} o'quvchi bu kundan keyin qo'shilgan — ro'yxatda yo'q.</span>` : ""}
        ${miss.length ? `<div class="g-row" style="gap:6px"><span class="g-muted" style="font-size:12.5px">Belgilanmagan darslar:</span>${miss.map((x) => `<button class="g-btn sm" type="button" data-pick="${x}">${dm(x)}</button>`).join("")}</div>` : ""}</div></div>`;
  }
  // Oy jadvali: o'quvchilar × dars kunlari (+ kimdir kelgan qo'shimcha kunlar)
  function gridHtml(c) {
    const t = today(), mo = T.mo, paid = c.kind === "paid";
    const days = monthDays(mo).filter((x) => x <= t && (isLesson(c, x) || cntOn(c, x) || !daysOf(c).length) && actOn(c, x).length);
    return `<div class="g-card" style="padding:12px 16px;display:flex;flex-direction:column;gap:4px"><div class="g-mh" style="margin:0"><h2>${MN[+mo.slice(5) - 1]} ${mo.slice(0, 4)} — oylik jadval</h2>${mnav(mo)}</div>
      <span class="g-muted" style="font-size:13px;line-height:1.4">Har bir katak — bitta dars kuni. Bosish: keldi, yana bosish: bekor. Sariq sarlavha — jadvaldan tashqari qo'shimcha dars. «·» — o'quvchi hali guruhga qo'shilmagan.</span></div>
    ${days.length ? `<div class="g-tw"><table class="g-mtab"><thead><tr><th class="nm">O'quvchi</th>${days.map((x) => `<th class="${isLesson(c, x) ? "" : "ex"} ${x === t ? "td" : ""}" ${TPTM.has(c) ? `title="${e(TPTM.topicOf(c, x))}"` : ""}>${WDS[wdOf(x)]}<b class="g-num">${+x.slice(8, 10)}</b></th>`).join("")}<th class="r">Oyda</th>${paid ? `<th class="r">Qoldiq</th>` : ""}</tr></thead>
      <tbody>${c.students.map((s, si) => {
        const a = paid ? acct(c, s) : null;
        return `<tr><td class="nm">${e(s.name)}</td>${days.map((x) => { const on = (s.marks || {})[x] === "ot"; if (!inG(s, x)) return `<td><span class="g-pre" title="${e(s.name)} ${dm(since(s))} dan guruhda">·</span></td>`; return `<td><button type="button" class="g-cell ${on ? "on" : ""}" data-cell="${si}|${x}" aria-pressed="${on}" aria-label="${e(s.name)}, ${dm(x)}"><span>✓</span></button></td>`; }).join("")}
          <td class="r g-num"><b>${days.filter((x) => (s.marks || {})[x] === "ot").length}</b></td>${paid ? `<td class="r g-num"><b style="color:${!a.k ? "var(--g-muted)" : a.left < 0 ? "var(--g-bad)" : a.left <= 1 ? "var(--g-warn)" : "var(--g-ok)"}">${a.k ? (a.left > 0 ? "+" : "") + a.left : "—"}</b></td>` : ""}</tr>`;
      }).join("")}</tbody>
      <tfoot><tr><td class="nm">Keldi</td>${days.map((x) => `<td class="g-num">${cntOn(c, x)}/${actOn(c, x).length}</td>`).join("")}<td></td>${paid ? "<td></td>" : ""}</tr></tfoot></table></div>` : `<div class="g-card g-muted">Bu oyda guruhda o'quvchi bo'lgan dars kuni yo'q.</div>`}
    <div><button class="g-btn sm" type="button" data-av="day">＋ Qo'shimcha dars kuni (kalendardan)</button></div>`;
  }
  function stuHtml(c) {
    const paid = c.kind === "paid", mo = today().slice(0, 7);
    let list = c.students.map((s, si) => ({s, si}));
    if (paid && T.flt === "due") list = list.filter(({s}) => acct(c, s).due);
    return `<div class="g-row">
      ${paid ? `<div class="g-seg"><button type="button" data-flt="all" class="${T.flt === "all" ? "on" : ""}">Hammasi</button><button type="button" data-flt="due" class="${T.flt === "due" ? "on" : ""}">To'lashi kerak</button></div>` : ""}
      <span class="g-sp"></span><button class="g-btn" type="button" data-addst>＋ O'quvchi qo'shish</button></div>
    <div class="g-slist">${list.map(({s, si}) => {
      const a = paid ? acct(c, s) : null;
      return `<div class="g-srow">
        <button class="g-nmb" type="button" data-open="${si}"><span class="g-av" style="${avs(s.name)}">${e(ini(s.name))}</span><span style="min-width:0"><b>${e(s.name)}</b><small>${paid ? (a.k ? e(a.k.name) + " paketi" : "paket yo'q") : "a'zo"}</small></span></button>
        <div class="g-prog">${paid && a.k ? `<div class="g-lab"><span>Joriy paket</span><span class="g-num">${inPack(a).used} / ${a.k.n}</span></div>${dots(a)}` : `<div class="g-lab"><span>${MN[+mo.slice(5) - 1]}da kelgan</span><span class="g-num">${came(s).filter((d) => d.startsWith(mo)).length} kun</span></div>`}</div>
        <div class="g-st">${statusPill(c, s)}</div>
        <div class="g-act">${paid ? `<button class="g-btn sm ${a.due ? "pri" : ""}" type="button" data-payfor="${si}">To'lov</button>` : `<button class="g-btn sm" type="button" data-open="${si}">Ochish</button>`}</div></div>`;
    }).join("") || `<div class="g-card g-muted">${c.students.length ? "Hamma to'lagan. Qarzdor yo'q." : "Guruhda hali o'quvchi yo'q."}</div>`}</div>
    ${paid && c.students.length ? `<div class="g-legend"><span><i style="background:var(--g-acc)"></i>kelgan dars</span><span><i style="background:var(--g-soft);border:1px solid var(--g-line)"></i>to'langan, hali kelmagan</span><span><i style="background:var(--g-bad)"></i>to'lanmay kelgan (qarz)</span></div>` : ""}`;
  }
  function payHtml(c) {
    const rows = c.students.flatMap((s, si) => (s.pays || []).map((p) => ({s, si, p}))).sort((a, b) => String(b.p.d).localeCompare(String(a.p.d)));
    const tot = rows.reduce((a, r) => a + (+r.p.sum || 0), 0);
    return `<div class="g-row"><span class="g-muted">${rows.length ? `${rows.length} ta to'lov` : "Hali to'lov yo'q"}</span><span class="g-sp"></span>${c.students.length ? `<button class="g-btn pri" type="button" data-payfor="-1">＋ To'lov qabul qilish</button>` : ""}</div>
    ${rows.length ? `<div class="g-tw"><table>
      <thead><tr><th>Sana</th><th>O'quvchi</th><th>Nima uchun</th><th>Usul</th><th class="r">Summa</th><th>№</th></tr></thead>
      <tbody>${rows.map(({s, si, p}) => `<tr><td class="g-num">${p.d ? dm(p.d) : "—"}</td><td><button class="g-btn sm ghost" type="button" data-open="${si}">${e(s.name)}</button></td><td>${payLessons(c, s, p)} dars</td><td>${e(p.how || "—")}</td><td class="r g-num">${som(p.sum)}</td><td class="g-num g-muted">${e(p.no || "")}</td></tr>`).join("")}</tbody>
      <tfoot><tr><td colspan="4">Jami</td><td class="r g-num">${som(tot)}</td><td></td></tr></tfoot></table></div>` : ""}`;
  }

  /* ── oynalar ── */
  let layer = null;
  function closeLayer() { if (layer) { layer.remove(); layer = null; } document.removeEventListener("keydown", onEsc, true); }
  function onEsc(ev) { if (ev.key === "Escape" && layer) { ev.preventDefault(); ev.stopPropagation(); closeLayer(); } }
  function openLayer(html, mid, bind) {
    closeLayer();
    const wrap = document.createElement("div");
    wrap.className = "tpt g-shade" + (mid ? " mid" : ""); wrap.innerHTML = html;
    wrap.addEventListener("click", (ev) => { if (ev.target === wrap) closeLayer(); });
    document.body.append(wrap); layer = wrap;
    document.addEventListener("keydown", onEsc, true);
    qa("[data-x]", wrap).forEach((b) => b.onclick = closeLayer);
    bind && bind(wrap);
    const f = q("[autofocus]", wrap); if (f) f.focus();
  }
  const hdr = (t) => `<div class="g-row" style="flex-wrap:nowrap"><h2 style="flex:1">${t}</h2><button class="g-btn sm ghost" type="button" data-x aria-label="Yopish">✕</button></div>`;
  function confirmG(title, text, yes, fn) {
    openLayer(`<div class="g-dlg" role="dialog" aria-modal="true">${hdr(e(title))}<div>${e(text)}</div>
      <div class="g-foot2"><button class="g-btn" type="button" data-x>Bekor qilish</button><button class="g-btn pri" type="button" data-yes>${e(yes)}</button></div></div>`, true,
      (w) => { q("[data-yes]", w).onclick = () => { closeLayer(); fn(); }; });
  }

  // kun tanlash — o'z kalendarimiz (brauzerning sana oynasiga bog'liq emas): o'tgan kunlar bosiladi, kelajak — yo'q
  // o = {title, cur, mo, c (dars kunlari va kelganlar soni uchun), pick(d), back()}
  function dayPicker(o) {
    const t = today(), mo = o.mo || (o.cur || t).slice(0, 7), first = pd(mo + "-01"), off = (first.getDay() + 6) % 7, dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const prevM = iso(new Date(first.getFullYear(), first.getMonth() - 1, 1)).slice(0, 7), nextM = iso(new Date(first.getFullYear(), first.getMonth() + 1, 1)).slice(0, 7);
    const c = o.c;
    let cal = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"].map((x) => `<span class="h">${x}</span>`).join("");
    for (let i = 0; i < off; i++) cal += "<span></span>";
    for (let i = 1; i <= dim; i++) {
      const d = `${mo}-${String(i).padStart(2, "0")}`, k = c ? c.students.filter((s) => (s.marks || {})[d] === "ot").length : 0;
      const cls = d === o.cur ? "s" : k ? "c" : c && isLesson(c, d) && d <= t ? "l" : "";
      cal += d <= t || o.future ? `<button type="button" class="${cls} g-num" data-day="${d}" aria-label="${dm(d)}${k ? `, ${k} kishi kelgan` : ""}">${i}</button>` : `<span class="g-num g-fut">${i}</span>`;
    }
    const back = () => { if (o.back) o.back(); else closeLayer(); };
    openLayer(`<div class="g-dlg" role="dialog" aria-modal="true" aria-label="${e(o.title)}">${hdr(e(o.title))}
      <div class="g-row" style="flex-wrap:nowrap"><h3 style="flex:1">${MN[+mo.slice(5) - 1]} ${mo.slice(0, 4)}</h3>
        <span class="g-mnav"><button class="g-btn sm ghost" type="button" data-m="${prevM}" aria-label="Oldingi oy">‹</button><button class="g-btn sm ghost" type="button" data-m="${nextM}" aria-label="Keyingi oy" ${nextM > t.slice(0, 7) && !o.future ? "disabled" : ""}>›</button></span></div>
      <div class="g-cal">${cal}</div>
      ${c ? `<div class="g-legend"><span><i style="background:var(--g-ok)"></i>kimdir kelgan</span><span><i style="background:var(--g-soft)"></i>dars kuni</span></div>` : ""}
      <div class="g-foot2"><button class="g-btn" type="button" data-back>Bekor qilish</button><button class="g-btn" type="button" data-day="${t}">Bugun</button></div></div>`, true, (w) => {
      qa("[data-x],[data-back]", w).forEach((b) => b.onclick = back);
      qa("[data-m]", w).forEach((b) => b.onclick = () => dayPicker(Object.assign({}, o, {mo: b.dataset.m})));
      qa("[data-day]", w).forEach((b) => b.onclick = () => { closeLayer(); o.pick(b.dataset.day); });
    });
  }

  // o'quvchi oynasi
  function studentCard(si, month) {
    const c = G(), s = c.students[si]; if (!s) return;
    const paid = c.kind === "paid", a = paid ? acct(c, s) : null, t = today();
    const mo = month || t.slice(0, 7), first = pd(mo + "-01"), off = (first.getDay() + 6) % 7, dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    let cal = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"].map((x) => `<span class="h">${x}</span>`).join("");
    for (let i = 0; i < off; i++) cal += "<span></span>";
    for (let i = 1; i <= dim; i++) { const d = `${mo}-${String(i).padStart(2, "0")}`, on = (s.marks || {})[d] === "ot", pre = !inG(s, d), cls = on ? "c" : pre ? "g-fut" : isLesson(c, d) && d <= t ? "l" : "";
      // o'tgan kunlar — bosiladi: keldi / bekor (tezkor yo'qlama); guruhga qo'shilishdan oldingi kunlar — xira
      cal += d <= t && !pre ? `<button type="button" class="${cls} g-num" data-cd="${d}" aria-pressed="${on}" aria-label="${dm(d)}${on ? " — keldi" : ""}">${i}</button>` : `<span class="${cls} g-num">${i}</span>`; }
    let big = "";
    if (paid) {
      if (!a.k) big = `<span class="g-pill p-mut">Paket tanlanmagan</span><span class="g-muted">«Ma'lumotni tahrirlash» orqali paket tanlang</span>`;
      else if (a.left < 0) big = `<span class="g-pill p-bad">Qarz</span><strong class="g-num" style="color:var(--g-bad)">${som(a.money)}</strong><span class="g-muted">${-a.left} dars to'lanmasdan o'tilgan · 1 dars = ${som(a.one)}</span>`;
      else if (a.left === 0) big = `<span class="g-pill p-warn">To'lov vaqti</span><strong>0 dars qoldi</strong><span class="g-muted">Keyingi darsdan oldin to'lash kerak</span>`;
      else big = `<span class="g-pill ${a.left <= 1 ? "p-warn" : "p-ok"}">Oldindan to'langan</span><strong class="g-num">${a.left} dars qoldi</strong><span class="g-muted">≈ ${som(a.money)} oldindan to'langan</span>`;
    }
    const ph = s.par && s.par.phone ? s.par.phone : "";
    const prevM = iso(new Date(first.getFullYear(), first.getMonth() - 1, 1)).slice(0, 7), nextM = iso(new Date(first.getFullYear(), first.getMonth() + 1, 1)).slice(0, 7);
    openLayer(`<aside class="g-drawer" role="dialog" aria-modal="true" aria-label="${e(s.name)}">
      <div class="g-row" style="flex-wrap:nowrap"><span class="g-av" style="width:44px;height:44px;${avs(s.name)}">${e(ini(s.name))}</span><div style="flex:1;min-width:0"><h2>${e(s.name)}</h2><span class="g-muted">${e(c.name)}${ph ? " · ota-ona: " + (typeof fmtPhone === "function" ? fmtPhone(ph) : e(ph)) : ""}</span></div><button class="g-btn sm ghost" type="button" data-x aria-label="Yopish">✕</button></div>
      ${paid ? `<div class="g-card g-big">${big}</div>
      ${a.k ? `<div class="g-card" style="display:flex;flex-direction:column;gap:8px"><div class="g-row"><h3 style="flex:1">Hisob</h3><span class="g-muted">${e(a.k.name)} · ${som(a.k.sum)}</span></div>
        <div class="g-kv g-num"><span>Sotib olingan darslar</span><b>${a.bought}</b></div>
        <div class="g-kv g-num"><span>Kelgan kunlar</span><b>− ${a.used}</b></div>
        <div class="g-kv tot g-num"><span>Qoldiq</span><b style="color:${a.left < 0 ? "var(--g-bad)" : "var(--g-ok)"}">${a.left > 0 ? "+" : ""}${a.left} dars</b></div></div>` : ""}
      <div class="g-row"><button class="g-btn pri" type="button" data-pay style="flex:1">To'lov qabul qilish</button><button class="g-btn" type="button" data-remind>Ota-onaga eslatma</button></div>` : ""}
      <div class="g-card" style="display:flex;flex-direction:column;gap:10px"><div class="g-row" style="flex-wrap:nowrap"><h3 style="flex:1">${MN[+mo.slice(5) - 1]}: kelgan kunlar</h3>
        <span class="g-mnav"><button class="g-btn sm ghost" type="button" data-m="${prevM}" aria-label="Oldingi oy">‹</button><span class="g-pill p-ok g-num">${came(s).filter((d) => d.startsWith(mo)).length} kun</span><button class="g-btn sm ghost" type="button" data-m="${nextM}" aria-label="Keyingi oy" ${nextM > t.slice(0, 7) ? "disabled" : ""}>›</button></span></div>
        <div class="g-cal">${cal}</div>
        <div class="g-legend"><span><i style="background:var(--g-ok)"></i>keldi</span><span><i style="background:var(--g-soft)"></i>dars bo'lgan, kelmagan</span><span>kunni bosing — keldi / bekor</span></div></div>
      ${paid ? `<div class="g-card" style="display:flex;flex-direction:column;gap:8px"><h3>To'lovlar</h3>${(s.pays || []).length ? s.pays.slice().sort((x, y) => String(y.d).localeCompare(String(x.d))).map((p) => `<div class="g-kv g-num"><span>${p.d ? dm(p.d) : "—"}${p.how ? " · " + e(p.how) : ""}</span><span>${payLessons(c, s, p)} dars · <b>${som(p.sum)}</b> <button class="g-btn sm ghost" type="button" data-pdel="${e(p.id)}" aria-label="To'lovni o'chirish" title="O'chirish">✕</button></span></div>`).join("") : `<span class="g-muted">Hali to'lov yo'q</span>`}</div>` : ""}
      <div class="g-row"><button class="g-btn sm" type="button" data-edit>Ma'lumotni tahrirlash</button><span class="g-sp"></span><button class="g-btn sm dang" type="button" data-off>Guruhdan chiqarish</button></div>
    </aside>`, false, (w) => {
      const pb = q("[data-pay]", w); if (pb) pb.onclick = () => payDialog(si);
      qa("[data-m]", w).forEach((b) => b.onclick = () => studentCard(si, b.dataset.m));
      qa("[data-cd]", w).forEach((b) => b.onclick = () => { const d = b.dataset.cd; mark(c, s, d, (s.marks || {})[d] !== "ot"); save(); draw(); studentCard(si, mo); });
      const rm = q("[data-remind]", w); if (rm) rm.onclick = () => remind(c, s);
      q("[data-edit]", w).onclick = () => studentDialog(si);
      q("[data-off]", w).onclick = () => confirmG("Guruhdan chiqarish", `${s.name} guruhdan chiqariladi. Kelgan kunlari va to'lovlari saqlanib qoladi.`, "Chiqarish", () => {
        const i = c.students.indexOf(s); if (i < 0) return;
        c.students.splice(i, 1); s.off_at = today(); (c.students_off = c.students_off || []).push(s);
        save(); draw(); toast(`${s.name} guruhdan chiqarildi`);
      });
      qa("[data-pdel]", w).forEach((b) => b.onclick = () => {
        const p = s.pays.find((x) => x.id === b.dataset.pdel); if (!p) return;
        confirmG("To'lovni o'chirish", `${p.d ? dm(p.d) : ""} · ${som(p.sum)} to'lov o'chiriladi.`, "O'chirish", () => {
          s.pays.splice(s.pays.indexOf(p), 1); save(); draw(); studentCard(si, mo); toast("To'lov o'chirildi");
        });
      });
    });
  }
  function remind(c, s) {
    const a = acct(c, s);
    const txt = `Assalomu alaykum! «${c.name}» guruhi: ${s.name}${a.k ? ` — ${a.k.name} paketi` : ""}. ${a.left < 0 ? `${-a.left} dars to'lanmagan, qarz ${som(a.money)}.` : a.left === 0 ? "To'langan darslar tugadi, keyingi paket uchun to'lov qilishingizni so'raymiz." : `${a.left} dars qoldi.`} Rahmat!`;
    const done = () => toast("Eslatma matni nusxalandi — Telegram yoki SMS ga qo'ying");
    try { navigator.clipboard.writeText(txt).then(done, () => toast(txt)); } catch (err) { toast(txt); }
  }

  // to'lov oynasi
  function payDialog(si0) {
    const c = G(); if (!c.students.length) return;
    if (!(c.packs || []).length) { toast("Avval «Guruh sozlamalari»da paket qo'shing"); return setDialog(false); }
    const s0 = c.students[si0 < 0 ? 0 : si0];
    const P = {si: si0 < 0 ? 0 : si0, pk: (pkgOf(c, s0) || c.packs[0]).id, sum: (pkgOf(c, s0) || c.packs[0]).sum, how: "Naqd", dmode: "t", dd: ""};
    const t = today(), y = iso(new Date(pd(t).getFullYear(), pd(t).getMonth(), pd(t).getDate() - 1));
    const draw2 = () => {
      const s = c.students[P.si], a = acct(c, s), k = c.packs.find((x) => x.id === P.pk) || c.packs[0];
      const one = k.n ? k.sum / k.n : 0, lessons = one > 0 ? Math.floor(P.sum / one + 1e-9) : 0;
      // boshqa paketga o'tsa, qoldiq yangi paket narxida hisoblanadi
      const cur = s.pkg === k.id ? a.left : a.left, after = cur + lessons;
      openLayer(`<div class="g-dlg" role="dialog" aria-modal="true" aria-label="To'lov qabul qilish">${hdr("To'lov qabul qilish")}
        <div class="g-fld"><label for="g-ps">O'quvchi</label><select id="g-ps" class="g-inp">${c.students.map((x, i) => `<option value="${i}" ${i === P.si ? "selected" : ""}>${e(x.name)}</option>`).join("")}</select></div>
        <div class="g-fld"><span class="g-lbl">Paket</span><div class="g-chips eq">${c.packs.map((x) => `<button type="button" class="g-chip ${x.id === k.id ? "on" : ""}" data-pk="${e(x.id)}">${e(x.name)}<small>${som(x.sum)} · 1 dars ${som(x.n ? x.sum / x.n : 0)}</small></button>`).join("")}</div></div>
        <div class="g-fld"><label for="g-pm">Summa, so'm</label><input id="g-pm" class="g-inp g-num" inputmode="numeric" value="${sp3(P.sum)}"></div>
        <div class="g-fld"><span class="g-lbl">Sana</span><div class="g-chips eq3">
          <button type="button" class="g-chip ${P.dmode === "t" ? "on" : ""}" data-dm="t">Bugun<small>${dm(t)}</small></button>
          <button type="button" class="g-chip ${P.dmode === "y" ? "on" : ""}" data-dm="y">Kecha<small>${dm(y)}</small></button>
          <button type="button" class="g-chip ${P.dmode === "o" ? "on" : ""}" id="g-pd">${P.dmode === "o" && P.dd ? dm(P.dd) : "Boshqa kun"}<small>kalendardan</small></button></div></div>
        <div class="g-fld"><span class="g-lbl">Usul</span><div class="g-chips eq4">${HOW.map((h) => `<button type="button" class="g-chip ${P.how === h ? "on" : ""}" data-how="${h}">${h}</button>`).join("")}</div></div>
        <div class="g-after">${a.k || s.pkg !== k.id ? `Hozir: <b>${a.left < 0 ? "qarz " + (-a.left) + " dars" : a.left + " dars qoldi"}</b> → to'lovdan keyin: <b style="color:${after < 0 ? "var(--g-bad)" : "var(--g-ok)"}">${after < 0 ? "qarz " + (-after) + " dars" : after + " dars qoladi"}</b><br>` : ""}
          <span class="g-muted">${som(P.sum)} = ${lessons} dars${one > 0 && P.sum - lessons * one > 0.5 ? ` (${som(P.sum - lessons * one)} darsga yetmaydi)` : ""}</span></div>
        <div class="g-foot2"><button class="g-btn" type="button" data-x>Bekor qilish</button><button class="g-btn pri" type="button" data-save>Saqlash</button></div></div>`, true, (w) => {
        q("#g-ps", w).onchange = (ev) => { P.si = +ev.target.value; const kk = pkgOf(c, c.students[P.si]) || c.packs[0]; P.pk = kk.id; P.sum = kk.sum; draw2(); };
        qa("[data-pk]", w).forEach((b) => b.onclick = () => { const kk = c.packs.find((x) => x.id === b.dataset.pk); P.pk = kk.id; P.sum = kk.sum; draw2(); });
        qa("[data-how]", w).forEach((b) => b.onclick = () => { P.how = b.dataset.how; draw2(); });
        qa("[data-dm]", w).forEach((b) => b.onclick = () => { P.dmode = b.dataset.dm; draw2(); });
        q("#g-pd", w).onclick = () => { const pm0 = q("#g-pm", w); P.sum = +pm0.value.replace(/\D/g, "") || 0; dayPicker({title: "To'lov sanasi", cur: P.dd || t, pick: (x) => { P.dmode = "o"; P.dd = x; draw2(); }, back: draw2}); };
        const pm = q("#g-pm", w); pm.onchange = () => { P.sum = +pm.value.replace(/\D/g, "") || 0; draw2(); };
        pm.oninput = () => { const v = pm.value.replace(/\D/g, ""); pm.value = v ? sp3(+v) : ""; };
        q("[data-save]", w).onclick = () => {
          P.sum = +pm.value.replace(/\D/g, "") || 0;
          if (!(P.sum > 0)) { toast("Summani yozing"); return; }
          const s2 = c.students[P.si], k2 = c.packs.find((x) => x.id === P.pk), one2 = k2.n ? k2.sum / k2.n : 0, pk = one2 > 0 ? Math.floor(P.sum / one2 + 1e-9) : 0;
          const d = P.dmode === "y" ? y : P.dmode === "o" && P.dd ? P.dd : t;
          // eski to'lovlarning dars soni avvalgi paket narxida qotiriladi, keyin paket almashtiriladi
          (s2.pays || []).forEach((p) => { if (!p.pk) p.pk = payLessons(c, s2, p) || undefined; });
          s2.pkg = k2.id; c.rc = (Math.trunc(+c.rc) || 0) + 1;
          (s2.pays = s2.pays || []).push({id: "p" + newSid(), no: c.rc, d, m: d.slice(0, 7), sum: P.sum, pk, how: P.how, note: ""});
          save(); closeLayer(); draw(); toast(`${s2.name}: ${som(P.sum)} yozildi (${pk} dars)`);
        };
      });
    };
    draw2();
  }

  // guruh sozlamalari / yangi guruh
  function setDialog(isNew) {
    const c0 = isNew ? null : G();
    const F = {name: c0 ? c0.name : "", kind: c0 ? c0.kind : "paid", days: c0 ? daysOf(c0).slice() : [1, 3, 5], time: c0 && timeOf(c0) ? timeOf(c0) : "15:00", dur: c0 && c0.gdur ? c0.gdur : 90,
      packs: c0 && c0.packs ? c0.packs.map((p) => Object.assign({}, p)) : [{id: "pk" + newSid(), name: "8 dars", n: 8, sum: 400000}]};
    const read = (w) => {
      F.name = q("#g-n", w).value; F.time = q("#g-t", w).value; F.dur = +q("#g-l", w).value;
      qa("[data-pki]", w).forEach((r) => { const p = F.packs[+r.dataset.pki]; if (!p) return; p.name = q(".pn", r).value; p.n = Math.trunc(+q(".pc", r).value.replace(/\D/g, "")) || 0; p.sum = +q(".ps", r).value.replace(/\D/g, "") || 0; });
    };
    const draw2 = () => openLayer(`<div class="g-dlg" role="dialog" aria-modal="true" aria-label="${isNew ? "Yangi guruh" : "Guruh sozlamalari"}">${hdr(isNew ? "Yangi guruh" : "Guruh sozlamalari")}
      <div class="g-fld"><label for="g-n">Nomi</label><input id="g-n" class="g-inp" value="${e(F.name)}" placeholder="Masalan: Ingliz tili A1" ${isNew ? "autofocus" : ""}></div>
      <div class="g-fld"><span class="g-lbl">Turi</span><div class="g-chips eq"><button type="button" class="g-chip ${F.kind === "paid" ? "on" : ""}" data-kind="paid">Pullik ta'lim<small>paket va to'lov bor</small></button><button type="button" class="g-chip ${F.kind === "club" ? "on" : ""}" data-kind="club">To'garak<small>bepul, faqat kelgan kunlar</small></button></div></div>
      <div class="g-fld"><span class="g-lbl">Dars kunlari</span><div class="g-chips wd">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<button type="button" class="g-chip ${F.days.includes(d) ? "on" : ""}" data-wd="${d}" aria-pressed="${F.days.includes(d)}">${WDS[d]}</button>`).join("")}</div></div>
      <div class="g-frow"><div class="g-fld"><label for="g-t">Dars vaqti</label><select id="g-t" class="g-inp g-num">${TIMES.concat(TIMES.includes(F.time) ? [] : [F.time]).map((x) => `<option ${x === F.time ? "selected" : ""}>${x}</option>`).join("")}</select></div>
        <div class="g-fld"><label for="g-l">Dars davomiyligi</label><select id="g-l" class="g-inp">${DURS.map((x) => `<option value="${x}" ${x === F.dur ? "selected" : ""}>${x} daqiqa</option>`).join("")}</select></div></div>
      ${F.kind === "paid" ? `<div class="g-fld"><span class="g-lbl">Paketlar (narxlar)</span>
        <div style="display:flex;flex-direction:column;gap:8px">${F.packs.map((p, i) => `<div class="g-pk" data-pki="${i}"><div class="g-pkh"><input class="g-inp pn" value="${e(p.name)}" placeholder="Masalan: 8 dars" aria-label="Paket nomi"><button class="g-btn sm ghost" type="button" aria-label="Paketni o'chirish" data-pdel="${i}">✕</button></div>
          <div class="g-frow"><div class="g-fld"><label>Darslar soni</label><input class="g-inp g-num pc" inputmode="numeric" value="${p.n || ""}"></div><div class="g-fld"><label>Narxi, so'm</label><input class="g-inp g-num ps" inputmode="numeric" value="${p.sum ? sp3(p.sum) : ""}"></div></div></div>`).join("")}
        <button class="g-btn" type="button" data-padd>＋ Paket qo'shish</button></div>
        <span class="g-muted" style="font-size:12.5px;line-height:1.4">Narxni o'zgartirsangiz, eski to'lovlar o'zgarmaydi — ular nechta dars sotib olingani bilan saqlangan.</span></div>` : ""}
      <div class="g-foot2"><button class="g-btn" type="button" data-x>Bekor qilish</button><button class="g-btn pri" type="button" data-save>Saqlash</button></div>
      ${isNew ? "" : `<button class="g-btn ghost dang" type="button" data-arch>${c0.garch ? "Arxivdan chiqarish" : "Guruhni arxivlash"}</button>`}</div>`, true, (w) => {
      qa("[data-kind]", w).forEach((b) => b.onclick = () => { read(w); F.kind = b.dataset.kind; draw2(); });
      qa("[data-wd]", w).forEach((b) => b.onclick = () => { const d = +b.dataset.wd, on = F.days.includes(d); F.days = on ? F.days.filter((x) => x !== d) : F.days.concat(d); b.classList.toggle("on", !on); b.setAttribute("aria-pressed", String(!on)); });
      qa("[data-pdel]", w).forEach((b) => b.onclick = () => { read(w); F.packs.splice(+b.dataset.pdel, 1); draw2(); });
      const pa = q("[data-padd]", w); if (pa) pa.onclick = () => { read(w); F.packs.push({id: "pk" + newSid(), name: "", n: 12, sum: 0}); draw2(); };
      qa(".ps", w).forEach((inp) => inp.oninput = () => { const v = inp.value.replace(/\D/g, ""); inp.value = v ? sp3(+v) : ""; });
      const ar = q("[data-arch]", w); if (ar) ar.onclick = () => { c0.garch = !c0.garch || undefined; if (!c0.garch) delete c0.garch; save(); closeLayer(); T.scr = "home"; T.arch = false; draw(); toast(c0.garch ? `«${c0.name}» arxivga olindi` : `«${c0.name}» arxivdan chiqarildi`); };
      q("[data-save]", w).onclick = () => {
        read(w);
        const name = F.name.trim(); if (!name) { toast("Guruh nomini yozing"); return; }
        if (D.classes.some((x) => x !== c0 && x.name === name && isG(x))) { toast("Bunday nomli guruh bor"); return; }
        const packs = F.packs.filter((p) => p.n > 0 && p.sum > 0).map((p) => ({id: p.id, name: p.name.trim() || `${p.n} dars`, n: Math.min(9999, p.n), sum: p.sum}));
        if (F.kind === "paid" && !packs.length) { toast("Kamida bitta paket kiriting: darslar soni va narxi"); return; }
        let c = c0;
        if (!c) { c = normalize({classes: [{name, subject: "", dates: [], students: []}]}).classes[0]; D.classes.push(c); }
        c.name = name; c.kind = F.kind; c.gdays = [...new Set(F.days)].sort(); c.gtime = F.time; c.gdur = F.dur;
        if (F.kind === "paid") c.packs = packs;
        save(); closeLayer();
        if (isNew) { T.gi = D.classes.indexOf(c); T.scr = "grp"; T.tab = "stu"; T.day = startDay(c); T.mo = T.day.slice(0, 7); }
        draw(); toast(isNew ? `«${name}» guruhi qo'shildi — endi o'quvchilarni qo'shing` : "Saqlandi");
      };
    });
    draw2();
  }

  // o'quvchi qo'shish / tahrirlash
  function studentDialog(si) {
    const c = G(), s0 = si == null ? null : c.students[si], paid = c.kind === "paid";
    const F = {pkg: s0 ? s0.pkg || "" : ((c.packs || [])[0] || {}).id || "", first: true, jn: s0 ? since(s0) || today() : today()};
    const draw2 = (keep) => openLayer(`<div class="g-dlg" role="dialog" aria-modal="true" aria-label="${s0 ? "Ma'lumotni tahrirlash" : "O'quvchi qo'shish"}">${hdr(s0 ? "Ma'lumotni tahrirlash" : "O'quvchi qo'shish")}
      <div class="g-fld"><label for="g-an">Ism familiya</label><input id="g-an" class="g-inp" value="${e(keep ? keep.name : s0 ? s0.name : "")}" placeholder="Masalan: Kamola Saidova" autofocus></div>
      <div class="g-fld"><label for="g-ap">Ota-ona telefoni (ixtiyoriy)</label><input id="g-ap" class="g-inp g-num" type="tel" value="${e(keep ? keep.phone : s0 && s0.par && s0.par.phone || "")}" placeholder="+998 __ ___ __ __"></div>
      <div class="g-fld"><span class="g-lbl">Guruhga qo'shilgan sana</span><button type="button" class="g-inp g-jn g-num" id="g-aj">${dm(F.jn)} ${F.jn.slice(0, 4)}</button></div>
      ${paid && (c.packs || []).length ? `<div class="g-fld"><span class="g-lbl">Paket</span><div class="g-chips eq">${c.packs.map((x) => `<button type="button" class="g-chip ${F.pkg === x.id ? "on" : ""}" data-pk="${e(x.id)}">${e(x.name)}<small>${som(x.sum)}</small></button>`).join("")}</div></div>
      ${s0 ? "" : `<label class="g-check"><input type="checkbox" id="g-af" ${F.first ? "checked" : ""}> Birinchi to'lovni hozir qabul qilish</label>`}` : ""}
      <div class="g-foot2"><button class="g-btn" type="button" data-x>Bekor qilish</button><button class="g-btn pri" type="button" data-save>${s0 ? "Saqlash" : "Qo'shish"}</button></div></div>`, true, (w) => {
      const cur = () => ({name: q("#g-an", w).value, phone: q("#g-ap", w).value});
      qa("[data-pk]", w).forEach((b) => b.onclick = () => { const af = q("#g-af", w); if (af) F.first = af.checked; F.pkg = b.dataset.pk; draw2(cur()); });
      q("#g-aj", w).onclick = () => { const af = q("#g-af", w); if (af) F.first = af.checked; const k = cur(); dayPicker({title: "Guruhga qo'shilgan sana", cur: F.jn, pick: (x) => { F.jn = x; draw2(k); }, back: () => draw2(k)}); };
      q("#g-an", w).onkeydown = (ev) => { if (ev.key === "Enter") q("[data-save]", w).click(); };
      q("[data-save]", w).onclick = () => {
        const name = q("#g-an", w).value.trim().replace(/\s+/g, " "); if (!name) { toast("Ismni yozing"); return; }
        if (c.students.some((x) => x !== s0 && x.name.toLowerCase() === name.toLowerCase())) { toast("Bu ism guruhda bor"); return; }
        let ph = q("#g-ap", w).value.replace(/\D/g, ""); if (ph.length === 9) ph = "998" + ph;
        if (ph && !/^\d{9,15}$/.test(ph)) { toast("Telefon raqami noto'g'ri"); return; }
        const s = s0 || {id: newSid(), name, marks: {}};
        s.name = name;
        // qo'shilgan sana; undan oldingi «keldi» belgilari bo'lsa — eng birinchisi hisoblanadi
        const f0 = Object.keys(s.marks || {}).filter((d) => s.marks[d] === "ot").sort()[0];
        if (f0 && f0 < F.jn) { toast(`${dm(f0)} da kelgan belgisi bor — sana ${dm(f0)} qilib saqlandi`); }
        s.joined = f0 && f0 < F.jn ? f0 : F.jn;
        if (ph) s.par = Object.assign({}, s.par, {phone: "+" + ph}); else if (s.par) { delete s.par.phone; if (!Object.keys(s.par).length) delete s.par; }
        if (paid && F.pkg) {
          // paket almashsa, eski to'lovlarning dars soni avvalgi narxda qotiriladi
          if (s.pkg !== F.pkg) (s.pays || []).forEach((p) => { if (!p.pk) p.pk = payLessons(c, s, p) || undefined; });
          s.pkg = F.pkg;
        }
        const af = q("#g-af", w), pay = !s0 && af && af.checked;
        if (!s0) c.students.push(s);
        save(); closeLayer(); draw();
        if (pay) payDialog(c.students.indexOf(s)); else { toast(s0 ? "Saqlandi" : `${name} qo'shildi`); if (s0) studentCard(si); }
      };
    });
    draw2();
  }

  // to'lov kutilayotganlar (hamma guruhlardan)
  function dueDialog() {
    const rows = groups().filter((x) => !x.c.garch && x.c.kind === "paid").flatMap(({c, ci}) => c.students.map((s, si) => ({c, ci, s, si})).filter((r) => acct(c, r.s).due));
    openLayer(`<div class="g-dlg" role="dialog" aria-modal="true" aria-label="To'lov kutilmoqda">${hdr("To'lov kutilmoqda")}
      ${rows.length ? rows.map((r) => `<div class="g-row" style="border-bottom:1px solid var(--g-line);padding-bottom:8px"><div style="flex:1;min-width:0"><b>${e(r.s.name)}</b><div class="g-muted" style="font-size:12.5px">${e(r.c.name)}</div></div>${statusPill(r.c, r.s)}<button class="g-btn sm" type="button" data-goto="${r.ci}|${r.si}">Ochish</button></div>`).join("") : `<div class="g-muted">Hamma to'lagan.</div>`}</div>`, true, (w) => {
      qa("[data-goto]", w).forEach((b) => b.onclick = () => { const [ci, si] = b.dataset.goto.split("|").map(Number); closeLayer(); openGroup(ci, "stu"); studentCard(si); });
    });
  }

  /* ── chizish va bog'lash ── */
  let root = null;
  function openGroup(ci, tab) { T.gi = ci; T.scr = "grp"; T.tab = tab || "att"; T.flt = "all"; T.day = startDay(D.classes[ci]); T.mo = T.day.slice(0, 7); if (prep(G())) save(); draw(); window.scrollTo(0, 0); }
  function draw() { if (root && root.isConnected) paint(root); }
  function paint(m) {
    if (T.scr === "grp" && !isG(G())) T.scr = "home";
    if (T.scr === "grp" && T.day > today()) T.day = today();
    m.innerHTML = `<div class="tpt">${T.scr === "home" ? homeHtml() : groupHtml()}</div>`;
    bind(m);
  }
  function bind(m) {
    qa("[data-g]", m).forEach((b) => b.onclick = () => openGroup(+b.dataset.g));
    qa("[data-home]", m).forEach((b) => b.onclick = () => { T.scr = "home"; draw(); window.scrollTo(0, 0); });
    qa("[data-new]", m).forEach((b) => b.onclick = () => setDialog(true));
    qa("[data-arch]", m).forEach((b) => b.onclick = () => { T.arch = b.dataset.arch === "1"; draw(); });
    const du = q("[data-due]", m); if (du) du.onclick = dueDialog;
    const st = q("[data-set]", m); if (st) st.onclick = () => setDialog(false);
    qa("[data-tab]", m).forEach((b) => b.onclick = () => { T.tab = b.dataset.tab; draw(); });
    qa("[data-flt]", m).forEach((b) => b.onclick = () => { T.flt = b.dataset.flt; draw(); });
    qa("[data-addst]", m).forEach((b) => b.onclick = () => studentDialog(null));
    qa("[data-open]", m).forEach((b) => b.onclick = () => studentCard(+b.dataset.open));
    qa("[data-payfor]", m).forEach((b) => b.onclick = () => payDialog(+b.dataset.payfor));
    qa("[data-pick]", m).forEach((b) => b.onclick = () => { T.day = b.dataset.pick; T.mo = T.day.slice(0, 7); draw(); });
    qa("[data-mo]", m).forEach((b) => b.onclick = () => { const x = shiftM(T.mo || today().slice(0, 7), +b.dataset.mo); if (x <= today().slice(0, 7)) { T.mo = x; draw(); } });
    qa("[data-av]", m).forEach((b) => b.onclick = () => { T.av = b.dataset.av; draw(); });
    qa("[data-cell]", m).forEach((b) => b.onclick = () => { const [si, d] = b.dataset.cell.split("|"), c = G(), s = c.students[+si]; if (!s) return; mark(c, s, d, (s.marks || {})[d] !== "ot"); save(); draw(); });
    qa("[data-came]", m).forEach((b) => b.onclick = () => { const c = G(), s = c.students[+b.dataset.came]; mark(c, s, T.day, s.marks[T.day] !== "ot"); save(); draw(); });
    if (T.scr === "grp" && isG(G())) TPTM.bind(m, G());
    const al = q("[data-all]", m); if (al) al.onclick = () => { const c = G(); actOn(c, T.day).forEach((s) => mark(c, s, T.day, true)); save(); draw(); toast("Hammasi keldi deb belgilandi"); };
  }
  function mark(c, s, d, on) {
    s.marks = s.marks || {};
    if (on) { s.marks[d] = "ot"; if (!c.dates.includes(d)) { c.dates.push(d); c.dates.sort(); } } else delete s.marks[d];
  }
  function page(m) {
    root = m;
    if (T.scr === "grp" && !isG(G())) T.scr = "home";
    if (!T.day) T.day = today();
    if (!T.mo) T.mo = T.day.slice(0, 7);
    paint(m);
  }
  // sahifadan chiqilganda ochiq oyna yopiladi
  function leave() { closeLayer(); }

  return {page, leave, acct, came, prep, payLessons, daysOf, groups, _state: T};
})();
