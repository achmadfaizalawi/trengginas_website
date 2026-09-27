<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

// 1. KONEKSI DATABASE
    require_once __DIR__ . '/../config.php';

// 2. TERIMA DATA
$json_input = file_get_contents('php://input');
$data = json_decode($json_input, true);

// 3. GENERATE ID (TRG-XXXXX)
$random_suffix = strtoupper(bin2hex(random_bytes(3))); 
$trengginas_id = "TRG-" . $random_suffix;

// 4. PROSES PARAMETER TERPILIH
// Frontend mengirim array, misal: ["ph", "cod", "tss"]
$params_list = "ph,cod,tss,ammonia,debit"; // Default fallback
if (isset($data['params']) && is_array($data['params'])) {
    $params_list = implode(",", $data['params']);
}

// 5. INSERT (Nama & Lokasi dikosongkan/NULL dulu)
$status = 'inactive';
$default_name = "New Station ($trengginas_id)"; // Nama sementara

$sql = "INSERT INTO stations (trengginas_id, name, status, visible_params) VALUES (?, ?, ?, ?)";
$stmt = $conn->prepare($sql);

if ($stmt) {
    $stmt->bind_param("ssss", $trengginas_id, $default_name, $status, $params_list);

    if ($stmt->execute()) {
        http_response_code(201); 
        echo json_encode([
            "status" => "success", 
            "message" => "Stasiun berhasil dibuat.",
            "data" => [
                "trengginas_id" => $trengginas_id
            ]
        ]);
    } else {
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "Gagal: " . $stmt->error]);
    }
    $stmt->close();
} else {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Query Error"]);
}

$conn->close();
?>