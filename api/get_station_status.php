<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

// Database connection
require_once __DIR__ . '/config.php';

// Set timezone ke WIB
$conn->query("SET time_zone = '+07:00'");

// Ambil parameter
$trengginas_id = $_GET['trengginas_id'] ?? '';
$threshold_minutes = isset($_GET['threshold']) ? intval($_GET['threshold']) : 5;

if (empty($trengginas_id)) {
    die(json_encode([
        "error" => "trengginas_id required",
        "online" => false
    ]));
}

// Query untuk ambil data terbaru dari tabel 2min_avg
$stmt = $conn->prepare("
    SELECT 
        2min_timestamp,
        TIMESTAMPDIFF(MINUTE, 2min_timestamp, NOW()) as minutes_ago
    FROM sensor_data_2min_avg
    WHERE trengginas_id = ?
    ORDER BY 2min_timestamp DESC
    LIMIT 1
");

$stmt->bind_param("s", $trengginas_id);
$stmt->execute();
$result = $stmt->get_result();

if ($row = $result->fetch_assoc()) {
    $minutes_ago = intval($row['minutes_ago']);
    $is_online = ($minutes_ago <= $threshold_minutes);
    
    echo json_encode([
        "online" => $is_online,
        "last_update" => $row['2min_timestamp'],
        "minutes_ago" => $minutes_ago,
        "threshold" => $threshold_minutes,
        "server_time" => date('Y-m-d H:i:s'),
        "trengginas_id" => $trengginas_id
    ]);
} else {
    // Tidak ada data sama sekali
    echo json_encode([
        "online" => false,
        "last_update" => null,
        "minutes_ago" => null,
        "error" => "No data found",
        "trengginas_id" => $trengginas_id
    ]);
}

$stmt->close();
$conn->close();
?>