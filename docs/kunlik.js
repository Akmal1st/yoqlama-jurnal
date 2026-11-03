/* Kunlik hisobot rasmi — tasdiqlangan maket v4 (Akmal, 2026-11-03): hamma ma'lumot jadvalda, yuqori kontrast, kunduzgi/tungi rejim.
   Darslar tugagach har sinf uchun alohida PNG chiziladi va «Telegram'ga zaxira» ulangan botga (o'qituvchiga) hamda, biriktirilgan
   bo'lsa, shu sinfning ota-onalar guruhiga yuboriladi. Server kerak emas: rasm brauzerda chiziladi, Bot API ga to'g'ridan-to'g'ri ketadi.
   Sozlama tgCfg().kr ichida (token yonida, faqat shu qurilmada): {on, mode: "end"|"att", th: "light"|"dark", grp: {sinf kaliti: {id, t}},
   day: "YYYY-MM-DD", sent: [shu kuni yuborilgan sinf kalitlari], at: "HH:MM", err}.
   Asosiy skriptdan oldin ulanadi; ichidagi funksiyalar index.html dagi umumiy nomlarni faqat chaqirilganda ishlatadi. */
const KRJ = (() => {
  const W = 680, P = 24, SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  const f = (w, s) => `${w} ${s}px ${SANS}`;
  const TH = {
    light: {bg: "#ffffff", ink: "#0b1220", mut: "#475467", grid: "#c9d1dc", head: "#0b3d91", headInk: "#ffffff", sub: "#eef2f8", zebra: "#f6f8fb",
      st: {"": ["Keldi", "#0a6b2e"], s: ["Sababsiz", "#b3141b"], dq: ["Sababli", "#0b4fae"], k: ["Kasal", "#6a1b9a"], kq: ["Kech qoldi", "#8a4b00"]},
      absRow: "#fff1f1", g: (g) => g >= 8 ? ["#d7f2dd", "#05501f"] : g >= 5 ? ["#fff1bf", "#5c4100"] : ["#ffd9d9", "#8f0d12"]},
    dark: {bg: "#0d1117", ink: "#f2f5f9", mut: "#a7b1bf", grid: "#344054", head: "#1d3b6e", headInk: "#ffffff", sub: "#161c26", zebra: "#121821",
      st: {"": ["Keldi", "#5fd38a"], s: ["Sababsiz", "#ff7b7b"], dq: ["Sababli", "#7db8ff"], k: ["Kasal", "#d59bff"], kq: ["Kech qoldi", "#ffbe5c"]},
      absRow: "#2a1517", g: (g) => g >= 8 ? ["#123d24", "#7ee2a3"] : g >= 5 ? ["#3d3210", "#ffd866"] : ["#4a1619", "#ff9a9a"]},
  };
  function fit(c, t, w) { if (c.measureText(t).width <= w) return t; while (t.length > 1 && c.measureText(t + "…").width > w) t = t.slice(0, -1); return t + "…"; }
  function wrap(c, t, w, max) { const out = []; let ln = ""; for (const wd of String(t).split(/\s+/)) { const tr = ln ? ln + " " + wd : wd; if (c.measureText(tr).width > w && ln) { out.push(ln); ln = wd; } else ln = tr; } if (ln) out.push(ln);
    if (out.length > max) { out.length = max; out[max - 1] = fit(c, out[max - 1] + "…", w); } return out; }
  const isAbs = (st) => ["s", "dq", "k"].includes(st), num = (v) => v.toFixed(1).replace(".", ",");
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

  function draw(r, theme = "light", scale = 2) {
    const T = TH[theme] || TH.light, s = stats(r), TW = W - P * 2;
    const hasP = r.rows.some((x) => x.p), hasC = r.rows.some((x) => x.c);
    // ustunlar: №, F.I.Sh., Davomat, [Darsda, Uyda], Baho, [Izoh]
    const cols = [["№", 34, "c"], ["O'quvchi (F.I.Sh.)", 0, "l"], ["Davomat", 108, "l"]];
    if (hasP) cols.push(["Darsda\n(1–6)", 58, "c"], ["Uy vaz.\n(0–4)", 58, "c"]);
    cols.push(["Baho", 52, "c"]); if (hasC) cols.push(["Izoh", 150, "l"]);
    const fixed = cols.reduce((a, x) => a + x[1], 0); cols[1][1] = TW - fixed;
    const m = document.createElement("canvas").getContext("2d"); m.font = f(500, 14);
    const LW = 120, VW = TW - LW - 24;
    const info = [["Mavzu", r.topic, "kiritilmagan"], ["Uy vazifasi", r.hw, "berilmagan"]]; if (r.work) info.push(["Nazorat ishi", r.work, ""]);
    const infoL = info.map(([l, v, e]) => [l, v ? wrap(m, v, VW, 3) : [e], !v]);
    const infoH = infoL.reduce((a, x) => a + Math.max(34, x[1].length * 20 + 14), 0);
    m.font = f(500, 12.5); const cw = hasC ? cols[cols.length - 1][1] - 14 : 0;
    const rowL = r.rows.map((x) => hasC && x.c ? wrap(m, x.c, cw, 3) : []);
    const rowH = rowL.map((L) => Math.max(34, L.length * 16 + 14));
    const sumH = 66, HH = 44;
    const H = P + 84 + infoH + 12 + sumH + 12 + HH + rowH.reduce((a, b) => a + b, 0) + 14 + 30 + P;
    const cv = document.createElement("canvas"); cv.width = W * scale; cv.height = H * scale;
    const c = cv.getContext("2d"); c.scale(scale, scale); c.textBaseline = "middle";
    c.fillStyle = T.bg; c.fillRect(0, 0, W, H);
    const cell = (x, y, w, h, fill) => { if (fill) { c.fillStyle = fill; c.fillRect(x, y, w, h); } c.strokeStyle = T.grid; c.lineWidth = 1; c.strokeRect(x + .5, y + .5, w, h); };
    let y = P;
    // 1. sarlavha qatori
    cell(P, y, TW, 84, T.head);
    c.fillStyle = T.headInk; c.font = f(800, 26); c.fillText(fit(c, `${r.cls} · ${r.subj}`, TW - 220), P + 16, y + 32);
    c.font = f(500, 14.5); c.globalAlpha = .9; c.fillText(`${r.dateTxt}, ${r.wdTxt}${r.timeTxt ? " · " + r.timeTxt : ""}`, P + 16, y + 62); c.globalAlpha = 1;
    c.textAlign = "right"; c.font = f(700, 12.5); c.globalAlpha = .85; c.fillText("KUNLIK HISOBOT", W - P - 16, y + 32); c.font = f(500, 12.5); if (r.teacher) c.fillText(`O'qituvchi: ${r.teacher}`, W - P - 16, y + 62); c.globalAlpha = 1; c.textAlign = "left";
    y += 84;
    // 2. mavzu / uy vazifasi
    infoL.forEach(([l, L, empty]) => { const h = Math.max(34, L.length * 20 + 14); cell(P, y, LW, h, T.sub); cell(P + LW, y, TW - LW, h, T.bg);
      c.fillStyle = T.mut; c.font = f(700, 13); c.fillText(l, P + 12, y + h / 2);
      c.font = f(empty ? 400 : 500, 14); c.fillStyle = empty ? T.mut : T.ink; L.forEach((t, i) => c.fillText(t, P + LW + 12, y + h / 2 - (L.length - 1) * 10 + i * 20)); y += h; });
    y += 12;
    // 3. ko'rsatkichlar qatori (jadval)
    const sm = [["Ro'yxatda", String(s.n), T.ink], ["Keldi", String(s.came), T.st[""][1]], ["Sababli", String(r.rows.filter((x) => x.st === "dq" || x.st === "k").length), T.st.dq[1]],
      ["Sababsiz", String(r.rows.filter((x) => x.st === "s").length), T.st.s[1]], ["Kech qoldi", String(s.late), T.st.kq[1]], ["Davomat", `${s.pct}%`, T.ink], ["O'rtacha baho", s.avg == null ? "—" : num(s.avg), T.ink]];
    const sw = TW / sm.length;
    sm.forEach(([l, v, col], i) => { const x = P + i * sw; cell(x, y, sw, 26, T.sub); cell(x, y + 26, sw, sumH - 26, T.bg);
      c.textAlign = "center"; c.fillStyle = T.mut; c.font = f(700, 11.5); c.fillText(l, x + sw / 2, y + 13); c.fillStyle = v === "0" ? T.mut : col; c.font = f(800, 20); c.fillText(v, x + sw / 2, y + 26 + (sumH - 26) / 2); c.textAlign = "left"; });
    y += sumH + 12;
    // 4. o'quvchilar jadvali
    let x = P; cols.forEach(([t, w, al]) => { cell(x, y, w, HH, T.head); c.fillStyle = T.headInk; c.font = f(700, 12.5); const L = t.split("\n");
      L.forEach((ln, i) => { c.textAlign = al === "c" ? "center" : "left"; c.fillText(ln, al === "c" ? x + w / 2 : x + 10, y + HH / 2 - (L.length - 1) * 7.5 + i * 15); }); c.textAlign = "left"; x += w; });
    y += HH;
    r.rows.forEach((st, i) => { const h = rowH[i], ab = isAbs(st.st), bg = ab ? T.absRow : i % 2 ? T.zebra : T.bg, my = y + h / 2; let x = P;
      cols.forEach(([t, w, al], k) => { cell(x, y, w, h, bg); const name = t.split("\n")[0];
        if (k === 0) { c.textAlign = "center"; c.fillStyle = T.mut; c.font = f(600, 13); c.fillText(String(i + 1), x + w / 2, my); }
        else if (k === 1) { c.fillStyle = T.ink; c.font = f(ab ? 700 : 500, 14.5); c.fillText(fit(c, st.n, w - 20), x + 10, my); }
        else if (name === "Davomat") { const [lab, col] = T.st[st.st] || T.st[""]; c.fillStyle = col; c.font = f(700, 13.5); c.fillText((st.st ? "● " : "✓ ") + lab, x + 10, my); }
        else if (name === "Darsda" || name === "Uy vaz.") { const pp = (st.p || "").split("+"); const v = name === "Darsda" ? pp[0] : pp[1]; c.textAlign = "center"; c.fillStyle = v ? T.ink : T.mut; c.font = f(600, 14.5); c.fillText(v || "—", x + w / 2, my); }
        else if (name === "Baho") { c.textAlign = "center"; if (st.g != null) { const [gb, gf] = T.g(st.g), gt = st.gt || String(st.g); c.font = f(800, gt.length > 2 ? 14 : 16); const bw = Math.min(w - 6, Math.max(34, c.measureText(gt).width + 12)); rr(c, x + w / 2 - bw / 2, my - 13, bw, 26, 6); c.fillStyle = gb; c.fill(); c.fillStyle = gf; c.fillText(gt, x + w / 2, my); } else { c.fillStyle = T.mut; c.font = f(500, 14); c.fillText("—", x + w / 2, my); } }
        else if (name === "Izoh") { c.fillStyle = T.ink; c.font = f(400, 12.5); rowL[i].forEach((t, j) => c.fillText(t, x + 8, my - (rowL[i].length - 1) * 8 + j * 16)); }
        c.textAlign = "left"; x += w; });
      y += h; });
    y += 14; c.fillStyle = T.mut; c.font = f(500, 12);
    if (hasP) c.fillText("Baho = darsdagi ish (1–6) + uy vazifasi (0–4)", P, y + 12);
    c.textAlign = "right"; c.fillText(`Yo'qlama jurnali · ${r.at}`, W - P, y + 12); c.textAlign = "left";
    return cv;
  }
  function stats(r) {
    const n = r.rows.length, abs = r.rows.filter((x) => isAbs(x.st)).length, late = r.rows.filter((x) => x.st === "kq").length;
    const gs = r.rows.flatMap((x) => x.gs || (x.g != null ? [x.g] : [])), avg = gs.length ? gs.reduce((a, b) => a + b, 0) / gs.length : null;
    return {n, came: n - abs, abs, late, pct: n ? Math.round((n - abs) / n * 100) : 0, avg, gn: gs.length};
  }
  return {draw, stats, num};
})();

