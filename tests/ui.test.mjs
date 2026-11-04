// Brauzerda tutun testi: ilova kompyuter va telefon ekranida ochiladi, hamma sahifalar xatosiz chiziladi.
// Ishga tushirish: npx playwright install chromium && node --test tests/ui.test.mjs
import {test} from "node:test";
import assert from "node:assert/strict";
import {fileURLToPath} from "node:url";
import {chromium} from "playwright";

const APP = new URL("../docs/index.html", import.meta.url).href;
const FIXTURE = fileURLToPath(new URL("fixtures/journal.json", import.meta.url));

for (const [name, viewport] of [["kompyuter", {width: 1440, height: 900}], ["telefon", {width: 390, height: 844}]]) {
  test(`${name}: hamma sahifalar xatosiz ochiladi`, async () => {
    const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
    try {
      const page = await browser.newPage({viewport});
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("dialog", (d) => d.accept());
      const nav = (k) => page.click(`${name === "telefon" ? ".tabbar" : ".side"} [data-go=${k}]`);
      await page.clock.setFixedTime(new Date(2026, 9, 20, 10, 0));   // chorak ichidagi kun: test sanaga bog'liq bo'lmasin
      await page.goto(APP);
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
      await chooser.setFiles(FIXTURE);
      await page.waitForSelector("text=Xayrli");
      await nav("journal");
      // ko'rinish: kompyuterda chap panelda, telefonda jurnal tepasida
      await page.click("[data-per]"); await page.click(".perpop [data-mode=week]");
      assert.equal(await page.evaluate(() => V.mode), "week");
      await page.click("[data-per]"); await page.click(".perpop [data-mode=month]");
      await page.click("[data-jp=sum]"); await page.waitForSelector("table.sum");
      await page.click("[data-jp=year]"); await page.waitForSelector("table.sum");
      await page.click("[data-jp=j]"); await page.click('td.nm[data-st="0"]');
      for (const t of ["grow", "notes", "msg", "sum"]) await page.click(`.modal [data-tab=${t}]`);
      await page.click(".modal [data-x]");
      await nav("reports");
      // hisobot turi: kompyuterda chap ro'yxatdan, telefonda «Almashtirish» oynasidan (hisobotlar.js)
      for (const k of ["att", "stats", "ready", "cmp", "blank", "cls"]) {
        if (name === "telefon") { await page.click("[data-hk=kind]"); await page.click(`.modal [data-kind=${k}]`); } else await page.click(`[data-kind=${k}]`);
      }
      await nav("settings");
      // telefonda bo'lim o'z sahifasida ochiladi — «‹ Sozlamalar» bilan ro'yxatga qaytiladi (sozlamalar.js)
      for (let i = 0; i < 7; i++) { if (await page.$("[data-szhome]")) await page.click("[data-szhome]"); await page.click(`[data-sec="${i}"]`); }
      await nav("today");
      const start = await page.$("[data-start]");
      if (start) { await start.click(); await page.click("[data-next]"); await page.click("[data-next]"); await page.click("[data-next]"); }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.deepEqual(errors, [], "sahifada JavaScript xatosi");
      assert.ok(overflow <= 1, `sahifa ekrandan ${overflow}px kengroq`);
    } finally { await browser.close(); }
  });
}

test("o'quvchini faolsizlantirish va qayta faollashtirish", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    const names = () => page.evaluate(() => D.classes[1].students.map((s) => s.name));
    const before = await names(), gone = [before[0], before[2]];
    const marks = await page.evaluate(() => JSON.stringify(D.classes[1].students[0].marks));
    await page.click(".tabbar [data-go=settings]"); await page.click('[data-sec="0"]');
    // telefonda sinf qatori menyu ochadi: «＋ O'quvchi qo'shish», «⏸ Faolsiz o'quvchilar», …
    await page.click('[data-a=cmore][data-i="1"]'); await page.click('.modal [data-mi="1"]');
    await page.check('[data-rm="0"]'); await page.check('[data-rm="2"]');
    await page.click(".modal [data-ok]");
    assert.deepEqual(await names(), before.filter((n) => !gone.includes(n)), "jurnaldan yashirildi");
    // hisobot va xavf ro'yxatida ham yo'q
    const inReport = await page.evaluate((g) => { const c = D.classes[1], [lo, hi, q] = periodNow(); return reportRows(c, lo, hi, q).rows.some((r) => g.includes(r.name)); }, gone);
    assert.equal(inReport, false, "hisobotda ko'rinmasligi kerak");
    await page.click(".tabbar [data-go=journal]"); await page.click("[data-cpick]"); await page.click('.modal [data-pci="1"]');
    assert.equal(await page.locator(`td.nm:has-text("${gone[0]}")`).count(), 0);
    // qayta faollashtirish: o'z joyiga, baholari bilan
    await page.evaluate(() => studentsDialog(1));
    await page.click('.modal [data-on="1"]'); await page.click('.modal [data-x]');
    await page.evaluate(() => studentsDialog(1));
    await page.click('.modal [data-on="0"]'); await page.click('.modal [data-x]');
    assert.deepEqual(await names(), before, "tartib tiklandi");
    assert.equal(await page.evaluate(() => JSON.stringify(D.classes[1].students[0].marks)), marks, "baholar saqlangan");
    // Ctrl+Z ham qaytaradi
    await page.evaluate(() => { deactivate(D.classes[1], [3]); undoLast(); });
    assert.deepEqual(await names(), before);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("o'quvchi boshqa fanlarda ham faolsizlantiriladi", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    const has = (ci, n) => page.evaluate(([ci, n]) => D.classes[ci].students.some((s) => s.name === n), [ci, n]);
    const nm = "Rahimova Nilufar", ai = await page.evaluate((n) => D.classes[2].students.findIndex((s) => s.name === n), nm);
    // dialog: «Boshqa fanlarda ham» belgisi chiqadi (9-A Geometriya)
    await page.evaluate(() => { studentsDialog(2); });
    assert.equal(await page.locator(".modal #oth").isVisible(), false);
    await page.check(`[data-rm="${ai}"]`);
    assert.equal(await page.locator(".modal #oth").isVisible(), true);
    assert.equal(await page.textContent(".modal #othl"), "Geometriya");
    await page.click(".modal [data-ok]");
    assert.equal(await has(2, nm), false); assert.equal(await has(3, nm), false, "Geometriyada ham faolsiz");
    assert.equal(await has(1, nm), true, "boshqa sinf (7-G) o'zgarmaydi");
    // bitta ↶ ikkala fanda qaytaradi
    await page.evaluate(() => { undoLast(); });
    assert.equal(await has(2, nm), true); assert.equal(await has(3, nm), true);
    // belgi olib tashlansa — faqat shu fanda
    await page.evaluate(() => { studentsDialog(2); });
    await page.check(`[data-rm="${ai}"]`); await page.uncheck(".modal #othc"); await page.click(".modal [data-ok]");
    assert.equal(await has(2, nm), false); assert.equal(await has(3, nm), true);
    // faollashtirishda boshqa fan so'raladi
    await page.evaluate(() => { deactivate(D.classes[3], [D.classes[3].students.findIndex((s) => s.name === "Rahimova Nilufar")]); studentsDialog(2); });
    await page.click('.modal [data-on="0"]');
    await page.click(".modal [data-ok]");
    assert.equal(await has(2, nm), true); assert.equal(await has(3, nm), true, "Geometriyada ham faollashdi");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("hisobotlar chop etilganda bitta varaqqa sig'adi", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1440, height: 900}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    // katta sinf: 40 o'quvchi, uzun izohlar bilan
    await page.evaluate(() => { const c = D.classes[0]; for (let i = c.students.length; i < 40; i++) c.students.push({name: `Qo'shimcha O'quvchi Familiyasi ${i}`, marks: {}, scores: {}}); save(); });
    await page.click(".side [data-go=reports]");
    const pages = async () => { await page.evaluate(() => fitPrint()); await page.emulateMedia({media: "print"});
      const pdf = await page.pdf({preferCSSPageSize: true}); await page.emulateMedia({media: "screen"});
      return (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length; };
    for (const k of ["cls", "ready", "cmp", "blank"]) {
      await page.click(`[data-kind=${k}]`);
      assert.equal(await pages(), 1, `${k}: bitta varaq bo'lishi kerak`);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("emaktab.uz saytidan xatcho'p orqali import", async () => {
  const {readFile} = await import("node:fs/promises");
  const XLSX = (await import("xlsx")).default;
  const docs = fileURLToPath(new URL("../docs/", import.meta.url));
  const rows = JSON.parse(await readFile(fileURLToPath(new URL("inputs.json", import.meta.url)), "utf8")).emaktab[0].rows;
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Matematika");
  const xls = XLSX.write(wb, {type: "buffer", bookType: "xls"});
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const ctx = await browser.newContext({serviceWorkers: "block"});
    const asked = [];
    await ctx.route("https://app.test/**", async (r) => {
      const p = new URL(r.request().url()).pathname.slice(1) || "index.html";
      try { r.fulfill({body: await readFile(docs + p), contentType: p.endsWith(".html") ? "text/html" : p.endsWith(".js") ? "text/javascript" : undefined}); } catch { r.fulfill({status: 404}); }
    });
    await ctx.route("https://schools.emaktab.uz/**", (r) => {
      const u = new URL(r.request().url()); asked.push(u.pathname + u.search);
      if (u.pathname === "/v2/myclasses") return r.fulfill({contentType: "text/html", body: `<html><body><a href="/v2/class?class=9">Boshqa menyu</a>
        <div id="ContentPanelTeacher"><a href="/v2/class?class=1">7-B</a><a href="/v2/journal/school/11/group/22/subject/33" title="Matematika">Matematika</a></div></body></html>`});
      if (u.pathname.startsWith("/v2/journal/")) return r.fulfill({contentType: "text/html", body: `<script>window.__JOURNAL__INITIAL__STATE__ = {"journalHeader":{"currentPeriodId":77,"t":"a \\"}\\" b"}};</script>`});
      if (u.pathname === "/v2/excel") return r.fulfill({contentType: "application/vnd.ms-excel", body: xls});
      return r.fulfill({status: 404});
    });
    const app = await ctx.newPage(); const errors = []; app.on("pageerror", (e) => errors.push(e.message));
    await app.goto("https://app.test/");
    const code = await app.evaluate(() => emkCode());
    assert.match(code, /"https:\/\/app\.test\/"/);
    const emk = await ctx.newPage(); await emk.goto("https://schools.emaktab.uz/v2/myclasses");
    const [pop] = await Promise.all([ctx.waitForEvent("page"), emk.evaluate(code)]);
    pop.on("pageerror", (e) => errors.push(e.message));
    await pop.click(".modal [data-ok]", {timeout: 20000});
    await pop.waitForSelector("text=Import yakunlandi");
    assert.ok(asked.includes("/v2/excel?action=gjsxls&school=11&group=22&subgroup=0&subject=33&period=77"), asked.join(" "));
    assert.ok(!asked.some((a) => a.includes("class=9")));
    const cls = await pop.evaluate(() => D.classes.map((c) => [c.name, c.students.length]));
    assert.deepEqual(cls.map((c) => c[0]), ["7-B"]);
    assert.ok(cls[0][1] >= 3);
    await emk.waitForSelector("text=jurnal yuborildi");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("BSB/CHSB: kech qolgan (KQ) o'quvchiga ball qo'yish", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1440, height: 900}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.clock.setFixedTime(new Date(2026, 9, 20, 10, 0));   // 1-chorak ichidagi kun: chorak arxivi (arxiv.js) qulflamasin
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    await page.evaluate(() => { D.settings.protect.enabled = false; save(); });
    await page.click(".side [data-go=journal]"); await page.click("[data-jp=sum]");
    const cell = await page.$("[data-sc]"); const key = await cell.getAttribute("data-sc");
    const state = () => page.evaluate((k) => { const [si, wid] = k.split("|"), c = D.classes[S.ci], s = c.students[+si], w = c.works.find((x) => x.id === wid);
      return {sc: s.scores[wid], mark: s.marks[w.date] || ""}; }, key);
    const before = await state();
    await page.fill(`[data-sc="${key}"]`, "12 kq"); await page.press(`[data-sc="${key}"]`, "Tab");
    let st = await state();
    assert.equal(st.sc, 12); assert.ok(st.mark.endsWith("kq"), st.mark);
    assert.equal(await page.inputValue(`[data-sc="${key}"]`), "12 KQ");
    await page.fill(`[data-sc="${key}"]`, "12"); await page.press(`[data-sc="${key}"]`, "Tab");
    st = await state(); assert.equal(st.sc, 12); assert.ok(!st.mark.endsWith("kq"));
    await page.evaluate(() => { undoLast(); undoLast(); });
    assert.deepEqual(await state(), before);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("jurnal: KQ katagiga himoya yoqilgan holda ham baho qo'yiladi", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1440, height: 900}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    const r = await page.evaluate(() => {
      const c = D.classes[0], t = todayIso(); D.settings.method_weekday = null; c.extra_x = [];
      if (!c.dates.includes(t)) { c.dates.push(t); c.dates.sort(); }
      D.settings.protect.enabled = true; unlockedUntil = 0; S.ci = 0;
      c.students[0].marks[t] = "kq"; c.students[1].marks[t] = "7";
      putMark(D.classes[0], 0, t, combineMark("kq", "8"));
      putMark(D.classes[0], 1, t, combineMark("7", "9"));
      return [isLocked(), c.students[0].marks[t], c.students[1].marks[t]];
    });
    assert.deepEqual(r, [true, "8kq", "7"], "KQ ga baho qo'shildi, qo'yilgan baho esa himoyalangan");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Tahlil tuzatishlari: Ctrl tugmalari belgi qo'ymaydi, Escape, bir marta saqlash, almashtirishdan oldin nusxa", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1440, height: 900}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    await page.evaluate(() => {
      const c = D.classes[0], t = todayIso(); c.extra_x = []; c.works = c.works.filter((w) => w.date !== t);
      if (!c.dates.includes(t)) { c.dates.push(t); c.dates.sort(); }
      delete c.students[0].marks[t]; S.ci = 0; go("journal"); S.sel = [0, t]; render();
    });
    const mk = () => page.evaluate(() => D.classes[0].students[0].marks[todayIso()] || "");
    // klaviatura bilan belgi qo'yilmaydi: belgi faqat kunlik rejimda
    for (const k of ["Control+c", "c", "8"]) await page.keyboard.press(k);
    assert.equal(await mk(), "");
    // Escape eng ustidagi oynani yopadi, ask() maydonidagi Escape esa faqat o'zini
    await page.evaluate(() => { confirmBox("a", "b"); });
    await page.evaluate(() => { window.__r = "?"; ask("x", "y").then((v) => { window.__r = v; }); });
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".modal").count(), 1); assert.equal(await page.evaluate(() => window.__r), null);
    assert.equal(await page.getAttribute(".modal", "role"), "dialog");
    await page.keyboard.press("Escape"); assert.equal(await page.locator(".modal").count(), 0);
    // ko'p belgi — bitta saqlash
    const n = await page.evaluate(() => {
      let k = 0; const o = Storage.prototype.setItem; Storage.prototype.setItem = function (...a) { if (a[0] === STORE_KEY) k++; return o.apply(this, a); };
      batch(() => { save(); batch(() => save()); save(); }); Storage.prototype.setItem = o; return k;
    });
    assert.equal(n, 1);
    // buzilgan fayl: takroriy sana, nomsiz o'quvchi, null yozuvlar
    const z = await page.evaluate(() => { const d = normalize({classes: [{dates: ["2026-01-02", "2026-01-02", 5], students: [{marks: null}, null]}, null]}); const c = d.classes[0]; return [d.classes.length, c.dates, c.students.length, c.students[0].name, c.name]; });
    assert.deepEqual(z, [1, ["2026-01-02"], 1, "?", "?"]);
    // jurnal almashtirilishidan oldingi holat alohida nusxa bo'lib qoladi
    const snap = await page.evaluate(async () => { for (let i = 0; i < 50 && !IDB.ready; i++) await new Promise((r) => setTimeout(r, 50)); await keepBefore(); const x = await idbReq("snap", "readonly", (st) => st.get(todayIso() + "~")); return !!x && JSON.parse(x.txt).classes.length === D.classes.length; });
    assert.equal(snap, true);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Tavsiyalar: o'quvchi id va bir xil ismlar, to'lovni qaytarish, buzilgan xotira, BSB kunidagi baho", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1440, height: 900}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    // buzilgan localStorage: matn alohida saqlanadi va ogohlantiriladi
    await page.clock.setFixedTime(new Date(2026, 9, 20, 10, 0));   // 1-chorak ichidagi kun: chorak arxivi (arxiv.js) qulflamasin
    await page.goto(APP);
    await page.evaluate(() => { localStorage.setItem(STORE_KEY, "{buzilgan"); indexedDB.deleteDatabase("yoqlama_jurnal"); });
    await page.reload();
    await page.waitForSelector(".toast:has-text('buzilgan')");
    assert.equal(await page.evaluate(() => localStorage.getItem(STORE_KEY + "_buzilgan")), "{buzilgan");
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    const r = await page.evaluate(async () => {
      const d = normalize({classes: [{name: "7-A", students: [{name: "Ali Valiyev"}, {name: "ali  valiyev"}, {name: "Ali Valiyev"}]}]});
      const names = d.classes[0].students.map((s) => s.name), ids = d.classes[0].students.map((s) => s.id);
      // ism o'zgargandan keyin ham tarixdagi baho qaytariladi (doimiy id orqali)
      const c = D.classes[0], s = c.students[0], t = c.dates.find((x) => x <= todayIso() && !isNoLesson(c, x) && !sumOn(c, x));
      D.web.past = "all"; D.settings.protect.enabled = false;
      s.marks[t] = "7"; putMark(c, 0, t, "9", true);
      const e = D.changelog[D.changelog.length - 1]; s.name = s.name + " Qayta";
      const ok = await revertEntry(e);
      return {names, uniq: new Set(ids).size, ok, back: s.marks[t], sid: e.sid === s.id};
    });
    assert.deepEqual(r.names, ["Ali Valiyev", "ali  valiyev (2)", "Ali Valiyev (3)"]);
    assert.equal(r.uniq, 3); assert.equal(r.ok, true); assert.equal(r.back, "7"); assert.equal(r.sid, true);
    // ismni boshqa o'quvchi ismiga o'zgartirib bo'lmaydi
    await page.evaluate(() => { window.__n = D.classes[0].students[1].name; renameStudent(0, 0); });
    await page.fill("#ask", await page.evaluate(() => window.__n)); await page.click(".modal [data-ok]");
    await page.waitForSelector(".toast:has-text('shunday ismli')");
    // BSB kunidagi eski baho FBga kirmaydi
    const fb = await page.evaluate(() => {
      const c = D.classes[0], s = c.students[0], w = c.works.find((x) => x.type === "bsb"), rng = [w.date, w.date];
      s.marks[w.date] = "10"; return formativeGrades(c, s, rng).length;
    });
    assert.equal(fb, 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Yangi dizayn: Ctrl+K buyruqlar oynasi, Alt+raqam, ? tezkor tugmalar, telefonda pastki varaq", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1440, height: 900}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.clock.setFixedTime(new Date(2026, 9, 20, 10, 0));   // chorak ichidagi kun: test sanaga bog'liq bo'lmasin
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    // o'quvchini yozib topish → kartochka ochiladi
    const nm = await page.evaluate(() => D.classes[1].students[2].name);
    await page.keyboard.press("Control+k"); await page.waitForSelector(".modal .cmdl");
    await page.keyboard.type(nm.split(" ")[0]);
    await page.waitForSelector(`.cmdl button.on:has-text("${nm}")`);
    await page.keyboard.press("Enter");
    await page.waitForSelector(`.modal h2:has-text("${nm.split(" ")[0]}")`);
    await page.keyboard.press("Escape"); assert.equal(await page.locator(".modal").count(), 0);
    // sinfga o'tish: ↓ bilan tanlab Enter
    await page.click("[data-cmdk]"); await page.keyboard.type(await page.evaluate(() => label(D.classes[1])));
    await page.keyboard.press("Enter");
    assert.deepEqual(await page.evaluate(() => [S.page, S.ci]), ["journal", 1]);
    // Alt+raqam — bo'limlar
    await page.keyboard.press("Alt+3"); assert.equal(await page.evaluate(() => S.page), "groups");
    await page.keyboard.press("Alt+4"); assert.equal(await page.evaluate(() => S.page), "reports");
    await page.keyboard.press("Alt+1"); assert.equal(await page.evaluate(() => S.page), "today");
    // ? — tezkor tugmalar ro'yxati
    await page.keyboard.press("Shift+Slash"); await page.waitForSelector(".modal .kbdl");
    await page.keyboard.press("Escape");
    // qidiruv maydoniga «?» yozilsa ro'yxat ochilmaydi
    await page.keyboard.press("Alt+2"); await page.focus("#jq"); await page.keyboard.type("?");
    assert.equal(await page.locator(".modal .kbdl").count(), 0);
    // telefonda oynalar pastdan chiqadi (bosh barmoq yetadigan joy)
    await page.setViewportSize({width: 390, height: 844});
    await page.evaluate(() => { confirmBox("Sinov", "matn"); });
    const r = await page.evaluate(() => { const c = $(".modal .card").getBoundingClientRect(); return [Math.round(innerHeight - c.bottom), Math.round(c.width)]; });
    assert.ok(r[0] <= 1 && r[1] >= 389, String(r));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("jurnal: mezon bo'yicha baho (darsdagi ish + uy vazifasi), izoh, «Qolganlarga», toq/juft qatorlar", async () => {
  for (const viewport of [{width: 1440, height: 900}, {width: 390, height: 844}]) {
    const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
    try {
      const page = await browser.newPage({viewport});
      const errors = []; page.on("pageerror", (e) => errors.push(e.message));
      await page.clock.setFixedTime(new Date(2026, 9, 20, 10, 0));
      await page.goto(APP);
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
      await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
      const t = await page.evaluate(() => { const c = D.classes[0], t = todayIso(); D.settings.method_weekday = null; c.extra_x = [];
        if (!c.dates.includes(t)) { c.dates.push(t); c.dates.sort(); } D.settings.protect.enabled = false;
        for (const s of c.students) delete s.marks[t]; S.ci = 0; V.mode = "day"; V.anchor = t; S.view = "journal"; save(); return t; });
      await page.click(`${viewport.width < 600 ? ".tabbar" : ".side"} [data-go=journal]`);
      await page.waitForSelector(".dlist.mz");
      const st = (i) => page.evaluate(([d, i]) => { const s = D.classes[0].students[i]; return [s.marks[d] || "", JSON.stringify((s.fp || {})[d] || null), (s.fc || {})[d] || ""]; }, [t, i]);
      // ikki qism: 5 + 3 = 8; bittasi — chala (baho yo'q)
      await page.click("[data-mzp='0|0|5']");
      assert.deepEqual(await st(0), ["", "[5,null]", ""]);
      assert.ok((await page.textContent('.drow[data-dr="0"] .mz-tot')).includes("uy vazifasi?"));
      await page.click("[data-mzp='0|1|3']");
      assert.deepEqual(await st(0), ["8", "[5,3]", ""]);
      assert.ok((await page.textContent('.drow[data-dr="0"] .mz-tot')).includes("5 + 3"));
      assert.ok((await page.textContent('.drow[data-dr="0"] .mz-hint')).includes("Darsda 5"));
      // kech qolgan: baho bilan birga
      await page.click("[data-a='0|kq']"); assert.equal((await st(0))[0], "8kq");
      await page.click("[data-mzp='0|0|6']"); assert.deepEqual(await st(0), ["9kq", "[6,3]", ""]);
      // izoh va tafsilot
      await page.click("[data-mzb='0']"); await page.fill("#mz-cm", "Guruh ishida faol"); await page.click(".modal [data-ok]");
      assert.equal((await st(0))[2], "Guruh ishida faol");
      assert.ok((await page.textContent('.drow[data-dr="0"]')).includes("izoh"));
      // kelmagan — baho qo'yilmaydi
      await page.click("[data-a='1|s']");
      assert.equal(await page.locator('.drow[data-dr="1"] [data-mzp]').count(), 0);
      // «Qolganlarga 4 ✓» — uy vazifasi hammaga (kelmagan va bahosi borlarga tegmaydi)
      await page.click(`${viewport.width < 600 ? ".mz-top" : ".mz-head"} [data-mzfill="1"]`);
      assert.deepEqual(await st(2), ["", "[null,4]", ""]);
      assert.equal((await st(1))[0], "s");
      assert.deepEqual(await st(0), ["9kq", "[6,3]", "Guruh ishida faol"]);
      // bahoni o'chirish
      await page.click("[data-mzb='0']"); await page.click(".modal [data-clr]");
      assert.deepEqual((await st(0)).slice(0, 2), ["kq", "null"]);
      // jurnal saqlanib qayta yuklanganda qismlar qoladi
      await page.click("[data-mzp='3|0|4']");   // uy vazifasi «Qolganlarga» bilan 4 bo'lgan
      await page.reload(); await page.waitForSelector("text=Xayrli");
      await page.click(`${viewport.width < 600 ? ".tabbar" : ".side"} [data-go=journal]`);
      await page.evaluate((d) => { S.ci = 0; V.mode = "day"; V.anchor = d; render(); }, t); await page.waitForSelector(".dlist.mz");
      assert.deepEqual(await st(3), ["8", "[4,4]", ""]);
      // mezonlar jadvali
      await page.click("[data-mzrub]"); assert.ok((await page.textContent(".modal")).includes("barcha bosqichlarida faol")); await page.click(".modal [data-x]");
      // toq/juft qatorlar: 2-qator rangli, 1-qator — yo'q
      const bg = (i) => page.evaluate((i) => getComputedStyle(document.querySelector(`.drow[data-dr="${i}"]`)).backgroundColor, i);
      const rk = await page.evaluate(() => [...document.querySelectorAll(".dlist .drow")].map((r) => r.classList.contains("risk")));
      if (!rk[0] && !rk[1]) assert.notEqual(await bg(0), await bg(1), "juft qator boshqa rangda");
      // oddiy rejim — eski 1–10 tugmalar
      await page.click("[data-mzmode=plain]"); await page.waitForSelector("[data-g='4|7']");
      assert.equal(await page.locator(".dlist.mz").count(), 0);
      await page.click("[data-mzmode=crit]"); await page.waitForSelector(".dlist.mz");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 1, `sahifa ekrandan ${overflow}px kengroq`);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }
});

test("jurnal: Kun ko'rinishi, katak yonidagi belgi oynasi, sinf tanlash", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1440, height: 900}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    const t = await page.evaluate(() => { const c = D.classes[0], t = todayIso(); D.settings.method_weekday = null; c.extra_x = [];
      if (!c.dates.includes(t)) { c.dates.push(t); c.dates.sort(); } D.settings.protect.enabled = false; c.students[0].marks[t] = ""; delete c.students[0].marks[t]; D.web.fmode = "plain"; save(); return t; });
    await page.click(".side [data-go=journal]"); await page.click("[data-per]"); await page.click(".perpop [data-mode=day]");
    assert.equal(await page.locator("table.j").count(), 0, "Kun — jadval emas, ro'yxat");
    assert.equal(await page.locator(`.dday.on[data-dd="${t}"]`).count(), 1);
    const mark = () => page.evaluate((d) => D.classes[0].students[0].marks[d] || "", t);
    await page.click("[data-a='0|kq']"); await page.click("[data-g='0|8']");
    assert.equal(await mark(), "8kq");
    assert.equal(await page.locator("[data-g='0|8'].on").count(), 1);
    await page.click("[data-two2]"); await page.click("[data-g='0|9']");
    assert.equal(await mark(), "8/9kq", "＋2 — ikkinchi baho");
    await page.click("[data-g='0|9']"); await page.click("[data-a='0|kq']");
    assert.equal(await mark(), "8", "qayta bosish belgini olib tashlaydi");
    await page.click("[data-a='0|s']");
    assert.equal(await mark(), "s");
    await page.click("[data-a='0|s']");
    assert.equal(await mark(), "");
    // mavzu shu yerda saqlanadi
    await page.fill("#dmt", "Kvadrat tenglamalar"); await page.press("#dmt", "Tab");
    assert.equal(await page.evaluate((d) => D.classes[0].lessons[d].topic, t), "Kvadrat tenglamalar");
    // davr oynasi: Hafta — jadval; belgilar paneli bir qatorda
    await page.click("[data-per]"); await page.click(".perpop [data-mode=week]");
    assert.equal(await page.locator(".perpop").count(), 0);
    assert.equal(await page.locator(`[data-c="0|${t}"]`).count(), 1);
    assert.equal(await page.locator(".keys").count(), 0, "jadvalda belgi tugmalari yo'q");
    assert.ok(!(await page.textContent("main")).includes("Katakni tanlang"));
    await page.click(`[data-c="0|${t}"]`);
    assert.equal(await page.evaluate(() => V.mode), "day", "katak bosilsa kunlik rejim ochiladi");
    assert.equal(await page.evaluate(() => V.anchor), t);
    await page.click('[data-g="0|7"]'); assert.equal(await mark(), "7");
    await page.click("[data-per]"); await page.click(".perpop [data-mode=week]");
    // taqvimdagi sana — o'sha dars «Kun»da ochiladi; Esc oynani yopadi
    await page.click("[data-per]"); await page.keyboard.press("Escape"); assert.equal(await page.locator(".perpop").count(), 0);
    await page.click("[data-per]"); await page.click(`.perpop [data-day="${t}"]`);
    assert.equal(await page.evaluate(() => V.mode), "day");
    // sinflar chap panelda; Oddiy/Kompakt yo'q
    await page.click(".side .cs[data-ci='1']");
    assert.equal(await page.evaluate(() => S.ci), 1);
    assert.equal(await page.locator("[data-den]").count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

for (const [name, viewport] of [["kompyuter", {width: 1440, height: 900}], ["telefon", {width: 390, height: 844}]]) {
  test(`${name}: BSB tahlili — ball kiritish, saqlash, eksport va summativga o'tkazish`, async () => {
    const {readFile} = await import("node:fs/promises");
    const XLSX = (await import("xlsx")).default;
    const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
    try {
      const ctx = await browser.newContext({viewport, acceptDownloads: true});
      const page = await ctx.newPage();
      const errors = []; page.on("pageerror", (e) => errors.push(e.message));
      await page.clock.setFixedTime(new Date(2026, 9, 20, 10, 0));   // 1-chorak ichidagi kun: chorak arxivi (arxiv.js) qulflamasin
      await page.goto(APP);
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
      await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
      await page.evaluate(() => { D.settings.protect.enabled = false; window.print = () => { window.__printed = document.getElementById("pdoc").innerText; }; });
      await page.click(`${name === "telefon" ? ".tabbar" : ".side"} [data-go=journal]`);
      await page.click("[data-jp=bsb]"); await page.waitForSelector("table.bsa");
      const qd = await page.evaluate(() => D.settings.quarters[0][0]);
      await page.fill("#bt", "Kasrlar"); await page.fill("#bdt", qd); await page.dispatchEvent("#bdt", "change");
      await page.fill("#bnq", "3"); await page.press("#bnq", "Tab"); await page.waitForSelector('[data-bx="2"]');
      assert.equal(await page.locator("[data-bx]").count(), 3);
      await page.fill('[data-bx="2"]', "6"); await page.press('[data-bx="2"]', "Tab");
      const n = await page.evaluate(() => D.classes[S.ci].students.length);
      for (let si = 0; si < n; si++) for (let i = 0; i < 3; i++) await page.fill(`[data-bp="${si}|${i}"]`, String((si + i) % (i === 2 ? 7 : 3)));
      await page.press(`[data-bp="${n - 1}|2"]`, "Tab");
      await page.uncheck('[data-bin="1"]');
      assert.equal(await page.textContent('tr[data-row="1"] [data-tot]'), "—");
      await page.click("[data-btab=an]"); await page.waitForSelector(".paper >> text=Savollar tahlili");
      assert.ok(await page.isVisible(".paper svg.chart"));
      await page.click("[data-bsave]");
      const a = await page.evaluate(() => D.classes[S.ci].analyses);
      assert.equal(a.length, 1);
      assert.deepEqual([a[0].id, a[0].title, a[0].date, a[0].q, a[0].max], ["a1", "Kasrlar", qd, 3, [2, 2, 6]]);
      assert.equal(Object.keys(a[0].rows).length, n); assert.equal(Object.values(a[0].rows)[1].in, false);
      // eksport: 1) tahlil hisoboti  2) rasmiy shakl (bsb-eksport.js)
      await page.evaluate(() => { window.print = () => { window.__printed = document.getElementById("pdoc").textContent; }; });
      await page.click("[data-bexp]"); await page.click('.modal [data-v="1"]'); await page.waitForSelector(".modal .bx-pg", {state: "attached"}); await page.click(".modal [data-pdf]");
      let txt = await page.evaluate(() => window.__printed);
      for (const s of ["Bo'lim bo'yicha summativ baholash (BSB) tahlili", "Savollar jadvali", "Yutuqlar", "Tavsiyalar", "O'quvchilar natijalari", "1 / "]) assert.ok(txt.includes(s), s);
      await page.click("[data-bexp]"); await page.click('.modal [data-v="2"]'); await page.click(".modal .bx-grp summary");
      await page.fill("#hs", "12-maktab"); await page.fill('[data-sn="0"]', "Karimova N."); await page.click(".modal [data-pdf]");
      txt = await page.evaluate(() => window.__printed);
      for (const s of ["12-maktab", "Bo'lim bo'yicha summativ baholash (BSB) natijalari", "Kasrlar", "qatnashmadi", "Qatnashdi", "Metod birlashma rahbari", "Karimova N.", "O'zlashtirish, %", "To'liq yechganlar", "Baholar taqsimoti", "Bilim sifati"]) assert.ok(txt.includes(s), s);
      assert.ok(!txt.includes("Yutuqlar"));
      assert.equal(await page.evaluate(() => D.web.bsb_hdr.school), "12-maktab", "header ma'lumoti eslab qolinadi");
      assert.equal(await page.evaluate(() => D.web.bsb_hdr.teacher), "Karimova N.", "o'qituvchi imzodan olinadi");
      await page.click("[data-bexp]"); await page.click('.modal [data-v="2"]');
      const [dl] = await Promise.all([page.waitForEvent("download"), page.click(".modal [data-xl]")]);
      const wb = XLSX.read(await readFile(await dl.path()));
      const aoa = XLSX.utils.sheet_to_json(wb.Sheets.BSB, {header: 1});
      assert.equal(aoa[0][0], "12-maktab"); assert.ok(aoa.some((r) => r[1] === "O'zlashtirish, %") && aoa.some((r) => r[0] === "Baho" && r[1] === "Soni"), "yangi qatorlar Excelda"); assert.ok(aoa.some((r) => r.some((x) => String(x).startsWith("Metod birlashma rahbari"))));
      const ws = wb.Sheets.BSB, hr = aoa.findIndex((r) => r[1] === "Maksimal ball") + 2, tc = XLSX.utils.encode_col(2 + 3);
      assert.equal(ws[`${tc}${hr}`].f, `SUM(C${hr}:E${hr})`, "Jami — formula");
      // jami ballni summativga o'tkazish (yangi BSB ishi)
      await page.click("[data-btr]"); await page.click(".modal [data-ok]");
      const w = await page.evaluate((d) => { const c = D.classes[S.ci], w = c.works.find((x) => x.type === "bsb" && x.date === d && x.title === "Kasrlar"); return w && [w.max, c.students.map((s) => (s.scores || {})[w.id] ?? null)]; }, qd);
      assert.ok(w, "yangi ish yaratildi"); assert.equal(w[0], 10); assert.equal(w[1][1], null); assert.equal(w[1][0], 0 + 1 + 2);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 1, `sahifa ekrandan ${overflow}px kengroq`);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}

test("BSB tahlili: strelka tugmalari, Excel'dan joylash, savol nomlari va xatolar kesimi", async () => {
  const {readFile} = await import("node:fs/promises");
  const XLSX = (await import("xlsx")).default;
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const ctx = await browser.newContext({viewport: {width: 1440, height: 900}, acceptDownloads: true});
    const page = await ctx.newPage();
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    await page.evaluate(() => { D.settings.protect.enabled = false; });
    await page.click(".side [data-go=journal]"); await page.click("[data-jp=bsb]"); await page.waitForSelector("table.bsa");
    const focused = async () => { await page.waitForTimeout(60); return page.evaluate(() => document.activeElement.dataset.bp || "mx" + document.activeElement.dataset.bx); };
    await page.focus('[data-bp="0|0"]');
    await page.keyboard.press("ArrowRight"); assert.equal(await focused(), "0|1");
    await page.keyboard.press("ArrowDown"); assert.equal(await focused(), "1|1");
    await page.keyboard.press("ArrowLeft"); assert.equal(await focused(), "1|0");
    await page.keyboard.press("ArrowUp"); await focused(); await page.keyboard.press("ArrowUp"); assert.equal(await focused(), "mx0", "birinchi qator — maksimal ball");
    await page.keyboard.press("Enter"); assert.equal(await focused(), "0|0");
    await page.keyboard.type("1,5"); await page.keyboard.press("ArrowLeft"); assert.equal(await focused(), "0|0", "matn o'rtasida ← kursorni suradi");
    await page.keyboard.press("Home"); await page.keyboard.press("ArrowLeft"); assert.equal(await focused(), "0|0", "chetdagi katakda joyida qoladi");
    // Excel'dan ko'p katakli joylash
    await page.evaluate(() => { const i = document.querySelector('[data-bp="1|0"]'); i.focus(); const dt = new DataTransfer(); dt.setData("text", "2\t1\n0\t2\n"); i.dispatchEvent(new ClipboardEvent("paste", {clipboardData: dt, bubbles: true, cancelable: true})); });
    const pts = await page.evaluate(() => { const r = (n) => D.classes[S.ci].students.map((s) => (S.bas[label(D.classes[S.ci])].rows[s.name] || {pts: []}).pts); return r().slice(0, 3); });
    assert.deepEqual([pts[1][0], pts[1][1], pts[2][0], pts[2][1]], [2, 1, 0, 2]);
    // savol nomlari + xatolar kesimi
    await page.click("[data-bnames]"); await page.fill('[data-qn="0"]', "Kasrni qisqartirish"); await page.click(".modal [data-ok]");
    await page.click("[data-btab=er]"); await page.waitForSelector(".paper >> text=Topshiriqlar kesimi");
    assert.ok(await page.isVisible(".paper >> text=Kasrni qisqartirish"));
    assert.ok(await page.isVisible(".tiles >> text=Bilim sifati"));
    const ph = await page.evaluate(() => { const e = document.querySelector(".paper"); return e.scrollHeight - e.clientHeight; });
    assert.ok(ph <= 1, `hisobot qutisi kesilgan: ${ph}px`);
    await page.click("[data-bsave]");
    assert.equal(await page.evaluate(() => D.classes[S.ci].analyses[0].names[0]), "Kasrni qisqartirish");
    await page.click("[data-bexp]"); await page.click('.modal [data-v="1"]');
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click(".modal [data-xl]")]);
    const wb = XLSX.read(await readFile(await dl.path()));
    assert.deepEqual(wb.SheetNames, ["Natijalar", "Savollar", "Xulosa"]);
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets.Savollar, {header: 1});
    assert.equal(aoa[0][0], "Savol"); assert.equal(aoa[1][0], "1-savol");
    assert.ok(!JSON.stringify(XLSX.utils.sheet_to_json(wb.Sheets.Natijalar, {header: 1})).includes("Kasrni qisqartirish"), "savol nomlari eksportga chiqmaydi");
    // sarlavha, imzolar va qismlar
    await page.evaluate(() => { window.print = () => { window.__printed = document.getElementById("pdoc").textContent; }; });
    await page.click("[data-bexp]"); await page.click('.modal [data-v="2"]'); await page.click(".modal .bx-grp summary");
    await page.fill("#hn", "2026-2027 o'quv yili"); await page.fill("#hfn", "Metodbirlashmada ko'rildi");
    await page.fill('[data-sl="0"]', "Sinf rahbari"); await page.fill('[data-sn="0"]', "Aliyev B."); await page.fill('[data-sl="1"]', "Direktor"); await page.fill('[data-sn="1"]', "Valiyev S.");
    await page.click('[data-chip="dist"]');
    assert.equal(await page.textContent(".modal [data-tit]"), "Bo'lim bo'yicha summativ baholash (BSB) natijalari", "sarlavha ish turidan");
    await page.click(".modal [data-pdf]");
    let ft = await page.evaluate(() => window.__printed);
    for (const x of ["Bo'lim bo'yicha summativ baholash (BSB) natijalari", "2026-2027 o'quv yili", "Metodbirlashmada ko'rildi", "Sinf rahbari", "Valiyev S."]) assert.ok(ft.includes(x), x);
    assert.ok(!ft.includes("Baholar taqsimoti") && !ft.includes("Metod birlashma rahbari") && !ft.includes("Kasrni qisqartirish"), "o'chirilgan bloklar va savol nomlari chiqmaydi");
    assert.deepEqual(await page.evaluate(() => [D.web.bsb_hdr.bx.off2, D.web.bsb_hdr.sign]), [["dist"], "Sinf rahbari | Aliyev B.\nDirektor | Valiyev S."]);
    await page.click("[data-bexp]"); await page.click('.modal [data-v="2"]');
    const [dl2] = await Promise.all([page.waitForEvent("download"), page.click(".modal [data-xl]")]);
    const wb2 = XLSX.read(await readFile(await dl2.path())), a2 = XLSX.utils.sheet_to_json(wb2.Sheets.BSB, {header: 1});
    assert.equal(a2[1][0], "Bo'lim bo'yicha summativ baholash (BSB) natijalari"); assert.ok(a2.some((r) => r.some((x) => String(x).startsWith("Sinf rahbari"))));
    await page.click("[data-bexp]"); await page.click('.modal [data-v="2"]'); await page.click('[data-chip="dist"]'); await page.click(".modal [data-pdf]");
    ft = await page.evaluate(() => window.__printed); assert.ok(ft.includes("Baholar taqsimoti"), "qism qaytdi");
    // taqsimot ko'rinishi: asosiy — jadval; tanlov eslab qolinadi, qism o'chsa tanlov yashiriladi
    assert.ok(await page.evaluate(() => !!document.querySelector("#pdoc table.bx-dtab")), "asosiy ko'rinish jadval");
    await page.click("[data-bexp]"); await page.click('.modal [data-v="2"]');
    assert.equal(await page.getAttribute('.modal [data-dv="tab"]', "aria-pressed"), "true");
    await page.click('[data-chip="dist"]'); assert.ok(await page.isHidden(".modal [data-dvw]"), "taqsimot o'chsa tanlov yashirin");
    await page.click('[data-chip="dist"]'); await page.click('.modal [data-dv="col"]');
    assert.ok(await page.evaluate(() => !!document.querySelector(".modal .bx-pg .bx-dcol")), "ko'rinishda ustunli diagramma");
    await page.click(".modal [data-pdf]");
    assert.deepEqual(await page.evaluate(() => [D.web.bsb_hdr.bx.dv, !!document.querySelector("#pdoc .bx-dcol"), !!document.querySelector("#pdoc .bx-dtab")]), ["col", true, false]);
    await page.click("[data-bexp]"); await page.click('.modal [data-v="1"]'); await page.click('.modal [data-dv="row"]');
    assert.ok(await page.evaluate(() => !!document.querySelector(".modal .bx-pg table.bx-drow")), "tahlil hisobotida qator jadval");
    await page.click('.modal [data-dv="tab"]'); await page.click(".modal [data-x]");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("BSB eksporti: rasmiy shakl 1 ta varaqqa sig'adi, tahlil hisoboti betlarga bo'linadi", async () => {
  const {readFile} = await import("node:fs/promises");
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1200, height: 900}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    await page.evaluate(() => { window.print = () => {}; const c = D.classes[0], B = baBlank(); B.q = 6; B.max = Array(6).fill(2); B.title = "Kasrlar";
      while (c.students.length < 45) c.students.push({...clone(c.students[0]), name: "Talaba " + c.students.length, id: "t" + c.students.length});
      c.students.forEach((s, i) => { B.rows[s.name] = {in: true, pts: B.max.map((m, k) => (i + k) % 3)}; });
      window.__X = BXP.data(c, B); D.web.bsb_hdr = {school: "12-maktab"}; });
    const r = await page.evaluate(() => { const H = BXP.cfg(), X = window.__X, f1 = BXP.pagesHtml(X, H, 1), f2 = BXP.pagesHtml(X, H, 2);
      BXP.print(X, H, 2); return {z: f2.P[0].zoom, n2: f2.P.length, n1: f1.P.length, cont: f1.P.some((p) => p.html.includes("(davomi)")), css: document.getElementById("pdoc-css").textContent}; });
    assert.ok(r.z < 1 && r.z > 0.3, `zoom ${r.z}`); assert.equal(r.n2, 1); assert.ok(r.css.includes("margin:0"));
    assert.ok(r.n1 >= 3 && r.cont, `tahlil hisoboti ${r.n1} bet, jadval davomi bor`);
    await page.emulateMedia({media: "print"});
    await page.pdf({path: "/tmp/bsb-fit.pdf", preferCSSPageSize: true});
    let pages = (await readFile("/tmp/bsb-fit.pdf")).toString("latin1").match(/\/Type\s*\/Page[^s]/g).length;
    assert.equal(pages, 1, "bitta varaq");
    // tahlil hisoboti: chop etilgan betlar soni ko'rinishdagi bilan bir xil, hech bir bet toshib ketmaydi
    await page.emulateMedia({media: "screen"}); await page.evaluate(() => BXP.print(window.__X, BXP.cfg(), 1)); await page.emulateMedia({media: "print"});
    const n1 = await page.evaluate(() => [...document.querySelectorAll("#pdoc .bx-body")].map((b) => b.scrollHeight - b.clientHeight));
    assert.ok(n1.every((v) => v <= 1), `betdan toshgan: ${n1}`);
    await page.pdf({path: "/tmp/bsb-f1.pdf", preferCSSPageSize: true});
    pages = (await readFile("/tmp/bsb-f1.pdf")).toString("latin1").match(/\/Type\s*\/Page[^s]/g).length;
    assert.equal(pages, r.n1, "PDF betlari = ko'rinishdagi betlar");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});


test("jurnal: bo'sh va to'ldirilgan kataklar bir chiziqda", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 360, height: 760}});
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    for (const den of ["oddiy"]) for (const mode of ["day", "week", "month"]) {
      const bad = await page.evaluate(([den, mode]) => { S.page = "journal"; V.mode = mode; render();
        return [...document.querySelectorAll("table.j tr")].filter((tr) => new Set([...tr.querySelectorAll(".cell")].map((c) => Math.round(c.getBoundingClientRect().top))).size > 1).length; }, [den, mode]);
      assert.equal(bad, 0, `${den} / ${mode}`);
    }
  } finally { await browser.close(); }
});

