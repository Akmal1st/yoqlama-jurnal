// Hisobotlarning web ilovadagi natijasi (hisobot_golden.json shu yerdan yaratiladi va tekshiriladi).
// Bir xil natijani dastur/hisobot_sqlite.py SQL so'rovlari bilan qaytarishi kerak (tests/test_sqlite.py).
export const H_TODAY = "2026-11-20";
const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k] ?? null]));
export function hisobotWeb(A, H) {
  A.setData(structuredClone(H));
  const D = A.D, t = H_TODAY, [lo, hi] = D.settings.quarters[0];
  const cls = D.classes.filter((c) => !c.kind), grp = D.classes.filter((c) => c.kind), paid = grp.filter((c) => c.kind === "paid");
  const CK = ["n", "lessons", "nGr", "avg", "att", "bsb", "chsb", "qq", "qu"];
  return {
    today: t,
    cmp: A.compareRows(lo, hi, 1).map((r) => ({cls: A.label(r.c), ...pick(r, CK)})),
    cmp_total: pick(A.compareTotal(A.compareRows(lo, hi, 1)), ["n", "lessons", "avg", "att", "bsb", "chsb", "qq", "qu"]),
    students: cls.map((c) => A.reportRows(c, lo, hi).rows.map((r) => pick(r, ["name", "n", "avg", "att", "s", "dq", "k", "kq", "ch"]))),
    works: cls.map((c) => A.sumData(c, 1).W.map((x) => ({id: x.w.id, ...pick(x, ["n", "avg", "pct", "lo", "hi", "band"])}))),
    fill: grp.map((c) => ({name: c.name, n: c.students.length, cap: c.cap || null, held: A.gHeld(c, "2026-11", t), att: A.grpAtt(c, "2026-11", t),
      year: c.students.map((s) => A.gYear(c, s, t).pct)})),
    ledger: paid.map((c) => c.students.map((s) => { const L = A.ledgerOf(c, s, t); return {name: s.name, ...pick(L, ["held", "charge", "paid", "charged", "paidAll", "debt"])}; })),
    fin: paid.map((c) => [["2026-09-01", t], ["2026-10-01", "2026-10-31"], ["2026-11-01", "2026-11-30"]].map(([a, b]) => ({svc: A.svcOf(c), ...pick(A.finOf(c, a, b, t), ["open", "charged", "got", "close", "how"])}))),
  };
}
