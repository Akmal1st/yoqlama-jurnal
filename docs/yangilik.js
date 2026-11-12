/* «Yangilik» belgisi (Akmal tasdiqlagan maket, A · Banner, 2026-11-08).
   1) Dastur ochiq turganda yangi versiya o'rnatilsa (sw.js almashsa) — pastda «Yangi versiya tayyor · Yangilash» xabari.
      «Keyinroq» — keyingi ochilishda o'zi yangilanadi. Yangi versiya har 30 daqiqada va ilovaga qaytilganda tekshiriladi.
   2) Yangi versiyada birinchi ochilganda — sahifa tepasida «Dastur yangilandi» banneri (darsda chiqmaydi),
      «Ko'rish» — «Nimalar yangi» ro'yxati (telefonda pastdan, kompyuterda o'rtada), har yangilik yonida «Ochish».
   3) Ro'yxat ko'rilmaguncha «Yordam» yonida nuqta turadi; keyin ham Yordam oynasidagi «Nimalar yangi» tugmasidan ochiladi.
   Ko'rilgan versiya — localStorage "yoqlama_yangilik" (har qurilma o'zi eslaydi). Yangi versiya chiqarganda: VER ni oshiring
   va NEWS boshiga yozuv qo'shing.
   Bu fayl asosiy skriptdan OLDIN ulanadi; S, go, render, renderNav, esc, $ … faqat chaqirilganda ishlatiladi. */
