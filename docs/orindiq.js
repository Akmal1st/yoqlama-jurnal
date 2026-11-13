/* O'rindiq xaritasi (maket v5, Akmal tasdiqladi 2026-11-12).
   Ma'lumot: D.web.seats[normName(sinf nomi)] = {v: 2, rows, cols, per, at: {"q-u": ism}, pin: {"q-u": 1}}
     rows — har qatordagi partalar soni (doskadan orqaga), cols — qatorlar (doskaga qarab ketgan ustunlar),
     per — partadagi o'rin (1 yoki 2); o'rin kaliti "q-u": q — parta qatori (0 = doskaga eng yaqin), u = ustun*per + o'rin.
   Bir sinfga bir necha fandan kirilsa (7-A · Matematika, 7-A · Geometriya) — xarita BITTA (sinf nomi bo'yicha).
   Eski format (ckey = "sinf|fan", cols = o'rinlar soni, har parta 2 o'rinli) birinchi ochilganda ko'chiriladi.
   Chet eldagi o'quvchi (oxirgi yo'qlama belgisi «ch») xaritada joy olmaydi.
   Ko'rinish sozlamalari: D.web.seatv = {flip, avg, real}. */
const ORX = (() => {
  const I = (n) => `<span class="bi bi-${n}" aria-hidden="true"></span>`;
  const STATES = [["s", "Sababsiz", "S", "x-circle"], ["dq", "Sababli", "DQ", "envelope-paper"], ["k", "Kasal", "K", "heart-pulse"], ["kq", "Kech qoldi", "KQ", "clock"]];
  const STC = Object.fromEntries(STATES.map((x) => [x[0], x]));
  const col = (a) => `var(--ox-${a})`;
  const parts = (n) => { const w = String(n).trim().split(/\s+/); return {fam: w[0] || "", ism: w.slice(1).join(" ") || w[0] || ""}; };
  const w = (L) => L.cols * L.per;
  const narrow = () => typeof matchMedia === "function" && matchMedia("(max-width:640px)").matches;
  const prefs = () => (D.web.seatv = Object.assign({flip: false, avg: true, real: false}, D.web.seatv));

  /* ───── ma'lumot ───── */
  const siblings = (c) => D.classes.filter((x) => !isGrp(x) && normName(x.name) === normName(c.name));
  function of(c, make) {
    const all = D.web.seats = D.web.seats || {}, k = normName(c.name);
    let L = all[k];
    if (!L) {   // eski «sinf|fan» kalitlaridan ko'chirish — eng ko'p joylashtirilgani olinadi
      const old = siblings(c).map((x) => all[ckey(x)]).filter((o) => o && o.at).sort((a, b) => Object.keys(b.at).length - Object.keys(a.at).length)[0];
      if (old) L = all[k] = {v: 2, rows: old.rows, cols: Math.max(1, Math.round((old.cols || 6) / 2)), per: 2, at: {...old.at}, pin: {}};
      if (old || make) for (const x of siblings(c)) delete all[ckey(x)];
      if (!L && make) { L = all[k] = {v: 2, rows: Math.max(3, Math.ceil(c.students.length / 6)), cols: 3, per: 2, at: {}, pin: {}}; autoFill(c, L, "alpha"); }
      if (L) save();
    }
    if (!L) return null;
    L.pin = L.pin || {}; L.per = L.per === 1 ? 1 : 2;
    // faolsizlantirilgan o'quvchi (students_off) joyi saqlanadi — qayta faollashtirilsa o'z joyiga qaytadi
    const names = new Set(siblings(c).flatMap((x) => [...x.students, ...(x.students_off || [])].map((s) => s && s.name)));
    for (const [p, n] of Object.entries(L.at)) if (!names.has(n)) { delete L.at[p]; delete L.pin[p]; }
    return L;
  }
  // chet eldagilar: barcha fanlar bo'yicha eng oxirgi yo'qlama belgisi «ch» bo'lganlar
  function awayNames(c) {
    const t = todayIso(), last = new Map();
    for (const x of siblings(c)) for (const s of x.students) for (const [d, m] of Object.entries(s.marks)) {
      if (d > t) continue; const a = attPart(m); if (!a || !ATT.includes(a)) continue;
      const o = last.get(s.name); if (!o || o[0] < d) last.set(s.name, [d, a]);
    }
    return new Set([...last].filter(([, v]) => v[1] === "ch").map(([n]) => n));
  }
  function avgMap(c) {
    const t = todayIso(), q = quarterOf(t), r = q && qRange(q), {rows} = reportRows(c, r ? r[0] : "0000-00-00", r ? r[1] : t, r ? q : null), m = new Map();
    for (const x of rows) if (x.avg != null) m.set(x.name, x.avg);   // reportRows {rows, lessons} qaytaradi
    return m;
  }
  function placeList(L, list) {
    list = [...list];
    for (let r = 0; r < L.rows && list.length; r++) for (let u = 0; u < w(L) && list.length; u++) { const p = `${r}-${u}`; if (!L.at[p]) L.at[p] = list.shift().name; }
  }
  // kuchli + kuchsiz: har partada biri kuchli, biri kuchsiz; qotirilgan sherigi bo'lsa — unga qarama-qarshisi
  function mixList(L, list, avg) {
    const g = (s) => avg.get(s.name) ?? 0, S = [...list].sort((a, b) => g(b) - g(a)), mean = S.reduce((t, s) => t + g(s), 0) / (S.length || 1);
    for (let r = 0; r < L.rows && S.length; r++) for (let d = 0; d < L.cols && S.length; d++) {
      const ps = [0, 1].map((k) => `${r}-${d * 2 + k}`), free = ps.filter((p) => !L.at[p]), mate = ps.find((p) => L.at[p]);
      if (free.length === 2) { L.at[free[0]] = S.shift().name; if (S.length) L.at[free[1]] = S.pop().name; }
      else if (free.length === 1) L.at[free[0]] = ((avg.get(L.at[mate]) ?? 0) >= mean ? S.pop() : S.shift()).name;
    }
  }
  // avtomatik joylashtirish; qotirilganlar joyida qoladi, chet eldagilar joylashtirilmaydi. Qaytaradi: {grew, left}
  function autoFill(c, L, kind) {
    const keep = {}; for (const p of Object.keys(L.pin)) if (L.at[p]) keep[p] = L.at[p]; else delete L.pin[p];
    const kept = new Set(Object.values(keep)), away = awayNames(c);
    let list = c.students.filter((s) => !away.has(s.name) && !kept.has(s.name));
    L.at = {...keep};
    if (kind === "clear") return {grew: 0, left: 0};
    const avg = avgMap(c), g = (s) => avg.get(s.name) ?? 99;
    if (kind === "rand") list = list.map((s) => [Math.random(), s]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    if (kind === "weak") list = [...list].sort((a, b) => g(a) - g(b));
    const r0 = L.rows, need = Math.ceil((list.length + kept.size) / w(L)); if (L.rows < need) L.rows = Math.min(9, need);
    if (kind === "mix" && L.per === 2) mixList(L, list, avg); else placeList(L, list);
    return {grew: L.rows - r0, left: list.length - (Object.keys(L.at).length - kept.size)};
  }
  function trim(L) {
    let n = 0;
    for (const p of Object.keys(L.at)) { const [r, u] = p.split("-").map(Number); if (r >= L.rows || u >= w(L)) { delete L.at[p]; delete L.pin[p]; n++; } }
    return n;
  }

  /* ───── xarita HTML ───── */
  function order(L, flip) {
    const rows = [...Array(L.rows).keys()], cols = [...Array(L.cols).keys()]; if (flip) { rows.reverse(); cols.reverse(); }
    return {rows, cols, seats: (d) => { const us = [...Array(L.per).keys()].map((k) => d * L.per + k); return flip ? us.reverse() : us; }};
  }
  // o: {mode: "edit"|"att", sel, avg: Map|null, att: (ism) => holat}
  function mapHtml(c, L, o) {
    const P = prefs(), cmp = narrow() && !P.real, idx = new Map(c.students.map((s, i) => [s.name, i])), ord = order(L, P.flip);
    const seat = (p) => {
      const n = L.at[p], i = n != null ? idx.get(n) : undefined;
      if (i === undefined) return `<button type="button" class="ox-seat empty" data-oxs="${p}" aria-label="Bo'sh o'rin"></button>`;
      const {fam, ism} = parts(n), a = o.att ? o.att(i) : "", av = o.avg && o.avg.get(n);
      const bdg = a && STC[a] ? `<span class="ox-bdg" style="background:${col(a)}">${STC[a][2]}</span>`
        : av != null ? `<span class="ox-bdg" style="background:${gradeColor(av) || "var(--acc)"};color:${contrast(gradeColor(av) || "#0b6f79")}">${av.toFixed(1)}</span>` : "";
      const pin = o.mode === "edit" && L.pin[p] ? `<span class="pin">${I("pin-angle-fill")}</span>` : "";
      const st = a && STC[a] ? `style="background:var(--ox-${a}-t);border-color:${col(a)}"` : "";
      const inner = cmp ? `<span class="no">${i + 1}</span><span class="nm">${esc(ism)} <i>${esc(fam.slice(0, 1))}.</i></span>${pin}${bdg}`
        : `<span class="hd"><span class="no">${i + 1}</span>${pin}${bdg || "<span></span>"}</span><span class="nm">${esc(ism)}</span><span class="fm">${esc(fam)}</span>`;
      return `<button type="button" class="ox-seat ${st ? "st" : ""} ${o.sel === p ? "sel" : ""}" data-oxs="${p}" data-oxn="${i}" ${st} title="${esc(n)}">${inner}</button>`;
    };
    let g = "";
    for (const r of ord.rows) for (const d of ord.cols) g += `<div class="ox-desk">${ord.seats(d).map((u) => seat(`${r}-${u}`)).join("")}</div>`;
    const tpl = `grid-template-columns:repeat(${L.cols},minmax(0,1fr))`, minw = narrow() && P.real ? `min-width:${w(L) * 46 + (L.cols - 1) * 8}px` : "";
    const td = `<span class="ox-tdesk">${I("person-workspace")} Stol</span>`;
    const front = `<div class="ox-front ${P.flip ? "b" : ""}">${P.flip ? "" : td}<div class="ox-board">DOSKA</div>${P.flip ? td : ""}</div>`;
    const cols = `<div class="ox-cols" style="${tpl}">${ord.cols.map((d) => `<span>${d + 1}-qator</span>`).join("")}</div>`;
    const grid = `<div class="ox-grid" style="${tpl}">${g}</div>`;
    return `<div class="ox-room"><div class="${cmp ? "ox-cmp" : ""}" style="${minw}">${P.flip ? cols + grid + front : front + cols + grid}</div></div>`;
  }
  const awayHtml = (c, away, att) => away.size ? `<div class="ox-away"><b>${I("airplane")} Chet elda (${away.size}):</b> ${[...away].filter((n) => c.students.some((s) => s.name === n)).map(esc).join(", ")} <span class="ox-hint">· ${att ? "yo'qlamada avtomatik CH" : "xaritada joy berilmaydi"}</span></div>` : "";
  function fitNames(root) {
    root.querySelectorAll(".ox-seat .nm").forEach((el) => { let f = parseFloat(getComputedStyle(el).fontSize); while (el.scrollWidth > el.clientWidth + 0.5 && f > 9) { f -= 0.5; el.style.fontSize = f + "px"; } });
  }

  /* ───── sudrash: sichqoncha — darhol, barmoq — 250 ms bosib turgandan keyin ───── */
  let drag = null;
  const tm = (e) => { if (drag) e.preventDefault(); };
  function dragMove(e) {
    if (!drag) return; drag.g.style.left = e.clientX + "px"; drag.g.style.top = e.clientY + "px";
    const el = document.elementFromPoint(e.clientX, e.clientY), t = el && (el.closest("[data-oxs]") || el.closest("[data-oxpool]"));
    if (drag.over && drag.over !== t) drag.over.classList.remove("over");
    if (t) t.classList.add("over"); drag.over = t;
  }
  function dragable(el, label, onDrop, onTap) {
    el.addEventListener("pointerdown", (e) => {
      if (e.button > 0) return;
      const x0 = e.clientX, y0 = e.clientY, touch = e.pointerType !== "mouse"; let started = false, dead = false, timer = null;
      const start = (ev) => {
        started = true; const g = document.createElement("div"); g.className = "ox-ghost"; g.textContent = label; document.body.append(g);
        drag = {g, over: null}; document.body.classList.add("ox-drag"); document.addEventListener("touchmove", tm, {passive: false}); dragMove(ev);
        if (navigator.vibrate) try { navigator.vibrate(15); } catch (_) { /* yo'q */ }
      };
      const stop = () => { if (!drag) return null; const o = drag.over; drag.g.remove(); if (o) o.classList.remove("over"); drag = null; document.body.classList.remove("ox-drag"); document.removeEventListener("touchmove", tm); return o; };
      if (touch) timer = setTimeout(() => { if (!dead) start({clientX: x0, clientY: y0}); }, 250);
      const off = () => { clearTimeout(timer); removeEventListener("pointermove", mv); removeEventListener("pointerup", up); removeEventListener("pointercancel", cc); };
      const mv = (ev) => { if (started) return dragMove(ev); if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 6) { if (touch) { dead = true; clearTimeout(timer); } else start(ev); } };
      const up = () => { off(); if (started) { const o = stop(); if (o) onDrop(o.dataset.oxpool !== undefined ? null : o.dataset.oxs); } else if (!dead) onTap(); };
      const cc = () => { off(); dead = true; stop(); };
      addEventListener("pointermove", mv); addEventListener("pointerup", up); addEventListener("pointercancel", cc);
    });
    el.addEventListener("contextmenu", (e) => { if (e.pointerType !== "mouse") e.preventDefault(); });
  }

  /* ───── tahrirlash oynasi ───── */
  function editor(ci) {
    const c = D.classes[ci], L = of(c, true), hist = []; let sel = null;   // sel: "q-u" yoki "n:ism"
    const snap = () => { hist.push(JSON.stringify({at: L.at, pin: L.pin, rows: L.rows, cols: L.cols, per: L.per})); if (hist.length > 40) hist.shift(); };
    const subs = siblings(c).map((x) => x.subject).filter(Boolean);
    return modal(`<div class="ox-ed" id="oxed"></div>`, (m, close) => {
      const box = $("#oxed", m);
      const draw = () => {
        const P = prefs(), N = narrow(), away = awayNames(c), live = c.students.filter((s) => !away.has(s.name));
        const placed = new Set(Object.values(L.at)), free = live.filter((s) => !placed.has(s.name)), cap = L.rows * w(L), need = live.length;
        const selN = sel && (sel.startsWith("n:") ? sel.slice(2) : L.at[sel]);
        box.innerHTML = `
          <div class="ox-top"><h2>${I("grid-3x3-gap")} ${esc(c.name)} o'rindiq xaritasi<small>${subs.length > 1 ? `${subs.map(esc).join(" va ")} · bitta xarita` : esc(subs[0] || "")}</small></h2>
            <button type="button" class="btn ox-ic" data-oxundo ${hist.length ? "" : "disabled"} title="Orqaga (oxirgi o'zgarishni bekor qilish)">${I("arrow-counterclockwise")}</button>
            <button type="button" class="btn ${N ? "ox-ic" : ""}" data-oxrep title="Hisobot: chop etish, PDF, Telegram">${I("box-arrow-up")}${N ? "" : " Hisobot"}</button>
            <button type="button" class="btn btn-primary" data-x>Tayyor</button></div>
          <div class="ox-bar ox-scroll">
            <button type="button" class="btn btn-primary" data-oxsh="auto" title="Avtomatik joylashtirish">${I("magic")} Joylashtirish</button>
            <button type="button" class="btn" data-oxsh="struct" title="Sinf xonasi: qatorlar va partalar">${I("grid-3x2-gap")} ${N ? `${L.cols} × ${L.rows}` : `${L.cols} qator × ${L.rows} parta`}${cap < need ? ` <span class="ox-warn">${I("exclamation-triangle-fill")}</span>` : ""}</button>
            <button type="button" class="btn" data-oxsh="view" title="Ko'rinish">${I("eye")}${N ? "" : ` ${P.flip ? "O'qituvchi" : "O'quvchi"} nigohi`}</button>
            ${N ? "" : `<span class="ox-cap ${cap < need ? "bad" : ""}">O'rinlar: ${cap} / O'quvchilar: ${need}</span>`}</div>
          <div class="ox-hint">${N ? "Bosib turib sudrang yoki bosing → yangi joyini bosing." : "O'quvchini sudrab boshqa joyga olib boring yoki bosing → yangi joyini bosing. Band joyga qo'ysangiz, o'rin almashadi."}</div>
          ${mapHtml(c, L, {mode: "edit", sel: sel && !sel.startsWith("n:") ? sel : null, avg: P.avg && !(N && !P.real) ? avgMap(c) : null})}
          ${awayHtml(c, away, false)}
          <div class="ox-pool" data-oxpool><span class="lbl">Joylashmaganlar (${free.length}):</span>${free.map((s) => `<button type="button" class="ox-chip ${sel === "n:" + s.name ? "sel" : ""}" data-oxchip="${esc(s.name)}">${esc(s.name)}</button>`).join("") || `<span class="ox-hint">hamma joylashgan ✓</span>`}</div>
          ${selN ? `<div class="ox-sel"><b>${esc(selN)}</b><span class="ox-hint">→ joyini bosing</span><span class="sp" style="flex:1"></span>
            ${!sel.startsWith("n:") ? `<button type="button" class="btn btn-sm" data-oxpin title="Avtomatik joylashtirishda joyidan qo'zg'almasin">${L.pin[sel] ? I("pin-angle-fill") + " Bo'shatish" : I("pin-angle") + " Qotirish"}</button><button type="button" class="btn btn-sm ox-ic" data-unseat title="Xaritadan olib tashlash">${I("x-circle")}</button>` : ""}
            <button type="button" class="btn btn-sm ox-ic" data-oxcancel title="Bekor qilish">${I("x-lg")}</button></div>` : ""}`;
        fitNames(box); bind();
      };
      const place = (from, target) => {   // from: "q-u" | "n:ism"; target: "q-u" | null (xaritadan olish)
        const fp = from.startsWith("n:") ? null : from, who = fp ? L.at[fp] : from.slice(2);
        if (fp === target || !who) { sel = null; return draw(); }
        snap();
        if (target === null) { if (fp) { delete L.at[fp]; delete L.pin[fp]; } }
        else {
          const live = c.students.some((s) => s.name === L.at[target]), other = live ? L.at[target] : null, op = live && L.pin[target], pinned = fp && L.pin[fp];   // faolsiz o'quvchi joyi — bo'sh hisoblanadi
          L.at[target] = who; delete L.pin[target]; if (pinned) L.pin[target] = 1;
          if (fp) { delete L.pin[fp]; if (other) { L.at[fp] = other; if (op) L.pin[fp] = 1; } else delete L.at[fp]; }
        }
        sel = null; save(); draw();
      };
      const shrunk = (n) => { if (n) toast(`${n} o'quvchi «Joylashmaganlar»ga o'tdi · ↶ bilan qaytarish mumkin`); };
      const sheet = (kind) => {
        const P = prefs(), away = awayNames(c), need = c.students.filter((s) => !away.has(s.name)).length;
        if (kind === "auto") return modal(`<div class="ox-sh"><h2>${I("magic")} Avtomatik joylashtirish</h2>
            ${[["alpha", "sort-alpha-down", "Alifbo bo'yicha", "Ro'yxat tartibida, doskadan boshlab"], ["rand", "shuffle", "Tasodifiy aralashtirish", "Har safar yangi joylashuv"],
              ...(L.per === 2 ? [["mix", "people", "Kuchli + kuchsiz yonma-yon", "Har partada biri kuchli, biri kuchsiz (o'rtacha baho bo'yicha)"]] : []),
              ["weak", "arrow-up-circle", "Past baholilar oldinga", "Yordam kerak bo'lganlar doskaga yaqin"], ["clear", "eraser", "Tozalash", "Qotirilganlardan boshqa hammasini olish"]]
              .map(([k, ic, b, s]) => `<button type="button" class="ox-opt" data-oxauto="${k}">${I(ic)}<span><b>${b}</b><span>${s}</span></span></button>`).join("")}
            <div class="ox-hint">${I("pin-angle-fill")} Qotirilgan o'quvchilar joyidan qo'zg'almaydi. Chet eldagilar joylashtirilmaydi.</div></div>`, (sm, cl) => {
          sm.querySelectorAll("[data-oxauto]").forEach((b) => b.onclick = () => {
            snap(); const r = autoFill(c, L, b.dataset.oxauto); sel = null; save(); cl(); draw();
            if (r.left > 0) toast(`${r.left} o'quvchiga joy yetmadi · «Sinf xonasi»da parta qo'shing`);
            else if (r.grew > 0) toast(`Joy yetmadi: har qatorga ${r.grew} ta parta qo'shildi`);
          });
        });
        if (kind === "struct") return modal(`<div class="ox-sh"><h2>${I("grid-3x2-gap")} Sinf xonasi</h2><div id="oxst"></div></div>`, (sm, cl) => {
          const body = () => {
            const cap = L.rows * w(L);
            $("#oxst", sm).innerHTML = `
              <div class="ox-row"><span><b>Qatorlar</b><br><span class="ox-hint">doskaga qarab ketgan ustunlar</span></span><div class="seg">${[2, 3, 4].map((k) => `<button type="button" class="${k === L.cols ? "on" : ""}" data-oxcols="${k}">${k}</button>`).join("")}</div></div>
              <div class="ox-row"><span><b>Har qatorda parta</b></span><span class="ox-step"><button type="button" data-oxrows="-1" aria-label="Kamaytirish">−</button><b>${L.rows}</b><button type="button" data-oxrows="1" aria-label="Ko'paytirish">+</button></span></div>
              <div class="ox-row"><span><b>Partada o'rin</b></span><div class="seg">${[1, 2].map((k) => `<button type="button" class="${k === L.per ? "on" : ""}" data-oxper="${k}">${k}</button>`).join("")}</div></div>
              <div class="ox-row"><span class="ox-cap ${cap < need ? "bad" : ""}">O'rinlar: ${cap} / O'quvchilar: ${need}</span><button type="button" class="btn btn-primary" data-oxok>Tayyor</button></div>`;
            const ch = (f) => { snap(); f(); shrunk(trim(L)); save(); body(); draw(); };
            sm.querySelectorAll("[data-oxcols]").forEach((b) => b.onclick = () => ch(() => { L.cols = +b.dataset.oxcols; }));
            sm.querySelectorAll("[data-oxper]").forEach((b) => b.onclick = () => ch(() => { L.per = +b.dataset.oxper; }));
            sm.querySelectorAll("[data-oxrows]").forEach((b) => b.onclick = () => { const v = Math.max(1, Math.min(9, L.rows + +b.dataset.oxrows)); if (v !== L.rows) ch(() => { L.rows = v; }); });
            $("[data-oxok]", sm).onclick = () => cl();
          };
          body();
        });
        return modal(`<div class="ox-sh"><h2>${I("eye")} Ko'rinish</h2><div id="oxvw"></div></div>`, (sm) => {
          const body = () => {
            const N = narrow();
            $("#oxvw", sm).innerHTML = `
              <button type="button" class="ox-opt" data-oxflip="0">${I("person")}<span><b>O'quvchi nigohi ${P.flip ? "" : I("check2")}</b><span>Doska tepada</span></span></button>
              <button type="button" class="ox-opt" data-oxflip="1">${I("person-workspace")}<span><b>O'qituvchi nigohi ${P.flip ? I("check2") : ""}</b><span>Doska pastda, stoldan qaraganday</span></span></button>
              <button type="button" class="ox-opt" data-oxavg>${I("123")}<span><b>O'rtacha baho ${P.avg ? I("check2") : ""}</b><span>Har o'rinda joriy chorak o'rtachasi${N && !P.real ? " (haqiqiy partalar ko'rinishida)" : ""}</span></span></button>
              ${N ? `<button type="button" class="ox-opt" data-oxreal>${I("layout-split")}<span><b>Haqiqiy partalar ko'rinishi ${P.real ? I("check2") : ""}</b><span>O'rinlar yonma-yon (ism qisqaradi)</span></span></button>` : ""}`;
            sm.querySelectorAll("[data-oxflip]").forEach((b) => b.onclick = () => { P.flip = b.dataset.oxflip === "1"; save(); body(); draw(); });
            $("[data-oxavg]", sm).onclick = () => { P.avg = !P.avg; save(); body(); draw(); };
            const r = $("[data-oxreal]", sm); if (r) r.onclick = () => { P.real = !P.real; save(); body(); draw(); };
          };
          body();
        });
      };
      const bind = () => {
        box.querySelectorAll("[data-oxs]").forEach((b) => {
          const p = b.dataset.oxs, n = b.dataset.oxn != null ? L.at[p] : null;
          const tap = () => { if (!sel) { if (n) { sel = p; draw(); } } else if (sel === p) { sel = null; draw(); } else place(sel, p); };
          if (n) dragable(b, parts(n).ism, (t) => place(p, t), tap); else b.onclick = tap;
        });
        box.querySelectorAll("[data-oxchip]").forEach((b) => { const k = "n:" + b.dataset.oxchip; dragable(b, parts(b.dataset.oxchip).ism, (t) => { if (t) place(k, t); }, () => { sel = sel === k ? null : k; draw(); }); });
        box.querySelectorAll("[data-oxsh]").forEach((b) => b.onclick = () => sheet(b.dataset.oxsh));
        $("[data-oxundo]", box).onclick = () => { const h = hist.pop(); if (!h) return; Object.assign(L, JSON.parse(h)); sel = null; save(); draw(); };
        $("[data-oxrep]", box).onclick = () => report(c);
        $("[data-x]", box).onclick = () => { close(); render(); };
        const pin = $("[data-oxpin]", box); if (pin) pin.onclick = () => { snap(); if (L.pin[sel]) delete L.pin[sel]; else L.pin[sel] = 1; sel = null; save(); draw(); };
        const un = $("[data-unseat]", box); if (un) un.onclick = () => place(sel, null);
        const cn = $("[data-oxcancel]", box); if (cn) cn.onclick = () => { sel = null; draw(); };
      };
      draw();
    });
  }

  /* ───── darsda: xaritadan yo'qlama (avval holat, keyin joy) ───── */
  let brush = "s";
  // chet eldagilarga bugun belgi bo'lmasa — avtomatik CH
  function autoCh(c) {
    const t = todayIso(), away = awayNames(c); let n = 0;
    c.students.forEach((s, si) => { if (away.has(s.name) && !(s.marks[t] || "") && putMark(c, si, t, "ch", true)) n++; });
    return n;
  }
  function attHtml(c) {
    const L = of(c), away = awayNames(c);
    if (!L || !Object.keys(L.at).length) return `<div class="card vcol" style="gap:10px;align-items:flex-start"><b>Bu sinf uchun o'rindiq xaritasi hali tuzilmagan</b><div class="muted">Bir marta partalar bo'yicha joylashtiring — keyin yo'qlamani xaritadan bosib qilasiz.${siblings(c).length > 1 ? " Xarita sinfning barcha fanlari uchun bitta." : ""}</div><button class="btn btn-primary" data-seats>🪑 Xaritani tuzish</button></div>`;
    const cnt = {}; c.students.forEach((_, i) => { const a = attOf(c, i); if (a) cnt[a] = (cnt[a] || 0) + 1; });
    const placed = new Set(Object.values(L.at)), free = c.students.map((s, i) => [s, i]).filter(([s]) => !placed.has(s.name) && !away.has(s.name));
    return `<div class="lbl" style="font-size:12.5px;font-weight:700;color:var(--ox-mut);margin:6px 0 5px">Holatni tanlang, so'ng kelmaganlarning joyini bosing (yana bossangiz — «Keldi»):</div>
      <div class="ox-brush">${STATES.map(([k, nm, , ic]) => `<button type="button" class="${brush === k ? "on" : ""}" style="background:${col(k)}" data-oxbr="${k}">${I(ic)}${nm}<i>${cnt[k] || 0}</i></button>`).join("")}</div>
      <div style="margin-top:8px">${mapHtml(c, L, {mode: "att", att: (i) => { const a = attOf(c, i); return a === "ch" ? "" : a; }})}</div>
      ${awayHtml(c, away, true)}
      ${free.length ? `<div class="ox-pool" style="margin-top:8px"><span class="lbl">Xaritada yo'q:</span>${free.map(([s, i]) => { const a = attOf(c, i); return `<button type="button" class="ox-chip" data-satt="${i}" ${a && STC[a] ? `style="background:var(--ox-${a}-t);border:2px solid ${col(a)}"` : ""}>${esc(s.name)}${a && STC[a] ? ` · ${STC[a][2]}` : ""}</button>`; }).join("")}</div>` : ""}`;
  }
  // set(si, v): o'quvchiga holat qo'yish (v = "" — keldi)
  function attBind(m, c, set) {
    m.querySelectorAll("[data-oxbr]").forEach((b) => b.onclick = () => { brush = b.dataset.oxbr; m.querySelectorAll("[data-oxbr]").forEach((x) => x.classList.toggle("on", x === b)); });
    const tog = (si) => set(si, attOf(c, si) === brush ? "" : brush);
    m.querySelectorAll(".ox-room [data-oxn]").forEach((b) => b.onclick = () => tog(+b.dataset.oxn));
    m.querySelectorAll("[data-satt]").forEach((b) => b.onclick = () => tog(+b.dataset.satt));
    const room = $(".ox-room", m); if (room) fitNames(room);
  }

  /* ───── hisobot: A4 albom varaq, chop etish / PDF / Telegram ───── */
  function pageHtml(c, o) {
    const L = of(c), idx = new Map(c.students.map((s, i) => [s.name, i])), F = o.flip, ord = order(L, F), away = [...awayNames(c)].filter((n) => idx.has(n));
    const avg = o.avg ? avgMap(c) : null, placed = Object.values(L.at).filter((n) => idx.has(n)).length, empty = L.rows * w(L) - placed;
    const unplaced = c.students.length - away.length - placed, subs = siblings(c).map((x) => x.subject).filter(Boolean);
    let g = "";
    for (const r of ord.rows) for (const d of ord.cols) g += `<div class="oxp-d">${d === ord.cols[0] ? `<span class="oxp-dn">${r + 1}</span>` : ""}${ord.seats(d).map((u) => {
      const n = L.at[`${r}-${u}`], i = n != null ? idx.get(n) : undefined;
      if (i === undefined) return `<div class="oxp-s e"><span class="oxp-n">–</span></div>`;
      const {fam, ism} = parts(n), a = avg && avg.get(n);
      return `<div class="oxp-s"><span class="oxp-n">${i + 1}</span><span class="oxp-nm"><b>${esc(fam)}</b><span>${esc(ism)}</span></span>${a != null ? `<span class="oxp-a">${a.toFixed(1)}</span>` : ""}</div>`;
    }).join("")}</div>`;
    const tpl = `grid-template-columns:repeat(${L.cols},minmax(0,1fr))`;
    const front = `<div class="oxp-f ${F ? "b" : ""}">${F ? "" : `<div class="oxp-td">O'QITUVCHI STOLI</div>`}<div class="oxp-board">DOSKA</div>${F ? `<div class="oxp-td">O'QITUVCHI STOLI</div>` : ""}</div>`;
    const cols = `<div class="oxp-cols ${F ? "b" : ""}" style="${tpl}">${ord.cols.map((d) => `<span>${d + 1}-qator</span>`).join("")}</div>`;
    const grid = `<div class="oxp-g" style="${tpl};grid-template-rows:repeat(${L.rows},1fr)">${g}</div>`;
    const t = todayIso(), y = +t.slice(0, 4), sy = +t.slice(5, 7) >= 8 ? `${y}–${y + 1}` : `${y - 1}–${y}`;
    return `<div class="bx-pg bx-land oxp ${L.rows <= 4 ? "big" : ""}">
      <div class="oxp-h"><div><div class="oxp-t">O'RINDIQ XARITASI</div><div class="oxp-c"><b>${esc(c.name)} sinf</b>${subs.length ? ` · ${subs.map(esc).join(", ")}` : ""}</div></div>
        <div class="oxp-r">O'qituvchi: ${esc(((D.web.bsb_hdr || {}).teacher || "").trim()) || "______________________"}<br>${sy} o'quv yili · ${fmt(t)}</div></div>
      ${F ? grid + cols + front : front + cols + grid}
      <div class="oxp-ft"><div>Jami: <b>${c.students.length}</b> o'quvchi · joylashgan: <b>${placed}</b> · bo'sh o'rin: <b>${Math.max(0, empty)}</b>${unplaced > 0 ? ` · <b>joy berilmagan: ${unplaced}</b>` : ""}${away.length ? `<br>Chet elda (joy berilmagan): ${away.map(esc).join(", ")}` : ""}${F ? "<br>Ko'rinish: o'qituvchi stolidan" : ""}</div>
        <div class="oxp-sig">O'qituvchi imzosi: ______________</div></div></div>`;
  }
  const fileOf = (c) => `Orindiq_xaritasi_${c.name}`.replace(/[^\p{L}\p{N}'ʻʼ‘’_-]+/gu, "_");
  function doPrint(html, name) {
    let el = document.getElementById("pdoc"); if (!el) { el = document.createElement("div"); el.id = "pdoc"; document.body.append(el); }
    el.className = "bx-print"; el.innerHTML = html; document.body.classList.add("pdoc");
    let st = document.getElementById("pdoc-css"); if (!st) { st = document.createElement("style"); st.id = "pdoc-css"; document.head.append(st); }
    st.textContent = "@media print{@page{size:A4 landscape;margin:0}}";
    const old = document.title, back = () => { document.title = old; window.removeEventListener("afterprint", back); el.className = ""; };
    document.title = name; window.addEventListener("afterprint", back); setTimeout(() => { document.title = old; }, 120000);
    window.print();
  }
  async function savePdf(html, name, btn) {
    const t0 = btn && btn.innerHTML; if (btn) { btn.disabled = true; btn.textContent = "PDF…"; }
    try {
      toast("PDF tayyorlanmoqda…");
      const blob = await PTG.pagesPdf([html], true), a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = name + ".pdf"; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      toast("PDF saqlandi");
    } catch (e) { console.warn("O'rindiq PDF:", e); toast(`PDF tayyorlanmadi: ${e.message}`); }
    finally { if (btn) { btn.disabled = false; btn.innerHTML = t0; } }
  }
  function report(c) {
    if (!of(c)) { toast("Avval xaritani tuzing"); return; }
    const o = {flip: prefs().flip, avg: false};
    return modal(`<div class="ox-pdlg vcol" style="gap:10px"><h2>${I("file-earmark-text")} O'rindiq xaritasi · ${esc(c.name)}</h2>
      <div class="hrow wrap" style="gap:8px"><div class="seg" id="oxpf"></div><button type="button" class="btn btn-sm" data-oxpa></button><span class="ox-hint" id="oxpw"></span></div>
      <div class="ox-pvw"><div class="ox-pv"></div></div>
      <div class="ox-hint">A4 albom · oq-qora printerga mos</div>
      <div class="hrow wrap" style="gap:8px"><button class="btn" type="button" data-x>Yopish</button><span class="sp"></span>
        <button class="btn" type="button" data-oxpdf title="A4 PDF faylni saqlash">${I("file-earmark-pdf")} PDF</button>
        <button class="btn" type="button" data-oxtg title="PDF qilib Telegram botingizga yuborish">${I("telegram")} Telegram</button>
        <button class="btn btn-primary" type="button" data-oxpr>${I("printer")} Chop etish</button></div></div>`, (m, close) => {
      const pv = $(".ox-pv", m), box = $(".ox-pvw", m);
      const draw = () => {
        $("#oxpf", m).innerHTML = `<button type="button" class="${o.flip ? "" : "on"}" data-oxpf="0">O'quvchi nigohi</button><button type="button" class="${o.flip ? "on" : ""}" data-oxpf="1">O'qituvchi nigohi</button>`;
        $("[data-oxpa]", m).innerHTML = o.avg ? `${I("check2")} O'rtacha baho` : `${I("123")} O'rtacha bahoni qo'shish`;
        $("#oxpw", m).textContent = o.avg ? "Baholi varaqni sinfga osmang: faqat o'zingiz uchun" : "";
        pv.innerHTML = pageHtml(c, o); const k = Math.min(1, Math.max(240, box.clientWidth - 8) / 1123);
        pv.style.transform = `scale(${k})`; box.style.height = 791 * k + 8 + "px";
        m.querySelectorAll("[data-oxpf]").forEach((b) => b.onclick = () => { o.flip = b.dataset.oxpf === "1"; draw(); });
      };
      requestAnimationFrame(() => requestAnimationFrame(draw));
      $("[data-oxpa]", m).onclick = () => { o.avg = !o.avg; draw(); };
      $("[data-x]", m).onclick = () => close();
      $("[data-oxpr]", m).onclick = () => doPrint(pageHtml(c, o), fileOf(c));
      $("[data-oxpdf]", m).onclick = (e) => savePdf(pageHtml(c, o), fileOf(c), e.currentTarget);
      $("[data-oxtg]", m).onclick = (e) => PTG.run(() => PTG.pagesPdf([pageHtml(c, o)], true), fileOf(c), `🪑 O'rindiq xaritasi\n${c.name} sinf · ${fmt(todayIso())}`, e.currentTarget);
    });
  }

  /* ───── Hisobotlar → «Chop etish uchun» → O'rindiq xaritasi (hisobotlar.js) ───── */
  const ho = {flip: false, avg: false};
  function hbBody(c) {
    if (!of(c)) return `<div class="hb-box vcol" style="gap:10px;align-items:flex-start"><b>${esc(c.name)} sinfi uchun o'rindiq xaritasi hali tuzilmagan</b><span class="hb-mut">Xarita sinfning barcha fanlari uchun bitta. Bir marta tuzing — keyin chop etish, PDF va Telegram shu yerda.</span><button class="btn btn-primary" data-oxhed>${I("grid-3x3-gap")} Xaritani tuzish</button></div>`;
    return `<div class="hrow wrap" style="gap:8px;margin-bottom:8px"><div class="seg"><button type="button" class="${ho.flip ? "" : "on"}" data-oxhf="0">O'quvchi nigohi</button><button type="button" class="${ho.flip ? "on" : ""}" data-oxhf="1">O'qituvchi nigohi</button></div>
        <button type="button" class="btn btn-sm" data-oxha>${ho.avg ? `${I("check2")} O'rtacha baho` : `${I("123")} O'rtacha bahoni qo'shish`}</button>
        <button type="button" class="btn btn-sm" data-oxhed>${I("pencil-square")} Xaritani tahrirlash</button>${ho.avg ? `<span class="ox-hint">Baholi varaqni sinfga osmang: faqat o'zingiz uchun</span>` : ""}</div>
      <div class="ox-pvw"><div class="ox-pv" data-oxhpv>${pageHtml(c, ho)}</div></div>`;
  }
  function hbBind(m, c) {
    const pv = $("[data-oxhpv]", m), box = pv && pv.parentElement;
    const fit = () => { if (!pv || !box.isConnected) return; const k = Math.min(1, Math.max(240, box.clientWidth - 8) / 1123); pv.style.transform = `scale(${k})`; box.style.height = 791 * k + 8 + "px"; };
    requestAnimationFrame(fit);
    m.querySelectorAll("[data-oxhf]").forEach((b) => b.onclick = () => { ho.flip = b.dataset.oxhf === "1"; render(); });
    m.querySelectorAll("[data-oxha]").forEach((b) => b.onclick = () => { ho.avg = !ho.avg; render(); });
    m.querySelectorAll("[data-oxhed]").forEach((b) => b.onclick = () => editor(D.classes.indexOf(c)));
    m.querySelectorAll("[data-print]").forEach((b) => b.onclick = () => { if (of(c)) doPrint(pageHtml(c, ho), fileOf(c)); else toast("Avval xaritani tuzing"); });
    m.querySelectorAll("[data-oxpdf]").forEach((b) => b.onclick = () => { if (of(c)) savePdf(pageHtml(c, ho), fileOf(c), b); else toast("Avval xaritani tuzing"); });
    m.querySelectorAll("[data-tgpdf]").forEach((b) => b.onclick = () => { if (!of(c)) return toast("Avval xaritani tuzing"); PTG.run(() => PTG.pagesPdf([pageHtml(c, ho)], true), fileOf(c), `🪑 O'rindiq xaritasi\n${c.name} sinf · ${fmt(todayIso())}`, b); });
  }

  return {of, editor, report, attHtml, attBind, autoCh, awayNames, autoFill, pageHtml, hbBody, hbBind};
})();
