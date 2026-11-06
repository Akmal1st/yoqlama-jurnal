// Avtomatik yaratilgan: node tests/make_emk.mjs (manba — docs/index.html dagi emkGrab). Qo'lda o'zgartirmang.
(function () {
  var cs = document.currentScript, APPURL = new URL("./", cs ? cs.src : "https://akmal1st.github.io/yoqlama-jurnal/").href;
  (function emkGrab() {
  const APP = APPURL, AO = new URL(APP).origin;
  const box = document.createElement("div");
  box.style.cssText = "position:fixed;top:12px;right:12px;z-index:2147483647;background:#fffdf8;color:#1b2a2f;border:2px solid #0b6f79;border-radius:14px;padding:12px 16px;font:15px/1.4 serif;max-width:360px;box-shadow:0 10px 30px rgba(0,0,0,.25);white-space:pre-line";
  const say = (t) => { box.textContent = "📒 Yo'qlama jurnali\n" + t; };
  document.body.appendChild(box);
  if (location.hostname !== "schools.emaktab.uz") {
    if (/(^|\.)emaktab\.uz$/.test(location.hostname) && !/^login\./.test(location.hostname)) {
      say("eMaktab sahifasi ochilmoqda… Ochilgach, xatcho'pni yana bir bor bosing."); location.href = "https://schools.emaktab.uz/v2/myclasses";
    } else say("Avval emaktab.uz ga kiring, so'ng xatcho'pni bosing.");
    setTimeout(() => box.remove(), 8000); return;
  }
  // ilova javobi: {type: "jurnal-ready", have: [{n: sinf, s: fan, q: [jurnalda belgisi bor choraklar]}]} (have — eski ilovada yo'q)
  let ready = false, have = null;
  addEventListener("message", (e) => { if (e.origin === AO && e.data && e.data.type === "jurnal-ready") { ready = true; if (Array.isArray(e.data.have)) have = e.data.have; } });
  const ping = (w) => { try { w.postMessage({type: "emaktab-ping"}, AO); } catch (e) {} };
  const waitApp = async (w, ms, need) => { for (let t = 0; t < ms / 200 && !(ready && (!need || have)) && !w.closed; t++) { ping(w); await new Promise((r) => setTimeout(r, 200)); } };
  // ilova oynasi ochilmasa ham (qalqib chiquvchi oyna to'silgan, telefon) oxirida «Ilovaga yuborish» tugmasi chiqadi
  let w = null; try { w = window.open(APP + "#emaktab", "yoqlama_jurnal"); } catch (e) { w = null; }
  const btns = (opts) => new Promise((res) => {
    const row = document.createElement("div"); row.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin-top:10px";
    opts.forEach(([k, l], i) => { const b = document.createElement("button"); b.textContent = l; b.dataset.emk = k;
      b.style.cssText = `font:inherit;font-size:14px;padding:8px 12px;border-radius:9px;border:1px solid #0b6f79;cursor:pointer;background:${i ? "#fff;color:#0b6f79" : "#0b6f79;color:#fff"}`;
      b.onclick = () => { row.remove(); res(k); }; row.append(b); });
    box.append(row);
  });
  const b64 = (buf) => { const u = new Uint8Array(buf); let x = ""; for (let i = 0; i < u.length; i += 32768) x += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(x); };
  const saveFile = (files) => {
    const blob = new Blob([JSON.stringify({type: "emaktab-bundle", v: 1, files: files.map((f) => ({name: f.name, b64: b64(f.data)}))})], {type: "application/json"});
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "emaktab_jurnallar.json"; document.body.append(a); a.click(); a.remove();
  };
  const get = async (u) => { const r = await fetch(u, {credentials: "include"}); if (!r.ok) throw new Error("HTTP " + r.status); return r; };
  // sahifa tahlili (sinflar ro'yxati, jurnal holati) — emkLib(): ilovaning o'zidan importda ham shu kod ishlatiladi
  const {jsonAt, state, catalog} = (function emkLib() {
  // html[k] === "{" dan boshlangan JSON obyektini o'qiydi (qavslar sanaladi, satr ichidagilari hisobga olinmaydi)
  const jsonAt = (html, k) => {
    if (k < 0 || html[k] !== "{") return null;
    let d = 0, q = false, esc = false;
    for (let j = k; j < html.length; j++) {
      const ch = html[j];
      if (q) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') q = false; }
      else if (ch === '"') q = true; else if (ch === "{") d++; else if (ch === "}" && !--d) { try { return JSON.parse(html.slice(k, j + 1)); } catch (e) { return null; } }
    }
    return null;
  };
  const state = (html) => { const i = html.indexOf("__JOURNAL__INITIAL__STATE__"); return i < 0 ? null : jsonAt(html, html.indexOf("{", i)); };
  /* «Mening sinflarim» → [{cls, subject, url}]. Yangi sahifada sinflar havolalarda emas, skript ichidagi JSON da
     (window.__TEACHERV2__INITIAL__STATE__ = {groups: {"groups": [{name, journal: [{subjectName, subgroupName, journalUrl}]}]}}) —
     shu asosiy manba. Eski sahifa (havolalar): jurnal sinfga tartib bo'yicha emas, guruh ID si bo'yicha biriktiriladi —
     bir sinfning bir nechta havolasi (rasm, «Fayllar», sinf rahbari menyusi) sinf nomini buzmaydi. */
  const CLS = /^\d{1,2}\s*[-–—]?\s*\p{L}/u;
  // jurnal havolasi ikki ko'rinishda bo'ladi: …/journal/school/S/group/G/subject/X yoki …/journals/?school=S&group=G&subject=X
  // (eski sahifa, «Rejalashtirish»). Ikkalasi bitta jurnalga keltiriladi; periodId / period (emaktabda ba'zan «=» siz) — chorak
  const jref = (href) => {
    href = String(href || ""); const m = href.match(/\/journal\/school\/(\d+)\/group\/(\d+)\/subject\/(\d+)/);
    let s, g, x; if (m) [, s, g, x] = m;
    else { if (!/\/journals?[/?]/.test(href)) return null; const q = (k) => (href.match(new RegExp(`[?&]${k}=(\\d+)`)) || [])[1]; s = q("school"); g = q("group"); x = q("subject"); if (!s || !g || !x) return null; }
    return {g, key: `${s}/${g}/${x}`, path: !!m, url: m ? href.slice(0, m.index + m[0].length) : `https://emaktab.uz/journal/school/${s}/group/${g}/subject/${x}`,
      pid: (href.match(/[?&](?:periodId|period)=?(\d+)/) || [])[1] || null};
  };
  const catalog = (html, base) => {
    const jobs = [], seen = {}, clean = (t) => String(t || "").replace(/\s+/g, " ").trim();
    const push = (cls, subject, href) => { const j = jref(href); if (!j || !cls) return; const ex = seen[j.key];
      if (!ex) { seen[j.key] = {cls, subject: clean(subject), url: j.url, pid: j.pid, path: j.path}; jobs.push(seen[j.key]); }
      else if (j.path && !ex.path) Object.assign(ex, {subject: clean(subject) || ex.subject, url: j.url, pid: j.pid || ex.pid, path: true}); };
    const i = html.indexOf("__TEACHERV2__INITIAL__STATE__");
    if (i >= 0) {
      const re = /["']?groups["']?\s*:\s*\{/g; re.lastIndex = i; const m = re.exec(html), st = m && jsonAt(html, m.index + m[0].length - 1);
      for (const g of st && Array.isArray(st.groups) ? st.groups : []) {
        const cls = clean(g && g.name);
        for (const j of (g && Array.isArray(g.journal) ? g.journal : [])) if (j) push(cls, clean(j.subjectName) + (j.subgroupName ? ` (${clean(j.subgroupName)})` : ""), String(j.journalUrl || ""));
      }
      if (jobs.length) return jobs;
    }
    // sinflar ro'yxati ikki panelda: #ContentPanelTeacher (dars beradigan sinflar) va #ContentPanelMyClasses (sinf rahbari),
    // har birining .cc qismida; .cc topilmasa — panelning o'zi, panel ham bo'lmasa — butun sahifa
    const doc = new DOMParser().parseFromString(html, "text/html"), byId = {}, pend = [], P = "#ContentPanelTeacher, #ContentPanelMyClasses";
    let roots = [...doc.querySelectorAll("#ContentPanelTeacher .cc, #ContentPanelMyClasses .cc")].filter((x) => !x.parentElement.closest(".cc"));
    if (!roots.length) roots = [...doc.querySelectorAll(P)]; if (!roots.length) roots = [doc];
    let last = null;
    for (const a of roots.flatMap((r) => [...r.querySelectorAll("a[href]")])) {
      let u; try { u = new URL(a.getAttribute("href"), base); } catch (e) { continue; }
      const text = clean(a.textContent), id = /\/v2\/class$/.test(u.pathname) && u.searchParams.get("class");
      if (id) { const c = byId[id] = byId[id] || {name: ""}; if (text && (!c.name || (CLS.test(text) && !CLS.test(c.name)))) c.name = text.slice(0, 40); last = c; continue; }
      const j = jref(u.href); if (j) pend.push([byId[j.g] || last || (byId[j.g] = {name: ""}), a.title || text, u.href]);
    }
    for (const [c, subject, href] of pend) push(c.name, subject, href);
    return jobs;
  };
  return {jsonAt, state, jref, catalog};
})();
  (async () => {
    say("Sinflar ro'yxati o'qilmoqda…");
    const r0 = await get("/v2/myclasses");
    if (/login\./.test(new URL(r0.url).hostname)) throw new Error("emaktab'ga kirilmagan — avval saytga kiring.");
    const jobs = catalog(await r0.text(), r0.url);
    if (!jobs.length) throw new Error("«Sinflarim» sahifasida jurnal topilmadi.");
    // choraklar: birinchi jurnal holatidan; «Yil boshidan» — joriy chorakkacha hammasi
    const perOf = (hd) => { const ps = ((hd.periods || {})[hd.currentGroupId] || {}).periods || []; const cur = ps.find((p) => p.id === hd.currentPeriodId); return {ps, cur}; };
    // jurnal sahifasi boshqa manzilda bo'lishi mumkin (emaktab.uz/journal/… — brauzer uni bu sahifadan o'qishga ruxsat bermasligi mumkin):
    // o'qilmasa shu saytdagi (schools.emaktab.uz) manzil sinaladi, u ham bo'lmasa havoladagi periodId (joriy chorak) olinadi
    const journal = async (u) => {
      try { return state(await (await get(u)).text()); }
      catch (e) { const p = new URL(u); if (p.origin === location.origin) return null; try { return state(await (await get(location.origin + p.pathname)).text()); } catch (e2) { return null; } }
    };
    const first = await journal(jobs[0].url);
    // ilovada qaysi choraklar bor — jurnal o'shandan bilinadi; ilova javob bermasa hamma choraklar olinadi (ilova keraksizini o'zi tashlaydi)
    if (w) await waitApp(w, 4000, true);
    const nk = (t) => String(t || "").toLowerCase().replace(/\(.*?\)/g, "").replace(/[^\p{L}\p{N}]/gu, "");
    const hasQ = (jb) => { if (!have) return null; const x = have.find((h) => nk(h.n) === nk(jb.cls) && nk(h.s) === nk(jb.subject)); return x ? x.q || [] : null; };
    const files = [], errs = [];
    for (const [n, jb] of jobs.entries()) {
      say(`Jurnallar yuklanmoqda: ${n + 1} / ${jobs.length}\n${jb.cls} · ${jb.subject}`);
      try {
        const st = n ? await journal(jb.url) : first, hd = (st && st.journalHeader) || (jb.pid ? {currentPeriodId: jb.pid} : null);
        if (!hd) throw new Error("chorak topilmadi");
        const [, school, group, subject] = jb.url.match(/\/school\/(\d+)\/group\/(\d+)\/subject\/(\d+)/);
        // chorak raqami — tartib bo'yicha (emaktabda number 0 dan ham boshlanadi); joriy chorak doim, oldingilari — ilovada yo'q bo'lsa
        const {ps, cur} = perOf(hd), ord = [...ps].sort((a, b) => a.number - b.number), hq = hasQ(jb);
        const want = cur ? ord.filter((p, i) => p.number < cur.number ? !(hq && hq.includes(i + 1)) : p.id === cur.id) : [{id: hd.currentPeriodId, name: ""}];
        for (const p of want) {
          const x = await get(`/v2/excel?action=gjsxls&school=${school}&group=${group}&subgroup=0&subject=${subject}&period=${p.id}`);
          if (/html/i.test(x.headers.get("content-type") || "")) throw new Error("Excel o'rniga sahifa keldi");
          files.push({name: `${jb.cls}_${jb.subject}${p.name && want.length > 1 ? "_" + p.name : ""}.xls`, data: await x.arrayBuffer()});
        }
      } catch (e) { errs.push(`${jb.cls} · ${jb.subject}: ${e.message}`); }
    }
    if (!files.length) throw new Error("Hech bir jurnal yuklanmadi.\n" + errs.join("\n"));
    const bad = errs.length ? `\nYuklanmadi:\n${errs.join("\n")}` : "";
    const send = () => {
      w.postMessage({type: "emaktab-files", files}, AO);
      say(`✓ ${files.length} ta jurnal yuborildi.\nNatija Jurnal ilovasida.` + bad);
      try { w.focus(); } catch (e) {}
      if (!bad) setTimeout(() => box.remove(), 4000);
      else btns([["ok", "Yopish"]]).then(() => box.remove());
    };
    if (w && !w.closed) { say("Jurnal ilovasiga yuborilmoqda…"); await waitApp(w, 15000); }
    if (w && ready && !w.closed) { send(); return; }
    // ilova oynasi ochilmadi (qalqib chiquvchi oyna to'silgan) — tugma bosilsa brauzer ruxsat beradi; zaxira: faylga saqlash
    for (;;) {
      say(`✓ ${files.length} ta jurnal olindi. Ilovaga yuborish uchun tugmani bosing.` + bad);
      const k = await btns([["open", "📒 Ilovaga yuborish"], ["save", "💾 Faylga saqlash"], ["x", "Bekor qilish"]]);
      if (k === "x") { box.remove(); return; }
      if (k === "save") { saveFile(files); say("✓ «emaktab_jurnallar.json» saqlandi (Yuklab olinganlar papkasi). Endi uni Jurnal ilovasida «eMaktab'dan import» → «Fayl orqali» bo'limida tanlang."); return; }
      ready = false; try { w = window.open(APP + "#emaktab", "yoqlama_jurnal"); } catch (e) { w = null; }
      if (w) { say("Jurnal ilovasiga yuborilmoqda…"); await waitApp(w, 15000); }
      if (w && ready && !w.closed) { send(); return; }
    }
  })().catch((e) => say("✗ " + e.message));
})();
})();
