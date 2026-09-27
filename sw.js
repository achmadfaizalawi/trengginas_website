// ⚡ TRENGGINAS WQMS Service Worker v2.2
// FIXED: Real-time monitoring pages get FRESH data!
// FIXED: Support clean URLs (no .html extension)!

const VERSION = '2.2';
const CACHE_STATIC = `trengginas-static-v${VERSION}`;
const CACHE_DYNAMIC = `trengginas-dynamic-v${VERSION}`;
const CACHE_IMAGES = `trengginas-images-v${VERSION}`;

// ==========================================
// STATIC ASSETS ONLY - No HTML pages here!
// ==========================================
const STATIC_ASSETS = [
    // Bootstrap (Critical for layout)
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
    
    // Icons (Critical for UI)
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    
    // Google Fonts (Poppins)
    'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap',
    
    // Leaflet (untuk dashboard map)
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    
    // Chart.js (untuk visualisasi)
    'https://cdn.jsdelivr.net/npm/chart.js',
    
    // SweetAlert2 (untuk alerts)
    'https://cdn.jsdelivr.net/npm/sweetalert2@11',
    
    // SheetJS (untuk Excel export)
    'https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js'
];

// ==========================================
// REAL-TIME PAGES - Always fetch fresh!
// Support both .html and clean URLs
// ==========================================
const REALTIME_PAGES = [
    '/',
    '/index',
    '/index.html',
    '/dashboard',
    '/dashboard.html'
];

// ==========================================
// STATIC PAGES - Can be cached
// Support both .html and clean URLs
// ==========================================
const STATIC_PAGES = [
    '/laporan',
    '/laporan.html',
    '/statistik',
    '/statistik.html',
    '/serial',
    '/serial_numbers',
    '/serial_numbers.html'
];

// ==========================================
// INSTALL - Cache static assets only
// ==========================================
self.addEventListener('install', (event) => {
    console.log(`[SW v${VERSION}] 🚀 Installing...`);
    console.log('[SW] ⚠️ FIXED: Real-time pages will ALWAYS fetch fresh data!');
    
    event.waitUntil(
        caches.open(CACHE_STATIC).then(cache => {
            console.log('[SW] 📦 Caching static assets (libraries only)...');
            return cache.addAll(STATIC_ASSETS).catch(err => {
                console.warn('[SW] Some assets failed to cache:', err);
            });
        }).then(() => {
            // Cache static pages separately (not real-time pages!)
            return caches.open(CACHE_DYNAMIC).then(cache => {
                console.log('[SW] 📄 Caching static pages...');
                return Promise.allSettled(
                    STATIC_PAGES.map(url => cache.add(url).catch(e => console.warn('Failed:', url)))
                );
            });
        }).then(() => {
            console.log('[SW] ✅ Installation complete!');
        })
    );
    
    self.skipWaiting();
});

// ==========================================
// ACTIVATE - Clean old caches
// ==========================================
self.addEventListener('activate', (event) => {
    console.log(`[SW v${VERSION}] 🔄 Activating...`);
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            const validCaches = [CACHE_STATIC, CACHE_DYNAMIC, CACHE_IMAGES];
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (!validCaches.includes(cacheName)) {
                        console.log('[SW] 🗑️ Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[SW] ✅ Activated!');
        })
    );
    
    return self.clients.claim();
});

