// Umumiy bot — Google Apps Script serveri (bot-server/gas/Code.gs): ulanish, ruxsatlar, admin, guruhlar.
import test from "node:test";
import assert from "node:assert/strict";
import {makeGas} from "./gas_harness.mjs";

const ADMIN = 100, T1 = 200, T2 = 300;
const start = (S, id, t, name = "Dilnoza Karimova") => S.push({message: {from: {id, first_name: name, username: "u" + id}, chat: {id, type: "private"}, text: t ? "/start " + t : "/start"}});
function connect(S, id, t) { S.post({a: "new", t, d: "Chrome · Android"}); start(S, id, t); return S.get({a: "link", t}); }
const api = (S, k, m, p = {}, f) => S.post({a: "api", k, m, p, f});
function mk() { const S = makeGas(); assert.equal(S.get({a: "setup", s: "sir"}).ok, true); return S; }

test("sozlash: webhook o'chiriladi, har daqiqalik trigger bir marta qo'shiladi", () => {
  const S = makeGas();
  assert.equal(S.get({a: "setup", s: "xato"}).ok, false);
  const r = S.get({a: "setup", s: "sir"});
  assert.equal(r.bot, "YoqlamaJurnalbot");
  assert.ok(S.log.some((x) => x.m === "deleteWebhook"));
  S.get({a: "setup", s: "sir"});
  assert.deepEqual(S.triggers.map((t) => t.getHandlerFunction()), ["tick"]);
  assert.equal(S.get({}).bot, "YoqlamaJurnalbot");
});

