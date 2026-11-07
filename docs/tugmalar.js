/* Sozlamalar → Dizayn → «Tugmalar» bo'limi (Akmal tasdiqlagan maket v3, 2026-11-07).
   4 guruh: Menyu (joyi + ko'rinishi), Menyu tartibi (↑↓ + kalit), Oyna tugmalari (joyi + asosiy tugma tomoni + namuna, «Sinab ko'rish»),
   Tugma shakli (to'liq rang / yumshoq / chiziqli). «Yoqish/o'chirish belgilari» tanlovi olib tashlandi: dasturda bitta kalit (kalit.css).
   Saqlash va bosishlar dizayn.js da (data-dz-* belgilari). Bu fayl dizayn.js dan OLDIN ulanadi. */
const TGM = (() => {
  const SHAPES = [["solid", "To'liq rang"], ["soft", "Yumshoq"], ["line", "Chiziqli"]];
  const sw = (on, attrs, label) => `<button class="kalit ${on ? "on" : ""}" role="switch" aria-checked="${!!on}" aria-label="${label}" ${attrs}></button>`;
  const opt = (g, k, on, inner, std) => `<button class="tg-op ${on ? "on" : ""}" data-dz-${g}="${k}" aria-pressed="${on}">${std ? '<span class="tg-std" title="Standart">★</span>' : ""}${inner}</button>`;
  const grp = (t, hint, html) => `<div class="sgroup tg-g"><div class="tg-gh"><h3 class="sgt">${t}</h3>${hint ? `<span>${hint}</span>` : ""}</div>${html}</div>`;
  const sub = (t, html, extra = "") => `<div class="tg-sub"><div class="tg-st">${t}</div>${html}${extra}</div>`;
  const phone = () => matchMedia("(max-width:820px)").matches;
  const foot = (z, sm) => { const b = [`<button class="btn ${sm ? "btn-sm" : ""}" ${sm ? 'tabindex="-1"' : "data-x"}>${sm ? "Bekor" : "Bekor qilish"}</button>`, `<button class="btn btn-primary ${sm ? "btn-sm" : ""}" ${sm ? 'tabindex="-1"' : "data-ok"}>Saqlash</button>`];
    return `<span class="sp"></span>${(z.pri === "left" ? b.reverse() : b).join("")}`; };

  // B — dizayn.js dagi standart tanlovlar, N — menyu nomlari, ICO — menyu belgilari
  function body(z, B, N, keys, ICO) {
    const ph = phone(), vis = z.ord.filter((k) => !z.hid.includes(k)).length;
    const navO = [["left", "Chapda", ph ? "→ pastda" : "Yon panel"], ["top", "Tepada", "Qator"], ["bottom", "Pastda", "Tabbar"]];
    let h = grp("Menyu", "Bugun, Jurnal, Guruhlar…", `<div class="tg-box">
      ${sub("Joyi", `<div class="tg-g3">${navO.map(([k, n, s]) => opt("nav", k, z.nav === k, `<span class="tg-lay ${ph && k === "left" ? "bottom" : k}"><i></i></span><b>${n}</b><small>${s}</small>`, k === B.nav)).join("")}</div>`,
        ph && z.nav === "left" ? `<p class="tg-note">📱 Telefonda yon panel sig'maydi, shuning uchun menyu pastda turadi.</p>` : "")}
      ${sub("Ko'rinishi", `<div class="tg-g3">${[["both", "Ikkalasi", `${ICO("journal")}Jurnal`], ["icon", "Ikonka", ICO("journal")], ["text", "Yozuv", "Jurnal"]].map(([k, n, x]) => opt("lab", k, z.lab === k, `<span class="tg-labs">${x}</span><b>${n}</b>`, k === B.lab)).join("")}</div>`)}</div>`);
    h += grp("Menyu tartibi", `${vis} / ${keys.length} ko'rinadi`, `<div class="tg-box">${z.ord.map((k, i) => { const off = z.hid.includes(k);
      return `<div class="tg-or ${off ? "off" : ""}">${ICO(k)}<span class="n">${N[k]}</span>
        <span class="tg-mv"><button data-dz-mv="${k}|-1" ${i ? "" : "disabled"} aria-label="${N[k]} — yuqoriga">↑</button><button data-dz-mv="${k}|1" ${i < z.ord.length - 1 ? "" : "disabled"} aria-label="${N[k]} — pastga">↓</button></span>
        ${k === "settings" ? `<span class="tg-lock" title="Sozlamalar doim ko'rinadi, aks holda unga qaytib bo'lmaydi">🔒 doim</span>` : sw(!off, `data-dz-eye="${k}"`, `${N[k]} menyuda ko'rinsin`)}</div>`; }).join("")}</div>`);
    const mini = `<div class="tg-ft">${foot(z, true)}</div>`;
    h += grp("Oyna tugmalari", "Bekor / Saqlash", `<div class="tg-box">
      ${sub("Joyi", `<div class="tg-g3">${[["top", "Tepada", "Sarlavha ostida"], ["end", "Oxirida", "Ro'yxat tagida"], ["bot", "Qotgan", "Doim ko'rinadi"]].map(([k, n, s]) => opt("act", k, z.act === k, `<b>${n}</b><small>${s}</small>`, k === B.act)).join("")}</div>`)}
      ${sub("Asosiy tugma tomoni", `<div class="tg-g2">${[["left", "Chapda"], ["right", "O'ngda"]].map(([k, n]) => opt("pri", k, z.pri === k, `<b>${n}</b>`, k === B.pri)).join("")}</div>
        <div class="tg-dlg" aria-hidden="true"><div class="tg-dc"><b>Baho qo'yish · 7-B</b>${z.act === "top" ? mini : ""}<u></u><u style="width:70%"></u>${z.act !== "top" ? mini : ""}</div></div>
        <div class="tg-try"><button class="btn btn-sm" data-tg-try>Sinab ko'rish</button></div>`)}</div>`);
    h += grp("Tugma shakli", "Saqlash, Boshlash…", `<div class="tg-g3">${SHAPES.map(([k, n]) => opt("shape", k, z.shape === k, `<span class="tg-shp tg-${k}"><span>Saqlash</span></span><b>${n}</b>`, k === B.shape)).join("")}</div>
      <p class="dzhint">Faqat rangli (asosiy) tugmalarga ta'sir qiladi.</p>`);
    return h;
  }

  // «Sinab ko'rish»: haqiqiy oyna — birinchi sinf o'quvchilari bilan (yo'q bo'lsa namuna ismlar)
  function tryDialog() {
    const z = DZN.cfg(), c = typeof D !== "undefined" && D.classes && D.classes[S.ci || 0];
    const names = c && c.students && c.students.length ? c.students.map((s) => s.name) : Array.from({length: 18}, (_, i) => `${i + 1}-o'quvchi`);
    const rows = names.map((n, i) => `<div class="tg-sr"><span class="nm">${i + 1}</span><span class="na">${esc(n)}</span><span class="gr">${[2, 3, 4, 5].map((g) => `<button class="btn btn-sm" data-g="${g}">${g}</button>`).join("")}</span></div>`).join("");
    modal(`<h2>Baho qo'yish${c ? " · " + esc(c.name) : ""}</h2><p class="muted" style="margin:0">Sinov oynasi: hech narsa saqlanmaydi · ${names.length} o'quvchi</p><div class="tg-sl">${rows}</div><div class="hrow">${foot(z, false)}</div>`, (m, close) => {
      m.querySelectorAll("[data-g]").forEach((b) => b.onclick = () => { const on = !b.classList.contains("btn-primary"); b.parentNode.querySelectorAll("[data-g]").forEach((x) => x.classList.remove("btn-primary")); if (on) b.classList.add("btn-primary"); });
      m.querySelectorAll("[data-x],[data-ok]").forEach((b) => b.onclick = () => close(null));
    });
  }
  function bind(m) { m.querySelectorAll("[data-tg-try]").forEach((b) => b.onclick = tryDialog); }

  // asosiy tugma shakli (to'liq rang — tpt-tema.css dagi standart)
  function css(z) {
    const p = `html.tpt-all.dz .btn.btn-primary`;
    if (z.shape === "soft") return `${p},${p}:hover{background:var(--acc-soft);border-color:transparent;color:var(--acc-t,var(--acc));box-shadow:none}${p}:hover{background:color-mix(in srgb,var(--acc) 22%,var(--base))}`;
    if (z.shape === "line") return `${p},${p}:hover{background:transparent;border:1.5px solid var(--acc);color:var(--acc-t,var(--acc));box-shadow:none}${p}:hover{background:var(--acc-soft)}`;
    return "";
  }
  return {SHAPES, body, bind, css};
})();