// ==========================================
// FETCH - Smart routing based on resource type
// ==========================================
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-HTTP
    if (!url.protocol.startsWith('http')) return;
    
    // Skip non-GET
    if (request.method !== 'GET') return;
    
    // ==========================================
    // STRATEGY ROUTING
    // ==========================================
    
    // 1. REAL-TIME MONITORING PAGES → Network First (ALWAYS FRESH!)
    if (isRealtimePage(request.url)) {
        console.log('[SW] 🔴 Real-time page → Network First:', url.pathname);
        event.respondWith(networkFirstRealtime(request));
    }
    
    // 2. API REQUESTS → Network First (ALWAYS FRESH!)
    else if (isApiRequest(request.url)) {
        console.log('[SW] 🔴 API request → Network First');
        event.respondWith(networkFirstRealtime(request));
    }
    
    // 3. STATIC ASSETS (CSS/JS/Fonts) → Cache First (fast!)
    else if (isStaticAsset(request.url)) {
        event.respondWith(cacheFirstFast(request, CACHE_STATIC));
    }
    
    // 4. IMAGES → Cache First (fast!)
    else if (isImage(request.url)) {
        event.respondWith(cacheFirstFast(request, CACHE_IMAGES));
    }
    
    // 5. STATIC PAGES (laporan, statistik) → Stale-While-Revalidate
    else if (isStaticPage(request.url)) {
        event.respondWith(staleWhileRevalidate(request, CACHE_DYNAMIC));
    }
    
    // 6. EVERYTHING ELSE → Network First
    else {
        event.respondWith(networkFirstRealtime(request));
    }
});

// ==========================================
// HELPER: Detect resource types
// ==========================================

function isRealtimePage(url) {
    return REALTIME_PAGES.some(page => url.includes(page)) || url.endsWith('/');
}

function isStaticPage(url) {
    return STATIC_PAGES.some(page => url.includes(page));
}

function isApiRequest(url) {
    return url.includes('/api/') || 
           url.includes('trengginas_api.php') ||
           url.includes('get_') ||
           url.includes('_data.php') ||
           url.includes('fetchData');
}

function isStaticAsset(url) {
    return url.includes('cdn.jsdelivr.net') ||
           url.includes('cdnjs.cloudflare.com') ||
           url.includes('fonts.googleapis.com') ||
           url.includes('fonts.gstatic.com') ||
           url.includes('unpkg.com') ||
           url.includes('cdn.sheetjs.com') ||
           url.endsWith('.css') ||
           url.endsWith('.js') ||
           url.endsWith('.woff2') ||
           url.endsWith('.woff') ||
           url.endsWith('.ttf');
}

function isImage(url) {
    return /\.(jpg|jpeg|png|gif|svg|webp|ico)$/i.test(url) ||
           url.includes('/assets/') ||
           url.includes('/images/');
}

// ==========================================
// STRATEGY 1: Network First (for real-time data!)
// ==========================================
async function networkFirstRealtime(request) {
    try {
        // ALWAYS try network first (timeout: 5 seconds)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(request, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        // Cache successful responses as backup
        if (response.ok) {
            const cache = await caches.open(CACHE_DYNAMIC);
            cache.put(request, response.clone());
        }
        
        return response;
        
    } catch (error) {
        console.log('[SW] ⚠️ Network failed, trying cache fallback...');
        
        // Only if network COMPLETELY fails, use cache
        const cached = await caches.match(request);
        if (cached) {
            console.log('[SW] 💾 Serving stale cache (offline mode)');
            return cached;
        }
        
        // If cache also fails, throw error
        throw error;
    }
}

// ==========================================
// STRATEGY 2: Cache First (for static assets)
// ==========================================
async function cacheFirstFast(request, cacheName) {
    try {
        const cached = await caches.match(request);
        if (cached) {
            return cached;
        }
        
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
        }
        return response;
        
    } catch (error) {
        console.error('[SW] Cache first failed:', error);
        throw error;
    }
}

// ==========================================
// STRATEGY 3: Stale-While-Revalidate (for static pages)
// ==========================================
async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    
    // Fetch fresh in background
    const fetchPromise = fetch(request).then(response => {
        if (response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    }).catch(() => null);
    
    // Return cached if available, otherwise wait for network
    return cached || fetchPromise;
}

// ==========================================
// MESSAGE HANDLERS
// ==========================================
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        console.log('[SW] 🗑️ Clearing all caches...');
        caches.keys().then(names => {
            names.forEach(name => caches.delete(name));
        });
    }
});