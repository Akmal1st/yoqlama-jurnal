/* Tugagan chorakni arxivlash va qulflash — tasdiqlangan maket v1 (Akmal, 2026-11-04: «Joriy et»).
   Chorak tugagach «tuzatish muddati» (standart 3 kun) o'tsa, chorak o'zi arxivlanadi: o'sha chorak sanalaridagi kundalik baho va
   yo'qlama, mezon ballari, BSB/CHSB ballari, chorak bahosi, mavzu/uy vazifasi o'zgarmaydi, eMaktab importi ham ularga tegmaydi.
   Xato bo'lsa — «Vaqtincha ochish» (sabab, muddat, Himoya paroli); muddat tugagach o'zi qulflanadi, o'zgarishlar arxiv tarixiga yoziladi.
   Ma'lumot: D.web.arx = {auto, grace (0|3|7), ask, q: {1: {r: [boshi, oxiri], at, by: "auto"|"hand", snap: [...]}}, log: [{t, q, x}], off: ["boshi|oxiri"]}.
   Arxiv yozuvi chorak sanalariga bog'langan (r): sanalar o'zgarsa yoki yangi o'quv yili kiritilsa — eski yozuv amal qilmaydi.
   Vaqtincha ochish faqat xotirada (sahifa qayta ochilsa — yana qulf). Asosiy skriptdan oldin ulanadi. */
