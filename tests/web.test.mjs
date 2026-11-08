// Web ilova (docs/index.html) hisob-kitoblari golden.json bilan bir xilmi (golden.json: node tests/make_golden.mjs).
// Ishga tushirish: node --test tests/
import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {loadApp} from "./webapp.mjs";
import {hisobotWeb} from "./hisobot_web.mjs";

const here = new URL(".", import.meta.url);
const read = (p) => readFileSync(new URL(p, here), "utf8");
const INPUTS = JSON.parse(read("inputs.json"));
const GOLDEN = JSON.parse(read("golden.json"));
const FIXTURE = JSON.parse(read("fixtures/journal.json"));

// golden.json bilan bir xil ko'rinishga keltirish: 6 xonagacha, undefined → null, butun kasr → butun son
function norm(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === "number") { const r = Math.round(v * 1e6) / 1e6; return Object.is(r, -0) ? 0 : r; }
  if (Array.isArray(v)) return Array.from(v, (x) => norm(x));
  if (typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, norm(x)]));
  return v;
}
const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k]]));
const QKEYS = ["bsb", "chsb", "fb", "n_fb", "avg", "total", "max_bsb", "max_chsb", "missing", "complete", "grade"];
const YKEYS = ["sb", "avg_fb", "year", "ready", "year_grade", "exam", "final", "final_grade"];
const RKEYS = ["name", "n", "avg", "att", "s", "dq", "k", "kq", "ch", "absent", "why"];

const A = loadApp(INPUTS.today);
A.setData(structuredClone(FIXTURE));

test("grade5: 100 ballik → 5 ballik baho", () => assert.deepEqual(norm(INPUTS.grade5.map(A.grade5)), GOLDEN.grade5));
test("belgini o'qish (8/9, kq9, s, …)", () => assert.deepEqual(norm(INPUTS.marks.map(A.parseMark)), GOLDEN.marks));
test("summativ ballni o'qish", () => assert.deepEqual(norm(INPUTS.scores.map(A.parseScore)), GOLDEN.scores));
test("KTR matnini o'qish", () => assert.deepEqual(norm(INPUTS.plans.map(A.parsePlanText)), GOLDEN.plans));
test("BSB tahlili: ko'rsatkichlar va tavsiyalar", () => {
  INPUTS.bsb.forEach((b, i) => { const an = A.bsbStats(b.qmax, b.rows);
    assert.deepEqual(norm(JSON.parse(JSON.stringify({stats: an, rec: A.bsbRecs(an)}))), GOLDEN.bsb[i], `${i}-holat`); });
});
test("emaktab Excel varag'i", () => {
  INPUTS.emaktab.forEach((e, i) => assert.deepEqual(norm(JSON.parse(JSON.stringify(A.emaktabSheet(e.rows, e.sheet)))), GOLDEN.emaktab[i], e.sheet));
});
test("joriy davr", () => assert.deepEqual(norm(A.periodNow()), GOLDEN.period));

GOLDEN.classes.forEach((exp, ci) => {
  const c = A.D.classes[ci];
  test(`${exp.label}: chorak natijalari va tayyorlik`, () => {
    for (const q of ["1", "2"]) {
      const works = A.worksInQuarter(c, +q);
      assert.deepEqual(norm(c.students.map((s) => pick(A.quarterResult(c, s, +q, works), QKEYS))), exp.quarters[q].results, `${q}-chorak`);
      assert.deepEqual(norm(A.readiness(c, +q)), exp.quarters[q].readiness, `${q}-chorak tayyorlik`);
    }
  });
  test(`${exp.label}: yillik va yakuniy`, () => {
    assert.deepEqual(norm(c.students.map((s) => { const y = A.yearResult(c, s); return {...pick(y, YKEYS), q: y.q.map((r) => r ? r.grade : null)}; })), exp.year);
  });
  test(`${exp.label}: hisobot va xavf belgilari`, () => {
    const [lo, hi, q] = A.periodNow(), r = A.reportRows(c, lo, hi, q);
    assert.deepEqual(norm({lessons: r.lessons, dates: r.dates, rows: r.rows.map((x) => pick(x, RKEYS))}), exp.report);
  });
});

test("docs/emk.js index.html dagi emkGrab bilan bir xil (node tests/make_emk.mjs)", async () => {
  const {emkJs} = await import("./make_emk.mjs");
  assert.equal(read("../docs/emk.js"), emkJs());
});

// Hisobotlar (sinf, to'garak, pullik ta'lim) — hisobot_golden.json bilan
test("Hisobotlar: solishtirish, ishlar, to'lish, hisob daftari, moliya = hisobot_golden.json", () => {
  const H = JSON.parse(read("fixtures/hisobot.json")), G = JSON.parse(read("hisobot_golden.json"));
  assert.deepEqual(norm(hisobotWeb(loadApp(G.today), H)), G);
});

test("Bugun: joriy o'zlashtirish (qProgress) — chorak yopilmaganda ham bo'sh qolmaydi", () => {
  const H = JSON.parse(read("fixtures/hisobot.json")), B = loadApp("2026-11-20"); B.setData(structuredClone(H));
  const c = B.D.classes[0], st = B.D.settings.quarters[0][0];
  // BSB/CHSB hali yo'q (birinchi ish 25-sentabr): faqat FB — formativ baholar o'rtachasi / 10 (metodik kun va «dars yo'q» kunlari hisobga kirmaydi)
  assert.equal(norm(B.qProgress(c, 1, "2026-09-20")), 62.5);
  // 1-BSB qo'yilgan: ball qo'yilganlar shu ishning maksimali bilan qo'shiladi
  const r = B.compareRows(st, "2026-10-10", 1)[0];
  assert.equal(norm(r.qp), norm(B.qProgress(c, 1, "2026-10-10")));
  assert.ok(r.qp > 0 && r.qp <= 100);
  assert.equal(B.qProgress(c, 3, "2026-10-10"), null);   // 3-chorak sanalari yo'q
});

