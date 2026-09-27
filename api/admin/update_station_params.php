<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

// ========== KONEKSI DATABASE ==========
require_once __DIR__ . '/../config.php';

// ========== TERIMA DATA ==========
$json_input = file_get_contents('php://input');
$data = json_decode($json_input, true);

if (empty($data)) {
    die(json_encode(["status" => "error", "message" => "No data received"]));
}

$trengginas_id = $data['trengginas_id'] ?? '';
$params = $data['params'] ?? [];

// ========== VALIDASI INPUT ==========

// 1. Cek Trengginas ID wajib ada
if (empty($trengginas_id)) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Trengginas ID wajib diisi!"]);
    exit;
}

// 2. Cek parameter array tidak kosong
if (empty($params) || !is_array($params)) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Pilih minimal 1 parameter!"]);
    exit;
}

// 3. Validasi bahwa station dengan trengginas_id ini ada
$check_stmt = $conn->prepare("SELECT id FROM stations WHERE trengginas_id = ? LIMIT 1");
$check_stmt->bind_param("s", $trengginas_id);
$check_stmt->execute();
$check_result = $check_stmt->get_result();

if ($check_result->num_rows === 0) {
    http_response_code(404);
    echo json_encode(["status" => "error", "message" => "Stasiun dengan ID tersebut tidak ditemukan!"]);
    exit;
}
$check_stmt->close();

// ========== EKSEKUSI UPDATE ==========

// Konversi array parameter ke string (comma-separated)
$params_string = implode(',', $params);

$sql = "UPDATE stations SET visible_params = ? WHERE trengginas_id = ?";
$stmt = $conn->prepare($sql);

if (!$stmt) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Query Error: " . $conn->error]);
    exit;
}

$stmt->bind_param("ss", $params_string, $trengginas_id);

if ($stmt->execute()) {
    if ($stmt->affected_rows > 0) {
        echo json_encode([
            "status" => "success", 
            "message" => "Parameter berhasil diperbarui",
            "data" => [
                "trengginas_id" => $trengginas_id,
                "visible_params" => $params_string
            ]
        ]);
    } else {
        echo json_encode([
            "status" => "warning", 
            "message" => "Tidak ada perubahan data (parameter sama dengan sebelumnya)"
        ]);
    }
} else {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Update gagal: " . $stmt->error]);
}

$stmt->close();
$conn->close();
?>