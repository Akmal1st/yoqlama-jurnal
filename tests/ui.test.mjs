// Brauzerda tutun testi: ilova kompyuter va telefon ekranida ochiladi, hamma sahifalar xatosiz chiziladi.
// Ishga tushirish: npx playwright install chromium && node --test tests/ui.test.mjs
import {test} from "node:test";
import assert from "node:assert/strict";
import {fileURLToPath} from "node:url";
import {chromium} from "playwright";
import {DatabaseSync} from "node:sqlite";
import botServer from "../bot-server/worker.js";
import {makeGas} from "./gas_harness.mjs";
import {tmpdir} from "node:os";
import XLSXN from "xlsx";

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
      await page.waitForSelector(".bn-hd");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    await pop.click(".modal.ek-pick [data-ekok]", {timeout: 20000});   // jurnallarni tanlash oynasi — hammasi belgilangan
    await pop.waitForSelector("text=eMaktab'dan yangilandi", {timeout: 20000});   // tasdiq oynasi yo'q — darhol import
    assert.ok(asked.includes("/v2/excel?action=gjsxls&school=11&group=22&subgroup=0&subject=33&period=77"), asked.join(" "));
    assert.ok(!asked.some((a) => a.includes("class=9")));
    const cls = await pop.evaluate(() => D.classes.map((c) => [c.name, c.students.length]));
    assert.deepEqual(cls.map((c) => c[0]), ["7-B"]);
    assert.ok(cls[0][1] >= 3);
    await emk.waitForSelector("text=jurnal yuborildi");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

