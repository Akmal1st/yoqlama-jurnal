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
    assert.deepEqual(await page.evaluate(() => [D.web.font, D.web.fsize, D.web.accent, D.web.radius]), ["lserif", "m", "teal", "round"]);
    assert.match(await page.evaluate(() => getComputedStyle(document.body).fontFamily), /Liberation Serif/);
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

test("jurnal: sinflar 1-qatorda, tanlangan sinfning fanlari 2-qatorda", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    await page.click(".tabbar [data-go=journal]");
    const names = await page.evaluate(() => D.classes.map((c) => c.name));
    const multi = names.find((n, i) => names.indexOf(n) !== i);
    assert.ok(multi, "fixture'da bir sinfning 2 ta fani bor");
    assert.equal(await page.locator(`.clsnav [data-cls="${multi}"]`).count(), 1);
    await page.click(`[data-cls="${multi}"]`);
    const subs = page.locator(".subs [data-ci]");
    assert.equal(await subs.count(), names.filter((n) => n === multi).length);
    await subs.last().click();
    const ci = await page.evaluate(() => S.ci);
    await page.click(".clsnav [data-ci]:not(.sub)"); await page.click(`[data-cls="${multi}"]`);
    assert.equal(await page.evaluate(() => S.ci), ci, "oxirgi tanlangan fan eslab qolinadi");
    for (const jp of ["sum", "bsb", "year"]) { await page.click(`[data-jp=${jp}]`); assert.equal(await page.locator(".clsnav").count(), 1); }
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
    for (const fs of ["m", "xl"]) for (const den of ["oddiy", "kompakt"]) for (const mode of ["week", "month", "quarter"]) {
      const gaps = await page.evaluate(async ([fs, den, mode]) => {
        D.web.fsize = fs; D.web.density = den; S.page = "journal"; V.mode = mode; render();
        const tw = $("#tw"), out = [];
        for (const x of [37, 123, 250, 99999]) {
          tw.scrollLeft = x; await new Promise((r) => setTimeout(r, 50));
          const nm = tw.querySelector("th.nm").getBoundingClientRect();
          const f = [...tw.querySelectorAll("th:not(.nm)")].map((t) => t.getBoundingClientRect()).find((q) => q.right > nm.right + 1);
          out.push(f ? f.left - nm.right : 0);
        }
        return out;
      }, [fs, den, mode]);
      assert.ok(gaps.every((g) => g >= 0), `${fs} / ${den} / ${mode}: ${gaps}`);
    }
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
    const calls = [], docs = [];
    let pinned = null, nextId = 10;
    const other = JSON.stringify({classes: [{name: "5-B", subject: "Fizika", students: [{name: "Boshqa Qurilma", marks: {}}]}]});
    await page.route("https://api.telegram.org/**", async (route) => {
      const url = route.request().url(), m = url.split("/").pop();
      if (url.includes("/file/")) return route.fulfill({status: 200, contentType: "application/json", headers: {"access-control-allow-origin": "*"}, body: other});
      calls.push(m);
      const body = route.request().postData() || "";
      let result = true;
      if (m === "getMe") result = {id: 1, is_bot: true, username: "sinf_test_bot"};
      else if (m === "getUpdates") result = [{update_id: 1, message: {message_id: 1, chat: {id: 777, type: "private"}, text: "/start"}}];
      else if (m === "sendMessage") result = {message_id: nextId++};
      else if (m === "sendDocument") { docs.push(body); const id = nextId++; pinned = {message_id: id, date: 1761300000, caption: (body.match(/#q\w+/) || [""])[0], document: {file_id: "F" + id}}; result = {message_id: id}; }
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
    // token jurnal fayliga yozilmaydi
    assert.ok(!(await page.evaluate(() => JSON.stringify(D))).includes("AAHabc"));
    // o'zgarishsiz qayta ochilganda takror yuborilmaydi
    await page.evaluate(() => tgAuto()); assert.equal(docs.length, 1);
    // boshqa qurilma yangiroq zaxira qadadi → Bugun sahifasida taklif → yuklash
    pinned = {message_id: 99, date: 1761300500, caption: "#qboshqa", document: {file_id: "F99"}};
    await page.evaluate(async () => { S.page = "today"; await tgAuto(); });
    await page.waitForSelector("text=boshqa qurilmadan yangiroq zaxira");
    page.once("dialog", (d) => d.accept());
    await page.click("[data-tg=tgnew]"); await page.click(".modal [data-ok]");
    await page.waitForFunction(() => D.classes.length === 1 && D.classes[0].name === "5-B");
    assert.equal(docs.length, 1, "yuklangandan keyin eski ma'lumot yuborilmasligi kerak");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Dars jadvali: Excel'dan yuklash, saqlash va dars kunlari", async () => {
  const {readFile, writeFile, mkdtemp} = await import("node:fs/promises");
  const {tmpdir} = await import("node:os"); const {join} = await import("node:path");
  const XLSX = (await import("xlsx")).default;
  const lib = fileURLToPath(new URL("../node_modules/xlsx/dist/xlsx.full.min.js", import.meta.url));
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const ctx = await browser.newContext({viewport: {width: 390, height: 844}, acceptDownloads: true});
    await ctx.route("https://cdnjs.cloudflare.com/**", async (r) => r.fulfill({body: await readFile(lib), contentType: "text/javascript"}));
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
    const [fc] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-a=schx]")]);
    await fc.setFiles(file);
    await page.waitForSelector("table.sch");
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
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click("[data-a=scht]")]);
    const back = XLSX.utils.sheet_to_json(XLSX.read(await readFile(await dl.path())).Sheets["Dars jadvali"], {header: 1});
    assert.equal(back[0][2], "Dushanba"); assert.equal(back[1][2], "6-A Matematika");
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
