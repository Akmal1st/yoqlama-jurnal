/* Moslashuvchan baholash — tasdiqlangan maket v5 (Akmal, 2026-11-15): asosiy ko'rinish «A · Ro'yxat», qo'shimcha «D · Bitta o'quvchi».
   Bitta rejim, uchta kiritish usuli: Tez 1–10 / 6 + 4 (darsdagi ish 1–6 + uy vazifasi 0–4) / +/− deskriptor (1 + 5 D + 4 U).
   Usul dars turidan olinadi (Yangi mavzu → 6 + 4, Mustahkamlash → +/−, Takrorlash → 1–10 + 2 baho …), har baho o'z usulida qoladi.
   Ma'lumot (eski baholar o'zgarmaydi):
     s.marks[sana] = "8" yoki "8/9" — yagona haqiqat (hisobotlar, FB, chorak bahosi shu bilan ishlaydi);
     1-baho qismlari: s.fp[sana] = [d, u] (6 + 4), s.fk[sana] = "++-+.+-++" (+/−) — mezon.js / kriterial.js bilan bir xil;
     2-baho qismlari: s.f2[sana] = ["b", d, u] yoki ["p", "++-+…"];
     dars turi: c.lt[sana] = {t: "must", two?: true|false}; o'qituvchining turlari: D.web.ltypes; fan deskriptorlari: D.web.kdf["f:fan"].
   Asosiy skriptdan oldin ulanadi; ichidagi funksiyalar faqat chaqirilganda index.html dagi umumiy funksiyalardan foydalanadi. */
