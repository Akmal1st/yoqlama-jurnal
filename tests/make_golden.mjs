// To'g'ri javoblar (tests/golden.json) endi web ilovaning o'zidan yasaladi (kompyuter dasturi olib tashlangan, 2026-11-08).
// Hisob-kitob qoidasi ATAYLAB o'zgartirilganda: node tests/make_golden.mjs → git diff tests/golden.json ni ko'zdan kechiring.
import {readFileSync, writeFileSync} from "node:fs";
import {loadApp} from "./webapp.mjs";

const here = new URL(".", import.meta.url);
const read = (p) => readFileSync(new URL(p, here), "utf8");

export function norm(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === "number") { const r = Math.round(v * 1e6) / 1e6; return Object.is(r, -0) ? 0 : r; }
  if (Array.isArray(v)) return Array.from(v, (x) => norm(x));
  if (typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, norm(x)]));
  return v;
}
const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k]]));
export const QKEYS = ["bsb", "chsb", "fb", "n_fb", "avg", "total", "max_bsb", "max_chsb", "missing", "complete", "grade"];
export const YKEYS = ["sb", "avg_fb", "year", "ready", "year_grade", "exam", "final", "final_grade"];
export const RKEYS = ["name", "n", "avg", "att", "s", "dq", "k", "kq", "ch", "absent", "why"];
const js = (x) => JSON.parse(JSON.stringify(x));

export function makeGolden() {
  const INPUTS = JSON.parse(read("inputs.json")), FIXTURE = JSON.parse(read("fixtures/journal.json"));
  const A = loadApp(INPUTS.today);
  A.setData(structuredClone(FIXTURE));
  const [lo, hi, q] = A.periodNow();
  return norm({
    grade5: INPUTS.grade5.map(A.grade5),
    marks: INPUTS.marks.map(A.parseMark),
    scores: INPUTS.scores.map(A.parseScore),
    plans: INPUTS.plans.map(A.parsePlanText),
    emaktab: INPUTS.emaktab.map((e) => js(A.emaktabSheet(e.rows, e.sheet))),
    classes: A.D.classes.map((c) => ({
      label: A.label(c),
      quarters: Object.fromEntries(["1", "2"].map((k) => {
        const works = A.worksInQuarter(c, +k);
        return [k, {results: c.students.map((s) => pick(A.quarterResult(c, s, +k, works), QKEYS)), readiness: A.readiness(c, +k)}];
      })),
      year: c.students.map((s) => { const y = A.yearResult(c, s); return {...pick(y, YKEYS), q: y.q.map((r) => r ? r.grade : null)}; }),
      report: (({lessons, dates, rows}) => ({lessons, dates, rows: rows.map((x) => pick(x, RKEYS))}))(A.reportRows(c, lo, hi, q)),
    })),
    period: A.periodNow(),
    bsb: INPUTS.bsb.map((b) => { const an = A.bsbStats(b.qmax, b.rows); return js({stats: an, rec: A.bsbRecs(an)}); }),
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync(new URL("golden.json", here), JSON.stringify(makeGolden(), null, 1) + "\n");
  console.log("tests/golden.json yangilandi");
}
