        const BASE_API = '/api';
        let currentUser = null;

        // Toast notification configuration
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

        // Parameter configuration
        const AVAILABLE_PARAMS = {
            'ph': { label: 'pH', unit: '-', color: '#4e73df', icon: 'fa-water' },
            'cod': { label: 'COD', unit: 'mg/L', color: '#e74a3b', icon: 'fa-flask' },
            'tss': { label: 'TSS', unit: 'mg/L', color: '#1cc88a', icon: 'fa-vial' },
            'ammonia': { label: 'Amonia', unit: 'mg/L', color: '#f6c23e', icon: 'fa-skull-crossbones' },
            'debit': { label: 'Debit', unit: 'm3/h', color: '#36b9cc', icon: 'fa-tachometer-alt' },
            'temperature': { label: 'Temperatur', unit: '°C', color: '#fd7e14', icon: 'fa-thermometer-half' },
            'do': { label: 'DO', unit: 'mg/L', color: '#6610f2', icon: 'fa-tint' },
            'turbidity': { label: 'Kekeruhan', unit: 'NTU', color: '#858796', icon: 'fa-eye-slash' },
            'tds': { label: 'TDS', unit: 'ppm', color: '#20c997', icon: 'fa-atom' },
            'nitrate': { label: 'Nitrat', unit: 'mg/L', color: '#d63384', icon: 'fa-leaf' },
            'bod': { label: 'BOD', unit: 'mg/L', color: '#dc3545', icon: 'fa-bacterium' },
            'water_level': { label: 'Level Air', unit: 'm', color: '#0dcaf0', icon: 'fa-ruler-vertical' }
        };

        let stationsData = [];

        // Pagination variables
        let allSerials = [];
        let currentPage = 1;
        const itemsPerPage = 10;

        // Check authentication
        function checkAuth() {
            const user = localStorage.getItem('wqms_user');
            if (!user) {
                window.location.href = 'index.html';
                return false;
            }
            
            currentUser = JSON.parse(user);
            
            if (currentUser.role !== 'superuser') {
                Swal.fire({
                    icon: 'error',
                    title: 'Akses Ditolak',
                    text: 'Hanya Super User yang dapat mengakses halaman ini',
                    confirmButtonText: 'Kembali'
                }).then(() => {
                    window.location.href = 'index.html';
                });
                return false;
            }
            
            document.getElementById('user-name-display').innerText = currentUser.full_name || currentUser.username || 'Admin';
            document.getElementById('user-role-display').innerText = (currentUser.role || 'SUPERUSER').toUpperCase();
            document.getElementById('page-title').innerText = 'Serial Number';
            
            // Set current date
            document.getElementById('current-date').innerText = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            
            const superuserMenu = document.getElementById('superuser-menu');
            if (superuserMenu) {
                superuserMenu.classList.remove('hidden');
            }
            
            return true;
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

        function toggleMobileSidebar() {
            document.body.classList.toggle('show-sidebar');
        }

        document.addEventListener('click', function(e) {
            if (document.body.classList.contains('show-sidebar')) {
                const sidebar = document.querySelector('.sidebar');
                const mobileToggle = document.getElementById('mobile-toggle');
                if (!sidebar.contains(e.target) && e.target !== mobileToggle) {
                    document.body.classList.remove('show-sidebar');
                }
            }
        });


        // ============================================
        // STATION MODAL FUNCTIONS
        // ============================================

        function openStationModal() {
            loadParamCheckboxes();
            const modal = new bootstrap.Modal(document.getElementById('stationModal'));
            modal.show();
        }

        function loadParamCheckboxes() {
            const container = document.getElementById('param-checkboxes');
            container.innerHTML = '';
            
            Object.keys(AVAILABLE_PARAMS).forEach(key => {
                const param = AVAILABLE_PARAMS[key];
                container.innerHTML += `
                    <div class="col-6">
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" value="${key}" id="param_${key}" checked>
                            <label class="form-check-label small" for="param_${key}">
                                ${param.label} (${param.unit})
                            </label>
                        </div>
                    </div>
                `;
            });
        }

        async function saveStation() {
            const checkboxes = document.querySelectorAll('#param-checkboxes input[type="checkbox"]:checked');
            const selectedParams = Array.from(checkboxes).map(cb => cb.value);
            
            if (selectedParams.length === 0) {
                Swal.fire('Warning', 'Pilih minimal 1 parameter!', 'warning');
                return;
            }
            
            try {
                const res = await fetch(`${BASE_API}/admin/add_station.php`, {
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
                    });
                } else {
                    Swal.fire('Gagal', result.message, 'error');
                }
            } catch (e) {
                console.error(e);
                Swal.fire('Error', e.message || 'Terjadi kesalahan saat generate stasiun', 'error');
            }
        }

        // ============================================
        // PROFILE MODAL FUNCTIONS
        // ============================================

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
            document.getElementById('profile-fullname').value = currentUser.full_name || "";
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
                id: currentUser.user_id || currentUser.id,
                username: currentUser.username,
                full_name: newName,
                password: newPass,
                role: currentUser.role,
                assigned_station_ids: currentUser.assigned_station_id
            };

            try {
                const res = await fetch(`${BASE_API}/admin/save_user.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(fullPayload)
                });
                const result = await res.json();

                if (result.status === 'success') {
                    // Update currentUser in memory
                    currentUser.full_name = newName;
                    
                    // Update localStorage
                    localStorage.setItem('wqms_user', JSON.stringify(currentUser));
                    
                    // Update display name in UI
                    document.getElementById('user-name-display').innerText = newName;
                    
                    // Close modal
                    const modalEl = document.getElementById('profileModal');
                    const modal = bootstrap.Modal.getInstance(modalEl);
                    modal.hide();
                    
                    // Show toast notification
                    Toast.fire({ icon: 'success', title: 'Profil berhasil diperbarui!' });
                } else {
                    Swal.fire('Gagal', result.message, 'error');
                }
            } catch (e) {
                Swal.fire('Error', e.message, 'error');
            }
        }

        // ============================================
        // EDIT SERIAL FUNCTIONS
        // ============================================

        function openEditSerialModal(serialId, isActive, company) {
            document.getElementById('edit-serial-id').value = serialId;
            document.getElementById('edit-serial-status').value = isActive;
            document.getElementById('edit-serial-company').value = company || '';
            
            const modal = new bootstrap.Modal(document.getElementById('editSerialModal'));
            modal.show();
        }

        async function saveEditedSerial() {
            const serialId = document.getElementById('edit-serial-id').value;
            const status = document.getElementById('edit-serial-status').value;
            const company = document.getElementById('edit-serial-company').value.trim();

            try {
                Swal.fire({
                    title: 'Menyimpan...',
                    allowOutsideClick: false,
                    didOpen: () => {
                        Swal.showLoading();
                    }
                });

                const res = await fetch(`${BASE_API}/admin/update_serial_number.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: serialId,
                        is_active: status,
                        company_name: company || null
                    })
                });

                const result = await res.json();

                if (result.success) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Berhasil!',
                        text: 'Serial number berhasil diupdate',
                        confirmButtonText: 'OK'
                    }).then(() => {
                        bootstrap.Modal.getInstance(document.getElementById('editSerialModal')).hide();
                        loadSerials(); // Reload table
                    });
                } else {
                    Swal.fire('Error', result.message || 'Gagal update serial number', 'error');
                }
            } catch (e) {
                console.error(e);
                Swal.fire('Error', 'Terjadi kesalahan saat menyimpan perubahan', 'error');
            }
        }

        // ============================================
        // DELETE SERIAL FUNCTION
        // ============================================

        async function deleteSerial(serialId, serialCode, isUsed) {
            // Double check: prevent delete if USED
            if (isUsed == 1) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Tidak Dapat Dihapus',
                    text: 'Serial number yang sedang digunakan tidak dapat dihapus',
                    confirmButtonText: 'OK'
                });
                return;
            }

            // Confirmation dialog
            const result = await Swal.fire({
                title: 'Hapus Serial Number?',
                html: `Apakah Anda yakin ingin menghapus serial number <strong>${serialCode}</strong>?<br><small class="text-muted">Nomor ini akan tersedia untuk generate ulang.</small>`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#6c757d',
                confirmButtonText: 'Ya, Hapus!',
                cancelButtonText: 'Batal'
            });

            if (!result.isConfirmed) return;

            try {
                Swal.fire({
                    title: 'Menghapus...',
                    allowOutsideClick: false,
                    didOpen: () => {
                        Swal.showLoading();
                    }
                });

                const res = await fetch(`${BASE_API}/admin/delete_serial_number.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: serialId })
                });

                const data = await res.json();

                if (data.success) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Berhasil!',
                        text: `Serial number ${serialCode} berhasil dihapus`,
                        timer: 2000,
                        showConfirmButton: false
                    }).then(() => {
                        loadSerials(); // Reload table
                    });
                } else {
                    Swal.fire('Error', data.message || 'Gagal menghapus serial number', 'error');
                }
            } catch (e) {
                console.error(e);
                Swal.fire('Error', 'Terjadi kesalahan saat menghapus serial number', 'error');
            }
        }

        async function loadSerials() {
            try {
                const res = await fetch(`${BASE_API}/admin/get_serial_numbers.php`);
                const data = await res.json();
                
                if (!data || data.length === 0) {
                    const tbody = document.getElementById('serial-table-body');
                    tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-muted">Belum ada serial number. Klik "Generate" untuk membuat yang pertama!</td></tr>';
                    document.getElementById('pagination-container').style.display = 'none';
                    return;
                }
                
                // Sort data by serial_code numerically (TRG001, TRG002, ...)
                allSerials = data.sort((a, b) => {
                    // Extract number from serial code (e.g., TRG007 -> 7)
                    const numA = parseInt(a.serial_code.replace(/\D/g, ''), 10);
                    const numB = parseInt(b.serial_code.replace(/\D/g, ''), 10);
                    return numA - numB; // Ascending order
                });
                
                // Show pagination only if more than 10 items
                if (allSerials.length > 10) {
                    document.getElementById('pagination-container').style.display = 'flex';
                } else {
                    document.getElementById('pagination-container').style.display = 'none';
                }
                
                // Render current page
                renderPage();
                
            } catch (e) {
                console.error('Error loading serials:', e);
                const tbody = document.getElementById('serial-table-body');
                tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-danger">Gagal memuat data. Silakan refresh halaman.</td></tr>';
                document.getElementById('pagination-container').style.display = 'none';
            }
        }

        function renderPage() {
            const tbody = document.getElementById('serial-table-body');
            tbody.innerHTML = '';
            
            const totalPages = Math.ceil(allSerials.length / itemsPerPage);
            const startIndex = (currentPage - 1) * itemsPerPage;
            const endIndex = Math.min(startIndex + itemsPerPage, allSerials.length);
            const pageData = allSerials.slice(startIndex, endIndex);
            
            pageData.forEach((serial, index) => {
                const globalIndex = startIndex + index + 1;
                
                const statusBadge = serial.is_active == 1 
                    ? '<span class="badge bg-success">Active</span>' 
                    : '<span class="badge bg-secondary">Inactive</span>';
                
                const usedBadge = serial.is_used == 1 
                    ? '<span class="badge bg-warning text-dark">Used</span>' 
                    : '<span class="badge bg-light text-dark">Available</span>';
                
                const machineId = serial.machine_id || '<span class="text-muted">-</span>';
                const usedBy = serial.used_by || '<span class="text-muted">-</span>';
                const companyName = serial.company_name || '<span class="text-muted">-</span>';
                const usedAt = serial.used_at || '<span class="text-muted">-</span>';
                
                // Escape quotes for onclick parameters
                const escapedCompany = (serial.company_name || '').replace(/'/g, "\\'");
                
                tbody.innerHTML += `
                    <tr>
                        <td class="ps-4 fw-bold text-muted">${globalIndex}</td>
                        <td><span class="badge bg-primary font-monospace">${serial.serial_code}</span></td>
                        <td>${statusBadge}</td>
                        <td>${usedBadge}</td>
                        <td class="small">${machineId}</td>
                        <td class="small">${usedBy}</td>
                        <td class="small">${companyName}</td>
                        <td class="small text-muted">${usedAt}</td>
                        <td class="text-end pe-4 text-nowrap">
                            <button class="btn btn-sm btn-outline-primary me-1" 
                                onclick="openEditSerialModal(${serial.id}, ${serial.is_active}, '${escapedCompany}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" 
                                onclick="deleteSerial(${serial.id}, '${serial.serial_code}', ${serial.is_used})"
                                ${serial.is_used == 1 ? 'disabled title="Tidak dapat menghapus serial yang sedang digunakan"' : ''}>
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
            
            // Update pagination info
            document.getElementById('showing-range').innerText = `${startIndex + 1}-${endIndex}`;
            document.getElementById('total-records').innerText = allSerials.length;
            document.getElementById('current-page').innerText = currentPage;
            
            // Update button states
            document.getElementById('btn-prev').disabled = currentPage === 1;
            document.getElementById('btn-next').disabled = currentPage === totalPages;
        }

        function changePage(direction) {
            const totalPages = Math.ceil(allSerials.length / itemsPerPage);
            const newPage = currentPage + direction;
            
            if (newPage >= 1 && newPage <= totalPages) {
                currentPage = newPage;
                renderPage();
            }
        }

        function goToLastPage() {
            const totalPages = Math.ceil(allSerials.length / itemsPerPage);
            currentPage = totalPages || 1;
        }

        async function generateSerial() {
            Swal.fire({
                title: 'Generate Serial Baru?',
                text: 'Serial number baru akan dibuat otomatis dengan format TRG00X',
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#28a745',
                cancelButtonColor: '#6c757d',
                confirmButtonText: 'Ya, Generate!',
                cancelButtonText: 'Batal'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    try {
                        Swal.fire({
                            title: 'Generating...',
                            text: 'Mohon tunggu',
                            allowOutsideClick: false,
                            didOpen: () => {
                                Swal.showLoading();
                            }
                        });
                        
                        const res = await fetch(`${BASE_API}/admin/generate_serial_number.php`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' }
                        });
                        
                        const data = await res.json();
                        
                        if (data.success) {
                            Swal.fire({
                                icon: 'success',
                                title: 'Berhasil!',
                                html: `Serial number <strong>${data.serial_code}</strong> berhasil di-generate!`,
                                confirmButtonText: 'OK'
                            });
                            goToLastPage();
                            loadSerials();
                        } else {
                            Swal.fire('Error', data.message || 'Gagal generate serial number', 'error');
                        }
                    } catch (e) {
                        console.error(e);
                        Swal.fire('Error', 'Terjadi kesalahan saat generate serial', 'error');
                    }
                }
            });
        }

        document.addEventListener('DOMContentLoaded', function() {
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
            } else if (icon) {
                icon.classList.remove('fa-chevron-right');
                icon.classList.add('fa-chevron-left');
            }
            
            if (checkAuth()) {
                loadSerials();
            }
        });
