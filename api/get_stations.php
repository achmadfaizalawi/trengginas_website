<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

require_once __DIR__ . '/config.php';

$user_id = $_GET['user_id'] ?? '';

if(empty($user_id)) { die(json_encode([])); }

// 1. CEK ROLE
$qUser = $conn->prepare("SELECT role, assigned_station_id FROM users WHERE id = ?");
$qUser->bind_param("i", $user_id);
$qUser->execute();
$userData = $qUser->get_result()->fetch_assoc();

if(!$userData) die(json_encode([])); 

$role = $userData['role'];
$assigned_str = $userData['assigned_station_id']; 

// 2. QUERY LOGIC (Tambahkan visible_params + company_name + serial_code via LEFT JOIN)
$sql = "";
if ($role == 'superuser' || $role == 'admin') {
    $sql = "SELECT s.id, s.trengginas_id, s.name, s.latitude, s.longitude, s.status, s.last_active, s.visible_params, sn.company_name, sn.serial_code 
            FROM stations s 
            LEFT JOIN serial_numbers sn ON s.name = sn.used_by 
            ORDER BY s.name ASC";
} else {
    if (empty($assigned_str)) { echo json_encode([]); exit; }
    
    $ids = explode(',', $assigned_str);
    $safe_ids = array_map(function($id) use ($conn) {
        return "'" . $conn->real_escape_string(trim($id)) . "'";
    }, $ids);
    $id_list = implode(',', $safe_ids);
    
    $sql = "SELECT s.id, s.trengginas_id, s.name, s.latitude, s.longitude, s.status, s.last_active, s.visible_params, sn.company_name, sn.serial_code 
            FROM stations s 
            LEFT JOIN serial_numbers sn ON s.name = sn.used_by 
            WHERE s.id IN ($id_list) 
            ORDER BY s.name ASC";
}

$result = $conn->query($sql);
$data = [];
if ($result) {
    while($row = $result->fetch_assoc()) {
        $data[] = $row;
    }
}

echo json_encode($data);
$conn->close();
?>