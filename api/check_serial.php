<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// --- Konfigurasi Database Hosting ---
require_once __DIR__ . '/config.php';

// Ambil parameter
$action = $_POST['action'] ?? 'check';
$machine_id = $_POST['machine_id'] ?? '';
$serial = $_POST['serial'] ?? '';

// Machine ID wajib ada untuk identifikasi perangkat
if (empty($machine_id)) {
    die(json_encode(["status" => "error", "message" => "Machine ID tidak terdeteksi"]));
}

// ========================================
// 1. CHECK STATUS (Modifikasi Dual Fungsi)
// ========================================
if ($action === 'check') {

    // KASUS A: INSTALLER (Ada kiriman Serial)
    // Tujuannya: Hanya mengecek apakah serial input VALID dan TERSEDIA (Jangan dikunci dulu!)
    if (!empty($serial)) {
        $stmt = $conn->prepare("SELECT serial_code, is_used, is_active, machine_id FROM serial_numbers WHERE serial_code = ? LIMIT 1");
        $stmt->bind_param("s", $serial);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($data = $result->fetch_assoc()) {
            // 1. Cek apakah serial aktif (tidak diblokir admin)
            if ($data['is_active'] == 0) {
                echo json_encode(["status" => "invalid", "message" => "Serial Number expired atau non-aktif."]);
            }
            // 2. Cek ketersediaan
            // Valid jika: (Belum dipakai) ATAU (Sudah dipakai oleh Mesin INI / Re-install)
            elseif ($data['is_used'] == 0 || ($data['is_used'] == 1 && $data['machine_id'] === $machine_id)) {
                echo json_encode(["status" => "valid", "message" => "Serial tersedia."]);
            } 
            else {
                // Sudah dipakai mesin BEDA
                echo json_encode(["status" => "invalid", "message" => "Serial Number sudah digunakan perangkat lain."]);
            }
        } else {
            echo json_encode(["status" => "invalid", "message" => "Serial Number tidak ditemukan."]);
        }
        $stmt->close();
    } 
    
    // KASUS B: APLIKASI FLUTTER (Tidak kirim serial, cuma cek status diri sendiri)
    // Logika LAMA tetap dipertahankan agar aplikasi yang sudah jalan tidak error.
    else {
        $stmt = $conn->prepare("SELECT serial_code, used_by, company_name, is_active FROM serial_numbers WHERE machine_id = ? LIMIT 1");
        $stmt->bind_param("s", $machine_id);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($data = $result->fetch_assoc()) {
            echo json_encode([
                "status" => "success",
                "is_active" => (int)$data['is_active'],
                "data" => [
                    "serial" => $data['serial_code'],
                    "user" => $data['used_by'] ?? "User",
                    "org" => $data['company_name'] ?? "Perusahaan"
                ]
            ]);
        } else {
            echo json_encode(["status" => "not_found", "message" => "Perangkat belum terdaftar"]);
        }
        $stmt->close();
    }
}

// ========================================
// 2. ACTIVATE (Kunci Serial ke Mesin)
// ========================================
// Dipanggil oleh Installer HANYA saat instalasi selesai (CurStepChanged)
elseif ($action === 'activate') {
    if (empty($serial)) {
        die(json_encode(["status" => "error", "message" => "Serial number kosong"]));
    }

    $user = $_POST['user'] ?? 'Unknown User';
    $company = $_POST['company'] ?? 'Unknown Company';

    // Cek validitas lagi sebelum update (double check)
    $stmt = $conn->prepare("SELECT serial_code, machine_id, is_used, is_active FROM serial_numbers WHERE serial_code = ? LIMIT 1");
    $stmt->bind_param("s", $serial);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        echo json_encode(["status" => "invalid", "message" => "Serial tidak ditemukan"]);
        $stmt->close();
        exit;
    }

    $data = $result->fetch_assoc();

    if ($data['is_active'] == 0) {
        echo json_encode(["status" => "invalid", "message" => "Serial expired"]);
        $stmt->close();
        exit;
    }

    // Pastikan belum diserobot mesin lain di detik-detik terakhir
    if ($data['is_used'] == 1 && !empty($data['machine_id']) && $data['machine_id'] !== $machine_id) {
        echo json_encode(["status" => "invalid", "message" => "Serial sudah digunakan"]);
        $stmt->close();
        exit;
    }

    // LAKUKAN PENGUNCIAN
    $stmt = $conn->prepare("UPDATE serial_numbers SET 
        machine_id = ?, 
        used_by = ?, 
        company_name = ?, 
        is_used = 1,
        used_at = NOW() 
        WHERE serial_code = ?");
    
    $stmt->bind_param("ssss", $machine_id, $user, $company, $serial);
    
    if ($stmt->execute()) {
        echo json_encode(["status" => "valid", "message" => "Aktivasi berhasil"]);
    } else {
        echo json_encode(["status" => "error", "message" => "Database error"]);
    }
    $stmt->close();
}

// ========================================
// 3. DEACTIVATE (Reset Serial)
// ========================================
elseif ($action === 'deactivate') {
    if (empty($serial)) {
        die(json_encode(["status" => "error", "message" => "Serial number kosong"]));
    }

    $stmt = $conn->prepare("UPDATE serial_numbers SET 
        is_used = 0,
        machine_id = NULL, 
        used_by = NULL, 
        company_name = NULL, 
        used_at = NULL 
        WHERE serial_code = ?");
    
    $stmt->bind_param("s", $serial);
    
    if ($stmt->execute() && $stmt->affected_rows > 0) {
        echo json_encode(["status" => "success", "message" => "Serial berhasil direset"]);
    } else {
        echo json_encode(["status" => "error", "message" => "Gagal reset (Serial salah/tidak ditemukan)"]);
    }
    $stmt->close();
}

else {
    echo json_encode(["status" => "error", "message" => "Action tidak valid"]);
}

$conn->close();
?>