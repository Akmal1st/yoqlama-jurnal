/* Kundalik (formativ) bahoni eMaktab baholash mezoni bo'yicha qo'yish — tasdiqlangan maket v3 (Akmal, 2026-11-03).
   Formativ baho = darsdagi ish (1–6) + uy vazifasi (0–4) = 10 ballgacha. Yig'indi jurnalga oddiy baho bo'lib tushadi
   (s.marks[sana] = "8"), shuning uchun FB, chorak bahosi va hisobotlar o'zgarishsiz ishlaydi.
   Qismlar: s.fp[sana] = [darsdagi ish | null, uy vazifasi | null]; izoh: s.fc[sana] = "matn" (cleanStudent tozalaydi).
   Rejim: D.web.fmode = "plain" — eski «Oddiy (1–10)» tugmalari; "krit" — kriterial jadval (+/−, kriterial.js); boshqa holda — mezon bo'yicha.
   Asosiy skriptdan oldin ulanadi; ichidagi funksiyalar faqat chaqirilganda index.html dagi umumiy funksiyalardan foydalanadi. */
const MZN = (() => {
  const P = [
    {k: "d", n: "Darsdagi ish", sn: "Darsda", min: 1, m: 6, lv: {
      6: "O'quvchi darsning barcha bosqichlarida faol, savollarga aniq va to'g'ri javob beradi, guruhli va juftlikdagi ishlarda faol qatnashadi.",
      5: "O'quvchi darsning ayrim bosqichlarida yuqori faollik ko'rsatadi, savollarga to'g'ri javob beradi, ammo kichik xatolarga yo'l qo'yadi.",
      4: "O'quvchi darsda qatnashadi, lekin savollarga ishonchsiz javob beradi hamda guruhli yoki juftlikdagi ishlarda faolligi past bo'ladi.",
      3: "O'quvchi darsda faol qatnashadi, ammo noto'g'ri fikrlar bildiradi yoki tez-tez xatolarga yo'l qo'yadi.",
      2: "O'quvchi savollarga noto'g'ri javob beradi va darsda juda kam faollik ko'rsatadi.",
      1: "O'quvchi dars jarayonida deyarli qatnashmaydi."},
     sh: {6: "barcha bosqichda faol, to'g'ri javob", 5: "faol, kichik xatolar", 4: "ishonchsiz, faolligi past", 3: "faol, lekin tez-tez xato", 2: "noto'g'ri javob, kam faol", 1: "deyarli qatnashmadi"}},
    {k: "u", n: "Uy vazifasi", sn: "Uy vazifasi", min: 0, m: 4, lv: {
      4: "Uy vazifasi to'liq va xatosiz bajarilgan.", 3: "Uy vazifasi bajarilgan, ammo ayrim xato yoki kamchiliklar mavjud.",
      2: "Uy vazifasi qisman bajarilgan yoki ko'p xatolarga yo'l qo'yilgan.", 1: "Uy vazifasi deyarli bajarilmagan.", 0: "Uy vazifasi bajarilmagan."},
     sh: {4: "to'liq, xatosiz", 3: "ayrim xatolar", 2: "qisman / ko'p xato", 1: "deyarli bajarilmagan", 0: "bajarilmagan"}},
  ];
  const vals = (p) => Array.from({length: p.m - p.min + 1}, (_, i) => p.min + i);
  const on = () => !["plain", "krit"].includes((D.web || {}).fmode);
  const absent = (mk) => ["s", "dq", "k", "ox"].includes(attPart(mk || ""));

  // saqlangan qismlar faqat jurnaldagi baho bilan mos kelsa ishlatiladi (baho boshqa joyda o'zgartirilgan bo'lsa — e'tiborsiz)
  function parts(s, d) {
    const fp = s.fp && s.fp[d]; if (!fp) return [null, null];
    const gs = gradesOf(s.marks[d] || "");
    if (fp[0] != null && fp[1] != null) return gs.length === 1 && gs[0] === fp[0] + fp[1] ? fp.slice() : [null, null];
    return gs.length ? [null, null] : fp.slice();
  }
  function qCount(c, s, d) {
    const q = quarterOf(d), r = q && qRange(q); if (!r) return null;
    return formativeGrades(c, s, r).length;
  }

  function head(ed) {
    return `<div class="mz-head"><b>O'quvchi</b><b>Yo'qlama</b><div class="mz-crits">${P.map((p, i) => `<div class="mz-ch" style="--n:${p.m - p.min + 1}"><b>${p.n} <i>${p.min}–${p.m}</i></b>${ed ? `<button class="mz-fill" type="button" data-mzfill="${i}">Qolganlarga ${p.m} ✓</button>` : ""}</div>`).join("")}</div><b class="mz-r">Baho</b></div>`;
  }

  function badge(c, s, si, d) {
    const mk = s.marks[d] || "";
    if (absent(mk)) return `<span class="mz-tot"><b class="none">—</b></span>`;
    const gs = gradesOf(mk), pt = parts(s, d);
    if (gs.length) {
      const avg = gs.reduce((a, b) => a + b, 0) / gs.length, col = gradeColor(avg) || "var(--alt)";
      const sub = pt[0] != null && pt[1] != null ? `${pt[0]} + ${pt[1]}` : "1–10";
      return `<button class="mz-tot" type="button" data-mzb="${si}" title="Tafsilot va izoh"><b style="background:${col};color:${contrast(col.startsWith("#") ? col : "#ffffff")}">${gs.join("/")}</b><small>${sub}</small></button>`;
    }
    if (pt[0] != null || pt[1] != null) return `<button class="mz-tot" type="button" data-mzb="${si}"><b class="part">${(pt[0] || 0) + (pt[1] || 0)}…</b><small>${pt[1] == null ? "uy vazifasi?" : "darsdagi ish?"}</small></button>`;
    return `<button class="mz-tot" type="button" data-mzb="${si}" aria-label="Baho yo'q"><b class="none">—</b><small>/10</small></button>`;
  }

  // bitta o'quvchi qatori: dn — ism (index.html dagi kabi), att — yo'qlama tugmalari
  function row(c, si, d, o) {
    const s = c.students[si], mk = s.marks[d] || "", pt = parts(s, d), n = qCount(c, s, d), k = fbMin(), low = n !== null && n < k;
    const dots = n === null ? "" : `<span class="mz-qc ${low ? "low" : ""}" title="Chorakda ${n} ta baho (kamida ${k} ta kerak)"><span class="mz-dots">${Array.from({length: k}, (_, i) => `<u class="${i < n ? "f" : ""}"></u>`).join("")}</span>${n} ta baho${low ? " · kam" : ""}${s.fc && s.fc[d] ? ` <span class="mz-cm">· 💬 izoh</span>` : ""}</span>`;
    const cr = absent(mk) ? `<span class="mz-off">Darsda yo'q — baho qo'yilmaydi</span>`
      : P.map((p, i) => `<div class="mz-crit"><small>${p.n} <span>${p.min}–${p.m}</span></small><div class="mz-pts" style="--n:${p.m - p.min + 1}">${vals(p).map((v) => `<button type="button" class="${pt[i] === v ? "on" : ""}" data-mzp="${si}|${i}|${v}" title="${v} — ${esc(p.lv[v])}">${v}</button>`).join("")}</div></div>`).join("");
    const hint = absent(mk) ? [] : P.map((p, i) => pt[i] != null ? `<span><b>${p.sn} ${pt[i]}:</b> ${p.sh[pt[i]]}</span>` : "").filter(Boolean);
    return `<div class="drow mz-row ${o.risk ? "risk" : ""}" data-dr="${si}" data-q="${esc(normName(s.name))}"><div class="mz-nm">${o.dn}${dots}</div>
      <div class="datt" role="group" aria-label="Yo'qlama">${o.att}</div><div class="mz-crits" role="group" aria-label="Baho">${cr}</div>${badge(c, s, si, d)}${hint.length ? `<div class="mz-hint">${hint.join("")}</div>` : ""}</div>`;
  }

  // kr — kriterial rejim (kriterial.js) yoqilgan bo'lsa, o'ng tomonda uning tugmalari
  function tools(kr) {
    const fm = (D.web || {}).fmode, md = fm === "plain" ? "plain" : fm === "krit" ? "krit" : "crit";
    return `<div class="mz-tools"><div class="mz-seg" role="group" aria-label="Baho qo'yish usuli">
      <button type="button" class="${md === "crit" ? "on" : ""}" data-mzmode="crit">Mezon bo'yicha</button><button type="button" class="${md === "krit" ? "on" : ""}" data-mzmode="krit">Kriterial (+/−)</button><button type="button" class="${md === "plain" ? "on" : ""}" data-mzmode="plain">Oddiy (1–10)</button></div>
      <span class="mz-lbl">${md === "crit" ? "Darsdagi ish 6 + Uy vazifasi 4 = 10" : md === "krit" ? "1 + darsdagi ish «+» (5) + uy vazifasi «+» (4) = 10" : "Tayyor bahoni 1–10 qo'yish"}</span><span class="mz-sp"></span>
      ${kr || `<button class="btn" type="button" data-mzrub>📋 Mezonlar jadvali</button>`}</div>`;
  }

  // o'ng panel kartalari (kompyuter) va ro'yxat tepasidagi qisqa xulosa (telefon)
  function lowList(c, d) {
    const k = fbMin(); return c.students.map((s) => [s, qCount(c, s, d)]).filter(([s, n]) => n !== null && n < k && !preJoin(c, s, d));
  }
  function dayCard(c, d, ed) {
    const pres = c.students.filter((s) => !absent(s.marks[d]) && !preJoin(c, s, d));
    return `<div class="card mz-day"><b>Bugungi dars</b><div class="mz-avg">${P.map((p, i) => {
      const vs = pres.map((s) => parts(s, d)[i]).filter((v) => v != null);
      return `<div><span>${p.n} · o'rtacha <b>${vs.length ? (vs.reduce((a, b) => a + b, 0) / vs.length).toFixed(1) : "—"} / ${p.m}</b></span>${ed ? `<button class="mz-fill" type="button" data-mzfill="${i}">Qolganlarga ${p.m} ✓</button>` : ""}</div>`;
    }).join("")}</div>${ed ? `<span class="muted mz-small">«Qolganlarga» — hali ball qo'yilmagan, darsda bor o'quvchilarga to'liq ball.</span>` : ""}</div>`;
  }
  function side(c, d, ed) {
    const lw = lowList(c, d), k = fbMin(), q = quarterOf(d);
    const fb = q ? `<div class="card mz-fb"><b>Formativ holat · ${q}-chorak</b><span class="muted mz-small">Har o'quvchi chorakda kamida ${k} marta baholanadi.</span>${lw.length ? `<ul>${lw.map(([s, n]) => `<li><span>${esc(s.name)}</span><span>${n} / ${k}</span></li>`).join("")}</ul>` : `<span class="mz-okk">Hammada yetarli baho bor ✓</span>`}</div>` : "";
    const formula = `<div class="card mz-formula"><b>Chorak bahosi (eMaktab)</b><div class="mz-f4"><div class="me"><b>10</b><small>Formativ</small></div><div><b>50</b><small>BSB</small></div><div><b>40</b><small>CHSB</small></div><div><b>100</b><small>Jami</small></div></div>
      <span class="muted mz-small">Formativ ball = chorakdagi kundalik baholar o'rtachasi (umumiy ballning 10%). BSB va CHSB ballari «Umumiy» sahifasida.</span></div>`;
    return `<div class="mz-side">${dayCard(c, d, ed)}${fb}${formula}</div>`;
  }
  function top(c, d, ed) {
    const lw = lowList(c, d), k = fbMin(), q = quarterOf(d);
    const fb = q ? `<div class="card mz-mini"><b>Formativ holat · ${q}-chorak</b><span class="muted">${lw.length ? `<b class="mz-warn">${lw.length} o'quvchida baho kam</b> (kamida ${k} ta kerak): ${lw.map(([s, n]) => `${esc(shortName(s.name))} ${n}/${k}`).join(", ")}` : "Hammada yetarli baho bor ✓"}</span></div>` : "";
    return `<div class="mz-top">${fb}${dayCard(c, d, ed)}</div>`;
  }

  function rubric() {
    const body = P.map((p) => `<div class="mz-lbl">${p.n} · ${p.min}–${p.m} ball</div><div class="mz-rub">${vals(p).reverse().map((v) => `<div><b>${v}</b><span>${esc(p.lv[v])}</span></div>`).join("")}</div>`).join("")
      + `<div class="mz-lbl">Rangli ko'rsatkich</div><div class="mz-colors"><div style="background:${gradeColor(9) || "#81c784"}">8–10</div><div style="background:${gradeColor(6) || "#fff59d"}">5–7</div><div style="background:${gradeColor(2) || "#ef9a9a"}">1–4</div></div>
      <p class="muted mz-small" style="margin:0">Darsda bo'lmagan o'quvchiga baho qo'yilmaydi — davomat belgisi qo'yiladi. Darsda bo'lib, topshiriqni bajarmagan o'quvchi mezon bo'yicha baholanadi.</p>`;
    modal(`<div class="mz-dlg"><h2>Formativ baholash mezonlari</h2><p class="muted mz-small">eMaktab qoidasi: darsdagi ish 60% (6 ballgacha) + uy vazifasi 40% (4 ballgacha) = 10 ball. Masalan, 5 + 3 = 8.</p>
      <div class="mz-body">${body}</div><div class="mz-foot one"><button class="btn btn-primary" type="button" data-x>Yopish</button></div></div>`,
    (m, close) => { $("[data-x]", m).onclick = () => close(); });
  }

  // qismni o'zgartirish: ikkalasi bo'lsa — yig'indi baho bo'lib yoziladi, biri bo'lsa — baho yo'q (chala)
  function setPart(c, si, d, i, v, putFn) {
    if (!canEdit(d)) { putMark(c, si, d, c.students[si].marks[d] || ""); return false; }   // sababini toast bilan aytadi
    const s = c.students[si], old = s.marks[d] || "", np = parts(s, d);
    np[i] = np[i] === v ? null : v;
    const full = np[0] != null && np[1] != null, late = lateOf(old);
    const nw = full ? buildMark([np[0] + np[1]], late) : late ? "kq" : (gradesOf(old).length ? "" : old);
    const prev = s.fp && s.fp[d];
    s.fp = s.fp || {};
    if (np[0] == null && np[1] == null) delete s.fp[d]; else s.fp[d] = np;
    if (nw !== old && !putFn(si, nw)) { if (prev) s.fp[d] = prev; else delete s.fp[d]; if (!Object.keys(s.fp).length) delete s.fp; return false; }
    if (!Object.keys(s.fp).length) delete s.fp;
    if (nw === old) save();
    return true;
  }
  function clear(c, si, d, putFn) {
    const s = c.students[si], old = s.marks[d] || "", nw = lateOf(old) ? "kq" : gradesOf(old).length ? "" : old;
    if (nw !== old && !putFn(si, nw)) return false;
    if (s.fp) delete s.fp[d];
    save(); return true;
  }
  function fill(c, d, i) {
    const p = P[i]; let n = 0;
    c.students.forEach((s, si) => {
      if (preJoin(c, s, d) || absent(s.marks[d]) || gradesOf(s.marks[d] || "").length && parts(s, d)[0] == null) return;
      if (parts(s, d)[i] != null) return;
      if (setPart(c, si, d, i, p.m, (k, nw) => putMark(c, k, d, nw, true))) n++;
    });
    save(); toast(n ? `${p.n}: ${n} o'quvchiga ${p.m} ball qo'yildi` : "Hammaga allaqachon qo'yilgan");
  }
  function detail(c, si, d, putFn, after) {
    const s = c.students[si], pt = parts(s, d), gs = gradesOf(s.marks[d] || ""), ed = canEdit(d);
    const rows = P.map((p, i) => `<div><span>${p.n}${pt[i] != null ? `<br><small class="muted">${esc(p.lv[pt[i]])}</small>` : ""}</span><b>${pt[i] ?? "—"} / ${p.m}</b></div>`).join("")
      + `<div class="t"><span>Jurnalga tushadigan baho</span><span>${gs.length ? gs.join("/") : "hali to'liq emas"}</span></div>`;
    modal(`<div class="mz-dlg"><h2>${esc(s.name)}</h2><p class="muted mz-small">${fmt(d)}</p><div class="mz-body"><div class="mz-bd">${rows}</div>
      <label class="mz-lab"><span class="mz-lbl">Izoh (ixtiyoriy)</span><textarea class="form-control" id="mz-cm" rows="3" placeholder="Masalan: guruh ishida faol bo'ldi, uy vazifasida 2-misolda xato">${esc((s.fc || {})[d] || "")}</textarea></label></div>
      <div class="mz-foot">${ed ? `<button class="btn" type="button" data-clr>Bahoni o'chirish</button>` : `<button class="btn" type="button" data-x>Yopish</button>`}<button class="btn btn-primary" type="button" data-ok>Saqlash</button></div></div>`,
    (m, close) => {
      const x = $("[data-x]", m); if (x) x.onclick = () => close();
      const cl = $("[data-clr]", m); if (cl) cl.onclick = () => { if (clear(c, si, d, putFn)) { close(); toast("Baho o'chirildi"); after(); } };
      $("[data-ok]", m).onclick = () => {
        const t = $("#mz-cm", m).value.trim().slice(0, 500); s.fc = s.fc || {};
        if (t) s.fc[d] = t; else delete s.fc[d];
        if (!Object.keys(s.fc).length) delete s.fc;
        if (s.fp && !Object.keys(s.fp).length) delete s.fp;
        save(); close(); toast("Saqlandi"); after();
      };
    });
  }

  // tozalash: tashqi fayldan kelgan qismlar va izohlar (cleanStudent chaqiradi)
  function clean(s) {
    if (s.fp && typeof s.fp === "object" && !Array.isArray(s.fp)) {
      const o = {};
      for (const [d, v] of Object.entries(s.fp)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !Array.isArray(v) || v.length !== 2) continue;
        const r = P.map((p, i) => { const x = v[i]; return x == null ? null : Number.isInteger(x) && x >= p.min && x <= p.m ? x : undefined; });
        if (r.includes(undefined) || (r[0] == null && r[1] == null)) continue;
        o[d] = r;
      }
      if (Object.keys(o).length) s.fp = o; else delete s.fp;
    } else delete s.fp;
    if (s.fc && typeof s.fc === "object" && !Array.isArray(s.fc)) {
      const o = {};
      for (const [d, v] of Object.entries(s.fc)) if (/^\d{4}-\d{2}-\d{2}$/.test(d) && typeof v === "string" && v.trim()) o[d] = v.trim().slice(0, 500);
      if (Object.keys(o).length) s.fc = o; else delete s.fc;
    } else delete s.fc;
  }

  return {P, on, parts, head, row, tools, side, top, rubric, setPart, fill, detail, clean};
})();
