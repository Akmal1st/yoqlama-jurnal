/* Umumiy «Chop etish va eksport» oynasi (EXP) — tasdiqlangan maket v7 (Akmal, 2026-11-14: «Tasdiqlayman»).
   Hamma hisobot uchun bitta oyna va bitta varaq dizayni: Excel · PDF · Telegram · Chop etish. Ko'rish = chop etish = PDF = Telegram (bir xil betlar).
   Yangi hisobot faqat varaq mazmunini beradi (spec), qolgani shu yerda:
     EXP.open({key, t, ic, docs: [{id, t, s, oris: ["p", "l"], ori, ord, xl}], opts: [{k, t, seg|sel, v}], chips: [[k, matn, yoqilgan]],
               spec: (o) => ({who, doc, period, title, sub, pre, cols, rows, post, fill, leg, sigs, cap, maxRh, …}) yoki ({…, pages: (o) => [html], land}),
               q: chorak (Telegram'ga yuborilsa chorak hisoboti belgisi uchun)})
   Varaq: bosh qism → yuqori bloklar → jadval → pastki bloklar → izoh → imzo → pastki qator. Bo'sh joy jadval qatorlari va grafiklarga
   taqsimlanadi, oxirgi betda 1–2 qator yolg'iz qolmaydi, imzo varaq tagida. CSS: docs/eksport.css (.exw ichida).
   Sozlamalar (rang, uslub, har hujjatning tanlovlari) — qurilmada (localStorage); maktab va imzo — D.web.bsb_hdr (hamma hujjatga bitta). */
