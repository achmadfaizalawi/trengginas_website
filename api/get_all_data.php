<?php
/**
 * GET ALL DATA FROM TRENGGINAS WQMS DATABASE
 * Simple PHP file untuk ambil semua data
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// =================================================================
// DATABASE CONNECTION
// =================================================================
require_once __DIR__ . '/config.php';

$conn->query("SET time_zone = '+07:00'");

// =================================================================
// GET PARAMETERS
// =================================================================
$table = $_GET['table'] ?? 'sensor_data_2min_avg';
$trengginas_id = $_GET['trengginas_id'] ?? '';
$limit = isset($_GET['limit']) ? intval($_GET['limit']) : 100;
$start_date = $_GET['start_date'] ?? '';
$end_date = $_GET['end_date'] ?? '';

// =================================================================
// BUILD QUERY
// =================================================================
$sql = "SELECT * FROM $table WHERE 1=1";

// Filter by station
if (!empty($trengginas_id)) {
    $sql .= " AND trengginas_id = '" . $conn->real_escape_string($trengginas_id) . "'";
}

// Filter by date range
if (!empty($start_date) && !empty($end_date)) {
    $sql .= " AND DATE(timestamp) BETWEEN '$start_date' AND '$end_date'";
}

// Order and limit
$sql .= " ORDER BY id DESC LIMIT $limit";

// =================================================================
// EXECUTE QUERY
// =================================================================
$result = $conn->query($sql);

if (!$result) {
    die(json_encode(['error' => 'Query failed: ' . $conn->error]));
}

// =================================================================
// FETCH DATA
// =================================================================
$data = [];
while ($row = $result->fetch_assoc()) {
    $data[] = $row;
}

// =================================================================
// RETURN JSON
// =================================================================
echo json_encode([
    'success' => true,
    'count' => count($data),
    'table' => $table,
    'data' => $data
]);

$conn->close();
?>