const BHL = (() => {
  const N = 9, ND = 5;
  const METH = {tez: {n: "Tez 1–10", s: "1–10"}, ball: {n: "6 + 4", s: "6+4"}, pm: {n: "+/− deskriptor", s: "+/−"}};
  const DEF_T = [{id: "yangi", n: "Yangi mavzu", m: "ball", two: false}, {id: "must", n: "Mustahkamlash", m: "pm", two: false}, {id: "amal", n: "Amaliy ish", m: "pm", two: false},
    {id: "takr", n: "Takrorlash", m: "tez", two: true}, {id: "ogz", n: "Og'zaki so'rov", m: "tez", two: false}];
  const ABS = ["s", "dq", "k", "ch", "ox"];
  const st = {v: "list", flt: "all", sh: null, seq: false, iz: false, key: "", tmp: null};
  const absent = (mk) => ABS.includes(attPart(mk || ""));
  const narrow = () => typeof matchMedia === "function" && matchMedia("(max-width: 700px)").matches;
  const wide = () => typeof matchMedia === "function" && matchMedia("(min-width: 1000px)").matches;
  const code = (k) => k < ND ? `D${k + 1}` : `U${k - ND + 1}`;
  const gst = (g) => { const col = gradeColor(g) || "#e0e0e0"; return `background:${col};color:${contrast(col.startsWith("#") ? col : "#ffffff")}`; };
  const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);

  /* ── dars turlari ── */
  const types = () => D.web && Array.isArray(D.web.ltypes) && D.web.ltypes.length ? D.web.ltypes : DEF_T;
  // dars turi: shu darsniki → oldingi darsniki → eski rejim (Oddiy → Og'zaki so'rov, Kriterial → Mustahkamlash, Mezon → Yangi mavzu)
  function ltOf(c, d) {
    const T = types(), find = (id) => T.find((t) => t.id === id), o = c.lt && own(c.lt, d) ? c.lt[d] : null;
    let t = o && find(o.t);
    if (!t && c.lt) { const p = Object.keys(c.lt).filter((x) => x < d && find(c.lt[x].t)).sort().pop(); if (p) t = find(c.lt[p].t); }
    if (!t) { const fm = (D.web || {}).fmode; t = find(fm === "plain" ? "ogz" : fm === "krit" ? "must" : "yangi") || T[0]; }
    return {t, two: o && typeof o.two === "boolean" ? o.two : t.two};
  }
  function setLt(c, d, v) { c.lt = c.lt || {}; c.lt[d] = v; save(); }

  /* ── fan deskriptorlari ── */
  const FAN = [[/algebra|geometr|matem/i, "Matematika"], [/ona tili|adabiyot|o.qish/i, "Ona tili va adabiyot"], [/ingliz|english|nemis|fransuz/i, "Ingliz tili"], [/rus/i, "Rus tili"],
    [/fizika|astronom/i, "Fizika"], [/kimyo/i, "Kimyo"], [/biolog/i, "Biologiya"], [/tabiiy/i, "Tabiiy fanlar"], [/geograf/i, "Geografiya"], [/tarix|huquq|tarbiya fani/i, "Tarix"],
    [/informat/i, "Informatika"], [/texnolog|mehnat/i, "Texnologiya"], [/tasviriy|musiqa/i, "Tasviriy san'at va musiqa"], [/jismoniy|sport/i, "Jismoniy tarbiya"]];
  const tplName = (subj) => (FAN.find(([r]) => r.test(String(subj || ""))) || [0, ""])[1];
  const tplOf = (subj) => { const n = tplName(subj), t = n && KRT.TPL.find((x) => x[0] === n); return t ? t[1] : KRT.DEF; };
  const fanKey = (c) => { const f = String(c.subject || "").trim().toLowerCase(); return f ? "f:" + f.slice(0, 58) : ""; };
  // KRT.descs shu yerdan oladi: sinfniki → fanniki (hamma sinflar) → fan shabloni → umumiy namuna
  function descs(c) {
    if (Array.isArray(c.kd) && c.kd.length === N) return c.kd;
    const k = fanKey(c), f = D.web && D.web.kdf;
    if (k && own(f, k)) return f[k];
    return tplOf(c.subject);
  }

  /* ── baho «slot»lari: 0 — 1-baho, 1 — 2-baho ── */
  const blank = (m) => m === "tez" ? {m, v: null} : m === "ball" ? {m, d: null, u: null} : {m, k: Array(N).fill(null)};
  function gradeOf(x) { if (!x) return null; if (x.m === "tez") return x.v ?? null; if (x.m === "ball") return x.d != null && x.u != null ? x.d + x.u : null; return x.k.every(Boolean) ? 1 + x.k.filter((v) => v === "p").length : null; }
  function partOf(x) {
    if (!x || gradeOf(x) != null) return null;
    if (x.m === "ball" && (x.d != null || x.u != null)) return (x.d || 0) + (x.u || 0);
    if (x.m === "pm" && x.k.some(Boolean)) return 1 + x.k.filter((v) => v === "p").length;
    return null;
  }
  const isSet = (x) => !!x && (gradeOf(x) != null || partOf(x) != null);
  const pmStr = (k) => k.map((v) => v === "p" ? "+" : v === "m" ? "-" : ".").join("");
  const pmArr = (t) => [...t].map((ch) => ch === "+" ? "p" : ch === "-" ? "m" : null);
  const pmDU = (k) => { let d = 1, u = 0; k.forEach((v, i) => { if (v === "p") { if (i < ND) d++; else u++; } }); return [d, u]; };
  // 2-baho qismlari faqat jurnaldagi 2-baho bilan mos kelsa ishlatiladi (baho boshqa joyda o'zgartirilgan bo'lsa — e'tiborsiz)
  function slot2(s, d) {
    const gs = gradesOf(s.marks[d] || ""), f = s.f2 && own(s.f2, d) ? s.f2[d] : null;
    if (f) {
      const x = f[0] === "p" ? {m: "pm", k: pmArr(f[1])} : {m: "ball", d: f[1], u: f[2]}, g = gradeOf(x);
      if (g != null ? gs.length >= 2 && gs[1] === g : gs.length === 1) return x;
    }
    return gs.length >= 2 ? {m: "tez", v: gs[1]} : null;
  }
  function slotOf(s, d, i) {
    if (i) return slot2(s, d);
    const a = KRT.marks(s, d); if (a.some(Boolean)) return {m: "pm", k: a};
    const p = MZN.parts(s, d); if (p[0] != null || p[1] != null) return {m: "ball", d: p[0], u: p[1]};
    const gs = gradesOf(s.marks[d] || ""); return gs.length ? {m: "tez", v: gs[0]} : null;
  }
  const twoOn = (c, d, s) => ltOf(c, d).two || !!slot2(s, d);

  // bitta slotni yozish: jurnal belgisi (putMark — qulf, arxiv, ↶) + qismlar; q — bir nechtasini bitta ↶ qilib yig'ish uchun
  function write(c, si, d, slot, x, q) {
    const s = c.students[si], old = s.marks[d] || "";
    if (!canEdit(d)) { putMark(c, si, d, old); return false; }   // sababini toast bilan aytadi
    if (absent(old) || preJoin(c, s, d)) return false;
    const late = lateOf(old), gs = gradesOf(old);
    let sl = [slotOf(s, d, 0), slotOf(s, d, 1)], sw = false;
    sl[slot] = isSet(x) ? x : null;
    if (!sl[0] && sl[1]) { sl = [sl[1], null]; sw = true; }
    else if (gradeOf(sl[0]) == null && gradeOf(sl[1]) != null) { sl = [sl[1], sl[0]]; sw = true; }
    if (gradeOf(sl[0]) == null) sl[1] = null;
    const ngs = sl.map(gradeOf).filter((v) => v != null).concat(gs.slice(2));
    const nw = ngs.length ? buildMark(ngs, late) : late ? "kq" : "";
    const pk = (s.fk && own(s.fk, d) && s.fk[d]) || null, pp = (s.fp && own(s.fp, d) && s.fp[d]) || null, p2 = (s.f2 && own(s.f2, d) && s.f2[d]) || null;
    const set = (f, v) => { if (v) (s[f] = s[f] || {})[d] = v; else if (s[f]) { delete s[f][d]; if (!Object.keys(s[f]).length) delete s[f]; } };
    const [a, b] = sl;
    set("fk", a && a.m === "pm" ? pmStr(a.k) : null);
    set("fp", a && a.m === "ball" ? [a.d, a.u] : a && a.m === "pm" && gradeOf(a) != null ? pmDU(a.k) : null);
    set("f2", b && b.m === "pm" ? ["p", pmStr(b.k)] : b && b.m === "ball" ? ["b", b.d, b.u] : null);
    if (nw !== old) {
      if (!putMark(c, si, d, nw, q ? true : undefined)) { set("fk", pk); set("fp", pp); set("f2", p2); return false; }
      const kx = [pk, pp, p2];   // ↶ qismlarni ham qaytaradi (index.html → undoLast)
      if (q) q.push({kind: "mark", c, s, key: d, old, nw, kx});
      else { const u = UNDO[UNDO.length - 1]; if (u && u.length === 1 && u[0].kind === "mark" && u[0].s === s && u[0].key === d) u[0].kx = kx; }
    } else save();
    return sw ? "sw" : true;
  }
  // yo'qlama: "" — keldi; darsda yo'q bo'lsa baho va qismlar olib tashlanadi (↶ qaytaradi)
  function setAtt(c, si, d, v) {
    const s = c.students[si], old = s.marks[d] || "", gs = gradesOf(old);
    const nw = v === "" ? (absent(old) ? "" : buildMark(gs, false)) : v === "kq" ? (absent(old) ? "kq" : buildMark(gs, !lateOf(old))) : attPart(old) === v ? "" : v;
    if (nw === old) return true;
    const kx = [(s.fk && s.fk[d]) || null, (s.fp && s.fp[d]) || null, (s.f2 && s.f2[d]) || null];
    if (!putMark(c, si, d, nw)) return false;
    if (absent(nw)) {
      for (const f of ["fk", "fp", "f2"]) if (s[f] && own(s[f], d)) { delete s[f][d]; if (!Object.keys(s[f]).length) delete s[f]; }
      const u = UNDO[UNDO.length - 1]; if (u && u.length === 1 && u[0].s === s && u[0].key === d) u[0].kx = kx;
      save();
    }
    return true;
  }

  /* ── ko'rinish ── */
  const rowsOf = (c, d, order) => order.filter((si) => c.students[si] && !preJoin(c, c.students[si], d));
  const qCount = (c, s, d) => { const q = quarterOf(d), r = q && qRange(q); return r ? formativeGrades(c, s, r).length : null; };
  const ATT_L = {"": "✓", s: "S", dq: "DQ", k: "K", kq: "KQ", ch: "CH", ox: "OX"};
  const attKey = (mk) => { const a = attPart(mk || ""); return a === "kq" || lateOf(mk) ? "kq" : a; };
  const attName = (k) => k === "" ? "Keldi" : ((DAY_ATT.find((x) => x[0] === k) || [0, k.toUpperCase()])[1]).split(" (")[0];
  function info(c, d, si) {
    const s = c.students[si], mk = s.marks[d] || "", ab = absent(mk), x0 = ab ? null : slotOf(s, d, 0), x1 = ab ? null : slotOf(s, d, 1);
    return {s, mk, ab, x: [x0, x1], g: [gradeOf(x0), gradeOf(x1)], p: [partOf(x0), partOf(x1)], two: !ab && (ltOf(c, d).two || !!x1)};
  }
  const needs = (I) => !I.ab && (I.g[0] == null || (I.two && I.g[1] == null));
  function counts(c, d, R) {
    const k = fbMin(), o = {all: R.length, none: 0, part: 0, abs: 0, low: 0, sum: 0, n: 0};
    for (const si of R) {
      const I = info(c, d, si), q = qCount(c, I.s, d);
      if (!I.ab && I.g[0] == null && I.p[0] == null) o.none++;
      if (I.p[0] != null || I.p[1] != null) o.part++;
      if (I.ab || lateOf(I.mk)) o.abs++;
      if (attPart(I.mk) !== "ch" && q != null && q < k) o.low++;
      for (const g of I.g) if (g != null) { o.sum += g; o.n++; }
    }
    return o;
  }
  function pass(c, d, si) {
    const I = info(c, d, si), f = st.flt, q = qCount(c, I.s, d);
    return f === "none" ? !I.ab && I.g[0] == null && I.p[0] == null : f === "part" ? I.p[0] != null || I.p[1] != null
      : f === "abs" ? I.ab || lateOf(I.mk) : f === "low" ? attPart(I.mk) !== "ch" && q != null && q < fbMin() : true;
  }
  function cell(I, si, slot, ed) {
    const x = I.x[slot], g = I.g[slot], p = I.p[slot], nm = esc(I.s.name), dis = ed && (slot === 0 || I.g[0] != null) ? "" : "disabled";
    if (g != null) return `<button type="button" class="bh-gc f" style="${gst(g)}" data-bhg="${si}|${slot}" ${dis} aria-label="${nm}: ${slot + 1}-baho ${g}"><b>${g}</b><small>${x.m === "ball" ? x.d + "+" + x.u : METH[x.m].s}</small></button>`;
    if (p != null) return `<button type="button" class="bh-gc pt" data-bhg="${si}|${slot}" ${dis} aria-label="${nm}: ${slot + 1}-baho chala"><b>${p}…</b><small>chala</small></button>`;
    return `<button type="button" class="bh-gc e" data-bhg="${si}|${slot}" ${dis} aria-label="${nm}: ${slot + 1}-bahoni qo'yish"><b>${slot ? "+" : "—"}</b><small>${slot ? "2-baho" : ""}</small></button>`;
  }
  function brk(x) {
    if (!x) return "";
    if (x.m === "pm" && x.k.some(Boolean)) return `<span class="bh-bk" aria-hidden="true">${x.k.map((v, k) => `${k === ND ? "<i></i>" : ""}<u class="${v || ""}"></u>`).join("")}</span>`;
    if (x.m === "ball" && (x.d != null || x.u != null)) return `<span>Darsda ${x.d ?? "?"} · Uy ${x.u ?? "?"}</span>`;
    return "";
  }
  function rowH(c, d, si, ctx) {
    const I = info(c, d, si), s = I.s, n = qCount(c, s, d), k = fbMin(), ak = attKey(I.mk), cur = st.sh && st.sh.si === si;
    const sub = [n == null ? "" : n < k && ak !== "ch" ? `<span class="lo">chorakda ${n} ta baho</span>` : `<span>chorakda ${n} ta</span>`, brk(I.x[0]), s.fc && s.fc[d] ? "💬 izoh" : ""].filter(Boolean).join(" · ");
    const g = I.ab ? `<span class="bh-gc no-g"><b>—</b></span>` : [0, 1].slice(0, I.two ? 2 : 1).map((sl) => cell(I, si, sl, ctx.ed)).join("");
    return `<div class="bh-r ${cur ? "cur" : ""} ${ctx.risk.has(s.name) ? "risk" : ""}" data-bhr="${si}" data-q="${esc(normName(s.name))}"><span class="no">${si + 1}</span>
      <div class="nm"><b class="bh-nmb" data-st="${si}" title="${esc(s.name)} — kartochkani ochish">${s.star ? "⭐ " : ""}${esc(s.name)}</b><small>${sub}</small></div>
      ${pill(c, d, si, ctx.ed)}<div class="bh-gs">${g}</div></div>`;
  }
  // yo'qlama tugmasi (ro'yxat va kriterial jadval): bosilsa menyu — ✓ Keldi, S, DQ, K, KQ, CH
  function pill(c, d, si, ed) {
    const ak = attKey(c.students[si].marks[d] || "");
    return `<button type="button" class="bh-at a-${ak || "ok"}" data-bhat="${si}" ${ed ? "" : "disabled"} aria-label="Yo'qlama: ${esc(attName(ak))}" title="${esc(attName(ak))}">${ATT_L[ak] || esc(ak.toUpperCase())}</button>`;
  }
  function attMenu(anchor, c, si, d, after) {
    const ak = attKey(c.students[si].marks[d] || "");
    menu(anchor, [""].concat(DAY_ATT.map((a) => a[0])).map((k) => `<button type="button" class="${ak === k ? "on" : ""}" data-bhav="${k}"><b class="bh-mk a-${k || "ok"}">${ATT_L[k]}</b>${esc(attName(k))}</button>`).join(""),
      (mm) => mm.querySelectorAll("[data-bhav]").forEach((x) => x.onclick = () => { closeMenu(); if (setAtt(c, si, d, x.dataset.bhav)) after(); }));
  }
  function barH(c, d, ctx) {
    const L = ltOf(c, d), R = rowsOf(c, d, ctx.order), o = counts(c, d, R);
    const chips = [["all", "Hammasi", ""], ["none", "Bahosiz", ""], ["part", "Chala", "w"], ["abs", "Kelmagan / kech", "d"], ["low", "Chorakda kam baho", "w"]]
      .map(([k, t, cl]) => `<button type="button" class="bh-chip ${cl} ${st.flt === k ? "on" : ""}" data-bhf="${k}" aria-pressed="${st.flt === k}">${t} <b>${o[k]}</b></button>`).join("");
    const vw = [["list", "Ro'yxat"], ["fok", "Bitta o'quvchi"], ["tab", "Jadval"]].map(([k, t]) => `<button type="button" class="${st.v === k ? "on" : ""}" data-bhv="${k}">${t}</button>`).join("");
    return `<div class="card bh-hd">
      <div class="bh-bar">
        <button type="button" class="bh-lt" data-bhlt aria-haspopup="menu" ${ctx.ed ? "" : "disabled"} title="Dars turi — qaysi usul ochilishini belgilaydi">${esc(L.t.n)}<small>${METH[L.t.m].n}</small></button>
        <button type="button" class="bh-tw" data-bhtwo aria-pressed="${L.two}" ${ctx.ed ? "" : "disabled"} title="Hammaga ikkinchi baho katagi (masalan 8/9)"><i></i>2 baho</button>
        <div class="mz-seg bh-seg" role="group" aria-label="Ko'rinish">${vw}</div>
        <span class="sp"></span>
        ${ctx.ed && st.v !== "tab" ? `<button type="button" class="btn btn-primary" data-bhseq>▶ Ketma-ket baholash</button>` : ""}
        <button type="button" class="btn" data-bhmore aria-haspopup="menu" aria-label="Boshqa amallar">⋯</button>
      </div>
      ${st.v === "list" ? `<div class="bh-sum" role="group" aria-label="Filtr">${chips}<span class="bh-avg">O'rtacha <b>${o.n ? (o.sum / o.n).toFixed(1) : "—"}</b> · ${o.n} baho</span></div>` : ""}
    </div>`;
  }
  const HUE = (i) => `hsl(${(i * 47) % 360} 45% 46%)`;
  const ini = (n) => String(n).trim().split(/\s+/).map((w) => w[0] || "").slice(0, 2).reverse().join("").toUpperCase();
  function fokH(c, d, ctx) {
    const R = rowsOf(c, d, ctx.order);
    if (!R.length) return `<div class="card bh-empty">Bu darsda o'quvchi yo'q</div>`;
    if (!st.sh || !R.includes(st.sh.si)) { const f = R.find((si) => needs(info(c, d, si))); open0(c, d, f ?? R[0], null, true, true); }
    const si = st.sh.si, s = c.students[si], n = qCount(c, s, d);
    const strip = R.map((j) => { const I = info(c, d, j); return `<button type="button" data-bhfj="${j}" class="${j === si ? "cur" : ""} ${I.ab ? "ab" : I.g[0] != null ? "f" : I.p[0] != null ? "pt" : ""}" style="${I.g[0] != null && !I.ab ? gst(I.g[0]) : ""}" aria-label="${j + 1}. ${esc(I.s.name)}">${j + 1}</button>`; }).join("");
    return `<div class="bh-strip" role="group" aria-label="O'quvchilar">${strip}</div>
      <div class="card bh-fk" id="bh-fk"><div class="bh-fkh"><span class="bh-av" style="background:${HUE(si)}">${esc(ini(s.name))}</span><div><b>${esc(s.name)}</b><small>${si + 1}-o'quvchi${n == null ? "" : ` · chorakda ${n} ta baho`}${s.fc && s.fc[d] ? " · 💬 izoh bor" : ""}</small></div></div>${sheetH(c, d, ctx)}</div>
      <div class="bh-swh">Telefonda chapga / o'ngga suring — keyingi / oldingi o'quvchi</div>`;
  }
  // Ro'yxat / Bitta o'quvchi (Jadval — kriterial.js jadvali, pageDay chizadi)
  function main(c, d, ctx) {
    sync(c, d);
    if (st.v === "tab") return `<div class="bh" data-bh>${barH(c, d, ctx)}</div>`;
    const R = rowsOf(c, d, ctx.order).filter((si) => pass(c, d, si));
    const body = st.v === "fok" ? fokH(c, d, ctx) : `<div class="card bh-lst">${R.length ? R.map((si) => rowH(c, d, si, ctx)).join("") : `<div class="bh-empty">Bu filtrda o'quvchi yo'q ✓</div>`}</div>`;
    return `<div class="bh" data-bh>${barH(c, d, ctx)}${body}</div>`;
  }
  // boshqa sinf / kunga o'tilsa baho oynasi yopiladi
  function sync(c, d) { const k = `${D.classes.indexOf(c)}|${d}`; if (st.key !== k) { st.key = k; st.sh = null; st.seq = false; st.flt = "all"; } }

  /* ── baho oynasi ── */
  function cur(c, d) {
    const {si, slot, m} = st.sh, x = slotOf(c.students[si], d, slot);
    if (x && x.m === m) return x;
    if (!st.tmp || st.tmp.m !== m) st.tmp = blank(m);
    return st.tmp;
  }
  const LVL = (k, v) => MZN.P[k === "d" ? 0 : 1].lv[v] || "";
  function sheetH(c, d, ctx) {
    const {si, slot, m} = st.sh, s = c.students[si], mk = s.marks[d] || "", ab = absent(mk), x = cur(c, d), g = gradeOf(x), p = partOf(x), ed = ctx.ed, dis = ed ? "" : "disabled";
    const order = seqList(c, d, ctx), pos = order.indexOf(si), ak = attKey(mk), I = info(c, d, si);
    let body;
    if (ab) body = `<div class="bh-empty">${esc(attName(ak))} — baho qo'yilmaydi. Yo'qlamani «✓ Keldi» qilsangiz, baho qo'yish ochiladi.</div>`;
    else if (m === "tez") body = `<div class="bh-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => `<button type="button" data-bhpv="${v}" class="${x.v === v ? "on" : ""}" style="${x.v === v ? gst(v) : ""}" ${dis}>${v}</button>`).join("")}</div><span class="bh-kbd">Klaviatura: <kbd>1</kbd>–<kbd>9</kbd>, <kbd>0</kbd> = 10.${st.seq ? " Raqam bosilsa, keyingi o'quvchiga o'tadi." : ""}</span>`;
    else if (m === "ball") body = [["d", "Darsdagi ish", 1, 6], ["u", "Uy vazifasi", 0, 4]].map(([k, n, a, b]) => `<div class="bh-part"><div class="ph"><b>${n}</b><span class="muted">${a}–${b} ball</span></div><div class="bh-lv" style="grid-template-columns:repeat(${b - a + 1},1fr)">${Array.from({length: b - a + 1}, (_, j) => a + j).map((v) => `<button type="button" data-bhbv="${k}|${v}" class="${x[k] === v ? "on" : ""}" ${dis} title="${esc(LVL(k, v))}">${v}</button>`).join("")}</div><div class="bh-lvd">${x[k] != null ? esc(LVL(k, x[k])) : "Ballni tanlang"}</div></div>`).join("");
    else {
      const ds = KRT.descs(c), di = (k) => { const v = x.k[k]; return `<div class="bh-di"><code>${code(k)}</code><span>${esc(ds[k])}</span><div class="bh-pm"><button type="button" class="p ${v === "p" ? "on" : ""}" data-bhpk="${k}|p" ${dis} aria-pressed="${v === "p"}" aria-label="${code(k)} bajardi">+</button><button type="button" class="m ${v === "m" ? "on" : ""}" data-bhpk="${k}|m" ${dis} aria-pressed="${v === "m"}" aria-label="${code(k)} bajarmadi">−</button></div></div>`; };
      body = `<div class="bh-dl"><div class="gh"><span>Darsdagi ish · 1 + 5 ta</span><span>D0 qatnashdi ✓</span></div>${[0, 1, 2, 3, 4].map(di).join("")}<div class="gh"><span>Uy vazifasi · 4 ta</span></div>${[5, 6, 7, 8].map(di).join("")}</div>
        ${ed ? `<div class="bh-row"><button type="button" class="btn btn-sm" data-bhpall="p">Bo'shlarga «+»</button><button type="button" class="btn btn-sm" data-bhpall="m">Bo'shlarga «−»</button><span class="bh-kbd">Klaviatura: <kbd>+</kbd> <kbd>−</kbd> navbatdagi deskriptorga</span></div>` : ""}`;
    }
    const tabs = Object.entries(METH).map(([k, v]) => `<button type="button" class="${m === k ? "on" : ""}" data-bhsm="${k}" ${dis}>${v.n}</button>`).join("");
    const slotsw = I.two ? `<div class="bh-slotsw" role="group" aria-label="Qaysi baho">${[0, 1].map((k) => `<button type="button" class="${slot === k ? "on" : ""}" data-bhss="${k}" ${k && I.g[0] == null ? "disabled title=\"Avval 1-bahoni qo'ying\"" : ""}>${k + 1}-baho${I.g[k] != null ? ` · ${I.g[k]}` : ""}</button>`).join("")}</div>` : "";
    const iz = (s.fc && s.fc[d]) || "";
    const atts = [""].concat(DAY_ATT.map((a) => a[0]));
    return `<div class="bh-sh-h">
        <div class="bh-sh-t"><span class="muted bh-no">${si + 1}</span><h3>${esc(s.name)}</h3><div class="bh-nav"><button type="button" data-bhnav="-1" aria-label="Oldingi o'quvchi">‹</button><button type="button" data-bhnav="1" aria-label="Keyingi o'quvchi">›</button><button type="button" data-bhx aria-label="Yopish">✕</button></div></div>
        ${st.seq && order.length ? `<div class="bh-prog" title="${pos + 1} / ${order.length}"><i style="width:${(Math.max(0, pos) + 1) / order.length * 100}%"></i></div>` : ""}
        <div class="bh-attrow" role="group" aria-label="Yo'qlama">${atts.map((k) => `<button type="button" class="a-${k || "ok"} ${ak === k ? "on" : ""}" data-bhsa="${k}" ${dis} title="${esc(attName(k))}">${k === "" ? "✓ Keldi" : ATT_L[k]}</button>`).join("")}</div>
        ${ab ? "" : `<div class="mz-seg bh-seg" role="group" aria-label="Usul">${tabs}</div>`}${ab ? "" : slotsw}
      </div>
      <div class="bh-sh-b">${body}
        ${ab ? "" : st.iz || iz ? `<label class="bh-izl"><span class="bh-lbl">Izoh</span><textarea class="form-control" id="bh-iz" rows="2" maxlength="500" ${ed ? "" : "readonly"} placeholder="Masalan: guruh ishida faol bo'ldi">${esc(iz)}</textarea></label>` : ed ? `<button type="button" class="bh-izb" data-bhiz>＋ Izoh yozish</button>` : ""}
        ${ab || I.g[0] == null ? "" : `<button type="button" class="bh-izb" data-bhmsg>✉ Ota-onaga xabar</button>`}
      </div>
      <div class="bh-sh-f">
        <div class="bh-res"><div class="big" style="${g != null ? gst(g) : ""}">${g != null ? g : p != null ? p + "…" : "—"}</div><small>${g != null ? "Jurnalga tushadi" : p != null ? "Chala: hali baho yo'q" : "Baho tanlanmagan"}${x.m === "ball" && g != null ? `<br>${x.d} + ${x.u}` : x.m === "pm" && g != null ? `<br>${pmDU(x.k).join(" + ")}` : ""}</small></div>
        <span class="sp"></span>
        ${ed && !ab && isSet(slotOf(s, d, slot)) ? `<button type="button" class="btn" data-bhclr>O'chirish</button>` : ""}
        <button type="button" class="btn btn-primary" data-bhnext>${st.seq || st.v === "fok" ? "Keyingisi ›" : "Tayyor"}</button>
      </div>`;
  }
  const seqList = (c, d, ctx) => rowsOf(c, d, ctx.order).filter((si) => !absent(c.students[si].marks[d] || ""));
  // m — usul (bo'lmasa: bor bahoniki, yo'q bo'lsa dars turiniki); quiet — chizmasdan
  function open0(c, d, si, slot, seq, quiet) {
    const s = c.students[si]; if (slot == null) { const I = info(c, d, si); slot = I.g[0] != null && I.two && I.g[1] == null ? 1 : 0; }
    const x = slotOf(s, d, slot);
    st.sh = {si, slot, m: x ? x.m : slot ? "tez" : ltOf(c, d).t.m}; st.seq = !!seq; st.iz = false; st.tmp = null;
    if (!quiet && CTX) paint(true);
  }

  /* ── chizish va hodisalar ── */
  let CTX = null;   // {c, d, ctx, m, after}
  function leave(reset) { if (reset) { st.sh = null; st.seq = false; } closeMenu(); const a = document.getElementById("bh-sheet"), b = document.getElementById("bh-scrim"); if (a) a.remove(); if (b) b.remove(); document.body.classList.remove("bh-open", "bh-lock"); }
  function saveIz() {
    const t = document.getElementById("bh-iz"); if (!t || !st.sh || !CTX || t.readOnly) return;
    const {c, d} = CTX, s = c.students[st.sh.si], v = t.value.trim().slice(0, 500), o = (s.fc && s.fc[d]) || "";
    if (v === o) return;
    s.fc = s.fc || {}; if (v) s.fc[d] = v; else delete s.fc[d]; if (!Object.keys(s.fc).length) delete s.fc;
    save();
  }
  // qayta chizish: ro'yxat (aylantirish joyida qoladi), oyna va pageDay dagi hisoblar
  function paint(focus) {
    if (!CTX) return; const {c, d, ctx, m} = CTX, box = m.querySelector("[data-bh]"); if (!box) return;
    if (st.v === "tab") { const y0 = window.scrollY; render(); window.scrollTo(0, y0); return; }
    const y = window.scrollY, ae = document.activeElement, keep = ae && ae.dataset ? Object.entries(ae.dataset).find(([k]) => /^bh(pk|pv|bv|sm|ss|sa)$/.test(k)) : null;
    const n = h(main(c, d, ctx)); box.replaceWith(n); bindMain(n);
    mountSheet();
    if (typeof jFilter === "function") jFilter(m);
    if (ctx.after) ctx.after();
    window.scrollTo(0, y);
    if (keep) { const el = document.querySelector(`#bh-sheet [data-${keep[0].replace(/[A-Z]/g, (z) => "-" + z.toLowerCase())}="${keep[1]}"], #bh-fk [data-${keep[0].replace(/[A-Z]/g, (z) => "-" + z.toLowerCase())}="${keep[1]}"]`); if (el) el.focus({preventScroll: true}); }
    else if (focus) setTimeout(() => { const f = document.querySelector("#bh-sheet [data-bhpv],#bh-sheet [data-bhbv],#bh-sheet [data-bhpk],#bh-fk [data-bhpv],#bh-fk [data-bhbv],#bh-fk [data-bhpk]"); if (f && !narrow()) f.focus({preventScroll: true}); scrollRow(); }, 0);
  }
  const scrollRow = () => { const r = st.sh && document.querySelector(`.bh-r[data-bhr="${st.sh.si}"]`); if (r && r.scrollIntoView) r.scrollIntoView({block: "nearest"}); };
  function mountSheet() {
    const old = document.getElementById("bh-sheet"), osc = document.getElementById("bh-scrim");
    const on = !!(CTX && st.sh && st.v === "list");
    document.body.classList.toggle("bh-open", on && wide());
    document.body.classList.toggle("bh-lock", on && narrow());
    if (!on) { if (old) old.remove(); if (osc) osc.remove(); return; }
    const {c, d, ctx} = CTX, sb = old && old.querySelector(".bh-sh-b"), sy = sb ? sb.scrollTop : 0, same = old && old.dataset.si === String(st.sh.si) && old.dataset.slot === String(st.sh.slot) && old.dataset.m === st.sh.m;
    const sc = h(`<div class="bh-scrim" id="bh-scrim"></div>`), sh = h(`<div class="bh-sheet" id="bh-sheet" role="dialog" aria-modal="${narrow()}" aria-label="Baho qo'yish" data-si="${st.sh.si}" data-slot="${st.sh.slot}" data-m="${st.sh.m}">${sheetH(c, d, ctx)}</div>`);
    if (old) old.replaceWith(sh); else document.body.append(sh);
    if (osc) osc.replaceWith(sc); else document.body.insertBefore(sc, sh);
    sc.onclick = () => close();
    if (same) { const nb = sh.querySelector(".bh-sh-b"); if (nb) nb.scrollTop = sy; }
    bindSheet(sh);
  }
  function close() { saveIz(); if (st.v === "fok") { paint(); return; } st.sh = null; st.seq = false; paint(); }
  function go(dir) {
    if (!CTX || !st.sh) return; saveIz();
    const {c, d, ctx} = CTX, si = st.sh.si, I = info(c, d, si);
    if (st.seq && dir > 0 && st.sh.slot === 0 && I.two && I.g[0] != null && I.g[1] == null) { open0(c, d, si, 1, true); return; }
    const all = seqList(c, d, ctx), order = st.seq ? all.filter((j) => j === si || needs(info(c, d, j))) : st.v === "fok" ? rowsOf(c, d, ctx.order) : all;
    const nx = order[order.indexOf(si) + dir];
    if (nx == null) { if (st.seq && dir > 0) { if (st.v === "fok") { st.seq = false; paint(); } else close(); toast("Hamma o'quvchi baholandi ✓"); } else toast(dir > 0 ? "Bu oxirgi o'quvchi" : "Bu birinchi o'quvchi"); return; }
    const J = info(c, d, nx);
    open0(c, d, nx, st.seq && J.g[0] != null && J.two ? 1 : 0, st.seq || st.v === "fok");
  }
  // o'zgarishni yozish (bo'sh — o'chirish)
  function commit(x) {
    const {c, d} = CTX, r = write(c, st.sh.si, d, st.sh.slot, x);
    if (!r) return false;
    if (r === "sw") st.sh.slot = 0;
    st.tmp = isSet(x) ? null : x;
    return true;
  }

  let menuEl = null;
  function closeMenu() { if (menuEl) { menuEl.remove(); menuEl = null; document.removeEventListener("pointerdown", outMenu, true); } }
  const outMenu = (e) => { if (menuEl && !menuEl.contains(e.target) && !e.target.closest("[data-bhlt],[data-bhmore],[data-bhat]")) closeMenu(); };
  function menu(anchor, html, on) {
    closeMenu();
    menuEl = h(`<div class="bh-menu" role="menu">${html}</div>`); document.body.append(menuEl);
    const a = anchor.getBoundingClientRect(), w = menuEl.offsetWidth, hh = menuEl.offsetHeight;
    let top = a.bottom + 6; if (top + hh > innerHeight - 8 && a.top - hh - 6 > 8) top = a.top - hh - 6;
    menuEl.style.top = (top + window.scrollY) + "px";
    menuEl.style.left = Math.max(8, Math.min(a.left, document.documentElement.clientWidth - w - 8)) + "px";
    on(menuEl); document.addEventListener("pointerdown", outMenu, true);
    const f = menuEl.querySelector("button"); if (f) f.focus({preventScroll: true});
  }

  function bindMain(box) {
    const {c, d, ctx} = CTX;
    box.querySelectorAll("[data-st]").forEach((e) => e.onclick = () => studentCard(S.ci, c.students[+e.dataset.st].name));
    const lt = box.querySelector("[data-bhlt]"); if (lt) lt.onclick = (e) => { const L = ltOf(c, d); menu(e.currentTarget, `<div class="bh-lbl" style="padding:6px 10px 4px">Dars turi</div>${types().map((t) => `<button type="button" class="${t.id === L.t.id ? "on" : ""}" data-bhty="${esc(t.id)}">${esc(t.n)}<small>${METH[t.m].s}${t.two ? " · 2 baho" : ""}</small></button>`).join("")}<hr><button type="button" data-bhtyset>⚙ Dars turlarini sozlash</button>`, (mm) => {
      mm.querySelectorAll("[data-bhty]").forEach((b) => b.onclick = () => { const t = types().find((x) => x.id === b.dataset.bhty); closeMenu(); setLt(c, d, {t: t.id}); if (st.sh && !isSet(slotOf(c.students[st.sh.si], d, st.sh.slot))) { st.sh.m = st.sh.slot ? st.sh.m : t.m; st.tmp = null; } toast(`${t.n}: ${METH[t.m].n}${t.two ? ", 2 baho" : ""}`); paint(); });
      mm.querySelector("[data-bhtyset]").onclick = () => { closeMenu(); typeDlg(c, d); };
    }); };
    const tw = box.querySelector("[data-bhtwo]"); if (tw) tw.onclick = () => { const L = ltOf(c, d); setLt(c, d, {t: L.t.id, two: !L.two}); paint(); };
    box.querySelectorAll("[data-bhv]").forEach((b) => b.onclick = () => { saveIz(); const v = b.dataset.bhv, pv = st.v; if (pv === v) return; st.v = v; st.sh = null; st.seq = false; if (v === "tab" || pv === "tab") { leave(); render(); return; } paint(); });
    box.querySelectorAll("[data-bhf]").forEach((b) => b.onclick = () => { st.flt = st.flt === b.dataset.bhf ? "all" : b.dataset.bhf; paint(); });
    const sq = box.querySelector("[data-bhseq]"); if (sq) sq.onclick = () => {
      const f = seqList(c, d, ctx).find((si) => needs(info(c, d, si)));
      if (f == null) { toast("Hamma o'quvchi baholangan ✓"); return; }
      st.flt = "all"; open0(c, d, f, null, true);
    };
    const mo = box.querySelector("[data-bhmore]"); if (mo) mo.onclick = (e) => { const L = ltOf(c, d); menu(e.currentTarget, `
      ${ctx.ed ? `<button type="button" data-bhmm="fill">✓ Bahosizlarga to'liq ball<small>${METH[L.t.m].n}</small></button>` : ""}
      <button type="button" data-bhmm="desc">✎ Deskriptorlar${c.subject ? ` · ${esc(c.subject)}` : ""}</button><button type="button" data-bhmm="rub">📋 Baholash mezonlari</button><hr>
      <button type="button" data-bhmm="pr">🖨 Chop etish / PDF</button>
      <button type="button" data-bhmm="q">📈 Chorak tahlili</button>`, (mm) => {
      mm.querySelectorAll("[data-bhmm]").forEach((b) => b.onclick = () => { const v = b.dataset.bhmm; closeMenu();
        if (v === "fill") fillAll(c, d); else if (v === "desc") descDlg(c); else if (v === "rub") rubDlg(); else if (v === "pr") KCH.dialog(c, d);
        else if (v === "q") { KRT.state.tab = "q"; st.v = "tab"; st.sh = null; leave(); render(); } });
    }); };
    box.querySelectorAll("[data-bhat]").forEach((b) => b.onclick = (e) => { const si = +b.dataset.bhat; attMenu(e.currentTarget, c, si, d, () => { if (st.sh && st.sh.si === si) st.tmp = null; paint(); }); });
    box.querySelectorAll("[data-bhg]").forEach((b) => b.onclick = () => { const [si, sl] = b.dataset.bhg.split("|").map(Number); saveIz(); open0(c, d, si, sl, false); });
    box.querySelectorAll("[data-bhfj]").forEach((b) => b.onclick = () => { saveIz(); open0(c, d, +b.dataset.bhfj, null, st.seq); });
    const fk = box.querySelector("#bh-fk");
    if (fk) {
      bindSheet(fk);
      let x0 = null, y0 = 0;
      fk.onpointerdown = (e) => { if (e.pointerType === "mouse") return; x0 = e.clientX; y0 = e.clientY; };
      fk.onpointerup = (e) => { if (x0 == null) return; const dx = e.clientX - x0, dy = Math.abs(e.clientY - y0); x0 = null; if (Math.abs(dx) > 60 && dy < 50) go(dx < 0 ? 1 : -1); };
      fk.onpointercancel = () => { x0 = null; };
    }
  }
  function bindSheet(sh) {
    const {c, d, ctx} = CTX, ed = ctx.ed;
    const x = () => JSON.parse(JSON.stringify(cur(c, d)));
    const q = (sel, f) => sh.querySelectorAll(sel).forEach((b) => b.onclick = () => f(b));
    q("[data-bhx]", () => close());
    q("[data-bhnav]", (b) => go(+b.dataset.bhnav));
    if (!ed) return;
    q("[data-bhsa]", (b) => { saveIz(); if (setAtt(c, st.sh.si, d, b.dataset.bhsa)) { st.tmp = null; paint(); } });
    q("[data-bhsm]", (b) => {
      const m = b.dataset.bhsm, g = slotOf(c.students[st.sh.si], d, st.sh.slot); if (m === st.sh.m) return;
      if (g && g.m !== m && isSet(g)) { if (!commit(null)) return; toast(`${METH[g.m].n} bahosi olib tashlandi — ${METH[m].n} bilan qo'ying`); }
      st.sh.m = m; st.tmp = null; paint();
    });
    q("[data-bhss]", (b) => { saveIz(); open0(c, d, st.sh.si, +b.dataset.bhss, st.seq); });
    q("[data-bhpv]", (b) => { const v = +b.dataset.bhpv, o = x(); o.v = o.v === v ? null : v; if (!commit(o)) return; paint(); if (o.v != null && st.seq) setTimeout(() => go(1), 180); });
    q("[data-bhbv]", (b) => { const [k, v] = b.dataset.bhbv.split("|"), o = x(); o[k] = o[k] === +v ? null : +v; if (commit(o)) paint(); });
    q("[data-bhpk]", (b) => { const [k, v] = b.dataset.bhpk.split("|"), o = x(); o.k[+k] = o.k[+k] === v ? null : v; if (commit(o)) paint(); });
    q("[data-bhpall]", (b) => { const o = x(); o.k = o.k.map((v) => v || b.dataset.bhpall); if (commit(o)) paint(); });
    q("[data-bhiz]", () => { st.iz = true; paint(); setTimeout(() => { const t = document.getElementById("bh-iz"); if (t) t.focus(); }, 0); });
    q("[data-bhmsg]", () => { saveIz(); KRT.msgDlg(c, st.sh.si, d); });
    q("[data-bhclr]", () => { if (commit(null)) { toast("Baho o'chirildi"); paint(); } });
    q("[data-bhnext]", () => st.seq || st.v === "fok" ? go(1) : close());
    const iz = sh.querySelector("#bh-iz"); if (iz) iz.onchange = saveIz;
  }
  document.addEventListener("keydown", (e) => {
    if (!CTX || !st.sh || !document.body.contains(CTX.m) || document.querySelector(".modal")) return;
    if (!document.getElementById("bh-sheet") && !document.getElementById("bh-fk")) return;
    if (e.key === "Escape" && menuEl) { closeMenu(); return; }
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
    const {c, d, ctx} = CTX, s = c.students[st.sh.si];
    if (e.key === "Escape") { if (st.v !== "fok") { e.preventDefault(); close(); } return; }
    if (e.key === "Enter" && !e.target.closest("button")) { e.preventDefault(); st.seq || st.v === "fok" ? go(1) : close(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); go(1); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); go(-1); return; }
    if (!ctx.ed || absent(s.marks[d] || "")) return;
    const o = JSON.parse(JSON.stringify(cur(c, d)));
    if (st.sh.m === "tez" && /^[0-9]$/.test(e.key)) { e.preventDefault(); o.v = e.key === "0" ? 10 : +e.key; if (!commit(o)) return; paint(); if (st.seq) setTimeout(() => go(1), 180); }
    else if (st.sh.m === "pm" && ["+", "=", "-", "_"].includes(e.key)) { e.preventDefault(); const k = o.k.findIndex((v) => v == null); if (k < 0) return; o.k[k] = e.key === "+" || e.key === "=" ? "p" : "m"; if (commit(o)) paint(); }
    else if (st.sh.m === "ball" && /^[0-6]$/.test(e.key)) { const n = +e.key; if (o.d == null && n >= 1) o.d = n; else if (o.d != null && o.u == null && n <= 4) o.u = n; else return; e.preventDefault(); if (commit(o)) paint(); }
  });
  window.addEventListener("resize", () => { if (CTX && st.sh && st.v === "list" && document.body.contains(CTX.m)) mountSheet(); });

  // pageDay chaqiradi: m — sahifa, ctx = {ed, risk, order, after}
  function bind(m, c, d, ctx) {
    CTX = {c, d, ctx, m};
    const box = m.querySelector("[data-bh]"); if (box) bindMain(box);
    mountSheet();
  }

  /* ── oynalar ── */
  function fillAll(c, d) {
    const L = ltOf(c, d), q = []; let n = 0;
    if (!canEdit(d)) { putMark(c, 0, d, c.students[0].marks[d] || ""); return; }
    batch(() => { for (const si of rowsOf(c, d, CTX.ctx.order)) {
      const s = c.students[si], I = info(c, d, si); if (I.ab || I.g[0] != null) continue;
      const x = I.x[0] && I.x[0].m === L.t.m ? JSON.parse(JSON.stringify(I.x[0])) : blank(L.t.m);
      if (x.m === "tez") x.v = 10; else if (x.m === "ball") { x.d = x.d ?? 6; x.u = x.u ?? 4; } else x.k = x.k.map((v) => v || "p");
      if (write(c, si, d, 0, x, q)) n++; void s;
    } });
    pushUndo(q); save(); paint();
    toast(n ? `${n} o'quvchiga to'liq ball qo'yildi (Ctrl+Z — qaytarish)` : "Hammada baho bor");
  }
  function typeDlg(c, d) {
    const T = JSON.parse(JSON.stringify(types()));
    const body = () => T.map((t, j) => `<tr><td><input class="form-control form-control-sm" data-tn="${j}" maxlength="40" value="${esc(t.n)}" aria-label="Tur nomi"></td><td><select class="form-select form-select-sm" data-tm="${j}" aria-label="${esc(t.n)} usuli">${Object.entries(METH).map(([k, v]) => `<option value="${k}" ${t.m === k ? "selected" : ""}>${v.n}</option>`).join("")}</select></td><td class="c"><input type="checkbox" class="form-check-input" data-tt="${j}" ${t.two ? "checked" : ""} aria-label="${esc(t.n)}: 2 baho"></td><td>${T.length > 1 ? `<button type="button" class="btn btn-sm" data-td="${j}" aria-label="O'chirish">✕</button>` : ""}</td></tr>`).join("");
    modal(`<div class="bh-dlg"><h2>Dars turlari</h2><span class="muted bh-small">Dars turi tanlanganda qaysi usul ochilishi va hammaga 2 baho kerakmi. Qo'yilgan baholar o'zgarmaydi.</span>
      <table class="bh-tt"><thead><tr><th>Tur</th><th>Usul</th><th>2 baho</th><th></th></tr></thead><tbody>${body()}</tbody></table>
      <div class="bh-row"><button type="button" class="btn btn-sm" data-new>＋ Yangi tur</button><button type="button" class="btn btn-sm" data-def>Asl holiga qaytarish</button></div>
      <div class="bh-foot"><button type="button" class="btn" data-x>Bekor qilish</button><button type="button" class="btn btn-primary" data-ok>Saqlash</button></div></div>`, (mm, cl) => {
      const tb = $("tbody", mm);
      const wire = () => {
        mm.querySelectorAll("[data-tn]").forEach((x) => x.oninput = () => { T[+x.dataset.tn].n = x.value; });
        mm.querySelectorAll("[data-tm]").forEach((x) => x.onchange = () => { T[+x.dataset.tm].m = x.value; });
        mm.querySelectorAll("[data-tt]").forEach((x) => x.onchange = () => { T[+x.dataset.tt].two = x.checked; });
        mm.querySelectorAll("[data-td]").forEach((x) => x.onclick = () => { T.splice(+x.dataset.td, 1); tb.innerHTML = body(); wire(); });
      };
      wire();
      $("[data-new]", mm).onclick = () => { if (T.length >= 20) return; let k = 1; while (T.some((t) => t.id === "t" + k)) k++; T.push({id: "t" + k, n: "Laboratoriya ishi", m: "pm", two: false}); tb.innerHTML = body(); wire(); const l = tb.querySelector("tr:last-child input"); if (l) { l.focus(); l.select(); } };
      $("[data-def]", mm).onclick = () => { T.splice(0, T.length, ...JSON.parse(JSON.stringify(DEF_T))); tb.innerHTML = body(); wire(); };
      $("[data-x]", mm).onclick = () => cl();
      $("[data-ok]", mm).onclick = () => {
        T.forEach((t) => { t.n = String(t.n).trim().slice(0, 40) || "Dars"; });
        if (JSON.stringify(T) === JSON.stringify(DEF_T)) delete D.web.ltypes; else D.web.ltypes = T;
        save(); cl(); toast("Dars turlari saqlandi"); paint();
      };
    });
  }
  function descDlg(c) {
    const fan = String(c.subject || "").trim(), fk = fanKey(c), names = KRT.TPL.map((t) => t[0]);
    let curV = KRT.descs(c).slice(), tp = tplName(c.subject) || names[0];
    const row = (k) => `<b>${code(k)}</b><input class="form-control form-control-sm" data-di="${k}" maxlength="60" aria-label="${code(k)}">`;
    modal(`<div class="bh-dlg"><h2>Deskriptorlar${fan ? ` · ${esc(fan)}` : ""}</h2>
      <span class="muted bh-small">${fan ? `Fan «${esc(fan)}» → «${esc(tplName(fan) || "Umumiy")}» shabloni o'zi tanlanadi.` : "Sinf fani ko'rsatilmagan — umumiy namuna."} Boshqa shablonni bosing yoki matnni tahrirlang.</span>
      <div class="bh-fans">${names.map((n, i) => `<button type="button" data-tp="${i}" class="${n === tp ? "on" : ""}">${esc(n)}</button>`).join("")}</div>
      <div class="bh-ded"><span class="bh-lbl h">Darsdagi ish (D0 «qatnashdi» o'zi qo'yiladi)</span>${[0, 1, 2, 3, 4].map(row).join("")}<span class="bh-lbl h">Uy vazifasi</span>${[5, 6, 7, 8].map(row).join("")}</div>
      <div class="bh-rad">${fk ? `<label><input type="radio" name="bh-dsc" value="f" ${Array.isArray(c.kd) ? "" : "checked"}> «${esc(fan)}» fanidagi barcha sinflarimga</label>` : ""}<label><input type="radio" name="bh-dsc" value="c" ${fk && !Array.isArray(c.kd) ? "" : "checked"}> Faqat shu sinfga (${esc(c.name)})</label></div>
      <div class="bh-foot"><button type="button" class="btn" data-x>Bekor qilish</button><button type="button" class="btn btn-primary" data-ok>Saqlash</button></div></div>`, (mm, cl) => {
      const fill = () => mm.querySelectorAll("[data-di]").forEach((x) => { x.value = curV[+x.dataset.di]; });
      fill();
      mm.querySelectorAll("[data-tp]").forEach((b) => b.onclick = () => { tp = names[+b.dataset.tp]; curV = KRT.TPL[+b.dataset.tp][1].slice(); fill(); mm.querySelectorAll("[data-tp]").forEach((x) => x.classList.toggle("on", x === b)); });
      $("[data-x]", mm).onclick = () => cl();
      $("[data-ok]", mm).onclick = () => {
        const v = [...mm.querySelectorAll("[data-di]")].map((x, k) => x.value.trim().slice(0, 60) || curV[k] || KRT.DEF[k]), to = (mm.querySelector("input[name=bh-dsc]:checked") || {}).value;
        if (to === "f" && fk) { D.web.kdf = D.web.kdf || {}; D.web.kdf[fk] = v; delete c.kd; } else c.kd = v;
        save(); cl(); toast("Deskriptorlar saqlandi"); paint();
      };
    });
  }
  function rubDlg() {
    const tg = (g, t) => `<span class="bh-tgr" style="${gst(g)}">${t}</span>`;
    modal(`<div class="bh-dlg"><h2>Baholash mezonlari</h2><span class="muted bh-small">eMaktab: darsdagi ish 60% (6 ballgacha) + uy vazifasi 40% (4 ballgacha) = 10. Uchala usul ham shu formulaga tushadi.</span>
      <table class="bh-tt"><tr><th>Tez 1–10</th><td>tayyor baho</td></tr><tr><th>6 + 4</th><td>darsdagi ish 1–6 + uy vazifasi 0–4</td></tr><tr><th>+/−</th><td>1 (qatnashdi) + 5 ta D + 4 ta U, har «+» — 1 ball</td></tr><tr><th>2 baho</th><td>bir darsda ikkita baho (masalan 8/9) — har biri o'z usulida</td></tr><tr><th>Rang</th><td>${tg(9, "8–10")} ${tg(6, "5–7")} ${tg(2, "1–4")}</td></tr></table>
      <div class="bh-foot"><button type="button" class="btn" data-mz>Mezonlar jadvali (6 + 4)</button><button type="button" class="btn btn-primary" data-x>Yopish</button></div></div>`, (mm, cl) => {
      $("[data-x]", mm).onclick = () => cl(); $("[data-mz]", mm).onclick = () => { cl(); MZN.rubric(); };
    });
  }
  // o'ng panel: formativ holat (chorakda kam baho olganlar)
  function side(c, d) {
    const q = quarterOf(d), k = fbMin(); if (!q) return "";
    const lw = c.students.filter((s) => !preJoin(c, s, d)).map((s) => [s, qCount(c, s, d)]).filter(([, n]) => n != null && n < k);
    return `<div class="card bh-fb"><b>Formativ holat · ${q}-chorak</b><span class="muted bh-small">Har o'quvchi chorakda kamida ${k} marta baholanadi.</span>${lw.length ? `<ul>${lw.slice(0, 12).map(([s, n]) => `<li><span>${esc(s.name)}</span><span>${n} / ${k}</span></li>`).join("")}${lw.length > 12 ? `<li class="muted">… yana ${lw.length - 12} ta</li>` : ""}</ul>` : `<span class="bh-okk">Hammada yetarli baho bor ✓</span>`}</div>`;
  }

  /* ── tozalash (index.html → cleanStudent / cleanClass / ma'lumotni o'qish) ── */
  function clean(s) {
    if (s.f2 && typeof s.f2 === "object" && !Array.isArray(s.f2)) {
      const o = {};
      for (const [d, v] of Object.entries(s.f2)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !Array.isArray(v)) continue;
        if (v[0] === "p" && v.length === 2 && typeof v[1] === "string" && /^[+.-]{9}$/.test(v[1]) && /[+-]/.test(v[1])) o[d] = ["p", v[1]];
        else if (v[0] === "b" && v.length === 3) {
          const a = v[1] == null ? null : Number.isInteger(v[1]) && v[1] >= 1 && v[1] <= 6 ? v[1] : undefined, b = v[2] == null ? null : Number.isInteger(v[2]) && v[2] >= 0 && v[2] <= 4 ? v[2] : undefined;
          if (a !== undefined && b !== undefined && (a != null || b != null)) o[d] = ["b", a, b];
        }
      }
      if (Object.keys(o).length) s.f2 = o; else delete s.f2;
    } else delete s.f2;
  }
  function cleanCls(c) {
    if (c.lt && typeof c.lt === "object" && !Array.isArray(c.lt)) {
      const o = {};
      for (const [d, v] of Object.entries(c.lt)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !v || typeof v !== "object" || !/^[\w-]{1,20}$/.test(String(v.t || ""))) continue;
        o[d] = {t: String(v.t)}; if (typeof v.two === "boolean") o[d].two = v.two;
      }
      if (Object.keys(o).length) c.lt = o; else delete c.lt;
    } else delete c.lt;
  }
  function cleanWeb(w) {
    if (Array.isArray(w.ltypes)) {
      const seen = new Set();
      w.ltypes = w.ltypes.filter((t) => t && typeof t === "object" && /^[\w-]{1,20}$/.test(String(t.id)) && !seen.has(String(t.id)) && seen.add(String(t.id)))
        .map((t) => ({id: String(t.id), n: String(t.n == null ? "" : t.n).trim().slice(0, 40) || "Dars", m: METH[t.m] ? t.m : "tez", two: t.two === true})).slice(0, 20);
      if (!w.ltypes.length) delete w.ltypes;
    } else delete w.ltypes;
    if (w.kdf && typeof w.kdf === "object" && !Array.isArray(w.kdf)) {
      const o = {};
      for (const [k, v] of Object.entries(w.kdf)) if (/^f:.{1,58}$/.test(k) && Array.isArray(v) && v.length === N) o[k] = v.map((x, i) => String(x == null ? "" : x).trim().slice(0, 60) || KRT.DEF[i]);
      if (Object.keys(o).length) w.kdf = o; else delete w.kdf;
    } else delete w.kdf;
  }

  return {METH, DEF_T, types, ltOf, tplName, tplOf, descs, slotOf, gradeOf, write, setAtt, main, bind, side, leave, pill, attMenu, clean, cleanCls, cleanWeb, state: st,
    view: () => st.v};
})();
