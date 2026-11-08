/* «Summativ tahlili → Loyiha ishi»: rasmiy mezonlar bo'yicha baholash (tasdiqlangan maket v9, 2026-11-08).
   Umumiy qoida: loyiha ishi = maksimal ball (50 yoki 30) = mezonlar ro'yxati; har mezon 5 usuldan biri bilan baholanadi:
   Ha/Yo'q (to'liq ball yoki 0), Darajalar (tayyor ballar), Oraliq (oraliq → aniq ball), Bandlar (kichik bandlar yig'indisi),
   Xato soni (xatolar → ball). Fanga faqat shablon bog'liq (nomlar, ballar, usul); integratsiyalashgan loyihada (Tarbiya +
   Davlat va huquq) har fanga alohida ball. Har o'quvchi alohida baholanadi.
   Ma'lumot BSB tahlili bilan bir xil joyda: c.analyses[] (a.w — ish id si), a.q/a.max/a.names/a.rows[ism].pts — «Umumiy»ga
   yoziladigan fanning mezon ballari (hisobot va eksport shundan foydalanadi). Qo'shimcha: a.ly — shablon nusxasi
   {tpl, title, src, max, subj: [{n, crit}], out}; a.rows[ism]: x — har fan bo'yicha xom qiymatlar (Bandlar — massiv,
   Xato soni — {e, v}), es — taxminiy kataklar, em — eMaktabdagi jami (birinchi ball qo'yilgunga qadar «Umumiy»da turgani),
   tm — jamoa, nt — izoh. Sahifa softRender bilan yangilanadi (faqat o'zgargan qismlar), oynalar — o'z qatlamida. */
