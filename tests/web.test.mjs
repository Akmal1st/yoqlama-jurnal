// Web ilova (docs/index.html) hisob-kitoblari golden.json bilan bir xilmi — ya'ni kompyuter dasturi bilan.
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

// Python bilan bir xil ko'rinishga keltirish: 6 xonagacha, undefined → null, butun kasr → butun son
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

// Hisobotlar (sinf, to'garak, pullik ta'lim) — hisobot_golden.json bilan; SQLite moduli (dastur/hisobot_sqlite.py) ham shu faylga solishtiriladi
test("Hisobotlar: solishtirish, ishlar, to'lish, hisob daftari, moliya = hisobot_golden.json", () => {
  const H = JSON.parse(read("fixtures/hisobot.json")), G = JSON.parse(read("hisobot_golden.json"));
  assert.deepEqual(norm(hisobotWeb(loadApp(G.today), H)), G);
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
