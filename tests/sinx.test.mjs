// Ikki qurilmani birlashtirish (docs/sinx.js): telefon va kompyuter Telegram orqali almashganda ikkalasidagi baholar saqlanadi.
import {test} from "node:test";
import assert from "node:assert/strict";
import {loadApp} from "./webapp.mjs";

const A = loadApp("2026-10-20");
const DATES = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"];
function journal(n) {
  return A.migrate(A.normalize({version: 2, settings: {quarters: [["2026-09-02", "2026-10-31"], null, null, null]}, changelog: [],
    classes: [{name: "7-A", subject: "Matematika", dates: DATES, works: [{id: "w1", type: "bsb", date: "2026-10-14", max: 25, title: ""}],
      students: Array.from({length: n}, (_, i) => ({id: `s${i}`, name: `O'quvchi ${String(i + 1).padStart(2, "0")}`, marks: {"2026-10-12": "8"}, scores: {}}))}]}));
}
const cp = (x) => JSON.parse(JSON.stringify(x));
const marks = (d, i) => d.classes[0].students[i].marks;

for (const n of [18, 36]) {
  test(`${n} o'quvchi: turli kunlarga qo'yilgan baholar ikkalasi ham saqlanadi`, () => {
    const base = journal(n), phone = cp(base), pc = cp(base);
    for (let i = 0; i < n; i++) { marks(phone, i)["2026-10-13"] = i % 3 ? "9" : "s"; marks(pc, i)["2026-10-14"] = "7"; }
    pc.classes[0].students[n - 1].scores.w1 = 20;
    const R = A.SINX.merge(base, phone, pc);
    assert.equal(R.clash.length, 0);
    assert.equal(R.n, n);
    for (let i = 0; i < n; i++) assert.deepEqual(marks(R.data, i), {"2026-10-12": "8", "2026-10-13": i % 3 ? "9" : "s", "2026-10-14": "7"});
    assert.equal(R.data.classes[0].students[n - 1].scores.w1, 20);
  });
}

test("bir katakka ikki xil baho — ziddiyat; tanlov bo'yicha hal qilinadi", () => {
  const base = journal(18), phone = cp(base), pc = cp(base);
  marks(phone, 0)["2026-10-15"] = "9"; marks(pc, 0)["2026-10-15"] = "6";
  marks(phone, 1)["2026-10-15"] = "5"; marks(pc, 1)["2026-10-15"] = "5";   // bir xil — ziddiyat emas
  let R = A.SINX.merge(base, phone, pc);
  assert.equal(R.clash.length, 1);
  assert.deepEqual([R.clash[0].student, R.clash[0].key, R.clash[0].mine, R.clash[0].theirs], ["O'quvchi 01", "2026-10-15", "9", "6"]);
  assert.equal(marks(A.SINX.resolve(R, "theirs"), 0)["2026-10-15"], "6");
  R = A.SINX.merge(base, phone, pc);
  assert.equal(marks(A.SINX.resolve(R, "mine"), 0)["2026-10-15"], "9");
});

test("shu qurilmada o'chirilgan baho o'chadi, Telegram'da o'zgartirilgani qoladi", () => {
  const base = journal(18), phone = cp(base), pc = cp(base);
  delete marks(phone, 2)["2026-10-12"];       // telefonda o'chirildi, kompyuterda tegilmagan
  marks(pc, 3)["2026-10-12"] = "10";          // kompyuterda o'zgartirildi, telefonda tegilmagan
  const R = A.SINX.merge(base, phone, pc);
  assert.equal(R.clash.length, 0);
  assert.ok(!("2026-10-12" in marks(R.data, 2)));
  assert.equal(marks(R.data, 3)["2026-10-12"], "10");
});

test("yangi o'quvchi, yangi sinf, yangi ish va mavzu qo'shiladi; boshqa qurilmada o'chirilgan o'quvchi qaytmaydi", () => {
  const base = journal(18), phone = cp(base), pc = cp(base);
  phone.classes[0].students.push({id: "new1", name: "Yangi O'quvchi", marks: {"2026-10-16": "9"}, scores: {}});
  phone.classes.push({...cp(base.classes[0]), name: "8-B"});
  phone.classes[0].works.push({id: "w2", type: "chsb", date: "2026-10-16", max: 40, title: ""});
  phone.classes[0].lessons = {"2026-10-16": {topic: "Kasrlar", hw: "12-mashq"}};
  pc.classes[0].students.splice(5, 1);        // kompyuterda o'chirilgan
  const R = A.SINX.merge(base, phone, pc), c = R.data.classes[0];
  assert.ok(c.students.some((s) => s.id === "new1"));
  assert.ok(!c.students.some((s) => s.id === "s5"), "o'chirilgan o'quvchi qaytmadi");
  assert.deepEqual(R.data.classes.map((x) => x.name), ["7-A", "8-B"]);
  assert.ok(c.works.some((w) => w.id === "w2"));
  assert.equal(c.lessons["2026-10-16"].topic, "Kasrlar");
});

test("asos yo'q (birinchi ulanish): Telegram'da bo'sh kataklar shu qurilmadan to'ldiriladi, farqlar — ziddiyat", () => {
  const phone = journal(18), pc = journal(18);
  marks(phone, 0)["2026-10-13"] = "9";        // kompyuterda bo'sh
  marks(phone, 1)["2026-10-12"] = "6";        // kompyuterda 8
  const R = A.SINX.merge(null, phone, pc);
  assert.equal(marks(R.data, 0)["2026-10-13"], "9");
  assert.equal(R.clash.length, 1);
  assert.equal(R.clash[0].student, "O'quvchi 02");
});
