// Gutter Service Worker - Basic offline support with static asset caching

const CACHE_NAME = "gutter-v1";
const STATIC_ASSETS = [
  "/",
  "/journal",
  "/journal/month",
  "/dashboard",
  "/globals.css",
];

// Install event - cache static assets
self.addEventListener("install", (event) => {
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        // Don't fail the install if some assets fail to cache
        return Promise.resolve();
      });
    })
  );

  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            return caches.delete(name);
          })
      );
    })
  );

  // Take control of all pages immediately
  self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // Skip API calls (always go to network)
  if (request.url.includes("/api/")) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Clone the response before caching
        const responseToCache = response.clone();

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });

        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }

          // No cache match, return a basic offline page or error
          if (request.headers.get("accept").includes("text/html")) {
            return new Response(
              `
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>Offline - Gutter</title>
                  <style>
                    body {
                      margin: 0;
                      padding: 0;
                      font-family: system-ui, -apple-system, sans-serif;
                      background: #0d0f1a;
                      color: #c8ccd8;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      min-height: 100vh;
                      text-align: center;
                    }
                    .container {
                      padding: 2rem;
                    }
                    h1 {
                      color: #ff6ec7;
                      margin-bottom: 1rem;
                    }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <h1>You're Offline</h1>
                    <p>Gutter needs an internet connection to load this page.</p>
                    <p>Check your connection and try again.</p>
                  </div>
                </body>
              </html>
              `,
              {
                headers: { "Content-Type": "text/html" },
              }
            );
          }

          return new Response("Offline", { status: 503 });
        });
      })
  );
});
