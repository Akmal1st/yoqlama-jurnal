/* BSB / CHSB / Loyiha ishi tahlili — Excel fayli (rasmiy ko'rinish, formulalar bilan), Excel ko'rinishi, ma'lumot (data) va sozlama (cfg).
   Chop etish, PDF va Telegram varag'i — umumiy oynada (bsb-exp.js → EXP, eksport.js; 2026-11-15). Eski oyna, «Hozirgi / Yangi» varaq dizaynlari
   (bsb-yangi.js) va o'lchab bo'lish shu sababli olib tashlandi — tarix: git (PR #209, #245 gacha).
   Hisob-kitob index.html da: baAnalysis, bsbRecs, bsbErrors, baMeta, baFileBase, quarterOf.
   Sozlamalar D.web.bsb_hdr da: school, note, fnote, sign («Lavozim | F.I.Sh.» qatorlari), teacher, deputy, bx {form, off1, off2, bw, ord1, ord2, ori, dv}. */
const BXP = (() => {
  const SECS = {
    1: [["hdr", "🏫 Sarlavha"], ["kpi", "📈 Ko'rsatkichlar"], ["chart", "📊 Diagramma"], ["qtab", "🧩 Savollar jadvali"], ["rec", "💡 Xulosa"], ["stu", "👥 O'quvchilar"], ["sig", "✍ Imzolar"]],
    2: [["hdr", "🏫 Sarlavha"], ["sum", "Σ O'rtacha qatorlar"], ["dist", "📊 Taqsimot"], ["kpi", "📈 Ko'rsatkichlar"], ["sig", "✍ Imzolar"]],
  };
  /* ───────── sozlamalar ───────── */
  function cfg() {
    const H = D.web.bsb_hdr = Object.assign({school: "", teacher: "", deputy: ""}, D.web.bsb_hdr || {});
    if (!H.bx || typeof H.bx !== "object") {        // birinchi ochilish: eski «hide» dan o'tkaziladi
      const hd = H.hide || {};
      H.bx = {form: S.bavar === 2 ? 2 : 1, off1: [], off2: ["sum", "dist", "kpi"].filter((k) => hd[k]), bw: false, ord1: "score", ord2: "list", ori: "auto"};
    }
    const x = H.bx;
    x.form = x.form === 2 ? 2 : 1;
    for (const f of [1, 2]) { const ok = SECS[f].map((s) => s[0]); x["off" + f] = (Array.isArray(x["off" + f]) ? x["off" + f] : []).filter((k) => ok.includes(k)); x["ord" + f] = x["ord" + f] === "list" || x["ord" + f] === "score" ? x["ord" + f] : f === 1 ? "score" : "list"; }
    x.dv = DVK.includes(x.dv) ? x.dv : "tab";
    x.bw = !!x.bw; x.ori = ["auto", "p", "l"].includes(x.ori) ? x.ori : "auto";
    return H;
  }
  function signsOf(H) {
    const lines = String(H.sign || "").split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return [["Fan o'qituvchisi", H.teacher || ""], ["Metod birlashma rahbari", H.deputy || ""]];
    return lines.map((l) => { const i = l.indexOf("|"); return i < 0 ? [l, ""] : [l.slice(0, i).trim(), l.slice(i + 1).trim()]; });
  }
  const teacherOf = (signs, H) => ((signs.find((s) => /o.qituvchi/i.test(s[0])) || [])[1] || H.teacher || "").trim();

  /* ───────── ma'lumot ───────── */
  function data(c, B) {
    const an = baAnalysis(c, B), meta = baMeta(c, B), kind = B.kind || "BSB", q = quarterOf(B.date);
    const err = an.n && an.questions.length ? bsbErrors(an, []) : [];
    const by = Object.fromEntries(an.students.map((s) => [s.name, s]));
    const ranked = an.students.slice().sort((a, b) => b.total - a.total);
    return {c, B, an, meta, kind, q, err, by, ranked, rec: bsbRecs(an), ok: !!(an.n && an.questions.length), file: baFileBase(c, B)};
  }
  const title = (X, form) => X.kind === "Loyiha ishi" ? `Loyiha ishi ${form === 1 ? "tahlili" : "natijalari"}` : `${X.kind === "CHSB" ? (X.q ? `${X.q}-chorak` : "Chorak") : "Bo'lim"} bo'yicha summativ baholash (${X.kind}) ${form === 1 ? "tahlili" : "natijalari"}`;

  const DV = [["tab", "Jadval"], ["row", "Qator"], ["bar", "Chiziq"], ["col", "Ustun"]], DVK = DV.map((d) => d[0]);
  function list(X, ord) {     // [{s|null, name}] — ro'yxat (qatnashmaganlar o'z o'rnida) yoki ball bo'yicha (qatnashmaganlar pastda alohida)
    return ord === "score" ? X.ranked.map((s) => ({s, name: s.name})) : X.c.students.map((st) => ({s: X.by[st.name] || null, name: st.name}));
  }

  /* ───────── Excel: rangli va chegarali (xlsx-js-style), Jami, %, Baho — formula ─────────
     SheetJS CE rang yozmaydi — shuning uchun eksportda uning uslub yozadigan nusxasi (xlsx-js-style) ishlatiladi; o'qish uchun eski kutubxona o'zgarmaydi */
  const col = (i) => { let s = ""; i++; while (i) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; };
  const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;
  let XLS_P = null;
  function loadXlsxStyle() {
    if (window.XLSXS) return Promise.resolve(window.XLSXS);
    return XLS_P || (XLS_P = new Promise((res, rej) => {
      const prev = window.XLSX, s = document.createElement("script"); s.src = "vendor/xlsx-js-style-1.2.0.min.js";
      s.onload = () => { window.XLSXS = window.XLSX; window.XLSX = prev; res(window.XLSXS); };   // o'qish kutubxonasi (window.XLSX) joyida qoladi
      s.onerror = () => { XLS_P = null; window.XLSX = prev; rej(new Error("Excel kutubxonasini yuklab bo'lmadi — internetga ulanib qayta urinib ko'ring")); };
      document.head.append(s);
    }));
  }
  // ranglar — PDF varaq bilan bir xil (bsb-eksport.css: --k, --k2, --g5…--g2); «Oq-qora» tanlansa kulrang
  function pal(bw) {
    return bw ? {k: "222222", k2: "EEEEEE", ln: "9A9A9A", zb: "F7F7F7", mut: "555555", g: {5: "8C8C8C", 4: "B8B8B8", 3: "D9D9D9", 2: "F2F2F2"}, gw: {5: "FFFFFF"}, ok: "333333", bad: "333333", tip: "333333"}
      : {k: "0B5C5A", k2: "E6F2F1", ln: "C9D3D2", zb: "F7FAFA", mut: "5B6B6A", g: {5: "5FB36A", 4: "BCDCA0", 3: "F6E58D", 2: "EE9A96"}, gw: {5: "FFFFFF"}, ok: "107C41", bad: "C0392B", tip: "0B5C5A"};
  }
  const lvlG = (lv) => lv === "qiyin" ? 2 : lv === "o'rtacha" ? 3 : 4;
  const pctG = (p) => p < 40 ? 2 : p < 70 ? 3 : 4;
  // varaq quruvchi: qatorlar «roli» bilan qo'shiladi, keyin roliga qarab bezatiladi
  function sheet(XL, P, W) {
    const rows = [], roles = [], merges = [], F = [], hpt = {}, cs = [];
    const S = {
      rows, F, merges,
      push(r, role = "", ex) { rows.push(r); roles.push(role); if (ex) cs[rows.length - 1] = ex; return rows.length - 1; },
      merge(r, c0 = 0, c1 = W - 1) { if (c1 > c0) merges.push({s: {r, c: c0}, e: {r, c: c1}}); },
      height(r, h) { hpt[r] = h; },
      build(cols, extra) {
        const ws = XL.utils.aoa_to_sheet(rows);
        ws["!ref"] = XL.utils.encode_range({s: {r: 0, c: 0}, e: {r: Math.max(0, rows.length - 1), c: W - 1}});
        ws["!cols"] = cols.map((w) => ({wch: w})); ws["!merges"] = merges;
        ws["!rows"] = rows.map((_, i) => hpt[i] ? {hpt: hpt[i]} : {});
        ws["!margins"] = {left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2};
        for (const [a, f] of F) if (ws[a]) ws[a].f = f;
        const cell = (r, c) => { const a = XL.utils.encode_cell({r, c}); return ws[a] || (ws[a] = {t: "s", v: ""}); };
        const bd = {style: "thin", color: {rgb: P.ln}}, BOX = {top: bd, bottom: bd, left: bd, right: bd};
        const put = (r, c, s) => { const x = cell(r, c); x.s = {...(x.s || {}), ...s, font: {name: "Arial", sz: 10, ...((x.s || {}).font || {}), ...(s.font || {})}, alignment: {vertical: "center", ...((x.s || {}).alignment || {}), ...(s.alignment || {})}}; };
        const ctr = {horizontal: "center"}, n = rows.length;
        for (let r = 0; r < n; r++) {
          const role = roles[r], len = Math.max(rows[r].length, 1), ex = cs[r] || {};
          const all = (s, c0 = 0, c1 = W - 1) => { for (let c = c0; c <= c1; c++) put(r, c, s); };
          if (role === "school") all({font: {bold: true, sz: 10, color: {rgb: P.mut}}});
          else if (role === "title") { all({font: {bold: true, sz: 14, color: {rgb: P.k}}}); hpt[r] = hpt[r] || 24; }
          else if (role === "note" || role === "info") all({font: {sz: 10, color: {rgb: P.mut}}, alignment: {wrapText: true}});
          else if (role === "rule") all({border: {bottom: {style: "medium", color: {rgb: P.k}}}});
          else if (role === "head") { const o = ex.o || 0; all({fill: {fgColor: {rgb: P.k}}, font: {bold: true, color: {rgb: "FFFFFF"}}, alignment: {...ctr, wrapText: true}, border: BOX}, o, o + (ex.w || W - o) - 1); hpt[r] = hpt[r] || 30; }
          else if (role === "max") { all({fill: {fgColor: {rgb: P.k2}}, font: {bold: true, color: {rgb: P.k}}, alignment: ctr, border: BOX}); put(r, 1, {alignment: {horizontal: "left"}}); }
          else if (role === "stu" || role === "abs") {
            const z = ex.i % 2 ? {fill: {fgColor: {rgb: P.zb}}} : {};
            all({...z, alignment: ctr, border: BOX}); put(r, 0, {font: {color: {rgb: P.mut}}}); put(r, 1, {alignment: {horizontal: "left"}});
            if (role === "abs") { put(r, 2, {font: {italic: true, color: {rgb: P.mut}}}); S.merge(r, 2, W - 1); }
            else { put(r, W - 3, {font: {bold: true}}); const g = ex.g; if (g) put(r, W - 1, {fill: {fgColor: {rgb: P.g[g]}}, font: {bold: true, color: {rgb: P.gw[g] || "222222"}}}); }
          }
          else if (role === "sum") { all({fill: {fgColor: {rgb: P.k2}}, font: {italic: true}, alignment: ctr, border: BOX}); put(r, 1, {font: {bold: true, italic: false}, alignment: {horizontal: "left"}}); }
          else if (role === "q") {   // «Savollar»: o'zlashtirish va qiyinlik rangli
            all({alignment: {...ctr, wrapText: true}, border: BOX, ...(ex.i % 2 ? {fill: {fgColor: {rgb: P.zb}}} : {})}, 0, (ex.w || W) - 1);
            put(r, 0, {font: {bold: true}}); put(r, 3, {fill: {fgColor: {rgb: P.g[pctG(ex.pct)]}}, font: {bold: true}}); put(r, 9, {fill: {fgColor: {rgb: P.g[lvlG(ex.lv)]}}});
            put(r, 10, {alignment: {horizontal: "left", wrapText: true}});
          }
          else if (role === "kv") { const o = ex.o || 0; put(r, o, {fill: {fgColor: {rgb: P.k2}}, font: {bold: true}, border: BOX}); for (let c = o + 1; c <= o + (ex.w || 1); c++) put(r, c, {alignment: ctr, border: BOX, font: {bold: true}}); if (ex.w > 1) S.merge(r, o + 1, o + ex.w); }
          else if (role === "grade" || role === "kpi") {
            const o = ex.o || 0; all({alignment: ctr, border: BOX, ...(role === "kpi" ? {font: {bold: true}} : {})}, o, o + (ex.w || 2) - 1);
            if (ex.g) put(r, o, {fill: {fgColor: {rgb: P.g[ex.g]}}, font: {bold: true, color: {rgb: P.gw[ex.g] || "222222"}}});
          }
          else if (role === "sec") put(r, 0, {font: {bold: true, sz: 11, color: {rgb: P[ex.tone] || P.k}}});
          else if (role === "li") { all({alignment: {wrapText: true, vertical: "top"}}); }
          else if (role === "sign") all({font: {bold: true}});
          else if (role === "fnote") all({font: {italic: true, color: {rgb: P.mut}}});
          if (len && role === "li") { S.merge(r); hpt[r] = hpt[r] || 14 * Math.max(1, Math.ceil(String(rows[r][0] || "").length / (extra && extra.chars || 90))); }
        }
        ws["!rows"] = rows.map((_, i) => hpt[i] ? {hpt: hpt[i]} : {});
        return ws;
      },
    };
    return S;
  }
  // o'quvchi qatorlari: C.. — savollar, keyin Jami, %, Baho; maxRow — «Maksimal ball» qatorining Excel raqami (1 dan)
  function stuRows(X, ord, S, maxRow) {
    const an = X.an, nq = an.qmax.length, cT = col(2 + nq), cP = col(3 + nq), cG = col(4 + nq);
    list(X, ord).forEach(({s, name}, i) => {
      const r = S.rows.length + 1;
      if (!s) { S.push([i + 1, name, "qatnashmadi"], "abs", {i}); return; }
      S.push([i + 1, name, ...s.pts, s.total, Math.round(s.pct), s.grade], "stu", {i, g: s.grade});
      const sumF = `SUM(C${r}:${col(1 + nq)}${r})`, mx = `$${cT}$${maxRow}`;
      S.F.push([`${cT}${r}`, X.kind === "CHSB" ? `MIN(${mx},ROUNDUP(${sumF},0))` : sumF], [`${cP}${r}`, `ROUND(${cT}${r}/${mx}*100,0)`],
        [`${cG}${r}`, `IF(${cT}${r}/${mx}*100>=86,5,IF(${cT}${r}/${mx}*100>=66,4,IF(${cT}${r}/${mx}*100>=30,3,2)))`]);
    });
  }
  async function excel(X, H, form) {
    const XL = await loadXlsxStyle(), wb = XL.utils.book_new(), an = X.an, m = X.meta, nq = an.qmax.length, x = H.bx, off = new Set(x["off" + form]), on = (k) => !off.has(k), sg = signsOf(H), P = pal(x.bw);
    const qh = an.qmax.map((_, i) => `${i + 1}-savol`), maxRow = ["", "Maksimal ball", ...an.qmax, an.tot_max, 100, ""], W = nq + 5;
    const info = `Sinf: ${m.cls}   Fan: ${m.subject || "—"}   Sana: ${m.date}   Bo'lim / mavzu: ${m.title || "—"}   Savollar: ${nq} ta / ${gnum(an.tot_max)} ball`;
    const add = (name, ws) => XL.utils.book_append_sheet(wb, ws, name.slice(0, 31));
    const top = (S, t, w, notes = []) => {
      S.merge(S.push([H.school || ""], "school"), 0, w - 1);   // birinchi qator — maktab nomi (bo'sh bo'lsa ham joyi saqlanadi)
      S.merge(S.push([t], "title"), 0, w - 1);
      for (const s of notes) S.merge(S.push([s], "note"), 0, w - 1);
      S.merge(S.push([info], "info"), 0, w - 1); S.push([], "rule");
    };
    const stuCols = (wn) => [4.5, wn, ...Array(nq).fill(nq > 10 ? 4.5 : 6.5), 7, 6, 6];   // A4 tik varaqqa sig'adi
    if (form === 1) {
      const S = sheet(XL, P, W);
      top(S, title(X, 1), W);
      S.push(["№", "O'quvchi", ...qh, "Jami", "%", "Baho"], "head"); const mr = S.push(maxRow, "max") + 1;
      stuRows(X, x.ord1, S, mr);
      if (x.ord1 === "score" && an.absent.length) { S.push([]); S.merge(S.push(["Qatnashmadi: " + an.absent.join(", ")], "fnote")); }
      add("Natijalar", S.build(stuCols(26)));
      if (X.ok) {
        const Q = sheet(XL, P, 11);
        top(Q, `${title(X, 1)} — savollar`, 11);
        Q.push(["Savol", "Maks. ball", "O'rtacha ball", "O'zlashtirish %", "To'liq yechgan", "0 ball olgan", "50% dan past", "Yo'qotilgan ball %", "Ajratish indeksi", "Qiyinlik", "50% dan past olganlar"], "head");
        an.questions.forEach((q, k) => { const e = X.err[k] || {};
          Q.push([`${q.i}-savol`, q.max, r2(q.mean), r1(q.pct), q.full, q.zero, e.fail ?? 0, r1(e.share || 0), q.d === null ? "" : r2(q.d), q.level, (e.failNames || []).join(", ")], "q", {i: k, pct: q.pct, lv: q.level}); });
        Q.push([]); Q.merge(Q.push(["O'zlashtirish: 40% dan past — qiyin, 40–70% — o'rtacha, 70% dan yuqori — oson. Ajratish indeksi: 0,4 dan yuqori — a'lo, 0,2–0,4 — yaxshi, 0,2 dan past — kuchsiz."], "fnote"));
        add("Savollar", Q.build([8, 6, 8, 11, 8, 7, 8, 10, 9, 9, 36]));
        const Z = sheet(XL, P, 4);
        top(Z, title(X, 1), 4);
        Z.merge(Z.push(["Ko'rsatkichlar"], "sec"), 0, 3);
        for (const kv of [["Qatnashdi", an.n], ["Qatnashmadi", an.absent.length], ["Maksimal ball", an.tot_max], ["O'rtacha ball", r2(an.mean_total)], ["Mediana %", r1(an.median_pct)],
          ["Eng yuqori ball", an.best.total], ["Eng past ball", an.worst.total], ["O'zlashtirish, % (o'rtacha foiz)", r1(an.mastery)], ["Bilim sifati, % («4» va «5»)", r1(an.quality)]]) Z.push(kv, "kv");
        Z.push([]); Z.merge(Z.push(["Baholar taqsimoti"], "sec"), 0, 3);
        Z.push(["Baho", "Soni", "%"], "head", {w: 3});
        for (const k of [5, 4, 3, 2]) Z.push([k, an.grades[k], an.n ? Math.round(100 * an.grades[k] / an.n) : 0], "grade", {g: k, w: 3});
        Z.push(["Jami", an.n, an.n ? 100 : 0], "kpi", {w: 3});
        const R = X.rec, tn = (x) => x.tone === "ok" ? "ok" : x.tone === "bad" ? "bad" : "tip";
        for (const [t, L, tone] of [["Umumiy xulosa", [R.verdict, ...R.next.map((x, i) => ({t: (i ? "" : "Keyingi qadam: ") + x.t, tone: "info"}))], tn(R.verdict)], ["Savollar bo'yicha", R.qs, "tip"], ["O'quvchilar bo'yicha", [...R.st, ...R.data], "tip"]]) {
          if (!L.length) continue;
          Z.push([]); Z.merge(Z.push([t], "sec", {tone}), 0, 3); for (const x of L) Z.push(["• " + bsbRecText(x.t)], "li");
        }
        const S1 = sg.filter((s) => s[0] || s[1]);
        if (S1.length) { Z.push([]); for (const [l, n] of S1) Z.merge(Z.push([`${l}: ____________ ${n}`], "sign"), 0, 3); }
        add("Xulosa", Z.build([32, 10, 10, 26], {chars: 80}));
      }
    } else {
      const S = sheet(XL, P, W);
      top(S, title(X, 2), W, H.note ? String(H.note).split("\n") : []);
      S.push(["№", "O'quvchining familiyasi, ismi", ...an.qmax.map((_, i) => `${i + 1}-s.`), "Jami", "%", "Baho"], "head"); const mr = S.push(maxRow, "max") + 1;
      stuRows(X, x.ord2, S, mr);
      const sm = (t, f, tail) => ["", t, ...an.questions.map(f), ...(tail || ["", "", ""])];
      if (X.ok && on("sum")) for (const r of [sm("O'rtacha ball", (q) => r1(q.mean), [r1(an.mean_total), Math.round(an.mean_pct), ""]), sm("O'zlashtirish, %", (q) => Math.round(q.pct)), sm("To'liq yechganlar", (q) => q.full), sm("0 ball olganlar", (q) => q.zero)]) S.push(r, "sum");
      S.push([]);
      // jadvalchalar ism ustunidan (B) boshlanadi: «№» ustuni tor
      if (X.ok && on("dist")) { S.push(["", "Baho", "Soni", "%"], "head", {o: 1, w: 3}); for (const k of [5, 4, 3, 2]) S.push(["", k, an.grades[k], an.n ? Math.round(100 * an.grades[k] / an.n) : 0], "grade", {g: k, o: 1, w: 3}); S.push([]); }
      if (on("kpi")) {
        for (const [l, v] of [["Sinfdagi o'quvchilar", X.c.students.length], ["Qatnashdi", an.n], ["Qatnashmadi", an.absent.length], ["O'rtacha ball", X.ok ? r1(an.mean_total) : ""], ["O'zlashtirish, %", X.ok ? Math.round(an.mastery) : ""], ["Bilim sifati, %", X.ok ? Math.round(an.quality) : ""]])
          S.push(["", l, v], "kv", {o: 1, w: 2});
        S.push([]);
      }
      if (H.fnote) { for (const s of String(H.fnote).split("\n")) S.merge(S.push([s], "fnote")); S.push([]); }
      const S2 = sg.filter((s) => s[0] || s[1]);
      if (on("sig") && S2.length) { const per = Math.max(1, Math.floor((W - 1) / S2.length)), r = S.push(["", ...S2.flatMap(([l, n]) => [`${l}: ____________ ${n}`, ...Array(per - 1).fill("")]).slice(0, W - 1)], "sign"); S2.forEach((_, i) => S.merge(r, 1 + i * per, Math.min(W - 1, i * per + per))); }
      add(X.kind, S.build(stuCols(28)));
    }
    XL.writeFile(wb, `${X.file}.xlsx`, {cellStyles: true});
  }
  // Excel ko'rinishi (oynada): faylning boshidagi qatorlar
  function xlPreview(X, H, form) {
    const an = X.an, nq = an.qmax.length, x = H.bx, cols = Array.from({length: nq + 5}, (_, i) => col(i));
    const rows = [];
    const tabs = form === 1 ? ["Natijalar", "Savollar", "Xulosa"] : [X.kind];
    rows.push([["b", H.school || ""]], [["t", title(X, form)]], [["", `Sinf: ${X.meta.cls}   Fan: ${X.meta.subject || "—"}   Sana: ${X.meta.date}`]], []);
    rows.push([["h", "№"], ["h", form === 1 ? "O'quvchi" : "O'quvchining familiyasi, ismi"], ...an.qmax.map((_, i) => ["h", form === 1 ? `${i + 1}-savol` : `${i + 1}-s.`]), ["h", "Jami"], ["h", "%"], ["h", "Baho"]]);
    rows.push([["", ""], ["b", "Maksimal ball"], ...an.qmax.map((v) => ["c", gnum(v)]), ["c b", gnum(an.tot_max)], ["c", 100], ["", ""]]);
    const mr = rows.length, cT = col(2 + nq);
    list(X, x["ord" + form]).slice(0, 8).forEach(({s, name}, i) => { const r = rows.length + 1;
      rows.push(s ? [["c", i + 1], ["", name], ...s.pts.map((v) => ["c", gnum(v)]), ["c fx", gnum(s.total), `=SUM(C${r}:${col(1 + nq)}${r})`], ["c fx", Math.round(s.pct), `=ROUND(${cT}${r}/$${cT}$${mr}*100;0)`], ["c fx", s.grade, "=IF(…)"]] : [["c", i + 1], ["", name], ["c", "qatnashmadi"]]); });
    rows.push([["", "…"]]);
    const body = rows.map((rw, i) => `<tr><td class="rn">${i + 1}</td>${cols.map((_, k) => { const c = rw[k]; return c ? `<td class="${c[0]}"${c[2] ? ` title="${esc(c[2])}"` : ""}>${esc(c[1])}</td>` : "<td></td>"; }).join("")}</tr>`).join("");
    return `<div class="bx-xl"><div class="bx-xlw"><table><tr><th></th>${cols.map((c) => `<th>${c}</th>`).join("")}</tr>${body}</table></div><div class="bx-xltabs">${tabs.map((t, i) => `<span class="${i ? "" : "on"}">${esc(t)}</span>`).join("")}</div></div>
      <p class="bx-xlnote">📗 Yashil sonlar — formula: «Jami», «%» va «Baho» ball o'zgartirilsa o'zi qayta hisoblanadi. Ranglar — PDF varaqdagidek.</p>`;
  }

  return {excel, xlPreview, data, cfg, title, loadXlsxStyle};
})();
