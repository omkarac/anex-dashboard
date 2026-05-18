/**
 * Anex Sales — Service Worker v2
 * Strategy: Network-first for data, Cache-first for static assets.
 * Push notifications for: missed follow-ups, visit reminders, EOD alerts.
 */

const APP_VERSION   = 'v2';
const CACHE_STATIC  = `anex-static-${APP_VERSION}`;
const CACHE_PAGES   = `anex-pages-${APP_VERSION}`;
const CACHE_DATA    = `anex-data-${APP_VERSION}`;

// Pages to pre-cache for offline use
const PRECACHE_PAGES = [
  '/sales/dashboard',
  '/sales/meetings/new',
  '/sales/walk-ins/new',
  '/sales/tasks',
  '/sales/calendar',
  '/offline',
];

// Static assets to cache
const PRECACHE_STATIC = [
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ── INSTALL ──────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_STATIC).then((c) => c.addAll(PRECACHE_STATIC)),
      caches.open(CACHE_PAGES).then((c) => c.addAll(PRECACHE_PAGES).catch(() => {})),
    ])
  );
  self.skipWaiting();
});

// ── ACTIVATE ─────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n.startsWith('anex-') && !n.includes(APP_VERSION))
          .map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

// ── FETCH ────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET
  if (request.method !== 'GET') return;

  // Skip Chrome extensions
  if (url.protocol === 'chrome-extension:') return;

  // 1. API + Supabase: Network-only (never cache auth or data writes)
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase') ||
    url.hostname.includes('googleapis')
  ) {
    event.respondWith(fetch(request));
    return;
  }

  // 2. Static assets (fonts, icons, images): Cache-first
  if (
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname.startsWith('/icons/')
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) => cached || fetch(request).then((response) => {
          caches.open(CACHE_STATIC).then((c) => c.put(request, response.clone()));
          return response;
        })
      )
    );
    return;
  }

  // 3. Next.js static chunks: Cache-first
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) => cached || fetch(request).then((response) => {
          caches.open(CACHE_STATIC).then((c) => c.put(request, response.clone()));
          return response;
        })
      )
    );
    return;
  }

  // 4. Sales pages: Network-first, fall back to cache, then offline page
  if (url.pathname.startsWith('/sales/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          caches.open(CACHE_PAGES).then((c) => c.put(request, response.clone()));
          return response;
        })
        .catch(() =>
          caches.match(request).then(
            (cached) => cached || caches.match('/offline')
          )
        )
    );
    return;
  }

  // 5. Everything else: Network with cache fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// ── PUSH NOTIFICATIONS ───────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try { data = event.data.json(); }
  catch { return; }

  const { title, body, type, url, badge } = data;

  // Notification options vary by type
  const options = {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    data: { url: url || '/sales/tasks' },
    vibrate: [100, 50, 100],
    tag: type || 'general',  // collapse same-type notifications
    renotify: type === 'missed_followup',  // re-alert even if tag exists
    requireInteraction: type === 'visit_today',  // stays until dismissed
    actions: buildActions(type),
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

function buildActions(type) {
  switch (type) {
    case 'missed_followup':
      return [
        { action: 'call',    title: '📞 Log Call' },
        { action: 'snooze',  title: '⏰ Snooze 1hr' },
      ];
    case 'visit_today':
      return [
        { action: 'confirm', title: '✅ Confirm Visit' },
        { action: 'open',    title: 'Open Calendar' },
      ];
    case 'eod_reminder':
      return [
        { action: 'open', title: 'Submit EOD' },
        { action: 'dismiss', title: 'Dismiss' },
      ];
    default:
      return [
        { action: 'open',    title: 'Open' },
        { action: 'dismiss', title: 'Dismiss' },
      ];
  }
}

// ── NOTIFICATION CLICK ───────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const { action } = event;
  const { url } = event.notification.data || {};

  if (action === 'dismiss') return;

  const destination = (() => {
    if (action === 'call')    return '/sales/tasks';
    if (action === 'confirm') return '/sales/calendar';
    if (action === 'open')    return url || '/sales/dashboard';
    if (action === 'snooze')  return null; // handled via postMessage
    return url || '/sales/dashboard';
  })();

  if (!destination) return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      // Focus existing window if open
      for (const win of windows) {
        if (win.url.includes('/sales') && 'focus' in win) {
          win.focus();
          win.postMessage({ type: 'navigate', url: destination });
          return;
        }
      }
      // Open new window
      return clients.openWindow(destination);
    })
  );
});

// ── BACKGROUND SYNC ──────────────────────────────────────────
// Queues failed submissions (e.g. meeting logged while offline)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending-meetings') {
    event.waitUntil(syncPendingMeetings());
  }
  if (event.tag === 'sync-pending-walkins') {
    event.waitUntil(syncPendingWalkins());
  }
});

async function syncPendingMeetings() {
  // Read from IndexedDB, POST to /api/sales/meetings, clear on success
  // Implementation populated by Foundation session
  console.log('[SW] Syncing pending meetings');
}

async function syncPendingWalkins() {
  console.log('[SW] Syncing pending walk-ins');
}
