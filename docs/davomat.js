/* Hisobotlar → «Davomat varag'i» — tasdiqlangan dizayn (maket v4.1, Akmal 2026-11-04). hisobotlar.js repAtt shu yerga murojaat qiladi.
   Butun chorak bitta ro'yxatda: har o'quvchi qatorida faqat yo'qlama belgisi qo'yilgan kunlar (sana va belgi), oxirida S, DQ, K, KQ va davomat %.
   Oy bo'yicha bo'lish yo'q (Akmal: «oylik yo'qlamalar kerak emas, faqat shu chorak bo'yicha»).
   Varaq (A4 tik, rasmiy hujjat ko'rinishi) bir xil belgilash bilan uch joyda: ekrandagi oldindan ko'rish, chop etish va Telegram PDF.
   36 o'quvchigacha bitta varaqqa sig'adi: ko'p bo'lsa ixcham ko'rinish, keyin shrift o'lchab-o'lchab kichraytiriladi.
   Tanlov bosilganda butun sahifa qayta chizilmaydi: softRender() faqat o'zgargan joylarni almashtiradi. */
const DVM = (() => {
  const KEY = "yoqlama_dv";
  const DEF = {view: "list", all: true, fs: "m", sum: true, sig: true};
  const V = Object.assign({}, DEF, {w: 0});
  try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s && typeof s === "object") for (const k of Object.keys(DEF)) if (k in s && typeof s[k] === typeof DEF[k]) V[k] = s[k]; } catch (e) {}
  if (!["list", "paper"].includes(V.view)) V.view = "list";
  if (!["s", "m", "l"].includes(V.fs)) V.fs = "m";
  const keep = () => { try { const o = {}; for (const k of Object.keys(DEF)) o[k] = V[k]; localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} };
  const CODES = {s: "S", dq: "DQ", k: "K", kq: "KQ", ch: "CH"}, ABS = ["s", "dq", "k"], KS = ["s", "dq", "k", "kq"];
  const FS = {s: 8.5, m: 9.5, l: 10.5};   // varaqdagi jadval shrifti, pt
  const d5 = (s) => fmt(s).slice(0, 5);
  const hdr = () => D.web.bsb_hdr || {};
  const thr = () => { const v = +((D.settings.risk || {}).att_below); return Number.isFinite(v) ? v : 80; };
  const phone = () => matchMedia("(max-width:820px)").matches;
  const attCol = (k) => (D.settings.attendance || {})[k];
  const chip = (v, txt) => { const col = attCol(v); return `<span class="dv-code" ${col ? `style="background:${col};color:${contrast(col)}"` : ""}>${txt}</span>`; };

  /* ───────── hisob: chorak ichidagi o'tilgan dars kunlari (bugungacha) ───────── */
  function data(c, q) {
    const r = qRange(q), t = todayIso();
    if (!r) return {none: true, q};
    if (r[0] > t) return {future: true, q, lo: r[0], hi: r[1]};
    const lo = r[0], hi = r[1] < t ? r[1] : t;
    const dates = c.dates.filter((d) => lo <= d && d <= hi && !isNoLesson(c, d)).sort();
    const tot = {s: 0, dq: 0, k: 0, kq: 0, ch: 0}; let own = 0, abs = 0;
    const rows = c.students.map((st, i) => {
      const cells = dates.map((d) => attPart(st.marks[d] || "")), r1 = {i, name: st.name, s: 0, dq: 0, k: 0, kq: 0, ch: 0};
      r1.marks = dates.map((d, j) => [d, cells[j]]).filter(([, v]) => CODES[v]);
      for (const [, v] of r1.marks) r1[v]++;
      const o = cells.filter((v) => v !== "ch").length; r1.abs = r1.s + r1.dq + r1.k;
      r1.att = o ? +pyFixed(100 * (o - r1.abs) / o, 1) : null; own += o; abs += r1.abs;
      for (const k of KS) tot[k] += r1[k]; tot.ch += r1.ch;
      return r1;
    });
    return {q, lo, hi, end: r[1], running: r[1] >= t, dates, rows, tot, abs, att: own ? +pyFixed(100 * (own - abs) / own, 1) : null,
      clean: rows.filter((x) => !x.abs && !x.kq).length};
  }
  const shown = (A) => V.all ? A.rows : A.rows.filter((r) => r.marks.length);
  const low = (r) => r.att !== null && r.att < thr();
  const pctTxt = (v) => v === null ? "—" : `${v}%`;
  const year = (lo) => { const y = +lo.slice(0, 4); return +lo.slice(5, 7) >= 8 ? `${y}–${y + 1}` : `${y - 1}–${y}`; };

  /* ───────── A4 varaq (tik): rasmiy hujjat ko'rinishi ───────── */
  function sheet(c, A, fs, rh) {
    const L = shown(A), H = hdr(), dense = L.length > 26, t = todayIso();
    const top = A.rows.filter((r) => r.abs).sort((a, b) => b.abs - a.abs || (a.att ?? 100) - (b.att ?? 100)).slice(0, 3);
    const lowN = A.rows.filter(low).length, teacher = (H.teacher || "").trim(), school = (H.school || "").trim();
    const mk = (r) => r.marks.length ? r.marks.map(([d, v]) => `<span class="dv-pm">${d5(d)}&nbsp;<b>${CODES[v]}</b></span>`).join("") : `<span class="dv-pn">—</span>`;
    const body = L.map((r) => `<tr><td class="dv-no">${r.i + 1}</td><td class="dv-nm">${esc(r.name)}</td><td class="dv-mk">${mk(r)}</td>${KS.map((k) => `<td>${r[k] || ""}</td>`).join("")}<td class="dv-bt ${low(r) ? "dv-lw" : ""}">${r.att === null ? "" : Math.round(r.att)}${low(r) ? "*" : ""}</td></tr>`).join("");
    const sum = V.sum ? `<div class="dv-sum">
        <div><h5>Chorak bo'yicha</h5><p>Dars kunlari: <b>${A.dates.length}</b> · O'quvchilar: <b>${A.rows.length}</b></p><p>Sinf davomati: <b>${pctTxt(A.att)}</b></p><p>Hamma darsda bo'lgan: <b>${A.clean}</b> nafar</p></div>
        <div><h5>Kelmagan holatlar · ${A.abs}</h5><p>Sababsiz (S): <b>${A.tot.s}</b> · Sababli (DQ): <b>${A.tot.dq}</b></p><p>Kasal (K): <b>${A.tot.k}</b> · Kech qolgan (KQ): <b>${A.tot.kq}</b>${A.tot.ch ? ` · Chet elda (CH): <b>${A.tot.ch}</b>` : ""}</p><p>Davomati ${thr()}% dan past: <b>${lowN}</b> nafar</p></div>
        <div><h5>Eng ko'p qoldirganlar</h5>${top.length ? top.map((r, k) => `<p>${k + 1}. ${esc(r.name)} — <b>${r.abs}</b> dars</p>`).join("") : "<p>Yo'q</p>"}</div></div>` : "";
    return `<div class="bx-pg dv-pg ${dense ? "dense" : ""}"><div class="dv-in">
      <div class="dv-phd">${school ? `<div class="dv-sch">${esc(school)}</div>` : ""}<h4>DAVOMAT VARAG'I</h4>
        <div class="dv-sub">${esc(c.name)} sinf${c.subject ? ` · ${esc(c.subject)}` : ""} · ${A.q}-chorak, ${year(A.lo)} o'quv yili</div></div>
      <div class="dv-inf"><span>Davr: <b>${fmt(A.lo)} – ${fmt(A.hi)}</b>${A.running ? " (bugungacha)" : ""}</span>${teacher ? `<span>O'qituvchi: <b>${esc(teacher)}</b></span>` : ""}<span>Dars kunlari: <b>${A.dates.length}</b></span><span>Davomat: <b>${pctTxt(A.att)}</b></span></div>
      <table class="dv-st" style="font-size:${fs}pt;--rh:${rh}pt"><colgroup><col style="width:7mm"><col style="width:${(fs * 4.9).toFixed(1)}mm"><col><col style="width:8mm"><col style="width:8.5mm"><col style="width:8mm"><col style="width:8.5mm"><col style="width:10mm"></colgroup>
        <thead><tr><th>№</th><th class="l">O'quvchining ismi, familiyasi</th><th class="l">Yo'qlama belgilari (sana va belgi)</th><th>S</th><th>DQ</th><th>K</th><th>KQ</th><th>%</th></tr></thead>
        <tbody>${body}</tbody>
        <tfoot><tr><td></td><td class="dv-nm">Jami</td><td class="dv-mk">${A.abs} ta kelmagan holat, ${A.tot.kq} marta kech qolgan</td>${KS.map((k) => `<td>${A.tot[k]}</td>`).join("")}<td>${A.att === null ? "" : Math.round(A.att)}</td></tr></tfoot></table>
      <div class="dv-lg"><b>Belgilar:</b> S — sababsiz, DQ — sababli (hujjat bilan), K — kasal, KQ — kech qoldi${A.tot.ch ? ", CH — chet elda (bu kunlar davomat foiziga kirmaydi)" : ""}. % — o'quvchining chorakdagi davomati; * — ${thr()}% dan past.${V.all ? "" : " Ro'yxatda faqat belgisi bor o'quvchilar."}</div>
      ${sum}
      ${V.sig ? `<div class="dv-sig"><div><span></span><small>Fan o'qituvchisi${teacher ? `: ${esc(teacher)}` : ""}</small></div><div><span></span><small>Sinf rahbari</small></div><div><span></span><small>Direktor o'rinbosari (O'IBDO')</small></div></div>` : ""}
      <div class="dv-ft"><span>Yo'qlama jurnal</span><span>Chop etilgan: ${fmt(t)}</span></div></div></div>`;
  }
  // varaqqa sig'dirish: yashirin joyda chizib o'lchaymiz, sig'masa shrift va qator balandligi bosqichma-bosqich kichrayadi
  let host = null;
  function fitted(c, A) {
    const L = shown(A), dense = L.length > 26, fs0 = FS[V.fs] || 9.5;
    const fixed = (dense ? 120 : 160) + (V.sum ? (dense ? 62 : 90) : 0) + (V.sig ? (dense ? 48 : 70) : 24) + 30;   // pt
    let fs = fs0, rh = Math.max(fs * 1.6, Math.min(fs * 3.2, (785 - fixed) / (L.length + 2)));
    if (!host) { host = document.createElement("div"); host.className = "dv-host"; host.setAttribute("aria-hidden", "true"); }
    if (!host.isConnected) document.body.append(host);
    for (let i = 0; i < 30; i++) {
      host.innerHTML = sheet(c, A, +fs.toFixed(2), +rh.toFixed(2));
      const inn = host.querySelector(".dv-in");
      if (!inn || inn.scrollHeight <= inn.clientHeight + 1 || fs <= 7) break;
      fs -= 0.25; rh = Math.max(fs * 1.4, rh - 1);
    }
    const inn = host.querySelector(".dv-in"), over = !!inn && inn.scrollHeight > inn.clientHeight + 1, html = host.innerHTML;
    host.innerHTML = "";
    return {html, over};
  }

  /* ───────── ekran ───────── */
  const ck = (k, t) => `<button class="dv-chk ${V[k] ? "on" : ""}" data-dv="tog" data-k="${k}" role="checkbox" aria-checked="${V[k]}"><i>${V[k] ? "✓" : ""}</i>${t}</button>`;
  const legend = () => `<span class="dv-lgd">${KS.map((k) => chip(k, CODES[k])).join("")}<span>sababsiz · sababli · kasal · kech qoldi</span></span>`;
  function table(A) {
    const L = shown(A);
    return `<div class="dv-tw hb-pc"><table class="dv-t"><thead><tr><th class="dv-no">№</th><th class="dv-nm">O'quvchi</th><th class="dv-mk">Yo'qlama belgilari <small>sana va belgi</small></th><th>S</th><th>DQ</th><th>K</th><th>KQ</th><th>%</th></tr></thead><tbody>
      ${L.map((r) => `<tr><td class="dv-no">${r.i + 1}</td><td class="dv-nm"><button data-dvcard="${esc(r.name)}">${esc(r.name)}</button></td>
        <td class="dv-mk">${r.marks.length ? r.marks.map(([d, v]) => chip(v, `${d5(d)} ${CODES[v]}`)).join("") : `<span class="dv-ok">✓ hamma darsda</span>`}</td>
        ${KS.map((k) => `<td>${r[k] || ""}</td>`).join("")}<td class="dv-pc ${low(r) ? "dv-lw" : ""}">${r.att ?? "—"}</td></tr>`).join("") || `<tr><td colspan="8" class="dv-ok" style="padding:16px">Bu chorakda hamma darsda bo'lgan 👍</td></tr>`}</tbody>
      <tfoot><tr><td></td><td class="dv-nm">Jami</td><td class="dv-mk">${A.abs} ta kelmagan holat</td>${KS.map((k) => `<td>${A.tot[k]}</td>`).join("")}<td>${A.att ?? "—"}</td></tr></tfoot></table></div>`;
  }
  function list(A) {
    const L = shown(A);
    return `<div class="dv-rows hb-tel">${L.map((r) => `<button class="dv-li ${r.abs ? "rk" : ""}" data-dvcard="${esc(r.name)}"><span class="dv-l1"><b class="hb-ell">${esc(r.name)}</b><span class="${low(r) ? "dv-lw" : ""}">${pctTxt(r.att)}</span></span>
        <span class="dv-mg">${r.marks.length ? r.marks.map(([d, v]) => chip(v, `${d5(d)} ${CODES[v]}`)).join("") : `<span class="dv-ok">✓ hamma darsda</span>`}</span></button>`).join("") || `<div class="dv-li">Bu chorakda hamma darsda bo'lgan 👍</div>`}</div>`;
  }
  function preview(P, n) {
    const pw = 210 * 3.7795, ph = 297 * 3.7795, s = V.w ? Math.min(1, V.w / pw) : 0.5;
    return `<div class="dv-pv"><div class="dv-bar"><span class="dv-chip a">A4 · tik</span><span class="dv-chip ${P.over ? "w" : ""}">${P.over ? "sig'madi — shriftni kichraytiring" : "1 varaq"}</span><span class="dv-chip">${n} o'quvchi</span></div>
      <div class="dv-desk"><div class="dv-fit" style="width:${(pw * s).toFixed(0)}px;height:${(ph * s).toFixed(0)}px"><div class="dv-scale" style="transform:scale(${s.toFixed(4)})">${P.html}</div></div></div></div>`;
  }
  // hisobotlar.js repAtt shu funksiyani chaqiradi
  function body(X) {
    const A = data(X.c, X.q);
    if (A.none) return `<div class="dv-empty"><b>${A.q}-chorak sanalari belgilanmagan</b><span>Sozlamalar → Choraklar bo'limida chorak boshlanish va tugash sanasini kiriting.</span></div>`;
    if (A.future) return `<div class="dv-empty"><b>${A.q}-chorak hali boshlanmagan</b><span>${fmt(A.lo)} dan boshlanadi. Boshqa chorakni tanlang.</span></div>`;
    if (!A.dates.length) return `<div class="dv-empty"><b>${A.q}-chorakda hali o'tilgan dars kunlari yo'q</b><span>Jurnalda dars kunlari paydo bo'lgach, shu yerda ko'rinadi.</span></div>`;
    const P = fitted(X.c, A), paper = V.view === "paper";
    const kp = `<div class="hb-kpis"><div class="hb-kpi"><small>Dars kunlari</small><b>${A.dates.length}</b><i>${d5(A.lo)} – ${d5(A.hi)}</i></div>
      <div class="hb-kpi"><small>Davomat</small><b>${pctTxt(A.att)}</b><i>butun chorak</i></div>
      <div class="hb-kpi"><small>Kelmagan holatlar</small><b>${A.abs}</b><i>S ${A.tot.s} · DQ ${A.tot.dq} · K ${A.tot.k}</i></div>
      <div class="hb-kpi"><small>Hamma kelgan</small><b>${A.clean} <i>/ ${A.rows.length}</i></b><i>KQ ${A.tot.kq} marta</i></div></div>`;
    const seg = `<div class="hb-seg dv-seg">${[["list", "Ekran", "Ro'yxat"], ["paper", "Varaq ko'rinishi", "Varaq"]].map(([k, pc, tel]) => `<button class="${V.view === k ? "on" : ""}" data-dv="view" data-v="${k}"><span class="hb-pc">${pc}</span><span class="hb-tel">${tel}</span></button>`).join("")}</div>`;
    const popts = paper ? `<div class="dv-tools"><span class="dv-lbl">Shrift</span><div class="hb-seg dv-seg">${[["s", "Kichik"], ["m", "O'rta"], ["l", "Katta"]].map(([k, n]) => `<button class="${V.fs === k ? "on" : ""}" data-dv="fs" data-v="${k}">${n}</button>`).join("")}</div>${ck("sum", "Xulosa bloki")}${ck("sig", "Imzo qatorlari")}</div>` : "";
    return `<style>@media print{@page{size:A4 portrait;margin:10mm}}</style>
      <div class="dv">${kp}
        <div class="dv-tools">${seg}${paper ? "" : `<span class="dv-sp hb-pc"></span>${legend()}`}</div>
        <div class="dv-tools">${ck("all", "Hamma darsda bo'lganlarni ham ko'rsatish")}</div>${popts}
        ${paper ? preview(P, shown(A).length) : table(A) + list(A)}</div>
      <div class="dv-print">${P.html}</div>`;
  }
  function fit(m) {
    const d = m.querySelector(".dv-desk"); if (!d || !d.clientWidth) return;
    const w = d.clientWidth - (phone() ? 16 : 28); if (Math.abs(w - V.w) < 2) return;
    V.w = w; softRender();
  }

  /* ───────── hodisalar ───────── */
  function act(el) {
    const a = el.dataset.dv, v = el.dataset.v;
    if (a === "view") V.view = v;
    else if (a === "fs") V.fs = v;
    else if (a === "tog") V[el.dataset.k] = !V[el.dataset.k];
    keep(); softRender();
    if (a === "view") requestAnimationFrame(() => { const m = document.querySelector("#main"); if (m) fit(m); });
  }
  const BOUND = new WeakSet();
  let rzT = null;
  addEventListener("resize", () => { clearTimeout(rzT); rzT = setTimeout(() => { const m = document.querySelector("#main"); if (m && m.querySelector(".dv-desk")) fit(m); }, 200); });
  function bind(m, getX) {
    const root = m.querySelector(".dv");
    if (root && !BOUND.has(root)) { BOUND.add(root);
      // bitta tinglovchi: softRender tugmalarni almashtirsa ham ishlayveradi
      root.addEventListener("click", (e) => {
        const el = e.target.closest("[data-dv]"); if (el && root.contains(el)) return act(el);
        const card = e.target.closest("[data-dvcard]"); if (card && root.contains(card)) HSB.student(card.dataset.dvcard);
      });
    }
    m.querySelectorAll("[data-dvx]").forEach((b) => b.onclick = () => xlsx(getX()));
    requestAnimationFrame(() => fit(m));
  }
  function xlsx(X) {
    const A = data(X.c, X.q);
    if (A.none || A.future || !A.dates.length) return toast("Bu chorakda o'tilgan dars kunlari yo'q");
    const H = hdr(), c = X.c, info = [["Maktab", H.school], ["O'qituvchi", H.teacher]].filter((x) => (x[1] || "").trim()).map(([a, b]) => `${a}: ${b.trim()}`);
    const aoa = [[`${label(c)} · Davomat varag'i · ${A.q}-chorak (${fmt(A.lo)} – ${fmt(A.hi)})`], [[...info, `Dars kunlari: ${A.dates.length}`, `Davomat: ${pctTxt(A.att)}`].join("   ")], [],
      ["№", "O'quvchi", "Yo'qlama belgilari (sana va belgi)", "S", "DQ", "K", "KQ", "Davomat %"],
      ...shown(A).map((r) => [r.i + 1, r.name, r.marks.map(([d, v]) => `${d5(d)} ${CODES[v]}`).join(", "), r.s, r.dq, r.k, r.kq, r.att]),
      ["", "Jami", `${A.abs} ta kelmagan holat, ${A.tot.kq} marta kech qolgan`, A.tot.s, A.tot.dq, A.tot.k, A.tot.kq, A.att]];
    saveTable(`${label(c)} davomat ${A.q}-chorak`, aoa, [5, 30, 70, 5, 5, 5, 5, 11]);
  }
  // Telegram: tayyor varaq bitta PDF sahifa bo'lib ketadi
  function pdfPages(X) {
    const A = data(X.c, X.q);
    if (A.none || A.future || !A.dates.length) throw new Error("Bu chorakda o'tilgan dars kunlari yo'q");
    return PTG.pagesPdf([fitted(X.c, A).html], false);
  }
  return {body, bind, xlsx, pdfPages, data, state: V};
})();