const LYH = (() => {
  const USUL = {hy: "Ha/Yo'q", dr: "Darajalar", or: "Oraliq", bn: "Bandlar", xt: "Xato soni", sn: "Ball"};
  const USUL_D = {hy: "to'liq ball yoki 0", dr: "tayyor darajalardan biri", or: "avval oraliq, keyin aniq ball", bn: "kichik bandlar yig'indisi", xt: "xatolar soni → ball", sn: "0 dan maksimalgacha"};
  const L = (arr) => arr.map(([v, d]) => ({v, d})), R = (arr) => arr.map(([lo, hi, d]) => ({lo, hi, d})), B = (arr) => arr.map(([n, m]) => ({n, m}));

  /* ── rasmiy fayllardan shablonlar ── */
  const TPL = [
    {id: "inf11", fan: "Informatika", sinf: "11", title: "Informatika · 11-sinf · videoklip", src: "11-sinf 1-BSB, 1-chorak", max: 50, subj: [{n: "Informatika", crit: [
      {n: "Mavzuni videoklipda to'liq ochib berish", m: 10, k: "hy"},
      {n: "Subtitr, animatsiya va effektlar", m: 10, k: "hy"},
      {n: "Ovozli ma'lumot qo'shish", m: 10, k: "hy"},
      {n: "Ovoz tezligi va balandligini sozlash", m: 10, k: "hy"},
      {n: "Reverberatsiya effekti", m: 10, k: "hy"}]}]},
    {id: "geo8", fan: "Geografiya", sinf: "8", title: "Geografiya · 8-sinf · sanoat tarmoqlari", src: "8-sinf III chorak BSB", max: 50, subj: [{n: "Geografiya", crit: [
      {n: "Maqsad va reja", m: 8, k: "dr", lv: L([[8, "Guruh bilan kelishilgan aniq maqsad, reja mantiqiy va bosqichma-bosqich"], [6, "Maqsad to'g'ri, reja bor, ayrim bosqichlar yetarli ochilmagan"], [4, "Maqsad mavjud, reja umumiy"], [2, "Maqsad noaniq, reja juda qisqa"], [1, "Faqat mavzu ko'rsatilgan"]])},
      {n: "Vazifalarni taqsimlash", m: 8, k: "dr", lv: L([[8, "Vazifalar aniq taqsimlangan, har kimning hissasi ko'rsatilgan"], [6, "Taqsimlangan, ayrim rollar noaniq"], [4, "Vazifalar qisman taqsimlangan"], [2, "Rasmiy, amalda ko'rinmaydi"], [1, "Guruh bor, taqsimot yo'q"]])},
      {n: "Izlanish va ma'lumot to'plash", m: 10, k: "dr", lv: L([[10, "Tarmoq, korxonalar, hududlar va omillar to'liq tahlil qilingan, rasm bilan"], [8, "Tarmoq tanlangan, tadqiqot chuqur emas, ayrim savollarga javob"], [6, "Korxonalar va hudud bor, omillar tahlil qilinmagan"], [4, "Korxonalar o'rganilgan, hudud tahlil qilinmagan"], [2, "Tarmoq tanlangan, korxonalar o'rganilmagan"], [0, "Izlanish yo'q"]])},
      {n: "Yechim va tavsiyalar", m: 8, k: "dr", lv: L([[8, "Joylashtirish omillari aniq va darajalari belgilangan"], [6, "Omillar berilgan, darajasi yo'q"], [4, "Korxonalar o'rganilgan, omillar berilmagan"], [2, "Umumiy fikrlar"], [0, "Yechim va taklif yo'q"]])},
      {n: "Mustaqil fikr va xulosa", m: 8, k: "dr", lv: L([[8, "Asoslangan xulosa va tavsiyalar"], [6, "Xulosa bor, lekin umumiy"], [4, "Xulosa qisqa, yetarli yoritilmagan"], [2, "Xulosa mavzuga mos emas"], [0, "Xulosa qilinmagan"]])},
      {n: "Taqdimot", m: 8, k: "dr", lv: L([[8, "Tizimli, jadval/diagramma, hamma faol"], [6, "Tizimli, hamma ishtirok etmagan"], [4, "Yetarli, faqat 1 o'quvchi ishlagan"], [2, "Juda qisqa"], [0, "Taqdim qilinmagan"]])}]}]},
    {id: "bio8", fan: "Biologiya", sinf: "8", title: "Biologiya · 8-sinf · mahsulot yorlig'i", src: "8-sinf BSB-5", max: 30, subj: [{n: "Biologiya", crit: [
      {n: "Maqsad va reja", m: 5, k: "dr", lv: L([[5, "Aniq, to'liq, biologik mazmunli reja"], [4, "Reja bor, ayrim bosqichlar yetarli emas"], [3, "Maqsad bor, reja umumiy"], [2, "Maqsad noaniq, reja qisqa"], [1, "Faqat mavzu"], [0, "Maqsad va reja yo'q"]])},
      {n: "Vazifalarni taqsimlash", m: 5, k: "dr", lv: L([[5, "Aniq taqsimlangan, hissa ko'rsatilgan"], [4, "Ayrim rollar noaniq"], [3, "Qisman taqsimlangan"], [2, "Rasmiy, amalda yo'q"], [1, "Taqsimot yo'q"], [0, "Guruh ishi tashkil qilinmagan"]])},
      {n: "Izlanish va ma'lumot", m: 6, k: "dr", lv: L([[6, "Yorliq to'liq tahlil qilingan"], [5, "To'g'ri tahlil, ayrim jihatlar yo'q"], [4, "Asosiy ma'lumotlar bor"], [3, "Asosiy jihatlar, sababsiz"], [2, "Ayrim ko'rsatkichlar noto'g'ri"], [1, "Juda kam ma'lumot"], [0, "Izlanish yo'q"]])},
      {n: "Foydali/zararli tahlil", m: 6, k: "dr", lv: L([[6, "Ilmiy asoslangan tahlil"], [5, "To'g'ri, chuqur emas"], [4, "Sanab o'tilgan"], [3, "Umumiy fikrlar"], [2, "Sabab–oqibat yo'q"], [1, "Yuzaki"], [0, "Tahlil yo'q"]])},
      {n: "Xulosa va qaror", m: 4, k: "dr", lv: L([[4, "Kelishilgan, asoslangan xulosa"], [3, "Xulosa umumiy"], [2, "Qisqa, yetarli emas"], [1, "Mavzuga mos emas"], [0, "Xulosa yo'q"]])},
      {n: "Taqdimot", m: 4, k: "dr", lv: L([[4, "Tizimli, hamma faol"], [3, "Hamma ishtirok etmagan"], [2, "Juda qisqa"], [0, "Taqdim qilinmagan"]])}]}]},
    {id: "tab6", fan: "Tabiiy fan", sinf: "6", title: "Tabiiy fan · 6-sinf · kimyoviy reaksiyalar", src: "6-sinf 5-BSB", max: 30, subj: [{n: "Tabiiy fan", crit: [
      {n: "Muammo va maqsad", m: 5, k: "bn", b: B([["Muammoni to'g'ri aniqlaydi", 2], ["Maqsadni aniq ifodalaydi", 1.5], ["Kutilayotgan natijani yozadi", 1.5]])},
      {n: "Nazariy asos", m: 4, k: "bn", b: B([["Jarayonlarni hayotiy misol bilan tushuntiradi", 2], ["Reagent va mahsulotni to'g'ri tushuntiradi", 2]])},
      {n: "Tajriba dizayni", m: 5, k: "bn", b: B([["Jihoz va moddalarni to'g'ri tanlaydi", 2], ["Bosqichlarni ketma-ket yozadi", 1], ["Xavfsizlik choralarini ko'rsatadi", 2]])},
      {n: "Amaliy ijro", m: 6, k: "bn", b: B([["Tajribani bajaradi", 1], ["O'zgarishlarni amalda ko'rsatadi", 1.5], ["O'zgarishlarni aniqlaydi", 2], ["Natijalarni taqqoslaydi", 1.5]])},
      {n: "Tahlil va xulosa", m: 5, k: "bn", b: B([["Ilmiy asoslangan xulosa", 1.5], ["Hayotdagi ahamiyatini tushuntiradi", 1.5], ["Xulosalar mantiqiy bog'langan", 2]])},
      {n: "Taqdimot", m: 5, k: "bn", b: B([["Natijani matn/rasm/jadvalda beradi", 2], ["Estetik va izchil", 1], ["Savollarga to'g'ri javob", 2]])}]}]},
    {id: "adb56", fan: "Adabiyot", sinf: "5–6", title: "Adabiyot · 5–6-sinf · maktub yozish", src: "5-, 6-sinf 3-BSB", max: 50, subj: [{n: "Adabiyot", crit: [
      {n: "Imlo xatolari", m: 10, k: "xt", xt: [[0, 0, 10, 10], [1, 1, 9, 10], [2, 2, 7, 8], [3, 4, 4, 6], [5, 7, 1, 3], [8, 99, 0, 0]]},
      {n: "Tinish belgilari", m: 5, k: "xt", xt: [[0, 1, 5, 5], [2, 2, 4, 4], [3, 4, 2, 3], [5, 7, 1, 1], [8, 99, 0, 0]]},
      {n: "Husnixat", m: 5, k: "or", lv: R([[4, 5, "Aniq, ravon, husnixat qoidalariga rioya"], [3, 3, "Biroz noaniq, harflar qiyshaygan"], [1, 2, "Noaniq, o'qish qiyin, harflar bo'yalgan"]])},
      {n: "Fikrni ifodalash", m: 30, k: "or", lv: R([[25, 30, "Ketma-ket, isbotli, tahrirlangan, mustaqil"], [18, 24, "Izchillik biroz buzilgan, fikrlar asoslangan"], [10, 17, "Izchillik buzilgan, ayrim fikrlar asossiz"], [5, 9, "Tavsiyalardan yetarli foydalanmagan, tugallanmagan"], [1, 4, "Asossiz, tahrirlanmagan, yakunlanmagan"]])}]}]},
    {id: "adb79", fan: "Adabiyot", sinf: "7–9", title: "Adabiyot · 7–9-sinf · audiomatn", src: "7-, 8-, 9-sinf 3-BSB", max: 50, note: "Oraliq chegaralari 9-sinf faylidan; 7-sinfda biroz farq qiladi (21–24 / 15–20 / 6–14).", subj: [{n: "Adabiyot", crit: [
      {n: "Mavzu va maqsad uyg'unligi", m: 24, k: "or", lv: R([[20, 24, "Noodatiy yondashuv, maqsadga mos taqdim, xulosa va keyingi qadamlar"], [12, 19, "Juz'iy kamchiliklar, maqsaddan biroz og'ish"], [1, 11, "Ketma-ketlik yo'q, maqsad yoritilmagan"]])},
      {n: "Muammo va yechim", m: 16, k: "or", lv: R([[13, 16, "To'g'ri, samarali, keng qamrovli yechim"], [7, 12, "Yechim bor, bosqichlarda kamchilik"], [1, 6, "Yechim samarasiz, muammo bilan bog'liq emas"]])},
      {n: "Jamoa bo'lib ishlash", m: 10, k: "or", lv: R([[8, 10, "Bir-birini to'ldiradi, navbat bilan, qo'llab-quvvatlaydi"], [5, 7, "Bir maqsad yo'lida, ayrim sustkashlik"], [1, 4, "Tarqoqlik, yuzaki yondashuv"]])}]}]},
    {id: "tar10", fan: "Tarbiya", sinf: "9–10", title: "Tarbiya + Davlat va huquq · 10-sinf", src: "10-sinf BSB-1 (integratsiya)", max: 50, subj: [
      {n: "Tarbiya", crit: [
        {n: "Muammoni aniqlash", m: 10, k: "bn", b: B([["Muammoning ahamiyatini tushuntiradi", 2], ["Kimlarga ta'sir qilishini aniqlaydi", 2], ["Rolni mas'uliyat bilan bog'laydi", 2], ["Jamoadagi vazifasini belgilaydi", 2], ["Muddat va natijani belgilaydi", 2]])},
        {n: "Dalil va ma'lumot", m: 10, k: "bn", b: B([["Mazmunli tadqiqot savollari tuzadi", 2], ["Muomala madaniyatiga rioya qiladi", 2], ["Turli fikrlarni tinglaydi", 2], ["Yuklangan vazifani bajaradi", 2], ["Ma'lumotni jamoa bilan ulashadi", 2]])},
        {n: "Tarbiyaviy-ijtimoiy tahlil", m: 10, k: "bn", b: B([["Muhim ijtimoiy dalillarni ajratadi", 2], ["Oqibatlarni tushuntiradi", 2], ["Daxldorlik bilan bog'laydi", 2], ["Adolat nuqtayi nazaridan baholaydi", 2], ["Shaxsiy pozitsiya bildiradi", 2]])},
        {n: "Yechim va tashabbus", m: 10, k: "bn", b: B([["3 ta yechim ishlab chiqishda qatnashadi", 2], ["Jamoat manfaatini tushuntiradi", 2], ["Imkoniyat va resurslarni baholaydi", 2], ["Maqbul yechimni asoslaydi", 2], ["Harakat rejasida vazifasini belgilaydi", 2]])},
        {n: "Himoya va refleksiya", m: 10, k: "bn", b: B([["Bajargan ishini dalil bilan tushuntiradi", 2], ["O'z faoliyatini xolis baholaydi", 2], ["Fikrini madaniyatli bayon qiladi", 2], ["Mas'uliyatga misol keltiradi", 2], ["Kelajakdagi fuqarolik harakatini belgilaydi", 2]])}]},
      {n: "Davlat va huquq asoslari", crit: [
        {n: "Muammoni aniqlash", m: 10, k: "bn", b: B([["Huquqiy jihatini aniqlaydi", 2], ["Rolning vakolatini aniqlaydi", 2], ["Tegishli huquq bilan bog'laydi", 2], ["Burch/javobgarlik bilan bog'laydi", 2], ["Huquqiy tadqiqot savoli tuzadi", 2]])},
        {n: "Dalil va ma'lumot", m: 10, k: "bn", b: B([["Huquqiy ma'lumotlarni topadi", 2], ["2 ta ishonchli manba", 2], ["Manbalarni aniq qayd etadi", 2], ["So'rovda huquqiy masalani o'rganadi", 2], ["Shaxsiy ma'lumotlarni hisobga oladi", 2]])},
        {n: "Huquqiy tahlil", m: 10, k: "bn", b: B([["Huquqiy dalillarni ajratadi", 2], ["Dalilni huquq bilan bog'laydi", 2], ["Sabab/oqibatni tushuntiradi", 2], ["Manfaatlarni hisobga oladi", 2], ["Asosli xulosa chiqaradi", 2]])},
        {n: "Yechim va harakat", m: 10, k: "bn", b: B([["Qonuniyligini baholaydi", 2], ["Vakolat doirasini tekshiradi", 2], ["Boshqalar huquqiga zid emasligini asoslaydi", 2], ["Kim va qanday amalga oshirishini ko'rsatadi", 2], ["Maqbul yechimni asoslaydi", 2]])},
        {n: "Himoya va refleksiya", m: 10, k: "bn", b: B([["Ishining huquqiy mazmunini tushuntiradi", 2], ["Atamalardan to'g'ri foydalanadi", 2], ["2 ta huquqiy asos bilan himoya qiladi", 2], ["Savollarga huquqiy javob beradi", 2], ["Huquqiy cheklov ta'sirini tushuntiradi", 2]])}]}]},
    {id: "tar11", fan: "Tarbiya", sinf: "11", title: "Tarbiya + Davlat va huquq · 11-sinf", src: "11-sinf BSB-1 (integratsiya)", max: 50, subj: [
      {n: "Tarbiya", crit: [
        {n: "Muammo va reja", m: 10, k: "bn", b: B([["Haqiqiy muammoni aniqlashga hissa", 4], ["Ahamiyatini tushuntiradi", 3], ["Vazifa va rejada faol", 3]])},
        {n: "Ma'lumot va muloqot", m: 10, k: "bn", b: B([["Dalillarni mustaqil, o'z vaqtida to'playdi", 4], ["Odob va muloqot madaniyati", 3], ["Xolis qayd, manbalarni ko'rsatadi", 3]])},
        {n: "Tahlil va hamkorlik", m: 10, k: "bn", b: B([["Sabab-oqibatni dalil bilan tahlil", 4], ["Jamoa bilan hamkorlik", 3], ["Fuqarolik pozitsiyasini asoslaydi", 3]])},
        {n: "Yechim va mahsulot", m: 10, k: "bn", b: B([["Amaliy foydali taklif", 4], ["Tashabbus va kreativlik", 3], ["O'z vazifasini sifatli bajaradi", 3]])},
        {n: "Taqdimot va refleksiya", m: 10, k: "bn", b: B([["Hissasini ravon taqdim etadi", 4], ["Savollarga hurmat bilan javob", 3], ["O'z faoliyatini xolis baholaydi", 3]])}]},
      {n: "Davlat va huquq asoslari", crit: [
        {n: "Huquqiy muammo va reja", m: 10, k: "bn", b: B([["Huquqiy jihatini to'g'ri belgilaydi", 4], ["Huquq, burch, manfaatlarni aniqlaydi", 3], ["Huquqiy savolni aniq ifodalaydi", 3]])},
        {n: "Huquqiy manbalar", m: 10, k: "bn", b: B([["Normativ hujjatni ishonchli manbadan topadi", 4], ["Normani to'g'ri tushuntiradi", 4], ["Manbani aniq ko'rsatadi", 2]])},
        {n: "Huquqiy tahlil", m: 10, k: "bn", b: B([["Dalillarni normalar bilan taqqoslaydi", 4], ["Sabab va oqibatni asoslaydi", 3], ["Manbaga tayangan xulosa", 3]])},
        {n: "Qonuniy yechim", m: 10, k: "bn", b: B([["Qonunchilikka muvofiqligini asoslaydi", 4], ["Huquq va manfaatlarni hisobga oladi", 3], ["Amalga oshirish mexanizmi", 3]])},
        {n: "Taqdimot va xulosa", m: 10, k: "bn", b: B([["Huquqiy atamalardan to'g'ri foydalanadi", 3], ["Norma va dalil bilan himoya", 3], ["Huquqiy mantiq bilan javob", 2], ["Yakuniy xulosa aniq", 2]])}]}]}
  ];
  const TPLBY = Object.fromEntries(TPL.map((t) => [t.id, t]));

  /* ── hisob ── */
  const r2 = (v) => Math.round(v * 100) / 100;
  const nf = (v) => v == null ? "—" : gnum(r2(v));
  const stepOf = (m) => Number.isInteger(m) ? 1 : 0.5;
  const range = (a, b, st = 1) => { const o = []; for (let v = a; v <= b + 1e-9; v += st) o.push(r2(v)); return o; };
  const xtRange = (c, e) => c.xt.find((r) => e >= r[0] && e <= r[1]) || c.xt[c.xt.length - 1];
  function cval(c, x) {
    if (x == null) return null;
    if (c.k === "bn") return Array.isArray(x) && x.some((v) => v != null) ? r2(x.reduce((a, v) => a + (+v || 0), 0)) : null;
    if (c.k === "xt") return x && isNum(x.v) ? x.v : null;
    return isNum(x) ? x : null;
  }
  const cfull = (c, x) => x != null && (c.k === "bn" ? Array.isArray(x) && x.length === c.b.length && x.every((v) => v != null) : cval(c, x) != null);
  function stotal(crit, row) {
    let t = 0, any = false, full = true;
    crit.forEach((c, i) => { const v = cval(c, row[i]); if (v != null) { t += v; any = true; } if (!cfull(c, row[i])) full = false; });
    return {t: any ? r2(t) : null, full};
  }
  const bandSums = (c) => { let set = new Set([0]); for (const b of c.b) { const n = new Set(); for (const a of set) for (const v of range(0, b.m, stepOf(b.m))) n.add(Math.round((a + v) * 2) / 2); set = n; } return [...set].sort((a, b) => a - b); };
  function optsOf(c) {
    if (c.k === "hy") return [0, c.m];
    if (c.k === "dr") return c.lv.map((l) => l.v);
    if (c.k === "or") return [...new Set(c.lv.flatMap((l) => range(l.lo, l.hi)))].sort((a, b) => a - b);
    if (c.k === "bn") return bandSums(c);
    if (c.k === "xt") return [...new Set(c.xt.flatMap((r) => range(r[2], r[3])))].sort((a, b) => a - b);
    return range(0, c.m, stepOf(c.m));
  }
  // eng yaqin ruxsat etilgan qiymat (teng bo'lsa — pastrog'i)
  const nearest = (opts, v) => opts.reduce((a, o) => Math.abs(o - v) < Math.abs(a - v) || (Math.abs(o - v) === Math.abs(a - v) && o < a) ? o : a, opts[0]);
  function critHint(c) {
    if (c.k === "hy") return `${nf(c.m)} yoki 0`;
    if (c.k === "dr") return c.lv.map((l) => nf(l.v)).join(" / ");
    if (c.k === "or") return c.lv.map((l) => l.lo === l.hi ? l.lo : l.lo + "–" + l.hi).join(" / ");
    if (c.k === "bn") return `${c.b.length} band: ` + c.b.map((b) => nf(b.m)).join(" + ");
    if (c.k === "xt") return "xato soni → " + c.xt.filter((r) => r[1] < 99).map((r) => (r[0] === r[1] ? r[0] : r[0] + "–" + r[1]) + ": " + (r[2] === r[3] ? r[2] : r[2] + "–" + r[3])).join(", ");
    return `0 – ${nf(c.m)}`;
  }
  function descOf(c, x) {
    const v = cval(c, x); if (v == null) return "baholanmagan";
    if (c.k === "hy") return v === c.m ? "To'g'ri bajargan" : "Bajarmagan";
    if (c.k === "dr") { const l = c.lv.find((l) => l.v === v); return l ? l.d : ""; }
    if (c.k === "or") { const l = c.lv.find((l) => v >= l.lo && v <= l.hi); return l ? l.d : ""; }
    if (c.k === "bn") return c.b.map((b, i) => `${b.n}: ${nf(x[i])}/${nf(b.m)}`).join("\n");
    if (c.k === "xt") return x.e + " ta xato";
    return "";
  }

  /* ── Taxminiy ball: jami ball mezonlarga bo'linadi, har mezon faqat o'z usulidagi qiymatni oladi.
     Yig'indi aynan jamiga teng; imkonsiz bo'lsa — eng yaqini (teng bo'lsa pastrog'i). Dinamik dasturlash, 0,5 qadam. ── */
  function hrng(s) { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function dpPick(opts, tg, m, T, near) {
    const K = (v) => Math.round(v * 2); let dp = new Map([[0, {c: 0, p: null, v: null}]]);
    for (let i = 0; i < opts.length; i++) {
      const nd = new Map();
      for (const [k, st] of dp) for (const v of opts[i]) { const k2 = k + K(v), cc = st.c + ((v - tg[i]) / (m[i] || 1)) ** 2, o = nd.get(k2); if (!o || cc < o.c) nd.set(k2, {c: cc, p: st, v}); }
      dp = nd;
    }
    const T2 = K(T); let best = dp.has(T2) ? T2 : null;
    if (best == null) { if (!near) return null; let d = 1e9; for (const k of dp.keys()) { const dd = Math.abs(k - T2); if (dd < d || (dd === d && k < best)) { d = dd; best = k; } } }
    const vals = []; let st = dp.get(best); while (st && st.p) { vals.unshift(st.v); st = st.p; }
    return {vals, sum: best / 2};
  }
  function toStored(c, v, rr) {
    if (c.k === "bn") { const tg = c.b.map((b) => v * b.m / c.m + (rr() - 0.5) * b.m * 0.2); const r = dpPick(c.b.map((b) => range(0, b.m, stepOf(b.m))), tg, c.b.map((b) => b.m), v, false); return r ? r.vals : c.b.map(() => 0); }
    if (c.k === "xt") { const row = c.xt.find((r) => v >= r[2] && v <= r[3]) || c.xt[c.xt.length - 1]; return {e: row[0], v}; }
    return v;
  }
  // keep — saqlanadigan mezonlar (null bo'lsa: who === "bosh" da to'liq kataklar)
  function estimate(crit, row, T, mode, who, near, name, keep) {
    const rr = hrng(name + "|" + crit.length);
    const fixed = crit.map((c, i) => keep ? (keep.includes(i) ? cval(c, row[i]) : null) : who === "bosh" && cfull(c, row[i]) ? cval(c, row[i]) : null);
    const T0 = T - fixed.reduce((a, v) => a + (v || 0), 0), Mf = crit.reduce((a, c, i) => a + (fixed[i] == null ? c.m : 0), 0);
    const f = Mf ? Math.max(0, Math.min(1, T0 / Mf)) : 0;
    const tg = crit.map((c, i) => fixed[i] != null ? fixed[i] : c.m * Math.max(0, Math.min(1, f + (mode === "teng" ? 0 : (rr() - 0.5) * 0.35))));
    const r = dpPick(crit.map((c, i) => fixed[i] != null ? [fixed[i]] : optsOf(c)), tg, crit.map((c) => c.m), T, near);
    if (!r) return null;
    return {sum: r.sum, cells: crit.map((c, i) => fixed[i] != null ? null : toStored(c, r.vals[i], rr))};
  }

  /* ── ma'lumot: shablon nusxasi (a.ly) va qatorlar ── */
  const KINDS = Object.keys(USUL);
  const okNum = (v, lo = 0, hi = 1000) => typeof v === "number" && isFinite(v) && v >= lo && v <= hi;
  function okCrit(c) {
    if (!c || typeof c !== "object" || !KINDS.includes(c.k) || !okNum(c.m, 0.5) || typeof c.n !== "string") return false;
    if (c.k === "dr") return Array.isArray(c.lv) && c.lv.length > 0 && c.lv.every((l) => l && okNum(l.v));
    if (c.k === "or") return Array.isArray(c.lv) && c.lv.length > 0 && c.lv.every((l) => l && okNum(l.lo) && okNum(l.hi) && l.lo <= l.hi);
    if (c.k === "bn") return Array.isArray(c.b) && c.b.length > 0 && c.b.length <= 12 && c.b.every((b) => b && okNum(b.m, 0.5) && typeof b.n === "string");
    if (c.k === "xt") return Array.isArray(c.xt) && c.xt.length > 0 && c.xt.every((r) => Array.isArray(r) && r.length === 4 && r.every((v) => okNum(v, 0, 99)));
    return true;
  }
  const okLy = (L) => L && typeof L === "object" && Array.isArray(L.subj) && L.subj.length >= 1 && L.subj.length <= 2 &&
    L.subj.every((s) => s && Array.isArray(s.crit) && s.crit.length >= 1 && s.crit.length <= 30 && s.crit.every(okCrit));
  // a.ly yo'q (eski, shablonsiz loyiha ishi): mezon nomlari va maksimallari — erkin ball (0 dan maksimalgacha)
  function lyOf(c, a) {
    if (okLy(a.ly)) { const L = a.ly; if (!(L.out >= 0 && L.out < L.subj.length)) L.out = 0; return L; }
    const crit = (a.max || []).slice(0, a.q || (a.max || []).length).map((m, i) => ({n: String((a.names || [])[i] || `${i + 1}-mezon`), m: +m > 0 ? +m : 1, k: "sn"}));
    if (!crit.length) crit.push({n: "1-mezon", m: 5, k: "sn"});
    return {tpl: "", title: "Mezonlar (shablon tanlanmagan)", src: "", max: r2(crit.reduce((s, x) => s + x.m, 0)), subj: [{n: c.subject || "Loyiha ishi", crit}], out: 0, legacy: true};
  }
  const snap = (t) => ({tpl: t.id || "", title: t.title, src: t.src || "", note: t.note || "", max: t.max, subj: clone(t.subj), out: 0});
  // integratsiyalashgan shablonda «Umumiy»ga qaysi fan bali yoziladi: jurnal fani nomiga qarab
  function outFor(c, L) {
    if (L.subj.length < 2) return 0;
    const s = String(c.subject || "").toLowerCase();
    return /huquq|davlat|право|правов/.test(s) ? 1 : 0;
  }

  // joriy holat: sinf, ish, tahlil, shablon
  function ctx() {
    const c = D.classes[S.ci], w = c && (c.works || []).find((x) => x.id === S.smw && x.type === "loyiha");
    if (!w) return null;
    const a = SMV.anOf(c, w); if (!a) return null;
    const L = lyOf(c, a), j = Math.min(S.lysj || 0, L.subj.length - 1);
    return {c, w, a, L, j, sub: L.subj[j], crit: L.subj[j].crit};
  }
  const rowOf = (a, s) => a.rows[s.name] || {in: true, pts: []};
  const edit = (a, s) => (a.rows[s.name] = a.rows[s.name] || {in: true, pts: []});
  const isIn = (a, s) => rowOf(a, s).in !== false;
  // xom qiymatlar: r.x[j]; bo'lmasa (eski ish yoki boshqa joyda kiritilgan) — «Umumiy» fani uchun pts dan
  function rawRow(X, s, j) {
    const {a, L} = X, crit = L.subj[j].crit, r = rowOf(a, s);
    if (Array.isArray(r.x) && Array.isArray(r.x[j])) return crit.map((c, i) => r.x[j][i] ?? null);
    if (j !== L.out || !Array.isArray(r.pts)) return crit.map(() => null);
    return crit.map((c, i) => { const v = r.pts[i]; if (!isNum(v)) return null; if (c.k === "sn") return v; if (c.k === "bn" || c.k === "xt") return toStored(c, nearest(optsOf(c), v), hrng(s.name)); return nearest(optsOf(c), v); });
  }
  const estSet = (X, s, j) => new Set(((rowOf(X.a, s).es || [])[j]) || []);
  const teamOf = (X, i) => { const r = rowOf(X.a, X.c.students[i]); return r.tm >= 1 && r.tm <= 9 ? r.tm : 1 + Math.floor(i / (X.c.students.length > 20 ? 6 : 5)); };
  // eMaktabdagi jami: birinchi ball qo'yilgunga qadar «Umumiy»da turgani (r.em), bo'lmasa — hozirgisi (agar mezon bali yo'q bo'lsa)
  function emOf(X, s, j) {
    if (j !== X.L.out) return null;
    const r = rowOf(X.a, s); if (isNum(r.em)) return r.em;
    const v = (s.scores || {})[X.w.id];
    return isNum(v) && !(r.pts || []).some((p) => p != null) && !(Array.isArray(r.x) && r.x.some((y) => Array.isArray(y) && y.some((z) => z != null))) ? v : null;
  }
  // qiymat yozish (j — fan): xom qiymat, «Umumiy» fani bo'lsa — pts ham
  function put(X, s, j, ci, val, est) {
    const {a, L} = X, r = edit(a, s);
    if (!isNum(r.em)) { const e = emOf(X, s, L.out); if (e != null) r.em = e; }
    if (!Array.isArray(r.x)) r.x = L.subj.map((_, k) => rawRow(X, s, k));
    L.subj.forEach((sb, k) => { if (!Array.isArray(r.x[k])) r.x[k] = sb.crit.map(() => null); });
    r.x[j][ci] = val == null ? null : clone(val);
    const es = r.es = Array.isArray(r.es) ? r.es : [];
    es[j] = (es[j] || []).filter((k) => k !== ci); if (est) es[j].push(ci);
    if (!es.some((x) => x && x.length)) delete r.es;
    if (j === L.out) r.pts = L.subj[j].crit.map((c, i) => cval(c, r.x[j][i]));
  }
  // shablon almashtirilganda: a.q / a.max / a.names va pts «Umumiy» faniga moslanadi
  function syncA(c, a, L) {
    const crit = L.subj[L.out].crit;
    a.q = crit.length; a.max = crit.map((x) => x.m); a.names = crit.map((x) => x.n);
    for (const s of c.students) { const r = a.rows[s.name]; if (!r) continue; const X = {c, a, L}; const raw = rawRow(X, s, L.out); r.pts = crit.map((x, i) => cval(x, raw[i])); }
  }
  function setTpl(c, w, a, t) {
    const L = t.legacy ? null : (t.subj && t.out != null ? clone(t) : snap(t));
    if (L) { L.out = outFor(c, L); a.ly = L; }
    for (const s of c.students) { const r = a.rows[s.name]; if (!r) continue; const keep = {in: r.in !== false, pts: []}; if (r.tm) keep.tm = r.tm; if (r.nt) keep.nt = r.nt; if (isNum(r.em)) keep.em = r.em; a.rows[s.name] = keep; }
    syncA(c, a, lyOf(c, a)); w.max = lyOf(c, a).max;
  }

  /* ── saqlash: tahlil + «Umumiy» sahifasidagi ball (har o'zgarishdan keyin, navbat bilan) ── */
  let queue = Promise.resolve(), savedAt = null;
  function push(c, w, a) { queue = queue.then(() => doPush(c, w, a)).catch(() => {}); return queue; }
  async function doPush(c, w, a) {
    if (!D.classes.includes(c) || !c.works.includes(w)) return;
    const L = lyOf(c, a), crit = L.subj[L.out].crit;
    if (Math.abs((+w.max || 0) - L.max) > 1e-9 && !ARX.dateLocked(w.date)) w.max = L.max;
    if (ARX.scoreLocked(c, w.id)) { save(); return; }
    const batch = [];
    for (const s of c.students) {
      const r = a.rows[s.name]; if (!r) continue;
      const cur = (s.scores || {})[w.id] ?? "";
      if (r.in === false) { if (cur !== "") await putScore(c, s, w.id, "", batch); continue; }
      // faqat hamma mezon baholanganda yoziladi; chala qatorda «Umumiy»dagi ball (eMaktab) o'zgarmaydi, hammasi tozalansa — eMaktab bali qaytadi
      const st = stotal(crit, rawRow({c, a, L}, s, L.out));
      if (st.t == null) { if (isNum(r.em) && cur !== r.em) await putScore(c, s, w.id, r.em, batch); continue; }
      if (!st.full) continue;
      const v = Math.round(st.t * 10) / 10;
      if (cur !== v) await putScore(c, s, w.id, v, batch);
    }
    if (batch.length) pushUndo(batch);
    save();
  }
  // o'zgarish: oldin tahlil nusxasi (bekor qilish uchun), keyin saqlash va qayta chizish
  const UNDO = [];
  function begin(X, label) {
    if (ARX.scoreLocked(X.c, X.w.id)) { ARX.deny(ARX.scoreQ(X.c, X.w.id)); return false; }
    UNDO.push({c: X.c, w: X.w, a: X.a, rows: clone(X.a.rows), ly: X.a.ly ? clone(X.a.ly) : undefined, label}); if (UNDO.length > 60) UNDO.shift();
    return true;
  }
  function done(X) { savedAt = new Date(); save(); push(X.c, X.w, X.a); redraw(); }
  function undo() {
    const u = UNDO.pop(); if (!u) { toast("Bekor qilinadigan o'zgarish yo'q"); return; }
    if (!D.classes.includes(u.c) || !u.c.analyses.includes(u.a)) { toast("Bu ish endi yo'q"); return; }
    if (ARX.scoreLocked(u.c, u.w.id)) { UNDO.push(u); ARX.deny(ARX.scoreQ(u.c, u.w.id)); return; }
    u.a.rows = u.rows; if (u.ly) u.a.ly = u.ly; else delete u.a.ly;
    syncA(u.c, u.a, lyOf(u.c, u.a)); TX = null; savedAt = new Date(); save(); push(u.c, u.w, u.a); redraw(); toast("Bekor qilindi: " + u.label);
  }
  let TX = null;   // oxirgi «Taxminiy ball»: {aid, j, n, near, imp, skip}

  /* ── ko'rinish ── */
  const tel = () => typeof matchMedia === "function" && matchMedia("(max-width: 700px)").matches;
  const tone = (v, m) => v == null ? "e" : v / m >= 0.86 ? "f1" : v / m >= 0.66 ? "f2" : v / m >= 0.3 ? "f3" : "f4";
  const pill = (v, m) => v == null ? "" : v / m >= 0.86 ? "p5" : v / m >= 0.66 ? "p4" : v / m >= 0.3 ? "p3" : "p2";
  const bi = (n) => `<i class="bi bi-${n}" aria-hidden="true"></i>`;
  const hm = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const subjName = (n) => tel() && /^Davlat/.test(n) ? "Huquq" : n;
  function rowState(X, i) {
    const s = X.c.students[i]; if (!isIn(X.a, s)) return "abs";
    const st = stotal(X.crit, rawRow(X, s, X.j)); if (st.t == null) return "bosh"; if (!st.full) return "chala";
    const e = emOf(X, s, X.j); return e != null && Math.abs(e - st.t) > 1e-9 ? "farq" : "ok";
  }
  const hasEst = (X, i) => estSet(X, X.c.students[i], X.j).size > 0;
  function visRows(X) {
    const all = X.c.students.map((_, i) => i), f = S.lyf || "all";
    let L = f === "all" ? all : f === "est" ? all.filter((i) => hasEst(X, i)) : all.filter((i) => rowState(X, i) === f);
    if (S.lysort) {
      const key = (i) => { const s = X.c.students[i], raw = rawRow(X, s, X.j); if (!isIn(X.a, s)) return 1e9; if (S.lysort === "tot") return stotal(X.crit, raw).t ?? -1; const k = +S.lysort.slice(1); return cval(X.crit[k], raw[k]) ?? -1; };
      L = L.slice().sort((p, q) => key(p) - key(q) || p - q);
    }
    return L;
  }
  function counts(X) { const n = {ok: 0, bosh: 0, chala: 0, farq: 0, abs: 0}; X.c.students.forEach((_, i) => n[rowState(X, i)]++); return n; }
  function subjDone(X, j) { const Y = {...X, j, crit: X.L.subj[j].crit}; return X.c.students.filter((s) => isIn(X.a, s) && stotal(Y.crit, rawRow(Y, s, j)).full).length; }
  function ring(X) {
    const n = counts(X), all = X.c.students.length - n.abs, d = n.ok + n.farq, p = Math.round(d / Math.max(1, all) * 100);
    return `<div class="ly-ring" style="--p:${p}" title="${d} / ${all} o'quvchi to'liq baholandi"><span><b>${d}</b><small>/${all}</small></span></div>`;
  }
  const savedTag = () => `<span class="ly-svd" title="Har o'zgarish darhol saqlanadi; jami «Umumiy» sahifasidagi Loyiha ustuniga yoziladi">${bi("check2")} ${savedAt ? "Saqlandi " + hm(savedAt) : "Saqlangan"}<span class="ly-full"> · «Umumiy»ga yoziladi</span></span>`;

  function mzBox(X) {
    const {L, sub} = X, sum = r2(sub.crit.reduce((s, c) => s + c.m, 0)), ok = Math.abs(sum - L.max) < 1e-9, multi = L.subj.length > 1, open = !!S.lymz;
    return `<div class="ly-mz ${open ? "open" : ""}">
      <div class="ly-mzh"><i class="sm-dot loyiha"></i><div class="ly-mzt"><b>${esc(L.title)}</b>
        <span class="ly-sum">${sub.crit.length} ta mezon · ${nf(L.max)} ball ${ok ? `<span class="ok">✓</span>` : `<span class="bad">yig'indi ${nf(sum)} ≠ ${nf(L.max)}</span>`} · ${[...new Set(sub.crit.map((c) => USUL[c.k]))].join(", ")} ${savedTag()}</span></div>
        <span class="sp"></span>${ring(X)}
        <button type="button" class="btn btn-sm" data-ly="mzt" aria-expanded="${open}">${open ? "Yopish ▴" : "Mezonlar ▾"}</button><button type="button" class="btn btn-sm" data-ly="tpl">${bi("pencil")} Shablon</button></div>
      ${L.legacy ? `<div class="ly-legacy">${bi("info-circle")} Bu ishga rasmiy shablon tanlanmagan — mezonlar bo'yicha erkin ball. <button type="button" class="ly-lnk" data-ly="tpl">Shablon tanlash</button></div>` : ""}
      ${open ? `<ol class="ly-mzol">${sub.crit.map((c) => `<li><span class="nm2">${esc(c.n)}</span><span class="ly-uz u-${c.k}">${USUL[c.k]}</span><b>${nf(c.m)}</b><small>${esc(critHint(c))}</small></li>`).join("")}</ol>
        <div class="ly-sum">${L.src ? `Rasmiy fayl: ${esc(L.src)}` : "O'qituvchi tuzgan mezonlar"}${L.max === 30 ? " · chorakda BSB 20 ball bo'lishi kerak (BSB + Loyiha = 50)" : ""}${L.note ? ` · ${esc(L.note)}` : ""}</div>
        <div class="ly-mzact"><button type="button" class="btn btn-sm" data-ly="rub">${bi("file-earmark-text")} O'quvchilar uchun varaqa</button><span class="muted">Ish boshlanishidan oldin o'quvchilarga tanishtiriladi</span></div>` : ""}
      ${multi ? `<div class="ly-subj"><div class="seg">${L.subj.map((x, i) => `<button type="button" data-ly="sj" data-i="${i}" class="${i === X.j ? "on" : ""}"><b>${esc(subjName(x.n))}</b> <span class="ly-sjp">${subjDone(X, i)}/${X.c.students.filter((s) => isIn(X.a, s)).length}</span></button>`).join("")}</div>
        <span class="ly-intg">${bi("info-circle")} Bitta loyiha — har fanga alohida ball. «Umumiy»ga: <b>${esc(L.subj[L.out].n)}</b> <button type="button" class="ly-lnk" data-ly="out">almashtirish</button></span></div>` : ""}
    </div>`;
  }
  function chips(X) {
    const n = counts(X), est = X.c.students.filter((_, i) => hasEst(X, i)).length, f = S.lyf || "all";
    const ch = (k, l, v, cls = "") => v || k === "all" || f === k ? `<button type="button" class="ly-fch ${cls} ${f === k ? "on" : ""}" data-ly="flt" data-v="${k}">${l} <b>${v}</b></button>` : "";
    return `<div class="ly-fchs" role="group" aria-label="Filtr">${ch("all", "Hammasi", X.c.students.length)}${ch("bosh", "Bo'sh", n.bosh)}${ch("chala", "Chala", n.chala, "w")}${ch("farq", "eMaktabdan farq", n.farq, "d")}${ch("est", "Taxminiy", est, "w")}${ch("abs", "Qatnashmagan", n.abs)}</div>`;
  }
  function bar(X, v) {
    const items = SMV.item('data-ly="date"', "calendar3", "Sanani o'zgartirish") + SMV.item('data-ly="rub"', "file-earmark-text", "O'quvchilar uchun mezonlar varaqasi")
      + SMV.item('data-ly="exp"', "download", "Eksport (Excel / PDF)") + SMV.item('data-ly="copy"', "copy", "Mezonlarni boshqa sinfga nusxalash")
      + (v === "j" ? SMV.item('data-ly="teamb"', "people", `Jamoa bo'yicha guruhlash${S.lyteam ? " ✓" : ""}`) : "") + SMV.item("data-smdel", "trash", "O'chirish", "dng");
    return `<div class="sm-bar ly-bar"><div class="seg ly-vseg">${[["j", "Jadval"], ["k", "O'quvchi"], ["t", "Tahlil"]].map(([k, l]) => `<button type="button" data-ly="view" data-v="${k}" class="${v === k ? "on" : ""}">${l}</button>`).join("")}</div>
      ${v !== "t" ? chips(X) : ""}<span class="sp"></span>
      ${v !== "t" ? `<button type="button" class="btn ly-txb" data-ly="txo" title="eMaktabdagi jami balldan mezonlarga taxminiy taqsimlash">${bi("magic")}<span class="ly-full"> Taxminiy ball</span></button>` : ""}
      <button type="button" class="btn ly-ib" data-ly="undo" ${UNDO.some((u) => u.a === X.a) ? "" : "disabled"} title="Bekor qilish (Ctrl+Z)" aria-label="Bekor qilish">${bi("arrow-counterclockwise")}</button>
      <span class="sm-more"><button type="button" class="btn ly-ib" data-smmore aria-haspopup="true" aria-expanded="false" aria-label="Amallar">${bi("three-dots")}</button><div class="sm-menu" hidden>${items}</div></span></div>`;
  }
  function guide(X) {
    if ((S.lygd || {})[X.a.id]) return "";
    if (X.c.students.some((s) => { const r = rowOf(X.a, s); return (r.pts || []).some((p) => p != null) || (Array.isArray(r.x) && r.x.some((y) => Array.isArray(y) && y.some((z) => z != null))); })) return "";
    return `<div class="ly-gd"><div class="ly-gdh"><b>Yangi loyiha ishi — 3 qadam</b><span class="sp"></span><button type="button" class="btn btn-sm" data-ly="gdoff" aria-label="Yopish">${bi("x-lg")}</button></div>
      <ol><li><b>Mezonlarni tekshiring.</b> ${esc(X.L.title)} · ${nf(X.L.max)} ball. <button type="button" class="ly-lnk" data-ly="gdmz">Mezonlar ▾</button></li>
      <li><b>O'quvchilarga tanishtiring.</b> Ish boshlanishidan oldin mezonlar varaqasini bering. <button type="button" class="ly-lnk" data-ly="rub">Varaqani ochish</button></li>
      <li><b>Baholang.</b> Katakni bosing${tel() ? "" : " (raqam yozish ham mumkin)"}. eMaktabga jami allaqachon kiritilgan bo'lsa — <button type="button" class="ly-lnk" data-ly="txo">Taxminiy ball</button>.</li></ol></div>`;
  }
  function emCell(e, t) {
    if (e == null) return `<span class="muted" title="eMaktab / «Umumiy»da ball yo'q">—</span>`;
    if (t == null) return `<span class="ly-emv">${nf(e)}</span>`;
    const d = r2(t - e);
    return d === 0 ? `<span class="ly-emv ok" title="Jami eMaktab bilan bir xil">✓ ${nf(e)}</span>` : `<span class="ly-emv bad" title="Jami eMaktabdan ${d > 0 ? "ko'p" : "kam"}">${nf(e)} <small>${d > 0 ? "+" : "−"}${nf(Math.abs(d))}</small></span>`;
  }
  function cellBtn(X, c, x, i, ci, es) {
    const v = cval(c, x), part = c.k === "bn" && x && !cfull(c, x);
    return `<button type="button" class="ly-sc ${tone(v, c.m)} ${part ? "part" : ""} ${es.has(ci) ? "est" : ""}" data-ly="cell" data-r="${i}" data-c="${ci}" title="${esc(c.n)} — ${nf(v)}\n${esc(v == null ? "baholanmagan — bosing" + (tel() ? "" : " yoki raqam yozing") : descOf(c, x))}">${v == null ? "—" : nf(v)}${part ? "…" : ""}</button>`;
  }
  const noteMark = (r) => r.nt ? `<span class="ly-ntm" title="${esc(r.nt)}">${bi("chat-left-text")}</span>` : "";
  function jadval(X) {
    const {c, crit, L} = X, vr = visRows(X), T = c.students.map((_, i) => teamOf(X, i)), TN = Math.max(...T, 1);
    const head = `<tr><th class="nm"><button type="button" class="ly-thb ${S.lysort ? "" : "on"}" data-ly="sort" data-v="">O'quvchi${S.lysort ? "" : " ↓"}</button></th><th class="ly-ck" title="Qatnashdi">✓</th><th class="ly-tm">Jamoa</th>
      ${crit.map((cr, ci) => `<th class="ly-thc ${S.lysort === "c" + ci ? "srt" : ""}" data-ly="colm" data-c="${ci}" tabindex="0" title="${esc(cr.n)} · ${nf(cr.m)} ball · ${USUL[cr.k]}\nBosing: saralash, bo'sh kataklarni to'ldirish"><span class="ly-cnum">${ci + 1}</span><span class="cn">${esc(cr.n)}</span><span class="cm">${nf(cr.m)} · ${USUL[cr.k].toLowerCase()}</span></th>`).join("")}
      <th title="eMaktabdagi jami (Umumiy → Loyiha ustuni)">eMaktab<span class="cm">jami</span></th><th><button type="button" class="ly-thb ${S.lysort === "tot" ? "on" : ""}" data-ly="sort" data-v="tot">Jami${S.lysort === "tot" ? " ↑" : ""}</button><span class="cm">${nf(L.max)} · %</span></th></tr>`;
    const order = S.lyteam && !S.lysort ? vr.slice().sort((p, q) => T[p] - T[q] || p - q) : vr;
    let html = "", lastT = null;
    for (const i of order) {
      const s = c.students[i], r = rowOf(X.a, s), on = r.in !== false, raw = rawRow(X, s, X.j), st = stotal(crit, raw), es = estSet(X, s, X.j), e = emOf(X, s, X.j);
      if (S.lyteam && !S.lysort && T[i] !== lastT) { lastT = T[i]; html += `<tr class="ly-grp"><td colspan="${crit.length + 5}">${T[i]}-jamoa</td></tr>`; }
      const tsel = `<select class="ly-tmsel tm${(T[i] - 1) % 6 + 1}" data-ly="team" data-r="${i}" aria-label="${esc(s.name)} jamoasi">${Array.from({length: Math.max(TN, 6)}, (_, k) => `<option value="${k + 1}" ${T[i] === k + 1 ? "selected" : ""}>${k + 1}</option>`).join("")}</select>`;
      const ck = `<input type="checkbox" class="ly-ishk" data-ly="ish" data-r="${i}" ${on ? "checked" : ""} aria-label="${esc(s.name)} qatnashdi" title="Qatnashdi / qatnashmadi">`;
      if (!on) { html += `<tr class="ly-off" data-row="${i}"><td class="nm" title="${esc(s.name)}"><i>${i + 1}</i>${nmHtml(s.name)}</td><td class="ly-ck">${ck}</td><td class="ly-tm">${tsel}</td><td colspan="${crit.length}" class="ly-abs">Qatnashmagan</td><td class="s">${emCell(e, null)}</td><td class="s muted">—</td></tr>`; continue; }
      html += `<tr class="ly-st" data-row="${i}"><td class="nm" title="${esc(s.name)}"><i>${i + 1}</i>${nmHtml(s.name)}${noteMark(r)}</td><td class="ly-ck">${ck}</td><td class="ly-tm">${tsel}</td>
        ${crit.map((cr, ci) => `<td class="c">${cellBtn(X, cr, raw[ci], i, ci, es)}</td>`).join("")}<td class="s">${emCell(e, st.full ? st.t : null)}</td>
        <td class="s ly-jm">${st.t == null ? "—" : `<span class="pill ${pill(st.t, L.max)}">${nf(st.t)}</span><small>${Math.round(st.t / L.max * 100)}%</small>`}</td></tr>`;
    }
    if (!order.length) html = `<tr><td colspan="${crit.length + 5}" class="muted" style="padding:14px">Bu filtrda o'quvchi yo'q. <button type="button" class="ly-lnk" data-ly="flt" data-v="all">Hammasini ko'rsatish</button></td></tr>`;
    return `<div class="tblwrap ly-tw"><table class="j ly-t"><thead>${head}</thead><tbody>${html}</tbody></table></div>
      <p class="muted ly-foot">Katakni bosing — ${tel() ? "baholash oynasi ochiladi" : "baholash oynasi ochiladi; yoki katakni tanlab raqam yozing (↑ ↓ ← → bilan yuriladi, Del — tozalash)"}. Sarlavhadagi mezonni bosing — saralash va bo'sh kataklarni to'ldirish. Hamma mezoni baholangan o'quvchining jami «Umumiy»dagi Loyiha ustuniga o'zi yoziladi.</p>`;
  }
  // baholash vidjeti (oyna va karta uchun bir xil)
  function widget(X, c, x, i, ci, inline) {
    const at = `data-r="${i}" data-c="${ci}"`, k = c.k;
    if (k === "hy") return `<div class="ly-hyb"><button type="button" class="ly-opt ${x === c.m ? "on" : ""}" data-ly="set" ${at} data-v="${c.m}" data-k="1"><span class="v">${nf(c.m)}</span><span class="d">To'g'ri bajargan</span></button><button type="button" class="ly-opt ${x === 0 ? "on" : ""}" data-ly="set" ${at} data-v="0" data-k="2"><span class="v">0</span><span class="d">Bajarmagan / noto'g'ri</span></button></div>`;
    if (k === "dr") return `<div class="ly-opts">${c.lv.map((l, li) => `<button type="button" class="ly-opt ${x === l.v ? "on" : ""}" data-ly="set" ${at} data-v="${l.v}" data-k="${li + 1}"><span class="v">${nf(l.v)} ball</span><span class="d">${esc(l.d)}</span></button>`).join("")}</div>`;
    if (k === "or") {
      const cur = x == null ? null : c.lv.findIndex((l) => x >= l.lo && x <= l.hi), P = S.lyp, sel = !inline && P && P.lv != null && P.r === i && P.c === ci ? P.lv : cur;
      return `<div class="ly-opts">${c.lv.map((l, li) => `<button type="button" class="ly-opt ${li === sel ? "on" : ""}" data-ly="lv" ${at} data-l="${li}" data-k="${li + 1}"><span class="v">${l.lo === l.hi ? l.lo : l.lo + "–" + l.hi}</span><span class="d">${esc(l.d)}</span></button>
        ${li === sel ? `<div class="ly-chips ly-orv">${range(l.lo, l.hi).reverse().map((v) => `<button type="button" class="ly-chip ${x === v ? "on" : ""}" data-ly="set" ${at} data-v="${v}">${v}</button>`).join("")}</div>` : ""}`).join("")}</div>`;
    }
    if (k === "bn") {
      const arr = Array.isArray(x) ? x : c.b.map(() => null);
      return `<div>${c.b.map((b, bi2) => `<div class="ly-band"><span class="bt">${esc(b.n)}<small>maks. ${nf(b.m)} ball</small></span><span class="ly-chips">${range(0, b.m, stepOf(b.m)).map((v) => `<button type="button" class="ly-chip sm ${arr[bi2] === v ? "on" : ""}" data-ly="band" ${at} data-b="${bi2}" data-v="${v}">${nf(v)}</button>`).join("")}</span></div>`).join("")}
        <div class="hrow ly-bandf"><button type="button" class="btn btn-sm" data-ly="bandall" ${at}>Hammasiga to'liq ball</button>${inline ? "" : `<span class="muted small">Har band: to'liq — mustaqil va to'g'ri, oraliq — qisman, 0 — bajarmagan</span>`}</div></div>`;
    }
    if (k === "xt") {
      const e = x ? x.e : null, rr = e == null ? null : xtRange(c, e);
      return `<div class="ly-xt"><div class="hrow"><span class="ly-lbl">Xatolar soni</span><span class="ly-step"><button type="button" data-ly="xe" ${at} data-d="-1" aria-label="Kamaytirish">−</button><span>${e == null ? "—" : e}</span><button type="button" data-ly="xe" ${at} data-d="1" aria-label="Ko'paytirish">+</button></span></div>
        <div class="ly-xtmap">${c.xt.map((m) => `<div class="${rr === m ? "on" : ""}">${m[0] === m[1] ? m[0] : m[1] >= 99 ? m[0] + "+" : m[0] + "–" + m[1]} ta<br><b>${m[2] === m[3] ? m[2] : m[2] + "–" + m[3]} ball</b></div>`).join("")}</div>
        ${rr && rr[2] !== rr[3] ? `<div class="hrow"><span class="ly-lbl">Aniq ball</span><span class="ly-chips">${range(rr[2], rr[3]).reverse().map((v) => `<button type="button" class="ly-chip ${x.v === v ? "on" : ""}" data-ly="xv" ${at} data-v="${v}">${v}</button>`).join("")}</span></div>` : ""}</div>`;
    }
    // erkin ball (eski ishlar, o'zim tuzgan «Ball» usuli)
    const op = range(0, c.m, stepOf(c.m));
    return op.length <= 21 ? `<div class="ly-chips">${op.map((v, vi) => `<button type="button" class="ly-chip ${x === v ? "on" : ""}" data-ly="set" ${at} data-v="${v}" ${vi < 9 ? `data-k="${vi + 1}"` : ""}>${nf(v)}</button>`).join("")}</div>`
      : `<label class="f ly-snf">Ball (0 – ${nf(c.m)})<input class="form-control" type="number" min="0" max="${c.m}" step="0.5" inputmode="decimal" data-ly="snv" ${at} value="${x == null ? "" : x}"></label>`;
  }
  const NQ = ["Jamoa sardori", "Faol ishladi", "Taqdimotni qildi", "Mahsulotni tayyorladi", "Passiv qatnashdi", "Himoyada ikkilandi"];
  function noteBox(r, i) {
    const v = r.nt || "";
    return `<div class="ly-nbox"><label class="ly-nl" for="ly-nt${i}">${bi("chat-left-text")} Izoh <span class="muted">· individual hissasi va himoyadagi chiqishi</span></label>
      <textarea id="ly-nt${i}" class="ly-ninp" data-ly="note" data-r="${i}" rows="2" maxlength="300" placeholder="Masalan: jamoa sardori, taqdimotni o'zi qildi">${esc(v)}</textarea>
      <div class="ly-nqs">${NQ.filter((w) => !v.toLowerCase().includes(w.toLowerCase())).map((w) => `<button type="button" class="ly-nq" data-ly="nq" data-r="${i}" data-v="${esc(w)}">+ ${w}</button>`).join("")}</div></div>`;
  }
  function karta(X) {
    const {c, crit, L} = X, vr = visRows(X);
    if (!vr.length) return `<div class="card muted">Bu filtrda o'quvchi yo'q. <button type="button" class="ly-lnk" data-ly="flt" data-v="all">Hammasini ko'rsatish</button></div>`;
    const i = vr.includes(S.lystu) ? S.lystu : vr[0]; S.lystu = i;
    const s = c.students[i], r = rowOf(X.a, s), raw = rawRow(X, s, X.j), st = stotal(crit, raw), es = estSet(X, s, X.j);
    const oth = L.subj.length > 1 ? L.subj.map((x, k) => k === X.j ? "" : `${esc(subjName(x.n))}: ${nf(stotal(x.crit, rawRow(X, s, k)).t)}`).filter(Boolean).join(" · ") : "";
    const nav = `<div class="ly-stuh"><button type="button" class="btn" data-ly="stu" data-d="-1" aria-label="Oldingi o'quvchi">${bi("chevron-left")}</button>
      <select class="form-select" data-ly="stusel" aria-label="O'quvchi">${vr.map((k) => { const s2 = c.students[k], t2 = stotal(crit, rawRow(X, s2, X.j)); return `<option value="${k}" ${k === i ? "selected" : ""}>${k + 1}. ${esc(s2.name)}${!isIn(X.a, s2) ? " · qatnashmagan" : t2.t == null ? " · bo'sh" : !t2.full ? " · chala" : " · " + nf(t2.t)}</option>`; }).join("")}</select>
      <button type="button" class="btn" data-ly="stu" data-d="1" aria-label="Keyingi o'quvchi">${bi("chevron-right")}</button></div>`;
    if (r.in === false) return `${nav}<div class="card ly-cc"><b>${i + 1}. ${esc(s.name)}</b><span class="muted">Loyihada qatnashmagan — ball qo'yilmaydi, tahlilga kirmaydi.</span><button type="button" class="btn btn-sm" data-ly="unabs" data-r="${i}" style="align-self:flex-start">Qatnashgan deb belgilash</button></div>`;
    return `${nav}
      <div class="ly-tots">Jami <b>${st.t == null ? "—" : nf(st.t)}</b> / ${nf(L.max)} ${oth ? `<span class="ly-tsx">· ${oth}</span>` : ""}<span class="sp"></span>${st.t != null ? `<span class="pill ${pill(st.t, L.max)}">${Math.round(st.t / L.max * 100)}%</span>` : ""}
        <label class="ly-ishl"><input type="checkbox" class="ly-ishk" data-ly="ish" data-r="${i}" checked> Qatnashdi</label></div>
      <div class="ly-kgrid">${crit.map((cr, ci) => `<div class="ly-cc ${es.has(ci) ? "estc" : ""}"><div class="ly-cch"><span class="ly-cnum">${ci + 1}</span><b>${esc(cr.n)}</b><span class="ly-uz u-${cr.k}">${USUL[cr.k]}</span><span class="cv">${nf(cval(cr, raw[ci]))} / ${nf(cr.m)}</span></div>${widget(X, cr, raw[ci], i, ci, true)}</div>`).join("")}</div>
      ${noteBox(r, i)}
      <div class="ly-stuh"><button type="button" class="btn" data-ly="absr" data-r="${i}">Qatnashmadi</button><span class="sp"></span><button type="button" class="btn btn-primary" data-ly="stu" data-d="1">Keyingi o'quvchi ${bi("chevron-right")}</button></div>`;
  }
  function tahlil(X) {
    const {c, crit, L} = X, live = c.students.map((s, i) => i).filter((i) => isIn(X.a, c.students[i]));
    const raws = live.map((i) => rawRow(X, c.students[i], X.j)), tots = raws.map((r) => stotal(crit, r).t).filter((v) => v != null);
    const avg = tots.length ? tots.reduce((a, b) => a + b, 0) / tots.length : 0, max = L.max;
    const bands = [[86, "p5", "86–100%"], [66, "p4", "66–85%"], [30, "p3", "30–65%"], [0, "p2", "0–29%"]].map(([lo, cls, l], k, A) => ({cls, l, n: tots.filter((v) => { const p = v / max * 100; return p >= lo && (k === 0 || p < A[k - 1][0]); }).length}));
    const cm = crit.map((cr, ci) => { const vs = raws.map((r) => cval(cr, r[ci])).filter((v) => v != null); return {n: cr.n, ci, p: vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length / cr.m * 100 : null}; });
    const col = (p) => p >= 86 ? "var(--ly-g5)" : p >= 66 ? "var(--ly-g4)" : p >= 30 ? "var(--ly-g3)" : "var(--ly-g2)";
    const weakC = cm.filter((x) => x.p != null).sort((a, b) => a.p - b.p)[0];
    const bnd = []; crit.forEach((cr, ci) => { if (cr.k !== "bn") return; cr.b.forEach((b, k) => { const vs = raws.map((r) => Array.isArray(r[ci]) ? r[ci][k] : null).filter((v) => v != null); if (vs.length) bnd.push({n: b.n, c: ci + 1, p: vs.reduce((a, v) => a + v, 0) / vs.length / b.m * 100}); }); });
    bnd.sort((a, b) => a.p - b.p);
    const help = []; live.forEach((i, k) => { const st = stotal(crit, raws[k]); if (st.t == null) return; const wk = crit.map((cr, ci) => ({ci, p: cval(cr, raws[k][ci]) == null ? null : cval(cr, raws[k][ci]) / cr.m})).filter((x) => x.p != null).sort((a, b) => a.p - b.p)[0]; if (st.t / max < 0.3 || (wk && wk.p < 0.3)) help.push({i, t: st.t, wk}); });
    help.sort((a, b) => a.t - b.t);
    const cmp = L.subj.length > 1 ? `<div class="card ly-card"><h3>Ikki fan solishtirmasi</h3>${L.subj.map((x, k) => { const t2 = live.map((i) => stotal(x.crit, rawRow(X, c.students[i], k)).t).filter((v) => v != null), p = t2.length ? t2.reduce((a, b) => a + b, 0) / t2.length / max * 100 : 0; return `<div class="ly-sc2"><span>${esc(x.n)}</span><span class="tr"><span class="fl" style="width:${p}%;background:${k ? "var(--sm-chsb,#7c3aed)" : "var(--sm-loyiha,#0f8a4f)"}"></span></span><b>${Math.round(p)}%</b></div>`; }).join("")}<p class="muted small" style="margin:6px 0 0">Bitta loyiha, ikki xil nuqtayi nazar: farq katta bo'lsa — qaysi fan talablari tushuntirilmaganini ko'rsatadi.</p></div>` : "";
    return `<div class="ly-tiles"><div><small>Baholangan</small><b>${tots.length} / ${live.length}</b></div><div><small>O'rtacha ball</small><b>${nf(Math.round(avg * 10) / 10)} / ${nf(max)}</b></div><div><small>O'rtacha natija</small><b>${Math.round(avg / max * 100)}%</b></div><div><small>Mezonlar</small><b>${crit.length}</b></div></div>
      ${cmp}
      <div class="ly-two"><div class="card ly-card"><h3>Mezonlar bo'yicha o'rtacha</h3>${cm.map((x) => `<div class="ly-qb"><span class="lbl">${esc(x.n)}</span><span class="tr"><span class="fl" style="width:${x.p || 0}%;background:${col(x.p || 0)}"></span></span><b>${x.p == null ? "—" : Math.round(x.p) + "%"}</b></div>`).join("")}
        ${weakC ? `<div class="ly-weak"><span class="ly-lbl">E'tibor bering</span><div>Eng past mezon: <b>${esc(weakC.n)}</b> — ${Math.round(weakC.p)}%</div>${bnd.length ? `<div class="muted small">Eng qiyin bandlar:</div><ol class="ly-wb">${bnd.slice(0, 3).map((b) => `<li><span class="ly-cnum">${b.c}</span>${esc(b.n)} <b>${Math.round(b.p)}%</b></li>`).join("")}</ol>` : ""}</div>` : ""}</div>
      <div class="card ly-card"><h3>Natijalar taqsimoti</h3><div class="ly-gdist">${bands.filter((b) => b.n).map((b) => `<span class="${b.cls}" style="flex:${b.n}">${b.n}</span>`).join("")}</div>
        ${bands.map((b) => `<div class="hrow ly-bl"><span class="pill ${b.cls}">${b.n}</span>${b.l}</div>`).join("")}
        <div class="ly-weak"><span class="ly-lbl">Yordam kerak · ${help.length}</span>${help.length ? `<ol class="ly-wb">${help.slice(0, 8).map((h) => `<li><button type="button" class="ly-lnk2" data-ly="gostu" data-r="${h.i}">${esc(c.students[h.i].name)}</button><span class="muted small">${h.wk ? `<span class="ly-cnum">${h.wk.ci + 1}</span> ${Math.round(h.wk.p * 100)}%` : ""}</span><b>${nf(h.t)}</b></li>`).join("")}</ol>${help.length > 8 ? `<span class="muted small">va yana ${help.length - 8} ta</span>` : ""}` : `<span class="muted">Hamma o'quvchi 30% dan yuqori.</span>`}</div></div></div>`;
  }
  function txBanner(X) {
    if (!TX || TX.aid !== X.a.id || TX.j !== X.j) return "";
    const left = X.c.students.reduce((n, s) => n + estSet(X, s, X.j).size, 0), fx = fixRows(X).length;
    return `<div class="ly-ban">${bi("magic")}<div class="ly-bt"><div><b>${TX.n} ta o'quvchiga taxminiy ball qo'yildi</b> · sariq uzuq chiziqli kataklar (${left} ta). Tekshirib, kerakli joyini qo'lda o'zgartiring; jami eMaktabdan farq qilsa «Moslash» qolgan taxminiy kataklarni to'g'rilaydi.</div>
      ${TX.near.length ? `<div>Aniq chiqmadi, eng yaqin ball qo'yildi: ${TX.near.map(([i, a, b]) => `${esc(X.c.students[i].name.split(" ")[0])} ${nf(a)} → ${nf(b)}`).join(", ")}</div>` : ""}
      ${TX.imp.length ? `<div>Imkonsiz, qo'yilmadi: ${TX.imp.map((i) => esc(X.c.students[i].name.split(" ")[0])).join(", ")}</div>` : ""}${TX.skip ? `<div>eMaktabda bali yo'q: ${TX.skip} ta (o'tkazib yuborildi)</div>` : ""}</div>
      ${fx ? `<button type="button" class="btn btn-sm btn-primary" data-ly="fix">Moslash (${fx})</button>` : ""}<button type="button" class="btn btn-sm" data-ly="undo">Bekor qilish</button><button type="button" class="btn btn-sm" data-ly="txhide" aria-label="Yopish">${bi("x-lg")}</button></div>`;
  }
  const fixRows = (X) => X.c.students.map((_, i) => i).filter((i) => { const s = X.c.students[i], e = emOf(X, s, X.j); return isIn(X.a, s) && hasEst(X, i) && e != null && stotal(X.crit, rawRow(X, s, X.j)).t !== e; });

  /* ── sahifa ── */
  function page(m) {
    const X = ctx(), c = D.classes[S.ci];
    if (!X) { m.innerHTML = ""; return; }
    const v = S.lyv || (tel() ? "k" : "j");
    m.innerHTML = `<div class="vcol sm-page ly" style="gap:12px">${classChips()}<div class="hrow">${jpSeg()}</div>${SMV.top(c)}
      ${mzBox(X)}${bar(X, v)}${v !== "t" ? txBanner(X) : ""}${v !== "t" ? guide(X) : ""}
      ${v === "j" ? jadval(X) : v === "k" ? karta(X) : tahlil(X)}</div>`;
    bindTop(m); SMV.bind(m, c, {w: X.w, a: X.a});
    drawDlg();
  }
  function redraw() { if (S.page === "journal" && S.jpage === "sm" && S.smt === "loyiha") softRender(); drawDlg(); }

  /* ── oynalar: o'z qatlamida, har o'zgarishda faqat o'zgargan qismi almashadi ── */
  function closeDlg() { S.lyp = null; S.lyd = null; drawDlg(); }
  function drawDlg() {
    let ov = document.getElementById("ly-ov");
    const X = ctx(), on = S.page === "journal" && S.jpage === "sm" && S.smt === "loyiha";
    if (!on || (!S.lyp && !S.lyd) || (!X && !(S.lyd && S.lyd.mode === "new"))) { if (ov) ov.remove(); if (!on) { S.lyp = null; S.lyd = null; } return; }
    const html = S.lyp ? popDlg(X) : dlgHtml(X);
    if (!html) { S.lyp = null; S.lyd = null; if (ov) ov.remove(); return; }
    const wide = S.lyd && ["tpl", "new", "rub"].includes(S.lyd.mode);
    if (!ov) {
      ov = document.createElement("div"); ov.id = "ly-ov"; ov.className = "modal ly-ov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true");
      ov.innerHTML = `<div class="card"></div>`; ov._close = closeDlg;
      ov.addEventListener("click", (e) => { if (e.target === ov) closeDlg(); });
      document.body.append(ov);
    }
    const card = ov.firstChild; card.className = `card ly-md ${wide ? "wide" : ""}`;
    const tmp = document.createElement("div"); tmp.innerHTML = html;
    if (card.childNodes.length) morphKids(card, tmp); else card.append(...tmp.childNodes);
  }
  function popDlg(X) {
    const P = S.lyp, s = X.c.students[P.r]; if (!s || !X.crit[P.c]) return "";
    const c = X.crit[P.c], raw = rawRow(X, s, X.j), x = raw[P.c], st = stotal(X.crit, raw), T = teamOf(X, P.r), r = rowOf(X.a, s);
    return `<div class="ly-pvh"><div class="who">${P.r + 1}. ${esc(s.name)} <span class="muted">· jami ${nf(st.t)} / ${nf(X.L.max)}</span></div><button type="button" class="btn btn-sm" data-ly="close" aria-label="Yopish">${bi("x-lg")}</button></div>
      <div class="ly-mtabs" role="tablist">${X.crit.map((cc, k) => `<button type="button" role="tab" aria-selected="${k === P.c}" class="ly-mt ${k === P.c ? "on" : ""} ${cfull(cc, raw[k]) ? "dn" : raw[k] != null ? "pt" : ""}" data-ly="mz" data-c="${k}" title="${esc(cc.n)}"><span>${k + 1}</span><b>${nf(cval(cc, raw[k]))}</b></button>`).join("")}</div>
      <div class="ly-what"><b>${esc(c.n)}</b> · maks. ${nf(c.m)} · <span class="ly-uz u-${c.k}">${USUL[c.k]}</span> ${USUL_D[c.k]}${X.L.subj.length > 1 ? ` · <b>${esc(X.sub.n)}</b>` : ""}</div>
      ${widget(X, c, x, P.r, P.c, false)}
      <div class="ly-advr"><span class="ly-lbl">Tanlagach</span><div class="seg ly-sm">${[["off", "shu yerda"], ["stu", "keyingi o'quvchi"], ["mez", "keyingi mezon"]].map(([k, l]) => `<button type="button" data-ly="adv" data-v="${k}" class="${(S.lyadv || "stu") === k ? "on" : ""}">${l}</button>`).join("")}</div>
        ${tel() ? "" : `<span class="ly-kbd">1–9 tanlash · ← → o'quvchi · ↑ ↓ mezon · Del tozalash</span>`}</div>
      <div class="ly-nrow">${bi("chat-left-text")}<input class="ly-ninp" data-ly="note" data-r="${P.r}" maxlength="300" value="${esc(r.nt || "")}" placeholder="Izoh: individual hissasi, himoyadagi chiqishi (ixtiyoriy)" aria-label="Izoh"></div>
      <div class="ly-pvf"><span class="tt2">Mezon bali <b>${nf(cval(c, x))}</b> / ${nf(c.m)}</span><span class="sp"></span>
        ${x != null ? `<button type="button" class="btn btn-sm" data-ly="teamset" title="Shu mezon bo'yicha ${T}-jamoadagi hammaga shu ball">${bi("people")} Jamoaga</button>` : ""}<button type="button" class="btn btn-sm" data-ly="absr" data-r="${P.r}">Qatnashmadi</button><button type="button" class="btn btn-sm" data-ly="clr">Tozalash</button>
        <button type="button" class="btn btn-sm" data-ly="nav" data-d="-1" aria-label="Oldingi o'quvchi">${bi("chevron-left")}</button><button type="button" class="btn btn-sm btn-primary" data-ly="nav" data-d="1">Keyingi ${bi("chevron-right")}</button></div>`;
  }
  function dlgHtml(X) {
    const D2 = S.lyd;
    if (D2.mode === "tpl" || D2.mode === "new") return tplDlg(X);
    if (D2.mode === "col") return colDlg(X);
    if (D2.mode === "tx") return txDlg(X);
    if (D2.mode === "rub") return rubDlg(X);
    if (D2.mode === "copy") return copyDlg(X);
    if (D2.mode === "date") return `<h2>${esc(SMV.wname(X.c, X.w))}: sana</h2><label class="f">Sana<input class="form-control" type="date" id="ly-date" value="${X.w.date}"></label>
      <div class="hrow"><span class="sp"></span><button type="button" class="btn" data-ly="close">Bekor qilish</button><button type="button" class="btn btn-primary" data-ly="dateok">Saqlash</button></div>`;
    return "";
  }
  function colDlg(X) {
    const ci = S.lyd.c, c = X.crit[ci]; if (!c) return "";
    const live = X.c.students.filter((s) => isIn(X.a, s)), raws = live.map((s) => rawRow(X, s, X.j)[ci]);
    const empty = raws.filter((x) => !cfull(c, x)).length, vs = raws.map((x) => cval(c, x)).filter((v) => v != null);
    const opts = c.k === "bn" ? [c.m] : c.k === "xt" ? [] : optsOf(c).slice().sort((a, b) => b - a).slice(0, c.k === "or" || c.k === "sn" ? 3 : 6);
    return `<div class="ly-pvh"><div><span class="ly-cnum">${ci + 1}</span> <b>${esc(c.n)}</b><div class="muted small">${nf(c.m)} ball · ${USUL[c.k]} · ${esc(critHint(c))}</div></div><button type="button" class="btn btn-sm" data-ly="close" aria-label="Yopish">${bi("x-lg")}</button></div>
      <div class="ly-cstat"><span>Baholangan <b>${vs.length}/${live.length}</b></span><span>O'rtacha <b>${vs.length ? Math.round(vs.reduce((a, b) => a + b, 0) / vs.length / c.m * 100) : 0}%</b></span><span>Bo'sh/chala <b>${empty}</b></span></div>
      <span class="ly-lbl">Saralash</span>
      <div class="hrow"><button type="button" class="btn btn-sm ${S.lysort === "c" + ci ? "btn-primary" : ""}" data-ly="sort" data-v="c${ci}">Shu mezon bo'yicha (pastdan)</button><button type="button" class="btn btn-sm" data-ly="sort" data-v="">Ro'yxat tartibida</button></div>
      ${opts.length && empty ? `<span class="ly-lbl">Bo'sh kataklarga (${empty} ta) qo'yish</span><div class="ly-chips">${opts.map((v) => `<button type="button" class="ly-chip" data-ly="colfill" data-v="${v}">${nf(v)}</button>`).join("")}</div>
        <span class="muted small">${c.k === "bn" ? "Bandlarning hammasiga to'liq ball." : "Faqat bo'sh kataklar; qo'yilgan ballar o'zgarmaydi."}</span>` : ""}
      <div class="hrow"><span class="sp"></span><button type="button" class="btn btn-sm btn-outline-danger" data-ly="colclr" ${vs.length ? "" : "disabled"}>Ustunni tozalash</button><button type="button" class="btn btn-sm" data-ly="close">Yopish</button></div>`;
  }
  function txTargets(X) {
    const who = S.lyd.who, out = [], skip = [];
    X.c.students.forEach((s, i) => { if (!isIn(X.a, s)) return; const st = stotal(X.crit, rawRow(X, s, X.j)); if (who === "bosh" && st.full) return; if (emOf(X, s, X.j) == null) { if (st.t == null) skip.push(i); return; } out.push(i); });
    return {out, skip};
  }
  function txDlg(X) {
    const T = S.lyd, {out, skip} = txTargets(X), multi = X.L.subj.length > 1;
    if (X.j !== X.L.out) return `<h2>Taxminiy ball</h2><div class="muted">eMaktabdagi jami faqat «Umumiy»ga yoziladigan fan (<b>${esc(X.L.subj[X.L.out].n)}</b>) uchun bor. Shu fanga o'ting.</div><div class="hrow"><span class="sp"></span><button type="button" class="btn" data-ly="close">Yopish</button><button type="button" class="btn btn-primary" data-ly="sj" data-i="${X.L.out}">${esc(X.L.subj[X.L.out].n)}</button></div>`;
    const prev = out.slice(0, 5).map((i) => { const s = X.c.students[i], raw = rawRow(X, s, X.j), E = emOf(X, s, X.j), e = estimate(X.crit, raw, E, T.m, T.who, T.near, s.name);
      return `<tr><td class="nm2">${i + 1}. ${esc(s.name)}</td><td>${nf(E)}</td><td class="pvv">${e ? X.crit.map((c, ci) => e.cells[ci] == null ? `<b class="fx">${nf(cval(c, raw[ci]))}</b>` : `<span>${nf(cval(c, e.cells[ci]))}</span>`).join(" · ") : `<i class="muted">imkonsiz</i>`}</td><td>${e ? (e.sum === E ? `<b class="ok">${nf(e.sum)} ✓</b>` : `<b class="bad">${nf(e.sum)}</b>`) : "—"}</td></tr>`; }).join("");
    return `<div class="ly-pvh"><h2>Taxminiy ball</h2><button type="button" class="btn btn-sm" data-ly="close" aria-label="Yopish">${bi("x-lg")}</button></div>
      <div class="ly-intg">${bi("info-circle")} eMaktabdagi jami ball (Umumiy → Loyiha ustuni) mezonlarga bo'lib chiqiladi. Har mezon faqat o'z usulidagi qiymatni oladi${multi ? ` · fan: <b>${esc(X.sub.n)}</b>` : ""}.</div>
      <div class="hrow"><span class="ly-lbl ly-w">Taqsimlash</span><div class="seg"><button type="button" data-ly="txm" data-v="tabiiy" class="${T.m === "tabiiy" ? "on" : ""}">Tabiiy</button><button type="button" data-ly="txm" data-v="teng" class="${T.m === "teng" ? "on" : ""}">Teng ulush</button></div></div>
      <span class="muted small">${T.m === "tabiiy" ? "Har o'quvchida mezonlar biroz farqli (o'quvchi ismiga bog'liq, har safar bir xil chiqadi)." : "Har mezon o'z maksimaliga mutanosib, iloji boricha teng ulushda."}</span>
      <div class="hrow"><span class="ly-lbl ly-w">Qaysilariga</span><div class="seg"><button type="button" data-ly="txw" data-v="bosh" class="${T.who === "bosh" ? "on" : ""}">Faqat bo'sh kataklar</button><button type="button" data-ly="txw" data-v="hammasi" class="${T.who === "hammasi" ? "on" : ""}">Hammasini qayta</button></div></div>
      <label class="hrow ly-chk"><input type="checkbox" data-ly="txnear" ${T.near ? "checked" : ""}> Aniq chiqmasa, eng yaqin ballni qo'yish</label>
      <span class="muted small">Masalan, hamma mezon Ha/Yo'q (10 yoki 0) bo'lsa, 37 ball chiqmaydi → 40 yoki 30 dan yaqini.</span>
      <div class="ly-txw"><table class="ly-txp"><thead><tr><th class="nm2">O'quvchi</th><th>eMaktab</th><th>Mezonlar bo'yicha</th><th>Jami</th></tr></thead><tbody>${prev || `<tr><td colspan="4" class="muted">Taxmin qilinadigan o'quvchi yo'q</td></tr>`}</tbody></table></div>
      <span class="muted small">${out.length > 5 ? `va yana ${out.length - 5} ta o'quvchi · ` : ""}<b class="fx">Qalin</b> — qo'lda qo'yilgan, o'zgarmaydi.${skip.length ? ` eMaktabda bali yo'q ${skip.length} ta o'quvchi o'tkazib yuboriladi.` : ""}</span>
      <div class="hrow"><span class="sp"></span><button type="button" class="btn" data-ly="close">Bekor qilish</button><button type="button" class="btn btn-primary" data-ly="txgo" ${out.length ? "" : "disabled"}>${out.length} ta o'quvchiga kiritish</button></div>`;
  }
  // o'quvchilarga beriladigan mezonlar varaqasi
  function rubLevels(c) {
    if (c.k === "hy") return `<li><b>${nf(c.m)}</b> — to'liq va to'g'ri bajarilgan</li><li><b>0</b> — bajarilmagan yoki xato</li>`;
    if (c.k === "dr") return c.lv.map((l) => `<li><b>${nf(l.v)}</b> — ${esc(l.d || "")}</li>`).join("");
    if (c.k === "or") return c.lv.map((l) => `<li><b>${l.lo === l.hi ? l.lo : l.lo + "–" + l.hi}</b> — ${esc(l.d || "")}</li>`).join("");
    if (c.k === "bn") return c.b.map((b) => `<li><b>${nf(b.m)}</b> — ${esc(b.n)}</li>`).join("");
    if (c.k === "xt") return c.xt.map((r) => `<li><b>${r[2] === r[3] ? r[2] : r[2] + "–" + r[3]}</b> — ${r[1] >= 99 ? r[0] + " va undan ko'p" : r[0] === r[1] ? r[0] : r[0] + "–" + r[1]} ta xato</li>`).join("");
    return `<li><b>0–${nf(c.m)}</b> — bajarilish darajasiga qarab</li>`;
  }
  const rubPaper = (X) => `<div class="ly-paper"><div class="ly-pph"><b>${esc(label(X.c))} · ${esc(X.L.title)}</b><span>Maksimal ball: <b>${nf(X.L.max)}</b>${X.L.subj.length > 1 ? " (har fanga alohida)" : ""}</span></div>
      ${X.L.subj.map((x) => `${X.L.subj.length > 1 ? `<div class="ly-pps">${esc(x.n)}</div>` : ""}<ol class="ly-rub">${x.crit.map((cr) => `<li><div class="rh"><span>${esc(cr.n)}</span><b>${nf(cr.m)} ball</b></div><ul>${rubLevels(cr)}</ul></li>`).join("")}</ol>`).join("")}
      <div class="ly-ppf">Ish jamoada bajariladi, lekin har bir o'quvchi alohida baholanadi.</div></div>`;
  function rubDlg(X) {
    return `<div class="ly-pvh"><h2>Mezonlar varaqasi</h2><button type="button" class="btn btn-sm" data-ly="close" aria-label="Yopish">${bi("x-lg")}</button></div>
      <p class="muted" style="margin:0">O'quvchilar ishni boshlashdan oldin nima uchun qancha ball olishini bilishi kerak. Varaqada o'quvchilarning ballari bo'lmaydi, faqat mezonlar.</p>
      ${rubPaper(X)}
      <div class="hrow"><span class="sp"></span><button type="button" class="btn" data-ly="close">Yopish</button><button type="button" class="btn btn-primary" data-ly="rubp">${bi("printer")} Chop etish / PDF</button></div>`;
  }
  function copyDlg(X) {
    const pick = S.lyd.pick, L = D.classes.map((c, i) => ({c, i})).filter(({c}) => c !== X.c && !isGrp(c));
    return `<div class="ly-pvh"><h2>Mezonlarni nusxalash</h2><button type="button" class="btn btn-sm" data-ly="close" aria-label="Yopish">${bi("x-lg")}</button></div>
      <div class="muted">«${esc(X.L.title)}» (${nf(X.L.max)} ball) tanlangan sinflarda ${fmt(X.w.date)} sanasidagi Loyiha ishiga qo'yiladi. Shu sanada ballari bor Loyiha ishi bo'lsa — tegilmaydi.</div>
      <div class="ly-cpl">${L.length ? L.map(({c, i}) => `<button type="button" class="ly-cpi ${pick.includes(i) ? "on" : ""}" data-ly="cpk" data-i="${i}"><span class="cb">${pick.includes(i) ? "✓" : ""}</span><b>${esc(label(c))}</b><small>${c.students.length} o'quvchi</small></button>`).join("") : `<span class="muted">Boshqa sinf yo'q</span>`}</div>
      <div class="hrow"><span class="sp"></span><button type="button" class="btn" data-ly="close">Bekor qilish</button><button type="button" class="btn btn-primary" data-ly="cpgo" ${pick.length ? "" : "disabled"}>${pick.length} ta sinfga nusxalash</button></div>`;
  }
  /* ── shablon tanlash (yangi ish ham shu oynada) ── */
  const norm = (s) => String(s || "").toLowerCase().replace(/[ʻʼ'`‘’]/g, "");
  function fanMatch(c, t) {
    const s = norm(c.subject); if (!s) return false;
    if (t.subj.length > 1 && /tarbiya|huquq|davlat/.test(s)) return true;
    return s.includes(norm(t.fan)) || norm(t.fan).includes(s);
  }
  function gradeMatch(c, t) {
    const g = +(String(c.name).match(/\d+/) || [0])[0]; if (!g) return false;
    const [a, b] = String(t.sinf).split(/[–-]/).map(Number); return g >= a && g <= (b || a);
  }
  function autoCrit(r) {
    const m = Math.max(0.5, Math.round((+r.m || 1) * 2) / 2), n = String(r.n || "").trim().slice(0, 120) || "Mezon";
    if (r.k === "hy") return {n, m, k: "hy"};
    if (r.k === "dr") { const vs = [...new Set([m, Math.round(m * 0.75), Math.round(m * 0.5), Math.round(m * 0.25), 0])]; return {n, m, k: "dr", lv: vs.map((v, i) => ({v, d: ["To'liq va mustaqil bajargan", "Kichik kamchiliklar bor", "Qisman bajargan", "Juda yuzaki", "Bajarmagan"][i] || ""}))}; }
    if (r.k === "or") { const a = Math.max(1, Math.round(m * 0.8)), b = Math.max(1, Math.round(m * 0.5)); return {n, m, k: "or", lv: [{lo: a, hi: Math.max(a, Math.floor(m)), d: "Yuqori daraja"}, {lo: b, hi: Math.max(b, a - 1), d: "O'rta daraja"}, {lo: 1, hi: Math.max(1, b - 1), d: "Past daraja"}]}; }
    return {n, m, k: "sn"};
  }
  function tplDlg(X) {
    const T = S.lyd, c = D.classes[S.ci], q = norm(T.q), isNew = T.mode === "new";
    const match = (t) => !q || norm(t.title + " " + t.fan + " " + t.src).includes(q);
    const sug = TPL.filter((t) => fanMatch(c, t) && match(t)).sort((a, b) => gradeMatch(c, b) - gradeMatch(c, a)), rest = TPL.filter((t) => !sug.includes(t) && match(t));
    const card = (t) => `<button type="button" class="ly-tp ${T.sel === t.id ? "on" : ""} ${sug.includes(t) ? "sug" : ""}" data-ly="pick" data-v="${t.id}">${sug.includes(t) && gradeMatch(c, t) ? `<span class="sg">Sizning fan va sinf</span>` : ""}<b>${esc(t.title)}</b>
      <small>${t.subj.length > 1 ? `2 fan × ${t.max}` : `${t.subj[0].crit.length} ta mezon · ${t.max}`} ball · ${[...new Set(t.subj[0].crit.map((x) => USUL[x.k]))].join(", ")}</small><small>${esc(t.src)}</small></button>`;
    const showRest = T.all || q || !sug.length;
    const own = T.own, osum = r2(own.reduce((s, r) => s + (+r.m || 0), 0));
    const sel = T.sel === "own" ? null : TPLBY[T.sel];
    const scored = !isNew && X && X.c.students.some((s) => { const r = rowOf(X.a, s); return (r.pts || []).some((p) => p != null) || (Array.isArray(r.x) && r.x.some((y) => Array.isArray(y) && y.some((z) => z != null))); });
    const changing = !isNew && X && (T.sel === "own" || T.sel !== X.L.tpl);
    return `<div class="ly-pvh"><h2>${isNew ? `<i class="sm-dot loyiha"></i> Yangi Loyiha ishi` : "Shablon / mezonlar"}</h2><button type="button" class="btn btn-sm" data-ly="close" aria-label="Yopish">${bi("x-lg")}</button></div>
      ${isNew ? `<div class="hrow"><label class="f sp">Sana<input class="form-control" type="date" id="ly-nd" data-ly="nd" value="${T.date}"></label></div>` : ""}
      <input class="form-control ly-srch" data-ly="tq" type="search" placeholder="Shablon qidirish: fan, sinf…" value="${esc(T.q || "")}" aria-label="Shablon qidirish">
      ${sug.length ? `<span class="ly-lbl">${esc(c.subject || "Fan")} uchun</span><div class="ly-tpl">${sug.map(card).join("")}</div>` : ""}
      ${rest.length ? (showRest ? `<span class="ly-lbl">${sug.length ? "Boshqa fanlar" : "Rasmiy shablonlar"}</span><div class="ly-tpl">${rest.map(card).join("")}</div>` : `<button type="button" class="ly-lnk" data-ly="tplall">Boshqa fanlar shablonlari (${rest.length}) ▾</button>`) : ""}
      <div class="ly-tpl"><button type="button" class="ly-tp ${T.sel === "own" ? "on" : ""}" data-ly="pick" data-v="own"><b>${bi("pencil")} O'zim tuzaman</b><small>Mezonlar, ballar va baholash usulini o'zingiz kiritasiz</small></button></div>
      ${sel ? `<div class="ly-prev"><b>${esc(sel.title)}</b>${sel.subj.map((sb) => `${sel.subj.length > 1 ? `<span class="ly-lbl">${esc(sb.n)}</span>` : ""}${sb.crit.map((cr, k) => `<div class="pr"><span class="ly-cnum">${k + 1}</span><span class="n">${esc(cr.n)}</span><span class="ly-uz u-${cr.k}">${USUL[cr.k]}</span><span class="m">${nf(cr.m)}</span></div>`).join("")}`).join("")}
        ${sel.subj.length > 1 ? `<span class="muted small">Har fanga alohida ${sel.max} ball; «Umumiy»ga jurnal faniga mosi yoziladi (keyin almashtirish mumkin).</span>` : ""}${sel.max === 30 ? `<span class="muted small">30 ballik loyiha: chorakda BSB 20 ball bo'lishi kerak (BSB + Loyiha = 50).</span>` : ""}</div>` : ""}
      ${T.sel === "own" ? `<div class="ly-ed"><div class="hrow"><span class="ly-lbl">Maksimal ball</span><div class="seg">${[50, 30].map((v) => `<button type="button" data-ly="omax" data-v="${v}" class="${T.max === v ? "on" : ""}">${v}</button>`).join("")}</div><span class="${osum === T.max ? "ok" : "bad"} ly-osum">yig'indi ${nf(osum)} / ${T.max}</span></div>
        ${own.map((r, k) => `<div class="ly-edr"><input class="form-control" data-ly="on" data-i="${k}" value="${esc(r.n)}" placeholder="${k + 1}-mezon nomi" aria-label="${k + 1}-mezon nomi"><input class="form-control" type="number" min="0.5" step="0.5" data-ly="om" data-i="${k}" value="${r.m}" aria-label="Ball"><select class="form-select" data-ly="ok" data-i="${k}" aria-label="Usul">${["dr", "or", "hy", "sn"].map((u) => `<option value="${u}" ${r.k === u ? "selected" : ""}>${USUL[u]}</option>`).join("")}</select><button type="button" class="ly-rm" data-ly="orm" data-i="${k}" aria-label="O'chirish" ${own.length > 1 ? "" : "disabled"}>${bi("x-lg")}</button>
          ${r.k !== "sn" ? `<span class="ly-edh">${esc(critHint(autoCrit(r)))}</span>` : ""}</div>`).join("")}
        <button type="button" class="btn btn-sm" data-ly="oadd" style="align-self:flex-start" ${own.length >= 30 ? "disabled" : ""}>${bi("plus-lg")} Mezon qo'shish</button></div>` : ""}
      ${changing && scored ? `<div class="ly-warn">${bi("exclamation-triangle")} Bu ishga ball qo'yilgan. Shablon almashtirilsa, mezon ballari o'chadi («Umumiy»dagi jami ball qoladi; ↶ bilan qaytarish mumkin).</div>` : ""}
      <div class="hrow"><span class="sp"></span><button type="button" class="btn" data-ly="close">Bekor qilish</button><button type="button" class="btn btn-primary ${changing && scored ? "ly-dng" : ""}" data-ly="apply" ${T.sel === "own" && osum !== T.max ? "disabled" : ""}>${isNew ? "Yaratish" : changing && scored ? "Almashtirish" : "Qo'llash"}</button></div>`;
  }
  // «＋ Yangi» (summativ.js shu yerga yo'naltiradi)
  function newDialog(c) {
    const q = quarterOf(todayIso()) || [1, 2, 3, 4].find(qRange) || 1, rg = qRange(q) || [todayIso(), todayIso()], td = todayIso();
    const sug = TPL.filter((t) => fanMatch(c, t)).sort((a, b) => gradeMatch(c, b) - gradeMatch(c, a));
    S.lyp = null; S.lyd = {mode: "new", sel: sug.length ? sug[0].id : "own", q: "", all: false, own: [{n: "", m: 10, k: "dr"}], max: 50, date: rg[0] <= td && td <= rg[1] ? td : rg[0]};
    drawDlg();
  }

  /* ── amallar ── */
  function createWork(c, d, t) {
    if (!d) { toast("Sanani tanlang"); return null; }
    if (!quarterOf(d)) { toast(`${fmt(d)} biror chorakka kirmaydi — «Sozlamalar → Dars kunlari va choraklar»da choraklarni belgilang`); return null; }
    if (ARX.dateLocked(d, c)) { ARX.deny(quarterOf(d)); return null; }
    reviveWork(c, "loyiha", d);
    const w = {id: newWorkId(c), type: "loyiha", date: d, max: t.max, title: ""};
    c.works.push(w); workAnalysis(c, w);
    const a = SMV.anOf(c, w); if (!a) return null;
    a.w = w.id; a.rows = {}; setTpl(c, w, a, t);
    return w;
  }
  function chosenTpl() {
    const T = S.lyd;
    if (T.sel !== "own") return TPLBY[T.sel];
    const crit = T.own.map(autoCrit);
    return {id: "", title: `${D.classes[S.ci].subject || "Loyiha ishi"} · o'zim tuzgan mezonlar`, src: "", max: T.max, subj: [{n: D.classes[S.ci].subject || "Loyiha ishi", crit}]};
  }
  function apply() {
    const T = S.lyd, c = D.classes[S.ci], t = chosenTpl(); if (!t) return;
    if (T.mode === "new") {
      const w = createWork(c, T.date, t); if (!w) return;
      S.smw = w.id; S.lyd = null; S.lysj = 0; S.lyf = "all"; S.lysort = null; S.lystu = 0; save(); render(); drawDlg(); toast(`${SMV.wname(c, w)} yaratildi`); return;
    }
    const X = ctx(); if (!X) return;
    if (T.sel !== "own" && T.sel === X.L.tpl) { S.lyd = null; drawDlg(); return; }
    if (!begin(X, "shablon almashtirildi")) return;
    setTpl(X.c, X.w, X.a, t); S.lysj = 0; TX = null; S.lyd = null; S.lysort = null; done(X); toast("Shablon qo'llandi: " + t.title);
  }
  function advance(X, step) {
    const adv = S.lyadv || "stu", P = S.lyp;
    if (adv === "mez" || (adv === "stu" && step === "mez")) { if (P.c < X.crit.length - 1) { P.c++; P.lv = null; return; } }
    if (adv === "stu" || adv === "mez") navStu(X, 1, adv === "mez");
  }
  function navStu(X, d, first) {
    const vr = visRows(X).filter((i) => isIn(X.a, X.c.students[i])); if (!vr.length) return;
    let k = vr.indexOf(S.lyp.r); if (k < 0) k = d > 0 ? -1 : 0;
    S.lyp.r = vr[(k + d + vr.length) % vr.length]; S.lyp.lv = null; if (first) S.lyp.c = 0;
  }
  // bitta katak: qiymat yozish (oyna ichida — keyingisiga o'tish)
  function setCell(X, i, ci, val, label2, fromPop) {
    const s = X.c.students[i]; if (!s) return;
    if (!begin(X, `${s.name.split(" ")[0]} · ${X.crit[ci].n}`)) return;
    put(X, s, X.j, ci, val, false);
    if (fromPop && S.lyp) { S.lyp.lv = null; const c = X.crit[ci]; if (c.k !== "bn" && c.k !== "xt") advance(X); }
    done(X);
  }
  function txApply(X) {
    const T = S.lyd, {out, skip} = txTargets(X);
    if (!begin(X, "taxminiy ball")) return;
    let n = 0; const near = [], imp = [];
    for (const i of out) {
      const s = X.c.students[i], raw = rawRow(X, s, X.j), E = emOf(X, s, X.j), e = estimate(X.crit, raw, E, T.m, T.who, T.near, s.name);
      if (!e) { imp.push(i); continue; }
      e.cells.forEach((v, ci) => { if (v != null) put(X, s, X.j, ci, v, true); }); n++;
      if (e.sum !== E) near.push([i, E, e.sum]);
    }
    TX = {aid: X.a.id, j: X.j, n, near, imp, skip: skip.length}; S.lyd = null; done(X); toast(`${n} ta o'quvchiga taxminiy ball kiritildi`);
  }
  function txFix(X) {
    if (!begin(X, "moslash")) return; let n = 0;
    for (const i of fixRows(X)) {
      const s = X.c.students[i], es = estSet(X, s, X.j), raw = rawRow(X, s, X.j), keep = X.crit.map((_, k) => es.has(k) ? -1 : k).filter((k) => k >= 0);
      const e = estimate(X.crit, raw, emOf(X, s, X.j), "tabiiy", "hammasi", true, s.name + "#", keep); if (!e) continue;
      e.cells.forEach((v, k) => { if (v != null) put(X, s, X.j, k, v, true); }); n++;
    }
    done(X); toast(`${n} ta qator eMaktab baliga moslandi`);
  }
  function copyGo(X) {
    const pick = S.lyd.pick; let n = 0, skip = 0;
    for (const ci of pick) {
      const c2 = D.classes[ci]; if (!c2) continue;
      let w2 = c2.works.find((w) => w.type === "loyiha" && w.date === X.w.date);
      if (w2) {
        const a2 = SMV.anOf(c2, w2) || (workAnalysis(c2, w2), SMV.anOf(c2, w2));
        const scored = a2 && Object.values(a2.rows || {}).some((r) => r && ((r.pts || []).some((p) => p != null)));
        if (!a2 || scored || ARX.scoreLocked(c2, w2.id)) { skip++; continue; }
        a2.w = w2.id; setTpl(c2, w2, a2, X.L);
      } else if (!createWork(c2, X.w.date, X.L)) { skip++; continue; }
      n++;
    }
    S.lyd = null; save(); redraw(); toast(`${n} ta sinfga mezonlar nusxalandi${skip ? ` · ${skip} tasida ball bor yoki arxivda — tegilmadi` : ""}`);
  }

  /* ── hodisalar (bitta joyda: sahifa softRender bilan yangilanganda ham ishlaydi) ── */
  const active = () => S.page === "journal" && S.jpage === "sm" && S.smt === "loyiha";
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-ly]"); if (!el || !el.closest(".ly, #ly-ov") || !active()) return;
    const a = el.dataset.ly, X = ctx(), i = +el.dataset.r, ci = +el.dataset.c;
    if (!X && !(S.lyd && ["new"].includes(S.lyd.mode)) && !["close"].includes(a)) return;
    const s = X && X.c.students[i];
    switch (a) {
      case "close": closeDlg(); break;
      case "undo": undo(); break;
      case "view": S.lyv = el.dataset.v; redraw(); break;
      case "flt": S.lyf = el.dataset.v; redraw(); break;
      case "sort": S.lysort = el.dataset.v || null; if (S.lyd && S.lyd.mode === "col") S.lyd = null; redraw(); break;
      case "mzt": S.lymz = !S.lymz; redraw(); break;
      case "gdmz": S.lymz = true; redraw(); break;
      case "gdoff": (S.lygd = S.lygd || {})[X.a.id] = true; redraw(); break;
      case "sj": S.lysj = +el.dataset.i; S.lyf = "all"; if (S.lyd && S.lyd.mode === "tx") S.lyd = null; redraw(); break;
      case "out": { if (!begin(X, "«Umumiy» fani")) return; X.L.out = (X.L.out + 1) % X.L.subj.length; X.a.ly = X.L; syncA(X.c, X.a, X.L); done(X); toast(`«Umumiy»ga endi ${X.L.subj[X.L.out].n} bali yoziladi`); break; }
      case "teamb": S.lyteam = !S.lyteam; redraw(); break;
      case "cell": S.lyd = null; S.lyp = {r: i, c: ci, lv: null}; drawDlg(); break;
      case "colm": S.lyp = null; S.lyd = {mode: "col", c: ci}; drawDlg(); break;
      case "mz": S.lyp.c = ci; S.lyp.lv = null; drawDlg(); break;
      case "adv": S.lyadv = el.dataset.v; drawDlg(); break;
      case "nav": navStu(X, +el.dataset.d); drawDlg(); break;
      case "set": setCell(X, i, ci, +el.dataset.v, "", !!el.closest("#ly-ov")); break;
      case "lv": if (S.lyp && el.closest("#ly-ov")) { S.lyp.lv = +el.dataset.l; drawDlg(); } else { const l = X.crit[ci].lv[+el.dataset.l]; const cur = rawRow(X, s, X.j)[ci]; if (!(cur >= l.lo && cur <= l.hi)) setCell(X, i, ci, l.hi); } break;
      case "band": { const c = X.crit[ci], cur = rawRow(X, s, X.j)[ci], arr = Array.isArray(cur) ? cur.slice() : c.b.map(() => null); arr[+el.dataset.b] = +el.dataset.v; setCell(X, i, ci, arr); break; }
      case "bandall": setCell(X, i, ci, X.crit[ci].b.map((b) => b.m)); break;
      case "xe": { const c = X.crit[ci], cur = rawRow(X, s, X.j)[ci], e2 = Math.max(0, Math.min(30, (cur ? cur.e : -1) + +el.dataset.d)); setCell(X, i, ci, {e: e2, v: xtRange(c, e2)[3]}); break; }
      case "xv": { const cur = rawRow(X, s, X.j)[ci]; setCell(X, i, ci, {e: cur ? cur.e : 0, v: +el.dataset.v}); break; }
      case "clr": { const P = S.lyp; if (!begin(X, "tozalash")) return; put(X, X.c.students[P.r], X.j, P.c, null); P.lv = null; done(X); break; }
      case "teamset": {
        const P = S.lyp, T = teamOf(X, P.r), v = rawRow(X, X.c.students[P.r], X.j)[P.c]; if (!begin(X, `${T}-jamoa · ${X.crit[P.c].n}`)) return; let n = 0;
        X.c.students.forEach((s2, k) => { if (k === P.r || !isIn(X.a, s2) || teamOf(X, k) !== T) return; put(X, s2, X.j, P.c, v); n++; });
        done(X); toast(`${T}-jamoa: yana ${n} o'quvchiga ${nf(cval(X.crit[P.c], v))} qo'yildi`); break;
      }
      case "absr": { if (!begin(X, `${s.name.split(" ")[0]} — qatnashmagan`)) return; edit(X.a, s).in = false; if (S.lyp) navStu(X, 1); if (S.lyp && S.lyp.r === i) S.lyp = null; done(X); toast(`${s.name.split(" ")[0]} — qatnashmagan`); break; }
      case "unabs": if (!begin(X, "qatnashdi")) return; edit(X.a, s).in = true; done(X); break;
      case "gostu": S.lystu = i; S.lyv = "k"; S.lyf = "all"; redraw(); break;
      case "stu": { const vr = visRows(X), k = vr.indexOf(S.lystu); S.lystu = vr[(k + +el.dataset.d + vr.length) % vr.length] ?? S.lystu; redraw(); document.querySelector(".ly-stuh")?.scrollIntoView({block: "nearest"}); break; }
      case "colfill": {
        const k = S.lyd.c, c = X.crit[k], v = +el.dataset.v; if (!begin(X, `${c.n} — bo'sh kataklar`)) return; let n = 0;
        X.c.students.forEach((s2) => { if (!isIn(X.a, s2) || cfull(c, rawRow(X, s2, X.j)[k])) return; put(X, s2, X.j, k, c.k === "bn" ? c.b.map((b) => b.m) : v); n++; });
        S.lyd = null; done(X); toast(`${n} ta bo'sh katakka ${c.k === "bn" ? "to'liq ball" : nf(v)} qo'yildi · ↶ bilan qaytariladi`); break;
      }
      case "colclr": {
        const k = S.lyd.c, c = X.crit[k]; if (!begin(X, `${c.n} ustuni tozalandi`)) return; let n = 0;
        X.c.students.forEach((s2) => { if (rawRow(X, s2, X.j)[k] == null) return; put(X, s2, X.j, k, null); n++; });
        S.lyd = null; done(X); toast(`${n} ta katak tozalandi · ↶ bilan qaytariladi`); break;
      }
      case "txo": S.lyp = null; S.lyd = {mode: "tx", m: "tabiiy", who: "bosh", near: true}; drawDlg(); break;
      case "txm": S.lyd.m = el.dataset.v; drawDlg(); break;
      case "txw": S.lyd.who = el.dataset.v; drawDlg(); break;
      case "txgo": txApply(X); break;
      case "fix": txFix(X); break;
      case "txhide": TX = null; redraw(); break;
      case "rub": S.lyp = null; S.lyd = {mode: "rub"}; drawDlg(); break;
      case "rubp": printDoc(`<style>.ly-paper{font:14px/1.45 sans-serif;color:#000}.ly-pph{display:flex;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:8px}.ly-pps{font-weight:800;margin:10px 0 4px}.ly-rub{padding-left:20px}.ly-rub>li{margin-bottom:8px;break-inside:avoid}.rh{display:flex;justify-content:space-between;font-weight:700}.ly-rub ul{margin:3px 0 0;padding-left:16px;font-size:13px}.ly-ppf{margin-top:10px;font-size:12px;border-top:1px dashed #999;padding-top:6px}</style>${rubPaper(X)}`, false, false, `Mezonlar_${label(X.c)}_${SMV.wname(X.c, X.w)}`.replace(/[^\p{L}\p{N}_-]+/gu, "_")); break;
      case "exp": { const B = baFrom(X.a); B.kind = "Loyiha ishi"; B.title = SMV.wname(X.c, X.w); B.wid = X.w.id; B.date = X.w.date; baExportDialog(X.c, B); break; }
      case "copy": S.lyp = null; S.lyd = {mode: "copy", pick: []}; drawDlg(); break;
      case "cpk": { const k = +el.dataset.i, P = S.lyd.pick; S.lyd.pick = P.includes(k) ? P.filter((x) => x !== k) : P.concat(k); drawDlg(); break; }
      case "cpgo": copyGo(X); break;
      case "date": S.lyp = null; S.lyd = {mode: "date"}; drawDlg(); break;
      case "dateok": {
        const d = $("#ly-date").value; if (!d) { toast("Sanani tanlang"); return; }
        if (d !== X.w.date) { if (!quarterOf(d)) { toast(`${fmt(d)} biror chorakka kirmaydi`); return; } if (ARX.dateLocked(d, X.c) || ARX.dateLocked(X.w.date, X.c)) { ARX.deny(quarterOf(ARX.dateLocked(d, X.c) ? d : X.w.date)); return; } X.w.date = d; X.a.date = d; }
        S.lyd = null; save(); render(); drawDlg(); toast("Saqlandi"); break;
      }
      case "tpl": S.lyp = null; S.lyd = {mode: "tpl", sel: X.L.tpl || "own", q: "", all: false, own: X.L.legacy || !X.L.tpl ? X.sub.crit.map((c) => ({n: c.n, m: c.m, k: ["hy", "dr", "or", "sn"].includes(c.k) ? c.k : "sn"})) : [{n: "", m: 10, k: "dr"}], max: X.L.legacy ? (X.L.max === 30 ? 30 : 50) : X.L.max === 30 ? 30 : 50}; drawDlg(); break;
      case "pick": S.lyd.sel = el.dataset.v; drawDlg(); break;
      case "tplall": S.lyd.all = true; drawDlg(); break;
      case "omax": S.lyd.max = +el.dataset.v; drawDlg(); break;
      case "oadd": S.lyd.own.push({n: "", m: 5, k: "dr"}); drawDlg(); break;
      case "orm": S.lyd.own.splice(+el.dataset.i, 1); drawDlg(); break;
      case "apply": apply(); break;
      case "nq": { const w2 = el.dataset.v, cur = rowOf(X.a, s).nt || ""; if (cur.toLowerCase().includes(w2.toLowerCase())) return; edit(X.a, s).nt = (cur ? cur + ", " + w2.toLowerCase() : w2).slice(0, 300); savedAt = new Date(); save(); redraw(); break; }
    }
  });
  document.addEventListener("change", (e) => {
    const el = e.target, a = el.dataset && el.dataset.ly; if (!a || !el.closest(".ly, #ly-ov") || !active()) return;
    const X = ctx(), i = +el.dataset.r, s = X && X.c.students[i];
    if (a === "ish" && X) { if (!begin(X, el.checked ? "qatnashdi" : `${s.name.split(" ")[0]} — qatnashmagan`)) { el.checked = !el.checked; return; } edit(X.a, s).in = el.checked; done(X); }
    else if (a === "team" && X) { edit(X.a, s).tm = Math.max(1, Math.min(9, +el.value || 1)); save(); redraw(); }
    else if (a === "stusel") { S.lystu = +el.value; redraw(); }
    else if (a === "om") { S.lyd.own[+el.dataset.i].m = Math.max(0.5, Math.round((parseFloat(String(el.value).replace(",", ".")) || 1) * 2) / 2); drawDlg(); }
    else if (a === "ok") { S.lyd.own[+el.dataset.i].k = el.value; drawDlg(); }
    else if (a === "txnear") { S.lyd.near = el.checked; drawDlg(); }
    else if (a === "nd") S.lyd.date = el.value;
    else if (a === "note") { savedAt = new Date(); save(); redraw(); }
    else if (a === "snv" && X) { const c = X.crit[+el.dataset.c], v = parseFloat(String(el.value).replace(",", ".")); setCell(X, i, +el.dataset.c, isFinite(v) ? nearest(optsOf(c), Math.max(0, Math.min(c.m, v))) : null, "", !!el.closest("#ly-ov")); }
  });
  let noteT = null;
  document.addEventListener("input", (e) => {
    const el = e.target, a = el.dataset && el.dataset.ly; if (!a || !el.closest(".ly, #ly-ov") || !active()) return;
    if (a === "tq") { S.lyd.q = el.value; drawDlg(); }
    else if (a === "on") S.lyd.own[+el.dataset.i].n = el.value;
    else if (a === "note") {
      const X = ctx(); if (!X) return; const s = X.c.students[+el.dataset.r], v = el.value.slice(0, 300);
      if (v.trim()) edit(X.a, s).nt = v; else if (X.a.rows[s.name]) delete X.a.rows[s.name].nt;
      clearTimeout(noteT); noteT = setTimeout(() => { savedAt = new Date(); save(); }, 400);
    }
  });
  // klaviatura: Ctrl+Z — shu sahifaning bekor qilishi; tanlangan katakka raqam yozish; baholash oynasida 1–9, strelkalar, Del
  let typeBuf = "", typeT = null;
  const focusCell = (r, c) => { const b = document.querySelector(`.ly button.ly-sc[data-r="${r}"][data-c="${c}"]`); if (b) b.focus(); return b; };
  function moveFocus(b, dr, dc) {
    const tr = b.closest("tr"), td = b.closest("td"), cells = [...tr.querySelectorAll("button.ly-sc")], k = cells.indexOf(b);
    if (dc) { const nb = cells[k + dc]; if (nb) nb.focus(); return; }
    let t = tr; do { t = dr > 0 ? t.nextElementSibling : t.previousElementSibling; } while (t && !t.querySelector("button.ly-sc"));
    if (t) { const nb = t.querySelectorAll("button.ly-sc")[k]; if (nb) nb.focus(); }
    void td;
  }
  window.addEventListener("keydown", (e) => {
    if (!active()) return;
    const t = e.target, typing = t && t.matches && t.matches("input, textarea, select");
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !typing && !document.querySelector(".modal:not(#ly-ov)")) { e.preventDefault(); e.stopImmediatePropagation(); undo(); return; }
    if (document.querySelector(".modal:not(#ly-ov)") || e.ctrlKey || e.metaKey || e.altKey) return;
    const X = ctx(); if (!X) return;
    const b = document.activeElement;
    if (!S.lyp && !S.lyd && b && b.matches && b.matches(".ly button.ly-sc")) {
      const r = +b.dataset.r, c = +b.dataset.c, cr = X.crit[c], s = X.c.students[r];
      const mv = {ArrowDown: [1, 0], ArrowUp: [-1, 0], ArrowRight: [0, 1], ArrowLeft: [0, -1]}[e.key];
      if (mv) { moveFocus(b, ...mv); e.preventDefault(); return; }
      if ((e.key === "Delete" || e.key === "Backspace") && rawRow(X, s, X.j)[c] != null) { e.preventDefault(); if (!begin(X, "tozalash")) return; put(X, s, X.j, c, null); done(X); focusCell(r, c); return; }
      if (/^[0-9]$/.test(e.key) && ["hy", "dr", "or", "sn"].includes(cr.k)) {
        e.preventDefault(); typeBuf += e.key; clearTimeout(typeT);
        const want = +typeBuf, opts = optsOf(cr), ok = opts.includes(want);
        const commit = () => { const tg = ok ? want : nearest(opts, want); typeBuf = ""; setCell(X, r, c, tg); if (!ok) toast(`${want} bu mezonda yo'q → ${nf(tg)} qo'yildi`); const nb = focusCell(r, c); if (nb) moveFocus(nb, 1, 0); };
        if (opts.some((v) => v !== want && String(v).startsWith(typeBuf))) typeT = setTimeout(commit, 650); else commit();
      }
      return;
    }
    if (!S.lyp || typing) return;
    const n = X.crit.length;
    if (e.key === "ArrowRight") { navStu(X, 1); drawDlg(); e.preventDefault(); }
    else if (e.key === "ArrowLeft") { navStu(X, -1); drawDlg(); e.preventDefault(); }
    else if (e.key === "ArrowDown") { S.lyp.c = (S.lyp.c + 1) % n; S.lyp.lv = null; drawDlg(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { S.lyp.c = (S.lyp.c - 1 + n) % n; S.lyp.lv = null; drawDlg(); e.preventDefault(); }
    else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); if (!begin(X, "tozalash")) return; put(X, X.c.students[S.lyp.r], X.j, S.lyp.c, null); S.lyp.lv = null; done(X); }
    else if (/^[1-9]$/.test(e.key)) { const kb = document.querySelector(`#ly-ov [data-k="${e.key}"]`); if (kb) { kb.click(); e.preventDefault(); } }
  }, true);

  return {page, newDialog, TPL, optsOf, estimate, cval, stotal, lyOf, active};
})();