test("jurnal: telefonda sinf ☰ ro'yxatdan tanlanadi", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    await page.click(".tabbar [data-go=journal]");
    // telefonda ☰ — sinflar fan bo'yicha guruhlangan ro'yxat
    const names = await page.evaluate(() => D.classes.map((c) => c.name));
    const multi = names.find((n, i) => names.indexOf(n) !== i);
    assert.ok(multi, "fixture'da bir sinfning 2 ta fani bor");
    await page.click("[data-cpick]");
    assert.equal(await page.locator(".modal [data-pci]").count(), names.length);
    // bitta fanli sinf: sarlavhasiz, «6-A · Matematika»
    const one = names.findIndex((n) => names.indexOf(n) === names.lastIndexOf(n));
    const lb = await page.evaluate((i) => `${D.classes[i].name} · ${D.classes[i].subject}`, one);
    assert.equal((await page.textContent(`.modal [data-pci="${one}"] b`)).trim(), lb);
    assert.equal(await page.locator(".modal .cpick .tag", {hasText: names[one]}).count(), 0);
    const last = names.lastIndexOf(multi);
    await page.click(`.modal [data-pci="${last}"]`);
    assert.equal(await page.evaluate(() => S.ci), last);
    assert.ok((await page.textContent(".jtt b")).startsWith(multi));
    for (const jp of ["sum", "bsb", "year"]) { await page.click(`[data-jp=${jp}]`); assert.equal(await page.locator("[data-cpick]:visible").count(), 1); }
    // BSB/CHSB jadvali yonga surilganda joyida qoladi (ustunga tortib, orqaga qaytarib yubormaydi)
    await page.click("[data-jp=sum]");
    const sl = await page.evaluate(async () => { const c = D.classes[S.ci]; c.works.push({id: "wsn", type: "bsb", date: c.dates[1], max: 25, q: 1}); render();
      const tw = $("table.sum").closest(".tblwrap"); tw.scrollLeft = 25; await new Promise((r) => setTimeout(r, 500)); return [tw.scrollWidth > tw.clientWidth + 25, tw.scrollLeft]; });
    if (sl[0]) assert.equal(sl[1], 25);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Sozlamalar → Baholash: baho ranglari oraliqlari aniq ko'rinadi", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 360, height: 760}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    await page.click(".tabbar [data-go=settings]"); await page.click('[data-sec="2"]');
    assert.deepEqual(await page.$$eval(".sz-gr .sz-rng > span", (x) => x.map((e) => e.textContent)), ["– 4", "– 7", "– 10"]);
    await page.selectOption('[data-rmin="1"]', "6");
    assert.deepEqual(await page.$$eval(".sz-gr .sz-rng > span", (x) => x.map((e) => e.textContent)), ["– 5", "– 7", "– 10"]);
    assert.equal(await page.evaluate(() => gradeColor(5)), await page.evaluate(() => ranges()[0].color), "5 endi «Past» rangida");
    await page.selectOption('[data-rmin="1"]', "8");   // band bor — rad etiladi
    assert.deepEqual(await page.evaluate(() => ranges().map((r) => r.min)), [1, 6, 8]);
    // ustunlar bir-birining ustiga chiqmaydi
    const ok = await page.evaluate(() => [...document.querySelectorAll(".sz-gr .sz-rng")].every((g) => { const s = g.querySelector("span").getBoundingClientRect(), c = g.closest(".sz-gr").getBoundingClientRect(); return s.right <= c.right; }));
    assert.ok(ok, "oraliq yozuvi rang tugmasi ostida qolmasin");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("jurnal: yonga surilganda sana ustuni ism ustuni ostida yarim qolmaydi", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 360, height: 760}});
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    let skipped = 0;
    for (const fs of ["m", "xl"]) for (const den of ["oddiy"]) for (const mode of ["week", "month", "quarter"]) {
      const gaps = await page.evaluate(async ([fs, den, mode]) => {
        D.web.fsize = fs; S.page = "journal"; V.mode = mode; render();
        const tw = $("#tw"), out = [];
        if (!tw) return null;   // bugungi haftada (yoki oyda) dars sanasi yo'q — jadval chizilmaydi
        for (const x of [37, 123, 250, 99999]) {
          tw.scrollLeft = x; await new Promise((r) => setTimeout(r, 50));
          const nm = tw.querySelector("th.nm").getBoundingClientRect();
          const f = [...tw.querySelectorAll("th:not(.nm)")].map((t) => t.getBoundingClientRect()).find((q) => q.right > nm.right + 1);
          out.push(f ? f.left - nm.right : 0);
        }
        return out;
      }, [fs, den, mode]);
      if (!gaps) { skipped++; continue; }
      assert.ok(gaps.every((g) => g >= 0), `${fs} / ${den} / ${mode}: ${gaps}`);
    }
    assert.ok(skipped < 12, "kamida chorak ko'rinishi tekshirilsin");
    // davr sarlavhasi tugmalar ustiga chiqmaydi
    const over = await page.evaluate(() => { const h = $(".pernav h2").getBoundingClientRect(), nx = $(".pernav [data-sh='1']").getBoundingClientRect(); return h.right - nx.left; });
    assert.ok(over <= 0, `sarlavha tugmaga ${over}px kirib ketgan`);
  } finally { await browser.close(); }
});

test("jurnal: telefonda ism bir qatorda, familiya qisqartiriladi", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 360, height: 760}});
    await page.clock.setFixedTime(new Date(2026, 9, 20, 10, 0));   // chorak ichidagi kun: test sanaga bog'liq bo'lmasin
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    assert.equal(await page.evaluate(() => shortName("Isakjanov Shoxjaxon")), "I. Shoxjaxon");
    const r = await page.evaluate(() => { S.page = "journal"; V.mode = "month"; render();
      const td = $('td.nm[data-st="0"]'), lh = parseFloat(getComputedStyle(td).lineHeight) || 20;
      return {txt: td.innerText.trim(), name: D.classes[S.ci].students[0].name, h: td.getBoundingClientRect().height, lh}; });
    assert.ok(r.txt.includes(r.name.split(/\s+/)[0][0] + ". "), r.txt);
    assert.ok(!r.txt.includes(r.name), "to'liq ism ko'rinmasligi kerak");
    assert.ok(r.h < r.lh * 2, `ism bir qatorda emas (${r.h}px)`);
  } finally { await browser.close(); }
});

