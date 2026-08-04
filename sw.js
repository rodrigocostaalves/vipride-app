/* ============================================================
   VipRide Orlando — Service Worker
   ATENÇÃO: este arquivo NÃO é o worker.js do Cloudflare.
   - sw.js      -> roda no navegador do cliente (offline/cache)
   - worker.js  -> roda no Cloudflare (API + banco D1)
   ============================================================ */

const VERSAO = 'vipride-v1.0.1';
const CACHE_SHELL = `shell-${VERSAO}`;

// Arquivos essenciais para o app abrir mesmo sem internet
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_SHELL)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Falha ao pré-cachear:', err))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(nomes => Promise.all(
        nomes.filter(n => n !== CACHE_SHELL).map(n => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;

  // Só interceptamos GET. POST/PATCH da API passam direto.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Nunca cachear chamadas da API (reservas sempre em tempo real)
  if (url.pathname.includes('/reservas') || url.hostname.endsWith('workers.dev')) {
    return;
  }

  // Navegação: rede primeiro, cache como rede de segurança
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(resp => {
          const copia = resp.clone();
          caches.open(CACHE_SHELL).then(c => c.put('./index.html', copia));
          return resp;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Demais arquivos: cache primeiro, atualizando em segundo plano
  event.respondWith(
    caches.match(req).then(cacheado => {
      const daRede = fetch(req)
        .then(resp => {
          if (resp && resp.status === 200 && resp.type === 'basic') {
            const copia = resp.clone();
            caches.open(CACHE_SHELL).then(c => c.put(req, copia));
          }
          return resp;
        })
        .catch(() => cacheado);
      return cacheado || daRede;
    })
  );
});
