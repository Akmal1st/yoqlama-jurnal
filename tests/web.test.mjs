// Web ilova (docs/index.html) hisob-kitoblari golden.json bilan bir xilmi — ya'ni kompyuter dasturi bilan.
// Ishga tushirish: node --test tests/
import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const here = new URL(".", import.meta.url);
const read = (p) => readFileSync(new URL(p, here), "utf8");
const INPUTS = JSON.parse(read("inputs.json"));
const GOLDEN = JSON.parse(read("golden.json"));
const FIXTURE = JSON.parse(read("fixtures/journal.json"));

function loadApp() {
  const html = read("../docs/index.html");
  const src = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));
  const [y, m, d] = INPUTS.today.split("-").map(Number);
  const FIXED = new Date(y, m - 1, d, 12).getTime();
  class FixedDate extends Date {
    constructor(...a) { if (a.length) super(...a); else super(FIXED); }
    static now() { return FIXED; }
  }
  const noop = () => {};
  const store = {};
  const ctx = vm.createContext({
    Date: FixedDate, console,
    document: {addEventListener: noop, getElementById: () => null, querySelector: () => null, querySelectorAll: () => []},
    window: {addEventListener: noop}, navigator: {}, location: {protocol: "file:"},
    localStorage: {getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }},
    setTimeout, clearTimeout, setInterval: noop, matchMedia: () => ({matches: false}),
  });
  vm.runInContext(src + `
    ;globalThis.__app = {setData: (x) => { D = normalize(x); }, get D() { return D; }, grade5, parseMark, parseScore, parsePlanText,
      emaktabSheet, worksInQuarter, quarterResult, yearResult, readiness, reportRows, periodNow, label};`, ctx);
  return ctx.__app;
}

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

const A = loadApp();
A.setData(structuredClone(FIXTURE));

test("grade5: 100 ballik → 5 ballik baho", () => assert.deepEqual(norm(INPUTS.grade5.map(A.grade5)), GOLDEN.grade5));
test("belgini o'qish (8/9, kq9, s, …)", () => assert.deepEqual(norm(INPUTS.marks.map(A.parseMark)), GOLDEN.marks));
test("summativ ballni o'qish", () => assert.deepEqual(norm(INPUTS.scores.map(A.parseScore)), GOLDEN.scores));
test("KTR matnini o'qish", () => assert.deepEqual(norm(INPUTS.plans.map(A.parsePlanText)), GOLDEN.plans));
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
