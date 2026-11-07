/* Sozlamalar bo'limi — tasdiqlangan dizayn (maket v1, Akmal 2026-11-01). Ko'rinish shu faylda; amallar va saqlash index.html da
   (pageSettings ichidagi bog'lashlar, settingsAction, remToggle, tgAction, scheduleEditor, genQuarter …).
   Bu fayl asosiy skriptdan OLDIN ulanadi; ichidagi funksiyalar asosiy skriptdagi nomlarni faqat chaqirilganda ishlatadi.
   Kompyuterda: chapda bo'limlar ro'yxati (3 guruh, har birida holat), o'ngda tanlangan bo'lim. Telefonda: avval bo'limlar
   ro'yxati (S.sec = -1), bosilgan bo'lim o'z sahifasida, tepada «‹ Sozlamalar». Qidiruv sozlama qatoriga olib boradi.
   Eski ma'lumot belgilari (data-a, data-wd, data-q, data-rk, data-ft …) o'zgarmagan. 3-bo'lim — Dizayn (dizayn.js). */
const SZL = (() => {
  const phone = () => matchMedia("(max-width:820px)").matches;
  const dz = () => (typeof DZN !== "undefined" ? DZN.cfg() : {act: "end", pri: "right"});
  // [belgi, nomi, qisqa izoh]
  const SECS = [["👥", "Sinflar va o'quvchilar", "Sinf qo'shish, ro'yxatlar"], ["📅", "Dars kunlari va choraklar", "Jadval, eslatmalar, choraklar"], ["🎯", "Baholash", "Baho ranglari, xavf mezonlari"],
    ["🎨", "Dizayn", "Mavzu, rang, tugmalar joyi"], ["🔒", "Himoya", "Baholarni qulflash, parol"], ["💾", "Ma'lumotlar", "Zaxira, import, o'quv yili"], ["🧩", "Funksiyalar", "Keraksizlarini yashirish"]];
  const GROUPS = [["O'quv jarayoni", [0, 1, 2]], ["Dastur", [3, 6]], ["Xavfsizlik", [4, 5]]];
  const RISK_SHORT = {default: "Asosiy", att: "Davomat", grade: "Baho", all: "Hammasi", none: "Yo'q"};
  let flash = null, q = "", wasPhone = null;

  /* ───────── bo'laklar ───────── */
  const tog = (attrs, on, name) => `<button class="sz-tg ${on ? "on" : ""}" role="switch" aria-checked="${!!on}" aria-label="${esc(name || "")}" ${attrs}><i aria-hidden="true"></i></button>`;
  const row = (id, t, h, ctl, cls = "") => `<div class="sz-r ${cls} ${flash === id ? "sz-flash" : ""}" id="sz-${id}"><div class="sz-st"><b>${t}</b>${h ? `<small>${h}</small>` : ""}</div>${ctl ? `<div class="sz-sc">${ctl}</div>` : ""}</div>`;
  const grp = (t, html, extra = "", hint = "", id = "") => html ? `<section class="sz-sg" ${id ? `id="sz-${id}"` : ""}>${t ? `<h3 class="sz-sgt">${t}${extra}</h3>` : ""}${hint ? `<p class="sz-hint">${hint}</p>` : ""}<div class="sz-card sz-box">${html}</div></section>` : "";
  const cnt = (t) => `<span class="sz-cnt">${t}</span>`;
  // − [qiymat] + : ichida oddiy raqam maydoni (eski id va data- belgilari shu maydonda)
  const stp = (attrs, v, u, step = 1, min = 0, name = "") => `<span class="sz-stp"><button type="button" data-szs="-1" aria-label="Kamaytirish">−</button><input type="number" inputmode="decimal" step="${step}" min="${min}" value="${v}" aria-label="${esc(name)}" ${attrs}>${u ? `<em>${u}</em>` : ""}<button type="button" data-szs="1" aria-label="Oshirish">+</button></span>`;
  const pairBtns = (acts) => {
    if (!acts || !acts.length) return "";
    const b = acts.map(([l, attrs, p]) => [p, `<button class="btn ${p ? "btn-primary" : ""}" ${attrs}>${l}</button>`]);
    b.sort((x, y) => dz().pri === "left" ? y[0] - x[0] : x[0] - y[0]);
    return `<div class="sz-pair">${b.map((x) => x[1]).join("")}</div>`;
  };
  const fmtHol = (s) => s.length === 5 ? `${s.slice(3)}.${s.slice(0, 2)}` : fmt(s);
  const userCls = () => D.classes.filter((c) => !isGrp(c));
  const noDays = () => D.classes.filter((c) => !(c.weekdays || []).length);

  // bo'lim holati (ro'yxatda nom ostida): [matn, e'tibor kerakmi]
  function status(i) {
    const st = D.settings, cl = userCls();
    if (i === 0) return [`${cl.length} sinf · ${cl.reduce((a, c) => a + c.students.length, 0)} o'quvchi`, 0];
    if (i === 1) { const n = noDays().length; return n ? [`${n} ta sinfda dars kunlari yo'q`, 1] : [sched() ? "Jadval kiritilgan" : "Jadval kiritilmagan", 0]; }
    if (i === 2) return [`${RISK_TYPES.filter(([k]) => st.risk.on[k]).length} / ${RISK_TYPES.length} xavf turi yoqilgan`, 0];
    if (i === 3) { const z = dz(), t = typeof DZN !== "undefined" ? DZN.THEMES[z.theme] : null; return [t ? `${t[0]} · ${DZN.isDark() ? "tungi" : "kunduzgi"}` : "", 0]; }
    if (i === 4) return [st.protect.enabled ? `Yoqilgan${st.protect.pin ? " · parol bor" : ""}` : "O'chiq", 0];
    if (i === 5) { if (tgOn()) return ["Telegram'ga zaxira ulangan", 0]; const a = backupAge(); return a === null ? ["Zaxira hali olinmagan", 1] : [`Zaxira ${a ? `${a} kun oldin` : "bugun"}`, a > 7 ? 1 : 0]; }
    return [`${FNK.ALL.filter(feat).length} / ${FNK.ALL.length} yoqilgan`, 0];
  }

  /* ───────── bo'limlar: {body, acts, what} ───────── */
  function sec0() {
    const cl = D.classes.map((c, i) => [c, i]).filter(([c]) => !isGrp(c)), tel = phone();
    const nS = cl.reduce((a, [c]) => a + c.students.length, 0), nO = cl.reduce((a, [c]) => a + c.students_off.length, 0);
    const sum = `<div class="sz-sum"><div><b>${cl.length}</b><small>sinf</small></div><div><b>${nS}</b><small>o'quvchi</small></div><div><b>${nO}</b><small>faolsiz</small></div></div>`;
    const rows = cl.map(([c, i]) => {
      const off = c.students_off.length, sub = `${c.students.length} o'quvchi${off ? ` · +${off} faolsiz` : ""} · ${c.dates.length ? `${c.dates.length} dars kuni` : `<span class="sz-warn-t">dars kunlari yo'q</span>`}`;
      return tel
        ? `<button class="sz-r sz-click sz-cls ${flash === "cls" + i ? "sz-flash" : ""}" id="sz-cls${i}" data-a="cmore" data-i="${i}"><span class="sz-av">${esc(c.name.slice(0, 4))}</span><span class="sz-st"><b class="sz-ell">${esc(label(c))}</b><small>${sub}</small></span><span class="sz-car">›</span></button>`
        : `<div class="sz-r sz-cls ${flash === "cls" + i ? "sz-flash" : ""}" id="sz-cls${i}"><span class="sz-av">${esc(c.name.slice(0, 4))}</span><div class="sz-st"><b>${esc(label(c))}</b><small>${sub}</small></div>
          <div class="sz-sc"><button class="btn btn-sm" data-a="stud" data-i="${i}">＋ O'quvchi</button><button class="btn btn-sm" data-a="rmst" data-i="${i}">⏸ Faolsiz${off ? ` (${off})` : ""}</button><button class="btn btn-sm" data-a="cmore" data-i="${i}" title="Yana: jurnal, tahrirlash, o'chirish" aria-label="Yana">⋯</button></div></div>`;
    }).join("");
    return {body: sum + (cl.length ? grp("Sinflaringiz", rows, cnt(cl.length)) : grp("", row("addc0", "Hali sinf yo'q", "«＋ Sinf qo'shish» tugmasini bosing", ""))) +
      `<p class="sz-hint">${D.classes.some(isGrp) ? "TPT guruhlari bu yerda emas — ular «Guruhlar» bo'limida boshqariladi. " : ""}Sinf ro'yxatini Excel yoki Word'dan nusxalab qo'yish mumkin.</p>`,
      acts: [["＋ Sinf qo'shish", 'data-a="addc"', 1]], what: "Yangi sinf"};
  }
  function sec1() {
    const st = D.settings, t = todayIso(), tel = phone(), sc = sched();
    const nL = sc ? sc.days.reduce((a, d) => a + d.filter(Boolean).length, 0) : 0;
    const wkm = sc ? `<span class="sz-wkm">${WD.slice(0, 6).map((w, k) => { const n = (sc.days[k] || []).filter(Boolean).length; return `<span>${w}<b>${n || "–"}</b></span>`; }).join("")}</span>` : "";
    const schRow = row("sch", "📅 Dars jadvali", sc ? `Haftasiga ${nL} ta dars · ${sc.bells.length} soatlik kun. Dars kunlari va «Bugun» sahifasi shu jadvalga qarab ishlaydi.${wkm}`
      : "Haftalik jadvalni bir marta kiriting — «Bugun» sahifasi darslarni soat tartibida ko'rsatadi, dars kunlari o'zi belgilanadi.",
      `<button class="btn ${sc ? "" : "btn-primary"}" data-a="sch">${sc ? "✎ Tahrirlash" : "Kiritish"}</button>`, "wide");
    const short = (c) => tel && label(c).length > 14 ? `${c.name} ${c.subject ? c.subject.slice(0, 6) + "." : ""}` : label(c);
    const mx = `<table class="sz-mx"><thead><tr><th>Sinf</th>${WD.slice(0, 6).map((w) => `<th>${w}</th>`).join("")}</tr></thead><tbody>${D.classes.map((c, i) => {
      const wd = c.weekdays || [];
      return `<tr id="sz-wd${i}" class="${flash === "wd" + i ? "sz-flash" : ""}"><td><span class="sz-ell" style="display:block" title="${esc(label(c))}">${esc(short(c))}</span>${wd.length ? "" : `<small class="sz-warn-t">⚠ belgilanmagan</small>`}</td>${WD.slice(0, 6).map((w, k) =>
        `<td><button class="sz-dk ${wd.includes(k) ? "on" : ""}" data-wd="${i}|${k}" aria-pressed="${wd.includes(k)}" aria-label="${esc(label(c))}: ${w}">${wd.includes(k) ? "✓" : ""}</button></td>`).join("")}</tr>`; }).join("")}</tbody></table>`;
    const qs = `<div class="sz-qr sz-qh"><span>Chorak</span><span>Boshlanishi</span><span>Tugashi</span><span style="text-align:right">Davomiyligi</span></div>` + [1, 2, 3, 4].map((n) => {
      const r = st.quarters[n - 1] || ["", ""], now = r[0] && r[1] && r[0] <= t && t <= r[1], wk = r[0] && r[1] ? Math.round((Date.parse(r[1]) - Date.parse(r[0])) / 6048e5) : null;
      return `<div class="sz-qr ${flash === "q" + n ? "sz-flash" : ""}" id="sz-q${n}"><b>${n}-chorak${now ? ` <span class="sz-badge">HOZIR</span>` : ""}${ARX.entry(n) ? ` <span class="sz-badge ax-sb">${ARX.isOpen(n) ? "🔓 OCHIQ" : "🔒 ARXIV"}</span>` : ""}</b><input class="sz-inp" type="date" data-q="${n}|0" value="${r[0] || ""}" aria-label="${n}-chorak boshlanishi"><input class="sz-inp" type="date" data-q="${n}|1" value="${r[1] || ""}" aria-label="${n}-chorak tugashi"><small>${wk !== null ? `${wk} hafta` : ""}</small></div>`;
    }).join("");
    const hols = `<div class="sz-hols ${flash === "hol" ? "sz-flash" : ""}" id="sz-hol">${st.holidays.map((h, i) => `<span class="sz-hol">${esc(fmtHol(h))}${h.length === 5 ? ` <small>har yili</small>` : ""}<button data-szholx="${i}" aria-label="${esc(fmtHol(h))} ni o'chirish">✕</button></span>`).join("")}<button class="sz-hol add" data-szholadd>＋ Qo'shish</button></div>`;
    const r = remCfg(), perm = "Notification" in window ? Notification.permission : "denied";
    const rem = row("rem", "🔔 Dars eslatmasi", `Har darsdan oldin bildirishnoma: soat, sinf, mavzu va oldingi uy vazifasi. Ilova ochiq yoki fonda turganda ishlaydi.${r.on && perm !== "granted" ? " <span class='sz-warn-t'>Bildirishnomaga ruxsat yo'q — eslatma faqat ilova ichida chiqadi.</span>" : ""}`, tog('data-a="rem"', r.on, "Dars eslatmasi")) +
      (r.on ? row("remm", "Qachon", "", `<select id="remm" class="sz-sel">${[0, 2, 5, 10, 15].map((k) => `<option value="${k}" ${r.min === k ? "selected" : ""}>${k ? `${k} daqiqa oldin` : "Dars boshlanganda"}</option>`).join("")}</select><button class="btn btn-sm" data-a="remt">Sinab ko'rish</button>`, "wide") : "") +
      (feat("gaps") ? row("eve", "📝 Kechki eslatma", "Bugungi darslardan yo'qlama yoki mavzu kiritilmagani qolsa, kechqurun shu vaqtda eslatadi. Dars jadvali shart emas.",
        `<select id="eve" class="sz-sel"><option value="">O'chiq</option>${["16:00", "17:00", "18:00", "19:00", "20:00", "21:00"].map((k) => `<option ${D.web.eve === k ? "selected" : ""}>${k}</option>`).join("")}</select>`) : "");
    const nd = noDays().length, ax = ARX.cfg(), axL = [1, 2, 3, 4].filter((n) => ARX.entry(n));
    // chorak arxivi (arxiv.js): tugagan chorak tuzatish muddatidan keyin o'zi qulflanadi
    const arx = row("arx", "🗄 Tugagan chorakni arxivlash", "Tuzatish muddati tugagach chorak o'zi qulflanadi: baholar, yo'qlama, mezon va BSB/CHSB ballari, chorak bahosi, mavzular o'zgarmaydi, eMaktab importi ham ularga tegmaydi.", tog('data-axsw="auto"', ax.auto, "Tugagan chorakni arxivlash")) +
      (ax.auto ? row("arxg", "Tuzatish muddati", "Chorak tugagandan keyin chorak baholarini qo'yib ulgurish uchun", `<div class="sz-seg ${tel ? "full" : ""}">${ARX.GRACE.map((g, i) => `<button class="${ax.grace === g ? "on" : ""}" data-axgr="${i}">${g ? `${g} kun` : "Darhol"}</button>`).join("")}</div>`, "wide") : "") +
      row("arxp", "Ochishda parol so'ralsin", "«Vaqtincha ochish»da Himoya paroli so'raladi", tog('data-axsw="ask"', ax.ask, "Ochishda parol so'ralsin")) +
      row("arxv", "Choraklar arxivi", axL.length ? `${axL.join(", ")}-chorak arxivda` : "Hali arxivlangan chorak yo'q", `<button class="btn btn-sm" data-axpage="">Ochish ›</button>`);
    return {body: grp("Haftalik jadval", schRow) +
      grp("Sinflarning dars kunlari", mx, nd ? `<span class="sz-chip sz-rt">⚠ ${nd} ta sinf</span>` : "", sc ? "Jadvaldagi sinflar uchun o'zi belgilanadi. Jadvalsiz sinflar uchun kunni bosib belgilang." : "Har sinf qaysi kunlari darsi borligini bosib belgilang.") +
      grp("Choraklar", qs + row("genq", "Dars kunlarini yaratish", "Chorak sanalari va dars kunlari bo'yicha sanalar qo'shiladi. Qo'yilgan baholar o'chmaydi.", `<button class="btn btn-sm" data-a="genq">↻ Yaratish</button>`), "", "Boshlanish va tugash sanalari — hamma sinflar uchun umumiy.") +
      grp("Chorak arxivi", arx, axL.length ? `<span class="sz-cnt">${axL.length}</span>` : "", "", "arxs") +
      grp("Dam olish kunlari", hols, cnt(st.holidays.length), "Bu kunlarda dars sanasi yaratilmaydi.") +
      grp("Eslatmalar", rem),
      acts: [[sc ? "✎ Jadval" : "📅 Jadval", 'data-a="sch"', 0], ["↻ Kunlarni yaratish", 'data-a="genq"', 1]], what: "Jadval va dars kunlari"};
  }
  function sec2() {
    const st = D.settings, rs = ranges(), tel = phone();
    const upTo = (i) => i + 1 < rs.length ? rs[i + 1].min - 1 : 10;
    const colors = `<div class="sz-gprev">${Array.from({length: 10}, (_, k) => { const col = gradeColor(k + 1); return `<span style="${col ? `background:${col};color:${contrast(col)}` : ""}">${k + 1}</span>`; }).join("")}</div>` +
      rs.map((r, i) => `<div class="sz-gr"><label class="sz-colr" style="background:${r.color}" title="Rangni tanlash"><input type="color" data-rcol="${i}" value="${r.color}" aria-label="${esc(r.name)} rangi"></label>
        <input class="sz-inp" type="text" data-rname="${i}" value="${esc(r.name)}" aria-label="Guruh nomi"><span class="sz-rng"><select class="sz-sel" data-rmin="${i}" aria-label="Boshlanishi">${Array.from({length: 10}, (_, k) => `<option value="${k + 1}" ${r.min === k + 1 ? "selected" : ""}>${k + 1}</option>`).join("")}</select><span>– ${upTo(i)}</span></span></div>`).join("");
    const isSet = (k) => RISK_TYPES.every(([x]) => !!st.risk.on[x] === (RISK_SETS[k] || []).includes(x));
    const rk = `<div class="sz-rkp"><span>Tayyor to'plam:</span><div class="sz-seg full">${RISK_PRESETS.map(([k, n]) => `<button class="${isSet(k) ? "on" : ""}" data-rkpre="${k}" title="${n}">${RISK_SHORT[k] || n}</button>`).join("")}</div></div>` +
      RISK_TYPES.map(([k, [t, d], fields]) => { const on = !!st.risk.on[k];
        return `<div class="sz-rk ${on ? "" : "off"} ${flash === "rk" + k ? "sz-flash" : ""}" id="sz-rk${k}"><div class="sz-st"><b>${t}</b><small>${d}</small></div>
          <div class="sz-th" ${on ? "" : "inert aria-disabled=\"true\""}>${fields.map(([fk, fn, stp_, u], j) => `<label>${fields.length > 1 ? (j ? "kamida" : "o'rtacha <") : ""}${stp(`data-rk="${fk}"`, st.risk[fk], u, stp_, 0, fn)}</label>`).join("")}</div>${tog(`data-rkon="${k}"`, on, t)}</div>`; }).join("");
    const nOn = RISK_TYPES.filter(([k]) => st.risk.on[k]).length;
    return {body: grp("Baho ranglari", colors, "", "Jurnalda har bir baho qaysi rangda chiqishi. Guruh tanlangan bahodan boshlanib, keyingisigacha davom etadi.", "rng") +
      grp("Xavf turlari", rk, cnt(`${nOn} / ${RISK_TYPES.length}`), "Yoqilgan shartlardan biri bajarilsa, o'quvchi jurnalda qizil, «Bugun»da «E'tibor talab qiladi»da chiqadi.") +
      grp("Chorak bahosi", row("fb", "Formativ baho (FB) uchun kamida", "Chorakda shuncha kundalik baho bo'lmasa, FB = 0", stp('id="fbm"', fbMin(), "ta", 1, 1, "Formativ baho uchun kamida")) +
        row("ktrw", "KTRdagi BSB/CHSB mavzulari", "Rejadagi «BSB …», «CHSB …» uchun summativ ish o'zi qo'shilsin", tog('data-a="ktrw"', ktrWorksOn(), "KTR ishlari"))) +
      grp("Jurnal", row("past", "O'tgan darslarga belgi qo'yish", "Darsda ulgurmagan baho va yo'qlamalar uchun. Kelgusi kunlarga belgi qo'yilmaydi; har o'zgarish tarixga yoziladi.",
        `<div class="sz-seg ${tel ? "full" : ""}">${PAST.map(([k, n]) => `<button class="${(D.web.past || "today") === k ? "on" : ""}" data-past="${k}" title="${n}">${tel ? {today: "Bugun", week: "7 kun", all: "Istalgan"}[k] || n : n}</button>`).join("")}</div>`, "wide")), acts: []};
  }
  function sec4() {
    const p = D.settings.protect;
    return {body: `<section class="sz-card sz-hero ${p.enabled ? "on" : ""} ${flash === "prot" ? "sz-flash" : ""}" id="sz-prot"><span class="sz-big">${p.enabled ? "🔒" : "🔓"}</span><div class="sz-st"><b>${p.enabled ? "Baholar himoyalangan" : "Himoya o'chiq"}</b>
        <small>${p.enabled ? "Qo'yilgan bahoni o'zgartirishdan oldin qulfni ochish kerak. Bo'sh katakka baho qo'yish erkin." : "Yoqsangiz, qo'yilgan baholarni tasodifan o'zgartirib bo'lmaydi."}</small></div>${tog('data-a="prot"', p.enabled, "Baholarni himoyalash")}</section>` +
      grp("Qulf", row("pin", "Parol", p.pin ? `<span class="sz-ok-t">✓ O'rnatilgan</span>` : "O'rnatilmagan — qulf bitta bosish bilan ochiladi",
        p.pin ? pairBtns([["Olib tashlash", 'data-a="nopin"', 0], ["O'zgartirish", 'data-a="pin"', 1]]).replace('class="btn "', 'class="btn btn-outline-danger"') : `<button class="btn btn-sm btn-primary" data-a="pin">O'rnatish</button>`, p.pin ? "wide" : "") +
        row("alm", "Avtomatik qulflash", "Harakatsiz qolgandan keyin", stp('id="alm"', p.auto_lock_min || 10, "daq", 1, 1, "Avtomatik qulflash, daqiqa"))) +
      `<details class="sz-info"><summary>ℹ Parol nimadan saqlaydi?</summary><p>Parol baholarni tasodifan o'zgartirishdan va to'lov summalarini begona ko'zdan saqlaydi. U ma'lumotni shifrlamaydi: brauzerni yaxshi biladigan odam telefon yoki kompyuteringizdan jurnalni o'qiy oladi. Shuning uchun qurilmaning o'z ekran qulfini yoqing. Telegram zaxirasini parol bilan shifrlash — Ma'lumotlar → Zaxira.</p></details>`, acts: []};
  }
  function sec5() {
    const c = tgCfg(), on = tgOn(), l = c.last ? new Date(c.last) : null, age = backupAge(), n = (D.changelog || []).length;
    const lt = l ? `${fmt(iso(l))} ${pad(l.getHours())}:${pad(l.getMinutes())}` : "hali yo'q";
    const bst = `<div class="sz-bst"><div class="sz-bt ${age === null || age > 7 ? "w" : ""}"><small>💾 Fayl</small><b>${age === null ? "Olinmagan" : age ? `${age} kun oldin` : "Bugun ✓"}</b></div>
      <div class="sz-bt ${on ? "" : "n"}"><small>✈️ Telegram</small><b>${on ? (l ? `${lt.slice(0, 5)} ✓` : "Ulangan") : "Ulanmagan"}</b></div>
      <div class="sz-bt ${IDB.db ? "" : "w"}"><small>🕒 Kunlik nusxa</small><b>${IDB.db ? `${SNAP_DAYS} kun ✓` : "Ishlamayapti"}</b></div></div>`;
    const z = ((!on && typeof TGU !== "undefined" && TGU.on()) ? TGU.offRow(row) : row("tg", "✈️ Telegram'ga avtomatik zaxira", on && c.key ? `Ulangan: @${esc(c.bot || "bot")} (umumiy bot) · oxirgi zaxira: ${lt}. Boshqa qurilmada ham «✈️ Telegram'ni ulash»ni bossangiz, ma'lumotlar ular orasida almashinadi.`
        : on ? `Ulangan: @${esc(c.bot || "bot")} · oxirgi zaxira: ${lt}. Boshqa qurilmada ham shu botni ulasangiz, ma'lumotlar ular orasida almashinadi.`
        : "Ma'lumotlar har kuni o'zingizning Telegram botingizga fayl bo'lib boradi. Telefon yo'qolsa yoki brauzer tozalansa ham jurnal saqlanib qoladi.",
        on ? `<button class="btn btn-sm btn-primary" data-a="tgsend">📤 Yuborish</button><button class="btn btn-sm" data-a="tgload">📥 Yuklash</button><button class="btn btn-sm" data-a="tgoff">Uzish</button>` : `<button class="btn btn-sm btn-primary" data-a="tgon">🔗 Ulash</button>`, on ? "wide" : "")) +
      (on ? row("tgp", "🔐 Zaxirani parol bilan shifrlash", c.pass ? "Yoqilgan. Boshqa qurilmada yuklashda shu parol so'raladi. Parolni unutsangiz, shifrlangan zaxirani ochib bo'lmaydi."
        : "Telegram akkauntingizga begona kirsa ham o'quvchilar ma'lumoti o'qilmasin. Parolni unutsangiz, zaxirani ochib bo'lmaydi.",
        `${c.pass ? `<button class="btn btn-sm" data-a="tgpass">O'zgartirish</button>` : ""}${tog(`data-a="${c.pass ? "tgnopass" : "tgpass"}"`, !!c.pass, "Zaxirani shifrlash")}`) : "") +
      row("exp", "💾 Faylga saqlash", `journal.json — kompyuterdagi dastur yoki boshqa qurilmada ochish uchun.${age === null ? "" : age > 7 ? ` <span class="sz-warn-t">Oxirgisi ${age} kun oldin.</span>` : ` Oxirgisi ${age ? `${age} kun oldin` : "bugun"}.`}`,
        `<button class="btn btn-sm ${age === null || age > 7 ? "btn-primary" : ""}" data-a="exp">Yuklab olish</button>`) +
      row("snaps", "🕒 Kunlik avtomatik nusxalar", `Ilova har kuni jurnal holatini o'zi saqlaydi (oxirgi ${SNAP_DAYS} kun) — xato o'chirilgan ma'lumotni qaytarish mumkin.${IDB.db ? "" : " <span class='sz-warn-t'>Bu brauzerda zaxira xotira ishlamayapti.</span>"}`, `<button class="btn btn-sm" data-a="snaps">Ko'rish</button>`);
    const imp = row("imp", "📂 Fayldan yuklash", "Kompyuterdagi dasturning journal.json fayli yoki oldin saqlangan zaxira. Hozirgi ma'lumotlar almashtiriladi.", `<button class="btn btn-sm" data-a="imp">Faylni tanlash</button>`) +
      row("emk", "🌐 emaktab'dan import", "Saytdan to'g'ridan-to'g'ri yoki «Fan jurnali» Excel fayli: o'quvchilar, baholar, yo'qlama va BSB/CHSB ballari mavjud jurnalga qo'shiladi.",
        pairBtns([["📊 Excel", 'data-a="xls"', 0], ["🌐 emaktab.uz", 'data-a="emk"', 1]]), "wide");
    const yr = row("roll", "🎓 Yangi o'quv yiliga o'tish", "Jurnal arxivlanadi, sinflar o'quvchilari bilan yangi bo'sh jurnalga o'tadi (6-A → 7-A).", `<button class="btn btn-sm" data-a="roll">Boshlash</button>`) +
      row("hist", "🕘 O'zgarishlar tarixi", `${n} ta yozuv (qo'yilgan bahoni o'zgartirish yoki o'chirish)`, `<button class="btn btn-sm" data-a="hist">Ko'rish</button>`);
    const app = installEvt ? row("inst", "📲 Ilovani o'rnatish", "Telefon yoki kompyuter ekraniga ilova sifatida qo'shiladi va internetsiz ochiladi.", `<button class="btn btn-sm btn-primary" data-a="inst">O'rnatish</button>`)
      : isStandalone() ? "" : row("inst", "📲 Telefonga o'rnatish", /iPhone|iPad/.test(navigator.userAgent) ? "Safari'da «Ulashish» → «Bosh ekranga qo'shish» (Add to Home Screen)" : "Brauzer menyusi (⋮) → «Ilovani o'rnatish» yoki «Bosh ekranga qo'shish»", "");
    const dzr = `<details class="sz-dz" ${flash === "wipe" ? "open" : ""}><summary>⚠ Xavfli amallar</summary>${row("wipe", "Hammasini o'chirish", "Shu brauzerdagi barcha sinflar, baholar va sozlamalar o'chadi. Oldin faylga saqlab qo'ying.", `<button class="btn btn-sm btn-outline-danger" data-a="wipe">O'chirish</button>`)}</details>`;
    return {body: `<section class="sz-sg"><h3 class="sz-sgt">Zaxira holati</h3>${bst}</section>` + grp("Zaxira", z) + grp("Kunlik hisobot", KUN.rows(row, tog)) + grp("Yuklash va import", imp) + grp("O'quv yili", yr) + grp("Ilova", app) + dzr,
      acts: [["📂 Fayldan", 'data-a="imp"', 0], ["💾 Zaxira olish", 'data-a="exp"', 1]], what: "Zaxira"};
  }
  // «Qo'shimcha funksiyalar» — alohida faylda: funksiyalar.js / funksiyalar.css (tasdiqlangan maket v2.1, 2026-11-07)
  const sec6 = () => FNK.sec6(flash);
  const sec3 = () => ({body: DZN.body(), acts: []});
  const SECF = [sec0, sec1, sec2, sec3, sec4, sec5, sec6];

  /* ───────── qidiruv ───────── */
  const IDX = () => [[0, "addc", "Sinf qo'shish", "yangi sinf ro'yxat excel word"], [0, "cls", "O'quvchi qo'shish yoki faolsizlantirish", "o'quvchi faolsiz ketgan"], [0, "cls", "Sinfni tahrirlash yoki o'chirish", "nomi fani o'chirish"],
    [1, "sch", "Dars jadvali", "jadval soat qo'ng'iroq"], [1, "wd0", "Sinflarning dars kunlari", "hafta kun dushanba"], [1, "q1", "Choraklar", "chorak sana boshlanish tugash"], [1, "arx", "Chorak arxivi", "arxiv qulf tugagan chorak baholar o'zgarmasin"], [1, "genq", "Dars kunlarini yaratish", "sana yaratish"],
    [1, "hol", "Dam olish kunlari (bayramlar)", "bayram ta'til dam"], [1, "rem", "Dars eslatmasi", "bildirishnoma eslatma"], [1, "eve", "Kechki eslatma", "kechqurun eslatma"],
    [2, "rng", "Baho ranglari", "rang baho guruh"], [2, "rkavg", "Xavf turlari", "xavf risk o'rtacha davomat"], [2, "fb", "Formativ baho (FB) uchun kamida", "fb chorak bahosi"], [2, "ktrw", "KTRdagi BSB/CHSB mavzulari", "ktr bsb chsb summativ"], [2, "past", "O'tgan darslarga belgi qo'yish", "o'tgan kun belgi"],
    [3, "", "Mavzu, rang, yozuv, tugmalar joyi", "dizayn mavzu rang shrift tun tungi kechqurun menyu tugma belgi"], [4, "prot", "Baholarni himoyalash", "himoya qulf"], [4, "pin", "Parol", "parol pin"], [4, "alm", "Avtomatik qulflash", "qulf daqiqa"],
    [5, "tg", "Telegram'ga zaxira", "telegram bot zaxira shifrlash"], [5, "kr", "Kunlik hisobot rasmi", "telegram kunlik hisobot rasm ota-ona guruh"], [5, "exp", "Faylga saqlash", "zaxira fayl json yuklab"], [5, "snaps", "Kunlik nusxalar", "nusxa qaytarish tiklash"], [5, "imp", "Fayldan yuklash", "import fayl"],
    [5, "emk", "emaktab'dan import", "emaktab excel"], [5, "roll", "Yangi o'quv yili", "o'quv yili arxiv"], [5, "hist", "O'zgarishlar tarixi", "tarix qaytarish"], [5, "inst", "Ilovani o'rnatish", "o'rnatish ilova"], [5, "wipe", "Hammasini o'chirish", "o'chirish tozalash"],
    ...FEATS.map(([k, n, d]) => [6, "ft" + k, n, d.toLowerCase()])];
  function found() {
    const s = q.toLowerCase().trim(); if (s.length < 2) return "";
    const r = IDX().filter(([, , t, kw]) => (t + " " + kw).toLowerCase().includes(s)).slice(0, 10);
    return r.length ? r.map(([i, id, t]) => `<button class="sz-opt" data-szgo="${i}|${id}"><span class="sz-ic">${SECS[i][0]}</span><span><b>${esc(t)}</b><small>${SECS[i][1]}</small></span></button>`).join("")
      : `<div class="sz-none">Topilmadi. Masalan: «parol», «zaxira», «bayram».</div>`;
  }
  function goTo(i, id) {
    q = ""; S.sec = i;
    if (id === "cls") { const c = D.classes.findIndex((x) => !isGrp(x)); id = c >= 0 ? "cls" + c : ""; }
    flash = id || null; render();
    const el = id && document.getElementById("sz-" + id);
    if (el) { if (el.tagName === "DETAILS" || el.closest("details")) (el.closest("details") || el).open = true; el.scrollIntoView({block: "center"}); }
    else window.scrollTo(0, 0);
    setTimeout(() => { flash = null; }, 1700);
  }

  /* ───────── sahifa ───────── */
  function navItem(i, home) {
    const [ic, nm] = SECS[i], [s, w] = status(i), on = !home && S.sec === i;
    return `<button class="sz-ni ${on ? "on" : ""}" data-sec="${i}" ${on ? 'aria-current="page"' : ""}><span class="sz-ic">${ic}</span><span class="sz-tx"><b class="sz-ell">${nm}</b><small><span class="sz-ell">${s}</span>${w ? `<span class="sz-dotw" title="E'tibor bering"></span>` : ""}</small></span>${home ? `<span class="sz-car">›</span>` : ""}</button>`;
  }
  function panel(tel) {
    const [ic, nm, ds] = SECS[S.sec], P = SECF[S.sec](), z = dz(), ab = pairBtns(P.acts);
    const head = `<div class="sz-ph shead"><span class="sz-pi">${ic}</span><div class="sz-t"><h2>${nm}</h2><small>${ds}</small></div>${!tel && z.act === "top" ? ab : ""}</div>`;
    const top = tel && z.act === "top" && ab ? ab : "";
    const end = z.act === "end" && ab ? `<section class="sz-card sz-acts-end"><span>${P.what || "Amallar"}</span>${ab}</section>` : "";
    const stick = z.act === "bot" && ab ? `<div class="sz-stick"><span class="sz-ell">${nm}</span>${ab}</div>` : "";
    return `<div class="sz-pan ${S.sec === 3 ? "sbody" : ""}">${head}${top}${P.body}${end}${stick}</div>`;
  }
  function home() {
    const R = [], a = backupAge();
    if (!tgOn() && (a === null || a > 7)) R.push(["💾", a === null ? "Zaxira hali <b>olinmagan</b>" : `Oxirgi zaxira <b>${a} kun</b> oldin`, `<button class="btn btn-sm btn-primary" data-a="exp">Saqlash</button>`]);
    noDays().slice(0, 3).forEach((c) => R.push(["📅", `<b>${esc(label(c))}</b>: dars kunlari yo'q`, `<button class="btn btn-sm" data-szgo="1|wd${D.classes.indexOf(c)}">Belgilash</button>`]));
    return `<div class="sz"><header class="sz-hd"><h1>Sozlamalar</h1><button class="sz-ibtn" data-szfind aria-label="Sozlamani qidirish">🔍</button></header>
      ${R.length ? `<section class="sz-card sz-rems">${R.map(([ic, t, b]) => `<div class="sz-rm"><span class="sz-ic">${ic}</span><span>${t}</span>${b}</div>`).join("")}</section>` : ""}
      ${GROUPS.map(([g, ids]) => `<section class="sz-sg"><h3 class="sz-sgt">${g}</h3><nav class="sz-card sz-hl" aria-label="${g}">${ids.map((i) => navItem(i, true)).join("")}</nav></section>`).join("")}</div>`;
  }
  function page(m) {
    const tel = phone(); wasPhone = tel;
    if (!SECS[S.sec]) S.sec = tel ? -1 : 0;
    if (tel && S.sec === -1) { m.innerHTML = home(); return; }
    m.innerHTML = tel
      ? `<div class="sz"><header class="sz-tb"><button class="sz-back" data-szhome><i>‹</i>Sozlamalar</button><b class="sz-ell">${SECS[S.sec][1]}</b><button class="sz-ibtn" data-szfind aria-label="Sozlamani qidirish">🔍</button></header>${panel(true)}</div>`
      : `<div class="sz"><header class="sz-hd"><h1>Sozlamalar</h1><div class="sz-srch"><input id="szq" type="text" placeholder="Sozlamani qidirish: parol, zaxira…" autocomplete="off" aria-label="Sozlamani qidirish"><div class="sz-found" role="listbox"></div></div></header>
        <div class="sz-grid"><nav class="sz-nav" aria-label="Sozlamalar bo'limlari">${GROUPS.map(([g, ids]) => `<h3 class="sz-ngt">${g}</h3>${ids.map((i) => navItem(i, false)).join("")}`).join("")}</nav>${panel(false)}</div></div>`;
  }
  function holidayAdd() {
    modal(`<h2>Dam olish kuni</h2><div class="vcol" style="gap:10px"><label class="muted" style="display:flex;flex-direction:column;gap:4px">Sana<input class="form-control" type="date" id="szhd" value="${todayIso()}"></label>
      <label style="display:flex;align-items:center;gap:8px;font-weight:600"><input type="checkbox" id="szhy" checked> Har yili takrorlanadi</label></div>
      <div class="hrow"><span class="sp"></span><button class="btn" data-x>Bekor qilish</button><button class="btn btn-primary" data-ok>Qo'shish</button></div>`, (mm, close) => {
      $("[data-x]", mm).onclick = () => close();
      $("[data-ok]", mm).onclick = () => {
        const v = $("#szhd", mm).value; if (!v) return;
        const h = $("#szhy", mm).checked ? v.slice(5) : v, H = D.settings.holidays;
        if (!H.includes(h)) { H.push(h); H.sort((a, b) => a.slice(-5).localeCompare(b.slice(-5))); save(); }
        close(); render(); toast("Dam olish kuni qo'shildi");
      };
    });
  }
  function findDialog() {
    q = "";
    modal(`<h2>🔍 Sozlamani qidirish</h2><input class="sz-sinp" id="szq2" type="text" placeholder="Masalan: parol, zaxira, bayram" autocomplete="off"><div class="sz-found2 vcol" style="gap:2px;margin-top:6px"><div class="sz-none">Kamida 2 ta harf yozing.</div></div>
      <div class="hrow"><span class="sp"></span><button class="btn" data-x>Yopish</button></div>`, (mm, close) => {
      const inp = $("#szq2", mm), out = $(".sz-found2", mm);
      $("[data-x]", mm).onclick = () => close();
      inp.oninput = () => { q = inp.value; out.innerHTML = found() || `<div class="sz-none">Kamida 2 ta harf yozing.</div>`; };
      out.onclick = (e) => { const b = e.target.closest("[data-szgo]"); if (!b) return; close(); const [i, id] = b.dataset.szgo.split("|"); goTo(+i, id); };
      setTimeout(() => inp.focus(), 30);
    });
  }
  function bind(m) {
    m.querySelectorAll("[data-sec]").forEach((b) => b.onclick = () => { S.sec = +b.dataset.sec; flash = null; render(); window.scrollTo(0, 0); });
    m.querySelectorAll("[data-szhome]").forEach((b) => b.onclick = () => { S.sec = -1; render(); window.scrollTo(0, 0); });
    m.querySelectorAll("[data-szfind]").forEach((b) => b.onclick = findDialog);
    KUN.bind(m);   // kunlik hisobot (kunlik.js)
    m.querySelectorAll("[data-szgo]").forEach((b) => b.onclick = () => { const [i, id] = b.dataset.szgo.split("|"); goTo(+i, id); });
    const sq = $("#szq", m);
    if (sq) {
      const out = $(".sz-found", m);
      sq.oninput = () => { q = sq.value; out.innerHTML = found(); };
      sq.onkeydown = (e) => { if (e.key === "Escape") { sq.value = q = ""; out.innerHTML = ""; } if (e.key === "Enter") { const b = out.querySelector("[data-szgo]"); if (b) b.click(); } };
      out.onclick = (e) => { const b = e.target.closest("[data-szgo]"); if (b) { const [i, id] = b.dataset.szgo.split("|"); goTo(+i, id); } };
    }
    // − / + : yonidagi maydon qiymatini o'zgartirib, «change» hodisasini yuboradi (saqlash index.html dagi bog'lashda)
    m.querySelectorAll("[data-szs]").forEach((b) => b.onclick = () => {
      const inp = b.parentElement.querySelector("input"), st = parseFloat(inp.step) || 1, mn = parseFloat(inp.min);
      let v = Math.round(((parseFloat(inp.value) || 0) + st * +b.dataset.szs) * 100) / 100; if (!isNaN(mn)) v = Math.max(mn, v);
      inp.value = v; inp.dispatchEvent(new Event("change"));
    });
    m.querySelectorAll("[data-szholx]").forEach((b) => b.onclick = () => { const h = D.settings.holidays.splice(+b.dataset.szholx, 1)[0]; save(); render(); toast(`${fmtHol(h)} o'chirildi`); });
    m.querySelectorAll("[data-szholadd]").forEach((b) => b.onclick = holidayAdd);
  }
  addEventListener("resize", () => { if (typeof S !== "undefined" && S.page === "settings" && wasPhone !== null && wasPhone !== phone()) { if (!phone() && S.sec < 0) S.sec = 0; render(); } });
  return {SECS, page, bind, phone, goTo};
})();
