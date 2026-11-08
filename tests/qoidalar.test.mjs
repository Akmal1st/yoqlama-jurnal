// Hisob qoidalari — kutilgan qiymatlar QO'LDA hisoblangan (eMaktab qoidasi bo'yicha), dasturdan olinmagan.
// golden.json web ilovaning o'zidan yasaladi (tests/make_golden.mjs) va faqat «natija o'zgardimi» ni ushlaydi;
// bu fayl esa «natija to'g'rimi» ni tekshiradi. Qoida ataylab o'zgarsa, shu yerdagi qiymatlar ham qo'lda yangilanadi.
import {test} from "node:test";
import assert from "node:assert/strict";
import {loadApp} from "./webapp.mjs";

// 1-chorak: 2026-09-02 … 2026-10-31; darslar ish kunlarida
const Q = [["2026-09-02", "2026-10-31"], ["2026-11-09", "2026-12-27"], ["2027-01-12", "2027-03-20"], ["2027-03-30", "2027-05-25"]];
const DATES = ["2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18"];

function app({marks = {}, scores = {}, works = [], hasExam = false} = {}) {
  const A = loadApp("2026-10-20");
  A.setData({version: 2, settings: {quarters: Q}, classes: [{name: "7-A", subject: "Matematika", dates: DATES, works, has_exam: hasExam,
    students: [{id: "s1", name: "Ali", marks, scores}]}]});
  const c = A.D.classes[0];
  return {A, c, s: c.students[0]};
}
// rasmiy chorak tuzilmasi: BSB 25 + Loyiha 25 = 50, CHSB 40, FB 10 → jami 100
const W = [{id: "b1", type: "bsb", date: "2026-09-21", max: 25, title: ""}, {id: "l1", type: "loyiha", date: "2026-10-05", max: 25, title: ""},
  {id: "c1", type: "chsb", date: "2026-10-26", max: 40, title: ""}];
const qr = (o) => { const {A, c, s} = app(o); return A.quarterResult(c, s, 1, A.worksInQuarter(c, 1)); };

test("5 ballik baho chegaralari: 86+ → 5, 66+ → 4, 30+ → 3, qolgani → 2", () => {
  const A = loadApp("2026-10-20");
  const cases = [[100, 5], [86, 5], [85.9, 4], [66, 4], [65.9, 3], [30, 3], [29.9, 2], [0, 2]];
  for (const [t, g] of cases) assert.equal(A.grade5(t), g, `${t} ball`);
});

test("FB: kamida 4 ta baho bo'lsa o'rtachasi yaxlitlanadi (8, 9, 10, 9 → 9)", () => {
  const r = qr({works: W, marks: {"2026-09-07": "8", "2026-09-08": "9", "2026-09-09": "10", "2026-09-10": "9"}, scores: {b1: 20, l1: 15, c1: 30}});
  assert.equal(r.fb, 9);
  assert.equal(r.n_fb, 4);
});

test("FB: 4 tadan kam baho bo'lsa 0 (8, 9, 10 → 0)", () => {
  const r = qr({works: W, marks: {"2026-09-07": "8", "2026-09-08": "9", "2026-09-09": "10"}, scores: {b1: 20, l1: 15, c1: 30}});
  assert.equal(r.fb, 0);
});

test("FB: bir katakdagi ikki baho ikkalasi ham sanaladi (7, 8/9, 8 → o'rtacha 8)", () => {
  const r = qr({works: W, marks: {"2026-09-07": "7", "2026-09-08": "8/9", "2026-09-09": "8"}, scores: {b1: 20, l1: 15, c1: 30}});
  assert.equal(r.n_fb, 4);
  assert.equal(r.fb, 8);
});

test("FB: o'rtacha 8,5 → 9 (yarim yuqoriga)", () => {
  const r = qr({works: W, marks: {"2026-09-07": "8", "2026-09-08": "9", "2026-09-09": "8", "2026-09-10": "9"}, scores: {}});
  assert.equal(r.fb, 9);
});

