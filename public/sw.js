/* Papyrus PWA Service Worker v3 — Offline Shell, Developer Update Detection & Web Push / Duolingo Reminders */
const CACHE_NAME = 'papyrus-pwa-v3';
const SHELL_ASSETS = [
  './',
  './manifest.webmanifest',
  './favicon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

let reminderState = {
  enabled: true,
  lastActiveAt: Date.now(),
  unfinishedTitle: '',
  lastNudgedAt: 0,
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .catch(() => undefined)
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data) return;
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (data.type === 'PAPYRUS_HEARTBEAT') {
    reminderState = {
      ...reminderState,
      enabled: data.enabled !== false,
      lastActiveAt: data.timestamp || Date.now(),
      unfinishedTitle: data.unfinishedTitle || '',
    };
    return;
  }
  if (data.type === 'PAPYRUS_SHOW_NOTIFICATION' && data.title) {
    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: data.tag || 'papyrus-alert',
        data: { url: data.url || '/' },
      })
    );
  }
});

// Real Web Push handler — fires OS notifications even when Papyrus tab/PWA is completely closed!
self.addEventListener('push', (event) => {
  let payload = {
    title: '🦉 Papyrus nhắc học tập!',
    body: 'Quay lại hoàn thành bài học dang dở và giữ vững chuỗi Streak của bạn nhé!',
    url: '/',
    tag: 'papyrus-push',
  };
  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch {
      payload.body = event.data.text() || payload.body;
    }
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: payload.tag,
      data: { url: payload.url || '/' },
    })
  );
});

// Periodic background sync (where supported on Android/Chrome PWA) for 20-hour Duolingo nudge
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'papyrus-20h-reminder' && reminderState.enabled) {
    const idleMs = Date.now() - reminderState.lastActiveAt;
    if (idleMs >= 20 * 3600 * 1000 && Date.now() - reminderState.lastNudgedAt > 12 * 3600 * 1000) {
      reminderState.lastNudgedAt = Date.now();
      const body = reminderState.unfinishedTitle
        ? `📜 Bộ đề "${reminderState.unfinishedTitle}" vẫn đang dang dở! Vào hoàn thành nốt 3 phút để giữ chuỗi 🔥 nhé!`
        : '🦉 Đã 20 giờ bạn chưa ghé Papyrus! Vào bắn 1 ván Cung Thủ 3D để không mất chuỗi Streak hôm nay nhé!';
      event.waitUntil(
        self.registration.showNotification('🔥 Đừng để vụt mất chuỗi học tập Papyrus!', {
          body,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          tag: 'papyrus-20h-nudge',
          data: { url: '/' },
        })
      );
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client && targetUrl) {
            client.navigate(targetUrl).catch(() => undefined);
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith('/version.json') || url.pathname === '/version.json') {
    event.respondWith(fetch(request, { cache: 'no-store' }));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('./', copy)).catch(() => undefined);
          }
          return response;
        })
        .catch(() => caches.match('./').then((cached) => cached || Response.error()))
    );
    return;
  }

  if (
    url.pathname.includes('/_expo/static/') ||
    url.pathname.includes('/icons/') ||
    /\.(?:png|webp|svg|woff2|ttf|glb)$/i.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined);
          }
          return response;
        });
      })
    );
  }
});
