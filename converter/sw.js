/*
 * CCBuilder converter-scoped service worker.
 * When the GitHub Actions Pages artifact includes LibreOffice, delegate isolation
 * and versioned compressed WASM caching to the upstream worker.
 * Branch-only Pages publishes cannot provide the WASM asset; gracefully fall back
 * to a lightweight, versioned same-origin runtime cache for browser libraries.
 *
 * Scope is /converter/: never intercept Builder pages or uploaded documents.
 */
'use strict';
self.OFFICE_ENGINE_DIR = 'office-converter/';
let hasOfficeRuntime = false;
try {
  importScripts('office-converter/service-worker.js');
  hasOfficeRuntime = true;
} catch (error) {
  console.warn('LibreOffice runtime not published; browser fallback service worker active.', error);
}
if (!hasOfficeRuntime) {
  const CACHE_PREFIX = 'ccbuilder-browser-runtime-';
  const CACHE_NAME = CACHE_PREFIX + '20261104-v1';
  const dependencies = new Set([
    'vendor/jszip.min.js',
    'vendor/docx-preview.min.js',
    'vendor/html2canvas.min.js',
    'vendor/fflate.min.js'
  ]);
  const scope = self.registration.scope;
  function isDependency(request) {
    if (request.method !== 'GET') return false;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin || !url.href.startsWith(scope)) return false;
    return dependencies.has(url.pathname.slice(new URL(scope).pathname.length));
  }
  function isolated(response) {
    if (response.type === 'opaque' || response.status === 0) return response;
    const headers = new Headers(response.headers);
    headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
    headers.set('Cross-Origin-Resource-Policy', 'same-origin');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', event => event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n.startsWith(CACHE_PREFIX) && n !== CACHE_NAME).map(n => caches.delete(n)));
    await self.clients.claim();
  })()));
  self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;
    if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    event.respondWith((async()=>{
      if (!isDependency(request)) return isolated(await fetch(request));
      const cache = await caches.open(CACHE_NAME);
      // Ignore version query strings for immutable runtime assets, but not filenames.
      const key = new URL(url.pathname, self.location.origin).href;
      const cached = await cache.match(key);
      if (cached) return isolated(cached);
      const network = await fetch(request);
      if (network.ok) {
        await cache.put(key, network.clone()).catch(error => console.warn('Runtime asset cache unavailable', error));
      }
      return isolated(network);
    })());
  });
  self.addEventListener('message', event => {
    if (event.data?.type === 'clear-runtime-cache') {
      event.waitUntil(caches.delete(CACHE_NAME));
    }
  });
}