test("Telegram: ulash, avtomatik zaxira va boshqa qurilmadan yuklash (soxta bot API)", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    const calls = [], docs = [], ctypes = [];
    let pinned = null, nextId = 10;
    const texts = {}, deleted = [];
    const other = JSON.stringify({classes: [{name: "5-B", subject: "Fizika", students: [{name: "Boshqa Qurilma", marks: {}}]}]});
    await page.route("https://api.telegram.org/**", async (route) => {
      const url = route.request().url(), m = url.split("/").pop();
      // haqiqiy Telegram fayl manzili CORS sarlavhasini bermaydi — brauzerda fetch xato beradi
      if (url.includes("/file/")) return route.abort("failed");
      calls.push(m);
      ctypes.push(route.request().headers()["content-type"] || "");
      const body = route.request().postData() || "";
      let result = true;
      if (m === "getMe") result = {id: 1, is_bot: true, username: "sinf_test_bot"};
      else if (m === "getUpdates") result = [{update_id: 1, message: {message_id: 1, chat: {id: 777, type: "private"}, text: "/start"}}];
      else if (m === "sendMessage") { const id = nextId++; texts[id] = new URLSearchParams(body).get("text"); result = {message_id: id}; }
      else if (m === "editMessageReplyMarkup") { const id = +new URLSearchParams(body).get("message_id"); if (!(id in texts)) return route.fulfill({status: 400, contentType: "application/json", headers: {"access-control-allow-origin": "*"}, body: JSON.stringify({ok: false, description: "message to edit not found"})}); result = {message_id: id, text: texts[id]}; }
      else if (m === "deleteMessages") { for (const id of JSON.parse(new URLSearchParams(body).get("message_ids"))) { delete texts[id]; deleted.push(id); } }
      else if (m === "sendDocument") { docs.push(body); const id = nextId++; pinned = {message_id: id, date: 1761300000, caption: (body.match(/#q\w+( #d[\d.]+)?/) || [""])[0], document: {file_id: "F" + id}}; result = {message_id: id}; }
      else if (m === "getChat") result = {id: 777, pinned_message: pinned};
      else if (m === "getFile") result = {file_path: "documents/x.json"};
      return route.fulfill({status: 200, contentType: "application/json", headers: {"access-control-allow-origin": "*"}, body: JSON.stringify({ok: true, result})});
    });
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    await page.click(".tabbar [data-go=settings]"); await page.click('[data-sec="5"]');
    await page.click("[data-a=tgon]");
    await page.fill("#tgt", "123456789:AAHabcdefghijklmnopqrstuvwxyz");
    await page.click(".modal [data-ok]"); await page.waitForSelector("text=@sinf_test_bot ni ochish");
    await page.click(".modal [data-ok]"); await page.waitForSelector(".modal", {state: "detached"});
    await page.waitForSelector("text=Ulangan: @sinf_test_bot");
    assert.equal(docs.length, 1, "birinchi zaxira yuborilishi kerak");
    assert.ok(docs[0].includes('"classes"') && docs[0].includes("777"), "faylda jurnal bo'lishi kerak");
    assert.ok(calls.includes("pinChatMessage"));
    // zaxira matn bo'laklari bo'lib ham boradi (fayl manzilini brauzer o'qiy olmaydi)
    const myParts = (pinned.caption.match(/#d([\d.]+)/) || [])[1].split(".").map(Number);
    assert.ok(myParts.length >= 1 && myParts.every((id) => texts[id].startsWith("📦")), pinned.caption);
    assert.equal(JSON.stringify(await page.evaluate(async (ids) => tgReadParts(ids), myParts)), await page.evaluate(() => JSON.stringify(D)));
    // token jurnal fayliga yozilmaydi
    assert.ok(!(await page.evaluate(() => JSON.stringify(D))).includes("AAHabc"));
    // o'zgarishsiz qayta ochilganda takror yuborilmaydi
    await page.evaluate(() => tgAuto()); assert.equal(docs.length, 1);
    // boshqa qurilma yangiroq zaxira qadadi → Bugun sahifasida taklif → yuklash
    // eski usuldagi zaxira (faqat fayl) — tushunarli xabar
    pinned = {message_id: 98, date: 1761300400, caption: "#qboshqa", document: {file_id: "F98"}};
    await page.evaluate(async () => { S.page = "today"; await tgAuto(); });
    await page.waitForSelector("text=boshqa qurilmadan yangiroq zaxira");
    page.once("dialog", (d) => d.accept());
    await page.click("[data-tg=tgnew]"); await page.click(".modal [data-ok]");
    await page.waitForSelector(".toast:has-text('eski usulda')", {timeout: 15000});
    const {gzipSync} = await import("node:zlib");
    const z = gzipSync(other).toString("base64url"), half = Math.ceil(z.length / 2);
    texts[95] = `📦1/2 ${z.slice(0, half)}`; texts[96] = `📦2/2 ${z.slice(half)}`;
    pinned = {message_id: 99, date: 1761300500, caption: "#qboshqa #d95.96", document: {file_id: "F99"}};
    await page.evaluate(async () => { S.page = "today"; await tgAuto(); });
    await page.waitForSelector("text=boshqa qurilmadan yangiroq zaxira");
    page.once("dialog", (d) => d.accept());
    await page.click("[data-tg=tgnew]"); await page.click(".modal [data-ok]");
    await page.waitForFunction(() => D.classes.length === 1 && D.classes[0].name === "5-B");
    assert.equal(docs.length, 1, "yuklangandan keyin eski ma'lumot yuborilmasligi kerak");
    // keyingi zaxira oldingi bo'laklarni o'chiradi
    await page.evaluate(async () => { D.classes[0].name = "5-V"; await tgBackup(false); });
    assert.equal(docs.length, 2); assert.ok(deleted.includes(95) && deleted.includes(96), deleted.join());
    // parol bilan shifrlash: fayl ham, matn bo'laklari ham o'qib bo'lmaydi; parol bilan ochiladi
    await page.evaluate(async () => { tgSet({pass: "maxfiy123"}); D.classes[0].name = "5-G"; await tgBackup(false); });
    assert.equal(docs.length, 3);
    assert.ok(docs[2].includes("jurnal-sealed") && !docs[2].includes("\"5-G\"") && !docs[2].includes("Boshqa Qurilma"));
    const sp = (pinned.caption.match(/#d([\d.]+)/) || [])[1].split(".").map(Number);
    await page.evaluate(async (ids) => { window.__s = await tgReadParts(ids); }, sp);
    assert.equal(await page.evaluate(() => window.__s.type), "jurnal-sealed");
    assert.equal(await page.evaluate(async () => (await openSealed(window.__s)).classes[0].name), "5-G");
    // boshqa qurilma: parol saqlanmagan — so'raladi, noto'g'risi qabul qilinmaydi
    await page.evaluate(() => { const c = tgCfg(); delete c.pass; localStorage.setItem(TG_KEY, JSON.stringify(c)); window.__o = null; openSealed(window.__s).then((d) => { window.__o = d; }); });
    await page.fill("#ask", "notogri"); await page.click(".modal [data-ok]");
    await page.waitForSelector(".modal >> text=Qayta kiriting");
    await page.fill("#ask", "maxfiy123"); await page.click(".modal [data-ok]");
    await page.waitForFunction(() => window.__o && window.__o.classes[0].name === "5-G");
    assert.equal(await page.evaluate(() => tgCfg().pass), "maxfiy123");
    // so'rovlar «oddiy» (OPTIONS'siz) ko'rinishda: JSON sarlavhasi yo'q
    assert.ok(ctypes.every((t) => !t.includes("application/json")), ctypes.join());
    // Telegram umuman ochilmasa — VPN haqida tushunarli xabar
    await page.unroute("https://api.telegram.org/**");
    await page.route("https://api.telegram.org/**", (r) => r.abort("connectionrefused"));
    await page.click(".tabbar [data-go=settings]"); await page.click('[data-sec="5"]'); await page.click("[data-a=tgsend]");
    await page.waitForSelector(".toast:has-text('VPN')", {timeout: 15000});
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Kunlik hisobot: darslar tugagach har sinf rasmi Telegram'ga va ota-onalar guruhiga (soxta bot API)", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    const photos = [];
    await page.route("https://api.telegram.org/**", async (route) => {
      const m = route.request().url().split("/").pop(), body = route.request().postDataBuffer() || Buffer.alloc(0), txt = body.toString("latin1");
      let result = true;
      if (m === "sendPhoto") {
        const ct = route.request().headers()["content-type"] || "", form = ct.includes("multipart");
        const chat = form ? (txt.match(/name="chat_id"\r\n\r\n([^\r]+)/) || [])[1] : new URLSearchParams(txt).get("chat_id");
        const cap = form ? Buffer.from((txt.match(/name="caption"\r\n\r\n([^]*?)\r\n--/) || [])[1] || "", "latin1").toString("utf8") : new URLSearchParams(body.toString("utf8")).get("caption");
        photos.push({chat, cap, png: form && txt.includes("\x89PNG"), fid: form ? null : new URLSearchParams(txt).get("photo")});
        result = {message_id: 50 + photos.length, photo: [{file_id: "small"}, {file_id: "PH" + photos.length}]};
      } else if (m === "getUpdates") result = [{update_id: 5, my_chat_member: {chat: {id: -100500, type: "supergroup", title: "6-A ota-onalar"}}}];
      else if (m === "getChat") result = {id: 777};
      else if (m === "sendDocument" || m === "sendMessage") result = {message_id: 1};
      return route.fulfill({status: 200, contentType: "application/json", headers: {"access-control-allow-origin": "*"}, body: JSON.stringify({ok: true, result})});
    });
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    // bugun 6-A da dars: jadval vaqti o'tib ketgan, yo'qlama va baholar qo'yilgan
    await page.evaluate(() => {
      const t = todayIso(), c = D.classes[0]; D.settings.method_weekday = null; c.extra_x = [];
      for (const x of D.classes) x.dates = x.dates.filter((d) => d !== t);
      c.dates.push(t); c.dates.sort(); c.lessons[t] = {topic: "Kasrlarni qo'shish", hw: "12-mashq"};
      c.students.forEach((s, i) => { s.marks[t] = i === 0 ? "s" : i === 1 ? "8kq" : i === 2 ? "" : String(5 + (i % 5)); });
      c.students[3].fp = {[t]: [5, 3]}; c.students[3].marks[t] = "8"; c.students[3].fc = {[t]: "Doskada faol"};
      const wd = (new Date().getDay() + 6) % 7, days = Array.from({length: 6}, () => [""]);
      if (wd < 6) days[wd] = [ckey(c)];
      D.web.schedule = {bells: [["00:00", "00:01"]], days}; save();
      tgSet({token: "123456789:AAHabcdefghijklmnopqrstuvwxyz", chat: 777, bot: "sinf_test_bot"});
    });
    // rasm ma'lumoti jurnaldan to'g'ri olinadi
    const r = await page.evaluate(() => { const x = lessonsToday()[0]; return KUN.build(x.c, todayIso(), x.slots); });
    assert.equal(r.rows[0].st, "s"); assert.equal(r.rows[1].st, "kq"); assert.equal(r.rows[1].g, 8);
    assert.equal(r.rows[3].p, "5+3"); assert.equal(r.rows[3].c, "Doskada faol"); assert.equal(r.topic, "Kasrlarni qo'shish");
    // o'chiq bo'lsa — hech narsa yuborilmaydi
    await page.evaluate(() => KUN.tick()); assert.equal(photos.length, 0);
    // Sozlamalar → Ma'lumotlar: yoqish, tungi rejim, guruh biriktirish
    await page.click(".tabbar [data-go=settings]"); await page.click('[data-sec="5"]');
    await page.waitForSelector("#sz-kr");
    await page.click('[data-kra="grp"]'); await page.click(".modal [data-f]");
    await page.waitForSelector(".modal option:has-text('6-A ota-onalar')", {state: "attached"});
    await page.selectOption('.modal [data-krg="0"]', "-100500"); await page.click(".modal [data-x]");
    await page.waitForSelector("text=1 ta sinfga guruh biriktirilgan");
    await page.click('[data-kra="on"]');
    await page.waitForFunction(() => KUN.cfg().day === todayIso() && KUN.cfg().sent.length === 1);
    assert.equal(photos.length, 2, JSON.stringify(photos));
    assert.equal(photos[0].chat, "777"); assert.ok(photos[0].png, "o'qituvchiga PNG rasm");
    assert.ok(photos[0].cap.includes("6-A") && photos[0].cap.includes("Kelmadi"), photos[0].cap);
    assert.equal(photos[1].chat, "-100500"); assert.equal(photos[1].fid, "PH1", "guruhga qayta yuklamasdan, tayyor rasm");
    // bir kunda bir marta: qayta tekshirilganda takror yuborilmaydi
    await page.evaluate(() => KUN.tick()); assert.equal(photos.length, 2);
    // rejim va ko'rish oynasi
    await page.click('[data-krt="dark"]'); assert.equal(await page.evaluate(() => KUN.cfg().th), "dark");
    await page.click('[data-kra="view"]'); await page.waitForSelector(".modal .kr-prev img");
    const sz = await page.evaluate(() => { const i = document.querySelector(".kr-prev img"); return [i.naturalWidth, i.naturalHeight]; });
    assert.ok(sz[0] === 1640 && sz[1] > 1000, sz.join("x"));
    await page.click(".modal [data-x]");
    // jadval ko'rinishi va shrift: internetdan shrift kelmasa ham rasm chiziladi (Manrope / tizim shrifti)
    await page.route("https://fonts.googleapis.com/**", (rt) => rt.abort("failed"));
    await page.click('[data-kry="block"]'); assert.equal(await page.evaluate(() => KUN.cfg().sty), "block");
    await page.selectOption("#krf", "PT Sans"); assert.equal(await page.evaluate(() => KUN.cfg().font), "PT Sans");
    await page.click('[data-kra="view"]'); await page.waitForSelector(".modal .kr-prev img");
    assert.equal(await page.evaluate(() => KRJ.style()), "block");
    await page.click(".modal [data-x]");
    // «Yuborish» qo'lda — qayta yuboradi
    await page.click('[data-kra="send"]'); await page.waitForFunction((n) => document.querySelector(".toast")?.textContent.includes("1 ta sinf hisoboti"), 0);
    assert.equal(photos.length, 4);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Hisobotlar va BSB/CHSB tahlili: PDF hisobot Telegram'ga (soxta bot API)", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    const docs = [];
    await page.route("https://api.telegram.org/**", async (route) => {
      const m = route.request().url().split("/").pop(), buf = route.request().postDataBuffer() || Buffer.alloc(0);
      if (m === "sendDocument") { const t = buf.toString("latin1"), i = t.indexOf("%PDF"), j = t.lastIndexOf("%%EOF");
        docs.push({name: (t.match(/filename="([^"]+)"/) || [])[1], cap: Buffer.from((t.match(/name="caption"\r\n\r\n([^]*?)\r\n--/) || [])[1] || "", "latin1").toString("utf8"),
          pdf: i >= 0 && j > i ? buf.subarray(i, j + 5) : null}); }
      return route.fulfill({status: 200, contentType: "application/json", headers: {"access-control-allow-origin": "*"}, body: JSON.stringify({ok: true, result: {message_id: 1}})});
    });
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    // ulanmagan: Sozlamalarga yo'naltiradi, hech narsa yuborilmaydi
    await page.click(".tabbar [data-go=reports]"); await page.click("[data-tgpdf]:visible");
    await page.waitForSelector(".modal >> text=Telegram ulanmagan"); await page.click(".modal [data-x]").catch(() => {});
    await page.evaluate(() => { document.querySelectorAll(".modal").forEach((m) => m.remove()); tgSet({token: "123456789:AAHabcdefghijklmnopqrstuvwxyz", chat: 777, bot: "sinf_test_bot"}); });
    const pdfPages = (b) => (b.toString("latin1").match(/\/Type \/Page /g) || []).length;
    for (const kind of ["cls", "att", "sum", "par"]) {
      await page.evaluate((k) => { S.rep = Object.assign(S.rep || {}, {kind: k}); render(); }, kind);
      const n = docs.length; await page.click("[data-tgpdf]:visible");
      await page.waitForFunction(() => document.querySelector(".toast")?.textContent.includes("PDF hisobot Telegram'ga yuborildi"));
      await page.waitForFunction(() => !document.querySelector("[data-tgpdf]:disabled"));
      assert.equal(docs.length, n + 1, kind); const d = docs[n];
      assert.ok(d.pdf && d.pdf.subarray(0, 5).toString() === "%PDF-" && pdfPages(d.pdf) >= 1, `${kind}: PDF`);
      assert.ok(d.name.endsWith(".pdf") && d.cap.startsWith("📄"), `${kind}: ${d.name} ${d.cap}`);
      // panel o'z holiga qaytadi
      assert.equal(await page.evaluate(() => document.body.classList.contains("pmeas") || !!document.querySelector(".pdfx")), false);
    }
    // ota-onalar majlisi: har o'quvchiga varaq — bir necha bet
    assert.ok(pdfPages(docs[3].pdf) >= 2, "par: bir necha bet");
    // BSB/CHSB tahlili eksport oynasi: tayyor varaqlar PDF bo'lib ketadi
    const n = await page.evaluate(async () => { const c = D.classes[0], B = baBlank(); B.q = 4; B.max = [2, 2, 3, 3]; B.title = "Kasrlar";
      c.students.forEach((s, i) => { B.rows[s.name] = {in: true, pts: B.max.map((m, k) => (i + k) % (m + 1))}; }); baExportDialog(c, B); return 0; });
    await page.waitForSelector(".modal [data-tgpdf]", {state: "attached"});
    await page.evaluate(() => document.querySelector(".modal [data-tgpdf]").click());
    await page.waitForFunction((k) => document.querySelector(".toast")?.textContent.includes("PDF hisobot Telegram'ga yuborildi") && true, n);
    await page.waitForFunction(() => !document.querySelector(".ptg-box"));
    const b = docs[docs.length - 1]; assert.equal(docs.length, 5);
    assert.ok(b.pdf && pdfPages(b.pdf) >= 1 && b.cap.startsWith("📄"), b.cap);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Dars jadvali: Excel'dan yuklash, saqlash va dars kunlari", async () => {
  const {readFile, writeFile, mkdtemp} = await import("node:fs/promises");
  const {tmpdir} = await import("node:os"); const {join} = await import("node:path");
  const XLSX = (await import("xlsx")).default;
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const ctx = await browser.newContext({viewport: {width: 390, height: 844}, acceptDownloads: true});
    const page = await ctx.newPage();
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    // maktab jadvali: kunlar ustunlarda, sinf yozuvi har xil ko'rinishda
    const rows = [["O'qituvchi: Akmal"], ["№", "Vaqt", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"],
      [1, "8:00-8:45", "6-A Matematika", "", "9 - A Geometriya", "", "7G", ""],
      [2, "08:50 - 09:35", "9-A Algebra", "7-G", "", "9-A algebra", "6A", ""],
      [3, "09:40-10:25", "", "8-B", "6-A", "", "", ""]];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Jadval");
    const dir = await mkdtemp(join(tmpdir(), "jadval-")), file = join(dir, "jadval.xlsx");
    await writeFile(file, XLSX.write(wb, {type: "buffer", bookType: "xlsx"}));
    await page.click(".tabbar [data-go=settings]"); await page.click('[data-sec="1"]');
    assert.equal(await page.locator("[data-a=schx], [data-a=scht]").count(), 0, "sozlamada faqat «Kiritish» tugmasi qoladi");
    await page.click("[data-a=sch]"); await page.waitForSelector(".schtabs [data-day]");
    const [fc] = await Promise.all([page.waitForEvent("filechooser"), page.click(".modal [data-sx]")]);
    await fc.setFiles(file);
    await page.waitForSelector(".modal .card.hot");
    assert.equal(await page.locator(".modal").count(), 1, "eski oyna yopilishi kerak");
    await page.click(".schtabs [data-day='1']");
    assert.equal(await page.inputValue(".schlist [data-sd='1|1']"), "7-G|Informatika");
    assert.ok(await page.isVisible("text=8-B"), "jurnalda yo'q sinf ko'rsatilishi kerak");
    await page.click(".modal [data-ok]");
    const r = await page.evaluate(() => ({s: D.web.schedule, wd: Object.fromEntries(D.classes.map((c) => [label(c), c.weekdays])),
      mon: schedToday("2026-10-26").map((x) => `${x.no + 1} ${label(x.c)} ${x.from}-${x.to}`)}));
    assert.deepEqual(r.s.bells, [["08:00", "08:45"], ["08:50", "09:35"], ["09:40", "10:25"]]);
    assert.deepEqual(r.mon, ["1 6-A · Matematika 08:00-08:45", "2 9-A · Algebra 08:50-09:35"]);
    assert.deepEqual(r.wd, {"6-A · Matematika": [0, 2, 4], "7-G · Informatika": [1, 4], "9-A · Algebra": [0, 3], "9-A · Geometriya": [2]});
    // kunlar qatorlarda bo'lgan jadval ham o'qiladi
    const t = await page.evaluate(() => parseSchedule([["", "1", "2"], ["Du", "6-A", "7-G"], ["Se", "", "9-A Geometriya"], ["Chor", "6-A", ""]]).schedule.days.slice(0, 3));
    assert.deepEqual(t, [["6-A|Matematika", "7-G|Informatika"], ["", "9-A|Geometriya"], ["6-A|Matematika", ""]]);
    // namuna Excel yuklab olinadi
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("[data-a=sch]").then(() => page.click(".modal [data-st]"))]);
    const back = XLSX.utils.sheet_to_json(XLSX.read(await readFile(await dl.path())).Sheets["Dars jadvali"], {header: 1});
    assert.equal(back[0][2], "Dushanba"); assert.equal(back[1][2], "6-A Matematika");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("BSB/CHSB kuni: jurnalga baho qo'yilmaydi, faqat yo'qlama", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    const r = await page.evaluate(() => {
      const t = todayIso(), ci = D.classes.findIndex((c) => !isGrp(c)), c = D.classes[ci];
      if (!c.dates.includes(t)) { c.dates.push(t); c.dates.sort(); }
      c.students.forEach((s) => delete s.marks[t]); c.att_ok = c.att_ok.filter((d) => d !== t);
      c.works.push({id: "wsd", type: "bsb", date: t, max: 10, title: "Kasrlar"}); save();
      S.page = "journal"; S.ci = ci; S.jpage = "j"; V.mode = "week"; V.anchor = t; render();
      return {ci, g: putMark(c, 0, t, "8", true), a: putMark(c, 1, t, "s", true), m1: c.students[1].marks[t] || ""};
    });
    assert.deepEqual([r.g, r.a, r.m1], [false, true, "s"], "BSB kuni baho emas, faqat yo'qlama");
    const t = await page.evaluate(() => todayIso());
    assert.equal(await page.textContent(`th[data-col="${t}"] small`), "BSB");
    await page.click(`[data-c="0|${t}"]`);
    assert.equal(await page.evaluate(() => V.mode), "day");
    await page.evaluate(() => { V.mode = "day"; render(); });
    assert.equal(await page.locator(".dgr").count(), 0, "kun rejimida baho tugmalari yo'q");
    assert.ok(await page.isVisible("text=BSB kuni"));
    await page.evaluate((ci) => startLesson(ci), r.ci); await page.waitForSelector(".steps");
    assert.deepEqual(await page.locator(".steps button").allTextContents(), ["1 · Yo'qlama", "2 · Mavzu va uy vazifasi"]);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Bugun: «Hamma keldi» va oldingi uy vazifasi; mavzular oynasi", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    const prev = await page.evaluate(() => {
      const t = todayIso(), c = D.classes[0], p = iso(addDays(pdate(t), -1));
      for (const d of [p, t]) if (!c.dates.includes(d)) c.dates.push(d);
      c.dates.sort(); c.extra_x = c.extra_x.filter((d) => d !== p && d !== t); c.held.push(p, t);
      c.att_ok = c.att_ok.filter((d) => d !== t); c.students.forEach((s) => delete s.marks[t]);
      c.lessons[p] = {topic: "Kasrlar", hw: "45-bet, 3-mashq"}; save(); S.page = "today"; render(); return p;
    });
    // dars qatori (bugun.js) → dars oynasi: oldingi uy vazifasi va «Hamma keldi»
    await page.click('.bn-ls[data-les="0"]');
    await page.waitForSelector(".modal >> text=45-bet, 3-mashq");
    await page.click('.modal [data-allok="0"]');
    assert.ok(await page.evaluate(() => D.classes[0].att_ok.includes(todayIso())));
    await page.waitForSelector('.bn-ls.done[data-les="0"]');
    // mavzular oynasi: kiritilgan qiymat saqlanadi
    await page.evaluate((p) => { D.settings.quarters[0] = [iso(addDays(pdate(p), -5)), iso(addDays(pdate(todayIso()), 5))]; S.ci = 0; S.page = "journal"; render(); lessonsDialog(0); }, prev);   // sana chorak tanaffusiga to'g'ri kelmasin
    await page.fill(`[data-lt="${prev}"]`, "Kasrlarni qo'shish"); await page.press(`[data-lt="${prev}"]`, "Tab");
    await page.fill(`[data-lh="${prev}"]`, ""); await page.press(`[data-lh="${prev}"]`, "Tab");
    const l = await page.evaluate((p) => D.classes[0].lessons[p], prev);
    assert.deepEqual(l, {topic: "Kasrlarni qo'shish", hw: ""});
    await page.click(".modal [data-x]");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Ota-onalarga xabarlar: butun sinf, haftalik xulosa", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    const name = await page.evaluate(() => {
      const t = todayIso(), c = D.classes[0], s = c.students[0];
      if (!c.dates.includes(t)) { c.dates.push(t); c.dates.sort(); } c.extra_x = c.extra_x.filter((d) => d !== t); c.held.push(t);
      s.marks[t] = "9"; c.lessons[t] = {topic: "Kasrlar", hw: "12-mashq"}; save(); S.ci = 0; S.page = "journal"; render(); parentBulk(0); return s.name;
    });
    await page.waitForSelector(".pmsg");
    const first = await page.inputValue('[data-pt="0"]');
    assert.ok(first.includes(name) && first.includes("baho 9") && first.includes("Uy vazifasi") && first.includes("12-mashq"), first);
    assert.ok((await page.getAttribute('[data-ptg="0"]', "href")).startsWith("https://t.me/share/url"));
    await page.click('[data-pbl="ru"]');
    assert.ok((await page.inputValue('[data-pt="0"]')).includes("оценка 9"));
    await page.selectOption("#pbk", "auto"); await page.check("#pbo");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

for (const [name, viewport] of [["kompyuter", {width: 1440, height: 900}], ["telefon", {width: 390, height: 844}]]) {
  test(`${name}: Hisobotlar → Grafik va statistika`, async () => {
    const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
    try {
      const page = await browser.newPage({viewport});
      const errors = []; page.on("pageerror", (e) => errors.push(e.message));
      await page.clock.setFixedTime(new Date(2026, 9, 20, 10, 0));   // chorak ichidagi kun: test sanaga bog'liq bo'lmasin
      await page.goto(APP);
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
      await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
      await page.click(`${name === "telefon" ? ".tabbar" : ".side"} [data-go=reports]`);
      if (name === "telefon") { await page.click("[data-hk=kind]"); await page.click(".modal [data-kind=stats]"); } else await page.click("[data-kind=stats]");
      assert.equal(await page.locator("svg.stat").count(), 3);
      const d = await page.evaluate(() => { const c = D.classes[0], [lo, hi] = periodNow(); return {dist: statsData(c, lo, hi).dist.reduce((a, b) => a + b, 0),
        all: c.students.reduce((a, s) => a + c.dates.filter((x) => lo <= x && x <= hi && x <= todayIso() && !isNoLesson(c, x)).reduce((n, x) => n + gradesOf(s.marks[x] || "").length, 0), 0)}; });
      assert.equal(d.dist, d.all, "taqsimotdagi baholar soni jurnaldagi bilan bir xil");
      await page.click(".hb-top5 [data-card]"); await page.waitForSelector(".modal [data-k]");
      await page.click(".modal [data-k]"); await page.waitForSelector(".modal");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 1, `sahifa ekrandan ${overflow}px kengroq`);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}

test("Doskaga chaqirish va guruhlarga bo'lish", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    const info = await page.evaluate(() => {
      const t = todayIso(), c = D.classes[0];
      if (!c.dates.includes(t)) { c.dates.push(t); c.dates.sort(); } c.extra_x = c.extra_x.filter((d) => d !== t); c.held.push(t);
      c.students.forEach((s) => delete s.marks[t]); c.students[0].marks[t] = "s";
      // og'irlik: kam baho olgan ko'proq, bugun baho olgan kamroq
      const w = pickWeights([{n: 5}, {n: 0}, {n: 0, today: true}], true);
      const G = makeGroups(Array.from({length: 10}, (_, i) => ({avg: i + 1})), 3, "even", () => 0.5);
      save(); S.ci = 0; startLesson(0); return {absent: c.students[0].name, n: c.students.length, w, sizes: G.map((g) => g.length), sums: G.map((g) => g.reduce((a, x) => a + x.avg, 0))};
    });
    assert.ok(info.w[1] > info.w[0] && info.w[2] < info.w[1], JSON.stringify(info.w));
    assert.deepEqual(info.sizes.sort(), [3, 3, 4]);
    assert.ok(Math.max(...info.sums) - Math.min(...info.sums) <= 10, JSON.stringify(info.sums));
    await page.click("[data-call]");
    const seen = new Set();
    for (let i = 0; i < info.n - 1; i++) { await page.click(".modal [data-go]"); seen.add(await page.textContent(".pname")); }
    assert.equal(seen.size, info.n - 1, "har kim bir martadan chiqadi");
    assert.ok(!seen.has(info.absent), "kelmagan o'quvchi chaqirilmaydi");
    const last = await page.textContent(".pname");
    await page.click('.modal [data-pg="8"]');
    assert.equal(await page.evaluate((n) => D.classes[0].students.find((s) => s.name === n).marks[todayIso()], last), "8");
    await page.click(".modal [data-x]");
    await page.click("[data-grp]");
    await page.click('[data-gk="3"]'); await page.click('[data-gm="even"]');
    assert.equal(await page.locator(".grp").count(), 3);
    const total = await page.evaluate(() => [...document.querySelectorAll(".grp")].reduce((a, g) => a + g.children.length - 1, 0));
    assert.equal(total, info.n - 1);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 1, `sahifa ekrandan ${overflow}px kengroq`);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Dars eslatmasi: jadval bo'yicha darsdan oldin bildirishnoma", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.clock.install({time: new Date(2026, 9, 26, 8, 52)});   // dushanba 08:52
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    await page.evaluate(() => {
      D.settings.method_weekday = null; D.settings.holidays = [];
      D.classes.forEach((c) => { c.extra_x = []; });
      const c0 = D.classes[0], c1 = D.classes[1], t = todayIso(), p = c1.dates.filter((d) => d < t).pop();
      c1.lessons[p] = Object.assign({}, c1.lessons[p], {hw: "12-mashq"});
      D.web.schedule = {bells: [["08:55", "09:40"], ["10:00", "10:45"]], days: [[ckey(c0), ckey(c1)], ["", ""], ["", ""], ["", ""], ["", ""], ["", ""]]};
      save(); S.sec = 1; go("settings");
    });
    await page.click("[data-a=rem]");
    await page.waitForFunction(() => D.web.remind && D.web.remind.on);
    // 1-soatning eslatma vaqti (08:50) o'tgan, dars hali boshlanmagan — darhol chiqadi
    await page.waitForSelector(".toast:has-text('1-soat · 08:55')");
    const plan = await page.evaluate(() => remPlan().map((p) => [p.title, p.body, p.at.getHours() * 60 + p.at.getMinutes()]));
    assert.equal(plan.length, 2); assert.equal(plan[1][2], 9 * 60 + 55); assert.ok(plan[1][1].includes("12-mashq"), plan[1][1]);
    await page.selectOption("#remm", "10");
    await page.clock.runFor(57 * 60 * 1000);   // 09:49 — hali erta
    assert.equal(await page.evaluate(() => REM.fired.size), 1);
    await page.clock.runFor(2 * 60 * 1000);    // 09:51 — 2-soat eslatmasi (09:50) chiqdi
    assert.deepEqual(await page.evaluate(() => [...REM.fired]), ["2026-10-26|0", "2026-10-26|1"]);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Tez yoqlama: kartochkani surish bilan belgilash", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}, hasTouch: true});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    const n = await page.evaluate(() => {
      const t = todayIso(), c = D.classes[0];
      if (!c.dates.includes(t)) { c.dates.push(t); c.dates.sort(); } c.extra_x = c.extra_x.filter((d) => d !== t); c.held.push(t);
      c.students.forEach((s) => delete s.marks[t]); c.students[1].marks[t] = "7"; save(); startLesson(0); return c.students.length;
    });
    await page.click('[data-am="card"]');
    const swipe = async (dx) => {
      const b = await page.locator("#swc").boundingBox(), y = b.y + b.height / 2, x = b.x + b.width / 2;
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx / 2, y, {steps: 4}); await page.mouse.move(x + dx, y, {steps: 4}); await page.mouse.up();
      await page.waitForTimeout(250);
    };
    await swipe(-150);               // 1-o'quvchi: kelmadi
    await swipe(150);                // 2-o'quvchi: keldi (bahosi saqlanadi)
    await swipe(30);                 // kam surildi — hech narsa o'zgarmaydi
    await page.click('[data-sw="k"]'); // 3-o'quvchi: kasal
    await page.click("[data-swb]");    // orqaga — yana 3-o'quvchi
    assert.ok((await page.textContent("#swc")).includes(`3 / ${n}`));
    await page.click('[data-sw="k"]');
    await page.keyboard.press("ArrowLeft"); // 4-o'quvchi: kelmadi
    const m = await page.evaluate(() => D.classes[0].students.slice(0, 4).map((s) => s.marks[todayIso()] || ""));
    assert.deepEqual(m, ["s", "7", "k", "s"]);
    for (let i = 4; i < n; i++) await page.click('[data-sw=""]');
    await page.waitForSelector("text=Hamma ko'rib chiqildi");
    assert.ok((await page.textContent(".swc")).includes("kelmadi: 3"));
    await page.click('[data-am="list"]'); await page.waitForSelector("[data-att]");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("O'rindiq xaritasi: tuzish va xaritadan yo'qlama", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    const names = await page.evaluate(() => {
      const t = todayIso(), c = D.classes[0];
      if (!c.dates.includes(t)) { c.dates.push(t); c.dates.sort(); } c.extra_x = c.extra_x.filter((d) => d !== t); c.held.push(t);
      c.students.forEach((s) => delete s.marks[t]); D.settings.protect.enabled = false; save(); startLesson(0); return c.students.map((s) => s.name);
    });
    await page.click('[data-am="map"]');
    await page.click("text=Xaritani tuzish");
    await page.click("[data-sa]");
    assert.equal(await page.locator(".modal .seat:not(.empty)").count(), names.length);
    // 1-o'rindagi o'quvchini bo'sh joyga ko'chirish, 2-sini xaritadan olish
    const empty = await page.locator(".modal .seat.empty").first().getAttribute("data-seat");
    await page.click('.modal [data-seat="0-0"]'); await page.click(`.modal [data-seat="${empty}"]`);
    await page.click('.modal [data-seat="0-1"]'); await page.click(".modal [data-unseat]");
    const at = await page.evaluate(() => D.web.seats[ckey(D.classes[0])].at);
    assert.equal(at[empty], names[0]); assert.equal(at["0-0"], undefined); assert.equal(at["0-1"], undefined);
    await page.click(".modal [data-x]");
    // xaritadan yo'qlama: bosishlar S → DQ
    await page.click(`[data-seat="${empty}"]`);
    await page.click(`[data-seat="${empty}"]`);
    await page.click('[data-satt="1"]');
    const m = await page.evaluate(() => D.classes[0].students.slice(0, 2).map((s) => s.marks[todayIso()] || ""));
    assert.deepEqual(m, ["dq", "s"]);
    assert.ok((await page.textContent(`[data-seat="${empty}"]`)).includes("DQ"));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 1, `sahifa ekrandan ${overflow}px kengroq`);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Tug'ilgan kunlar: kiritish, matndan to'ldirish va «Bugun»da eslatish", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.clock.setFixedTime(new Date(2026, 9, 26, 9, 0));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    const p = await page.evaluate(() => [parseBday("12.03.2013"), parseBday("2013-03-12"), parseBday("5/11"), parseBday("31.02.2013"), parseBday("01.09.12")]);
    assert.deepEqual(p, ["2013-03-12", "2013-03-12", "0000-11-05", null, "2012-09-01"]);
    const names = await page.evaluate(() => { S.ci = 0; S.page = "journal"; render(); bdaysDialog(0); return D.classes[0].students.map((s) => s.name); });
    await page.fill('[data-bd="0"]', "26.10.2014"); await page.press('[data-bd="0"]', "Tab");
    await page.click("summary");
    await page.fill("#bdp", `${names[1]}\t27.10.2013\n${names[2].toUpperCase()} 15.01.2013\nNoma'lum Odam 01.01.2013`);
    await page.click("[data-bdp]");
    const b = await page.evaluate(() => D.classes[0].students.slice(0, 3).map((s) => s.bday));
    assert.deepEqual(b, ["2014-10-26", "2013-10-27", "2013-01-15"]);
    // boshqa fan jurnalidagi shu o'quvchiga ham yoziladi
    const other = await page.evaluate((n) => D.classes.filter((c) => c.students.some((s) => s.name === n)).map((c) => c.students.find((s) => s.name === n).bday), names[0]);
    assert.ok(other.every((x) => x === "2014-10-26"));
    await page.click(".modal [data-x]");
    await page.evaluate(() => go("today"));
    await page.waitForSelector(".bday");
    const txt = await page.textContent(".bday");
    assert.ok(txt.includes(names[0]) && txt.includes("12 yosh"), txt);
    assert.ok((await page.textContent("main")).includes(`${names[1]}`) && (await page.textContent("main")).includes("tug'ilgan kun ertaga"));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Zaxira xotira (IndexedDB): tiklash, kunlik nusxalar va ma'lumot versiyasi", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const ctx = await browser.newContext({viewport: {width: 390, height: 844}});
    const page = await ctx.newPage();
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    await page.waitForFunction(() => IDB.ready);
    const n = await page.evaluate(async () => { D.classes[0].students[0].name = "Tiklangan Bola"; save(); await idbFlush(); return D.classes.length; });
    assert.equal(await page.evaluate(() => D.web.dv), await page.evaluate(() => DATA_VER));
    // localStorage o'chirildi (masalan, brauzer tozaladi) — IndexedDB'dan tiklanadi
    await page.evaluate(() => localStorage.removeItem("yoqlama_jurnal"));
    await page.reload(); await page.waitForFunction(() => IDB.ready);
    await page.waitForSelector("text=zaxira xotiradan");
    assert.equal(await page.evaluate(() => D.classes.length), n);
    assert.equal(await page.evaluate(() => D.classes[0].students[0].name), "Tiklangan Bola");
    assert.ok(await page.evaluate(() => !!localStorage.getItem("yoqlama_jurnal")), "localStorage ham qayta yozildi");
    // kunlik nusxalar: kechagi nusxani qo'shib, undan tiklash
    await page.evaluate(async () => {
      const d = JSON.parse(JSON.stringify(D)); d.classes = d.classes.slice(0, 1);
      await idbReq("snap", "readwrite", (st) => st.put({at: new Date().toISOString(), txt: JSON.stringify(d)}, "2000-01-01"));
      S.sec = 5; go("settings");
    });
    await page.click("[data-a=snaps]"); await page.waitForSelector(".modal .lsns");
    assert.equal(await page.locator("[data-srs]").count(), 1);
    await page.click("[data-srs]"); await page.click(".modal [data-ok]");
    await page.waitForSelector("text=holati tiklandi");
    assert.equal(await page.evaluate(() => D.classes.length), 1);
    await page.evaluate(() => idbFlush());
    const keys = await page.evaluate(() => idbReq("snap", "readonly", (st) => st.getAllKeys()));
    assert.ok(keys.some((k) => k.endsWith("~")), "tiklashdan oldingi holat saqlangan: " + keys);
    // yangiroq versiyadagi ma'lumot: ustidan yozilmaydi
    await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("yoqlama_jurnal")); d.web.dv = 99; d.web.saved = new Date(Date.now() + 1e7).toISOString(); localStorage.setItem("yoqlama_jurnal", JSON.stringify(d)); });
    await page.reload(); await page.waitForFunction(() => IDB.ready);
    await page.waitForSelector("text=yangiroq versiyasida");
    await page.evaluate(() => { D.classes[0].name = "O'zgardi"; save(); });
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("yoqlama_jurnal")).web.dv), 99);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Uy vazifasi tekshiruvi: darsda belgilash, kartochka va «E'tibor talab qiladi»", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.clock.setFixedTime(new Date(2026, 9, 20, 10, 0));   // chorak ichidagi kun: test sanaga bog'liq bo'lmasin
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    const name = await page.evaluate(() => {
      const t = todayIso(), c = D.classes[0], p = iso(addDays(pdate(t), -1));
      for (const d of [p, t]) if (!c.dates.includes(d)) c.dates.push(d);
      c.dates.sort(); c.extra_x = c.extra_x.filter((d) => d !== p && d !== t); c.held.push(p, t);
      c.students.forEach((s) => { delete s.marks[t]; delete s.hwd; }); c.students[2].marks[t] = "s";
      c.lessons[p] = {topic: "Kasrlar", hw: "45-bet, 3-mashq"};
      // oldin ikki marta bajarmagan
      const [lo] = periodNow(); c.students[0].hwd = {[lo]: 0, [p]: 0};
      save(); startLesson(0); S.step = 1; render(); return c.students[0].name;
    });
    await page.waitForSelector("text=45-bet, 3-mashq");
    await page.click('[data-hw="0"]'); await page.click('[data-hw="0"]');   // ✗
    await page.click('[data-hw="1"]');                                       // ✓
    assert.equal(await page.locator('[data-hw="2"]').count(), 0, "kelmagan o'quvchida UV tugmasi yo'q");
    await page.click("[data-hwall]");
    const h = await page.evaluate(() => D.classes[0].students.map((s) => (s.hwd || {})[todayIso()]));
    assert.equal(h[0], 0); assert.equal(h[1], 1); assert.equal(h[2], undefined); assert.ok(h.slice(3).every((x) => x === 1));
    assert.ok((await page.textContent(".foot")).includes("UV bajarmagan: 1"));
    await page.evaluate(() => go("today"));
    assert.deepEqual(await page.evaluate(() => hwOverview().map((x) => [x.name, x.why[0]])), [[name, "uy vazifasini 3 marta bajarmagan"]]);
    await page.evaluate((n) => { studentCard(0, n); }, name);
    assert.ok((await page.textContent(".modal")).includes("3 marta bajarmagan"));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Ota-onalar kontaktlari: kiritish, matndan to'ldirish va xabar tugmalari", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    const n = await page.evaluate(() => [normPhone("90 123-45-67"), normPhone("+998 (93) 555 44 33"), normPhone("12"), normTg("@ali_ota"), normTg("https://t.me/ali_ota"), normTg("a b")]);
    assert.deepEqual(n, ["+998901234567", "+998935554433", null, "ali_ota", "ali_ota", null]);
    const names = await page.evaluate(() => { S.ci = 0; S.page = "journal"; render(); parentsDialog(0); return D.classes[0].students.map((s) => s.name); });
    await page.fill('[data-pp="0"]', "90 123 45 67"); await page.press('[data-pp="0"]', "Tab");
    assert.equal(await page.inputValue('[data-pp="0"]'), "+998 90 123-45-67");
    await page.click("summary");
    await page.fill("#pcp", `${names[1]}\tKarimova Dilfuza\t+998 93 555-44-33 @dilfuza_k\n${names[2]} 97 111 22 33`);
    await page.click("[data-pcp]");
    const p = await page.evaluate(() => D.classes[0].students.slice(0, 3).map((s) => s.par));
    assert.deepEqual(p, [{phone: "+998901234567"}, {phone: "+998935554433", tg: "dilfuza_k", name: "Karimova Dilfuza"}, {phone: "+998971112233"}]);
    await page.click(".modal [data-x]");
    // ommaviy xabarlarda to'g'ridan-to'g'ri havolalar
    await page.evaluate(() => { parentBulk(0); });
    await page.waitForSelector(".pmsg");
    assert.equal(await page.getAttribute('[data-ctg="1"]', "href"), "https://t.me/dilfuza_k");
    assert.ok((await page.getAttribute('[data-psms="0"]', "href")).startsWith("sms:+998901234567?body="));
    assert.ok((await page.getAttribute('[data-pwa="2"]', "href")).startsWith("https://wa.me/998971112233?text="));
    await page.fill('[data-pt="0"]', "Salom");
    assert.equal(await page.getAttribute('[data-psms="0"]', "href"), "sms:+998901234567?body=Salom");
    // o'quvchi kartochkasi
    await page.evaluate((nm) => { studentCard(0, nm, "msg"); }, names[1]);
    assert.ok((await page.getAttribute('[data-psms="c"]', "href")).startsWith("sms:+998935554433?body=Assalomu"));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 1, `sahifa ekrandan ${overflow}px kengroq`);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Chorak yakuni eslatmasi: «Bugun»da kamchiliklar va darsda «baho kam» belgisi", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.clock.setFixedTime(new Date(2026, 9, 20, 10, 0));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    const info = await page.evaluate(() => {
      D.settings.quarters[0] = ["2026-09-02", "2026-10-29"]; const c = D.classes[0], t = todayIso();
      if (!c.dates.includes(t)) { c.dates.push(t); c.dates.sort(); } c.extra_x = c.extra_x.filter((d) => d !== t); c.held.push(t);
      // birinchi o'quvchining choraklik formativ baholarini o'chiramiz
      const [lo] = qRange(1); for (const d of Object.keys(c.students[0].marks)) if (d >= lo) delete c.students[0].marks[d];
      save(); go("today"); return {qe: quarterEnd(), name: c.students[0].name, low: quarterGaps(c, 1).low.map((x) => x.name)};
    });
    assert.deepEqual(info.qe, {q: 1, end: "2026-10-29", left: 9});
    assert.ok(info.low.includes(info.name));
    await page.waitForSelector(".qend");
    assert.ok((await page.textContent(".qend")).includes("1-chorak tugashiga 9 kun qoldi"));
    await page.click('[data-qready="0"]');
    await page.waitForSelector("text=bahosiga tayyorlik");
    assert.equal(await page.evaluate(() => S.rep.kind), "ready");
    await page.evaluate(() => { startLesson(0); S.step = 1; render(); });
    assert.ok((await page.textContent(".lrow")).includes("baho kam: 0/"));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Qarzdorlar: past baho va topshirilmagan ish, qayta topshirish", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.clock.setFixedTime(new Date(2026, 9, 20, 10, 0));   // chorak ichidagi kun: test sanaga bog'liq bo'lmasin
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    const info = await page.evaluate(() => {
      const c = D.classes[0], s = c.students[0], [lo, hi] = periodNow();
      const ds = c.dates.filter((d) => lo <= d && d <= hi && !isNoLesson(c, d));
      for (const st of c.students) { st.retake = {}; for (const d of ds) if (gradesOf(st.marks[d] || "").some((g) => g <= lowMax())) st.marks[d] = "8"; }
      c.works = c.works.filter((w) => w.date < lo || w.date > hi);
      s.marks[ds[0]] = "3"; s.marks[ds[1]] = "s";
      c.works.push({id: "wq1", type: "bsb", date: ds[1], max: 10}); delete (s.scores || {}).wq1;
      c.students.forEach((st, i) => { if (i) (st.scores = st.scores || {}).wq1 = 9; });
      save(); return {name: s.name, d: debtsOf(c, s, lo, hi).map((x) => x.key), all: c.students.map((st) => debtsOf(c, st, lo, hi).length)};
    });
    assert.equal(info.d.length, 2); assert.ok(info.d[0].startsWith("g:") && info.d[1] === "w:wq1", JSON.stringify(info.d));
    assert.deepEqual(info.all.slice(1).filter(Boolean), []);
    await page.evaluate(() => { S.ci = 0; S.page = "journal"; render(); debtsDialog(0); });
    assert.ok((await page.textContent("#dbb")).includes("2 ta qarz · 1 o'quvchi"));
    await page.click("[data-dok]"); await page.fill("#ask", "7"); await page.click(".modal [data-ok]");
    await page.waitForSelector("text=1 ta qarz");
    const r = await page.evaluate(() => Object.values(D.classes[0].students[0].retake)[0].v);
    assert.equal(r, "7");
    await page.check("#dall"); assert.ok((await page.textContent("#dbb")).includes("qayta topshirdi"));
    await page.click("[data-dun]"); await page.waitForSelector("text=2 ta qarz");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("«Yana» menyusi: bo'limlar va qidiruv", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    await page.click(".tabbar [data-go=journal]"); await page.click("[data-more]");
    const heads = await page.$$eval(".modal .mgrp h3", (x) => x.map((e) => e.textContent));
    assert.deepEqual(heads.slice(0, 3), ["Darsda", "O'quvchilar", "Ota-onalar"]);
    await page.fill("#mq", "tugʻilgan");
    const vis = await page.$$eval(".modal [data-i]", (x) => x.filter((b) => b.offsetParent).map((b) => b.textContent));
    assert.deepEqual(vis, ["🎂 Tug'ilgan kunlar"]);
    assert.equal(await page.$$eval(".modal .mgrp", (x) => x.filter((g) => g.offsetParent).length), 1);
    await page.fill("#mq", "ota-ona");
    assert.equal(await page.$$eval(".modal [data-i]", (x) => x.filter((b) => b.offsetParent).length), 2, "bo'lim nomi bo'yicha ham topiladi");
    await page.fill("#mq", "zzzz"); assert.ok(await page.isVisible("#mq0"));
    await page.fill("#mq", "chaqir"); await page.press("#mq", "Enter");
    await page.waitForSelector(".modal >> text=Doskaga");
    // o'quvchi tanlanganda uning bo'limi birinchi chiqadi
    await page.click(".modal [data-x]").catch(() => {}); await page.evaluate(() => { document.querySelectorAll(".modal").forEach((m) => m.remove()); S.sel = [0, D.classes[S.ci].dates[0]]; });
    await page.click("[data-more]");
    assert.ok((await page.textContent(".modal .mgrp h3")).startsWith("Tanlangan:"));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Funksiyalarni yoqish/o'chirish: menyu, dars va «Bugun»dan yashirinadi", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1300, height: 900}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    // yangi foydalanuvchi: sodda to'plam
    assert.deepEqual(await page.evaluate(() => SIMPLE_OFF.filter((k) => feat(k))), []);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    // import qilingan jurnalda hammasi yoqilgan
    assert.equal(await page.evaluate(() => FEATS.filter(([k]) => feat(k)).length), await page.evaluate(() => FEATS.length));
    await page.click(".side [data-go=journal]"); await page.click("[data-more]");
    await page.click(".modal [data-feats]");
    await page.waitForSelector("[data-ft=call]");
    await page.click("[data-ft=call]"); await page.click("[data-ft=groups]"); await page.click("[data-ft=bday]"); await page.click("[data-ft=attmodes]");
    assert.deepEqual(await page.evaluate(() => Object.keys(D.web.off).sort()), ["attmodes", "bday", "call", "groups"]);
    await page.click(".side [data-go=journal]"); await page.click("[data-more]");
    const items = await page.$$eval(".modal [data-i]", (x) => x.map((b) => b.textContent).join("|"));
    assert.ok(!items.includes("Doskaga") && !items.includes("Guruh") && !items.includes("Tug'ilgan") && items.includes("O'rindiq"), items);
    await page.click(".modal [data-x]");
    await page.evaluate(() => { D.web.att_mode = "card"; const c = D.classes[0]; c.students[0].bday = "0000-" + todayIso().slice(5); save(); S.ci = 0; S.lesson = 0; S.step = 0; S.cur = 0; go("lesson"); });
    await page.waitForSelector("[data-next]");
    assert.equal(await page.$("[data-call]"), null); assert.equal(await page.$("[data-am]"), null); assert.equal(await page.$(".bday"), null);
    assert.ok(await page.$("[data-att]"), "kartochka o'chiq — ro'yxat rejimi");
    await page.evaluate(() => go("today")); assert.equal(await page.$(".bday"), null);
    // «Hammasi» qaytaradi
    await page.evaluate(() => { S.sec = 6; go("settings"); }); await page.click("[data-fp=all]");
    assert.deepEqual(await page.evaluate(() => D.web.off), {});
    await page.evaluate(() => go("today")); await page.waitForSelector(".bday");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Sinf hisoboti: saralash, xavf filtri, sifat/o'zlashtirish va Excel", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1300, height: 900}, acceptDownloads: true});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    await page.evaluate(() => { S.rep = {ci: 0, per: "cur", kind: "cls"}; go("reports"); });
    const avgs = () => page.$$eval("table.rcls tr:not(.tot)", (tr) => tr.slice(1).map((r) => parseFloat(r.cells[2].textContent)).filter((x) => !isNaN(x)));
    await page.click('th[data-rs="avg"]');
    let a = await avgs(); assert.deepEqual(a, a.slice().sort((x, y) => y - x), "kamayish tartibida");
    await page.click('th[data-rs="avg"]');
    a = await avgs(); assert.deepEqual(a, a.slice().sort((x, y) => x - y), "o'sish tartibida");
    const nRisk = await page.evaluate(() => { const [lo, hi] = repRange("cur"); return reportRows(D.classes[0], lo, hi).rows.filter((r) => r.risk).length; });
    await page.click('[data-rf="risk"]');
    assert.equal(await page.$$eval("table.rcls tr:not(.tot)", (tr) => tr.length - 1), nRisk);
    // sifat — chorak bahosi 4–5 ulushi; o'zlashtirish — o'rtacha jami ball (100 dan), faqat to'liq chiqqanlar
    const ql = await page.evaluate(() => qualityOf([{q: {complete: true, grade: 5, total: 90}}, {q: {complete: true, grade: 3, total: 45}}, {q: {complete: true, grade: 2, total: 21}}, {q: {complete: false, total: 99}}]));
    assert.equal(ql.n, 3); assert.equal(Math.round(ql.q), 33); assert.equal(ql.u, 52);
    // kutubxona yuklanmasa — CSV
    await page.evaluate(() => { window.loadXlsx = () => Promise.reject(new Error("offline")); });
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("[data-xlsx]:visible")]);
    assert.ok(dl.suggestedFilename().endsWith(".csv"), dl.suggestedFilename());
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Davomat varag'i: oy bo'yicha belgilar, jamilar va Excel", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}, acceptDownloads: true});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    const exp = await page.evaluate(() => {
      const c = D.classes[0], t = todayIso(), ym = c.dates.filter((d) => d <= t).pop().slice(0, 7);
      const ds = c.dates.filter((d) => d.slice(0, 7) === ym && d <= t && !isNoLesson(c, d));
      const s0 = c.students[0]; s0.marks[ds[0]] = "s"; s0.marks[ds[1]] = "8"; save();
      S.amon = ym; S.rep = {ci: 0, per: "cur", kind: "att"}; go("reports");
      return {n: ds.length, s: ds.filter((d) => attPart(s0.marks[d] || "") === "s").length};
    });
    assert.equal(await page.$$eval("table.attm tr:first-child th", (x) => x.length), exp.n + 7);
    const row1 = await page.$$eval("table.attm tbody tr:first-child td", (x) => x.map((e) => e.textContent));
    assert.equal(row1[2], "S"); assert.equal(row1[3], "", "baho qo'yilgan kun — darsda");
    assert.equal(+row1[exp.n + 2], exp.s);
    // chop etishda yotiq varaq
    await page.evaluate(() => fitPrint()); assert.ok((await page.textContent("#pfit-css")).includes("landscape"));
    await page.evaluate(() => { window.loadXlsx = () => Promise.reject(new Error("offline")); });
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("[data-axlsx]:visible")]);
    assert.ok(dl.suggestedFilename().includes("davomat"), dl.suggestedFilename());
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Ota-onalar majlisi: har o'quvchiga varaq, xavf filtri, A4 da ikkitadan", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1300, height: 900}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    await page.evaluate(() => { D.web.bsb_hdr = {teacher: "Karimov A."}; S.rep = {ci: 0, per: "cur", kind: "par"}; go("reports"); });
    const n = await page.evaluate(() => D.classes[0].students.length);
    assert.equal(await page.$$eval(".psheet", (x) => x.length), n);
    assert.ok((await page.textContent(".psheet")).includes("O'qituvchi: Karimov A."));
    await page.click('[data-pf="risk"]');
    const nr = await page.evaluate(() => { const [lo, hi] = repRange("cur"); return reportRows(D.classes[0], lo, hi).rows.filter((r) => r.risk).length; });
    assert.equal(await page.$$eval(".psheet", (x) => x.length), nr);
    await page.click('[data-pf="all"]');
    await page.emulateMedia({media: "print"});
    const pdf = (await page.pdf({preferCSSPageSize: true})).toString("latin1");
    const pages = (pdf.match(/\/Type\s*\/Page[^s]/g) || []).length;
    assert.ok(pages <= Math.ceil(n / 2) + 1, `${pages} sahifa, ${n} o'quvchi`);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Chop etish: telefonda ham hisobot kompyuterdagidek o'lchamda (mayda emas)", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const zs = {};
    for (const [n, viewport] of [["pc", {width: 1300, height: 900}], ["ph", {width: 390, height: 844}]]) {
      const page = await browser.newPage({viewport});
      await page.goto(APP);
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
      await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
      zs[n] = await page.evaluate(() => {
        // 30 o'quvchili sinf
        const c = D.classes[0]; while (c.students.length < 30) c.students.push(Object.assign(clone(c.students[c.students.length % 14]), {name: "Qo'shimcha O'quvchi " + c.students.length}));
        S.rep = {ci: 0, per: "cur", kind: "cls"}; go("reports"); return fitPrint();
      });
      // o'lchashdan keyin telefon ko'rinishi joyiga qaytadi
      if (n === "ph") { assert.equal(await page.$eval(".hb-con .hb-rows", (e) => getComputedStyle(e).display), "flex"); assert.equal(await page.$eval(".hb-con .hb-tw", (e) => getComputedStyle(e).display), "none"); }
      await page.close();
    }
    assert.ok(Math.abs(zs.pc - zs.ph) < 0.05, JSON.stringify(zs));
    assert.ok(zs.ph > 0.6, JSON.stringify(zs));
  } finally { await browser.close(); }
});

