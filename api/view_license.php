<?php
header('Content-Type: application/json');

// --- Konfigurasi Database Hosting ---
require_once __DIR__ . '/config.php';

// Terima Serial Number saja (tanpa validasi machine_id)
$serial = $_POST['serial'] ?? '';

if (empty($serial)) {
    die(json_encode([
        "status" => "error", 
        "message" => "Serial number tidak ditemukan"
    ]));
}

// Query berdasarkan serial saja
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

if ($result->num_rows === 0) {
    echo json_encode([
        "status" => "error",
        "message" => "Serial number tidak terdaftar"
    ]);
    $stmt->close();
    $conn->close();
    exit;
}

$data = $result->fetch_assoc();

// SELALU RETURN DATA (tidak ada validasi machine_id)
echo json_encode([
    "status" => "success",
    "message" => "Data lisensi berhasil diambil",
    "data" => [
        "serial" => $data['serial_code'],
        "is_active" => (int)$data['is_active'],
        "is_used" => (int)$data['is_used'],
        "used_by" => $data['used_by'] ?? 'Belum Diisi',
        "company_name" => $data['company_name'] ?? 'Belum Diisi',
        "machine_id" => $data['machine_id'] ?? '-',
        "used_at" => $data['used_at'] ?? '-'
    ]
]);

$stmt->close();
$conn->close();
?>