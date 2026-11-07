/* Sozlamalar → «Qo'shimcha funksiyalar» (Akmal tasdiqlagan maket v2.1, 2026-11-07) va 4 ta yangi funksiya.
   Bo'lim: xulosa (N / M yoqilgan) + 3 to'plam (Asosiy / Tanlovim / Hammasi, «Qaytarish» bilan), saralash, guruhlar joyiga qarab
   (Darsda, «Bugun», Jurnal, Sinf menyusi), har guruhda jonli namuna, butun qator — kalit (yagona .kalit ko'rinishi).
   Birlashtirilgan qatorlar: «Yo'qlama usullari» (Kartochka, Xarita), «Jurnal davrlari» (Hafta, Oy, Chorak).
   Olib tashlangan: Faollik belgilari (act) va Haftalik xulosa (week) — feat() ular uchun doim false, ma'lumot o'chmaydi.
   Yangi: Dars taymeri (timer), Navbatchi (duty), BSB/CHSB yaqinlashmoqda (bsbrem), Kelmaganlar ota-onasiga xabar (absmsg).
   Saqlash: D.web.off (eskisidek), navbatchi — D.web.duty = {"sinf|fan": {d: sana, i: o'quvchi tartibi}}.
   Bu fayl asosiy skriptdan OLDIN ulanadi; D, S, feat, save, render, esc, modal … faqat chaqirilganda ishlatiladi. */
