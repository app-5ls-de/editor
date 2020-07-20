const CACHE = "static-cache-v1.4.0";
const precacheFiles = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/quill-v1.3.6/quill.js',
  '/quill-v1.3.6/quill.snow.css',
  '/normalize.css-v8.0.1/normalize.min.css',
  '/ifvisible.js-v1.0.6/ifvisible.js',
  '/local',
  '/shared',
  '/new',
  '/main.css',
  '/main.js',
  '/quill.js',
  '/quill.css',
  '/logo16px.png',
  '/logo24px.png',
  '/logo32px.png',
  '/logo64px.png',
  '/logo128px.png',
  '/logo256px.png',
  '/logo512px.png',
  '/logo192px.png',
  '/favicon-16x16.png',
  '/favicon-32x32.png'
];


self.addEventListener("install", function (event) {
  console.log("[ServiceWorker] Install Event processing");

  console.log("[ServiceWorker] Skip waiting on install");
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      console.log("[ServiceWorker] Caching pages during install");
      return cache.addAll(precacheFiles);
    })
  );
});

// Allow sw to control of current page
self.addEventListener("activate", function (event) {
  console.log("[ServiceWorker] Claiming clients for current page");
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE) {
          console.log('[ServiceWorker] Removing old cache', key);
          return caches.delete(key);
        }
      }));
    })
  );
  event.waitUntil(self.clients.claim());
});

// If any fetch fails, it will look for the request in the cache and serve it from there first
self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fromCache(event.request).then(
      function (response) {
        // The response was found in the cache so we responde with it and update the entry

        // This is where we call the server to get the newest version of the
        // file to use the next time we show view
        event.waitUntil(
          fetch(event.request).then(function (response) {
            return updateCache(event.request, response);
          })
        );

        return response;
      },
      function () {
        // The response was not found in the cache so we look for it on the server
        return fetch(event.request)
          .then(function (response) {
            // If request was success, add or update it in the cache
            event.waitUntil(updateCache(event.request, response.clone()));

            return response;
          })
          .catch(function (error) {
            console.log("[ServiceWorker] Network request failed and no cache." + error);
          });
      }
    )
  );
});

function fromCache(request) {
  // Check to see if you have it in the cache
  // Return response
  // If not in the cache, then return
  return caches.open(CACHE).then(function (cache) {
    return cache.match(request).then(function (matching) {
      if (!matching || matching.status === 404) {
        return Promise.reject("no-match");
      }

      return matching;
    });
  });
}

function updateCache(request, response) {
  return caches.open(CACHE).then(function (cache) {
    return cache.put(request, response);
  });
}
