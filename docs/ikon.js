/* Emojilar o'rniga Bootstrap Icons (vendor/bootstrap-icons-1.11.3.css).
   Kodda emojilar qoladi (Telegram, Excel, nusxalash matnlarida kerak), ekranga chiqqanda esa
   DOM'dagi matn ichidagi emoji <i class="bi …"> ikonkaga almashtiriladi. Kiritish maydonlari,
   textarea, <option>, contenteditable va .noicon ichiga tegilmaydi. */
const IKON = (() => {
  const M = {
    "🏠": "house-door", "👥": "people", "📒": "journal-text", "📊": "bar-chart", "⚙": "gear", "❓": "question-circle", "❔": "question-circle",
    "📅": "calendar3", "🗓": "calendar-month", "📆": "calendar-week", "🕒": "clock-history", "🕘": "clock", "⏳": "hourglass-split",
    "💾": "floppy", "📋": "clipboard", "📌": "pin-angle", "📝": "pencil-square", "✎": "pencil", "✏": "pencil", "✍": "pencil-fill",
    "🔍": "search", "🔎": "search", "🔒": "lock", "🔓": "unlock", "🔐": "shield-lock", "⚠": "exclamation-triangle",
    "✈": "telegram", "✉": "envelope", "💬": "chat-dots", "🔔": "bell", "📞": "telephone", "📲": "phone-vibrate",
    "👤": "person", "🧑": "person", "👪": "person-hearts", "📇": "person-vcard", "🎓": "mortarboard", "🏫": "building",
    "⭐": "star-fill", "🎂": "cake2", "🎲": "dice-5", "🪑": "grid-3x3-gap", "🃏": "card-checklist", "✋": "hand-index-thumb", "👍": "hand-thumbs-up",
    "📚": "journal-bookmark", "📖": "book", "📗": "journal", "📘": "journal", "📄": "file-earmark-text", "📂": "folder2-open",
    "🗄": "archive", "📦": "box-seam", "📤": "upload", "📥": "download", "⬇": "download", "🖨": "printer", "🔗": "link-45deg",
    "📈": "graph-up", "🎯": "bullseye", "🧮": "calculator", "🏆": "trophy", "🎉": "stars", "💡": "lightbulb",
    "🧩": "puzzle", "🎨": "palette", "👁": "eye", "🌓": "circle-half", "🌙": "moon", "☀": "sun", "⌨": "keyboard",
    "🖥": "display", "💻": "laptop", "📱": "phone", "🌐": "globe", "⛶": "arrows-fullscreen", "☰": "list",
    "⏸": "pause-circle", "🗑": "trash", "❌": "x-circle", "✅": "check-square-fill", "⬜": "square", "🔲": "square",
    "🟢": "circle-fill", "⚪": "circle", "⚫": "circle-fill", "➕": "plus-lg", "🔄": "arrow-repeat", "🔀": "shuffle",
    "↶": "arrow-counterclockwise", "↺": "arrow-counterclockwise", "↻": "arrow-clockwise", "⚖": "distribute-horizontal",
  };
  const COL = {"⭐": "bi-gold", "✅": "bi-ok", "🟢": "bi-ok", "❌": "bi-bad"};
  const keys = Object.keys(M).sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const RE = new RegExp(`(${keys.join("|")})\\uFE0F?`, "g"), TEST = new RegExp(RE.source);
  const SKIP = new Set(["TEXTAREA", "INPUT", "SELECT", "OPTION", "SCRIPT", "STYLE", "TITLE", "CANVAS", "svg"]);
  let on = true;
  try { on = localStorage.getItem("yoqlama_emoji") !== "1"; } catch (e) {}
  const html = (ch) => `<i class="bi bi-${M[ch]}${COL[ch] ? " " + COL[ch] : ""}" aria-hidden="true"></i>`;
  // matndagi emojilarni ikonka HTML'iga almashtiradi (matn esc qilingan bo'lishi kerak)
  const str = (s) => String(s).replace(RE, (m, ch) => html(ch));
  const strip = (s) => String(s).replace(RE, "").replace(/^\s+/, "");
  function skip(el) {
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      if (SKIP.has(e.nodeName) || e.isContentEditable || e.classList.contains("noicon")) return true;
    }
    return false;
  }
  function node(t) {
    const s = t.nodeValue; if (!TEST.test(s) || skip(t.parentElement)) return;
    const f = document.createDocumentFragment(); let last = 0;
    s.replace(RE, (m, ch, i) => {
      if (i > last) f.appendChild(document.createTextNode(s.slice(last, i)));
      const ic = document.createElement("i"); ic.className = `bi bi-${M[ch]}${COL[ch] ? " " + COL[ch] : ""}`; ic.setAttribute("aria-hidden", "true");
      f.appendChild(ic); last = i + m.length; return m;
    });
    if (last < s.length) f.appendChild(document.createTextNode(s.slice(last)));
    t.parentNode.replaceChild(f, t);
  }
  function attrs(el) {
    if (el.placeholder && TEST.test(el.placeholder)) el.placeholder = strip(el.placeholder);
    if (el.nodeName === "OPTION" && TEST.test(el.textContent)) el.textContent = strip(el.textContent);
  }
  function scan(root) {
    if (!on || !root) return;
    if (root.nodeType === 3) { node(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 11) return;
    if (root.nodeType === 1) attrs(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null), todo = [];
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (n.nodeType === 3) { if (TEST.test(n.nodeValue)) todo.push(n); } else if (n.placeholder || n.nodeName === "OPTION") attrs(n);
    }
    todo.forEach(node);
  }
  function start() {
    if (!on) return;
    document.documentElement.classList.add("bi-on");
    scan(document.body);
    new MutationObserver((ms) => {
      for (const m of ms) {
        if (m.type === "characterData") scan(m.target);
        else m.addedNodes.forEach(scan);
      }
    }).observe(document.body, {childList: true, subtree: true, characterData: true});
  }
  if (typeof document !== "undefined" && document.addEventListener) {
    if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
  }
  return {map: M, str, strip, scan, get on() { return on; }};
})();