test("Hisobotlar: tur kartochkalari, telefonda saralash, solishtirishdan sinfga o'tish, tanlov eslab qolinadi", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    await page.click(".tabbar [data-go=reports]");
    const kind = async (k) => { await page.click("[data-hk=kind]"); await page.click(`.modal [data-kind=${k}]`); };
    // telefonda turlar «Almashtirish» oynasida: 8 ta, guruhlangan
    await page.click("[data-hk=kind]");
    assert.equal(await page.$$eval(".modal [data-kind]", (x) => x.length), 8);
    await page.click(".modal [data-kind=cls]");
    await page.evaluate(() => { S.rep.per = "all"; render(); });
    // saralash — tanlov oynasidan; telefonda jadval o'rniga qatorlar
    await page.click("[data-hk=sort]:visible"); await page.click('.modal [data-ho=sort][data-v="avg|1"]');
    const avgs = await page.$$eval(".hb-rows .hb-li .hb-gp", (x) => x.map((e) => parseFloat(e.textContent)).filter((v) => !isNaN(v)));
    assert.ok(avgs.length > 3); assert.deepEqual(avgs, avgs.slice().sort((a, b) => a - b));
    await kind("cmp"); await page.click('[data-cmpc="1"]:visible');
    assert.deepEqual(await page.evaluate(() => [S.rep.kind, S.rep.ci]), ["cls", 1]);
    await kind("ready"); await page.click("[data-hk=per]:visible"); await page.click('.modal [data-ho=q][data-v="2"]');
    assert.equal(await page.evaluate(() => S.rq), 2);
    assert.ok(await page.$("[data-rxlsx]"));
    await kind("att");
    await page.reload(); await page.waitForSelector(".tabbar");
    await page.click(".tabbar [data-go=reports]");
    assert.equal(await page.evaluate(() => S.rep.kind), "att");
    assert.ok((await page.textContent("[data-hk=per]:visible")).includes("Oy"));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("To'ldirilmagan darslar, KTR bajarilishi va qo'llanma", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    // o'tgan dars kunida yo'qlama yo'q — ro'yxatda chiqadi, «Hamma keldi» bilan yo'qoladi
    const d = await page.evaluate(() => {
      const c = D.classes[2], t = todayIso(), d = c.dates.filter((x) => x < t && !isNoLesson(c, x)).pop();
      c.students.forEach((s) => { delete s.marks[d]; }); c.att_ok = c.att_ok.filter((x) => x !== d); save(); go("today"); return d;
    });
    assert.ok(await page.evaluate((d) => lessonGaps().some((x) => x.ci === 2 && x.d === d && x.noAtt), d));
    await page.click(`[data-gapok="2|${d}"]`);
    assert.ok(await page.evaluate((d) => D.classes[2].att_ok.includes(d) && !lessonGaps().some((x) => x.ci === 2 && x.d === d && x.noAtt), d));
    // mavzu yozib boriladigan sinfda mavzusiz kun — «To'ldirish» mavzular oynasini o'sha kunda ochadi
    const d0 = await page.evaluate(() => { const g = lessonGaps().slice(0, 5).find((x) => x.noTopic && !x.noAtt); return g && `${g.ci}|${g.d}`; });
    if (d0) { await page.click(`[data-gap="${d0}|0"]`); await page.waitForSelector(`.modal [data-lt="${d0.split("|")[1]}"]`); assert.equal(await page.evaluate(() => document.activeElement.dataset.lt), d0.split("|")[1]); await page.click(".modal [data-x]"); }
    // KTR: oxirgi 4 ta o'tgan darsda mavzu yo'q → 4 soat orqada
    const k = await page.evaluate(() => {
      const c = D.classes[0], t = todayIso(), held = c.dates.filter((x) => !isNoLesson(c, x)), past = held.filter((x) => x <= t);
      // chorak sarlavhasiz reja: har dars kuniga bitta mavzu
      c.plan = {on: false, topics: parsePlanText(Array.from({length: held.length}, (_, i) => "Mavzu " + (i + 1)).join("\n"))};
      past.forEach((x, i) => { c.lessons[x] = {topic: i < past.length - 4 ? "Mavzu " + (i + 1) : ""}; });
      save(); go("today"); return ktrProgress(c);
    });
    assert.equal(k.expect - k.done, 4); assert.equal(k.behind, 4);
    await page.click('[data-ktr="0"]'); await page.waitForSelector(".modal .kprog");
    assert.ok((await page.textContent(".modal .kprog")).includes("4 soat orqada"));
    await page.click(".modal [data-x]");
    // kechki eslatma sozlamasi va bildirishnoma matni
    await page.evaluate(() => { S.sec = 1; go("settings"); }); await page.selectOption("#eve", "19:00");
    assert.equal(await page.evaluate(() => D.web.eve), "19:00");
    // qo'llanma: tabbar'dagi «Yordam» shu sahifa bo'limini ochadi
    await page.click(".tabbar [data-help]");
    assert.ok((await page.textContent(".modal [data-ht].on")).includes("Sozlamalar"));
    await page.click('.modal [data-ht="reports"]'); assert.ok((await page.textContent("#hb")).includes("Ota-onalar majlisi"));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Haftalik xulosa, faollik belgilari va ota-onaga natija havolasi", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.clock.setFixedTime(new Date("2026-10-23T10:00:00"));   // juma
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    // haftalik xulosa: juma kuni «Bugun»da karta; sonlar jurnal bilan mos
    await page.waitForSelector(".wkc");
    const w = await page.evaluate(() => { const W = weekSummary("2026-10-19", "2026-10-23"), c = D.classes[0], x = W[0];
      const ds = c.dates.filter((d) => d >= "2026-10-19" && d < "2026-10-23" && !isNoLesson(c, d));
      return {x: {planned: x.planned, grades: x.grades}, grades: c.students.reduce((a, s) => a + ds.concat(c.dates.includes("2026-10-23") && hasMarks(c, "2026-10-23") ? ["2026-10-23"] : []).reduce((b, d) => b + gradesOf(s.marks[d] || "").length, 0), 0)}; });
    assert.equal(w.x.grades, w.grades);
    await page.click(".wkc [data-wk]"); await page.waitForSelector(".modal table.wk");
    assert.ok((await page.textContent(".modal")).includes("Hafta xulosasi · 19.10–23.10"));
    await page.click('.modal [data-wk="1"]'); await page.waitForSelector(".modal >> text=12.10–18.10");
    await page.click(".modal [data-x]");
    await page.click(".wkc [data-wkx]"); assert.equal(await page.locator(".wkc").count(), 0);
    assert.equal(await page.evaluate(() => D.web.wk_seen), "2026-10-19");
    assert.equal(await page.evaluate(() => JSON.stringify([weekCardRange("2026-10-21"), weekCardRange("2026-10-26")])), JSON.stringify([null, ["2026-10-19", "2026-10-25", 1]]));
    // faollik: 3 ta «+» → «⭐ baho» tugmasi, baho qo'yilgach to'plam nolga tushadi
    await page.evaluate(() => { S.lesson = 1; S.ci = 1; S.step = 1; go("lesson"); });
    for (let i = 0; i < 3; i++) await page.click('[data-act="0|0"]');
    await page.click('[data-act="1|1"]');
    assert.equal((await page.textContent('[data-actu="0"]')).trim(), "+3");
    await page.click('[data-actg="0"]'); await page.click('.modal [data-ag="9"]');
    const a = await page.evaluate(() => { const s = D.classes[1].students; return {m: gradesOf(s[0].marks[todayIso()] || ""), bank: actBank(s[0]), minus: s[1].act[todayIso()]}; });
    assert.ok(a.m.includes(9)); assert.equal(a.bank, 0); assert.deepEqual(a.minus, [0, 1]);
    assert.equal(await page.locator('[data-actg="0"]').count(), 0);
    await page.click('[data-actu="1"]'); assert.equal(await page.evaluate(() => !D.classes[1].students[1].act[todayIso()]), true);
    // ota-onaga havola: xabarga qo'shiladi, natija.html ma'lumotni havoladan ko'rsatadi
    const nm = await page.evaluate(() => { D.web.bsb_hdr = {school: "12-maktab", teacher: ""}; S.pkind = "gen"; const n = D.classes[0].students[3].name; studentCard(0, n, "msg"); return n; });
    await page.click("[data-rlink]");
    const url = await page.getAttribute("[data-rprev]", "href");
    assert.ok((await page.inputValue("#pm")).includes(url) && url.includes("natija.html#"));
    const p2 = await browser.newPage({viewport: {width: 390, height: 844}}); p2.on("pageerror", (e) => errors.push(e.message));
    await p2.goto(new URL("../docs/natija.html", APP).href + url.slice(url.indexOf("#")));
    assert.equal((await p2.textContent("h1")).trim(), nm);
    assert.ok((await p2.textContent("body")).includes("12-maktab"));
    assert.ok(await p2.locator(".mk").count() > 0);
    const p3 = await browser.newPage(); await p3.goto(new URL("../docs/natija.html", APP).href + "#buzilgan");
    assert.ok((await p3.textContent("h1")).includes("Havola ochilmadi"));
    // havolani begona odam yasasa ham sahifaga skript kirmaydi, noto'g'ri turdagi qiymatlar sahifani buzmaydi
    const evil = {v: 1, n: "X", c: "6-A", lo: "2026-09-01", hi: "2026-10-01", g: 5, rg: [[1, '"><img src=x onerror="window.__x=1">']], ac: {s: '"><img src=x onerror="window.__y=1">'},
      m: [["10-01", "8"], ["10-02", "s"], [3, 4], "x"], ab: ['<img src=x onerror="window.__z=1">', 0, 0, 0], qg: '<img src=x onerror="window.__q=1">', qt: '<img src=x onerror="window.__t=1">', w: 7, hw: "y"};
    const p4 = await browser.newPage(); p4.on("pageerror", (e) => errors.push(e.message));
    await p4.goto(new URL("../docs/natija.html", APP).href + "#" + Buffer.from(JSON.stringify(evil)).toString("base64url"));
    await p4.waitForTimeout(200);
    assert.deepEqual(await p4.evaluate(() => [window.__x, window.__y, window.__z, window.__q, window.__t]), [undefined, undefined, undefined, undefined, undefined]);
    assert.equal(await p4.locator("img").count(), 0);
    // butun sinf xabarlari: belgilansa har xabarga havola qo'shiladi
    await page.evaluate(() => { document.querySelectorAll(".modal").forEach((x) => x.remove()); parentBulk(0); });
    await page.check("#pbl");
    assert.ok((await page.inputValue('[data-pt="0"]')).includes("natija.html#"));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Jurnal: xavf ostidagi o'quvchi qatori va tartib raqami rang bilan ajratiladi", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.clock.setFixedTime(new Date(2026, 9, 20, 10, 0));   // chorak ichidagi kun: test sanaga bog'liq bo'lmasin
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    const r = await page.evaluate(() => { S.ci = 0; V.mode = "month"; go("journal");
      const [lo, hi, q] = periodNow(), want = reportRows(D.classes[0], lo, hi, q).rows.filter((x) => x.why.some((w) => !w.startsWith("baholar soni"))).map((x) => x.name);
      const tr = [...document.querySelectorAll("table.j tr.risk")], ok = document.querySelector("table.j tr:not(.risk) td.nm i");
      const bg = (el) => getComputedStyle(el).backgroundColor;
      return {want: want.length, got: tr.length, title: tr[0] && tr[0].querySelector("td.nm").title, num: tr[0] && bg(tr[0].querySelector("td.nm i")), plain: ok && bg(ok), badge: document.querySelectorAll("table.j .badge").length}; });
    assert.ok(r.want > 0); assert.equal(r.got, r.want);
    assert.ok(r.title.includes("xavf:"), r.title);
    assert.notEqual(r.num, r.plain); assert.equal(r.badge, 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("KTR: Excel faylidan choraklari bilan yuklash, «BSB tahlili» summativ ish emas", async () => {
  const XLSX = (await import("xlsx")).default;
  const rows = (n) => [["TAQVIM-MAVZU REJA\n[Algebra] — [10] sinf"], ["Dars tartibi", "Dars mavzusi", "Soat", "Taqvimiy muddat"],
    ["I CHORAK"], [1, `${n} 1`, 1], [2, `${n} 2`, 2], [3, "BSB-1 (25 ball)", 1], [4, "BSB tahlili", 1], ["II CHORAK"], [5, `${n} 3`, ""], [6, "CHSB-1 ( 40 ball)", 1]];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows("Fizika")), "7-sinf_Fizika");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows("Mavzu")), "6-sinf_Matematika");
  const xls = XLSX.write(wb, {type: "buffer", bookType: "xls"});
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const ctx = await browser.newContext({serviceWorkers: "block", viewport: {width: 390, height: 844}});
    const page = await ctx.newPage();
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    await page.evaluate(() => { ktrDialog(0); });   // 6-A · Matematika
    const [c2] = await Promise.all([page.waitForEvent("filechooser"), page.click(".modal [data-file]")]);
    await c2.setFiles({name: "ktr.xls", mimeType: "application/vnd.ms-excel", buffer: xls});
    await page.waitForFunction(() => $("#kt").value.includes("BSB tahlili"));
    // sinf faniga mos varaq birinchi tanlanadi, boshqasini tanlash mumkin
    assert.equal(await page.inputValue("#kt"), "== 1-chorak\nMavzu 1\nMavzu 2 | 2\nBSB-1 (25 ball)\nBSB tahlili\n== 2-chorak\nMavzu 3\nCHSB-1 ( 40 ball)");
    assert.ok(await page.isVisible("#ksh"));
    await page.selectOption("#ksh", "1"); assert.ok((await page.inputValue("#kt")).includes("Fizika 1"));
    await page.selectOption("#ksh", "0");
    const r = await page.evaluate(() => ({tp: parsePlanText($("#kt").value).map((t) => [t.q, t.h]), w: ["BSB-1 (25 ball)", "BSB tahlili", "CHSB-1 ( 40 ball)", "BSB №2"].map(workOfTopic)}));
    assert.deepEqual(r.tp, [[1, 1], [1, 2], [1, 1], [1, 1], [2, 1], [2, 1]]);
    assert.deepEqual(r.w, [["bsb", 25], null, ["chsb", 40], ["bsb", null]]);
    await page.click(".modal [data-ok]");
    assert.equal(await page.evaluate(() => D.classes[0].plan.topics.length), 6);
    // Excel kutubxonasi ilova ichidan (docs/vendor), zaifliklari tuzatilgan versiya
    assert.equal(await page.evaluate(() => XLSX.version), "0.20.3");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("emaktab: yil boshidan barcha choraklar, ilova oynasi ochilmasa — fayl orqali", async () => {
  const {readFile} = await import("node:fs/promises");
  const XLSX = (await import("xlsx")).default;
  const docs = fileURLToPath(new URL("../docs/", import.meta.url));
  const rows = JSON.parse(await readFile(fileURLToPath(new URL("inputs.json", import.meta.url)), "utf8")).emaktab[0].rows;
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Matematika");
  const xls = XLSX.write(wb, {type: "buffer", bookType: "xls"});
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const ctx = await browser.newContext({serviceWorkers: "block", acceptDownloads: true});
    const asked = [];
    await ctx.route("https://app.test/**", async (r) => {
      const p = new URL(r.request().url()).pathname.slice(1) || "index.html";
      try { r.fulfill({body: await readFile(docs + p), contentType: p.endsWith(".html") ? "text/html" : p.endsWith(".js") ? "text/javascript" : undefined}); } catch { r.fulfill({status: 404}); }
    });
    const hdr = {currentPeriodId: 78, currentGroupId: 5, periods: {5: {periods: [{id: 77, number: 0, name: "I chorak"}, {id: 78, number: 1, name: "II chorak"}, {id: 79, number: 2, name: "III chorak"}]}}};
    await ctx.route("https://schools.emaktab.uz/**", (r) => {
      const u = new URL(r.request().url()); asked.push(u.pathname + u.search);
      if (u.pathname === "/v2/myclasses") return r.fulfill({contentType: "text/html", body: `<div id="ContentPanelTeacher"><a href="/v2/class?class=1">7-B</a><a href="/v2/journal/school/11/group/22/subject/33" title="Matematika">Matematika</a></div>`});
      if (u.pathname.startsWith("/v2/journal/")) return r.fulfill({contentType: "text/html", body: `<script>window.__JOURNAL__INITIAL__STATE__ = ${JSON.stringify({journalHeader: hdr})};</script>`});
      if (u.pathname === "/v2/excel") return r.fulfill({contentType: "application/vnd.ms-excel", body: xls});
      return r.fulfill({status: 404});
    });
    const app = await ctx.newPage(); const errors = []; app.on("pageerror", (e) => errors.push(e.message));
    await app.goto("https://app.test/");
    const code = await app.evaluate(() => emkCode());
    const emk = await ctx.newPage(); emk.on("pageerror", (e) => errors.push(e.message));
    await emk.goto("https://schools.emaktab.uz/v2/myclasses");
    await emk.evaluate(() => { window.open = () => null; });   // qalqib chiquvchi oyna to'silgan
    // telefon xatcho'pi: qisqa kod emk.js ni ilova saytidan yuklaydi
    const loader = await app.evaluate(() => emkLoader());
    assert.ok(loader.length < 600, `telefon xatcho'pi qisqa bo'lishi kerak: ${loader.length}`);
    await emk.evaluate(decodeURIComponent(loader.slice(11)));
    await emk.click('[data-emk="all"]');
    const [dl] = await Promise.all([emk.waitForEvent("download"), emk.click('[data-emk="save"]')]);
    assert.equal(dl.suggestedFilename(), "emaktab_jurnallar.json");
    assert.ok(asked.includes("/v2/excel?action=gjsxls&school=11&group=22&subgroup=0&subject=33&period=77"));
    assert.ok(asked.includes("/v2/excel?action=gjsxls&school=11&group=22&subgroup=0&subject=33&period=78"));
    assert.ok(!asked.some((a) => a.includes("period=79")), "kelajakdagi chorak olinmaydi");
    const path = await dl.path(), bundle = JSON.parse(await readFile(path, "utf8"));
    assert.deepEqual(bundle.files.map((f) => f.name), ["7-B_Matematika_I chorak.xls", "7-B_Matematika_II chorak.xls"]);
    // ilovada: emaktab oynasining «Fayl orqali» bo'limidan
    await app.evaluate(() => { emkDialog("file"); });
    const [ch] = await Promise.all([app.waitForEvent("filechooser"), app.click(".modal [data-pick]")]);
    await ch.setFiles({name: "emaktab_jurnallar.json", mimeType: "application/json", buffer: await readFile(path)});
    await app.click(".modal [data-ok]", {timeout: 20000});
    await app.waitForSelector("text=Import yakunlandi");
    assert.deepEqual(await app.evaluate(() => D.classes.map((c) => c.name)), ["7-B"]);
    // dialog: uchta bo'lim
    await app.evaluate(() => { document.querySelectorAll(".modal").forEach((x) => x.remove()); emkDialog("pc"); });
    assert.equal(await app.locator(".modal [data-et]").count(), 3);
    assert.ok(await app.isVisible(".modal [data-copyc]"));
    // telefon: xatcho'p manzili bir qatorli (telefon qator o'tkazishni o'chiradi) va to'g'ri JS; nusxalab bo'lmasa maydonda ko'rinadi
    await app.evaluate(() => { document.querySelectorAll(".modal").forEach((x) => x.remove()); navigator.clipboard.writeText = () => Promise.reject(new Error("no")); emkDialog("phone"); });
    await app.click(".modal [data-copy]");
    const bmk = await app.inputValue(".modal #emkta");
    assert.ok(bmk.startsWith("javascript:") && !/[\r\n\s]/.test(bmk) && bmk.length < 600, "bir qatorli, qisqa");
    assert.equal(await app.evaluate((u) => { try { new Function(decodeURIComponent(u.slice(11).replace(/\n/g, ""))); return "ok"; } catch (e) { return e.message; } }, bmk), "ok");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Sozlamalar: bo'limlar guruhlangan, kalitlar holatni ko'rsatadi, telefonda qator sig'adi", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    for (let i = 0; i < 7; i++) {
      await page.evaluate((i) => { S.sec = i; go("settings"); }, i);
      const r = await page.evaluate(() => ({g: document.querySelectorAll(".sz-pan .sz-sg, .sz-pan .sgroup").length, over: document.documentElement.scrollWidth - innerWidth, cur: $(".sz-tb b").textContent}));
      assert.ok(r.g >= 1, `bo'lim ${i}: guruh yo'q`); assert.ok(r.over <= 0, `bo'lim ${i}: ${r.over}px yonga chiqdi`); assert.equal(r.cur, await page.evaluate((i) => SZL.SECS[i][1], i));
    }
    // funksiya kaliti: bosilganda o'chadi, aria-checked o'zgaradi
    await page.evaluate(() => { S.sec = 6; go("settings"); });
    assert.equal(await page.getAttribute("[data-ft=call]", "aria-checked"), "true");
    await page.click("[data-ft=call]");
    assert.equal(await page.getAttribute("[data-ft=call]", "aria-checked"), "false");
    assert.equal(await page.evaluate(() => feat("call")), false);
    // kalit sarlavha bilan bir qatorda
    const same = await page.evaluate(() => { const row = $("[data-ft=bday]").closest(".sz-r"), a = row.firstElementChild.getBoundingClientRect(), b = $("[data-ft=bday]").getBoundingClientRect(); return b.top < a.bottom && b.left > a.left; });
    assert.ok(same);
    // sinf qatori (telefon): qatorning o'zi menyu ochadi, xavfli amal qatorda ko'rinmaydi; o'chirish menyuda, alohida ajratilgan
    await page.evaluate(() => { S.sec = 0; go("settings"); });
    assert.equal(await page.locator(".sz-cls .btn-outline-danger").count(), 0, "o'chirish tugmasi qatorda turmasin");
    assert.equal(await page.locator('button.sz-cls[data-a=cmore][data-i="0"]').count(), 1);
    await page.click('[data-a=cmore][data-i="0"]');
    await page.waitForSelector(".modal .mdang");
    assert.equal(await page.locator(".modal .mgrid .btn.btn-outline-danger").count(), 0);
    assert.match(await page.textContent(".modal .mdang"), /Sinfni o'chirish/);
    await page.click(".modal [data-x]");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Bugun: keng ekranda ma'lumot kartochkalari ikki ustunda, telefonda bitta", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1400, height: 900}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    await page.click(".side [data-go=today]");
    const cols = () => page.evaluate(() => new Set([...$(".tgrid").children].map((x) => Math.round(x.getBoundingClientRect().left))).size);
    assert.equal(await cols(), 2, "kompyuterda ikki ustun");
    await page.setViewportSize({width: 390, height: 844});
    await page.evaluate(() => render());
    assert.equal(await cols(), 1, "telefonda bitta ustun");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "yonga chiqmasin");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Jurnal: o'tgan darslar, sana menyusi, qidiruv va saralash", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1280, height: 900}});
    await page.clock.setFixedTime(new Date("2026-10-23T10:00:00"));
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    await page.evaluate(() => { S.ci = 0; go("journal"); });
    // 7 kun ichidagi o'tgan dars va 7 kundan eskisi
    const [near, far] = await page.evaluate(() => { const c = D.classes[0], t = todayIso(), ok = c.dates.filter((d) => d < t && !isNoLesson(c, d) && !sumOn(c, d));
      return [ok.filter((d) => (pdate(t) - pdate(d)) / 864e5 <= 7).pop(), ok.find((d) => (pdate(t) - pdate(d)) / 864e5 > 7)]; });
    assert.ok(near && far);
    // bo'sh katakli o'quvchi (himoya faqat qo'yilgan bahoni o'zgartirishni to'sadi)
    const put = (d) => page.evaluate((d) => { const c = D.classes[0], si = c.students.findIndex((s) => !s.marks[d]); return putMark(c, si, d, "7", true); }, d);
    assert.equal(await put(near), false, "standart: faqat bugun");
    await page.evaluate(() => { S.sec = 2; go("settings"); });
    await page.click('[data-past="week"]');
    assert.equal(await put(near), true); assert.equal(await put(far), false);
    await page.click('[data-past="all"]'); assert.equal(await put(far), true);
    assert.equal(await page.evaluate(() => putMark(D.classes[0], 1, "2099-01-01", "7", true)), false, "kelajakka yo'q");
    // sana menyusi: mavzu saqlanadi, «hamma keldi»
    await page.evaluate((d) => { V.anchor = d; S.ci = 0; go("journal"); }, near);
    await page.click(`th[data-col="${near}"]`);
    await page.fill("#cmt", "Kasrlar"); await page.fill("#cmh", "12-mashq"); await page.click(".modal [data-sv]");
    assert.deepEqual(await page.evaluate((d) => [D.classes[0].lessons[d].topic, D.classes[0].lessons[d].hw], near), ["Kasrlar", "12-mashq"]);
    assert.ok(await page.isVisible("table.j tr.ft"), "ustun xulosasi qatori");
    // saralash: o'rtacha baho bo'yicha, ↓ tugmasi ham shu tartibda yuradi
    await page.selectOption("#jsort", "avgd");
    const avgs = await page.$$eval("table.j tr[data-q] td.s:not(.a)", (t) => t.map((x) => parseFloat(x.textContent)).filter((v) => !isNaN(v)));
    assert.deepEqual(avgs, [...avgs].sort((a, b) => b - a));
    // qidiruv
    const nm = await page.evaluate(() => D.classes[0].students[3].name);
    await page.fill("#jq", nm.split(" ")[0].toLowerCase());
    const vis = await page.$$eval("table.j tr[data-q]", (t) => t.filter((x) => x.style.display !== "none").length);
    assert.ok(vis >= 1 && vis < await page.evaluate(() => D.classes[0].students.length));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("jurnal: sana dars kunlari bo'yicha qo'shiladi; yon panel yig'iladi; yozuv tugmadan chiqmaydi", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1280, height: 800}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    await page.evaluate(() => { D.classes[0].weekdays = [0, 3]; D.settings.method_weekday = null; D.settings.holidays = []; S.ci = 0; save(); });
    await page.click(".side [data-go=journal]"); await page.click("[data-more]"); await page.click(".modal >> text=Sana qo'shish");
    const before = await page.evaluate(() => D.classes[0].dates.length);
    await page.click(".modal [data-n='4']");
    assert.match(await page.textContent("#adp"), /^4 ta sana/);
    await page.click(".modal [data-ok]");
    const added = await page.evaluate((n) => D.classes[0].dates.slice(n), before);
    assert.equal(added.length, 4);
    assert.ok(await page.evaluate((a) => a.every((d) => [0, 3].includes(pyWd(d))), added), `faqat Du va Pa: ${added}`);
    // yon panel: kichraytirish — sinflar ro'yxati o'rniga ☰
    await page.click("[data-sidet]");
    assert.ok(await page.evaluate(() => $("#app").classList.contains("compact") && D.web.sidemin));
    assert.equal(await page.locator(".clsside").count(), 0);
    assert.equal(await page.locator("[data-cpick]:visible").count(), 1);
    await page.click("[data-sidet]");
    assert.equal(await page.locator(".clsside").count(), 1);
    // hamma tugma bir qatorda, yozuv tugma ichida
    for (const pg of ["journal", "settings", "today"]) {
      await page.evaluate((p) => { S.page = p; render(); }, pg);
      const bad = await page.evaluate(() => [...document.querySelectorAll(".btn")].filter((b) => b.offsetParent && b.scrollHeight > b.clientHeight + 2).map((b) => b.textContent.trim()));
      assert.deepEqual(bad, [], pg);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("zararli jurnal (import): skript bajarilmaydi, maydonlar tozalanadi", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1440, height: 900}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const r = await page.evaluate(() => {
      window.__pwn = 0;
      const X = `"><img src=x onerror="window.__pwn++">`;
      const d = normalize({classes: [{name: "7-A", kind: X, svc: X, dates: [X, "2026-03-02"], works: [{id: X, type: X, date: X}, {id: "w1", type: "bsb", date: "2026-03-02"}],
        analyses: [{id: X, date: X}], students: [{name: "Ali Valiyev", id: X, joined: X, par: {phone: X, tg: X},
          pays: [{id: X, no: X, d: X, m: X, sum: X}, {id: "p1", no: 1, d: "2026-03-02", m: "2026-03", sum: 5000}]}]}]});
      const c = d.classes[0], s = c.students[0];
      return {kind: c.kind, svc: c.svc, dates: c.dates, works: c.works.length, analyses: c.analyses.length, joined: s.joined,
        phone: s.par.phone, tg: s.par.tg, pays: s.pays.map((p) => p.id), fmt: fmt(X)};
    });
    assert.ok(r.dates.every((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)) && r.dates.includes("2026-03-02"), "sana ro'yxati tozalanmadi");
    assert.equal(r.works, 1); assert.equal(r.analyses, 0);
    assert.ok(!r.phone && !r.tg, "telefon/Telegram nomi tekshiruvdan o'tmadi");
    assert.deepEqual(r.pays, ["p1"]);
    assert.ok(!/[<>"]/.test(r.fmt), "fmt() HTMLni tozalamadi");
    assert.equal(await page.evaluate(() => window.__pwn), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Dars: 30% dan kam baholangan bo'lsa ogohlantiradi, yetarli bo'lsa to'xtatmaydi", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1300, height: 900}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    await page.evaluate(() => { const c = D.classes[0], t = todayIso(); c.students.forEach((s) => { delete s.marks[t]; }); delete c.sumdays; S.ci = 0; S.lesson = 0; S.step = 1; go("lesson"); });
    await page.waitForSelector("[data-step]");
    await page.click("[data-step='1']");
    assert.ok((await page.textContent("main")).includes("⚠ Baholangan: 0 /"), "0% — ogohlantirish");
    await page.click("[data-next]"); await page.click("[data-next]");
    await page.waitForSelector(".modal");
    assert.ok((await page.textContent(".modal")).includes("Baholar kam"));
    await page.click(".modal [data-x]");
    assert.equal(await page.evaluate(() => S.page), "lesson", "Bekor qilindi — dars yakunlanmadi");
    // 30% baholash — to'xtatmaydi
    await page.evaluate(() => { const c = D.classes[0], t = todayIso(), k = Math.ceil(c.students.length * 0.3); c.students.slice(0, k).forEach((s) => { s.marks[t] = "8"; }); });
    assert.equal(await page.evaluate(() => gradedShare(D.classes[0], todayIso()).ok), true);
    await page.click("[data-next]");
    assert.equal(await page.$(".modal"), null);
    assert.equal(await page.evaluate(() => S.page), "journal");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Bugun: sinflar ko'rsatkichi kartasi (davomat, o'zlashtirish)", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1300, height: 900}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.clock.setFixedTime(new Date(2026, 9, 20, 10, 0));   // chorak ichidagi kun: test sanaga bog'liq bo'lmasin
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    await page.waitForSelector(".clsstat tbody tr");
    assert.equal(await page.locator(".clsstat tbody tr").count(), await page.evaluate(() => D.classes.filter((c) => !isGrp(c)).length));
    assert.ok(await page.locator(".clsstat .bn-tr i").count() > 0);   // davomat va o'zlashtirish chiziqlari (bugun.js)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 1);
    // ta'til kuni (1-chorak 29.10 da tugagan): oy boshidan emas, tugagan chorak natijasi, O'zlashtirish bo'sh emas
    await page.clock.setFixedTime(new Date(2026, 10, 2, 10, 0)); await page.evaluate(() => render());
    await page.waitForSelector(".clsstat tbody tr");
    assert.match(await page.locator(".bn-per").first().textContent(), /1-chorak · 02\.09 – 29\.10/);
    assert.ok(await page.locator(".clsstat tbody tr td:nth-child(3) .bn-mb").count() > 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("KTR: reja boshlanadigan sanani tanlash", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1280, height: 800}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    const ds = await page.evaluate(() => {
      const t = todayIso(), ds = [10, 9, 8, 7, 6, 5].map((n) => iso(addDays(pdate(t), -n)));
      D.classes.push(normalize({web: {dv: 2}, classes: [{name: "KTR", subject: "sinov", dates: ds, students: [{name: "A", marks: {}}]}]}).classes[0]);
      save(); ktrDialog(D.classes.length - 1); return ds;
    });
    await page.fill("#kt", "Mavzu 1\nMavzu 2\nMavzu 3");
    // sana tanlanmasa — bugundan (hamma sana o'tgan, joy yo'q)
    assert.ok((await page.textContent("#kinfo")).includes("bugundan"));
    await page.fill("#kst", ds[2]); await page.dispatchEvent("#kst", "change");
    assert.ok((await page.textContent("#kinfo")).includes("4 ta dars kuni"), await page.textContent("#kinfo"));
    await page.click(".modal [data-ok]");
    const r = await page.evaluate(() => { const c = D.classes[D.classes.length - 1]; return [c.plan.start, Object.entries(c.lessons).filter(([, l]) => l.auto).map(([d, l]) => [d, l.topic]).sort()]; });
    assert.equal(r[0], ds[2]);
    assert.deepEqual(r[1], [[ds[2], "Mavzu 1"], [ds[3], "Mavzu 2"], [ds[4], "Mavzu 3"]]);
    // qayta yuklanganda ham shu sanadan (reflowAll)
    await page.evaluate(() => reflowAll());
    assert.deepEqual(await page.evaluate(() => Object.entries(D.classes[D.classes.length - 1].lessons).filter(([, l]) => l.auto).map(([d, l]) => [d, l.topic]).sort()), r[1]);
    // keyinroq sanaga ko'chirilsa, avvalgi joylashuv qoladigan emas
    await page.evaluate(() => ktrDialog(D.classes.length - 1)); await page.fill("#kst", ds[4]); await page.dispatchEvent("#kst", "change"); await page.click(".modal [data-ok]");
    assert.deepEqual(await page.evaluate(() => Object.entries(D.classes[D.classes.length - 1].lessons).filter(([, l]) => l.auto).map(([d, l]) => [d, l.topic]).sort()), [[ds[4], "Mavzu 1"], [ds[5], "Mavzu 2"]]);
    // «Bugundan» tugmasi sanani tozalaydi
    await page.evaluate(() => ktrDialog(D.classes.length - 1)); await page.click('.modal [data-kst=""]');
    assert.equal(await page.inputValue("#kst"), "");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Jurnal tagida: bugungi dars bo'yicha sinf ma'lumoti kartasi", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1280, height: 800}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    const ci = await page.evaluate(() => {
      const t = todayIso();
      D.classes.push(normalize({web: {dv: 2}, classes: [{name: "8-Z", subject: "Sinov", dates: [t], lessons: {[t]: {topic: "Kasrlar", hw: "12-mashq"}},
        students: [{name: "Aliyev Sardor", marks: {[t]: "9"}}, {name: "Karimova Madina", marks: {[t]: "s"}}, {name: "Rahimov Jasur", marks: {[t]: "kq"}}, {name: "Olimova Nodira", marks: {}}]}]}).classes[0]);
      save(); S.ci = D.classes.length - 1; S.jpage = "j"; V.mode = "week"; go("journal"); return S.ci;
    });
    const txt = await page.textContent(".tdcard");
    assert.ok(txt.includes("Bugungi dars") && txt.includes("Kasrlar") && txt.includes("12-mashq"), txt);
    assert.ok(txt.includes("3/4"), txt);                                              // keldi
    assert.ok(txt.includes("K. Madina (sababsiz)") && txt.includes("R. Jasur"), txt);   // kelmagan va kech qolgan
    assert.ok(txt.includes("1/4 (25%) ⚠") && txt.includes("yana 1 ta"), txt);          // 30% dan kam baholangan
    // kartalar jadval tagida, belgi tugmalari esa katak tanlanmaguncha yo'q
    assert.equal(await page.locator(".keys").count(), 0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 1);
    // guruhda ko'rinmaydi
    await page.evaluate((i) => { D.classes[i].kind = "club"; render(); }, ci);
    assert.equal(await page.locator(".tdcard").count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Jurnal kompyuterda bitta ekranga sig'adi: sahifa na pastga, na yonga suriladi", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const errors = [];
    for (const [w, h] of [[1366, 640], [1280, 800]]) {
      const page = await browser.newPage({viewport: {width: w, height: h}});
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(APP);
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
      await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
      await page.evaluate(() => {
        const t = todayIso(), c = D.classes[0]; if (!c.dates.includes(t)) { c.dates.push(t); c.dates.sort(); }
        while (c.students.length < 18) c.students.push({id: "x" + c.students.length, name: "Test Oquvchi " + c.students.length, marks: {}});
        S.ci = 0; S.page = "journal"; S.jpage = "j"; V.anchor = t; V.mode = "month"; render();
      });
      for (const mode of ["week", "month", "quarter"]) {
        await page.evaluate((m) => { V.mode = m; render(); }, mode);
        const r = await page.evaluate(() => { const tw = document.querySelector("#tw"); return {dy: document.documentElement.scrollHeight - innerHeight, dx: document.documentElement.scrollWidth - innerWidth,
          twx: tw ? tw.scrollWidth - tw.clientWidth : 0, twy: tw ? tw.scrollHeight - tw.clientHeight : 0, rows: tw ? tw.querySelectorAll("td.nm").length : 0}; });
        if (!r.rows) continue;   // tanlangan davrda dars sanasi yo'q
        assert.ok(r.dy <= 1, `${w}x${h} ${mode}: sahifa pastga suriladi (${r.dy}px)`);
        assert.ok(r.dx <= 1 && r.twx <= 1, `${w}x${h} ${mode}: yonga suriladi (${r.dx}/${r.twx})`);
        // past ekranda qator balandligi 26 px dan kichraymaydi: sig'masa jadval ichida suriladi (sahifa surilmaydi)
        if (h >= 800) assert.ok(r.twy <= 1, `${w}x${h} ${mode}: jadval ichida suriladi (${r.twy}px)`);
      }
      await page.close();
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Jurnal jadvali kichrayib ketmaydi: 20 tagacha sig'adi, ko'pida oddiy o'lcham, «Faqat jadval» rejimi", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1300, height: 760}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.clock.setFixedTime(new Date(2026, 9, 20, 10, 0));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    const info = (n) => page.evaluate((n) => {
      const c = D.classes[0]; while (c.students.length < n) c.students.push({id: "x" + c.students.length, name: "Test Oquvchi " + c.students.length, marks: {}});
      S.ci = 0; S.page = "journal"; S.jpage = "j"; V.mode = "week"; V.anchor = todayIso(); render();
      const tw = document.querySelector("#tw"), r = tw.querySelector("td.nm").getBoundingClientRect();
      return {fit: tw.classList.contains("fit"), row: Math.round(r.height), n: tw.querySelectorAll("td.nm").length, jonly: document.body.classList.contains("jonly")};
    }, n);
    let r = await info(18);
    assert.ok(r.fit && r.row >= 24, "18 ta o'quvchi: sig'adi, qator " + JSON.stringify(r));
    r = await info(26);
    assert.ok(!r.fit && r.row >= 24, "26 ta o'quvchi: oddiy o'lcham " + JSON.stringify(r));
    // «Faqat jadval»: yon panel yashiriladi, Esc bilan qaytadi, 26 ta o'quvchi ham sig'diriladi
    assert.ok(await page.isVisible(".side"));
    await page.click("[data-jonly]");
    assert.ok(await page.evaluate(() => document.body.classList.contains("jonly")));
    assert.ok(!(await page.isVisible(".side")), "yon panel yashirilishi kerak");
    r = await page.evaluate(() => { const tw = document.querySelector("#tw"), q = tw.querySelector("td.nm").getBoundingClientRect(); return {fit: tw.classList.contains("fit"), row: Math.round(q.height)}; });
    assert.ok(r.fit && r.row >= 24, "to'liq ekran rejimida 26 ta sig'adi " + JSON.stringify(r));
    await page.keyboard.press("Escape");
    assert.ok(await page.isVisible(".side"), "Esc yon panelni qaytaradi");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Hamma dizaynda tugmalar bir xil: hech biri yo'qolmaydi yoki qirqilmaydi", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    for (const [w, h] of [[1300, 800], [390, 800]]) {
      const sigs = {};
      for (const st of ["dash", "qulay", "zich"]) {
        const page = await browser.newPage({viewport: {width: w, height: h}});
        await page.goto(APP);
        const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
        await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
        await page.evaluate((s) => { D.web.style = s; save(); render(); }, st);
        for (const pg of ["today", "journal", "reports", "settings"]) {
          await page.evaluate((p) => { S.ci = 0; S.jpage = "j"; V.mode = "week"; go(p); }, pg);
          (sigs[pg] ||= {})[st] = await page.evaluate(() => [...document.querySelectorAll("button, a[href], select, input")].filter((e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
            return r.width > 2 && r.height > 2 && cs.visibility !== "hidden" && cs.display !== "none" && e.type !== "hidden"; })
            .map((e) => { const r = e.getBoundingClientRect(), d = [...e.attributes].find((a) => a.name.startsWith("data-"));
              return (r.right > innerWidth + 1 || r.left < -1 || e.scrollWidth > e.clientWidth + 2 ? "!" : "") + e.tagName[0] + ":" + (d ? d.name + "=" + d.value : e.id || (e.textContent || "").trim().slice(0, 14)); }));
        }
        await page.close();
      }
      for (const [pg, v] of Object.entries(sigs)) {
        const all = new Set(Object.values(v).flat());
        for (const st of ["dash", "qulay", "zich"]) assert.deepEqual([...all].filter((x) => !v[st].includes(x)), [], `${w}px ${pg} (${st}): boshqa dizaynda bor, bunda yo'q yoki qirqilgan tugma`);
      }
    }
  } finally { await browser.close(); }
});

