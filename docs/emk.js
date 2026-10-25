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
    say("emaktab.uz ga kiring va «Sinflarim» sahifasida shu tugmani yana bosing.");
    if (confirm("Yo'qlama jurnali: «Sinflarim» sahifasi ochilsinmi? Ochilgach, tugmani yana bir bor bosing.")) location.href = "https://schools.emaktab.uz/v2/myclasses";
    setTimeout(() => box.remove(), 8000); return;
  }
  let ready = false;
  addEventListener("message", (e) => { if (e.origin === AO && e.data && e.data.type === "jurnal-ready") ready = true; });
  // ilova oynasi ochilmasa ham (qalqib chiquvchi oyna to'silgan, telefon) jurnallar faylga saqlab beriladi
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
  const state = (html) => {
    const i = html.indexOf("__JOURNAL__INITIAL__STATE__"); if (i < 0) return null;
    const k = html.indexOf("{", i); let d = 0, q = false, esc = false;
    for (let j = k; j < html.length; j++) {
      const ch = html[j];
      if (q) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') q = false; }
      else if (ch === '"') q = true; else if (ch === "{") d++; else if (ch === "}" && !--d) return JSON.parse(html.slice(k, j + 1));
    }
    return null;
  };
  (async () => {
    say("Sinflar ro'yxati o'qilmoqda…");
    const r0 = await get("/v2/myclasses");
    if (/login\./.test(new URL(r0.url).hostname)) throw new Error("emaktab'ga kirilmagan — avval saytga kiring.");
    const doc = new DOMParser().parseFromString(await r0.text(), "text/html"), root = doc.getElementById("ContentPanelTeacher") || doc;
    const jobs = [], seen = new Set(); let cls = null;
    for (const a of root.querySelectorAll("a[href]")) {
      const href = new URL(a.getAttribute("href"), r0.url).href;
      if (href.includes("/v2/class?class=")) cls = a.textContent.trim();
      else if (cls && /\/journal\/school\/\d+\/group\/\d+\/subject\/\d+/.test(href) && !seen.has(href)) { seen.add(href); jobs.push({cls, subject: (a.title || a.textContent).trim(), url: href}); }
    }
    if (!jobs.length) throw new Error("«Sinflarim» sahifasida jurnal topilmadi.");
    // choraklar: birinchi jurnal holatidan; «Yil boshidan» — joriy chorakkacha hammasi
    const perOf = (hd) => { const ps = ((hd.periods || {})[hd.currentGroupId] || {}).periods || []; const cur = ps.find((p) => p.id === hd.currentPeriodId); return {ps, cur}; };
    const first = state(await (await get(jobs[0].url)).text()), fp = first && first.journalHeader ? perOf(first.journalHeader) : {ps: []};
    let all = false;
    if (fp.cur && fp.ps.some((p) => p.number < fp.cur.number)) {
      say(`${jobs.length} ta jurnal topildi. Qaysi chorak(lar) olinsin?`);
      all = await btns([["cur", `Joriy chorak (${fp.cur.name})`], ["all", "Yil boshidan (barcha choraklar)"]]) === "all";
    }
    const files = [], errs = [];
    for (const [n, jb] of jobs.entries()) {
      say(`Jurnallar yuklanmoqda: ${n + 1} / ${jobs.length}\n${jb.cls} · ${jb.subject}`);
      try {
        const st = n ? state(await (await get(jb.url)).text()) : first, hd = st && st.journalHeader;
        if (!hd) throw new Error("chorak topilmadi");
        const [, school, group, subject] = jb.url.match(/\/school\/(\d+)\/group\/(\d+)\/subject\/(\d+)/);
        const {ps, cur} = perOf(hd), want = all && cur ? ps.filter((p) => p.number <= cur.number).sort((a, b) => a.number - b.number) : [{id: hd.currentPeriodId, name: ""}];
        for (const p of want) {
          const x = await get(`/v2/excel?action=gjsxls&school=${school}&group=${group}&subgroup=0&subject=${subject}&period=${p.id}`);
          if (/html/i.test(x.headers.get("content-type") || "")) throw new Error("Excel o'rniga sahifa keldi");
          files.push({name: `${jb.cls}_${jb.subject}${p.name ? "_" + p.name : ""}.xls`, data: await x.arrayBuffer()});
        }
      } catch (e) { errs.push(`${jb.cls} · ${jb.subject}: ${e.message}`); }
    }
    if (!files.length) throw new Error("Hech bir jurnal yuklanmadi.\n" + errs.join("\n"));
    const bad = errs.length ? `\nYuklanmadi:\n${errs.join("\n")}` : "";
    if (w) { say("Jurnal ilovasiga yuborilmoqda…"); for (let t = 0; !ready && t < 75; t++) await new Promise((r) => setTimeout(r, 200)); }
    if (w && ready && !w.closed) {
      w.postMessage({type: "emaktab-files", files}, AO);
      say(`✓ ${files.length} ta jurnal yuborildi — Jurnal oynasida tasdiqlang.` + bad);
      try { w.focus(); } catch (e) {}
      if (await btns([["ok", "Yopish"], ["save", "💾 Faylga ham saqlash"]]) === "save") saveFile(files);
      box.remove(); return;
    }
    // ilova oynasi yo'q — fayl orqali
    say(`✓ ${files.length} ta jurnal olindi, lekin Jurnal ilovasi oynasi ochilmadi.\nFaylga saqlang, so'ng ilovada «emaktab'dan import» → «Fayl orqali» bo'limida shu faylni tanlang.` + bad);
    if (await btns([["save", "💾 Faylga saqlash"], ["x", "Bekor qilish"]]) === "save") { saveFile(files); say("✓ «emaktab_jurnallar.json» saqlandi (Yuklab olinganlar papkasi). Endi uni Jurnal ilovasida tanlang."); }
    else box.remove();
  })().catch((e) => say("✗ " + e.message));
})();
})();
