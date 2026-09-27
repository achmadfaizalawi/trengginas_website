<?php
/**
 * GET STATIONS - Ambil semua stasiun
 * URL: get_data.php?action=stations
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// Database connection
require_once __DIR__ . '/config.php';
$conn->query("SET time_zone = '+07:00'");

$action = $_GET['action'] ?? 'help';

// =================================================================
// ROUTER
// =================================================================
switch($action) {
    
    // GET ALL STATIONS
    case 'stations':
        $sql = "SELECT * FROM stations ORDER BY name ASC";
        $result = $conn->query($sql);
        $data = $result->fetch_all(MYSQLI_ASSOC);
        echo json_encode($data);
        break;
    
    // GET SENSOR DATA (2 MENIT)
    case 'sensor_2min':
        $trengginas_id = $_GET['station'] ?? '';
        $limit = $_GET['limit'] ?? 100;
        
        $sql = "SELECT * FROM sensor_data_2min_avg 
                WHERE trengginas_id = '$trengginas_id' 
                ORDER BY 2min_timestamp DESC 
                LIMIT $limit";
        
        $result = $conn->query($sql);
        $data = $result->fetch_all(MYSQLI_ASSOC);
        echo json_encode($data);
        break;
    
    // GET SENSOR DATA (HOURLY)
    case 'sensor_hourly':
        $trengginas_id = $_GET['station'] ?? '';
        $limit = $_GET['limit'] ?? 100;
        
        $sql = "SELECT * FROM sensor_data_hourly_avg 
                WHERE trengginas_id = '$trengginas_id' 
                ORDER BY hour_timestamp DESC 
                LIMIT $limit";
        
        $result = $conn->query($sql);
        $data = $result->fetch_all(MYSQLI_ASSOC);
        echo json_encode($data);
        break;
    
    // GET SENSOR DATA (DAILY)
    case 'sensor_daily':
        $trengginas_id = $_GET['station'] ?? '';
        $limit = $_GET['limit'] ?? 100;
        
        $sql = "SELECT * FROM sensor_data_daily_avg 
                WHERE trengginas_id = '$trengginas_id' 
                ORDER BY day_timestamp DESC 
                LIMIT $limit";
        
        $result = $conn->query($sql);
        $data = $result->fetch_all(MYSQLI_ASSOC);
        echo json_encode($data);
        break;
    
    // GET LATEST DATA FOR ALL STATIONS
    case 'latest_all':
        $sql = "SELECT 
                    s.trengginas_id,
                    s.name,
                    d.2min_timestamp,
                    d.avg_ph,
                    d.avg_cod,
                    d.avg_tss,
                    d.avg_ammonia,
                    d.avg_debit,
                    TIMESTAMPDIFF(MINUTE, d.2min_timestamp, NOW()) as minutes_ago
                FROM stations s
                LEFT JOIN (
                    SELECT trengginas_id, MAX(2min_timestamp) as latest
                    FROM sensor_data_2min_avg
                    GROUP BY trengginas_id
                ) latest ON s.trengginas_id = latest.trengginas_id
                LEFT JOIN sensor_data_2min_avg d 
                    ON s.trengginas_id = d.trengginas_id 
                    AND d.2min_timestamp = latest.latest
                ORDER BY s.name";
        
        $result = $conn->query($sql);
        $data = $result->fetch_all(MYSQLI_ASSOC);
        echo json_encode($data);
        break;
    
    // GET USERS
    case 'users':
        $sql = "SELECT id, username, full_name, role, assigned_station_id FROM users ORDER BY id ASC";
        $result = $conn->query($sql);
        $data = $result->fetch_all(MYSQLI_ASSOC);
        echo json_encode($data);
        break;
    
    // GET THRESHOLDS
    case 'thresholds':
        $trengginas_id = $_GET['station'] ?? '';
        
        $sql = "SELECT * FROM station_thresholds 
                WHERE trengginas_id = '$trengginas_id' 
                AND enabled = 1";
        
        $result = $conn->query($sql);
        $data = $result->fetch_all(MYSQLI_ASSOC);
        echo json_encode($data);
        break;
    
    // GET SERIAL NUMBERS
    case 'serials':
        $sql = "SELECT * FROM serial_numbers ORDER BY id DESC";
        $result = $conn->query($sql);
        $data = $result->fetch_all(MYSQLI_ASSOC);
        echo json_encode($data);
        break;
    
    // CUSTOM QUERY
    case 'custom':
        $trengginas_id = $_GET['station'] ?? '';
        $date = $_GET['date'] ?? date('Y-m-d');
        
        $sql = "SELECT * FROM sensor_data_2min_avg 
                WHERE trengginas_id = '$trengginas_id' 
                AND DATE(2min_timestamp) = '$date'
                ORDER BY 2min_timestamp ASC";
        
        $result = $conn->query($sql);
        $data = $result->fetch_all(MYSQLI_ASSOC);
        echo json_encode($data);
        break;
    
    // HELP / USAGE
    default:
        echo json_encode([
            'message' => 'TRENGGINAS WQMS Data API',
            'usage' => [
                'Get all stations' => '?action=stations',
                'Get sensor data (2min)' => '?action=sensor_2min&station=TRG-001&limit=100',
                'Get sensor data (hourly)' => '?action=sensor_hourly&station=TRG-001&limit=100',
                'Get sensor data (daily)' => '?action=sensor_daily&station=TRG-001&limit=100',
                'Get latest all stations' => '?action=latest_all',
                'Get users' => '?action=users',
                'Get thresholds' => '?action=thresholds&station=TRG-001',
                'Get serial numbers' => '?action=serials',
                'Get data by date' => '?action=custom&station=TRG-001&date=2026-03-06'
            ]
        ]);
}

$conn->close();
?>