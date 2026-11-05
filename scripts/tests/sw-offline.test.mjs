// Runs public/sw.js against fake caches and a fake network: node scripts/tests/sw-offline.test.mjs
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert";

const store = new Map();
const cache = {
  async match(r) { const u = typeof r === "string" ? new URL(r, "https://x.test").href : r.url; const v = store.get(u); return v ? v.clone() : undefined; },
  async put(r, res) { store.set(typeof r === "string" ? new URL(r, "https://x.test").href : r.url, res); },
  async delete(r) { return store.delete(r.url); },
  async keys() { return [...store.keys()].map((u) => new Request(u)); },
  async add() {},
};
let online = true;
const handlers = {};
const self = { location: { origin: "https://x.test" }, addEventListener: (t, f) => (handlers[t] = f), skipWaiting() {}, clients: { claim() {} }, registration: {} };
const ctx = { self, caches: { open: async () => cache, match: (r) => cache.match(r), keys: async () => [], delete: async () => true }, fetch: async (req) => { if (!online) throw new Error("offline"); return new Response(`<html>${new URL(req.url).pathname}</html>`, { status: 200 }); }, Request, Response, Headers, URL, setTimeout, Promise, Date, Object, Number, String, Set };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync("public/sw.js", "utf8").replace(/^const /gm, "var "), ctx);

const nav = async (path) => {
  const req = new Request("https://x.test" + path);
  Object.defineProperty(req, "mode", { value: "navigate" });
  let out;
  handlers.fetch({ request: req, respondWith: (p) => (out = p) });
  const res = await out;
  return res.status === 302 ? "REDIRECT " + new URL(res.headers.get("location")).pathname + new URL(res.headers.get("location")).search : res.text();
};

await cache.put("/offline", new Response("OFFLINE"));
assert.equal(await nav("/progress"), "<html>/progress</html>", "online passes through");
online = false;
assert.equal(await nav("/progress"), "<html>/progress</html>", "a visited screen opens offline");
assert.equal(await nav("/"), "OFFLINE", "an unvisited screen with no home copy shows the offline page");
online = true;
await nav("/");
await nav("/workout");
online = false;
assert.equal(await nav("/library"), "<html>/</html>", "an unvisited tab falls back to the saved home screen");
assert.equal(await nav("/workout"), "<html>/workout</html>", "a fresh session reopens");
online = true;
await nav("/complete");
online = false;
assert.equal(await nav("/workout"), "REDIRECT /workout/offline", "after finishing, the old session page is gone and Start opens the copy kept on the phone");
assert.equal(await nav("/workout?date=2026-11-05"), "REDIRECT /workout/offline?date=2026-11-05", "Start keeps its date");
console.log("sw offline: all passed");
