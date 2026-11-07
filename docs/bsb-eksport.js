/* BSB / CHSB tahlili eksporti — tasdiqlangan dizayn (maket v5, Akmal 2026-11-02: «Tasdiqlayman»).
   Oyna: chapda sozlamalar, o'ngda varaqning jonli ko'rinishi (telefonda «Sozlash / Ko'rish»).
   Ikki shakl: 1) Tahlil hisoboti — varaqlarga oqib tushadi, uzun jadval bo'linadi; 2) Rasmiy shakl — doim bitta varaqqa sig'diriladi.
   Hisob-kitob index.html da: baAnalysis, bsbRecs, bsbErrors, baMeta, baFileBase, quarterOf. Bu fayl asosiy skriptdan OLDIN ulanadi.
   Sozlamalar D.web.bsb_hdr da: school, note, fnote, sign («Lavozim | F.I.Sh.» qatorlari), teacher, deputy, bx {form, off1, off2, bw, ord1, ord2, ori}.
   Taqsimot ko'rinishi bx.dv: tab (Jadval, asosiy) | row (Qator) | bar (Chiziq) | col (Ustun) — Akmal 2026-11-04 tasdiqlagan.
   Sarlavha ish turidan o'zi tuziladi (eski H.title ishlatilmaydi). Savol nomlari eksportga chiqmaydi (Akmal). */
