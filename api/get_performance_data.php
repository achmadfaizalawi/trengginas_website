<?php
// FILE: public_html/api/get_performance_data.php
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");

// =================================================================
// 1. KONEKSI DATABASE (LANGSUNG)
// =================================================================
require_once __DIR__ . '/config.php';

// --- UBAH KE WIB (UTC+7) ---
$conn->query("SET time_zone = '+07:00'");

// =================================================================
// 2. AMBIL PARAMETER
// =================================================================
$trengginas_id = $_GET['trengginas_id'] ?? '';
$type = $_GET['type'] ?? 'hourly';
$dateInput = $_GET['date'] ?? '';

if (empty($trengginas_id)) {
    echo json_encode(["summary" => [], "data_rows" => []]);
    exit;
}

// =================================================================
// 3. CEK INFO STASIUN
// =================================================================
$sqlInfo = "SELECT timezone, visible_params FROM stations WHERE trengginas_id = '$trengginas_id' LIMIT 1";
$resInfo = $conn->query($sqlInfo);

$stationTimezone = 'WIB'; // Default WIB
$stationParams = [];      

if ($resInfo && $resInfo->num_rows > 0) {
    $rowInfo = $resInfo->fetch_assoc();
    
    if (!empty($rowInfo['timezone'])) {
        $stationTimezone = $rowInfo['timezone'];
    }

    if (!empty($rowInfo['visible_params'])) {
        $rawParams = explode(',', $rowInfo['visible_params']);
        $stationParams = array_map('trim', $rawParams); 
    }
}

if (empty($stationParams)) {
    $stationParams = ['ph', 'cod', 'tss', 'ammonia', 'debit'];
}

// =================================================================
// 4. HITUNG WAKTU (BASE SERVER: WIB)
// =================================================================
// Ambil waktu Server (Sekarang sudah WIB)
$queryTime = $conn->query("SELECT NOW() as server_time");
$rowTime = $queryTime->fetch_assoc();
$serverTimestamp = strtotime($rowTime['server_time']);

$offsetHours = 0;

// LOGIKA BARU (Server = WIB)
if ($stationTimezone == 'WITA') {
    $offsetHours = +1; // WITA = WIB + 1 Jam
} elseif ($stationTimezone == 'WIT') {
    $offsetHours = +2; // WIT = WIB + 2 Jam
}
// Jika WIB, offset tetap 0 (Sama dengan server)

// Waktu Real Stasiun
$stationNowTimestamp = strtotime("$offsetHours hours", $serverTimestamp);
$stationTodayDate = date('Y-m-d', $stationNowTimestamp);

if (empty($dateInput)) {
    $dateInput = $stationTodayDate;
}

// =================================================================
// 5. CONFIG TABEL
// =================================================================
$tableName = "";
$intervalMinutes = 0;
$timeCol = "";

if ($type == '2min') {
    $tableName = "sensor_data_2min_avg";
    $intervalMinutes = 2;
    $timeCol = "2min_timestamp";
} elseif ($type == 'hourly') {
    $tableName = "sensor_data_hourly_avg";
    $intervalMinutes = 60;
    $timeCol = "hour_timestamp";
} elseif ($type == 'daily') {
    $tableName = "sensor_data_daily_avg";
    $intervalMinutes = 1440;
    $timeCol = "day_timestamp";
}

// =================================================================
// 6. AMBIL DATA
// =================================================================
$dataMap = [];
$sql = "SELECT * FROM $tableName 
        WHERE trengginas_id = '$trengginas_id' 
        AND DATE($timeCol) = '$dateInput'";
$result = $conn->query($sql);

if ($result) {
    while ($row = $result->fetch_assoc()) {
        $timeKey = date('H:i:s', strtotime($row[$timeCol]));
        $dataMap[$timeKey] = $row;
    }
}

// =================================================================
// 7. GENERATE ROWS
// =================================================================
$responseRows = [];
$startTime = strtotime("$dateInput 00:00:00");
$endTime   = strtotime("$dateInput 23:59:59");

$isToday = ($dateInput == $stationTodayDate);

$totalData = 0;
$sentData  = 0;
$lossData  = 0;

for ($time = $startTime; $time <= $endTime; $time += ($intervalMinutes * 60)) {
    
    if ($isToday && $time > $stationNowTimestamp) {
        break; 
    }

    $timeString = date('H:i:s', $time); 
    $fullTimestamp = date('Y-m-d H:i:s', $time);
    
    $totalData++;

    if (isset($dataMap[$timeString])) {
        $row = $dataMap[$timeString];
        $row['IS_LOSS'] = false; 
        $responseRows[] = $row;
        $sentData++;
    } else {
        $lossRow = [
            'timestamp' => $fullTimestamp,
            'IS_LOSS' => true
        ];
        foreach ($stationParams as $param) {
            $keyName = 'avg_' . strtolower($param);
            $lossRow[$keyName] = null;
        }
        $responseRows[] = $lossRow;
        $lossData++;
    }
}

$percentSent = ($totalData > 0) ? round(($sentData / $totalData) * 100, 1) : 0;
$percentLoss = ($totalData > 0) ? round(($lossData / $totalData) * 100, 1) : 0;

echo json_encode([
    'meta' => [
        'station_timezone' => $stationTimezone,
        'server_timezone' => 'WIB', // Info debug
        'active_params' => $stationParams,
        'station_time_calc' => date('Y-m-d H:i:s', $stationNowTimestamp)
    ],
    'summary' => [
        'total_data' => $totalData,
        'sent_data' => $sentData,
        'loss_data' => $lossData,
        'percentage_sent' => $percentSent,
        'percentage_loss' => $percentLoss
    ],
    'data_rows' => array_reverse($responseRows) 
]);

$conn->close();
?>