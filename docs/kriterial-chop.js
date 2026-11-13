/* Kriterial (+/−) baholash: chop etish, PDF va Telegram — tasdiqlangan maket v5 (Akmal, 2026-11-13).
   To'rt hujjat: dars varaqasi, bo'sh varaq (1–5 dars), chorak jamlanmasi, o'quvchi kartalari (ota-onaga, A4 da 2 ta).
   Albom / tik varaq, rangli / oq-qora, «Baho ↓» tartibi; varaq shrifti va qator balandligi sahifaga o'lchab moslanadi
   (kichik sinfda kattalashadi). Bitta HTML: oldindan ko'rish, chop etish (#pdoc) va Telegram PDF (PTG.pagesPdf).
   Mantiq: CH (chet elda) «Keldi» hisobiga kirmaydi; boshqa usulda (Oddiy / Mezon) qo'yilgan baho «7*» — o'rtachaga kiradi,
   deskriptor % ga kirmaydi; «E'tibor kerak» = chorakda umuman kelmagan | kamida 3 baho va o'rtacha < 6 | baholar pasaygan.
   Sozlamalar shu qurilmada: localStorage "yoqlama_kch". kriterial.js dan keyin ulanadi (KRT.* dan foydalanadi). */
const KCH = (() => {
  const N = 9, ND = 5, LS = "yoqlama_kch";
  const r1 = (x) => Math.round(x * 10) / 10;
  const low = (t) => String(t).charAt(0).toLowerCase() + String(t).slice(1);
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const gc = (g) => g >= 8 ? "g1" : g >= 5 ? "g2" : "g3";
  const GBG = {g1: "#d9f2e1", g2: "#fdf0d3", g3: "#fbdcd8"};
  const code = (k) => k < ND ? `D${k + 1}` : `U${k - ND + 1}`;
  const tel = () => typeof matchMedia === "function" && matchMedia("(max-width: 700px)").matches;
  const attTxt = (a) => ((DAY_ATT.find((x) => x[0] === a) || [0, "Darsda yo'q"])[1]).split(" (")[0];
  const HDR = () => (D.web && D.web.bsb_hdr) || {};

  // ── sozlamalar (qurilmada)
  const DEF = {doc: "day", col: "c", ord: "l", ori: "l", cw: "all", bn: 1, bd: 0, bf: 1, bk: "cls", tpl: 0, t: null, ch: {leg: 1, st: 1, sch: 1, sg: 1, pt: 1}};
  function load() {
    let o = {}; try { o = JSON.parse(localStorage.getItem(LS) || "{}") || {}; } catch (e) { o = {}; }
    const s = Object.assign({}, DEF, o); s.ch = Object.assign({}, DEF.ch, o.ch || {});
    if (!["day", "blank", "q", "card"].includes(s.doc)) s.doc = "day";
    s.bn = Math.max(1, Math.min(5, +s.bn || 1));
    return s;
  }
  function keep(O) { try { const {doc, col, ord, ori, cw, bn, bd, bf, bk, tpl, t, ch} = O; localStorage.setItem(LS, JSON.stringify({doc, col, ord, ori, cw, bn, bd, bf, bk, tpl, t, ch})); } catch (e) { /* xotira yopiq */ } }

  // ── bitta o'quvchi, bitta dars: {a} kelmagan | {o, og} boshqa usul | {i} kriterial; null — guruhga hali qo'shilmagan
  function ent(c, s, d) {
    if (preJoin(c, s, d)) return null;
    const mk = s.marks[d] || "";
    if (KRT.absent(mk)) return {a: attPart(mk)};
    const kq = lateOf(mk);
    if (KRT.other(s, d)) { const g = gradesOf(mk); return {o: g.join("/"), og: mean(g), kq}; }
    return {i: KRT.info(s, d), kq};
  }
  const GA = (e) => !e || e.a ? null : e.o != null ? e.og : e.i.full ? e.i.g : null;   // jurnaldagi baho (har qanday usul)

  // ── chorak: kriterial baholangan darslar (kamida bitta to'liq baho), har o'quvchi bo'yicha
  function lessonsQ(c, q) {
    const r = qRange(q), t = todayIso(); if (!r) return [];
    return c.dates.filter((x) => x >= r[0] && x <= r[1] && x <= t && !isNoLesson(c, x)).sort()
      .filter((x) => c.students.some((s) => !preJoin(c, s, x) && KRT.info(s, x).full));
  }
  function qStat(c, q) {
    const L = lessonsQ(c, q);
    const S = c.students.map((s, si) => {
      const E = L.map((d) => ent(c, s, d)), gs = [], cnt = Array.from({length: N}, () => [0, 0]); let att = 0, all = 0;
      E.forEach((e) => {
        if (!e || e.a === "ch") return; all++; if (e.a) return; att++;
        const g = GA(e); if (g != null) gs.push(g);
        if (e.i) e.i.a.forEach((v, k) => { if (v) { cnt[k][1]++; if (v === "p") cnt[k][0]++; } });
      });
      const pct = cnt.map(([p, n]) => n ? Math.round(p / n * 100) : null), avg = gs.length ? mean(gs) : null;
      const h = Math.floor(gs.length / 2), drop = h >= 2 && mean(gs.slice(-h)) - mean(gs.slice(0, h)) <= -1.2;
      const why = all && !att ? "kelmagan" : gs.length >= 3 && avg < 6 ? "past" : drop ? "pasaygan" : "";
      return {si, s, E, gs, pct, avg, att, all, why, need: !!why};
    });
    return {q, L, S};
  }
  const WHY = {kelmagan: "darsga kelmagan", past: "o'rtacha 6 dan past", pasaygan: "baholar pasaygan"};

  // ── varaq qismlari
  const X = {};   // joriy chizish konteksti: {c, O, subj}
  function head(title, sub) {
    const sch = X.O.ch.sch && HDR().school ? `<div class="kc-sch">${esc(HDR().school)}</div>` : "";
    return `<div class="kc-ph"><div>${sch}<div class="kc-h">${title}</div><div class="kc-sub">${sub}</div></div>
      <div class="kc-fx">Baho = <b>1</b> + darsdagi ish «+» + uy vazifasi «+»<br>darsdagi ish 1–6 · uy vazifasi 0–4 · jami <b>1–10</b></div></div>`;
  }
  function legend(ds, blank) {
    if (!X.O.ch.leg && ds) return "";   // «Qo'lda» kriteriyalar: yozish joyi doim chiqadi
    const it = (k) => ds ? esc(ds[k]) : `<span class="kc-hl"></span>`;
    return `<div class="kc-leg"><div><b>Darsdagi ish · 1–6 ball</b><div class="kc-cols"><div><b>D0</b> Darsda qatnashdi — 1 ball (${blank ? "kelganlarga qo'yiladi" : "o'zi qo'yiladi"})</div>${[0, 1, 2, 3, 4].map((k) => `<div><b>${code(k)}</b> ${it(k)}</div>`).join("")}</div></div>
      <div><b>Uy vazifasi · 0–4 ball</b><div class="kc-cols">${[5, 6, 7, 8].map((k) => `<div><b>${code(k)}</b> ${it(k)}</div>`).join("")}</div></div></div>`;
  }
  const teacher = () => X.O.t != null ? X.O.t : HDR().teacher || "";
  const sign = (anon) => X.O.ch.sg ? `<span class="kc-sg">O'qituvchi: ${!anon && teacher() ? `<b>${esc(teacher())}</b>` : "_______________"} &nbsp; Imzo: ____________</span>` : "";
  const cls = (P) => `bx-pg kc-pg ${P ? "kc-por" : "bx-land"} ${X.O.col === "bw" ? "kc-bw" : ""}`;
  const pbot = (txt, pi, pn) => `<div class="kc-pbot"><span>Yo'qlama jurnali · ${txt}</span><span>${pi} / ${pn}</span></div>`;

  // 1. dars varaqasi va bo'sh varaq
  function dayPage(d, blank, bd, ds, fs, rh, pi, pn) {
    const {c, O} = X, P = O.ori === "p", gs = (k) => k === ND ? "gs" : "", fanB = blank && !O.bf;
    let R = (blank ? c.students.map((s, si) => si) : KRT.rowsOf(c, d)).map((si) => ({si, s: c.students[si], e: blank ? null : ent(c, c.students[si], d)}));
    if (!blank && O.ord === "g") R.sort((a, b) => ((GA(b.e) ?? -1) - (GA(a.e) ?? -1)) || a.si - b.si);
    const rows = R.map(({s, si, e}) => {
      const no = `<td>${si + 1}</td><td class="n">${esc(s.name)}</td>`;
      if (blank) return `<tr>${no}<td></td><td class="gs"></td>${Array.from({length: N}, (x, k) => `<td class="${gs(k)}"></td>`).join("")}<td class="gs"></td><td></td><td class="gs"></td></tr>`;
      if (e.a) return `<tr>${no}<td class="sm">${esc(e.a.toUpperCase())}</td><td colspan="${N + 4}" class="i gs">${esc(attTxt(e.a))} — baho qo'yilmaydi</td></tr>`;
      if (e.o != null) return `<tr>${no}<td class="sm">${e.kq ? "KQ" : ""}</td><td colspan="${N + 3}" class="i gs">Boshqa usulda baholangan (Oddiy / Mezon) — deskriptorsiz</td><td class="gs g ${gc(e.og)}">${esc(e.o)}*</td></tr>`;
      const i = e.i;
      return `<tr>${no}<td class="sm">${e.kq ? "KQ" : ""}</td><td class="gs">1</td>${i.a.map((v, k) => `<td class="pm ${v === "p" ? "p" : v === "m" ? "m" : ""} ${gs(k)}">${v === "p" ? "+" : v === "m" ? "−" : ""}</td>`).join("")}<td class="gs sm">${i.full ? i.d : ""}</td><td class="sm">${i.full ? i.u : ""}</td>${i.full ? `<td class="gs g ${gc(i.g)}">${i.g}</td>` : `<td class="gs ch">${i.any ? "chala" : ""}</td>`}</tr>`;
    }).join("");
    let ftr = "", stat = "";
    if (!blank) {
      const E = R.map((x) => x.e), live = E.filter((e) => !e.a), nCh = E.filter((e) => e.a === "ch").length;
      const F = live.filter((e) => e.i && e.i.full).map((e) => e.i), AG = live.map(GA).filter((g) => g != null), oth = live.filter((e) => e.o != null).length;
      const chala = live.filter((e) => e.i && e.i.any && !e.i.full).length, emp = live.filter((e) => e.i && !e.i.any).length, avg = AG.length ? r1(mean(AG)) : "—";
      const pc = Array.from({length: N}, (x, k) => { let p = 0, n = 0; live.forEach((e) => { const v = e.i && e.i.a[k]; if (v) { n++; if (v === "p") p++; } }); return n ? Math.round(p / n * 100) : null; });
      ftr = `<tr class="ft"><td colspan="3" class="n" style="text-align:right">«+» ulushi (sinf)</td><td class="gs">${live.length ? "100%" : "—"}</td>${pc.map((p, k) => `<td class="${gs(k)}">${p == null ? "—" : p + "%"}</td>`).join("")}<td class="gs">${F.length ? r1(mean(F.map((i) => i.d))) : "—"}</td><td>${F.length ? r1(mean(F.map((i) => i.u))) : "—"}</td><td class="gs">${avg}</td></tr>`;
      if (O.ch.st) {
        const b = [AG.filter((g) => g >= 8).length, AG.filter((g) => g >= 5 && g < 8).length, AG.filter((g) => g < 5).length], tot = Math.max(1, AG.length);
        const wk = pc.map((p, k) => [p, k]).filter((x) => x[0] != null).sort((a, b2) => a[0] - b2[0])[0];
        const cols = O.col === "bw" ? ["#333", "#888", "#ccc"] : ["#3aa76d", "#e7b43f", "#d9625a"];
        stat = `<div class="kc-st"><span>Keldi: <b>${live.length} / ${E.length - nCh}</b>${nCh ? ` (CH: ${nCh} — hisobga kirmaydi)` : ""}</span><span>Jurnalga yozildi: <b>${AG.length}</b>${oth ? ` (boshqa usulda: ${oth})` : ""}${chala ? ` · chala: <b>${chala}</b>` : ""}${emp ? ` · belgilanmagan: <b>${emp}</b>` : ""}</span><span>O'rtacha: <b>${avg}</b></span>
          <span><span class="kc-bar">${b.map((v, i) => `<i style="width:${v / tot * 100}%;background:${cols[i]}"></i>`).join("")}</span> 8–10: <b>${b[0]}</b> · 5–7: <b>${b[1]}</b> · 1–4: <b>${b[2]}</b></span>
          ${wk && wk[0] < 100 ? `<span>Eng ko'p «−»: <b>${code(wk[1])}</b> ${esc(low(ds[wk[1]]))} (${100 - wk[0]}%)</span>` : ""}</div>`;
      }
    }
    const fan = fanB ? "Fan: ________________" : esc(X.subj || "Fan: ________________");
    const sub = blank ? `${esc(c.name)} · ${fan} · ${bd ? `<b>${fmt(d)}</b>, ${WD_FULL[pyWd(d)].toLowerCase()}` : "Sana: «____» ______________ 202__-y."} · ____-dars` : `${esc(c.name)}${X.subj ? " · " + esc(X.subj) : ""} · <b>${fmt(d)}</b>, ${WD_FULL[pyWd(d)].toLowerCase()}`;
    return `<div class="${cls(P)}" style="--fs:${fs}px;--rh:${rh}px">${head("Formativ baholash varaqasi (kriterial)", sub)}${legend(blank ? (O.bk === "hand" ? null : ds) : ds, blank)}
      <table class="kc-t"><colgroup><col style="width:${P ? 22 : 26}px"><col style="width:${Math.round(fs * (P ? 14.5 : 17))}px"><col style="width:${Math.round(fs * 2.8)}px"><col style="width:${Math.round(fs * 3)}px">${"<col>".repeat(N)}<col style="width:${Math.round(fs * 3)}px"><col style="width:${Math.round(fs * 3)}px"><col style="width:${Math.round(fs * 3.6)}px"></colgroup>
      <thead><tr><th>№</th><th>O'quvchi</th><th>Dav.</th><th class="gs">D0<br>1 b</th>${Array.from({length: N}, (x, k) => `<th class="${gs(k)}">${code(k)}<br>1 b</th>`).join("")}<th class="gs">D<br>1–6</th><th>U<br>0–4</th><th class="gs">Baho</th></tr></thead>
      <tbody>${rows}${ftr}</tbody></table>${stat}
      <div class="kc-pf"><span>+ bajardi (1 ball) · − bajarmadi (0) · S — sababsiz · DQ — sababli · K — kasal · KQ — kech qoldi · CH — chet elda (Keldi hisobiga kirmaydi)${blank ? "" : " · * boshqa usulda qo'yilgan baho"}</span>${sign(fanB)}</div>
      ${pbot(`${esc(c.name)}${fanB || !X.subj ? "" : " · " + esc(X.subj)} · ${blank && !bd ? "bo'sh varaq" : fmt(d)}`, pi, pn)}</div>`;
  }

  // 2. chorak jamlanmasi (albomda bitta bet; tik varaqda darslar ko'p bo'lsa 2 bet: baholar / deskriptorlar)
  function qPage(Q, ds, fs, rh, part, pi, pn) {
    const {c, O} = X, shG = part !== "d", shD = part !== "g", P = O.ori === "p", L = Q.L;
    let R = Q.S.slice(); if (O.ord === "g") R.sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1) || a.si - b.si);
    const heat = (p) => p == null || O.col === "bw" ? "" : p >= 75 ? "g1" : p >= 50 ? "g2" : "g3";
    const lc = (x) => !shG ? "" : x.E.map((e, i) => {
      const f = i ? "" : "gs";
      if (!e) return `<td class="${f}"></td>`;
      if (e.a) return `<td class="dim ${f}">${esc(e.a.toUpperCase())}</td>`;
      if (e.o != null) return `<td class="${f} ${O.col === "bw" ? "" : gc(e.og)}">${esc(e.o)}*</td>`;
      return e.i.full ? `<td class="${f} ${O.col === "bw" ? "" : gc(e.i.g)}">${e.i.g}</td>` : `<td class="${f} ch">${e.i.any ? "·" : ""}</td>`;
    }).join("");
    const dc = (x) => !shD ? "" : x.pct.map((p, k) => `<td class="${k === 0 || k === ND ? "gs" : ""} ${heat(p)}">${p == null ? "—" : p}</td>`).join("");
    const rows = R.map((x) => `<tr><td>${x.si + 1}</td><td class="n">${esc(x.s.name)}</td>${lc(x)}<td class="gs g">${x.avg == null ? "—" : r1(x.avg)}</td><td class="sm">${x.all ? `${x.att}/${x.all}` : "—"}</td>${dc(x)}</tr>`).join("");
    const la = L.map((d, li) => { const g = Q.S.map((x) => GA(x.E[li])).filter((v) => v != null); return g.length ? r1(mean(g)) : "—"; });
    const all = Q.S.filter((x) => x.avg != null), ca = all.length ? r1(mean(all.map((x) => x.avg))) : "—";
    const dp = Array.from({length: N}, (x, k) => { const v = Q.S.map((y) => y.pct[k]).filter((p) => p != null); return v.length ? Math.round(mean(v)) : null; });
    const ftr = `<tr class="ft"><td colspan="2" class="n" style="text-align:right">Sinf o'rtachasi</td>${shG ? la.map((v, i) => `<td class="${i ? "" : "gs"}">${v}</td>`).join("") : ""}<td class="gs">${ca}</td><td></td>${shD ? dp.map((p, k) => `<td class="${k === 0 || k === ND ? "gs" : ""}">${p ?? "—"}</td>`).join("") : ""}</tr>`;
    const srt = dp.map((p, k) => [p, k]).filter((y) => y[0] != null).sort((a, b) => b[0] - a[0]), need = Q.S.filter((x) => x.need);
    const stat = O.ch.st && shD ? `<div class="kc-st"><span>Darslar: <b>${L.length}</b></span><span>Sinf o'rtachasi: <b>${ca}</b></span>${srt.length ? `<span>Eng yaxshi: <b>${code(srt[0][1])}</b> ${esc(low(ds[srt[0][1]]))} (${srt[0][0]}%)</span><span>Eng qiyin: <b>${code(srt[srt.length - 1][1])}</b> ${esc(low(ds[srt[srt.length - 1][1]]))} (${srt[srt.length - 1][0]}%)</span>` : ""}<span>E'tibor kerak: <b>${need.length}</b> o'quvchi${need.length ? ` (${need.map((x) => x.si + 1).join(", ")}-raqamlar)` : ""}</span></div>` : "";
    const leg = O.ch.leg && shD ? `<div class="kc-leg" style="grid-template-columns:1fr"><div><b>Deskriptorlar · ustunlarda o'quvchi «+» olgan ulush, %</b><div class="kc-cols" style="columns:${P ? 2 : 3}">${ds.map((t, k) => `<div><b>${code(k)}</b> ${esc(t)}</div>`).join("")}</div></div></div>` : "";
    const r = qRange(Q.q), sub = `${esc(c.name)}${X.subj ? " · " + esc(X.subj) : ""} · <b>${L.length ? `${fmt(L[0]).slice(0, 5)}–${fmt(L[L.length - 1])}` : `${fmt(r[0])}–${fmt(r[1])}`}</b> · ${L.length} dars${part !== "all" ? (shG ? " · darslar bo'yicha baho" : " · deskriptorlar bo'yicha") : ""}`;
    const hd1 = `${shG ? `<th colspan="${L.length}" class="gs">Darslar bo'yicha baho</th>` : ""}<th rowspan="2" class="gs">O'rt.</th><th rowspan="2">Keldi</th>${shD ? `<th colspan="5" class="gs">Darsdagi ish, %</th><th colspan="4" class="gs">Uy vazifasi, %</th>` : ""}`;
    const hd2 = `${shG ? L.map((d, i) => `<th class="${i ? "" : "gs"}">${d.slice(8, 10)}<br>${d.slice(5, 7)}</th>`).join("") : ""}${shD ? ds.map((t, k) => `<th class="${k === 0 || k === ND ? "gs" : ""}">${code(k)}</th>`).join("") : ""}`;
    return `<div class="${cls(P)}" style="--fs:${fs}px;--rh:${rh}px">${head(`Formativ baholash jamlanmasi (kriterial) · ${Q.q}-chorak`, sub)}${leg}
      <table class="kc-t"><colgroup><col style="width:${P ? 22 : 24}px"><col style="width:${Math.round(fs * (P && shD ? 20 : P ? 14 : 16))}px">${shG ? "<col>".repeat(L.length) : ""}<col style="width:${Math.round(fs * 3)}px"><col style="width:${Math.round(fs * 3.8)}px">${shD ? "<col>".repeat(N) : ""}</colgroup>
      <thead><tr><th rowspan="2">№</th><th rowspan="2">O'quvchi</th>${hd1}</tr><tr>${hd2}</tr></thead>
      <tbody>${rows}${ftr}</tbody></table>${stat}
      <div class="kc-pf"><span>${shG ? "Baho katagi: 8–10 · 5–7 · 1–4 · * boshqa usulda (o'rtachaga kiradi, % ga kirmaydi) · S / DQ / K — kelmagan · CH — chet elda (Keldi hisobiga kirmaydi) · «·» — chala, baho yo'q" : "Foiz: o'quvchi shu deskriptorda «+» olgan darslar ulushi · 75%+ · 50–74% · 50% dan past"}</span>${sign()}</div>
      ${pbot(`${esc(c.name)}${X.subj ? " · " + esc(X.subj) : ""} · ${Q.q}-chorak`, pi, pn)}</div>`;
  }

  // 3. o'quvchi kartalari (A4 tik, 2 ta karta, kesiladi)
  const pctOf = (a) => { const v = a.filter((p) => p != null); return v.length ? Math.round(mean(v)) + "%" : "—"; };
  function card(Q, x, ds) {
    const {c, O} = X, subj = X.subj ? low(X.subj) + " fanidan" : "fan bo'yicha";
    const strong = x.pct.map((p, k) => [p, k]).filter((y) => y[0] != null).sort((a, b) => b[0] - a[0]);
    // rang bilan bir xil chegara: ≥75% yashil = kuchli; <75% eng pastlari = e'tibor
    const top = strong.slice(0, 2).filter((y) => y[0] >= 75), lowS = strong.slice(-2).reverse().filter((y) => y[0] < 75 && !top.includes(y)), nod = !strong.length;
    const txt = !x.att && x.all ? `Hurmatli ota-ona! ${x.s.name} ${Q.q}-chorakda ${subj} o'tgan ${x.all} ta darsning birortasida qatnashmadi, shuning uchun baho yo'q. Iltimos, fan o'qituvchisi bilan bog'laning.`
      : `Hurmatli ota-ona! ${x.s.name} ${Q.q}-chorakda ${subj} ${x.all} ta darsning ${x.att} tasida qatnashdi${x.avg == null ? ", baho hali yo'q" : `, o'rtacha bahosi ${r1(x.avg)}`}.${top.length ? ` Yaxshi bajarayotgani: «${ds[top[0][1]]}».` : ""}${lowS.length ? ` Ko'proq e'tibor kerak: ${lowS.map((y) => `«${ds[y[1]]}»`).join(", ")}.` : nod ? "" : " Shu ruhda davom etsin!"}`;
    const strip = Q.L.map((d, li) => { const e = x.E[li], g = GA(e); const bg = O.col === "bw" || g == null ? "" : ` style="background:${GBG[gc(g)]}"`;
      return `<div${bg}>${!e ? "" : e.a ? `<span class="kc-ab">${esc(e.a.toUpperCase())}</span>` : g != null ? esc(e.o != null ? e.o + "*" : String(g)) : "·"}<small>${fmt(d).slice(0, 5)}</small></div>`; }).join("");
    const bar = (p) => p == null ? "#ccc" : p >= 75 ? "#3aa76d" : p >= 50 ? "#e0a92e" : "#d9625a";
    return `<div class="kc-cd"><div class="kc-cdh"><div><div class="kc-cdn">${esc(x.s.name)}</div><div class="kc-sub">${esc(c.name)}${X.subj ? " · " + esc(X.subj) : ""} · ${Q.q}-chorak · formativ baholash (kriterial)${x.why ? ` · <b class="kc-red">e'tibor: ${WHY[x.why]}</b>` : ""}</div></div>${O.ch.sch && HDR().school ? `<div class="kc-sub" style="text-align:right">${esc(HDR().school)}</div>` : ""}</div>
      <div class="kc-cdk"><div><span>O'rtacha baho</span><b>${x.avg == null ? "—" : r1(x.avg)}</b></div><div><span>Darsda qatnashdi</span><b>${x.all ? `${x.att} / ${x.all}` : "—"}</b></div><div><span>Darsdagi ish «+»</span><b>${pctOf(x.pct.slice(0, ND))}</b></div><div><span>Uy vazifasi «+»</span><b>${pctOf(x.pct.slice(ND))}</b></div></div>
      <div class="kc-cds">${strip}</div>
      <div class="kc-cdm">${ds.map((t, k) => `<div><em><b>${code(k)}</b> ${esc(t)}</em><i style="--w:${x.pct[k] ?? 0}%;--cb:${bar(x.pct[k])}"></i><b>${x.pct[k] == null ? "—" : x.pct[k] + "%"}</b></div>`).join("")}</div>
      <div class="kc-cdt"><div><b class="kc-grn">Kuchli tomonlari</b>${top.length ? top.map((y) => `${esc(ds[y[1]])} — ${y[0]}%`).join("<br>") : nod ? "Ma'lumot yo'q" : "Hali 75% ga yetgan deskriptor yo'q"}</div><div><b class="kc-red">E'tibor berish kerak</b>${lowS.length ? lowS.map((y) => `${esc(ds[y[1]])} — ${y[0]}%`).join("<br>") : nod ? "Ma'lumot yo'q" : "Hammasi 75% va undan yuqori"}</div></div>
      ${O.ch.pt ? `<div class="kc-cdp">${esc(txt)}</div>` : ""}
      ${O.ch.sg ? `<div class="kc-cdf"><span>O'qituvchi: ${teacher() ? `<b>${esc(teacher())}</b>` : "_______________"} &nbsp;Imzo: ________</span><span>Ota-ona imzosi: ______________</span></div>` : ""}</div>`;
  }
  function cardPages(Q, ds) {
    const S = X.O.cw === "att" ? Q.S.filter((x) => x.need) : Q.S.filter((x) => x.all || x.gs.length), P = [];
    for (let i = 0; i < S.length; i += 2) P.push(S.slice(i, i + 2));
    return P.map((p, i) => `<div class="${cls(true)} kc-cards" style="--fs:12px">${card(Q, p[0], ds)}${p[1] ? `<div class="kc-cut"></div>${card(Q, p[1], ds)}` : ""}
      ${pbot(`${esc(X.c.name)}${X.subj ? " · " + esc(X.subj) : ""} · ${Q.q}-chorak · o'quvchi kartalari`, i + 1, P.length)}</div>`);
  }

  // ── sig'dirish: shrift va qator balandligini varaqqa o'lchab moslash
  let meas = null;
  function fit(make) {
    if (!meas) { meas = document.createElement("div"); meas.className = "kc-meas"; meas.setAttribute("aria-hidden", "true"); }
    if (!meas.isConnected) document.body.append(meas);
    let fs = 15, rh = 32;
    for (let i = 0; i < 90; i++) {
      meas.innerHTML = make(+fs.toFixed(2), +rh.toFixed(2)); const pg = meas.firstElementChild;
      if (pg.scrollHeight <= pg.clientHeight + 1 || fs <= 7.5) break;
      if (rh > fs * 1.6) rh -= 0.8; else { fs -= 0.25; rh = Math.max(fs * 1.3, rh - 0.5); }
    }
    const h = meas.innerHTML; meas.innerHTML = ""; return h;
  }

  // ── bo'sh varaq sanalari: «Jadvaldan» — bugundan keyingi dars kunlari (bayram va darssiz kunlarsiz)
  function nextDates(c, n) {
    const t = todayIso(), hi = iso(addDays(pdate(t), 150)), hol = new Set([...holidaySet(+t.slice(0, 4)), ...holidaySet(+t.slice(0, 4) + 1)]);
    const set = new Set(c.dates.filter((x) => x >= t && x <= hi && !isNoLesson(c, x)));
    lessonDays(c, t, hi).forEach((x) => { if (!hol.has(x)) set.add(x); });
    return [...set].sort().slice(0, n);
  }
  // bo'sh varaq kriteriyalari: sinfdagi / fan shabloni / qo'lda; shu oynada tahrirlangani faqat shu varaqqa
  const bkBase = (c, O) => O.bk === "tpl" ? KRT.TPL[Math.min(O.tpl, KRT.TPL.length - 1)][1] : KRT.descs(c);
  const bkList = (c, O, E) => O.bk === "hand" ? null : bkBase(c, O).map((t, k) => ((E[O.bk === "tpl" ? "t" + O.tpl : "cls"] || {})[k] ?? t));

  function pages(c, d, O, E) {
    X.c = c; X.O = O; X.subj = c.subject || "";
    const cap = (fs) => O.ori === "p" ? Math.min(fs, 13) : fs, ds = KRT.descs(c);
    if (O.doc === "day") return [fit((fs, rh) => dayPage(d, false, 0, ds, cap(fs), rh, 1, 1))];
    if (O.doc === "blank") {
      const dl = O.bd && O.bf ? nextDates(c, O.bn) : [], ks = bkList(c, O, E), out = [];
      for (let i = 0; i < O.bn; i++) out.push(fit((fs, rh) => dayPage(dl[i] || d, true, !!dl[i], ks, cap(fs), rh, i + 1, O.bn)));
      return out;
    }
    const Q = qStat(c, O.q);
    if (O.doc === "q") {
      if (!Q.L.length) return [];
      return O.ori === "p" && Q.L.length > 8 ? [fit((fs, rh) => qPage(Q, ds, Math.min(fs, 12), rh, "g", 1, 2)), fit((fs, rh) => qPage(Q, ds, Math.min(fs, 13), rh, "d", 2, 2))]
        : [fit((fs, rh) => qPage(Q, ds, Math.min(fs, 12), rh, "all", 1, 1))];
    }
    return Q.L.length ? cardPages(Q, ds) : [];
  }
  function caption(c, d, O) {
    const sj = c.subject ? " · " + c.subject : "";
    if (O.doc === "day") {
      const E = KRT.rowsOf(c, d).map((si) => ent(c, c.students[si], d)), live = E.filter((e) => !e.a), AG = live.map(GA).filter((g) => g != null);
      return `📄 Formativ baholash varaqasi (kriterial)\n${c.name}${sj} · ${fmt(d)}\nKeldi: ${live.length}/${E.length - E.filter((e) => e.a === "ch").length} · o'rtacha ${AG.length ? r1(mean(AG)) : "—"}\n8–10: ${AG.filter((g) => g >= 8).length} · 5–7: ${AG.filter((g) => g >= 5 && g < 8).length} · 1–4: ${AG.filter((g) => g < 5).length}`;
    }
    if (O.doc === "blank") return `📄 Bo'sh kriterial varaq · ${O.bn} dars\n${c.name}${O.bf ? sj : ""}${O.bk === "tpl" ? "\nKriteriyalar: " + KRT.TPL[O.tpl][0] : O.bk === "hand" ? "\nKriteriyalar qo'lda yoziladi" : ""}`;
    const Q = qStat(c, O.q), a = Q.S.filter((x) => x.avg != null), need = Q.S.filter((x) => x.need).length;
    if (O.doc === "q") return `📊 Formativ baholash jamlanmasi · ${O.q}-chorak\n${c.name}${sj} · ${Q.L.length} dars\nSinf o'rtachasi: ${a.length ? r1(mean(a.map((x) => x.avg))) : "—"} · e'tibor kerak: ${need} o'quvchi`;
    return `🧾 O'quvchi kartalari · ${O.q}-chorak\n${c.name}${sj} · ${O.cw === "att" ? need + " ta (e'tibor kerak)" : Q.S.length + " ta"}`;
  }
  const fileOf = (c, d, O) => (`Kriterial_${({day: "varaq", blank: "bosh_varaq", q: "chorak", card: "kartalar"})[O.doc]}_${label(c)}_${O.doc === "q" || O.doc === "card" ? O.q + "-chorak" : d}`).replace(/[^\p{L}\p{N}_'ʻʼ‘’-]+/gu, "_");

  function doPrint(html, land, name) {
    let el = document.getElementById("pdoc"); if (!el) { el = document.createElement("div"); el.id = "pdoc"; document.body.append(el); }
    el.className = "bx-print"; el.innerHTML = html.join(""); document.body.classList.add("pdoc");
    let st2 = document.getElementById("pdoc-css"); if (!st2) { st2 = document.createElement("style"); st2.id = "pdoc-css"; document.head.append(st2); }
    st2.textContent = `@media print{@page{size:A4 ${land ? "landscape" : "portrait"};margin:0}}`;
    const old = document.title, back = () => { document.title = old; window.removeEventListener("afterprint", back); el.className = ""; };
    document.title = name; window.addEventListener("afterprint", back); setTimeout(() => { document.title = old; }, 120000);
    window.print();
  }

  // ── oyna
  function dialog(c, d) {
    const O = load(), E = {}, qs = [1, 2, 3, 4].filter((q) => qRange(q));
    O.q = qs.includes(quarterOf(d)) ? quarterOf(d) : qs[qs.length - 1] || 1;
    if (!c.subject) O.bf = 0;
    if (O.tpl >= KRT.TPL.length) O.tpl = 0;
    let capDirty = false, tab = "set", z = "fit", P = [];
    const seg = (attr, opts, cur) => `<div class="mz-seg kc-seg" role="group">${opts.map(([v, t]) => `<button type="button" class="${String(v) === String(cur) ? "on" : ""}" data-${attr}="${v}">${t}</button>`).join("")}</div>`;
    const DOCS = [["day", "Dars varaqasi", "Bitta dars: + / − va baholar"], ["blank", "Bo'sh varaq", "Darsda qo'lda belgilash uchun"], ["q", "Chorak jamlanmasi", "Barcha darslar baholari va deskriptor %"], ["card", "O'quvchi kartalari", "Ota-onaga: har o'quvchiga yarim varaq"]];
    const CH = [["leg", "Kriteriyalar izohi", "day blank q"], ["st", "Sinf xulosasi", "day q"], ["sch", "Maktab nomi", ""], ["sg", "Imzo qatori", ""], ["pt", "Ota-onaga matn", "card"]];
    modal(`<div class="kc-dlg" data-tab="set">
      <div class="kc-hd"><h2>Chop etish va PDF <small>· ${esc(label(c))}</small></h2><button type="button" class="btn-close" data-x aria-label="Yopish"></button></div>
      <div class="kc-tabs">${seg("kct", [["set", "Sozlash"], ["pv", "Ko'rish <span class=\"kc-tabn\"></span>"]], "set")}</div>
      <div class="kc-body"><div class="kc-side"><div class="kc-opt">
        <div class="kc-sec"><span class="kc-lb">Hujjat</span><div class="kc-docs">${DOCS.map(([v, t, s]) => `<button type="button" class="kc-doc ${v === O.doc ? "on" : ""}" data-kcd="${v}"><b>${t}</b><span>${s}</span></button>`).join("")}</div></div>
        <div class="kc-sec" data-for="blank"><span class="kc-lb">Necha dars uchun</span>
          <div class="kc-row"><div class="kc-step"><button type="button" data-kcbn="-1" aria-label="Kamaytirish">−</button><span class="kc-bn">${O.bn}</span><button type="button" data-kcbn="1" aria-label="Ko'paytirish">+</button></div>${seg("kcbd", [[0, "Sana qo'lda"], [1, "Jadvaldan"]], O.bd)}</div>
          <p class="kc-hint">Har dars alohida bet. «Jadvaldan» — keyingi darslar sanasi o'zi yoziladi.</p></div>
        <div class="kc-sec" data-for="blank"><span class="kc-lb">Fan nomi</span>${seg("kcbf", c.subject ? [[1, esc(c.subject)], [0, "Bo'sh (qo'lda)"]] : [[0, "Bo'sh (qo'lda)"]], O.bf)}
          <p class="kc-hint">${c.subject ? "«Bo'sh» — varaqda «Fan: ________» qoladi, istalgan fanga ishlatiladi." : "Sinfda fan nomi yo'q — varaqda «Fan: ________» qoladi."}</p></div>
        <div class="kc-sec" data-for="blank"><span class="kc-lb">Baholash kriteriyalari</span>${seg("kcbk", [["cls", "Sinfdagi"], ["tpl", "Fan shabloni"], ["hand", "Qo'lda"]], O.bk)}
          <select class="form-select kc-tpl" aria-label="Fan shabloni">${KRT.TPL.map((t, i) => `<option value="${i}" ${i === O.tpl ? "selected" : ""}>${esc(t[0])}</option>`).join("")}</select>
          <div class="kc-ed"></div><p class="kc-hint kc-warn" hidden></p><p class="kc-hint kc-bkh"></p></div>
        <div class="kc-sec" data-for="q card"><span class="kc-lb">Chorak</span>${seg("kcq", qs.map((q) => [q, q + "-chorak"]), O.q)}</div>
        <div class="kc-sec" data-for="card"><span class="kc-lb">Kimlar uchun</span>${seg("kccw", [["all", "Hammasi"], ["att", "E'tibor kerak"]], O.cw)}<p class="kc-hint kc-cwh"></p></div>
        <div class="kc-sec"><span class="kc-lb">Ko'rinish</span><div class="kc-row">${seg("kccol", [["c", "Rangli"], ["bw", "Oq-qora"]], O.col)}<span data-for="day blank q">${seg("kcori", [["l", "Albom"], ["p", "Tik"]], O.ori)}</span><span data-for="day q">${seg("kcord", [["l", "Ro'yxat"], ["g", "Baho ↓"]], O.ord)}</span></div></div>
        <div class="kc-sec"><span class="kc-lb">Varaqda</span><div class="kc-chips">${CH.map(([k, t, f]) => `<button type="button" class="kc-chip ${O.ch[k] ? "on" : ""}" data-kcch="${k}" ${f ? `data-for="${f}"` : ""}>${t}</button>`).join("")}</div>${HDR().school ? "" : `<p class="kc-hint">Maktab nomi BSB eksport sozlamalaridan olinadi (hozir bo'sh).</p>`}</div>
        <div class="kc-sec"><label class="kc-lb" for="kc-t">O'qituvchi (imzo qatorida)</label><input type="text" class="form-control" id="kc-t" maxlength="60" value="${esc(O.t != null ? O.t : HDR().teacher || "")}" placeholder="Familiya I."></div>
        <div class="kc-sec"><label class="kc-lb" for="kc-cap">Telegram izohi</label><textarea class="form-control kc-cap" id="kc-cap" rows="4"></textarea><p class="kc-hint">PDF bilan birga boradi. Xulosa o'zi yoziladi, xohlasangiz o'zgartiring.</p></div>
      </div><div class="kc-foot"><button class="btn" type="button" data-kctg>✈️ Telegram'ga (PDF)</button><button class="btn btn-primary" type="button" data-kcpr>🖨 Chop etish</button></div></div>
      <div class="kc-prev"><div class="kc-prevh"><span class="kc-pinfo"></span>${seg("kcz", [["fit", "Sig'dirish"], ["100", "100%"]], "fit")}</div><div class="kc-pages"></div></div></div></div>`,
    (m, close) => {
      const $m = (s) => m.querySelector(s), $$m = (s) => [...m.querySelectorAll(s)], dlg = $m(".kc-dlg");
      const sel = (attr, v) => $$m(`[data-${attr}]`).forEach((b) => b.classList.toggle("on", b.dataset[attr.replace(/-./g, (x) => x[1].toUpperCase())] === String(v)));
      function drawEd() {
        $m(".kc-tpl").hidden = O.bk !== "tpl"; $m(".kc-ed").hidden = O.bk === "hand";
        const ds = bkList(c, O, E);
        if (ds) $m(".kc-ed").innerHTML = ds.map((t, k) => `${k === 0 ? `<span class="kc-gh">Darsdagi ish (D0 — qatnashdi, 1 ball)</span>` : k === ND ? `<span class="kc-gh">Uy vazifasi</span>` : ""}<b>${code(k)}</b><input type="text" class="form-control form-control-sm" data-kce="${k}" value="${esc(t)}" maxlength="60" aria-label="${code(k)} kriteriya">`).join("");
        const mis = O.bk === "tpl" && O.bf && c.subject && KRT.TPL[O.tpl][0] !== c.subject, mis2 = !O.bf && O.bk === "cls" && c.subject;
        const w = $m(".kc-warn"); w.hidden = !mis && !mis2;
        if (mis2) w.innerHTML = `Fan bo'sh, lekin kriteriyalar «${esc(c.subject)}» sinfiniki. Boshqa fan uchun <button type="button" class="kc-lnk" data-kcbk="tpl">fan shabloni</button> yoki <button type="button" class="kc-lnk" data-kcbk="hand">qo'lda</button> ni tanlang.`;
        if (mis) w.innerHTML = `«${esc(KRT.TPL[O.tpl][0])}» shabloni sinf fani («${esc(c.subject)}») bilan mos emas. <button type="button" class="kc-lnk" data-kcbf="0">Fan nomini bo'sh qoldirish</button>`;
        $$m("[data-kcbd='1']").forEach((b) => { b.disabled = !O.bf; b.title = O.bf ? "" : "Fan bo'sh — sana qo'lda yoziladi"; });
        $m(".kc-bkh").textContent = O.bk === "hand" ? "Varaqda D1–U4 yonida bo'sh chiziq qoladi, kriteriyani ruchka bilan yozasiz." : "Bu yerda o'zgartirilgan matn faqat shu varaqqa chiqadi. Sinfdagi kriteriyalar o'zgarmaydi.";
      }
      function draw() {
        keep(O); P = pages(c, d, O, E);
        const host = $m(".kc-pages"), land = O.doc !== "card" && O.ori !== "p", W = land ? 1123 : 794, H = land ? 791 : 1120;
        const avail = Math.max(200, host.clientWidth - 28), k = z === "fit" ? Math.min(1, avail / W) : 1;
        host.classList.toggle("z100", z !== "fit");
        $m("[data-kctg]").disabled = $m("[data-kcpr]").disabled = !P.length;
        const Q = O.doc === "q" || O.doc === "card" ? qStat(c, O.q) : null;
        host.innerHTML = P.length ? P.map((h, i) => `<div><div class="kc-pw" style="width:${W * k}px;height:${H * k}px">${h.replace('style="', `style="transform:scale(${k});`)}</div>${P.length > 1 ? `<div class="kc-pno">${i + 1}-bet</div>` : ""}</div>`).join("")
          : `<div class="kc-empty">${Q && !Q.L.length ? `${O.q}-chorakda kriterial (+/−) usulida baholangan dars hali yo'q.` : "Bu chorakda e'tibor kerak bo'lgan o'quvchi yo'q. «Hammasi»ni tanlang."}</div>`;
        const nm = DOCS.find((x) => x[0] === O.doc)[1];
        $m(".kc-pinfo").textContent = `${nm} · A4 ${land ? "albom" : "tik"} · ${P.length} bet`;
        $m(".kc-tabn").textContent = `· ${P.length} bet`;
        if (!capDirty) $m(".kc-cap").value = caption(c, d, O);
        if (Q) { const n = Q.S.filter((x) => x.need).length, all = Q.S.filter((x) => x.all || x.gs.length).length; $m(".kc-cwh").textContent = O.cw === "att" ? `${n} o'quvchi: darsga umuman kelmagan, o'rtacha 6 dan past (kamida 3 baho bo'lsa) yoki chorak oxirida pasaygan.` : `${all} o'quvchi → ${Math.ceil(all / 2)} bet (A4 da 2 tadan, kesib beriladi).`; }
        $$m("[data-for]").forEach((e) => { e.hidden = !e.dataset.for.split(" ").includes(O.doc); });
      }
      const redraw = () => requestAnimationFrame(draw);
      m.addEventListener("click", (ev) => {
        const b = ev.target.closest("button"); if (!b || !m.contains(b) || b.disabled) return; const s = b.dataset;
        if ("x" in s) return close();
        if (s.kct) { tab = s.kct; dlg.dataset.tab = tab; sel("kct", tab); return redraw(); }
        if (s.kcd) { O.doc = s.kcd; $$m("[data-kcd]").forEach((x) => x.classList.toggle("on", x === b)); capDirty = false; }
        else if (s.kcbn) { O.bn = Math.max(1, Math.min(5, O.bn + +s.kcbn)); $m(".kc-bn").textContent = O.bn; capDirty = false; }
        else if (s.kcbd) { if (+s.kcbd && !O.bf) return toast("Fan bo'sh: dars jadvali fanga bog'liq, sana qo'lda yoziladi"); O.bd = +s.kcbd; sel("kcbd", O.bd); }
        else if (s.kcbf) { O.bf = +s.kcbf; sel("kcbf", O.bf); if (!O.bf) { O.bd = 0; sel("kcbd", 0); } capDirty = false; drawEd(); }
        else if (s.kcbk) { O.bk = s.kcbk; sel("kcbk", O.bk); capDirty = false; drawEd(); }
        else if (s.kcq) { O.q = +s.kcq; sel("kcq", O.q); capDirty = false; }
        else if (s.kccw) { O.cw = s.kccw; sel("kccw", O.cw); capDirty = false; }
        else if (s.kccol) { O.col = s.kccol; sel("kccol", O.col); }
        else if (s.kcori) { O.ori = s.kcori; sel("kcori", O.ori); }
        else if (s.kcord) { O.ord = s.kcord; sel("kcord", O.ord); }
        else if (s.kcch) { O.ch[s.kcch] = O.ch[s.kcch] ? 0 : 1; b.classList.toggle("on", !!O.ch[s.kcch]); }
        else if (s.kcz) { z = s.kcz; sel("kcz", z); }
        else if ("kcpr" in s) { if (P.length) doPrint(P, O.doc !== "card" && O.ori !== "p", fileOf(c, d, O)); return; }
        else if ("kctg" in s) { if (P.length) { const pg = P.slice(), land = O.doc !== "card" && O.ori !== "p"; PTG.run(() => PTG.pagesPdf(pg, land), fileOf(c, d, O), $m(".kc-cap").value, b); } return; }
        else return;
        draw();
      });
      $m(".kc-tpl").onchange = (e) => { O.tpl = +e.target.value; capDirty = false; drawEd(); draw(); };
      let edT; $m(".kc-ed").addEventListener("input", (e) => { const k = e.target.dataset.kce; if (k == null) return; const key = O.bk === "tpl" ? "t" + O.tpl : "cls"; (E[key] = E[key] || {})[+k] = e.target.value; clearTimeout(edT); edT = setTimeout(draw, 250); });
      let tT; $m("#kc-t").addEventListener("input", (e) => { O.t = e.target.value.trim(); clearTimeout(tT); tT = setTimeout(draw, 250); });
      $m(".kc-cap").addEventListener("input", () => { capDirty = true; });
      let rz; const onRz = () => { if (!m.isConnected) { window.removeEventListener("resize", onRz); return; } clearTimeout(rz); rz = setTimeout(draw, 150); };
      window.addEventListener("resize", onRz);
      drawEd(); requestAnimationFrame(() => requestAnimationFrame(draw));
    }).then(() => { if (meas) meas.remove(); });
  }
  return {dialog, qStat, pages, caption, nextDates};
})();
