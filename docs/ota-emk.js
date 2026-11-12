/* Ota-onalar eMaktab'i — ota-ona login/paroli bilan uning nomidan eMaktab'ga kirib, sahifalarni ochib chiqish (Akmal tasdiqlagan maket,
   2026-11-11, /mnt/project-files/ota-ona-emaktab/ota-ona-maket.html). Sinf menyusi (⋯) → «Ota-onalar» → «🔑 eMaktab'ga kirish».
   - Faqat kirib chiqadi: sahifalar ochiladi, ichidagi baho/davomat/xabar o'qilmaydi va saqlanmaydi. Qoladigani — kim, qachon kirildi.
   - Kirish eMaktab importidagi kabi umumiy Google serveri orqali (EMKS.lib: auth, req) — har ota-onaning o'z seansi (cookie) bilan.
   - Hammasi faqat shu qurilmada, localStorage "yoqlama_ota_emk" da: jurnal ma'lumotiga (D), zaxira faylga va Telegram'ga kirmaydi.
   - Parol: «Saqlanmaydi» (asosiy) — faqat kirish kaliti qoladi; «PIN bilan» — parol PIN'dan yasalgan AES-GCM kaliti bilan shifrlanadi.
     PIN kaliti faqat xotirada (CryptoKey, o'qib bo'lmaydi), sahifa yopilsa qayta so'raladi; 5 marta noto'g'ri — parollar o'chadi.
   Asosiy skriptdan oldin ulanadi; D, EMKS, modal, toast, esc, $, h, normName, loadXlsx, isGrp faqat chaqirilganda ishlatiladi. */
