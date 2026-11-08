// Saqlash qatlami (docs/saqlash.js): migratsiya va bir martalik sozlama o'zgarishlari.
import {test} from "node:test";
import assert from "node:assert/strict";
import {loadApp} from "./webapp.mjs";

const A = loadApp("2026-10-20");
const raw = (web = {}, settings = {}) => A.normalize({version: 2, settings: {quarters: [null, null, null, null], ...settings}, classes: [], web});

test("bir martalik o'zgarishlar eski faylda bir marta bajariladi va belgilanadi", () => {
  const d = A.migrate(raw({font: "times", density: "compact"}, {method_weekday: 3}));
  assert.equal(d.web.font, "system");
  assert.equal(d.web.style, "dash");
  assert.ok(!("density" in d.web));
  assert.equal(d.settings.method_weekday, null);
  assert.deepEqual([...d.web.once].sort(), ["fonts", "nomethod", "ui26"]);
  assert.equal(d.web.dv, 2);
});

test("bajarilgan o'zgarish qayta bajarilmaydi: o'qituvchi tanlagan uslub saqlanib qoladi", () => {
  const d = A.migrate(raw({font: "lserif", style: "classic", ui26: 1, once: ["fonts", "ui26", "nomethod"], dv: 2}));
  assert.equal(d.web.font, "lserif");
  assert.equal(d.web.style, "classic");
});

test("yangiroq ilovada saqlangan ma'lumotga tegilmaydi", () => {
  const d = A.migrate(raw({dv: 99, font: "times"}));
  assert.equal(d.web.font, "times");
  assert.equal(d.web.once, undefined);
});
