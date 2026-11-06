/* eMaktab importi bir bosishda — tasdiqlangan maket (Akmal, 2026-11-06, /mnt/project-files/emaktab-import/emaktab-bir-tugma-maket.html).
   - Tasdiq (belgilash) oynasi yo'q: jurnallar darhol yangilanadi, oldin nusxa olinadi, natija oynasidagi «↶ Bekor qilish» uni qaytaradi.
   - Xatcho'pdan kelgan oldingi choraklar faqat jurnalda o'sha chorakda belgi bo'lmasa olinadi (joriy chorak — doim).
   - «Bugun» sahifasida «eMaktab» kartasi: oxirgi yangilangan vaqt va «🔄 eMaktab'dan yangilash» tugmasi.
   Bu fayl asosiy skriptdan OLDIN ulanadi; asosiy skriptdagi nomlar (D, mergeImport, findClass, …) faqat chaqirilganda ishlatiladi. */
const EMK1 = (() => {
  let undo = null;   // {txt, at} — oxirgi importdan oldingi holat (sahifa yopilguncha)

  // xatcho'pga: har sinf/fan uchun jurnalda belgisi bor choraklar (oldingi choraklarni qayta yuklamaslik uchun)
  function have() {
    return D.classes.filter((c) => !isGrp(c)).map((c) => ({n: c.name, s: c.subject || "",
      q: [1, 2, 3, 4].filter((q) => { const r = qRange(q); return r && c.students.some((s) => Object.keys(s.marks).some((d) => d >= r[0] && d <= r[1])); })}));
  }
  const ago = (iso) => {
    if (!iso) return "hali yangilanmagan";
    const m = Math.round((Date.now() - new Date(iso)) / 60000);
    if (m < 2) return "hozirgina"; if (m < 60) return `${m} daqiqa oldin`;
    const h = Math.round(m / 60); if (h < 24) return `${h} soat oldin`;
    const d = Math.round(h / 24); return d === 1 ? "kecha" : `${d} kun oldin`;
  };

  /* ───────── «Bugun» kartasi ───────── */
  function card(tel) {
    if (!D.classes.length || D.classes.every((c) => isGrp(c))) return "";
    const at = D.web.emk_at, fresh = at && Date.now() - new Date(at) < 3600000;
    return `<section class="card ek-sync${tel ? " tel" : ""}"><span class="ek-ic" aria-hidden="true">e</span>
      <span class="ek-tx"><b>eMaktab</b><small class="${fresh ? "ok" : ""}">${fresh ? `✓ Yangilandi: ${ago(at)}${D.web.emk_n ? ` · ${D.web.emk_n} jurnal` : ""}` : `Oxirgi yangilash: ${ago(at)}`}</small></span>
      <button class="btn btn-primary ek-go" data-ekgo>🔄 eMaktab'dan yangilash</button></section>`;
  }
  function bind(m) { m.querySelectorAll("[data-ekgo]").forEach((b) => b.onclick = start); }
  // xatcho'p qo'shilgan bo'lsa — eMaktab ochiladi, u yerda xatcho'p bosiladi; hali qo'shilmagan bo'lsa — yo'riqnoma
  function start() {
    if (!D.web.emk_bm) { emkDialog(); return; }
    let w = null; try { w = window.open("https://schools.emaktab.uz/v2/myclasses", "emaktab"); } catch (e) { w = null; }
    if (!w) { toast("eMaktab oynasi ochilmadi — emaktab.uz ni o'zingiz oching va «📒 Jurnal» xatcho'pini bosing"); return; }
    toast("eMaktab ochildi: u yerda «📒 Jurnal» xatcho'pini bosing");
  }

  /* ───────── import ───────── */
  const k2 = (x) => `${clsKey(x.name)}|${clsKey(x.subject)}`;
  // bir sinf/fanning bir nechta chorak fayli: eng oxirgisi (joriy) doim; oldingisi jurnalda o'sha sanalarda belgi bo'lsa — tashlanadi
  function pickQuarters(found) {
    const last = {}, skip = [];
    for (const x of found) { const k = k2(x), e = last[k]; if (!e || (x.dates[x.dates.length - 1] || "") > (e.dates[e.dates.length - 1] || "")) last[k] = x; }
    const out = found.filter((x) => {
      if (last[k2(x)] === x || !x.dates.length) return true;
      const [c] = findClass(x.name, x.subject); if (!c) return true;
      const lo = x.dates[0], hi = x.dates[x.dates.length - 1];
      if (c.students.some((s) => Object.keys(s.marks).some((d) => d >= lo && d <= hi))) { skip.push(x); return false; }
      return true;
    });
    return {out, skip};
  }
  async function run(files, opts) {
    toast("eMaktab jurnallari o'qilmoqda…");
    let found = [];
    try { files = await expandFiles(files); for (const f of files) found = found.concat(await readEmaktabFile(f)); }
    catch (e) { toast("Faylni o'qib bo'lmadi: " + e.message); return; }
    if (!found.length) { toast("Faylda emaktab «Fan jurnali» topilmadi (\"Sinf:\" qatori yo'q)"); return; }
    const {out, skip} = opts.auto ? pickQuarters(found) : {out: found, skip: []};
    if (out.some((x) => findClass(x.name, x.subject)[0]) && isLocked() && !await unlock()) return;
    document.querySelectorAll(".modal.ek-res").forEach((x) => x.remove());
    const txt = JSON.stringify(D);
    const reps = out.map((x) => Object.assign(mergeImport(x, true), {n: x.students.length, days: x.dates.length, q: x.quarter && x.quarter.q}));
    autoDates();
    D.web.emk_at = new Date().toISOString(); D.web.emk_n = new Set(out.map(k2)).size;
    save(); undo = {txt};
    S.ci = Math.max(0, D.classes.findIndex((c) => label(c) === reps[0].name));
    render();
    result(reps, skip);
  }
  // bitta jurnalning o'zgarishlari: «+41 baho, 6 almashtirildi»
  const chg = (r) => [r.filled ? `+${r.filled} belgi` : "", r.replaced ? `${r.replaced} almashtirildi` : "", r.removed ? `${r.removed} o'chirildi` : "",
    r.new_works || r.s_filled ? `BSB/CHSB: +${r.new_works} ish, ${r.s_filled} ball` : "", r.new_students.length ? `+${r.new_students.length} yangi o'quvchi` : ""].filter(Boolean).join(", ");
  const weight = (r) => r.filled + r.replaced + r.removed + r.s_filled + r.new_students.length * 5 + (r.created ? 1000 : 0);
  const warns = (r) => (r.absent.length || r.inactive) ? 1 : 0;
  function result(reps, skip) {
    const R = [...reps].sort((a, b) => warns(b) - warns(a) || weight(b) - weight(a));
    const main = R.filter((r, i) => i < 2 || warns(r) || r.created), rest = R.filter((r) => !main.includes(r));
    const qs = [...new Set(reps.map((r) => r.q).filter(Boolean))].sort();
    const row = (r) => `<div class="ek-ri"><b>${esc(r.name)}${r.created ? ` <span class="ek-new">yangi sinf</span>` : ""}</b>
      <span>${r.n} o'quvchi · ${r.days} kun${chg(r) ? ` · ${esc(chg(r))}` : " · o'zgarish yo'q"}</span>
      ${r.inactive ? `<span class="ek-w">Faylda bor, lekin faolsiz: ${esc(r.inactive.join(", "))}</span>` : ""}
      ${r.absent.length ? `<span class="ek-w">Faylda yo'q ${r.absent.length} o'quvchi: ${esc(r.absent.slice(0, 4).join(", "))}${r.absent.length > 4 ? "…" : ""}</span>
        <span class="ek-ra"><button class="btn btn-sm" data-absent="${esc(r.name)}">⏸ Faolsizlantirish</button></span>` : ""}
      ${Object.keys(r.skipped).length ? `<span class="ek-m">O'qilmagan qiymatlar: ${esc(Object.entries(r.skipped).map(([k, v]) => `«${k}» ×${v}`).join(", "))}</span>` : ""}</div>`;
    const arx = reps.reduce((a, r) => a + (r.arx || 0), 0);
    const notes = ["BSB/CHSB ballari almashtirilmadi, faqat bo'sh kataklar to'ldirildi.",
      arx ? `Arxivdagi chorak tegilmadi (${arx} ta belgi).` : "",
      skip.length ? `Oldingi chorak jurnalda bor edi, tegilmadi: ${esc([...new Set(skip.map((x) => x.name + (x.subject ? " · " + x.subject : "")))].join(", "))}.` : ""].filter(Boolean).join(" ");
    modal(`<div class="ek-res-in"><div class="ek-rh"><span class="ek-ok" aria-hidden="true">✓</span><h2>eMaktab'dan yangilandi</h2></div>
      <div class="ek-sub">${reps.length} jurnal${qs.length ? ` · ${qs.join(", ")}-chorak` : ""} · hozirgina</div>
      <div class="ek-list">${main.map(row).join("")}
        ${rest.length ? `<div class="ek-ri"><span>Yana ${rest.length} jurnal: ${esc(rest.map((r) => r.name).join(", "))}</span><span class="ek-ra"><button class="btn btn-sm" data-ekmore>Batafsil</button></span></div>
          <div class="ek-more" hidden>${rest.map(row).join("")}</div>` : ""}</div>
      <div class="ek-note">${notes}</div>
      <div class="ek-acts"><button class="btn" data-ekundo>↶ Bekor qilish</button><button class="btn btn-primary" data-x>Jurnalni ochish</button></div></div>`, (mm, close) => {
      mm.classList.add("ek-res");
      $("[data-x]", mm).onclick = () => { close(); S.jpage = "j"; go("journal"); };
      const mb = $("[data-ekmore]", mm); if (mb) mb.onclick = () => { const x = $(".ek-more", mm); x.hidden = !x.hidden; mb.textContent = x.hidden ? "Batafsil" : "Yashirish"; };
      $("[data-ekundo]", mm).onclick = () => { close(); revert(); };
      mm.querySelectorAll("[data-absent]").forEach((b) => b.onclick = () => {
        const r = reps.find((x) => x.name === b.dataset.absent), ci = D.classes.findIndex((c) => label(c) === r.name);
        close(); S.ci = ci; S.jpage = "j"; go("journal");
        studentsDialog(ci, r.absent, "Belgilanganlar emaktab faylida yo'q (boshqa sinfga o'tgan yoki maktabdan ketgan bo'lishi mumkin).");
      });
    });
  }
  function revert() {
    if (!undo) return;
    D = JSON.parse(undo.txt); undo = null; save(); render();
    toast("Import bekor qilindi: jurnal avvalgi holatiga qaytdi");
  }
  return {have, card, bind, start, run, revert, pickQuarters};
})();