test("Sozlamalar: hafta/oy/chorak rejimlarini o'chirib-yoqish, ixcham dizayn va o'xshash shriftlar yo'q, bo'lim tugmalari alohida", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1300, height: 800}});
    const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    // rejimlar: hammasi yoqilgan
    await page.evaluate(() => { S.ci = 0; S.jpage = "j"; V.mode = "week"; go("journal"); });

    // Funksiyalar bo'limida uchta almashtirgich bor; o'chirilsa rejim yo'qoladi
    await page.evaluate(() => { S.sec = 6; go("settings"); });
    for (const id of ["vweek", "vmonth", "vquarter"]) assert.equal(await page.locator(`[data-ft="${id}"]`).count(), 1, id);
    await page.click('[data-ft="vweek"]'); await page.click('[data-ft="vmonth"]');
    assert.deepEqual(await page.evaluate(() => viewModes().map(([k]) => k)), ["day", "quarter"]);
    await page.evaluate(() => { V.mode = "week"; S.jpage = "j"; go("journal"); });
    assert.equal(await page.evaluate(() => V.mode), "day", "o'chirilgan rejim o'rniga kunlik ochiladi");
    await page.click("[data-per]");
    assert.deepEqual(await page.$$eval(".perpop [data-mode]", (x) => x.map((e) => e.dataset.mode)), ["day", "quarter"]);
    await page.keyboard.press("Escape");
    await page.evaluate(() => { S.sec = 6; go("settings"); });
    await page.click('[data-ft="vweek"]'); await page.click('[data-ft="vmonth"]');
    assert.equal(await page.evaluate(() => viewModes().length), 4);
    // eski uslub/bezak tugmalari yo'q, asosiy ko'rinish — TPT (Manrope)
    await page.evaluate(() => { S.sec = 3; go("settings"); });
    assert.equal(await page.locator("[data-deco], [data-sty], [data-dsw]").count(), 0);
    assert.ok(await page.evaluate(() => document.documentElement.classList.contains("tpt-all") && /Manrope/.test(getComputedStyle(document.body).fontFamily)));
    // eski saqlangan qiymatlar tuzatiladi
    const mig = await page.evaluate(() => { const a = migrate(normalize({web: {ui26: 1, font: "times", density: "kompakt"}})).web, b = migrate(normalize({web: {ui26: 1, font: "lsans"}})).web; return [a.font, "density" in a, b.font]; });
    assert.deepEqual(mig, ["lserif", false, "system"]);
    // bo'limlar ro'yxati orqasida fon yo'q; faqat tanlangan bo'lim kartochka bo'lib ajraladi (sozlamalar.js)
    const nb = await page.$eval(".sz-nav", (n) => [getComputedStyle(n).backgroundColor, getComputedStyle(n).boxShadow]);
    assert.deepEqual(nb, ["rgba(0, 0, 0, 0)", "none"], "bo'lim tugmalari ortida fon bo'lmasin");
    const bs = await page.$$eval(".sz-nav .sz-ni", (x) => x.map((b) => [b.classList.contains("on"), getComputedStyle(b).backgroundColor !== "rgba(0, 0, 0, 0)"]));
    assert.ok(bs.length === 7 && bs.every(([on, bg]) => on === bg), JSON.stringify(bs));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Menyu tugmalari: Hisobotlar turlari va Sozlamalar bo'limlari bir xil o'lchamda (telefon va kompyuter)", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    for (const [w, h] of [[390, 844], [1300, 800]]) {
      const page = await browser.newPage({viewport: {width: w, height: h}});
      const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(APP);
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
      await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
      const sizes = async (sel) => page.$$eval(sel, (x) => x.filter((b) => b.offsetParent).map((b) => { const r = b.getBoundingClientRect(), i = b.querySelector(".ic, .si, .sz-ic").getBoundingClientRect(); return [Math.round(r.height), Math.round(i.width), parseFloat(getComputedStyle(b.querySelector("b, .sn")).fontSize)]; }));
      // Hisobotlar (hisobotlar.js): kompyuterda chap ro'yxat, telefonda «Almashtirish» oynasi — hammasi bir xil, yozuv bir qatorda
      await page.evaluate(() => go("reports"));
      if (w < 821) await page.click("[data-hk=kind]");
      const rep = await page.$$eval(w < 821 ? ".modal .hb-kt" : ".hb-ri", (x) => x.filter((b) => b.offsetParent).map((b) => { const r = b.getBoundingClientRect(), i = b.querySelector(".hb-ic").getBoundingClientRect(), t = b.querySelector("b");
        return [Math.round(r.height), Math.round(i.width), parseFloat(getComputedStyle(t).fontSize), t.getBoundingClientRect().height < parseFloat(getComputedStyle(t).fontSize) * 1.8]; }));
      assert.equal(rep.length, 8);
      for (const k of [0, 1, 2]) assert.equal(new Set(rep.map((x) => x[k])).size, 1, `${w}px: hisobot turlari bir xil emas ${JSON.stringify(rep)}`);
      assert.ok(rep.every((x) => x[3]), `${w}px: hisobot nomi bir qatorga sig'masin`);
      if (w < 821) await page.keyboard.press("Escape");
      await page.evaluate((ph) => { S.sec = ph ? -1 : 0; go("settings"); }, w < 821);   // telefonda — bo'limlar ro'yxati
      const set = await sizes(".sz-ni");
      assert.ok(set.length >= 6);
      const all = set;
      assert.equal(new Set(all.map((x) => x[1])).size, 1, `${w}px: belgi o'lchami bir xil emas ${JSON.stringify(all.map((x) => x[1]))}`);
      assert.equal(new Set(all.map((x) => x[2])).size, 1, `${w}px: yozuv o'lchami bir xil emas`);
      if (w < 560) assert.equal(new Set(all.map((x) => x[0])).size, 1, `${w}px: tugma balandligi bir xil emas ${JSON.stringify(all.map((x) => x[0]))}`);
      assert.ok(Math.min(...all.map((x) => x[0])) >= 56);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});

