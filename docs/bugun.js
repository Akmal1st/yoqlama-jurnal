/* «Bugun» sahifasi — tasdiqlangan dizayn (maket v1, Akmal 2026-11-01). Ko'rinish shu faylda, hisob-kitob index.html da:
   lessonsToday, gradedShare, compareRows, riskOverview, hwOverview, lessonGaps, quarterEnd/quarterGaps, ktrProgress,
   weekCardRange/weekSummary/weekTotals, upcomingItems, birthdays, backupAge, tgAge, allDone, startLesson.
   Bu fayl asosiy skriptdan OLDIN ulanadi; ichidagi funksiyalar asosiy skriptdagi nomlarni faqat chaqirilganda ishlatadi.
   Tepada: hozirgi dars kartochkasi; keyin bugungi darslar chizig'i (soat tartibida). Kompyuterda o'ng ustun: hafta xulosasi,
   «Bajarish kerak», «E'tibor talab qiladi». Telefonda pastki qism uch bo'limda: Vazifalar · E'tibor · Sinflar. */
const BGN = (() => {
  const phone = () => matchMedia("(max-width:820px)").matches;
  const dz = () => (typeof DZN !== "undefined" ? DZN.cfg() : {act: "end", pri: "right"});
  const mins = (hm) => (hm ? +hm.slice(0, 2) * 60 + +hm.slice(3, 5) : null);
  const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const d5 = (s) => fmt(s).slice(0, 5);
  let wasPhone = null;

  /* ───────── bugungi darslar va holati ───────── */
  // har dars: {c, ci, done, from, to, no, st}; st: done | now | late | next | later | wait (jadval vaqti yo'q)
  function lessons() {
    const L = lessonsToday().map((x) => {
      const sl = (x.slots || []).filter((s) => s.from), f = sl[0], l = sl[sl.length - 1];
      return {...x, from: f ? f.from : "", to: l ? l.to : "", no: x.slots && x.slots.length ? x.slots.map((s) => s.no + 1).join(", ") : ""};
    });
    const h = nowMin();
    for (const x of L) x.st = x.done ? "done" : !x.from ? "wait" : h >= mins(x.to) ? "late" : h >= mins(x.from) ? "now" : "later";
    const nx = L.find((x) => x.st === "later"); if (nx) nx.st = "next";
    return L;
  }
  // asosiy kartochka: hozirgi → keyingi → vaqti yo'q → o'tib ketgan va to'ldirilmagan
  const heroOf = (L) => L.find((x) => x.st === "now") || L.find((x) => x.st === "next") || L.find((x) => x.st === "wait") || L.find((x) => x.st === "late") || null;
  const allokLabel = (c) => isGrp(c) ? "✓ Hammaga o'tildi" : "✓ Hamma keldi";
  const pair = (sec, pri) => `<div class="bn-pair">${sec}${pri}</div>`;
  const lessonBtns = (x, short) => pair(`<button class="btn" data-allok="${x.ci}" title="${isGrp(x.c) ? "Hammaga «dars o'tildi»" : "Hech kim qoldirmagan bo'lsa — bitta bosishda yo'qlama tugaydi"}">${allokLabel(x.c)}</button>`,
    `<button class="btn btn-primary" data-start="${x.ci}">${x.st === "late" ? "✎ To'ldirish" : `▶ ${short ? "Boshlash" : "Darsni boshlash"}`}</button>`);
  const timeTxt = (x) => x.from ? `${x.no ? `${x.no}-soat · ` : ""}${x.from}–${x.to}` : "";
  const workOf = (x, t) => x.c.works.find((w) => w.date === t);
  const prevHwOf = (x, t) => { const p = x.c.dates.filter((d) => d < t && !isNoLesson(x.c, d)).pop(); return p && x.c.lessons[p] && x.c.lessons[p].hw ? [p, x.c.lessons[p].hw] : null; };
  const noteLine = (x, t) => { const w = workOf(x, t), topic = (x.c.lessons[t] || {}).topic;
    return w ? `<div class="bn-ln"><i>📝</i><span>Bugun <b>${wTypeName(w)}</b>${w.max ? ` (${w.max} ball)` : ""} — natijalarni kiritish</span></div>`
      : `<div class="bn-ln"><i>📖</i><span>${topic ? `Mavzu: <b>${esc(topic)}</b>` : `<span class="bn-mut">Mavzu kiritilmagan</span>`}</span></div>`; };
  const hwLine = (x, t) => { const p = prevHwOf(x, t); return p ? `<div class="bn-ln"><i>🏠</i><span>Uyga berilgan (${d5(p[0])}): ${esc(p[1])}</span></div>` : ""; };
  const minTxt = (n) => n >= 60 ? `${Math.floor(n / 60)} soat ${n % 60} daqiqa` : `${n} daqiqa`;

  /* ───────── bo'laklar ───────── */
  function header(t, L, tel, M) {
    const q = quarterOf(t), hr = new Date().getHours(), hello = hr < 11 ? "Xayrli tong!" : hr < 17 ? "Xayrli kun!" : "Xayrli kech!";
    let sub = longDate(t); if (q) sub += tel ? ` · ${Math.floor((pdate(t) - pdate(qRange(q)[0])) / 6048e5) + 1}-hafta` : ` · ${q}-chorak, ${Math.floor((pdate(t) - pdate(qRange(q)[0])) / 6048e5) + 1}-hafta`;
    let h1 = tel ? hello : `${hello} <em>${L.length ? `Bugun ${L.length} ta darsingiz bor` : "Bugun darsingiz yo'q"}</em>`;
    const bt = M && BTL.title(M, t, tel); if (bt) { sub = bt[0]; h1 = tel ? bt[1] : `${hello} ${bt[1]}`; }   // chorak tugagandan keyin (bugun-tatil.js)
    const qa = dz().act === "top" && !tel ? `<div class="bn-hdacts">${quick(true)}</div>` : "";
    return `<header class="bn-hd"><div class="bn-t"><span class="bn-sub">${sub}</span><h1>${h1}</h1></div>
      ${tel ? `<button class="bn-ibtn" data-bsrch aria-label="Qidirish">🔍</button>` : `${qa}<div class="bn-srch"><input class="form-control" type="text" id="find" placeholder="O'quvchi yoki sinfni qidirish" autocomplete="off"><div class="bn-found" id="found" hidden></div></div>`}</header>`;
  }
  function quick(compact) {
    const sm = compact ? " btn-sm" : "", tel = phone();
    return `<button class="btn${sm}" data-go2="reports">📄 ${tel || compact ? "Hisobot" : "Sinf hisoboti"}</button>${feat("week") ? `<button class="btn${sm}" data-wk="0">📊 ${tel || compact ? "Hafta" : "Haftalik xulosa"}</button>` : ""}<button class="btn${sm}" data-backup>💾 ${tel || compact ? "Zaxira" : "Faylga saqlash"}</button>`;
  }
  function reminders(tel) {
    const R = [];
    const nowd = D.classes.filter((c) => !isGrp(c) && (!c.weekdays || !c.weekdays.length));
    if (nowd.length) R.push(["warn", "📆", tel ? `<b>${nowd.length === 1 ? esc(label(nowd[0])) : `${nowd.length} ta sinf`}</b>: dars kunlari belgilanmagan` : `<b>${nowd.length} ta sinf</b>${nowd.length <= 3 ? ` (${nowd.map((c) => esc(label(c))).join(", ")})` : ""} uchun dars kunlari belgilanmagan — «Bugun» ro'yxati to'liq bo'lmasligi mumkin.`, `<button class="btn btn-sm" data-days>Belgilash</button>`, ""]);
    if (NEWER) R.push(["bad", "⚠", "Ma'lumotlar ilovaning yangiroq versiyasida saqlangan. Buzilmasligi uchun o'zgarishlar saqlanmaydi — sahifani yangilang (internetga ulanib).", `<button class="btn btn-sm btn-primary" onclick="location.reload()">Yangilash</button>`, ""]);
    if (TG_NEW) { const w = new Date(TG_NEW.date * 1000); R.push(["info", "🔄", `Telegram'da boshqa qurilmadan yangiroq zaxira bor (${fmt(iso(w))} ${pad(w.getHours())}:${pad(w.getMinutes())}).${tgLocalChanged() ? " Shu qurilmada ham o'zgarish bor — birlashtirilsa, ikkalasidagi baholar saqlanadi." : " Shu qurilmaga yuklaysizmi?"}`,
      tgLocalChanged() ? `<span class="bn-two"><button class="btn btn-sm" data-tg="tgkeep">Yo'q</button><button class="btn btn-sm btn-primary" data-tg="tgmerge">Birlashtirish</button></span>`
        : `<span class="bn-two"><button class="btn btn-sm" data-tg="tgkeep">Yo'q</button><button class="btn btn-sm btn-primary" data-tg="tgnew">Yuklash</button></span>`, ""]); }
    const a = backupAge(), tg = tgAge();
    if ((a === null || a > 7) && (tg === null || tg > 7)) R.push(["info", "💾", a === null ? (tel ? "Ma'lumotlar hali faylga saqlanmagan" : "Ma'lumotlar hali faylga saqlanmagan. Brauzer tozalansa, ma'lumot yo'qolishi mumkin.") : (tel ? `Oxirgi zaxira <b>${a} kun</b> oldin olingan` : `Oxirgi zaxira <b>${a} kun</b> oldin olingan. Brauzer tozalansa, ma'lumot yo'qolishi mumkin.`), `<button class="btn btn-sm btn-primary" data-backup2>Saqlash</button>`, ""]);
    const b = feat("bday") ? birthdays(0) : [];
    if (b.length) R.push(["pink", "🎂", `Bugun tug'ilgan kun: ${b.map((x) => `<button class="bn-lnk" data-stud="${x.ci}|${esc(x.s.name)}">${esc(x.s.name)}</button> <span class="bn-mut">(${esc(D.classes[x.ci].name)}${x.age ? `, ${x.age} yosh` : ""})</span>`).join(", ")}${tel ? "" : ". Tabriklashni unutmang!"}`, "", "bday"]);
    if (typeof FNK !== "undefined") R.push(...FNK.rems(tel));   // navbatchi va yaqinlashayotgan BSB/CHSB (funksiyalar.js)
    return R.length ? `<section class="card bn-rems" aria-label="Eslatmalar">${R.map(([c, ic, t, btn, cls]) => `<div class="bn-rm ${c} ${cls}"><span class="bn-ic">${ic}</span><span class="bn-rt">${t}</span>${btn}</div>`).join("")}</section>` : "";
  }
  function hero(t, L, tel) {
    const bot = dz().act === "bot", wide = tel ? "" : ` style="max-width:460px"`;
    if (!L.length) {
      const g = feat("gaps") ? lessonGaps().length : 0;
      return `<section class="card bn-hero fin"><div class="bn-tg"><span class="bn-badge">DARS YO'Q</span></div><div class="bn-nm">Bugun jadvalda dars yo'q</div>
        <div class="bn-meta">Kerak bo'lsa, istalgan sinf jurnalini ochib baho qo'yishingiz mumkin.${g ? " Bo'sh vaqtda to'ldirilmagan darslarni yakunlab qo'ying." : ""}</div>
        <div class="bn-pair"${wide}>${g && tel ? `<button class="btn" data-btab="todo">📝 Vazifalar</button>` : ""}<button class="btn btn-primary" data-go2="journal">📖 Jurnalni ochish</button></div></section>`;
    }
    const H = heroOf(L);
    if (!H) {
      const grades = L.reduce((a, x) => a + x.c.students.reduce((b, s) => b + gradesOf(s.marks[t] || "").length, 0), 0);
      let abs = 0, tot = 0; for (const x of L) { try { const r = reportRows(x.c, t, t).rows; tot += r.length; abs += r.reduce((a, y) => a + (y.absent || 0), 0); } catch (e) { /* hisob bo'lmasa — davomat ko'rsatilmaydi */ } }
      return `<section class="card bn-hero fin"><div class="bn-tg"><span class="bn-badge ok">✓ KUN YAKUNLANDI</span></div><div class="bn-nm">Bugungi ${L.length} ta dars to'ldirildi</div>
        <div class="bn-stats"><div><b>${L.length} / ${L.length}</b><small>yo'qlama</small></div><div><b>${grades}</b><small>baho qo'yildi</small></div>${tot ? `<div><b>${Math.round(100 * (tot - abs) / tot)}%</b><small>davomat</small></div>` : ""}</div>
        <div class="bn-pair"${wide}><button class="btn" data-open="${L[L.length - 1].ci}">📖 Jurnal</button>${feat("week") ? `<button class="btn btn-primary" data-wk="0">📊 Hafta xulosasi</button>` : ""}</div></section>`;
    }
    const h = nowMin(), late = H.st === "late", now = H.st === "now";
    const tag = now ? `<span class="bn-badge now">HOZIR</span><span>${timeTxt(H)} · ${minTxt(mins(H.to) - h)} qoldi</span>`
      : late ? `<span class="bn-badge warn">TO'LDIRILMAGAN</span><span>${timeTxt(H)} · dars tugagan</span>`
      : H.st === "next" ? `<span class="bn-badge next">KEYINGI</span><span>${H.no ? `${H.no}-soat · ` : ""}${H.from} da · ${minTxt(mins(H.from) - h)}dan keyin</span>`
      : `<span class="bn-badge next">BUGUN</span>`;
    return `<section class="card bn-hero ${late ? "late" : ""}"><div class="bn-tg">${tag}</div>
      <div class="bn-nm">${esc(label(H.c))}</div><div class="bn-meta">${esc(H.c.subject && !label(H.c).includes(H.c.subject) ? H.c.subject + " · " : "")}${H.c.students.length} o'quvchi${late ? " · yo'qlama hali qilinmagan" : ""}</div>
      ${noteLine(H, t)}${hwLine(H, t)}
      ${now ? `<div class="bn-tbar" title="Dars vaqti"><i style="width:${Math.max(0, Math.min(100, Math.round(100 * (h - mins(H.from)) / Math.max(1, mins(H.to) - mins(H.from)))))}%"></i></div>` : ""}
      ${bot ? `<div class="bn-mut" style="font-size:12.5px">Tugmalar pastda ↓</div>` : `<div${wide}>${lessonBtns(H, tel)}</div>`}</section>`;
  }
  function timeline(t, L, tel) {
    if (!L.length) return "";
    const H = heroOf(L);
    const rows = L.map((x) => {
      const w = workOf(x, t), g = x.done ? gradedShare(x.c, t) : null, n = x.c.students.filter((s) => s.marks[t]).length;
      const line = x.st === "done" ? `<small class="ok">✓ ${isGrp(x.c) ? "Belgilandi" : "Yo'qlama"} · ${n} belgi</small>` : x.st === "late" ? `<small class="warn">⚠ Yo'qlama qilinmagan</small>`
        : x.st === "now" ? `<small>Hozir davom etmoqda</small>` : w ? `<small>📝 ${wTypeName(w)}${w.max ? ` (${w.max} ball)` : ""}</small>` : `<small class="bn-ell">${(x.c.lessons[t] || {}).topic ? esc(x.c.lessons[t].topic) : "Mavzu kiritilmagan"}</small>`;
      const rt = x.done && w ? `<span class="bn-chip" title="Bugun ${wTypeName(w)}: oddiy baho qo'yilmaydi">📝 ${wTypeName(w)}</span>`
        : g ? `<span class="bn-chip ${g.ok ? "ok" : "warn"}" title="Bugun baholangan: ${g.graded} / ${g.total}; kamida ${GRADED_MIN}% kerak">${Math.round(g.pct)}% ${g.ok ? "✓" : "⚠"}</span>`
        : x.st === "now" ? `<span class="bn-badge now">HOZIR</span>` : x.st === "next" ? `<span class="bn-badge next">KEYINGI</span>` : x.st === "late" ? `<span class="bn-badge warn">${tel ? "!" : "TO'LDIRING"}</span>` : "";
      return `<button class="bn-ls ${x.st} ${x === H ? "cur" : ""}" data-les="${x.ci}"><span class="bn-tm">${x.from ? `<b>${x.from}</b><small>${x.to}</small>` : `<b>—</b>`}</span><span class="bn-dot"></span>
        <span class="bn-tx"><b class="bn-ell">${esc(label(x.c))}</b>${line}</span><span class="bn-r">${rt}${tel ? "" : `<span class="bn-car">›</span>`}</span></button>`;
    }).join("");
    return `<section class="card"><div class="bn-ch"><h2>Bugungi darslar</h2><span class="bn-cnt">${L.filter((x) => x.done).length} / ${L.length} tugadi</span></div><div class="bn-tl ${L.some((x) => x.from) ? "" : "notime"}">${rows}</div></section>`;
  }
  // «Bajarish kerak»: to'ldirilmagan darslar, BSB/CHSB tahlili qilinmagan ishlar, chorak yakuni, KTR
  function todoData() {
    const gaps = feat("gaps") ? lessonGaps() : [];
    const qe = feat("qend") && quarterEnd();
    const qrows = qe ? D.classes.map((c, ci) => ({c, ci, g: quarterGaps(c, qe.q)})).filter((x) => !isGrp(x.c) && (x.g.low.length || x.g.noScore.length)) : [];
    const ktr = feat("ktr") ? D.classes.map((c, ci) => ({c, ci, k: ktrProgress(c)})).filter((x) => x.k && (x.k.behind >= 2 || x.k.short)) : [];
    const an = analysisGaps();
    return {gaps, qe, qrows, ktr, an, n: gaps.length + an.rows.length + qrows.length + ktr.length};
  }
  function todoBody(T) {
    const out = [];
    if (T.gaps.length) out.push(`<div class="bn-grp gaps"><div class="bn-g">📝 To'ldirilmagan darslar<span>oxirgi ${GAP_DAYS} kun</span></div>${T.gaps.slice(0, 5).map((x) => `<div class="bn-ti ${x.noAtt ? "two" : ""}"><span class="bn-tx"><b class="bn-ell">${esc(label(x.c))}</b><small>${d5(x.d)} ${WD[pyWd(x.d)]} · ${[x.noAtt ? "yo'qlama belgilanmagan" : "", x.noTopic ? "mavzu yozilmagan" : ""].filter(Boolean).join(", ")}</small></span>
      <span class="bn-r">${x.noAtt ? `<button class="btn btn-sm" data-gapok="${x.ci}|${x.d}" title="${isGrp(x.c) ? "Hammaga «dars o'tildi»" : "Hech kim qoldirmagan bo'lsa"}">${allokLabel(x.c)}</button>` : ""}<button class="btn btn-sm" data-gap="${x.ci}|${x.d}|${x.noAtt ? 1 : 0}">To'ldirish</button></span></div>`).join("")}${T.gaps.length > 5 ? `<div class="bn-more2">va yana ${T.gaps.length - 5} ta</div>` : ""}</div>`);
    if (T.an.rows.length) out.push(`<div class="bn-grp anl"><div class="bn-g">🔍 Summativ tahlili qilinmagan<span>${T.an.q}-chorak</span></div>${T.an.rows.map(({c, ci, works}) => `<div class="bn-ti"><span class="bn-tx"><b class="bn-ell">${esc(label(c))}</b><small class="bn-anw">${works.map((w) => `<button type="button" data-anl="${ci}|${esc(w.id)}" title="${esc(w.title || "")}">${wTypeName(w)} ${d5(w.date)}</button>`).join("")}</small></span>
      <span class="bn-r"><button class="btn btn-sm" data-anl="${ci}|${esc(works[0].id)}" title="«Summativ tahlili»da shu ishni ochadi">Tahlil qilish</button></span></div>`).join("")}</div>`);
    if (T.qe) out.push(`<div class="bn-grp qend"><div class="bn-g">📋 ${T.qe.q}-chorak tugashiga ${T.qe.left ? `${T.qe.left} kun` : "bugun"} qoldi<span>${d5(T.qe.end)}</span></div>${T.qrows.length ? T.qrows.map(({c, ci, g}) => `<div class="bn-ti"><span class="bn-tx"><b class="bn-ell">${esc(label(c))}</b><small>${[g.low.length ? `${g.low.length} o'quvchida formativ baho kam (kamida ${fbMin()} ta kerak)` : "", g.noScore.length ? `${g.noScore.length} o'quvchida BSB/CHSB balli yo'q` : "", feat("debts") && (() => { const [lo, hi] = periodNow(), n = c.students.reduce((a, st) => a + debtsOf(c, st, lo, hi).filter((d) => !d.done).length, 0); return n ? `qarzlar: ${n}` : ""; })(), `qolgan darslar: ${g.left}`].filter(Boolean).join(" · ")}</small></span>
      <span class="bn-r"><button class="btn btn-sm" data-qready="${ci}">Ko'rish</button></span></div>`).join("") : `<div class="bn-okl">✓ Hamma sinflarda baholar va ballar yetarli — chorak bahosini qo'yishga tayyor.</div>`}</div>`);
    if (T.ktr.length) out.push(`<div class="bn-grp"><div class="bn-g">📚 KTR: rejadan orqada</div>${T.ktr.map(({c, ci, k}) => `<div class="bn-ti"><span class="bn-tx"><b class="bn-ell">${esc(label(c))}</b><small>${ktrLine(k)}</small></span><span class="bn-r"><button class="btn btn-sm" data-ktr="${ci}">Reja</button></span></div>`).join("")}</div>`);
    // ta'til: qulflangan chorakdan qolgan ishlar bitta qatorda (bugun-tatil.js)
    const lk = T.lk && T.M ? BTL.lockedRow(T.M, T.lk) : "";
    return `<div class="bn-todo">${out.join("") || `<div class="bn-okl">✓ ${T.M && T.M.k === "arx" ? `${T.M.q < 4 ? T.M.q + 1 + "-chorak uchun hozircha" : "Hozircha"} ish yo'q.` : "Hamma ishlar bajarilgan — to'ldirilmagan dars yo'q."}</div>`}${lk}</div>`;
  }
  const todoChip = (T) => T.M && T.M.k === "grace" && T.M.due && T.n ? `<span class="bn-cnt warn">Arxivgacha ${Math.round((pdate(T.M.due) - pdate(todayIso())) / 864e5)} kun</span>` : T.n ? `<span class="bn-cnt warn">${T.n}</span>` : "";
  const todoCard = (T) => `<section class="card bn-todoc"><div class="bn-ch"><h2>Bajarish kerak</h2>${todoChip(T)}</div>${todoBody(T)}</section>`;
  function riskList() {
    const risk = riskOverview().flatMap((r) => r.names.map((n) => ({ci: r.ci, ...n})));
    for (const h of hwOverview()) { const x = risk.find((r) => r.ci === h.ci && r.name === h.name); if (x) x.why = x.why.concat(h.why); else risk.push(h); }
    return risk;
  }
  function riskBody(risk) {
    if (!risk.length) return `<div class="bn-okl" style="padding:4px 16px 14px">Hozircha hamma o'quvchi me'yorda — xavf ostida hech kim yo'q. 👍</div>`;
    const N = 5;
    return `<div class="bn-rl">${risk.slice(0, N).map((r) => `<button class="bn-ri" data-stud="${r.ci}|${esc(r.name)}"><span class="bn-av">${esc(initials(r.name))}</span><span class="bn-tx"><b class="bn-ell">${esc(r.name)} <small>· ${esc(D.classes[r.ci].name)}</small></b><span class="bn-why">${r.why.slice(0, 2).map((w) => `<span class="bn-chip bad">${esc(w)}</span>`).join("")}</span></span></button>`).join("")}</div>
      <div class="bn-more">${risk.length > N ? `<span>va yana ${risk.length - N} ta</span>` : "<span></span>"}<button class="bn-lnk" data-go2="reports">Hammasi →</button></div>`;
  }
  const riskCard = (risk, top = "") => `<section class="card"><div class="bn-ch"><h2>E'tibor talab qiladi</h2>${risk.length ? `<span class="bn-cnt bad">${risk.length}</span>` : ""}</div>${top}${riskBody(risk)}</section>`;
  const tone = (v) => v >= 85 ? "var(--ok)" : v >= 70 ? "var(--acc)" : v >= 55 ? "var(--bn-warn-b)" : "var(--danger)";
  const mb = (v) => v === null || v === undefined ? `<span class="bn-mut">—</span>` : `<span class="bn-mb"><span class="bn-tr"><i style="width:${Math.max(0, Math.min(100, v))}%;background:${tone(v)}"></i></span><b>${Math.round(v)}%</b></span>`;
  const gp = (v) => v === null || v === undefined ? `<span class="bn-gp">—</span>` : `<span class="bn-gp ${v < 5 ? "lo" : v < 8 ? "mid" : "hi"}">${v.toFixed(2)}</span>`;
  // Ta'til kunlari joriy chorak yo'q — oxirgi tugagan chorak natijasi ko'rsatiladi (aks holda O'zlashtirish hisoblanmaydi)
  function clsRows(t) {
    let q = quarterOf(t), hi = t;
    if (!q) { q = [4, 3, 2, 1].find((k) => { const r = qRange(k); return r && r[1] < t; }) || null; if (q) hi = qRange(q)[1]; }
    const lo = q ? qRange(q)[0] : t.slice(0, 8) + "01";
    return {q, lo, hi, R: compareRows(lo, hi, q).filter((r) => r.n)};
  }
  function clsBody(C, tel) {
    if (!C.R.length) return `<div class="bn-okl bn-mut" style="padding:4px 16px 14px">Hali ma'lumot yo'q.</div>`;
    const ci = (r) => D.classes.indexOf(r.c);
    return tel ? `<div class="clsstat">${C.R.map((r) => `<button class="bn-cr" data-cls="${ci(r)}"><span class="bn-l1"><b class="bn-ell">${esc(label(r.c))}</b>${r.risk ? `<span class="bn-chip bad">⚠ ${r.risk}</span>` : ""}${gp(r.avg)}</span><span class="bn-l2"><span><small>Davomat</small>${mb(r.att)}${BTL.was(C.prev, r.c, "att")}</span><span><small>O'zlashtirish</small>${mb(r.qu ?? r.qp)}${BTL.was(C.prev, r.c, "qu")}</span></span></button>`).join("")}</div>`
      : `<div class="clsstat"><table class="bn-ct"><thead><tr><th>Sinf</th><th>Davomat</th><th title="O'rtacha jami ball (100 dan). Chorak tugamagan bo'lsa — shu kungacha olingan ball ÷ maksimal ball">O'zlashtirish</th><th class="s">O'rtacha</th><th class="s">Xavf</th></tr></thead><tbody>${C.R.map((r) => `<tr data-cls="${ci(r)}" tabindex="0"><td><b>${esc(label(r.c))}</b></td><td>${mb(r.att)}${BTL.was(C.prev, r.c, "att")}</td><td>${mb(r.qu ?? r.qp)}${BTL.was(C.prev, r.c, "qu")}</td><td class="s">${gp(r.avg)}${BTL.was(C.prev, r.c, "avg")}</td><td class="s">${r.risk ? `<span class="bn-chip bad">${r.risk}</span>` : `<span class="bn-mut">—</span>`}</td></tr>`).join("")}</tbody></table></div>`;
  }
  const clsCard = (C, t) => C.R.length ? `<section class="card" style="overflow:hidden"><div class="bn-ch"><h2>Sinflar ko'rsatkichi</h2><span class="bn-mut bn-per">${C.q ? `${C.q}-chorak · ` : ""}${d5(C.lo)} – ${d5(C.hi)}</span></div>${clsBody(C, false)}</section>` : "";
  function upcomingCard() {
    const U = upcomingItems(); if (!U.length) return "";
    return `<section class="card"><div class="bn-ch"><h2>Yaqin kunlarda</h2></div><div class="bn-up">${U.slice(0, 6).map((u) => `<div class="bn-ui"><span class="bn-dt ${u.left <= 2 ? "hot" : ""}"><b>${u.date.slice(8)}</b><small>${WD[pyWd(u.date)]}</small></span><span class="bn-tx"><b class="bn-ell">${esc(u.title)}</b><small>${esc(u.sub)}</small></span></div>`).join("")}</div></section>`;
  }
  function week() {
    const wr = feat("week") && weekCardRange(); if (!wr || D.web.wk_seen === wr[0]) return "";
    const [lo, hi, back] = wr, T = weekTotals(weekSummary(lo, hi)); if (!T.planned && !T.grades) return "";
    return `<section class="card bn-wk wkc"><div class="bn-top"><h3>📊 ${back ? "O'tgan hafta" : "Hafta"} · ${d5(lo)}–${d5(hi)}</h3><button class="bn-x" data-wkx="${lo}" title="Yopish" aria-label="Yopish">✕</button></div>
      <div class="bn-nums"><div><b>${T.held} / ${T.planned}</b><small>dars</small></div><div><b>${T.grades}</b><small>baho${T.avg !== null ? ` · o'rt. ${pyFixed(T.avg, 1)}` : ""}</small></div><div><b>${T.att !== null ? Math.round(T.att) + "%" : "—"}</b><small>davomat</small></div></div>
      <div style="font-size:13px">${T.newRisk ? `<span class="bn-warnt">⚠ ${T.newRisk} o'quvchi xavf ostiga yangi tushdi</span>` : `<span class="bn-okt">✓ Yangi xavf yo'q</span>`}${T.outRisk ? ` <span class="bn-mut">· ${T.outRisk} o'quvchi xavfdan chiqdi</span>` : ""}</div>
      <div><button class="btn btn-sm" data-wk="${back}">Batafsil</button></div></section>`;
  }
  const quickCard = () => `<section class="card bn-qa"><h3>Tezkor amallar</h3>${quick(false)}</section>`;
  function stick(L, tel) {
    const H = heroOf(L); if (!H) return "";
    const t = `${H.st === "now" ? "Hozir" : H.st === "late" ? "To'ldirilmagan" : H.st === "next" ? "Keyingi" : "Bugun"}: <b>${esc(label(H.c))}</b>${H.from ? ` · ${H.from}–${H.to}` : ""}`;
    return `<div class="bn-stick"><small class="bn-ell">${t}</small>${lessonBtns(H, tel)}</div>`;
  }

  /* ───────── oynalar ───────── */
  const sheetHead = (title) => `<div class="bn-shd"><h2 class="bn-ell">${title}</h2><button class="bn-x" data-x aria-label="Yopish">✕</button></div>`;
  function lessonSheet(ci) {
    const t = todayIso(), L = lessons(), x = L.find((y) => y.ci === ci); if (!x) return;
    const g = x.done ? gradedShare(x.c, t) : null, n = x.c.students.filter((s) => s.marks[t]).length, w = workOf(x, t);
    const sb = {done: `<span class="bn-badge ok">✓ ${isGrp(x.c) ? "BELGILANDI" : "YO'QLAMA QILINDI"}</span>`, now: `<span class="bn-badge now">HOZIR</span>`, next: `<span class="bn-badge next">KEYINGI</span>`, late: `<span class="bn-badge warn">TO'LDIRILMAGAN</span>`, later: `<span class="bn-badge">KEYINROQ</span>`, wait: `<span class="bn-badge next">BUGUN</span>`}[x.st];
    modal(`<div class="bn bn-sheet ${dz().pri === "left" ? "pl" : ""}">${sheetHead(esc(label(x.c)))}<div class="bn-lsd"><div class="bn-tools">${sb}<span class="bn-mut" style="font-size:13px;font-weight:600">${[timeTxt(x), `${x.c.students.length} o'quvchi`].filter(Boolean).join(" · ")}</span></div>
      ${w ? `<div class="bn-ln"><i>📝</i><span>Bugun <b>${wTypeName(w)}</b>${w.max ? ` (${w.max} ball)` : ""} — oddiy baho qo'yilmaydi, ballar «Umumiy» sahifasida</span></div>` : noteLine(x, t)}${hwLine(x, t)}
      ${x.done ? `<div class="bn-ln"><i>✅</i><span>${n} ta belgi${g && !w ? ` · bugun baholangan <b class="${g.ok ? "bn-okt" : "bn-warnt"}">${g.graded} / ${g.total} (${Math.round(g.pct)}%)</b>${g.ok ? "" : ` — kamida ${GRADED_MIN}% kerak`}` : ""}</span></div>` : ""}</div>
      ${x.done ? pair(`<button class="btn" data-lt>✎ Mavzu</button>`, `<button class="btn btn-primary" data-open="${x.ci}">📖 Jurnalni ochish</button>`)
        : `${lessonBtns(x, phone())}${pair(`<button class="btn" data-lt>✎ Mavzu</button>`, `<button class="btn" data-open="${x.ci}">📖 Jurnal</button>`)}`}</div>`, (mm, close) => {
      mm.querySelector("[data-x]").onclick = () => close();
      bindActs(mm, close);
      mm.querySelector("[data-lt]").onclick = () => { close(); lessonsDialog(x.ci, t); };
    });
  }
  function searchSheet() {
    modal(`<div class="bn bn-sheet">${sheetHead("Qidirish")}<input class="form-control bn-sin" type="text" id="find2" placeholder="O'quvchi yoki sinf nomi" autocomplete="off"><div class="bn-opts" id="found2"><div class="bn-mut" style="padding:6px 4px;font-size:13px">Kamida 2 ta harf yozing. Masalan: «Ali», «9-A».</div></div></div>`, (mm, close) => {
      mm.querySelector("[data-x]").onclick = () => close();
      const f = mm.querySelector("#find2"), box = mm.querySelector("#found2"); f.focus();
      f.oninput = () => { const q = f.value.trim(); box.innerHTML = q.length >= 2 ? found(q) : ""; bindFound(box, close); };
    });
  }
  function found(q) {
    const qq = q.toLowerCase(), out = [];
    D.classes.forEach((c, ci) => {
      if (label(c).toLowerCase().includes(qq)) out.push(`<button class="bn-opt" data-cls="${ci}"><span class="bn-oic">📖</span><span><b>${esc(label(c))}</b><small>${isGrp(c) ? "Guruh" : "Sinf"} · ${c.students.length} o'quvchi</small></span></button>`);
      c.students.forEach((s) => { if (s.name.toLowerCase().includes(qq)) out.push(`<button class="bn-opt" data-stud="${ci}|${esc(s.name)}"><span class="bn-oic">${esc(initials(s.name))}</span><span><b>${esc(s.name)}</b><small>${esc(label(c))}</small></span></button>`); });
    });
    return out.length ? out.slice(0, 20).join("") : `<div class="bn-mut" style="padding:8px">Topilmadi</div>`;
  }
  function bindFound(box, close) {
    box.querySelectorAll("[data-cls]").forEach((b) => b.onclick = () => { close && close(); S.ci = +b.dataset.cls; go("journal"); });
    box.querySelectorAll("[data-stud]").forEach((b) => b.onclick = () => { close && close(); const [ci, n] = b.dataset.stud.split("|"); studentCard(+ci, n); });
  }

  /* ───────── sahifa ───────── */
  function page(m) {
    const t = todayIso(), tel = phone(); wasPhone = tel;
    const M = BTL.mode(t), G = M && M.k === "grace", A = M && M.k === "arx";   // chorak tugagandan keyin → bugun-tatil.js
    const L = lessons(), T = {...BTL.filterTodo(todoData(), M), M}, risk = riskList(), C = clsRows(t), z = dz(), bot = z.act === "bot";
    C.prev = BTL.prev(M);
    const aq = BAX.quarter(t), AX = aq ? BAX.data(aq) : null;   // ta'til + chorak arxivlangan → bugun-arxiv.js
    const R = G ? BTL.readyRows(M.q) : null, low = G || A ? BTL.lowCard(M) : null, top = BTL.lowTop(M);
    // bosh karta: arxivgacha — «Chorakni yopish», ta'tilda — «Ta'til»; dars bo'lsa odatdagi karta ham qoladi
    const lead = (tel2) => G ? `${BTL.closeCard(M, R, tel2)}${L.length ? hero(t, L, tel2) : ""}` : A ? `${BTL.vacCard(M, tel2)}${L.length ? hero(t, L, tel2) : ""}` : hero(t, L, tel2);
    const emk = (tel2) => A ? "" : EMK1.card(tel2), wk = () => G || A ? "" : week();
    let body;
    if (tel) {
      const tabs = A ? [["todo", "Vazifalar", T.n], ["res", "Natija", 0], ["risk", "E'tibor", low.n]]
        : G ? [["todo", "Vazifalar", T.n], ["risk", "E'tibor", low.n]]
        : [["todo", "Vazifalar", T.n], ["risk", "E'tibor", risk.length], ["cls", "Sinflar", C.R.length]];
      const tab = tabs.some((x) => x[0] === S.btab) ? S.btab : "todo";
      const tb = tab === "todo" ? todoBody(T) : tab === "risk" ? (low ? low.body : top + riskBody(risk))
        : tab === "res" ? (AX ? `<div class="ba-tel">${BAX.banner(AX)}${BAX.clsCard(AX, true)}</div>` : clsBody(C, true))
        : AX ? `<div class="ba-tel">${BAX.banner(AX)}${BAX.clsCard(AX, true)}</div>` : clsBody(C, true);
      body = `${header(t, L, true, M)}${z.act === "top" ? `<div class="bn-qrow">${quick(false)}</div>` : ""}${reminders(true)}${BTL.strip(M, true)}${emk(true)}${G ? "" : ARX.todayCard(true)}${lead(true)}${timeline(t, L, true)}${G ? BTL.readyCard(M, R, true) : ""}
        <div class="tgrid bn-one"><div class="bn-col">${wk()}<section class="card${tab === "todo" ? " bn-todoc" : ""}" style="overflow:hidden"><div style="padding:8px"><div class="bn-seg" role="tablist">${tabs.map(([k, n, c]) => `<button role="tab" aria-selected="${tab === k}" class="${tab === k ? "on" : ""}" data-btab="${k}">${n}${c ? `<em>${c}</em>` : ""}</button>`).join("")}</div></div>${tb}</section>
        ${upcomingCard()}${z.act !== "top" ? quickCard() : ""}</div></div>${bot ? stick(L, true) : ""}`;
    } else {
      const rc = low ? `<section class="card"><div class="bn-ch"><h2>E'tibor talab qiladi</h2>${low.n ? `<span class="bn-cnt bad">${low.n}</span>` : ""}</div>${low.body}</section>` : riskCard(risk, top);
      body = `${header(t, L, false, M)}${reminders(false)}${BTL.strip(M, false)}${emk(false)}${G ? "" : ARX.todayCard(false)}${AX ? BAX.banner(AX) : ""}
        <div class="tgrid bn-grid"><div class="bn-col">${lead(false)}${timeline(t, L, false)}${G ? BTL.readyCard(M, R, false) : AX ? BAX.clsCard(AX, false) : clsCard(C, t)}${upcomingCard()}</div>
          <div class="bn-col">${wk()}${todoCard(T)}${rc}${z.act !== "top" ? quickCard() : ""}</div></div>${bot ? stick(L, false) : ""}`;
    }
    m.innerHTML = `<div class="bn ${z.pri === "left" ? "pl" : ""}">${body}</div>`;
    bindPage(m, t); BAX.bind(m); EMK1.bind(m); BTL.bind(m);
  }
  // amal tugmalari (sahifa va dars oynasi uchun umumiy)
  function bindActs(root, close) {
    const cl = () => close && close();
    const t = todayIso();
    root.querySelectorAll("[data-start]").forEach((b) => b.onclick = () => { cl(); startLesson(+b.dataset.start); });
    root.querySelectorAll("[data-open]").forEach((b) => b.onclick = () => { cl(); S.ci = +b.dataset.open; go("journal"); });
    // tezkor yo'qlama: kelmaganlar belgisi yo'q, kun «yo'qlama qilindi» deb belgilanadi
    root.querySelectorAll("[data-allok]").forEach((b) => b.onclick = () => {
      cl(); const c = D.classes[+b.dataset.allok]; allDone(c, t); save(); render();
      toast(isGrp(c) ? `${label(c)}: hammaga dars o'tildi ✓` : `${label(c)}: hamma keldi ✓ — kimdir kelmagan bo'lsa, «Jurnalni ochish» orqali belgilang`);
    });
  }
  function bindPage(m, t) {
    bindActs(m);
    const on = (sel, fn) => m.querySelectorAll(sel).forEach((b) => b.onclick = () => fn(b));
    on("[data-les]", (b) => lessonSheet(+b.dataset.les));
    on("[data-btab]", (b) => { S.btab = b.dataset.btab; render(); if (b.closest(".bn-hero")) { const s = $(".bn-seg", m); if (s) s.scrollIntoView({behavior: "smooth", block: "start"}); } });
    on("[data-go2]", (b) => go(b.dataset.go2));
    on("[data-ktr]", (b) => ktrDialog(+b.dataset.ktr));
    on("[data-anl]", (b) => { const [ci, wid] = b.dataset.anl.split("|"); openAnalysis(+ci, wid); });
    on("[data-wk]", (b) => weekDialog(+b.dataset.wk));
    on("[data-wkx]", (b) => { D.web.wk_seen = b.dataset.wkx; save(); render(); });
    on("[data-gapok]", (b) => { const [ci, d] = b.dataset.gapok.split("|"), c = D.classes[+ci]; allDone(c, d); save(); render(); toast(`${label(c)} · ${fmt(d)}: ${isGrp(c) ? "dars o'tildi" : "hamma keldi"} ✓`); });
    on("[data-gap]", (b) => {
      const [ci, d, na] = b.dataset.gap.split("|"); S.ci = +ci; V.anchor = d;
      if (na === "1") { S.page = "journal"; S.jpage = "j"; V.mode = "day"; V.anchor = d; go("journal"); toast(`${fmt(d)}: kelmaganlarni belgilang`); }
      else lessonsDialog(+ci, d);
    });
    on("[data-qready]", (b) => { S.rep.ci = +b.dataset.qready; S.rep.kind = "ready"; S.rq = quarterEnd().q; go("reports"); });
    on("[data-stud]", (b) => { const [ci, n] = b.dataset.stud.split("|"); studentCard(+ci, n); });
    on("[data-cls]", (b) => { S.ci = +b.dataset.cls; go("journal"); });
    m.querySelectorAll("tr[data-cls]").forEach((tr) => tr.onkeydown = (e) => { if (e.key === "Enter") tr.click(); });
    on("[data-days]", () => { S.sec = 1; go("settings"); });
    on("[data-backup]", () => exportJson());
    on("[data-backup2]", () => { exportJson(); render(); });
    on("[data-tg]", (b) => tgAction(b.dataset.tg));
    on("[data-bsrch]", () => searchSheet());
    const f = $("#find", m);
    if (f) {
      const box = $("#found", m);
      f.oninput = () => { const q = f.value.trim(); box.hidden = q.length < 2; box.innerHTML = q.length >= 2 ? found(q) : ""; bindFound(box, null); };
      f.onkeydown = (e) => { if (e.key === "Escape" && f.value) { e.preventDefault(); f.value = ""; box.hidden = true; } };
    }
  }
  // telefon ↔ kompyuter chegarasidan o'tilganda sahifa qayta chiziladi (joylashuv JS da tanlanadi)
  window.addEventListener("resize", () => { if (typeof S !== "undefined" && S.page === "today" && wasPhone !== null && phone() !== wasPhone && !document.querySelector(".modal")) render(); });
  return {page};
})();
