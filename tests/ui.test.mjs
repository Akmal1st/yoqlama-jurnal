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
      for (const k of ["att", "stats", "ready", "cmp", "blank", "cls"]) await page.click(`[data-kind=${k}]`);
      await nav("settings");
      for (let i = 0; i < 7; i++) await page.click(`[data-sec="${i}"]`);
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
    await page.click('[data-a=rmst][data-i="1"]');
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
      S.sel = [0, t]; applyKey("8");
      S.sel = [1, t]; applyKey("9");
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
    // Ctrl+C / Ctrl+S / Ctrl+D / Ctrl+8 — brauzer buyruqlari, belgi emas
    for (const k of ["Control+c", "Control+s", "Control+d", "Control+8", "Alt+k", "Meta+c"]) await page.keyboard.press(k);
    assert.equal(await mk(), "");
    await page.keyboard.press("c"); assert.equal(await mk(), "ch");
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
    // to'lov o'chirilsa «Qaytarish» tugmasi bilan tiklanadi
    await page.evaluate(() => {
      const c = normalize({classes: [{name: "Ingliz", kind: "paid", fee: {month: 100, day: 10}, students: [{name: "Pul To'lovchi", pays: [{id: "p1", no: 1, d: todayIso(), m: todayIso().slice(0, 7), sum: 5000, how: "Naqd"}]}]}]}).classes[0];
      D.classes.push(c); payDialog(D.classes.length - 1, 0, todayIso().slice(0, 7));
    });
    page.once("dialog", (d) => d.accept());
    await page.click(".modal [data-pdel]"); await page.click(".modal [data-ok]");
    await page.waitForSelector(".toast .tact");
    assert.equal(await page.evaluate(() => D.classes[D.classes.length - 1].students[0].pays.length), 0);
    await page.click(".toast .tact");
    assert.equal(await page.evaluate(() => D.classes[D.classes.length - 1].students[0].pays[0].id), "p1");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Yangi dizayn: Ctrl+K buyruqlar oynasi, Alt+raqam, ? tezkor tugmalar, telefonda pastki varaq", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1440, height: 900}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
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

