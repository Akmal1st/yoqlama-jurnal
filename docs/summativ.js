/* «Summativ tahlili» bo'limi — «BSB tahlili» va «CHSB testi» o'rniga bitta sahifa (tasdiqlangan maket v9, 2026-11-07).
   Tepada ish turi (BSB · CHSB · Loyiha ishi), keyin shu turdagi ishlar (choraklar bo'yicha guruhlangan) va «＋ Yangi»,
   so'ng Jadval · Tahlil · Xatolar va «⋯ Amallar». Ishlar nomsiz: chorak ichidagi tartib raqami — BSB-1, CHSB-1, Loyiha ishi-1.
   BSB va Loyiha ishi — topshiriq (mezon) bo'yicha ballar (c.analyses, a.w = ish id si), CHSB — test (w.test).
   Ballar «Umumiy» sahifasiga o'zi yoziladi. Jadval, tahlil, eksport va «Taxminiy ball» — index.html dagi pageBsb / pageChsbTest. */
const SMV = (() => {
  const TYPES = ["bsb", "chsb", "loyiha"];
  const NAME = {bsb: "BSB", chsb: "CHSB", loyiha: "Loyiha ishi"};
  const UNIT = {bsb: "Topshiriqlar", chsb: "Savollar", loyiha: "Mezonlar"};
  const DEF_MAX = {bsb: 25, chsb: 40, loyiha: 25};
  const LOYIHA_NAMES = ["Mavzuning yoritilishi", "Mustaqillik va ijodkorlik", "Rasmiylashtirish", "Taqdimot va himoya", "Savollarga javob"];
  const on = () => S.jpage === "sm";
  const type = () => TYPES.includes(S.smt) ? S.smt : (S.smt = "bsb");
  const byDate = (a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : String(a.id).localeCompare(String(b.id), undefined, {numeric: true});
  const worksOf = (c, t) => (c.works || []).filter((w) => w.type === t).sort(byDate);
  // ish nomi: chorak ichida tartib raqami
  function wname(c, w) {
    const q = quarterOf(w.date), L = worksOf(c, w.type).filter((x) => quarterOf(x.date) === q);
    return `${NAME[w.type] || String(w.type).toUpperCase()}-${L.indexOf(w) + 1}`;
  }
  const hasPts = (a) => Object.values(a.rows || {}).some((r) => r && (r.pts || []).some((p) => p !== null && p !== undefined && p !== ""));
  // ishga tegishli tahlil: a.w bo'yicha, eski yozuvlarda — shu sanadagi bog'lanmagan tahlil
  function anOf(c, w) {
    const A = c.analyses || [];
    return A.find((a) => a.w === w.id) || A.find((a) => !a.w && a.date === w.date && !worksOf(c, "bsb").concat(worksOf(c, "loyiha")).some((x) => x !== w && x.date === w.date && A.some((b) => b.w === x.id))) || null;
  }
  // hech bir BSB / Loyiha ishiga bog'lanmagan, ball kiritilgan eski tahlillar — yo'qolib qolmasin (BSB ro'yxatida alohida)
  function orphans(c) {
    const linked = new Set(["bsb", "loyiha"].flatMap((t) => worksOf(c, t)).map((w) => { const a = anOf(c, w); return a && a.id; }).filter(Boolean));
    return (c.analyses || []).filter((a) => !linked.has(a.id) && hasPts(a)).sort(byDate);
  }
  // teng bo'lib: 25 → 5×5, 23 → 4,5×4 + 5
  function split(max, n) {
    n = Math.max(1, n | 0); const b = Math.floor(max / n * 2) / 2;
    if (!(b > 0)) return [max];
    const a = Array(n).fill(b); a[n - 1] = Math.round((max - b * (n - 1)) * 100) / 100; return a;
  }
  function ensureAn(c, w) {
    let a = anOf(c, w);
    if (!a) { workAnalysis(c, w); a = anOf(c, w); }
    if (a && !a.w) a.w = w.id;
    if (a && w.type === "loyiha" && !hasPts(a) && !(a.names || []).some(Boolean)) a.names = LOYIHA_NAMES.slice(0, a.q).concat(Array(Math.max(0, a.q - LOYIHA_NAMES.length)).fill(""));
    return a;
  }
  // joriy tanlov: S.smt — tur, S.smw — ish id si (yoki "a:<tahlil id>" — ishsiz eski tahlil)
  function cur(c) {
    const t = type(), L = worksOf(c, t);
    if (S.smw && String(S.smw).startsWith("a:") && t === "bsb") { const a = (c.analyses || []).find((x) => x.id === S.smw.slice(2)); if (a) return {t, w: null, a}; }
    let w = L.find((x) => x.id === S.smw);
    if (!w && L.length) { const q = quarterOf(todayIso()), inQ = L.filter((x) => quarterOf(x.date) === q); w = (inQ.length ? inQ : L).at(-1); }
    S.smw = w ? w.id : null;
    return {t, w: w || null, a: null};
  }
  // BSB / Loyiha: pageBsb ishlaydigan B (har ish uchun xotirada)
  function bFor(c, w, a0) {
    const a = a0 || ensureAn(c, w); if (!a) return null;
    S.smB = S.smB || {};
    const key = `${label(c)}|${a.id}`;
    let B = S.smB[key];
    // saqlangan tahlil — asosiy manba (boshqa sahifada o'zgargan bo'lishi mumkin); «Taxminiy ball» holati saqlanib qoladi
    if (!B || B.id !== a.id || !B.dirty) { const tx = B && B.id === a.id ? B.tx : undefined; B = S.smB[key] = baFrom(a); if (tx) B.tx = tx; }
    B.kind = w ? (w.type === "loyiha" ? "Loyiha ishi" : "BSB") : "BSB";
    B.wid = w ? w.id : null; B.title = w ? wname(c, w) : (a.title || "");
    if (w) B.date = w.date;
    return B;
  }

  /* ── yuqori qism: tur · ish · ＋ Yangi ── */
  function top(c, sel) {
    const t = type(), L = worksOf(c, t), O = t === "bsb" ? orphans(c) : [];
    const qs = [...new Set(L.map((w) => quarterOf(w.date) || 0))];
    const opt = (w) => `<option value="${esc(w.id)}" ${w.id === S.smw ? "selected" : ""}>${esc(wname(c, w))} · ${fmt(w.date)}${done(c, w) ? " ✓" : ""}</option>`;
    const list = L.length || O.length
      ? `<select id="smw" class="form-select sm-sel" aria-label="Ish">${qs.map((q) => `<optgroup label="${q ? `${q}-chorak` : "Chorakdan tashqari"}">${L.filter((w) => (quarterOf(w.date) || 0) === q).map(opt).join("")}</optgroup>`).join("")}
          ${O.length ? `<optgroup label="Ishga bog'lanmagan tahlillar">${O.map((a) => `<option value="a:${esc(a.id)}" ${S.smw === "a:" + a.id ? "selected" : ""}>Tahlil · ${fmt(a.date)}${a.title ? " · " + esc(a.title) : ""}</option>`).join("")}</optgroup>` : ""}</select>`
      : `<span class="sm-none muted">Hali ${NAME[t]} yo'q</span>`;
    return `<div class="sm-ts seg" role="tablist" aria-label="Ish turi">${TYPES.map((k) => `<button type="button" role="tab" aria-selected="${t === k}" class="${t === k ? "on" : ""}" data-smt="${k}"><i class="sm-dot ${k}"></i>${NAME[k]}</button>`).join("")}</div>
      <div class="sm-tb">${list}<button type="button" class="btn btn-primary" data-smnew><i class="bi bi-plus-lg" aria-hidden="true"></i> Yangi</button></div>`;
  }
  // Jadval · Tahlil · Xatolar + «⋯ Amallar» (menyudagi tugmalarni sahifa o'zi bog'laydi: eksport, taxminiy ball, nomlar, teng ball)
  function bar(tabs, items) {
    return `<div class="sm-bar">${tabs}<span class="sp"></span><span class="sm-more"><button type="button" class="btn" data-smmore aria-haspopup="true" aria-expanded="false"><i class="bi bi-three-dots" aria-hidden="true"></i> <span class="sm-l">Amallar</span></button>
      <div class="sm-menu" hidden>${items}</div></span></div>`;
  }
  const item = (attr, icon, text, cls = "") => `<button type="button" class="${cls}" ${attr}><i class="bi bi-${icon}" aria-hidden="true"></i> ${text}</button>`;
  function menu(t, extra) {
    return item("data-smset", "sliders", `Sana va ${UNIT[t].toLowerCase()}`) + extra + item("data-smdel", "trash", "O'chirish", "dng");
  }
  function done(c, w) {
    if (w.type === "chsb") return !!(w.test && Object.values(w.test.ans || {}).some((a) => /[^.]/.test(a)));
    const a = anOf(c, w); return !!(a && hasPts(a));
  }

  /* ── bog'lash ── */
  function bind(m, c, ctx) {
    m.querySelectorAll("[data-smt]").forEach((b) => b.onclick = () => { if (S.smt === b.dataset.smt) return; S.smt = b.dataset.smt; S.smw = null; render(); });
    const sel = $("#smw", m); if (sel) sel.onchange = () => { S.smw = sel.value; render(); };
    $("[data-smnew]", m).onclick = () => newDialog(c);
    const more = $("[data-smmore]", m), mn = $(".sm-menu", m);
    if (more && mn) {
      more.onclick = (e) => { e.stopPropagation(); mn.hidden = !mn.hidden; more.setAttribute("aria-expanded", String(!mn.hidden)); };
      mn.addEventListener("click", () => { mn.hidden = true; more.setAttribute("aria-expanded", "false"); });
      if (bind.off) bind.off();
      const close = (e) => { if (!mn.contains(e.target) && e.target !== more) { mn.hidden = true; more.setAttribute("aria-expanded", "false"); } };
      document.addEventListener("click", close); bind.off = () => document.removeEventListener("click", close);
    }
    const st = $("[data-smset]", m); if (st) st.onclick = () => ctx && (ctx.w ? setDialog(c, ctx.w, ctx.B) : toast("Bu tahlil ishga bog'lanmagan — sanasi o'zgarmaydi"));
    const dl = $("[data-smdel]", m); if (dl) dl.onclick = () => ctx && delWork(c, ctx);
  }

  /* ── yangi ish ── */
  function newDialog(c) {
    if (type() === "loyiha") { LYH.newDialog(c); return; }   // shablon tanlash bilan (loyiha.js)
    const t = type(), q = workQuarter(), r = qRange(q) || [todayIso(), todayIso()];
    const td = todayIso(), defD = r[0] <= td && td <= r[1] ? td : r[0];
    modal(`<h2><i class="sm-dot ${t}"></i> Yangi ${NAME[t]}</h2>
      <div class="muted">${t === "chsb" ? "Test: to'g'ri javob — savolning to'liq bali, noto'g'ri — 0." : t === "loyiha" ? "Mezonlar bo'yicha ball, BSB kabi baholanadi." : "Kriteriali topshiriqlar: har topshiriqqa 0 dan maksimalgacha ball."}</div>
      <div class="hrow" style="gap:10px;flex-wrap:wrap"><label class="f sp">${UNIT[t]} soni<input class="form-control" type="number" id="smn" min="1" max="${t === "chsb" ? 100 : 30}" value="${t === "chsb" ? 20 : 5}" inputmode="numeric"></label>
        <label class="f sp">Sana<input class="form-control" type="date" id="smd" value="${defD}"></label></div>
      <div class="muted small">Maksimal ball: ${DEF_MAX[t]} (${t === "chsb" ? "«Amallar → Sana va savollar»da" : "jadvalning «Maksimal ball» qatorida"} o'zgartiriladi). «Umumiy» sahifasida ${NAME[t]} ustuni ochiladi.</div>
      <div class="hrow"><span class="sp"></span><button class="btn" data-x>Bekor qilish</button><button class="btn btn-primary" data-ok>Yaratish</button></div>`, (mm, close) => {
      $("[data-x]", mm).onclick = () => close();
      $("[data-ok]", mm).onclick = () => {
        const d = $("#smd", mm).value, n = Math.max(1, Math.min(t === "chsb" ? 100 : 30, Math.trunc(+$("#smn", mm).value) || 0));
        if (!d) { toast("Sanani tanlang"); return; }
        if (!quarterOf(d)) { toast(`${fmt(d)} biror chorakka kirmaydi — «Sozlamalar → Dars kunlari va choraklar»da choraklarni belgilang`); return; }
        if (ARX.dateLocked(d)) { ARX.deny(quarterOf(d)); return; }
        reviveWork(c, t, d);
        const w = {id: newWorkId(c), type: t, date: d, max: DEF_MAX[t], title: ""};
        c.works.push(w);
        if (t === "chsb") { w.test = testBlank(); w.test.n = n; w.test.key = ".".repeat(n); cleanTest(w); S.tw = w.id; S.cttab = "tbl"; }
        else {
          workAnalysis(c, w); const a = ensureAn(c, w);
          if (a) { a.q = n; a.max = split(w.max, n); a.names = w.type === "loyiha" ? LOYIHA_NAMES.slice(0, n).concat(Array(Math.max(0, n - LOYIHA_NAMES.length)).fill("")) : []; a.rows = {}; }
          S.batab = "tbl";
        }
        S.smw = w.id; save(); close(); render(); toast(`${wname(c, w)} yaratildi`);
      };
    });
  }

  /* ── sana va topshiriqlar soni ── */
  function setDialog(c, w, B) {
    const t = w.type, ch = t === "chsb", T = ch ? (w.test || testBlank()) : null, n = ch ? T.n : B.q;
    modal(`<h2>${esc(wname(c, w))}: sozlash</h2>
      <div class="hrow" style="gap:10px;flex-wrap:wrap"><label class="f sp">Sana<input class="form-control" type="date" id="ssd" value="${w.date}"></label>
        <label class="f sp">${UNIT[t]} soni<input class="form-control" type="number" id="ssn" min="1" max="${ch ? 100 : 30}" value="${n}" inputmode="numeric"></label>
        ${ch ? `<label class="f sp">Maksimal ball<input class="form-control" type="number" id="ssm" min="1" step="0.5" value="${gnum(w.max)}" inputmode="decimal"></label><label class="f sp">Variantlar soni<input class="form-control" type="number" id="sso" min="2" max="6" value="${T.o}" inputmode="numeric"></label>` : ""}</div>
      <div class="muted small">${ch ? "Har savol bali teng: maksimal ball ÷ savollar soni (jadvalda o'zgartirish mumkin)." : "Har birining maksimal bali jadvalning birinchi qatorida o'zgartiriladi."}</div>
      <div class="hrow"><span class="sp"></span><button class="btn" data-x>Bekor qilish</button><button class="btn btn-primary" data-ok>Saqlash</button></div>`, (mm, close) => {
      $("[data-x]", mm).onclick = () => close();
      $("[data-ok]", mm).onclick = async () => {
        const d = $("#ssd", mm).value, k = Math.max(1, Math.min(ch ? 100 : 30, Math.trunc(+$("#ssn", mm).value) || n));
        if (!d) { toast("Sanani tanlang"); return; }
        if (d !== w.date) {
          if (!quarterOf(d)) { toast(`${fmt(d)} biror chorakka kirmaydi`); return; }
          if (ARX.dateLocked(d) || ARX.dateLocked(w.date)) { ARX.deny(quarterOf(ARX.dateLocked(d) ? d : w.date)); return; }
        }
        if (ch) {
          const mx = Math.round(parseFloat(String($("#ssm", mm).value).replace(",", ".")) * 10) / 10, o = Math.max(2, Math.min(6, Math.trunc(+$("#sso", mm).value) || T.o));
          if (!(mx > 0)) { toast("Maksimal ball noto'g'ri"); return; }
          const has = (s) => { const a = (w.test || {}).ans && w.test.ans[s.id]; return a && /[^.]/.test(a); };
          if (c.students.some((s) => !has(s) && isNum((s.scores || {})[w.id]) && s.scores[w.id] > mx)) { toast("Ba'zi o'quvchilarning bali yangi maksimaldan katta"); return; }
          if (!w.test) w.test = testBlank();
          if (mx !== w.max) { w.max = mx; delete w.test.pts; }
          if (k !== w.test.n || o !== w.test.o) { w.test.n = k; w.test.o = o; cleanTest(w); }
          if (d !== w.date) { w.date = d; syncWorkAnalyses(c); }
          S.ctfix = null;   // pageChsbTest ballarni qayta hisoblaydi
        } else {
          if (k !== B.q) {
            B.max = B.max.concat(Array(Math.max(0, k - B.max.length)).fill(B.max[B.max.length - 1] || 2)).slice(0, k); B.q = k;
            B.names = (B.names || []).slice(0, k); if (w.type === "loyiha") for (let i = 0; i < k; i++) if (B.names[i] === undefined) B.names[i] = LOYIHA_NAMES[i] || "";
            Object.values(B.rows).forEach((r) => { r.pts = (r.pts || []).slice(0, k); });
          }
          if (d !== w.date) { w.date = d; B.date = d; }
          B.dirty = true; await autosave(c, B);
        }
        const q = quarterOf(w.date); if (q) S.sq = q;
        save(); close(); render(); toast("Saqlandi");
      };
    });
  }

  /* ── o'chirish ── */
  async function delWork(c, ctx) {
    const {w, a} = ctx;
    if (!w) {   // ishsiz eski tahlil
      if (!await confirmBox("O'chirish", `${fmt(a.date)} dagi tahlil o'chirilsinmi?`, "O'chirish")) return;
      c.analyses = c.analyses.filter((x) => x.id !== a.id); S.smw = null; save(); render(); return;
    }
    if (ARX.dateLocked(w.date)) { ARX.deny(quarterOf(w.date)); return; }
    const scored = c.students.some((s) => ((s.scores || {})[w.id] ?? "") !== "");
    if (scored && isLocked() && !await unlock()) return;
    if (!await confirmBox("Ishni o'chirish", `${esc(wname(c, w))} (${fmt(w.date)}) o'chirilsinmi? Kiritilgan ballar va «Umumiy» sahifasidagi ustun ham o'chadi.`, "O'chirish")) return;
    const an = w.type !== "chsb" && anOf(c, w);
    removeWork(c, w);
    if (an) c.analyses = c.analyses.filter((x) => x.id !== an.id);
    S.smw = null; save(); render(); toast("O'chirildi");
  }

  /* ── avtomatik saqlash: tahlil + «Umumiy» sahifasidagi ball ── */
  let queue = Promise.resolve();
  function autosave(c, B) { queue = queue.then(() => doSave(c, B)).catch(() => {}); return queue; }
  async function doSave(c, B) {
    if (!B.dirty) return;
    if (!baSave(c, B, true)) return;
    const a = c.analyses.find((x) => x.id === B.id), w = B.wid && c.works.find((x) => x.id === B.wid);
    if (!a || !w) return;
    a.w = w.id; a.title = ""; if (a.date !== w.date) a.date = w.date;
    const tot = Math.round(sumOf(B.max) * 100) / 100;
    if (tot > 0 && Math.abs(tot - w.max) > 1e-9) {
      // ish maksimali topshiriqlar yig'indisiga teng bo'ladi (agar boshqa ballar undan oshmasa)
      const over = c.students.some((s) => { const r = baRow(B, s.name), v = (s.scores || {})[w.id]; return !(r.pts || []).some((p) => p != null) && isNum(v) && v > tot; });
      if (!over && !ARX.dateLocked(w.date)) w.max = tot;
    }
    if (ARX.scoreLocked(c, w.id)) { save(); return; }
    const scale = tot > 0 && Math.abs(w.max - tot) > 1e-9, batch = [];
    for (const s of c.students) {
      const r = baRow(B, s.name); if (r.in === false || !(r.pts || []).some((p) => p !== null && p !== undefined)) continue;
      const total = sumOf(B.max.map((mx, i) => Math.min(Math.max(+(r.pts[i] || 0), 0), mx)));
      const v = Math.round((scale ? total * w.max / tot : total) * 10) / 10;
      if ((s.scores || {})[w.id] !== v) await putScore(c, s, w.id, v, batch);
    }
    if (batch.length) pushUndo(batch);
    save();
  }
  // ✓ olib tashlanganda — «Umumiy»dagi ball ham o'chadi
  async function absent(c, B, s, isIn) {
    const w = B.wid && c.works.find((x) => x.id === B.wid);
    if (!w || isIn || ARX.scoreLocked(c, w.id)) return;
    if (((s.scores || {})[w.id] ?? "") !== "") await putScore(c, s, w.id, "");
  }

  /* ── sahifa ── */
  function page(m) {
    const c = D.classes[S.ci], {t, w, a} = cur(c);
    if (!w && !a) {
      m.innerHTML = `<div class="vcol sm-page" style="gap:12px">${classChips()}<div class="hrow">${jpSeg()}</div>${top(c)}
        <div class="card muted">«＋ Yangi» tugmasini bosing — ${t === "chsb" ? "test shaklidagi CHSB: to'g'ri javoblarni belgilab, o'quvchilarning variantlarini kiritasiz, ball o'zi hisoblanadi" : t === "loyiha" ? "loyiha ishi rasmiy mezonlar bo'yicha baholanadi: fan shablonini tanlaysiz (Darajalar, Oraliq, Bandlar, Ha/Yo'q, Xato soni)" : "bo'lim bo'yicha summativ: har topshiriqqa ball"}.</div></div>`;
      bindTop(m); bind(m, c, null); return;
    }
    // Loyiha ishi — rasmiy mezonlar bo'yicha (loyiha.js, tasdiqlangan maket v9, 2026-11-08)
    if (t === "loyiha" && w) { LYH.page(m); return ARX.decorate(m, c); }
    if (t === "chsb") { S.tw = w.id; pageChsbTest(m); return ARX.decorate(m, c); }
    const B = bFor(c, w, a);
    S.bas = S.bas || {}; S.bas[label(c)] = B;
    if (B.dirty) autosave(c, B);
    pageBsb(m);
    ARX.decorate(m, c);
  }
  return {page, top, bar, menu, item, bind, autosave, absent, wname, anOf, orphans, cur, NAME, on, split};
})();
