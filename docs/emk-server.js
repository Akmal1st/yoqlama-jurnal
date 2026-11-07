/* eMaktab'dan import — ilovaning o'zidan, xatcho'psiz (Akmal, 2026-11-06, maket /mnt/project-files/emaktab-import/xatchopsiz-maket.html).
   Brauzer ilovaga emaktab.uz ni o'qishga ruxsat bermaydi, shuning uchun har bir so'rovni umumiy Google serveri (bot-server/gas/Code.gs,
   {a:"emk"}) bajaradi va javobni qaytaradi. Kirish (login, parol, kerak bo'lsa rasmdagi kod), sinflar ro'yxati, chorak va Excel —
   hammasi shu yerda; sahifalarni o'qish xatcho'p bilan umumiy (emkLib, index.html).
   - Parol hech qayerda saqlanmaydi: faqat kirish so'rovida eMaktab'ga uzatiladi.
   - eMaktab bergan cookie (kirish kaliti) faqat shu qurilmada, localStorage "yoqlama_emk_sess" da — jurnal ma'lumotiga (D) va
     Telegram zaxirasiga kirmaydi. «Uzish» uni o'chiradi; eskirsa parol qayta so'raladi.
   Asosiy skriptdan oldin ulanadi; TGU, EMK1, emkLib, modal, toast va h.k. faqat chaqirilganda ishlatiladi. */
