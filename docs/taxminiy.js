/* BSB tahlili: «Taxminiy ball» — tasdiqlangan maket v2 (Akmal, 2026-11-07).
   BSB / CHSB sahifasidagi (eMaktabdan import qilingan) jami ball o'qituvchi kiritgan savol ballari (maksimallari) bo'yicha
   bo'lib chiqiladi: har katak 0..maksimal, qator yig'indisi aynan eMaktab baliga teng.
   Holat faqat xotirada (B.tx): {wid, mode, est: {ism: [bool]}, undo}. Saqlangan tahlilga faqat ballar yoziladi.
   Asosiy skriptdan oldin ulanadi; ichidagi funksiyalar faqat chaqirilganda index.html dagi umumiy funksiyalardan foydalanadi. */
const TXB = (() => {
  // o'quvchi ismidan barqaror tasodifiy sonlar (bir xil ma'lumotda natija har safar bir xil chiqadi)
  function rng(seed) {
    let h = 2166136261;
    for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const stepOf = (vals) => { for (const s of [1, 0.5, 0.1, 0.01]) if (vals.every((v) => Math.abs(v / s - Math.round(v / s)) < 1e-6)) return s; return 0.01; };
  /* T ni max[] bo'yicha taqsimlaydi. mode: "tabiiy" (oldingi savollar osonroq + o'quvchiga xos farq) | "teng".
     fixed[i] != null — o'sha katak o'zgarmaydi (qo'lda yozilgan). Imkonsiz bo'lsa null. */
  function spread(T, max, mode, seed, fixed) {
    const q = max.length, fx = fixed || [], free = max.map((_, i) => fx[i] == null);
    const T0 = T - fx.reduce((a, v) => a + (v == null ? 0 : +v), 0), cap = max.map((m, i) => free[i] ? +m : 0), capT = cap.reduce((a, b) => a + b, 0);
    if (!(T0 >= -1e-9) || T0 > capT + 1e-9) return null;
    const f = capT ? T0 / capT : 0, r = rng(seed || "x");
    const w = max.map((m, i) => {
      if (!free[i]) return 0;
      if (mode === "teng") return +m;
      const d = q > 1 ? i / (q - 1) : 0.5, a = Math.exp(1.1 * (d - 0.5) + 0.45 * (r() - 0.5));
      return m * Math.pow(Math.min(Math.max(f, 0.02), 0.98), a);
    });
    const sumAt = (l) => w.reduce((s, x, i) => s + Math.min(cap[i], x * l), 0);
    let lo = 0, hi = 1;
    while (sumAt(hi) < T0 - 1e-9 && hi < 1e9) hi *= 2;
    for (let k = 0; k < 80; k++) { const mid = (lo + hi) / 2; if (sumAt(mid) < T0) lo = mid; else hi = mid; }
    const x = w.map((v, i) => Math.min(cap[i], v * hi));
    const st = stepOf([Math.max(T0, 0), ...cap]), U = Math.round(Math.max(T0, 0) / st), top = cap.map((c) => Math.round(c / st));
    const fl = x.map((v, i) => Math.min(Math.floor(v / st + 1e-9), top[i]));
    let left = U - fl.reduce((a, b) => a + b, 0);
    const ord = x.map((v, i) => [v / st - fl[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    while (left > 0) { let moved = false; for (const [, i] of ord) if (left > 0 && fl[i] < top[i]) { fl[i]++; left--; moved = true; } if (!moved) break; }
    return max.map((_, i) => free[i] ? Math.round(fl[i] * st * 100) / 100 : fx[i]);
  }

  const sum = (a) => (a || []).reduce((s, v) => s + (+v || 0), 0);
  const filled = (r) => !!r && (r.pts || []).some((v) => v !== null && v !== undefined && v !== "");
  const works = (c) => (c.works || []).filter((w) => w.type === "bsb" || w.type === "chsb").sort((a, b) => a.date < b.date ? -1 : 1);
  const scoreOf = (s, w) => { const v = (s.scores || {})[w.id]; return isNum(v) ? v : null; };
  const wLabel = (w) => `${w.type.toUpperCase()} · ${fmt(w.date)} · maks. ${fmtNum(w.max)}${w.title ? " · " + w.title : ""}`;
  // tahlilga mos ish: avval tanlangani, keyin tahlil bog'langan ish, keyin shu sanadagi ish
  function src(c, B) {
    const L = works(c); if (!L.length) return null;
    const by = (id) => id && L.find((w) => w.id === id);
    const saved = B.id && (c.analyses || []).find((a) => a.id === B.id);
    return by(B.tx && B.tx.wid) || by(saved && saved.w) || L.find((w) => w.date === B.date) || null;
  }
  // eMaktab bali tahlil maksimaliga keltiriladi (maksimallar farq qilsa — proporsional, 0,5 gacha)
  function target(c, B, s, w) {
    const v = w && scoreOf(s, w); if (v === null || v === undefined || v === false) return null;
    const tot = sum(B.max); if (!(tot > 0) || !(w.max > 0)) return null;
    return Math.abs(w.max - tot) < 1e-9 ? v : Math.min(tot, Math.round(v * tot / w.max * 2) / 2);
  }
  const isEst = (B, name, i) => !!(B.tx && B.tx.est[name] && B.tx.est[name][i]);
  const cls = (B, name, i) => isEst(B, name, i) ? " tx-est" : B.tx && B.tx.man && B.tx.man[name] && B.tx.man[name][i] ? " tx-man" : "";
  // qo'lda o'zgartirilgan katak (i yo'q — butun qator)
  function touch(B, name, i) {
    if (!B.tx) return;
    const e = B.tx.est[name]; if (!e || !e.some(Boolean)) return;
    const m = B.tx.man[name] = B.tx.man[name] || [];
    if (i === undefined) { e.forEach((v, k) => { if (v) m[k] = true; }); B.tx.est[name] = []; }
    else if (e[i]) { e[i] = false; m[i] = true; }
  }

  /* jadval: «eMaktab» ustuni «Jami» oldida */
  const head = (c, B) => { const w = src(c, B); return w ? `<th class="tx-h" title="BSB / CHSB sahifasidagi (eMaktabdan import qilingan) jami ball">eMaktab<small>${w.type.toUpperCase()}</small></th>` : ""; };
  const mxCell = (c, B) => src(c, B) ? `<td></td>` : "";
  const cell = (c, B) => src(c, B) ? `<td class="s" data-em></td>` : "";
  function paint(c, B, s, tr, total) {
    const td = tr && tr.querySelector("[data-em]"); if (!td) return;
    const w = src(c, B), r = baRow(B, s.name), raw = w && scoreOf(s, w), T = target(c, B, s, w);
    if (raw === null || raw === undefined) { td.innerHTML = `<span class="tx-em na">—</span>`; return; }
    if (r.in === false || !filled(r)) { td.innerHTML = `<span class="tx-em na">${esc(fmtNum(raw))}</span>`; return; }
    const d = Math.round((total - T) * 100) / 100;
    td.innerHTML = Math.abs(d) < 1e-6 ? `<span class="tx-em ok" title="Jami eMaktab bali bilan mos">✓ ${esc(fmtNum(raw))}</span>`
      : `<span class="tx-em no" title="Jami ${gnum(total)}, eMaktab bo'yicha ${gnum(T)}">${d > 0 ? "+" : "−"}${gnum(Math.abs(d))} · ${esc(fmtNum(raw))}</span>`;
  }
  const rowTotal = (B, r) => sum(B.max.map((mx, i) => Math.min(Math.max(+(r.pts[i] || 0), 0), mx)));
  function mismatch(c, B) {
    const w = src(c, B); if (!w) return [];
    return c.students.filter((s) => { const r = baRow(B, s.name), T = target(c, B, s, w); return r.in !== false && filled(r) && T !== null && Math.abs(rowTotal(B, r) - T) > 1e-6; });
  }
  const hasEst = (B) => !!B.tx && Object.values(B.tx.est).some((e) => (e || []).some(Boolean));

  /* sariq lenta: natija, «Moslash», «Bekor qilish» */
  function banner(c, B) {
    if (!B.tx || (!hasEst(B) && !B.tx.undo)) return `<div id="txb" hidden></div>`;
    const bad = mismatch(c, B), fit = bad.filter((s) => (B.tx.est[s.name] || []).some(Boolean)).length, n = Object.values(B.tx.est).filter((e) => (e || []).some(Boolean)).length;
    return `<div id="txb" class="tx-banner${bad.length ? "" : " ok"}">${bad.length
      ? `<span><b>${bad.length} ta o'quvchida</b> jami eMaktab balidan farq qiladi${fit ? " (qo'lda o'zgartirilgan)" : ""}.</span><span class="sp"></span>${fit ? `<button class="btn btn-sm btn-primary" data-txfit><i class="bi bi-distribute-horizontal" aria-hidden="true"></i> Moslash</button>` : ""}`
      : `<span>✓ Taxminiy ballar: <b>${n} ta o'quvchi</b>, har birining jami eMaktab bali bilan bir xil.</span><span class="sp"></span>`}${B.tx.undo ? `<button class="btn btn-sm" data-txundo>Bekor qilish</button>` : ""}</div>`;
  }
  function refresh(m, c, B, rerender) {
    const old = m.querySelector("#txb"); if (!old) return;
    const nw = h(banner(c, B)); old.replaceWith(nw); bindBanner(m, c, B, rerender);
  }
  function bindBanner(m, c, B, rerender) {
    const f = m.querySelector("[data-txfit]"); if (f) f.onclick = () => fitAll(c, B, rerender);
    const u = m.querySelector("[data-txundo]"); if (u) u.onclick = () => {
      if (!B.tx || !B.tx.undo) return;
      B.rows = B.tx.undo.rows; B.dirty = B.tx.undo.dirty; B.tx.est = {}; B.tx.man = {}; B.tx.undo = null;
      rerender(); toast("Taxminiy ballar bekor qilindi");
    };
  }
  // qo'lda tuzatilgan kataklar qoladi, qolgan taxminiy kataklar qayta bo'linadi
  function fitAll(c, B, rerender) {
    const w = src(c, B); let n = 0, bad = 0;
    for (const s of mismatch(c, B)) {
      const r = baRow(B, s.name), e = B.tx.est[s.name] || []; if (!e.some(Boolean)) continue;
      const fixed = B.max.map((_, i) => e[i] ? null : (r.pts[i] == null ? 0 : Math.min(r.pts[i], B.max[i])));
      const p = spread(target(c, B, s, w), B.max, B.tx.mode, s.name, fixed);
      if (!p) { bad++; continue; }
      r.pts = p; n++;
    }
    if (n) B.dirty = true;
    rerender(); toast(bad ? `${n} ta qator moslandi; ${bad} tasida qo'lda yozilgan ballar eMaktab balidan katta — tekshiring` : `${n} ta qator moslandi`);
  }

  /* oyna */
  async function dialog(c, B, rerender) {
    if (!B.max.every((v) => v > 0)) { toast("Hamma savol uchun maksimal ball (0 dan katta) kiriting"); return; }
    const L = works(c).filter((w) => c.students.some((s) => scoreOf(s, w) !== null));
    if (!L.length) { toast("BSB / CHSB sahifasida bu sinf uchun ball yo'q — avval eMaktabdan import qiling"); return; }
    const tot = sum(B.max), cur = src(c, B);
    let wid = (cur && L.some((w) => w.id === cur.id) ? cur : (L.find((w) => w.date === B.date) || L[L.length - 1])).id;
    let mode = (B.tx && B.tx.mode) || "tabiiy", scope = "bosh", absent = true;
    const res = await modal(`<div class="tx-dlg"></div>`, (mm, close) => {
      mm.querySelector(".card").classList.add("wide");
      const box = mm.querySelector(".tx-dlg");
      const draw = () => {
        const w = L.find((x) => x.id === wid), have = c.students.filter((s) => scoreOf(s, w) !== null), miss = c.students.length - have.length;
        const nFilled = c.students.filter((s) => filled(B.rows[s.name])).length;
        const todo = have.filter((s) => scope === "hammasi" || !filled(B.rows[s.name]));
        const sample = todo.slice(0, 5).map((s) => ({s, p: spread(target(c, B, s, w), B.max, mode, s.name) || []}));
        const opt = (nm, v, curV, t, d) => `<label class="tx-opt${curV === v ? " on" : ""}"><input type="radio" name="${nm}" value="${v}" ${curV === v ? "checked" : ""}><span><b>${t}</b><small>${d}</small></span></label>`;
        box.innerHTML = `<h2>Taxminiy ball kiritish</h2>
          <div class="muted">Har bir o'quvchining eMaktabdagi jami bali savollarga siz kiritgan maksimal ballar (${B.max.map(gnum).join(" + ")} = ${gnum(tot)}) bo'yicha bo'lib chiqiladi. Har qatorning jami eMaktab bali bilan aynan bir xil bo'ladi.</div>
          <label class="f">Qaysi ishdan olinsin<select id="txw" class="form-select">${L.map((x) => `<option value="${esc(x.id)}" ${x.id === wid ? "selected" : ""}>${esc(wLabel(x))} · ${c.students.filter((s) => scoreOf(s, x) !== null).length} ta ball</option>`).join("")}</select></label>
          <div class="tx-info">${Math.abs(w.max - tot) < 1e-9 ? `Ish maksimali (${fmtNum(w.max)}) tahlildagi maksimal ball bilan teng — ballar o'zgarishsiz bo'linadi.` : `Ish maksimali (${fmtNum(w.max)}) tahlildagidan (${gnum(tot)}) farq qiladi — jami ball proporsional qayta hisoblanadi (0,5 gacha yaxlitlanadi).`}</div>
          <div class="vcol" style="gap:6px"><div class="f">Taqsimlash usuli</div><div class="tx-opts">
            ${opt("txm", "tabiiy", mode, "Tabiiy", "Oldingi savollar osonroq, oxirgilari qiyinroq; har o'quvchida biroz farqli — haqiqiy ishga o'xshaydi.")}
            ${opt("txm", "teng", mode, "Teng ulush", "Har savolga maksimaliga mos bir xil ulush (masalan 80% → har savoldan ~80%).")}</div></div>
          <div class="vcol" style="gap:6px"><div class="f">Qaysi o'quvchilarga</div><div class="tx-opts">
            ${opt("txs", "bosh", scope, "Faqat bo'sh qatorlar", `Ball yozilgan ${nFilled} ta qator o'zgarmaydi.`)}
            ${opt("txs", "hammasi", scope, "Hammasini qayta yozish", "Oldin yozilgan ballar ham almashtiriladi.")}</div></div>
          ${miss ? `<label class="tx-chk"><input type="checkbox" id="txa" ${absent ? "checked" : ""}><span>eMaktabda bali yo'q <b>${miss} ta o'quvchi</b>ni «ishtirok etmagan» deb belgilash (✔ olib tashlanadi)</span></label>` : ""}
          <div class="vcol" style="gap:6px"><div class="f">Namuna${sample.length ? ` (birinchi ${sample.length} ta)` : ""}</div>
          <div class="tx-pv"><table><tr><th>O'quvchi</th>${B.max.map((mx, i) => `<th>${i + 1} <span>/${gnum(mx)}</span></th>`).join("")}<th>Jami</th><th>eMaktab</th></tr>
          ${sample.map((x) => `<tr><td>${esc(x.s.name)}</td>${x.p.map((v) => `<td><span class="tx-c">${gnum(v)}</span></td>`).join("")}<td><b>${gnum(sum(x.p))}</b></td><td><span class="tx-em ok">✓ ${esc(fmtNum(scoreOf(x.s, w)))}</span></td></tr>`).join("") || `<tr><td colspan="${B.q + 3}" class="muted">Bo'sh qator qolmagan — «Hammasini qayta yozish»ni tanlang.</td></tr>`}</table></div></div>
          <p class="muted tx-note">Ballar taxminiy: o'quvchi qaysi savolda xato qilganini bilsangiz, katakni qo'lda tuzating, keyin «Moslash» bilan qolganlari to'g'rilanadi. «Saqlash» bosilmaguncha hech narsa saqlanmaydi.</p>
          <div class="hrow tx-act"><span class="sp"></span><button class="btn" data-x>Bekor qilish</button><button class="btn btn-primary" data-ok ${todo.length ? "" : "disabled"}><i class="bi bi-magic" aria-hidden="true"></i> ${todo.length} ta o'quvchiga kiritish</button></div>`;
        $("#txw", box).onchange = (e) => { wid = e.target.value; draw(); };
        box.querySelectorAll("[name=txm]").forEach((x) => x.onchange = () => { mode = x.value; draw(); });
        box.querySelectorAll("[name=txs]").forEach((x) => x.onchange = () => { scope = x.value; draw(); });
        const ab = $("#txa", box); if (ab) ab.onchange = () => { absent = ab.checked; };
        $("[data-x]", box).onclick = () => close(null);
        $("[data-ok]", box).onclick = () => close({wid, mode, scope, absent});
      };
      draw();
    });
    if (!res) return;
    const w = L.find((x) => x.id === res.wid);
    const undo = {rows: clone(B.rows), dirty: B.dirty};
    B.tx = {wid: w.id, mode: res.mode, est: {}, man: {}, undo};
    let n = 0, off = 0;
    for (const s of c.students) {
      const r = B.rows[s.name] = B.rows[s.name] || {in: true, pts: []}, T = target(c, B, s, w);
      if (T === null) { if (res.absent && !filled(r)) { r.in = false; off++; } continue; }
      if (res.scope === "bosh" && filled(r)) continue;
      const p = spread(T, B.max, res.mode, s.name); if (!p) continue;
      r.in = true; r.pts = p; B.tx.est[s.name] = B.max.map(() => true); n++;
    }
    B.dirty = true; rerender();
    toast(`${n} ta o'quvchiga taxminiy ball kiritildi${off ? `; ${off} tasi ishtirok etmagan deb belgilandi` : ""}`);
  }

  /* ───── CHSB testi: eMaktab bali bo'yicha taxminiy javoblar (to'g'ri / noto'g'ri variantlar) ─────
     Ball = to'g'ri javob berilgan savollar ballari yig'indisi, yuqoriga yaxlitlangan (testScore). Shunday savollar to'plami tanlanadiki,
     yaxlitlangan yig'indi aynan eMaktab baliga teng bo'ladi — demak yozilgan ball o'zgarmaydi. Imkonsiz bo'lsa — o'quvchi o'tkazib yuboriladi. */
  const fits = (sum, T) => Math.ceil(Math.round(sum * 1e6) / 1e6 - 1e-9) === T;
  function pick(T, P, mode, seed) {
    const n = P.length, r = rng(seed || "x"), tot = sum(P);
    if (!(T >= 0) || T > Math.ceil(tot - 1e-9)) return null;
    const pr = P.map((_, i) => mode === "teng" ? ((i * 0.618034) % 1) + 0.02 * r() : (n > 1 ? i / (n - 1) : 0) + 0.55 * (r() - 0.5));
    const ord = P.map((_, i) => i).sort((a, b) => pr[a] - pr[b]);
    const on = Array(n).fill(false); let s = 0;
    for (const i of ord) if (s + P[i] <= T + 1e-9) { on[i] = true; s += P[i]; }
    if (fits(s, T)) return on;
    // almashtirish: bitta to'g'ri javobni boshqasiga almashtirib yig'indini oynaga kiritish
    for (let k = 0; k < n * n && !fits(s, T); k++) {
      let best = null;
      for (let a = 0; a < n; a++) if (on[a]) for (let b = 0; b < n; b++) if (!on[b]) {
        const ns = s - P[a] + P[b]; if (ns > T + 1e-9 || ns <= s + 1e-9) continue;
        if (!best || ns > best[2]) best = [a, b, ns];
      }
      if (!best) break;
      on[best[0]] = false; on[best[1]] = true; s = best[2];
      for (const i of ord) if (!on[i] && s + P[i] <= T + 1e-9) { on[i] = true; s += P[i]; }
    }
    if (fits(s, T)) return on;
    // oxirgi chora: yig'indilar bo'yicha dinamik tanlov (yuzdan birlarda)
    const C = P.map((v) => Math.round(v * 100)), lim = T * 100 + 1, from = new Map([[0, null]]), real = new Map([[0, 0]]);
    for (let i = 0; i < n; i++) for (const [v] of [...from]) { const nv = v + C[i]; if (nv <= lim && !from.has(nv)) { from.set(nv, [v, i]); real.set(nv, real.get(v) + P[i]); } }
    const got = [...from.keys()].filter((v) => fits(real.get(v), T)).sort((a, b) => b - a)[0];
    if (got === undefined) return null;
    const res = Array(n).fill(false); for (let v = got; from.get(v); v = from.get(v)[0]) res[from.get(v)[1]] = true;
    return res;
  }
  function answers(t, P, T, mode, seed) {
    const on = pick(T, P, mode, seed); if (!on) return null;
    const r = rng(seed + "#v"), L = TEST_L.slice(0, t.o);
    return on.map((ok, i) => { if (ok) return t.key[i]; const o = L.replace(t.key[i], ""); return o[Math.floor(r() * o.length)]; }).join("");
  }
  const blankAns = (a) => !a || /^\.*$/.test(a);
  const TC = {};   // xotirada: {[ish id]: {ids: Set, mode, undo, skip}}
  const chsbCls = (w, s) => TC[w.id] && TC[w.id].ids.has(s.id) ? " tx-estc" : "";
  function chsbBanner(w) {
    const st = TC[w.id]; if (!st || (!st.ids.size && !st.undo)) return "";
    return `<div class="tx-banner${st.skip.length ? "" : " ok"}" id="txc"><span>${st.ids.size ? `✓ Taxminiy javoblar: <b>${st.ids.size} ta o'quvchi</b>, har birining bali eMaktabdagi bilan bir xil.` : "Taxminiy javoblar yo'q."}${st.skip.length ? ` <b>${st.skip.length} tasiga</b> mos javob topilmadi (savol ballari bilan bu ballni yig'ib bo'lmaydi): ${esc(st.skip.slice(0, 6).join(", "))}${st.skip.length > 6 ? "…" : ""}.` : ""}</span><span class="sp"></span>${st.undo ? `<button class="btn btn-sm" data-txcundo>Bekor qilish</button>` : ""}</div>`;
  }
  async function chsbDialog(c, w, ensure, rescoreAll, rerender) {
    const t = ensure();
    if (/\./.test(t.key)) { toast("Avval barcha savollarning to'g'ri javobini belgilang"); return; }
    const P = testPts(w, t), out = new Set(t.out || []);
    const sc = (s) => { const v = (s.scores || {})[w.id]; return isNum(v) ? v : null; };
    const todo = c.students.filter((s) => !out.has(s.id) && blankAns(t.ans[s.id]) && sc(s) !== null);
    const miss = c.students.filter((s) => !out.has(s.id) && blankAns(t.ans[s.id]) && sc(s) === null);
    if (!todo.length && !miss.length) { toast("Javobi bo'sh, bali bor o'quvchi yo'q — eMaktabdan import qilingan CHSB ballari kerak"); return; }
    let mode = (TC[w.id] && TC[w.id].mode) || "tabiiy", absent = true;
    const res = await modal(`<div class="tx-dlg"></div>`, (mm, close) => {
      mm.querySelector(".card").classList.add("wide");
      const box = mm.querySelector(".tx-dlg");
      const draw = () => {
        const sample = todo.slice(0, 5).map((s) => ({s, a: answers(t, P, sc(s), mode, s.name)}));
        const bad = todo.filter((s) => !answers(t, P, sc(s), mode, s.name)).length;
        const opt = (v, ttl, d) => `<label class="tx-opt${mode === v ? " on" : ""}"><input type="radio" name="txm" value="${v}" ${mode === v ? "checked" : ""}><span><b>${ttl}</b><small>${d}</small></span></label>`;
        box.innerHTML = `<h2>Taxminiy javoblar kiritish</h2>
          <div class="muted">Javoblari bo'sh, lekin «BSB / CHSB» sahifasida (eMaktabdan) bali bor o'quvchilarga to'g'ri va noto'g'ri variantlar shunday yoziladiki, savol ballari (${P.every((v) => Math.abs(v - P[0]) < 1e-9) ? `${t.n} × ${gnum(Math.round(P[0] * 100) / 100)}` : P.map((v) => gnum(Math.round(v * 100) / 100)).join(" + ")}) bo'yicha hisoblangan ball eMaktabdagi bal bilan aynan bir xil chiqadi.</div>
          <div class="tx-info">CHSB · ${fmt(w.date)} · maks. ${fmtNum(w.max)} · ${t.n} ta savol, ${t.o} ta variant. Javobi bor ${c.students.filter((s) => !blankAns(t.ans[s.id])).length} ta o'quvchiga tegilmaydi.${bad ? ` <b>${bad} ta o'quvchi</b>ning balini savol ballari bilan aynan yig'ib bo'lmaydi — ular bo'sh qoladi.` : ""}</div>
          <div class="vcol" style="gap:6px"><div class="f">Taqsimlash usuli</div><div class="tx-opts">
            ${opt("tabiiy", "Tabiiy", "Oldingi savollar osonroq, oxirgilari qiyinroq; har o'quvchida biroz farqli — haqiqiy testga o'xshaydi.")}
            ${opt("teng", "Teng ulush", "To'g'ri javoblar butun test bo'ylab bir tekis tarqaladi.")}</div></div>
          ${miss.length ? `<label class="tx-chk"><input type="checkbox" id="txa" ${absent ? "checked" : ""}><span>Bali ham, javobi ham yo'q <b>${miss.length} ta o'quvchi</b>ni «ishtirok etmagan» deb belgilash (✔ olib tashlanadi)</span></label>` : ""}
          <div class="vcol" style="gap:6px"><div class="f">Namuna${sample.length ? ` (birinchi ${sample.length} ta)` : ""}</div>
          <div class="tx-pv"><table><tr><th>O'quvchi</th>${P.map((_, i) => `<th>${i + 1}</th>`).join("")}<th>Ball</th><th>eMaktab</th></tr>
          ${sample.map((x) => `<tr><td>${esc(x.s.name)}</td>${x.a ? x.a.split("").map((ch, i) => `<td><span class="tx-c ${ch === t.key[i] ? "ok" : "wr"}">${ch}</span></td>`).join("") + `<td><b>${gnum(testScore(w, t, x.a).score)}</b></td><td><span class="tx-em ok">✓ ${esc(fmtNum(sc(x.s)))}</span></td>` : `<td colspan="${t.n + 1}" class="muted">mos javob topilmadi</td><td><span class="tx-em no">${esc(fmtNum(sc(x.s)))}</span></td>`}</tr>`).join("") || `<tr><td colspan="${t.n + 3}" class="muted">Javobi bo'sh, bali bor o'quvchi yo'q.</td></tr>`}</table></div></div>
          <p class="muted tx-note">Javoblar taxminiy: kerak bo'lsa katakni qo'lda tuzating (ball shunga qarab qayta hisoblanadi). O'zgarishlar darhol saqlanadi; «Bekor qilish» bilan qaytarish mumkin.</p>
          <div class="hrow tx-act"><span class="sp"></span><button class="btn" data-x>Bekor qilish</button><button class="btn btn-primary" data-ok ${todo.length - bad || (absent && miss.length) ? "" : "disabled"}><i class="bi bi-magic" aria-hidden="true"></i> ${todo.length - bad} ta o'quvchiga kiritish</button></div>`;
        box.querySelectorAll("[name=txm]").forEach((x) => x.onchange = () => { mode = x.value; draw(); });
        const ab = $("#txa", box); if (ab) ab.onchange = () => { absent = ab.checked; draw(); };
        $("[data-x]", box).onclick = () => close(null);
        $("[data-ok]", box).onclick = () => close({mode, absent});
      };
      draw();
    });
    if (!res) return;
    const st = TC[w.id] = {ids: new Set(), mode: res.mode, skip: [], undo: {ans: clone(t.ans), out: (t.out || []).slice()}};
    for (const s of todo) {
      const a = answers(t, P, sc(s), res.mode, s.name);
      if (!a || testScore(w, t, a).score !== sc(s)) { st.skip.push(s.name); continue; }
      t.ans[s.id] = a; st.ids.add(s.id);
    }
    let off = 0;
    if (res.absent) for (const s of miss) { out.add(s.id); off++; }
    t.out = [...out]; save(); await rescoreAll(); rerender();
    toast(`${st.ids.size} ta o'quvchiga taxminiy javob kiritildi${off ? `; ${off} tasi ishtirok etmagan deb belgilandi` : ""}${st.skip.length ? `; ${st.skip.length} tasiga mos javob topilmadi` : ""}`);
  }
  function chsbBind(m, c, w, ensure, rescoreAll, rerender) {
    const b = m.querySelector("[data-btxc]"); if (b) b.onclick = () => chsbDialog(c, w, ensure, rescoreAll, rerender);
    const u = m.querySelector("[data-txcundo]"); if (u) u.onclick = async () => {
      const st = TC[w.id]; if (!st || !st.undo) return;
      if (isLocked() && !await unlock()) return;
      const t = ensure(); t.ans = st.undo.ans; t.out = st.undo.out; delete TC[w.id]; cleanTest(w); save();
      // taxminiy javoblar o'chirilganda ball eMaktabdagi bilan bir xil bo'lgani uchun o'zgarmaydi
      await rescoreAll(); rerender(); toast("Taxminiy javoblar bekor qilindi");
    };
  }
  // qo'lda o'zgartirilgan qator endi taxminiy emas
  const chsbTouch = (w, s) => { if (TC[w.id]) TC[w.id].ids.delete(s.id); };
  const chsbButton = () => `<button class="btn tx-btn" data-btxc title="eMaktabdagi CHSB balini to'g'ri / noto'g'ri javoblarga taxminan aylantiradi"><i class="bi bi-magic" aria-hidden="true"></i> Taxminiy ball</button>`;
  const chsb = {button: chsbButton, bind: chsbBind, banner: chsbBanner, cls: chsbCls, touch: chsbTouch, pick, answers, state: TC};

  const button = () => `<button class="btn tx-btn" data-btx title="eMaktabdagi jami BSB / CHSB balini savollar bo'yicha taxminan bo'lib chiqadi"><i class="bi bi-magic" aria-hidden="true"></i> Taxminiy ball</button>`;
  function bind(m, c, B, rerender) {
    const b = m.querySelector("[data-btx]"); if (b) b.onclick = () => dialog(c, B, rerender);
    bindBanner(m, c, B, rerender);
  }
  return {chsb, spread, src, target, cls, touch, head, mxCell, cell, paint, banner, refresh, button, bind, dialog, works};
})();