test("bitta tugma: /start ilova so'raganda qayta ishlanadi, kalit bir marta beriladi", () => {
  const S = mk(), t = "tA1234567890abcdefXY";
  assert.equal(S.get({a: "link", t}).st, "none", "hali Boshlash bosilmagan");
  S.post({a: "new", t, d: "Chrome · Android"});
  assert.equal(S.get({a: "link", t}).st, "new");
  start(S, T1, t);
  const r = S.get({a: "link", t});
  assert.equal(r.st, "ok"); assert.equal(r.chat, T1); assert.equal(r.bot, "YoqlamaJurnalbot"); assert.ok(r.key.length >= 60);
  assert.ok(S.log.some((x) => x.m === "sendMessage" && x.p.chat_id === T1 && /Ilova ulandi/.test(x.p.text)));
  const adm = S.log.find((x) => x.m === "sendMessage" && x.p.chat_id === ADMIN);
  assert.match(adm.p.text, /Yangi o'qituvchi ulandi/); assert.match(adm.p.text, /Chrome · Android/);
  assert.equal(S.get({a: "link", t}).st, "none");
  // ilova «new» ni yubora olmagan bo'lsa ham ulanadi
  const t2 = "tB1234567890abcdefXY"; start(S, T2, t2);
  assert.equal(S.get({a: "link", t: t2}).st, "ok");
  // yangilanish ikki marta qayta ishlanmaydi
  const n = S.log.length; S.ctx.tick(); assert.equal(S.log.filter((x) => x.m !== "getUpdates").length, S.log.slice(0, n).filter((x) => x.m !== "getUpdates").length);
});

test("uzatish: o'z chati va o'zi qo'shgan guruh, fayl base64 dan blob bo'ladi", () => {
  const S = mk();
  const {key} = connect(S, T1, "tC1234567890abcdefXY"), {key: key2} = connect(S, T2, "tD1234567890abcdefXY");
  const doc = {document: {n: "journal.json", t: "application/json", b: Buffer.from('{"classes":[]}').toString("base64")}};
  let r = api(S, key, "sendDocument", {chat_id: String(T1), caption: "zaxira"}, doc);
  assert.equal(r.ok, true);
  const sd = S.log.at(-1); assert.equal(sd.m, "sendDocument"); assert.deepEqual(sd.p.document, {size: 14, type: "application/json", name: "journal.json"}); assert.equal(sd.p.k, undefined);
  r = api(S, key, "sendMessage", {chat_id: String(T1), text: "x", reply_markup: {inline_keyboard: []}});
  assert.equal(r.ok, true); assert.equal(typeof S.log.at(-1).p.reply_markup, "string");
  assert.equal(api(S, key, "sendMessage", {chat_id: String(T2), text: "x"}).error_code, 403);
  assert.equal(api(S, "soxta", "sendMessage", {chat_id: String(T1), text: "x"}).error_code, 401);
  assert.equal(api(S, key, "getUpdates", {}).error_code, 403);
  S.push({my_chat_member: {chat: {id: -555, type: "group", title: "7-A ota-onalar"}, from: {id: T1}, new_chat_member: {status: "member", user: {id: 1}}}});
  assert.deepEqual(api(S, key, "myGroups").result, [{id: -555, title: "7-A ota-onalar"}], "myGroups yangilanishlarni o'zi oladi");
  assert.equal(api(S, key, "sendPhoto", {chat_id: "-555", photo: "PH1"}).ok, true);
  assert.equal(api(S, key2, "sendPhoto", {chat_id: "-555", photo: "PH1"}).error_code, 403);
  assert.equal(api(S, key, "getChat", {chat_id: "-555"}).error_code, 403);
  S.push({message: {chat: {id: -555, type: "group"}, migrate_to_chat_id: -100555}}); S.ctx.tick();
  assert.equal(api(S, key, "sendMessage", {chat_id: "-100555", text: "x"}).ok, true);
  S.push({my_chat_member: {chat: {id: -100555, type: "supergroup", title: "7-A"}, from: {id: T1}, new_chat_member: {status: "kicked", user: {id: 1}}}}); S.ctx.tick();
  assert.equal(api(S, key, "sendMessage", {chat_id: "-100555", text: "x"}).error_code, 403);
  S.push({my_chat_member: {chat: {id: -9, type: "group", title: "Begona"}, from: {id: 999}, new_chat_member: {status: "member", user: {id: 1}}}}); S.ctx.tick();
  assert.ok(S.log.some((x) => x.m === "leaveChat" && x.p.chat_id === -9));
});

test("admin: bloklash, Tasdiq bilan rejimi, ro'yxat va holat", () => {
  const S = mk();
  const {key} = connect(S, T1, "tE1234567890abcdefXY");
  S.push({callback_query: {id: "q1", from: {id: ADMIN}, data: "bl:" + T1}}); S.ctx.tick();
  assert.equal(api(S, key, "sendMessage", {chat_id: String(T1), text: "x"}).error_code, 401);
  S.push({callback_query: {id: "q2", from: {id: T2}, data: "ub:" + T1}}); S.ctx.tick();
  assert.equal(S.log.filter((x) => x.m === "answerCallbackQuery").at(-1).p.text, "Faqat admin uchun");
  S.push({message: {from: {id: ADMIN}, chat: {id: ADMIN, type: "private"}, text: "🟢 Tasdiqsiz ulanish"}}); S.ctx.tick();
  const t = "tF1234567890abcdefXY";
  S.post({a: "new", t, d: ""}); start(S, T2, t);
  assert.equal(S.get({a: "link", t}).st, "wait");
  const req = S.log.find((x) => x.p.chat_id === ADMIN && /Yangi o'qituvchi<\/b>/.test(x.p.text || ""));
  assert.deepEqual(req.p.reply_markup.inline_keyboard[0].map((b) => b.callback_data), ["ok:" + T2, "no:" + T2]);
  S.push({callback_query: {id: "q3", from: {id: ADMIN}, data: "ok:" + T2, message: {chat: {id: ADMIN}, message_id: 5}}});
  const r = S.get({a: "link", t});
  assert.equal(r.st, "ok"); assert.equal(api(S, r.key, "sendMessage", {chat_id: String(T2), text: "x"}).ok, true);
  S.push({message: {from: {id: ADMIN}, chat: {id: ADMIN, type: "private"}, text: "👥 O'qituvchilar"}}); S.ctx.tick();
  assert.match(S.log.filter((x) => x.m === "sendMessage").at(-1).p.text, /O'qituvchilar: 2 ta/);
  S.push({message: {from: {id: ADMIN}, chat: {id: ADMIN, type: "private"}, text: "📈 Holat"}}); S.ctx.tick();
  assert.match(S.log.filter((x) => x.m === "sendMessage").at(-1).p.text, /Bloklangan: 1/);
  // eski havolalar tozalanadi
  S.props.set("l:eskiHavola1234567890", JSON.stringify({st: "new", at: 1})); S.ctx.tick();
  assert.equal(S.props.has("l:eskiHavola1234567890"), false);
});
