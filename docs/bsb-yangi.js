/* BSB / CHSB / Loyiha eksporti — «Yangi» varaq dizayni va uning paneli (bsb-yangi.css bilan; maket v4.1, Akmal tasdiqlagan).
   «Hozirgi» dizayn bsb-eksport.js da o'zgarishsiz: H.bx.d === "old" (standart). Yangi tanlovlar H.bx.d va H.bx.n da saqlanadi.
   Varaq bloklari tayyor HTML bo'lib keladi; shu yerda faqat DOM orqali bezak qo'shiladi (deco) — hisob-kitob va bo'lish bsb-eksport.js da. */
const BXN = (() => {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
  const TH = [["", "Yashil", "#0b5c5a"], ["t-kok", "Ko'k", "#1e3a8a"], ["t-bin", "Binafsha", "#5b2a86"], ["t-iliq", "Iliq", "#854908"], ["t-qiz", "Burgundiy", "#8a1c2b"], ["t-bw", "Oq-qora", "#222"]];
  const DEF = {th: "", hs: "", ff: "sans", dn: "od", fr: false, zbr: true, gc: false, wm: false, mo: false, ft: true};
  const PRESETS = [["zam", "Zamonaviy", {hs: "", ff: "sans", dn: "od", fr: false, zbr: true, gc: false, wm: false, mo: false, ft: true}],
    ["yen", "Yengil", {hs: "h-l", ff: "sans", dn: "od", fr: false, zbr: true, gc: false, wm: false, mo: false, ft: true}],
    ["ras", "Rasmiy", {hs: "h-n", ff: "serif", dn: "od", fr: true, zbr: false, gc: false, wm: false, mo: true, ft: true}],
    ["ixc", "Ixcham", {hs: "", ff: "sans", dn: "ix", fr: false, zbr: true, gc: false, wm: false, mo: false, ft: true}]];
  const PT = {
    zam: `<svg viewBox="0 0 60 40"><rect width="60" height="40" fill="#fff"/><rect width="60" height="12" fill="currentColor"/><circle cx="52" cy="6" r="4" fill="none" stroke="#fff" stroke-width="1"/><rect x="4" y="16" width="12" height="6" rx="1.5" fill="currentColor" opacity=".18"/><rect x="18" y="16" width="12" height="6" rx="1.5" fill="currentColor" opacity=".18"/><rect x="32" y="16" width="12" height="6" rx="1.5" fill="currentColor" opacity=".18"/><rect x="4" y="26" width="52" height="2" fill="currentColor"/><rect x="4" y="30" width="52" height="1.4" fill="#ddd"/><rect x="4" y="33" width="52" height="1.4" fill="#ddd"/></svg>`,
    yen: `<svg viewBox="0 0 60 40"><rect width="60" height="40" fill="#fff"/><rect width="60" height="12" fill="currentColor" opacity=".16"/><rect y="12" width="60" height="1.6" fill="currentColor"/><rect x="4" y="4" width="30" height="3" fill="#333"/><rect x="4" y="17" width="12" height="6" rx="1.5" fill="currentColor" opacity=".18"/><rect x="18" y="17" width="12" height="6" rx="1.5" fill="currentColor" opacity=".18"/><rect x="4" y="27" width="52" height="1.4" fill="#ddd"/><rect x="4" y="30" width="52" height="1.4" fill="#ddd"/><rect x="4" y="33" width="52" height="1.4" fill="#ddd"/></svg>`,
    ras: `<svg viewBox="0 0 60 40"><rect width="60" height="40" fill="#fff"/><rect x="2.5" y="2.5" width="55" height="35" fill="none" stroke="currentColor" stroke-width="1"/><rect x="7" y="6" width="3" height="9" fill="currentColor"/><rect x="13" y="6" width="26" height="3" fill="#333"/><rect x="13" y="11" width="18" height="2" fill="#999"/><rect x="7" y="19" width="46" height="1.4" fill="#bbb"/><rect x="7" y="22" width="46" height="1.4" fill="#bbb"/><rect x="7" y="25" width="46" height="1.4" fill="#bbb"/><circle cx="48" cy="32" r="3" fill="none" stroke="#999" stroke-dasharray="1.4 1"/></svg>`,
    ixc: `<svg viewBox="0 0 60 40"><rect width="60" height="40" fill="#fff"/><rect width="60" height="8" fill="currentColor"/><rect x="4" y="11" width="52" height="1.6" fill="currentColor"/><g fill="#ddd"><rect x="4" y="14" width="52" height="1.2"/><rect x="4" y="16.6" width="52" height="1.2"/><rect x="4" y="19.2" width="52" height="1.2"/><rect x="4" y="21.8" width="52" height="1.2"/><rect x="4" y="24.4" width="52" height="1.2"/><rect x="4" y="27" width="52" height="1.2"/><rect x="4" y="29.6" width="52" height="1.2"/><rect x="4" y="32.2" width="52" height="1.2"/><rect x="4" y="34.8" width="52" height="1.2"/></g></svg>`};
  const ELS = [["fr", "Sahifa ramkasi", ""], ["zbr", "Chiziqli qatorlar", "O'quvchilar jadvalida"], ["gc", "Baho katagi to'liq rangli", "Chiplar o'rniga"], ["wm", "Suv belgisi", "Maktab nomi, xira"], ["mo", "«M.O'.» muhr joyi", "Imzolar yonida"], ["ft", "Pastki yozuv", "Sinf · fan · sana · bet"]];
  const DVL = [["tab", "Jadval"], ["row", "Qator"], ["bar", "Chiziq"], ["col", "Ustun"]];

  /* ───────── sozlamalar ───────── */
  function norm(x) {                       // H.bx ga d («old» | «new») va n (yangi dizayn tanlovlari) qo'shiladi
    x.d = x.d === "new" ? "new" : "old";
    const n = Object.assign({}, DEF, x.n && typeof x.n === "object" ? x.n : {});
    n.th = TH.some((t) => t[0] === n.th) ? n.th : "";
    n.hs = ["", "h-l", "h-n"].includes(n.hs) ? n.hs : "";
    n.ff = n.ff === "serif" ? "serif" : "sans";
    n.dn = ["ix", "od", "ke"].includes(n.dn) ? n.dn : "od";
    for (const k of ["fr", "zbr", "gc", "wm", "mo", "ft"]) n[k] = !!n[k];
    x.n = n;
    return x;
  }
  const isNew = (H) => H.bx.d === "new";
  const cls = (H) => { const n = H.bx.n; return ["nw", n.th, n.hs, n.ff === "serif" ? "f-serif" : "", n.dn === "ix" ? "dn-ix" : n.dn === "ke" ? "dn-ke" : "", n.zbr ? "zbr" : "", n.gc ? "gc" : "", n.ft ? "" : "nof"].filter(Boolean).join(" "); };

  /* suv belgisi: burilgan matn rasm bo'lib (PDF ga ham o'tadi) */
  const wmCache = {};
  function wmImg(text) {
    const t = String(text || "").trim() || "BSB";
    if (wmCache[t]) return wmCache[t];
    const cv = document.createElement("canvas"); cv.width = 1040; cv.height = 520; const c = cv.getContext("2d");
    c.translate(520, 260); c.rotate(-32 * Math.PI / 180); c.textAlign = "center"; c.textBaseline = "middle";
    let fs = 78; c.font = `800 ${fs}px Manrope, Arial, sans-serif`; const w = c.measureText(t).width; if (w > 860) { fs = Math.max(26, fs * 860 / w); c.font = `800 ${fs}px Manrope, Arial, sans-serif`; }
    c.fillStyle = "rgba(0,0,0,.055)"; c.fillText(t, 0, 0);
    return (wmCache[t] = cv.toDataURL("image/png"));
  }
  const extra = (H) => { const n = H.bx.n; return `${n.fr ? '<div class="bx-fr"></div><div class="bx-fr bx-fr2"></div>' : ""}${n.wm ? `<img class="bx-wm" alt="" src="${wmImg(H.school)}">` : ""}`; };

  /* ───────── varaq bloklarini bezash ───────── */
  function deco(html, X, H, form) {
    const n = H.bx.n, tpl = document.createElement("template"); tpl.innerHTML = html; const root = tpl.content.firstElementChild; if (!root) return html;
    const an = X.an;
    const hd = root.matches(".bx-hd") ? root : root.querySelector(".bx-hd");
    if (hd) { const b = document.createElement("div"); b.className = "bx-cb"; b.innerHTML = `${esc(X.meta.cls)}<small>${esc(String(X.meta.subject || "").slice(0, 5))}${X.meta.subject ? "." : ""}</small>`; hd.prepend(b); }
    const kp = root.matches(".bx-kpis") ? root : root.querySelector(".bx-kpis");
    if (kp && an.n) { const K = [...kp.querySelectorAll(":scope>.bx-kpi")], bar = (i, v) => { if (K[i]) K[i].insertAdjacentHTML("beforeend", `<em class="bx-kp"><u style="width:${Math.max(0, Math.min(100, Math.round(v)))}%"></u></em>`); };
      bar(0, 100 * an.n / Math.max(1, X.c.students.length)); bar(2, an.mastery); bar(3, an.quality); }
    for (const t of root.matches("table") ? [root] : root.querySelectorAll("table")) {
      const h0 = t.querySelector("th"); if (!h0 || h0.textContent.trim() !== "№") continue;
      t.classList.add("bx-stu");
      let i = 0;
      for (const tr of t.rows) {
        if (tr.querySelector("th") || /\b(mx|sm|ab)\b/.test(tr.className)) continue;
        const tds = tr.cells, last = tds[tds.length - 1], m = /--g(\d)/.exec(last.getAttribute("style") || "");
        if (m) { last.classList.add("g" + m[1]); if (m[1] === "2") tr.classList.add("low"); }
        if (form === 1 && H.bx.ord1 === "score" && i < 3) tds[0].classList.add("mdl", "m" + i);
        i++;
      }
    }
    if (form === 1 && root.querySelector(".bx-stu")) {   // baho oralig'i chiplari
      const g = (v, l) => `<span style="background:var(--g${v})">${v} · ${l}</span>`;
      root.insertAdjacentHTML("beforeend", `<div class="bx-gl">${g(5, "86–100%")}${g(4, "66–85%")}${g(3, "30–65%")}${g(2, "30% dan past")}</div>`);
    }
    const sg = root.querySelector(".bx-sig");
    if (sg && n.mo) { sg.insertAdjacentHTML("beforeend", `<div><span class="bx-mo">M.O'.</span></div>`); sg.style.setProperty("--n", String(sg.children.length)); }
    return root.outerHTML;
  }

  /* ───────── panel ───────── */
  const seg = (id, opts, cur, cl) => `<div class="bx-seg ${cl || ""}" data-seg="${id}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" class="${String(v) === String(cur) ? "on" : ""}">${l}</button>`).join("")}</div>`;
  const tg = (k, t, s, on) => `<div class="bxn-sw"><span>${t}${s ? `<small>${s}</small>` : ""}</span><button type="button" class="bxn-tg ${on ? "on" : ""}" data-nt="${k}" role="switch" aria-checked="${!!on}" aria-label="${t}"></button></div>`;
  const preOf = (n) => { const f = PRESETS.find(([, , o]) => Object.keys(o).every((k) => n[k] === o[k])); return f ? f[0] : ""; };
  const thName = (c) => (TH.find((t) => t[0] === c) || TH[0])[1];
  function formHtml(H) {
    return `<div class="bx-lbl">Shakl</div>${seg("nform", [[1, `Tahlil hisoboti · <span data-fcn2="1"></span>`], [2, `Rasmiy shakl · <span data-fcn2="2"></span>`]], H.bx.form, "bxn-full")}`;
  }
  function styleHtml(H, hideDv) {
    const n = H.bx.n, cp = preOf(n), col = (TH.find((t) => t[0] === n.th) || TH[0])[2];
    return `<div><div class="bx-lbl">Uslub</div><div class="bxn-pre">${PRESETS.map(([k, nm]) => `<button type="button" class="bxn-pc ${cp === k ? "on" : ""}" data-np="${k}" style="color:${col}">${PT[k]}<b>${nm}</b></button>`).join("")}</div>
      <div class="bx-lbl" style="margin-top:10px">Rang</div><div class="bxn-dots">${TH.map(([k, nm, c]) => `<button type="button" class="bxn-dot ${n.th === k ? "on" : ""} ${k === "t-bw" ? "bw" : ""}" data-nth="${k}" style="background:${c}" aria-label="${nm}" aria-pressed="${n.th === k}"></button>`).join("")}</div>
      <div class="bxn-dn">${thName(n.th)}${n.th === "t-bw" ? " (chop etishga qulay)" : ""}${cp ? "" : " · o'z sozlamangiz"}</div></div>
      <details class="bxn-g"><summary>Boshqa sozlamalar<small>shrift, zichlik…</small></summary><div class="bxn-in">
        <div class="bxn-row"><span>Sarlavha</span>${seg("nhs", [["", "Rangli"], ["h-l", "Yengil"], ["h-n", "Oddiy"]], n.hs)}</div>
        <div class="bxn-row"><span>Shrift</span>${seg("nff", [["sans", "Zamonaviy"], ["serif", "Rasmiy"]], n.ff)}</div>
        <div class="bxn-row"><span>Zichlik</span>${seg("ndn", [["ix", "Ixcham"], ["od", "Oddiy"], ["ke", "Keng"]], n.dn)}</div>
        ${hideDv ? "" : `<div class="bxn-row"><span>Taqsimot</span>${seg("ndv", DVL, H.bx.dv)}</div>`}
        <div>${ELS.map(([k, t, s]) => tg(k, t, s, n[k])).join("")}</div></div></details>`;
  }
  // morph: faqat o'zgargan tugunlar yangilanadi — panel va varaq o'z joyida qoladi (scroll, ochiq bo'limlar)
  function morph(el, html) { const t = document.createElement("div"); t.innerHTML = html; kids(el, t); }
  function kids(a, b) {
    const A = [...a.childNodes], B = [...b.childNodes];
    B.forEach((nb, i) => { const na = A[i];
      if (!na) a.appendChild(nb);
      else if (na.nodeType !== nb.nodeType || na.nodeName !== nb.nodeName) a.replaceChild(nb, na);
      else if (na.nodeType !== 1) { if (na.nodeValue !== nb.nodeValue) na.nodeValue = nb.nodeValue; }
      else { const det = na.tagName === "DETAILS";
        for (const at of [...na.attributes]) if (!nb.hasAttribute(at.name) && !(det && at.name === "open")) na.removeAttribute(at.name);
        for (const at of [...nb.attributes]) if (na.getAttribute(at.name) !== at.value && !(det && at.name === "open")) na.setAttribute(at.name, at.value);
        if (na.tagName === "INPUT" || na.tagName === "TEXTAREA") { if (na !== document.activeElement && na.value !== nb.value) na.value = nb.value; } else kids(na, nb); } });
    for (let i = A.length - 1; i >= B.length; i--) A[i].remove();
  }
  /* yon panelning yangi qismlari; side() har safar chaqiradi */
  function side(mm, H, hideDv) {
    const f = mm.querySelector("[data-nform]"), s = mm.querySelector("[data-nstyle]");
    if (f) morph(f, formHtml(H));
    if (s) morph(s, styleHtml(H, hideDv));
  }
  function counts(mm, a, b) { mm.querySelectorAll('[data-fcn2="1"]').forEach((e) => { e.textContent = a; }); mm.querySelectorAll('[data-fcn2="2"]').forEach((e) => { e.textContent = b; }); }
  /* bosish: true qaytsa — shu yerda hal qilingan; ctx: {H, store, all, S} */
  function click(t, ctx) {
    const H = ctx.H, x = H.bx, n = x.n, id = t.parentElement && t.parentElement.dataset.seg, v = t.dataset.v;
    const done = () => { ctx.store(); ctx.all(); return true; };
    if (id === "dz") {
      if (v === x.d) return true;
      if (v === "new") { x.bwo = x.bw; x.bw = n.th === "t-bw"; } else if (x.bwo !== undefined) { x.bw = !!x.bwo; }   // Excel uchun oq-qora holati alohida saqlanadi
      x.d = v; return done();
    }
    if (id === "nform") { x.form = +v; ctx.S.bavar = +v; return done(); }
    if (id === "nhs") { n.hs = v; return done(); }
    if (id === "nff") { n.ff = v; return done(); }
    if (id === "ndn") { n.dn = v; return done(); }
    if (id === "ndv") { x.dv = v; return done(); }
    if (t.dataset.np) { Object.assign(n, PRESETS.find((p) => p[0] === t.dataset.np)[2]); return done(); }
    if (t.dataset.nth !== undefined) { n.th = t.dataset.nth; if (isNew(H)) x.bw = n.th === "t-bw"; return done(); }
    if (t.dataset.nt) { n[t.dataset.nt] = !n[t.dataset.nt]; return done(); }
    return false;
  }
  return {norm, isNew, cls, extra, deco, side, counts, click, morph, TH};
})();
