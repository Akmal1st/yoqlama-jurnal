/* Ilk ochilish: «Sinflaringizni qanday qo'shamiz?» — tasdiqlangan maket (Akmal, 2026-11-06, /mnt/project-files/emaktab-import/boshlash-maket.html).
   5 ta tanlov o'rniga: 1) «eMaktab'dan olish» (tavsiya; server bo'lsa login/parol — EMKS, bo'lmasa xatcho'p yo'riqnomasi);
   2) «Fayldan» — journal.json, zaxira yoki eMaktab Excel, turi o'zi aniqlanadi (importJson(true)); pastda «Qo'lda qo'shish» va «Namuna» havolalari.
   Asosiy skriptdan oldin ulanadi; ichidagi nomlar faqat chaqirilganda ishlatiladi. */
const BSH = (() => {
  function html(sub) {
    return `<div class="bs"><span class="muted">${sub}</span><span class="tag">XUSH KELIBSIZ</span>
      <h1>Sinflaringizni qanday qo'shamiz?</h1>
      <div class="bs-main"><div class="bs-mh"><span class="bs-ic e" aria-hidden="true">e</span><span><b>eMaktab'dan olish<span class="bs-rt">Tavsiya</span></b><small>Barcha sinflar, o'quvchilar, baholar va yo'qlama bir yo'la keladi.</small></span></div>
        <button class="btn btn-primary" data-w="emk">eMaktab'ga kirish</button>
        <span class="bs-hint">${typeof EMKS !== "undefined" && EMKS.on() ? "Login va parol yoki xatcho'p orqali. Parol saqlanmaydi." : "eMaktab sahifasidagi xatcho'p orqali."}</span></div>
      <button class="bs-card" data-w="import"><span class="bs-ic f" aria-hidden="true">📂</span><span><b>Fayldan</b><small>Zaxira fayli (<code>journal.json</code>, eski kompyuter dasturiniki ham) yoki eMaktab Excel fayli. Turi o'zi aniqlanadi.</small></span><span class="bs-ar" aria-hidden="true">›</span></button>
      <div class="bs-links"><button class="bs-lnk" data-w="hand">Qo'lda qo'shish</button><span aria-hidden="true">·</span><button class="bs-lnk" data-w="demo">Namuna bilan sinab ko'rish</button></div>
      <p class="bs-hint bs-c">Ma'lumotlar shu qurilmada saqlanadi. Zaxira: «Sozlamalar → Ma'lumotlar».</p></div>`;
  }
  function bind(m) {
    m.querySelectorAll("[data-w]").forEach((b) => b.onclick = () => {
      const w = b.dataset.w;
      if (w === "import") importJson(true);
      else if (w === "emk") emkDialog();
      else if (w === "hand") addClassDialog(); else makeDemo();
    });
  }
  return {html, bind};
})();