const ARX = (() => {
  const GRACE = [0, 3, 7];
  const WHY = ["Xatoni tuzatish", "eMaktab bilan solishtirish", "Boshqa"];
  const DUR = [[15, "15 daqiqa"], [60, "1 soat"], [0, "Bugun oxirigacha"]];
  let OPEN = null, openT = 0;   // {q, until, why}

  /* ───────── holat ───────── */
  const raw = () => (typeof D !== "undefined" && D && D.web && D.web.arx && typeof D.web.arx === "object") ? D.web.arx : null;
  function cfg() {
    const a = D.web.arx = raw() || {};
    if (typeof a.auto !== "boolean") a.auto = true;
    if (!GRACE.includes(a.grace)) a.grace = 3;
    if (typeof a.ask !== "boolean") a.ask = true;
    if (!a.q || typeof a.q !== "object" || Array.isArray(a.q)) a.q = {};
    for (const k of Object.keys(a.q)) { const e = a.q[k]; if (!/^[1-4]$/.test(k) || !e || !Array.isArray(e.r) || e.r.length !== 2 || !e.r.every((x) => /^\d{4}-\d\d-\d\d$/.test(String(x)))) delete a.q[k]; else if (!Array.isArray(e.snap)) e.snap = []; }
    if (!Array.isArray(a.log)) a.log = []; a.log = a.log.filter((x) => x && typeof x === "object").slice(-300);
    if (!Array.isArray(a.off)) a.off = []; a.off = a.off.filter((x) => typeof x === "string");
    return a;
  }
  const key = (r) => r ? r[0] + "|" + r[1] : "";
  const gr = () => { const a = raw(); return a && GRACE.includes(a.grace) ? a.grace : 3; };
  const autoOn = () => { const a = raw(); return !a || a.auto !== false; };
  function entry(q) {   // faqat o'qiydi — hisob-kitob (testlar) D ni o'zgartirmasin
    const a = raw(), r = q && qRange(q), e = a && a.q && a.q[q];
    return r && e && Array.isArray(e.r) && key(e.r) === key(r) ? e : null;
  }
  const isOpen = (q) => !!OPEN && OPEN.q === q && Date.now() < OPEN.until;
  const lockedQ = (q) => !!q && !!entry(q) && !isOpen(q);
  const dateLocked = (d, c) => !(c && isGrp(c)) && lockedQ(quarterOf(d));
  function scoreQ(c, k) { if (/^final:q[1-4]$/.test(k)) return +k.slice(7); const w = (c.works || []).find((x) => x.id === k); return w ? quarterOf(w.date) : null; }
  const scoreLocked = (c, k) => !isGrp(c) && lockedQ(scoreQ(c, k));
  const due = (q) => { const r = qRange(q); return r ? iso(addDays(pdate(r[1]), gr() + 1)) : null; };   // shu kuni arxivlanadi
  const days = (a, b) => Math.round((pdate(b) - pdate(a)) / 864e5);
  const stamp = () => { const n = new Date(); return `${iso(n)} ${pad(n.getHours())}:${pad(n.getMinutes())}`; };
  const shortT = (t) => { const m = String(t || "").match(/^\d{4}-(\d\d)-(\d\d) (\d\d:\d\d)$/); return m ? `${m[2]}.${m[1]} ${m[3]}` : esc(String(t || "")); };
  function addLog(q, x) { const a = cfg(); a.log.push({t: stamp(), q, x}); if (a.log.length > 300) a.log.splice(0, a.log.length - 300); }
  function deny(q) { toast(`🔒 ${q ? q + "-chorak" : "Bu chorak"} arxivda — baholarni o'zgartirib bo'lmaydi`, q ? ["Vaqtincha ochish", () => openDialog(q)] : null); return false; }
  const shown = (v) => v === "" || v === undefined || v === null ? "bo'sh" : typeof v === "number" ? fmtNum(v) : (displayMark(String(v)) || String(v));
  // ochiq paytda qilingan o'zgarishlar arxiv tarixiga ham yoziladi
  function note(c, s, d, old, nw) { const q = quarterOf(d); if (!isGrp(c) && isOpen(q) && entry(q)) addLog(q, `${label(c)} · ${s.name} · ${fmt(d).slice(0, 5)}: ${shown(old)} → ${shown(nw)}`); }
  function noteScore(c, s, k, old, nw) {
    const q = scoreQ(c, k); if (isGrp(c) || !isOpen(q) || !entry(q)) return;
    const w = (c.works || []).find((x) => x.id === k), what = w ? `${w.type.toUpperCase()} ${fmt(w.date).slice(0, 5)}` : "chorak bahosi";
    addLog(q, `${label(c)} · ${s.name} · ${what}: ${shown(old)} → ${shown(nw)}`);
  }

  /* ───────── natijalar (arxivlangan paytdagi holat saqlanadi) ───────── */
  function stats(q) {
    const r = qRange(q); if (!r) return [];
    return D.classes.filter((c) => !isGrp(c) && c.students.length).map((c) => {
      const {rows} = reportRows(c, r[0], r[1], q), ql = qualityOf(rows);
      const n = rows.reduce((a, x) => a + x.n, 0), sum = rows.reduce((a, x) => a + (x.avg !== null ? x.avg * x.n : 0), 0), at = rows.filter((x) => x.att !== null);
      const set = c.students.filter((s) => isNum((s.scores || {})[`final:q${q}`])).length;
      return {cls: label(c), n: c.students.length, avg: n ? Math.round(100 * sum / n) / 100 : null, att: at.length ? Math.round(at.reduce((a, x) => a + x.att, 0) / at.length) : null,
        q: ql ? Math.round(ql.q) : null, u: ql ? Math.round(ql.u) : null, set};
    });
  }
  function archive(q, by) {
    const a = cfg(), r = qRange(q); if (!r) return;
    a.q[q] = {r: r.slice(), at: stamp(), by, snap: stats(q)};
    a.off = a.off.filter((x) => x !== key(r));
    if (OPEN && OPEN.q === q) OPEN = null;
    addLog(q, by === "auto" ? "Avtomatik arxivlandi (tuzatish muddati tugadi)" : "Qo'lda arxivlandi");
  }
  // har chizishda: muddati o'tgan chorak arxivlanadi, sanasi o'zgargan yozuv olib tashlanadi, ochiq muddat tugagan bo'lsa — qulf
  function tick() {
    if (typeof D === "undefined" || !D || !D.web) return;
    const t = todayIso(); let ch = false; const done = [];
    if (OPEN && Date.now() >= OPEN.until) { addLog(OPEN.q, "Yana qulflandi (muddat tugadi)"); OPEN = null; ch = true; }
    const a0 = raw();
    for (let q = 1; q <= 4; q++) {
      const r = qRange(q), e = a0 && a0.q && a0.q[q];
      if (e && (!r || !Array.isArray(e.r) || key(e.r) !== key(r))) { delete a0.q[q]; ch = true; }
      if (!r || entry(q) || !autoOn() || r[1] >= t || t < due(q) || (a0 && Array.isArray(a0.off) && a0.off.includes(key(r)))) continue;
      if (!D.classes.some((c) => !isGrp(c))) continue;
      archive(q, "auto"); done.push(q); ch = true;
    }
    if (ch) save();
    if (done.length) setTimeout(() => toast(`🗄 ${done.join(", ")}-chorak arxivlandi: baholarni endi o'zgartirib bo'lmaydi`, ["Arxiv", () => go2()]), 300);
  }

  /* ───────── vaqtincha ochish ───────── */
  function openDialog(q) {
    const a = cfg(), p = D.settings.protect, needPin = a.ask && !!p.pin;
    let why = 0, dur = 1;
    const opts = (L, cur, at) => L.map((x, i) => `<button type="button" class="${i === cur ? "on" : ""}" data-${at}="${i}">${Array.isArray(x) ? x[1] : x}</button>`).join("");
    modal(`<div class="ax-dlg"><h2>🔓 ${q}-chorakni vaqtincha ochish</h2>
      <p class="muted">Arxivlangan chorak baholarini o'zgartirishga ruxsat beriladi. Muddat tugagach o'zi yana qulflanadi.</p>
      <div class="ax-fld"><b>Sabab</b><div class="ax-opts" id="axw">${opts(WHY, why, "axw")}</div></div>
      <div class="ax-fld"><b>Qancha vaqtga</b><div class="ax-opts" id="axd">${opts(DUR, dur, "axd")}</div></div>
      ${needPin ? `<label class="ax-fld"><b>Parol (Sozlamalar → Himoya)</b><input type="password" id="axpin" class="form-control" autocomplete="off" inputmode="numeric"></label>`
        : a.ask ? `<p class="muted ax-sm">Himoya paroli o'rnatilmagan — chorak parolsiz ochiladi.</p>` : ""}
      <p class="muted ax-sm">✎ Har bir o'zgarish «O'zgarishlar tarixi»ga va chorak arxiviga yoziladi.</p>
      <div class="hrow"><span class="sp"></span><button class="btn" data-x>Bekor qilish</button><button class="btn btn-primary" data-ok>🔓 Ochish</button></div></div>`, (m, close) => {
      const pick = (sel, at, set) => m.querySelectorAll(`[data-${at}]`).forEach((b) => b.onclick = () => { set(+b.dataset[at]); m.querySelectorAll(`${sel} button`).forEach((x) => x.classList.toggle("on", x === b)); });
      pick("#axw", "axw", (v) => why = v); pick("#axd", "axd", (v) => dur = v);
      $("[data-x]", m).onclick = () => close();
      const pin = $("#axpin", m); if (pin) { pin.focus(); pin.onkeydown = (e) => { if (e.key === "Enter") $("[data-ok]", m).click(); }; }
      $("[data-ok]", m).onclick = async () => {
        if (needPin) { if (!await checkPin(pin.value, p.pin)) { toast("Parol noto'g'ri"); pin.select(); return; } unlockedUntil = Math.max(unlockedUntil, Date.now() + (p.auto_lock_min || 10) * 60000); }
        const n = new Date(), mins = DUR[dur][0], end = new Date(n); end.setHours(23, 59, 59, 0);
        OPEN = {q, until: mins ? n.getTime() + mins * 60000 : end.getTime(), why: WHY[why]};
        addLog(q, `Vaqtincha ochildi · ${WHY[why].toLowerCase()} · ${DUR[dur][1].toLowerCase()}`); save();
        clearTimeout(openT); openT = setTimeout(() => { tick(); render(); }, OPEN.until - Date.now() + 500);
        close(); render(); toast(`🔓 ${q}-chorak ${untilTxt()} gacha ochildi`);
      };
    });
  }
  const untilTxt = () => { if (!OPEN) return ""; const d = new Date(OPEN.until); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  function relock() { if (!OPEN) return; const q = OPEN.q; OPEN = null; clearTimeout(openT); addLog(q, "Yana qulflandi"); save(); render(); toast(`🔒 ${q}-chorak yana qulflandi`); }

  /* ───────── jurnaldagi banner ───────── */
  function banner(c, dates) {
    if (!c || isGrp(c)) return "";
    const q = [...new Set((dates || []).map(quarterOf))].find((x) => x && entry(x)); if (!q) return "";
    const e = entry(q);
    if (isOpen(q)) return `<div class="ax-ban ax-o"><span class="ax-ic">🔓</span><div class="ax-tx"><b>${q}-chorak vaqtincha ochiq · ${untilTxt()} gacha</b><small>Sabab: ${esc(OPEN.why.toLowerCase())}. O'zgarishlar tarixga yoziladi, muddat tugagach o'zi qulflanadi.</small></div><div class="ax-acts"><button class="btn btn-sm btn-primary" data-axrelock>🔒 Hozir qulflash</button></div></div>`;
    return `<div class="ax-ban"><span class="ax-ic">🔒</span><div class="ax-tx"><b>${q}-chorak arxivda · faqat ko'rish</b><small>${shortT(e.at).slice(0, 5)} da arxivlangan. Baholar, yo'qlama, BSB/CHSB ballari va chorak bahosi o'zgarmaydi.</small></div><div class="ax-acts"><button class="btn btn-sm" data-axopen="${q}">🔓 Vaqtincha ochish</button><button class="btn btn-sm" data-axpage="${q}">🗄 Arxiv</button></div></div>`;
  }
  // BSB/CHSB, CHSB testi, Yillik sahifalari: banner va arxivdagi kataklar o'chiriladi
  function decorate(m, c) {
    if (!c || isGrp(c)) return;
    const host = m.querySelector(".jtabs") && m.querySelector(".jtabs").closest(".hrow");
    const put = (html) => { if (!html) return; const el = h(html); if (host) host.after(el); else m.firstElementChild && m.firstElementChild.prepend(el); };
    if (S.jpage === "year") {
      m.querySelectorAll("[data-fy]").forEach((sel) => { const k = sel.dataset.fy.split("|")[1]; if (scoreLocked(c, k)) { sel.disabled = true; sel.title = "Arxivdagi chorak — o'zgartirib bo'lmaydi"; } });
      const L = [1, 2, 3, 4].filter(lockedQ); if (L.length) put(`<p class="muted ax-note">🔒 ${L.join(", ")}-chorak arxivda: ${L.length > 1 ? "ularning" : "uning"} chorak baholari o'zgarmaydi.</p>`);
      return;
    }
    let q = null;
    if (S.jpage === "sum") q = S.sq;
    else if (S.jpage === "chsbt") { const w = (c.works || []).find((x) => x.id === S.tw); q = w ? quarterOf(w.date) : null; }
    if (!q || !entry(q)) return;
    const r = qRange(q); put(banner(c, [r[0]]));
    if (!lockedQ(q)) return;
    const ro = S.jpage === "sum" ? "[data-sc],[data-fq]" : "[data-ta],[data-tin],[data-tk],[data-tp],[data-tmax],[data-tsave],[data-tdel],[data-peq],[data-psum],[data-btr],[data-qp],input.tp,input.ta";
    m.querySelectorAll(ro).forEach((x) => { x.disabled = true; });
    m.querySelectorAll("[data-addw],[data-apq]").forEach((x) => x.remove());
  }

  /* ───────── «Bugun»: chorak tugadi, arxivlashdan oldin tekshiring ───────── */
  function pending() {
    const t = todayIso(), a = raw();
    if (!autoOn()) return null;
    for (let q = 4; q >= 1; q--) { const r = qRange(q); if (r && r[1] < t && !entry(q) && t < due(q) && !(a && (a.off || []).includes(key(r)))) return q; }
    return null;
  }
  function gaps(q) {
    const works = worksInQuarter;
    return D.classes.map((c, ci) => ({c, ci})).filter(({c}) => !isGrp(c) && c.students.length).map(({c, ci}) => {
      const ws = works(c, q), noF = c.students.filter((s) => !isNum((s.scores || {})[`final:q${q}`])).length;
      const noS = ws.length ? c.students.filter((s) => ws.some((w) => (s.scores || {})[w.id] === undefined || (s.scores || {})[w.id] === "")).length : 0;
      return {c, ci, noF, noS};
    });
  }
  function todayCard(tel) {
    const q = pending(); if (!q) return "";
    const r = qRange(q), left = days(todayIso(), due(q)), G = gaps(q), bad = G.filter((g) => g.noF || g.noS), ok = G.filter((g) => !g.noF && !g.noS);
    return `<section class="card ax-today"><div class="ax-ban ax-w"><span class="ax-ic">🗓</span><div class="ax-tx"><b>${q}-chorak ${fmt(r[1]).slice(0, 5)} da tugadi</b>
        <small>${fmt(due(q)).slice(0, 5)} kuni avtomatik arxivlanadi: shundan keyin ${q}-chorak baholari va yo'qlamasini o'zgartirib bo'lmaydi.</small>
        <div class="ax-acts"><button class="btn btn-sm btn-primary" data-axnow="${q}">🗄 Hozir arxivlash</button><button class="btn btn-sm" data-axpage="${q}">Batafsil</button></div></div>
        <div class="ax-cd"><b>${left}</b><small>kun</small></div></div>
      <div class="ax-chk"><div class="ax-chh"><b>Arxivlashdan oldin tekshiring</b>${bad.length ? `<span class="ax-chip warn">${bad.length} ta sinfda kamchilik</span>` : `<span class="ax-chip ok">✓ Tayyor</span>`}</div>
        ${ok.length ? `<div class="ax-ci"><span class="ax-d ok">✓</span><span class="ax-ct">${ok.map((g) => esc(label(g.c))).join(", ")} — chorak baholari qo'yilgan</span></div>` : ""}
        ${bad.map((g) => `<div class="ax-ci"><span class="ax-d w">!</span><span class="ax-ct"><b>${esc(label(g.c))}</b> · ${[g.noF ? `${g.noF} o'quvchida chorak bahosi yo'q` : "", g.noS ? `${g.noS} o'quvchida BSB/CHSB balli yo'q` : ""].filter(Boolean).join(" · ")}</span><button class="btn btn-sm" data-axfix="${g.ci}|${q}">${g.noF ? "Qo'yish" : "Kiritish"}</button></div>`).join("")}
      </div></section>`;
  }

  /* ───────── «Choraklar arxivi» sahifasi ───────── */
  const phone = () => matchMedia("(max-width:820px)").matches;
  function status(q) {
    const r = qRange(q), t = todayIso(), a = raw();
    if (!r) return ["none", "Belgilanmagan", "mut"];
    if (entry(q)) return isOpen(q) ? ["open", "🔓 Ochiq", "warn"] : ["arc", "🔒 Arxiv", "arc"];
    if (r[0] <= t && t <= r[1]) return ["now", "Joriy", "acc"];
    if (r[1] < t) return autoOn() && !(a && (a.off || []).includes(key(r))) && t < due(q) ? ["wait", `${days(t, due(q))} kundan keyin arxiv`, "warn"] : ["ended", "Arxivlanmagan", "warn"];
    return r[0] === iso(addDays(pdate(t), 1)) ? ["next", "Ertaga", "acc"] : ["fut", "Keyin", "mut"];
  }
  function pct(r) { if (!r) return 0; const t = todayIso(); if (t < r[0]) return 0; if (t > r[1]) return 100; return Math.round(100 * days(r[0], t) / Math.max(1, days(r[0], r[1]))); }
  const n1 = (v) => v === null || v === undefined ? "—" : String(v).replace(".", ",");
  const pc = (v) => v === null || v === undefined ? "—" : v + "%";
  function summary(L, q, tel) {
    if (!L.length) return `<div class="card ax-pad muted">Sinflar yo'q.</div>`;
    const chip = (x) => x.set >= x.n ? `<span class="ax-chip ok">✓ ${x.set}/${x.n}</span>` : `<span class="ax-chip warn">${x.set}/${x.n}</span>`;
    if (tel) return `<div class="card ax-list">${L.map((x) => `<div class="ax-crow"><div class="ax-ct2"><b>${esc(x.cls)}</b>${chip(x)}</div><div class="ax-m"><span>O'rtacha <b>${n1(x.avg)}</b></span><span>Sifat <b>${pc(x.q)}</b></span><span>O'zl. <b>${pc(x.u)}</b></span><span>Dav. <b>${pc(x.att)}</b></span></div></div>`).join("")}</div>`;
    return `<div class="card ax-tw"><table class="ax-tbl"><thead><tr><th>Sinf</th><th>O'quvchi</th><th>O'rtacha</th><th>Sifat</th><th>O'zlashtirish</th><th>Davomat</th><th>Chorak baholari</th></tr></thead><tbody>
      ${L.map((x) => `<tr><td><b>${esc(x.cls)}</b></td><td>${x.n}</td><td>${n1(x.avg)}</td><td>${pc(x.q)}</td><td>${pc(x.u)}</td><td>${pc(x.att)}</td><td>${chip(x)}</td></tr>`).join("")}</tbody></table></div>`;
  }
  function page(m) {
    tick();
    const a = cfg(), tel = phone(), t = todayIso();
    const cur = [1, 2, 3, 4].includes(S.axq) ? S.axq : ([4, 3, 2, 1].find((q) => entry(q)) || quarterOf(t) || [1, 2, 3, 4].find(qRange) || 1);
    S.axq = cur;
    const qb = [1, 2, 3, 4].map((q) => { const r = qRange(q), [k, txt, cls] = status(q);
      return `<button class="ax-qb ${q === cur ? "on" : ""} ${k === "arc" || k === "open" ? "done" : ""}" data-axq="${q}" aria-pressed="${q === cur}"><b>${q}-chorak</b><small>${r ? `${fmt(r[0]).slice(0, 5)} – ${fmt(r[1]).slice(0, 5)}` : "sanasi yo'q"}</small><span class="ax-chip ${cls}">${txt}</span><span class="ax-bar"><i style="width:${pct(r)}%"></i></span></button>`; }).join("");
    const r = qRange(cur), e = entry(cur), [k] = status(cur);
    const logs = a.log.filter((x) => x.q === cur);
    const logCard = `<section class="card ax-pad ax-log"><h2>Arxiv tarixi</h2>${logs.length ? `<div class="ax-ll">${logs.slice(-40).map((x) => `<div><time>${shortT(x.t)}</time><span>${esc(String(x.x || ""))}</span></div>`).join("")}</div>` : `<p class="muted ax-sm">Hali yozuv yo'q.</p>`}
      ${e ? `<button class="btn btn-link ax-unarc" data-axoff="${cur}">Arxivdan butunlay chiqarish…</button>` : ""}</section>`;
    let top, body = "";
    if (!r) top = `<div class="card ax-pad muted">${cur}-chorak sanalari belgilanmagan. «Sozlamalar → Dars kunlari va choraklar»da kiriting.</div>`;
    else if (e) {
      const miss = e.snap.filter((x) => x.set < x.n);
      top = `<div class="ax-ban ${isOpen(cur) ? "ax-o" : ""}"><span class="ax-ic">${isOpen(cur) ? "🔓" : "🗄"}</span><div class="ax-tx"><b>${cur}-chorak · ${shortT(e.at).slice(0, 5)} da arxivlangan${isOpen(cur) ? ` · ${untilTxt()} gacha ochiq` : ""}</b>
        <small>Natijalar arxivlangan paytdagidek saqlangan.${miss.length ? ` ${miss.map((x) => `${esc(x.cls)} da ${x.n - x.set} ta`).join(", ")} chorak bahosi qo'yilmay qolgan.` : ""}</small></div></div>`;
      body = summary(e.snap, cur, tel) + `<div class="ax-row">
        <button class="btn" data-axj="${cur}">📖 Jurnalda ko'rish</button><button class="btn" data-axpdf="${cur}">✈ PDF → Telegram</button><button class="btn" data-axjson>💾 Zaxira nusxa</button>
        ${isOpen(cur) ? `<button class="btn btn-primary" data-axrelock>🔒 Hozir qulflash</button>` : `<button class="btn" data-axopen="${cur}">🔓 Vaqtincha ochish</button>`}</div>`;
    } else {
      const txt = {now: `${fmt(r[1])} da tugaydi. ${autoOn() ? `${a.grace ? `${a.grace} kunlik tuzatish muddatidan keyin (${fmt(due(cur))})` : `Ertasi kuni (${fmt(due(cur))})`} avtomatik arxivlanadi.` : "Avtomatik arxivlash o'chiq."}`,
        wait: `${fmt(r[1])} da tugadi. ${fmt(due(cur))} kuni avtomatik arxivlanadi — kamchiliklarni hozir to'g'rilang.`, ended: `${fmt(r[1])} da tugagan, lekin arxivlanmagan — baholarni o'zgartirish mumkin.`,
        next: `${fmt(r[0])} da boshlanadi.`, fut: `${fmt(r[0])} da boshlanadi.`}[k] || "";
      top = `<div class="card ax-pad"><b>${cur}-chorak</b><p class="muted ax-sm" style="margin:6px 0 0">${txt}</p>${k === "wait" || k === "ended" ? `<div class="ax-row" style="margin-top:10px"><button class="btn btn-primary" data-axnow="${cur}">🗄 Hozir arxivlash</button></div>` : ""}</div>`;
      if (k === "wait" || k === "ended" || k === "now") body = `<h2 class="ax-h2">${k === "now" ? "Hozirgi holat" : "Natijalar (hozirgi)"}</h2>` + summary(stats(cur), cur, tel);
    }
    const yr = (() => { const r1 = qRange(1) || qRange(2), y = r1 ? +r1[0].slice(0, 4) : null; return y ? `${y}–${y + 1} o'quv yili · ` : ""; })();
    m.innerHTML = `<div class="ax">
      <div class="ax-hd"><div class="ax-hdt"><h1>Choraklar arxivi</h1><span class="muted">${yr}${D.classes.filter((c) => !isGrp(c)).length} sinf</span></div><button class="btn" data-axset>⚙ Sozlash</button></div>
      <div class="ax-qline">${qb}</div>${top}
      ${tel ? body + logCard : `<div class="ax-grid"><div class="ax-col">${body || ""}</div>${logCard}</div>`}</div>`;
  }
  function go2(q) { if (q) S.axq = +q; S.axBack = S.page === "archive" ? S.axBack : S.page; go("archive"); }

  /* ───────── PDF ───────── */
  function pdfHtml(q) {
    const e = entry(q), r = qRange(q), L = e ? e.snap : stats(q), td = "padding:7px 9px;border-bottom:1px solid #e3e7ee;text-align:right";
    return `<div class="bx-pg"><div style="font-size:18pt;font-weight:800;margin-bottom:4px">${q}-chorak natijalari</div>
      <div style="color:#667085;margin-bottom:16px">${fmt(r[0])} – ${fmt(r[1])}${e ? ` · ${shortT(e.at)} da arxivlangan` : ""}</div>
      <table style="width:100%;border-collapse:collapse;font-size:10.5pt"><tr>${["Sinf", "O'quvchi", "O'rtacha", "Sifat", "O'zlashtirish", "Davomat", "Chorak baholari"].map((x, i) => `<th style="${td};font-weight:700;color:#667085;${i ? "" : "text-align:left"}">${x}</th>`).join("")}</tr>
      ${L.map((x) => `<tr><td style="${td};text-align:left;font-weight:700">${esc(x.cls)}</td><td style="${td}">${x.n}</td><td style="${td}">${n1(x.avg)}</td><td style="${td}">${pc(x.q)}</td><td style="${td}">${pc(x.u)}</td><td style="${td}">${pc(x.att)}</td><td style="${td}">${x.set}/${x.n}</td></tr>`).join("")}</table>
      <div style="margin-top:14px;color:#667085;font-size:9pt">Sifat — chorak bahosi 4 va 5 olganlar ulushi. O'zlashtirish — o'rtacha natija (to'plangan ball ÷ 100). Yo'qlama jurnali.</div></div>`;
  }

  /* ───────── tugmalar (hamma sahifalar uchun bitta tinglovchi) ───────── */
  document.addEventListener("click", async (ev) => {
    const b = ev.target.closest("[data-axopen],[data-axrelock],[data-axpage],[data-axnow],[data-axfix],[data-axq],[data-axj],[data-axpdf],[data-axjson],[data-axoff],[data-axset],[data-axback],[data-axsw],[data-axgr]");
    if (!b || b.disabled) return;
    const d = b.dataset;
    if (d.axopen) return openDialog(+d.axopen);
    if (d.axrelock !== undefined) return relock();
    if (d.axpage !== undefined) return go2(d.axpage);
    if (d.axq) { S.axq = +d.axq; return render(); }
    if (d.axnow) {
      const q = +d.axnow;
      if (!await confirmBox(`${q}-chorakni arxivlash`, `${q}-chorak hozir arxivlanadi va baholari qulflanadi. Kerak bo'lsa keyin «Vaqtincha ochish» mumkin.`, "Arxivlash")) return;
      archive(q, "hand"); save(); render(); toast(`🗄 ${q}-chorak arxivlandi`); return;
    }
    if (d.axfix) { const [ci, q] = d.axfix.split("|").map(Number); S.ci = ci; S.jpage = "sum"; S.sq = q; return go("journal"); }
    if (d.axj) { const q = +d.axj, r = qRange(q); if (!r) return; const ci = D.classes.findIndex((c) => !isGrp(c)); if (ci < 0) return; if (isGrp(D.classes[S.ci])) S.ci = ci;
      S.jpage = "j"; V.mode = feat("vquarter") ? "quarter" : "month"; V.anchor = r[1]; return go("journal"); }
    if (d.axpdf) { const q = +d.axpdf; if (!qRange(q)) return; return PTG.run(() => PTG.pagesPdf([pdfHtml(q)], false), `${q}-chorak natijalari`, `🗄 ${q}-chorak natijalari (arxiv)`, b); }
    if (d.axjson !== undefined) return exportJson();
    if (d.axoff) {
      const q = +d.axoff, r = qRange(q);
      if (!await confirmBox("Arxivdan chiqarish", `${q}-chorak butunlay ochiladi: baholarni yana o'zgartirish mumkin bo'ladi va u avtomatik qayta qulflanmaydi. Keyin «Hozir arxivlash» bilan qayta arxivlash mumkin.`, "Arxivdan chiqarish")) return;
      if (D.settings.protect.enabled && cfg().ask && isLocked() && !await unlock()) return;
      const a = cfg(); delete a.q[q]; if (r && !a.off.includes(key(r))) a.off.push(key(r)); if (OPEN && OPEN.q === q) OPEN = null;
      addLog(q, "Arxivdan butunlay chiqarildi"); save(); render(); toast(`${q}-chorak arxivdan chiqarildi`); return;
    }
    if (d.axset !== undefined) { S.page = "settings"; S.sel = null; return SZL.goTo(1, "arx"); }
    if (d.axback !== undefined) return go(S.axBack && S.axBack !== "archive" ? S.axBack : "today");
    if (d.axsw) {
      const a = cfg(), k = d.axsw;
      if (k === "auto" && a.auto && !await confirmBox("Avtomatik arxivlash", "O'chirilsa, tugagan choraklar o'zi qulflanmaydi (arxivdagilari qulfligicha qoladi). O'chirilsinmi?", "O'chirish")) return;
      a[k] = !a[k]; save(); return render();
    }
    if (d.axgr !== undefined) { cfg().grace = GRACE[+d.axgr] ?? 3; save(); tick(); return render(); }
  });

  return {cfg, tick, entry, lockedQ, dateLocked, scoreQ, scoreLocked, deny, note, noteScore, banner, decorate, todayCard, page, openDialog, isOpen, due, status, GRACE, go: go2};
})();
