/* Kutilmagan xatolar: oxirgi 20 tasi "yoqlama_xatolar" kalitida saqlanadi va o'qituvchiga xabar chiqadi (10 soniyada bittadan ko'p emas).
   Brauzer kengaytmalari va boshqa saytlar skriptlaridagi xatolar e'tiborga olinmaydi. */
(function () {
  var KEY = "yoqlama_xatolar", last = 0;
  function note(msg, src) {
    msg = String(msg || "Noma'lum xato").slice(0, 300);
    if (/ResizeObserver loop|Script error\.?$/.test(msg)) return;
    try { var a = JSON.parse(localStorage.getItem(KEY) || "[]"); a.push({t: new Date().toLocaleString("sv").replace(" ", "T"), msg: msg, src: String(src || "").slice(0, 200), url: location.hash});
      localStorage.setItem(KEY, JSON.stringify(a.slice(-20))); } catch (e) { /* xotira yopiq */ }
    if (Date.now() - last < 10000) return; last = Date.now();
    var say = "Kutilmagan xato yuz berdi. Ma'lumotlaringiz saqlangan; sahifani yangilang. Takrorlansa, Sozlamalar → Ma'lumotlar → «Xatolar ro'yxati» ni yuboring.";
    if (typeof toast === "function") { try { toast(say); return; } catch (e) { /* pastga */ } }
    setTimeout(function () { if (typeof toast === "function") toast(say); }, 1500);
  }
  window.addEventListener("error", function (e) {
    if (e.filename && e.filename.indexOf(location.origin) !== 0 && location.protocol !== "file:") return;
    if (!e.message && e.target && e.target !== window) return;   // yuklanmagan rasm yoki skript — alohida ishlanadi
    note(e.message, (e.filename || "").split("/").pop() + ":" + e.lineno);
  });
  window.addEventListener("unhandledrejection", function (e) { var r = e.reason; note(r && r.message || r, "promise"); });
  window.ERRLOG = {key: KEY, list: function () { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; } },
    clear: function () { try { localStorage.removeItem(KEY); } catch (e) { /* */ } }};
})();
