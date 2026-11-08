// O'zgargan har JS/CSS fayl uchun index.html dagi ?v= raqami ham oshirilgan bo'lishi kerak:
// sw.js versiyali fayllarni keshdan beradi, raqam oshmasa foydalanuvchilar eski faylni ko'radi.
// Asosiy shox (origin/main) bilan solishtiriladi; u yo'q bo'lsa (git tarixisiz nusxa) test o'tkazib yuboriladi.
import {test} from "node:test";
import assert from "node:assert/strict";
import {execSync} from "node:child_process";
import {readFileSync} from "node:fs";

const sh = (c) => execSync(c, {encoding: "utf8", stdio: ["ignore", "pipe", "ignore"]});
let base = null;
try { sh("git rev-parse --verify origin/main"); base = sh("git merge-base origin/main HEAD").trim(); } catch (e) { /* git yo'q */ }
const vOf = (html, f) => (html.match(new RegExp(`"${f.replace(/[.]/g, "\\.")}\\?v=(\\d+)"`)) || [])[1] || null;

test("o'zgargan JS/CSS fayllarda ?v= oshirilgan", {skip: !base && "origin/main topilmadi"}, () => {
  const now = readFileSync(new URL("../docs/index.html", import.meta.url), "utf8");
  let was = ""; try { was = sh(`git show ${base}:docs/index.html`); } catch (e) { return; }
  const changed = sh(`git diff --name-only ${base} -- docs`).split("\n").filter((f) => /^docs\/[^/]+\.(js|css)$/.test(f)).map((f) => f.slice(5));
  const bad = changed.filter((f) => vOf(now, f) && vOf(was, f) && +vOf(now, f) <= +vOf(was, f)).map((f) => `${f} (?v=${vOf(now, f)})`);
  assert.deepEqual(bad, [], "fayl o'zgargan, lekin index.html dagi ?v= oshirilmagan");
});