const EXP = (() => {
  const LS = "yoqlama_exp", GAP = 10;
  const I = (n, c = "") => `<i class="bi bi-${n}${c ? " " + c : ""}" aria-hidden="true"></i>`;
  const G = {col: "c", sty: "zam"}; let ST = {};
  try { const s = JSON.parse(localStorage.getItem(LS) || "{}") || {}; if (s.g) { if (["c", "bw"].includes(s.g.col)) G.col = s.g.col; if (["zam", "yen", "ras", "ixc"].includes(s.g.sty)) G.sty = s.g.sty; } if (s.st && typeof s.st === "object") ST = s.st; } catch (e) {}
  const keep = () => { try { localStorage.setItem(LS, JSON.stringify({g: G, st: ST})); } catch (e) {} };
  // maktab va imzo: hamma hujjat uchun bitta (BSB eksporti, davomat va boshqalar bilan umumiy)
  const HDR = () => { const h = (D.web && D.web.bsb_hdr) || {}; return {school: h.school || "", teacher: h.teacher || "", head: h.head || "", role3: h.role3 || "MB rahbari", name3: h.deputy || ""}; };
  const setHdr = (k, v) => { D.web.bsb_hdr = Object.assign({}, D.web.bsb_hdr || {}, {[k === "name3" ? "deputy" : k]: v}); save(); };
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
  const dims = (land) => land ? {W: 1122, H: 791} : {W: 794, H: 1120};   // A4 ichiga aniq sig'adi (chop etishda bo'sh bet chiqmaydi)

  /* ───────── varaq ───────── */
  function flowPages(o, sp) {
    const land = o["ori_" + o.doc] === "l", {W, H} = dims(land), pad = 38, IW = W - 80;
    const headH = 62, foot = o.ch.pn ? 30 : 8, body = H - 2 * pad - foot - headH;
    const pre = (sp.pre || []).filter(Boolean), post = (sp.post || []).filter(Boolean).slice();
    if (sp.leg) post.push({k: "leg", h: sp.legH || 28, t: sp.leg});
    if (o.ch.sg && !sp.nosig) post.push({k: "sig", h: 40});
    post.forEach((b, k) => { post[k] = {...b, _p: 1}; });
    const hOf = (bs) => bs.reduce((a, b) => a + b.h + GAP, 0), wt = (r) => r.x || 1, units = (rs) => rs.reduce((a, r) => a + wt(r), 0);
    const ix = G.sty === "ixc", baseRh = ix ? 17 : 20, N0 = sp.rows && sp.rows.length ? units(sp.rows) : 0;
    // ikki qatorli ustun sarlavhasi (<small>) — sarlavha qatori kamida 30px
    const two = !!(sp.cols && sp.cols.some((c) => /<small>/.test(c.h))), ex = (rh) => two && !sp.fixRh ? Math.max(0, 30 - rh) : 0;
    const isCh = (b) => b.k === "row" && b.cells.some((c) => ["line", "bars", "hbars"].includes(c.k));
    let shr = 1;   // grafiklarni zichlash koeffitsienti (faqat bet soni kamaysa qoladi)
    // grafikli qatorning eng kichik balandligi: chiziqli/ustunli grafik 60% gacha, polosalar — qatorlar soniga qarab, boshqalar o'zgarmaydi
    const minH = (b) => Math.max(...b.cells.map((c) => c.k === "line" || c.k === "bars" ? Math.round(b.h * .6) : c.k === "hbars" ? 34 + c.items.length * 15 + (c.axis ? 14 : 0) : b.h));
    const cl = (b) => isCh(b) && shr < 1 ? {...b, h: Math.min(b.h, Math.max(minH(b), Math.round(b.h * shr)))} : {...b};
    const lay = (rh, one) => {
      const pages = []; let cur;
      const np = () => { cur = {items: [], left: body}; pages.push(cur); };
      const put = (b, nx) => { b = cl(b); const need = b.k === "sec" ? b.h + GAP + (nx ? nx.h : 5 * rh) : b.h; if (need + GAP > cur.left && cur.items.length) np(); cur.items.push(b); cur.left -= b.h + GAP; };   // bo'lim sarlavhasi keyingi blokdan ajralmaydi
      const putAll = (bs) => bs.forEach((b, k) => put(b, bs[k + 1]));
      np();
      if (!N0) putAll(pre.concat(post));
      else if (one) { putAll(pre); put({k: "tbl", rows: sp.rows, rh, h: (N0 + 1) * rh + 2 + ex(rh)}); putAll(post); }
      else {
        putAll(pre); let rest = sp.rows.slice();
        while (rest.length) {
          const cap = Math.floor((cur.left - GAP - 2 - ex(rh)) / rh) - 1;
          if (cap < 4 && cur.items.length) { np(); continue; }
          let take = 0, u = 0; while (take < rest.length && u + wt(rest[take]) <= cap) { u += wt(rest[take]); take++; }
          if (!take) take = 1;
          if (rest.length > take && rest.length - take < 3) take = Math.min(take, Math.max(3, rest.length - 3));   // oxirgi betda 1–2 qator yolg'iz qolmasin
          const part = rest.slice(0, take); put({k: "tbl", rows: part, rh, h: (units(part) + 1) * rh + 2 + ex(rh)}); rest = rest.slice(take); if (rest.length) np();
        }
        putAll(post);
      }
      return pages;
    };
    let pages, rh = sp.fixRh || baseRh;
    const one = body - hOf(pre) - hOf(post);
    if (N0 && !sp.fixRh && (N0 + 1) * 15 + 2 + GAP + ex(15) <= one) { rh = Math.min(sp.maxRh || 34, Math.floor((one - GAP - 2 - ex(15)) / (N0 + 1))); pages = lay(rh, 1); }
    else {
      pages = lay(rh);
      // oxirgi bet deyarli bo'sh qolsa — qatorlarni biroz zichlab, bet sonini kamaytirishga urinadi
      if (pages.length > 1) for (const [r2, s2] of sp.fixRh ? [] : (ix ? [[16, 1], [15, 1], [17, .8], [15, .75]] : [[19, 1], [18, 1], [17, 1], [16, 1], [20, .8], [18, .8], [16, .75]])) { shr = s2; const p2 = lay(r2); if (p2.length < pages.length) { pages = p2; rh = r2; break; } shr = 1; }
    }
    // qo'shimcha bloklar (sp.fill): oxirgi betda joy qolsa, izoh/imzodan oldin qo'yiladi — yangi bet qo'shmaydi
    for (const f of (sp.fill || []).filter(Boolean)) { const lp = pages[pages.length - 1]; if (lp.left < f.h + GAP) continue; let at = lp.items.findIndex((b) => b._p); if (at < 0) at = lp.items.length; lp.items.splice(at, 0, {...f}); lp.left -= f.h + GAP; }
    // to'ldirish: betdagi bo'sh joy avval jadval qatorlariga, keyin grafiklarga, so'ng boshqa qutilarga taqsimlanadi
    const rhCap = sp.fixRh ? Math.round(sp.fixRh * 1.8) : ix ? 34 : Math.max(sp.maxRh || 34, 34) + 14;
    // ko'p betli jadval: bet sonini o'zgartirmagan holda qatorlarni bir xil kattalashtiradi
    if (N0 && pages.length > 1 && !sp.fixRh) { const Np = pages.length; for (let r = rh + 1; r <= rhCap; r++) { const p2 = lay(r); if (p2.length !== Np) break; pages = p2; rh = r; } }
    const grow = (b) => isCh(b) ? 2 : b.k === "row" && b.cells.some((c) => ["note", "checks", "top", "list", "gtab"].includes(c.k)) ? 1 : b.k === "mtab" ? 1 : 0;
    pages.forEach((p, pi) => {
      let L = p.left; if (L < 6) return;
      const last = pi === pages.length - 1 && pages.length > 1;
      p.items.filter((b) => b.k === "tbl").forEach((b) => {
        const U = units(b.rows) + 1, nr = Math.min(rhCap, b.rh + Math.floor(L / U));
        if (last && nr > rh * 1.35 && !sp.fixRh) return;   // davomi betida qatorlar boshqa betlardan keskin farq qilmasin
        if (nr > b.rh) { const h2 = U * nr + 2 + ex(nr); L -= h2 - b.h; b.h = h2; b.rh = nr; }
      });
      for (const lv of [2, 1]) { const gs = p.items.filter((b) => grow(b) === lv); if (!gs.length || L < 6) continue;
        const add = Math.floor(L / gs.length); gs.forEach((b) => { const d = Math.min(add, lv === 2 ? Math.round(b.h * .9) : Math.round(b.h * .6)); b.h += d; L -= d; }); }
      // hali ham bo'sh joy ko'p bo'lsa — grafiklar cheklovsiz kattalashadi
      const gs = p.items.filter((b) => b.k === "row" && b.cells.some((c) => c.k === "line" || c.k === "bars"));
      if (L > 40 && gs.length && !last) { const add = Math.floor(L / gs.length); gs.forEach((b) => { const d = Math.min(add, Math.round(b.h * 1.5)); b.h += d; L -= d; }); }
      p.left = L;
    });
    const fsOf = (r) => sp.fixRh ? 11.5 : Math.max(ix ? 9 : 10, Math.min(sp.cols && sp.cols.length >= 9 ? 11.5 : 13.5, Math.round(r * (ix ? .5 : .48) * 2) / 2));
    const N = pages.length;
    pages.forEach((p) => p.items.forEach((b) => { if (b.k === "tbl") b.ex = ex(b.rh || rh); }));
    return {W, H, land, pages: pages.map((p, i) => `<div class="${pgCls(sp)}" style="width:${W}px;height:${H}px">${head1(o, sp, i)}<div class="pg-flow" style="height:${body - 10}px">${p.items.map((b) => blk(b, sp, IW, b.rh || rh, fsOf(b.rh || rh))).join("")}</div>${foot1(o, sp, i, N)}</div>`)};
  }
  const pgCls = (sp) => `e-pg s-${G.sty}${G.col === "bw" ? " bw" : ""}${sp && sp.fixRh ? " wr" : ""}`;
  // bosh qism: chapda o'qituvchi, o'rtada maktab, o'ngda chop etilgan sana; sarlavha va davr
  function head1(o, sp, i) {
    const h = HDR(), sch = [h.teacher ? `<span>${esc(h.teacher)} (o'qituvchi)</span>` : "<span></span>", `<span>${esc(h.school)}</span>`, `<span>Chop etilgan: <b>${fmt(todayIso())}</b></span>`];
    return `<div class="pg-hd">${o.ch.sch ? `<div class="pg-sch">${sch.join("")}</div>` : ""}
      <h1 class="${i ? "pg-cn" : ""}">${esc(sp.title)}${i ? ` <span class="dv">(davomi)</span>` : ""}</h1><div class="pg-sub">${esc(sp.sub || "")}</div></div>`;
  }
  const SIG3 = () => { const h = HDR(); return [["O'qituvchi", h.teacher], ["Sinf rahbari", h.head], [h.role3, h.name3]]; };
  const sigHtml = (sigs, st2) => `<div class="pg-sig n${sigs.length}" ${st2 ? `style="${st2}"` : ""}>${sigs.map(([t, n]) => `<div><span>${esc(t)}</span><span>${esc(n || "")}</span></div>`).join("")}</div>`;
  const foot1 = (o, sp, i, N) => o.ch.pn ? `<div class="pg-foot"><span>${esc([sp.who, sp.doc].filter(Boolean).join(" · "))}${sp.period ? " · " + esc(sp.period) : ""}</span><span>${i + 1} / ${N}</span></div>` : "";

  /* jadval katagi: oddiy qiymat yoki {v, c, pill, bar, lo, mid, gr, tags, marks, dist, b (qalin), n (Excel uchun son)} */
  const cellObj = (v) => v && typeof v === "object" && !Array.isArray(v) ? v : {v};
  const cellText = (v) => { const x = cellObj(v); return x.tags ? x.tags.map((t) => t[0]).join(", ") : x.marks ? x.marks.map(([d, m]) => `${d} ${m}`).join(", ") : x.dist ? x.dist.map(([t, n]) => `${t}: ${n}`).join(" · ") : x.v ?? ""; };
  function td(v, col) {
    const x = cellObj(v); let s = esc(x.v ?? "");
    if (x.bar != null) s = `<span class="mb"><i class="${x.lo ? "lo" : x.mid ? "mid" : x.gr ? "gr" : ""}" style="width:${Math.max(0, Math.min(100, x.bar))}%"></i></span>${s}`;
    if (x.pill) s = `<span class="pl ${x.c || ""}">${s}</span>`;
    if (x.tags) s = x.tags.map(([t, c]) => `<span class="tg ${c || ""}">${esc(t)}</span>`).join("");
    if (x.marks) s = x.marks.length ? x.marks.map(([d, m]) => `<span class="ym">${esc(d)} <b class="${m === "S" ? "r" : ""}">${esc(m)}</b></span>`).join("") : `<span class="mut">—</span>`;
    return `<td class="${(col && col.a) || ""} ${x.pill ? "" : x.c || ""} ${x.b ? "b" : ""} ${x.marks ? "wr" : ""}">${s}</td>`;
  }
  /* kichik bloklar (katakchalar) */
  const CELL = {
    dist: (c) => { const T = c.parts.reduce((a, p) => a + p[1], 0) || 1; return `${c.sub ? `<div class="dsub">${c.sub}</div>` : ""}<div class="ds">${c.parts.map(([, n, k]) => n ? `<i class="${k}" style="width:${n / T * 100}%">${n / T >= .07 && !c.nonum ? n : ""}</i>` : "").join("")}</div><div class="dl">${c.parts.map(([t, n, k]) => `<span><b class="${k}"></b>${esc(t)}: <strong>${n}</strong></span>`).join("")}</div>`; },
    line: (c, w, h) => {
      if (!c.pts.length) return `<div class="nt">${esc(c.empty || "Ma'lumot yo'q")}</div>`;
      const pl = 28, pr = 10, pt = 14, pb = 16, n = c.pts.length, X = (i) => pl + 10 + (w - pl - pr - 20) * (n === 1 ? .5 : i / (n - 1)), Y = (v) => pt + (h - pt - pb) * (1 - (v - c.min) / (c.max - c.min || 1));
      const pts = c.pts.map((p, i) => `${X(i)},${Y(p[1])}`).join(" ");
      return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${c.ticks.map((t) => `<line class="gl" x1="${pl}" x2="${w - pr}" y1="${Y(t)}" y2="${Y(t)}"/><text class="ax" x="${pl - 4}" y="${Y(t) + 3}" text-anchor="end">${c.fmt(t)}</text>`).join("")}
        <polygon class="ar" points="${X(0)},${Y(c.min)} ${pts} ${X(n - 1)},${Y(c.min)}"/><polyline class="ln" points="${pts}"/>${c.pts.map((p, i) => `<circle class="dt" cx="${X(i)}" cy="${Y(p[1])}" r="2.6"/>${c.lab === "last" && i < n - 1 ? "" : `<text class="vl" x="${X(i)}" y="${Y(p[1]) - 6}" text-anchor="middle">${c.fmt(p[1])}</text>`}${i % (c.every || 1) === 0 || i === n - 1 ? `<text class="ax" x="${X(i)}" y="${h - 3}" text-anchor="middle">${esc(p[0])}</text>` : ""}`).join("")}</svg>`;
    },
    bars: (c) => { const M = c.max || Math.max(...c.items.map((x) => x[1]), 0) || 1; return `<div class="pg-bars">${c.items.map(([l, v, k, t]) => `<div><em>${esc(t ?? v)}</em><i class="${k || ""}" style="height:${v / M * 78}%"></i><span>${esc(l)}</span></div>`).join("")}</div>`; },
    hbars: (c, w, h) => `<div class="e-hbx" style="grid-template-columns:${c.lw || 92}px 1fr ${c.rw || 38}px${c.rw2 ? " auto" : ""};grid-template-rows:repeat(${c.items.length},${Math.min(Math.round((c.rowH || 18) * 2.2), Math.floor((h - (c.axis ? 16 : 0)) / Math.max(1, c.items.length)))}px)${c.axis ? " 14px" : ""}">${c.items.map(([l, v, t, k, rt]) => `<span class="hl">${esc(l)}</span><span class="ht"><i class="${k || ""}" style="width:${Math.max(0, Math.min(100, v))}%"></i>${(c.guides || []).map((x) => `<b style="left:${x}%"></b>`).join("")}</span><span class="hv">${esc(t)}</span>${c.rw2 ? `<span class="hr">${esc(rt || "")}</span>` : ""}`).join("")}
      ${c.axis ? `<span></span><span class="hax">${c.axis.map((x) => `<i style="left:${x}%">${x}%</i>`).join("")}</span>` : ""}</div>`,
    top: (c) => c.items.length ? `<ol class="tp ${c.wide ? "wd" : ""} ${c.big ? "bg" : ""}">${c.items.map(([nm, ch, rt]) => `<li><span>${esc(nm)}</span>${(ch || []).map(([t, k]) => `<em class="${k || ""}">${esc(t)}</em>`).join("")}${rt ? `<strong>${esc(rt)}</strong>` : ""}</li>`).join("")}</ol>` : `<div class="nt">${esc(c.empty || "Yo'q")}</div>`,
    checks: (c) => `<ul class="ck">${c.items.map(([ok, t, nt]) => `<li class="${ok ? "ok" : "no"}">${I(ok ? "check-circle-fill" : "exclamation-triangle")}<span><b>${esc(t)}</b>${nt ? ` <small>${esc(nt)}</small>` : ""}</span></li>`).join("")}</ul>`,
    list: (c) => `<dl class="kv">${c.items.map(([k, v, cl]) => `<dt>${esc(k)}</dt><dd class="${cl || ""}">${esc(v)}</dd>`).join("")}</dl>`,
    note: (c) => c.ul ? `<ul class="nul ${c.dots ? "dots" : ""}">${c.ul.map((x) => `<li>${x}</li>`).join("")}</ul>` : `<div class="nt">${c.text}</div>`,
  };
  function blk(b, sp, IW, rh, fs) {
    const st0 = `style="height:${b.h}px"`;
    switch (b.k) {
      case "kpi": return `<div class="pg-kpi" style="height:${b.h}px;grid-template-columns:repeat(${b.items.length},1fr)">${b.items.map(([v, l, s, c, of]) => `<div><span>${esc(l)}</span><b class="${c || ""}">${esc(v)}${of != null && of !== "" ? `<em> / ${esc(of)}</em>` : ""}</b>${s ? `<small>${esc(s)}</small>` : ""}</div>`).join("")}</div>`;
      case "info": return `<div class="pg-info" style="height:${b.h}px;grid-template-columns:repeat(${b.cols || 3},1fr);grid-template-rows:repeat(${Math.ceil(b.items.reduce((a, x) => a + (x[2] || 1), 0) / (b.cols || 3))},1fr)">${b.items.map(([k, v, sp2]) => `<div ${sp2 ? `style="grid-column:span ${sp2}"` : ""}><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join("")}</div>`;
      case "sec": return `<div class="pg-sec" ${st0}><span>${esc(b.t)}</span></div>`;
      case "txt": return `<div class="pg-txt" ${st0}>${b.t}</div>`;
      case "row": { const n = b.cells.length, av = IW - (n - 1) * 12, sm = b.cells.reduce((a, x) => a + (x.span || 1), 0);
        return `<div class="pg-row" style="height:${b.h}px;grid-template-columns:${b.cells.map((c) => (c.span || 1) + "fr").join(" ")}">${b.cells.map((c) => { const w = av * (c.span || 1) / sm, box = ["note", "list", "dist", "checks", "hbars", "top", "line", "bars"].includes(c.k) && b.box !== false;
          return `<div class="pg-cell ${c.k} ${c.tone || ""} ${box ? "bx" : ""}">${c.t ? `<div class="pg-ct">${c.t}</div>` : ""}<div class="pg-cb">${CELL[c.k](c, Math.floor(w - (box ? 22 : 0)), b.h - (c.t ? 20 : 0) - (box ? 14 : 0))}</div></div>`; }).join("")}</div>`; }
      case "tbl": return `<table data-e="5" style="font-size:${fs}px"><colgroup>${sp.cols.map((c) => `<col style="width:${c.w}%">`).join("")}</colgroup>
        <thead><tr style="height:${sp.fixRh ? 28 : rh + (b.ex || 0)}px">${sp.cols.map((c) => `<th class="${c.a || ""}">${c.h}</th>`).join("")}</tr></thead>
        <tbody>${b.rows.map((r) => `<tr style="height:${rh * (r.x || 1)}px" class="${r.tot ? "tot" : ""} ${r.risk ? "risk" : ""} ${r.hl ? "hl" : ""}">${r.map((v, k) => td(v, sp.cols[k])).join("")}</tr>`).join("")}</tbody></table>`;
      case "leg": return `<div class="pg-leg" ${st0}><b>Izoh:</b> ${b.t}</div>`;
      case "sig": return sigHtml(sp.sigs || SIG3(), `height:${b.h}px;margin:auto 0 0`);
    }
    return "";
  }
  // yagona fayl nomi: «6-A Matematika · Sinf hisoboti · 1-chorak» (tutuq belgisi saqlanadi)
  const fileName = (sp) => [sp.who, sp.doc, sp.period].filter(Boolean).join(" - ").replace(/\s*·\s*/g, " - ").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "hisobot";   // ASCII ajratgich: «·» bilan ba'zi Chrome fayl nomini «download» qilib qo'yadi
  function build(F, o) {
    const sp = F.spec(o);
    if (sp.empty) return {sp, pages: [], W: 794, H: 1120, land: false};
    if (sp.pages) { const land = !!sp.land, {W, H} = dims(land); return {sp, W, H, land, pages: sp.pages(o, {cls: pgCls(sp), W, H, foot: (i, N) => foot1(o, sp, i, N), sig: sigHtml, hdr: HDR})}; }
    return {sp, ...flowPages(o, sp)};
  }
  const wrapOut = (B) => `<div class="exw e-out">${B.pages.join("")}</div>`;

  /* ───────── Excel: bir xil boshi (sarlavha, davr, maktab · o'qituvchi), rangli sarlavha, «Jami» qatori qalin ───────── */
  const xlHead = (h) => String(h).replace(/<small>(.*?)<\/small>/g, " ($1)").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&");
  const xlVal = (v) => { const x = cellObj(v); if (x.n !== undefined) return x.n; const t = cellText(v); if (typeof t === "number") return t; const s = String(t).trim();
    return s === "·" ? 0 : /^-?\d+(\.\d+)?$/.test(s) ? +s : s; };
  function xlAoa(sp) {
    const h = HDR(), C = sp.cols, info = [h.school, h.teacher ? `O'qituvchi: ${h.teacher}` : ""].filter(Boolean).join(" · ");
    return {aoa: [[sp.title], [sp.sub || ""], [info], [], C.map((c) => c.xh || xlHead(c.h)), ...sp.rows.map((r) => r.map(xlVal))], C};
  }
  async function excel(sp) {
    const {aoa, C} = xlAoa(sp), name = fileName(sp), wch = C.map((c) => Math.max(5, Math.round(c.xw || c.w * 1.25)));
    let XL; try { XL = await BXP.loadXlsxStyle(); } catch (e) { XL = null; }
    if (!XL) return saveTable(name, aoa, wch);
    const bw = G.col === "bw", K = bw ? "333333" : "0B6F79", K2 = bw ? "EEEEEE" : "E3F0EF", ZB = bw ? "F6F6F6" : "F5F9F8", LN = "BFC7C6";
    const ws = XL.utils.aoa_to_sheet(aoa), nC = C.length, bd = {style: "thin", color: {rgb: LN}}, BOX = {top: bd, bottom: bd, left: bd, right: bd};
    const put = (r, c, s) => { const a = XL.utils.encode_cell({r, c}); const x = ws[a] || (ws[a] = {t: "s", v: ""}); x.s = {font: {name: "Arial", sz: 10, ...(s.font || {})}, alignment: {vertical: "center", ...(s.alignment || {})}, ...(s.fill ? {fill: s.fill} : {}), ...(s.border ? {border: s.border} : {})}; };
    put(0, 0, {font: {bold: true, sz: 14, color: {rgb: K}}}); put(1, 0, {font: {color: {rgb: "555555"}}}); put(2, 0, {font: {color: {rgb: "555555"}}});
    for (let c = 0; c < nC; c++) put(4, c, {fill: {fgColor: {rgb: K}}, font: {bold: true, color: {rgb: "FFFFFF"}}, alignment: {horizontal: "center", wrapText: true}, border: BOX});
    sp.rows.forEach((row, i) => {
      const r = 5 + i;
      for (let c = 0; c < nC; c++) {
        const x = cellObj(row[c]), cls = x.c || "", red = /g2|p-r|\bu\b/.test(cls) && !bw, grn = /g5|p-g/.test(cls) && !bw;
        put(r, c, {border: BOX, alignment: {horizontal: C[c] && C[c].a === "l" ? "left" : "center", wrapText: !!(x.marks || x.tags)},
          font: {bold: !!(row.tot || x.b), ...(red ? {color: {rgb: "B8322A"}} : grn ? {color: {rgb: "2F7A3A"}} : {})},
          ...(row.tot ? {fill: {fgColor: {rgb: K2}}} : i % 2 ? {fill: {fgColor: {rgb: ZB}}} : {})});
      }
    });
    ws["!cols"] = wch.map((w) => ({wch: w}));
    ws["!merges"] = [0, 1, 2].map((r) => ({s: {r, c: 0}, e: {r, c: Math.max(0, nC - 1)}}));
    ws["!rows"] = aoa.map((_, i) => i === 0 ? {hpt: 22} : i === 4 ? {hpt: 30} : {});
    ws["!margins"] = {left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2};
    const wb = XL.utils.book_new(); XL.utils.book_append_sheet(wb, ws, (sp.doc || "Hisobot").replace(/[[\]:*?/\\]/g, " ").slice(0, 31));
    XL.writeFile(wb, name + ".xlsx", {cellStyles: true});
  }
  // Excel ko'rinishi (oynada): faylning boshi
  function xlHtml(sp) {
    const {aoa, C} = xlAoa(sp), L = (i) => i < 26 ? String.fromCharCode(65 + i) : "A" + String.fromCharCode(39 + i);
    const cl = (r, k) => { if (r < 5) return ""; const row = sp.rows[r - 5], x = cellObj(row[k]); return `${C[k] && C[k].a ? "" : "c "}${/g2|p-r/.test(x.c || "") ? "xr" : ""}${row.tot ? " tb" : ""}`; };
    return `<div class="xg" style="--xk:${G.col === "bw" ? "#444" : "#0b6f79"}"><table><thead><tr><th></th>${C.map((_, i) => `<th>${L(i)}</th>`).join("")}</tr></thead><tbody>${aoa.slice(0, 45).map((r, i) => `<tr><td class="rn">${i + 1}</td>${i < 4 ? `<td colspan="${C.length}" class="${i === 0 ? "t" : i < 3 ? "s" : ""}">${esc(r[0] ?? "")}</td>` : C.map((_, k) => `<td class="${i === 4 ? "h" : cl(i, k)}">${esc(r[k] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table>
      <div class="tabs-x"><span>${esc(sp.doc || "Hisobot")}</span></div></div>`;
  }

  /* ───────── chop etish va PDF ───────── */
  function print(B, name) {
    let el = document.getElementById("pdoc"); if (!el) { el = document.createElement("div"); el.id = "pdoc"; document.body.append(el); }
    el.className = "exw"; el.innerHTML = B.pages.join(""); document.body.classList.add("pdoc");
    let st2 = document.getElementById("pdoc-css"); if (!st2) { st2 = document.createElement("style"); st2.id = "pdoc-css"; document.head.append(st2); }
    st2.textContent = `@media print{@page{size:A4 ${B.land ? "landscape" : "portrait"};margin:0}}`;
    const old = document.title, back = () => { document.title = old; window.removeEventListener("afterprint", back); el.className = ""; document.body.classList.remove("pdoc"); };
    document.title = name; window.addEventListener("afterprint", back); setTimeout(() => { document.title = old; }, 120000);
    window.print();
  }
  const pdf = (B) => PTG.pagesPdf([wrapOut(B)], B.land, ".e-pg");
  async function savePdf(B, name) {
    const blob = await pdf(B), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name + ".pdf"; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }

  /* ───────── oyna ───────── */
  function state(F) {
    const old = ST[F.key] && typeof ST[F.key] === "object" ? ST[F.key] : {};
    const o = {doc: F.docs.some((d) => d.id === old.doc) ? old.doc : F.docs[0].id, ord: old.ord === "g" ? "g" : "l", ch: {sch: 1, sg: 1, pn: 1}};
    for (const [k, , on] of F.chips || []) o.ch[k] = on ? 1 : 0;
    for (const k of Object.keys(o.ch)) if (old.ch && k in old.ch) o.ch[k] = old.ch[k] ? 1 : 0;
    for (const d of F.docs) o["ori_" + d.id] = d.oris.includes(old["ori_" + d.id]) ? old["ori_" + d.id] : d.ori;
    for (const x of F.opts || []) { const ok = (x.seg || x.sel || []).some(([v]) => String(v) === String(old[x.k])); o[x.k] = x.keep && ok ? old[x.k] : x.v; }
    return o;
  }
  const remember = (F, o) => { const s = {doc: o.doc, ord: o.ord, ch: o.ch}; for (const d of F.docs) s["ori_" + d.id] = o["ori_" + d.id]; for (const x of F.opts || []) if (x.keep) s[x.k] = o[x.k]; ST[F.key] = s; keep(); };
  function open(F) {
    const o = state(F), U = {tab: "set", pv: "pdf", z: "fit", cap: null, capAuto: true, openHdr: false};
    let B = null, root = null, toastT = null;
    return modal(`<div class="exw e-dlgw"></div>`, (m, close) => {
      root = m.querySelector(".e-dlgw");
      const docOf = () => F.docs.find((d) => d.id === o.doc);
      const seg = (attr, opts, cur) => `<div class="e-seg" role="group">${opts.map(([v, t]) => `<button type="button" class="${String(v) === String(cur) ? "on" : ""}" data-${attr}="${esc(v)}">${t}</button>`).join("")}</div>`;
      function render() {
        const d = docOf(); B = build(F, o); const sp = B.sp;
        if (!d.xl || sp.noxl || sp.empty) U.pv = "pdf";
        if (U.capAuto) U.cap = sp.cap || "";
        const xl = d.xl && !sp.noxl && !sp.empty, np = B.pages.length, nm = fileName(sp), H = HDR(), tg = tgOn();
        const opt = (F.opts || []).filter((x) => !x.for || x.for === o.doc).map((x) => `<div class="sec"><span class="lb">${x.t}</span>${x.seg ? seg("op-" + x.k, x.seg, o[x.k])
          : `<select data-ops="${x.k}" aria-label="${esc(x.t)}">${x.sel.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(o[x.k]) ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>`}</div>`).join("");
        const chips = [["sch", "Maktab nomi"], ["sg", "Imzo qatori"], ["pn", "Bet raqami"], ...(F.chips || []).map(([k, t]) => [k, t])];
        root.innerHTML = `<div class="dlg" data-tab="${U.tab}">
          <div class="dh"><span class="dh-ic">${I(F.ic || "printer")}</span><div class="dh-t"><h2>Chop etish va eksport</h2><small>${esc(sp.doc || F.t)}${sp.who ? " · " + esc(sp.who) : ""}</small></div><button type="button" class="x" data-x aria-label="Yopish">${I("x-lg")}</button></div>
          <div class="tabs">${seg("tab", [["set", `${I("gear")} Sozlash`], ["pv", `${I("eye")} Ko'rish · ${U.pv === "xl" ? "Excel" : np + " bet"}`]], U.tab)}</div>
          <div class="db">
            <aside class="e-side">
              ${F.docs.length > 1 ? `<div class="sec"><span class="lb">Hujjat</span><div class="docs">${F.docs.map((x) => `<button type="button" class="doc ${x.id === o.doc ? "on" : ""}" data-doc="${x.id}"><b>${esc(x.t)}</b><span>${esc(x.s || "")}</span></button>`).join("")}</div></div>` : ""}
              ${opt}
              <div class="sec"><span class="lb">Ko'rinish</span><div class="ol">
                <span>Rang</span><div>${seg("col", [["c", "Rangli"], ["bw", "Oq-qora"]], G.col)}</div>
                ${d.oris.length > 1 ? `<span>Varaq</span>${seg("ori", [["p", "Tik"], ["l", "Albom"]], o["ori_" + o.doc])}` : `<span>Varaq</span><span class="fixed">${d.oris[0] === "l" ? "Albom" : "Tik"} <small>(faqat shu)</small></span>`}
                <span>Uslub</span><div class="seg4">${seg("sty", [["zam", "Zamonaviy"], ["yen", "Yengil"], ["ras", "Rasmiy"], ["ixc", "Ixcham"]], G.sty)}</div>
                ${d.ord ? `<span>Tartib</span>${seg("ord", [["l", "Ro'yxat"], ["g", "Natija ↓"]], o.ord)}` : ""}</div>
                <p class="e-hint">Rang va uslub hamma hujjat uchun bitta: bir marta tanlansa, hamma joyda shunday chiqadi. «Rasmiy» — Times shrifti, rangsiz jadval.</p></div>
              <div class="sec"><span class="lb">Varaqda</span><div class="e-chips">${chips.map(([k, t]) => `<button type="button" class="e-chip ${o.ch[k] ? "on" : ""}" data-ch="${k}" aria-pressed="${!!o.ch[k]}">${I("check2")}${esc(t)}</button>`).join("")}</div></div>
              <details class="e-grp" ${U.openHdr ? "open" : ""}><summary>${I("person-badge")} Maktab va imzo <small>${esc(H.teacher || "kiritilmagan")}</small>${I("chevron-down", "cv")}</summary><div class="gin">
                <label>Maktab nomi<input type="text" data-h="school" value="${esc(H.school)}"></label>
                <label>O'qituvchi<input type="text" data-h="teacher" value="${esc(H.teacher)}"></label>
                <label>Sinf rahbari<input type="text" data-h="head" value="${esc(H.head)}"></label>
                <label>Uchinchi imzo<select data-h="role3">${["MB rahbari", "Direktor o'rinbosari (O'IBDO')", "Metod birlashma rahbari"].map((x) => `<option ${x === H.role3 ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></label>
                <label>Uning ismi<input type="text" data-h="name3" value="${esc(H.name3)}"></label>
                <p class="e-hint">Hamma hujjat uchun bitta (BSB eksporti va davomat varag'i bilan umumiy).</p></div></details>
              <details class="e-grp"><summary>${I("telegram")} Telegram izohi <small>${U.capAuto ? "avtomatik" : "o'zgartirilgan"}</small>${I("chevron-down", "cv")}</summary><div class="gin">
                <textarea rows="4" data-cap aria-label="Telegram izohi">${esc(U.cap)}</textarea>
                <p class="e-hint">PDF bilan birga boradi. ${U.capAuto ? "" : `<button type="button" data-capr class="e-lnk">Avtomatik matnga qaytarish</button>`}</p></div></details>
            </aside>
            <div class="e-acts ${xl ? "" : "nx"}">
              <div class="fname" title="${esc(nm)}">${I("file-earmark-text")}<span>${esc(nm)}</span></div>
              ${tg ? "" : `<div class="tgw">${I("exclamation-triangle")}<span>Telegram ulanmagan.</span><button type="button" data-tgon>Ulash</button></div>`}
              <button type="button" class="e-ab xl" data-act="xl" ${xl ? "" : "hidden"}>${I("filetype-xlsx")}<span>Excel</span></button>
              <button type="button" class="e-ab pdf" data-act="pdf" ${np ? "" : "disabled"}>${I("filetype-pdf")}<span>PDF</span></button>
              <button type="button" class="e-ab tg" data-act="tg" ${tg && np ? "" : "disabled"}>${I("telegram")}<span>Telegram</span></button>
              <button type="button" class="e-ab pri" data-act="pr" ${np ? "" : "disabled"}>${I("printer")}<span>Chop etish</span></button>
            </div>
            <main class="prev">
              <div class="ph-h">${xl ? seg("pv", [["pdf", `${I("file-earmark-text")} Varaq`], ["xl", `${I("table")} Excel`]], U.pv) : `<span class="noxl">${sp.empty ? "" : "Excel yo'q: jadval emas"}</span>`}<span class="e-info">${U.pv === "xl" ? `${esc(nm)}.xlsx` : np ? `${np} bet · A4 ${B.land ? "albom" : "tik"} · ${G.col === "bw" ? "oq-qora" : "rangli"}` : ""}</span>${U.pv === "xl" || !np ? "" : seg("z", [["fit", `${I("arrows-angle-contract")} Sig'dirish`], ["100", "100%"]], U.z)}</div>
              ${U.pv === "xl" || !np ? "" : `<div class="same">${I("check2")} Chop etish, PDF va Telegram'da ham aynan shu ${np} bet</div>`}
              <div class="pages ${U.z === "100" && U.pv !== "xl" ? "z100" : ""}"></div>
            </main>
          </div></div>`;
        const host = root.querySelector(".pages");
        if (sp.empty) host.innerHTML = `<div class="e-empty"><b>${esc(sp.empty)}</b>${sp.emptyHint ? `<div class="e-xn">${esc(sp.emptyHint)}</div>` : ""}</div>`;
        else if (U.pv === "xl") host.innerHTML = xlHtml(sp);
        else {
          const avail = Math.max(200, host.clientWidth - 28), k = U.z === "fit" ? Math.min(1, avail / B.W) : 1;
          host.innerHTML = B.pages.map((h, i) => `<div><div class="e-pw" style="width:${Math.floor(B.W * k)}px;height:${Math.floor(B.H * k)}px">${h.replace('style="', `style="transform:scale(${k.toFixed(4)});`)}</div>${np > 1 ? `<div class="pno">${i + 1}-bet</div>` : ""}</div>`).join("");
        }
        bind();
      }
      function toast2(html) {
        const dlg = root.querySelector(".dlg"); let t = dlg.querySelector(".e-toast"); if (t) t.remove();
        t = document.createElement("div"); t.className = "e-toast"; t.setAttribute("role", "status"); t.innerHTML = html; dlg.append(t);
        clearTimeout(toastT); toastT = setTimeout(() => t.remove(), 3400);
      }
      const re = () => { remember(F, o); render(); };
      function bind() {
        const on = (sel, fn) => root.querySelectorAll(sel).forEach((b) => b.onclick = () => fn(b));
        on("[data-x]", () => close(null));
        on("button[data-tab]", (b) => { U.tab = b.dataset.tab; render(); });
        on("[data-doc]", (b) => { o.doc = b.dataset.doc; re(); });
        on("[data-col]", (b) => { G.col = b.dataset.col; keep(); render(); });
        on("[data-sty]", (b) => { G.sty = b.dataset.sty; keep(); render(); });
        on("[data-ori]", (b) => { o["ori_" + o.doc] = b.dataset.ori; re(); });
        on("[data-ord]", (b) => { o.ord = b.dataset.ord; re(); });
        on("[data-pv]", (b) => { U.pv = b.dataset.pv; render(); });
        on("[data-z]", (b) => { U.z = b.dataset.z; render(); });
        on("[data-ch]", (b) => { o.ch[b.dataset.ch] = o.ch[b.dataset.ch] ? 0 : 1; re(); });
        (F.opts || []).forEach((x) => on(`[data-op-${x.k}]`, (b) => { o[x.k] = b.getAttribute("data-op-" + x.k); re(); }));
        root.querySelectorAll("[data-ops]").forEach((s) => s.onchange = () => { o[s.dataset.ops] = s.value; re(); });
        root.querySelectorAll("[data-h]").forEach((i) => i.onchange = () => { setHdr(i.dataset.h, i.value.trim()); U.openHdr = true; render(); });
        const ta = root.querySelector("[data-cap]"); if (ta) ta.oninput = () => { U.cap = ta.value; U.capAuto = false; };
        on("[data-capr]", () => { U.capAuto = true; render(); });
        on("[data-tgon]", () => { close(null); S.sec = 5; go("settings"); });
        on("[data-act]", (b) => act(b));
      }
      let busy = false;
      async function act(b) {
        if (busy || !B) return;
        const a = b.dataset.act, sp = B.sp, nm = fileName(sp), np = B.pages.length, ICN = {xl: "filetype-xlsx", pdf: "filetype-pdf", tg: "telegram", pr: "printer"}[a];
        if (a === "pr") { print(B, nm); return; }
        const lbl = b.querySelector("span"), old = lbl.textContent, ph = root.clientWidth <= 720;
        const set = (ic, t) => { const i = b.querySelector("i"); if (i) i.outerHTML = I(ic); lbl.textContent = t; };
        busy = true; b.classList.add("busy"); set("hourglass-split", a === "tg" ? (ph ? "Yuborish…" : "Yuborilmoqda…") : ph ? "Tayyor…" : "Tayyorlanmoqda…");
        let ok = false;
        try {
          if (a === "xl") { await excel(sp); ok = true; toast2(`${I("check-circle-fill")} <span>Saqlandi: ${esc(nm)}.xlsx</span>`); }
          else if (a === "pdf") { await savePdf(B, nm); ok = true; toast2(`${I("check-circle-fill")} <span>Saqlandi: ${esc(nm)}.pdf · ${np} bet</span>`); }
          else if (a === "tg") { const Bx = B; ok = !!(await PTG.run(() => pdf(Bx), nm, U.cap || sp.cap || nm)); if (ok) { toast2(`${I("check-circle-fill")} <span>Telegram'ga yuborildi: ${esc(nm)}.pdf · ${np} bet</span>`); const qq = typeof F.q === "function" ? F.q(o) : F.q; if (qq) PTG.markQ(qq); } }
        } catch (e) { console.warn("Eksport:", e); toast(`${a === "xl" ? "Excel" : "PDF"} tayyorlanmadi: ${e.message}`); }
        finally {
          busy = false; if (!b.isConnected) return;
          b.classList.remove("busy");
          if (ok) { b.classList.add("done"); set("check2", a === "tg" ? "Yuborildi" : "Saqlandi"); setTimeout(() => { if (!b.isConnected) return; b.classList.remove("done"); set(ICN, old); }, 2600); }
          else set(ICN, old);
        }
      }
      render();
      // oyna kengligi o'zgarsa (telefonni burish) — varaq yana sig'diriladi
      let rzT = null; const rz = () => { clearTimeout(rzT); rzT = setTimeout(() => { if (root.isConnected) render(); else removeEventListener("resize", rz); }, 200); };
      addEventListener("resize", rz);
    });
  }
  return {open, build, flowPages, fileName, excel, xlAoa, cellObj, cellText, sigHtml, SIG3, HDR, I, pct, wrapOut, print, pdf, state: G};
})();
