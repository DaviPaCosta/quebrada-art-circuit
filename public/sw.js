// "Ajudante" do app instalável: abre rápido e mostra uma tela amigável sem internet.
// Nunca guarda dados do Supabase (posts, contas, fotos): esses sempre vêm da internet.
const VERSION = "vozes-v2";
const SHELL = ["/offline.html", "/icons/icon-192.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return; // Supabase e outros sites: direto na rede

  // Páginas: sempre tenta a versão nova; sem internet, mostra a tela "Sem internet".
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
    return;
  }

  // Arquivos do app com nome único (JS/CSS/imagens do build): guarda para abrir mais rápido.
  // (Ícones não têm nome único, então só /assets/ fica guardado; a cada versão nova do ajudante o cache é refeito.)
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