test("BSB tahlili: ball maksimaldan oshmaydi (yozishda, joylashda, maksimal kamayganda, saqlashda), to'liq ballda keyingi katakka o'tadi", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1300, height: 800}});
    const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    await page.evaluate(() => { D.settings.protect.enabled = false; });
    await page.click(".side [data-go=journal]"); await page.click("[data-jp=bsb]"); await page.waitForSelector("table.bsa");
    const pts = () => page.evaluate(() => { const B = S.bas[label(D.classes[S.ci])]; return D.classes[S.ci].students.slice(0, 3).map((s) => (B.rows[s.name] || {pts: []}).pts.slice(0, 3)); });
    const mx = await page.evaluate(() => S.bas[label(D.classes[S.ci])].max.slice(0, 3));
    assert.equal(await page.getAttribute('[data-bp="0|0"]', "placeholder"), `/${mx[0]}`);
    // maksimaldan katta ball yozilsa, maksimal qo'yiladi
    await page.fill('[data-bp="0|0"]', "9");
    assert.equal(await page.inputValue('[data-bp="0|0"]'), String(mx[0]));
    assert.equal((await pts())[0][0], mx[0]);
    // to'liq ball yozilganda fokus keyingi katakka o'tadi
    assert.equal(await page.evaluate(() => document.activeElement.dataset.bp), "0|1");
    // kasr yozish xalaqit bermaydi (maksimaldan kichik)
    await page.focus('[data-bp="1|0"]'); await page.keyboard.type("1,5");
    assert.equal(await page.evaluate(() => document.activeElement.dataset.bp), "1|0");
    await page.keyboard.press("Tab");
    assert.equal((await pts())[1][0], 1.5);
    // Excel'dan joylash ham maksimaldan oshmaydi
    await page.evaluate(() => { const i = document.querySelector('[data-bp="2|0"]'); i.focus(); const dt = new DataTransfer(); dt.setData("text", "50\t60\n"); i.dispatchEvent(new ClipboardEvent("paste", {clipboardData: dt, bubbles: true, cancelable: true})); });
    assert.deepEqual((await pts())[2].slice(0, 2), [mx[0], mx[1]]);
    // maksimal kamaytirilsa, undan oshgan ballar tushiriladi
    await page.fill('[data-bx="0"]', "1"); await page.press('[data-bx="0"]', "Tab");
    assert.deepEqual((await pts()).map((r) => r[0]), [1, 1, 1]);
    // saqlashda ham
    await page.evaluate(() => { const B = S.bas[label(D.classes[S.ci])]; const s = D.classes[S.ci].students[0]; B.rows[s.name].pts[1] = 999; });
    await page.click("[data-bsave]");
    const saved = await page.evaluate((m) => D.classes[S.ci].analyses.at(-1).rows[D.classes[S.ci].students[0].name].pts[1] <= m, mx[1]);
    assert.ok(saved, "saqlangan ball maksimaldan oshmasin");
    // «max» tugmasi: hamma savolga maksimal ball
    await page.click('[data-bmax="3"]');
    const full = await page.evaluate(() => { const B = S.bas[label(D.classes[S.ci])], s = D.classes[S.ci].students[3]; return JSON.stringify(B.rows[s.name].pts) === JSON.stringify(B.max); });
    assert.ok(full, "max tugmasi hamma savolga maksimal ball yozsin");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("BSB tahlili: katakni bosganda 0 dan maksimalgacha sonlar oynasi chiqadi, tanlansa keyingi katakka o'tadi", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    for (const [w, h] of [[1300, 800], [390, 844]]) {
      const page = await browser.newPage({viewport: {width: w, height: h}});
      const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(APP);
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
      await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
      await page.evaluate(() => { D.settings.protect.enabled = false; S.ci = 0; S.jpage = "bsb"; go("journal"); });
      await page.waitForSelector("table.bsa");
      const max0 = await page.evaluate(() => S.bas[label(D.classes[S.ci])].max[0]);
      assert.equal(await page.locator(".bpop").count(), 0);
      await page.click('[data-bp="0|0"]');
      await page.waitForSelector(".bpop");
      assert.equal(await page.locator(".bpop [data-pv]").count(), Math.floor(max0) + 1, `${w}px: 0 dan ${max0} gacha`);
      const box = await page.evaluate(() => { const r = document.querySelector(".bpop").getBoundingClientRect(); return [r.left >= 0, r.right <= innerWidth, r.top >= 0, r.bottom <= innerHeight]; });
      assert.deepEqual(box, [true, true, true, true], `${w}px: oyna ekrandan chiqib ketdi`);
      // son tanlansa katakka yoziladi va fokus keyingi katakka o'tadi, oyna ham o'sha yerda
      await page.click(`.bpop [data-pv="${max0}"]`);
      assert.equal(await page.evaluate(() => { const B = S.bas[label(D.classes[S.ci])], s = D.classes[S.ci].students[0]; return B.rows[s.name].pts[0]; }), max0);
      assert.equal(await page.inputValue('[data-bp="0|0"]'), String(max0));
      await page.waitForFunction(() => document.activeElement.dataset.bp === "0|1");
      await page.waitForSelector(".bpop");
      assert.equal(await page.locator(".bpop").count(), 1);
      // Esc oynani yopadi
      await page.keyboard.press("Escape");
      assert.equal(await page.locator(".bpop").count(), 0);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});

