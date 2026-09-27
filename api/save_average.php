<?php
// FILE: public_html/api/save_average.php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

error_reporting(E_ALL);
ini_set('display_errors', 0);

$JWT_SECRET_KEY = "Tr3ngg1n4s_9x#vLm2@K8_pQ5!zR_S3cur3_2025"; 

// 1. KONEKSI DB
require_once __DIR__ . '/config.php';
$conn->query("SET time_zone = '+07:00'");

// Fungsi Decode JWT
function verify_jwt_hs256($jwt, $secret) {
    $parts = explode('.', $jwt);
    if (count($parts) != 3) return false;
    list($header64, $payload64, $sig64) = $parts;
    $valid_sig = hash_hmac('sha256', "$header64.$payload64", $secret, true);
    $provided_sig = base64_decode(strtr($sig64, '-_', '+/'));
    if (!hash_equals($valid_sig, $provided_sig)) return false;
    $payload_json = base64_decode(strtr($payload64, '-_', '+/'));
    return json_decode($payload_json, true);
}

// 2. TERIMA DATA
$json_input = file_get_contents('php://input');
$raw_data = json_decode($json_input, true);

if (!$raw_data || !isset($raw_data['token'])) {
    http_response_code(401);
    echo json_encode(["status" => "error", "message" => "Token tidak ada"]);
    exit();
}

$input = verify_jwt_hs256($raw_data['token'], $JWT_SECRET_KEY);
if (!$input) {
    file_put_contents('debug_log.txt', date("[H:i:s]") . " TOKEN INVALID\n", FILE_APPEND);
    http_response_code(403);
    echo json_encode(["status" => "error", "message" => "Token Invalid"]);
    exit();
}

// 3. LOG DATA MASUK (PRETTY PRINT)
$log_payload = json_encode($input, JSON_PRETTY_PRINT);
$log_message = date("[Y-m-d H:i:s]") . " PAYLOAD DECODED:\n" . $log_payload . PHP_EOL;
file_put_contents('debug_log.txt', $log_message, FILE_APPEND);


// =============================================================
// 4. MAPPING TIPE & PROSES INSERT
// =============================================================
$type = $input['type'] ?? '';
$target_table = '';
$db_time_column = ''; 

if ($type == '2min') {
    $target_table = 'sensor_data_2min_avg';
    $db_time_column = '2min_timestamp'; 
} elseif ($type == 'hourly') {
    $target_table = 'sensor_data_hourly_avg';
    $db_time_column = 'hour_timestamp'; 
} elseif ($type == 'daily') {
    $target_table = 'sensor_data_daily_avg';
    $db_time_column = 'day_timestamp';  
} else {
    echo json_encode(["status" => "error", "message" => "Tipe data ($type) tidak dikenali"]);
    exit();
}

// Translate Timestamp
if (isset($input['timestamp'])) {
    $input[$db_time_column] = $input['timestamp'];
}

$trengginas_id = $conn->real_escape_string($input['trengginas_id'] ?? '');

$existing_columns = [];
$col_query = $conn->query("SHOW COLUMNS FROM $target_table");
while ($row = $col_query->fetch_assoc()) {
    $existing_columns[] = $row['Field'];
}

$insert_cols = [];
$insert_vals = [];
$types = "";
$excluded_cols = ['station_name', 'latitude', 'longitude', 'id', 'type', 'iat'];

foreach ($input as $key => $value) {
    if (in_array($key, $existing_columns) && !in_array($key, $excluded_cols)) {
        $insert_cols[] = "`$key`"; 
        $insert_vals[] = $value;
        $types .= "s";
    }
}

// Cek ID Stasiun (Key Check)
if (in_array('trengginas_id', $existing_columns) && !isset($input['trengginas_id'])) {
    $insert_cols[] = "`trengginas_id`";
    $insert_vals[] = $trengginas_id;
    $types .= "s";
}

if (!empty($insert_cols)) {
    $cols_str = implode(", ", $insert_cols);
    $placeholders = implode(", ", array_fill(0, count($insert_vals), "?"));

    $sql = "INSERT IGNORE INTO $target_table ($cols_str) VALUES ($placeholders)";

    $stmt = $conn->prepare($sql);
    if ($stmt) {
        $stmt->bind_param($types, ...$insert_vals);
        
        if ($stmt->execute()) {

            // =============================================================
            // 5. UPDATE STATIONS (last_active + name + lat + lng + timezone)
            // =============================================================
            $station_name = $conn->real_escape_string($input['station_name'] ?? '');
            $latitude     = $conn->real_escape_string($input['latitude'] ?? '');
            $longitude    = $conn->real_escape_string($input['longitude'] ?? '');

            // Auto-detect timezone dari longitude
            // WIB  (UTC+7): Sumatera, Jawa, Kalbar, Kalteng        → lng < 115°
            // WITA (UTC+8): Bali, NTB, NTT, Kaltim, Sulawesi       → 115° <= lng < 128°
            // WIT  (UTC+9): Maluku, Papua                           → lng >= 128°
            $timezone = 'WIB'; // default
            if (!empty($longitude)) {
                $lng_float = floatval($longitude);
                if ($lng_float >= 128) {
                    $timezone = 'WIT';
                } elseif ($lng_float >= 115) {
                    $timezone = 'WITA';
                } else {
                    $timezone = 'WIB';
                }
            }

            $conn->query("UPDATE stations SET 
                last_active = NOW(), 
                status = 'active',
                timezone = '$timezone'
                " . (!empty($station_name) ? ", name = '$station_name'"   : "") . "
                " . (!empty($latitude)     ? ", latitude = '$latitude'"   : "") . "
                " . (!empty($longitude)    ? ", longitude = '$longitude'" : "") . "
                WHERE trengginas_id = '$trengginas_id'");

            // Log hasil UPDATE stations
            $update_info = "name=$station_name, lat=$latitude, lng=$longitude, timezone=$timezone";
            file_put_contents('debug_log.txt', " >> STATION UPDATE: $update_info" . PHP_EOL, FILE_APPEND);
            
            if ($stmt->affected_rows > 0) {
                $msg = "SUKSES: Data tersimpan.";
                file_put_contents('debug_log.txt', " >> STATUS: MASUK DB!" . PHP_EOL . str_repeat("-", 30) . PHP_EOL, FILE_APPEND);
                echo json_encode(["status" => "success", "message" => $msg]);
            } else {
                $msg = "INFO: Data duplikat (sudah ada).";
                file_put_contents('debug_log.txt', " >> STATUS: SKIP (DUPLIKAT)" . PHP_EOL . str_repeat("-", 30) . PHP_EOL, FILE_APPEND);
                echo json_encode(["status" => "success", "message" => $msg]);
            }
        } else {
            $err = "SQL EXEC ERROR: " . $stmt->error;
            file_put_contents('debug_log.txt', " >> ERROR: $err" . PHP_EOL, FILE_APPEND);
            echo json_encode(["status" => "error", "message" => $err]);
        }
        $stmt->close();
    } else {
        $err = "PREPARE ERROR: " . $conn->error;
        file_put_contents('debug_log.txt', " >> ERROR: $err" . PHP_EOL, FILE_APPEND);
        echo json_encode(["status" => "error", "message" => $err]);
    }
} else {
    $msg = "WARNING: Tidak ada kolom yang cocok.";
    file_put_contents('debug_log.txt', " >> $msg" . PHP_EOL, FILE_APPEND);
    echo json_encode(["status" => "warning", "message" => $msg]);
}

$conn->close();
?>