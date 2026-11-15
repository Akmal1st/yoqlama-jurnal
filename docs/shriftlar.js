/* Dastur ichidagi ochiq litsenziyali (SIL OFL 1.1) serif shriftlar — Akmal, 2026-11-15: «Times o'rniga muqobil shriftlar, barchasini qo'sh».
   Bitta ro'yxat uch joyga xizmat qiladi:
   - Sozlamalar → Dizayn → Yozuv turi (dizayn.js) — butun dastur shrifti (app.css dagi @font-face, vendor/<fayl>-<uslub>.woff2);
   - Bo'sh varaq → Shrift to'plami (bosh-varaq.js) — har shriftga mos uslub (sarlavha, jadval, sarlavha qalinligi);
   - PDF (pdf-tg.js) — vendor/pdf-shrift/<fayl>-<uslub>.js (base64 TTF), kalit: <k>R / <k>B / <k>I / <k>BI.
   Shriftlar lotin + kirill + ʻ ʼ bilan qisqartirilgan; qaysidir harf shriftda bo'lmasa (masalan STIX'da Ққ Ғғ Ҳҳ) — Liberation Serif'dan.
   [k, nomi, fayl, Dizayn izohi, Bo'sh varaq izohi, jadval shrifti (bo'lmasa — o'zi)] */
const SHR = (() => {
  const L = [
    ["lb", "Libertinus Serif", "libertinus-serif", "Nafis, kitobiy", "Nafis kitobiy shrift, rasmiy hujjat uchun"],
    ["tn", "Tinos", "tinos", "Times o'lchamida", "Times bilan bir xil o'lcham, rasmiy hujjat"],
    ["st", "STIX Two Text", "stix-two-text", "Times uslubida", "Times'ga eng yaqin ko'rinish, ilmiy uslub"],
    ["pt", "PT Serif", "pt-serif", "Kirill uchun chiroyli", "O'zbekcha kirill yozuvi uchun eng chiroyli"],
    ["no", "Noto Serif", "noto-serif", "Tiniq, oddiy", "Tiniq va oddiy, har tilda bir xil"],
    ["ss", "Source Serif 4", "source-serif-4", "Zamonaviy kitobiy", "Zamonaviy kitobiy, ekranda ham aniq"],
    ["lt", "Literata", "literata", "Kitob o'qish uchun", "Kitobdagidek yumshoq, o'qishga qulay"],
    ["mw", "Merriweather", "merriweather", "Yirik, aniq", "Yirik va aniq, kichik harfda ham o'qiladi"],
    ["lo", "Lora", "lora", "Yumshoq, chiroyli", "Yumshoq, chiroyli sarlavha"],
    ["eb", "EB Garamond", "eb-garamond", "Klassik Garamond", "Klassik Garamond sarlavha, PT Serif jadval", "PT Serif"]];
  const css = (n) => `"${n}","Liberation Serif",Georgia,serif`;           // butun dastur uchun
  const bv = (n) => `"BV ${n}","${n}","BV Serif","Liberation Serif",serif`;   // bo'sh varaq: PDF bilan aynan bir xil fayl
  const byName = (n) => L.find((x) => x[1] === n);
  // CSS shrift nomi → PDF kalit boshi ("lb", "tn", …) yoki null
  const pdfKey = (fam) => { const f = String(fam || "").split(",")[0].replace(/["']/g, "").replace(/^\s*BV\s+/i, "").trim().toLowerCase(); const r = L.find((x) => x[1].toLowerCase() === f); return r ? r[0] : null; };
  return {L, css, bv, byName, pdfKey};
})();