const YNG = (() => {
  const VER = 228, KEY = "yoqlama_yangilik";
  const P = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const IC = {
    spark: P('<path d="M12 3l1.8 4.9L19 9.7l-5.2 1.8L12 16.5l-1.8-5L5 9.7l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>'),
    refresh: P('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>'),
    x: P('<path d="M6 6l12 12M18 6L6 18"/>'),
    bell: P('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>'),
    star: P('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>'),
    print: P('<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>'),
    timer: P('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>'),
    btn: P('<rect x="3" y="7" width="18" height="10" rx="5"/><circle cx="16" cy="12" r="2.5"/>'),
    bug: P('<rect x="7" y="7" width="10" height="13" rx="5"/><path d="M12 7v13M4 12h3M17 12h3"/>')};
  // go: [sahifa, Sozlamalar bo'limi] — «Ochish» shu joyga olib boradi
  const NEWS = [
    {v: 228, d: "12-noyabr", items: [
      {ic: "star", t: "Kriterial (+/−): chorak tahlili", s: "Kun sahifasi → «Kriterial (+/−)» → «Chorak tahlili»: chorakdagi darslar bo'yicha sinf o'rtachasi, qaysi deskriptor eng ko'p «−» olgani (o'sdimi, pasaydimi), e'tibor kerak bo'lgan o'quvchilar va o'quvchi × deskriptor jadvali. O'quvchini bossangiz — uning chorakdagi profili.", go: ["journal"], gl: "Jurnal"},
      {ic: "star", t: "Kriterial (+/−): telefonda «Ro'yxat» va chala baho", s: "Telefonda har o'quvchi alohida kartochkada, 9 ta katak bir qatorda — jadvalni yon tomonga surish shart emas. Bahosi chala qolganlar haqida ogohlantirish chiqadi: «Ko'rsatish» yoki «Chalalarning bo'shiga −».", go: ["journal"], gl: "Jurnal"},
      {ic: "star", t: "Ota-onaga xabar va fan shablonlari", s: "O'quvchi menyusidan (⋯) «Ota-onaga xabar»: bugungi baho va nimaga e'tibor berish kerakligi matn bo'lib tayyorlanadi; chorak tahlilida — chorak xabari. Nusxalaysiz yoki Telegram botingizga yuborasiz. «✎ Deskriptorlar»da 7 ta fan uchun tayyor shablon bor.", go: ["journal"], gl: "Jurnal"},
      {ic: "print", t: "Kriterial varaq: yangi chop etish va Telegram", s: "Formativ baholash varag'i qayta ishlandi: deskriptorlar ramkada, D0 va yig'indi ustunlar (D, U), sinf xulosasi, imzo joyi. «Chop etish / Telegram» tugmasi varaqni oldindan ko'rsatadi va haqiqiy PDF qilib Telegram botingizga yuboradi.", go: ["journal"], gl: "Jurnal"}]},
    {v: 227, d: "11-noyabr", items: [
      {ic: "print", t: "Bo'sh varaq: dizaynga mos shriftlar", s: "Har jadval dizayni o'z shrift to'plami bilan keladi: masalan «Daftar» va «Iliq» — Times uslubida, «Oq-qora» va «Ko'k» — Times sarlavha va Arial jadval, «Minimal» va «Katak» — Arial. Sozlamalar → «Shrift to'plami»dan qo'lda ham tanlash mumkin. Shriftlar dastur ichida: ekranda, chop etishda va PDF'da bir xil.", go: ["reports"], gl: "Hisobotlar"}]},
    {v: 226, d: "11-noyabr", items: [
      {ic: "print", t: "PDF va Telegram: jadval chiziqlari to'g'ri", s: "Bo'sh varaq va boshqa hisobotlar PDF'ida jadval chiziqlari endi ikki qavat bo'lib, oq tirqish bilan chiqmaydi; «Katak» dizaynidagi tik nuqtali chiziqlar va «Qalin» dizaynining tashqi ramkasi joyida. PDF ekrandagi va chop etilgan varaq bilan bir xil.", go: ["reports"], gl: "Hisobotlar"},
      {ic: "print", t: "Bo'sh varaq: tartibli shriftlar", s: "Varaqdagi hamma yozuv bitta shriftda (ekranda, chop etishda va PDF'da bir xil). Sarlavha va pastki yozuvlar «Shrift» sozlamasiga, jadval yozuvi qator balandligiga qarab bir tekis kattalashadi; eng mayda yozuv ham 6,5 pt dan kichik bo'lmaydi.", go: ["reports"], gl: "Hisobotlar"}]},
    {v: 224, d: "11-noyabr", items: [
      {ic: "star", t: "Ota-onalar eMaktab'i — «Kelajak soati» sinflarida", s: "«eMaktab'ga kirish» endi faqat «Kelajak soati» (ruscha «Час будущего») fani bor sinflar menyusida (⋯) chiqadi, shu sinfning boshqa fanlari jurnalida ham. Funksiyani yoqish joyi o'zgarmadi: Sozlamalar → Qo'shimcha funksiyalar → «eMaktab» guruhi."}]},
    {v: 223, d: "11-noyabr", items: [
      {ic: "star", t: "Ota-onalar eMaktab'i — o'zingiz yoqasiz", s: "Bu funksiya endi sukut bo'yicha o'chiq. Kerak bo'lsa: Sozlamalar → Qo'shimcha funksiyalar → «eMaktab» guruhi → «Ota-onalar eMaktab'i». Yoqilgach, sinf menyusida (⋯) «Ota-onalar» → «eMaktab'ga kirish» chiqadi.", go: ["settings", 6], gl: "Funksiyalar"}]},
    {v: 222, d: "11-noyabr", items: [
      {ic: "star", t: "Ota-onalar eMaktab'i", s: "Sinf menyusi (⋯) → «Ota-onalar» → «eMaktab'ga kirish»: ota-onaning eMaktab login va parolini jadvalga yozasiz, ilova uning nomidan kirib, sahifalarni ochib chiqadi. «Aylanib chiqish» hammasiga navbat bilan kiradi. Baho va boshqa ma'lumot olinmaydi; parol saqlanmaydi yoki PIN bilan shifrlanadi."}]},
    {v: 221, d: "11-noyabr", items: [
      {ic: "star", t: "Yo'qlamada «CH» — chet elda", s: "Kun sahifasida va «Darsni boshlash»da yangi «CH» (chet elda) tugmasi bor (klaviaturada C). Chet eldagi o'quvchi «kelmadi» deb sanalmaydi va davomat foizini tushirmaydi: o'sha kunlar uning hisobidan chiqariladi. Kunlik hisobot rasmida «Chet elda» deb ko'rinadi.", go: ["journal"], gl: "Jurnal"}]},
    {v: 220, d: "9-noyabr", items: [
      {ic: "star", t: "Kriterial (+/−) formativ baho", s: "Jurnal → Kun sahifasida yangi «Kriterial (+/−)» usuli: darsdagi ishning 5 ta va uy vazifasining 4 ta deskriptoriga «+» yoki «−» qo'yasiz. Baho = 1 + «+» lar soni (1–10) va jurnalga o'zi tushadi. Deskriptorlarni o'zgartirish va A4 varaq chop etish ham bor.", go: ["journal"], gl: "Jurnal"}]},
    {v: 219, d: "9-noyabr", items: [
      {ic: "star", t: "O'quvchi kartochkasida chorak tanlovi", s: "O'quvchi ismini bossangiz, «Umumiy» va «Ota-onaga xabar»da 1–4-chorak tugmalari chiqadi: o'rtacha baho, davomat, belgilar, summativ ballar va xabar tanlangan chorak bo'yicha.", go: ["journal"], gl: "Jurnal"}]},
    {v: 218, d: "8-noyabr", items: [
      {ic: "star", t: "Har chorak — alohida", s: "Summativ tahlilida chorak tanlanadi va faqat shu chorak ishlari ko'rinadi: yangi chorakda ish bo'lmasa, o'tgan chorak ishi ochilib qolmaydi. «Mavzu yozilmagan» eslatmasi va jurnaldagi «Bugungi dars» kartasi ham boshqa chorakka qaramaydi.", go: ["journal"], gl: "Jurnal"}]},
    {v: 217, d: "8-noyabr", items: [
      {ic: "print", t: "Hisobotlar: yangi chop etish varag'i", s: "Sinf hisoboti, Chorakka tayyorlik va Sinflarni solishtirish endi bitta A4 varaqda: taqsimot, davomat polosasi, imzo joylari va oq-qora printer rejimi bor.", go: ["reports"], gl: "Hisobotlar"},
      {ic: "bell", t: "Hisobotlarda belgilar tartibga keltirildi", s: "Ro'yxatdagi chalg'ituvchi raqamlar olib tashlandi, sinf tanlashda har sinf yonida xavf ostidagilar soni ko'rinadi. «Chorakka tayyorlik»da ish kiritilmagan sinf endi «tayyor» deb ko'rsatilmaydi, ismdoshlar alohida sanaladi.", go: ["reports"], gl: "Hisobotlar"}]},
    {v: 216, d: "8-noyabr", items: [
      {ic: "refresh", t: "Ikki oynada ishlash", s: "Jurnal ikki oynada ochiq bo'lsa, eskirgan oynadagi o'zgarish endi yo'qolmaydi — ikkala oynadagi baholar birlashtiriladi."},
      {ic: "star", t: "Zaxira paroli saqlanmaydi", s: "Telegram zaxirasini shifrlash paroli endi qurilmada ochiq holda turmaydi: undan yasalgan, o'qib bo'lmaydigan kalit saqlanadi.", go: ["settings", 5], gl: "Ma'lumotlar"}]},
    {v: 215, d: "8-noyabr", items: [
      {ic: "refresh", t: "Telefon va kompyuter birlashtiriladi", s: "Telegram zaxirasi orqali almashganda ikkala qurilmadagi baholar saqlanadi; bir katakka turli baho qo'yilgan bo'lsa, qaysi birini olishni o'zingiz tanlaysiz.", go: ["settings", 5], gl: "Ma'lumotlar"},
      {ic: "star", t: "Ilovani o'rnatish taklifi", s: "Brauzer ruxsat bersa, «Bugun» sahifasida jurnalni ilova sifatida o'rnatish taklif qilinadi — internetsiz ham ochiladi.", go: ["today"], gl: "Bugun"},
      {ic: "bug", t: "Ishonchliroq saqlash", s: "Ikki oynada ochilgan jurnal bir-birining ustidan yozmaydi, brauzer xotirasi to'lsa ham o'zgarish zaxira xotiraga darhol yoziladi, xatolar «Sozlamalar → Ma'lumotlar»da ko'rinadi.", go: ["settings", 5], gl: "Ma'lumotlar"}]},
    {v: 207, d: "8-noyabr", items: [
      {ic: "bug", t: "Chorak hisoboti belgisi", s: "Ta'tildagi «Yangi chorakka tayyorgarlik» ro'yxatida chorak hisoboti Telegram'ga yuborilgach ✓ qo'yiladi.", go: ["today"], gl: "Bugun"}]},
    {v: 206, d: "8-noyabr", items: [
      {ic: "bell", t: "Yangiliklar belgisi", s: "Dastur yangilanganda shu ro'yxat chiqadi, yangi versiya tayyor bo'lsa «Yangilash» taklif qilinadi."}]},
    {v: 205, d: "8-noyabr", items: [
      {ic: "star", t: "Loyiha ishi rasmiy mezonlar bilan", s: "Tayyor andozalar, 5 xil baholash usuli va taxminiy ball.", go: ["reports"], gl: "Hisobotlar"},
      {ic: "print", t: "Bo'sh varaq oynalari yopilib qolmaydi", s: "Hisobotlardagi oynalar endi o'z-o'zidan yopilmaydi.", go: ["reports"], gl: "Hisobotlar"}]},
    {v: 204, d: "8-noyabr", items: [
      {ic: "bug", t: "5 ta xato tuzatildi", s: "Kod tahlilida topilgan kamchiliklar tuzatildi."}]},
    {v: 203, d: "7-noyabr", items: [
      {ic: "timer", t: "Qo'shimcha funksiyalar", s: "Dars taymeri, navbatchi, BSB eslatmasi, kelmaganlarga xabar.", go: ["settings", 6], gl: "Sozlamalar → Funksiyalar"}]},
    {v: 202, d: "7-noyabr", items: [
      {ic: "btn", t: "Dizayn → Tugmalar", s: "Tugmalarni bitta kalit bilan yoqish va o'chirish.", go: ["settings", 3], gl: "Sozlamalar → Dizayn"}]},
    {v: 200, d: "6-noyabr", items: [
      {ic: "print", t: "Bo'sh varaq: aniq chop etish", s: "9 xil jadval, PDF va rangli Excel.", go: ["reports"], gl: "Hisobotlar"}]}];
  const e = (s) => String(s).replace(/[&<>"]/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"})[c]);
  let hidBan = false, upd = null;

  function seen() {
    let v = null;
    try { v = localStorage.getItem(KEY); } catch (er) { return VER; }
    if (v === null) {
      // birinchi marta: yangi foydalanuvchiga ko'rsatilmaydi, eski foydalanuvchi oxirgi ikki versiyani ko'radi
      let old = false; try { old = !!localStorage.getItem("yoqlama_jurnal"); } catch (er) { /* */ }
      v = old ? VER - 2 : VER; try { localStorage.setItem(KEY, String(v)); } catch (er) { /* */ }
    }
    return +v || 0;
  }
  const unseen = () => seen() < VER;
  const fresh = () => NEWS.filter((g) => g.v > seen());
  function markSeen() { try { localStorage.setItem(KEY, String(VER)); } catch (er) { /* */ } }

  // 2) sahifa tepasidagi banner — render() / softRender() dan keyin
  function mount(m) {
    m.querySelector(".yng-ban")?.remove();
    if (hidBan || !unseen() || typeof S === "undefined" || S.page === "lesson") return;
    const f = fresh(), n = f.reduce((a, g) => a + g.items.length, 0);
    const b = document.createElement("div");
    b.className = "yng-ban"; b.setAttribute("role", "status");
    b.innerHTML = `<span class="yng-bi">${IC.spark}</span><div class="yng-tx"><b>Dastur yangilandi</b><small>${n} ta yangilik: ${e(f.flatMap((g) => g.items.map((x) => x.t)).slice(0, 2).join(", "))}${n > 2 ? " va boshqalar" : ""}</small></div>
      <button class="yng-b yng-pri" data-yng-open>Ko'rish</button><button class="yng-x" data-yng-hide aria-label="Yopish">${IC.x}</button>`;
    b.querySelector("[data-yng-open]").onclick = open;
    b.querySelector("[data-yng-hide]").onclick = () => { hidBan = true; b.remove(); };
    m.prepend(b);
  }

  // «Nimalar yangi» ro'yxati
  function group(g, old) {
    return `<div class="yng-vg${old ? " old" : ""}"><h5><span class="yng-ver">v${g.v}</span>${g.d}${!old && g === NEWS[0] ? " · yangi" : ""}</h5><div class="yng-lst">${g.items.map((x, i) =>
      `<div class="yng-it"><span class="yng-ic">${IC[x.ic] || IC.star}</span><div class="yng-tx"><b>${e(x.t)}</b><small>${e(x.s)}</small>${x.go && !old ? `<button class="yng-go" data-yng-go="${g.v}|${i}">Ochish: ${e(x.gl)} →</button>` : ""}</div></div>`).join("")}</div></div>`;
  }
  function open() {
    const from = seen(), nw = NEWS.filter((g) => g.v > from), list = nw.length ? nw : NEWS.slice(0, 1), rest = NEWS.filter((g) => !list.includes(g));
    markSeen(); hidBan = true;
    document.querySelector("#main .yng-ban")?.remove();
    if (typeof renderNav === "function") renderNav();
    document.querySelector(".yng-scrim")?.remove();
    const m = document.createElement("div");
    m.className = "yng-scrim";
    m.innerHTML = `<div class="yng-sheet" role="dialog" aria-modal="true" aria-label="Nimalar yangi"><div class="yng-grab"></div>
      <div class="yng-sh-h"><div class="yng-tx"><h4>Nimalar yangi</h4><small>${nw.length && from ? `v${from} dan keyin qo'shilganlar` : `Dastur versiyasi: v${VER}`}</small></div><button class="yng-x" data-yng-x aria-label="Yopish">${IC.x}</button></div>
      <div class="yng-sh-b">${list.map((g) => group(g)).join("")}${rest.length ? `<button class="yng-more" data-yng-more>Avvalgi yangiliklar</button>` : ""}</div>
      <div class="yng-sh-f"><button class="yng-b yng-pri" data-yng-x>Tushunarli</button></div></div>`;
    const close = () => { m.remove(); document.removeEventListener("keydown", esc, true); };
    const esc = (ev) => { if (ev.key === "Escape") { ev.stopPropagation(); close(); } };
    document.addEventListener("keydown", esc, true);
    m.addEventListener("click", (ev) => {
      if (ev.target === m || ev.target.closest("[data-yng-x]")) return close();
      const mo = ev.target.closest("[data-yng-more]");
      if (mo) { mo.outerHTML = rest.map((g) => group(g, true)).join(""); return; }
      const gb = ev.target.closest("[data-yng-go]");
      if (gb) {
        const [v, i] = gb.dataset.yngGo.split("|").map(Number), it = NEWS.find((g) => g.v === v).items[i];
        close();
        if (it.go[0] === "settings") S.sec = it.go[1];
        go(it.go[0]);
      }
    });
    document.body.append(m);
    m.querySelector(".yng-pri")?.focus({preventScroll: true});
  }

  // 1) yangi versiya tayyor
  function showUpdate() {
    if (document.querySelector(".yng-upd")) return;
    const b = document.createElement("div");
    b.className = "yng-upd"; b.setAttribute("role", "alert");
    b.innerHTML = `<span class="yng-spin">${IC.refresh}</span><div class="yng-tx"><b>Yangi versiya tayyor</b><small>Baholar va yo'qlama saqlanib qoladi</small></div>
      <button class="yng-b yng-gh" data-later>Keyinroq</button><button class="yng-b yng-pri" data-upd>Yangilash</button>`;
    b.querySelector("[data-later]").onclick = () => { b.remove(); upd = "later"; if (typeof toast === "function") toast("Keyingi ochilishda yangilanadi"); };
    b.querySelector("[data-upd]").onclick = () => location.reload();
    document.body.append(b);
  }
  function watch() {
    const sw = navigator.serviceWorker;
    if (!sw || !/^https?:$/.test(location.protocol)) return;
    // birinchi o'rnatishda (oldin boshqaruvchi yo'q) xabar chiqmaydi
    let had = !!sw.controller;
    sw.addEventListener("controllerchange", () => { if (had && upd !== "later") showUpdate(); had = true; });
    const check = () => sw.getRegistration().then((r) => r && r.update()).catch(() => {});
    setInterval(check, 30 * 60 * 1000);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
  }
  watch();

  const dot = () => unseen() ? `<i class="yng-dot" title="Yangilik bor"></i>` : "";
  // Yordam: ko'rilmagan yangilik bo'lsa — avval «Nimalar yangi»
  const help = (fallback) => unseen() ? open() : fallback();
  const helpBtn = () => `<button class="btn btn-outline-secondary btn-sm" data-yng-help>✨ Nimalar yangi</button>`;
  return {VER, NEWS, mount, open, dot, help, helpBtn, unseen, showUpdate};
})();