const BXP = (() => {
  const SECS = {
    1: [["hdr", "🏫 Sarlavha"], ["kpi", "📈 Ko'rsatkichlar"], ["chart", "📊 Diagramma"], ["qtab", "🧩 Savollar jadvali"], ["rec", "💡 Xulosa"], ["stu", "👥 O'quvchilar"], ["sig", "✍ Imzolar"]],
    2: [["hdr", "🏫 Sarlavha"], ["sum", "Σ O'rtacha qatorlar"], ["dist", "📊 Taqsimot"], ["kpi", "📈 Ko'rsatkichlar"], ["sig", "✍ Imzolar"]],
  };
  const nf = (x, d = 1) => String(Math.round(x * 10 ** d) / 10 ** d).replace(".", ",");
  const f2 = (x) => (+x).toFixed(2).replace(".", ",");
  const p0 = (x) => Math.round(x) + "%";
  const gn = (v) => String(gnum(v)).replace(".", ",");
  const gcol = (g) => `var(--g${g})`, lcol = (l) => l === "qiyin" ? "var(--lq)" : l === "oson" ? "var(--le)" : "var(--lo)";

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

  /* ───────── varaq bloklari ───────── */
  function hdr(X, H, form, signs) {
    const m = X.meta, an = X.an, nq = an.qmax.length;
    return `<div class="bx-hd">${H.school ? `<div class="bx-sch">${esc(H.school)}</div>` : ""}<h1>${esc(title(X, form))}</h1>${H.note ? `<div class="bx-note">${esc(H.note).replace(/\n/g, "<br>")}</div>` : ""}<div class="bx-bar"></div>
      <div class="bx-inf"><div><span>Sinf</span><b>${esc(m.cls)}</b></div><div><span>Fan</span><b>${esc(m.subject || "—")}</b></div><div><span>Sana</span><b>${m.date}</b></div><div><span>Savollar / maks. ball</span><b>${nq} ta / ${gn(an.tot_max)}</b></div>
      <div class="bx-w2"><span>Bo'lim / mavzu</span><b>${esc(m.title || "—")}</b></div><div class="bx-w2 bx-end"><span>Fan o'qituvchisi</span><b>${esc(teacherOf(signs, H)) || "&nbsp;"}</b></div></div></div>`;
  }
  function kpis(X) {
    const an = X.an, k = (l, v, sub) => `<div class="bx-kpi"><span>${l}</span><b>${v}</b>${sub ? `<i>${sub}</i>` : ""}</div>`;
    return `<div class="bx-kpis">${k("Qatnashdi", `${an.n}<small> / ${X.c.students.length}</small>`, an.absent.length ? `${an.absent.length} ta qatnashmadi` : "hammasi")}
      ${k("O'rtacha ball", `${nf(an.mean_total)}<small> / ${gn(an.tot_max)}</small>`, `mediana ${p0(an.median_pct)}`)}${k("O'zlashtirish", p0(an.mastery), "o'rtacha foiz")}
      ${k("Bilim sifati", p0(an.quality), "«4» va «5» ulushi")}${k("Eng yuqori / past", `${gn(an.best.total)}<small> / ${gn(an.worst.total)}</small>`, "ball")}</div>`;
  }
  const DV = [["tab", "Jadval"], ["row", "Qator"], ["bar", "Chiziq"], ["col", "Ustun"]], DVK = DV.map((d) => d[0]);
  const DVH = {tab: "Baho · Soni · % · chiziq — har baho alohida qatorda.", row: "Bitta qatorli ixcham jadval: «5», «4», «3», «2» yonma-yon.", bar: "Bitta ko'ndalang chiziq va izoh.", col: "Ustunli diagramma: har bahoning soni ustun balandligida."};
  const DVT = {
    tab: `<svg viewBox="0 0 60 38"><g stroke="#9aa" stroke-width=".6" fill="none"><rect x="3" y="3" width="54" height="32"/><path d="M3 9h54M3 15h54M3 21h54M3 27h54M14 3v32M24 3v32M33 3v32"/></g><rect x="3.3" y="9.3" width="10.4" height="5.4" fill="#5fb36a"/><rect x="3.3" y="15.3" width="10.4" height="5.4" fill="#bcdca0"/><rect x="3.3" y="21.3" width="10.4" height="5.4" fill="#f6e58d"/><rect x="3.3" y="27.3" width="10.4" height="2" fill="#ee9a96"/><rect x="3.3" y="3.3" width="53.4" height="5.4" fill="#e6f2f1"/><rect x="35" y="11" width="14" height="2.4" fill="#5fb36a"/><rect x="35" y="17" width="20" height="2.4" fill="#bcdca0"/><rect x="35" y="23" width="13" height="2.4" fill="#f6e58d"/><rect x="35" y="29" width="5" height="2.4" fill="#ee9a96"/></svg>`,
    row: `<svg viewBox="0 0 60 38"><rect x="3" y="11" width="10.8" height="7" fill="#5fb36a"/><rect x="13.8" y="11" width="10.8" height="7" fill="#bcdca0"/><rect x="24.6" y="11" width="10.8" height="7" fill="#f6e58d"/><rect x="35.4" y="11" width="10.8" height="7" fill="#ee9a96"/><rect x="46.2" y="11" width="10.8" height="7" fill="#e6f2f1"/><g stroke="#9aa" stroke-width=".6" fill="none"><rect x="3" y="11" width="54" height="16"/><path d="M3 18h54M13.8 11v16M24.6 11v16M35.4 11v16M46.2 11v16"/></g><g fill="#555"><rect x="6" y="21" width="5" height="2"/><rect x="16.8" y="21" width="5" height="2"/><rect x="27.6" y="21" width="5" height="2"/><rect x="38.4" y="21" width="5" height="2"/><rect x="49.2" y="21" width="5" height="2"/></g></svg>`,
    bar: `<svg viewBox="0 0 60 38"><g stroke="#888" stroke-width=".6"><rect x="3" y="12" width="15" height="7" fill="#5fb36a"/><rect x="18" y="12" width="21" height="7" fill="#bcdca0"/><rect x="39" y="12" width="13" height="7" fill="#f6e58d"/><rect x="52" y="12" width="5" height="7" fill="#ee9a96"/></g><g fill="#888"><rect x="3" y="24" width="3" height="3" fill="#5fb36a"/><rect x="7" y="24.5" width="8" height="2"/><rect x="18" y="24" width="3" height="3" fill="#bcdca0"/><rect x="22" y="24.5" width="8" height="2"/><rect x="33" y="24" width="3" height="3" fill="#f6e58d"/><rect x="37" y="24.5" width="8" height="2"/></g></svg>`,
    col: `<svg viewBox="0 0 60 38"><g stroke="#888" stroke-width=".6"><rect x="7" y="18" width="8" height="15" fill="#5fb36a"/><rect x="20" y="8" width="8" height="25" fill="#bcdca0"/><rect x="33" y="18" width="8" height="15" fill="#f6e58d"/><rect x="46" y="27" width="8" height="6" fill="#ee9a96"/></g><path d="M3 33h54" stroke="#777" stroke-width=".8"/></svg>`,
  };
  function distBox(X, kind) {     // tanlangan ko'rinishdagi taqsimot (bar — eski chiziq ko'rinishi)
    const g = X.an.grades, n = X.an.n || 1, K = [5, 4, 3, 2], pc = (k) => 100 * g[k] / n, mx = Math.max(1, ...K.map((k) => g[k]));
    if (kind === "row") return `<table class="bx-drow"><tr>${K.map((k) => `<th style="background:${gcol(k)}">«${k}»</th>`).join("")}<th>Jami</th></tr><tr>${K.map((k) => `<td><b>${g[k]} ta</b><small>${p0(pc(k))}</small></td>`).join("")}<td><b>${X.an.n} ta</b><small>100%</small></td></tr></table>`;
    if (kind === "col") return `<div><div class="bx-dcol">${K.map((k) => `<div><b>${g[k]}</b><span style="height:${Math.round(86 * g[k] / mx)}%;background:${gcol(k)}"></span></div>`).join("")}</div><div class="bx-dcx">${K.map((k) => `<div><b>«${k}»</b> · ${p0(pc(k))}</div>`).join("")}</div></div>`;
    if (kind === "bar") return dist(X);
    return `<table class="bx-dtab"><tr><th>Baho</th><th>Soni</th><th>%</th><th class="l">Taqsimot</th></tr>${K.map((k) => `<tr><td style="background:${gcol(k)}"><b>«${k}»</b></td><td>${g[k]}</td><td>${p0(pc(k))}</td><td class="bx-dbar"><span class="bx-gb" style="width:${Math.round(100 * g[k] / mx)}%;background:${gcol(k)}"></span></td></tr>`).join("")}<tr class="bx-dj"><td>Jami</td><td>${X.an.n}</td><td>100%</td><td></td></tr></table>`;
  }
  function dist(X) {
    const g = X.an.grades, n = X.an.n || 1;
    return `<div class="bx-dist"><span class="bx-dt">Baholar</span><div class="bx-sb">${[5, 4, 3, 2].filter((k) => g[k]).map((k) => `<div style="width:${100 * g[k] / n}%;background:${gcol(k)}">${g[k] / n >= 0.12 ? `«${k}» ${g[k]}` : g[k]}</div>`).join("")}</div>
      <div class="bx-lg">${[5, 4, 3, 2].map((k) => `<span><i style="background:${gcol(k)}"></i>«${k}» ${g[k]} ta · ${p0(100 * g[k] / n)}</span>`).join("")}</div></div>`;
  }
  function chart(X) {
    return `<div><h3>Savollar bo'yicha o'zlashtirish</h3><div class="bx-qb">${X.an.questions.map((q) => `<span class="bx-qn">${q.i}-savol</span>
      <div class="bx-qt"><div class="bx-qf" style="width:${Math.min(q.pct, 100)}%;background:${lcol(q.level)}"></div><span class="bx-qv" style="left:${Math.min(q.pct, 88)}%">${p0(q.pct)}</span><span class="bx-qth" style="left:40%"></span><span class="bx-qth" style="left:70%"></span></div>
      <span class="bx-qr">${f2(q.mean)} / ${gn(q.max)} ball</span>`).join("")}<span></span><div class="bx-ax">${[0, 40, 70, 100].map((v) => `<span style="left:${v}%">${v}%</span>`).join("")}</div><span></span></div>
      <p class="bx-small">Chiziqlar: 40% dan past — qiyin, 40–70% — o'rtacha, 70% dan yuqori — oson.</p></div>`;
  }
  function qtab(X) {
    return `<div><h3>Savollar jadvali</h3><table><tr><th>Savol</th><th>Maks.</th><th>O'rt. ball</th><th>O'zlash.</th><th>To'liq</th><th>0 ball</th><th>50% dan past</th><th>Yo'qotilgan ball</th><th>Ajratish</th><th>Qiyinlik</th></tr>
      ${X.an.questions.map((q, k) => { const e = X.err[k] || {}; return `<tr><td><b>${q.i}-savol</b></td><td>${gn(q.max)}</td><td>${f2(q.mean)}</td><td style="background:${lcol(q.level)}"><b>${p0(q.pct)}</b></td><td>${q.full}</td><td>${q.zero}</td><td>${e.fail ?? 0}</td><td>${p0(e.share || 0)}</td><td>${q.d === null ? "—" : f2(q.d)}</td><td><span class="bx-lv" style="background:${lcol(q.level)}">${q.level}</span></td></tr>`; }).join("")}</table>
      <p class="bx-small">O'zlash. — savol bo'yicha o'rtacha foiz. Yo'qotilgan ball — sinf yo'qotgan jami ballning shu savolga to'g'ri kelgan ulushi. Ajratish indeksi (kuchli va kuchsiz 27% o'quvchi farqi): 0,4 dan yuqori — a'lo, 0,2–0,4 — yaxshi, 0,2 dan past — kuchsiz (6 tadan kam o'quvchida hisoblanmaydi).</p></div>`;
  }
  function rec(X) {
    const b = (t, k, col, ic) => `<div class="bx-xb" style="--c:${col}"><b>${ic} ${t}</b><ul>${X.rec[k].map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`;
    const hard = X.err.filter((e) => e.fail);
    return [`<div><h3>Xulosa</h3><div class="bx-xs">${b("Yutuqlar", "good", "#2e7d32", "✓")}${b("Kamchiliklar", "bad", "#c62828", "!")}${b("Tavsiyalar", "tips", "#1565c0", "→")}</div></div>`,
      ...(hard.length ? [`<div><h3>Kim qaysi savolda qiynaldi (50% dan past)</h3><table>${hard.map((e) => `<tr><td style="width:80px"><b>${e.i}-savol</b></td><td class="l">${esc(e.failNames.join(", "))}</td></tr>`).join("")}</table></div>`] : [])];
  }
  function list(X, ord) {     // [{s|null, name}] — ro'yxat (qatnashmaganlar o'z o'rnida) yoki ball bo'yicha (qatnashmaganlar pastda alohida)
    return ord === "score" ? X.ranked.map((s) => ({s, name: s.name})) : X.c.students.map((st) => ({s: X.by[st.name] || null, name: st.name}));
  }
  function stuTable(X, official, ord, sum) {
    const an = X.an, nq = an.qmax.length, L = list(X, ord);
    const head = `<tr><th>№</th><th class="l">O'quvchining familiyasi, ismi</th>${an.qmax.map((_, i) => `<th>${i + 1}-s.</th>`).join("")}<th>Jami</th><th>%</th><th>Baho</th></tr>
      <tr class="mx"><td></td><td class="l">Maksimal ball</td>${an.qmax.map((m) => `<td>${gn(m)}</td>`).join("")}<td>${gn(an.tot_max)}</td><td>100</td><td></td></tr>`;
    const body = L.map(({s, name}, i) => s ? `<tr><td>${i + 1}</td><td class="l">${esc(name)}</td>${s.pts.map((v) => `<td>${gn(v)}</td>`).join("")}<td><b>${gn(s.total)}</b></td><td${official ? "" : ' style="text-align:left;white-space:nowrap"'}>${official ? p0(s.pct) : `<span class="bx-mb" style="width:${Math.round(Math.min(s.pct, 100) * 0.32)}px"></span> ${p0(s.pct)}`}</td><td style="background:${gcol(s.grade)}"><b>${s.grade}</b></td></tr>`
      : `<tr class="ab"><td>${i + 1}</td><td class="l">${esc(name)}</td><td colspan="${nq + 3}">qatnashmadi</td></tr>`).join("");
    const qs = an.questions, sm = sum && X.ok ? `<tr class="sm"><td></td><td class="l">O'rtacha ball</td>${qs.map((q) => `<td>${nf(q.mean)}</td>`).join("")}<td><b>${nf(an.mean_total)}</b></td><td><b>${p0(an.mean_pct)}</b></td><td></td></tr>
      <tr class="sm"><td></td><td class="l">O'zlashtirish, %</td>${qs.map((q) => `<td style="background:${lcol(q.level)}"><b>${Math.round(q.pct)}</b></td>`).join("")}<td colspan="3"></td></tr>
      <tr class="sm"><td></td><td class="l">To'liq yechganlar</td>${qs.map((q) => `<td>${q.full}</td>`).join("")}<td colspan="3"></td></tr>
      <tr class="sm"><td></td><td class="l">0 ball olganlar</td>${qs.map((q) => `<td>${q.zero}</td>`).join("")}<td colspan="3"></td></tr>` : "";
    return `<table>${head}${body}${sm}</table>`;
  }
  function signs(H, sg) {
    const s = sg.filter((x) => x[0] || x[1]), fn = String(H.fnote || "").trim();
    return `<div style="display:flex;flex-direction:column;gap:8px;margin-top:auto">${fn ? `<div class="bx-fnote">${esc(fn).replace(/\n/g, "<br>")}</div>` : ""}${s.length ? `<div class="bx-sig" style="--n:${s.length}">${s.map(([l, n]) => `<div><span class="bx-ln"><small>imzo</small></span><span>${esc(l)}</span><span class="bx-sn">${esc(n)}</span></div>`).join("")}</div>` : ""}</div>`;
  }
  function blocks(X, H, form) {
    const x = H.bx, off = new Set(x["off" + form]), on = (k) => !off.has(k), sg = signsOf(H), B = [], an = X.an;
    B.push(on("hdr") ? hdr(X, H, form, sg) : `<h1>${esc(title(X, form))}</h1>`);
    if (form === 1) {
      if (!X.ok) { B.push("<p>Tahlil uchun ishtirok etgan o'quvchilar va ballar kiritilmagan.</p>"); if (on("sig")) B.push(signs(H, sg)); return B; }
      if (on("kpi")) B.push(`<div style="display:grid;gap:8px">${kpis(X)}${x.dv === "bar" ? dist(X) : `<div><h3>Baholar taqsimoti</h3><div class="bx-dw${x.dv === "row" ? " bx-full" : ""}">${distBox(X, x.dv)}</div></div>`}</div>`);
      if (on("chart")) B.push(chart(X));
      if (on("qtab")) B.push(qtab(X));
      if (on("rec")) B.push(...rec(X));
      if (on("stu")) B.push(`<div><h3>O'quvchilar natijalari</h3>${stuTable(X, false, x.ord1, false)}${x.ord1 === "score" && an.absent.length ? `<p class="bx-small"><b>Qatnashmadi:</b> ${esc(an.absent.join(", "))}</p>` : ""}<p class="bx-small">Baho: 86–100% — 5, 66–85% — 4, 30–65% — 3, 30% dan past — 2. Bo'sh kataklar 0 ball deb olingan.</p></div>`);
    } else {
      B.push(stuTable(X, true, x.ord2, on("sum")));
      const d = on("dist") && X.ok, k = on("kpi");
      if (d || k) {
        const kp = (l, v) => `<div class="bx-kpi"><span>${l}</span><b>${v}</b></div>`;
        B.push(`<div class="bx-ft2${d && k ? "" : " one"}">${d ? `<div><h3>Baholar taqsimoti</h3>${distBox(X, x.dv)}</div>` : ""}${k ? `<div><h3>Ko'rsatkichlar</h3><div class="bx-kg">${kp("Sinfda", X.c.students.length)}${kp("Qatnashdi", an.n)}${kp("Qatnashmadi", an.absent.length)}${kp("O'rtacha ball", X.ok ? nf(an.mean_total) + "<small> / " + gn(an.tot_max) + "</small>" : "—")}${kp("O'zlashtirish", X.ok ? p0(an.mastery) : "—")}${kp("Bilim sifati", X.ok ? p0(an.quality) : "—")}</div></div>` : ""}</div>`);
      }
    }
    if (on("sig")) B.push(signs(H, sg));
    return B;
  }

  /* ───────── varaqlarga bo'lish (o'lchab) ───────── */
  let meas = null;
  function measurer(land, bw) {
    if (!meas || !meas.isConnected) { meas = document.createElement("div"); meas.className = "bx-meas"; document.body.append(meas); }
    meas.innerHTML = `<div class="bx-pg${land ? " bx-land" : ""}${bw ? " bx-bw" : ""}"><div class="bx-body"></div><div class="bx-pf"><span>x</span><span>1 / 1</span></div></div>`;
    return meas.querySelector(".bx-body");
  }
  const over = (body) => body.scrollHeight > body.clientHeight + 1;
  const isHead = (r) => !!r.querySelector("th") || r.classList.contains("mx");
  function paginate(B, form, land) {
    const body = measurer(land);
    if (form === 2) {                 // bitta varaq: sig'masa eng katta sig'adigan masshtab qidiriladi
      const html = B.join(""), fits = (z) => { body.innerHTML = `<div class="bx-zm" style="zoom:${z.toFixed(3)}">${html}</div>`; return !over(body); };
      let z = 1;
      if (!fits(1)) { let lo = 0.3, hi = 1; for (let i = 0; i < 11; i++) { const m = (lo + hi) / 2; if (fits(m)) lo = m; else hi = m; } z = lo; }
      meas.innerHTML = "";
      return [{html, zoom: z}];
    }
    const P = [], queue = B.slice(); let cur = [];
    const flush = () => { if (cur.length) P.push({html: cur.join(""), zoom: 1}); cur = []; body.innerHTML = ""; };
    let guard = 0;
    while (queue.length && guard++ < 500) {
      const h = queue.shift(), tpl = document.createElement("div"); tpl.innerHTML = h; const node = tpl.firstElementChild || tpl;
      body.append(node);
      if (!over(body)) { cur.push(node.outerHTML); continue; }
      node.remove();
      const tbl = node.querySelector && node.querySelector("table");
      if (tbl) {                      // jadval bo'linadi: sarlavha qatorlari keyingi betda takrorlanadi
        const part = node.cloneNode(true); [...part.children].filter((ch) => ch.tagName === "P").forEach((p) => p.remove());
        body.append(part);
        const rows = [...part.querySelector("table").rows].filter((r) => !isHead(r));
        let k = rows.length; while (k > 0 && over(body)) rows[--k].remove();
        if (k >= 3 && k < rows.length) {
          cur.push(part.outerHTML); flush();
          const rest = node.cloneNode(true), rh = rest.querySelector("h3");
          [...rest.querySelector("table").rows].filter((r) => !isHead(r)).slice(0, k).forEach((r) => r.remove());
          if (rh) rh.textContent = rh.textContent.replace(/ \(davomi\)$/, "") + " (davomi)";
          queue.unshift(rest.outerHTML); continue;
        }
        part.remove();
      }
      if (cur.length) { flush(); queue.unshift(h); continue; }
      cur.push(node.outerHTML); flush();   // bo'linmaydigan juda katta blok — o'z betida
    }
    flush(); meas.innerHTML = "";
    return P.length ? P : [{html: "", zoom: 1}];
  }
  const landOf = (H, X, form) => H.bx.ori === "l" || (H.bx.ori === "auto" && form === 2 && X.an.qmax.length > 12);
  function pagesHtml(X, H, form) {
    const land = landOf(H, X, form), P = paginate(blocks(X, H, form), form, land), m = X.meta;
    const foot = (i) => `<div class="bx-pf"><span>${esc([m.cls, m.subject, X.kind, m.date].filter(Boolean).join(" · "))}</span><span>${i + 1} / ${P.length}</span></div>`;
    return {land, P, pages: P.map((pg, i) => `<div class="bx-pg${land ? " bx-land" : ""}${H.bx.bw ? " bx-bw" : ""}"><div class="bx-body">${pg.zoom < 1 ? `<div class="bx-zm" style="zoom:${pg.zoom.toFixed(3)}">${pg.html}</div>` : pg.html}</div>${foot(i)}</div>`)};
  }

  /* ───────── chop etish / PDF ───────── */
  function print(X, H, form) {
    const R = pagesHtml(X, H, form);
    let el = document.getElementById("pdoc"); if (!el) { el = document.createElement("div"); el.id = "pdoc"; document.body.append(el); }
    el.className = "bx-print"; el.innerHTML = R.pages.join(""); document.body.classList.add("pdoc");
    let st = document.getElementById("pdoc-css"); if (!st) { st = document.createElement("style"); st.id = "pdoc-css"; document.head.append(st); }
    st.textContent = `@media print{@page{size:A4 ${R.land ? "landscape" : "portrait"};margin:0}}`;
    // varaq faqat chop etish oynasi yopilgach («afterprint») tozalanadi: telefonda printer uzoq qidirilsa ham varaq yo'qolmaydi
    const old = document.title, back = () => { document.title = old; window.removeEventListener("afterprint", back); el.className = ""; };
    document.title = X.file; window.addEventListener("afterprint", back); setTimeout(() => { document.title = old; }, 120000);
    window.print();
  }

  /* ───────── Excel (Jami, %, Baho — formula) ───────── */
  const col = (i) => { let s = ""; i++; while (i) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; };
  const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;
  // o'quvchi qatorlari: C.. — savollar, keyin Jami, %, Baho; maxRow — «Maksimal ball» qatorining Excel raqami
  function stuRows(X, ord, aoa, F) {
    const an = X.an, nq = an.qmax.length, cT = col(2 + nq), cP = col(3 + nq), cG = col(4 + nq), maxRow = aoa.length;   // aoa.length = maxRow qatorining 0-asosli o'rni
    list(X, ord).forEach(({s, name}, i) => {
      const r = aoa.length + 1;
      if (!s) { aoa.push([i + 1, name, "qatnashmadi"]); return; }
      aoa.push([i + 1, name, ...s.pts, s.total, Math.round(s.pct), s.grade]);
      const sumF = `SUM(C${r}:${col(1 + nq)}${r})`, mx = `$${cT}$${maxRow}`;
      F.push([`${cT}${r}`, X.kind === "CHSB" ? `MIN(${mx},ROUNDUP(${sumF},0))` : sumF], [`${cP}${r}`, `ROUND(${cT}${r}/${mx}*100,0)`],
        [`${cG}${r}`, `IF(${cT}${r}/${mx}*100>=86,5,IF(${cT}${r}/${mx}*100>=66,4,IF(${cT}${r}/${mx}*100>=30,3,2)))`]);
    });
  }
  async function excel(X, H, form) {
    const XL = await loadXlsx(), wb = XL.utils.book_new(), an = X.an, m = X.meta, nq = an.qmax.length, x = H.bx, off = new Set(x["off" + form]), on = (k) => !off.has(k), sg = signsOf(H);
    const add = (name, aoa, cols, F = [], merges) => { const ws = XL.utils.aoa_to_sheet(aoa); ws["!cols"] = cols.map((w) => ({wch: w})); if (merges) ws["!merges"] = merges; for (const [a, f] of F) if (ws[a]) ws[a].f = f; XL.utils.book_append_sheet(wb, ws, name); };
    const qh = an.qmax.map((_, i) => `${i + 1}-savol`), maxRow = ["", "Maksimal ball", ...an.qmax, an.tot_max, 100, ""], W = nq + 5;
    const info = `Sinf: ${m.cls}   Fan: ${m.subject || "—"}   Sana: ${m.date}   Bo'lim / mavzu: ${m.title || "—"}   Savollar: ${nq} ta / ${gnum(an.tot_max)} ball`;
    if (form === 1) {
      const F = [], aoa = [[H.school || ""], [title(X, 1)], [info], [], ["№", "O'quvchi", ...qh, "Jami", "%", "Baho"], maxRow];
      stuRows(X, x.ord1, aoa, F);
      if (x.ord1 === "score" && an.absent.length) aoa.push([], ["", "Qatnashmadi: " + an.absent.join(", ")]);
      add("Natijalar", aoa, [5, 30, ...Array(nq).fill(9), 8, 7, 7], F, [0, 1, 2].map((r) => ({s: {r, c: 0}, e: {r, c: W - 1}})));
      if (X.ok) {
        add("Savollar", [["Savol", "Maks. ball", "O'rtacha ball", "O'zlashtirish %", "To'liq yechgan", "0 ball olgan", "50% dan past", "Yo'qotilgan ball %", "Ajratish indeksi", "Qiyinlik", "50% dan past olganlar"],
          ...an.questions.map((q, k) => { const e = X.err[k] || {}; return [`${q.i}-savol`, q.max, r2(q.mean), r1(q.pct), q.full, q.zero, e.fail ?? 0, r1(e.share || 0), q.d === null ? "" : r2(q.d), q.level, (e.failNames || []).join(", ")]; })], [10, 10, 13, 15, 13, 12, 12, 17, 15, 11, 50]);
        add("Xulosa", [[title(X, 1)], [info], [], ["Qatnashdi", an.n], ["Qatnashmadi", an.absent.length], ["Maksimal ball", an.tot_max], ["O'rtacha ball", r2(an.mean_total)], ["Mediana %", r1(an.median_pct)],
          ["Eng yuqori ball", an.best.total], ["Eng past ball", an.worst.total], ["O'zlashtirish, % (o'rtacha foiz)", r1(an.mastery)], ["Bilim sifati, % («4» va «5»)", r1(an.quality)], [],
          ["Baho", "Soni"], ...[5, 4, 3, 2].map((k) => [k, an.grades[k]]), [],
          ...[["Yutuqlar", "good"], ["Kamchiliklar", "bad"], ["Tavsiyalar", "tips"]].flatMap(([t, k]) => [[t], ...X.rec[k].map((s) => ["• " + s]), []]),
          ...sg.filter((s) => s[0] || s[1]).map(([l, n]) => [`${l}: ____________ ${n}`])], [40, 16]);
      }
    } else {
      const F = [], head = [[H.school || ""], [title(X, 2)], ...(H.note ? String(H.note).split("\n").map((s) => [s]) : []), [info]];
      const aoa = [...head, [], ["№", "O'quvchining familiyasi, ismi", ...an.qmax.map((_, i) => `${i + 1}-s.`), "Jami", "%", "Baho"], maxRow];
      stuRows(X, x.ord2, aoa, F);
      const sm = (t, f, tail) => ["", t, ...an.questions.map(f), ...(tail || ["", "", ""])];
      if (X.ok && on("sum")) aoa.push(sm("O'rtacha ball", (q) => r1(q.mean), [r1(an.mean_total), Math.round(an.mean_pct), ""]), sm("O'zlashtirish, %", (q) => Math.round(q.pct)), sm("To'liq yechganlar", (q) => q.full), sm("0 ball olganlar", (q) => q.zero));
      aoa.push([]);
      if (X.ok && on("dist")) aoa.push(["Baho", "Soni", "%"], ...[5, 4, 3, 2].map((k) => [k, an.grades[k], an.n ? Math.round(100 * an.grades[k] / an.n) : 0]), []);
      if (on("kpi")) aoa.push(["Sinfdagi o'quvchilar", "", "Qatnashdi", "Qatnashmadi", "O'rtacha ball", "O'zlashtirish %", "Bilim sifati %"],
        [X.c.students.length, "", an.n, an.absent.length, X.ok ? r1(an.mean_total) : "", X.ok ? Math.round(an.mastery) : "", X.ok ? Math.round(an.quality) : ""], []);
      if (H.fnote) aoa.push(...String(H.fnote).split("\n").map((s) => [s]), []);
      const S2 = sg.filter((s) => s[0] || s[1]);
      if (on("sig") && S2.length) aoa.push(["", ...S2.flatMap(([l, n]) => [`${l}: ____________ ${n}`, ...Array(Math.max(0, Math.floor((W - 1) / S2.length) - 1)).fill("")]).slice(0, W - 1)]);
      add(X.kind, aoa, [5, 32, ...Array(Math.max(nq, 9)).fill(8), 8, 7, 7], F, head.map((_, r) => ({s: {r, c: 0}, e: {r, c: W - 1}})));
    }
    XL.writeFile(wb, `${X.file}.xlsx`);
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
      <p class="bx-xlnote">📗 Yashil sonlar — formula: «Jami», «%» va «Baho» ball o'zgartirilsa o'zi qayta hisoblanadi. Excel fayli rangsiz bo'ladi.</p>`;
  }

  /* ───────── oyna ───────── */
  const THUMB = {
    1: `<svg viewBox="0 0 120 70" aria-hidden="true"><rect width="120" height="70" fill="#fff" stroke="#ccc"/><rect x="8" y="6" width="50" height="4" fill="#0b5c5a"/><g fill="#e6f2f1" stroke="#9cc"><rect x="8" y="14" width="18" height="9" rx="1"/><rect x="29" y="14" width="18" height="9" rx="1"/><rect x="50" y="14" width="18" height="9" rx="1"/><rect x="71" y="14" width="18" height="9" rx="1"/><rect x="92" y="14" width="20" height="9" rx="1"/></g><rect x="8" y="28" width="70" height="4" fill="#bcdca0"/><rect x="8" y="35" width="60" height="4" fill="#bcdca0"/><rect x="8" y="42" width="44" height="4" fill="#f6e58d"/><rect x="8" y="49" width="30" height="4" fill="#ee9a96"/><rect x="8" y="57" width="104" height="8" fill="#f2f2f2" stroke="#ccc"/></svg>`,
    2: `<svg viewBox="0 0 120 70" aria-hidden="true"><rect width="120" height="70" fill="#fff" stroke="#ccc"/><rect x="35" y="5" width="50" height="3" fill="#0b5c5a"/><rect x="25" y="10" width="70" height="4" fill="#333"/><rect x="8" y="17" width="104" height="7" fill="none" stroke="#bbb"/><g fill="#eee" stroke="#ccc"><rect x="8" y="27" width="104" height="5"/><rect x="8" y="32" width="104" height="5"/><rect x="8" y="37" width="104" height="5"/><rect x="8" y="42" width="104" height="5"/><rect x="8" y="47" width="104" height="5"/></g><rect x="8" y="55" width="50" height="5" fill="#bcdca0"/><rect x="66" y="55" width="46" height="5" fill="#e6f2f1"/><rect x="10" y="65" width="35" height="1" fill="#000"/><rect x="75" y="65" width="35" height="1" fill="#000"/></svg>`,
  };
  function dialog(c, B) {
    const H = cfg(), X = data(c, B), st = {view: "pdf", zoom: "fit", pt: "set"};
    let sg = signsOf(H), saveT = 0;
    const store = () => {             // imzolar «Lavozim | F.I.Sh.» qatorlari bo'lib saqlanadi; o'qituvchi va MB rahbari boshqa hisobotlar uchun ham
      H.sign = sg.filter((s) => s[0] || s[1]).map(([l, n]) => `${l} | ${n}`).join("\n");
      const t = sg.find((s) => /o.qituvchi/i.test(s[0])), d = sg.find((s) => /rahbar/i.test(s[0])); if (t) H.teacher = t[1]; if (d) H.deputy = d[1];
      clearTimeout(saveT); saveT = setTimeout(save, 400);
    };
    const seg = (id, opts, cur) => `<div class="bx-seg" data-seg="${id}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" class="${v === cur ? "on" : ""}">${l}</button>`).join("")}</div>`;
    return modal(`<div class="bx-dlg" data-pt="set">
      <div class="bx-side">
        <div class="bx-side-h"><h2>${X.kind} tahlilini eksport qilish</h2><div class="bx-work">${esc([X.kind, B.title, X.meta.date, X.meta.label].filter(Boolean).join(" · "))}</div></div>
        <div class="bx-tabs">${seg("pt", [["set", "⚙ Sozlash"], ["view", "👁 Ko'rish"]], "set")}</div>
        <div class="bx-side-b">
          <div><div class="bx-lbl">Shakl</div><div class="bx-forms">${[1, 2].map((f) => `<button type="button" class="bx-fc" data-v="${f}">${THUMB[f]}<b>${f === 1 ? "📊 Tahlil hisoboti" : "📋 Rasmiy shakl"}</b><small data-fcn="${f}"></small></button>`).join("")}</div></div>
          <div><div class="bx-lbl">Varaqqa kiradigan qismlar</div><div class="bx-chips" data-chips></div></div>
          <div data-dvw><div class="bx-lbl">Taqsimot ko'rinishi</div><div class="bx-dvs" data-dvs></div><p class="bx-dvh" data-dvh></p></div>
          <div style="display:grid;gap:8px"><div class="bx-lbl" style="margin:0">Ko'rinish</div>
            <div class="bx-opt"><span>Ranglar</span>${seg("bw", [["c", "🎨 Rangli"], ["bw", "⚫ Oq-qora"]], H.bx.bw ? "bw" : "c")}</div>
            <div class="bx-opt"><span>O'quvchilar</span><div data-ordw></div></div>
            <div class="bx-opt"><span>Varaq</span>${seg("ori", [["auto", "Avto"], ["p", "Tik"], ["l", "Yotiq"]], H.bx.ori)}</div></div>
          <details class="bx-grp"><summary>🏫 Sarlavha va imzolar</summary><div class="bx-in">
            <label class="bx-f">Maktab nomi<input type="text" id="hs" value="${esc(H.school)}" placeholder="Masalan: 12-umumta'lim maktabi"></label>
            <div class="bx-f">Sarlavha · ish turiga qarab o'zi qo'yiladi<div class="bx-auto" data-tit></div></div>
            <label class="bx-f">Sarlavha ostidagi qator<textarea id="hn" rows="1" placeholder="Masalan: 2026-2027 o'quv yili, 1-chorak">${esc(H.note || "")}</textarea></label>
            <div class="bx-f">Imzolar (lavozim · F.I.Sh.)</div><div data-signs style="display:grid;gap:6px"></div>
            <button type="button" class="bx-add" data-sadd>＋ Imzo qatori qo'shish</button>
            <label class="bx-f">Varaq oxiridagi izoh<textarea id="hfn" rows="1" placeholder="Masalan: Natijalar MB yig'ilishida muhokama qilindi.">${esc(H.fnote || "")}</textarea></label>
          </div></details>
          <div><div class="bx-lbl">Fayl nomi</div><div class="bx-fname"><b>${esc(X.file)}</b>.pdf · .xlsx</div></div>
        </div>
        <div class="bx-side-f"><button type="button" class="btn" data-x>Yopish</button><button type="button" class="btn" data-xl>📗 Excel</button><button type="button" class="btn" data-tgpdf title="PDF qilib Telegram botingizga yuborish">✈️ Telegram</button><button type="button" class="btn btn-primary" data-pdf>📄 PDF / Chop</button></div>
      </div>
      <div class="bx-prev"><div class="bx-prev-h">${seg("pv", [["pdf", "📄 Varaq"], ["xl", "📗 Excel"]], "pdf")}<span class="bx-pinfo" data-pinfo></span>${seg("zm", [["fit", "↔ Sig'dirish"], ["100", "🔍 100%"]], "fit")}</div><div class="bx-pages" data-pages></div></div>
    </div>`, (mm, close) => {
      mm.classList.add("bx-modal");
      const dlg = $(".bx-dlg", mm), box = $("[data-pages]", mm), q = (s) => $(s, mm);
      const segSet = (id, v) => mm.querySelectorAll(`[data-seg="${id}"] button`).forEach((b) => b.classList.toggle("on", b.dataset.v === v));
      const side = () => {
        const f = H.bx.form, off = new Set(H.bx["off" + f]);
        mm.querySelectorAll(".bx-fc").forEach((b) => b.classList.toggle("on", +b.dataset.v === f));
        q("[data-chips]").innerHTML = SECS[f].map(([k, l]) => `<button type="button" class="bx-chip ${off.has(k) ? "" : "on"}" data-chip="${k}"><i>${off.has(k) ? "＋" : "✓"}</i>${l}</button>`).join("");
        q("[data-ordw]").innerHTML = seg("ord", [["list", "Ro'yxat"], ["score", "Ball bo'yicha"]], H.bx["ord" + f]);
        q("[data-dvs]").innerHTML = DV.map(([v, l]) => `<button type="button" class="bx-dv${v === H.bx.dv ? " on" : ""}" data-dv="${v}" aria-pressed="${v === H.bx.dv}">${v === "tab" ? "<i>asosiy</i>" : ""}${DVT[v]}<b>${l}</b></button>`).join("");
        q("[data-dvh]").textContent = DVH[H.bx.dv];
        q("[data-dvw]").hidden = off.has(f === 2 ? "dist" : "kpi");
        q("[data-tit]").textContent = title(X, f);
        q("[data-signs]").innerHTML = sg.map(([l, n], i) => `<div class="bx-sg"><input type="text" data-sl="${i}" value="${esc(l)}" placeholder="Lavozim" aria-label="Lavozim"><input type="text" data-sn="${i}" value="${esc(n)}" placeholder="F.I.Sh." aria-label="F.I.Sh."><button type="button" class="bx-ib" data-sdel="${i}" title="O'chirish">✕</button></div>`).join("");
      };
      const draw = () => {
        const f = H.bx.form, R = pagesHtml(X, H, f), o = paginate(blocks(X, H, 3 - f), 3 - f, landOf(H, X, 3 - f));
        q(`[data-fcn="${f}"]`).textContent = `${R.P.length} bet`; q(`[data-fcn="${3 - f}"]`).textContent = `${o.length} bet`;
        const zm = R.P[0].zoom;
        q("[data-pinfo]").textContent = st.view === "xl" ? `${X.file}.xlsx` : `A4 · ${R.land ? "yotiq" : "tik"} · ${R.P.length} bet${zm < 1 ? ` · ${Math.round(zm * 100)}% ga kichraytirildi` : ""}${H.bx.bw ? " · oq-qora" : ""}`;
        q('[data-seg="zm"]').hidden = st.view === "xl";
        if (st.view === "xl") { box.innerHTML = xlPreview(X, H, f); return; }
        const W = R.land ? 1123 : 794, Hh = R.land ? 791 : 1120, avail = Math.max(240, box.clientWidth - 24), sc = st.zoom === "100" ? 1 : Math.min(1, avail / W);
        box.innerHTML = R.pages.map((p, i) => `<div><div class="bx-pw" style="width:${W * sc}px;height:${Hh * sc}px">${p.replace('class="bx-pg', `style="transform:scale(${sc})" class="bx-pg`)}</div><div class="bx-pno">${i + 1}-bet</div></div>`).join("");
      };
      const all = () => { side(); draw(); };
      mm.addEventListener("click", (e) => {
        const t = e.target.closest("button"); if (!t || !mm.contains(t)) return;
        const sgId = t.parentElement && t.parentElement.dataset.seg, v = t.dataset.v;
        if (sgId === "pt") { st.pt = v; dlg.dataset.pt = v; segSet("pt", v); draw(); }
        else if (sgId === "bw") { H.bx.bw = v === "bw"; segSet("bw", v); store(); draw(); }
        else if (sgId === "ori") { H.bx.ori = v; segSet("ori", v); store(); draw(); }
        else if (sgId === "ord") { H.bx["ord" + H.bx.form] = v; store(); all(); }
        else if (sgId === "pv") { st.view = v; segSet("pv", v); draw(); }
        else if (sgId === "zm") { st.zoom = v; segSet("zm", v); draw(); }
        else if (t.dataset.dv) { H.bx.dv = t.dataset.dv; store(); all(); }
        else if (t.classList.contains("bx-fc")) { H.bx.form = +v; S.bavar = +v; store(); all(); }
        else if (t.dataset.chip) { const a = H.bx["off" + H.bx.form], k = t.dataset.chip, i = a.indexOf(k); if (i >= 0) a.splice(i, 1); else a.push(k); store(); all(); }
        else if (t.dataset.sdel !== undefined) { sg.splice(+t.dataset.sdel, 1); store(); all(); }
        else if (t.hasAttribute("data-sadd")) { if (sg.length >= 4) { toast("Ko'pi bilan 4 ta imzo"); return; } sg.push(["", ""]); store(); side(); const ins = mm.querySelectorAll("[data-sl]"); ins[ins.length - 1].focus(); }
        else if (t.hasAttribute("data-x")) { clearTimeout(saveT); save(); close(); }
        else if (t.hasAttribute("data-pdf")) { clearTimeout(saveT); save(); close(); print(X, H, H.bx.form); }
        else if (t.hasAttribute("data-tgpdf")) { clearTimeout(saveT); save(); const R = pagesHtml(X, H, H.bx.form);
          PTG.run(() => PTG.pagesPdf(R.pages, R.land), X.file, `📄 ${X.file}`, t); }
        else if (t.hasAttribute("data-xl")) { clearTimeout(saveT); save(); close(); excel(X, H, H.bx.form).catch((er) => toast(er.message)); }
      });
      let it = 0;
      mm.addEventListener("input", (e) => {
        const t = e.target;
        if (t.id === "hs") H.school = t.value.trim(); else if (t.id === "hn") H.note = t.value.trim(); else if (t.id === "hfn") H.fnote = t.value.trim();
        else if (t.dataset.sl !== undefined) sg[+t.dataset.sl][0] = t.value; else if (t.dataset.sn !== undefined) sg[+t.dataset.sn][1] = t.value; else return;
        store(); clearTimeout(it); it = setTimeout(draw, 150);
      });
      let rt = 0; const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => mm.isConnected ? draw() : ro.disconnect(), 120); }) : null;
      if (ro) ro.observe(box);
      all();
      if (document.fonts && document.fonts.status !== "loaded") document.fonts.ready.then(() => mm.isConnected && draw());   // shrift yuklangach qayta o'lchanadi
    }).then(() => { clearTimeout(saveT); save(); });
  }
  return {dialog, excel, blocks, paginate, pagesHtml, data, cfg, title, print};
})();
