/* Ikki qurilmani birlashtirish (Telegram zaxirasi orqali almashganda).
   Uch tomonlama: base — oxirgi umumiy holat (shu qurilma oxirgi yuborgan yoki yuklagan zaxira), mine — shu qurilma, theirs — Telegram'dagi.
   Har katak alohida: faqat bir tomonda o'zgargani o'sha tomondan olinadi; ikkala tomonda turlicha o'zgargani — ziddiyat (o'qituvchi tanlaydi).
   base bo'lmasa (eski zaxira): Telegram'dagi asos, unda bo'sh bo'lgan kataklar shu qurilmadan to'ldiriladi, qolgan farqlar — ziddiyat.
   Bu fayl asosiy skriptdan OLDIN ulanadi; IDB, idbReq (saqlash.js) faqat chaqirilganda ishlatiladi. */
"use strict";
const SINX = (() => {
  const ck = (c) => `${c.name}|${c.subject || ""}|${c.kind || ""}`;
  const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const empty = (v) => v === undefined || v === null || v === "";
  const findStu = (list, s) => (s.id && list.find((x) => x.id === s.id)) || list.find((x) => x.name === s.name) || null;
  const stuAll = (c) => (c.students || []).concat(c.students_off || []);

  // bitta lug'at (baholar, ballar, mavzular) bo'yicha uch tomonlama birlashtirish
  function cells(bo, mo, oo, where, R) {
    for (const k of new Set([...Object.keys(mo || {}), ...Object.keys(bo || {})])) {
      const m = mo[k], o = oo[k];
      if (same(m, o)) continue;
      if (bo) {
        const b = bo[k];
        if (same(m, b)) continue;                           // shu qurilmada o'zgarmagan — Telegram'dagi qoladi
        if (same(o, b)) { put(oo, k, m); R.n++; continue; }   // faqat shu qurilmada o'zgargan
      } else if (empty(o)) { put(oo, k, m); R.n++; continue; }  // asos yo'q: Telegram'da bo'sh — shu qurilmanikini olamiz
      else if (empty(m)) continue;
      R.clash.push({...where, key: k, mine: m, theirs: o, obj: oo});
    }
  }
  function put(o, k, v) { if (empty(v)) delete o[k]; else o[k] = v; }
  const union = (a, b) => [...new Set([...(a || []), ...(b || [])])].sort();

  function merge(base, mine, theirs) {
    const out = structuredClone(theirs), R = {n: 0, added: 0, clash: [], data: out};
    const B = base ? new Map(base.classes.map((c) => [ck(c), c])) : null;
    for (const mc of mine.classes) {
      const oc = out.classes.find((c) => ck(c) === ck(mc)), bc = B && B.get(ck(mc));
      if (!oc) { if (!bc) { out.classes.push(structuredClone(mc)); R.added++; } continue; }   // asosda bor edi — u yerda o'chirilgan
      const where = {cls: [mc.name, mc.subject].filter(Boolean).join(" · ")};
      for (const k of ["dates", "att_ok", "held"]) oc[k] = union(oc[k], mc[k]);
      oc.lessons = oc.lessons || {};
      cells(bc ? bc.lessons || {} : base ? {} : null, mc.lessons || {}, oc.lessons, {...where, what: "mavzu"}, R);
      // dars ishlanmalari (ishlanma.js): har dars ishlanmasi alohida katak
      if (mc.ish || oc.ish) { oc.ish = oc.ish || {}; cells(bc ? bc.ish || {} : base ? {} : null, mc.ish || {}, oc.ish, {...where, what: "ishlanma"}, R); }
      oc.works = oc.works || [];
      for (const w of mc.works || []) if (!oc.works.some((x) => x.id === w.id) && !(bc && (bc.works || []).some((x) => x.id === w.id))) { oc.works.push(structuredClone(w)); R.added++; }
      for (const ms of stuAll(mc)) {
        let os = findStu(stuAll(oc), ms);
        const bs = bc ? findStu(stuAll(bc), ms) : null;
        if (!os) {
          if (bs) continue;                                     // Telegram'dagi nusxada o'chirilgan
          os = structuredClone(ms); (mc.students_off || []).includes(ms) ? (oc.students_off = oc.students_off || []).push(os) : oc.students.push(os); R.added++;
          continue;
        }
        const w = {...where, student: ms.name};
        os.marks = os.marks || {}; os.scores = os.scores || {};
        cells(bs ? bs.marks || {} : base ? {} : null, ms.marks || {}, os.marks, {...w, what: "baho"}, R);
        cells(bs ? bs.scores || {} : base ? {} : null, ms.scores || {}, os.scores, {...w, what: "ball"}, R);
      }
    }
    // o'zgarishlar tarixi: ikkala tomondagi yozuvlar
    const seen = new Set((out.changelog || []).map((e) => JSON.stringify(e)));
    out.changelog = (out.changelog || []).concat((mine.changelog || []).filter((e) => !seen.has(JSON.stringify(e))))
      .sort((a, b) => String(a.t).localeCompare(String(b.t))).slice(-5000);
    return R;
  }
  // ziddiyatlarni hal qilish: "mine" — shu qurilmanikini olish, "theirs" — Telegram'dagi qoladi
  function resolve(R, pick) { if (pick === "mine") for (const x of R.clash) put(x.obj, x.key, x.mine); return R.data; }

  // oxirgi umumiy holat IndexedDB'da (localStorage'ni ikki baravar to'ldirmaslik uchun)
  async function setBase(txt) { try { if (IDB.db) await idbReq("kv", "readwrite", (st) => st.put(txt, "sync_base")); } catch (e) { console.warn("sinx:", e); } }
  async function getBase() { try { const t = IDB.db && await idbReq("kv", "readonly", (st) => st.get("sync_base")); return t ? JSON.parse(t) : null; } catch (e) { return null; } }
  const show = (v) => empty(v) ? "—" : typeof v === "object" ? (v.topic || v.hw || (v.type ? `${v.type} darsi ishlanmasi` : "…")) : String(v).toUpperCase();
  return {merge, resolve, setBase, getBase, show};
})();