const KUN = (() => {
  const cfg = () => Object.assign({on: false, mode: "end", th: "light", grp: {}, day: "", sent: []}, tgCfg().kr || {});
  const setCfg = (p) => tgSet({kr: Object.assign(cfg(), p)});
  const mins = (hm) => (hm ? +hm.slice(0, 2) * 60 + +hm.slice(3, 5) : null);
  const hmNow = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const ST = new Set(["s", "dq", "k", "kq"]);

  /* ───────── ma'lumot: bitta sinfning bir kunlik hisoboti (rasm chizuvchiga oddiy obyekt) ───────── */
  function build(c, t, slots) {
    const sl = (slots || []).filter((x) => x.from), L = c.lessons[t] || {}, w = (c.works || []).find((x) => x.date === t);
    let work = "";
    if (w) { const sc = c.students.map((s) => (s.scores || {})[w.id]).filter(isNum);
      work = `${w.type.toUpperCase()}${w.max ? ` · ${w.max} ball` : ""}` + (sc.length ? ` · o'rtacha ${KRJ.num(sc.reduce((a, b) => a + b, 0) / sc.length)}${w.max ? ` (${Math.round(sc.reduce((a, b) => a + b, 0) / sc.length / w.max * 100)}%)` : ""}` : ""); }
    const rows = c.students.map((s) => {
      const mk = s.marks[t] || "", ap = attPart(mk), gs = gradesOf(mk), fp = MZN.parts(s, t);
      return {n: s.name, st: ST.has(ap) ? ap : "", g: gs.length ? gs[0] : null, gs, gt: gs.length > 1 ? gs.join("/") : "",
        p: fp[0] != null && fp[1] != null ? `${fp[0]}+${fp[1]}` : "", c: ((s.fc || {})[t] || "").trim()};
    });
    const no = sl.map((x) => x.no + 1).join(", ");
    return {cls: /sinf/i.test(c.name) ? c.name : `${c.name} sinf`, subj: c.subject || "", dateTxt: `${+t.slice(8)}-${MONTHS_GEN[+t.slice(5, 7) - 1]}`, wdTxt: WD_FULL[pyWd(t)].toLowerCase(),
      timeTxt: sl.length ? `${no}-soat, ${sl[0].from}–${sl[sl.length - 1].to}` : "", topic: (L.topic || "").trim(), hw: (L.hw || "").trim(), work,
      teacher: ((D.web.bsb_hdr || {}).teacher || "").trim(), at: hmNow(), rows};
  }
  // rasm ostidagi qisqa matn: bildirishnomada va qidiruvda ko'rinadi
  function caption(r) {
    const s = KRJ.stats(r), nm = {s: "sababsiz", dq: "sababli", k: "kasal"}, ab = r.rows.filter((x) => nm[x.st]);
    return [`📊 ${r.cls}${r.subj ? " · " + r.subj : ""} — ${r.dateTxt}, ${r.wdTxt}`, `✅ Keldi ${s.came}/${s.n} (${s.pct}%)${s.avg != null ? ` · O'rtacha baho ${KRJ.num(s.avg)}` : ""}`,
      ab.length ? `❌ Kelmadi: ${ab.map((x) => `${x.n} (${nm[x.st]})`).join(", ")}` : "🎉 Hamma keldi"].join("\n").slice(0, 1000);
  }
  const blob = (cv) => new Promise((ok, no) => cv.toBlob((b) => b ? ok(b) : no(new Error("Rasm tuzilmadi")), "image/png"));

  /* ───────── qachon: oxirgi dars vaqti tugagach yoki bugungi hamma darslarda yo'qlama qilingach ───────── */
  function state(t = todayIso()) {
    const L = lessonsToday(), ends = L.flatMap((x) => (x.slots || []).map((s) => mins(s.to))).filter((v) => v != null);
    const end = ends.length ? Math.max(...ends) : null, d = new Date(), now = d.getHours() * 60 + d.getMinutes();
    const allDone = L.length > 0 && L.every((x) => x.done), mode = cfg().mode;
    const due = L.length > 0 && (mode === "att" || end == null ? allDone : now >= end);
    return {L, end, due, allDone};
  }
  let busy = false;
  async function send(force = false) {
    if (busy || !tgOn()) return {n: 0}; busy = true;
    try {
      const t = todayIso(); let k = cfg(); if (k.day !== t) k = setCfg({day: t, sent: [], err: ""}).kr;
      const st = state(t), todo = st.L.filter((x) => x.done && (force || !k.sent.includes(ckey(x.c))));
      let n = 0;
      for (const x of todo) {
        const r = build(x.c, t, x.slots), cap = caption(r), b = await blob(KRJ.draw(r, k.th));
        const fd = new FormData(); fd.append("chat_id", tgCfg().chat); fd.append("caption", cap); fd.append("photo", b, `hisobot-${t}.png`);
        const m = await tgApi("sendPhoto", fd), g = k.grp[ckey(x.c)];
        if (g && g.id) {   // ota-onalar guruhiga: Telegram'dagi tayyor rasm (qayta yuklamasdan)
          const ph = (m.photo || []).slice(-1)[0];
          try { await tgApi("sendPhoto", ph ? {chat_id: g.id, photo: ph.file_id, caption: cap} : (() => { const f2 = new FormData(); f2.append("chat_id", g.id); f2.append("caption", cap); f2.append("photo", b, `hisobot-${t}.png`); return f2; })()); }
          catch (e) { setCfg({err: `«${g.t || g.id}» guruhiga yuborilmadi: ${e.message}`}); }
        }
        k = setCfg({sent: [...new Set(cfg().sent.concat(ckey(x.c)))], at: hmNow()}).kr; n++;
      }
      return {n, st};
    } finally { busy = false; }
  }
  // har daqiqada va ilova ochilganda: vaqti kelgan, hali yuborilmagan sinflar
  async function tick() {
    const k = cfg(); if (!k.on || !tgOn() || navigator.onLine === false || busy) return;
    const st = state(); if (!st.due) return;
    if (k.day === todayIso() && st.L.filter((x) => x.done).every((x) => k.sent.includes(ckey(x.c)))) return;
    try { const r = await send(false); if (r.n) toast(`📊 Kunlik hisobot Telegram'ga yuborildi: ${r.n} ta sinf`); }
    catch (e) { setCfg({err: tgErrTxt(e)}); console.warn("Kunlik hisobot:", e.message); }
  }

  /* ───────── Sozlamalar → Ma'lumotlar: «Kunlik hisobot» guruhi ───────── */
  function rows(row, tog) {
    if (!tgOn()) return row("kr", "📊 Kunlik hisobot rasmi", "Avval yuqoridagi «Telegram'ga avtomatik zaxira» ni ulang: hisobot rasmlari shu botga boradi.", "");
    const k = cfg(), t = todayIso(), nG = Object.keys(k.grp).filter((x) => D.classes.some((c) => ckey(c) === x)).length;
    const seg = (attr, cur, opts) => `<div class="sz-seg">${opts.map(([v, n]) => `<button class="${cur === v ? "on" : ""}" ${attr}="${v}">${n}</button>`).join("")}</div>`;
    const sentN = k.day === t ? k.sent.length : 0;
    let h = row("kr", "📊 Kunlik hisobot rasmi", "Darslar tugagach har sinf uchun alohida rasm: mavzu, uy vazifasi, davomat, har o'quvchining bahosi va izohi. Ilova o'sha kuni ochilgan bo'lishi kerak.", tog('data-kra="on"', k.on, "Kunlik hisobot rasmi"));
    if (k.on) h += row("krm", "Qachon yuborilsin", "«Darslar tugagach» — jadvaldagi oxirgi dars vaqti o'tgach; «Yo'qlama qilingach» — bugungi hamma darsda yo'qlama qilingach.", seg("data-krm", k.mode, [["end", "Darslar tugagach"], ["att", "Yo'qlama qilingach"]]), "wide") +
      row("krt", "Rasm rejimi", "", seg("data-krt", k.th, [["light", "☀️ Kunduzgi"], ["dark", "🌙 Tungi"]]));
    h += row("krg", "👪 Ota-onalar guruhlari", nG ? `${nG} ta sinfga guruh biriktirilgan. Shu sinf rasmi guruhga ham boradi.` : "Botni sinfning ota-onalar guruhiga qo'shib, shu yerda biriktiring: rasm guruhga ham boradi.", `<button class="btn btn-sm" data-kra="grp">Sozlash</button>`) +
      row("krs", "Bugungi hisobot", (sentN ? `✓ ${sentN} ta sinf yuborildi (${esc(k.at || "")})` : "Bugun hali yuborilmagan") + (k.err && k.day === t ? ` <span class="sz-warn-t">${esc(k.err)}</span>` : ""),
        `<button class="btn btn-sm" data-kra="view">👁 Ko'rish</button><button class="btn btn-sm btn-primary" data-kra="send">📤 Yuborish</button>`, "wide");
    return h;
  }
  function bind(m) {
    m.querySelectorAll("[data-krm]").forEach((b) => b.onclick = () => { setCfg({mode: b.dataset.krm}); render(); });
    m.querySelectorAll("[data-krt]").forEach((b) => b.onclick = () => { setCfg({th: b.dataset.krt}); render(); });
    m.querySelectorAll("[data-kra]").forEach((b) => b.onclick = () => act(b.dataset.kra));
  }
  async function act(a) {
    if (a === "on") { const on = !cfg().on; setCfg({on}); render(); toast(on ? "Kunlik hisobot yoqildi: darslar tugagach rasm Telegram'ga boradi" : "Kunlik hisobot o'chirildi"); if (on) tick(); }
    else if (a === "view") preview();
    else if (a === "grp") groups();
    else if (a === "send") {
      const st = state(); if (!st.L.some((x) => x.done)) { toast(st.L.length ? "Bugun hali yo'qlama qilingan dars yo'q" : "Bugun dars yo'q"); return; }
      toast("Yuborilmoqda…");
      try { const r = await send(true); render(); toast(`📊 ${r.n} ta sinf hisoboti Telegram'ga yuborildi`); } catch (e) { setCfg({err: tgErrTxt(e)}); render(); toast(tgErrTxt(e)); }
    }
  }
  function preview() {
    const t = todayIso(), L = lessonsToday().filter((x) => x.done), k = cfg();
    if (!L.length) { toast("Bugun hali yo'qlama qilingan dars yo'q — ko'rsatadigan hisobot yo'q"); return; }
    const urls = L.map((x) => KRJ.draw(build(x.c, t, x.slots), k.th).toDataURL("image/png"));
    modal(`<h2>Bugungi hisobot</h2><div class="muted">${L.length} ta sinf — Telegram'ga shu rasmlar boradi.</div>
      <div class="kr-prev">${urls.map((u, i) => `<img src="${u}" alt="${esc(label(L[i].c))} hisoboti">`).join("")}</div>
      <div class="hrow"><span class="sp"></span><button class="btn btn-primary" data-x>Yopish</button></div>`, (m, close) => { $("[data-x]", m).onclick = () => close(); });
  }
  function groups() {
    const k = cfg(), CL = D.classes.filter((c) => !isGrp(c));
    let found = [];
    const draw = (m) => {
      const opts = (cur) => `<option value="">— guruh yo'q —</option>${found.concat(Object.values(cfg().grp)).filter((g, i, a) => g && g.id && a.findIndex((x) => String(x.id) === String(g.id)) === i)
        .map((g) => `<option value="${esc(g.id)}" ${String(cur) === String(g.id) ? "selected" : ""}>${esc(g.t || g.id)}</option>`).join("")}`;
      $("#krgl", m).innerHTML = CL.map((c, i) => `<label class="kr-gr"><b>${esc(label(c))}</b><select class="form-select form-select-sm" data-krg="${i}">${opts((cfg().grp[ckey(c)] || {}).id || "")}</select></label>`).join("");
      m.querySelectorAll("[data-krg]").forEach((s) => s.onchange = () => { const g = cfg().grp, c = CL[+s.dataset.krg], v = s.value;
        if (v) g[ckey(c)] = found.concat(Object.values(g)).find((x) => String(x.id) === v); else delete g[ckey(c)]; setCfg({grp: g}); });
    };
    return modal(`<h2>Ota-onalar guruhlari</h2>
      <ol class="vcol" style="gap:6px;padding-left:20px;margin:4px 0">
        <li>Telegram'da sinfning ota-onalar guruhini oching va <b>@${esc(tgCfg().bot || "botingiz")}</b> ni guruhga a'zo qilib qo'shing.</li>
        <li>Guruhga istalgan xabar yozing, so'ng shu yerda «Guruhlarni topish» ni bosing.</li>
        <li>Har sinf yonida uning guruhini tanlang.</li></ol>
      <div class="muted">Guruhdagi hamma ota-ona butun sinf jadvalini (baholar va izohlar bilan) ko'radi.</div>
      <div id="krgl" class="vcol" style="gap:8px"></div>
      <div class="hrow"><button class="btn" data-f>🔎 Guruhlarni topish</button><span class="sp"></span><button class="btn btn-primary" data-x>Tayyor</button></div>`, (m, close) => {
      draw(m); $("[data-x]", m).onclick = () => { close(); render(); };
      $("[data-f]", m).onclick = async () => {
        try {
          const ups = await tgApi("getUpdates", {allowed_updates: ["message", "my_chat_member"]});
          const chats = ups.map((u) => (u.message || u.my_chat_member || {}).chat).filter((ch) => ch && (ch.type === "group" || ch.type === "supergroup"));
          found = chats.filter((ch, i) => chats.findIndex((x) => x.id === ch.id) === i).map((ch) => ({id: ch.id, t: ch.title || String(ch.id)}));
          draw(m); toast(found.length ? `${found.length} ta guruh topildi — sinflarga biriktiring` : "Guruh topilmadi: botni guruhga qo'shib, guruhga xabar yozing va qayta urinib ko'ring");
        } catch (e) { toast(/conflict|terminated/i.test(e.message) ? "Bu bot boshqa dasturda ishlab turibdi (kompyuterdagi bot) — guruhni topish uchun uni vaqtincha to'xtating" : tgErrTxt(e)); }
      };
    });
  }
  return {build, caption, state, send, tick, rows, bind, cfg};
})();
