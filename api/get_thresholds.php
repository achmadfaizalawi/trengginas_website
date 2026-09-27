<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

// ========== KONEKSI DATABASE ==========
require_once __DIR__ . '/config.php';

// ========== TERIMA PARAMETER ==========
$trengginas_id = $_GET['trengginas_id'] ?? '';

if (empty($trengginas_id)) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Trengginas ID wajib diisi!"]);
    exit;
}

// ========== QUERY THRESHOLDS ==========
$sql = "SELECT 
            parameter, 
            min_safe, 
            max_safe, 
            min_warning, 
            max_warning, 
            enabled 
        FROM station_thresholds 
        WHERE trengginas_id = ? 
        AND enabled = 1";

$stmt = $conn->prepare($sql);
$stmt->bind_param("s", $trengginas_id);
$stmt->execute();
$result = $stmt->get_result();

$thresholds = [];

while ($row = $result->fetch_assoc()) {
    $thresholds[$row['parameter']] = [
        'min_safe' => $row['min_safe'],
        'max_safe' => $row['max_safe'],
        'min_warning' => $row['min_warning'],
        'max_warning' => $row['max_warning'],
        'enabled' => (bool)$row['enabled']
    ];
}

echo json_encode([
    "status" => "success",
    "data" => $thresholds
]);

$stmt->close();
$conn->close();
?>