const EMKS = (() => {
  const KEY = "yoqlama_emk_sess";
  const U = {my: "https://schools.emaktab.uz/v2/myclasses", login: "https://login.emaktab.uz/", excel: "https://schools.emaktab.uz/v2/excel"};
  const load = () => { try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); return s && Array.isArray(s.c) ? s : null; } catch (e) { return null; } };
  const store = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* xotira yopiq — seans faqat shu safar */ } };
  const clear = () => { try { localStorage.removeItem(KEY); } catch (e) {} };
  let S = null;   // {u: login, c: [{n, v, d, h}]} — joriy seans
  const on = () => typeof TGU !== "undefined" && TGU.gas();
  const linked = () => !!(load() || {}).u;

  /* ───────── cookie ───────── */
  function setCookies(list, url) {
    const host = new URL(url).hostname;
    for (const line of list || []) {
      const [nv, ...attrs] = String(line).split(";"), i = nv.indexOf("="); if (i < 1) continue;
      const n = nv.slice(0, i).trim(), v = nv.slice(i + 1).trim(); let d = host, h = true, dead = !v;
      for (const a of attrs) {
        const [k, x = ""] = a.split("="), key = k.trim().toLowerCase(), val = x.trim();
        if (key === "domain" && val) { d = val.replace(/^\./, "").toLowerCase(); h = false; }
        if (key === "max-age" && Number(val) <= 0) dead = true;
        if (key === "expires" && Date.parse(val) < Date.now()) dead = true;
      }
      S.c = S.c.filter((c) => !(c.n === n && c.d === d));
      if (!dead) S.c.push({n, v, d, h});
    }
  }
  const cookieFor = (url) => { const host = new URL(url).hostname; return S.c.filter((c) => c.h ? host === c.d : host === c.d || host.endsWith("." + c.d)).map((c) => `${c.n}=${c.v}`).join("; "); };

  /* ───────── server orqali so'rov ───────── */
  async function call(r) {
    let j;
    try { j = await (await fetch(TGU.url(), {method: "POST", body: JSON.stringify({a: "emk", r}), cache: "no-store"})).json(); }
    catch (e) { throw new Error("Serverga ulanib bo'lmadi. Internetni tekshiring."); }
    if (j && j.error_code === 404) throw Object.assign(new Error("Serverda bu imkoniyat hali yoqilmagan — hozircha xatcho'p usuli."), {old: true});
    if (!j || !j.ok) throw new Error(`Server xatosi: ${(j && j.description) || "noma'lum"}`);
    return j.r;
  }
  // qayta yo'naltirishlar shu yerda kuzatiladi (cookie har qadamda yangilanadi)
  async function req(url, {post = null, bin = false, ref = ""} = {}) {
    for (let k = 0; k < 10; k++) {
      const [x] = await call([{u: url, m: post ? "post" : "get", d: post || "", c: cookieFor(url), ref, bin: bin ? 1 : 0}]);
      if (!x || x.e) throw new Error(`eMaktab'ga ulanib bo'lmadi: ${(x && x.e) || "javob yo'q"}`);
      setCookies(x.c, url);
      if (x.s >= 300 && x.s < 400 && x.l) { ref = url; url = new URL(x.l, url).href; if (x.s !== 307 && x.s !== 308) post = null; continue; }
      return {s: x.s, url, b: x.b, t: x.t || ""};
    }
    throw new Error("eMaktab sahifasi juda ko'p qayta yo'naltirdi");
  }
  const isLogin = (url, html) => /<input[^>]+(type=["']?password|name=["']?password["'\s>])/i.test(html) ? true
    : /<form[^>]+action=["'][^"']*\/logout/i.test(html) ? false : /^login\./i.test(new URL(url).hostname);

  /* ───────── kirish (dastur/emaktab_http.py dagi tartib) ─────────
     1) login va parol bilan «Kirish»; 2) yana kirish sahifasi chiqsa — rasmdagi kod so'raladi; kod yo'q bo'lsa — parol noto'g'ri */
  const unjs = (t) => t.replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\\//g, "/");
  const isPw = (i) => i.type === "password" || (i.type === "text" && (/^(pass(word)?|parol)$/i.test(i.name) || /password/i.test(i.cls)));
  const uuid = () => { if (crypto.randomUUID) return crypto.randomUUID(); const x = [...crypto.getRandomValues(new Uint8Array(16))].map((v) => v.toString(16).padStart(2, "0")).join("");
    return `${x.slice(0, 8)}-${x.slice(8, 12)}-4${x.slice(13, 16)}-a${x.slice(17, 20)}-${x.slice(20, 32)}`; };
  function parseForm(html, url) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const inp = (el) => ({name: el.getAttribute("name") || "", type: (el.getAttribute("type") || "text").toLowerCase(), value: el.getAttribute("value") || "", cls: el.getAttribute("class") || ""});
    const all = [...doc.querySelectorAll("input")].map(inp);
    let fm = [...doc.querySelectorAll("form")].find((f) => [...f.querySelectorAll("input")].map(inp).some(isPw));
    const inputs = fm ? [...fm.querySelectorAll("input")].map(inp) : all;
    const action = fm ? fm.getAttribute("action") || "" : ([...doc.querySelectorAll("form[action]")].map((f) => f.getAttribute("action")).find(Boolean) || "");
    if (!inputs.some(isPw)) return null;
    const data = {}; for (const i of inputs) if (i.name && !["submit", "button", "checkbox", "radio", "file", "image"].includes(i.type)) data[i.name] = i.value;
    const pw = (inputs.find((i) => isPw(i) && i.name) || {}).name;
    const texts = inputs.filter((i) => i.name && i.name !== pw && ["text", "email", "tel", "number"].includes(i.type)).map((i) => i.name);
    const us = texts.find((n) => /^(log|user|mail|phone|tel)/i.test(n)) || texts[0];
    for (const i of inputs) if (i.type === "checkbox" && i.name && /remember|eslab|save/i.test(i.name)) data[i.name] = i.value || "true";
    // rasmdagi kod: yangi sahifada rasm manzili JS sozlamasida (imagePart) — unga yangi guid qo'shiladi va guid Captcha.Id ga yoziladi
    let img = null; const part = (unjs(html).match(/"imagePart"\s*:\s*"([^"]+)"/) || [])[1];
    const cid = all.find((i) => i.name && i.type === "hidden" && /captcha/i.test(i.name) && /id$/i.test(i.name));
    if (part && cid) { const g = cid.value || uuid(); data[cid.name] = g; img = part + g; }
    if (!img) { const el = [...doc.querySelectorAll("img")].find((x) => /captcha|капч/i.test([x.className, x.alt, x.id, x.getAttribute("src")].join(" ")) && x.getAttribute("src")); if (el) img = el.getAttribute("src"); }
    if (!img) img = (html.replace(/\\\//g, "/").match(/[^\s"'<>()=]*captcha\/[^\s"'<>()]*/i) || [])[0] || null;
    const outside = all.filter((i) => i.name && ["text", "number", "tel"].includes(i.type) && !texts.includes(i.name)).map((i) => i.name);
    const cap = [...texts, ...outside].find((n) => n !== us && /captcha|code|kod|answer|sum|number|digit/i.test(n)) || texts.find((n) => n !== us) || null;
    return {action: new URL(action || url, url).href, data, pw, us, cap, img: img ? new URL(img, url).href : null};
  }
  // nosozlikni topish uchun: eMaktab qanday sahifa qaytardi (parol yoki cookie yo'q — faqat holat, manzil, sarlavha, hajm)
  function diag(r) {
    const t = new DOMParser().parseFromString(String(r.b || ""), "text/html").title;
    let u = r.url; try { const x = new URL(r.url); u = x.host + x.pathname; } catch (e) { /* */ }
    return `Javob: ${r.s} · ${u}${t ? ` · «${t.replace(/\s+/g, " ").trim().slice(0, 60)}»` : ""} · ${Math.round(String(r.b || "").length / 1024)} KB`;
  }
  // nosozlikni topish uchun sahifani faylga saqlash: login/parol qiymatlari o'chiriladi (dastur/emaktab_http.py hide_secrets kabi)
  const scrub = (r) => `<!-- ${r.s} ${r.url} -->\n` + String(r.b || "")
    .replace(/<input[^>]*>/gi, (t) => /name=["']?(login|user\w*|pass\w*|parol)["'\s>]|type=["']?password/i.test(t) ? t.replace(/value=("[^"]*"|'[^']*'|[^\s>]*)/i, 'value=""') : t)
    .replace(/((?:\\x22|")(?:login|password|userName|parol)(?:\\x22|")\s*(?::|\\x3a)\s*(?:\\x22|"))((?:(?!\\x22)[^"])*)/gi, "$1");
  const blocked = (r) => r.s === 403 || r.s === 451 || r.s === 429 || r.s >= 500
    || /access denied|forbidden|blocked|cloudflare|ddos|captcha-delivery|доступ (запрещ|огранич)|ruxsat yo'q/i.test(String(r.b || "").slice(0, 20000).replace(/<script[\s\S]*?<\/script>/gi, ""));
  /* ───────── ikki bosqichli tasdiqlash (login.emaktab.uz/login/2fa-verification) ─────────
     Kod sahifasi JavaScript bilan chiziladi (forma yo'q), ilova kodni kirita olmaydi. Kod so'ralganda «Login va parol» bo'limida
     ogohlantirish turadi; xatcho'pga foydalanuvchi o'zi o'tadi (Akmal, 2026-11-07: ikki usul alohida bo'lim, o'zi o'tmaydi). */
  const F2 = "yoqlama_emk_2fa";
  const is2fa = (r) => /2fa|two-?factor|verif|confirm|otp/i.test(new URL(r.url).pathname);
  const need2fa = () => { try { return localStorage.getItem(F2) === "1"; } catch (e) { return false; } };
  const clear2fa = () => { try { localStorage.removeItem(F2); } catch (e) { /* */ } };
  const enc = (o) => Object.entries(o).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  async function login(user, pass) {
    S = {u: user, c: []};
    let r = await req(U.login);
    for (let attempt = 1; attempt <= 4; attempt++) {
      if (is2fa(r)) { try { localStorage.setItem(F2, "1"); } catch (e) { /* */ } clear(); S = null; throw Object.assign(new Error("2fa"), {twofa: true}); }
      if (!isLogin(r.url, r.b)) { store(S); clear2fa(); return true; }
      const f = parseForm(r.b, r.url);
      if (!f || !f.pw || !f.us) {
        // parol yuborilgandan keyin oraliq sahifa (forma yo'q) — tizimga kirilganmi, «Sinflarim» orqali tekshiramiz
        if (attempt > 1) { const m = await req(U.my); if (m.s < 400 && !isLogin(m.url, m.b)) { store(S); return true; } }
        if (blocked(r)) throw new Error(`eMaktab Google serveridan kelgan so'rovni to'sib qo'ydi (chet el manzili bo'lishi mumkin). Hozircha xatcho'p usulidan foydalaning.\n${diag(r)}`);
        throw Object.assign(new Error(`eMaktab kirish sahifasida login maydoni topilmadi${attempt > 1 ? " (parol yuborilgandan keyin)" : ""}. Hozircha xatcho'p usulidan foydalaning.\n${diag(r)}`), {page: scrub(r)});
      }
      f.data[f.us] = user; f.data[f.pw] = pass;
      if (attempt > 1) {
        if (!(f.cap && f.img)) throw new Error("Login yoki parol noto'g'ri.");
        const im = await req(f.img, {bin: true, ref: r.url});
        if (im.s !== 200 || !im.b) throw new Error("Rasmdagi kodni yuklab bo'lmadi.");
        const ans = await captchaSheet(`data:${/^image\//.test(im.t) ? im.t.split(";")[0] : "image/png"};base64,${im.b}`, attempt > 2);
        if (ans === null) return false;
        f.data[f.cap] = ans;
      }
      r = await req(f.action, {post: enc(f.data), ref: r.url});
    }
    throw new Error("Kirib bo'lmadi: login, parol yoki rasmdagi kod noto'g'ri.");
  }

  /* ───────── oynalar ───────── */
  function loginSheet(user = "", why = "") {
    return modal(`<div class="ek-res-in"><div class="ek-rh"><span class="ek-ic" aria-hidden="true">e</span><h2>eMaktab hisobini ulash</h2></div>
      <div class="ek-sub">${why ? esc(why) : "Bir marta. Keyin «eMaktab'dan yangilash» bitta bosishda ishlaydi."}</div>
      <form class="ek-form" id="ekf" autocomplete="on">
        <label for="eku">Login<input class="form-control" id="eku" name="username" autocomplete="username" value="${esc(user)}" required></label>
        <label for="ekp">Parol<input class="form-control" id="ekp" name="password" type="password" autocomplete="current-password" required></label>
        <div class="ek-safe"><span aria-hidden="true">🔒</span><span>Parol <b>saqlanmaydi</b>: faqat kirish uchun eMaktab'ga yuboriladi. Qurilmada kirish kaliti qoladi, uni «Uzish» o'chiradi.</span></div>
        <div class="ek-acts"><button type="button" class="btn" data-x>Bekor qilish</button><button class="btn btn-primary" type="submit">Kirish</button></div>
      </form>
      <button class="btn btn-link ek-alt" data-bm>Xatcho'p orqali import</button></div>`, (mm, close) => {
      mm.classList.add("ek-sh");
      $("[data-x]", mm).onclick = () => close(null);
      $("[data-bm]", mm).onclick = () => { close(null); emkDialog("bm"); };
      $("#ekf", mm).onsubmit = (e) => { e.preventDefault(); const u = $("#eku", mm).value.trim(), p = $("#ekp", mm).value; if (u && p) close({u, p}); };
      setTimeout(() => $(user ? "#ekp" : "#eku", mm).focus(), 50);
    });
  }
  function captchaSheet(src, again) {
    return modal(`<div class="ek-res-in"><div class="ek-rh"><h2>Rasmdagi kodni kiriting</h2></div>
      <div class="ek-sub">${again ? "Kod noto'g'ri bo'ldi — yangi rasmdagi kodni kiriting." : "eMaktab xavfsizlik uchun so'radi. Odatda faqat birinchi kirishda."}</div>
      <form class="ek-form" id="ekc"><img class="ek-cap" src="${src}" alt="eMaktab rasmidagi kod">
        <label for="ekci">Kod<input class="form-control" id="ekci" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" required></label>
        <div class="ek-acts"><button type="button" class="btn" data-x>Bekor qilish</button><button class="btn btn-primary" type="submit">Davom etish</button></div></form></div>`, (mm, close) => {
      mm.classList.add("ek-sh");
      $("[data-x]", mm).onclick = () => close(null);
      $("#ekc", mm).onsubmit = (e) => { e.preventDefault(); const v = $("#ekci", mm).value.trim(); if (v) close(v); };
      setTimeout(() => $("#ekci", mm).focus(), 50);
    }).then((v) => v === undefined ? null : v);
  }
  let prog = null;
  function progress(msg, pct) {
    if (!prog || !prog.isConnected) {
      prog = h(`<div class="modal ek-sh" role="dialog" aria-modal="true"><div class="card"><div class="ek-res-in"><div class="ek-rh"><h2>eMaktab'dan olinmoqda…</h2></div>
        <div class="ek-sub" data-m></div><div class="ek-prog"><i data-b></i></div><div class="ek-note">Odatda 10–40 soniya.</div></div></div></div>`);
      document.body.append(prog);
    }
    $("[data-m]", prog).textContent = msg; $("[data-b]", prog).style.width = `${Math.max(3, Math.min(100, pct))}%`;
  }
  const done = () => { if (prog) prog.remove(); prog = null; };
  function fail(e) {
    done();
    if (e.old) { old = true; toast(e.message); emkDialog("bm"); return; }   // server kodi eski (Code.gs v5 dan oldingi) — xatcho'p bo'limi
    if (e.twofa) { emkDialog("pw"); return; }   // kod so'raldi — «Login va parol» bo'limida ogohlantirish (o'zi xatcho'pga o'tmaydi)
    modal(`<div class="ek-res-in"><div class="ek-rh"><h2>eMaktab'dan olib bo'lmadi</h2></div><div class="ek-sub">${esc(e.message || String(e))}</div>
      ${e.page ? `<div class="ek-note">Tuzatish uchun eMaktab sahifasini faylga saqlab, ishlab chiquvchiga yuboring (login va parol faylga yozilmaydi).</div>` : ""}
      <div class="ek-acts">${e.page ? `<button class="btn" data-pg>Sahifani saqlash</button>` : ""}<button class="btn" data-bm>Xatcho'p orqali</button><button class="btn btn-primary" data-x>Yopish</button></div></div>`, (mm, close) => {
      mm.classList.add("ek-sh");
      const pg = $("[data-pg]", mm); if (pg) pg.onclick = () => download(`emaktab-sahifa-${new Date().toISOString().slice(0, 16).replace(/\D/g, "")}.html`, e.page, "text/html");
      $("[data-x]", mm).onclick = () => close(); $("[data-bm]", mm).onclick = () => { close(); emkDialog("bm"); };
    });
  }

  /* ───────── import ───────── */
  const b2file = (b64, name) => { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new File([u], name); };
  let busy = false, old = false;
  // cred — «Login va parol» bo'limidagi forma ({u, p}); seans bo'lmasa va cred yo'q bo'lsa — eMaktab oynasi shu bo'limda ochiladi
  async function sync(cred) {
    if (busy) return;
    S = load();
    if (!S && !cred) { emkDialog("pw"); return; }
    busy = true;
    try {
      if (!S) { await call([]);   // server yangi kodda ekanini tekshiramiz (eski bo'lsa — xatcho'p bo'limi)
        progress("eMaktab'ga kirilmoqda…", 5); if (!await login(cred.u, cred.p)) { done(); return; } }
      progress("Sinflar ro'yxati o'qilmoqda…", 8);
      let r = await req(U.my);
      if (isLogin(r.url, r.b)) {
        done(); const a = await loginSheet(S.u, "Kirish muddati tugagan — parolni qayta kiriting."); if (!a) return;
        progress("eMaktab'ga kirilmoqda…", 5); if (!await login(a.u, a.p)) { done(); return; }
        progress("Sinflar ro'yxati o'qilmoqda…", 8); r = await req(U.my);
        if (isLogin(r.url, r.b)) throw new Error("eMaktab'ga kirib bo'lmadi.");
      }
      store(S);
      const L = emkLib(), jobs = L.catalog(r.b, r.url);
      if (!jobs.length) throw new Error("«Mening sinflarim» sahifasida jurnal topilmadi.");
      const have = EMK1.have(), nk = (t) => String(t || "").toLowerCase().replace(/\(.*?\)/g, "").replace(/[^\p{L}\p{N}]/gu, "");
      const hasQ = (jb) => { const x = have.find((h) => nk(h.n) === nk(jb.cls) && nk(h.s) === nk(jb.subject)); return x ? x.q : null; };
      const files = [], errs = [];
      for (const [n, jb] of jobs.entries()) {
        progress(`Jurnallar: ${n + 1} / ${jobs.length}\n${jb.cls} · ${jb.subject}`, 10 + (n / jobs.length) * 85);
        try {
          const pg = await req(jb.url), st = L.state(pg.b), hd = (st && st.journalHeader) || (jb.pid ? {currentPeriodId: jb.pid} : null);
          if (!hd) throw new Error("chorak topilmadi");
          const [, school, group, subject] = jb.url.match(/\/school\/(\d+)\/group\/(\d+)\/subject\/(\d+)/);
          const ps = ((hd.periods || {})[hd.currentGroupId] || {}).periods || [], cur = ps.find((p) => p.id === hd.currentPeriodId);
          const ord = [...ps].sort((a, b) => a.number - b.number), hq = hasQ(jb);
          const want = cur ? ord.filter((p, i) => p.number < cur.number ? !(hq && hq.includes(i + 1)) : p.id === cur.id) : [{id: hd.currentPeriodId, name: ""}];
          for (const p of want) {
            const x = await req(`${U.excel}?action=gjsxls&school=${school}&group=${group}&subgroup=0&subject=${subject}&period=${p.id}`, {bin: true, ref: jb.url});
            if (x.s !== 200 || /html/i.test(x.t) || !x.b) throw new Error(`Excel o'rniga javob keldi (HTTP ${x.s})`);
            files.push(b2file(x.b, `${jb.cls}_${jb.subject}${p.name && want.length > 1 ? "_" + p.name : ""}.xls`));
          }
        } catch (e) { errs.push(`${jb.cls} · ${jb.subject}: ${e.message}`); }
      }
      store(S); done();
      if (!files.length) throw new Error("Hech bir jurnal yuklanmadi.\n" + errs.join("\n"));
      await EMK1.run(files, {auto: true});
      if (errs.length) toast(`Yuklanmadi: ${errs.join("; ")}`);
    } catch (e) { fail(e); }
    finally { busy = false; }
  }
  function unlink() { clear(); S = null; toast("eMaktab hisobi uzildi: kirish kaliti o'chirildi"); }

  /* ───────── eMaktab oynasining «Login va parol» bo'limi (tasdiqlangan maket 2026-11-07, ikki-bolim-maket.html) ───────── */
  function pane() {
    if (need2fa()) return `<div class="ek-warn"><span aria-hidden="true">⚠</span><span><b>eMaktab tasdiqlash kodini so'radi</b>Login va parol to'g'ri, lekin eMaktab qo'shimcha kod so'radi. Bu bo'lim kodni kirita olmaydi. Hozircha «Xatcho'p» bo'limidan foydalaning.</span></div>
      <div class="ek-acts"><button class="btn" data-ekre>Qayta urinish</button><button class="btn btn-primary" data-ektop="bm">Xatcho'p bo'limiga o'tish</button></div>`;
    if (linked()) { const at = typeof D !== "undefined" && D && D.web.emk_at;
      return `<div class="card ek-acc"><span class="ek-ic" aria-hidden="true">e</span><span class="ek-tx"><b>${esc(EMKS.user())}</b><small>Hisob ulangan${at ? ` · oxirgi yangilash: ${esc(new Date(at).toLocaleDateString("uz"))}` : ""}</small></span><button class="btn btn-sm" data-ekun>Uzish</button></div>
      <button class="btn btn-primary ek-wide" data-eksync>Jurnallarni yangilash</button>`; }
    return `<form class="ek-form" id="ekf" autocomplete="on">
        <label for="eku">eMaktab login<input class="form-control" id="eku" name="username" autocomplete="username" required></label>
        <label for="ekp">Parol<input class="form-control" id="ekp" name="password" type="password" autocomplete="current-password" required></label>
        <div class="ek-safe"><span aria-hidden="true">🔒</span><span><b>Parol saqlanmaydi.</b> Faqat kirish uchun bir marta yuboriladi. Keyingi safar parol so'ralmaydi.</span></div>
        <button class="btn btn-primary ek-wide" type="submit">Kirish va jurnallarni olish</button></form>`;
  }
  function bindPane(mm, close, reopen) {
    const f = $("#ekf", mm); if (f) f.onsubmit = (e) => { e.preventDefault(); const u = $("#eku", mm).value.trim(), p = $("#ekp", mm).value; if (u && p) { close(); sync({u, p}); } };
    // server kodi eskimi — parol yozilmasdan oldin tekshiramiz; eski bo'lsa bu bo'lim ishlamaydi, oyna «Xatcho'p»da qayta ochiladi
    if (f) call([]).catch((e) => { if (!e.old || !mm.isConnected) return; old = true; toast(e.message); close(); emkDialog("bm"); });
    const es = $("[data-eksync]", mm); if (es) es.onclick = () => { close(); sync(); };
    const eu = $("[data-ekun]", mm); if (eu) eu.onclick = () => { unlink(); reopen(); };
    const re = $("[data-ekre]", mm); if (re) re.onclick = () => { clear2fa(); reopen(); };
  }
  return {on, linked, sync, unlink, pane, bindPane, old: () => old, need2fa, user: () => (load() || {}).u || "", _t: {setCookies, cookieFor, parseForm, isLogin, reset: (s) => { S = s; }, get: () => S}};
})();