test("jurnal: Kun ko'rinishi, katak yonidagi belgi oynasi, sinf tanlash", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1440, height: 900}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    const t = await page.evaluate(() => { const c = D.classes[0], t = todayIso(); D.settings.method_weekday = null; c.extra_x = [];
      if (!c.dates.includes(t)) { c.dates.push(t); c.dates.sort(); } D.settings.protect.enabled = false; c.students[0].marks[t] = ""; delete c.students[0].marks[t]; save(); return t; });
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
    await page.click(`[data-c="0|${t}"]`);
    assert.equal(new Set(await page.$$eval(".keys .key", (x) => x.map((e) => Math.round(e.getBoundingClientRect().top)))).size, 1, "kalitlar bir qatorda");
    await page.click('[data-k="7"]'); assert.equal(await mark(), "7");
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
      // eksport: 1) tahlil va jadval  2) header, jadval, footer
      await page.click("[data-bexp]"); await page.click('.modal [data-v="1"]'); await page.click(".modal [data-pdf]");
      let txt = await page.evaluate(() => window.__printed);
      for (const s of ["BSB tahlili", "Savollar tahlili", "Yutuqlar", "Tavsiyalar", "O'quvchilar natijalari"]) assert.ok(txt.includes(s), s);
      await page.click("[data-bexp]"); await page.click('.modal [data-v="2"]');
      await page.fill("#hs", "12-maktab"); await page.fill("#ht", "Karimova N."); await page.click(".modal [data-pdf]");
      txt = await page.evaluate(() => window.__printed);
      for (const s of ["12-maktab", "Bo'lim bo'yicha summativ baholash (BSB) natijalari", "Kasrlar", "qatnashmadi", "Qatnashdi", "Metod birlashma rahbari", "Karimova N.", "O'zlashtirish, %", "To'liq yechganlar", "Taqsimot", "Bilim sifati"]) assert.ok(txt.includes(s), s);
      assert.ok(!txt.includes("Yutuqlar"));
      assert.equal(await page.evaluate(() => D.web.bsb_hdr.school), "12-maktab", "header ma'lumoti eslab qolinadi");
      await page.click("[data-bexp]"); await page.click('.modal [data-v="2"]');
      const [dl] = await Promise.all([page.waitForEvent("download"), page.click(".modal [data-xl]")]);
      const wb = XLSX.read(await readFile(await dl.path()));
      const aoa = XLSX.utils.sheet_to_json(wb.Sheets.BSB, {header: 1});
      assert.equal(aoa[0][0], "12-maktab"); assert.ok(aoa.some((r) => r[1] === "O'zlashtirish, %") && aoa.some((r) => r[0] === "Baho" && r[1] === "Soni"), "yangi qatorlar Excelda"); assert.ok(aoa.some((r) => r.some((x) => String(x).startsWith("Metod birlashma rahbari"))));
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
    // header va footerni o'zgartirish
    await page.evaluate(() => { window.print = () => { window.__printed = document.getElementById("pdoc").innerText; }; });
    await page.click("[data-bexp]"); await page.click('.modal [data-v="2"]'); await page.click(".modal .hfopt summary");
    await page.fill("#hti", "Yakuniy natijalar bayonnomasi"); await page.fill("#hn", "2026-2027 o'quv yili"); await page.fill("#hfn", "Metodbirlashmada ko'rildi");
    await page.fill("#hsg", "Sinf rahbari | Aliyev B.\nDirektor | Valiyev S."); await page.uncheck('[data-hf="dist"]'); await page.uncheck('[data-hf="fan"]');
    await page.click(".modal [data-pdf]");
    let ft = await page.evaluate(() => window.__printed);
    for (const x of ["Yakuniy natijalar bayonnomasi", "2026-2027 o'quv yili", "Metodbirlashmada ko'rildi", "Sinf rahbari", "Valiyev S."]) assert.ok(ft.includes(x), x);
    assert.ok(!ft.includes("Taqsimot") && !ft.includes("Metod birlashma rahbari"), "o'chirilgan bloklar chiqmaydi");
    assert.deepEqual(await page.evaluate(() => [D.web.bsb_hdr.hide, D.web.bsb_hdr.title]), [{fan: 1, dist: 1}, "Yakuniy natijalar bayonnomasi"]);
    await page.click("[data-bexp]"); await page.click('.modal [data-v="2"]');
    const [dl2] = await Promise.all([page.waitForEvent("download"), page.click(".modal [data-xl]")]);
    const wb2 = XLSX.read(await readFile(await dl2.path())), a2 = XLSX.utils.sheet_to_json(wb2.Sheets.BSB, {header: 1});
    assert.equal(a2[1][0], "Yakuniy natijalar bayonnomasi"); assert.ok(a2.some((r) => r.some((x) => String(x).startsWith("Sinf rahbari"))));
    await page.click("[data-bexp]"); await page.click('.modal [data-v="2"]'); await page.click(".modal .hfopt summary"); await page.click(".modal [data-hreset]"); await page.click(".modal [data-pdf]");
    ft = await page.evaluate(() => window.__printed); assert.ok(ft.includes("Taqsimot") && ft.includes("Metod birlashma rahbari"), "asl holiga qaytdi");
    assert.ok(wb.SheetNames.includes("Xatolar kesimi"));
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets["Xatolar kesimi"], {header: 1});
    assert.equal(aoa[0][0], "O'rin"); assert.ok(aoa.some((r) => String(r[1]).includes("Kasrni qisqartirish")));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("BSB «Header, jadval va footer»: uzun jadval ham 1 ta varaqqa sig'adi", async () => {
  const {readFile} = await import("node:fs/promises");
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1200, height: 900}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    const zoom = await page.evaluate(() => { window.print = () => {}; const c = D.classes[0], B = baBlank(); B.q = 6; B.max = Array(6).fill(2); B.title = "Kasrlar";
      while (c.students.length < 45) c.students.push({...clone(c.students[0]), name: "Talaba " + c.students.length, id: "t" + c.students.length});
      c.students.forEach((s, i) => { B.rows[s.name] = {in: true, pts: B.max.map((m, k) => (i + k) % 3)}; });
      printDoc(bsbFormHtml(baMeta(c, B), baAnalysis(c, B), c, B, {school: "12-maktab"}), false, true);
      return +/zoom:([\d.]+)/.exec(document.getElementById("pdoc-css").textContent)[1]; });
    assert.ok(zoom < 1 && zoom > 0.4, `zoom ${zoom}`);
    await page.emulateMedia({media: "print"});
    await page.pdf({path: "/tmp/bsb-fit.pdf", preferCSSPageSize: true});
    const pages = (await readFile("/tmp/bsb-fit.pdf")).toString("latin1").match(/\/Type\s*\/Page[^s]/g).length;
    assert.equal(pages, 1, "bitta varaq");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Sozlamalar → Dizayn: mavzu, yozuv turi, o'lcham va rang", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    await page.click(".tabbar [data-go=settings]"); await page.click('[data-sec="3"]');
    await page.waitForSelector(".dprev");
    await page.click("[data-th=dark]"); await page.click("[data-font=georgia]"); await page.click("[data-fs=l]"); await page.click("[data-accent=blue]"); await page.click("[data-rad=sharp]");
    const st = await page.evaluate(() => ({theme: document.documentElement.dataset.theme, font: getComputedStyle(document.body).fontFamily, acc: getComputedStyle(document.documentElement).getPropertyValue("--acc").trim(),
      zoom: getComputedStyle(document.querySelector("main")).zoom, web: [D.web.font, D.web.fsize, D.web.accent, D.web.radius], saved: JSON.parse(localStorage.getItem("yoqlama_jurnal")).web.font}));
    assert.equal(st.theme, "dark"); assert.match(st.font, /Georgia/); assert.equal(st.acc, "#6aa7ef"); assert.equal(st.zoom, "1.08");
    assert.deepEqual(st.web, ["georgia", "l", "blue", "sharp"]); assert.equal(st.saved, "georgia");
    await page.click("[data-th=light]");
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--acc").trim()), "#1f5fae");
    await page.click("[data-a=dreset]");
    assert.deepEqual(await page.evaluate(() => [D.web.font, D.web.fsize, D.web.accent, D.web.radius, D.web.style]), ["system", "m", "teal", "round", "dash"]);
    assert.match(await page.evaluate(() => getComputedStyle(document.body).fontFamily), /system-ui/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 1, `sahifa ekrandan ${overflow}px kengroq`);
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
    for (const den of ["oddiy", "kompakt"]) for (const mode of ["day", "week", "month"]) {
      const bad = await page.evaluate(([den, mode]) => { D.web.density = den; S.page = "journal"; V.mode = mode; render();
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
    assert.deepEqual(await page.$$eval(".grng .grb span", (x) => x.map((e) => e.textContent)), ["– 4", "– 7", "– 10"]);
    await page.selectOption('[data-rmin="1"]', "6");
    assert.deepEqual(await page.$$eval(".grng .grb span", (x) => x.map((e) => e.textContent)), ["– 5", "– 7", "– 10"]);
    assert.equal(await page.evaluate(() => gradeColor(5)), await page.evaluate(() => ranges()[0].color), "5 endi «Past» rangida");
    await page.selectOption('[data-rmin="1"]', "8");   // band bor — rad etiladi
    assert.deepEqual(await page.evaluate(() => ranges().map((r) => r.min)), [1, 6, 8]);
    // ustunlar bir-birining ustiga chiqmaydi
    const ok = await page.evaluate(() => [...document.querySelectorAll(".grng .grb")].every((g) => { const s = g.querySelector("span").getBoundingClientRect(), c = g.nextElementSibling.getBoundingClientRect(); return s.right <= c.left; }));
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
    for (const fs of ["m", "xl"]) for (const den of ["oddiy", "kompakt"]) for (const mode of ["week", "month", "quarter"]) {
      const gaps = await page.evaluate(async ([fs, den, mode]) => {
        D.web.fsize = fs; D.web.density = den; S.page = "journal"; V.mode = mode; render();
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
    assert.ok(docs[2].includes("jurnal-sealed") && !docs[2].includes("5-G") && !docs[2].includes("Boshqa Qurilma"));
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
    assert.ok(await page.isDisabled('.keys [data-k="8"]'), "baho tugmalari o'chiq");
    assert.ok(!(await page.isDisabled('.keys [data-k="s"]')), "yo'qlama tugmalari ishlaydi");
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
    await page.waitForSelector("text=45-bet, 3-mashq");
    await page.click('[data-allok="0"]');
    assert.ok(await page.evaluate(() => D.classes[0].att_ok.includes(todayIso())));
    await page.waitForSelector('[data-open="0"]');
    // mavzular oynasi: kiritilgan qiymat saqlanadi
    await page.evaluate(() => { S.ci = 0; S.page = "journal"; render(); lessonsDialog(0); });
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
      await page.goto(APP);
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
      await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
      await page.click(`${name === "telefon" ? ".tabbar" : ".side"} [data-go=reports]`);
      await page.click("[data-kind=stats]");
      assert.equal(await page.locator("svg.stat").count(), 3);
      const d = await page.evaluate(() => { const c = D.classes[0], [lo, hi] = periodNow(); return {dist: statsData(c, lo, hi).dist.reduce((a, b) => a + b, 0),
        all: c.students.reduce((a, s) => a + c.dates.filter((x) => lo <= x && x <= hi && x <= todayIso() && !isNoLesson(c, x)).reduce((n, x) => n + gradesOf(s.marks[x] || "").length, 0), 0)}; });
      assert.equal(d.dist, d.all, "taqsimotdagi baholar soni jurnaldagi bilan bir xil");
      await page.click(".lists [data-card]"); await page.waitForSelector(".modal");
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
    // sifat va o'zlashtirish: chorak bahosi 4–5 va 3–5 ulushi
    const ql = await page.evaluate(() => qualityOf([{q: {complete: true, grade: 5}}, {q: {complete: true, grade: 3}}, {q: {complete: true, grade: 2}}, {q: {complete: false}}]));
    assert.equal(ql.n, 3); assert.equal(Math.round(ql.q), 33); assert.equal(Math.round(ql.u), 67);
    // kutubxona yuklanmasa — CSV
    await page.evaluate(() => { window.loadXlsx = () => Promise.reject(new Error("offline")); });
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("[data-xlsx]")]);
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
    const row1 = await page.$$eval("table.attm tr:nth-child(2) td", (x) => x.map((e) => e.textContent));
    assert.equal(row1[2], "S"); assert.equal(row1[3], "", "baho qo'yilgan kun — darsda");
    assert.equal(+row1[exp.n + 2], exp.s);
    // chop etishda yotiq varaq
    await page.evaluate(() => fitPrint()); assert.ok((await page.textContent("#pfit-css")).includes("landscape"));
    await page.evaluate(() => { window.loadXlsx = () => Promise.reject(new Error("offline")); });
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("[data-axlsx]")]);
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
      if (n === "ph") assert.equal(await page.$eval("table.r tr:nth-child(2)", (e) => getComputedStyle(e).display), "flex");
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
    assert.equal(await page.$$eval(".rk", (x) => x.length), 8);
    // telefonda ustun sarlavhasi yo'q — saralash ro'yxatdan
    await page.selectOption("#rsort", "avg|1");
    const avgs = await page.$$eval("table.rcls tr:not(.tot)", (tr) => tr.slice(1).map((r) => parseFloat(r.cells[2].textContent)).filter((x) => !isNaN(x)));
    assert.deepEqual(avgs, avgs.slice().sort((a, b) => a - b));
    await page.click("[data-kind=cmp]"); await page.click('[data-cmpc="1"]');
    assert.deepEqual(await page.evaluate(() => [S.rep.kind, S.rep.ci]), ["cls", 1]);
    await page.click("[data-kind=ready]"); await page.selectOption("#rq", "2");
    assert.equal(await page.evaluate(() => S.rq), 2);
    assert.ok(await page.$("[data-rxlsx]"));
    await page.click("[data-kind=att]"); await page.selectOption("#rp", { index: 0 }).catch(() => {});
    await page.reload(); await page.waitForSelector(".tabbar");
    await page.click(".tabbar [data-go=reports]");
    assert.equal(await page.evaluate(() => S.rep.kind), "att");
    assert.ok(await page.$("#amon"));
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
      const r = await page.evaluate(() => ({g: document.querySelectorAll(".sbody .sgroup").length, over: document.documentElement.scrollWidth - innerWidth, cur: $(".secs [aria-current]").dataset.sec}));
      assert.ok(r.g >= 1, `bo'lim ${i}: guruh yo'q`); assert.ok(r.over <= 0, `bo'lim ${i}: ${r.over}px yonga chiqdi`); assert.equal(r.cur, String(i));
    }
    // funksiya kaliti: bosilganda o'chadi, aria-checked o'zgaradi
    await page.evaluate(() => { S.sec = 6; go("settings"); });
    assert.equal(await page.getAttribute("[data-ft=call]", "aria-checked"), "true");
    await page.click("[data-ft=call]");
    assert.equal(await page.getAttribute("[data-ft=call]", "aria-checked"), "false");
    assert.equal(await page.evaluate(() => feat("call")), false);
    // kalit sarlavha bilan bir qatorda
    const same = await page.evaluate(() => { const row = $("[data-ft=bday]").closest(".srow"), a = row.firstElementChild.getBoundingClientRect(), b = $("[data-ft=bday]").getBoundingClientRect(); return b.top < a.bottom && b.left > a.left; });
    assert.ok(same);
    // sinf qatori: xavfli amal ko'rinmaydi, tugmalar bitta qatorga sig'adi; o'chirish «⋯» menyusida, alohida ajratilgan
    await page.evaluate(() => { S.sec = 0; go("settings"); });
    assert.equal(await page.locator(".scls .sact .btn.btn-outline-danger").count(), 0, "o'chirish tugmasi qatorda turmasin");
    const oneLine = await page.evaluate(() => { const bs = [...$(".scls").querySelectorAll(".sact .btn")]; return bs.length === 3 && new Set(bs.map((b) => Math.round(b.getBoundingClientRect().top))).size === 1; });
    assert.ok(oneLine, "sinf qatoridagi tugmalar bitta qatorda bo'lsin");
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

test("Dizayn: uslublar va kompyuterdagi shriftlar", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    await page.evaluate(() => { S.sec = 3; go("settings"); });
    assert.equal(await page.locator(".stys [data-sty]").count(), 4);
    // to'rt dizayn: Klassik dashboard (standart), Qulay, Ixcham, Yumshoq; eski uslub nomlari standartga qaytadi
    assert.equal(await page.evaluate(() => D.web.style), "dash");
    const win = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--win").trim());
    const before = await win();
    for (const st of ["qulay", "zich", "yumshoq"]) {
      await page.click(`[data-sty="${st}"]`);
      assert.equal(await page.evaluate(() => D.web.style), st);
      assert.notEqual(await win(), before, `${st}: fon o'zgarishi kerak`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 1, `${st}: ekrandan chiqmasin`);
    }
    // yon paneldagi tezkor almashtirgich: yumshoq → dash → qulay
    await page.evaluate(() => $("[data-dsw]").click());
    assert.equal(await page.evaluate(() => D.web.style), "dash");
    await page.evaluate(() => $("[data-dsw]").click());
    assert.equal(await page.evaluate(() => D.web.style), "qulay");
    await page.click('[data-a="dreset"]');
    assert.equal(await page.evaluate(() => D.web.style), "dash");
    // shriftlar: ro'yxatdan tanlash, qo'lda yozish, mavjud bo'lmagani rad etiladi
    await page.click('[data-a="sysfont"]');
    const first = await page.getAttribute(".flist [data-fn]", "data-fn");
    assert.ok(first, "qurilmada kamida bitta mashhur shrift topilishi kerak");
    await page.fill("#fsq", "Yo'q Bunday Shrift 123"); await page.click(".modal [data-use]");
    await page.waitForSelector("text=bu qurilmada topilmadi");
    assert.notEqual(await page.evaluate(() => D.web.font), "custom");
    await page.fill("#fsq", ""); await page.click(`.flist [data-fn="${first}"]`);
    assert.deepEqual(await page.evaluate(() => [D.web.font, D.web.cfont]), ["custom", first]);
    assert.ok((await page.evaluate(() => getComputedStyle(document.body).fontFamily)).includes(first));
    assert.ok(await page.isVisible('.fonts [data-font="custom"].on'));
    // xavfli belgilar CSS ga tushmaydi
    await page.evaluate(() => { D.web.cfont = 'X";}body{display:none}'; applyTheme(); });
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).display), "block");
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
    const ord = await page.evaluate(() => S.jord.slice(0, 2));
    await page.evaluate((si) => { S.sel = [si, todayIso()]; render(); }, ord[0]);
    await page.keyboard.press("ArrowDown");
    assert.equal(await page.evaluate(() => S.sel[0]), ord[1]);
    // qidiruv
    const nm = await page.evaluate(() => D.classes[0].students[3].name);
    await page.fill("#jq", nm.split(" ")[0].toLowerCase());
    const vis = await page.$$eval("table.j tr[data-q]", (t) => t.filter((x) => x.style.display !== "none").length);
    assert.ok(vis >= 1 && vis < await page.evaluate(() => D.classes[0].students.length));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("jurnal: sana dars kunlari bo'yicha qo'shiladi; yon panel yig'iladi; ixcham dizaynda yozuv tugmadan chiqmaydi", async () => {
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
    // ixcham dizayn: hamma tugma bir qatorda, yozuv tugma ichida
    await page.click(".side [data-go=settings]"); await page.click('[data-sec="3"]'); await page.click("[data-den=kompakt]");
    for (const pg of ["journal", "settings", "today"]) {
      await page.evaluate((p) => { S.page = p; render(); }, pg);
      const bad = await page.evaluate(() => [...document.querySelectorAll(".btn")].filter((b) => b.offsetParent && b.scrollHeight > b.clientHeight + 2).map((b) => b.textContent.trim()));
      assert.deepEqual(bad, [], pg);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("to'garak va pullik ta'lim: a'zolar, faqat davomat, to'lov va qarz, yutuqlar, PIN", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1280, height: 800}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    await page.evaluate(() => { window.print = () => {}; });
    // metod kuni olib tashlangan: faylda bo'lsa ham hisobga olinmaydi, sozlamada yo'q
    assert.equal(await page.evaluate(() => D.settings.method_weekday), null);
    await page.evaluate(() => { S.sec = 1; go("settings"); }); assert.equal(await page.locator("#mw").count(), 0);
    // pullik ta'lim: «Ism, sinfi, telefon» qatorlari, narx — maktabda oylik
    await page.click(".side [data-go=settings]"); await page.click('[data-sec="0"]'); await page.click("[data-a=addpaid]");
    await page.fill(".modal #cn", "Ingliz tili kursi");
    await page.fill(".modal #cl", "Aliyev Sardor, 7-B, 90 123 45 67\nKarimova Madina, 8-A");
    await page.click(".modal #cw [data-k='0']"); await page.click(".modal [data-ok]");
    const ci = await page.evaluate(() => D.classes.length - 1);
    let c = await page.evaluate((i) => D.classes[i], ci);
    assert.equal(c.kind, "paid"); assert.deepEqual(c.fee, {month: 360000, day: 50000});
    assert.equal(c.students[0].cls, "7-B"); assert.equal(c.students[0].par.phone, "+998901234567");
    assert.deepEqual(c.students[1].plan, {t: "month", sum: 360000});
    assert.equal(await page.evaluate(() => S.jpage), "cards");
    assert.equal(await page.locator(".mcard").count(), 2);
    assert.equal(await page.locator(".side .nav.on[data-go=groups]").count(), 1);
    assert.ok(await page.evaluate(() => classGroups().flatMap(([, ids]) => ids).every((i) => !isGrp(D.classes[i]))), "sinflar ro'yxatida guruh bo'lmasin");
    await page.click("[data-jp=mem]");
    await page.selectOption("[data-mf='1|pt']", "day");
    assert.deepEqual(await page.evaluate((i) => D.classes[i].students[1].plan, ci), {t: "day", sum: 50000});
    // maydonlar matn turida (qorong'i uslubda yozuv ko'rinsin)
    assert.equal(await page.getAttribute("[data-mf='0|cls']", "type"), "text");
    // hisob: oylik — oyda dars bo'lsa; kunlik — «o'tildi» belgilangan darslar × narx; «o'tilmadi» va belgisiz hisoblanmaydi
    const calc = await page.evaluate((i) => {
      const c = D.classes[i]; c.dates = ["2026-03-02", "2026-03-04", "2026-03-09"]; c.students.forEach((s) => delete s.joined);
      c.students[1].marks = {"2026-03-02": "ot", "2026-03-04": "ox"}; c.students[0].pays = [{id: "a", no: 1, d: "2026-03-05", m: "2026-03", sum: 200000}];
      const t = "2026-03-31", [a, b] = c.students;
      return [chargeOf(c, a, "2026-03", t), chargeOf(c, b, "2026-03", t), debtOf(c, a, t), debtOf(c, b, t), unpaidNow(c, t).length];
    }, ci);
    assert.deepEqual(calc, [360000, 50000, 160000, 50000, 2]);
    // eski ma'lumot: guruhdagi yo'qlama belgilari «o'tildi / o'tilmadi»ga o'tadi
    const mig = await page.evaluate(() => migrate(normalize({web: {dv: 1}, classes: [{name: "G", kind: "paid", dates: ["2026-03-02", "2026-03-04", "2099-01-01"], att_ok: ["2026-03-02"],
      students: [{name: "A", marks: {"2026-03-04": "dq"}}, {name: "B", marks: {}}, {name: "C", joined: "2026-03-03", marks: {}}]}]})).classes[0].students.map((s) => s.marks));
    assert.deepEqual(mig, [{"2026-03-02": "ot", "2026-03-04": "ox"}, {"2026-03-02": "ot", "2026-03-04": "ot"}, {"2026-03-04": "ot"}]);
    // davomat: baho yo'q
    await page.evaluate(() => { D.classes[D.classes.length - 1].dates.push(todayIso()); save(); render(); });
    await page.click("[data-jp=j]");
    assert.equal(await page.locator("table.j th", {hasText: "O'rt."}).count(), 0);
    assert.equal(await page.locator(".keys [data-k='5']").count(), 0);
    assert.equal(await page.locator(".keys [data-k='s']").count(), 0);
    assert.equal(await page.locator(".keys [data-k='ot']").count(), 1);
    // qo'shilgan sanadan oldingi darslar: katak bo'sh, belgi qo'yilmaydi
    const pre = await page.evaluate((i) => { const c = D.classes[i], s = c.students[0]; s.joined = "2099-01-01"; render();
      const n = document.querySelectorAll(".cell.pre").length, ok = putMark(c, 0, todayIso(), "ot", true); delete s.joined; render(); return [n > 0, ok]; }, ci);
    assert.deepEqual(pre, [true, false]);
    // to'lov yozish va hisobot
    await page.click("[data-jp=pay]");
    await page.click("[data-pay='1']"); await page.fill(".modal #ps", "50000"); await page.click(".modal [data-ok]");
    c = await page.evaluate((i) => D.classes[i], ci);
    assert.equal(c.students[1].pays.length, 1); assert.equal(c.students[1].pays[0].no, 1); assert.equal(c.rc, 1);
    await page.click("[data-prep]");
    assert.match(await page.textContent("#pdoc"), /To'lovlar hisoboti/);
    // «Guruhlar» bo'limi: kartochka, bugungi davomat tugmasi
    await page.click(".side [data-go=groups]");
    await page.waitForSelector(".gcard");
    await page.click(`[data-gopen='${ci}']`);
    assert.equal(await page.evaluate(() => S.jpage), "cards");
    await page.click("[data-tog='0']");
    assert.equal(await page.evaluate((i) => D.classes[i].students[0].marks[todayIso()], ci), "ot");
    await page.evaluate(() => { unlockedUntil = Date.now() + 60000; });   // qo'yilgan belgini o'zgartirish — qulf ochiq bo'lsa
    await page.click("[data-tog='0']");
    assert.equal(await page.evaluate((i) => D.classes[i].students[0].marks[todayIso()], ci), "ox");
    await page.click("[data-tog='0']");
    assert.equal(await page.evaluate((i) => D.classes[i].students[0].marks[todayIso()] || "", ci), "");
    // «Jurnal» bosilsa — sinf ochiladi, guruh emas
    await page.click(".side [data-go=journal]");
    assert.equal(await page.evaluate(() => isGrp(D.classes[S.ci])), false);
    // «Bugun»: shu oy to'lamaganlar
    await page.click(".side [data-go=today]");
    await page.waitForSelector("text=uchun to'lamaganlar");
    await page.click(`[data-payci='${ci}']`);
    assert.equal(await page.evaluate(() => S.jpage), "pay");
    // PIN qo'yilgan va qulf yopiq — summalar ko'rinmaydi
    await page.evaluate(() => { D.settings.protect.pin = "x"; unlockedUntil = 0; render(); });
    assert.equal(await page.locator("table.pay").count(), 0);
    await page.waitForSelector("text=To'lovlar himoyalangan");
    await page.evaluate(() => { D.settings.protect.pin = null; render(); });
    // darsni boshlash: baholar qadami yo'q; «o'tildi / o'tilmadi»; yakunlanganda belgisizlarga «o'tildi»
    await page.evaluate((i) => startLesson(i), ci);
    await page.click("[data-att='1|ox']");
    await page.click("[data-next]");
    assert.equal(await page.evaluate(() => S.step), 2);
    await page.click("[data-next]");
    assert.deepEqual(await page.evaluate((i) => D.classes[i].students.map((s) => s.marks[todayIso()]), ci), ["ot", "ox"]);
    // to'garak: yutuq va ko'nikma bahosi
    await page.evaluate(() => addClassDialog("club"));
    await page.fill(".modal #cn", "Robototexnika"); await page.fill(".modal #cl", "Aliyev Sardor, 7-B"); await page.click(".modal [data-ok]");
    const k = await page.evaluate(() => D.classes.length - 1);
    assert.equal(await page.locator(".jtabs [data-jp]").allTextContents().then((x) => x.join("|")), "A'zolar|Darslar|Yutuqlar|Ro'yxat");
    await page.click("[data-jp=mem]"); await page.selectOption("[data-mf='0|skill']", "8");
    await page.click("[data-jp=ach]"); await page.fill("#at", "Robototexnika tanlovi"); await page.selectOption("#al", "Tuman"); await page.click("[data-adda]");
    const st = await page.evaluate((i) => D.classes[i].students[0], k);
    assert.equal(st.ach.length, 1); assert.equal(st.ach[0].lvl, "Tuman"); assert.equal(Object.values(st.skill)[0], 8);
    assert.ok(await page.evaluate((i) => riskOverview().every((r) => r.ci !== i), k));
    // Hisobotlar: sinflar va guruhlar alohida bandda
    await page.click(".side [data-go=reports]");
    await page.click("[data-band=cls]");
    assert.ok(await page.evaluate(() => [...document.querySelectorAll("#rc option")].every((o) => !isGrp(D.classes[+o.value]))), "sinf hisobotida guruh bo'lmasin");
    await page.click("[data-band=grp]");
    for (const kk of ["gsum", "gdays", "gmem", "gfill", "gsched", "gcmp", "gach", "gpay", "gmat", "gcon", "gfin", "gdebt"]) { await page.click(`[data-gkind=${kk}]`); await page.waitForSelector(`[data-gkind=${kk}].on`); }
    await page.click("[data-gkind=gach]"); await page.selectOption("#rgm", "all");
    await page.waitForSelector("section.card >> text=Robototexnika tanlovi");
    await page.click("[data-gkind=gpay]");
    assert.match(await page.textContent("section.card"), /50 000 so'm/);
    // guruh sozlamalari: sig'im, vaqt, xizmat turi (maktab xizmati — 343-son nizom)
    await page.evaluate((i) => editClass(i), ci);
    await page.fill(".modal #ccap", "12"); await page.fill(".modal #ctm", "15:00–16:20"); await page.click(".modal [data-svc=school]"); await page.click(".modal [data-ok]");
    assert.deepEqual(await page.evaluate((i) => [D.classes[i].cap, D.classes[i].time, D.classes[i].svc], ci), [12, "15:00–16:20", "school"]);
    // shartnoma reestri: yozish → holat «amal qilmoqda»
    await page.click("[data-gkind=gcon]");
    await page.click(`[data-gcon='${ci}|0']`); await page.fill(".modal #kp", "Aliyeva Gulnora"); await page.check(".modal #kdisc"); await page.click(".modal [data-ok]");
    const k0 = await page.evaluate((i) => D.classes[i].students[0].contract, ci);
    assert.equal(k0.payer, "Aliyeva Gulnora"); assert.equal(k0.disc, true); assert.ok(k0.no);
    await page.waitForSelector("section.card >> text=amal qilmoqda");
    // moliyaviy hisobot: tenglik va o'qituvchilar ulushi; maktab xizmatida naqd to'lov ogohlantiriladi
    await page.click("[data-gkind=gfin]"); await page.selectOption("#rgfp", "y");
    const F = await page.evaluate((i) => { const [lo, hi] = finRange("y", [i]); return finOf(D.classes[i], lo, hi); }, ci);
    assert.equal(F.close, F.open + F.charged - F.got);
    await page.fill("#fshare", "40"); await page.dispatchEvent("#fshare", "change");
    assert.equal(await page.evaluate(() => D.web.fin.share), 40);
    await page.waitForSelector("text=kamida 50%");
    // maktab xizmatida to'lov usuli odatda — bank
    await page.evaluate((i) => payDialog(i, 0, monthOf(todayIso())), ci);
    assert.equal(await page.inputValue(".modal #ph"), "Bank"); await page.click(".modal [data-x]");
    // oylik holat jadvali — har o'quvchi uchun qator
    await page.click("[data-gkind=gmat]");
    assert.ok(await page.locator("table.gmat tr").count() >= 2);
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

test("Guruhlar: tavsiyalar, davr bo'yicha kelgan kunlar va yutuqlar (pullik guruhda ham)", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1440, height: 900}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const r = await page.evaluate(() => {
      const t = todayIso(), ds = []; for (let i = 9; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); ds.push(iso(d)); }
      const mk = (a) => Object.fromEntries(a.map((v, i) => [ds[i], v]));
      const c = normalize({classes: [{name: "Ingliz", kind: "paid", dates: ds, fee: {month: 0, day: 1000}, students: [
        {name: "Ketma Ket", marks: mk(["ot", "ot", "ot", "ot", "ot", "ot", "ot", "ox", "ox", "ox"]), plan: {t: "day", sum: 1000}},
        {name: "Pasaygan", marks: mk(["ot", "ot", "ot", "ot", "ox", "ot", "ox", "ox", "ot", "ox"]), plan: {t: "day", sum: 1000}},
        {name: "Doimiy", marks: mk(Array(10).fill("ot")), plan: {t: "day", sum: 1000}}]}]}).classes[0];
      D.classes.push(c); const L = grpInsights(c, t, false);
      return {names: L.map((x) => c.students[x.si].name + ":" + x.lv), per: c.students.map((s) => grpPeriod(c, s, ds[0], t)), n: D.classes.length - 1};
    });
    assert.ok(r.names.includes("Ketma Ket:0"), "ketma-ket qoldirish topilmadi: " + r.names);
    assert.ok(r.names.some((x) => x.startsWith("Pasaygan")), "faollik pasayishi topilmadi");
    assert.deepEqual(r.names.filter((x) => x.startsWith("Doimiy")), ["Doimiy:1"], "doimiy qatnashchiga faqat qarz haqida tavsiya chiqishi kerak");
    assert.deepEqual(r.per.map((x) => x.came), [7, 6, 10]);
    assert.equal(r.per[2].sum, 10000);
    await page.evaluate((n) => { S.ci = n; S.jpage = "cards"; go("journal"); }, r.n);
    await page.waitForSelector("text=Tavsiyalar");
    await page.click("summary:has-text('Davr bo')");
    await page.waitForSelector("#gpa");
    await page.evaluate(() => { S.jpage = "ach"; render(); });
    await page.fill("#at", "Rasm tanlovi"); await page.selectOption("#ak", "Ijodiy ish"); await page.fill("#an", "<b>1-son</b>");
    await page.click("[data-adda]");
    const a = await page.evaluate(() => D.classes[D.classes.length - 1].students[0].ach[0]);
    assert.equal(a.k, "Ijodiy ish"); assert.equal(a.n, "<b>1-son</b>");
    assert.equal(await page.locator(".tblwrap b").count(), 0, "izoh HTML sifatida chizildi");
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

test("Bugun: sinflar ko'rsatkichi kartasi (davomat, o'zlashtirish, baholanganlik)", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1300, height: 900}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    await page.waitForSelector(".clsstat tbody tr");
    assert.equal(await page.locator(".clsstat tbody tr").count(), await page.evaluate(() => D.classes.filter((c) => !isGrp(c)).length));
    assert.ok((await page.textContent(".clsstat")).includes("Bugun baholangan"));
    assert.ok(await page.locator(".clsstat .progress-bar").count() > 0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 1);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Pullik guruh: dars paketi — kelgan sanalar, to'lov vaqti ogohlantirishi, paket to'lovi", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1280, height: 800}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    const ci = await page.evaluate(() => {
      const t = todayIso(), d = (n) => iso(addDays(pdate(t), -n)), ds = [d(6), d(5), d(4), d(3), d(2), d(1)];
      const ot = (a) => Object.fromEntries(a.map((x) => [x, "ot"]));
      const g = normalize({web: {dv: 2}, classes: [{name: "Ingliz", subject: "kurs", kind: "paid", pack: 3, dates: ds, fee: {month: 300000, day: 50000},
        students: [{name: "Aliyev A", marks: ot(ds.slice(0, 3))}, {name: "Karimova B", pack: 2, marks: ot(ds.slice(0, 2))}, {name: "Zokirov C", marks: ot(ds.slice(0, 1))}, {name: "Xato D", pack: "abc", pkBase: -5, marks: {}}]}]}).classes[0];
      D.classes.push(g); save(); return D.classes.length - 1;
    });
    const st = await page.evaluate((i) => D.classes[i].students.map((s) => { const p = packOf(D.classes[i], s); return [p.used, p.n, p.due, s.pack, s.pkBase]; }), ci);
    assert.deepEqual(st, [[3, 3, true, undefined, undefined], [2, 2, true, 2, undefined], [1, 3, false, undefined, undefined], [0, 3, false, undefined, undefined]]);
    // «Bugun»da ogohlantirish
    await page.evaluate(() => go("today"));
    assert.ok((await page.textContent("main")).includes("Paket tugadi"));
    assert.equal(await page.locator(`[data-packci="${ci}"]`).count(), 1);
    // guruh kartochkalari: nishon va kelgan kunlar oynasi
    await page.evaluate((i) => { S.ci = i; S.jpage = "cards"; go("journal"); }, ci);
    assert.equal(await page.locator(".mcard .gpay.no", {hasText: "to'lov vaqti"}).count(), 2);
    assert.ok((await page.locator(".mcard").nth(2).textContent()).includes("Paket: 1/3"));
    await page.click('[data-cdates="2"]');
    await page.fill(".modal #cd", await page.evaluate(() => iso(addDays(pdate(todayIso()), -3))));
    await page.click(".modal [data-add]");
    assert.equal(await page.evaluate((i) => packOf(D.classes[i], D.classes[i].students[2]).used, ci), 2);
    // kelgan sana guruh kunlariga qo'shiladi (o'tgan, jadvalda yo'q sana ham)
    const extra = await page.evaluate((i) => { const d = iso(addDays(pdate(todayIso()), -20)); return [markCame(D.classes[i], 2, d), D.classes[i].dates.includes(d), packOf(D.classes[i], D.classes[i].students[2]).used]; }, ci);
    assert.deepEqual(extra, [true, true, 3]);
    await page.keyboard.press("Escape").catch(() => {});
    await page.evaluate(() => document.querySelectorAll(".modal").forEach((m) => m._close && m._close()));
    // paket to'lovi: hisoblagich yangi paketdan boshlanadi
    await page.evaluate((i) => payDialog(i, 0, monthOf(todayIso())), ci);
    await page.fill(".modal #ps", "150000");
    assert.equal(await page.isChecked(".modal #ppk"), true);
    await page.click(".modal [data-ok]");
    const after = await page.evaluate((i) => { const c = D.classes[i], s = c.students[0], p = packOf(c, s); return [s.pkBase, s.pays[0].pk, p.used, p.due]; }, ci);
    assert.deepEqual(after, [3, 3, 0, false]);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 1);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Yutuqlarni yoqish/o'chirish: bo'lim, tugmalar va hisobot yashirinadi, ma'lumot qoladi", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1280, height: 800}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    const ci = await page.evaluate(() => {
      const t = todayIso();
      D.classes.push(normalize({web: {dv: 2}, classes: [{name: "Shaxmat", kind: "club", dates: [t], students: [{name: "Aliyev A", marks: {}, ach: [{d: t, t: "Respublika musobaqasi", k: "Musobaqa", lvl: "Respublika", pl: "1-o'rin"}]}]}]}).classes[0]);
      save(); return D.classes.length - 1;
    });
    const view = async () => { await page.evaluate((i) => { S.ci = i; S.jpage = "ach"; go("journal"); }, ci); return page.evaluate(() => ({
      tabs: [...document.querySelectorAll(".jtabs [data-jp]")].map((b) => b.dataset.jp), body: document.querySelector("main").textContent, jp: S.jpage})); };
    let v = await view();
    assert.ok(v.tabs.includes("ach")); assert.equal(v.jp, "ach");
    // sozlamalarda o'chiramiz
    await page.evaluate(() => { D.web.off = Object.assign({}, D.web.off, {ach: 1}); save(); });
    v = await view();
    assert.ok(!v.tabs.includes("ach")); assert.equal(v.jp, "cards");
    assert.ok(!v.body.includes("＋ Yutuq") && !v.body.includes("🏆"));
    assert.equal(await page.evaluate(() => grpTabs(D.classes[S.ci]).some(([k]) => k === "ach")), false);
    // ma'lumot saqlanadi, qayta yoqilsa hammasi joyida
    assert.equal(await page.evaluate((i) => D.classes[i].students[0].ach.length, ci), 1);
    await page.evaluate(() => { delete D.web.off.ach; save(); });
    v = await view(); assert.ok(v.tabs.includes("ach")); assert.equal(v.jp, "ach");
    // sozlamalardagi tugma
    await page.evaluate((i) => { S.ci = i; S.jpage = "j"; go("journal"); }, ci);
    await page.click("[data-more]"); await page.click(".modal [data-feats]");
    await page.waitForSelector("[data-ft=ach]");
    assert.equal(await page.locator("[data-ft=ach]").count(), 1);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 1);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
