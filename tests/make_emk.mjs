// docs/emk.js ni docs/index.html dagi emkGrab() dan yaratadi: node tests/make_emk.mjs
// (telefon xatcho'pi qisqa — to'liq kodni shu fayldan yuklaydi; test ikkalasi bir xilligini tekshiradi)
import {readFileSync, writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";

const docs = new URL("../docs/", import.meta.url);
export function emkJs(html = readFileSync(new URL("index.html", docs), "utf8")) {
  const i = html.indexOf("\nfunction emkGrab() {"), j = html.indexOf("\n}\n", i);
  if (i < 0 || j < 0) throw new Error("emkGrab topilmadi");
  const src = html.slice(i + 1, j + 2);
  if (!src.includes('"__APP__"')) throw new Error("__APP__ topilmadi");
  return `// Avtomatik yaratilgan: node tests/make_emk.mjs (manba — docs/index.html dagi emkGrab). Qo'lda o'zgartirmang.
(function () {
  var cs = document.currentScript, APPURL = new URL("./", cs ? cs.src : "https://akmal1st.github.io/yoqlama-jurnal/").href;
  (${src.replace('"__APP__"', "APPURL")})();
})();
`;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) writeFileSync(new URL("emk.js", docs), emkJs());