test("Baholanganlar ulushi: kamida 30% (baholangan / jami * 100 >= 30)", () => {
  const mk = (n, g) => ({students: Array.from({length: n}, (_, i) => ({marks: i < g ? {"2026-01-01": "8"} : {"2026-01-01": i % 2 ? "s" : ""}}))});
  const r = (n, g) => { const x = A.gradedShare(mk(n, g), "2026-01-01"); return [x.ok, x.pct, x.need]; };
  assert.deepEqual(r(10, 3), [true, 30, 3]);
  assert.deepEqual(r(10, 2), [false, 20, 3]);
  assert.deepEqual(r(25, 8), [true, 32, 8]);
  assert.deepEqual(r(25, 7), [false, 28, 8]);
  assert.deepEqual(r(3, 1), [true, 33.3, 1]);
  assert.deepEqual(r(0, 0), [false, 0, 0]);
});

test("Loyiha ishi chorak hisobida BSB qismiga kiradi: BSB + Loyiha = 50, CHSB = 40", () => {
  const B = loadApp(INPUTS.today); B.setData(structuredClone(FIXTURE));
  const c = B.D.classes.find((x) => x.works && x.works.length) || B.D.classes[0], q = [1, 2, 3, 4].find((k) => B.worksInQuarter(c, k).length) || 1;
  const [a, b] = B.D.settings.quarters[q - 1], s = c.students[0];
  c.works = [{id: "lb", type: "bsb", date: a, max: 25, title: ""}, {id: "ll", type: "loyiha", date: a, max: 25, title: ""}, {id: "lc", type: "chsb", date: b, max: 40, title: ""}];
  s.scores = {lb: 20, ll: 15, lc: 30};
  const r = B.quarterResult(c, s, q, B.worksInQuarter(c, q));
  assert.deepEqual([r.bsb, r.chsb, r.max_bsb, r.max_chsb, r.missing], [35, 30, 50, 40, 0]);
  assert.equal(r.complete, true);
  c.works[1].max = 20;
  const [cp] = B.readiness(c, q);
  assert.ok(cp.some((x) => x.includes("BSB + Loyiha ishi") && x.includes("45")), cp.join("; "));
});

test("Hisobotlar: Loyiha ishi «Loyiha» deb yoziladi va solishtirishda BSB foiziga kiradi (CHSB ga emas)", () => {
  const B = loadApp(INPUTS.today); B.setData(structuredClone(FIXTURE));
  const c = B.D.classes.find((x) => x.works && x.works.length) || B.D.classes[0], q = [1, 2, 3, 4].find((k) => B.worksInQuarter(c, k).length) || 1;
  const [a, b] = B.D.settings.quarters[q - 1];
  c.works = [{id: "lb", type: "bsb", date: a, max: 20, title: ""}, {id: "ll", type: "loyiha", date: a, max: 30, title: ""}, {id: "lc", type: "chsb", date: b, max: 40, title: ""}];
  for (const s of c.students) s.scores = {lb: 10, ll: 30, lc: 20};
  assert.match(B.wTag(c.works[1]), /^Loyiha /);
  const aoa = B.sumAoa(c, q)[0];
  assert.ok(aoa.some((row) => row.includes("BSB + Loyiha /50")), "Excel ustuni");
  assert.ok(!aoa.flat().some((x) => typeof x === "string" && /^CHSB/.test(x) && x.includes(B.wTag(c.works[1]).slice(-5)) && !x.includes(B.wTag(c.works[2]).slice(-5))));
  const r = B.compareRows(a, b, q).find((x) => x.c === c);
  assert.equal(Math.round(r.bsb), 80);    // (10 + 30) / (20 + 30)
  assert.equal(Math.round(r.chsb), 50);   // 20 / 40
});

test("O'zgarishlar tarixi vaqti mahalliy vaqtda yoziladi (UTC emas)", () => {
  // loadApp: sana qotirilgan — bugun, mahalliy soat 12:00. toISOString() Toshkentda 07:00 berardi
  assert.equal(A.nowLocal(), `${INPUTS.today}T12:00:00`);
  assert.equal(A.nowLocal(16), `${INPUTS.today}T12:00`);
});

test("Belgi son (8) yoki null bo'lsa ham jurnal ochiladi: normalize belgini matnga keltiradi", () => {
  const B = loadApp(INPUTS.today), d = structuredClone(FIXTURE), s = d.classes[0].students;
  s[0].marks["2026-09-09"] = 8; s[0].marks["2026-09-11"] = null; s[1].marks["2026-09-09"] = {x: 1};
  B.setData(d);
  const m0 = B.D.classes[0].students[0].marks;
  assert.equal(m0["2026-09-09"], "8"); assert.ok(!("2026-09-11" in m0)); assert.ok(!("2026-09-09" in B.D.classes[0].students[1].marks));
  assert.doesNotThrow(() => B.reportRows(B.D.classes[0], ...B.periodNow()));
});