const OTE = (() => {
  const KEY = "yoqlama_ota_emk", HOME = "https://schools.emaktab.uz/";
  const PAGES = [["bosh", "Bosh sahifa", null], ["kun", "Kundalik", /diary|dnevnik|kundalik|homework|schedule/i],
    ["bah", "Baholar", /marks|grades|progress|otsenk|baho/i], ["xab", "Xabarlar", /messag|messenger|mail|xabar|chat|notification/i]];
  const ST = {ok: ["ot-ok", "Ulangan"], old: ["ot-w", "Kalit eskirgan"], "2fa": ["ot-b", "Kod so'radi"], no: ["ot-n", "Ulanmagan"]};

  /* ───────── saqlash (faqat shu qurilma) ───────── */
  const load = () => { try { const o = JSON.parse(localStorage.getItem(KEY) || "null"); if (o && o.p) return o; } catch (e) { /* */ } return {store: "A", pin: null, p: {}, pg: {bosh: 1, kun: 1, bah: 1}, consent: false, who: "all"}; };
  let M = null;
  const db = () => (M = M || load());
  const put = () => { try { localStorage.setItem(KEY, JSON.stringify(db())); } catch (e) { toast("Qurilma xotirasiga yozib bo'lmadi"); } };
  const pk = (c, s) => `${normName(c.name)}|${normName(s.name)}`;
  const ent = (c, s) => db().p[pk(c, s)] || null;
  const today = () => new Date().toISOString().slice(0, 10);
  const stOf = (e) => (!e ? "no" : e.st || "ok");
  const ago = (t) => { if (!t) return "—"; const d = new Date(t), hm = d.toTimeString().slice(0, 5); const k = Math.round((new Date(today()) - new Date(d.toISOString().slice(0, 10))) / 864e5);
    return k <= 0 ? `bugun ${hm}` : k === 1 ? `kecha ${hm}` : `${k} kun oldin`; };
  const visitedToday = (e) => !!(e && e.at && new Date(e.at).toISOString().slice(0, 10) === today());

  /* ───────── PIN (faqat «PIN bilan» usulida) ───────── */
  let PK = null, bad = 0;   // PK — PIN'dan yasalgan kalit (o'qib bo'lmaydi), faqat xotirada
  const te = new TextEncoder(), td = new TextDecoder();
  const b64 = (u) => btoa(String.fromCharCode(...new Uint8Array(u))), unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  async function derive(pin, salt) {
    const base = await crypto.subtle.importKey("raw", te.encode(pin), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({name: "PBKDF2", salt, iterations: 200000, hash: "SHA-256"}, base, {name: "AES-GCM", length: 256}, false, ["encrypt", "decrypt"]);
  }
  async function seal(key, text) { const iv = crypto.getRandomValues(new Uint8Array(12)); return {iv: b64(iv), ct: b64(await crypto.subtle.encrypt({name: "AES-GCM", iv}, key, te.encode(text)))}; }
  const open_ = async (key, o) => td.decode(await crypto.subtle.decrypt({name: "AES-GCM", iv: unb64(o.iv)}, key, unb64(o.ct)));
  function pinSheet(title, sub) {
    return modal(`<div class="ot-pin"><h2>${esc(title)}</h2><div class="muted">${esc(sub)}</div>
      <form id="otpf"><input class="form-control" id="otpi" type="password" inputmode="numeric" autocomplete="off" maxlength="8" pattern="[0-9]{4,8}" placeholder="4–8 raqam" aria-label="PIN" required>
      <div class="hrow"><span class="sp"></span><button type="button" class="btn" data-x>Bekor qilish</button><button class="btn btn-primary" type="submit">Davom</button></div></form></div>`, (m, close) => {
      $("[data-x]", m).onclick = () => close(null);
      $("#otpf", m).onsubmit = (e) => { e.preventDefault(); const v = $("#otpi", m).value.trim(); if (/^\d{4,8}$/.test(v)) close(v); else toast("PIN 4–8 ta raqamdan iborat bo'lsin"); };
      setTimeout(() => $("#otpi", m).focus(), 50);
    });
  }
  async function setPin() {
    const a = await pinSheet("PIN o'rnating", "Ota-onalar parollari shu PIN bilan shifrlanadi. PIN hech qayerga yuborilmaydi; unutsangiz, parollarni qayta kiritasiz."); if (!a) return false;
    const b = await pinSheet("PIN'ni qayta kiriting", "Tasdiqlash uchun"); if (!b) return false;
    if (a !== b) { toast("PIN'lar mos kelmadi — qaytadan"); return false; }
    const salt = crypto.getRandomValues(new Uint8Array(16)); PK = await derive(a, salt); bad = 0;
    db().pin = {salt: b64(salt), chk: await seal(PK, "ok")}; put(); return true;
  }
  async function unlock() {
    if (PK) return true;
    const P = db().pin; if (!P) return false;
    const v = await pinSheet("PIN kiriting", "Saqlangan ota-onalar parollarini ochish uchun"); if (!v) return false;
    const k = await derive(v, unb64(P.salt));
    try { await open_(k, P.chk); PK = k; bad = 0; return true; }
    catch (e) {
      if (++bad >= 5) { wipePw(); toast("PIN 5 marta noto'g'ri: saqlangan parollar o'chirildi"); return false; }
      toast(`PIN noto'g'ri (${bad} / 5)`); return unlock();
    }
  }
  function wipePw() { const o = db(); for (const e of Object.values(o.p)) delete e.pw; o.pin = null; PK = null; bad = 0; put(); }

  /* ───────── eMaktab: kirish va sahifalarni ochish ───────── */
  const server = () => typeof EMKS !== "undefined" && EMKS.on() && !EMKS.old() && EMKS.lib;
  // bosh sahifadagi havolalardan tanlangan bo'limlar topiladi (sahifa mazmuni o'qilmaydi va saqlanmaydi)
  function links(r) {
    const doc = new DOMParser().parseFromString(String(r.b || ""), "text/html"), out = {};
    for (const a of doc.querySelectorAll("a[href]")) {
      let u; try { u = new URL(a.getAttribute("href"), r.url); } catch (e) { continue; }
      if (!/(^|\.)emaktab\.uz$/.test(u.hostname) || /logout|exit|chiqish/i.test(u.pathname)) continue;
      for (const [k, , re] of PAGES) if (re && !out[k] && re.test(u.pathname + " " + (a.textContent || ""))) out[k] = u.href;
    }
    return out;
  }
  // bitta ota-ona: seans bilan (eskirgan bo'lsa — saqlangan yoki berilgan parol bilan qayta kirib) tanlangan sahifalarni ochadi
  async function visit(c, s, cred) {
    const L = EMKS.lib, o = db(), k = pk(c, s), e = o.p[k] || {u: cred ? cred.u : ""}, sess = {c: e.c || []};
    let home = null;
    if (!cred && sess.c.length) { const r = await L.req(HOME, {s: sess}); if (!L.isLogin(r.url, r.b)) home = r; }
    if (!home) {
      let pw = cred && cred.p;
      if (!pw && e.pw && await unlock()) pw = await open_(PK, e.pw);
      if (!pw) { if (o.p[k]) { o.p[k].st = "old"; o.p[k].c = []; put(); } return {st: "old"}; }
      sess.c = [];
      try { home = await L.auth(sess, cred ? cred.u : e.u, pw, HOME); }
      catch (x) {
        if (x.twofa) { o.p[k] = Object.assign(e, {u: cred ? cred.u : e.u, st: "2fa", c: []}); delete o.p[k].pw; put(); return {st: "2fa"}; }
        if (x.badpw) return {st: "badpw", msg: x.message};
        throw x;
      }
      if (!home) return {st: "cancel"};
      if (cred) { e.u = cred.u; if (o.store === "B" && PK) e.pw = await seal(PK, cred.p); else delete e.pw; }
    }
    const want = PAGES.filter(([p]) => o.pg[p]), found = links(home);
    let n = o.pg.bosh ? 1 : 0;
    for (const [p] of want) if (p !== "bosh" && found[p]) { const r = await L.req(found[p], {s: sess, ref: home.url}); if (r.s < 400 && !L.isLogin(r.url, r.b)) n++; }
    o.p[k] = Object.assign(e, {st: "ok", c: sess.c, at: Date.now()}); put();
    return {st: "ok", n, miss: want.filter(([p]) => p !== "bosh" && !found[p]).map(([, t]) => t)};
  }

  /* ───────── asosiy oyna ───────── */
  const DR = {}, ED = {};   // DR — jadvalga yozilayotgan login/parol (faqat xotirada), ED — tahrirlanayotgan qatorlar
  let F = "all", Q = "", busy = false, ci0 = 0;
  const cls = () => D.classes[ci0];
  const editable = (c, s) => { const e = ent(c, s), st = stOf(e); return st === "no" || (st === "old" && !(e && e.pw)) || !!ED[pk(c, s)]; };
  const ready = (c, s) => { const e = ent(c, s), st = stOf(e); return st === "ok" || (st === "old" && !!(e && e.pw)); };
  const dr = (c, s) => DR[pk(c, s)] || (DR[pk(c, s)] = {l: (ent(c, s) || {}).u || "", p: ""});
  const pend = (c) => c.students.filter((s) => editable(c, s) && dr(c, s).l.trim() && dr(c, s).p);
  const FL = {all: "Hammasi", need: "Login/parol kerak", today: "Bugun kirilmagan", tfa: "Kod so'radi"};
  const pass = {all: () => true, need: (c, s) => editable(c, s) && !ED[pk(c, s)], today: (c, s) => ready(c, s) && !visitedToday(ent(c, s)), tfa: (c, s) => stOf(ent(c, s)) === "2fa"};
  const tag = (st) => `<span class="ot-tag ${ST[st][0]}">${ST[st][1]}</span>`;
  const phone = () => matchMedia("(max-width: 640px)").matches;

  function rowAct(c, s, si) {
    if (editable(c, s)) return `<button class="btn btn-sm btn-primary" data-otin="${si}">Kirish</button>${ED[pk(c, s)] ? ` <button class="btn btn-sm" data-oted="${si}" aria-label="Bekor qilish">✕</button>` : ""}`;
    if (stOf(ent(c, s)) === "2fa") return `<button class="btn btn-sm" data-ot2="${si}">Nima qilish?</button> <button class="btn btn-sm" data-oted="${si}" aria-label="Qayta urinish" title="Login/parolni qayta yozish">✎</button>`;
    return `<button class="btn btn-sm" data-otone="${si}">Kirib chiqish</button> <button class="btn btn-sm" data-oted="${si}" aria-label="Login yoki parolni o'zgartirish" title="Login/parolni o'zgartirish">✎</button>`;
  }
  function body() {
    const c = cls(), q = normName(Q);
    const R = c.students.map((s, si) => [s, si]).filter(([s]) => pass[F](c, s)).filter(([s]) => !q || normName(`${s.name} ${(s.par || {}).name || ""} ${(ent(c, s) || {}).u || ""}`).includes(q));
    if (!R.length) return `<div class="ot-empty" id="otb">Hech kim topilmadi. Qidiruvni yoki saralashni o'zgartiring.</div>`;
    const inL = (s, si) => `<input class="form-control ot-ci" data-otl="${si}" value="${esc(dr(c, s).l)}" placeholder="login" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="${esc(s.name)}: ota-ona logini">`;
    const inP = (s, si) => `<input class="form-control ot-ci" type="password" data-otp="${si}" value="${esc(dr(c, s).p)}" placeholder="parol" autocomplete="off" aria-label="${esc(s.name)}: ota-ona paroli">`;
    const par = (s) => (s.par || {}).name || "";
    const hl = (st) => st === "old" || st === "2fa" ? "ot-hl" : "";
    if (phone()) return `<div class="ot-cards" id="otb">${R.map(([s, si]) => { const e = ent(c, s), st = stOf(e);
      return editable(c, s)
        ? `<div class="ot-cd ot-col ${hl(st)}"><div class="ot-cr"><span class="ot-nn">${si + 1}</span><div class="ot-tx"><b>${esc(s.name)}</b><small>${par(s) ? esc(par(s)) + " · " : ""}${st === "old" ? "kalit eskirgan, parolni qayta kiriting" : st === "no" ? "ota-ona logini va paroli" : ""}</small></div>${st === "no" ? "" : tag(st)}</div>
           <div class="ot-cf">${inL(s, si)}${inP(s, si)}${rowAct(c, s, si)}</div></div>`
        : `<div class="ot-cd ${hl(st)}"><span class="ot-nn">${si + 1}</span><div class="ot-tx"><b>${esc(s.name)}</b><small>${par(s) ? esc(par(s)) + " · " : ""}${ago(e && e.at)}</small><span>${tag(st)} <span class="ot-mut">${esc(e.u || "")}</span></span></div><span class="ot-ra">${rowAct(c, s, si)}</span></div>`; }).join("")}</div>`;
    return `<div class="ot-tw" id="otb"><table class="table ot-t"><thead><tr><th>№</th><th>O'quvchi</th><th>eMaktab login</th><th>Parol</th><th>Holat</th><th>Oxirgi kirish</th><th></th></tr></thead><tbody>${R.map(([s, si]) => {
      const e = ent(c, s), st = stOf(e), ed = editable(c, s);
      return `<tr class="${hl(st)} ${ed ? "ot-ed" : ""}"><td class="ot-n">${si + 1}</td><td><b>${esc(s.name)}</b>${par(s) ? `<small class="ot-sub">${esc(par(s))}</small>` : ""}</td>
        <td>${ed ? inL(s, si) : esc((e && e.u) || "")}</td><td>${ed ? inP(s, si) : st === "2fa" ? "—" : `<span class="ot-mut">${e && e.pw ? "🔒 shifrlangan" : "saqlanmagan"}</span>`}</td>
        <td>${tag(st)}</td><td class="ot-n">${ago(e && e.at)}</td><td class="ot-a">${rowAct(c, s, si)}</td></tr>`; }).join("")}</tbody></table></div>`;
  }
  const bulkBtn = () => { const n = pend(cls()).length; return n > 1 ? `<button class="btn btn-primary" data-otall>Kiritilganlarga kirish · ${n}</button>` : ""; };
  function view() {
    const c = cls(), o = db(), S_ = c.students, ok = S_.filter((s) => stOf(ent(c, s)) === "ok").length, td_ = S_.filter((s) => stOf(ent(c, s)) === "ok" && visitedToday(ent(c, s))).length;
    const cnt = Object.fromEntries(Object.keys(FL).map((k) => [k, S_.filter((s) => pass[k](c, s)).length]));
    const srv = server();
    return `<div class="ot-hd"><span class="ek-ic" aria-hidden="true">e</span><div class="ot-tx"><h2>eMaktab'ga kirish · ${esc(label(c))}</h2><small>Ota-ona nomidan kirib chiqish · o'quvchi ma'lumoti olinmaydi</small></div><button class="btn btn-sm" data-x aria-label="Yopish">✕</button></div>
      ${srv ? "" : `<div class="ot-warn"><b>Server ulanmagan.</b> Bu bo'lim eMaktab importidagi «Login va parol» usuli kabi Google server orqali ishlaydi: avval Sozlamalar → Telegram'da serverni ulang.</div>`}
      <div class="ot-sum"><div><b>${ok} / ${S_.length}</b><small>ulangan</small></div><div><b>${td_} / ${ok}</b><small>bugun kirildi</small></div><div><b>${cnt.need}</b><small>login/parol kerak</small></div><div><b>${cnt.tfa}</b><small>kod so'radi</small></div></div>
      <div class="ot-tools"><input class="form-control" id="otq" type="search" placeholder="O'quvchi, ota-ona yoki login" aria-label="Qidirish" value="${esc(Q)}" autocomplete="off"><span id="otbulk">${bulkBtn()}</span><button class="btn" data-otxl>Excel'dan</button><button class="btn btn-primary" data-otrun>Aylanib chiqish</button></div>
      <div class="ot-chips" role="tablist" aria-label="Saralash">${Object.entries(FL).map(([k, n]) => `<button role="tab" aria-selected="${F === k}" class="${F === k ? "on" : ""}" data-otf="${k}">${n} <b>${cnt[k]}</b></button>`).join("")}</div>
      <label class="ot-chk"><input type="checkbox" id="otcons" ${o.consent ? "checked" : ""}><span>Ota-onalar roziligini oldim: ularning hisobiga men kiraman</span></label>
      ${body()}
      <div class="ot-mut">Login va parolni jadvalga yozing, Enter yoki «Kirish». ${o.store === "B" ? "Parol PIN bilan shifrlanib saqlanadi." : "Kirgandan keyin parol o'chadi, faqat kirish kaliti qoladi."} eMaktab bu kirishlarni ota-onaning o'z kirishi deb yozadi.</div>
      <div class="ot-foot"><span class="ot-mut">Parol:</span><div class="ot-seg" role="radiogroup" aria-label="Parolni saqlash"><button role="radio" aria-checked="${o.store === "A"}" class="${o.store === "A" ? "on" : ""}" data-otst="A">Saqlanmaydi</button><button role="radio" aria-checked="${o.store === "B"}" class="${o.store === "B" ? "on" : ""}" data-otst="B">PIN bilan</button></div><span class="sp"></span><button class="btn btn-outline-danger btn-sm" data-otwipe>Bu sinfni tozalash</button></div>`;
  }

  let MM = null;
  function draw() {
    if (!MM || !MM.isConnected) return;
    const card = $(".card", MM), y = ($("#otb", MM) || {}).scrollTop || 0, f = document.activeElement, fid = f && f.dataset && (f.dataset.otl ? "otl=" + f.dataset.otl : f.dataset.otp ? "otp=" + f.dataset.otp : f.id === "otq" ? "q" : "");
    card.innerHTML = view(); bind(card);
    const b = $("#otb", card); if (b) b.scrollTop = y;
    if (fid) { const el = fid === "q" ? $("#otq", card) : $(`[data-${fid.replace("=", '="')}"]`, card); if (el) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) { /* */ } } }
  }
  const needConsent = () => { if (db().consent) return false; toast("Avval «Ota-onalar roziligini oldim» belgisini qo'ying"); const x = $("#otcons", MM); if (x) x.focus(); return true; };
  async function storeB() { if (db().store === "B" && !db().pin && !await setPin()) { db().store = "A"; put(); toast("PIN o'rnatilmadi: parollar saqlanmaydi"); } else if (db().store === "B") await unlock(); }

  async function connect(list) {   // list: [[s, {u, p}]] — jadvaldan yoki Excel'dan
    if (!server()) { toast("Server ulanmagan: Sozlamalar → Telegram"); return; }
    if (needConsent() || busy || !list.length) return;
    await storeB();
    await runner(list.map(([s, cred]) => ({s, cred})), "Ota-onalarga kirilmoqda");
  }
  // ketma-ket ishlovchi: har ota-onaga navbat bilan; rasmdagi kod chiqsa — so'raladi (EMKS oynasi)
  async function runner(jobs, title) {
    const c = cls(); busy = true; let stop = false;
    const res = {ok: 0, old: 0, "2fa": 0, badpw: 0, err: 0, cancel: 0}, errs = [];
    const pm = h(`<div class="modal" role="dialog" aria-modal="true"><div class="card ot-run"><h2>${esc(title)}…</h2><div class="ot-prog"><i></i></div><div class="ot-rn"><b data-k>0 / ${jobs.length}</b><span class="sp"></span><span class="ot-mut" data-w></span></div>
      <div class="ot-rl">${jobs.map((j, i) => `<div class="ot-rr" data-i="${i}"><span class="ot-nn">${c.students.indexOf(j.s) + 1}</span><span class="ot-tx">${esc(j.s.name)}</span><span class="ot-tag ot-n">navbatda</span></div>`).join("")}</div>
      <div class="ot-mut">Sahifalar faqat ochiladi, ichidagi ma'lumot o'qilmaydi. Telefonda ekranni o'chirmang.</div><div class="hrow"><span class="sp"></span><button class="btn" data-stop>To'xtatish</button></div></div></div>`);
    document.body.append(pm); $("[data-stop]", pm).onclick = () => { stop = true; $("[data-stop]", pm).disabled = true; $("[data-stop]", pm).textContent = "To'xtatilmoqda…"; };
    let lock = null; try { lock = await navigator.wakeLock.request("screen"); } catch (e) { /* */ }
    const mark = (i, cl, t) => { const r = $(`[data-i="${i}"] .ot-tag`, pm); if (r) { r.className = `ot-tag ${cl}`; r.textContent = t; } };
    let done = 0;
    for (const [i, j] of jobs.entries()) {
      if (stop) break;
      mark(i, "ot-n", "ochilmoqda…"); const row = $(`[data-i="${i}"]`, pm); row.classList.add("cur"); row.scrollIntoView({block: "nearest"});
      try {
        const r = await visit(c, j.s, j.cred); res[r.st]++;
        if (r.st === "ok") { mark(i, "ot-ok", `✓ ${r.n} sahifa`); if (j.cred) { const d = dr(c, j.s); d.p = ""; delete ED[pk(c, j.s)]; } }
        else if (r.st === "old") mark(i, "ot-w", "parol kerak");
        else if (r.st === "2fa") mark(i, "ot-b", "kod so'radi");
        else if (r.st === "badpw") { mark(i, "ot-b", "parol noto'g'ri"); errs.push(`${j.s.name}: login yoki parol noto'g'ri`); }
        else mark(i, "ot-w", "o'tkazildi");
      } catch (e) { res.err++; mark(i, "ot-b", "xato"); errs.push(`${j.s.name}: ${String(e.message || e).split("\n")[0]}`); if (/Serverga ulanib/.test(e.message)) stop = true; }
      row.classList.remove("cur"); done++;
      $("[data-k]", pm).textContent = `${done} / ${jobs.length}`; $(".ot-prog i", pm).style.width = `${(100 * done) / jobs.length}%`;
    }
    try { lock && lock.release(); } catch (e) { /* */ }
    busy = false; pm.remove(); draw();
    const left = jobs.length - done;
    await modal(`<h2>${stop ? "To'xtatildi" : "Tayyor"}</h2>
      <div class="ot-res"><div class="g"><b>${res.ok}</b><small>kirildi</small></div><div class="w"><b>${res.old + res.cancel + left}</b><small>keyinga qoldi</small></div><div class="r"><b>${res.badpw + res["2fa"] + res.err}</b><small>kirilmadi</small></div></div>
      ${res.old ? `<div class="ot-mut">${res.old} ta ota-onaning kirish kaliti eskirgan: jadvalga parolini qayta yozing.</div>` : ""}
      ${res["2fa"] ? `<div class="ot-mut">${res["2fa"]} ta ota-ona uchun eMaktab tasdiqlash kodini so'radi — bu ota-onalar o'zi kirishi kerak.</div>` : ""}
      ${errs.length ? `<div class="ot-errs">${errs.slice(0, 8).map((x) => `<div>${esc(x)}</div>`).join("")}</div>` : ""}
      <div class="ot-mut">Ilovada faqat «Oxirgi kirish» vaqti yangilandi. Boshqa hech narsa saqlanmadi.</div>
      <div class="hrow"><span class="sp"></span><button class="btn btn-primary" data-x>Yopish</button></div>`, (m, close) => { $("[data-x]", m).onclick = () => close(); });
  }

  function runDialog() {
    const c = cls(), o = db();
    if (!server()) { toast("Server ulanmagan: Sozlamalar → Telegram"); return; }
    if (needConsent()) return;
    const all = c.students.filter((s) => ready(c, s)), skip = c.students.length - all.length;
    return modal(`<h2>Aylanib chiqish</h2><div class="muted">Har bir ota-ona nomidan kirib, tanlangan sahifalarni ochib chiqadi. Sahifalardagi ma'lumot o'qilmaydi.</div>
      <div class="ot-opt" role="radiogroup" aria-label="Kimlar"><b>Kimlar</b>
        <label><input type="radio" name="otwho" value="all" ${o.who !== "today" ? "checked" : ""}> Hamma tayyorlar · ${all.length} ta</label>
        <label><input type="radio" name="otwho" value="today" ${o.who === "today" ? "checked" : ""}> Faqat bugun kirilmaganlar · ${all.filter((s) => !visitedToday(ent(c, s))).length} ta</label></div>
      ${skip ? `<div class="ot-warn">Bular kirmaydi: ${skip} ta (ulanmagan, kaliti eskirgan yoki kod so'raydigan). Ularning login/parolini jadvalga yozing.</div>` : ""}
      <div class="ot-opt"><b>Qaysi sahifalar ochilsin</b>${PAGES.map(([k, t]) => `<label><input type="checkbox" data-pg="${k}" ${o.pg[k] ? "checked" : ""}> ${t}</label>`).join("")}</div>
      <div class="hrow"><span class="sp"></span><button class="btn" data-x>Bekor qilish</button><button class="btn btn-primary" data-ok>Boshlash</button></div>`, (m, close) => {
      $("[data-x]", m).onclick = () => close(null);
      $("[data-ok]", m).onclick = () => {
        const pg = Object.fromEntries([...m.querySelectorAll("[data-pg]")].filter((x) => x.checked).map((x) => [x.dataset.pg, 1]));
        if (!Object.keys(pg).length) { toast("Kamida bitta sahifani tanlang"); return; }
        o.pg = pg; o.who = $("[name=otwho]:checked", m).value; put();
        const list = all.filter((s) => o.who !== "today" || !visitedToday(ent(c, s)));
        if (!list.length) { toast("Kirib chiqiladigan ota-ona yo'q"); return; }
        close(list);
      };
    }).then(async (list) => { if (!list) return; if (o.store === "B" && list.some((s) => stOf(ent(c, s)) === "old") && !await unlock()) return; await runner(list.map((s) => ({s})), "Aylanib chiqilmoqda"); });
  }

  /* ───────── Excel yoki matndan ───────── */
  const flip = (n) => normName(n).split(" ").reverse().join(" ");
  function match(c, raw) {
    const n = normName(raw); if (!n) return null;
    return c.students.find((s) => normName(s.name) === n || flip(s.name) === n) || c.students.find((s) => n.startsWith(normName(s.name)) || n.startsWith(flip(s.name))) || null;
  }
  // har qator: [ism, login, parol] — Excel ustunlari yoki tab/«;» bilan ajratilgan matn (bo'lmasa — oxirgi ikki so'z login va parol)
  const parseText = (t) => t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => { const p = l.split(/\t|;|\s{2,}/).map((x) => x.trim()).filter(Boolean);
    if (p.length >= 3) return [p.slice(0, p.length - 2).join(" "), p[p.length - 2], p[p.length - 1]]; const w = l.split(/\s+/); return w.length >= 3 ? [w.slice(0, -2).join(" "), w[w.length - 2], w[w.length - 1]] : null; }).filter(Boolean);
  async function parseXlsx(file, c) {
    const X = await loadXlsx(), wb = X.read(new Uint8Array(await file.arrayBuffer()), {type: "array"}), out = [];
    for (const n of wb.SheetNames) for (const r of X.utils.sheet_to_json(wb.Sheets[n], {header: 1, raw: false, defval: ""})) {
      const cells = r.map((x) => String(x).trim()).filter(Boolean); if (cells.length < 3) continue;
      let i = c ? cells.findIndex((x) => match(c, x)) : -1; if (i < 0) i = cells.findIndex((x) => /\p{L}{2,}\s+\p{L}{2,}/u.test(x)); if (i < 0 || i + 2 >= cells.length) continue;
      out.push([cells[i], cells[i + 1], cells[i + 2]]);
    }
    return out;
  }
  // namuna fayl: shu sinfning o'quvchilari ismi bilan, Login va Parol ustunlari bo'sh (parseXlsx uni qayta o'qiy oladi)
  async function template(c) {
    const X = await loadXlsx(), aoa = [["№", "O'quvchi", "Login", "Parol"], ...c.students.map((s, i) => [i + 1, s.name, "", ""])];
    const ws = X.utils.aoa_to_sheet(aoa); ws["!cols"] = [{wch: 5}, {wch: 34}, {wch: 22}, {wch: 22}];
    const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, "Ota-onalar"); X.writeFile(wb, `ota-onalar-${label(c).replace(/[^\p{L}\p{N}]+/gu, "-")}.xlsx`);
  }
  function xlDialog() {
    const c = cls(); let rows = [];
    const table = () => { const used = new Set(); return rows.length ? `<div class="ot-tw ot-pv"><table class="table ot-t"><thead><tr><th>Ro'yxatdagi ism</th><th>Jurnaldagi o'quvchi</th><th>Login</th><th></th></tr></thead><tbody>${rows.map((r, i) => {
      if (r.s) used.add(r.s);
      return `<tr class="${r.s ? "" : "ot-hl"}"><td>${esc(r.n)}</td><td>${r.s ? `${c.students.indexOf(r.s) + 1}. ${esc(r.s.name)}` : `<select class="form-select form-select-sm" data-xs="${i}" aria-label="O'quvchini tanlang"><option value="">— tanlang —</option>${c.students.map((s, si) => `<option value="${si}">${si + 1}. ${esc(s.name)}</option>`).join("")}</select>`}</td><td>${esc(r.u)}</td><td>${r.s ? `<span class="ot-tag ot-ok">✓ topildi</span>` : `<span class="ot-tag ot-w">? topilmadi</span>`}</td></tr>`; }).join("")}</tbody></table></div>` : ""; };
    return modal(`<h2>Excel'dan ulash · ${esc(label(c))}</h2><div class="muted">Ustunlar: <b>o'quvchi · login · parol</b>. Ism tartibi muhim emas. Fayl ilovada saqlanmaydi.</div>
      <details class="ot-guide"><summary>Yo'riqnoma: fayldan qanday import qilinadi</summary><ol>
        <li><b>«Namuna yuklab olish»</b> tugmasini bosing: ${c.students.length} ta o'quvchi ismi yozilgan Excel fayl tushadi.</li>
        <li>Faylda <b>Login</b> va <b>Parol</b> ustunlariga har bir ota-onaning eMaktab login va parolini yozing. Ismlarni o'zgartirmang, tartibi muhim emas. Login/paroli yo'q qatorni bo'sh qoldiring, u o'tkazib yuboriladi.</li>
        <li>Faylni saqlang va <b>«Excel tanlash»</b> bilan tanlang. Yoki Excel'dan ism, login, parol ustunlarini nusxalab pastdagi maydonga qo'yib <b>«Matndan o'qish»</b> ni bosing.</li>
        <li>Jadvalda har bir ism jurnaldagi o'quvchiga mos kelganini tekshiring: <span class="ot-tag ot-ok">✓ topildi</span> to'g'ri, <span class="ot-tag ot-w">? topilmadi</span> bo'lsa ro'yxatdan o'quvchini o'zingiz tanlang.</li>
        <li>Ota-onalar roziligini belgilab <b>«N ta ota-onaga kirish»</b> ni bosing. Kirish bir necha daqiqa oladi, ekranni o'chirmang.</li>
        <li>Tugagach <b>faylni o'chirib tashlang</b>: unda parollar ochiq turibdi. Ilova faylni ham, parolni ham saqlamaydi (PIN rejimidan tashqari).</li></ol>
        <div class="ot-mut">Ustun tartibi: ism, login, parol (yonma-yon). Telefonda fayl tanlashda «Excel tanlash» ishlamasa, matn usulidan foydalaning.</div></details>
      <div class="ot-drop"><span class="sp">Excel fayl (.xlsx, .xls) yoki pastga nusxalab qo'ying</span><button class="btn btn-sm" data-xt>Namuna yuklab olish</button><button class="btn btn-sm" data-xf>Excel tanlash</button></div>
      <textarea class="form-control ot-ta" id="otxt" spellcheck="false" placeholder="Abdullayev Jasur	jasur_ota	parol123&#10;Aliyeva Madina; madina2010; parol456"></textarea>
      <button class="btn" data-xp>Matndan o'qish</button>
      <div id="otxv"></div>
      <div class="ot-mut">Kirib bo'lgach <b>Excel faylni o'chirib tashlang</b>: unda parollar ochiq turibdi.</div>
      <label class="ot-chk"><input type="checkbox" id="otxc" ${db().consent ? "checked" : ""}><span>Ro'yxatdagi barcha ota-onalar rozi</span></label>
      <div class="hrow"><span class="sp"></span><button class="btn" data-x>Bekor qilish</button><button class="btn btn-primary" data-ok disabled>Kirish</button></div>`, (m, close) => {
      $(".card", m).classList.add("wide");
      const show = () => {
        $("#otxv", m).innerHTML = table(); const n = rows.filter((r) => r.s).length, ok = $("[data-ok]", m);
        ok.disabled = !n; ok.textContent = n ? `${n} ta ota-onaga kirish` : "Kirish";
        m.querySelectorAll("[data-xs]").forEach((x) => x.onchange = () => { rows[+x.dataset.xs].s = x.value === "" ? null : c.students[+x.value]; show(); });
      };
      const take = (list) => { rows = list.map(([n, u, p]) => ({n, u, p, s: match(c, n)})); show(); if (!rows.length) toast("Ro'yxatdan qator topilmadi: har qatorda ism, login va parol bo'lsin"); };
      $("[data-xt]", m).onclick = async () => { try { await template(c); toast("Namuna yuklandi: Login va Parol ustunlarini to'ldiring"); } catch (e) { toast(e.message || "Namunani yaratib bo'lmadi"); } };
      $("[data-xp]", m).onclick = () => take(parseText($("#otxt", m).value));
      $("[data-xf]", m).onclick = () => { const f = document.createElement("input"); f.type = "file"; f.accept = ".xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        f.onchange = async () => { if (!f.files[0]) return; try { take(await parseXlsx(f.files[0], c)); } catch (e) { toast(e.message || "Faylni o'qib bo'lmadi"); } }; f.click(); };
      $("[data-x]", m).onclick = () => close(null);
      $("[data-ok]", m).onclick = () => {
        if (!$("#otxc", m).checked) { toast("Ota-onalar roziligini belgilang"); return; }
        db().consent = true; put();
        const seen = new Set(), list = rows.filter((r) => r.s && !seen.has(r.s) && seen.add(r.s)).map((r) => [r.s, {u: r.u, p: r.p}]);
        rows = []; close(list);
      };
    }).then((list) => list && connect(list));
  }

  /* ───────── hodisalar ───────── */
  function bind(card) {
    const c = cls(), o = db(), S_ = c.students;
    $("[data-x]", card).onclick = () => MM._close(null);
    $("#otq", card).oninput = (e) => { Q = e.target.value; const b = $("#otb", card); if (b) { b.outerHTML = body(); bindRows(card); } };
    card.querySelectorAll("[data-otf]").forEach((b) => b.onclick = () => { F = b.dataset.otf; draw(); });
    $("#otcons", card).onchange = (e) => { o.consent = e.target.checked; put(); };
    $("[data-otxl]", card).onclick = () => xlDialog();
    $("[data-otrun]", card).onclick = () => runDialog();
    card.querySelectorAll("[data-otst]").forEach((b) => b.onclick = async () => {
      const v = b.dataset.otst; if (v === o.store) return;
      if (v === "A") { o.store = "A"; wipePw(); toast("Parollar o'chirildi, faqat kirish kalitlari qoldi"); }
      else { o.store = "B"; put(); if (await setPin()) toast("Bundan keyin kiritilgan parollar PIN bilan saqlanadi"); else { o.store = "A"; put(); } }
      put(); draw();
    });
    const wipe = $("[data-otwipe]", card);
    wipe.onclick = () => {
      if (!wipe.classList.contains("sure")) { wipe.classList.add("sure"); wipe.textContent = "Rostdan o'chirilsinmi? Yana bosing"; setTimeout(() => { if (wipe.isConnected) { wipe.classList.remove("sure"); wipe.textContent = "Bu sinfni tozalash"; } }, 3500); return; }
      for (const s of S_) { delete o.p[pk(c, s)]; delete DR[pk(c, s)]; } put(); toast(`${label(c)}: ota-onalar loginlari va kirish kalitlari o'chirildi`); draw();
    };
    bindRows(card);
  }
  function bindRows(card) {
    const c = cls(), S_ = c.students, root = $("#otb", card) ? card : card;
    root.querySelectorAll("[data-otl],[data-otp]").forEach((x) => {
      x.oninput = () => { const s = S_[+(x.dataset.otl || x.dataset.otp)]; dr(c, s)[x.dataset.otl ? "l" : "p"] = x.value; $("#otbulk", card).innerHTML = bulkBtn(); const bb = $("[data-otall]", card); if (bb) bb.onclick = all; };
      x.onkeydown = (e) => { if (e.key !== "Enter") return; e.preventDefault(); const i = x.dataset.otl || x.dataset.otp;
        if (x.dataset.otl) { const p = $(`[data-otp="${i}"]`, card); if (p) p.focus(); } else { const b = $(`[data-otin="${i}"]`, card); if (b) b.click(); } };
    });
    root.querySelectorAll("[data-otin]").forEach((b) => b.onclick = () => {
      const s = S_[+b.dataset.otin], d = dr(c, s);
      if (!d.l.trim() || !d.p) { toast("Login va parolni kiriting"); const el = $(`[data-${d.l.trim() ? "otp" : "otl"}="${b.dataset.otin}"]`, card); if (el) el.focus(); return; }
      connect([[s, {u: d.l.trim(), p: d.p}]]);
    });
    const all = () => connect(pend(c).map((s) => [s, {u: dr(c, s).l.trim(), p: dr(c, s).p}]));
    const bb = $("[data-otall]", card); if (bb) bb.onclick = all;
    root.querySelectorAll("[data-oted]").forEach((b) => b.onclick = () => { const s = S_[+b.dataset.oted], k = pk(c, s); if (ED[k]) { delete ED[k]; dr(c, s).p = ""; } else ED[k] = 1; draw(); });
    root.querySelectorAll("[data-otone]").forEach((b) => b.onclick = async () => {
      if (!server()) { toast("Server ulanmagan: Sozlamalar → Telegram"); return; }
      if (needConsent() || busy) return;
      const s = S_[+b.dataset.otone]; b.disabled = true; b.textContent = "Ochilmoqda…"; busy = true;
      try { const r = await visit(c, s);
        toast(r.st === "ok" ? `${s.name}: ota-ona nomidan kirildi, ${r.n} sahifa ochildi${r.miss && r.miss.length ? ` (topilmadi: ${r.miss.join(", ")})` : ""}` : r.st === "old" ? `${s.name}: kirish kaliti eskirgan — parolni qayta kiriting` : r.st === "2fa" ? `${s.name}: eMaktab tasdiqlash kodini so'radi` : r.st === "badpw" ? `${s.name}: login yoki parol noto'g'ri` : "Bekor qilindi");
      } catch (e) { toast(`${s.name}: ${String(e.message || e).split("\n")[0]}`); }
      finally { busy = false; draw(); }
    });
    root.querySelectorAll("[data-ot2]").forEach((b) => b.onclick = () => toast("eMaktab bu ota-onadan SMS/tasdiqlash kodini so'raydi. Ilova kodni kirita olmaydi, ota-ona o'zi kirishi kerak. Ota-ona tasdiqlashni o'chirsa, ✎ bilan qayta urinib ko'ring."));
  }

  function open(ci) {
    ci0 = ci; F = "all"; Q = "";
    const c = cls(); if (!c || isGrp(c)) return;
    return modal(`<div class="ot-wrap"></div>`, (m, close) => {
      MM = m; const card = $(".card", m); card.classList.add("wide", "ot-card");
      draw();
      let pw = phone(); const on = () => { if (!m.isConnected) { removeEventListener("resize", on); return; } if (phone() !== pw) { pw = phone(); draw(); } }; addEventListener("resize", on);
      const cl = m._close; m._close = (v) => { removeEventListener("resize", on); MM = null; cl(v); };
    });
  }
  // sinf menyusidagi tugma uchun: «ulangan / jami»
  const count = (c) => c.students.filter((s) => stOf(ent(c, s)) === "ok").length;
  return {open, count, _t: {links, parseText, match, parseXlsx, template, load: () => (M = null, db())}};
})();
