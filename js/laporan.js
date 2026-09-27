        // ==========================================
        // KONFIGURASI & VARIABEL GLOBAL
        // ==========================================
        // Auto-detect API base URL (support trengginas.com dan trengginas.tech)
        const currentDomain = window.location.hostname;
        const API_BASE = window.location.origin + '/api/';

        let map;

        // Initial map view settings (for reset function)
        const INITIAL_CENTER = [-2.5489, 118.0149];
        const INITIAL_ZOOM = 6;
        let initialMapBounds = null;  // Store initial map bounds after first load
        let markers = {};  // Ubah dari array ke object: { trengginas_id: marker }
        let userData = {};

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
            // 1. Load User Data (Logic Otentikasi)
            const storedUser = localStorage.getItem('wqms_user');

            if (storedUser) {
                const user = JSON.parse(storedUser);

                // Set global variable userData
                userData = {
                    userId: user.id || user.user_id,
                    username: user.username,
                    fullName: user.full_name || user.username,
                    role: user.role,
                    assignedStationId: user.assigned_station_id || ''
                };
            } else {
                // Fallback jika user belum login (Guest)
                userData = {
                    userId: '1',
                    username: 'Guest',
                    fullName: 'Guest User',
                    role: 'operator',
                    assignedStationId: ''
                };
            }

            // Tampilkan Nama & Role di Pojok Kanan Atas
            // (Note: Sebagian sudah dihandle script anti-flicker di atas, tapi ini untuk memastikan)
            const nameDisplay = document.getElementById('user-name-display');
            const roleDisplay = document.getElementById('user-role-display');
            if (nameDisplay) nameDisplay.textContent = userData.fullName;
            if (roleDisplay) roleDisplay.textContent = userData.role.toUpperCase();

            // Show/hide admin menu (ONLY superuser)
            if (userData.role === 'superuser') {
                const adminMenu = document.getElementById('superuser-menu');
                if (adminMenu) adminMenu.classList.remove('hidden');
            }

            // 2. Sidebar LocalStorage Check
            // Pastikan key localStorage ada
            const sidebarState = localStorage.getItem('sidebar_collapsed');
            if (sidebarState === null) {
                localStorage.setItem('sidebar_collapsed', 'true');
            }

            // 3. LOGIKA ICON SIDEBAR (Anti-Goyang / Fix Flicker)
            // Cek apakah body punya class 'sb-collapsed' (dari script inline di atas)
            // Jika ya, langsung ubah panah kiri jadi kanan.
            const icon = document.getElementById('toggleIcon');
            if (icon && document.body.classList.contains('sb-collapsed')) {
                icon.classList.remove('fa-chevron-left');
                icon.classList.add('fa-chevron-right');
            }

            // 4. Inisialisasi Fungsi Khusus Halaman Laporan
            // Load dropdown stasiun
            loadLaporanStations();

            // Set default tanggal (kemarin s/d hari ini)
            setDefaultDates();

            // Isi checkbox parameter di modal generate
            populateParamCheckboxes();

            // 5. Mobile Sidebar Click Listener (Tutup sidebar jika klik di luar)
            document.addEventListener('click', function (e) {
                if (document.body.classList.contains('show-sidebar')) {
                    const sidebar = document.querySelector('.sidebar');
                    const mobileToggle = document.getElementById('mobile-toggle');

                    // Jika klik bukan di sidebar DAN bukan di tombol burger
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

            // Tile Layer (OpenStreetMap)
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 18,
            }).addTo(map);
        }

        // ==========================================
        // RESET MAP VIEW
        // ==========================================
        function resetMapView() {
            console.log('resetMapView() called');
            console.log('initialMapBounds:', initialMapBounds);
            console.log('map exists:', map ? 'YES' : 'NO');

            if (map && initialMapBounds) {
                console.log('Resetting map to initial bounds...');
                map.fitBounds(initialMapBounds, {
                    animate: true,
                    duration: 0.5
                });

                // Show toast feedback
                Toast.fire({
                    icon: 'success',
                    title: 'Peta direset ke tampilan awal'
                });
            } else if (map && !initialMapBounds) {
                // Fallback to hardcoded if bounds not saved yet
                console.log('Using fallback center/zoom...');
                map.setView(INITIAL_CENTER, INITIAL_ZOOM, {
                    animate: true,
                    duration: 0.5
                });
                Toast.fire({
                    icon: 'success',
                    title: 'Peta direset ke tampilan awal'
                });
            } else {
                console.error('ERROR: Map is not initialized!');
                Toast.fire({
                    icon: 'error',
                    title: 'Error: Peta belum siap'
                });
            }
        }

        // ==========================================
        // LOAD STATIONS
        // ==========================================
        async function loadStations() {
            try {
                const response = await fetch(`${API_BASE}get_stations.php?user_id=${userData.userId}`);
                const stations = await response.json();

                if (!stations || stations.length === 0) {
                    return;
                }

                // Filter stasiun yang punya koordinat
                const validStations = stations.filter(s => s.latitude && s.longitude);

                // Calculate REAL-TIME status untuk semua stasiun (parallel fetch)
                const statusChecks = validStations.map(st =>
                    fetch(`${API_BASE}get_station_data.php?trengginas_id=${st.trengginas_id}&type=2min&limit=1`)
                        .then(r => r.json())
                        .then(checkData => {
                            let isOnline = false;
                            if (checkData && checkData.length > 0) {
                                const latest = checkData[0];
                                const timestamp = latest['2min_timestamp'] || latest.timestamp;
                                if (timestamp) {
                                    const lastTime = new Date(timestamp);
                                    const now = new Date();
                                    const diffMinutes = (now - lastTime) / 1000 / 60;
                                    isOnline = diffMinutes <= 2; // ONLINE jika 2-min data dalam 2 menit terakhir
                                }
                            }
                            return { id: st.trengginas_id, online: isOnline };
                        })
                        .catch(() => ({ id: st.trengginas_id, online: false }))
                );

                const statusResults = await Promise.all(statusChecks);
                const statusMap = {};
                statusResults.forEach(r => statusMap[r.id] = r.online);

                // Count active/inactive berdasarkan REAL-TIME status
                const activeCount = Object.values(statusMap).filter(online => online).length;
                const inactiveCount = validStations.length - activeCount;

                // Update stats dengan REAL-TIME count
                document.getElementById('totalStations').textContent = validStations.length;
                document.getElementById('activeStations').textContent = activeCount;
                document.getElementById('inactiveStations').textContent = inactiveCount;

                // Track station IDs yang masih aktif
                const activeStationIds = new Set();

                // Update atau tambah markers (attach real-time status ke station object)
                for (const station of validStations) {
                    activeStationIds.add(station.trengginas_id);
                    station.isOnline = statusMap[station.trengginas_id] || false; // Attach real-time status

                    if (markers[station.trengginas_id]) {
                        // Marker sudah ada, UPDATE saja
                        updateStationMarker(station);
                    } else {
                        // Marker belum ada, CREATE baru
                        await addStationMarker(station);
                    }
                }

                // Hapus markers yang tidak ada di data baru
                Object.keys(markers).forEach(stationId => {
                    if (!activeStationIds.has(stationId)) {
                        map.removeLayer(markers[stationId]);
                        delete markers[stationId];
                    }
                });

                // Auto-fit bounds hanya di initial load (bukan saat refresh)
                if (Object.keys(markers).length > 0 && !map._initialBoundsFitted) {
                    const markerArray = Object.values(markers);
                    const group = new L.featureGroup(markerArray);
                    const bounds = group.getBounds().pad(0.1);
                    map.fitBounds(bounds);

                    // Save initial bounds for reset function
                    initialMapBounds = bounds;

                    map._initialBoundsFitted = true;
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

            // Popup (click) - akan diisi dengan data sensor terbaru
            marker.on('click', async function () {
                // Gunakan data terbaru dari marker.stationData
                const currentStation = marker.stationData || station;
                const popupContent = await generatePopupContent(currentStation);
                marker.bindPopup(popupContent, { maxWidth: 220 }).openPopup();
            });

            // Simpan marker ke object dengan key trengginas_id
            markers[station.trengginas_id] = marker;
        }

        // ==========================================
        // GENERATE POPUP CONTENT
        // ==========================================
        async function generatePopupContent(station) {
            try {
                // Fetch latest sensor data (2-MINUTE AVERAGE for real-time status check)
                let response = await fetch(
                    `${API_BASE}get_station_data.php?trengginas_id=${station.trengginas_id}&type=2min&limit=1`
                );
                let data = await response.json();

                // Calculate REAL-TIME status (sama seperti Daftar Stasiun!)
                let isOnline = false;
                let lastUpdateTime = '-';

                if (data && data.length > 0) {
                    const latestData = data[0];
                    const timestamp = latestData['2min_timestamp'] || latestData.timestamp || latestData.hour_timestamp;

                    if (timestamp) {
                        lastUpdateTime = timestamp;
                        const lastTime = new Date(timestamp);
                        const now = new Date();
                        const diffMinutes = (now - lastTime) / 1000 / 60;
                        isOnline = diffMinutes <= 2; // ONLINE jika 2-min data dalam 2 menit terakhir
                    }
                }

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


                    sensorsHTML = '<div class="sensor-list">';

                    let paramCount = 0;
                    visibleParams.forEach(param => {
                        if (paramMap[param]) {
                            const info = paramMap[param];

                            // Try both raw column name and avg_ prefix (for hourly/daily data)
                            const value = latestData[info.column] || latestData[`avg_${info.column}`];

                            if (value !== null && value !== undefined && value !== '') {
                                paramCount++;
                                sensorsHTML += `
                                    <div class="sensor-item">
                                        <span class="param-label">${info.label}</span>
                                        <span class="param-value">${parseFloat(value).toFixed(2)}</span>
                                        <span class="param-unit">${info.unit}</span>
                                    </div>
                                `;
                            }
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

                const popupHTML = `
                    <div class="popup-header">
                        <h3>${station.name || station.trengginas_id}</h3>
                        <span class="popup-status ${statusClass}">
                            ${statusText}
                        </span>
                    </div>
                    <div class="popup-body">
                        ${sensorsHTML}
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

                // Get status for all stations
                const statusChecks = stations.map(async (st) => {
                    try {
                        const res = await fetch(`${API_BASE}get_station_data.php?trengginas_id=${st.trengginas_id}&type=2min&limit=1`);
                        const data = await res.json();

                        let isOnline = false;
                        let lastUpdate = "-";

                        if (data && data.length > 0) {
                            const latest = data[0];
                            const timestamp = latest["2min_timestamp"] || latest.timestamp;

                            if (timestamp) {
                                lastUpdate = timestamp;
                                const lastTime = new Date(timestamp);
                                const now = new Date();
                                const diffMinutes = (now - lastTime) / 1000 / 60;
                                isOnline = diffMinutes <= 2;
                            }
                        }

                        return {
                            id: st.trengginas_id,
                            name: st.name || st.trengginas_id,
                            online: isOnline,
                            lastUpdate: lastUpdate
                        };
                    } catch (err) {
                        return {
                            id: st.trengginas_id,
                            name: st.name || st.trengginas_id,
                            online: false,
                            lastUpdate: "-"
                        };
                    }
                });

                const stationsWithStatus = await Promise.all(statusChecks);

                // Apply filter
                let filteredStations = stationsWithStatus;
                if (filter === 'online') {
                    filteredStations = stationsWithStatus.filter(st => st.online);
                } else if (filter === 'offline') {
                    filteredStations = stationsWithStatus.filter(st => !st.online);
                }
                // filter === 'all' means no filtering

                // Check if filtered result is empty
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

                // Build table rows
                let html = "";
                filteredStations.forEach((st, index) => {
                    const statusBadge = st.online
                        ? `<span class="badge bg-success">Online</span>`
                        : `<span class="badge bg-danger">Offline</span>`;

                    html += `
                        <tr>
                            <td class="text-center">${index + 1}</td>
                            <td><strong>${st.name}</strong></td>
                            <td class="small text-muted">${st.lastUpdate}</td>
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
        // LAPORAN DATA - SPECIFIC FUNCTIONS
        // ==========================================

        // Load stations for filter dropdown
        // --- 1. Tambahkan variabel global di bagian atas script (setelah userData) ---
        let stationsList = [];

        // --- 2. Update fungsi loadLaporanStations ---
        async function loadLaporanStations() {
            try {
                const res = await fetch(`${API_BASE}get_stations.php?user_id=${userData.userId}`);
                const stations = await res.json();

                // Simpan ke variabel global agar bisa dipakai saat download
                stationsList = stations;

                const select = document.getElementById('stationSelect');
                select.innerHTML = '<option value="">Pilih Stasiun...</option>';

                stations.forEach(st => {
                    const opt = document.createElement('option');
                    opt.value = st.trengginas_id;
                    opt.textContent = st.name || st.trengginas_id;
                    select.appendChild(opt);
                });
            } catch (e) {
                console.error('Error loading stations:', e);
                Toast.fire({ icon: 'error', title: 'Gagal memuat daftar stasiun' });
            }
        }

        // Set default dates (yesterday to today)
        function setDefaultDates() {
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            document.getElementById('endDate').valueAsDate = today;
            document.getElementById('startDate').valueAsDate = yesterday;
        }

        // Reset filter
        function resetFilter() {
            document.getElementById('filterForm').reset();
            setDefaultDates();
        }

        // Validate filter inputs
        function validateFilter() {
            const stationId = document.getElementById('stationSelect').value;
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;

            if (!stationId || !startDate || !endDate) {
                Toast.fire({ icon: 'warning', title: 'Mohon lengkapi semua filter' });
                return false;
            }

            if (new Date(startDate) > new Date(endDate)) {
                Toast.fire({ icon: 'error', title: 'Tanggal mulai tidak boleh lebih besar dari tanggal akhir' });
                return false;
            }

            return true;
        }

        // Fetch data from API
        async function fetchData() {
            const stationId = document.getElementById('stationSelect').value;
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            const dataType = document.getElementById('dataType').value;

            const url = `${API_BASE}get_station_data.php?trengginas_id=${stationId}&type=${dataType}&start_date=${startDate}&end_date=${endDate}`;
            const res = await fetch(url);
            const data = await res.json();

            return data;
        }

        // Format column names
        function formatColumnName(col) {
            const map = {
                'trengginas_id': 'ID Stasiun', '2min_timestamp': 'Waktu (2-Menit)',
                'hour_timestamp': 'Waktu (Jam)', 'day': 'Tanggal',
                'ph': 'pH', 'cod': 'COD (mg/L)', 'tss': 'TSS (mg/L)', 'ammonia': 'Amonia (mg/L)', 'debit': 'Debit (m3/h)',
                'temperature': 'Temperatur (°C)', 'do': 'DO (mg/L)', 'turbidity': 'Kekeruhan (NTU)', 'tds': 'TDS (ppm)',
                'nitrate': 'Nitrat (mg/L)', 'bod': 'BOD (mg/L)', 'water_level': 'Level Air (m)',
                'avg_ph': 'pH (Rata-rata)', 'avg_cod': 'COD (Rata-rata)', 'avg_tss': 'TSS (Rata-rata)',
                'avg_ammonia': 'Amonia (Rata-rata)', 'avg_debit': 'Debit (Rata-rata)',
                'avg_temperature': 'Temperatur (Rata-rata)', 'avg_do': 'DO (Rata-rata)',
                'avg_turbidity': 'Kekeruhan (Rata-rata)', 'avg_tds': 'TDS (Rata-rata)',
                'avg_nitrate': 'Nitrat (Rata-rata)', 'avg_bod': 'BOD (Rata-rata)', 'avg_water_level': 'Level Air (Rata-rata)'
            };
            return map[col] || col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }

        // ==========================================
        // FUNGSI PERSIAPAN DATA (CLEANING & FORMATTING)
        // ==========================================
        function prepareExportData(rawData) {
            if (!rawData || rawData.length === 0) return null;

            // === TAMBAHAN BARU: SORTING DARI TERLAMA KE TERBARU ===
            // Kita urutkan array rawData berdasarkan waktu sebelum diproses
            rawData.sort((a, b) => {
                // Ambil timestamp dari salah satu key yang tersedia
                const timeA = a['2min_timestamp'] || a['hour_timestamp'] || a['day_timestamp'] || a['timestamp'];
                const timeB = b['2min_timestamp'] || b['hour_timestamp'] || b['day_timestamp'] || b['timestamp'];

                // Logika Ascending: (Waktu A - Waktu B)
                // Hasil negatif = A lebih dulu (di atas)
                return new Date(timeA) - new Date(timeB);
            });
            // =======================================================

            // 1. Ambil Info Stasiun
            const stationId = document.getElementById('stationSelect').value;
            const selectedStation = stationsList.find(s => s.trengginas_id == stationId);

            // ✅ 2. Ambil Tipe Data untuk Satuan Debit yang Tepat
            const dataType = document.getElementById('dataType').value;
            // daily = m³/d, 2min & hourly = m³/h
            const debitUnit = (dataType === 'daily') ? 'm³/d' : 'm³/h';

            // 3. Tentukan Parameter Aktif
            let allowedParams = [];
            if (selectedStation && selectedStation.visible_params) {
                allowedParams = selectedStation.visible_params.split(',').map(p => p.trim());
            } else {
                allowedParams = Object.keys(AVAILABLE_PARAMS);
            }

            // 4. Mapping Data
            const processedData = rawData.map(row => {
                let newRow = {};

                // A. Waktu
                const timeVal = row['2min_timestamp'] || row['hour_timestamp'] || row['day_timestamp'] || row['timestamp'];
                newRow['Waktu'] = timeVal || '-';

                // B. Parameter
                // ✅ FIX: Iterate menggunakan AVAILABLE_PARAMS order, filter by allowedParams
                Object.keys(AVAILABLE_PARAMS).forEach(key => {
                    // Skip jika parameter tidak ada di allowedParams
                    if (!allowedParams.includes(key)) return;
                    
                    let val = row[key];
                    if (val === undefined || val === null) val = row['avg_' + key];

                    const conf = AVAILABLE_PARAMS[key];
                    
                    // ✅ Dynamic unit untuk debit
                    let unit = conf.unit;
                    if (key === 'debit') {
                        unit = debitUnit; // m³/h atau m³/d
                    }
                    
                    const unitSuffix = unit ? ` (${unit})` : '';
                    const headerName = `${conf.label}${unitSuffix}`;

                    newRow[headerName] = (val !== null && val !== undefined && val !== '')
                        ? parseFloat(val).toFixed(2)
                        : '';
                });

                return newRow;
            });

            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;

            return {
                data: processedData,
                stationName: selectedStation ? (selectedStation.name || stationId) : stationId,
                period: `${startDate} s/d ${endDate}`
            };
        }

        // ==========================================
        // DOWNLOAD CSV (FIX SATUAN ANEH & HEADER)
        // ==========================================
        async function downloadCSV() {
            if (!validateFilter()) return;

            Swal.fire({ title: 'Memuat...', didOpen: () => Swal.showLoading() });

            try {
                const rawData = await fetchData();
                const exportObj = prepareExportData(rawData);

                if (!exportObj || exportObj.data.length === 0) {
                    Swal.close();
                    Swal.fire('Info', 'Tidak ada data untuk filter ini', 'info');
                    return;
                }

                const finalData = exportObj.data;
                const headers = Object.keys(finalData[0]);

                // === BUAT KONTEN CSV ===
                let csvContent = "";

                // 1. Judul & Info (Manual)
                csvContent += `"Laporan Data"\n`;
                csvContent += `"Water Quality Monitoring System Data"\n`;
                csvContent += `\n`;
                csvContent += `"Periode :", "${exportObj.period}"\n`;
                csvContent += `"Stasiun :", "${exportObj.stationName}"\n`;
                csvContent += `\n`;

                // 2. Header Tabel
                csvContent += headers.map(h => `"${h}"`).join(",") + "\n";

                // 3. Isi Data
                finalData.forEach(row => {
                    const rowStr = headers.map(header => {
                        let val = row[header];
                        // Sanitasi String untuk CSV
                        if (val === null || val === undefined) val = '';
                        val = String(val).replace(/"/g, '""');
                        if (val.includes(',') || val.includes('\n') || val.includes('"')) val = `"${val}"`;
                        return val;
                    }).join(",");
                    csvContent += rowStr + "\n";
                });

                // === PENTING: TAMBAHKAN BOM (\uFEFF) AGAR EXCEL BACA UTF-8 ===
                const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });

                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = generateFilename('csv');
                link.click();

                Swal.close();
                Toast.fire({ icon: 'success', title: 'Download CSV Berhasil' });

            } catch (error) {
                Swal.close();
                console.error(error);
                Swal.fire('Error', 'Gagal download CSV', 'error');
            }
        }

        // ==========================================
        // DOWNLOAD XLSX (DENGAN GARIS & WARNA)
        // ==========================================
        async function downloadXLSX() {
            if (!validateFilter()) return;

            Swal.fire({ title: 'Memuat...', didOpen: () => Swal.showLoading() });

            try {
                const rawData = await fetchData();
                const exportObj = prepareExportData(rawData);

                if (!exportObj || exportObj.data.length === 0) {
                    Swal.close();
                    Swal.fire('Info', 'Tidak ada data', 'info');
                    return;
                }

                const finalData = exportObj.data;
                const headers = Object.keys(finalData[0]);

                // 1. Susun Data Array untuk Excel
                const wsData = [
                    ["Laporan Data"],                          // Baris 1: Judul
                    ["Water Quality Monitoring System Data"],  // Baris 2: Sub-judul
                    [""],                                      // Baris 3: Spasi
                    ["Periode :", exportObj.period],           // Baris 4
                    ["Stasiun :", exportObj.stationName],      // Baris 5
                    [""],                                      // Baris 6: Spasi
                    headers                                    // Baris 7: Header Tabel
                ];

                // Masukkan data baris per baris
                finalData.forEach(row => {
                    wsData.push(headers.map(h => row[h]));
                });

                // Buat Worksheet
                const ws = XLSX.utils.aoa_to_sheet(wsData);

                // === 2. DEFINISI STYLE (Wajib pakai library xlsx-js-style) ===
                const borderStyle = {
                    top: { style: "thin", color: { rgb: "000000" } },
                    bottom: { style: "thin", color: { rgb: "000000" } },
                    left: { style: "thin", color: { rgb: "000000" } },
                    right: { style: "thin", color: { rgb: "000000" } }
                };

                const styleTitle = {
                    font: { bold: true, sz: 14, name: "Arial" },
                    alignment: { horizontal: "center" }
                };

                const styleSubTitle = {
                    font: { bold: true, sz: 12, name: "Arial" },
                    alignment: { horizontal: "center" }
                };

                const styleLabel = {
                    font: { bold: true, name: "Arial" }
                };

                const styleHeader = {
                    fill: { fgColor: { rgb: "D3D3D3" } }, // Background Abu-abu
                    font: { bold: true, name: "Arial" },
                    border: borderStyle,
                    alignment: { horizontal: "center", vertical: "center" }
                };

                const styleBody = {
                    border: borderStyle,
                    font: { name: "Arial", sz: 10 },
                    alignment: { horizontal: "center" }
                };

                // === 3. TERAPKAN STYLE KE SEL ===
                const range = XLSX.utils.decode_range(ws['!ref']);

                for (let R = range.s.r; R <= range.e.r; ++R) {
                    for (let C = range.s.c; C <= range.e.c; ++C) {
                        const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
                        if (!ws[cellRef]) continue;

                        // Baris 0 & 1 (Judul)
                        if (R === 0) ws[cellRef].s = styleTitle;
                        else if (R === 1) ws[cellRef].s = styleSubTitle;

                        // Baris 3 & 4 (Label Info)
                        else if ((R === 3 || R === 4) && C === 0) ws[cellRef].s = styleLabel;

                        // Baris 6 (Header Tabel)
                        else if (R === 6) {
                            ws[cellRef].s = styleHeader;
                        }

                        // Baris 7+ (Isi Tabel)
                        else if (R > 6) {
                            ws[cellRef].s = styleBody;
                        }
                    }
                }

                // === 4. MERGE CELLS & LEBAR KOLOM ===
                const lastColIndex = headers.length - 1;
                if (!ws['!merges']) ws['!merges'] = [];

                // Merge Judul Tengah
                ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: lastColIndex } });
                ws['!merges'].push({ s: { r: 1, c: 0 }, e: { r: 1, c: lastColIndex } });

                // Atur Lebar Kolom
                ws['!cols'] = headers.map(() => ({ wch: 20 }));

                // Export
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Laporan Data');
                XLSX.writeFile(wb, generateFilename('xlsx'));

                Swal.close();
                Toast.fire({ icon: 'success', title: 'Download XLSX Berhasil' });

            } catch (error) {
                Swal.close();
                console.error(error);
                // Pesan Error jika lupa ganti library
                if (error.message && error.message.includes('s is not defined')) {
                    Swal.fire('Error Script', 'Harap ganti library xlsx.full.min.js menjadi xlsx-js-style seperti instruksi!', 'error');
                } else {
                    Swal.fire('Error', 'Gagal download XLSX', 'error');
                }
            }
        }

        // Generate filename
        function generateFilename(ext) {
            const station = document.getElementById('stationSelect').selectedOptions[0].text;
            const type = document.getElementById('dataType').selectedOptions[0].text;
            const start = document.getElementById('startDate').value;
            const end = document.getElementById('endDate').value;
            return `Laporan_${station}_${type}_${start}_to_${end}.${ext}`.replace(/[^a-zA-Z0-9._-]/g, '_');
        }

    
        // ⚡ INSTANT LOADING: Service Worker Registration
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then(registration => {
                        console.log('✅ Service Worker registered - Static assets cached');
                        console.log('⚡ Next page loads will be INSTANT!');
                    })
                    .catch(error => {
                        console.log('ℹ️ Service Worker not available:', error);
                    });
            });
        }

        // ⚡ INSTANT LOADING: Hover Prefetch
        (function() {
            let prefetchTimer = null;
            const prefetchedUrls = new Set();

            document.addEventListener('mouseover', (e) => {
                const link = e.target.closest('a[href]');
                if (!link) return;
                
                const url = link.getAttribute('href');
                if (!url || url.startsWith('#') || url.startsWith('javascript:')) return;
                if (prefetchedUrls.has(url)) return;

                if (prefetchTimer) clearTimeout(prefetchTimer);

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

