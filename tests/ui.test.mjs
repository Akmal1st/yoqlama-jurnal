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

test("o'quvchilarni bir yo'la chiqarish va qaytarish (Ctrl+Z)", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector("text=Xayrli");
    const before = await page.evaluate(() => D.classes[1].students.map((s) => s.name));
    await page.click(".tabbar [data-go=settings]"); await page.click('[data-sec="0"]');
    await page.click('[data-a=rmst][data-i="1"]');
    await page.check('[data-rm="0"]'); await page.check('[data-rm="2"]');
    await page.click(".modal [data-ok]");
    await page.waitForSelector(".modal [data-ok]"); await page.click(".modal [data-ok]");   // tasdiqlash
    await page.waitForFunction((n) => D.classes[1].students.length === n - 2, before.length);
    const after = await page.evaluate(() => D.classes[1].students.map((s) => s.name));
    assert.deepEqual(after, before.filter((_, i) => i !== 0 && i !== 2));
    await page.evaluate(() => undoLast());
    assert.deepEqual(await page.evaluate(() => D.classes[1].students.map((s) => s.name)), before);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
