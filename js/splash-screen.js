/* ==========================================
   TRENGGINAS WQMS - SPLASH SCREEN FUNCTIONS
   Universal JavaScript untuk semua halaman
   ========================================== */

/**
 * Show splash screen with custom message
 * @param {string} message - Message to display
 */
function showSplashScreen(message = 'Memuat...') {
    const splash = document.getElementById('splash-screen');
    const splashMessage = document.getElementById('splash-message');
    
    if (splash && splashMessage) {
        splashMessage.textContent = message;
        splash.classList.remove('hide');
        
        // Prevent body scroll when splash is visible
        document.body.style.overflow = 'hidden';
    }
}

/**
 * Hide splash screen
 */
function hideSplashScreen() {
    const splash = document.getElementById('splash-screen');
    
    if (splash) {
        splash.classList.add('hide');
        
        // Re-enable body scroll
        document.body.style.overflow = '';
    }
}

/**
 * Update splash screen message without hiding
 * @param {string} message - New message to display
 */
function updateSplashMessage(message) {
    const splashMessage = document.getElementById('splash-message');
    
    if (splashMessage) {
        splashMessage.textContent = message;
    }
}

/**
 * Enhanced logout function with splash screen
 * Call this from all pages
 */
function logoutWithSplash() {
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
            
            // Clear intervals if exists
            if (typeof currentInterval !== 'undefined' && currentInterval) {
                clearInterval(currentInterval);
            }
            
            // Clear user data
            localStorage.removeItem('wqms_user');
            sessionStorage.clear();
            
            // Small delay for better UX
            setTimeout(() => {
                updateSplashMessage('Sampai jumpa lagi!');
                
                setTimeout(() => {
                    // Redirect to index
                    window.location.href = '/index.html';
                }, 500);
            }, 800);
        }
    });
}

// Auto-initialize: Hide splash on page load
document.addEventListener('DOMContentLoaded', function() {
    // Check if splash exists (only on index.html initially)
    const splash = document.getElementById('splash-screen');
    if (splash && !splash.classList.contains('hide')) {
        // Give it a moment then hide
        setTimeout(() => {
            hideSplashScreen();
        }, 500);
    }
});
