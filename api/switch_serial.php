<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// --- Konfigurasi Database ---
require_once __DIR__ . '/config.php';

// Ambil input
$old_serial = $_POST['old_serial'] ?? '';
$new_serial = $_POST['new_serial'] ?? '';
$machine_id = $_POST['machine_id'] ?? '';

// Validasi
if (empty($old_serial) || empty($new_serial) || empty($machine_id)) {
    die(json_encode([
        'status' => 'error',
        'message' => 'Parameter tidak lengkap'
    ]));
}

// === CEK SERIAL LAMA ===
$stmt = $conn->prepare("SELECT * FROM serial_numbers WHERE serial_code = ?");
$stmt->bind_param("s", $old_serial);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    echo json_encode(['status' => 'error', 'message' => 'Serial lama tidak ditemukan']);
    $stmt->close();
    $conn->close();
    exit;
}

$old_license = $result->fetch_assoc();
$stmt->close();

// === CEK SERIAL BARU ===
$stmt = $conn->prepare("SELECT * FROM serial_numbers WHERE serial_code = ?");
$stmt->bind_param("s", $new_serial);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    echo json_encode(['status' => 'error', 'message' => 'Serial baru tidak ditemukan']);
    $stmt->close();
    $conn->close();
    exit;
}

$new_license = $result->fetch_assoc();
$stmt->close();

// === CEK SERIAL BARU SUDAH DIPAKAI? ===
if ($new_license['is_used'] == 1 && 
    !empty($new_license['machine_id']) && 
    $new_license['machine_id'] != $machine_id) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Serial baru sudah dipakai device lain'
    ]);
    $conn->close();
    exit;
}

// === RATE LIMITING ===
$stmt = $conn->prepare("
    SELECT COUNT(*) as attempts 
    FROM serial_switch_logs 
    WHERE machine_id = ? 
    AND timestamp > DATE_SUB(NOW(), INTERVAL 1 HOUR)
");

if ($stmt) {
    $stmt->bind_param("s", $machine_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    
    if ($row && $row['attempts'] >= 5) {
        echo json_encode([
            'status' => 'error',
            'message' => 'Terlalu banyak percobaan. Coba lagi dalam 1 jam.'
        ]);
        $stmt->close();
        $conn->close();
        exit;
    }
    $stmt->close();
}

// === PROSES PENGGANTIAN ===
$conn->begin_transaction();

try {
    // PINDAHKAN DATA
    $new_used_by = !empty($old_license['used_by']) ? $old_license['used_by'] : $new_license['used_by'];
    $new_company_name = !empty($old_license['company_name']) ? $old_license['company_name'] : $new_license['company_name'];

    // 1. RESET SERIAL LAMA (HAPUS SEMUA DATA)
    $stmt = $conn->prepare("
        UPDATE serial_numbers 
        SET is_active = 0, 
            is_used = 0, 
            machine_id = NULL,
            used_by = NULL,
            company_name = NULL,
            used_at = NULL
        WHERE serial_code = ?
    ");
    $stmt->bind_param("s", $old_serial);
    $stmt->execute();
    $stmt->close();

    // 2. AKTIFKAN SERIAL BARU (DENGAN DATA MIGRASI)
    $stmt = $conn->prepare("
        UPDATE serial_numbers 
        SET machine_id = ?, 
            is_used = 1, 
            used_by = ?, 
            company_name = ?, 
            used_at = NOW()
        WHERE serial_code = ?
    ");
    $stmt->bind_param("ssss", $machine_id, $new_used_by, $new_company_name, $new_serial);
    $stmt->execute();
    $stmt->close();

    // 3. LOG
    $stmt = $conn->prepare("
        INSERT INTO serial_switch_logs 
        (machine_id, old_serial, new_serial, timestamp, success) 
        VALUES (?, ?, ?, NOW(), 1)
    ");
    
    if ($stmt) {
        $stmt->bind_param("sss", $machine_id, $old_serial, $new_serial);
        $stmt->execute();
        $stmt->close();
    }

    $conn->commit();

    echo json_encode([
        'status' => 'success',
        'message' => 'Serial berhasil diganti',
        'data' => [
            'serial' => $new_serial,
            'is_active' => (int)$new_license['is_active'],
            'is_used' => 1,
            'used_by' => $new_used_by ?? 'Belum Diisi',
            'company_name' => $new_company_name ?? 'Belum Diisi',
            'machine_id' => $machine_id
        ]
    ]);

} catch (Exception $e) {
    $conn->rollback();
    echo json_encode(['status' => 'error', 'message' => 'Gagal proses: ' . $e->getMessage()]);
}

$conn->close();
?>