test("Chorak: BSB 20 + Loyiha 15 + CHSB 30 + FB 9 = 74 → 4", () => {
  const r = qr({works: W, marks: {"2026-09-07": "8", "2026-09-08": "9", "2026-09-09": "10", "2026-09-10": "9"}, scores: {b1: 20, l1: 15, c1: 30}});
  assert.deepEqual([r.bsb, r.chsb, r.max_bsb, r.max_chsb, r.total, r.complete, r.grade], [35, 30, 50, 40, 74, true, 4]);
});

test("Chorak: hamma ish to'liq ball + FB 10 = 100 → 5", () => {
  const m = Object.fromEntries(DATES.slice(0, 5).map((d) => [d, "10"]));
  const r = qr({works: W, marks: m, scores: {b1: 25, l1: 25, c1: 40}});
  assert.deepEqual([r.total, r.grade], [100, 5]);
});

test("Chorak: bitta ish bahosiz bo'lsa baho chiqmaydi", () => {
  const r = qr({works: W, scores: {b1: 20, c1: 30}});
  assert.deepEqual([r.missing, r.complete, r.grade], [1, false, null]);
});

test("Chorak: ishlar yig'indisi 50/40 bo'lmasa (BSB 25 + CHSB 40) baho chiqmaydi", () => {
  const r = qr({works: [W[0], W[2]], scores: {b1: 25, c1: 40}});
  assert.deepEqual([r.max_bsb, r.complete, r.grade], [25, false, null]);
});

test("Davomat: 10 dars, 2 sababsiz + 1 kasal → 70 %; kech qolish (kq) davomatni kamaytirmaydi", () => {
  const {A, c} = app({marks: {"2026-09-07": "s", "2026-09-08": "s", "2026-09-09": "k", "2026-09-10": "kq", "2026-09-11": "8"}});
  const r = A.reportRows(c, Q[0][0], Q[0][1], 1).rows[0];
  assert.equal(A.reportRows(c, Q[0][0], Q[0][1], 1).lessons, 10);
  assert.deepEqual([r.s, r.k, r.kq, r.att, r.avg], [2, 1, 1, 70, 8]);
});

// Chorak chegaralari: 1-chorak 02.09–31.10, ta'til, 2-chorak 09.11 dan. Asosiy qoida 3 funksiyada (index.html):
// quarterOf — sana qaysi chorakda; viewQuarter — ko'rsatiladigan chorak; workQuarter — yangi summativ ish qaysi chorakka tushadi.
function qapp(arx) {
  const A = loadApp("2026-11-03");
  A.setData({version: 2, settings: {quarters: Q}, classes: [], web: arx ? {arx: {q: {1: {r: Q[0], at: "2026-11-03", by: "auto", snap: []}}}} : {}});
  return A;
}
test("Chorak: sana chegarada (31.10 — 1-chorak, 01.11 — ta'til, 09.11 — 2-chorak)", () => {
  const A = qapp(false);
  assert.deepEqual(["2026-09-02", "2026-10-31", "2026-11-01", "2026-11-08", "2026-11-09", "2026-08-31"].map(A.quarterOf), [1, 1, null, null, 2, null]);
});
test("Chorak: ta'tilda oxirgi tugagan chorak ko'rsatiladi, o'quv yili boshlanmagan bo'lsa — 1-chorak", () => {
  const A = qapp(false);
  assert.equal(A.viewQuarter("2026-11-03"), 1);
  assert.equal(A.viewQuarter("2026-12-30"), 2);
  assert.equal(A.viewQuarter("2026-08-20"), 1);
});
test("Chorak: ta'tilda yangi ish — 1-chorak arxivlanmagan bo'lsa unga, arxivlangan bo'lsa 2-chorakka", () => {
  assert.equal(qapp(false).workQuarter("2026-11-03"), 1);
  assert.equal(qapp(true).workQuarter("2026-11-03"), 2);
  assert.equal(qapp(true).workQuarter("2026-10-20"), 1, "chorak ichida — doim o'sha chorak");
});
