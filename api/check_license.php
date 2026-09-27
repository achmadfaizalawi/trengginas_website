<?php
header('Content-Type: application/json');

// --- Konfigurasi Database Hosting ---
require_once __DIR__ . '/config.php';

// --- Terima Parameter dari Flutter ---
$serial = $_POST['serial'] ?? '';        // Serial dari file config/serial.txt
$machine_id = $_POST['machine_id'] ?? ''; // Format: Hostname-Username

// --- Validasi Input ---
if (empty($serial)) {
    die(json_encode([
        "status" => "error", 
        "message" => "Serial number tidak ditemukan"
    ]));
}

if (empty($machine_id)) {
    die(json_encode([
        "status" => "error", 
        "message" => "Machine ID tidak terdeteksi"
    ]));
}

// --- Query Lisensi Berdasarkan Serial Code ---
// PENTING: Ganti 'serial_codes' dengan 'serial_numbers' jika nama tabel berbeda
$stmt = $conn->prepare("
    SELECT 
        serial_code, 
        is_active, 
        is_used, 
        machine_id, 
        used_by, 
        company_name, 
        used_at 
    FROM serial_numbers 
    WHERE serial_code = ? 
    LIMIT 1
");

$stmt->bind_param("s", $serial);
$stmt->execute();
$result = $stmt->get_result();

// --- Cek Apakah Serial Terdaftar ---
if ($result->num_rows === 0) {
    echo json_encode([
        "status" => "error",
        "message" => "Serial number tidak terdaftar di sistem"
    ]);
    $stmt->close();
    $conn->close();
    exit;
}

$data = $result->fetch_assoc();

// --- VALIDASI 1: Cek Apakah Serial Aktif (is_active = 1) ---
if ($data['is_active'] != 1) {
    echo json_encode([
        "status" => "error",
        "message" => "Serial number telah dinonaktifkan oleh administrator",
        "data" => [
            "serial" => $data['serial_code'],
            "is_active" => 0,
            "used_by" => $data['used_by'] ?? '-',
            "company_name" => $data['company_name'] ?? '-'
        ]
    ]);
    $stmt->close();
    $conn->close();
    exit;
}

// --- VALIDASI 2: Cek Apakah Sedang Dipakai di Mesin Lain ---
if ($data['is_used'] == 1 && $data['machine_id'] != $machine_id) {
    echo json_encode([
        "status" => "error",
        "message" => "Serial number sedang digunakan di perangkat lain",
        "data" => [
            "serial" => $data['serial_code'],
            "is_active" => 0,  // Tidak boleh digunakan
            "used_by" => $data['used_by'] ?? '-',
            "company_name" => $data['company_name'] ?? '-',
            "current_machine" => $data['machine_id']
        ]
    ]);
    $stmt->close();
    $conn->close();
    exit;
}

// --- SUKSES: Lisensi Valid ---
echo json_encode([
    "status" => "success",
    "message" => "Lisensi valid dan aktif",
    "data" => [
        "serial" => $data['serial_code'],
        "is_active" => 1,  // Lisensi aktif
        "used_by" => $data['used_by'] ?? '-',
        "company_name" => $data['company_name'] ?? '-',
        "machine_id" => $data['machine_id'],
        "used_at" => $data['used_at']
    ]
]);

$stmt->close();
$conn->close();
?>