// Eksport/Telegram fayl nomlari: tutuq belgisi (' ʻ ʼ ‘ ’) olib tashlanmasligi kerak (Akmal, 2026-11-13: «fayl nomidagi ' ko'rinmay qolyapti»).
// Fayl nomini tozalovchi har bir «[^\p{L}\p{N}…]» belgi to'plamida tutuq belgilari bo'lishi shart.
import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync, readdirSync} from "node:fs";

const dir = new URL("../docs/", import.meta.url);
const files = readdirSync(dir).filter((f) => /\.(js|html)$/.test(f));
// kalit/solishtirish uchun ishlatiladiganlar (fayl nomi emas): .replace(/[^\p{L}\p{N}]/gu, "")
const isKey = (line, i) => /^\]\/gu,\s*""\)/.test(line.slice(i));

test("fayl nomlarini tozalashda tutuq belgisi saqlanadi", () => {
  const bad = [];
  for (const f of files) {
    readFileSync(new URL(f, dir), "utf8").split("\n").forEach((line, n) => {
      for (const m of line.matchAll(/\[\^\\p\{L\}\\p\{N\}([^\]]*)/g)) {
        if (isKey(line, m.index + m[0].length)) continue;
        if (![..."'ʻʼ‘’"].every((ch) => m[1].includes(ch))) bad.push(`${f}:${n + 1}: ${m[0]}`);
      }
    });
  }
  assert.deepEqual(bad, [], "fayl nomida tutuq belgisi o'chib ketadi");
});

test("Telegram PDF nomi: tutuq belgisi qoladi", () => {
  const src = readFileSync(new URL("pdf-tg.js", dir), "utf8"), m = src.match(/const safe = (\(s\) => [^;]+);/);
  assert.ok(m, "pdf-tg.js: safe() topilmadi");
  const safe = eval(m[1]);
  assert.equal(safe("Davomat varag'i 6-A · O'zbek tili"), "Davomat varag'i 6-A · O'zbek tili");
  assert.equal(safe("Gʻ ʼ ‘ ’"), "Gʻ ʼ ‘ ’");
});
