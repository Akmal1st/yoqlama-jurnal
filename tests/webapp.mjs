// Web ilova (docs/index.html) skriptini brauzersiz (node:vm) ishga tushiradi: sana qotirilgan, DOM — bo'sh o'rinbosarlar
import {readFileSync} from "node:fs";
import vm from "node:vm";

const read = (p) => readFileSync(new URL(p, new URL(".", import.meta.url)), "utf8");

export function loadApp(today) {
  const html = read("../docs/index.html");
  const src = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));
  const [y, m, d] = today.split("-").map(Number);
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
      emaktabSheet, bsbStats, bsbRecs, worksInQuarter, quarterResult, yearResult, readiness, reportRows, periodNow, label,
      compareRows, compareTotal, sumData, ledgerOf, finOf, grpMonths, gYear, gHeld, gMon, grpAtt, svcOf, finCfg, gradedShare};`, ctx);
  return ctx.__app;
}

