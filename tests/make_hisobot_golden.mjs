// hisobot_golden.json ni web ilova asosida qayta yaratadi (hisob qoidasi ATAYLAB o'zgartirilgandagina):
//   node tests/make_hisobot_golden.mjs
// so'ng dastur/hisobot_sqlite.py ham shunga mos bo'lishi kerak (pytest tests/test_sqlite.py).
import {readFileSync, writeFileSync} from "node:fs";
import {loadApp} from "./webapp.mjs";
import {hisobotWeb, H_TODAY} from "./hisobot_web.mjs";
const here = new URL(".", import.meta.url);
const norm = (v) => v === undefined || v === null ? null : typeof v === "number" ? (Object.is(Math.round(v * 1e6) / 1e6, -0) ? 0 : Math.round(v * 1e6) / 1e6)
  : Array.isArray(v) ? v.map(norm) : typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, norm(x)])) : v;
const H = JSON.parse(readFileSync(new URL("fixtures/hisobot.json", here), "utf8"));
writeFileSync(new URL("hisobot_golden.json", here), JSON.stringify(norm(hisobotWeb(loadApp(H_TODAY), H)), null, 1) + "\n");
console.log("tests/hisobot_golden.json yangilandi");
