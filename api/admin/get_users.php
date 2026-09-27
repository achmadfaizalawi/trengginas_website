<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

require_once __DIR__ . '/../config.php';

// Tambahkan 'full_name' di query SELECT
$sql = "SELECT id, full_name, username, role, assigned_station_id FROM users ORDER BY id ASC";
$result = $conn->query($sql);

$users = [];
while($row = $result->fetch_assoc()) {
    $users[] = $row;
}

echo json_encode($users);
$conn->close();
?>