// «Mening sinflarim»ning ikki ko'rinishi: yangi (sinflar JSON ichida) va eski (#ContentPanelTeacher .cc dagi havolalar,
// yonida sinf rahbari paneli #ContentPanelMyClasses, jurnal havolasi …/journals/?school=&group=&subject= ko'rinishida ham)
for (const kind of ["json", "cc"]) test(`emaktab: «Mening sinflarim» (${kind}) — 36 va 18 o'quvchili sinflar`, async () => {
  const {readFile} = await import("node:fs/promises");
  const XLSX = (await import("xlsx")).default;
  const docs = fileURLToPath(new URL("../docs/", import.meta.url));
  const xlsOf = (cls, subj, n) => {
    const rows = [[`Sinf: ${cls} 2026/2027`], [`Fan: ${subj}`], [], ["№", "F.I.Sh.", "Sentabr", null, "Oktabr"], [null, null, 2, 9, 7]];
    for (let i = 1; i <= n; i++) rows.push([i, `O'quvchi ${cls} ${String(i).padStart(2, "0")}`, 5 + (i % 5), i % 7 ? 8 : "н", 9]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), subj);
    return XLSX.write(wb, {type: "buffer", bookType: "xls"});
  };
  const XLS = {22: xlsOf("6-A", "Matematika", 36), 23: xlsOf("9-A", "Algebra", 18)};
  const groups = [
    {name: "6-A", redirectUrl: "https://schools.emaktab.uz/v2/class?class=22", journal: [{subjectName: "Matematika", subgroupName: null, journalUrl: "https://emaktab.uz/journal/school/11/group/22/subject/33?periodId=77"}]},
    {name: "9-A", redirectUrl: "https://schools.emaktab.uz/v2/class?class=23", journal: [{subjectName: "Algebra", subgroupName: null, journalUrl: "https://emaktab.uz/journal/school/11/group/23/subject/34?periodId=78"}]},
    {name: "11-B", redirectUrl: "https://schools.emaktab.uz/v2/class?class=24", journal: []}];
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const ctx = await browser.newContext({serviceWorkers: "block"});
    const asked = [];
    await ctx.route("https://app.test/**", async (r) => {
      const p = new URL(r.request().url()).pathname.slice(1) || "index.html";
      try { r.fulfill({body: await readFile(docs + p), contentType: p.endsWith(".html") ? "text/html" : p.endsWith(".js") ? "text/javascript" : undefined}); } catch { r.fulfill({status: 404}); }
    });
    await ctx.route("https://emaktab.uz/**", (r) => { asked.push("X" + new URL(r.request().url()).pathname); r.fulfill({status: 404}); });   // boshqa manzil: o'qib bo'lmaydi
    await ctx.route("https://schools.emaktab.uz/**", (r) => {
      const u = new URL(r.request().url()); asked.push(u.pathname + u.search);
      // sarlavhada bitta sinf havolasi bor — u JSON dagi ro'yxatni to'smasligi kerak
      if (u.pathname === "/v2/myclasses") return r.fulfill({contentType: "text/html", body: kind === "json" ? `<html><body><a href="/v2/class?class=99">Mening sinfim</a><div id="teacher-root-v2"></div>
        <script>window.__TEACHERV2__INITIAL__STATE__ = {
            groups: ${JSON.stringify({groups})},
            other: {}
        };</script></body></html>` : `<html><body><div id="content"><h2>Mening sinflarim (2026/2027)</h2><div class="col23 first">
        <div id="ContentPanelMyClasses" class="panel gray"><div class="rounded"><div class="c1"></div><div class="cc"><a href="/v2/class?class=99">11-V</a>
          <a href="/v2/class?class=23">9-A</a><a href="https://schools.emaktab.uz/journals/?school=11&group=23&subject=34&period=78">Algebra</a></div><div class="c3"></div></div></div>
        <div id="ContentPanelTeacher" class="panel gray"><div class="rounded"><div class="c1"><a href="/v2/class?class=98">Menyu</a></div><div class="cc">
          <a href="/v2/class?class=22"><img src="g.png"></a><a href="/v2/class?class=22">6-A</a>
          <a href="https://schools.emaktab.uz/journals/?school=11&group=22&subject=33&period77&subgroup=0&tab=planning">Rejalashtirish</a>
          <a href="https://emaktab.uz/journal/school/11/group/22/subject/33?periodId=77" title="Matematika">Matematika</a>
          <a href="/v2/class?class=22&view=files">Fayllar</a>
        </div><div class="c3"></div></div></div></div></div></body></html>`});
      if (u.pathname === "/journal/school/11/group/22/subject/33") return r.fulfill({contentType: "text/html", body: `<script>window.__JOURNAL__INITIAL__STATE__ = {"journalHeader":{"currentPeriodId":77}};</script>`});
      if (u.pathname === "/v2/excel") { const b = XLS[u.searchParams.get("group")]; return b ? r.fulfill({contentType: "application/vnd.ms-excel", body: b}) : r.fulfill({status: 404}); }
      return r.fulfill({status: 404});
    });
    const app = await ctx.newPage(); const errors = []; app.on("pageerror", (e) => errors.push(e.message));
    await app.goto("https://app.test/");
    const code = await app.evaluate(() => emkCode());
    const emk = await ctx.newPage(); await emk.goto("https://schools.emaktab.uz/v2/myclasses");
    const [pop] = await Promise.all([ctx.waitForEvent("page"), emk.evaluate(code)]);
    pop.on("pageerror", (e) => errors.push(e.message));
    await pop.click(".modal.ek-pick [data-ekok]", {timeout: 20000});   // jurnallarni tanlash oynasi — hammasi belgilangan
    await pop.waitForSelector("text=eMaktab'dan yangilandi", {timeout: 20000});   // tasdiq oynasi yo'q — darhol import
    // 6-A: jurnal sahifasi schools.emaktab.uz dan o'qildi; 9-A: jurnal sahifasi yo'q — havoladagi periodId (78) olindi
    assert.ok(asked.includes("/v2/excel?action=gjsxls&school=11&group=22&subgroup=0&subject=33&period=77"), asked.join(" "));
    assert.ok(asked.includes("/v2/excel?action=gjsxls&school=11&group=23&subgroup=0&subject=34&period=78"), asked.join(" "));
    assert.ok(!asked.some((a) => /class=9[89]|group=24/.test(a)));
    const cls = await pop.evaluate(() => D.classes.map((c) => [c.name, c.subject, c.students.length]));
    assert.deepEqual(cls, [["6-A", "Matematika", 36], ["9-A", "Algebra", 18]]);
    await emk.waitForSelector("text=2 ta jurnal yuborildi");
    // natija oynasi: ikkala jurnal (36 va 18 o'quvchi); «Bugun» kartasi yangilangan vaqtni ko'rsatadi; «Bekor qilish» — avvalgi holat
    const res = await pop.textContent(".modal.ek-res");
    assert.match(res, /36 o'quvchi/); assert.match(res, /18 o'quvchi/);
    await pop.click(".modal.ek-res [data-x]");
    await pop.evaluate(() => go("today"));
    assert.match(await pop.textContent(".ek-sync"), /Yangilandi: hozirgina · 2 jurnal/);
    assert.equal(await pop.evaluate(() => D.web.emk_bm), 1);
    await pop.evaluate(() => EMK1.revert());
    assert.equal(await pop.evaluate(() => D.classes.length), 0);
    await emk.waitForSelector("text=2 ta jurnal yuborildi", {state: "detached", timeout: 8000});   // emaktab oynasi o'zi yopiladi
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("emaktab: kompyuter xatcho'pi har safar yangi emk.js ni yuklaydi, yuklanmasa — ichidagi zaxira kod", async () => {
  const {readFile} = await import("node:fs/promises");
  const docs = fileURLToPath(new URL("../docs/", import.meta.url));
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    for (const ok of [true, false]) {
      const ctx = await browser.newContext({serviceWorkers: "block"}), asked = [];
      await ctx.route("https://app.test/**", async (r) => {
        const p = new URL(r.request().url()).pathname.slice(1) || "index.html"; asked.push(p);
        if (p === "emk.js" && !ok) return r.fulfill({status: 404});
        try { r.fulfill({body: await readFile(docs + p), contentType: p.endsWith(".html") ? "text/html" : p.endsWith(".js") ? "text/javascript" : undefined}); } catch { r.fulfill({status: 404}); }
      });
      await ctx.route("https://schools.emaktab.uz/**", (r) => r.fulfill({contentType: "text/html", body: "<html><body></body></html>"}));
      const app = await ctx.newPage(); await app.goto("https://app.test/");
      const bm = await app.evaluate(() => emkBookmark());
      assert.ok(bm.includes("emk.js"), "xatcho'p emk.js ni yuklashi kerak");
      const emk = await ctx.newPage(); const errors = []; emk.on("pageerror", (e) => errors.push(e.message));
      await emk.goto("https://schools.emaktab.uz/v2/myclasses");
      await emk.evaluate(() => { window.open = () => null; });
      await emk.evaluate(decodeURIComponent(bm.slice(11)));
      await emk.waitForSelector("text=Yo'qlama jurnali");   // ikkala holatda ham kod ishga tushdi
      assert.ok(asked.includes("emk.js"));
      await emk.waitForSelector("text=jurnal topilmadi");
      assert.deepEqual(errors, [], ok ? "emk.js" : "zaxira");
      await ctx.close();
    }
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
      await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
      await page.reload(); await page.waitForFunction(() => S.page === "journal");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
      await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
      await page.evaluate(() => { D.settings.protect.enabled = false; window.print = () => { window.__printed = document.getElementById("pdoc").innerText; }; });
      await page.click(`${name === "telefon" ? ".tabbar" : ".side"} [data-go=journal]`);
      await page.evaluate(() => { S.jpage = "bsb"; render(); }); await page.waitForSelector("table.bsa");
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
      assert.equal(aoa[0][0], "12-maktab"); assert.ok(aoa.some((r) => r[1] === "O'zlashtirish, %") && aoa.some((r) => r[1] === "Baho" && r[2] === "Soni"), "yangi qatorlar Excelda"); assert.ok(aoa.some((r) => r.some((x) => String(x).startsWith("Metod birlashma rahbari"))));
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
    await page.evaluate(() => { D.settings.protect.enabled = false; });
    await page.click(".side [data-go=journal]"); await page.evaluate(() => { S.jpage = "bsb"; render(); }); await page.waitForSelector("table.bsa");
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
    const qh = aoa.findIndex((r) => r[0] === "Savol");   // sarlavha qatorlaridan keyin
    assert.ok(qh > 0); assert.equal(aoa[qh + 1][0], "1-savol");
    // rangli: sarlavha qatori to'q yashil, oq qalin harf (xlsx-js-style)
    const XS = XLSX.read(await readFile(await dl.path()), {cellStyles: true}).Sheets.Natijalar, hc = Object.keys(XS).find((a) => XS[a].v === "№");
    assert.equal(XS[hc].s && XS[hc].s.fgColor && XS[hc].s.fgColor.rgb, "0B5C5A", "Excel sarlavhasi rangli");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    await page.clock.setFixedTime(new Date(2026, 9, 20, 10, 0));   // 1-chorak ichidagi kun: chorak arxivi (arxiv.js) qulflamasin
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    for (const jp of ["sum", "sm", "year"]) { await page.click(`[data-jp=${jp}]`); assert.equal(await page.locator("[data-cpick]:visible").count(), 1); }
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    // eski usulda saqlangan ochiq parol: birinchi zaxirada IndexedDB'dagi kalitga almashtiriladi, parolning o'zi o'chadi
    await page.waitForFunction(() => IDB.ready);
    await page.evaluate(async () => { tgSet({pass: "maxfiy123"}); D.classes[0].name = "5-G"; await tgBackup(false); });
    assert.equal(docs.length, 3);
    assert.deepEqual(await page.evaluate(() => [tgCfg().pass, !!tgCfg().kslt, tgEnc()]), [undefined, true, true]);
    assert.ok(!(await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage))))).includes("maxfiy123"), "parol localStorage'da yo'q");
    assert.equal(await page.evaluate(async () => (await idbReq("kv", "readonly", (st) => st.get("tg_key"))).extractable), false, "kalitni o'qib bo'lmaydi");
    assert.ok(docs[2].includes("jurnal-sealed") && !docs[2].includes("\"5-G\"") && !docs[2].includes("Boshqa Qurilma"));
    const sp = (pinned.caption.match(/#d([\d.]+)/) || [])[1].split(".").map(Number);
    await page.evaluate(async (ids) => { window.__s = await tgReadParts(ids); }, sp);
    assert.equal(await page.evaluate(() => window.__s.type), "jurnal-sealed");
    assert.equal(await page.evaluate(async () => (await openSealed(window.__s)).classes[0].name), "5-G");
    // boshqa qurilma: parol saqlanmagan — so'raladi, noto'g'risi qabul qilinmaydi
    await page.evaluate(async () => { const c = tgCfg(); delete c.pass; delete c.kslt; localStorage.setItem(TG_KEY, JSON.stringify(c)); await tgKeyDrop(); window.__o = null; openSealed(window.__s).then((d) => { window.__o = d; }); });
    await page.fill("#ask", "notogri"); await page.click(".modal [data-ok]");
    await page.waitForSelector(".modal >> text=Qayta kiriting");
    await page.fill("#ask", "maxfiy123"); await page.click(".modal [data-ok]");
    await page.waitForFunction(() => window.__o && window.__o.classes[0].name === "5-G");
    // to'g'ri parol kiritilgach: parol emas, kalit saqlanadi (zaxiradagi tuz bilan) — keyingisi so'ralmaydi
    assert.deepEqual(await page.evaluate(() => [tgCfg().pass, tgCfg().kslt === window.__s.salt]), [undefined, true]);
    assert.equal(await page.evaluate(async () => (await openSealed(window.__s)).classes[0].name), "5-G");
    await page.evaluate(async () => { D.classes[0].name = "5-D"; await tgBackup(false); });
    assert.ok(docs[3].includes(await page.evaluate(() => tgCfg().kslt)) && !docs[3].includes("\"5-D\""), "yangi zaxira saqlangan kalit bilan shifrlandi");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    await page.clock.setFixedTime(new Date(2026, 9, 20, 10, 0));   // 1-chorak ichidagi kun: chorak arxivi (arxiv.js) qulflamasin
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
    // ulanmagan: Sozlamalarga yo'naltiradi, hech narsa yuborilmaydi
    await page.click(".tabbar [data-go=reports]"); await page.click("[data-tgpdf]:visible");
    await page.waitForSelector(".modal >> text=Telegram ulanmagan"); await page.click(".modal [data-x]").catch(() => {});
    await page.evaluate(() => { document.querySelectorAll(".modal").forEach((m) => m.remove()); tgSet({token: "123456789:AAHabcdefghijklmnopqrstuvwxyz", chat: 777, bot: "sinf_test_bot"}); });
    const pdfPages = (b) => (b.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
    // haqiqiy (vektor) PDF: shrift ichida, matn tanlanadi (ToUnicode), sahifa butunicha rasm emas
    const vector = (b) => { const t = b.toString("latin1"); return /\/FontFile2/.test(t) && /\/ToUnicode/.test(t) && !/\/DCTDecode/.test(t); };
    for (const kind of ["cls", "att", "sum", "par"]) {
      await page.evaluate((k) => { S.rep = Object.assign(S.rep || {}, {kind: k}); render(); }, kind);
      const n = docs.length; await page.click("[data-tgpdf]:visible");
      await page.waitForFunction(() => document.querySelector(".toast")?.textContent.includes("PDF hisobot Telegram'ga yuborildi"));
      await page.waitForFunction(() => !document.querySelector("[data-tgpdf]:disabled"));
      assert.equal(docs.length, n + 1, kind); const d = docs[n];
      assert.ok(d.pdf && d.pdf.subarray(0, 5).toString() === "%PDF-" && pdfPages(d.pdf) >= 1, `${kind}: PDF`);
      assert.ok(vector(d.pdf), `${kind}: vektor PDF (matnli), rasm emas`);
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
    assert.ok(vector(b.pdf), "BSB: vektor PDF");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
      await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
    const names = await page.evaluate(() => {
      const t = todayIso(), c = D.classes[0];
      if (!c.dates.includes(t)) { c.dates.push(t); c.dates.sort(); } c.extra_x = c.extra_x.filter((d) => d !== t); c.held.push(t);
      c.students.forEach((s) => delete s.marks[t]); D.settings.protect.enabled = false; save(); startLesson(0); return c.students.map((s) => s.name);
    });
    await page.click('[data-am="map"]');
    await page.click("text=Xaritani tuzish");
    // birinchi ochilishda alifbo bo'yicha avtomatik joylashadi (orindiq.js)
    assert.equal(await page.locator(".modal .ox-seat:not(.empty)").count(), names.length);
    // 1-o'rindagi o'quvchini bo'sh joyga ko'chirish, 2-sini xaritadan olish
    const empty = await page.locator(".modal .ox-seat.empty").first().getAttribute("data-oxs");
    await page.click('.modal [data-oxs="0-0"]'); await page.click(`.modal [data-oxs="${empty}"]`);
    await page.click('.modal [data-oxs="0-1"]'); await page.click(".modal [data-unseat]");
    const at = await page.evaluate(() => D.web.seats[normName(D.classes[0].name)].at);
    assert.equal(at[empty], names[0]); assert.equal(at["0-0"], undefined); assert.equal(at["0-1"], undefined);
    // sudrab almashtirish: 1-0 dagi o'quvchi ko'chirilgan o'quvchi joyiga — o'rin almashadi
    const n10 = await page.evaluate(() => D.web.seats[normName(D.classes[0].name)].at["1-0"]);
    const A = await page.locator('.modal [data-oxs="1-0"]').boundingBox(), B = await page.locator(`.modal [data-oxs="${empty}"]`).boundingBox();
    await page.mouse.move(A.x + 10, A.y + 10); await page.mouse.down(); await page.mouse.move(A.x + 30, A.y + 30, {steps: 3}); await page.mouse.move(B.x + 10, B.y + 10, {steps: 6}); await page.mouse.up();
    const at2 = await page.evaluate(() => D.web.seats[normName(D.classes[0].name)].at);
    assert.equal(at2[empty], n10); assert.equal(at2["1-0"], names[0]);
    await page.click(".modal [data-x]");
    // xaritadan yo'qlama: avval holat, keyin joy (S, so'ng DQ bilan almashtirish); xaritada yo'q o'quvchi — pastdagi ro'yxatdan
    await page.click('[data-oxs="1-0"]');
    await page.click('[data-oxbr="dq"]'); await page.click('[data-oxs="1-0"]');
    await page.click('[data-oxbr="s"]'); await page.click('[data-satt="1"]');
    const m = await page.evaluate(() => D.classes[0].students.slice(0, 2).map((s) => s.marks[todayIso()] || ""));
    assert.deepEqual(m, ["dq", "s"]);
    assert.ok((await page.textContent('[data-oxs="1-0"]')).includes("DQ"));
    // yana bosilsa — «Keldi»
    await page.click('[data-oxbr="dq"]'); await page.click('[data-oxs="1-0"]');
    assert.equal(await page.evaluate(() => D.classes[0].students[0].marks[todayIso()] || ""), "");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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

test("Brauzer xotirasi (localStorage) to'lsa: o'zgarish IndexedDB'ga yoziladi va qayta ochilganda tiklanadi", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
    await page.waitForFunction(() => IDB.ready);
    // xotira to'ldi: asosiy kalitga yozish QuotaExceededError beradi
    await page.evaluate(() => {
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) { if (k === "yoqlama_jurnal") throw new DOMException("full", "QuotaExceededError"); return orig.call(this, k, v); };
      D.classes[0].students[0].marks[todayIso()] = "9"; D.classes[0].students[0].name = "Xotira To'lgan"; save();
    });
    await page.waitForSelector("text=zaxira xotiraga (IndexedDB) saqlandi");
    // darhol yozilgan bo'lishi kerak (300 ms kutilmaydi)
    await page.waitForFunction(async () => { const t = await idbReq("kv", "readonly", (st) => st.get("main")); return t && t.includes("Xotira To'lgan"); }, null, {timeout: 2000});
    assert.ok(!(await page.evaluate(() => localStorage.getItem("yoqlama_jurnal").includes("Xotira To'lgan"))), "localStorage'da eski nusxa qolgan");
    await page.reload(); await page.waitForFunction(() => IDB.ready);
    await page.waitForSelector("text=zaxira xotiradan");
    assert.equal(await page.evaluate(() => D.classes[0].students[0].name), "Xotira To'lgan");
    assert.equal(await page.evaluate(() => D.classes[0].students[0].marks[todayIso()]), "9");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("«Bugun»da ilovani o'rnatish taklifi: O'rnatish brauzer oynasini ochadi, «Yo'q» dan keyin chiqmaydi", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1440, height: 900}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
    assert.equal(await page.locator("[data-inst]").count(), 0, "brauzer taklif qilmasa — karta yo'q");
    // brauzer «o'rnatish mumkin» deb xabar berdi
    await page.evaluate(() => { const e = new Event("beforeinstallprompt"); e.prompt = () => { window.__asked = (window.__asked || 0) + 1; }; e.userChoice = Promise.resolve({outcome: "dismissed"}); window.dispatchEvent(e); });
    await page.waitForSelector("[data-inst='1']");
    await page.click("[data-inst='1']");
    assert.equal(await page.evaluate(() => window.__asked), 1);
    await page.evaluate(() => { const e = new Event("beforeinstallprompt"); e.prompt = () => {}; e.userChoice = Promise.resolve({}); window.dispatchEvent(e); });
    await page.waitForSelector("[data-inst='0']");
    await page.click("[data-inst='0']");
    assert.equal(await page.locator("[data-inst]").count(), 0);
    assert.equal(await page.evaluate(() => D.web.inst_hint), 1);
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
    await page.click(".tabbar [data-go=journal]"); await page.click("[data-more]");
    const heads = await page.$$eval(".modal .mgrp h3", (x) => x.map((e) => e.textContent));
    assert.deepEqual(heads.slice(0, 3), ["Darsda", "O'quvchilar", "Ota-onalar"]);
    await page.fill("#mq", "tugʻilgan");
    const vis = await page.$$eval(".modal [data-i]", (x) => x.filter((b) => b.offsetParent).map((b) => b.textContent));
    assert.deepEqual(vis, ["🎂 Tug'ilgan kunlar"]);
    assert.equal(await page.$$eval(".modal .mgrp", (x) => x.filter((g) => g.offsetParent).length), 1);
    await page.fill("#mq", "ota-ona");
    assert.equal(await page.$$eval(".modal [data-i]", (x) => x.filter((b) => b.offsetParent).length), 2, "bo'lim nomi bo'yicha ham topiladi (eMaktab'ga kirish sukut bo'yicha o'chiq)");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
    // import qilingan jurnalda hammasi yoqilgan
    // hammasi yoqilgan, faqat sukut bo'yicha o'chiqlar (FEAT_OPTIN: Ota-onalar eMaktab'i) bundan mustasno
    assert.equal(await page.evaluate(() => FEATS.filter(([k]) => feat(k)).length), await page.evaluate(() => FEATS.length - FEAT_OPTIN.size));
    assert.equal(await page.evaluate(() => feat("otaemk")), false);
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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

test("Davomat varag'i: butun chorak, har o'quvchining belgilari sanasi bilan, 36 o'quvchi bitta A4 varaqda, Excel", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    for (const [name, viewport] of [["kompyuter", {width: 1024, height: 800}], ["telefon", {width: 390, height: 844}]]) {
      const page = await browser.newPage({viewport, acceptDownloads: true});
      const errors = []; page.on("pageerror", (e) => errors.push(e.message));
      await page.clock.setFixedTime(new Date(2026, 10, 3, 10, 0));
      await page.goto(APP);
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
      await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
      // sinfda 36 o'quvchi (eng ko'p); birinchisiga 1-chorakda S va K, 2-chorakdagi belgi hisobga kirmaydi
      const exp = await page.evaluate(() => {
        const c = D.classes[0], base = c.students[0];
        for (let i = c.students.length; i < 36; i++) c.students.push(Object.assign(JSON.parse(JSON.stringify(base)), {name: `Sinovov O'quvchi ${i + 1}`, marks: {}}));
        const [lo, hi] = qRange(1), ds = c.dates.filter((d) => lo <= d && d <= hi && !isNoLesson(c, d));
        c.students.forEach((s) => { for (const d of ds) if (attPart(s.marks[d] || "")) delete s.marks[d]; });
        const s0 = c.students[0]; s0.marks[ds[0]] = "s"; s0.marks[ds[2]] = "k"; s0.marks[ds[3]] = "8";
        c.students[35].marks[ds[1]] = "8kq";
        save(); S.rq = 1; S.rep = {ci: 0, per: "cur", kind: "att"}; go("reports");
        return {n: ds.length, d0: fmt(ds[0]).slice(0, 5), d2: fmt(ds[2]).slice(0, 5), d1: fmt(ds[1]).slice(0, 5)};
      });
      await page.waitForSelector(".hb .dv");
      assert.ok((await page.textContent("[data-hk=per]:visible")).includes("1-chorak"));
      assert.ok((await page.textContent(".hb .hb-kpis")).includes(String(exp.n)), "dars kunlari soni");
      const tel = name === "telefon";
      const rowsSel = tel ? ".dv-rows .dv-li" : "table.dv-t tbody tr";
      assert.equal(await page.locator(rowsSel).count(), 36);
      const r1 = await page.locator(rowsSel).first().textContent();
      assert.ok(r1.includes(`${exp.d0} S`) && r1.includes(`${exp.d2} K`), r1);
      if (!tel) { const td = await page.$$eval("table.dv-t tbody tr:first-child td", (x) => x.map((e) => e.textContent.trim())); assert.deepEqual(td.slice(3, 7), ["1", "", "1", ""]); }
      assert.ok((await page.locator(rowsSel).last().textContent()).includes(`${exp.d1} KQ`));
      // «hamma kelganlar» o'chirilsa — faqat belgisi borlar; panel qayta yaratilmaydi
      await page.evaluate(() => { document.querySelector(".dv").__mark = 1; });
      await page.click("[data-dv=tog][data-k=all]");
      assert.equal(await page.locator(rowsSel).count(), 2);
      assert.equal(await page.evaluate(() => document.querySelector(".dv").__mark), 1, "panel qayta chizildi");
      await page.click("[data-dv=tog][data-k=all]");
      // varaq ko'rinishi: 36 o'quvchi bitta A4 tik varaqqa sig'adi (har shrift o'lchamida)
      await page.click("[data-dv=view][data-v=paper]");
      await page.waitForSelector(".dv-scale .dv-pg");
      await page.evaluate(() => window.scrollTo(0, 150)); const y0 = await page.evaluate(() => scrollY);
      for (const fs of ["l", "m", "s"]) {
        await page.click(`[data-dv=fs][data-v=${fs}]`);
        assert.equal(await page.evaluate(() => scrollY), y0, "sahifa joyidan siljidi");
        assert.equal(await page.locator(".dv-scale .dv-pg tbody tr").count(), 36);
        assert.ok((await page.textContent(".dv-bar")).includes("1 varaq"), `${fs}: sig'madi`);
      }
      assert.ok((await page.textContent(".dv-scale .dv-pg")).includes("DAVOMAT VARAG'I"));
      if (!tel) {
        // chop etish: faqat varaq, A4 tik, sig'adi
        await page.evaluate(() => fitPrint()); assert.equal(await page.$("#pfit-css"), null);
        await page.emulateMedia({media: "print"});
        assert.equal(await page.locator(".hb .dv").isVisible(), false);
        assert.ok(await page.evaluate(() => { const i = document.querySelector(".dv-print .dv-in"); return i.offsetHeight > 0 && i.scrollHeight <= i.clientHeight + 1; }), "chop etishda varaq sig'maydi");
        await page.emulateMedia({media: "screen"});
        await page.evaluate(() => { window.loadXlsx = () => Promise.reject(new Error("offline")); });
        const [dl] = await Promise.all([page.waitForEvent("download"), page.click("[data-dvx]:visible")]);
        assert.ok(dl.suggestedFilename().includes("davomat"), dl.suggestedFilename());
        // tugmalar matni sig'adi (1024 px)
        assert.deepEqual(await page.$$eval(".hb .dv button, .hb-acts .btn", (bs) => bs.filter((b) => b.offsetWidth && b.scrollWidth > b.clientWidth + 1).map((b) => b.textContent)), []);
      }
      // boshlanmagan chorak
      await page.evaluate(() => { S.rq = 2; D.settings.quarters[1] = ["2026-11-10", "2026-12-27"]; render(); });
      assert.ok((await page.textContent(".dv-empty")).includes("hali boshlanmagan"));
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});

test("Ota-onalar majlisi: har o'quvchiga varaq, xavf filtri, A4 da ikkitadan", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1300, height: 900}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
      await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
    await page.click(".tabbar [data-go=reports]");
    const kind = async (k) => { await page.click("[data-hk=kind]"); await page.click(`.modal [data-kind=${k}]`); };
    // telefonda turlar «Almashtirish» oynasida: 8 ta, guruhlangan
    await page.click("[data-hk=kind]");
    assert.equal(await page.$$eval(".modal [data-kind]", (x) => x.length), 9);
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
    assert.ok((await page.textContent("[data-hk=per]:visible")).includes("chorak"));
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    await page.click('[data-ktr="0"]'); await page.waitForSelector("[data-ktpage]");
    assert.ok((await page.textContent(".kt-hd")).includes("4 soat orqada"));
    await page.click("[data-k=back]");
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

test("Haftalik xulosa va faollik olib tashlangan, ota-onaga natija havolasi", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.clock.setFixedTime(new Date("2026-10-23T10:00:00"));   // juma
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
    // Haftalik xulosa va faollik belgilari olib tashlangan (2026-11-07): D.web.off da bo'lmasa ham ko'rinmaydi
    assert.equal(await page.evaluate(() => [feat("week"), feat("act"), FEATS.some(([k]) => k === "week" || k === "act")].join()), "false,false,false");
    assert.equal(await page.locator(".wkc, [data-wk]").count(), 0);
    await page.evaluate(() => { S.lesson = 1; S.ci = 1; S.step = 1; go("lesson"); });
    assert.equal(await page.locator("[data-act], [data-actg]").count(), 0);
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    // chorak so'ralmaydi: ilova javob bermadi — joriy va oldingi choraklar olinadi; oyna ochilmadi — «Ilovaga yuborish» / «Faylga saqlash»
    await emk.waitForSelector('[data-emk="open"]', {timeout: 20000});
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
    await app.waitForSelector("text=eMaktab'dan yangilandi", {timeout: 20000});
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

test("emaktab: ilovada bor oldingi chorak qayta olinmaydi, bekor qilish ishlaydi", async () => {
  const {readFile} = await import("node:fs/promises");
  const XLSX = (await import("xlsx")).default;
  const docs = fileURLToPath(new URL("../docs/", import.meta.url));
  const xls = (n) => { const rows = [["Sinf: 7-B 2026/2027"], ["Fan: Matematika"], [], ["№", "F.I.Sh.", "Noyabr"], [null, null, 4]];
    for (let i = 1; i <= n; i++) rows.push([i, `O'quvchi ${String(i).padStart(2, "0")}`, 5 + (i % 5)]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Matematika"); return XLSX.write(wb, {type: "buffer", bookType: "xls"}); };
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const ctx = await browser.newContext({serviceWorkers: "block"});
    const asked = [];
    await ctx.route("https://app.test/**", async (r) => {
      const p = new URL(r.request().url()).pathname.slice(1) || "index.html";
      try { r.fulfill({body: await readFile(docs + p), contentType: p.endsWith(".html") ? "text/html" : p.endsWith(".js") ? "text/javascript" : undefined}); } catch { r.fulfill({status: 404}); }
    });
    const hdr = {currentPeriodId: 78, currentGroupId: 5, periods: {5: {periods: [{id: 77, number: 0, name: "I chorak"}, {id: 78, number: 1, name: "II chorak"}]}}};
    await ctx.route("https://schools.emaktab.uz/**", (r) => {
      const u = new URL(r.request().url()); asked.push(u.pathname + u.search);
      if (u.pathname === "/v2/userfeed") return r.fulfill({contentType: "text/html", body: "<html><body>lenta</body></html>"});
      if (u.pathname === "/v2/myclasses") return r.fulfill({contentType: "text/html", body: `<div id="ContentPanelTeacher"><a href="/v2/class?class=1">7-B</a><a href="/v2/journal/school/11/group/22/subject/33" title="Matematika">Matematika</a></div>`});
      if (u.pathname.startsWith("/v2/journal/")) return r.fulfill({contentType: "text/html", body: `<script>window.__JOURNAL__INITIAL__STATE__ = ${JSON.stringify({journalHeader: hdr})};</script>`});
      if (u.pathname === "/v2/excel") return r.fulfill({contentType: "application/vnd.ms-excel", body: xls(u.searchParams.get("period") === "78" ? 36 : 18)});
      return r.fulfill({status: 404});
    });
    const app = await ctx.newPage(); const errors = []; app.on("pageerror", (e) => errors.push(e.message));
    await app.goto("https://app.test/");
    // ilovada 7-B · Matematika bor, 1-chorakda belgisi bor
    await app.evaluate(() => {
      D = normalize({classes: [{name: "7-B", subject: "Matematika", dates: ["2026-09-10"], students: [{name: "O'quvchi 01", marks: {"2026-09-10": "5"}}]}],
        settings: {quarters: [["2026-09-02", "2026-10-31"], ["2026-11-09", "2026-12-27"], ["2027-01-11", "2027-03-20"], ["2027-03-30", "2027-05-25"]]}});
      save();
    });
    assert.deepEqual(await app.evaluate(() => EMK1.have()), [{n: "7-B", s: "Matematika", q: [1]}]);
    const code = await app.evaluate(() => emkCode());
    const emk = await ctx.newPage(); emk.on("pageerror", (e) => errors.push(e.message));
    await emk.goto("https://schools.emaktab.uz/v2/userfeed");   // «Sinflarim» emas — istalgan sahifa
    const [pop] = await Promise.all([ctx.waitForEvent("page"), emk.evaluate(code)]);
    pop.on("pageerror", (e) => errors.push(e.message));
    await pop.click(".modal.ek-pick [data-ekok]", {timeout: 20000});   // jurnallarni tanlash oynasi — hammasi belgilangan
    await pop.waitForSelector("text=eMaktab'dan yangilandi", {timeout: 20000});
    assert.ok(asked.some((a) => a.includes("period=78")), asked.join(" "));
    assert.ok(!asked.some((a) => a.includes("period=77")), "1-chorak ilovada bor — qayta olinmaydi");
    assert.equal(await pop.evaluate(() => D.classes[0].students.length), 36);
    // telefon kengligida natija oynasi yonga chiqmaydi
    await pop.setViewportSize({width: 390, height: 844});
    assert.ok(await pop.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await pop.click(".modal.ek-res [data-ekundo]");
    assert.equal(await pop.evaluate(() => D.classes[0].students.length), 1);
    // ilovadagi oldingi chorak fayli tashlanadi (fayl orqali kelganda ham joriy chorak doim olinadi)
    const pq = await pop.evaluate(() => { const x = (n, d) => ({name: "7-B", subject: "Matematika", dates: [d], students: []});
      const r = EMK1.pickQuarters([x(0, "2026-09-10"), x(0, "2026-11-12")]); return [r.out.map((y) => y.dates[0]), r.skip.length]; });
    assert.deepEqual(pq, [["2026-11-12"], 1]);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Sozlamalar: bir sinfga bir necha fandan kirilsa, o'quvchilar bir marta sanaladi (36 va 18)", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1440, height: 900}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
    const r = await page.evaluate(() => {
      const st = (n, p) => Array.from({length: n}, (_, i) => ({name: `${p} O'quvchi ${i + 1}`}));
      const mk = (name, subject, n, off = 0) => { const c = JSON.parse(JSON.stringify(D.classes.find((x) => !isGrp(x)))); c.name = name; c.subject = subject;
        c.students = st(n, name).map((s, i) => ({...c.students[0], ...s, id: name + subject + i, marks: {}})); c.students_off = st(off, name + " ketgan").map((s, i) => ({...c.students[0], ...s, id: "o" + name + subject + i, marks: {}})); return c; };
      // 9-A (36 o'quvchi) — 3 fan, 5-B (18 o'quvchi) — 2 fan; 5-B nomi boshqacha yozilgan («5-b »)
      D.classes = D.classes.filter(isGrp).concat([mk("9-A", "Matematika", 36, 2), mk("9-A", "Fizika", 36, 2), mk("9-A", "Algebra", 36), mk("5-B", "Ona tili", 18, 1), mk("5-b ", "Adabiyot", 18)]);
      S.sec = 0; go("settings");
      return {tiles: [...document.querySelectorAll(".sz-sum b")].map((b) => +b.textContent),
        rows: [...document.querySelectorAll(".sz-cls small")].map((x) => parseInt(x.textContent)), u: [uniqStudents(D.classes.filter((c) => !isGrp(c))), uniqClasses(D.classes.filter((c) => !isGrp(c)))]};
    });
    assert.deepEqual(r.tiles, [2, 54, 3], "sinf / o'quvchi / faolsiz: 36 + 18 = 54, takrorlanmaydi");
    assert.deepEqual(r.rows, [36, 36, 36, 18, 18], "har fan qatorida o'z sinfi soni");
    assert.deepEqual(r.u, [54, 2]);
    assert.ok(await page.evaluate(() => document.body.innerText.includes("2 sinf · 54 o'quvchi")), "bo'limlar ro'yxatidagi holat ham 54");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    const same = await page.evaluate(() => { const row = $("[data-ft=bday]"), a = $(".fn-tx", row).getBoundingClientRect(), b = $(".kalit", row).getBoundingClientRect(); return b.top < a.bottom && b.left > a.right - 1; });
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
    await page.waitForSelector(".clsstat tbody tr");
    assert.equal(await page.locator(".clsstat tbody tr").count(), await page.evaluate(() => D.classes.filter((c) => !isGrp(c)).length));
    assert.ok(await page.locator(".clsstat .bn-tr i").count() > 0);   // davomat va o'zlashtirish chiziqlari (bugun.js)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 1);
    // ta'til kuni (1-chorak 29.10 da tugagan, hali arxivlanmagan): ko'rsatkich o'rnida «Sinflar bo'yicha tayyorlik» (bugun-tatil.js)
    await page.clock.setFixedTime(new Date(2026, 10, 1, 10, 0)); await page.evaluate(() => render());
    await page.waitForSelector(".bt-tbl tbody tr");
    assert.equal(await page.locator(".bt-tbl tbody tr").count(), await page.evaluate(() => D.classes.filter((c) => !isGrp(c) && c.students.length).length));
    assert.equal(await page.evaluate(() => { return compareRows("2026-09-02", "2026-10-29", 1).some((r) => (r.qu ?? r.qp) !== null); }), true, "tugagan chorak O'zlashtirishi hisoblanadi");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Bugun: arxivlangan chorak — xulosa bloki, Kartalar | Reyting (bugun-arxiv.js)", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    for (const [w, tel] of [[1300, false], [390, true]]) {
      const page = await browser.newPage({viewport: {width: w, height: 900}});
      const errors = []; page.on("pageerror", (e) => errors.push(e.message));
      await page.clock.setFixedTime(new Date(2026, 10, 3, 10, 0));   // 1-chorak 29.10 da tugagan, 3 kundan keyin arxivlangan; 2-chorak 05.11 dan
      await page.goto(APP);
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
      await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
      await page.evaluate(() => { ARX.tick(); render(); });
      assert.ok(await page.evaluate(() => !!ARX.entry(1)));
      if (tel) { await page.click("[data-btab=res]"); }   // ta'tilda telefon bo'limlari: Vazifalar · Natija · E'tibor (bugun-tatil.js)
      await page.waitForSelector(".ba-x");
      assert.match(await page.locator(".ba-x h2").textContent(), /1-chorak yakunlandi/);
      const n = await page.evaluate(() => D.classes.filter((c) => !isGrp(c) && c.students.length).length);
      assert.equal(await page.locator(".ba-kt").count(), n);
      assert.equal(await page.locator(".clsstat").count(), 0);
      // 🏆/⚠ ikonka matn yonida turadi (ikon.js span'i "span{flex:1}" bilan cho'zilmasin)
      for (const g of await page.evaluate(() => [...document.querySelectorAll(".ba-h button")].map((bt) => { const i = bt.querySelector(".bi").getBoundingClientRect(), t = bt.querySelector("span:not(.bi):not(.bi-t)").getBoundingClientRect(); return [i.width, t.left - i.right]; })))
        assert.ok(g[0] < 30 && g[1] < 16, `ikonka ${g}`);
      await page.click("[data-baxv=r]");
      assert.equal(await page.locator(".ba-rr").count(), n);
      await page.click("[data-baxm=att]");
      assert.equal(await page.locator("[data-baxm=att].on").count(), 1);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 1);
      await page.click("[data-baxv=k]");
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});

test("KTR: reja boshlanadigan sanani tanlash", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1280, height: 800}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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

// KTR sahifasi (ktr.js): reja, uy vazifasi dars kuniga, soat ±, «dars bo'lmadi», tahrirlash, Excel «ish reja» eksporti/importi, matn, chop etish
for (const [name, viewport] of [["kompyuter", {width: 1280, height: 860}], ["telefon", {width: 390, height: 844}]]) for (const n of [36, 18]) test(`KTR sahifasi (${name}, ${n} o'quvchi)`, async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const ctx = await browser.newContext({serviceWorkers: "block", viewport, acceptDownloads: true});
    const page = await ctx.newPage();
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.clock.setFixedTime(new Date(2026, 10, 12, 10, 0));   // 2026-11-12, payshanba — 2-chorak ichida
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
    const ci = await page.evaluate((n) => {
      D.settings.quarters = [["2026-09-02", "2026-10-31"], ["2026-11-09", "2026-12-26"], ["2027-01-12", "2027-03-19"], ["2027-03-29", "2027-05-25"]];
      const dates = []; for (let d = pdate("2026-09-02"); iso(d) <= "2027-05-25"; d = addDays(d, 1)) if ([0, 2, 4].includes(pyWd(iso(d))) && quarterOf(iso(d))) dates.push(iso(d));
      const c = normalize({web: {dv: 2}, classes: [{name: "7-A", subject: "Algebra", dates, students: Array.from({length: n}, (_, i) => ({name: "O'quvchi " + (i + 1), marks: {}}))}]}).classes[0];
      c.plan = {on: true, start: "2026-09-02", topics: parsePlanText("== 1-chorak\nTakrorlash | 2\n== 2-chorak\nUmumiy ko'paytuvchi | 2 | §16, 104-mashq ; §16, 108-mashq\nGuruhlash usuli | 2 | §17\nYig'indi kvadrati\nBSB №2 (25 ball)\n== 3-chorak\nFunksiya | 2\n== 4-chorak\nStatistika")};
      D.classes.push(c); reflowPlan(c); save(); KTR.open(D.classes.length - 1); return D.classes.length - 1;
    }, n);
    await page.waitForSelector("[data-ktpage]");
    // 1-chorak (tugagan) yig'ilgan, qolganlari ochiq: 2+1+1 qator ko'rinadi, 7 mavzu
    assert.equal(await page.locator(".kt-tr[data-kti]").count(), 6);
    assert.match(await page.textContent(".kt-hd"), new RegExp(`${n} o'quvchi`));
    // uy vazifasi dars kuniga: 2 soatlik mavzuning har darsiga o'zi
    const L = () => page.evaluate((ci) => Object.entries(D.classes[ci].lessons).filter(([, l]) => l.auto).sort().map(([d, l]) => [d, l.topic, l.hw]), ci);
    let ls = await L();
    const u1 = ls.find((x) => x[1] === "Umumiy ko'paytuvchi (1/2)"), u2 = ls.find((x) => x[1] === "Umumiy ko'paytuvchi (2/2)"), g2 = ls.find((x) => x[1] === "Guruhlash usuli (2/2)");
    assert.deepEqual([u1[2], u2[2], g2[2]], ["§16, 104-mashq", "§16, 108-mashq", "§17"]);
    // o'qituvchi darsda o'zgartirgan uy vazifasi reja o'zgarsa ham qoladi
    await page.evaluate(([ci, d]) => { D.classes[ci].lessons[d].hw = "o'zim yozdim"; save(); }, [ci, g2[0]]);
    await page.click('.kt-tr[data-kti="3"] [data-k=hp]');   // Yig'indi kvadrati: 1 → 2 soat
    assert.equal(await page.evaluate((ci) => D.classes[ci].plan.topics[3].h, ci), 2);
    ls = await L();
    assert.equal(ls.find((x) => x[1] === "Guruhlash usuli (2/2)")[2], "o'zim yozdim");
    assert.ok(ls.some((x) => x[1] === "Yig'indi kvadrati (2/2)"));
    // sanani bosib «dars bo'lmadi» — mavzular keyingi kunga suriladi
    const bsb0 = ls.find((x) => x[1] === "BSB №2 (25 ball)")[0], yd = ls.find((x) => x[1] === "Yig'indi kvadrati (1/2)")[0];
    await page.click(`.kt-tr[data-kti="3"] .kt-dc[data-v="${yd}"]`); await page.waitForSelector(".kt-pop [data-k=off]");
    await page.click(".kt-pop [data-k=off]");
    ls = await L();
    assert.ok(await page.evaluate(([ci, d]) => D.classes[ci].extra_x.includes(d), [ci, yd]));
    assert.ok(ls.find((x) => x[1] === "BSB №2 (25 ball)")[0] > bsb0, "BSB keyingi dars kuniga surildi");
    assert.equal(await page.locator(".kt-off").count(), 1);
    await page.click(".kt-off [data-k=unoff]");
    assert.equal((await L()).find((x) => x[1] === "BSB №2 (25 ball)")[0], bsb0);
    // tahrirlash: 2 soatlik mavzuda har dars uchun alohida uy vazifasi
    await page.click('.kt-tr[data-kti="2"] [data-k=rmenu]'); await page.click(".kt-pop [data-k=edit]");
    assert.equal(await page.locator(".kt-dlg .kt-ehw").count(), 2);
    await page.locator(".kt-dlg .kt-ehw").nth(1).fill("§18");
    await page.click(".kt-dlg [data-ok]");
    assert.equal(await page.evaluate((ci) => D.classes[ci].plan.topics[2].hw, ci), "§17 ; §18");
    // Excel «ish reja»: 2-chorak, har dars alohida qator
    await page.click("[data-k=exp]"); await page.click(".kt-pop [data-k=xls]"); await page.waitForSelector(".kt-xl");
    assert.equal(await page.locator(".kt-xl tbody tr").count(), 1 + 2 + 2 + 2 + 1);
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click(".kt-dlg [data-ok]")]);
    assert.equal(dl.suggestedFilename(), "7-A algebra 2-chorak ish reja.xlsx");
    const wb = XLSXN.readFile(await dl.path()), ws = wb.Sheets[wb.SheetNames[0]];
    assert.equal(wb.SheetNames[0], "7-A. Algebra");
    assert.deepEqual(XLSXN.utils.sheet_to_json(ws, {header: 1, defval: ""}).slice(0, 5), [["Darslar tartibi", "Mavzu nomi", "Uyga vazifa"], [1, "Umumiy ko'paytuvchi", "§16, 104-mashq"], [2, "Umumiy ko'paytuvchi", "§16, 108-mashq"], [3, "Guruhlash usuli", "§17"], [4, "Guruhlash usuli", "§18"]]);
    // shu shakldagi faylni yuklash: ketma-ket bir xil mavzular birlashadi, 3-chorak o'rniga
    const iw = XLSXN.utils.book_new();
    XLSXN.utils.book_append_sheet(iw, XLSXN.utils.aoa_to_sheet([["Darslar tartibi", "Mavzu nomi", "Uyga vazifa"], [1, "Sistemalar", "157-masala"], [2, "Sistemalar", "164-masala"], [3, "3-nazorat ishi", "takrorlash"], [4, "Misollar yechish", "241-masala"]]), "9-sinf. Algebra");
    await page.click("[data-k=imp]");
    const [fc] = await Promise.all([page.waitForEvent("filechooser"), page.click(".kt-pop [data-k=ximp]")]);
    await fc.setFiles({name: "9-sinf algebra 3-chorak ish reja.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: XLSXN.write(iw, {type: "buffer", bookType: "xlsx"})});
    await page.waitForSelector(".kt-dlg [data-xq].on");
    assert.equal(await page.textContent(".kt-dlg [data-xq].on"), "3");
    await page.click(".kt-dlg [data-ok]");
    assert.deepEqual(await page.evaluate((ci) => D.classes[ci].plan.topics.filter((x) => x.q === 3), ci), [{t: "Sistemalar", h: 2, hw: "157-masala ; 164-masala", q: 3}, {t: "3-nazorat ishi", h: 1, hw: "takrorlash", q: 3}, {t: "Misollar yechish", h: 1, hw: "241-masala", q: 3}]);
    // matn: «Mavzu | soat | uy vazifasi»
    await page.click("[data-k=tab][data-v=txt]");
    assert.match(await page.inputValue("#kt-txt"), /Guruhlash usuli \| 2 \| §17 ; §18/);
    // chop etish: A4 varaqlar, ekran yon tomonga surilmaydi
    await page.click("[data-k=tab][data-v=print]"); await page.waitForSelector("#kt-pw .bx-pg .kt-pt");
    assert.match(await page.textContent("#kt-pw"), /KALENDAR-TEMATIK REJA|Kalendar-tematik reja/);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
    // orqaga — jurnalga
    await page.click("[data-k=back]"); assert.equal(await page.evaluate(() => S.jpage), "j");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Jurnal tagida: bugungi dars bo'yicha sinf ma'lumoti kartasi", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1280, height: 800}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.clock.setFixedTime(new Date(2026, 9, 20, 10, 0));   // chorak ichidagi kun: tugagan chorak qulflanib, karta yashirinmasin
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
      await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
        await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
      await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
      const sizes = async (sel) => page.$$eval(sel, (x) => x.filter((b) => b.offsetParent).map((b) => { const r = b.getBoundingClientRect(), i = b.querySelector(".ic, .si, .sz-ic").getBoundingClientRect(); return [Math.round(r.height), Math.round(i.width), parseFloat(getComputedStyle(b.querySelector("b, .sn")).fontSize)]; }));
      // Hisobotlar (hisobotlar.js): kompyuterda chap ro'yxat, telefonda «Almashtirish» oynasi — hammasi bir xil, yozuv bir qatorda
      await page.evaluate(() => go("reports"));
      if (w < 821) await page.click("[data-hk=kind]");
      const rep = await page.$$eval(w < 821 ? ".modal .hb-kt" : ".hb-ri", (x) => x.filter((b) => b.offsetParent).map((b) => { const r = b.getBoundingClientRect(), i = b.querySelector(".hb-ic").getBoundingClientRect(), t = b.querySelector("b");
        return [Math.round(r.height), Math.round(i.width), parseFloat(getComputedStyle(t).fontSize), t.getBoundingClientRect().height < parseFloat(getComputedStyle(t).fontSize) * 1.8]; }));
      assert.equal(rep.length, 9);
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
    await page.evaluate(() => { D.settings.protect.enabled = false; });
    await page.click(".side [data-go=journal]"); await page.evaluate(() => { S.jpage = "bsb"; render(); }); await page.waitForSelector("table.bsa");
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
      await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
    await page.evaluate(() => { D.settings.protect.enabled = false; const c = D.classes[S.ci]; c.works.push({id: "wt1", type: "chsb", date: todayIso(), max: 10, title: "Test"}); save(); });
    await page.click(".side [data-go=journal]"); await page.evaluate(() => { S.jpage = "chsbt"; render(); }); await page.waitForSelector("table.tst");
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
    // fayl nomida tutuq belgisi (' ʻ ʼ ‘ ’) saqlanadi — «O'zbek tili» «O-zbek-tili» bo'lib qolmasin
    assert.equal(await page.evaluate(() => baFileBase({name: "9-A", subject: "O'zbek tili"}, {date: "2026-10-31", kind: "CHSB"})), "9-A_O'zbek-tili_2026-10-31_CHSB");
    assert.equal(await page.evaluate(() => baFileBase({name: "7-B", subject: "Gʻ ʼ ‘’"}, {date: "2026-10-31", kind: "BSB"})), "7-B_Gʻ-ʼ-‘’_2026-10-31_BSB");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
    await page.evaluate(() => { D.settings.protect.enabled = false; });
    await page.click(".side [data-go=journal]"); await page.evaluate(() => { S.jpage = "chsbt"; render(); }); await page.waitForSelector("[data-newt]");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
      await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
      await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
      // yoqish/o'chirish belgilari tanlovi yo'q: hamma joyda bitta kalit, ichida belgi yo'q
      assert.equal(await page.locator("[data-dz-emo]").count(), 0, "belgi tanlovi olib tashlandi");
      assert.equal(await page.locator(".dz-sec .dzprev").count(), 0, "Tugmalar bo'limida baho namunasi yo'q");
      // tugma shakli: tanlov kartalari o'z shaklida qoladi, asosiy tugmalar o'zgaradi
      await page.click('[data-dz-shape="line"]');
      assert.equal(await page.evaluate(() => D.web.dz.shape), "line");
      const shp = await page.$$eval(".dz-sec .tg-shp span", (x) => x.map((e) => getComputedStyle(e).backgroundColor));
      assert.notEqual(shp[0], shp[2], "namunalar bir xil emas");
      assert.equal(await page.evaluate(() => { const b = h('<button class="btn btn-primary">x</button>'); document.body.append(b); const c = getComputedStyle(b).backgroundColor; b.remove(); return c; }), "rgba(0, 0, 0, 0)", "chiziqli asosiy tugma");
      await page.click("[data-tg-try]"); assert.ok(await page.locator(".modal .tg-sr").count() > 0, "Sinab ko'rish oynasi"); await page.click(".modal [data-x]");
      await page.click('[data-dz-shape="solid"]');
      await page.evaluate(() => { S.sec = 6; go("settings"); });
      assert.equal((await page.textContent(".fn-row .kalit.on")).trim(), "", "kalit ichida belgi yo'q");
      const kw = await page.$eval(".fn-row .kalit", (e) => [e.offsetWidth, e.offsetHeight]); assert.deepEqual(kw, [44, 26]);
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
      await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
      // «Bugun»: «1-chorakni yopish» kartasi + «Sinflar bo'yicha tayyorlik» (bugun-tatil.js; oldingi alohida eslatma kartasi o'rnida)
      await page.waitForSelector(".bt-close");
      assert.match(await page.textContent(".bt-close"), /29\.10 da tugadi/);
      // tayyorlik: kompyuterda jadval, telefonda kartochkalar; raqam — «qo'yilgan / jami»
      const chk = vp.width > 820 ? ".bt-tbl" : ".bt-ready";
      assert.ok(await page.isVisible(chk)); assert.match(await page.textContent(chk), /\d+ \/ \d+/);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "yonga chiqmaydi");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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
    // «Bajarish kerak» kartasi och sariq fonda (bajarish.css), Eslatmalar o'zgarmagan
    const bg = await page.evaluate(() => getComputedStyle(document.querySelector(".card.bn-todoc")).backgroundColor);
    assert.notEqual(bg, "rgb(255, 255, 255)", "Bajarish kerak kartasi oq bo'lmasligi kerak");
    await page.click(`.bn-grp.anl button.btn[data-anl]`);
    // «Summativ tahlili» sahifasida shu ish ochiladi (summativ.js): nomi — chorakdagi tartib raqami
    assert.deepEqual(await page.evaluate(() => [S.page, S.jpage, S.smt, S.ci, baCur().date, baCur().title]), ["journal", "sm", "bsb", r.ci, r.d1, "BSB-1"]);
    assert.equal(await page.inputValue("#smw"), "wa1");
    await page.evaluate(() => go("today"));
    await page.click(`.bn-anw [data-anl="${r.ci}|wa3"]`);
    assert.deepEqual(await page.evaluate(() => [S.jpage, S.smt, S.smw, S.tw]), ["sm", "chsb", "wa3", "wa3"]);
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
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
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

test("Bo'sh varaq v6: 5 xil tur, 9 xil jadval dizayni, aniq chop etish (36 va 18 o'quvchi), kelgusi kunlar, BSB ballari, teng bo'lish, PDF va Excel", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    for (const [name, viewport] of [["kompyuter", {width: 1440, height: 900}], ["telefon", {width: 390, height: 844}]]) {
      const page = await browser.newPage({viewport, acceptDownloads: true});
      const errors = []; page.on("pageerror", (e) => errors.push(e.message));
      await page.clock.setFixedTime(new Date(2026, 9, 20, 10, 0));
      await page.goto(APP);
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
      await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
      // 36 va 18 o'quvchili sinflar (Akmal: test 36 va 18 o'quvchi bilan)
      await page.evaluate(() => { const grow = (c, n) => { for (let i = c.students.length; i < n; i++) c.students.push({name: `Qo'shimcha O'quvchi ${i + 1}`, marks: {}, scores: {}}); c.students.length = n; };
        grow(D.classes[0], 36); grow(D.classes[1], 18); save(); });
      await page.click(`${name === "telefon" ? ".tabbar" : ".side"} [data-go=reports]`);
      if (name === "telefon") { await page.click("[data-hk=kind]"); await page.click(".modal [data-kind=blank]"); } else await page.click("[data-kind=blank]");
      await page.waitForSelector(".bv-scale .bv-pg");
      const tap = (sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
      // tanlov bosilganda panel qayta yaratilmaydi, sahifa joyida qoladi
      await page.evaluate(() => { document.querySelector(".bv").__mark = 1; window.scrollTo(0, 120); });
      const y0 = await page.evaluate(() => scrollY);
      for (const t of ["only", "mz", "bsb", "own", "att"]) {
        await tap(`.bv-tab[data-v=${t}]`);
        assert.equal(await page.evaluate(() => document.querySelector(".bv").__mark), 1, `${t}: panel qayta chizildi`);
        assert.ok(await page.locator(".bv-scale .bv-pg table.bv-t").count(), `${t}: varaq yo'q`);
      }
      await tap("[data-bv=set]");
      assert.equal(await page.locator(".bv-pop .bv-dz").count(), 9, "9 xil jadval dizayni");
      for (const d of ["oq", "rang", "daf", "qal", "min", "kok", "kat", "ilik", "kl"]) { await tap(`.bv-dz[data-v=${d}]`); assert.equal(await page.locator(`.bv-scale .bv-pg.d-${d}`).count() > 0, true, d); }
      await tap(".bv-x");
      assert.equal(await page.evaluate(() => scrollY), y0);
      // sozlamalar oynasi
      await tap("[data-bv=set]"); assert.ok(await page.locator(".bv-pop").isVisible()); await tap(".bv-x");
      assert.equal(await page.locator(".bv-pop").count(), 0);
      if (name === "telefon") { assert.deepEqual(errors, []); continue; }
      // teng bo'lish: 36 o'quvchi + 2 bo'sh qator, mezon, oy, yotiq → kunlar 2 ga, qatorlar 19 + 19
      await tap(".bv-tab[data-v=mz]"); await tap("[data-bv=per][data-v=month]");
      await tap("[data-bv=set]"); await tap("[data-bv=ori][data-v=land]"); await tap("[data-bv=set]");
      const rows = await page.$$eval(".bv-print .bv-pg", (a) => a.map((p) => p.querySelectorAll("tbody tr").length));
      assert.ok(rows.length >= 2, `varaqlar: ${rows}`);
      assert.ok(Math.max(...rows) - Math.min(...rows) <= 1, `qatorlar teng emas: ${rows}`);
      const days = await page.$$eval(".bv-print .bv-pg", (a) => [...new Set(a.map((p) => p.querySelectorAll("thead tr:first-child th[colspan]").length))]);
      assert.ok(Math.max(...days) - Math.min(...days) <= 1, `kunlar teng emas: ${days}`);
      assert.match(await page.textContent(".bv-sub"), /varaq/, "varaqlar soni qatori");
      // 18 o'quvchi: bitta varaq, hafta bo'yicha
      await tap("[data-bv=set]"); await tap("[data-bv=ori][data-v=auto]"); await tap("[data-bv=set]");
      await page.click(".hb-pks [data-hk=cls]"); await page.click(".hb-pop [data-ho=ci][data-v='1']");
      await tap(".bv-tab[data-v=att]"); await tap("[data-bv=per][data-v=week]");
      assert.equal(await page.locator(".bv-print .bv-pg").count(), 1);
      assert.equal(await page.locator(".bv-print .bv-pg tbody tr").count(), 18 + 2);
      // kelgusi hafta jurnalda yo'q bo'lsa ham dars jadvalidan chiqadi
      for (let i = 0; i < 3; i++) await tap("[data-bv=shift][data-v='1']");
      assert.ok(await page.locator(".bv-scale th.bv-fut").count() > 0, "kelgusi kunlar jadvaldan chiqishi kerak");
      // BSB: tartib raqami, ballar katakka yoziladi, Jami
      await tap(".bv-tab[data-v=bsb]"); await tap("[data-bv=tasks][data-v='1']"); await tap("[data-bv=wno][data-v='1']"); await tap("[data-bv=wt][data-v=CHSB]");
      await page.click("#bv-tm-0"); await page.keyboard.type("8"); await page.keyboard.press("Enter"); await page.keyboard.type("12"); await page.waitForTimeout(500);
      assert.deepEqual(await page.$$eval(".bv-scale thead tr:last-child th small", (a) => a.slice(0, 2).map((x) => x.textContent)), ["8 ball", "12 ball"]);
      assert.match(await page.textContent(".bv-scale .bv-ttl b"), /2-CHSB/);
      assert.deepEqual(await page.$$eval(".bv-scale thead tr:first-child th", (a) => a.map((x) => x.textContent.trim()).slice(-3)), ["6", "Jami", "Baho"]);
      await tap("[data-bv=tsplit]");
      assert.match(await page.textContent(".bv-tot"), /Jami: 40 ball/);
      // O'z ustunlarim
      await tap(".bv-tab[data-v=own]"); await page.fill("#bv-own", "Kitob, Daftar"); await page.waitForTimeout(500);
      assert.deepEqual(await page.$$eval(".bv-scale thead th", (a) => a.map((x) => x.textContent.trim())), ["№", "O'quvchi", "Kitob", "Daftar"]);
      // izoh ustuni va bo'sh qatorlar
      await tap("[data-bv=set]"); await tap("[data-bv=tog][data-k=note]"); await tap("[data-bv=extra][data-v='1']"); await tap("[data-bv=set]");
      assert.equal(await page.locator(".bv-print .bv-pg tbody tr").count(), 18 + 3);
      assert.ok(await page.locator(".bv-scale thead th", {hasText: "Izoh"}).count());
      // barcha sinflar: har sinf alohida varaqda, chop etilganda ham
      await tap(".bv-tab[data-v=att]"); await tap("[data-bv=per][data-v=week]");
      await page.click(".hb-pks [data-hk=cls]"); await page.click(".hb-pop [data-ho=ci][data-v=all]");
      const sheets = await page.locator(".bv-print .bv-pg").count();
      assert.ok(sheets >= 2, `barcha sinflar: ${sheets} varaq`);
      await page.emulateMedia({media: "print"});
      const pdf = await page.pdf({preferCSSPageSize: true}); await page.emulateMedia({media: "screen"});
      assert.equal((pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length, sheets);
      // Excel
      const [dl] = await Promise.all([page.waitForEvent("download"), page.click(".hb-acts [data-bvx]")]);
      assert.match(dl.suggestedFilename(), /bo.sh varaq\.(xlsx|csv)$/);
      // PDF fayl (A4, vektor) saqlanadi
      const [dp] = await Promise.all([page.waitForEvent("download", {timeout: 30000}), page.click(".hb-acts [data-bvpdf]")]);
      assert.match(dp.suggestedFilename(), /bo.sh varaq\.pdf$/);
      // chop etish aniqligi: 36 va 18 o'quvchi, sarlavhada o'qituvchi va maktab; hamma tur, davr, chet va qator balandligida pastki qism va ismlar varaq ichida
      await page.evaluate(() => { D.web.bsb_hdr = Object.assign(D.web.bsb_hdr || {}, {teacher: "Otaboboyev Akmal Abdurahmonovich", school: "Toshkent shahar Yunusobod tumani 274-sonli umumta'lim maktabi"}); D.classes[0].students[1].name = "Abdurahmonova Mohinur Shuhratjon qizi"; save(); });
      const fitAll = () => page.evaluate(() => { const A = document.querySelector(".bv-print"); A.style.cssText = "display:block;position:absolute;left:-9000px";
        const r = [...A.querySelectorAll(".bv-pg")].map((p) => { const i = p.querySelector(".bv-in"), t = p.querySelector("table"), f = p.querySelector(".bv-foot");
          return {over: i.scrollHeight - i.clientHeight, nm: [...t.querySelectorAll("td.bv-nm, thead th")].filter((x) => x.scrollWidth > x.clientWidth + 1).map((x) => `${x.textContent.trim().slice(0, 24)}:${x.scrollWidth}/${x.clientWidth}`).join("|"), below: f.getBoundingClientRect().top < t.getBoundingClientRect().bottom, w: Math.round(p.getBoundingClientRect().width / 3.7795), h: Math.round(p.getBoundingClientRect().height / 3.7795 * 10) / 10}; });
        A.style.cssText = ""; return r; });
      for (const ci of [0, 1]) {
        await page.click(".hb-pks [data-hk=cls]"); await page.click(`.hb-pop [data-ho=ci][data-v='${ci}']`);
        for (const t of ["att", "only", "mz", "bsb", "own"]) for (const per of ["week", "month"]) for (const [fs, rh, mg] of [["l", "auto", "15"], ["s", "10", "5"], ["m", "auto", "10"]]) {
          await tap(`.bv-tab[data-v=${t}]`); if (!["bsb", "own"].includes(t)) await tap(`[data-bv=per][data-v=${per}]`);
          await page.evaluate(([fs, rh, mg]) => { Object.assign(BVQ.state, {fs, rh, mg: +mg, ori: "auto", note: true, hdr: true, extra: 10}); softRender(); }, [fs, rh, mg]);
          for (const x of await fitAll()) { assert.ok(x.over <= 1 && !x.nm && !x.below, `${ci} ${t} ${per} ${fs}/${rh}/${mg}: ${JSON.stringify(x)}`); assert.ok((x.w === 210 && Math.abs(x.h - 296.5) < 0.5) || (x.w === 297 && Math.abs(x.h - 209.5) < 0.5), `varaq o'lchami: ${x.w}x${x.h}`); }
        }
      }
      assert.equal(await page.locator(".bv-chip.bad").count(), 0, "«sig'madi» belgisi chiqmasligi kerak");
      assert.deepEqual(errors, []);
    }
  } finally { await browser.close(); }
});

// TPT guruhlari: yillik mavzular (docs/tpt-mavzu.js) — 36 va 18 o'quvchili guruhlarda, kompyuter va telefonda
for (const [name, viewport] of [["kompyuter", {width: 1300, height: 860}], ["telefon", {width: 390, height: 844}]]) {
  test(`${name}: TPT guruhlari — yillik mavzular`, async () => {
    const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
    try {
      const page = await browser.newPage({viewport});
      const errors = []; page.on("pageerror", (e) => errors.push(e.message));
      await page.clock.setFixedTime(new Date(2026, 10, 4, 10, 0));   // chorshanba
      await page.goto(APP);
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
      await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
      // 36 o'quvchili pullik guruh (Du·Ch·Ju) va 18 o'quvchili to'garak (Se·Pa); 2 noyabr — 30 kishi keldi
      await page.evaluate(() => {
        const mk = (n, p) => Array.from({length: n}, (_, i) => ({id: p + i, name: `${p} O'quvchi ${i + 1}`, marks: i < 30 ? {"2026-11-02": "ot"} : {}, joined: "2026-09-01"}));
        D.classes.push(...normalize({classes: [
          {name: "Katta guruh", subject: "", kind: "paid", gdays: [1, 3, 5], dates: ["2026-11-02"], packs: [{id: "pk1", name: "12 dars", n: 12, sum: 600000}], students: mk(36, "K")},
          {name: "Kichik guruh", subject: "", kind: "club", gdays: [2, 4], dates: [], students: mk(18, "C")}]}).classes);
        save();
      });
      await page.click(`${name === "telefon" ? ".tabbar" : ".side"} [data-go=groups]`);
      await page.waitForSelector(".tpt .g-gcard");
      await page.click(".g-gcard:has-text('Katta guruh')");
      await page.click("[data-tab=top]");
      await page.waitForSelector("text=Yillik mavzular rejasi kiritilmagan");
      // reja: 2-mavzu 2 dars; 2-noyabrdan (dushanba) boshlanadi
      await page.click("[data-tpl]");
      await page.fill("#g-tt", "1. Tanishuv\nPresent Simple | 2\nTakrorlash");
      assert.match(await page.textContent("#g-tc"), /3 mavzu · 4 dars/);
      await page.click("[data-tpo]");   // kalendar reja boshlanishi (1-sentabr) oyida ochiladi
      await page.click(".g-dlg [data-m='2026-10']"); await page.click(".g-dlg [data-m='2026-11']");
      await page.click(".g-dlg [data-day='2026-11-02']");
      await page.click(".g-dlg [data-save]");
      const lay = () => page.evaluate(() => { const c = D.classes.find((x) => x.name === "Katta guruh"); return TPTM.layout(c).rows.map((r) => r.d + ":" + (r.n || r.own)).join(","); });
      assert.equal(await lay(), "2026-11-02:1,2026-11-04:2,2026-11-06:3,2026-11-09:4");
      assert.equal(await page.textContent(".g-tnext b"), "2. Present Simple (1/2)");
      // 4-noyabr «Dars bo'lmadi» — mavzular bir darsga suriladi
      await page.click("[data-tpf=all]");
      await page.click("[data-tpe='2026-11-04']");
      await page.click("[data-tk=off]"); await page.click(".g-dlg [data-save]");
      assert.equal(await lay(), "2026-11-02:1,2026-11-06:2,2026-11-09:3,2026-11-11:4");
      // Yo'qlama → Kun: shu kun mavzusi ko'rinadi; sahifa telefonda yon tomonga siljimaydi
      await page.click("[data-tab=att]");
      await page.click("[data-pick='2026-11-02']");
      assert.match(await page.textContent(".g-tpc"), /1-dars \/ 4.*Tanishuv/);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      // saqlanib, qayta yuklangandan keyin ham bor
      // yangilangandan keyin ham o'sha guruh ochiq qoladi
      await page.reload(); await page.waitForSelector(".tpt [data-home]");
      assert.deepEqual(await page.evaluate(() => [S.page, D.classes[TPT._state.gi].name]), ["groups", "Katta guruh"]);
      assert.equal(await page.evaluate(() => { const c = D.classes.find((x) => x.name === "Katta guruh"); return [c.gplan.topics.length, c.gplan.start, JSON.stringify(c.gtop)].join("|"); }), '3|2026-11-02|{"2026-11-04":{"off":true}}');
      // 18 o'quvchili to'garak: «Boshqa mavzu» kuni rejadan mavzu olmaydi
      await page.click(`${name === "telefon" ? ".tabbar" : ".side"} [data-go=groups]`);
      await page.click("[data-home]");
      await page.click(".g-gcard:has-text('Kichik guruh')");
      await page.click("[data-tab=top]");
      await page.click("[data-tpl]");
      await page.fill("#g-tt", "Robot nima\nMotorlar\nDatchiklar");
      await page.click("[data-tpo]");   // kalendar reja boshlanishi (1-sentabr) oyida ochiladi
      await page.click(".g-dlg [data-m='2026-10']"); await page.click(".g-dlg [data-m='2026-11']");
      await page.click(".g-dlg [data-day='2026-11-03']");
      await page.click(".g-dlg [data-save]");
      await page.click("[data-tpf=all]");
      await page.click("[data-tpe='2026-11-03']");
      await page.click("[data-tk=own]"); await page.fill("#g-to", "Xavfsizlik qoidalari"); await page.click(".g-dlg [data-save]");
      assert.equal(await page.evaluate(() => { const c = D.classes.find((x) => x.name === "Kichik guruh"); return TPTM.layout(c).rows.map((r) => r.d + ":" + (r.n || r.own)).join(","); }), "2026-11-03:Xavfsizlik qoidalari,2026-11-05:1,2026-11-10:2,2026-11-12:3");
      assert.equal(await page.locator(".g-trow").count(), 4);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });

  test(`${name}: TPT guruhlari — chorak mavzular hisoboti`, async () => {
    const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
    try {
      const page = await browser.newPage({viewport});
      const errors = []; page.on("pageerror", (e) => errors.push(e.message));
      await page.clock.setFixedTime(new Date(2026, 10, 4, 10, 0));   // 4-noyabr: 1-chorak tugagan
      await page.goto(APP);
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
      await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
      // 36 o'quvchili pullik guruh (Du·Ch·Ju) va 18 o'quvchili to'garak (Se·Pa); 1-chorak 2-sentabr — 31-oktabr
      await page.evaluate(() => {
        D.settings.quarters = [["2026-09-02", "2026-10-31"], ["2026-11-09", "2026-12-27"], ["2027-01-11", "2027-03-20"], ["2027-03-30", "2027-05-25"]];
        const days = (wd) => { const o = []; for (let d = new Date(2026, 8, 2); d <= new Date(2026, 9, 31); d.setDate(d.getDate() + 1)) if (wd.includes(d.getDay())) o.push(iso(d)); return o; };
        const mk = (n, p, ds) => Array.from({length: n}, (_, i) => ({id: p + i, name: `${p} O'quvchi ${i + 1}`, marks: Object.fromEntries(ds.filter((d, k) => (i + k) % 7).map((d) => [d, "ot"])), joined: "2026-09-01"}));
        const dk = days([1, 3, 5]), dc = days([2, 4]);
        const plan = (n) => ({start: "2026-09-01", topics: Array.from({length: n}, (_, i) => ({t: `${i + 1}-mavzu`, h: 1}))});
        D.classes.push(...normalize({classes: [
          {name: "Katta guruh", subject: "", kind: "paid", gdays: [1, 3, 5], dates: dk, packs: [{id: "pk1", name: "12 dars", n: 12, sum: 600000}], students: mk(36, "K", dk), gplan: plan(60),
            grep: {"1": {at: "2026-11-01"}, "9": {at: "x"}}, grh: {org: "2-sonli IDUM", tch: "Otaboboyev Akmal", sub: "Matematika", bad: 1, nat: {"1": "Natija bir", "7": "x"}}},
          {name: "Kichik guruh", subject: "", kind: "club", gdays: [2, 4], dates: dc, students: mk(18, "C", dc), gplan: plan(40)}]}).classes);
        save();
      });
      // ma'lumot tozalanadi: noto'g'ri chorak va maydonlar tashlanadi
      assert.equal(await page.evaluate(() => { const c = D.classes.find((x) => x.name === "Katta guruh"); return JSON.stringify([c.grep, c.grh]); }),
        '[{"1":{"at":"2026-11-01"}},{"org":"2-sonli IDUM","tch":"Otaboboyev Akmal","sub":"Matematika","nat":{"1":"Natija bir"}}]');
      await page.click(`${name === "telefon" ? ".tabbar" : ".side"} [data-go=groups]`);
      await page.waitForSelector(".tpt .g-gcard");
      // 18 o'quvchili to'garak: 1-chorak hisoboti tayyor (banner), ochilganda «ko'rildi» bo'ladi
      await page.click(".g-gcard:has-text('Kichik guruh')");
      await page.click("[data-tab=top]");
      await page.click("[data-tprep='1']");
      await page.waitForSelector(".g-rep");
      assert.ok(await page.evaluate(() => !!D.classes.find((x) => x.name === "Kichik guruh").grep[1]));
      // A4 varaq: 5 xil dizayn, hammasida varaq chiqadi; «Bezaksiz» — jadvalsiz, namunadagi matnli hisobot
      await page.click("[data-tprv=a4]");
      for (const st of ["nv", "nv n2", "nv bw", "nv sm", "pl"]) {
        await page.click(`[data-tpst='${st}']`);
        assert.ok(await page.locator(".g-a4s .bx-pg").count() >= 1, st);
      }
      assert.equal(await page.locator(".g-a4s table:not([hidden])").count(), 0);
      assert.match(await page.textContent(".g-a4s .g-dtt"), /1-CHORAGI BO'YICHA HISOBOT/);
      assert.match(await page.textContent(".g-a4s .g-dtx"), /to'garagida/);
      // «To'garak hujjatlari»: muqova + ish reja (40 mavzu) + hisobot
      await page.click("[data-tprk=doc]");
      await page.waitForSelector(".g-dcov");
      assert.equal(await page.locator(".g-a4s .g-dtab tbody tr").count(), 40);
      assert.match(await page.textContent(".g-a4s .g-dtas"), /TASDIQLAYMAN/);
      await page.fill("#g-dsub", "Informatika"); await page.press("#g-dsub", "Tab");
      await page.waitForFunction(() => document.querySelector(".g-dtt") && /Informatika fanidan/.test(document.body.textContent));
      assert.equal(await page.evaluate(() => D.classes.find((x) => x.name === "Kichik guruh").grh.sub), "Informatika");
      // 36 o'quvchili guruh: o'quvchi hisoboti va yillik hisobot, «Yashil» dizaynda
      await page.click("[data-home]");
      await page.click(".g-gcard:has-text('Katta guruh')");
      await page.click("[data-tab=top]");
      await page.click("[data-tpv=rep]");
      await page.click("[data-tprk=st]");
      await page.click("[data-tpst='nv']").catch(() => {});
      assert.equal(await page.locator("#g-rsel option").count(), 36);
      await page.click("[data-tprk=yr]");
      await page.waitForSelector(".g-a4yr, .g-a4flow");
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      // umumiy hisobot: ikkala guruh
      await page.click("[data-home]");
      await page.click("[data-allrep]");
      await page.click("[data-tprv=scr]");
      assert.equal(await page.locator("[data-allg]").count(), 2);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}

// Umumiy bot (tg-umumiy.js + bot-server/worker.js): ilova haqiqiy server kodi orqali ishlaydi — server Node'da (D1 = node:sqlite),
// Telegram soxta. Bitta tugma bilan ulanish, zaxira, ota-onalar guruhi va kunlik hisobot (36 va 18 o'quvchili sinflar).
test("Umumiy Telegram bot: bitta tugma bilan ulanish, zaxira va kunlik hisobot server orqali (36 va 18 o'quvchi)", async () => {
  const db = new DatabaseSync(":memory:");
  const stmt = (sql, a = []) => ({bind: (...b) => stmt(sql, b), first: async () => db.prepare(sql).get(...a) ?? null,
    all: async () => ({results: db.prepare(sql).all(...a)}), run: async () => { db.prepare(sql).run(...a); return {}; }});
  const env = {BOT_TOKEN: "TOK", ADMIN_IDS: "100", SETUP_SECRET: "sir", DB: {prepare: (sql) => stmt(sql)}};
  const TEACHER = 4242, tgLog = [], realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opt = {}) => {   // serverdan Telegram'ga ketgan so'rovlar
    const m = String(url).match(/\/botTOK\/(\w+)$/); assert.ok(m, "server faqat Telegram'ga murojaat qiladi: " + url);
    let p = {};
    if (opt.body instanceof FormData) for (const [k, v] of opt.body) p[k] = typeof v === "string" ? v : {size: v.size, type: v.type};
    else if (opt.body) p = JSON.parse(opt.body);
    tgLog.push({m: m[1], p});
    const result = m[1] === "getMe" ? {id: 1, username: "MaktabJurnalBot"} : m[1] === "getChat" ? {id: TEACHER}
      : m[1] === "sendPhoto" ? {message_id: tgLog.length, photo: [{file_id: "s"}, {file_id: "PH" + tgLog.length}]} : {message_id: tgLog.length};
    return new Response(JSON.stringify({ok: true, result}));
  };
  const call = (path, init) => botServer.fetch(new Request("https://bot.test" + path, init), env);
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    assert.equal((await call("/setup?s=sir")).status, 200);
    const secret = tgLog.find((x) => x.m === "setWebhook").p.secret_token;
    const hook = (u) => call("/tg", {method: "POST", headers: {"X-Telegram-Bot-Api-Secret-Token": secret}, body: JSON.stringify(u)});
    const ctx = await browser.newContext({viewport: {width: 390, height: 844}});
    await ctx.addInitScript(() => localStorage.setItem("yoqlama_tgu_url", "https://bot.test"));
    const direct = [], goTo = [];
    await ctx.route("https://api.telegram.org/**", (rt) => { direct.push(rt.request().url()); return rt.abort(); });
    await ctx.route("https://t.me/**", (rt) => rt.fulfill({status: 200, contentType: "text/html", body: "<p>Telegram</p>"}));
    await ctx.route("https://bot.test/**", async (rt) => {
      const rq = rt.request(), init = {method: rq.method(), headers: rq.headers()}, b = rq.postDataBuffer();
      if (b && rq.method() !== "GET") init.body = b;
      const res = await botServer.fetch(new Request(rq.url(), init), env);
      if (res.status === 302) goTo.push(res.headers.get("location"));   // Playwright yo'naltirishni oynada kuzatmaydi — manzilni tekshiramiz
      return rt.fulfill({status: res.status, headers: Object.fromEntries(res.headers), body: Buffer.from(await res.arrayBuffer())});
    });
    const page = await ctx.newPage();
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
    // ikki sinf: 36 va 18 o'quvchi, bugun ikkalasida dars o'tgan
    await page.evaluate(() => {
      const t = todayIso(); D.settings.method_weekday = null;
      for (const x of D.classes) x.dates = x.dates.filter((d) => d !== t);
      const CL = D.classes.filter((c) => !isGrp(c)).slice(0, 2);
      CL.forEach((c, ci) => {
        const n = ci ? 18 : 36; c.extra_x = [];
        while (c.students.length < n) c.students.push(Object.assign(JSON.parse(JSON.stringify(c.students[0])), {name: "Qo'shimcha O'quvchi " + c.students.length}));
        c.students.length = n;
        c.dates.push(t); c.dates.sort(); c.lessons[t] = {topic: "Mavzu " + ci, hw: ""};
        c.students.forEach((s, i) => { s.marks[t] = i === 1 ? "s" : String(5 + (i % 5)); });
      });
      const wd = (new Date().getDay() + 6) % 7, days = Array.from({length: 6}, () => ["", ""]);
      if (wd < 6) days[wd] = CL.map(ckey);
      D.web.schedule = {bells: [["00:00", "00:01"], ["00:01", "00:02"]], days}; save();
    });
    await page.click(".tabbar [data-go=settings]"); await page.click('[data-sec="5"]');
    assert.ok(await page.$("[data-a=snaps]") && await page.$("[data-a=exp]"), "ulanmagan holatda ham boshqa zaxira qatorlari bor");
    // bitta tugma: Telegram oynasi ochiladi (server havolani yozib, t.me ga yo'naltiradi)
    await Promise.all([page.waitForEvent("popup"), page.click('[data-a="tguon"]')]);
    await page.waitForFunction(() => !!tgCfg().pend);
    for (let i = 0; i < 50 && !goTo.length; i++) await page.waitForTimeout(100);
    assert.match(goTo[0] || "", /^https:\/\/t\.me\/MaktabJurnalBot\?start=[\w-]{16,}$/);
    const t = new URL(goTo[0]).searchParams.get("start");
    assert.equal(t, await page.evaluate(() => tgCfg().pend.t));
    await page.waitForSelector("text=Boshlash");
    // server ochilmasa (provayder to'sgan) — «ulanmoqda» da qotmaydi, ogohlantirish chiqadi; ochilganda davom etadi
    await ctx.route("https://bot.test/link/**", (rt) => rt.abort("connectionrefused"));
    await page.waitForSelector("text=Serverga ulanib bo'lmadi", {timeout: 15000});
    await ctx.unroute("https://bot.test/link/**");
    // o'qituvchi Telegram'da «Boshlash» bosadi
    await hook({message: {from: {id: TEACHER, first_name: "Dilnoza", last_name: "Karimova"}, chat: {id: TEACHER, type: "private"}, text: "/start " + t}});
    await page.bringToFront();
    await page.waitForFunction(() => !!tgCfg().key && tgOn(), null, {timeout: 15000});
    await page.waitForFunction(() => !!tgCfg().last, null, {timeout: 15000});
    const cfg = await page.evaluate(() => tgCfg());
    assert.equal(cfg.chat, TEACHER); assert.equal(cfg.bot, "MaktabJurnalBot"); assert.equal(cfg.token, undefined, "ilovada token yo'q");
    const doc = tgLog.find((x) => x.m === "sendDocument");
    assert.equal(doc.p.chat_id, String(TEACHER)); assert.equal(doc.p._k, undefined); assert.ok(doc.p.document.size > 1000, "zaxira fayli serverdan o'tdi");
    assert.ok(tgLog.some((x) => x.m === "pinChatMessage"));
    assert.ok(tgLog.some((x) => x.m === "sendMessage" && x.p.chat_id === 100 && /Yangi o'qituvchi ulandi/.test(x.p.text)), "admin'ga xabar");
    await page.waitForSelector("text=umumiy bot");
    // zaxira chatga «📦1/11 H4sI…» bo'laklari bo'lib bormaydi — server faylni o'zi o'qib beradi
    assert.ok(!tgLog.some((x) => x.m === "sendMessage" && /📦/.test(x.p.text || "")), "matn bo'laklari yuborilmadi");
    // ota-onalar guruhi: o'qituvchi botni guruhga qo'shadi — server biladi, ilova «Guruhlarni topish» bilan oladi
    await hook({my_chat_member: {chat: {id: -100777, type: "supergroup", title: "36 talik sinf ota-onalari"}, from: {id: TEACHER}, new_chat_member: {status: "member", user: {id: 1}}}});
    await page.click('[data-kra="grp"]');
    assert.ok(await page.$('.modal a[href="https://t.me/MaktabJurnalBot?startgroup=jurnal"]'));
    await page.click(".modal [data-f]");
    await page.waitForSelector(".modal option:has-text('36 talik sinf ota-onalari')", {state: "attached"});
    await page.selectOption('.modal [data-krg="0"]', "-100777"); await page.click(".modal [data-x]");
    const n0 = tgLog.length;
    await page.click('[data-kra="on"]');
    await page.waitForFunction(() => KUN.cfg().day === todayIso() && KUN.cfg().sent.length === 2, null, {timeout: 20000});
    const ph = tgLog.slice(n0).filter((x) => x.m === "sendPhoto");
    assert.equal(ph.length, 3, JSON.stringify(ph.map((x) => x.p.chat_id)));   // ikki sinf o'qituvchiga + 36 talik guruhga
    assert.equal(ph.filter((x) => x.p.chat_id === String(TEACHER)).length, 2);
    assert.ok(ph.every((x) => x.p.chat_id !== String(TEACHER) || x.p.photo.type === "image/png"));
    const g = ph.find((x) => x.p.chat_id === "-100777"); assert.match(g.p.photo, /^PH\d+$/, "guruhga tayyor rasm qayta yuklanmaydi");
    assert.ok(ph.some((x) => /36/.test(x.p.caption)) && ph.some((x) => /18/.test(x.p.caption)), ph.map((x) => x.p.caption).join(" | "));
    // admin bloklasa — ilova tushunarli xato oladi
    await hook({callback_query: {id: "q", from: {id: 100}, data: "bl:" + TEACHER}});
    await page.click('[data-a="tgsend"]');
    await page.waitForFunction(() => /qayta ulang/.test(document.querySelector(".toast")?.textContent || ""));
    assert.deepEqual(direct, [], "ilova api.telegram.org ga to'g'ridan-to'g'ri murojaat qilmadi");
    assert.deepEqual(errors, []);
  } finally { globalThis.fetch = realFetch; await browser.close(); }
});

// Google Apps Script serveri (bot-server/gas/Code.gs): Cloudflare workers.dev O'zbekistonda VPN'siz ochilmadi.
// Ilovaning o'zidan eMaktab importi: ilova → Google serveri (Node'da) → soxta emaktab.uz. Kirish, rasmdagi kod, seans, 36 va 18 o'quvchi
test("eMaktab: ilovaning o'zidan import — login, rasmdagi kod, seans saqlanadi, parol saqlanmaydi (36 va 18 o'quvchi)", async () => {
  const XLSX = (await import("xlsx")).default;
  const xlsOf = (cls, subj, n) => { const rows = [[`Sinf: ${cls} 2026/2027`], [`Fan: ${subj}`], [], ["№", "F.I.Sh.", "Noyabr"], [null, null, 4]];
    for (let i = 1; i <= n; i++) rows.push([i, `O'quvchi ${cls} ${String(i).padStart(2, "0")}`, 5 + (i % 5)]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), subj); return XLSX.write(wb, {type: "buffer", bookType: "xls"}); };
  const XLS = {22: xlsOf("6-A", "Matematika", 36), 23: xlsOf("9-A", "Algebra", 18)};
  const PNG = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000" + "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082", "hex");
  const loginPage = `<html><body><form action="/login" method="post"><input name="login" type="text"><input name="password" type="text" class="password">
    <input type="hidden" name="Captcha.Id" value=""><input name="Captcha.Input" type="text"><img class="captcha__image" alt="captcha image"><button type="submit">Kirish</button></form>
    <script>var c = JSON.parse('\\x7b\\x22imagePart\\x22:\\x22https:\\/\\/login.emaktab.uz\\/captcha\\/true\\/\\x22\\x7d');</script></body></html>`;
  const st = {valid: new Set(), guid: "", posts: []};
  const ok = (opt) => st.valid.has(((opt.headers || {}).Cookie || "").match(/sess=(\w+)/)?.[1]);
  const G = makeGas({emk: (url, opt) => {
    const u = new URL(url);
    if (u.host === "login.emaktab.uz" && u.pathname === "/") return {status: 200, headers: {"Content-Type": "text/html; charset=utf-8", "Set-Cookie": "lg=1; path=/"}, body: loginPage};
    if (u.host === "login.emaktab.uz" && u.pathname.startsWith("/captcha/true/")) { st.guid = u.pathname.split("/").pop(); return {status: 200, headers: {"Content-Type": "image/png"}, body: PNG}; }
    if (u.host === "login.emaktab.uz" && u.pathname === "/login") {
      const f = Object.fromEntries(new URLSearchParams(opt.payload)); st.posts.push(f);
      if (f.login !== "akmal" || f.password !== "maxfiy123" || !f["Captcha.Input"]) return {status: 200, headers: {"Content-Type": "text/html"}, body: loginPage};
      if (f["Captcha.Input"] !== "4827" || f["Captcha.Id"] !== st.guid) return {status: 200, headers: {"Content-Type": "text/html"}, body: loginPage};
      const sid = "s" + st.valid.size; st.valid.add(sid);
      return {status: 302, headers: {Location: "https://schools.emaktab.uz/v2/myclasses", "Set-Cookie": [`sess=${sid}; domain=.emaktab.uz; path=/; HttpOnly`]}};
    }
    if (!ok(opt)) return {status: 302, headers: {Location: "https://login.emaktab.uz/"}};
    if (u.pathname === "/v2/myclasses") return {status: 200, headers: {"Content-Type": "text/html"}, body: `<html><body><script>window.__TEACHERV2__INITIAL__STATE__ = {"groups": {"groups": ${JSON.stringify([
      {name: "6-A", journal: [{subjectName: "Matematika", journalUrl: "https://emaktab.uz/journal/school/11/group/22/subject/33?periodId=77"}]},
      {name: "9-A", journal: [{subjectName: "Algebra", journalUrl: "https://emaktab.uz/journal/school/11/group/23/subject/34?periodId=78"}]}])}}};</script><form action="/logout"></form></body></html>`};
    if (u.pathname.startsWith("/journal/")) return {status: 200, headers: {"Content-Type": "text/html"}, body: `<script>window.__JOURNAL__INITIAL__STATE__ = {"journalHeader":{"currentPeriodId":${u.pathname.includes("/22/") ? 77 : 78}}};</script>`};
    if (u.pathname === "/v2/excel") return {status: 200, headers: {"Content-Type": "application/vnd.ms-excel"}, body: XLS[u.searchParams.get("group")]};
    return {status: 404, headers: {}, body: ""};
  }});
  const GAS = "https://script.google.com/macros/s/TEST/exec";
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    for (const vp of [{width: 390, height: 844}, {width: 1280, height: 800}]) {
      st.valid.clear(); st.posts.length = 0; G.log.length = 0;
      const ctx = await browser.newContext({viewport: vp});
      await ctx.addInitScript((u) => localStorage.setItem("yoqlama_tgu_url", u), GAS);
      const direct = [];
      await ctx.route(/emaktab\.uz/, (rt) => { direct.push(rt.request().url()); return rt.abort(); });   // ilova eMaktab'ga o'zi bormaydi
      await ctx.route("https://script.google.com/**", (rt) => { const rq = rt.request();
        return rt.fulfill({status: 200, contentType: "application/json", headers: {"access-control-allow-origin": "*"}, body: G.handle(rq.method(), rq.url(), rq.postData())}); });
      const page = await ctx.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(APP);
      await page.evaluate(() => { D = normalize({classes: [{name: "5-B", subject: "Tarix", dates: [], students: [{name: "Ali", marks: {}}]}]}); save(); go("today"); });
      assert.match(await page.textContent(".ek-sync"), /Hisob ulanmagan/);
      await page.click("[data-ekgo]");
      await page.fill("#eku", "akmal"); await page.fill("#ekp", "maxfiy123"); await page.click("#ekf [type=submit]");
      // birinchi urinish kodsiz, eMaktab sahifani qaytardi → rasmdagi kod so'raladi
      await page.waitForSelector("img.ek-cap");
      assert.match(await page.getAttribute("img.ek-cap", "src"), /^data:image\/png;base64,/);
      assert.equal(await page.getAttribute("#ekci", "inputmode"), null, "kodda harf ham bo'lishi mumkin — telefonda to'liq klaviatura");
      await page.fill("#ekci", "4827"); await page.click("#ekc [type=submit]");
      await page.click(".modal.ek-pick [data-ekok]", {timeout: 20000});   // jurnallarni tanlash oynasi — hammasi belgilangan
      await page.waitForSelector("text=eMaktab'dan yangilandi", {timeout: 20000});
      assert.deepEqual(await page.evaluate(() => D.classes.filter((c) => c.name !== "5-B").map((c) => [c.name, c.subject, c.students.length])), [["6-A", "Matematika", 36], ["9-A", "Algebra", 18]]);
      assert.equal(st.posts.length, 2); assert.ok(!st.posts[0]["Captcha.Input"]); assert.equal(st.posts[1]["Captcha.Id"], st.guid);
      // jurnal sahifalari va Excel fayllar bir yo'la (server parallel oladi)
      assert.equal(G.log.filter((x) => x.m === "fetchAll" && x.p.n === 2).length, 2, "2 ta jurnal sahifasi + 2 ta Excel — 2 ta so'rov");
      assert.deepEqual(direct, []);
      // parol hech qayerda saqlanmaydi; kirish kaliti faqat alohida kalitda (jurnal ma'lumoti va zaxirada yo'q)
      const store = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage))));
      assert.ok(!store.includes("maxfiy123"), "parol saqlanmagan");
      assert.ok(!JSON.stringify(await page.evaluate(() => D)).includes("sess="), "jurnalda cookie yo'q");
      assert.equal(await page.evaluate(() => EMKS.user()), "akmal");
      assert.ok(![...G.props.keys()].some((k) => /emk|sess/i.test(k)), "server hech narsa saqlamaydi");
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      // ikkinchi marta: parol so'ralmaydi
      await page.click(".modal.ek-res [data-x]"); await page.evaluate(() => go("today"));
      await page.click("[data-ekgo]");
      assert.match(await page.textContent(".modal.ek-dlg .ek-top .on"), /Login va parol/);   // oxirgi bo'lim
      assert.match(await page.textContent(".modal.ek-dlg .ek-acc"), /akmal/);
      await page.click(".modal.ek-dlg [data-eksync]");
      await page.waitForSelector(".modal.ek-res", {timeout: 20000});
      assert.equal(st.posts.length, 2, "qayta kirilmadi");
      assert.equal(await page.locator("#ekp").count(), 0);
      // seans eskirdi → parol qayta so'raladi (login oldindan yozilgan)
      await page.click(".modal.ek-res [data-x]"); await page.evaluate(() => go("today"));
      st.valid.clear();
      await page.click("[data-ekgo]"); await page.click(".modal.ek-dlg [data-eksync]");
      await page.waitForSelector("text=Kirish muddati tugagan");
      assert.equal(await page.inputValue("#eku"), "akmal");
      await page.click(".modal.ek-sh [data-x]");
      // Uzish: kirish kaliti o'chadi
      await page.evaluate(() => emkDialog("pw"));
      await page.click(".modal [data-ekun]");
      await page.waitForSelector(".modal.ek-dlg #ekf");   // uzilgach — yana login/parol formasi
      assert.equal(await page.evaluate(() => [EMKS.linked(), localStorage.getItem("yoqlama_emk_sess")]).then((x) => JSON.stringify(x)), "[false,null]");
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  } finally { await browser.close(); }
});

test("eMaktab: tasdiqlash kodi (2fa) so'ralsa — «Login va parol» bo'limida ogohlantirish, xatcho'pga o'zi o'tmaydi; bo'limlar alohida", async () => {
  const loginPage = `<html><body><form action="/login" method="post"><input name="login" type="text"><input name="password" type="text" class="password"><button type="submit">Kirish</button></form></body></html>`;
  const faPage = `<html><head><title>eMaktab | &#x41F;&#x43E;&#x434;&#x442;&#x432;&#x435;&#x440;&#x436;&#x434;&#x435;&#x43D;&#x438;&#x435; &#x432;&#x445;&#x43E;&#x434;&#x430;</title></head><body><div id="root"></div><script src="/app.js"></script></body></html>`;
  const posts = [];
  const G = makeGas({emk: (url, opt) => {
    const u = new URL(url);
    if (u.host === "login.emaktab.uz" && u.pathname === "/") return {status: 200, headers: {"Content-Type": "text/html"}, body: loginPage};
    if (u.host === "login.emaktab.uz" && u.pathname === "/login") { posts.push(opt.payload); return {status: 302, headers: {Location: "/login/2fa-verification", "Set-Cookie": ["pre=1; path=/"]}}; }
    if (u.pathname === "/login/2fa-verification") return {status: 200, headers: {"Content-Type": "text/html"}, body: faPage};
    return {status: 302, headers: {Location: "https://login.emaktab.uz/"}};
  }});
  const GAS = "https://script.google.com/macros/s/TEST/exec";
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    for (const vp of [{width: 390, height: 844}, {width: 1280, height: 800}]) {
      posts.length = 0;
      const ctx = await browser.newContext({viewport: vp});
      await ctx.addInitScript((u) => localStorage.setItem("yoqlama_tgu_url", u), GAS);
      await ctx.route("https://script.google.com/**", (rt) => { const rq = rt.request();
        return rt.fulfill({status: 200, contentType: "application/json", headers: {"access-control-allow-origin": "*"}, body: G.handle(rq.method(), rq.url(), rq.postData())}); });
      const page = await ctx.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(APP);
      await page.evaluate(() => { D = normalize({classes: [{name: "6-A", subject: "Matematika", dates: [], students: Array.from({length: 36}, (_, i) => ({name: `O'quvchi ${i + 1}`, marks: {}}))},
        {name: "9-A", subject: "Algebra", dates: [], students: Array.from({length: 18}, (_, i) => ({name: `O'quvchi ${i + 1}`, marks: {}}))}]}); save(); go("today"); });
      await page.click("[data-ekgo]");
      await page.fill("#eku", "akmal"); await page.fill("#ekp", "maxfiy123"); await page.click("#ekf [type=submit]");
      await page.waitForSelector(".modal.ek-dlg .ek-warn", {timeout: 20000});
      assert.match(await page.textContent(".modal.ek-dlg .ek-warn"), /tasdiqlash kodini so'radi/);
      assert.equal(await page.locator(".modal [data-et]").count(), 0, "xatcho'p bo'limiga o'zi o'tmaydi");
      assert.equal(await page.locator("text=eMaktab'dan olib bo'lmadi").count(), 0, "xato oynasi chiqmaydi");
      assert.equal(posts.length, 1);
      assert.deepEqual(await page.evaluate(() => [EMKS.linked(), localStorage.getItem("yoqlama_emk_2fa")]), [false, "1"]);
      assert.ok(!(await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage))))).includes("maxfiy123"));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      // «Boshqa usullar (xatcho'p, fayl)» — foydalanuvchi o'zi tanlaydi; keyingi safar oyna shu bo'limda ochiladi
      await page.click(".modal.ek-dlg [data-ektop=bm]");
      await page.waitForSelector(".modal.ek-dlg [data-et]");
      assert.match(await page.textContent(".modal.ek-dlg .ek-top .on"), /Boshqa usullar/);
      await page.click(".modal.ek-dlg [data-x]");
      await page.click("[data-ekgo]");
      await page.waitForSelector(".modal.ek-dlg [data-et]");
      assert.equal(await page.locator("#ekp").count(), 0); assert.equal(posts.length, 1);
      // «Login va parol» bo'limi: ogohlantirish turibdi; «Qayta urinish» — forma qaytadi
      await page.click(".modal.ek-dlg [data-ektop=pw]");
      await page.waitForSelector(".modal.ek-dlg .ek-warn");
      await page.click(".modal.ek-dlg [data-ekre]");
      await page.waitForSelector(".modal.ek-dlg #ekp");
      assert.equal(await page.evaluate(() => localStorage.getItem("yoqlama_emk_2fa")), null);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  } finally { await browser.close(); }
});

test("eMaktab: kirish sahifasi kutilmagan bo'lsa, xato oynasida nima qaytgani ko'rinadi (to'siq / formasiz sahifa)", async () => {
  const GAS = "https://script.google.com/macros/s/TEST/exec";
  const cases = [
    {page: {status: 403, headers: {"Content-Type": "text/html"}, body: "<html><head><title>Access denied | login.emaktab.uz</title></head><body>Cloudflare</body></html>"}, re: /to'sib qo'ydi[\s\S]*Javob: 403 · login\.emaktab\.uz\/ · «Access denied/},
    {page: {status: 500, headers: {"Content-Type": "text/html"}, body: "<html><head><title>Ошибка на сервере (500)</title></head><body>Ошибка</body></html>"}, re: /serverining o'zida xato \(500\)[\s\S]*Javob: 500 · login\.emaktab\.uz\/ · «Ошибка на сервере/, tries: 3},
    {page: {status: 200, headers: {"Content-Type": "text/html"}, body: "<html><head><title>eMaktab</title></head><body><div id=root></div><script src=app.js></script></body></html>"}, re: /login maydoni topilmadi\.[\s\S]*Javob: 200 · login\.emaktab\.uz\/ · «eMaktab»/},
  ];
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    for (const c of cases) {
      let n = 0;
      const G = makeGas({emk: (url) => new URL(url).host === "login.emaktab.uz" ? (n++, c.page) : {status: 302, headers: {Location: "https://login.emaktab.uz/"}}});
      const ctx = await browser.newContext({viewport: {width: 390, height: 844}});
      await ctx.addInitScript((u) => localStorage.setItem("yoqlama_tgu_url", u), GAS);
      await ctx.route("https://script.google.com/**", (rt) => { const rq = rt.request();
        return rt.fulfill({status: 200, contentType: "application/json", headers: {"access-control-allow-origin": "*"}, body: G.handle(rq.method(), rq.url(), rq.postData())}); });
      const page = await ctx.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(APP);
      await page.evaluate(() => { D = normalize({classes: [{name: "5-B", subject: "Tarix", dates: [], students: []}]}); save(); go("today"); });
      await page.click("[data-ekgo]");
      await page.fill("#eku", "akmal"); await page.fill("#ekp", "maxfiy123"); await page.click("#ekf [type=submit]");
      await page.waitForSelector("text=eMaktab'dan olib bo'lmadi", {timeout: 20000});
      const msg = await page.textContent(".modal.ek-sh .ek-sub");
      assert.match(msg, c.re); assert.ok(!msg.includes("maxfiy123"));
      if (c.tries) assert.equal(n, c.tries, "500 — ikki marta qayta so'raldi");
      // «Sahifani saqlash»: eMaktab sahifasi faylga (login/parol qiymatlarisiz)
      if (c.page.status !== 200) { assert.equal(await page.locator(".modal.ek-sh [data-pg]").count(), 0); await ctx.close(); continue; }
      const [dl] = await Promise.all([page.waitForEvent("download"), page.click(".modal.ek-sh [data-pg]")]);
      const html = (await import("node:fs")).readFileSync(await dl.path(), "utf8");
      assert.match(dl.suggestedFilename(), /^emaktab-sahifa-\d+\.html$/); assert.match(html, /login\.emaktab\.uz/); assert.ok(!html.includes("maxfiy123"));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  } finally { await browser.close(); }
});

test("Ilk ochilish: 2 ta karta va 2 ta havola; «Fayldan» eMaktab Excel'ini ham qabul qiladi (36 va 18 o'quvchi)", async () => {
  const XLSX = (await import("xlsx")).default;
  const xlsOf = (cls, subj, n) => { const rows = [[`Sinf: ${cls} 2026/2027`], [`Fan: ${subj}`], [], ["№", "F.I.Sh.", "Noyabr"], [null, null, 4]];
    for (let i = 1; i <= n; i++) rows.push([i, `O'quvchi ${String(i).padStart(2, "0")}`, 5 + (i % 5)]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), subj); return XLSX.write(wb, {type: "buffer", bookType: "xls"}); };
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    for (const vp of [{width: 390, height: 844}, {width: 1280, height: 800}]) {
      const page = await browser.newPage({viewport: vp}); const errors = []; page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(APP);
      assert.equal(await page.locator(".bs [data-w]").count(), 4);
      assert.deepEqual(await page.$$eval(".bs [data-w]", (b) => b.map((x) => x.dataset.w)), ["emk", "import", "hand", "demo"]);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      const [ch] = await Promise.all([page.waitForEvent("filechooser"), page.click(".bs [data-w=import]")]);
      assert.ok(ch.isMultiple());
      await ch.setFiles([{name: "6-A.xls", mimeType: "application/vnd.ms-excel", buffer: xlsOf("6-A", "Matematika", 36)}, {name: "9-A.xls", mimeType: "application/vnd.ms-excel", buffer: xlsOf("9-A", "Algebra", 18)}]);
      await page.waitForSelector("text=eMaktab'dan yangilandi", {timeout: 20000});
      assert.deepEqual(await page.evaluate(() => D.classes.map((c) => [c.name, c.students.length])), [["6-A", 36], ["9-A", 18]]);
      // oddiy zaxira tiklash: faqat .json
      await page.evaluate(() => importJson());
      assert.equal(await page.evaluate(() => [$("#file").accept, $("#file").multiple].join("|")), ".json,application/json|false");
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});

test("eMaktab: server kodi eski bo'lsa (404), xatcho'p yo'riqnomasi ochiladi", async () => {
  const GAS = "https://script.google.com/macros/s/TEST/exec";
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const ctx = await browser.newContext();
    await ctx.addInitScript((u) => localStorage.setItem("yoqlama_tgu_url", u), GAS);
    await ctx.route("https://script.google.com/**", (rt) => rt.fulfill({status: 200, contentType: "application/json", headers: {"access-control-allow-origin": "*"}, body: JSON.stringify({ok: false, error_code: 404, description: "topilmadi"})}));
    const page = await ctx.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    await page.evaluate(() => { D = normalize({classes: [{name: "5-B", subject: "Tarix", dates: [], students: []}]}); save(); go("today"); });
    await page.click("[data-ekgo]");
    await page.waitForSelector(".modal [data-et]");
    assert.equal(await page.locator("#ekp").count(), 0, "parol so'ralmaydi");   // emaktab yo'riqnomasi (Kompyuter/Telefon/Fayl)
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

// Ilova → Google serveri (Node'da, GAS xizmatlari soxta) → soxta Telegram. So'rovlar JSON, fayllar base64.
test("Umumiy bot (Google serveri): bitta tugma, zaxira fayli, guruh va kunlik hisobot (36 va 18 o'quvchi)", async () => {
  const G = makeGas({bot: "YoqlamaJurnalbot"}), TEACHER = 4242, GAS = "https://script.google.com/macros/s/TEST/exec";
  assert.equal(G.get({a: "setup", s: "sir"}).ok, true);
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const ctx = await browser.newContext({viewport: {width: 390, height: 844}});
    await ctx.addInitScript((u) => localStorage.setItem("yoqlama_tgu_url", u), GAS);
    const direct = [], tme = [], preflight = [];
    await ctx.route("https://api.telegram.org/**", (rt) => { direct.push(rt.request().url()); return rt.abort(); });
    await ctx.route("https://t.me/**", (rt) => { tme.push(rt.request().url()); return rt.fulfill({status: 200, contentType: "text/html", body: "<p>Telegram</p>"}); });
    await ctx.route("https://script.google.com/**", (rt) => {
      const rq = rt.request();
      if (rq.method() === "OPTIONS") { preflight.push(rq.url()); return rt.fulfill({status: 405}); }   // Apps Script OPTIONS ga javob bermaydi
      return rt.fulfill({status: 200, contentType: "application/json", headers: {"access-control-allow-origin": "*"}, body: G.handle(rq.method(), rq.url(), rq.postData())});
    });
    const page = await ctx.newPage();
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
    await page.evaluate(() => {
      const t = todayIso(); D.settings.method_weekday = null;
      for (const x of D.classes) x.dates = x.dates.filter((d) => d !== t);
      const CL = D.classes.filter((c) => !isGrp(c)).slice(0, 2);
      CL.forEach((c, ci) => {
        const n = ci ? 18 : 36; c.extra_x = [];
        while (c.students.length < n) c.students.push(Object.assign(JSON.parse(JSON.stringify(c.students[0])), {name: "Qo'shimcha O'quvchi " + c.students.length}));
        c.students.length = n; c.dates.push(t); c.dates.sort(); c.lessons[t] = {topic: "Mavzu " + ci, hw: ""};
        c.students.forEach((s, i) => { s.marks[t] = i === 1 ? "s" : String(5 + (i % 5)); });
      });
      const wd = (new Date().getDay() + 6) % 7, days = Array.from({length: 6}, () => ["", ""]);
      if (wd < 6) days[wd] = CL.map(ckey);
      D.web.schedule = {bells: [["00:00", "00:01"], ["00:01", "00:02"]], days}; save();
    });
    await page.click(".tabbar [data-go=settings]"); await page.click('[data-sec="5"]');
    // bitta tugma: to'g'ridan-to'g'ri t.me/<bot>?start=<t> ochiladi
    await Promise.all([page.waitForEvent("popup"), page.click('[data-a="tguon"]')]);
    const t = await page.evaluate(() => tgCfg().pend.t);
    for (let i = 0; i < 30 && !tme.length; i++) await page.waitForTimeout(100);
    assert.equal(tme[0], `https://t.me/YoqlamaJurnalbot?start=${t}`);
    await page.waitForSelector("text=Boshlash");
    G.push({message: {from: {id: TEACHER, first_name: "Dilnoza", last_name: "Karimova"}, chat: {id: TEACHER, type: "private"}, text: "/start " + t}});
    await page.bringToFront();
    await page.waitForFunction(() => !!tgCfg().last, null, {timeout: 20000});
    const cfg = await page.evaluate(() => tgCfg());
    assert.equal(cfg.chat, TEACHER); assert.equal(cfg.token, undefined);
    const doc = G.log.find((x) => x.m === "sendDocument");
    assert.equal(doc.p.chat_id, String(TEACHER)); assert.equal(doc.p.document.type, "application/json"); assert.ok(doc.p.document.size > 1000, "zaxira fayli base64 orqali butun yetdi");
    assert.ok(G.log.some((x) => x.m === "pinChatMessage"));
    assert.ok(G.log.some((x) => x.m === "sendMessage" && x.p.chat_id === 100 && /Chrome/.test(x.p.text)), "admin'ga qurilma nomi bilan");
    await page.waitForSelector("text=umumiy bot");
    // zaxira chatga «📦1/11 H4sI…» bo'laklari bo'lib bormaydi — server faylni o'zi o'qib beradi
    assert.ok(!G.log.some((x) => x.m === "sendMessage" && /📦/.test(x.p.text || "")), "matn bo'laklari yuborilmadi");
    assert.equal(await page.evaluate(() => tgCfg().fsrv), 1);
    const cnt = await page.evaluate(async () => { const n = D.classes.length; D.classes.pop(); await tgPull(await tgPinned()); return [n, D.classes.length]; });
    assert.equal(cnt[0], cnt[1], "zaxira serverdan o'qib tiklandi");
    // ota-onalar guruhi
    G.push({my_chat_member: {chat: {id: -100777, type: "supergroup", title: "36 talik sinf ota-onalari"}, from: {id: TEACHER}, new_chat_member: {status: "member", user: {id: 1}}}});
    await page.click('[data-kra="grp"]');
    assert.ok(await page.$('.modal a[href="https://t.me/YoqlamaJurnalbot?startgroup=jurnal"]'));
    await page.click(".modal [data-f]");
    await page.waitForSelector(".modal option:has-text('36 talik sinf ota-onalari')", {state: "attached"});
    await page.selectOption('.modal [data-krg="0"]', "-100777"); await page.click(".modal [data-x]");
    const n0 = G.log.length;
    await page.click('[data-kra="on"]');
    await page.waitForFunction(() => KUN.cfg().day === todayIso() && KUN.cfg().sent.length === 2, null, {timeout: 20000});
    const ph = G.log.slice(n0).filter((x) => x.m === "sendPhoto");
    assert.equal(ph.length, 3, JSON.stringify(ph.map((x) => x.p.chat_id)));
    assert.ok(ph.filter((x) => x.p.chat_id === String(TEACHER)).every((x) => x.p.photo.type === "image/png" && x.p.photo.size > 5000));
    assert.match(ph.find((x) => x.p.chat_id === "-100777").p.photo, /^PH\d+$/);
    assert.ok(ph.some((x) => /36/.test(x.p.caption)) && ph.some((x) => /18/.test(x.p.caption)));
    assert.deepEqual(preflight, [], "brauzer OPTIONS so'rovi yubormadi (Apps Script unga javob bermaydi)");
    assert.deepEqual(direct, []);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Alifbo: yangi alifbo ekran, Excel va Telegram'da, ma'lumot o'zgarmaydi (alifbo.js)", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    for (const viewport of [{width: 1440, height: 900}, {width: 390, height: 844}]) {
      const page = await browser.newPage({viewport});
      const errors = []; page.on("pageerror", (e) => errors.push(e.message)); page.on("dialog", (d) => d.accept());
      await page.clock.setFixedTime(new Date(2026, 9, 20, 10, 0));
      await page.goto(APP);
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
      await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
      // 36 va 18 o'quvchi bilan
      await page.evaluate(() => { const add = (c, n) => { const b = c.students; for (let i = 0; b.length < n; i++) b.push({...JSON.parse(JSON.stringify(b[i % 14])), name: `Shodmonov Cho'lpon ${i}`}); }; add(D.classes[0], 36); add(D.classes[1], 18); save(); render(); });
      await page.click(`${viewport.width < 800 ? ".tabbar" : ".side"} [data-go=settings]`); await page.click('[data-sec="3"]');
      await page.click('[data-alf-m="y"]');
      assert.deepEqual(await page.evaluate(() => D.web.alf), {m: "y", exp: true, tg: true});
      for (const ci of [0, 1]) {
        await page.evaluate((i) => { S.ci = i; go("journal"); }, ci);
        await page.waitForFunction(() => document.querySelector("#main").textContent.includes("Şodmonov Çölpon 1"));
        const t = await page.evaluate(() => document.querySelector("#main").textContent);
        assert.ok(!/Shodmonov|Cho'lpon/.test(t), "ekranda eski alifbo qoldi");
      }
      // saqlangan ma'lumot hozirgi alifboda qoladi
      assert.equal(await page.evaluate(() => D.classes[0].students[20].name.startsWith("Shodmonov Cho'lpon")), true);
      assert.equal(await page.evaluate(() => ALF.yangi("O'g'il Gʻani shaxmat CHSB Chrome ma'lumot")), "Öğil Ğani şaxmat ÇSB Chrome ma'lumot");
      // Excel ichi va Telegram izohi
      const [xl, tgb] = await page.evaluate(async () => {
        const X = await loadXlsx(), wb = X.utils.book_new(); X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([["F.I.Sh.", "O'zlashtirish"]]), "2-chorak");
        ALF.convBook(wb); const fd = new FormData(); fd.append("caption", "O'rtacha"); fd.append("document", new Blob(["{}"]), "zaxira.json");
        let got = null; const of = window.tgFetch; window.tgFetch = async (u, o) => { got = [...o.body.entries()].map(([k, v]) => typeof v === "string" ? v : v.name); return {json: async () => ({ok: true, result: {}})}; };
        try { await tgApi("sendDocument", fd, "T"); } finally { window.tgFetch = of; }
        return [[wb.SheetNames[0], wb.Sheets[wb.SheetNames[0]].A1.v, wb.Sheets[wb.SheetNames[0]].B1.v], got];
      });
      assert.deepEqual(xl, ["2-çorak", "F.I.Ş.", "Özlaştiriş"]);
      assert.deepEqual(tgb, ["Örtaça", "zaxira.json"]);
      // qaytarish
      await page.evaluate(() => { D.web.alf.m = "h"; save(); render(); });
      assert.ok((await page.evaluate(() => document.querySelector("#main").textContent)).includes("Shodmonov Cho'lpon 1"));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 1, `sahifa ekrandan ${overflow}px kengroq`);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});

test("BSB tahlili: «Taxminiy ball» eMaktab jami balini savollar bo'yicha bo'ladi (36 va 18 o'quvchi), Moslash va Bekor qilish", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    for (const [n, vw] of [[36, 1300], [18, 390]]) {
      const page = await browser.newPage({viewport: {width: vw, height: 844}});
      const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(APP);
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
      await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
      await page.evaluate((n) => {
        D.settings.protect.enabled = false;
        const c = D.classes[0];
        c.students = Array.from({length: n}, (_, i) => ({name: `O'quvchi ${String(i + 1).padStart(2, "0")}`, marks: {}, scores: i === 4 ? {} : {w3: 3 + (i * 7) % 23}}));
        c.analyses = []; S.ci = 0; S.bas = {}; go("journal");
      }, n);
      await page.evaluate(() => { S.jpage = "bsb"; render(); }); await page.waitForSelector("table.bsa");
      await page.evaluate(() => { const B = baCur(); B.q = 6; B.max = [3, 3, 4, 4, 5, 6]; render(); });
      await page.click("[data-btx]"); await page.waitForSelector(".tx-dlg");
      assert.equal(await page.locator(".tx-pv tr").count(), 6);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${vw}px: oyna sig'madi`);
      await page.click(".tx-dlg [data-ok]");
      const check = () => page.evaluate(() => {
        const c = D.classes[0], B = baCur(), bad = [];
        c.students.forEach((s) => {
          const r = B.rows[s.name], sc = s.scores.w3;
          if (sc === undefined) { if (r.in !== false) bad.push(s.name + ": ishtirok etmagan bo'lishi kerak"); return; }
          const sum = r.pts.reduce((a, v) => a + v, 0);
          if (Math.abs(sum - sc) > 1e-9 || r.pts.some((v, i) => v < 0 || v > B.max[i])) bad.push(`${s.name}: ${JSON.stringify(r.pts)} ≠ ${sc}`);
        });
        return bad;
      });
      assert.deepEqual(await check(), []);
      assert.equal(await page.locator("table.bsa .tx-em.ok").count(), n - 1);
      assert.equal(await page.locator("table.bsa input.sc.tx-est").count(), (n - 1) * 6);
      // eMaktab ustuni «Jami» oldida
      assert.equal(await page.evaluate(() => { const th = [...document.querySelectorAll("table.bsa tr:first-child th")]; return th.findIndex((x) => x.classList.contains("tx-h")) + 1 === th.findIndex((x) => x.textContent === "Jami"); }), true);
      // qo'lda tuzatish → farq, «Moslash» qolganini to'g'rilaydi, qo'lda yozilgani o'zgarmaydi
      const k = await page.evaluate(() => { const p = baCur().rows[D.classes[0].students[2].name].pts; return p.indexOf(Math.max(...p)); });
      await page.fill(`[data-bp="2|${k}"]`, "0"); await page.press(`[data-bp="2|${k}"]`, "Tab");
      assert.equal(await page.locator("table.bsa .tx-em.no").count(), 1);
      await page.click("[data-txfit]");
      assert.deepEqual(await check(), []);
      assert.equal(await page.evaluate((k) => baCur().rows[D.classes[0].students[2].name].pts[k], k), 0);
      assert.ok(await page.locator(`[data-bp="2|${k}"].tx-man`).count());
      // bekor qilish — oldingi (bo'sh) holat
      await page.click("[data-txundo]");
      assert.equal(await page.evaluate(() => Object.values(baCur().rows).some((r) => r.pts.some((v) => v != null))), false);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});

test("CHSB testi: «Taxminiy ball» eMaktab balini to'g'ri/noto'g'ri javoblarga aylantiradi, ball o'zgarmaydi (36 va 18 o'quvchi)", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    for (const [n, vw] of [[36, 1300], [18, 390]]) {
      const page = await browser.newPage({viewport: {width: vw, height: 844}});
      await page.clock.setFixedTime(new Date(2026, 9, 20, 10, 0));   // CHSB (16.10) arxivlanmagan chorakda
      const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(APP);
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
      await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
      await page.evaluate((n) => {
        D.settings.protect.enabled = false;
        const c = D.classes[0], w = c.works.find((x) => x.type === "chsb");
        // 20 savol × 2 ball: 0-o'quvchida toq ball (yig'ib bo'lmaydi), 4-o'quvchida ball yo'q, 1-o'quvchida javoblar bor
        c.students = Array.from({length: n}, (_, i) => ({id: "t" + i, name: `O'quvchi ${String(i + 1).padStart(2, "0")}`, marks: {}, scores: i === 4 ? {} : {[w.id]: i === 0 ? 27 : 2 * ((i * 5) % 21)}}));
        w.test = {n: 20, o: 4, key: "ABCDABCDABCDABCDABCD", ans: {t1: "ABCDABCDAB.........."}, out: []};
        S.ci = 0; S.tw = w.id; S.cttab = "tbl"; S.jpage = "chsbt"; go("journal");
      }, n);
      await page.waitForSelector("table.tst");
      const before = await page.evaluate(() => { const c = D.classes[0], w = c.works.find((x) => x.type === "chsb"); return c.students.map((s) => s.scores[w.id] ?? null); });
      await page.click("[data-btxc]"); await page.waitForSelector(".tx-dlg");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${vw}px: oyna sig'madi`);
      // toq ball (27) ni 2 ballik savollar bilan yig'ib bo'lmaydi: «eng yaqin ball» belgisi o'chirilsa — bo'sh qoladi, yoqilsa — 26
      assert.match(await page.textContent(".tx-dlg [data-ok]"), new RegExp(`${n - 2} ta`));
      assert.match(await page.textContent(".tx-dlg .tx-pv"), /27 → 26/);
      await page.click("#txn"); assert.match(await page.textContent(".tx-dlg [data-ok]"), new RegExp(`${n - 3} ta`));
      await page.click("#txn");
      await page.click(".tx-dlg [data-ok]"); await page.waitForSelector("#txc");
      const after = await page.evaluate(() => {
        const c = D.classes[0], w = c.works.find((x) => x.type === "chsb"), t = w.test;
        return {sc: c.students.map((s) => s.scores[w.id] ?? null), ans: c.students.map((s) => t.ans[s.id] || ""), out: t.out, calc: c.students.map((s) => t.ans[s.id] && !/^\.*$/.test(t.ans[s.id]) ? testScore(w, t, t.ans[s.id]).score : null)};
      });
      // eMaktab ballari o'zgarmadi; javoblardan hisoblangan ball ham aynan shu
      assert.deepEqual(after.sc.map((v, i) => i === 1 ? before[i] : v), before.map((v, i) => i === 4 ? null : i === 0 ? 26 : v));
      after.ans.forEach((a, i) => { if (i > 1 && i !== 4) assert.ok(after.calc[i] === before[i], `${i}: ${a} → ${after.calc[i]} ≠ ${before[i]}`); });
      assert.equal(after.calc[0], 26, "toq ball 27 → eng yaqin 26");
      assert.equal(after.ans[1], "ABCDABCDAB..........", "javobi bor o'quvchiga tegilmaydi");
      assert.deepEqual(after.out, ["t4"]);
      assert.equal(await page.locator("table.tst tr[data-row] .ta.tx-estc").count(), (n - 2) * 20);
      assert.match(await page.textContent("#txc"), /eng yaqin ball qo'yildi.*27 → 26/);
      // bekor qilish
      await page.click("[data-txcundo]");
      const undone = await page.evaluate(() => { const c = D.classes[0], w = c.works.find((x) => x.type === "chsb"); return {n: Object.keys(w.test.ans).length, out: w.test.out || [], sc: c.students.map((s) => s.scores[w.id] ?? null)}; });
      assert.equal(undone.n, 1); assert.deepEqual(undone.out, []); assert.deepEqual(undone.sc, before);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});

for (const [name, viewport, n] of [["kompyuter", {width: 1440, height: 900}, 36], ["telefon", {width: 390, height: 844}, 18]]) {
  test(`${name}: «Summativ tahlili» — BSB / CHSB / Loyiha ishi, tartib raqami, avtomatik «Umumiy»ga yozish (${n} o'quvchi)`, async () => {
    const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
    try {
      const page = await browser.newPage({viewport});
      const errors = []; page.on("pageerror", (e) => errors.push(e.message));
      await page.clock.setFixedTime(new Date(2026, 9, 20, 10, 0));
      await page.goto(APP);
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
      await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
      await page.evaluate((n) => { const c = D.classes[0]; while (c.students.length < n) c.students.push({id: "sm" + c.students.length, name: `Sinov O'quvchi ${c.students.length + 1}`, marks: {}, scores: {}});
        c.students.length = n; c.students.forEach((s) => s.scores = {}); c.works = []; c.analyses = []; S.ci = 0; save(); go("journal"); }, n);
      // jurnal tablari: Kundalik · Umumiy · Summativ tahlili · Yillik (eski «BSB tahlili» / «CHSB testi» yo'q)
      assert.deepEqual(await page.$$eval(".jtabs [data-jp], [data-jp]", (bs) => [...new Set(bs.map((b) => b.textContent.trim()))]), ["Kundalik", "Umumiy", "Summativ tahlili", "Yillik"]);
      await page.click("[data-jp=sm]"); await page.waitForSelector(".sm-ts");
      assert.match(await page.textContent(".sm-tb"), /1-chorakda BSB yo'q/);
      const mk = async (t, cnt) => {
        await page.click(`[data-smt=${t}]`); await page.click("[data-smnew]");
        await page.fill(".modal #smn", String(cnt)); await page.fill(".modal #smd", "2026-10-15"); await page.click(".modal [data-ok]");
        await page.waitForSelector(".modal", {state: "detached"});
      };
      await mk("bsb", 5); await mk("bsb", 5);
      assert.deepEqual(await page.$$eval("#smw option", (o) => o.map((x) => x.textContent.split(" · ")[0])), ["BSB-1", "BSB-2"]);
      // ball kiritiladi → «Umumiy»dagi BSB ustuniga o'zi yoziladi
      const inp = page.locator("[data-bp]").first(); await inp.fill("4"); await inp.press("Tab");
      await page.waitForFunction(() => { const c = D.classes[0], w = c.works.at(-1); return c.students[0].scores[w.id] === 4; });
      // Loyiha ishi: rasmiy shablon bilan (loyiha.js) — Informatika 11: 5 mezon × 10 (Ha/Yo'q) = 50
      await page.click("[data-smt=loyiha]"); await page.click("[data-smnew]"); await page.waitForSelector("#ly-ov");
      await page.fill("#ly-ov #ly-nd", "2026-10-15"); await page.click('#ly-ov [data-ly=tplall]').catch(() => {});
      await page.click('#ly-ov [data-ly=pick][data-v=inf11]'); await page.click("#ly-ov [data-ly=apply]");
      await page.waitForSelector("#ly-ov", {state: "detached"});
      assert.match(await page.textContent("#smw option:checked"), /^Loyiha ishi-1/);
      await page.click("[data-ly=view][data-v=j]");
      assert.equal(await page.locator("table.ly-t th.ly-thc").count(), 5);
      for (let k = 0; k < 5; k++) { await page.click(`button.ly-sc[data-r="0"][data-c="${k}"]`); await page.click('#ly-ov [data-ly=set][data-v="10"]'); await page.keyboard.press("Escape"); }
      await page.waitForFunction(() => { const c = D.classes[0], w = c.works.find((x) => x.type === "loyiha"); return w && w.max === 50 && c.students[0].scores[w.id] === 50; });
      // CHSB: test jadvali shu sahifada
      await mk("chsb", 20);
      await page.waitForSelector("table.tst");
      assert.equal(await page.evaluate(() => D.classes[0].works.find((w) => w.type === "chsb").test.n), 20);
      // «Amallar» menyusi: o'chirish so'raydi
      await page.click("[data-smmore]"); assert.ok(await page.isVisible(".sm-menu [data-smdel]"));
      await page.click(".sm-menu [data-smdel]"); await page.click(".modal [data-ok]");
      assert.equal(await page.evaluate(() => D.classes[0].works.filter((w) => w.type === "chsb").length), 0);
      // chorak hisobi: Loyiha BSB qismida
      const r = await page.evaluate(() => { const c = D.classes[0]; return quarterResult(c, c.students[0], 1, worksInQuarter(c, 1)); });
      assert.deepEqual([r.bsb, r.max_bsb, r.max_chsb], [54, 100, 0]);
      await page.click("[data-jp=sum]"); await page.waitForSelector("table.sum");
      assert.match(await page.textContent("table.sum"), /Loyiha/);
      await page.click("[data-jp=sm]"); await page.click("[data-smt=loyiha]");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 1, `sahifa ekrandan ${overflow}px kengroq`);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}

test("eMaktab importi: jurnallarni katakcha bilan tanlab qo'shish, belgisizlari eslab qolinadi (36 va 18 o'quvchi, telefon va kompyuter)", async () => {
  const XLSX = (await import("xlsx")).default;
  const xlsOf = (cls, subj, n) => { const rows = [[`Sinf: ${cls} 2026/2027`], [`Fan: ${subj}`], [], ["№", "F.I.Sh.", "Noyabr"], [null, null, 4]];
    for (let i = 1; i <= n; i++) rows.push([i, `O'quvchi ${String(i).padStart(2, "0")}`, 5 + (i % 5)]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), subj); return XLSX.write(wb, {type: "buffer", bookType: "xls"}).toString("base64"); };
  const F = [["6-A.xls", xlsOf("6-A", "Matematika", 36)], ["9-A.xls", xlsOf("9-A", "Algebra", 18)], ["7-B.xls", xlsOf("7-B", "Geometriya", 18)]];
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    for (const vp of [{width: 390, height: 844}, {width: 1280, height: 800}]) {
      const page = await browser.newPage({viewport: vp}); const errors = []; page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(APP);
      await page.evaluate(() => { D = normalize({classes: [{name: "6-A", subject: "Matematika", dates: [], students: [{name: "O'quvchi 01", marks: {}}]}]}); save(); go("today"); });
      const imp = () => page.evaluate((F) => { window._r = EMK1.run(F.map(([n, b]) => new File([Uint8Array.from(atob(b), (c) => c.charCodeAt(0))], n)), {auto: true}); }, F);
      await imp();
      await page.waitForSelector(".modal.ek-pick");
      const pick = ".modal.ek-pick";
      assert.match(await page.textContent(pick), /eMaktab'dan 3 ta jurnal o'qildi/);
      assert.deepEqual(await page.$$eval(`${pick} .ek-prow`, (r) => r.map((x) => [x.querySelector("b").textContent, x.querySelector("small").textContent, x.querySelector(".ek-ptag").textContent])),
        [["6-A · Matematika", "36 o'quvchi · 1 kun", "yangilanadi"], ["9-A · Algebra", "18 o'quvchi · 1 kun", "yangi"], ["7-B · Geometriya", "18 o'quvchi · 1 kun", "yangi"]]);
      assert.equal(await page.textContent(`${pick} [data-ekcnt]`), "3 / 3 tanlandi");
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      // «Hammasi» olinsa — tugma o'chadi; qaytadan belgilab, 7-B ni olib tashlaymiz
      await page.click("#ekpall");
      assert.equal(await page.textContent(`${pick} [data-ekok]`), "Jurnal tanlanmagan"); assert.ok(await page.isDisabled(`${pick} [data-ekok]`));
      await page.click("#ekpall"); await page.click(`${pick} .ek-prow:nth-child(3)`);
      assert.equal(await page.textContent(`${pick} [data-ekcnt]`), "2 / 3 tanlandi");
      assert.ok(await page.evaluate(() => document.querySelector("#ekpall").indeterminate));
      assert.equal(await page.textContent(`${pick} [data-ekok]`), "2 ta jurnalni qo'shish");
      await page.click(`${pick} [data-ekok]`);
      await page.waitForSelector("text=eMaktab'dan yangilandi", {timeout: 20000});
      assert.match(await page.textContent(".modal.ek-res .ek-sub"), /1 ta qo'shilmadi/);
      assert.deepEqual(await page.evaluate(() => D.classes.map((c) => [c.name, c.students.length])), [["6-A", 36], ["9-A", 18]]);
      assert.deepEqual(await page.evaluate(() => D.web.emk_skip), ["7-b|geometriya"], "7-B eslab qolindi");
      // keyingi import: 7-B belgisiz chiqadi; «Bekor qilish» — hech narsa o'zgarmaydi
      await page.evaluate(() => document.querySelectorAll(".modal").forEach((x) => x.remove()));
      const before = await page.evaluate(() => JSON.stringify(D.classes));
      await imp(); await page.waitForSelector(".modal.ek-pick");
      assert.deepEqual(await page.$$eval(`${pick} .ek-prow input`, (r) => r.map((x) => x.checked)), [true, true, false]);
      await page.click(`${pick} [data-x]`); await page.evaluate(() => window._r);
      assert.equal(await page.evaluate(() => JSON.stringify(D.classes)), before);
      assert.equal(await page.locator(".modal").count(), 0);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});

test("Hisobotlar tuzatishlari (2026-11-07): Loyiha belgisi, qisqa izohlar, jami qatori, «Ball qo'yish» ishni ochadi, sinf eslab qolinadi, 36 o'quvchi", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1440, height: 900}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.clock.setFixedTime(new Date(2026, 9, 20, 10, 0));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
    // 36 o'quvchi, BSB 20 + Loyiha 30 + CHSB 40; ikkinchi o'quvchida Loyiha balli yo'q, birinchisida past natija
    await page.evaluate(() => {
      const c = D.classes[0], [a] = qRange(1), d = c.dates.filter((x) => x >= a);
      while (c.students.length < 36) c.students.push({name: `Qo'shimcha ${c.students.length + 1}`, marks: {}, scores: {}});
      c.works = [{id: "tb", type: "bsb", date: d[0], max: 20, title: ""}, {id: "tl", type: "loyiha", date: d[1], max: 30, title: ""}, {id: "tc", type: "chsb", date: d[2], max: 40, title: ""}];
      c.students.forEach((s, i) => { s.scores = {tb: 15, tl: i === 0 ? 3 : 25, tc: 30}; if (i === 1) delete s.scores.tl; });
      save(); S.rq = 1; S.rep = {ci: 0, per: "q1", kind: "sum"}; go("reports");
    });
    const sum = await page.textContent(".hb-panel");
    assert.ok(sum.includes("1 BSB · 1 Loyiha · 1 CHSB"), "Ishlar ko'rsatkichi");
    assert.ok(await page.$(".hb-chip.loy"), "Loyiha belgisi");
    assert.ok(sum.includes("BSB + Loyiha"), "BSB qismi ustuni");
    // sinf hisoboti: izoh — qisqa belgilar (to'liq matn title'da), jadval oxirida jami qatori
    await page.click(".hb-list [data-kind=cls]");
    const chip = await page.$eval("td.hb-wyc .hb-chip.loy", (e) => [e.textContent, e.title]);
    assert.match(chip[0], /^Loyiha \d+%$/); assert.match(chip[1], /^Loyiha ishi /);
    assert.ok((await page.textContent("table.rcls tfoot")).includes("O'rtacha / jami"));
    assert.equal(await page.$$eval("table.rcls tbody tr", (x) => x.length), 36);
    // o'quvchi tartib raqami bo'yicha ochiladi
    await page.click('table.rcls [data-card="1"]'); await page.waitForSelector(".modal .hb-stu");
    assert.equal(await page.textContent(".modal .hb-stu h2"), await page.evaluate(() => D.classes[0].students[1].name));
    await page.click(".modal [data-x]");
    // tayyorlik: «Ball qo'yish» aynan Loyiha ishini Summativ sahifasida ochadi
    await page.click(".hb-list [data-kind=ready]");
    await page.click("[data-hwork=tl]");
    assert.deepEqual(await page.evaluate(() => [S.page, S.jpage, S.smt, S.smw]), ["journal", "sm", "loyiha", "tl"]);
    // tanlangan sinf qayta ochilganda eslab qolinadi
    await page.evaluate(() => { S.rep.ci = 1; S.rep.kind = "cls"; go("reports"); document.querySelector("[data-kind=stats]").click(); });
    assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("yoqlama_rep"))).ci, 1);
    // statistika: davomat ko'rsatkichi va Excel tugmasi
    assert.ok((await page.textContent(".hb-kpis")).includes("Davomat"));
    assert.ok(await page.$("[data-stxlsx]"));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Hisobotlar (2026-11-08): belgilar tanlovga bog'liq emas, tayyorlik xatolari, yangi chop etish varaqlari bitta A4 ga sig'adi (36 va 18 o'quvchi)", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    for (const N of [36, 18]) {
      const page = await browser.newPage({viewport: {width: 1440, height: 900}});
      const errors = []; page.on("pageerror", (e) => errors.push(e.message));
      await page.clock.setFixedTime(new Date(2026, 9, 20, 10, 0));
      await page.goto(APP);
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
      await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
      await page.evaluate((N) => {
        const c = D.classes[0], [a] = qRange(1), d = c.dates.filter((x) => x >= a);
        c.students = c.students.slice(0, N); while (c.students.length < N) c.students.push({name: `Qo'shimcha ${c.students.length + 1}`, marks: {}, scores: {}});
        c.works = [{id: "tb", type: "bsb", date: d[0], max: 20, title: ""}, {id: "tl", type: "loyiha", date: d[1], max: 30, title: ""}, {id: "tc", type: "chsb", date: d[2], max: 40, title: ""}];
        c.students.forEach((s, i) => { s.scores = {tb: 15, tl: 25, tc: 30}; if (i === 2 || i === 3) delete s.scores.tb; });
        c.students[2].name = c.students[3].name = "Ismdosh Aziz";   // ismdoshlar ikkalasi ham sanalsin
        D.web.bsb_hdr = Object.assign(D.web.bsb_hdr || {}, {teacher: "Aliyeva N.", school: "42-maktab"}); save();
        S.rq = 1; S.rep = {ci: 0, per: "q1", kind: "cls"}; go("reports");
      }, N);
      // ro'yxatda qizil/sariq belgilar yo'q, varaq ekranda ko'rinmaydi
      assert.equal(await page.locator(".hb-list .hb-bd").count(), 0, "turlar ro'yxatida belgi bo'lmasligi kerak");
      assert.equal(await page.locator(".hb-prt").isVisible(), false);
      // sinf tanlashda har sinf yonida xavf soni, tanlangan davrga qaramaydi
      await page.click(".hb-pc [data-hk=cls]");
      const tags = await page.$$eval(".hb-pop .hb-opt .hb-bd, .hb-opts .hb-opt .hb-bd", (x) => x.map((e) => e.textContent));
      assert.ok(tags.length >= 1 && tags.every((t) => /^\d+ xavf$/.test(t)), JSON.stringify(tags));
      await page.keyboard.press("Escape");
      // tayyorlik: ish yetishmasa halqa to'lmaydi; ismdoshlar alohida sanaladi
      await page.evaluate(() => { document.querySelector(".hb-list [data-kind=ready]").click(); });
      const rows = await page.evaluate(() => readinessRows(D.classes[0], 1)[1].filter((r) => r.name === "Ismdosh Aziz").length);
      assert.equal(rows, 2, "ismdoshlar alohida");
      await page.evaluate(() => { const c = D.classes[0]; c.works = c.works.filter((w) => w.type !== "chsb"); save(); S.rq = 1; render(); });
      assert.ok((await page.textContent(".hb-panel .hb-con")).includes("Sinf hali tayyor emas"), "CHSB yo'q — ogohlantirish");
      assert.ok(await page.$eval(".hb-ring .fg", (e) => e.style.stroke.includes("danger")), "halqa qizil");
      await page.evaluate(() => { const c = D.classes[0], [a] = qRange(1); c.works.push({id: "tc", type: "chsb", date: c.dates.filter((x) => x >= a)[2], max: 40, title: ""}); c.students.forEach((s) => { s.scores.tc = 30; }); save(); render(); });
      // chop etish: uchala hisobot bitta A4 varaqda, katak kesilmaydi
      for (const k of ["cls", "ready", "cmp"]) {
        await page.click(`.hb-list [data-kind=${k}]`);
        await page.evaluate(() => fitPrint()); await page.emulateMedia({media: "print"});
        const pdf = await page.pdf({preferCSSPageSize: true});
        assert.equal((pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length, 1, `${N} ${k}: bitta varaq`);
        const bad = await page.evaluate(() => {
          const p = document.querySelector(".hb-prt"), out = [], tb = p.querySelector(".hp-tb table");
          if (tb && tb.offsetHeight > p.querySelector(".hp-tb").clientHeight + 2) out.push("jadval sig'madi");
          p.querySelectorAll("td:not(.iz),th").forEach((e) => { if (e.scrollWidth > e.clientWidth + 1 && e.clientWidth) out.push("kesilgan: " + e.textContent.slice(0, 20)); });
          p.querySelectorAll("td .hp-ch").forEach((c) => { if (c.getBoundingClientRect().right > c.closest("td").getBoundingClientRect().right + 0.5) out.push("belgi kesilgan: " + c.textContent); });
          if (p.scrollHeight > p.clientHeight + 1) out.push("varaq to'lib ketdi");
          return out;
        });
        assert.deepEqual(bad, [], `${N} ${k}`);
        await page.emulateMedia({media: "screen"});
      }
      // oq-qora rejim saqlanadi, PDF → Telegram uchun ham varaq tayyor
      await page.click(".hb-list [data-kind=cls]"); await page.click("[data-prt=bw1]");
      assert.equal(await page.evaluate(() => D.web.prt.bw), 1);
      assert.ok(await page.$(".hb-prt.bw"));
      const pdfPages = await page.evaluate(async () => (await (await PTG.reportPdf()).text()).match(/\/Type\s*\/Page[^s]/g).length);
      assert.equal(pdfPages, 1, "PDF → Telegram: bitta sahifa");
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});

test("Bugun: chorak tugagandan keyin — yopish, ta'til, yangi chorak (bugun-tatil.js)", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    for (const [w, tel] of [[1300, false], [390, true]]) {
      for (const [day, k] of [[31, "grace"], [3, "arx"], [5, "new"]]) {
        const page = await browser.newPage({viewport: {width: w, height: 900}});
        const errors = []; page.on("pageerror", (e) => errors.push(e.message));
        await page.clock.setFixedTime(new Date(2026, k === "grace" ? 9 : 10, day, 9, 0));   // 1-chorak 29.10 da tugaydi, 02.11 da arxivlanadi, 2-chorak 05.11 dan
        await page.goto(APP);
        const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
        await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
        // yangi chorak: o'tgan chorak arxivlanmagan holat (avto-arxiv o'chiq) — arxivlangan holat alohida testda
        await page.evaluate((k) => { if (k === "new") { ARX.cfg().auto = false; delete D.web.arx.q[1]; } ARX.tick(); render(); }, k);
        assert.equal(await page.evaluate(() => BTL.mode(todayIso()).k), k);
        if (k === "grace") {
          await page.waitForSelector(".bt-close");
          assert.equal(await page.locator(".ax-today").count(), 0, "alohida arxiv kartasi chiqmaydi");
          assert.match(await page.locator(".bt-close h2").textContent(), /1-chorakni yopish/);
          const n = await page.evaluate(() => D.classes.filter((c) => !isGrp(c) && c.students.length).length);
          assert.equal(await page.locator(tel ? ".bt-cr" : ".bt-tbl tbody tr").count(), n);
          await page.click("[data-btlt=cb]");
          assert.equal(await page.locator("[data-btlt=cb].on").count(), 1);
          assert.equal(await page.locator(".bn-wk").count(), 0, "ta'tilda haftalik xulosa yo'q");
        } else if (k === "arx") {
          await page.waitForSelector(".bt-vac");
          assert.match(await page.locator(".bt-vac h2").textContent(), /2-chorak 2 kundan keyin/);
          assert.ok(await page.locator(".bt-pi").count() >= 5);
          await page.waitForSelector(".bt-lock");
          assert.equal(await page.locator(".bt-lock [data-axopen='1']").count(), 1);
          if (tel) { await page.click("[data-btab=res]"); await page.waitForSelector(".ba-x"); }
          else assert.equal(await page.locator(".ba-x").count(), 1);
        } else {
          await page.waitForSelector(".bt-strip");
          if (tel) await page.click("[data-btab=cls]");
          assert.ok(await page.locator(".bt-was").count() > 0, "o'tgan chorak qiymatlari");
          await page.click("[data-btlx]");
          assert.equal(await page.locator(".bt-strip").count(), 0);
        }
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 1);
        assert.deepEqual(errors, []);
        await page.close();
      }
    }
  } finally { await browser.close(); }
});

// «Yangi chorakka tayyorgarlik»: chorak hisoboti Telegram'ga yuborilgach band ✓ bo'ladi (Akmal, 2026-11-08)
for (const [name, viewport, count] of [["kompyuter", {width: 1440, height: 900}, 36], ["telefon", {width: 390, height: 844}, 18]]) {
  test(`${name}: ta'til — «1-chorak hisobotini yuborish» Telegram'dan keyin belgilanadi (${count} o'quvchi)`, async () => {
    const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
    try {
      const page = await browser.newPage({viewport});
      const errors = []; page.on("pageerror", (e) => errors.push(e.message));
      await page.clock.setFixedTime(new Date(2026, 10, 3, 9, 0));   // 1-chorak arxivlangan, 2-chorak 05.11 dan
      await page.goto(APP);
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
      await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
      await page.evaluate((n) => {
        D.settings.protect.enabled = false;
        const c = D.classes[0]; for (let i = c.students.length; i < n; i++) c.students.push({name: `Qo'shimcha O'quvchi ${i + 1}`, marks: {}, scores: {}}); c.students.length = n;
        localStorage.setItem(TG_KEY, JSON.stringify({token: "1:x", chat: "42"}));
        window.__sent = []; tgApi = async (m, fd) => { window.__sent.push([m, fd.get("caption")]); return {ok: true}; };
        save(); ARX.tick(); render();
      }, count);
      await page.waitForSelector(".bt-vac");
      const row = page.locator(".bt-pi", {hasText: "1-chorak hisobotini yuborish"});
      await row.waitFor();
      assert.equal(await row.locator(".bt-ic").textContent(), "○");
      const cnt0 = await page.locator(".bt-ph .bn-cnt").textContent();
      // «Ochish» → Hisobotlar «Sinflarni solishtirish» (1-chorak) → «✈ Telegram»
      await row.locator("[data-baxrep='1']").click();
      await page.waitForFunction(() => S.page === "reports" && S.rep.kind === "cmp" && S.rep.per === "q1");
      await page.locator("[data-tgpdf]:visible").first().click();
      await page.waitForFunction(() => window.__sent.length === 1 && PTG.sentQ(1), null, {timeout: 30000});
      assert.equal(await page.evaluate(() => window.__sent[0][0]), "sendDocument");
      // «Bugun»: band ✓, hisob bittaga oshgan; qayta yuklashdan keyin ham saqlanadi
      await page.click(`${viewport.width < 600 ? ".tabbar" : ".side"} [data-go=today]`);
      await page.waitForSelector(".bt-vac");
      assert.equal(await row.locator(".bt-ic").textContent(), "✓");
      assert.match(await row.textContent(), /Telegram'ga yuborilgan · 03\.11/);
      assert.equal(await row.locator("[data-baxrep]").count(), 0);
      const [a0, b0] = cnt0.split("/").map((x) => +x.trim()), [a1, b1] = (await page.locator(".bt-ph .bn-cnt").textContent()).split("/").map((x) => +x.trim());
      assert.deepEqual([a1, b1], [a0 + 1, b0]);
      await page.reload(); await page.waitForSelector(".bt-vac");
      assert.equal(await page.locator(".bt-pi", {hasText: "1-chorak hisobotini yuborish"}).locator(".bt-ic").textContent(), "✓");
      // boshqa davr (sinf hisoboti) yuborilsa 1-chorak belgisi o'zgarmaydi, 2-chorak belgilanmaydi
      assert.equal(await page.evaluate(() => PTG.sentQ(2)), null);
      // keyingi yil chorak sanasi o'zgarsa — eski belgi hisobga olinmaydi
      assert.equal(await page.evaluate(() => { D.web.qrep_tg[1] = "2025-09-02|2025-11-03"; return PTG.sentQ(1); }), null);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 1);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}

test("Yangilaganda (F5) ochiq sahifa qoladi, yangi oynada «Bugun» (36 va 18 o'quvchi)", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    for (const [vp, n] of [[{width: 1440, height: 900}, 36], [{width: 390, height: 844}, 18]]) {
      const ctx = await browser.newContext({viewport: vp});
      const page = await ctx.newPage();
      const errors = []; page.on("pageerror", (e) => errors.push(e.message));
      await page.clock.setFixedTime(new Date(2026, 9, 20, 10, 0));
      await page.goto(APP);
      await page.evaluate((n) => {
        const st = Array.from({length: n}, (_, i) => ({name: `O'quvchi ${i + 1}`, marks: {}}));
        D = normalize({classes: [{name: "7-A", subject: "Matematika", students: st, dates: ["2026-10-19", "2026-10-20"]}, {name: "8-B", subject: "Fizika", students: st.slice(0, 5), dates: ["2026-10-20"]}]});
        save(); render();
      }, n);
      const tb = vp.width < 600 ? ".tabbar" : ".side";
      // jurnal: 2-sinf, «Umumiy» sahifasi
      await page.click(`${tb} [data-go=journal]`);
      await page.evaluate(() => { S.ci = 1; S.jpage = "sum"; render(); });
      await page.reload(); await page.waitForFunction(() => S.page === "journal" && document.querySelector("#main").innerText.includes("8-B"));
      assert.deepEqual(await page.evaluate(() => [S.page, S.ci, S.jpage]), ["journal", 1, "sum"]);
      // sozlamalar bo'limi
      await page.click(`${tb} [data-go=settings]`);
      await page.evaluate(() => { S.sec = 2; render(); });
      await page.reload(); await page.waitForFunction(() => S.page === "settings");
      assert.deepEqual(await page.evaluate(() => [S.page, S.sec]), ["settings", 2]);
      // hisobotlar
      await page.click(`${tb} [data-go=reports]`);
      await page.reload(); await page.waitForFunction(() => S.page === "reports");
      // dars (Darsni boshlash) — o'sha kuni qadam va o'quvchi bilan qaytadi
      await page.evaluate(() => { startLesson(0); }); await page.waitForFunction(() => S.page === "lesson");
      await page.evaluate(() => { S.step = 1; render(); });
      await page.reload(); await page.waitForFunction(() => S.page === "lesson");
      assert.deepEqual(await page.evaluate(() => [S.lesson, S.step]), [0, 1]);
      // sinf o'chirilgan bo'lsa ham xato chiqmaydi
      await page.click(`${tb} [data-go=journal]`);
      await page.evaluate(() => { S.ci = 1; render(); });
      await page.evaluate(() => { const d = JSON.parse(localStorage.getItem(STORE_KEY)); d.classes.length = 1; localStorage.setItem(STORE_KEY, JSON.stringify(d)); indexedDB.deleteDatabase("yoqlama_jurnal"); });
      await page.reload(); await page.waitForFunction(() => S.page === "journal");
      assert.equal(await page.evaluate(() => S.ci), 0);
      // yangi oyna (tab) — odatdagidek «Bugun»
      const p2 = await ctx.newPage(); await p2.clock.setFixedTime(new Date(2026, 9, 20, 10, 0));
      await p2.goto(APP); await p2.waitForSelector(".bn-hd");
      assert.equal(await p2.evaluate(() => S.page), "today");
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  } finally { await browser.close(); }
});

// Summativ eksporti: «Hozirgi / Yangi» varaq dizayni (bsb-yangi.js) — hozirgi o'zgarishsiz, yangi uslublar, qayta chizilmaslik, sig'ish, kontrast, PDF
for (const [name, viewport, count] of [["kompyuter", {width: 1440, height: 900}, 36], ["telefon", {width: 390, height: 844}, 18]]) {
  test(`${name}: Summativ eksporti — Hozirgi/Yangi varaq dizayni (${count} o'quvchi)`, async () => {
    const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
    try {
      const ctx = await browser.newContext({viewport});
      const page = await ctx.newPage();
      const errors = []; page.on("pageerror", (e) => errors.push(e.message));
      await page.clock.setFixedTime(new Date(2026, 9, 20, 10, 0));
      await page.goto(APP);
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
      await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
      await page.evaluate((n) => { D.settings.protect.enabled = false; window.print = () => { window.__printed = document.getElementById("pdoc").innerHTML; };
        const c = D.classes[0]; for (let i = c.students.length; i < n; i++) c.students.push({name: `Qo'shimcha O'quvchi ${i + 1}`, marks: {}, scores: {}}); c.students.length = n;
        c.students[1].name = "Abdurahmonova Mohinur Shuhratjon qizi";
        D.web.bsb_hdr = Object.assign(D.web.bsb_hdr || {}, {teacher: "Otaboboyev Akmal", school: "274-sonli umumta'lim maktabi"}); save(); }, count);
      await page.click(`${name === "telefon" ? ".tabbar" : ".side"} [data-go=journal]`);
      await page.evaluate(() => { S.jpage = "bsb"; render(); }); await page.waitForSelector("table.bsa");
      const qd = await page.evaluate(() => D.settings.quarters[0][0]);
      await page.fill("#bt", "Kasrlar"); await page.fill("#bdt", qd); await page.dispatchEvent("#bdt", "change");
      await page.fill("#bnq", "3"); await page.press("#bnq", "Tab"); await page.waitForSelector('[data-bx="2"]');
      await page.fill('[data-bx="2"]', "6"); await page.press('[data-bx="2"]', "Tab");
      const n = await page.evaluate(() => D.classes[S.ci].students.length);
      for (let si = 0; si < n; si++) for (let i = 0; i < 3; i++) await page.fill(`[data-bp="${si}|${i}"]`, String((si + i) % (i === 2 ? 7 : 3)));
      await page.press(`[data-bp="${n - 1}|2"]`, "Tab"); await page.click("[data-bsave]");
      const tap = (s) => page.evaluate((s) => document.querySelector(s).click(), s);
      await page.click("[data-bexp]"); await page.waitForSelector(".modal .bx-pg", {state: "attached"});
      // Hozirgi: avvalgidek, yangi elementlar yo'q
      assert.equal(await page.evaluate(() => document.querySelector(".bx-dlg").dataset.d), "old");
      const old = await page.evaluate(() => ({nw: document.querySelectorAll(".modal .bx-pg.nw").length, cb: document.querySelectorAll(".modal .bx-cb").length, kp: document.querySelectorAll(".modal .bx-kp").length, fr: document.querySelectorAll(".modal .bx-fr").length,
        newVis: [...document.querySelectorAll("[data-newonly]")].some((e) => e.offsetParent), oldVis: [...document.querySelectorAll("[data-oldonly]")].filter((e) => !e.hidden).every((e) => e.offsetParent)}));
      assert.deepEqual([old.nw, old.cb, old.kp, old.fr, old.newVis, old.oldVis], [0, 0, 0, 0, false, true], "Hozirgi dizayn o'zgarmagan");
      // Yangi
      await tap('[data-seg=dz] [data-v=new]'); await page.waitForSelector(".modal .bx-pg.nw", {state: "attached"});
      const nw = await page.evaluate(() => ({d: document.querySelector(".bx-dlg").dataset.d, st: D.web.bsb_hdr.bx.d, cb: document.querySelectorAll(".modal .bx-pg.nw .bx-cb").length, kp: document.querySelectorAll(".modal .bx-kp").length, med: document.querySelectorAll(".modal td.mdl").length,
        pre: document.querySelectorAll(".bxn-pc").length, dots: document.querySelectorAll(".bxn-dot").length, oldHidden: [...document.querySelectorAll("[data-oldonly]")].every((e) => !e.offsetParent), gl: document.querySelectorAll(".modal .bx-gl").length}));
      assert.equal(nw.d, "new"); assert.equal(nw.st, "new"); assert.ok(nw.cb >= 1 && nw.kp === 3 && nw.med === 3 && nw.gl >= 1, JSON.stringify(nw)); assert.equal(nw.pre, 4); assert.equal(nw.dots, 6); assert.ok(nw.oldHidden);
      assert.ok(await page.evaluate(() => document.querySelector(".bxn-pc.on")), "Zamonaviy tanlangan");
      // tugma bosilganda panel va varaq qayta chizilmaydi (tugunlar va scroll joyida)
      await page.evaluate(() => { window.__chips = document.querySelector("[data-chips]"); window.__pg = document.querySelector(".bx-pages .bx-pw"); window.__sb = document.querySelector(".bx-side-b"); document.querySelector(".bx-pages").scrollTop = 150; });   // telefonda ko'rish yorlig'i yopiq: faqat tugunlar tekshiriladi
      await tap('[data-np=ras]');
      const same = await page.evaluate(() => ({chips: window.__chips === document.querySelector("[data-chips]"), pg: window.__pg === document.querySelector(".bx-pages .bx-pw"), sb: window.__sb === document.querySelector(".bx-side-b"), y: document.querySelector(".bx-pages").scrollTop,
        fr: document.querySelectorAll(".modal .bx-fr").length, mo: document.querySelectorAll(".modal .bx-mo").length, serif: document.querySelectorAll(".modal .bx-pg.f-serif").length, on: document.querySelector(".bxn-pc.on").dataset.np}));
      assert.ok(same.chips && same.pg && same.sb, "tugunlar saqlanadi"); if (name === "kompyuter") assert.ok(same.y >= 100, `scroll joyida: ${same.y}`);
      assert.ok(same.fr >= 2 && same.mo >= 1 && same.serif >= 1 && same.on === "ras", JSON.stringify(same));
      // hamma rang mavzusi va uslub, ikkala shakl: ichki sig'ish, ismlar kesilmaydi, kontrast >= 4.5
      const scan = () => page.evaluate(() => {
        const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(",").map(Number); return {r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1}; };
        const lum = ({r, g, b}) => { const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
        const over = (t, b) => ({r: t.r * t.a + b.r * (1 - t.a), g: t.g * t.a + b.g * (1 - t.a), b: t.b * t.a + b.b * (1 - t.a), a: 1});
        const bgOf = (el) => { const ch = []; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { ch.push(c); if (c.a >= 1) break; } } let b = {r: 255, g: 255, b: 255, a: 1}; for (let i = ch.length - 1; i >= 0; i--) b = over(ch[i], b); return b; };
        const bad = [], cut = [];
        for (const pg of document.querySelectorAll(".modal .bx-pg")) {
          const body = pg.querySelector(".bx-body"); if (body.scrollHeight > body.clientHeight + 1) cut.push("sig'maydi " + (body.scrollHeight - body.clientHeight));
          const zm = body.firstElementChild && body.firstElementChild.classList.contains("bx-zm") ? body.firstElementChild : body, ks = [...zm.children];
          for (let i = 0; i + 1 < ks.length; i++) if (ks[i].getBoundingClientRect().bottom > ks[i + 1].getBoundingClientRect().top + 1) cut.push("bloklar ustma-ust " + i);
          const w = document.createTreeWalker(pg, NodeFilter.SHOW_TEXT);
          while (w.nextNode()) { const t = w.currentNode; if (!t.nodeValue.trim()) continue; const el = t.parentElement, cs = getComputedStyle(el); if (cs.visibility === "hidden" || !el.getBoundingClientRect().width) continue;
            const fg = parse(cs.color), bg = bgOf(el), f2 = over(fg, bg), a = lum(f2), b = lum(bg), cr = (Math.max(a, b) + .05) / (Math.min(a, b) + .05); const big = parseFloat(cs.fontSize) >= 18.66;
            if (cr < (big ? 3 : 4.5)) bad.push(`${el.className}|${t.nodeValue.trim().slice(0, 14)}|${cr.toFixed(2)}`); }
        }
        return {bad: [...new Set(bad)].slice(0, 6), cut};
      });
      for (const th of ["", "t-kok", "t-bin", "t-iliq", "t-qiz", "t-bw"]) for (const pre of ["zam", "yen", "ras", "ixc"]) for (const form of ["1", "2"]) {
        await tap(`[data-np=${pre}]`); await tap(`[data-nth="${th}"]`); await tap(`.bxn-full [data-v="${form}"]`);
        const r = await scan(); assert.deepEqual(r, {bad: [], cut: []}, `${th || "yashil"} ${pre} ${form}: ${JSON.stringify(r)}`);
      }
      assert.equal(await page.evaluate(() => D.web.bsb_hdr.bx.bw), true, "Oq-qora mavzu Excel uchun ham oq-qora");
      // suv belgisi, rangli baho katagi, imzo muhri — PDF va chop etishga o'tadi
      await tap('[data-nth=""]'); await tap('[data-np=yen]'); await tap('[data-seg=nform] [data-v="1"]');
      await page.evaluate(() => { document.querySelector(".bxn-g").open = true; });
      for (const k of ["wm", "gc", "fr", "mo"]) await tap(`[data-nt=${k}]`);
      assert.ok(await page.evaluate(() => document.querySelectorAll(".modal img.bx-wm").length >= 1 && document.querySelector(".bxn-g").open), "suv belgisi va ochiq bo'lim saqlanadi");
      await page.evaluate(() => { window.__pdf = null; const R = BXP.pagesHtml(BXP.data(D.classes[S.ci], D.classes[S.ci].analyses[0]), BXP.cfg(), 1); return PTG.pagesPdf(R.pages, R.land).then((b) => b.arrayBuffer()).then((ab) => { window.__pdf = [...new Uint8Array(ab).slice(0, 5)].map((c) => String.fromCharCode(c)).join("") + ":" + ab.byteLength; }); });
      const pdf = await page.evaluate(() => window.__pdf); assert.match(pdf, /^%PDF-:\d+$/); assert.ok(+pdf.split(":")[1] > 8000, pdf);
      await page.click(".modal [data-pdf]");
      const html = await page.evaluate(() => window.__printed);
      assert.ok(html.includes("bx-pg") && html.includes("nw") && html.includes("bx-fr") && html.includes("bx-cb"), "chop etishda yangi dizayn");
      // eslab qolinadi: qayta ochilganda ham Yangi, tanlangan uslub saqlangan
      await page.click("[data-bexp]"); await page.waitForSelector(".modal .bx-pg.nw", {state: "attached"});
      assert.equal(await page.evaluate(() => document.querySelector(".bx-dlg").dataset.d), "new");
      assert.equal(await page.evaluate(() => D.web.bsb_hdr.bx.n.wm), true);
      // Hozirgi'ga qaytish — avvalgi ko'rinish
      await tap('[data-seg=dz] [data-v=old]');
      const back = await page.evaluate(() => ({nw: document.querySelectorAll(".modal .bx-pg.nw").length, d: document.querySelector(".bx-dlg").dataset.d, bw: D.web.bsb_hdr.bx.bw}));
      assert.deepEqual(back, {nw: 0, d: "old", bw: false});
      assert.deepEqual(errors, []);
      await ctx.close();
    } finally { await browser.close(); }
  });
}

for (const n of [36, 18]) test(`Qo'shimcha funksiyalar: yangi bo'lim, taymer, navbatchi, BSB eslatmasi, kelmaganlarga xabar — ${n} o'quvchi`, async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.clock.setFixedTime(new Date("2026-10-23T10:00:00"));   // juma, 6-A da dars bor
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
    const names = await page.evaluate((n) => {
      const c = D.classes[0], base = c.students[0], t = todayIso();
      while (c.students.length < n) c.students.push(Object.assign(JSON.parse(JSON.stringify(base)), {name: `Sinovov O'quvchi ${c.students.length + 1}`, marks: {}}));
      c.students.length = n; if (!c.dates.includes(t)) c.dates.push(t), c.dates.sort();
      c.students[0].marks[t] = "s"; c.students[5].marks[t] = "k"; c.students[0].par = {name: "Otasi", phone: "+998901234567"};
      c.works.push({id: "w9", type: "bsb", date: "2026-10-26", max: 25, title: "BSB-3"});
      delete D.web.duty; D.web.bsb_hdr = {teacher: "Karimova N."}; save(); go("today"); return c.students.map((s) => s.name);
    }, n);
    // «Bugun»: navbatchi (kelmagan 1- va 2-o'quvchi o'tkazib yuboriladi) va 3 kundan keyingi BSB
    const dr = await page.textContent(".fn-dutyr"); assert.ok(dr.includes(names[2]), dr + " / " + names.slice(0, 3));
    const br = await page.textContent(".fn-bsbr"); assert.ok(br.includes("3 kundan keyin") && br.includes("6-A"), br);
    // dars: taymer (jadval yo'q — 45 daqiqa), navbatchi, «Keyingisi»
    await page.evaluate(() => { S.ci = 0; S.lesson = 0; S.step = 0; go("lesson"); });
    await page.waitForSelector("[data-fn-tm]");
    assert.ok((await page.textContent("[data-fn-tm]")).includes("45:00"));
    assert.equal(await page.textContent(".fn-duty b"), names[2]);
    await page.click("[data-fn-duty]"); assert.equal(await page.textContent(".fn-duty b"), names[3], "kech qolgan navbatchi bo'la oladi");
    assert.deepEqual(await page.evaluate(() => Object.values(D.web.duty)[0]), {d: "2026-10-23", i: 3});
    // kelmaganlar ota-onasiga xabar: har biriga tayyor matn, kontakt bo'lsa — to'g'ridan-to'g'ri
    assert.ok((await page.textContent("[data-fn-abs]")).includes("(3)"));
    await page.click("[data-fn-abs]"); await page.waitForSelector(".modal .pmsg");
    assert.equal(await page.locator(".modal .pmsg").count(), 3);
    const t0 = await page.inputValue('.modal [data-fa="0"]'), t1 = await page.inputValue('.modal [data-fa="2"]');
    assert.ok(t0.includes(names[0]) && t0.includes("23.10.2026") && t0.includes("kelmadi") && t0.includes("Karimova N."), t0);
    assert.ok(t1.includes(names[5]) && t1.includes("(kasal)"), t1);
    assert.ok(await page.$('.modal [data-pwa="a0"]'), "telefon bor — WhatsApp");
    await page.fill('.modal [data-fa="0"]', "Salom test");
    assert.ok((await page.getAttribute('.modal [data-psms="a0"]', "href")).endsWith("body=Salom%20test"));
    assert.ok(await page.evaluate(() => document.querySelector(".modal .card").scrollWidth <= document.querySelector(".modal .card").clientWidth + 1), "oyna yonga chiqmaydi");
    await page.click(".modal [data-x]");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "dars sahifasi yonga chiqmaydi");
    // Sozlamalar → Funksiyalar: 4 guruh, jonli namuna, saralash, guruhni o'chirish va «Qaytarish»
    await page.evaluate(() => { S.sec = 6; go("settings"); });
    assert.equal(await page.locator(".fn-g").count(), 5);   // + «eMaktab» guruhi (v223)
    assert.equal(await page.locator(".fn-row .fn-new").count(), 5);   // + Ota-onalar eMaktab'i (v222)
    assert.equal(await page.locator('[data-ft="act"], [data-ft="week"]').count(), 0);
    assert.ok((await page.textContent(".fn-g .fn-prev")).includes("Taymer"));
    await page.click('[data-fnf="new"]'); assert.equal(await page.locator(".fn-row:not(.multi)").count(), 5);
    await page.click('[data-fnf="all"]');
    await page.click('[data-fng="lesson"]');
    assert.equal(await page.evaluate(() => ["call", "groups", "attmodes", "seats", "hw", "timer", "duty"].some(feat)), false);
    assert.ok((await page.textContent(".fn-g .fn-prev")).includes("Hech narsa"));
    await page.click(".toast .tact");
    assert.equal(await page.evaluate(() => ["call", "groups", "attmodes", "seats", "hw", "timer", "duty"].every(feat)), true, "Qaytarish");
    // to'plamlar: Asosiy → «Tanlovim» emas; bitta kalit → Tanlovim
    await page.click('[data-fp="simple"]'); assert.ok(await page.$('.fn-pre [data-fp="simple"].on'));
    await page.click('[data-ft="hw"]'); assert.ok(await page.$(".fn-pre button.on:not([data-fp])"), "Tanlovim");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "sozlamalar yonga chiqmaydi");
    await page.click('[data-fp="all"]'); await page.click('[data-ft="timer"]'); await page.click('[data-ft="duty"]'); await page.click('[data-ft="absmsg"]');
    await page.evaluate(() => { S.step = 0; go("lesson"); }); await page.waitForSelector("[data-next]");
    assert.equal(await page.locator(".fn-lbar").count(), 0, "o'chirilgan funksiyalar darsda yo'q");
    await page.evaluate(() => go("today")); assert.equal(await page.locator(".fn-dutyr").count(), 0); assert.equal(await page.locator(".fn-bsbr").count(), 1);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

for (const [name, viewport, n] of [["kompyuter", {width: 1440, height: 900}, 36], ["telefon", {width: 390, height: 844}, 18]]) {
  test(`${name}: Loyiha ishi — rasmiy mezonlar, 5 usul, Taxminiy ball, shablon almashtirish, eski ishlar (${n} o'quvchi)`, async () => {
    const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
    try {
      const page = await browser.newPage({viewport});
      const errors = []; page.on("pageerror", (e) => errors.push(e.message)); page.on("dialog", (d) => d.accept());
      await page.clock.setFixedTime(new Date(2026, 9, 20, 10, 0));
      await page.goto(APP);
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
      await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
      // eski (shablonsiz) loyiha ishi: 2 mezon × 5, birinchi o'quvchida 4 + 3
      await page.evaluate((n) => { D.settings.protect.enabled = false; const c = D.classes[0]; c.name = "8-A"; c.subject = "Geografiya";
        while (c.students.length < n) c.students.push({id: "ly" + c.students.length, name: `Sinov O'quvchi ${c.students.length + 1}`, marks: {}, scores: {}});
        c.students.length = n; c.students.forEach((s) => s.scores = {}); c.analyses = [];
        c.works = [{id: "old", type: "loyiha", date: "2026-10-05", max: 10, title: ""}]; c.students[0].scores.old = 7;
        c.analyses.push({id: "a1", w: "old", title: "", date: "2026-10-05", q: 2, max: [5, 5], names: ["Mazmun", "Taqdimot"], rows: {[c.students[0].name]: {in: true, pts: [4, 3]}}});
        S.ci = 0; save(); go("journal"); S.jpage = "sm"; S.smt = "loyiha"; S.lyv = "j"; render(); }, n);
      await page.waitForSelector(".ly-mz");
      assert.match(await page.textContent(".ly-mz"), /shablon tanlanmagan/);
      assert.deepEqual(await page.$$eval('tr[data-row="0"] button.ly-sc', (b) => b.map((x) => x.textContent)), ["4", "3"]);
      assert.equal(await page.evaluate(() => D.classes[0].students[0].scores.old), 7);
      // yangi ish: fan bo'yicha taklif qilingan shablon (Geografiya 8 — 6 mezon, Darajalar)
      await page.click("[data-smnew]"); await page.waitForSelector("#ly-ov .ly-tp.on");
      assert.match(await page.textContent("#ly-ov .ly-tp.on"), /Geografiya · 8-sinf/);
      await page.fill("#ly-ov #ly-nd", "2026-10-15"); await page.click("#ly-ov [data-ly=apply]"); await page.waitForSelector("#ly-ov", {state: "detached"});
      const W = () => page.evaluate(() => { const c = D.classes[0], w = c.works.find((x) => x.date === "2026-10-15"); return {w, a: c.analyses.find((a) => a.w === w.id), sc: c.students.map((s) => s.scores[w.id])}; });
      assert.equal((await W()).w.max, 50);
      assert.equal(await page.locator("table.ly-t th.ly-thc").count(), 6);
      // «Umumiy»da eMaktabdan kelgan jami (har 5-o'quvchida yo'q)
      await page.evaluate(() => { const c = D.classes[0], w = c.works.find((x) => x.date === "2026-10-15"); c.students.forEach((s, i) => { if (i % 5 !== 4) s.scores[w.id] = 15 + (i * 7) % 35; }); save(); render(); });
      // baholash oynasi: daraja tanlash → keyingi o'quvchiga o'tadi; chala qatorda «Umumiy» o'zgarmaydi
      await page.click('button.ly-sc[data-r="0"][data-c="0"]'); await page.click('#ly-ov [data-ly=set][data-v="6"]');
      assert.equal(await page.evaluate(() => S.lyp.r), 1);
      await page.keyboard.press("Escape");
      let st = await W(); assert.deepEqual(st.a.rows[await page.evaluate(() => D.classes[0].students[0].name)].pts.slice(0, 2), [6, null]); assert.equal(st.sc[0], 15);
      if (name === "kompyuter") {   // katakka raqam yozish: 7 yo'q → eng yaqini (6), keyingi qatorga o'tadi
        await page.focus('button.ly-sc[data-r="2"][data-c="1"]'); await page.keyboard.press("7"); await page.waitForTimeout(50);
        assert.equal((await W()).a.rows[await page.evaluate(() => D.classes[0].students[2].name)].pts[1], 6);
        assert.equal(await page.evaluate(() => document.activeElement.dataset.r), "3");
      }
      // Taxminiy ball: eMaktab bali bor hammaga, yig'indi aynan teng (yoki eng yaqin)
      await page.click("[data-ly=txo]"); await page.click("#ly-ov [data-ly=txgo]"); await page.waitForSelector(".ly-ban");
      st = await W();
      const sums = await page.evaluate(() => { const c = D.classes[0], w = c.works.find((x) => x.date === "2026-10-15"), a = c.analyses.find((x) => x.w === w.id), L = LYH.lyOf(c, a);
        return c.students.map((s) => { const r = a.rows[s.name]; return r && r.x ? [LYH.stotal(L.subj[0].crit, r.x[0]).t, r.em ?? null, L.subj[0].crit.every((cr, k) => r.x[0][k] == null || LYH.optsOf(cr).includes(LYH.cval(cr, r.x[0][k])))] : null; }); });
      sums.forEach((x, i) => { if (i % 5 === 4) return; assert.ok(x && x[2], `${i}: ruxsat etilmagan qiymat`); assert.ok(Math.abs(x[0] - x[1]) <= 1, `${i}: ${x[0]} ≠ ${x[1]}`); });
      // qatnashmadi → «Umumiy»dagi ball o'chadi
      await page.click('tr[data-row="1"] button.ly-sc >> nth=0'); await page.click("#ly-ov [data-ly=absr]"); await page.keyboard.press("Escape");
      await page.waitForFunction(() => { const c = D.classes[0], w = c.works.find((x) => x.date === "2026-10-15"); return c.students[1].scores[w.id] === undefined; });
      // shablon almashtirish: ogohlantiradi, mezon ballari o'chadi, ↶ qaytaradi
      await page.click(".ly-mz [data-ly=tpl]"); await page.click("#ly-ov [data-ly=tplall]"); await page.click('#ly-ov [data-ly=pick][data-v=tab6]');
      assert.ok(await page.isVisible("#ly-ov .ly-warn")); await page.click("#ly-ov [data-ly=apply]");
      assert.equal(await page.locator("table.ly-t th.ly-thc").count(), 6); assert.equal((await W()).w.max, 30);
      assert.equal(await page.locator("table.ly-t button.ly-sc:not(.e)").count(), 0);
      await page.click(".ly-bar [data-ly=undo]"); assert.equal((await W()).w.max, 50);
      assert.ok(await page.locator("table.ly-t button.ly-sc.est").count() > 0);
      // mezonlar varaqasi va izoh
      await page.click("[data-smmore]"); await page.click(".sm-menu [data-ly=rub]"); assert.equal(await page.locator("#ly-ov .ly-rub > li").count(), 6); await page.keyboard.press("Escape");
      await page.click('[data-ly=view][data-v=k]'); await page.click(".ly-nq >> nth=0");
      assert.equal(await page.evaluate(() => { const c = D.classes[0], a = c.analyses.find((x) => x.w === c.works.find((w) => w.date === "2026-10-15").id); return a.rows[c.students[S.lystu].name].nt; }), "Jamoa sardori");
      // integratsiyalashgan (Tarbiya + Davlat va huquq): «Davlat va huquq» jurnalida huquq bali «Umumiy»ga yoziladi
      await page.evaluate(() => { D.classes[0].subject = "Davlat va huquq asoslari"; save(); render(); });
      await page.click("[data-smnew]"); await page.fill("#ly-ov .ly-srch", "10-sinf"); await page.click('#ly-ov [data-ly=pick][data-v=tar10]');
      await page.fill("#ly-ov #ly-nd", "2026-10-16"); await page.click("#ly-ov [data-ly=apply]"); await page.waitForSelector("#ly-ov", {state: "detached"});
      assert.equal(await page.evaluate(() => { const c = D.classes[0], w = c.works.find((x) => x.date === "2026-10-16"); return LYH.lyOf(c, c.analyses.find((a) => a.w === w.id)).out; }), 1);
      assert.equal(await page.locator(".ly-subj .seg button").count(), 2);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 1, `sahifa ekrandan ${overflow}px kengroq`);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}

test("Loyiha ishi: Taxminiy ball hamma shablonda faqat ruxsat etilgan qiymatlarni qo'yadi va jamiga teng (0..maks.)", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const bad = await page.evaluate(() => {
      const out = [];
      for (const t of LYH.TPL) for (const sb of t.subj) for (let T = 0; T <= t.max; T++) {
        const e = LYH.estimate(sb.crit, sb.crit.map(() => null), T, "tabiiy", "bosh", true, "Sinov " + T);
        if (!e) { out.push(`${t.id} ${T}: null`); continue; }
        const vals = sb.crit.map((c, i) => LYH.cval(c, e.cells[i]));
        if (sb.crit.some((c, i) => !LYH.optsOf(c).includes(vals[i]))) out.push(`${t.id} ${T}: ruxsatsiz`);
        if (Math.abs(vals.reduce((a, b) => a + b, 0) - e.sum) > 1e-9) out.push(`${t.id} ${T}: yig'indi`);
        // aniq yig'indi mumkin bo'lsa — aynan T; bo'lmasa eng yaqini
        if (LYH.estimate(sb.crit, sb.crit.map(() => null), T, "teng", "bosh", false, "x") && e.sum !== T) out.push(`${t.id} ${T}: ${e.sum}`);
      }
      return out;
    });
    assert.deepEqual(bad, []); assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Choraklar ajratilgan: oldingi chorak ma'lumoti yangi chorakka aralashmaydi (36 va 18 o'quvchi)", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    for (const [N, viewport] of [[36, {width: 1300, height: 900}], [18, {width: 390, height: 844}]]) {
      const page = await browser.newPage({viewport});
      const errors = []; page.on("pageerror", (e) => errors.push(e.message));
      await page.clock.setFixedTime(new Date(2026, 10, 9, 10, 0));   // 2-chorak (05.11 dan) 1-haftasi; 1-chorak 29.10 da tugagan va arxivlangan
      await page.goto(APP);
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
      await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
      await page.evaluate((N) => {
        const c = D.classes[0], base = c.students;
        c.students = Array.from({length: N}, (_, i) => ({...structuredClone(base[i % base.length]), name: i < base.length ? base[i].name : `${base[i % base.length].name} ${Math.floor(i / base.length) + 1}`}));
        D.settings.quarters[2] = ["2027-01-11", "2027-03-20"]; save(); ARX.tick(); render();
      }, N);
      assert.equal(await page.evaluate(() => D.classes[0].students.length), N);
      assert.ok(await page.evaluate(() => ARX.lockedQ(1)), "1-chorak arxivlangan");
      // «Bugun»: arxivlangan 1-chorak natijasi, «1-ch» qiymatlari va «1-chorakda «2» olganlar» yangi chorakda ko'rinmaydi
      assert.equal(await page.evaluate(() => BTL.mode(todayIso())), null);
      if (N === 18) await page.click("[data-btab=cls]");
      await page.waitForSelector(".clsstat");
      assert.equal(await page.locator(".bt-strip, .bt-was").count(), 0);
      assert.doesNotMatch(await page.innerText("main"), /1-ch[: ]|1-chorak natijasi|1-chorakda «2»/);
      if (N === 18) await page.click("[data-btab=todo]");
      // «Bajarish kerak»: faqat 2-chorak darslari (avval 1-chorak va ta'til kunlari ham chiqardi)
      const gaps = await page.evaluate(() => lessonGaps().map((x) => x.d));
      assert.ok(gaps.length > 0 && gaps.every((d) => d >= "2026-11-05"), gaps.join(" "));
      const todo = await page.locator(".bn-todo").first().innerText();
      assert.doesNotMatch(todo, /\d\d\.10\b/, "1-chorak sanalari Bajarish kerak ro'yxatida");
      // o'quvchi kartochkasi: oxirgi belgilar faqat joriy chorakdan
      await page.evaluate((N) => studentCard(0, D.classes[0].students[N - 1].name), N);
      const pills = await page.evaluate(() => [...document.querySelectorAll(".modal .pill")].map((x) => x.title));
      assert.ok(pills.every((t) => /\.(11|12)\.2026$/.test(t)), pills.join(" "));
      await page.click(".modal [data-x]");
      assert.deepEqual(await page.evaluate(() => [curQuarter(), workQuarter()]), [2, 2]);
      // ta'til (2-chorak tugagan, hali arxivlanmagan): ko'rinish va yangi ish — 2-chorak (avval 1-chorak edi)
      await page.clock.setFixedTime(new Date(2026, 11, 28, 10, 0));
      await page.evaluate(() => { S.sq = 0; ARX.tick(); render(); });
      assert.deepEqual(await page.evaluate(() => [ARX.lockedQ(2), viewQuarter(), curQuarter(), workQuarter()]), [false, 2, 2, 2]);
      // arxivlangandan keyin: yangi BSB arxivlangan 2-chorakka emas, 3-chorak boshiga tushadi
      await page.clock.setFixedTime(new Date(2027, 0, 5, 10, 0));
      await page.evaluate(() => { S.sq = 0; ARX.tick(); render(); });
      assert.deepEqual(await page.evaluate(() => [ARX.lockedQ(2), viewQuarter(), workQuarter()]), [true, 2, 3]);
      await page.evaluate(() => workDialog(D.classes[0]));
      assert.equal(await page.inputValue(".modal #wd"), "2027-01-11");
      await page.click(".modal [data-x]");
      // Bajarish kerak: ta'til kunidagi (30.10) va arxivlangan chorak darslari yo'q
      const todo2 = await page.locator(".bn-todo").first().innerText();
      assert.doesNotMatch(todo2, /\d\d\.12\b/, "arxivlangan 2-chorak sanalari Bajarish kerak ro'yxatida");
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 1);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});

test("Jurnal: oy ikki chorakka bo'linsa, o'rtacha va davomat faqat oxirgi chorakdan (36 va 18 o'quvchi)", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    for (const [N, viewport] of [[36, {width: 1300, height: 900}], [18, {width: 390, height: 844}]]) {
      const page = await browser.newPage({viewport});
      const errors = []; page.on("pageerror", (e) => errors.push(e.message));
      await page.clock.setFixedTime(new Date(2026, 9, 28, 10, 0));
      await page.goto(APP);
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
      await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
      const r = await page.evaluate((N) => {
        // 1-chorak 16.10 da tugaydi, 2-chorak 19.10 dan: oktyabr oyi ikki chorakka bo'linadi
        D.settings.quarters = [["2026-09-02", "2026-10-16"], ["2026-10-19", "2026-12-27"], null, null];
        const c = D.classes[0], base = c.students;
        c.students = Array.from({length: N}, (_, i) => ({...structuredClone(base[i % base.length]), name: i < base.length ? base[i].name : `${base[i % base.length].name} ${Math.floor(i / base.length) + 1}`}));
        const s = c.students[N - 1], q1 = c.dates.filter((d) => "2026-10-01" <= d && d <= "2026-10-16"), q2 = c.dates.filter((d) => "2026-10-19" <= d && d <= "2026-10-28");
        q1.forEach((d) => { s.marks[d] = "s"; }); q2.forEach((d) => { s.marks[d] = "9"; });
        save(); S.ci = 0; S.jpage = "j"; V.mode = "month"; V.anchor = "2026-10-28"; go("journal");
        const i = S.jord.indexOf(N - 1), ds = visDates(c);
        return {q1: q1.length, q2: q2.length, spans: ds.some((d) => d <= "2026-10-16") && ds.some((d) => d >= "2026-10-19"), i};
      }, N);
      assert.ok(r.q1 > 0 && r.q2 > 0 && r.spans, JSON.stringify(r));
      const row = await page.evaluate((N) => { const c = D.classes[0], ds = visDates(c), hi = ds.at(-1); return reportRows(c, qRange(quarterOf(hi))[0], hi).rows[N - 1]; }, N);
      assert.equal(row.att, 100, "1-chorakdagi sababsizlar oktyabr ko'rinishida 2-chorak davomatiga kirmaydi");
      assert.equal(row.avg, 9);
      // jurnalda «Davomat: pastdan» saralash ham shu qiymat bo'yicha: bu o'quvchi oxirgi o'ringa tushmaydi
      await page.evaluate(() => { S.jsort = "atta"; render(); });
      assert.notEqual(await page.evaluate((N) => S.jord[0], N), N - 1);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 1);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});

test("Ta'til: arxivlangan chorakdan keyin «joriy davr» — keyingi chorak, eski yo'qlama xavf belgisiga tushmaydi (36 va 18 o'quvchi)", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    for (const [N, viewport] of [[36, {width: 1300, height: 900}], [18, {width: 390, height: 844}]]) {
      const page = await browser.newPage({viewport});
      const errors = []; page.on("pageerror", (e) => errors.push(e.message));
      await page.clock.setFixedTime(new Date(2026, 10, 3, 10, 0));   // ta'til: 1-chorak 29.10 da tugagan va arxivlangan, 2-chorak 05.11 dan
      await page.goto(APP);
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
      await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
      const r = await page.evaluate((N) => {
        ARX.tick();
        const c = D.classes[0], base = c.students;
        c.students = Array.from({length: N}, (_, i) => ({...structuredClone(base[i % base.length]), name: i < base.length ? base[i].name : `${base[i % base.length].name} ${Math.floor(i / base.length) + 1}`}));
        // 30.10 — ta'til kuni (oy boshidan beri), 1-chorak oxiri: hammasi kelmagan (DQ)
        c.students.forEach((s) => { s.marks["2026-10-30"] = "dq"; s.marks["2026-10-28"] = "s"; });
        if (!c.dates.includes("2026-11-02")) { c.dates.push("2026-11-02"); c.dates.sort(); }
        c.students[N - 1].marks["2026-11-02"] = "dq";   // oy boshidagi ta'til kuni ham hisobga kirmasin
        save(); render();
        const [lo, hi, q] = periodNow(), row = reportRows(c, lo, hi, q).rows[N - 1];
        return {q, locked: ARX.lockedQ(1), absent: row.absent, why: row.why, risk: riskOverview().length};
      }, N);
      assert.equal(r.locked, true);
      assert.equal(r.q, 2, "joriy davr — 2-chorak");
      assert.equal(r.absent, 0); assert.deepEqual(r.why, []); assert.equal(r.risk, 0);
      // o'quvchi kartochkasi: «2-chorak», davomat xavfi yo'q
      await page.evaluate((N) => studentCard(0, D.classes[0].students[N - 1].name), N);
      const txt = await page.locator(".modal").innerText();
      assert.match(txt, /2-chorak/i); assert.doesNotMatch(txt, /davomat 0%|joriy oy/i);
      await page.click(".modal [data-x]");
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});

test("ikki oyna: biri saqlagan baho ikkinchisida yo'qolmaydi", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const ctx = await browser.newContext({viewport: {width: 1440, height: 900}});
    const a = await ctx.newPage(), errors = [];
    a.on("pageerror", (e) => errors.push(e.message));
    await a.clock.setFixedTime(new Date(2026, 9, 20, 10, 0));
    await a.goto(APP);
    const [chooser] = await Promise.all([a.waitForEvent("filechooser"), a.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE);
    await a.waitForSelector(".bn-hd");
    const b = await ctx.newPage(); b.on("pageerror", (e) => errors.push(e.message));
    await b.clock.setFixedTime(new Date(2026, 9, 20, 10, 0));
    await b.goto(APP); await b.waitForSelector(".bn-hd");
    // B oynada baho qo'yildi → A oyna o'zi yangilanadi
    await b.evaluate(() => { D.classes[0].students[0].marks["2026-10-20"] = "9"; save(); });
    await a.waitForFunction(() => D.classes[0].students[0].marks["2026-10-20"] === "9", null, {timeout: 5000});
    // A oyna yangilanishni olmagan bo'lsa (masalan, oyna ochiq dialog bilan band edi): eski nusxa B ning bahosini bosib ketmaydi
    await b.evaluate(() => { D.classes[0].students[1].marks["2026-10-20"] = "s"; save(); });
    // A oynaning o'z o'zgarishi ham yo'qolmaydi: ikkala oyna katak darajasida birlashtiriladi; bir katakni ikkalasi o'zgartirsa — A niki (oxirgisi)
    await b.evaluate(() => { D.classes[0].students[3].marks["2026-10-20"] = "5"; save(); });
    await a.evaluate(() => { BASE_REV = 0; D.classes[0].students[2].marks["2026-10-20"] = "7"; D.classes[0].students[3].marks["2026-10-20"] = "8"; save(); });
    const stored = () => a.evaluate(() => JSON.parse(localStorage.getItem(STORE_KEY)).classes[0].students.map((s) => s.marks["2026-10-20"] || "").slice(0, 4).join(","));
    await a.waitForFunction(() => JSON.parse(localStorage.getItem(STORE_KEY)).classes[0].students[2].marks["2026-10-20"] === "7", null, {timeout: 5000});
    assert.equal(await stored(), "9,s,7,8", "B oynaning baholari ham, A oynaning o'zgarishi ham saqlandi");
    assert.equal(await a.evaluate(() => D.classes[0].students[1].marks["2026-10-20"]), "s", "A oyna yangi holatni oldi");
    await b.waitForFunction(() => D.classes[0].students[2].marks["2026-10-20"] === "7", null, {timeout: 5000});
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Telegram: ikki qurilmada o'zgarish bo'lsa — «Birlashtirish», ikkalasidagi baholar saqlanadi (sinx.js)", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}}), errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.clock.setFixedTime(new Date(2026, 9, 20, 10, 0));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE);
    await page.waitForSelector(".bn-hd");
    await page.waitForFunction(() => IDB.ready);
    await page.evaluate(async () => {
      // oxirgi almashish: shu holat; keyin bu qurilmada 1-o'quvchiga, boshqa qurilmada 2-o'quvchiga baho qo'yilgan
      await SINX.setBase(JSON.stringify(D)); tgSet({hash: djbData()});
      const remote = JSON.parse(JSON.stringify(D)); remote.classes[0].students[1].marks["2026-10-20"] = "7";
      window.tgData = async () => remote; window.tgBackup = async () => true;
      batch(() => { D.classes[0].students[0].marks["2026-10-20"] = "9"; save(); });
      TG_NEW = {date: Date.now() / 1000, message_id: 99}; render();
    });
    await page.click("[data-tg=tgmerge]");
    await page.waitForFunction(() => !TG_NEW);
    assert.deepEqual(await page.evaluate(() => [D.classes[0].students[0].marks["2026-10-20"], D.classes[0].students[1].marks["2026-10-20"]]), ["9", "7"]);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

/* «Chorak devori» (Akmal, 2026-11-08: «o'quv yili — papka, har chorak — alohida fayl, faqat sinf va o'quvchilar umumiy»):
   boshqa choraklarga tasodifiy baho, yo'qlama, mavzu, uy vazifasi, BSB/CHSB/Loyiha ballari va chorak baholari yoziladi —
   tanlangan chorakning jurnali, Umumiy, Summativ, barcha hisobotlari, xavf belgilari va chorak natijalari bir belgi ham o'zgarmasligi kerak.
   Yil bo'yicha bo'lishi kerak bo'lganlar tekshirilmaydi: «Yillik» sahifasi va KTR dars raqami («44-dars» — yillik rejadagi tartib). */
test("Chorak devori: boshqa choraklar o'zgarsa, tanlangan chorak hech narsasi o'zgarmaydi (36 va 18 o'quvchi)", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    // [o'quvchilar, ekran, bugungi sana, tekshiriladigan chorak, o'zgartiriladigan choraklar]
    const CASES = [[36, {width: 1300, height: 900}, [2026, 10, 20], 2, [1, 3]], [18, {width: 390, height: 844}, [2026, 10, 20], 2, [1, 3]],
      [36, {width: 1300, height: 900}, [2026, 10, 20], 1, [2, 3]], [18, {width: 390, height: 844}, [2026, 11, 26], 2, [1, 3]]];
    for (const [N, viewport, [y, mo, d], tq, others] of CASES) {
      const page = await browser.newPage({viewport});
      const errors = []; page.on("pageerror", (e) => errors.push(e.message)); page.on("dialog", (x) => x.accept());
      await page.clock.setFixedTime(new Date(y, mo, d, 10, 0));
      await page.goto(APP);
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
      await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
      await page.evaluate((N) => {
        D.settings.quarters[2] = ["2027-01-11", "2027-03-20"]; D.settings.quarters[3] = ["2027-03-29", "2027-05-25"];
        for (const c of D.classes) { const base = c.students;
          c.students = Array.from({length: N}, (_, i) => ({...structuredClone(base[i % base.length]), id: undefined, name: i < base.length ? base[i].name : `${base[i % base.length].name} ${Math.floor(i / base.length) + 1}`})); }
        D = normalize(D); autoDates(); save(); ARX.tick(); render();
      }, N);
      const snap = () => page.evaluate((tq) => {
        const out = {}, now = quarterOf(todayIso()) === tq;
        const txt = () => ((document.querySelector("main") || document.body).innerText + "\n" + [...document.querySelectorAll(".modal")].map((x) => x.innerText).join("\n")).replace(/\b\d+-dars\b/g, "N-dars");
        const view = (k, fn) => { fn(); render(); out[k] = txt(); };
        if (now) view("bugun", () => go("today"));
        D.classes.forEach((c, ci) => {
          view(`jurnal ${ci}`, () => { S.page = "journal"; S.ci = ci; S.jpage = "j"; V.mode = "quarter"; V.anchor = now ? todayIso() : qRange(tq)[1]; });
          view(`umumiy ${ci}`, () => { S.page = "journal"; S.ci = ci; S.jpage = "sum"; S.sq = tq; });
          for (const t of ["bsb", "chsb", "loyiha"]) view(`summativ ${t} ${ci}`, () => { S.page = "journal"; S.ci = ci; S.jpage = "sm"; S.sq = tq; S.smt = t; S.smw = null; });
          for (const k of ["cls", "stats", "att", "sum", "ready", "par", "cmp"].concat(now ? ["blank"] : [])) view(`hisobot ${k} ${ci}`, () => { S.page = "reports"; S.rep.kind = k; S.rep.ci = ci; S.rep.per = "q" + tq; });
          if (now) { S.page = "journal"; S.jpage = "j"; S.ci = ci; render(); studentCard(ci, c.students.at(-1).name); out[`kartochka ${ci}`] = txt(); document.querySelectorAll(".modal [data-x]").forEach((b) => b.click()); }
          // kartochkada chorak tanlovi: tanlangan chorak (Umumiy va Ota-onaga xabar)
          for (const tb of ["sum", "msg"]) { S.page = "journal"; S.jpage = "j"; S.ci = ci; render(); studentCard(ci, c.students.at(-1).name, tb, tq); out[`kartochka ${tq}-chorak ${tb} ${ci}`] = txt() + ($(".modal #pm") || {}).value; document.querySelectorAll(".modal [data-x]").forEach((b) => b.click()); }
          const [lo, hi] = qRange(tq), top = hi < todayIso() ? hi : todayIso();
          out[`hisob ${ci}`] = JSON.stringify({r: reportRows(c, lo, top, tq).rows, q: c.students.map((s) => quarterResult(c, s, tq, worksInQuarter(c, tq))), rd: readiness(c, tq)});
        });
        if (now) out.gaps = JSON.stringify(lessonGaps().map((x) => [x.ci, x.d, x.noAtt, x.noTopic]));
        return out;
      }, tq);
      const before = await snap();
      await page.evaluate((others) => {
        let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, pick = (a) => a[Math.floor(rnd() * a.length)];
        const MK = ["2", "3", "5", "7", "8/9", "10", "s", "dq", "k", "kq", "kq9", "ch", ""];
        for (const c of D.classes) for (const q of others) {
          const r = qRange(q);
          for (let x = pdate(r[0]); iso(x) <= r[1]; x = addDays(x, 1)) { const s = iso(x); if (pyWd(s) < 6 && rnd() < 0.5 && !c.dates.includes(s)) c.dates.push(s); }
          c.dates.sort();
          for (const dt of c.dates) {
            if (quarterOf(dt) !== q) continue;
            c.students.forEach((s) => { s.marks[dt] = pick(MK); (s.hwd = s.hwd || {})[dt] = rnd() < 0.5 ? 1 : 0; (s.act = s.act || {})[dt] = [1, 0]; });
            c.lessons[dt] = {topic: "BEGONA " + dt, hw: "begona uy vazifasi"}; if (!c.att_ok.includes(dt)) c.att_ok.push(dt);
          }
          for (const [type, max] of [["bsb", 25], ["chsb", 40], ["loyiha", 25], ["bsb", 25]]) {
            const id = "z" + Math.floor(rnd() * 1e9), date = pick(c.dates.filter((dt) => quarterOf(dt) === q)) || r[0];
            c.works.push({id, type, date, max, title: "BEGONA " + type});
            c.students.forEach((s) => { (s.scores = s.scores || {})[id] = Math.round(rnd() * max); s.scores[`final:q${q}`] = pick([2, 3, 4, 5]); });
          }
        }
        save(); render();
      }, others);
      const after = await snap();
      const bad = Object.keys(before).filter((k) => before[k] !== after[k]).map((k) => {
        const a = before[k].split("\n"), b = after[k].split("\n"), sa = new Set(a), sb = new Set(b);
        return `${k}: −[${a.filter((l) => !sb.has(l)).slice(0, 4).join(" | ")}] +[${b.filter((l) => !sa.has(l)).slice(0, 4).join(" | ")}]`;
      });
      assert.deepEqual(bad, [], `${N} o'quvchi, ${tq}-chorak: boshqa chorak ma'lumoti aralashdi`);
      assert.ok(Object.keys(before).length >= 40);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});

// Kriterial (+/−) formativ baho (kriterial.js): 1 + darsdagi ish 5 deskriptor + uy vazifasi 4 deskriptor = 1–10
for (const [name, viewport, n] of [["kompyuter", {width: 1440, height: 900}, 36], ["kompyuter", {width: 1440, height: 900}, 18], ["telefon", {width: 390, height: 844}, 36], ["telefon", {width: 390, height: 844}, 18]]) {
  test(`${name}: kriterial (+/−) formativ baho, davomat, deskriptorlar, chop etish (${n} o'quvchi)`, async () => {
    const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
    try {
      const page = await browser.newPage({viewport});
      const errors = []; page.on("pageerror", (e) => errors.push(e.message));
      await page.clock.setFixedTime(new Date(2026, 9, 20, 10, 0));
      await page.goto(APP);
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
      await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
      const t = await page.evaluate((n) => { const c = D.classes[0], t = todayIso(); D.settings.method_weekday = null; c.extra_x = [];
        if (!c.dates.includes(t)) { c.dates.push(t); c.dates.sort(); } D.settings.protect.enabled = false;
        while (c.students.length < n) c.students.push({id: "kr" + c.students.length, name: `Sinov O'quvchi ${c.students.length + 1}`, marks: {}, scores: {}});
        c.students.length = n; for (const s of c.students) { delete s.marks[t]; delete s.joined; }
        D.web.fmode = "krit"; S.ci = 0; V.mode = "day"; V.anchor = t; save();
        window.print = () => { window.__printed = document.getElementById("pdoc").textContent; }; return t; }, n);
      await page.click(`${viewport.width < 600 ? ".tabbar" : ".side"} [data-go=journal]`);
      await page.evaluate((d) => { S.ci = 0; V.mode = "day"; V.anchor = d; render(); }, t);
      await page.waitForSelector(".dlist.kr .kr-box");
      const st = (i) => page.evaluate(([d, i]) => { const s = D.classes[0].students[i]; return [s.marks[d] || "", (s.fk || {})[d] || "", JSON.stringify((s.fp || {})[d] || null)]; }, [t, i]);
      const tel = viewport.width < 600;
      assert.equal(await page.locator("[data-mzmode=krit].on").count(), 1, "«Kriterial (+/−)» tanlangan");
      if (tel) {   // telefonda sukut bo'yicha «Ro'yxat»: har o'quvchi kartochkada; eski oqim «Jadval»da tekshiriladi
        assert.equal(await page.locator(".kr-lv .kr-lc0[data-krr]").count(), n, "hamma o'quvchi ro'yxatda");
        assert.equal(await page.locator(".kr-lc0[data-krr='0'] [data-krc]").count(), 9);
        await page.click("[data-krv=tab]"); await page.waitForSelector(".kr-t");
      }
      assert.equal(await page.locator(".kr-t tbody tr[data-krr]").count(), n, "hamma o'quvchi jadvalda");
      // bitta katak: + (chala — baho yo'q), keyin qator menyusi «Bo'sh kataklarga +» → 10
      await page.click("[data-krc='0|0']");
      assert.deepEqual(await st(0), ["", "+........", "null"]);
      assert.match(await page.textContent('tr[data-krr="0"] td.tot'), /chala/);
      await page.click("[data-krrow='0']"); await page.click(".kr-pop [data-v=p]");
      assert.deepEqual(await st(0), ["10", "+++++++++", "[6,4]"]);
      // + → − : 9 (6 + 3)
      await page.click("[data-krc='0|8']");
      assert.deepEqual(await st(0), ["9", "++++++++-", "[6,3]"]);
      assert.match(await page.textContent('tr[data-krr="0"] td.tot'), /6 \+ 3/);
      if (!tel) {
        // klaviatura: − yozilsa keyingi o'quvchiga o'tadi
        await page.focus("[data-krc='1|0']"); await page.keyboard.press("-"); await page.keyboard.press("+");
        assert.equal((await st(1))[1], "-........"); assert.equal((await st(2))[1], "+........");
        assert.equal(await page.evaluate(() => document.activeElement.dataset.krc), "3|0");
        await page.keyboard.press("Delete"); await page.keyboard.press("ArrowUp"); await page.keyboard.press("Delete");
        assert.equal((await st(2))[1], "");
      }
      // davomat: S — baho qo'yilmaydi; KQ — baho bilan birga
      await page.click("[data-a='3|s']");
      assert.equal((await st(3))[0], "s");
      assert.equal(await page.locator("[data-krc^='3|']").count(), 0);
      assert.match(await page.textContent('tr[data-krr="3"]'), /Sababsiz kelmadi — baho qo'yilmaydi/);
      assert.match(await page.textContent(".kr-att"), new RegExp(`Keldi ${n - 1} / ${n}`));
      await page.click("[data-a='0|kq']"); assert.equal((await st(0))[0], "9kq");
      await page.click("[data-krc='0|8']"); assert.deepEqual(await st(0), ["kq", "++++++++.", "null"]);
      // ustun menyusi: U1 bo'sh kataklarga +
      await page.click("th[data-krcol='5']"); await page.click(".kr-pop [data-v=p]");
      assert.equal((await st(4))[1], ".....+...");
      assert.equal((await st(3))[1], "", "kelmagan o'quvchiga tegilmaydi");
      // hammasi: bo'sh kataklarga +
      await page.click("[data-krall]");
      assert.deepEqual(await st(4), ["10", "+++++++++", "[6,4]"]);
      assert.deepEqual(await st(0), ["10kq", "+++++++++", "[6,4]"]);
      assert.equal(await page.evaluate((d) => D.classes[0].students.filter((s) => /^\d/.test(s.marks[d] || "")).length, t), n - 1, "kelmagandan boshqa hammaga baho");
      // «Mezon bo'yicha» rejimi xuddi shu qismlarni ko'radi; «Oddiy» bilan o'zgartirilgan baho kriterialda «boshqa usul»
      await page.click("[data-mzmode=crit]"); await page.waitForSelector(".dlist.mz");
      assert.match(await page.textContent('.drow[data-dr="4"] .mz-tot'), /6 \+ 4/);
      await page.click("[data-mzp='5|0|5']"); assert.deepEqual(await st(5), ["9", "", "[5,4]"], "mezon bo'yicha o'zgartirilsa eski +/− belgilar o'chadi");
      await page.click("[data-mzmode=plain]"); await page.click("[data-g='4|7']");
      await page.click("[data-mzmode=krit]"); await page.waitForSelector(".dlist.kr");
      assert.match(await page.textContent('tr[data-krr="4"] td.tot'), /7\s*boshqa usul/);
      assert.equal(await page.locator("[data-krc='4|0'].e").count(), 1);
      // boshqa usuldagi bahoga tasodifan tegilmaydi; faqat «Bahoni o'chirish» bilan
      await page.click("[data-krc='4|0']"); assert.equal((await st(4))[0], "7"); assert.match(await page.textContent(".toast"), /boshqa usulda/);
      await page.click("th[data-krcol='1']"); await page.click(".kr-pop [data-v=p]"); assert.equal((await st(4))[0], "7", "ustun to'ldirish ham tegmaydi");
      await page.click("[data-krrow='4']"); await page.click(".kr-pop [data-v=clr]"); assert.deepEqual(await st(4), ["", "", "null"]);
      // ↶ bekor qilish belgilarni ham qaytaradi: 10 → 9 → ↶ → 10 (+++++++++)
      await page.click("[data-krrow='4']"); await page.click(".kr-pop [data-v=allp]"); await page.click("[data-krc='4|2']");
      assert.deepEqual(await st(4), ["9", "++-++++++", "[5,4]"]);
      await page.evaluate(() => undoLast()); await page.waitForFunction((d) => D.classes[0].students[4].marks[d] === "10", t);
      assert.deepEqual(await st(4), ["10", "+++++++++", "[6,4]"]);
      assert.match(await page.textContent('tr[data-krr="4"] td.tot'), /6 \+ 4/);
      // deskriptorlar matni (sinf bo'yicha)
      await page.click("[data-kred]"); await page.fill("#kr-d0", "Darsda savol berdi"); await page.click(".modal [data-ok]");
      assert.equal(await page.evaluate(() => D.classes[0].kd[0]), "Darsda savol berdi");
      assert.match(await page.getAttribute("th[data-krcol='0']", "title"), /Darsda savol berdi/);
      // chop etish / Telegram oynasi: oldindan ko'rish, bo'sh va to'ldirilgan varaq, PDF tugmasi
      await page.click("[data-krpr]"); await page.waitForSelector(".krp-pv .bx-pg.krp");
      let pv = await page.textContent(".krp-pv");
      assert.match(pv, /Darsda savol berdi/); assert.match(pv, /«\+» ulushi/); assert.match(pv, /Keldi:/); assert.match(pv, /O'qituvchi:/);
      assert.ok(await page.$(".kr-pdlg [data-ktg]"), "Telegram tugmasi bor");
      await page.click(".kr-pdlg [data-kv=blank]"); await page.waitForTimeout(50);
      pv = await page.textContent(".krp-pv");
      assert.ok(!/«\+» ulushi/.test(pv), "bo'sh varaqda xulosa yo'q"); assert.match(pv, /202__-y/);
      await page.click(".kr-pdlg [data-kv=fill]"); await page.waitForTimeout(50);
      await page.click(".kr-pdlg [data-kpr]");
      const pr = await page.evaluate(() => window.__printed || document.getElementById("pdoc").textContent);
      assert.match(pr, /Formativ baholash varaqasi/); assert.match(pr, /Darsda savol berdi/); assert.match(pr, /«\+» ulushi/);
      assert.ok((await page.locator("#pdoc .bx-pg.bx-land").count()) === 1, "bitta albom varaq");
      await page.click(".kr-pdlg [data-x]");
      // telefon: o'quvchi va deskriptor rejimlari
      if (tel) {
        await page.click("[data-krv=stu]"); await page.waitForSelector("[data-krset]");
        await page.selectOption("[data-krstusel]", "1"); await page.click("[data-krset='1|0|m']");
        assert.equal((await st(1))[1], "-++++++++"); assert.equal((await st(1))[0], "9");
        await page.click("[data-krv=des]"); await page.click("[data-krset='1|0|m']");
        assert.equal((await st(1))[1], ".++++++++");
        await page.click("[data-krcolfill='0|p']"); assert.equal((await st(1))[0], "10");
        await page.click("[data-krv=tab]");
      }
      // v5: chala ogohlantirishi — «Chalalarning bo'shiga −» bilan yopiladi
      if (tel) { await page.click("[data-krv=list]"); await page.waitForSelector(".kr-lv"); }
      await page.click("[data-krrow='5']"); await page.click(".kr-pop [data-v=clr]"); await page.click("[data-krc='5|0']");
      assert.deepEqual(await st(5), ["", "+........", "null"]);
      assert.match(await page.textContent(".kr-wb"), /chala: 1 ta/);
      await page.click("[data-krchm]");
      assert.deepEqual(await st(5), ["2", "+--------", "[2,0]"]);
      assert.equal(await page.locator(".kr-wb").count(), 0); assert.equal(await page.locator(".kr-okb").count(), 1);
      if (tel) {   // ro'yxat: katak bosiladi, davomat tugmalari kartochka ichida ochiladi
        await page.click("[data-krc='5|8']"); assert.deepEqual(await st(5), ["", "+-------.", "null"]);
        await page.click("[data-krc='5|8']"); assert.equal((await st(5))[0], "3");
        await page.click("[data-kratt='6']"); await page.waitForSelector(".kr-lc0[data-krr='6'] .kr-la [data-a='6|k']");
        await page.click("[data-a='6|k']"); assert.equal((await st(6))[0], "k");
        assert.match(await page.textContent(".kr-lc0[data-krr='6']"), /baho qo'yilmaydi/);
        await page.click("[data-a='6|k']"); assert.equal((await st(6))[0], "");
        await page.click("[data-krrow='6']"); await page.click(".kr-pop [data-v=allp]"); assert.equal((await st(6))[0], "10");
      }
      // ota-onaga xabar (bugungi baho)
      await page.click("[data-krrow='4']"); await page.click(".kr-pop [data-v=msg]"); await page.waitForSelector(".modal .kr-msg");
      const msg = await page.inputValue(".modal .kr-msg");
      assert.match(msg, /Hurmatli ota-ona!/); assert.match(msg, /10 baho oldi \(darsdagi ish 6\/6, uy vazifasi 4\/4\)/);
      await page.click(".modal [data-x]");
      // fan shablonlari
      await page.click("[data-kred]"); await page.click(".modal [data-krtpl='1']");
      assert.equal(await page.inputValue("#kr-d0"), "Yangi mavzuni tushunib, savollarga javob beradi");
      await page.click(".modal [data-x]");
      // chorak tahlili: shu chorakdagi oldingi darslarga ham kriterial baho
      const qd = await page.evaluate((t) => { const c = D.classes[0], q = quarterOf(t), ds = c.dates.filter((x) => x < t && quarterOf(x) === q && !isNoLesson(c, x)).slice(-5);
        ds.forEach((x, li) => c.students.forEach((s, si) => { if (si === 2 && li === 0) { s.marks[x] = "s"; return; }
          const a = [...Array(9)].map((_, k) => (si * 7 + k * 3 + li) % 5 === 0 ? "-" : "+"), dd = 1 + a.slice(0, 5).filter((v) => v === "+").length, uu = a.slice(5).filter((v) => v === "+").length;
          s.marks[x] = String(dd + uu); (s.fk = s.fk || {})[x] = a.join(""); (s.fp = s.fp || {})[x] = [dd, uu]; }));
        save(); render(); return ds.length; }, t);
      assert.ok(qd >= 3, `chorakda oldingi darslar: ${qd}`);
      await page.waitForSelector(".kr-box"); await page.click("[data-krtab=q]"); await page.waitForSelector(".kr-hq");
      assert.equal(await page.locator(".kr-hq tbody tr[data-krprof]").count(), n);
      const tiles = await page.textContent(".kr-tiles"); assert.match(tiles, new RegExp(`Kriterial baholangan darslar${qd + 1}`));
      await page.click(".kr-hq tbody tr[data-krprof='2']"); await page.waitForSelector(".modal .kr-msg");
      assert.match(await page.inputValue(".modal .kr-msg"), new RegExp(`chorakdagi .*o'rtacha [0-9.]+ \\(${qd} ta dars, 1 ta darsda qatnashmagan\\)`));
      await page.click(".modal [data-x]");
      await page.click("[data-krqall]"); await page.waitForSelector(".modal .kr-qm");
      assert.equal(await page.locator(".modal .kr-qm").count(), n);
      await page.click(".modal [data-x]");
      await page.click("[data-krtab=day]"); await page.waitForSelector(".kr-att");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 1, `sahifa ekrandan ${overflow}px kengroq`);
      // saqlanib qayta yuklanganda belgilar qoladi; buzilgan ma'lumot tozalanadi
      await page.reload(); await page.waitForFunction(() => S.page === "journal");
      assert.deepEqual(await st(0), ["10kq", "+++++++++", "[6,4]"]);
      assert.deepEqual(await page.evaluate(() => { const s = {fk: {"2026-10-20": "++", "x": "+++++++++", "2026-10-21": "........."}}, s2 = {fk: {"2026-10-20": "+-+-+-+-."}}; KRT.clean(s); KRT.clean(s2);
        const c = {kd: ["a", "", 5, "d", "e", "f", "g", "h", "i"]}, c2 = {kd: ["x"]}; KRT.cleanCls(c); KRT.cleanCls(c2); return [s.fk, s2.fk, c.kd[1], c.kd[2], c2.kd]; }),
        [undefined, {"2026-10-20": "+-+-+-+-."}, "Savollarga to'g'ri javob beradi", "5", undefined]);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}

test("Yo'qlama: «CH» (chet elda) — darsda, Kun sahifasida, davomat foizi va kunlik hisobotda (36 va 18 o'quvchi)", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    for (const N of [36, 18]) for (const [name, viewport] of [["kompyuter", {width: 1280, height: 860}], ["telefon", {width: 360, height: 780}]]) {
      const page = await browser.newPage({viewport});
      const errors = []; page.on("pageerror", (e) => errors.push(e.message));
      await page.clock.setFixedTime(new Date(2026, 9, 20, 10, 0));
      await page.goto(APP);
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
      await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
      await page.evaluate((N) => {
        const t = todayIso(), c = D.classes[0], base = c.students[0];
        for (let i = c.students.length; i < N; i++) c.students.push(Object.assign(JSON.parse(JSON.stringify(base)), {name: `Sinovov O'quvchi ${i + 1}`, marks: {}}));
        c.students.length = N;
        if (!c.dates.includes(t)) { c.dates.push(t); c.dates.sort(); } c.extra_x = c.extra_x.filter((d) => d !== t); c.held.push(t);
        c.att_ok = c.att_ok.filter((d) => d !== t); c.students.forEach((s) => delete s.marks[t]);
        D.settings.protect.enabled = false; save(); startLesson(0);   // «Hammasi keldi» qo'yilgan belgini o'chira olsin
      }, N);
      // «Darsni boshlash» → ro'yxat: CH tugmasi; sarlavhada chet eldagi o'quvchi «keldi»ga kirmaydi
      await page.click('[data-att="0|ch"]');
      await page.click('[data-att="1|s"]');
      const mk = () => page.evaluate(() => D.classes[0].students.slice(0, 3).map((s) => s.marks[todayIso()] || ""));
      assert.deepEqual(await mk(), ["ch", "s", ""]);
      assert.ok((await page.textContent("h1")).includes(`${N - 2} / ${N} keldi`), await page.textContent("h1"));
      assert.match(await page.textContent(".foot"), /Kelmagan: 1 · chet elda: 1/);
      // klaviatura: C — chet elda
      await page.evaluate(() => { S.cur = 2; });
      await page.keyboard.press("c");
      assert.deepEqual(await mk(), ["ch", "s", "ch"]);
      // «Hammasi keldi» faqat S/DQ/K ni tozalaydi — chet eldagilar qoladi
      await page.click("[data-all]");
      assert.deepEqual(await mk(), ["ch", "", "ch"]);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(over <= 1, `${name} ${N}: dars sahifasi ekrandan ${over}px kengroq`);
      // baholar qadamida chet eldagi o'quvchiga baho qo'yilmaydi
      await page.click("[data-next]");
      assert.ok(await page.locator('[data-gr="0|8"]').isDisabled());
      assert.ok((await page.locator(".lrow").first().textContent()).includes("(chet elda)"));
      // kartochka rejimi: «Chet elda» tugmasi
      await page.click('[data-step="0"]'); await page.click('[data-am="card"]');
      await page.evaluate(() => { S.cur = 3; render(); });
      await page.click('[data-sw="ch"]');
      assert.equal(await page.evaluate(() => D.classes[0].students[3].marks[todayIso()]), "ch");
      await page.click('[data-am="list"]');
      // Kun sahifasi: CH tugmasi, «Keldi» soni
      await page.evaluate(() => { S.ci = 0; V.mode = "day"; V.anchor = todayIso(); S.page = "journal"; render(); });
      await page.waitForSelector('.da[data-a="4|ch"]');
      await page.click('.da[data-a="4|ch"]');
      assert.equal(await page.evaluate(() => D.classes[0].students[4].marks[todayIso()]), "ch");
      assert.ok(await page.locator('.da[data-a="4|ch"]').evaluate((b) => b.classList.contains("on")));
      assert.match(await page.textContent(".dstats"), new RegExp(`Keldi\\s*${N - 4} / ${N}`));
      await page.click('.da[data-a="4|ch"]');   // qayta bosish — belgi olinadi
      assert.equal(await page.evaluate(() => D.classes[0].students[4].marks[todayIso()] || ""), "");
      const over2 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(over2 <= 1, `${name} ${N}: Kun sahifasi ekrandan ${over2}px kengroq`);
      // davomat foizi: chet eldagi kun hisobdan chiqadi (qoldirish emas); kunlik hisobot
      const r = await page.evaluate(() => {
        const c = D.classes[0], t = todayIso(), [lo, hi] = qRange(quarterOf(t)), s0 = c.students[0];
        const row = () => { EPOCH++; return reportRows(c, lo, hi, null).rows[0]; };
        const a = row(); s0.marks[t] = ""; const b = row(); s0.marks[t] = "ch"; save();
        return {a: [a.absent, a.ch, a.att], b: [b.absent, b.ch], k: KRJ.stats(KUN.build(c, t, [])), cap: KUN.caption(KUN.build(c, t, []))};
      });
      assert.equal(r.a[0], r.b[0], "chet elda — qoldirish emas"); assert.equal(r.a[1], r.b[1] + 1);
      assert.equal(r.k.ch, 3); assert.equal(r.k.came, N - 3);   // 0, 2, 3-o'quvchilar chet elda assert.equal(r.k.pct, 100);
      assert.match(r.cap, /\(chet elda\)/);
      assert.deepEqual(errors, [], `${name} ${N}`);
      await page.close();
    }
  } finally { await browser.close(); }
});

test("Ota-onalar eMaktab'i: jadvalga login/parol, kirib chiqish, aylanib chiqish, PIN, Excel'dan; parol va sahifa mazmuni saqlanmaydi (36 va 18 o'quvchi)", async () => {
  const loginPage = `<html><body><form action="/login" method="post"><input name="login" type="text"><input name="password" type="password"><button type="submit">Kirish</button></form></body></html>`;
  const home = `<html><body><a href="/diary">Kundalik</a> <a href="/marks">Baholar</a> <a href="/messages">Xabarlar</a> <div>Baho: 5</div><form action="/logout"></form></body></html>`;
  const st = {valid: new Set(), posts: [], seen: []};
  const G = makeGas({emk: (url, opt) => {
    const u = new URL(url), sid = (((opt.headers || {}).Cookie || "").match(/sess=([\w-]+)/) || [])[1];
    if (u.host === "login.emaktab.uz" && u.pathname === "/") return {status: 200, headers: {"Content-Type": "text/html"}, body: loginPage};
    if (u.host === "login.emaktab.uz" && u.pathname === "/login") {
      const f = Object.fromEntries(new URLSearchParams(opt.payload)); st.posts.push(f.login);
      if (f.login === "ota2fa") return {status: 302, headers: {Location: "/login/2fa-verification"}};
      if (f.password !== "p-" + f.login) return {status: 200, headers: {"Content-Type": "text/html"}, body: loginPage};
      st.valid.add(f.login);
      return {status: 302, headers: {Location: "https://schools.emaktab.uz/userfeed", "Set-Cookie": [`sess=${f.login}; domain=.emaktab.uz; path=/`]}};
    }
    if (u.pathname.startsWith("/login/2fa")) return {status: 200, headers: {"Content-Type": "text/html"}, body: "<div id=root></div>"};
    if (!st.valid.has(sid)) return {status: 302, headers: {Location: "https://login.emaktab.uz/"}};
    st.seen.push(`${sid}${u.pathname}`);
    return {status: 200, headers: {"Content-Type": "text/html"}, body: home};
  }});
  const GAS = "https://script.google.com/macros/s/TEST/exec";
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    for (const vp of [{width: 390, height: 844}, {width: 1280, height: 800}]) {
      st.valid.clear(); st.posts.length = 0; st.seen.length = 0;
      const ctx = await browser.newContext({viewport: vp});
      await ctx.addInitScript((u) => localStorage.setItem("yoqlama_tgu_url", u), GAS);
      await ctx.route(/emaktab\.uz/, (rt) => rt.abort());
      await ctx.route("https://script.google.com/**", (rt) => { const rq = rt.request();
        return rt.fulfill({status: 200, contentType: "application/json", headers: {"access-control-allow-origin": "*"}, body: G.handle(rq.method(), rq.url(), rq.postData())}); });
      const page = await ctx.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(APP);
      await page.evaluate(() => { const mk = (n) => Array.from({length: n}, (_, i) => ({name: `Talaba${i + 1} Ism${i + 1}`, marks: {}}));
        D = normalize({classes: [{name: "6-A", subject: "Matematika", dates: [], students: mk(36)}, {name: "9-A", subject: "Час будущего", dates: [], students: mk(18)},
          {name: "6-a", subject: "kelajak  soati", dates: [], students: mk(36)}, {name: "10-B", subject: "Fizika", dates: [], students: mk(18)}]}); save(); S.ci = 0; go("journal"); });
      const sum = () => page.$$eval(".ot-sum b", (x) => x.map((e) => e.textContent).join(" | "));
      const done = async () => { await page.waitForSelector(".modal >> text=Ilovada faqat «Oxirgi kirish»", {timeout: 20000}); const t = await page.$$eval(".ot-res b", (x) => x.map((e) => e.textContent)); await page.click(".modal:last-child [data-x]"); return t; };
      // sukut bo'yicha o'chiq: sinf menyusida yo'q; Sozlamalar → Funksiyalar → «eMaktab» guruhida yoqiladi
      await page.click("[data-more]");
      assert.equal(await page.locator(".modal >> text=eMaktab'ga kirish").count(), 0);
      await page.click(".modal [data-x]");
      await page.evaluate(() => { S.sec = 6; go("settings"); });
      assert.equal(await page.getAttribute('.fn-sec [data-ft="otaemk"]', "aria-checked"), "false");
      await page.click('.fn-sec [data-ft="otaemk"]');
      assert.equal(await page.getAttribute('.fn-sec [data-ft="otaemk"]', "aria-checked"), "true");
      assert.deepEqual(await page.evaluate(() => D.web.on), {otaemk: 1});
      // faqat «Kelajak soati» / «Час будущего» fani bor sinflarda: 10-B (faqat Fizika) menyusida yo'q
      assert.deepEqual(await page.evaluate(() => D.classes.map(ksClass)), [true, true, true, false]);
      await page.evaluate(() => { S.ci = 3; go("journal"); });
      await page.click("[data-more]");
      assert.equal(await page.locator(".modal >> text=eMaktab'ga kirish").count(), 0);
      await page.click(".modal [data-x]");
      await page.evaluate(() => { S.ci = 0; go("journal"); });
      // sinf menyusi → «Ota-onalar» guruhida (6-A · Matematika ham: shu sinfda «Kelajak soati» bor)
      await page.click("[data-more]");
      await page.click(".modal >> text=eMaktab'ga kirish · 0/36");
      await page.waitForSelector(".ot-card");
      assert.equal(await sum(), "0 / 36 | 0 / 0 | 36 | 0");
      // rozilik belgisisiz kirmaydi
      await page.fill('[data-otl="0"]', "ota1"); await page.fill('[data-otp="0"]', "p-ota1"); await page.click('[data-otin="0"]');
      await page.waitForSelector("text=roziligini oldim» belgisini");
      assert.equal(st.posts.length, 0);
      await page.check("#otcons");
      // ikki qator to'ldiriladi → «Kiritilganlarga kirish · 2»
      await page.fill('[data-otl="1"]', "ota2"); await page.fill('[data-otp="1"]', "p-ota2");
      await page.click("[data-otall]");
      assert.deepEqual(await done(), ["2", "0", "0"]);
      assert.equal(await sum(), "2 / 36 | 2 / 2 | 34 | 0");
      assert.deepEqual(st.seen.filter((x) => x.startsWith("ota1")).sort(), ["ota1/diary", "ota1/marks", "ota1/userfeed"], "bosh sahifa, kundalik, baholar ochildi");
      // noto'g'ri parol va tasdiqlash kodi
      await page.fill('[data-otl="2"]', "ota3"); await page.fill('[data-otp="2"]', "xato"); await page.press('[data-otp="2"]', "Enter");
      assert.deepEqual(await done(), ["0", "0", "1"]);
      await page.fill('[data-otl="3"]', "ota2fa"); await page.fill('[data-otp="3"]', "p"); await page.click('[data-otin="3"]');
      await done();
      assert.equal(await sum(), "2 / 36 | 2 / 2 | 33 | 1");
      // aylanib chiqish: tayyorlar (2 ta), «Xabarlar» ham tanlanadi
      await page.click("[data-otrun]"); await page.check('.modal [data-pg="xab"]'); await page.click(".modal [data-ok]");
      assert.deepEqual(await done(), ["2", "0", "0"]);
      assert.ok(st.seen.includes("ota2/messages"));
      assert.equal(st.posts.length, 4, "seans bilan — parolsiz");
      // kalit eskirdi → «Kirib chiqish» parol so'ramaydi, «Kalit eskirgan» bo'ladi
      st.valid.clear();
      await page.click('[data-otone="0"]'); await page.waitForSelector("text=kirish kaliti eskirgan");
      await page.waitForSelector('[data-otl="0"]');
      // PIN bilan: parol shifrlanib saqlanadi, kalit eskirsa o'zi qayta kiradi
      await page.click('[data-otst="B"]');
      await page.fill("#otpi", "1234"); await page.click(".ot-pin [type=submit]");
      await page.fill("#otpi", "1234"); await page.click(".ot-pin [type=submit]");
      await page.waitForSelector('[data-otst="B"].on');
      await page.fill('[data-otp="0"]', "p-ota1"); await page.click('[data-otin="0"]');
      await done();
      assert.match(await page.textContent(".ot-t, .ot-cards"), /🔒 shifrlangan|ota1/);
      st.valid.clear(); const n0 = st.posts.length;
      await page.click('[data-otone="0"]'); await page.waitForSelector("text=ota-ona nomidan kirildi");
      assert.equal(st.posts.length, n0 + 1, "saqlangan parol bilan o'zi qayta kirdi");
      // Excel'dan: yo'riqnoma, namuna fayl (jurnaldagi ismlar bilan), to'ldirilgan faylni qayta yuklash
      await page.click("[data-otxl]");
      assert.match(await page.textContent(".ot-guide summary"), /Yo'riqnoma/);
      assert.match(await page.textContent(".ot-guide"), /36 ta o'quvchi ismi/);
      const [dl] = await Promise.all([page.waitForEvent("download"), page.click("[data-xt]")]);
      assert.match(dl.suggestedFilename(), /^ota-onalar-.+\.xlsx$/);
      const tpl = tmpdir() + "/ota-namuna-" + Date.now() + ".xlsx"; await dl.saveAs(tpl);
      const wb = XLSXN.readFile(tpl), ws = wb.Sheets[wb.SheetNames[0]], rowsT = XLSXN.utils.sheet_to_json(ws, {header: 1});
      assert.deepEqual(rowsT[0], ["№", "O'quvchi", "Login", "Parol"]);
      assert.equal(rowsT.length, 37, "36 o'quvchi + sarlavha");
      assert.equal(rowsT[1][1], await page.evaluate(() => D.classes[0].students[0].name));
      XLSXN.utils.sheet_add_aoa(ws, [["xl1", "p-xl1"], ["xl2", "p-xl2"]], {origin: "C2"});   // faqat 2 qator to'ldirilgan, qolgani bo'sh
      XLSXN.writeFile(wb, tpl);
      const [fc] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-xf]")]);
      await fc.setFiles(tpl);
      await page.waitForSelector(".ot-pv");
      assert.match(await page.textContent(".modal [data-ok]"), /2 ta ota-onaga kirish/);
      assert.equal(await page.locator(".ot-pv .ot-w").count(), 0, "hammasi topildi");
      await page.locator(".modal [data-x]").last().click();
      // Excel'dan (nusxalangan matn, ism teskari tartibda)
      await page.click("[data-otxl]");
      await page.fill("#otxt", "Ism7 Talaba7\tota7\tp-ota7\nTalaba8 Ism8; ota8; p-ota8\nNotanish Odam\tx\ty");
      await page.click("[data-xp]");
      assert.match(await page.textContent(".modal [data-ok]"), /2 ta ota-onaga kirish/);
      await page.click(".modal [data-ok]");
      assert.deepEqual(await done(), ["2", "0", "0"]);
      assert.match(await sum(), /^4 \/ 36/);   // ota1, ota2, ota7, ota8
      // hech qayerda parol yoki sahifa mazmuni yo'q; jurnal ma'lumotida ota-ona kaliti yo'q
      const ls = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage))));
      for (const p of ["p-ota1", "p-ota2", "p-ota7", "Baho: 5", "1234"]) assert.ok(!ls.includes(p), `${p} saqlanmagan`);
      assert.ok(!JSON.stringify(await page.evaluate(() => D)).includes("sess="));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      // 18 o'quvchili sinf alohida
      await page.click(".ot-card [data-x]");
      await page.evaluate(() => { S.ci = 1; render(); OTE.open(1); });
      await page.waitForSelector(".ot-card");
      assert.equal(await sum(), "0 / 18 | 0 / 0 | 18 | 0");
      await page.click("[data-otxl]");
      assert.match(await page.textContent(".ot-guide"), /18 ta o'quvchi ismi/);
      const [dl18] = await Promise.all([page.waitForEvent("download"), page.click("[data-xt]")]);
      const t18 = tmpdir() + "/ota-namuna18-" + Date.now() + ".xlsx"; await dl18.saveAs(t18);
      assert.equal(XLSXN.utils.sheet_to_json(XLSXN.readFile(t18).Sheets["Ota-onalar"], {header: 1}).length, 19, "18 o'quvchi + sarlavha");
      await page.locator(".modal [data-x]").last().click();
      await page.fill('[data-otl="17"]', "ota18"); await page.fill('[data-otp="17"]', "p-ota18"); await page.click('[data-otin="17"]');
      await page.waitForSelector(".modal >> text=PIN kiriting").catch(() => {});
      if (await page.locator("#otpi").count()) { await page.fill("#otpi", "1234"); await page.click(".ot-pin [type=submit]"); }
      await done();
      assert.equal(await sum(), "1 / 18 | 1 / 1 | 17 | 0");
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  } finally { await browser.close(); }
});

test("PDF: birlashgan chegarali jadval chiziqlari bitta (ikki qavat emas), tik nuqtali chiziqlar va outline saqlanadi", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1200, height: 800}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(APP);
    const r = await page.evaluate(() => {
      const box = document.createElement("div"); box.style.cssText = "position:absolute;left:0;top:0;width:400px;background:#fff";
      box.innerHTML = `<table id="t1" style="border-collapse:collapse;outline:2px solid #000;outline-offset:-1px"><tr><td style="border:1px solid #777;width:40px;height:20px"></td><td style="border:1px solid #777;border-left:3px solid #f00;width:40px"></td></tr><tr><td style="border:1px solid #777;height:20px"></td><td style="border:1px solid #777"></td></tr></table>
        <table id="t2" style="border-collapse:collapse"><tr><td style="border:1px dotted #777;width:40px;height:20px"></td><td style="border:1px dotted #777;width:40px"></td></tr></table>`;
      document.body.append(box);
      const a = PTG.measure(box.querySelector("#t1")), b = PTG.measure(box.querySelector("#t2"));
      box.remove();
      const rects = a.ops.filter((o) => o.k === "rect"), red = rects.filter((o) => o.fill[0] > 200 && o.fill[1] < 50);
      const vert = b.ops.filter((o) => o.k === "line" && o.x1 === o.x2 && o.yb > o.ya);
      return {edges: rects.length, red: red.length, redW: red.map((o) => Math.round(o.w)), outline: a.ops.filter((o) => o.k === "srect").length, vert: vert.length};
    });
    assert.equal(r.edges, 12, "2×2 jadval: 12 ta chiziq bo'lagi, har biri bir marta");
    assert.deepEqual(r.redW, [3], "qalin qizil chiziq qo'shni katakning ingichka chizig'ini yutadi");
    assert.equal(r.outline, 1, "outline ramkasi");
    assert.equal(r.vert, 3, "tik nuqtali chiziqlar yo'qolmaydi");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Bo'sh varaq: shrift tizimi — bitta oila, sarlavha sozlamadan, jadval qator balandligidan (36 va 18 o'quvchi)", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1440, height: 900}});
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.clock.setFixedTime(new Date(2026, 9, 20, 10, 0));
    await page.goto(APP);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
    await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
    await page.evaluate(() => { const grow = (c, n) => { for (let i = c.students.length; i < n; i++) c.students.push({name: `Qo'shimcha O'quvchi ${i + 1}`, marks: {}, scores: {}}); c.students.length = n; };
      grow(D.classes[0], 36); grow(D.classes[1], 18); save(); });
    await page.click(".side [data-go=reports]"); await page.click("[data-kind=blank]"); await page.waitForSelector(".bv-scale .bv-pg");
    const probe = () => page.evaluate(() => {
      const p = document.querySelector(".bv-scale .bv-pg"), pt = (s) => { const e = p.querySelector(s); return e ? parseFloat(getComputedStyle(e).fontSize) * 0.75 : null; };
      const fams = new Set([...p.querySelectorAll("*")].filter((e) => e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim())).map((e) => getComputedStyle(e).fontFamily.split(",")[0].replace(/"/g, "").trim()));
      return {fams: [...fams], ttl: pt(".bv-ttl b"), info: pt(".bv-info span"), lg: pt(".bv-lg"), th: pt("thead th"), sm: pt("thead th small"), nm: pt("td.bv-nm")};
    });
    const res = {};
    for (const [ci, per] of [["0", "month"], ["1", "week"]]) {
      await page.click(".hb-pks [data-hk=cls]"); await page.click(`.hb-pop [data-ho=ci][data-v='${ci}']`);
      await page.evaluate((p) => document.querySelector(`[data-bv=per][data-v=${p}]`).click(), per);
      res[ci] = await probe();
      assert.deepEqual(res[ci].fams, ["Manrope"], "varaqdagi hamma yozuv bitta shriftda");
      assert.ok(res[ci].sm >= 6.5 && res[ci].sm < res[ci].th, `kichik yozuv ${res[ci].sm} pt`);
      assert.ok(res[ci].nm >= 7.4 && res[ci].nm <= 10.6, `ism ${res[ci].nm} pt`);
    }
    // sarlavha o'lchami sinfga bog'liq emas (faqat «Shrift» sozlamasiga), jadval esa qator balandligiga qarab kattalashadi
    assert.equal(res["0"].ttl, res["1"].ttl); assert.equal(res["0"].lg, res["1"].lg);
    assert.ok(res["1"].nm > res["0"].nm, "18 o'quvchida jadval yozuvi kattaroq");
    await page.evaluate(() => { document.querySelector("[data-bv=set]").click(); document.querySelector("[data-bv=fs][data-v=l]").click(); });
    const big = await probe();
    assert.ok(big.ttl > res["1"].ttl && big.lg > res["1"].lg, "«Katta» shrift sarlavhani ham kattalashtiradi");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("Bo'sh varaq: shrift to'plamlari — «Dizaynga mos» va qo'lda tanlash, ekran va PDF bir xil (36 va 18 o'quvchi, telefon)", async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const AUTO = {kl: "zam", oq: "huj", rang: "zam", daf: "ras", qal: "ara", min: "odd", kok: "huj", kat: "odd", ilik: "ras"};
    const FAM = {zam: ["Manrope", "Manrope"], ras: ["BV Serif", "BV Serif"], huj: ["BV Serif", "BV Sans"], odd: ["BV Sans", "BV Sans"], ara: ["Manrope", "BV Sans"]};
    const PDFK = {Manrope: "m", "BV Serif": "s", "BV Sans": "a"};
    for (const vp of [{width: 1440, height: 900}, {width: 390, height: 844}]) {
      const page = await browser.newPage({viewport: vp});
      const errors = []; page.on("pageerror", (e) => errors.push(e.message));
      await page.clock.setFixedTime(new Date(2026, 9, 20, 10, 0));
      await page.goto(APP);
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("[data-w=import]")]);
      await chooser.setFiles(FIXTURE); await page.waitForSelector(".bn-hd");
      await page.evaluate(() => { const grow = (c, n) => { for (let i = c.students.length; i < n; i++) c.students.push({name: `Qo'shimcha O'quvchi ${i + 1}`, marks: {}, scores: {}}); c.students.length = n; };
        grow(D.classes[0], 36); grow(D.classes[1], 18); save(); });
      await page.click(`${vp.width < 800 ? ".tabbar" : ".side"} [data-go=reports]`);
      if (vp.width < 800) { await page.click("[data-hk=kind]"); await page.click(".modal [data-kind=blank]"); } else await page.click("[data-kind=blank]"); await page.waitForSelector(".bv-scale .bv-pg");
      const probe = () => page.evaluate(async () => {
        await document.fonts.ready; await new Promise((r) => setTimeout(r, 60));
        const p = document.querySelector(".bv-scale .bv-pg"), f = (s) => getComputedStyle(p.querySelector(s)).fontFamily.split(",")[0].replace(/"/g, "").trim();
        const used = (s) => { const fam = f(s); return fam === "Manrope" || document.fonts.check(`10px "${fam}"`); };
        const ops = PTG.measure(p).ops.filter((o) => o.k === "text"), key = (t) => { const o = ops.find((x) => x.t && x.t.includes(t)); return o && o.keys[0]; };
        const ttl = p.querySelector(".bv-ttl b").textContent.trim().split(" ")[0], nm = p.querySelector("td.bv-nm").textContent.trim().split(" ")[0];
        const over = [...document.querySelectorAll(".bv-scale .bv-in")].some((i) => i.scrollHeight > i.clientHeight + 1) || [...document.querySelectorAll(".bv-scale td.bv-nm")].some((x) => x.scrollWidth > x.clientWidth + 1);
        return {h: f(".bv-ttl b"), b: f("td.bv-nm"), lg: f(".bv-lg"), ok: used(".bv-ttl b") && used("td.bv-nm"), pk: [key(ttl), key(nm)], over, bad: !!document.querySelector(".bv-chip.bad"), wide: document.documentElement.scrollWidth > innerWidth + 1};
      });
      const check = async (want, why) => { const r = await probe(); const w = FAM[want];
        assert.deepEqual([r.h, r.b, r.lg], [w[0], w[1], w[1]], `${why}: sarlavha/jadval/pastki shrift`);
        assert.ok(r.ok, `${why}: shrift ulandi`);
        assert.deepEqual(r.pk.map((k) => k && k[0]), [PDFK[w[0]], PDFK[w[1]]], `${why}: PDF shrifti ekrandagidek`);
        assert.ok(!r.over && !r.bad && !r.wide, `${why}: hech narsa sig'may qolmadi`); };
      for (const [ci, per] of [["0", "month"], ["1", "week"]]) {
        await page.evaluate(() => { const v = document.querySelector(".bv-veil"); if (v) v.click(); });
        await page.evaluate(() => document.querySelector("[data-hk=cls]").click());
        await page.evaluate((ci) => document.querySelector(`[data-ho=ci][data-v='${ci}']`).click(), ci);
        await page.waitForTimeout(300);
        await page.evaluate((p) => document.querySelector(`[data-bv=per][data-v=${p}]`).click(), per);
        for (const dz of Object.keys(AUTO)) {
          await page.evaluate((dz) => { if (!document.querySelector(".bv-pop")) document.querySelector("[data-bv=set]").click(); document.querySelector(`[data-bv=tdz][data-v=${dz}]`).click(); }, dz);
          await check(AUTO[dz], `${vp.width}px · ${ci === "0" ? 36 : 18} o'quvchi · ${dz}`);
        }
      }
      // qo'lda tanlangan to'plam dizayn almashganda ham saqlanadi; «Dizaynga mos» qaytaradi
      await page.evaluate(() => document.querySelector("[data-bv=fset][data-v=ras]").click());
      await page.evaluate(() => document.querySelector("[data-bv=tdz][data-v=min]").click());
      await check("ras", "qo'lda Rasmiy, Minimal dizayn");
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("yoqlama_bv")).fset), "ras");
      const panel = await page.evaluate(() => { const l = document.querySelector(".bv-fsl"), r = l.getBoundingClientRect();
        return {n: l.querySelectorAll(".bv-fso").length, on: l.querySelector(".bv-fso.on").dataset.v, fit: [...l.querySelectorAll(".bv-fso")].every((b) => b.scrollWidth <= b.clientWidth + 1 && b.getBoundingClientRect().right <= r.right + 1)}; });
      assert.deepEqual(panel, {n: 6, on: "ras", fit: true});
      await page.evaluate(() => document.querySelector("[data-bv=fset][data-v=auto]").click());
      await check("odd", "Dizaynga mos, Minimal");
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});
