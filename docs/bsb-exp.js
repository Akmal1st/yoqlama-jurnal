/* BSB / CHSB / Loyiha ishi tahlili → umumiy «Chop etish va eksport» oynasi (EXP, eksport.js), 2-bosqich (maket v7, Akmal 2026-11-14 tasdiqladi;
   rejani bajarish — Akmal 2026-11-15). Ikki hujjat: «Tahlil hisoboti» (an) va «Rasmiy shakl» (form). Varaq mazmuni eski eksportdagidek:
   sarlavha ma'lumoti, ko'rsatkichlar, baholar taqsimoti, savollar bo'yicha o'zlashtirish va jadvali, xulosa (bsbRecs), kim qaysi savolda
   qiynaldi, o'quvchilar natijalari; rasmiy shaklda — o'rtacha qatorlar, taqsimot va ko'rsatkichlar. Hisob-kitob index.html da (baAnalysis,
   bsbStats, bsbRecs, bsbErrors); Excel fayli eski rasmiy ko'rinishida — BXP.excel (bsb-eksport.js). Sozlamalar: D.web.bsb_hdr. */
const BEX = (() => {
  const nf = (x, d = 1) => String(Math.round(x * 10 ** d) / 10 ** d).replace(".", ",");
  const f2 = (x) => (+x).toFixed(2).replace(".", ",");
  const p0 = (x) => Math.round(x) + "%";
  const gn = (v) => String(gnum(v)).replace(".", ",");
  const gc = (g) => ({5: "gc5", 4: "gc4", 3: "gc3", 2: "gc2"}[g] || "");
  const qc = (p) => p < 40 ? "q-r" : p < 70 ? "q-y" : "q-g";
  const K = (items) => ({k: "kpi", h: 58, items});
  const R = (h, ...cells) => ({k: "row", h, cells: cells.filter(Boolean)});
  const SEC = (t) => ({k: "sec", h: 20, t});
  const dot = (x) => `<i class="dt ${x.tone}"></i>${x.t}`;
  // sarlavha bir qatorga sig'sin: «Bo'lim bo'yicha …» / «1-chorak bo'yicha …» uzun bo'lsa — «Summativ baholash (…) …» (chorak va sana pastki qatorda)
  const shortT = (t) => t.length > 48 ? t.replace(/^.*? bo'yicha s/, "S") : t;
  const HD = () => (D.web && D.web.bsb_hdr) || {};

  // imzolar: o'qituvchi va uchinchi imzo umumiy oynadan (Maktab va imzo), eski «Lavozim | F.I.Sh.» qatorlaridagi boshqalari ham qoladi
  function sigsOf() {
    const H = HD(), out = [["Fan o'qituvchisi", H.teacher || ""], [H.role3 || "Metod birlashma rahbari", H.deputy || ""]];
    for (const l of String(H.sign || "").split("\n").map((x) => x.trim()).filter(Boolean)) {
      const i = l.indexOf("|"), t = (i < 0 ? l : l.slice(0, i)).trim(), n = i < 0 ? "" : l.slice(i + 1).trim();
      if (!/o.qituvchi|rahbar|o.rinbosar/i.test(t)) out.push([t, n]);
    }
    return out;
  }
  // eski eksport sozlamasi bilan bir xil Excel (o'quvchilar tartibi va qismlar — oynadagi tanlovdan)
  function hx(o, form) {
    const H = BXP.cfg(), ch = o.ch;
    const off1 = ["kpi", "chart", "qtab", "rec", "stu"].filter((k) => !ch[k]).concat(ch.sg ? [] : ["sig"]), off2 = ["sum", "dist", "kpi"].filter((k) => !ch[k]).concat(ch.sg ? [] : ["sig"]);
    return {...H, bx: {...H.bx, form, off1, off2, ord1: o.ord === "g" ? "score" : "list", ord2: o.ord === "g" ? "score" : "list", bw: o.bw}};
  }

  function spec(o, X) {
    const fm = o.doc === "form", an = X.an, m = X.meta, H = HD(), L = X.c.students.length, N = an.n, MX = an.tot_max, nq = an.qmax.length;
    const base = {who: m.cls + (m.subject ? " · " + m.subject : ""), doc: fm ? "Rasmiy shakl" : `${X.kind} tahlili`, period: m.date, title: shortT(BXP.title(X, fm ? 2 : 1)),
      sub: [`${m.cls} sinf`, m.subject, `${X.kind} · ${m.date}`].filter(Boolean).join(" · ") + (H.note ? " · " + String(H.note).replace(/\n/g, " ") : ""),
      sigs: sigsOf(), q: X.q,
      xlfn: (bw) => BXP.excel(X, hx({...o, bw}, fm ? 2 : 1), fm ? 2 : 1), xlhtml: (bw) => BXP.xlPreview(X, hx({...o, bw}, fm ? 2 : 1), fm ? 2 : 1),
      cap: `📊 ${X.kind} · ${m.date}\n${m.cls}${m.subject ? " " + m.subject : ""}${X.ok ? `\nO'rtacha: ${nf(an.mean_total)}/${gn(MX)} · Sifat: ${p0(an.quality)}` : ""}`};
    if (!X.ok) return {...base, empty: "Tahlil uchun ishtirok etgan o'quvchilar va ballar kiritilmagan."};
    // o'quvchilar: «Ro'yxat» — jurnal tartibida (qatnashmaganlar o'z o'rnida), «Natija ↓» — ball bo'yicha (qatnashmaganlar izohda)
    const byScore = o.ord === "g", list = byScore ? X.ranked.map((s) => ({s, name: s.name})) : X.c.students.map((st) => ({s: X.by[st.name] || null, name: st.name}));
    const rows = list.map(({s, name}, i) => s
      ? [i + 1, name, ...s.pts.map((v) => gn(v)), {v: gn(s.total), b: 1, n: s.total}, fm ? {v: p0(s.pct), n: Math.round(s.pct)} : {v: p0(s.pct), bar: s.pct, gr: 1, n: Math.round(s.pct)}, {v: s.grade, c: gc(s.grade), b: 1}]
      : [i + 1, {v: `${name} — ${(an.noData || []).includes(name) ? "ball kiritilmagan" : "qatnashmadi"}`, c: "mut"}, ...Array(nq + 2).fill({v: "—", c: "mut"}), ""]);
    rows.unshift(Object.assign(["", {v: "Maksimal ball", b: 1}, ...an.qmax.map((x) => ({v: gn(x), b: 1})), {v: gn(MX), b: 1}, {v: "100", b: 1}, ""], {mx: 1}));
    if (fm && o.ch.sum) {
      const qs = an.questions;
      rows.push(Object.assign(["", "O'rtacha ball", ...qs.map((q) => nf(q.mean)), {v: nf(an.mean_total), b: 1}, {v: p0(an.mean_pct), b: 1}, ""], {tot: 1}));
      rows.push(Object.assign(["", "O'zlashtirish, %", ...qs.map((q) => ({v: Math.round(q.pct), c: qc(q.pct), b: 1})), "", "", ""], {tot: 1}));
      rows.push(Object.assign(["", "To'liq yechganlar", ...qs.map((q) => q.full), "", "", ""], {tot: 1}));
      rows.push(Object.assign(["", "0 ball olganlar", ...qs.map((q) => q.zero), "", "", ""], {tot: 1}));
    }
    const qw = Math.max(5, Math.min(8, 40 / Math.max(1, nq))), nameW = 100 - 5 - nq * qw - 8 - (fm ? 8 : 12) - 7;
    const cols = [{h: "№", w: 5}, {h: "O'quvchining familiyasi, ismi", w: nameW, a: "l"}, ...an.qmax.map((_, k) => ({h: `${k + 1}-s.`, w: qw})), {h: "Jami", w: 8}, {h: "%", w: fm ? 8 : 12}, {h: "Baho", w: 7}];
    const g = an.grades, cnt = (k) => g[k], absentTxt = byScore && an.absent.length ? ` Qatnashmadi: ${an.absent.join(", ")}.` : "";
    const leg = "Baho: 86–100% — 5, 66–85% — 4, 30–65% — 3, 30% dan past — 2. Bo'sh kataklar 0 ball deb olingan." + absentTxt;
    const fnote = String(H.fnote || "").trim(), fnB = fnote ? [{k: "txt", h: 16 + 14 * Math.ceil(fnote.length / 120), t: esc(fnote).replace(/\n/g, "<br>")}] : [];
    const info = {k: "info", h: 54, cols: 4, items: [["Sinf", m.cls], ["Fan", m.subject || "—"], ["Sana", m.date], ["Savollar / maks. ball", `${nq} ta / ${gn(MX)}`], ["Bo'lim / mavzu", m.title || "—", 2], ["Fan o'qituvchisi", H.teacher || "—", 2]]};
    const kpi = K([[N, "Qatnashdi", an.absent.length ? `${an.absent.length} ta qatnashmadi` : "hammasi", an.absent.length ? "o" : "", L], [nf(an.mean_total), "O'rtacha ball", `mediana ${p0(an.median_pct)}`, "", gn(MX)],
      [p0(an.mastery), "O'zlashtirish", "o'rtacha foiz"], [p0(an.quality), "Bilim sifati", "«4» va «5» ulushi"], [`${gn(an.best.total)} / ${gn(an.worst.total)}`, "Eng yuqori / past", "ball"]]);
    const gtab = {k: "gtab", span: 3, T: N, items: [[5, cnt(5), "gc5"], [4, cnt(4), "gc4"], [3, cnt(3), "gc3"], [2, cnt(2), "gc2"]]};
    if (fm) {
      const post = [];
      if (o.ch.dist && o.ch.kpi) post.push(R(132, gtab, {k: "list", t: "Ko'rsatkichlar", span: 2, items: [["Sinfda", L], ["Qatnashdi", N], ["Qatnashmadi", an.absent.length, an.absent.length ? "r" : ""], ["O'rtacha ball", `${nf(an.mean_total)} / ${gn(MX)}`], ["O'zlashtirish", p0(an.mastery)], ["Bilim sifati", p0(an.quality)]]}));
      else if (o.ch.dist) post.push(R(132, gtab));
      else if (o.ch.kpi) post.push(kpi);
      return {...base, pre: [info], cols, rows, post: post.concat(fnB), maxRh: 24, leg: o.ch.leg ? leg : "", fit1: 1};
    }
    const Q = an.questions.map((q, k) => ({q, e: X.err[k] || {}}));
    const RC = X.rec, qItems = RC.qs.map(dot), sItems = RC.st.concat(RC.data).map(dot);
    if (!sItems.length) sItems.push(dot({tone: "ok", t: "Alohida e'tibor talab qiladigan o'quvchi yo'q."}));
    const land = o["ori_an"] === "l", ulH = (ul, w) => 24 + ul.reduce((a, x) => a + Math.ceil(x.replace(/<[^>]+>/g, "").length / w) * 15 + 3, 0) + 8;
    const hard = X.err.filter((e) => e.fail), lineH = (names) => 4 + Math.ceil(names.join(", ").length / (land ? 150 : 96)) * 14;
    const pre = [info];
    if (o.ch.kpi) pre.push(kpi, SEC("Baholar taqsimoti"), R(132, gtab, {k: "list", t: "Natija", span: 2, items: [["«5» olganlar", cnt(5)], ["«4» olganlar", cnt(4)], ["«3» olganlar", cnt(3)], ["«2» olganlar", cnt(2), cnt(2) ? "r" : ""], ["Qatnashmadi", an.absent.length, an.absent.length ? "r" : ""]]}));
    if (o.ch.chart) pre.push(SEC("Savollar bo'yicha o'zlashtirish"), R(nq * 17 + 16, {k: "hbars", lw: 70, rw: 40, rw2: 1, rowH: 17, guides: [40, 70], axis: [0, 40, 70, 100],
      items: Q.map(({q}) => [`${q.i}-savol`, Math.min(100, q.pct), p0(q.pct), q.pct < 40 ? "lo" : q.pct < 70 ? "mid" : "", `${f2(q.mean)} / ${gn(q.max)} ball`])}),
      {k: "txt", h: 14, t: "Chiziqlar: 40% dan past — qiyin, 40–70% — o'rtacha, 70% dan yuqori — oson."});
    if (o.ch.qtab) pre.push(SEC("Savollar jadvali"), {k: "mtab", h: 20 * (nq + 1), cols: [{h: "Savol", w: 9}, {h: "Maks.", w: 7}, {h: "O'rt. ball", w: 9}, {h: "O'zlash.", w: 9}, {h: "To'liq", w: 8}, {h: "0 ball", w: 8}, {h: "50% dan past", w: 12}, {h: "Yo'qotilgan ball", w: 15}, {h: "Ajratish", w: 10}, {h: "Qiyinlik", w: 13}],
      rows: Q.map(({q, e}) => [{v: `${q.i}-savol`, b: 1}, gn(q.max), f2(q.mean), {v: p0(q.pct), c: qc(q.pct), b: 1}, q.full, q.zero, e.fail ?? 0, p0(e.share || 0), q.d === null ? "—" : f2(q.d), {tags: [[q.level, q.pct < 40 ? "r" : q.pct < 70 ? "y" : "g"]]}])},
      {k: "txt", h: 28, t: "O'zlash. — savol bo'yicha o'rtacha foiz. Yo'qotilgan ball — sinf yo'qotgan jami ballning shu savolga to'g'ri kelgan ulushi. Ajratish indeksi (kuchli va kuchsiz 27% o'quvchi farqi): 0,4 dan yuqori — a'lo, 0,2–0,4 — yaxshi, 0,2 dan past — kuchsiz (6 tadan kam o'quvchida hisoblanmaydi)."});
    if (o.ch.rec) {
      const vt = [RC.verdict.t, ...RC.next.map((x) => "Keyingi qadam: " + x.t)];
      pre.push(SEC("Xulosa"), R(ulH(vt, land ? 185 : 122) + 2, {k: "note", tone: RC.verdict.tone, t: "Umumiy xulosa", text: RC.verdict.t + RC.next.map((x) => `<br><b>Keyingi qadam:</b> ${x.t}`).join("")}),
        R(Math.max(ulH(qItems, land ? 84 : 54), ulH(sItems, land ? 84 : 54)), {k: "note", tone: "plain", t: "Savollar bo'yicha", ul: qItems, dots: 1}, {k: "note", tone: "plain", t: "O'quvchilar bo'yicha", ul: sItems, dots: 1}));
      if (hard.length) pre.push(SEC("Kim qaysi savolda qiynaldi (50% dan past)"), {k: "mtab", h: 26 + hard.reduce((a, e) => a + lineH(e.failNames), 0), cols: [{h: "Savol", w: 10}, {h: "O'quvchilar", w: 90, a: "l"}],
        rows: hard.map((e) => [{v: `${e.i}-savol`, b: 1}, {v: e.failNames.join(", "), c: "wr"}])});
    }
    if (!o.ch.stu) return {...base, pre, post: fnB};
    pre.push(SEC("O'quvchilar natijalari"));
    return {...base, pre, cols, rows, post: fnB, maxRh: 24, leg: o.ch.leg ? leg : ""};
  }

  function open(c, B) {
    const X = BXP.data(c, B), lo = X.kind === "Loyiha ishi";
    const F = {key: "bsb", t: `${X.kind} tahlili`, ic: "bar-chart-line",
      docs: [{id: "an", t: "Tahlil hisoboti", s: "ko'rsatkichlar, savollar, xulosa, natijalar", oris: ["p", "l"], ori: "p", ord: 1, xl: 1},
        {id: "form", t: "Rasmiy shakl", s: "natijalar jadvali — MB uchun", oris: ["p", "l"], ori: X.an.qmax.length > 12 ? "l" : "p", ord: 1, xl: 1}],
      chips: [["kpi", "Ko'rsatkichlar", 1], ["chart", "Savollar grafigi", 1, "an"], ["qtab", "Savollar jadvali", 1, "an"], ["rec", "Xulosa", 1, "an"], ["stu", "O'quvchilar natijalari", 1, "an"],
        ["sum", "O'rtacha qatorlar", 1, "form"], ["dist", "Baholar taqsimoti", 1, "form"], ["leg", "Izoh", 1]],
      spec: (o) => spec(o, X), q: () => X.q || null};
    if (lo) F.ic = "kanban";
    return EXP.open(F);
  }
  return {open, spec};
})();
