<?php
// FILE: public_html/api/get_station_data.php
date_default_timezone_set('Asia/Jakarta');
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

require_once __DIR__ . '/config.php';

$trengginas_id = $_GET['trengginas_id'] ?? '';
$type          = $_GET['type'] ?? 'raw';
$start_date    = $_GET['start_date'] ?? ''; 
$end_date      = $_GET['end_date'] ?? '';
$limit         = isset($_GET['limit']) ? intval($_GET['limit']) : 0;

if (empty($trengginas_id)) { echo json_encode([]); exit; }

// Mapping Tabel
$table = 'sensor_data_raw';
$timeCol = 'timestamp';

if ($type === '2min') {
    $table = 'sensor_data_2min_avg';
    $timeCol = '2min_timestamp';
} elseif ($type === 'hourly') {
    $table = 'sensor_data_hourly_avg';
    $timeCol = 'hour_timestamp';
} elseif ($type === 'daily') {
    $table = 'sensor_data_daily_avg';
    $timeCol = 'day_timestamp';
}

$params = [$trengginas_id];
$types = "s";

if ($limit > 0) {
    // Mode Auto-Refresh (ambil data paling terakhir saja)
    $sql = "SELECT * FROM $table WHERE trengginas_id = ? ORDER BY $timeCol DESC LIMIT ?";
    $params[] = $limit;
    $types .= "i";
} else {
    // Mode Tabel & Chart
    $sql = "SELECT * FROM $table WHERE trengginas_id = ?";
    
    if (!empty($start_date) && !empty($end_date)) {
        // Tambahkan jam default jika tidak ada
        $final_start = (strlen($start_date) <= 10) ? $start_date . " 00:00:00" : $start_date;
        $final_end   = (strlen($end_date) <= 10) ? $end_date . " 23:59:59" : $end_date;
        
        // STRICT DATE FILTER: 
        // 1. BETWEEN untuk timestamp lengkap
        // 2. DATE() untuk ensure hanya tanggal yang diminta
        $sql .= " AND $timeCol BETWEEN ? AND ? AND DATE($timeCol) BETWEEN DATE(?) AND DATE(?)";
        $params[] = $final_start;
        $params[] = $final_end;
        $params[] = $final_start;
        $params[] = $final_end;
        $types .= "ssss";
        
        // DYNAMIC LIMIT based on date range:
        // Calculate days between start and end
        $start = new DateTime($start_date);
        $end = new DateTime($end_date);
        $interval = $start->diff($end);
        $days = $interval->days + 1; // +1 to include both start and end day
        
        // Calculate appropriate limit based on data type and days
        if ($type === '2min') {
            // 2-min avg: ~720 rows per day
            $calculated_limit = $days * 800; // 800 per day for safety margin
        } elseif ($type === 'hourly') {
            // Hourly avg: 24 rows per day
            $calculated_limit = $days * 30; // 30 per day for safety
        } elseif ($type === 'daily') {
            // Daily avg: 1 row per day
            $calculated_limit = $days * 2; // 2 per day for safety
        } else {
            // Default for raw
            $calculated_limit = $days * 1500; // Higher for raw data
        }
        
        // Set minimum limit of 1000, maximum of 50000
        $final_limit = max(1000, min($calculated_limit, 50000));
        
        $sql .= " ORDER BY $timeCol DESC LIMIT " . $final_limit;
    } else {
        // No date filter: use default limit
        $sql .= " ORDER BY $timeCol DESC LIMIT 1000";
    }
}

$stmt = $conn->prepare($sql);
$stmt->bind_param($types, ...$params);
$stmt->execute();
$result = $stmt->get_result();

$data = [];
while ($row = $result->fetch_assoc()) {
    $data[] = $row;
}

echo json_encode($data);
$stmt->close();
$conn->close();
?>