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
      await page.click(`${name === "telefon" ? "main" : ".side"} [data-mode=week]`);
      assert.equal(await page.evaluate(() => V.mode), "week");
      await page.click(`${name === "telefon" ? "main" : ".side"} [data-mode=month]`);
      await page.click("[data-jp=sum]"); await page.waitForSelector("table.sum");
      await page.click("[data-jp=year]"); await page.waitForSelector("table.sum");
      await page.click("[data-jp=j]"); await page.click('td.nm[data-st="0"]');
      for (const t of ["grow", "notes", "msg", "sum"]) await page.click(`.modal [data-tab=${t}]`);
      await page.click(".modal [data-x]");
      await nav("reports");
      for (const k of ["ready", "cmp", "blank", "cls"]) await page.click(`[data-kind=${k}]`);
      await nav("settings");
      for (let i = 0; i < 6; i++) await page.click(`[data-sec="${i}"]`);
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
    await page.click(".tabbar [data-go=journal]"); await page.click('[data-ci="1"]');
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
  const lib = fileURLToPath(new URL("../node_modules/xlsx/dist/xlsx.full.min.js", import.meta.url));
  const rows = JSON.parse(await readFile(fileURLToPath(new URL("inputs.json", import.meta.url)), "utf8")).emaktab[0].rows;
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Matematika");
  const xls = XLSX.write(wb, {type: "buffer", bookType: "xls"});
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const ctx = await browser.newContext({serviceWorkers: "block"});
    const asked = [];
    await ctx.route("https://cdnjs.cloudflare.com/**", async (r) => r.fulfill({body: await readFile(lib), contentType: "text/javascript"}));
    await ctx.route("https://app.test/**", async (r) => {
      const p = new URL(r.request().url()).pathname.slice(1) || "index.html";
      try { r.fulfill({body: await readFile(docs + p), contentType: p.endsWith(".html") ? "text/html" : undefined}); } catch { r.fulfill({status: 404}); }
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

test("jurnal: Kun rejimida yo'qlama va baho alohida kataklarda", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1440, height: 900}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    const t = await page.evaluate(() => { const c = D.classes[0], t = todayIso(); D.settings.method_weekday = null; c.extra_x = [];
      if (!c.dates.includes(t)) { c.dates.push(t); c.dates.sort(); } D.settings.protect.enabled = false; c.students[0].marks[t] = ""; delete c.students[0].marks[t]; save(); return t; });
    await page.click(".side [data-go=journal]"); await page.click(".side [data-mode=day]");
    assert.equal(await page.locator(`[data-c="0|${t}|a"]`).count(), 1);
    assert.equal(await page.locator(`[data-c="0|${t}|g"]`).count(), 1);
    assert.deepEqual(await page.$$eval("table.j th.dsp", (x) => x.map((e) => e.firstChild.textContent)), ["Yo'qlama", "Baho"]);
    const mark = () => page.evaluate((d) => D.classes[0].students[0].marks[d] || "", t);
    await page.click(`[data-c="0|${t}|a"]`); await page.click("[data-k=kq]");
    await page.click(`[data-c="0|${t}|g"]`); await page.click('[data-k="8"]');
    assert.equal(await mark(), "8kq");
    assert.equal(await page.textContent(`[data-c="0|${t}|a"]`), "KQ");
    assert.equal(await page.textContent(`[data-c="0|${t}|g"]`), "8");
    await page.click(`[data-c="0|${t}|a"]`); await page.click('.keys [data-k=""]');
    assert.equal(await mark(), "8", "⌫ yo'qlama katagida faqat KQ ni o'chiradi");
    await page.click(`[data-c="0|${t}|g"]`); await page.keyboard.press("ArrowLeft"); await page.keyboard.press("s");
    assert.equal(await mark(), "s");
    // boshqa rejimlarda bitta katak
    await page.click(".side [data-mode=week]");
    assert.equal(await page.locator(`[data-c="0|${t}"]`).count(), 1);
    assert.equal(await page.locator("table.j th.dsp").count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

for (const [name, viewport] of [["kompyuter", {width: 1440, height: 900}], ["telefon", {width: 390, height: 844}]]) {
  test(`${name}: BSB tahlili — ball kiritish, saqlash, eksport va summativga o'tkazish`, async () => {
    const {readFile} = await import("node:fs/promises");
    const XLSX = (await import("xlsx")).default;
    const lib = fileURLToPath(new URL("../node_modules/xlsx/dist/xlsx.full.min.js", import.meta.url));
    const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
    try {
      const ctx = await browser.newContext({viewport, acceptDownloads: true});
      await ctx.route("https://cdnjs.cloudflare.com/**", async (r) => r.fulfill({body: await readFile(lib), contentType: "text/javascript"}));
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
      for (const s of ["12-maktab", "Bo'lim bo'yicha summativ baholash (BSB) natijalari", "Kasrlar", "qatnashmadi", "Qatnashdi", "direktor o'rinbosari", "Karimova N."]) assert.ok(txt.includes(s), s);
      assert.ok(!txt.includes("Yutuqlar"));
      assert.equal(await page.evaluate(() => D.web.bsb_hdr.school), "12-maktab", "header ma'lumoti eslab qolinadi");
      await page.click("[data-bexp]"); await page.click('.modal [data-v="2"]');
      const [dl] = await Promise.all([page.waitForEvent("download"), page.click(".modal [data-xl]")]);
      const wb = XLSX.read(await readFile(await dl.path()));
      const aoa = XLSX.utils.sheet_to_json(wb.Sheets.BSB, {header: 1});
      assert.equal(aoa[0][0], "12-maktab"); assert.ok(aoa.some((r) => String(r[0]).startsWith("O'quv ishlari bo'yicha direktor")));
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
