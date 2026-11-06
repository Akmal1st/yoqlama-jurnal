/* Sozlamalar → Dizayn (Akmal tasdiqlagan maket, 2026-11-01). Alohida fayl: ilovaning qolgan qismi faqat DZN.* ni chaqiradi.
   Ikki bo'lim: «Ko'rinish» (mavzu, kechqurun, asosiy rang, o'lcham, zichlik, burchak, shrift) va
   «Tugmalar» (menyu joyi, belgi/yozuv, menyu tartibi, yoqish/o'chirish belgilari, oyna tugmalari joyi va asosiy tugma tomoni).
   Saqlanadigan joy: D.web.dz. Asosiy ko'rinish — tpt-tema.css, bu fayl uning ranglari va o'lchamlarini almashtiradi.
   Bu fayl asosiy <script> dan OLDIN ulanadi: undagi D, S, save, render, esc, $, h, modal kabi nomlarga faqat chaqirilganda murojaat qiladi. */
const DZN = (() => {
  // [nomi, izoh, to'q mavzumi, kunduzgi ranglar, (bo'lsa) o'zining tungi varianti]
  const THEMES = {
    tpt: ["TPT", "Kulrang fon, oq kartochka", 0,
      {win: "#f3f5f9", base: "#ffffff", alt: "#f7f8fb", soft: "#eef1f6", line: "#e3e7ee", text: "#141b2d", muted: "#667085", acc: "#0d8a87", fg: "#ffffff"},
      {win: "#111416", base: "#1a1e21", alt: "#1f2427", soft: "#262c30", line: "#30373c", text: "#e9eef0", muted: "#94a0a6", acc: "#3cc9b9", fg: "#04201f"}],
    osmon: ["Osmon", "Havorang, tiniq ko'k", 0,
      {win: "#eaf1fb", base: "#ffffff", alt: "#f4f8fd", soft: "#e2ebf7", line: "#d3dff0", text: "#10213d", muted: "#5a6b86", acc: "#2563eb", fg: "#ffffff"},
      {win: "#0a1222", base: "#111b30", alt: "#15213a", soft: "#1b2945", line: "#253556", text: "#e4ecfb", muted: "#8a9bbb", acc: "#6ea8ff", fg: "#07142b"}],
    daftar: ["Daftar", "Qog'oz va siyoh rangi", 0,
      {win: "#f4efe4", base: "#fffdf7", alt: "#faf6ec", soft: "#efe7d6", line: "#e2d8c3", text: "#1d2433", muted: "#6d6656", acc: "#2f4fa2", fg: "#ffffff"},
      {win: "#17140f", base: "#201c16", alt: "#26211a", soft: "#2e2820", line: "#3a3328", text: "#efe7d8", muted: "#a89d88", acc: "#8fa8ec", fg: "#0f1730"}],
    kontrast: ["Kontrast", "Aniq chiziq, qora yozuv", 0,
      {win: "#ffffff", base: "#ffffff", alt: "#f2f4f7", soft: "#e8ebf0", line: "#7b8494", text: "#05080d", muted: "#2c3340", acc: "#0b4fa8", fg: "#ffffff"},
      {win: "#000000", base: "#0a0a0a", alt: "#141414", soft: "#1e1e1e", line: "#9a9a9a", text: "#ffffff", muted: "#d6d6d6", acc: "#ffd23f", fg: "#000000"}],
    tun: ["Tungi", "To'q ko'k, ko'zni toldirmaydi", 1,
      {win: "#0b0f17", base: "#131926", alt: "#171e2c", soft: "#1d2534", line: "#262f40", text: "#e8ecf3", muted: "#8b95a7", acc: "#9aa8ff", fg: "#0d1233"}],
    grafit: ["Grafit", "To'q kulrang, sariq urg'u", 1,
      {win: "#141518", base: "#1c1e22", alt: "#212328", soft: "#2a2d33", line: "#33363d", text: "#eceae6", muted: "#9b9890", acc: "#f2b13d", fg: "#231804"}]};
  const HUES = ["#0d8a87", "#2563eb", "#2f4fa2", "#6d4fd3", "#c0367a", "#d1393a", "#c46a12", "#2e7d4a", "#475467"];
  const FONTS = {manrope: ["Manrope", "Standart", `"Manrope",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif`],
    system: ["Tizim shrifti", "Qurilmaniki", `system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans",sans-serif`],
    georgia: ["Georgia", "Kitobiy", `Georgia,"DejaVu Serif",serif`], verdana: ["Verdana", "Keng, aniq", `Verdana,"DejaVu Sans",Geneva,sans-serif`]};
  // [nomi, izoh, tugma balandligi, kartochka ichki chekkasi, katak balandligi]
  const DENS = [["Keng", "telefon", 44, 20, 40], ["Oddiy", "standart", 0, 0, 0], ["Ixcham", "jadval", 30, 11, 28]];
  // yoqish/o'chirish kalitlari: [yoqilgan, o'chiq, nomi]
  // (Akmal, 2026-11-02: faqat «Belgi» va «Chiroqcha» qolsin; eski tanlovlar standartga o'tadi)
  const EMO = {check: ["✅", "⬜", "Belgi"], dot: ["🟢", "⚪", "Chiroqcha"]};
  const NAVK = ["today", "journal", "groups", "reports", "settings", "help"];
  const NAVN = {today: "Bugun", journal: "Jurnal", groups: "Guruhlar", reports: "Hisobotlar", settings: "Sozlamalar", help: "Yordam"};
  const LOOK = {theme: "tpt", night: "off", hue: "", font: "manrope", size: 100, dens: 1, rad: 14};
  const BTNS = {nav: "left", lab: "both", ord: NAVK.slice(), hid: [], emo: "check", act: "end", pri: "right"};
  const DEF = () => Object.assign({}, LOOK, JSON.parse(JSON.stringify(BTNS)), {force: false});
  const pick = (v, list, d) => (list.includes(v) ? v : d);
  const num = (v, lo, hi, d) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, Math.round(+v))) : d);
  const okHex = (v) => (/^#[0-9a-f]{6}$/i.test(String(v)) ? String(v).toLowerCase() : "");

  // saqlangan qiymatni tekshirish (import qilingan fayl ham shu yerdan o'tadi)
  function clean(o, web) {
    o = o && typeof o === "object" ? o : {};
    const d = DEF();
    if (!web || !("dz" in web)) {   // eski sozlamadan bir marta: tungi mavzu → «Tungi», avto → qurilmaga qarab
      if (web && web.theme === "dark") d.theme = "tun"; else if (web && web.theme === "auto") d.night = "device";
    }
    const ord = Array.isArray(o.ord) ? o.ord.filter((k, i, a) => NAVK.includes(k) && a.indexOf(k) === i) : [];
    return {
      theme: pick(o.theme, Object.keys(THEMES), d.theme), night: pick(o.night, ["off", "device", "time"], d.night), hue: okHex(o.hue),
      font: pick(o.font, [...Object.keys(FONTS), "custom"], d.font), size: num(o.size, 90, 120, 100), dens: num(o.dens, 0, 2, 1), rad: num(o.rad, 0, 20, 14),
      nav: pick(o.nav, ["left", "top", "bottom"], "left"), lab: pick(o.lab, ["both", "icon", "text"], "both"),
      ord: [...ord, ...NAVK.filter((k) => !ord.includes(k))], hid: Array.isArray(o.hid) ? o.hid.filter((k) => NAVK.includes(k) && k !== "settings") : [],
      emo: pick(o.emo, Object.keys(EMO), BTNS.emo), act: pick(o.act, ["top", "end", "bot"], "end"), pri: pick(o.pri, ["left", "right"], "right"), force: !!o.force};
  }
  const cfg = () => (D.web.dz = D.web.dz && D.web.dz.ord ? D.web.dz : clean(D.web.dz, D.web));

  const nightNow = (z) => !!z.force || (z.night === "device" ? matchMedia("(prefers-color-scheme: dark)").matches
    : z.night === "time" ? (() => { const hr = new Date().getHours(); return hr >= 19 || hr < 7; })() : false);
  const variant = (z, x) => (nightNow(z) && x[4] ? [x[4], true] : [x[3], !!x[2]]);
  // rang yorqinligi va kontrast (WCAG)
  function lum(hx) { const c = [1, 3, 5].map((i) => parseInt(hx.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const isDark = () => { const z = cfg(); return variant(z, THEMES[z.theme])[1]; };
  const fontCss = (z) => { const cf = typeof cleanFont === "function" ? cleanFont(D.web.cfont) : ""; return z.font === "custom" && cf ? `"${cf}",system-ui,sans-serif` : (FONTS[z.font] || FONTS.manrope)[2]; };

  // hamma CSS: ranglar, shrift, o'lcham, zichlik, burchak va tugmalar joylashuvi
  function css() {
    const z = cfg(), t = THEMES[z.theme], [v, dk] = variant(z, t), acc = z.hue || v.acc, cr = contrast(acc, v.base);
    const fg = z.hue ? (lum(acc) > 0.45 ? "#10141c" : "#ffffff") : v.fg, accT = cr >= 3 ? acc : `color-mix(in srgb,${acc} 45%,${dk ? "white" : "black"})`;
    const dn = DENS[z.dens], rs = Math.round(z.rad * 0.7);
    const tok = `--win:${v.win};--base:${v.base};--alt:${v.alt};--soft:${v.soft};--line:${v.line};--text:${v.text};--muted:${v.muted};--acc:${acc};--acc-fg:${fg};--acc-t:${accT};
      --acc-d:color-mix(in srgb,${acc} 82%,${dk ? "white" : "black"});--acc-soft:color-mix(in srgb,${acc} ${dk ? 18 : 12}%,${v.base});--side-bg:${v.base};--side-fg:${v.text};--side-mut:${v.muted};
      --today-cell:${dk ? "color-mix(in srgb,#f5b454 18%," + v.base + ")" : "#fef3e2"};--r:${z.rad}px;--rk:${+(z.rad / 14).toFixed(3)};--bs-border-radius:calc(.375rem*var(--rk));--bs-border-radius-sm:calc(.25rem*var(--rk));--bs-border-radius-lg:calc(.5rem*var(--rk));--bs-border-radius-xl:calc(1rem*var(--rk));--bs-border-radius-xxl:calc(2rem*var(--rk));--tpt-f:${fontCss(z)};
      ${dk ? "--sh:0 1px 2px rgba(0,0,0,.35);--sh-lg:0 16px 40px -10px rgba(0,0,0,.7);--ok:#4ade9b;--danger:#f87171;" : "--ok:#12805c;--danger:#d1393a;"}`;
    // Guruhlar bo'limi (guruhlar.css) ham shu ranglarda
    const grp = `html.tpt-all.dz .tpt,html.tpt-all.dz[data-theme] .tpt{--g-win:var(--win);--g-base:var(--base);--g-alt:var(--alt);--g-soft:var(--soft);--g-line:var(--line);--g-text:var(--text);--g-muted:var(--muted);
      --g-acc:var(--acc);--g-acc-d:var(--acc-d);--g-acc-fg:var(--acc-fg);--g-acc-soft:var(--acc-soft);--g-f:var(--tpt-f);--g-r:var(--r);--g-ok:var(--ok);--g-bad:var(--danger);--g-sh:var(--sh);--g-sh-lg:var(--sh-lg)}
      html.tpt-all.dz body.tpt-on #main,html.tpt-all.dz[data-theme] body.tpt-on #main{background:var(--win)}`;
    let out = `html.tpt-all.dz,html.tpt-all.dz[data-theme]{${tok}}${grp}
      html.dz .btn{border-radius:${rs}px}html.dz :is(input[type=text],input[type=search],input[type=tel],input[type=date],input[type=password],input[type=number],select,textarea){border-radius:${rs}px}
      html.dz .cell{border-radius:${Math.max(2, rs - 3)}px}html.dz .tsc,html.dz .hu span{border-radius:50%}
      @media screen{html.dz main{zoom:${z.size / 100}}}`;
    if (dn[2]) out += `@media screen{html.dz .btn{min-height:${dn[2]}px}html.dz .btn.btn-sm{min-height:${dn[2] - 6}px}html.dz .card{padding:${dn[3]}px ${dn[3] + 2}px}html.dz .cell{height:${dn[4]}px}}`;
    // menyu: belgi yoki yozuv
    if (z.lab === "text") out += `html.dz :is(.side,.tabbar) .nav svg{display:none}html.dz .tabbar .nav{padding:12px 0}`;
    if (z.lab === "icon") out += `html.dz .tabbar .nav .lbl{display:none}html.dz .tabbar .nav{padding:12px 0}`;
    // menyu joyi (kompyuter): tepada — gorizontal qator, pastda — telefondagi kabi pastki panel
    if (z.nav === "top") out += `@media (min-width:821px){html.dz .app{flex-direction:column}
      html.dz .side{width:auto!important;height:auto;flex-direction:row;align-items:center;gap:4px;padding:8px 16px;border-right:0;border-bottom:1px solid var(--line);z-index:30;overflow-x:auto}
      html.dz .side .logo{padding:0 10px 0 0;margin:0;border:0}html.dz .side .nav{width:auto;white-space:nowrap;padding:8px 12px}html.dz .side .sbot{display:flex;gap:6px;flex-direction:row}
      html.dz .side .sidet,html.dz .side .grow{display:none}html.dz .side .cmdb{width:auto;margin:0;min-height:38px}html.dz .jpick{display:grid;place-items:center}}
      @media (max-width:820px){html.dz .tabbar{top:0;bottom:auto;border-top:0;border-bottom:1px solid var(--line);padding-top:calc(6px + env(safe-area-inset-top))}html.dz main{padding-top:84px;padding-bottom:24px}}`;
    if (z.nav === "bottom") out += `@media (min-width:821px){html.dz .side{display:none}html.dz .tabbar{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:30;background:var(--base);border-top:1px solid var(--line);padding:6px max(6px,calc(50vw - 360px))}
      html.dz .tabbar .nav{flex-direction:column;gap:2px;padding:6px 0;font-size:12.5px;justify-content:center;align-items:center}html.dz main{padding-bottom:96px}html.dz .jpick{display:grid;place-items:center}}`;
    // oyna tugmalari: oxirgi qator (Bekor qilish / OK). Tepada — sarlavha ostida, qotgan — doim pastda ko'rinadi
    const ft = `html.dz .modal .card>.hrow:last-child`;
    if (z.act === "top") out += `html.dz .modal .card>h2{order:-2}${ft}{order:-1;padding-bottom:10px;border-bottom:1px solid var(--line)}`;
    if (z.act === "bot") out += `${ft}{position:sticky;bottom:-16px;background:var(--base);margin:0 -18px -16px;padding:12px 18px;border-top:1px solid var(--line);z-index:2}`;
    if (z.pri === "left") out += `${ft} .sp{order:-3}${ft} .btn-primary,html.dz .dzfoot .btn-primary{order:-2}`;
    return out;
  }
  // yon panel ixcham bo'lsinmi (faqat belgi yoki menyu chapda emas)
  const compact = () => { const z = cfg(); return (z.lab === "icon" && z.nav === "left") || z.nav !== "left"; };
  // menyu tugmalari tartibi: [kalit, nomi] — yashirilganlar chiqmaydi
  const navList = () => { const z = cfg(); return z.ord.filter((k) => !z.hid.includes(k)); };
  const emo = (on) => EMO[cfg().emo][on ? 0 : 1];

  // kechqurun «soat bo'yicha» bo'lsa — vaqti kelganda o'zi almashadi
  let lastDark = null;
  function tick() { if (typeof D === "undefined" || !D) return; const d = isDark(); if (lastDark !== null && d !== lastDark && typeof render === "function") render(); lastDark = d; }
  setInterval(tick, 60000);
  try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (typeof D !== "undefined" && D && cfg().night === "device" && typeof render === "function") render(); }); } catch (e) {}

  /* ───── Sozlamalar → Dizayn bo'limi ───── */
  const hist = [];   // «↶ Qaytarish» uchun (shu ochilishda, 30 qadam)
  const swatch = (k, x, z) => { const v = variant(z, x)[0], on = z.theme === k;
    return `<button class="ts ${on ? "on" : ""}" data-dz-theme="${k}" role="radio" aria-checked="${on}" title="${esc(x[1])}"><span class="tsc" style="--b:${v.base};--w:${v.win};--a:${v.acc};--t:${v.text};--l:${v.line}">${on ? '<i class="tsk">✓</i>' : ""}</span><b>${x[0]}</b>${k === LOOK.theme ? '<span class="std" title="Standart"></span>' : ""}</button>`; };
  const opt = (g, k, on, inner, std) => `<button class="dzo ${on ? "on" : ""}" data-dz-${g}="${k}" aria-pressed="${on}">${inner}${std ? '<span class="std" title="Standart"></span>' : ""}</button>`;
  const grp = (title, hint, html, cls = "") => `<div class="sgroup dzg ${cls}"><div class="dzh"><h3 class="sgt">${title}</h3>${hint ? `<span>${hint}</span>` : ""}</div>${html}</div>`;
  const ICO = (k) => (typeof ICONS !== "undefined" && ICONS[k]) || "";

  function body() {
    const z = cfg(), tab = S.dztab === "btn" ? "btn" : "look", t = THEMES[z.theme], [v, dk] = variant(z, t), acc = z.hue || v.acc, cr = contrast(acc, v.base);
    const ent = Object.entries(THEMES), E = EMO[z.emo];
    const prev = `<div class="dzprev" aria-label="Namuna"><div class="dzpc"><span class="dzlab">Namuna</span><b>7-B · Matematika</b>
      <span class="dzc g9">9</span><span class="dzc g7">7</span><span class="dzc s">S</span><span class="sp"></span><span class="dzfoot"><button class="btn btn-sm" tabindex="-1">Bekor</button><button class="btn btn-sm btn-primary" tabindex="-1">▶ Boshlash</button></span></div>
      ${cr < 3 ? `<div class="dzwarn">⚠ Bu rang fonda xira ko'rinadi (kontrast ${cr.toFixed(1)}:1, kamida 3:1 kerak). <button class="lnk" data-dz-hue="">Mavzu rangiga qaytish</button></div>` : ""}</div>`;
    const tabs = `<div class="dztabs" role="tablist"><button role="tab" aria-selected="${tab === "look"}" class="${tab === "look" ? "on" : ""}" data-dz-tab="look">🎨 Ko'rinish</button><button role="tab" aria-selected="${tab === "btn"}" class="${tab === "btn" ? "on" : ""}" data-dz-tab="btn">🔲 Tugmalar</button></div>`;
    let html = "";
    if (tab === "look") {
      const night = [["off", "Yo'q, doim tanlangan mavzu", "Standart"], ["device", "Qurilma sozlamasiga qarab", "Qurilma tungi rejimda bo'lsa — mavzuning tungi varianti"], ["time", "Soat 19:00 dan 07:00 gacha", "Har kuni kechqurun mavzuning tungi varianti"]];
      const fr = (k, n, hn, ff) => `<button class="rd ${z.font === k ? "on" : ""}" data-dz-font="${k}" role="radio" aria-checked="${z.font === k}"><i class="rdo"></i><span><b style="font-family:${esc(ff)}">${esc(n)}</b><small style="font-family:${esc(ff)}">7-B · Matematika — 9, 10, S · Oʻoʻ Gʻgʻ</small></span><em>${hn}</em></button>`;
      const cf = typeof cleanFont === "function" ? cleanFont(D.web.cfont) : "";
      html = grp("Mavzu", "Butun dastur rangi bitta bosishda", `<div class="gal">
          <div class="tsrow"><span class="tsl">☀ Kunduzgi</span><div class="tsg">${ent.filter(([, x]) => !x[2]).map(([k, x]) => swatch(k, x, z)).join("")}</div></div>
          <div class="tsrow"><span class="tsl">🌙 Tungi</span><div class="tsg">${ent.filter(([, x]) => x[2]).map(([k, x]) => swatch(k, x, z)).join("")}</div></div>
          <p class="tsd">${t[0]} — ${t[1].toLowerCase()}${t[4] ? (nightNow(z) ? ". Hozir tungi varianti ko'rsatilmoqda 🌙" : ". Kechqurun o'zining tungi varianti bilan almashadi") : ""}</p></div>`) +
        grp("Kechqurun", "Tungi variantga o'zi o'tsinmi", `<div class="radios">${night.map(([k, n, hn]) => `<button class="rd ${z.night === k ? "on" : ""}" data-dz-night="${k}" role="radio" aria-checked="${z.night === k}" ${t[2] ? "disabled" : ""}><i class="rdo"></i><span><b>${n}</b><small>${hn}</small></span></button>`).join("")}
          <button class="rd tst ${z.force ? "on" : ""}" data-dz-force="1" role="switch" aria-checked="${z.force}" ${t[2] ? "disabled" : ""}><span class="dzemo">${emo(z.force)}</span><span><b>Hozir tungi ko'rinish</b><small>Qo'lda yoqish — kechqurun bo'lmasa ham (Ctrl+K → «Kunduzgi / tungi»)</small></span></button>
          ${t[2] ? `<p class="rdn">Tanlangan mavzu o'zi to'q rangli, shuning uchun bu sozlama kerak emas.</p>` : ""}</div>`) +
        grp("Asosiy rang", "Mavzu rangini o'zgartirish shart emas", `<div class="hues"><button class="hu auto ${z.hue ? "" : "on"}" data-dz-hue="" title="Mavzuning o'z rangi"><span style="background:${v.acc}"></span>Mavzu rangi</button>${HUES.map((hx) => `<button class="hu ${z.hue === hx ? "on" : ""}" data-dz-hue="${hx}" aria-label="Rang ${hx}"><span style="background:${hx}"></span></button>`).join("")}<label class="hu pick" title="Istalgan rang"><input type="color" id="dzpick" value="${z.hue || v.acc}" aria-label="Istalgan rang"><span>＋</span></label></div>`) +
        grp("Moslash", "Surib ko'ring: oyna darhol o'zgaradi", `<div class="sliders">
          <label class="sl"><span class="sll"><b>Yozuv o'lchami</b><output>${z.size}%</output></span><span class="slr"><small style="font-size:12px">A</small><span class="trk"><input type="range" data-dz-r="size" min="90" max="120" step="5" value="${z.size}" aria-label="Yozuv o'lchami"><span class="ticks"><i>90%</i><i class="st">100% standart</i><i>120%</i></span></span><small style="font-size:20px">A</small></span></label>
          <label class="sl"><span class="sll"><b>Zichlik</b><output>${DENS[z.dens][0]}</output></span><span class="slr"><span class="trk"><input type="range" data-dz-r="dens" min="0" max="2" step="1" value="${z.dens}" aria-label="Zichlik"><span class="ticks"><i>Keng · telefon</i><i class="st">Oddiy · standart</i><i>Ixcham · jadval</i></span></span></span></label>
          <label class="sl"><span class="sll"><b>Burchaklar</b><output>${z.rad} px</output></span><span class="slr"><i class="rq" style="border-radius:0"></i><span class="trk"><input type="range" data-dz-r="rad" min="0" max="20" step="2" value="${z.rad}" aria-label="Burchaklar"><span class="ticks"><i>To'g'ri</i><i class="st">14 px standart</i><i>Yumaloq</i></span></span><i class="rq" style="border-radius:9px"></i></span></label></div>`) +
        grp("Yozuv turi", "Ekran, hisobot va chop etishda", `<div class="radios fl">${Object.entries(FONTS).map(([k, x]) => fr(k, x[0], x[1], x[2])).join("")}${cf ? fr("custom", cf, "Kompyuterdan", `"${cf}",system-ui`) : ""}
          <button class="rd" data-dz-sysfont="1"><i class="rdo" style="visibility:hidden"></i><span><b>🖥 Kompyuterdagi shriftlar…</b><small>O'rnatilgan istalgan shrift</small></span></button></div>`) +
        (typeof ALF !== "undefined" ? ALF.body() : "");
    } else {
      const lay = (k) => `<span class="lay ${k}"><i></i></span>`;
      html = grp("Asosiy menyu joyi", "Bugun, Jurnal, Guruhlar…", `<div class="dzgrid g3">${[["left", "Chapda", "Yon panel"], ["top", "Tepada", "Qator"], ["bottom", "Pastda", "Tabbar"]].map(([k, n, s]) => opt("nav", k, z.nav === k, `${lay(k)}<b>${n}</b><small>${s}</small>`, k === BTNS.nav)).join("")}</div>
          <p class="dzhint">Telefonda «Chapda» tanlansa ham menyu pastda turadi.</p>`) +
        grp("Menyu tugmalari", "Belgi, yozuv yoki ikkalasi", `<div class="dzgrid g3">${[["both", "Ikkalasi", `${ICO("journal")}Jurnal`], ["icon", "Belgi", ICO("journal")], ["text", "Yozuv", "Jurnal"]].map(([k, n, x]) => opt("lab", k, z.lab === k, `<span class="labs">${x}</span><b>${n}</b>`, k === BTNS.lab)).join("")}</div>`) +
        grp("Menyu tartibi", `↑ ↓ — joyi, ${E[0]} ko'rinadi, ${E[1]} yashirin`, `<div class="olist">${z.ord.map((k, i) => { const off = z.hid.includes(k), lock = k === "settings";
          return `<div class="orow ${off ? "off" : ""}">${ICO(k)}<span class="n">${NAVN[k]}</span>
            <button class="ib" data-dz-mv="${k}|-1" ${i ? "" : "disabled"} aria-label="${NAVN[k]} — yuqoriga">↑</button><button class="ib" data-dz-mv="${k}|1" ${i < z.ord.length - 1 ? "" : "disabled"} aria-label="${NAVN[k]} — pastga">↓</button>
            ${lock ? `<span class="vis lock" title="Sozlamalar doim ko'rinadi, aks holda unga qaytib bo'lmaydi">🔒</span>` : `<button class="vis ${off ? "" : "on"}" data-dz-eye="${k}" role="switch" aria-checked="${!off}" title="${off ? "Yashirin — ko'rsatish uchun bosing" : "Ko'rinadi — yashirish uchun bosing"}" aria-label="${NAVN[k]} menyuda ko'rinsin">${E[off ? 1 : 0]}</button>`}</div>`; }).join("")}</div>`) +
        grp("Yoqish/o'chirish belgilari", "Hamma kalitlarda: yoqilgan → o'chiq", `<div class="dzgrid g2">${Object.entries(EMO).map(([k, [a, b, n]]) => opt("emo", k, z.emo === k, `<span class="ep">${a}<i>→</i>${b}</span><b>${n}</b>`, k === BTNS.emo)).join("")}</div>`) +
        grp("Oyna tugmalari joyi", "«Bekor qilish / OK» kabi tugmalar", `<div class="dzgrid g3">${[["top", "Tepada", "Sarlavha ostida"], ["end", "Oxirida", "Oyna tagida"], ["bot", "Qotgan", "Doim pastda"]].map(([k, n, s]) => opt("act", k, z.act === k, `<span class="lay a-${k}"><u style="top:30%"></u><u style="top:48%"></u><i></i></span><b>${n}</b><small>${s}</small>`, k === BTNS.act)).join("")}</div>`) +
        grp("Asosiy tugma tomoni", "Rangli tugma qaysi tomonda", `<div class="dzgrid g2">${[["left", "Chapda"], ["right", "O'ngda"]].map(([k, n]) => opt("pri", k, z.pri === k, `<span class="pairs">${k === "left" ? '<s class="p"></s><s></s>' : '<s></s><s class="p"></s>'}</span><b>${n}</b>`, k === BTNS.pri)).join("")}</div>`);
    }
    const foot = `<div class="dzfoot2"><button class="btn" data-dz-undo ${hist.length ? "" : "disabled"} title="Oxirgi o'zgarishni bekor qilish">↶ Qaytarish</button><button class="btn" data-dz-reset title="Ochiq bo'limni boshlang'ich holatga qaytarish">↺ Standart</button></div>
      <p class="muted dzhint">★ — standart tanlov. Har bir tanlov darhol saqlanadi. Yoqmasa, «↶ Qaytarish» bosing.</p>`;
    return `<div class="dz-sec">${prev}${tabs}${html}${foot}</div>`;
  }

  function bind(m) {
    const z = cfg();
    const commit = (fn, quiet) => { hist.push(JSON.stringify(D.web.dz)); if (hist.length > 30) hist.shift(); fn(z); D.web.dz = clean(z, D.web); save(); render(); if (!quiet) flash(); };
    const flash = () => { const s = document.querySelector(".shead"); if (s && !s.querySelector(".dzsaved")) { const e = h(`<span class="dzsaved">✓ Saqlandi</span>`); s.append(e); setTimeout(() => e.remove(), 1400); } };
    m.querySelectorAll("[data-dz-tab]").forEach((b) => b.onclick = () => { S.dztab = b.dataset.dzTab; render(); });
    for (const k of ["theme", "night", "hue", "font", "nav", "lab", "emo", "act", "pri"])
      m.querySelectorAll(`[data-dz-${k}]`).forEach((b) => b.onclick = () => commit((o) => { o[k] = b.dataset["dz" + k[0].toUpperCase() + k.slice(1)]; }));
    m.querySelectorAll("[data-dz-force]").forEach((b) => b.onclick = () => commit((o) => { o.force = !o.force; }));
    m.querySelectorAll("[data-dz-mv]").forEach((b) => b.onclick = () => commit((o) => { const [k, d] = b.dataset.dzMv.split("|"), i = o.ord.indexOf(k), j = i + +d; if (j >= 0 && j < o.ord.length) [o.ord[i], o.ord[j]] = [o.ord[j], o.ord[i]]; }));
    m.querySelectorAll("[data-dz-eye]").forEach((b) => b.onclick = () => commit((o) => { const k = b.dataset.dzEye; o.hid = o.hid.includes(k) ? o.hid.filter((x) => x !== k) : [...o.hid, k]; }));
    m.querySelectorAll("[data-dz-r]").forEach((r) => {
      const k = r.dataset.dzR, out = r.closest(".sl").querySelector("output");
      r.oninput = () => { out.textContent = k === "size" ? r.value + "%" : k === "dens" ? DENS[+r.value][0] : r.value + " px"; };
      r.onchange = () => commit((o) => { o[k] = +r.value; });
    });
    const pk = m.querySelector("#dzpick"); if (pk) pk.onchange = () => commit((o) => { o.hue = pk.value; });
    if (typeof ALF !== "undefined") ALF.bind(m);
    m.querySelectorAll("[data-dz-sysfont]").forEach((b) => b.onclick = () => { if (typeof fontDialog === "function") fontDialog(); });
    m.querySelectorAll("[data-dz-undo]").forEach((b) => b.onclick = () => { const s0 = hist.pop(); if (!s0) return; D.web.dz = clean(JSON.parse(s0), D.web); save(); render(); flash(); });
    m.querySelectorAll("[data-dz-reset]").forEach((b) => b.onclick = () => commit((o) => { Object.assign(o, S.dztab === "btn" ? JSON.parse(JSON.stringify(BTNS)) : Object.assign({}, LOOK, {force: false})); }));
  }
  // Ctrl+K: «Kunduzgi / tungi»
  function toggleNight() { const z = cfg(); if (THEMES[z.theme][2]) z.theme = "tpt", z.force = false; else z.force = !z.force; save(); render(); }

  return {THEMES, EMO, DEF, clean, cfg, css, isDark, compact, navList, emo, body, bind, toggleNight, contrast, NAVK};
})();
