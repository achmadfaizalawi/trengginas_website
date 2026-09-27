        const BASE_API = "/api";

        const AVAILABLE_PARAMS = {
            'ph': { label: 'pH', unit: '', color: '#4e73df', icon: 'fa-water' },
            'cod': { label: 'COD', unit: 'mg/L', color: '#e74a3b', icon: 'fa-flask' },
            'tss': { label: 'TSS', unit: 'mg/L', color: '#1cc88a', icon: 'fa-vial' },
            'ammonia': { label: 'Amonia', unit: 'mg/L', color: '#f6c23e', icon: 'fa-skull-crossbones' },
            'debit': { label: 'Debit', unit: 'm³/h', color: '#36b9cc', icon: 'fa-tachometer-alt' },
            'temperature': { label: 'Temperatur', unit: '°C', color: '#fd7e14', icon: 'fa-thermometer-half' },
            'do': { label: 'DO', unit: 'mg/L', color: '#6610f2', icon: 'fa-tint' },
            'turbidity': { label: 'Kekeruhan', unit: 'NTU', color: '#858796', icon: 'fa-eye-slash' },
            'tds': { label: 'TDS', unit: 'ppm', color: '#20c997', icon: 'fa-atom' },
            'nitrate': { label: 'Nitrat', unit: 'mg/L', color: '#d63384', icon: 'fa-leaf' },
            'bod': { label: 'BOD', unit: 'mg/L', color: '#dc3545', icon: 'fa-bacterium' },
            'water_level': { label: 'Level Air', unit: 'm', color: '#0dcaf0', icon: 'fa-ruler-vertical' }
        };

        let stationsData = [];
        let currentInterval = null;
        let activeStationId = null;
        let activeVisibleParams = [];

        // Track current date for day change detection
        let currentDisplayDate = new Date().toDateString();

        function checkDayChange() {
            const now = new Date();
            const nowDateStr = now.toDateString();
            
            if (nowDateStr !== currentDisplayDate) {
                console.log('🔄 Day changed detected!', currentDisplayDate, '→', nowDateStr);
                currentDisplayDate = nowDateStr;
                
                // Update date filters to today
                if (!isFilterActive) {
                    setDatesForType(activeTableType);
                    console.log('✅ Date filters updated to new day');
                    
                    // Reload data for new day
                    fetchTableData();
                    console.log('✅ Table data reloaded for new day');
                }
                
                return true;
            }
            return false;
        }
        let chartInstance = null;
        let chartFullTimestamps = []; // Store full timestamps for tooltip display
        let currentUser = null;

        // ✅ ULTRA-FAST: Client-Side Caching
        const CACHE_DURATION = 15000; // 15 seconds
        let statusCache = {
            data: null,
            timestamp: 0,
            trengginas_ids: ''
        };

        // VARIABEL BARU UNTUK TAB & FILTER
        let currentTabMode = 'raw';
        let currentAvgType = '2min';
        let activeTableType = 'raw';
        let isFilterActive = false;
        let savedFilterDates = { start: null, end: null }; // Simpan filter dates agar tidak ke-reset 

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

        const checkboxContainer = document.getElementById('param-checkboxes');
        for (const [key, conf] of Object.entries(AVAILABLE_PARAMS)) {
            checkboxContainer.innerHTML += `
                <div class="col-6">
                    <div class="form-check">
                        <input class="form-check-input param-check" type="checkbox" value="${key}" id="chk-${key}" checked>
                        <label class="form-check-label small" for="chk-${key}">${conf.label} (${conf.unit || '-'})</label>
                    </div>
                </div>
            `;
        }

        checkAuth();

        // Sidebar state management - class already applied by inline script
        // Just ensure localStorage is set and update icon
        const sidebarState = localStorage.getItem('sidebar_collapsed');
        if (sidebarState === null) {
            // First time - set localStorage (class already added by inline script)
            localStorage.setItem('sidebar_collapsed', 'true');
        }

        // Update toggle icon based on current state
        const icon = document.getElementById('toggleIcon');
        if (icon && document.body.classList.contains('sb-collapsed')) {
            icon.classList.remove('fa-chevron-left');
            icon.classList.add('fa-chevron-right');
        }

        document.getElementById('current-date').innerText = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        document.getElementById('loginForm').addEventListener('submit', async function (e) {
            e.preventDefault();
            const u = document.getElementById('username').value;
            const p = document.getElementById('password').value;
            
            // Show splash screen with login message
            showSplashScreen('Memverifikasi kredensial...');
            
            try {
                const res = await fetch(`${BASE_API}/login.php`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: u, password: p })
                });
                const result = await res.json();
                
                if (result.status === 'success') {
                    // Update splash message
                    updateSplashMessage('Login berhasil! Memuat dashboard...');
                    
                    localStorage.setItem('wqms_user', JSON.stringify(result.data));
                    sessionStorage.setItem('just_logged_in', 'true');
                    
                    // Small delay for better UX
                    setTimeout(() => {
                        Toast.fire({ icon: 'success', title: 'Login Berhasil' });
                        checkAuth();
                    }, 800);
                } else { 
                    hideSplashScreen();
                    Swal.fire('Error', result.message, 'error'); 
                }
            } catch (e) { 
                hideSplashScreen();
                Swal.fire('Error', e.message, 'error'); 
            }
        });

        // ==========================================
        // SPLASH SCREEN FUNCTIONS
        // ==========================================
        function showSplashScreen(message = 'Memuat...') {
            const splash = document.getElementById('splash-screen');
            const splashMessage = document.getElementById('splash-message');
            
            splashMessage.textContent = message;
            splash.classList.remove('hide');
            
            // Prevent body scroll when splash is visible
            document.body.style.overflow = 'hidden';
        }

        function hideSplashScreen() {
            const splash = document.getElementById('splash-screen');
            splash.classList.add('hide');
            
            // Re-enable body scroll
            document.body.style.overflow = '';
        }

        function updateSplashMessage(message) {
            const splashMessage = document.getElementById('splash-message');
            splashMessage.textContent = message;
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

        function checkAuth() {
            const storedUser = localStorage.getItem('wqms_user');
            if (storedUser) {
                currentUser = JSON.parse(storedUser);

                // Check if coming from login (not from page navigation)
                const justLoggedIn = sessionStorage.getItem('just_logged_in');
                if (justLoggedIn) {
                    sessionStorage.removeItem('just_logged_in');
                    window.location.href = 'dashboard.html';
                    return;
                }

                // Normal flow for index.html access
                document.getElementById('login-section').classList.add('hidden');
                document.getElementById('dashboard-section').classList.remove('hidden');
                document.getElementById('user-name-display').innerText = currentUser.full_name || currentUser.username || 'User';
                document.getElementById('user-role-display').innerText = currentUser.role.toUpperCase();
                if (currentUser.role === 'superuser') document.getElementById('superuser-menu').classList.remove('hidden');

                // Check if redirected from another page to specific view
                const gotoView = sessionStorage.getItem('goto_view');
                if (gotoView) {
                    sessionStorage.removeItem('goto_view');
                    if (gotoView === 'users') {
                        showUserManagement();
                    } else if (gotoView === 'stations') {
                        showStationList();
                    } else if (gotoView === 'add_station') {
                        openStationModal();
                    }
                } else {
                    // ✅ CEK URL PARAMETER DULU sebelum redirect
                    const urlParams = new URLSearchParams(window.location.search);
                    const stationId = urlParams.get('station');

                    if (stationId) {
                        // Ada request buka station dari dashboard - JANGAN redirect ke dashboard.html
                        // Load stations dulu
                        fetch(`${BASE_API}/get_stations.php?user_id=${currentUser.user_id || currentUser.id}`)
                            .then(res => res.json())
                            .then(data => {
                                stationsData = data;
                                const station = stationsData.find(s => s.trengginas_id === stationId);
                                if (station) {
                                    openDetail(station.trengginas_id, station.name, station.visible_params);
                                    window.history.replaceState({}, document.title, 'index.html');
                                } else {
                                    // Station not found, show station list
                                    showStationList();
                                }
                            })
                            .catch(() => {
                                // Error loading station, show station list
                                showStationList();
                            });
                    } else {
                        // No specific view requested - show default view (Daftar Stasiun)
                        showStationList();
                    }
                }

                // ✅ TAMBAH CODE INI DI SINI (setelah semua code di atas)
                // Auto-open detail station dari URL parameter (dari dashboard.html)
                const urlParams = new URLSearchParams(window.location.search);
                const stationId = urlParams.get('station');

                if (stationId) {
                    // Load stations dulu jika belum ada
                    if (stationsData.length === 0) {
                        fetch(`${BASE_API}/get_stations.php?user_id=${currentUser.user_id || currentUser.id}`)
                            .then(res => res.json())
                            .then(data => {
                                stationsData = data;
                                const station = stationsData.find(s => s.trengginas_id === stationId);
                                if (station) {
                                    openDetail(station.trengginas_id, station.name, station.visible_params);
                                    window.history.replaceState({}, document.title, 'index.html');
                                }
                            });
                    } else {
                        const station = stationsData.find(s => s.trengginas_id === stationId);
                        if (station) {
                            openDetail(station.trengginas_id, station.name, station.visible_params);
                            window.history.replaceState({}, document.title, 'index.html');
                        }
                    }
                }
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
                    // Show splash screen with logout message
                    showSplashScreen('Keluar dari sistem...');
                    
                    if (currentInterval) clearInterval(currentInterval);
                    localStorage.removeItem('wqms_user');
                    
                    // Small delay for better UX
                    setTimeout(() => {
                        updateSplashMessage('Sampai jumpa lagi!');
                        setTimeout(() => {
                            location.reload();
                        }, 500);
                    }, 800);
                }
            });
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

            if (chartInstance) {
                setTimeout(() => chartInstance.resize(), 400);
            }
        }

        function toggleMobileSidebar() {
            document.body.classList.toggle('show-sidebar');
        }

        document.addEventListener('click', function (e) {
            if (document.body.classList.contains('show-sidebar')) {
                const sidebar = document.querySelector('.sidebar');
                const mobileToggle = document.getElementById('mobile-toggle');

                if (!sidebar.contains(e.target) && e.target !== mobileToggle) {
                    document.body.classList.remove('show-sidebar');
                }
            }
        });

        function setActiveNav(id) {
            document.querySelectorAll('.nav-link-custom').forEach(l => l.classList.remove('active'));
            const el = document.getElementById(id);
            if (el) el.classList.add('active');
            document.body.classList.remove('show-sidebar');
        }

        function openStationModal() {
            const modalEl = document.getElementById('stationModal');
            const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
            document.getElementById('stationForm').reset();
            modal.show();
        }

        async function saveStation() {
            let selectedParams = [];
            document.querySelectorAll('.param-check:checked').forEach(cb => selectedParams.push(cb.value));

            if (selectedParams.length === 0) { Swal.fire('Warning', "Pilih minimal 1 parameter!", 'warning'); return; }

            try {
                const res = await fetch(`${BASE_API}/admin/add_station.php`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
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
                    }).then(() => loadStationList());
                } else { Swal.fire('Gagal', result.message, 'error'); }
            } catch (e) { Swal.fire('Error', e.message, 'error'); }
        }

        function showStationList() {
            document.getElementById('view-stations').classList.remove('hidden');
            document.getElementById('view-detail').classList.add('hidden');
            document.getElementById('view-users').classList.add('hidden');
            document.getElementById('page-title').innerText = "Daftar Stasiun";
            setActiveNav('nav-overview');

            // ✅ TAMPILKAN LOADING DULU
            const grid = document.getElementById('station-grid');
            grid.innerHTML = `
        <div class="col-12 text-center py-5">
            <div class="spinner-border text-primary mb-3" style="width: 3rem; height: 3rem;"></div>
            <h5 class="text-primary fw-bold">Memuat Data Stasiun...</h5>
            <p class="text-muted">Mohon tunggu sebentar</p>
        </div>
    `;

            if (currentInterval) clearInterval(currentInterval);
            loadStationList();
            currentInterval = setInterval(loadStationList, 10000);
        }

        // ==========================================
        // ULTRA-FAST: CACHED STATUS FETCH
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
            const response = await fetch(`${BASE_API}/get_all_stations_status.php?trengginas_ids=${idsString}&threshold=5`);
            const data = await response.json();
            
            // Update cache
            statusCache = {
                data: data,
                timestamp: now,
                trengginas_ids: idsString
            };
            
            return data;
        }

        async function loadStationList() {
            const grid = document.getElementById('station-grid');

            try {
                const res = await fetch(`${BASE_API}/get_stations.php?user_id=${currentUser.user_id || currentUser.id}`);
                const data = await res.json();
                stationsData = data;

                if (data.length === 0) {
                    grid.innerHTML = `
                <div class="col-12 text-center py-5">
                    <div class="text-muted mb-3" style="font-size: 3rem;"><i class="fas fa-folder-open"></i></div>
                    <h5 class="text-muted fw-bold">Belum ada stasiun</h5>
                    <p class="text-muted small">Generate stasiun baru melalui menu Admin Area.</p>
                </div>`;
                    return;
                }

                // ✅ ULTRA-FAST: Use cached status fetch
                const stationIds = data.map(st => st.trengginas_id).join(',');
                const batchData = await fetchStationsStatus(stationIds);
                
                // Create status map dari batch response
                const statusMap = {};
                if (batchData.status === 'success' && batchData.data) {
                    batchData.data.forEach(item => {
                        let online = item.online || false;

                        // FIX: Client-side override — parse timestamp sebagai WIB (UTC+7)
                        // agar tidak terpengaruh timezone browser user
                        if (item.last_update) {
                            try {
                                const lastUpdateWIB = new Date(item.last_update.replace(' ', 'T') + '+07:00');
                                const now = new Date();
                                const minutesAgo = Math.floor((now - lastUpdateWIB) / 1000 / 60);
                                if (minutesAgo > 5) {
                                    if (online) {
                                        console.warn(`⚠️ [Status Override] ${item.trengginas_id}: API says ONLINE but last data ${minutesAgo} minutes ago → Forcing OFFLINE`);
                                    }
                                    online = false;
                                }
                            } catch (err) {
                                console.error('Error parsing timestamp:', err);
                            }
                        }

                        statusMap[item.trengginas_id] = {
                            online: online,
                            lastUpdate: item.last_update || '-',
                            minutesAgo: item.minutes_ago
                        };
                    });
                }

                const loadingDiv = grid.querySelector('.spinner-border');
                if (loadingDiv && loadingDiv.closest('.col-12')) {
                    loadingDiv.closest('.col-12').remove();
                }

                data.forEach(st => {
                    let nameText = st.name.includes("New Station") ? "Menunggu Data Alat..." : st.name;
                    const stData = statusMap[st.trengginas_id] || { online: false, lastUpdate: '-' };
                    let isOnline = stData.online;
                    let lastUpdate = stData.lastUpdate;

                    let statusBadgeClass = isOnline ? 'bg-success' : 'bg-danger';
                    let statusText = isOnline ? 'ONLINE' : 'OFFLINE';

                    const existingCard = document.getElementById(`card-${st.trengginas_id}`);

                    if (existingCard) {
                        const badge = document.getElementById(`badge-${st.trengginas_id}`);
                        if (badge.innerText !== statusText) {
                            badge.className = `badge ${statusBadgeClass} rounded-pill`;
                            badge.innerText = statusText;
                        }
                        const nameEl = document.getElementById(`name-${st.trengginas_id}`);
                        if (nameEl.innerText !== nameText) nameEl.innerText = nameText;

                        // Update serial code
                        const serialEl = document.getElementById(`serial-${st.trengginas_id}`);
                        if (serialEl) {
                            const serialText = st.serial_code || '';
                            serialEl.innerText = serialText;
                            serialEl.style.display = serialText ? 'block' : 'none';
                            serialEl.style.marginTop = '-4px';
                            serialEl.style.marginBottom = '4px';
                            serialEl.style.fontWeight = '600';
                            serialEl.style.color = '#6c757d';
                        }

                        // Update company name
                        const companyEl = document.getElementById(`company-${st.trengginas_id}`);
                        if (companyEl) {
                            const companyText = st.company_name && st.company_name !== 'Belum Diisi' ? st.company_name : '';
                            companyEl.innerText = companyText;
                            companyEl.style.display = companyText ? 'block' : 'none';
                            companyEl.style.marginBottom = '12px';
                            companyEl.style.fontStyle = 'italic';
                            companyEl.style.color = '#9ca3af';
                        }

                        const timeEl = document.getElementById(`time-${st.trengginas_id}`);
                        timeEl.innerHTML = `<i class="fas fa-clock me-1"></i> Update: <strong>${lastUpdate}</strong>`;
                        timeEl.style.fontSize = '0.7rem';

                        existingCard.setAttribute('onclick', `openDetail('${st.trengginas_id}', '${nameText}', '${st.visible_params}')`);

                    } else {
                        const colDiv = document.createElement('div');
                        colDiv.className = 'col-md-6 col-lg-4';
                        colDiv.id = `wrapper-${st.trengginas_id}`;

                        // Serial code display - semi-bold, grey
                        const serialText = st.serial_code || '';
                        const serialHTML = serialText ? `<div class="small" id="serial-${st.trengginas_id}" style="color: #6c757d; font-weight: 600; margin-top: -4px; margin-bottom: 4px;">${serialText}</div>` : `<div class="small" id="serial-${st.trengginas_id}" style="display: none; color: #6c757d; font-weight: 600; margin-top: -4px; margin-bottom: 4px;"></div>`;

                        // Company name display - italic, subtle grey
                        const companyText = st.company_name && st.company_name !== 'Belum Diisi' ? st.company_name : '';
                        const companyHTML = companyText ? `<div class="small text-muted" id="company-${st.trengginas_id}" style="font-style: italic; margin-bottom: 12px; color: #9ca3af;">${companyText}</div>` : `<div class="small text-muted" id="company-${st.trengginas_id}" style="display: none; font-style: italic; margin-bottom: 12px; color: #9ca3af;"></div>`;

                        colDiv.innerHTML = `
                            <div class="station-card h-100" id="card-${st.trengginas_id}" onclick="openDetail('${st.trengginas_id}', '${nameText}', '${st.visible_params}')">
                                <div class="d-flex justify-content-between align-items-start mb-1">
                                    <h6 class="fw-bold text-dark mb-0" id="name-${st.trengginas_id}">${nameText}</h6>
                                    <span class="badge ${statusBadgeClass} rounded-pill" id="badge-${st.trengginas_id}">${statusText}</span>
                                </div>
                                ${serialHTML}
                                ${companyHTML}
                                <div class="small text-muted mb-3" id="time-${st.trengginas_id}" style="font-size: 0.7rem;">
                                    <i class="fas fa-clock me-1"></i> Update: <strong>${lastUpdate}</strong>
                                </div>
                                <div class="text-end small text-primary fw-bold">Monitor <i class="fas fa-arrow-right ms-1"></i></div>
                            </div>`;
                        grid.appendChild(colDiv);
                    }
                });

            } catch (e) {
                if (grid.children.length === 0) {
                    grid.innerHTML = `<div class="col-12 alert alert-danger">Error: ${e.message}</div>`;
                }
            }
        }

        // ======================= LOGIKA TAB & FILTER BARU (FIXED) =======================

        function switchMainTab(mode, el) {
            currentTabMode = mode;
            document.querySelectorAll('.nav-tabs .nav-link').forEach(link => link.classList.remove('active'));
            el.classList.add('active');

            const avgContainer = document.getElementById('avg-type-container');

            if (mode === 'raw') {
                avgContainer.classList.add('hidden');
                activeTableType = 'raw';
            } else {
                avgContainer.classList.remove('hidden');
                activeTableType = document.getElementById('avgTypeSelect').value;
            }

            console.log('switchMainTab():', {
                mode: mode,
                activeTableType: activeTableType,
                isFilterActive: isFilterActive
            });

            // PENTING: Update tanggal default HANYA jika TIDAK sedang filter
            // Jika sedang filter, biarkan tanggal tetap sesuai filter user
            if (!isFilterActive) {
                console.log('switchMainTab: Updating dates (no filter active)');
                setDatesForType(activeTableType);
            } else {
                console.log('switchMainTab: KEEPING filter dates (filter active)');
            }

            // Fetch data dengan tanggal yang ada (filter tetap aktif jika isFilterActive=true)
            fetchTableData();
        }

        function handleAvgTypeChange() {
            const selectVal = document.getElementById('avgTypeSelect').value;
            currentAvgType = selectVal;
            activeTableType = selectVal;

            console.log('handleAvgTypeChange():', {
                newType: selectVal,
                isFilterActive: isFilterActive
            });

            // PENTING: Update tanggal default HANYA jika TIDAK sedang filter
            // Jika sedang filter, biarkan tanggal tetap sesuai filter user
            if (!isFilterActive) {
                console.log('handleAvgTypeChange: Updating dates (no filter active)');
                setDatesForType(selectVal);
            } else {
                console.log('handleAvgTypeChange: KEEPING filter dates (filter active)');
            }

            // Fetch data dengan tanggal yang ada (filter tetap aktif jika isFilterActive=true)
            fetchTableData();
        }

        function applyFilter() {
            isFilterActive = true;

            // SIMPAN filter dates untuk mencegah reset
            savedFilterDates.start = document.getElementById('filterStartDate').value;
            savedFilterDates.end = document.getElementById('filterEndDate').value;

            // Logic Tombol Reset (Muncul)
            const btnReset = document.getElementById('btn-reset-filter');
            btnReset.classList.remove('hidden');

            console.log('Filter applied:', {
                isFilterActive: isFilterActive,
                startDate: savedFilterDates.start,
                endDate: savedFilterDates.end,
                tableType: activeTableType
            });

            fetchTableData();
        }

        function resetFilter() {
            isFilterActive = false;

            // CLEAR saved filter dates
            savedFilterDates.start = null;
            savedFilterDates.end = null;

            // Logic Tombol Reset (Hilang)
            const btnReset = document.getElementById('btn-reset-filter');
            btnReset.classList.add('hidden');

            console.log('Filter reset:', {
                isFilterActive: isFilterActive,
                tableType: activeTableType
            });

            setDatesForType(activeTableType);

            fetchTableData();
        }

        function setDatesForType(type) {
            // SAFETY GUARD: NEVER override dates if filter is active!
            if (isFilterActive) {
                console.log('setDatesForType: BLOCKED - filter is active, not changing dates!');
                return;
            }

            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            const todayStr = `${yyyy}-${mm}-${dd}`;

            console.log('setDatesForType: Setting default dates for type:', type);

            document.getElementById('filterEndDate').value = todayStr;

            if (type === 'daily') {
                const pastDate = new Date();
                pastDate.setDate(today.getDate() - 90); // 3 bulan (90 hari)
                const p_yyyy = pastDate.getFullYear();
                const p_mm = String(pastDate.getMonth() + 1).padStart(2, '0');
                const p_dd = String(pastDate.getDate()).padStart(2, '0');
                document.getElementById('filterStartDate').value = `${p_yyyy}-${p_mm}-${p_dd}`;
            } else {
                document.getElementById('filterStartDate').value = todayStr;
            }
        }
        // ========================================================================

        // Wrapper function for onclick - handles async openDetail
        function openDetail(id, name, paramsStr) {
            console.log('========================================');
            console.log('OPEN DETAIL CALLED');
            console.log('========================================');
            console.log('Station ID:', id);
            console.log('Station Name:', name);
            console.log('Params String:', paramsStr);

            activeStationId = id;
            activeVisibleParams = paramsStr ? paramsStr.split(',') : ['ph', 'cod', 'tss', 'ammonia', 'debit'];

            console.log('Active Station ID set to:', activeStationId);
            console.log('Active Visible Params:', activeVisibleParams);

            if (chartInstance) {
                chartInstance.destroy();
                chartInstance = null;
            }

            document.getElementById('view-stations').classList.add('hidden');
            document.getElementById('view-users').classList.add('hidden');
            document.getElementById('view-detail').classList.remove('hidden');
            document.getElementById('page-title').innerText = name;
            document.getElementById('detail-trengginas-id').innerText = id;

            const editBtn = document.getElementById('btn-edit-param');
            const idAlert = document.getElementById('trengginas-id-alert');

            if (currentUser.role === 'superuser') {
                editBtn.classList.remove('hidden');
                idAlert.classList.remove('hidden');
            } else {
                editBtn.classList.add('hidden');
                idAlert.classList.add('hidden');
            }

            const cardContainer = document.getElementById('dynamic-param-container');
            cardContainer.innerHTML = '';
            
            // ✅ Cards follow AVAILABLE_PARAMS order (consistent for all stations)
            Object.keys(AVAILABLE_PARAMS).forEach(key => {
                if (!activeVisibleParams.includes(key)) return;

                const conf = AVAILABLE_PARAMS[key];
                cardContainer.innerHTML += `
        <div class="param-card">
            <div class="param-title">${conf.label}</div>
            <div class="param-value" id="val-${key}">-</div>
            <span class="param-unit">${conf.unit || '&nbsp;'}</span>
            <i class="fas ${conf.icon} param-icon-bg"></i>
        </div>
    `;
            });

            // Load thresholds for this station
            loadThresholds(id).then(function () {
                console.log('Thresholds loaded for station:', id);
            });

            const tableHead = document.getElementById('dynamic-table-head');
            let thHtml = `<tr><th id="col-time">Waktu</th>`;
            
            // ✅ Table follows AVAILABLE_PARAMS order (consistent with cards)
            Object.keys(AVAILABLE_PARAMS).forEach(key => {
                if (!activeVisibleParams.includes(key)) return;
                const label = AVAILABLE_PARAMS[key].label;
                thHtml += `<th>${label}</th>`;
            });
            
            thHtml += `</tr>`;
            tableHead.innerHTML = thHtml;

            // RESET STATE
            isFilterActive = false;
            savedFilterDates.start = null;
            savedFilterDates.end = null;
            document.getElementById('btn-reset-filter').classList.add('hidden');

            // Set default to 2-MINUTE AVERAGE (no raw data!)
            currentTabMode = 'avg';
            activeTableType = '2min';

            // Show avg type selector and set to 2min
            document.getElementById('avg-type-container').classList.remove('hidden');
            document.getElementById('avgTypeSelect').value = '2min';

            // Set default dates for 2min (hari ini)
            setDatesForType('2min');

            // Load data pertama kali (table + chart)
            console.log('openDetail: Loading initial 2-min average data for station', id);
            fetchTableData(); // Load table dan chart
            fetchData(); // Load parameter cards

            // Setup auto-refresh interval
            if (currentInterval) clearInterval(currentInterval);
            currentInterval = setInterval(() => {
                fetchData(); // Update parameter cards
                
                // ✅ Check for day change first
                const dayChanged = checkDayChange();
                if (dayChanged) {
                    console.log('Auto-refresh: Day changed, data reloaded by checkDayChange()');
                    return; // Skip append, data already reloaded
                }
                
                // Auto-update: INCREMENTAL (append new data only)
                // NO full re-render → preserves chart visibility!
                if (!isFilterActive) {
                    console.log('Auto-refresh: Appending latest data (incremental update)');
                    appendLatestDataToChart();
                } else {
                    console.log('Auto-refresh: Skipped (filter active)');
                }
            }, 60000);
        }

        async function fetchData() {
            console.log('fetchData() called for station:', activeStationId);
            try {
                // ✅ FIXED: Check status dengan endpoint baru
                const statusUrl = `${BASE_API}/get_station_status.php?trengginas_id=${activeStationId}&threshold=5`;
                const statusRes = await fetch(statusUrl);
                const statusData = await statusRes.json();

                console.log('Status check:', statusData);

                // Update status badge
                if (statusData.online) {
                    document.getElementById('connection-badge').className = "status-badge status-online";
                    document.getElementById('connection-badge').innerText = "ONLINE";
                } else {
                    document.getElementById('connection-badge').className = "status-badge status-offline";
                    document.getElementById('connection-badge').innerText = "OFFLINE";
                }

                // Update last update time
                if (statusData.last_update && statusData.last_update !== '-') {
                    document.getElementById('last-update').innerText = statusData.last_update;
                }

                // Fetch sensor data untuk display nilai parameter
                const url = `${BASE_API}/get_station_data.php?trengginas_id=${activeStationId}&type=2min&limit=1`;
                console.log('fetchData API URL:', url);

                const res = await fetch(url);
                const data = await res.json();

                console.log('fetchData response:', {
                    dataLength: data.length,
                    firstItem: data[0] || null
                });

                if (data.length > 0) {
                    const latest = data[0];

                    activeVisibleParams.forEach(key => {
                        // Try avg_ prefix first (for 2-min data)
                        let val = latest['avg_' + key];
                        if (val === undefined || val === null) val = latest[key];
                        const displayVal = val !== undefined && val !== null ? parseFloat(val).toFixed(2) : '-';
                        const el = document.getElementById(`val-${key}`);
                        if (el) el.innerText = displayVal;
                    });

                    // Apply threshold colors
                    loadThresholds(activeStationId).then(function () {
                        const sensorData = {};
                        activeVisibleParams.forEach(function (key) {
                            const val = latest['avg_' + key] !== undefined ? latest['avg_' + key] : latest[key];
                            if (val !== null && val !== undefined) {
                                sensorData[key] = val;
                            }
                        });
                        applyThresholdColors(sensorData);
                    });
                } else {
                    document.getElementById('last-update').innerText = "-";
                    document.getElementById('connection-badge').className = "status-badge status-offline";
                    document.getElementById('connection-badge').innerText = "OFFLINE";
                    activeVisibleParams.forEach(key => {
                        const el = document.getElementById(`val-${key}`);
                        if (el) el.innerText = '-';
                    });
                }
            } catch (e) {
                console.error('fetchData ERROR:', e);
                document.getElementById('connection-badge').className = "status-badge status-offline";
                document.getElementById('connection-badge').innerText = "OFFLINE";
            }
        }

        async function appendLatestDataToChart() {
            // INCREMENTAL UPDATE: Only fetch and append latest data point
            // This preserves chart visibility state (hidden/shown parameters)
            // No full re-render needed!

            try {
                // Fetch only latest 1 data point
                const res = await fetch(`${BASE_API}/get_station_data.php?trengginas_id=${activeStationId}&type=${activeTableType}&limit=1`);
                const data = await res.json();

                if (data.length === 0 || !chartInstance) {
                    console.log('appendLatestDataToChart: No data or no chart instance');
                    return;
                }

                const latest = data[0];
                const timestamp = latest.timestamp || latest['2min_timestamp'] || latest['hour_timestamp'] || latest['day_timestamp'];

                // Format label
                let label;
                if (activeTableType === 'daily') {
                    label = timestamp ? timestamp.split(' ')[0] : '';
                } else {
                    label = timestamp ? timestamp.split(' ')[1] : '';
                }


                // Check if this data point already exists (prevent duplicates)
                // ✅ Compare full timestamp, not just label (which can be same for different seconds)
                const lastTimestamp = chartFullTimestamps[chartFullTimestamps.length - 1];
                if (lastTimestamp === timestamp) {
                    console.log('appendLatestDataToChart: Data point already exists (same timestamp), skipping');
                    return;
                }

                console.log('appendLatestDataToChart: Adding new data point:', label);

                // Append full timestamp for tooltip
                chartFullTimestamps.push(timestamp || '');

                // Append label (short version for x-axis)
                chartInstance.data.labels.push(label);


                // Append data to each dataset
                // ✅ FIX: Match by label, not index (ensures correct parameter values)
                chartInstance.data.datasets.forEach((dataset) => {
                    // Find matching param key by comparing dataset label with AVAILABLE_PARAMS labels
                    let paramKey = null;
                    for (const key of Object.keys(AVAILABLE_PARAMS)) {
                        if (AVAILABLE_PARAMS[key].label === dataset.label) {
                            paramKey = key;
                            break;
                        }
                    }
                    
                    if (paramKey) {
                        const value = latest[paramKey] ?? latest['avg_' + paramKey];
                        dataset.data.push(value);
                        console.log(`📊 Chart append: Dataset "${dataset.label}" ← value ${value} from key "${paramKey}"`);
                    } else {
                        console.warn(`⚠️ Chart append: No matching key found for dataset "${dataset.label}"`);
                    }
                });

                // Limit chart to last 100 points (prevent memory bloat)
                const maxPoints = 100;
                if (chartInstance.data.labels.length > maxPoints) {
                    chartInstance.data.labels.shift(); // Remove oldest
                    chartFullTimestamps.shift(); // Remove oldest timestamp
                    chartInstance.data.datasets.forEach(dataset => {
                        dataset.data.shift(); // Remove oldest
                    });
                }

                // Update chart WITHOUT re-creating datasets
                // This preserves visibility state!
                chartInstance.update();

                // Also append to table (top of tbody)
                const tbody = document.getElementById('full-table-body');
                if (tbody && tbody.children.length > 0) {
                    let rowHtml = `<tr><td class="small fw-bold text-muted">${timestamp || '-'}</td>`;
                    
                    // ✅ FIX: Use same order as fetchTableData (AVAILABLE_PARAMS order)
                    Object.keys(AVAILABLE_PARAMS).forEach(key => {
                        if (!activeVisibleParams.includes(key)) return;
                        let val = latest[key];
                        if (val == null) val = latest['avg_' + key];
                        rowHtml += `<td>${val != null ? parseFloat(val).toFixed(2) : '-'}</td>`;
                    });
                    rowHtml += `</tr>`;

                    // Insert at top
                    tbody.insertAdjacentHTML('afterbegin', rowHtml);

                    // ✅ FIX: Sort table rows by timestamp after insert (descending, newest first)
                    const rows = Array.from(tbody.querySelectorAll('tr'));
                    rows.sort((a, b) => {
                        const timeA = a.cells[0]?.textContent || '';
                        const timeB = b.cells[0]?.textContent || '';
                        return timeB.localeCompare(timeA); // Descending: newest first
                    });
                    tbody.innerHTML = '';
                    rows.forEach(row => tbody.appendChild(row));


                    // ✅ Limit table to reasonable amount (1000 rows = ~33 hours of 2-min data)
                    // This prevents memory issues on long-running pages while keeping full day visible
                    while (tbody.children.length > 1000) {
                        tbody.removeChild(tbody.lastChild);
                    }
                }

            } catch (e) {
                console.error('appendLatestDataToChart error:', e);
            }
        }

        async function fetchTableData() {
            const tbody = document.getElementById('full-table-body');

            // Memberikan indikasi bahwa filter sedang diproses
            if (isFilterActive) {
                tbody.innerHTML = '<tr><td colspan="100" class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary"></div> Memuat data filter...</td></tr>';
            }

            let startDate, endDate;
            if (isFilterActive && savedFilterDates.start && savedFilterDates.end) {
                startDate = savedFilterDates.start;
                endDate = savedFilterDates.end;
            } else {
                startDate = document.getElementById('filterStartDate').value;
                endDate = document.getElementById('filterEndDate').value;
            }

            try {
                const url = `${BASE_API}/get_station_data.php?trengginas_id=${activeStationId}&type=${activeTableType}&start_date=${startDate}&end_date=${endDate}`;
                const res = await fetch(url);
                const data = await res.json();

                tbody.innerHTML = '';

                if (!data || data.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="100" class="text-center py-3">Tidak ada data untuk periode ini.</td></tr>`;
                    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
                    return;
                }

                /**
                 * TAMPILKAN SEMUA DATA dari backend tanpa batasan!
                 * Backend sudah limit dengan LIMIT 1000 (cukup untuk 1 hari)
                 * Frontend tidak perlu limit lagi - tampilkan semua!
                 */
                let displayData = data;

                // Render Tabel
                let allRowsHtml = '';
                displayData.forEach(row => {
                    let t = row.timestamp || row['2min_timestamp'] || row['hour_timestamp'] || row['day_timestamp'];
                    let rowHtml = `<tr><td class="small fw-bold text-muted">${t || '-'}</td>`;

                    // ✅ Table rows follow AVAILABLE_PARAMS order (consistent with header & cards)
                    Object.keys(AVAILABLE_PARAMS).forEach(key => {
                        if (!activeVisibleParams.includes(key)) return;
                        let val = row[key];
                        if (val == null) val = row['avg_' + key];
                        rowHtml += `<td>${val != null ? parseFloat(val).toFixed(2) : '-'}</td>`;
                    });

                    rowHtml += `</tr>`;
                    allRowsHtml += rowHtml;
                });

                tbody.innerHTML = allRowsHtml;

                // Render Chart: Balikkan data (reverse) agar kronologis dari kiri ke kanan (Lama -> Baru)
                const chartData = [...displayData].reverse();
                renderChart(chartData);

            } catch (e) {
                console.error('fetchTableData ERROR:', e);
                tbody.innerHTML = `<tr><td colspan="100" class="text-center text-danger">Gagal memuat data dari server.</td></tr>`;
            }
        }

        function renderChart(data) {
            console.log('renderChart() called with', data.length, 'data points');
            // Use requestAnimationFrame to make chart rendering non-blocking
            // This allows UI interactions (like back button) to work immediately
            requestAnimationFrame(() => {
                console.log('renderChart: Inside requestAnimationFrame');
                const ctx = document.getElementById('mainChart').getContext('2d');

                console.log('renderChart: Building timestamps and labels...');
                // Store FULL timestamps for tooltip display
                chartFullTimestamps = data.map(d => {
                    return d.timestamp || d['2min_timestamp'] || d['hour_timestamp'] || d['day_timestamp'] || '';
                });

                // Create labels (short version for x-axis)
                const labels = data.map(d => {
                    let t = d.timestamp || d['2min_timestamp'] || d['hour_timestamp'] || d['day_timestamp'];
                    if (activeTableType === 'daily') return t ? t.split(' ')[0] : '';
                    return t ? t.split(' ')[1] : '';
                });

                console.log('renderChart: Building datasets for', activeVisibleParams.length, 'parameters...');
                
                // ✅ Chart follows AVAILABLE_PARAMS order (consistent with cards & table)
                const datasets = Object.keys(AVAILABLE_PARAMS)
                    .filter(key => activeVisibleParams.includes(key))
                    .map(key => {
                        const conf = AVAILABLE_PARAMS[key];
                        return {
                            label: conf.label,
                            data: data.map(d => d[key] ?? d['avg_' + key]),
                            borderColor: conf.color,
                            tension: 0.3,
                            borderWidth: 2,
                            pointRadius: 0
                        };
                    });

                if (chartInstance) {
                    // PRESERVE dataset visibility state (hidden/shown)
                    // Simpan state hidden dari datasets lama sebelum overwrite
                    const oldHiddenStates = {};
                    chartInstance.data.datasets.forEach((dataset, index) => {
                        // Simpan berdasarkan label (lebih reliable dari index)
                        oldHiddenStates[dataset.label] = dataset.hidden || false;
                    });

                    console.log('Preserving chart visibility states:', oldHiddenStates);

                    chartInstance.data.labels = labels;
                    chartInstance.data.datasets = datasets;

                    // RESTORE hidden state ke datasets baru
                    chartInstance.data.datasets.forEach(dataset => {
                        if (oldHiddenStates[dataset.label] !== undefined) {
                            dataset.hidden = oldHiddenStates[dataset.label];
                        }
                    });

                    console.log('renderChart: Updating existing chart...');
                    chartInstance.update('none'); // 'none' = no animation for performance!
                    console.log('renderChart: Chart updated successfully!');
                } else {
                    console.log('renderChart: Creating new chart instance...');
                    chartInstance = new Chart(ctx, {
                        type: 'line',
                        data: { labels: labels, datasets: datasets },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            animation: false, // Disable animations for performance!
                            interaction: { mode: 'index', intersect: false },
                            plugins: {
                                legend: { position: 'bottom' },
                                tooltip: {
                                    callbacks: {
                                        title: function (context) {
                                            // Show FULL timestamp (date + time) in tooltip
                                            const index = context[0].dataIndex;
                                            return chartFullTimestamps[index] || context[0].label;
                                        },
                                        label: function (context) {
                                            let label = context.dataset.label || '';
                                            if (label) {
                                                label += ': ';
                                            }
                                            if (context.parsed.y !== null) {
                                                label += context.parsed.y.toFixed(2);
                                            }
                                            return label;
                                        }
                                    }
                                }
                            },
                            scales: {
                                x: {
                                    grid: { display: false },
                                    ticks: { maxTicksLimit: 10 } // Limit x-axis labels
                                },
                                y: {
                                    ticks: { maxTicksLimit: 8 } // Limit y-axis labels
                                }
                            },
                            elements: {
                                point: { radius: 0 }, // No point markers for performance
                                line: { borderWidth: 2 }
                            }
                        }
                    });
                    console.log('renderChart: Chart created successfully!');
                }
                console.log('renderChart: COMPLETE!');
            });
        }

        /**
         * Reset Chart Parameter Filter - Show all parameters
         */
        function resetChartParameterFilter() {
            if (!chartInstance) {
                console.log("No chart instance available");
                return;
            }

            console.log("Resetting chart parameter filter - showing all parameters");

            // Show all datasets (make all parameters visible)
            chartInstance.data.datasets.forEach((dataset, index) => {
                chartInstance.setDatasetVisibility(index, true);
            });

            // Update chart to apply changes
            chartInstance.update();

            // Optional: Show success message
            Toast.fire({
                icon: "success",
                title: "Semua parameter ditampilkan"
            });
        }

        async function openEditParamModal() {
            const modalEl = document.getElementById('editParamModal');
            const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
            const container = document.getElementById('edit-param-checkboxes');

            // ✅ BUKA MODAL DULU (langsung terasa cepat)
            modal.show();

            // ✅ Tampilkan loading di checkbox
            container.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary" role="status"></div><p class="mt-2 text-muted">Memuat parameter...</p></div>';

            // ✅ Ensure activeVisibleParams has defaults if empty
            if (!activeVisibleParams || activeVisibleParams.length === 0) {
                activeVisibleParams = ['ph', 'cod', 'tss', 'ammonia', 'debit'];
                console.log('No params set, using defaults:', activeVisibleParams);
            }

            // ✅ Render checkboxes dulu (cepat)
            setTimeout(() => {
                container.innerHTML = '';

                for (const key in AVAILABLE_PARAMS) {
                    const conf = AVAILABLE_PARAMS[key];
                    const isChecked = activeVisibleParams.includes(key) ? 'checked' : '';

                    const checkboxHtml = '<div class="col-6"><div class="form-check">' +
                        '<input class="form-check-input edit-param-check" type="checkbox" value="' + key + '" ' +
                        'id="edit-chk-' + key + '" ' + isChecked + ' onchange="onParamCheckboxChange()">' +
                        '<label class="form-check-label small" for="edit-chk-' + key + '">' +
                        conf.label + (conf.unit ? ' (' + conf.unit + ')' : '') + '</label>' +
                        '</div></div>';

                    container.innerHTML += checkboxHtml;
                }

            }, 50);

            // ✅ Add event listener for threshold tab
            const thresholdTabBtn = document.getElementById('threshold-tab-btn');
            if (thresholdTabBtn) {
                thresholdTabBtn.addEventListener('shown.bs.tab', function() {
                    console.log('Threshold tab shown, rendering forms...');
                    renderThresholdForms(stationThresholds);
                });
            }

            // ✅ Load thresholds di background (async, tidak blocking)
            loadThresholds(activeStationId).then(() => {
                console.log('Thresholds loaded:', stationThresholds);
                renderThresholdForms(stationThresholds);
            });
        }

        async function saveEditedParamsWithThresholds() {
            let selectedParams = [];
            const checkboxes = document.querySelectorAll('.edit-param-check:checked');
            checkboxes.forEach(function (cb) {
                selectedParams.push(cb.value);
            });

            if (selectedParams.length === 0) {
                Swal.fire('Warning', 'Pilih minimal 1 parameter!', 'warning');
                return;
            }

            const thresholds = collectThresholdValues();

            Swal.fire({
                title: 'Menyimpan...',
                allowOutsideClick: false,
                didOpen: function () { Swal.showLoading(); }
            });

            try {
                // CEK: Apakah parameter selection berubah?
                const currentParams = activeVisibleParams.sort().join(',');
                const newParams = selectedParams.sort().join(',');
                const paramsChanged = currentParams !== newParams;

                // HANYA save parameter jika ada perubahan
                if (paramsChanged) {
                    const paramRes = await fetch(BASE_API + '/admin/update_station_params.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            trengginas_id: activeStationId,
                            params: selectedParams
                        })
                    });
                    const paramResult = await paramRes.json();

                    if (paramResult.status !== 'success') {
                        throw new Error(paramResult.message);
                    }
                }

                // SELALU save threshold (meskipun parameter tidak berubah)
                const thresholdRes = await fetch(BASE_API + '/admin/save_thresholds.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        trengginas_id: activeStationId,
                        thresholds: thresholds
                    })
                });
                const thresholdResult = await thresholdRes.json();

                if (thresholdResult.status !== 'success') {
                    throw new Error(thresholdResult.message);
                }

                const modalEl = document.getElementById('editParamModal');
                const modal = bootstrap.Modal.getInstance(modalEl);
                modal.hide();

                Swal.fire({
                    icon: 'success',
                    title: 'Berhasil!',
                    text: paramsChanged ? 'Parameter dan ambang batas berhasil disimpan' : 'Ambang batas berhasil disimpan',
                    timer: 2000,
                    showConfirmButton: false
                }).then(async function () {
                    // Reload thresholds dan apply colors
                    await loadThresholds(activeStationId);

                    // Fetch data terbaru dan apply threshold
                    const url = BASE_API + '/get_station_data.php?trengginas_id=' + activeStationId + '&type=2min&limit=1';
                    const res = await fetch(url);
                    const data = await res.json();

                    if (data && data.length > 0) {
                        const sensorData = {};
                        activeVisibleParams.forEach(function (key) {
                            const val = data[0]['avg_' + key] !== undefined ? data[0]['avg_' + key] : data[0][key];
                            if (val !== null && val !== undefined) {
                                sensorData[key] = val;
                            }
                        });
                        applyThresholdColors(sensorData);
                    }

                    // Hanya reload station list jika parameter berubah
                    if (paramsChanged) {
                        await loadStationList();
                        const station = stationsData.find(function (s) {
                            return s.trengginas_id === activeStationId;
                        });
                        if (station) {
                            openDetail(activeStationId, station.name, selectedParams.join(','));
                        }
                    }
                });

            } catch (e) {
                Swal.fire('Error', e.message, 'error');
            }
        }

        async function showUserManagement() { // Tambahkan async
            if (currentInterval) clearInterval(currentInterval);
            document.getElementById('view-stations').classList.add('hidden');
            document.getElementById('view-detail').classList.add('hidden');
            document.getElementById('view-users').classList.remove('hidden');
            document.getElementById('page-title').innerText = "Manajemen User";
            setActiveNav('nav-users');
            loadUsers();

            // PERBAIKAN: Cek apakah data stasiun kosong. Jika iya, ambil data dulu.
            // Ini agar saat modal dibuka, checkbox stasiun sudah ada isinya.
            if (stationsData.length === 0) {
                try {
                    const res = await fetch(`${BASE_API}/get_stations.php?user_id=${currentUser.user_id || currentUser.id}`);
                    stationsData = await res.json();
                    console.log("Data stasiun berhasil dimuat otomatis untuk modal user.");
                } catch (e) {
                    console.error("Gagal memuat background stasiun:", e);
                }
            }
        }

        async function loadUsers() {
            const tbody = document.getElementById('user-table-body');
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4"><div class="spinner-border spinner-border-sm"></div> Memuat data...</td></tr>';
            try {
                const res = await fetch(`${BASE_API}/admin/get_users.php`);
                const users = await res.json();
                tbody.innerHTML = '';

                users.forEach((u, index) => {
                    let roleBadge = '';
                    if (u.role === 'superuser') roleBadge = '<span class="badge bg-dark">SUPER USER</span>';
                    else if (u.role === 'admin') roleBadge = '<span class="badge bg-primary">ADMIN</span>';
                    else roleBadge = '<span class="badge bg-secondary">OPERATOR</span>';

                    let stationDisplay = '-';
                    if (u.role === 'operator' && u.assigned_station_id) {
                        const count = u.assigned_station_id.split(',').length;
                        stationDisplay = `<span class="badge bg-info text-dark">${count} Stasiun</span>`;
                    } else if (u.role === 'operator') {
                        stationDisplay = `<span class="badge bg-danger">Belum Ditugaskan</span>`;
                    }

                    tbody.innerHTML += `
                        <tr>
                            <td class="ps-4 fw-bold text-muted">${index + 1}</td>
                            <td><div class="fw-bold text-dark">${u.full_name || '-'}</div></td>
                            <td><div class="small text-muted">${u.username}</div></td>
                            <td>${roleBadge}</td>
                            <td>${stationDisplay}</td>
                            <td class="text-end pe-4 text-nowrap">
                                <button class="btn btn-sm btn-outline-primary me-1"
                                    onclick="openUserModal('edit', ${u.id}, '${u.username}', '${u.role}', '${u.assigned_station_id || ''}', '${u.full_name || ''}')">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger" onclick="deleteUser(${u.id})">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                });
            } catch (e) { tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Gagal memuat: ${e.message}</td></tr>`; }
        }

        function openUserModal(mode, id = null, username = '', role = 'operator', stationIdsStr = '', fullname = '') {
            const modalEl = document.getElementById('userModal');
            const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

            const container = document.getElementById('station-checkbox-container');
            container.innerHTML = '';
            let currentAssigned = stationIdsStr ? stationIdsStr.split(',') : [];

            stationsData.forEach(st => {
                const isChecked = currentAssigned.includes(String(st.id)) ? 'checked' : '';
                container.innerHTML += `
                    <div class="form-check">
                        <input class="form-check-input station-checkbox" type="checkbox" value="${st.id}" id="chk-${st.id}" ${isChecked}>
                        <label class="form-check-label small" for="chk-${st.id}">${st.name}</label>
                    </div>
                `;
            });

            let displayUsername = username;
            if (username.includes('@trengginas.tech')) {
                displayUsername = username.replace('@trengginas.tech', '');
            }

            if (mode === 'add') {
                document.getElementById('userModalTitle').innerText = "Tambah User Baru";
                document.getElementById('edit-user-id').value = "";
                document.getElementById('form-fullname').value = "";
                document.getElementById('form-username').value = "";
                document.getElementById('form-password').value = "";
                document.getElementById('form-role').value = "operator";
            } else {
                document.getElementById('userModalTitle').innerText = "Edit User";
                document.getElementById('edit-user-id').value = id;
                document.getElementById('form-fullname').value = fullname;
                document.getElementById('form-username').value = displayUsername;
                document.getElementById('form-password').value = "";
                document.getElementById('form-role').value = role;
            }
            toggleStationSelect();
            modal.show();
        }

        function toggleStationSelect() {
            const role = document.getElementById('form-role').value;
            const div = document.getElementById('div-assigned-station');
            if (role === 'operator') div.classList.remove('hidden');
            else div.classList.add('hidden');
        }

        async function saveUser() {
            const id = document.getElementById('edit-user-id').value;
            const fullname = document.getElementById('form-fullname').value.trim();
            let usernameInput = document.getElementById('form-username').value.trim();
            const password = document.getElementById('form-password').value;
            const role = document.getElementById('form-role').value;
            let selectedStations = [];
            document.querySelectorAll('.station-checkbox:checked').forEach((checkbox) => {
                selectedStations.push(checkbox.value);
            });

            if (!fullname) { Swal.fire('Warning', 'Nama Lengkap wajib diisi', 'warning'); return; }
            if (!usernameInput) { Swal.fire('Warning', 'Username wajib diisi', 'warning'); return; }
            if (role === 'operator' && selectedStations.length === 0) { Swal.fire('Warning', 'Operator wajib memilih minimal 1 stasiun!', 'warning'); return; }

            usernameInput = usernameInput.replace('@trengginas.tech', '');
            const finalEmail = usernameInput + '@trengginas.tech';

            const payload = {
                id: id ? id : null,
                full_name: fullname,
                username: finalEmail,
                password: password,
                role: role,
                assigned_station_ids: selectedStations
            };

            try {
                const res = await fetch(`${BASE_API}/admin/save_user.php`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await res.json();
                if (result.status === 'success') {
                    const modalEl = document.getElementById('userModal');
                    const modal = bootstrap.Modal.getInstance(modalEl);
                    modal.hide();

                    loadUsers();
                    Toast.fire({ icon: 'success', title: result.message });
                } else { Swal.fire('Error', result.message, 'error'); }
            } catch (e) { Swal.fire('Error', e.message, 'error'); }
        }

        async function deleteUser(id) {
            Swal.fire({
                title: 'Hapus User?',
                text: "Data tidak bisa dikembalikan!",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Ya, Hapus!',
                cancelButtonText: 'Batal'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    try {
                        const res = await fetch(`${BASE_API}/admin/delete_user.php`, {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: id })
                        });
                        const result = await res.json();
                        if (result.status === 'success') {
                            loadUsers();
                            Toast.fire({ icon: 'success', title: 'User berhasil dihapus' });
                        }
                        else Swal.fire('Gagal', result.message, 'error');
                    } catch (e) { Swal.fire('Error', e.message, 'error'); }
                }
            });
        }

        function openProfileModal() {
            const modalEl = document.getElementById('profileModal');
            const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
            document.getElementById('profile-fullname').value = currentUser.full_name || "";
            document.getElementById('profile-password').value = "";
            document.getElementById('profile-password-confirm').value = "";
            modal.show();
        }

        async function saveProfile() {
            const newName = document.getElementById('profile-fullname').value;
            const newPass = document.getElementById('profile-password').value;
            const confirmPass = document.getElementById('profile-password-confirm').value;

            if (!newName) { Swal.fire('Error', 'Nama Lengkap wajib diisi', 'warning'); return; }
            if (newPass && newPass !== confirmPass) { Swal.fire('Error', 'Konfirmasi password tidak cocok', 'warning'); return; }

            const fullPayload = {
                id: currentUser.user_id || currentUser.id,
                username: currentUser.username,
                full_name: newName,
                password: newPass,
                role: currentUser.role,
                assigned_station_ids: currentUser.assigned_station_id
            };

            try {
                const res = await fetch(`${BASE_API}/admin/save_user.php`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(fullPayload)
                });
                const result = await res.json();

                if (result.status === 'success') {
                    Swal.fire('Sukses', 'Profil berhasil diperbarui. Silakan login ulang.', 'success').then(() => {
                        localStorage.removeItem('wqms_user');
                        location.reload();
                    });
                } else {
                    Swal.fire('Gagal', result.message, 'error');
                }
            } catch (e) { Swal.fire('Error', e.message, 'error'); }
        }

        // ============================================
        // THRESHOLD COLOR LOGIC & FUNCTIONS
        // ============================================

        let stationThresholds = {};

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

        function getStatusText(color) {
            switch (color) {
                case 'safe': return 'Normal';
                case 'warning': return 'Warning';
                case 'danger': return 'Bahaya';
                default: return '';
            }
        }

        async function loadThresholds(stationId) {
            try {
                const res = await fetch(BASE_API + '/get_thresholds.php?trengginas_id=' + stationId);
                const result = await res.json();

                if (result.status === 'success') {
                    stationThresholds = result.data;
                } else {
                    stationThresholds = {};
                }
            } catch (e) {
                console.error('Error loading thresholds:', e);
                stationThresholds = {};
            }
        }

        function applyThresholdColors(sensorData) {
            Object.keys(sensorData).forEach(function (param) {
                const value = sensorData[param];
                const threshold = stationThresholds[param];

                const valueEl = document.getElementById('val-' + param);
                if (!valueEl) return;

                const card = valueEl.closest('.param-card');
                if (!card) return;

                // Cek apakah threshold enabled
                const enabled = threshold && (threshold.enabled == true || threshold.enabled == 1 || threshold.enabled === "1");

                if (!enabled) {
                    // REMOVE threshold colors
                    card.classList.remove('card-safe', 'card-warning', 'card-danger', 'card-default');

                    // REMOVE badge SAJA (JANGAN touch icon!)
                    const badge = card.querySelector('.card-status-badge');
                    if (badge) {
                        badge.remove();
                    }

                    return;  // Icon tetap ada, hanya badge yang di-remove
                }

                // Apply threshold colors
                const color = getThresholdColor(value, threshold);
                const statusText = getStatusText(color);

                card.classList.remove('card-safe', 'card-warning', 'card-danger', 'card-default');
                card.classList.add('card-' + color);

                // Add/update badge
                let badge = card.querySelector('.card-status-badge');
                if (!badge && statusText) {
                    badge = document.createElement('div');
                    badge.className = 'card-status-badge';
                    card.style.position = 'relative';
                    card.appendChild(badge);
                }
                if (badge) {
                    badge.textContent = statusText;
                    badge.style.display = statusText ? 'block' : 'none';
                }
            });
        }

        function renderThresholdForms(existingThresholds) {
            console.log('renderThresholdForms called with:', existingThresholds);

            const container = document.getElementById('threshold-forms-container');
            container.innerHTML = '';

            const checkboxes = document.querySelectorAll('.edit-param-check:checked');
            const selectedParams = [];
            checkboxes.forEach(function (cb) {
                selectedParams.push(cb.value);
            });

            if (selectedParams.length === 0) {
                container.innerHTML = '<p class="text-muted text-center py-4">Pilih parameter terlebih dahulu di tab "Parameter"</p>';
                return;
            }

            selectedParams.forEach(function (param) {
                const config = AVAILABLE_PARAMS[param];
                const threshold = existingThresholds[param] || {};

                // ✅ FIX: Flexible enabled check - handle string/integer/boolean
                const enabled = threshold.enabled == true || threshold.enabled == 1 || threshold.enabled === "1";

                const minSafe = threshold.min_safe !== undefined && threshold.min_safe !== null ? threshold.min_safe : '';
                const maxSafe = threshold.max_safe !== undefined && threshold.max_safe !== null ? threshold.max_safe : '';
                const minWarning = threshold.min_warning !== undefined && threshold.min_warning !== null ? threshold.min_warning : '';
                const maxWarning = threshold.max_warning !== undefined && threshold.max_warning !== null ? threshold.max_warning : '';

                console.log('Rendering', param, '- enabled:', enabled, '(original:', threshold.enabled, ')');

                let formHtml = '<div class="threshold-card-modal ' + (!enabled ? 'disabled' : '') + '" data-param="' + param + '">';
                formHtml += '<div class="d-flex justify-content-between align-items-center mb-3">';
                formHtml += '<h6 class="mb-0"><strong>' + config.label + '</strong> ' + (config.unit ? '<span class="text-muted">(' + config.unit + ')</span>' : '') + '</h6>';
                formHtml += '<div class="form-check form-switch">';
                formHtml += '<input class="form-check-input threshold-toggle" type="checkbox" id="enable-' + param + '" ';
                formHtml += (enabled ? 'checked' : '') + ' onchange="toggleThresholdInputs(\'' + param + '\')">';
                formHtml += '<label class="form-check-label" for="enable-' + param + '">Aktifkan Ambang Batas</label>';
                formHtml += '</div></div>';

                formHtml += '<div class="threshold-inputs" id="inputs-' + param + '">';
                formHtml += '<div class="d-flex align-items-center mb-3">';
                formHtml += '<span class="color-indicator color-safe"></span><strong class="me-3">Aman (Hijau)</strong>';
                formHtml += '</div>';

                formHtml += '<div class="row g-3 mb-3">';
                formHtml += '<div class="col-6"><div class="threshold-input-group"><label>Minimum</label>';
                formHtml += '<input type="number" step="0.01" class="form-control" id="' + param + '-min-safe" ';
                formHtml += 'value="' + minSafe + '" ' + (!enabled ? 'disabled' : '') + '></div></div>';
                formHtml += '<div class="col-6"><div class="threshold-input-group"><label>Maximum</label>';
                formHtml += '<input type="number" step="0.01" class="form-control" id="' + param + '-max-safe" ';
                formHtml += 'value="' + maxSafe + '" ' + (!enabled ? 'disabled' : '') + '></div></div>';
                formHtml += '</div>';

                formHtml += '<div class="d-flex align-items-center mb-3 mt-4">';
                formHtml += '<span class="color-indicator color-warning"></span><strong class="me-3">Warning (Kuning)</strong>';
                formHtml += '</div>';

                formHtml += '<div class="row g-3">';
                formHtml += '<div class="col-6"><div class="threshold-input-group"><label>Minimum</label>';
                formHtml += '<input type="number" step="0.01" class="form-control" id="' + param + '-min-warning" ';
                formHtml += 'value="' + minWarning + '" ' + (!enabled ? 'disabled' : '') + '></div></div>';
                formHtml += '<div class="col-6"><div class="threshold-input-group"><label>Maximum</label>';
                formHtml += '<input type="number" step="0.01" class="form-control" id="' + param + '-max-warning" ';
                formHtml += 'value="' + maxWarning + '" ' + (!enabled ? 'disabled' : '') + '></div></div>';
                formHtml += '</div>';

                formHtml += '<div class="alert alert-light mt-3 mb-0"><small class="text-muted">';
                formHtml += '<i class="fas fa-info-circle me-1"></i><strong>Merah (Bahaya):</strong> Otomatis untuk nilai di luar rentang warning';
                formHtml += '</small></div>';
                formHtml += '</div></div>';

                container.innerHTML += formHtml;
            });
        }

        function toggleThresholdInputs(param) {
            const card = document.querySelector('.threshold-card-modal[data-param="' + param + '"]');
            const inputs = card.querySelectorAll('input[type="number"]');
            const toggle = document.getElementById('enable-' + param);

            if (toggle.checked) {
                card.classList.remove('disabled');
                inputs.forEach(function (inp) { inp.disabled = false; });
            } else {
                card.classList.add('disabled');
                inputs.forEach(function (inp) { inp.disabled = true; });
            }
        }

        function collectThresholdValues() {
            const thresholds = {};

            const cards = document.querySelectorAll('.threshold-card-modal');
            cards.forEach(function (card) {
                const param = card.dataset.param;
                const toggle = document.getElementById('enable-' + param);
                const enabled = toggle ? toggle.checked : false;

                if (enabled) {
                    thresholds[param] = {
                        min_safe: document.getElementById(param + '-min-safe').value,
                        max_safe: document.getElementById(param + '-max-safe').value,
                        min_warning: document.getElementById(param + '-min-warning').value,
                        max_warning: document.getElementById(param + '-max-warning').value,
                        enabled: 1  // ✅ SAVE sebagai integer 1, bukan boolean
                    };
                } else {
                    thresholds[param] = {
                        enabled: 0  // ✅ SAVE sebagai integer 0, bukan boolean
                    };
                }
            });

            return thresholds;
        }

        function onParamCheckboxChange() {
            const currentThresholds = {};

            Object.keys(stationThresholds).forEach(function (param) {
                currentThresholds[param] = stationThresholds[param];
            });

            const cards = document.querySelectorAll('.threshold-card-modal');
            cards.forEach(function (card) {
                const param = card.dataset.param;
                const enableEl = document.getElementById('enable-' + param);
                const enabled = enableEl ? enableEl.checked : false;

                if (enabled) {
                    const minSafeEl = document.getElementById(param + '-min-safe');
                    const maxSafeEl = document.getElementById(param + '-max-safe');
                    const minWarnEl = document.getElementById(param + '-min-warning');
                    const maxWarnEl = document.getElementById(param + '-max-warning');

                    currentThresholds[param] = {
                        min_safe: minSafeEl ? minSafeEl.value : '',
                        max_safe: maxSafeEl ? maxSafeEl.value : '',
                        min_warning: minWarnEl ? minWarnEl.value : '',
                        max_warning: maxWarnEl ? maxWarnEl.value : '',
                        enabled: true
                    };
                }
            });

            renderThresholdForms(currentThresholds);
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