test("CHSB testi: to'g'ri javob belgilanadi, o'quvchi varianti mos kelsa maksimal ball, aks holda 0", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1300, height: 800}});
    const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    await page.evaluate(() => { D.settings.protect.enabled = false; const c = D.classes[S.ci]; c.works.push({id: "wt1", type: "chsb", date: todayIso(), max: 10, title: "Test"}); save(); });
    await page.click(".side [data-go=journal]"); await page.click("[data-jp=chsbt]"); await page.waitForSelector("table.tst");
    await page.fill("#tn", "5"); await page.press("#tn", "Tab"); await page.waitForSelector('[data-tk="4"]');
    assert.equal(await page.locator("[data-tk]").count(), 5);
    // to'g'ri javoblar: A B C D A (har biri raqam ham bo'lishi mumkin: 2 = B)
    await page.focus('[data-tk="0"]'); await page.keyboard.type("A2CDa");
    assert.equal(await page.evaluate(() => D.classes[S.ci].works.find((w) => w.id === "wt1").test.key), "ABCDA");
    // 1-o'quvchi: A B C C . → 3 ta to'g'ri = 6 ball
    await page.focus('[data-ta="0|0"]'); await page.keyboard.type("ABCC");
    assert.equal(await page.evaluate(() => document.activeElement.dataset.ta), "0|4");
    const sc = () => page.evaluate(() => D.classes[S.ci].students.slice(0, 2).map((s) => (s.scores || {}).wt1 ?? null));
    assert.equal((await sc())[0], 6);
    // yaroqsiz variant qabul qilinmaydi
    await page.fill('[data-ta="1|0"]', "Z"); assert.equal(await page.inputValue('[data-ta="1|0"]'), "");
    // 2-o'quvchi hammasi to'g'ri = maksimal
    await page.focus('[data-ta="1|0"]'); await page.keyboard.type("ABCDA");
    assert.equal((await sc())[1], 10);
    // to'g'ri javob o'zgarsa ballar qayta hisoblanadi
    await page.fill('[data-tk="4"]', "B"); await page.waitForTimeout(100);
    assert.deepEqual(await sc(), [6, 8]);
    // savollarga turlicha ball: 1-savol 3 ball (qolganlari 2) → 3+2+2 va 3+2+2+2
    await page.fill('[data-tp="0"]', "3"); await page.press('[data-tp="0"]', "Tab"); await page.waitForTimeout(100);
    assert.deepEqual(await sc(), [7, 9]);
    assert.ok(await page.evaluate(() => document.querySelector("[data-psum]").classList.contains("warn")), "yig'indi 11/10 — ogohlantirish");
    // saqlash tugmasi bor va ishlaydi
    await page.click("[data-tsave]"); await page.waitForSelector("text=CHSB testi saqlandi");
    assert.equal((await page.textContent("#tsaved")).trim(), "✓ saqlangan");
    // maksimaldan katta ball qabul qilinmaydi
    await page.fill('[data-tp="1"]', "99"); await page.press('[data-tp="1"]', "Tab");
    assert.equal(await page.inputValue('[data-tp="1"]'), "2");
    // teng taqsimlash
    await page.click("[data-peq]"); await page.waitForTimeout(100);
    assert.deepEqual(await sc(), [6, 8]);
    // umumiy ball yuqoriga butunga yaxlitlanadi: 3 savol, 10 ball → bittasi to'g'ri 3,33 → 4
    await page.click("[data-peq]"); await page.waitForTimeout(100);
    await page.fill("#tn", "3"); await page.press("#tn", "Tab"); await page.waitForSelector('[data-tk="2"]');
    await page.focus('[data-ta="2|0"]'); await page.keyboard.type("A");
    const s3 = () => page.evaluate(() => (D.classes[S.ci].students[2].scores || {}).wt1 ?? null);
    assert.equal(await s3(), 4);
    await page.focus('[data-ta="2|1"]'); await page.keyboard.type("B");
    assert.equal(await s3(), 7);   // 6,67 → 7
    // chop etish/eksport tahlili ham yaxlitlangan: ekrandagi bilan bir xil butun ball
    const an = await page.evaluate(() => { const c = D.classes[S.ci], w = c.works.find((x) => x.id === S.tw), B = chsbB(c, w), a = baAnalysis(c, B); return {tot: a.tot_max, st: a.students.slice(0, 3).map((s) => s.total), sc: c.students.slice(0, 3).map((s) => (s.scores || {})[w.id] ?? null)}; });
    assert.equal(an.tot, 10);
    assert.ok(an.st.every((v) => Number.isInteger(v)), JSON.stringify(an));
    assert.deepEqual(an.st, an.sc.map((v) => v ?? 0));
    // eksport fayl nomi: sinf_fan_sana_IshTuri (Excel va PDF)
    const fn = await page.evaluate(() => { const c = D.classes[S.ci], w = c.works.find((x) => x.id === S.tw), B = chsbB(c, w); window.print = () => { window.__pt = document.title; }; printDoc("<p>x</p>", false, false, baFileBase(c, B)); return {n: baFileBase(c, B), t: window.__pt, exp: `${c.name}_${c.subject}_${w.date}_CHSB`.replace(/ /g, "-")}; });
    assert.equal(fn.n, fn.exp); assert.equal(fn.t, fn.exp); assert.ok(/^[^_]+_[^_]+_\d{4}-\d{2}-\d{2}_CHSB$/.test(fn.n), fn.n);
    // «max» tugmasi: hamma savolga to'g'ri javob → to'liq ball (10), o'quvchi bo'sh bo'lsa ham
    await page.click('[data-tmax="4"]');
    assert.equal(await page.evaluate(() => (D.classes[S.ci].students[4].scores || {}).wt1 ?? null), 10);
    // «BSB / CHSB» sahifasida ham ko'rinadi
    await page.click("[data-jp=sum]"); await page.waitForSelector("table.sum");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("CHSB testi: ishtirok, % va baho, tahlil, xatolar kesimi, joylash, variant oynasi, yangi va o'chirish, eksport", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1300, height: 800}});
    const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    await page.evaluate(() => { D.settings.protect.enabled = false; });
    await page.click(".side [data-go=journal]"); await page.click("[data-jp=chsbt]"); await page.waitForSelector("[data-newt]");
    // yangi test yaratiladi (maksimal ball 40), 4 ta savol
    await page.click("[data-newt]"); await page.waitForSelector("table.tst");
    await page.fill("#tt", "Kasrlar"); await page.fill("#tn", "4"); await page.press("#tn", "Tab"); await page.waitForSelector('[data-tk="3"]');
    const W = () => page.evaluate(() => { const c = D.classes[S.ci], w = c.works.find((x) => x.id === S.tw); return {title: w.title, max: w.max, key: w.test && w.test.key, sc: c.students.slice(0, 3).map((s) => (s.scores || {})[w.id] ?? null)}; });
    // to'g'ri javoblar va Excel'dan bitta qatorni joylash (1-o'quvchi ABCD, 2-o'quvchi AAAA)
    await page.focus('[data-tk="0"]'); await page.keyboard.type("ABCD");
    await page.evaluate(() => { const i = document.querySelector('[data-ta="0|0"]'); i.focus(); const dt = new DataTransfer(); dt.setData("text", "A\tB\tC\tD\nA\tA\tA\tA\n"); i.dispatchEvent(new ClipboardEvent("paste", {clipboardData: dt, bubbles: true, cancelable: true})); });
    await page.waitForSelector('[data-ta="1|3"]');
    let w = await W(); assert.equal(w.key, "ABCD"); assert.deepEqual(w.sc, [40, 10, null]);
    // % va baho ko'rinadi
    assert.equal((await page.textContent('[data-row="0"] [data-pct]')).trim(), "100%");
    assert.equal((await page.textContent('[data-row="1"] [data-pct]')).trim(), "25%");
    assert.ok((await page.innerText('[data-row="0"] [data-g]')).includes("5"));
    // variant oynasi: katakni bosganda harflar chiqadi, tanlansa yoziladi
    await page.click('[data-ta="2|0"]'); await page.waitForSelector(".bpop");
    assert.equal(await page.locator(".bpop [data-pl]").count(), 5);   // A B C D + tozalash
    await page.click('.bpop [data-pl="A"]');
    w = await W(); assert.equal(w.sc[2], 10);
    assert.equal(await page.evaluate(() => document.activeElement.dataset.ta), "2|1");
    // ishtirok etmadi: 2-o'quvchi balli o'chadi
    await page.click('[data-tin="1"]'); await page.waitForSelector('[data-row="1"].off');
    w = await W(); assert.equal(w.sc[1], null);
    await page.click('[data-tin="1"]'); await page.waitForSelector('[data-row="1"]:not(.off)');
    w = await W(); assert.equal(w.sc[1], 10);
    // tahlil va xatolar kesimi
    await page.click('[data-ctab="an"]'); await page.waitForSelector(".paper");
    assert.ok((await page.innerText(".paper")).includes("CHSB tahlili"));
    await page.click('[data-ctab="er"]'); await page.waitForSelector(".paper");
    const er = await page.innerText(".paper");
    assert.ok(er.includes("Variantlar bo'yicha taqsimot") && er.includes("To'g'ri %"));
    // eksport oynasi
    await page.click("[data-bexp]"); await page.waitForSelector("text=CHSB tahlilini eksport qilish"); await page.click("[data-x]");
    // o'chirish
    await page.click("[data-tdel]"); await page.click("text=O'chirish >> nth=-1");
    await page.waitForFunction(() => !D.classes[S.ci].works.some((x) => x.title === "Kasrlar"));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("O'chirilgan BSB/CHSB qayta paydo bo'lmaydi: KTR rejasi va eMaktab importi o'tkazib yuboradi", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1300, height: 800}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.clock.setFixedTime(new Date(2026, 9, 20, 10, 0));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    const r = await page.evaluate(() => {
      const c = D.classes[0], d = c.dates.find((x) => x >= "2026-09-10" && !isNoLesson(c, x)), keys = () => c.works.map((w) => `${w.type}|${w.date}`);
      const slots = [{text: "BSB-1", q: null}];
      c.lessons[d] = {topic: "BSB-1", hw: "", auto: true, si: 0};
      const out = {};
      planWorks(c, slots); out.created = keys().includes(`bsb|${d}`);
      const w = c.works.find((x) => x.type === "bsb" && x.date === d); removeWork(c, w);
      planWorks(c, slots); out.afterPlan = keys().includes(`bsb|${d}`);
      // eMaktab importi o'chirilgan ishni qayta qo'shmaydi
      const before = c.works.length; mergeImport({name: c.name, subject: c.subject, dates: [], students: [], works: [{type: "bsb", date: d, max: 25, title: ""}]}, false);
      out.afterImport = c.works.length - before;
      // qo'lda yangidan qo'shilsa — endi qayta ishlaydi
      reviveWork(c, "bsb", d); mergeImport({name: c.name, subject: c.subject, dates: [], students: [], works: [{type: "bsb", date: d, max: 25, title: ""}]}, false);
      out.revived = keys().includes(`bsb|${d}`); out.wdel = (c.wdel || []).length;
      return out;
    });
    assert.equal(r.created, true); assert.equal(r.afterPlan, false, "KTR rejasi o'chirilgan ishni qayta yaratmasin");
    assert.equal(r.afterImport, 0, "import o'chirilgan ishni qayta qo'shmasin"); assert.equal(r.revived, true); assert.equal(r.wdel, 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("eMaktab importi kundalik baholarni to'liq almashtiradi, BSB/CHSB ballariga tegmaydi", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1300, height: 800}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.clock.setFixedTime(new Date(2026, 9, 20, 10, 0));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    const r = await page.evaluate(() => {
      const c = D.classes[0], s = c.students[0], [d1, d2, d3, d4] = c.dates.filter((x) => !isNoLesson(c, x)).slice(0, 4);
      const w = {id: newWorkId(c), type: "bsb", date: d4, max: 25, title: ""}; c.works.push(w);
      s.marks = {[d1]: "5", [d2]: "7", [d3]: "9", [d4]: "6"}; s.fp = {[d1]: [3, 2], [d2]: [4, 3]}; s.scores = {[w.id]: 20};
      const rep = mergeImport({name: c.name, subject: c.subject, dates: [d2, d3], skipped: {},
        students: [{name: s.name, marks: {[d2]: "8"}, scores: {[`bsb|${d4}`]: 11}}], works: [{type: "bsb", date: d4, max: 25, title: ""}]}, true);
      return {marks: {...s.marks}, fp: {...s.fp}, score: s.scores[w.id], removed: rep.removed, replaced: rep.replaced, d: [d1, d2, d3, d4]};
    });
    const [d1, d2, d3, d4] = r.d;
    assert.deepEqual(r.marks, {[d1]: "5", [d2]: "8", [d4]: "6"}, "oraliqdagi baho almashtirildi/o'chirildi, oraliqdan tashqarisi qoldi");
    assert.deepEqual(r.fp, {[d1]: [3, 2]}, "almashtirilgan bahoning mezon qismlari tozalandi");
    assert.equal(r.score, 20, "BSB balli o'zgarmadi"); assert.equal(r.removed, 1); assert.equal(r.replaced, 1);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Xavf turlarini tanlash: har tur alohida yoqiladi, chegarasi o'zgaradi, tayyor to'plamlar", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1300, height: 900}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.clock.setFixedTime(new Date(2026, 9, 20, 10, 0));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    await page.evaluate(() => { S.sec = 2; go("settings"); });
    assert.equal(await page.locator("[data-rkon]").count(), 9, "9 ta xavf turi");
    // sinf o'quvchisi uchun sun'iy holat: davomati past, baholari yaxshi
    const setup = () => page.evaluate(() => {
      const c = D.classes[0], s = c.students[0], ds = c.dates.filter((d) => d <= todayIso() && !isNoLesson(c, d)).slice(-10); s.marks = {};
      ds.forEach((d, i) => s.marks[d] = i < 5 ? "s" : "9");
      const [lo, hi, q] = periodNow(); const row = reportRows(c, "2000-01-01", todayIso(), q).rows[0]; return row.why;
    });
    const why1 = await setup(); assert.ok(why1.some((x) => x.startsWith("davomat")), "davomat xavfi yoqilgan");
    await page.click('[data-rkon="att"]'); await page.click('[data-rkon="s"]');
    assert.equal(await page.evaluate(() => D.settings.risk.on.att), false);
    const why2 = await setup(); assert.ok(!why2.some((x) => x.startsWith("davomat") || x.startsWith("sababsiz")), "o'chirilgan turlar xavf bermaydi");
    // chegara (o'chiq turning chegarasi ko'rinmaydi — avval yoqiladi)
    if (await page.getAttribute('[data-rkon="consec"]', "aria-checked") !== "true") await page.click('[data-rkon="consec"]');
    await page.fill('[data-rk="consec_ge"]', "4"); await page.dispatchEvent('[data-rk="consec_ge"]', "change");
    assert.equal(await page.evaluate(() => D.settings.risk.consec_ge), 4);
    // tayyor to'plamlar
    await page.click('[data-rkpre="all"]'); assert.equal(await page.evaluate(() => Object.values(D.settings.risk.on).filter(Boolean).length), 9);
    await page.click('[data-rkpre="none"]'); assert.equal(await page.evaluate(() => Object.values(D.settings.risk.on).filter(Boolean).length), 0);
    await page.click('[data-rkpre="att"]'); assert.deepEqual(await page.evaluate(() => Object.entries(D.settings.risk.on).filter(([, v]) => v).map(([k]) => k).sort()), ["att", "consec", "s"]);
    await page.click('[data-rkpre="default"]'); assert.equal(await page.evaluate(() => D.settings.risk.on.att && !D.settings.risk.on.consec), true);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Hisobotda xavf turi bo'yicha saralash", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1300, height: 900}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.clock.setFixedTime(new Date(2026, 9, 20, 10, 0));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    await page.evaluate(() => {
      const c = D.classes[0], ds = c.dates.filter((d) => d <= todayIso() && !isNoLesson(c, d)).slice(-10);
      c.students.forEach((s, k) => { s.marks = {}; ds.forEach((d, i) => s.marks[d] = k === 0 && i < 5 ? "s" : "9"); });
      S.rep.band = "cls"; S.rep.kind = "cls"; S.rep.ci = 0; S.rep.per = "all"; S.rtype = ""; save(); go("reports");
    });
    const all = await page.locator("table.rcls tr").count();
    // xavf turi — «Saralash» oynasida (hisobotlar.js)
    await page.click("[data-hk=sort]:visible"); await page.click(".hb-popw [data-ho=type][data-v=att]");
    const n = await page.locator("table.rcls tr").count();
    assert.ok(n < all && n >= 2, `davomat bo'yicha ${n} < ${all}`);   // sarlavha + kamida 1 o'quvchi (jami qatori yo'q)
    assert.ok((await page.locator("table.rcls td.warn").allTextContents()).every((t) => t.includes("davomat")));
    await page.click("[data-hk=sort]:visible"); await page.click(".hb-popw [data-ho=type][data-v=drop]");
    assert.equal(await page.locator("table.rcls td.warn").count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});


test("Guruhlar faqat o'z bo'limida: boshqa sahifalarda ko'rinmaydi, saqlangan guruh ma'lumoti (to'lov, davomat) yo'qolmaydi", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1280, height: 900}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.clock.setFixedTime(new Date(2026, 9, 20, 10, 0));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    const gsrc = {name: "Ingliz kursi", subject: "Ingliz tili", kind: "paid", fee: {month: 0, day: 10000}, dueDay: 12, rule: {sz: "free", sb: "charge"}, dates: ["2026-10-05", "2026-10-06"],
      packs: [{id: "pk1", name: "Standart", n: 8, sum: 400000}], wdel: [],
      students: [{name: "Guruh Talabasi", plan: {t: "day", sum: 10000}, pkg: "pk1", marks: {"2026-10-05": "ot"}, abs: {"2026-10-06": "sz"}, pays: [{id: "p1", no: 1, d: "2026-10-09", m: "2026-10", sum: 10000, how: "Naqd"}]}]};
    const clubSrc = {name: "Shaxmat", kind: "club", dates: ["2026-10-05"], students: [{name: "A'zo Birinchi", marks: {"2026-10-05": "ot"}, ach: [{d: "2026-10-05", t: "Tuman musobaqasi", k: "Musobaqa", lvl: "Tuman", pl: "1-o'rin"}]}]};
    const before = await page.evaluate((g) => { D.classes.push(...normalize({classes: g}).classes); D.fin = cleanFin({exp: [{id: "x1", d: "2026-10-12", cat: "Ijara", sum: 5000, note: "xona"}]}); save(); return D.classes.length; }, [gsrc, clubSrc]);
    // boshqa sahifalar xatosiz ochiladi va guruh nomi ko'rinmaydi (guruhlar — faqat «Guruhlar» bo'limida, guruhlar.js)
    for (const pg of ["today", "journal", "reports", "settings"]) {
      await page.evaluate((p) => { S.ci = D.classes.length - 2; S.jpage = "cards"; go(p); }, pg);
      const txt = await page.evaluate(() => document.querySelector("main").textContent);
      assert.ok(!txt.includes("Ingliz kursi") && !txt.includes("Shaxmat"), `${pg}: guruh ko'rinib qolgan`);
    }
    assert.equal(await page.locator('[data-go="groups"]').count(), 2, "menyuda (yon panel va pastki tablar) «Guruhlar» bor");
    await page.evaluate(() => go("groups"));
    const gtxt = await page.evaluate(() => document.querySelector("main").textContent);
    assert.ok(gtxt.includes("Ingliz kursi") && gtxt.includes("Shaxmat"), "eski guruhlar «Guruhlar» bo'limida ko'rinadi");
    assert.equal(await page.evaluate(() => D.classes[S.ci].kind || "sinf"), "sinf", "jurnal faqat oddiy sinfni ochadi");
    // saqlash/yuklash va fayl orqali ma'lumot saqlanadi
    const kept = await page.evaluate(() => { const d = normalize(JSON.parse(JSON.stringify(D))), g = d.classes.find((c) => c.name === "Ingliz kursi"), k = d.classes.find((c) => c.name === "Shaxmat"), s = g.students[0];
      return [d.classes.length, s.pays[0].sum, s.marks["2026-10-05"], s.abs["2026-10-06"], g.dueDay, g.rule.sz, g.packs[0].n, k.students[0].ach.length, d.fin.exp[0].sum]; });
    assert.deepEqual(kept, [before, 10000, "ot", "sz", 12, "free", 8, 1, 5000]);
    // eksport matnida guruh ma'lumoti bor
    const txt = await page.evaluate(() => JSON.stringify(D));
    assert.ok(txt.includes("Ingliz kursi") && txt.includes("Shaxmat") && txt.includes('"sum":10000'));
    assert.deepEqual(errors, []);
    // faqat guruhlari bor foydalanuvchi: «Bugun» boshlang'ich oynasi, xatosiz
    await page.evaluate(() => { D.classes = D.classes.filter((c) => c.kind); S.ci = 0; save(); go("today"); });
    assert.ok((await page.evaluate(() => document.querySelector("main").textContent)).length > 20);
    for (const pg of ["journal", "reports", "settings"]) await page.evaluate((p) => go(p), pg);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

