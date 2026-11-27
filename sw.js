const CACHE = "cekcucian-v7";
const FILES = ["./", "./index.html", "./firebase-config.js", "./manifest.json", "./icon-192.png", "./icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x))))); self.clients.claim(); });
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const u = new URL(e.request.url);
  // Hanya file aplikasi dan pustaka Firebase yang disimpan; data Firestore/login tidak disentuh.
  if (u.origin !== self.location.origin && u.hostname !== "www.gstatic.com") return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request).then(r => r || (u.origin === self.location.origin ? caches.match("./index.html") : undefined))));
});

/* Ketuk notifikasi: buka kiriman terkait */
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const id = e.notification.data && e.notification.data.id;
  const url = new URL("./" + (id && id !== "tes" ? "?kiriman=" + encodeURIComponent(id) : ""), self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => {
    for (const c of cs) { if ("focus" in c) { c.postMessage({ open: id }); return c.focus(); } }
    return clients.openWindow(url);
  }));
});

/* Cek pengingat di latar belakang (Chrome Android, aplikasi terpasang) */
function idbOpen() { return new Promise((res, rej) => { const r = indexedDB.open("cekcucian", 2); r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains("foto")) d.createObjectStore("foto"); if (!d.objectStoreNames.contains("meta")) d.createObjectStore("meta"); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
function metaGet(d, k) { return new Promise(res => { const q = d.transaction("meta").objectStore("meta").get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); }
function metaPut(d, k, v) { return new Promise(res => { const t = d.transaction("meta", "readwrite"); t.objectStore("meta").put(v, k); t.oncomplete = t.onerror = () => res(); }); }
async function checkDue() {
  const d = await idbOpen();
  const list = (await metaGet(d, "reminders")) || [];
  const shown = new Set((await metaGet(d, "shown")) || []);
  const now = Date.now();
  for (const r of list) {
    if (shown.has(r.key) || r.t > now || now - r.t > 12 * 3600e3) continue;
    await self.registration.showNotification(r.title, { body: r.body, icon: "icon-192.png", badge: "icon-192.png", tag: "ambil-" + r.id, requireInteraction: true, data: { id: r.id } });
    shown.add(r.key);
  }
  await metaPut(d, "shown", [...shown].slice(-300));
  d.close();
}
self.addEventListener("periodicsync", e => { if (e.tag === "cek-pengingat") e.waitUntil(checkDue()); });
