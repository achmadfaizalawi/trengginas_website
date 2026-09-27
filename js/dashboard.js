        // ==========================================
        // KONFIGURASI & VARIABEL GLOBAL
        // ==========================================
        // Auto-detect API base URL (support trengginas.com dan trengginas.tech)
        const currentDomain = window.location.hostname;
        const API_BASE = window.location.origin + '/api/';
        
        // ==========================================
        // MAPTILER CONFIGURATION 🗺️
        // ==========================================
        const MAPTILER_CONFIG = {
            // 🔑 API KEY - Get yours FREE at: https://www.maptiler.com/cloud/
            // Free tier: 100,000 tile loads/month (enough for most use cases!)
            apiKey: 'eNsZ9slhyHZZdi0LmvoT',  // ✅ Your MapTiler API key
            
            // 🎨 MAP STYLES - Pick your favorite!
            styles: {
                streets: 'streets-v2',           // ⭐ Clean modern (RECOMMENDED)
                basic: 'basic-v2',               // Minimalist simple
                outdoor: 'outdoor-v2',           // Topographic style
                satellite: 'satellite',          // Real satellite imagery
                hybrid: 'hybrid',                // Satellite + labels
                topo: 'topo-v2',                 // Detailed topographic
                winter: 'winter-v2',             // Winter theme
                dataviz: 'dataviz'               // Data visualization optimized
            },
            
            // 🎯 ACTIVE STYLE - Change this to switch map style!
            activeStyle: 'hybrid'  // ✅ Satellite + labels (clear, no blur!) Options: streets, basic, outdoor, satellite, hybrid, topo, winter, dataviz
        };
        
        // 📝 Note: If you don't have API key yet:
        // 1. Visit: https://www.maptiler.com/cloud/
        // 2. Sign up FREE (takes 2 minutes)
        // 3. Go to: Account → API Keys
        // 4. Copy your API key
        // 5. Paste above in 'apiKey' field
        // 6. Reload page → Beautiful map! ✨

        let map;

        // Initial map view settings (for reset function)
        const INITIAL_CENTER = [-2.5489, 118.0149];
        const INITIAL_ZOOM = 16;  // ✅ User's perfect zoom level!
        let initialMapBounds = null;  // Store initial map bounds after first load
        let isInitialLoad = true;  // Track if this is first load (for auto-fit bounds)
        let markers = {};  // Ubah dari array ke object: { trengginas_id: marker }
        let userData = {};
        let popupRefreshInterval = null;  // Track auto-refresh interval for open popup

        // ✅ ADVANCED: Client-Side Caching
        const CACHE_DURATION = 15000; // 15 seconds
        let statusCache = {
            data: null,
            timestamp: 0,
            trengginas_ids: ''
        };

        // Toast configuration
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
            didOpen: (toast) => {
                toast.addEventListener('mouseenter', Swal.stopTimer)
                toast.addEventListener('mouseleave', Swal.resumeTimer)
            }
        });

        // ==========================================
        // INISIALISASI
        // ==========================================
        document.addEventListener('DOMContentLoaded', function () {
            // Load user data from localStorage (same format as index.html)
            const storedUser = localStorage.getItem('wqms_user');

            if (storedUser) {
                const user = JSON.parse(storedUser);

                // Set user data from parsed JSON
                userData = {
                    userId: user.id || user.user_id,
                    username: user.username,
                    fullName: user.full_name || user.username,
                    role: user.role,
                    assignedStationId: user.assigned_station_id || ''
                };

                console.log('User data loaded:', userData);
            } else {
                // Fallback jika tidak ada user data (untuk testing)
                console.warn('No user data found in localStorage');
                userData = {
                    userId: '1',
                    username: 'Guest',
                    fullName: 'Guest User',
                    role: 'operator',
                    assignedStationId: ''
                };
            }

            // Tampilkan info user
            document.getElementById('user-name-display').textContent = userData.fullName;
            document.getElementById('user-role-display').textContent = userData.role.toUpperCase();

            // Show/hide admin menu (ONLY superuser)
            if (userData.role === 'superuser') {
                document.getElementById('superuser-menu').classList.remove('hidden');
            }

            // Set tanggal
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            document.getElementById('current-date').textContent = new Date().toLocaleDateString('id-ID', options);

            // Sidebar state management - class already applied by inline script
            // Just ensure localStorage is set and update icon
            const sidebarState = localStorage.getItem('sidebar_collapsed');
            if (sidebarState === null) {
                // First time - set localStorage (class already added by inline script)
                localStorage.setItem('sidebar_collapsed', 'true');
            }

            // Update toggle icon based on current state
            const icon = document.getElementById('toggleIcon');
            if (document.body.classList.contains('sb-collapsed')) {
                icon.classList.remove('fa-chevron-left');
                icon.classList.add('fa-chevron-right');
            }

            // Inisialisasi Map
            initMap();

            // Load stasiun
            loadStations();

            // Resize map after sidebar state is applied
            if (map) {
                setTimeout(() => {
                    map.invalidateSize();
                }, 500); // Wait for initial render
            }

            // Auto-refresh setiap 10 DETIK untuk update status real-time
            // (seperti Overview, tapi sedikit lebih lambat karena map lebih berat)
            setInterval(loadStations, 10000);

            // Populate parameter checkboxes for station modal
            populateParamCheckboxes();

            // Close mobile sidebar when clicking outside (on overlay)
            document.addEventListener('click', function (e) {
                if (document.body.classList.contains('show-sidebar')) {
                    const sidebar = document.querySelector('.sidebar');
                    const mobileToggle = document.getElementById('mobile-toggle');

                    // If click is outside sidebar and not on the toggle button
                    if (!sidebar.contains(e.target) && e.target !== mobileToggle) {
                        document.body.classList.remove('show-sidebar');
                    }
                }
            });
        });

        // ==========================================
        // AVAILABLE PARAMETERS
        // ==========================================
        const AVAILABLE_PARAMS = {
            'ph': { label: 'pH', unit: '', color: '#4e73df', icon: 'fa-water' },
            'cod': { label: 'COD', unit: 'mg/L', color: '#e74a3b', icon: 'fa-flask' },
            'tss': { label: 'TSS', unit: 'mg/L', color: '#1cc88a', icon: 'fa-vial' },
            'ammonia': { label: 'Amonia', unit: 'mg/L', color: '#f6c23e', icon: 'fa-skull-crossbones' },
            'debit': { label: 'Debit', unit: 'm3/h', color: '#36b9cc', icon: 'fa-tachometer-alt' },
            'temperature': { label: 'Temperatur', unit: '°C', color: '#e74a3b', icon: 'fa-thermometer-half' },
            'do': { label: 'DO', unit: 'mg/L', color: '#4e73df', icon: 'fa-tint' },
            'turbidity': { label: 'Kekeruhan', unit: 'NTU', color: '#858796', icon: 'fa-eye-slash' },
            'tds': { label: 'TDS', unit: 'ppm', color: '#f6c23e', icon: 'fa-atom' },
            'nitrate': { label: 'Nitrat', unit: 'mg/L', color: '#1cc88a', icon: 'fa-leaf' },
            'bod': { label: 'BOD', unit: 'mg/L', color: '#e74a3b', icon: 'fa-bacterium' },
            'water_level': { label: 'Level Air', unit: 'm', color: '#36b9cc', icon: 'fa-ruler-vertical' }
        };

        function populateParamCheckboxes() {
            const checkboxContainer = document.getElementById('param-checkboxes');
            for (const [key, conf] of Object.entries(AVAILABLE_PARAMS)) {
                checkboxContainer.innerHTML += `
                    <div class="col-6">
                        <div class="form-check">
                            <input class="form-check-input param-check" type="checkbox" value="${key}" id="param-${key}" checked>
                            <label class="form-check-label small" for="param-${key}">
                                ${conf.label} (${conf.unit || '-'})
                            </label>
                        </div>
                    </div>
                `;
            }
        }

        // ==========================================
        // STATION MODAL FUNCTIONS
        // ==========================================
        function openStationModal() {
            const modalEl = document.getElementById('stationModal');
            const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
            document.getElementById('stationForm').reset();
            modal.show();
        }

        async function saveStation() {
            let selectedParams = [];
            document.querySelectorAll('.param-check:checked').forEach(cb => selectedParams.push(cb.value));

            if (selectedParams.length === 0) {
                Swal.fire('Warning', "Pilih minimal 1 parameter!", 'warning');
                return;
            }

            try {
                const res = await fetch(`${API_BASE}admin/add_station.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ params: selectedParams })
                });
                const result = await res.json();

                if (result.status === 'success') {
                    const modalEl = document.getElementById('stationModal');
                    const modal = bootstrap.Modal.getInstance(modalEl);
                    modal.hide();

                    Swal.fire({
                        title: 'Stasiun Siap!',
                        html: `<p>ID Trengginas:</p><h2 class="text-primary border p-2 bg-light rounded user-select-all">${result.data.trengginas_id}</h2><p class="small text-muted mt-2">Salin ID ini ke Aplikasi.</p>`,
                        icon: 'success',
                        confirmButtonText: 'Oke, Saya Mengerti'
                    }).then(() => loadStations());
                } else {
                    Swal.fire('Gagal', result.message, 'error');
                }
            } catch (e) {
                Swal.fire('Error', e.message, 'error');
            }
        }

        function goToUserManagement() {
            sessionStorage.setItem('goto_view', 'users');
            window.location.href = 'index.html';
        }

        function goToOverview() {
            sessionStorage.setItem('goto_view', 'stations');
            window.location.href = 'index.html';
        }

        // ==========================================
        // SIDEBAR FUNCTIONS
        // ==========================================
        function toggleMobileSidebar() {
            document.body.classList.toggle('show-sidebar');
        }

        function closeMobileSidebar() {
            // Close sidebar if in mobile/burger mode (when show-sidebar class is active)
            if (document.body.classList.contains('show-sidebar')) {
                document.body.classList.remove('show-sidebar');
            }
        }

        function toggleDesktopSidebar() {
            document.body.classList.toggle('sb-collapsed');
            const icon = document.getElementById('toggleIcon');
            const isCollapsed = document.body.classList.contains('sb-collapsed');

            if (isCollapsed) {
                icon.classList.remove('fa-chevron-left');
                icon.classList.add('fa-chevron-right');
            } else {
                icon.classList.remove('fa-chevron-right');
                icon.classList.add('fa-chevron-left');
            }

            // Save state to localStorage
            localStorage.setItem('sidebar_collapsed', isCollapsed.toString());

            // Resize map after sidebar animation completes
            if (map) {
                setTimeout(() => {
                    map.invalidateSize();
                }, 400); // Match transition speed
            }
        }

        function logout() {
            Swal.fire({
                title: 'Yakin ingin keluar?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Ya, Logout',
                cancelButtonText: 'Batal'
            }).then((result) => {
                if (result.isConfirmed) {
                    // Show splash screen
                    showSplashScreen('Keluar dari sistem...');
                    
                    // Clear user data
                    localStorage.removeItem('wqms_user');
                    sessionStorage.clear();
                    
                    // Smooth transition
                    setTimeout(() => {
                        updateSplashMessage('Sampai jumpa lagi!');
                        setTimeout(() => {
                            window.location.href = '/index.html';
                        }, 500);
                    }, 800);
                }
            });
        }

        // ==========================================
        // PROFILE MANAGEMENT
        // ==========================================
        function openProfileModal() {
            const modalEl = document.getElementById('profileModal');
            const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
            document.getElementById('profile-fullname').value = userData.fullName || "";
            document.getElementById('profile-password').value = "";
            document.getElementById('profile-password-confirm').value = "";
            modal.show();
        }

        async function saveProfile() {
            const newName = document.getElementById('profile-fullname').value;
            const newPass = document.getElementById('profile-password').value;
            const confirmPass = document.getElementById('profile-password-confirm').value;

            if (!newName) {
                Swal.fire('Error', 'Nama Lengkap wajib diisi', 'warning');
                return;
            }

            if (newPass && newPass !== confirmPass) {
                Swal.fire('Error', 'Konfirmasi password tidak cocok', 'warning');
                return;
            }

            const fullPayload = {
                id: userData.userId,
                username: userData.username,
                full_name: newName,
                password: newPass,
                role: userData.role,
                assigned_station_ids: userData.assignedStationId || ''
            };

            try {
                const res = await fetch(`${API_BASE}admin/save_user.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(fullPayload)
                });

                const result = await res.json();

                if (result.status === 'success') {
                    // Update userData
                    userData.fullName = newName;

                    // Update localStorage
                    const storedUser = {
                        id: userData.userId,
                        username: userData.username,
                        full_name: newName,
                        role: userData.role
                    };
                    localStorage.setItem('wqms_user', JSON.stringify(storedUser));

                    // Update display
                    document.getElementById('user-name-display').textContent = newName;

                    // Close modal
                    const modalEl = document.getElementById('profileModal');
                    const modal = bootstrap.Modal.getInstance(modalEl);
                    modal.hide();

                    Toast.fire({ icon: 'success', title: 'Profil berhasil diperbarui!' });
                } else {
                    Swal.fire('Error', result.message, 'error');
                }
            } catch (e) {
                Swal.fire('Error', e.message, 'error');
            }
        }

        function togglePassword(inputId, iconElement) {
            const input = document.getElementById(inputId);
            if (!iconElement) return;

            if (input.type === "password") {
                input.type = "text";
                iconElement.classList.remove('fa-eye');
                iconElement.classList.add('fa-eye-slash');
            } else {
                input.type = "password";
                iconElement.classList.remove('fa-eye-slash');
                iconElement.classList.add('fa-eye');
            }
        }

        // ==========================================
        // INISIALISASI MAP
        // ==========================================
        function initMap() {
            // Initial map view settings (for reset function)
            // Default center: Indonesia (Jakarta)
            map = L.map('map').setView(INITIAL_CENTER, INITIAL_ZOOM);

            // ==========================================
            // 🗺️ MAPTILER TILE LAYER (Beautiful Maps!)
            // ==========================================
            
            // Check if API key is set
            if (MAPTILER_CONFIG.apiKey === 'YOUR_MAPTILER_API_KEY_HERE') {
                console.warn('⚠️ MapTiler API key not set! Using OpenStreetMap fallback.');
                console.log('📝 To use MapTiler:');
                console.log('1. Get FREE API key: https://www.maptiler.com/cloud/');
                console.log('2. Update MAPTILER_CONFIG.apiKey in dashboard.html');
                console.log('3. Reload page for beautiful maps! ✨');
                
                // Fallback to OpenStreetMap
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors',
                    maxZoom: 18,
                }).addTo(map);
            } else {
                // Use MapTiler! 🎨
                const style = MAPTILER_CONFIG.styles[MAPTILER_CONFIG.activeStyle] || 'streets-v2';
                
                // ✅ OPTIMIZED: Use @2x (retina) tiles for sharper satellite imagery!
                const tileUrl = `https://api.maptiler.com/maps/${style}/{z}/{x}/{y}@2x.png?key=${MAPTILER_CONFIG.apiKey}`;
                
                L.tileLayer(tileUrl, {
                    attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank">© MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap contributors</a>',
                    // ✅ No zoom restrictions - test freely to find your perfect zoom!
                    tileSize: 512,
                    zoomOffset: -1,
                    detectRetina: true  // Auto-detect retina displays for best quality
                }).addTo(map);
                
                console.log(`✅ MapTiler loaded with '${MAPTILER_CONFIG.activeStyle}' style (High-Res @2x tiles)!`);
            }
            
        }

        // ==========================================
        // RESET MAP VIEW
        // ==========================================
        function resetMapView() {
            console.log('resetMapView() called');
            
            if (!map) {
                console.error('ERROR: Map is not initialized!');
                Toast.fire({
                    icon: 'error',
                    title: 'Error: Peta belum siap'
                });
                return;
            }
            
            // ✅ FIXED: Re-enable auto-fit for reset
            isInitialLoad = true;
            
            // Reload stations to trigger auto-fit bounds
            loadStations();
            
            Toast.fire({
                icon: 'success',
                title: 'Peta direset ke tampilan awal'
            });
        }

        // ==========================================
        // ADVANCED: CACHED STATUS FETCH
        // ==========================================
        async function fetchStationsStatus(stationIds) {
            const now = Date.now();
            const idsString = stationIds;
            
            // Check if cache is valid and for same stations
            if (statusCache.data && 
                statusCache.trengginas_ids === idsString &&
                (now - statusCache.timestamp) < CACHE_DURATION) {
                console.log('✅ Using cached status (saved ~500ms)');
                return statusCache.data;
            }
            
            // Fetch fresh data
            console.log('🔄 Fetching fresh status from server');
            const response = await fetch(`${API_BASE}get_all_stations_status.php?trengginas_ids=${idsString}&threshold=5`);
            const data = await response.json();
            
            // Update cache
            statusCache = {
                data: data,
                timestamp: now,
                trengginas_ids: idsString
            };
            
            return data;
        }

        // ==========================================
        // LOAD STATIONS
        // ==========================================
        async function loadStations() {
            try {
                // ✅ ULTRA-FAST: Start fetching stations immediately
                const stationsPromise = fetch(`${API_BASE}get_stations.php?user_id=${userData.userId}`);
                
                // Wait for stations response
                const response = await stationsPromise;
                const stations = await response.json();

                if (!stations || stations.length === 0) {
                    return;
                }

                // Filter stasiun yang punya koordinat
                const validStations = stations.filter(s => s.latitude && s.longitude);

                // ✅ ULTRA-FAST: Fetch status with caching
                const stationIds = validStations.map(st => st.trengginas_id).join(',');
                const batchData = await fetchStationsStatus(stationIds);
                
                // Create status map dari batch response
                const statusMap = {};
                if (batchData.status === 'success' && batchData.data) {
                    batchData.data.forEach(item => {
                        let online = item.online || false;
                        
                        // ✅ CLIENT-SIDE VALIDATION: Verify status using last_update timestamp
                        if (item.last_update) {
                            try {
                                // FIX: Parse timestamp sebagai WIB (UTC+7) agar tidak terpengaruh timezone browser
                                const lastUpdateWIB = new Date(item.last_update.replace(' ', 'T') + '+07:00');
                                const now = new Date();
                                const minutesAgo = Math.floor((now - lastUpdateWIB) / 1000 / 60);
                                
                                // ⚠️ OVERRIDE: Force offline if data > 5 minutes old
                                if (minutesAgo > 5) {
                                    if (online) {
                                        console.warn(`⚠️ [Status Override] ${item.trengginas_id}: API says ONLINE but last data ${minutesAgo} minutes ago → Forcing OFFLINE`);
                                    }
                                    online = false;
                                } else {
                                    console.log(`✅ [Status Check] ${item.trengginas_id}: ${online ? 'ONLINE' : 'OFFLINE'} (last data ${minutesAgo}m ago)`);
                                }
                            } catch (err) {
                                console.error('Error parsing timestamp:', err);
                            }
                        }
                        
                        statusMap[item.trengginas_id] = online;
                    });
                }

                // Count active/inactive berdasarkan REAL-TIME status
                const activeCount = Object.values(statusMap).filter(online => online).length;
                const inactiveCount = validStations.length - activeCount;

                // Update stats dengan REAL-TIME count
                document.getElementById('totalStations').textContent = validStations.length;
                document.getElementById('activeStations').textContent = activeCount;
                document.getElementById('inactiveStations').textContent = inactiveCount;

                // Track station IDs yang masih aktif
                const activeStationIds = new Set();

                // ✅ OPTIMIZED: Parallel marker creation tanpa await
                const markerPromises = validStations.map(station => {
                    activeStationIds.add(station.trengginas_id);
                    station.isOnline = statusMap[station.trengginas_id] || false; // Attach real-time status

                    if (markers[station.trengginas_id]) {
                        // Marker sudah ada, UPDATE saja (synchronous)
                        updateStationMarker(station);
                        return Promise.resolve();
                    } else {
                        // Marker belum ada, CREATE baru (async tapi parallel)
                        return addStationMarker(station);
                    }
                });

                // Wait for all markers to be created/updated
                await Promise.all(markerPromises);

                // Hapus markers yang tidak ada di data baru
                Object.keys(markers).forEach(stationId => {
                    if (!activeStationIds.has(stationId)) {
                        map.removeLayer(markers[stationId]);
                        delete markers[stationId];
                    }
                });
                // ✅ AUTO-FIT BOUNDS: ONLY on initial load!
                const markerCount = Object.keys(markers).length;
                
                if (markerCount > 0 && isInitialLoad) {
                    // Only auto-fit on FIRST load, not on refresh!
                    const markerArray = Object.values(markers);
                    
                    if (markerCount === 1) {
                        // ✅ Single station: Zoom to INITIAL_ZOOM (16)
                        const marker = markerArray[0];
                        const latlng = marker.getLatLng();
                        map.setView(latlng, INITIAL_ZOOM, { animate: true });
                        console.log('✅ Initial load: Single station zoomed to level', INITIAL_ZOOM);
                    } else {
                        // ✅ Multiple stations: Fit bounds to show ALL stations!
                        const group = new L.featureGroup(markerArray);
                        const bounds = group.getBounds().pad(0.1); // 10% padding
                        map.fitBounds(bounds, { animate: true });
                        console.log(`✅ Initial load: ${markerCount} stations auto-fitted to show all!`);
                        
                        // Save initial bounds for reset function
                        initialMapBounds = bounds;
                    }
                    
                    // Mark initial load as complete
                    isInitialLoad = false;
                    console.log('✅ Initial load complete. Auto-fit disabled for subsequent refreshes.');
                } else if (markerCount > 0 && !isInitialLoad) {
                    // Refresh: Just update markers, NO auto-fit!
                    console.log(`🔄 Refresh: ${markerCount} stations updated (no auto-fit, map position preserved)`);
                }

            } catch (error) {
                console.error('Error loading stations:', error);
            }
        }

        // ==========================================
        // UPDATE STATION MARKER (tanpa recreate)
        // ==========================================
        function updateStationMarker(station) {
            const marker = markers[station.trengginas_id];
            if (!marker) return;

            // ✅ UPDATE COORDINATES: Check if position changed
            const currentLatLng = marker.getLatLng();
            const newLat = parseFloat(station.latitude);
            const newLon = parseFloat(station.longitude);
            
            if (!isNaN(newLat) && !isNaN(newLon)) {
                if (currentLatLng.lat !== newLat || currentLatLng.lng !== newLon) {
                    // Coordinates changed! Update marker position
                    marker.setLatLng([newLat, newLon]);
                    console.log(`📍 ${station.trengginas_id}: Coordinates updated to [${newLat}, ${newLon}]`);
                }
            }

            // Update icon color berdasarkan REAL-TIME status (bukan database status!)
            const iconColor = station.isOnline ? '#10b981' : '#ef4444'; // Green if online, Red if offline
            const customIcon = L.divIcon({
                className: 'custom-marker',
                html: `<div style="
                    background-color: ${iconColor};
                    width: 30px;
                    height: 30px;
                    border-radius: 50%;
                    border: 3px solid white;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                "></div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });

            // Update icon (tanpa remove marker dari map)
            marker.setIcon(customIcon);

            // Update tooltip
            marker.setTooltipContent(station.name || station.trengginas_id);

            // Simpan data station terbaru di marker (untuk popup)
            marker.stationData = station;
        }

        // ==========================================
        // ADD STATION MARKER
        // ==========================================
        async function addStationMarker(station) {
            const lat = parseFloat(station.latitude);
            const lon = parseFloat(station.longitude);

            if (isNaN(lat) || isNaN(lon)) return;

            // Custom icon berdasarkan REAL-TIME status (bukan database status!)
            const iconColor = station.isOnline ? '#10b981' : '#ef4444'; // Green if online, Red if offline
            const customIcon = L.divIcon({
                className: 'custom-marker',
                html: `<div style="
                    background: ${iconColor};
                    width: 30px;
                    height: 30px;
                    border-radius: 50%;
                    border: 3px solid white;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                "></div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });

            // Create marker
            const marker = L.marker([lat, lon], { icon: customIcon }).addTo(map);

            // Tooltip (hover)
            marker.bindTooltip(station.name || station.trengginas_id, {
                permanent: false,
                direction: 'top',
                offset: [0, -15]
            });

            // Simpan data station di marker (untuk update nanti)
            marker.stationData = station;

            // ✅ FIXED: Bind popup sekali dengan loading content
            const loadingContent = `
    <div class="popup-header">
        <h3>${station.name || station.trengginas_id}</h3>
    </div>
    <div class="popup-body text-center py-4">
        <div class="spinner-border spinner-border-sm text-primary"></div>
        <p class="small text-muted mt-2 mb-0">Memuat data...</p>
    </div>
`;
            
            marker.bindPopup(loadingContent, { maxWidth: 280, minWidth: 280 });
            // ✅ AUTO-REFRESH: Update popup content function
            async function updatePopupContent(marker, station) {
                try {
                    const currentStation = marker.stationData || station;
                    const content = await generatePopupContent(currentStation);
                    marker.setPopupContent(content);
                } catch (err) {
                    console.error('Error updating popup:', err);
                }
            }

            // ✅ FIXED: Gunakan event 'popupopen' untuk load data fresh setiap popup dibuka
            marker.on('popupopen', async function () {
                const currentStation = marker.stationData || station;
                
                // Reset ke loading state
                marker.setPopupContent(loadingContent);
                
                // Initial load
                await updatePopupContent(marker, currentStation);
                
                // ✅ AUTO-REFRESH: Start auto-refresh every 5 seconds
                if (popupRefreshInterval) {
                    clearInterval(popupRefreshInterval);
                }
                popupRefreshInterval = setInterval(() => {
                    updatePopupContent(marker, currentStation);
                }, 5000); // Refresh setiap 5 detik
                
                console.log('[Dashboard] ✅ Popup auto-refresh started (5s interval)');
            });
            
            // ✅ AUTO-REFRESH: Stop auto-refresh when popup closes
            marker.on('popupclose', function () {
                if (popupRefreshInterval) {
                    clearInterval(popupRefreshInterval);
                    popupRefreshInterval = null;
                    console.log('[Dashboard] 🛑 Popup auto-refresh stopped');
                }
            });

            // Simpan marker ke object dengan key trengginas_id
            markers[station.trengginas_id] = marker;
        }

        // ==========================================
        // GENERATE POPUP CONTENT
        // ==========================================
        async function generatePopupContent(station) {
            try {
                // ✅ FIXED: Check status dengan endpoint baru
                const statusResponse = await fetch(
                    `${API_BASE}get_station_status.php?trengginas_id=${station.trengginas_id}&threshold=5`
                );
                const statusData = await statusResponse.json();
                const isOnline = statusData.online || false;

                // Fetch latest sensor data untuk tampilkan nilai parameter
                let response = await fetch(
                    `${API_BASE}get_station_data.php?trengginas_id=${station.trengginas_id}&type=2min&limit=1`
                );
                let data = await response.json();

                let lastUpdateTime = statusData.last_update || '-';

                // Parse visible params
                const visibleParams = station.visible_params
                    ? station.visible_params.split(',').map(p => p.trim())
                    : ['ph', 'cod', 'tss', 'ammonia', 'debit', 'temperature', 'do'];

                // Parameter mapping - SAMA PERSIS dengan index.html
                const paramMap = {
                    'ph': { label: 'pH', unit: '', column: 'ph' },
                    'cod': { label: 'COD', unit: 'mg/L', column: 'cod' },
                    'tss': { label: 'TSS', unit: 'mg/L', column: 'tss' },
                    'ammonia': { label: 'Amonia', unit: 'mg/L', column: 'ammonia' },
                    'debit': { label: 'Debit', unit: 'm3/h', column: 'debit' },
                    'temperature': { label: 'Temperatur', unit: '°C', column: 'temperature' },
                    'do': { label: 'DO', unit: 'mg/L', column: 'do' },
                    'turbidity': { label: 'Kekeruhan', unit: 'NTU', column: 'turbidity' },
                    'tds': { label: 'TDS', unit: 'ppm', column: 'tds' },
                    'nitrate': { label: 'Nitrat', unit: 'mg/L', column: 'nitrate' },
                    'bod': { label: 'BOD', unit: 'mg/L', column: 'bod' },
                    'water_level': { label: 'Level Air', unit: 'm', column: 'water_level' }
                };

                let sensorsHTML = '';

                if (data && data.length > 0) {
                    const latestData = data[0];


                    // ✅ LOAD THRESHOLDS DULU
                    let stationThresholds = {};
                    try {
                        const thresholdRes = await fetch(`${API_BASE}get_thresholds.php?trengginas_id=${station.trengginas_id}`);
                        const thresholdData = await thresholdRes.json();
                        if (thresholdData.status === 'success') {
                            stationThresholds = thresholdData.data;
                        }
                    } catch (e) {
                        console.log('No thresholds found:', e);
                    }

                    // ✅ HELPER FUNCTION: Get Threshold Color
                    function getThresholdColor(value, threshold) {
                        if (!threshold || !threshold.enabled) return 'default';

                        const val = parseFloat(value);
                        if (isNaN(val)) return 'default';

                        const minSafe = threshold.min_safe !== null ? parseFloat(threshold.min_safe) : null;
                        const maxSafe = threshold.max_safe !== null ? parseFloat(threshold.max_safe) : null;
                        const minWarn = threshold.min_warning !== null ? parseFloat(threshold.min_warning) : null;
                        const maxWarn = threshold.max_warning !== null ? parseFloat(threshold.max_warning) : null;

                        let isInSafeRange = true;
                        if (minSafe !== null && val < minSafe) isInSafeRange = false;
                        if (maxSafe !== null && val > maxSafe) isInSafeRange = false;
                        if (isInSafeRange) return 'safe';

                        let isInWarningRange = true;
                        if (minWarn !== null && val < minWarn) isInWarningRange = false;
                        if (maxWarn !== null && val > maxWarn) isInWarningRange = false;
                        if (isInWarningRange) return 'warning';

                        return 'danger';
                    }

                    sensorsHTML = '<div class="sensor-list">';

                    let paramCount = 0;
                    // ✅ LOOP SESUAI URUTAN AVAILABLE_PARAMS (bukan visibleParams)
                    Object.keys(paramMap).forEach(param => {
                        // Skip kalau tidak ada di visibleParams
                        if (!visibleParams.includes(param)) return;

                        const info = paramMap[param];

                        // Try both raw column name and avg_ prefix
                        const value = latestData[info.column] || latestData[`avg_${info.column}`];

                        if (value !== null && value !== undefined && value !== '') {
                            paramCount++;

                            // ✅ APPLY THRESHOLD COLOR
                            const threshold = stationThresholds[param];
                            const colorClass = getThresholdColor(value, threshold);

                            sensorsHTML += `
            <div class="sensor-item sensor-${colorClass}">
                <span class="param-label">${info.label}</span>
                <span class="param-value">${parseFloat(value).toFixed(2)}</span>
                <span class="param-unit">${info.unit || '&nbsp;'}</span>
            </div>
        `;
                        }
                    });

                    sensorsHTML += '</div>';


                    // Jika tidak ada parameter yang ditampilkan
                    if (paramCount === 0) {
                        sensorsHTML = '<div class="no-data">Belum ada data sensor yang tercatat</div>';
                    } else {
                        // Timestamp (support both hourly and raw data)
                        const timestamp = latestData.hour_timestamp || latestData.timestamp || latestData['2min_timestamp'] || '-';
                        sensorsHTML += `
                            <div class="last-update">
                                Update terakhir: ${formatTimestamp(timestamp)}
                            </div>
                        `;
                    }

                } else {
                    sensorsHTML = '<div class="no-data">Belum ada data sensor</div>';
                }

                // Final popup HTML - Use REAL-TIME status!
                const statusClass = isOnline ? 'status-active' : 'status-inactive';
                const statusText = isOnline ? '● ONLINE' : '● OFFLINE';

                // Tampilkan serial code jika ada
                const serialCode = station.serial_code
                    ? `<div class="popup-serial">${station.serial_code}</div>`
                    : '';

                // Tampilkan company name jika ada
                const companyName = station.company_name && station.company_name !== 'Belum Diisi'
                    ? `<div class="popup-company">${station.company_name}</div>`
                    : '';

                const popupHTML = `
                    <div class="popup-header">
                        <h3>${station.name || station.trengginas_id}</h3>
                        ${serialCode}
                        ${companyName}
                        <span class="popup-status ${statusClass}">
                            ${statusText}
                        </span>
                    </div>
                    <div class="popup-body">
                        ${sensorsHTML}
                        <button class="btn-detail" onclick="openDetailInIndex('${station.trengginas_id}')">
                            <i class="fas fa-arrow-right me-2"></i>Lihat Selengkapnya
                        </button>
                    </div>
                `;


                return popupHTML;

            } catch (error) {
                console.error('Error generating popup:', error);
                return `
                    <div class="popup-header">
                        <h3>${station.name || station.trengginas_id}</h3>
                    </div>
                    <div class="popup-body">
                        <div class="no-data">Gagal memuat data sensor</div>
                    </div>
                `;
            }
        }

        function openDetailInIndex(trengginas_id) {
            // Redirect ke index.html dengan parameter station
            window.location.href = `index.html?station=${trengginas_id}`;
        }

        // ==========================================
        // HELPER FUNCTIONS
        // ==========================================
        function formatTimestamp(timestamp) {
            if (!timestamp || timestamp === '-') return '-';

            const date = new Date(timestamp);
            const options = {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            };
            return date.toLocaleDateString('id-ID', options);
        }

        // ==========================================
        // ALL STATIONS MODAL FUNCTIONS
        // ==========================================
        async function openAllStationsModal(filter = 'all') {
            // Update modal title based on filter
            const modalTitle = document.querySelector('#allStationsModal .modal-title');
            if (filter === 'online') {
                modalTitle.textContent = 'Daftar Stasiun Online';
            } else if (filter === 'offline') {
                modalTitle.textContent = 'Daftar Stasiun Offline';
            } else {
                modalTitle.textContent = 'Daftar Semua Stasiun';
            }

            // Open modal
            const modal = new bootstrap.Modal(document.getElementById("allStationsModal"));
            modal.show();

            // Load stations data with filter
            await loadAllStationsTable(filter);
        }

        async function loadAllStationsTable(filter = 'all') {
            const tbody = document.getElementById("allStationsTableBody");

            // Show loading
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-4">
                        <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                        Memuat data stasiun...
                    </td>
                </tr>
            `;

            try {
                const response = await fetch(`${API_BASE}get_stations.php?user_id=${userData.userId}`);
                const stations = await response.json();

                if (!stations || stations.length === 0) {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="5" class="text-center py-3 text-muted">
                                Tidak ada data stasiun
                            </td>
                        </tr>
                    `;
                    return;
                }

                // ✅ ULTRA-FAST: Use cached status fetch
                const stationIds = stations.map(st => st.trengginas_id).join(',');
                const batchData = await fetchStationsStatus(stationIds);
                
                // Create map dari batch response
                const statusMap = {};
                if (batchData.status === 'success' && batchData.data) {
                    batchData.data.forEach(item => {
                        statusMap[item.trengginas_id] = {
                            online: item.online || false,
                            last_update: item.last_update || '-',
                            minutes_ago: item.minutes_ago
                        };
                    });
                }

                // Build stations with status
                const stationsWithStatus = stations.map(st => {
                    const statusInfo = statusMap[st.trengginas_id] || {
                        online: false,
                        last_update: '-',
                        minutes_ago: null
                    };
                    
                    return {
                        id: st.trengginas_id,
                        name: st.name || st.trengginas_id,
                        serialCode: st.serial_code || null,
                        companyName: st.company_name || null,
                        online: statusInfo.online,
                        lastUpdate: statusInfo.last_update,
                        minutesAgo: statusInfo.minutes_ago
                    };
                });

                // Apply filter
                let filteredStations = stationsWithStatus;
                if (filter === 'online') {
                    filteredStations = stationsWithStatus.filter(st => st.online);
                } else if (filter === 'offline') {
                    filteredStations = stationsWithStatus.filter(st => !st.online);
                }

                if (filteredStations.length === 0) {
                    const filterMsg = filter === 'online' ? 'online' :
                        filter === 'offline' ? 'offline' : '';
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="5" class="text-center py-3 text-muted">
                                Tidak ada stasiun ${filterMsg}
                            </td>
                        </tr>
                    `;
                    return;
                }

                // Build table rows with minutes ago info
                let html = "";
                filteredStations.forEach((st, index) => {
                    const statusBadge = st.online
                        ? `<span class="badge bg-success">● Online</span>`
                        : `<span class="badge bg-danger">● Offline</span>`;

                    let lastUpdateDisplay = formatTimestamp(st.lastUpdate);

                    // Serial code display (jika ada)
                    const serialDisplay = st.serialCode
                        ? `<div class="text-muted small" style="font-size: 0.75rem; font-weight: 600;">${st.serialCode}</div>`
                        : '';

                    // Company name display (jika ada)
                    const companyDisplay = st.companyName && st.companyName !== 'Belum Diisi'
                        ? `<div class="text-muted small" style="font-size: 0.75rem; font-style: italic; color: #9ca3af;">${st.companyName}</div>`
                        : '';

                    html += `
                        <tr>
                            <td class="text-center">${index + 1}</td>
                            <td>
                                <strong>${st.name}</strong>
                                ${serialDisplay}
                                ${companyDisplay}
                            </td>
                            <td class="small">${lastUpdateDisplay}</td>
                            <td>${statusBadge}</td>
                            <td>
                                <button class="btn btn-sm btn-outline-primary" 
                                        onclick="viewStationLocation('${st.id}')" 
                                        title="Lihat lokasi di peta">
                                    <i class="fas fa-map-marker-alt me-1"></i>Lihat
                                </button>
                            </td>
                        </tr>
                    `;
                });

                tbody.innerHTML = html;

            } catch (error) {
                console.error("Error loading stations:", error);
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" class="text-center py-3 text-danger">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            Gagal memuat data stasiun
                        </td>
                    </tr>
                `;
            }
        }

        function viewStationLocation(trengginas_id) {
            // Close modal
            const modalEl = document.getElementById("allStationsModal");
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();

            // Find marker for this station
            const marker = markers[trengginas_id];

            if (marker && map) {
                // Pan and zoom to station
                map.setView(marker.getLatLng(), 15, {
                    animate: true,
                    duration: 1
                });

                // Open popup after animation
                setTimeout(() => {
                    marker.openPopup();
                }, 1000);
            } else {
                Toast.fire({
                    icon: "error",
                    title: "Stasiun tidak ditemukan di peta"
                });
            }
        }

        function showLoading(show) {
            const loading = document.getElementById('loading');
            if (show) {
                loading.classList.add('active');
            } else {
                loading.classList.remove('active');
            }
        }

        // ==========================================
        // ⚡ INSTANT LOADING: Service Worker Registration
        // ==========================================
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then(registration => {
                        console.log('✅ Service Worker registered - Static assets will be cached');
                        console.log('⚡ Next page loads will be INSTANT!');
                    })
                    .catch(error => {
                        console.log('ℹ️ Service Worker not available:', error);
                    });
            });
        }

        // ==========================================
        // ⚡ INSTANT LOADING: Prefetch on Hover
        // ==========================================
        (function() {
            let prefetchTimer = null;
            const prefetchedUrls = new Set();

            document.addEventListener('mouseover', (e) => {
                const link = e.target.closest('a[href]');
                if (!link) return;
                
                const url = link.getAttribute('href');
                if (!url || url.startsWith('#') || url.startsWith('javascript:')) return;
                if (prefetchedUrls.has(url)) return;

                // Clear previous timer
                if (prefetchTimer) clearTimeout(prefetchTimer);

                // Prefetch after 50ms hover
                prefetchTimer = setTimeout(() => {
                    const linkEl = document.createElement('link');
                    linkEl.rel = 'prefetch';
                    linkEl.href = url;
                    linkEl.as = 'document';
                    document.head.appendChild(linkEl);
                    prefetchedUrls.add(url);
                    console.log('⚡ Prefetched:', url);
                }, 50);
            });

            document.addEventListener('mouseout', () => {
                if (prefetchTimer) {
                    clearTimeout(prefetchTimer);
                    prefetchTimer = null;
                }
            });
        })();