// Guruhlar bo'limi (docs/guruhlar.js): yangi guruh, o'quvchi, to'lov, yo'qlama; eski oylik narxli guruh paketga o'tadi
for (const [name, viewport] of [["kompyuter", {width: 1300, height: 860}], ["telefon", {width: 390, height: 844}]]) {
  test(`${name}: Guruhlar — guruh, o'quvchi, to'lov va yo'qlama`, async () => {
    const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
    try {
      const page = await browser.newPage({viewport});
      const errors = []; page.on("pageerror", (e) => errors.push(e.message));
      await page.clock.setFixedTime(new Date(2026, 10, 2, 10, 0));   // dushanba
      await page.goto(APP);
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
      await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
      // eski ma'lumot: oylik narxli o'quvchi, to'lovida dars soni yozilmagan
      await page.evaluate(() => {
        const marks = {}; for (const d of ["2026-10-26", "2026-10-28", "2026-10-30"]) marks[d] = "ot";
        D.classes.push(normalize({classes: [{name: "Eski guruh", subject: "", kind: "paid", pack: 8, weekdays: [0, 2, 4], dates: Object.keys(marks),
          students: [{id: "old1", name: "Eski O'quvchi", marks, plan: {t: "month", sum: 400000}, pays: [{id: "op1", d: "2026-10-01", m: "2026-10", sum: 400000}]}]}]}).classes[0]);
        save();
      });
      await page.click(`${name === "telefon" ? ".tabbar" : ".side"} [data-go=groups]`);
      await page.waitForSelector(".tpt .g-gcard");
      // eski guruh: «Oylik» paketi (8 dars = 400 000) yaratiladi, 8 − 3 = 5 dars qoladi
      await page.click(".g-gcard");
      assert.equal(await page.evaluate(() => { const c = D.classes.find((x) => x.name === "Eski guruh"); return [c.packs[0].name, c.packs[0].n, TPT.acct(c, c.students[0]).left].join("|"); }), "Oylik|8|5");
      assert.deepEqual(await page.evaluate(() => TPT.daysOf(D.classes.find((x) => x.name === "Eski guruh"))), [1, 3, 5]);
      await page.click("[data-home]");
      // yangi guruh
      await page.click("[data-new]");
      await page.fill("#g-n", "Ingliz tili A1");
      await page.fill(".g-pk .pc", "8"); await page.fill(".g-pk .ps", "400000");
      await page.click(".g-dlg [data-save]");
      await page.waitForSelector("text=O'quvchi qo'shish");
      // o'quvchi + birinchi to'lov
      await page.click("[data-addst]"); await page.fill("#g-an", "Aziza Karimova"); await page.fill("#g-ap", "901234567");
      // qo'shilgan sana — o'z kalendarimizdan; ism va telefon saqlanib qoladi
      await page.click("#g-aj"); await page.click(".g-dlg [data-m='2026-10']"); await page.click(".g-dlg [data-day='2026-10-26']");
      await page.waitForSelector("#g-aj >> text=26 oktabr");
      assert.equal(await page.inputValue("#g-an"), "Aziza Karimova");
      await page.click(".g-dlg [data-save]");
      await page.waitForSelector(".g-dlg [aria-label=\"To'lov qabul qilish\"], .g-dlg >> text=To'lov qabul qilish");
      await page.click(".g-dlg [data-how=Click]"); await page.click(".g-dlg [data-save]");
      const st = await page.evaluate(() => { const c = D.classes.find((x) => x.name === "Ingliz tili A1"), s = c.students[0]; return {kind: c.kind, days: c.gdays, phone: s.par.phone, joined: s.joined, pays: s.pays.map((p) => [p.sum, p.pk, p.how, p.d]), left: TPT.acct(c, s).left}; });
      assert.deepEqual(st, {kind: "paid", days: [1, 3, 5], phone: "+998901234567", joined: "2026-10-26", pays: [[400000, 8, "Click", "2026-11-02"]], left: 8});
      // yo'qlama: bugun keldi → 7 dars qoladi; yana bosish — bekor
      await page.click("[data-tab=att]");
      await page.click("[data-came='0']");
      assert.equal(await page.evaluate(() => { const c = D.classes.find((x) => x.name === "Ingliz tili A1"); return c.students[0].marks["2026-11-02"] + "|" + TPT.acct(c, c.students[0]).left; }), "ot|7");
      await page.click("[data-came='0']");
      assert.equal(await page.evaluate(() => TPT.acct(D.classes.find((x) => x.name === "Ingliz tili A1"), D.classes.find((x) => x.name === "Ingliz tili A1").students[0]).left), 8);
      // o'quvchi oynasi va to'lovlar tarixi
      await page.click("[data-tab=stu]"); await page.click("[data-open='0']"); await page.waitForSelector(".g-drawer");
      // o'quvchi kalendari: o'tgan kunni bosish — keldi, yana bosish — bekor; kelajak kunlar bosilmaydi
      await page.click(".g-drawer [data-cd='2026-11-02']");
      assert.equal(await page.evaluate(() => { const c = D.classes.find((x) => x.name === "Ingliz tili A1"); return c.students[0].marks["2026-11-02"] + "|" + TPT.acct(c, c.students[0]).left; }), "ot|7");
      assert.equal(await page.getAttribute(".g-drawer [data-cd='2026-11-02']", "aria-pressed"), "true");
      assert.equal(await page.locator(".g-drawer [data-cd='2026-11-03']").count(), 0);
      await page.click(".g-drawer [data-m='2026-10']"); await page.click(".g-drawer [data-cd='2026-10-30']");
      assert.equal(await page.evaluate(() => Object.keys(D.classes.find((x) => x.name === "Ingliz tili A1").students[0].marks).sort().join(",")), "2026-10-30,2026-11-02");
      await page.click(".g-drawer [data-cd='2026-10-30']"); await page.click(".g-drawer [data-m='2026-11']"); await page.click(".g-drawer [data-cd='2026-11-02']");
      assert.equal(await page.evaluate(() => Object.keys(D.classes.find((x) => x.name === "Ingliz tili A1").students[0].marks).length), 0);
      await page.keyboard.press("Escape");
      // Yo'qlama → Kun: oylik kalendar doim ko'rinadi; kelajak kun bosilmaydi; oldingi oyga o'tib kun tanlanadi
      await page.click("[data-tab=att]"); await page.waitForSelector(".g-mcal");
      assert.ok(await page.locator(".g-mcal [data-pick='2026-11-03']").isDisabled());
      await page.click("[data-mo='-1']"); await page.click(".g-mcal [data-pick='2026-10-28']");
      await page.waitForSelector(".g-dc.sel[data-pick='2026-10-28']");
      await page.click("[data-came='0']");
      assert.equal(await page.evaluate(() => D.classes.find((x) => x.name === "Ingliz tili A1").students[0].marks["2026-10-28"]), "ot");
      await page.waitForSelector(".g-dc.sel[data-pick='2026-10-28'] >> text=1/1");
      // Oy jadvali: katak bosilsa keldi / bekor; jadvaldan tashqari kun (shanba) ham bosilgan bo'lsa ustun bo'lib chiqadi
      await page.click("[data-av=grid]"); await page.waitForSelector(".g-mtab");
      assert.equal(await page.getAttribute("[data-cell='0|2026-10-28']", "aria-pressed"), "true");
      await page.click("[data-cell='0|2026-10-28']"); await page.click("[data-cell='0|2026-10-30']");
      assert.equal(await page.evaluate(() => Object.keys(D.classes.find((x) => x.name === "Ingliz tili A1").students[0].marks).join(",")), "2026-10-30");
      assert.equal(await page.locator("[data-cell='0|2026-10-31']").count(), 0);
      await page.click("[data-cell='0|2026-10-30']");
      // qo'shilishdan oldingi kunlar: jadvalda katak yo'q, kun ro'yxatida o'quvchi ko'rinmaydi
      assert.equal(await page.locator("[data-cell='0|2026-10-23']").count(), 0);
      await page.click("[data-av=day]"); await page.click(".g-mcal [data-pick='2026-10-23']");
      assert.equal(await page.locator("[data-came='0']").count(), 0);
      await page.click(".g-mcal [data-pick='2026-10-26']"); await page.waitForSelector("[data-came='0']");
      await page.click("[data-av=grid]");
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(ov <= 1, `oy jadvali sahifani ${ov}px kengaytirdi`);
      await page.click("[data-av=day]");
      // to'lov oynasida «Boshqa kun» ham shu kalendar: tanlansa to'lov oynasiga qaytadi
      await page.click("[data-tab=pay]"); await page.click("[data-payfor='-1']"); await page.click("#g-pd");
      await page.click(".g-dlg [data-day='2026-11-01']"); await page.waitForSelector("#g-pd.on >> text=1 noyabr");
      await page.click("#g-pd"); await page.click(".g-dlg [data-back]"); await page.waitForSelector("#g-pd.on");
      await page.keyboard.press("Escape");
      await page.click("[data-tab=stu]");
      await page.click("[data-tab=pay]"); await page.waitForSelector(".g-tw table");
      // saqlangan faylda qoladi
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("yoqlama_jurnal")).classes.find((x) => x.name === "Ingliz tili A1").students[0].pays.length);
      assert.equal(saved, 1);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 1, `sahifa ekrandan ${overflow}px kengroq`);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}

test("Sozlamalar → Dizayn: mavzular, tungi variant, rang, tugmalar joyi va qaytarish", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    for (const [w, h] of [[1300, 860], [390, 844]]) {
      const page = await browser.newPage({viewport: {width: w, height: h}});
      const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(APP);
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
      await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
      await page.evaluate(() => { S.sec = 3; S.dztab = "look"; go("settings"); });
      const tok = (k) => page.evaluate((k) => getComputedStyle(document.documentElement).getPropertyValue(k).trim(), k);
      assert.equal(await page.locator(".dz-sec [data-dz-theme]").count(), 6);
      assert.equal(await tok("--win"), "#f3f5f9", `${w}: standart — TPT`);
      // mavzu almashadi, kunduzgi mavzuning tungi varianti o'ziniki
      await page.click('[data-dz-theme="osmon"]'); assert.equal(await tok("--win"), "#eaf1fb");
      await page.click("[data-dz-force]");
      assert.equal(await tok("--win"), "#0a1222"); assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "dark");
      await page.click('[data-dz-theme="daftar"]'); assert.equal(await tok("--win"), "#17140f", "har mavzuning tungi varianti boshqa");
      await page.click("[data-dz-force]"); assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "light");
      // to'q mavzuda «Kechqurun» o'chadi
      await page.click('[data-dz-theme="grafit"]'); assert.ok(await page.isDisabled('[data-dz-night="time"]'));
      // asosiy rang; xira rangda ogohlantirish
      await page.click('[data-dz-theme="tpt"]'); await page.click('[data-dz-hue="#6d4fd3"]'); assert.equal(await tok("--acc"), "#6d4fd3");
      await page.evaluate(() => { const p = $("#dzpick"); p.value = "#f3e36b"; p.dispatchEvent(new Event("change")); }); assert.equal(await page.locator(".dzwarn").count(), 1);
      // qaytarish — oxirgi o'zgarish bekor bo'ladi
      await page.click("[data-dz-undo]"); assert.equal(await page.evaluate(() => D.web.dz.hue), "#6d4fd3");
      await page.click("[data-dz-reset]"); assert.equal(await page.evaluate(() => [D.web.dz.theme, D.web.dz.hue]).then(JSON.stringify), JSON.stringify(["tpt", ""]));
      // tugmalar: menyu tartibi va yashirish, emoji kalitlar
      await page.click('[data-dz-tab="btn"]');
      await page.click('[data-dz-eye="help"]');
      assert.equal(await page.locator(w > 820 ? "#side [data-help]" : "#tabbar [data-help]").count(), 0, "Yordam yashirildi");
      await page.click('[data-dz-mv="reports|-1"]');
      const order = await page.$$eval(w > 820 ? "#side [data-go]" : "#tabbar [data-go]", (x) => x.map((b) => b.dataset.go));
      assert.deepEqual(order, ["today", "journal", "reports", "groups", "settings"]);
      assert.equal(await page.locator('[data-dz-eye="settings"]').count(), 0, "Sozlamalar yashirilmaydi");
      assert.equal(await page.locator("[data-dz-emo]").count(), 2, "faqat Belgi va Chiroqcha");
      await page.click('[data-dz-emo="dot"]');
      await page.evaluate(() => { S.sec = 6; go("settings"); });
      assert.match(await page.textContent(".sz-tg.on"), /🟢/);
      // menyu tepada (kompyuter)
      await page.evaluate(() => { D.web.dz.nav = "top"; save(); render(); });
      if (w > 820) { const r = await page.evaluate(() => { const s = $("#side").getBoundingClientRect(); return [Math.round(s.top), Math.round(s.width)]; }); assert.equal(r[0], 0); assert.ok(r[1] > 900, "yon panel tepada qator bo'ldi"); }
      // eski sozlama: tungi mavzu → «Tungi», avto → qurilmaga qarab
      const mig = await page.evaluate(() => [normalize({web: {theme: "dark"}}).web.dz.theme, normalize({web: {theme: "auto"}}).web.dz.night, normalize({web: {dz: {theme: "yoq", ord: ["x"], hid: ["settings"]}}}).web.dz]);
      assert.equal(mig[0], "tun"); assert.equal(mig[1], "device"); assert.equal(mig[2].theme, "tpt"); assert.equal(mig[2].ord.length, 6); assert.deepEqual(mig[2].hid, []);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "yonga chiqmasin");
      // Guruhlar bo'limi ham tanlangan mavzuda (to'q mavzuda ham)
      for (const th of ["osmon", "grafit"]) {
        await page.evaluate((th) => { D.web.dz.theme = th; D.web.dz.nav = "left"; save(); applyTheme(); go("groups"); }, th);
        await page.waitForSelector(".tpt");
        const g = await page.evaluate(() => { const r = getComputedStyle(document.documentElement), t = getComputedStyle($(".tpt")); return [t.getPropertyValue("--g-acc").trim(), r.getPropertyValue("--acc").trim(), t.getPropertyValue("--g-base").trim(), r.getPropertyValue("--base").trim(), getComputedStyle($("#main")).backgroundColor]; });
        assert.equal(g[0], g[1], `${th}: guruhlar asosiy rangi`); assert.equal(g[2], g[3], `${th}: guruhlar kartochka foni`);
        if (th === "grafit") assert.equal(g[4], "rgb(20, 21, 24)", "guruhlar sahifa foni mavzudan");
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});

test("chorak arxivi: tugagan chorak qulflanadi, vaqtincha ochiladi, «Bugun» eslatmasi va arxiv sahifasi", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    for (const vp of [{width: 1440, height: 900}, {width: 390, height: 844}]) {
      const page = await browser.newPage({viewport: vp});
      const errors = []; page.on("pageerror", (e) => errors.push(e.message));
      // 31.10: 1-chorak (02.09–29.10) tugagan, 3 kunlik tuzatish muddati ichida — hali qulflanmagan
      await page.clock.setFixedTime(new Date(2026, 9, 31, 10, 0));
      await page.goto(APP);
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
      await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
      await page.waitForSelector(".ax-today");
      assert.match(await page.textContent(".ax-today"), /1-chorak 29\.10 da tugadi/);
      assert.equal(await page.evaluate(() => ARX.lockedQ(1)), false);
      const d0 = await page.evaluate(() => { D.web.past = "all"; D.settings.protect.enabled = false; const c = D.classes[0]; return c.dates.find((d) => d < "2026-10-29" && !isNoLesson(c, d) && !c.students[0].marks[d]); });
      assert.equal(await page.evaluate((d) => putMark(D.classes[0], 0, d, "7"), d0), true, "muddat ichida o'zgartirish mumkin");
      // «Hozir arxivlash»
      await page.click("[data-axnow]"); await page.click(".modal [data-ok]");
      assert.equal(await page.evaluate(() => ARX.lockedQ(1)), true);
      assert.equal(await page.evaluate((d) => putMark(D.classes[0], 0, d, "8"), d0), false, "arxivda baho o'zgarmaydi");
      assert.equal(await page.evaluate((d) => D.classes[0].students[0].marks[d], d0), "7");
      assert.equal(await page.evaluate(async () => { const c = D.classes[0]; return putScore(c, c.students[0], "final:q1", 5); }), false, "chorak bahosi ham qulf");
      assert.equal(await page.evaluate(async () => { const c = D.classes[0]; return putScore(c, c.students[0], "final:q2", 5); }), true, "boshqa chorak ochiq");
      // jurnal: banner, BSB/CHSB kataklari o'chirilgan
      await page.evaluate(() => { S.ci = 0; S.page = "journal"; S.jpage = "sum"; S.sq = 1; render(); });
      await page.waitForSelector(".ax-ban");
      assert.ok(await page.evaluate(() => [...document.querySelectorAll("[data-sc],[data-fq]")].every((x) => x.disabled)));
      await page.evaluate(() => { S.jpage = "j"; V.mode = "month"; V.anchor = "2026-10-20"; render(); });
      assert.ok(await page.locator(".cell.axl").count() > 0, "arxivdagi kataklar belgilangan");
      // vaqtincha ochish → o'zgartirish → qulflash; tarixga yoziladi
      await page.click("[data-axopen]"); await page.click(".modal [data-axd='0']"); await page.click(".modal [data-ok]");
      assert.equal(await page.evaluate(() => ARX.lockedQ(1)), false);
      assert.equal(await page.evaluate((d) => putMark(D.classes[0], 0, d, "9"), d0), true);
      await page.click("[data-axrelock]");
      assert.equal(await page.evaluate(() => ARX.lockedQ(1)), true);
      const log = await page.evaluate(() => D.web.arx.log.map((x) => x.x).join("\n"));
      assert.match(log, /Qo'lda arxivlandi/); assert.match(log, /Vaqtincha ochildi/); assert.match(log, /7 → 9/); assert.match(log, /Yana qulflandi/);
      // arxiv sahifasi
      await page.evaluate(() => ARX.go(1)); await page.waitForSelector(".ax-qline");
      assert.equal(await page.locator(".ax-tbl tr, .ax-crow").count() > 0, true);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "yonga chiqmasin");
      // arxivdan butunlay chiqarish — avtomatik qayta qulflanmaydi
      await page.click("[data-axoff]"); await page.click(".modal [data-ok]");
      assert.equal(await page.evaluate(() => { ARX.tick(); return ARX.lockedQ(1); }), false);
      assert.deepEqual(errors, []);
      await page.close();
    }
    // 04.11: tuzatish muddati o'tgan — 1-chorak o'zi arxivlanadi; eMaktab importi arxiv sanalariga tegmaydi
    const page = await browser.newPage({viewport: {width: 1440, height: 900}});
    await page.clock.setFixedTime(new Date(2026, 10, 4, 10, 0));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    assert.equal(await page.evaluate(() => [ARX.lockedQ(1), D.web.arx.q[1].by].join()), "true,auto");
    const r = await page.evaluate(() => { const c = D.classes[0], s = c.students[0], d = c.dates.find((x) => x < "2026-10-29" && s.marks[x]), old = s.marks[d];
      const rep = mergeImport({name: c.name, subject: c.subject, dates: [d], students: [{name: s.name, marks: {[d]: "2"}, scores: {}}], works: [], skipped: {}}, true);
      return [rep.arx, s.marks[d] === old]; });
    assert.deepEqual(r, [1, true]);
    await page.close();
  } finally { await browser.close(); }
});

test("Bugun: BSB/CHSB tahlili qilinmagan sinflar va tahlil sahifasini ochish", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1366, height: 900}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    const r = await page.evaluate(() => {
      const t = todayIso(), dd = (k) => iso(addDays(pdate(t), k));
      D.settings.quarters = [[dd(-40), dd(20)], null, null, null];
      const ci = D.classes.findIndex((c) => !isGrp(c)), c = D.classes[ci];
      D.classes.forEach((x) => { x.works = []; x.analyses = []; });
      c.works.push({id: "wa1", type: "bsb", date: dd(-10), max: 10, title: "Kasrlar"}, {id: "wa2", type: "bsb", date: dd(-5), max: 10, title: ""},
        {id: "wa3", type: "chsb", date: dd(-3), max: 30, title: ""}, {id: "wa4", type: "chsb", date: dd(-2), max: 30, title: "", test: {n: 2, o: 4, key: "AB", ans: {[c.students[0].id]: "AB"}}},
        {id: "wa5", type: "bsb", date: dd(5), max: 10, title: ""}, {id: "wa6", type: "bsb", date: dd(-60), max: 10, title: ""});
      c.analyses.push({id: "a1", title: "", date: dd(-5), q: 1, max: [10], names: [], rows: {[c.students[0].name]: {in: true, pts: [7]}}});
      save(); go("today");
      return {ci, ids: analysisGaps().rows.map((x) => x.works.map((w) => w.id).join(",")), d1: dd(-10)};
    });
    assert.deepEqual(r.ids, ["wa1,wa3"], "faqat tahlilsiz, o'tgan va shu chorakdagi BSB/CHSB");
    assert.equal(await page.locator(".bn-grp.anl [data-anl]").count(), 3);
    await page.click(`.bn-grp.anl button.btn[data-anl]`);
    assert.deepEqual(await page.evaluate(() => [S.page, S.jpage, S.ci, baCur().date, baCur().title, baCur().id]), ["journal", "bsb", r.ci, r.d1, "Kasrlar", null]);
    assert.equal(await page.inputValue("#bt"), "Kasrlar");
    await page.evaluate(() => go("today"));
    await page.click(`.bn-anw [data-anl="${r.ci}|wa3"]`);
    assert.deepEqual(await page.evaluate(() => [S.jpage, S.tw]), ["chsbt", "wa3"]);
    // tahlil qilingach ro'yxatdan chiqadi
    await page.evaluate(() => { const c = D.classes[S.ci]; c.analyses.push({id: "a2", title: "", date: c.works[0].date, q: 1, max: [10], names: [], rows: {[c.students[0].name]: {in: true, pts: [5]}}});
      c.works[2].test = {n: 1, o: 4, key: "A", ans: {[c.students[0].id]: "A"}}; save(); go("today"); });
    assert.equal(await page.locator(".bn-grp.anl").count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("BSB/CHSB ustuni ochilsa «BSB tahlili»da shu sana uchun tahlil ochiladi (36 o'quvchi)", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1366, height: 900}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    const d = await page.evaluate(() => {
      const t = todayIso(), dd = (k) => iso(addDays(pdate(t), k));
      D.settings.quarters = [[dd(-40), dd(20)], null, null, null];
      const ci = D.classes.findIndex((c) => !isGrp(c)), c = D.classes[ci];
      while (c.students.length < 36) c.students.push({id: "s36_" + c.students.length, name: `Sinov O'quvchi ${c.students.length + 1}`, marks: {}, scores: {}});
      c.works = []; c.analyses = []; save(); S.ci = ci; S.page = "journal"; S.jpage = "sum"; go("journal");
      return {a: dd(-3), b: dd(-2), ci};
    });
    assert.equal(await page.evaluate(() => D.classes[S.ci].students.length), 36);
    // 1) BSB ustuni qo'shiladi → bo'sh tahlil shu sana va nom bilan
    await page.click("[data-addw]"); await page.fill(".modal #wd", d.a); await page.fill(".modal #wn", "Kasrlar"); await page.click(".modal [data-ok]");
    let an = await page.evaluate(() => { const c = D.classes[S.ci]; return c.analyses.map((a) => ({date: a.date, title: a.title, w: a.w === c.works[0].id, q: a.q})); });
    assert.deepEqual(an, [{date: d.a, title: "Kasrlar", w: true, q: 5}]);
    // 2) CHSB ustuni ham
    await page.click("[data-addw]"); await page.click(".modal #wt [data-t=chsb]"); await page.fill(".modal #wd", d.b); await page.click(".modal [data-ok]");
    an = await page.evaluate(() => D.classes[S.ci].analyses.map((a) => [a.date, a.title]));
    assert.deepEqual(an, [[d.a, "Kasrlar"], [d.b, "CHSB"]]);
    // 3) «BSB tahlili» ro'yxatida ko'rinadi, «Bugun»dan ochilganda shu tahlil ochiladi
    await page.evaluate(() => { S.jpage = "bsb"; render(); });
    assert.equal(await page.locator("#bas option").count(), 3);
    await page.evaluate((ci) => { const c = D.classes[ci]; openAnalysis(ci, c.works[0].id); }, d.ci);
    assert.equal(await page.evaluate(() => baCur().id), "a1");
    assert.equal(await page.locator(".bsa tbody tr, .bsa tr[data-row]").count() >= 36, true);
    // 4) ish sanasi/nomi o'zgarsa, bo'sh tahlil ergashadi; ish o'chirilsa — o'chadi
    await page.evaluate(() => { S.jpage = "sum"; render(); });
    await page.click(`[data-we="${await page.evaluate(() => D.classes[S.ci].works[1].id)}"]`);
    const d3 = await page.evaluate(() => iso(addDays(pdate(todayIso()), -1)));
    await page.fill(".modal #wd", d3); await page.click(".modal [data-ok]");
    assert.deepEqual(await page.evaluate(() => D.classes[S.ci].analyses.map((a) => [a.date, a.title])), [[d.a, "Kasrlar"], [d3, "CHSB"]]);
    await page.click(`[data-we="${await page.evaluate(() => D.classes[S.ci].works[1].id)}"]`);
    await page.click(".modal [data-del]"); await page.click(".modal:last-of-type .btn-primary, .modal:last-of-type .btn-danger");
    await page.waitForFunction(() => D.classes[S.ci].works.length === 1);
    assert.deepEqual(await page.evaluate(() => D.classes[S.ci].analyses.map((a) => a.date)), [d.a]);
    // 5) ball kiritilgan tahlil ish o'chirilganda saqlanib qoladi
    await page.evaluate(() => { const c = D.classes[S.ci]; c.analyses[0].rows[c.students[35].name] = {in: true, pts: [2, 1, 0, 2, 2]}; removeWork(c, c.works[0]); save(); });
    assert.equal(await page.evaluate(() => D.classes[S.ci].analyses.length), 1);
    // 6) mavjud tahlil bor sanada ikkinchisi ochilmaydi
    await page.evaluate((a) => { const c = D.classes[S.ci]; reviveWork(c, "bsb", a); const w = {id: newWorkId(c), type: "bsb", date: a, max: 25, title: ""}; c.works.push(w); workAnalysis(c, w); }, d.a);
    assert.equal(await page.evaluate(() => D.classes[S.ci].analyses.length), 1);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Bo'sh varaq: 5 xil tur, kelgusi kunlar jadvaldan, barcha sinflar, qayta chizilmaydi, chop etish va Excel", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    for (const [name, viewport] of [["kompyuter", {width: 1440, height: 900}], ["telefon", {width: 390, height: 844}]]) {
      const page = await browser.newPage({viewport, acceptDownloads: true});
      const errors = []; page.on("pageerror", (e) => errors.push(e.message));
      await page.clock.setFixedTime(new Date(2026, 9, 20, 10, 0));
      await page.goto(APP);
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
      await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
      await page.click(`${name === "telefon" ? ".tabbar" : ".side"} [data-go=reports]`);
      if (name === "telefon") { await page.click("[data-hk=kind]"); await page.click(".modal [data-kind=blank]"); } else await page.click("[data-kind=blank]");
      await page.waitForSelector(".bv-scale .bv-pg");
      // tanlov bosilganda panel qayta yaratilmaydi (faqat o'zgargan joylar almashtiriladi), sahifa joyida qoladi
      await page.evaluate(() => { document.querySelector(".bv").__mark = 1; window.scrollTo(0, 120); });
      const y0 = await page.evaluate(() => scrollY);
      const tap = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
      for (const t of ["only", "mz", "bsb", "own", "att"]) {
        await tap(`.bv-tile[data-v=${t}]`);
        assert.equal(await page.evaluate(() => document.querySelector(".bv").__mark), 1, `${t}: panel qayta chizildi`);
        assert.ok(await page.locator(".bv-scale .bv-pg table.bv-t").count(), `${t}: varaq yo'q`);
      }
      assert.equal(await page.evaluate(() => scrollY), y0);
      if (name === "telefon") continue;
      // mezon: har kunga Ish / Uy / Baho; kelgusi hafta jurnalda yo'q bo'lsa ham dars jadvalidan chiqadi
      await tap(".bv-tile[data-v=mz]");
      assert.ok(await page.locator(".bv-scale th small", {hasText: "Uy"}).count() >= 1);
      for (let i = 0; i < 3; i++) await tap("[data-bv=shift][data-v='1']");
      assert.ok(await page.locator(".bv-scale th.bv-fut").count() > 0, "kelgusi kunlar jadvaldan chiqishi kerak");
      // BSB: topshiriqlar soni, Jami, Baho
      await tap(".bv-tile[data-v=bsb]"); await tap("[data-bv=tasks][data-v='1']");
      assert.deepEqual(await page.$$eval(".bv-scale thead tr:first-child th", (a) => a.map((x) => x.textContent.trim()).slice(-3)), ["6", "Jami", "Baho"]);
      // O'z ustunlarim
      await tap(".bv-tile[data-v=own]"); await page.fill("#bv-own", "Kitob, Daftar"); await page.waitForTimeout(500);
      assert.deepEqual(await page.$$eval(".bv-scale thead th", (a) => a.map((x) => x.textContent.trim())), ["№", "O'quvchi", "Kitob", "Daftar"]);
      // izoh ustuni va bo'sh qatorlar
      await tap("[data-bv=tog][data-k=note]"); await tap("[data-bv=extra][data-v='1']");
      const n0 = await page.evaluate(() => D.classes[S.rep.ci].students.length);
      assert.equal(await page.locator(".bv-scale tbody tr").count(), n0 + 3);
      assert.ok(await page.locator(".bv-scale thead th", {hasText: "Izoh"}).count());
      // barcha sinflar: har sinf alohida varaqda, chop etilganda ham
      await tap(".bv-tile[data-v=att]"); await tap("[data-bv=per][data-v=week]");
      await page.click(".hb-pks [data-hk=cls]"); await page.click(".hb-pop [data-ho=ci][data-v=all]");
      const sheets = await page.locator(".bv-print .bv-pg").count();
      assert.ok(sheets >= 2, `barcha sinflar: ${sheets} varaq`);
      await page.emulateMedia({media: "print"});
      const pdf = await page.pdf({preferCSSPageSize: true}); await page.emulateMedia({media: "screen"});
      assert.equal((pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length, sheets);
      // Excel
      const [dl] = await Promise.all([page.waitForEvent("download"), page.click(".hb-acts [data-bvx]")]);
      assert.match(dl.suggestedFilename(), /bo.sh varaq\.(xlsx|csv)$/);
      assert.deepEqual(errors, []);
    }
  } finally { await browser.close(); }
});