const FNK = (() => {
  const P = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const IC = {
    call: P('<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>'),
    groups: P('<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><circle cx="17" cy="9" r="2.4"/><path d="M16.5 14.6c2.6.3 4.5 2.2 4.5 5.4"/>'),
    attm: P('<rect x="4" y="5" width="12" height="15" rx="2"/><path d="M8 3h10a2 2 0 0 1 2 2v13"/>'),
    hw: P('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M9.5 15l2 2 3.5-4"/>'),
    timer: P('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>'),
    duty: P('<circle cx="12" cy="7" r="3.5"/><path d="M5 21c0-3.9 3.1-7 7-7s7 3.1 7 7"/><path d="M15.5 14.5l1.5 3 3-1"/>'),
    bday: P('<path d="M4 21h16v-8H4z"/><path d="M4 16c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5"/><path d="M12 13V9"/>'),
    qend: P('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2.5h6V4M9 11h6M9 15h4"/>'),
    gaps: P('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>'),
    bsbrem: P('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>'),
    views: P('<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
    debts: P('<path d="M12 21s-6-4.5-6-10a6 6 0 0 1 12 0c0 5.5-6 10-6 10z"/><circle cx="12" cy="11" r="2"/>'),
    parents: P('<circle cx="8" cy="7" r="3"/><circle cx="17" cy="9" r="2"/><path d="M2.5 20c0-3.2 2.5-5.5 5.5-5.5s5.5 2.3 5.5 5.5M14.5 20c0-2.4 1.1-4.4 3-4.4s3 2 3 4.4"/>'),
    absmsg: P('<path d="M21 4L3 11l6 2 2 6z"/><path d="M9 13l12-9"/>'),
    ktr: P('<path d="M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z"/>'),
    lock: P('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>')};
  // [nomi, izoh, namunadagi yozuv, yangi?]
  const F = {
    call: ["Doskaga chaqirish", "Tasodifiy o'quvchi, adolatli rejim bilan", "Doskaga"],
    groups: ["Guruhlarga bo'lish", "Tasodifiy yoki teng kuchli guruhlar", "Guruhlar"],
    attmodes: ["Kartochka", "", "Kartochka"], seats: ["Xarita", "", "Xarita"],
    hw: ["Uy vazifasi tekshiruvi", "Har o'quvchiga «UV» belgisi", "UV"],
    timer: ["Dars taymeri", "Qolgan vaqt, 5 daqiqa qolganda ogohlantirish", "Taymer", 1],
    duty: ["Navbatchi", "Har kuni navbat bilan, kelmagan o'tkazib yuboriladi", "Navbatchi", 1],
    bday: ["Tug'ilgan kunlar", "Tabrik eslatmasi", "Tug'ilgan kun"],
    qend: ["Chorak yakuni eslatmasi", "2 hafta qolganda kamchiliklar", "Chorak yakuni"],
    gaps: ["To'ldirilmagan darslar", "Yo'qlama yoki mavzu kiritilmagan darslar", "To'ldirilmagan"],
    bsbrem: ["BSB/CHSB yaqinlashmoqda", "Summativ ishga 3 kun qolganda", "BSB yaqin", 1],
    vweek: ["Hafta", "", "Hafta"], vmonth: ["Oy", "", "Oy"], vquarter: ["Chorak", "", "Chorak"],
    debts: ["Qarzdorlar", "Past baho va topshirilmagan ishlar", "Qarzdorlar"],
    parents: ["Ota-onalar", "Kontaktlar va butun sinfga xabar", "Kontaktlar"],
    absmsg: ["Kelmaganlar ota-onasiga xabar", "Yo'qlamadan keyin tayyor matn, Telegram yoki SMS", "Kelmaganlarga xabar", 1],
    ktr: ["KTR", "Kalendar-tematik reja va bajarilishi", "KTR"]};
  const M = {attm: {n: "Yo'qlama usullari", d: "Ro'yxat doim bor; qo'shimcha usullar", ch: ["attmodes", "seats"], fix: "Ro'yxat"},
    views: {n: "Jurnal davrlari", d: "Kun doim bor; jurnal tepasidagi tugmalar", ch: ["vweek", "vmonth", "vquarter"], fix: "Kun"}};
  const GR = [["lesson", "Darsda", ["call", "groups", "attm", "hw", "timer", "duty"], "Dars tugmalari"],
    ["today", "«Bugun» sahifasi", ["bday", "qend", "gaps", "bsbrem"], "Kartochkalar"],
    ["journal", "Jurnal", ["views"], "Davr"],
    ["menu", "Sinf menyusi (⋯)", ["debts", "parents", "absmsg", "ktr"], "Menyuda"]];
  const GONE = new Set(["act", "week"]);
  const leaves = (r) => (M[r] ? M[r].ch : [r]);
  const ALL = GR.flatMap((g) => g[2].flatMap(leaves));
  const off = () => (D.web.off = D.web.off || {});
  const on = (k) => !off()[k];
  let flt = "all", fl = null;

  /* ───────── Sozlamalar bo'limi ───────── */
  const preset = () => { const o = ALL.filter((k) => !on(k)); return !o.length ? "all" : o.length === SIMPLE_OFF.length && SIMPLE_OFF.every((k) => !on(k)) ? "basic" : "mine"; };
  function preview(g, rows) {
    const L = rows.flatMap(leaves).filter(on);
    if (g === "journal") return `<span class="fn-mseg"><span class="on">Kun</span>${L.map((k) => `<span>${F[k][2]}</span>`).join("")}</span>`;
    return L.length ? L.map((k) => `<span class="fn-chip">${IC[k] || IC[k === "attmodes" || k === "seats" ? "attm" : "views"]}${F[k][2]}</span>`).join("") : `<span class="fn-none">Hech narsa qo'shilmaydi</span>`;
  }
  function row(r) {
    if (M[r]) { const m = M[r], any = m.ch.some(on);
      return `<div class="fn-row multi ${any ? "on" : "off"}" id="sz-ft${r}"><span class="fn-ic">${IC[r]}</span><span class="fn-tx"><b>${m.n}</b><small>${m.d}</small></span>
        <div class="fn-mch"><span class="fn-fix">✓ ${m.fix}</span>${m.ch.map((k) => `<button class="${on(k) ? "on" : ""} ${fl === "ft" + k ? "sz-flash" : ""}" id="sz-ft${k}" data-ft="${k}" role="switch" aria-checked="${on(k)}"><i aria-hidden="true">${on(k) ? "✓" : ""}</i>${F[k][0]}</button>`).join("")}</div></div>`; }
    const o = on(r);
    return `<button class="fn-row ${o ? "on" : "off"} ${fl === "ft" + r ? "sz-flash" : ""}" id="sz-ft${r}" data-ft="${r}" role="switch" aria-checked="${o}"><span class="fn-ic">${IC[r]}</span><span class="fn-tx"><b>${F[r][0]}${F[r][3] ? '<span class="fn-new">yangi</span>' : ""}</b><small>${F[r][1]}</small></span><span class="kalit ${o ? "on" : ""}" aria-hidden="true"></span></button>`;
  }
  function sec6(flash) {
    fl = flash; if (fl) flt = "all";
    const n = ALL.filter(on).length, pr = preset(), nNew = Object.values(F).filter((x) => x[3]).length;
    let h = `<section class="sz-sg fn-sum"><div class="fn-st"><b>${n} <small>/ ${ALL.length} yoqilgan</small></b><span>O'chirilsa ham ma'lumoti saqlanadi</span></div>
      <div class="fn-bar"><i style="width:${(100 * n) / ALL.length}%"></i></div>
      <div class="fn-pre" role="radiogroup" aria-label="Tayyor to'plamlar">
        <button class="${pr === "basic" ? "on" : ""}" data-fp="simple" role="radio" aria-checked="${pr === "basic"}"><b>Asosiy</b><small>${ALL.length - SIMPLE_OFF.length} ta, sodda</small></button>
        <button class="${pr === "mine" ? "on" : ""}" role="radio" aria-checked="${pr === "mine"}" ${pr === "mine" ? "" : "disabled"}><b>Tanlovim</b><small>${pr === "mine" ? n + " ta" : "o'zingiz tanlang"}</small></button>
        <button class="${pr === "all" ? "on" : ""}" data-fp="all" role="radio" aria-checked="${pr === "all"}"><b>Hammasi</b><small>${ALL.length} ta</small></button></div></section>
      <div class="fn-flt">${[["all", "Hammasi", ALL.length], ["on", "Yoqilgan", n], ["off", "O'chirilgan", ALL.length - n], ["new", "Yangi", nNew]].map(([k, t, c]) => `<button class="${flt === k ? "on" : ""}" data-fnf="${k}">${t}<em>${c}</em></button>`).join("")}</div>`;
    let shown = 0;
    for (const [g, t, rows, pl] of GR) {
      const vis = rows.filter((r) => { const L = leaves(r); return flt === "all" || (flt === "on" ? L.some(on) : flt === "off" ? L.some((k) => !on(k)) : L.some((k) => F[k][3])); });
      if (!vis.length) continue; shown += vis.length;
      const L = rows.flatMap(leaves), cnt = L.filter(on).length;
      h += `<section class="sz-sg fn-g"><div class="fn-gh"><h3 class="sz-sgt">${t}</h3><span class="fn-cnt">${cnt} / ${L.length}</span><span class="sp"></span><button class="fn-all" data-fng="${g}">${cnt === L.length ? "Hammasini o'chirish" : "Hammasini yoqish"}</button></div>
        <div class="sz-card fn-box"><div class="fn-prev" aria-label="Namuna: ${t}"><span class="fn-pl">${pl}</span>${preview(g, rows)}</div>${vis.map(row).join("")}</div></section>`;
    }
    if (!shown) h += `<div class="fn-empty">${flt === "off" ? "O'chirilgan funksiya yo'q, hammasi yoqilgan." : "Bu saralashda funksiya yo'q."}</div>`;
    h += `<div class="fn-core"><span>${IC.lock}Doim yoqilgan:</span><div><em>Yo'qlama</em><em>Baholar</em><em>BSB / CHSB</em><em>Hisobotlar</em><em>Sozlamalar</em></div></div>`;
    return {body: `<div class="fn-sec">${h}</div>`, acts: [], what: `${n} / ${ALL.length} ta yoqilgan`};
  }
  function bind(m) {
    const undoable = (msg, fn) => { const prev = JSON.stringify(off()); fn(); save(); render(); toast(msg, ["Qaytarish", () => { D.web.off = JSON.parse(prev); save(); render(); }]); };
    m.querySelectorAll(".fn-sec [data-ft]").forEach((b) => b.onclick = () => { const k = b.dataset.ft, o = off(); if (o[k]) delete o[k]; else o[k] = 1; save(); render(); });
    m.querySelectorAll(".fn-sec [data-fp]").forEach((b) => b.onclick = () => undoable(b.dataset.fp === "all" ? "Hamma funksiyalar yoqildi" : "Faqat asosiylari qoldi",
      () => { D.web.off = b.dataset.fp === "all" ? {} : Object.fromEntries(SIMPLE_OFF.map((k) => [k, 1])); }));
    m.querySelectorAll("[data-fng]").forEach((b) => b.onclick = () => { const L = GR.find((g) => g[0] === b.dataset.fng)[2].flatMap(leaves), all = L.every(on);
      undoable(all ? "Guruh o'chirildi" : "Guruh yoqildi", () => { const o = off(); L.forEach((k) => { if (all) o[k] = 1; else delete o[k]; }); }); });
    m.querySelectorAll("[data-fnf]").forEach((b) => b.onclick = () => { flt = b.dataset.fnf; render(); });
  }

  /* ───────── Navbatchi ───────── */
  const absentNow = (c, si) => ["s", "dq", "k"].includes(attOf(c, si));
  // bugungi navbatchi: har yangi kunda keyingi o'quvchi; kelmagan bo'lsa — undan keyingisi
  function duty(c, step = 0) {
    const n = c.students.length; if (!n || isGrp(c)) return null;
    const t = todayIso(), all = (D.web.duty = D.web.duty || {}), k = `${c.name}|${c.subject || ""}`, r = all[k];
    let i = r ? (r.d === t ? r.i : r.i + 1) : 0; i += step;
    for (let j = 0; j < n && absentNow(c, ((i % n) + n) % n); j++) i++;
    i = ((i % n) + n) % n;
    if (!r || r.d !== t || r.i !== i) all[k] = {d: t, i};   // keyingi saqlashda yoziladi (render paytida save() chaqirilmaydi)
    return c.students[i];
  }

  /* ───────── Dars taymeri ───────── */
  let tmI = null, warned = "";
  function lessonEnd(ci) {
    // jadvaldagi tugash vaqti faqat «SS:DD» ko'rinishida bo'lsa olinadi — buzuq qiymat taymerda «NaN:NaN» chiqarmasin
    const x = typeof schedToday === "function" ? schedToday().find((y) => y.ci === ci && /^\d{1,2}:\d{2}$/.test(y.to || "")) : null;
    if (x) { const [hh, mm] = x.to.split(":").map(Number), d = new Date(); d.setHours(hh, mm, 0, 0); return {end: d.getTime(), from: x.from, to: x.to}; }
    S.lesT0 = S.lesT0 && S.lesT0.ci === ci && S.lesT0.d === todayIso() ? S.lesT0 : {ci, d: todayIso(), t: Date.now()};
    return {end: S.lesT0.t + 45 * 60000};
  }
  const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
  function tick() {
    const el = document.querySelector("[data-fn-tm]"); if (!el) { clearInterval(tmI); tmI = null; return; }
    const left = +el.dataset.end - Date.now(), key = el.dataset.end;
    el.querySelector("b").textContent = left > 0 ? mmss(left) : "tugadi";
    el.classList.toggle("warn", left <= 5 * 60000);
    if (left <= 5 * 60000 && left > 0 && warned !== key) { warned = key; toast("⏳ Dars tugashiga 5 daqiqa qoldi — uy vazifasini aytishni unutmang"); }
  }

  /* ───────── dars sahifasidagi qator ───────── */
  function lessonBar(c, ci, t, absent) {
    const out = [];
    if (feat("timer")) { const e = lessonEnd(ci); out.push(`<span class="fn-tm" data-fn-tm data-end="${e.end}" title="${e.to ? `Dars ${e.from}–${e.to}` : "Dars jadvalida vaqt yo'q — darsni ochgan paytdan 45 daqiqa"}">⏳ <b>${mmss(e.end - Date.now())}</b> qoldi</span>`); }
    if (feat("duty") && !isGrp(c)) { const s = duty(c); if (s) out.push(`<span class="fn-duty">👤 Navbatchi: <b>${esc(s.name)}</b><button class="btn btn-sm" data-fn-duty title="Keyingi o'quvchi">Keyingisi</button></span>`); }
    if (feat("absmsg") && !isGrp(c) && absent) out.push(`<button class="btn btn-sm" data-fn-abs>✉ Kelmaganlarga xabar (${absent})</button>`);
    return out.length ? `<div class="fn-lbar">${out.join("")}</div>` : "";
  }
  function lessonBind(m, c, ci) {
    const d = m.querySelector("[data-fn-duty]"); if (d) d.onclick = () => { duty(c, 1); save(); render(); };
    const a = m.querySelector("[data-fn-abs]"); if (a) a.onclick = () => absDialog(ci);
    if (m.querySelector("[data-fn-tm]")) { tick(); if (!tmI) tmI = setInterval(tick, 1000); }
  }

  /* ───────── Kelmaganlar ota-onasiga xabar ───────── */
  const absText = (c, s, a, t) => { const h = D.web.bsb_hdr || {}, tch = (h.teacher || "").trim();
    return `Assalomu alaykum! Farzandingiz ${s.name} bugun (${fmt(t)}) ${c.subject ? c.subject + " darsiga" : "darsga"} kelmadi${a === "s" ? "" : ` (${ABSENT_NAMES[a]})`}. Iltimos, sababini ma'lum qiling.${tch ? `\nHurmat bilan, ${tch}` : ""}`; };
  function absDialog(ci) {
    const c = D.classes[ci], t = todayIso();
    const L = c.students.map((s, si) => [s, attOf(c, si)]).filter(([, a]) => ["s", "dq", "k"].includes(a)).map(([s, a]) => ({s, a, text: absText(c, s, a, t)}));
    modal(`<h2>✉ Kelmaganlar ota-onasiga · ${esc(label(c))}</h2><div class="muted">${L.length} o'quvchi bugun kelmadi. Matnni tahrirlab, Telegram yoki SMS orqali yuboring.</div>
      <div class="lsns">${L.map((x, i) => `<div class="pmsg"><div class="hrow" style="gap:6px"><b class="sp">${esc(x.s.name)}</b><span class="badge">${ABSENT_NAMES[x.a]}</span></div><textarea data-fa="${i}">${esc(x.text)}</textarea>
        <div class="hrow wrap" style="gap:6px"><button class="btn btn-sm" data-fc="${i}">📋 Nusxalash</button>${contactBtns(x.s, x.text, "a" + i)}</div>${x.s.par && (x.s.par.name || x.s.par.phone) ? `<div class="muted" style="font-size:13px">👪 ${esc([x.s.par.name, x.s.par.phone ? fmtPhone(x.s.par.phone) : ""].filter(Boolean).join(" · "))}</div>` : ""}</div>`).join("")}</div>
      <div class="hrow"><button class="btn" data-fall>📋 Hammasini nusxalash</button><span class="sp"></span><button class="btn btn-primary" data-x>Yopish</button></div>`, (mm, close) => {
      const cur = (i) => mm.querySelector(`[data-fa="${i}"]`).value;
      L.forEach((x, i) => { const upd = bindContactBtns(mm, x.s, "a" + i, () => cur(i)); mm.querySelector(`[data-fa="${i}"]`).oninput = upd; });
      mm.querySelectorAll("[data-fc]").forEach((b) => b.onclick = () => copyText(cur(b.dataset.fc)));
      mm.querySelector("[data-fall]").onclick = () => copyText(L.map((x, i) => cur(i)).join("\n\n——————\n\n"));
      mm.querySelector("[data-x]").onclick = () => close();
    });
  }

  /* ───────── «Bugun» eslatmalari: [rang, belgi, matn, tugma, sinf] ───────── */
  function rems(tel) {
    const R = [], t = todayIso();
    if (feat("duty")) {
      const L = D.classes.map((c, ci) => ({c, ci})).filter(({c}) => !isGrp(c) && c.students.length && c.dates.includes(t) && !isNoLesson(c, t));
      if (L.length) R.push(["info", "👤", `Navbatchi${L.length > 1 ? "lar" : ""}: ${L.map(({c}) => `<b>${esc(c.name)}</b> — ${esc(duty(c).name)}`).join(tel ? "<br>" : " · ")}`, "", "fn-dutyr"]);
    }
    if (feat("bsbrem")) {
      for (const [ci, c] of D.classes.entries()) for (const w of c.works) {
        const left = Math.round((pdate(w.date) - pdate(t)) / 864e5); if (left < 1 || left > 3) continue;
        R.push(["warn", "🔔", `<b>${wTypeName(w)}</b> ${left === 1 ? "ertaga" : `${left} kundan keyin`}: ${esc(label(c))} <span class="bn-mut">(${fmt(w.date).slice(0, 5)})</span>${tel ? "" : ". Savollar va bo'sh varaqni tayyorlang."}`, `<button class="btn btn-sm" data-open="${ci}">Jurnal</button>`, "fn-bsbr"]);
      }
    }
    return R;
  }

  return {F, GR, GONE, ALL, sec6, bind, duty, lessonBar, lessonBind, absDialog, rems};
})();
