        const API_BASE = "/api/";
        let performanceInterval = null;
        let chartInstance = null;
        let userData = {};
        let isFilterActive = false; // Track filter state
        let currentTab = 'comparison'; // Track current active tab

        const AVAILABLE_PARAMS = {
            'ph': { label: 'pH', unit: '' },
            'cod': { label: 'COD', unit: 'mg/L' },
            'tss': { label: 'TSS', unit: 'mg/L' },
            'ammonia': { label: 'Amonia', unit: 'mg/L' },
            'debit': { label: 'Debit', unit: 'm³/d' },
            'temperature': { label: 'Temperatur', unit: '°C' },
            'do': { label: 'DO', unit: 'mg/L' },
            'turbidity': { label: 'Kekeruhan', unit: 'NTU' },
            'tds': { label: 'TDS', unit: 'ppm' },
            'nitrate': { label: 'Nitrat', unit: 'mg/L' },
            'bod': { label: 'BOD', unit: 'mg/L' },
            'water_level': { label: 'Level Air', unit: 'm' }
        };

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

        document.addEventListener('DOMContentLoaded', function () {
            setTimeout(() => {
                document.querySelector('.sidebar').classList.add('animate-sidebar');
            }, 100);

            const storedUser = localStorage.getItem('wqms_user');
            if (storedUser) {
                userData = JSON.parse(storedUser);
            }

            // Populate param checkboxes for station modal
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

            loadStations();
            populateParamSelect();
            setDefaultDates();

            // ✅ Update icon to match sidebar state (sidebar state already set by script after <body>)
            const icon = document.getElementById('toggleIcon');
            const currentState = localStorage.getItem('sidebar_collapsed');
            
            console.log('🔍 DOMContentLoaded - localStorage sidebar_collapsed:', currentState);
            console.log('🔍 DOMContentLoaded - body.classList contains sb-collapsed?', document.body.classList.contains('sb-collapsed'));
            
            if (icon && currentState) {
                if (currentState === 'true') {
                    // Sidebar is collapsed - icon should point right
                    icon.classList.remove('fa-chevron-left');
                    icon.classList.add('fa-chevron-right');
                } else {
                    // Sidebar is expanded - icon should point left
                    icon.classList.remove('fa-chevron-right');
                    icon.classList.add('fa-chevron-left');
                }
            }

            document.addEventListener('click', function (e) {
                if (document.body.classList.contains('show-sidebar')) {
                    const sidebar = document.querySelector('.sidebar');
                    const mobileToggle = document.getElementById('mobile-toggle');
                    if (!sidebar.contains(e.target) && e.target !== mobileToggle) {
                        document.body.classList.remove('show-sidebar');
                    }
                }

                const multiselect = document.querySelector('.custom-multiselect');
                if (multiselect && !multiselect.contains(e.target)) {
                    const dropdown = document.getElementById('stationDropdownList');
                    if (dropdown) dropdown.classList.remove('show');
                }
            });
        });

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
            localStorage.setItem('sidebar_collapsed', isCollapsed.toString());
        }

        function toggleMobileSidebar() { document.body.classList.toggle('show-sidebar'); }
        function closeMobileSidebar() { document.body.classList.remove('show-sidebar'); }

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

        function openProfileModal() {
            const modalEl = document.getElementById('profileModal');
            const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
            document.getElementById('profile-fullname').value = userData.full_name || "";
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
                id: userData.user_id || userData.id,
                username: userData.username,
                full_name: newName,
                password: newPass,
                role: userData.role,
                assigned_station_ids: userData.assigned_station_id
            };

            try {
                const res = await fetch(`${API_BASE}admin/save_user.php`, {
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

        function openStationModal() {
            const modalEl = document.getElementById('stationModal');
            const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
            document.getElementById('stationForm').reset();
            // Re-check all checkboxes
            document.querySelectorAll('.param-check').forEach(cb => cb.checked = true);
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
                    }).then(() => {
                        // Reload stations in dropdown after successful creation
                        loadStations();
                    });
                } else {
                    Swal.fire('Gagal', result.message, 'error');
                }
            } catch (e) {
                Swal.fire('Error', e.message, 'error');
            }
        }

        async function loadStations() {
            try {
                const res = await fetch(`${API_BASE}get_stations.php?user_id=${userData.id || userData.user_id}`);
                let stations = await res.json();

                // FILTER OPERATOR: Cek apakah user adalah operator & punya assigned_station
                if (userData.role === 'operator' && userData.assigned_station_ids) {
                    const allowedIds = userData.assigned_station_ids.split(',').map(id => id.trim());
                    stations = stations.filter(st => allowedIds.includes(st.trengginas_id));
                }

                const dropdown = document.getElementById('stationDropdownList');
                dropdown.innerHTML = '';

                // Populate multiselect for comparison
                if (stations.length === 0) {
                    dropdown.innerHTML = '<div class="p-2 text-muted small text-center">Tidak ada stasiun</div>';
                } else {
                    stations.forEach(st => {
                        dropdown.innerHTML += `
                            <label class="multiselect-option">
                                <input type="checkbox" value="${st.trengginas_id}" data-name="${st.name}" onchange="updateStationBtnText()">
                                ${st.name}
                            </label>
                        `;
                    });
                }

                // Populate single select for performance
                const perfSelect = document.getElementById('perfStationSelect');
                perfSelect.innerHTML = '<option value="">Pilih Stasiun...</option>';
                stations.forEach(st => {
                    perfSelect.innerHTML += `<option value="${st.trengginas_id}">${st.name}</option>`;
                });

            } catch (e) { console.error("Gagal load station", e); }
        }

        function populateParamSelect() {
            const select = document.getElementById('paramSelect');
            for (const [key, val] of Object.entries(AVAILABLE_PARAMS)) {
                const unitStr = val.unit ? ` (${val.unit})` : '';
                select.innerHTML += `<option value="${key}">${val.label}${unitStr}</option>`;
            }
        }

        function setDefaultDates() {
            const today = new Date();
            const past = new Date();
            past.setDate(today.getDate() - 4);
            document.getElementById('endDate').valueAsDate = today;
            document.getElementById('startDate').valueAsDate = past;
        }

        function toggleStationDropdown() {
            document.getElementById('stationDropdownList').classList.toggle('show');
        }

        function updateStationBtnText() {
            const checked = document.querySelectorAll('#stationDropdownList input:checked');
            const btn = document.getElementById('stationDropdownBtn');
            if (checked.length === 0) btn.innerText = "Pilih Stasiun...";
            else btn.innerText = `${checked.length} Stasiun Terpilih`;
        }

        function resetFilter() {
            // Reset all checkboxes in station dropdown
            const checkboxes = document.querySelectorAll('#stationDropdownList input:checked');
            checkboxes.forEach(cb => cb.checked = false);
            updateStationBtnText();

            // Reset parameter select to first option
            document.getElementById('paramSelect').selectedIndex = 0;

            // Reset dates to default (today and 4 days ago)
            setDefaultDates();

            // Destroy chart
            if (chartInstance) {
                chartInstance.destroy();
                chartInstance = null;
            }

            // Reset table header
            const thead = document.getElementById('tableHeaderRow');
            thead.innerHTML = '<th style="width: 150px; min-width: 150px;" class="ps-3 text-start">Stasiun</th>';

            // Reset table body
            const tbody = document.getElementById('tableBody');
            tbody.innerHTML = '<tr><td colspan="10" class="text-center py-5 text-muted">Silakan pilih filter dan klik Terapkan untuk memuat data komparasi.</td></tr>';

            // Set filter as inactive and hide reset button
            isFilterActive = false;
            document.getElementById('btn-reset-filter').classList.add('hidden');

            Toast.fire({
                icon: 'success',
                title: 'Filter berhasil direset'
            });
        }

        async function submitComparison() {
            const selectedCheckboxes = document.querySelectorAll('#stationDropdownList input:checked');
            const selectedStations = Array.from(selectedCheckboxes).map(cb => ({
                id: cb.value, name: cb.getAttribute('data-name')
            }));

            const paramKey = document.getElementById('paramSelect').value;
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;

            if (selectedStations.length === 0) {
                Swal.fire('Warning', 'Pilih minimal 1 stasiun', 'warning'); return;
            }

            // Set filter as active and show reset button
            isFilterActive = true;
            document.getElementById('btn-reset-filter').classList.remove('hidden');

            Swal.fire({ title: 'Memproses Data...', didOpen: () => Swal.showLoading() });

            try {
                const dates = getDatesInRange(new Date(startDate), new Date(endDate));
                const datasets = [];
                const tableData = [];

                const promises = selectedStations.map(async (st) => {
                    const url = `${API_BASE}get_station_data.php?trengginas_id=${st.id}&type=hourly&start_date=${startDate}&end_date=${endDate}`;
                    const res = await fetch(url);
                    const rawData = await res.json();

                    const stationDateMap = {};
                    const chartPoints = [];

                    dates.forEach(dateStr => {
                        const dailyRows = rawData.filter(d => {
                            const t = d.timestamp || d.hour_timestamp || d['2min_timestamp'] || '';
                            return t.startsWith(dateStr);
                        });

                        let avg = null, min = null, max = null;

                        if (dailyRows.length > 0) {
                            const values = dailyRows.map(r => {
                                let v = r[paramKey];
                                if (v === undefined || v === null) v = r['avg_' + paramKey];
                                return parseFloat(v);
                            }).filter(v => !isNaN(v));

                            if (values.length > 0) {
                                min = Math.min(...values);
                                max = Math.max(...values);
                                const sum = values.reduce((a, b) => a + b, 0);
                                
                                // ✅ Special handling untuk debit
                                if (paramKey === 'debit') {
                                    // Untuk debit: sum = total m³/d (bukan average!)
                                    avg = sum;
                                } else {
                                    // Untuk parameter lain: average seperti biasa
                                    avg = sum / values.length;
                                }
                            }
                        }

                        stationDateMap[dateStr] = {
                            avg: avg !== null ? avg.toFixed(2) : '-',
                            min: min !== null ? min.toFixed(2) : '-',
                            max: max !== null ? max.toFixed(2) : '-'
                        };

                        chartPoints.push(avg !== null ? parseFloat(avg.toFixed(2)) : null);
                    });

                    datasets.push({
                        label: st.name,
                        data: chartPoints,
                        borderColor: getRandomColor(),
                        tension: 0.3,
                        pointRadius: 4,
                        spanGaps: true,
                        backgroundColor: 'rgba(0,0,0,0)'
                    });

                    tableData.push({ name: st.name, id: st.id, values: stationDateMap });
                });

                await Promise.all(promises);

                renderChart(dates, datasets);
                renderTable(dates, tableData, paramKey);
                Swal.close();

            } catch (e) {
                console.error(e);
                Swal.fire('Error', 'Gagal memuat data. Cek Console.', 'error');
            }
        }

        function getDatesInRange(startDate, endDate) {
            const date = new Date(startDate.getTime());
            const dates = [];
            while (date <= endDate) {
                dates.push(date.toISOString().split('T')[0]);
                date.setDate(date.getDate() + 1);
            }
            return dates;
        }

        function getRandomColor() {
            const colors = ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', '#6f42c1'];
            return colors[Math.floor(Math.random() * colors.length)];
        }

        function renderChart(labels, datasets) {
            const ctx = document.getElementById('comparisonChart').getContext('2d');
            if (chartInstance) chartInstance.destroy();

            Chart.defaults.color = '#858796';
            Chart.defaults.borderColor = '#e3e6f0';

            chartInstance = new Chart(ctx, {
                type: 'line',
                data: { labels: labels, datasets: datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { labels: { color: '#5a5c69', font: { family: 'Poppins', weight: 'bold' } } },
                        tooltip: { mode: 'index', intersect: false }
                    },
                    scales: {
                        y: { grid: { color: '#eaecf4', borderDash: [2] }, ticks: { color: '#858796', padding: 10 } },
                        x: { grid: { display: false }, ticks: { color: '#858796' } }
                    }
                }
            });
        }

        function renderTable(dates, data, paramKey) {
            const thead = document.getElementById('tableHeaderRow');
            const tbody = document.getElementById('tableBody');

            let headerHTML = '<th style="width: 150px; min-width: 150px;" class="ps-3 text-start">Stasiun</th>';
            dates.forEach(d => headerHTML += `<th>${d}</th>`);
            thead.innerHTML = headerHTML;

            // ✅ Dynamic label berdasarkan parameter
            const avgLabel = paramKey === 'debit' ? 'Total:' : 'Rata-rata:';

            tbody.innerHTML = '';
            data.forEach(row => {
                let tr = document.createElement('tr');
                let nameCell = `
                    <td class="fw-bold text-primary ps-3 border-end">
                        ${row.name}
                    </td>`;

                let dataCells = '';
                dates.forEach(dateStr => {
                    const vals = row.values[dateStr];
                    if (vals.avg === '-') {
                        dataCells += `<td class="text-center text-muted" style="vertical-align: middle;">-</td>`;
                    } else {
                        dataCells += `
                            <td>
                                <div class="val-block">
                                    <div class="val-row"><span class="val-label">${avgLabel}</span> <span class="val-data">${vals.avg}</span></div>
                                    <div class="val-row"><span class="val-label">Minimum:</span> <span class="val-data text-primary">${vals.min}</span></div>
                                    <div class="val-row"><span class="val-label">Maximum:</span> <span class="val-data text-danger">${vals.max}</span></div>
                                </div>
                            </td>
                        `;
                    }
                });
                tr.innerHTML = nameCell + dataCells;
                tbody.appendChild(tr);
            });
        }

        // ==================== PERFORMA SAMPLING FUNCTIONS ====================

        function switchTab(tab, element) {
            currentTab = tab;

            // Update tab styling
            document.querySelectorAll('.nav-tabs .nav-link').forEach(link => link.classList.remove('active'));
            element.classList.add('active');

            // Toggle sections
            if (tab === 'comparison') {
                stopAutoRefresh();
                document.getElementById('section-comparison').classList.remove('hidden');
                document.getElementById('section-performance').classList.add('hidden');
            } else if (tab === 'performance') {
                document.getElementById('section-comparison').classList.add('hidden');
                document.getElementById('section-performance').classList.remove('hidden');
            }
        }
        // Toggle date inputs berdasarkan interval type
        function togglePerfDateInputs() {
            const intervalType = document.getElementById('perfIntervalSelect').value;
            const startLabel = document.getElementById('perfDateStartLabel');
            const endCol = document.getElementById('perfDateEndCol');
            
            // Get 3 kolom pertama
            const stationCol = document.getElementById('perfStationCol');
            const intervalCol = document.getElementById('perfIntervalCol');
            const dateStartCol = document.getElementById('perfDateStartCol');
            
            if (intervalType === 'daily') {
                // ✅ MODE HARIAN: 4 kolom (col-md-3 each)
                
                // Ubah 3 kolom pertama jadi col-md-3
                stationCol.className = 'col-md-3 perf-col';
                intervalCol.className = 'col-md-3 perf-col';
                dateStartCol.className = 'col-md-3 perf-col';
                
                // Ubah label jadi "Tanggal Mulai"
                startLabel.innerHTML = 'Tanggal Mulai <span class="text-danger">*</span>';
                
                // Tampilkan kolom 4 (Tanggal Akhir)
                endCol.classList.remove('hidden');
                
                // Set default dates untuk range (7 hari terakhir)
                const today = new Date();
                const weekAgo = new Date();
                weekAgo.setDate(today.getDate() - 6);
                
                document.getElementById('perfDateStart').valueAsDate = weekAgo;
                document.getElementById('perfDateEnd').valueAsDate = today;
            } else {
                // ✅ MODE 2MIN/HOURLY: 3 kolom (col-md-4 each)
                
                // Ubah 3 kolom pertama jadi col-md-4
                stationCol.className = 'col-md-4 perf-col';
                intervalCol.className = 'col-md-4 perf-col';
                dateStartCol.className = 'col-md-4 perf-col';
                
                // Ubah label jadi "Tanggal"
                startLabel.innerHTML = 'Tanggal <span class="text-danger">*</span>';
                
                // Sembunyikan kolom 4 (Tanggal Akhir)
                endCol.classList.add('hidden');
                
                // Set tanggal hari ini
                document.getElementById('perfDateStart').valueAsDate = new Date();
            }
        }



        async function submitPerformance(isAuto = false) {
            const stationId = document.getElementById('perfStationSelect').value;
            const type = document.getElementById('perfIntervalSelect').value;
            
            let dateStr = '';
            
            // Cek apakah daily (menggunakan date range) atau tidak
            if (type === 'daily') {
                const startDate = document.getElementById('perfDateStart').value;
                const endDate = document.getElementById('perfDateEnd').value;
                
                if (!stationId || !startDate || !endDate) {
                    if (!isAuto) Swal.fire('Warning', 'Pilih stasiun, tanggal mulai, dan tanggal akhir', 'warning');
                    return;
                }
                
                // Validasi tanggal akhir >= tanggal mulai
                if (new Date(endDate) < new Date(startDate)) {
                    Swal.fire('Warning', 'Tanggal akhir harus sama atau setelah tanggal mulai', 'warning');
                    return;
                }
                
                // Untuk daily, kita akan loop dari startDate ke endDate
                dateStr = startDate; // Use startDate as reference
            } else {
                // Untuk 2min & hourly, gunakan perfDateStart sebagai date tunggal
                dateStr = document.getElementById('perfDateStart').value;
                
                if (!stationId || !dateStr) {
                    if (!isAuto) Swal.fire('Warning', 'Pilih stasiun dan tanggal', 'warning');
                    return;
                }
            }

            if (!isAuto) {
                Swal.fire({ title: 'Memuat...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
            }

            try {
                // Untuk daily dengan date range, aggregate data dari multiple days
                if (type === 'daily' && document.getElementById('perfDateStart').value && 
                    document.getElementById('perfDateEnd').value) {
                    
                    const startDate = new Date(document.getElementById('perfDateStart').value);
                    const endDate = new Date(document.getElementById('perfDateEnd').value);
                    
                    // Aggregate totals
                    let totalData = 0;
                    let totalReceived = 0;
                    let totalLoss = 0;
                    const allRows = [];
                    
                    // Loop through each date in range
                    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                        const dateStr = d.toISOString().split('T')[0];
                        const url = `${API_BASE}get_performance_data.php?trengginas_id=${stationId}&type=${type}&date=${dateStr}`;
                        const res = await fetch(url);
                        const result = await res.json();
                        
                        if (result.summary) {
                            totalData += result.summary.total_data || 0;
                            totalReceived += result.summary.sent_data || 0;
                            totalLoss += result.summary.loss_data || 0;
                        }
                        
                        // Collect rows with date prefix
                        if (result.data_rows && result.data_rows.length > 0) {
                            result.data_rows.forEach((row, idx) => {
                                allRows.push({
                                    date: dateStr,
                                    ...row
                                });
                            });
                        }
                    }
                    
                    // Update statistics with aggregated data
                    const pReceived = totalData > 0 ? ((totalReceived / totalData) * 100).toFixed(1) : "0.0";
                    const pLoss = totalData > 0 ? ((totalLoss / totalData) * 100).toFixed(1) : "0.0";
                    
                    document.getElementById('perfTargetData').innerText = totalData;
                    document.getElementById('perfTotalReceived').innerText = totalReceived;
                    document.getElementById('perfTotalLoss').innerText = totalLoss;
                    document.getElementById('perfPercentReceived').innerText = pReceived + '%';
                    document.getElementById('perfPercentLoss').innerText = pLoss + '%';
                    
                    // Render table with all rows
                    const tbody = document.getElementById('perfTableBody');
                    tbody.innerHTML = '';
                    
                    if (allRows.length === 0) {
                        tbody.innerHTML = '<tr><td colspan="3" class="text-center py-5 text-muted">Tidak ada data untuk rentang tanggal ini.</td></tr>';
                    } else {
                        // ✅ Reverse array untuk menampilkan data terbaru di atas
                        allRows.reverse();
                        
                        allRows.forEach((row, index) => {
                            const statusClass = row.IS_LOSS ? 'bg-danger text-white' : 'bg-success text-white';
                            const statusText = row.IS_LOSS ? 'Data Loss' : 'Diterima';
                            const rawTimestamp = row.timestamp || row['2min_timestamp'] || row['hour_timestamp'] || row['day_timestamp'] || '-';
                            
                            // Untuk daily interval, tampilkan hanya tanggal (YYYY-MM-DD)
                            const displayTime = rawTimestamp !== '-' ? rawTimestamp.split(' ')[0] : '-';
                            
                            const tr = document.createElement('tr');
                            tr.innerHTML = `
                                <td class="text-center fw-bold text-muted" style="font-family: 'Poppins', sans-serif;">${index + 1}</td>
                                <td class="text-center" style="font-family: 'Poppins', sans-serif; font-weight: 500;">${displayTime}</td>
                                <td class="text-center">
                                    <span class="badge ${statusClass} px-3 py-2" style="font-family: 'Poppins', sans-serif;">${statusText}</span>
                                </td>
                            `;
                            tbody.appendChild(tr);
                        });
                    }
                    
                } else {
                    // Original logic for single date (2min, hourly, or single daily)
                    const url = `${API_BASE}get_performance_data.php?trengginas_id=${stationId}&type=${type}&date=${dateStr}`;
                    const res = await fetch(url);
                    const result = await res.json();

                    // Update Statistik & Hitung Persentase Manual agar tidak 0%
                    if (result.summary) {
                        const total = result.summary.total_data || 0;
                        const received = result.summary.sent_data || 0;
                        const loss = result.summary.loss_data || 0;

                        const pReceived = total > 0 ? ((received / total) * 100).toFixed(1) : "0.0";
                        const pLoss = total > 0 ? ((loss / total) * 100).toFixed(1) : "0.0";

                        document.getElementById('perfTargetData').innerText = total;
                        document.getElementById('perfTotalReceived').innerText = received;
                        document.getElementById('perfTotalLoss').innerText = loss;
                        document.getElementById('perfPercentReceived').innerText = pReceived + '%';
                        document.getElementById('perfPercentLoss').innerText = pLoss + '%';
                    }

                    // Render Tabel (Hanya menampilkan data 2min, hourly, atau daily)
                    const tbody = document.getElementById('perfTableBody');
                    tbody.innerHTML = '';

                    if (result.data_rows && result.data_rows.length > 0) {
                        result.data_rows.forEach((row, index) => {
                            const isLoss = row.IS_LOSS === true;
                            const statusClass = isLoss ? 'bg-danger text-white' : 'bg-success text-white';

                            let rawTime = row.timestamp || row['2min_timestamp'] || row['hour_timestamp'] || row['day_timestamp'];
                            const displayTime = rawTime ? rawTime.split(' ')[1] : '-';

                            const tr = document.createElement('tr');
                            if (isLoss) tr.style.backgroundColor = "#fff5f5";

                            tr.innerHTML = `
                        <td class="text-center fw-bold text-muted" style="font-family: 'Poppins', sans-serif;">${index + 1}</td>
                        <td class="text-center" style="font-family: 'Poppins', sans-serif; font-weight: 500;">${displayTime}</td>
                        <td class="text-center">
                            <span class="badge ${statusClass} px-3 py-2" style="min-width: 100px; font-family: 'Poppins', sans-serif;">
                                ${isLoss ? 'Loss' : 'Diterima'}
                            </span>
                        </td>
                    `;
                            tbody.appendChild(tr);
                        });
                    }
                }

                // Show stats and table (di luar if-else block)
                document.getElementById('perfStatsContainer').style.display = 'flex';
                document.getElementById('perfTableContainer').style.display = 'block';

                if (!isAuto) Swal.close();

                // Hidupkan auto-refresh jika melihat data hari ini
                const today = new Date().toISOString().split('T')[0];
                if (dateStr === today) startAutoRefresh();
                else stopAutoRefresh();

            } catch (e) {
                console.error(e);
                if (!isAuto) Swal.fire('Error', 'Gagal memuat data', 'error');
            }
        }

        // Fungsi pembantu untuk mengelola interval
        function startAutoRefresh() {
            if (performanceInterval) return; // Jangan buat interval ganda
            performanceInterval = setInterval(() => {
                console.log("Auto Refreshing Data...");
                submitPerformance(true); // Kirim parameter true agar tidak muncul loading Swal
            }, 30000); // Cek setiap 30 detik
        }

        function stopAutoRefresh() {
            if (performanceInterval) {
                clearInterval(performanceInterval);
                performanceInterval = null;
            }
        }

        function renderPerformanceTable(results) {
            const tbody = document.getElementById('perfTableBody');
            tbody.innerHTML = '';

            results.forEach(row => {
                const statusClass = row.status === 'Diterima' ? 'bg-success text-white' : 'bg-danger text-white';

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="text-center fw-bold text-muted">${row.number}</td>
                    <td class="text-center">${row.timeRange}</td>
                    <td class="text-center">
                        <span class="badge ${statusClass} px-3 py-2">${row.status}</span>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        function resetPerformance() {
            // Reset form
            document.getElementById('perfStationSelect').selectedIndex = 0;
            document.getElementById('perfIntervalSelect').selectedIndex = 0;
            
            // Set tanggal hari ini untuk start date
            document.getElementById('perfDateStart').valueAsDate = new Date();
            
            // Reset date range juga (untuk default daily)
            const today = new Date();
            const weekAgo = new Date();
            weekAgo.setDate(today.getDate() - 6);
            document.getElementById('perfDateEnd').valueAsDate = today;
            
            // Toggle date inputs kembali ke default (3 kolom mode)
            togglePerfDateInputs();

            // Hide stats and table
            document.getElementById('perfStatsContainer').style.display = 'none';
            document.getElementById('perfTableContainer').style.display = 'none';

            // Reset table body
            const tbody = document.getElementById('perfTableBody');
            tbody.innerHTML = '<tr><td colspan="3" class="text-center py-5 text-muted">Silakan pilih filter dan klik Submit untuk memuat data performa.</td></tr>';

            Toast.fire({
                icon: 'success',
                title: 'Filter berhasil direset'
            });
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

